import { Module } from '@nestjs/common';
import { SyncConflictsService } from './sync-conflicts.service';
import { SyncConflictsController } from './sync-conflicts.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SyncConflictsController],
  providers: [SyncConflictsService],
})
export class SyncConflictsModule {}
