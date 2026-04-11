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
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private notificacionesGateway: NotificacionesGateway,
  ) {}

  private async notifyCobradorGestionVencida(params: {
    prestamoId: string;
    titulo: string;
    mensaje: string;
    tipo?: string;
    metadata?: any;
  }) {
    try {
      const asignacion = await this.prisma.asignacionRuta.findFirst({
        where: { cliente: { prestamos: { some: { id: params.prestamoId } } }, activa: true },
        select: { ruta: { select: { cobradorId: true } } },
      });

      const cobradorId = asignacion?.ruta?.cobradorId;
      if (!cobradorId) return;

      await this.notificacionesService.create({
        usuarioId: cobradorId,
        titulo: params.titulo,
        mensaje: params.mensaje,
        tipo: params.tipo || 'SISTEMA',
        entidad: 'Prestamo',
        entidadId: params.prestamoId,
        metadata: {
          ...(params.metadata || {}),
          prestamoId: params.prestamoId,
        },
      });
    } catch (e) {
      this.logger.warn('No se pudo notificar al cobrador por gestión vencida', e as any);
    }
  }

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
      case TipoAprobacion.BAJA_POR_PERDIDA:
        await this.approveLoanLoss(approval, aprobadoPorId, editedData);
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

    this.notificacionesGateway.broadcastAprobacionesActualizadas({
      accion: 'APROBAR',
      aprobacionId: id,
      tipoAprobacion: approval.tipoAprobacion,
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

  /**
   * Obtener todas las aprobaciones pendientes agrupadas por tipo.
   * Incluye datos del solicitante y montos para el módulo de Revisiones.
   */
  async getPendingApprovals(tipo?: TipoAprobacion) {
    const where: any = { estado: EstadoAprobacion.PENDIENTE };
    if (tipo) where.tipoAprobacion = tipo;

    const pendientes = await this.prisma.aprobacion.findMany({
      where,
      include: {
        solicitadoPor: {
          select: { id: true, nombres: true, apellidos: true, rol: true }
        },
        aprobadoPor: {
          select: { id: true, nombres: true, apellidos: true }
        }
      },
      orderBy: { creadoEn: 'desc' }
    });

    const grouped: Record<string, any[]> = {};
    const conteo: Record<string, number> = {};

    for (const item of pendientes) {
      const key = item.tipoAprobacion;
      if (!grouped[key]) {
        grouped[key] = [];
        conteo[key] = 0;
      }
      
      const datos = typeof item.datosSolicitud === 'string'
        ? JSON.parse(item.datosSolicitud)
        : item.datosSolicitud;

      grouped[key].push({
        ...item,
        datosSolicitud: datos,
        solicitante: item.solicitadoPor
          ? `${item.solicitadoPor.nombres} ${item.solicitadoPor.apellidos}`.trim()
          : 'Desconocido',
        rolSolicitante: item.solicitadoPor?.rol || 'N/A',
      });
      conteo[key]++;
    }

    return {
      total: pendientes.length,
      conteo,
      items: grouped,
    };
  }

  /**
   * Obtener items rechazados que necesitan revisión final del SuperAdmin.
   */
  async getSuperadminReviewItems() {
    const rechazados = await this.prisma.aprobacion.findMany({
      where: {
        estado: EstadoAprobacion.RECHAZADO,
        revisadoEn: {
          gte: new Date(Date.now() - 72 * 60 * 60 * 1000),
        },
      },
      include: {
        solicitadoPor: {
          select: { id: true, nombres: true, apellidos: true, rol: true }
        },
        aprobadoPor: {
          select: { id: true, nombres: true, apellidos: true, rol: true }
        }
      },
      orderBy: { revisadoEn: 'desc' },
    });

    return {
      total: rechazados.length,
      items: rechazados.map((item) => {
        const datos = typeof item.datosSolicitud === 'string'
          ? JSON.parse(item.datosSolicitud)
          : item.datosSolicitud;

        return {
          ...item,
          datosSolicitud: datos,
          solicitante: item.solicitadoPor
            ? `${item.solicitadoPor.nombres} ${item.solicitadoPor.apellidos}`.trim()
            : 'Desconocido',
          rechazadoPor: item.aprobadoPor
            ? `${item.aprobadoPor.nombres} ${item.aprobadoPor.apellidos}`.trim()
            : 'Desconocido',
          rolRechazador: item.aprobadoPor?.rol || 'N/A',
        };
      }),
    };
  }

  /**
   * Confirmar o revertir un rechazo (decisión final del SuperAdmin).
   */
  async confirmSuperadminAction(id: string, accion: 'CONFIRMAR' | 'REVERTIR', userId: string, notas?: string) {
    const approval = await this.prisma.aprobacion.findUnique({ where: { id } });
    
    if (!approval) {
      throw new NotFoundException('Aprobación no encontrada');
    }

    if (accion === 'CONFIRMAR') {
      await this.prisma.aprobacion.update({
        where: { id },
        data: {
          estado: EstadoAprobacion.CANCELADO,
          comentarios: notas
            ? `[SuperAdmin] Eliminación confirmada: ${notas}`
            : `[SuperAdmin] Eliminación confirmada`,
        },
      });

      this.notificacionesGateway.broadcastAprobacionesActualizadas({
        accion: 'CONFIRMAR',
        aprobacionId: id,
        tipoAprobacion: approval.tipoAprobacion,
      });

      return { success: true, message: 'Eliminación confirmada por el SuperAdministrador' };
    } else {
      await this.prisma.aprobacion.update({
        where: { id },
        data: {
          estado: EstadoAprobacion.PENDIENTE,
          aprobadoPorId: null,
          revisadoEn: null,
          comentarios: notas
            ? `[SuperAdmin] Revertido a pendiente: ${notas}`
            : `[SuperAdmin] Revertido a pendiente para re-evaluación`,
        },
      });

      this.notificacionesGateway.broadcastAprobacionesActualizadas({
        accion: 'REVERTIR',
        aprobacionId: id,
        tipoAprobacion: approval.tipoAprobacion,
      });

      if (approval.tipoAprobacion === TipoAprobacion.NUEVO_PRESTAMO && approval.referenciaId) {
        try {
          const prestamoRevertido = await this.prisma.prestamo.update({
            where: { id: approval.referenciaId },
            data: { estadoAprobacion: EstadoAprobacion.PENDIENTE, eliminadoEn: null },
            include: { producto: true }
          });

          // CORRECCIÓN: Volver a reservar el stock porque la solicitud vuelve a evaluación
          if (prestamoRevertido.productoId && prestamoRevertido.producto?.stock !== undefined && prestamoRevertido.producto?.stock !== null) {
            try {
               await this.prisma.producto.update({
                 where: { id: prestamoRevertido.productoId },
                 data: { stock: { decrement: 1 } } // Decrementamos porque vuelve a reservarse
               });
            } catch(e) {}
          }
        } catch (error) {
          this.logger.error(`Error revirtiendo préstamo ${approval.referenciaId}:`, error);
        }
      } else if (approval.tipoAprobacion === TipoAprobacion.NUEVO_CLIENTE && approval.referenciaId) {
        try {
          await this.prisma.cliente.update({
            where: { id: approval.referenciaId },
            data: { estadoAprobacion: EstadoAprobacion.PENDIENTE, eliminadoEn: null },
          });
        } catch (error) {
          this.logger.error(`Error revirtiendo cliente ${approval.referenciaId}:`, error);
        }
      }

      try {
        await this.notificacionesService.create({
          usuarioId: approval.solicitadoPorId,
          titulo: 'Solicitud Restaurada',
          mensaje: 'Tu solicitud fue restaurada a estado pendiente por el SuperAdministrador para re-evaluación.',
          tipo: 'SISTEMA',
          entidad: 'Aprobacion',
          entidadId: approval.id,
        });
      } catch { /* no interrumpir */ }

      return { success: true, message: 'Solicitud restaurada a pendiente para re-evaluación' };
    }
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

    if (approval.tipoAprobacion === TipoAprobacion.PRORROGA_PAGO) {
      try {
        const data =
          typeof approval.datosSolicitud === 'string'
            ? JSON.parse(approval.datosSolicitud)
            : approval.datosSolicitud;

        if (data?.tipo === 'GESTION_VENCIDA' && data?.prestamoId) {
          const nombreCliente = data?.clienteNombre || data?.cliente || 'Cliente';
          const numeroPrestamo = data?.numeroPrestamo || '';
          const decision = (data?.decision as string) || 'PRORROGAR';
          const fechaOriginal = data?.fechaVencimientoOriginal ? new Date(data.fechaVencimientoOriginal) : null;

          if (fechaOriginal && !isNaN(fechaOriginal.getTime())) {
            try {
              await this.prisma.prestamo.update({
                where: { id: data.prestamoId },
                data: { fechaFin: fechaOriginal },
              });
              this.notificacionesGateway.broadcastPrestamosActualizados({
                accion: 'REVERTIR_PRORROGA',
                prestamoId: data.prestamoId,
              });
            } catch {
              // no interrumpir
            }
          }
          await this.notifyCobradorGestionVencida({
            prestamoId: data.prestamoId,
            titulo: `Gestión de cuenta vencida rechazada — ${nombreCliente}${numeroPrestamo ? ` (${numeroPrestamo})` : ''}`,
            mensaje: `La solicitud de ${decision === 'DEJAR_QUIETO' ? 'dejar quieto' : 'prórroga'} fue rechazada.${motivoRechazo ? ` Motivo: ${motivoRechazo}` : ''}`,
            tipo: 'ADVERTENCIA',
            metadata: {
              tipo: 'GESTION_VENCIDA',
              decision,
              aprobado: false,
              motivoRechazo: motivoRechazo || undefined,
              rechazadoPorId,
              aprobacionId: approval.id,
            },
          });
        }
      } catch {
        // no interrumpir
      }
    }

    this.notificacionesGateway.broadcastAprobacionesActualizadas({
      accion: 'RECHAZAR',
      aprobacionId: id,
      tipoAprobacion: approval.tipoAprobacion,
    });

    // Operación específica por tipo de rechazo
    if (approval.tipoAprobacion === TipoAprobacion.NUEVO_PRESTAMO && approval.referenciaId) {
      try {
        const prestamoRechazado = await this.prisma.prestamo.update({
          where: { id: approval.referenciaId },
          data: {
            estadoAprobacion: EstadoAprobacion.RECHAZADO,
            aprobadoPorId: rechazadoPorId || undefined,
            eliminadoEn: new Date(), // Oculta el préstamo del listado
          },
          include: {
            producto: true,
          }
        });

        // CORRECCIÓN: Restablecer stock si el préstamo incluye un artículo físico (stock !== undefined)
        if (prestamoRechazado.productoId && prestamoRechazado.producto?.stock !== undefined && prestamoRechazado.producto?.stock !== null) {
          try {
             await this.prisma.producto.update({
               where: { id: prestamoRechazado.productoId },
               data: { stock: { increment: 1 } }
             });
          } catch(e) {
            this.logger.error(`Error devolviendo stock al rechazar el préstamo ${approval.referenciaId}:`, e);
          }
        }
      } catch (error) {
        this.logger.error(`Error actualizando préstamo rechazado ${approval.referenciaId}:`, error);
      }
    } else if (approval.tipoAprobacion === TipoAprobacion.NUEVO_CLIENTE && approval.referenciaId) {
      try {
        await this.prisma.cliente.update({
          where: { id: approval.referenciaId },
          data: {
            estadoAprobacion: EstadoAprobacion.RECHAZADO,
            aprobadoPorId: rechazadoPorId || undefined,
            eliminadoEn: new Date(), // Oculta el cliente del listado
          },
        });
      } catch (error) {
        this.logger.error(`Error actualizando cliente rechazado ${approval.referenciaId}:`, error);
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

    // El cliente ya existe con estado PENDIENTE, lo actualizamos a APROBADO
    const cliente = await this.prisma.cliente.update({
      where: { id: approval.referenciaId },
      data: {
        estadoAprobacion: EstadoAprobacion.APROBADO,
        // Sincronizar otros campos por si hubo ediciones en la aprobación
        dni: data.dni,
        nombres: data.nombres,
        apellidos: data.apellidos,
        telefono: data.telefono,
        direccion: data.direccion,
        correo: data.correo,
        referencia: data.referencia,
        referencia1Nombre: data.referencia1Nombre,
        referencia1Telefono: data.referencia1Telefono,
        referencia2Nombre: data.referencia2Nombre,
        referencia2Telefono: data.referencia2Telefono,
      },
    });

    this.notificacionesGateway.broadcastClientesActualizados({
      accion: 'ACTUALIZAR',
      clienteId: cliente.id,
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
      const isArticulo = String((finalData as any)?.tipo || '').toUpperCase() === 'ARTICULO';
      const cuotaInicial = finalData.cuotaInicial !== undefined ? Number(finalData.cuotaInicial) : undefined;

      const montoNormalizado = (() => {
        const monto = finalData.monto !== undefined ? Number(finalData.monto) : undefined;
        const valorArticulo = finalData.valorArticulo !== undefined ? Number(finalData.valorArticulo) : undefined;

        // Para ARTICULO: monto es "a financiar". Si solo llegó valorArticulo, derivamos con cuotaInicial.
        if (isArticulo) {
          if (monto !== undefined && !isNaN(monto)) return monto;
          if (valorArticulo !== undefined && !isNaN(valorArticulo)) {
            const ci = !isNaN(Number(cuotaInicial)) ? Number(cuotaInicial) : 0;
            return Math.max(0, valorArticulo - ci);
          }
          return undefined;
        }

        // Para EFECTIVO: monto representa el capital del préstamo
        if (monto !== undefined && !isNaN(monto)) return monto;
        if (valorArticulo !== undefined && !isNaN(valorArticulo)) return valorArticulo;
        return undefined;
      })();

      // 1. Activar el préstamo (aplicando cambios si fueron editados)
      const prestamo = await tx.prestamo.update({
        where: { id: approval.referenciaId },
        data: {
          estado: EstadoPrestamo.ACTIVO,
          estadoAprobacion: EstadoAprobacion.APROBADO,
          aprobadoPorId: aprobadoPorId || undefined,
          // Actualizar campos financieros si cambiaron en la revisión
          monto: montoNormalizado,
          cantidadCuotas: finalData.cantidadCuotas || finalData.cuotas || finalData.numCuotas ? Number(finalData.cantidadCuotas || finalData.cuotas || finalData.numCuotas) : undefined,
          tasaInteres: finalData.porcentaje !== undefined ? Number(finalData.porcentaje) : undefined,
          frecuenciaPago: finalData.frecuenciaPago || undefined,
          cuotaInicial,
          fechaInicio: finalData.fechaInicio ? new Date(finalData.fechaInicio) : undefined,
          notas: finalData.notas || undefined,
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

      // Si es crédito de ARTICULO con cuota inicial, registrar abono a capital (no utilidad).
      // Idempotente para evitar duplicación por reintentos.
      try {
        const cuotaInicialVal = Number(cuotaInicial || 0);
        if (isArticulo && cuotaInicialVal > 0) {
          const rutaId = prestamo.cliente?.asignacionesRuta?.[0]?.rutaId;
          const cajaRuta = rutaId
            ? await tx.caja.findFirst({
                where: { rutaId, tipo: 'RUTA', activa: true },
                select: { id: true },
              })
            : null;

          const cajaOficina = await tx.caja.findFirst({
            where: { activa: true, codigo: 'CAJA-OFICINA' },
            select: { id: true },
          });

          const cajaPrincipal = !cajaRuta
            ? await tx.caja.findFirst({
                where: {
                  activa: true,
                  OR: [{ codigo: 'CAJA-PRINCIPAL' }, { tipo: 'PRINCIPAL' }],
                },
                select: { id: true },
              })
            : null;

          const cajaIdDestino = cajaOficina?.id || cajaRuta?.id || cajaPrincipal?.id;
          if (cajaIdDestino) {
            const yaExiste = await tx.transaccion.findFirst({
              where: {
                cajaId: cajaIdDestino,
                tipo: TipoTransaccion.INGRESO,
                tipoReferencia: 'CUOTA_INICIAL',
                referenciaId: prestamo.id,
              },
              select: { id: true },
            });

            if (!yaExiste?.id) {
              await tx.transaccion.create({
                data: {
                  numeroTransaccion: `CI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  cajaId: cajaIdDestino,
                  tipo: TipoTransaccion.INGRESO,
                  monto: cuotaInicialVal,
                  descripcion: `Cuota inicial crédito artículo #${prestamo.numeroPrestamo}`,
                  creadoPorId: approval.solicitadoPorId,
                  aprobadoPorId: aprobadoPorId || undefined,
                  tipoReferencia: 'CUOTA_INICIAL',
                  referenciaId: prestamo.id,
                },
              });

              await tx.caja.update({
                where: { id: cajaIdDestino },
                data: { saldoActual: { increment: cuotaInicialVal } },
              });
            }
          }
        }
      } catch (_) {
        // No interrumpimos aprobación por error contable accesorio.
      }

      // Si se editaron datos financieros, es probable que las cuotas (instancias de Cuota) necesiten ser regeneradas
      // o ajustadas. Para simplificar, si hay cambios, recalculamos los montos.
      if (editedData) {
        // Recalcular componentes financieros del préstamo
        const montoFinanciar = Number(prestamo.monto);
        const tasaInteres = Number(prestamo.tasaInteres);
        const frecuencia = prestamo.frecuenciaPago;
        const cantidadCuotas = Number(prestamo.cantidadCuotas || (finalData.cantidadCuotas || finalData.cuotas || finalData.numCuotas || 0));
        
        // Determinar plazo real para el cálculo de intereses
        let realPlazoMeses = Number(finalData.plazoMeses || finalData.plajeMeses || (finalData as any).plazo || (prestamo as any).plazoMeses || 1);
        
        // Sincronizar con la lógica de loans.service: derivar el plazo de las cuotas si existen
        if (cantidadCuotas > 0) {
           if (frecuencia === FrecuenciaPago.DIARIO) realPlazoMeses = cantidadCuotas / 30;
           else if (frecuencia === FrecuenciaPago.SEMANAL) realPlazoMeses = cantidadCuotas / 4;
           else if (frecuencia === FrecuenciaPago.QUINCENAL) realPlazoMeses = cantidadCuotas / 2;
           else if (frecuencia === FrecuenciaPago.MENSUAL) realPlazoMeses = cantidadCuotas;
        }

        const tipoAmort = prestamo.tipoAmortizacion;
        const fechaInicio = new Date(prestamo.fechaInicio);

        let interesTotal = 0;
        let cuotasData: any[] = [];

        if (tipoAmort === TipoAmortizacion.FRANCESA) {
          // Usamos la fórmula de amortización francesa (Simplificada para este contexto)
          const tasaMensual = tasaInteres / realPlazoMeses / 100;
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
          const mesesInteres = Math.max(1, realPlazoMeses);
          interesTotal = (montoFinanciar * tasaInteres * mesesInteres) / 100;
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
          where: { rutaId, tipo: 'RUTA', activa: true },
          select: { id: true, nombre: true, saldoActual: true },
        });

        if (cajaRuta) {
          const saldoCajaRuta = Number((cajaRuta as any).saldoActual || 0);
          const montoDesembolso = Number(prestamo.monto || 0);
          const isArticuloLoan = String(prestamo.tipoPrestamo || '').toUpperCase() === 'ARTICULO';

          // Validación de saldo: Solo aplica si NO es un artículo (es decir, es efectivo)
          if (!isArticuloLoan && montoDesembolso > 0 && saldoCajaRuta < montoDesembolso) {
            throw new BadRequestException(
              `Saldo insuficiente en la caja de ruta para desembolsar el préstamo. Caja: ${cajaRuta.nombre}. Saldo: ${saldoCajaRuta.toLocaleString('es-CO')}. Monto desembolso: ${montoDesembolso.toLocaleString('es-CO')}`,
            );
          }

          // 3. Crear transacción de egreso (Desembolso) - Solo si NO es un artículo
          if (!isArticuloLoan) {
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
    this.notificacionesGateway.broadcastPrestamosActualizados({
      accion: 'APROBAR',
      prestamoId: approval.referenciaId,
    });
    this.notificacionesGateway.broadcastDashboardsActualizados({});
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
          categoriaId: data.categoriaId || undefined,
          aprobadoPorId: aprobadoPorId || undefined,
          estadoAprobacion: EstadoAprobacion.APROBADO,
        },
        include: {
          ruta: { select: { id: true, nombre: true } },
          caja: { select: { id: true, nombre: true } },
          cobrador: { select: { id: true, nombres: true, apellidos: true } },
        },
      });

      // 2. Registrar egreso contable: gasto del cobrador = DEUDA_COBRADOR (no afecta utilidad)
      await tx.transaccion.create({
        data: {
          numeroTransaccion: `GTRX${Date.now()}`,
          cajaId: data.cajaId,
          tipo: TipoTransaccion.EGRESO,
          monto: data.monto,
          descripcion: `Gasto aprobado: ${data.descripcion}`,
          creadoPorId: approval.solicitadoPorId,
          aprobadoPorId: aprobadoPorId || undefined,
          tipoReferencia: 'DEUDA_COBRADOR',
          referenciaId: newGasto.id,
        },
      });

      // 3. Actualizar saldo de caja
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
    this.notificacionesGateway.broadcastDashboardsActualizados({
      origen: 'GASTO',
    });
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
    this.notificacionesGateway.broadcastDashboardsActualizados({
      origen: 'BASE',
    });
  }

  private async approvePaymentExtension(approval: any, aprobadoPorId?: string) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    // Calcular nueva fecha: si viene explicita la usamos, sino calculamos con diasGracia
    const fechaOriginal = data.fechaVencimientoOriginal
      ? new Date(data.fechaVencimientoOriginal)
      : new Date();

    let nuevaFecha: Date;
    if (data.nuevaFechaVencimiento) {
      nuevaFecha = new Date(data.nuevaFechaVencimiento);
    } else if (data.diasGracia) {
      nuevaFecha = new Date(Date.now() + Number(data.diasGracia) * 24 * 60 * 60 * 1000);
    } else {
      // Por defecto 30 dias de gracia
      nuevaFecha = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Crear el registro de extension de pago
      const extension = await tx.extensionPago.create({
        data: {
          prestamoId: data.prestamoId,
          fechaVencimientoOriginal: fechaOriginal,
          nuevaFechaVencimiento: nuevaFecha,
          razon: data.comentarios || data.razon || 'Prorroga aprobada',
          aprobadoPorId: aprobadoPorId || approval.solicitadoPorId,
        },
      });

      // 2. Marcar TODAS las cuotas vencidas como PRORROGADA y actualizar su fecha
      await tx.cuota.updateMany({
        where: {
          prestamoId: data.prestamoId,
          estado: 'VENCIDA',
        },
        data: {
          estado: 'PRORROGADA',
          fechaVencimientoProrroga: nuevaFecha,
        },
      });

      // 3. Si hay una cuota específica, vincularla
      if (data.cuotaId) {
        await tx.cuota.update({
          where: { id: data.cuotaId },
          data: { extensionId: extension.id },
        });
      }

      // 4. Cambiar estado del préstamo a ACTIVO y actualizar fecha fin
      await tx.prestamo.update({
        where: { id: data.prestamoId },
        data: {
          fechaFin: nuevaFecha,
          estado: EstadoPrestamo.ACTIVO,
        },
      });
    });

    try {
      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Prórroga Aprobada',
        mensaje: `Tu solicitud de prórroga para el préstamo ${data.numeroPrestamo || ''} ha sido aprobada.`,
        tipo: 'EXITO',
        entidad: 'Prestamo',
        entidadId: data.prestamoId,
      });

      await this.notifyCobradorGestionVencida({
        prestamoId: data.prestamoId,
        titulo: `Prórroga aprobada — ${data.clienteNombre || 'Cliente'}`,
        mensaje: `La solicitud de prórroga para el préstamo ${data.numeroPrestamo || ''} fue aprobada. Nueva fecha: ${nuevaFecha.toLocaleDateString()}`,
        tipo: 'EXITO',
        metadata: {
          tipo: 'GESTION_VENCIDA',
          decision: 'PRORROGAR',
          aprobado: true,
          aprobacionId: approval.id,
        },
      });
    } catch (e) {
      this.logger.error('Error notifying extension approval:', e);
    }

    this.notificacionesGateway.broadcastPrestamosActualizados({
      accion: 'APROBAR_PRORROGA',
      prestamoId: data.prestamoId,
    });
  }

  private async approveLoanLoss(approval: any, aprobadoPorId?: string, editedData?: any) {
    const prestamoId = approval.referenciaId;

    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    });

    if (!prestamo) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    // Realizar operaciones en transacción
    await this.prisma.$transaction(async (tx) => {
      // 1. Marcar préstamo como PERDIDA
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: {
          estado: EstadoPrestamo.PERDIDA,
          eliminadoEn: new Date(),
        },
      });

      // 2. Marcar otras aprobaciones pendientes de este préstamo como RECHAZADAS
      await tx.aprobacion.updateMany({
        where: {
          referenciaId: prestamoId,
          estado: EstadoAprobacion.PENDIENTE,
          id: { not: approval.id },
        },
        data: {
          estado: EstadoAprobacion.RECHAZADO,
          comentarios: 'Archivado automáticamente por aprobación de baja por pérdida',
          revisadoEn: new Date(),
        },
      });
    });

    try {
      await this.notificacionesService.create({
        usuarioId: approval.solicitadoPorId,
        titulo: 'Baja por Pérdida Aprobada',
        mensaje: `La solicitud de baja por pérdida para el préstamo ${prestamo.numeroPrestamo} ha sido aprobada.`,
        tipo: 'EXITO',
        entidad: 'Prestamo',
        entidadId: prestamoId,
      });

      await this.notifyCobradorGestionVencida({
        prestamoId,
        titulo: `Baja por pérdida aprobada — ${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
        mensaje: `La solicitud de baja por pérdida para el préstamo ${prestamo.numeroPrestamo} fue aprobada.`,
        tipo: 'ALERTA',
        metadata: {
          tipo: 'GESTION_VENCIDA',
          decision: 'CASTIGAR',
          aprobado: true,
          aprobacionId: approval.id,
        },
      });
    } catch (e) {
      this.logger.error('Error notifying loan loss approval:', e);
    }

    this.notificacionesGateway.broadcastPrestamosActualizados({
      accion: 'ARCHIVAR',
      prestamoId,
    });
    this.notificacionesGateway.broadcastClientesActualizados({
      accion: 'ACTUALIZAR',
      clienteId: prestamo.clienteId,
    });
  }
}
