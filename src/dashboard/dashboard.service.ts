import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoAprobacion,
  EstadoCuota,
  EstadoPrestamo,
  TipoAprobacion,
} from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  async getDashboardData(timeFilter: string) {
    try {
      const { startDate, endDate } = this.calculateDateRangeFromFilter(timeFilter);

      // 1. Obtener métricas principales filtradas por período
      const pendingApprovals = await this.prisma.aprobacion.count({
        where: { 
          estado: EstadoAprobacion.PENDIENTE,
          creadoEn: { gte: startDate, lte: endDate },
        },
      });

      // Cuentas en mora: sin filtro de período porque la mora es un estado ACTUAL del préstamo,
      // no depende de cuándo se creó. Un préstamo creado hace 6 meses puede estar en mora hoy.
      const delinquentAccounts = await this.prisma.prestamo.count({
        where: { 
          estado: EstadoPrestamo.EN_MORA,
          eliminadoEn: null,
        },
      });

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

      // Cálculo de eficiencia (relación entre préstamos pagados vs totales) - filtrado por período
      const totalLoans = await this.prisma.prestamo.count({
        where: {
          estado: {
            in: [
              EstadoPrestamo.ACTIVO,
              EstadoPrestamo.PAGADO,
              EstadoPrestamo.EN_MORA,
            ],
          },
          creadoEn: { gte: startDate, lte: endDate },
        },
      });

      const paidLoans = await this.prisma.prestamo.count({
        where: { 
          estado: EstadoPrestamo.PAGADO,
          creadoEn: { gte: startDate, lte: endDate },
        },
      });

      const efficiency = totalLoans > 0 ? (paidLoans / totalLoans) * 100 : 0;

      // Calcular capital prestado del período (suma de montos de préstamos creados en el período)
      const capitalPrestado = await this.prisma.prestamo.aggregate({
        where: {
          creadoEn: { gte: startDate, lte: endDate },
          eliminadoEn: null,
        },
        _sum: {
          monto: true,
        },
      });

      // Recaudo del período: suma de cobros realizados (fechaPago = fecha real del cobro)
      const recaudo = await this.prisma.pago.aggregate({
        where: {
          fechaPago: { gte: startDate, lte: endDate },
        },
        _sum: {
          montoTotal: true,
        },
      });

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
      const delinquentAccountsList = await this.prisma.prestamo.findMany({
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
                cobrador: { select: { nombres: true, apellidos: true } }
              },
              take: 1
            }
          },
        },
        cuotas: {
          where: { estado: EstadoCuota.VENCIDA },
          orderBy: { fechaVencimiento: 'desc' },
          take: 1,
        },
      },
      take: 10,
    });

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
          const metaCobroRes = await this.prisma.cuota.aggregate({
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
          });

          const montoMeta = Number(metaCobroRes._sum.monto || 0);
          const collected = Number(item._sum.montoTotal || 0);
          
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
          recaudo: Number(recaudo._sum?.montoTotal || 0),
          totalPagos,
        },
        trend: trendData,
        pendingApprovals: pendingApprovalsList.map((item) =>
          this.mapApproval(item),
        ),
        delinquentAccounts: delinquentAccountsList.map((item) =>
          this.mapDelinquentAccount(item),
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
      const today = new Date();
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

      // Pagos del período agrupados por fechaPago (fecha real del cobro)
      const payments = await this.prisma.pago.groupBy({
        by: ['fechaPago'],
        where: {
          fechaPago: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          montoTotal: true,
        },
        orderBy: {
          fechaPago: 'asc',
        },
      });

      // Calcular metas dinámicamente basadas en promedio histórico de últimos 30 días
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const historicalPayments = await this.prisma.pago.aggregate({
        where: {
          fechaPago: {
            gte: thirtyDaysAgo,
            lte: today,
          },
        },
        _sum: {
          montoTotal: true,
        },
      });

      // Calcular promedio diario de los últimos 30 días
      const totalHistorical = Number(historicalPayments._sum?.montoTotal || 0);
      const dailyTarget = Math.round(totalHistorical / 30);
      const weeklyTarget = dailyTarget * 7;

      // Procesar y agrupar datos según el filtro
      const processedData = this.processTrendData(
        payments,
        startDate,
        endDate,
        groupBy,
        dailyTarget,
        weeklyTarget,
      );

      return processedData;
    } catch (error) {
      // En caso de error, devolver datos de muestra
      return [];
    }
  }

  private processTrendData(
    payments: any[],
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month',
    dailyTarget: number,
    weeklyTarget: number,
  ): any[] {
    const result: any[] = [];

    if (groupBy === 'day') {
      // Agrupar por día
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

      // Limitar a máximo 30 días para evitar sobrecarga, pero asegurar que incluya todos los días del período
      const maxDays = Math.min(daysDiff, 30);
      for (let i = 0; i <= maxDays; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        // No procesar días futuros
        if (currentDate > endDate) break;

        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const dayPayments = payments.filter((p) => {
          const paymentDate = new Date(p.fechaPago);
          return paymentDate >= dayStart && paymentDate <= dayEnd;
        });

        const total = dayPayments.reduce(
          (sum, p) => sum + parseFloat(p._sum.montoTotal?.toString() || '0'),
          0,
        );

        // Crear etiqueta más descriptiva: día de semana + fecha
        const dayName = daysOfWeek[currentDate.getDay()];
        const dayNumber = currentDate.getDate();
        const monthName = currentDate.toLocaleDateString('es-CO', { month: 'short' });
        const label = `${dayName} ${dayNumber}/${monthName}`;
        
        result.push({
          label,
          value: total,
          target: dailyTarget,
        });
      }
    } else if (groupBy === 'week') {
      // Agrupar por semana
      const weeksDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7),
      );
      const weekLabels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];

      for (let i = 0; i <= weeksDiff && i < 4; i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + i * 7);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekPayments = payments.filter((p) => {
          const paymentDate = new Date(p.fechaPago);
          return paymentDate >= weekStart && paymentDate <= weekEnd;
        });

        const total = weekPayments.reduce(
          (sum, p) => sum + parseFloat(p._sum.montoTotal?.toString() || '0'),
          0,
        );

        result.push({
          label: weekLabels[i],
          value: total,
          target: weeklyTarget,
        });
      }
    } else if (groupBy === 'month') {
      // Agrupar pagos por mes (YYYY-MM)
      const monthMap = new Map<string, number>();

      for (const payment of payments) {
        const date = new Date(payment.fechaPago);
        const key = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, '0')}`;
        const total = parseFloat(payment._sum.montoTotal?.toString() || '0');
        monthMap.set(key, (monthMap.get(key) || 0) + total);
      }

      // Generar puntos de tendencia por mes dentro del rango
      const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      current.setHours(0, 0, 0, 0);

      while (current <= endDate) {
        const key = `${current.getFullYear()}-${String(
          current.getMonth() + 1,
        ).padStart(2, '0')}`;
        const total = monthMap.get(key) || 0;

        const monthName = current.toLocaleDateString('es-CO', {
          month: 'short',
        });
        const label = `${monthName} ${current.getFullYear()}`;

        result.push({
          label,
          value: total,
          // Para rangos largos usamos la meta semanal como referencia aproximada
          target: weeklyTarget,
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

  private mapDelinquentAccount(loan: any) {
    const cuotaVencida = loan.cuotas[0];
    const daysLate = cuotaVencida
      ? Math.ceil(
          (Date.now() - new Date(cuotaVencida.fechaVencimiento).getTime()) /
            (1000 * 60 * 60 * 24),
        )
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
   * Calcula el rango de fechas según el filtro de período
   */
  private calculateDateRangeFromFilter(timeFilter: string): { startDate: Date; endDate: Date } {
    const today = new Date();
    let startDate: Date;
    let endDate: Date = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    switch (timeFilter) {
      case 'today':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(today);
        // Inicio de semana (domingo = 0)
        const day = today.getDay();
        // Calcular diferencia para llegar al domingo (día 0)
        const diff = day === 0 ? 0 : -day; // Si es domingo, diff = 0; si no, retrocedemos días
        startDate.setDate(today.getDate() + diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default:
        // Por defecto: mes actual
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return { startDate, endDate };
  }
}
