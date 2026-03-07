import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class MirrorSyncService {
  private readonly logger = new Logger(MirrorSyncService.name);

  constructor(@InjectQueue('mirror-sync-queue') private syncQueue: Queue) {}

  @OnEvent('database.write.success')
  async handleDatabaseWriteEvent(payload: { model: string, action: string, data: any }) {
    // Exclude certain non-essential operational tables from remote synchronization
    const excludedModels = ['SyncConflict', 'AuditLog', 'Session', 'PushSubscription'];
    if (excludedModels.includes(payload.model)) return;

    try {
      this.logger.debug(`Encolando sync para ${payload.model} [${payload.action}]`);
      
      await this.syncQueue.add(
        'sync-record', 
        payload, 
        { 
          // Reintentos con backoff progresivo (Si el VPS se cae, acumula días intentando)
          attempts: 1000, 
          backoff: {
            type: 'exponential',
            delay: 5000, 
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
    } catch (err) {
      this.logger.error('Error crudo al insertar trabajo de sincronización en la cola BullMQ', err);
    }
  }
}
