import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import {
  EstadoAprobacion,
  EstadoPrestamo,
  EstadoCuota,
  TipoAprobacion,
  TipoTransaccion,
  FrecuenciaPago,
  TipoAmortizacion,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  async approveItem(id: string, _type: TipoAprobacion, aprobadoPorId?: string, notas?: string, editedData?: any) {
    const approval = await this.prisma.aprobacion.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException('Aprobación no encontrada');
    }

    if (approval.estado !== EstadoAprobacion.PENDIENTE) {
      throw new BadRequestException(`Esta solicitud ya fue procesada (estado: ${approval.estado})`);
    }

    switch (approval.tipoAprobacion) {
      case TipoAprobacion.NUEVO_CLIENTE:
        await this.approveNewClient(approval);
        break;
      case TipoAprobacion.NUEVO_PRESTAMO:
        await this.approveNewLoan(approval, aprobadoPorId, editedData);
        break;
      case TipoAprobacion.GASTO:
        await this.approveExpense(approval, aprobadoPorId);
        break;
      case TipoAprobacion.SOLICITUD_BASE_EFECTIVO:
        await this.approveCashBase(approval, aprobadoPorId);
        break;
      case TipoAprobacion.PRORROGA_PAGO:
        await this.approvePaymentExtension(approval, aprobadoPorId);
        break;
      default:
        throw new BadRequestException('Tipo de aprobación no soportado');
    }

    await this.prisma.aprobacion.update({
      where: { id },
      data: {
        estado: EstadoAprobacion.APROBADO,
        aprobadoPorId: aprobadoPorId || undefined,
        comentarios: notas || undefined,
        datosAprobados: editedData || undefined,
        revisadoEn: new Date(),
      },
    });

    this.logger.log(`Aprobación ${id} procesada por ${aprobadoPorId || 'desconocido'} (tipo: ${approval.tipoAprobacion})`);

    return { success: true, message: 'Aprobación procesada exitosamente' };
  }

  /**
   * Obtener el historial de aprobaciones para una entidad específica
   */
  async getHistory(referenciaId: string, tablaReferencia: string) {
    return this.prisma.aprobacion.findMany({
      where: {
        referenciaId,
        tablaReferencia,
      },
      include: {
        solicitadoPor: {
          select: { nombres: true, apellidos: true }
        },
        aprobadoPor: {
          select: { nombres: true, apellidos: true }
        }
      },
      orderBy: { creadoEn: 'desc' }
    });
  }

  async rejectItem(id: string, _type: TipoAprobacion, rechazadoPorId?: string, motivoRechazo?: string) {
    const approval = await this.prisma.aprobacion.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException('Aprobación no encontrada');
    }

    if (approval.estado !== EstadoAprobacion.PENDIENTE) {
      throw new BadRequestException(`Esta solicitud ya fue procesada (estado: ${approval.estado})`);
    }

    await this.prisma.aprobacion.update({
      where: { id },
      data: {
        estado: EstadoAprobacion.RECHAZADO,
        aprobadoPorId: rechazadoPorId || undefined,
        comentarios: motivoRechazo || 'Rechazado sin motivo especificado',
        revisadoEn: new Date(),
      },
    });

    // Operación específica por tipo de rechazo
    if (approval.tipoAprobacion === TipoAprobacion.NUEVO_PRESTAMO && approval.referenciaId) {
      try {
        await this.prisma.prestamo.update({
          where: { id: approval.referenciaId },
          data: {
            estadoAprobacion: EstadoAprobacion.RECHAZADO,
            aprobadoPorId: rechazadoPorId || undefined,
            eliminadoEn: new Date(), // Oculta el préstamo del listado
          },
        });
      } catch (error) {
        this.logger.error(`Error actualizando préstamo rechazado ${approval.referenciaId}:`, error);
      }
    }

    let nombreRevisor: string | undefined;
    if (rechazadoPorId) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: rechazadoPorId },
        select: { nombres: true, apellidos: true },
      });
      nombreRevisor = usuario ? `${usuario.nombres} ${usuario.apellidos}`.trim() : undefined;
    }
    const datos = (approval.datosSolicitud as any) || {};
    // Notificar al solicitante que su solicitud fue rechazada (con metadata para no mostrar botones y mostrar quién rechazó)
    try {
      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Solicitud Rechazada',
        mensaje: motivoRechazo
          ? `Tu solicitud fue rechazada. Motivo: ${motivoRechazo}`
          : 'Tu solicitud fue rechazada por el administrador.',
        tipo: 'ALERTA',
        entidad: 'Aprobacion',
        entidadId: approval.id,
        metadata: {
          estadoAprobacion: 'RECHAZADO',
          revisadoPor: nombreRevisor,
          descSolicitud: datos.descripcion || datos.motivo,
        },
      });
    } catch {
      // No interrumpir si la notificación falla
    }

    this.logger.log(`Aprobación ${id} rechazada por ${rechazadoPorId || 'desconocido'}`);

    return { success: true, message: 'Aprobación rechazada' };
  }

  private async approveNewClient(approval: any) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    await this.prisma.cliente.create({
      data: {
        dni: data.dni,
        nombres: data.nombres,
        apellidos: data.apellidos,
        telefono: data.telefono,
        direccion: data.direccion,
        correo: data.correo,
        creadoPorId: approval.solicitadoPorId,
        estadoAprobacion: EstadoAprobacion.APROBADO,
        codigo: `CL-${Date.now()}`,
      },
    });
  }

  private async approveNewLoan(approval: any, aprobadoPorId?: string, editedData?: any) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    // Usar datos editados si existen, de lo contrario los originales
    const finalData = editedData || data;

    // Ejecutar en una transacción
    await this.prisma.$transaction(async (tx) => {
      // 1. Activar el préstamo (aplicando cambios si fueron editados)
      const prestamo = await tx.prestamo.update({
        where: { id: approval.referenciaId },
        data: {
          estado: EstadoPrestamo.ACTIVO,
          estadoAprobacion: EstadoAprobacion.APROBADO,
          aprobadoPorId: aprobadoPorId || undefined,
          // Actualizar campos financieros si cambiaron en la revisión
          monto: finalData.monto || finalData.valorArticulo ? Number(finalData.monto || finalData.valorArticulo) : undefined,
          cantidadCuotas: finalData.cuotas || finalData.numCuotas ? Number(finalData.cuotas || finalData.numCuotas) : undefined,
          tasaInteres: finalData.porcentaje !== undefined ? Number(finalData.porcentaje) : undefined,
          frecuenciaPago: finalData.frecuenciaPago || undefined,
          cuotaInicial: finalData.cuotaInicial !== undefined ? Number(finalData.cuotaInicial) : undefined,
          fechaInicio: finalData.fechaInicio ? new Date(finalData.fechaInicio) : undefined,
        },
        include: {
          cliente: {
            include: {
              asignacionesRuta: {
                where: { activa: true },
                take: 1
              }
            }
          }
        }
      });

      // Si se editaron datos financieros, es probable que las cuotas (instancias de Cuota) necesiten ser regeneradas
      // o ajustadas. Para simplificar, si hay cambios, recalculamos los montos.
      if (editedData) {
        // Recalcular componentes financieros del préstamo
        const montoFinanciar = Number(prestamo.monto);
        const tasaInteres = Number(prestamo.tasaInteres);
        const plazoMeses = Number(prestamo.plazoMeses);
        const cantidadCuotas = Number(prestamo.cantidadCuotas);
        const frecuencia = prestamo.frecuenciaPago;
        const tipoAmort = prestamo.tipoAmortizacion;
        const fechaInicio = new Date(prestamo.fechaInicio);

        let interesTotal = 0;
        let cuotasData: any[] = [];

        if (tipoAmort === TipoAmortizacion.FRANCESA) {
          // Usamos la fórmula de amortización francesa (Simplificada para este contexto)
          const tasaMensual = tasaInteres / plazoMeses / 100;
          let tasaPeriodo = tasaMensual;
          if (frecuencia === FrecuenciaPago.DIARIO) tasaPeriodo = tasaMensual / 30;
          else if (frecuencia === FrecuenciaPago.SEMANAL) tasaPeriodo = tasaMensual / 4;
          else if (frecuencia === FrecuenciaPago.QUINCENAL) tasaPeriodo = tasaMensual / 2;

          if (tasaPeriodo === 0) {
              interesTotal = 0;
              const montoCuota = montoFinanciar / cantidadCuotas;
              cuotasData = Array.from({ length: cantidadCuotas }, (_, i) => ({
                  numeroCuota: i + 1,
                  montoCapital: montoCuota,
                  montoInteres: 0,
                  monto: montoCuota
              }));
          } else {
              const cuotaFija = (montoFinanciar * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -cantidadCuotas));
              let saldo = montoFinanciar;
              for (let i = 0; i < cantidadCuotas; i++) {
                  const intPeriodo = saldo * tasaPeriodo;
                  const capPeriodo = i === cantidadCuotas - 1 ? saldo : cuotaFija - intPeriodo;
                  interesTotal += intPeriodo;
                  cuotasData.push({
                      numeroCuota: i + 1,
                      montoCapital: capPeriodo,
                      montoInteres: intPeriodo,
                      monto: capPeriodo + intPeriodo
                  });
                  saldo -= capPeriodo;
              }
          }
        } else {
          // INTERES SIMPLE
          interesTotal = (montoFinanciar * tasaInteres * plazoMeses) / 100;
          const montoTotalSimple = montoFinanciar + interesTotal;
          const montoCuota = cantidadCuotas > 0 ? montoTotalSimple / cantidadCuotas : 0;
          const montoCapitalCuota = cantidadCuotas > 0 ? montoFinanciar / cantidadCuotas : 0;
          const montoInteresCuota = cantidadCuotas > 0 ? interesTotal / cantidadCuotas : 0;
          
          cuotasData = Array.from({ length: cantidadCuotas }, (_, i) => ({
            numeroCuota: i + 1,
            monto: montoCuota,
            montoCapital: montoCapitalCuota,
            montoInteres: montoInteresCuota
          }));
        }

        // Actualizar el préstamo con el nuevo interés calculado y saldo
        await tx.prestamo.update({
            where: { id: prestamo.id },
            data: { 
                interesTotal,
                saldoPendiente: montoFinanciar + interesTotal
            }
        });

        // Eliminar cuotas viejas y crear nuevas para que coincidan con la edición
        await tx.cuota.deleteMany({ where: { prestamoId: prestamo.id } });
        
        // Función auxiliar para calcular fechas (duplicada brevemente aquí para el tx)
        const calcularFecha = (base: Date, num: number, freq: FrecuenciaPago) => {
            const d = new Date(base);
            if (freq === FrecuenciaPago.DIARIO) d.setDate(d.getDate() + num);
            else if (freq === FrecuenciaPago.SEMANAL) d.setDate(d.getDate() + num * 7);
            else if (freq === FrecuenciaPago.QUINCENAL) d.setDate(d.getDate() + num * 15);
            else if (freq === FrecuenciaPago.MENSUAL) d.setMonth(d.getMonth() + num);
            return d;
        };

        await tx.cuota.createMany({
            data: cuotasData.map(c => ({
                prestamoId: prestamo.id,
                numeroCuota: c.numeroCuota,
                monto: c.monto,
                montoCapital: c.montoCapital,
                montoInteres: c.montoInteres,
                fechaVencimiento: calcularFecha(fechaInicio, c.numeroCuota, frecuencia),
                estado: EstadoCuota.PENDIENTE
            }))
        });
      }

      // 2. Buscar la caja de la ruta para registrar el desembolso
      const rutaId = prestamo.cliente?.asignacionesRuta?.[0]?.rutaId;
      if (rutaId) {
        const cajaRuta = await tx.caja.findFirst({
          where: { rutaId, tipo: 'RUTA', activa: true }
        });

        if (cajaRuta) {
          // 3. Crear transacción de egreso (Desembolso)
          await tx.transaccion.create({
            data: {
              numeroTransaccion: `T${Date.now()}`,
              cajaId: cajaRuta.id,
              tipo: TipoTransaccion.EGRESO,
              monto: Number(prestamo.monto),
              descripcion: `Desembolso de préstamo #${prestamo.numeroPrestamo} - Cliente: ${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
              creadoPorId: approval.solicitadoPorId,
              aprobadoPorId: aprobadoPorId || undefined,
              tipoReferencia: 'PRESTAMO',
              referenciaId: prestamo.id,
            },
          });

          // 4. Actualizar saldo de la caja
          await tx.caja.update({
            where: { id: cajaRuta.id },
            data: {
              saldoActual: {
                decrement: prestamo.monto
              }
            }
          });
        }
      }
    });

    try {
      // Notificar al solicitante que su préstamo fue aprobado
      const isArticulo = data.tipo === 'ARTICULO' || data.tipoPrestamo === 'ARTICULO';
      const label = isArticulo ? 'crédito por un artículo' : 'préstamo';

      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Solicitud Aprobada',
        mensaje: `Tu solicitud de ${label} para ${data.cliente || 'el cliente'} ha sido aprobada.`,
        tipo: 'EXITO',
        entidad: 'Prestamo',
        entidadId: approval.referenciaId,
        metadata: {
          estadoAprobacion: 'APROBADO',
          monto: data.monto,
          articulo: data.articulo
        }
      });
    } catch (e) {
      this.logger.error('Error notifying loan approval:', e);
    }
  }

  private async approveExpense(approval: any, aprobadoPorId?: string) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    // Procesar en una transacción de base de datos para asegurar consistencia
    const [gasto] = await this.prisma.$transaction(async (tx) => {
      // 1. Crear el registro de Gasto
      const newGasto = await tx.gasto.create({
        data: {
          numeroGasto: `G${Date.now()}`,
          rutaId: data.rutaId,
          cobradorId: data.cobradorId,
          cajaId: data.cajaId,
          tipoGasto:
            ({
              GASTO_OPERATIVO: 'OPERATIVO',
              OPERATIVO: 'OPERATIVO',
              TRANSPORTE: 'TRANSPORTE',
              OTRO: 'OTRO',
            }[data.tipoGasto] || 'OPERATIVO') as any,
          monto: data.monto,
          descripcion: data.descripcion,
          aprobadoPorId: aprobadoPorId || undefined,
          estadoAprobacion: EstadoAprobacion.APROBADO,
        },
        include: {
          ruta: { select: { id: true, nombre: true } },
          caja: { select: { id: true, nombre: true } },
          cobrador: { select: { id: true, nombres: true, apellidos: true } },
        },
      });

      // 2. Crear la Transacción financiera (Egreso para la caja)
      await tx.transaccion.create({
        data: {
          numeroTransaccion: `T${Date.now()}`,
          cajaId: data.cajaId,
          tipo: TipoTransaccion.EGRESO,
          monto: data.monto,
          descripcion: `Gasto aprobado: ${data.descripcion}`,
          creadoPorId: approval.solicitadoPorId,
          aprobadoPorId: aprobadoPorId || undefined,
          tipoReferencia: 'GASTO',
          referenciaId: newGasto.id,
        },
      });

      // 3. Actualizar Saldo de la Caja
      await tx.caja.update({
        where: { id: data.cajaId },
        data: {
          saldoActual: {
            decrement: data.monto,
          },
        },
      });

      return [newGasto];
    });

    try {
      // Notificar al solicitante que su gasto fue aprobado
      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Tu Gasto fue Aprobado',
        mensaje: `Tu gasto de ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} fue aprobado.`,
        tipo: 'EXITO',
        entidad: 'GASTO',
        entidadId: gasto.id,
      });

      await this.notificacionesService.notifyCoordinator({
        titulo: 'Gasto Aprobado',
        mensaje: `Se aprobó un gasto de ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} en la ruta ${gasto.ruta?.nombre || 'Sin ruta'} (Caja: ${gasto.caja?.nombre || 'N/A'}) por ${gasto.cobrador ? gasto.cobrador.nombres + ' ' + gasto.cobrador.apellidos : 'usuario'}.`,
        tipo: 'SISTEMA',
        entidad: 'GASTO',
        entidadId: gasto.id,
        metadata: {
          rutaId: gasto.ruta?.id,
          cajaId: gasto.caja?.id,
          cobradorId: gasto.cobrador?.id,
        },
      });
    } catch (error) {
      // No interrumpimos el flujo de aprobación si la notificación falla
    }
  }

  private async approveCashBase(approval: any, aprobadoPorId?: string) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    // Procesar en una transacción de base de datos
    const trx = await this.prisma.$transaction(async (tx) => {
      // 1. Buscar la Caja Principal (origen del capital)
      const cajaPrincipal = await tx.caja.findFirst({
        where: { tipo: 'PRINCIPAL', activa: true },
      });

      if (!cajaPrincipal) {
        throw new BadRequestException('No se encontró una Caja Principal activa para entregar la base.');
      }

      const monto = Number(data.monto);

      // 2. Verificar fondos en Caja Principal
      if (Number(cajaPrincipal.saldoActual) < monto) {
        throw new BadRequestException(
          `Fondos insuficientes en la Caja Principal (${cajaPrincipal.nombre}). Saldo actual: ${Number(
            cajaPrincipal.saldoActual,
          ).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
        );
      }

      // 3. Crear transacción de salida (EGRESO) desde la Caja Principal
      await tx.transaccion.create({
        data: {
          numeroTransaccion: `TRX-OUT-${Date.now()}`,
          cajaId: cajaPrincipal.id,
          tipo: TipoTransaccion.EGRESO,
          monto: monto,
          descripcion: `Entrega de base operativa a Ruta (Caja ID: ${data.cajaId}) - Solicitud #${approval.id}`,
          creadoPorId: aprobadoPorId || approval.solicitadoPorId,
          aprobadoPorId: aprobadoPorId || undefined,
          tipoReferencia: 'SOLICITUD_BASE',
          referenciaId: approval.id,
        },
      });

      // 4. Actualizar Saldo de la Caja Principal
      await tx.caja.update({
        where: { id: cajaPrincipal.id },
        data: {
          saldoActual: {
            decrement: monto,
          },
        },
      });

      // 5. Crear transacción de ingreso a la caja de ruta (The target cash box)
      const newTrx = await tx.transaccion.create({
        data: {
          numeroTransaccion: `TRX-IN-${Date.now()}`,
          cajaId: data.cajaId,
          tipo: TipoTransaccion.INGRESO,
          monto: monto,
          descripcion: `Base de efectivo recibida - ${data.descripcion}`,
          creadoPorId: approval.solicitadoPorId,
          aprobadoPorId: aprobadoPorId || undefined,
          tipoReferencia: 'SOLICITUD_BASE',
          referenciaId: approval.id,
        },
      });

      // 6. Actualizar Saldo de la Caja de Ruta
      await tx.caja.update({
        where: { id: data.cajaId },
        data: {
          saldoActual: {
            increment: monto,
          },
        },
      });

      return newTrx;
    });

    try {
      await this.notificacionesService.notifyCoordinator({
        titulo: 'Base de Efectivo Aprobada',
        mensaje: `Se aprobó una base de efectivo por ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}.`,
        tipo: 'SISTEMA',
        entidad: 'TRANSACCION',
        entidadId: trx.id,
        metadata: {
          cajaId: data.cajaId,
          monto: data.monto,
          solicitadoPorId: approval.solicitadoPorId,
          aprobadoPorId: aprobadoPorId,
        },
      });
      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Tu Solicitud de Base fue Aprobada',
        mensaje: `Tu solicitud por ${Number(data.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} fue aprobada.`,
        tipo: 'EXITO',
        entidad: 'TRANSACCION',
        entidadId: trx.id,
        metadata: {
          cajaId: data.cajaId,
        },
      });
    } catch (error) {
      // No interrumpimos el flujo si la notificación falla
    }
  }

  private async approvePaymentExtension(approval: any, aprobadoPorId?: string) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    // Usar una transacción para asegurar que tanto la extensión como la cuota se actualicen
    await this.prisma.$transaction(async (tx) => {
      // 1. Crear el registro de extensión
      const extension = await tx.extensionPago.create({
        data: {
          prestamoId: data.prestamoId,
          cuotaId: data.cuotaId,
          fechaVencimientoOriginal: new Date(data.fechaVencimientoOriginal),
          nuevaFechaVencimiento: new Date(data.nuevaFechaVencimiento),
          razon: data.razon,
          aprobadoPorId: aprobadoPorId || approval.solicitadoPorId,
        },
      });

      // 2. Vincular la extensión a la cuota y actualizar su fecha de prorroga
      if (data.cuotaId) {
        await tx.cuota.update({
          where: { id: data.cuotaId },
          data: {
            fechaVencimientoProrroga: new Date(data.nuevaFechaVencimiento),
            extensionId: extension.id,
          },
        });
      }

      // 3. Opcionalmente marcar el préstamo con algún flag de prórroga si fuera necesario
    });
  }
}
