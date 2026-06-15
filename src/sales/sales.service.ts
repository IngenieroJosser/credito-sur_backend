import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MetodoPago, TipoTransaccion } from '@prisma/client';
import { LedgerService } from '../accounting/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashSaleDto } from './dto/create-cash-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  private generarReferenciaVenta() {
    return `VENTA:${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  private generarNumeroTransaccion() {
    return `VC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  private getAccountCodeCaja(caja: any, metodoPago?: MetodoPago | string) {
    const metodo = String(metodoPago || '').toUpperCase();
    if (metodo === MetodoPago.TRANSFERENCIA) return '1.1.2';

    const tipo = String(caja?.tipo || '').toUpperCase();
    if (tipo === 'RUTA') return '1.2.1';
    return '1.1.1';
  }

  async registrarVentaContado(dto: CreateCashSaleDto) {
    const precioVenta = Number(dto.precioVenta || 0);
    if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
      throw new BadRequestException(
        'La venta de contado debe tener precio mayor a cero.',
      );
    }

    if (!dto.creadoPorId) {
      throw new BadRequestException('Usuario creador requerido');
    }

    const producto = await this.prisma.producto.findUnique({
      where: { id: dto.productoId },
      select: {
        id: true,
        nombre: true,
        costo: true,
        stock: true,
      },
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (Number(producto.stock || 0) < 1) {
      throw new BadRequestException('Producto sin stock disponible');
    }

    const referenciaId = this.generarReferenciaVenta();
    const metodoPago = dto.metodoPago || MetodoPago.EFECTIVO;

    const resultado = await this.prisma.$transaction(async (tx) => {
      const stockUpdate = await tx.producto.updateMany({
        where: { id: dto.productoId, stock: { gt: 0 } },
        data: { stock: { decrement: 1 } },
      });

      if (stockUpdate.count !== 1) {
        throw new BadRequestException('Producto sin stock disponible');
      }

      const caja = await tx.caja.findFirst({
        where: { id: dto.cajaId, activa: true },
        select: {
          id: true,
          codigo: true,
          tipo: true,
          saldoActual: true,
        },
      });

      if (!caja?.id) {
        throw new NotFoundException('Caja activa no encontrada');
      }

      const transaccion = await tx.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion(),
          cajaId: caja.id,
          tipo: TipoTransaccion.INGRESO,
          monto: precioVenta,
          descripcion: `Venta de contado: ${producto.nombre}`,
          creadoPorId: dto.creadoPorId,
          tipoReferencia: 'VENTA_CONTADO',
          referenciaId,
        },
        select: {
          id: true,
          numeroTransaccion: true,
        },
      });

      const journalEntry = await this.ledgerService.registrarVentaArticulo(
        {
          prestamoId: referenciaId,
          precioVenta,
          costoArticulo: Number(producto.costo || 0),
          montoFinanciado: 0,
          cuotaInicial: precioVenta,
          cajaId: caja.id,
          accountCodeCaja: this.getAccountCodeCaja(caja, metodoPago),
          createdBy: dto.creadoPorId!,
        },
        tx,
      );

      return {
        transaccion,
        journalEntry,
      };
    });

    return {
      success: true,
      ventaId: referenciaId,
      clienteId: dto.clienteId,
      productoId: dto.productoId,
      precioVenta,
      metodoPago,
      transaccionId: resultado.transaccion.id,
      numeroTransaccion: resultado.transaccion.numeroTransaccion,
      journalEntryId: resultado.journalEntry?.id || null,
    };
  }

  async listarVentasContado() {
    const ventas = await this.prisma.transaccion.findMany({
      where: {
        tipoReferencia: 'VENTA_CONTADO',
      },
      include: {
        caja: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
            tipo: true,
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
      orderBy: {
        fechaTransaccion: 'desc',
      },
      take: 50,
    });

    return ventas.map((v) => ({
      id: v.referenciaId,
      transaccionId: v.id,
      numeroTransaccion: v.numeroTransaccion,
      monto: Number(v.monto),
      fecha: v.fechaTransaccion,
      descripcion: v.descripcion,
      tipoReferencia: v.tipoReferencia,
      caja: v.caja?.nombre || null,
      vendedor: v.creadoPor
        ? `${v.creadoPor.nombres} ${v.creadoPor.apellidos}`.trim()
        : null,
      tipo: 'CONTADO',
    }));
  }
}
