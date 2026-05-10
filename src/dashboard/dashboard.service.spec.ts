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
    },
    journalLine: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { debitAmount: 123456 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe('DashboardService accounting-backed collections', () => {
  it('usa ledger PAGO como fuente del recaudo del dashboard', async () => {
    const prisma = buildPrismaMock();

    const result = await new DashboardService(prisma as any).getDashboardData('today');

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
});
