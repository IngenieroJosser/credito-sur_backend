import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { AuditService } from '../audit/audit.service';

import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';

import { NotificacionesService } from '../notificaciones/notificaciones.service';

import {
  formatBogotaOffsetIso,
  getBogotaDayKey,
  getBogotaStartEndOfDay,
  getBogotaStartEndOfDayFromKey,
} from '../utils/date-utils';

import { CreateRouteDto } from './dto/create-route.dto';

import { UpdateRouteDto } from './dto/update-route.dto';

import {
  Prisma,
  EstadoPrestamo,
  EstadoAprobacion,
  RolUsuario,
  TipoAprobacion,
} from '@prisma/client';

import {
  generarExcelRutaCobrador,
  generarPDFRutaCobrador,
  RutaCobradorRow,
  RutaCobradorMeta,
} from '../templates/exports';

type RouteActor =
  | {
      id?: string;
      rol?: RolUsuario | string;
    }
  | null
  | undefined;

@Injectable()
export class RoutesService {
  constructor(
    private prisma: PrismaService,

    private auditService: AuditService,

    @Inject(forwardRef(() => NotificacionesGateway))
    private notificacionesGateway: NotificacionesGateway,

    private notificacionesService: NotificacionesService,
  ) {}

  private buildCodigoCajaRuta(codigoRuta: string) {
    const base = `CAJA-${codigoRuta}`;
    if (base.length <= 20) return base;
    // 20 chars máx: "CAJA-" (4) + 10 + "-" (1) + 4 = 19? realmente 4 + 1? => "CAJA-" son 5
    // 5 + 10 + 1 + 4 = 20
    const start = codigoRuta.slice(0, 10);
    const end = codigoRuta.slice(-4);
    return `CAJA-${start}-${end}`;
  }

  private getInicioFinHoy() {
    const { startDate, endDate } = getBogotaStartEndOfDay(new Date());
    return { inicio: startDate, fin: endDate };
  }

  private isCollector(actor: RouteActor) {
    return String(actor?.rol || '').toUpperCase() === RolUsuario.COBRADOR;
  }

  private isAssignedRouteSupervisor(actor: RouteActor) {
    const rol = String(actor?.rol || '').toUpperCase();
    return rol === RolUsuario.SUPERVISOR || rol === RolUsuario.COORDINADOR;
  }

  private assertCollectorOwnUser(cobradorId: string, actor?: RouteActor) {
    if (!this.isCollector(actor)) return;
    if (actor?.id && actor.id === cobradorId) return;
    throw new ForbiddenException(
      'No tienes permiso para consultar información de otro cobrador.',
    );
  }

