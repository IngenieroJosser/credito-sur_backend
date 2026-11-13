import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { MirrorModule } from '../mirror/mirror.module';

@Module({
  imports: [MirrorModule],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
