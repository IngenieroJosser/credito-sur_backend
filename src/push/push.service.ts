import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';
import { RolUsuario } from '@prisma/client';
import { estadoDeError } from '../common/error.util';
import { formatBogotaOffsetIso } from '../utils/date-utils';

export interface SendPushNotificationDto {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  userId?: string;
  roleFilter?: RolUsuario[];
}

/** Resultado de un envío, para poder comprobar desde la app si llegó. */
export interface ResultadoEnvioPush {
  /** Si hay llaves VAPID configuradas. Sin ellas no se envía nada. */
  configurado: boolean;
  suscripciones: number;
  enviadas: number;
  /** Rechazadas por el servicio push con 404/410: el registro venció y se desactiva. */
  desactivadas: number;
  fallidas: number;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private isInitialized = false;

  constructor(private prisma: PrismaService) {
    // Configurar llaves VAPID
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const mailto =
      process.env.VAPID_MAILTO || 'mailto:erickmanuel238@gmail.com';

    if (publicKey && privateKey) {
      try {
        webpush.setVapidDetails(mailto, publicKey, privateKey);
        this.isInitialized = true;
      } catch (error) {
        this.logger.error('Error al configurar llaves VAPID:', error);
      }
    } else {
      this.logger.warn(
        'Notificaciones Push desactivadas: Faltan las variables de entorno VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY',
      );
    }
  }

  async sendPushNotification(
    data: SendPushNotificationDto,
  ): Promise<ResultadoEnvioPush> {
    const resultado: ResultadoEnvioPush = {
      configurado: this.isInitialized,
      suscripciones: 0,
      enviadas: 0,
      desactivadas: 0,
      fallidas: 0,
    };
    if (!this.isInitialized) {
      this.logger.warn(
        'Intento de enviar notificación push pero el servicio no está configurado',
      );
      return resultado;
    }
    try {
      // Obtener suscripciones de push
      let subscriptions = await this.prisma.pushSubscription.findMany({
        where: { activa: true },
      });

      // Filtrar por usuario si se especifica
      if (data.userId) {
        subscriptions = subscriptions.filter(
          (sub) => sub.usuarioId === data.userId,
        );
      }

      // Filtrar por rol si se especifica
      if (data.roleFilter && data.roleFilter.length > 0) {
        const usuarios = await this.prisma.usuario.findMany({
          where: {
            rol: { in: data.roleFilter },
            estado: 'ACTIVO',
          },
        });
        const usuarioIds = usuarios.map((u) => u.id);
        subscriptions = subscriptions.filter((sub) =>
          usuarioIds.includes(sub.usuarioId),
        );
      }

      // Enviar notificaciones a cada suscripción
      const payload = {
        title: data.title,
        body: data.body,
        icon: data.icon || '/android-chrome-192x192.png',
        badge: data.badge || '/android-chrome-192x192.png',
        // Sin tag por defecto. Antes todo iba con 'general' y el service worker
        // usa el tag tal cual: cada notificación reemplazaba a la anterior, así
        // que de varios avisos de mora solo quedaba visible el último.
        tag: data.tag,
        data: {
          ...data.data,
          timestamp: formatBogotaOffsetIso(new Date()),
        },
      };

      resultado.suscripciones = subscriptions.length;
      for (const subscription of subscriptions) {
        const pushSub = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        };
        const estado = await this.sendToSubscription(pushSub, payload);
        resultado[estado]++;
      }

      this.logger.log(
        `Push: ${resultado.enviadas} enviadas, ${resultado.desactivadas} desactivadas y ${resultado.fallidas} fallidas de ${subscriptions.length}`,
      );
    } catch (error) {
      this.logger.error('Error sending push notification:', error);
    }
    return resultado;
  }

  private async sendToSubscription(
    subscription: any,
    payload: any,
  ): Promise<'enviadas' | 'desactivadas' | 'fallidas'> {
    try {
      this.logger.log(`Enviando push real a: ${subscription.endpoint}`);
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      return 'enviadas';
    } catch (error) {
      const estado = estadoDeError(error);
      if (estado === 410 || estado === 404) {
        this.logger.warn(
          `Suscripción expirada o inválida, eliminando: ${subscription.endpoint}`,
        );
        await this.prisma.pushSubscription.update({
          where: { endpoint: subscription.endpoint },
          data: { activa: false },
        });
        return 'desactivadas';
      }
      this.logger.error(`Error enviando a ${subscription.endpoint}:`, error);
      return 'fallidas';
    }
  }

  async subscribeUser(userId: string, subscription: any) {
    try {
      const saved = await this.prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        update: {
          usuarioId: userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          activa: true,
        },
        create: {
          endpoint: subscription.endpoint,
          usuarioId: userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          activa: true,
        },
      });

      this.logger.log(`User ${userId} subscribed to push notifications`);
      return {
        id: saved.id,
        userId: saved.usuarioId,
        endpoint: saved.endpoint,
        createdAt: saved.creadoEn,
      };
    } catch (error) {
      this.logger.error('Error subscribing user:', error);
      throw error;
    }
  }

  async getUserSubscriptions(userId: string) {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        usuarioId: userId,
        activa: true,
      },
      select: {
        id: true,
        usuarioId: true,
        endpoint: true,
        creadoEn: true,
      },
      orderBy: { creadoEn: 'desc' },
    });

    return subscriptions.map((subscription) => ({
      id: subscription.id,
      userId: subscription.usuarioId,
      endpoint: subscription.endpoint,
      createdAt: subscription.creadoEn,
    }));
  }

  async unsubscribeUser(endpoint: string, userId: string): Promise<void> {
    try {
      await this.prisma.pushSubscription.updateMany({
        where: { endpoint, usuarioId: userId },
        data: { activa: false },
      });

      this.logger.log(`Unsubscribed: ${endpoint}`);
    } catch (error) {
      this.logger.error('Error unsubscribing:', error);
    }
  }
}
