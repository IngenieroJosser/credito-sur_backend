import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class RoutesService {
  constructor(private prisma: PrismaService) {}

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
                    telefono: true,
                  },
                },
              },
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
          orderBy: { creadoEn: 'desc' },
        }),
        this.prisma.ruta.count({ where }),
      ]);

      // Calcular estadísticas para cada ruta
      const rutasConEstadisticas = await Promise.all(
        rutas.map(async (ruta) => {
          // Obtener préstamos activos de clientes asignados
          // Obtener préstamos activos de clientes asignados
          const clientesIds = ruta.asignaciones.map((a) => a.clienteId);

          const estadisticas = {
            clientesAsignados: ruta._count.asignaciones,
            cobranzaDelDia: 0,
            metaDelDia: 0,
            clientesNuevos: 0,
          };

          let nivelRiesgo = 'PELIGRO_MINIMO';
          let porcentajeMora = 0;
          let avanceDiario = 0;

          if (clientesIds.length > 0) {
            // Obtener préstamos activos
            const prestamosActivos = await this.prisma.prestamo.findMany({
              where: {
                clienteId: { in: clientesIds },
                estado: 'ACTIVO',
                eliminadoEn: null,
              },
              include: {
                cuotas: {
                  where: {
                    fechaVencimiento: {
                      gte: new Date(new Date().setHours(0, 0, 0, 0)),
                      lt: new Date(new Date().setHours(23, 59, 59, 999)),
                    },
                  },
                },
              },
            });

            // Calcular cobranza del día (suma de pagos de hoy)
            const hoy = new Date();
            const inicioDia = new Date(hoy.setHours(0, 0, 0, 0));
            const finDia = new Date(hoy.setHours(23, 59, 59, 999));

            const pagosHoy = await this.prisma.pago.aggregate({
              where: {
                prestamoId: { in: prestamosActivos.map((p) => p.id) },
                fechaPago: {
                  gte: inicioDia,
                  lt: finDia,
                },
              },
              _sum: {
                montoTotal: true,
              },
            });

            estadisticas.cobranzaDelDia =
              pagosHoy._sum.montoTotal?.toNumber() || 0;

            // Calcular meta del día (suma de cuotas vencidas hoy)
            estadisticas.metaDelDia = prestamosActivos.reduce(
              (total, prestamo) => {
                return (
                  total +
                  prestamo.cuotas.reduce((cuotaTotal, cuota) => {
                    return cuotaTotal + cuota.monto.toNumber();
                  }, 0)
                );
              },
              0,
            );

            // Calcular AVANCE DIARIO
            if (estadisticas.metaDelDia > 0) {
              avanceDiario =
                (estadisticas.cobranzaDelDia / estadisticas.metaDelDia) * 100;
            }

            // Calcular RIESGO (Cartera Vencida)
            const cuotasVencidasTotal = await this.prisma.cuota.aggregate({
              where: {
                prestamoId: { in: prestamosActivos.map((p) => p.id) },
                fechaVencimiento: { lt: inicioDia },
                estado: { not: 'PAGADA' },
              },
              _sum: { monto: true },
            });

            const deudaTotal = prestamosActivos.reduce(
              (acc, curr) => acc + curr.saldoPendiente.toNumber(),
              0,
            );
            const montoVencido =
              cuotasVencidasTotal._sum.monto?.toNumber() || 0;

            porcentajeMora =
              deudaTotal > 0 ? (montoVencido / deudaTotal) * 100 : 0;

            if (porcentajeMora > 30) nivelRiesgo = 'ALTO_RIESGO';
            else if (porcentajeMora > 15) nivelRiesgo = 'RIESGO_MODERADO';
            else if (porcentajeMora > 10) nivelRiesgo = 'PRECAUCION';
            else if (porcentajeMora > 5) nivelRiesgo = 'LEVE_RETRASO';
          }

          return {
            ...ruta,
            ...estadisticas,
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
      console.error('Error detail in findAll:', error);
      throw new InternalServerErrorException(
        `Error al obtener las rutas: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findOne(id: string) {
    const ruta = await this.prisma.ruta.findUnique({
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
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                dni: true,
                telefono: true,
                direccion: true,
                nivelRiesgo: true,
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
      const hoy = new Date();
      const inicioDia = new Date(hoy.setHours(0, 0, 0, 0));
      const finDia = new Date(hoy.setHours(23, 59, 59, 999));

      // Obtener préstamos activos
      const prestamosActivos = await this.prisma.prestamo.findMany({
        where: {
          clienteId: { in: clientesIds },
          estado: 'ACTIVO',
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

      // Calcular cobranza del día
      const pagosHoy = await this.prisma.pago.aggregate({
        where: {
          prestamoId: { in: prestamosActivos.map((p) => p.id) },
          fechaPago: {
            gte: inicioDia,
            lt: finDia,
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
            gte: inicioDia,
            lt: finDia,
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
          fechaVencimiento: { lt: inicioDia },
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
      await this.prisma.ruta.update({
        where: { id },
        data: {
          eliminadoEn: new Date(),
          activa: false,
        },
      });

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
          const hoy = new Date();
          const inicioDia = new Date(hoy.setHours(0, 0, 0, 0));
          const finDia = new Date(hoy.setHours(23, 59, 59, 999));

          const result = await this.prisma.pago.aggregate({
            where: {
              fechaPago: {
                gte: inicioDia,
                lt: finDia,
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
          const hoy = new Date();
          const inicioDia = new Date(hoy.setHours(0, 0, 0, 0));
          const finDia = new Date(hoy.setHours(23, 59, 59, 999));

          const result = await this.prisma.cuota.aggregate({
            where: {
              fechaVencimiento: {
                gte: inicioDia,
                lt: finDia,
              },
              prestamo: {
                estado: 'ACTIVO',
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

      return { message: 'Cliente movido correctamente' };
    } catch (error) {
      throw new InternalServerErrorException('Error al mover el cliente');
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
                    estado: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL'] },
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

    for (const asignacion of asignaciones) {
      const cliente = asignacion.cliente;
      let debeAparecerHoy = false;

      // Revisar cada préstamo activo
      for (const prestamo of cliente.prestamos) {
        if (prestamo.cuotas.length === 0) continue;

        const proximaCuota = prestamo.cuotas[0];
        const fechaVencimiento = new Date(proximaCuota.fechaVencimiento);
        fechaVencimiento.setHours(0, 0, 0, 0);

        // Si la cuota está vencida, siempre aparece
        if (fechaVencimiento <= fechaConsulta) {
          debeAparecerHoy = true;
          break;
        }

        // Calcular si debe aparecer según frecuencia
        const diasHastaVencimiento = Math.ceil(
          (fechaVencimiento.getTime() - fechaConsulta.getTime()) /
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
            estado: p.estado,
            proximaCuota: p.cuotas[0]
              ? {
                  numeroCuota: p.cuotas[0].numeroCuota,
                  fechaVencimiento: p.cuotas[0].fechaVencimiento,
                  monto: Number(p.cuotas[0].monto),
                  estado: p.cuotas[0].estado,
                }
              : null,
          })),
        });
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
}
