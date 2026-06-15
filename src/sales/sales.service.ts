import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MetodoPago, TipoTransaccion } from '@prisma/client';
import { LedgerService } from '../accounting/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashSaleDto } from './dto/create-cash-sale.dto';

@Injectable()
export class SalesService {
  private readonly CAJA_OFICINA_CODIGO = 'CAJA-OFICINA';
  private readonly CAJA_BANCO_CODIGO = 'CAJA-BANCO';

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  private generarReferenciaVenta() {
    return `VENTA:${randomUUID()}`;
  }

  private generarNumeroTransaccion() {
    return `VC-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private getAccountCodeCaja(caja: any, metodoPago?: MetodoPago | string) {
    const metodo = String(metodoPago || '').toUpperCase();

    if (metodo === MetodoPago.TRANSFERENCIA) return '1.1.2';

    return '1.1.1';
  }

  private async resolveCajaVenta(tx: any, metodoPago: MetodoPago) {
    const metodo = String(metodoPago || '').toUpperCase();

    const codigoCaja =
      metodo === MetodoPago.TRANSFERENCIA
        ? this.CAJA_BANCO_CODIGO
        : this.CAJA_OFICINA_CODIGO;

    const caja = await tx.caja.findFirst({
      where: {
        codigo: codigoCaja,
        activa: true,
      },
      select: {
        id: true,
        codigo: true,
        tipo: true,
        saldoActual: true,
      },
    });

    if (!caja?.id) {
      throw new NotFoundException(
        metodo === MetodoPago.TRANSFERENCIA
          ? 'Caja Banco activa no encontrada para registrar venta por transferencia'
          : 'Caja Oficina activa no encontrada para registrar venta en efectivo',
      );
    }

    return caja;
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

    if (
      metodoPago !== MetodoPago.EFECTIVO &&
      metodoPago !== MetodoPago.TRANSFERENCIA
    ) {
      throw new BadRequestException(
        'La venta de contado solo permite pago en efectivo o transferencia.',
      );
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const stockUpdate = await tx.producto.updateMany({
        where: { id: dto.productoId, stock: { gt: 0 } },
        data: { stock: { decrement: 1 } },
      });

      if (stockUpdate.count !== 1) {
        throw new BadRequestException('Producto sin stock disponible');
      }

      const caja = await this.resolveCajaVenta(tx, metodoPago);

      const transaccion = await tx.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion(),
          cajaId: caja.id,
          clienteId: dto.clienteId,
          tipo: TipoTransaccion.INGRESO,
          monto: precioVenta,
          descripcion: `Venta de contado ${metodoPago}: ${producto.nombre}`,
          notas: dto.notas,
          creadoPorId: dto.creadoPorId!,
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
      notas: v.notas,
      tipoReferencia: v.tipoReferencia,
      caja: v.caja?.nombre || null,
      vendedor: v.creadoPor
        ? `${v.creadoPor.nombres} ${v.creadoPor.apellidos}`.trim()
        : null,
      tipo: 'CONTADO',
    }));
  }
}
