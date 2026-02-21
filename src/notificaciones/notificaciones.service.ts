import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '@prisma/client';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

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
      const map: Record<string, string> = {
        INFO: 'INFORMATIVO',
        WARNING: 'ADVERTENCIA',
        CRITICAL: 'CRITICO',
      };
      const incoming = (data.tipo || '').toUpperCase();
      const isSeverity = incoming in map;
      const tipoFinal = isSeverity ? 'SISTEMA' : data.tipo || 'SISTEMA';
      const metadataFinal = {
        ...(data.metadata || {}),
        nivel: isSeverity ? map[incoming] : undefined,
      };
      return await this.prisma.notificacion.create({
        data: {
          usuarioId: data.usuarioId,
          titulo: data.titulo,
          mensaje: data.mensaje,
          tipo: tipoFinal,
          entidad: data.entidad,
          entidadId: data.entidadId,
          metadata: metadataFinal,
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

  async notifyApprovers(data: {
    titulo: string;
    mensaje: string;
    tipo?: string;
    entidad?: string;
    entidadId?: string;
    metadata?: any;
  }) {
    try {
      const aprobadores = await this.prisma.usuario.findMany({
        where: {
          rol: {
            in: [
              RolUsuario.SUPER_ADMINISTRADOR,
              RolUsuario.ADMIN,
              RolUsuario.COORDINADOR,
            ],
          },
          estado: 'ACTIVO',
        },
      });

      this.logger.log(
        `Notifying ${aprobadores.length} approvers: ${data.titulo}`,
      );

      await Promise.all(
        aprobadores.map((user) =>
          this.create({
            usuarioId: user.id,
            ...data,
          }),
        ),
      );
    } catch (error) {
      this.logger.error('Error notifying approvers:', error);
    }
  }

  async findAll(userId: string) {
    const notificaciones = await this.prisma.notificacion.findMany({
      where: { usuarioId: userId, archivar: false },
      orderBy: { creadoEn: 'desc' },
      take: 50,
    });

    // Enriquecer notificaciones vinculadas a aprobaciones con estado real y nombre del solicitante
    const enriquecidas = await Promise.all(
      notificaciones.map(async (notif) => {
        const meta = (notif.metadata as any) || {};

        // Si tiene entidadId y parece una aprobación, buscar datos reales
        if (notif.entidadId && (notif.entidad === 'Aprobacion' || meta.tipoAprobacion || notif.entidad === 'GASTO')) {
          try {
            const aprobacion = await this.prisma.aprobacion.findUnique({
              where: { id: notif.entidadId },
              select: {
                estado: true,
                tipoAprobacion: true,
                datosSolicitud: true,
                comentarios: true,
                solicitadoPor: {
                  select: { nombres: true, apellidos: true },
                },
                aprobadoPor: {
                  select: { nombres: true, apellidos: true },
                },
              },
            });

            if (aprobacion) {
              const nombreSolicitante = aprobacion.solicitadoPor
                ? `${aprobacion.solicitadoPor.nombres} ${aprobacion.solicitadoPor.apellidos}`.trim()
                : undefined;
              
              const nombreRevisor = aprobacion.aprobadoPor
                ? `${aprobacion.aprobadoPor.nombres} ${aprobacion.aprobadoPor.apellidos}`.trim()
                : undefined;

              const datos = (aprobacion.datosSolicitud as any) || {};
              const descOriginal = datos.descripcion || datos.motivo || datos.razon || undefined;

              return {
                ...notif,
                metadata: {
                  ...meta,
                  tipoAprobacion: meta.tipoAprobacion || aprobacion.tipoAprobacion,
                  estadoAprobacion: aprobacion.estado,
                  solicitadoPor: meta.solicitadoPor || nombreSolicitante,
                  revisadoPor: nombreRevisor,
                  motivoRechazo: aprobacion.comentarios,
                  descSolicitud: descOriginal,
                },
              };
            }
          } catch {
            // Si no se encuentra la aprobación, retornar la notificación tal cual
          }
        }

        return notif;
      }),
    );

    return enriquecidas;
  }

  async markAsRead(id: string) {
    return this.prisma.notificacion.update({
      where: { id },
      data: { leida: true },
    });
  }
}
