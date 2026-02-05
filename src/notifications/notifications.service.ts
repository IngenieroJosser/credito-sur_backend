import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { RolUsuario } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: {
    usuarioId: string;
    titulo: string;
    mensaje: string;
    tipo?: string;
    entidad?: string;
    entidadId?: string;
    metadata?: any;
  }) {
    try {
      return await this.prisma.notificacion.create({
        data: {
          usuarioId: data.usuarioId,
          titulo: data.titulo,
          mensaje: data.mensaje,
          tipo: data.tipo || 'INFO',
          entidad: data.entidad,
          entidadId: data.entidadId,
          metadata: data.metadata || {},
        },
      });
    } catch (error) {
      this.logger.error(
        `Error creating notification for user ${data.usuarioId}:`,
        error,
      );
      // No lanzamos error para no interrumpir el flujo principal del negocio
    }
  }

  async notifyCoordinator(data: {
    titulo: string;
    mensaje: string;
    tipo?: string;
    entidad?: string;
    entidadId?: string;
    metadata?: any;
  }) {
    try {
      // 1. Buscar todos los coordinadores
      const coordinadores = await this.prisma.usuario.findMany({
        where: {
          rol: RolUsuario.COORDINADOR,
          estado: 'ACTIVO',
        },
      });

      this.logger.log(
        `Notifying ${coordinadores.length} coordinators: ${data.titulo}`,
      );

      // 2. Crear notificación para cada uno
      await Promise.all(
        coordinadores.map((coord) =>
          this.create({
            usuarioId: coord.id,
            ...data,
          }),
        ),
      );
    } catch (error) {
      this.logger.error('Error notifying coordinators:', error);
    }
  }

  async findAll(userId: string) {
    return this.prisma.notificacion.findMany({
      where: { usuarioId: userId, archivar: false },
      orderBy: { creadoEn: 'desc' },
      take: 50,
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notificacion.update({
      where: { id },
      data: { leida: true },
    });
  }
}
