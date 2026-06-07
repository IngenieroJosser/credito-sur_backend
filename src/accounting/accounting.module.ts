import { Module } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { LedgerService } from './ledger.service';
import { RoutesModule } from '../routes/routes.module';

@Module({
  imports: [RoutesModule],
  controllers: [AccountingController],
  providers: [AccountingService, LedgerService],
  exports: [LedgerService],
})
export class AccountingModule {}
