import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

type OutboxPayload = {
  model?: string;
  action?: string;
  data?: unknown;
};

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private readonly maxAttempts = 10;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('*/30 * * * * *')
  async handleOutboxTick() {
    await this.processPending();
  }

  async processPending(limit = 100) {
    if (this.processing) return;
    this.processing = true;

    try {
      const events = await this.prisma.outboxEvent.findMany({
        where: {
          OR: [
            { status: 'PENDING' },
            { status: 'FAILED', attempts: { lt: this.maxAttempts } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      for (const event of events) {
        await this.processEvent(event);
      }
    } finally {
      this.processing = false;
    }
  }

  private async processEvent(event: {
    id: string;
    eventType: string;
    aggregateType: string;
    payload: unknown;
  }) {
    const claimed = await this.prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: { in: ['PENDING', 'FAILED'] },
      },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    if (claimed.count !== 1) return;

    try {
      await this.publish(event);

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[OUTBOX] Error procesando ${event.eventType} (${event.id}): ${message}`);

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'FAILED',
          lastError: message,
        },
      });
    }
  }

  private async publish(event: { aggregateType: string; payload: unknown }) {
    const payload = event.payload as OutboxPayload;
    const model = payload?.model || event.aggregateType;
    const action = payload?.action;

    if (process.env.IS_MIRROR_VPS !== 'true') {
      await this.eventEmitter.emitAsync('database.write.success', {
        model,
        action,
        data: payload?.data,
      });
    }

    if (model === 'Aprobacion') {
      if (action === 'create' || action === 'createMany') {
        await this.eventEmitter.emitAsync('aprobacion.created', { data: payload?.data });
      }
      if (['update', 'updateMany', 'upsert', 'delete', 'deleteMany'].includes(String(action))) {
        await this.eventEmitter.emitAsync('aprobacion.updated', { data: payload?.data });
      }
    }
  }
}
