import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import {
  EstadoAprobacion,
  EstadoPrestamo,
  TipoAprobacion,
  TipoTransaccion,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  async approveItem(id: string, _type: TipoAprobacion, aprobadoPorId?: string, notas?: string) {
    // Buscar la aprobación
    const approval = await this.prisma.aprobacion.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new Error('Aprobación no encontrada');
    }

    if (approval.estado !== EstadoAprobacion.PENDIENTE) {
      throw new Error(`Esta solicitud ya fue procesada (estado: ${approval.estado})`);
    }

    // Procesar según el tipo
    switch (approval.tipoAprobacion) {
      case TipoAprobacion.NUEVO_CLIENTE:
        await this.approveNewClient(approval);
        break;
      case TipoAprobacion.NUEVO_PRESTAMO:
        await this.approveNewLoan(approval, aprobadoPorId);
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
        throw new Error('Tipo de aprobación no soportado');
    }

    // Marcar como aprobado e incluir quién aprobó
    await this.prisma.aprobacion.update({
      where: { id },
      data: {
        estado: EstadoAprobacion.APROBADO,
        aprobadoPorId: aprobadoPorId || undefined,
        comentarios: notas || undefined,
        revisadoEn: new Date(),
      },
    });

    this.logger.log(`Aprobación ${id} procesada por ${aprobadoPorId || 'desconocido'} (tipo: ${approval.tipoAprobacion})`);

    return { success: true, message: 'Aprobación procesada exitosamente' };
  }

  async rejectItem(id: string, _type: TipoAprobacion, rechazadoPorId?: string, motivoRechazo?: string) {
    const approval = await this.prisma.aprobacion.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new Error('Aprobación no encontrada');
    }

    if (approval.estado !== EstadoAprobacion.PENDIENTE) {
      throw new Error(`Esta solicitud ya fue procesada (estado: ${approval.estado})`);
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

  private async approveNewLoan(approval: any, aprobadoPorId?: string) {
    const data =
      typeof approval.datosSolicitud === 'string'
        ? JSON.parse(approval.datosSolicitud)
        : approval.datosSolicitud;

    // Ejecutar en una transacción
    await this.prisma.$transaction(async (tx) => {
      // 1. Activar el préstamo
      const prestamo = await tx.prestamo.update({
        where: { id: approval.referenciaId },
        data: {
          estado: EstadoPrestamo.ACTIVO,
          estadoAprobacion: EstadoAprobacion.APROBADO,
          aprobadoPorId: aprobadoPorId || undefined,
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
              monto: prestamo.monto,
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
        throw new Error('No se encontró una Caja Principal activa para entregar la base.');
      }

      const monto = Number(data.monto);

      // 2. Verificar fondos en Caja Principal
      if (Number(cajaPrincipal.saldoActual) < monto) {
        throw new Error(
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

    await this.prisma.extensionPago.create({
      data: {
        prestamoId: data.prestamoId,
        cuotaId: data.cuotaId,
        fechaVencimientoOriginal: new Date(data.fechaVencimientoOriginal),
        nuevaFechaVencimiento: new Date(data.nuevaFechaVencimiento),
        razon: data.razon,
        aprobadoPorId: aprobadoPorId || approval.solicitadoPorId,
      },
    });
  }
}
