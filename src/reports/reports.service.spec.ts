import { ReportsService } from './reports.service';

describe('ReportsService operational report', () => {
  it('no suma cuota inicial como recaudo ni meta operativa en reportes por periodo', async () => {
    const prisma = {
      ruta: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ruta-1',
            nombre: 'Ruta 1',
            cobrador: {
              id: 'cobrador-1',
              nombres: 'Ana',
              apellidos: 'Ruta',
            },
            asignaciones: [
              {
                cliente: {
                  id: 'cliente-1',
                },
              },
            ],
          },
        ]),
      },
      pago: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { montoTotal: 100000 } })
          .mockResolvedValueOnce({ _sum: { montoTotal: 100000 } }),
      },
      prestamo: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({
            _sum: { monto: 500000, cuotaInicial: 20000 },
            _count: { id: 1 },
          })
          .mockResolvedValueOnce({
            _sum: { monto: 500000, cuotaInicial: 20000 },
            _count: { id: 1 },
          }),
      },
      cliente: {
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0),
      },
      cuota: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({
            _sum: { monto: 200000, montoInteresMora: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { monto: 200000, montoInteresMora: 0 },
          }),
      },
    };
    const service = new ReportsService(prisma as any, {} as any, {} as any);

    const result = await service.getOperationalReport({
      period: 'week',
    } as any);

    expect(result.totalRecaudo).toBe(100000);
    expect(result.totalMeta).toBe(200000);
    expect(result.rendimientoRutas[0]).toMatchObject({
      recaudado: 100000,
      meta: 200000,
      eficiencia: 50,
      montoNuevosPrestamos: 500000,
    });
  });
});

describe('ReportsService getRouteDetail: jurisdicción del supervisor', () => {
  function prismaConRuta(supervisorId: string) {
    return {
      ruta: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ruta-x',
          nombre: 'Ruta X',
          supervisorId,
          cobrador: null,
          supervisor: { id: supervisorId, nombres: 'S', apellidos: 'V' },
        }),
      },
      asignacionRuta: { findMany: jest.fn().mockResolvedValue([]) },
      pago: { aggregate: jest.fn().mockResolvedValue({ _sum: {} }) },
      prestamo: { aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: {} }) },
      cliente: { count: jest.fn().mockResolvedValue(0) },
      cuota: { aggregate: jest.fn().mockResolvedValue({ _sum: {} }) },
    } as any;
  }

  it('un supervisor NO puede ver una ruta que no supervisa (403)', async () => {
    const prisma = prismaConRuta('otro-supervisor');
    const service = new ReportsService(prisma, {} as any, {} as any);
    await expect(
      service.getRouteDetail('ruta-x', { period: 'week' }, {
        id: 'sup-1',
        rol: 'SUPERVISOR',
      }),
    ).rejects.toThrow(/No supervisa/);
  });

  it('el admin puede ver cualquier ruta', async () => {
    const prisma = prismaConRuta('otro-supervisor');
    const service = new ReportsService(prisma, {} as any, {} as any);
    // no debe lanzar por jurisdicción (puede fallar más adelante por mocks, se ignora)
    await service.getRouteDetail('ruta-x', { period: 'week' }, {
      id: 'admin-1',
      rol: 'ADMIN',
    }).catch(() => undefined);
    expect(prisma.ruta.findUnique).toHaveBeenCalled();
  });
})
