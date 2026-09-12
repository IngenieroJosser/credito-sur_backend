import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { PushService } from './push.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@ApiTags('Push Notifications')
@Controller('push')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Suscribir usuario a notificaciones push' })
  async subscribe(
    @Body() body: { subscription: any },
    @Request() req: { user?: { id?: string } },
  ) {
    return this.pushService.subscribeUser(
      String(req.user?.id || ''),
      body.subscription,
    );
  }

  @Delete('unsubscribe/:endpoint')
  @ApiOperation({ summary: 'Desuscribir usuario de notificaciones push' })
  async unsubscribe(
    @Param('endpoint') endpoint: string,
    @Request() req: { user?: { id?: string } },
  ) {
    return this.pushService.unsubscribeUser(
      decodeURIComponent(endpoint),
      String(req.user?.id || ''),
    );
  }

  @Get('subscriptions')
  @ApiOperation({
    summary: 'Listar suscripciones push activas del usuario autenticado',
  })
  async getUserSubscriptions(@Request() req: { user?: { id?: string } }) {
    return this.pushService.getUserSubscriptions(String(req.user?.id || ''));
  }

  /**
   * Envía una notificación de prueba SOLO a los dispositivos de quien la pide.
   *
   * Existe aparte de `send` porque esa ruta está limitada a roles de oficina:
   * el botón de prueba fallaba siempre para cobradores y supervisores.
   * Devuelve el resultado para que la app muestre si la prueba llegó.
   */
  @Post('test')
  @ApiOperation({
    summary: 'Enviar una notificación de prueba al usuario autenticado',
  })
  async enviarPrueba(@Request() req: { user?: { id?: string } }) {
    const userId = String(req.user?.id || '');
    // Sin usuario no se envía: con userId vacío el servicio no filtra y le
    // llegaría la prueba a TODOS los dispositivos registrados.
    if (!userId) throw new UnauthorizedException('Usuario no autenticado');
    return this.pushService.sendPushNotification({
      userId,
      title: 'Notificación de prueba',
      body: 'Si ves esto, las notificaciones de Credisur llegan a este dispositivo.',
      data: { tipo: 'TEST', url: '/' },
    });
  }

  @Post('send')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
  )
  @ApiOperation({ summary: 'Enviar notificación push' })
  async send(@Body() data: any) {
    return this.pushService.sendPushNotification(data);
  }
}
