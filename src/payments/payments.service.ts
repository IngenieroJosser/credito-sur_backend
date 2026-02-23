import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoPrestamo,
  EstadoCuota,
  MetodoPago,
    TipoTransaccion,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private auditService: AuditService,
  ) {}

  /**
   * Descomponer un pago en capital e interés usando la fórmula del Excel:
   *
   *   paramDivision = (100 / tasaInteres) + 1          → M2
   *   paramInverso  = 100 / tasaInteres                → M3
   *   capitalRecuperado = montoPagado / paramDivision * paramInverso
   *   interesRecuperado = montoPagado / paramDivision
   *
   * Simplificado:
   *   capitalRecuperado = montoPagado * 100 / (100 + tasaInteres)
   *   interesRecuperado = montoPagado * tasaInteres / (100 + tasaInteres)
   */
  private descomponerPago(
    montoPagado: number,
    tasaInteres: number,
  ): { capital: number; interes: number } {
    if (tasaInteres <= 0) {
      return { capital: montoPagado, interes: 0 };
    }
    const divisor = 100 + tasaInteres;
    const capital = (montoPagado * 100) / divisor;
    const interes = (montoPagado * tasaInteres) / divisor;
    return { capital, interes };
  }

  async create(dto: CreatePaymentDto) {
    // Validar que se proporcione el prestamoId
    if (!dto.prestamoId) {
      throw new BadRequestException('El ID del préstamo es requerido');
    }

    // Validar cobrador
    if (!dto.cobradorId) {
      throw new BadRequestException('El cobrador es requerido');
    }

    const prestamoIdVal = dto.prestamoId;
    const cobradorIdVal = dto.cobradorId;

    this.logger.log(
      `Registrando pago: préstamo=${prestamoIdVal}, monto=${dto.montoTotal}`,
    );

    // Obtener préstamo con cuotas pendientes
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoIdVal, eliminadoEn: null },
      include: {
        cuotas: {
          where: {
            estado: { in: [EstadoCuota.PENDIENTE, EstadoCuota.VENCIDA] },
          },
          orderBy: { numeroCuota: 'asc' },
        },
        cliente: {
          select: { id: true, nombres: true, apellidos: true },
        },
      },
    });

    if (!prestamo) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    // Usar el clienteId del préstamo si no se proporciona
    const clienteId = dto.clienteId || prestamo.clienteId;

    if (
      prestamo.estado !== EstadoPrestamo.ACTIVO &&
      prestamo.estado !== EstadoPrestamo.EN_MORA
    ) {
      throw new BadRequestException(
        `No se puede registrar pago: el préstamo está en estado ${prestamo.estado}`,
      );
    }

    if (clienteId && prestamo.clienteId !== clienteId) {
      throw new BadRequestException(
        'El cliente no corresponde al préstamo indicado',
      );
    }

    const montoTotal = dto.montoTotal;
    const tasaInteres = Number(prestamo.tasaInteres);

    // Descomponer el pago total en capital e interés (fórmula Excel)
    const { capital: capitalTotal, interes: interesTotal } =
      this.descomponerPago(montoTotal, tasaInteres);

    // Generar número de pago
    const count = await this.prisma.pago.count();
    const numeroPago = `PAG-${String(count + 1).padStart(6, '0')}`;

    // Distribuir el pago entre cuotas pendientes (orden cronológico)
    const detallesPago: {
      cuotaId: string;
      monto: number;
      montoCapital: number;
      montoInteres: number;
      montoInteresMora: number;
    }[] = [];

    let montoRestante = montoTotal;
    const cuotasActualizar: {
      id: string;
      montoPagado: number;
      estado: EstadoCuota;
    }[] = [];

    for (const cuota of prestamo.cuotas) {
      if (montoRestante <= 0) break;

      const montoCuota = Number(cuota.monto);
      const yaPagado = Number(cuota.montoPagado);
      const pendienteCuota = montoCuota - yaPagado;

      if (pendienteCuota <= 0) continue;

      const montoAplicar = Math.min(montoRestante, pendienteCuota);
      const { capital: capCuota, interes: intCuota } = this.descomponerPago(
        montoAplicar,
        tasaInteres,
      );

      detallesPago.push({
        cuotaId: cuota.id,
        monto: montoAplicar,
        montoCapital: capCuota,
        montoInteres: intCuota,
        montoInteresMora: 0,
      });

      const nuevoMontoPagado = yaPagado + montoAplicar;
      const cuotaCompleta = nuevoMontoPagado >= montoCuota;

      cuotasActualizar.push({
        id: cuota.id,
        montoPagado: nuevoMontoPagado,
        estado: cuotaCompleta ? EstadoCuota.PAGADA : cuota.estado,
      });

      montoRestante -= montoAplicar;
    }

    // Validar cobrador
    if (!dto.cobradorId) {
      throw new BadRequestException('El cobrador es requerido');
    }

    // Crear pago y actualizar todo en una transacción
    const resultado = await this.prisma.$transaction(async (tx) => {
      // 1. Crear el registro de pago
      const pago = await tx.pago.create({
        data: {
          numeroPago,
          clienteId: clienteId,
          prestamoId: prestamoIdVal,
          cobradorId: cobradorIdVal,
          fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : new Date(),
          montoTotal,
          metodoPago: dto.metodoPago || MetodoPago.EFECTIVO,
          numeroReferencia: dto.numeroReferencia,
          notas: dto.notas,
          detalles: {
            create: detallesPago,
          },
        },
        include: {
          detalles: true,
          cliente: {
            select: { id: true, nombres: true, apellidos: true },
          },
        },
      });

      // 2. Actualizar cada cuota afectada
      for (const cuotaUpd of cuotasActualizar) {
        await tx.cuota.update({
          where: { id: cuotaUpd.id },
          data: {
            montoPagado: cuotaUpd.montoPagado,
            estado: cuotaUpd.estado,
            fechaPago:
              cuotaUpd.estado === EstadoCuota.PAGADA ? new Date() : undefined,
          },
        });
      }

      // 3. Actualizar saldos del préstamo
      const nuevoTotalPagado = Number(prestamo.totalPagado) + montoTotal;
      const nuevoCapitalPagado = Number(prestamo.capitalPagado) + capitalTotal;
      const nuevoInteresPagado = Number(prestamo.interesPagado) + interesTotal;
      const nuevoSaldoPendiente =
        Number(prestamo.saldoPendiente) - montoTotal;

      // Verificar si el préstamo queda pagado
      const prestamoQuedaPagado = nuevoSaldoPendiente <= 0;

      await tx.prestamo.update({
        where: { id: prestamoIdVal },
        data: {
          totalPagado: nuevoTotalPagado,
          capitalPagado: nuevoCapitalPagado,
          interesPagado: nuevoInteresPagado,
          saldoPendiente: Math.max(0, nuevoSaldoPendiente),
          estado: prestamoQuedaPagado
            ? EstadoPrestamo.PAGADO
            : prestamo.estado,
          estadoSincronizacion: 'PENDIENTE',
        },
      });

      const asignacion = await tx.asignacionRuta.findFirst({
        where: { clienteId, activa: true },
        select: { rutaId: true },
      });
      if (!asignacion?.rutaId) {
        throw new BadRequestException(
          'El cliente no tiene una ruta asignada activa para registrar el pago',
        );
      }

      const cajaRuta = await tx.caja.findFirst({
        where: { rutaId: asignacion.rutaId, tipo: 'RUTA', activa: true },
        select: { id: true, nombre: true, saldoActual: true },
      });
      if (!cajaRuta?.id) {
        throw new BadRequestException(
          'No existe una caja de ruta activa asociada a la ruta del cliente',
        );
      }

      const numeroTransaccionCaja = `TRX-IN-${Date.now()}-${Math.floor(
        Math.random() * 1000,
      )}`;

      await tx.transaccion.create({
        data: {
          numeroTransaccion: numeroTransaccionCaja,
          cajaId: cajaRuta.id,
          tipo: TipoTransaccion.INGRESO,
          monto: montoTotal,
          descripcion: `Cobranza ${numeroPago}`,
          creadoPorId: cobradorIdVal,
          tipoReferencia: 'PAGO',
          referenciaId: numeroPago,
        },
      });

      await tx.caja.update({
        where: { id: cajaRuta.id },
        data: { saldoActual: { increment: montoTotal } },
      });

      return {
        pago,
        descomposicion: {
          montoTotal,
          capitalRecuperado: capitalTotal,
          interesRecuperado: interesTotal,
          saldoAnterior: Number(prestamo.saldoPendiente),
          saldoNuevo: Math.max(0, nuevoSaldoPendiente),
          cuotasAfectadas: cuotasActualizar.length,
          prestamoQuedaPagado,
        },
      };
    });

    // Auditoría
    await this.auditService.create({
      usuarioId: dto.cobradorId,
      accion: 'REGISTRAR_PAGO',
      entidad: 'Pago',
      entidadId: resultado.pago.id,
      datosNuevos: {
        numeroPago,
        prestamoIdVal,
        montoTotal,
        capitalRecuperado: capitalTotal,
        interesRecuperado: interesTotal,
      },
    });

    // Notificar
    await this.notificacionesService.notifyCoordinator({
      titulo: 'Pago Registrado',
      mensaje: `Se registró un pago de ${montoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} para ${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
      tipo: 'EXITO',
      entidad: 'PAGO',
      entidadId: resultado.pago.id,
      metadata: {
        prestamoIdVal,
        capitalRecuperado: capitalTotal,
        interesRecuperado: interesTotal,
      },
    });

    this.logger.log(
      `Pago ${numeroPago} registrado: capital=${capitalTotal.toFixed(2)}, interés=${interesTotal.toFixed(2)}, saldo=${resultado.descomposicion.saldoNuevo.toFixed(2)}`,
    );

    return resultado;
  }

  async findAll(filters?: {
    prestamoId?: string;
    clienteId?: string;
    page?: number;
    limit?: number;
  }) {
    const { prestamoId, clienteId, page = 1, limit = 20 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};
    if (prestamoId) where.prestamoId = prestamoId;
    if (clienteId) where.clienteId = clienteId;

    const [pagos, total] = await Promise.all([
      this.prisma.pago.findMany({
        where,
        include: {
          detalles: true,
          cliente: {
            select: { id: true, nombres: true, apellidos: true, dni: true },
          },
          prestamo: {
            select: {
              id: true,
              numeroPrestamo: true,
              monto: true,
              tasaInteres: true,
              saldoPendiente: true,
            },
          },
          cobrador: {
            select: { id: true, nombres: true, apellidos: true },
          },
        },
        skip,
        take: limit,
        orderBy: { fechaPago: 'desc' },
      }),
      this.prisma.pago.count({ where }),
    ]);

    return {
      pagos,
      paginacion: {
        total,
        pagina: page,
        limite: limit,
        totalPaginas: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const pago = await this.prisma.pago.findUnique({
      where: { id },
      include: {
        detalles: {
          include: {
            cuota: true,
          },
        },
        cliente: {
          select: { id: true, nombres: true, apellidos: true, dni: true },
        },
        prestamo: {
          select: {
            id: true,
            numeroPrestamo: true,
            monto: true,
            tasaInteres: true,
            saldoPendiente: true,
            interesTotal: true,
            totalPagado: true,
            capitalPagado: true,
            interesPagado: true,
          },
        },
        cobrador: {
          select: { id: true, nombres: true, apellidos: true },
        },
        recibo: true,
      },
    });

    if (!pago) {
      throw new NotFoundException('Pago no encontrado');
    }

    return pago;
  }

  async exportPayments(
    filters: { startDate?: string; endDate?: string; rutaId?: string },
    format: 'excel' | 'pdf',
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const ExcelJS = await import('exceljs');
    const PDFDocument = await import('pdfkit');

    const where: any = {};
    if (filters.startDate || filters.endDate) {
      where.fechaPago = {};
      if (filters.startDate) where.fechaPago.gte = new Date(filters.startDate);
      if (filters.endDate) where.fechaPago.lte = new Date(filters.endDate);
    }

    const pagos = await this.prisma.pago.findMany({
      where,
      include: {
        cliente: { select: { nombres: true, apellidos: true, dni: true } },
        prestamo: { select: { numeroPrestamo: true } },
        cobrador: { select: { nombres: true, apellidos: true } },
      },
      orderBy: { fechaPago: 'desc' },
      take: 10000,
    });

    const fecha = new Date().toISOString().split('T')[0];
    const totalRecaudado = pagos.reduce((s, p) => s + Number(p.montoTotal), 0);

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Historial de Pagos');
      ws.columns = [
        { header: 'Fecha', key: 'fecha', width: 18 },
        { header: 'N° Pago', key: 'numeroPago', width: 14 },
        { header: 'Cliente', key: 'cliente', width: 28 },
        { header: 'Documento', key: 'documento', width: 15 },
        { header: 'N° Préstamo', key: 'numeroPrestamo', width: 18 },
        { header: 'Monto', key: 'monto', width: 16 },
        { header: 'Capital', key: 'capital', width: 16 },
        { header: 'Interés', key: 'interes', width: 16 },
        { header: 'Método', key: 'metodo', width: 14 },
        { header: 'Cobrador', key: 'cobrador', width: 22 },
      ] as any;
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
      headerRow.alignment = { horizontal: 'center' };

      pagos.forEach((p: any) => {
        ws.addRow({
          fecha: p.fechaPago ? new Date(p.fechaPago).toLocaleDateString('es-CO') : '',
          numeroPago: p.numeroPago || '',
          cliente: p.cliente ? `${p.cliente.nombres} ${p.cliente.apellidos}` : '',
          documento: p.cliente?.dni || '',
          numeroPrestamo: p.prestamo?.numeroPrestamo || '',
          monto: Number(p.montoTotal),
          capital: Number(p.capitalRecuperado || 0),
          interes: Number(p.interesRecuperado || 0),
          metodo: p.metodoPago || '',
          cobrador: p.cobrador ? `${p.cobrador.nombres} ${p.cobrador.apellidos}` : '',
        });
      });
      ['monto', 'capital', 'interes'].forEach(k => { ws.getColumn(k).numFmt = '#,##0'; });
      ws.addRow({});
      const sr = ws.addRow({ fecha: 'TOTALES', monto: totalRecaudado, numeroPago: `${pagos.length} pagos` });
      sr.font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        data: Buffer.from(buffer as ArrayBuffer),
        contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        filename: `historial-pagos-${fecha}.xlsm`,
      };
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
      const buffers: any[] = [];
      doc.on('data', buffers.push.bind(buffers));

      doc.fontSize(16).font('Helvetica-Bold').text('Créditos del Sur — Historial de Pagos', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text(`Total Pagos: ${pagos.length}  |  Total Recaudado: $${totalRecaudado.toLocaleString('es-CO')}`, { align: 'center' });
      doc.moveDown(0.5);

      const cols = [
        { label: 'Fecha', width: 75 },
        { label: 'N° Pago', width: 65 },
        { label: 'Cliente', width: 120 },
        { label: 'N° Préstamo', width: 80 },
        { label: 'Monto', width: 80 },
        { label: 'Capital', width: 75 },
        { label: 'Interés', width: 70 },
        { label: 'Método', width: 65 },
        { label: 'Cobrador', width: 100 },
      ];
      const tableLeft = 30;
      let y = doc.y + 5;
      const rowH = 16;

      doc.fontSize(7).font('Helvetica-Bold');
      doc.rect(tableLeft, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#7C3AED');
      let x = tableLeft;
      cols.forEach(col => { doc.fillColor('white').text(col.label, x + 2, y + 4, { width: col.width - 4 }); x += col.width; });
      y += rowH;

      doc.font('Helvetica').fontSize(7).fillColor('black');
      pagos.forEach((p: any, i: number) => {
        if (y > 560) { doc.addPage(); y = 30; }
        if (i % 2 === 0) { doc.rect(tableLeft, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#F5F3FF'); doc.fillColor('black'); }
        x = tableLeft;
        const rowData = [
          p.fechaPago ? new Date(p.fechaPago).toLocaleDateString('es-CO') : '',
          p.numeroPago || '',
          p.cliente ? `${p.cliente.nombres} ${p.cliente.apellidos}`.substring(0, 22) : '',
          p.prestamo?.numeroPrestamo || '',
          `$${Number(p.montoTotal).toLocaleString('es-CO')}`,
          `$${Number(p.capitalRecuperado || 0).toLocaleString('es-CO')}`,
          `$${Number(p.interesRecuperado || 0).toLocaleString('es-CO')}`,
          p.metodoPago || '',
          p.cobrador ? `${p.cobrador.nombres} ${p.cobrador.apellidos}`.substring(0, 18) : '',
        ];
        rowData.forEach((val, ci) => { doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4 }); x += cols[ci].width; });
        y += rowH;
      });

      doc.end();
      const buffer = await new Promise<Buffer>((resolve) => { doc.on('end', () => resolve(Buffer.concat(buffers))); });
      return { data: buffer, contentType: 'application/pdf', filename: `historial-pagos-${fecha}.pdf` };
    }
    throw new Error(`Formato no soportado: ${format}`);
  }
}
