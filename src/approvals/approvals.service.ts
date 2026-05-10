import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import {
  EstadoAprobacion,
  EstadoPrestamo,
  EstadoCuota,
  TipoAprobacion,
  TipoTransaccion,
  MetodoPago,
  FrecuenciaPago,
  TipoAmortizacion,
  RolUsuario,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { formatBogotaOffsetIso } from '../utils/date-utils';
import { LedgerService } from '../accounting/ledger.service';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private notificacionesGateway: NotificacionesGateway,
    private readonly ledgerService: LedgerService,
  ) {}

  private async ensureCajaBanco(tx: any) {
    const existing = await tx.caja.findUnique({
      where: { codigo: 'CAJA-BANCO' },
      select: { id: true, nombre: true, saldoActual: true },
    });
    if (existing?.id) return existing;

    const adminUser = await tx.usuario.findFirst({
      where: {
        rol: { in: ['SUPER_ADMINISTRADOR', 'ADMIN'] as any },
        estado: 'ACTIVO' as any,
        eliminadoEn: null,
      },
      orderBy: { creadoEn: 'asc' },
      select: { id: true },
    });
    if (!adminUser?.id) {
      throw new BadRequestException(
        'No existe un usuario ADMIN/SUPER_ADMIN activo para asignar la Caja Banco. Cree uno e intente nuevamente.',
      );
    }

    return tx.caja.create({
      data: {
        codigo: 'CAJA-BANCO',
        nombre: 'Caja Banco',
        tipo: 'PRINCIPAL' as any,
        responsableId: adminUser.id,
        saldoActual: 0,
        activa: true,
      },
      select: { id: true, nombre: true, saldoActual: true },
    });
  }

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
      case 'PAGO_TRANSFERENCIA' as any:
        await this.approveTransferPayment(approval, aprobadoPorId);
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

  private async approveTransferPayment(approval: any, aprobadoPorId?: string) {
    const data = typeof approval.datosSolicitud === 'string'
      ? JSON.parse(approval.datosSolicitud)
      : approval.datosSolicitud;

    const prestamoId = String(data?.prestamoId || approval.referenciaId || '');
    const cobradorId = String(data?.cobradorId || approval.solicitadoPorId || '');
    const montoTotal = Number(data?.montoTotal || approval.montoSolicitud || 0);
    const rawFechaPago = String(data?.fechaPago || '');

    if (!prestamoId || !cobradorId || !montoTotal || montoTotal <= 0) {
      throw new BadRequestException('Datos insuficientes para aprobar pago por transferencia');
    }

    const fechaPagoBogota = (() => {
      if (!rawFechaPago) return new Date(formatBogotaOffsetIso(new Date()));
      const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(rawFechaPago);
      if (hasTz) return new Date(rawFechaPago);
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawFechaPago)) {
        return new Date(`${rawFechaPago}T00:00:00.000-05:00`);
      }
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rawFechaPago)) {
        return new Date(`${rawFechaPago}-05:00`);
      }
      return new Date(rawFechaPago);
    })();

    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id: prestamoId, eliminadoEn: null },
      include: {
        cuotas: {
          where: { estado: { in: [EstadoCuota.PENDIENTE, EstadoCuota.PARCIAL, EstadoCuota.VENCIDA] } },
          orderBy: { numeroCuota: 'asc' },
        },
        cliente: { select: { id: true } },
      },
    });

    if (!prestamo) throw new NotFoundException('Préstamo no encontrado');
    if (![EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA].includes(prestamo.estado as any)) {
      throw new BadRequestException(`No se puede aplicar pago: préstamo en estado ${prestamo.estado}`);
    }

    // Distribuir pago entre cuotas pendientes (Siguiendo Prelación: Mora -> Interés -> Capital)
    const detallesPago: { 
      cuotaId: string; 
      monto: number; 
      montoCapital: number; 
      montoInteres: number; 
      montoInteresMora: number 
    }[] = [];
    let restante = montoTotal;

    let capitalTotal = 0;
    let interesTotal = 0;
    let moraTotal = 0;

    const cuotasActualizar: { id: string; montoPagado: number; estado: any }[] = [];
    
    for (const cuota of prestamo.cuotas || []) {
      if (restante <= 0) break;

      const montoCuota = Number(cuota.monto);
      const yaPagado = Number(cuota.montoPagado);
      const pendiente = montoCuota - yaPagado;
      if (pendiente <= 0) continue;

      // 1. Calcular componentes de esta cuota
      const cCapital = Number(cuota.montoCapital);
      const cInteres = Number(cuota.montoInteres);
      const cMora    = Number(cuota.montoInteresMora);

      // 2. Determinar qué falta por pagar (estimación simple basada en montoPagado acumulado)
      // En una implementación real más compleja, buscaríamos la suma de DetallesPago previos.
      // Aquí asumimos que el montoPagado se aplicó siguiendo el mismo orden.
      let pagoAplicadoMora = 0;
      let pagoAplicadoInteres = 0;
      let pagoAplicadoCapital = 0;

      let tempYaPagado = yaPagado;

      // Descontar lo ya pagado de la jerarquía
      const yaPagadoMora = Math.min(tempYaPagado, cMora);
      tempYaPagado -= yaPagadoMora;
      
      const yaPagadoInteres = Math.min(tempYaPagado, cInteres);
      tempYaPagado -= yaPagadoInteres;

      const yaPagadoCapital = Math.min(tempYaPagado, cCapital);
      
      // Lo que falta cubrir en esta cuota
      const faltaMora    = cMora - yaPagadoMora;
      const faltaInteres = cInteres - yaPagadoInteres;
      const faltaCapital = cCapital - yaPagadoCapital;

      // 3. Aplicar pago actual siguiendo la prelación
      // 3a. Mora
      const aplicarMora = Math.min(restante, faltaMora);
      pagoAplicadoMora = aplicarMora;
      restante -= aplicarMora;
      moraTotal += aplicarMora;

      // 3b. Interés
      const aplicarInteres = Math.min(restante, faltaInteres);
      pagoAplicadoInteres = aplicarInteres;
      restante -= aplicarInteres;
      interesTotal += aplicarInteres;

      // 3c. Capital
      const aplicarCapital = Math.min(restante, faltaCapital);
      pagoAplicadoCapital = aplicarCapital;
      restante -= aplicarCapital;
      capitalTotal += aplicarCapital;

      const totalAplicadoCuota = pagoAplicadoMora + pagoAplicadoInteres + pagoAplicadoCapital;

      if (totalAplicadoCuota > 0) {
        detallesPago.push({
          cuotaId: cuota.id,
          monto: totalAplicadoCuota,
          montoCapital: pagoAplicadoCapital,
          montoInteres: pagoAplicadoInteres,
          montoInteresMora: pagoAplicadoMora,
        });

        const nuevoMontoPagado = yaPagado + totalAplicadoCuota;
        const COP_TOLERANCE = 1;
        const completa = nuevoMontoPagado >= (montoCuota - COP_TOLERANCE);
        const montoPagadoFinal = completa ? montoCuota : nuevoMontoPagado;
        const nuevoEstado = completa
          ? EstadoCuota.PAGADA
          : (cuota.estado === EstadoCuota.PENDIENTE ? EstadoCuota.PARCIAL : cuota.estado);
        
        cuotasActualizar.push({ id: cuota.id, montoPagado: montoPagadoFinal, estado: nuevoEstado });
      }
    }

    // Bug 5 Fix: Ajustar para garantizar exactitud decimal (Débito === Crédito)
    // Redondeamos interés y mora, y calculamos el capital como residuo exacto.
    const interesTotalFinal = Math.round(interesTotal * 100) / 100;
    const moraTotalFinal    = Math.round(moraTotal * 100) / 100;
    const capitalTotalFinal = Math.round((montoTotal - interesTotalFinal - moraTotalFinal) * 100) / 100;

    const count = await this.prisma.pago.count();
    const numeroPago = `PAG-${String(count + 1).padStart(6, '0')}`;

    await this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.create({
        data: {
          numeroPago,
          clienteId: prestamo.clienteId,
          prestamoId: prestamo.id,
          cobradorId,
          fechaPago: fechaPagoBogota,
          montoTotal,
          metodoPago: MetodoPago.TRANSFERENCIA,
          numeroReferencia: data?.numeroReferencia || null,
          notas: data?.notas || null,
          detalles: { create: detallesPago as any },
        },
        select: { id: true },
      });

      for (const upd of cuotasActualizar) {
        await tx.cuota.update({
          where: { id: upd.id },
          data: {
            montoPagado: upd.montoPagado,
            estado: upd.estado,
            fechaPago: upd.estado === EstadoCuota.PAGADA ? fechaPagoBogota : undefined,
          },
        });
      }

      // Actualizar préstamo
      const nuevoSaldo = Math.max(0, Number((prestamo as any).saldoPendiente || 0) - montoTotal);
      const prestamoQuedaPagado = nuevoSaldo <= 0;
      let nuevoEstadoPrestamo: any = prestamo.estado;
      if (prestamoQuedaPagado) nuevoEstadoPrestamo = EstadoPrestamo.PAGADO;
      else if (prestamo.estado === EstadoPrestamo.EN_MORA) {
        const vencidasRestantes = await tx.cuota.count({ where: { prestamoId: prestamo.id, estado: EstadoCuota.VENCIDA } });
        if (vencidasRestantes === 0) nuevoEstadoPrestamo = EstadoPrestamo.ACTIVO;
      }

      await tx.prestamo.update({
        where: { id: prestamo.id },
        data: {
          totalPagado: Number((prestamo as any).totalPagado || 0) + montoTotal,
          capitalPagado: Number((prestamo as any).capitalPagado || 0) + capitalTotal,
          interesPagado: Number((prestamo as any).interesPagado || 0) + interesTotal,
          saldoPendiente: nuevoSaldo,
          estado: nuevoEstadoPrestamo,
          estadoSincronizacion: 'PENDIENTE' as any,
        },
      });

      // Registrar transacción en CAJA-BANCO
      const cajaBanco = await this.ensureCajaBanco(tx);
      const numeroTransaccionCaja = `TRX-IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await tx.transaccion.create({
        data: {
          numeroTransaccion: numeroTransaccionCaja,
          cajaId: cajaBanco.id,
          tipo: TipoTransaccion.INGRESO,
          monto: montoTotal,
          descripcion: `Cobranza ${numeroPago} (Transferencia verificada)` ,
          creadoPorId: cobradorId,
          aprobadoPorId: aprobadoPorId || null,
          tipoReferencia: 'PAGO',
          referenciaId: numeroPago,
        },
      });

      // Asiento contable de Partida Doble
      // Débito:  1.1.2 Cuentas Bancarias (Transferencia)
      // Crédito: 1.3.1 Cartera Vigente + 3.1 Intereses + 3.2 Mora
      await this.ledgerService.registrarAsiento(
        {
          referenceType: 'PAGO',
          referenceId:   pago.id,
          description:   `Pago transferencia verificada ${numeroPago}`,
          createdBy:     aprobadoPorId || cobradorId,
          lines: [
            {
              accountCode: '1.1.2',   // Cuentas Bancarias
              debitAmount:  montoTotal,
              cajaId:       cajaBanco.id,
              cajaDelta:    montoTotal,
            },
            {
              accountCode:  '1.3.1',
              creditAmount:  capitalTotalFinal,
            },
            ...(interesTotalFinal > 0 ? [{
              accountCode:  '3.1',
              creditAmount:  interesTotalFinal,
            }] : []),
            ...(moraTotalFinal > 0 ? [{
              accountCode:  '3.2',
              creditAmount:  moraTotalFinal,
            }] : []),
          ],
        },
        tx as any,
      );

      // Vincular comprobante (si existe) al pago real
      try {
        const comprobante = await tx.multimedia.findFirst({
          where: {
            prestamoId: prestamo.id,
            clienteId: prestamo.clienteId,
            entidad: 'APROBACION',
            tipoContenido: 'COMPROBANTE_TRANSFERENCIA' as any,
            estado: 'ACTIVO' as any,
            eliminadoEn: null,
          },
          orderBy: { creadoEn: 'desc' },
          select: { id: true },
        });
        if (comprobante?.id) {
          await tx.multimedia.update({ where: { id: comprobante.id }, data: { pagoId: pago.id } });
        }
      } catch {
        // ignore
      }
    });
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

      // 0. Capturar estado previo para ajustes (Bug Gap 4 Fix)
      const prestamoPrevio = await tx.prestamo.findUnique({
        where: { id: approval.referenciaId },
        select: { estado: true, monto: true },
      });
      const fueActivo = prestamoPrevio?.estado === EstadoPrestamo.ACTIVO || prestamoPrevio?.estado === EstadoPrestamo.EN_MORA;
      const montoOriginal = Number(prestamoPrevio?.monto || 0);

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

      // Si es crédito de ARTICULO, registrar la venta completa separando ingreso, costo e inventario.
      // Idempotente para evitar duplicación por reintentos.
      const cuotaInicialVal = Number(cuotaInicial || 0);
      if (isArticulo && !fueActivo) {
        const rutaId = prestamo.cliente?.asignacionesRuta?.[0]?.rutaId;
        const cajaRuta = rutaId
          ? await tx.caja.findFirst({
              where: { rutaId, tipo: 'RUTA', activa: true },
              select: { id: true, codigo: true },
            })
          : null;

        const cajaOficina = await tx.caja.findFirst({
          where: { activa: true, codigo: 'CAJA-OFICINA' },
          select: { id: true, codigo: true },
        });

        const cajaPrincipal = !cajaRuta
          ? await tx.caja.findFirst({
              where: {
                activa: true,
                OR: [{ codigo: 'CAJA-PRINCIPAL' }, { tipo: 'PRINCIPAL' }],
              },
              select: { id: true, codigo: true },
            })
          : null;

        const cajaDestino = cajaOficina || cajaRuta || cajaPrincipal;
        const cajaIdDestino = cajaDestino?.id;
        const asientoVentaExistente = await tx.journalEntry.findFirst({
          where: {
            referenceType: 'VENTA_ARTICULO' as any,
            referenceId: prestamo.id,
          },
          select: { id: true },
        });

        if (!asientoVentaExistente?.id) {
          if (cuotaInicialVal > 0 && !cajaIdDestino) {
            throw new BadRequestException('No se encontró una caja activa para registrar la cuota inicial del artículo.');
          }

          const yaExiste = cuotaInicialVal > 0 && cajaIdDestino
            ? await tx.transaccion.findFirst({
                where: {
                  cajaId: cajaIdDestino,
                  tipo: TipoTransaccion.INGRESO,
                  tipoReferencia: 'CUOTA_INICIAL',
                  referenciaId: prestamo.id,
                },
                select: { id: true },
              })
            : null;

          if (cuotaInicialVal > 0 && cajaIdDestino && !yaExiste?.id) {
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
          }

          const precioVentaArticulo = Number(
            (prestamo as any).precioVentaArticulo ||
            finalData.valorArticulo ||
            finalData.precioVentaArticulo ||
            (Number(prestamo.monto || 0) + cuotaInicialVal),
          );
          const costoArticulo = Number(
            (prestamo as any).costoArticulo ||
            finalData.costoArticulo ||
            finalData.costo ||
            0,
          );

          await this.ledgerService.registrarVentaArticulo(
            {
              prestamoId: prestamo.id,
              precioVenta: precioVentaArticulo,
              costoArticulo,
              montoFinanciado: Number(prestamo.monto || 0),
              cuotaInicial: cuotaInicialVal,
              cajaId: cajaIdDestino,
              accountCodeCaja: cajaDestino?.codigo === 'CAJA-BANCO' ? '1.1.2' : '1.1.1',
              createdBy: aprobadoPorId || approval.solicitadoPorId,
            },
            tx as any,
          );
        }
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

      const montoDesembolso = Number(prestamo.monto || 0);
      const isArticuloLoan = String(prestamo.tipoPrestamo || '').toUpperCase() === 'ARTICULO';

      if (!isArticuloLoan && !fueActivo) {
        const solicitante = await tx.usuario.findFirst({
          where: { id: approval.solicitadoPorId },
          select: { rol: true },
        });
        const rutaAsignadaId = (prestamo as any)?.cliente?.asignacionesRuta?.[0]?.rutaId;
        const cajaRuta = solicitante?.rol === RolUsuario.COBRADOR && rutaAsignadaId
          ? await tx.caja.findFirst({
            where: { activa: true, tipo: 'RUTA', rutaId: rutaAsignadaId },
            select: { id: true, codigo: true, nombre: true, saldoActual: true },
          })
          : null;
        const cajaDesembolso = cajaRuta ?? await tx.caja.findFirst({
          where: { activa: true, codigo: 'CAJA-OFICINA' },
          select: { id: true, codigo: true, nombre: true, saldoActual: true },
        }) ?? await tx.caja.findFirst({
          where: {
            activa: true,
            OR: [{ codigo: 'CAJA-PRINCIPAL' }, { tipo: 'PRINCIPAL' }],
          },
          orderBy: { creadoEn: 'asc' },
          select: { id: true, codigo: true, nombre: true, saldoActual: true },
        });

        if (!cajaDesembolso?.id) {
          throw new BadRequestException('No existe una caja activa para desembolsar el préstamo.');
        }

        const saldoCajaDesembolso = Number((cajaDesembolso as any).saldoActual || 0);
        if (montoDesembolso > 0 && saldoCajaDesembolso < montoDesembolso) {
          throw new BadRequestException(
            `Saldo insuficiente en la caja para desembolsar el préstamo. Caja: ${cajaDesembolso.nombre}. Saldo: ${saldoCajaDesembolso.toLocaleString('es-CO')}. Monto desembolso: ${montoDesembolso.toLocaleString('es-CO')}`,
          );
        }
        const accountCodeDesembolso = cajaRuta?.id === cajaDesembolso.id
          ? '1.2.1'
          : cajaDesembolso.codigo === 'CAJA-BANCO'
            ? '1.1.2'
            : '1.1.1';

        await tx.transaccion.create({
          data: {
            numeroTransaccion: `T${Date.now()}`,
            cajaId: cajaDesembolso.id,
            tipo: TipoTransaccion.EGRESO,
            monto: montoDesembolso,
            descripcion: `Desembolso de préstamo #${prestamo.numeroPrestamo} - Cliente: ${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
            creadoPorId: approval.solicitadoPorId,
            aprobadoPorId: aprobadoPorId || undefined,
            tipoReferencia: 'PRESTAMO',
            referenciaId: prestamo.id,
          },
        });

        await this.ledgerService.registrarAsiento(
          {
            referenceType: 'DESEMBOLSO',
            referenceId:   prestamo.id,
            description:   `Desembolso préstamo #${prestamo.numeroPrestamo} - $${montoDesembolso.toLocaleString('es-CO')}`,
            createdBy:     aprobadoPorId || approval.solicitadoPorId,
            lines: [
              {
                accountCode: '1.3.1',
                debitAmount:  montoDesembolso,
              },
              {
                accountCode:  accountCodeDesembolso,
                creditAmount:  montoDesembolso,
                cajaId:        cajaDesembolso.id,
                cajaDelta:    -montoDesembolso,
              },
            ],
          },
          tx as any,
        );
      }

      if (fueActivo && Number(prestamo.monto) !== montoOriginal) {
        await this.ledgerService.registrarAjusteCartera({
          prestamoId: prestamo.id,
          montoDiferencia: Number(prestamo.monto) - montoOriginal,
          createdBy: aprobadoPorId || approval.solicitadoPorId,
        }, tx as any);
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
          tipoReferencia: 'GASTO',
          referenciaId: newGasto.id,
        },
      });

      // Asiento contable de Partida Doble (patrón correcto: Ledger mueve el saldo)
      // Débito: 4.1 Gastos de Ruta (consume patrimonio)
      // Crédito: 1.2.1 Caja Ruta (sale el efectivo) — cajaDelta real
      await this.ledgerService.registrarAsiento(
        {
          referenceType: 'GASTO',
          referenceId:   newGasto.id,
          description:   `Gasto aprobado: ${data.descripcion}`,
          createdBy:     aprobadoPorId || approval.solicitadoPorId,
          lines: [
            {
              accountCode: '4.1',
              debitAmount:  Number(data.monto),
            },
            {
              accountCode:  '1.2.1',
              creditAmount:  Number(data.monto),
              cajaId:        data.cajaId,
              cajaDelta:    -Number(data.monto), // Ledger decrementa el saldo
            },
          ],
        },
        tx as any,
      );

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

      // 5. Crear transacción de ingreso a la caja de ruta
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

      // Asiento contable de Partida Doble (patrón correcto: Ledger mueve ambos saldos)
      const accountCodePrincipal = cajaPrincipal.codigo === 'CAJA-BANCO' ? '1.1.2' : '1.1.1';
      await this.ledgerService.registrarAsiento(
        {
          referenceType: 'BASE',
          referenceId:   approval.id,
          description:   `Base efectivo: ${data.descripcion}`,
          createdBy:     aprobadoPorId || approval.solicitadoPorId,
          lines: [
            {
              accountCode: '1.2.1',
              debitAmount:  monto,
              cajaId:       data.cajaId,
              cajaDelta:   +monto,  // Caja Ruta RECIBE
            },
            {
              accountCode:  accountCodePrincipal,
              creditAmount:  monto,
              cajaId:        cajaPrincipal.id,
              cajaDelta:    -monto,  // Caja Principal ENTREGA
            },
          ],
        },
        tx as any,
      );

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

      // 3. Registrar castigo de cartera en el Ledger (Bug Gap 2 Fix)
      const saldoCapital = Number(prestamo.saldoPendiente);
      if (saldoCapital > 0) {
        await this.ledgerService.registrarBajaCartera({
          prestamoId: prestamo.id,
          monto:      saldoCapital,
          createdBy:  aprobadoPorId || approval.solicitadoPorId,
        }, tx as any);
      }
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
