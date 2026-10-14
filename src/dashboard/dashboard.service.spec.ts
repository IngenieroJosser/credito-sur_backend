import { DashboardService } from './dashboard.service';

function buildPrismaMock(overrides: Record<string, any> = {}) {
  return {
    aprobacion: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { montoSolicitud: 0 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    prestamo: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    pago: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { montoTotal: 999999 } }),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    transaccion: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    cuota: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    usuario: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    journalLine: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { debitAmount: 123456 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe('DashboardService accounting-backed collections', () => {
  it('ubica una transferencia en la tendencia segun fechaPago y no segun aprobacion', async () => {
    const prisma = buildPrismaMock({
      pago: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { montoTotal: 0 } }),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pago-transferencia-1',
            fechaPago: new Date('2026-10-08T18:57:02.000Z'),
          },
        ]),
      },
      journalLine: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { debitAmount: 16666 } }),
        findMany: jest.fn().mockResolvedValue([
          {
            debitAmount: 16666,
            journalEntry: {
              referenceId: 'pago-transferencia-1',
              // El asiento se creo al aprobar al dia siguiente.
              createdAt: new Date('2026-10-09T14:00:00.000Z'),
            },
          },
        ]),
      },
    });
    const service = new DashboardService(prisma as any);

    const result = await (service as any).processTrendData(
      new Date('2026-10-08T05:00:00.000Z'),
      new Date('2026-10-09T04:59:59.999Z'),
      'day',
    );

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(16666);
    expect(prisma.journalLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          journalEntry: expect.objectContaining({
            referenceId: { in: ['pago-transferencia-1'] },
          }),
        }),
      }),
    );
  });

  it('usa ledger PAGO como fuente del recaudo del dashboard', async () => {
    const prisma = buildPrismaMock();

    const result = await new DashboardService(prisma as any).getDashboardData(
      'today',
    );

    expect(prisma.journalLine.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { accountCode: { startsWith: '1.1' } },
            { accountCode: { startsWith: '1.2' } },
          ],
          journalEntry: expect.objectContaining({
            isOpening: false,
            referenceType: 'PAGO',
          }),
        }),
      }),
    );
    expect(result.metrics.recaudo).toBe(123456);
  });

  it('calcula prestamos pagados vs activos para las rutas supervisadas', async () => {
    const prisma = buildPrismaMock({
      prestamo: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
        count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(7),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    const result = await new DashboardService(prisma as any).getDashboardData(
      'today',
      { id: 'supervisor-1', rol: 'SUPERVISOR' },
    );

    expect(prisma.prestamo.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          estado: 'PAGADO',
          // La ruta la lleva el credito, no el cliente.
          ruta: expect.objectContaining({
            is: expect.objectContaining({
              supervisorId: 'supervisor-1',
            }),
          }),
        }),
      }),
    );
    expect(prisma.prestamo.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          estado: { in: ['ACTIVO', 'EN_MORA'] },
          saldoPendiente: { gt: 0 },
        }),
      }),
    );
    expect(result.metrics.loanCompletion).toEqual({
      pagados: 3,
      activos: 7,
      total: 10,
      porcentaje: 30,
    });
  });

  it('no suma cuota inicial como recaudo operativo en top cobradores', async () => {
    const prisma = buildPrismaMock({
      pago: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { montoTotal: 100000 } }),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([
          {
            cobradorId: 'cobrador-1',
            _sum: { montoTotal: 100000 },
          },
        ]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          nombres: 'Ana',
          apellidos: 'Ruta',
          rol: 'COBRADOR',
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cobrador-1',
            nombres: 'Ana',
            apellidos: 'Ruta',
            rol: 'COBRADOR',
          },
        ]),
      },
      cuota: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 200000 } }),
        findMany: jest.fn().mockResolvedValue([
          {
            monto: 200000,
            prestamo: { ruta: { cobradorId: 'cobrador-1' } },
          },
        ]),
      },
      transaccion: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 20000 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    const result = await new DashboardService(prisma as any).getDashboardData(
      'today',
    );

    expect(result.topCollectors[0]).toMatchObject({
      name: 'Ana Ruta',
      collected: 100000,
      efficiency: 50,
    });
  });
});
