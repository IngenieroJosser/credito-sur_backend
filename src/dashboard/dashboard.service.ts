import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { differenceInDays } from 'date-fns';
import {
  EstadoAprobacion,
  EstadoCuota,
  EstadoPrestamo,
  TipoAprobacion,
  TipoTransaccion,
} from '@prisma/client';
import { calculateDateRange, getBogotaDayKey, getBogotaStartEndOfDay, TimeFilterPeriod as BogotaPeriod } from '../utils/date-utils';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  async getDashboardData(timeFilter: string) {
    try {
      const { startDate, endDate } = this.calculateDateRangeFromFilter(timeFilter);
      const { startDate: hoyInicioBogota } = getBogotaStartEndOfDay(new Date());
      const hoyKeyBogota = getBogotaDayKey(new Date());

      const utcDateKey = (d: Date): string => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      // 1. Obtener métricas principales filtradas por período
      const pendingApprovals = await this.prisma.aprobacion.count({
        where: { 
          estado: EstadoAprobacion.PENDIENTE,
          creadoEn: { gte: startDate, lte: endDate },
        },
      });

      // Cuentas en mora: sin filtro de período porque la mora es un estado ACTUAL del préstamo,
      // no depende de cuándo se creó. Un préstamo creado hace 6 meses puede estar en mora hoy.
      // Importante: evitar falsos positivos por fechas guardadas en UTC (cuotas que vencen HOY).

      // Base solicitada (suma de aprobaciones pendientes de tipo SOLICITUD_BASE_EFECTIVO)
      const _requestedBaseResult = await this.prisma.aprobacion.aggregate({
        where: {
          estado: EstadoAprobacion.PENDIENTE,
          tipoAprobacion: TipoAprobacion.SOLICITUD_BASE_EFECTIVO,
          creadoEn: { gte: startDate, lte: endDate },
        },
        _sum: {
          montoSolicitud: true,
        },
      });

      // Calcular capital prestado del período (suma de montos de préstamos aprobados/efectivos)
      const capitalPrestado = await this.prisma.prestamo.aggregate({
        where: {
          creadoEn: { gte: startDate, lte: endDate },
          estado: {
            in: [
              EstadoPrestamo.ACTIVO,
              EstadoPrestamo.PAGADO,
              EstadoPrestamo.EN_MORA,
            ],
          },
          eliminadoEn: null,
        },
        _sum: {
          monto: true,
        },
      });

      // Recaudo del período: fuente contable oficial desde ledger.
      // Se toma únicamente cobranza de pagos (PAGO) contra cajas/bancos.
      const recaudoTotal = await this.getLedgerCobranzaTotal(startDate, endDate);

      // Eficiencia: misma lógica de efectividad de cobrador (recaudo / meta)
      // Meta = suma de cuotas con vencimiento en el período. Las cuotas iniciales
      // se reportan aparte en contabilidad y no inflan la cobranza de pagos.
      const metaCuotasRes = await this.prisma.cuota.aggregate({
        where: {
          fechaVencimiento: { gte: startDate, lte: endDate },
          prestamo: {
            eliminadoEn: null,
            estado: {
              in: [
                EstadoPrestamo.ACTIVO,
                EstadoPrestamo.EN_MORA,
                EstadoPrestamo.PAGADO,
              ],
            },
          },
        },
        _sum: { monto: true },
      });

      const metaTotal = Number(metaCuotasRes._sum?.monto || 0);
      const efficiency = metaTotal > 0
        ? Math.min(100, (recaudoTotal / metaTotal) * 100)
        : (recaudoTotal > 0 ? 100 : 0);

      // Total de pagos en el período
      const totalPagos = await this.prisma.pago.count({
        where: { fechaPago: { gte: startDate, lte: endDate } },
      });

      // 2. Obtener aprobaciones pendientes (filtradas por período)
      const pendingApprovalsList = await this.prisma.aprobacion.findMany({
      where: { 
        estado: EstadoAprobacion.PENDIENTE,
        creadoEn: { gte: startDate, lte: endDate },
      },
      include: {
        solicitadoPor: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: { creadoEn: 'desc' },
      take: 5,
    });

      // Cuentas en mora para el listado detallado: sin filtro de período.
      // Importante: NO dependemos solo de `prestamo.estado = EN_MORA` porque el job
      // automático puede no haber corrido aún. También detectamos mora por cuotas
      // no pagadas vencidas (PENDIENTE/PARCIAL/VENCIDA) comparando por llave de fecha Bogotá.
      const delinquentAccountsListRaw = await this.prisma.prestamo.findMany({
        where: {
          eliminadoEn: null,
          estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA] },
          OR: [
            { estado: EstadoPrestamo.EN_MORA },
            {
              cuotas: {
                some: {
                  estado: { in: [EstadoCuota.PENDIENTE, EstadoCuota.PARCIAL, EstadoCuota.VENCIDA] },
                  // Filtro preliminar por fecha (evita traer demasiadas filas). Luego se valida en memoria
                  // con la fecha efectiva (prórroga si existe) y la llave Bogotá.
                  fechaVencimiento: { lt: hoyInicioBogota },
                },
              },
            },
          ],
        },
        include: {
          cliente: {
            select: {
              nombres: true,
              apellidos: true,
              asignacionesRuta: {
                where: { activa: true },
                include: {
                  ruta: { select: { nombre: true } },
                  cobrador: { select: { nombres: true, apellidos: true } },
                },
                take: 1,
              },
            },
          },
          cuotas: {
            where: { estado: { in: [EstadoCuota.PENDIENTE, EstadoCuota.PARCIAL, EstadoCuota.VENCIDA] } },
            orderBy: { fechaVencimiento: 'asc' },
            take: 50,
          },
        },
        take: 50,
      });

      const delinquentAccountsList = delinquentAccountsListRaw
        .map((loan: any) => {
          const cuotas = Array.isArray(loan?.cuotas) ? loan.cuotas : [];
          const cuotasVencidasReal = cuotas.filter((c: any) => {
            if (!c) return false;
            const st = String(c?.estado || '').toUpperCase();
            if (st === 'PAGADA' || st === 'PAGADO' || st === 'ANULADA' || st === 'ANULADO') return false;
            const eff = c?.fechaVencimientoProrroga
              ? new Date(c.fechaVencimientoProrroga)
              : new Date(c.fechaVencimiento);
            if (!eff || isNaN(eff.getTime())) return false;
            const key = utcDateKey(eff);
            return !!key && key < hoyKeyBogota;
          });

          // Si el préstamo está EN_MORA pero no hay cuotas realmente vencidas, lo excluimos
          // para evitar falsos positivos históricos (mismo criterio del reporte).
          if (cuotasVencidasReal.length === 0) return null;
          return { ...loan, cuotas: cuotasVencidasReal };
        })
        .filter(Boolean)
        .slice(0, 10);

      // Conteo total de cuentas en mora: usar una consulta amplia + validación en memoria.
      // Nota: mantenemos un límite razonable para no degradar el dashboard.
      const delinquentAccountsCountRaw = await this.prisma.prestamo.findMany({
        where: {
          eliminadoEn: null,
          estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA] },
          OR: [
            { estado: EstadoPrestamo.EN_MORA },
            {
              cuotas: {
                some: {
                  estado: { in: [EstadoCuota.PENDIENTE, EstadoCuota.PARCIAL, EstadoCuota.VENCIDA] },
                  fechaVencimiento: { lt: hoyInicioBogota },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          cuotas: {
            where: { estado: { in: [EstadoCuota.PENDIENTE, EstadoCuota.PARCIAL, EstadoCuota.VENCIDA] } },
            select: { estado: true, fechaVencimiento: true, fechaVencimientoProrroga: true },
            take: 50,
          },
        },
        take: 500,
      });

      const delinquentAccounts = delinquentAccountsCountRaw.reduce((acc: number, loan: any) => {
        const cuotas = Array.isArray(loan?.cuotas) ? loan.cuotas : [];
        const tieneVencidaReal = cuotas.some((c: any) => {
          if (!c) return false;
          const st = String(c?.estado || '').toUpperCase();
          if (st === 'PAGADA' || st === 'PAGADO' || st === 'ANULADA' || st === 'ANULADO') return false;
          const eff = c?.fechaVencimientoProrroga
            ? new Date(c.fechaVencimientoProrroga)
            : new Date(c.fechaVencimiento);
          if (!eff || isNaN(eff.getTime())) return false;
          const key = utcDateKey(eff);
          return !!key && key < hoyKeyBogota;
        });
        return tieneVencidaReal ? (acc + 1) : acc;
      }, 0);

      // 4. Obtener actividad reciente (últimas aprobaciones procesadas) - filtradas por período
      const recentActivityList = await this.prisma.aprobacion.findMany({
      where: {
        estado: { in: [EstadoAprobacion.APROBADO, EstadoAprobacion.RECHAZADO] },
        actualizadoEn: { gte: startDate, lte: endDate },
      },
      include: {
        solicitadoPor: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: { actualizadoEn: 'desc' },
      take: 5,
    });

      // 5. Datos de tendencia (últimos 7 días)
      const trendData = await this.getTrendData(timeFilter);

      // 6. Top 5 Cobradores (filtrado por período) - Filtrado por Rol
      const topCollectorsRaw = await this.prisma.pago.groupBy({
      by: ['cobradorId'],
      _sum: {
        montoTotal: true,
      },
      where: {
        fechaPago: { gte: startDate, lte: endDate },
      },
      orderBy: {
        _sum: {
          montoTotal: 'desc',
        },
      },
      take: 10, // Traemos extra para filtrar
    });

      // Enriquecer con datos de usuario y filtrar
      const topCollectorsList: any[] = [];
      for (const item of topCollectorsRaw) {
        if (!item.cobradorId) continue;
        const user = await this.prisma.usuario.findUnique({
          where: { id: item.cobradorId },
          select: { nombres: true, apellidos: true, rol: true },
        });

        if (user && ['COBRADOR', 'SUPERVISOR', 'COORDINADOR'].includes(user.rol)) {
          // Calcular eficiencia real: (recaudado / meta_periodo) * 100
          // Incluimos CUOTA_INICIAL tanto en recaudo como en meta para consistencia con RoutesService
          const [metaCobroRes, cuotasInicialesRes, pagosRes] = await Promise.all([
            this.prisma.cuota.aggregate({
              where: {
                fechaVencimiento: { gte: startDate, lte: endDate },
                prestamo: {
                  cliente: {
                    asignacionesRuta: {
                      some: {
                        cobradorId: item.cobradorId,
                        activa: true
                      }
                    }
                  }
                }
              },
              _sum: { monto: true }
            }),
            this.prisma.transaccion.aggregate({
              where: {
                caja: { responsableId: item.cobradorId, tipo: 'RUTA' },
                tipoReferencia: 'CUOTA_INICIAL',
                tipo: TipoTransaccion.INGRESO,
                fechaTransaccion: { gte: startDate, lte: endDate },
              },
              _sum: { monto: true }
            }),
            this.prisma.pago.aggregate({
              where: {
                cobradorId: item.cobradorId,
                fechaPago: { gte: startDate, lte: endDate },
              },
              _sum: { montoTotal: true }
            })
          ]);

          const montoMeta = Number(metaCobroRes._sum.monto || 0) + Number(cuotasInicialesRes._sum.monto || 0);
          const collected = Number(pagosRes._sum.montoTotal || 0) + Number(cuotasInicialesRes._sum.monto || 0);
          
          // Si no hay meta, asumimos 100% de eficiencia si recaudó algo
          const efficiency = montoMeta > 0 
            ? Math.min(100, (collected / montoMeta) * 100) 
            : (collected > 0 ? 100 : 0);

          topCollectorsList.push({
            name: `${user.nombres} ${user.apellidos}`,
            collected,
            efficiency: parseFloat(efficiency.toFixed(1)),
            trend: efficiency >= 90 ? 'up' : 'down',
          });
        }
        if (topCollectorsList.length >= 5) break; 
      }

      const result = {
        metrics: {
          pendingApprovals,
          delinquentAccounts,
          requestedBase: this.calculateRequestedBase(pendingApprovalsList),
          efficiency: parseFloat(efficiency.toFixed(1)),
          capitalPrestado: Number(capitalPrestado._sum?.monto || 0),
          recaudo: recaudoTotal,
          totalPagos,
        },
        trend: trendData,
        pendingApprovals: pendingApprovalsList.map((item) =>
          this.mapApproval(item),
        ),
        delinquentAccounts: delinquentAccountsList.map((item) =>
          this.mapDelinquentAccount(item, hoyInicioBogota),
        ),
        recentActivity: recentActivityList.map((item) =>
          this.mapRecentActivity(item),
        ),
        topCollectors: topCollectorsList,
      };
      
      return result;
    } catch (error) {
      this.logger.error('Error obteniendo datos del dashboard', error instanceof Error ? error.stack : error);
      // Retornar datos de fallback en caso de error
      return {
        metrics: {
          pendingApprovals: 0,
          delinquentAccounts: 0,
          requestedBase: 0,
          efficiency: 0,
          capitalPrestado: 0,
          recaudo: 0,
        },
        trend: [],
        pendingApprovals: [],
        delinquentAccounts: [],
        recentActivity: [],
        topCollectors: [],
      };
    }
  }

  private calculateRequestedBase(approvals: any[]): number {
    let total = 0;
    approvals.forEach((approval) => {
      if (
        approval.tipoAprobacion === 'SOLICITUD_BASE_EFECTIVO' &&
        approval.datosSolicitud
      ) {
        try {
          const data =
            typeof approval.datosSolicitud === 'string'
              ? JSON.parse(approval.datosSolicitud)
              : approval.datosSolicitud;
          total += data.monto || 0;
        } catch (error) {
          // Error parsing datosSolicitud, continuar con siguiente
        }
      }
    });
    return total;
  }

  async getTrendData(timeFilter: string): Promise<any[]> {
    try {
      // Usar el mismo cálculo de fechas que getDashboardData para consistencia
      const { startDate, endDate } = this.calculateDateRangeFromFilter(timeFilter);
      let groupBy: 'day' | 'week' | 'month' = 'day';

      // Determinar cómo agrupar según el filtro de período
      switch (timeFilter) {
        case 'today':
          groupBy = 'day';
          break;
        case 'week':
          groupBy = 'day';
          break;
        case 'month':
          groupBy = 'day';
          break;
        case 'year':
          groupBy = 'month';  // Año → agrupa por mes (12 barras)
          break;
        default:
          groupBy = 'day';
      }

      const processedData = await this.processTrendData(
        startDate,
        endDate,
        groupBy,
      );

      return processedData;
    } catch (error) {
      // En caso de error, devolver datos de muestra
      return [];
    }
  }

  private async processTrendData(
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month',
  ): Promise<any[]> {
    const result: any[] = [];

    // Nota: el valor de cobros debe salir del ledger contable.
    // Para mantener consistencia con RoutesService (metaDelDia), el objetivo toma:
    // - Meta nominal: 1 cuota por préstamo (la más antigua en criterio) cuya fechaVencimiento <= inicio del día.
    // La cuota inicial queda fuera de esta tendencia porque contabilidad la expone separada de cobranza.

    // 1) Cobros contables dentro del rango
    const ledgerCobros = await this.prisma.journalLine.findMany({
      where: this.getLedgerCobranzaWhere(startDate, endDate),
      select: {
        debitAmount: true,
        journalEntry: { select: { createdAt: true } },
      },
    });

    // Agrupar por día Bogotá
    const pagosPorDiaKey = new Map<string, number>();
    for (const line of ledgerCobros) {
      const createdAt = (line as any)?.journalEntry?.createdAt;
      if (!createdAt) continue;
      const { startDate: dStart } = getBogotaStartEndOfDay(new Date(createdAt));
      const key = dStart.toISOString();
      pagosPorDiaKey.set(key, (pagosPorDiaKey.get(key) || 0) + Number((line as any).debitAmount || 0));
    }

    // 2) Meta nominal diaria (target)
    // Regla consistente con RoutesService/daily-visits:
    // - Por préstamo, contar 1 cuota si:
    //   a) Existe una cuota NO pagada (pendiente/parcial/vencida/prorrogada) con fechaVencimiento <= inicio del día
    //      -> tomar la más antigua.
    //   b) Si NO existe deuda hasta ese día, contar una cuota PAGADA en ESE día (fechaPago en el día)
    //      -> tomar la más antigua por fechaVencimiento para determinismo.
    const { startDate: endDayStartUTC, endDate: endDayEndUTC } = getBogotaStartEndOfDay(endDate);

    const cuotasNoPagadasHastaFin = await this.prisma.cuota.findMany({
      where: {
        prestamo: {
          estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA, EstadoPrestamo.PAGADO] },
          eliminadoEn: null,
        },
        fechaVencimiento: { lte: endDayEndUTC },
        OR: [
          {
            estado: {
              in: [
                EstadoCuota.PENDIENTE,
                EstadoCuota.PARCIAL,
                EstadoCuota.VENCIDA,
                EstadoCuota.PRORROGADA,
              ],
            },
          },
          {
            estado: EstadoCuota.PAGADA,
            fechaPago: { gte: startDate },
          },
        ],
      },
      select: { 
        prestamoId: true, 
        fechaVencimiento: true, 
        monto: true, 
        montoPagado: true, 
        estado: true,
        fechaPago: true,
        prestamo: { select: { frecuenciaPago: true } }
      },
      orderBy: [{ prestamoId: 'asc' }, { fechaVencimiento: 'asc' }],
    });

    if (groupBy === 'day') {
      // Agrupar por día
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

      // Limitar a máximo 30 días
      const maxDays = Math.min(daysDiff, 30);

      for (let i = 0; i <= maxDays; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        // No procesar días futuros
        if (currentDate > endDate) break;

        const { startDate: dayStartBogota, endDate: dayEndBogota } = getBogotaStartEndOfDay(currentDate);
        const dayKey = dayStartBogota.toISOString();
        const cutoffTime = dayEndBogota.getTime();
        const hoyBogotaKey = getBogotaDayKey(currentDate);

        const pagos = pagosPorDiaKey.get(dayKey) || 0;
        const total = pagos;

        let metaNominal = 0;
        const acumuladoPorPrestamo = new Map<string, number>();
        const primeraCuotaPorPrestamo = new Map<string, number>();

        for (const c of cuotasNoPagadasHastaFin) {
          if (!c.prestamoId) continue;
          const vtoKey = getBogotaDayKey(new Date(c.fechaVencimiento));
          if (vtoKey > hoyBogotaKey) continue; // Not yet due as of this day

          // Was it paid on or before this day?
          if (c.estado === EstadoCuota.PAGADA && c.fechaPago) {
            const pagoTime = new Date(c.fechaPago).getTime();
            if (pagoTime <= cutoffTime) {
              continue; // It was already paid by the end of this day
            }
          }

          const pid = String(c.prestamoId);
          const freq = String(c.prestamo?.frecuenciaPago || '').toUpperCase();
          const isDiario = freq === 'DIARIO' || freq === 'DIA';

          const montoFull = Number(c.monto || 0);
          const montoPagado = Number(c.montoPagado || 0);
          // If it's PARCIAL currently, and we are in the past, it might have been fully unpaid. 
          // For simplicity we just use the current montoPendiente as routes does.
          const montoPendiente = c.estado === EstadoCuota.PARCIAL ? Math.max(0, montoFull - montoPagado) : montoFull;

          if (montoPendiente <= 0) continue;

          if (isDiario) {
            acumuladoPorPrestamo.set(pid, (acumuladoPorPrestamo.get(pid) || 0) + montoPendiente);
          } else {
            if (!primeraCuotaPorPrestamo.has(pid)) {
              primeraCuotaPorPrestamo.set(pid, montoPendiente);
            }
          }
        }

        for (const monto of acumuladoPorPrestamo.values()) {
          metaNominal += monto;
        }
        for (const monto of primeraCuotaPorPrestamo.values()) {
          metaNominal += monto;
        }

        // target es metaNominal del día + lo que efectivamente se recaudó ese día
        const target = metaNominal + total;

        // Crear etiqueta más descriptiva: día de semana + fecha
        const dayName = daysOfWeek[currentDate.getDay()];
        const dayNumber = currentDate.getDate();
        const monthName = currentDate.toLocaleDateString('es-CO', { month: 'short' });
        const label = `${dayName} ${dayNumber}/${monthName}`;
        
        result.push({
          label,
          value: total,
          target,
        });
      }
    } else if (groupBy === 'week') {
      // Este modo no se usa actualmente (week agrupa en días), pero lo dejamos consistente.
      // Si en el futuro se activa, se debe definir meta semanal como suma de metas diarias.
      return [];
    } else if (groupBy === 'month') {
      // Agrupar por mes sumando valores diarios (value y target)
      const monthMapValue = new Map<string, number>();
      const monthMapTarget = new Map<string, number>();

      // Recorremos días dentro del rango para agregar de forma consistente (máx 366 días en year)
      const cursor = new Date(startDate);
      const { startDate: cStart } = getBogotaStartEndOfDay(cursor);
      cursor.setTime(cStart.getTime());

      while (cursor <= endDate) {
        const { startDate: dayStartBogota, endDate: dayEndBogota } = getBogotaStartEndOfDay(cursor);
        const dayKey = dayStartBogota.toISOString();
        const cutoffTime = dayEndBogota.getTime();
        const hoyBogotaKey = getBogotaDayKey(cursor);
        const monthKey = `${dayStartBogota.getFullYear()}-${String(dayStartBogota.getMonth() + 1).padStart(2, '0')}`;

        const pagos = pagosPorDiaKey.get(dayKey) || 0;
        const value = pagos;

        let metaNominal = 0;
        const acumuladoPorPrestamo = new Map<string, number>();
        const primeraCuotaPorPrestamo = new Map<string, number>();

        for (const c of cuotasNoPagadasHastaFin) {
          if (!c.prestamoId) continue;
          const vtoKey = getBogotaDayKey(new Date(c.fechaVencimiento));
          if (vtoKey > hoyBogotaKey) continue; 

          if (c.estado === EstadoCuota.PAGADA && c.fechaPago) {
            const pagoTime = new Date(c.fechaPago).getTime();
            if (pagoTime <= cutoffTime) continue;
          }

          const pid = String(c.prestamoId);
          const freq = String(c.prestamo?.frecuenciaPago || '').toUpperCase();
          const isDiario = freq === 'DIARIO' || freq === 'DIA';

          const montoFull = Number(c.monto || 0);
          const montoPagado = Number(c.montoPagado || 0);
          const montoPendiente = c.estado === EstadoCuota.PARCIAL ? Math.max(0, montoFull - montoPagado) : montoFull;

          if (montoPendiente <= 0) continue;

          if (isDiario) {
            acumuladoPorPrestamo.set(pid, (acumuladoPorPrestamo.get(pid) || 0) + montoPendiente);
          } else {
            if (!primeraCuotaPorPrestamo.has(pid)) {
              primeraCuotaPorPrestamo.set(pid, montoPendiente);
            }
          }
        }

        for (const monto of acumuladoPorPrestamo.values()) {
          metaNominal += monto;
        }
        for (const monto of primeraCuotaPorPrestamo.values()) {
          metaNominal += monto;
        }

        const target = metaNominal + value;

        monthMapValue.set(monthKey, (monthMapValue.get(monthKey) || 0) + value);
        monthMapTarget.set(monthKey, (monthMapTarget.get(monthKey) || 0) + target);

        cursor.setDate(cursor.getDate() + 1);
      }

      // Generar puntos de tendencia por mes dentro del rango
      const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const { startDate: currentStart } = getBogotaStartEndOfDay(current);
      current.setTime(currentStart.getTime());

      while (current <= endDate) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        const total = monthMapValue.get(key) || 0;
        const target = monthMapTarget.get(key) || 0;

        const monthName = current.toLocaleDateString('es-CO', {
          month: 'short',
        });
        const label = `${monthName} ${current.getFullYear()}`;

        result.push({
          label,
          value: total,
          target,
        });

        // Avanzar al siguiente mes
        current.setMonth(current.getMonth() + 1);
      }
    }

    return result;
  }

  private getSampleTrendData(): any[] {
    // Devolvemos array vacío para evitar datos ficticios en producción
    return [];
  }

  private getLedgerCobranzaWhere(startDate: Date, endDate: Date) {
    return {
      OR: [
        { accountCode: { startsWith: '1.1' } },
        { accountCode: { startsWith: '1.2' } },
      ],
      debitAmount: { gt: 0 },
      journalEntry: {
        isOpening: false,
        referenceType: 'PAGO',
        createdAt: { gte: startDate, lte: endDate },
      },
    };
  }

  private async getLedgerCobranzaTotal(startDate: Date, endDate: Date): Promise<number> {
    const res = await this.prisma.journalLine.aggregate({
      where: this.getLedgerCobranzaWhere(startDate, endDate),
      _sum: { debitAmount: true },
    });
    return Number(res._sum.debitAmount || 0);
  }

  private mapApproval(approval: any) {
    return {
      id: approval.id,
      type: this.mapApprovalType(approval.tipoAprobacion),
      description: this.getApprovalDescription(approval.tipoAprobacion),
      requestedBy: `${approval.solicitadoPor.nombres} ${approval.solicitadoPor.apellidos}`,
      time: new Date(approval.creadoEn).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      details: this.getApprovalDetails(approval),
      status: 'pending' as const,
      priority: this.determinePriority(approval.tipoAprobacion),
      amount: this.extractAmountFromApproval(approval),
    };
  }

  private mapApprovalType(tipo: TipoAprobacion): string {
    const map: Record<string, string> = {
      NUEVO_CLIENTE: 'cliente',
      NUEVO_PRESTAMO: 'credito',
      GASTO: 'gasto',
      SOLICITUD_BASE_EFECTIVO: 'base-dinero',
      PRORROGA_PAGO: 'prorroga',
    };
    return map[tipo] || 'cliente';
  }

  private getApprovalDescription(tipo: string): string {
    const map: Record<string, string> = {
      NUEVO_CLIENTE: 'Nuevo cliente',
      NUEVO_PRESTAMO: 'Solicitud de crédito',
      GASTO: 'Gasto operativo',
      SOLICITUD_BASE_EFECTIVO: 'Base de efectivo',
      PRORROGA_PAGO: 'Prórroga de cuota',
    };
    return map[tipo] || 'Aprobación pendiente';
  }

  private getApprovalDetails(approval: any): string {
    try {
      const data =
        typeof approval.datosSolicitud === 'string'
          ? JSON.parse(approval.datosSolicitud)
          : approval.datosSolicitud;

      switch (approval.tipoAprobacion) {
        case 'NUEVO_CLIENTE':
          return `${data.nombres || ''} ${data.apellidos || ''} - ${data.dni || 'Sin DNI'}`;
        case 'NUEVO_PRESTAMO':
          return `${data.producto || 'Producto no especificado'} - ${data.plazo || 0} meses`;
        case 'GASTO':
          return `${data.descripcion || 'Gasto sin descripción'}`;
        case 'SOLICITUD_BASE_EFECTIVO':
          return `Para cambio a clientes`;
        case 'PRORROGA_PAGO':
          return `Reprogramación hasta ${data.nuevaFecha || 'fecha no especificada'}`;
        default:
          return 'Detalles no disponibles';
      }
    } catch (error) {
      return 'Error al obtener detalles';
    }
  }

  private determinePriority(tipo: string): 'high' | 'medium' | 'low' {
    const highPriority = ['NUEVO_PRESTAMO', 'SOLICITUD_BASE_EFECTIVO'];
    const mediumPriority = ['NUEVO_CLIENTE', 'PRORROGA_PAGO'];

    if (highPriority.includes(tipo)) return 'high';
    if (mediumPriority.includes(tipo)) return 'medium';
    return 'low';
  }

  private extractAmountFromApproval(approval: any): number | undefined {
    try {
      const data =
        typeof approval.datosSolicitud === 'string'
          ? JSON.parse(approval.datosSolicitud)
          : approval.datosSolicitud;

      if (data.monto) return parseFloat(data.monto);
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  private mapDelinquentAccount(loan: any, hoyInicioBogota: Date) {
    const cuotaVencida = loan.cuotas[0];
    const eff = cuotaVencida
      ? (cuotaVencida?.fechaVencimientoProrroga
          ? new Date(cuotaVencida.fechaVencimientoProrroga)
          : new Date(cuotaVencida.fechaVencimiento))
      : null;

    const daysLate = eff && !isNaN(eff.getTime())
      ? Math.max(0, differenceInDays(hoyInicioBogota, eff))
      : 0;

    const asignacion = loan.cliente.asignacionesRuta?.[0];
    const collectorName = asignacion?.cobrador 
      ? `${asignacion.cobrador.nombres} ${asignacion.cobrador.apellidos}`
      : 'No asignado';
    const routeName = asignacion?.ruta?.nombre || 'General';

    return {
      id: loan.id,
      client: `${loan.cliente.nombres} ${loan.cliente.apellidos}`,
      daysLate,
      amountDue: parseFloat(loan.saldoPendiente.toString()),
      collector: collectorName,
      route: routeName,
      status: this.determineDelinquentStatus(daysLate),
    };
  }

  private determineDelinquentStatus(daysLate: number): string {
    if (daysLate > 15) return 'critical';
    if (daysLate > 8) return 'moderate';
    return 'mild';
  }

  private mapRecentActivity(approval: any) {
    return {
      id: approval.id,
      client: `${approval.solicitadoPor.nombres} ${approval.solicitadoPor.apellidos}`,
      action: this.getRecentActivityAction(
        approval.tipoAprobacion,
        approval.estado,
      ),
      amount: this.getRecentActivityAmount(approval),
      time: new Date(approval.actualizadoEn).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status:
        approval.estado === EstadoAprobacion.APROBADO ? 'approved' : 'alert',
    };
  }

  private getRecentActivityAction(
    tipo: TipoAprobacion,
    estado: EstadoAprobacion,
  ): string {
    const actionMap: Record<string, string> = {
      NUEVO_CLIENTE: 'Cliente aprobado',
      NUEVO_PRESTAMO: 'Crédito aprobado',
      GASTO: 'Gasto aprobado',
      SOLICITUD_BASE_EFECTIVO: 'Base de efectivo aprobada',
      PRORROGA_PAGO: 'Prórroga autorizada',
    };

    const baseAction = actionMap[tipo] || 'Aprobación procesada';
    return estado === EstadoAprobacion.APROBADO
      ? baseAction
      : `${baseAction} rechazada`;
  }

  private getRecentActivityAmount(approval: any): string {
    try {
      const data =
        typeof approval.datosSolicitud === 'string'
          ? JSON.parse(approval.datosSolicitud)
          : approval.datosSolicitud;

      if (data.monto) {
        return new Intl.NumberFormat('es-ES', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0,
        }).format(Number(data.monto));
      }
      return '-';
    } catch (error) {
      return '-';
    }
  }

  /**
   * Calcula el rango de fechas según el filtro de período (Sincronizado con Bogotá)
   */
  private calculateDateRangeFromFilter(timeFilter: string): { startDate: Date; endDate: Date } {
    const period = (['today', 'week', 'month', 'year'].includes(timeFilter) 
      ? timeFilter 
      : 'month') as BogotaPeriod;

    const { startDate, endDate } = calculateDateRange(period);
    return { startDate, endDate };
  }
}
