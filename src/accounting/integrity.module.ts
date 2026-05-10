import { Module } from '@nestjs/common';
import { AccountingModule } from './accounting.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AccountingIntegrityCron } from './accounting-integrity.cron';

@Module({
  imports: [
    AccountingModule,
    // NotificacionesModule es Global, pero lo importamos explícitamente para mayor claridad 
    // y para asegurar que el Cron pueda inyectar NotificacionesService sin ciclos.
    NotificacionesModule, 
  ],
  providers: [AccountingIntegrityCron],
})
export class IntegrityModule {}
