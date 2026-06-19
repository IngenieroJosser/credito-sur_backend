import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoAprobacion,
  EstadoPrestamo,
  EstadoCuota,
  TipoAprobacion,
  TipoTransaccion,
  MetodoPago,
  FrecuenciaPago,
  TipoAmortizacion,
  RolUsuario,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { formatBogotaOffsetIso } from '../utils/date-utils';
import { LedgerService } from '../accounting/ledger.service';
import { randomUUID } from 'crypto';
import { calcularAmortizacionFrancesa } from '../loans/utils/amortizacion.utils';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private notificacionesGateway: NotificacionesGateway,
    private readonly ledgerService: LedgerService,
  ) {}

  private async ensureCajaBanco(tx: any) {
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

  private async resolvePaymentCobradorForClient(
    db: any,
    clienteId: string,
    requestedCobradorId?: string,
  ) {
    const select = {
      cobradorId: true,
      ruta: { select: { cobradorId: true } },
    };

    const matchingAssignment = requestedCobradorId
      ? await db.asignacionRuta?.findFirst({
          where: {
            clienteId,
            activa: true,
            OR: [
              { cobradorId: requestedCobradorId },
              { ruta: { cobradorId: requestedCobradorId } },
            ],
          },
          select,
        })
      : null;

    const activeAssignment =
      matchingAssignment ||
      (await db.asignacionRuta?.findFirst({
        where: { clienteId, activa: true },
        select,
      }));

    return (
      activeAssignment?.ruta?.cobradorId ||
      activeAssignment?.cobradorId ||
      requestedCobradorId
    );
  }

  private async resolveActiveRouteCashContext(
    db: any,
    params: { rutaId?: string; cajaId?: string },
  ) {
    let rutaId = params.rutaId || '';

    if (!rutaId && params.cajaId) {
      const caja = await db.caja.findUnique?.({
        where: { id: params.cajaId },
        select: { rutaId: true },
      });
      rutaId = caja?.rutaId || '';
    }

    if (!rutaId) {
      throw new BadRequestException('La solicitud no tiene una ruta válida');
    }

    const ruta = await db.ruta.findFirst({
      where: { id: rutaId, eliminadoEn: null },
      select: { id: true, cobradorId: true },
    });

    if (!ruta?.id) {
      throw new NotFoundException('Ruta no encontrada');
    }
    if (!ruta.cobradorId) {
      throw new BadRequestException('La ruta no tiene cobrador asignado');
    }

    const cajaRuta = await db.caja.findFirst({
      where: { rutaId: ruta.id, tipo: 'RUTA' as any, activa: true },
      select: { id: true, nombre: true, rutaId: true, responsableId: true },
    });

    if (!cajaRuta?.id) {
      throw new NotFoundException('Caja de ruta activa no encontrada');
    }

    return {
      rutaId: ruta.id,
      cobradorId: ruta.cobradorId,
      cajaId: cajaRuta.id,
    };
  }

  private async notifyCobradorGestionVencida(params: {
    prestamoId: string;
    titulo: string;
    mensaje: string;
    tipo?: string;
    metadata?: any;
  }) {
    try {
      const asignacion = await this.prisma.asignacionRuta.findFirst({
        where: {
          cliente: { prestamos: { some: { id: params.prestamoId } } },
          activa: true,
        },
        select: { ruta: { select: { cobradorId: true } } },
      });

      const cobradorId = asignacion?.ruta?.cobradorId;
      if (!cobradorId) return;

      await this.notificacionesService.create({
        usuarioId: cobradorId,
        titulo: params.titulo,
        mensaje: params.mensaje,
        tipo: params.tipo || 'SISTEMA',
        entidad: 'Prestamo',
        entidadId: params.prestamoId,
        metadata: {
          ...(params.metadata || {}),
          prestamoId: params.prestamoId,
        },
      });
    } catch (e) {
      this.logger.warn(
        'No se pudo notificar al cobrador por gestión vencida',
        e,
      );
    }
  }

  private parseJsonObject(value: any): Record<string, any> {
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    return typeof value === 'object' ? value : {};
  }

  private buildReferenciasCliente(cliente: any) {
    return [
      {
        tipo: 'REFERENCIA_1',
        nombre: cliente?.referencia1Nombre,
        telefono: cliente?.referencia1Telefono,
      },
      {
        tipo: 'REFERENCIA_2',
        nombre: cliente?.referencia2Nombre,
        telefono: cliente?.referencia2Telefono,
      },
      {
        tipo: 'REFERENCIA_GENERAL',
        nombre: cliente?.referencia,
        telefono: null,
      },
    ].filter((referencia) => referencia.nombre || referencia.telefono);
  }

  private enrichApprovalContext(approval: any, datosSolicitud: Record<string, any>) {
    return {
      ...approval,
      datosSolicitud,
      solicitante: approval.solicitadoPor
        ? `${approval.solicitadoPor.nombres || ''} ${approval.solicitadoPor.apellidos || ''}`.trim()
        : 'Desconocido',
      rolSolicitante: approval.solicitadoPor?.rol || 'N/A',
    };
  }

  async getApprovalContext(aprobacionId: string) {
    const approval = await this.prisma.aprobacion.findUnique({
      where: { id: aprobacionId },
      include: {
        solicitadoPor: {
          select: { id: true, nombres: true, apellidos: true, rol: true },
        },
        aprobadoPor: {
          select: { id: true, nombres: true, apellidos: true, rol: true },
        },
      },
    });

    if (!approval) {
      throw new NotFoundException('Aprobación no encontrada');
    }

    const datosSolicitud = this.parseJsonObject(approval.datosSolicitud);
    let prestamoId = String(
      datosSolicitud.prestamoId ||
        (approval.tablaReferencia === 'Prestamo' ? approval.referenciaId : '') ||
        '',
    ).trim();
    const tablaReferencia = String(approval.tablaReferencia || '');
    const cuotaId = String(
      datosSolicitud.cuotaId ||
        (['Cuota', 'cuotas'].includes(tablaReferencia)
          ? approval.referenciaId
          : '') ||
        '',
    ).trim();
    let clienteId = String(datosSolicitud.clienteId || '').trim();

    if ((!clienteId || !prestamoId) && cuotaId) {
      const cuotaBase = await this.prisma.cuota.findUnique({
        where: { id: cuotaId },
        select: {
          id: true,
          prestamoId: true,
          prestamo: { select: { clienteId: true } },
        },
      });

      if (!prestamoId) {
        prestamoId = cuotaBase?.prestamoId || '';
      }

      if (!clienteId) {
        clienteId = cuotaBase?.prestamo?.clienteId || '';
      }
    }

    if (!clienteId && prestamoId) {
      const prestamoBase = await this.prisma.prestamo.findUnique({
        where: { id: prestamoId },
        select: { clienteId: true },
      });
      clienteId = prestamoBase?.clienteId || '';
    }

    if (!clienteId) {
      return {
        approval: this.enrichApprovalContext(approval, datosSolicitud),
        cliente: null,
        creditoSolicitud: null,
        creditosCliente: [],
        referencias: [],
        multimedia: [],
        pagosUltimos30Dias: [],
        metricas: {
          saldoTotalPendiente: 0,
          creditosActivos: 0,
          cuotasVencidas: 0,
          cuotasPagadas: 0,
          reprogramacionesPrevias: 0,
          pagosUltimos30Dias: 0,
          montoPagadoUltimos30Dias: 0,
          candidatoReprogramacion: false,
          alertas: ['La solicitud no tiene cliente asociado.'],
        },
      };
    }

    const fechaHace30Dias = new Date(Date.now() - 30 * 86_400_000);

    const [
      cliente,
      creditosCliente,
      multimedia,
      reprogramacionesPrevias,
      pagosUltimos30Dias,
    ] = await Promise.all([
      this.prisma.cliente.findUnique({
        where: { id: clienteId },
        select: {
          id: true,
          codigo: true,
          dni: true,
          nombres: true,
          apellidos: true,
          telefono: true,
          direccion: true,
          nivelRiesgo: true,
          enListaNegra: true,
          razonListaNegra: true,
          referencia: true,
          referencia1Nombre: true,
          referencia1Telefono: true,
          referencia2Nombre: true,
          referencia2Telefono: true,
          asignacionesRuta: {
            where: { activa: true },
            select: {
              ruta: {
                select: {
                  id: true,
                  nombre: true,
                  codigo: true,
                  cobrador: {
                    select: { id: true, nombres: true, apellidos: true },
                  },
                },
              },
            },
            take: 1,
          },
        },
      }),
      this.prisma.prestamo.findMany({
        where: { clienteId, eliminadoEn: null },
        orderBy: { creadoEn: 'desc' },
        include: {
          producto: {
            select: { id: true, nombre: true, marca: true, modelo: true },
          },
          cuotas: {
            orderBy: { numeroCuota: 'asc' },
            select: {
              id: true,
              numeroCuota: true,
              fechaVencimiento: true,
              fechaVencimientoProrroga: true,
              fechaPago: true,
              monto: true,
              montoPagado: true,
              estado: true,
            },
          },
        },
      }),
      this.prisma.multimedia.findMany({
        where: {
          clienteId,
          estado: 'ACTIVO' as any,
          eliminadoEn: null,
        },
        orderBy: { creadoEn: 'desc' },
        take: 50,
      }),
      this.prisma.aprobacion.count({
        where: {
          id: { not: aprobacionId },
          tipoAprobacion: TipoAprobacion.REPROGRAMACION_CUOTA,
          estado: {
            in: [
              EstadoAprobacion.PENDIENTE,
              EstadoAprobacion.APROBADO,
              EstadoAprobacion.RECHAZADO,
            ],
          },
          datosSolicitud: {
            path: ['clienteId'],
            equals: clienteId,
          } as any,
        },
      }),
      this.prisma.pago.findMany({
        where: {
          clienteId,
          fechaPago: { gte: fechaHace30Dias },
        },
        orderBy: { fechaPago: 'desc' },
        select: {
          id: true,
          numeroPago: true,
          prestamoId: true,
          montoTotal: true,
          metodoPago: true,
          fechaPago: true,
          origenGestion: true,
          fechaOperativaRuta: true,
        },
      }),
    ]);

    const ahora = new Date();
    const cuotas = creditosCliente.flatMap((credito: any) =>
      Array.isArray(credito.cuotas) ? credito.cuotas : [],
    );
    const cuotasVencidas = cuotas.filter((cuota: any) => {
      if (cuota.estado === EstadoCuota.VENCIDA) return true;
      if (
        cuota.estado === EstadoCuota.PAGADA ||
        cuota.estado === EstadoCuota.PRORROGADA
      ) {
        return false;
      }
      const fecha = cuota.fechaVencimientoProrroga || cuota.fechaVencimiento;
      return fecha ? new Date(fecha).getTime() < ahora.getTime() : false;
    }).length;
    const cuotasPagadas = cuotas.filter(
      (cuota: any) => cuota.estado === EstadoCuota.PAGADA,
    ).length;
    const saldoTotalPendiente = creditosCliente.reduce(
      (sum: number, credito: any) => sum + Number(credito.saldoPendiente || 0),
      0,
    );
    const creditosActivos = creditosCliente.filter((credito: any) =>
      [EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA].includes(
        credito.estado,
      ),
    ).length;
    const montoPagadoUltimos30Dias = pagosUltimos30Dias.reduce(
      (sum: number, pago: any) => sum + Number(pago.montoTotal || 0),
      0,
    );

    const alertas: string[] = [];
    if (cliente?.enListaNegra) {
      alertas.push('El cliente está en lista negra.');
    }
    if (cuotasVencidas > 0) {
      alertas.push(`El cliente tiene ${cuotasVencidas} cuota(s) vencida(s).`);
    }
    if (reprogramacionesPrevias > 0) {
      alertas.push(
        `El cliente registra ${reprogramacionesPrevias} reprogramación(es).`,
      );
    }
    if (montoPagadoUltimos30Dias <= 0) {
      alertas.push('No registra pagos en los últimos 30 días.');
    }

    const metricas = {
      saldoTotalPendiente,
      creditosActivos,
      cuotasVencidas,
      cuotasPagadas,
      reprogramacionesPrevias,
      pagosUltimos30Dias: pagosUltimos30Dias.length,
      montoPagadoUltimos30Dias,
      candidatoReprogramacion:
        cuotasVencidas <= 2 &&
        reprogramacionesPrevias <= 2 &&
        montoPagadoUltimos30Dias > 0 &&
        !cliente?.enListaNegra,
      alertas,
    };

    return {
      approval: this.enrichApprovalContext(approval, datosSolicitud),
      cliente,
      creditoSolicitud:
        creditosCliente.find((credito: any) => credito.id === prestamoId) ||
        null,
      creditosCliente,
      referencias: this.buildReferenciasCliente(cliente),
      multimedia,
      pagosUltimos30Dias,
      metricas,
    };
  }

  async getMyRequests(usuarioId: string) {
    return this.prisma.aprobacion.findMany({
      where: { solicitadoPorId: usuarioId },
      orderBy: { creadoEn: 'desc' },
      take: 100,
      include: {
        solicitadoPor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            rol: true,
          },
        },
        aprobadoPor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            rol: true,
          },
        },
      },
    });
  }

  private generarNumeroPago() {
    return `PAG-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private generarNumeroTransaccion(prefix = 'TRX') {
    return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private async cargarEfectoProvisionalPendiente(
    db: any,
    aprobacionId: string,
  ) {
    const efecto = await db.efectoProvisional?.findFirst?.({
      where: { aprobacionId },
      orderBy: { creadoEn: 'desc' },
    });

    if (efecto && efecto.estado !== 'PENDIENTE_REVISION') {
      throw new BadRequestException('El efecto provisional ya fue procesado');
    }

    return efecto || null;
  }

  private async confirmarEfectoProvisional(tx: any, efecto: any) {
    if (!efecto?.id) return;

    await tx.efectoProvisional.update({
      where: { id: efecto.id },
      data: {
        estado: 'CONFIRMADO',
        confirmadoEn: new Date(),
      },
    });
  }

  private async confirmarPrestamoProvisional(
    tx: any,
    approval: any,
    aprobadoPorId?: string,
  ) {
    if (!approval.referenciaId) {
      throw new BadRequestException('La aprobación no tiene préstamo asociado');
    }

    await tx.prestamo.update({
      where: { id: approval.referenciaId },
      data: {
        estado: EstadoPrestamo.ACTIVO,
        estadoAprobacion: EstadoAprobacion.APROBADO,
        aprobadoPorId: aprobadoPorId || undefined,
      },
    });
  }

  private async asegurarRestauracionProvisionalPermitida(aprobacionId: string) {
    const efecto = await this.prisma.efectoProvisional?.findFirst?.({
      where: { aprobacionId },
      orderBy: { creadoEn: 'desc' },
    });

    if (efecto && efecto.estado !== 'PENDIENTE_REVISION') {
      throw new BadRequestException(
        'Esta solicitud ya ejecutó su efecto provisional. Debe crearse una nueva solicitud para reabrirla.',
      );
    }
  }

  private async crearReversasPrestamoProvisionalRobusto(
    tx: any,
    rollbackData: any,
    transaccionesOriginales: any[],
    journalsOriginales: any[],
    reversadoPorId?: string,
    motivoRechazo?: string,
  ) {
    const transaccionReversaIds: string[] = [];
    const journalEntryReversaIds: string[] = [];

    // Reversa de transacciones
    for (const original of transaccionesOriginales) {
      const reversaReferenciaId = `REVERSA:${original.id}`;

      // Validar idempotencia: verificar si ya existe reversa
      const existingReversa = await tx.transaccion.findFirst({
        where: {
          referenciaId: reversaReferenciaId,
        },
        select: { id: true },
      });

      if (existingReversa?.id) {
        this.logger.log(`Reversa de transacción ${original.id} ya existe, saltando`);
        transaccionReversaIds.push(existingReversa.id);
        continue;
      }

      const tipoReversa =
        original.tipo === TipoTransaccion.EGRESO
          ? TipoTransaccion.INGRESO
          : TipoTransaccion.EGRESO;

      try {
        const reversa = await tx.transaccion.create({
          data: {
            numeroTransaccion: this.generarNumeroTransaccion('REV'),
            cajaId: original.cajaId,
            tipo: tipoReversa,
            monto: Number(original.monto || 0),
            descripcion: `Reversa de ${original.descripcion || 'movimiento'}${motivoRechazo ? ` — ${motivoRechazo}` : ''}`,
            creadoPorId: reversadoPorId || original.creadoPorId,
            aprobadoPorId: reversadoPorId || undefined,
            tipoReferencia: original.tipoReferencia || 'PRESTAMO',
            referenciaId: reversaReferenciaId,
          },
          select: { id: true },
        });
        transaccionReversaIds.push(reversa.id);
      } catch (error) {
        this.logger.error(`Error creando reversa de transacción ${original.id}:`, error);
        throw new BadRequestException(`No se pudo crear reversa de transacción: ${(error as Error).message}`);
      }
    }

    // Reversa de journals
    for (const original of journalsOriginales) {
      if (!Array.isArray(original.lines)) continue;

      const reversaReferenceType = 'AJUSTE' as any;
      const reversaReferenceId = `REVERSA:${original.id}`;

      // Validar idempotencia: verificar si ya existe reversa
      const existingReversa = await tx.journalEntry.findFirst({
        where: {
          referenceType: reversaReferenceType,
          referenceId: reversaReferenceId,
        },
        select: { id: true },
      });

      if (existingReversa?.id) {
        this.logger.log(`Reversa de journal ${original.id} ya existe, saltando`);
        journalEntryReversaIds.push(existingReversa.id);
        continue;
      }

      try {
        const reversa = await this.ledgerService.registrarAsiento(
          {
            referenceType: reversaReferenceType,
            referenceId: reversaReferenceId,
            description: `Reversa de asiento ${original.referenceType || ''} ${original.referenceId || ''}${motivoRechazo ? ` — ${motivoRechazo}` : ''}`,
            createdBy: reversadoPorId || original.createdBy,
            lines: original.lines
              .map((line: any) => {
                const debit = Number(line.debitAmount || 0);
                const credit = Number(line.creditAmount || 0);
                const cajaDelta =
                  line.cajaId && (debit > 0 || credit > 0)
                    ? credit - debit
                    : undefined;

                return {
                  accountCode: line.accountCode,
                  debitAmount: credit > 0 ? credit : undefined,
                  creditAmount: debit > 0 ? debit : undefined,
                  cajaId: line.cajaId || undefined,
                  cajaDelta,
                };
              })
              .filter(
                (line: any) =>
                  Number(line.debitAmount || 0) > 0 ||
                  Number(line.creditAmount || 0) > 0,
              ),
          },
          tx,
        );
        if (reversa?.id) journalEntryReversaIds.push(reversa.id);
      } catch (error) {
        this.logger.error(`Error creando reversa de journal ${original.id}:`, error);
        throw new BadRequestException(`No se pudo crear reversa de asiento contable: ${(error as Error).message}`);
      }
    }

    return { transaccionReversaIds, journalEntryReversaIds };
  }

  private async reaplicarPrestamoProvisionalRevertido(
    tx: any,
    approval: any,
    userId: string,
    notas?: string,
  ) {
    const efectoAnterior = await tx.efectoProvisional.findFirst({
      where: { aprobacionId: approval.id },
      orderBy: { creadoEn: 'desc' },
    });

    if (!efectoAnterior || efectoAnterior.estado !== 'REVERTIDO') {
      return null;
    }

    const rollbackData = efectoAnterior.rollbackData || {};
    const prestamoId = String(
      rollbackData.prestamoId || approval.referenciaId || '',
    );
    if (!prestamoId) {
      throw new BadRequestException('La aprobación no tiene préstamo asociado');
    }

    await tx.prestamo.update({
      where: { id: prestamoId },
      data: {
        estado: EstadoPrestamo.PENDIENTE_APROBACION,
        estadoAprobacion: EstadoAprobacion.PENDIENTE,
        eliminadoEn: null,
        aprobadoPorId: null,
      },
    });

    await tx.cuota.updateMany({
      where: { prestamoId },
      data: {
        estado: EstadoCuota.PENDIENTE,
        montoPagado: 0,
        fechaPago: null,
      },
    });

    if (rollbackData.asignacionRutaId) {
      await tx.asignacionRuta.updateMany({
        where: { id: String(rollbackData.asignacionRutaId) },
        data: { activa: true },
      });
    }

    if (rollbackData.stockDescontado && rollbackData.productoId) {
      await tx.producto.update({
        where: { id: rollbackData.productoId },
        data: { stock: { decrement: 1 } },
      });
    }

    const transaccionIds: string[] = [];
    const journalEntryIds: string[] = [];

    for (const transaccionId of rollbackData.transaccionIds || []) {
      const original = await tx.transaccion.findUnique?.({
        where: { id: transaccionId },
      });
      if (!original?.id) continue;

      const nueva = await tx.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion('REP'),
          cajaId: original.cajaId,
          tipo: original.tipo,
          monto: Number(original.monto || 0),
          descripcion: `Reapertura provisional: ${original.descripcion || 'movimiento'}`,
          creadoPorId: userId,
          tipoReferencia: original.tipoReferencia,
          referenciaId: original.referenciaId,
        },
        select: { id: true },
      });
      transaccionIds.push(nueva.id);
    }

    const originalJournalIds = rollbackData.journalEntryIds || rollbackData.journalReferenceIds || [];
    for (const journalEntryId of originalJournalIds) {
      const original = await tx.journalEntry.findUnique?.({
        where: { id: journalEntryId },
        include: { lines: true },
      });
      if (!original?.id || !Array.isArray(original.lines)) continue;

      const nuevo = await this.ledgerService.registrarAsiento(
        {
          referenceType: 'AJUSTE' as any,
          referenceId: `REAPERTURA:${original.id}`,
          description: `Reapertura provisional de ${original.referenceType || ''} ${original.referenceId || ''}${notas ? ` — ${notas}` : ''}`,
          createdBy: userId,
          lines: original.lines
            .map((line: any) => {
              const debit = Number(line.debitAmount || 0);
              const credit = Number(line.creditAmount || 0);
              return {
                accountCode: line.accountCode,
                debitAmount: debit > 0 ? debit : undefined,
                creditAmount: credit > 0 ? credit : undefined,
                cajaId: line.cajaId || undefined,
                cajaDelta:
                  line.cajaId && (debit > 0 || credit > 0)
                    ? debit - credit
                    : undefined,
              };
            })
            .filter(
              (line: any) =>
                Number(line.debitAmount || 0) > 0 ||
                Number(line.creditAmount || 0) > 0,
            ),
        },
        tx,
      );
      if (nuevo?.id) journalEntryIds.push(nuevo.id);
    }

    return tx.efectoProvisional.create({
      data: {
        aprobacionId: approval.id,
        tipoAccion: 'NUEVO_PRESTAMO',
        tipoEntidad: 'Prestamo',
        entidadId: prestamoId,
        estado: 'PENDIENTE_REVISION',
        snapshotAntes: { efectoAnteriorId: efectoAnterior.id },
        snapshotDespues: { reapertura: true },
        rollbackData: {
          ...rollbackData,
          transaccionIds,
          journalEntryIds,
          journalReferenceIds: journalEntryIds,
          efectoAnteriorId: efectoAnterior.id,
          reaperturaPorId: userId,
        },
        entidadesAfectadas: {
          prestamoId,
          cuotaIds: rollbackData.cuotaIds || [],
          aprobacionId: approval.id,
        },
        aplicadoPorId: userId,
      },
    });
  }

  private async rejectLoanDirecto(
    tx: any,
    approval: any,
    rechazadoPorId?: string,
    motivoRechazo?: string,
  ) {
    if (!approval.referenciaId) {
      throw new BadRequestException('La aprobación no tiene préstamo asociado');
    }

    const prestamoRechazado = await tx.prestamo.update({
      where: { id: approval.referenciaId },
      data: {
        estadoAprobacion: EstadoAprobacion.RECHAZADO,
        aprobadoPorId: rechazadoPorId || undefined,
        eliminadoEn: new Date(),
      },
      include: { producto: true },
    });

    await tx.cuota.updateMany({
      where: { prestamoId: approval.referenciaId },
      data: {
        estado: EstadoCuota.PENDIENTE,
        montoPagado: 0,
        fechaPago: null,
      },
    });

    if (prestamoRechazado.productoId) {
      try {
        await tx.producto.update({
          where: { id: prestamoRechazado.productoId },
          data: { stock: { increment: 1 } },
        });
      } catch (e) {
        this.logger.warn(
          `No se pudo restablecer stock al rechazar el préstamo ${approval.referenciaId}:`,
          e,
        );
      }
    }
  }

  private async revertirPrestamoProvisional(
    tx: any,
    approval: any,
    efecto: any,
    rechazadoPorId?: string,
    motivoRechazo?: string,
  ) {
    // Validar idempotencia
    if (efecto.estado === 'REVERTIDO') {
      this.logger.log(`Efecto provisional ${efecto.id} ya está revertido, retornando idempotente`);
      return;
    }

    const rollbackData = efecto?.rollbackData || {};
    const prestamoId = String(
      rollbackData.prestamoId || approval.referenciaId || '',
    );

    if (!prestamoId) {
      throw new BadRequestException('La aprobación no tiene préstamo asociado');
    }

    // Validar que el préstamo existe
    const prestamo = await tx.prestamo.findUnique({
      where: { id: prestamoId },
      select: { id: true, productoId: true },
    });

    if (!prestamo?.id) {
      throw new NotFoundException(`Préstamo ${prestamoId} no encontrado`);
    }

    // Resolver transacciones originales con fallback
    const transaccionIds = Array.isArray(rollbackData.transaccionIds)
      ? rollbackData.transaccionIds.filter(Boolean)
      : [];

    let transaccionesOriginales = [];

    if (transaccionIds.length > 0) {
      transaccionesOriginales = await tx.transaccion.findMany({
        where: { id: { in: transaccionIds } },
        select: {
          id: true,
          cajaId: true,
          tipo: true,
          monto: true,
          descripcion: true,
          creadoPorId: true,
          tipoReferencia: true,
          referenciaId: true,
        },
      });
    }

    if (transaccionesOriginales.length === 0) {
      transaccionesOriginales = await tx.transaccion.findMany({
        where: {
          tipoReferencia: 'PRESTAMO',
          referenciaId: prestamoId,
          tipo: TipoTransaccion.EGRESO,
        },
        select: {
          id: true,
          cajaId: true,
          tipo: true,
          monto: true,
          descripcion: true,
          creadoPorId: true,
          tipoReferencia: true,
          referenciaId: true,
        },
      });
    }

    // Resolver journals originales con fallback
    const journalEntryIds = Array.isArray(rollbackData.journalEntryIds)
      ? rollbackData.journalEntryIds.filter(Boolean)
      : Array.isArray(rollbackData.journalReferenceIds)
        ? rollbackData.journalReferenceIds.filter(Boolean)
        : [];

    let journalsOriginales = [];

    if (journalEntryIds.length > 0) {
      journalsOriginales = await tx.journalEntry.findMany({
        where: { id: { in: journalEntryIds } },
        include: { lines: true },
      });
    }

    if (journalsOriginales.length === 0) {
      journalsOriginales = await tx.journalEntry.findMany({
        where: {
          referenceType: 'DESEMBOLSO',
          referenceId: prestamoId,
        },
        include: { lines: true },
      });
    }

    // Validar que existan movimientos originales para revertir
    if (transaccionesOriginales.length === 0 && journalsOriginales.length === 0) {
      throw new BadRequestException(
        `No se encontraron movimientos originales para revertir el préstamo provisional ${prestamoId}`,
      );
    }

    // Validar que exista journal original si hay transacciones
    if (transaccionesOriginales.length > 0 && journalsOriginales.length === 0) {
      throw new BadRequestException(
        `No se encontró el asiento contable original del desembolso para el préstamo ${prestamoId}. No se puede revertir caja de forma segura.`,
      );
    }

    const reversas = await this.crearReversasPrestamoProvisionalRobusto(
      tx,
      rollbackData,
      transaccionesOriginales,
      journalsOriginales,
      rechazadoPorId,
      motivoRechazo,
    );

    const prestamoRechazado = await tx.prestamo.update({
      where: { id: prestamoId },
      data: {
        estadoAprobacion: EstadoAprobacion.RECHAZADO,
        aprobadoPorId: rechazadoPorId || undefined,
        eliminadoEn: new Date(),
      },
      include: { producto: true },
    });

    await tx.cuota.updateMany({
      where: { prestamoId },
      data: {
        estado: EstadoCuota.PENDIENTE,
        montoPagado: 0,
        fechaPago: null,
      },
    });

    if (rollbackData.asignacionRutaId) {
      await tx.asignacionRuta.updateMany({
        where: { id: String(rollbackData.asignacionRutaId) },
        data: { activa: false },
      });
    }

    if (rollbackData.stockDescontado && prestamoRechazado.productoId) {
      await tx.producto.update({
        where: { id: prestamoRechazado.productoId },
        data: { stock: { increment: 1 } },
      });
    }

    await tx.efectoProvisional.update({
      where: { id: efecto.id },
      data: {
        estado: 'REVERTIDO',
        revertidoEn: new Date(),
        motivoReversion: motivoRechazo || 'Solicitud rechazada',
        rollbackData: {
          ...rollbackData,
          ...reversas,
        },
      },
    });
  }

  private async rejectReprogramacionCuota(
    approval: any,
    efectoProvisional: any,
    rechazadoPorId?: string,
    motivoRechazo?: string,
  ) {
    if (!efectoProvisional) {
      throw new BadRequestException(
        'No se encontró efecto provisional para revertir la reprogramación',
      );
    }

    if (efectoProvisional.estado !== 'PENDIENTE_REVISION') {
      throw new BadRequestException('El efecto provisional ya fue procesado');
    }

    const rollbackData = efectoProvisional.rollbackData || {};

    const cuotaId = String(
      rollbackData.cuotaId || approval.referenciaId || '',
    );

    if (!cuotaId) {
      throw new BadRequestException(
        'La solicitud de reprogramación no tiene cuota asociada',
      );
    }

    const fechaVencimientoOriginal = rollbackData.fechaVencimientoOriginal
      ? new Date(rollbackData.fechaVencimientoOriginal)
      : null;

    if (
      !fechaVencimientoOriginal ||
      Number.isNaN(fechaVencimientoOriginal.getTime())
    ) {
      throw new BadRequestException(
        'La solicitud no contiene una fecha original válida para revertir',
      );
    }

    const fechaOperativaOriginal =
      typeof rollbackData.fechaOperativaOriginal === 'string'
        ? rollbackData.fechaOperativaOriginal
        : null;

    const registroVisitaAnterior = rollbackData.registroVisitaAnterior;
    const debeRevertirRegistroVisita =
      rollbackData.origenGestion === 'CIERRE_PENDIENTE' &&
      fechaOperativaOriginal;

    await this.prisma.$transaction(async (tx) => {
      const cuotaActual = await tx.cuota.findUnique({
        where: { id: cuotaId },
        select: {
          id: true,
          prestamoId: true,
          fechaVencimiento: true,
          estado: true,
        },
      });

      if (!cuotaActual) {
        throw new BadRequestException('La cuota ya no existe');
      }

      if (cuotaActual.estado === EstadoCuota.PAGADA) {
        throw new BadRequestException(
          'No se puede revertir una reprogramación de una cuota ya pagada',
        );
      }

      const fechaNuevaEsperada = rollbackData.fechaVencimientoNueva
        ? new Date(rollbackData.fechaVencimientoNueva)
        : null;

      if (
        fechaNuevaEsperada &&
        !Number.isNaN(fechaNuevaEsperada.getTime())
      ) {
        const actualMs = new Date(cuotaActual.fechaVencimiento).getTime();
        const esperadaMs = fechaNuevaEsperada.getTime();

        if (actualMs !== esperadaMs) {
          this.logger.warn(
            `La cuota ${cuotaId} fue modificada después de la solicitud (esperada: ${fechaNuevaEsperada.toISOString()}, actual: ${cuotaActual.fechaVencimiento}). Revertiendo a fecha original de todas formas.`,
          );
        }
      }

      const claimed = await tx.aprobacion.updateMany({
        where: {
          id: approval.id,
          estado: EstadoAprobacion.PENDIENTE,
        },
        data: {
          estado: EstadoAprobacion.RECHAZADO,
          aprobadoPorId: rechazadoPorId || undefined,
          comentarios: motivoRechazo || 'Rechazado sin motivo especificado',
          revisadoEn: new Date(),
        },
      });

      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Esta solicitud ya fue tomada por otro usuario',
        );
      }

      await tx.cuota.update({
        where: { id: cuotaId },
        data: {
          fechaVencimiento: fechaVencimientoOriginal,
        },
      });

      if (debeRevertirRegistroVisita && rollbackData.rutaIdOriginal) {
        const rutaIdOriginal = String(rollbackData.rutaIdOriginal);

        if (registroVisitaAnterior?.id) {
          await tx.registroVisita.update({
            where: { id: String(registroVisitaAnterior.id) },
            data: {
              estadoVisita: registroVisitaAnterior.estadoVisita,
              notas: registroVisitaAnterior.notas,
              prestamoId: registroVisitaAnterior.prestamoId,
              cobradorId: registroVisitaAnterior.cobradorId,
            },
          });
        } else {
          await tx.registroVisita.deleteMany({
            where: {
              rutaId: rutaIdOriginal,
              clienteId: String(rollbackData.clienteId),
              fechaVisita: fechaOperativaOriginal,
            },
          });
        }
      }

      await tx.efectoProvisional.update({
        where: { id: efectoProvisional.id },
        data: {
          estado: 'REVERTIDO',
          revertidoEn: new Date(),
          motivoReversion: motivoRechazo || 'Reprogramación rechazada',
        },
      });
    });

    try {
      const datos =
        typeof approval.datosSolicitud === 'string'
          ? JSON.parse(approval.datosSolicitud)
          : approval.datosSolicitud || {};

      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Reprogramación rechazada',
        mensaje: `La reprogramación de la cuota del cliente ${
          datos.clienteNombre || datos.cliente || ''
        } fue rechazada y revertida.${
          motivoRechazo ? ` Motivo: ${motivoRechazo}` : ''
        }`,
        tipo: 'REPROGRAMACION_RECHAZADA',
        entidad: 'Aprobacion',
        entidadId: approval.id,
        metadata: {
          tipoAprobacion: 'REPROGRAMACION_CUOTA',
          estadoAprobacion: 'RECHAZADO',
          motivoRechazo: motivoRechazo || undefined,
          prestamoId: rollbackData.prestamoId || datos.prestamoId,
          cuotaId: rollbackData.cuotaId || datos.cuotaId,
        },
      });
    } catch {
      // No interrumpir el rechazo si falla la notificación
    }

    this.notificacionesGateway.broadcastAprobacionesActualizadas({
      accion: 'RECHAZAR',
      aprobacionId: approval.id,
      tipoAprobacion: approval.tipoAprobacion,
    });

    this.notificacionesGateway.broadcastRutasActualizadas({
      accion: 'REPROGRAMACION_RECHAZADA',
      prestamoId: rollbackData.prestamoId,
      cuotaId: rollbackData.cuotaId || approval.referenciaId,
    });

    this.notificacionesGateway.broadcastPrestamosActualizados({
      accion: 'REPROGRAMACION_RECHAZADA',
      prestamoId: rollbackData.prestamoId,
      cuotaId: rollbackData.cuotaId || approval.referenciaId,
    });

    this.notificacionesGateway.broadcastDashboardsActualizados({
      origen: 'REPROGRAMACION_CUOTA',
    });

    return {
      success: true,
      message: 'Reprogramación rechazada y revertida',
    };
  }

  private calcularAplicacionPago(
    prestamo: any,
    montoTotal: number,
    cuotaIdObjetivo?: string,
    aplicarDesdeCuotaObjetivo = false,
  ) {
    const detallesPago: {
      cuotaId: string;
      monto: number;
      montoCapital: number;
      montoInteres: number;
      montoInteresMora: number;
    }[] = [];
    let restante = montoTotal;
    let capitalTotal = 0;
    let interesTotal = 0;
    let moraTotal = 0;
    const cuotasActualizar: { id: string; montoPagado: number; estado: any }[] =
      [];

    const cuotasBase = prestamo.cuotas || [];
    const cuotasAplicables = (() => {
      if (!cuotaIdObjetivo) return cuotasBase;

      if (!aplicarDesdeCuotaObjetivo) {
        return cuotasBase.filter((cuota: any) => cuota.id === cuotaIdObjetivo);
      }

      const cuotaIndex = cuotasBase.findIndex(
        (cuota: any) => cuota.id === cuotaIdObjetivo,
      );

      return cuotaIndex >= 0 ? cuotasBase.slice(cuotaIndex) : [];
    })();

    if (cuotaIdObjetivo && cuotasAplicables.length === 0) {
      throw new BadRequestException(
        'La cuota objetivo no está pendiente o no corresponde al préstamo indicado',
      );
    }

    for (const cuota of cuotasAplicables) {
      if (restante <= 0) break;

      const montoCuota = Number(cuota.monto);
      const yaPagado = Number(cuota.montoPagado);
      const pendiente = montoCuota - yaPagado;
      if (pendiente <= 0) continue;

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

      const pagoAplicadoMora = Math.min(restante, faltaMora);
      restante -= pagoAplicadoMora;
      moraTotal += pagoAplicadoMora;

      const pagoAplicadoInteres = Math.min(restante, faltaInteres);
      restante -= pagoAplicadoInteres;
      interesTotal += pagoAplicadoInteres;

      const pagoAplicadoCapital = Math.min(restante, faltaCapital);
      restante -= pagoAplicadoCapital;
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
        const completa = nuevoMontoPagado >= montoCuota - COP_TOLERANCE;
        const montoPagadoFinal = completa ? montoCuota : nuevoMontoPagado;
        const nuevoEstado = completa
          ? EstadoCuota.PAGADA
          : cuota.estado === EstadoCuota.PENDIENTE
            ? EstadoCuota.PARCIAL
            : cuota.estado;

        cuotasActualizar.push({
          id: cuota.id,
          montoPagado: montoPagadoFinal,
          estado: nuevoEstado,
        });
      }
    }

    return {
      detallesPago,
      cuotasActualizar,
      capitalTotal,
      interesTotal,
      moraTotal,
    };
  }

  async approveItem(
    id: string,
    _type: TipoAprobacion,
    aprobadoPorId?: string,
    notas?: string,
    editedData?: any,
  ) {
    const approval = await this.prisma.aprobacion.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException('Aprobación no encontrada');
    }

    if (approval.estado !== EstadoAprobacion.PENDIENTE) {
      throw new BadRequestException(
        `Esta solicitud ya fue procesada (estado: ${approval.estado})`,
      );
    }

    const efectoProvisional = await this.cargarEfectoProvisionalPendiente(
      this.prisma,
      id,
    );

    if (approval.tipoAprobacion === TipoAprobacion.REPROGRAMACION_CUOTA) {
      if (!efectoProvisional) {
        throw new BadRequestException(
          'No se encontró efecto provisional para confirmar la reprogramación',
        );
      }

      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.aprobacion.updateMany({
          where: {
            id,
            estado: EstadoAprobacion.PENDIENTE,
          },
          data: {
            estado: EstadoAprobacion.APROBADO,
            aprobadoPorId: aprobadoPorId || undefined,
            comentarios: notas || undefined,
            datosAprobados: editedData || undefined,
            revisadoEn: new Date(),
          },
        });

        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Esta solicitud ya fue tomada por otro usuario',
          );
        }

        await this.confirmarEfectoProvisional(tx, efectoProvisional);
      });

      const rollbackData = efectoProvisional.rollbackData || {};

      this.notificacionesGateway.broadcastAprobacionesActualizadas({
        accion: 'APROBAR',
        aprobacionId: id,
        tipoAprobacion: approval.tipoAprobacion,
      });

      this.notificacionesGateway.broadcastRutasActualizadas({
        accion: 'REPROGRAMACION_APROBADA',
        prestamoId: rollbackData.prestamoId,
        cuotaId: rollbackData.cuotaId || approval.referenciaId,
      });

      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'REPROGRAMACION_APROBADA',
        prestamoId: rollbackData.prestamoId,
        cuotaId: rollbackData.cuotaId || approval.referenciaId,
      });

      this.notificacionesGateway.broadcastDashboardsActualizados({
        origen: 'REPROGRAMACION_CUOTA',
      });

      return {
        success: true,
        message: 'Reprogramación aprobada',
      };
    }

    if (
      efectoProvisional &&
      approval.tipoAprobacion === TipoAprobacion.NUEVO_PRESTAMO
    ) {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.aprobacion.updateMany({
          where: {
            id,
            estado: EstadoAprobacion.PENDIENTE,
          },
          data: {
            estado: EstadoAprobacion.APROBADO,
            aprobadoPorId: aprobadoPorId || undefined,
            comentarios: notas || undefined,
            datosAprobados: editedData || undefined,
            revisadoEn: new Date(),
          },
        });

        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Esta solicitud ya fue tomada por otro usuario',
          );
        }

        await this.confirmarPrestamoProvisional(
          tx,
          approval,
          aprobadoPorId,
        );
        await this.confirmarEfectoProvisional(tx, efectoProvisional);
      });

      this.notificacionesGateway.broadcastAprobacionesActualizadas({
        accion: 'APROBAR',
        aprobacionId: id,
        tipoAprobacion: approval.tipoAprobacion,
      });
      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'APROBAR',
        prestamoId: approval.referenciaId,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({});

      this.logger.log(
        `Aprobación provisional ${id} confirmada por ${aprobadoPorId || 'desconocido'} (tipo: ${approval.tipoAprobacion})`,
      );

      return { success: true, message: 'Aprobación procesada exitosamente' };
    }

    const claimed = await this.prisma.aprobacion.updateMany({
      where: {
        id,
        estado: EstadoAprobacion.PENDIENTE,
      },
      data: {
        estado: EstadoAprobacion.APROBADO,
        aprobadoPorId: aprobadoPorId || undefined,
        comentarios: notas || undefined,
        datosAprobados: editedData || undefined,
        revisadoEn: new Date(),
      },
    });

    if (claimed.count !== 1) {
      throw new BadRequestException(
        'Esta solicitud ya fue tomada por otro usuario',
      );
    }

    try {
      switch (approval.tipoAprobacion) {
        case TipoAprobacion.NUEVO_CLIENTE:
          await this.approveNewClient(approval);
          break;
        case TipoAprobacion.NUEVO_PRESTAMO:
          await this.approveNewLoan(approval, aprobadoPorId, editedData);
          break;
        case TipoAprobacion.GASTO:
          await this.approveExpense(approval, aprobadoPorId);
          break;
        case TipoAprobacion.SOLICITUD_BASE_EFECTIVO:
          await this.approveCashBase(approval, aprobadoPorId);
          break;
        case TipoAprobacion.PRORROGA_PAGO:
          await this.approvePaymentExtension(approval, aprobadoPorId);
          break;
        case TipoAprobacion.BAJA_POR_PERDIDA:
          await this.approveLoanLoss(approval, aprobadoPorId, editedData);
          break;
        case 'PAGO_TRANSFERENCIA' as any:
          await this.approveTransferPayment(approval, aprobadoPorId);
          break;
        default:
          throw new BadRequestException('Tipo de aprobación no soportado');
      }
    } catch (error) {
      await this.prisma.aprobacion.update({
        where: { id },
        data: {
          estado: EstadoAprobacion.PENDIENTE,
          aprobadoPorId: null,
          comentarios: notas
            ? `${notas} | Error al procesar: ${(error as Error).message}`
            : `Error al procesar: ${(error as Error).message}`,
          datosAprobados: undefined,
          revisadoEn: null,
        },
      });
      throw error;
    }

    this.notificacionesGateway.broadcastAprobacionesActualizadas({
      accion: 'APROBAR',
      aprobacionId: id,
      tipoAprobacion: approval.tipoAprobacion,
    });

    this.logger.log(
      `Aprobación ${id} procesada por ${aprobadoPorId || 'desconocido'} (tipo: ${approval.tipoAprobacion})`,
    );

    return { success: true, message: 'Aprobación procesada exitosamente' };
  }

  private async approveTransferPayment(approval: any, aprobadoPorId?: string) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    const prestamoId = String(data?.prestamoId || approval.referenciaId || '');
    const requestedCobradorId = String(
      data?.cobradorId || approval.solicitadoPorId || '',
    );
    const montoTotal = Number(data?.montoTotal || approval.montoSolicitud || 0);
    const rawFechaPago = String(data?.fechaPago || '');
    const origenGestion = String(data?.origenGestion || '').trim();
    const fechaOperativaRuta = String(data?.fechaOperativaRuta || '').trim();
    const cuotaId = String(data?.cuotaId || '').trim();
    const rutaId = String(data?.rutaId || '').trim();
    const esCierrePendiente = origenGestion === 'CIERRE_PENDIENTE';
    const idempotencyKey =
      (data?.idempotencyKey || approval.idempotencyKey || '')
        .toString()
        .trim() || undefined;

    if (!prestamoId || !requestedCobradorId || !montoTotal || montoTotal <= 0) {
      throw new BadRequestException(
        'Datos insuficientes para aprobar pago por transferencia',
      );
    }

    const fechaPagoBogota = (() => {
      if (!rawFechaPago) return new Date(formatBogotaOffsetIso(new Date()));
      const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(rawFechaPago);
      if (hasTz) return new Date(rawFechaPago);
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawFechaPago)) {
        return new Date(`${rawFechaPago}T00:00:00.000-05:00`);
      }
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rawFechaPago)) {
        return new Date(`${rawFechaPago}-05:00`);
      }
      return new Date(rawFechaPago);
    })();

    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id: prestamoId, eliminadoEn: null },
      include: {
        cuotas: {
          where: {
            estado: {
              in: [
                EstadoCuota.PENDIENTE,
                EstadoCuota.PARCIAL,
                EstadoCuota.VENCIDA,
              ],
            },
          },
          orderBy: { numeroCuota: 'asc' },
        },
        cliente: { select: { id: true } },
      },
    });

    if (!prestamo) throw new NotFoundException('Préstamo no encontrado');
    if (
      ![EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA].includes(prestamo.estado)
    ) {
      throw new BadRequestException(
        `No se puede aplicar pago: préstamo en estado ${prestamo.estado}`,
      );
    }

    const numeroPago = this.generarNumeroPago();

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Prestamo" WHERE id = ${prestamoId} FOR UPDATE`;

      const prestamoActual = await tx.prestamo.findFirst({
        where: { id: prestamoId, eliminadoEn: null },
        include: {
          cuotas: {
            where: {
              estado: {
                in: [
                  EstadoCuota.PENDIENTE,
                  EstadoCuota.PARCIAL,
                  EstadoCuota.VENCIDA,
                ],
              },
            },
            orderBy: { numeroCuota: 'asc' },
          },
          cliente: { select: { id: true } },
        },
      });

      if (!prestamoActual)
        throw new NotFoundException('Préstamo no encontrado');
      if (
        ![EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA].includes(
          prestamoActual.estado,
        )
      ) {
        throw new BadRequestException(
          `No se puede aplicar pago: préstamo en estado ${prestamoActual.estado}`,
        );
      }
      if (montoTotal > Number(prestamoActual.saldoPendiente || 0) + 1) {
        throw new BadRequestException(
          `El monto del pago (${montoTotal}) no puede ser mayor al saldo pendiente del préstamo (${prestamoActual.saldoPendiente})`,
        );
      }

      const cobradorId = await this.resolvePaymentCobradorForClient(
        tx,
        prestamoActual.clienteId,
        requestedCobradorId,
      );
      if (!cobradorId) {
        throw new BadRequestException(
          'No se pudo determinar el cobrador de la ruta para este pago',
        );
      }

      const {
        detallesPago,
        cuotasActualizar,
        capitalTotal,
        interesTotal,
        moraTotal,
      } = this.calcularAplicacionPago(
        prestamoActual,
        montoTotal,
        cuotaId || undefined,
        esCierrePendiente,
      );

      const interesTotalFinal = Math.round(interesTotal * 100) / 100;
      const moraTotalFinal = Math.round(moraTotal * 100) / 100;
      const capitalTotalFinal =
        Math.round((montoTotal - interesTotalFinal - moraTotalFinal) * 100) /
        100;

      const pago = await tx.pago.create({
        data: {
          numeroPago,
          idempotencyKey,
          clienteId: prestamoActual.clienteId,
          prestamoId: prestamoActual.id,
          cobradorId,
          fechaPago: fechaPagoBogota,
          montoTotal,
          metodoPago: MetodoPago.TRANSFERENCIA,
          numeroReferencia: data?.numeroReferencia || null,
          notas: data?.notas || null,
          rutaId: rutaId || undefined,
          fechaOperativaRuta: fechaOperativaRuta || undefined,
          origenGestion: esCierrePendiente ? 'CIERRE_PENDIENTE' : undefined,
          detalles: { create: detallesPago as any },
        },
        select: { id: true },
      });

      if (esCierrePendiente && fechaOperativaRuta) {
        await tx.registroVisita.updateMany({
          where: {
            clienteId: prestamoActual.clienteId,
            fechaVisita: fechaOperativaRuta,
            ...(rutaId ? { rutaId } : {}),
            estadoVisita: 'ausente',
          },
          data: {
            estadoVisita: 'pagado',
            notas: 'Ausencia anulada automáticamente por registro de pago.',
          },
        });
      }

      for (const upd of cuotasActualizar) {
        await tx.cuota.update({
          where: { id: upd.id },
          data: {
            montoPagado: upd.montoPagado,
            estado: upd.estado,
            fechaPago:
              upd.estado === EstadoCuota.PAGADA ? fechaPagoBogota : undefined,
          },
        });
      }

      // Actualizar préstamo
      const nuevoSaldo = Math.max(
        0,
        Number(prestamoActual.saldoPendiente || 0) - montoTotal,
      );
      const prestamoQuedaPagado = nuevoSaldo <= 0;
      let nuevoEstadoPrestamo: any = prestamoActual.estado;
      if (prestamoQuedaPagado) nuevoEstadoPrestamo = EstadoPrestamo.PAGADO;
      else if (prestamoActual.estado === EstadoPrestamo.EN_MORA) {
        const vencidasRestantes = await tx.cuota.count({
          where: { prestamoId: prestamoActual.id, estado: EstadoCuota.VENCIDA },
        });
        if (vencidasRestantes === 0)
          nuevoEstadoPrestamo = EstadoPrestamo.ACTIVO;
      }

      await tx.prestamo.update({
        where: { id: prestamoActual.id },
        data: {
          totalPagado: Number(prestamoActual.totalPagado || 0) + montoTotal,
          capitalPagado:
            Number(prestamoActual.capitalPagado || 0) + capitalTotal,
          interesPagado:
            Number(prestamoActual.interesPagado || 0) + interesTotal,
          saldoPendiente: nuevoSaldo,
          estado: nuevoEstadoPrestamo,
          estadoSincronizacion: 'PENDIENTE' as any,
        },
      });

      // Registrar transacción en CAJA-BANCO
      const cajaBanco = await this.ensureCajaBanco(tx);
      const numeroTransaccionCaja = this.generarNumeroTransaccion('TRX-IN');
      await tx.transaccion.create({
        data: {
          numeroTransaccion: numeroTransaccionCaja,
          cajaId: cajaBanco.id,
          tipo: TipoTransaccion.INGRESO,
          monto: montoTotal,
          descripcion: `Cobranza ${numeroPago} (Transferencia verificada)`,
          creadoPorId: cobradorId,
          aprobadoPorId: aprobadoPorId || null,
          tipoReferencia: 'PAGO',
          referenciaId: numeroPago,
        },
      });

      // Asiento contable de Partida Doble
      // Débito:  1.1.2 Cuentas Bancarias (Transferencia)
      // Crédito: 1.3.1 Cartera Vigente + 3.1 Intereses + 3.2 Mora
      await this.ledgerService.registrarAsiento(
        {
          referenceType: 'PAGO',
          referenceId: pago.id,
          description: `Pago transferencia verificada ${numeroPago}`,
          createdBy: aprobadoPorId || cobradorId,
          lines: [
            {
              accountCode: '1.1.2', // Cuentas Bancarias
              debitAmount: montoTotal,
              cajaId: cajaBanco.id,
              cajaDelta: montoTotal,
            },
            {
              accountCode: '1.3.1',
              creditAmount: capitalTotalFinal,
            },
            ...(interesTotalFinal > 0
              ? [
                  {
                    accountCode: '3.1',
                    creditAmount: interesTotalFinal,
                  },
                ]
              : []),
            ...(moraTotalFinal > 0
              ? [
                  {
                    accountCode: '3.2',
                    creditAmount: moraTotalFinal,
                  },
                ]
              : []),
          ],
        },
        tx,
      );

      // Vincular comprobante (si existe) al pago real
      try {
        const comprobante = await tx.multimedia.findFirst({
          where: {
            prestamoId: prestamo.id,
            clienteId: prestamo.clienteId,
            entidad: 'APROBACION',
            tipoContenido: 'COMPROBANTE_TRANSFERENCIA' as any,
            estado: 'ACTIVO' as any,
            eliminadoEn: null,
          },
          orderBy: { creadoEn: 'desc' },
          select: { id: true },
        });
        if (comprobante?.id) {
          await tx.multimedia.update({
            where: { id: comprobante.id },
            data: { pagoId: pago.id },
          });
        }
      } catch {
        // ignore
      }
    });
  }

  /**
   * Obtener el historial de aprobaciones para una entidad específica
   */
  async getHistory(referenciaId: string, tablaReferencia: string) {
    return this.prisma.aprobacion.findMany({
      where: {
        referenciaId,
        tablaReferencia,
      },
      include: {
        solicitadoPor: {
          select: { nombres: true, apellidos: true },
        },
        aprobadoPor: {
          select: { nombres: true, apellidos: true },
        },
      },
      orderBy: { creadoEn: 'desc' },
    });
  }

  private async reconcilePendingLoansWithoutApproval() {
    const pendingLoans = await this.prisma.prestamo.findMany({
      where: {
        estadoAprobacion: EstadoAprobacion.PENDIENTE,
        estado: EstadoPrestamo.PENDIENTE_APROBACION,
        eliminadoEn: null,
      },
      take: 50,
      orderBy: { creadoEn: 'desc' },
      include: {
        cliente: {
          select: {
            nombres: true,
            apellidos: true,
            dni: true,
            telefono: true,
          },
        },
        producto: {
          select: {
            nombre: true,
          },
        },
      },
    });

    if (pendingLoans.length === 0) return;

    const loanIds = pendingLoans.map((loan) => loan.id);
    const existingApprovals = await this.prisma.aprobacion.findMany({
      where: {
        tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
        tablaReferencia: 'Prestamo',
        referenciaId: { in: loanIds },
        estado: EstadoAprobacion.PENDIENTE,
      },
      select: { referenciaId: true },
    });
    const approvedLoanIds = new Set(
      existingApprovals.map((approval) => approval.referenciaId),
    );

    for (const loan of pendingLoans) {
      if (approvedLoanIds.has(loan.id)) continue;

      const isArticulo = String(loan.tipoPrestamo).toUpperCase() === 'ARTICULO';
      const capital = Number(loan.monto || 0);
      const interesTotal = Number(loan.interesTotal || 0);
      const valorArticulo = Number(loan.precioVentaArticulo || loan.monto || 0);
      const cuotaInicial = Number(loan.cuotaInicial || 0);

      await this.prisma.aprobacion.create({
        data: {
          tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
          idempotencyKey: loan.idempotencyKey || undefined,
          referenciaId: loan.id,
          tablaReferencia: 'Prestamo',
          solicitadoPorId: loan.creadoPorId,
          montoSolicitud: isArticulo ? valorArticulo : capital,
          estado: EstadoAprobacion.PENDIENTE,
          datosSolicitud: {
            numeroPrestamo: loan.numeroPrestamo,
            cliente:
              `${loan.cliente?.nombres || ''} ${loan.cliente?.apellidos || ''}`.trim(),
            cedula: String(loan.cliente?.dni || ''),
            telefono: String(loan.cliente?.telefono || ''),
            monto: capital,
            montoTotal: capital + interesTotal,
            interesTotal,
            tipo: String(loan.tipoPrestamo),
            tipoPrestamo: String(loan.tipoPrestamo),
            tipoAmortizacion: loan.tipoAmortizacion,
            articulo: loan.producto?.nombre || 'Artículo',
            valorArticulo: isArticulo ? valorArticulo : capital,
            cuotas: Number(loan.cantidadCuotas || 0),
            cantidadCuotas: Number(loan.cantidadCuotas || 0),
            plazoMeses: Number(loan.plazoMeses || 0),
            porcentaje: Number(loan.tasaInteres || 0),
            tasaInteres: Number(loan.tasaInteres || 0),
            frecuenciaPago: String(loan.frecuenciaPago),
            cuotaInicial,
            notas: loan.notas || undefined,
            garantia: loan.garantia || undefined,
            fechaInicio: loan.fechaInicio
              ? formatBogotaOffsetIso(loan.fechaInicio)
              : undefined,
            fechaPrimerCobro: loan.fechaPrimerCobro
              ? formatBogotaOffsetIso(loan.fechaPrimerCobro)
              : undefined,
            recuperadaAutomaticamente: true,
          },
        },
      });
    }
  }

  /**
   * Obtener todas las aprobaciones pendientes agrupadas por tipo.
   * Incluye datos del solicitante y montos para el módulo de Revisiones.
   */
  async getPendingApprovals(tipo?: TipoAprobacion) {
    await this.reconcilePendingLoansWithoutApproval();

    const where: any = { estado: EstadoAprobacion.PENDIENTE };
    if (tipo) where.tipoAprobacion = tipo;

    const pendientes = await this.prisma.aprobacion.findMany({
      where,
      include: {
        solicitadoPor: {
          select: { id: true, nombres: true, apellidos: true, rol: true },
        },
        aprobadoPor: {
          select: { id: true, nombres: true, apellidos: true },
        },
      },
      orderBy: { creadoEn: 'desc' },
    });

    const grouped: Record<string, any[]> = {};
    const conteo: Record<string, number> = {};

    for (const item of pendientes) {
      const key = item.tipoAprobacion;
      if (!grouped[key]) {
        grouped[key] = [];
        conteo[key] = 0;
      }

      const datos =
        typeof item.datosSolicitud === 'string'
          ? JSON.parse(item.datosSolicitud)
          : item.datosSolicitud;

      grouped[key].push({
        ...item,
        datosSolicitud: datos,
        solicitante: item.solicitadoPor
          ? `${item.solicitadoPor.nombres} ${item.solicitadoPor.apellidos}`.trim()
          : 'Desconocido',
        rolSolicitante: item.solicitadoPor?.rol || 'N/A',
      });
      conteo[key]++;
    }

    return {
      total: pendientes.length,
      conteo,
      items: grouped,
    };
  }

  /**
   * Obtener items rechazados que necesitan revisión final del SuperAdmin.
   */
  async getSuperadminReviewItems() {
    const rechazados = await this.prisma.aprobacion.findMany({
      where: {
        estado: EstadoAprobacion.RECHAZADO,
        revisadoEn: {
          gte: new Date(Date.now() - 72 * 60 * 60 * 1000),
        },
      },
      include: {
        solicitadoPor: {
          select: { id: true, nombres: true, apellidos: true, rol: true },
        },
        aprobadoPor: {
          select: { id: true, nombres: true, apellidos: true, rol: true },
        },
      },
      orderBy: { revisadoEn: 'desc' },
    });

    return {
      total: rechazados.length,
      items: rechazados.map((item) => {
        const datos =
          typeof item.datosSolicitud === 'string'
            ? JSON.parse(item.datosSolicitud)
            : item.datosSolicitud;

        return {
          ...item,
          datosSolicitud: datos,
          solicitante: item.solicitadoPor
            ? `${item.solicitadoPor.nombres} ${item.solicitadoPor.apellidos}`.trim()
            : 'Desconocido',
          rechazadoPor: item.aprobadoPor
            ? `${item.aprobadoPor.nombres} ${item.aprobadoPor.apellidos}`.trim()
            : 'Desconocido',
          rolRechazador: item.aprobadoPor?.rol || 'N/A',
        };
      }),
    };
  }

  /**
   * Confirmar o revertir un rechazo (decisión final del SuperAdmin).
   */
  async confirmSuperadminAction(
    id: string,
    accion: 'CONFIRMAR' | 'REVERTIR',
    userId: string,
    notas?: string,
  ) {
    const approval = await this.prisma.aprobacion.findUnique({ where: { id } });

    if (!approval) {
      throw new NotFoundException('Aprobación no encontrada');
    }

    if (approval.estado !== EstadoAprobacion.RECHAZADO) {
      throw new BadRequestException(
        `Solo se puede confirmar o restaurar una revisión rechazada. Estado actual: ${approval.estado}`,
      );
    }

    if (accion === 'CONFIRMAR') {
      const claimed = await this.prisma.aprobacion.updateMany({
        where: {
          id,
          estado: EstadoAprobacion.RECHAZADO,
        },
        data: {
          estado: EstadoAprobacion.CANCELADO,
          comentarios: notas
            ? `[SuperAdmin] Eliminación confirmada: ${notas}`
            : `[SuperAdmin] Eliminación confirmada`,
        },
      });

      if (claimed.count !== 1) {
        throw new BadRequestException('Esta revisión final ya fue procesada');
      }

      this.notificacionesGateway.broadcastAprobacionesActualizadas({
        accion: 'CONFIRMAR',
        aprobacionId: id,
        tipoAprobacion: approval.tipoAprobacion,
      });

      return {
        success: true,
        message: 'Eliminación confirmada por el SuperAdministrador',
      };
    } else {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.aprobacion.updateMany({
          where: {
            id,
            estado: EstadoAprobacion.RECHAZADO,
          },
          data: {
            estado: EstadoAprobacion.PENDIENTE,
            aprobadoPorId: null,
            revisadoEn: null,
            comentarios: notas
              ? `[SuperAdmin] Revertido a pendiente: ${notas}`
              : `[SuperAdmin] Revertido a pendiente para re-evaluación`,
          },
        });

        if (claimed.count !== 1) {
          throw new BadRequestException('Esta revisión final ya fue procesada');
        }

        if (
          approval.tipoAprobacion === TipoAprobacion.NUEVO_PRESTAMO &&
          approval.referenciaId
        ) {
          const efectoReaplicado =
            await this.reaplicarPrestamoProvisionalRevertido(
              tx,
              approval,
              userId,
              notas,
            );

          if (!efectoReaplicado) {
            await tx.prestamo.update({
              where: { id: approval.referenciaId },
              data: {
                estadoAprobacion: EstadoAprobacion.PENDIENTE,
                eliminadoEn: null,
              },
            });
          }
        } else if (
          approval.tipoAprobacion === TipoAprobacion.NUEVO_CLIENTE &&
          approval.referenciaId
        ) {
          await tx.cliente.update({
            where: { id: approval.referenciaId },
            data: {
              estadoAprobacion: EstadoAprobacion.PENDIENTE,
              eliminadoEn: null,
            },
          });
        }
      });

      this.notificacionesGateway.broadcastAprobacionesActualizadas({
        accion: 'REVERTIR',
        aprobacionId: id,
        tipoAprobacion: approval.tipoAprobacion,
      });

      if (approval.tipoAprobacion === TipoAprobacion.NUEVO_PRESTAMO && approval.referenciaId) {
        this.notificacionesGateway.broadcastPrestamosActualizados({
          accion: 'RESTAURAR',
          prestamoId: approval.referenciaId,
        });

        this.notificacionesGateway.broadcastDashboardsActualizados({
          origen: 'RESTAURAR_PRESTAMO_PROVISIONAL',
        });
      }

      try {
        await this.notificacionesService.create({
          usuarioId: approval.solicitadoPorId,
          titulo: 'Solicitud Restaurada',
          mensaje:
            'Tu solicitud fue restaurada a estado pendiente por el SuperAdministrador para re-evaluación.',
          tipo: 'SISTEMA',
          entidad: 'Aprobacion',
          entidadId: approval.id,
        });
      } catch {
        /* no interrumpir */
      }

      return {
        success: true,
        message: 'Solicitud restaurada a pendiente para re-evaluación',
      };
    }
  }

  async rejectItem(
    id: string,
    _type: TipoAprobacion,
    rechazadoPorId?: string,
    motivoRechazo?: string,
    resultadoRevision?: 'RECHAZADO_CON_DEUDA' | 'RECHAZADO_CON_REINTEGRO',
  ) {
    const approval = await this.prisma.aprobacion.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException('Aprobación no encontrada');
    }

    if (approval.estado !== EstadoAprobacion.PENDIENTE) {
      throw new BadRequestException(
        `Esta solicitud ya fue procesada (estado: ${approval.estado})`,
      );
    }

    const efectoProvisional = await this.cargarEfectoProvisionalPendiente(
      this.prisma,
      id,
    );

    if (approval.tipoAprobacion === TipoAprobacion.REPROGRAMACION_CUOTA) {
      return this.rejectReprogramacionCuota(
        approval,
        efectoProvisional,
        rechazadoPorId,
        motivoRechazo,
      );
    }

    if (
      efectoProvisional &&
      approval.tipoAprobacion === TipoAprobacion.NUEVO_PRESTAMO
    ) {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.aprobacion.updateMany({
          where: {
            id,
            estado: EstadoAprobacion.PENDIENTE,
          },
          data: {
            estado: EstadoAprobacion.RECHAZADO,
            aprobadoPorId: rechazadoPorId || undefined,
            comentarios: motivoRechazo || 'Rechazado sin motivo especificado',
            revisadoEn: new Date(),
          },
        });

        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Esta solicitud ya fue tomada por otro usuario',
          );
        }

        await this.revertirPrestamoProvisional(
          tx,
          approval,
          efectoProvisional,
          rechazadoPorId,
          motivoRechazo,
        );
      });

      this.notificacionesGateway.broadcastAprobacionesActualizadas({
        accion: 'RECHAZAR',
        aprobacionId: id,
        tipoAprobacion: approval.tipoAprobacion,
      });
      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'RECHAZAR',
        prestamoId: approval.referenciaId,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({});

      return { success: true, message: 'Aprobación rechazada' };
    }

    // Verificar si es un gasto provisional con resultado de revisión específico
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;
    const esProvisional = data.esProvisional === true;
    const tieneResultadoRevision = resultadoRevision === 'RECHAZADO_CON_DEUDA' || resultadoRevision === 'RECHAZADO_CON_REINTEGRO';

    // Si es un gasto provisional, es obligatorio indicar resultadoRevision
    if (approval.tipoAprobacion === TipoAprobacion.GASTO && esProvisional && !tieneResultadoRevision) {
      throw new BadRequestException(
        'Debe indicar si el gasto provisional se rechaza con deuda o con reintegro.',
      );
    }

    if (esProvisional && tieneResultadoRevision) {
      // ======== NUEVO FLUJO: RECHAZAR GASTO PROVISIONAL ========
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.aprobacion.updateMany({
          where: {
            id,
            estado: EstadoAprobacion.PENDIENTE,
          },
          data: {
            estado: EstadoAprobacion.RECHAZADO,
            aprobadoPorId: rechazadoPorId || undefined,
            comentarios: motivoRechazo || 'Rechazado sin motivo especificado',
            revisadoEn: new Date(),
          },
        });

        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Esta solicitud ya fue tomada por otro usuario',
          );
        }

        const existingGasto = await tx.gasto.findUnique({
          where: { id: approval.referenciaId },
          include: {
            ruta: { select: { id: true, nombre: true } },
            caja: { select: { id: true, nombre: true } },
            cobrador: { select: { id: true, nombres: true, apellidos: true } },
          },
        });

        if (!existingGasto) {
          throw new NotFoundException('Gasto provisional no encontrado');
        }

        // Actualizar estado del gasto
        await tx.gasto.update({
          where: { id: existingGasto.id },
          data: {
            estadoAprobacion: EstadoAprobacion.RECHAZADO,
            resultadoRevisionGasto: resultadoRevision,
            esProvisional: false,
            aprobadoPorId: rechazadoPorId || undefined,
          },
        });

        if (resultadoRevision === 'RECHAZADO_CON_DEUDA') {
          // Reclasificar contable: de 1.6.1 (Gastos por legalizar) a 1.4.1 (Cuenta por cobrar a cobrador)
          // NO mueve caja (ya fue afectada al solicitar)
          await this.ledgerService.registrarAsiento(
            {
              referenceType: 'GASTO',
              referenceId: `RECHAZADO_DEUDA:${existingGasto.id}`,
              description: `Gasto provisional rechazado con deuda: ${data.descripcion}`,
              createdBy: rechazadoPorId || approval.solicitadoPorId,
              lines: [
                {
                  accountCode: '1.4.1', // Cuenta por cobrar a cobrador
                  debitAmount: Number(data.monto),
                  cajaId: existingGasto.cajaId, // Para atribución al cobrador
                },
                {
                  accountCode: '1.6.1', // Gastos por legalizar (cuenta puente)
                  creditAmount: Number(data.monto),
                },
              ],
            },
            tx,
          );
        } else if (resultadoRevision === 'RECHAZADO_CON_REINTEGRO') {
          // Reclasificar contable: de 1.6.1 (Gastos por legalizar) a 1.2.1 (Caja Ruta)
          // Restaura caja (reintegro del monto)
          await this.ledgerService.registrarAsiento(
            {
              referenceType: 'GASTO',
              referenceId: `RECHAZADO_REINTEGRO:${existingGasto.id}`,
              description: `Gasto provisional rechazado con reintegro: ${data.descripcion}`,
              createdBy: rechazadoPorId || approval.solicitadoPorId,
              lines: [
                {
                  accountCode: '1.2.1', // Caja Ruta
                  debitAmount: Number(data.monto),
                  cajaId: existingGasto.cajaId,
                  cajaDelta: Number(data.monto), // Ledger incrementa el saldo
                },
                {
                  accountCode: '1.6.1', // Gastos por legalizar (cuenta puente)
                  creditAmount: Number(data.monto),
                },
              ],
            },
            tx,
          );
        }
      });

      this.notificacionesGateway.broadcastAprobacionesActualizadas({
        accion: 'RECHAZAR',
        aprobacionId: id,
        tipoAprobacion: approval.tipoAprobacion,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({
        origen: 'GASTO',
      });

      return { success: true, message: 'Gasto provisional rechazado' };
    }

    const claimed = await this.prisma.aprobacion.updateMany({
      where: {
        id,
        estado: EstadoAprobacion.PENDIENTE,
      },
      data: {
        estado: EstadoAprobacion.RECHAZADO,
        aprobadoPorId: rechazadoPorId || undefined,
        comentarios: motivoRechazo || 'Rechazado sin motivo especificado',
        revisadoEn: new Date(),
      },
    });

    if (claimed.count !== 1) {
      throw new BadRequestException(
        'Esta solicitud ya fue tomada por otro usuario',
      );
    }

    if (approval.tipoAprobacion === TipoAprobacion.PRORROGA_PAGO) {
      try {
        const data =
          typeof approval.datosSolicitud === 'string'
            ? JSON.parse(approval.datosSolicitud)
            : approval.datosSolicitud;

        if (data?.tipo === 'GESTION_VENCIDA' && data?.prestamoId) {
          const nombreCliente =
            data?.clienteNombre || data?.cliente || 'Cliente';
          const numeroPrestamo = data?.numeroPrestamo || '';
          const decision = (data?.decision as string) || 'PRORROGAR';
          const fechaOriginal = data?.fechaVencimientoOriginal
            ? new Date(data.fechaVencimientoOriginal)
            : null;

          if (fechaOriginal && !isNaN(fechaOriginal.getTime())) {
            try {
              await this.prisma.prestamo.update({
                where: { id: data.prestamoId },
                data: { fechaFin: fechaOriginal },
              });
              this.notificacionesGateway.broadcastPrestamosActualizados({
                accion: 'REVERTIR_PRORROGA',
                prestamoId: data.prestamoId,
              });
            } catch {
              // no interrumpir
            }
          }
          await this.notifyCobradorGestionVencida({
            prestamoId: data.prestamoId,
            titulo: `Gestión de cuenta vencida rechazada — ${nombreCliente}${numeroPrestamo ? ` (${numeroPrestamo})` : ''}`,
            mensaje: `La solicitud de ${decision === 'DEJAR_QUIETO' ? 'dejar quieto' : 'prórroga'} fue rechazada.${motivoRechazo ? ` Motivo: ${motivoRechazo}` : ''}`,
            tipo: 'ADVERTENCIA',
            metadata: {
              tipo: 'GESTION_VENCIDA',
              decision,
              aprobado: false,
              motivoRechazo: motivoRechazo || undefined,
              rechazadoPorId,
              aprobacionId: approval.id,
            },
          });
        }
      } catch {
        // no interrumpir
      }
    }

    this.notificacionesGateway.broadcastAprobacionesActualizadas({
      accion: 'RECHAZAR',
      aprobacionId: id,
      tipoAprobacion: approval.tipoAprobacion,
    });

    // Operación específica por tipo de rechazo
    if (
      approval.tipoAprobacion === TipoAprobacion.NUEVO_PRESTAMO &&
      approval.referenciaId
    ) {
      try {
        const prestamoRechazado = await this.prisma.prestamo.update({
          where: { id: approval.referenciaId },
          data: {
            estadoAprobacion: EstadoAprobacion.RECHAZADO,
            aprobadoPorId: rechazadoPorId || undefined,
            eliminadoEn: new Date(), // Oculta el préstamo del listado
          },
          include: {
            producto: true,
          },
        });

        // CORRECCIÓN: Restablecer stock si el préstamo incluye un artículo físico (stock !== undefined)
        if (
          prestamoRechazado.productoId &&
          prestamoRechazado.producto?.stock !== undefined &&
          prestamoRechazado.producto?.stock !== null
        ) {
          try {
            await this.prisma.producto.update({
              where: { id: prestamoRechazado.productoId },
              data: { stock: { increment: 1 } },
            });
          } catch (e) {
            this.logger.error(
              `Error devolviendo stock al rechazar el préstamo ${approval.referenciaId}:`,
              e,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Error actualizando préstamo rechazado ${approval.referenciaId}:`,
          error,
        );
      }
    } else if (
      approval.tipoAprobacion === TipoAprobacion.NUEVO_CLIENTE &&
      approval.referenciaId
    ) {
      try {
        await this.prisma.cliente.update({
          where: { id: approval.referenciaId },
          data: {
            estadoAprobacion: EstadoAprobacion.RECHAZADO,
            aprobadoPorId: rechazadoPorId || undefined,
            eliminadoEn: new Date(), // Oculta el cliente del listado
          },
        });
      } catch (error) {
        this.logger.error(
          `Error actualizando cliente rechazado ${approval.referenciaId}:`,
          error,
        );
      }
    }

    let nombreRevisor: string | undefined;
    if (rechazadoPorId) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: rechazadoPorId },
        select: { nombres: true, apellidos: true },
      });
      nombreRevisor = usuario
        ? `${usuario.nombres} ${usuario.apellidos}`.trim()
        : undefined;
    }
    const datos = approval.datosSolicitud || {};
    // Notificar al solicitante que su solicitud fue rechazada (con metadata para no mostrar botones y mostrar quién rechazó)
    try {
      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Solicitud Rechazada',
        mensaje: motivoRechazo
          ? `Tu solicitud fue rechazada. Motivo: ${motivoRechazo}`
          : 'Tu solicitud fue rechazada por el administrador.',
        tipo: 'ALERTA',
        entidad: 'Aprobacion',
        entidadId: approval.id,
        metadata: {
          estadoAprobacion: 'RECHAZADO',
          revisadoPor: nombreRevisor,
          descSolicitud: datos.descripcion || datos.motivo,
        },
      });
    } catch {
      // No interrumpir si la notificación falla
    }

    this.logger.log(
      `Aprobación ${id} rechazada por ${rechazadoPorId || 'desconocido'}`,
    );

    return { success: true, message: 'Aprobación rechazada' };
  }

  private async approveNewClient(approval: any) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    // El cliente ya existe con estado PENDIENTE, lo actualizamos a APROBADO
    const cliente = await this.prisma.cliente.update({
      where: { id: approval.referenciaId },
      data: {
        estadoAprobacion: EstadoAprobacion.APROBADO,
        // Sincronizar otros campos por si hubo ediciones en la aprobación
        dni: data.dni,
        nombres: data.nombres,
        apellidos: data.apellidos,
        telefono: data.telefono,
        direccion: data.direccion,
        correo: data.correo,
        referencia: data.referencia,
        referencia1Nombre: data.referencia1Nombre,
        referencia1Telefono: data.referencia1Telefono,
        referencia2Nombre: data.referencia2Nombre,
        referencia2Telefono: data.referencia2Telefono,
      },
    });

    this.notificacionesGateway.broadcastClientesActualizados({
      accion: 'ACTUALIZAR',
      clienteId: cliente.id,
    });
  }

  private async approveNewLoan(
    approval: any,
    aprobadoPorId?: string,
    editedData?: any,
  ) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    // Usar datos editados si existen, de lo contrario los originales
    const finalData = editedData || data;

    // Ejecutar en una transacción
    await this.prisma.$transaction(async (tx) => {
      const isArticulo =
        String(finalData?.tipo || '').toUpperCase() === 'ARTICULO';
      const cuotaInicial =
        finalData.cuotaInicial !== undefined
          ? Number(finalData.cuotaInicial)
          : undefined;
      const tasaInteresNormalizada =
        finalData.porcentaje !== undefined
          ? Number(finalData.porcentaje)
          : finalData.tasaInteres !== undefined
            ? Number(finalData.tasaInteres)
            : undefined;
      const plazoMesesNormalizado =
        finalData.plazoMeses !== undefined ||
        finalData.plazo !== undefined ||
        finalData.plajeMeses !== undefined
          ? Number(finalData.plazoMeses || finalData.plazo || finalData.plajeMeses)
          : undefined;
      const tipoAmortizacionNormalizado = finalData.tipoAmortizacion
        ? (String(finalData.tipoAmortizacion).toUpperCase() as TipoAmortizacion)
        : undefined;

      const montoNormalizado = (() => {
        const monto =
          finalData.monto !== undefined ? Number(finalData.monto) : undefined;
        const valorArticulo =
          finalData.valorArticulo !== undefined
            ? Number(finalData.valorArticulo)
            : undefined;

        // Para ARTICULO: monto es "a financiar". Si solo llegó valorArticulo, derivamos con cuotaInicial.
        if (isArticulo) {
          if (monto !== undefined && !isNaN(monto)) return monto;
          if (valorArticulo !== undefined && !isNaN(valorArticulo)) {
            const ci = !isNaN(Number(cuotaInicial)) ? Number(cuotaInicial) : 0;
            return Math.max(0, valorArticulo - ci);
          }
          return undefined;
        }

        // Para EFECTIVO: monto representa el capital del préstamo
        if (monto !== undefined && !isNaN(monto)) return monto;
        if (valorArticulo !== undefined && !isNaN(valorArticulo))
          return valorArticulo;
        return undefined;
      })();

      // 0. Capturar estado previo para ajustes (Bug Gap 4 Fix)
      const prestamoPrevio = await tx.prestamo.findUnique({
        where: { id: approval.referenciaId },
        select: { estado: true, monto: true },
      });
      const fueActivo =
        prestamoPrevio?.estado === EstadoPrestamo.ACTIVO ||
        prestamoPrevio?.estado === EstadoPrestamo.EN_MORA;
      const montoOriginal = Number(prestamoPrevio?.monto || 0);

      // 1. Activar el préstamo (aplicando cambios si fueron editados)
      const prestamo = await tx.prestamo.update({
        where: { id: approval.referenciaId },
        data: {
          estado: EstadoPrestamo.ACTIVO,
          estadoAprobacion: EstadoAprobacion.APROBADO,
          aprobadoPorId: aprobadoPorId || undefined,
          // Actualizar campos financieros si cambiaron en la revisión
          monto: montoNormalizado,
          cantidadCuotas:
            finalData.cantidadCuotas || finalData.cuotas || finalData.numCuotas
              ? Number(
                  finalData.cantidadCuotas ||
                    finalData.cuotas ||
                    finalData.numCuotas,
                )
              : undefined,
          tasaInteres:
            tasaInteresNormalizada !== undefined && !Number.isNaN(tasaInteresNormalizada)
              ? tasaInteresNormalizada
              : undefined,
          frecuenciaPago: finalData.frecuenciaPago || undefined,
          plazoMeses:
            plazoMesesNormalizado !== undefined && !Number.isNaN(plazoMesesNormalizado)
              ? plazoMesesNormalizado
              : undefined,
          tipoAmortizacion: tipoAmortizacionNormalizado || undefined,
          cuotaInicial,
          precioVentaArticulo: isArticulo
            ? Number(
                finalData.valorArticulo ||
                  finalData.precioVentaArticulo ||
                  finalData.precioVenta ||
                  0,
              ) || undefined
            : undefined,
          costoArticulo: isArticulo
            ? Number(finalData.costoArticulo || finalData.costo || 0) || undefined
            : undefined,
          fechaInicio: finalData.fechaInicio
            ? new Date(finalData.fechaInicio)
            : undefined,
          notas: finalData.notas || undefined,
        },
        include: {
          cliente: {
            include: {
              asignacionesRuta: {
                where: { activa: true },
                take: 1,
              },
            },
          },
        },
      });

      // Si es crédito de ARTICULO, registrar la venta completa separando ingreso, costo e inventario.
      // Idempotente para evitar duplicación por reintentos.
      const cuotaInicialVal = Number(cuotaInicial || 0);
      if (isArticulo && !fueActivo) {
        const rutaId = prestamo.cliente?.asignacionesRuta?.[0]?.rutaId;
        const cajaRuta = rutaId
          ? await tx.caja.findFirst({
              where: { rutaId, tipo: 'RUTA', activa: true },
              select: { id: true, codigo: true },
            })
          : null;

        const cajaOficina = await tx.caja.findFirst({
          where: { activa: true, codigo: 'CAJA-OFICINA' },
          select: { id: true, codigo: true },
        });

        const cajaPrincipal = !cajaRuta
          ? await tx.caja.findFirst({
              where: {
                activa: true,
                OR: [{ codigo: 'CAJA-PRINCIPAL' }, { tipo: 'PRINCIPAL' }],
              },
              select: { id: true, codigo: true },
            })
          : null;

        const cajaDestino = cajaOficina || cajaRuta || cajaPrincipal;
        const cajaIdDestino = cajaDestino?.id;
        const asientoVentaExistente = await tx.journalEntry.findFirst({
          where: {
            referenceType: 'VENTA_ARTICULO' as any,
            referenceId: prestamo.id,
          },
          select: { id: true },
        });

        if (!asientoVentaExistente?.id) {
          if (cuotaInicialVal > 0 && !cajaIdDestino) {
            throw new BadRequestException(
              'No se encontró una caja activa para registrar la cuota inicial del artículo.',
            );
          }

          const yaExiste =
            cuotaInicialVal > 0 && cajaIdDestino
              ? await tx.transaccion.findFirst({
                  where: {
                    cajaId: cajaIdDestino,
                    tipo: TipoTransaccion.INGRESO,
                    tipoReferencia: 'CUOTA_INICIAL',
                    referenciaId: prestamo.id,
                  },
                  select: { id: true },
                })
              : null;

          if (cuotaInicialVal > 0 && cajaIdDestino && !yaExiste?.id) {
            await tx.transaccion.create({
              data: {
                numeroTransaccion: this.generarNumeroTransaccion('CI'),
                cajaId: cajaIdDestino,
                tipo: TipoTransaccion.INGRESO,
                monto: cuotaInicialVal,
                descripcion: `Cuota inicial crédito artículo #${prestamo.numeroPrestamo}`,
                creadoPorId: approval.solicitadoPorId,
                aprobadoPorId: aprobadoPorId || undefined,
                tipoReferencia: 'CUOTA_INICIAL',
                referenciaId: prestamo.id,
              },
            });
          }

          const precioVentaArticulo = Number(
            prestamo.precioVentaArticulo ||
              finalData.valorArticulo ||
              finalData.precioVentaArticulo ||
              Number(prestamo.monto || 0) + cuotaInicialVal,
          );
          const costoArticulo = Number(
            prestamo.costoArticulo ||
              finalData.costoArticulo ||
              finalData.costo ||
              0,
          );

          await this.ledgerService.registrarVentaArticulo(
            {
              prestamoId: prestamo.id,
              precioVenta: precioVentaArticulo,
              costoArticulo,
              montoFinanciado: Number(prestamo.monto || 0),
              cuotaInicial: cuotaInicialVal,
              cajaId: cajaIdDestino,
              accountCodeCaja:
                cajaDestino?.codigo === 'CAJA-BANCO' ? '1.1.2' : '1.1.1',
              createdBy: aprobadoPorId || approval.solicitadoPorId,
            },
            tx,
          );
        }
      }

      // Si se editaron datos financieros, es probable que las cuotas (instancias de Cuota) necesiten ser regeneradas
      // o ajustadas. Para simplificar, si hay cambios, recalculamos los montos.
      if (editedData) {
        if (fueActivo) {
          const cuotasConPago = await tx.cuota.count({
            where: {
              prestamoId: prestamo.id,
              OR: [
                { estado: EstadoCuota.PAGADA },
                { montoPagado: { gt: 0 } },
                { fechaPago: { not: null } },
              ],
            },
          });

          if (cuotasConPago > 0) {
            throw new BadRequestException(
              'No se pueden regenerar las cuotas de un crédito activo con pagos registrados. Use un flujo de modificación de condiciones sobre cuotas pendientes.',
            );
          }
        }

        // Recalcular componentes financieros del préstamo
        const montoFinanciar = Number(prestamo.monto);
        const tasaInteres = Number(prestamo.tasaInteres);
        const frecuencia = prestamo.frecuenciaPago;
        const cantidadCuotas = Number(
          prestamo.cantidadCuotas ||
            finalData.cantidadCuotas ||
            finalData.cuotas ||
            finalData.numCuotas ||
            0,
        );

        // Determinar plazo real para el cálculo de intereses
        let realPlazoMeses = Number(
          finalData.plazoMeses ||
            finalData.plajeMeses ||
            finalData.plazo ||
            prestamo.plazoMeses ||
            1,
        );

        // Sincronizar con la lógica de loans.service: derivar el plazo de las cuotas si existen
        if (cantidadCuotas > 0) {
          if (frecuencia === FrecuenciaPago.DIARIO)
            realPlazoMeses = cantidadCuotas / 30;
          else if (frecuencia === FrecuenciaPago.SEMANAL)
            realPlazoMeses = cantidadCuotas / 4;
          else if (frecuencia === FrecuenciaPago.QUINCENAL)
            realPlazoMeses = cantidadCuotas / 2;
          else if (frecuencia === FrecuenciaPago.MENSUAL)
            realPlazoMeses = cantidadCuotas;
        }

        const tipoAmort = prestamo.tipoAmortizacion;
        const fechaInicio = new Date(prestamo.fechaInicio);

        let interesTotal = 0;
        let cuotasData: any[] = [];

        if (tipoAmort === TipoAmortizacion.FRANCESA) {
          const amortizacion = calcularAmortizacionFrancesa(
            montoFinanciar,
            tasaInteres,
            cantidadCuotas,
            realPlazoMeses,
            frecuencia,
          );
          interesTotal = amortizacion.interesTotal;
          cuotasData = amortizacion.tabla;

        } else {
          // INTERES SIMPLE
          const mesesInteres = Math.max(1, realPlazoMeses);
          interesTotal = (montoFinanciar * tasaInteres * mesesInteres) / 100;
          const montoTotalSimple = montoFinanciar + interesTotal;
          const montoCuota =
            cantidadCuotas > 0 ? montoTotalSimple / cantidadCuotas : 0;
          const montoCapitalCuota =
            cantidadCuotas > 0 ? montoFinanciar / cantidadCuotas : 0;
          const montoInteresCuota =
            cantidadCuotas > 0 ? interesTotal / cantidadCuotas : 0;

          cuotasData = Array.from({ length: cantidadCuotas }, (_, i) => ({
            numeroCuota: i + 1,
            monto: montoCuota,
            montoCapital: montoCapitalCuota,
            montoInteres: montoInteresCuota,
          }));
        }

        // Actualizar el préstamo con el nuevo interés calculado y saldo
        await tx.prestamo.update({
          where: { id: prestamo.id },
          data: {
            interesTotal,
            saldoPendiente: montoFinanciar + interesTotal,
          },
        });

        // Eliminar cuotas viejas y crear nuevas para que coincidan con la edición
        await tx.cuota.deleteMany({ where: { prestamoId: prestamo.id } });

        // Función auxiliar para calcular fechas (duplicada brevemente aquí para el tx)
        const calcularFecha = (
          base: Date,
          num: number,
          freq: FrecuenciaPago,
        ) => {
          const d = new Date(base);
          if (freq === FrecuenciaPago.DIARIO) d.setDate(d.getDate() + num);
          else if (freq === FrecuenciaPago.SEMANAL)
            d.setDate(d.getDate() + num * 7);
          else if (freq === FrecuenciaPago.QUINCENAL)
            d.setDate(d.getDate() + num * 15);
          else if (freq === FrecuenciaPago.MENSUAL)
            d.setMonth(d.getMonth() + num);
          return d;
        };

        await tx.cuota.createMany({
          data: cuotasData.map((c) => ({
            prestamoId: prestamo.id,
            numeroCuota: c.numeroCuota,
            monto: c.monto,
            montoCapital: c.montoCapital,
            montoInteres: c.montoInteres,
            fechaVencimiento: calcularFecha(
              fechaInicio,
              c.numeroCuota,
              frecuencia,
            ),
            estado: EstadoCuota.PENDIENTE,
          })),
        });
      }

      const montoDesembolso = Number(prestamo.monto || 0);
      const isArticuloLoan =
        String(prestamo.tipoPrestamo || '').toUpperCase() === 'ARTICULO';

      if (!isArticuloLoan && !fueActivo) {
        const solicitante = await tx.usuario.findFirst({
          where: { id: approval.solicitadoPorId },
          select: { rol: true },
        });
        const rutaAsignadaId = prestamo?.cliente?.asignacionesRuta?.[0]?.rutaId;
        const cajaRuta =
          solicitante?.rol === RolUsuario.COBRADOR && rutaAsignadaId
            ? await tx.caja.findFirst({
                where: { activa: true, tipo: 'RUTA', rutaId: rutaAsignadaId },
                select: {
                  id: true,
                  codigo: true,
                  nombre: true,
                  saldoActual: true,
                },
              })
            : null;
        const cajaDesembolso =
          cajaRuta ??
          (await tx.caja.findFirst({
            where: { activa: true, codigo: 'CAJA-OFICINA' },
            select: { id: true, codigo: true, nombre: true, saldoActual: true },
          })) ??
          (await tx.caja.findFirst({
            where: {
              activa: true,
              OR: [{ codigo: 'CAJA-PRINCIPAL' }, { tipo: 'PRINCIPAL' }],
            },
            orderBy: { creadoEn: 'asc' },
            select: { id: true, codigo: true, nombre: true, saldoActual: true },
          }));

        if (!cajaDesembolso?.id) {
          throw new BadRequestException(
            'No existe una caja activa para desembolsar el préstamo.',
          );
        }

        const saldoCajaDesembolso = Number(cajaDesembolso.saldoActual || 0);
        if (montoDesembolso > 0 && saldoCajaDesembolso < montoDesembolso) {
          throw new BadRequestException(
            `Saldo insuficiente en la caja para desembolsar el préstamo. Caja: ${cajaDesembolso.nombre}. Saldo: ${saldoCajaDesembolso.toLocaleString('es-CO')}. Monto desembolso: ${montoDesembolso.toLocaleString('es-CO')}`,
          );
        }
        const accountCodeDesembolso =
          cajaRuta?.id === cajaDesembolso.id
            ? '1.2.1'
            : cajaDesembolso.codigo === 'CAJA-BANCO'
              ? '1.1.2'
              : '1.1.1';

        await tx.transaccion.create({
          data: {
            numeroTransaccion: this.generarNumeroTransaccion('T'),
            cajaId: cajaDesembolso.id,
            tipo: TipoTransaccion.EGRESO,
            monto: montoDesembolso,
            descripcion: `Desembolso de préstamo #${prestamo.numeroPrestamo} - Cliente: ${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
            creadoPorId: approval.solicitadoPorId,
            aprobadoPorId: aprobadoPorId || undefined,
            tipoReferencia: 'PRESTAMO',
            referenciaId: prestamo.id,
          },
        });

        await this.ledgerService.registrarAsiento(
          {
            referenceType: 'DESEMBOLSO',
            referenceId: prestamo.id,
            description: `Desembolso préstamo #${prestamo.numeroPrestamo} - $${montoDesembolso.toLocaleString('es-CO')}`,
            createdBy: aprobadoPorId || approval.solicitadoPorId,
            lines: [
              {
                accountCode: '1.3.1',
                debitAmount: montoDesembolso,
              },
              {
                accountCode: accountCodeDesembolso,
                creditAmount: montoDesembolso,
                cajaId: cajaDesembolso.id,
                cajaDelta: -montoDesembolso,
              },
            ],
          },
          tx,
        );
      }

      if (fueActivo && Number(prestamo.monto) !== montoOriginal) {
        await this.ledgerService.registrarAjusteCartera(
          {
            prestamoId: prestamo.id,
            montoDiferencia: Number(prestamo.monto) - montoOriginal,
            createdBy: aprobadoPorId || approval.solicitadoPorId,
          },
          tx,
        );
      }
    });

    try {
      // Notificar al solicitante que su préstamo fue aprobado
      const isArticulo =
        data.tipo === 'ARTICULO' || data.tipoPrestamo === 'ARTICULO';
      const label = isArticulo ? 'crédito por un artículo' : 'préstamo';

      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Solicitud Aprobada',
        mensaje: `Tu solicitud de ${label} para ${data.cliente || 'el cliente'} ha sido aprobada.`,
        tipo: 'EXITO',
        entidad: 'Prestamo',
        entidadId: approval.referenciaId,
        metadata: {
          estadoAprobacion: 'APROBADO',
          monto: data.monto,
          articulo: data.articulo,
        },
      });
    } catch (e) {
      this.logger.error('Error notifying loan approval:', e);
    }
    this.notificacionesGateway.broadcastPrestamosActualizados({
      accion: 'APROBAR',
      prestamoId: approval.referenciaId,
    });
    this.notificacionesGateway.broadcastDashboardsActualizados({});
  }

  private async approveExpense(approval: any, aprobadoPorId?: string) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    // Verificar si es un gasto provisional (ya existe el registro de Gasto)
    const esProvisional = data.esProvisional === true;

    // Procesar en una transacción de base de datos para asegurar consistencia
    const [gasto] = await this.prisma.$transaction(async (tx) => {
      if (esProvisional) {
        // ======== NUEVO FLUJO: GASTO PROVISIONAL ========
        // El gasto ya fue creado al solicitar, solo reclasificar de 1.6.1 a 4.1
        
        const existingGasto = await tx.gasto.findUnique({
          where: { id: approval.referenciaId },
          include: {
            ruta: { select: { id: true, nombre: true } },
            caja: { select: { id: true, nombre: true } },
            cobrador: { select: { id: true, nombres: true, apellidos: true } },
          },
        });

        if (!existingGasto) {
          throw new NotFoundException('Gasto provisional no encontrado');
        }

        // Validar que el gasto sea provisional y esté pendiente
        if (!existingGasto.esProvisional || existingGasto.estadoAprobacion !== EstadoAprobacion.PENDIENTE) {
          throw new BadRequestException('El gasto provisional ya fue procesado o no es un gasto provisional');
        }

        // Actualizar estado del gasto
        const updatedGasto = await tx.gasto.update({
          where: { id: existingGasto.id },
          data: {
            estadoAprobacion: EstadoAprobacion.APROBADO,
            resultadoRevisionGasto: 'APROBADO_OPERATIVO',
            esProvisional: false,
            aprobadoPorId: aprobadoPorId || undefined,
          },
          include: {
            ruta: { select: { id: true, nombre: true } },
            caja: { select: { id: true, nombre: true } },
            cobrador: { select: { id: true, nombres: true, apellidos: true } },
          },
        });

        // Reclasificar contable: de 1.6.1 (Gastos por legalizar) a 4.1 (Gastos de Ruta)
        // NO mueve caja otra vez (ya fue afectada al solicitar)
        await this.ledgerService.registrarAsiento(
          {
            referenceType: 'GASTO',
            referenceId: `APROBADO:${updatedGasto.id}`,
            description: `Gasto provisional aprobado: ${data.descripcion}`,
            createdBy: aprobadoPorId || approval.solicitadoPorId,
            lines: [
              {
                accountCode: '4.1', // Gastos de Ruta
                debitAmount: Number(data.monto),
              },
              {
                accountCode: '1.6.1', // Gastos por legalizar (cuenta puente)
                creditAmount: Number(data.monto),
              },
            ],
          },
          tx,
        );

        return [updatedGasto];
      } else {
        // ======== FLUJO ANTIGUO: GASTO SIN COMPROBANTE O PERSONAL ========
        // Crear el registro de Gasto y afectar caja
        
        const routeCash = await this.resolveActiveRouteCashContext(tx, {
          rutaId: data.rutaId,
          cajaId: data.cajaId,
        });
        const newGasto = await tx.gasto.create({
          data: {
            numeroGasto: `G${Date.now()}`,
            rutaId: routeCash.rutaId,
            cobradorId: routeCash.cobradorId,
            cajaId: routeCash.cajaId,
            tipoGasto: ({
              GASTO_OPERATIVO: 'OPERATIVO',
              OPERATIVO: 'OPERATIVO',
              TRANSPORTE: 'TRANSPORTE',
              OTRO: 'OTRO',
            }[data.tipoGasto] || 'OPERATIVO') as any,
            monto: data.monto,
            descripcion: data.descripcion,
            categoriaId: data.categoriaId || undefined,
            aprobadoPorId: aprobadoPorId || undefined,
            estadoAprobacion: EstadoAprobacion.APROBADO,
          },
          include: {
            ruta: { select: { id: true, nombre: true } },
            caja: { select: { id: true, nombre: true } },
            cobrador: { select: { id: true, nombres: true, apellidos: true } },
          },
        });

        // Registrar egreso contable: gasto del cobrador = DEUDA_COBRADOR (no afecta utilidad)
        await tx.transaccion.create({
          data: {
            numeroTransaccion: this.generarNumeroTransaccion('GTRX'),
            cajaId: routeCash.cajaId,
            tipo: TipoTransaccion.EGRESO,
            monto: data.monto,
            descripcion: `Gasto aprobado: ${data.descripcion}`,
            creadoPorId: approval.solicitadoPorId,
            aprobadoPorId: aprobadoPorId || undefined,
            tipoReferencia: 'GASTO',
            referenciaId: newGasto.id,
          },
        });

        // Asiento contable de Partida Doble (patrón correcto: Ledger mueve el saldo)
        // Débito: 4.1 Gastos de Ruta (consume patrimonio)
        // Crédito: 1.2.1 Caja Ruta (sale el efectivo) — cajaDelta real
        await this.ledgerService.registrarAsiento(
          {
            referenceType: 'GASTO',
            referenceId: newGasto.id,
            description: `Gasto aprobado: ${data.descripcion}`,
            createdBy: aprobadoPorId || approval.solicitadoPorId,
            lines: [
              {
                accountCode: '4.1',
                debitAmount: Number(data.monto),
              },
              {
                accountCode: '1.2.1',
                creditAmount: Number(data.monto),
                cajaId: routeCash.cajaId,
                cajaDelta: -Number(data.monto), // Ledger decrementa el saldo
              },
            ],
          },
          tx,
        );

        return [newGasto];
      }
    });

    try {
      // Notificar al solicitante que su gasto fue aprobado
      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Tu Gasto fue Aprobado',
        mensaje: esProvisional
          ? `Tu gasto provisional de ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} fue aprobado como gasto operativo.`
          : `Tu gasto de ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} fue aprobado.`,
        tipo: 'EXITO',
        entidad: 'GASTO',
        entidadId: gasto.id,
      });

      await this.notificacionesService.notifyCoordinator({
        titulo: 'Gasto Aprobado',
        mensaje: esProvisional
          ? `Se aprobó un gasto provisional de ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} en la ruta ${gasto.ruta?.nombre || 'Sin ruta'} (Caja: ${gasto.caja?.nombre || 'N/A'}) por ${gasto.cobrador ? gasto.cobrador.nombres + ' ' + gasto.cobrador.apellidos : 'usuario'}.`
          : `Se aprobó un gasto de ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} en la ruta ${gasto.ruta?.nombre || 'Sin ruta'} (Caja: ${gasto.caja?.nombre || 'N/A'}) por ${gasto.cobrador ? gasto.cobrador.nombres + ' ' + gasto.cobrador.apellidos : 'usuario'}.`,
        tipo: 'SISTEMA',
        entidad: 'GASTO',
        entidadId: gasto.id,
        metadata: {
          rutaId: gasto.ruta?.id,
          cajaId: gasto.caja?.id,
          cobradorId: gasto.cobrador?.id,
          esProvisional,
        },
      });
    } catch (error) {
      // No interrumpimos el flujo de aprobación si la notificación falla
    }
    this.notificacionesGateway.broadcastDashboardsActualizados({
      origen: 'GASTO',
    });
  }

  private async approveCashBase(approval: any, aprobadoPorId?: string) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    // Usar la caja de destino desde la aprobación o los datos de solicitud
    // No volver a buscar por rutaId porque podría usar la caja del cobrador en lugar de la caja del supervisor
    const cajaIdDestino = approval.referenciaId || data.cajaId;

    if (!cajaIdDestino) {
      throw new BadRequestException(
        'La solicitud de base no tiene una caja destino válida.',
      );
    }

    // Procesar en una transacción de base de datos
    const trx = await this.prisma.$transaction(async (tx) => {
      // 1. Buscar la Caja de Oficina como origen del capital operativo
      const cajaOficina = await tx.caja.findFirst({
        where: {
          codigo: 'CAJA-OFICINA',
          activa: true,
        },
      });

      if (!cajaOficina) {
        throw new BadRequestException(
          'No se encontró una Caja de Oficina activa para entregar la base.',
        );
      }

      // 2. Validar que la caja destino exista y esté activa
      const cajaDestino = await tx.caja.findFirst({
        where: {
          id: cajaIdDestino,
          activa: true,
        },
        select: {
          id: true,
          nombre: true,
          codigo: true,
          tipo: true,
          rutaId: true,
          responsableId: true,
        },
      });

      if (!cajaDestino?.id) {
        throw new NotFoundException(
          'La caja destino de la solicitud de base no existe o no está activa.',
        );
      }

      const monto = Number(data.monto);

      // 2. Verificar fondos en Caja de Oficina
      if (Number(cajaOficina.saldoActual) < monto) {
        throw new BadRequestException(
          `Fondos insuficientes en la Caja de Oficina (${cajaOficina.nombre}). Saldo actual: ${Number(
            cajaOficina.saldoActual,
          ).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
        );
      }

      // 3. Crear transacción de salida (EGRESO) desde la Caja de Oficina
      await tx.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion('TRX-OUT'),
          cajaId: cajaOficina.id,
          tipo: TipoTransaccion.EGRESO,
          monto: monto,
          descripcion: `Entrega de base operativa desde Caja de Oficina a ${cajaDestino.nombre} - Solicitud #${approval.id}`,
          creadoPorId: aprobadoPorId || approval.solicitadoPorId,
          aprobadoPorId: aprobadoPorId || undefined,
          tipoReferencia: 'SOLICITUD_BASE_EFECTIVO',
          referenciaId: approval.id,
        },
      });

      // 5. Crear transacción de ingreso a la caja de ruta
      const newTrx = await tx.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion('TRX-IN'),
          cajaId: cajaIdDestino,
          tipo: TipoTransaccion.INGRESO,
          monto: monto,
          descripcion: `Base de efectivo recibida - ${data.descripcion}`,
          creadoPorId: approval.solicitadoPorId,
          aprobadoPorId: aprobadoPorId || undefined,
          tipoReferencia: 'SOLICITUD_BASE_EFECTIVO',
          referenciaId: approval.id,
        },
      });

      // Asiento contable de Partida Doble (patrón correcto: Ledger mueve ambos saldos)
      const accountCodeOficina =
        cajaOficina.codigo === 'CAJA-BANCO' ? '1.1.2' : '1.1.1';
      await this.ledgerService.registrarAsiento(
        {
          referenceType: 'BASE',
          referenceId: approval.id,
          description: `Base efectivo: ${data.descripcion}`,
          createdBy: aprobadoPorId || approval.solicitadoPorId,
          lines: [
            {
              accountCode: '1.2.1',
              debitAmount: monto,
              cajaId: cajaIdDestino,
              cajaDelta: +monto, // Caja Ruta RECIBE
            },
            {
              accountCode: accountCodeOficina,
              creditAmount: monto,
              cajaId: cajaOficina.id,
              cajaDelta: -monto, // Caja de Oficina ENTREGA
            },
          ],
        },
        tx,
      );

      return newTrx;
    });

    try {
      await this.notificacionesService.notifyCoordinator({
        titulo: 'Base de Efectivo Aprobada',
        mensaje: `Se aprobó una base de efectivo por ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}.`,
        tipo: 'SISTEMA',
        entidad: 'TRANSACCION',
        entidadId: trx.id,
        metadata: {
          cajaId: cajaIdDestino,
          monto: data.monto,
          solicitadoPorId: approval.solicitadoPorId,
          aprobadoPorId: aprobadoPorId,
        },
      });
      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Tu Solicitud de Base fue Aprobada',
        mensaje: `Tu solicitud por ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} fue aprobada.`,
        tipo: 'EXITO',
        entidad: 'TRANSACCION',
        entidadId: trx.id,
        metadata: {
          cajaId: cajaIdDestino,
        },
      });
    } catch (error) {
      // No interrumpimos el flujo si la notificación falla
    }
    this.notificacionesGateway.broadcastDashboardsActualizados({
      origen: 'BASE',
    });
  }

  private async approvePaymentExtension(approval: any, aprobadoPorId?: string) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    // Calcular nueva fecha: si viene explicita la usamos, sino calculamos con diasGracia
    const fechaOriginal = data.fechaVencimientoOriginal
      ? new Date(data.fechaVencimientoOriginal)
      : new Date();

    let nuevaFecha: Date;
    if (data.nuevaFechaVencimiento) {
      nuevaFecha = new Date(data.nuevaFechaVencimiento);
    } else if (data.diasGracia) {
      nuevaFecha = new Date(
        Date.now() + Number(data.diasGracia) * 24 * 60 * 60 * 1000,
      );
    } else {
      // Por defecto 30 dias de gracia
      nuevaFecha = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Crear el registro de extension de pago
      const extension = await tx.extensionPago.create({
        data: {
          prestamoId: data.prestamoId,
          fechaVencimientoOriginal: fechaOriginal,
          nuevaFechaVencimiento: nuevaFecha,
          razon: data.comentarios || data.razon || 'Prorroga aprobada',
          aprobadoPorId: aprobadoPorId || approval.solicitadoPorId,
        },
      });

      // 2. Marcar TODAS las cuotas vencidas como PRORROGADA y actualizar su fecha
      await tx.cuota.updateMany({
        where: {
          prestamoId: data.prestamoId,
          estado: 'VENCIDA',
        },
        data: {
          estado: 'PRORROGADA',
          fechaVencimientoProrroga: nuevaFecha,
        },
      });

      // 3. Si hay una cuota específica, vincularla
      if (data.cuotaId) {
        await tx.cuota.update({
          where: { id: data.cuotaId },
          data: { extensionId: extension.id },
        });
      }

      // 4. Cambiar estado del préstamo a ACTIVO y actualizar fecha fin
      await tx.prestamo.update({
        where: { id: data.prestamoId },
        data: {
          fechaFin: nuevaFecha,
          estado: EstadoPrestamo.ACTIVO,
        },
      });
    });

    try {
      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Prórroga Aprobada',
        mensaje: `Tu solicitud de prórroga para el préstamo ${data.numeroPrestamo || ''} ha sido aprobada.`,
        tipo: 'EXITO',
        entidad: 'Prestamo',
        entidadId: data.prestamoId,
      });

      await this.notifyCobradorGestionVencida({
        prestamoId: data.prestamoId,
        titulo: `Prórroga aprobada — ${data.clienteNombre || 'Cliente'}`,
        mensaje: `La solicitud de prórroga para el préstamo ${data.numeroPrestamo || ''} fue aprobada. Nueva fecha: ${nuevaFecha.toLocaleDateString()}`,
        tipo: 'EXITO',
        metadata: {
          tipo: 'GESTION_VENCIDA',
          decision: 'PRORROGAR',
          aprobado: true,
          aprobacionId: approval.id,
        },
      });
    } catch (e) {
      this.logger.error('Error notifying extension approval:', e);
    }

    this.notificacionesGateway.broadcastPrestamosActualizados({
      accion: 'APROBAR_PRORROGA',
      prestamoId: data.prestamoId,
    });
  }

  private async approveLoanLoss(
    approval: any,
    aprobadoPorId?: string,
    editedData?: any,
  ) {
    const prestamoId = approval.referenciaId;

    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    });

    if (!prestamo) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    // Realizar operaciones en transacción
    await this.prisma.$transaction(async (tx) => {
      // 1. Marcar préstamo como PERDIDA
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: {
          estado: EstadoPrestamo.PERDIDA,
          eliminadoEn: new Date(),
        },
      });

      // 2. Marcar otras aprobaciones pendientes de este préstamo como RECHAZADAS
      await tx.aprobacion.updateMany({
        where: {
          referenciaId: prestamoId,
          estado: EstadoAprobacion.PENDIENTE,
          id: { not: approval.id },
        },
        data: {
          estado: EstadoAprobacion.RECHAZADO,
          comentarios:
            'Archivado automáticamente por aprobación de baja por pérdida',
          revisadoEn: new Date(),
        },
      });

      // 3. Registrar castigo de cartera en el Ledger (Bug Gap 2 Fix)
      const saldoCapital = Number(prestamo.saldoPendiente);
      if (saldoCapital > 0) {
        await this.ledgerService.registrarBajaCartera(
          {
            prestamoId: prestamo.id,
            monto: saldoCapital,
            createdBy: aprobadoPorId || approval.solicitadoPorId,
          },
          tx,
        );
      }
    });

    try {
      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Baja por Pérdida Aprobada',
        mensaje: `La solicitud de baja por pérdida para el préstamo ${prestamo.numeroPrestamo} ha sido aprobada.`,
        tipo: 'EXITO',
        entidad: 'Prestamo',
        entidadId: prestamoId,
      });

      await this.notifyCobradorGestionVencida({
        prestamoId,
        titulo: `Baja por pérdida aprobada — ${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
        mensaje: `La solicitud de baja por pérdida para el préstamo ${prestamo.numeroPrestamo} fue aprobada.`,
        tipo: 'ALERTA',
        metadata: {
          tipo: 'GESTION_VENCIDA',
          decision: 'CASTIGAR',
          aprobado: true,
          aprobacionId: approval.id,
        },
      });
    } catch (e) {
      this.logger.error('Error notifying loan loss approval:', e);
    }

    this.notificacionesGateway.broadcastPrestamosActualizados({
      accion: 'ARCHIVAR',
      prestamoId,
    });
    this.notificacionesGateway.broadcastClientesActualizados({
      accion: 'ACTUALIZAR',
      clienteId: prestamo.clienteId,
    });
  }
}
