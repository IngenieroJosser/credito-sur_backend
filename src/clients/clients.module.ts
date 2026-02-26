import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [AuditModule, NotificacionesModule, ConfiguracionModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
