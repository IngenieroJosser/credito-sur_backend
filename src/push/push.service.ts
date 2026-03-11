import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

export interface SendPushNotificationDto {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  userId?: string;
  roleFilter?: string[];
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private isInitialized = false;

  constructor(private prisma: PrismaService) {
    // Configurar llaves VAPID
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const mailto = process.env.VAPID_MAILTO || 'mailto:erickmanuel238@gmail.com';

    if (publicKey && privateKey) {
      try {
        webpush.setVapidDetails(mailto, publicKey, privateKey);
        this.isInitialized = true;
      } catch (error) {
        this.logger.error('Error al configurar llaves VAPID:', error);
      }
    } else {
      this.logger.warn(
        'Notificaciones Push desactivadas: Faltan las variables de entorno VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY'
      );
    }
  }

  async sendPushNotification(data: SendPushNotificationDto): Promise<void> {
    if (!this.isInitialized) {
      this.logger.warn('Intento de enviar notificación push pero el servicio no está configurado');
      return;
    }
    try {
      // Obtener suscripciones de push
      let subscriptions = await this.prisma.pushSubscription.findMany({
        where: { activa: true }
      });

      // Filtrar por usuario si se especifica
      if (data.userId) {
        subscriptions = subscriptions.filter(sub => sub.usuarioId === data.userId);
      }

      // Filtrar por rol si se especifica
      if (data.roleFilter && data.roleFilter.length > 0) {
        const usuarios = await this.prisma.usuario.findMany({
          where: {
            rol: { in: data.roleFilter as any },
            estado: 'ACTIVO'
          }
        });
        const usuarioIds = usuarios.map(u => u.id);
        subscriptions = subscriptions.filter(sub => usuarioIds.includes(sub.usuarioId));
      }

      // Enviar notificaciones a cada suscripción
      const payload = {
        title: data.title,
        body: data.body,
        icon: data.icon || '/android-chrome-192x192.png',
        badge: data.badge || '/android-chrome-192x192.png',
        tag: data.tag || 'general',
        data: {
          ...data.data,
          timestamp: new Date().toISOString()
        }
      };

      for (const subscription of subscriptions) {
        const pushSub = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        };
        await this.sendToSubscription(pushSub, payload);
      }

      this.logger.log(`Push notification sent to ${subscriptions.length} subscribers`);
    } catch (error) {
      this.logger.error('Error sending push notification:', error);
    }
  }

  private async sendToSubscription(subscription: any, payload: any): Promise<void> {
    try {
      this.logger.log(`Enviando push real a: ${subscription.endpoint}`);
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        this.logger.warn(`Suscripción expirada o inválida, eliminando: ${subscription.endpoint}`);
        await this.prisma.pushSubscription.update({
          where: { endpoint: subscription.endpoint },
          data: { activa: false }
        });
      } else {
        this.logger.error(`Error enviando a ${subscription.endpoint}:`, error);
      }
    }
  }

  async subscribeUser(userId: string, subscription: any): Promise<void> {
    try {
      await this.prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        update: {
          usuarioId: userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          activa: true
        },
        create: {
          endpoint: subscription.endpoint,
          usuarioId: userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          activa: true
        }
      });

      this.logger.log(`User ${userId} subscribed to push notifications`);
    } catch (error) {
      this.logger.error('Error subscribing user:', error);
    }
  }

  async unsubscribeUser(endpoint: string): Promise<void> {
    try {
      await this.prisma.pushSubscription.update({
        where: { endpoint },
        data: { activa: false }
      });

      this.logger.log(`Unsubscribed: ${endpoint}`);
    } catch (error) {
      this.logger.error('Error unsubscribing:', error);
    }
  }
}
