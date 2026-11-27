import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImportacionesController } from './importaciones.controller';
import { ImportacionesService } from './importaciones.service';
import { ExpedienteHistoricoService } from './preparacion/expediente-historico.service';
import { CargaExpedienteHistoricoService } from './preparacion/carga-expediente-historico.service';
import { AccountingModule } from '../accounting/accounting.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, AccountingModule, NotificacionesModule],
  controllers: [ImportacionesController],
  providers: [ImportacionesService, ExpedienteHistoricoService, CargaExpedienteHistoricoService],
})
export class ImportacionesModule {}
