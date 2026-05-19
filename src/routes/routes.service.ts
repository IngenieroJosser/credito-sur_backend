import {

  Injectable,

  NotFoundException,

  ConflictException,

  BadRequestException,

  ForbiddenException,

  InternalServerErrorException,

} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { AuditService } from '../audit/audit.service';

import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';

import { NotificacionesService } from '../notificaciones/notificaciones.service';

import { formatBogotaOffsetIso, getBogotaDayKey, getBogotaStartEndOfDay, getBogotaStartEndOfDayFromKey } from '../utils/date-utils';

import { CreateRouteDto } from './dto/create-route.dto';

import { UpdateRouteDto } from './dto/update-route.dto';

import { Prisma, EstadoPrestamo, EstadoCuota, RolUsuario } from '@prisma/client';

import {

  generarExcelRutaCobrador,

  generarPDFRutaCobrador,

  RutaCobradorRow,

  RutaCobradorMeta,

} from '../templates/exports';

type RouteActor = {
  id?: string;
  rol?: RolUsuario | string;
} | null | undefined;



@Injectable()

export class RoutesService {

  constructor(

    private prisma: PrismaService,

    private auditService: AuditService,

    private notificacionesGateway: NotificacionesGateway,

    private notificacionesService: NotificacionesService,

  ) { }

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

