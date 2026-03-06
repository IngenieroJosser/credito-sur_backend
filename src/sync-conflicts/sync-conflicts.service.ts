import { Injectable } from '@nestjs/common';
import { CreateSyncConflictDto } from './dto/create-sync-conflict.dto';
import { UpdateSyncConflictDto } from './dto/update-sync-conflict.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SyncConflictsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createSyncConflictDto: CreateSyncConflictDto, userId?: string) {
    return this.prisma.syncConflict.create({
      data: {
        ...createSyncConflictDto,
        creadoPorId: userId,
      },
    });
  }

  async findAll() {
    return this.prisma.syncConflict.findMany({
      orderBy: { creadoEn: 'desc' },
      include: {
        creadoPor: {
          select: { id: true, nombres: true, apellidos: true },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.syncConflict.findUnique({
      where: { id },
      include: {
        creadoPor: {
          select: { id: true, nombres: true, apellidos: true },
        },
        resueltoPor: {
          select: { id: true, nombres: true, apellidos: true },
        },
      },
    });
  }

  async update(id: string, updateSyncConflictDto: UpdateSyncConflictDto) {
    // Only implemented for completeness, normally we just resolve/dismiss conflicts
    return this.prisma.syncConflict.update({
      where: { id },
      data: updateSyncConflictDto,
    });
  }

  async resolveConflict(id: string, accion: string, userId: string) {
    return this.prisma.syncConflict.update({
      where: { id },
      data: {
        estadoResolucion: accion === 'RESOLVER' ? 'RESUELTO' : 'DESCARTADO',
        resueltoPorId: userId,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.syncConflict.delete({
      where: { id },
    });
  }
}
