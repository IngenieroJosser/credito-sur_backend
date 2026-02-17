import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private prisma: PrismaService) {}

  async sendPushNotification(data: SendPushNotificationDto): Promise<void> {
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
        await this.sendToSubscription(subscription.endpoint, payload);
      }

      this.logger.log(`Push notification sent to ${subscriptions.length} subscribers`);
    } catch (error) {
      this.logger.error('Error sending push notification:', error);
    }
  }

  private async sendToSubscription(endpoint: string, payload: any): Promise<void> {
    try {
      // Aquí iría la implementación real con Web Push Protocol
      // Por ahora, solo logueamos el envío
      this.logger.log(`Sending push to ${endpoint}:`, payload);
      
      // En producción, usarías algo como:
      // const webpush = require('web-push');
      // await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (error) {
      this.logger.error(`Error sending to ${endpoint}:`, error);
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
