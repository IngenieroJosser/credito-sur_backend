jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import * as webpush from 'web-push';
import { PushService } from './push.service';

const enviar = webpush.sendNotification as jest.Mock;

const suscripcion = (endpoint: string, usuarioId: string) => ({
  endpoint,
  p256dh: 'p256dh',
  auth: 'auth',
  usuarioId,
  activa: true,
});

function crearPrisma(suscripciones: ReturnType<typeof suscripcion>[]) {
  return {
    pushSubscription: {
      findMany: jest.fn().mockResolvedValue(suscripciones),
      update: jest.fn().mockResolvedValue({}),
    },
    usuario: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('PushService', () => {
  const entornoOriginal = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = 'publica';
    process.env.VAPID_PRIVATE_KEY = 'privada';
  });

  afterAll(() => {
    process.env = entornoOriginal;
  });

  it('no fija un tag por defecto: con uno fijo cada aviso reemplaza al anterior', async () => {
    enviar.mockResolvedValue({});
    const service = new PushService(
      crearPrisma([suscripcion('https://push/a', 'u1')]) as any,
    );

    await service.sendPushNotification({
      title: 'Cliente en mora',
      body: 'Cliente A',
      data: { type: 'MORA_NIVEL' },
    });

    const payload = JSON.parse(enviar.mock.calls[0][1]);
    expect(payload.tag).toBeUndefined();
  });

  it('devuelve cuántas llegaron, cuántas se desactivaron y cuántas fallaron', async () => {
    enviar
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockRejectedValueOnce({ statusCode: 500 });
    const prisma = crearPrisma([
      suscripcion('https://push/a', 'u1'),
      suscripcion('https://push/b', 'u1'),
      suscripcion('https://push/c', 'u1'),
    ]);

    const resultado = await new PushService(prisma as any).sendPushNotification(
      { title: 't', body: 'b' },
    );

    expect(resultado).toEqual({
      configurado: true,
      suscripciones: 3,
      enviadas: 1,
      desactivadas: 1,
      fallidas: 1,
    });
    expect(prisma.pushSubscription.update).toHaveBeenCalledWith({
      where: { endpoint: 'https://push/b' },
      data: { activa: false },
    });
  });

  it('con userId envía solo a los dispositivos de ese usuario', async () => {
    enviar.mockResolvedValue({});
    const prisma = crearPrisma([
      suscripcion('https://push/a', 'u1'),
      suscripcion('https://push/b', 'u2'),
    ]);

    const resultado = await new PushService(prisma as any).sendPushNotification(
      { title: 't', body: 'b', userId: 'u2' },
    );

    expect(resultado.suscripciones).toBe(1);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0].endpoint).toBe('https://push/b');
  });

  it('sin llaves VAPID informa que no está configurado y no envía', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const prisma = crearPrisma([suscripcion('https://push/a', 'u1')]);

    const resultado = await new PushService(prisma as any).sendPushNotification(
      { title: 't', body: 'b' },
    );

    expect(resultado.configurado).toBe(false);
    expect(enviar).not.toHaveBeenCalled();
  });
});
