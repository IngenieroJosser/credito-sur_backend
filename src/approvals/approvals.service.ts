import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service'; 
import { EstadoAprobacion, EstadoPrestamo, TipoAprobacion, TipoTransaccion } from '@prisma/client';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async approveItem(id: string, type: TipoAprobacion) {
    // Buscar la aprobación
    const approval = await this.prisma.aprobacion.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new Error('Aprobación no encontrada');
    }

    // Procesar según el tipo
    switch (approval.tipoAprobacion) {
      case TipoAprobacion.NUEVO_CLIENTE:
        await this.approveNewClient(approval);
        break;
      case TipoAprobacion.NUEVO_PRESTAMO:
        await this.approveNewLoan(approval);
        break;
      case TipoAprobacion.GASTO:
        await this.approveExpense(approval);
        break;
      case TipoAprobacion.SOLICITUD_BASE_EFECTIVO:
        await this.approveCashBase(approval);
        break;
      case TipoAprobacion.PRORROGA_PAGO:
        await this.approvePaymentExtension(approval);
        break;
      default:
        throw new Error('Tipo de aprobación no soportado');
    }

    // Marcar como aprobado
    await this.prisma.aprobacion.update({
      where: { id },
      data: {
        estado: EstadoAprobacion.APROBADO,
        revisadoEn: new Date(),
      },
    });

    return { success: true, message: 'Aprobación procesada exitosamente' };
  }

  async rejectItem(id: string, type: TipoAprobacion) {
    await this.prisma.aprobacion.update({
      where: { id },
      data: {
        estado: EstadoAprobacion.RECHAZADO,
        revisadoEn: new Date(),
      },
    });

    return { success: true, message: 'Aprobación rechazada' };
  }

  private async approveNewClient(approval: any) {
    const data = typeof approval.datosSolicitud === 'string'
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

  private async approveNewLoan(approval: any) {
    const data = typeof approval.datosSolicitud === 'string'
      ? JSON.parse(approval.datosSolicitud)
      : approval.datosSolicitud;

    // Crear el préstamo
    await this.prisma.prestamo.create({
      data: {
        numeroPrestamo: `P${Date.now()}`,
        clienteId: data.clienteId,
        productoId: data.productoId,
        precioProductoId: data.precioProductoId,
        tipoPrestamo: 'CON_GARANTIA',
        monto: data.monto,
        tasaInteres: data.tasaInteres,
        tasaInteresMora: data.tasaInteresMora,
        plazoMeses: data.plazoMeses,
        frecuenciaPago: data.frecuenciaPago,
        cantidadCuotas: data.cantidadCuotas,
        fechaInicio: new Date(data.fechaInicio),
        fechaFin: new Date(data.fechaFin),
        creadoPorId: approval.solicitadoPorId,
        estadoAprobacion: EstadoAprobacion.APROBADO,
        estado: EstadoPrestamo.ACTIVO,
      },
    });
  }

  private async approveExpense(approval: any) {
    const data = typeof approval.datosSolicitud === 'string'
      ? JSON.parse(approval.datosSolicitud)
      : approval.datosSolicitud;

    await this.prisma.gasto.create({
      data: {
        numeroGasto: `G${Date.now()}`,
        rutaId: data.rutaId,
        cobradorId: data.cobradorId,
        cajaId: data.cajaId,
        tipoGasto: data.tipoGasto,
        monto: data.monto,
        descripcion: data.descripcion,
        estadoAprobacion: EstadoAprobacion.APROBADO,
      },
    });
  }

  private async approveCashBase(approval: any) {
    const data = typeof approval.datosSolicitud === 'string'
      ? JSON.parse(approval.datosSolicitud)
      : approval.datosSolicitud;

    // Crear transacción de ingreso a la caja
    await this.prisma.transaccion.create({
      data: {
        numeroTransaccion: `T${Date.now()}`,
        cajaId: data.cajaId,
        tipo: TipoTransaccion.INGRESO,
        monto: data.monto,
        descripcion: `Base de efectivo aprobada - ${data.descripcion}`,
        creadoPorId: approval.solicitadoPorId,
        aprobadoPorId: approval.aprobadoPorId,
      },
    });
  }

  private async approvePaymentExtension(approval: any) {
    const data = typeof approval.datosSolicitud === 'string'
      ? JSON.parse(approval.datosSolicitud)
      : approval.datosSolicitud;

    await this.prisma.extensionPago.create({
      data: {
        prestamoId: data.prestamoId,
        cuotaId: data.cuotaId,
        fechaVencimientoOriginal: new Date(data.fechaVencimientoOriginal),
        nuevaFechaVencimiento: new Date(data.nuevaFechaVencimiento),
        razon: data.razon,
        aprobadoPorId: approval.aprobadoPorId,
      },
    });
  }
}