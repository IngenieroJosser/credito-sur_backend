import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [AuditModule, NotificacionesModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
