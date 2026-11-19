import { DashboardService } from './dashboard.service';
import { comoPrisma, type DobleDePrisma } from '../common/testing/dobles';

function buildPrismaMock(overrides: DobleDePrisma = {}) {
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

    const result = await new DashboardService(
      comoPrisma(prisma),
    ).getDashboardData('today');

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

    const result = await new DashboardService(
      comoPrisma(prisma),
    ).getDashboardData('today', { id: 'supervisor-1', rol: 'SUPERVISOR' });

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
      },
      cuota: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 200000 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      transaccion: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 20000 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    const result = await new DashboardService(
      comoPrisma(prisma),
    ).getDashboardData('today');

    expect(result.topCollectors[0]).toMatchObject({
      name: 'Ana Ruta',
      collected: 100000,
      efficiency: 50,
    });
  });
});

/**
 * La insignia de aprobaciones pendientes no se filtra por período.
 *
 * ── El defecto ─────────────────────────────────────────────────────────────
 *
 * El contador y la lista de pendientes del panel llevaban
 * `creadoEn: { gte: startDate, lte: endDate }`, el período que el usuario elige
 * arriba (por defecto «mes»). Pero una solicitud pendiente es un estado
 * ACTUAL, no un suceso del período: la que entró el mes pasado sigue esperando
 * hoy. El propio archivo ya lo tenía escrito dos líneas más abajo, para la
 * mora: «sin filtro de período porque la mora es un estado ACTUAL del préstamo,
 * no depende de cuándo se creó».
 *
 * ── Medido contra la base de desarrollo (2026-11-19) ───────────────────────
 *
 * Con el período por defecto el panel decía **1** y la pantalla de aprobaciones
 * mostraba **39**: 20 clientes nuevos, 9 solicitudes de base, 4 créditos, 4
 * gastos, una reprogramación y un pago por transferencia. Con «hoy»
 * seleccionado habría dicho 0.
 *
 * Y no es una cifra de estadística: se pinta como la INSIGNIA de una tarjeta de
 * acceso rápido (`app/admin/page.tsx` y `app/coordinador/page.tsx`), donde un
 * «1» se lee «tienes una cosa esperando». Nueve de esas 39 son solicitudes de
 * efectivo.
 */
describe('las aprobaciones pendientes del panel son un estado, no un período', () => {
  const sinPeriodo = (llamada: { where?: Record<string, unknown> }) =>
    !Object.prototype.hasOwnProperty.call(llamada?.where ?? {}, 'creadoEn');

  it('el contador pregunta por todas las pendientes', async () => {
    const prisma = buildPrismaMock();

    await new DashboardService(comoPrisma(prisma)).getDashboardData('month');

    const porPendientes = prisma.aprobacion.count.mock.calls
      .map((c) => c[0])
      .filter(
        (a: { where?: Record<string, unknown> }) =>
          a?.where?.estado === 'PENDIENTE',
      );

    // Piso: si el servicio dejara de contar aprobaciones, esto avisaría en vez
    // de pasar en verde sin haber comprobado nada.
    expect(porPendientes.length).toBeGreaterThan(0);
    expect(porPendientes.every(sinPeriodo)).toBe(true);
  });

  it('y la lista que las enseña, también', async () => {
    const prisma = buildPrismaMock();

    await new DashboardService(comoPrisma(prisma)).getDashboardData('today');

    const listados = prisma.aprobacion.findMany.mock.calls
      .map((c) => c[0])
      .filter(
        (a: { where?: Record<string, unknown> }) =>
          a?.where?.estado === 'PENDIENTE',
      );

    expect(listados.length).toBeGreaterThan(0);
    expect(listados.every(sinPeriodo)).toBe(true);
  });

  it('el período sigue mandando donde sí es un período', async () => {
    // El capital prestado y el recaudo SÍ son del período elegido. Si el
    // arreglo se hubiera pasado de ancho, el panel dejaría de responder al
    // filtro de arriba.
    const prisma = buildPrismaMock();

    await new DashboardService(comoPrisma(prisma)).getDashboardData('week');

    const conPeriodo = prisma.prestamo.aggregate.mock.calls
      .map((c) => c[0])
      .filter((a: { where?: Record<string, unknown> }) =>
        Object.prototype.hasOwnProperty.call(a?.where ?? {}, 'creadoEn'),
      );

    expect(conPeriodo.length).toBeGreaterThan(0);
  });
});
