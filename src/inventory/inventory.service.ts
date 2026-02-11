import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(createInventoryDto: CreateInventoryDto) {
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

      const product = await this.prisma.producto.create({
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

  async update(id: string, updateInventoryDto: UpdateInventoryDto) {
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
      return await this.prisma.$transaction(async (tx) => {
        // Resolve Category
        let catName = updateInventoryDto.categoria;
        let catId: string | null | undefined = updateInventoryDto.categoriaId;

        if (catId !== undefined || catName !== undefined) {
          // If either is changing, we re-evaluate
          if (catId) {
            const cat = await (tx as any).categoria.findUnique({
              where: { id: catId },
            });
            if (cat) {
              catName = cat.nombre;
            } else {
              catId = null; // Invalid ID provided, unlink
            }
          } else if (catName) {
            // Name provided, try to find match
            const cat = await (tx as any).categoria.findFirst({
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

        return await tx.producto.findUnique({
          where: { id },
          include: { precios: { orderBy: { meses: 'asc' } } },
        });
      });
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
    return await this.prisma.producto.update({
      where: { id },
      data: {
        eliminadoEn: new Date(),
        activo: false,
      },
    });
  }
}
