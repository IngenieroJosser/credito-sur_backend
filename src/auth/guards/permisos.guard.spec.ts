import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@prisma/client';
import { PermisosGuard } from './permisos.guard';

/**
 * Frontera de seguridad: decide quién entra a un módulo según la matriz de
 * permisos. Se prueba explícitamente porque un fallo aquí abre módulos enteros
 * a quien no debería verlos.
 */
describe('PermisosGuard', () => {
  const contexto = (user: any, permisosRequeridos?: string[]): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => 'handler',
      getClass: () => 'class',
    }) as any;

  const guardCon = (permisosRequeridos?: string[]) => {
    const reflector = {
      getAllAndOverride: () => permisosRequeridos,
    } as unknown as Reflector;
    return new PermisosGuard(reflector);
  };

  it('deja pasar cuando el endpoint no exige permisos', () => {
    expect(guardCon(undefined).canActivate(contexto({ rol: RolUsuario.COBRADOR }))).toBe(true);
    expect(guardCon([]).canActivate(contexto({ rol: RolUsuario.COBRADOR }))).toBe(true);
  });

  it('bloquea cuando no hay usuario o no trae rol', () => {
    const guard = guardCon(['importaciones']);
    expect(guard.canActivate(contexto(undefined))).toBe(false);
    expect(guard.canActivate(contexto({}))).toBe(false);
  });

  it('el superadministrador siempre pasa, aunque no tenga el permiso listado', () => {
    const guard = guardCon(['importaciones']);
    expect(
      guard.canActivate(contexto({ rol: RolUsuario.SUPER_ADMINISTRADOR, permisos: [] })),
    ).toBe(true);
  });

  it('un ADMIN sin el permiso concedido NO pasa (admin no tiene todo por defecto)', () => {
    const guard = guardCon(['importaciones']);
    expect(
      guard.canActivate(contexto({ rol: RolUsuario.ADMIN, permisos: ['clientes'] })),
    ).toBe(false);
  });

  it('deja pasar a cualquier rol que SÍ tenga el permiso concedido', () => {
    const guard = guardCon(['importaciones']);
    expect(
      guard.canActivate(
        contexto({ rol: RolUsuario.COORDINADOR, permisos: ['clientes', 'importaciones'] }),
      ),
    ).toBe(true);
  });

  it('si se exigen varios permisos, hacen falta TODOS', () => {
    const guard = guardCon(['importaciones', 'contable']);
    expect(
      guard.canActivate(contexto({ rol: RolUsuario.ADMIN, permisos: ['importaciones'] })),
    ).toBe(false);
    expect(
      guard.canActivate(
        contexto({ rol: RolUsuario.ADMIN, permisos: ['importaciones', 'contable'] }),
      ),
    ).toBe(true);
  });

  it('tolera un usuario cuyos permisos no son una lista', () => {
    const guard = guardCon(['importaciones']);
    expect(
      guard.canActivate(contexto({ rol: RolUsuario.ADMIN, permisos: 'importaciones' as any })),
    ).toBe(false);
  });
});
