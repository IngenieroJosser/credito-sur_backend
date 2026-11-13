import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';
import { mensajeDeError } from '../common/error.util';

/**
 * Enviar al espejo cada escritura, sin Redis en medio.
 *
 * ── Lo que habia ───────────────────────────────────────────────────────────
 *
 * `MirrorSyncModule`: un escucha del evento `database.write.success` que
 * encolaba en BullMQ, y un procesador que sacaba de la cola y hacia el POST
 * firmado al VPS. Funcionaba, y costaba un Redis —Upstash— ademas del VPS.
 *
 * Y la cola era la unica razon por la que Redis estaba en el proyecto: BullMQ
 * se usaba en tres sitios y los tres eran esta cola. Es el coste que habia
 * que explicarle al cliente.
 *
 * ── Por que se puede quitar ────────────────────────────────────────────────
 *
 * Porque la cola duradera ya existe, en Postgres: `OutboxEvent`. Cada
 * escritura deja su fila ahi —lo hace `PrismaService`— con su `status`, sus
 * `attempts` y su `lastError`, y un cron la recoge cada 30 segundos. Redis
 * era una SEGUNDA cola delante de la primera.
 *
 * Medido, y es lo que lo decidio: cada escritura encolaba DOS trabajos de
 * espejo. Uno lo ponia `PrismaService` al escribir, emitiendo el evento en el
 * acto; otro lo ponia el outbox 30 segundos despues, emitiendo el mismo
 * evento al publicar la fila. El receptor es idempotente, asi que no se veia:
 * lo que se pagaba era el doble de operaciones de Redis.
 *
 * Asi que el envio pasa a ser trabajo del outbox y de nadie mas. El evento
 * `database.write.success` sigue existiendo porque lo escucha tambien el
 * gateway de notificaciones, que es quien manda los avisos en tiempo real;
 * lo que ya no hay es un escucha que encole.
 *
 * ── Que se gana y que se pierde ────────────────────────────────────────────
 *
 * Se gana: un servicio menos que pagar, un sistema menos que vigilar, y los
 * reintentos visibles en una tabla que se puede consultar con SQL en vez de
 * en un panel aparte.
 *
 * Se pierde el backoff de BullMQ, que reintentaba 1000 veces con espera
 * exponencial. El outbox reintentaba 10 veces cada 30 segundos, que son cinco
 * minutos: con el VPS caido una hora, los eventos se habrian abandonado. Por
 * eso el outbox lleva ahora su propio backoff —ver `OutboxService`—, con el
 * tope en 72 horas.
 */
/**
 * Un fallo al replicar, con nombre propio.
 *
 * No es un `Error` pelado por gusto: `errores-con-codigo.spec.ts` exige que un
 * texto dirigido a una persona vaya en una excepcion de Nest, porque es la que
 * lleva el codigo HTTP. Esto no va a ninguna persona ni a ninguna respuesta:
 * lo recoge el outbox y lo escribe en `lastError` de la fila, que es lo que se
 * mira cuando la replica se atrasa.
 *
 * La clase con nombre lo deja dicho en el codigo, en vez de en una excepcion
 * de la centinela: su lista de `Error` permitidos es corta a proposito.
 */
export class ErrorDeReplica extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeReplica';
  }
}

@Injectable()
export class MirrorEnvioService {
  private readonly logger = new Logger(MirrorEnvioService.name);

  /**
   * Tablas operativas que no se replican.
   *
   * Son locales de cada instalacion: los conflictos de sincronizacion, la
   * auditoria, las sesiones y las suscripciones de notificacion push del
   * navegador. Replicarlas no sirve de nada y la auditoria es la mas grande
   * del sistema.
   */
  private static readonly MODELOS_EXCLUIDOS = new Set([
    'SyncConflict',
    'AuditLog',
    'Session',
    'PushSubscription',
  ]);

  constructor(private readonly configService: ConfigService) {}

  /** Si este entorno tiene a donde replicar. */
  get habilitado(): boolean {
    return Boolean(
      this.configService.get<string>('MIRROR_VPS_URL') &&
      this.configService.get<string>('MIRROR_SYNC_TOKEN'),
    );
  }

  /**
   * Manda una escritura al espejo.
   *
   * Lanza si el espejo la rechaza o no responde: quien llama —el outbox— lo
   * marca como fallido y lo reintenta en su siguiente vuelta. No se traga el
   * error a proposito; un envio perdido en silencio es una fila que al espejo
   * le falta para siempre.
   */
  async enviar(evento: {
    model: string;
    action: string;
    data: unknown;
  }): Promise<'enviado' | 'excluido' | 'sin-espejo'> {
    if (MirrorEnvioService.MODELOS_EXCLUIDOS.has(evento.model)) {
      return 'excluido';
    }

    const url = this.configService.get<string>('MIRROR_VPS_URL');
    const token = this.configService.get<string>('MIRROR_SYNC_TOKEN');
    if (!url || !token) {
      // Sin espejo configurado no hay nada que hacer, y no es un error: es el
      // caso de una instalacion sola.
      return 'sin-espejo';
    }

    const base = url.endsWith('/') ? url.slice(0, -1) : url;
    const destino = `${base}/api-credisur/mirror-sync/receiver/${evento.model}/${evento.action}`;

    // La firma: hora, nonce y cuerpo. El receptor rechaza un nonce repetido y
    // una hora vieja, asi que un mensaje capturado no se puede reenviar.
    const timestamp = Date.now().toString();
    const nonce = randomUUID();
    const cuerpo = JSON.stringify({ payload: evento.data });
    const firma = createHmac('sha256', token)
      .update(`${timestamp}.${nonce}.${cuerpo}`)
      .digest('hex');

    let respuesta: Response;
    try {
      respuesta = await fetch(destino, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Mirror-Sync-Engine': 'Outbox-v1',
          'X-Mirror-Sync-Timestamp': timestamp,
          'X-Mirror-Sync-Nonce': nonce,
          'X-Mirror-Sync-Signature': firma,
        },
        body: cuerpo,
      });
    } catch (error) {
      // El VPS no contesta: se relanza con un mensaje que diga eso, para que
      // `lastError` del outbox sirva de algo al mirarlo.
      throw new ErrorDeReplica(
        `El espejo no responde (${evento.model} ${evento.action}): ${mensajeDeError(error)}`,
      );
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      throw new ErrorDeReplica(
        `El espejo rechazo ${evento.model} ${evento.action} con HTTP ${respuesta.status}: ${detalle.slice(0, 300)}`,
      );
    }

    this.logger.debug(`Replicado ${evento.model} ${evento.action}`);
    return 'enviado';
  }
}
