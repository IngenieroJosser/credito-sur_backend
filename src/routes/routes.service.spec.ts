import { ForbiddenException } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { RoutesService } from './routes.service';

const makeService = (prisma: any) =>
  new RoutesService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
  );

describe('RoutesService role scoping', () => {
  it('rejects a collector requesting assigned credits for another collector', async () => {
    const prisma = {
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.listarCreditosAsignadosACobrador(
        'cobrador-ajeno',
        { id: 'cobrador-propio', rol: RolUsuario.COBRADOR } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.asignacionRuta.findMany).not.toHaveBeenCalled();
  });

  it('allows supervisors to request assigned credits for a collector', async () => {
    const prisma = {
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.listarCreditosAsignadosACobrador(
        'cobrador-1',
        { id: 'supervisor-1', rol: RolUsuario.SUPERVISOR } as any,
      ),
    ).resolves.toEqual({ cobradorId: 'cobrador-1', total: 0, data: [] });

    expect(prisma.asignacionRuta.findMany).toHaveBeenCalled();
  });

  it('forces route list queries from collectors to their own user id', async () => {
    const prisma = {
      ruta: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = makeService(prisma);

    await service.findAll(
      { cobradorId: 'cobrador-ajeno', take: 10 },
      { id: 'cobrador-propio', rol: RolUsuario.COBRADOR } as any,
    );

    expect(prisma.ruta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eliminadoEn: null,
          cobradorId: 'cobrador-propio',
        }),
      }),
    );
    expect(prisma.ruta.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        eliminadoEn: null,
        cobradorId: 'cobrador-propio',
      }),
    });
  });

  it('rejects a collector requesting daily visits for a route they do not own', async () => {
    const prisma = {
      ruta: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.getDailyVisits(
        'ruta-ajena',
        undefined,
        { id: 'cobrador-propio', rol: RolUsuario.COBRADOR } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.ruta.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'ruta-ajena',
        eliminadoEn: null,
        cobradorId: 'cobrador-propio',
      },
      select: { id: true },
    });
    expect(prisma.asignacionRuta.findMany).not.toHaveBeenCalled();
  });

  it('rejects a collector checking activation for a route they do not own', async () => {
    const prisma = {
      ruta: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      caja: {
        findFirst: jest.fn(),
      },
      transaccion: {
        findFirst: jest.fn(),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.getRutaActivadaHoy(
        'ruta-ajena',
        { id: 'cobrador-propio', rol: RolUsuario.COBRADOR } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.ruta.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'ruta-ajena',
        eliminadoEn: null,
        cobradorId: 'cobrador-propio',
      },
      select: { id: true },
    });
    expect(prisma.caja.findFirst).not.toHaveBeenCalled();
    expect(prisma.transaccion.findFirst).not.toHaveBeenCalled();
  });
});
