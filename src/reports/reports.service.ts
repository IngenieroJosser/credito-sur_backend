import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { EstadoAprobacion } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinancialSummary(startDate: Date, endDate: Date) {
    const ingresosResult = await this.prisma.pago.aggregate({
      _sum: { montoTotal: true },
      where: {
        fechaPago: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const egresosResult = await this.prisma.gasto.aggregate({
      _sum: { monto: true },
      where: {
        fechaGasto: {
          gte: startDate,
          lte: endDate,
        },
        estadoAprobacion: EstadoAprobacion.APROBADO,
      },
    });

    const ingresos = Number(ingresosResult._sum.montoTotal || 0);
    const egresos = Number(egresosResult._sum.monto || 0);
    const utilidad = ingresos - egresos;
    const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;

    return {
      ingresos,
      egresos,
      utilidad,
      margen: Number(margen.toFixed(2)),
    };
  }

  async getMonthlyEvolution(year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const pagos = await this.prisma.pago.findMany({
      where: {
        fechaPago: { gte: startOfYear, lte: endOfYear },
      },
      select: { fechaPago: true, montoTotal: true },
    });

    const gastos = await this.prisma.gasto.findMany({
      where: {
        fechaGasto: { gte: startOfYear, lte: endOfYear },
        estadoAprobacion: EstadoAprobacion.APROBADO,
      },
      select: { fechaGasto: true, monto: true },
    });

    const months = Array.from({ length: 12 }, (_, i) => ({
      mes: new Date(year, i).toLocaleString('es-ES', { month: 'short' }),
      ingresos: 0,
      egresos: 0,
      utilidad: 0,
    }));

    pagos.forEach((p) => {
      const month = p.fechaPago.getMonth();
      months[month].ingresos += Number(p.montoTotal);
    });

    gastos.forEach((g) => {
      const month = g.fechaGasto.getMonth();
      months[month].egresos += Number(g.monto);
    });

    months.forEach((m) => {
      m.utilidad = m.ingresos - m.egresos;
    });

    return months;
  }

  async getExpenseDistribution(startDate: Date, endDate: Date) {
    const gastos = await this.prisma.gasto.groupBy({
      by: ['tipoGasto'],
      _sum: { monto: true },
      where: {
        fechaGasto: { gte: startDate, lte: endDate },
        estadoAprobacion: EstadoAprobacion.APROBADO,
      },
    });

    return gastos.map((g) => ({
      categoria: g.tipoGasto,
      monto: Number(g._sum.monto || 0),
    }));
  }

  create(createReportDto: any) {
    return 'This action adds a new report';
  }

  findAll() {
    return `This action returns all reports`;
  }

  findOne(id: number) {
    return `This action returns a #${id} report`;
  }

  update(id: number, updateReportDto: any) {
    return `This action updates a #${id} report`;
  }

  remove(id: number) {
    return `This action removes a #${id} report`;
  }
}
