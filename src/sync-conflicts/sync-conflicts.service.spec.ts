import { BadRequestException } from '@nestjs/common';
import { SyncConflictsService } from './sync-conflicts.service';

function makeService(prisma: any) {
  return new SyncConflictsService(
    prisma,
    { get: jest.fn().mockReturnValue('http://localhost:3001/api-credisur') } as any,
    { sign: jest.fn().mockReturnValue('token-creador') } as any,
  );
}

describe('SyncConflictsService concurrency and ownership', () => {
  it('consulta para el coordinador solo conflictos de sus rutas', async () => {
    const prisma = {
      ruta: {
        findMany: jest.fn().mockResolvedValue([
          { cobradorId: 'cobrador-1' },
          { cobradorId: 'cobrador-2' },
        ]),
      },
      syncConflict: { findMany: jest.fn().mockResolvedValue([]) },
    };

    await makeService(prisma).findAll({
      id: 'coordinador-1',
      rol: 'COORDINADOR',
    });

    expect(prisma.ruta.findMany).toHaveBeenCalledWith({
      where: { coordinadorId: 'coordinador-1' },
      select: { cobradorId: true },
    });
    expect(prisma.syncConflict.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          creadoPorId: {
            in: ['cobrador-1', 'cobrador-2', 'coordinador-1'],
          },
        },
      }),
    );
  });

  it('impide que dos revisores ejecuten el mismo conflicto', async () => {
    const prisma = {
      syncConflict: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conflicto-1',
          estadoResolucion: 'PENDIENTE',
          actualizadoEn: new Date(),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(
      makeService(prisma).resolveConflict(
        'conflicto-1',
        'DESCARTAR',
        'admin-1',
        '',
      ),
    ).rejects.toThrow('El conflicto ya fue tomado por otro usuario');
  });

  it('recupera un procesamiento abandonado antes de volver a reclamarlo', async () => {
    const stale = new Date(Date.now() - 11 * 60 * 1000);
    const pendiente = {
      id: 'conflicto-1',
      estadoResolucion: 'PENDIENTE',
      actualizadoEn: new Date(),
    };
    const prisma = {
      syncConflict: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            ...pendiente,
            estadoResolucion: 'PROCESANDO',
            actualizadoEn: stale,
          })
          .mockResolvedValueOnce(pendiente)
          .mockResolvedValueOnce({
            ...pendiente,
            estadoResolucion: 'DESCARTADO',
          }),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
      },
    };

    const result = await makeService(prisma).resolveConflict(
      'conflicto-1',
      'DESCARTAR',
      'admin-1',
      '',
    );

    expect(result).toEqual(
      expect.objectContaining({ estadoResolucion: 'DESCARTADO' }),
    );
    expect(prisma.syncConflict.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'conflicto-1',
          estadoResolucion: 'PROCESANDO',
        }),
        data: { estadoResolucion: 'PENDIENTE', resueltoPorId: null },
      }),
    );
  });

  it('rechaza acciones desconocidas antes de reclamar el conflicto', async () => {
    const prisma = {
      syncConflict: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conflicto-1',
          estadoResolucion: 'PENDIENTE',
          actualizadoEn: new Date(),
        }),
        updateMany: jest.fn(),
      },
    };

    await expect(
      makeService(prisma).resolveConflict(
        'conflicto-1',
        'EJECUTAR_COMO_ADMIN',
        'admin-1',
        '',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.syncConflict.updateMany).not.toHaveBeenCalled();
  });
});
