import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '@prisma/client';
import { NotificacionesGateway } from './notificaciones.gateway';
import { PushService } from '../push/push.service';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificacionesGateway))
    private notificacionesGateway: NotificacionesGateway,
    private pushService: PushService,
  ) {}

  private cleanNotificationText(txt: string): string {
    if (!txt) return txt;
    return txt
      .replace(/préstamo por artículo/gi, 'crédito por un artículo')
      .replace(/préstamo de artículo/gi, 'crédito por un artículo')
      .replace(/préstamo por un artículo/gi, 'crédito por un artículo')
      .replace(
        /solicitado un préstamo por artículo/gi,
        'solicitado un crédito por un artículo',
      )
      .replace(/préstamo en efectivo/gi, 'préstamo');
  }

  private buildPrestamoDatosExtra(p: any, datos: any = {}) {
    const interesTotal = Number(p?.interesTotal || 0);
    const tasaInteres = Number(p?.tasaInteres || 0);
    const cuotaInicial = Number(p?.cuotaInicial || datos?.cuotaInicial || 0);
    const monto = Number(p?.monto || datos?.monto || 0);
    const cantidadCuotas = Number(
      p?.cantidadCuotas || datos?.cuotas || datos?.cantidadCuotas || 0,
    );

    return {
      prestamoId: p.id,
      numeroPrestamo: p.numeroPrestamo,

      clienteId: p.clienteId,
      cliente:
        `${p.cliente?.nombres || ''} ${p.cliente?.apellidos || ''}`.trim(),
      nombreCliente:
        `${p.cliente?.nombres || ''} ${p.cliente?.apellidos || ''}`.trim(),
      clienteNombre:
        `${p.cliente?.nombres || ''} ${p.cliente?.apellidos || ''}`.trim(),
      cedula: String(p.cliente?.dni || ''),
      dni: String(p.cliente?.dni || ''),
      telefono: String(p.cliente?.telefono || ''),

      tipoPrestamo: p.tipoPrestamo,
      tipo: p.tipoPrestamo,

      monto,
      capitalSolicitado: monto,
      valorArticulo:
        String(p.tipoPrestamo || '').toUpperCase() === 'ARTICULO'
          ? monto + cuotaInicial
          : monto,

      cuotaInicial,
      cuotas: cantidadCuotas,
      cantidadCuotas,
      numCuotas: cantidadCuotas,

      plazoMeses: Number(p.plazoMeses || datos?.plazoMeses || 1),
      frecuenciaPago: p.frecuenciaPago || datos?.frecuenciaPago || 'DIARIO',

      tasaInteres,
      porcentaje: tasaInteres,
      interesTotal,
      montoTotal: monto + interesTotal,
      totalAPagar: monto + interesTotal,
      totalPagar: monto + interesTotal,

      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,

      articulo: p.producto?.nombre || datos?.articulo || '',
      notas: p.notas || datos?.notas || '',
      garantia: p.garantia || datos?.garantia || '',
    };
  }

  private async enrichNotificationForUi(notif: any) {
    const rawMeta = notif.metadata;
    const meta =
      typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta || {};

    let enrichedNotif: any = {
      ...notif,
      titulo: this.cleanNotificationText(notif.titulo),
      mensaje: this.cleanNotificationText(notif.mensaje),
    };

    try {
      let datosExtra = {};
      let aprobacionReal: any = null;

      // 1. Intentar buscar como Aprobación (solo si tiene entidadId)
      if (notif.entidadId) {
        const aprobacion = await this.prisma.aprobacion.findUnique({
          where: { id: notif.entidadId },
          select: {
            estado: true,
            tipoAprobacion: true,
            datosSolicitud: true,
            comentarios: true,
            referenciaId: true,
            tablaReferencia: true,
            solicitadoPor: { select: { nombres: true, apellidos: true } },
            aprobadoPor: { select: { nombres: true, apellidos: true } },
          },
        });

        if (aprobacion) {
          aprobacionReal = aprobacion;
          const rawDatos = aprobacion.datosSolicitud;
          const datos =
            typeof rawDatos === 'string'
              ? JSON.parse(rawDatos)
              : rawDatos || {};

          // Si la aprobación apunta a un préstamo, cargar datos reales
          if (
            aprobacion.referenciaId &&
            (aprobacion.tablaReferencia === 'Prestamo' ||
              aprobacion.tipoAprobacion === 'NUEVO_PRESTAMO')
          ) {
            const p = await this.prisma.prestamo.findUnique({
              where: { id: aprobacion.referenciaId },
              include: {
                cliente: true,
                producto: {
                  select: {
                    nombre: true,
                    precios: true,
                  },
                },
              },
            });
            if (p) {
              datosExtra = {
                ...this.buildPrestamoDatosExtra(p, datos),
                planesArticulo: Array.isArray(p.producto?.precios)
                  ? p.producto?.precios
                      .filter((pr) => pr.activo && pr.meses > 0)
                      .map((pr) => ({
                        meses: pr.meses,
                        precioTotal: Number(pr.precio),
                      }))
                  : undefined,
              };
            }
          }

          const nombreSolicitante = aprobacion.solicitadoPor
            ? `${aprobacion.solicitadoPor.nombres} ${aprobacion.solicitadoPor.apellidos}`.trim()
            : undefined;
          const nombreRevisor = aprobacion.aprobadoPor
            ? `${aprobacion.aprobadoPor.nombres} ${aprobacion.aprobadoPor.apellidos}`.trim()
            : undefined;
          const descOriginal =
            datos.descripcion || datos.motivo || datos.razon || undefined;

          const enrichedMetadata = {
            ...meta,
            ...datos,
            ...datosExtra,
            tipoAprobacion: meta.tipoAprobacion || aprobacion.tipoAprobacion,
            estadoAprobacion: aprobacion.estado,
            solicitadoPor: meta.solicitadoPor || nombreSolicitante,
            revisadoPor: nombreRevisor,
            motivoRechazo: aprobacion.comentarios,
            descSolicitud: descOriginal,
          };

          enrichedNotif = {
            ...enrichedNotif,
            metadata: enrichedMetadata,
            detalles: {
              ...(notif.detalles || {}),
              ...datos,
              ...datosExtra,
            },
            datosSolicitud: {
              ...datos,
              ...datosExtra,
            },
            aprobacion: aprobacionReal
              ? {
                  ...aprobacionReal,
                  datosSolicitud: {
                    ...datos,
                    ...datosExtra,
                  },
                }
              : undefined,
          };
        }
      }

      // Fallback explícito para préstamo (funciona incluso sin entidadId)
      const prestamoIdFromMeta =
        meta?.prestamoId || meta?.idPrestamo || meta?.referenciaId || null;

      const possiblePrestamoId =
        aprobacionReal?.referenciaId ||
        prestamoIdFromMeta ||
        (String(notif.entidad || '').toUpperCase() === 'PRESTAMO'
          ? notif.entidadId
          : null);

      if (possiblePrestamoId && !aprobacionReal) {
        const p = await this.prisma.prestamo.findUnique({
          where: { id: possiblePrestamoId },
          include: {
            cliente: true,
            producto: {
              select: {
                nombre: true,
                precios: true,
              },
            },
          },
        });

        if (p) {
          datosExtra = {
            ...datosExtra,
            ...this.buildPrestamoDatosExtra(p, meta),
            planesArticulo: Array.isArray(p.producto?.precios)
              ? p.producto?.precios
                  .filter((pr) => pr.activo && pr.meses > 0)
                  .map((pr) => ({
                    meses: pr.meses,
                    precioTotal: Number(pr.precio),
                  }))
              : undefined,
          };

          enrichedNotif = {
            ...enrichedNotif,
            metadata: {
              ...meta,
              ...datosExtra,
            },
            detalles: {
              ...(typeof enrichedNotif.detalles === 'object'
                ? enrichedNotif.detalles
                : {}),
              ...datosExtra,
            },
            datosSolicitud: {
              ...datosExtra,
            },
            aprobacion: undefined,
          };
        }
      }
    } catch (error) {
      this.logger.error('Error in notification enrichment:', error);
    }

    // Aplicamos la limpieza de texto al final para asegurarnos de que el texto enriquecido
    // o el original queden estandarizados.
    return {
      ...enrichedNotif,
      titulo: this.cleanNotificationText(enrichedNotif.titulo),
      mensaje: this.cleanNotificationText(enrichedNotif.mensaje),
    };
  }

  /**
   * Crea una notificación persistente y la emite en tiempo real a través de WebSockets y Push.
   */
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
      const cleanTitulo = this.cleanNotificationText(data.titulo);
      const cleanMensaje = this.cleanNotificationText(data.mensaje);

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
      const notificacion = await this.prisma.notificacion.create({
        data: {
          usuarioId: data.usuarioId,
          titulo: cleanTitulo,
          mensaje: cleanMensaje,
          tipo: tipoFinal,
          entidad: data.entidad,
          entidadId: data.entidadId,
          metadata: metadataFinal,
        },
      });

      // Enriquecer la notificación antes de emitirla por socket
      const notificacionEnriquecida =
        await this.enrichNotificationForUi(notificacion);

      // Emitir evento en tiempo real (WebSockets) con notificación enriquecida
      this.notificacionesGateway.enviarNotificacionAUsuario(
        data.usuarioId,
        notificacionEnriquecida,
      );
      this.notificacionesGateway.notificarActualizacion(data.usuarioId);

      // Enviar notificación Push (PWA)
      this.pushService
        .sendPushNotification({
          userId: data.usuarioId,
          title: cleanTitulo,
          body: cleanMensaje,
          data: {
            tipo: tipoFinal,
            entidadId: data.entidadId,
            entidad: data.entidad,
            link: notificacion.id ? `/notificaciones` : undefined, // Ajustar según necesidad
          },
        })
        .catch((err) => this.logger.error('Error enviando push:', err));

      return notificacionEnriquecida;
    } catch (error) {
      this.logger.error(
        `Error creando notificación para el usuario ${data.usuarioId}:`,
        error,
      );
      // No lanzamos error para no interrumpir el flujo principal del negocio (ej. si falla el socket)
    }
  }

  async createDeduped(data: {
    usuarioId: string;
    titulo: string;
    mensaje: string;
    tipo?: string;
    entidad?: string;
    entidadId?: string;
    metadata?: any;
    dedupeKey: string;
  }) {
    const dedupeKey = String(data.dedupeKey || '').trim();
    if (!dedupeKey) return this.create(data);

    const existing = await this.prisma.notificacion.findFirst({
      where: {
        usuarioId: data.usuarioId,
        archivar: false,
        metadata: {
          path: ['dedupeKey'],
          equals: dedupeKey,
        } as any,
      },
      orderBy: { creadoEn: 'desc' },
    });

    if (existing?.id) return this.enrichNotificationForUi(existing);

    return this.create({
      ...data,
      metadata: {
        ...(data.metadata || {}),
        dedupeKey,
      },
    });
  }

  async notifyRolesDeduped(data: {
    roles: RolUsuario[];
    titulo: string;
    mensaje: string;
    tipo?: string;
    entidad?: string;
    entidadId?: string;
    metadata?: any;
    dedupeKey: string;
  }) {
    try {
      const roles = Array.from(new Set(data.roles || []));
      if (roles.length === 0) return;

      const usuarios = await this.prisma.usuario.findMany({
        where: {
          rol: { in: roles },
          estado: 'ACTIVO',
        },
        select: { id: true },
      });

      await Promise.all(
        usuarios.map((user) =>
          this.createDeduped({
            usuarioId: user.id,
            titulo: data.titulo,
            mensaje: data.mensaje,
            tipo: data.tipo,
            entidad: data.entidad,
            entidadId: data.entidadId,
            metadata: data.metadata,
            dedupeKey: `${data.dedupeKey}:${user.id}`,
          }),
        ),
      );
    } catch (error) {
      this.logger.error('Error notifying roles with dedupe:', error);
    }
  }

  /**
   * Notifica a todos los coordinadores activos del sistema.
   */
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
        `Notificando a ${coordinadores.length} coordinadores: ${data.titulo}`,
      );

      // 2. Crear notificación para cada uno (esto dispara sockets y push automáticamente en this.create)
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
              RolUsuario.SUPERVISOR,
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

    // Enriquecer notificaciones usando la función reutilizable
    const enriquecidas = await Promise.all(
      notificaciones.map((notif) => this.enrichNotificationForUi(notif)),
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
