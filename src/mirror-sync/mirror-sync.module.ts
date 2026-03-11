import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MirrorSyncService } from './mirror-sync.service';
import { MirrorSyncProcessor } from './mirror-sync.processor';
import { MirrorSyncController } from './mirror-sync.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'mirror-sync-queue',
    }),
  ],
  controllers: [MirrorSyncController],
  providers: [MirrorSyncService, MirrorSyncProcessor],
  exports: [MirrorSyncService],
})
export class MirrorSyncModule {}
