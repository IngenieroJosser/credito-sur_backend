import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { MoraService } from './mora.service';
import { PrismaModule } from '../prisma/prisma.module'; 
import { PrismaService } from '../prisma/prisma.service';
import { LoggerMiddleware } from '../common/middleware/logger.middleware';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AuditModule } from '../audit/audit.module';
import { PushModule } from '../push/push.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [PrismaModule, NotificacionesModule, AuditModule, PushModule, ConfiguracionModule],
  controllers: [LoansController],
  providers: [LoansService, MoraService, PrismaService],
  exports: [LoansService, MoraService],
})
export class LoansModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('loans');
  }
}
