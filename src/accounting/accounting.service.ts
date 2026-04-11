import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoAprobacion, Prisma, TipoAprobacion, TipoCaja, TipoTransaccion } from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { calculateDateRange, formatBogotaOffsetIso, getBogotaDayKey, getBogotaStartEndOfDay, getBogotaStartEndOfDayFromKey } from '../utils/date-utils';
import { generarExcelContable, generarPDFContable, CajaRow, TransaccionRow } from '../templates/exports/reporte-contable.template';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacionesService: NotificacionesService,
    private readonly notificacionesGateway: NotificacionesGateway,
  ) {}

  // Codigos reservados para las cajas que no se pueden eliminar
  private static readonly CODIGOS_DEFAULT = ['CAJA-PRINCIPAL', 'CAJA-OFICINA', 'CAJA-BANCO'] as const;

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
      origen: t.caja.tipo === 'RUTA' ? 'COBRADOR' : 'EMPRESA',
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
        this.logger.warn('No hay un usuario administrador activo para asignar las cajas por defecto. Se reintentara cuando exista uno.');
        return;
      }

      const cajasDefault = [
        { codigo: 'CAJA-PRINCIPAL', nombre: 'Caja Principal', tipo: 'PRINCIPAL' as const },
        { codigo: 'CAJA-OFICINA',   nombre: 'Caja de Oficina', tipo: 'PRINCIPAL' as const },
        { codigo: 'CAJA-BANCO',     nombre: 'Caja Banco',      tipo: 'PRINCIPAL' as const },
      ];

      for (const def of cajasDefault) {
        const existe = await this.prisma.caja.findUnique({ where: { codigo: def.codigo } });
        if (!existe) {
          await this.prisma.caja.create({
            data: {
              codigo:        def.codigo,
              nombre:        def.nombre,
              tipo:          def.tipo,
              responsableId: adminUser.id,
              saldoActual:   0,
              activa:        true,
            },
          });
          this.logger.log(`Caja por defecto creada: ${def.nombre} (${def.codigo})`);
        } else {
          // Si ya existe, la normalizamos para garantizar que aparezca en listados (getCajas filtra activa=true)
          // y que tenga propiedades coherentes.
          if (!existe.activa || existe.nombre !== def.nombre || existe.tipo !== def.tipo) {
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

    const { startDate: inicioHoy, endDate: finHoy } = getBogotaStartEndOfDay(new Date());

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
      fechaCierre: cierre?.fechaTransaccion ? formatBogotaOffsetIso(cierre.fechaTransaccion) : null,
    };
  }

  async getCajas() {
    // Aseguramos cajas por defecto también de forma lazy.
    // onModuleInit puede no crearlas si al momento de arrancar no existía un ADMIN/SUPER_ADMIN activo.
    await this.ensureCajasDefault();
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

    const { startDate: fechaInicio, endDate: fechaFin } = getBogotaStartEndOfDay(new Date());

    const cajasConSaldo = await Promise.all(
      cajas.map(async (caja) => {
        let saldoCalculado = Number(caja.saldoActual);

        // Para cajas RUTA, el saldo debe reflejar el libro contable real (saldoActual).
        // El cálculo "recaudo - gastos" del día ignora TRANSFERENCIA (ej. RECOLECCION),
        // lo que hacía que al recolectar no se viera descontado en Gestión Contable.
        if (caja.tipo === 'RUTA') {
          saldoCalculado = Number(caja.saldoActual);
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
      rutaNombre: (caja as any).ruta?.nombre || null,
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
  }) {
    const cajaRuta = await this.prisma.caja.findFirst({
      where: {
        rutaId: data.rutaId,
        tipo: 'RUTA',
        activa: true,
      },
    });

    if (!cajaRuta) {
      throw new NotFoundException('Caja de ruta no encontrada para registrar el gasto');
    }

    // Buscar nombre del solicitante
    const solicitante = await this.prisma.usuario.findUnique({
      where: { id: data.solicitadoPorId },
      select: { nombres: true, apellidos: true },
    });
    const nombreSolicitante = solicitante
      ? `${solicitante.nombres} ${solicitante.apellidos}`.trim()
      : 'Cobrador';

    // ======== 1. SI ES GASTO OPERATIVO (GASTAR DIRECTAMENTE DE LA RUTA) ========
    if (!data.esPersonal) {
      await this.prisma.$transaction(async (tx) => {
        // 1. Crear Gasto
        const newGasto = await tx.gasto.create({
          data: {
            numeroGasto: `G${Date.now()}`,
            rutaId: data.rutaId,
            cobradorId: data.cobradorId,
            cajaId: cajaRuta.id,
            tipoGasto: 'OPERATIVO',
            monto: data.monto,
            descripcion: data.descripcion,
            categoriaId: data.categoriaId || undefined,
            aprobadoPorId: data.solicitadoPorId,
            estadoAprobacion: EstadoAprobacion.APROBADO,
          },
        });

        // 2. Registrar egreso en caja
        await tx.transaccion.create({
          data: {
            numeroTransaccion: `GTRX${Date.now()}`,
            cajaId: cajaRuta.id,
            tipo: TipoTransaccion.EGRESO,
            monto: data.monto,
            descripcion: `Gasto de ruta directo: ${data.descripcion}`,
            creadoPorId: data.solicitadoPorId,
            tipoReferencia: 'DEUDA_COBRADOR',
            referenciaId: newGasto.id,
          },
        });

        // 3. Actualizar caja
        await tx.caja.update({
          where: { id: cajaRuta.id },
          data: {
            saldoActual: { decrement: data.monto },
            gastosDelDia: { increment: data.monto },
          },
        });
      });

      this.notificacionesGateway.broadcastDashboardsActualizados({
        origen: 'GASTO',
        rutaId: data.rutaId,
      });

      return {
        success: true,
        message: 'Gasto registrado correctamente en caja',
      };
    }

    // ======== 2. SI ES GASTO PERSONAL (ENVIAR SOLICITUD A REVISIONES) ========
    const aprobacion = await this.prisma.aprobacion.create({
      data: {
        tipoAprobacion: data.tipoAprobacion,
        referenciaId: cajaRuta.id,
        tablaReferencia: 'Gasto',
        solicitadoPorId: data.solicitadoPorId,
        estado: EstadoAprobacion.PENDIENTE,
        datosSolicitud: {
          rutaId: data.rutaId,
          cobradorId: data.cobradorId,
          cajaId: cajaRuta.id,
          tipoGasto: 'OPERATIVO',
          monto: data.monto,
          descripcion: data.descripcion,
          categoriaId: data.categoriaId,
        },
        montoSolicitud: data.monto,
      },
    });

    await this.notificacionesService.notifyApprovers({
      titulo: 'Nuevo Gasto Personal Requiere Aprobación',
      mensaje: `${nombreSolicitante} ha solicitado ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} como adelanto/gasto personal.`,
      tipo: 'GASTO',
      entidad: 'Aprobacion',
      entidadId: aprobacion.id,
      metadata: {
        tipoAprobacion: 'GASTO',
        rutaId: data.rutaId,
        cajaId: cajaRuta.id,
        cobradorId: data.cobradorId,
        monto: data.monto,
        descripcion: data.descripcion,
        solicitadoPor: nombreSolicitante,
        categoriaId: data.categoriaId,
      },
    });

    try {
      await this.notificacionesService.create({
        usuarioId: data.solicitadoPorId,
        titulo: 'Solicitud enviada',
        mensaje: 'Tu solicitud de gasto personal fue enviada con éxito (pendiente).',
        tipo: 'INFORMATIVO',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
          tipoAprobacion: data.tipoAprobacion,
          rutaId: data.rutaId,
          cajaId: cajaRuta.id,
        },
      });
    } catch {}

    this.notificacionesGateway.broadcastDashboardsActualizados({
      origen: 'GASTO',
      rutaId: data.rutaId,
    });

    return {
      success: true,
      message: 'Gasto registrado y enviado para aprobación del coordinador',
      approvalId: aprobacion.id,
    };
  }

  async solicitarBase(data: {
    descripcion: string;
    monto: number;
    rutaId: string;
    cobradorId: string;
    solicitadoPorId: string;
  }) {
    const cajaRuta = await this.prisma.caja.findFirst({
      where: {
        rutaId: data.rutaId,
        tipo: 'RUTA',
        activa: true,
      },
    });

    if (!cajaRuta) {
      throw new NotFoundException(
        'Caja de ruta no encontrada para registrar la base',
      );
    }

    const aprobacion = await this.prisma.aprobacion.create({
      data: {
        tipoAprobacion: TipoAprobacion.SOLICITUD_BASE_EFECTIVO,
        referenciaId: cajaRuta.id,
        tablaReferencia: 'Caja',
        solicitadoPorId: data.solicitadoPorId,
        estado: EstadoAprobacion.PENDIENTE,
        datosSolicitud: {
          rutaId: data.rutaId,
          cobradorId: data.cobradorId,
          cajaId: cajaRuta.id,
          monto: data.monto,
          descripcion: data.descripcion,
        },
        montoSolicitud: data.monto,
      },
    });

    // Buscar nombre del solicitante
    const solicitanteBase = await this.prisma.usuario.findUnique({
      where: { id: data.solicitadoPorId },
      select: { nombres: true, apellidos: true },
    });
    const nombreSolicitanteBase = solicitanteBase
      ? `${solicitanteBase.nombres} ${solicitanteBase.apellidos}`.trim()
      : 'Cobrador';

    await this.notificacionesService.notifyApprovers({
      titulo: 'Nueva Solicitud de Base de Efectivo',
      mensaje: `${nombreSolicitanteBase} ha solicitado una base de efectivo por ${Number(
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
        rutaId: data.rutaId,
        cajaId: cajaRuta.id,
        cobradorId: data.cobradorId,
        monto: data.monto,
        descripcion: data.descripcion,
        solicitadoPor: nombreSolicitanteBase,
      },
    });

    try {
      await this.notificacionesService.create({
        usuarioId: data.solicitadoPorId,
        titulo: 'Solicitud enviada',
        mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
        tipo: 'INFORMATIVO',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
          tipoAprobacion: 'SOLICITUD_BASE_EFECTIVO',
          rutaId: data.rutaId,
          cajaId: cajaRuta.id,
        },
      });
    } catch {}

    this.notificacionesGateway.broadcastDashboardsActualizados({
      origen: 'BASE',
      rutaId: data.rutaId,
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
      if (data.tipo === 'RUTA') {
        throw new ForbiddenException(
          'Las cajas de ruta se crean automáticamente al crear la ruta. Si falta, use la opción de reparar/asegurar la caja de la ruta.',
        );
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

      // Regla: Solo Admin, SuperAdmin, Contador y Coordinador pueden crear Cajas Principales
      if (data.tipo === 'PRINCIPAL') {
        const rolesPermitidos = [
          'ADMIN',
          'SUPER_ADMINISTRADOR',
          'CONTADOR',
          'COORDINADOR',
        ];
        if (!rolesPermitidos.includes(currentUser.rol)) {
          throw new ForbiddenException(
            'No tienes permisos para crear una Caja Principal',
          );
        }
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
            saldoActual: data.saldoInicial || 0,
          },
          include: {
            responsable: { select: { nombres: true, apellidos: true } },
          },
        });

        // 2. Si hay saldo inicial > 0, registrar el movimiento de apertura
        if (data.saldoInicial && data.saldoInicial > 0) {
          const count = await tx.transaccion.count();
          const numeroTransaccion = `TRX-${Date.now().toString().slice(-8)}-${(count + 1).toString().padStart(4, '0')}`;

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

    // Las cajas por defecto NO pueden desactivarse ni renombrarse, solo cambiar responsable
    if (AccountingService.CODIGOS_DEFAULT.includes(caja.codigo as any)) {
      if (data.activa === false) {
        throw new ForbiddenException(`La caja "${caja.nombre}" es una caja del sistema y no puede desactivarse.`);
      }
      if (data.nombre && data.nombre !== caja.nombre) {
        throw new ForbiddenException(`El nombre de la caja "${caja.nombre}" no puede modificarse.`);
      }
      // Solo se permite actualizar responsableId y saldoActual
      return this.prisma.caja.update({
        where: { id },
        data: {
          responsableId: data.responsableId,
          saldoActual: data.saldoActual,
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

    if (AccountingService.CODIGOS_DEFAULT.includes(caja.codigo as any)) {
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
    } else if (tipo === TipoTransaccion.INGRESO || tipo === TipoTransaccion.EGRESO) {
      // Filtro global por tipo explícito (historial de ingresos/egresos del módulo contable)
      where.tipo = tipo;
      // Para ingresos globales, excluir transacciones internas que no son recaudo real
      if (tipo === TipoTransaccion.INGRESO) {
        where.NOT = {
          tipoReferencia: { in: ['SOLICITUD_BASE', 'SOLICITUD_BASE_EFECTIVO', 'APERTURA_CAJA'] },
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
        fechaInicio ? (fechaInicio.includes('T') ? fechaInicio.split('T')[0] : fechaInicio) : undefined,
        fechaFin ? (fechaFin.includes('T') ? fechaFin.split('T')[0] : fechaFin) : undefined
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
         { tipo: TipoTransaccion.TRANSFERENCIA, numeroTransaccion: { startsWith: 'TRX-IN' } }
       ];
       // Seguir excluyendo bases si es ingreso global
       where.NOT = {
         tipoReferencia: { in: ['SOLICITUD_BASE', 'SOLICITUD_BASE_EFECTIVO', 'APERTURA_CAJA'] },
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
      this.logger.error(`Error fetching transacciones: ${error.message}`, error.stack);
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
      this.logger.error(`Error fetching transaccion by id: ${error.message}`, error.stack);
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
      const startKey = /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) ? fechaInicio : getBogotaDayKey(new Date(fechaInicio));
      const endKey = /^\d{4}-\d{2}-\d{2}$/.test(fechaFin) ? fechaFin : getBogotaDayKey(new Date(fechaFin));
      rangeStart = getBogotaStartEndOfDayFromKey(startKey).startDate;
      rangeEnd = getBogotaStartEndOfDayFromKey(endKey).endDate;
    } else {
      const key = fecha
        ? (/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : getBogotaDayKey(new Date(fecha)))
        : getBogotaDayKey(new Date());
      ({ startDate: rangeStart, endDate: rangeEnd } = getBogotaStartEndOfDayFromKey(key));
    }

    const caja = await this.prisma.caja.findFirst({
      where: {
        rutaId,
        tipo: 'RUTA',
        activa: true,
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
      if (t.tipo === 'INGRESO') {
        if (t.tipoReferencia === 'PAGO' || t.tipoReferencia === 'CUOTA_INICIAL') {
          cobranzaTrx += monto;
          if (t.referenciaId) {
            recaudosPorReferencia[t.referenciaId] = (recaudosPorReferencia[t.referenciaId] || 0) + monto;
          }
        } else if (
          t.tipoReferencia === 'SOLICITUD_BASE_EFECTIVO' ||
          t.tipoReferencia === 'SOLICITUD_BASE' ||
          t.tipoReferencia === 'APERTURA_CAJA' ||
          t.descripcion.toLowerCase().includes('apertura de caja') ||
          t.descripcion.toLowerCase().includes('base de efectivo')
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
        } else if (
          t.tipoReferencia === 'PRESTAMO' ||
          t.descripcion.toLowerCase().includes('desembolso') ||
          t.descripcion.toLowerCase().includes('préstamo')
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

    // 3. Fallback: Obtener pagos directamente de la tabla Pago si no hay transacciones de pago vinculadas
    let cobranzaPagos = 0;
    if (cobranzaTrx === 0) {
      const asignaciones = await this.prisma.asignacionRuta.findMany({
        where: { rutaId, activa: true },
        select: { clienteId: true },
      });
      const clienteIds = asignaciones.map((a) => a.clienteId);

      const pagosList = await this.prisma.pago.findMany({
        where: {
          clienteId: { in: clienteIds },
          fechaPago: {
            gte: rangeStart,
            lte: rangeEnd,
          },
        },
      });
      
      pagosList.forEach(p => {
        const m = Number(p.montoTotal);
        cobranzaPagos += m;
        // En este fallback, usamos prestamoId como referencia
        if (p.prestamoId) {
          recaudosPorReferencia[p.prestamoId] = (recaudosPorReferencia[p.prestamoId] || 0) + m;
        }
      });
    }

    // Decidimos qué usar para cobranza
    const totalCobranza = cobranzaTrx > 0 ? cobranzaTrx : cobranzaPagos;
    const totalRecaudo = totalCobranza + otrosIngresos;
    const totalGastos = gastosOperativos + otrosEgresos;
    const saldoNetoPeriodo = totalRecaudo - totalGastos - desembolsos;

    return {
      rutaId,
      cajaId: caja.id,
      fecha: formatBogotaOffsetIso(rangeStart),
      saldoDisponible: Number(caja.saldoActual),
      recaudoDelDia: totalRecaudo, 
      cobranzaDelDia: totalCobranza,
      recaudosPorReferencia,
      gastosDelDia: totalGastos,
      // Base efectivo es el saldo acumulado de la caja de ruta (no debe reiniciarse diario)
      baseEfectivo: Number(caja.saldoActual),
      desembolsos: desembolsos,
      netoPeriodo: saldoNetoPeriodo,
      fechaInicio: formatBogotaOffsetIso(rangeStart),
      fechaFin: formatBogotaOffsetIso(rangeEnd),
      saldoCaja: Number(caja.saldoActual),
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
  }) {
    const count = await this.prisma.transaccion.count();
    const numeroTransaccion = `TRX-${Date.now().toString().slice(-8)}-${(count + 1).toString().padStart(4, '0')}`;

    // Actualizar saldo de la caja (Destino)
    const caja = await this.prisma.caja.findUnique({
      where: { id: data.cajaId },
      include: { ruta: true },
    });
    if (!caja) throw new NotFoundException('Caja no encontrada');

    // VALIDACIÓN: Si es un egreso de caja de ruta, verificar saldo disponible del día
    if (data.tipo === 'EGRESO' && caja.tipo === 'RUTA' && caja.rutaId) {
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
            numeroTransaccion: `TRX-OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
            numeroTransaccion: `TRX-IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            cajaId: data.cajaId,
            tipo: TipoTransaccion.TRANSFERENCIA,
            monto: data.monto,
            descripcion: `Transferencia recibida de ${cajaOrigen.nombre}`,
            creadoPorId: data.creadoPorId,
            tipoReferencia: 'TRANSFERENCIA_INTERNA',
            referenciaId: numeroReferencia,
          },
        });

        // 3. Actualizar Saldos
        await tx.caja.update({
          where: { id: data.cajaOrigenId },
          data: { saldoActual: { decrement: data.monto } },
        });

        await tx.caja.update({
          where: { id: data.cajaId },
          data: { saldoActual: { increment: data.monto } },
        });

        return transaccion;
      });
    }

    const nuevoSaldo =
      data.tipo === 'INGRESO'
        ? Number(caja.saldoActual) + data.monto
        : Number(caja.saldoActual) - data.monto;

    const [transaccion] = await this.prisma.$transaction([
      this.prisma.transaccion.create({
        data: {
          numeroTransaccion,
          cajaId: data.cajaId,
          tipo: data.tipo,
          monto: data.monto,
          descripcion: data.descripcion,
          creadoPorId: data.creadoPorId,
          tipoReferencia: data.tipoReferencia,
          referenciaId: data.referenciaId,
        },
      }),
      this.prisma.caja.update({
        where: { id: data.cajaId },
        data: { saldoActual: nuevoSaldo },
      }),
    ]);

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

  async consolidarCaja(cajaOrigenId: string, administradorId: string, montoRecolectar?: number) {
    // 1. Validar Caja Origen
    const cajaOrigen = await this.prisma.caja.findUnique({
      where: { id: cajaOrigenId },
      include: { ruta: { select: { nombre: true, id: true } } },
    });
    if (!cajaOrigen) throw new NotFoundException('Caja origen no encontrada');

    const saldoDisponible = Number(cajaOrigen.saldoActual);
    const montoATransferir = montoRecolectar && montoRecolectar > 0 ? montoRecolectar : saldoDisponible;

    if (montoATransferir <= 0) {
      throw new BadRequestException('El monto a recolectar debe ser mayor a cero');
    }
    if (montoATransferir > saldoDisponible) {
      throw new BadRequestException(`El monto (${montoATransferir}) supera el saldo disponible (${saldoDisponible})`);
    }

    // 2. Buscar Caja de Oficina como destino
    const cajaDestino = await this.prisma.caja.findFirst({
      where: {
        OR: [
          { codigo: 'CAJA-OFICINA' },
          { tipo: TipoCaja.PRINCIPAL, activa: true, NOT: { codigo: 'CAJA-PRINCIPAL' } },
        ],
      },
      orderBy: { creadoEn: 'asc' },
    }) ?? await this.prisma.caja.findFirst({
      where: { tipo: TipoCaja.PRINCIPAL, activa: true },
      orderBy: { creadoEn: 'asc' },
    });

    if (!cajaDestino) throw new BadRequestException('No existe una Caja de Oficina activa');
    if (cajaDestino.id === cajaOrigen.id)
      throw new BadRequestException('No se puede recolectar desde la caja destino');

    const numeroRef = `RECOL-${Date.now().toString().slice(-8)}`;
    const esTotal = montoATransferir === saldoDisponible;
    const rutaNombre = (cajaOrigen as any).ruta?.nombre || cajaOrigen.nombre;

    // 3. Ejecutar Transaccion Atomica
    const resultado = await this.prisma.$transaction(async (tx) => {
      const egreso = await tx.transaccion.create({
        data: {
          numeroTransaccion: `TRX-OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
          numeroTransaccion: `TRX-IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          cajaId: cajaDestino.id,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto: montoATransferir,
          descripcion: `Recoleccion recibida de ${rutaNombre}`,
          creadoPorId: administradorId,
          tipoReferencia: 'RECOLECCION',
          referenciaId: numeroRef,
        },
      });

      // Descontar de la caja origen
      await tx.caja.update({
        where: { id: cajaOrigen.id },
        data: { saldoActual: { decrement: montoATransferir } },
      });

      // Acreditar en la caja de oficina
      await tx.caja.update({
        where: { id: cajaDestino.id },
        data: { saldoActual: { increment: montoATransferir } },
      });

      return { egreso, ingreso };
    });

    // 4. Notificacion puramente informativa (no va a revisiones)
    try {
      const montoFmt = montoATransferir.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
      await this.notificacionesService.notifyCoordinator({
        titulo: 'Recoleccion de Dinero Registrada',
        mensaje: `Se recolectaron ${montoFmt} de la ruta "${rutaNombre}" hacia ${cajaDestino.nombre}. Referencia: ${numeroRef}.`,
        tipo: 'SISTEMA',
        entidad: 'Transaccion',
        entidadId: resultado.ingreso.id,
        metadata: {
          cajaOrigenId: cajaOrigen.id,
          cajaDestinoId: cajaDestino.id,
          monto: montoATransferir,
          numeroRef,
          administradorId,
          esTotal,
        },
      });
    } catch (notifErr) {
      this.logger.warn('No se pudo enviar notificacion de recoleccion:', notifErr);
    }

    // 5. Auditoria
    this.logger.log(
      `[RECOLECCION] ${numeroRef} | Admin: ${administradorId} | Origen: ${cajaOrigen.nombre} (${cajaOrigenId}) | Destino: ${cajaDestino.nombre} | Monto: ${montoATransferir} | Tipo: ${esTotal ? 'TOTAL' : 'PARCIAL'}`
    );

    return {
      origen: cajaOrigen.nombre,
      destino: cajaDestino.nombre,
      monto: montoATransferir,
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
    if (!caja || !caja.rutaId) {
      return { efectivo: 0, transferencia: 0, total: 0, fecha: null };
    }

    const baseDate = fecha ? new Date(fecha.includes('T') ? fecha : `${fecha}T00:00:00`) : new Date();
    const fechaKey = getBogotaDayKey(baseDate);
    const { startDate: rangeStart, endDate: rangeEnd } = getBogotaStartEndOfDayFromKey(fechaKey);

    // Obtener los clienteIds asignados a esta ruta
    const asignaciones = await this.prisma.asignacionRuta.findMany({
      where: { rutaId: caja.rutaId, activa: true },
      select: { clienteId: true },
    });

    if (asignaciones.length === 0) {
      return { efectivo: 0, transferencia: 0, total: 0, fecha: formatBogotaOffsetIso(rangeStart) };
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
      fechaInicio ? (fechaInicio.includes('T') ? fechaInicio.split('T')[0] : fechaInicio) : undefined,
      fechaFin ? (fechaFin.includes('T') ? fechaFin.split('T')[0] : fechaFin) : undefined
    );

    // Para "Ayer" o el período anterior, comparamos con un período de igual duración inmediatamente anterior
    const duration = finHoy.getTime() - inicioHoy.getTime();
    const inicioAnterior = new Date(inicioHoy.getTime() - duration - 1);
    const finAnterior = new Date(inicioHoy.getTime() - 1);

    const whereHoy = {
      fechaTransaccion: { gte: inicioHoy, lte: finHoy },
    };

    const whereAyer = {
      fechaTransaccion: { gte: inicioAnterior, lte: finAnterior },
    };

    // Ingresos y egresos del período y del período anterior
    const [
      ingresosHoy,
      egresosOperativosHoy,
      deudaCobradorHoyAgg,
      cobranzaHoyAgg,
      trasladosHoy,
      cuotaInicialHoyAgg,
      cuotasPagadasArticuloHoy,
      ingresosAyer,
      egresosOperativosAyer,
      deudaCobradorAyerAgg,
      cobranzaAyerAgg,
      trasladosAyer,
      cuotaInicialAyerAgg,
      cuotasPagadasArticuloAyer,
      totalCajas,
      prestamosActivos,
      totalRutasCount,
      rutasAbiertasCount,
      rutasPendientesConsolidacion,
      consolidacionesHoy,
      interesHoyAgg,
    ] = await Promise.all([
      this.prisma.transaccion.aggregate({
        where: {
          ...whereHoy,
          caja: { tipo: 'PRINCIPAL' },
          OR: [
            { tipo: 'INGRESO' },
            {
              tipo: 'TRANSFERENCIA',
              numeroTransaccion: { startsWith: 'TRX-IN' },
            },
          ],
          NOT: {
            OR: [
              { tipoReferencia: 'SOLICITUD_BASE' },
              { tipoReferencia: 'SOLICITUD_BASE_EFECTIVO' },
              { tipoReferencia: 'CUOTA_INICIAL' },
            ],
          },
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereHoy,
          tipo: 'EGRESO',
          NOT: {
            tipoReferencia: 'DEUDA_COBRADOR',
          },
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereHoy,
          tipo: 'EGRESO',
          tipoReferencia: 'DEUDA_COBRADOR',
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereHoy,
          tipo: 'INGRESO',
          tipoReferencia: { in: ['PAGO', 'ABONO'] },
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereHoy,
          tipo: 'TRANSFERENCIA',
          numeroTransaccion: { startsWith: 'TRX-OUT' },
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereHoy,
          tipo: 'INGRESO',
          tipoReferencia: 'CUOTA_INICIAL',
        },
        _sum: { monto: true },
      }),
      this.prisma.cuota.findMany({
        where: {
          estado: 'PAGADA',
          fechaPago: { gte: inicioHoy, lte: finHoy },
          prestamo: {
            tipoPrestamo: 'ARTICULO',
            eliminadoEn: null,
          },
        },
        select: {
          prestamo: {
            select: {
              margenArticulo: true,
              cantidadCuotas: true,
            },
          },
        },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereAyer,
          caja: { tipo: 'PRINCIPAL' },
          OR: [
            { tipo: 'INGRESO' },
            {
              tipo: 'TRANSFERENCIA',
              numeroTransaccion: { startsWith: 'TRX-IN' },
            },
          ],
          NOT: {
            OR: [
              { tipoReferencia: 'SOLICITUD_BASE' },
              { tipoReferencia: 'SOLICITUD_BASE_EFECTIVO' },
              { tipoReferencia: 'CUOTA_INICIAL' },
            ],
          },
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereAyer,
          tipo: 'EGRESO',
          NOT: {
            tipoReferencia: 'DEUDA_COBRADOR',
          },
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereAyer,
          tipo: 'EGRESO',
          tipoReferencia: 'DEUDA_COBRADOR',
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereAyer,
          tipo: 'INGRESO',
          tipoReferencia: { in: ['PAGO', 'ABONO'] },
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereAyer,
          tipo: 'TRANSFERENCIA',
          numeroTransaccion: { startsWith: 'TRX-OUT' },
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereAyer,
          tipo: 'INGRESO',
          tipoReferencia: 'CUOTA_INICIAL',
        },
        _sum: { monto: true },
      }),
      this.prisma.cuota.findMany({
        where: {
          estado: 'PAGADA',
          fechaPago: { gte: inicioAnterior, lte: finAnterior },
          prestamo: {
            tipoPrestamo: 'ARTICULO',
            eliminadoEn: null,
          },
        },
        select: {
          prestamo: {
            select: {
              margenArticulo: true,
              cantidadCuotas: true,
            },
          },
        },
      }),
      this.prisma.caja.aggregate({
        where: { activa: true },
        _sum: { saldoActual: true },
      }),
      this.prisma.prestamo.aggregate({
        where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
        _sum: { monto: true },
      }),
      // Total de rutas activas en el sistema
      this.prisma.caja.count({ where: { tipo: 'RUTA', activa: true } }),
      // Rutas que AÚN NO han registrado cierre hoy (pendientes de cierre)
      this.prisma.caja.count({
        where: {
          tipo: 'RUTA',
          activa: true,
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
      // Rutas pendientes de consolidación (igual a las que no han cerrado hoy)
      this.prisma.caja.count({
        where: {
          tipo: 'RUTA',
          activa: true,
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
      // Rutas que SÍ cerraron hoy
      this.prisma.caja.count({
        where: {
          tipo: 'RUTA',
          activa: true,
          transacciones: {
            some: {
              tipoReferencia: 'CIERRE_RUTA',
              fechaTransaccion: { gte: inicioHoy, lte: finHoy },
            },
          },
        },
      }),
      // Intereses de pagos registrados hoy
      this.prisma.detallePago.aggregate({
        where: {
          creadoEn: { gte: inicioHoy, lte: finHoy },
        },
        _sum: {
          montoInteres: true,
          montoInteresMora: true,
        },
      }),
    ]);

    const ingresos = Number(ingresosHoy._sum.monto || 0);
    const egresosOperativos = Number(egresosOperativosHoy._sum.monto || 0);
    const deudaCobrador = Number(deudaCobradorHoyAgg._sum.monto || 0);
    const cobranza = Number(cobranzaHoyAgg._sum.monto || 0);
    const traslados = Number(trasladosHoy._sum.monto || 0);
    const cuotaInicialHoy = Number(cuotaInicialHoyAgg._sum.monto || 0);
    const margenArticulosHoy = (cuotasPagadasArticuloHoy || []).reduce((acc: number, c: any) => {
      const margenTotal = Number(c?.prestamo?.margenArticulo || 0);
      const totalCuotas = Number(c?.prestamo?.cantidadCuotas || 0);
      if (!totalCuotas) return acc;
      return acc + (margenTotal / totalCuotas);
    }, 0);
    const ingresosAyerVal = Number(ingresosAyer._sum.monto || 0);
    const egresosAyerVal = Number(egresosOperativosAyer._sum.monto || 0);
    const deudaCobradorAyerVal = Number(deudaCobradorAyerAgg._sum.monto || 0);
    const cobranzaAyerVal = Number(cobranzaAyerAgg._sum.monto || 0);
    const trasladosAyerVal = Number(trasladosAyer._sum.monto || 0);
    const cuotaInicialAyerVal = Number(cuotaInicialAyerAgg._sum.monto || 0);
    const margenArticulosAyerVal = (cuotasPagadasArticuloAyer || []).reduce((acc: number, c: any) => {
      const margenTotal = Number(c?.prestamo?.margenArticulo || 0);
      const totalCuotas = Number(c?.prestamo?.cantidadCuotas || 0);
      if (!totalCuotas) return acc;
      return acc + (margenTotal / totalCuotas);
    }, 0);

    const calcularDiferencia = (actual: number, anterior: number) => {
      if (anterior === 0) return actual > 0 ? 100 : 0;
      return Number((((actual - anterior) / anterior) * 100).toFixed(2));
    };

    // Determinar si debemos usar comparación con ayer
    // Solo comparamos cuando el período es de un solo día (hoy)
    const esUnSoloDia = duration < 24 * 60 * 60 * 1000; // Menos de 24 horas
    const usarComparacionAyer = esUnSoloDia;

    // % de cierre = rutas que hicieron recolección hoy / total rutas activas
    const porcentajeCierres =
      totalRutasCount > 0
        ? Math.round((consolidacionesHoy / totalRutasCount) * 100)
        : 0;

    const interesHoy = Number((interesHoyAgg as any)?._sum?.montoInteres || 0);
    const moraHoy = Number((interesHoyAgg as any)?._sum?.montoInteresMora || 0);

    return {
      ingresosHoy: ingresos,
      egresosHoy: egresosOperativos,
      trasladosInternosHoy: traslados,
      cuotaInicialHoy,
      // Cobranza (PAGO/ABONO). Es el recaudo real del negocio.
      cobranzaHoy: cobranza,
      // Egresos de cobrador que se registran como cuenta por cobrar (no afectan utilidad)
      deudaCobradorHoy: deudaCobrador,
      // Margen de artículos (Modelo B): se reconoce proporcionalmente por cada cuota PAGADA dentro del período.
      margenArticulosHoy,
      // Utilidad financiera separada
      interesHoy,
      moraHoy,
      // La utilidad real es (interés+mora) + margen artículos - egresos operativos
      utilidadReal: (interesHoy + moraHoy + margenArticulosHoy) - egresosOperativos,
      // La cuota inicial pertenece al Capital (Ingreso Bruto de Caja) y no a la Utilidad.
      gananciaNeta: (interesHoy + moraHoy + margenArticulosHoy) - egresosOperativos,
      capitalEnCalle: Number(prestamosActivos._sum.monto || 0),
      saldoCajas: Number(totalCajas._sum.saldoActual || 0),
      cajasAbiertasCount: await this.prisma.caja.count({
        where: { activa: true },
      }),
      rutasTotales: totalRutasCount,
      rutasAbiertas: rutasAbiertasCount,
      rutasPendientesConsolidacion: rutasPendientesConsolidacion,
      consolidacionesHoy: consolidacionesHoy,
      porcentajeCierre: porcentajeCierres,
      fecha: formatBogotaOffsetIso(inicioHoy),
      porcentajeIngresosVsAyer: usarComparacionAyer ? calcularDiferencia(ingresos, ingresosAyerVal) : null,
      porcentajeEgresosVsAyer: usarComparacionAyer ? calcularDiferencia(egresosOperativos, egresosAyerVal) : null,
      porcentajeCobranzaVsAyer: usarComparacionAyer ? calcularDiferencia(cobranza, cobranzaAyerVal) : null,
      porcentajeDeudaCobradorVsAyer: usarComparacionAyer ? calcularDiferencia(deudaCobrador, deudaCobradorAyerVal) : null,
      porcentajeMargenArticulosVsAyer: usarComparacionAyer ? calcularDiferencia(margenArticulosHoy, margenArticulosAyerVal) : null,
      porcentajeTrasladosVsAyer: usarComparacionAyer ? calcularDiferencia(traslados, trasladosAyerVal) : null,
      porcentajeCuotaInicialVsAyer: usarComparacionAyer ? calcularDiferencia(cuotaInicialHoy, cuotaInicialAyerVal) : null,
      esIngresoPositivo: usarComparacionAyer ? ingresos >= ingresosAyerVal : true,
      esEgresoPositivo: usarComparacionAyer ? egresosOperativos <= egresosAyerVal : true,
      esCobranzaPositivo: usarComparacionAyer ? cobranza >= cobranzaAyerVal : true,
      esDeudaCobradorPositivo: usarComparacionAyer ? deudaCobrador <= deudaCobradorAyerVal : true,
      esMargenArticulosPositivo: usarComparacionAyer ? margenArticulosHoy >= margenArticulosAyerVal : true,
      esTrasladoPositivo: usarComparacionAyer ? traslados <= trasladosAyerVal : true,
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
    const where: any = {};
    const or: any[] = [];
    const tipo = filtros?.tipo;
    if (!tipo || tipo === undefined) {
      or.push({ tipoReferencia: 'CONSOLIDACION', tipo: 'TRANSFERENCIA' });
      or.push({ tipoReferencia: 'ARQUEO' });
      or.push({ tipoReferencia: 'CIERRE_RUTA' });
    } else if (tipo === 'CONSOLIDACION') {
      or.push({ tipoReferencia: 'CONSOLIDACION', tipo: 'TRANSFERENCIA' });
    } else if (tipo === 'ARQUEO') {
      or.push({ tipoReferencia: 'ARQUEO' });
    }
    where.OR = or;
    if (filtros?.cajaId) where.cajaId = filtros.cajaId;
    if (filtros?.fechaInicio || filtros?.fechaFin) {
      where.fechaTransaccion = {};
      if (filtros.fechaInicio)
        where.fechaTransaccion.gte = new Date(filtros.fechaInicio);
      if (filtros.fechaFin)
        where.fechaTransaccion.lte = new Date(filtros.fechaFin);
    }
    const transacciones = await this.prisma.transaccion.findMany({
      where,
      include: {
        caja: { select: { nombre: true, tipo: true } },
        creadoPor: { select: { nombres: true, apellidos: true } },
      },
      orderBy: { fechaTransaccion: 'desc' },
      take: 200,
    });

    let mapped = transacciones.map((t) => {
      if (t.tipoReferencia === 'ARQUEO') {
        // referenciaId formateado como "SS:<saldoSistema>|ER:<efectivoReal>|DF:<diferencia>"
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
        // referenciaId: "RC:<recaudo>|MT:<meta>|EF:<efectividad>|CF:<clientesFaltantes>|CO:<cobrador>|SD:<saldoCierre>"
        let recaudo = Number(t.monto);
        let meta = 0;
        let efectividad = 0;
        let clientesFaltantes = 0;
        let saldoAlCierre = 0;
        let cobradorNombre = t.creadoPor ? `${t.creadoPor.nombres} ${t.creadoPor.apellidos}` : 'Sistema';
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
        } catch (_) { void 0; }
        const deudaPorFaltantes = clientesFaltantes > 0
          ? Math.max(Number(meta || 0) - Number(recaudo || 0), 0)
          : 0;
        // Regla de negocio: saldoAlCierre (efectivo pendiente por recolectar) no es descuadre.
        // Solo se considera descuadre cuando faltaron clientes/efectivo vs meta.
        const descuadre = deudaPorFaltantes > 0;
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
    // Filtro opcional por estado (solo aplicable para ARQUEO)
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
          numeroTransaccion: `ARQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

    // Con diferencia: registrar ajuste como ingreso/egreso para cuadrar
    const tipoAjuste =
      Number(data.diferencia) > 0
        ? TipoTransaccion.INGRESO
        : TipoTransaccion.EGRESO;

    return this.createTransaccion({
      cajaId,
      tipo: tipoAjuste,
      monto: montoAjuste,
      descripcion,
      creadoPorId: userId,
      tipoReferencia: 'ARQUEO',
      referenciaId,
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
  }) {
    const { rutaId, estado, page = 1, limit = 50, fechaInicio, fechaFin } = filtros;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (rutaId) where.rutaId = rutaId;
    if (estado) where.estadoAprobacion = estado;
    if (fechaInicio || fechaFin) {
      where.fechaGasto = {};
      if (fechaInicio) {
        const startKey = getBogotaDayKey(new Date(fechaInicio));
        where.fechaGasto.gte = getBogotaStartEndOfDayFromKey(startKey).startDate;
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
        cobrador: `${g.cobrador.nombres} ${g.cobrador.apellidos}`,
        ruta: g.ruta?.nombre || 'Sin ruta',
        caja: g.caja.nombre,
        estado: g.estadoAprobacion,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async exportAccountingReport(
    format: 'excel' | 'pdf',
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    // 1. Solo consulta de BD
    const [cajas, transacciones] = await Promise.all([
      this.prisma.caja.findMany({
        where: { activa: true },
        include: {
          responsable: { select: { nombres: true, apellidos: true } },
          ruta: { select: { nombre: true } },
        },
        orderBy: { creadoEn: 'desc' },
      }),
      this.prisma.transaccion.findMany({
        include: {
          caja: { select: { nombre: true } },
          creadoPor: { select: { nombres: true, apellidos: true } },
        },
        orderBy: { creadoEn: 'desc' },
        take: 500,
      }),
    ]);

    const fecha = getBogotaDayKey(new Date());

    // 2. Mapeo al tipo del template
    const filasCjas: CajaRow[] = cajas.map((c: any) => ({
      nombre: c.nombre,
      codigo: c.codigo,
      tipo: c.tipo,
      responsable: c.responsable ? `${c.responsable.nombres} ${c.responsable.apellidos}` : 'Sin asignar',
      ruta: c.ruta?.nombre || 'N/A',
      saldo: Number(c.saldoActual),
    }));

    const filasTransacciones: TransaccionRow[] = transacciones.map((t: any) => ({
      fecha: t.creadoEn,
      tipo: t.tipo,
      monto: Number(t.monto),
      descripcion: t.descripcion || '',
      caja: t.caja?.nombre || '',
      usuario: t.creadoPor ? `${t.creadoPor.nombres} ${t.creadoPor.apellidos}` : '',
    }));

    // 3. Delegamos al template
    if (format === 'excel') return generarExcelContable(filasCjas, filasTransacciones, fecha);
    if (format === 'pdf') return generarPDFContable(filasCjas, filasTransacciones, fecha);

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
    // 1. Traemos todos los gastos que hayan sido designados como deuda/personal si existe una forma, por ahora usamos 'OTRO' o simplemente los omitimos para no cobrar gastos operativos.
    // Usaremos TipoGasto 'OTRO' como convención para gastos personales cargables al cobrador si es necesario, o transacciones con DEUDA_COBRADOR.
    // Por seguridad, solo sumamos los descuadres de ARQUEO para evitar cobrarles gasolina/operación si no tenemos la distinción clara.
    const gastosPersonales = await this.prisma.gasto.groupBy({
      by: ['cobradorId'],
      where: {
        tipoGasto: { in: ['OTRO'] }, 
        estadoAprobacion: 'APROBADO',
      },
      _sum: { monto: true },
      _count: { id: true },
    });

    // 2. Traemos egresos que representan deuda del cobrador (arqueos negativos y deudas explícitas)
    const arqueos = await this.prisma.transaccion.findMany({
      where: {
        tipo: 'EGRESO',
        OR: [
          { tipoReferencia: 'ARQUEO' },
          { tipoReferencia: 'DEUDA_COBRADOR' },
        ],
      },
      select: {
        id: true,
        creadoEn: true,
        monto: true,
        cajaId: true,
        tipoReferencia: true,
        referenciaId: true,
        descripcion: true,
        caja: {
          select: {
            rutaId: true,
            ruta: { select: { cobradorId: true } },
          },
        },
      },
    });

    // 2.5 Traemos los abonos ya registrados para descontarlos de la deuda
    const abonos = await this.prisma.transaccion.groupBy({
      by: ['referenciaId'],
      where: {
        tipoReferencia: 'ABONO_DEUDA',
        tipo: 'INGRESO',
      },
      _sum: { monto: true },
    });
    const abonosMap = new Map<string, number>();
    for (const a of abonos) {
      if (!a.referenciaId) continue;
      const refCobradorId = a.referenciaId.split('|')[0];
      const actual = abonosMap.get(refCobradorId) || 0;
      abonosMap.set(refCobradorId, actual + Number(a._sum.monto || 0));
    }

    // 3. Traemos los cobradores implicados
    const cobradorIds = [
      ...new Set([
        ...gastosPersonales.map(g => g.cobradorId),
        ...arqueos.map(a => a.caja?.ruta?.cobradorId).filter(Boolean) as string[],
        ...abonos.map(a => a.referenciaId ? a.referenciaId.split('|')[0] : null).filter(Boolean) as string[],
      ])
    ];

    if (cobradorIds.length === 0) return [];

    const cobradores = await this.prisma.usuario.findMany({
      where: { id: { in: cobradorIds } },
      select: { id: true, nombres: true, apellidos: true, rol: true },
    });
    const cobradorMap = new Map<string, { id: string; nombres: string; apellidos: string; rol: string }>(
      cobradores.map(c => [c.id, c as { id: string; nombres: string; apellidos: string; rol: string }])
    );

    // 4. Consolidar deudas por cobrador
    const deudaMap = new Map<string, { gastosPersonales: number; descuadres: number; totalEventos: number }>();
    const eventosMap = new Map<
      string,
      Array<{ id: string; tipoReferencia: string; monto: number; fecha: Date; cajaId: string; referenciaId?: string; descripcion?: string }>
    >();

    for (const g of gastosPersonales) {
      const prev = deudaMap.get(g.cobradorId) || { gastosPersonales: 0, descuadres: 0, totalEventos: 0 };
      deudaMap.set(g.cobradorId, {
        ...prev,
        gastosPersonales: prev.gastosPersonales + Number(g._sum.monto || 0),
        totalEventos: prev.totalEventos + (g._count.id || 0),
      });
    }

    for (const arqueo of arqueos) {
      const cobradorId = arqueo.caja?.ruta?.cobradorId;
      if (!cobradorId) continue;

      // Evitar falsos positivos:
      // 1) DEUDA_COBRADOR generada por cierres de ruta antiguos (basados en saldo retenido)
      //    suele venir con metadata SD:... y FD:0 o sin FD. Eso NO debe contarse.
      if (arqueo.tipoReferencia === 'DEUDA_COBRADOR' && typeof arqueo.referenciaId === 'string') {
        const ref = arqueo.referenciaId
        const tieneSaldoAlCierre = /\bSD:(\d+(?:\.\d+)?)\b/i.test(ref)
        const matchFD = ref.match(/\bFD:(\d+(?:\.\d+)?)\b/i)
        const fd = matchFD ? Number(matchFD[1] || 0) : null

        if (tieneSaldoAlCierre && (fd == null || fd === 0)) {
          continue
        }
      }

      // 2) ARQUEO: solo debe generar deuda si la diferencia fue negativa (faltó efectivo).
      //    Si no podemos detectar la diferencia, no lo contamos para no crear deudas falsas.
      if (arqueo.tipoReferencia === 'ARQUEO' && typeof arqueo.referenciaId === 'string') {
        const ref = arqueo.referenciaId
        const matchDif = ref.match(/\bDIF:([\-\d.]+)\b/i)
        if (!matchDif) {
          continue
        }
        const dif = Number(matchDif[1])
        // Si DIF >= 0 no hay deuda del cobrador
        if (!(dif < 0)) {
          continue
        }
      }

      const diferencia = Number(arqueo.monto || 0); // EGRESO significa dinero no devuelto
      const prev = deudaMap.get(cobradorId) || { gastosPersonales: 0, descuadres: 0, totalEventos: 0 };
      deudaMap.set(cobradorId, {
        ...prev,
        descuadres: prev.descuadres + diferencia,
        totalEventos: prev.totalEventos + 1,
      });

      const arr = eventosMap.get(cobradorId) || [];
      arr.push({
        id: String((arqueo as any).id),
        tipoReferencia: String(arqueo.tipoReferencia || ''),
        monto: Number(arqueo.monto || 0),
        fecha: (arqueo as any).creadoEn as Date,
        cajaId: String(arqueo.cajaId || ''),
        referenciaId: (arqueo as any).referenciaId ?? undefined,
        descripcion: (arqueo as any).descripcion ?? undefined,
      });
      eventosMap.set(cobradorId, arr);
    }

    // 5. Construir respuesta final restando abonos
    return Array.from(deudaMap.entries())
      .map(([cobradorId, deuda]) => {
        const cobrador = cobradorMap.get(cobradorId);
        const abonosRealizados = abonosMap.get(cobradorId) || 0;

        // Aplicar abonos al desglose para que los subtotales concuerden con el total.
        // Prioridad: descuadres (faltantes de ruta) -> gastos personales.
        const abonoUsadoEnDescuadres = Math.min(Number(deuda.descuadres || 0), Number(abonosRealizados || 0));
        const descuadresPendiente = Math.max(0, Number(deuda.descuadres || 0) - abonoUsadoEnDescuadres);
        const abonoRestante = Math.max(0, Number(abonosRealizados || 0) - abonoUsadoEnDescuadres);
        const abonoUsadoEnGastos = Math.min(Number(deuda.gastosPersonales || 0), abonoRestante);
        const gastosPendiente = Math.max(0, Number(deuda.gastosPersonales || 0) - abonoUsadoEnGastos);

        const totalDeudaRealRaw = descuadresPendiente + gastosPendiente;
        // Los valores del módulo contable se manejan en pesos (enteros). Redondear evita
        // que residuos decimales (p.ej. 0.02) aparezcan como "$0" pero cuenten como deuda.
        const totalDeudaReal = Math.max(0, Math.round(Number(totalDeudaRealRaw || 0)));
        
        return {
          cobradorId,
          nombreCobrador: cobrador ? `${cobrador.nombres} ${cobrador.apellidos}` : 'Desconocido',
          rol: cobrador?.rol || 'COBRADOR',
          totalDeuda: totalDeudaReal,
          gastosPersonales: Math.max(0, Math.round(Number(gastosPendiente || 0))),
          descuadres: Math.max(0, Math.round(Number(descuadresPendiente || 0))),
          totalEventos: deuda.totalEventos,
          eventos: (eventosMap.get(cobradorId) || []).slice(0, 25),
        };
      })
      .filter(d => Number(d.totalDeuda || 0) > 0)
      .sort((a, b) => b.totalDeuda - a.totalDeuda);
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
    const cobrador = await this.prisma.usuario.findUnique({ where: { id: cobradorId } });
    if (!cobrador) throw new NotFoundException('Cobrador no encontrado');

    const montoClean = Number(monto || 0);
    if (!(montoClean > 0)) throw new BadRequestException('Monto inválido');

    // 1. Resolver caja destino (por defecto Caja Principal)
    let cajaDestino = null as any
    if (cajaIdDestino) {
      cajaDestino = await this.prisma.caja.findUnique({ where: { id: cajaIdDestino } })
      if (!cajaDestino) throw new NotFoundException('Caja destino no encontrada')
    } else {
      cajaDestino = await this.prisma.caja.findFirst({
        where: { codigo: 'CAJA-OFICINA' },
      })
      if (!cajaDestino) {
        cajaDestino = await this.prisma.caja.findFirst({
          where: { codigo: 'CAJA-PRINCIPAL' },
        })
      }
      if (!cajaDestino) throw new Error('No existe Caja Oficina/Caja Principal para registrar el ingreso')
    }

    // 2. Crear la transacción INGRESO
    return this.createTransaccion({
      cajaId: cajaDestino.id,
      tipo: TipoTransaccion.INGRESO,
      monto: montoClean,
      descripcion: `Abono de deuda pendiente - Cobrador: ${cobrador.nombres} ${cobrador.apellidos}${nota ? ' - ' + nota : ''}`,
      creadoPorId: userId,
      tipoReferencia: 'ABONO_DEUDA',
      referenciaId: `${cobradorId}|${cobrador.nombres} ${cobrador.apellidos}`, // Guardamos ID y Nombre para facilitar auditoría
    });
  }

  async repararCajaOficinaIngresosMalAsignados(params?: { dryRun?: boolean }) {
    const dryRun = Boolean(params?.dryRun);

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
      const monto = new Prisma.Decimal(t.monto as any);
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

      deltaPorCaja[t.cajaId] = (deltaPorCaja[t.cajaId] || new Prisma.Decimal(0)).add(deltaOrigen);
      deltaOficinaAcc = deltaOficinaAcc.add(deltaDestino);
    }

    deltaPorCaja[cajaOficina.id] = (deltaPorCaja[cajaOficina.id] || new Prisma.Decimal(0)).add(deltaOficinaAcc);

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
}



