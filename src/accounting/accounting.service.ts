import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoCuota,
  EstadoPrestamo,
  EstadoAprobacion,
  Prisma,
  TipoAprobacion,
  TipoCaja,
  TipoTransaccion,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import {
  calculateDateRange,
  formatBogotaOffsetIso,
  getBogotaDayKey,
  getBogotaStartEndOfDay,
  getBogotaStartEndOfDayFromKey,
} from '../utils/date-utils';
import {
  generarExcelContable,
  generarPDFContable,
  CajaRow,
  TransaccionRow,
} from '../templates/exports/reporte-contable.template';
import {
  generarExcelGastos,
  generarPDFGastos,
  GastoRow,
  GastosTotales,
} from '../templates/exports/gastos-export.template';
import { LedgerService, ReferenceTypeContable } from './ledger.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacionesService: NotificacionesService,
    private readonly notificacionesGateway: NotificacionesGateway,
    private readonly ledgerService: LedgerService,
  ) {}

  // Codigos reservados para las cajas que no se pueden eliminar
  private static readonly CODIGOS_DEFAULT = [
    'CAJA-PRINCIPAL',
    'CAJA-OFICINA',
    'CAJA-BANCO',
  ] as const;

  async onModuleInit() {
    await this.ensureCajasDefault();
  }

  private buildCodigoCajaRuta(codigoRuta: string) {
    const base = `CAJA-${codigoRuta}`;
    if (base.length <= 20) return base;
    // 20 chars máx: "CAJA-" (5) + 10 + "-" (1) + 4 = 20
    const start = codigoRuta.slice(0, 10);
    const end = codigoRuta.slice(-4);
    return `CAJA-${start}-${end}`;
  }

  private generarNumeroTransaccion(prefix = 'TRX') {
    return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  /**
   * Mapea una fila de Prisma (Transaccion + includes) al DTO de respuesta.
   * Centraliza la lógica duplicada entre getTransacciones y getTransaccionById.
   */
  private mapTransaccionRow(t: any) {
    return {
      id: t.id,
      numero: t.numeroTransaccion,
      fecha: formatBogotaOffsetIso(t.fechaTransaccion),
      tipo: t.tipo,
      monto: Number(t.monto),
      descripcion: t.descripcion,
      caja: t.caja.nombre,
      cajaId: t.cajaId,
      cajaOrigenId: t.cajaOrigenId ?? undefined,
      tipoReferencia: t.tipoReferencia ?? undefined,
      referenciaId: t.referenciaId ?? undefined,
      responsable: `${t.creadoPor.nombres} ${t.creadoPor.apellidos}`,
      estado: 'APROBADO' as const,
      origen:
        t.caja.tipo === 'RUTA' && !t.caja.rutaId
          ? 'SUPERVISOR'
          : t.caja.tipo === 'RUTA'
            ? 'COBRADOR'
            : 'EMPRESA',
      categoria: t.tipoReferencia || 'GENERAL',
      rutaId: t.caja.rutaId,
      cajaSaldo: Number(t.caja.saldoActual),
    };
  }

  async asegurarCajaRuta(rutaId: string) {
    const ruta = await this.prisma.ruta.findFirst({
      where: { id: rutaId, eliminadoEn: null },
      select: { id: true, nombre: true, codigo: true, cobradorId: true },
    });

    if (!ruta) {
      throw new NotFoundException('Ruta no encontrada');
    }

    if (!ruta.cobradorId) {
      throw new BadRequestException('La ruta no tiene cobrador asignado');
    }

    const existente = await this.prisma.caja.findFirst({
      where: { rutaId: ruta.id, tipo: 'RUTA', activa: true },
      include: {
        responsable: { select: { id: true, nombres: true, apellidos: true } },
        ruta: { select: { id: true, nombre: true, codigo: true } },
      },
    });

    if (existente?.id) {
      return existente;
    }

    const codigoCaja = this.buildCodigoCajaRuta(ruta.codigo);
    const nombreCaja = `Caja ${ruta.nombre}`;

    const creada = await this.prisma.caja.create({
      data: {
        codigo: codigoCaja,
        nombre: nombreCaja,
        tipo: 'RUTA',
        rutaId: ruta.id,
        responsableId: ruta.cobradorId,
        saldoActual: 0,
        activa: true,
      },
      include: {
        responsable: { select: { id: true, nombres: true, apellidos: true } },
        ruta: { select: { id: true, nombre: true, codigo: true } },
      },
    });

    return creada;
  }

  async asegurarCajaSupervisor(supervisorId: string) {
    const supervisor = await this.prisma.usuario.findUnique({
      where: { id: supervisorId },
      select: { id: true, nombres: true, apellidos: true, rol: true },
    });

    if (!supervisor?.id) {
      throw new NotFoundException('Supervisor no encontrado');
    }

    if (supervisor.rol !== 'SUPERVISOR') {
      throw new BadRequestException('El usuario no es un supervisor');
    }

    const existente = await this.prisma.caja.findFirst({
      where: {
        tipo: 'RUTA',
        activa: true,
        responsableId: supervisorId,
        rutaId: null,
      },
      include: {
        responsable: { select: { id: true, nombres: true, apellidos: true } },
      },
    });

    if (existente?.id) {
      return existente;
    }

    const nombreSupervisor = `${supervisor.nombres} ${supervisor.apellidos}`.trim();
    const codigoCaja = `CAJA-SUP-${supervisorId.slice(0, 8).toUpperCase()}`;
    const nombreCaja = `Caja Supervisor - ${nombreSupervisor}`;

    const creada = await this.prisma.caja.create({
      data: {
        codigo: codigoCaja,
        nombre: nombreCaja,
        tipo: 'RUTA',
        rutaId: null,
        responsableId: supervisorId,
        saldoActual: 0,
        activa: true,
      },
      include: {
        responsable: { select: { id: true, nombres: true, apellidos: true } },
      },
    });

    this.logger.log(
      `Caja de supervisor creada: ${nombreCaja} (${codigoCaja}) para ${nombreSupervisor}`,
    );

    return creada;
  }

  private async asegurarCajasSupervisoresActivos() {
    const supervisores = await this.prisma.usuario.findMany({
      where: {
        rol: 'SUPERVISOR',
        estado: 'ACTIVO',
        eliminadoEn: null,
      },
      select: {
        id: true,
      },
    });

    for (const supervisor of supervisores) {
      await this.asegurarCajaSupervisor(supervisor.id);
    }
  }

  private async resolveActiveRouteCashContext(
    rutaId: string,
    actor?: { id?: string; rol?: string } | null,
  ) {
    const rol = String(actor?.rol || '').toUpperCase();

    const ruta = await this.prisma.ruta.findFirst({
      where: {
        id: rutaId,
        eliminadoEn: null,
        ...(rol === 'SUPERVISOR' && actor?.id ? { supervisorId: actor.id } : {}),
      },
      select: {
        id: true,
        cobradorId: true,
        supervisorId: true,
      },
    });

    if (!ruta?.id) {
      throw new NotFoundException('Ruta no encontrada');
    }

    if (rol === 'SUPERVISOR' && actor?.id && ruta.supervisorId !== actor.id) {
      throw new ForbiddenException(
        'No tienes permiso para realizar operaciones en esta ruta supervisada.',
      );
    }

    if (!ruta.cobradorId) {
      throw new BadRequestException('La ruta no tiene cobrador asignado');
    }

    // Si es supervisor, usar su caja propia
    if (rol === 'SUPERVISOR' && actor?.id) {
      const cajaSupervisor = await this.asegurarCajaSupervisor(actor.id);

      return {
        rutaId: ruta.id,
        cobradorId: actor.id,
        cajaRuta: cajaSupervisor,
      };
    }

    const cajaRuta = await this.prisma.caja.findFirst({
      where: {
        rutaId: ruta.id,
        tipo: 'RUTA',
        activa: true,
      },
    });

    if (!cajaRuta) {
      throw new NotFoundException('Caja de ruta no encontrada');
    }

    return {
      rutaId: ruta.id,
      cobradorId: ruta.cobradorId,
      cajaRuta,
    };
  }

  /**
   * Crea las cajas por defecto si no existen.
   * - Caja Principal: recibe consolidaciones de rutas.
   * - Caja de Oficina: para movimientos internos de la oficina.
   * El responsable inicial es el primer ADMIN o SUPER_ADMINISTRADOR activo.
   * La asignacion del responsable puede cambiarse en cualquier momento.
   */
  private async ensureCajasDefault() {
    try {
      const adminUser = await this.prisma.usuario.findFirst({
        where: {
          rol: { in: ['SUPER_ADMINISTRADOR', 'ADMIN'] },
          estado: 'ACTIVO',
          eliminadoEn: null,
        },
        orderBy: { creadoEn: 'asc' },
        select: { id: true },
      });

      if (!adminUser) {
        this.logger.warn(
          'No hay un usuario administrador activo para asignar las cajas por defecto. Se reintentara cuando exista uno.',
        );
        return;
      }

      const cajasDefault = [
        {
          codigo: 'CAJA-PRINCIPAL',
          nombre: 'Caja Principal',
          tipo: 'PRINCIPAL' as const,
        },
        {
          codigo: 'CAJA-OFICINA',
          nombre: 'Caja de Oficina',
          tipo: 'PRINCIPAL' as const,
        },
        {
          codigo: 'CAJA-BANCO',
          nombre: 'Caja Banco',
          tipo: 'PRINCIPAL' as const,
        },
      ];

      for (const def of cajasDefault) {
        const existe = await this.prisma.caja.findUnique({
          where: { codigo: def.codigo },
        });
        if (!existe) {
          await this.prisma.caja.create({
            data: {
              codigo: def.codigo,
              nombre: def.nombre,
              tipo: def.tipo,
              responsableId: adminUser.id,
              saldoActual: 0,
              activa: true,
            },
          });
          this.logger.log(
            `Caja por defecto creada: ${def.nombre} (${def.codigo})`,
          );
        } else {
          // Si ya existe, la normalizamos para garantizar que aparezca en listados (getCajas filtra activa=true)
          // y que tenga propiedades coherentes.
          if (
            !existe.activa ||
            existe.nombre !== def.nombre ||
            existe.tipo !== def.tipo
          ) {
            await this.prisma.caja.update({
              where: { id: existe.id },
              data: {
                nombre: def.nombre,
                tipo: def.tipo,
                activa: true,
              },
            });
            this.logger.log(
              `Caja por defecto normalizada: ${def.nombre} (${def.codigo})`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error al verificar cajas por defecto: ${err.message}`);
    }
  }

  // =====================
  // CAJAS
  // =====================

  async getRutaCerradaHoy(rutaId: string) {
    // Aseguramos cajas por defecto también de forma lazy.
    await this.ensureCajasDefault();

    const cajaRuta = await this.prisma.caja.findFirst({
      where: { rutaId, tipo: 'RUTA', activa: true },
      select: { id: true },
    });

    if (!cajaRuta?.id) {
      throw new NotFoundException('Caja de ruta no encontrada');
    }

    const { startDate: inicioHoy, endDate: finHoy } = getBogotaStartEndOfDay(
      new Date(),
    );

    const cierre = await this.prisma.transaccion.findFirst({
      where: {
        cajaId: cajaRuta.id,
        tipoReferencia: 'CIERRE_RUTA',
        fechaTransaccion: { gte: inicioHoy, lte: finHoy },
      },
      select: { id: true, fechaTransaccion: true },
    });

    return {
      rutaId,
      cerradaHoy: !!cierre?.id,
      cierreId: cierre?.id || null,
      fechaCierre: cierre?.fechaTransaccion
        ? formatBogotaOffsetIso(cierre.fechaTransaccion)
        : null,
    };
  }

  async getCajas() {
    // Aseguramos cajas por defecto también de forma lazy.
    // onModuleInit puede no crearlas si al momento de arrancar no existía un ADMIN/SUPER_ADMIN activo.
    await this.ensureCajasDefault();
    await this.asegurarCajasSupervisoresActivos();
    const cajas = await this.prisma.caja.findMany({
      where: { activa: true },
      include: {
        responsable: {
          select: { id: true, nombres: true, apellidos: true },
        },
        ruta: {
          select: { id: true, nombre: true, codigo: true },
        },
        _count: {
          select: { transacciones: true },
        },
      },
      orderBy: { creadoEn: 'desc' },
    });

    const { startDate: fechaInicio, endDate: fechaFin } =
      getBogotaStartEndOfDay(new Date());

    const cajasConSaldo = await Promise.all(
      cajas.map(async (caja) => {
        let saldoCalculado = Number(caja.saldoActual);

        // Para cajas RUTA, el saldo debe reflejar el libro contable real (saldoActual).
        // El cálculo "recaudo - gastos" del día ignora TRANSFERENCIA (ej. RECOLECCION),
        // lo que hacía que al recolectar no se viera descontado en Gestión Contable.
        if (caja.tipo === 'RUTA') {
          saldoCalculado = Number(caja.saldoActual);
        }

        // Si es caja de supervisor (rutaId null), obtener rutas supervisadas
        let rutasSupervisadas: any[] = [];
        if (caja.tipo === 'RUTA' && !caja.rutaId && caja.responsableId) {
          rutasSupervisadas = await this.prisma.ruta.findMany({
            where: {
              supervisorId: caja.responsableId,
              eliminadoEn: null,
            },
            select: {
              id: true,
              nombre: true,
              codigo: true,
            },
          });
        }

        return {
          id: caja.id,
          codigo: caja.codigo,
          nombre: caja.nombre,
          tipo: caja.tipo,
          rutaId: caja.rutaId,
          rutaNombre: caja.ruta?.nombre || null,
          responsable: caja.responsable
            ? `${caja.responsable.nombres} ${caja.responsable.apellidos}`
            : 'Sin asignar',
          responsableId: caja.responsableId,
          saldo: saldoCalculado,
          saldoMinimo: Number(caja.saldoMinimo),
          saldoMaximo: Number(caja.saldoMaximo),
          estado: caja.activa ? 'ABIERTA' : 'CERRADA',
          transacciones: caja._count.transacciones,
          ultimaActualizacion: formatBogotaOffsetIso(caja.actualizadoEn),
          rutasSupervisadas,
        };
      }),
    );

    return cajasConSaldo;
  }

  async getCajaById(id: string) {
    // Mantener consistencia con getCajas(): garantizar defaults antes de responder.
    await this.ensureCajasDefault();
    const caja = await this.prisma.caja.findFirst({
      where: { id, activa: true },
      include: {
        responsable: {
          select: { id: true, nombres: true, apellidos: true },
        },
        ruta: true,
        transacciones: {
          take: 20,
          orderBy: { fechaTransaccion: 'desc' },
          include: {
            creadoPor: { select: { nombres: true, apellidos: true } },
          },
        },
      },
    });

    if (!caja) {
      throw new NotFoundException('Caja no encontrada');
    }

    return {
      id: caja.id,
      codigo: caja.codigo,
      nombre: caja.nombre,
      tipo: caja.tipo,
      rutaId: caja.rutaId,
      rutaNombre: caja.ruta?.nombre || null,
      responsable: caja.responsable
        ? `${caja.responsable.nombres} ${caja.responsable.apellidos}`
        : 'Sin asignar',
      responsableId: caja.responsableId,
      saldo: Number(caja.saldoActual) || 0,
      saldoMinimo: Number(caja.saldoMinimo) || 0,
      saldoMaximo: Number(caja.saldoMaximo) || 0,
      estado: caja.activa ? 'ABIERTA' : 'CERRADA',
      ultimaActualizacion: formatBogotaOffsetIso(caja.actualizadoEn),
      transacciones: caja.transacciones,
    };
  }

  // =====================
  // GASTOS (SOLICITUD)
  // =====================

  async registrarGasto(data: {
    descripcion: string;
    monto: number;
    rutaId: string;
    cobradorId: string;
    solicitadoPorId: string;
    tipoAprobacion: TipoAprobacion;
    categoriaId?: string;
    esPersonal?: boolean;
    comprobanteUrl?: string;
    fotoRecibo?: string;
    idempotencyKey?: string;
  }) {
    const idempotencyKey = data.idempotencyKey?.toString().trim() || undefined;

    if (idempotencyKey) {
      const gastoExistente = await this.prisma.gasto.findFirst({
        where: { idempotencyKey },
      });
      if (gastoExistente) {
        return {
          success: true,
          gastoId: gastoExistente.id,
          idempotentReplay: true,
          message: 'Gasto ya registrado previamente',
        };
      }

      const aprobacionExistente = await this.prisma.aprobacion.findFirst({
        where: { idempotencyKey },
        select: { id: true, estado: true },
      });
      if (aprobacionExistente) {
        return {
          success: true,
          approvalId: aprobacionExistente.id,
          idempotentReplay: true,
          message: 'Solicitud de gasto ya enviada previamente',
        };
      }
    }

    // Buscar el solicitante para obtener su rol
    const solicitante = await this.prisma.usuario.findUnique({
      where: { id: data.solicitadoPorId },
      select: { id: true, nombres: true, apellidos: true, rol: true },
    });

    const actor = solicitante
      ? { id: solicitante.id, rol: solicitante.rol }
      : undefined;

    const { rutaId, cobradorId, cajaRuta } =
      await this.resolveActiveRouteCashContext(data.rutaId, actor);

    const nombreSolicitante = solicitante
      ? `${solicitante.nombres} ${solicitante.apellidos}`.trim()
      : 'Cobrador';

    const comprobanteGasto = data.comprobanteUrl || data.fotoRecibo || '';

    const crearAprobacionGasto = async (requiereComprobante: boolean) => {
      const aprobacion = await this.prisma.aprobacion.create({
        data: {
          tipoAprobacion: data.tipoAprobacion,
          idempotencyKey,
          referenciaId: cajaRuta.id,
          tablaReferencia: 'Gasto',
          solicitadoPorId: data.solicitadoPorId,
          estado: EstadoAprobacion.PENDIENTE,
          datosSolicitud: {
            rutaId,
            cobradorId,
            cajaId: cajaRuta.id,
            tipoGasto: data.esPersonal ? 'OTRO' : 'OPERATIVO',
            monto: data.monto,
            descripcion: data.descripcion,
            categoriaId: data.categoriaId,
            fotoRecibo: comprobanteGasto || undefined,
            requiereComprobante,
            idempotencyKey: idempotencyKey || null,
          },
          montoSolicitud: data.monto,
        },
      });

      await this.notificacionesService.notifyApprovers({
        titulo: requiereComprobante
          ? 'Gasto Requiere Comprobante'
          : 'Nuevo Gasto Personal Requiere Aprobación',
        mensaje: `${nombreSolicitante} ha solicitado ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} como ${data.esPersonal ? 'gasto personal' : 'gasto operativo'}.`,
        tipo: 'GASTO',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
          tipoAprobacion: 'GASTO',
          rutaId,
          cajaId: cajaRuta.id,
          cobradorId,
          monto: data.monto,
          descripcion: data.descripcion,
          solicitadoPor: nombreSolicitante,
          categoriaId: data.categoriaId,
          requiereComprobante,
        },
      });

      try {
        await this.notificacionesService.create({
          usuarioId: data.solicitadoPorId,
          titulo: 'Solicitud enviada',
          mensaje: requiereComprobante
            ? 'Tu gasto fue enviado a revisión porque requiere comprobante antes de afectar la caja.'
            : 'Tu solicitud de gasto personal fue enviada con éxito (pendiente).',
          tipo: 'INFORMATIVO',
          entidad: 'Aprobacion',
          entidadId: aprobacion.id,
          metadata: {
            tipoAprobacion: data.tipoAprobacion,
            rutaId,
            cajaId: cajaRuta.id,
          },
        });
      } catch {}

      this.notificacionesGateway.broadcastDashboardsActualizados({
        origen: 'GASTO',
        rutaId,
      });

      return {
        success: true,
        message: requiereComprobante
          ? 'Gasto enviado a revisión: se requiere comprobante antes de afectar la caja'
          : 'Gasto registrado y enviado para aprobación del coordinador',
        approvalId: aprobacion.id,
      };
    };

    // Solo gastos personales sin comprobante no afectan caja hasta aprobación.
    // Gastos operativos de ruta siempre afectan caja inmediatamente como provisionales.
    if (data.esPersonal) {
      return crearAprobacionGasto(!comprobanteGasto);
    }

    // ======== 1. GASTO OPERATIVO (GASTO PROVISIONAL) ========
    // Afecta caja inmediatamente, pendiente de aprobación para reclasificación contable
    if (!data.esPersonal) {
      try {
        const { gastoId, approvalId } = await this.prisma.$transaction(async (tx) => {
          // 1. Crear Gasto como PROVISIONAL (PENDIENTE de aprobación)
          const newGasto = await tx.gasto.create({
            data: {
              numeroGasto: `G${Date.now()}-${randomUUID().slice(0, 8)}`,
              idempotencyKey,
              rutaId,
              cobradorId,
              cajaId: cajaRuta.id,
              tipoGasto: 'OPERATIVO',
              monto: data.monto,
              descripcion: data.descripcion,
              fotoRecibo: comprobanteGasto,
              categoriaId: data.categoriaId || undefined,
              estadoAprobacion: EstadoAprobacion.PENDIENTE,
              esProvisional: true,
              aplicadoEnCaja: true,
            },
          });

          // 2. Crear Aprobación pendiente
          const aprobacion = await tx.aprobacion.create({
            data: {
              tipoAprobacion: data.tipoAprobacion ?? TipoAprobacion.GASTO,
              idempotencyKey,
              referenciaId: newGasto.id,
              tablaReferencia: 'Gasto',
              solicitadoPorId: data.solicitadoPorId,
              estado: EstadoAprobacion.PENDIENTE,
              datosSolicitud: {
                rutaId,
                cobradorId,
                cajaId: cajaRuta.id,
                tipoGasto: 'OPERATIVO',
                monto: data.monto,
                descripcion: data.descripcion,
                categoriaId: data.categoriaId,
                fotoRecibo: comprobanteGasto,
                esProvisional: true,
                idempotencyKey: idempotencyKey || null,
              },
              montoSolicitud: data.monto,
            },
          });

          // 3. Registrar egreso en caja (el dinero ya salió de la caja del cobrador)
          await tx.transaccion.create({
            data: {
              numeroTransaccion: this.generarNumeroTransaccion('GTRX'),
              idempotencyKey: idempotencyKey
                ? `${idempotencyKey}:trx`
                : undefined,
              cajaId: cajaRuta.id,
              tipo: TipoTransaccion.EGRESO,
              monto: data.monto,
              descripcion: `Gasto provisional: ${data.descripcion}`,
              creadoPorId: data.solicitadoPorId,
              tipoReferencia: 'GASTO_PROVISIONAL',
              referenciaId: `PROVISIONAL:${newGasto.id}`,
            },
          });

          // 3.5. Validar cuentas contables requeridas antes del asiento
          const cuentasRequeridas = ['1.6.1', '1.2.1']

          const cuentasExistentes = await (tx as any).account.findMany({
            where: {
              code: { in: cuentasRequeridas },
              isActive: true,
            },
            select: { code: true },
          })

          const existentes = new Set(cuentasExistentes.map((c: any) => c.code))
          const faltantes = cuentasRequeridas.filter((code) => !existentes.has(code))

          if (faltantes.length > 0) {
            throw new BadRequestException(
              `Faltan cuentas contables requeridas para registrar gasto provisional: ${faltantes.join(', ')}`,
            )
          }

          // 4. Registrar asiento contable en cuenta puente (Gastos por legalizar)
          await this.ledgerService.registrarAsiento(
            {
              referenceType: 'GASTO',
              referenceId: `PROVISIONAL:${newGasto.id}`,
              description: `Gasto provisional: ${data.descripcion}`,
              createdBy: data.solicitadoPorId,
              lines: [
                {
                  accountCode: '1.6.1', // Gastos por legalizar (cuenta puente)
                  debitAmount: Number(data.monto),
                },
                {
                  accountCode: '1.2.1', // Caja Ruta
                  creditAmount: Number(data.monto),
                  cajaId: cajaRuta.id,
                  cajaDelta: -Number(data.monto),
                },
              ],
            },
            tx,
          );

          return { gastoId: newGasto.id, approvalId: aprobacion.id };
        });

        // Notificar aprobadores (no bloqueante)
        try {
          await this.notificacionesService.notifyApprovers({
            titulo: 'Nuevo Gasto Provisional Requiere Aprobación',
            mensaje: `${nombreSolicitante} ha registrado un gasto provisional por ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}. La caja ya fue afectada.`,
            tipo: 'GASTO',
            entidad: 'Aprobacion',
            entidadId: approvalId,
            metadata: {
              tipoAprobacion: 'GASTO',
              rutaId,
              cajaId: cajaRuta.id,
              cobradorId,
              monto: data.monto,
              descripcion: data.descripcion,
              solicitadoPor: nombreSolicitante,
              categoriaId: data.categoriaId,
              esProvisional: true,
            },
          });
        } catch (notificationError) {
          this.logger.warn(
            `[GASTO_PROVISIONAL] Gasto registrado, pero falló notifyApprovers: ${
              notificationError instanceof Error
                ? notificationError.message
                : JSON.stringify(notificationError)
            }`,
          );
        }

        try {
          this.notificacionesGateway.broadcastDashboardsActualizados({
            origen: 'GASTO',
            rutaId,
          });
        } catch (gatewayError) {
          this.logger.warn(
            `[GASTO_PROVISIONAL] Gasto registrado, pero falló broadcastDashboardsActualizados: ${
              gatewayError instanceof Error
                ? gatewayError.message
                : JSON.stringify(gatewayError)
            }`,
          );
        }

        // Notificar al solicitante (no bloqueante)
        try {
          await this.notificacionesService.create({
            usuarioId: data.solicitadoPorId,
            titulo: 'Gasto provisional registrado',
            mensaje: 'Tu gasto fue registrado, descontado de caja y enviado a revisión.',
            tipo: 'INFORMATIVO',
            entidad: 'Aprobacion',
            entidadId: approvalId,
            metadata: {
              tipoAprobacion: 'GASTO',
              rutaId,
              cajaId: cajaRuta.id,
              gastoId,
              monto: data.monto,
              esProvisional: true,
            },
          });
        } catch (notificationError) {
          this.logger.warn(
            `[GASTO_PROVISIONAL] No se pudo notificar al solicitante: ${
              notificationError instanceof Error
                ? notificationError.message
                : JSON.stringify(notificationError)
            }`,
          );
        }

        return {
          success: true,
          message: 'Gasto provisional registrado y enviado para aprobación',
          gastoId,
          approvalId,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error)

        this.logger.error(
          '[GASTO_PROVISIONAL] Error registrando gasto',
          error instanceof Error ? error.stack : JSON.stringify(error),
        )

        throw new BadRequestException(`[GASTO_PROVISIONAL] ${message}`)
      }
    }
  }

  async solicitarBase(data: {
    descripcion: string;
    monto: number;
    rutaId: string;
    cobradorId: string;
    solicitadoPorId: string;
  }) {
    // Buscar el solicitante para obtener su rol y nombre
    const solicitante = await this.prisma.usuario.findUnique({
      where: { id: data.solicitadoPorId },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        rol: true,
      },
    });

    const actor = solicitante
      ? { id: solicitante.id, rol: solicitante.rol }
      : undefined;

    const {
      rutaId,
      cobradorId: responsableCajaId,
      cajaRuta,
    } = await this.resolveActiveRouteCashContext(data.rutaId, actor);

    const nombreSolicitante = solicitante
      ? `${solicitante.nombres || ''} ${solicitante.apellidos || ''}`.trim()
      : 'Usuario';

    const rolSolicitante = String(solicitante?.rol || '').toUpperCase();

    const aprobacion = await this.prisma.aprobacion.create({
      data: {
        tipoAprobacion: TipoAprobacion.SOLICITUD_BASE_EFECTIVO,
        referenciaId: cajaRuta.id,
        tablaReferencia: 'Caja',
        solicitadoPorId: data.solicitadoPorId,
        estado: EstadoAprobacion.PENDIENTE,
        datosSolicitud: {
          rutaId,
          cajaId: cajaRuta.id,

          // Responsable real de la caja que recibirá la base
          cobradorId: responsableCajaId,
          responsableCajaId,

          // Solicitante real visible en revisiones/notificaciones
          solicitadoPorId: data.solicitadoPorId,
          solicitadoPor: nombreSolicitante,
          solicitadoPorNombre: nombreSolicitante,
          solicitadoPorRol: rolSolicitante,

          monto: data.monto,
          descripcion: data.descripcion,
        },
        montoSolicitud: data.monto,
      },
    });

    await this.notificacionesService.notifyApprovers({
      titulo: 'Nueva Solicitud de Base de Efectivo',
      mensaje: `${nombreSolicitante} (${rolSolicitante}) ha solicitado una base de efectivo por ${Number(
        data.monto,
      ).toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
      })}.`,
      tipo: 'SOLICITUD_DINERO',
      entidad: 'Aprobacion',
      entidadId: aprobacion.id,
      metadata: {
        tipoAprobacion: 'SOLICITUD_BASE_EFECTIVO',
        rutaId,
        cajaId: cajaRuta.id,

        // Caja afectada
        cobradorId: responsableCajaId,
        responsableCajaId,

        // Solicitante visible
        solicitadoPorId: data.solicitadoPorId,
        solicitadoPor: nombreSolicitante,
        solicitadoPorNombre: nombreSolicitante,
        solicitadoPorRol: rolSolicitante,

        monto: data.monto,
        descripcion: data.descripcion,
      },
    });

    try {
      await this.notificacionesService.create({
        usuarioId: data.solicitadoPorId,
        titulo: 'Solicitud enviada',
        mensaje:
          'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
        tipo: 'INFORMATIVO',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
          tipoAprobacion: 'SOLICITUD_BASE_EFECTIVO',
          rutaId,
          cajaId: cajaRuta.id,
          solicitadoPorId: data.solicitadoPorId,
          solicitadoPor: nombreSolicitante,
          solicitadoPorRol: rolSolicitante,
        },
      });
    } catch {}

    this.notificacionesGateway.broadcastDashboardsActualizados({
      origen: 'BASE',
      rutaId,
    });

    return {
      success: true,
      message: 'Solicitud de base registrada y enviada para aprobación',
      approvalId: aprobacion.id,
    };
  }

  async createCaja(
    data: {
      nombre: string;
      tipo: TipoCaja;
      rutaId?: string;
      responsableId: string;
      saldoInicial?: number;
    },
    userId: string,
  ) {
    try {
      // Permitir cajas RUTA solo para supervisor sin rutaId asignada
      if (data.tipo === 'RUTA') {
        if (data.rutaId) {
          throw new ForbiddenException(
            'Las cajas de ruta se crean automáticamente al crear la ruta. Si falta, use la opción de reparar/asegurar la caja de la ruta.',
          );
        }

        // Validar que el responsable sea supervisor para cajas RUTA sin rutaId
        const responsable = await this.prisma.usuario.findUnique({
          where: { id: data.responsableId },
          select: { rol: true },
        });

        if (!responsable || responsable.rol !== 'SUPERVISOR') {
          throw new ForbiddenException(
            'Las cajas de tipo RUTA sin ruta asignada solo pueden ser creadas para supervisores.',
          );
        }
      }

      // 1. Validar Usuario actual y Permisos
      const currentUser = await this.prisma.usuario.findUnique({
        where: { id: userId },
        select: { id: true, rol: true },
      });

      if (!currentUser) {
        throw new UnauthorizedException(
          'Usuario no válido para realizar esta acción',
        );
      }

      const rolesPermitidosCrearCaja = [
        'ADMIN',
        'SUPER_ADMINISTRADOR',
        'CONTADOR',
        'COORDINADOR',
      ];

      if (
        (data.tipo === 'PRINCIPAL' || data.tipo === 'RUTA') &&
        !rolesPermitidosCrearCaja.includes(currentUser.rol)
      ) {
        throw new ForbiddenException(
          'No tienes permisos para crear cajas.',
        );
      }

      // 2. Validar que el responsable exista
      const responsable = await this.prisma.usuario.findUnique({
        where: { id: data.responsableId },
      });

      if (!responsable) {
        throw new BadRequestException(
          'El responsable asignado no es un usuario válido',
        );
      }

      // Se usa 'undefined' para asegurar que rutaId vacío sea ignorado
      const rutaIdSanitizado = data.rutaId ? data.rutaId : undefined;

      // Generar código único basándose en el último creado
      const lastCaja = await this.prisma.caja.findFirst({
        orderBy: { creadoEn: 'desc' },
      });

      let nextNum = 1;
      if (lastCaja && lastCaja.codigo.startsWith('CAJA-')) {
        const lastNum = parseInt(lastCaja.codigo.split('-')[1]);
        if (!isNaN(lastNum)) {
          nextNum = lastNum + 1;
        }
      }

      const codigo = `CAJA-${nextNum.toString().padStart(4, '0')}`;

      return await this.prisma.$transaction(async (tx) => {
        // 1. Crear la Caja
        const nuevaCaja = await tx.caja.create({
          data: {
            codigo,
            nombre: data.nombre,
            tipo: data.tipo,
            rutaId: rutaIdSanitizado,
            responsableId: data.responsableId,
            saldoActual: 0,
          },
          include: {
            responsable: { select: { nombres: true, apellidos: true } },
          },
        });

        // 2. Si hay saldo inicial > 0, registrar el movimiento de apertura
        if (data.saldoInicial && data.saldoInicial > 0) {
          const numeroTransaccion = this.generarNumeroTransaccion();

          await tx.transaccion.create({
            data: {
              numeroTransaccion,
              cajaId: nuevaCaja.id,
              tipo: TipoTransaccion.INGRESO,
              monto: data.saldoInicial,
              descripcion: 'Saldo Inicial de Apertura de Caja',
              creadoPorId: userId, // El usuario que crea la caja es quien registra el saldo inicial
              tipoReferencia: 'APERTURA_CAJA',
              referenciaId: nuevaCaja.codigo,
            },
          });

          await this.ledgerService.registrarAsiento(
            {
              referenceType: 'APERTURA',
              referenceId: nuevaCaja.id,
              description: `Saldo inicial de apertura de caja ${nuevaCaja.nombre}`,
              isOpening: true,
              createdBy: userId,
              lines: [
                {
                  accountCode:
                    nuevaCaja.tipo === 'RUTA'
                      ? '1.2.1'
                      : nuevaCaja.codigo === 'CAJA-BANCO'
                        ? '1.1.2'
                        : '1.1.1',
                  debitAmount: data.saldoInicial,
                  cajaId: nuevaCaja.id,
                  cajaDelta: +data.saldoInicial,
                },
                {
                  accountCode: '2.1',
                  creditAmount: data.saldoInicial,
                },
              ],
            },
            tx,
          );
        }

        return nuevaCaja;
      });
    } catch (error) {
      this.logger.error(`Error creando caja: ${error.message}`, error.stack);
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      // Si es un error de base de datos específico (ej: input syntax for uuid), devolvemos BadRequest
      if (error.code === 'P2023' || error.message.includes('uuid')) {
        throw new BadRequestException(
          'Formato de ID inválido (UUID requerido). Verifique responsableId o rutaId.',
        );
      }

      throw new BadRequestException(
        `No se pudo crear la caja: ${error.message || 'Error desconocido'}`,
      );
    }
  }

  async updateCaja(
    id: string,
    data: {
      nombre?: string;
      responsableId?: string;
      activa?: boolean;
      saldoActual?: number;
    },
  ) {
    const caja = await this.prisma.caja.findUnique({ where: { id } });
    if (!caja) throw new NotFoundException('Caja no encontrada');

    if (data.saldoActual !== undefined) {
      throw new BadRequestException(
        'El saldo de una caja no se puede editar directamente. Registre un asiento de AJUSTE para modificarlo.',
      );
    }

    // Las cajas por defecto NO pueden desactivarse ni renombrarse, solo cambiar responsable
    if (AccountingService.CODIGOS_DEFAULT.includes(caja.codigo)) {
      if (data.activa === false) {
        throw new ForbiddenException(
          `La caja "${caja.nombre}" es una caja del sistema y no puede desactivarse.`,
        );
      }
      if (data.nombre && data.nombre !== caja.nombre) {
        throw new ForbiddenException(
          `El nombre de la caja "${caja.nombre}" no puede modificarse.`,
        );
      }
      // Solo se permite actualizar el responsable; los saldos se ajustan por ledger.
      return this.prisma.caja.update({
        where: { id },
        data: {
          responsableId: data.responsableId,
        },
      });
    }

    return this.prisma.caja.update({
      where: { id },
      data,
    });
  }

  async deleteCaja(id: string) {
    const caja = await this.prisma.caja.findUnique({ where: { id } });
    if (!caja) throw new NotFoundException('Caja no encontrada');

    if (AccountingService.CODIGOS_DEFAULT.includes(caja.codigo)) {
      throw new ForbiddenException(
        `La caja "${caja.nombre}" es una caja del sistema y no puede eliminarse. Solo puede reasignarse su responsable.`,
      );
    }

    // Verificar que no tenga transacciones activas recientes (ultimas 24h)
    const txRecientes = await this.prisma.transaccion.count({
      where: {
        cajaId: id,
        fechaTransaccion: { gte: new Date(Date.now() - 86_400_000) },
      },
    });
    if (txRecientes > 0) {
      throw new BadRequestException(
        `La caja tiene ${txRecientes} transacciones en las ultimas 24 horas. Espere antes de eliminarla o desactivela primero.`,
      );
    }

    // Desactivar en lugar de borrar fisicamente para conservar historial
    return this.prisma.caja.update({
      where: { id },
      data: { activa: false },
    });
  }

  // =====================
  // TRANSACCIONES / MOVIMIENTOS
  // =====================

  async getMovimientosLedger(filtros: {
    fechaInicio?: string;
    fechaFin?: string;
    tipo?: string;
    cajaId?: string;
    accountCode?: string;
    accountPrefix?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      fechaInicio,
      fechaFin,
      tipo,
      cajaId,
      accountCode,
      accountPrefix,
      page = 1,
      limit = 50,
    } = filtros;
    const skip = (page - 1) * limit;
    const where: any = {};
    const lineFilters: any[] = [];

    if (tipo && tipo !== 'TODOS') {
      where.referenceType = tipo;
    }
    if (fechaInicio || fechaFin) {
      where.createdAt = {};
      if (fechaInicio) {
        const inicioKey = fechaInicio.includes('T')
          ? fechaInicio.split('T')[0]
          : fechaInicio;
        where.createdAt.gte =
          getBogotaStartEndOfDayFromKey(inicioKey).startDate;
      }
      if (fechaFin) {
        const finKey = fechaFin.includes('T')
          ? fechaFin.split('T')[0]
          : fechaFin;
        where.createdAt.lte = getBogotaStartEndOfDayFromKey(finKey).endDate;
      }
    }
    if (cajaId) {
      lineFilters.push({ cajaId });
    }
    if (accountCode) {
      lineFilters.push({ accountCode });
    } else if (accountPrefix) {
      lineFilters.push({ accountCode: { startsWith: accountPrefix } });
    }
    if (lineFilters.length === 1) {
      where.lines = { some: lineFilters[0] };
    } else if (lineFilters.length > 1) {
      where.lines = { some: { AND: lineFilters } };
    }

    const [entries, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: { select: { code: true, name: true, type: true } },
              caja: {
                select: { id: true, nombre: true, codigo: true, tipo: true },
              },
            },
            orderBy: { accountCode: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    const pagoIds = entries
      .filter((entry: any) => String(entry.referenceType || '').toUpperCase() === 'PAGO')
      .map((entry: any) => String(entry.referenceId || '').trim())
      .filter(Boolean);
    const pagosRegularizados = pagoIds.length
      ? await this.prisma.pago.findMany({
          where: {
            id: { in: pagoIds },
            origenGestion: 'CIERRE_PENDIENTE',
          },
          select: {
            id: true,
            origenGestion: true,
            fechaOperativaRuta: true,
          },
        })
      : [];
    const pagoRegularizadoPorId = new Map<
      string,
      { id: string; origenGestion: string | null; fechaOperativaRuta: string | null }
    >(
      pagosRegularizados.map((p: any) => [p.id, p]),
    );

    const data = entries.map((entry: any) => {
      const pagoRegularizado = pagoRegularizadoPorId.get(entry.referenceId);
      const totalDebito = entry.lines.reduce(
        (sum: number, line: any) => sum + Number(line.debitAmount || 0),
        0,
      );
      const totalCredito = entry.lines.reduce(
        (sum: number, line: any) => sum + Number(line.creditAmount || 0),
        0,
      );
      const lineasCaja = cajaId
        ? entry.lines.filter((line: any) => line.cajaId === cajaId)
        : entry.lines.filter((line: any) => line.cajaId);
      const debitoCaja = lineasCaja.reduce(
        (sum: number, line: any) => sum + Number(line.debitAmount || 0),
        0,
      );
      const creditoCaja = lineasCaja.reduce(
        (sum: number, line: any) => sum + Number(line.creditAmount || 0),
        0,
      );
      const impactoCaja = debitoCaja - creditoCaja;
      const resultadoIngresos = entry.lines.reduce(
        (sum: number, line: any) =>
          String(line.accountCode || '').startsWith('3.')
            ? sum +
              Number(line.creditAmount || 0) -
              Number(line.debitAmount || 0)
            : sum,
        0,
      );
      const resultadoEgresosCostos = entry.lines.reduce(
        (sum: number, line: any) =>
          String(line.accountCode || '').startsWith('4.') ||
          String(line.accountCode || '').startsWith('5.')
            ? sum +
              Number(line.debitAmount || 0) -
              Number(line.creditAmount || 0)
            : sum,
        0,
      );
      const impactoResultado = resultadoIngresos - resultadoEgresosCostos;
      const cuentaPrincipal =
        (entry.referenceType === 'AJUSTE' && impactoCaja !== 0
          ? lineasCaja[0]
          : null) ||
        entry.lines.find((line: any) =>
          String(line.accountCode || '').startsWith('3.'),
        ) ||
        entry.lines.find((line: any) =>
          String(line.accountCode || '').startsWith('4.'),
        ) ||
        entry.lines.find((line: any) =>
          String(line.accountCode || '').startsWith('5.'),
        ) ||
        entry.lines.find((line: any) => line.cajaId) ||
        entry.lines[0];

      return {
        id: entry.id,
        fecha: formatBogotaOffsetIso(entry.createdAt),
        tipo: entry.referenceType,
        referenciaId: entry.referenceId,
        descripcion: entry.description,
        creadoPorId: entry.createdBy,
        totalDebito,
        totalCredito,
        direction:
          impactoCaja > 0
            ? 'IN'
            : impactoCaja < 0
              ? 'OUT'
              : impactoResultado >= 0
                ? 'IN'
                : 'OUT',
        impactoCaja,
        impactoResultado,
        accountCode: cuentaPrincipal?.accountCode || null,
        accountName:
          cuentaPrincipal?.account?.name ||
          cuentaPrincipal?.accountCode ||
          null,
        origenGestion: pagoRegularizado?.origenGestion || null,
        fechaOperativaRuta: pagoRegularizado?.fechaOperativaRuta || null,
        caja: lineasCaja[0]?.caja?.nombre || null,
        cajaId: lineasCaja[0]?.cajaId || null,
        cuadrado: Math.abs(totalDebito - totalCredito) < 0.01,
        lineas: entry.lines.map((line: any) => ({
          id: line.id,
          accountCode: line.accountCode,
          accountName: line.account?.name || line.accountCode,
          debitAmount: Number(line.debitAmount || 0),
          creditAmount: Number(line.creditAmount || 0),
          cajaId: line.cajaId,
          caja: line.caja?.nombre || null,
          direction: line.cajaId
            ? Number(line.debitAmount || 0) >= Number(line.creditAmount || 0)
              ? 'IN'
              : 'OUT'
            : null,
        })),
      };
    });

    const pagination = {
      total,
      pagina: page,
      limite: limit,
      totalPaginas: Math.ceil(total / limit),
    };

    return {
      data,
      paginacion: pagination,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTransacciones(filtros: {
    cajaId?: string;
    tipo?: TipoTransaccion;
    fechaInicio?: string;
    fechaFin?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const {
        cajaId,
        tipo,
        fechaInicio,
        fechaFin,
        page = 1,
        limit = 50,
      } = filtros;
      const skip = (page - 1) * limit;

      const where: any = {};

      // Se eliminó el filtro que excluía consolidaciones para mostrarlas en movimientos recientes

      if (cajaId) {
        where.cajaId = cajaId;
        if (tipo) where.tipo = tipo;
      } else if (
        tipo === TipoTransaccion.INGRESO ||
        tipo === TipoTransaccion.EGRESO
      ) {
        // Filtro global por tipo explícito (historial de ingresos/egresos del módulo contable)
        where.tipo = tipo;
        // Para ingresos globales, excluir transacciones internas que no son recaudo real
        if (tipo === TipoTransaccion.INGRESO) {
          where.NOT = {
            tipoReferencia: {
              in: [
                'SOLICITUD_BASE',
                'SOLICITUD_BASE_EFECTIVO',
                'APERTURA_CAJA',
              ],
            },
          };
        }
      } else {
        // Movimientos recientes (global): mostrar solo movimientos entre cajas.
        // Además, ocultar la "doble partida" de transferencias mostrando solo el lado TRX-IN.
        where.tipo = TipoTransaccion.TRANSFERENCIA;
        where.numeroTransaccion = { startsWith: 'TRX-IN' };
      }
      if (fechaInicio || fechaFin) {
        const { startDate, endDate } = calculateDateRange(
          'custom',
          fechaInicio
            ? fechaInicio.includes('T')
              ? fechaInicio.split('T')[0]
              : fechaInicio
            : undefined,
          fechaFin
            ? fechaFin.includes('T')
              ? fechaFin.split('T')[0]
              : fechaFin
            : undefined,
        );
        where.fechaTransaccion = {
          gte: startDate,
          lte: endDate,
        };
      }

      // Si el tipo es 'INGRESO', queremos incluir tanto INGRESOS reales como TRANSFERENCIAS TRX-IN
      // que representan recolecciones de ruta (para que el listado coincida con el dashboard)
      if (where.tipo === TipoTransaccion.INGRESO && !cajaId) {
        delete where.tipo;
        where.OR = [
          { tipo: TipoTransaccion.INGRESO },
          {
            tipo: TipoTransaccion.TRANSFERENCIA,
            numeroTransaccion: { startsWith: 'TRX-IN' },
          },
        ];
        // Seguir excluyendo bases si es ingreso global
        where.NOT = {
          tipoReferencia: {
            in: ['SOLICITUD_BASE', 'SOLICITUD_BASE_EFECTIVO', 'APERTURA_CAJA'],
          },
        };
      }

      const [transacciones, total] = await Promise.all([
        this.prisma.transaccion.findMany({
          where,
          skip,
          take: limit,
          include: {
            caja: {
              select: {
                nombre: true,
                codigo: true,
                tipo: true,
                rutaId: true,
                saldoActual: true,
              },
            },
            creadoPor: { select: { nombres: true, apellidos: true } },
          },
          orderBy: { fechaTransaccion: 'desc' },
        }),
        this.prisma.transaccion.count({ where }),
      ]);

      return {
        data: transacciones.map((t) => this.mapTransaccionRow(t)),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error fetching transacciones: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getTransaccionById(id: string) {
    try {
      const t = await this.prisma.transaccion.findUnique({
        where: { id },
        include: {
          caja: {
            select: {
              nombre: true,
              codigo: true,
              tipo: true,
              rutaId: true,
              saldoActual: true,
            },
          },
          creadoPor: { select: { nombres: true, apellidos: true } },
        },
      });

      if (!t) throw new NotFoundException('Transacción no encontrada');

      return this.mapTransaccionRow(t);
    } catch (error) {
      this.logger.error(
        `Error fetching transaccion by id: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Obtener saldo disponible de una ruta (recaudo del día - gastos)
   */
  async getSaldoDisponibleRuta(
    rutaId: string,
    fecha?: string,
    fechaInicio?: string,
    fechaFin?: string,
  ) {
    let rangeStart: Date;
    let rangeEnd: Date;

    if (fechaInicio && fechaFin) {
      // Interpretar YYYY-MM-DD como día Colombia
      const startKey = /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)
        ? fechaInicio
        : getBogotaDayKey(new Date(fechaInicio));
      const endKey = /^\d{4}-\d{2}-\d{2}$/.test(fechaFin)
        ? fechaFin
        : getBogotaDayKey(new Date(fechaFin));
      rangeStart = getBogotaStartEndOfDayFromKey(startKey).startDate;
      rangeEnd = getBogotaStartEndOfDayFromKey(endKey).endDate;
    } else {
      const key = fecha
        ? /^\d{4}-\d{2}-\d{2}$/.test(fecha)
          ? fecha
          : getBogotaDayKey(new Date(fecha))
        : getBogotaDayKey(new Date());
      ({ startDate: rangeStart, endDate: rangeEnd } =
        getBogotaStartEndOfDayFromKey(key));
    }

    const caja = await this.prisma.caja.findFirst({
      where: {
        rutaId,
        tipo: 'RUTA',
        activa: true,
      },
      select: {
        id: true,
        saldoActual: true,
      },
    });

    if (!caja) {
      // Retornar ceros si no hay caja, para evitar errores en el dashboard
      return {
        rutaId,
        recaudoDelDia: 0,
        cobranzaDelDia: 0,
        gastosDelDia: 0,
        baseEfectivo: 0,
        desembolsos: 0,
        saldoDisponible: 0,
        fechaInicio: formatBogotaOffsetIso(rangeStart),
        fechaFin: formatBogotaOffsetIso(rangeEnd),
      };
    }

    // 1. Obtener todas las transacciones del período para esta caja
    const transacciones = await this.prisma.transaccion.findMany({
      where: {
        cajaId: caja.id,
        fechaTransaccion: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        monto: true,
        tipo: true,
        tipoReferencia: true,
        referenciaId: true,
        descripcion: true,
      },
    });

    // 2. Clasificar y sumar transacciones
    let cobranzaTrx = 0;
    let baseEfectivo = 0;
    let gastosOperativos = 0;
    let desembolsos = 0;
    let otrosIngresos = 0;
    let otrosEgresos = 0;
    const recaudosPorReferencia: Record<string, number> = {};

    transacciones.forEach((t) => {
      const monto = Number(t.monto);
      const descripcion = String(t.descripcion || '').toLowerCase();
      if (t.tipo === 'INGRESO') {
        if (t.tipoReferencia === 'PAGO') {
          cobranzaTrx += monto;
          if (t.referenciaId) {
            recaudosPorReferencia[t.referenciaId] =
              (recaudosPorReferencia[t.referenciaId] || 0) + monto;
          }
        } else if (
          t.tipoReferencia === 'SOLICITUD_BASE_EFECTIVO' ||
          t.tipoReferencia === 'SOLICITUD_BASE' ||
          t.tipoReferencia === 'APERTURA_CAJA' ||
          descripcion.includes('apertura de caja') ||
          descripcion.includes('base de efectivo')
        ) {
          baseEfectivo += monto;
        } else {
          otrosIngresos += monto;
        }
      } else if (t.tipo === 'EGRESO') {
        // Estos movimientos son eventos internos de control / contabilidad y no deben verse como "egresos" operativos
        // en el rendimiento diario de la ruta.
        if (
          t.tipoReferencia === 'DEUDA_COBRADOR' ||
          t.tipoReferencia === 'CIERRE_RUTA' ||
          t.tipoReferencia === 'ACTIVACION_RUTA'
        ) {
          return;
        }

        if (t.tipoReferencia === 'GASTO') {
          gastosOperativos += monto;
        } else if (t.tipoReferencia === 'GASTO_PROVISIONAL') {
          // Gastos provisionales no cuentan como gastos operativos hasta aprobarse
          otrosEgresos += monto;
        } else if (
          t.tipoReferencia === 'PRESTAMO' ||
          descripcion.includes('desembolso') ||
          descripcion.includes('préstamo')
        ) {
          desembolsos += monto;
        } else {
          otrosEgresos += monto;
        }
      } else if (t.tipo === 'TRANSFERENCIA') {
        // Las transferencias (TRX-IN/TRX-OUT) NO deben contarse como "gastos" del día.
        // Son movimientos internos entre cajas y contablemente ya se reflejan en saldoActual.
        return;
      }
    });

    // 3. Cobranza REAL del período: siempre desde la tabla Pago para incluir
    // pagos por transferencia (CAJA-BANCO) y efectivo (caja ruta), sin doble conteo.
    let cobranzaPagos = 0;
    const asignaciones = await this.prisma.asignacionRuta.findMany({
      where: { rutaId, activa: true },
      select: { clienteId: true },
    });
    const clienteIds = asignaciones.map((a) => a.clienteId);

    if (clienteIds.length > 0) {
      const pagosList = await this.prisma.pago.findMany({
        where: {
          clienteId: { in: clienteIds },
          fechaPago: {
            gte: rangeStart,
            lte: rangeEnd,
          },
        },
        select: {
          montoTotal: true,
          prestamoId: true,
        },
      });

      pagosList.forEach((p) => {
        const m = Number(p.montoTotal);
        cobranzaPagos += m;
        if (p.prestamoId) {
          recaudosPorReferencia[p.prestamoId] =
            (recaudosPorReferencia[p.prestamoId] || 0) + m;
        }
      });
    }

    const totalCobranza = cobranzaPagos;
    const totalRecaudoAll = totalCobranza + otrosIngresos;
    const totalGastos = gastosOperativos + otrosEgresos;
    const saldoNetoPeriodo = totalRecaudoAll - totalGastos - desembolsos;

    // 4. Calcular gastos desde la tabla Gasto para tener información precisa de aprobación
    let gastosAprobados = 0;
    let gastosPendientes = 0;

    const gastos = await this.prisma.gasto.findMany({
      where: {
        rutaId,
        fechaGasto: {
          gte: rangeStart,
          lte: rangeEnd,
        },
        tipoGasto: 'OPERATIVO',
      },
      select: {
        monto: true,
        estadoAprobacion: true,
        resultadoRevisionGasto: true,
        esProvisional: true,
        aplicadoEnCaja: true,
      },
    });

    gastos.forEach((g) => {
      const monto = Number(g.monto);
      if (g.estadoAprobacion === 'APROBADO' && g.resultadoRevisionGasto === 'APROBADO_OPERATIVO') {
        gastosAprobados += monto;
      } else if (g.estadoAprobacion === 'PENDIENTE' && g.esProvisional === true && g.aplicadoEnCaja === true) {
        gastosPendientes += monto;
      }
    });

    return {
      rutaId,
      cajaId: caja.id,
      fecha: formatBogotaOffsetIso(rangeStart),

      saldoDisponible: Number(caja.saldoActual),
      saldoCaja: Number(caja.saldoActual),
      baseEfectivo: Number(caja.saldoActual),

      recaudoDelDia: totalCobranza,
      cobranzaDelDia: totalCobranza,
      recaudosPorReferencia,

      // Gastos operativos aprobados desde tabla Gasto
      gastosDelDia: gastosAprobados,

      // Gastos pendientes de revisión desde tabla Gasto
      egresosProvisionales: gastosPendientes,

      // Total de salidas reales de caja del período
      totalEgresosCaja: gastosOperativos + otrosEgresos + desembolsos,

      desembolsos,
      netoPeriodo: saldoNetoPeriodo,

      fechaInicio: formatBogotaOffsetIso(rangeStart),
      fechaFin: formatBogotaOffsetIso(rangeEnd),
    };
  }

  /**
   * Obtener saldo disponible de la caja de un supervisor
   */
  async getSaldoDisponibleSupervisor(
    supervisorId: string,
    fecha?: string,
    fechaInicio?: string,
    fechaFin?: string,
  ) {
    let rangeStart: Date;
    let rangeEnd: Date;

    if (fechaInicio && fechaFin) {
      const startKey = /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)
        ? fechaInicio
        : getBogotaDayKey(new Date(fechaInicio));
      const endKey = /^\d{4}-\d{2}-\d{2}$/.test(fechaFin)
        ? fechaFin
        : getBogotaDayKey(new Date(fechaFin));
      rangeStart = getBogotaStartEndOfDayFromKey(startKey).startDate;
      rangeEnd = getBogotaStartEndOfDayFromKey(endKey).endDate;
    } else {
      const key = fecha
        ? /^\d{4}-\d{2}-\d{2}$/.test(fecha)
          ? fecha
          : getBogotaDayKey(new Date(fecha))
        : getBogotaDayKey(new Date());
      ({ startDate: rangeStart, endDate: rangeEnd } =
        getBogotaStartEndOfDayFromKey(key));
    }

    // Buscar la caja del supervisor (tipo RUTA, rutaId null, responsableId = supervisorId)
    const caja = await this.prisma.caja.findFirst({
      where: {
        tipo: 'RUTA',
        rutaId: null,
        responsableId: supervisorId,
        activa: true,
      },
      select: {
        id: true,
        saldoActual: true,
      },
    });

    if (!caja) {
      return {
        rutaId: null,
        cajaId: null,
        recaudoDelDia: 0,
        cobranzaDelDia: 0,
        gastosDelDia: 0,
        baseEfectivo: 0,
        desembolsos: 0,
        saldoDisponible: 0,
        saldoCaja: 0,
        fechaInicio: formatBogotaOffsetIso(rangeStart),
        fechaFin: formatBogotaOffsetIso(rangeEnd),
      };
    }

    // Obtener transacciones del período para esta caja
    const transacciones = await this.prisma.transaccion.findMany({
      where: {
        cajaId: caja.id,
        fechaTransaccion: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        monto: true,
        tipo: true,
        tipoReferencia: true,
        descripcion: true,
      },
    });

    // Clasificar y sumar transacciones
    let cobranzaTrx = 0;
    let baseEfectivo = 0;
    let gastosOperativos = 0;
    let desembolsos = 0;
    let otrosIngresos = 0;
    let otrosEgresos = 0;

    transacciones.forEach((t) => {
      const monto = Number(t.monto);
      const descripcion = String(t.descripcion || '').toLowerCase();
      if (t.tipo === 'INGRESO') {
        if (t.tipoReferencia === 'PAGO') {
          cobranzaTrx += monto;
        } else if (
          t.tipoReferencia === 'SOLICITUD_BASE_EFECTIVO' ||
          t.tipoReferencia === 'SOLICITUD_BASE' ||
          t.tipoReferencia === 'APERTURA_CAJA' ||
          descripcion.includes('apertura de caja') ||
          descripcion.includes('base de efectivo')
        ) {
          baseEfectivo += monto;
        } else {
          otrosIngresos += monto;
        }
      } else if (t.tipo === 'EGRESO') {
        if (
          t.tipoReferencia === 'DEUDA_COBRADOR' ||
          t.tipoReferencia === 'CIERRE_RUTA' ||
          t.tipoReferencia === 'ACTIVACION_RUTA'
        ) {
          return;
        }

        if (t.tipoReferencia === 'GASTO') {
          gastosOperativos += monto;
        } else if (
          t.tipoReferencia === 'PRESTAMO' ||
          descripcion.includes('desembolso') ||
          descripcion.includes('préstamo')
        ) {
          desembolsos += monto;
        } else {
          otrosEgresos += monto;
        }
      } else if (t.tipo === 'TRANSFERENCIA') {
        return;
      }
    });

    // Para supervisor, la cobranza se calcula desde transacciones tipo PAGO
    // ya que no tiene una ruta específica asignada
    const totalCobranza = cobranzaTrx;
    const totalRecaudoAll = totalCobranza + otrosIngresos;
    const totalGastos = gastosOperativos + otrosEgresos;
    const saldoNetoPeriodo = totalRecaudoAll - totalGastos - desembolsos;

    // Calcular gastos desde la tabla Gasto para el supervisor
    let gastosAprobados = 0;
    let gastosPendientes = 0;

    const gastos = await this.prisma.gasto.findMany({
      where: {
        cobradorId: supervisorId,
        fechaGasto: {
          gte: rangeStart,
          lte: rangeEnd,
        },
        tipoGasto: 'OPERATIVO',
      },
      select: {
        monto: true,
        estadoAprobacion: true,
        resultadoRevisionGasto: true,
        esProvisional: true,
        aplicadoEnCaja: true,
      },
    });

    gastos.forEach((g) => {
      const monto = Number(g.monto);
      if (g.estadoAprobacion === 'APROBADO' && g.resultadoRevisionGasto === 'APROBADO_OPERATIVO') {
        gastosAprobados += monto;
      } else if (g.estadoAprobacion === 'PENDIENTE' && g.esProvisional === true && g.aplicadoEnCaja === true) {
        gastosPendientes += monto;
      }
    });

    return {
      rutaId: null,
      cajaId: caja.id,
      fecha: formatBogotaOffsetIso(rangeStart),
      saldoDisponible: Number(caja.saldoActual),
      saldoCaja: Number(caja.saldoActual),
      baseEfectivo: Number(caja.saldoActual),
      recaudoDelDia: totalCobranza,
      cobranzaDelDia: totalCobranza,
      gastosDelDia: gastosAprobados,
      egresosProvisionales: gastosPendientes,
      totalEgresosCaja: gastosOperativos + otrosEgresos + desembolsos,
      desembolsos,
      netoPeriodo: saldoNetoPeriodo,
      fechaInicio: formatBogotaOffsetIso(rangeStart),
      fechaFin: formatBogotaOffsetIso(rangeEnd),
    };
  }

  async createTransaccion(data: {
    cajaId: string;
    tipo: TipoTransaccion;
    monto: number;
    descripcion: string;
    creadoPorId: string;
    tipoReferencia?: string;
    referenciaId?: string;
    cajaOrigenId?: string;
    accountCode?: string;
    idempotencyKey?: string;
  }) {
    const idempotencyKey = data.idempotencyKey?.toString().trim() || undefined;
    if (idempotencyKey) {
      const transaccionExistente = await this.prisma.transaccion.findFirst({
        where: { idempotencyKey },
      });
      if (transaccionExistente) {
        return {
          ...transaccionExistente,
          idempotentReplay: true,
        };
      }
    }

    const numeroTransaccion = this.generarNumeroTransaccion();

    // Actualizar saldo de la caja (Destino)
    const caja = await this.prisma.caja.findUnique({
      where: { id: data.cajaId },
      include: { ruta: true },
    });
    if (!caja) throw new NotFoundException('Caja no encontrada');

    // VALIDACIÓN: Si es un egreso de caja de ruta, verificar saldo disponible
    if (data.tipo === 'EGRESO' && caja.tipo === 'RUTA') {
      if (caja.rutaId) {
        // Caja de ruta normal: validar saldo disponible del día
        const saldoInfo = await this.getSaldoDisponibleRuta(caja.rutaId);
        if (data.monto > saldoInfo.saldoDisponible) {
          throw new BadRequestException(
            `Saldo insuficiente. Disponible: $${saldoInfo.saldoDisponible.toLocaleString()}, Recaudo del día: $${saldoInfo.recaudoDelDia.toLocaleString()}, Gastos del día: $${saldoInfo.gastosDelDia.toLocaleString()}`,
          );
        }

        // Regla de negocio: los egresos realizados por el cobrador en su ruta se consideran deuda del cobrador
        // (cuenta por cobrar), por lo que no deben afectar la utilidad del negocio.
        if (!data.tipoReferencia) {
          data.tipoReferencia = 'DEUDA_COBRADOR';
        }
      } else {
        // Caja de supervisor (rutaId null): validar saldo actual de la caja
        const saldoDisponible = Number(caja.saldoActual || 0);
        if (data.monto > saldoDisponible) {
          throw new BadRequestException(
            `Saldo insuficiente. Disponible: $${saldoDisponible.toLocaleString('es-CO')}`,
          );
        }
        // Para supervisor, no asumir automáticamente DEUDA_COBRADOR
      }
    }

    // Caso Especial: Si hay caja origen, es una transferencia/consolidación
    if (data.cajaOrigenId) {
      const cajaOrigen = await this.prisma.caja.findUnique({
        where: { id: data.cajaOrigenId },
      });
      if (!cajaOrigen) throw new NotFoundException('Caja origen no encontrada');

      const numeroReferencia = `CONS-${Date.now().toString().slice(-6)}`;
      const cajaOrigenId = data.cajaOrigenId; // Capturar para TS

      return this.prisma.$transaction(async (tx) => {
        // 1. Salida de la caja origen
        await tx.transaccion.create({
          data: {
            numeroTransaccion: this.generarNumeroTransaccion('TRX-OUT'),
            idempotencyKey: idempotencyKey
              ? `${idempotencyKey}:out`
              : undefined,
            cajaId: cajaOrigenId,
            tipo: TipoTransaccion.TRANSFERENCIA,
            monto: data.monto,
            descripcion: `Transferencia enviada a ${caja.nombre}`,
            creadoPorId: data.creadoPorId,
            tipoReferencia: 'TRANSFERENCIA_INTERNA',
            referenciaId: numeroReferencia,
          },
        });

        // 2. Entrada a la caja destino
        const transaccion = await tx.transaccion.create({
          data: {
            numeroTransaccion: this.generarNumeroTransaccion('TRX-IN'),
            idempotencyKey,
            cajaId: data.cajaId,
            tipo: TipoTransaccion.TRANSFERENCIA,
            monto: data.monto,
            descripcion: `Transferencia recibida de ${cajaOrigen.nombre}`,
            creadoPorId: data.creadoPorId,
            tipoReferencia: 'TRANSFERENCIA_INTERNA',
            referenciaId: numeroReferencia,
          },
        });

        // 3. Registrar asiento contable de consolidación (Ledger mueve los saldos)
        const accountCodeDestino =
          caja.codigo === 'CAJA-BANCO' ? '1.1.2' : '1.1.1';
        await this.ledgerService.registrarConsolidacion(
          {
            referenceId: numeroReferencia,
            monto: data.monto,
            cajaOrigenId: data.cajaOrigenId as string,
            cajaDestinoId: data.cajaId,
            accountCodeDestino,
            createdBy: data.creadoPorId,
          },
          tx,
        );

        return transaccion;
      });
    }

    const transaccion = await this.prisma.$transaction(async (tx) => {
      // 1. Crear transacción histórica
      const t = await tx.transaccion.create({
        data: {
          numeroTransaccion,
          idempotencyKey,
          cajaId: data.cajaId,
          tipo: data.tipo,
          monto: data.monto,
          descripcion: data.descripcion,
          creadoPorId: data.creadoPorId,
          tipoReferencia: data.tipoReferencia,
          referenciaId: data.referenciaId,
        },
      });

      // 2. Registrar asiento contable (Ledger mueve el saldo de la caja)
      const isIngreso = data.tipo === 'INGRESO';
      const validReferenceTypes = new Set<ReferenceTypeContable>([
        'PAGO',
        'DESEMBOLSO',
        'GASTO',
        'VENTA_ARTICULO',
        'BASE',
        'CONSOLIDACION',
        'ARQUEO',
        'ABONO_DEUDA',
        'APERTURA',
        'AJUSTE',
        'CASTIGO_CARTERA',
        'INGRESO',
        'EGRESO',
      ]);
      const refUpper = String(data.tipoReferencia || '').toUpperCase();
      const refType: ReferenceTypeContable = validReferenceTypes.has(
        refUpper as ReferenceTypeContable,
      )
        ? (refUpper as ReferenceTypeContable)
        : isIngreso
          ? 'INGRESO'
          : 'EGRESO';

      // Si el usuario especifica una cuenta, la usamos como contrapartida.
      // Si no, usamos las cuentas genéricas por concepto (3.3 Otros Ingresos / 4.x Otros Gastos).
      const contrapartidaDefecto = isIngreso
        ? '3.3'
        : refUpper === 'DEUDA_COBRADOR'
          ? '1.4.1'
          : caja.tipo === 'RUTA'
            ? '4.1'
            : '4.2';
      const accountCodeContrapartida = data.accountCode || contrapartidaDefecto;

      await this.ledgerService.registrarAsiento(
        {
          referenceType: refType,
          referenceId: data.referenciaId || t.id,
          description: data.descripcion,
          createdBy: data.creadoPorId,
          lines: [
            {
              accountCode: isIngreso
                ? caja.tipo === 'RUTA'
                  ? '1.2.1'
                  : caja.codigo === 'CAJA-BANCO'
                    ? '1.1.2'
                    : '1.1.1'
                : accountCodeContrapartida,
              debitAmount: data.monto,
              ...(isIngreso
                ? {
                    cajaId: data.cajaId,
                    cajaDelta: +data.monto,
                  }
                : {}),
            },
            {
              accountCode: isIngreso
                ? accountCodeContrapartida
                : caja.tipo === 'RUTA'
                  ? '1.2.1'
                  : caja.codigo === 'CAJA-BANCO'
                    ? '1.1.2'
                    : '1.1.1',
              creditAmount: data.monto,
              ...(!isIngreso
                ? {
                    cajaId: data.cajaId,
                    cajaDelta: -data.monto,
                  }
                : {}),
            },
          ],
        },
        tx,
      );

      return t;
    });

    try {
      if (data.tipo === 'EGRESO' && caja.tipo === 'RUTA') {
        await this.notificacionesService.notifyCoordinator({
          titulo: 'Gasto Registrado en Ruta',
          mensaje: `Se registró un gasto de ${data.monto.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} en la ruta ${caja.ruta?.nombre || 'Sin ruta'} (Caja: ${caja.nombre})`,
          tipo: 'SISTEMA',
          entidad: 'TRANSACCION',
          entidadId: transaccion.id,
          metadata: {
            rutaId: caja.rutaId,
            cajaId: data.cajaId,
            tipoTransaccion: data.tipo,
            descripcion: data.descripcion,
          },
        });
      }
    } catch (error) {
      this.logger.error('Error enviando notificación de gasto:', error);
    }

    return transaccion;
  }

  async consolidarCaja(
    cajaOrigenId: string,
    administradorId: string,
    montoRecolectar?: number,
    idempotencyKey?: string,
  ) {
    // 1. Validar Caja Origen existe
    const cajaOrigen = await this.prisma.caja.findUnique({
      where: { id: cajaOrigenId },
      include: { ruta: { select: { nombre: true, id: true } } },
    });
    if (!cajaOrigen) throw new NotFoundException('Caja origen no encontrada');

    // 2. Buscar Caja de Oficina como destino
    const cajaDestino =
      (await this.prisma.caja.findFirst({
        where: {
          OR: [
            { codigo: 'CAJA-OFICINA' },
            {
              tipo: TipoCaja.PRINCIPAL,
              activa: true,
              NOT: { codigo: 'CAJA-PRINCIPAL' },
            },
          ],
        },
        orderBy: { creadoEn: 'asc' },
      })) ??
      (await this.prisma.caja.findFirst({
        where: { tipo: TipoCaja.PRINCIPAL, activa: true },
        orderBy: { creadoEn: 'asc' },
      }));

    if (!cajaDestino)
      throw new BadRequestException('No existe una Caja de Oficina activa');
    if (cajaDestino.id === cajaOrigen.id)
      throw new BadRequestException(
        'No se puede recolectar desde la caja destino',
      );

    // 3. Exigir idempotencyKey para evitar doble ejecución
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException(
        'La recolección requiere idempotencyKey para evitar doble ejecución.',
      );
    }

    const idempotencyKeyFinal = idempotencyKey.trim();

    // 4. Validar si ya existe una recolección con el mismo idempotencyKey (antes de validar saldo)
    const existingTrxOut = await this.prisma.transaccion.findFirst({
      where: {
        tipo: TipoTransaccion.TRANSFERENCIA,
        tipoReferencia: 'RECOLECCION',
        numeroTransaccion: { startsWith: 'TRX-OUT' },
        idempotencyKey: `${idempotencyKeyFinal}:OUT`,
      },
      orderBy: { fechaTransaccion: 'desc' },
    });

    if (existingTrxOut) {
      // Retornar la consolidación existente sin duplicar movimiento
      const existingTrxIn = await this.prisma.transaccion.findFirst({
        where: {
          tipo: TipoTransaccion.TRANSFERENCIA,
          tipoReferencia: 'RECOLECCION',
          referenciaId: existingTrxOut.referenciaId,
          numeroTransaccion: { startsWith: 'TRX-IN' },
        },
      });

      return {
        origen: cajaOrigen.nombre,
        destino: cajaDestino.nombre,
        monto: Number(existingTrxOut.monto),
        numeroRef: existingTrxOut.referenciaId,
        transacciones: existingTrxIn ? [existingTrxOut.id, existingTrxIn.id] : [existingTrxOut.id],
        idempotente: true,
      };
    }

    // 5. Validar saldo (solo si no es replay)
    const saldoDisponible = Number(cajaOrigen.saldoActual);
    const montoATransferirSolicitado =
      montoRecolectar && montoRecolectar > 0
        ? montoRecolectar
        : saldoDisponible;

    if (montoATransferirSolicitado <= 0) {
      throw new BadRequestException(
        'El monto a recolectar debe ser mayor a cero',
      );
    }
    if (montoATransferirSolicitado > saldoDisponible) {
      throw new BadRequestException(
        `El monto (${montoATransferirSolicitado}) supera el saldo disponible (${saldoDisponible})`,
      );
    }

    const numeroRef = this.generarNumeroTransaccion('RECOL');
    const esTotal = montoATransferirSolicitado === saldoDisponible;
    const rutaNombre = cajaOrigen.ruta?.nombre || cajaOrigen.nombre;

    // 6. Ejecutar Transaccion Atomica
    const resultado = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "cajas" WHERE id = ${cajaOrigen.id} FOR UPDATE`;

      const cajaOrigenActual = await tx.caja.findUnique({
        where: { id: cajaOrigen.id },
        include: { ruta: { select: { nombre: true, id: true } } },
      });
      if (!cajaOrigenActual)
        throw new NotFoundException('Caja origen no encontrada');

      const saldoDisponibleActual = Number(cajaOrigenActual.saldoActual);
      const montoATransferir =
        montoRecolectar && montoRecolectar > 0
          ? montoRecolectar
          : saldoDisponibleActual;

      if (montoATransferir <= 0) {
        throw new BadRequestException(
          'El monto a recolectar debe ser mayor a cero',
        );
      }
      if (montoATransferir > saldoDisponibleActual) {
        throw new BadRequestException(
          `El monto (${montoATransferir}) supera el saldo disponible (${saldoDisponibleActual})`,
        );
      }

      const egreso = await tx.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion('TRX-OUT'),
          idempotencyKey: `${idempotencyKeyFinal}:OUT`,
          cajaId: cajaOrigen.id,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto: montoATransferir,
          descripcion: `Recoleccion ${esTotal ? 'total' : 'parcial'} enviada a ${cajaDestino.nombre}`,
          creadoPorId: administradorId,
          tipoReferencia: 'RECOLECCION',
          referenciaId: numeroRef,
        },
      });

      const ingreso = await tx.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion('TRX-IN'),
          idempotencyKey: `${idempotencyKeyFinal}:IN`,
          cajaId: cajaDestino.id,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto: montoATransferir,
          descripcion: `Recoleccion recibida de ${rutaNombre}`,
          creadoPorId: administradorId,
          tipoReferencia: 'RECOLECCION',
          referenciaId: numeroRef,
        },
      });

      // Asiento contable de Partida Doble (Ledger mueve los saldos)
      const accountCodeDestino =
        cajaDestino.codigo === 'CAJA-BANCO' ? '1.1.2' : '1.1.1';
      await this.ledgerService.registrarConsolidacion(
        {
          referenceId: numeroRef,
          monto: montoATransferir,
          cajaOrigenId: cajaOrigen.id,
          cajaDestinoId: cajaDestino.id,
          accountCodeDestino,
          createdBy: administradorId,
        },
        tx,
      );

      return { egreso, ingreso, montoATransferir };
    });

    // 4. Notificacion puramente informativa (no va a revisiones)
    try {
      const montoFmt = resultado.montoATransferir.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
      });
      await this.notificacionesService.notifyCoordinator({
        titulo: 'Recoleccion de Dinero Registrada',
        mensaje: `Se recolectaron ${montoFmt} de la ruta "${rutaNombre}" hacia ${cajaDestino.nombre}. Referencia: ${numeroRef}.`,
        tipo: 'SISTEMA',
        entidad: 'Transaccion',
        entidadId: resultado.ingreso.id,
        metadata: {
          cajaOrigenId: cajaOrigen.id,
          cajaDestinoId: cajaDestino.id,
          monto: resultado.montoATransferir,
          numeroRef,
          administradorId,
          esTotal,
        },
      });
    } catch (notifErr) {
      this.logger.warn(
        'No se pudo enviar notificacion de recoleccion:',
        notifErr,
      );
    }

    // 5. Auditoria
    this.logger.log(
      `[RECOLECCION] ${numeroRef} | Admin: ${administradorId} | Origen: ${cajaOrigen.nombre} (${cajaOrigenId}) | Destino: ${cajaDestino.nombre} | Monto: ${resultado.montoATransferir} | Tipo: ${esTotal ? 'TOTAL' : 'PARCIAL'}`,
    );

    return {
      origen: cajaOrigen.nombre,
      destino: cajaDestino.nombre,
      monto: resultado.montoATransferir,
      numeroRef,
      transacciones: [resultado.egreso.id, resultado.ingreso.id],
    };
  }

  // =====================
  // DESGLOSE CAJA (Efectivo vs Transferencia)
  // =====================

  /**
   * Devuelve el desglose de pagos de una caja de ruta separando
   * efectivo de transferencia para el cierre de caja del día.
   * Consulta la tabla Pago directamente para obtener el metodoPago.
   */
  async getDesglosePagosCaja(cajaId: string, fecha?: string) {
    const caja = await this.prisma.caja.findUnique({
      where: { id: cajaId },
      select: { rutaId: true, nombre: true, tipo: true },
    });
    if (!caja) {
      return { efectivo: 0, transferencia: 0, total: 0, fecha: null };
    }

    const baseDate = fecha
      ? new Date(fecha.includes('T') ? fecha : `${fecha}T00:00:00`)
      : new Date();
    const fechaKey = getBogotaDayKey(baseDate);
    const { startDate: rangeStart, endDate: rangeEnd } =
      getBogotaStartEndOfDayFromKey(fechaKey);

    // Si es caja de supervisor (rutaId null), calcular desde transacciones
    if (!caja.rutaId) {
      const transaccionesPago = await this.prisma.transaccion.findMany({
        where: {
          cajaId,
          tipoReferencia: 'PAGO',
          tipo: 'INGRESO',
          fechaTransaccion: {
            gte: rangeStart,
            lte: rangeEnd,
          },
        },
        select: {
          monto: true,
        },
      });

      const efectivo = transaccionesPago.reduce(
        (sum, t) => sum + Number(t.monto || 0),
        0,
      );

      return {
        efectivo,
        transferencia: 0,
        total: efectivo,
        fecha: formatBogotaOffsetIso(rangeStart),
        cajaNombre: caja.nombre,
      };
    }

    // Obtener los clienteIds asignados a esta ruta
    const asignaciones = await this.prisma.asignacionRuta.findMany({
      where: { rutaId: caja.rutaId, activa: true },
      select: { clienteId: true },
    });

    if (asignaciones.length === 0) {
      return {
        efectivo: 0,
        transferencia: 0,
        total: 0,
        fecha: formatBogotaOffsetIso(rangeStart),
      };
    }

    const clienteIds = asignaciones.map((a) => a.clienteId);

    const pagos = await this.prisma.pago.findMany({
      where: {
        clienteId: { in: clienteIds },
        fechaPago: { gte: rangeStart, lte: rangeEnd },
      },
      select: { montoTotal: true, metodoPago: true },
    });

    let efectivo = 0;
    let transferencia = 0;

    for (const p of pagos) {
      const monto = Number(p.montoTotal || 0);
      if (p.metodoPago === 'TRANSFERENCIA') {
        transferencia += monto;
      } else {
        efectivo += monto;
      }
    }

    return {
      efectivo,
      transferencia,
      total: efectivo + transferencia,
      fecha: formatBogotaOffsetIso(rangeStart),
      cajaNombre: caja.nombre,
    };
  }

  // =====================
  // RESUMEN FINANCIERO
  // =====================

  async getResumenFinanciero(fechaInicio?: string, fechaFin?: string) {
    const { startDate: inicioHoy, endDate: finHoy } = calculateDateRange(
      'custom',
      fechaInicio
        ? fechaInicio.includes('T')
          ? fechaInicio.split('T')[0]
          : fechaInicio
        : undefined,
      fechaFin
        ? fechaFin.includes('T')
          ? fechaFin.split('T')[0]
          : fechaFin
        : undefined,
    );

    const ledgerDuration = finHoy.getTime() - inicioHoy.getTime();
    const ledgerInicioAnterior = new Date(
      inicioHoy.getTime() - ledgerDuration - 1,
    );
    const ledgerFinAnterior = new Date(inicioHoy.getTime() - 1);

    // Fetch ids of regularized pagos to exclude from cobranza
    const regularizedPagoIds = await this.prisma.pago
      .findMany({
        where: {
          origenGestion: 'CIERRE_PENDIENTE',
        },
        select: { id: true },
      })
      .then((pagos) => pagos.map((p) => p.id));

    // Helper for non-regularized cobranza
    const ledgerCobranzaNoRegularizadaWhere = (start: Date, end: Date) => ({
      OR: [
        { accountCode: { startsWith: '1.1' } },
        { accountCode: { startsWith: '1.2' } },
      ],
      debitAmount: { gt: 0 },
      journalEntry: {
        isOpening: false,
        referenceType: 'PAGO',
        createdAt: { gte: start, lte: end },
        ...(regularizedPagoIds.length
          ? {
              NOT: {
                referenceId: { in: regularizedPagoIds },
              },
            }
          : {}),
      },
    });

    const ledgerPeriodWhere = (
      start: Date,
      end: Date,
      accountPrefix: string,
    ) => ({
      accountCode: { startsWith: accountPrefix },
      journalEntry: {
        isOpening: false,
        createdAt: { gte: start, lte: end },
      },
    });
    const ledgerIncomeOperativoWhere = (start: Date, end: Date) => ({
      accountCode: { startsWith: '3.' },
      NOT: [
        { accountCode: { startsWith: '3.3' } },
        { accountCode: { startsWith: '3.4' } },
      ],
      journalEntry: {
        isOpening: false,
        createdAt: { gte: start, lte: end },
      },
    });
    const ledgerCashIncomeWhere = (start: Date, end: Date) => ({
      OR: [
        { accountCode: { startsWith: '1.1' } },
        { accountCode: { startsWith: '1.2' } },
      ],
      debitAmount: { gt: 0 },
      journalEntry: {
        isOpening: false,
        referenceType: { in: ['PAGO', 'INGRESO', 'VENTA_ARTICULO'] },
        createdAt: { gte: start, lte: end },
      },
    });
    const cuotaInicialIngresoWhere = (start: Date, end: Date) => ({
      fechaTransaccion: { gte: start, lte: end },
      tipo: TipoTransaccion.INGRESO,
      tipoReferencia: { in: ['CUOTA_INICIAL', 'RESTAURACION_CUOTA_INICIAL'] },
    });
    const cuotaInicialReversoWhere = (start: Date, end: Date) => ({
      fechaTransaccion: { gte: start, lte: end },
      tipo: TipoTransaccion.EGRESO,
      tipoReferencia: 'REVERSO_CUOTA_INICIAL',
    });

    const [
      ingresosCajaHoyLedger,
      ingresosHoyLedger,
      interesesHoyLedger,
      moraHoyLedger,
      otrosIngresosHoyLedger,
      articulosHoyLedger,
      gastosHoyLedger,
      costosHoyLedger,
      carteraLedger,
      deudaCobradorLedger,
      cobranzaHoyLedger,
      cobranzaAyerLedger,
      ingresosCajaAyerLedger,
      ingresosAyerLedger,
      gastosAyerLedger,
      costosAyerLedger,
      totalCajasLedger,
      totalRutasCountLedger,
      rutasAbiertasCountLedger,
      rutasPendientesConsolidacionLedger,
      consolidacionesHoyLedger,
      cajasAbiertasCountLedger,
      cuotaInicialHoyIngresoAggLedger,
      cuotaInicialHoyReversoAggLedger,
      cuotaInicialAyerIngresoAggLedger,
      cuotaInicialAyerReversoAggLedger,
      carteraActivaPrestamos,
    ] = await Promise.all([
      this.prisma.journalLine.aggregate({
        where: ledgerCashIncomeWhere(inicioHoy, finHoy),
        _sum: { debitAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerIncomeOperativoWhere(inicioHoy, finHoy),
        _sum: { creditAmount: true, debitAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerPeriodWhere(inicioHoy, finHoy, '3.1'),
        _sum: { creditAmount: true, debitAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerPeriodWhere(inicioHoy, finHoy, '3.2'),
        _sum: { creditAmount: true, debitAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerPeriodWhere(inicioHoy, finHoy, '3.3'),
        _sum: { creditAmount: true, debitAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerPeriodWhere(inicioHoy, finHoy, '3.4'),
        _sum: { creditAmount: true, debitAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerPeriodWhere(inicioHoy, finHoy, '4.'),
        _sum: { debitAmount: true, creditAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerPeriodWhere(inicioHoy, finHoy, '5.'),
        _sum: { debitAmount: true, creditAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: { accountCode: { startsWith: '1.3' } },
        _sum: { debitAmount: true, creditAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: { accountCode: { startsWith: '1.4' } },
        _sum: { debitAmount: true, creditAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerCobranzaNoRegularizadaWhere(inicioHoy, finHoy),
        _sum: { debitAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerCobranzaNoRegularizadaWhere(ledgerInicioAnterior, ledgerFinAnterior),
        _sum: { debitAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerCashIncomeWhere(ledgerInicioAnterior, ledgerFinAnterior),
        _sum: { debitAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerIncomeOperativoWhere(
          ledgerInicioAnterior,
          ledgerFinAnterior,
        ),
        _sum: { creditAmount: true, debitAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerPeriodWhere(ledgerInicioAnterior, ledgerFinAnterior, '4.'),
        _sum: { debitAmount: true, creditAmount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: ledgerPeriodWhere(ledgerInicioAnterior, ledgerFinAnterior, '5.'),
        _sum: { debitAmount: true, creditAmount: true },
      }),
      this.prisma.caja.aggregate({
        where: { activa: true },
        _sum: { saldoActual: true },
      }),
      this.prisma.caja.count({ where: { tipo: 'RUTA', activa: true, rutaId: { not: null } } }),
      this.prisma.caja.count({
        where: {
          tipo: 'RUTA',
          activa: true,
          rutaId: { not: null },
          NOT: {
            transacciones: {
              some: {
                tipoReferencia: 'CIERRE_RUTA',
                fechaTransaccion: { gte: inicioHoy, lte: finHoy },
              },
            },
          },
        },
      }),
      this.prisma.caja.count({
        where: {
          tipo: 'RUTA',
          activa: true,
          rutaId: { not: null },
          NOT: {
            transacciones: {
              some: {
                tipoReferencia: 'CIERRE_RUTA',
                fechaTransaccion: { gte: inicioHoy, lte: finHoy },
              },
            },
          },
        },
      }),
      this.prisma.caja.count({
        where: {
          tipo: 'RUTA',
          activa: true,
          rutaId: { not: null },
          transacciones: {
            some: {
              tipoReferencia: 'CIERRE_RUTA',
              fechaTransaccion: { gte: inicioHoy, lte: finHoy },
            },
          },
        },
      }),
      this.prisma.caja.count({ where: { activa: true } }),
      this.prisma.transaccion.aggregate({
        where: cuotaInicialIngresoWhere(inicioHoy, finHoy),
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: cuotaInicialReversoWhere(inicioHoy, finHoy),
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: cuotaInicialIngresoWhere(
          ledgerInicioAnterior,
          ledgerFinAnterior,
        ),
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: cuotaInicialReversoWhere(
          ledgerInicioAnterior,
          ledgerFinAnterior,
        ),
        _sum: { monto: true },
      }),
      this.prisma.prestamo.aggregate({
        where: {
          eliminadoEn: null,
          saldoPendiente: { gt: 0 },
          estado: { notIn: ['BORRADOR', 'PENDIENTE_APROBACION', 'PAGADO'] },
        },
        _sum: { saldoPendiente: true },
      }),
    ]);

    const ingresosCajaLedger = Number(
      ingresosCajaHoyLedger._sum.debitAmount || 0,
    );
    const ingresosLedger =
      Number(ingresosHoyLedger._sum.creditAmount || 0) -
      Number(ingresosHoyLedger._sum.debitAmount || 0);
    const interesesLedger =
      Number(interesesHoyLedger._sum.creditAmount || 0) -
      Number(interesesHoyLedger._sum.debitAmount || 0);
    const moraLedger =
      Number(moraHoyLedger._sum.creditAmount || 0) -
      Number(moraHoyLedger._sum.debitAmount || 0);
    const otrosIngresosLedger =
      Number(otrosIngresosHoyLedger._sum.creditAmount || 0) -
      Number(otrosIngresosHoyLedger._sum.debitAmount || 0);
    const articulosLedger =
      Number(articulosHoyLedger._sum.creditAmount || 0) -
      Number(articulosHoyLedger._sum.debitAmount || 0);
    const egresosLedger =
      Number(gastosHoyLedger._sum.debitAmount || 0) -
      Number(gastosHoyLedger._sum.creditAmount || 0);
    const costosLedger =
      Number(costosHoyLedger._sum.debitAmount || 0) -
      Number(costosHoyLedger._sum.creditAmount || 0);
    const cobranzaLedger = Number(cobranzaHoyLedger._sum.debitAmount || 0);
    const cobranzaAyerLedgerVal = Number(cobranzaAyerLedger._sum.debitAmount || 0);
    const ingresosCajaAyerLedgerVal = Number(
      ingresosCajaAyerLedger?._sum?.debitAmount || 0,
    );
    const ingresosAyerLedgerVal =
      Number(ingresosAyerLedger?._sum?.creditAmount || 0) -
      Number(ingresosAyerLedger?._sum?.debitAmount || 0);
    const egresosAyerLedgerVal =
      Number(gastosAyerLedger?._sum?.debitAmount || 0) -
      Number(gastosAyerLedger?._sum?.creditAmount || 0);
    const costosAyerLedgerVal =
      Number(costosAyerLedger?._sum?.debitAmount || 0) -
      Number(costosAyerLedger?._sum?.creditAmount || 0);
    const cuotaInicialLedger =
      Number(cuotaInicialHoyIngresoAggLedger._sum.monto || 0) -
      Number(cuotaInicialHoyReversoAggLedger._sum.monto || 0);
    const cuotaInicialAyerLedgerVal =
      Number(cuotaInicialAyerIngresoAggLedger._sum.monto || 0) -
      Number(cuotaInicialAyerReversoAggLedger._sum.monto || 0);
    const capitalEnCallePrestamos = Number(
      carteraActivaPrestamos._sum.saldoPendiente || 0,
    );
    const deudaCobradorLedgerVal =
      Number(deudaCobradorLedger._sum.debitAmount || 0) -
      Number(deudaCobradorLedger._sum.creditAmount || 0);

    const calcularDiferenciaLedger = (actual: number, anterior: number) => {
      if (anterior === 0) return actual > 0 ? 100 : 0;
      return Number((((actual - anterior) / anterior) * 100).toFixed(2));
    };

    // ── Provisión de Cartera ───────────────────────────────────────────────────
    // Calculada sobre el saldo pendiente ACTUAL de préstamos en distintos
    // estados de incumplimiento (independiente del rango de fechas del reporte).
    // Tasas estándar para microcréditos Colombia:
    //   EN_MORA     → 20 %  (1-90 días, en recuperación)
    //   INCUMPLIDO  → 60 %  (90-180 días, alto riesgo)
    //   PERDIDA     → 100 % (>180 días / irrecuperable)
    const { startDate: hoyInicioProvisionBogota } = getBogotaStartEndOfDay(
      new Date(),
    );
    const cuotaVencidaOperativaScope: Prisma.PrestamoWhereInput = {
      cuotas: {
        some: {
          estado: {
            in: [
              EstadoCuota.PENDIENTE,
              EstadoCuota.PARCIAL,
              EstadoCuota.VENCIDA,
            ],
          },
          OR: [
            {
              fechaVencimientoProrroga: null,
              fechaVencimiento: { lt: hoyInicioProvisionBogota },
            },
            {
              fechaVencimientoProrroga: { lt: hoyInicioProvisionBogota },
            },
          ],
        },
      },
    };
    const carteraEnMoraWhere: Prisma.PrestamoWhereInput = {
      eliminadoEn: null,
      saldoPendiente: { gt: 0 },
      estado: {
        notIn: [
          EstadoPrestamo.BORRADOR,
          EstadoPrestamo.PENDIENTE_APROBACION,
          EstadoPrestamo.PAGADO,
          EstadoPrestamo.INCUMPLIDO,
          EstadoPrestamo.PERDIDA,
        ],
      },
      OR: [{ estado: EstadoPrestamo.EN_MORA }, cuotaVencidaOperativaScope],
    };

    const [carteraEnMoraAgg, carteraIncumplidaAgg, carteraPerdidaAgg] =
      await Promise.all([
        this.prisma.prestamo.aggregate({
          where: carteraEnMoraWhere,
          _sum: { saldoPendiente: true },
        }),
        this.prisma.prestamo.aggregate({
          where: { estado: EstadoPrestamo.INCUMPLIDO, eliminadoEn: null },
          _sum: { saldoPendiente: true },
        }),
        this.prisma.prestamo.aggregate({
          where: { estado: EstadoPrestamo.PERDIDA, eliminadoEn: null },
          _sum: { saldoPendiente: true },
        }),
      ]);

    const saldoEnMora = Number(carteraEnMoraAgg._sum.saldoPendiente || 0);
    const saldoIncumplido = Number(
      carteraIncumplidaAgg._sum.saldoPendiente || 0,
    );
    const saldoPerdida = Number(carteraPerdidaAgg._sum.saldoPendiente || 0);
    const cartaraTotalMora = saldoEnMora + saldoIncumplido + saldoPerdida;

    const provisionEnMora = saldoEnMora * 0.2;
    const provisionIncumplida = saldoIncumplido * 0.6;
    const provisionPerdida = saldoPerdida * 1.0;
    const provisionTotal =
      provisionEnMora + provisionIncumplida + provisionPerdida;

    const esUnSoloDiaLedger = ledgerDuration < 24 * 60 * 60 * 1000;
    const porcentajeCierreLedger =
      totalRutasCountLedger > 0
        ? Math.round((consolidacionesHoyLedger / totalRutasCountLedger) * 100)
        : 0;
    const margenArticulosLedger = articulosLedger - costosLedger;
    const ingresosDevengadosLedger =
      interesesLedger + moraLedger + margenArticulosLedger;
    // Utilidad Operativa devengada = Interés + Mora + Margen de artículos − Gastos Operativos.
    // Aportes, inyecciones de capital y otros ingresos externos no son ganancia operativa.
    const utilidadOperativaLedger = ingresosDevengadosLedger - egresosLedger;
    // Utilidad Neta = Utilidad Operativa − Provisión de Cartera
    const utilidadNetaLedger = utilidadOperativaLedger - provisionTotal;

    return {
      // Ingreso de cartera del periodo. No incluye cartera futura, cuota inicial, artículos ni otros ingresos externos.
      ingresosHoy: ingresosLedger,
      // Entrada física de caja, útil para conciliación de efectivo.
      entradasCajaHoy: ingresosCajaLedger,
      // Ingreso contable devengado para margen/utilidad.
      ingresosDevengadosHoy: ingresosDevengadosLedger,
      egresosHoy: egresosLedger,
      costosVentasHoy: costosLedger,
      trasladosInternosHoy: 0,
      cuotaInicialHoy: cuotaInicialLedger,
      cobranzaHoy: cobranzaLedger,
      deudaCobradorHoy: deudaCobradorLedgerVal,
      margenArticulosHoy: margenArticulosLedger,
      ingresosArticulosHoy: articulosLedger,
      interesHoy: interesesLedger,
      moraHoy: moraLedger,
      otrosIngresosHoy: otrosIngresosLedger,
      utilidadOperativa: utilidadOperativaLedger,
      provisionCarteraEnMora: provisionEnMora,
      provisionCarteraIncumplida: provisionIncumplida,
      provisionCarteraPerdida: provisionPerdida,
      provisionCarteraTotal: provisionTotal,
      carteraTotalEnMora: cartaraTotalMora,
      saldoCarteraEnMora: saldoEnMora,
      saldoCarteraIncumplida: saldoIncumplido,
      saldoCarteraPerdida: saldoPerdida,
      utilidadReal: utilidadNetaLedger,
      gananciaNeta: utilidadNetaLedger,
      capitalEnCalle: capitalEnCallePrestamos,
      saldoCajas: Number(totalCajasLedger._sum.saldoActual || 0),
      cajasAbiertasCount: cajasAbiertasCountLedger,
      rutasTotales: totalRutasCountLedger,
      rutasAbiertas: rutasAbiertasCountLedger,
      rutasPendientesConsolidacion: rutasPendientesConsolidacionLedger,
      consolidacionesHoy: consolidacionesHoyLedger,
      porcentajeCierre: porcentajeCierreLedger,
      fecha: formatBogotaOffsetIso(inicioHoy),
      porcentajeIngresosVsAyer: esUnSoloDiaLedger
        ? calcularDiferenciaLedger(ingresosLedger, ingresosAyerLedgerVal)
        : null,
      porcentajeEgresosVsAyer: esUnSoloDiaLedger
        ? calcularDiferenciaLedger(
            egresosLedger + costosLedger,
            egresosAyerLedgerVal + costosAyerLedgerVal,
          )
        : null,
      porcentajeCobranzaVsAyer: esUnSoloDiaLedger
        ? calcularDiferenciaLedger(cobranzaLedger, cobranzaAyerLedgerVal)
        : null,
      porcentajeDeudaCobradorVsAyer: null,
      porcentajeMargenArticulosVsAyer: null,
      porcentajeTrasladosVsAyer: null,
      porcentajeCuotaInicialVsAyer: esUnSoloDiaLedger
        ? calcularDiferenciaLedger(
            cuotaInicialLedger,
            cuotaInicialAyerLedgerVal,
          )
        : null,
      esIngresoPositivo: esUnSoloDiaLedger
        ? ingresosLedger >= ingresosAyerLedgerVal
        : true,
      esEgresoPositivo: esUnSoloDiaLedger
        ? egresosLedger + costosLedger <=
          egresosAyerLedgerVal + costosAyerLedgerVal
        : true,
      esCobranzaPositivo: esUnSoloDiaLedger
        ? cobranzaLedger >= cobranzaAyerLedgerVal
        : true,
      esDeudaCobradorPositivo: true,
      esMargenArticulosPositivo: true,
      esTrasladoPositivo: true,
    };
  }

  // =====================
  // CIERRES
  // =====================

  async getHistorialCierres(filtros?: {
    tipo?: 'ARQUEO' | 'CONSOLIDACION';
    cajaId?: string;
    soloRutas?: boolean;
    estado?: 'CUADRADA' | 'DESCUADRADA';
    fechaInicio?: string;
    fechaFin?: string;
  }) {
    const whereTransaccion: any = {};
    const whereArqueo: any = {};
    const orTransaccion: any[] = [];
    const tipo = filtros?.tipo;
    if (!tipo || tipo === undefined) {
      orTransaccion.push({ tipoReferencia: 'CONSOLIDACION', tipo: 'TRANSFERENCIA' });
      orTransaccion.push({ tipoReferencia: 'ARQUEO' });
      orTransaccion.push({ tipoReferencia: 'CIERRE_RUTA' });
    } else if (tipo === 'CONSOLIDACION') {
      orTransaccion.push({ tipoReferencia: 'CONSOLIDACION', tipo: 'TRANSFERENCIA' });
    }
    whereTransaccion.OR = orTransaccion;
    if (filtros?.cajaId) {
      whereTransaccion.cajaId = filtros.cajaId;
      whereArqueo.cajaId = filtros.cajaId;
    }
    if (filtros?.fechaInicio || filtros?.fechaFin) {
      whereTransaccion.fechaTransaccion = {};
      whereArqueo.creadoEn = {};
      if (filtros.fechaInicio) {
        whereTransaccion.fechaTransaccion.gte = new Date(filtros.fechaInicio);
        whereArqueo.creadoEn.gte = new Date(filtros.fechaInicio);
      }
      if (filtros.fechaFin) {
        whereTransaccion.fechaTransaccion.lte = new Date(filtros.fechaFin);
        whereArqueo.creadoEn.lte = new Date(filtros.fechaFin);
      }
    }
    const [transacciones, arqueos] = await Promise.all([
      this.prisma.transaccion.findMany({
        where: whereTransaccion,
        include: {
          caja: { select: { nombre: true, tipo: true } },
          creadoPor: { select: { nombres: true, apellidos: true } },
        },
        orderBy: { fechaTransaccion: 'desc' },
        take: 100,
      }),
      (tipo === undefined || tipo === 'ARQUEO') ? this.prisma.arqueoCaja.findMany({
        where: whereArqueo,
        include: {
          caja: true,
          responsable: { select: { nombres: true, apellidos: true } },
          creadoPor: { select: { nombres: true, apellidos: true } },
          recibidoPor: { select: { nombres: true, apellidos: true } },
        },
        orderBy: { creadoEn: 'desc' },
        take: 100,
      }) : [],
    ]);

    let mapped: any[] = [];

    // Map transacciones
    mapped = transacciones.map((t) => {
      if (t.tipoReferencia === 'ARQUEO') {
        let saldoSistema = 0;
        let efectivoReal = 0;
        let diferencia = Number(t.monto);
        try {
          const parts = (t.referenciaId || '').split('|');
          for (const p of parts) {
            const [k, v] = p.split(':');
            if (k === 'SS') saldoSistema = Number(v);
            if (k === 'ER') efectivoReal = Number(v);
            if (k === 'DF') diferencia = Number(v);
          }
        } catch (_) {
          void 0;
        }
        return {
          id: t.id,
          fecha: formatBogotaOffsetIso(t.fechaTransaccion),
          caja: t.caja.nombre,
          responsable: `${t.creadoPor.nombres} ${t.creadoPor.apellidos}`,
          saldoSistema,
          saldoReal: efectivoReal,
          diferencia,
          estado: diferencia === 0 ? 'CUADRADA' : 'DESCUADRADA',
          descripcion: t.descripcion,
          tipo: 'ARQUEO',
          referenciaId: t.referenciaId,
          cajaId: t.cajaId,
        };
      }
      if (t.tipoReferencia === 'CIERRE_RUTA') {
        let recaudo = Number(t.monto);
        let meta = 0;
        let efectividad = 0;
        let clientesFaltantes = 0;
        let saldoAlCierre = 0;
        let cobradorNombre = t.creadoPor
          ? `${t.creadoPor.nombres} ${t.creadoPor.apellidos}`
          : 'Sistema';
        try {
          const parts = (t.referenciaId || '').split('|');
          for (const p of parts) {
            const idx = p.indexOf(':');
            const k = p.slice(0, idx);
            const v = p.slice(idx + 1);
            if (k === 'RC') recaudo = Number(v);
            if (k === 'MT') meta = Number(v);
            if (k === 'EF') efectividad = Number(v);
            if (k === 'CF') clientesFaltantes = Number(v);
            if (k === 'SD') saldoAlCierre = Number(v);
            if (k === 'CO') cobradorNombre = v;
          }
        } catch (_) {
          void 0;
        }
        const deudaPorFaltantes =
          clientesFaltantes > 0
            ? Math.max(Number(meta || 0) - Number(recaudo || 0), 0)
            : 0;
        const descuadre = deudaPorFaltantes > 0 || saldoAlCierre > 0;
        return {
          id: t.id,
          fecha: formatBogotaOffsetIso(t.fechaTransaccion),
          caja: t.caja.nombre,
          cajaTipo: t.caja.tipo,
          responsable: cobradorNombre,
          saldoSistema: meta,
          saldoReal: recaudo,
          deudaFisica: saldoAlCierre,
          diferencia: recaudo - meta,
          estado: descuadre ? 'DESCUADRADA' : 'CUADRADA',
          descripcion: t.descripcion,
          tipo: 'CIERRE_RUTA',
          efectividad,
          clientesFaltantes,
          referenciaId: t.referenciaId,
          cajaId: t.cajaId,
        };
      }
      return {
        id: t.id,
        fecha: formatBogotaOffsetIso(t.fechaTransaccion),
        caja: t.caja.nombre,
        responsable: `${t.creadoPor.nombres} ${t.creadoPor.apellidos}`,
        saldoSistema: Number(t.monto),
        saldoReal: Number(t.monto),
        diferencia: 0,
        estado: 'CUADRADA',
        cajaTipo: t.caja.tipo,
        descripcion: t.descripcion,
        tipo: 'CONSOLIDACION',
        referenciaId: t.referenciaId,
        cajaId: t.cajaId,
      };
    });

    // Map arqueos
    const mappedArqueos = arqueos.map((a) => {
      return {
        id: a.id,
        fecha: formatBogotaOffsetIso(a.creadoEn),
        fechaOperativa: a.fechaOperativa,
        caja: a.caja.nombre,
        cajaTipo: a.caja.tipo,
        responsable: a.responsable ? `${a.responsable.nombres} ${a.responsable.apellidos}` : null,
        creadoPor: a.creadoPor ? `${a.creadoPor.nombres} ${a.creadoPor.apellidos}` : null,
        recibidoPor: a.recibidoPor ? `${a.recibidoPor.nombres} ${a.recibidoPor.apellidos}` : null,
        saldoEsperado: Number(a.saldoEsperado),
        efectivoContado: Number(a.efectivoContado),
        diferencia: Number(a.diferencia),
        montoTransferido: Number(a.montoTransferido),
        tipoDiferencia: a.tipoDiferencia,
        estado: a.estado === 'CONFIRMADO' ? (Number(a.diferencia) === 0 ? 'CUADRADA' : 'DESCUADRADA') : 'PENDIENTE',
        descripcion: a.observaciones || 'Arqueo de caja',
        tipo: 'ARQUEO',
        numeroComprobanteTraslado: a.numeroComprobanteTraslado,
        journalEntryId: a.journalEntryId,
        cajaId: a.cajaId,
        rutaId: a.rutaId,
        // Incluir campos para el modal de detalle y la impresión
        cajaOrigen: {
          id: a.cajaId,
          nombre: a.caja.nombre,
          saldoAnterior: Number(a.saldoEsperado),
          salida: Number(a.saldoEsperado),
          saldoNuevo: Number(a.saldoEsperado) - Number(a.montoTransferido || 0),
        },
        cajaDestino: {
          nombre: 'Caja Principal',
          ingreso: Number(a.montoTransferido),
          saldoNuevo: null,
        },
      };
    });

    // Merge and sort by date descending
    mapped = [...mapped, ...mappedArqueos].sort((a, b) => {
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    }).slice(0, 200);

    // Filtro opcional por estado
    if (filtros?.estado) {
      if (filtros.estado === 'DESCUADRADA') {
        mapped = mapped.filter((m) => m.estado === 'DESCUADRADA');
      } else if (filtros.estado === 'CUADRADA') {
        mapped = mapped.filter((m) => m.estado === 'CUADRADA');
      }
    }
    // Filtro opcional: solo cajas de rutas (cobradores)
    if (filtros?.soloRutas) {
      mapped = mapped.filter((m: any) => m.cajaTipo === 'RUTA');
    }
    return mapped;
  }

  private async assertNoOfflinePendienteAntesArqueo(
    caja: any,
    cierreTimestamp: Date,
  ) {
    const usuarioIds = [caja?.responsableId].filter(Boolean);
    const pendingSyncCount = await this.prisma.colaSincronizacion.count({
      where: {
        estado: { in: ['PENDIENTE', 'ERROR', 'CONFLICTO'] as any },
        creadoEn: { lte: cierreTimestamp },
        ...(usuarioIds.length ? { usuarioCreadorId: { in: usuarioIds } } : {}),
      },
    });

    const pendingConflictCount = await this.prisma.syncConflict.count({
      where: {
        estadoResolucion: 'PENDIENTE',
        creadoEn: { lte: cierreTimestamp },
        ...(usuarioIds.length ? { creadoPorId: { in: usuarioIds } } : {}),
      },
    });

    if (pendingSyncCount > 0 || pendingConflictCount > 0) {
      throw new BadRequestException(
        `No se puede registrar el arqueo: existen ${pendingSyncCount + pendingConflictCount} registros offline/conflictos pendientes anteriores al cierre.`,
      );
    }
  }

  private async getCandidatosSobranteRuta(caja: any, cierreTimestamp: Date) {
    if (!caja?.rutaId) {
      return [];
    }

    const diaKey = getBogotaDayKey(cierreTimestamp);
    const { startDate: inicioHoy, endDate: finHoy } =
      getBogotaStartEndOfDayFromKey(diaKey);
    const inicioAyer = new Date(inicioHoy.getTime() - 86_400_000);

    const cuotas = await this.prisma.cuota.findMany({
      where: {
        fechaVencimiento: { gte: inicioAyer, lte: finHoy },
        estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL'] as any },
        prestamo: {
          estado: { in: ['ACTIVO', 'EN_MORA'] as any },
          eliminadoEn: null,
          cliente: {
            asignacionesRuta: {
              some: {
                rutaId: caja.rutaId,
                activa: true,
              },
            },
          },
        },
      },
      include: {
        prestamo: {
          select: {
            id: true,
            numeroPrestamo: true,
            cliente: {
              select: { id: true, nombres: true, apellidos: true },
            },
            pagos: {
              orderBy: { fechaPago: 'desc' },
              take: 1,
              select: { fechaPago: true },
            },
          },
        },
      },
      orderBy: { fechaVencimiento: 'asc' },
      take: 25,
    });

    return cuotas
      .filter((cuota: any) => {
        const ultimoPago = cuota?.prestamo?.pagos?.[0]?.fechaPago;
        return (
          !ultimoPago || new Date(ultimoPago).getTime() < inicioHoy.getTime()
        );
      })
      .map((cuota: any) => ({
        cuotaId: cuota.id,
        numeroCuota: cuota.numeroCuota,
        fechaVencimiento: formatBogotaOffsetIso(cuota.fechaVencimiento),
        monto: Number(cuota.monto || 0),
        montoPagado: Number(cuota.montoPagado || 0),
        saldoCuota: Math.max(
          0,
          Number(cuota.monto || 0) - Number(cuota.montoPagado || 0),
        ),
        prestamoId: cuota.prestamo.id,
        numeroPrestamo: cuota.prestamo.numeroPrestamo,
        clienteId: cuota.prestamo.cliente.id,
        cliente:
          `${cuota.prestamo.cliente.nombres} ${cuota.prestamo.cliente.apellidos}`.trim(),
      }));
  }

  async registrarArqueo(
    cajaId: string,
    data: {
      efectivoReal: number;
      saldoSistema: number;
      diferencia: number;
      observaciones?: string;
    },
    userId: string,
  ) {
    const caja = await this.prisma.caja.findUnique({ where: { id: cajaId } });
    if (!caja) throw new NotFoundException('Caja no encontrada');

    const cierreTimestamp = new Date();
    await this.assertNoOfflinePendienteAntesArqueo(caja, cierreTimestamp);

    const montoAjuste = Math.abs(Number(data.diferencia || 0));
    const referenciaId = `SS:${Number(data.saldoSistema)}|ER:${Number(data.efectivoReal)}|DF:${Number(data.diferencia)}`;
    const descripcionBase = 'Arqueo de Caja';
    const descripcion = data.observaciones
      ? `${descripcionBase}: ${data.observaciones}`
      : descripcionBase;

    // Si no hay diferencia, registramos evento neutro para historial (monto 0)
    if (montoAjuste === 0) {
      return this.prisma.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion('ARQ'),
          cajaId,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto: 0,
          descripcion,
          creadoPorId: userId,
          tipoReferencia: 'ARQUEO',
          referenciaId,
        },
      });
    }

    const candidatosSobrante =
      Number(data.diferencia) > 0
        ? await this.getCandidatosSobranteRuta(caja, cierreTimestamp)
        : [];

    // Con diferencia: registrar ajuste como ingreso/egreso para cuadrar
    const tipoAjuste =
      Number(data.diferencia) > 0
        ? TipoTransaccion.INGRESO
        : TipoTransaccion.EGRESO;

    return this.prisma.$transaction(async (tx) => {
      // 1. Crear transacción histórica
      const transaccion = await tx.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion('ARQ'),
          cajaId,
          tipo: tipoAjuste,
          monto: montoAjuste,
          descripcion,
          creadoPorId: userId,
          tipoReferencia: 'ARQUEO',
          referenciaId,
        },
      });

      // 2. Registrar asiento contable y ajustar saldo
      await this.ledgerService.registrarArqueoDescuadre(
        {
          arqueoId: transaccion.id,
          diferencia: Number(data.diferencia),
          cajaId,
          createdBy: userId,
        },
        tx,
      );

      return {
        ...transaccion,
        ...(Number(data.diferencia) > 0
          ? {
              alertaSobrante: {
                mensaje:
                  'Hay sobrante de efectivo. Revise posibles clientes en mora reciente de esta ruta.',
                candidatos: candidatosSobrante,
              },
            }
          : {}),
      };
    });
  }

  // =====================
  // GASTOS
  // =====================

  async getGastos(filtros: {
    rutaId?: string;
    estado?: string;
    page?: number;
    limit?: number;
    fechaInicio?: string;
    fechaFin?: string;
    esProvisional?: boolean;
  }) {
    const {
      rutaId,
      estado,
      page = 1,
      limit = 50,
      fechaInicio,
      fechaFin,
      esProvisional,
    } = filtros;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (rutaId) where.rutaId = rutaId;
    if (estado) where.estadoAprobacion = estado;
    if (esProvisional !== undefined) where.esProvisional = esProvisional;
    if (fechaInicio || fechaFin) {
      where.fechaGasto = {};
      if (fechaInicio) {
        const startKey = getBogotaDayKey(new Date(fechaInicio));
        where.fechaGasto.gte =
          getBogotaStartEndOfDayFromKey(startKey).startDate;
      }
      if (fechaFin) {
        const endKey = getBogotaDayKey(new Date(fechaFin));
        where.fechaGasto.lte = getBogotaStartEndOfDayFromKey(endKey).endDate;
      }
    }

    const [gastos, total] = await Promise.all([
      this.prisma.gasto.findMany({
        where,
        skip,
        take: limit,
        include: {
          cobrador: { select: { nombres: true, apellidos: true } },
          ruta: { select: { nombre: true } },
          caja: { select: { nombre: true } },
          categoria: { select: { nombre: true } },
        },
        orderBy: { fechaGasto: 'desc' },
      }),
      this.prisma.gasto.count({ where }),
    ]);

    return {
      data: gastos.map((g) => ({
        id: g.id,
        numero: g.numeroGasto,
        fecha: formatBogotaOffsetIso(g.fechaGasto),
        tipo: g.tipoGasto,
        monto: Number(g.monto),
        descripcion: g.descripcion,
        cobradorId: g.cobradorId,
        cobrador: `${g.cobrador.nombres} ${g.cobrador.apellidos}`,
        ruta: g.ruta?.nombre || 'Sin ruta',
        caja: g.caja.nombre,
        categoriaId: g.categoriaId || null,
        categoria: g.categoria?.nombre || null,
        estado: g.estadoAprobacion,
        esProvisional: g.esProvisional,
        resultadoRevisionGasto: g.resultadoRevisionGasto,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async exportAccountingReport(
    format: 'excel' | 'pdf',
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const [cajas, journalEntries] = await Promise.all([
      this.prisma.caja.findMany({
        where: { activa: true },
        include: {
          responsable: { select: { nombres: true, apellidos: true } },
          ruta: { select: { nombre: true } },
        },
        orderBy: { creadoEn: 'desc' },
      }),
      this.prisma.journalEntry.findMany({
        include: {
          lines: {
            include: {
              account: { select: { name: true } },
            },
            orderBy: { accountCode: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    const usuarioIds = [
      ...new Set(
        journalEntries.map((entry: any) => entry.createdBy).filter(Boolean),
      ),
    ];
    const cajaIds = [
      ...new Set(
        journalEntries
          .flatMap((entry: any) => entry.lines || [])
          .map((line: any) => line.cajaId)
          .filter(Boolean),
      ),
    ];

    const [usuarios, cajasMovimientos] = await Promise.all([
      usuarioIds.length
        ? this.prisma.usuario.findMany({
            where: { id: { in: usuarioIds } },
            select: { id: true, nombres: true, apellidos: true },
          })
        : Promise.resolve([]),
      cajaIds.length
        ? this.prisma.caja.findMany({
            where: { id: { in: cajaIds } },
            select: { id: true, nombre: true, tipo: true },
          })
        : Promise.resolve([]),
    ]);

    const usuariosMap = new Map(
      usuarios.map((u: any) => [u.id, `${u.nombres} ${u.apellidos}`]),
    );
    const cajasMap = new Map<
      string,
      { id: string; nombre: string; tipo: TipoCaja }
    >(cajasMovimientos.map((c: any) => [c.id, c]));

    const fecha = getBogotaDayKey(new Date());

    const filasCjas: CajaRow[] = cajas.map((c: any) => ({
      nombre: c.nombre,
      codigo: c.codigo,
      tipo: c.tipo,
      responsable: c.responsable
        ? `${c.responsable.nombres} ${c.responsable.apellidos}`
        : 'Sin asignar',
      ruta: c.ruta?.nombre || 'N/A',
      saldo: Number(c.saldoActual),
      tipoCaja:
        c.tipo === 'RUTA' && !c.rutaId
          ? 'SUPERVISOR'
          : c.tipo === 'RUTA'
            ? 'COBRADOR'
            : c.codigo === 'CAJA-PRINCIPAL'
              ? 'PRINCIPAL'
              : 'EMPRESA',
    }));

    const filasTransacciones: TransaccionRow[] = journalEntries.map(
      (entry: any) => {
        const totalDebito = (entry.lines || []).reduce(
          (sum: number, line: any) => sum + Number(line.debitAmount || 0),
          0,
        );
        const cajasEntry = (entry.lines || [])
          .map((line: any) =>
            line.cajaId ? cajasMap.get(line.cajaId)?.nombre : null,
          )
          .filter(Boolean);
        const cuentas = (entry.lines || [])
          .map((line: any) =>
            `${line.accountCode} ${line.account?.name || ''}`.trim(),
          )
          .join(' / ');

        return {
          fecha: entry.createdAt,
          tipo: entry.referenceType,
          monto: totalDebito,
          descripcion: entry.description || cuentas,
          caja: [...new Set(cajasEntry)].join(', '),
          usuario: usuariosMap.get(entry.createdBy) || entry.createdBy || '',
          tipoCaja: '',
          estadoAprobacion: 'APROBADO',
          metodoPago: '',
        };
      },
    );

    if (format === 'excel')
      return generarExcelContable(filasCjas, filasTransacciones, fecha);
    if (format === 'pdf')
      return generarPDFContable(filasCjas, filasTransacciones, fecha);

    throw new Error(`Formato no soportado: ${format}`);
  }

  async exportGastos(
    format: 'excel' | 'pdf',
    filters: { rutaId?: string; fechaInicio?: string; fechaFin?: string },
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const where: any = {};
    if (filters.rutaId) where.rutaId = filters.rutaId;
    if (filters.fechaInicio || filters.fechaFin) {
      where.fechaGasto = {};
      if (filters.fechaInicio) {
        const startKey = getBogotaDayKey(new Date(filters.fechaInicio));
        where.fechaGasto.gte =
          getBogotaStartEndOfDayFromKey(startKey).startDate;
      }
      if (filters.fechaFin) {
        const endKey = getBogotaDayKey(new Date(filters.fechaFin));
        where.fechaGasto.lte = getBogotaStartEndOfDayFromKey(endKey).endDate;
      }
    }

    const gastos = await this.prisma.gasto.findMany({
      where,
      include: {
        cobrador: { select: { nombres: true, apellidos: true } },
        ruta: { select: { nombre: true } },
        categoria: { select: { nombre: true } },
      },
      orderBy: { fechaGasto: 'desc' },
      take: 5000,
    });

    const filasGastos: GastoRow[] = gastos.map((g) => ({
      numero: g.numeroGasto,
      fecha: formatBogotaOffsetIso(g.fechaGasto),
      cobrador: `${g.cobrador.nombres} ${g.cobrador.apellidos}`,
      ruta: g.ruta?.nombre || 'Sin ruta',
      tipo: g.tipoGasto,
      categoria: g.categoria?.nombre || null,
      descripcion: g.descripcion,
      monto: Number(g.monto),
      estado: g.estadoAprobacion,
    }));

    const totales: GastosTotales = {
      totalGastos: filasGastos.reduce((sum, g) => sum + g.monto, 0),
      cantidadGastos: filasGastos.length,
      totalOperativos: filasGastos
        .filter((g) => g.tipo === 'OPERATIVO')
        .reduce((sum, g) => sum + g.monto, 0),
      totalPersonales: filasGastos
        .filter((g) => g.tipo === 'PERSONAL')
        .reduce((sum, g) => sum + g.monto, 0),
    };

    const fecha = getBogotaDayKey(new Date());

    if (format === 'excel')
      return generarExcelGastos(filasGastos, totales, fecha);
    if (format === 'pdf') return generarPDFGastos(filasGastos, totales, fecha);

    throw new Error(`Formato no soportado: ${format}`);
  }

  /**
   * =====================================================
   * DEUDAS DE COBRADORES
   * =====================================================
   * Consolida las deudas de cada cobrador a nivel de persona,
   * no de caja. Las fuentes son:
   *   1. Gastos con tipoGasto = 'PERSONAL' aprobados (adelantos de nómina).
   *   2. Diferencias negativas en arqueos (diferencia < 0 = cobrador debe plata).
   * =====================================================
   */
  async getDeudoresCobrador() {
    const debtLines = await this.prisma.journalLine.findMany({
      where: { accountCode: { startsWith: '1.4' } },
      include: {
        journalEntry: {
          select: {
            id: true,
            referenceType: true,
            referenceId: true,
            description: true,
            createdAt: true,
          },
        },
      },
      orderBy: { journalEntry: { createdAt: 'desc' } },
    });

    // También buscar deudas registradas directamente en Transaccion (cierre de ruta vía gateway)
    // Incluye CIERRE_RUTA para capturar cierres previos que no generaron DEUDA_COBRADOR
    const deudaTransacciones = await this.prisma.transaccion.findMany({
      where: {
        tipoReferencia: {
          in: ['DEUDA_COBRADOR', 'ABONO_DEUDA', 'CIERRE_RUTA'],
        },
      },
      select: {
        id: true,
        cajaId: true,
        monto: true,
        descripcion: true,
        tipoReferencia: true,
        referenciaId: true,
        fechaTransaccion: true,
        tipo: true,
        caja: {
          select: {
            ruta: { select: { cobradorId: true } },
            responsable: { select: { id: true, rol: true } },
          },
        },
      },
      orderBy: { fechaTransaccion: 'desc' },
    });

    const deudaMap = new Map<
      string,
      { descuadres: number; gastosPersonales: number; totalEventos: number }
    >();
    const eventosMap = new Map<
      string,
      Array<{
        id: string;
        tipoReferencia: string;
        monto: number;
        fecha: Date;
        cajaId: string;
        referenciaId?: string;
        descripcion?: string;
      }>
    >();

    const ensureDebt = (cobradorId: string) => {
      const prev = deudaMap.get(cobradorId) || {
        descuadres: 0,
        gastosPersonales: 0,
        totalEventos: 0,
      };
      deudaMap.set(cobradorId, prev);
      return prev;
    };

    // 1. Procesar líneas del ledger (flujo contable normal)
    if (debtLines.length > 0) {
      const arqueoReferenceIds = [
        ...new Set(
          debtLines
            .filter(
              (line: any) => line.journalEntry?.referenceType === 'ARQUEO',
            )
            .map((line: any) => line.journalEntry?.referenceId)
            .filter(Boolean),
        ),
      ];

      const arqueoTransacciones = arqueoReferenceIds.length
        ? await this.prisma.transaccion.findMany({
            where: { id: { in: arqueoReferenceIds } },
            select: {
              id: true,
              cajaId: true,
              descripcion: true,
              caja: {
                select: {
                  ruta: { select: { cobradorId: true } },
                  responsableId: true,
                  responsable: { select: { id: true, rol: true } },
                },
              },
            },
          })
        : [];

      const transaccionMap = new Map(
        arqueoTransacciones.map((t: any) => [t.id, t]),
      );

      for (const line of debtLines as any[]) {
        const entry = line.journalEntry;
        if (!entry) continue;

        let cobradorId: string | null = null;
        let cajaId = '';
        let descripcion = entry.description || '';

        if (entry.referenceType === 'ABONO_DEUDA') {
          cobradorId = String(entry.referenceId || '').split('|')[0] || null;
        } else if (entry.referenceType === 'ARQUEO') {
          const trx: any = transaccionMap.get(entry.referenceId);
          cobradorId =
            trx?.caja?.ruta?.cobradorId ||
            (trx?.caja?.responsable?.rol === 'SUPERVISOR'
              ? trx.caja.responsableId
              : null);
          cajaId = trx?.cajaId || '';
          descripcion = descripcion || trx?.descripcion || '';
        }

        if (!cobradorId) continue;

        const debit = Number(line.debitAmount || 0);
        const credit = Number(line.creditAmount || 0);
        const delta = debit - credit;
        const prev = ensureDebt(cobradorId);
        prev.descuadres += delta;
        prev.totalEventos += 1;
        deudaMap.set(cobradorId, prev);

        const arr = eventosMap.get(cobradorId) || [];
        arr.push({
          id: entry.id,
          tipoReferencia: String(entry.referenceType),
          monto: Math.abs(delta),
          fecha: entry.createdAt,
          cajaId,
          referenciaId: entry.referenceId,
          descripcion,
        });
        eventosMap.set(cobradorId, arr);
      }
    }

    // 2. Procesar transacciones directas de DEUDA_COBRADOR / ABONO_DEUDA / CIERRE_RUTA
    // Solo contar las que NO tienen entrada correspondiente en el ledger (evitar doble conteo)
    const ledgerRefIds = new Set(
      debtLines
        .filter(
          (line: any) =>
            line.journalEntry?.referenceType === 'DEUDA_COBRADOR' ||
            line.journalEntry?.referenceType === 'ABONO_DEUDA',
        )
        .map((line: any) => line.journalEntry?.referenceId)
        .filter(Boolean),
    );

    // Track which CIERRE_RUTA ids already have a corresponding DEUDA_COBRADOR (avoid double count)
    const cierreIdsConDeuda = new Set(
      deudaTransacciones
        .filter(
          (t: any) =>
            String(t.tipoReferencia) === 'DEUDA_COBRADOR' && t.referenciaId,
        )
        .map((t: any) => {
          // Extraer el referenciaId del cierre del campo DD del DEUDA_COBRADOR
          const match = String(t.referenciaId || '').match(
            /DD:\d+\|SD:\d+\|FD:\d+\|(.+)/,
          );
          return match ? match[1] : null;
        })
        .filter(Boolean),
    );

    // Obtener saldos actuales de cajas de ruta activas de cada cobrador
    const cajasRuta = await this.prisma.caja.findMany({
      where: { tipo: 'RUTA', activa: true },
      select: {
        id: true,
        saldoActual: true,
        responsableId: true,
        responsable: {
          select: {
            id: true,
            rol: true,
          },
        },
        ruta: {
          select: {
            cobradorId: true,
          },
        },
      },
    });

    const activeCajaIds = new Set(cajasRuta.map(c => c.id));
    const processedReferences = new Set<string>();
    const cajasProcesadas = new Set<string>();

    for (const trx of deudaTransacciones) {
      const tipoRef = String(trx.tipoReferencia);
      const isAbono = tipoRef === 'ABONO_DEUDA';
      const isCierreRuta = tipoRef === 'CIERRE_RUTA';
      let cobradorId: string | null = null;
      let montoDeuda = 0;
      let esFormatoCierre = false;
      let saldoAlCierre = 0;

      if (isCierreRuta && trx.referenciaId && cierreIdsConDeuda.has(trx.referenciaId)) {
        continue; // Omitir el cierre de ruta redundante si ya existe una DEUDA_COBRADOR correspondiente
      }

      if (isAbono) {
        // ABONO_DEUDA: referenciaId = "cobradorId|nombre"
        cobradorId = String(trx.referenciaId || '').split('|')[0] || null;
        montoDeuda = Number(trx.monto || 0);
      } else {
        // DEUDA_COBRADOR / CIERRE_RUTA: obtener cobradorId desde la caja/ruta
        cobradorId = trx?.caja?.ruta?.cobradorId || null;

        // Si no hay ruta (caja de supervisor), usar responsableId
        if (!cobradorId && trx?.caja?.responsable?.rol === 'SUPERVISOR') {
          cobradorId = trx.caja.responsable.id;
        }

        // Evitar duplicados por concurrencia
        if (trx.referenciaId) {
          if (processedReferences.has(trx.referenciaId)) {
            continue;
          }
          processedReferences.add(trx.referenciaId);
        }

        saldoAlCierre = Number(trx.monto || 0);
        if (trx.referenciaId) {
          const sdMatch = String(trx.referenciaId).match(/SD:(\d+)/);
          if (sdMatch) {
            saldoAlCierre = Number(sdMatch[1]);
            esFormatoCierre = true;
          } else if (isCierreRuta) {
            esFormatoCierre = true;
          }
        } else if (isCierreRuta) {
          esFormatoCierre = true;
        }

        if (esFormatoCierre) {
          if (cajasProcesadas.has(trx.cajaId)) {
            continue; // Solo queremos el cierre de caja de ruta más reciente en el historial/total
          }
          cajasProcesadas.add(trx.cajaId);
        }

        montoDeuda = esFormatoCierre ? saldoAlCierre : Number(trx.monto || 0);
      }

      if (!cobradorId) continue;

      // Si ya existe en el ledger con el mismo referenciaId, no contar dos veces
      if (trx.referenciaId && ledgerRefIds.has(trx.referenciaId)) continue;

      if (montoDeuda <= 0 && !isAbono) continue;

      const delta = isAbono ? -montoDeuda : montoDeuda;
      const prev = ensureDebt(cobradorId);
      
      // Si pertenece a una caja activa de ruta, el saldo actual de esa caja se sumará al final en tiempo real.
      // Así evitamos duplicar la deuda acumulada de esa caja.
      const omitirDeudaAcumulada = !isAbono && esFormatoCierre && activeCajaIds.has(trx.cajaId);
      if (!omitirDeudaAcumulada) {
        prev.descuadres += delta;
      }
      
      prev.totalEventos += 1;
      deudaMap.set(cobradorId, prev);

      const arr = eventosMap.get(cobradorId) || [];
      arr.push({
        id: trx.id,
        tipoReferencia: tipoRef,
        monto: Math.abs(delta),
        fecha: trx.fechaTransaccion,
        cajaId: trx.cajaId || '',
        referenciaId: trx.referenciaId,
        descripcion: trx.descripcion || '',
      });
      eventosMap.set(cobradorId, arr);
    }

    const cobradorIds = [...deudaMap.keys()];
    
    const saldosCajasMap = new Map<string, number>();
    for (const caja of cajasRuta) {
      const cid =
        caja.ruta?.cobradorId ||
        (caja.responsable?.rol === 'SUPERVISOR' ? caja.responsableId : null);

      if (cid) {
        const actual = saldosCajasMap.get(cid) || 0;
        saldosCajasMap.set(cid, actual + Number(caja.saldoActual || 0));
      }
    }

    // Asegurar que todos los cobradores con saldo estén en deudaMap
    for (const cid of saldosCajasMap.keys()) {
      ensureDebt(cid);
    }

    const finalCobradorIds = [...deudaMap.keys()];
    if (finalCobradorIds.length === 0) return [];

    const cobradores = await this.prisma.usuario.findMany({
      where: { id: { in: finalCobradorIds } },
      select: { id: true, nombres: true, apellidos: true, rol: true },
    });
    const cobradorMap = new Map(cobradores.map((c: any) => [c.id, c]));

    return Array.from(deudaMap.entries())
      .map(([cobradorId, deuda]) => {
        const cobrador: any = cobradorMap.get(cobradorId);
        const saldoCajaActual = saldosCajasMap.get(cobradorId) || 0;
        
        // Deuda real solo viene de ledger 1.4.x y eventos DEUDA_COBRADOR/ABONO_DEUDA/CIERRE_RUTA
        // NO incluye saldo de caja actual (eso es efectivo bajo custodia, no deuda)
        const descuadres = Math.max(
          0,
          Math.round(Number(deuda.descuadres || 0)),
        );
        const gastosPersonales = Math.max(
          0,
          Math.round(Number(deuda.gastosPersonales || 0)),
        );
        const deudaReal = descuadres + gastosPersonales;
        const efectivoBajoCustodia = saldoCajaActual;
        
        return {
          cobradorId,
          nombreCobrador: cobrador
            ? `${cobrador.nombres} ${cobrador.apellidos}`
            : 'Desconocido',
          rol: cobrador?.rol || 'COBRADOR',
          totalDeuda: deudaReal,
          gastosPersonales,
          descuadres,
          efectivoBajoCustodia,
          totalEventos: deuda.totalEventos,
          eventos: (eventosMap.get(cobradorId) || []).slice(0, 25),
        };
      })
      .filter((d) => Number(d.totalDeuda || 0) > 0 || Number(d.efectivoBajoCustodia || 0) > 0)
      .sort((a, b) => b.efectivoBajoCustodia - a.efectivoBajoCustodia || b.totalDeuda - a.totalDeuda);
  }

  /**
   * =====================================================
   * REGISTRAR ABONO (PAGO FÍSICO DE DEUDA DE COBRADOR)
   * =====================================================
   */
  async registrarAbonoDeuda(
    cobradorId: string,
    monto: number,
    nota: string,
    userId: string,
    cajaIdDestino?: string,
  ) {
    const cobrador = await this.prisma.usuario.findUnique({
      where: { id: cobradorId },
    });
    if (!cobrador) throw new NotFoundException('Cobrador no encontrado');

    const montoClean = Number(monto || 0);
    if (!(montoClean > 0)) throw new BadRequestException('Monto inválido');

    // 1. Resolver caja destino (por defecto Caja Principal)
    let cajaDestino = null as any;
    if (cajaIdDestino) {
      cajaDestino = await this.prisma.caja.findUnique({
        where: { id: cajaIdDestino },
      });
      if (!cajaDestino)
        throw new NotFoundException('Caja destino no encontrada');
    } else {
      cajaDestino = await this.prisma.caja.findFirst({
        where: { codigo: 'CAJA-OFICINA' },
      });
      if (!cajaDestino) {
        cajaDestino = await this.prisma.caja.findFirst({
          where: { codigo: 'CAJA-PRINCIPAL' },
        });
      }
      if (!cajaDestino)
        throw new Error(
          'No existe Caja Oficina/Caja Principal para registrar el ingreso',
        );
    }

    // 2. Ejecutar transacción contable
    return this.prisma.$transaction(async (tx) => {
      // a. Crear la transacción INGRESO (histórico)
      const transaccion = await tx.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion('ABN'),
          cajaId: cajaDestino.id,
          tipo: TipoTransaccion.INGRESO,
          monto: montoClean,
          descripcion: `Abono de deuda pendiente - Cobrador: ${cobrador.nombres} ${cobrador.apellidos}${nota ? ' - ' + nota : ''}`,
          creadoPorId: userId,
          tipoReferencia: 'ABONO_DEUDA',
          referenciaId: `${cobradorId}|${cobrador.nombres} ${cobrador.apellidos}`,
        },
      });

      // b. Registrar asiento contable (Ledger mueve el saldo de la caja)
      await this.ledgerService.registrarAbonoDeuda(
        {
          cobradorId,
          monto: montoClean,
          cajaId: cajaDestino.id,
          accountCode: cajaDestino.tipo === 'RUTA' ? '1.2.1' : '1.1.1',
          createdBy: userId,
        },
        tx,
      );

      return transaccion;
    });
  }

  async repararCajaOficinaIngresosMalAsignados(params?: { dryRun?: boolean }) {
    const dryRun = Boolean(params?.dryRun);

    const existenAsientos = await this.prisma.journalEntry.count();
    if (existenAsientos > 0 && !dryRun) {
      throw new BadRequestException(
        'Esta reparación solo puede ejecutarse en datos pre-Ledger. ' +
          'El libro mayor ya tiene asientos. Use dryRun=true para auditar sin modificar.',
      );
    }

    const cajaOficina = await this.prisma.caja.findFirst({
      where: { activa: true, codigo: 'CAJA-OFICINA' },
      select: { id: true, codigo: true },
    });
    if (!cajaOficina) throw new NotFoundException('Caja Oficina no encontrada');

    const cajasOrigen = await this.prisma.caja.findMany({
      where: {
        activa: true,
        codigo: { in: ['CAJA-PRINCIPAL', 'CAJA-BANCO'] },
      },
      select: { id: true, codigo: true },
    });

    const cajasOrigenIds = cajasOrigen.map((c) => c.id);
    if (!cajasOrigenIds.length) {
      return {
        dryRun,
        cajaOficinaId: cajaOficina.id,
        movimientosEncontrados: 0,
        movimientosMovidos: 0,
        deltaPorCaja: {},
      };
    }

    const refs = ['CUOTA_INICIAL', 'ABONO_DEUDA'] as const;

    const transacciones = await this.prisma.transaccion.findMany({
      where: {
        cajaId: { in: cajasOrigenIds },
        tipoReferencia: { in: refs as unknown as string[] },
      },
      select: {
        id: true,
        cajaId: true,
        tipo: true,
        monto: true,
        tipoReferencia: true,
      },
      orderBy: { fechaTransaccion: 'asc' },
    });

    const deltaPorCaja: Record<string, Prisma.Decimal> = {};
    const deltaOficina = new Prisma.Decimal(0);
    let deltaOficinaAcc = deltaOficina;

    for (const t of transacciones) {
      const monto = new Prisma.Decimal(t.monto);
      const tipo = String(t.tipo || '').toUpperCase();

      let deltaOrigen = new Prisma.Decimal(0);
      let deltaDestino = new Prisma.Decimal(0);

      if (tipo === 'INGRESO') {
        deltaOrigen = monto.mul(-1);
        deltaDestino = monto;
      } else if (tipo === 'EGRESO') {
        deltaOrigen = monto;
        deltaDestino = monto.mul(-1);
      } else {
        continue;
      }

      deltaPorCaja[t.cajaId] = (
        deltaPorCaja[t.cajaId] || new Prisma.Decimal(0)
      ).add(deltaOrigen);
      deltaOficinaAcc = deltaOficinaAcc.add(deltaDestino);
    }

    deltaPorCaja[cajaOficina.id] = (
      deltaPorCaja[cajaOficina.id] || new Prisma.Decimal(0)
    ).add(deltaOficinaAcc);

    if (dryRun) {
      return {
        dryRun,
        cajaOficinaId: cajaOficina.id,
        movimientosEncontrados: transacciones.length,
        movimientosMovidos: 0,
        deltaPorCaja: Object.fromEntries(
          Object.entries(deltaPorCaja).map(([k, v]) => [k, v.toNumber()]),
        ),
        transaccionesIds: transacciones.map((t) => t.id),
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaccion.updateMany({
        where: {
          cajaId: { in: cajasOrigenIds },
          tipoReferencia: { in: refs as unknown as string[] },
        },
        data: { cajaId: cajaOficina.id },
      });

      for (const [cajaId, delta] of Object.entries(deltaPorCaja)) {
        if (delta.isZero()) continue;
        await tx.caja.update({
          where: { id: cajaId },
          data: {
            saldoActual: {
              increment: delta,
            },
          },
        });
      }
    });

    return {
      dryRun,
      cajaOficinaId: cajaOficina.id,
      movimientosEncontrados: transacciones.length,
      movimientosMovidos: transacciones.length,
      deltaPorCaja: Object.fromEntries(
        Object.entries(deltaPorCaja).map(([k, v]) => [k, v.toNumber()]),
      ),
    };
  }

  async migrarHistoricoLedger(params: { dryRun: boolean; userId: string }) {
    const firstEntry = await this.prisma.journalEntry.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    const fechaCorte = firstEntry?.createdAt ?? null;
    const where: any = {};
    if (fechaCorte) {
      where.fechaTransaccion = { lt: fechaCorte };
    }

    const transacciones = await this.prisma.transaccion.findMany({
      where,
      include: {
        caja: { select: { id: true, codigo: true, tipo: true, nombre: true } },
      },
      orderBy: { fechaTransaccion: 'asc' },
      take: 10000,
    });

    const existingEntries = await this.prisma.journalEntry.findMany({
      select: { referenceType: true, referenceId: true },
    });
    const existingKeys = new Set(
      existingEntries.map((e: any) => `${e.referenceType}:${e.referenceId}`),
    );

    const mapReferenceType = (
      tipoReferencia?: string | null,
      tipo?: string,
    ) => {
      const ref = String(tipoReferencia || '').toUpperCase();
      if (ref === 'PAGO' || ref === 'ABONO') return 'PAGO';
      if (ref === 'GASTO') return 'GASTO';
      if (ref === 'PRESTAMO') return 'DESEMBOLSO';
      if (ref === 'RECOLECCION' || ref === 'CONSOLIDACION')
        return 'CONSOLIDACION';
      if (ref === 'SOLICITUD_BASE' || ref === 'SOLICITUD_BASE_EFECTIVO')
        return 'BASE';
      if (ref === 'ABONO_DEUDA') return 'ABONO_DEUDA';
      if (ref === 'ARQUEO') return 'ARQUEO';
      if (ref === 'CUOTA_INICIAL') return 'AJUSTE';
      return 'AJUSTE';
    };

    const candidatos: any[] = [];
    let omitidosPorAsientoExistente = 0;
    let omitidosSinReferencia = 0;
    let omitidosNoSoportados = 0;

    for (const t of transacciones as any[]) {
      const referenceType = mapReferenceType(t.tipoReferencia, t.tipo);
      const referenceId = t.referenciaId || t.id;
      if (!referenceId) {
        omitidosSinReferencia++;
        continue;
      }

      if (existingKeys.has(`${referenceType}:${referenceId}`)) {
        omitidosPorAsientoExistente++;
        continue;
      }

      if (String(t.tipo).toUpperCase() === 'TRANSFERENCIA') {
        omitidosNoSoportados++;
        continue;
      }

      candidatos.push({
        transaccionId: t.id,
        referenceType,
        referenceId,
        tipo: t.tipo,
        tipoReferencia: t.tipoReferencia,
        cajaId: t.cajaId,
        caja: t.caja?.nombre,
        monto: Number(t.monto || 0),
        fechaTransaccion: t.fechaTransaccion,
      });
    }

    if (!params.dryRun) {
      await this.prisma.$transaction(async (tx) => {
        for (const c of candidatos) {
          const transaccion = (transacciones as any[]).find(
            (t) => t.id === c.transaccionId,
          );
          if (!transaccion) continue;

          const monto = Number(transaccion.monto || 0);
          if (!(monto > 0)) continue;

          const cajaAccount =
            transaccion.caja?.tipo === 'RUTA'
              ? '1.2.1'
              : transaccion.caja?.codigo === 'CAJA-BANCO'
                ? '1.1.2'
                : '1.1.1';
          const isIngreso =
            String(transaccion.tipo).toUpperCase() === 'INGRESO';
          const contrapartida =
            c.referenceType === 'ABONO_DEUDA'
              ? '1.4.1'
              : isIngreso
                ? '3.3'
                : transaccion.caja?.tipo === 'RUTA'
                  ? '4.1'
                  : '4.2';

          await this.ledgerService.registrarAsiento(
            {
              referenceType: c.referenceType,
              referenceId: c.referenceId,
              description: `[Migración histórica] ${transaccion.descripcion || c.tipoReferencia || c.tipo}`,
              createdBy: params.userId,
              lines: isIngreso
                ? [
                    {
                      accountCode: cajaAccount,
                      debitAmount: monto,
                      cajaId: transaccion.cajaId,
                      cajaDelta: 0,
                    },
                    {
                      accountCode: contrapartida,
                      creditAmount: monto,
                    },
                  ]
                : [
                    {
                      accountCode: contrapartida,
                      debitAmount: monto,
                    },
                    {
                      accountCode: cajaAccount,
                      creditAmount: monto,
                      cajaId: transaccion.cajaId,
                      cajaDelta: 0,
                    },
                  ],
            },
            tx,
          );
        }
      });
    }

    const totalMontoCandidatos = candidatos.reduce(
      (sum, c) => sum + Number(c.monto || 0),
      0,
    );

    return {
      dryRun: params.dryRun,
      fechaCorte: fechaCorte ? fechaCorte.toISOString() : null,
      totalHistoricoLeido: transacciones.length,
      totalCandidatos: candidatos.length,
      totalMontoCandidatos,
      omitidosPorAsientoExistente,
      omitidosSinReferencia,
      omitidosNoSoportados,
      aplicados: params.dryRun ? 0 : candidatos.length,
      candidatos: candidatos.slice(0, 100),
    };
  }

  /**
   * Asiento de Apertura (Día Cero)
   * Migra los saldos actuales de Cajas y Cartera al libro mayor.
   * SOLO puede ejecutarse si el libro está vacío.
   */
  async ejecutarAperturaContable(userId: string) {
    const existingEntries = await this.prisma.journalEntry.count();
    if (existingEntries > 0) {
      throw new BadRequestException(
        'El libro contable ya contiene registros. No se puede realizar la apertura.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener saldos de Cajas
      const cajas = await tx.caja.findMany({ where: { activa: true } });
      const lineasCajas = cajas
        .map((c) => ({
          accountCode:
            c.tipo === 'RUTA'
              ? '1.2.1'
              : c.codigo === 'CAJA-BANCO'
                ? '1.1.2'
                : '1.1.1',
          debitAmount: Number(c.saldoActual),
          cajaId: c.id,
          cajaDelta: 0, // El saldo ya existe en la tabla Caja, no queremos incrementarlo doble
        }))
        .filter((l) => l.debitAmount > 0);

      // 2. Obtener Cartera Vigente (Capital pendiente)
      const prestamos = await tx.prestamo.findMany({
        where: { estado: { in: ['ACTIVO', 'EN_MORA'] }, eliminadoEn: null },
        select: { saldoPendiente: true },
      });

      const totalCartera = prestamos.reduce(
        (acc, p) => acc + Number(p.saldoPendiente || 0),
        0,
      );

      const lineaCartera = {
        accountCode: '1.3.1',
        debitAmount: totalCartera,
      };

      // 3. Obtener Deuda Cobradores
      const deudores = await this.getDeudoresCobrador();
      let totalDeudaCobradores = 0;
      deudores.forEach((d) => (totalDeudaCobradores += d.totalDeuda));

      const lineaDeuda = {
        accountCode: '1.4.1',
        debitAmount: totalDeudaCobradores,
      };

      // 4. Sumar todo para el Patrimonio (Contrapartida)
      const totalDebitos =
        lineasCajas.reduce((acc, l) => acc + (l.debitAmount || 0), 0) +
        (lineaCartera.debitAmount || 0) +
        (lineaDeuda.debitAmount || 0);

      if (totalDebitos === 0) {
        throw new BadRequestException(
          'No hay saldos positivos para realizar la apertura.',
        );
      }

      const lines = [
        ...lineasCajas,
        lineaCartera,
        lineaDeuda,
        {
          accountCode: '2.1', // Capital Social / Patrimonio
          creditAmount: totalDebitos,
        },
      ].filter((l) => (l.debitAmount || 0) > 0 || (l.creditAmount || 0) > 0);

      // 5. Registrar Asiento
      return this.ledgerService.registrarAsiento(
        {
          referenceType: 'APERTURA',
          referenceId: 'DAY-ZERO',
          description:
            'Asiento de apertura: Migración de saldos iniciales a Partida Doble',
          isOpening: true,
          createdBy: userId,
          lines,
        },
        tx,
      );
    });
  }
}
