import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { Prisma } from '@prisma/client';
import {
  generarPDFInventario,
  type InventarioRow,
  type InventarioTotales,
} from '../templates/exports/inventario.template';
import { generarExcelInventarioImportable } from '../templates/exports/importables.template';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { LedgerService } from '../accounting/ledger.service';
import { getBogotaDayKey } from '../utils/date-utils';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacionesGateway: NotificacionesGateway,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Asiento de entrada o salida de mercancía.
   *
   * Hasta ahora registrar stock no tocaba el libro. La cuenta de inventario
   * (1.5) solo se acreditaba al vender —contra el costo del artículo— así que
   * bajaba con cada venta y no subía nunca: quedó en negativo, un activo
   * imposible, con la bodega llena. El asiento de apertura tampoco la incluyó.
   *
   * La contrapartida es el capital del propietario, el mismo criterio que usa
   * `ejecutarAperturaContable`: el sistema no tiene un flujo de compra que
   * descuente de una caja, así que la mercancía entra como aporte. Si algún día
   * se paga la mercancía desde una caja, esta es la línea que hay que cambiar.
   *
   * Las unidades negativas son salidas por ajuste (una merma, un conteo), no
   * ventas: las ventas ya llevan su propio asiento en `registrarVentaArticulo`.
   */
  private async registrarMovimientoInventario(
    tx: any,
    params: {
      productoId: string;
      codigo: string;
      unidades: number;
      costoUnitario: number;
      usuarioId: string;
    },
  ) {
    const { productoId, codigo, unidades, costoUnitario, usuarioId } = params;
    // El libro solo admite pesos enteros, así que el valor se redondea aquí y
    // no en el motor contable, que lo rechazaría.
    const valor = Math.round(Math.abs(unidades) * Number(costoUnitario || 0));
    if (valor <= 0 || !usuarioId) return;

    const entra = unidades > 0;

    await this.ledgerService.registrarAsiento(
      {
        referenceType: 'AJUSTE' as any,
        referenceId: productoId,
        description:
          `${entra ? 'Entrada' : 'Salida'} de inventario — ${codigo}: ` +
          `${Math.abs(unidades)} und a $${costoUnitario}`,
        createdBy: usuarioId,
        lines: [
          {
            accountCode: '1.5',
            ...(entra ? { debitAmount: valor } : { creditAmount: valor }),
          },
          {
            accountCode: '2.1',
            ...(entra ? { creditAmount: valor } : { debitAmount: valor }),
          },
        ],
      } as any,
      tx,
    );
  }

  async exportarInventario(
    format: 'excel' | 'pdf',
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const fecha = getBogotaDayKey(new Date());

    if (format === 'excel') {
      const productos = await this.prisma.producto.findMany({
        where: { eliminadoEn: null },
        select: {
          codigo: true,
          nombre: true,
          descripcion: true,
          categoria: true,
          marca: true,
          modelo: true,
          costo: true,
          stock: true,
          stockMinimo: true,
          activo: true,
          precios: {
            // Se incluye meses = 0 porque es el precio de contado.
            where: { activo: true },
            select: { meses: true, precio: true, activo: true },
            orderBy: { meses: 'asc' },
          },
        },
        orderBy: { creadoEn: 'desc' },
      });

      return generarExcelInventarioImportable(
        productos.map((p) => ({
          codigo: p.codigo,
          nombre: p.nombre,
          descripcion: p.descripcion,
          categoria: p.categoria,
          marca: p.marca,
          modelo: p.modelo,
          costo: Number(p.costo) || 0,
          stock: Number(p.stock) || 0,
          stockMinimo: Number(p.stockMinimo) || 0,
          activo: Boolean(p.activo),
        })),
        productos.flatMap((p) =>
          p.precios.map((precio) => ({
            codigoProducto: p.codigo,
            meses: Number(precio.meses),
            precio: Number(precio.precio) || 0,
            activo: Boolean(precio.activo),
          })),
        ),
        fecha,
      );
    }

    const productos = await this.prisma.producto.findMany({
      where: { eliminadoEn: null },
      select: {
        codigo: true,
        nombre: true,
        categoria: true,
        marca: true,
        modelo: true,
        costo: true,
        stock: true,
        stockMinimo: true,
        activo: true,
        creadoEn: true,
      },
      orderBy: { creadoEn: 'desc' },
    });

    const filas: InventarioRow[] = productos.map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      marca: p.marca ?? null,
      modelo: p.modelo ?? null,
      costo: Number(p.costo) || 0,
      stock: Number(p.stock) || 0,
      stockMinimo: Number(p.stockMinimo) || 0,
      activo: Boolean(p.activo),
      creadoEn: p.creadoEn,
    }));

    const totales: InventarioTotales = {
      totalProductos: filas.length,
      totalValorInventario: filas.reduce(
        (acc, f) => acc + (Number(f.costo) || 0) * (Number(f.stock) || 0),
        0,
      ),
      productosBajoStock: filas.filter(
        (f) => Number(f.stock) <= Number(f.stockMinimo),
      ).length,
    };

    return generarPDFInventario(filas, totales, fecha);
  }

  async getInventoryStats() {
    const totalReferencias = await this.prisma.producto.count({
      where: { activo: true, eliminadoEn: null },
    });

    const products = await this.prisma.producto.findMany({
      where: { activo: true, eliminadoEn: null },
      select: { costo: true, stock: true, stockMinimo: true },
    });

    const totalValor = products.reduce(
      (acc, curr) => acc + Number(curr.costo) * curr.stock,
      0,
    );
    const bajoStock = products.filter((p) => p.stock <= p.stockMinimo).length;

    return {
      totalProductos: totalReferencias, // Changed key to match interface if needed, or kept generic
      totalReferencias,
      totalValorInventario: totalValor,
      productosBajoStock: bajoStock,
      productosActivos: totalReferencias, // Added based on frontend DTO
    };
  }

  async create(createInventoryDto: CreateInventoryDto, usuarioId?: string) {
    try {
      const existingProduct = await this.prisma.producto.findUnique({
        where: { codigo: createInventoryDto.codigo },
      });

      if (existingProduct) {
        throw new ConflictException('El código de producto ya existe');
      }

      // Handle prices: combine regular prices list with optional precioContado (meses=0)
      const preciosData = createInventoryDto.precios
        ? [...createInventoryDto.precios]
        : [];

      if (createInventoryDto.precioContado !== undefined) {
        // Check if meses 0 already exists in prices array (unlikely but safe to check)
        const hasContado = preciosData.some((p) => p.meses === 0);
        if (!hasContado) {
          preciosData.push({
            meses: 0,
            precio: createInventoryDto.precioContado,
          });
        }
      }

      let categoriaNombre = createInventoryDto.categoria || 'General';
      let categoriaId = createInventoryDto.categoriaId;

      if (categoriaId) {
        const cat = await (this.prisma as any).categoria.findUnique({
          where: { id: categoriaId },
        });
        if (cat) {
          categoriaNombre = cat.nombre;
        } else {
          // If ID invalid, maybe reset? Or throw?
          // Let's assume valid or ignore ID
          categoriaId = undefined;
        }
      } else if (createInventoryDto.categoria) {
        // Try to find category by name to link it if possible?
        const cat = await (this.prisma as any).categoria.findFirst({
          where: {
            nombre: {
              equals: createInventoryDto.categoria,
              mode: 'insensitive',
            },
          },
        });
        if (cat) {
          categoriaId = cat.id;
          categoriaNombre = cat.nombre; // Normalize case
        }
      }

      // El producto y su asiento de inventario van juntos: si el asiento
      // falla, el producto no queda registrado sin respaldo contable.
      const product = await this.prisma.$transaction(async (tx) => {
        const creado = await tx.producto.create({
          data: {
            codigo: createInventoryDto.codigo,
            nombre: createInventoryDto.nombre,
            descripcion: createInventoryDto.descripcion,
            categoria: categoriaNombre,
            categoriaId: categoriaId,
            marca: createInventoryDto.marca,
            modelo: createInventoryDto.modelo,
            costo: createInventoryDto.costo,
            stock: createInventoryDto.stock,
            stockMinimo: createInventoryDto.stockMinimo,
            activo: createInventoryDto.activo ?? true,
            precios: {
              create: preciosData.map((p) => ({
                meses: p.meses,
                precio: p.precio,
              })),
            },
          } as any,
          include: {
            precios: true,
          },
        } as any);

        await this.registrarMovimientoInventario(tx, {
          productoId: creado.id,
          codigo: creado.codigo,
          unidades: Number(creado.stock || 0),
          costoUnitario: Number(creado.costo || 0),
          usuarioId: usuarioId || '',
        });

        return creado;
      });

      this.notificacionesGateway.broadcastInventarioActualizado({
        action: 'create',
        product,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({
        accion: 'INVENTARIO_ACTUALIZADO',
      });
      return product;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('El código de producto ya existe');
        }
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.producto.findMany({
      where: { eliminadoEn: null },
      include: {
        precios: {
          orderBy: { meses: 'asc' },
        },
      },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.producto.findUnique({
      where: { id },
      include: {
        precios: {
          orderBy: { meses: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }

  async update(
    id: string,
    updateInventoryDto: UpdateInventoryDto,
    usuarioId?: string,
  ) {
    const existingProduct = await this.prisma.producto.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Check code uniqueness only if changed
    if (
      updateInventoryDto.codigo &&
      updateInventoryDto.codigo !== existingProduct.codigo
    ) {
      const duplicate = await this.prisma.producto.findUnique({
        where: { codigo: updateInventoryDto.codigo },
      });
      if (duplicate)
        throw new ConflictException('El código de producto ya existe');
    }

    try {
      // Transaction to handle updates and nested prices
      const updatedProduct = await this.prisma.$transaction(async (tx) => {
        // Resolve Category
        let catName = updateInventoryDto.categoria;
        let catId: string | null | undefined = updateInventoryDto.categoriaId;

        if (catId !== undefined || catName !== undefined) {
          // If either is changing, we re-evaluate
          if (catId) {
            const cat = await tx.categoria.findUnique({
              where: { id: catId },
            });
            if (cat) {
              catName = cat.nombre;
            } else {
              catId = null; // Invalid ID provided, unlink
            }
          } else if (catName) {
            // Name provided, try to find match
            const cat = await tx.categoria.findFirst({
              where: { nombre: { equals: catName, mode: 'insensitive' } },
            });
            if (cat) {
              catId = cat.id;
              catName = cat.nombre;
            } else {
              catId = null; // No match, unlink
            }
          }
        }

        // Update basic fields
        await tx.producto.update({
          where: { id },
          data: {
            codigo: updateInventoryDto.codigo,
            nombre: updateInventoryDto.nombre,
            descripcion: updateInventoryDto.descripcion,
            categoria: catName,
            categoriaId: catId,
            marca: updateInventoryDto.marca,
            modelo: updateInventoryDto.modelo,
            costo: updateInventoryDto.costo,
            stock: updateInventoryDto.stock,
            stockMinimo: updateInventoryDto.stockMinimo,
            activo: updateInventoryDto.activo,
          },
        } as any);

        // Handle Prices: simplest approach is delete all and recreate if provided,
        // OR selectively upsert.
        // For simplicity and correctness with "full update" semantics of the form:
        // if prices are provided in DTO, we sync them.

        // However, updateInventoryDto extends Partial(Create), so prices might be undefined.
        // If prices IS defined (even empty array), we should update.
        if (
          updateInventoryDto.precios ||
          updateInventoryDto.precioContado !== undefined
        ) {
          // We need to construct the new full list of prices based on what's provided or existing?
          // The DTO from frontend usually sends the full list of credit prices.
          // BUT precioContado is separate.

          // Strategy:
          // 1. Delete all existing prices for this product.
          // 2. Recreate from DTO.

          // CAUTION: This deletes history if we tracked price history, but current schema is simple relation.

          // If precios is undefined, we might NOT want to delete them unless we know for sure.
          // But let's assume if update is called, the form sends everything.

          // If the DTO only sends partial updates, this might be risky.
          // Let's assume the frontend sends the whole price list if it edits prices.

          if (updateInventoryDto.precios) {
            await tx.precioProducto.deleteMany({
              where: { productoId: id, meses: { gt: 0 } }, // Delete credit prices
            });

            if (updateInventoryDto.precios.length > 0) {
              await tx.precioProducto.createMany({
                data: updateInventoryDto.precios.map((p) => ({
                  productoId: id,
                  meses: p.meses,
                  precio: p.precio,
                })),
              });
            }
          }

          if (updateInventoryDto.precioContado !== undefined) {
            // Update or create precioContado (meses=0)
            await tx.precioProducto.upsert({
              where: { productoId_meses: { productoId: id, meses: 0 } },
              update: { precio: updateInventoryDto.precioContado },
              create: {
                productoId: id,
                meses: 0,
                precio: updateInventoryDto.precioContado,
              },
            });
          }
        }

        // Si cambió el stock, el libro tiene que enterarse. Se registra la
        // diferencia, no el total: sumar el stock entero cada vez que se edita
        // el nombre del artículo inflaría el inventario.
        const despues = await tx.producto.findUnique({
          where: { id },
          include: { precios: { orderBy: { meses: 'asc' } } },
        });

        const diferencia =
          Number(despues?.stock ?? 0) - Number(existingProduct.stock ?? 0);
        if (diferencia !== 0) {
          await this.registrarMovimientoInventario(tx, {
            productoId: id,
            codigo: despues?.codigo ?? existingProduct.codigo,
            unidades: diferencia,
            costoUnitario: Number(despues?.costo ?? existingProduct.costo ?? 0),
            usuarioId: usuarioId || '',
          });
        }

        return despues;
      });

      this.notificacionesGateway.broadcastInventarioActualizado({
        action: 'update',
        product: updatedProduct,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({
        accion: 'INVENTARIO_ACTUALIZADO',
      });
      return updatedProduct;
    } catch (error) {
      throw error;
    }
  }

  async remove(id: string) {
    const existingProduct = await this.prisma.producto.findUnique({
      where: { id },
    });

    if (!existingProduct) throw new NotFoundException('Producto no encontrado');

    // Soft delete
    const deletedProduct = await this.prisma.producto.update({
      where: { id },
      data: {
        eliminadoEn: new Date(),
        activo: false,
      },
    });

    this.notificacionesGateway.broadcastInventarioActualizado({
      action: 'remove',
      id,
    });
    this.notificacionesGateway.broadcastDashboardsActualizados({
      accion: 'INVENTARIO_ACTUALIZADO',
    });
    return deletedProduct;
  }

  async findArchived() {
    return this.prisma.producto.findMany({
      where: {
        eliminadoEn: { not: null },
        ocultoArchivadosEn: null,
      },
      include: {
        precios: {
          orderBy: { meses: 'asc' },
        },
      },
      orderBy: { eliminadoEn: 'desc' },
    });
  }

  async restore(id: string) {
    const existingProduct = await this.prisma.producto.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingProduct) throw new NotFoundException('Producto no encontrado');

    const restoredProduct = await this.prisma.producto.update({
      where: { id },
      data: {
        eliminadoEn: null,
        ocultoArchivadosEn: null,
        activo: true,
      },
    });

    this.notificacionesGateway.broadcastInventarioActualizado({
      action: 'restore',
      id,
    });
    return restoredProduct;
  }

  async hideArchived(id: string) {
    const existingProduct = await this.prisma.producto.findUnique({
      where: { id },
      select: { id: true, eliminadoEn: true },
    });

    if (!existingProduct) throw new NotFoundException('Producto no encontrado');

    // Solo aplica para elementos archivados
    if (!existingProduct.eliminadoEn) {
      throw new ConflictException('El producto no está archivado');
    }

    const hiddenProduct = await this.prisma.producto.update({
      where: { id },
      data: {
        ocultoArchivadosEn: new Date(),
      },
    });

    this.notificacionesGateway.broadcastInventarioActualizado({
      action: 'hideArchived',
      id,
    });
    return hiddenProduct;
  }
}
