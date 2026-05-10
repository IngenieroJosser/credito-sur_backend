import { Module } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { LedgerService } from './ledger.service';

@Module({
  controllers: [AccountingController],
  providers: [AccountingService, LedgerService],
  exports: [LedgerService],
})
export class AccountingModule {}
