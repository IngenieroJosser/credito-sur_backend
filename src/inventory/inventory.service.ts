import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getInventoryStats() {
    const totalReferencias = await this.prisma.producto.count({
      where: { activo: true },
    });

    const products = await this.prisma.producto.findMany({
      where: { activo: true },
      select: { costo: true, stock: true, stockMinimo: true },
    });

    const totalValor = products.reduce(
      (acc, curr) => acc + Number(curr.costo) * curr.stock,
      0,
    );
    const bajoStock = products.filter((p) => p.stock <= p.stockMinimo).length;

    return {
      totalReferencias,
      totalValorInventario: totalValor,
      productosBajoStock: bajoStock,
    };
  }

  create(_createInventoryDto: CreateInventoryDto) {
    return 'This action adds a new inventory';
  }

  findAll() {
    return `This action returns all inventory`;
  }

  findOne(id: number) {
    return `This action returns a #${id} inventory`;
  }

  update(id: number, _updateInventoryDto: UpdateInventoryDto) {
    return `This action updates a #${id} inventory`;
  }

  remove(id: number) {
    return `This action removes a #${id} inventory`;
  }
}
