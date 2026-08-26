import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LedgerService } from './ledger.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { RolUsuario } from '@prisma/client';

@Injectable()
export class AccountingIntegrityCron {
  private readonly logger = new Logger(AccountingIntegrityCron.name);

  constructor(
    private readonly ledgerService: LedgerService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /**
   * Ejecutar validación de integridad todas las noches a las 2:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleNightlyIntegrityCheck() {
    this.logger.log(
      '[Cron] Iniciando verificación nocturna de integridad contable...',
    );

    try {
      // 1. Verificar balance global (D = C)
      const global = await this.ledgerService.verificarIntegridadGlobal();

      // 2. Verificar integridad por caja (Saldo vs Libro)
      const cajas = await this.ledgerService.verificarIntegridadCajas();
      const cajasDescuadradas = cajas.filter((c) => !c.correct);

      if (!global.balanced || cajasDescuadradas.length > 0) {
        this.logger.error(
          '[Cron] 🚨 INCONSISTENCIA DETECTADA en el sistema contable.',
        );

        // Sube del coordinador para arriba.
        //
        // Antes solo se avisaba al COORDINADOR, y si esa cuenta no la revisa
        // nadie la alerta se queda en la base sin que nadie la lea. Un libro
        // descuadrado tiene que llegarle a quien pueda ordenar que se revise.
        await this.notificacionesService.notifyRolesDeduped({
          roles: [
            RolUsuario.COORDINADOR,
            RolUsuario.ADMIN,
            RolUsuario.SUPER_ADMINISTRADOR,
          ],
          // Una por día: si el descuadre sigue ahí mañana vuelve a avisar,
          // pero no repite la misma alerta si el cron corre dos veces.
          dedupeKey: `integridad-contable:${new Date().toISOString().slice(0, 10)}`,
          titulo: '🚨 Alerta de Integridad Contable',
          mensaje: `Se detectaron inconsistencias en el cierre nocturno: ${!global.balanced ? 'Balance global descuadrado. ' : ''}${cajasDescuadradas.length} cajas con diferencias vs libro mayor.`,
          tipo: 'SISTEMA',
          entidad: 'CONTABILIDAD',
          metadata: {
            globalBalanced: global.balanced,
            diferenciaGlobal: global.diferencia,
            cajasDescuadradas: cajasDescuadradas.map((c) => ({
              nombre: c.nombre,
              dif: c.diferencia,
            })),
          },
        });
      } else {
        this.logger.log(
          '[Cron] ✅ Verificación completada. El sistema está íntegro.',
        );
      }
    } catch (error) {
      this.logger.error(
        '[Cron] Error durante la verificación de integridad:',
        error,
      );
    }
  }
}
