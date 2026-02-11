import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    usuarioId: string;
    accion: string;
    entidad: string;
    entidadId: string;
    datosAnteriores?: any;
    datosNuevos?: any;
    metadata?: any;
  }) {
    // Si no hay datos, intentar inferir cambios
    let cambios: any = null;
    if (data.datosAnteriores && data.datosNuevos) {
      // Aquí podrías implementar una lógica para calcular diferencias
      cambios = { diff: 'calculated' };
    }

    return this.prisma.registroAuditoria.create({
      data: {
        usuarioId: data.usuarioId,
        accion: data.accion,
        entidad: data.entidad,
        entidadId: data.entidadId,
        valoresAnteriores: data.datosAnteriores || {},
        valoresNuevos: data.datosNuevos || {},
        cambios: cambios || {},
        direccionIP: data.metadata?.ip,
        agenteUsuario: data.metadata?.userAgent,
        endpoint: data.metadata?.endpoint,
      },
    });
  }

  async findAll() {
    return this.prisma.registroAuditoria.findMany({
      orderBy: { creadoEn: 'desc' },
      take: 100,
      include: {
        usuario: {
          select: { nombres: true, apellidos: true, correo: true, rol: true },
        },
      },
    });
  }

  async findByUserId(
    usuarioId: string,
    take: number = 20,
    page: number = 1,
    startDate?: Date,
    endDate?: Date,
  ) {
    const skip = page > 1 ? (page - 1) * take : 0;
    const where: any = { usuarioId };
    if (startDate || endDate) {
      where.creadoEn = {};
      if (startDate) where.creadoEn.gte = startDate;
      if (endDate) where.creadoEn.lte = endDate;
    }
    return this.prisma.registroAuditoria.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      take,
      skip,
      select: {
        id: true,
        accion: true,
        entidad: true,
        entidadId: true,
        valoresAnteriores: true,
        valoresNuevos: true,
        cambios: true,
        creadoEn: true,
        endpoint: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.registroAuditoria.findUnique({
      where: { id },
    });
  }
}
