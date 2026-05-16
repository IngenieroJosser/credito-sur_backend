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

    await (controller as any).getUserSubscriptions({ user: { id: 'authenticated-user' } });

    expect(pushService.getUserSubscriptions).toHaveBeenCalledWith('authenticated-user');
  });
});
