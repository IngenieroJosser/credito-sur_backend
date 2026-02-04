import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { EstadoAprobacion } from '@prisma/client';
import { PrestamosMoraFiltrosDto, TotalesMoraDto, PrestamoMoraDto } from './dto/prestamo-mora.dto';
import { PrestamosMoraResponseDto } from './dto/responses.dto';
import { 
  startOfDay,
  endOfDay,
  differenceInDays,
  format 
} from 'date-fns';
import { 
  TotalesVencidasDto, 
  DecisionCastigoDto, 
  CuentasVencidasFiltrosDto, 
  CuentaVencidaDto 
} from './dto/cuentas-vencidas.dto';
import { CuentasVencidasResponseDto } from './dto/responses-cuentas-vencidas.dto';
import { TipoAprobacion, EstadoPrestamo } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinancialSummary(startDate: Date, endDate: Date) {
    const ingresosResult = await this.prisma.pago.aggregate({
      _sum: { montoTotal: true },
      where: {
        fechaPago: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const egresosResult = await this.prisma.gasto.aggregate({
      _sum: { monto: true },
      where: {
        fechaGasto: {
          gte: startDate,
          lte: endDate,
        },
        estadoAprobacion: EstadoAprobacion.APROBADO,
      },
    });

    const ingresos = Number(ingresosResult._sum.montoTotal || 0);
    const egresos = Number(egresosResult._sum.monto || 0);
    const utilidad = ingresos - egresos;
    const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;

    return {
      ingresos,
      egresos,
      utilidad,
      margen: Number(margen.toFixed(2)),
    };
  }

  async getMonthlyEvolution(year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const pagos = await this.prisma.pago.findMany({
      where: {
        fechaPago: { gte: startOfYear, lte: endOfYear },
      },
      select: { fechaPago: true, montoTotal: true },
    });

    const gastos = await this.prisma.gasto.findMany({
      where: {
        fechaGasto: { gte: startOfYear, lte: endOfYear },
        estadoAprobacion: EstadoAprobacion.APROBADO,
      },
      select: { fechaGasto: true, monto: true },
    });

    const months = Array.from({ length: 12 }, (_, i) => ({
      mes: new Date(year, i).toLocaleString('es-ES', { month: 'short' }),
      ingresos: 0,
      egresos: 0,
      utilidad: 0,
    }));

    pagos.forEach((p) => {
      const month = p.fechaPago.getMonth();
      months[month].ingresos += Number(p.montoTotal);
    });

    gastos.forEach((g) => {
      const month = g.fechaGasto.getMonth();
      months[month].egresos += Number(g.monto);
    });

    months.forEach((m) => {
      m.utilidad = m.ingresos - m.egresos;
    });

    return months;
  }

  async getExpenseDistribution(startDate: Date, endDate: Date) {
    const gastos = await this.prisma.gasto.groupBy({
      by: ['tipoGasto'],
      _sum: { monto: true },
      where: {
        fechaGasto: { gte: startDate, lte: endDate },
        estadoAprobacion: EstadoAprobacion.APROBADO,
      },
    });

    return gastos.map((g) => ({
      categoria: g.tipoGasto,
      monto: Number(g._sum.monto || 0),
    }));
  }

  async obtenerPrestamosEnMora(
    filtros: PrestamosMoraFiltrosDto,
    pagina: number = 1,
    limite: number = 50
  ): Promise<PrestamosMoraResponseDto> {
    const skip = (pagina - 1) * limite;
    
    const whereConditions: any = {
      estado: 'EN_MORA',
      cuotas: {
        some: {
          estado: 'VENCIDA'
        }
      }
    };

    // Aplicar filtros
    if (filtros.busqueda) {
      whereConditions.OR = [
        {
          cliente: {
            nombres: {
              contains: filtros.busqueda,
              mode: 'insensitive'
            }
          }
        },
        {
          cliente: {
            apellidos: {
              contains: filtros.busqueda,
              mode: 'insensitive'
            }
          }
        },
        {
          cliente: {
            dni: {
              contains: filtros.busqueda,
              mode: 'insensitive'
            }
          }
        },
        {
          numeroPrestamo: {
            contains: filtros.busqueda,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (filtros.nivelRiesgo) {
      whereConditions.cliente = {
        ...whereConditions.cliente,
        nivelRiesgo: filtros.nivelRiesgo
      };
    }

    if (filtros.rutaId) {
      const clientesRuta = await this.prisma.asignacionRuta.findMany({
        where: {
          rutaId: filtros.rutaId,
          activa: true
        },
        select: { clienteId: true }
      });
      
      const clienteIds = clientesRuta.map(cr => cr.clienteId);
      whereConditions.clienteId = { in: clienteIds };
    }

    if (filtros.cobradorId) {
      const rutasCobrador = await this.prisma.ruta.findMany({
        where: {
          cobradorId: filtros.cobradorId,
          activa: true
        },
        select: { id: true }
      });
      
      const rutaIds = rutasCobrador.map(rc => rc.id);
      const clientesRuta = await this.prisma.asignacionRuta.findMany({
        where: {
          rutaId: { in: rutaIds },
          activa: true
        },
        select: { clienteId: true }
      });
      
      const clienteIds = clientesRuta.map(cr => cr.clienteId);
      whereConditions.clienteId = { in: clienteIds };
    }

    // Obtener total de registros
    const total = await this.prisma.prestamo.count({
      where: whereConditions
    });

    // Obtener préstamos con relaciones
    const prestamos = await this.prisma.prestamo.findMany({
      where: whereConditions,
      skip,
      take: limite,
      include: {
        cliente: true,
        cuotas: {
          where: {
            estado: 'VENCIDA'
          },
          orderBy: {
            fechaVencimiento: 'asc'
          }
        },
        pagos: {
          orderBy: {
            fechaPago: 'desc'
          },
          take: 1
        }
      },
      orderBy: [
        {
          cliente: {
            nivelRiesgo: 'desc'
          }
        },
        {
          saldoPendiente: 'desc'
        }
      ]
    });

    // Enriquecer datos con información de ruta y cobrador
    const prestamosEnriquecidos = await Promise.all(
      prestamos.map(async (prestamo) => {
        // Obtener asignación de ruta activa del cliente
        const asignacion = await this.prisma.asignacionRuta.findFirst({
          where: {
            clienteId: prestamo.clienteId,
            activa: true
          },
          include: {
            ruta: {
              include: {
                cobrador: true
              }
            }
          }
        });

        // Calcular días de mora (desde la primera cuota vencida)
        const primeraCuotaVencida = prestamo.cuotas[0];
        const diasMora = primeraCuotaVencida 
          ? differenceInDays(new Date(), primeraCuotaVencida.fechaVencimiento)
          : 0;

        // Calcular monto de mora (suma de intereses de mora de cuotas vencidas)
        const montoMora = prestamo.cuotas.reduce((sum, cuota) => 
          sum + cuota.montoInteresMora.toNumber(), 0
        );

        // Obtener último pago
        const ultimoPago = prestamo.pagos[0];
        
        return {
          id: prestamo.id,
          numeroPrestamo: prestamo.numeroPrestamo,
          cliente: {
            nombre: `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
            documento: prestamo.cliente.dni,
            telefono: prestamo.cliente.telefono,
            direccion: prestamo.cliente.direccion || ''
          },
          diasMora,
          montoMora,
          montoTotalDeuda: prestamo.saldoPendiente.toNumber(),
          cuotasVencidas: prestamo.cuotas.length,
          ruta: asignacion?.ruta?.nombre || 'Sin asignar',
          cobrador: asignacion?.ruta?.cobrador 
            ? `${asignacion.ruta.cobrador.nombres} ${asignacion.ruta.cobrador.apellidos}`
            : 'Sin asignar',
          nivelRiesgo: prestamo.cliente.nivelRiesgo,
          estado: prestamo.estado,
          ultimoPago: ultimoPago 
            ? format(ultimoPago.fechaPago, 'yyyy-MM-dd')
            : undefined
        } as PrestamoMoraDto;
      })
    );

    // Calcular totales
    const totalMora = prestamosEnriquecidos.reduce((sum, p) => sum + p.montoMora, 0);
    const totalDeuda = prestamosEnriquecidos.reduce((sum, p) => sum + p.montoTotalDeuda, 0);
    const totalCasosCriticos = prestamosEnriquecidos.filter(
      p => p.nivelRiesgo === 'ROJO' || p.nivelRiesgo === 'LISTA_NEGRA'
    ).length;

    const totales: TotalesMoraDto = {
      totalMora,
      totalDeuda,
      totalCasosCriticos,
      totalRegistros: total
    };

    return {
      prestamos: prestamosEnriquecidos,
      totales,
      total,
      pagina,
      limite
    };
  }

  async generarReporteMora(filtros: PrestamosMoraFiltrosDto, formato: 'excel' | 'pdf') {
    const data = await this.obtenerPrestamosEnMora(filtros, 1, 1000);
    
    // Aquí implementarías la generación del archivo Excel o PDF
    // Por ahora retornamos los datos en el formato solicitado
    return {
      mensaje: `Reporte generado en formato ${formato.toUpperCase()}`,
      datos: data.prestamos,
      totales: data.totales,
      fechaGeneracion: new Date().toISOString()
    };
  }

  async obtenerEstadisticasMora() {
    const hoy = new Date();
    
    const [
      totalPrestamosMora,
      prestamosRojos,
      prestamosListaNegra,
      moraAcumulada,
      deudaTotal
    ] = await Promise.all([
      this.prisma.prestamo.count({
        where: { estado: 'EN_MORA' }
      }),
      this.prisma.prestamo.count({
        where: {
          estado: 'EN_MORA',
          cliente: {
            nivelRiesgo: 'ROJO'
          }
        }
      }),
      this.prisma.prestamo.count({
        where: {
          estado: 'EN_MORA',
          cliente: {
            nivelRiesgo: 'LISTA_NEGRA'
          }
        }
      }),
      this.prisma.cuota.aggregate({
        where: {
          estado: 'VENCIDA',
          prestamo: {
            estado: 'EN_MORA'
          }
        },
        _sum: {
          montoInteresMora: true
        }
      }),
      this.prisma.prestamo.aggregate({
        where: { estado: 'EN_MORA' },
        _sum: {
          saldoPendiente: true
        }
      })
    ]);

    return {
      totalPrestamosMora,
      casosCriticos: prestamosRojos + prestamosListaNegra,
      moraAcumulada: moraAcumulada._sum.montoInteresMora?.toNumber() || 0,
      deudaTotal: deudaTotal._sum.saldoPendiente?.toNumber() || 0
    };
  }

  async obtenerCuentasVencidas(
    filtros: CuentasVencidasFiltrosDto,
    pagina: number = 1,
    limite: number = 50
  ): Promise<CuentasVencidasResponseDto> {
    const skip = (pagina - 1) * limite;
    const hoy = new Date();
    
    const whereConditions: any = {
      fechaFin: { lt: hoy },
      estado: { in: ['EN_MORA', 'INCUMPLIDO', 'PERDIDA'] },
      saldoPendiente: { gt: 0 }
    };

    // Aplicar filtros
    if (filtros.busqueda) {
      whereConditions.OR = [
        {
          cliente: {
            nombres: {
              contains: filtros.busqueda,
              mode: 'insensitive'
            }
          }
        },
        {
          cliente: {
            apellidos: {
              contains: filtros.busqueda,
              mode: 'insensitive'
            }
          }
        },
        {
          cliente: {
            dni: {
              contains: filtros.busqueda,
              mode: 'insensitive'
            }
          }
        },
        {
          numeroPrestamo: {
            contains: filtros.busqueda,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (filtros.nivelRiesgo) {
      whereConditions.cliente = {
        ...whereConditions.cliente,
        nivelRiesgo: filtros.nivelRiesgo
      };
    }

    if (filtros.rutaId) {
      const clientesRuta = await this.prisma.asignacionRuta.findMany({
        where: {
          rutaId: filtros.rutaId,
          activa: true
        },
        select: { clienteId: true }
      });
      
      const clienteIds = clientesRuta.map(cr => cr.clienteId);
      whereConditions.clienteId = { in: clienteIds };
    }

    // Obtener total de registros
    const total = await this.prisma.prestamo.count({
      where: whereConditions
    });

    // Obtener préstamos con relaciones
    const prestamos = await this.prisma.prestamo.findMany({
      where: whereConditions,
      skip,
      take: limite,
      include: {
        cliente: true,
        cuotas: {
          where: {
            estado: 'VENCIDA'
          }
        }
      },
      orderBy: [
        {
          fechaFin: 'asc'
        },
        {
          saldoPendiente: 'desc'
        }
      ]
    });

    // Enriquecer datos con información de ruta y cobrador
    const cuentasVencidas = await Promise.all(
      prestamos.map(async (prestamo) => {
        // Obtener asignación de ruta activa del cliente
        const asignacion = await this.prisma.asignacionRuta.findFirst({
          where: {
            clienteId: prestamo.clienteId,
            activa: true
          },
          include: {
            ruta: {
              include: {
                cobrador: true
              }
            }
          }
        });

        // Calcular días vencidos (desde fechaFin)
        const diasVencidos = differenceInDays(hoy, prestamo.fechaFin);

        // Sumar cuotas vencidas para intereses de mora
        const interesesMora = prestamo.cuotas.reduce((sum, cuota) => 
          sum + cuota.montoInteresMora.toNumber(), 0
        );

        return {
          id: prestamo.id,
          numeroPrestamo: prestamo.numeroPrestamo,
          cliente: {
            nombre: `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
            documento: prestamo.cliente.dni,
            telefono: prestamo.cliente.telefono,
            direccion: prestamo.cliente.direccion || ''
          },
          fechaVencimiento: format(prestamo.fechaFin, 'yyyy-MM-dd'),
          diasVencidos,
          saldoPendiente: prestamo.saldoPendiente.toNumber(),
          montoOriginal: prestamo.monto.toNumber(),
          ruta: asignacion?.ruta?.nombre || 'Sin asignar',
          nivelRiesgo: prestamo.cliente.nivelRiesgo,
          estado: prestamo.estado,
          interesesMora
        } as CuentaVencidaDto & { interesesMora: number };
      })
    );

    // Calcular totales
    const totalVencido = cuentasVencidas.reduce((sum, c) => sum + c.saldoPendiente, 0);
    const totalDiasVencidos = cuentasVencidas.reduce((sum, c) => sum + c.diasVencidos, 0);
    const diasPromedioVencimiento = cuentasVencidas.length > 0 
      ? Math.round(totalDiasVencidos / cuentasVencidas.length) 
      : 0;

    const totales: TotalesVencidasDto = {
      totalVencido,
      totalRegistros: total,
      diasPromedioVencimiento
    };

    return {
      cuentas: cuentasVencidas,
      totales,
      total,
      pagina,
      limite
    };
  }

  async procesarDecisionCastigo(decisionDto: DecisionCastigoDto, usuarioId: string) {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: decisionDto.prestamoId },
      include: { cliente: true }
    });

    if (!prestamo) {
      throw new Error('Préstamo no encontrado');
    }

    // Crear registro de aprobación
    const aprobacion = await this.prisma.aprobacion.create({
      data: {
        tipoAprobacion: TipoAprobacion.BAJA_POR_PERDIDA,
        referenciaId: decisionDto.prestamoId,
        tablaReferencia: 'Prestamo',
        solicitadoPorId: usuarioId,
        datosSolicitud: {
          decision: decisionDto.decision,
          montoInteres: decisionDto.montoInteres || 0,
          comentarios: decisionDto.comentarios,
          nuevaFechaVencimiento: decisionDto.nuevaFechaVencimiento,
          prestamoId: decisionDto.prestamoId,
          clienteNombre: `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
          saldoPendiente: prestamo.saldoPendiente.toNumber(),
          fechaVencimientoOriginal: prestamo.fechaFin
        },
        montoSolicitud: decisionDto.montoInteres || 0
      }
    });

    // Actualizar estado del préstamo según la decisión
    let nuevoEstado: EstadoPrestamo = prestamo.estado;
    
    switch (decisionDto.decision) {
      case 'CASTIGAR':
        nuevoEstado = 'PERDIDA';
        break;
      case 'JURIDICO':
        nuevoEstado = 'INCUMPLIDO';
        break;
      case 'PRORROGAR':
        if (decisionDto.nuevaFechaVencimiento) {
          // Actualizar fecha de vencimiento del préstamo
          await this.prisma.prestamo.update({
            where: { id: decisionDto.prestamoId },
            data: {
              fechaFin: new Date(decisionDto.nuevaFechaVencimiento),
              estado: 'EN_MORA'
            }
          });
        }
        break;
    }

    if (decisionDto.decision !== 'PRORROGAR') {
      await this.prisma.prestamo.update({
        where: { id: decisionDto.prestamoId },
        data: { estado: nuevoEstado }
      });
    }

    // Si hay interés de mora, actualizar las cuotas
    if (decisionDto.montoInteres && decisionDto.montoInteres > 0) {
      const cuotasVencidas = await this.prisma.cuota.findMany({
        where: {
          prestamoId: decisionDto.prestamoId,
          estado: 'VENCIDA'
        }
      });

      // Distribuir el interés entre las cuotas vencidas
      const interesPorCuota = decisionDto.montoInteres / cuotasVencidas.length;
      
      for (const cuota of cuotasVencidas) {
        await this.prisma.cuota.update({
          where: { id: cuota.id },
          data: {
            montoInteresMora: { increment: interesPorCuota }
          }
        });
      }
    }

    return {
      mensaje: `Decisión de ${decisionDto.decision.toLowerCase()} procesada exitosamente`,
      aprobacionId: aprobacion.id,
      nuevoEstado
    };
  }

  async exportarCuentasVencidas(formato: 'excel' | 'pdf', filtros: CuentasVencidasFiltrosDto) {
    const data = await this.obtenerCuentasVencidas(filtros, 1, 1000);
    
    // Simular generación de archivo (en producción usarías librerías como exceljs o pdfkit)
    return {
      mensaje: `Reporte de cuentas vencidas generado en formato ${formato.toUpperCase()}`,
      datos: data.cuentas,
      totales: data.totales,
      fechaGeneracion: new Date().toISOString(),
      nombreArchivo: `cuentas-vencidas-${format(new Date(), 'yyyy-MM-dd')}.${formato}`
    };
  }
}
