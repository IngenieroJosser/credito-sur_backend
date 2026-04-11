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

      // Recaudo del período: suma de cobros realizados (fechaPago = fecha real del cobro)
      const resRecaudo = await Promise.all([
        this.prisma.pago.aggregate({
          where: {
            fechaPago: { gte: startDate, lte: endDate },
          },
          _sum: {
            montoTotal: true,
          },
        }),
        // Incluir transacciones de tipo CUOTA_INICIAL que no están en la tabla Pago
        this.prisma.transaccion.aggregate({
          where: {
            tipoReferencia: 'CUOTA_INICIAL',
            tipo: TipoTransaccion.INGRESO,
            fechaTransaccion: { gte: startDate, lte: endDate },
          },
          _sum: { monto: true },
        }),
      ]);

      const recaudoTotal = Number(resRecaudo[0]._sum.montoTotal || 0) + Number(resRecaudo[1]._sum.monto || 0);

      // Eficiencia: misma lógica de efectividad de cobrador (recaudo / meta)
      // Meta = suma de cuotas con vencimiento en el período + CUOTA_INICIAL del período.
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

      const metaTotal = Number(metaCuotasRes._sum?.monto || 0) + Number(resRecaudo[1]._sum.monto || 0);
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

      // Cuentas en mora para el listado detallado: sin filtro de período
      const delinquentAccountsListRaw = await this.prisma.prestamo.findMany({
        where: {
          estado: EstadoPrestamo.EN_MORA,
          eliminadoEn: null,
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
            where: { estado: EstadoCuota.VENCIDA },
            orderBy: { fechaVencimiento: 'asc' },
            take: 20,
          },
        },
        take: 50,
      });

      const delinquentAccountsList = delinquentAccountsListRaw
        .map((loan: any) => {
          const cuotas = Array.isArray(loan?.cuotas) ? loan.cuotas : [];
          const cuotasVencidasReal = cuotas.filter((c: any) => {
            const eff = c?.fechaVencimientoProrroga
              ? new Date(c.fechaVencimientoProrroga)
              : new Date(c.fechaVencimiento);
            if (!eff || isNaN(eff.getTime())) return false;
            const key = utcDateKey(eff);
            return !!key && key < hoyKeyBogota;
          });
          if (cuotasVencidasReal.length === 0) return null;
          return { ...loan, cuotas: cuotasVencidasReal };
        })
        .filter(Boolean)
        .slice(0, 10);

      const delinquentAccounts = delinquentAccountsList.length;

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

    // Nota: el objetivo (target) debe ser una meta REAL del día.
    // Para mantener consistencia con RoutesService (metaDelDia), tomamos:
    // - Meta nominal: 1 cuota por préstamo (la más antigua en criterio) cuya fechaVencimiento <= inicio del día.
    // - + ingresos por CUOTA_INICIAL del mismo día.
    // Y en el recaudo (value) incluimos pagos + CUOTA_INICIAL del día.

    // 1) Pagos y cuotas iniciales dentro del rango
    const [payments, cuotaIniciales] = await Promise.all([
      this.prisma.pago.findMany({
        where: { fechaPago: { gte: startDate, lte: endDate } },
        select: { fechaPago: true, montoTotal: true },
      }),
      this.prisma.transaccion.findMany({
        where: {
          tipoReferencia: 'CUOTA_INICIAL',
          tipo: TipoTransaccion.INGRESO,
          fechaTransaccion: { gte: startDate, lte: endDate },
        },
        select: { fechaTransaccion: true, monto: true },
      }),
    ]);

    // Agrupar por día Bogotá (para sumar pagos y cuotas iniciales por día)
    const pagosPorDiaKey = new Map<string, number>();
    for (const p of payments) {
      const { startDate: dStart } = getBogotaStartEndOfDay(new Date(p.fechaPago));
      const key = dStart.toISOString();
      pagosPorDiaKey.set(key, (pagosPorDiaKey.get(key) || 0) + Number(p.montoTotal || 0));
    }

    const cuotaInicialPorDiaKey = new Map<string, number>();
    for (const t of cuotaIniciales) {
      const { startDate: dStart } = getBogotaStartEndOfDay(new Date(t.fechaTransaccion));
      const key = dStart.toISOString();
      cuotaInicialPorDiaKey.set(key, (cuotaInicialPorDiaKey.get(key) || 0) + Number(t.monto || 0));
    }

    // 2) Meta nominal diaria (target)
    // Regla consistente con RoutesService/daily-visits:
    // - Por préstamo, contar 1 cuota si:
    //   a) Existe una cuota NO pagada (pendiente/parcial/vencida/prorrogada) con fechaVencimiento <= inicio del día
    //      -> tomar la más antigua.
    //   b) Si NO existe deuda hasta ese día, contar una cuota PAGADA en ESE día (fechaPago en el día)
    //      -> tomar la más antigua por fechaVencimiento para determinismo.
    // - + ingresos por CUOTA_INICIAL del día.
    const { startDate: endDayStartUTC } = getBogotaStartEndOfDay(endDate);

    const [cuotasNoPagadasHastaFin, cuotasPagadasEnRango] = await Promise.all([
      this.prisma.cuota.findMany({
        where: {
          prestamo: {
            estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA, EstadoPrestamo.PAGADO] },
            eliminadoEn: null,
          },
          estado: {
            in: [
              EstadoCuota.PENDIENTE,
              EstadoCuota.PARCIAL,
              EstadoCuota.VENCIDA,
              EstadoCuota.PRORROGADA,
            ],
          },
          fechaVencimiento: { lte: endDayStartUTC },
        },
        select: { prestamoId: true, fechaVencimiento: true, monto: true },
        orderBy: [{ prestamoId: 'asc' }, { fechaVencimiento: 'asc' }],
      }),
      this.prisma.cuota.findMany({
        where: {
          prestamo: {
            estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA, EstadoPrestamo.PAGADO] },
            eliminadoEn: null,
          },
          estado: EstadoCuota.PAGADA,
          fechaPago: { gte: startDate, lte: endDate },
        },
        select: { prestamoId: true, fechaVencimiento: true, fechaPago: true, monto: true },
        orderBy: [{ prestamoId: 'asc' }, { fechaVencimiento: 'asc' }],
      }),
    ]);

    const firstUnpaidByPrestamo = new Map<string, { prestamoId: string; ts: number; monto: number }>();
    for (const c of cuotasNoPagadasHastaFin) {
      if (!c.prestamoId) continue;
      const pid = String(c.prestamoId);
      if (firstUnpaidByPrestamo.has(pid)) continue;
      firstUnpaidByPrestamo.set(pid, {
        prestamoId: pid,
        ts: new Date(c.fechaVencimiento).getTime(),
        monto: Number(c.monto || 0),
      });
    }

    const firstUnpaidSorted = Array.from(firstUnpaidByPrestamo.values())
      .filter((x) => x.monto > 0)
      .sort((a, b) => a.ts - b.ts);

    const pagadasPorDiaKey = new Map<string, Map<string, number>>();
    for (const c of cuotasPagadasEnRango) {
      if (!c.prestamoId || !c.fechaPago) continue;
      const pid = String(c.prestamoId);
      const { startDate: dStart } = getBogotaStartEndOfDay(new Date(c.fechaPago));
      const dayKey = dStart.toISOString();
      const dayMap = pagadasPorDiaKey.get(dayKey) || new Map<string, number>();
      if (!dayMap.has(pid)) {
        dayMap.set(pid, Number(c.monto || 0));
        pagadasPorDiaKey.set(dayKey, dayMap);
      }
    }

    if (groupBy === 'day') {
      // Agrupar por día
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

      // Limitar a máximo 30 días para evitar sobrecarga, pero asegurar que incluya todos los días del período
      const maxDays = Math.min(daysDiff, 30);
      let ptr = 0;
      let sumUnpaid = 0;
      const unpaidLoans = new Set<string>();

      for (let i = 0; i <= maxDays; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        // No procesar días futuros
        if (currentDate > endDate) break;

        const { startDate: dayStartBogota } = getBogotaStartEndOfDay(currentDate);
        const dayKey = dayStartBogota.toISOString();

        const pagos = pagosPorDiaKey.get(dayKey) || 0;
        const cuotaInicialDia = cuotaInicialPorDiaKey.get(dayKey) || 0;
        const total = pagos + cuotaInicialDia;

        const cutoff = dayStartBogota.getTime();
        while (ptr < firstUnpaidSorted.length && firstUnpaidSorted[ptr].ts <= cutoff) {
          const it = firstUnpaidSorted[ptr];
          if (!unpaidLoans.has(it.prestamoId)) {
            unpaidLoans.add(it.prestamoId);
            sumUnpaid += it.monto;
          }
          ptr++;
        }

        let sumPaidToday = 0;
        const paidToday = pagadasPorDiaKey.get(dayKey);
        if (paidToday) {
          for (const [pid, monto] of paidToday.entries()) {
            if (unpaidLoans.has(pid)) continue;
            sumPaidToday += Number(monto || 0);
          }
        }

        const target = sumUnpaid + sumPaidToday + cuotaInicialDia;

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

      // Acumulador incremental para meta nominal diaria a lo largo del año
      let ptrMonth = 0;
      let sumUnpaidMonth = 0;
      const unpaidLoansMonth = new Set<string>();

      // Recorremos días dentro del rango para agregar de forma consistente (máx 366 días en year)
      const cursor = new Date(startDate);
      const { startDate: cStart } = getBogotaStartEndOfDay(cursor);
      cursor.setTime(cStart.getTime());

      while (cursor <= endDate) {
        const { startDate: dayStartBogota } = getBogotaStartEndOfDay(cursor);
        const dayKey = dayStartBogota.toISOString();
        const monthKey = `${dayStartBogota.getFullYear()}-${String(dayStartBogota.getMonth() + 1).padStart(2, '0')}`;

        const pagos = pagosPorDiaKey.get(dayKey) || 0;
        const cuotaInicialDia = cuotaInicialPorDiaKey.get(dayKey) || 0;
        const value = pagos + cuotaInicialDia;

        const cutoff = dayStartBogota.getTime();
        while (ptrMonth < firstUnpaidSorted.length && firstUnpaidSorted[ptrMonth].ts <= cutoff) {
          const it = firstUnpaidSorted[ptrMonth];
          if (!unpaidLoansMonth.has(it.prestamoId)) {
            unpaidLoansMonth.add(it.prestamoId);
            sumUnpaidMonth += it.monto;
          }
          ptrMonth++;
        }

        let sumPaidToday = 0;
        const paidToday = pagadasPorDiaKey.get(dayKey);
        if (paidToday) {
          for (const [pid, monto] of paidToday.entries()) {
            if (unpaidLoansMonth.has(pid)) continue;
            sumPaidToday += Number(monto || 0);
          }
        }

        const target = sumUnpaidMonth + sumPaidToday + cuotaInicialDia;

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
