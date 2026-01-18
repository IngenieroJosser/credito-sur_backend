import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@prisma/client';
import { CLAVE_ROLES } from '../decorators/roles.decorator';

interface UsuarioEnRequest {
  user?: {
    rol?: RolUsuario;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<RolUsuario[]>(
      CLAVE_ROLES,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<UsuarioEnRequest>();

    const usuario = request.user;

    if (!usuario || !usuario.rol) {
      return false;
    }

    if (usuario.rol === RolUsuario.SUPER_ADMINISTRADOR) {
      return true;
    }

    return rolesRequeridos.includes(usuario.rol);
  }
}
