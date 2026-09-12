import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { getBogotaStartEndOfDay } from '../utils/date-utils';

/**
 * Jobs nocturnos sobre el estado de cuotas y préstamos.
 *
 *  - `revisarProrrogasExpiradas` (EVERY_DAY_AT_1AM): prórrogas vencidas sin
 *    pago vuelven a VENCIDA y el préstamo a EN_MORA.
 *  - `marcarCuotasVencidas` ('10 0 * * *'): cuotas PENDIENTE/PARCIAL con fecha
 *    anterior a hoy pasan a VENCIDA y su préstamo a EN_MORA.
 *
 * ── Hora real de ejecución ─────────────────────────────────────────────────
 * Estos dos `@Cron` no declaran `timeZone`, y el repo no fija `TZ`: corren con
 * el reloj del proceso. En un servidor en UTC, "1 AM" son las 8 p. m. del día
 * anterior en Bogotá y "00:10" son las 7:10 p. m.
 *
 * ── Lo que NO hacen ────────────────────────────────────────────────────────
 * No recalculan el nivel de riesgo del cliente ni envían notificaciones de
 * mora. Eso es `MoraService.procesarMoraAutomatica`, que tiene su propio cron
 * (`procesarMoraDiaria`, 6:00 a. m. de Bogotá con zona explícita) y además
 * corre al arrancar en producción.
 */
@Injectable()
export class LoansScheduler {
  private readonly logger = new Logger(LoansScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async revisarProrrogasExpiradas() {
    this.logger.log('Iniciando revision de prorrogas expiradas...');

    const ahora = new Date();

    try {
      // 1. Buscar préstamos ACTIVO que tengan cuotas PRORROGADA con fecha ya vencida
      const prestamosConProrrogaVencida = await this.prisma.prestamo.findMany({
        where: {
          estado: 'ACTIVO',
          cuotas: {
            some: {
              estado: 'PRORROGADA',
              fechaVencimientoProrroga: {
                lt: ahora, // la prórroga ya venció
              },
            },
          },
        },
        include: {
          cuotas: {
            where: {
              estado: 'PRORROGADA',
              fechaVencimientoProrroga: { lt: ahora },
            },
          },
        },
      });

      if (prestamosConProrrogaVencida.length === 0) {
        this.logger.log('No hay prorrogas expiradas. Todo en orden.');
        return;
      }

      this.logger.warn(
        `Encontrados ${prestamosConProrrogaVencida.length} prestamo(s) con prorroga expirada. Actualizando...`,
      );

      // 2. Para cada préstamo, revertir estado a EN_MORA y cuotas a VENCIDA
      await this.prisma.$transaction(async (tx) => {
        for (const prestamo of prestamosConProrrogaVencida) {
          // Marcar cuotas PRORROGADA (expiradas) de vuelta a VENCIDA
          await tx.cuota.updateMany({
            where: {
              prestamoId: prestamo.id,
              estado: 'PRORROGADA',
              fechaVencimientoProrroga: { lt: ahora },
            },
            data: {
              estado: 'VENCIDA',
            },
          });

          // Devolver el préstamo a EN_MORA
          await tx.prestamo.update({
            where: { id: prestamo.id },
            data: { estado: 'EN_MORA' },
          });

          this.logger.warn(
            `Prestamo ${prestamo.numeroPrestamo} → EN_MORA (prorroga expirada)`,
          );
        }
      });

      this.logger.log(
        `Revision completada. ${prestamosConProrrogaVencida.length} prestamo(s) devueltos a EN_MORA.`,
      );
    } catch (error) {
      this.logger.error('Error al revisar prorrogas expiradas:', error);
    }
  }

  /**
   * Marca VENCIDA las cuotas PENDIENTE/PARCIAL cuya fecha ya pasó.
   *
   * El corte es el inicio del día de HOY en Bogotá, no el instante actual: una
   * cuota que vence hoy sigue cobrable hasta que termine el día, aunque el cron
   * corra de noche. Hora real de ejecución: ver la nota de la clase.
   */
  @Cron('10 0 * * *')
  async marcarCuotasVencidas() {
    this.logger.log('Marcando cuotas vencidas...');
    const { startDate: ahora } = getBogotaStartEndOfDay(new Date());

    try {
      // Cuotas PENDIENTE/PARCIAL cuya fechaVencimiento ya pasó
      const resultado = await this.prisma.cuota.updateMany({
        where: {
          estado: { in: ['PENDIENTE', 'PARCIAL'] },
          fechaVencimiento: { lt: ahora },
          prestamo: {
            estado: { in: ['ACTIVO', 'EN_MORA'] },
          },
        },
        data: { estado: 'VENCIDA' },
      });

      if (resultado.count > 0) {
        // Marcar en mora los préstamos ACTIVO que ahora tienen cuotas VENCIDA
        await this.prisma.prestamo.updateMany({
          where: {
            estado: 'ACTIVO',
            cuotas: {
              some: { estado: 'VENCIDA' },
            },
          },
          data: { estado: 'EN_MORA' },
        });

        this.logger.warn(`${resultado.count} cuota(s) marcadas como VENCIDA.`);
      } else {
        this.logger.log('No hay cuotas vencidas nuevas.');
      }
    } catch (error) {
      this.logger.error('Error al marcar cuotas vencidas:', error);
    }
  }
}
