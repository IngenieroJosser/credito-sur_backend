import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CategoriasController } from '../categorias/categorias.controller';
import { InventoryController } from '../inventory/inventory.controller';
import { PermissionsController } from '../permissions/permissions.controller';
import { PushController } from '../push/push.controller';
import { RolesController } from '../roles/roles.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthController } from '../auth/auth.controller';
import { PaymentsController } from '../payments/payments.controller';
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

  /**
   * Las acciones que mueven dinero dicen quien puede hacerlas.
   *
   * ── Lo que pasaba ───────────────────────────────────────────────────────
   *
   * `POST /payments` no tenia `@Roles`, ni el metodo ni la clase. Y
   * `RolesGuard` sin metadatos DEJA PASAR:
   *
   *     if (!rolesRequeridos || rolesRequeridos.length === 0) return true;
   *
   * Asi que cualquier usuario con sesion podia registrar un pago sobre
   * cualquier credito —tambien el CONTADOR y el PUNTO_DE_VENTA, que no
   * cobran—. Y registrar un pago no es leer: baja la deuda de un cliente y
   * mete efectivo en una caja.
   *
   * ── Por que se comprueba asi ────────────────────────────────────────────
   *
   * Olvidar el decorador no rompe nada: compila, arranca y responde 201. La
   * unica forma de que se note es preguntarle a los metadatos.
   */
  it('registrar un pago declara quien puede hacerlo', () => {
    const handler = PaymentsController.prototype.create;
    const roles = (Reflect.getMetadata(CLAVE_ROLES, handler) ??
      Reflect.getMetadata(CLAVE_ROLES, PaymentsController) ??
      []) as RolUsuario[];

    expect(roles.length).toBeGreaterThan(0);
  });

  it('y no deja cobrar a quien no cobra', () => {
    // El contador lleva costos y reportes; el punto de venta, ventas. Ninguno
    // de los dos sale a cobrar (`credisur.md`).
    const roles = (Reflect.getMetadata(
      CLAVE_ROLES,
      PaymentsController.prototype.create,
    ) ?? []) as RolUsuario[];

    expect(roles).not.toContain(RolUsuario.CONTADOR);
    expect(roles).not.toContain(RolUsuario.PUNTO_DE_VENTA);
  });

  it('pero si a quien cobra', () => {
    // Si la lista se queda corta, el cobrador deja de poder trabajar y eso se
    // nota en la calle, no en una prueba.
    const roles = (Reflect.getMetadata(
      CLAVE_ROLES,
      PaymentsController.prototype.create,
    ) ?? []) as RolUsuario[];

    expect(roles).toEqual(
      expect.arrayContaining([RolUsuario.COBRADOR, RolUsuario.SUPERVISOR]),
    );
  });

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
