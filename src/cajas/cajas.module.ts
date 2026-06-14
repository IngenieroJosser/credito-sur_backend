import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CajasController } from './cajas.controller';
import { CajasService } from './cajas.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerMiddleware } from '../common/middleware/logger.middleware';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [CajasController],
  providers: [CajasService, PrismaService],
  exports: [CajasService],
})
export class CajasModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('cajas');
  }
}
