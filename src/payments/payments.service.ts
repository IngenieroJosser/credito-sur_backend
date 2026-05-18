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
  TipoAprobacion,
  EstadoAprobacion,
  Prisma,
  RolUsuario,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditService } from '../audit/audit.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { PagoConRelacionesExport } from '../common/types';
import { generarExcelPagos, generarPDFPagos, PagoRow, PagosTotales } from '../templates/exports/historial-pagos.template';
import { CloudinaryService } from '../upload/cloudinary.service';
import { formatBogotaOffsetIso, getBogotaDayKey } from '../utils/date-utils';
import { LedgerService } from '../accounting/ledger.service';
import { randomUUID } from 'crypto';

type PaymentActor = {
  id?: string;
  rol?: RolUsuario | string;
} | null | undefined;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  private isCollector(actor: PaymentActor) {
    return String(actor?.rol || '').toUpperCase() === RolUsuario.COBRADOR;
  }

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
    private readonly ledgerService: LedgerService,
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

  private generarNumeroPago() {
    return `PAG-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private generarNumeroTransaccion(prefix = 'TRX') {
    return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private normalizeIdempotencyKey(value?: string | null) {
    const key = value?.toString().trim();
    return key || undefined;
  }

  private buildIdempotentPaymentReplay(pago: any) {
    const montoTotal = Number(pago?.montoTotal || 0);
    const capitalRecuperado = (pago?.detalles || []).reduce(
      (sum: number, detalle: any) => sum + Number(detalle?.montoCapital || 0),
      0,
    );
    const interesRecuperado = (pago?.detalles || []).reduce(
      (sum: number, detalle: any) => sum + Number(detalle?.montoInteres || 0),
      0,
    );
    const saldoNuevo = Number(pago?.prestamo?.saldoPendiente || 0);

    return {
      pago,
      descomposicion: {
        montoTotal,
        capitalRecuperado,
        interesRecuperado,
        saldoAnterior: saldoNuevo + montoTotal,
        saldoNuevo,
        cuotasAfectadas: pago?.detalles?.length || 0,
        prestamoQuedaPagado: saldoNuevo <= 0,
      },
      idempotentReplay: true,
    };
  }

  private async findPagoByIdempotencyKey(idempotencyKey?: string) {
    if (!idempotencyKey) return null;
    return this.prisma.pago.findFirst({
      where: { idempotencyKey },
      include: {
        detalles: true,
        cliente: {
          select: { id: true, nombres: true, apellidos: true },
        },
        prestamo: {
          select: { id: true, saldoPendiente: true },
        },
      },
    });
  }

  private calcularAplicacionPago(prestamo: any, montoTotal: number) {
    const detallesPago: {
      cuotaId: string;
      monto: number;
      montoCapital: number;
      montoInteres: number;
      montoInteresMora: number;
    }[] = [];

    let montoRestante = montoTotal;
    let capitalTotal = 0;
    let interesTotal = 0;
    let moraTotal = 0;

    const cuotasActualizar: {
      id: string;
      montoPagado: number;
      estado: EstadoCuota;
    }[] = [];

    for (const cuota of prestamo.cuotas || []) {
      if (montoRestante <= 0) break;

      const montoCuota = Number(cuota.monto);
      const yaPagado = Number(cuota.montoPagado);
      const pendienteCuota = montoCuota - yaPagado;

      if (pendienteCuota <= 0) continue;

      const cCapital = Number(cuota.montoCapital);
      const cInteres = Number(cuota.montoInteres);
      const cMora = Number(cuota.montoInteresMora);

      let tempYaPagado = yaPagado;

      const yaPagadoMora = Math.min(tempYaPagado, cMora);
      tempYaPagado -= yaPagadoMora;

      const yaPagadoInteres = Math.min(tempYaPagado, cInteres);
      tempYaPagado -= yaPagadoInteres;

      const yaPagadoCapital = Math.min(tempYaPagado, cCapital);

      const faltaMora = cMora - yaPagadoMora;
      const faltaInteres = cInteres - yaPagadoInteres;
      const faltaCapital = cCapital - yaPagadoCapital;

      const pagoAplicadoMora = Math.min(montoRestante, faltaMora);
      montoRestante -= pagoAplicadoMora;
      moraTotal += pagoAplicadoMora;

      const pagoAplicadoInteres = Math.min(montoRestante, faltaInteres);
      montoRestante -= pagoAplicadoInteres;
      interesTotal += pagoAplicadoInteres;

      const pagoAplicadoCapital = Math.min(montoRestante, faltaCapital);
      montoRestante -= pagoAplicadoCapital;
      capitalTotal += pagoAplicadoCapital;

      const totalAplicadoCuota =
        pagoAplicadoMora + pagoAplicadoInteres + pagoAplicadoCapital;

      if (totalAplicadoCuota > 0) {
        detallesPago.push({
          cuotaId: cuota.id,
          monto: totalAplicadoCuota,
          montoCapital: pagoAplicadoCapital,
          montoInteres: pagoAplicadoInteres,
          montoInteresMora: pagoAplicadoMora,
        });

        const nuevoMontoPagado = yaPagado + totalAplicadoCuota;
        const COP_TOLERANCE = 1;
        const cuotaCompleta = nuevoMontoPagado >= montoCuota - COP_TOLERANCE;
        const montoPagadoFinal = cuotaCompleta ? montoCuota : nuevoMontoPagado;

        const nuevoEstadoCuota = cuotaCompleta
          ? EstadoCuota.PAGADA
          : cuota.estado === EstadoCuota.PENDIENTE
            ? EstadoCuota.PARCIAL
            : cuota.estado;

        cuotasActualizar.push({
          id: cuota.id,
          montoPagado: montoPagadoFinal,
          estado: nuevoEstadoCuota,
        });
      }
    }

    return { detallesPago, cuotasActualizar, capitalTotal, interesTotal, moraTotal };
  }

  async create(dto: CreatePaymentDto, comprobante?: Express.Multer.File, actor?: PaymentActor) {
    const paymentDto = {
      ...dto,
      cobradorId: this.isCollector(actor) && actor?.id ? actor.id : dto.cobradorId,
    };
    const idempotencyKey = this.normalizeIdempotencyKey(paymentDto.idempotencyKey);

    const pagoExistente = await this.findPagoByIdempotencyKey(idempotencyKey);
    if (pagoExistente) {
      return this.buildIdempotentPaymentReplay(pagoExistente);
    }

    // 1. Validar que se proporcione el prestamoId
    if (!paymentDto.prestamoId) {
      throw new BadRequestException('El ID del préstamo es requerido');
    }

    // 2. Si el método es TRANSFERENCIA, el comprobante es OBLIGATORIO
    if (paymentDto.metodoPago === MetodoPago.TRANSFERENCIA && !comprobante) {
      throw new BadRequestException(
        'Para pagos por transferencia debe adjuntar el comprobante (imagen)',
      );
    }

    const prestamoIdVal = paymentDto.prestamoId;
    let cobradorIdVal = paymentDto.cobradorId;

    this.logger.log(
      `Registrando pago: préstamo=${prestamoIdVal}, monto=${paymentDto.montoTotal}`,
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
    const clienteId = paymentDto.clienteId || prestamo.clienteId;

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

    if (!this.isCollector(actor)) {
      const asignacionActiva = await this.prisma.asignacionRuta.findFirst({
        where: { clienteId: prestamo.clienteId, activa: true },
        select: {
          cobradorId: true,
          ruta: { select: { cobradorId: true } },
        },
      });
      cobradorIdVal =
        asignacionActiva?.cobradorId || asignacionActiva?.ruta?.cobradorId;
    }

    if (!cobradorIdVal) {
      throw new BadRequestException('El cobrador es requerido');
    }

    const montoTotal = Number(paymentDto.montoTotal);

    if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
      throw new BadRequestException('El monto del pago debe ser un número mayor a cero');
    }

    if (montoTotal > Number(prestamo.saldoPendiente) + 1) {
      throw new BadRequestException(
        `El monto del pago ($${montoTotal}) no puede ser mayor al saldo pendiente del préstamo ($${prestamo.saldoPendiente})`,
      );
    }

    const tasaInteres = Number(prestamo.tasaInteres);


    const numeroPago = this.generarNumeroPago();

    // Distribuir el pago entre cuotas pendientes (Siguiendo Prelación: Mora -> Interés -> Capital)
    const detallesPago: {
      cuotaId: string;
      monto: number;
      montoCapital: number;
      montoInteres: number;
      montoInteresMora: number;
    }[] = [];

    let montoRestante = montoTotal;
    
    let capitalTotal = 0;
    let interesTotal = 0;
    let moraTotal = 0;

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

      // 1. Calcular componentes de esta cuota
      const cCapital = Number(cuota.montoCapital);
      const cInteres = Number(cuota.montoInteres);
      const cMora    = Number(cuota.montoInteresMora);

      // 2. Determinar qué falta por pagar de la jerarquía
      let tempYaPagado = yaPagado;

      const yaPagadoMora = Math.min(tempYaPagado, cMora);
      tempYaPagado -= yaPagadoMora;
      
      const yaPagadoInteres = Math.min(tempYaPagado, cInteres);
      tempYaPagado -= yaPagadoInteres;

      const yaPagadoCapital = Math.min(tempYaPagado, cCapital);
      
      const faltaMora    = cMora - yaPagadoMora;
      const faltaInteres = cInteres - yaPagadoInteres;
      const faltaCapital = cCapital - yaPagadoCapital;

      // 3. Aplicar pago siguiendo la prelación
      let pagoAplicadoMora = 0;
      let pagoAplicadoInteres = 0;
      let pagoAplicadoCapital = 0;

      // 3a. Mora
      const aplicarMora = Math.min(montoRestante, faltaMora);
      pagoAplicadoMora = aplicarMora;
      montoRestante -= aplicarMora;
      moraTotal += aplicarMora;

      // 3b. Interés
      const aplicarInteres = Math.min(montoRestante, faltaInteres);
      pagoAplicadoInteres = aplicarInteres;
      montoRestante -= aplicarInteres;
      interesTotal += aplicarInteres;

      // 3c. Capital
      const aplicarCapital = Math.min(montoRestante, faltaCapital);
      pagoAplicadoCapital = aplicarCapital;
      montoRestante -= aplicarCapital;
      capitalTotal += aplicarCapital;

      const totalAplicadoCuota = pagoAplicadoMora + pagoAplicadoInteres + pagoAplicadoCapital;

      if (totalAplicadoCuota > 0) {
        detallesPago.push({
          cuotaId: cuota.id,
          monto: totalAplicadoCuota,
          montoCapital: pagoAplicadoCapital,
          montoInteres: pagoAplicadoInteres,
          montoInteresMora: pagoAplicadoMora,
        });

        const nuevoMontoPagado = yaPagado + totalAplicadoCuota;
        const COP_TOLERANCE = 1;
        const cuotaCompleta = nuevoMontoPagado >= (montoCuota - COP_TOLERANCE);
        const montoPagadoFinal = cuotaCompleta ? montoCuota : nuevoMontoPagado;

        const nuevoEstadoCuota = cuotaCompleta
          ? EstadoCuota.PAGADA
          : (cuota.estado === EstadoCuota.PENDIENTE ? EstadoCuota.PARCIAL : cuota.estado);

        cuotasActualizar.push({
          id: cuota.id,
          montoPagado: montoPagadoFinal,
          estado: nuevoEstadoCuota,
        });
      }
    }

    // Fix exactitud decimal para el Ledger
    const interesTotalFinal = Math.round(interesTotal * 100) / 100;
    const moraTotalFinal    = Math.round(moraTotal * 100) / 100;
    const capitalTotalFinal = Math.round((montoTotal - interesTotalFinal - moraTotalFinal) * 100) / 100;

    // Validar cobrador
    if (!cobradorIdVal) {
      throw new BadRequestException('El cobrador es requerido');
    }

    const rawFechaPago = (paymentDto.fechaPago || '').toString().trim();
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

    // Si es TRANSFERENCIA, se crea una aprobación pendiente. El pago NO afecta el crédito
    // hasta que sea aprobado en el módulo de Revisiones.
    if (paymentDto.metodoPago === MetodoPago.TRANSFERENCIA) {
      const aprobacionExistente = idempotencyKey
        ? await this.prisma.aprobacion.findFirst({
            where: { idempotencyKey },
            select: { id: true, estado: true },
          })
        : null;

      if (aprobacionExistente) {
        return {
          pendingVerification: true,
          aprobacionId: aprobacionExistente.id,
          idempotentReplay: true,
          message: 'Pago por transferencia ya estaba enviado a revisiones.',
        };
      }

      const approval = await this.prisma.aprobacion.create({
        data: {
          tipoAprobacion: 'PAGO_TRANSFERENCIA' as any,
          idempotencyKey,
          referenciaId: prestamoIdVal,
          tablaReferencia: 'prestamos',
          solicitadoPorId: cobradorIdVal,
          estado: EstadoAprobacion.PENDIENTE,
          montoSolicitud: montoTotal,
          datosSolicitud: {
            prestamoId: prestamoIdVal,
            clienteId: prestamo.clienteId,
            cobradorId: cobradorIdVal,
            montoTotal,
            fechaPago: formatBogotaOffsetIso(fechaPagoBogota),
            numeroReferencia: paymentDto.numeroReferencia || null,
            notas: paymentDto.notas || null,
            metodoPago: 'TRANSFERENCIA',
            idempotencyKey: idempotencyKey || null,
          },
        },
      });

      // Subir comprobante y asociarlo a la aprobación.
      try {
        const sanitize = (v?: string) =>
          (v || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .slice(0, 60);

        const dni = (prestamo.cliente.dni || '').replace(/\D/g, '');
        const dniLast4 = dni ? dni.slice(-4) : '';
        const nombres = sanitize(prestamo.cliente.nombres);
        const apellidos = sanitize(prestamo.cliente.apellidos);
        const clientLabel = [`cc-${dni}`, nombres, apellidos, dniLast4]
          .filter(Boolean)
          .join('-');

        const cloudResult = await this.cloudinaryService.subirArchivo(comprobante!, {
          folder: `clientes/${clientLabel}/comprobantes-transferencia`,
        });

        await this.prisma.multimedia.create({
          data: {
            prestamoId: prestamoIdVal,
            clienteId: prestamo.clienteId,
            entidad: 'APROBACION',
            tipoContenido: 'COMPROBANTE_TRANSFERENCIA' as any,
            tipoArchivo: comprobante!.mimetype,
            formato: cloudResult.formato,
            nombreOriginal: comprobante!.originalname,
            nombreAlmacenamiento: cloudResult.publicId,
            ruta: cloudResult.publicId,
            url: cloudResult.url,
            tamanoBytes: cloudResult.tamanoBytes,
            esPublico: false,
            esPrincipal: true,
            subidoPorId: cobradorIdVal,
          },
        });
      } catch (err) {
        this.logger.error(
          `Aprobación ${approval.id} creada, pero falló la subida del comprobante: ${(err as Error).message}`,
        );
      }

      // Notificar aprobadores para verificación
      await this.notificacionesService.notifyApprovers({
        titulo: `Pago por Transferencia — Requiere Verificación`,
        mensaje: `Se solicitó aprobación de pago por transferencia de ${montoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} para ${prestamo.cliente.nombres} ${prestamo.cliente.apellidos} (${prestamo.numeroPrestamo}).`,
        tipo: 'PAGO',
        entidad: 'APROBACION',
        entidadId: approval.id,
        metadata: {
          aprobacionId: approval.id,
          tipoAprobacion: 'PAGO_TRANSFERENCIA',
          prestamoId: prestamoIdVal,
          numeroPrestamo: prestamo.numeroPrestamo,
          cliente: `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
          clienteId: prestamo.clienteId,
          monto: montoTotal,
          metodoPago: 'TRANSFERENCIA',
          numeroReferencia: paymentDto.numeroReferencia || null,
          tieneComprobante: true,
          pagoPendiente: true,
        },
      });

      this.notificacionesGateway.broadcastDashboardsActualizados({});
      this.notificacionesGateway.broadcastAprobacionesActualizadas({
        accion: 'CREAR',
        aprobacionId: approval.id,
        tipoAprobacion: 'PAGO_TRANSFERENCIA' as any,
      });

      return {
        pendingVerification: true,
        aprobacionId: approval.id,
        message: 'Pago por transferencia enviado a revisiones para verificación.',
      };
    }

    // Crear pago y actualizar todo en una transacción (EFECTIVO)
    const resultado = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Prestamo" WHERE id = ${prestamoIdVal} FOR UPDATE`;

      const prestamoActual = await tx.prestamo.findFirst({
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

      if (!prestamoActual) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      if (
        prestamoActual.estado !== EstadoPrestamo.ACTIVO &&
        prestamoActual.estado !== EstadoPrestamo.EN_MORA
      ) {
        throw new BadRequestException(
          `No se puede registrar pago: el préstamo está en estado ${prestamoActual.estado}`,
        );
      }

      if (montoTotal > Number(prestamoActual.saldoPendiente) + 1) {
        throw new BadRequestException(
          `El monto del pago ($${montoTotal}) no puede ser mayor al saldo pendiente del préstamo ($${prestamoActual.saldoPendiente})`,
        );
      }

      const {
        detallesPago: detallesPagoActuales,
        cuotasActualizar: cuotasActualizarActuales,
        capitalTotal: capitalTotalActual,
        interesTotal: interesTotalActual,
        moraTotal: moraTotalActual,
      } = this.calcularAplicacionPago(prestamoActual, montoTotal);

      const interesTotalFinalActual = Math.round(interesTotalActual * 100) / 100;
      const moraTotalFinalActual = Math.round(moraTotalActual * 100) / 100;
      const capitalTotalFinalActual =
        Math.round((montoTotal - interesTotalFinalActual - moraTotalFinalActual) * 100) / 100;

      const asignacion = await tx.asignacionRuta.findFirst({
        where: this.isCollector(actor)
          ? {
              clienteId,
              activa: true,
              OR: [
                { cobradorId: cobradorIdVal },
                { ruta: { cobradorId: cobradorIdVal } },
              ],
            }
          : {
              clienteId,
              activa: true,
            },
        select: {
          rutaId: true,
          cobradorId: true,
          ruta: { select: { cobradorId: true } },
        },
      });
      if (!asignacion?.rutaId) {
        throw new BadRequestException(
          'El cliente no tiene una ruta asignada activa para registrar el pago',
        );
      }

      if (!this.isCollector(actor)) {
        cobradorIdVal = asignacion.ruta?.cobradorId || asignacion.cobradorId;
      }

      if (!cobradorIdVal) {
        throw new BadRequestException('El cobrador es requerido');
      }

      const cajaIngreso = await tx.caja.findFirst({
        where: { rutaId: asignacion.rutaId, tipo: 'RUTA', activa: true },
        select: { id: true, nombre: true, saldoActual: true },
      });

      if (!cajaIngreso?.id) {
        throw new BadRequestException(
          'No existe una caja de ruta activa asociada a la ruta del cliente',
        );
      }

      // 1. Crear el registro de pago
      const pago = await tx.pago.create({
        data: {
          numeroPago,
          idempotencyKey,
          clienteId: clienteId,
          prestamoId: prestamoIdVal,
          cobradorId: cobradorIdVal,
          fechaPago: fechaPagoBogota,
          montoTotal,
          metodoPago: paymentDto.metodoPago || MetodoPago.EFECTIVO,
          numeroReferencia: paymentDto.numeroReferencia,
          notas: paymentDto.notas,
          detalles: {
            create: detallesPagoActuales,
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
      for (const cuotaUpd of cuotasActualizarActuales) {
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
      const nuevoTotalPagado = Number(prestamoActual.totalPagado) + montoTotal;
      const nuevoCapitalPagado = Number(prestamoActual.capitalPagado) + capitalTotalActual;
      const nuevoInteresPagado = Number(prestamoActual.interesPagado) + interesTotalActual;
      const nuevoSaldoPendiente =
        Number(prestamoActual.saldoPendiente) - montoTotal;

      // Verificar si el préstamo queda pagado
      const prestamoQuedaPagado = nuevoSaldoPendiente <= 0;

      // Si el préstamo estaba EN_MORA y ya no quedan cuotas VENCIDAS, debe volver a ACTIVO inmediatamente.
      // Esto evita que un cliente que pagó cuota(s) atrasada(s) + la del día siga figurando en mora hasta el próximo job.
      let nuevoEstadoPrestamo: EstadoPrestamo = prestamoActual.estado;
      if (prestamoQuedaPagado) {
        nuevoEstadoPrestamo = EstadoPrestamo.PAGADO;
      } else if (prestamoActual.estado === EstadoPrestamo.EN_MORA) {
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

      const numeroTransaccionCaja = this.generarNumeroTransaccion('TRX-IN');

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

      // Asiento contable de Partida Doble
      // Débito: 1.2.1 Caja Ruta (+montoTotal) | Crédito: 1.3.1 Cartera + 3.1 Interés + 3.2 Mora
      // LedgerService actualiza saldoActual de la caja en la misma transacción (cajaDelta=+montoTotal)
      await this.ledgerService.registrarPago(
        {
          pagoId:       pago.id,
          cajaRutaId:   cajaIngreso.id,
          montoCapital: capitalTotalFinalActual,
          montoInteres: interesTotalFinalActual,
          montoMora:    moraTotalFinalActual,
          metodoPago:   pago.metodoPago,
          createdBy:    cobradorIdVal,
        },
        tx as any,
      );

      return {
        pago,
        descomposicion: {
          montoTotal,
          capitalRecuperado: capitalTotalActual,
          interesRecuperado: interesTotalActual,
          saldoAnterior: Number(prestamoActual.saldoPendiente),
          saldoNuevo: Math.max(0, nuevoSaldoPendiente),
          cuotasAfectadas: cuotasActualizarActuales.length,
          prestamoQuedaPagado,
        },
      };
    });

    // Auditoría
    await this.auditService.create({
      usuarioId: cobradorIdVal,
      accion: 'REGISTRAR_PAGO',
      entidad: 'Pago',
      entidadId: resultado.pago.id,
      datosNuevos: {
        numeroPago,
        prestamoIdVal,
        montoTotal,
        capitalRecuperado:
          Math.round(Number(resultado.descomposicion.capitalRecuperado || 0) * 100) / 100,
        interesRecuperado:
          Math.round(Number(resultado.descomposicion.interesRecuperado || 0) * 100) / 100,
        moraRecuperada:
          Math.round(
            Number(
              montoTotal -
                Number(resultado.descomposicion.capitalRecuperado || 0) -
                Number(resultado.descomposicion.interesRecuperado || 0),
            ) * 100,
          ) / 100,
      },
    });

    // Para EFECTIVO no se genera revisión.

    this.logger.log(
      `Pago ${numeroPago} registrado: capital=${Number(resultado.descomposicion.capitalRecuperado).toFixed(2)}, interés=${Number(resultado.descomposicion.interesRecuperado).toFixed(2)}, saldo=${resultado.descomposicion.saldoNuevo.toFixed(2)}`,
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
  }, actor?: PaymentActor) {
    const { prestamoId, clienteId, page = 1, limit = 20 } = filters || {};
    const skip = (page - 1) * limit;

    const where: Prisma.PagoWhereInput = {};
    if (prestamoId) where.prestamoId = prestamoId;
    if (clienteId) where.clienteId = clienteId;
    if (this.isCollector(actor) && actor?.id) where.cobradorId = actor.id;

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

  async findOne(id: string, actor?: PaymentActor) {
    const where: Prisma.PagoWhereInput = { id };
    if (this.isCollector(actor) && actor?.id) where.cobradorId = actor.id;

    const pago = await this.prisma.pago.findFirst({
      where,
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

  async reconcilePayment(pagoId: string): Promise<{
    pagoId: string;
    numeroPago: string;
    cuotasActualizadas: { cuotaId: string; numeroCuota: number; estadoAntes: string }[];
    cuotasOmitidas: { cuotaId: string; numeroCuota: number; razon: string }[];
    prestamoEstadoAntes: string;
    prestamoEstadoDespues: string;
  }> {
    const pago = await this.prisma.pago.findUnique({
      where: { id: pagoId },
      include: {
        detalles: true,
      },
    });

    if (!pago) {
      throw new NotFoundException(`Pago ${pagoId} no encontrado`);
    }

    if (!pago.detalles?.length) {
      throw new BadRequestException(
        `El pago ${pago.numeroPago} no tiene detalles de cuotas asociados`,
      );
    }

    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: pago.prestamoId },
      select: { id: true, estado: true },
    });

    if (!prestamo) {
      throw new NotFoundException(
        `Préstamo asociado al pago ${pago.numeroPago} no encontrado`,
      );
    }

    const cuotasActualizadas: {
      cuotaId: string;
      numeroCuota: number;
      estadoAntes: string;
    }[] = [];
    const cuotasOmitidas: { cuotaId: string; numeroCuota: number; razon: string }[] = [];
    const prestamoEstadoAntes = String(prestamo.estado);
    let prestamoEstadoDespues = prestamoEstadoAntes;

    const COP_TOLERANCE = 1;

    await this.prisma.$transaction(async (tx) => {
      for (const detalle of pago.detalles) {
        const cuota = await tx.cuota.findUnique({
          where: { id: detalle.cuotaId },
          select: {
            id: true,
            numeroCuota: true,
            monto: true,
            montoPagado: true,
            estado: true,
          },
        });

        if (!cuota) {
          cuotasOmitidas.push({
            cuotaId: detalle.cuotaId,
            numeroCuota: 0,
            razon: 'Cuota no encontrada en BD',
          });
          continue;
        }

        if (cuota.estado === EstadoCuota.PAGADA) {
          cuotasOmitidas.push({
            cuotaId: cuota.id,
            numeroCuota: Number(cuota.numeroCuota || 0),
            razon: 'Ya estaba PAGADA',
          });
          continue;
        }

        const montoCuota = Number(cuota.monto || 0);
        const montoPagadoActual = Number(cuota.montoPagado || 0);
        const montoDetalle = Number((detalle as any).monto || 0);
        const nuevoMontoPagado = montoPagadoActual + montoDetalle;
        const cuotaCompleta = nuevoMontoPagado >= (montoCuota - COP_TOLERANCE);

        if (!cuotaCompleta) {
          cuotasOmitidas.push({
            cuotaId: cuota.id,
            numeroCuota: Number(cuota.numeroCuota || 0),
            razon: `Pago insuficiente: ${nuevoMontoPagado.toFixed(2)} de ${montoCuota.toFixed(2)}`,
          });
          continue;
        }

        await tx.cuota.update({
          where: { id: cuota.id },
          data: {
            estado: EstadoCuota.PAGADA,
            montoPagado: montoCuota,
            fechaPago: pago.fechaPago,
          },
        });

        cuotasActualizadas.push({
          cuotaId: cuota.id,
          numeroCuota: Number(cuota.numeroCuota || 0),
          estadoAntes: String(cuota.estado),
        });
      }

      if (
        cuotasActualizadas.length > 0 &&
        prestamo.estado === EstadoPrestamo.EN_MORA
      ) {
        const vencidasRestantes = await tx.cuota.count({
          where: {
            prestamoId: prestamo.id,
            estado: EstadoCuota.VENCIDA,
          },
        });

        if (vencidasRestantes === 0) {
          await tx.prestamo.update({
            where: { id: prestamo.id },
            data: { estado: EstadoPrestamo.ACTIVO },
          });
          prestamoEstadoDespues = EstadoPrestamo.ACTIVO;
        }
      }
    });

    this.logger.log(
      `Reconciliación ${pago.numeroPago}: ${cuotasActualizadas.length} cuotas cerradas, ` +
        `${cuotasOmitidas.length} omitidas. Préstamo: ${prestamoEstadoAntes} → ${prestamoEstadoDespues}`,
    );

    return {
      pagoId: pago.id,
      numeroPago: pago.numeroPago,
      cuotasActualizadas,
      cuotasOmitidas,
      prestamoEstadoAntes,
      prestamoEstadoDespues,
    };
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

