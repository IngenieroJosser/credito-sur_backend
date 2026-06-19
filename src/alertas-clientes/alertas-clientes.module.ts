import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { PushModule } from '../push/push.module';
import { AlertasClientesController } from './alertas-clientes.controller';
import { AlertasClientesService } from './alertas-clientes.service';

@Module({
  imports: [PrismaModule, NotificacionesModule, PushModule],
  controllers: [AlertasClientesController],
  providers: [AlertasClientesService],
  exports: [AlertasClientesService],
})
export class AlertasClientesModule {}
