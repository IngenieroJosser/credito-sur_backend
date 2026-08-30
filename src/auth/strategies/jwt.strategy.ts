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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: JwtPayload) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, estado: true },
    });

    if (!usuario || usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Sesión inválida');
    }

    return {
      id: payload.sub,
      correo: payload.email,
      nombres: payload.nombres,
      rol: payload.rol,
      permisos: payload.permisos || [],
    };
  }
}
