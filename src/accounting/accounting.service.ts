import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import { TipoCaja, TipoTransaccion, TipoAprobacion, EstadoAprobacion } from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacionesService: NotificacionesService,
    private readonly notificacionesGateway: NotificacionesGateway,
  ) {}

  // =====================
  // CAJAS
  // =====================

  async getCajas() {
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

    const ahora = new Date();
    const fechaInicio = new Date(ahora);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = new Date(ahora);
    fechaFin.setHours(23, 59, 59, 999);

    const cajasConSaldo = await Promise.all(
      cajas.map(async (caja) => {
        let saldoCalculado = Number(caja.saldoActual);

        if (caja.tipo === 'RUTA' && caja.rutaId) {
          const ingresos = await this.prisma.transaccion.aggregate({
            where: {
              cajaId: caja.id,
              tipo: 'INGRESO',
              fechaTransaccion: {
                gte: fechaInicio,
                lte: fechaFin,
              },
              NOT: {
                OR: [
                  { tipoReferencia: 'SOLICITUD_BASE' },
                  { tipoReferencia: 'SOLICITUD_BASE_EFECTIVO' },
                ],
              },
            },
            _sum: {
              monto: true,
            },
          });

          const egresos = await this.prisma.transaccion.aggregate({
            where: {
              cajaId: caja.id,
              tipo: 'EGRESO',
              fechaTransaccion: {
                gte: fechaInicio,
                lte: fechaFin,
              },
            },
            _sum: {
              monto: true,
            },
          });

          let recaudoDelDia = Number(ingresos._sum.monto || 0);
          const gastosDelDia = Number(egresos._sum.monto || 0);

          if (recaudoDelDia === 0) {
            const asignaciones = await this.prisma.asignacionRuta.findMany({
              where: { rutaId: caja.rutaId, activa: true },
              select: { clienteId: true },
            });

            if (asignaciones.length > 0) {
              const clienteIds = asignaciones.map((a) => a.clienteId);
              const pagosAgg = await this.prisma.pago.aggregate({
                where: {
                  clienteId: { in: clienteIds },
                  fechaPago: {
                    gte: fechaInicio,
                    lte: fechaFin,
                  },
                },
                _sum: { montoTotal: true },
              });
              recaudoDelDia = Number(pagosAgg._sum.montoTotal || 0);
            }
          }

          saldoCalculado = recaudoDelDia - gastosDelDia;
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
          ultimaActualizacion: caja.actualizadoEn.toISOString(),
        };
      }),
    );

    return cajasConSaldo;
  }

  async getCajaById(id: string) {
    const caja = await this.prisma.caja.findUnique({
      where: { id },
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

    return caja;
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
        },
        montoSolicitud: data.monto,
      },
    });

    // Buscar nombre del solicitante para mostrar en la notificación
    const solicitante = await this.prisma.usuario.findUnique({
      where: { id: data.solicitadoPorId },
      select: { nombres: true, apellidos: true },
    });
    const nombreSolicitante = solicitante
      ? `${solicitante.nombres} ${solicitante.apellidos}`.trim()
      : 'Cobrador';

    await this.notificacionesService.notifyApprovers({
      titulo: 'Nuevo Gasto Requiere Aprobación',
      mensaje: `${nombreSolicitante} ha registrado un gasto por ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}.`,
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

      // 3. Si es tipo RUTA, validar que la ruta exista (si se envió rutaId)
      // Se usa 'undefined' para asegurar que rutaId vacío sea ignorado en la consulta
      const rutaIdSanitizado = data.rutaId ? data.rutaId : undefined;

      if (data.tipo === 'RUTA' && rutaIdSanitizado) {
        const ruta = await this.prisma.ruta.findUnique({
          where: { id: rutaIdSanitizado },
        });
        if (!ruta) {
          throw new BadRequestException('La ruta especificada no existe');
        }
      }

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
    return this.prisma.caja.update({
      where: { id },
      data,
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

    if (cajaId) where.cajaId = cajaId;
    if (tipo) where.tipo = tipo;
    if (fechaInicio || fechaFin) {
      where.fechaTransaccion = {};
      if (fechaInicio) {
        const start = new Date(fechaInicio.includes('T') ? fechaInicio : `${fechaInicio}T00:00:00`);
        start.setHours(0, 0, 0, 0);
        where.fechaTransaccion.gte = start;
      }
      if (fechaFin) {
        const end = new Date(fechaFin.includes('T') ? fechaFin : `${fechaFin}T23:59:59.999`);
        end.setHours(23, 59, 59, 999);
        where.fechaTransaccion.lte = end;
      }
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
      data: transacciones.map((t) => ({
        id: t.id,
        numero: t.numeroTransaccion,
        fecha: t.fechaTransaccion.toISOString(),
        tipo: t.tipo,
        monto: Number(t.monto),
        descripcion: t.descripcion,
        caja: t.caja.nombre,
        cajaId: t.cajaId,
        responsable: `${t.creadoPor.nombres} ${t.creadoPor.apellidos}`,
        estado: 'APROBADO', // Todas las trx en DB están aprobadas
        origen: t.caja.tipo === 'RUTA' ? 'COBRADOR' : 'EMPRESA',
        categoria: t.tipoReferencia || 'GENERAL',
        rutaId: t.caja.rutaId,
        cajaSaldo: Number(t.caja.saldoActual),
      })),
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
      // Usar los rangos proporcionados, asegurando que cubran todo el día
      // Agregamos la hora para que el constructor de Date lo trate como hora local del servidor
      rangeStart = new Date(fechaInicio.includes('T') ? fechaInicio : `${fechaInicio}T00:00:00`);
      rangeEnd = new Date(fechaFin.includes('T') ? fechaFin : `${fechaFin}T23:59:59.999`);
    } else {
      const baseDate = fecha ? new Date(fecha.includes('T') ? fecha : `${fecha}T00:00:00`) : new Date();
      rangeStart = new Date(baseDate);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(baseDate);
      rangeEnd.setHours(23, 59, 59, 999);
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
        fechaInicio: rangeStart.toISOString(),
        fechaFin: rangeEnd.toISOString(),
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

    transacciones.forEach((t) => {
      const monto = Number(t.monto);
      if (t.tipo === 'INGRESO') {
        if (t.tipoReferencia === 'PAGO') {
          cobranzaTrx += monto;
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
      }
    });

    // 3. Fallback: Obtener pagos directamente de la tabla Pago si no hay transacciones de pago vinculadas
    // Esto es útil para instalaciones donde la vinculación TRX <-> PAGO no esté activa o para auditoría.
    let cobranzaPagos = 0;
    if (cobranzaTrx === 0) {
      const asignaciones = await this.prisma.asignacionRuta.findMany({
        where: { rutaId, activa: true },
        select: { clienteId: true },
      });
      const clienteIds = asignaciones.map((a) => a.clienteId);

      const pagosAgg = await this.prisma.pago.aggregate({
        where: {
          clienteId: { in: clienteIds },
          fechaPago: {
            gte: rangeStart,
            lte: rangeEnd,
          },
        },
        _sum: { montoTotal: true },
      });
      cobranzaPagos = Number(pagosAgg._sum.montoTotal || 0);
    }

    // Decidimos qué usar para cobranza (preferimos transacciones si existen)
    const totalCobranza = cobranzaTrx > 0 ? cobranzaTrx : cobranzaPagos;
    
    // El "Recaudo" total es lo que entró por cobranza y otros conceptos (NO incluye la base operativa)
    const totalRecaudo = totalCobranza + otrosIngresos;
    
    // Los "Gastos" para el cobrador suelen ser los operativos
    const totalGastos = gastosOperativos + otrosEgresos;

    // Saldo disponible (Neto del período)
    const saldoNetoPeriodo = totalRecaudo - totalGastos - desembolsos;

    return {
      rutaId,
      cajaId: caja.id,
      fecha: rangeStart.toISOString(),
      saldoDisponible: Number(caja.saldoActual), // Saldo real en libros actual
      recaudoDelDia: totalRecaudo, 
      cobranzaDelDia: totalCobranza,
      gastosDelDia: totalGastos,
      baseEfectivo: baseEfectivo,
      desembolsos: desembolsos,
      netoPeriodo: saldoNetoPeriodo,
      fechaInicio: rangeStart.toISOString(),
      fechaFin: rangeEnd.toISOString(),
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

  async consolidarCaja(cajaOrigenId: string, administradorId: string) {
    // 1. Validar Caja Origen
    const cajaOrigen = await this.prisma.caja.findUnique({
      where: { id: cajaOrigenId },
    });
    if (!cajaOrigen) throw new NotFoundException('Caja origen no encontrada');

    const saldo = Number(cajaOrigen.saldoActual);
    if (saldo <= 0) {
      throw new Error('La caja no tiene fondos para consolidar');
    }

    // 2. Buscar Caja Principal
    const cajaPrincipal = await this.prisma.caja.findFirst({
      where: { tipo: TipoCaja.PRINCIPAL, activa: true },
    });

    if (!cajaPrincipal) throw new Error('No existe una Caja Principal activa');
    if (cajaPrincipal.id === cajaOrigen.id)
      throw new Error(
        'No se puede consolidar la caja principal sobre sí misma',
      );

    const numeroRef = `CONS-${Date.now().toString().slice(-6)}`;

    // 3. Ejecutar Transacción Atómica
    return this.prisma.$transaction(async (tx) => {
      // Registrar salida en caja origen
      const egreso = await tx.transaccion.create({
        data: {
          numeroTransaccion: `TRX-OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          cajaId: cajaOrigen.id,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto: saldo,
          descripcion: `Consolidación enviada a Caja Principal (${cajaPrincipal.nombre})`,
          creadoPorId: administradorId,
          tipoReferencia: 'CONSOLIDACION',
          referenciaId: numeroRef,
        },
      });

      // Registrar entrada en caja principal
      const ingreso = await tx.transaccion.create({
        data: {
          numeroTransaccion: `TRX-IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          cajaId: cajaPrincipal.id,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto: saldo,
          descripcion: `Consolidación recibida de ${cajaOrigen.nombre}`,
          creadoPorId: administradorId,
          tipoReferencia: 'CONSOLIDACION',
          referenciaId: numeroRef,
        },
      });

      // Actualizar saldo origen a 0
      await tx.caja.update({
        where: { id: cajaOrigen.id },
        data: { saldoActual: 0 },
      });

      // Actualizar saldo principal
      await tx.caja.update({
        where: { id: cajaPrincipal.id },
        data: {
          saldoActual: { increment: saldo },
        },
      });

      return {
        origen: cajaOrigen.nombre,
        destino: cajaPrincipal.nombre,
        monto: saldo,
        transacciones: [egreso.id, ingreso.id],
      };
    });
  }

  // =====================
  // RESUMEN FINANCIERO
  // =====================

  async getResumenFinanciero(fechaInicio?: string, fechaFin?: string) {
    let rangeStart: Date;
    let rangeEnd: Date;

    if (fechaInicio && fechaFin) {
      rangeStart = new Date(fechaInicio.includes('T') ? fechaInicio : `${fechaInicio}T00:00:00`);
      rangeEnd = new Date(fechaFin.includes('T') ? fechaFin : `${fechaFin}T23:59:59.999`);
    } else {
      const hoy = new Date();
      rangeStart = new Date(hoy);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(hoy);
      rangeEnd.setHours(23, 59, 59, 999);
    }

    const inicioHoy = rangeStart;
    const finHoy = rangeEnd;

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

    // Ingresos y egresos del día y de ayer (Incluyendo transferencias/consolidaciones)
    const [
      ingresosHoy,
      egresosHoy,
      ingresosAyer,
      egresosAyer,
      totalCajas,
      prestamosActivos,
      totalRutasCount,
      rutasAbiertasCount,
      rutasPendientesConsolidacion,
      consolidacionesHoy,
    ] = await Promise.all([
      this.prisma.transaccion.aggregate({
        where: {
          ...whereHoy,
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
            ],
          },
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereHoy,
          OR: [
            { tipo: 'EGRESO' },
            {
              tipo: 'TRANSFERENCIA',
              numeroTransaccion: { startsWith: 'TRX-OUT' },
            },
          ],
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereAyer,
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
            ],
          },
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereAyer,
          OR: [
            { tipo: 'EGRESO' },
            {
              tipo: 'TRANSFERENCIA',
              numeroTransaccion: { startsWith: 'TRX-OUT' },
            },
          ],
        },
        _sum: { monto: true },
      }),
      this.prisma.caja.aggregate({
        where: { activa: true },
        _sum: { saldoActual: true },
      }),
      this.prisma.prestamo.aggregate({
        where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
        _sum: { monto: true },
      }),
      this.prisma.caja.count({ where: { tipo: 'RUTA' } }),
      this.prisma.caja.count({ where: { tipo: 'RUTA', activa: true } }),
      this.prisma.caja.count({
        where: { tipo: 'RUTA', saldoActual: { gt: 0 } },
      }),
      this.prisma.transaccion.count({
        where: {
          ...whereHoy,
          tipoReferencia: 'CONSOLIDACION',
          tipo: 'TRANSFERENCIA',
          caja: { tipo: 'RUTA' },
        },
      }),
    ]);

    const ingresos = Number(ingresosHoy._sum.monto || 0);
    const egresos = Number(egresosHoy._sum.monto || 0);
    const ingresosAyerVal = Number(ingresosAyer._sum.monto || 0);
    const egresosAyerVal = Number(egresosAyer._sum.monto || 0);

    const calcularDiferencia = (actual: number, anterior: number) => {
      if (anterior === 0) return actual > 0 ? 100 : 0;
      return Number((((actual - anterior) / anterior) * 100).toFixed(2));
    };

    // Determinar si debemos usar comparación con ayer
    // Solo comparamos cuando el período es de un solo día (hoy)
    const esUnSoloDia = duration < 24 * 60 * 60 * 1000; // Menos de 24 horas
    const usarComparacionAyer = esUnSoloDia;

    const porcentajeCierres =
      totalRutasCount > 0
        ? Math.round(
            ((totalRutasCount - rutasAbiertasCount) / totalRutasCount) * 100,
          )
        : 0;

    return {
      ingresosHoy: ingresos,
      egresosHoy: egresos,
      gananciaNeta: ingresos - egresos,
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
      fecha: inicioHoy.toISOString(),
      porcentajeIngresosVsAyer: usarComparacionAyer ? calcularDiferencia(ingresos, ingresosAyerVal) : null,
      porcentajeEgresosVsAyer: usarComparacionAyer ? calcularDiferencia(egresos, egresosAyerVal) : null,
      esIngresoPositivo: usarComparacionAyer ? ingresos >= ingresosAyerVal : true,
      esEgresoPositivo: usarComparacionAyer ? egresos <= egresosAyerVal : true,
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
          fecha: t.fechaTransaccion.toISOString(),
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
      return {
        id: t.id,
        fecha: t.fechaTransaccion.toISOString(),
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
        const start = new Date(fechaInicio);
        start.setHours(0, 0, 0, 0);
        where.fechaGasto.gte = start;
      }
      if (fechaFin) {
        const end = new Date(fechaFin);
        end.setHours(23, 59, 59, 999);
        where.fechaGasto.lte = end;
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
        fecha: g.fechaGasto.toISOString(),
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
    const ExcelJS = await import('exceljs');
    const PDFDocument = await import('pdfkit');

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

    const fecha = new Date().toISOString().split('T')[0];

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();

      // Hoja 1: Estado de Cajas
      const ws1 = workbook.addWorksheet('Estado de Cajas');
      ws1.columns = [
        { header: 'Caja', key: 'nombre', width: 18 },
        { header: 'Código', key: 'codigo', width: 14 },
        { header: 'Tipo', key: 'tipo', width: 14 },
        { header: 'Responsable', key: 'responsable', width: 25 },
        { header: 'Ruta', key: 'ruta', width: 18 },
        { header: 'Saldo', key: 'saldo', width: 16 },
      ] as any;
      const h1 = ws1.getRow(1);
      h1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
      h1.alignment = { horizontal: 'center' };
      cajas.forEach((c: any) => {
        ws1.addRow({
          nombre: c.nombre,
          codigo: c.codigo,
          tipo: c.tipo,
          responsable: c.responsable ? `${c.responsable.nombres} ${c.responsable.apellidos}` : 'Sin asignar',
          ruta: c.ruta?.nombre || 'N/A',
          saldo: Number(c.saldoActual),
        });
      });
      ws1.getColumn('saldo').numFmt = '#,##0';

      // Hoja 2: Movimientos
      const ws2 = workbook.addWorksheet('Movimientos');
      ws2.columns = [
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Tipo', key: 'tipo', width: 14 },
        { header: 'Monto', key: 'monto', width: 16 },
        { header: 'Descripción', key: 'descripcion', width: 35 },
        { header: 'Caja', key: 'caja', width: 18 },
        { header: 'Usuario', key: 'usuario', width: 22 },
      ] as any;
      const h2 = ws2.getRow(1);
      h2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
      h2.alignment = { horizontal: 'center' };
      transacciones.forEach((t: any) => {
        ws2.addRow({
          fecha: t.creadoEn ? new Date(t.creadoEn).toLocaleString('es-CO') : '',
          tipo: t.tipo,
          monto: Number(t.monto),
          descripcion: t.descripcion || '',
          caja: t.caja?.nombre || '',
          usuario: t.creadoPor ? `${t.creadoPor.nombres} ${t.creadoPor.apellidos}` : '',
        });
      });
      ws2.getColumn('monto').numFmt = '#,##0';

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        data: Buffer.from(buffer as ArrayBuffer),
        contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        filename: `reporte-contable-${fecha}.xlsm`,
      };
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
      const buffers: any[] = [];
      doc.on('data', buffers.push.bind(buffers));

      doc.fontSize(16).font('Helvetica-Bold').text('Créditos del Sur — Reporte Contable', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
      doc.moveDown(1);

      // Sección Cajas
      doc.fontSize(12).font('Helvetica-Bold').text('Estado de Cajas');
      doc.moveDown(0.3);
      const cCols = [
        { label: 'Caja', width: 100 }, { label: 'Código', width: 80 }, { label: 'Tipo', width: 80 },
        { label: 'Responsable', width: 130 }, { label: 'Ruta', width: 100 }, { label: 'Saldo', width: 100 },
      ];
      let y = doc.y + 5;
      const rowH = 16;
      doc.fontSize(7).font('Helvetica-Bold');
      doc.rect(30, y, cCols.reduce((s, c) => s + c.width, 0), rowH).fill('#0369A1');
      let x = 30;
      cCols.forEach(c => { doc.fillColor('white').text(c.label, x + 2, y + 4, { width: c.width - 4 }); x += c.width; });
      y += rowH;
      doc.font('Helvetica').fontSize(7).fillColor('black');
      cajas.forEach((c: any, i: number) => {
        if (i % 2 === 0) { doc.rect(30, y, cCols.reduce((s, cc) => s + cc.width, 0), rowH).fill('#F0F9FF'); doc.fillColor('black'); }
        x = 30;
        [c.nombre, c.codigo, c.tipo, c.responsable ? `${c.responsable.nombres} ${c.responsable.apellidos}` : '', c.ruta?.nombre || '', `$${Number(c.saldoActual).toLocaleString('es-CO')}`]
          .forEach((v, ci) => { doc.text(v, x + 2, y + 4, { width: cCols[ci].width - 4 }); x += cCols[ci].width; });
        y += rowH;
      });

      doc.y = y + 20;
      doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text('Últimos Movimientos');
      doc.moveDown(0.3);
      const tCols = [
        { label: 'Fecha', width: 110 }, { label: 'Tipo', width: 80 }, { label: 'Monto', width: 90 },
        { label: 'Descripción', width: 200 }, { label: 'Caja', width: 100 }, { label: 'Usuario', width: 110 },
      ];
      y = doc.y + 5;
      doc.fontSize(7).font('Helvetica-Bold');
      doc.rect(30, y, tCols.reduce((s, c) => s + c.width, 0), rowH).fill('#0369A1');
      x = 30;
      tCols.forEach(c => { doc.fillColor('white').text(c.label, x + 2, y + 4, { width: c.width - 4 }); x += c.width; });
      y += rowH;
      doc.font('Helvetica').fontSize(7).fillColor('black');
      transacciones.slice(0, 30).forEach((t: any, i: number) => {
        if (y > 560) { doc.addPage(); y = 30; }
        if (i % 2 === 0) { doc.rect(30, y, tCols.reduce((s, c) => s + c.width, 0), rowH).fill('#F0F9FF'); doc.fillColor('black'); }
        x = 30;
        [t.creadoEn ? new Date(t.creadoEn).toLocaleString('es-CO') : '', t.tipo, `$${Number(t.monto).toLocaleString('es-CO')}`, (t.descripcion || '').substring(0, 35), t.caja?.nombre || '', t.creadoPor ? `${t.creadoPor.nombres} ${t.creadoPor.apellidos}` : '']
          .forEach((v, ci) => { doc.text(v, x + 2, y + 4, { width: tCols[ci].width - 4 }); x += tCols[ci].width; });
        y += rowH;
      });

      doc.end();
      const buffer = await new Promise<Buffer>((resolve) => { doc.on('end', () => resolve(Buffer.concat(buffers))); });
      return { data: buffer, contentType: 'application/pdf', filename: `reporte-contable-${fecha}.pdf` };
    }
    throw new Error(`Formato no soportado: ${format}`);
  }
}
