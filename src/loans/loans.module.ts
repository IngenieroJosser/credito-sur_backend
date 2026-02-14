import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { PrismaModule } from '../prisma/prisma.module'; 
import { LoggerMiddleware } from '../common/middleware/logger.middleware';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, NotificacionesModule, AuditModule],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('loans');
  }
}
