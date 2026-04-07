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
  Prisma,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditService } from '../audit/audit.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { PagoConRelacionesExport } from '../common/types';
import { generarExcelPagos, generarPDFPagos, PagoRow, PagosTotales } from '../templates/exports/historial-pagos.template';
import { CloudinaryService } from '../upload/cloudinary.service';
import { formatBogotaOffsetIso, getBogotaDayKey } from '../utils/date-utils';


@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  private async ensureCajaBanco(tx: Prisma.TransactionClient) {
    const existing = await tx.caja.findUnique({
      where: { codigo: 'CAJA-BANCO' },
      select: { id: true, nombre: true, saldoActual: true },
    });
    if (existing?.id) return existing;

    const adminUser = await tx.usuario.findFirst({
      where: {
        rol: { in: ['SUPER_ADMINISTRADOR', 'ADMIN'] as any },
        estado: 'ACTIVO' as any,
        eliminadoEn: null,
      },
      orderBy: { creadoEn: 'asc' },
      select: { id: true },
    });
    if (!adminUser?.id) {
      throw new BadRequestException(
        'No existe un usuario ADMIN/SUPER_ADMIN activo para asignar la Caja Banco. Cree uno e intente nuevamente.',
      );
    }

    return tx.caja.create({
      data: {
        codigo: 'CAJA-BANCO',
        nombre: 'Caja Banco',
        tipo: 'PRINCIPAL' as any,
        responsableId: adminUser.id,
        saldoActual: 0,
        activa: true,
      },
      select: { id: true, nombre: true, saldoActual: true },
    });
  }

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
        'Para pagos por transferencia debe adjuntar el comprobante (imagen)',
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
    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id: prestamoIdVal, eliminadoEn: null },
      include: {
        cuotas: {
          where: {
            estado: { in: [EstadoCuota.PENDIENTE, EstadoCuota.PARCIAL, EstadoCuota.VENCIDA] },
          },
          orderBy: { numeroCuota: 'asc' },
        },
        cliente: {
          select: { id: true, dni: true, nombres: true, apellidos: true },
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

      // - Si la cuota era PENDIENTE y quedó incompleta, pasa a PARCIAL.
      // - Si ya era VENCIDA, se mantiene VENCIDA aunque reciba abonos.
      // Esto permite que los jobs de mora marquen PARCIAL → VENCIDA al pasar la fecha.
      const nuevoEstadoCuota = cuotaCompleta
        ? EstadoCuota.PAGADA
        : (cuota.estado === EstadoCuota.PENDIENTE ? EstadoCuota.PARCIAL : cuota.estado);

      cuotasActualizar.push({
        id: cuota.id,
        montoPagado: nuevoMontoPagado,
        estado: nuevoEstadoCuota,
      });

      montoRestante -= montoAplicar;
    }

    // Validar cobrador
    if (!dto.cobradorId) {
      throw new BadRequestException('El cobrador es requerido');
    }

    const rawFechaPago = (dto.fechaPago || '').toString().trim();
    const fechaPagoBogota = (() => {
      if (!rawFechaPago) return new Date(formatBogotaOffsetIso(new Date()));
      const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(rawFechaPago);
      if (hasTz) return new Date(rawFechaPago);
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawFechaPago)) {
        return new Date(`${rawFechaPago}T00:00:00.000-05:00`);
      }
      // ISO sin zona horaria (ej: 2026-04-06T23:44 o 2026-04-06T23:44:10.123)
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rawFechaPago)) {
        return new Date(`${rawFechaPago}-05:00`);
      }
      return new Date(rawFechaPago);
    })();

    // Crear pago y actualizar todo en una transacción
    const resultado = await this.prisma.$transaction(async (tx) => {
      // 1. Crear el registro de pago
      const pago = await tx.pago.create({
        data: {
          numeroPago,
          clienteId: clienteId,
          prestamoId: prestamoIdVal,
          cobradorId: cobradorIdVal,
          fechaPago: fechaPagoBogota,
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
              cuotaUpd.estado === EstadoCuota.PAGADA ? fechaPagoBogota : undefined,
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

      // Si el préstamo estaba EN_MORA y ya no quedan cuotas VENCIDAS, debe volver a ACTIVO inmediatamente.
      // Esto evita que un cliente que pagó cuota(s) atrasada(s) + la del día siga figurando en mora hasta el próximo job.
      let nuevoEstadoPrestamo: EstadoPrestamo = prestamo.estado;
      if (prestamoQuedaPagado) {
        nuevoEstadoPrestamo = EstadoPrestamo.PAGADO;
      } else if (prestamo.estado === EstadoPrestamo.EN_MORA) {
        const vencidasRestantes = await tx.cuota.count({
          where: {
            prestamoId: prestamoIdVal,
            estado: EstadoCuota.VENCIDA,
          },
        });
        if (vencidasRestantes === 0) {
          nuevoEstadoPrestamo = EstadoPrestamo.ACTIVO;
        }
      }

      await tx.prestamo.update({
        where: { id: prestamoIdVal },
        data: {
          totalPagado: nuevoTotalPagado,
          capitalPagado: nuevoCapitalPagado,
          interesPagado: nuevoInteresPagado,
          saldoPendiente: Math.max(0, nuevoSaldoPendiente),
          estado: nuevoEstadoPrestamo,
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

      const esTransferencia = dto.metodoPago === MetodoPago.TRANSFERENCIA;

      const cajaIngreso = esTransferencia
        ? await this.ensureCajaBanco(tx)
        : await tx.caja.findFirst({
            where: { rutaId: asignacion.rutaId, tipo: 'RUTA', activa: true },
            select: { id: true, nombre: true, saldoActual: true },
          });

      if (!cajaIngreso?.id) {
        throw new BadRequestException(
          esTransferencia
            ? 'No existe la Caja Banco (CAJA-BANCO) y no se pudo crear automáticamente.'
            : 'No existe una caja de ruta activa asociada a la ruta del cliente',
        );
      }

      const numeroTransaccionCaja = `TRX-IN-${Date.now()}-${Math.floor(
        Math.random() * 1000,
      )}`;

      await tx.transaccion.create({
        data: {
          numeroTransaccion: numeroTransaccionCaja,
          cajaId: cajaIngreso.id,
          tipo: TipoTransaccion.INGRESO,
          monto: montoTotal,
          descripcion: `Cobranza ${numeroPago}`,
          creadoPorId: cobradorIdVal,
          tipoReferencia: 'PAGO',
          referenciaId: numeroPago,
        },
      });

      await tx.caja.update({
        where: { id: cajaIngreso.id },
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
    // El comprobante queda dentro de la carpeta del cliente, igual que sus
    // otros documentos: clientes/cc-{dni}-{nombre}-{apellido}-{last4}/comprobantes
    if (comprobante && dto.metodoPago === MetodoPago.TRANSFERENCIA) {
      try {
        // Construir el label del cliente con el mismo patrón de upload.controller
        const sanitize = (v?: string) =>
          (v || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

        const dni       = (prestamo.cliente.dni || '').replace(/\D/g, '');
        const dniLast4  = dni ? dni.slice(-4) : '';
        const nombres   = sanitize(prestamo.cliente.nombres);
        const apellidos = sanitize(prestamo.cliente.apellidos);
        // Mismo formato que upload.controller: cc-{dni}-{nombres}-{apellidos}-{last4}
        const clientLabel = [`cc-${dni}`, nombres, apellidos, dniLast4].filter(Boolean).join('-');

        const cloudResult = await this.cloudinaryService.subirArchivo(comprobante, {
          folder: `clientes/${clientLabel}/comprobantes-transferencia`,
        });

        await this.prisma.multimedia.create({
          data: {
            pagoId:               resultado.pago.id,
            clienteId:            prestamo.clienteId,
            tipoContenido:        'COMPROBANTE_TRANSFERENCIA' as any,
            tipoArchivo:          comprobante.mimetype,
            formato:              cloudResult.formato,
            nombreOriginal:       comprobante.originalname,
            nombreAlmacenamiento: cloudResult.publicId,
            ruta:                 cloudResult.publicId,
            url:                  cloudResult.url,
            tamanoBytes:          cloudResult.tamanoBytes,
            esPublico:            false,
            esPrincipal:          true,
            subidoPorId:          dto.cobradorId!,
          },
        });

        this.logger.log(
          `Comprobante de transferencia guardado para pago ${numeroPago} → Cloudinary: ${cloudResult.url}`,
        );
      } catch (err) {
        // El pago ya está guardado en BD; el fallo del comprobante se registra
        // en el log para que el coordinador pueda solicitarlo manualmente.
        this.logger.error(
          `Pago ${numeroPago} creado, pero falló la subida del comprobante: ${(err as Error).message}`,
        );
      }
    }

    // Nota: Se omite la notificación de pago a todos los aprobadores
    // para evitar ruido en el panel. El pago se refleja en tiempo real
    // vía socket (broadcastPagosActualizados / broadcastPrestamosActualizados).
    // Solo se notifica cuando es una transferencia que requiere verificación.
    if (dto.metodoPago === 'TRANSFERENCIA') {
      const metodoPagoStr = 'Transferencia';
      await this.notificacionesService.notifyApprovers({
        titulo: `Pago por Transferencia — Requiere Verificación`,
        mensaje: `Se registró pago de ${montoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} para ${prestamo.cliente.nombres} ${prestamo.cliente.apellidos} (${prestamo.numeroPrestamo}) por ${metodoPagoStr}. Adjunto comprobante.`,
        tipo: 'PAGO',
        entidad: 'PAGO',
        entidadId: resultado.pago.id,
        metadata: {
          pagoId:           resultado.pago.id,
          numeroPrestamo:   prestamo.numeroPrestamo,
          prestamoId:       prestamoIdVal,
          metodoPago:       dto.metodoPago || 'EFECTIVO',
          numeroReferencia: dto.numeroReferencia || null,
          tieneComprobante: comprobante != null,
          cliente:          `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
          clienteId:        prestamo.clienteId,
          monto:            montoTotal,
        },
      });
    }

    this.logger.log(
      `Pago ${numeroPago} registrado: capital=${capitalTotal.toFixed(2)}, interés=${interesTotal.toFixed(2)}, saldo=${resultado.descomposicion.saldoNuevo.toFixed(2)}`,
    );

    this.notificacionesGateway.broadcastPagosActualizados({
      accion: 'CREAR',
      pagoId: resultado.pago.id,
      prestamoId: prestamo.id,
      clienteId: prestamo.clienteId,
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
        // Incluir archivos multimedia (comprobantes de transferencia, etc.)
        archivos: {
          where: { estado: 'ACTIVO', eliminadoEn: null },
          select: {
            id: true,
            tipoContenido: true,
            tipoArchivo: true,
            nombreOriginal: true,
            url: true,
            ruta: true,
            formato: true,
            tamanoBytes: true,
            creadoEn: true,
          },
          orderBy: { creadoEn: 'asc' },
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
    filters: { startDate?: string; endDate?: string; rutaId?: string; prestamoId?: string },
    format: 'excel' | 'pdf',
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    // 1. Solo consulta de BD
    const where: Prisma.PagoWhereInput = {};
    if (filters.prestamoId) {
      where.prestamoId = filters.prestamoId;
    }
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
        cobrador: { select: { nombres: true, apellidos: true, rol: true } },
      },
      orderBy: { fechaPago: 'desc' },
      take: 10000,
    });

    const fecha = getBogotaDayKey(new Date());

    // 2. Mapeo al tipo del template
    const filas: PagoRow[] = pagos.map((p: PagoConRelacionesExport) => ({
      fecha: p.fechaPago,
      numeroPago: p.numeroPago || '',
      cliente: p.cliente ? `${p.cliente.nombres} ${p.cliente.apellidos}` : '',
      documento: p.cliente?.dni || '',
      numeroPrestamo: p.prestamo?.numeroPrestamo || '',
      montoTotal: Number(p.montoTotal),
      metodoPago: p.metodoPago || '',
      cobrador: p.cobrador ? `${p.cobrador.nombres} ${p.cobrador.apellidos}` : 'Admin',
      esAbono: (p as any).esAbono ?? false,
      capitalPagado: Number((p as any).capitalPagado || 0),
      interesPagado: Number((p as any).interesPagado || 0),
      moraPagada: Number((p as any).moraPagada || 0),
      comentario: (p as any).notas || '',
      origenCaja: !p.cobrador ? 'Admin' : p.cobrador.rol === 'PUNTO_DE_VENTA' ? 'P.Venta' : 'Ruta',
    }));

    const totales: PagosTotales = {
      totalRecaudado: filas.reduce((s, p) => s + p.montoTotal, 0),
      totalPagos: filas.length,
      totalCapital: filas.reduce((s, p) => s + (p.capitalPagado || 0), 0),
      totalIntereses: filas.reduce((s, p) => s + (p.interesPagado || 0), 0),
      totalMora: filas.reduce((s, p) => s + (p.moraPagada || 0), 0),
      cantidadAbonos: filas.filter((p) => p.esAbono).length,
      cantidadCuotasCompletas: filas.filter((p) => !p.esAbono).length,
    };

    // 3. Delegamos al template
    if (format === 'excel') return generarExcelPagos(filas, totales, fecha);
    if (format === 'pdf') return generarPDFPagos(filas, totales, fecha);

    throw new BadRequestException(`Formato no soportado: ${format}`);
  }
}

