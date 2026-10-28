import { PushController } from './push.controller';
import type { PushService } from './push.service';
import { comoDependencia } from '../common/testing/dobles';

describe('PushController', () => {
  it('registers subscriptions for the authenticated user, not the body userId', async () => {
    const pushService = {
      subscribeUser: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new PushController(
      comoDependencia<PushService>(pushService),
    );

    // El cuerpo trae `userId` A PROPOSITO: lo que se comprueba es que el controlador use
    // el usuario autenticado y NO ese campo. Va en una variable porque TypeScript rechaza
    // una propiedad de mas en un literal, que es justo lo que aqui hay que mandar.
    // `subscribe` es publico, asi que el `(controller as any)` tampoco hacia falta.
    const cuerpoConUserIdDeMas = {
      userId: 'user-from-body',
      subscription: {
        endpoint: 'https://push.example/sub',
        keys: { p256dh: 'p256dh', auth: 'auth' },
      },
    };

    await controller.subscribe(cuerpoConUserIdDeMas, {
      user: { id: 'authenticated-user' },
    });

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
    const controller = new PushController(
      comoDependencia<PushService>(pushService),
    );

    await controller.unsubscribe(
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
    const controller = new PushController(
      comoDependencia<PushService>(pushService),
    );

    await controller.getUserSubscriptions({
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
    const controller = new PushController(
      comoDependencia<PushService>(pushService),
    );

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
    const controller = new PushController(
      comoDependencia<PushService>(pushService),
    );

    await expect(controller.enviarPrueba({})).rejects.toThrow();
    expect(pushService.sendPushNotification).not.toHaveBeenCalled();
  });
});
