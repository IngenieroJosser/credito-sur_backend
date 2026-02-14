import { Module, Global } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { PrismaModule } from '../prisma/prisma.module'; 
import { NotificacionesController } from './notificaciones.controller';

@Global() // Hacemos el módulo global para no tener que importarlo en todos lados
@Module({
  imports: [PrismaModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
