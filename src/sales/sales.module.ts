import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
