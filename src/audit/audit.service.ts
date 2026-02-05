import { Injectable } from '@nestjs/common';
import { CreateAuditDto } from './dto/create-audit.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';
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

  findOne(id: string) {
    return this.prisma.registroAuditoria.findUnique({
      where: { id },
    });
  }
}
