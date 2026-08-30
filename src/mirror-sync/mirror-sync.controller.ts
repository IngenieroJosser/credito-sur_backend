import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createHmac, timingSafeEqual } from 'crypto';

@Controller('mirror-sync')
export class MirrorSyncController {
  private readonly logger = new Logger(MirrorSyncController.name);
  private readonly usedNonces = new Map<string, number>();
  private readonly allowedModels = new Set([
    'Notificacion', 'Cliente', 'Producto', 'PrecioProducto', 'Prestamo',
    'Cuota', 'ExtensionPago', 'Pago', 'DetallePago', 'Recibo', 'Ruta',
    'AsignacionRuta', 'Aprobacion', 'Caja', 'Transaccion', 'Gasto',
    'ArchivadoOculto', 'AlertaCliente', 'Multimedia', 'Categoria',
    'ConfiguracionSistema', 'RegistroVisita', 'EfectoProvisional',
    'RutaJornada', 'ArqueoCaja', 'ImportacionLote', 'JournalEntry',
    'JournalLine',
  ]);
  private readonly allowedActions = new Set(['create', 'update', 'upsert', 'delete']);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('receiver/:model/:action')
  async receiveSync(
    @Param('model') model: string,
    @Param('action') action: string,
    @Headers('authorization') authHeader: string,
    @Headers('x-mirror-sync-engine') engineHeader: string,
    @Headers('x-mirror-sync-timestamp') timestampHeader: string,
    @Headers('x-mirror-sync-nonce') nonceHeader: string,
    @Headers('x-mirror-sync-signature') signatureHeader: string,
    @Body() body: { payload: any },
  ) {
    // 1. Verificación Estricta de Seguridad (Búnker con expiración)
    const expectedToken = this.configService.get<string>('MIRROR_SYNC_TOKEN');

    if (
      !expectedToken ||
      authHeader !== `Bearer ${expectedToken}` ||
      engineHeader !== 'BullMQ-Engine-v1'
    ) {
      this.logger.warn(
        `Intento bloqueado de sincronización no autorizada en el Espejo.`,
      );
      throw new UnauthorizedException(
        'Token de sincronización de espejo inválido o faltante',
      );
    }

    if (!timestampHeader || !nonceHeader || !signatureHeader) {
      this.logger.warn(`Petición rechazada: Falta el Timestamp de seguridad.`);
      throw new UnauthorizedException(
        'Firma de tiempo requerida para evitar Replay Attacks',
      );
    }

    const requestTime = parseInt(timestampHeader, 10);
    const currentTime = Date.now();
    const toleranceWindowMs = 5 * 60 * 1000; // 5 minutos de tolerancia para desfaces de reloj entre Quibdó y la Nube

    if (
      isNaN(requestTime) ||
      Math.abs(currentTime - requestTime) > toleranceWindowMs
    ) {
      this.logger.error(
        `Ataque de Repetición detectado (Replay Attack) o relojes desincronizados. Petición expirada.`,
      );
      throw new UnauthorizedException(
        'El token dinámico temporal ha expirado. Sincronía rechazada.',
      );
    }

    const signedBody = JSON.stringify(body);
    const expectedSignature = createHmac('sha256', expectedToken)
      .update(`${timestampHeader}.${nonceHeader}.${signedBody}`)
      .digest('hex');
    const provided = Buffer.from(signatureHeader, 'hex');
    const expected = Buffer.from(expectedSignature, 'hex');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Firma de sincronización inválida');
    }

    const nonceExpiry = currentTime + toleranceWindowMs;
    for (const [nonce, expiresAt] of this.usedNonces) {
      if (expiresAt <= currentTime) this.usedNonces.delete(nonce);
    }
    if (this.usedNonces.has(nonceHeader)) {
      throw new UnauthorizedException('Solicitud de sincronización repetida');
    }
    this.usedNonces.set(nonceHeader, nonceExpiry);

    if (!this.allowedModels.has(model) || !this.allowedActions.has(action)) {
      throw new UnauthorizedException('Modelo u operación no permitidos');
    }

    // 2. Ejecutar la acción cruda en el Prisma del VPS
    this.logger.log(
      `Recibiendo Mirror Sync: Modelo=${model}, Accion=${action}`,
    );

    // Capitalizamos el primer caracter para mapearlo a la instancia interna de Prisma (ej: 'cliente' -> 'cliente')
    // Nota: Aunque los modelos de Prisma son camelCase en el PrismaClient.
    const prismaModelProp = model.charAt(0).toLowerCase() + model.slice(1);
    const prismaModel = (this.prisma as any)[prismaModelProp];

    if (!prismaModel) {
      this.logger.warn(
        `Modelo desconocido ignorado en el servidor espejo: ${model}`,
      );
      return { status: 'ignored', reason: 'unknown model' };
    }

    try {
      const { payload } = body;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new UnauthorizedException('Payload de sincronización inválido');
      }

      if (action === 'create' || action === 'update' || action === 'upsert') {
        const id = payload.id;

        if (id) {
          // Si el registro ya existe (por ejemplo si hubo un reconexionado o caída extraña), actualizamos
          const existing = await prismaModel.findUnique({ where: { id } });

          if (existing) {
            await prismaModel.update({
              where: { id },
              data: payload,
            });
            this.logger.debug(
              `[Mirror VPS] Row actualizado exitosamente: ${model} - ${id}`,
            );
          } else {
            // No existe localmente en el Espejo, lo creamos
            await prismaModel.create({
              data: payload,
            });
            this.logger.debug(
              `[Mirror VPS] Row replicado exitosamente: ${model} - ${id}`,
            );
          }
        } else {
          // Si no vino un ID en el payload (raro en modelos Prisma UUID, pero posible)
          await prismaModel.create({ data: payload });
          this.logger.debug(`[Mirror VPS] Row anónimo replicado en: ${model}`);
        }
      } else if (action === 'delete') {
        if (payload.id) {
          await prismaModel
            .delete({ where: { id: payload.id } })
            .catch(() => null); // Silencioso si ya no existía
          this.logger.debug(
            `[Mirror VPS] Row eliminado de la réplica: ${model} - ${payload.id}`,
          );
        }
      } else if (action === 'deleteMany' || action === 'updateMany') {
        // En réplicas espejo complejas o puras, podríamos omitir bulk si manejamos cada tupla por separado o procesarlo en crudo.
        this.logger.warn(
          `Instrucción de Bulk [${action}] recibida y auditada en el espejo para modelo: ${model}`,
        );
      }

      return { status: 'success', synced: true };
    } catch (e: any) {
      this.logger.error(
        `Error crítico procesando réplica en VPS Espejo -> ${e.message}`,
        e.stack,
      );
      throw new InternalServerErrorException('Fallo de persistencia en el VPS');
    }
  }
}
