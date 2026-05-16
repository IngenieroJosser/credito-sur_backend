import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CategoriasController } from '../categorias/categorias.controller';
import { InventoryController } from '../inventory/inventory.controller';
import { PermissionsController } from '../permissions/permissions.controller';
import { PushController } from '../push/push.controller';
import { RolesController } from '../roles/roles.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthController } from '../auth/auth.controller';
import { CLAVE_PUBLICO } from '../auth/decorators/public.decorator';
import { CLAVE_ROLES } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

const controllersRequiringJwt = [
  CategoriasController,
  InventoryController,
  PermissionsController,
  PushController,
  RolesController,
];

describe('controller authentication guards', () => {
  it.each(controllersRequiringJwt)(
    '%p requires JwtAuthGuard at the controller boundary',
    (controller) => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];

      expect(guards).toContain(JwtAuthGuard);
    },
  );

  it.each([PermissionsController, RolesController])(
    '%p requires RolesGuard at the controller boundary',
    (controller) => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];

      expect(guards).toContain(RolesGuard);
    },
  );

  it.each([PermissionsController, RolesController])(
    '%p is restricted to super administrators',
    (controller) => {
      const roles = Reflect.getMetadata(CLAVE_ROLES, controller) ?? [];

      expect(roles).toEqual([RolUsuario.SUPER_ADMINISTRADOR]);
    },
  );

  it('does not expose auth registration as a public endpoint', () => {
    const handler = AuthController.prototype.registrar;
    const isPublic = Reflect.getMetadata(CLAVE_PUBLICO, handler);
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
    const roles = Reflect.getMetadata(CLAVE_ROLES, handler) ?? [];

    expect(isPublic).toBeUndefined();
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(roles).toEqual([RolUsuario.SUPER_ADMINISTRADOR]);
  });
});
