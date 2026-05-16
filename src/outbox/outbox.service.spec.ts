import { OutboxService } from './outbox.service';
import { Logger } from '@nestjs/common';

describe('OutboxService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makePrisma = () => ({
    outboxEvent: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  });

  const makeEventEmitter = () => ({
    emitAsync: jest.fn().mockResolvedValue([]),
  });

  it('publishes pending events and marks them processed', async () => {
    const prisma = makePrisma();
    const eventEmitter = makeEventEmitter();
    const service = new OutboxService(prisma as any, eventEmitter as any);
    const createdAt = new Date('2026-05-16T10:00:00.000Z');

    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        eventType: 'Cliente.create',
        aggregateType: 'Cliente',
        aggregateId: 'cliente-1',
        payload: { model: 'Cliente', action: 'create', data: { id: 'cliente-1' } },
        status: 'PENDING',
        attempts: 0,
        createdAt,
      },
    ]);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.update.mockResolvedValue({});

    await service.processPending(10);

    expect(eventEmitter.emitAsync).toHaveBeenCalledWith('database.write.success', {
      model: 'Cliente',
      action: 'create',
      data: { id: 'cliente-1' },
    });
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: {
        status: 'PROCESSED',
        processedAt: expect.any(Date),
        lastError: null,
      },
    });
  });

  it('marks events failed when publishing throws', async () => {
    const prisma = makePrisma();
    const eventEmitter = makeEventEmitter();
    const service = new OutboxService(prisma as any, eventEmitter as any);

    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'event-2',
        eventType: 'Prestamo.update',
        aggregateType: 'Prestamo',
        aggregateId: 'prestamo-1',
        payload: { model: 'Prestamo', action: 'update', data: { id: 'prestamo-1' } },
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date('2026-05-16T10:00:00.000Z'),
      },
    ]);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.update.mockResolvedValue({});
    eventEmitter.emitAsync.mockRejectedValue(new Error('socket bus unavailable'));

    await service.processPending(10);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-2' },
      data: {
        status: 'FAILED',
        lastError: 'socket bus unavailable',
      },
    });
  });
});
