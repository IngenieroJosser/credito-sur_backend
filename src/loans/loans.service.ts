import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoPrestamo,
  EstadoCuota,
  NivelRiesgo,
  FrecuenciaPago,
  TipoAprobacion,
  EstadoAprobacion,
  RolUsuario,
  TipoAmortizacion,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { AuditService } from '../audit/audit.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { PushService } from '../push/push.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class LoansService implements OnModuleInit {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private auditService: AuditService,
    private pushService: PushService,
    private notificacionesGateway: NotificacionesGateway,
    private configuracionService: ConfiguracionService,
  ) {}

  async onModuleInit() {
    // Ejecutar automáticamente la corrección de intereses al arrancar (Deploy en Render)
    this.logger.log('🔄 [AUTO-FIX] Verificando e iniciando corrección de intereses al arranque...');
    try {
        const result = await this.fixInterestCalculations();
        this.logger.log(`✅ [AUTO-FIX] Proceso completado. ${result.corrected} préstamos corregidos de ${result.processed} verificados.`);
    } catch (error) {
        this.logger.error(`❌ [AUTO-FIX] Error durante la corrección automática: ${error}`);
    }
  }

  /**
   * Genera tabla de amortización francesa (cuota fija).
   * La tasa que recibe es la tasa TOTAL del préstamo (ej: 10 = 10%).
   * Se convierte internamente a tasa por período según la frecuencia.
   *
   * @param capital      Monto a financiar
   * @param tasaTotal    Tasa de interés total del préstamo (%)
   * @param numCuotas    Cantidad de cuotas
   * @param plazoMeses   Plazo en meses (para calcular tasa por período)
   * @param frecuencia   Frecuencia de pago
   * @returns { cuotaFija, interesTotal, tabla[] }
   */
  private calcularAmortizacionFrancesa(
    capital: number,
    tasaTotal: number,
    numCuotas: number,
    plazoMeses: number,
    frecuencia: FrecuenciaPago,
  ) {
    if (numCuotas <= 0 || capital <= 0) {
      return { cuotaFija: 0, interesTotal: 0, tabla: [] };
    }

    // Convertir tasa total a tasa mensual y luego a tasa por período
    // tasaTotal es % sobre el capital total para todo el plazo
    // La convertimos a tasa mensual efectiva: tasaTotal / plazoMeses / 100
    const tasaMensual = tasaTotal / plazoMeses / 100;

    // Tasa por período según frecuencia
    let tasaPeriodo: number;
    switch (frecuencia) {
      case FrecuenciaPago.DIARIO:
        tasaPeriodo = tasaMensual / 30;
        break;
      case FrecuenciaPago.SEMANAL:
        tasaPeriodo = tasaMensual / 4;
        break;
      case FrecuenciaPago.QUINCENAL:
        tasaPeriodo = tasaMensual / 2;
        break;
      case FrecuenciaPago.MENSUAL:
      default:
        tasaPeriodo = tasaMensual;
        break;
    }

    // Si la tasa es 0, amortización lineal pura
    if (tasaPeriodo === 0) {
      const cuotaFija = capital / numCuotas;
      return {
        cuotaFija: Math.round(cuotaFija * 100) / 100,
        interesTotal: 0,
        tabla: Array.from({ length: numCuotas }, (_, i) => ({
          numeroCuota: i + 1,
          montoCapital: Math.round((capital / numCuotas) * 100) / 100,
          montoInteres: 0,
          monto: Math.round(cuotaFija * 100) / 100,
          saldoRestante: Math.round((capital - (capital / numCuotas) * (i + 1)) * 100) / 100,
        })),
      };
    }

    // Fórmula francesa: C = P × r / (1 - (1+r)^-n)
    const cuotaFija =
      (capital * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -numCuotas));

    let saldo = capital;
    let interesTotalAcumulado = 0;
    const tabla: Array<{
      numeroCuota: number;
      montoCapital: number;
      montoInteres: number;
      monto: number;
      saldoRestante: number;
    }> = [];

    for (let i = 0; i < numCuotas; i++) {
      const interesPeriodo = saldo * tasaPeriodo;
      let capitalPeriodo = cuotaFija - interesPeriodo;

      // Última cuota: ajustar para cerrar el saldo exacto
      if (i === numCuotas - 1) {
        capitalPeriodo = saldo;
      }

      saldo = Math.max(0, saldo - capitalPeriodo);
      interesTotalAcumulado += interesPeriodo;

      const montoCuota = capitalPeriodo + interesPeriodo;

      tabla.push({
        numeroCuota: i + 1,
        montoCapital: Math.round(capitalPeriodo * 100) / 100,
        montoInteres: Math.round(interesPeriodo * 100) / 100,
        monto: Math.round(montoCuota * 100) / 100,
        saldoRestante: Math.round(saldo * 100) / 100,
      });
    }

    return {
      cuotaFija: Math.round(cuotaFija * 100) / 100,
      interesTotal: Math.round(interesTotalAcumulado * 100) / 100,
      tabla,
    };
  }

  private calcularFechaVencimiento(
    fechaInicio: Date,
    numeroCuota: number,
    frecuencia: FrecuenciaPago,
  ): Date {
    const fecha = new Date(fechaInicio);
    switch (frecuencia) {
      case FrecuenciaPago.DIARIO:
        fecha.setDate(fecha.getDate() + numeroCuota);
        break;
      case FrecuenciaPago.SEMANAL:
        fecha.setDate(fecha.getDate() + numeroCuota * 7);
        break;
      case FrecuenciaPago.QUINCENAL:
        fecha.setDate(fecha.getDate() + numeroCuota * 15);
        break;
      case FrecuenciaPago.MENSUAL:
        fecha.setMonth(fecha.getMonth() + numeroCuota);
        break;
    }
    return fecha;
  }

  async getAllLoans(filters: {
    estado?: string;
    ruta?: string;
    search?: string;
    tipo?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      this.logger.log(`Getting loans with filters: ${JSON.stringify(filters)}`);

      const {
        estado = 'todos',
        ruta = 'todas',
        search = '',
        tipo = 'todos',
        page = 1,
        limit = 8,
      } = filters;

      const skip = (page - 1) * limit;

      // Construir filtros de forma segura
      const where: any = {
        eliminadoEn: null, // Solo préstamos no eliminados
      };

      // Filtro por tipo de préstamo
      if (tipo !== 'todos' && tipo !== '') {
        where.tipoPrestamo = tipo;
      }

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
            creadoPor: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
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
            tipoPrestamo: prestamo.tipoPrestamo,
            montoTotal,
            montoPendiente,
            montoPagado,
            cuotaInicial: Number(prestamo.cuotaInicial) || 0,
            valorCuota: cuotas.length > 0 ? Number(cuotas[0].monto) : 0,
            tasaInteres: Number(prestamo.tasaInteres) || 0,
            frecuenciaPago: prestamo.frecuenciaPago,
            moraAcumulada,
            cuotasPagadas,
            cuotasTotales,
            cuotasVencidas,
            estado: prestamo.estado || EstadoPrestamo.BORRADOR,
            riesgo: prestamo.cliente.nivelRiesgo || NivelRiesgo.VERDE,
            ruta: rutaAsignada,
            rutaNombre,
            vendedor: (prestamo as any).creadoPor?.nombres || 'Sin asignar',
            fechaInicio: prestamo.fechaInicio || new Date(),
            fechaFin: prestamo.fechaFin || new Date(),
            creadoEn: (prestamo as any).creadoEn || new Date(),
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

  async updateLoan(id: string, updateData: any, userId: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: { id, eliminadoEn: null },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      const datosAnteriores = {
        monto: prestamo.monto,
        tasaInteres: prestamo.tasaInteres,
        plazoMeses: prestamo.plazoMeses,
        frecuenciaPago: prestamo.frecuenciaPago,
        estado: prestamo.estado,
      };

      // Build update payload - only allow safe fields
      const data: any = { estadoSincronizacion: 'PENDIENTE' };

      if (updateData.monto !== undefined) data.monto = updateData.monto;
      if (updateData.tasaInteres !== undefined) data.tasaInteres = updateData.tasaInteres;
      if (updateData.plazoMeses !== undefined) data.plazoMeses = updateData.plazoMeses;
      if (updateData.cantidadCuotas !== undefined) data.cantidadCuotas = updateData.cantidadCuotas;
      if (updateData.frecuenciaPago !== undefined) data.frecuenciaPago = updateData.frecuenciaPago;
      if (updateData.estado !== undefined) {
        const estadosValidos = Object.values(EstadoPrestamo);
        if (estadosValidos.includes(updateData.estado as EstadoPrestamo)) {
          data.estado = updateData.estado;
        }
      }
      if (updateData.notas !== undefined) data.notas = updateData.notas;
      if (updateData.garantia !== undefined) data.garantia = updateData.garantia;
      if (updateData.tasaInteresMora !== undefined) data.tasaInteresMora = updateData.tasaInteresMora;
      if (updateData.cuotaInicial !== undefined) data.cuotaInicial = updateData.cuotaInicial;
      if (updateData.tipoAmortizacion !== undefined) data.tipoAmortizacion = updateData.tipoAmortizacion;
      if (updateData.fechaInicio !== undefined) data.fechaInicio = new Date(updateData.fechaInicio);
      
      const newMonto = data.monto !== undefined ? Number(data.monto) : Number(prestamo.monto);
      const newTasa = data.tasaInteres !== undefined ? Number(data.tasaInteres) : Number(prestamo.tasaInteres);
      const newInteresTotal = (newMonto * newTasa) / 100;

      const shouldRecalculateFinancing =
        data.monto !== undefined ||
        data.tasaInteres !== undefined;

      if (shouldRecalculateFinancing) {
        data.interesTotal = newInteresTotal;
        data.saldoPendiente = (newMonto + newInteresTotal) - Number(prestamo.totalPagado || 0);
      }

      // Regenerate cuotas if cantidadCuotas, monto, tasaInteres, frecuenciaPago or tipoAmortizacion changed
      const shouldRegenerateCuotas = (
        data.cantidadCuotas !== undefined || 
        data.monto !== undefined || 
        data.tasaInteres !== undefined || 
        data.frecuenciaPago !== undefined ||
        data.tipoAmortizacion !== undefined
      );

      if (shouldRegenerateCuotas) {
        const cantidadCuotas = data.cantidadCuotas !== undefined ? data.cantidadCuotas : prestamo.cantidadCuotas;
        const frecuenciaPago = data.frecuenciaPago !== undefined ? data.frecuenciaPago : prestamo.frecuenciaPago;
        const tipoAmortizacion = data.tipoAmortizacion !== undefined ? data.tipoAmortizacion : (prestamo.tipoAmortizacion || TipoAmortizacion.INTERES_SIMPLE);

        // Delete existing cuotas
        await this.prisma.cuota.deleteMany({
          where: { prestamoId: id }
        });

        // Generate new cuotas
        let cuotasData: Array<{
          prestamoId: string;
          numeroCuota: number;
          fechaVencimiento: Date;
          monto: number;
          montoCapital: number;
          montoInteres: number;
          estado: typeof EstadoCuota.PENDIENTE;
        }>;

        if (tipoAmortizacion === TipoAmortizacion.FRANCESA) {
          const amortizacion = this.calcularAmortizacionFrancesa(
            newMonto,
            newTasa,
            cantidadCuotas,
            prestamo.plazoMeses,
            frecuenciaPago,
          );
          cuotasData = amortizacion.tabla.map((cuota) => {
            const fechaVencimiento = this.calcularFechaVencimiento(prestamo.fechaInicio, cuota.numeroCuota, frecuenciaPago);
            return {
              prestamoId: id,
              numeroCuota: cuota.numeroCuota,
              fechaVencimiento,
              monto: cuota.monto,
              montoCapital: cuota.montoCapital,
              montoInteres: cuota.montoInteres,
              estado: EstadoCuota.PENDIENTE,
            };
          });
        } else {
          const montoTotalSimple = newMonto + newInteresTotal;
          const montoCuota = cantidadCuotas > 0 ? montoTotalSimple / cantidadCuotas : 0;
          const montoCapitalCuota = cantidadCuotas > 0 ? newMonto / cantidadCuotas : 0;
          const montoInteresCuota = cantidadCuotas > 0 ? newInteresTotal / cantidadCuotas : 0;
          cuotasData = Array.from({ length: cantidadCuotas }, (_, i) => {
            const fechaVencimiento = this.calcularFechaVencimiento(prestamo.fechaInicio, i + 1, frecuenciaPago);
            return {
              prestamoId: id,
              numeroCuota: i + 1,
              fechaVencimiento,
              monto: Math.round(montoCuota * 100) / 100,
              montoCapital: Math.round(montoCapitalCuota * 100) / 100,
              montoInteres: Math.round(montoInteresCuota * 100) / 100,
              estado: EstadoCuota.PENDIENTE,
            };
          });
        }

        // Create new cuotas
        await this.prisma.cuota.createMany({
          data: cuotasData
        });

        data.cantidadCuotas = cantidadCuotas;
      }

      const prestamoActualizado = await this.prisma.prestamo.update({
        where: { id },
        data,
        include: {
          cliente: true,
          producto: true,
          cuotas: true,
        },
      });

      try {
        const estadoAnterior = prestamo.estado;
        const estadoNuevo = prestamoActualizado.estado;
        const cambioEstado = data.estado !== undefined && estadoAnterior !== estadoNuevo;
        if (cambioEstado) {
          const clienteNombre = `${prestamoActualizado.cliente?.nombres || ''} ${prestamoActualizado.cliente?.apellidos || ''}`.trim();
          const tituloBase = `Crédito ${prestamoActualizado.numeroPrestamo || ''} actualizado`;
          const msgBase = `El crédito ${prestamoActualizado.numeroPrestamo || ''} del cliente ${clienteNombre || ''} cambió de ${estadoAnterior} a ${estadoNuevo}.`;
          
          let actorNombre = '';
          try {
            const usuario = await this.prisma.usuario.findUnique({
              where: { id: userId },
              select: { nombres: true, apellidos: true },
            });
            if (usuario) {
              actorNombre = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim();
            }
          } catch {}

          const metadataBase = {
            estadoAnterior,
            estadoNuevo,
            solicitadoPor: actorNombre || undefined,
            solicitadoPorId: userId,
            cliente: clienteNombre || undefined,
            numeroPrestamo: prestamoActualizado.numeroPrestamo || undefined,
          };
          
          await this.notificacionesService.create({
            usuarioId: userId,
            titulo: tituloBase,
            mensaje: msgBase,
            tipo: 'PRESTAMO',
            entidad: 'Prestamo',
            entidadId: prestamoActualizado.id,
            metadata: metadataBase,
          });
          
          if (estadoNuevo === EstadoPrestamo.PENDIENTE_APROBACION) {
            await this.notificacionesService.notifyApprovers({
              titulo: `Crédito marcado como PENDIENTE`,
              mensaje: msgBase,
              tipo: 'PRESTAMO',
              entidad: 'Prestamo',
              entidadId: prestamoActualizado.id,
              metadata: metadataBase,
            });
          }
          
          if (estadoNuevo === EstadoPrestamo.ACTIVO) {
            if (prestamo.creadoPorId && prestamo.creadoPorId !== userId) {
              await this.notificacionesService.create({
                usuarioId: prestamo.creadoPorId,
                titulo: `Crédito activado`,
                mensaje: msgBase,
                tipo: 'PRESTAMO',
                entidad: 'Prestamo',
                entidadId: prestamoActualizado.id,
                metadata: metadataBase,
              });
            }
          }
        }
      } catch (e) {
        this.logger.error('Error enviando notificaciones de cambio de estado:', e);
      }

      // Auditoría
      await this.auditService.create({
        usuarioId: userId,
        accion: 'ACTUALIZAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosAnteriores,
        datosNuevos: data,
      });

      this.logger.log(`Loan ${id} updated by user ${userId}`);
      return prestamoActualizado;
    } catch (error) {
      this.logger.error(`Error updating loan ${id}:`, error);
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

      // Determinar tipo de amortización
      const tipoAmort = createLoanDto.tipoAmortizacion || TipoAmortizacion.INTERES_SIMPLE;
      const tasaInteres = createLoanDto.tasaInteres || 0;

      let interesTotal: number;
      let cuotasData: Array<{
        numeroCuota: number;
        fechaVencimiento: Date;
        monto: number;
        montoCapital: number;
        montoInteres: number;
        estado: typeof EstadoCuota.PENDIENTE;
      }>;

      if (tipoAmort === TipoAmortizacion.FRANCESA) {
        // Amortización francesa (cuota fija, interés decreciente)
        const amortizacion = this.calcularAmortizacionFrancesa(
          createLoanDto.monto,
          tasaInteres,
          cantidadCuotas,
          createLoanDto.plazoMeses,
          createLoanDto.frecuenciaPago,
        );
        interesTotal = amortizacion.interesTotal;
        cuotasData = amortizacion.tabla.map((cuota) => {
          const fechaVencimiento = this.calcularFechaVencimiento(fechaInicio, cuota.numeroCuota, createLoanDto.frecuenciaPago);
          return {
            numeroCuota: cuota.numeroCuota,
            fechaVencimiento,
            monto: cuota.monto,
            montoCapital: cuota.montoCapital,
            montoInteres: cuota.montoInteres,
            estado: EstadoCuota.PENDIENTE,
          };
        });
      } else {
        // Interés simple (tasa plana: capital × tasa × plazoMeses / 100)
        interesTotal = (createLoanDto.monto * tasaInteres * createLoanDto.plazoMeses) / 100;
        const montoTotal = createLoanDto.monto + interesTotal;
        const montoCuota = cantidadCuotas > 0 ? montoTotal / cantidadCuotas : 0;
        const montoCapitalCuota = cantidadCuotas > 0 ? createLoanDto.monto / cantidadCuotas : 0;
        const montoInteresCuota = cantidadCuotas > 0 ? interesTotal / cantidadCuotas : 0;
        cuotasData = Array.from({ length: cantidadCuotas }, (_, i) => {
          const fechaVencimiento = this.calcularFechaVencimiento(fechaInicio, i + 1, createLoanDto.frecuenciaPago);
          return {
            numeroCuota: i + 1,
            fechaVencimiento,
            monto: Math.round(montoCuota * 100) / 100,
            montoCapital: Math.round(montoCapitalCuota * 100) / 100,
            montoInteres: Math.round(montoInteresCuota * 100) / 100,
            estado: EstadoCuota.PENDIENTE,
          };
        });
      }

      // Crear prestamo con cuotas
      const prestamo = await this.prisma.prestamo.create({
        data: {
          numeroPrestamo,
          clienteId: createLoanDto.clienteId,
          productoId: createLoanDto.productoId,
          precioProductoId: createLoanDto.precioProductoId,
          tipoPrestamo: createLoanDto.tipoPrestamo,
          tipoAmortizacion: tipoAmort,
          monto: createLoanDto.monto,
          cuotaInicial: createLoanDto.cuotaInicial || 0,
          tasaInteres: tasaInteres,
          tasaInteresMora: createLoanDto.tasaInteresMora || 2,
          plazoMeses: createLoanDto.plazoMeses,
          frecuenciaPago: createLoanDto.frecuenciaPago,
          cantidadCuotas,
          fechaInicio,
          fechaFin,
          estado: EstadoPrestamo.PENDIENTE_APROBACION,
          estadoAprobacion: EstadoAprobacion.PENDIENTE,
          creadoPorId: createLoanDto.creadoPorId,
          interesTotal,
          saldoPendiente: createLoanDto.monto + interesTotal - (createLoanDto.cuotaInicial || 0),
          cuotas: {
            create: cuotasData,
          },
        } as any,
        include: {
          cliente: true,
          producto: true,
          cuotas: true,
        },
      });

      this.logger.log(`Loan created successfully: ${prestamo.id} (${tipoAmort})`);

      // Crear solicitud de aprobación automáticamente
      const aprobacion = await this.prisma.aprobacion.create({
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

      /*
      // Notificar a coordinadores, admins y superadmins sobre nuevo préstamo pendiente de aprobación
      await this.notificacionesService.notifyApprovers({
        titulo: 'Nuevo Préstamo Requiere Aprobación',
        mensaje: `El usuario ha creado un préstamo para el cliente ${cliente.nombres} ${cliente.apellidos} por valor de ${createLoanDto.monto}`,
        tipo: 'APROBACION',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
           // ...
        },
      });
      */

      // Registrar Auditoría
      await this.auditService.create({
        usuarioId: createLoanDto.creadoPorId,
        accion: 'CREAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosNuevos: prestamo,
        metadata: { clienteId: createLoanDto.clienteId },
      });

      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'CREAR',
        prestamoId: prestamo.id,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({});

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

      // Notificar a ADMIN y SUPER_ADMINISTRADOR
      const admins = await this.prisma.usuario.findMany({
        where: { 
          rol: { in: [RolUsuario.ADMIN, RolUsuario.SUPER_ADMINISTRADOR] },
          estado: 'ACTIVO' 
        },
      });

      const cliente = await this.prisma.cliente.findUnique({
        where: { id: prestamo.clienteId },
      });

      for (const admin of admins) {
        await this.notificacionesService.create({
          usuarioId: admin.id,
          titulo: 'Préstamo Aprobado',
          mensaje: `El préstamo ${prestamo.numeroPrestamo} para el cliente ${cliente?.nombres || ''} ${cliente?.apellidos || ''} ha sido aprobado y activado.`,
          tipo: 'EXITO',
          entidad: 'PRESTAMO',
          entidadId: prestamo.id,
          metadata: {
            prestamoId: prestamo.id,
            clienteId: prestamo.clienteId,
            monto: prestamo.monto,
            aprobadoPor: aprobadoPorId,
          },
        });
      }

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

      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'APROBAR',
        prestamoId: prestamoActualizado.id,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({});

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

      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'RECHAZAR',
        prestamoId: prestamoRechazado.id,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({});

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

      // Determinar si requiere aprobación (ADMIN y SUPER_ADMINISTRADOR no requieren)
      const rolesAutoAprobacion: RolUsuario[] = [RolUsuario.ADMIN, RolUsuario.SUPER_ADMINISTRADOR];
      const requiereAprobacion = !rolesAutoAprobacion.includes(creador.rol);
      const estadoInicial = requiereAprobacion ? EstadoPrestamo.PENDIENTE_APROBACION : EstadoPrestamo.ACTIVO;
      const estadoAprobacionInicial = requiereAprobacion ? EstadoAprobacion.PENDIENTE : EstadoAprobacion.APROBADO;

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

      // Generar número de préstamo/crédito
      const count = await this.prisma.prestamo.count();
      const tipo = (data.tipoPrestamo || '').toUpperCase();
      const prefix = tipo === 'ARTICULO' ? 'ART' : 'PRES';
      const numeroPrestamo = `${prefix}-${String(count + 1).padStart(6, '0')}`;

      // Calcular fechas
      const fechaInicio = new Date(data.fechaInicio);
      const fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + data.plazoMeses);


      // Calcular cantidad de cuotas: usar cantidadCuotas directa si se proporcionó, sino calcular desde plazoMeses
      this.logger.log(`[CUOTAS CALCULATION] Datos recibidos: cantidadCuotas=${data.cantidadCuotas}, plazoMeses=${data.plazoMeses}, frecuenciaPago=${data.frecuenciaPago}`);
      
      let cantidadCuotas = 0;
      if (data.cantidadCuotas && data.cantidadCuotas > 0) {
        cantidadCuotas = data.cantidadCuotas;
        this.logger.log(`[CUOTAS CALCULATION] Usando cantidadCuotas directa del frontend: ${cantidadCuotas}`);
      } else {
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
          default:
            // Fallback razonable si no hay frecuencia clara (usar semanal como base común)
            cantidadCuotas = data.plazoMeses * 4;
        }
        this.logger.log(`[CUOTAS CALCULATION] Calculado desde plazoMeses: ${cantidadCuotas}`);
      }
      
      // Asegurar que nunca sea 0 si hay plazo
      if (cantidadCuotas === 0 && data.plazoMeses > 0) {
        cantidadCuotas = data.plazoMeses * 4;
      }
      
      this.logger.log(`[CUOTAS CALCULATION] Cantidad final de cuotas a crear: ${cantidadCuotas}`);

      // Determinar tipo de amortización
      const tipoAmort = data.tipoAmortizacion || TipoAmortizacion.INTERES_SIMPLE;
      const tasaInteres = data.tasaInteres || 0;

      let interesTotal: number;
      let cuotasData: Array<{
        numeroCuota: number;
        fechaVencimiento: Date;
        monto: number;
        montoCapital: number;
        montoInteres: number;
        estado: typeof EstadoCuota.PENDIENTE;
      }>;

      if (tipoAmort === TipoAmortizacion.FRANCESA) {
        // Amortización francesa (cuota fija, interés decreciente mes a mes)
        const amortizacion = this.calcularAmortizacionFrancesa(
          montoFinanciar,
          tasaInteres,
          cantidadCuotas,
          data.plazoMeses,
          data.frecuenciaPago,
        );
        interesTotal = amortizacion.interesTotal;
        cuotasData = amortizacion.tabla.map((cuota) => {
          const fechaVencimiento = this.calcularFechaVencimiento(fechaInicio, cuota.numeroCuota, data.frecuenciaPago);
          return {
            numeroCuota: cuota.numeroCuota,
            fechaVencimiento,
            monto: cuota.monto,
            montoCapital: cuota.montoCapital,
            montoInteres: cuota.montoInteres,
            estado: EstadoCuota.PENDIENTE,
          };
        });
      } else {
        // Interés simple (tasa plana: capital × tasa × plazoMeses / 100)
        // CORREGIDO: Multiplicar por plazoMeses para calcular el interés total del período
        interesTotal = (montoFinanciar * tasaInteres * data.plazoMeses) / 100;
        const montoTotalSimple = montoFinanciar + interesTotal;
        const montoCuota = cantidadCuotas > 0 ? montoTotalSimple / cantidadCuotas : 0;
        const montoCapitalCuota = cantidadCuotas > 0 ? montoFinanciar / cantidadCuotas : 0;
        const montoInteresCuota = cantidadCuotas > 0 ? interesTotal / cantidadCuotas : 0;
        
        this.logger.log(`[LOAN CALCULATION] Capital: ${montoFinanciar}, Tasa: ${tasaInteres}%, Plazo: ${data.plazoMeses} meses`);
        this.logger.log(`[LOAN CALCULATION] Interés Total: ${interesTotal}, Cuotas: ${cantidadCuotas}, Monto/Cuota: ${montoCuota}`);
        
        cuotasData = Array.from({ length: cantidadCuotas }, (_, i) => {
          const fechaVencimiento = this.calcularFechaVencimiento(fechaInicio, i + 1, data.frecuenciaPago);
          return {
            numeroCuota: i + 1,
            fechaVencimiento,
            monto: Math.round(montoCuota * 100) / 100,
            montoCapital: Math.round(montoCapitalCuota * 100) / 100,
            montoInteres: Math.round(montoInteresCuota * 100) / 100,
            estado: EstadoCuota.PENDIENTE,
          };
        });
      }

      const montoTotal = montoFinanciar + interesTotal;

      const autoAprobarCreditos = await this.configuracionService.shouldAutoApproveCredits();
      const esAutoAprobado = autoAprobarCreditos;
      this.logger.log(`[CREATE LOAN] Usuario: ${creador.nombres}, Rol: ${creador.rol}, Auto-aprobado por configuración global: ${esAutoAprobado}`);

      // Crear préstamo con cuotas
      const prestamo = await this.prisma.prestamo.create({
        data: {
          numeroPrestamo,
          clienteId: data.clienteId,
          productoId: data.productoId,
          precioProductoId: data.precioProductoId,
          tipoPrestamo: data.tipoPrestamo,
          tipoAmortizacion: tipoAmort,
          monto: montoFinanciar,
          tasaInteres: tasaInteres,
          tasaInteresMora: data.tasaInteresMora || 2,
          plazoMeses: data.plazoMeses,
          frecuenciaPago: data.frecuenciaPago,
          cantidadCuotas,
          cuotaInicial: data.cuotaInicial || 0,
          fechaInicio,
          fechaFin,
          estado: esAutoAprobado ? EstadoPrestamo.ACTIVO : EstadoPrestamo.PENDIENTE_APROBACION,
          estadoAprobacion: esAutoAprobado ? EstadoAprobacion.APROBADO : EstadoAprobacion.PENDIENTE,
          aprobadoPorId: esAutoAprobado ? data.creadoPorId : undefined,
          creadoPorId: data.creadoPorId,
          interesTotal,
          saldoPendiente: montoTotal,
          cuotas: {
            create: cuotasData,
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

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(fechaInicio);
      startDate.setHours(0, 0, 0, 0);

      if (startDate.getTime() === today.getTime()) {
        const rutaPreferida = cliente.asignacionesRuta?.find((a: any) => a?.activa && a?.ruta?.activa && !a?.ruta?.eliminadoEn);

        const rutaCobrador = !rutaPreferida && creador.rol === RolUsuario.COBRADOR
          ? await this.prisma.ruta.findFirst({
              where: {
                eliminadoEn: null,
                activa: true,
                cobradorId: creador.id,
              },
              select: { id: true, cobradorId: true },
            })
          : null;

        const rutaIdAsignar = (rutaPreferida as any)?.rutaId || (rutaPreferida as any)?.ruta?.id || rutaCobrador?.id;
        const cobradorIdAsignar = (rutaPreferida as any)?.cobradorId || (rutaPreferida as any)?.ruta?.cobradorId || rutaCobrador?.cobradorId;

        if (rutaIdAsignar && cobradorIdAsignar) {
          const existenteHoy = await this.prisma.asignacionRuta.findFirst({
            where: {
              rutaId: rutaIdAsignar,
              clienteId: cliente.id,
              activa: true,
              fechaEspecifica: today,
            },
            select: { id: true },
          });

          if (!existenteHoy) {
            const maxOrden = await this.prisma.asignacionRuta.aggregate({
              where: { rutaId: rutaIdAsignar, activa: true },
              _max: { ordenVisita: true },
            });

            await this.prisma.asignacionRuta.create({
              data: {
                rutaId: rutaIdAsignar,
                clienteId: cliente.id,
                cobradorId: cobradorIdAsignar,
                fechaEspecifica: today,
                ordenVisita: (maxOrden._max.ordenVisita || 0) + 1,
                activa: true,
              },
            });

            this.notificacionesGateway.broadcastRutasActualizadas({
              accion: 'ACTUALIZAR',
              rutaId: rutaIdAsignar,
              clienteId: cliente.id,
            });
          }
        }
      }

      this.logger.log(`Loan created successfully: ${prestamo.id}, requiereAprobacion: ${esAutoAprobado}`);

      const articuloNombre = (data as any).productoNombre || (prestamo as any).producto?.nombre || 'Artículo';
      const totalCuotasPrometidas = cantidadCuotas;
      const isFinanciamientoArticulo = data.tipoPrestamo === 'ARTICULO';

      const safeNumber = (val: any) => {
        const n = Number(val);
        return isNaN(n) ? 0 : n;
      };

      // Crear registro de aprobación
      const aprobacion = await this.prisma.aprobacion.create({
        data: {
          tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
          referenciaId: prestamo.id,
          tablaReferencia: 'Prestamo',
          solicitadoPorId: data.creadoPorId,
          datosSolicitud: {
            numeroPrestamo: prestamo.numeroPrestamo,
            cliente: `${cliente.nombres} ${cliente.apellidos}`,
            cedula: String(cliente.dni),
            telefono: String(cliente.telefono),
            monto: safeNumber(prestamo.monto),
            tipo: String(data.tipoPrestamo),
            articulo: String(articuloNombre),
            valorArticulo: safeNumber((data as any).valorArticulo || (safeNumber(data.monto) + safeNumber(data.cuotaInicial))), 
            cuotas: safeNumber(totalCuotasPrometidas),
            plazoMeses: safeNumber(data.plazoMeses),
            porcentaje: safeNumber(isFinanciamientoArticulo ? 0 : tasaInteres),
            frecuenciaPago: String(data.frecuenciaPago),
            cuotaInicial: safeNumber(data.cuotaInicial),
            notas: data.notas ? String(data.notas) : undefined,
            garantia: data.garantia ? String(data.garantia) : undefined,
            fechaPrimerCobro: (data as any).fechaPrimerCobro ? String((data as any).fechaPrimerCobro) : undefined,
          },
          montoSolicitud: prestamo.monto,
          estado: esAutoAprobado ? EstadoAprobacion.APROBADO : EstadoAprobacion.PENDIENTE,
          aprobadoPorId: esAutoAprobado ? data.creadoPorId : undefined,
        },
      });

      if (!esAutoAprobado) {
        try {
          await this.notificacionesService.notifyApprovers({
            titulo: 'Nuevo crédito requiere aprobación',
            mensaje: `${creador.nombres} ${creador.apellidos} solicitó un ${data.tipoPrestamo === 'EFECTIVO' ? 'préstamo' : 'crédito por un artículo'} para ${cliente.nombres} ${cliente.apellidos} por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}.`,
            tipo: 'PRESTAMO',
            entidad: 'Aprobacion',
            entidadId: aprobacion.id,
            metadata: {
              tipoAprobacion: 'NUEVO_PRESTAMO',
              prestamoId: prestamo.id,
              clienteId: cliente.id,
              numeroPrestamo: prestamo.numeroPrestamo,
              monto: safeNumber(prestamo.monto),
              tipoPrestamo: data.tipoPrestamo,
            },
          });
        } catch {}

        try {
          await this.notificacionesService.create({
            usuarioId: data.creadoPorId,
            titulo: 'Solicitud enviada',
            mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
            tipo: 'INFORMATIVO',
            entidad: 'Aprobacion',
            entidadId: aprobacion.id,
            metadata: {
              tipoAprobacion: 'NUEVO_PRESTAMO',
              prestamoId: prestamo.id,
              numeroPrestamo: prestamo.numeroPrestamo,
            },
          });
        } catch {}
      }

      if (esAutoAprobado) {
        // Notificar a administradores sobre préstamo aprobado automáticamente
        const admins = await this.prisma.usuario.findMany({
          where: {
            rol: { in: [RolUsuario.ADMIN, RolUsuario.SUPER_ADMINISTRADOR] },
            estado: 'ACTIVO',
            id: { not: data.creadoPorId },
          },
        });

        for (const admin of admins) {
          await this.notificacionesService.create({
            usuarioId: admin.id,
            titulo: 'Préstamo Aprobado Automáticamente',
            mensaje: `${creador.nombres} ${creador.apellidos} creó y aprobó automáticamente un préstamo para ${cliente.nombres} ${cliente.apellidos} por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
            tipo: 'SISTEMA',
            entidad: 'PRESTAMO',
            entidadId: prestamo.id,
          });
        }

        // Enviar notificaciones push a administradores
        await this.pushService.sendPushNotification({
          title: 'Préstamo Aprobado Automáticamente',
          body: `${creador.nombres} ${creador.apellidos} creó y aprobó un préstamo por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
          roleFilter: ['ADMIN', 'SUPER_ADMINISTRADOR'],
          data: {
            type: 'PRESTAMO_APROBADO',
            prestamoId: prestamo.id,
            numeroPrestamo: prestamo.numeroPrestamo
          }
        });

        // Notificar al creador
        await this.notificacionesService.create({
          usuarioId: data.creadoPorId,
          titulo: 'Préstamo Creado y Aprobado',
          mensaje: `El préstamo ${prestamo.numeroPrestamo} ha sido creado y aprobado automáticamente.`,
          tipo: 'EXITO',
          entidad: 'PRESTAMO',
          entidadId: prestamo.id,
        });

        // Enviar notificación push al creador
        await this.pushService.sendPushNotification({
          title: 'Préstamo Creado y Aprobado',
          body: `Tu préstamo ${prestamo.numeroPrestamo} ha sido creado y aprobado automáticamente.`,
          userId: data.creadoPorId,
          data: {
            type: 'PRESTAMO_CREADO',
            prestamoId: prestamo.id,
            numeroPrestamo: prestamo.numeroPrestamo
          }
        });
      } else {
        /* 
        // Notificar a coordinadores, admins y superadmins para aprobación
        await this.notificacionesService.notifyApprovers({
          titulo: 'Nuevo Préstamo Requiere Aprobación',
          mensaje: `El usuario ${creador.nombres} ${creador.apellidos} ha solicitado un ${data.tipoPrestamo === 'EFECTIVO' ? 'préstamo en efectivo' : 'crédito por un artículo'} para ${cliente.nombres} ${cliente.apellidos} por valor de ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
          tipo: 'APROBACION',
          entidad: 'Aprobacion',
          entidadId: aprobacion.id,
          metadata: {
             // ... [Omitido para no generar ruido de notificaciones de aprobación]
          },
        });
        */

        // Enviar notificaciones push a coordinadores
        await this.pushService.sendPushNotification({
          title: 'Nuevo Préstamo Requiere Aprobación',
          body: `${creador.nombres} ${creador.apellidos} ha solicitado un ${data.tipoPrestamo === 'EFECTIVO' ? 'préstamo' : 'crédito de artículo'} por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
          roleFilter: ['COORDINADOR'],
          data: {
            type: 'PRESTAMO_PENDIENTE',
            prestamoId: prestamo.id,
            numeroPrestamo: prestamo.numeroPrestamo
          }
        });

// Notificar al creador
        await this.notificacionesService.create({
          usuarioId: data.creadoPorId,
          titulo: 'Préstamo Solicitado Exitosamente',
          mensaje: `Tu solicitud de préstamo ${prestamo.numeroPrestamo} ha sido creada exitosamente y está pendiente de aprobación.`,
          tipo: 'EXITO',
          entidad: 'PRESTAMO',
          entidadId: prestamo.id,
        });
      }

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
          autoAprobado: esAutoAprobado,
        },
        metadata: { notas: data.notas || null },
      });

      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'CREAR',
        prestamoId: prestamo.id,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({});

      return {
        ...prestamo,
        mensaje: esAutoAprobado
          ? 'Préstamo creado y aprobado automáticamente.'
          : 'Préstamo creado exitosamente. Pendiente de aprobación.',
        requiereAprobacion: !esAutoAprobado,
      };
    } catch (error) {
      this.logger.error('Error creating loan:', error);
      throw error;
    }
  }

  async exportLoans(
    filters: { estado?: string; ruta?: string; search?: string },
    format: 'excel' | 'pdf',
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    // Fetch all matching loans (no pagination for export)
    const result = await this.getAllLoans({
      ...filters,
      page: 1,
      limit: 10000,
    });

    const prestamos = result.prestamos;
    const fecha = new Date().toISOString().split('T')[0];

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Cartera de Créditos');

      // Header row styling
      ws.columns = [
        { header: 'N° Préstamo', key: 'numero', width: 18 },
        { header: 'Cliente', key: 'cliente', width: 30 },
        { header: 'Cédula', key: 'dni', width: 15 },
        { header: 'Producto', key: 'producto', width: 22 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Monto Total', key: 'montoTotal', width: 18 },
        { header: 'Monto Pendiente', key: 'montoPendiente', width: 18 },
        { header: 'Monto Pagado', key: 'montoPagado', width: 18 },
        { header: 'Mora', key: 'mora', width: 15 },
        { header: 'Cuotas Pagadas', key: 'cuotasPagadas', width: 15 },
        { header: 'Cuotas Totales', key: 'cuotasTotales', width: 15 },
        { header: 'Progreso %', key: 'progreso', width: 12 },
        { header: 'Riesgo', key: 'riesgo', width: 12 },
        { header: 'Ruta', key: 'ruta', width: 18 },
        { header: 'Fecha Inicio', key: 'fechaInicio', width: 14 },
        { header: 'Fecha Fin', key: 'fechaFin', width: 14 },
      ];

      // Style header row
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF08557F' } };
      headerRow.alignment = { horizontal: 'center' };

      // Add data rows
      prestamos.forEach((p: any) => {
        ws.addRow({
          numero: p.numeroPrestamo,
          cliente: p.cliente,
          dni: p.clienteDni,
          producto: p.producto,
          estado: p.estado,
          montoTotal: p.montoTotal,
          montoPendiente: p.montoPendiente,
          montoPagado: p.montoPagado,
          mora: p.moraAcumulada || 0,
          cuotasPagadas: p.cuotasPagadas,
          cuotasTotales: p.cuotasTotales,
          progreso: Math.round(p.progreso || 0),
          riesgo: p.riesgo,
          ruta: p.rutaNombre || p.ruta,
          fechaInicio: p.fechaInicio ? new Date(p.fechaInicio).toLocaleDateString('es-CO') : '',
          fechaFin: p.fechaFin ? new Date(p.fechaFin).toLocaleDateString('es-CO') : '',
        });
      });

      // Format currency columns
      ['montoTotal', 'montoPendiente', 'montoPagado', 'mora'].forEach(key => {
        const col = ws.getColumn(key);
        col.numFmt = '#,##0';
      });

      // Summary row
      ws.addRow({});
      const summaryRow = ws.addRow({
        numero: 'RESUMEN',
        montoTotal: result.estadisticas.montoTotal,
        montoPendiente: result.estadisticas.montoPendiente,
        mora: result.estadisticas.moraTotal,
      });
      summaryRow.font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();

      return {
        data: Buffer.from(buffer as ArrayBuffer),
        contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        filename: `cartera-creditos-${fecha}.xlsm`,
      };
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
      const buffers: any[] = [];
      doc.on('data', buffers.push.bind(buffers));

      // Title
      doc.fontSize(16).font('Helvetica-Bold').text('Créditos del Sur — Cartera de Créditos', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
      doc.moveDown(0.5);

      // Stats bar
      const stats = result.estadisticas;
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text(`Total: ${stats.total}  |  Activos: ${stats.activos}  |  En Mora: ${stats.atrasados}  |  Pagados: ${stats.pagados}  |  Cartera: $${(stats.montoTotal || 0).toLocaleString('es-CO')}  |  Pendiente: $${(stats.montoPendiente || 0).toLocaleString('es-CO')}  |  Mora: $${(stats.moraTotal || 0).toLocaleString('es-CO')}`, { align: 'center' });
      doc.moveDown(0.5);

      // Table
      const cols = [
        { label: 'N° Préstamo', width: 80 },
        { label: 'Cliente', width: 130 },
        { label: 'Estado', width: 65 },
        { label: 'Monto Total', width: 80 },
        { label: 'Pendiente', width: 80 },
        { label: 'Mora', width: 65 },
        { label: 'Cuotas', width: 55 },
        { label: 'Progreso', width: 55 },
        { label: 'Ruta', width: 80 },
        { label: 'Fecha Inicio', width: 70 },
      ];

      const tableLeft = 30;
      let y = doc.y + 5;
      const rowH = 16;

      // Header
      doc.fontSize(7).font('Helvetica-Bold');
      doc.rect(tableLeft, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#08557F');
      let x = tableLeft;
      cols.forEach(col => {
        doc.fillColor('white').text(col.label, x + 3, y + 4, { width: col.width - 6, align: 'left' });
        x += col.width;
      });
      y += rowH;

      // Rows
      doc.font('Helvetica').fontSize(7).fillColor('black');
      prestamos.forEach((p: any, i: number) => {
        if (y > 560) {
          doc.addPage();
          y = 30;
        }
        if (i % 2 === 0) {
          doc.rect(tableLeft, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#F8FAFC');
          doc.fillColor('black');
        }
        x = tableLeft;
        const rowData = [
          p.numeroPrestamo || '',
          (p.cliente || '').substring(0, 25),
          p.estado || '',
          `$${(p.montoTotal || 0).toLocaleString('es-CO')}`,
          `$${(p.montoPendiente || 0).toLocaleString('es-CO')}`,
          `$${(p.moraAcumulada || 0).toLocaleString('es-CO')}`,
          `${p.cuotasPagadas || 0}/${p.cuotasTotales || 0}`,
          `${Math.round(p.progreso || 0)}%`,
          (p.rutaNombre || p.ruta || '').substring(0, 15),
          p.fechaInicio ? new Date(p.fechaInicio).toLocaleDateString('es-CO') : '',
        ];
        rowData.forEach((val, ci) => {
          doc.text(val, x + 3, y + 4, { width: cols[ci].width - 6, align: 'left' });
          x += cols[ci].width;
        });
        y += rowH;
      });

      doc.end();

      const buffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
      });

      return {
        data: buffer,
        contentType: 'application/pdf',
        filename: `cartera-creditos-${fecha}.pdf`,
      };
    }

    throw new Error(`Formato no soportado: ${format}`);
  }

  async generarContrato(
    loanId: string,
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: loanId },
      include: {
        cliente: true,
        producto: true,
        cuotas: { orderBy: { numeroCuota: 'asc' } },
        creadoPor: { select: { nombres: true, apellidos: true } },
      },
    });

    if (!prestamo) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    if (prestamo.tipoPrestamo !== 'ARTICULO') {
      throw new BadRequestException('El contrato solo se puede generar para créditos de artículo');
    }

    const fecha = new Date().toISOString().split('T')[0];
    const titulo = 'CONTRATO DE CRÉDITO DE ARTÍCULO';

    const doc = new PDFDocument({ layout: 'portrait', size: 'LETTER', margin: 50 });
    const buffers: any[] = [];
    doc.on('data', buffers.push.bind(buffers));

    // ── ENCABEZADO EMPRESA ──
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#08557F').text('CRÉDITOS DEL SUR S.A.S', { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#64748B').text('Neiva, Huila | creditos@delsur.co', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#CBD5E1').stroke();
    doc.moveDown(0.5);

    // ── TÍTULO ──
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E293B').text(`${titulo} N° ${prestamo.numeroPrestamo}`, { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#64748B').text(`Fecha: ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'center' });
    if (prestamo.creadoPor) {
      doc.text(`Vendedor: ${prestamo.creadoPor.nombres} ${prestamo.creadoPor.apellidos}`, { align: 'center' });
    }
    doc.moveDown(1);

    // ── DATOS DEL CLIENTE ──
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#08557F').text('DATOS DEL CLIENTE');
    doc.moveDown(0.2);
    doc.rect(50, doc.y, 512, 0.5).fill('#08557F');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#1E293B');
    const cliente = prestamo.cliente;
    if (cliente) {
      doc.text(`Nombre:    ${cliente.nombres} ${cliente.apellidos}`);
      doc.text(`Cédula:    ${cliente.dni || 'N/A'}`);
      doc.text(`Dirección: ${cliente.direccion || 'N/A'}`);
      doc.text(`Teléfono:  ${cliente.telefono || 'N/A'}`);
    }
    doc.moveDown(1);

    // ── ARTÍCULO ──
    if (prestamo.producto) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#08557F').text('ARTÍCULO');
      doc.moveDown(0.2);
      doc.rect(50, doc.y, 512, 0.5).fill('#08557F');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').fillColor('#1E293B');
      doc.text(`Artículo:  ${prestamo.producto.nombre}`);
      if (prestamo.producto.marca) doc.text(`Marca:     ${prestamo.producto.marca}`);
      if (prestamo.producto.modelo) doc.text(`Modelo:    ${prestamo.producto.modelo}`);
      doc.moveDown(1);
    }

    // ── CONDICIONES FINANCIERAS ──
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#08557F').text('CONDICIONES FINANCIERAS');
    doc.moveDown(0.2);
    doc.rect(50, doc.y, 512, 0.5).fill('#08557F');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#1E293B');

    const monto = Number(prestamo.monto);
    const interes = Number(prestamo.interesTotal || 0);
    const total = monto + interes;
    const cuota = prestamo.cantidadCuotas > 0 ? total / prestamo.cantidadCuotas : total;

    doc.text(`Precio / Monto:      $${monto.toLocaleString('es-CO')}`);
    doc.text(`Tasa de interés:     ${prestamo.tasaInteres}%`);
    doc.text(`Interés total:       $${interes.toLocaleString('es-CO')}`);
    doc.font('Helvetica-Bold').text(`TOTAL A PAGAR:       $${total.toLocaleString('es-CO')}`);
    doc.font('Helvetica');
    doc.text(`Plazo:               ${prestamo.cantidadCuotas} cuotas`);
    doc.text(`Frecuencia:          ${prestamo.frecuenciaPago}`);
    doc.text(`Valor cuota:         $${cuota.toLocaleString('es-CO')}`);
    if (prestamo.fechaInicio) doc.text(`Fecha primer pago:   ${new Date(prestamo.fechaInicio).toLocaleDateString('es-CO')}`);
    if (prestamo.fechaFin) doc.text(`Fecha último pago:   ${new Date(prestamo.fechaFin).toLocaleDateString('es-CO')}`);
    doc.moveDown(1);

    // ── TABLA DE AMORTIZACIÓN ──
    if (prestamo.cuotas && prestamo.cuotas.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#08557F').text('TABLA DE AMORTIZACIÓN');
      doc.moveDown(0.2);
      doc.rect(50, doc.y, 512, 0.5).fill('#08557F');
      doc.moveDown(0.3);

      const aCols = [
        { label: 'N°', width: 35 }, { label: 'Fecha Venc.', width: 90 },
        { label: 'Cuota', width: 90 }, { label: 'Estado', width: 80 },
      ];
      let y = doc.y + 3;
      const rowH = 15;
      doc.fontSize(8).font('Helvetica-Bold');
      doc.rect(50, y, aCols.reduce((s, c) => s + c.width, 0), rowH).fill('#08557F');
      let x = 50;
      aCols.forEach(c => { doc.fillColor('white').text(c.label, x + 2, y + 3, { width: c.width - 4 }); x += c.width; });
      y += rowH;

      doc.font('Helvetica').fontSize(8).fillColor('#1E293B');
      const cuotasToShow = prestamo.cuotas.length <= 14
        ? prestamo.cuotas
        : [...prestamo.cuotas.slice(0, 6), null, ...prestamo.cuotas.slice(-1)];

      cuotasToShow.forEach((c: any, i: number) => {
        if (y > 680) { doc.addPage(); y = 50; }
        if (!c) {
          doc.text('...', 50 + 2, y + 3);
          y += rowH;
          return;
        }
        if (i % 2 === 0) { doc.rect(50, y, aCols.reduce((s, cc) => s + cc.width, 0), rowH).fill('#F0F9FF'); doc.fillColor('#1E293B'); }
        x = 50;
        [
          String(c.numeroCuota),
          c.fechaVencimiento ? new Date(c.fechaVencimiento).toLocaleDateString('es-CO') : '',
          `$${Number(c.monto || cuota).toLocaleString('es-CO')}`,
          c.estado || 'PENDIENTE',
        ].forEach((v, ci) => { doc.text(v, x + 2, y + 3, { width: aCols[ci].width - 4 }); x += aCols[ci].width; });
        y += rowH;
      });
      doc.y = y + 10;
    }

    // ── CLÁUSULAS ──
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#08557F').text('CLÁUSULAS');
    doc.moveDown(0.2);
    doc.rect(50, doc.y, 512, 0.5).fill('#08557F');
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica').fillColor('#1E293B');

    doc.text('1. El comprador se compromete a pagar las cuotas en las fechas establecidas. El incumplimiento generará intereses de mora según la tasa máxima legal vigente.');
    doc.text('2. El artículo será entregado al momento de la firma del presente contrato. La propiedad se transfiere al completar el pago total.');
    doc.text('3. En caso de incumplimiento de 3 o más cuotas consecutivas, CRÉDITOS DEL SUR se reserva el derecho de recuperar el artículo.');
    doc.text('4. El comprador declara haber recibido el artículo en perfecto estado y acepta las condiciones aquí estipuladas.');
    doc.moveDown(2);

    // ── FIRMAS ──
    if (doc.y > 620) doc.addPage();
    const firmaY = Math.max(doc.y, 620);
    doc.fontSize(9).font('Helvetica').fillColor('#1E293B');
    doc.text('________________________', 80, firmaY);
    doc.text('COMPRADOR', 80, firmaY + 14);
    doc.text(cliente ? `${cliente.nombres} ${cliente.apellidos}` : '', 80, firmaY + 26);
    doc.text(cliente?.dni ? `C.C. ${cliente.dni}` : '', 80, firmaY + 38);

    doc.text('________________________', 350, firmaY);
    doc.text('VENDEDOR', 350, firmaY + 14);
    doc.text(prestamo.creadoPor ? `${prestamo.creadoPor.nombres} ${prestamo.creadoPor.apellidos}` : '', 350, firmaY + 26);
    doc.text('Créditos del Sur', 350, firmaY + 38);

    doc.end();
    const buffer = await new Promise<Buffer>((resolve) => { doc.on('end', () => resolve(Buffer.concat(buffers))); });

    return {
      data: buffer,
      contentType: 'application/pdf',
      filename: `contrato-${prestamo.numeroPrestamo}-${fecha}.pdf`,
    };
  }

  /**
   * Archivar préstamo como pérdida y agregar cliente a blacklist
   */
  async archiveLoan(prestamoId: string, data: { motivo: string; notas?: string; archivarPorId: string }) {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    });

    if (!prestamo) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    if (prestamo.estado === 'PERDIDA') {
      throw new BadRequestException('Este préstamo ya está archivado como pérdida');
    }

    // Realizar operaciones en transacción
    await this.prisma.$transaction(async (tx) => {
      // 1. Marcar préstamo como PERDIDA
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: {
          estado: 'PERDIDA',
          eliminadoEn: new Date(),
        },
      });

      // 2. Agregar cliente a blacklist
      await tx.cliente.update({
        where: { id: prestamo.clienteId },
        data: {
          enListaNegra: true,
          razonListaNegra: data.motivo,
          fechaListaNegra: new Date(),
          agregadoListaNegraPorId: data.archivarPorId,
          nivelRiesgo: 'LISTA_NEGRA',
        },
      });

      // 3. Registrar en auditoría
      await this.auditService.create({
        usuarioId: data.archivarPorId,
        accion: 'ARCHIVAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamoId,
        datosAnteriores: { estado: prestamo.estado },
        datosNuevos: { estado: 'PERDIDA', motivo: data.motivo },
      });

      // 4. Notificar (opcional - puede fallar si el servicio no tiene el método)
      try {
        await tx.notificacion.create({
          data: {
            usuarioId: data.archivarPorId,
            titulo: 'Cuenta Archivada',
            mensaje: `Préstamo ${prestamo.numeroPrestamo} archivado como pérdida. Cliente ${prestamo.cliente.nombres} ${prestamo.cliente.apellidos} agregado a lista negra.`,
            tipo: 'ALERTA',
            entidad: 'Prestamo',
            entidadId: prestamoId,
          },
        });
      } catch (err) {
        // Ignorar error de notificación
      }
    });

    return {
      message: 'Préstamo archivado exitosamente',
      prestamoId,
      clienteId: prestamo.clienteId,
      montoPerdida: Number(prestamo.saldoPendiente),
    };
  }

  async reprogramarCuota(
    prestamoId: string,
    numeroCuota: number,
    data: {
      motivo: string;
      nuevaFecha: string;
      montoParcial?: number;
      reprogramadoPorId: string;
    }
  ) {
    // Validar que el préstamo exista
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cuotas: true },
    });

    if (!prestamo) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    // Buscar la cuota específica
    const cuota = prestamo.cuotas.find(c => c.numeroCuota === numeroCuota);
    if (!cuota) {
      throw new NotFoundException(`Cuota #${numeroCuota} no encontrada`);
    }

    // Validar que la cuota esté pendiente
    if (cuota.estado !== 'PENDIENTE') {
      throw new BadRequestException('Solo se pueden reprogramar cuotas pendientes');
    }

    // Validar la nueva fecha
    const nuevaFecha = new Date(data.nuevaFecha);
    if (isNaN(nuevaFecha.getTime())) {
      throw new BadRequestException('Fecha inválida');
    }

    // Actualizar la cuota
    const cuotaActualizada = await this.prisma.cuota.update({
      where: { id: cuota.id },
      data: {
        fechaVencimiento: nuevaFecha,
        ...(data.montoParcial && { monto: data.montoParcial }),
        actualizadoEn: new Date(),
      },
    });

    // Registrar auditoría
    await this.auditService.create({
      usuarioId: data.reprogramadoPorId,
      accion: 'REPROGRAMAR_CUOTA',
      entidad: 'Cuota',
      entidadId: cuota.id,
      datosNuevos: {
        prestamoId,
        numeroCuota,
        fechaAnterior: cuota.fechaVencimiento,
        fechaNueva: data.nuevaFecha,
        motivo: data.motivo,
        montoParcial: data.montoParcial,
      },
    });

    // Notificar al cliente (opcional)
    // TODO: Implementar notificación al cliente sobre reprogramación

    this.logger.log(`Cuota #${numeroCuota} del préstamo ${prestamoId} reprogramada a ${data.nuevaFecha}`);

    return {
      mensaje: 'Cuota reprogramada exitosamente',
      cuota: cuotaActualizada,
    };
  }

  /**
   * ADMIN: Corrige cálculos de intereses en préstamos existentes.
   * Recalcula el interés total basándose en Interés Simple Correcto (Capital * Tasa * PlazoMeses / 100).
   * Ajusta el saldo pendiente y distribuye la diferencia en las cuotas pendientes.
   */
  async fixInterestCalculations() {
    this.logger.log('Iniciando corrección masiva de intereses...');
    const results = {
      processed: 0,
      corrected: 0,
      details: [] as string[]
    };

    // 1. Obtener préstamos activos con interés SIMPLE
    const loans = await this.prisma.prestamo.findMany({
      where: {
        tipoAmortizacion: TipoAmortizacion.INTERES_SIMPLE,
        estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA] },
      },
      include: { 
        cuotas: true
      },
    });

    results.processed = loans.length;

    for (const loan of loans) {
      // Ordenar cuotas en memoria para evitar fallos de driver con orderBy en include
      loan.cuotas.sort((a, b) => a.numeroCuota - b.numeroCuota);

      try {
        const capital = Number(loan.monto);
        const tasaMensual = Number(loan.tasaInteres);
        
        // Calcular plazo en meses aproximado si no existe, o usar el guardado
        let plazoMeses = loan.plazoMeses;
        if (!plazoMeses || plazoMeses === 0) {
            const factor = loan.frecuenciaPago === 'MENSUAL' ? 1 : 
                           loan.frecuenciaPago === 'QUINCENAL' ? 2 : 
                           loan.frecuenciaPago === 'SEMANAL' ? 4 : 30;
            plazoMeses = Math.ceil(loan.cantidadCuotas / factor);
        }
        
        // INTERES SIMPLE: I = C * i * t
        const interesCorrecto = Math.round((capital * (tasaMensual / 100) * plazoMeses) * 100) / 100;
        const interesActual = Number(loan.interesTotal);

        // Verificar discrepancia significativa (> $100 pesos)
        if (interesCorrecto > interesActual && (interesCorrecto - interesActual) > 100) {
          const diferenciaInteres = interesCorrecto - interesActual;
          
          this.logger.log(`Corrigiendo Préstamo ${loan.numeroPrestamo}: Interés Actual ${interesActual} -> Nuevo ${interesCorrecto} (Dif: ${diferenciaInteres})`);

          // Calcular deuda total previa y pagado
          const deudaTotalVieja = Number(loan.monto) + Number(loan.interesTotal);
          const pagado = deudaTotalVieja - Number(loan.saldoPendiente);
          
          // Nuevo saldo pendiente (Capital + NuevoInteres - Pagado)
          const nuevoMontoTotal = Number(loan.monto) + interesCorrecto;
          const nuevoSaldoPendiente = nuevoMontoTotal - pagado;

          // Actualizar préstamo
          await this.prisma.prestamo.update({
            where: { id: loan.id },
            data: {
              interesTotal: interesCorrecto,
              saldoPendiente: nuevoSaldoPendiente,
            }
          });

          // Ajustar cuotas NO pagadas totalmente (PENDIENTE, PARCIAL, VENCIDA)
          const cuotasAjustables = loan.cuotas.filter(c => 
            c.estado === 'PENDIENTE' || c.estado === 'PARCIAL' || c.estado === 'VENCIDA'
          );
          
          if (cuotasAjustables.length > 0) {
            const ajustePorCuota = Math.round((diferenciaInteres / cuotasAjustables.length) * 100) / 100;
            
            // Aplicar ajuste
            for (const cuota of cuotasAjustables) {
              await this.prisma.cuota.update({
                where: { id: cuota.id },
                data: {
                  montoInteres: { increment: ajustePorCuota },
                  monto: { increment: ajustePorCuota },
                }
              });
            }
          }

          results.corrected++;
          results.details.push(`Préstamo ${loan.numeroPrestamo}: Ajuste de +${diferenciaInteres}`);
        }
      } catch (error) {
        this.logger.error(`Error corrigiendo préstamo ${loan.numeroPrestamo}: ${error}`);
      }
    }

    return results;
  }
}
