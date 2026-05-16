import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitProfile = {
  name: string;
  max: number;
  windowMs: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private lastPruneAt = 0;

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (!request) return true;

    const profile = this.resolveProfile(request);
    const now = Date.now();
    const key = `${profile.name}:${this.resolveClientKey(request)}`;
    const current = this.buckets.get(key);
    const bucket =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + profile.windowMs }
        : current;

    bucket.count += 1;
    this.buckets.set(key, bucket);
    this.pruneExpiredBuckets(now);

    const remaining = Math.max(profile.max - bucket.count, 0);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    response?.setHeader?.('X-RateLimit-Limit', profile.max);
    response?.setHeader?.('X-RateLimit-Remaining', remaining);
    response?.setHeader?.('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > profile.max) {
      response?.setHeader?.('Retry-After', retryAfterSeconds);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Demasiadas solicitudes. Espere un momento e intente de nuevo.',
          error: 'Too Many Requests',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveProfile(request: Request): RateLimitProfile {
    const url = String(request.originalUrl || request.url || '').toLowerCase();
    const windowMs = this.readPositiveInt('RATE_LIMIT_WINDOW_MS', 60_000);

    if (
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/reset-password')
    ) {
      return {
        name: 'auth',
        max: this.readPositiveInt('RATE_LIMIT_AUTH_MAX', 10),
        windowMs,
      };
    }

    if (url.includes('/export') || url.includes('/exportar') || url.includes('/backup/run')) {
      return {
        name: 'heavy',
        max: this.readPositiveInt('RATE_LIMIT_HEAVY_MAX', 30),
        windowMs,
      };
    }

    return {
      name: 'default',
      max: this.readPositiveInt('RATE_LIMIT_DEFAULT_MAX', 300),
      windowMs,
    };
  }

  private resolveClientKey(request: Request): string {
    return (
      request.ip ||
      request.socket?.remoteAddress ||
      this.resolveForwardedIp(request) ||
      'unknown'
    );
  }

  private resolveForwardedIp(request: Request): string | undefined {
    const forwardedFor = request.headers?.['x-forwarded-for'];
    return Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim();
  }

  private readPositiveInt(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  private pruneExpiredBuckets(now: number) {
    if (now - this.lastPruneAt < 60_000) return;
    this.lastPruneAt = now;

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
