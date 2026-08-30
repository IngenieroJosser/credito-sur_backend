import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import Redis from 'ioredis';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitProfile = {
  name: string;
  max: number;
  windowMs: number;
};

type Conteo = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger('RateLimitGuard');

  // Respaldo en memoria: se usa si no hay Redis o si Redis falla. Cada
  // instancia tiene el suyo, así que solo limita por instancia.
  private readonly buckets = new Map<string, RateLimitBucket>();
  private lastPruneAt = 0;

  // Cliente Redis compartido entre instancias. Se crea una vez, perezosamente.
  private redis: Redis | null = null;
  private redisIniciado = false;
  private redisSano = false;

  // Incrementa el contador y pone el vencimiento en una sola operación
  // atómica. Devuelve [conteo, ttlMs]. Sin esto, dos instancias que hacen
  // INCR + EXPIRE por separado pueden dejar una clave sin vencer.
  private static readonly LUA_INCR = `
    local c = redis.call('INCR', KEYS[1])
    if c == 1 then
      redis.call('PEXPIRE', KEYS[1], ARGV[1])
    end
    local ttl = redis.call('PTTL', KEYS[1])
    return {c, ttl}
  `;

  private obtenerRedis(): Redis | null {
    if (this.redisIniciado) return this.redisSano ? this.redis : null;
    this.redisIniciado = true;

    // Sin host configurado no se intenta: el respaldo en memoria basta para
    // desarrollo y para un despliegue de una sola instancia.
    if (!process.env.REDIS_HOST) return null;

    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        username: process.env.REDIS_USERNAME || undefined,
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
        // No dejar peticiones colgadas esperando a Redis: si no responde,
        // se cae al respaldo en memoria.
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: false,
      });

      this.redis.on('ready', () => {
        this.redisSano = true;
        this.logger.log('Rate-limit respaldado en Redis (compartido).');
      });
      this.redis.on('error', (e) => {
        if (this.redisSano) {
          this.logger.warn(
            `Redis del rate-limit caído, se usa memoria: ${e.message}`,
          );
        }
        this.redisSano = false;
      });
      this.redis.on('end', () => {
        this.redisSano = false;
      });
    } catch (e: any) {
      this.logger.warn(
        `No se pudo crear el cliente Redis del rate-limit: ${e?.message}`,
      );
      this.redis = null;
    }

    return this.redis;
  }

  private async contarEnRedis(
    key: string,
    windowMs: number,
  ): Promise<Conteo | null> {
    const redis = this.obtenerRedis();
    if (!redis || !this.redisSano) return null;

    try {
      const [count, ttl] = (await redis.eval(
        RateLimitGuard.LUA_INCR,
        1,
        key,
        String(windowMs),
      )) as [number, number];

      return {
        count: Number(count),
        resetAt: Date.now() + Math.max(0, Number(ttl)),
      };
    } catch (e: any) {
      // Un fallo de Redis nunca debe tumbar la petición: se cae a memoria.
      this.redisSano = false;
      this.logger.warn(`Fallo al contar en Redis, se usa memoria: ${e?.message}`);
      return null;
    }
  }

  private contarEnMemoria(key: string, windowMs: number): Conteo {
    const now = Date.now();
    const current = this.buckets.get(key);
    const bucket =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;

    bucket.count += 1;
    this.buckets.set(key, bucket);
    this.pruneExpiredBuckets(now);

    return { count: bucket.count, resetAt: bucket.resetAt };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (!request) return true;

    const profile = this.resolveProfile(request);
    const key = `ratelimit:${profile.name}:${this.resolveClientKey(request)}`;

    const conteo =
      (await this.contarEnRedis(key, profile.windowMs)) ??
      this.contarEnMemoria(key, profile.windowMs);

    const now = Date.now();
    const remaining = Math.max(profile.max - conteo.count, 0);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((conteo.resetAt - now) / 1000),
    );

    response?.setHeader?.('X-RateLimit-Limit', profile.max);
    response?.setHeader?.('X-RateLimit-Remaining', remaining);
    response?.setHeader?.('X-RateLimit-Reset', Math.ceil(conteo.resetAt / 1000));

    if (conteo.count > profile.max) {
      response?.setHeader?.('Retry-After', retryAfterSeconds);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Demasiadas solicitudes. Espere un momento e intente de nuevo.',
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

    if (
      url.includes('/export') ||
      url.includes('/exportar') ||
      url.includes('/backup/run')
    ) {
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