  private async assertCollectorOwnRoute(rutaId: string, actor?: RouteActor) {
    if (!this.isCollector(actor)) return;
    const ruta = await this.prisma.ruta.findFirst({
      where: {
        id: rutaId,
        eliminadoEn: null,
        cobradorId: actor?.id,
      },
      select: { id: true },
    });
    if (!ruta?.id) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a esta ruta.',
      );
    }
  }

  private parseFechaOperativaBogotaKey(value?: string | null) {
    if (!value) return getBogotaDayKey(new Date());

    const raw = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        'fechaOperativa inválida. Debe usar formato YYYY-MM-DD.',
      );
    }

    return getBogotaDayKey(date);
  }

  private async buscarTransaccionCajaDia(
    cajaId: string,
    inicio: Date,
    fin: Date,
  ) {
    const porDiaBogota = await this.prisma.transaccion.findFirst({
      where: {
        cajaId,
        fechaTransaccion: {
          gte: inicio,
          lt: fin,
        },
      },
      select: {
        id: true,
        fechaTransaccion: true,
        creadoPorId: true,
        tipoReferencia: true,
      },
    });

    if (porDiaBogota?.id) return porDiaBogota;

    // Fallback: buscar por rango UTC completo del día
    const hoyUtcInicio = new Date();
    hoyUtcInicio.setUTCHours(0, 0, 0, 0);
    const hoyUtcFin = new Date();
    hoyUtcFin.setUTCHours(23, 59, 59, 999);

    const porUtc = await this.prisma.transaccion.findFirst({
      where: {
        cajaId,
        fechaTransaccion: {
          gte: hoyUtcInicio,
          lte: hoyUtcFin,
        },
      },
      select: {
        id: true,
        fechaTransaccion: true,
        creadoPorId: true,
        tipoReferencia: true,
      },
    });

    return porUtc || null;
  }

  private async buscarActivacionRutaDia(
    cajaId: string,
    inicio: Date,
    fin: Date,
  ) {
    return this.prisma.transaccion.findFirst({
      where: {
        cajaId,
        tipoReferencia: 'ACTIVACION_RUTA',
        fechaTransaccion: {
          gte: inicio,
          lt: fin,
        },
      },
      select: {
        id: true,
        fechaTransaccion: true,
        creadoPorId: true,
        tipoReferencia: true,
      },
    });
  }

  async getRutaActivadaHoy(rutaId: string, actor?: RouteActor) {
    await this.assertCollectorOwnRoute(rutaId, actor);

    const ruta = await this.prisma.ruta.findFirst({
      where: { id: rutaId, eliminadoEn: null },
      select: { id: true, nombre: true },
    });

    if (!ruta) {
      throw new NotFoundException('Ruta no encontrada');
    }

    const cajaRuta = await this.prisma.caja.findFirst({
      where: { rutaId: rutaId, tipo: 'RUTA', activa: true },
      select: { id: true },
    });

    if (!cajaRuta?.id) {
      throw new NotFoundException('Caja de ruta no encontrada');
    }

    if (this.isDomingoBogota()) {
      return {
        rutaId,
        activadaHoy: false,
        operableHoy: false,
        diaNoLaboral: true,
        activacionId: null,
        activacionReal: false,
        tipoReferenciaActivacion: null,
        fechaActivacion: null,
        activadaPorId: null,
        message: 'Hoy es domingo. La ruta no está operable.',
      };
    }

    const fechaOperativa = getBogotaDayKey(new Date());
    const activacionIdempotencyKey = `ACTIVACION_RUTA:${ruta.id}:${fechaOperativa}`;

    const activacionRutaHoy = await this.prisma.transaccion.findFirst({
      where: {
        idempotencyKey: activacionIdempotencyKey,
      },
      select: {
        id: true,
        fechaTransaccion: true,
        creadoPorId: true,
        tipoReferencia: true,
      },
    });

    return {
      rutaId,
      activadaHoy: !!activacionRutaHoy?.id,
      operableHoy: !!activacionRutaHoy?.id,
      diaNoLaboral: false,
      activacionId: activacionRutaHoy?.id || null,
      activacionReal: !!activacionRutaHoy?.id,
      tipoReferenciaActivacion: activacionRutaHoy?.tipoReferencia || null,
      fechaActivacion: activacionRutaHoy?.fechaTransaccion
        ? formatBogotaOffsetIso(activacionRutaHoy.fechaTransaccion)
        : null,
      activadaPorId: activacionRutaHoy?.creadoPorId || null,
    };
  }

  async activarRutaHoy(rutaId: string, userId?: string) {
    if (!userId) {
      throw new BadRequestException('Usuario inválido');
    }

    if (this.isDomingoBogota()) {
      throw new BadRequestException(
        'No se puede activar una ruta en domingo. No hay jornada operativa.',
      );
    }

    const ruta = await this.prisma.ruta.findFirst({
      where: { id: rutaId, eliminadoEn: null },
      select: { id: true, nombre: true, cobradorId: true },
    });

    if (!ruta) {
      throw new NotFoundException('Ruta no encontrada');
    }

    const cajaRuta = await this.prisma.caja.findFirst({
      where: { rutaId, tipo: 'RUTA', activa: true },
      select: { id: true },
    });

    if (!cajaRuta?.id) {
      throw new NotFoundException('Caja de ruta no encontrada');
    }

    const { inicio, fin } = this.getInicioFinHoy();
    const fechaOperativa = getBogotaDayKey(new Date());
    const activacionIdempotencyKey = `ACTIVACION_RUTA:${ruta.id}:${fechaOperativa}`;

    let resultadoActivacion: {
      id: string;
      fechaTransaccion: Date;
      tipoReferencia: string | null;
      creadaAhora: boolean;
    };

    try {
      resultadoActivacion = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "cajas" WHERE id = ${cajaRuta.id} FOR UPDATE`;

        await tx.rutaJornada.updateMany({
          where: {
            rutaId,
            estado: 'ABIERTA',
            fechaOperativa: { lt: fechaOperativa },
          },
          data: { estado: 'PENDIENTE_CIERRE' },
        });

        // Primero buscar específicamente la activación de la ruta
        const activacionRutaHoy = await tx.transaccion.findFirst({
          where: {
            cajaId: cajaRuta.id,
            tipoReferencia: 'ACTIVACION_RUTA',
            fechaTransaccion: {
              gte: inicio,
              lt: fin,
            },
          },
          select: {
            id: true,
            fechaTransaccion: true,
            tipoReferencia: true,
          },
        });

        if (activacionRutaHoy?.id) {
          await tx.rutaJornada.upsert({
            where: {
              rutaId_fechaOperativa: {
                rutaId,
                fechaOperativa,
              },
            },
            create: {
              rutaId,
              cajaId: cajaRuta.id,
              fechaOperativa,
              estado: 'ABIERTA',
              activacionTransaccionId: activacionRutaHoy.id,
              activadaEn: activacionRutaHoy.fechaTransaccion,
            },
            update: {
              cajaId: cajaRuta.id,
              activacionTransaccionId: activacionRutaHoy.id,
              activadaEn: activacionRutaHoy.fechaTransaccion,
            },
          });

          return {
            id: activacionRutaHoy.id,
            fechaTransaccion: activacionRutaHoy.fechaTransaccion,
            tipoReferencia: activacionRutaHoy.tipoReferencia,
            creadaAhora: false,
          };
        }

        // Se removió la validación de transaccionCajaHoy que impedía activar la ruta
        // si ya se habían registrado movimientos previos hoy (por ejemplo, desembolsos o adición de bases).

        const creada = await tx.transaccion.create({
          data: {
            numeroTransaccion: `AR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            cajaId: cajaRuta.id,
            tipo: 'TRANSFERENCIA',
            monto: 0,
            descripcion: `Activación de ruta del día: ${ruta.nombre}`,
            tipoReferencia: 'ACTIVACION_RUTA',
            referenciaId: `RUTA:${ruta.id}`,
            idempotencyKey: activacionIdempotencyKey,
            creadoPorId: userId,
          },
          select: {
            id: true,
            fechaTransaccion: true,
            tipoReferencia: true,
          },
        });

        await tx.rutaJornada.upsert({
          where: {
            rutaId_fechaOperativa: {
              rutaId,
              fechaOperativa,
            },
          },
          create: {
            rutaId,
            cajaId: cajaRuta.id,
            fechaOperativa,
            estado: 'ABIERTA',
            activacionTransaccionId: creada.id,
            activadaEn: creada.fechaTransaccion,
          },
          update: {
            cajaId: cajaRuta.id,
            activacionTransaccionId: creada.id,
            activadaEn: creada.fechaTransaccion,
          },
        });

        return {
          id: creada.id,
          fechaTransaccion: creada.fechaTransaccion,
          tipoReferencia: creada.tipoReferencia,
          creadaAhora: true,
        };
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const activacionExistente =
          (await this.prisma.transaccion.findFirst({
            where: { idempotencyKey: activacionIdempotencyKey },
            select: {
              id: true,
              fechaTransaccion: true,
              tipoReferencia: true,
            },
          })) ||
          (await this.buscarActivacionRutaDia(
            cajaRuta.id,
            inicio,
            fin,
          ));

        if (activacionExistente?.id) {
          resultadoActivacion = {
            id: activacionExistente.id,
            fechaTransaccion: activacionExistente.fechaTransaccion,
            tipoReferencia: activacionExistente.tipoReferencia,
            creadaAhora: false,
          };
        } else {
          throw new ConflictException(
            'La caja ya tiene un movimiento registrado para hoy, pero no existe una activación operativa de ruta.',
          );
        }
      } else {
        throw error;
      }
    }

    if (ruta.cobradorId && resultadoActivacion.creadaAhora) {
      await this.notificacionesService.create({
        usuarioId: ruta.cobradorId,
        titulo: 'Ruta Activada',
        mensaje: `Se activó tu ruta ${ruta.nombre} para hoy. Ya puedes iniciar cobros.`,
        tipo: 'RUTA',
        entidad: 'Ruta',
        entidadId: ruta.id,
        metadata: { rutaId: ruta.id, activadaHoy: true },
      });
    }

    this.notificacionesGateway.broadcastRutasActualizadas({
      accion: 'ACTUALIZAR',
      rutaId: ruta.id,
    });

    this.notificacionesGateway.broadcastDashboardsActualizados({});

    const activacionReal =
      resultadoActivacion.tipoReferencia === 'ACTIVACION_RUTA';

    // Verificar si hay cierre pendiente de jornada anterior
    const cierrePendiente = await this.getCierrePendienteRuta(ruta.id);

    return {
      rutaId: ruta.id,
      activadaHoy: true,
      activacionId: resultadoActivacion.id,
      activacionReal,
      tipoReferenciaActivacion: resultadoActivacion.tipoReferencia,
      cierrePendienteAnterior: cierrePendiente,
      message: cierrePendiente
        ? 'Ruta activada para hoy, pero existe una jornada anterior pendiente de cierre.'
        : resultadoActivacion.creadaAhora
          ? 'Ruta activada para hoy correctamente'
          : 'La ruta ya estaba activada hoy',
    };
  }

  private isDomingoBogota(date = new Date()) {
    const day = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      weekday: 'short',
    }).format(date);

    return day === 'Sun';
  }

  async listarCreditosAsignadosACobrador(
    cobradorId: string,
    actor?: RouteActor,
  ) {
    this.assertCollectorOwnUser(cobradorId, actor);

    const asignaciones = await this.prisma.asignacionRuta.findMany({
      where: {
        cobradorId,

        activa: true,

        ruta: {
          eliminadoEn: null,
        },

        cliente: {
          eliminadoEn: null,
        },
      },

      orderBy: { ordenVisita: 'asc' },

      include: {
        ruta: {
          select: { id: true, nombre: true, codigo: true, activa: true },
        },

        cliente: {
          select: {
            id: true,

            nombres: true,

            apellidos: true,

            telefono: true,

            direccion: true,

            nivelRiesgo: true,

            prestamos: {
              where: {
                eliminadoEn: null,

                estado: {
                  in: ['ACTIVO', 'EN_MORA', 'PAGADO', 'INCUMPLIDO', 'PERDIDA'],
                },
              },

              orderBy: { creadoEn: 'asc' },

              select: {
                id: true,

                numeroPrestamo: true,

                tipoPrestamo: true,

                saldoPendiente: true,

                frecuenciaPago: true,

                cantidadCuotas: true,

                estado: true,

                producto: {
                  select: {
                    id: true,

                    nombre: true,

                    descripcion: true,
                  },
                },

                cuotas: {
                  where: {
                    estado: {
                      in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'],
                    },
                  },

                  take: 100,

                  select: {
                    id: true,

                    numeroCuota: true,

                    monto: true,

                    // BUG-13 FIX: incluir montoPagado para que el frontend pueda calcular
                    // el exigible correcto descontando abonos parciales.
                    montoPagado: true,

                    estado: true,

                    fechaVencimiento: true,

                    fechaVencimientoProrroga: true,
                  },
                },

                extensiones: {
                  orderBy: { creadoEn: 'desc' },

                  take: 1,

                  select: { id: true, nuevaFechaVencimiento: true },
                },
              },
            },
          },
        },
      },
    });

    const filas: any[] = [];

    for (const asig of asignaciones) {
      const cliente = asig.cliente;

      const prestamos = cliente?.prestamos || [];

      if (!prestamos.length) continue;

      const hoyKey = getBogotaDayKey(new Date());

      for (const p of prestamos) {
        let proxima = p.cuotas?.[0] || null;

        if (p.cuotas && p.cuotas.length > 0) {
          let montoAcumulado = 0;
          let esMoraAtrasada = false;

          for (const c of p.cuotas) {
            if (!c.fechaVencimiento) continue;
            // Extraer la fecha literal de la cuota y compararla con hoyKey de Bogotá.
            const cuotaKey = getBogotaDayKey(new Date(c.fechaVencimiento));
            if (cuotaKey <= hoyKey) {
              montoAcumulado += Number(c.monto);
              if (cuotaKey < hoyKey) esMoraAtrasada = true;
            }
          }

          // BUG-10 FIX: encontrar la cuota más antigua vencida (no necesariamente cuotas[0])
          // para que proximaCuota.id y numeroCuota sean los de la cuota real exigible.
          // DEFECTO-A FIX: fallback '9999-12-31' (no 0) para cuotas sin fechaVencimiento:
          // new Date(0) = '1969-12-31' las ordenaría primero (como las más antiguas), lo cual
          // las convertiría en 'proxima' incorrecto. Con '9999-12-31' van al final del sort.
          const cuotasMasAntigua = [...p.cuotas].sort((a, b) => {
            const ak = getBogotaDayKey(
              new Date(a.fechaVencimiento || '9999-12-31'),
            );
            const bk = getBogotaDayKey(
              new Date(b.fechaVencimiento || '9999-12-31'),
            );
            return String(ak).localeCompare(String(bk));
          });
          proxima = cuotasMasAntigua[0] || proxima;

          if (montoAcumulado > 0 && proxima) {
            proxima = { ...proxima, monto: montoAcumulado };
            if (esMoraAtrasada) {
              proxima.estado = 'VENCIDA';
            }
          }
        }

        const cuotaEnProrroga = proxima?.estado === 'PRORROGADA';
        const extension = p.extensiones?.[0] || null;

        const fechaEfectiva =
          cuotaEnProrroga && proxima?.fechaVencimientoProrroga
            ? proxima.fechaVencimientoProrroga
            : (extension?.nuevaFechaVencimiento ??
              proxima?.fechaVencimiento ??
              null);

        filas.push({
          asignacionId: asig.id,

          rutaId: asig.rutaId,

          rutaNombre: asig.ruta?.nombre,

          rutaCodigo: asig.ruta?.codigo,

          ordenVisita: asig.ordenVisita,

          cliente: {
            id: cliente.id,

            nombres: cliente.nombres,

            apellidos: cliente.apellidos,

            telefono: cliente.telefono,

            direccion: cliente.direccion,

            nivelRiesgo: cliente.nivelRiesgo,
          },

          prestamo: {
            id: p.id,

            tipo: p.tipoPrestamo,

            numeroPrestamo: p.numeroPrestamo,

            saldoPendiente: Number(p.saldoPendiente),

            frecuenciaPago: p.frecuenciaPago,

            cantidadCuotas: p.cantidadCuotas,

            estado: p.estado,

            articulo: p.producto?.nombre || p.producto?.descripcion || null,

            proximaCuota: proxima
              ? {
                  id: proxima.id,

                  numeroCuota: proxima.numeroCuota,

                  monto: Number(proxima.monto),

                  estado: proxima.estado,

                  fechaVencimiento: proxima.fechaVencimiento,

                  fechaVencimientoProrroga: proxima.fechaVencimientoProrroga,

                  enProrroga: cuotaEnProrroga,
                }
              : null,

            fechaEfectiva,
          },
        });
      }
    }

    return {
      cobradorId,

      total: filas.length,

      data: filas,
    };
  }

  async create(createRouteDto: CreateRouteDto) {
    try {
      // Verificar si el código ya existe

      const existingRoute = await this.prisma.ruta.findUnique({
        where: { codigo: createRouteDto.codigo },
      });

      if (existingRoute) {
        throw new ConflictException('El código de ruta ya existe');
      }

      // Verificar si el cobrador existe

      const cobrador = await this.prisma.usuario.findFirst({
        where: {
          id: createRouteDto.cobradorId,

          rol: 'COBRADOR',
        },
      });

      if (!cobrador) {
        throw new BadRequestException(
          'El cobrador especificado no existe o no tiene el rol correcto',
        );
      }

      // Verificar supervisor si se proporciona

      if (createRouteDto.supervisorId) {
        const supervisor = await this.prisma.usuario.findFirst({
          where: {
            id: createRouteDto.supervisorId,

            rol: { in: ['SUPERVISOR', 'COORDINADOR'] },
          },
        });

        if (!supervisor) {
          throw new BadRequestException(
            'El supervisor especificado no existe o no tiene el rol correcto',
          );
        }
      }

      // Crear la ruta + su caja asociada (tipo RUTA) en una transacción

      const route = await this.prisma.$transaction(async (tx) => {
        const createdRoute = await tx.ruta.create({
          data: {
            codigo: createRouteDto.codigo,
            nombre: createRouteDto.nombre,
            descripcion: createRouteDto.descripcion,
            zona: createRouteDto.zona,
            cobradorId: createRouteDto.cobradorId,
            supervisorId: createRouteDto.supervisorId,
            activa: true,
          },
          include: {
            cobrador: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                correo: true,
                telefono: true,
                rol: true,
              },
            },
            supervisor: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                correo: true,
                telefono: true,
                rol: true,
              },
            },
          },
        });

        const codigoCaja = this.buildCodigoCajaRuta(createdRoute.codigo);
        const nombreCaja = `Caja ${createdRoute.nombre}`;

        const cajaExistente = await tx.caja.findFirst({
          where: { rutaId: createdRoute.id, tipo: 'RUTA', activa: true },
          select: { id: true },
        });

        if (!cajaExistente?.id) {
          await tx.caja.create({
            data: {
              codigo: codigoCaja,
              nombre: nombreCaja,
              tipo: 'RUTA',
              rutaId: createdRoute.id,
              responsableId: createdRoute.cobradorId,
              saldoActual: 0,
              activa: true,
            },
          });
        }

        return createdRoute;
      });

      // Registrar en auditoría

      if (createRouteDto.cobradorId) {
        await this.auditService.create({
          usuarioId: createRouteDto.cobradorId,

          accion: 'CREAR_RUTA',

          entidad: 'Ruta',

          entidadId: route.id,

          datosNuevos: {
            codigo: route.codigo,

            nombre: route.nombre,

            descripcion: route.descripcion,

            zona: route.zona,

            cobrador: `${route.cobrador.nombres} ${route.cobrador.apellidos}`,

            supervisor: route.supervisor
              ? `${route.supervisor.nombres} ${route.supervisor.apellidos}`
              : null,
          },
        });
      }

      if (createRouteDto.cobradorId) {
        await this.notificacionesService.create({
          usuarioId: createRouteDto.cobradorId,

          titulo: 'Nueva Ruta Asignada',

          mensaje: `Se te ha asignado la ruta ${route.nombre} (${route.codigo})`,

          tipo: 'RUTA',

          entidad: 'Ruta',

          entidadId: route.id,
        });
      }

      this.notificacionesGateway.broadcastRutasActualizadas({
        accion: 'CREAR',

        rutaId: route.id,
      });

      this.notificacionesGateway.broadcastDashboardsActualizados({});

      return route;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('El código de ruta ya existe');
        }

        if (error.code === 'P2003') {
          throw new BadRequestException(
            'Relación inválida con cobrador o supervisor',
          );
        }
      }

      throw error;
    }
  }

  async findAll(
    options?: {
      skip?: number;

      take?: number;

      search?: string;

      activa?: boolean;

      cobradorId?: string;

      supervisorId?: string;
    },
    actor?: RouteActor,
  ) {
    const { skip, take, search, activa, supervisorId } = options || {};
    const cobradorId = this.isCollector(actor)
      ? actor?.id
      : options?.cobradorId;
    const scopedSupervisorId = this.isAssignedRouteSupervisor(actor)
      ? actor?.id
      : supervisorId;

    const where: any = {
      eliminadoEn: null,
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },

        { codigo: { contains: search, mode: 'insensitive' } },

        { zona: { contains: search, mode: 'insensitive' } },

        { descripcion: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (activa !== undefined) {
      where.activa = activa;
    }

    if (cobradorId) {
      where.cobradorId = cobradorId;
    }

    if (scopedSupervisorId) {
      where.supervisorId = scopedSupervisorId;
    } else if (this.isAssignedRouteSupervisor(actor)) {
      where.supervisorId = '__NO_ACTOR_ID__';
    }

    try {
      const [rutas, total] = await Promise.all([
        this.prisma.ruta.findMany({
          where,

          skip,

          take,

          include: {
            cobrador: {
              select: {
                id: true,

                nombres: true,

                apellidos: true,

                correo: true,

                telefono: true,

                rol: true,
              },
            },

            supervisor: {
              select: {
                id: true,

                nombres: true,

                apellidos: true,

                correo: true,

                telefono: true,

                rol: true,
              },
            },

            asignaciones: {
              where: { activa: true },

              include: {
                cliente: {
                  select: {
                    id: true,

                    nombres: true,

                    apellidos: true,

                    dni: true,
                  },
                },
              },
            },

            _count: {
              select: {
                asignaciones: { where: { activa: true } },

                gastos: true,
              },
            },
          },

          orderBy: { creadoEn: 'desc' },
        }),

        this.prisma.ruta.count({ where }),
      ]);

      // Calcular estadísticas para cada ruta

      const rutaIds = rutas.map((r) => r.id);
      const cierresPendientesMap =
        await this.getCierresPendientesRutasMap(rutaIds, actor?.id);

      const rutasConEstadisticas = await Promise.all(
        rutas.map(async (ruta) => {
          // Obtener IDs de clientes asignados de forma robusta

          const asignaciones = await this.prisma.asignacionRuta.findMany({
            where: { rutaId: ruta.id, activa: true },

            select: { clienteId: true },
          });

          const clientesIds = asignaciones.map((a) => a.clienteId);

          const estadisticas = {
            clientesAsignados: asignaciones.length,

            cobranzaDelDia: 0,

            metaDelDia: 0,

            clientesNuevos: 0,
          };

          let nivelRiesgo = 'PELIGRO_MINIMO';

          let porcentajeMora = 0;

          let avanceDiario = 0;

          if (clientesIds.length === 0) {
            const cierreInfo = cierresPendientesMap.get(ruta.id) || {
              cierrePendienteAnterior: null,
              cierresPendientes: [],
              totalCierresPendientes: 0,
              tieneCierrePendiente: false,
            };
            return {
              ...ruta,
              ...estadisticas,
              nivelRiesgo,
              porcentajeMora,
              avanceDiario,
              cobrador: `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`,
              estado: ruta.activa ? 'ACTIVA' : 'INACTIVA',
              frecuenciaVisita: 'DIARIO',
              cierrePendienteAnterior: cierreInfo.cierrePendienteAnterior,
              cierresPendientes: cierreInfo.cierresPendientes,
              totalCierresPendientes: cierreInfo.totalCierresPendientes,
              tieneCierrePendiente: cierreInfo.tieneCierrePendiente,
            };
          }

          if (clientesIds.length > 0) {
            // Obtener registros de visita del día para excluir clientes ausentes de la meta
            const hoyKey2 = getBogotaDayKey(new Date());
            const registrosVisitas = await this.prisma.registroVisita.findMany({
              where: {
                rutaId: ruta.id,
                fechaVisita: hoyKey2,
              },
            });

            // Obtener pagos operativos de hoy para excluir ausentes que realmente pagaron hoy.
            // Las regularizaciones de jornadas pasadas no deben anular una ausencia operativa.
            const { startDate: inicioHoy, endDate: finHoy } =
              getBogotaStartEndOfDay(new Date());
            const pagosOperativosClientesHoy = await this.prisma.pago.findMany({
              where: {
                clienteId: { in: clientesIds },
                fechaPago: {
                  gte: inicioHoy,
                  lte: finHoy,
                },
                OR: [
              { origenGestion: null },
              { origenGestion: { not: 'CIERRE_PENDIENTE' } },
            ],
              },
              select: {
                clienteId: true,
              },
            });
            const clientesConPagoOperativoHoy = new Set(
              pagosOperativosClientesHoy.map((p) => p.clienteId),
            );

            const clientesAusentes = new Set(
              registrosVisitas
                .filter((r) => r.estadoVisita === 'ausente')
                .filter((r) => !clientesConPagoOperativoHoy.has(r.clienteId))
                .map((r) => r.clienteId),
            );

            // Para la META: solo préstamos activos/en mora, excluyendo clientes ausentes
            const prestamosParaMeta = await this.prisma.prestamo.findMany({
              where: {
                clienteId: {
                  in: clientesIds.filter((id) => !clientesAusentes.has(id)),
                },
                estado: { in: ['ACTIVO', 'EN_MORA'] }, // ✅ sin PAGADO
                eliminadoEn: null,
              },
              select: {
                id: true,
                saldoPendiente: true,
                monto: true,
                cantidadCuotas: true,
                frecuenciaPago: true,
                clienteId: true,
              },
            });

            // Si todos los clientes están ausentes, la meta es 0
            if (
              clientesAusentes.size === clientesIds.length ||
              prestamosParaMeta.length === 0
            ) {
              estadisticas.metaDelDia = 0;
            }

            // Para el RECAUDO: incluir PAGADO para capturar pagos de hoy
            const prestamosActivos = await this.prisma.prestamo.findMany({
              where: {
                clienteId: { in: clientesIds },
                estado: { in: ['ACTIVO', 'EN_MORA', 'PAGADO'] },
                eliminadoEn: null,
              },
              select: { id: true, frecuenciaPago: true },
            });

            const pIds = prestamosActivos.map((p) => p.id); // para query de pagos (recaudo)
            const pIdsParaMeta = prestamosParaMeta.map((p) => p.id); // para query de cuotas (meta)

            // Rango del día actual en Bogotá (límites UTC ajustados a -05:00).
            // Una sola llamada: startDate/endDate ya representan los límites del día bogotano en UTC.
            const { startDate: dInicioBogota, endDate: dFinBogota } =
              getBogotaStartEndOfDay(new Date());
            const dInicioUTC = dInicioBogota;
            const dFinUTC = dFinBogota;

            if (pIds.length > 0) {
              const resAgregados = await Promise.all([
                this.prisma.pago.findMany({
                  where: {
                    prestamo: {
                      cliente: {
                        asignacionesRuta: {
                          some: { rutaId: ruta.id, activa: true },
                        },
                      },
                    },
                    fechaPago: { gte: dInicioBogota, lte: dFinBogota },
                  },
                  select: { montoTotal: true, origenGestion: true },
                }),

                this.prisma.cuota.findMany({
                  where: {
                    prestamoId: { in: pIdsParaMeta },
                  },
                  select: {
                    prestamoId: true,
                    fechaVencimiento: true,
                    fechaPago: true,
                    estado: true,
                    monto: true,
                    montoPagado: true,
                  },
                  orderBy: [{ prestamoId: 'asc' }, { fechaVencimiento: 'asc' }],
                }),

                // NUEVO: Considerar ingresos por cuota inicial en la meta del día
                this.prisma.transaccion.aggregate({
                  where: {
                    caja: { rutaId: ruta.id, activa: true },
                    tipoReferencia: 'CUOTA_INICIAL',
                    tipo: 'INGRESO',
                    fechaTransaccion: { gte: dInicioBogota, lte: dFinBogota },
                  },
                  _sum: { monto: true },
                }),
              ]);

              const cuotasInicialesHoy = resAgregados[2];
              const montoMetaInicial = Number(
                cuotasInicialesHoy?._sum?.monto || 0,
              );

              const pagosRutaRaw = resAgregados[0] as any[];
              const cuotasCriterio = resAgregados[1] as any[];

              const pagosOperativosHoy = pagosRutaRaw.filter(
                (p) =>
                  String(p?.origenGestion || '').toUpperCase() !==
                  'CIERRE_PENDIENTE',
              );
              const pagosRegularizadosHoy = pagosRutaRaw.filter(
                (p) =>
                  String(p?.origenGestion || '').toUpperCase() ===
                  'CIERRE_PENDIENTE',
              );

              const cobranzaReal = pagosOperativosHoy.reduce(
                (sum, p) => sum + Number(p.montoTotal || 0),
                0,
              );
              const recaudoRegularizadoHoy = pagosRegularizadosHoy.reduce(
                (sum, p) => sum + Number(p.montoTotal || 0),
                0,
              );
              estadisticas.cobranzaDelDia = cobranzaReal + montoMetaInicial;
              (estadisticas as any).recaudoRegularizadoHoy =
                recaudoRegularizadoHoy;
              (estadisticas as any).recaudoContableHoy =
                cobranzaReal + recaudoRegularizadoHoy + montoMetaInicial;

              // Calcular meta nominal consistente con getDailyVisits + computeRutaHoyUiStatsFromVisitas:
              // - DIARIO: suma acumulada de todas las cuotas vencidas (<= inicio del día)
              // - DEMÁS: primera cuota NO pagada con vencimiento <= inicio del día
              let metaNominal = 0;

              const hoyBogotaKey = getBogotaDayKey(new Date());

              const primeraCuotaPorPrestamo = new Map<string, number>();
              for (const c of cuotasCriterio) {
                if (!c?.prestamoId) continue;
                const pid = String(c.prestamoId);
                if (primeraCuotaPorPrestamo.has(pid)) continue;
                if (c.estado === 'PAGADA') continue;
                const vtoKey = getBogotaDayKey(new Date(c.fechaVencimiento));
                if (vtoKey > hoyBogotaKey) continue;
                const montoFull = Number(c.monto || 0);
                const montoPagado = Number(c.montoPagado || 0);
                const montoPendiente = Math.max(0, montoFull - montoPagado);
                if (montoPendiente <= 0) continue;
                primeraCuotaPorPrestamo.set(pid, montoPendiente);
              }

              // Calcular meta nominal: misma lógica que computeMontoNominalHastaHoyFromCuotas.
              // Usa TODAS las cuotas del préstamo (sin pre-filtrar por fecha) y filtra en memoria:
              // - Excluir PAGADA (isCuotaNoPagada)
              // - Solo cuotas con vtoKey <= hoyBogotaKey (comparación de strings de fecha)
              const acumuladoPorPrestamo = new Map<string, number>();
              for (const c of cuotasCriterio) {
                if (!c?.prestamoId) continue;
                if (c.estado === 'PAGADA') continue;
                const vtoKey = getBogotaDayKey(new Date(c.fechaVencimiento));
                if (vtoKey > hoyBogotaKey) continue;
                const pid = String(c.prestamoId);
                const montoFull = Number(c.monto || 0);
                const montoPagado = Number(c.montoPagado || 0);
                const montoPendiente = Math.max(0, montoFull - montoPagado);
                if (montoPendiente <= 0) continue;
                acumuladoPorPrestamo.set(
                  pid,
                  (acumuladoPorPrestamo.get(pid) || 0) + montoPendiente,
                );
              }

              for (const p of prestamosParaMeta) {
                const pid = String(p.id);
                const freq = String(p.frecuenciaPago || '').toUpperCase();
                if (freq === 'DIARIO' || freq === 'DIA') {
                  metaNominal += Number(acumuladoPorPrestamo.get(pid) || 0);
                  continue;
                }
                metaNominal += Number(primeraCuotaPorPrestamo.get(pid) || 0);
              }

              estadisticas.metaDelDia =
                metaNominal + estadisticas.cobranzaDelDia;

              if (process.env.NODE_ENV !== 'production') {
                console.log(`[META DEBUG] Ruta: ${ruta.nombre}`, {
                  metaNominal,
                  acumuladoPorPrestamo: [...acumuladoPorPrestamo.entries()].map(
                    ([k, v]) => ({ prestamoId: k, monto: v }),
                  ),
                  primeraCuotaPorPrestamo: [
                    ...primeraCuotaPorPrestamo.entries(),
                  ].map(([k, v]) => ({ prestamoId: k, monto: v })),
                  metaDelDia: estadisticas.metaDelDia,
                  cobranzaDelDia: estadisticas.cobranzaDelDia,
                  recaudoRegularizadoHoy,
                });
              }

              // Calcular AVANCE DIARIO

              if (estadisticas.metaDelDia > 0) {
                avanceDiario =
                  (estadisticas.cobranzaDelDia / estadisticas.metaDelDia) * 100;
              }

              const montoVencido = cuotasCriterio
                .filter(
                  (c) =>
                    c.estado !== 'PAGADA' &&
                    new Date(c.fechaVencimiento) < dInicioUTC,
                )
                .reduce((sum, c) => sum + Number(c.monto), 0);

              const deudaTotal = prestamosParaMeta.reduce(
                (acc, curr) => acc + Number(curr.saldoPendiente || 0),
                0,
              );
              porcentajeMora =
                deudaTotal > 0 ? (montoVencido / deudaTotal) * 100 : 0;

              if (porcentajeMora > 30) nivelRiesgo = 'ALTO_RIESGO';
              else if (porcentajeMora > 15) nivelRiesgo = 'RIESGO_MODERADO';
              else if (porcentajeMora > 10) nivelRiesgo = 'PRECAUCION';
              else if (porcentajeMora > 5) nivelRiesgo = 'LEVE_RETRASO';
            }

            // Clientes nuevos (últimos 7 días)

            const sieteDiasAtras = new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000,
            );

            estadisticas.clientesNuevos =
              await this.prisma.asignacionRuta.count({
                where: {
                  rutaId: ruta.id,

                  creadoEn: { gte: sieteDiasAtras },

                  activa: true,
                },
              });
          }

          if (estadisticas.clientesAsignados === 0) {
            estadisticas.metaDelDia = 0;
            estadisticas.cobranzaDelDia = 0;
          }

          // Obtener información de cierre pendiente desde el mapa batch
          const cierreInfo = cierresPendientesMap.get(ruta.id) || {
            cierrePendienteAnterior: null,
            cierresPendientes: [],
            totalCierresPendientes: 0,
            tieneCierrePendiente: false,
          };

          return {
            ...ruta,

            ...estadisticas,

            clientesAsignados: estadisticas.clientesAsignados,

            clientesNuevos: estadisticas.clientesNuevos,

            cobranzaDelDia: estadisticas.cobranzaDelDia,
            recaudoRegularizadoHoy:
              (estadisticas as any).recaudoRegularizadoHoy || 0,
            recaudoContableHoy:
              (estadisticas as any).recaudoContableHoy ||
              estadisticas.cobranzaDelDia,

            metaDelDia: estadisticas.metaDelDia,

            nivelRiesgo,

            porcentajeMora: parseFloat(porcentajeMora.toFixed(2)),

            avanceDiario: parseFloat(avanceDiario.toFixed(2)),

            cobrador: `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`,

            estado: ruta.activa ? 'ACTIVA' : 'INACTIVA',

            frecuenciaVisita: 'DIARIO',

            cierrePendienteAnterior: cierreInfo.cierrePendienteAnterior,
            cierresPendientes: cierreInfo.cierresPendientes,
            totalCierresPendientes: cierreInfo.totalCierresPendientes,
            tieneCierrePendiente: cierreInfo.tieneCierrePendiente,
          };
        }),
      );

      return {
        data: rutasConEstadisticas,

        meta: {
          total,

          skip: skip || 0,

          take: take || rutas.length,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al obtener las rutas: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findOne(id: string, actor?: RouteActor) {
    try {
      await this.assertCollectorOwnRoute(id, actor);

      const { startDate: hoyInicioUTC } = getBogotaStartEndOfDay(new Date());

      const ruta = await this.prisma.ruta.findFirst({
        where: {
          id,

          eliminadoEn: null,

          ...(this.isAssignedRouteSupervisor(actor)
            ? { supervisorId: actor?.id || '__NO_ACTOR_ID__' }
            : {}),
        },

        include: {
          cobrador: {
            select: {
              id: true,

              nombres: true,

              apellidos: true,

              correo: true,

              telefono: true,

              rol: true,
            },
          },

          supervisor: {
            select: {
              id: true,

              nombres: true,

              apellidos: true,

              correo: true,

              telefono: true,

              rol: true,
            },
          },

          asignaciones: {
            where: { activa: true },

            include: {
              cliente: {
                include: {
                  prestamos: {
                    where: {
                      OR: [
                        { estado: EstadoPrestamo.ACTIVO },

                        { estado: EstadoPrestamo.EN_MORA },
                      ],
                    },

                    include: {
                      cuotas: {
                        where: {
                          OR: [
                            {
                              estado: {
                                in: [
                                  'PENDIENTE',
                                  'VENCIDA',
                                  'PARCIAL',
                                  'PRORROGADA',
                                ],
                              },
                            },
                            {
                              estado: 'PAGADA',
                              fechaVencimiento: { gte: hoyInicioUTC },
                            },
                          ],
                        },

                        take: 100,

                        select: {
                          id: true,

                          numeroCuota: true,

                          monto: true,

                          estado: true,

                          fechaVencimiento: true,

                          fechaVencimientoProrroga: true,

                          extensionId: true,
                        },
                      },

                      extensiones: {
                        orderBy: { creadoEn: 'desc' },

                        take: 1,

                        select: {
                          id: true,

                          nuevaFechaVencimiento: true,

                          creadoEn: true,
                        },
                      },
                    },
                  },
                },
              },
            },

            orderBy: { ordenVisita: 'asc' },
          },

          cajas: {
            where: { activa: true },

            select: {
              id: true,

              codigo: true,

              nombre: true,

              saldoActual: true,
            },
          },

          gastos: {
            where: { estadoAprobacion: 'APROBADO' },

            take: 10,

            orderBy: { fechaGasto: 'desc' },
          },

          _count: {
            select: {
              asignaciones: {
                where: { activa: true },
              },

              gastos: true,
            },
          },
        },
      });

      if (!ruta) {
        throw new NotFoundException('Ruta no encontrada');
      }

      // Calcular estadísticas detalladas
      // IMPORTANTE: deduplicar para evitar doble conteo si un cliente tiene
      // más de una asignación activa en la misma ruta.
      const clientesIds = [
        ...new Set(ruta.asignaciones.map((a) => a.clienteId)),
      ];

      const estadisticas = {
        clientesAsignados: ruta._count.asignaciones,

        cobranzaDelDia: 0,

        metaDelDia: 0,

        clientesNuevos: 0,

        totalDeuda: 0,

        prestamosActivos: 0,
      };

      let nivelRiesgo = 'PELIGRO_MINIMO';

      let porcentajeMora = 0;

      let avanceDiario = 0;

      if (clientesIds.length > 0) {
        // Obtener registros de visita del día para excluir clientes ausentes de la meta
        const hoyKey2 = getBogotaDayKey(new Date());
        const registrosVisitas = await this.prisma.registroVisita.findMany({
          where: {
            rutaId: id,
            fechaVisita: hoyKey2,
          },
        });

        // Obtener pagos operativos de hoy para excluir ausentes que realmente pagaron hoy.
        // Las regularizaciones de jornadas pasadas no deben anular una ausencia operativa.
        const { startDate: inicioHoy, endDate: finHoy } =
          getBogotaStartEndOfDay(new Date());
        const pagosOperativosClientesHoy = await this.prisma.pago.findMany({
          where: {
            clienteId: { in: clientesIds },
            fechaPago: {
              gte: inicioHoy,
              lte: finHoy,
            },
            OR: [
              { origenGestion: null },
              { origenGestion: { not: 'CIERRE_PENDIENTE' } },
            ],
          },
          select: {
            clienteId: true,
          },
        });
        const clientesConPagoOperativoHoy = new Set(
          pagosOperativosClientesHoy.map((p) => p.clienteId),
        );

        const clientesAusentes = new Set(
          registrosVisitas
            .filter((r) => r.estadoVisita === 'ausente')
            .filter((r) => !clientesConPagoOperativoHoy.has(r.clienteId))
            .map((r) => r.clienteId),
        );

        // Obtener préstamos activos y en mora, excluyendo clientes ausentes
        const prestamosActivos = ruta.asignaciones
          .filter((a) => !clientesAusentes.has(a.clienteId))
          .flatMap((a) => a?.cliente?.prestamos || [])
          .filter((p) => p && p.eliminadoEn == null);

        const pIds = prestamosActivos.map((p) => p.id);
        // Una sola llamada: getBogotaStartEndOfDay devuelve límites del día bogotano en UTC.
        const { startDate: dInicioBogota, endDate: dFinBogota } =
          getBogotaStartEndOfDay(new Date());
        const dInicioUTC = dInicioBogota;
        const dFinUTC = dFinBogota;

        if (pIds.length > 0) {
          const resAgregados = await Promise.all([
            this.prisma.pago.findMany({
              where: {
                prestamo: {
                  cliente: {
                    asignacionesRuta: { some: { rutaId: id, activa: true } },
                  },
                },
                fechaPago: { gte: dInicioBogota, lte: dFinBogota },
              },
              select: { montoTotal: true, origenGestion: true },
            }),
            this.prisma.cuota.findMany({
              where: {
                prestamoId: { in: pIds },
                estado: {
                  in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'],
                },
                fechaVencimiento: { lte: dFinUTC },
              },
              select: {
                prestamoId: true,
                fechaVencimiento: true,
                fechaPago: true,
                estado: true,
                monto: true,
                montoPagado: true,
              },
              orderBy: [{ prestamoId: 'asc' }, { fechaVencimiento: 'asc' }],
            }),
            this.prisma.transaccion.aggregate({
              where: {
                caja: { rutaId: id, activa: true },
                tipoReferencia: 'CUOTA_INICIAL',
                tipo: 'INGRESO',
                fechaTransaccion: { gte: dInicioBogota, lte: dFinBogota },
              },
              _sum: { monto: true },
            }),
          ]);

          const montoMetaInicial = Number(resAgregados[2]?._sum?.monto || 0);
          const pagosRutaRaw = resAgregados[0] as any[];
          const cuotasCriterioQuery = resAgregados[1] as any[];

          const pagosOperativosHoy = pagosRutaRaw.filter(
            (p) =>
              String(p?.origenGestion || '').toUpperCase() !==
              'CIERRE_PENDIENTE',
          );
          const pagosRegularizadosHoy = pagosRutaRaw.filter(
            (p) =>
              String(p?.origenGestion || '').toUpperCase() ===
              'CIERRE_PENDIENTE',
          );
          const recaudoRegularizadoHoy = pagosRegularizadosHoy.reduce(
            (sum, p) => sum + Number(p.montoTotal || 0),
            0,
          );

          estadisticas.cobranzaDelDia =
            pagosOperativosHoy.reduce(
              (sum, p) => sum + Number(p.montoTotal || 0),
              0,
            ) + montoMetaInicial;
          (estadisticas as any).recaudoRegularizadoHoy =
            recaudoRegularizadoHoy;
          (estadisticas as any).recaudoContableHoy =
            estadisticas.cobranzaDelDia + recaudoRegularizadoHoy;

          let metaNominal = 0;
          const primeraCuotaPorPrestamo = new Map<string, number>();
          for (const c of cuotasCriterioQuery) {
            if (!c?.prestamoId) continue;
            const pid = String(c.prestamoId);
            if (primeraCuotaPorPrestamo.has(pid)) continue;
            const monto = Math.max(
              0,
              Number(c.monto || 0) - Number((c as any).montoPagado || 0),
            );
            if (monto <= 0) continue;
            primeraCuotaPorPrestamo.set(pid, monto);
          }

          const diariosIds = prestamosActivos
            .filter((p) => {
              const freq = String(p.frecuenciaPago || '').toUpperCase();
              return freq === 'DIARIO' || freq === 'DIA';
            })
            .map((p) => p.id);

          const metaDiariaPorPrestamo = new Map<string, number>();
          const diariosIdsSet = new Set(diariosIds.map((pid) => String(pid)));
          if (diariosIdsSet.size > 0) {
            for (const c of cuotasCriterioQuery) {
              if (!c?.prestamoId) continue;
              const pid = String(c.prestamoId);
              if (!diariosIdsSet.has(pid)) continue;
              const monto = Math.max(
                0,
                Number(c.monto || 0) - Number((c as any).montoPagado || 0),
              );
              if (monto <= 0) continue;
              metaDiariaPorPrestamo.set(
                pid,
                Number(metaDiariaPorPrestamo.get(pid) || 0) + monto,
              );
            }
          }

          for (const p of prestamosActivos) {
            const pid = String(p.id);
            const freq = String(p.frecuenciaPago || '').toUpperCase();
            if (freq === 'DIARIO' || freq === 'DIA') {
              metaNominal += Number(metaDiariaPorPrestamo.get(pid) || 0);
              continue;
            }
            metaNominal += Number(primeraCuotaPorPrestamo.get(pid) || 0);
          }

          estadisticas.metaDelDia =
            metaNominal + estadisticas.cobranzaDelDia;
        }

        const cuotasCriterio = prestamosActivos.flatMap((p) => p?.cuotas || []);

        const deudaTotal = prestamosActivos.reduce(
          (acc, p: any) => acc + Number(p?.saldoPendiente || 0),
          0,
        );

        const montoVencido = cuotasCriterio
          .filter(
            (c) =>
              c.estado !== 'PAGADA' &&
              new Date(c.fechaVencimiento) < hoyInicioUTC,
          )
          .reduce((sum, c) => sum + Number(c.monto), 0);

        estadisticas.totalDeuda = deudaTotal;
        estadisticas.prestamosActivos = prestamosActivos.filter(
          (p) => p.estado !== 'PAGADO',
        ).length;

        // Calcular avance diario
        if (estadisticas.metaDelDia > 0) {
          avanceDiario =
            (estadisticas.cobranzaDelDia / estadisticas.metaDelDia) * 100;
        }

        // Calcular clientes nuevos (últimos 7 días)
        const sieteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        estadisticas.clientesNuevos = await this.prisma.asignacionRuta.count({
          where: {
            rutaId: id,
            creadoEn: { gte: sieteDiasAtras },
            activa: true,
          },
        });

        const montoVencidoRiesgo = Number(montoVencido || 0);

        porcentajeMora =
          estadisticas.totalDeuda > 0
            ? (montoVencidoRiesgo / estadisticas.totalDeuda) * 100
            : 0;

        if (porcentajeMora > 30) nivelRiesgo = 'ALTO_RIESGO';
        else if (porcentajeMora > 15) nivelRiesgo = 'RIESGO_MODERADO';
        else if (porcentajeMora > 10) nivelRiesgo = 'PRECAUCION';
        else if (porcentajeMora > 5) nivelRiesgo = 'LEVE_RETRASO';
      }

      // BUG-01 FIX (instancia 3): una sola llamada con alias para hoyInicio y hoyFinUTC.
      const { startDate: hoyInicio } =
        getBogotaStartEndOfDay(new Date());

      const ultimoCierre = await this.prisma.transaccion.findFirst({
        where: {
          caja: { rutaId: id, tipo: 'RUTA' },
          tipoReferencia: 'CIERRE_RUTA',
        },
        orderBy: { fechaTransaccion: 'desc' },
        select: { fechaTransaccion: true },
      });

      const fechaDesde =
        ultimoCierre?.fechaTransaccion &&
        ultimoCierre.fechaTransaccion > hoyInicio
          ? ultimoCierre.fechaTransaccion
          : hoyInicio;

      const efectivoEntregadoAgg = await this.prisma.transaccion.aggregate({
        where: {
          caja: { rutaId: id, tipo: 'RUTA' },
          tipo: 'TRANSFERENCIA',
          tipoReferencia: 'RECOLECCION',
          // Solo cuenta la salida real desde caja ruta (evita doble conteo con TRX-IN en caja destino)
          numeroTransaccion: { startsWith: 'TRX-OUT-' },
          fechaTransaccion: { gte: fechaDesde },
        },
        _sum: { monto: true },
      });
      const efectivoEntregadoTotal = Number(
        efectivoEntregadoAgg._sum?.monto || 0,
      );



      const hoyKey2 = getBogotaDayKey(new Date());

      const registrosVisitas = await this.prisma.registroVisita.findMany({
        where: {
          rutaId: id,
          fechaVisita: hoyKey2,
        },
      });
      const visitasMap = new Map(registrosVisitas.map((r) => [r.clienteId, r]));

      const asignaciones: any[] = ruta.asignaciones;
      const prestamosIdsRuta = [
        ...new Set(
          asignaciones.flatMap((asig: any) =>
            (asig?.cliente?.prestamos || [])
              .map((p: any) => p?.id)
              .filter(Boolean),
          ),
        ),
      ];
      const pagosOperativosRutaHoy =
        prestamosIdsRuta.length > 0
          ? await this.prisma.pago.findMany({
              where: {
                rutaId: id,
                prestamoId: { in: prestamosIdsRuta },
                fechaPago: {
                  gte: hoyInicio,
                  lt: getBogotaStartEndOfDay(new Date()).endDate,
                },
                OR: [
                  { origenGestion: null },
                  { origenGestion: { not: 'CIERRE_PENDIENTE' } },
                ],
              },
              select: {
                prestamoId: true,
                clienteId: true,
                montoTotal: true,
              },
            })
          : [];
      const recaudoHoyPorPrestamo = new Map<string, number>();
      const recaudoHoyPorCliente = new Map<string, number>();
      for (const pago of pagosOperativosRutaHoy) {
        const monto = Number(pago.montoTotal || 0);
        if (pago.prestamoId) {
          const key = String(pago.prestamoId);
          recaudoHoyPorPrestamo.set(
            key,
            Number(recaudoHoyPorPrestamo.get(key) || 0) + monto,
          );
        }
        if (pago.clienteId) {
          const key = String(pago.clienteId);
          recaudoHoyPorCliente.set(
            key,
            Number(recaudoHoyPorCliente.get(key) || 0) + monto,
          );
        }
      }

      for (const asig of asignaciones) {
        const reg = visitasMap.get(asig.clienteId) as any;
        const recaudoClienteHoy = Number(
          recaudoHoyPorCliente.get(String(asig.clienteId)) || 0,
        );
        if (reg) {
          // @ts-ignore - Prisma type inference issue, properties exist at runtime
          asig.estadoVisita =
            reg.estadoVisita === 'ausente' && recaudoClienteHoy > 0
              ? 'pagado'
              : reg.estadoVisita;
          // @ts-ignore - Prisma type inference issue, properties exist at runtime
          asig.notasVisita = reg.notas;
        }
        // @ts-ignore - campo calculado para el frontend
        asig.recaudadoDelDia = recaudoClienteHoy;
        if (!asig.cliente || !asig.cliente.prestamos) continue;
        for (const p of asig.cliente.prestamos) {
          const recaudoPrestamoHoy = Number(
            recaudoHoyPorPrestamo.get(String(p.id)) || 0,
          );
          p.recaudadoDelDia = recaudoPrestamoHoy;
          p.recaudadoHoy = recaudoPrestamoHoy;

          // BUG-02 FIX: calcular monto acumulado sin mutar el objeto Prisma.
          // El monto/estado se inyecta directamente al construir proximaCuota más abajo.
          let _montoAcumuladoHoy = 0;
          let _esMoraAtrasada = false;
          if (p.cuotas && p.cuotas.length > 0) {
            for (const c of p.cuotas) {
              const cuotaKey = getBogotaDayKey(new Date(c.fechaVencimiento));
              if (
                c.fechaVencimiento &&
                cuotaKey <= hoyKey2 &&
                c.estado !== 'PAGADA'
              ) {
                _montoAcumuladoHoy += Number(c.monto);
                if (cuotaKey < hoyKey2) _esMoraAtrasada = true;
              }
            }
          }

          // Enriquecer proximaCuota/fechaEfectiva en la respuesta (fuente autoritativa para frontend)
          const cuotasList = Array.isArray(p?.cuotas) ? p.cuotas : [];
          const extension = p?.extensiones?.[0] || null;
          const isNoPagada = (c: any) => {
            const s = String(c?.estado || '').toUpperCase();
            return (
              s !== 'PAGADA' &&
              s !== 'PAGADO' &&
              s !== 'ANULADA' &&
              s !== 'ANULADO'
            );
          };
          const getFechaEfectiva = (c: any): string | null => {
            if (!c) return null;
            const s = String(c?.estado || '').toUpperCase();
            return s === 'PRORROGADA' && c?.fechaVencimientoProrroga
              ? c.fechaVencimientoProrroga
              : (c?.fechaVencimiento ?? null);
          };

          const cuotasSorted = [...cuotasList].sort((a: any, b: any) => {
            const ak = getBogotaDayKey(
              new Date(getFechaEfectiva(a) || a?.fechaVencimiento),
            );
            const bk = getBogotaDayKey(
              new Date(getFechaEfectiva(b) || b?.fechaVencimiento),
            );
            return String(ak || '').localeCompare(String(bk || ''));
          });
          const prox = cuotasSorted.find(isNoPagada) || cuotasSorted[0] || null;

          const cuotaEnProrroga =
            String(prox?.estado || '').toUpperCase() === 'PRORROGADA';
          const fechaEfectiva =
            cuotaEnProrroga && prox?.fechaVencimientoProrroga
              ? prox.fechaVencimientoProrroga
              : (extension?.nuevaFechaVencimiento ??
                prox?.fechaVencimiento ??
                null);

          p.fechaEfectiva = fechaEfectiva;
          // BUG-02 FIX: usar monto acumulado (sin mutar) y estado calculado localmente.
          p.proximaCuota = prox
            ? {
                id: prox.id,
                numeroCuota: prox.numeroCuota,
                monto:
                  _montoAcumuladoHoy > 0
                    ? _montoAcumuladoHoy
                    : Number(prox.monto),
                estado:
                  _esMoraAtrasada && _montoAcumuladoHoy > 0
                    ? 'VENCIDA'
                    : prox.estado,
                fechaVencimiento: prox.fechaVencimiento,
                fechaVencimientoProrroga: prox.fechaVencimientoProrroga,
                enProrroga: cuotaEnProrroga,
              }
            : null;
        }
      }

      return {
        ...ruta,

        estadisticas: {
          ...estadisticas,

          avanceDiario: parseFloat(avanceDiario.toFixed(2)),

          efectivoEntregado: efectivoEntregadoTotal,
        },

        nivelRiesgo,

        porcentajeMora: parseFloat(porcentajeMora.toFixed(2)),

        cobrador: `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`,

        supervisor: ruta.supervisorId
          ? `${ruta.supervisor?.nombres ?? ''} ${ruta.supervisor?.apellidos ?? ''}`
          : undefined,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      )
        throw error;

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException({
          message: 'Datos inválidos para obtener la ruta.',

          code: error.code,

          meta: error.meta,
        });
      }

      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new BadRequestException({
          message: 'Datos inválidos para obtener la ruta.',

          details: error.message,
        });
      }

      throw new InternalServerErrorException(
        `Error al obtener la ruta: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async update(id: string, updateRouteDto: UpdateRouteDto) {
    // Verificar si la ruta existe

    const existingRoute = await this.prisma.ruta.findFirst({
      where: {
        id,

        eliminadoEn: null,
      },
    });

    if (!existingRoute) {
      throw new NotFoundException('Ruta no encontrada');
    }

    // Verificar si el código ya existe (si se está actualizando)

    if (
      updateRouteDto.codigo &&
      updateRouteDto.codigo !== existingRoute.codigo
    ) {
      const duplicateCode = await this.prisma.ruta.findUnique({
        where: { codigo: updateRouteDto.codigo },
      });

      if (duplicateCode) {
        throw new ConflictException('El código de ruta ya existe');
      }
    }

    // Verificar cobrador si se proporciona

    if (updateRouteDto.cobradorId) {
      const cobrador = await this.prisma.usuario.findFirst({
        where: {
          id: updateRouteDto.cobradorId,

          rol: 'COBRADOR',
        },
      });

      if (!cobrador) {
        throw new BadRequestException(
          'El cobrador especificado no existe o no tiene el rol correcto',
        );
      }
    }

    // Verificar supervisor si se proporciona

    if (updateRouteDto.supervisorId) {
      const supervisor = await this.prisma.usuario.findFirst({
        where: {
          id: updateRouteDto.supervisorId,

          rol: { in: ['SUPERVISOR', 'COORDINADOR'] },
        },
      });

      if (!supervisor) {
        throw new BadRequestException(
          'El supervisor especificado no existe o no tiene el rol correcto',
        );
      }
    }

    try {
      const updatedRoute = await this.prisma.$transaction(async (tx) => {
        const route = await tx.ruta.update({
          where: { id },

          data: updateRouteDto,

          include: {
            cobrador: {
              select: {
                id: true,

                nombres: true,

                apellidos: true,

                correo: true,

                telefono: true,

                rol: true,
              },
            },

            supervisor: {
              select: {
                id: true,

                nombres: true,

                apellidos: true,

                correo: true,

                telefono: true,

                rol: true,
              },
            },
          },
        });

        if (
          updateRouteDto.cobradorId &&
          updateRouteDto.cobradorId !== existingRoute.cobradorId
        ) {
          await tx.asignacionRuta.updateMany({
            where: { rutaId: id, activa: true },
            data: { cobradorId: updateRouteDto.cobradorId },
          });

          await tx.caja.updateMany({
            where: { rutaId: id, tipo: 'RUTA', activa: true },
            data: { responsableId: updateRouteDto.cobradorId },
          });
        }

        return route;
      });

      if (
        updateRouteDto.cobradorId &&
        updateRouteDto.cobradorId !== existingRoute.cobradorId
      ) {
        await this.notificacionesService.create({
          usuarioId: updateRouteDto.cobradorId,

          titulo: 'Ruta Asignada',

          mensaje: `Se te ha asignado la ruta ${updatedRoute.nombre} (${updatedRoute.codigo})`,

          tipo: 'RUTA',

          entidad: 'Ruta',

          entidadId: updatedRoute.id,
        });
      }

      this.notificacionesGateway.broadcastRutasActualizadas({
        accion: 'ACTUALIZAR',

        rutaId: updatedRoute.id,
      });

      this.notificacionesGateway.broadcastDashboardsActualizados({});

      return updatedRoute;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('El código de ruta ya existe');
        }

        if (error.code === 'P2003') {
          throw new BadRequestException(
            'Relación inválida con cobrador o supervisor',
          );
        }
      }

      throw error;
    }
  }

  async remove(id: string) {
    // Verificar si la ruta existe

    const existingRoute = await this.prisma.ruta.findFirst({
      where: {
        id,

        eliminadoEn: null,
      },

      include: {
        _count: {
          select: {
            asignaciones: {
              where: { activa: true },
            },

            cajas: {
              where: { activa: true },
            },
          },
        },
      },
    });

    if (!existingRoute) {
      throw new NotFoundException('Ruta no encontrada');
    }

    // Verificar si hay asignaciones activas

    if (existingRoute._count.asignaciones > 0) {
      throw new BadRequestException(
        'No se puede eliminar una ruta con clientes asignados',
      );
    }

    // Verificar si hay cajas activas

    if (existingRoute._count.cajas > 0) {
      throw new BadRequestException(
        'No se puede eliminar una ruta con cajas activas',
      );
    }

    try {
      // Soft delete

      const updatedRoute = await this.prisma.ruta.update({
        where: { id },

        data: {
          eliminadoEn: new Date(),

          activa: false,
        },
      });

      this.notificacionesGateway.broadcastRutasActualizadas({
        accion: 'ELIMINAR',

        rutaId: updatedRoute.id,
      });

      this.notificacionesGateway.broadcastDashboardsActualizados({});

      return { message: 'Ruta eliminada correctamente' };
    } catch (error) {
      throw new InternalServerErrorException('Error al eliminar la ruta');
    }
  }

  async toggleActive(id: string) {
    const existingRoute = await this.prisma.ruta.findFirst({
      where: {
        id,

        eliminadoEn: null,
      },
    });

    if (!existingRoute) {
      throw new NotFoundException('Ruta no encontrada');
    }

    try {
      const updatedRoute = await this.prisma.ruta.update({
        where: { id },

        data: {
          activa: !existingRoute.activa,
        },

        include: {
          cobrador: {
            select: {
              id: true,

              nombres: true,

              apellidos: true,

              correo: true,

              telefono: true,

              rol: true,
            },
          },
        },
      });

      if (updatedRoute.activa && updatedRoute.cobradorId) {
        await this.notificacionesService.create({
          usuarioId: updatedRoute.cobradorId,

          titulo: 'Ruta Activada',

          mensaje: `Tu ruta ${updatedRoute.nombre} ha sido activada`,

          tipo: 'RUTA',

          entidad: 'Ruta',

          entidadId: updatedRoute.id,
        });
      }

      this.notificacionesGateway.broadcastRutasActualizadas({
        accion: 'ACTUALIZAR',

        rutaId: updatedRoute.id,
      });

      this.notificacionesGateway.broadcastDashboardsActualizados({});

      return {
        ...updatedRoute,

        message: `Ruta ${updatedRoute.activa ? 'activada' : 'desactivada'} correctamente`,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al cambiar el estado de la ruta',
      );
    }
  }

  async getStatistics() {
    try {
      const [
        totalRutas,

        rutasActivas,

        rutasInactivas,

        totalClientesAsignados,

        cobranzaHoy,

        metaHoy,
      ] = await Promise.all([
        this.prisma.ruta.count({ where: { eliminadoEn: null } }),

        this.prisma.ruta.count({ where: { activa: true, eliminadoEn: null } }),

        this.prisma.ruta.count({ where: { activa: false, eliminadoEn: null } }),

        this.prisma.asignacionRuta.count({ where: { activa: true } }),

        // Cobranza de hoy

        (async () => {
          const { startDate: hoyInicio, endDate: hoyFin } =
            getBogotaStartEndOfDay(new Date());

          const result = await this.prisma.pago.aggregate({
            where: {
              fechaPago: {
                gte: hoyInicio,
                lte: hoyFin,
              },
              OR: [
              { origenGestion: null },
              { origenGestion: { not: 'CIERRE_PENDIENTE' } },
            ],
            },

            _sum: {
              montoTotal: true,
            },
          });

          return result._sum.montoTotal?.toNumber() || 0;
        })(),

        // Meta de hoy (nominal: una cuota por crédito activo/mora/pagado hoy)
        (async () => {
          const { startDate: hoyUTC } = getBogotaStartEndOfDay(new Date());
          // BUG-07 FIX: usar _sum en vez de _max para reflejar la meta real (cuotas acumuladas).
          const result = await this.prisma.cuota.groupBy({
            by: ['prestamoId'],
            where: {
              fechaVencimiento: { lte: hoyUTC },
              prestamo: { estado: { in: ['ACTIVO', 'EN_MORA', 'PAGADO'] } },
              estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA', 'PRORROGADA'] },
            },
            _sum: { monto: true },
          });
          return result.reduce(
            (sum, r) => sum + (Number(r._sum.monto) || 0),
            0,
          );
        })(),
      ]);

      // Obtener supervisores únicos

      const supervisores = await this.prisma.ruta.groupBy({
        by: ['supervisorId'],

        where: {
          eliminadoEn: null,

          supervisorId: { not: null },
        },

        _count: {
          _all: true,
        },
      });

      const totalSupervisores = supervisores.length;

      return {
        totalRutas,

        rutasActivas,

        rutasInactivas,

        totalClientesAsignados,

        cobranzaHoy,

        metaHoy,

        porcentajeAvance: metaHoy > 0 ? (cobranzaHoy / metaHoy) * 100 : 0,

        totalSupervisores,
      };
    } catch (error) {
      throw new InternalServerErrorException('Error al obtener estadísticas');
    }
  }

  async getCobradores() {
    try {
      const cobradores = await this.prisma.usuario.findMany({
        where: {
          rol: 'COBRADOR',

          estado: 'ACTIVO',

          eliminadoEn: null,
        },

        select: {
          id: true,

          nombres: true,

          apellidos: true,

          correo: true,

          telefono: true,
        },

        orderBy: { nombres: 'asc' },
      });

      return cobradores.map((c) => ({
        id: c.id,

        nombre: `${c.nombres} ${c.apellidos}`,

        correo: c.correo,

        telefono: c.telefono,
      }));
    } catch (error) {
      throw new InternalServerErrorException('Error al obtener cobradores');
    }
  }

  async getSupervisores() {
    try {
      const supervisores = await this.prisma.usuario.findMany({
        where: {
          rol: { in: ['SUPERVISOR', 'COORDINADOR'] },

          estado: 'ACTIVO',

          eliminadoEn: null,
        },

        select: {
          id: true,

          nombres: true,

          apellidos: true,

          correo: true,

          telefono: true,

          rol: true,
        },

        orderBy: { nombres: 'asc' },
      });

      return supervisores.map((s) => ({
        id: s.id,

        nombre: `${s.nombres} ${s.apellidos}`,

        correo: s.correo,

        telefono: s.telefono,

        rol: s.rol,
      }));
    } catch (error) {
      throw new InternalServerErrorException('Error al obtener supervisores');
    }
  }

  async assignClient(rutaId: string, clienteId: string, cobradorId: string) {
    try {
      // Verificar si la ruta existe

      const ruta = await this.prisma.ruta.findFirst({
        where: {
          id: rutaId,

          eliminadoEn: null,

          activa: true,
        },
      });

      if (!ruta) {
        throw new NotFoundException('Ruta no encontrada o inactiva');
      }

      // Verificar si el cliente existe

      const cliente = await this.prisma.cliente.findFirst({
        where: {
          id: clienteId,

          eliminadoEn: null,
        },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado');
      }

      const assignmentCobradorId = ruta.cobradorId;

      const asignacion = await this.prisma.$transaction(async (tx) => {
        const existingAssignment = await tx.asignacionRuta.findFirst({
          where: {
            clienteId,
            rutaId,
            activa: true,
          },
        });

        if (existingAssignment) {
          await tx.asignacionRuta.updateMany({
            where: {
              clienteId,
              activa: true,
              id: { not: existingAssignment.id },
            },
            data: { activa: false },
          });

          const updated = await tx.asignacionRuta.update({
            where: { id: existingAssignment.id },
            data: {
              cobradorId: assignmentCobradorId,
              activa: true,
            },
            include: {
              cliente: {
                select: {
                  id: true,
                  nombres: true,
                  apellidos: true,
                  dni: true,
                  telefono: true,
                },
              },
            },
          });

          // Nota: Prestamo no tiene campo cobradorId; el cobrador se gestiona
          // a través de la AsignacionRuta. No se actualiza aquí.

          return updated;
        }

        await tx.asignacionRuta.updateMany({
          where: { clienteId, activa: true },
          data: { activa: false },
        });

        const maxOrden = await tx.asignacionRuta.aggregate({
          where: { rutaId, activa: true },
          _max: { ordenVisita: true },
        });

        const nuevoOrden = (maxOrden._max.ordenVisita || 0) + 1;

        const created = await tx.asignacionRuta.create({
          data: {
            rutaId,
            clienteId,
            cobradorId: assignmentCobradorId,
            ordenVisita: nuevoOrden,
            activa: true,
          },
          include: {
            cliente: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                dni: true,
                telefono: true,
              },
            },
          },
        });

          // Nota: Prestamo no tiene campo cobradorId; el cobrador se gestiona
          // a través de la AsignacionRuta. No se actualiza aquí.

        return created;
      });

      if (assignmentCobradorId) {
        await this.notificacionesService.create({
          usuarioId: assignmentCobradorId,

          titulo: 'Nuevo Cliente Asignado',

          mensaje: `Se ha asignado el cliente ${asignacion.cliente.nombres} ${asignacion.cliente.apellidos} a tu ruta ${ruta.nombre}`,

          tipo: 'CLIENTE',

          entidad: 'Cliente',

          entidadId: asignacion.clienteId,
        });
      }

      return asignacion;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'El cliente ya está asignado a esta ruta',
          );
        }

        if (error.code === 'P2003') {
          throw new BadRequestException('Relación inválida');
        }
      }

      throw error;
    }
  }

  async removeClient(rutaId: string, clienteId: string) {
    try {
      // Verificar si la asignación existe

      const asignacion = await this.prisma.asignacionRuta.findFirst({
        where: {
          rutaId,

          clienteId,

          activa: true,
        },
      });

      if (!asignacion) {
        throw new NotFoundException('Asignación no encontrada');
      }

      // Actualizar el estado de la asignación

      await this.prisma.asignacionRuta.update({
        where: { id: asignacion.id },

        data: { activa: false },
      });

      // Reordenar las asignaciones restantes

      await this.reorderAssignments(rutaId);

      const ruta = await this.prisma.ruta.findUnique({
        where: { id: rutaId },

        select: { nombre: true, cobradorId: true },
      });

      const cliente = await this.prisma.cliente.findUnique({
        where: { id: clienteId },

        select: { nombres: true, apellidos: true },
      });

      if (ruta?.cobradorId) {
        await this.notificacionesService.create({
          usuarioId: ruta.cobradorId,

          titulo: 'Cliente Removido',

          mensaje: `El cliente ${cliente?.nombres} ${cliente?.apellidos} ha sido removido de tu ruta ${ruta.nombre}`,

          tipo: 'CLIENTE',
        });
      }

      return { message: 'Cliente removido de la ruta correctamente' };
    } catch (error) {
      throw new InternalServerErrorException('Error al remover el cliente');
    }
  }

  async moveClient(clientId: string, fromRutaId: string, toRutaId: string) {
    try {
      // Verificar ambas rutas

      const [rutaOrigen, rutaDestino] = await Promise.all([
        this.prisma.ruta.findFirst({
          where: {
            id: fromRutaId,

            eliminadoEn: null,
          },
        }),

        this.prisma.ruta.findFirst({
          where: {
            id: toRutaId,

            eliminadoEn: null,
          },
        }),
      ]);

      if (!rutaOrigen || !rutaDestino) {
        throw new NotFoundException('Una o ambas rutas no existen');
      }

      // Verificar la asignación actual

      const asignacionActual = await this.prisma.asignacionRuta.findFirst({
        where: {
          clienteId: clientId,

          rutaId: fromRutaId,

          activa: true,
        },
      });

      if (!asignacionActual) {
        throw new NotFoundException(
          'El cliente no está asignado a la ruta de origen',
        );
      }

      // BUG-15 FIX: Mover el cliente en una sola transacción que también actualiza el
      // cobradorId en los préstamos activos. Sin esto, los pagos del nuevo cobrador
      // no se reflejan correctamente en sus estadísticas de recaudo.
      await this.prisma.$transaction(async (tx) => {
        const existingInDestination = await tx.asignacionRuta.findFirst({
          where: {
            clienteId: clientId,
            rutaId: toRutaId,
            activa: true,
          },
        });

        await tx.asignacionRuta.updateMany({
          where: {
            clienteId: clientId,
            activa: true,
            ...(existingInDestination
              ? { id: { not: existingInDestination.id } }
              : {}),
          },
          data: { activa: false },
        });

        if (existingInDestination) {
          await tx.asignacionRuta.update({
            where: { id: existingInDestination.id },
            data: {
              cobradorId: rutaDestino.cobradorId,
              activa: true,
            },
          });
        } else {
          const maxOrdenDestino = await tx.asignacionRuta.aggregate({
            where: { rutaId: toRutaId, activa: true },
            _max: { ordenVisita: true },
          });

          await tx.asignacionRuta.create({
            data: {
              rutaId: toRutaId,
              clienteId: clientId,
              cobradorId: rutaDestino.cobradorId,
              ordenVisita: (maxOrdenDestino._max.ordenVisita || 0) + 1,
              activa: true,
            },
          });
        }

        if (rutaDestino.cobradorId) {
          await tx.prestamo.updateMany({
            where: {
              clienteId: clientId,
              estado: { in: ['ACTIVO', 'EN_MORA'] },
              eliminadoEn: null,
            },
            data: { cobradorId: rutaDestino.cobradorId },
          });
        }
      });

      // Reordenar ambas rutas

      await Promise.all([
        this.reorderAssignments(fromRutaId),

        this.reorderAssignments(toRutaId),
      ]);

      if (rutaDestino.cobradorId) {
        const cliente = await this.prisma.cliente.findUnique({
          where: { id: clientId },

          select: { nombres: true, apellidos: true },
        });

        await this.notificacionesService.create({
          usuarioId: rutaDestino.cobradorId,

          titulo: 'Nuevo Cliente Trasladado',

          mensaje: `Se ha trasladado al cliente ${cliente?.nombres} ${cliente?.apellidos} a tu ruta ${rutaDestino.nombre}`,

          tipo: 'CLIENTE',
        });
      }

      return { message: 'Cliente movido correctamente' };
    } catch (error) {
      throw new InternalServerErrorException('Error al mover el cliente');
    }
  }

  /**

   * Mueve un crédito específico de un cliente a otra ruta.
   * La asignación operativa es por cliente, así que el cliente debe quedar
   * activo solo en la ruta destino.

   */

  async moveLoan(prestamoId: string, toRutaId: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: { id: prestamoId },

        select: {
          id: true,
          clienteId: true,
          frecuenciaPago: true,
          estado: true,
        },
      });

      if (!prestamo) throw new NotFoundException('Préstamo no encontrado');

      const rutaDestino = await this.prisma.ruta.findFirst({
        where: { id: toRutaId, eliminadoEn: null },
      });

      if (!rutaDestino)
        throw new NotFoundException('Ruta destino no encontrada');

      await this.prisma.$transaction(async (tx) => {
        const yaAsignado = await tx.asignacionRuta.findFirst({
          where: {
            clienteId: prestamo.clienteId,
            rutaId: toRutaId,
            activa: true,
          },
        });

        await tx.asignacionRuta.updateMany({
          where: {
            clienteId: prestamo.clienteId,
            activa: true,
            ...(yaAsignado ? { id: { not: yaAsignado.id } } : {}),
          },
          data: { activa: false },
        });

        if (yaAsignado) {
          await tx.asignacionRuta.update({
            where: { id: yaAsignado.id },
            data: {
              cobradorId: rutaDestino.cobradorId,
              activa: true,
            },
          });
          return;
        }

        const maxOrden = await tx.asignacionRuta.aggregate({
          where: { rutaId: toRutaId, activa: true },
          _max: { ordenVisita: true },
        });

        await tx.asignacionRuta.create({
          data: {
            rutaId: toRutaId,
            clienteId: prestamo.clienteId,
            cobradorId: rutaDestino.cobradorId,
            ordenVisita: (maxOrden._max.ordenVisita || 0) + 1,
            activa: true,
          },
        });
      });

      this.notificacionesGateway.broadcastRutasActualizadas({
        accion: 'ACTUALIZAR',

        rutaId: toRutaId,
      });

      if (rutaDestino.cobradorId) {
        const cliente = await this.prisma.cliente.findUnique({
          where: { id: prestamo.clienteId },

          select: { nombres: true, apellidos: true },
        });

        await this.notificacionesService.create({
          usuarioId: rutaDestino.cobradorId,

          titulo: 'Nuevo Crédito en Ruta',

          mensaje: `Se ha asignado un nuevo crédito del cliente ${cliente?.nombres} ${cliente?.apellidos} a tu ruta ${rutaDestino.nombre}`,

          tipo: 'PRESTAMO',
        });
      }

      return { message: 'Crédito asignado a la nueva ruta correctamente' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Error al mover el crédito');
    }
  }

  async reorderAssignments(rutaId: string) {
    try {
      const asignaciones = await this.prisma.asignacionRuta.findMany({
        where: { rutaId, activa: true },

        orderBy: { ordenVisita: 'asc' },
      });

      // Actualizar el orden secuencialmente

      const updates = asignaciones.map((asignacion, index) =>
        this.prisma.asignacionRuta.update({
          where: { id: asignacion.id },

          data: { ordenVisita: index + 1 },
        }),
      );

      await this.prisma.$transaction(updates);
    } catch (error) {
      throw new InternalServerErrorException('Error al reordenar asignaciones');
    }
  }

  /**

   * Obtener visitas del día para una ruta

   * Calcula qué clientes deben aparecer hoy según frecuencia de pago y estado de cuotas

   */

  async getDailyVisits(rutaId: string, fecha?: string, actor?: RouteActor) {
    await this.assertCollectorOwnRoute(rutaId, actor);

    const fechaKey = this.parseFechaOperativaBogotaKey(fecha);

    const { startDate: fechaConsulta } =
      getBogotaStartEndOfDayFromKey(fechaKey);

    const jornada = await this.prisma.rutaJornada?.findUnique?.({
      where: {
        rutaId_fechaOperativa: {
          rutaId,
          fechaOperativa: fechaKey,
        },
      },
      select: {
        id: true,
        estado: true,
        cerradaEn: true,
        regularizadaEn: true,
      },
    });

    // Obtener todos los clientes de la ruta con sus préstamos activos

    const asignaciones = await this.prisma.asignacionRuta.findMany({
      where: {
        rutaId,

        activa: true,
      },

      include: {
        cliente: {
          include: {
            prestamos: {
              where: {
                estado: { in: ['ACTIVO', 'EN_MORA', 'PAGADO'] },
                eliminadoEn: null,
              },

              include: {
                cuotas: {
                  orderBy: { fechaVencimiento: 'asc' },
                },
              },
            },
          },
        },
      },

      orderBy: { ordenVisita: 'asc' },
    });

    const visitasDelDia: any[] = [];

    const clientesProcesados = new Set<string>();

    for (const asignacion of asignaciones) {
      const cliente = asignacion.cliente;

      // Si el cliente ya fue agregado a la lista de hoy (evitar duplicados por múltiples asignaciones)

      if (clientesProcesados.has(cliente.id)) continue;

      let debeAparecerHoy = false;

      // Revisar cada préstamo activo

      for (const prestamo of cliente.prestamos) {


        if (prestamo.cuotas.length === 0) continue;

        // Filter cuotas to find proximaCuota (as before, but now from all cuotas)
        const filteredCuotas = prestamo.cuotas.filter((c: any) => {
          const fechaVto = new Date(c.fechaVencimiento);
          const fechaVtoKey = getBogotaDayKey(fechaVto);
          const fechaConsultaKey = getBogotaDayKey(fechaConsulta);

          const isUnpaidAndDue = ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'].includes(c.estado) &&
            fechaVtoKey <= fechaConsultaKey;

          const isPaidToday = c.estado === 'PAGADA' &&
            c.fechaPago &&
            new Date(c.fechaPago) >= fechaConsulta &&
            new Date(c.fechaPago) <= getBogotaStartEndOfDayFromKey(fechaKey).endDate;

          return isUnpaidAndDue || isPaidToday;
        }).sort((a: any, b: any) => {
          const aFecha = new Date(a.fechaVencimiento);
          const bFecha = new Date(b.fechaVencimiento);
          return aFecha.getTime() - bFecha.getTime();
        });

        const proximaCuota = filteredCuotas[0] || prestamo.cuotas[0];

        // Para cuotas PRORROGADA, usar la nueva fecha de vencimiento

        const fechaEfectivaRaw =
          proximaCuota.estado === 'PRORROGADA' &&
          proximaCuota.fechaVencimientoProrroga
            ? new Date(proximaCuota.fechaVencimientoProrroga)
            : new Date(proximaCuota.fechaVencimiento);

        // Fecha efectiva normalizada para comparación de "día calendario" en Bogotá
        const fechaEfectivaKey = getBogotaDayKey(fechaEfectivaRaw);
        const fechaConsultaKey = getBogotaDayKey(fechaConsulta);

        // Calcular días de diferencia absoluta basándose en claves Bogotá
        const daysDiff = (dateStr: string) => {
          const [y, m, d] = dateStr.split('-').map(Number);
          const base = new Date(
            `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00-05:00`,
          );
          return Math.floor(base.getTime() / 86_400_000);
        };
        const diasHastaVencimiento =
          daysDiff(fechaEfectivaKey) - daysDiff(fechaConsultaKey);

        if (fechaEfectivaKey <= fechaConsultaKey) {
          debeAparecerHoy = true;
          break;
        }

        // Todas las frecuencias tienen el mismo criterio: aparece hoy si la cuota vence hoy o antes.
        // (El bloque if anterior ya cubre fechaEfectivaKey <= fechaConsultaKey con break;
        //  este if protege el caso borde donde diasHastaVencimiento es 0 pero la clave aún no coincide.)
        if (diasHastaVencimiento <= 0) debeAparecerHoy = true;

        if (debeAparecerHoy) break;
      }

      if (debeAparecerHoy) {
        // Compute cuotaObjetivo for each prestamo
        const prestamosConCuotaObjetivo = cliente.prestamos.map((p) => {
          const montoTotalCuotas = p.cuotas.reduce(
            (sum, c) => sum + Number(c.monto),
            0,
          );
          const cuotaObjetivo = this.computeCuotaObjetivo(p, fechaKey);
          // Filter cuotas for proximaCuota as before
          const filteredCuotas = p.cuotas.filter((c: any) => {
            const fechaVto = new Date(c.fechaVencimiento);
            const fechaVtoKey = getBogotaDayKey(fechaVto);
            const fechaConsultaKey = getBogotaDayKey(fechaConsulta);

            const isUnpaidAndDue = ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'].includes(c.estado) &&
              fechaVtoKey <= fechaConsultaKey;

            const isPaidToday = c.estado === 'PAGADA' &&
              c.fechaPago &&
              new Date(c.fechaPago) >= fechaConsulta &&
              new Date(c.fechaPago) <= getBogotaStartEndOfDayFromKey(fechaKey).endDate;

            return isUnpaidAndDue || isPaidToday;
          }).sort((a: any, b: any) => {
            const aFecha = new Date(a.fechaVencimiento);
            const bFecha = new Date(b.fechaVencimiento);
            return aFecha.getTime() - bFecha.getTime();
          });
          const proximaCuota = filteredCuotas[0] || p.cuotas[0];
          return {
            id: p.id,
            numeroPrestamo: p.numeroPrestamo,
            monto: Number(p.monto),
            saldoPendiente: Number(p.saldoPendiente),
            frecuenciaPago: p.frecuenciaPago,
            cantidadCuotas: p.cantidadCuotas,
            estado: p.estado,
            montoMetaOperativaPendiente:
              this.computePendienteOperativoPrestamo(p, fechaKey),
            proximaCuota: proximaCuota
              ? {
                  id: proximaCuota.id,
                  numeroCuota: proximaCuota.numeroCuota,
                  fechaVencimiento:
                    proximaCuota.estado === 'PRORROGADA' &&
                    proximaCuota.fechaVencimientoProrroga
                      ? proximaCuota.fechaVencimientoProrroga
                      : proximaCuota.fechaVencimiento,
                  monto: Number(proximaCuota.monto),
                  montoTotalDeuda: montoTotalCuotas,
                  montoNominal: Number(proximaCuota.monto),
                  estado: proximaCuota.estado,
                  enProrroga: proximaCuota.estado === 'PRORROGADA',
                  fechaOriginalVencimiento:
                    proximaCuota.estado === 'PRORROGADA'
                      ? proximaCuota.fechaVencimiento
                      : undefined,
                }
              : null,
            cuotaObjetivo,
          };
        });
        // Find the best prestamo with cuotaObjetivo (prioritize pagable/reprogrammable)
        const prestamoObjetivo = prestamosConCuotaObjetivo.find((p) => {
          return p.cuotaObjetivo?.puedePagar || p.cuotaObjetivo?.puedeReprogramar;
        }) || prestamosConCuotaObjetivo.find(p => p.cuotaObjetivo) || null;
        
        const clienteCuotaObjetivo = prestamoObjetivo?.cuotaObjetivo || null;
        const prestamoObjetivoId = prestamoObjetivo?.id || null;
        const cuotaObjetivoId = clienteCuotaObjetivo?.id || null;
        
        visitasDelDia.push({
          asignacionId: asignacion.id,
          ordenVisita: asignacion.ordenVisita,
          cliente: {
            id: cliente.id,
            codigo: cliente.codigo,
            dni: cliente.dni,
            nombres: cliente.nombres,
            apellidos: cliente.apellidos,
            telefono: cliente.telefono,
            direccion: cliente.direccion,
            nivelRiesgo: cliente.nivelRiesgo,
            prestamosActivos: cliente.prestamos.length,
          },
          prestamos: prestamosConCuotaObjetivo,
          cuotaObjetivo: clienteCuotaObjetivo,
          prestamoObjetivoId,
          cuotaObjetivoId,
          // Deprecado: mantener para compatibilidad temporal
          cuotaObjetivoPrestamoId: cuotaObjetivoId,
        });

        clientesProcesados.add(cliente.id);
      }
    }

    // Obtener los registros de visita (ej: ausentes) de hoy
    const registrosVisitas = await this.prisma.registroVisita.findMany({
      where: {
        rutaId,
        fechaVisita: fechaKey,
      },
    });
    const visitasMap = new Map(registrosVisitas.map((r) => [r.clienteId, r]));
    const clientesVisitaIds = [
      ...new Set(
        visitasDelDia
          .map((v: any) => v?.cliente?.id || v?.clienteId)
          .filter(Boolean),
      ),
    ];
    const reprogramacionesJornada =
      clientesVisitaIds.length > 0 &&
      this.prisma.aprobacion?.findMany
        ? await this.prisma.aprobacion.findMany({
            where: {
              tipoAprobacion: TipoAprobacion.REPROGRAMACION_CUOTA,
              estado: { in: [EstadoAprobacion.PENDIENTE, EstadoAprobacion.APROBADO] },
              datosSolicitud: {
                path: ['fechaOperativaRuta'],
                equals: fechaKey,
              },
            },
            orderBy: { creadoEn: 'desc' },
            select: {
              id: true,
              referenciaId: true,
              estado: true,
              datosSolicitud: true,
              creadoEn: true,
            },
          })
        : [];
    const reprogramacionPorCliente = new Map<string, any>();
    reprogramacionesJornada.forEach((aprobacion: any) => {
      const datos = (aprobacion?.datosSolicitud || {}) as any;
      const clienteId = String(datos?.clienteId || '');
      if (
        !clienteId ||
        !clientesVisitaIds.includes(clienteId) ||
        String(datos?.fechaOperativaRuta || '') !== fechaKey
      ) {
        return;
      }
      if (!reprogramacionPorCliente.has(clienteId)) {
        reprogramacionPorCliente.set(clienteId, aprobacion);
      }
    });

    // Calcular recaudo real de esa fecha para esa ruta
    // Calcular recaudo real de esa fecha para la ruta basándose en los clientes identificados
    const { startDate: fInicio, endDate: fFin } =
      getBogotaStartEndOfDayFromKey(fechaKey);
    // Obtener TODOS los pagos vinculados a préstamos de esta ruta en la fecha,
    // incluyendo clientes no programados hoy (sintéticos) Y pagos regularizados de esta jornada
    const pagosDeHoy = await this.prisma.pago.findMany({
      where: {
        prestamo: {
          cliente: {
            asignacionesRuta: {
              some: { rutaId, activa: true },
            },
          },
        },
        OR: [
          {
            fechaPago: { gte: fInicio, lte: fFin },
            OR: [
              { origenGestion: null },
              { origenGestion: { not: 'CIERRE_PENDIENTE' } },
            ],
          },
          {
            fechaOperativaRuta: fechaKey,
            origenGestion: 'CIERRE_PENDIENTE',
          },
        ],
      },
      select: { 
        id: true,
        clienteId: true, 
        prestamoId: true,
        montoTotal: true,
        fechaPago: true,
        fechaOperativaRuta: true,
        origenGestion: true,
        metodoPago: true,
        detalles: {
          select: {
            monto: true,
            cuota: {
              select: {
                id: true,
                numeroCuota: true,
                estado: true,
                fechaVencimiento: true,
                fechaVencimientoProrroga: true,
                monto: true,
                montoPagado: true,
              },
            },
          },
        },
      },
    });

    // Mapear pagos por cliente para asignar a visitas
    const pagosPorCliente: Record<string, number> = {};
    pagosDeHoy.forEach((p) => {
      pagosPorCliente[p.clienteId] =
        (pagosPorCliente[p.clienteId] || 0) + Number(p.montoTotal || 0);
    });

    // Separar recaudos: contable (pagos reales del día) vs regularizado (pagos de jornadas viejas)
    const isFechaPagoEnRango = (p: any) => {
      const fechaPago = new Date(p.fechaPago);
      return fechaPago >= fInicio && fechaPago <= fFin;
    };

    const isRegularizadoParaJornada = (p: any) => {
      return (
        p.fechaOperativaRuta === fechaKey &&
        p.origenGestion === 'CIERRE_PENDIENTE'
      );
    };

    const recaudoContable = pagosDeHoy
      .filter(isFechaPagoEnRango)
      .reduce((sum, p) => sum + Number(p.montoTotal || 0), 0);

    const recaudoRegularizado = pagosDeHoy
      .filter((p) => isRegularizadoParaJornada(p) && !isFechaPagoEnRango(p))
      .reduce((sum, p) => sum + Number(p.montoTotal || 0), 0);

    const recaudoOperativo = pagosDeHoy
      .filter((p) => isFechaPagoEnRango(p) || isRegularizadoParaJornada(p))
      .reduce((sum, p) => sum + Number(p.montoTotal || 0), 0);

    const sumPagosByMetodo = (pagos: any[], metodo: 'EFECTIVO' | 'TRANSFERENCIA') => {
      return pagos.reduce((sum, p) => {
        const metodoPago = String(p.metodoPago || 'EFECTIVO').toUpperCase();
        if (metodoPago !== metodo) return sum;
        return sum + Number(p.montoTotal || 0);
      }, 0);
    };

    const pagosOperativos = pagosDeHoy.filter(
      (p) => isFechaPagoEnRango(p) || isRegularizadoParaJornada(p),
    );
    const pagosContables = pagosDeHoy.filter(isFechaPagoEnRango);
    const pagosRegularizados = pagosDeHoy.filter(
      (p) => isRegularizadoParaJornada(p) && !isFechaPagoEnRango(p),
    );

    const buildCuotaObjetivoDesdePago = (pago: any) => {
      const detalle = Array.isArray(pago?.detalles)
        ? [...pago.detalles]
            .filter((d: any) => d?.cuota)
            .sort((a: any, b: any) =>
              Number(a?.cuota?.numeroCuota || 0) -
              Number(b?.cuota?.numeroCuota || 0),
            )[0]
        : null;
      const cuota = detalle?.cuota;
      if (!cuota) return null;

      const fechaEfectivaKey = this.getCuotaFechaEfectivaKey(cuota);
      const montoCuota = Number(cuota.monto || 0);
      const estado = String(cuota.estado || '').toUpperCase();
      const pagada = ['PAGADA', 'PAGADO'].includes(estado);
      const anulada = ['ANULADA', 'ANULADO'].includes(estado);
      const estadoTerminal = pagada || anulada;
      const montoPagado = Math.max(
        Number(cuota.montoPagado || 0),
        Number(detalle?.monto || 0),
      );
      const saldoCuota = estadoTerminal ? 0 : Math.max(0, montoCuota - montoPagado);
      const esCuotaFuturaEnFechaOperativa = fechaEfectivaKey > fechaKey;
      const saldoExigibleEnFechaOperativa =
        estadoTerminal || esCuotaFuturaEnFechaOperativa ? 0 : saldoCuota;
      const cubiertaPorPagoJornada = saldoExigibleEnFechaOperativa <= 0;
      const puedePagar = saldoExigibleEnFechaOperativa > 0;
      const puedeReprogramar =
        !estadoTerminal &&
        !esCuotaFuturaEnFechaOperativa &&
        saldoExigibleEnFechaOperativa > 0;

      const motivoBloqueoPago = pagada || cubiertaPorPagoJornada
        ? 'La cuota objetivo ya está pagada.'
        : anulada
          ? 'La cuota objetivo está anulada.'
          : esCuotaFuturaEnFechaOperativa
            ? 'La cuota encontrada es futura para esta jornada.'
            : null;

      const motivoBloqueoReprogramacion = pagada || cubiertaPorPagoJornada
        ? 'La cuota objetivo ya está pagada.'
        : anulada
          ? 'La cuota objetivo está anulada.'
          : esCuotaFuturaEnFechaOperativa
            ? 'No se recomienda reprogramar una cuota futura desde una jornada pasada.'
            : null;

      return {
        id: cuota.id,
        numeroCuota: cuota.numeroCuota,
        estadoActual: cuota.estado,
        fechaVencimiento: cuota.fechaVencimiento,
        fechaVencimientoProrroga: cuota.fechaVencimientoProrroga || null,
        fechaEfectiva: fechaEfectivaKey,
        montoCuota,
        montoPagado,
        saldoCuota,
        saldoExigibleEnFechaOperativa,
        enMoraEnFechaOperativa: fechaEfectivaKey < fechaKey && !estadoTerminal,
        puedePagar,
        puedeReprogramar,
        esCuotaFuturaEnFechaOperativa,
        esCuotaPagadaHistorica: pagada && fechaEfectivaKey <= fechaKey,
        cubiertaPorPagoJornada,
        motivoBloqueoPago,
        motivoBloqueoReprogramacion,
      };
    };

    const cuotaPagadaPorPrestamo = new Map<string, any>();
    const cuotaPagadaPorCliente = new Map<string, any>();
    pagosOperativos.forEach((p: any) => {
      const cuotaObjetivoPago = buildCuotaObjetivoDesdePago(p);
      if (!cuotaObjetivoPago) return;

      const prestamoId = String(p?.prestamoId || '');
      const clienteId = String(p?.clienteId || '');
      if (prestamoId && !cuotaPagadaPorPrestamo.has(prestamoId)) {
        cuotaPagadaPorPrestamo.set(prestamoId, cuotaObjetivoPago);
      }
      if (clienteId && !cuotaPagadaPorCliente.has(clienteId)) {
        cuotaPagadaPorCliente.set(clienteId, cuotaObjetivoPago);
      }
    });

    const recaudoEfectivo = sumPagosByMetodo(pagosOperativos, 'EFECTIVO');
    const recaudoTransferencia = sumPagosByMetodo(
      pagosOperativos,
      'TRANSFERENCIA',
    );
    const recaudoContableEfectivo = sumPagosByMetodo(
      pagosContables,
      'EFECTIVO',
    );
    const recaudoContableTransferencia = sumPagosByMetodo(
      pagosContables,
      'TRANSFERENCIA',
    );
    const recaudoRegularizadoEfectivo = sumPagosByMetodo(
      pagosRegularizados,
      'EFECTIVO',
    );
    const recaudoRegularizadoTransferencia = sumPagosByMetodo(
      pagosRegularizados,
      'TRANSFERENCIA',
    );

    const totalEsperado = visitasDelDia.reduce((sum, v) => {
      const cid = v.cliente?.id || v.clienteId;
      const registro: any = visitasMap.get(cid);
      const recaudoCliente = Number(pagosPorCliente[cid] || 0);

      // Si está ausente y no pagó nada, descontamos de la meta
      if (registro?.estadoVisita === 'ausente' && recaudoCliente === 0) {
        return sum; // No suma a la meta
      }

      return sum + this.computeMetaOperativaVisita(v, recaudoCliente, fechaKey);
    }, 0);

    // Enriquecer visitas con su recaudo individual del día y su estado de visita (ausente)
    visitasDelDia.forEach((v) => {
      const cid = v.cliente?.id || v.clienteId;
      // @ts-ignore - Prisma type inference issue, properties exist at runtime
      v.recaudadoDelDia = pagosPorCliente[cid] || 0;

      if (Number(v.recaudadoDelDia || 0) > 0) {
        const prestamoId = String(v.prestamoObjetivoId || '');
        const cuotaPagada =
          (prestamoId ? cuotaPagadaPorPrestamo.get(prestamoId) : null) ||
          cuotaPagadaPorCliente.get(String(cid || ''));

        if (cuotaPagada) {
          // @ts-ignore - Prisma type inference issue, properties exist at runtime
          v.cuotaObjetivo = cuotaPagada;
          // @ts-ignore - Prisma type inference issue, properties exist at runtime
          v.cuotaObjetivoId = cuotaPagada.id;
          // @ts-ignore - Prisma type inference issue, properties exist at runtime
          v.cuotaObjetivoPrestamoId = cuotaPagada.id;

          if (Array.isArray(v.prestamos)) {
            v.prestamos = v.prestamos.map((prestamo: any) => {
              if (
                prestamo?.id === prestamoId ||
                cuotaPagadaPorPrestamo.get(String(prestamo?.id || ''))?.id ===
                  cuotaPagada.id
              ) {
                return { ...prestamo, cuotaObjetivo: cuotaPagada };
              }
              return prestamo;
            });
          }
        }
      }

      const registro: any = visitasMap.get(cid);
      if (registro) {
        // @ts-ignore - Prisma type inference issue, properties exist at runtime
        v.estadoVisita = registro.estadoVisita;
        // @ts-ignore - Prisma type inference issue, properties exist at runtime
        v.notasVisita = registro.notas;

        if (String(registro.estadoVisita || '').toLowerCase() === 'reprogramado') {
          const reprogramacion = reprogramacionPorCliente.get(String(cid || ''));
          const cuotaReprogramada =
            this.buildCuotaObjetivoDesdeReprogramacion(reprogramacion);
          if (cuotaReprogramada) {
            // @ts-ignore - Prisma type inference issue, properties exist at runtime
            v.cuotaObjetivo = cuotaReprogramada;
            // @ts-ignore - Prisma type inference issue, properties exist at runtime
            v.cuotaObjetivoId = cuotaReprogramada.id;
            // @ts-ignore - Prisma type inference issue, properties exist at runtime
            v.cuotaObjetivoPrestamoId = cuotaReprogramada.id;
            // @ts-ignore - Prisma type inference issue, properties exist at runtime
            v.prestamoObjetivoId =
              cuotaReprogramada.prestamoId || v.prestamoObjetivoId || null;

            if (Array.isArray(v.prestamos)) {
              v.prestamos = v.prestamos.map((prestamo: any) => {
                if (prestamo?.id === cuotaReprogramada.prestamoId) {
                  return { ...prestamo, cuotaObjetivo: cuotaReprogramada };
                }
                return prestamo;
              });
            }
          }
        }
      }
    });

    // Agregar visitas sintéticas para pagos regularizados cuyo cliente no aparece en visitasDelDia
    const clientesEnVisitas = new Set(
      visitasDelDia.map((v) => v.cliente?.id || v.clienteId),
    );

    const clientesIdsPagoSintetico = [
      ...new Set(
        pagosDeHoy
          .filter(
            (p) =>
              p.clienteId &&
              !clientesEnVisitas.has(p.clienteId) &&
              p.fechaOperativaRuta === fechaKey &&
              p.origenGestion === 'CIERRE_PENDIENTE',
          )
          .map((p) => p.clienteId)
          .filter(Boolean),
      ),
    ];

    if (clientesIdsPagoSintetico.length > 0) {
      const clientesPagoSintetico = await this.prisma.cliente.findMany({
        where: {
          id: { in: clientesIdsPagoSintetico },
        },
        select: {
          id: true,
          codigo: true,
          dni: true,
          nombres: true,
          apellidos: true,
          telefono: true,
          direccion: true,
          nivelRiesgo: true,
          prestamos: {
            where: {
              eliminadoEn: null,
            },
            select: {
              id: true,
              numeroPrestamo: true,
              monto: true,
              saldoPendiente: true,
              frecuenciaPago: true,
              cantidadCuotas: true,
              estado: true,
            },
          },
        },
      });

      for (const cliente of clientesPagoSintetico) {
        // For synthetic visits, we need to fetch the cuotas as well
        const clienteFull = await this.prisma.cliente.findUnique({
          where: { id: cliente.id },
          include: {
            prestamos: {
              where: {
                eliminadoEn: null,
              },
              include: {
                cuotas: {
                  orderBy: { fechaVencimiento: 'asc' },
                },
              },
            },
          },
        });
        const prestamosConCuotaObjetivo = clienteFull?.prestamos?.map((p) => {
          const cuotaObjetivo = this.computeCuotaObjetivo(p, fechaKey);
          return {
            id: p.id,
            numeroPrestamo: p.numeroPrestamo,
            monto: Number(p.monto),
            saldoPendiente: Number(p.saldoPendiente),
            frecuenciaPago: p.frecuenciaPago,
            cantidadCuotas: p.cantidadCuotas,
            estado: p.estado,
            montoMetaOperativaPendiente:
              this.computePendienteOperativoPrestamo(p, fechaKey),
            proximaCuota: null,
            registroSintetico: true,
            origenGestion: 'CIERRE_PENDIENTE',
            cuotaObjetivo,
          };
        }) || [];
        
        // Find the best prestamo with cuotaObjetivo (prioritize pagable/reprogrammable)
        const prestamoObjetivo = prestamosConCuotaObjetivo.find((p) => {
          return p.cuotaObjetivo?.puedePagar || p.cuotaObjetivo?.puedeReprogramar;
        }) || prestamosConCuotaObjetivo.find(p => p.cuotaObjetivo) || null;
        
        const clienteCuotaObjetivo = prestamoObjetivo?.cuotaObjetivo || null;
        const prestamoObjetivoId = prestamoObjetivo?.id || null;
        const cuotaObjetivoId = clienteCuotaObjetivo?.id || null;
        
        visitasDelDia.push({
          asignacionId: null,
          ordenVisita: 9999,
          cliente: {
            id: cliente.id,
            codigo: cliente.codigo,
            dni: cliente.dni,
            nombres: cliente.nombres,
            apellidos: cliente.apellidos,
            telefono: cliente.telefono,
            direccion: cliente.direccion,
            nivelRiesgo: cliente.nivelRiesgo,
            prestamosActivos: cliente.prestamos.length,
          },
          prestamos: prestamosConCuotaObjetivo,
          cuotaObjetivo: clienteCuotaObjetivo,
          prestamoObjetivoId,
          cuotaObjetivoId,
          // Deprecado: mantener para compatibilidad temporal
          cuotaObjetivoPrestamoId: cuotaObjetivoId,
          registroSintetico: true,
          origenGestion: 'CIERRE_PENDIENTE',
          recaudadoDelDia: pagosPorCliente[cliente.id] || 0,
          estadoVisita: null,
          notasVisita: null,
        });
      }
    }

    // Recalcular meta operativa para incluir visitas sintéticas regularizadas
    const metaSinteticaRegularizada = visitasDelDia
      .filter((v: any) => v.registroSintetico && v.origenGestion === 'CIERRE_PENDIENTE')
      .reduce((sum, v: any) => {
        return sum + this.computeMetaOperativaVisita(
          v,
          Number(v.recaudadoDelDia || 0),
          fechaKey,
        );
      }, 0);

    const totalEsperadoFinal = totalEsperado + metaSinteticaRegularizada;

    // Filtrar saldados sin actividad para no inflar el total de la ruta ni ensuciar la data
    const visitasDelDiaFinales = visitasDelDia.filter((v) => {
      // @ts-ignore - Prisma type inference issue, properties exist at runtime
      const tuvoActividad =
        (v.recaudadoDelDia || 0) > 0 || v.estadoVisita === 'ausente';

      const todosPagados = v.prestamos.every((p) => p.estado === 'PAGADO');
      const saldoTotal = v.prestamos.reduce(
        (sum, p) => sum + Number(p.saldoPendiente || 0),
        0,
      );
      const isSaldado = todosPagados && saldoTotal <= 0;

      return !(isSaldado && !tuvoActividad);
    });

    const recaudoFinal = recaudoOperativo;

    // Buscar gastos de la ruta en ese día
    const gastosRuta = await this.prisma.gasto.aggregate({
      where: {
        caja: { rutaId },
        fechaGasto: { gte: fInicio, lte: fFin },
      },
      _sum: { monto: true },
    });

    const gastosFinal = Number(gastosRuta._sum.monto || 0);
    const netoEfectivoRuta = Math.max(0, recaudoEfectivo - gastosFinal);

    const efectividad =
      totalEsperadoFinal > 0
        ? Number(((recaudoFinal / totalEsperadoFinal) * 100).toFixed(1))
        : recaudoFinal > 0
          ? 100
          : 0;

    const gestionadosPagos = Object.keys(pagosPorCliente).length;
    // Añadimos a los gestionados aquellos que tienen registro de visita PERO no tienen pago hoy
    const gestionadosAusentes = registrosVisitas.filter(
      (r) =>
        r.estadoVisita === 'ausente' && !(pagosPorCliente[r.clienteId] > 0),
    ).length;
    const gestionados = gestionadosPagos + gestionadosAusentes;

    return {
      fecha: fechaKey, // Clave de fecha Bogotá YYYY-MM-DD
      rutaId,
      totalVisitas: visitasDelDiaFinales.length,
      resumen: {
        recaudo: recaudoOperativo,
        recaudoOperativo,
        recaudoContable,
        recaudoRegularizado,
        recaudoEfectivo,
        recaudoTransferencia,
        recaudoContableEfectivo,
        recaudoContableTransferencia,
        recaudoRegularizadoEfectivo,
        recaudoRegularizadoTransferencia,
        jornadaId: jornada?.id || null,
        jornadaEstado: jornada?.estado || null,
        jornadaCerradaEn: jornada?.cerradaEn || null,
        jornadaRegularizadaEn: jornada?.regularizadaEn || null,
        meta: totalEsperadoFinal,
        gastos: gastosFinal,
        netoEfectivoRuta,
        efectividad,
        visitados: gestionados,
        total: visitasDelDiaFinales.length,
      },
      visitas: visitasDelDiaFinales,
    };
  }

  private getCuotaFechaEfectivaKey(cuota: any) {
    const raw = 
      String(cuota?.estado || '').toUpperCase() === 'PRORROGADA' && 
      cuota?.fechaVencimientoProrroga 
        ? cuota.fechaVencimientoProrroga 
        : cuota?.fechaVencimiento;

    if (!raw) return '9999-12-31';

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '9999-12-31';

    return getBogotaDayKey(date);
  }

  private computeMetaOperativaVisita(
    visita: any,
    recaudoCliente = 0,
    fechaKey?: string,
  ): number {
    const pendienteExigible = (visita?.prestamos || []).reduce(
      (sum: number, prestamo: any) => {
        if (prestamo?.montoMetaOperativaPendiente != null) {
          return sum + Number(prestamo.montoMetaOperativaPendiente || 0);
        }

        const cuotas = Array.isArray(prestamo?.cuotas) ? prestamo.cuotas : [];
        if (fechaKey && cuotas.length > 0) {
          return sum + this.computePendienteOperativoPrestamo(prestamo, fechaKey);
        }

        const objetivo = prestamo?.cuotaObjetivo;
        if (objetivo) {
          return sum + Number(objetivo.saldoExigibleEnFechaOperativa || 0);
        }
        return sum + Number(prestamo?.proximaCuota?.montoNominal || 0);
      },
      0,
    );

    const recaudo = Number(recaudoCliente || visita?.recaudadoDelDia || 0);
    return pendienteExigible + recaudo;
  }

  private computePendienteOperativoPrestamo(
    prestamo: any,
    fechaKey: string,
  ): number {
    const cuotas = Array.isArray(prestamo?.cuotas) ? prestamo.cuotas : [];
    if (cuotas.length === 0) return 0;

    const cuotasOrdenadas = [...cuotas].sort((a, b) => {
      const ak = this.getCuotaFechaEfectivaKey(a);
      const bk = this.getCuotaFechaEfectivaKey(b);
      return ak.localeCompare(bk);
    });
    const cuotasVencidasNoPagadas = cuotasOrdenadas.filter((cuota) => {
      const estado = String(cuota?.estado || '').toUpperCase();
      if (['PAGADA', 'PAGADO', 'ANULADA', 'ANULADO'].includes(estado)) {
        return false;
      }
      return this.getCuotaFechaEfectivaKey(cuota) <= fechaKey;
    });
    const frecuencia = String(prestamo?.frecuenciaPago || '').toUpperCase();
    const cuotasObjetivo =
      frecuencia === 'DIARIO' || frecuencia === 'DIA'
        ? cuotasVencidasNoPagadas
        : cuotasVencidasNoPagadas.slice(0, 1);

    return cuotasObjetivo.reduce((sum: number, cuota: any) => {
      const monto = Number(cuota?.monto || 0);
      const pagado = Number(cuota?.montoPagado || 0);
      return sum + Math.max(0, monto - pagado);
    }, 0);
  }

  private computeCuotaObjetivo(prestamo: any, fechaKey: string) {
    if (!prestamo.cuotas || prestamo.cuotas.length === 0) return null;

    const sortedCuotas = [...prestamo.cuotas].sort((a, b) => {
      const ak = this.getCuotaFechaEfectivaKey(a);
      const bk = this.getCuotaFechaEfectivaKey(b);
      return ak.localeCompare(bk);
    });

    const cuotasHastaFecha = sortedCuotas.filter((cuota) => {
      return this.getCuotaFechaEfectivaKey(cuota) <= fechaKey;
    });

    const cuotaNoPagadaVencida = cuotasHastaFecha.find((cuota) => {
      return !['PAGADA', 'PAGADO', 'ANULADA', 'ANULADO'].includes(
        String(cuota.estado || '').toUpperCase(),
      );
    });

    const cuotaPagadaHistorica = 
      cuotasHastaFecha.length > 0 
        ? cuotasHastaFecha[cuotasHastaFecha.length - 1] 
        : null;

    const cuotaFutura = sortedCuotas.find((cuota) => {
      return this.getCuotaFechaEfectivaKey(cuota) > fechaKey;
    });

    const cuotaObjetivo = 
      cuotaNoPagadaVencida || cuotaPagadaHistorica || cuotaFutura || null;

    if (!cuotaObjetivo) return null;

    const estado = String(cuotaObjetivo.estado || '').toUpperCase();
    const estadoTerminal = ['PAGADA', 'PAGADO', 'ANULADA', 'ANULADO'].includes(estado);
    const pagada = ['PAGADA', 'PAGADO'].includes(estado);
    const anulada = ['ANULADA', 'ANULADO'].includes(estado);

    const fechaEfectivaKey = this.getCuotaFechaEfectivaKey(cuotaObjetivo);
    const esCuotaFuturaEnFechaOperativa = fechaEfectivaKey > fechaKey;
    const esCuotaPagadaHistorica = pagada && fechaEfectivaKey <= fechaKey;

    const montoCuota = Number(cuotaObjetivo.monto || 0);
    const montoPagado = Number(cuotaObjetivo.montoPagado || 0);

    const saldoCuota = estadoTerminal ? 0 : Math.max(0, montoCuota - montoPagado);

    const saldoExigibleEnFechaOperativa =
      estadoTerminal || esCuotaFuturaEnFechaOperativa ? 0 : saldoCuota;

    const puedePagar = saldoExigibleEnFechaOperativa > 0;
    const puedeReprogramar = !estadoTerminal && !esCuotaFuturaEnFechaOperativa;

    const motivoBloqueoPago = pagada
      ? 'La cuota objetivo ya está pagada.'
      : anulada
        ? 'La cuota objetivo está anulada.'
        : esCuotaFuturaEnFechaOperativa
          ? 'La cuota encontrada es futura para esta jornada.'
          : saldoCuota <= 0
            ? 'La cuota no tiene saldo pendiente.'
            : null;

    const motivoBloqueoReprogramacion = pagada
      ? 'La cuota objetivo ya está pagada.'
      : anulada
        ? 'La cuota objetivo está anulada.'
        : esCuotaFuturaEnFechaOperativa
          ? 'No se recomienda reprogramar una cuota futura desde una jornada pasada.'
          : null;

    return {
      id: cuotaObjetivo.id,
      numeroCuota: cuotaObjetivo.numeroCuota,
      estadoActual: cuotaObjetivo.estado,
      fechaVencimiento: cuotaObjetivo.fechaVencimiento,
      fechaVencimientoProrroga: cuotaObjetivo.fechaVencimientoProrroga || null,
      fechaEfectiva: fechaEfectivaKey,
      montoCuota,
      montoPagado,
      saldoCuota,
      saldoExigibleEnFechaOperativa,
      enMoraEnFechaOperativa: fechaEfectivaKey < fechaKey && !estadoTerminal,
      puedePagar,
      puedeReprogramar,
      esCuotaFuturaEnFechaOperativa,
      esCuotaPagadaHistorica,
      motivoBloqueoPago,
      motivoBloqueoReprogramacion,
    };
  }

  private buildCuotaObjetivoDesdeReprogramacion(aprobacion: any) {
    const datos = (aprobacion?.datosSolicitud || {}) as any;
    const cuotaId = String(datos?.cuotaId || aprobacion?.referenciaId || '');
    if (!cuotaId) return null;

    const fechaOriginal =
      datos?.fechaVencimientoOriginal || datos?.fechaVencimiento || null;
    const fechaOriginalKey = fechaOriginal
      ? getBogotaDayKey(new Date(fechaOriginal))
      : null;
    const nuevaFecha = datos?.nuevaFecha || null;

    return {
      id: cuotaId,
      prestamoId: datos?.prestamoId || null,
      numeroCuota: Number(datos?.numeroCuota || 0) || null,
      estadoActual: 'REPROGRAMADA',
      fechaVencimiento: fechaOriginal,
      fechaVencimientoProrroga: nuevaFecha,
      fechaEfectiva: fechaOriginalKey,
      nuevaFechaReprogramada: nuevaFecha,
      montoCuota: Number(datos?.montoCuota || 0),
      montoPagado: 0,
      saldoCuota: Number(datos?.montoCuota || 0),
      saldoExigibleEnFechaOperativa: 0,
      enMoraEnFechaOperativa: false,
      puedePagar: false,
      puedeReprogramar: false,
      esCuotaFuturaEnFechaOperativa: false,
      esCuotaPagadaHistorica: false,
      esCuotaReprogramadaJornada: true,
      aprobacionReprogramacionId: aprobacion?.id || null,
      estadoReprogramacion: aprobacion?.estado || null,
      motivoBloqueoPago:
        'La cuota fue reprogramada desde esta jornada pendiente.',
      motivoBloqueoReprogramacion:
        'La cuota ya tiene una reprogramación registrada para esta jornada.',
    };
  }

  /**

   * Actualizar orden de clientes en una ruta (para drag & drop)

   */

  async updateClientOrder(
    rutaId: string,

    reorderData: Array<{ clienteId: string; orden: number }>,

    actor?: RouteActor,
  ) {
    try {
      await this.assertCollectorOwnRoute(rutaId, actor);

      // Verificar que la ruta existe

      const ruta = await this.prisma.ruta.findUnique({
        where: { id: rutaId },
      });

      if (!ruta) {
        throw new NotFoundException('Ruta no encontrada');
      }

      // Actualizar el orden de cada cliente

      const updates = reorderData.map((item) =>
        this.prisma.asignacionRuta.updateMany({
          where: {
            rutaId,

            clienteId: item.clienteId,

            activa: true,
          },

          data: {
            ordenVisita: item.orden,
          },
        }),
      );

      await this.prisma.$transaction(updates);

      return {
        message: 'Orden actualizado correctamente',

        totalActualizados: reorderData.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error al actualizar el orden de clientes',
      );
    }
  }

  /**

   * Exportar ruta completa como Excel (.xlsx) o PDF

   * Incluye: datos del cobrador, todos los clientes con sus préstamos activos,

   * semáforo de mora, cuota próxima, saldo y columna "Cobrado" vacía para campo.

   */

  async exportarRuta(
    rutaId: string,
    formato: 'excel' | 'pdf',
    actor?: RouteActor,
  ): Promise<Buffer> {
    await this.assertCollectorOwnRoute(rutaId, actor);

    // ── 1. Consultar ruta con todos los datos necesarios ──────────────────────

    const ruta = await this.prisma.ruta.findFirst({
      where: { id: rutaId, eliminadoEn: null },

      include: {
        cobrador: {
          select: { nombres: true, apellidos: true, telefono: true },
        },

        supervisor: { select: { nombres: true, apellidos: true } },

        asignaciones: {
          where: { activa: true },

          orderBy: { ordenVisita: 'asc' },

          include: {
            cliente: {
              select: {
                nombres: true,

                apellidos: true,

                dni: true,

                telefono: true,

                direccion: true,

                prestamos: {
                  where: {
                    estado: { in: ['ACTIVO', 'EN_MORA'] },
                    eliminadoEn: null,
                  },

                  orderBy: { creadoEn: 'asc' },

                  select: {
                    id: true,

                    numeroPrestamo: true,

                    monto: true,

                    saldoPendiente: true,

                    estado: true,

                    frecuenciaPago: true,

                    cuotas: {
                      where: {
                        estado: {
                          in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'],
                        },
                      },

                      orderBy: { numeroCuota: 'asc' },

                      take: 1,

                      select: {
                        monto: true,
                        fechaVencimiento: true,
                        estado: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!ruta) throw new NotFoundException('Ruta no encontrada');

    // ── 2. Aplanar los datos por fila (una fila por préstamo activo) ───────────

    interface FilaRuta {
      nro: number;

      cliente: string;

      cc: string;

      telefono: string;

      direccion: string;

      numeroPrestamo: string;

      cuota: number;

      fechaCuota: string;

      saldo: number;

      estadoPrestamo: string;

      diasMora: number;

      semaforo: 'VERDE' | 'AMARILLO' | 'ROJO';

      estadoVisita?: string | null;

      notasVisita?: string | null;
    }

    const { startDate: hoy } = getBogotaStartEndOfDay(new Date());

    const fechaKey = getBogotaDayKey(hoy);

    type VisitaRuta = {
      clienteId: string;
      fechaVisita: string;
      estadoVisita: string;
      notas: string | null;
    };

    const registrosVisitas = await this.prisma.registroVisita.findMany({
      where: {
        rutaId,
        fechaVisita: fechaKey,
      },
      select: {
        clienteId: true,
        fechaVisita: true,
        estadoVisita: true,
        notas: true,
      },
    });

    const visitasMap = new Map<string, VisitaRuta>(
      registrosVisitas.map((r: VisitaRuta) => [r.clienteId, r]),
    );

    const filas: FilaRuta[] = [];

    let nro = 1;

    for (const asig of ruta.asignaciones) {
      const c = asig.cliente;

      const gestionRuta = visitasMap.get(c.id);

      const prestamosActivos = c.prestamos;

      if (prestamosActivos.length === 0) {
        // Cliente sin préstamo activo — incluir igualmente con datos vacios

        filas.push({
          nro: nro++,

          cliente: `${c.nombres} ${c.apellidos}`,

          cc: c.dni,

          telefono: c.telefono || '—',

          direccion: c.direccion || '—',

          numeroPrestamo: '—',

          cuota: 0,

          fechaCuota: '—',

          saldo: 0,

          estadoPrestamo: 'SIN_PRESTAMO',

          diasMora: 0,

          semaforo: 'VERDE',

          estadoVisita: gestionRuta?.estadoVisita || null,

          notasVisita: gestionRuta?.notas || null,
        });

        continue;
      }

      for (const p of prestamosActivos) {
        const proxCuota = p.cuotas[0];

        let diasMora = 0;

        if (proxCuota) {
          const { startDate: fechaVenc } = getBogotaStartEndOfDay(
            new Date(proxCuota.fechaVencimiento),
          );

          if (fechaVenc < hoy) {
            diasMora = Math.floor(
              (hoy.getTime() - fechaVenc.getTime()) / 86400000,
            );
          }
        }

        let semaforo: 'VERDE' | 'AMARILLO' | 'ROJO' = 'VERDE';

        if (diasMora > 7 || p.estado === 'EN_MORA') semaforo = 'ROJO';
        else if (diasMora > 0) semaforo = 'AMARILLO';

        filas.push({
          nro: nro++,

          cliente: `${c.nombres} ${c.apellidos}`,

          cc: c.dni,

          telefono: c.telefono || '—',

          direccion: c.direccion || '—',

          numeroPrestamo: p.numeroPrestamo,

          cuota: proxCuota ? Number(proxCuota.monto) : 0,

          fechaCuota: proxCuota
            ? new Date(proxCuota.fechaVencimiento).toLocaleDateString('es-CO')
            : '—',

          saldo: Number(p.saldoPendiente),

          estadoPrestamo: p.estado,

          diasMora,

          semaforo,

          estadoVisita: gestionRuta?.estadoVisita || null,

          notasVisita: gestionRuta?.notas || null,
        });
      }
    }

    const fechaExport = new Date().toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const cobradorNombre = `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`;

    const totalSaldo = filas.reduce((s, f) => s + f.saldo, 0);

    const totalCuota = filas.reduce((s, f) => s + f.cuota, 0);

    const enMora = filas.filter((f) => f.semaforo === 'ROJO').length;

    const fechaArchivo = getBogotaDayKey(new Date());

    const meta: RutaCobradorMeta = {
      rutaNombre: ruta.nombre,

      rutaCodigo: ruta.codigo,

      cobradorNombre,

      fechaExport,

      totalClientes: ruta.asignaciones.length,

      enMora,

      totalCuota,

      totalSaldo,
    };

    const filasTpl: RutaCobradorRow[] = filas.map((f) => ({
      nro: f.nro,

      cliente: f.cliente,

      cc: f.cc,

      telefono: f.telefono,

      direccion: f.direccion,

      numeroPrestamo: f.numeroPrestamo,

      cuota: f.cuota,

      fechaCuota: f.fechaCuota,

      saldo: f.saldo,

      estadoPrestamo: f.estadoPrestamo,

      diasMora: f.diasMora,

      semaforo: f.semaforo,

      estadoVisita: f.estadoVisita,

      notasVisita: f.notasVisita,
    }));

    if (formato === 'excel') {
      const out = await generarExcelRutaCobrador(filasTpl, meta, fechaArchivo);

      return out.data;
    }

    const out = await generarPDFRutaCobrador(filasTpl, meta, fechaArchivo);

    return out.data;
  }

  /**
   * Historial operativo de visitas de un cliente.
   * Los cobradores solo pueden consultar registros de sus propias rutas.
   */
  async getHistorialVisitasCliente(
    clienteId: string,
    actor?: RouteActor,
    estadoVisita?: string,
    limit?: string,
  ) {
    const takeRaw = Number.parseInt(String(limit || '20'), 10);
    const take = Math.min(Math.max(Number.isFinite(takeRaw) ? takeRaw : 20, 1), 50);

    const where: Prisma.RegistroVisitaWhereInput = {
      clienteId,
    };

    const estado = String(estadoVisita || '').trim();
    if (estado) {
      where.estadoVisita = estado;
    }

    if (this.isCollector(actor)) {
      if (!actor?.id) {
        throw new ForbiddenException('No tienes permiso para consultar este historial.');
      }
      where.cobradorId = actor.id;
    }

    const registros = await this.prisma.registroVisita.findMany({
      where,
      orderBy: [{ fechaVisita: 'desc' }, { creadoEn: 'desc' }],
      take,
      select: {
        id: true,
        rutaId: true,
        clienteId: true,
        prestamoId: true,
        cobradorId: true,
        fechaVisita: true,
        estadoVisita: true,
        notas: true,
        creadoEn: true,
        ruta: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
          },
        },
        cobrador: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    return registros.map((registro) => ({
      id: registro.id,
      rutaId: registro.rutaId,
      clienteId: registro.clienteId,
      prestamoId: registro.prestamoId,
      cobradorId: registro.cobradorId,
      fechaVisita: registro.fechaVisita,
      estadoVisita: registro.estadoVisita,
      notas: registro.notas,
      creadoEn: registro.creadoEn,
      ruta: registro.ruta,
      cobrador: registro.cobrador
        ? {
            id: registro.cobrador.id,
            nombre: `${registro.cobrador.nombres || ''} ${registro.cobrador.apellidos || ''}`.trim(),
          }
        : null,
    }));
  }

  /**
   * Registra una visita en la ruta para el día (ej: cliente ausente)
   */
  async registrarVisita(
    rutaId: string,
    clienteId: string,
    estadoVisita: string,
    notas: string,
    actor?: RouteActor,
    fechaOperativa?: string,
    origenGestion?: string,
  ) {
    await this.assertCollectorOwnRoute(rutaId, actor);

    const fechaKey = this.parseFechaOperativaBogotaKey(fechaOperativa);

    const ruta = await this.prisma.ruta.findFirst({
      where: { id: rutaId, eliminadoEn: null },
      select: { id: true, cobradorId: true },
    });

    if (!ruta) {
      throw new NotFoundException('Ruta no encontrada');
    }

    const notasFinales = origenGestion
      ? `[${origenGestion}] Regularizado por ${actor?.id || 'N/A'} - ${notas || ''}`.trim()
      : notas;

    const resultado = await this.prisma.registroVisita.upsert({
      where: {
        rutaId_clienteId_fechaVisita: {
          rutaId,
          clienteId,
          fechaVisita: fechaKey,
        },
      },
      create: {
        rutaId,
        clienteId,
        cobradorId: ruta.cobradorId,
        fechaVisita: fechaKey,
        estadoVisita,
        notas: notasFinales,
      },
      update: {
        estadoVisita,
        notas: notasFinales,
      },
    });

    // Emitir evento para sincronización en tiempo real
    this.notificacionesGateway.broadcastRutasActualizadas({
      accion: 'VISITA_REGISTRADA',
      rutaId,
      clienteId,
      estadoVisita,
      notasVisita: resultado.notas,
      fechaVisita: resultado.fechaVisita,
    });

    return resultado;
  }

  /**
   * Cierra una jornada regularizada (cierre pendiente)
   *
   * Este método permite cerrar una jornada vieja que estaba pendiente de cierre,
   * actualizando el estado de la entidad RutaJornada a REGULARIZADA.
   */
  private assertPuedeRegularizarJornada(actor?: RouteActor) {
    const rol = String(actor?.rol || '').toUpperCase();

    const puedeRegularizar = [
      'ADMIN',
      'SUPER_ADMIN',
      'SUPER_ADMINISTRADOR',
      'COORDINADOR',
    ].includes(rol);

    if (!actor?.id || !puedeRegularizar) {
      throw new ForbiddenException(
        'No tienes permiso para cerrar jornadas regularizadas.',
      );
    }
  }

  async cerrarJornadaRegularizada(
    rutaId: string,
    fechaOperativa: string,
    observaciones?: string,
    actor?: RouteActor,
  ) {
    this.assertPuedeRegularizarJornada(actor);

    // Validar que la ruta exista
    const ruta = await this.prisma.ruta.findFirst({
      where: { id: rutaId, eliminadoEn: null },
      select: { id: true, nombre: true },
    });

    if (!ruta) {
      throw new NotFoundException('Ruta no encontrada');
    }

    // Validar que la fechaOperativa esté en formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaOperativa)) {
      throw new BadRequestException(
        'fechaOperativa debe estar en formato YYYY-MM-DD',
      );
    }

    const cierrePendienteDetectado = (
      await this.getCierresPendientesRuta(rutaId, actor?.id)
    ).find((cierre) => cierre.fechaOperativa === fechaOperativa);

    // Validar que tenga observaciones si hay clientes pendientes, ausentes o descuadre
    const detalleDia = await this.getDailyVisits(
      rutaId,
      fechaOperativa,
      actor,
    );

    const visitas = Array.isArray(detalleDia.visitas) ? detalleDia.visitas : [];

    const clientesPendientes = visitas.filter((v: any) => {
      return this.resolveEstadoGestionCierrePendiente(v) === 'PENDIENTE';
    });

    const clientesAusentes = visitas.filter((v: any) => {
      return this.resolveEstadoGestionCierrePendiente(v) === 'AUSENTE';
    });

    const clientesPagaron = visitas.filter((v: any) => {
      return this.resolveEstadoGestionCierrePendiente(v) === 'PAGO_REGISTRADO';
    });

    const clientesGestionados = visitas.filter((v: any) => {
      return this.resolveEstadoGestionCierrePendiente(v) !== 'PENDIENTE';
    });

    const meta = Number(detalleDia.resumen?.meta || 0);

    const recaudoOperativo = Number(
      (detalleDia.resumen as any)?.recaudoOperativo ||
        detalleDia.resumen?.recaudo ||
        0,
    );

    const cierreAdministrativo =
      clientesPendientes.length > 0 ||
      clientesAusentes.length > 0 ||
      recaudoOperativo < meta;

    const observacionesLimpias = observaciones?.trim();

    if (cierreAdministrativo && !observacionesLimpias) {
      throw new BadRequestException(
        'La jornada presenta pendientes, ausencias o descuadre de recaudo. Debe proporcionar una observación administrativa para cerrarla.',
      );
    }

    // Envolver en transacción
    const resultado = await this.prisma.$transaction(async (tx) => {
      // Validar que la jornada exista y esté pendiente de cierre
      const jornadaActual = await tx.rutaJornada.findUnique({
        where: {
          rutaId_fechaOperativa: {
            rutaId,
            fechaOperativa,
          },
        },
      });

      const jornadaRegularizable =
        jornadaActual ||
        (cierrePendienteDetectado?.cajaId
          ? await tx.rutaJornada.create({
              data: {
                rutaId,
                cajaId: cierrePendienteDetectado.cajaId,
                fechaOperativa,
                estado: 'PENDIENTE_CIERRE',
                activacionTransaccionId:
                  cierrePendienteDetectado.activacionId || null,
                activadaEn: cierrePendienteDetectado.fechaActivacion
                  ? new Date(cierrePendienteDetectado.fechaActivacion)
                  : new Date(`${fechaOperativa}T12:00:00-05:00`),
              },
            })
          : null);

      if (!jornadaRegularizable) {
        throw new NotFoundException('La jornada no existe');
      }

      if (jornadaRegularizable.estado !== 'PENDIENTE_CIERRE') {
        throw new ConflictException(
          'La jornada ya fue cerrada o regularizada.',
        );
      }

      // Actualizar el estado de la jornada a REGULARIZADA sin transacción financiera
      const updated = await tx.rutaJornada.updateMany({
        where: {
          id: jornadaRegularizable.id,
          estado: 'PENDIENTE_CIERRE',
        },
        data: {
          estado: 'REGULARIZADA',
          cierreTransaccionId: null,
          cerradaEn: new Date(),
          regularizadaEn: new Date(),
          regularizadaPorId: actor?.id,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'La jornada ya fue regularizada por otro usuario.',
        );
      }

      return {
        jornadaId: jornadaRegularizable.id,
      };
    });

    // Emitir evento para sincronización en tiempo real
    this.notificacionesGateway.broadcastRutasActualizadas({
      accion: 'JORNADA_CERRADA_REGULARIZADA',
      rutaId,
      fechaOperativa,
      jornadaId: resultado.jornadaId,
      observaciones: observacionesLimpias,
    });
    this.notificacionesGateway.broadcastJornadasActualizadas({
      accion: 'JORNADA_CERRADA_REGULARIZADA',
      rutaId,
      fechaOperativa,
      jornadaId: resultado.jornadaId,
    });

    // Calcular advertencias
    const advertencias: string[] = [];
    const cierrePendiente = await this.getCierrePendienteRuta(rutaId);

    const getNombreClienteVisita = (v: any) => 
      ( 
        v.nombreCliente || 
        `${v.cliente?.nombres || ''} ${v.cliente?.apellidos || ''}`.trim() 
      ) || 'Cliente sin nombre';

    visitas.forEach((cliente: any) => {
      const estadoGestion = this.resolveEstadoGestionCierrePendiente(cliente);
      const tienePagoReal = Number(cliente.recaudadoDelDia || 0) > 0;

      if (
        estadoGestion === 'PAGO_REGISTRADO' &&
        !tienePagoReal
      ) {
        advertencias.push(
          `Visita pagada sin pago financiero asociado: ${getNombreClienteVisita(cliente)}`,
        );
      }
    });

    // Construir mensaje detallado
    const partes: string[] = [];

    if (clientesPendientes.length > 0) {
      partes.push(
        `${clientesPendientes.length} cliente(s) sin gestión`,
      );
    }

    if (clientesAusentes.length > 0) {
      partes.push(
        `${clientesAusentes.length} ausencia(s)`,
      );
    }

    if (recaudoOperativo < meta) {
      partes.push('descuadre de recaudo');
    }

    const resumenCierre =
      partes.length > 0
        ? partes.join(', ')
        : 'sin inconsistencias operativas';

    const tipoCierre = cierreAdministrativo
      ? 'ADMINISTRATIVO_CON_OBSERVACION'
      : 'REGULARIZACION_LIMPIA';

    // Obtener nombre del usuario desde la DB para cerradaPorNombre
    let cerradaPorNombre = 'Usuario del sistema';
    if (actor?.id) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: actor.id },
        select: { nombres: true, apellidos: true, correo: true }
      });
      if (usuario) {
        cerradaPorNombre = 
          `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim() || 
          usuario.correo || 
          'Usuario del sistema';
      }
    }

    const totalClientes = visitas.length;
    const recaudoContable = Number(detalleDia.resumen?.recaudoContable || 0);
    const recaudoRegularizado = Number(detalleDia.resumen?.recaudoRegularizado || 0);
    const recaudoEfectivo = Number(detalleDia.resumen?.recaudoEfectivo || 0);
    const recaudoTransferencia = Number(
      detalleDia.resumen?.recaudoTransferencia || 0,
    );
    const recaudoContableEfectivo = Number(
      detalleDia.resumen?.recaudoContableEfectivo || 0,
    );
    const recaudoContableTransferencia = Number(
      detalleDia.resumen?.recaudoContableTransferencia || 0,
    );
    const recaudoRegularizadoEfectivo = Number(
      detalleDia.resumen?.recaudoRegularizadoEfectivo || 0,
    );
    const recaudoRegularizadoTransferencia = Number(
      detalleDia.resumen?.recaudoRegularizadoTransferencia || 0,
    );
    const gastosRuta = Number(detalleDia.resumen?.gastos || 0);
    const netoEfectivoRuta = Number(
      detalleDia.resumen?.netoEfectivoRuta ??
        Math.max(0, recaudoEfectivo - gastosRuta),
    );
    const cumplimiento =
      meta > 0
        ? Math.round(((recaudoOperativo / meta) * 100) * 10) / 10
        : 0;
    const resumirClienteGestionado = (visita: any) => {
      const cliente = visita?.cliente || {};
      const nombreCliente =
        getNombreClienteVisita(visita) ||
        [cliente.nombres, cliente.apellidos].filter(Boolean).join(' ') ||
        'Cliente sin nombre';

      return {
        clienteId: cliente.id || visita?.clienteId || null,
        nombreCliente,
        documento: cliente.cedula || cliente.dni || visita?.cedula || null,
        estadoGestion: this.resolveEstadoGestionCierrePendiente(visita),
        ordenVisita: visita?.ordenVisita ?? null,
        cuotaObjetivoId: visita?.cuotaObjetivoId ?? null,
        prestamoObjetivoId:
          visita?.prestamoObjetivoId ||
          visita?.cuotaObjetivoPrestamoId ||
          null,
        recaudado: Number(visita?.recaudadoDelDia || 0),
      };
    };

    const clientesGestionadosDetalle = clientesGestionados.map(
      resumirClienteGestionado,
    );
    const clientesPagaronDetalle = clientesPagaron.map(
      resumirClienteGestionado,
    );

    await this.notificacionesService.notifyRolesDeduped?.({
      roles: [
        RolUsuario.SUPER_ADMINISTRADOR,
        RolUsuario.ADMIN,
        RolUsuario.COORDINADOR,
        RolUsuario.SUPERVISOR,
      ],
      titulo: cierreAdministrativo
        ? 'Jornada cerrada con observación administrativa'
        : 'Jornada pendiente regularizada',
      mensaje: cierreAdministrativo
        ? `${ruta.nombre} · ${fechaOperativa}. Se cerró con observación administrativa por ${resumenCierre}.`
        : `${ruta.nombre} · ${fechaOperativa}. La jornada fue cerrada como regularizada.`,
      tipo: cierreAdministrativo ? 'WARNING' : 'INFO',
      entidad: 'RutaJornada',
      entidadId: resultado.jornadaId,
      dedupeKey: [
        'CIERRE_PENDIENTE',
        rutaId,
        fechaOperativa,
        'REGULARIZADA',
      ].join(':'),
      metadata: {
        tipoEvento: 'JORNADA_PENDIENTE_CERRADA',
        tipoCierre,
        rutaId,
        rutaNombre: ruta.nombre,
        fechaOperativa,
        fechaActivacion: cierrePendiente?.fechaActivacion ?? null,
        estadoAnterior: 'PENDIENTE_CIERRE',
        estadoNuevo: 'REGULARIZADA',
        cerradaPorId: actor?.id ?? null,
        cerradaPorNombre,
        observaciones: observacionesLimpias,
        totalClientes,
        clientesGestionados: clientesGestionados.length,
        clientesPagaron: clientesPagaron.length,
        clientesGestionadosDetalle,
        clientesPagaronDetalle,
        clientesAusentes: clientesAusentes.length,
        clientesPendientes: clientesPendientes.length,
        meta,
        recaudoOperativo,
        recaudoContable,
        recaudoRegularizado,
        recaudoEfectivo,
        recaudoTransferencia,
        recaudoContableEfectivo,
        recaudoContableTransferencia,
        recaudoRegularizadoEfectivo,
        recaudoRegularizadoTransferencia,
        gastosRuta,
        netoEfectivoRuta,
        cumplimiento,
        requiereRevision: cierreAdministrativo,
        advertencias,
      },
    });

    return {
      success: true,
      message: `Jornada ${fechaOperativa} cerrada exitosamente`,
      jornadaId: resultado.jornadaId,
      fechaOperativa,
      rutaId,
    };
  }

  /**
   * Detecta si una ruta tiene una jornada anterior pendiente de cierre
   *
   * Una ruta tiene cierre pendiente si:
   * - Existe una ACTIVACION_RUTA anterior a hoy
   * - No existe un CIERRE_RUTA posterior a esa activación
   */
  async getCierrePendienteRutaPublic(rutaId: string, actor?: RouteActor) {
    await this.assertCollectorOwnRoute(rutaId, actor);
    return this.getCierrePendienteRuta(rutaId, actor?.id);
  }

  /**
   * Valida si el actor puede cerrar la jornada actual
   *
   * Lanza excepción si hay cierre pendiente anterior y el actor no puede regularizar
   */
  async assertPuedeCerrarJornadaActual(rutaId: string, actor?: RouteActor) {
    const cierrePendiente = await this.getCierrePendienteRuta(rutaId);

    if (!cierrePendiente?.pendienteCierre) return;

    const rol = String(actor?.rol || '').toUpperCase();
    const puedeRegularizar = [
      'ADMIN',
      'SUPER_ADMIN',
      'SUPER_ADMINISTRADOR',
      'COORDINADOR',
    ].includes(rol);

    if (!puedeRegularizar) {
      throw new ConflictException({
        code: 'RUTA_ANTERIOR_PENDIENTE_CIERRE',
        message:
          'Existe una jornada anterior pendiente de cierre. Debe regularizarse antes de cerrar la jornada actual.',
        cierrePendiente,
      });
    }
  }

  private async actualizarDeudasJornadaPendiente(
    rutaId: string,
    jornada: any,
    cajaRuta: any,
    creadoPorId?: string,
    esUltimaJornada: boolean = true,
  ) {
    // Check for existing transactions for this jornada
    const { startDate: fechaOperativaStart, endDate: fechaOperativaEnd } = 
      getBogotaStartEndOfDayFromKey(jornada.fechaOperativa);
    
    const existingCierreRuta = await this.prisma.transaccion.findFirst({
      where: {
        cajaId: cajaRuta.id,
        tipoReferencia: 'CIERRE_RUTA',
        fechaTransaccion: {
          gte: fechaOperativaStart,
          lte: fechaOperativaEnd
        }
      },
    });
    
    const existingDeudaCobrador = await this.prisma.transaccion.findFirst({
      where: {
        cajaId: cajaRuta.id,
        tipoReferencia: 'DEUDA_COBRADOR',
        fechaTransaccion: {
          gte: fechaOperativaStart,
          lte: fechaOperativaEnd
        }
      },
    });

    // Get daily details to calculate meta, recaudo, etc.
    const detalleDia = await this.getDailyVisits(rutaId, jornada.fechaOperativa);
    const resumen = detalleDia?.resumen || ({} as any);
    const visitas = detalleDia?.visitas || [];
    const clientesFaltantes = visitas.filter((v: any) => {
      const estado = String(v.estadoGestion || '').toUpperCase();
      const recaudoVisita = Number(v.recaudadoDelDia || 0);
      return (
        recaudoVisita <= 0 &&
        !estado.includes('PAGO') &&
        !estado.includes('AUSENTE') &&
        !estado.includes('REPROGRAM')
      );
    }).length;

    const recaudo = Number(resumen.recaudoOperativo || resumen.recaudo || 0);
    const meta = Number(resumen.meta || 0);
    const efectividad = meta > 0 ? Math.round((recaudo / meta) * 1000) / 10 : 0;
    const saldoAlCierre = esUltimaJornada ? Number(cajaRuta.saldoActual || 0) : 0;
    const deudaPorFaltantes = 0; // Se elimina la deuda por clientes/metas faltantes
    const deudaTotal = Math.max(deudaPorFaltantes + saldoAlCierre, 0);
    const hayDescuadre = deudaTotal > 0;

    const cobradorNombre =
      jornada.ruta?.cobrador?.nombres && jornada.ruta?.cobrador?.apellidos
        ? `${jornada.ruta.cobrador.nombres} ${jornada.ruta.cobrador.apellidos}`
        : 'Cobrador';

    const referenciaIdCierre = `RC:${recaudo}|MT:${meta}|EF:${efectividad}|CF:${clientesFaltantes}|CO:${cobradorNombre}|SD:${saldoAlCierre}`;

    const userId = creadoPorId || jornada.ruta?.cobradorId || cajaRuta.responsableId;
    if (!userId) {
      throw new Error(
        `No se pudo determinar el usuario creador (creadoPorId) para las transacciones del cierre de jornada ${jornada.fechaOperativa}.`
      );
    }

    let cierreTransaccion = existingCierreRuta;
    if (existingCierreRuta) {
      // Update existing CIERRE_RUTA
      cierreTransaccion = await this.prisma.transaccion.update({
        where: { id: existingCierreRuta.id },
        data: {
          descripcion: hayDescuadre
            ? `Cierre de ruta con descuadre: ${deudaTotal.toLocaleString('es-CO')} pendientes (saldo en caja: ${saldoAlCierre.toLocaleString('es-CO')}, faltantes: ${deudaPorFaltantes.toLocaleString('es-CO')}). Recaudó: ${recaudo.toLocaleString('es-CO')}.`
            : `Cierre de ruta exitoso: sin saldo pendiente. Recaudó ${recaudo.toLocaleString('es-CO')} (${efectividad}% META).`,
          referenciaId: referenciaIdCierre,
        },
      });
    } else {
      // Create new CIERRE_RUTA transaction
      cierreTransaccion = await this.prisma.transaccion.create({
        data: {
          numeroTransaccion: `CR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          cajaId: cajaRuta.id,
          tipo: 'TRANSFERENCIA',
          monto: 0,
          descripcion: hayDescuadre
            ? `Cierre de ruta con descuadre: ${deudaTotal.toLocaleString('es-CO')} pendientes (saldo en caja: ${saldoAlCierre.toLocaleString('es-CO')}, faltantes: ${deudaPorFaltantes.toLocaleString('es-CO')}). Recaudó: ${recaudo.toLocaleString('es-CO')}.`
            : `Cierre de ruta exitoso: sin saldo pendiente. Recaudó ${recaudo.toLocaleString('es-CO')} (${efectividad}% META).`,
          tipoReferencia: 'CIERRE_RUTA',
          referenciaId: referenciaIdCierre,
          creadoPorId: userId,
          fechaTransaccion: fechaOperativaEnd,
        },
      });
    }

    // Update the RutaJornada to have the cierreTransaccionId if needed
    if (!jornada.cierreTransaccionId && cierreTransaccion) {
      await this.prisma.rutaJornada.update({
        where: { id: jornada.id },
        data: { cierreTransaccionId: cierreTransaccion.id },
      });
    }

    // If there's a descuadre, create OR update DEUDA_COBRADOR transaction
    if (hayDescuadre) {
      const referenciaIdDeuda = `DD:${deudaTotal}|SD:${saldoAlCierre}|FD:${deudaPorFaltantes}|${referenciaIdCierre}`;
      
      if (existingDeudaCobrador) {
        // Update existing DEUDA_COBRADOR
        await this.prisma.transaccion.update({
          where: { id: existingDeudaCobrador.id },
          data: {
            monto: deudaTotal,
            descripcion: `Deuda del cobrador por cierre de ruta: ${deudaTotal.toLocaleString('es-CO')} (saldo en caja: ${saldoAlCierre.toLocaleString('es-CO')}, faltantes: ${deudaPorFaltantes.toLocaleString('es-CO')})`,
            referenciaId: referenciaIdDeuda,
          },
        });
      } else {
        // Create new DEUDA_COBRADOR
        await this.prisma.transaccion.create({
          data: {
            numeroTransaccion: `DC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            cajaId: cajaRuta.id,
            tipo: 'EGRESO',
            monto: deudaTotal,
            descripcion: `Deuda del cobrador por cierre de ruta: ${deudaTotal.toLocaleString('es-CO')} (saldo en caja: ${saldoAlCierre.toLocaleString('es-CO')}, faltantes: ${deudaPorFaltantes.toLocaleString('es-CO')})`,
            tipoReferencia: 'DEUDA_COBRADOR',
            referenciaId: referenciaIdDeuda,
            creadoPorId: userId,
            fechaTransaccion: fechaOperativaEnd,
          },
        });
      }
    } else if (existingDeudaCobrador) {
      // If no descuadre but there was a DEUDA_COBRADOR, delete it
      await this.prisma.transaccion.delete({
        where: { id: existingDeudaCobrador.id },
      });
    }
  }

  private async getCierresPendientesRuta(rutaId: string, creadoPorId?: string) {
    const ruta = await this.prisma.ruta.findFirst({
      where: { id: rutaId, eliminadoEn: null },
      include: {
        cobrador: {
          select: { id: true, nombres: true, apellidos: true },
        },
        cajas: {
          where: { tipo: 'RUTA', activa: true },
          select: { id: true, saldoActual: true },
          take: 1,
        },
      },
    });

    const cajaRuta = ruta?.cajas?.[0];
    if (!ruta || !cajaRuta?.id) return [];

    const hoyKey = getBogotaDayKey(new Date());
    const { startDate: inicioHoy } = getBogotaStartEndOfDayFromKey(hoyKey);

    // Mark old ABIERTA jornadas as PENDIENTE_CIERRE
    await this.prisma.rutaJornada.updateMany({
      where: {
        rutaId,
        estado: 'ABIERTA',
        fechaOperativa: { lt: hoyKey },
      },
      data: { estado: 'PENDIENTE_CIERRE' },
    });

    // Get ALL PENDIENTE_CIERRE jornadas
    const jornadasPendientes = await this.prisma.rutaJornada.findMany({
      where: {
        rutaId,
        estado: 'PENDIENTE_CIERRE',
      },
      orderBy: {
        fechaOperativa: 'asc',
      },
    });

    // Update deudas for ALL pending jornadas
    for (let i = 0; i < jornadasPendientes.length; i++) {
      const jornada = jornadasPendientes[i];
      const jornadaWithRuta = {
        ...jornada,
        ruta: ruta,
      };
      const esUltima = i === jornadasPendientes.length - 1;
      await this.actualizarDeudasJornadaPendiente(
        rutaId,
        jornadaWithRuta,
        cajaRuta,
        creadoPorId,
        esUltima,
      );
    }

    const jornadasExistentes = await this.prisma.rutaJornada.findMany({
      where: {
        rutaId,
        fechaOperativa: { lt: hoyKey },
      },
      select: {
        fechaOperativa: true,
      },
    });

    const fechasJornadaExistente = new Set(
      jornadasExistentes.map((jornada) => jornada.fechaOperativa),
    );

    const cierresRuta = await this.prisma.transaccion.findMany({
      where: {
        cajaId: cajaRuta.id,
        tipoReferencia: 'CIERRE_RUTA',
        fechaTransaccion: { lt: inicioHoy },
      },
      select: {
        fechaTransaccion: true,
      },
    });

    const fechasCerradasPorTransaccion = new Set(
      cierresRuta.map((cierre) => getBogotaDayKey(cierre.fechaTransaccion)),
    );

    const activacionesSinJornada = await this.prisma.transaccion.findMany({
      where: {
        cajaId: cajaRuta.id,
        tipoReferencia: 'ACTIVACION_RUTA',
        fechaTransaccion: { lt: inicioHoy },
      },
      orderBy: { fechaTransaccion: 'asc' },
      select: {
        id: true,
        fechaTransaccion: true,
      },
    });

    const pendientesDesdeJornadas = jornadasPendientes.map((jornada) => {
      const fechaOperativa = jornada.fechaOperativa;

      const start = new Date(`${fechaOperativa}T12:00:00-05:00`);
      const end = new Date(`${hoyKey}T12:00:00-05:00`);

      const diasPendiente = Math.max(
        Math.floor((end.getTime() - start.getTime()) / 86_400_000),
        0,
      );

      return {
        rutaId,
        rutaNombre: ruta.nombre,
        cajaId: cajaRuta.id,
        cobradorId: ruta.cobrador?.id || null,
        cobradorNombre: ruta.cobrador
          ? `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`.trim()
          : null,
        activacionId: jornada.activacionTransaccionId,
        fechaOperativa,
        fechaActivacion: formatBogotaOffsetIso(jornada.activadaEn),
        diasPendiente,
        pendienteCierre: true,
        requiereRegularizacion: true,
        message: `La ruta tiene una jornada pendiente de cierre del ${fechaOperativa}.`,
      };
    });

    const pendientesDesdeTransacciones = activacionesSinJornada
      .map((activacion) => {
        const fechaOperativa = getBogotaDayKey(activacion.fechaTransaccion);
        return { activacion, fechaOperativa };
      })
      .filter(({ fechaOperativa }) => {
        if (!fechaOperativa) return false;
        if (fechasJornadaExistente.has(fechaOperativa)) return false;
        return !fechasCerradasPorTransaccion.has(fechaOperativa);
      })
      .map(({ activacion, fechaOperativa }) => {
        const start = new Date(`${fechaOperativa}T12:00:00-05:00`);
        const end = new Date(`${hoyKey}T12:00:00-05:00`);

        const diasPendiente = Math.max(
          Math.floor((end.getTime() - start.getTime()) / 86_400_000),
          0,
        );

        return {
          rutaId,
          rutaNombre: ruta.nombre,
          cajaId: cajaRuta.id,
          cobradorId: ruta.cobrador?.id || null,
          cobradorNombre: ruta.cobrador
            ? `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`.trim()
            : null,
          activacionId: activacion.id,
          fechaOperativa,
          fechaActivacion: formatBogotaOffsetIso(activacion.fechaTransaccion),
          diasPendiente,
          pendienteCierre: true,
          requiereRegularizacion: true,
          origenDeteccion: 'TRANSACCION_ACTIVACION_LEGACY',
          message: `La ruta tiene una jornada pendiente de cierre del ${fechaOperativa}.`,
        };
      });

    return [...pendientesDesdeJornadas, ...pendientesDesdeTransacciones].sort(
      (a, b) => a.fechaOperativa.localeCompare(b.fechaOperativa),
    );
  }

  private async getCierrePendienteRuta(rutaId: string, creadoPorId?: string) {
    const pendientes = await this.getCierresPendientesRuta(rutaId, creadoPorId);
    return pendientes[0] || null;
  }

  private async getCierresPendientesRutasMap(rutaIds: string[], creadoPorId?: string) {
    if (!rutaIds.length) return new Map<string, any>();

    const cierresPendientes = await Promise.all(
      rutaIds.map(async (rutaId) => {
        const pendientes = await this.getCierresPendientesRuta(rutaId, creadoPorId);
        return [
          rutaId,
          {
            cierrePendienteAnterior: pendientes[0] || null,
            cierresPendientes: pendientes,
            totalCierresPendientes: pendientes.length,
            tieneCierrePendiente: pendientes.length > 0,
          },
        ] as [string, any];
      }),
    );

    const result = new Map<string, any>();
    for (const item of cierresPendientes) {
      result.set(item[0], item[1]);
    }

    return result;
  }

  private resolveEstadoGestionCierrePendiente(
    v: any,
  ): 'PAGO_REGISTRADO' | 'AUSENTE' | 'REPROGRAMADO' | 'PENDIENTE' {
    const estadoVisita = String(v?.estadoVisita || '').toLowerCase()
    const recaudado = Number(v?.recaudadoDelDia || 0)

    const esPagadoPorVisita = ['pagado', 'pago', 'pago_registrado'].includes(
      estadoVisita,
    )

    if (recaudado > 0 || esPagadoPorVisita) {
      return 'PAGO_REGISTRADO'
    }

    if (estadoVisita === 'ausente') {
      return 'AUSENTE'
    }

    if (
      estadoVisita === 'reprogramado' ||
      estadoVisita === 'reprogramada' ||
      estadoVisita === 'reprogramacion' ||
      estadoVisita === 'reprogramación'
    ) {
      return 'REPROGRAMADO'
    }

    return 'PENDIENTE'
  }

  async getCierrePendienteDetalle(rutaId: string, actor?: RouteActor) {
    await this.assertCollectorOwnRoute(rutaId, actor);

    const jornadasPendientes = await this.getCierresPendientesRuta(rutaId, actor?.id);

    if (!jornadasPendientes.length) {
      return {
        pendienteCierre: false,
        totalPendientes: 0,
        jornadas: [],
        message: 'La ruta no tiene jornadas pendientes de cierre.',
      };
    }

    const jornadas = await Promise.all(
      jornadasPendientes.map(async (cierrePendiente) => {
        const detalleDia = await this.getDailyVisits(
          rutaId,
          cierrePendiente.fechaOperativa,
          actor,
        );

        const visitas = Array.isArray(detalleDia?.visitas)
          ? detalleDia.visitas
          : [];

        const clientesGestionados = visitas.filter((v: any) => {
          const estadoGestion = this.resolveEstadoGestionCierrePendiente(v);
          return estadoGestion !== 'PENDIENTE';
        });

        const clientesPagaron = visitas.filter((v: any) => {
          const estadoGestion = this.resolveEstadoGestionCierrePendiente(v);
          return estadoGestion === 'PAGO_REGISTRADO';
        });

        const clientesAusentes = visitas.filter((v: any) => {
          const estadoGestion = this.resolveEstadoGestionCierrePendiente(v);
          return estadoGestion === 'AUSENTE';
        });

        const clientesPendientes = visitas.filter((v: any) => {
          const estadoGestion = this.resolveEstadoGestionCierrePendiente(v);
          return estadoGestion === 'PENDIENTE';
        });

        const getSaldoOperativoJornada = (v: any) => {
          return (v?.prestamos || []).reduce((sum: number, prestamo: any) => {
            if (prestamo?.montoMetaOperativaPendiente != null) {
              return sum + Number(prestamo.montoMetaOperativaPendiente || 0);
            }
            return (
              sum +
              Number(
                prestamo?.cuotaObjetivo?.saldoExigibleEnFechaOperativa ||
                  prestamo?.proximaCuota?.montoNominal ||
                  0,
              )
            );
          }, 0);
        };

        return {
          cierrePendiente,
          resumen: {
            fechaOperativa: cierrePendiente.fechaOperativa,
            fechaActivacion: cierrePendiente.fechaActivacion,
            diasPendiente: cierrePendiente.diasPendiente,
            rutaId: cierrePendiente.rutaId,
            rutaNombre: cierrePendiente.rutaNombre,
            cobradorId: cierrePendiente.cobradorId,
            cobradorNombre: cierrePendiente.cobradorNombre,

            meta: detalleDia.resumen?.meta || 0,

            recaudo: detalleDia.resumen?.recaudo || 0,
            recaudoOperativo:
              detalleDia.resumen?.recaudoOperativo ??
              detalleDia.resumen?.recaudo ??
              0,
            recaudoContable: detalleDia.resumen?.recaudoContable || 0,
            recaudoRegularizado:
              detalleDia.resumen?.recaudoRegularizado || 0,
            recaudoEfectivo: detalleDia.resumen?.recaudoEfectivo || 0,
            recaudoTransferencia:
              detalleDia.resumen?.recaudoTransferencia || 0,
            recaudoContableEfectivo:
              detalleDia.resumen?.recaudoContableEfectivo || 0,
            recaudoContableTransferencia:
              detalleDia.resumen?.recaudoContableTransferencia || 0,
            recaudoRegularizadoEfectivo:
              detalleDia.resumen?.recaudoRegularizadoEfectivo || 0,
            recaudoRegularizadoTransferencia:
              detalleDia.resumen?.recaudoRegularizadoTransferencia || 0,

            pendiente: Math.max(
              Number(detalleDia.resumen?.meta || 0) -
                Number(
                  detalleDia.resumen?.recaudoOperativo ??
                    detalleDia.resumen?.recaudo ??
                    0,
                ),
              0,
            ),

            gastos: detalleDia.resumen?.gastos || 0,
            netoEfectivoRuta: detalleDia.resumen?.netoEfectivoRuta || 0,
            efectividad: detalleDia.resumen?.efectividad || 0,

            totalClientes: visitas.length,
            clientesGestionados: clientesGestionados.length,
            clientesPagaron: clientesPagaron.length,
            clientesAusentes: clientesAusentes.length,
            clientesPendientes: clientesPendientes.length,
          },
          clientes: visitas.map((v: any) => ({
            asignacionId: v.asignacionId,
            ordenVisita: v.ordenVisita,
            clienteId: v.cliente?.id,
            nombreCliente: `${v.cliente?.nombres || ''} ${v.cliente?.apellidos || ''}`.trim(),
            dni: v.cliente?.dni,
            telefono: v.cliente?.telefono,
            direccion: v.cliente?.direccion,
            nivelRiesgo: v.cliente?.nivelRiesgo,

            estadoGestion: this.resolveEstadoGestionCierrePendiente(v),

            recaudadoDelDia: Number(v.recaudadoDelDia || 0),
            saldoOperativoJornada: getSaldoOperativoJornada(v),
            metaOperativaJornada: getSaldoOperativoJornada(v) + Number(v.recaudadoDelDia || 0),
            estadoVisita: v.estadoVisita || null,
            notasVisita: v.notasVisita || null,

            cuotaObjetivo: v.cuotaObjetivo || null,
            prestamoObjetivoId: v.prestamoObjetivoId || null,
            cuotaObjetivoId: v.cuotaObjetivoId || null,
            // Deprecado: mantener para compatibilidad temporal
            cuotaObjetivoPrestamoId: v.cuotaObjetivoPrestamoId || null,
            prestamos: v.prestamos || [],
          })),
          accionesSugeridas: this.buildAccionesSugeridasCierrePendiente({
            meta: detalleDia.resumen?.meta || 0,
            recaudo:
              detalleDia.resumen?.recaudoOperativo ??
              detalleDia.resumen?.recaudo ??
              0,
            clientesPendientes: clientesPendientes.length,
            clientesAusentes: clientesAusentes.length,
          }),
        };
      }),
    );

    return {
      pendienteCierre: true,
      totalPendientes: jornadas.length,
      jornadas,
    };
  }

  private buildAccionesSugeridasCierrePendiente(input: {
    meta: number;
    recaudo: number;
    clientesPendientes: number;
    clientesAusentes: number;
  }) {
    const acciones: string[] = [];

    if (input.clientesPendientes > 0) {
      acciones.push(
        `Revisar ${input.clientesPendientes} cliente(s) sin gestión registrada.`,
      );
    }

    if (input.clientesAusentes > 0) {
      acciones.push(
        `Validar ${input.clientesAusentes} ausencia(s) registradas antes de cerrar.`,
      );
    }

    if (input.recaudo > 0) {
      acciones.push(
        'Validar que el dinero recaudado haya sido entregado o conciliado.',
      );
    }

    if (input.meta > input.recaudo) {
      acciones.push(
        'Registrar observación de descuadre o justificar pendiente antes de regularizar.',
      );
    }

    if (!acciones.length) {
      acciones.push('La jornada parece lista para cierre administrativo.');
    }

    return acciones;
  }
}
