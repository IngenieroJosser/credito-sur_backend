import { ConflictException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';

/**
 * Los roles deciden qué permisos hereda cada usuario, así que un fallo aquí se
 * propaga a todo el control de acceso. Se fijan las reglas de frontera.
 */
describe('RolesService', () => {
  const hacerPrisma = (over: any = {}) => ({
    rol: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => ({ id: 'r1', ...data })),
      update: jest.fn().mockImplementation(({ where, data }: any) => ({ id: where.id, ...data })),
      ...(over.rol || {}),
    },
    permiso: {
      findMany: jest.fn().mockResolvedValue([]),
      ...(over.permiso || {}),
    },
    rolPermiso: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      ...(over.rolPermiso || {}),
    },
  });

  describe('crear', () => {
    it('rechaza un rol con nombre repetido', async () => {
      const prisma = hacerPrisma({ rol: { findUnique: jest.fn().mockResolvedValue({ id: 'x' }) } });
      const service = new RolesService(prisma as any);
      await expect(service.crear({ nombre: 'ADMIN' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.rol.create).not.toHaveBeenCalled();
    });

    it('crea el rol cuando el nombre está libre', async () => {
      const prisma = hacerPrisma();
      const service = new RolesService(prisma as any);
      await expect(service.crear({ nombre: 'AUDITOR' } as any)).resolves.toMatchObject({
        nombre: 'AUDITOR',
      });
    });
  });

  describe('eliminar', () => {
    it('falla si el rol no existe', async () => {
      const service = new RolesService(hacerPrisma() as any);
      await expect(service.eliminar('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('es un borrado LÓGICO: marca eliminadoEn, no borra la fila', async () => {
      const prisma = hacerPrisma({ rol: { findUnique: jest.fn().mockResolvedValue({ id: 'r1' }) } });
      const service = new RolesService(prisma as any);
      await service.eliminar('r1');
      const args = prisma.rol.update.mock.calls[0][0];
      expect(args.data.eliminadoEn).toBeInstanceOf(Date);
      expect((prisma.rol as any).delete).toBeUndefined();
    });
  });

  describe('asignarPermisos', () => {
    it('falla si el rol no existe', async () => {
      const service = new RolesService(hacerPrisma() as any);
      await expect(service.asignarPermisos('nope', ['p1'])).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('NO asigna nada si alguno de los permisos no existe', async () => {
      const prisma = hacerPrisma({
        rol: { findUnique: jest.fn().mockResolvedValue({ id: 'r1' }) },
        // se piden 2 permisos pero solo existe 1
        permiso: { findMany: jest.fn().mockResolvedValue([{ id: 'p1' }]) },
      });
      const service = new RolesService(prisma as any);
      await expect(service.asignarPermisos('r1', ['p1', 'inventado'])).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // Y no debe haber tocado las relaciones existentes
      expect(prisma.rolPermiso.deleteMany).not.toHaveBeenCalled();
      expect(prisma.rolPermiso.createMany).not.toHaveBeenCalled();
    });

    it('reemplaza el conjunto de permisos cuando todos existen', async () => {
      const prisma = hacerPrisma({
        rol: { findUnique: jest.fn().mockResolvedValue({ id: 'r1' }) },
        permiso: { findMany: jest.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]) },
      });
      const service = new RolesService(prisma as any);
      await service.asignarPermisos('r1', ['p1', 'p2']);
      expect(prisma.rolPermiso.deleteMany).toHaveBeenCalledWith({ where: { rolId: 'r1' } });
      expect(prisma.rolPermiso.createMany).toHaveBeenCalled();
    });
  });
});
