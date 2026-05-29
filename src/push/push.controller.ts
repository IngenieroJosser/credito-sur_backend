import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
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
