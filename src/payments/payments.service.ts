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
  TipoContenidoMultimedia,
  Prisma,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditService } from '../audit/audit.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { PagoConRelacionesExport } from '../common/types';
import { generarExcelPagos, generarPDFPagos, PagoRow, PagosTotales } from '../templates/exports/historial-pagos.template';
import { CloudinaryService } from '../upload/cloudinary.service';


@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private auditService: AuditService,
    private notificacionesGateway: NotificacionesGateway,
    private readonly cloudinaryService: CloudinaryService,
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

  async create(dto: CreatePaymentDto, comprobante?: Express.Multer.File) {
    // 1. Validar que se proporcione el prestamoId
    if (!dto.prestamoId) {
      throw new BadRequestException('El ID del préstamo es requerido');
    }

    // 2. Si el método es TRANSFERENCIA, el comprobante es OBLIGATORIO
    if (dto.metodoPago === MetodoPago.TRANSFERENCIA && !comprobante) {
      throw new BadRequestException(
        'Para pagos por transferencia debe adjuntar el comprobante (imagen o PDF)',
      );
    }

    // 3. Validar cobrador
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

    // ── Subir comprobante de transferencia a Cloudinary ─────────────────────
    // Si el pago es por transferencia y se adjuntó el comprobante, lo subimos
    // a Cloudinary y lo registramos en Multimedia vinculado al pago.
    if (comprobante && dto.metodoPago === MetodoPago.TRANSFERENCIA) {
      try {
        const cloudResult = await this.cloudinaryService.subirArchivo(comprobante, {
          folder: `pagos/comprobantes/${resultado.pago.id}`,
        });

        await this.prisma.multimedia.create({
          data: {
            pagoId:              resultado.pago.id,
            tipoContenido:       TipoContenidoMultimedia.COMPROBANTE_TRANSFERENCIA,
            tipoArchivo:         comprobante.mimetype,
            formato:             cloudResult.formato,
            nombreOriginal:      comprobante.originalname,
            nombreAlmacenamiento: cloudResult.publicId,
            ruta:                cloudResult.publicId,
            url:                 cloudResult.url,
            tamanoBytes:         cloudResult.tamanoBytes,
            esPublico:           false,
            esPrincipal:         true,
            subidoPorId:         dto.cobradorId!,
          },
        });

        this.logger.log(
          `Comprobante de transferencia guardado para pago ${numeroPago}: ${cloudResult.url}`,
        );
      } catch (err) {
        // No dejamos que un fallo del comprobante revierta el pago ya guardado.
        // Lo registramos en el log para que el coordinador pueda solicitarlo manualmente.
        this.logger.error(
          `Pago ${numeroPago} creado, pero falló la subida del comprobante: ${(err as Error).message}`,
        );
      }
    }

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
        tieneComprobante: comprobante != null,
      },
    });

    this.logger.log(
      `Pago ${numeroPago} registrado: capital=${capitalTotal.toFixed(2)}, interés=${interesTotal.toFixed(2)}, saldo=${resultado.descomposicion.saldoNuevo.toFixed(2)}`,
    );

    this.notificacionesGateway.broadcastPagosActualizados({
      accion: 'CREAR',
      pagoId: resultado.pago.id,
    });
    this.notificacionesGateway.broadcastPrestamosActualizados({
      accion: 'PAGO',
      prestamoId: prestamoIdVal,
    });
    this.notificacionesGateway.broadcastRutasActualizadas({
      accion: 'PAGO',
    });
    this.notificacionesGateway.broadcastDashboardsActualizados({});

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

    const where: Prisma.PagoWhereInput = {};
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
    // 1. Solo consulta de BD
    const where: Prisma.PagoWhereInput = {};
    if (filters.startDate || filters.endDate) {
      where.fechaPago = {};
      if (filters.startDate) (where.fechaPago as any).gte = new Date(filters.startDate);
      if (filters.endDate) (where.fechaPago as any).lte = new Date(filters.endDate);
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

    // 2. Mapeo al tipo del template
    const filas: PagoRow[] = pagos.map((p: PagoConRelacionesExport) => ({
      fecha: p.fechaPago,
      numeroPago: p.numeroPago || '',
      cliente: p.cliente ? `${p.cliente.nombres} ${p.cliente.apellidos}` : '',
      documento: p.cliente?.dni || '',
      numeroPrestamo: p.prestamo?.numeroPrestamo || '',
      montoTotal: Number(p.montoTotal),
      metodoPago: p.metodoPago || '',
      cobrador: p.cobrador ? `${p.cobrador.nombres} ${p.cobrador.apellidos}` : '',
    }));

    const totales: PagosTotales = {
      totalRecaudado: filas.reduce((s, p) => s + p.montoTotal, 0),
      totalPagos: filas.length,
    };

    // 3. Delegamos al template
    if (format === 'excel') return generarExcelPagos(filas, totales, fecha);
    if (format === 'pdf') return generarPDFPagos(filas, totales, fecha);

    throw new BadRequestException(`Formato no soportado: ${format}`);
  }
}

