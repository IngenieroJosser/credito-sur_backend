import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { Prisma, EstadoPrestamo, EstadoCuota } from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class RoutesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificacionesGateway: NotificacionesGateway,
    private notificacionesService: NotificacionesService,
  ) {}

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

      // Crear la ruta
      const route = await this.prisma.ruta.create({
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
  }) {
    const { skip, take, search, activa, cobradorId, supervisorId } =
      options || {};

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

          if (clientesIds.length > 0) {
            // Obtener préstamos activos y en mora
            const prestamosActivos = await this.prisma.prestamo.findMany({
              where: {
                clienteId: { in: clientesIds },
                estado: { in: ['ACTIVO', 'EN_MORA'] },
                eliminadoEn: null,
              },
              select: { id: true, saldoPendiente: true }
            });

            const pIds = prestamosActivos.map(p => p.id);

            // Crear rango del día actual (00:00:00 a 23:59:59)
            const dInicio = new Date();
            dInicio.setHours(0, 0, 0, 0);
            const dFin = new Date();
            dFin.setHours(23, 59, 59, 999);

            if (pIds.length > 0) {
              const [pagosHoy, cuotasHoy, cuotasVencidasTotal] = await Promise.all([
                this.prisma.pago.aggregate({
                  where: {
                    prestamoId: { in: pIds },
                    fechaPago: { gte: dInicio, lt: dFin },
                  },
                  _sum: { montoTotal: true },
                }),
                this.prisma.cuota.aggregate({
                  where: {
                    prestamoId: { in: pIds },
                    fechaVencimiento: { gte: dInicio, lt: dFin },
                  },
                  _sum: { monto: true },
                }),
                this.prisma.cuota.aggregate({
                  where: {
                    prestamoId: { in: pIds },
                    fechaVencimiento: { lt: dInicio },
                    estado: { not: 'PAGADA' },
                  },
                  _sum: { monto: true },
                })
              ]);

              estadisticas.cobranzaDelDia = pagosHoy._sum.montoTotal?.toNumber() || 0;
              estadisticas.metaDelDia = cuotasHoy._sum.monto?.toNumber() || 0;

              // Calcular AVANCE DIARIO
              if (estadisticas.metaDelDia > 0) {
                avanceDiario = (estadisticas.cobranzaDelDia / estadisticas.metaDelDia) * 100;
              }

              const deudaTotal = prestamosActivos.reduce((acc, curr) => acc + curr.saldoPendiente.toNumber(), 0);
              const montoVencido = cuotasVencidasTotal._sum.monto?.toNumber() || 0;

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

  async findOne(id: string) {
    try {
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
                          estado: {
                            in: [
                              EstadoCuota.PENDIENTE,
                              EstadoCuota.VENCIDA,
                              EstadoCuota.PARCIAL,
                              EstadoCuota.PRORROGADA,
                            ],
                          },
                        },
                        orderBy: { numeroCuota: 'asc' },
                        take: 1,
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
      const clientesIds = ruta.asignaciones.map((a) => a.clienteId);
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
      const prestamosActivos = await this.prisma.prestamo.findMany({
        where: {
          clienteId: { in: clientesIds },
          estado: { in: ['ACTIVO', 'EN_MORA'] },
          eliminadoEn: null,
        },
        include: {
          cuotas: {
            where: {
              estado: 'PENDIENTE',
            },
          },
        },
      });

      const hoyInicio = new Date();
      hoyInicio.setHours(0, 0, 0, 0);
      const hoyFin = new Date();
      hoyFin.setHours(23, 59, 59, 999);

      // Calcular cobranza del día
      const pagosHoy = await this.prisma.pago.aggregate({
        where: {
          prestamoId: { in: prestamosActivos.map((p) => p.id) },
          fechaPago: {
            gte: hoyInicio,
            lt: hoyFin,
          },
        },
        _sum: {
          montoTotal: true,
        },
      });

      // Calcular cuotas vencidas hoy para la meta
      const cuotasHoy = await this.prisma.cuota.aggregate({
        where: {
          prestamoId: { in: prestamosActivos.map((p) => p.id) },
          fechaVencimiento: {
            gte: hoyInicio,
            lt: hoyFin,
          },
        },
        _sum: {
          monto: true,
        },
      });

      // Calcular deuda total
      const deudaTotal = prestamosActivos.reduce((total, prestamo) => {
        return total + prestamo.saldoPendiente.toNumber();
      }, 0);

      estadisticas.cobranzaDelDia = pagosHoy._sum.montoTotal?.toNumber() || 0;
      estadisticas.metaDelDia = cuotasHoy._sum.monto?.toNumber() || 0;
      estadisticas.totalDeuda = deudaTotal;
      estadisticas.prestamosActivos = prestamosActivos.length;

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
          creadoEn: {
            gte: sieteDiasAtras,
          },
          activa: true,
        },
      });

      // Calcular cartera vencida total para riesgo
      const cuotasVencidasTotal = await this.prisma.cuota.aggregate({
        where: {
          prestamoId: { in: prestamosActivos.map((p) => p.id) },
          fechaVencimiento: { lt: hoyInicio },
          estado: { not: 'PAGADA' },
        },
        _sum: {
          monto: true,
        },
      });

      const montoVencido = cuotasVencidasTotal._sum.monto?.toNumber() || 0;
      porcentajeMora =
        estadisticas.totalDeuda > 0
          ? (montoVencido / estadisticas.totalDeuda) * 100
          : 0;

      if (porcentajeMora > 30) nivelRiesgo = 'ALTO_RIESGO';
      else if (porcentajeMora > 15) nivelRiesgo = 'RIESGO_MODERADO';
      else if (porcentajeMora > 10) nivelRiesgo = 'PRECAUCION';
      else if (porcentajeMora > 5) nivelRiesgo = 'LEVE_RETRASO';
    }

      return {
        ...ruta,
        estadisticas: {
          ...estadisticas,
          avanceDiario: parseFloat(avanceDiario.toFixed(2)),
        },
        nivelRiesgo,
        porcentajeMora: parseFloat(porcentajeMora.toFixed(2)),
        cobrador: `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`,
        supervisor: ruta.supervisorId
          ? `${ruta.supervisor?.nombres ?? ''} ${ruta.supervisor?.apellidos ?? ''}`
          : undefined,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

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
      const updatedRoute = await this.prisma.ruta.update({
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
          const hoyInicio = new Date();
          hoyInicio.setHours(0, 0, 0, 0);
          const hoyFin = new Date();
          hoyFin.setHours(23, 59, 59, 999);

          const result = await this.prisma.pago.aggregate({
            where: {
              fechaPago: {
                gte: hoyInicio,
                lt: hoyFin,
              },
            },
            _sum: {
              montoTotal: true,
            },
          });

          return result._sum.montoTotal?.toNumber() || 0;
        })(),

        // Meta de hoy (cuotas vencidas hoy)
        (async () => {
          const hoyInicio = new Date();
          hoyInicio.setHours(0, 0, 0, 0);
          const hoyFin = new Date();
          hoyFin.setHours(23, 59, 59, 999);

          const result = await this.prisma.cuota.aggregate({
            where: {
              fechaVencimiento: {
                gte: hoyInicio,
                lt: hoyFin,
              },
              prestamo: {
                estado: { in: ['ACTIVO', 'EN_MORA'] },
              },
            },
            _sum: {
              monto: true,
            },
          });

          return result._sum.monto?.toNumber() || 0;
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

      // Verificar si el cliente ya está asignado a esta ruta
      const existingAssignment = await this.prisma.asignacionRuta.findFirst({
        where: {
          clienteId,
          rutaId,
          activa: true,
        },
      });

      if (existingAssignment) {
        throw new ConflictException('El cliente ya está asignado a esta ruta');
      }

      // Obtener el orden de visita más alto y agregar uno
      const maxOrden = await this.prisma.asignacionRuta.aggregate({
        where: { rutaId, activa: true },
        _max: { ordenVisita: true },
      });

      const nuevoOrden = (maxOrden._max.ordenVisita || 0) + 1;

      // Crear la asignación
      const asignacion = await this.prisma.asignacionRuta.create({
        data: {
          rutaId,
          clienteId,
          cobradorId,
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

      if (cobradorId) {
        await this.notificacionesService.create({
          usuarioId: cobradorId,
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

      // Verificar si ya está asignado a la ruta destino
      const existingInDestination = await this.prisma.asignacionRuta.findFirst({
        where: {
          clienteId: clientId,
          rutaId: toRutaId,
          activa: true,
        },
      });

      if (existingInDestination) {
        throw new ConflictException(
          'El cliente ya está asignado a la ruta destino',
        );
      }

      // Obtener el orden de visita más alto en la ruta destino
      const maxOrdenDestino = await this.prisma.asignacionRuta.aggregate({
        where: { rutaId: toRutaId, activa: true },
        _max: { ordenVisita: true },
      });

      // Mover el cliente
      await this.prisma.$transaction([
        // Desactivar la asignación actual
        this.prisma.asignacionRuta.update({
          where: { id: asignacionActual.id },
          data: { activa: false },
        }),
        // Crear nueva asignación en la ruta destino
        this.prisma.asignacionRuta.create({
          data: {
            rutaId: toRutaId,
            clienteId: clientId,
            cobradorId: rutaDestino.cobradorId,
            ordenVisita: (maxOrdenDestino._max.ordenVisita || 0) + 1,
            activa: true,
          },
        }),
      ]);

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
   * Como la asignación es por cliente, esto crea una nueva asignación del cliente
   * en la ruta destino sin eliminar la original, permitiendo que el cliente
   * aparezca en rutas distintas según el tipo/frecuencia de cada crédito.
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

      const yaAsignado = await this.prisma.asignacionRuta.findFirst({
        where: { clienteId: prestamo.clienteId, rutaId: toRutaId, activa: true },
      });

      if (yaAsignado) {
        return { message: 'El cliente ya está asignado a esa ruta' };
      }

      const maxOrden = await this.prisma.asignacionRuta.aggregate({
        where: { rutaId: toRutaId, activa: true },
        _max: { ordenVisita: true },
      });

      await this.prisma.asignacionRuta.create({
        data: {
          rutaId: toRutaId,
          clienteId: prestamo.clienteId,
          cobradorId: rutaDestino.cobradorId,
          ordenVisita: (maxOrden._max.ordenVisita || 0) + 1,
          activa: true,
        },
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
  async getDailyVisits(rutaId: string, fecha?: string) {
    const fechaConsulta = fecha ? new Date(fecha) : new Date();
    fechaConsulta.setHours(0, 0, 0, 0);

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
                estado: { in: ['ACTIVO', 'EN_MORA'] },
              },
              include: {
                cuotas: {
                  where: {
                    estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL', 'PRORROGADA'] },
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
        const fechaInicioPrestamo = new Date(prestamo.fechaInicio);
        fechaInicioPrestamo.setHours(0, 0, 0, 0);

        // Si el préstamo inicia hoy, debe aparecer hoy para empezar a cobrar.
        if (fechaInicioPrestamo.getTime() === fechaConsulta.getTime()) {
          debeAparecerHoy = true;
          break;
        }

        if (prestamo.cuotas.length === 0) continue;

        const proximaCuota = prestamo.cuotas[0];
        // Para cuotas PRORROGADA, usar la nueva fecha de vencimiento
        const fechaEfectiva = proximaCuota.estado === 'PRORROGADA' && proximaCuota.fechaVencimientoProrroga
          ? new Date(proximaCuota.fechaVencimientoProrroga)
          : new Date(proximaCuota.fechaVencimiento);
        fechaEfectiva.setHours(0, 0, 0, 0);

        // Si la cuota está vencida o prorrogada expirada, siempre aparece
        if (fechaEfectiva <= fechaConsulta) {
          debeAparecerHoy = true;
          break;
        }

        // Calcular si debe aparecer según frecuencia
        const diasHastaVencimiento = Math.ceil(
          (fechaEfectiva.getTime() - fechaConsulta.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        switch (prestamo.frecuenciaPago) {
          case 'DIARIO':
            // Aparece todos los días si tiene cuota pendiente
            if (diasHastaVencimiento <= 1) debeAparecerHoy = true;
            break;
          case 'SEMANAL':
            // Aparece 1 día antes del vencimiento
            if (diasHastaVencimiento <= 1) debeAparecerHoy = true;
            break;
          case 'QUINCENAL':
            // Aparece 1 día antes del vencimiento
            if (diasHastaVencimiento <= 1) debeAparecerHoy = true;
            break;
          case 'MENSUAL':
            // Aparece 2 días antes del vencimiento
            if (diasHastaVencimiento <= 2) debeAparecerHoy = true;
            break;
        }

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
          prestamos: cliente.prestamos.map((p) => ({
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
                  estado: p.cuotas[0].estado,
                  enProrroga: p.cuotas[0].estado === 'PRORROGADA',
                  fechaOriginalVencimiento: p.cuotas[0].estado === 'PRORROGADA'
                    ? p.cuotas[0].fechaVencimiento
                    : undefined,
                }
              : null,
          })),
        });
        clientesProcesados.add(cliente.id);
      }
    }

    return {
      fecha: fechaConsulta.toISOString(),
      rutaId,
      totalVisitas: visitasDelDia.length,
      visitas: visitasDelDia,
    };
  }

  /**
   * Actualizar orden de clientes en una ruta (para drag & drop)
   */
  async updateClientOrder(
    rutaId: string,
    reorderData: Array<{ clienteId: string; orden: number }>,
  ) {
    try {
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
  async exportarRuta(rutaId: string, formato: 'excel' | 'pdf'): Promise<Buffer> {
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

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
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
          const fechaVenc = new Date(proxCuota.fechaVencimiento);
          fechaVenc.setHours(0, 0, 0, 0);
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
    const enMora   = filas.filter(f => f.semaforo === 'ROJO').length;

    // ── 3. Generar Excel ──────────────────────────────────────────────────────
    if (formato === 'excel') {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Créditos del Sur';
      wb.created = new Date();

      const ws = wb.addWorksheet(`Ruta ${ruta.nombre}`, {
        pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' },
      });

      // Paleta
      const COLOR_HEADER  = '1E293B'; // slate-900
      const COLOR_SUBHEAD = '334155'; // slate-700
      const COLOR_VERDE   = 'D1FAE5'; // emerald-100
      const COLOR_AMARILLO= 'FEF9C3'; // yellow-100
      const COLOR_ROJO    = 'FEE2E2'; // red-100
      const COLOR_ROJO_TXT= 'DC2626';
      const COLOR_AMARI_TXT = '92400E';
      const COLOR_VERDE_TXT = '065F46';

      // Anchos de columna
      ws.columns = [
        { key: 'nro',     width: 5  },
        { key: 'cliente', width: 26 },
        { key: 'cc',      width: 14 },
        { key: 'tel',     width: 14 },
        { key: 'dir',     width: 30 },
        { key: 'prest',   width: 14 },
        { key: 'cuota',   width: 14 },
        { key: 'fecha',   width: 14 },
        { key: 'saldo',   width: 16 },
        { key: 'estado',  width: 10 },
        { key: 'diasMora',width: 10 },
        { key: 'cobrado', width: 16 },
        { key: 'notas',   width: 24 },
      ];

      // Fila 1: Título de la ruta
      ws.mergeCells('A1:M1');
      const titleCell = ws.getCell('A1');
      titleCell.value = `CRÉDITOS DEL SUR — RUTA ${ruta.nombre.toUpperCase()} (${ruta.codigo})`;
      titleCell.font  = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLOR_HEADER}` } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 28;

      // Fila 2: Metadatos
      ws.mergeCells('A2:M2');
      const metaCell = ws.getCell('A2');
      metaCell.value = `Cobrador: ${cobradorNombre}   |   Fecha: ${fechaExport}   |   Clientes: ${ruta.asignaciones.length}   |   En mora: ${enMora}`;
      metaCell.font  = { size: 10, color: { argb: 'FFFFFFFF' } };
      metaCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLOR_SUBHEAD}` } };
      metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 18;

      // Fila 3: encabezados de columna
      const headers = ['N°', 'Cliente', 'CC / DNI', 'Teléfono', 'Dirección',
        'N° Préstamo', 'Cuota', 'Fecha Cuota', 'Saldo Total', 'Estado',
        'Días Mora', 'Cobrado ✔', 'Notas'];
      const hRow = ws.getRow(3);
      hRow.height = 20;
      headers.forEach((h, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = h;
        cell.font  = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right:  { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
      });

      // Formato moneda colombiana
      const fmtCOP = (n: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

      // Filas de datos
      filas.forEach((f, idx) => {
        const row = ws.addRow([
          f.nro,
          f.cliente,
          f.cc,
          f.telefono,
          f.direccion,
          f.numeroPrestamo,
          f.cuota   > 0 ? fmtCOP(f.cuota)   : '—',
          f.fechaCuota,
          f.saldo   > 0 ? fmtCOP(f.saldo)   : '—',
          f.estadoPrestamo.replace('_', ' '),
          f.diasMora > 0 ? f.diasMora : '',
          '',  // Cobrado — vacío para llenar en campo
          '',  // Notas
        ]);
        row.height = 18;

        // Color de fila segun semáforo
        let bgColor = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
        if (f.semaforo === 'ROJO')    bgColor = `FF${COLOR_ROJO}`;
        if (f.semaforo === 'AMARILLO') bgColor = `FF${COLOR_AMARILLO}`;

        row.eachCell((cell, colNum) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.alignment = { vertical: 'middle', wrapText: colNum === 5 };
          cell.font = { size: 9 };
          cell.border = {
            bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
            right:  { style: 'hair', color: { argb: 'FFE2E8F0' } },
          };

          // Color texto en columna Estado y Días Mora
          if (colNum === 10 || colNum === 11) {
            if (f.semaforo === 'ROJO')     cell.font = { size: 9, bold: true, color: { argb: `FF${COLOR_ROJO_TXT}` } };
            if (f.semaforo === 'AMARILLO') cell.font = { size: 9, bold: true, color: { argb: `FF${COLOR_AMARI_TXT}` } };
            if (f.semaforo === 'VERDE')    cell.font = { size: 9, bold: true, color: { argb: `FF${COLOR_VERDE_TXT}` } };
          }
        });
      });

      // Fila de totales
      const totRow = ws.addRow([
        '', 'TOTALES', '', '', '',
        `${filas.length} clientes`,
        fmtCOP(totalCuota),
        '',
        fmtCOP(totalSaldo),
        '',
        `${enMora} en mora`,
        '', '',
      ]);
      totRow.height = 22;
      totRow.eachCell(cell => {
        cell.font = { bold: true, size: 9 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLOR_HEADER}` } };
        cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle' };
      });

      // Congelar cabecera
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, activeCell: 'A4' }];

      // Auto-filter
      ws.autoFilter = { from: 'A3', to: 'M3' };

      const buffer = await wb.xlsx.writeBuffer();
      return Buffer.from(buffer);
    }

    // ── 4. Generar PDF ────────────────────────────────────────────────────────
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 40, bottom: 40, left: 36, right: 36 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width - 72;

      // Encabezado
      doc.rect(36, 20, W, 32).fill('#1E293B');
      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
        .text(`CRÉDITOS DEL SUR — RUTA ${ruta.nombre.toUpperCase()} (${ruta.codigo})`,
          40, 30, { width: W - 8, align: 'center' });

      doc.moveDown(0.2);
      doc.rect(36, 52, W, 18).fill('#334155');
      doc.fillColor('#FFFFFF').fontSize(8)
        .text(`Cobrador: ${cobradorNombre}   |   Fecha: ${fechaExport}   |   Total clientes: ${filas.length}   |   En mora: ${enMora}`,
          40, 57, { width: W - 8, align: 'center' });

      // Tabla — cabecera
      const yTabla = 78;
      const cols = [
        { label: 'N°',          w: 25  },
        { label: 'Cliente',     w: 130 },
        { label: 'CC',          w: 70  },
        { label: 'Teléfono',    w: 70  },
        { label: 'N° Préstamo', w: 70  },
        { label: 'Cuota',       w: 72  },
        { label: 'Saldo',       w: 80  },
        { label: 'Estado',      w: 55  },
        { label: 'D. Mora',     w: 40  },
        { label: 'Cobrado ✔',   w: 55  },
      ];

      // Cabecera tabla
      let xCol = 36;
      doc.rect(36, yTabla, W, 16).fill('#475569');
      doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold');
      cols.forEach(col => {
        doc.text(col.label, xCol + 2, yTabla + 4, { width: col.w - 4, align: 'center' });
        xCol += col.w;
      });

      // Filas de datos
      let y = yTabla + 16;
      const ROW_H = 14;
      doc.font('Helvetica').fontSize(6.5);

      filas.forEach((f, idx) => {
        if (y + ROW_H > doc.page.height - 50) {
          doc.addPage({ layout: 'landscape', margins: { top: 40, bottom: 40, left: 36, right: 36 } });
          y = 40;
          // Repetir cabecera
          let xc = 36;
          doc.rect(36, y, W, 16).fill('#475569');
          doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold');
          cols.forEach(col => {
            doc.text(col.label, xc + 2, y + 4, { width: col.w - 4, align: 'center' });
            xc += col.w;
          });
          y += 16;
          doc.font('Helvetica').fontSize(6.5);
        }

        const bgColor = f.semaforo === 'ROJO' ? '#FEE2E2'
          : f.semaforo === 'AMARILLO' ? '#FEF9C3'
          : idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        doc.rect(36, y, W, ROW_H).fill(bgColor);

        const txtColor = f.semaforo === 'ROJO' ? '#DC2626'
          : f.semaforo === 'AMARILLO' ? '#92400E'
          : '#1E293B';

        doc.fillColor(txtColor);
        const vals = [
          String(f.nro),
          f.cliente,
          f.cc,
          f.telefono,
          f.numeroPrestamo,
          f.cuota > 0 ? `$${f.cuota.toLocaleString('es-CO')}` : '—',
          f.saldo > 0 ? `$${f.saldo.toLocaleString('es-CO')}` : '—',
          f.estadoPrestamo.replace('_', ' '),
          f.diasMora > 0 ? String(f.diasMora) : '',
          '',
        ];
        let xv = 36;
        vals.forEach((v, i) => {
          doc.text(v, xv + 2, y + 4, { width: cols[i].w - 4, align: i === 0 || i >= 5 ? 'center' : 'left', lineBreak: false });
          xv += cols[i].w;
        });

        // Línea divisoria
        doc.moveTo(36, y + ROW_H).lineTo(36 + W, y + ROW_H).strokeColor('#E2E8F0').lineWidth(0.3).stroke();
        y += ROW_H;
      });

      // Pie de página con totales
      const yPie = doc.page.height - 44;
      doc.rect(36, yPie, W, 20).fill('#1E293B');
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
        .text(
          `Total cuotas: $${totalCuota.toLocaleString('es-CO')}   |   Total saldo: $${totalSaldo.toLocaleString('es-CO')}   |   Clientes: ${filas.length}   |   En mora: ${enMora}`,
          40, yPie + 5, { width: W - 8, align: 'center' },
        );

      doc.end();
    });
  }
}
