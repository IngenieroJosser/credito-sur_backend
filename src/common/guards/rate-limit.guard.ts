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
import { verify } from 'jsonwebtoken';
import { mensajeDeError } from '../error.util';

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

/**
 * La peticion vista por este guarda: el usuario puede o no estar, segun por donde entre.
 *
 * `RequestConUsuario` de `common/types` lo declara OBLIGATORIO, porque lo usan los
 * controladores que ya pasaron por el guarda de sesion. Aqui no: este guarda corre tambien
 * en las rutas publicas, y ahi `user` no existe.
 */
type RequestConUsuarioOpcional = Request & { user?: { id?: string } };

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
    } catch (e) {
      this.logger.warn(
        `No se pudo crear el cliente Redis del rate-limit: ${mensajeDeError(e)}`,
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
    } catch (e) {
      // Un fallo de Redis nunca debe tumbar la petición: se cae a memoria.
      this.redisSano = false;
      this.logger.warn(
        `Fallo al contar en Redis, se usa memoria: ${mensajeDeError(e)}`,
      );
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
    response?.setHeader?.(
      'X-RateLimit-Reset',
      Math.ceil(conteo.resetAt / 1000),
    );

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

  /**
   * Contra quien se cuenta el cupo: el USUARIO autenticado, y si no lo hay, la IP.
   *
   * Antes se contaba siempre por IP, y eso tiene una consecuencia medida: en la oficina
   * todos salen por la misma IP, asi que los usuarios se agotaban el cupo ENTRE ELLOS. Con
   * los siete roles trabajando a la vez aparecian cientos de respuestas 429 haciendo cada
   * uno un uso normal.
   *
   * La IP se mantiene para lo que llega sin sesion -el login, sobre todo-, que es justo
   * donde el limite protege de un ataque por fuerza bruta: ahi contar por usuario no
   * serviria, porque el atacante aun no es nadie.
   */
  private resolveClientKey(request: Request): string {
    const usuarioId =
      (request as RequestConUsuarioOpcional).user?.id ??
      this.usuarioDelToken(request);
    if (usuarioId) return `u:${usuarioId}`;

    return (
      request.ip ||
      request.socket?.remoteAddress ||
      this.resolveForwardedIp(request) ||
      'unknown'
    );
  }

  /**
   * El id del usuario sacado del token, porque `request.user` aqui no existe.
   *
   * Esto es lo que hacia que el reparto por usuario descrito arriba NO surtiera
   * efecto. Este guarda esta registrado como el unico `APP_GUARD` global, y
   * Nest corre los globales ANTES de los de controlador; `JwtAuthGuard`, que es
   * quien rellena `request.user`, lo aplican los 26 controladores uno a uno con
   * `@UseGuards`. Asi que cuando se mira `request.user` aqui, siempre vale
   * `undefined` y el cupo caia SIEMPRE a la IP.
   *
   * Medido con la cabecera `X-RateLimit-Remaining`: el administrador empezaba
   * con 99.999, el cobrador hacia cinco peticiones, y el administrador pasaba a
   * 99.993. Perdia cupo por peticiones que no habia hecho el. En la oficina,
   * donde los siete salen por la misma IP, eso es un solo bolsillo de 300 por
   * minuto para todos.
   *
   * El token se VERIFICA, no solo se lee. Con `decode` bastaria inventarse un
   * `sub` cualquiera para estrenar cupo entero, y eso convertiria el limitador
   * en un adorno. Verificar es una comprobacion HMAC: cuesta microsegundos y
   * aqui se hace una vez por peticion.
   *
   * Si el token falta, caduco o no cuadra, se devuelve `undefined` y el cupo
   * vuelve a contarse por IP, que es justo lo que protege al login de la fuerza
   * bruta: ahi el atacante todavia no es nadie.
   */
  private usuarioDelToken(request: Request): string | undefined {
    const cabecera = request.headers?.authorization;
    if (typeof cabecera !== 'string' || !cabecera.startsWith('Bearer ')) {
      return undefined;
    }

    const secreto = process.env.JWT_SECRET;
    if (!secreto) return undefined;

    try {
      const contenido = verify(cabecera.slice(7).trim(), secreto);
      if (typeof contenido === 'string') return undefined;
      const sub = contenido.sub;
      return typeof sub === 'string' && sub ? sub : undefined;
    } catch {
      // Token invalido o caducado: no es asunto de este guarda decirlo
      // -`JwtAuthGuard` lo hara con su 401-. Aqui solo significa que no se sabe
      // quien es, asi que se cuenta por IP.
      return undefined;
    }
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
