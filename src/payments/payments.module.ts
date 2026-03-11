import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AuditModule } from '../audit/audit.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, NotificacionesModule, AuditModule, UploadModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
