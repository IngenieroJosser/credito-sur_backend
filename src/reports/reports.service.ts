import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import { EstadoAprobacion } from '@prisma/client';
import {
  PrestamosMoraFiltrosDto,
  TotalesMoraDto,
  PrestamoMoraDto,
} from './dto/prestamo-mora.dto';
import { PrestamosMoraResponseDto } from './dto/responses.dto';
import { differenceInDays, format } from 'date-fns';
import {
  TotalesVencidasDto,
  DecisionCastigoDto,
  CuentasVencidasFiltrosDto,
  CuentaVencidaDto,
} from './dto/cuentas-vencidas.dto';
import { CuentasVencidasResponseDto } from './dto/responses-cuentas-vencidas.dto';
import { TipoAprobacion, EstadoPrestamo } from '@prisma/client';
import { GetOperationalReportDto } from './dto/get-operational-report.dto';
import {
  OperationalReportResponse,
  RoutePerformanceDetail,
} from './dto/responses-routes.dto';
import { TimeFilterPeriod, calculateDateRange } from '../utils/date-utils';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinancialSummary(startDate: Date, endDate: Date) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const ingresosResult = await this.prisma.pago.aggregate({
      _sum: { montoTotal: true },
      where: {
        fechaPago: {
          gte: startDate,
          lte: end,
        },
      },
    });

    const egresosResult = await this.prisma.gasto.aggregate({
      _sum: { monto: true },
      where: {
        fechaGasto: {
          gte: startDate,
          lte: end,
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
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const gastos = await this.prisma.gasto.groupBy({
      by: ['tipoGasto'],
      _sum: { monto: true },
      where: {
        fechaGasto: { gte: startDate, lte: end },
        estadoAprobacion: EstadoAprobacion.APROBADO,
      },
    });

    return gastos.map((g) => ({
      categoria: g.tipoGasto,
      monto: Number(g._sum.monto || 0),
    }));
  }

  async getFinancialTargets() {
    const envValue =
      process.env.REPORTS_META_MARGEN ||
      process.env.META_MARGEN ||
      process.env.NEXT_PUBLIC_META_MARGEN;
    if (
      typeof envValue === 'undefined' ||
      envValue === null ||
      envValue === ''
    ) {
      return { metaMargen: null };
    }
    const parsed = parseFloat(envValue);
    const metaMargen = Number.isFinite(parsed) ? parsed : null;
    return { metaMargen };
  }

  async obtenerPrestamosEnMora(
    filtros: PrestamosMoraFiltrosDto,
    pagina: number = 1,
    limite: number = 50,
  ): Promise<PrestamosMoraResponseDto> {
    const skip = (pagina - 1) * limite;

    const whereConditions: any = {
      estado: 'EN_MORA',
      cuotas: {
        some: {
          estado: 'VENCIDA',
        },
      },
    };

    // Aplicar filtros
    if (filtros.busqueda) {
      whereConditions.OR = [
        {
          cliente: {
            nombres: {
              contains: filtros.busqueda,
              mode: 'insensitive',
            },
          },
        },
        {
          cliente: {
            apellidos: {
              contains: filtros.busqueda,
              mode: 'insensitive',
            },
          },
        },
        {
          cliente: {
            dni: {
              contains: filtros.busqueda,
              mode: 'insensitive',
            },
          },
        },
        {
          numeroPrestamo: {
            contains: filtros.busqueda,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (filtros.nivelRiesgo) {
      whereConditions.cliente = {
        ...whereConditions.cliente,
        nivelRiesgo: filtros.nivelRiesgo,
      };
    }

    if (filtros.rutaId) {
      const clientesRuta = await this.prisma.asignacionRuta.findMany({
        where: {
          rutaId: filtros.rutaId,
          activa: true,
        },
        select: { clienteId: true },
      });

      const clienteIds = clientesRuta.map((cr) => cr.clienteId);
      whereConditions.clienteId = { in: clienteIds };
    }

    if (filtros.cobradorId) {
      const rutasCobrador = await this.prisma.ruta.findMany({
        where: {
          cobradorId: filtros.cobradorId,
          activa: true,
        },
        select: { id: true },
      });

      const rutaIds = rutasCobrador.map((rc) => rc.id);
      const clientesRuta = await this.prisma.asignacionRuta.findMany({
        where: {
          rutaId: { in: rutaIds },
          activa: true,
        },
        select: { clienteId: true },
      });

      const clienteIds = clientesRuta.map((cr) => cr.clienteId);
      whereConditions.clienteId = { in: clienteIds };
    }

    // Obtener total de registros
    const total = await this.prisma.prestamo.count({
      where: whereConditions,
    });

    // Obtener préstamos con relaciones
    const prestamos = await this.prisma.prestamo.findMany({
      where: whereConditions,
      skip,
      take: limite,
      include: {
        cliente: true,
        cuotas: {
          where: {
            estado: 'VENCIDA',
          },
          orderBy: {
            fechaVencimiento: 'asc',
          },
        },
        pagos: {
          orderBy: {
            fechaPago: 'desc',
          },
          take: 1,
        },
      },
      orderBy: [
        {
          cliente: {
            nivelRiesgo: 'desc',
          },
        },
        {
          saldoPendiente: 'desc',
        },
      ],
    });

    // Enriquecer datos con información de ruta y cobrador
    const prestamosEnriquecidos = await Promise.all(
      prestamos.map(async (prestamo) => {
        // Obtener asignación de ruta activa del cliente
        const asignacion = await this.prisma.asignacionRuta.findFirst({
          where: {
            clienteId: prestamo.clienteId,
            activa: true,
          },
          include: {
            ruta: {
              include: {
                cobrador: true,
              },
            },
          },
        });

        // Calcular días de mora (desde la primera cuota vencida)
        const primeraCuotaVencida = prestamo.cuotas[0];
        const diasMora = primeraCuotaVencida
          ? differenceInDays(new Date(), primeraCuotaVencida.fechaVencimiento)
          : 0;

        // Calcular monto de mora (suma de intereses de mora de cuotas vencidas)
        const montoMora = prestamo.cuotas.reduce(
          (sum, cuota) => sum + cuota.montoInteresMora.toNumber(),
          0,
        );

        // Obtener último pago
        const ultimoPago = prestamo.pagos[0];

        return {
          id: prestamo.id,
          numeroPrestamo: prestamo.numeroPrestamo,
          cliente: {
            nombre: `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
            documento: prestamo.cliente.dni,
            telefono: prestamo.cliente.telefono,
            direccion: prestamo.cliente.direccion || '',
          },
          diasMora,
          montoMora,
          montoTotalDeuda: prestamo.saldoPendiente.toNumber(),
          cuotasVencidas: prestamo.cuotas.length,
          ruta: asignacion?.ruta?.nombre || 'Sin asignar',
          cobrador: asignacion?.ruta?.cobrador
            ? `${asignacion.ruta.cobrador.nombres} ${asignacion.ruta.cobrador.apellidos}`
            : 'Sin asignar',
          nivelRiesgo: prestamo.cliente.nivelRiesgo,
          estado: prestamo.estado,
          ultimoPago: ultimoPago
            ? format(ultimoPago.fechaPago, 'yyyy-MM-dd')
            : undefined,
        } as PrestamoMoraDto;
      }),
    );

    // Calcular totales
    const totalMora = prestamosEnriquecidos.reduce(
      (sum, p) => sum + p.montoMora,
      0,
    );
    const totalDeuda = prestamosEnriquecidos.reduce(
      (sum, p) => sum + p.montoTotalDeuda,
      0,
    );
    const totalCasosCriticos = prestamosEnriquecidos.filter(
      (p) => p.nivelRiesgo === 'ROJO' || p.nivelRiesgo === 'LISTA_NEGRA',
    ).length;

    const totales: TotalesMoraDto = {
      totalMora,
      totalDeuda,
      totalCasosCriticos,
      totalRegistros: total,
    };

    return {
      prestamos: prestamosEnriquecidos,
      totales,
      total,
      pagina,
      limite,
    };
  }

  async generarReporteMora(
    filtros: PrestamosMoraFiltrosDto,
    formato: 'excel' | 'pdf',
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const data = await this.obtenerPrestamosEnMora(filtros, 1, 10000);
    const prestamos = data.prestamos;
    const fecha = new Date().toISOString().split('T')[0];

    if (formato === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Cuentas en Mora');

      ws.columns = [
        { header: 'N° Préstamo', key: 'numero', width: 18 },
        { header: 'Cliente', key: 'cliente', width: 28 },
        { header: 'Documento', key: 'documento', width: 15 },
        { header: 'Días Mora', key: 'diasMora', width: 12 },
        { header: 'Monto Mora', key: 'montoMora', width: 16 },
        { header: 'Deuda Total', key: 'deudaTotal', width: 16 },
        { header: 'Cuotas Vencidas', key: 'cuotasVencidas', width: 15 },
        { header: 'Ruta', key: 'ruta', width: 18 },
        { header: 'Cobrador', key: 'cobrador', width: 22 },
        { header: 'Nivel Riesgo', key: 'riesgo', width: 14 },
        { header: 'Último Pago', key: 'ultimoPago', width: 14 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
      headerRow.alignment = { horizontal: 'center' };

      prestamos.forEach((p: any) => {
        ws.addRow({
          numero: p.numeroPrestamo,
          cliente: p.cliente?.nombre || '',
          documento: p.cliente?.documento || '',
          diasMora: p.diasMora,
          montoMora: p.montoMora,
          deudaTotal: p.montoTotalDeuda,
          cuotasVencidas: p.cuotasVencidas,
          ruta: p.ruta,
          cobrador: p.cobrador,
          riesgo: p.nivelRiesgo,
          ultimoPago: p.ultimoPago || 'Sin pagos',
        });
      });

      ['montoMora', 'deudaTotal'].forEach(key => {
        ws.getColumn(key).numFmt = '#,##0';
      });

      ws.addRow({});
      const summaryRow = ws.addRow({
        numero: 'TOTALES',
        montoMora: data.totales.totalMora,
        deudaTotal: data.totales.totalDeuda,
        cuotasVencidas: data.totales.totalRegistros,
      });
      summaryRow.font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        data: Buffer.from(buffer as ArrayBuffer),
        contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        filename: `cuentas-mora-${fecha}.xlsm`,
      };
    } else if (formato === 'pdf') {
      const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
      const buffers: any[] = [];
      doc.on('data', buffers.push.bind(buffers));

      doc.fontSize(16).font('Helvetica-Bold').text('Créditos del Sur — Cuentas en Mora', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
      doc.moveDown(0.5);

      const totales = data.totales;
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text(`Total Registros: ${totales.totalRegistros}  |  Mora Acumulada: $${(totales.totalMora || 0).toLocaleString('es-CO')}  |  Deuda Total: $${(totales.totalDeuda || 0).toLocaleString('es-CO')}  |  Casos Críticos: ${totales.totalCasosCriticos}`, { align: 'center' });
      doc.moveDown(0.5);

      const cols = [
        { label: 'N° Préstamo', width: 80 },
        { label: 'Cliente', width: 120 },
        { label: 'Días Mora', width: 60 },
        { label: 'Monto Mora', width: 80 },
        { label: 'Deuda Total', width: 80 },
        { label: 'Cuotas Venc.', width: 60 },
        { label: 'Ruta', width: 80 },
        { label: 'Cobrador', width: 100 },
        { label: 'Riesgo', width: 60 },
      ];

      const tableLeft = 30;
      let y = doc.y + 5;
      const rowH = 16;

      doc.fontSize(7).font('Helvetica-Bold');
      doc.rect(tableLeft, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#DC2626');
      let x = tableLeft;
      cols.forEach(col => {
        doc.fillColor('white').text(col.label, x + 2, y + 4, { width: col.width - 4, align: 'left' });
        x += col.width;
      });
      y += rowH;

      doc.font('Helvetica').fontSize(7).fillColor('black');
      prestamos.forEach((p: any, i: number) => {
        if (y > 560) { doc.addPage(); y = 30; }
        if (i % 2 === 0) {
          doc.rect(tableLeft, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#FEF2F2');
          doc.fillColor('black');
        }
        x = tableLeft;
        const rowData = [
          p.numeroPrestamo || '',
          (p.cliente?.nombre || '').substring(0, 22),
          String(p.diasMora || 0),
          `$${(p.montoMora || 0).toLocaleString('es-CO')}`,
          `$${(p.montoTotalDeuda || 0).toLocaleString('es-CO')}`,
          String(p.cuotasVencidas || 0),
          (p.ruta || '').substring(0, 14),
          (p.cobrador || '').substring(0, 18),
          p.nivelRiesgo || '',
        ];
        rowData.forEach((val, ci) => {
          doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4, align: 'left' });
          x += cols[ci].width;
        });
        y += rowH;
      });

      doc.end();
      const buffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
      });

      return {
        data: buffer,
        contentType: 'application/pdf',
        filename: `cuentas-mora-${fecha}.pdf`,
      };
    }

    throw new Error(`Formato no soportado: ${formato}`);
  }

  async obtenerEstadisticasMora() {
    const [
      totalPrestamosMora,
      prestamosRojos,
      prestamosListaNegra,
      moraAcumulada,
      deudaTotal,
    ] = await Promise.all([
      this.prisma.prestamo.count({
        where: { estado: 'EN_MORA' },
      }),
      this.prisma.prestamo.count({
        where: {
          estado: 'EN_MORA',
          cliente: {
            nivelRiesgo: 'ROJO',
          },
        },
      }),
      this.prisma.prestamo.count({
        where: {
          estado: 'EN_MORA',
          cliente: {
            nivelRiesgo: 'LISTA_NEGRA',
          },
        },
      }),
      this.prisma.cuota.aggregate({
        where: {
          estado: 'VENCIDA',
          prestamo: {
            estado: 'EN_MORA',
          },
        },
        _sum: {
          montoInteresMora: true,
        },
      }),
      this.prisma.prestamo.aggregate({
        where: { estado: 'EN_MORA' },
        _sum: {
          saldoPendiente: true,
        },
      }),
    ]);

    return {
      totalPrestamosMora,
      casosCriticos: prestamosRojos + prestamosListaNegra,
      moraAcumulada: moraAcumulada._sum.montoInteresMora?.toNumber() || 0,
      deudaTotal: deudaTotal._sum.saldoPendiente?.toNumber() || 0,
    };
  }

  async obtenerCuentasVencidas(
    filtros: CuentasVencidasFiltrosDto,
    pagina: number = 1,
    limite: number = 50,
  ): Promise<CuentasVencidasResponseDto> {
    const skip = (pagina - 1) * limite;
    const hoy = new Date();

    const whereConditions: any = {
      fechaFin: { lt: hoy },
      estado: { in: ['EN_MORA', 'INCUMPLIDO', 'PERDIDA'] },
      saldoPendiente: { gt: 0 },
    };

    // Aplicar filtros
    if (filtros.busqueda) {
      whereConditions.OR = [
        {
          cliente: {
            nombres: {
              contains: filtros.busqueda,
              mode: 'insensitive',
            },
          },
        },
        {
          cliente: {
            apellidos: {
              contains: filtros.busqueda,
              mode: 'insensitive',
            },
          },
        },
        {
          cliente: {
            dni: {
              contains: filtros.busqueda,
              mode: 'insensitive',
            },
          },
        },
        {
          numeroPrestamo: {
            contains: filtros.busqueda,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (filtros.nivelRiesgo) {
      whereConditions.cliente = {
        ...whereConditions.cliente,
        nivelRiesgo: filtros.nivelRiesgo,
      };
    }

    if (filtros.rutaId) {
      const clientesRuta = await this.prisma.asignacionRuta.findMany({
        where: {
          rutaId: filtros.rutaId,
          activa: true,
        },
        select: { clienteId: true },
      });

      const clienteIds = clientesRuta.map((cr) => cr.clienteId);
      whereConditions.clienteId = { in: clienteIds };
    }

    // Obtener total de registros
    const total = await this.prisma.prestamo.count({
      where: whereConditions,
    });

    // Obtener préstamos con relaciones
    const prestamos = await this.prisma.prestamo.findMany({
      where: whereConditions,
      skip,
      take: limite,
      include: {
        cliente: true,
        cuotas: {
          where: {
            estado: 'VENCIDA',
          },
        },
      },
      orderBy: [
        {
          fechaFin: 'asc',
        },
        {
          saldoPendiente: 'desc',
        },
      ],
    });

    // Enriquecer datos con información de ruta y cobrador
    const cuentasVencidas = await Promise.all(
      prestamos.map(async (prestamo) => {
        // Obtener asignación de ruta activa del cliente
        const asignacion = await this.prisma.asignacionRuta.findFirst({
          where: {
            clienteId: prestamo.clienteId,
            activa: true,
          },
          include: {
            ruta: {
              include: {
                cobrador: true,
              },
            },
          },
        });

        // Calcular días vencidos (desde fechaFin)
        const diasVencidos = differenceInDays(hoy, prestamo.fechaFin);

        // Sumar cuotas vencidas para intereses de mora
        const interesesMora = prestamo.cuotas.reduce(
          (sum, cuota) => sum + cuota.montoInteresMora.toNumber(),
          0,
        );

        return {
          id: prestamo.id,
          numeroPrestamo: prestamo.numeroPrestamo,
          cliente: {
            nombre: `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
            documento: prestamo.cliente.dni,
            telefono: prestamo.cliente.telefono,
            direccion: prestamo.cliente.direccion || '',
          },
          fechaVencimiento: format(prestamo.fechaFin, 'yyyy-MM-dd'),
          diasVencidos,
          saldoPendiente: prestamo.saldoPendiente.toNumber(),
          montoOriginal: prestamo.monto.toNumber(),
          ruta: asignacion?.ruta?.nombre || 'Sin asignar',
          nivelRiesgo: prestamo.cliente.nivelRiesgo,
          estado: prestamo.estado,
          interesesMora,
        } as CuentaVencidaDto & { interesesMora: number };
      }),
    );

    // Calcular totales
    const totalVencido = cuentasVencidas.reduce(
      (sum, c) => sum + c.saldoPendiente,
      0,
    );
    const totalDiasVencidos = cuentasVencidas.reduce(
      (sum, c) => sum + c.diasVencidos,
      0,
    );
    const diasPromedioVencimiento =
      cuentasVencidas.length > 0
        ? Math.round(totalDiasVencidos / cuentasVencidas.length)
        : 0;

    const totales: TotalesVencidasDto = {
      totalVencido,
      totalRegistros: total,
      diasPromedioVencimiento,
    };

    return {
      cuentas: cuentasVencidas,
      totales,
      total,
      pagina,
      limite,
    };
  }

  async procesarDecisionCastigo(
    decisionDto: DecisionCastigoDto,
    usuarioId: string,
  ) {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: decisionDto.prestamoId },
      include: { cliente: true },
    });

    if (!prestamo) {
      throw new Error('Préstamo no encontrado');
    }

    // Crear registro de aprobación
    const aprobacion = await this.prisma.aprobacion.create({
      data: {
        tipoAprobacion: TipoAprobacion.BAJA_POR_PERDIDA,
        referenciaId: decisionDto.prestamoId,
        tablaReferencia: 'Prestamo',
        solicitadoPorId: usuarioId,
        datosSolicitud: {
          decision: decisionDto.decision,
          montoInteres: decisionDto.montoInteres || 0,
          comentarios: decisionDto.comentarios,
          nuevaFechaVencimiento: decisionDto.nuevaFechaVencimiento,
          prestamoId: decisionDto.prestamoId,
          clienteNombre: `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
          saldoPendiente: prestamo.saldoPendiente.toNumber(),
          fechaVencimientoOriginal: prestamo.fechaFin,
        },
        montoSolicitud: decisionDto.montoInteres || 0,
      },
    });

    // Actualizar estado del préstamo según la decisión
    let nuevoEstado: EstadoPrestamo = prestamo.estado;

    switch (decisionDto.decision) {
      case 'CASTIGAR':
        nuevoEstado = 'PERDIDA';
        break;
      case 'JURIDICO':
        nuevoEstado = 'INCUMPLIDO';
        break;
      case 'PRORROGAR':
        if (decisionDto.nuevaFechaVencimiento) {
          // Actualizar fecha de vencimiento del préstamo
          await this.prisma.prestamo.update({
            where: { id: decisionDto.prestamoId },
            data: {
              fechaFin: new Date(decisionDto.nuevaFechaVencimiento),
              estado: 'EN_MORA',
            },
          });
        }
        break;
    }

    if (decisionDto.decision !== 'PRORROGAR') {
      await this.prisma.prestamo.update({
        where: { id: decisionDto.prestamoId },
        data: { estado: nuevoEstado },
      });
    }

    // Si hay interés de mora, actualizar las cuotas
    if (decisionDto.montoInteres && decisionDto.montoInteres > 0) {
      const cuotasVencidas = await this.prisma.cuota.findMany({
        where: {
          prestamoId: decisionDto.prestamoId,
          estado: 'VENCIDA',
        },
      });

      // Distribuir el interés entre las cuotas vencidas
      const interesPorCuota = decisionDto.montoInteres / cuotasVencidas.length;

      for (const cuota of cuotasVencidas) {
        await this.prisma.cuota.update({
          where: { id: cuota.id },
          data: {
            montoInteresMora: { increment: interesPorCuota },
          },
        });
      }
    }

    return {
      mensaje: `Decisión de ${decisionDto.decision.toLowerCase()} procesada exitosamente`,
      aprobacionId: aprobacion.id,
      nuevoEstado,
    };
  }

  async exportarCuentasVencidas(
    formato: 'excel' | 'pdf',
    filtros: CuentasVencidasFiltrosDto,
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const data = await this.obtenerCuentasVencidas(filtros, 1, 10000);
    const cuentas = data.cuentas;
    const fecha = new Date().toISOString().split('T')[0];

    if (formato === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Cuentas Vencidas');

      ws.columns = [
        { header: 'N° Préstamo', key: 'numero', width: 18 },
        { header: 'Cliente', key: 'cliente', width: 28 },
        { header: 'Documento', key: 'documento', width: 15 },
        { header: 'Días Vencido', key: 'diasVencido', width: 14 },
        { header: 'Monto Vencido', key: 'montoVencido', width: 16 },
        { header: 'Saldo Pendiente', key: 'saldoPendiente', width: 16 },
        { header: 'Intereses Mora', key: 'interesesMora', width: 16 },
        { header: 'Nivel Riesgo', key: 'riesgo', width: 14 },
        { header: 'Ruta', key: 'ruta', width: 18 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
      headerRow.alignment = { horizontal: 'center' };

      cuentas.forEach((c: any) => {
        ws.addRow({
          numero: c.numeroPrestamo,
          cliente: c.cliente?.nombre || '',
          documento: c.cliente?.documento || '',
          diasVencido: c.diasVencido,
          montoVencido: c.montoVencido,
          saldoPendiente: c.saldoPendiente,
          interesesMora: c.interesesMora || 0,
          riesgo: c.nivelRiesgo,
          ruta: c.ruta || '',
        });
      });

      ['montoVencido', 'saldoPendiente', 'interesesMora'].forEach(key => {
        ws.getColumn(key).numFmt = '#,##0';
      });

      ws.addRow({});
      const summaryRow = ws.addRow({
        numero: 'TOTALES',
        montoVencido: data.totales.totalVencido,
        diasVencido: data.totales.diasPromedioVencimiento,
      });
      summaryRow.font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        data: Buffer.from(buffer as ArrayBuffer),
        contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        filename: `cuentas-vencidas-${fecha}.xlsm`,
      };
    } else if (formato === 'pdf') {
      const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
      const buffers: any[] = [];
      doc.on('data', buffers.push.bind(buffers));

      doc.fontSize(16).font('Helvetica-Bold').text('Créditos del Sur — Cuentas Vencidas', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
      doc.moveDown(0.5);

      const totales = data.totales;
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text(`Total Registros: ${totales.totalRegistros}  |  Total Vencido: $${(totales.totalVencido || 0).toLocaleString('es-CO')}  |  Días Promedio: ${totales.diasPromedioVencimiento}`, { align: 'center' });
      doc.moveDown(0.5);

      const cols = [
        { label: 'N° Préstamo', width: 85 },
        { label: 'Cliente', width: 130 },
        { label: 'Documento', width: 80 },
        { label: 'Días Venc.', width: 60 },
        { label: 'Monto Vencido', width: 85 },
        { label: 'Saldo Pend.', width: 85 },
        { label: 'Int. Mora', width: 75 },
        { label: 'Riesgo', width: 60 },
        { label: 'Ruta', width: 80 },
      ];

      const tableLeft = 30;
      let y = doc.y + 5;
      const rowH = 16;

      doc.fontSize(7).font('Helvetica-Bold');
      doc.rect(tableLeft, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#D97706');
      let x = tableLeft;
      cols.forEach(col => {
        doc.fillColor('white').text(col.label, x + 2, y + 4, { width: col.width - 4, align: 'left' });
        x += col.width;
      });
      y += rowH;

      doc.font('Helvetica').fontSize(7).fillColor('black');
      cuentas.forEach((c: any, i: number) => {
        if (y > 560) { doc.addPage(); y = 30; }
        if (i % 2 === 0) {
          doc.rect(tableLeft, y, cols.reduce((s, cc) => s + cc.width, 0), rowH).fill('#FFFBEB');
          doc.fillColor('black');
        }
        x = tableLeft;
        const rowData = [
          c.numeroPrestamo || '',
          (c.cliente?.nombre || '').substring(0, 24),
          c.cliente?.documento || '',
          String(c.diasVencido || 0),
          `$${(c.montoVencido || 0).toLocaleString('es-CO')}`,
          `$${(c.saldoPendiente || 0).toLocaleString('es-CO')}`,
          `$${(c.interesesMora || 0).toLocaleString('es-CO')}`,
          c.nivelRiesgo || '',
          (c.ruta || '').substring(0, 14),
        ];
        rowData.forEach((val, ci) => {
          doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4, align: 'left' });
          x += cols[ci].width;
        });
        y += rowH;
      });

      doc.end();
      const buffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
      });

      return {
        data: buffer,
        contentType: 'application/pdf',
        filename: `cuentas-vencidas-${fecha}.pdf`,
      };
    }

    throw new Error(`Formato no soportado: ${formato}`);
  }

  async getOperationalReport(
    filters: GetOperationalReportDto,
  ): Promise<OperationalReportResponse> {
    const { period, routeId, startDate, endDate } = filters;

    // Calcular rango de fechas según el periodo
    const dateRange = calculateDateRange(
      period as TimeFilterPeriod,
      startDate,
      endDate,
    );

    // Obtener rutas según filtro
    const routes = await this.prisma.ruta.findMany({
      where: {
        ...(routeId && { id: routeId }),
        activa: true,
      },
      include: {
        cobrador: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
        asignaciones: {
          include: {
            cliente: true,
          },
        },
      },
    });

    // Obtener métricas para cada ruta
    const routePerformancePromises = routes.map(async (route) => {
      const clientIds = route.asignaciones.map((a) => a.cliente.id);

      // Calcular recaudo total de la ruta en el periodo
      const payments = await this.prisma.pago.findMany({
        where: {
          clienteId: { in: clientIds },
          fechaPago: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
        select: {
          montoTotal: true,
        },
      });

      const collected = payments.reduce(
        (sum, p) => sum + Number(p.montoTotal),
        0,
      );

      // Calcular préstamos nuevos en el periodo
      const newLoans = await this.prisma.prestamo.count({
        where: {
          clienteId: { in: clientIds },
          creadoEn: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
          estado: 'ACTIVO',
        },
      });

      // Calcular nuevos clientes en el periodo
      const newClients = await this.prisma.cliente.count({
        where: {
          id: { in: clientIds },
          creadoEn: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
      });

      // Calcular meta de la ruta (basada en cuotas vencidas en el periodo)
      const duePayments = await this.prisma.cuota.findMany({
        where: {
          prestamo: {
            clienteId: { in: clientIds },
          },
          fechaVencimiento: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
          estado: { in: ['PENDIENTE', 'VENCIDA'] },
        },
        select: {
          monto: true,
        },
      });

      const target = duePayments.reduce((sum, c) => sum + Number(c.monto), 0);

      // Calcular eficiencia
      const efficiency =
        target > 0 ? Math.round((collected / target) * 100) : 0;

      return {
        id: route.id,
        ruta: route.nombre,
        cobrador: `${route.cobrador.nombres} ${route.cobrador.apellidos}`,
        cobradorId: route.cobrador.id,
        meta: target,
        recaudado: collected,
        eficiencia: efficiency,
        nuevosPrestamos: newLoans,
        nuevosClientes: newClients,
      } as RoutePerformanceDetail;
    });

    const routePerformance = await Promise.all(routePerformancePromises);

    // Calcular métricas globales
    const totalRecaudo = routePerformance.reduce(
      (sum, r) => sum + r.recaudado,
      0,
    );
    const totalMeta = routePerformance.reduce((sum, r) => sum + r.meta, 0);
    const porcentajeGlobal =
      totalMeta > 0 ? Math.round((totalRecaudo / totalMeta) * 100) : 0;
    const totalPrestamosNuevos = routePerformance.reduce(
      (sum, r) => sum + r.nuevosPrestamos,
      0,
    );
    const totalAfiliaciones = routePerformance.reduce(
      (sum, r) => sum + r.nuevosClientes,
      0,
    );

    // Calcular efectividad promedio
    const efectividadPromedio =
      routePerformance.length > 0
        ? Math.round(
            routePerformance.reduce((sum, r) => sum + r.eficiencia, 0) /
              routePerformance.length,
          )
        : 0;

    return {
      totalRecaudo,
      totalMeta,
      porcentajeGlobal,
      totalPrestamosNuevos,
      totalAfiliaciones,
      efectividadPromedio,
      rendimientoRutas: routePerformance,
      periodo: period,
      fechaInicio: dateRange.startDate,
      fechaFin: dateRange.endDate,
    };
  }

  async getRouteDetail(routeId: string, filters: any) {
    const route = await this.prisma.ruta.findUnique({
      where: { id: routeId },
      include: {
        cobrador: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            telefono: true,
          },
        },
        supervisor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    if (!route) {
      throw new NotFoundException(`Ruta con ID ${routeId} no encontrada`);
    }

    const dateRange = calculateDateRange(
      filters.period as TimeFilterPeriod,
      filters.startDate,
      filters.endDate,
    );

    // Obtener clientes asignados a la ruta
    const assignments = await this.prisma.asignacionRuta.findMany({
      where: {
        rutaId: routeId,
        activa: true,
      },
      include: {
        cliente: {
          include: {
            prestamos: {
              where: {
                estado: 'ACTIVO',
              },
              include: {
                cuotas: {
                  where: {
                    fechaVencimiento: {
                      gte: dateRange.startDate,
                      lte: dateRange.endDate,
                    },
                  },
                  orderBy: {
                    fechaVencimiento: 'asc',
                  },
                },
              },
            },
          },
        },
      },
    });

    // Obtener pagos de la ruta en el periodo
    const clientIds = assignments.map((a) => a.cliente.id);
    const payments = await this.prisma.pago.findMany({
      where: {
        clienteId: { in: clientIds },
        fechaPago: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      include: {
        cliente: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        detalles: {
          include: {
            cuota: true,
          },
        },
      },
      orderBy: {
        fechaPago: 'desc',
      },
    });

    // Calcular estadísticas detalladas
    const totalCollected = payments.reduce(
      (sum, p) => sum + Number(p.montoTotal),
      0,
    );
    const paymentCount = payments.length;

    // Agrupar pagos por día para gráfico
    const paymentsByDay = await this.prisma.$queryRaw`
      SELECT 
        DATE("fechaPago") as dia,
        COUNT(*) as cantidad,
        SUM("montoTotal") as total
      FROM "pagos"
      WHERE "clienteId" IN (${clientIds.join(',')})
        AND "fechaPago" >= ${dateRange.startDate}
        AND "fechaPago" <= ${dateRange.endDate}
      GROUP BY DATE("fechaPago")
      ORDER BY dia
    `;

    return {
      ruta: {
        id: route.id,
        nombre: route.nombre,
        codigo: route.codigo,
        zona: route.zona,
        cobrador: route.cobrador,
        supervisor: route.supervisor,
      },
      periodo: {
        tipo: filters.period,
        inicio: dateRange.startDate,
        fin: dateRange.endDate,
      },
      estadisticas: {
        totalClientes: assignments.length,
        totalRecaudado: totalCollected,
        totalPagos: paymentCount,
        promedioDiario: totalCollected / Math.max(1, dateRange.days),
        pagosPorDia: paymentsByDay,
      },
      pagosRecientes: payments.slice(0, 10).map((p) => ({
        id: p.id,
        numeroPago: p.numeroPago,
        cliente: `${p.cliente.nombres} ${p.cliente.apellidos}`,
        fecha: p.fechaPago,
        monto: p.montoTotal,
        metodo: p.metodoPago,
      })),
      clientesConPrestamos: assignments
        .filter((a) => a.cliente.prestamos.length > 0)
        .map((a) => ({
          id: a.cliente.id,
          nombre: `${a.cliente.nombres} ${a.cliente.apellidos}`,
          telefono: a.cliente.telefono,
          prestamosActivos: a.cliente.prestamos.length,
          proximaCuota: a.cliente.prestamos[0]?.cuotas[0] || null,
        })),
    };
  }

  async exportOperationalReport(
    filters: GetOperationalReportDto,
    format: 'excel' | 'pdf',
  ): Promise<any> {
    const reportData = await this.getOperationalReport(filters);

    if (format === 'excel') {
      // Crear workbook de Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reporte Operativo');

      // Definir columnas
      worksheet.columns = [
        { header: 'Ruta', key: 'ruta', width: 20 },
        { header: 'Cobrador', key: 'cobrador', width: 20 },
        { header: 'Meta', key: 'meta', width: 15 },
        { header: 'Recaudado', key: 'recaudado', width: 15 },
        { header: 'Eficiencia %', key: 'eficiencia', width: 15 },
        { header: 'Préstamos Nuevos', key: 'nuevosPrestamos', width: 15 },
        { header: 'Clientes Nuevos', key: 'nuevosClientes', width: 15 },
      ];

      // Agregar datos
      reportData.rendimientoRutas.forEach((ruta: any) => {
        worksheet.addRow({
          ruta: ruta.ruta,
          cobrador: ruta.cobrador,
          meta: ruta.meta,
          recaudado: ruta.recaudado,
          eficiencia: ruta.eficiencia,
          nuevosPrestamos: ruta.nuevosPrestamos,
          nuevosClientes: ruta.nuevosClientes,
        });
      });

      // Agregar fila de totales
      worksheet.addRow({});
      worksheet.addRow({
        ruta: 'TOTALES',
        meta: reportData.totalMeta,
        recaudado: reportData.totalRecaudo,
        eficiencia: reportData.porcentajeGlobal,
        nuevosPrestamos: reportData.totalPrestamosNuevos,
        nuevosClientes: reportData.totalAfiliaciones,
      });

      // Generar buffer
      const buffer = await workbook.xlsx.writeBuffer();

      return {
        data: buffer,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `reporte-operativo-${filters.period}-${new Date().toISOString().split('T')[0]}.xlsx`,
      };
    } else if (format === 'pdf') {
      // Crear documento PDF
      const doc = new PDFDocument();
      const buffers: any[] = [];

      doc.on('data', buffers.push.bind(buffers));

      // Contenido del PDF
      doc.fontSize(16).text('Reporte Operativo', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Período: ${filters.period}`);
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`);
      doc.moveDown();

      // Tabla de datos
      const tableTop = 150;
      const tableLeft = 50;
      const rowHeight = 30;
      const colWidth = 100;

      // Encabezados
      const headers = [
        'Ruta',
        'Cobrador',
        'Meta',
        'Recaudado',
        'Eficiencia',
        'Préstamos',
        'Clientes',
      ];
      headers.forEach((header, i) => {
        doc.text(header, tableLeft + i * colWidth, tableTop, {
          width: colWidth,
          align: 'center',
        });
      });

      // Datos
      reportData.rendimientoRutas.forEach((ruta: any, rowIndex: number) => {
        const y = tableTop + (rowIndex + 1) * rowHeight;
        doc.text(ruta.ruta, tableLeft, y, { width: colWidth });
        doc.text(ruta.cobrador, tableLeft + colWidth, y, { width: colWidth });
        doc.text(ruta.meta.toString(), tableLeft + 2 * colWidth, y, {
          width: colWidth,
          align: 'right',
        });
        doc.text(ruta.recaudado.toString(), tableLeft + 3 * colWidth, y, {
          width: colWidth,
          align: 'right',
        });
        doc.text(`${ruta.eficiencia}%`, tableLeft + 4 * colWidth, y, {
          width: colWidth,
          align: 'center',
        });
        doc.text(ruta.nuevosPrestamos.toString(), tableLeft + 5 * colWidth, y, {
          width: colWidth,
          align: 'center',
        });
        doc.text(ruta.nuevosClientes.toString(), tableLeft + 6 * colWidth, y, {
          width: colWidth,
          align: 'center',
        });
      });

      doc.end();

      // Esperar a que se complete la generación del PDF
      const buffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
      });

      return {
        data: buffer,
        contentType: 'application/pdf',
        filename: `reporte-operativo-${filters.period}-${new Date().toISOString().split('T')[0]}.pdf`,
      };
    }

    throw new Error(`Formato no soportado: ${format}`);
  }

  async exportFinancialReport(
    startDate: Date,
    endDate: Date,
    format: 'excel' | 'pdf',
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const [summary, monthly, expenses] = await Promise.all([
      this.getFinancialSummary(startDate, endDate),
      this.getMonthlyEvolution(startDate.getFullYear()),
      this.getExpenseDistribution(startDate, endDate),
    ]);
    const fecha = new Date().toISOString().split('T')[0];
    const totalGastos = expenses.reduce((s, e) => s + e.monto, 0);

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();

      // Hoja 1: Resumen
      const ws1 = workbook.addWorksheet('Resumen Financiero');
      ws1.columns = [
        { header: 'Concepto', key: 'concepto', width: 25 },
        { header: 'Monto', key: 'monto', width: 20 },
      ] as any;
      const h1 = ws1.getRow(1);
      h1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      h1.alignment = { horizontal: 'center' };
      ws1.addRow({ concepto: 'Ingresos', monto: summary.ingresos });
      ws1.addRow({ concepto: 'Egresos', monto: summary.egresos });
      ws1.addRow({ concepto: 'Utilidad', monto: summary.utilidad });
      ws1.addRow({ concepto: 'Margen (%)', monto: summary.margen });
      ws1.getColumn('monto').numFmt = '#,##0';

      // Hoja 2: Evolución Mensual
      const ws2 = workbook.addWorksheet('Evolución Mensual');
      ws2.columns = [
        { header: 'Mes', key: 'mes', width: 15 },
        { header: 'Ingresos', key: 'ingresos', width: 18 },
        { header: 'Egresos', key: 'egresos', width: 18 },
        { header: 'Utilidad', key: 'utilidad', width: 18 },
      ] as any;
      const h2 = ws2.getRow(1);
      h2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      h2.alignment = { horizontal: 'center' };
      monthly.forEach((m: any) => ws2.addRow(m));
      ['ingresos', 'egresos', 'utilidad'].forEach(k => { ws2.getColumn(k).numFmt = '#,##0'; });

      // Hoja 3: Distribución de Gastos
      const ws3 = workbook.addWorksheet('Distribución Gastos');
      ws3.columns = [
        { header: 'Categoría', key: 'categoria', width: 25 },
        { header: 'Monto', key: 'monto', width: 18 },
        { header: 'Porcentaje', key: 'porcentaje', width: 15 },
      ] as any;
      const h3 = ws3.getRow(1);
      h3.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      h3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      h3.alignment = { horizontal: 'center' };
      expenses.forEach((e: any) => {
        ws3.addRow({ categoria: e.categoria, monto: e.monto, porcentaje: totalGastos > 0 ? `${((e.monto / totalGastos) * 100).toFixed(1)}%` : '0%' });
      });
      ws3.getColumn('monto').numFmt = '#,##0';

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        data: Buffer.from(buffer as ArrayBuffer),
        contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        filename: `reporte-financiero-${fecha}.xlsm`,
      };
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ layout: 'portrait', size: 'LETTER', margin: 40 });
      const buffers: any[] = [];
      doc.on('data', buffers.push.bind(buffers));

      doc.fontSize(18).font('Helvetica-Bold').text('Créditos del Sur — Reporte Financiero', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
      doc.moveDown(1);

      // Resumen
      doc.fontSize(12).font('Helvetica-Bold').text('Resumen Financiero');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Ingresos:  $${summary.ingresos.toLocaleString('es-CO')}`);
      doc.text(`Egresos:   $${summary.egresos.toLocaleString('es-CO')}`);
      doc.text(`Utilidad:  $${summary.utilidad.toLocaleString('es-CO')}`);
      doc.text(`Margen:    ${summary.margen}%`);
      doc.moveDown(1);

      // Evolución Mensual
      doc.fontSize(12).font('Helvetica-Bold').text('Evolución Mensual');
      doc.moveDown(0.3);
      const mCols = [{ l: 'Mes', w: 80 }, { l: 'Ingresos', w: 120 }, { l: 'Egresos', w: 120 }, { l: 'Utilidad', w: 120 }];
      let y = doc.y + 5;
      doc.fontSize(8).font('Helvetica-Bold');
      doc.rect(40, y, mCols.reduce((s, c) => s + c.w, 0), 16).fill('#059669');
      let x = 40;
      mCols.forEach(c => { doc.fillColor('white').text(c.l, x + 2, y + 4, { width: c.w - 4 }); x += c.w; });
      y += 16;
      doc.font('Helvetica').fontSize(8).fillColor('black');
      monthly.forEach((m: any, i: number) => {
        if (i % 2 === 0) { doc.rect(40, y, mCols.reduce((s, c) => s + c.w, 0), 16).fill('#F0FDF4'); doc.fillColor('black'); }
        x = 40;
        [m.mes, `$${m.ingresos.toLocaleString('es-CO')}`, `$${m.egresos.toLocaleString('es-CO')}`, `$${m.utilidad.toLocaleString('es-CO')}`].forEach((v, ci) => {
          doc.text(v, x + 2, y + 4, { width: mCols[ci].w - 4 }); x += mCols[ci].w;
        });
        y += 16;
      });
      doc.moveDown(2);

      // Distribución de Gastos
      doc.y = y + 20;
      doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text('Distribución de Gastos');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica');
      expenses.forEach((e: any) => {
        const pct = totalGastos > 0 ? ((e.monto / totalGastos) * 100).toFixed(1) : '0';
        doc.text(`${e.categoria}: $${e.monto.toLocaleString('es-CO')} (${pct}%)`);
      });

      doc.end();
      const buffer = await new Promise<Buffer>((resolve) => { doc.on('end', () => resolve(Buffer.concat(buffers))); });
      return { data: buffer, contentType: 'application/pdf', filename: `reporte-financiero-${fecha}.pdf` };
    }
    throw new Error(`Formato no soportado: ${format}`);
  }
}
