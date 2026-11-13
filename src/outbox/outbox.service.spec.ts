import { OutboxService } from './outbox.service';
import { Logger } from '@nestjs/common';
import { comoDependencia, comoPrisma } from '../common/testing/dobles';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { MirrorEnvioService } from '../mirror/mirror-envio.service';

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

  /** El espejo: desde que se quito Redis, el envio lo hace el outbox. */
  const makeMirror = () => ({
    enviar: jest.fn().mockResolvedValue('enviado' as const),
    habilitado: true,
  });

  it('publishes pending events and marks them processed', async () => {
    const prisma = makePrisma();
    const eventEmitter = makeEventEmitter();
    const mirror = makeMirror();
    const service = new OutboxService(
      comoPrisma(prisma),
      comoDependencia<EventEmitter2>(eventEmitter),
      comoDependencia<MirrorEnvioService>(mirror),
    );
    const createdAt = new Date('2026-05-16T10:00:00.000Z');

    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        eventType: 'Cliente.create',
        aggregateType: 'Cliente',
        aggregateId: 'cliente-1',
        payload: {
          model: 'Cliente',
          action: 'create',
          data: { id: 'cliente-1' },
        },
        status: 'PENDING',
        attempts: 0,
        createdAt,
      },
    ]);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.update.mockResolvedValue({});

    await service.processPending(10);

    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'database.write.success',
      {
        model: 'Cliente',
        action: 'create',
        data: { id: 'cliente-1' },
      },
    );
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
    const mirror = makeMirror();
    const service = new OutboxService(
      comoPrisma(prisma),
      comoDependencia<EventEmitter2>(eventEmitter),
      comoDependencia<MirrorEnvioService>(mirror),
    );

    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'event-2',
        eventType: 'Prestamo.update',
        aggregateType: 'Prestamo',
        aggregateId: 'prestamo-1',
        payload: {
          model: 'Prestamo',
          action: 'update',
          data: { id: 'prestamo-1' },
        },
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date('2026-05-16T10:00:00.000Z'),
      },
    ]);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.update.mockResolvedValue({});
    eventEmitter.emitAsync.mockRejectedValue(
      new Error('socket bus unavailable'),
    );

    await service.processPending(10);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-2' },
      data: {
        status: 'FAILED',
        lastError: 'socket bus unavailable',
      },
    });
  });

  /**
   * Lo que cambio al quitar Redis.
   *
   * La replica al espejo la hacia un escucha de `database.write.success` que
   * encolaba en BullMQ. Medido: cada escritura encolaba DOS trabajos, porque
   * `PrismaService` emite el evento en el acto al escribir y el outbox lo
   * emitia otra vez 30 segundos despues al publicar la fila. El receptor es
   * idempotente, asi que no se veia; lo que se pagaba era el doble de
   * operaciones de Redis.
   */
  it('manda la replica al espejo una vez, no dos', async () => {
    const prisma = makePrisma();
    const eventEmitter = makeEventEmitter();
    const mirror = makeMirror();
    const service = new OutboxService(
      comoPrisma(prisma),
      comoDependencia<EventEmitter2>(eventEmitter),
      comoDependencia<MirrorEnvioService>(mirror),
    );

    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'event-3',
        eventType: 'Pago.create',
        aggregateType: 'Pago',
        aggregateId: 'pago-1',
        payload: { model: 'Pago', action: 'create', data: { id: 'pago-1' } },
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date('2026-05-16T10:00:00.000Z'),
        updatedAt: new Date('2026-05-16T10:00:00.000Z'),
      },
    ]);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.update.mockResolvedValue({});

    await service.processPending(10);

    expect(mirror.enviar).toHaveBeenCalledTimes(1);
    expect(mirror.enviar).toHaveBeenCalledWith({
      model: 'Pago',
      action: 'create',
      data: { id: 'pago-1' },
    });
  });

  it('si el espejo falla, la fila queda con el motivo para reintentarla', async () => {
    const prisma = makePrisma();
    const eventEmitter = makeEventEmitter();
    const mirror = makeMirror();
    mirror.enviar.mockRejectedValue(new Error('El espejo no responde'));
    const service = new OutboxService(
      comoPrisma(prisma),
      comoDependencia<EventEmitter2>(eventEmitter),
      comoDependencia<MirrorEnvioService>(mirror),
    );

    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'event-4',
        eventType: 'Cliente.update',
        aggregateType: 'Cliente',
        aggregateId: 'cliente-9',
        payload: { model: 'Cliente', action: 'update', data: {} },
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date('2026-05-16T10:00:00.000Z'),
        updatedAt: new Date('2026-05-16T10:00:00.000Z'),
      },
    ]);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.update.mockResolvedValue({});

    await service.processPending(10);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-4' },
      data: { status: 'FAILED', lastError: 'El espejo no responde' },
    });
  });

  /**
   * El backoff, que es lo que compensa haber perdido el de BullMQ.
   *
   * BullMQ reintentaba 1000 veces con espera exponencial. El outbox
   * reintentaba 10 veces cada 30 segundos: con el espejo caido una hora, los
   * eventos se habrian abandonado en cinco minutos.
   */
  it('no reintenta un evento recien fallado', async () => {
    const prisma = makePrisma();
    const eventEmitter = makeEventEmitter();
    const mirror = makeMirror();
    const service = new OutboxService(
      comoPrisma(prisma),
      comoDependencia<EventEmitter2>(eventEmitter),
      comoDependencia<MirrorEnvioService>(mirror),
    );

    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'event-5',
        eventType: 'Pago.create',
        aggregateType: 'Pago',
        aggregateId: 'pago-5',
        payload: { model: 'Pago', action: 'create', data: {} },
        status: 'FAILED',
        attempts: 3,
        createdAt: new Date(Date.now() - 600_000),
        // Fallo hace diez segundos; con 3 intentos toca esperar dos minutos.
        updatedAt: new Date(Date.now() - 10_000),
      },
    ]);

    await service.processPending(10);

    expect(mirror.enviar).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
  });

  it('vuelve a intentarlo cuando ya paso la espera', async () => {
    const prisma = makePrisma();
    const eventEmitter = makeEventEmitter();
    const mirror = makeMirror();
    const service = new OutboxService(
      comoPrisma(prisma),
      comoDependencia<EventEmitter2>(eventEmitter),
      comoDependencia<MirrorEnvioService>(mirror),
    );

    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'event-6',
        eventType: 'Pago.create',
        aggregateType: 'Pago',
        aggregateId: 'pago-6',
        payload: { model: 'Pago', action: 'create', data: {} },
        status: 'FAILED',
        attempts: 3,
        createdAt: new Date(Date.now() - 7_200_000),
        // Dos minutos tocaban; han pasado diez.
        updatedAt: new Date(Date.now() - 600_000),
      },
    ]);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.update.mockResolvedValue({});

    await service.processPending(10);

    expect(mirror.enviar).toHaveBeenCalledTimes(1);
  });

  it('aguanta el espejo caido tres dias sin abandonar el evento', async () => {
    // 80 intentos con el tope de una hora: 74 horas desde el primero. Esto
    // comprueba la cuenta, que es la razon de que sean 80 y no menos: mi
    // primera version puso 18 diciendo que cubrian 72 horas, y cubren 12.
    const prisma = makePrisma();

    // Una subclase en vez de un `as any` sobre un metodo privado: asi, si
    // cambia el nombre, esto deja de compilar en vez de pasar en silencio.
    class OutboxConEspera extends OutboxService {
      public espera(n: number) {
        return this.esperaTrasFallo(n);
      }
    }
    const conEspera = new OutboxConEspera(
      comoPrisma(prisma),
      comoDependencia<EventEmitter2>(makeEventEmitter()),
      comoDependencia<MirrorEnvioService>(makeMirror()),
    );
    const espera = (n: number) => conEspera.espera(n);

    let total = 0;
    for (let intento = 1; intento <= 80; intento += 1) total += espera(intento);

    expect(total).toBeGreaterThan(72 * 60 * 60 * 1000);
    // Y el tope: ninguna espera pasa de una hora, para que no se quede
    // dormido un dia entero despues de que el espejo vuelva.
    expect(espera(50)).toBe(60 * 60 * 1000);
  });
});
