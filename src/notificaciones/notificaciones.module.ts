import { Module, Global } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { PrismaModule } from '../prisma/prisma.module'; 
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesGateway } from './notificaciones.gateway';
import { PushModule } from '../push/push.module';

@Global() // Hacemos el módulo global para no tener que importarlo en todos lados
@Module({
  imports: [PrismaModule, PushModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, NotificacionesGateway],
  exports: [NotificacionesService, NotificacionesGateway],
})
export class NotificacionesModule {}
