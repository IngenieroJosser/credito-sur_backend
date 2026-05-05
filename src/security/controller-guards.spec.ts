import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CategoriasController } from '../categorias/categorias.controller';
import { InventoryController } from '../inventory/inventory.controller';
import { PermissionsController } from '../permissions/permissions.controller';
import { PushController } from '../push/push.controller';
import { RolesController } from '../roles/roles.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
});
