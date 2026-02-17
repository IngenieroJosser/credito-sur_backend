import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoAprobacion,
  EstadoCuota,
  EstadoPrestamo,
  TipoAprobacion,
} from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData(timeFilter: string) {
    try {
      // 1. Obtener métricas principales
      const pendingApprovals = await this.prisma.aprobacion.count({
        where: { estado: EstadoAprobacion.PENDIENTE },
      });

      const delinquentAccounts = await this.prisma.prestamo.count({
        where: { estado: EstadoPrestamo.EN_MORA },
      });

      // Base solicitada (suma de aprobaciones pendientes de tipo SOLICITUD_BASE_EFECTIVO)
      const _requestedBaseResult = await this.prisma.aprobacion.aggregate({
        where: {
          estado: EstadoAprobacion.PENDIENTE,
          tipoAprobacion: TipoAprobacion.SOLICITUD_BASE_EFECTIVO,
        },
        _sum: {
          montoSolicitud: true, // Esto necesita un manejo especial, veremos más abajo
        },
      });

      // Cálculo de eficiencia (relación entre préstamos pagados vs totales)
      const totalLoans = await this.prisma.prestamo.count({
        where: {
          estado: {
            in: [
              EstadoPrestamo.ACTIVO,
              EstadoPrestamo.PAGADO,
              EstadoPrestamo.EN_MORA,
            ],
          },
        },
      });

      const paidLoans = await this.prisma.prestamo.count({
        where: { estado: EstadoPrestamo.PAGADO },
      });

      const efficiency = totalLoans > 0 ? (paidLoans / totalLoans) * 100 : 0;

    // 2. Obtener aprobaciones pendientes
    const pendingApprovalsList = await this.prisma.aprobacion.findMany({
      where: { estado: EstadoAprobacion.PENDIENTE },
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

    // 3. Obtener cuentas en mora
    const delinquentAccountsList = await this.prisma.prestamo.findMany({
      where: { estado: EstadoPrestamo.EN_MORA },
      include: {
        cliente: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        cuotas: {
          where: { estado: EstadoCuota.VENCIDA },
          orderBy: { fechaVencimiento: 'desc' },
          take: 1,
        },
      },
      take: 5,
    });

    // 4. Obtener actividad reciente (últimas aprobaciones procesadas)
    const recentActivityList = await this.prisma.aprobacion.findMany({
      where: {
        estado: { in: [EstadoAprobacion.APROBADO, EstadoAprobacion.RECHAZADO] },
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

      return {
        metrics: {
          pendingApprovals,
          delinquentAccounts,
          requestedBase: this.calculateRequestedBase(pendingApprovalsList),
          efficiency: parseFloat(efficiency.toFixed(1)),
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
      };
    } catch (error) {
      // Retornar datos de fallback en caso de error
      return {
        metrics: {
          pendingApprovals: 0,
          delinquentAccounts: 0,
          requestedBase: 0,
          efficiency: 0,
        },
        trend: this.getSampleTrendData(),
        pendingApprovals: [],
        delinquentAccounts: [],
        recentActivity: [],
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
      const today = new Date();
      let startDate: Date;
      let groupBy: 'day' | 'week' | 'month' = 'day';

      // Determinar el rango de fechas según el filtro
      switch (timeFilter) {
        case 'today':
          startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          groupBy = 'day';
          break;
        case 'week':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 7);
          groupBy = 'day';
          break;
        case 'month':
          startDate = new Date(today);
          startDate.setMonth(today.getMonth() - 1);
          groupBy = 'day';
          break;
        case 'quarter':
          startDate = new Date(today);
          startDate.setMonth(today.getMonth() - 3);
          groupBy = 'week';
          break;
        default:
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 7);
          groupBy = 'day';
      }

      // Obtener datos de pagos reales
      const payments = await this.prisma.pago.groupBy({
        by: ['fechaPago'],
        where: {
          fechaPago: {
            gte: startDate,
            lte: today,
          },
          montoTotal: {
            gt: 0,
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

      console.log(`[DASHBOARD] Objetivo calculado dinámicamente:`);
      console.log(`  - Total últimos 30 días: ${totalHistorical}`);
      console.log(`  - Objetivo diario: ${dailyTarget}`);
      console.log(`  - Objetivo semanal: ${weeklyTarget}`);

      // Procesar y agrupar datos según el filtro
      const processedData = this.processTrendData(
        payments,
        startDate,
        today,
        groupBy,
        dailyTarget,
        weeklyTarget,
      );

      return processedData;
    } catch (error) {
      // En caso de error, devolver datos de muestra
      return this.getSampleTrendData();
    }
  }

  private processTrendData(
    payments: any[],
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week',
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

      for (let i = 0; i <= daysDiff && i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

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

        result.push({
          label: daysOfWeek[currentDate.getDay()],
          value: total,
          target: dailyTarget,
        });
      }
    } else {
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
    }

    return result;
  }

  private getSampleTrendData(): any[] {
    // Datos de muestra en caso de error
    return [
      { label: 'Lun', value: 2100000, target: 2500000 },
      { label: 'Mar', value: 2400000, target: 2500000 },
      { label: 'Mie', value: 1500000, target: 2500000 },
      { label: 'Jue', value: 2800000, target: 2500000 },
      { label: 'Vie', value: 2200000, target: 2500000 },
      { label: 'Sab', value: 3100000, target: 2500000 },
      { label: 'Dom', value: 900000, target: 1200000 },
    ];
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

    return {
      id: loan.id,
      client: `${loan.cliente.nombres} ${loan.cliente.apellidos}`,
      daysLate,
      amountDue: parseFloat(loan.saldoPendiente.toString()),
      collector: 'Por asignar', // Esto necesitaría una consulta adicional
      route: 'Por asignar', // Esto necesitaría una consulta adicional
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
}
