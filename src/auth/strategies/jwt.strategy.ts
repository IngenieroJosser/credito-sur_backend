import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtConstants } from '../constants';
import type { RolUsuario } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Lo que de verdad lleva el token.
 *
 * `auth.service` firma dos payloads: el de iniciar sesion
 * (`sub`, `nombres`, `rol`, `permisos`) y el de registrar un usuario, que omite
 * `permisos`. Ninguno de los dos incluye `email`, y aqui figuraba como
 * OBLIGATORIO: de ahi salia un `correo: payload.email` que siempre valia
 * undefined y que `GET /auth/perfil` devolvia tal cual.
 */
interface JwtPayload {
  sub: string;
  nombres: string;
  rol: RolUsuario;
  /** Falta en el token que se firma al registrar un usuario. */
  permisos?: string[];
}

// Lee el token de la cookie httpOnly 'token' parseando la cabecera Cookie a
// mano (sin depender de cookie-parser). Devuelve null si no está.
function cookieExtractor(req: {
  headers?: { cookie?: unknown };
}): string | null {
  const raw = req?.headers?.cookie;
  if (!raw || typeof raw !== 'string') return null;
  const parte = raw
    .split(';')
    .map((c: string) => c.trim())
    .find((c: string) => c.startsWith('token='));
  if (!parte) return null;
  return decodeURIComponent(parte.slice('token='.length));
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      // Acepta el token por cookie httpOnly (web) o por el header Authorization
      // (apps/PWA/offline). El header sigue funcionando: nada del flujo actual
      // se rompe.
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Se piden tambien nombre, apellido, correo y telefono: es la MISMA consulta,
    // no una extra, y `GET /auth/perfil` devuelve este objeto tal cual. Antes solo
    // salian del token, que no los lleva, asi que ese endpoint respondia sin
    // apellidos, sin correo y sin telefono.
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        estado: true,
        eliminadoEn: true,
        rol: true,
        nombres: true,
        apellidos: true,
        correo: true,
        telefono: true,
      },
    });

    // Rechaza tambien a los archivados/eliminados, no solo a los no ACTIVO.
    if (!usuario || usuario.estado !== 'ACTIVO' || usuario.eliminadoEn) {
      throw new UnauthorizedException('Sesión inválida');
    }

    return {
      id: payload.sub,
      // Todo lo del usuario sale de la BD por la misma razon que el rol: si se
      // corrige un correo o un apellido, el cambio surte efecto en la siguiente
      // peticion y no cuando caduque el token. `nombres` cae al del token solo por
      // si la fila viniera con el campo vacio.
      correo: usuario.correo ?? undefined,
      nombres: usuario.nombres || payload.nombres,
      apellidos: usuario.apellidos ?? undefined,
      telefono: usuario.telefono ?? undefined,
      estado: usuario.estado,
      // El rol se toma de la BD, no del token: si a un usuario se le baja el
      // rol (p. ej. de ADMIN a COBRADOR), el cambio surte efecto en la
      // siguiente peticion en vez de esperar a que caduque el token (8 h).
      rol: usuario.rol,
      permisos: payload.permisos || [],
    };
  }
}
