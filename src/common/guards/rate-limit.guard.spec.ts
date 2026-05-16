import { ExecutionContext, HttpException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00.000Z'));
    process.env = { ...originalEnv };
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

  it('blocks requests after the default window limit is exceeded', () => {
    process.env.RATE_LIMIT_DEFAULT_MAX = '2';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    const guard = new RateLimitGuard();
    const { context, response } = makeContext('/api-credisur/clients');

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', 60);
  });

  it('uses a stricter limit for authentication endpoints', () => {
    process.env.RATE_LIMIT_DEFAULT_MAX = '100';
    process.env.RATE_LIMIT_AUTH_MAX = '1';
    const guard = new RateLimitGuard();
    const { context } = makeContext('/api-credisur/auth/login');

    expect(guard.canActivate(context)).toBe(true);
    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it('starts a new window after the previous one expires', () => {
    process.env.RATE_LIMIT_DEFAULT_MAX = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '1000';
    const guard = new RateLimitGuard();
    const { context } = makeContext('/api-credisur/dashboard');

    expect(guard.canActivate(context)).toBe(true);
    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }

    jest.setSystemTime(new Date('2026-05-16T12:00:01.001Z'));

    expect(guard.canActivate(context)).toBe(true);
  });
});
