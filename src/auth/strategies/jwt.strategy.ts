import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { jwtConstants } from '../constants';
import type { RolUsuario } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
  rol: RolUsuario;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, correo: payload.email, rol: payload.rol };
  }
}
