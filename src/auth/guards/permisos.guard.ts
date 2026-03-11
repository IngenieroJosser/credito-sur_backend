import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLAVE_PERMISOS } from '../decorators/permisos.decorator';
import { RolUsuario } from '@prisma/client';

interface UsuarioEnRequest {
  user?: {
    rol?: RolUsuario;
    permisos?: string[];
  };
}

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permisosRequeridos = this.reflector.getAllAndOverride<string[]>(
      CLAVE_PERMISOS,
      [context.getHandler(), context.getClass()],
    );

    if (!permisosRequeridos || permisosRequeridos.length === 0) {
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

    const permisosUsuario = Array.isArray(usuario.permisos) ? usuario.permisos : [];

    return permisosRequeridos.every((p) => permisosUsuario.includes(p));
  }
}
