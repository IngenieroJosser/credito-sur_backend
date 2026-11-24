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
    /*
     * El conteo de cuentas en mora se hace con SQL a mano.
     *
     * Antes era un `findMany` de hasta 500 creditos que se filtraba en memoria,
     * asi que el doble no necesitaba `$queryRaw` y el numero no podia pasar de
     * 500 ni en produccion. Al pasarlo a un `count(*)` estas ocho pruebas
     * cayeron todas con «this.prisma.$queryRaw is not a function», que es
     * exactamente la señal de que ejercitan el codigo de verdad y no lo leen.
     */
    $queryRaw: jest.fn().mockResolvedValue([{ total: 0 }]),
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

/**
 * El efectivo que piden las rutas se suma entero, no solo lo que se ve.
 *
 * `requestedBase` se calculaba recorriendo `pendingApprovalsList`, que lleva
 * `take: 5` porque es la lista que el panel PINTA. O sea que la cifra era «lo
 * que suman las solicitudes de base que estén entre las cinco aprobaciones más
 * recientes», y se lee como el total. Es el techo silencioso de §P1, esta vez
 * sobre dinero.
 *
 * Medido el 2026-11-19 contra la base de desarrollo: el panel decía **0** y
 * había **9 solicitudes de base pendientes por 450.000**. Antes de cambiarlo se
 * comprobó que la columna `montoSolicitud` coincide con el `monto` del JSON en
 * las 9 filas, que es el valor que se venía pintando.
 */
describe('la base solicitada del panel es la de todas las solicitudes', () => {
  it('sale de una consulta propia, no de la lista de cinco', async () => {
    const prisma = buildPrismaMock({
      aprobacion: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { montoSolicitud: 450000 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    const r = (await new DashboardService(comoPrisma(prisma)).getDashboardData(
      'month',
    )) as { metrics: { requestedBase: number } };

    // La lista de pendientes va vacía a propósito: si la cifra saliera de ahí,
    // esto daría 0.
    expect(r.metrics.requestedBase).toBe(450000);
  });

  it('y pregunta solo por las solicitudes de base pendientes', async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValue({ _sum: { montoSolicitud: 0 } });
    const prisma = buildPrismaMock({
      aprobacion: {
        count: jest.fn().mockResolvedValue(0),
        aggregate,
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    await new DashboardService(comoPrisma(prisma)).getDashboardData('month');

    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: 'PENDIENTE',
          tipoAprobacion: 'SOLICITUD_BASE_EFECTIVO',
        }),
        _sum: { montoSolicitud: true },
      }),
    );
  });

  it('sin solicitudes pendientes da 0, no undefined', async () => {
    // `$ 0` aquí significa «nadie ha pedido base», que es cierto. Lo que no
    // puede salir es `undefined` pintado como texto.
    const prisma = buildPrismaMock({
      aprobacion: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { montoSolicitud: null } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    const r = (await new DashboardService(comoPrisma(prisma)).getDashboardData(
      'month',
    )) as { metrics: { requestedBase: number } };

    expect(r.metrics.requestedBase).toBe(0);
  });
});
