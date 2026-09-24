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
    tx: Prisma.TransactionClient,
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
        referenceType: 'AJUSTE',
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
      },
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

      // Precios: combina la lista de precios a crédito con el precio de contado opcional (meses=0)
      const preciosData = createInventoryDto.precios
        ? [...createInventoryDto.precios]
        : [];

      if (createInventoryDto.precioContado !== undefined) {
        // Verificar si meses=0 ya viene en el arreglo de precios (poco probable, pero conviene revisarlo)
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
        const cat = await (this.prisma).categoria.findUnique({
          where: { id: categoriaId },
        });
        if (cat) {
          categoriaNombre = cat.nombre;
        } else {
          // Si el ID no existe, se ignora y el producto queda sin categoría enlazada
          categoriaId = undefined;
        }
      } else if (createInventoryDto.categoria) {
        // Buscar la categoría por nombre para enlazarla si existe
        const cat = await (this.prisma).categoria.findFirst({
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
          },
          include: {
            precios: true,
          },
        });

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

    // Validar que el código sea único solo si cambió
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
      // Transacción que actualiza el producto y sus precios anidados
      const updatedProduct = await this.prisma.$transaction(async (tx) => {
        // Resolver la categoría
        let catName = updateInventoryDto.categoria;
        let catId: string | null | undefined = updateInventoryDto.categoriaId;

        if (catId !== undefined || catName !== undefined) {
          // Si cambia el id o el nombre, se vuelve a resolver
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

        // Actualizar los campos básicos
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
        });

        // Precios: el DTO extiende Partial(Create), así que 'precios' puede venir undefined.
        // Solo se sincronizan cuando el formulario los envía (incluso si llega un arreglo vacío).
        if (
          updateInventoryDto.precios ||
          updateInventoryDto.precioContado !== undefined
        ) {
          // El frontend envía la lista completa de precios a crédito, y el precio de
          // contado aparte. Por eso la estrategia es:
          //   1. Borrar los precios a crédito existentes del producto.
          //   2. Recrearlos desde el DTO.
          //   3. Hacer upsert del precio de contado (meses=0).
          // Si 'precios' viene undefined no se borra nada, para no perder los que ya hay.

          if (updateInventoryDto.precios) {
            await tx.precioProducto.deleteMany({
              where: { productoId: id, meses: { gt: 0 } }, // Borrar precios a crédito
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
            // Actualizar o crear el precio de contado (meses=0)
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
