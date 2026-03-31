import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupExcelService } from './backup-excel.service';

@Module({
  imports: [PrismaModule],
  controllers: [BackupController],
  providers: [BackupService, BackupExcelService],
})
export class BackupModule {}
