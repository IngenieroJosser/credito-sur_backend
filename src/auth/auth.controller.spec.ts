import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RolUsuario } from '@prisma/client';
import { AuthController } from './auth.controller';
import { CLAVE_PUBLICO } from './decorators/public.decorator';
import { CLAVE_ROLES } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

describe('AuthController security metadata', () => {
  it('does not expose the user list as a public endpoint', () => {
    const handler = AuthController.prototype.obtenerTodosLosUsuarios;
    const isPublic = Reflect.getMetadata(CLAVE_PUBLICO, handler);
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) || [];
    const roles = Reflect.getMetadata(CLAVE_ROLES, handler) || [];

    expect(isPublic).toBeUndefined();
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(roles).toEqual(expect.arrayContaining([
      RolUsuario.SUPER_ADMINISTRADOR,
      RolUsuario.ADMIN,
      RolUsuario.COORDINADOR,
    ]));
  });

  it('does not expose registration as a public endpoint', () => {
    const handler = AuthController.prototype.registrar;
    const isPublic = Reflect.getMetadata(CLAVE_PUBLICO, handler);
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) || [];
    const roles = Reflect.getMetadata(CLAVE_ROLES, handler) || [];

    expect(isPublic).toBeUndefined();
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(roles).toEqual([RolUsuario.SUPER_ADMINISTRADOR]);
  });
});
