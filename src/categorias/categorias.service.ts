import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  CreateCategoriaDto,
  UpdateCategoriaDto,
} from './dto/create-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateCategoriaDto) {
    return (this.prisma as any).categoria.create({
      data: {
        ...data,
      },
    });
  }

  async findAll(tipo?: string) {
    return (this.prisma as any).categoria.findMany({
      where: {
        tipo: tipo || undefined,
        activa: true,
        eliminadoEn: null,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string) {
    return (this.prisma as any).categoria.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: Partial<UpdateCategoriaDto>) {
    return (this.prisma as any).categoria.update({
      where: { id },
      data: {
        ...data,
      },
    });
  }

  async remove(id: string) {
    return (this.prisma as any).categoria.update({
      where: { id },
      data: {
        activa: false,
        eliminadoEn: new Date(),
      },
    });
  }
}
