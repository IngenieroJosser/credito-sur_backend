import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtConstants } from '../constants';
import type { RolUsuario } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  nombres: string;
  rol: RolUsuario;
  permisos: string[];
}

// Lee el token de la cookie httpOnly 'token' parseando la cabecera Cookie a
// mano (sin depender de cookie-parser). Devuelve null si no está.
function cookieExtractor(req: any): string | null {
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
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, estado: true, eliminadoEn: true, rol: true },
    });

    // Rechaza tambien a los archivados/eliminados, no solo a los no ACTIVO.
    if (!usuario || usuario.estado !== 'ACTIVO' || usuario.eliminadoEn) {
      throw new UnauthorizedException('Sesión inválida');
    }

    return {
      id: payload.sub,
      correo: payload.email,
      nombres: payload.nombres,
      // El rol se toma de la BD, no del token: si a un usuario se le baja el
      // rol (p. ej. de ADMIN a COBRADOR), el cambio surte efecto en la
      // siguiente peticion en vez de esperar a que caduque el token (8 h).
      rol: usuario.rol,
      permisos: payload.permisos || [],
    };
  }
}
