import { Controller, Post, Delete, Body, Param } from '@nestjs/common';
import { PushService } from './push.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Push Notifications')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Suscribir usuario a notificaciones push' })
  async subscribe(@Body() body: { userId: string; subscription: any }) {
    return this.pushService.subscribeUser(body.userId, body.subscription);
  }

  @Delete('unsubscribe/:endpoint')
  @ApiOperation({ summary: 'Desuscribir usuario de notificaciones push' })
  async unsubscribe(@Param('endpoint') endpoint: string) {
    return this.pushService.unsubscribeUser(endpoint);
  }

  @Post('send')
  @ApiOperation({ summary: 'Enviar notificación push' })
  async send(@Body() data: any) {
    return this.pushService.sendPushNotification(data);
  }
}
