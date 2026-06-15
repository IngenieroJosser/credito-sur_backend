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
        count: jest
          .fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0),
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
    const service = new ReportsService(
      prisma as any,
      {} as any,
      {} as any,
    );

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
