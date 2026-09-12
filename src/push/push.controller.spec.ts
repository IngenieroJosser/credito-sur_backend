import { PushController } from './push.controller';

describe('PushController', () => {
  it('registers subscriptions for the authenticated user, not the body userId', async () => {
    const pushService = {
      subscribeUser: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new PushController(pushService as any);

    await (controller as any).subscribe(
      {
        userId: 'user-from-body',
        subscription: {
          endpoint: 'https://push.example/sub',
          keys: { p256dh: 'p256dh', auth: 'auth' },
        },
      },
      { user: { id: 'authenticated-user' } },
    );

    expect(pushService.subscribeUser).toHaveBeenCalledWith(
      'authenticated-user',
      {
        endpoint: 'https://push.example/sub',
        keys: { p256dh: 'p256dh', auth: 'auth' },
      },
    );
  });

  it('only unsubscribes endpoints for the authenticated user', async () => {
    const pushService = {
      unsubscribeUser: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new PushController(pushService as any);

    await (controller as any).unsubscribe(
      encodeURIComponent('https://push.example/sub'),
      { user: { id: 'authenticated-user' } },
    );

    expect(pushService.unsubscribeUser).toHaveBeenCalledWith(
      'https://push.example/sub',
      'authenticated-user',
    );
  });

  it('lists subscriptions for the authenticated user only', async () => {
    const pushService = {
      getUserSubscriptions: jest.fn().mockResolvedValue([]),
    };
    const controller = new PushController(pushService as any);

    await (controller as any).getUserSubscriptions({
      user: { id: 'authenticated-user' },
    });

    expect(pushService.getUserSubscriptions).toHaveBeenCalledWith(
      'authenticated-user',
    );
  });

  it('envía la prueba solo al usuario autenticado y devuelve el resultado', async () => {
    const resultado = {
      configurado: true,
      suscripciones: 1,
      enviadas: 1,
      desactivadas: 0,
      fallidas: 0,
    };
    const pushService = {
      sendPushNotification: jest.fn().mockResolvedValue(resultado),
    };
    const controller = new PushController(pushService as any);

    const respuesta = await controller.enviarPrueba({
      user: { id: 'authenticated-user' },
    });

    expect(pushService.sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'authenticated-user',
        data: expect.objectContaining({ tipo: 'TEST' }),
      }),
    );
    expect(respuesta).toEqual(resultado);
  });

  it('no envía la prueba sin usuario: con userId vacío llegaría a todos', async () => {
    const pushService = { sendPushNotification: jest.fn() };
    const controller = new PushController(pushService as any);

    await expect(controller.enviarPrueba({})).rejects.toThrow();
    expect(pushService.sendPushNotification).not.toHaveBeenCalled();
  });
});
