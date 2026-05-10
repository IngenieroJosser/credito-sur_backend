import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LedgerService } from './ledger.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

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
    this.logger.log('[Cron] Iniciando verificación nocturna de integridad contable...');

    try {
      // 1. Verificar balance global (D = C)
      const global = await this.ledgerService.verificarIntegridadGlobal();
      
      // 2. Verificar integridad por caja (Saldo vs Libro)
      const cajas = await this.ledgerService.verificarIntegridadCajas();
      const cajasDescuadradas = cajas.filter(c => !c.correct);

      if (!global.balanced || cajasDescuadradas.length > 0) {
        this.logger.error('[Cron] 🚨 INCONSISTENCIA DETECTADA en el sistema contable.');
        
        // Notificar al coordinador/admin
        await this.notificacionesService.notifyCoordinator({
          titulo: '🚨 Alerta de Integridad Contable',
          mensaje: `Se detectaron inconsistencias en el cierre nocturno: ${!global.balanced ? 'Balance global descuadrado. ' : ''}${cajasDescuadradas.length} cajas con diferencias vs libro mayor.`,
          tipo: 'SISTEMA',
          entidad: 'CONTABILIDAD',
          metadata: {
            globalBalanced: global.balanced,
            diferenciaGlobal: global.diferencia,
            cajasDescuadradas: cajasDescuadradas.map(c => ({ nombre: c.nombre, dif: c.diferencia })),
          },
        });
      } else {
        this.logger.log('[Cron] ✅ Verificación completada. El sistema está íntegro.');
      }
    } catch (error) {
      this.logger.error('[Cron] Error durante la verificación de integridad:', error);
    }
  }
}
