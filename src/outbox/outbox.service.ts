import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { MirrorEnvioService } from '../mirror/mirror-envio.service';

type OutboxPayload = {
  model?: string;
  action?: string;
  data?: unknown;
};

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  /**
   * Cuantas veces se intenta antes de rendirse.
   *
   * Eran 10, y con una vuelta cada 30 segundos eso son cinco minutos: con el
   * espejo caido una hora, los eventos se abandonaban. BullMQ, que es lo que
   * se quito de en medio, reintentaba 1000 veces con espera exponencial.
   *
   * Con el backoff de abajo, 80 intentos cubren 74 horas: un fin de semana
   * largo con el VPS apagado y la replica se pone al dia el lunes.
   *
   * Ochenta parecen muchos y no lo son: de la octava espera en adelante va una
   * hora entre intentos, asi que son unas 74 peticiones repartidas en tres
   * dias. Mi primera cuenta decia que 18 bastaban para 72 horas; eran 12.
   */
  private readonly maxAttempts = 80;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mirror: MirrorEnvioService,
  ) {}

  /**
   * Cuanto hay que esperar antes de volver a intentar, segun los intentos.
   *
   * Exponencial desde 30 segundos y con tope en una hora, que es lo que hacia
   * BullMQ. Sin esto, los 18 intentos se gastarian en nueve minutos y el
   * evento quedaria abandonado aunque el espejo volviera despues.
   *
   *   1 intento   30 s        6 intentos  16 min
   *   2 intentos   1 min      7 intentos  32 min
   *   3 intentos   2 min      8 o mas      1 h  (tope)
   *
   * Las siete primeras esperas suman 63 minutos; de la octava en adelante va
   * una hora por intento, asi que los 80 cubren 74 horas desde la primera.
   */
  protected esperaTrasFallo(attempts: number): number {
    const UNA_HORA = 60 * 60 * 1000;
    const base = 30 * 1000 * Math.pow(2, Math.max(0, attempts - 1));
    return Math.min(base, UNA_HORA);
  }

  @Cron('*/30 * * * * *')
  async handleOutboxTick() {
    await this.processPending();
    await this.pruneProcessed();
  }

  async processPending(limit = 100) {
    if (this.processing) return;
    this.processing = true;

    try {
      const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
      const events = await this.prisma.outboxEvent.findMany({
        where: {
          OR: [
            { status: 'PENDING' },
            { status: 'FAILED', attempts: { lt: this.maxAttempts } },
            { status: 'PROCESSING', updatedAt: { lt: staleBefore } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      const ahora = Date.now();
      for (const event of events) {
        /*
         * El backoff se aplica aqui y no en la consulta porque depende de
         * `attempts`, y Prisma no compara dos columnas de la misma fila en un
         * `where`. Son como mucho 100 filas por vuelta, asi que filtrarlas en
         * memoria no cuesta nada.
         *
         * `updatedAt` es `@updatedAt` en el esquema, asi que lleva la hora del
         * ultimo intento sin necesidad de una columna nueva ni de migracion.
         */
        if (event.status === 'FAILED' && event.attempts > 0) {
          const desdeElUltimo = ahora - new Date(event.updatedAt).getTime();
          if (desdeElUltimo < this.esperaTrasFallo(event.attempts)) continue;
        }
        await this.processEvent(event);
      }
    } finally {
      this.processing = false;
    }
  }

  private async processEvent(event: {
    id: string;
    eventType: string;
    aggregateType: string;
    payload: unknown;
  }) {
    const claimed = await this.prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: { in: ['PENDING', 'FAILED'] },
      },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    if (claimed.count !== 1) return;

    try {
      await this.publish(event);

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[OUTBOX] Error procesando ${event.eventType} (${event.id}): ${message}`,
      );

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'FAILED',
          lastError: message,
        },
      });
    }
  }

  private async pruneProcessed() {
    await this.prisma.outboxEvent.deleteMany({
      where: {
        status: 'PROCESSED',
        processedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
  }

  private async publish(event: { aggregateType: string; payload: unknown }) {
    const payload = event.payload as OutboxPayload;
    const model = payload?.model || event.aggregateType;
    const action = payload?.action;

    /*
     * La replica al espejo se manda AQUI, directamente.
     *
     * Antes esto emitia `database.write.success` y un escucha de
     * `MirrorSyncModule` encolaba en BullMQ. Medido: cada escritura encolaba
     * DOS trabajos, porque `PrismaService` emite el mismo evento en el acto al
     * escribir y este lo emitia otra vez 30 segundos despues al publicar la
     * fila. El receptor es idempotente, asi que no se veia; lo que se pagaba
     * era el doble de operaciones de Redis.
     *
     * Ahora el envio es trabajo del outbox y de nadie mas: si falla, se lanza,
     * la fila queda FAILED con el motivo y se reintenta con el backoff de
     * arriba. El evento se sigue emitiendo porque lo escucha el gateway de
     * notificaciones, que es quien manda los avisos en tiempo real.
     *
     * En el espejo no se hace ninguna de las dos cosas: `IS_MIRROR_VPS` lo
     * distingue, y sin eso el espejo se reenviaria a si mismo lo que acaba de
     * recibir.
     */
    if (process.env.IS_MIRROR_VPS !== 'true') {
      await this.eventEmitter.emitAsync('database.write.success', {
        model,
        action,
        data: payload?.data,
      });

      if (action) {
        await this.mirror.enviar({ model, action, data: payload?.data });
      }
    }

    if (model === 'Aprobacion') {
      if (action === 'create' || action === 'createMany') {
        await this.eventEmitter.emitAsync('aprobacion.created', {
          data: payload?.data,
        });
      }
      if (
        ['update', 'updateMany', 'upsert', 'delete', 'deleteMany'].includes(
          String(action),
        )
      ) {
        await this.eventEmitter.emitAsync('aprobacion.updated', {
          data: payload?.data,
        });
      }
    }
  }
}