  private assertCollectorOwnUser(cobradorId: string, actor?: RouteActor) {
    if (!this.isCollector(actor)) return;
    if (actor?.id && actor.id === cobradorId) return;
    throw new ForbiddenException('No tienes permiso para consultar información de otro cobrador.');
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
      throw new ForbiddenException('No tienes permiso para acceder a esta ruta.');
    }
  }

  async getRutaActivadaHoy(rutaId: string, actor?: RouteActor) {
    await this.assertCollectorOwnRoute(rutaId, actor);

    const ruta = await this.prisma.ruta.findFirst({
      where: { id: rutaId, eliminadoEn: null },
      select: { id: true },
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

    const { inicio, fin } = this.getInicioFinHoy();

    const activacion = await this.prisma.transaccion.findFirst({
      where: {
        cajaId: cajaRuta.id,
        tipoReferencia: 'ACTIVACION_RUTA',
        fechaTransaccion: { gte: inicio, lte: fin },
      },
      select: { id: true, fechaTransaccion: true, creadoPorId: true },
    });

    return {
      rutaId,
      activadaHoy: !!activacion?.id,
      activacionId: activacion?.id || null,
      fechaActivacion: activacion?.fechaTransaccion ? formatBogotaOffsetIso(activacion.fechaTransaccion) : null,
      activadaPorId: activacion?.creadoPorId || null,
    };
  }

  async activarRutaHoy(rutaId: string, userId?: string) {
    if (!userId) {
      throw new BadRequestException('Usuario inválido');
    }

    const ruta = await this.prisma.ruta.findFirst({
      where: { id: rutaId, eliminadoEn: null },
      select: { id: true, nombre: true, cobradorId: true },
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

    const { inicio, fin } = this.getInicioFinHoy();

    const yaActivada = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "cajas" WHERE id = ${cajaRuta.id} FOR UPDATE`;

      const activacionExistente = await tx.transaccion.findFirst({
        where: {
          cajaId: cajaRuta.id,
          tipoReferencia: 'ACTIVACION_RUTA',
          fechaTransaccion: { gte: inicio, lte: fin },
        },
        select: { id: true, fechaTransaccion: true },
      });

      if (activacionExistente?.id) return activacionExistente;

      return tx.transaccion.create({
        data: {
          numeroTransaccion: `AR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          cajaId: cajaRuta.id,
          tipo: 'TRANSFERENCIA',
          monto: 0,
          descripcion: `Activación de ruta del día: ${ruta.nombre}`,
          tipoReferencia: 'ACTIVACION_RUTA',
          referenciaId: `RUTA:${ruta.id}`,
          creadoPorId: userId,
        },
        select: { id: true, fechaTransaccion: true },
      });
    });

    if (ruta.cobradorId) {
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

    return {
      rutaId: ruta.id,
      activadaHoy: true,
      message: yaActivada?.id
        ? 'La ruta ya estaba activada hoy'
        : 'Ruta activada para hoy correctamente',
    };
  }



  async listarCreditosAsignadosACobrador(cobradorId: string, actor?: RouteActor) {

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

        ruta: { select: { id: true, nombre: true, codigo: true, activa: true } },

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

                estado: { in: ['ACTIVO', 'EN_MORA', 'PAGADO', 'INCUMPLIDO', 'PERDIDA'] },

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

                    estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] },

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



      const { endDate: hoyFinUTC } = getBogotaStartEndOfDay(new Date());
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
            const ak = getBogotaDayKey(new Date(a.fechaVencimiento || '9999-12-31'));
            const bk = getBogotaDayKey(new Date(b.fechaVencimiento || '9999-12-31'));
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

          (cuotaEnProrroga && proxima?.fechaVencimientoProrroga)

            ? proxima.fechaVencimientoProrroga

            : (extension?.nuevaFechaVencimiento ?? proxima?.fechaVencimiento ?? null);



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

      const cobrador = await this.prisma.usuario.findUnique({

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

        const supervisor = await this.prisma.usuario.findUnique({

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

            supervisor: route.supervisor ? `${route.supervisor.nombres} ${route.supervisor.apellidos}` : null,

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



  async findAll(options?: {

    skip?: number;

    take?: number;

    search?: string;

    activa?: boolean;

    cobradorId?: string;

    supervisorId?: string;

  }, actor?: RouteActor) {

    const { skip, take, search, activa, supervisorId } =

      options || {};
    const cobradorId = this.isCollector(actor) ? actor?.id : options?.cobradorId;



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



    if (supervisorId) {

      where.supervisorId = supervisorId;

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

      const rutasConEstadisticas = await Promise.all(

        rutas.map(async (ruta) => {

          // Obtener IDs de clientes asignados de forma robusta

          const asignaciones = await this.prisma.asignacionRuta.findMany({

            where: { rutaId: ruta.id, activa: true },

            select: { clienteId: true }

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
            return {
              ...ruta,
              ...estadisticas,
              nivelRiesgo,
              porcentajeMora,
              avanceDiario,
              cobrador: `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`,
              estado: ruta.activa ? 'ACTIVA' : 'INACTIVA',
              frecuenciaVisita: 'DIARIO',
            };
          }



          if (clientesIds.length > 0) {

            // Para la META: solo préstamos activos/en mora
            const prestamosParaMeta = await this.prisma.prestamo.findMany({
              where: {
                clienteId: { in: clientesIds },
                estado: { in: ['ACTIVO', 'EN_MORA'] }, // ✅ sin PAGADO
                eliminadoEn: null,
              },
              select: { id: true, saldoPendiente: true, monto: true, cantidadCuotas: true, frecuenciaPago: true }
            });

            // Para el RECAUDO: incluir PAGADO para capturar pagos de hoy
            const prestamosActivos = await this.prisma.prestamo.findMany({
              where: {
                clienteId: { in: clientesIds },
                estado: { in: ['ACTIVO', 'EN_MORA', 'PAGADO'] },
                eliminadoEn: null,
              },
              select: { id: true, frecuenciaPago: true }
            });

            const pIds = prestamosActivos.map(p => p.id); // para query de pagos (recaudo)
            const pIdsParaMeta = prestamosParaMeta.map(p => p.id); // para query de cuotas (meta)



            // Rango del día actual en Bogotá (límites UTC ajustados a -05:00).
            // Una sola llamada: startDate/endDate ya representan los límites del día bogotano en UTC.
            const { startDate: dInicioBogota, endDate: dFinBogota } = getBogotaStartEndOfDay(new Date());
            const dInicioUTC = dInicioBogota;
            const dFinUTC = dFinBogota;


            if (pIds.length > 0) {

              const resAgregados = await Promise.all([

                this.prisma.pago.findMany({
                  where: {
                    prestamo: {
                      cliente: {
                        asignacionesRuta: { some: { rutaId: ruta.id, activa: true } }
                      }
                    },
                    fechaPago: { gte: dInicioBogota, lte: dFinBogota }
                  },
                  select: { montoTotal: true }
                }),

                this.prisma.cuota.findMany({
                  where: {
                    prestamoId: { in: pIdsParaMeta },
                    OR: [
                      {
                        estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] },
                        fechaVencimiento: { lte: dInicioUTC },
                      },
                      {
                        estado: 'PAGADA',
                        fechaPago: { gte: dInicioBogota, lte: dFinBogota },
                      },
                    ],
                  },
                  select: { prestamoId: true, fechaVencimiento: true, fechaPago: true, estado: true, monto: true },
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
              const montoMetaInicial = Number(cuotasInicialesHoy?._sum?.monto || 0);

              const pagosRutaRaw = resAgregados[0] as any[];
              const cuotasCriterio = resAgregados[1] as any[];
              
              const cobranzaReal = pagosRutaRaw.reduce((sum, p) => sum + Number(p.montoTotal || 0), 0);
              estadisticas.cobranzaDelDia = cobranzaReal + montoMetaInicial;

              // Calcular meta nominal consistente con getDailyVisits + computeRutaHoyUiStatsFromVisitas:
              // - DIARIO: suma acumulada de todas las cuotas vencidas (<= inicio del día)
              // - DEMÁS: primera cuota NO pagada con vencimiento <= inicio del día
              let metaNominal = 0;

              const primeraCuotaPorPrestamo = new Map<string, number>();
              for (const c of cuotasCriterio) {
                if (!c?.prestamoId) continue;
                const pid = String(c.prestamoId);
                if (primeraCuotaPorPrestamo.has(pid)) continue;
                if (c.estado === 'PAGADA') continue;
                const monto = Number(c.monto || 0);
                if (monto <= 0) continue;
                primeraCuotaPorPrestamo.set(pid, monto);
              }

              const diariosIds = prestamosParaMeta
                .filter((p) => {
                  const freq = String(p.frecuenciaPago || '').toUpperCase();
                  return freq === 'DIARIO' || freq === 'DIA';
                })
                .map((p) => p.id);

              const metaDiariaPorPrestamo = new Map<string, number>();
              if (diariosIds.length > 0) {
                const cuotasDiariasVencidasAgg = await this.prisma.cuota.groupBy({
                  by: ['prestamoId'],
                  where: {
                    prestamoId: { in: diariosIds },
                    estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] },
                    fechaVencimiento: { lte: dInicioUTC },
                  },
                  _sum: { monto: true },
                });

                for (const row of cuotasDiariasVencidasAgg as any[]) {
                  const pid = String(row.prestamoId);
                  metaDiariaPorPrestamo.set(pid, Number(row?._sum?.monto || 0));
                }
              }

              for (const p of prestamosParaMeta) {
                const pid = String(p.id);
                const freq = String(p.frecuenciaPago || '').toUpperCase();
                if (freq === 'DIARIO' || freq === 'DIA') {
                  metaNominal += Number(metaDiariaPorPrestamo.get(pid) || 0);
                  continue;
                }
                metaNominal += Number(primeraCuotaPorPrestamo.get(pid) || 0);
              }

              estadisticas.metaDelDia = metaNominal + estadisticas.cobranzaDelDia;

              console.log(`[META DEBUG] Ruta: ${ruta.nombre}`, {
                metaNominal,
                prestamosParaMetaCount: prestamosParaMeta.length,
                prestamosParaMetaIds: prestamosParaMeta.map(p => ({ id: p.id, freq: p.frecuenciaPago, saldo: Number(p.saldoPendiente), estado: (p as any).estado })),
                primeraCuotaPorPrestamo: [...primeraCuotaPorPrestamo.entries()].map(([k, v]) => ({ prestamoId: k, monto: v })),
                metaDiariaPorPrestamo: [...metaDiariaPorPrestamo.entries()].map(([k, v]) => ({ prestamoId: k, monto: v })),
                metaDelDia: estadisticas.metaDelDia,
                cobranzaDelDia: estadisticas.cobranzaDelDia,
              });

              // Calcular AVANCE DIARIO

              if (estadisticas.metaDelDia > 0) {

                avanceDiario = (estadisticas.cobranzaDelDia / estadisticas.metaDelDia) * 100;

              }



              const montoVencido = cuotasCriterio
                .filter(c => c.estado !== 'PAGADA' && new Date(c.fechaVencimiento) < dInicioUTC)
                .reduce((sum, c) => sum + Number(c.monto), 0);

              const deudaTotal = prestamosParaMeta.reduce((acc, curr) => acc + Number(curr.saldoPendiente || 0), 0);
              porcentajeMora = deudaTotal > 0 ? (montoVencido / deudaTotal) * 100 : 0;



              if (porcentajeMora > 30) nivelRiesgo = 'ALTO_RIESGO';

              else if (porcentajeMora > 15) nivelRiesgo = 'RIESGO_MODERADO';

              else if (porcentajeMora > 10) nivelRiesgo = 'PRECAUCION';

              else if (porcentajeMora > 5) nivelRiesgo = 'LEVE_RETRASO';

            }



            // Clientes nuevos (últimos 7 días)

            const sieteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            estadisticas.clientesNuevos = await this.prisma.asignacionRuta.count({

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

          return {

            ...ruta,

            ...estadisticas,

            clientesAsignados: estadisticas.clientesAsignados,

            clientesNuevos: estadisticas.clientesNuevos,

            cobranzaDelDia: estadisticas.cobranzaDelDia,

            metaDelDia: estadisticas.metaDelDia,

            nivelRiesgo,

            porcentajeMora: parseFloat(porcentajeMora.toFixed(2)),

            avanceDiario: parseFloat(avanceDiario.toFixed(2)),

            cobrador: `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`,

            estado: ruta.activa ? 'ACTIVA' : 'INACTIVA',

            frecuenciaVisita: 'DIARIO',

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
                            { estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] } },
                            {
                              estado: 'PAGADA',
                              fechaVencimiento: { gte: hoyInicioUTC }
                            }
                          ]

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
      const clientesIds = [...new Set(ruta.asignaciones.map((a) => a.clienteId))];



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

        // Obtener préstamos activos y en mora
        const prestamosActivos = ruta.asignaciones
          .flatMap((a) => a?.cliente?.prestamos || [])
          .filter((p) => p && p.eliminadoEn == null);

        const pIds = prestamosActivos.map(p => p.id);
        // Una sola llamada: getBogotaStartEndOfDay devuelve límites del día bogotano en UTC.
        const { startDate: dInicioBogota, endDate: dFinBogota } = getBogotaStartEndOfDay(new Date());
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
              select: { montoTotal: true },
            }),
            this.prisma.cuota.findMany({
              where: {
                prestamoId: { in: pIds },
                OR: [
                  {
                    estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] },
                    fechaVencimiento: { lte: dFinUTC },
                  },
                  {
                    estado: 'PAGADA',
                    fechaPago: { gte: dInicioBogota, lte: dFinBogota },
                  },
                ],
              },
              select: { prestamoId: true, fechaVencimiento: true, fechaPago: true, estado: true, monto: true },
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
          
          estadisticas.cobranzaDelDia = pagosRutaRaw.reduce((sum, p) => sum + Number(p.montoTotal || 0), 0) + montoMetaInicial;

          let metaNominal = 0;
          const primeraCuotaPorPrestamo = new Map<string, number>();
          for (const c of cuotasCriterioQuery) {
            if (!c?.prestamoId) continue;
            const pid = String(c.prestamoId);
            if (primeraCuotaPorPrestamo.has(pid)) continue;
            const monto = Number(c.monto || 0);
            if (monto <= 0) continue;
            primeraCuotaPorPrestamo.set(pid, monto);
          }

          const diariosIds = prestamosActivos
            .filter((p) => {
              const freq = String((p as any).frecuenciaPago || '').toUpperCase();
              return freq === 'DIARIO' || freq === 'DIA';
            })
            .map((p) => p.id);

          const metaDiariaPorPrestamo = new Map<string, number>();
          if (diariosIds.length > 0) {
            const [cuotasDiariasVencidasAgg, cuotasDiariasPagadasHoyAgg] = await Promise.all([
              this.prisma.cuota.groupBy({
                by: ['prestamoId'],
                where: {
                  prestamoId: { in: diariosIds },
                  estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] },
                  fechaVencimiento: { lte: dFinUTC },
                },
                _sum: { monto: true },
              }),
              this.prisma.cuota.groupBy({
                by: ['prestamoId'],
                where: {
                  prestamoId: { in: diariosIds },
                  estado: 'PAGADA',
                  fechaPago: { gte: dInicioBogota, lte: dFinBogota },
                },
                _sum: { monto: true },
              }),
            ]);

            const pagadasHoyMap = new Map<string, number>();
            for (const row of cuotasDiariasPagadasHoyAgg as any[]) {
              pagadasHoyMap.set(String(row.prestamoId), Number(row?._sum?.monto || 0));
            }

            for (const row of cuotasDiariasVencidasAgg as any[]) {
              metaDiariaPorPrestamo.set(String(row.prestamoId), Number(row?._sum?.monto || 0));
            }

            for (const pid of diariosIds) {
              const key = String(pid);
              if (Number(metaDiariaPorPrestamo.get(key) || 0) > 0) continue;
              const pagadaHoy = Number(pagadasHoyMap.get(key) || 0);
              if (pagadaHoy > 0) metaDiariaPorPrestamo.set(key, pagadaHoy);
            }
          }

          for (const p of prestamosActivos) {
            const pid = String(p.id);
            const freq = String((p as any).frecuenciaPago || '').toUpperCase();
            if (freq === 'DIARIO' || freq === 'DIA') {
              metaNominal += Number(metaDiariaPorPrestamo.get(pid) || 0);
              continue;
            }
            metaNominal += Number(primeraCuotaPorPrestamo.get(pid) || 0);
          }

          estadisticas.metaDelDia = metaNominal + montoMetaInicial;
        }

        const cuotasCriterio = prestamosActivos.flatMap((p) => (p as any)?.cuotas || []);

        const deudaTotal = prestamosActivos.reduce(
          (acc, p: any) => acc + Number(p?.saldoPendiente || 0),
          0,
        );

        const montoVencido = cuotasCriterio
          .filter(c => c.estado !== 'PAGADA' && new Date(c.fechaVencimiento) < hoyInicioUTC)
          .reduce((sum, c) => sum + Number(c.monto), 0);

        estadisticas.totalDeuda = deudaTotal;
        estadisticas.prestamosActivos = prestamosActivos.filter(p => (p as any).estado !== 'PAGADO').length;

        // Calcular avance diario
        if (estadisticas.metaDelDia > 0) {
          avanceDiario = (estadisticas.cobranzaDelDia / estadisticas.metaDelDia) * 100;
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
      const { startDate: hoyInicio, endDate: hoyFinUTC } = getBogotaStartEndOfDay(new Date());


      const ultimoCierre = await this.prisma.transaccion.findFirst({
        where: {
          caja: { rutaId: id, tipo: 'RUTA' },
          tipoReferencia: 'CIERRE_RUTA',
        },
        orderBy: { fechaTransaccion: 'desc' },
        select: { fechaTransaccion: true },
      });

      const fechaDesde = ultimoCierre?.fechaTransaccion && ultimoCierre.fechaTransaccion > hoyInicio
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
      const efectivoEntregadoTotal = Number(efectivoEntregadoAgg._sum?.monto || 0);

      const hoyFinForMap = new Date(hoyFinUTC);

      const hoyKey2 = getBogotaDayKey(new Date());

      for (const asig of ruta.asignaciones) {
         if (!asig.cliente || !asig.cliente.prestamos) continue;
         for (const p of asig.cliente.prestamos) {
            // BUG-02 FIX: calcular monto acumulado sin mutar el objeto Prisma.
            // El monto/estado se inyecta directamente al construir proximaCuota más abajo.
            let _montoAcumuladoHoy = 0;
            let _esMoraAtrasada = false;
            if (p.cuotas && p.cuotas.length > 0) {
               for (const c of p.cuotas) {
                  const cuotaKey = getBogotaDayKey(new Date(c.fechaVencimiento));
                  if (c.fechaVencimiento && cuotaKey <= hoyKey2 && c.estado !== 'PAGADA') {
                     _montoAcumuladoHoy += Number(c.monto);
                     if (cuotaKey < hoyKey2) _esMoraAtrasada = true;
                  }
               }
            }

            // Enriquecer proximaCuota/fechaEfectiva en la respuesta (fuente autoritativa para frontend)
            const cuotasList = Array.isArray((p as any)?.cuotas) ? (p as any).cuotas : [];
            const extension = (p as any)?.extensiones?.[0] || null;
            const isNoPagada = (c: any) => {
              const s = String(c?.estado || '').toUpperCase();
              return s !== 'PAGADA' && s !== 'PAGADO' && s !== 'ANULADA' && s !== 'ANULADO';
            };
            const getFechaEfectiva = (c: any): string | null => {
              if (!c) return null;
              const s = String(c?.estado || '').toUpperCase();
              return (s === 'PRORROGADA' && c?.fechaVencimientoProrroga)
                ? c.fechaVencimientoProrroga
                : (c?.fechaVencimiento ?? null);
            };

            const cuotasSorted = [...cuotasList].sort((a: any, b: any) => {
              const ak = getBogotaDayKey(new Date(getFechaEfectiva(a) || a?.fechaVencimiento));
              const bk = getBogotaDayKey(new Date(getFechaEfectiva(b) || b?.fechaVencimiento));
              return String(ak || '').localeCompare(String(bk || ''));
            });
            const prox = cuotasSorted.find(isNoPagada) || cuotasSorted[0] || null;

            const cuotaEnProrroga = String(prox?.estado || '').toUpperCase() === 'PRORROGADA';
            const fechaEfectiva =
              (cuotaEnProrroga && prox?.fechaVencimientoProrroga)
                ? prox.fechaVencimientoProrroga
                : (extension?.nuevaFechaVencimiento ?? prox?.fechaVencimiento ?? null);

            (p as any).fechaEfectiva = fechaEfectiva;
            // BUG-02 FIX: usar monto acumulado (sin mutar) y estado calculado localmente.
            (p as any).proximaCuota = prox
              ? {
                id: prox.id,
                numeroCuota: prox.numeroCuota,
                monto: _montoAcumuladoHoy > 0 ? _montoAcumuladoHoy : Number(prox.monto),
                estado: (_esMoraAtrasada && _montoAcumuladoHoy > 0) ? 'VENCIDA' : prox.estado,
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

      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;



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

    const existingRoute = await this.prisma.ruta.findUnique({

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

      const cobrador = await this.prisma.usuario.findUnique({

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

      const supervisor = await this.prisma.usuario.findUnique({

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

        if (updateRouteDto.cobradorId && updateRouteDto.cobradorId !== existingRoute.cobradorId) {
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



      if (updateRouteDto.cobradorId && updateRouteDto.cobradorId !== existingRoute.cobradorId) {

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

    const existingRoute = await this.prisma.ruta.findUnique({

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

    const existingRoute = await this.prisma.ruta.findUnique({

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

          const { startDate: hoyInicio, endDate: hoyFin } = getBogotaStartEndOfDay(new Date());



          const result = await this.prisma.pago.aggregate({

            where: {

              fechaPago: {

                gte: hoyInicio,

                lte: hoyFin,

              },

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
              estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA', 'PRORROGADA'] }
            },
            _sum: { monto: true }
          });
          return result.reduce((sum, r) => sum + (Number(r._sum.monto) || 0), 0);
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

      const ruta = await this.prisma.ruta.findUnique({

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

      const cliente = await this.prisma.cliente.findUnique({

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

          if (assignmentCobradorId) {
            await tx.prestamo.updateMany({
              where: {
                clienteId,
                estado: { in: ['ACTIVO', 'EN_MORA'] },
                eliminadoEn: null,
              },
              data: { cobradorId: assignmentCobradorId },
            });
          }

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

        if (assignmentCobradorId) {
          await tx.prestamo.updateMany({
            where: {
              clienteId,
              estado: { in: ['ACTIVO', 'EN_MORA'] },
              eliminadoEn: null,
            },
            data: { cobradorId: assignmentCobradorId },
          });
        }

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

          throw new ConflictException('El cliente ya está asignado a esta ruta');

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

        this.prisma.ruta.findUnique({

          where: {

            id: fromRutaId,

            eliminadoEn: null,

          },

        }),

        this.prisma.ruta.findUnique({

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

        select: { id: true, clienteId: true, frecuenciaPago: true, estado: true },

      });

      if (!prestamo) throw new NotFoundException('Préstamo no encontrado');



      const rutaDestino = await this.prisma.ruta.findUnique({

        where: { id: toRutaId, eliminadoEn: null },

      });

      if (!rutaDestino) throw new NotFoundException('Ruta destino no encontrada');



      await this.prisma.$transaction(async (tx) => {
        const yaAsignado = await tx.asignacionRuta.findFirst({
          where: { clienteId: prestamo.clienteId, rutaId: toRutaId, activa: true },
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

    const fechaKey = (() => {
      if (!fecha) return getBogotaDayKey(new Date());
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
      return getBogotaDayKey(new Date(fecha));
    })();

    const { startDate: fechaConsulta } = getBogotaStartEndOfDayFromKey(fechaKey);



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

                  where: {
                    OR: [
                      { 
                        estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] },
                        fechaVencimiento: { lte: getBogotaStartEndOfDayFromKey(fechaKey).startDate }
                      },
                      { 
                        estado: 'PAGADA',
                        fechaPago: {
                          gte: fechaConsulta,
                          lte: getBogotaStartEndOfDayFromKey(fechaKey).endDate
                        }
                      }
                    ]
                  },

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

        const { startDate: fechaInicioPrestamo } = getBogotaStartEndOfDay(new Date(prestamo.fechaInicio));



        if (prestamo.cuotas.length === 0) continue;



        const proximaCuota = prestamo.cuotas[0];

        // Para cuotas PRORROGADA, usar la nueva fecha de vencimiento

        const fechaEfectivaRaw = proximaCuota.estado === 'PRORROGADA' && proximaCuota.fechaVencimientoProrroga

          ? new Date(proximaCuota.fechaVencimientoProrroga)

          : new Date(proximaCuota.fechaVencimiento);

        // Fecha efectiva normalizada para comparación de "día calendario" en Bogotá
        const fechaEfectivaKey = getBogotaDayKey(fechaEfectivaRaw);
        const fechaConsultaKey = getBogotaDayKey(fechaConsulta);

        // Calcular días de diferencia absoluta basándose en claves Bogotá
        const daysDiff = (dateStr: string) => {
          const [y, m, d] = dateStr.split('-').map(Number);
          const base = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00-05:00`);
          return Math.floor(base.getTime() / 86_400_000);
        };
        const diasHastaVencimiento = daysDiff(fechaEfectivaKey) - daysDiff(fechaConsultaKey);

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

          prestamos: cliente.prestamos.map((p) => {
            const montoTotalCuotas = p.cuotas.reduce((sum, c) => sum + Number(c.monto), 0);
            return {
              id: p.id,
              numeroPrestamo: p.numeroPrestamo,
              monto: Number(p.monto),
              saldoPendiente: Number(p.saldoPendiente),
              frecuenciaPago: p.frecuenciaPago,
              cantidadCuotas: p.cantidadCuotas,
              estado: p.estado,
              proximaCuota: p.cuotas[0]
                ? {
                  numeroCuota: p.cuotas[0].numeroCuota,
                  fechaVencimiento: (
                    p.cuotas[0].estado === 'PRORROGADA' && p.cuotas[0].fechaVencimientoProrroga
                      ? p.cuotas[0].fechaVencimientoProrroga
                      : p.cuotas[0].fechaVencimiento
                  ),
                  monto: Number(p.cuotas[0].monto),
                  montoTotalDeuda: montoTotalCuotas,
                  montoNominal: Number(p.cuotas[0].monto),
                  estado: p.cuotas[0].estado,
                  enProrroga: p.cuotas[0].estado === 'PRORROGADA',
                  fechaOriginalVencimiento: p.cuotas[0].estado === 'PRORROGADA'
                    ? p.cuotas[0].fechaVencimiento
                    : undefined,
                }
                : null,
            };
          }),

        });

        clientesProcesados.add(cliente.id);

      }

    }



    const totalEsperado = visitasDelDia.reduce((sum, v) => {
      // La meta se basa en el monto nominal de la cuota (lo que corresponde pagar hoy)
      const montoVisita = v.prestamos.reduce((pSum, p) => pSum + Number(p.proximaCuota?.montoNominal || 0), 0);
      return sum + montoVisita;
    }, 0);

    // Calcular recaudo real de esa fecha para esa ruta
    // Calcular recaudo real de esa fecha para la ruta basándose en los clientes identificados
    const { startDate: fInicio, endDate: fFin } = getBogotaStartEndOfDayFromKey(fechaKey);
    // Obtener TODOS los pagos vinculados a préstamos de esta ruta en la fecha,
    // incluyendo clientes no programados hoy (sintéticos)
    const pagosDeHoy = await this.prisma.pago.findMany({
      where: {
        prestamo: {
          cliente: {
            asignacionesRuta: {
              some: { rutaId, activa: true }
            }
          }
        },
        fechaPago: { gte: fInicio, lte: fFin }
      },
      select: { clienteId: true, montoTotal: true }
    });

    // Mapear pagos por cliente para asignar a visitas
    const pagosPorCliente: Record<string, number> = {};
    pagosDeHoy.forEach(p => {
      pagosPorCliente[p.clienteId] = (pagosPorCliente[p.clienteId] || 0) + Number(p.montoTotal || 0);
    });

    // Enriquecer visitas con su recaudo individual del día
    visitasDelDia.forEach(v => {
      const cid = v.cliente?.id || v.clienteId;
      v.recaudadoDelDia = pagosPorCliente[cid] || 0;
    });

    const recaudoFinal = pagosDeHoy.reduce((sum, p) => sum + Number(p.montoTotal || 0), 0);

    // Buscar gastos de la ruta en ese día
    const gastosRuta = await this.prisma.gasto.aggregate({
      where: {
        caja: { rutaId },
        fechaGasto: { gte: fInicio, lte: fFin }
      },
      _sum: { monto: true }
    });

    const gastosFinal = Number(gastosRuta._sum.monto || 0);

    const efectividad = totalEsperado > 0 
      ? Math.round((recaudoFinal / totalEsperado) * 100) 
      : (recaudoFinal > 0 ? 100 : 0);

    const gestionadosCount = await this.prisma.pago.groupBy({
      by: ['clienteId'],
      where: {
        prestamo: {
          cliente: {
            asignacionesRuta: {
              some: { rutaId, activa: true }
            }
          }
        },
        fechaPago: { gte: fInicio, lte: fFin }
      }
    });

    const gestionados = gestionadosCount.length;

    return {
      fecha: fechaKey, // Clave de fecha Bogotá YYYY-MM-DD
      rutaId,
      totalVisitas: visitasDelDia.length,
      resumen: {
        recaudo: recaudoFinal,
        meta: totalEsperado,
        gastos: gastosFinal,
        efectividad,
        visitados: gestionados,
        total: visitasDelDia.length
      },
      visitas: visitasDelDia,
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

  async exportarRuta(rutaId: string, formato: 'excel' | 'pdf', actor?: RouteActor): Promise<Buffer> {

    await this.assertCollectorOwnRoute(rutaId, actor);

    // ── 1. Consultar ruta con todos los datos necesarios ──────────────────────

    const ruta = await this.prisma.ruta.findFirst({

      where: { id: rutaId, eliminadoEn: null },

      include: {

        cobrador: { select: { nombres: true, apellidos: true, telefono: true } },

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

                  where: { estado: { in: ['ACTIVO', 'EN_MORA'] }, eliminadoEn: null },

                  orderBy: { creadoEn: 'asc' },

                  select: {

                    id: true,

                    numeroPrestamo: true,

                    monto: true,

                    saldoPendiente: true,

                    estado: true,

                    frecuenciaPago: true,

                    cuotas: {

                      where: { estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] } },

                      orderBy: { numeroCuota: 'asc' },

                      take: 1,

                      select: { monto: true, fechaVencimiento: true, estado: true },

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

    }



    const { startDate: hoy } = getBogotaStartEndOfDay(new Date());

    const filas: FilaRuta[] = [];

    let nro = 1;



    for (const asig of ruta.asignaciones) {

      const c = asig.cliente;

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

        });

        continue;

      }



      for (const p of prestamosActivos) {

        const proxCuota = p.cuotas[0];

        let diasMora = 0;

        if (proxCuota) {

          const { startDate: fechaVenc } = getBogotaStartEndOfDay(new Date(proxCuota.fechaVencimiento));

          if (fechaVenc < hoy) {

            diasMora = Math.floor((hoy.getTime() - fechaVenc.getTime()) / 86400000);

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

        });

      }

    }



    const fechaExport = new Date().toLocaleDateString('es-CO', {

      day: '2-digit', month: 'long', year: 'numeric',

    });

    const cobradorNombre = `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`;

    const totalSaldo = filas.reduce((s, f) => s + f.saldo, 0);

    const totalCuota = filas.reduce((s, f) => s + f.cuota, 0);

    const enMora = filas.filter(f => f.semaforo === 'ROJO').length;



    const fechaArchivo = getBogotaDayKey(new Date());

    const meta: RutaCobradorMeta = {

      rutaNombre: ruta.nombre,

      rutaCodigo: (ruta as any).codigo,

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

    }));



    if (formato === 'excel') {

      const out = await generarExcelRutaCobrador(filasTpl, meta, fechaArchivo);

      return out.data;

    }



    const out = await generarPDFRutaCobrador(filasTpl, meta, fechaArchivo);

    return out.data;

  }

}


