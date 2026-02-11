import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  EstadoPrestamo,
  EstadoCuota,
  NivelRiesgo,
  FrecuenciaPago,
  TipoAprobacion,
  EstadoAprobacion,
  RolUsuario,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditService } from '../audit/audit.service';
import { CreateLoanDto } from './dto/create-loan.dto';

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private auditService: AuditService,
  ) {}

  async getAllLoans(filters: {
    estado?: string;
    ruta?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      this.logger.log(`Getting loans with filters: ${JSON.stringify(filters)}`);

      const {
        estado = 'todos',
        ruta = 'todas',
        search = '',
        page = 1,
        limit = 8,
      } = filters;

      const skip = (page - 1) * limit;

      // Construir filtros de forma segura
      const where: any = {
        eliminadoEn: null, // Solo préstamos no eliminados
      };

      // Filtro por estado
      if (estado !== 'todos') {
        const estadosValidos = Object.values(EstadoPrestamo);
        if (estadosValidos.includes(estado as EstadoPrestamo)) {
          where.estado = estado;
        } else {
          this.logger.warn(`Estado inválido recibido: ${estado}`);
        }
      }

      // Filtro por ruta (usando asignaciones de ruta)
      if (ruta !== 'todas' && ruta !== '') {
        where.cliente = {
          asignacionesRuta: {
            some: {
              rutaId: ruta,
              activa: true,
            },
          },
        };
      }

      // Filtro por búsqueda
      if (search && search.trim() !== '') {
        const searchTerm = search.trim();
        where.OR = [
          {
            numeroPrestamo: {
              contains: searchTerm,
              mode: 'insensitive' as any,
            },
          },
          {
            cliente: {
              OR: [
                {
                  nombres: {
                    contains: searchTerm,
                    mode: 'insensitive' as any,
                  },
                },
                {
                  apellidos: {
                    contains: searchTerm,
                    mode: 'insensitive' as any,
                  },
                },
                {
                  dni: {
                    contains: searchTerm,
                    mode: 'insensitive' as any,
                  },
                },
              ],
            },
          },
          {
            producto: {
              nombre: {
                contains: searchTerm,
                mode: 'insensitive' as any,
              },
            },
          },
        ];
      }

      this.logger.log(`Query where clause: ${JSON.stringify(where)}`);

      // Obtener préstamos con relaciones - CORREGIDO: cliente solo aparece una vez
      const [prestamos, total] = await Promise.all([
        this.prisma.prestamo.findMany({
          where,
          include: {
            cliente: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                dni: true,
                telefono: true,
                nivelRiesgo: true,
                // Incluir asignaciones de ruta dentro del mismo select del cliente
                asignacionesRuta: {
                  where: { activa: true },
                  select: {
                    ruta: {
                      select: {
                        id: true,
                        nombre: true,
                        codigo: true,
                      },
                    },
                  },
                  take: 1,
                },
              },
            },
            producto: {
              select: {
                id: true,
                nombre: true,
                categoria: true,
              },
            },
            precioProducto: {
              select: {
                id: true,
                meses: true,
                precio: true,
              },
            },
            cuotas: {
              select: {
                id: true,
                numeroCuota: true,
                estado: true,
                fechaVencimiento: true,
                monto: true,
                montoPagado: true,
                montoInteresMora: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { creadoEn: 'desc' },
        }),
        this.prisma.prestamo.count({ where }),
      ]);

      this.logger.log(`Found ${prestamos.length} loans, total: ${total}`);

      // Calcular estadísticas globales (sin filtros de eliminados)
      const whereStats = { eliminadoEn: null };

      const [
        totalPrestamos,
        activos,
        enMora,
        incumplidos,
        perdida,
        pagados,
        totales,
        moraTotal,
      ] = await Promise.all([
        this.prisma.prestamo.count({ where: whereStats }),
        this.prisma.prestamo.count({
          where: { ...whereStats, estado: EstadoPrestamo.ACTIVO },
        }),
        this.prisma.prestamo.count({
          where: { ...whereStats, estado: EstadoPrestamo.EN_MORA },
        }),
        this.prisma.prestamo.count({
          where: { ...whereStats, estado: EstadoPrestamo.INCUMPLIDO },
        }),
        this.prisma.prestamo.count({
          where: { ...whereStats, estado: EstadoPrestamo.PERDIDA },
        }),
        this.prisma.prestamo.count({
          where: { ...whereStats, estado: EstadoPrestamo.PAGADO },
        }),
        this.prisma.prestamo.aggregate({
          where: whereStats,
          _sum: {
            monto: true,
            saldoPendiente: true,
          },
        }),
        this.prisma.prestamo.aggregate({
          where: {
            ...whereStats,
            estado: EstadoPrestamo.EN_MORA,
          },
          _sum: {
            saldoPendiente: true,
          },
        }),
      ]);

      // Transformar datos para el frontend de forma segura
      const prestamosTransformados = prestamos.map((prestamo) => {
        try {
          // Calcular campos adicionales
          const cuotas = prestamo.cuotas || [];
          const cuotasPagadas = cuotas.filter(
            (c) => c.estado === EstadoCuota.PAGADA,
          ).length;
          const cuotasTotales = cuotas.length;
          const cuotasVencidas = cuotas.filter(
            (c) => c.estado === EstadoCuota.VENCIDA,
          ).length;

          // Manejar valores numéricos de forma segura
          const monto = Number(prestamo.monto) || 0;
          const interesTotal = Number(prestamo.interesTotal) || 0;
          const saldoPendiente = Number(prestamo.saldoPendiente) || 0;
          const totalPagado = Number(prestamo.totalPagado) || 0;

          const montoTotal = monto + interesTotal;
          const montoPendiente = saldoPendiente;
          const montoPagado = totalPagado;

          // Calcular mora acumulada de forma segura
          const moraAcumulada = cuotas.reduce((sum, cuota) => {
            if (cuota.estado === EstadoCuota.VENCIDA) {
              return sum + (Number(cuota.montoInteresMora) || 0);
            }
            return sum;
          }, 0);

          // Determinar tipo de producto
          let tipoProducto = 'efectivo';
          if (prestamo.producto) {
            const categoria = (prestamo.producto.categoria || '').toLowerCase();
            if (
              categoria.includes('electrodoméstico') ||
              categoria.includes('electro')
            ) {
              tipoProducto = 'electrodomestico';
            } else if (categoria.includes('mueble')) {
              tipoProducto = 'mueble';
            } else {
              tipoProducto = categoria;
            }
          }

          // Obtener ruta del cliente (si existe) - CORREGIDO
          let rutaAsignada = 'Sin asignar';
          let rutaNombre = 'Sin asignar';

          if (
            prestamo.cliente &&
            prestamo.cliente.asignacionesRuta &&
            prestamo.cliente.asignacionesRuta.length > 0
          ) {
            const asignacion = prestamo.cliente.asignacionesRuta[0];
            if (asignacion.ruta) {
              rutaAsignada = asignacion.ruta.codigo || asignacion.ruta.id;
              rutaNombre = asignacion.ruta.nombre || 'Ruta asignada';
            }
          }

          return {
            id: prestamo.id || '',
            numeroPrestamo: prestamo.numeroPrestamo || 'N/A',
            clienteId: prestamo.clienteId || '',
            cliente:
              `${prestamo.cliente.nombres || ''} ${prestamo.cliente.apellidos || ''}`.trim(),
            clienteDni: prestamo.cliente.dni || '',
            clienteTelefono: prestamo.cliente.telefono || '',
            producto: prestamo.producto?.nombre || 'Préstamo en efectivo',
            tipoProducto,
            montoTotal,
            montoPendiente,
            montoPagado,
            moraAcumulada,
            cuotasPagadas,
            cuotasTotales,
            cuotasVencidas,
            estado: prestamo.estado || EstadoPrestamo.BORRADOR,
            riesgo: prestamo.cliente.nivelRiesgo || NivelRiesgo.VERDE,
            ruta: rutaAsignada,
            rutaNombre,
            fechaInicio: prestamo.fechaInicio || new Date(),
            fechaFin: prestamo.fechaFin || new Date(),
            progreso:
              cuotasTotales > 0 ? (cuotasPagadas / cuotasTotales) * 100 : 0,
          };
        } catch (error) {
          this.logger.error(`Error transforming loan ${prestamo.id}:`, error);
          // Devolver un objeto seguro en caso de error
          return {
            id: prestamo.id || 'error',
            numeroPrestamo: prestamo.numeroPrestamo || 'ERROR',
            clienteId: '',
            cliente: 'Error al cargar',
            clienteDni: '',
            clienteTelefono: '',
            producto: 'Error',
            tipoProducto: 'efectivo',
            montoTotal: 0,
            montoPendiente: 0,
            montoPagado: 0,
            moraAcumulada: 0,
            cuotasPagadas: 0,
            cuotasTotales: 0,
            cuotasVencidas: 0,
            estado: EstadoPrestamo.BORRADOR,
            riesgo: NivelRiesgo.VERDE,
            ruta: 'Error',
            rutaNombre: 'Error',
            fechaInicio: new Date(),
            fechaFin: new Date(),
            progreso: 0,
          };
        }
      });

      return {
        prestamos: prestamosTransformados,
        estadisticas: {
          total: totalPrestamos || 0,
          activos: activos || 0,
          atrasados: enMora || 0,
          morosos: (incumplidos || 0) + (perdida || 0),
          pagados: pagados || 0,
          cancelados: perdida || 0,
          montoTotal: Number(totales._sum?.monto || 0),
          montoPendiente: Number(totales._sum?.saldoPendiente || 0),
          moraTotal: Number(moraTotal._sum?.saldoPendiente || 0),
        },
        paginacion: {
          total: total || 0,
          pagina: page,
          limite: limit,
          totalPaginas: Math.ceil((total || 0) / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error in getAllLoans:', error);
      // Devolver respuesta segura en caso de error
      return {
        prestamos: [],
        estadisticas: {
          total: 0,
          activos: 0,
          atrasados: 0,
          morosos: 0,
          pagados: 0,
          cancelados: 0,
          montoTotal: 0,
          montoPendiente: 0,
          moraTotal: 0,
        },
        paginacion: {
          total: 0,
          pagina: filters.page || 1,
          limite: filters.limit || 8,
          totalPaginas: 0,
        },
      };
    }
  }

  async getLoanById(id: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: {
          id,
          eliminadoEn: null, // Solo si no está eliminado
        },
        include: {
          cliente: {
            include: {
              asignacionesRuta: {
                where: { activa: true },
                include: {
                  ruta: true,
                },
              },
            },
          },
          producto: true,
          precioProducto: true,
          cuotas: {
            orderBy: { numeroCuota: 'asc' },
          },
          pagos: {
            include: {
              detalles: true,
            },
            orderBy: { fechaPago: 'desc' },
          },
          extensiones: {
            orderBy: { creadoEn: 'desc' },
          },
          creadoPor: {
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

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      return prestamo;
    } catch (error) {
      this.logger.error(`Error getting loan ${id}:`, error);
      throw error;
    }
  }

  async deleteLoan(id: string, userId: string) {
    try {
      // Verificar si el préstamo existe
      const prestamo = await this.prisma.prestamo.findUnique({
        where: {
          id,
          eliminadoEn: null, // Solo si no está eliminado
        },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      // Actualizar estado en lugar de eliminar físicamente
      const prestamoEliminado = await this.prisma.prestamo.update({
        where: { id },
        data: {
          estado: EstadoPrestamo.PERDIDA,
          eliminadoEn: new Date(),
          estadoSincronizacion: 'PENDIENTE',
        },
      });

      // Auditoría
      await this.auditService.create({
        usuarioId: userId,
        accion: 'ELIMINAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosAnteriores: { eliminadoEn: null, estado: prestamo.estado },
        datosNuevos: {
          eliminadoEn: prestamoEliminado.eliminadoEn,
          estado: prestamoEliminado.estado,
        },
      });

      return prestamoEliminado;
    } catch (error) {
      this.logger.error(`Error deleting loan ${id}:`, error);
      throw error;
    }
  }

  async restoreLoan(id: string, userId: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: { id },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      if (!prestamo.eliminadoEn) {
        throw new Error('El préstamo no está eliminado');
      }

      const prestamoRestaurado = await this.prisma.prestamo.update({
        where: { id },
        data: {
          estado: EstadoPrestamo.ACTIVO,
          eliminadoEn: null,
          estadoSincronizacion: 'PENDIENTE',
        },
      });

      // Auditoría
      await this.auditService.create({
        usuarioId: userId,
        accion: 'RESTAURAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosAnteriores: { eliminadoEn: prestamo.eliminadoEn },
        datosNuevos: { eliminadoEn: null },
      });

      return prestamoRestaurado;
    } catch (error) {
      this.logger.error(`Error restoring loan ${id}:`, error);
      throw error;
    }
  }

  async createLoan_(createLoanDto: CreateLoanDto) {
    try {
      this.logger.log(`Creating loan for client ${createLoanDto.clienteId}`);

      // Verificar que el cliente existe
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: createLoanDto.clienteId },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado');
      }

      // Generar numero de prestamo
      const count = await this.prisma.prestamo.count();
      const numeroPrestamo = `PRES-${String(count + 1).padStart(6, '0')}`;

      // Calcular fecha fin
      const fechaInicio = new Date(createLoanDto.fechaInicio);
      const fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + createLoanDto.plazoMeses);

      // Calcular cantidad de cuotas segun frecuencia
      let cantidadCuotas = 0;
      switch (createLoanDto.frecuenciaPago) {
        case FrecuenciaPago.DIARIO:
          cantidadCuotas = createLoanDto.plazoMeses * 30;
          break;
        case FrecuenciaPago.SEMANAL:
          cantidadCuotas = createLoanDto.plazoMeses * 4;
          break;
        case FrecuenciaPago.QUINCENAL:
          cantidadCuotas = createLoanDto.plazoMeses * 2;
          break;
        case FrecuenciaPago.MENSUAL:
          cantidadCuotas = createLoanDto.plazoMeses;
          break;
      }

      // Calcular interes total
      const interesTotal =
        (createLoanDto.monto *
          createLoanDto.tasaInteres *
          createLoanDto.plazoMeses) /
        100;
      const montoCuota = (createLoanDto.monto + interesTotal) / cantidadCuotas;
      const montoCapitalCuota = createLoanDto.monto / cantidadCuotas;
      const montoInteresCuota = interesTotal / cantidadCuotas;

      // Crear prestamo con cuotas
      const prestamo = await this.prisma.prestamo.create({
        data: {
          numeroPrestamo,
          clienteId: createLoanDto.clienteId,
          productoId: createLoanDto.productoId,
          precioProductoId: createLoanDto.precioProductoId,
          tipoPrestamo: createLoanDto.tipoPrestamo,
          monto: createLoanDto.monto,
          tasaInteres: createLoanDto.tasaInteres,
          tasaInteresMora: createLoanDto.tasaInteresMora,
          plazoMeses: createLoanDto.plazoMeses,
          frecuenciaPago: createLoanDto.frecuenciaPago,
          cantidadCuotas,
          fechaInicio,
          fechaFin,
          estado: EstadoPrestamo.PENDIENTE_APROBACION,
          estadoAprobacion: EstadoAprobacion.PENDIENTE,
          creadoPorId: createLoanDto.creadoPorId,
          interesTotal,
          saldoPendiente: createLoanDto.monto + interesTotal,
          cuotas: {
            create: Array.from({ length: cantidadCuotas }, (_, i) => {
              const fechaVencimiento = new Date(fechaInicio);

              switch (createLoanDto.frecuenciaPago) {
                case FrecuenciaPago.DIARIO:
                  fechaVencimiento.setDate(
                    fechaVencimiento.getDate() + (i + 1),
                  );
                  break;
                case FrecuenciaPago.SEMANAL:
                  fechaVencimiento.setDate(
                    fechaVencimiento.getDate() + (i + 1) * 7,
                  );
                  break;
                case FrecuenciaPago.QUINCENAL:
                  fechaVencimiento.setDate(
                    fechaVencimiento.getDate() + (i + 1) * 15,
                  );
                  break;
                case FrecuenciaPago.MENSUAL:
                  fechaVencimiento.setMonth(
                    fechaVencimiento.getMonth() + (i + 1),
                  );
                  break;
              }

              return {
                numeroCuota: i + 1,
                fechaVencimiento,
                monto: montoCuota,
                montoCapital: montoCapitalCuota,
                montoInteres: montoInteresCuota,
                estado: EstadoCuota.PENDIENTE,
              };
            }),
          },
        },
        include: {
          cliente: true,
          producto: true,
          cuotas: true,
        },
      });

      this.logger.log(`Loan created successfully: ${prestamo.id}`);

      // Crear solicitud de aprobación automáticamente
      await this.prisma.aprobacion.create({
        data: {
          tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
          referenciaId: prestamo.id,
          tablaReferencia: 'Prestamo',
          solicitadoPorId: createLoanDto.creadoPorId,
          datosSolicitud: {
            prestamoId: prestamo.id,
            clienteId: prestamo.clienteId,
            monto: prestamo.monto,
            plazoMeses: prestamo.plazoMeses,
            tasaInteres: prestamo.tasaInteres,
            frecuenciaPago: prestamo.frecuenciaPago,
            fechaInicio: prestamo.fechaInicio,
            fechaFin: prestamo.fechaFin,
          },
          montoSolicitud: Number(prestamo.monto),
        },
      });

      // Notificar al Coordinador
      await this.notificacionesService.notifyCoordinator({
        titulo: 'Nuevo Préstamo Creado',
        mensaje: `El usuario ha creado un préstamo para el cliente ${cliente.nombres} ${cliente.apellidos} por valor de ${createLoanDto.monto}`,
        tipo: 'SISTEMA',
        entidad: 'PRESTAMO',
        entidadId: prestamo.id,
        metadata: {
          creadoPor: createLoanDto.creadoPorId,
          nivel: 'INFORMATIVO',
        },
      });

      // Registrar Auditoría
      await this.auditService.create({
        usuarioId: createLoanDto.creadoPorId,
        accion: 'CREAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosNuevos: prestamo,
        metadata: { clienteId: createLoanDto.clienteId },
      });

      return prestamo;
    } catch (error) {
      this.logger.error('Error creating loan:', error);
      throw error;
    }
  }

  async approveLoan(id: string, aprobadoPorId: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: { id },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      if (prestamo.estado !== EstadoPrestamo.PENDIENTE_APROBACION) {
        throw new Error(
          'El préstamo no está en estado pendiente de aprobación',
        );
      }

      const prestamoActualizado = await this.prisma.prestamo.update({
        where: { id },
        data: {
          estado: EstadoPrestamo.ACTIVO,
          estadoAprobacion: EstadoAprobacion.APROBADO,
          aprobadoPorId,
          estadoSincronizacion: 'PENDIENTE',
        },
        include: {
          cliente: true,
          producto: true,
          cuotas: true,
        },
      });

      // Actualizar la aprobación
      await this.prisma.aprobacion.updateMany({
        where: {
          referenciaId: id,
          tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
          estado: EstadoAprobacion.PENDIENTE,
        },
        data: {
          estado: EstadoAprobacion.APROBADO,
          aprobadoPorId,
          revisadoEn: new Date(),
        },
      });

      // Notificar al Coordinador (INFO)
      await this.notificacionesService.notifyCoordinator({
        titulo: 'Préstamo Aprobado',
        mensaje: `El préstamo ${prestamo.numeroPrestamo} ha sido aprobado y activado.`,
        tipo: 'EXITO',
        entidad: 'PRESTAMO',
        entidadId: prestamo.id,
        metadata: { aprobadoPor: aprobadoPorId },
      });

      // Auditoría
      await this.auditService.create({
        usuarioId: aprobadoPorId,
        accion: 'APROBAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosAnteriores: {
          estado: prestamo.estado,
          estadoAprobacion: prestamo.estadoAprobacion,
        },
        datosNuevos: { estado: 'ACTIVO', estadoAprobacion: 'APROBADO' },
      });

      return prestamoActualizado;
    } catch (error) {
      this.logger.error(`Error approving loan ${id}:`, error);
      throw error;
    }
  }

  async rejectLoan(id: string, rechazadoPorId: string, motivo?: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: { id },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      const prestamoRechazado = await this.prisma.prestamo.update({
        where: { id },
        data: {
          estadoAprobacion: EstadoAprobacion.RECHAZADO,
          aprobadoPorId: rechazadoPorId,
          estadoSincronizacion: 'PENDIENTE',
        },
        include: {
          cliente: true,
          producto: true,
        },
      });

      // Actualizar la aprobación
      await this.prisma.aprobacion.updateMany({
        where: {
          referenciaId: id,
          tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
          estado: EstadoAprobacion.PENDIENTE,
        },
        data: {
          estado: EstadoAprobacion.RECHAZADO,
          aprobadoPorId: rechazadoPorId,
          revisadoEn: new Date(),
          comentarios: motivo,
        },
      });

      // Notificar al Coordinador (ALERTA)
      await this.notificacionesService.notifyCoordinator({
        titulo: 'Préstamo Rechazado',
        mensaje: `El préstamo ${prestamo.numeroPrestamo} ha sido rechazado. Motivo: ${motivo || 'No especificado'}`,
        tipo: 'ALERTA',
        entidad: 'PRESTAMO',
        entidadId: prestamo.id,
        metadata: { rechazadoPor: rechazadoPorId, motivo },
      });

      // Auditoría
      await this.auditService.create({
        usuarioId: rechazadoPorId,
        accion: 'RECHAZAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosAnteriores: { estadoAprobacion: prestamo.estadoAprobacion },
        datosNuevos: { estadoAprobacion: 'RECHAZADO', motivo },
      });

      return prestamoRechazado;
    } catch (error) {
      this.logger.error(`Error rejecting loan ${id}:`, error);
      throw error;
    }
  }

  async getLoanCuotas(prestamoId: string) {
    try {
      const cuotas = await this.prisma.cuota.findMany({
        where: { prestamoId },
        orderBy: { numeroCuota: 'asc' },
      });

      return cuotas;
    } catch (error) {
      this.logger.error(`Error getting cuotas for loan ${prestamoId}:`, error);
      throw error;
    }
  }

  async createLoan(data: CreateLoanDto) {
    try {
      this.logger.log(
        `Creating loan for client ${data.clienteId}, type: ${data.tipoPrestamo}`,
      );

      // Verificar que el cliente existe
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: data.clienteId },
        include: {
          asignacionesRuta: {
            where: { activa: true },
            include: { ruta: true },
          },
        },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado');
      }

      // Verificar que el cliente no esté en lista negra
      if (cliente.enListaNegra) {
        throw new BadRequestException(
          'El cliente está en lista negra y no puede recibir créditos',
        );
      }

      // Verificar que el creador existe
      const creador = await this.prisma.usuario.findUnique({
        where: { id: data.creadoPorId },
      });

      if (!creador) {
        throw new NotFoundException('Usuario creador no encontrado');
      }

      let producto: any = null;
      let precioProducto: any = null;
      let montoFinanciar = data.monto;

      // Para crédito por artículo
      if (data.tipoPrestamo === 'ARTICULO') {
        if (!data.productoId || !data.precioProductoId) {
          throw new BadRequestException(
            'Para crédito por artículo se requiere productoId y precioProductoId',
          );
        }

        // Obtener el producto y precio del producto
        producto = await this.prisma.producto.findUnique({
          where: { id: data.productoId },
        });

        if (!producto) {
          throw new NotFoundException('Producto no encontrado');
        }

        // Verificar stock - CORREGIDO: acceso seguro a la propiedad stock
        if (producto.stock !== undefined && producto.stock < 1) {
          throw new BadRequestException('Producto sin stock disponible');
        }

        precioProducto = await this.prisma.precioProducto.findUnique({
          where: { id: data.precioProductoId },
        });

        if (!precioProducto) {
          throw new NotFoundException('Plan de precio no encontrado');
        }

        // Verificar que el precioProducto corresponda al producto - CORREGIDO: acceso seguro
        if (
          precioProducto.productoId &&
          precioProducto.productoId !== data.productoId
        ) {
          throw new BadRequestException(
            'El plan de precio no corresponde al producto seleccionado',
          );
        }

        // Calcular monto a financiar (precio total - cuota inicial)
        const cuotaInicial = data.cuotaInicial || 0;
        const precioTotal = precioProducto.precio
          ? Number(precioProducto.precio)
          : 0;
        montoFinanciar = Math.max(0, precioTotal - cuotaInicial);

        if (cuotaInicial > precioTotal) {
          throw new BadRequestException(
            'La cuota inicial no puede ser mayor al precio total',
          );
        }

        // Reducir stock del producto si existe la propiedad stock
        if (producto.stock !== undefined) {
          await this.prisma.producto.update({
            where: { id: data.productoId },
            data: { stock: { decrement: 1 } },
          });
        }
      }

      // Generar número de préstamo
      const count = await this.prisma.prestamo.count();
      const numeroPrestamo = `PRES-${String(count + 1).padStart(6, '0')}`;

      // Calcular fechas
      const fechaInicio = new Date(data.fechaInicio);
      const fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + data.plazoMeses);

      // Calcular cantidad de cuotas según frecuencia
      let cantidadCuotas = 0;
      switch (data.frecuenciaPago) {
        case FrecuenciaPago.DIARIO:
          cantidadCuotas = data.plazoMeses * 30;
          break;
        case FrecuenciaPago.SEMANAL:
          cantidadCuotas = data.plazoMeses * 4;
          break;
        case FrecuenciaPago.QUINCENAL:
          cantidadCuotas = data.plazoMeses * 2;
          break;
        case FrecuenciaPago.MENSUAL:
          cantidadCuotas = data.plazoMeses;
          break;
      }

      // Calcular interés total y montos por cuota
      const interesTotal =
        (montoFinanciar * data.tasaInteres * data.plazoMeses) / 100;
      const montoTotal = montoFinanciar + interesTotal;
      const montoCuota = cantidadCuotas > 0 ? montoTotal / cantidadCuotas : 0;
      const montoCapitalCuota =
        cantidadCuotas > 0 ? montoFinanciar / cantidadCuotas : 0;
      const montoInteresCuota =
        cantidadCuotas > 0 ? interesTotal / cantidadCuotas : 0;

      // Crear préstamo con cuotas
      const prestamo = await this.prisma.prestamo.create({
        data: {
          numeroPrestamo,
          clienteId: data.clienteId,
          productoId: data.productoId,
          precioProductoId: data.precioProductoId,
          tipoPrestamo: data.tipoPrestamo,
          monto: montoFinanciar,
          tasaInteres: data.tasaInteres,
          tasaInteresMora: data.tasaInteresMora || 2,
          plazoMeses: data.plazoMeses,
          frecuenciaPago: data.frecuenciaPago,
          cantidadCuotas,
          fechaInicio,
          fechaFin,
          estado: EstadoPrestamo.PENDIENTE_APROBACION,
          estadoAprobacion: 'PENDIENTE',
          creadoPorId: data.creadoPorId,
          interesTotal,
          saldoPendiente: montoTotal,
          cuotas: {
            create: Array.from({ length: cantidadCuotas }, (_, i) => {
              const fechaVencimiento = new Date(fechaInicio);

              switch (data.frecuenciaPago) {
                case FrecuenciaPago.DIARIO:
                  fechaVencimiento.setDate(
                    fechaVencimiento.getDate() + (i + 1),
                  );
                  break;
                case FrecuenciaPago.SEMANAL:
                  fechaVencimiento.setDate(
                    fechaVencimiento.getDate() + (i + 1) * 7,
                  );
                  break;
                case FrecuenciaPago.QUINCENAL:
                  fechaVencimiento.setDate(
                    fechaVencimiento.getDate() + (i + 1) * 15,
                  );
                  break;
                case FrecuenciaPago.MENSUAL:
                  fechaVencimiento.setMonth(
                    fechaVencimiento.getMonth() + (i + 1),
                  );
                  break;
              }

              return {
                numeroCuota: i + 1,
                fechaVencimiento,
                monto: montoCuota,
                montoCapital: montoCapitalCuota,
                montoInteres: montoInteresCuota,
                estado: EstadoCuota.PENDIENTE,
              };
            }),
          },
        },
        include: {
          cliente: true,
          producto: true,
          cuotas: true,
          creadoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              rol: true,
            },
          },
        },
      });

      this.logger.log(`Loan created successfully: ${prestamo.id}`);

      // Crear aprobación automática
      await this.prisma.aprobacion.create({
        data: {
          tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
          referenciaId: prestamo.id,
          tablaReferencia: 'Prestamo',
          solicitadoPorId: data.creadoPorId,
          datosSolicitud: {
            numeroPrestamo: prestamo.numeroPrestamo,
            cliente: `${cliente.nombres} ${cliente.apellidos}`,
            monto: prestamo.monto,
            tipo: data.tipoPrestamo,
            plazoMeses: data.plazoMeses,
            frecuenciaPago: data.frecuenciaPago,
          },
          montoSolicitud: prestamo.monto,
          estado: EstadoAprobacion.PENDIENTE,
        },
      });

      // Notificar a coordinadores
      const coordinadores = await this.prisma.usuario.findMany({
        where: { rol: RolUsuario.COORDINADOR, estado: 'ACTIVO' },
      });

      for (const coordinador of coordinadores) {
        await this.notificacionesService.create({
          usuarioId: coordinador.id,
          titulo: 'Nuevo Préstamo Requiere Aprobación',
          mensaje: `El usuario ${creador.nombres} ${creador.apellidos} ha creado un préstamo ${data.tipoPrestamo === 'EFECTIVO' ? 'en efectivo' : 'por artículo'} para ${cliente.nombres} ${cliente.apellidos} por valor de ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
          tipo: 'SISTEMA',
          entidad: 'PRESTAMO',
          entidadId: prestamo.id,
          metadata: {
            prestamoId: prestamo.id,
            clienteId: cliente.id,
            monto: montoFinanciar,
            tipo: data.tipoPrestamo,
            nivel: 'INFORMATIVO',
          },
        });
      }

      // Notificar al creador
      await this.notificacionesService.create({
        usuarioId: data.creadoPorId,
        titulo: 'Préstamo Creado Exitosamente',
        mensaje: `Tu préstamo ${prestamo.numeroPrestamo} ha sido creado exitosamente y está pendiente de aprobación.`,
        tipo: 'EXITO',
        entidad: 'PRESTAMO',
        entidadId: prestamo.id,
      });

      // Auditoría
      await this.auditService.create({
        usuarioId: data.creadoPorId,
        accion: 'CREAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosNuevos: {
          numeroPrestamo: prestamo.numeroPrestamo,
          clienteId: prestamo.clienteId,
          tipoPrestamo: prestamo.tipoPrestamo,
          monto: prestamo.monto,
          plazoMeses: prestamo.plazoMeses,
          frecuenciaPago: prestamo.frecuenciaPago,
        },
        metadata: { notas: data.notas || null },
      });

      return {
        ...prestamo,
        mensaje: 'Préstamo creado exitosamente. Pendiente de aprobación.',
        requiereAprobacion: true,
      };
    } catch (error) {
      this.logger.error('Error creating loan:', error);
      throw error;
    }
  }
}
