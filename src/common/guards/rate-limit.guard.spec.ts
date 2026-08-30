import { ExecutionContext, HttpException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00.000Z'));
    process.env = { ...originalEnv };
    // Sin REDIS_HOST el guard usa el respaldo en memoria, que es lo que
    // comprueban estas pruebas de forma determinista.
    delete process.env.REDIS_HOST;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.useRealTimers();
  });

  const makeContext = (url: string, ip = '10.0.0.1') => {
    const response = {
      setHeader: jest.fn(),
    };
    const request = {
      ip,
      method: 'GET',
      originalUrl: url,
      headers: {},
    };

    return {
      context: {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => response,
        }),
      } as ExecutionContext,
      response,
    };
  };

  it('blocks requests after the default window limit is exceeded', async () => {
    process.env.RATE_LIMIT_DEFAULT_MAX = '2';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    const guard = new RateLimitGuard();
    const { context, response } = makeContext('/api-credisur/clients');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    try {
      await guard.canActivate(context);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', 60);
  });

  it('uses a stricter limit for authentication endpoints', async () => {
    process.env.RATE_LIMIT_DEFAULT_MAX = '100';
    process.env.RATE_LIMIT_AUTH_MAX = '1';
    const guard = new RateLimitGuard();
    const { context } = makeContext('/api-credisur/auth/login');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    try {
      await guard.canActivate(context);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it('starts a new window after the previous one expires', async () => {
    process.env.RATE_LIMIT_DEFAULT_MAX = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '1000';
    const guard = new RateLimitGuard();
    const { context } = makeContext('/api-credisur/dashboard');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    try {
      await guard.canActivate(context);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }

    jest.setSystemTime(new Date('2026-05-16T12:00:01.001Z'));

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
