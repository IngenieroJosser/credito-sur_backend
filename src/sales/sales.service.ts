import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MetodoPago, Prisma, RolUsuario, TipoTransaccion } from '@prisma/client';
import { LedgerService } from '../accounting/ledger.service';
import { PrismaService, TransaccionPrisma } from '../prisma/prisma.service';
import { codigoDeError } from '../common/error.util';
import { CreateCashSaleDto } from './dto/create-cash-sale.dto';
import { textoRecortado } from '../common/texto.util';

/**
 * Ventas de contado de artículos.
 *
 * Una venta de contado no crea préstamo ni cuotas: el cliente paga completo en
 * el momento. Por eso no aparece en la ruta ni en la cartera, y el arqueo de
 * las cajas de ruta la excluye (`VENTA_CONTADO`).
 *
 * El dinero entra a una caja institucional, nunca a la de un cobrador:
 *  - Efectivo      -> CAJA-OFICINA (cuenta 1.1.1)
 *  - Transferencia -> CAJA-BANCO   (cuenta 1.1.2)
 *
 * La contabilidad reutiliza `registrarVentaArticulo` con `montoFinanciado: 0`
 * y la cuota inicial igual al precio: una venta de contado es, contablemente,
 * una venta de artículo pagada entera por adelantado.
 */
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

  /**
   * Cuenta contable de la caja según el método: 1.1.2 (bancos) para
   * transferencia y 1.1.1 (caja) para lo demás. Hoy solo decide el método; el
   * parámetro `caja` no se usa.
   */
  private getAccountCodeCaja(
    caja: { codigo?: string | null; tipo?: string | null } | null,
    metodoPago?: MetodoPago,
  ) {
    // El `| string` que habia en el parametro se comia el enum: la union entera
    // equivalia a `string` y no se comprobaba nada.
    const metodo = textoRecortado(metodoPago).toUpperCase();

    if (metodo === MetodoPago.TRANSFERENCIA) return '1.1.2';

    return '1.1.1';
  }

  private async resolveCajaVenta(
    tx: TransaccionPrisma,
    metodoPago: MetodoPago,
  ) {
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

  /**
   * Registra una venta de contado: descuenta una unidad de stock, crea el
   * INGRESO en la caja y el asiento contable, todo en una transacción.
   *
   * Dos protecciones contra duplicados, porque la venta puede llegar desde la
   * cola offline con reintentos:
   *  1. Antes de la transacción se busca una venta con el mismo
   *     `idempotencyKey` y, si existe, se devuelve esa (`duplicada: true`).
   *  2. Si dos reintentos entran a la vez y ambos pasan esa búsqueda, la
   *     restricción única del `idempotencyKey` hace fallar al segundo (P2002),
   *     y en vez de propagar el error se devuelve la venta del primero.
   */
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

    // Idempotencia: si esta venta ya se registró (mismo idempotencyKey, p. ej.
    // un reintento tras sincronizar offline), devolvemos la existente SIN volver
    // a descontar stock ni duplicar el movimiento de dinero.
    const alcanceVenta = {
      creadoPorId: dto.creadoPorId,
      tipo: TipoTransaccion.INGRESO,
      tipoReferencia: 'VENTA_CONTADO',
    };
    if (dto.idempotencyKey) {
      const existente = await this.prisma.transaccion.findUnique({
        where: { idempotencyKey: dto.idempotencyKey, ...alcanceVenta },
        select: {
          id: true,
          numeroTransaccion: true,
          referenciaId: true,
          monto: true,
        },
      });
      if (existente) {
        return {
          success: true,
          ventaId: existente.referenciaId || referenciaId,
          clienteId: dto.clienteId,
          productoId: dto.productoId,
          precioVenta: Number(existente.monto ?? precioVenta),
          metodoPago,
          transaccionId: existente.id,
          numeroTransaccion: existente.numeroTransaccion,
          journalEntryId: null,
          duplicada: true,
        };
      }
    }

    let resultado: {
      transaccion: { id: string; numeroTransaccion: string };
      journalEntry: { id: string } | null;
    };
    try {
      resultado = await this.prisma.$transaction(async (tx) => {
        // Descuento atómico: la condición stock > 0 va en el mismo UPDATE. Leer
        // el stock y restar en dos pasos dejaría vender dos veces la última
        // unidad si dos ventas llegan a la vez.
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
            idempotencyKey: dto.idempotencyKey || null,
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
    } catch (error) {
      // Carrera de idempotencia: otro reintento idéntico ganó la creación.
      // Devolvemos la venta ya registrada en vez de duplicar o fallar.
      if (codigoDeError(error) === 'P2002' && dto.idempotencyKey) {
        const existente = await this.prisma.transaccion.findUnique({
          where: { idempotencyKey: dto.idempotencyKey, ...alcanceVenta },
          select: {
            id: true,
            numeroTransaccion: true,
            referenciaId: true,
            monto: true,
          },
        });
        if (existente) {
          return {
            success: true,
            ventaId: existente.referenciaId || referenciaId,
            clienteId: dto.clienteId,
            productoId: dto.productoId,
            precioVenta: Number(existente.monto ?? precioVenta),
            metodoPago,
            transaccionId: existente.id,
            numeroTransaccion: existente.numeroTransaccion,
            journalEntryId: null,
            duplicada: true,
          };
        }
      }
      throw error;
    }

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

  async listarVentasContado(opciones: {
    actor: { id: string; rol: RolUsuario };
    pagina?: number;
    limite?: number;
    vendedorId?: string;
    soloPuntoVenta?: boolean;
  }) {
    const { actor } = opciones;
    const paginada = opciones.pagina !== undefined || opciones.limite !== undefined;
    const solicitada = opciones.pagina ?? 1;
    const solicitadas = opciones.limite ?? 50;
    const pagina = Number.isSafeInteger(solicitada) ? Math.max(1, Math.min(solicitada, 100_000)) : 1;
    const limite = Number.isSafeInteger(solicitadas) ? Math.max(1, Math.min(solicitadas, 100)) : 50;
    const where: Prisma.TransaccionWhereInput = {
      tipoReferencia: 'VENTA_CONTADO',
      tipo: 'INGRESO',
      creadoPorId: actor.rol === RolUsuario.PUNTO_DE_VENTA ? actor.id : opciones.vendedorId,
      ...(opciones.soloPuntoVenta && actor.rol !== RolUsuario.PUNTO_DE_VENTA
        ? { creadoPor: { rol: RolUsuario.PUNTO_DE_VENTA } }
        : {}),
    };
    const [ventas, total] = await Promise.all([
      this.prisma.transaccion.findMany({
        where,
        select: {
          id: true,
          referenciaId: true,
          numeroTransaccion: true,
          monto: true,
          fechaTransaccion: true,
          descripcion: true,
          notas: true,
          tipoReferencia: true,
          creadoPorId: true,
          clienteId: true,
          caja: { select: { nombre: true, codigo: true } },
          creadoPor: { select: { nombres: true, apellidos: true } },
          cliente: { select: { nombres: true, apellidos: true, dni: true, telefono: true } },
        },
        orderBy: [{ fechaTransaccion: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      paginada ? this.prisma.transaccion.count({ where }) : Promise.resolve(0),
    ]);

    const datos = ventas.map((v) => ({
      id: v.referenciaId ?? v.id,
      transaccionId: v.id,
      numeroTransaccion: v.numeroTransaccion,
      monto: Number(v.monto),
      fecha: v.fechaTransaccion,
      descripcion: v.descripcion,
      notas: v.notas,
      tipoReferencia: v.tipoReferencia,
      caja: v.caja?.nombre ?? null,
      metodoPago: v.caja?.codigo === this.CAJA_BANCO_CODIGO ? 'TRANSFERENCIA'
        : v.caja?.codigo === this.CAJA_OFICINA_CODIGO ? 'EFECTIVO' : null,
      vendedorId: v.creadoPorId,
      vendedor: v.creadoPor ? `${v.creadoPor.nombres} ${v.creadoPor.apellidos}`.trim() : null,
      clienteId: v.clienteId,
      cliente: v.cliente ? `${v.cliente.nombres} ${v.cliente.apellidos}`.trim() : null,
      clienteDni: v.cliente?.dni ?? null,
      clienteTelefono: v.cliente?.telefono ?? null,
      tipo: 'CONTADO',
    }));
    // El listado anterior sin parámetros conserva su contrato de array.
    return paginada ? { ventas: datos, paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) } } : datos;
  }
}
