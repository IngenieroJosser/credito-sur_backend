import { BadRequestException } from '@nestjs/common';
import {
  EstadoAprobacion,
  TipoAprobacion,
  TipoTransaccion,
} from '@prisma/client';
import { AccountingService } from './accounting.service';

const mockNotifications = {
  notifyApprovers: jest.fn().mockResolvedValue(undefined),
  notifyCoordinator: jest.fn().mockResolvedValue(undefined),
  create: jest.fn().mockResolvedValue(undefined),
};

const mockGateway = {
  broadcastDashboardsActualizados: jest.fn(),
};

const mockLedger = {
  registrarAsiento: jest.fn().mockResolvedValue({ id: 'journal-1' }),
  registrarArqueoDescuadre: jest.fn().mockResolvedValue({ id: 'journal-2' }),
  registrarVentaArticulo: jest
    .fn()
    .mockResolvedValue({ id: 'journal-venta-articulo' }),
  registrarConsolidacion: jest
    .fn()
    .mockResolvedValue({ id: 'journal-consolidacion' }),
};

function buildPrismaMock(overrides: Record<string, any> = {}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    caja: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    transaccion: {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'trx-1', tipoReferencia: 'ARQUEO' }),
    },
    gasto: {
      create: jest.fn().mockResolvedValue({ id: 'gasto-1' }),
    },
  };

  return {
    $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    _tx: tx,
    journalLine: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          debitAmount: 0,
          creditAmount: 0,
        },
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    journalEntry: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    caja: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { saldoActual: 500000 } }),
      count: jest.fn().mockResolvedValue(3),
      findUnique: jest.fn().mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        rutaId: 'ruta-1',
        responsableId: 'cobrador-1',
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        rutaId: 'ruta-1',
        responsableId: 'cobrador-1',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ruta: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'ruta-1', cobradorId: 'cobrador-1' }),
    },
    aprobacion: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'approval-1' }),
    },
    gasto: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    usuario: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ nombres: 'Cobra', apellidos: 'Dor' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    colaSincronizacion: {
      count: jest.fn().mockResolvedValue(0),
    },
    syncConflict: {
      count: jest.fn().mockResolvedValue(0),
    },
    cuota: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    pago: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    transaccion: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'trx-zero', tipoReferencia: 'ARQUEO' }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    prestamo: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
    },
    detallePago: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { montoInteres: 0, montoInteresMora: 0 } }),
    },
    ...overrides,
  };
}

function makeService(prisma: any) {
  return new AccountingService(
    prisma,
    mockNotifications as any,
    mockGateway as any,
    mockLedger as any,
  );
}

describe('AccountingService financial ledger controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filtra movimientos ledger por el día completo en zona Bogotá y expone la caja afectada', async () => {
    const createdAt = new Date('2026-05-09T21:46:00.000Z');
    const prisma = buildPrismaMock({
      journalEntry: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'journal-articulo-1',
            createdAt,
            referenceType: 'VENTA_ARTICULO',
            referenceId: 'prestamo-art-1',
            description: 'Venta de artículo',
            createdBy: 'admin-1',
            lines: [
              {
                id: 'line-caja-1',
                accountCode: '1.1.1',
                account: { code: '1.1.1', name: 'Caja Oficina', type: 'ASSET' },
                debitAmount: 500000,
                creditAmount: 0,
                cajaId: 'caja-oficina',
                caja: {
                  id: 'caja-oficina',
                  nombre: 'Caja de Oficina',
                  codigo: 'CAJA-OFICINA',
                  tipo: 'PRINCIPAL',
                },
              },
              {
                id: 'line-ingreso-1',
                accountCode: '3.4',
                account: {
                  code: '3.4',
                  name: 'Ingresos por Artículos',
                  type: 'INCOME',
                },
                debitAmount: 0,
                creditAmount: 500000,
                cajaId: null,
                caja: null,
              },
            ],
          },
        ]),
      },
    });

    const result = (await makeService(prisma).getMovimientosLedger({
      cajaId: 'caja-oficina',
      fechaInicio: '2026-05-09',
      fechaFin: '2026-05-09',
    })) as any;

    const where = prisma.journalEntry.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte.toISOString()).toBe('2026-05-09T05:00:00.000Z');
    expect(where.createdAt.lte.toISOString()).toBe('2026-05-10T04:59:59.999Z');
    expect(result.data[0].caja).toBe('Caja de Oficina');
    expect(result.data[0].lineas[0].caja).toBe('Caja de Oficina');
  });

  it('calcula el resumen financiero desde JournalLine y excluye asientos de apertura', async () => {
    const prisma = buildPrismaMock();
    prisma.journalLine.aggregate
      .mockResolvedValueOnce({ _sum: { debitAmount: 120000 } }) // ingresos caja hoy
      .mockResolvedValueOnce({ _sum: { creditAmount: 120000, debitAmount: 0 } }) // ingresos hoy 3.x
      .mockResolvedValueOnce({ _sum: { creditAmount: 90000, debitAmount: 0 } }) // intereses hoy 3.1
      .mockResolvedValueOnce({ _sum: { creditAmount: 25000, debitAmount: 0 } }) // mora hoy 3.2
      .mockResolvedValueOnce({ _sum: { creditAmount: 5000, debitAmount: 0 } }) // otros ingresos hoy 3.3
      .mockResolvedValueOnce({ _sum: { creditAmount: 0, debitAmount: 0 } }) // articulos hoy 3.4
      .mockResolvedValueOnce({ _sum: { debitAmount: 35000, creditAmount: 0 } }) // gastos hoy 4.x
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // costos hoy 5.x
      .mockResolvedValueOnce({
        _sum: { debitAmount: 900000, creditAmount: 250000 },
      }) // cartera
      .mockResolvedValueOnce({
        _sum: { debitAmount: 50000, creditAmount: 10000 },
      }) // deuda cobrador
      .mockResolvedValueOnce({ _sum: { debitAmount: 180000 } }) // cobranza hoy PAGO -> caja
      .mockResolvedValueOnce({ _sum: { debitAmount: 80000 } }) // cobranza ayer
      .mockResolvedValueOnce({ _sum: { debitAmount: 80000 } }) // ingresos caja ayer
      .mockResolvedValueOnce({ _sum: { creditAmount: 80000, debitAmount: 0 } }) // ingresos periodo anterior
      .mockResolvedValueOnce({ _sum: { debitAmount: 20000, creditAmount: 0 } }) // gastos periodo anterior
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }); // costos periodo anterior
    prisma.caja.aggregate
      .mockResolvedValueOnce({ _sum: { saldoActual: 500000 } }); // saldo total cajas
    prisma.caja.count
      .mockResolvedValueOnce(5) // total rutas
      .mockResolvedValueOnce(3) // rutas abiertas
      .mockResolvedValueOnce(2) // rutas pendientes consolidación
      .mockResolvedValueOnce(1) // consolidaciones hoy
      .mockResolvedValueOnce(4); // cajas abiertas
    prisma.transaccion.aggregate
      .mockResolvedValueOnce({ _sum: { monto: 50000 } }) // cuota inicial hoy ingreso
      .mockResolvedValueOnce({ _sum: { monto: 0 } }) // cuota inicial hoy reverso
      .mockResolvedValueOnce({ _sum: { monto: 30000 } }) // cuota inicial ayer ingreso
      .mockResolvedValueOnce({ _sum: { monto: 0 } }); // cuota inicial ayer reverso
    prisma.prestamo.aggregate
      .mockResolvedValueOnce({ _sum: { saldoPendiente: 650000 } }) // cartera activa real
      .mockResolvedValue({ _sum: { saldoPendiente: 0 } }); // provisiones

    const result = (await makeService(prisma).getResumenFinanciero(
      '2026-05-08',
      '2026-05-08',
    )) as any;

    expect(prisma.journalLine.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountCode: { startsWith: '3.' },
          journalEntry: expect.objectContaining({ isOpening: false }),
        }),
      }),
    );
    expect(result.ingresosHoy).toBe(120000);
    expect(result.ingresosDevengadosHoy).toBe(115000);
    expect(result.interesHoy).toBe(90000);
    expect(result.moraHoy).toBe(25000);
    expect(result.otrosIngresosHoy).toBe(5000);
    expect(result.cobranzaHoy).toBe(180000);
    expect(result.egresosHoy).toBe(35000);
    expect(result.gananciaNeta).toBe(80000);
    expect(result.capitalEnCalle).toBe(650000);
    expect(prisma.prestamo.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          saldoPendiente: { gt: 0 },
          estado: { notIn: ['BORRADOR', 'PENDIENTE_APROBACION', 'PAGADO'] },
        }),
        _sum: { saldoPendiente: true },
      }),
    );
    expect(result.deudaCobradorHoy).toBe(40000);
  });

  it('revalida el saldo de caja dentro de la transacción al consolidar', async () => {
    const prisma = buildPrismaMock();
    prisma.caja.findUnique.mockResolvedValue({
      id: 'caja-ruta-1',
      nombre: 'Caja Ruta 1',
      tipo: 'RUTA',
      saldoActual: 100000,
      ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
    });
    prisma.caja.findFirst.mockResolvedValue({
      id: 'caja-oficina',
      nombre: 'Caja Oficina',
      codigo: 'CAJA-OFICINA',
      tipo: 'PRINCIPAL',
      saldoActual: 0,
    });
    prisma._tx.caja.findUnique.mockResolvedValue({
      id: 'caja-ruta-1',
      nombre: 'Caja Ruta 1',
      tipo: 'RUTA',
      saldoActual: 30000,
      ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
    });

    await expect(
      makeService(prisma).consolidarCaja('caja-ruta-1', 'admin-1', 50000),
    ).rejects.toThrow(BadRequestException);

    expect(prisma._tx.$queryRaw).toHaveBeenCalled();
    expect(prisma._tx.transaccion.create).not.toHaveBeenCalled();
    expect(mockLedger.registrarAsiento).not.toHaveBeenCalled();
  });

  describe('consolidarCaja idempotencia', () => {
    it('crea TRX-OUT y TRX-IN con idempotencyKey', async () => {
      const prisma = buildPrismaMock();
      prisma.caja.findUnique.mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        saldoActual: 100000,
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
      });
      prisma.caja.findFirst.mockResolvedValue({
        id: 'caja-oficina',
        nombre: 'Caja Oficina',
        codigo: 'CAJA-OFICINA',
        tipo: 'PRINCIPAL',
        saldoActual: 0,
      });
      prisma.transaccion.findFirst.mockResolvedValue(null);
      prisma._tx.caja.findUnique.mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        saldoActual: 100000,
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
      });
      prisma._tx.transaccion.create
        .mockResolvedValueOnce({ id: 'trx-out-1' })
        .mockResolvedValueOnce({ id: 'trx-in-1' });

      await makeService(prisma).consolidarCaja('caja-ruta-1', 'admin-1', 50000);

      expect(prisma._tx.transaccion.create).toHaveBeenCalledTimes(2);
      expect(prisma._tx.transaccion.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          idempotencyKey: expect.stringContaining(':OUT'),
        }),
      });
      expect(prisma._tx.transaccion.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          idempotencyKey: expect.stringContaining(':IN'),
        }),
      });
    });

    it('si se reintenta la misma recolección con la misma idempotencyKey, no duplica transacciones', async () => {
      const prisma = buildPrismaMock();
      prisma.caja.findUnique.mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        saldoActual: 100000,
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
      });
      prisma.caja.findFirst.mockResolvedValue({
        id: 'caja-oficina',
        nombre: 'Caja Oficina',
        codigo: 'CAJA-OFICINA',
        tipo: 'PRINCIPAL',
        saldoActual: 0,
      });
      prisma.transaccion.findFirst
        .mockResolvedValueOnce({
          id: 'trx-out-1',
          numeroTransaccion: 'TRX-OUT-001',
          monto: 50000,
          referenciaId: 'RECOL-001',
        })
        .mockResolvedValueOnce({
          id: 'trx-in-1',
          numeroTransaccion: 'TRX-IN-001',
          referenciaId: 'RECOL-001',
        });

      const result = await makeService(prisma).consolidarCaja('caja-ruta-1', 'admin-1', 50000);

      expect(prisma._tx.transaccion.create).not.toHaveBeenCalled();
      expect(mockLedger.registrarAsiento).not.toHaveBeenCalled();
      expect(result.idempotente).toBe(true);
      expect(result.monto).toBe(50000);
    });

    it('si se reintenta, no vuelve a modificar saldos', async () => {
      const prisma = buildPrismaMock();
      prisma.caja.findUnique.mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        saldoActual: 100000,
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
      });
      prisma.caja.findFirst.mockResolvedValue({
        id: 'caja-oficina',
        nombre: 'Caja Oficina',
        codigo: 'CAJA-OFICINA',
        tipo: 'PRINCIPAL',
        saldoActual: 0,
      });
      prisma.transaccion.findFirst.mockResolvedValue({
        id: 'trx-out-1',
        numeroTransaccion: 'TRX-OUT-001',
        monto: 50000,
        referenciaId: 'RECOL-001',
      });
      prisma.transaccion.findFirst.mockResolvedValue({
        id: 'trx-in-1',
        numeroTransaccion: 'TRX-IN-001',
        referenciaId: 'RECOL-001',
      });

      await makeService(prisma).consolidarCaja('caja-ruta-1', 'admin-1', 50000);

      expect(prisma._tx.transaccion.create).not.toHaveBeenCalled();
      expect(mockLedger.registrarAsiento).not.toHaveBeenCalled();
    });

    it('rechaza saldo insuficiente', async () => {
      const prisma = buildPrismaMock();
      prisma.caja.findUnique.mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        saldoActual: 10000,
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
      });
      prisma.caja.findFirst.mockResolvedValue({
        id: 'caja-oficina',
        nombre: 'Caja Oficina',
        codigo: 'CAJA-OFICINA',
        tipo: 'PRINCIPAL',
        saldoActual: 0,
      });
      prisma.transaccion.findFirst.mockResolvedValue(null);

      await expect(
        makeService(prisma).consolidarCaja('caja-ruta-1', 'admin-1', 50000),
      ).rejects.toThrow(BadRequestException);
    });

    it('bloquea caja origen con FOR UPDATE', async () => {
      const prisma = buildPrismaMock();
      prisma.caja.findUnique.mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        saldoActual: 100000,
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
      });
      prisma.caja.findFirst.mockResolvedValue({
        id: 'caja-oficina',
        nombre: 'Caja Oficina',
        codigo: 'CAJA-OFICINA',
        tipo: 'PRINCIPAL',
        saldoActual: 0,
      });
      prisma.transaccion.findFirst.mockResolvedValue(null);
      prisma._tx.caja.findUnique.mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        saldoActual: 100000,
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
      });
      prisma._tx.transaccion.create
        .mockResolvedValueOnce({ id: 'trx-out-1' })
        .mockResolvedValueOnce({ id: 'trx-in-1' });

      await makeService(prisma).consolidarCaja('caja-ruta-1', 'admin-1', 50000);

      expect(prisma._tx.$queryRaw).toHaveBeenCalled();
      const callArgs = prisma._tx.$queryRaw.mock.calls[0];
      expect(callArgs[0]).toContain('FOR UPDATE');
    });

    it('mantiene destino CAJA-OFICINA o CAJA-PRINCIPAL según lógica actual', async () => {
      const prisma = buildPrismaMock();
      prisma.caja.findUnique.mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        saldoActual: 100000,
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
      });
      prisma.caja.findFirst.mockResolvedValue({
        id: 'caja-oficina',
        nombre: 'Caja Oficina',
        codigo: 'CAJA-OFICINA',
        tipo: 'PRINCIPAL',
        saldoActual: 0,
      });
      prisma.transaccion.findFirst.mockResolvedValue(null);
      prisma._tx.caja.findUnique.mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        saldoActual: 100000,
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
      });
      prisma._tx.transaccion.create
        .mockResolvedValueOnce({ id: 'trx-out-1' })
        .mockResolvedValueOnce({ id: 'trx-in-1' });

      const result = await makeService(prisma).consolidarCaja('caja-ruta-1', 'admin-1', 50000);

      expect(result.destino).toBe('Caja Oficina');
    });

    it('no toca caja de ventas contado', async () => {
      const prisma = buildPrismaMock();
      prisma.caja.findUnique.mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        saldoActual: 100000,
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
      });
      prisma.caja.findFirst.mockResolvedValue({
        id: 'caja-oficina',
        nombre: 'Caja Oficina',
        codigo: 'CAJA-OFICINA',
        tipo: 'PRINCIPAL',
        saldoActual: 0,
      });
      prisma.transaccion.findFirst.mockResolvedValue(null);
      prisma._tx.caja.findUnique.mockResolvedValue({
        id: 'caja-ruta-1',
        nombre: 'Caja Ruta 1',
        tipo: 'RUTA',
        saldoActual: 100000,
        ruta: { id: 'ruta-1', nombre: 'Ruta 1' },
      });
      prisma._tx.transaccion.create
        .mockResolvedValueOnce({ id: 'trx-out-1' })
        .mockResolvedValueOnce({ id: 'trx-in-1' });

      await makeService(prisma).consolidarCaja('caja-ruta-1', 'admin-1', 50000);

      expect(prisma._tx.transaccion.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          tipoReferencia: 'RECOLECCION',
        }),
      });
      expect(prisma._tx.transaccion.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          tipoReferencia: 'RECOLECCION',
        }),
      });
    });
  });

  it('calcula utilidad operativa y neta separando ingresos, gastos y costos desde ledger', async () => {
    const prisma = buildPrismaMock();
    prisma.journalLine.aggregate
      .mockResolvedValueOnce({ _sum: { debitAmount: 150000 } }) // ingresos caja
      .mockResolvedValueOnce({ _sum: { creditAmount: 150000 } }) // ingresos 3.x
      .mockResolvedValueOnce({ _sum: { creditAmount: 90000 } }) // intereses 3.1
      .mockResolvedValueOnce({ _sum: { creditAmount: 25000 } }) // mora 3.2
      .mockResolvedValueOnce({ _sum: { creditAmount: 5000 } }) // otros ingresos 3.3
      .mockResolvedValueOnce({ _sum: { creditAmount: 30000 } }) // margen/ventas articulos 3.4
      .mockResolvedValueOnce({ _sum: { debitAmount: 35000 } }) // gastos 4.x
      .mockResolvedValueOnce({ _sum: { debitAmount: 12000 } }) // costos 5.x
      .mockResolvedValueOnce({
        _sum: { debitAmount: 900000, creditAmount: 250000 },
      }) // cartera
      .mockResolvedValueOnce({
        _sum: { debitAmount: 50000, creditAmount: 10000 },
      }) // deuda cobrador
      .mockResolvedValueOnce({ _sum: { debitAmount: 180000 } }) // cobranza
      .mockResolvedValueOnce({ _sum: { debitAmount: 80000 } }) // ingresos caja anterior
      .mockResolvedValueOnce({ _sum: { creditAmount: 80000, debitAmount: 0 } }) // ingresos anterior
      .mockResolvedValueOnce({ _sum: { debitAmount: 20000, creditAmount: 0 } }) // gastos anterior
      .mockResolvedValueOnce({ _sum: { debitAmount: 5000, creditAmount: 0 } }); // costos anterior
    prisma.caja.aggregate
      .mockResolvedValueOnce({ _sum: { saldoActual: 500000 } }); // saldo total cajas
    prisma.caja.count
      .mockResolvedValueOnce(5) // total rutas
      .mockResolvedValueOnce(3) // rutas abiertas
      .mockResolvedValueOnce(2) // rutas pendientes consolidación
      .mockResolvedValueOnce(1) // consolidaciones hoy
      .mockResolvedValueOnce(4); // cajas abiertas
    prisma.transaccion.aggregate
      .mockResolvedValueOnce({ _sum: { monto: 50000 } }) // cuota inicial hoy ingreso
      .mockResolvedValueOnce({ _sum: { monto: 0 } }) // cuota inicial hoy reverso
      .mockResolvedValueOnce({ _sum: { monto: 30000 } }) // cuota inicial ayer ingreso
      .mockResolvedValueOnce({ _sum: { monto: 0 } }); // cuota inicial ayer reverso
    prisma.prestamo.aggregate
      .mockResolvedValueOnce({ _sum: { saldoPendiente: 650000 } }) // cartera activa real
      .mockResolvedValue({ _sum: { saldoPendiente: 0 } }); // provisiones

    const result = (await makeService(prisma).getResumenFinanciero(
      '2026-05-08',
      '2026-05-08',
    )) as any;

    expect(prisma.journalLine.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountCode: { startsWith: '5.' } }),
      }),
    );
    expect(result.ingresosArticulosHoy).toBe(30000);
    expect(result.margenArticulosHoy).toBe(18000);
    expect(result.costosVentasHoy).toBe(12000);
    expect(result.ingresosDevengadosHoy).toBe(133000);
    expect(result.utilidadOperativa).toBe(98000);
    expect(result.gananciaNeta).toBe(98000);
    expect(result.utilidadReal).toBe(98000);
  });

  it('mantiene ingresos devengados separados de entradas de caja', async () => {
    const prisma = buildPrismaMock();
    prisma.journalLine.aggregate
      .mockResolvedValueOnce({ _sum: { debitAmount: 500000 } }) // ingresos de caja: cuota inicial
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // ingresos operativos 3.x sin artículos
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // intereses
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // mora
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // otros ingresos
      .mockResolvedValueOnce({ _sum: { creditAmount: 2400000 } }) // venta articulo 3.4
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // gastos
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // costos
      .mockResolvedValueOnce({
        _sum: { debitAmount: 1900000, creditAmount: 0 },
      }) // cartera
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // deuda cobrador
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // cobranza
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // ingresos caja periodo anterior
      .mockResolvedValueOnce({ _sum: { creditAmount: 0, debitAmount: 0 } }) // ingresos contables periodo anterior
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // gastos periodo anterior
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }); // costos periodo anterior
    prisma.caja.aggregate
      .mockResolvedValueOnce({ _sum: { saldoActual: 500000 } }); // saldo total cajas
    prisma.caja.count
      .mockResolvedValueOnce(5) // total rutas
      .mockResolvedValueOnce(3) // rutas abiertas
      .mockResolvedValueOnce(2) // rutas pendientes consolidación
      .mockResolvedValueOnce(1) // consolidaciones hoy
      .mockResolvedValueOnce(4); // cajas abiertas
    prisma.transaccion.aggregate
      .mockResolvedValueOnce({ _sum: { monto: 50000 } }) // cuota inicial hoy ingreso
      .mockResolvedValueOnce({ _sum: { monto: 0 } }) // cuota inicial hoy reverso
      .mockResolvedValueOnce({ _sum: { monto: 30000 } }) // cuota inicial ayer ingreso
      .mockResolvedValueOnce({ _sum: { monto: 0 } }); // cuota inicial ayer reverso
    prisma.prestamo.aggregate
      .mockResolvedValueOnce({ _sum: { saldoPendiente: 650000 } }) // cartera activa real
      .mockResolvedValue({ _sum: { saldoPendiente: 0 } }); // provisiones

    const result = (await makeService(prisma).getResumenFinanciero(
      '2026-05-08',
      '2026-05-08',
    )) as any;

    expect(prisma.journalLine.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { accountCode: { startsWith: '1.1' } },
            { accountCode: { startsWith: '1.2' } },
          ],
          journalEntry: expect.objectContaining({
            referenceType: { in: ['PAGO', 'INGRESO', 'VENTA_ARTICULO'] },
          }),
        }),
      }),
    );
    expect(prisma.journalLine.aggregate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: [
            { accountCode: { startsWith: '3.3' } },
            { accountCode: { startsWith: '3.4' } },
          ],
        }),
      }),
    );
    expect(result.ingresosHoy).toBe(0);
    expect(result.entradasCajaHoy).toBe(500000);
    expect(result.ingresosDevengadosHoy).toBe(2400000);
    expect(result.ingresosArticulosHoy).toBe(2400000);
  });

  it('no mezcla cuota inicial ni venta de artículo en ingresos operativos', async () => {
    const prisma = buildPrismaMock();
    prisma.journalLine.aggregate
      .mockResolvedValueOnce({ _sum: { debitAmount: 500000 } }) // ingresos de caja: cuota inicial
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // ingresos operativos sin artículo
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // intereses
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // mora
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // otros ingresos
      .mockResolvedValueOnce({ _sum: { creditAmount: 2400000 } }) // venta articulo 3.4
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // gastos
      .mockResolvedValueOnce({ _sum: { debitAmount: 2000000 } }) // costos
      .mockResolvedValueOnce({
        _sum: { debitAmount: 1900000, creditAmount: 0 },
      }) // cartera
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // deuda cobrador
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // cobranza
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // ingresos caja periodo anterior
      .mockResolvedValueOnce({ _sum: { creditAmount: 0, debitAmount: 0 } }) // ingresos anterior
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // gastos anterior
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }); // costos anterior
    prisma.caja.aggregate
      .mockResolvedValueOnce({ _sum: { saldoActual: 500000 } }); // saldo total cajas
    prisma.caja.count
      .mockResolvedValueOnce(5) // total rutas
      .mockResolvedValueOnce(3) // rutas abiertas
      .mockResolvedValueOnce(2) // rutas pendientes consolidación
      .mockResolvedValueOnce(1) // consolidaciones hoy
      .mockResolvedValueOnce(4); // cajas abiertas
    prisma.transaccion.aggregate
      .mockResolvedValueOnce({ _sum: { monto: 50000 } }) // cuota inicial hoy ingreso
      .mockResolvedValueOnce({ _sum: { monto: 0 } }) // cuota inicial hoy reverso
      .mockResolvedValueOnce({ _sum: { monto: 30000 } }) // cuota inicial ayer ingreso
      .mockResolvedValueOnce({ _sum: { monto: 0 } }); // cuota inicial ayer reverso
    prisma.prestamo.aggregate
      .mockResolvedValueOnce({ _sum: { saldoPendiente: 650000 } }) // cartera activa real
      .mockResolvedValue({ _sum: { saldoPendiente: 0 } }); // provisiones

    const result = (await makeService(prisma).getResumenFinanciero(
      '2026-05-09',
      '2026-05-09',
    )) as any;

    expect(prisma.journalLine.aggregate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: [
            { accountCode: { startsWith: '3.3' } },
            { accountCode: { startsWith: '3.4' } },
          ],
        }),
      }),
    );
    expect(result.ingresosHoy).toBe(0);
    expect(result.entradasCajaHoy).toBe(500000);
    expect(result.ingresosDevengadosHoy).toBe(400000);
    expect(result.ingresosArticulosHoy).toBe(2400000);
    expect(result.margenArticulosHoy).toBe(400000);
    expect(result.utilidadOperativa).toBe(400000);
  });

  it('calcula cuotas iniciales desde transacciones sin tratarlas como ingreso operativo', async () => {
    const prisma = buildPrismaMock();
    prisma.journalLine.aggregate
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // ingresos caja hoy
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // ingresos hoy 3.x
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // intereses
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // mora
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // otros ingresos
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } }) // articulos
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // gastos
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // costos
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // cartera
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // deuda cobrador
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // cobranza
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } }) // ingresos caja anterior
      .mockResolvedValueOnce({ _sum: { creditAmount: 0, debitAmount: 0 } }) // ingresos anterior
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // gastos anterior
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }); // costos anterior
    prisma.transaccion.aggregate
      .mockResolvedValueOnce({ _sum: { monto: 50000 } })
      .mockResolvedValueOnce({ _sum: { monto: 0 } })
      .mockResolvedValueOnce({ _sum: { monto: 25000 } })
      .mockResolvedValueOnce({ _sum: { monto: 0 } });
    prisma.caja.aggregate
      .mockResolvedValueOnce({ _sum: { saldoActual: 500000 } }); // saldo total cajas
    prisma.caja.count
      .mockResolvedValueOnce(5) // total rutas
      .mockResolvedValueOnce(3) // rutas abiertas
      .mockResolvedValueOnce(2) // rutas pendientes consolidación
      .mockResolvedValueOnce(1) // consolidaciones hoy
      .mockResolvedValueOnce(4); // cajas abiertas
    prisma.prestamo.aggregate
      .mockResolvedValueOnce({ _sum: { saldoPendiente: 650000 } }) // cartera activa real
      .mockResolvedValue({ _sum: { saldoPendiente: 0 } }); // provisiones

    const result = (await makeService(prisma).getResumenFinanciero(
      '2026-05-08',
      '2026-05-08',
    )) as any;

    expect(result.cuotaInicialHoy).toBe(50000);
    expect(result.porcentajeCuotaInicialVsAyer).toBe(100);
    expect(result.ingresosHoy).toBe(0);
  });

  it('resta reversos de cuota inicial al archivar créditos de artículo', async () => {
    const prisma = buildPrismaMock();
    prisma.journalLine.aggregate
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { creditAmount: 0, debitAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } });
    prisma.transaccion.aggregate
      .mockResolvedValueOnce({ _sum: { monto: 500000 } })
      .mockResolvedValueOnce({ _sum: { monto: 500000 } })
      .mockResolvedValueOnce({ _sum: { monto: 0 } })
      .mockResolvedValueOnce({ _sum: { monto: 0 } });
    prisma.caja.aggregate
      .mockResolvedValueOnce({ _sum: { saldoActual: 500000 } }); // saldo total cajas
    prisma.caja.count
      .mockResolvedValueOnce(5) // total rutas
      .mockResolvedValueOnce(3) // rutas abiertas
      .mockResolvedValueOnce(2) // rutas pendientes consolidación
      .mockResolvedValueOnce(1) // consolidaciones hoy
      .mockResolvedValueOnce(4); // cajas abiertas
    prisma.prestamo.aggregate
      .mockResolvedValueOnce({ _sum: { saldoPendiente: 650000 } }) // cartera activa real
      .mockResolvedValue({ _sum: { saldoPendiente: 0 } }); // provisiones

    const result = (await makeService(prisma).getResumenFinanciero(
      '2026-05-09',
      '2026-05-09',
    )) as any;

    expect(result.cuotaInicialHoy).toBe(0);
  });

  it('neta margen de artículos cuando hay reverso por archivo en el mismo periodo', async () => {
    const prisma = buildPrismaMock();
    prisma.journalLine.aggregate
      .mockResolvedValueOnce({ _sum: { debitAmount: 500000 } })
      .mockResolvedValueOnce({
        _sum: { creditAmount: 8000000, debitAmount: 0 },
      })
      .mockResolvedValueOnce({ _sum: { creditAmount: 0, debitAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { creditAmount: 0, debitAmount: 0 } })
      .mockResolvedValueOnce({
        _sum: { creditAmount: 8000000, debitAmount: 0 },
      })
      .mockResolvedValueOnce({
        _sum: { creditAmount: 2200000, debitAmount: 2200000 },
      })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
      .mockResolvedValueOnce({
        _sum: { debitAmount: 1800000, creditAmount: 1800000 },
      })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { creditAmount: 0, debitAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } });
    prisma.transaccion.aggregate
      .mockResolvedValueOnce({ _sum: { monto: 500000 } })
      .mockResolvedValueOnce({ _sum: { monto: 500000 } })
      .mockResolvedValueOnce({ _sum: { monto: 0 } })
      .mockResolvedValueOnce({ _sum: { monto: 0 } });
    prisma.caja.aggregate
      .mockResolvedValueOnce({ _sum: { saldoActual: 500000 } }); // saldo total cajas
    prisma.caja.count
      .mockResolvedValueOnce(5) // total rutas
      .mockResolvedValueOnce(3) // rutas abiertas
      .mockResolvedValueOnce(2) // rutas pendientes consolidación
      .mockResolvedValueOnce(1) // consolidaciones hoy
      .mockResolvedValueOnce(4); // cajas abiertas
    prisma.prestamo.aggregate
      .mockResolvedValueOnce({ _sum: { saldoPendiente: 650000 } }) // cartera activa real
      .mockResolvedValue({ _sum: { saldoPendiente: 0 } }); // provisiones

    const result = (await makeService(prisma).getResumenFinanciero(
      '2026-05-09',
      '2026-05-09',
    )) as any;

    expect(result.ingresosArticulosHoy).toBe(0);
    expect(result.costosVentasHoy).toBe(0);
    expect(result.margenArticulosHoy).toBe(0);
    expect(result.otrosIngresosHoy).toBe(8000000);
    expect(result.ingresosDevengadosHoy).toBe(0);
    expect(result.utilidadOperativa).toBe(0);
  });

  it('rechaza la edición directa de saldoActual en una caja', async () => {
    const prisma = buildPrismaMock();

    await expect(
      makeService(prisma).updateCaja('caja-ruta-1', { saldoActual: 100000 }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.caja.findUnique).toHaveBeenCalledWith({
      where: { id: 'caja-ruta-1' },
    });
  });

  it('clasifica egresos de deuda de cobrador como cuenta por cobrar y no como gasto', async () => {
    const prisma = buildPrismaMock();
    const service = makeService(prisma);
    (service as any).getSaldoDisponibleRuta = jest.fn().mockResolvedValue({
      saldoDisponible: 100000,
      recaudoDelDia: 100000,
      gastosDelDia: 0,
    });

    await service.createTransaccion({
      cajaId: 'caja-ruta-1',
      tipo: TipoTransaccion.EGRESO,
      monto: 25000,
      descripcion: 'Faltante temporal cobrador',
      creadoPorId: 'admin-1',
    });

    expect(mockLedger.registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'EGRESO',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '1.4.1',
            debitAmount: 25000,
          }),
          expect.objectContaining({
            accountCode: '1.2.1',
            creditAmount: 25000,
            cajaId: 'caja-ruta-1',
            cajaDelta: -25000,
          }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('usa un tipo de referencia valido en ledger cuando el movimiento trae una categoria libre', async () => {
    const prisma = buildPrismaMock();

    await makeService(prisma).createTransaccion({
      cajaId: 'caja-ruta-1',
      tipo: TipoTransaccion.INGRESO,
      monto: 30000,
      descripcion: 'Ingreso manual por ajuste',
      creadoPorId: 'admin-1',
      tipoReferencia: 'categoria-combustible',
    });

    expect(mockLedger.registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'INGRESO',
        referenceId: 'trx-1',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '3.3',
            creditAmount: 30000,
          }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('deja un gasto operativo sin comprobante en aprobación pendiente sin crear ledger ni transacción', async () => {
    const prisma = buildPrismaMock();

    const result = await makeService(prisma).registrarGasto({
      descripcion: 'Gasolina',
      monto: 25000,
      rutaId: 'ruta-1',
      cobradorId: 'cobrador-1',
      solicitadoPorId: 'cobrador-1',
      tipoAprobacion: TipoAprobacion.GASTO,
      esPersonal: false,
    });

    expect(prisma.aprobacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: EstadoAprobacion.PENDIENTE,
          montoSolicitud: 25000,
        }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockLedger.registrarAsiento).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, approvalId: 'approval-1' });
  });

  it('guarda solicitudes de gasto con el cobrador real de la ruta aunque el body traiga otro usuario', async () => {
    const prisma = buildPrismaMock();

    await makeService(prisma).registrarGasto({
      descripcion: 'Gasolina',
      monto: 25000,
      rutaId: 'ruta-1',
      cobradorId: 'admin-1',
      solicitadoPorId: 'admin-1',
      tipoAprobacion: TipoAprobacion.GASTO,
      esPersonal: false,
    });

    expect(prisma.aprobacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          datosSolicitud: expect.objectContaining({
            rutaId: 'ruta-1',
            cobradorId: 'cobrador-1',
            cajaId: 'caja-ruta-1',
          }),
        }),
      }),
    );
    expect(mockNotifications.notifyApprovers).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          cobradorId: 'cobrador-1',
        }),
      }),
    );
  });

  it('guarda solicitudes de base con el cobrador real de la ruta aunque el body traiga otro usuario', async () => {
    const prisma = buildPrismaMock();

    await makeService(prisma).solicitarBase({
      descripcion: 'Base inicial',
      monto: 50000,
      rutaId: 'ruta-1',
      cobradorId: 'admin-1',
      solicitadoPorId: 'admin-1',
    });

    expect(prisma.aprobacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          datosSolicitud: expect.objectContaining({
            rutaId: 'ruta-1',
            cobradorId: 'cobrador-1',
            cajaId: 'caja-ruta-1',
          }),
        }),
      }),
    );
    expect(mockNotifications.notifyApprovers).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          cobradorId: 'cobrador-1',
        }),
      }),
    );
  });

  it('retorna la aprobación existente al reintentar un gasto offline con la misma idempotencyKey', async () => {
    const prisma = buildPrismaMock();
    prisma.aprobacion.findFirst.mockResolvedValue({
      id: 'approval-existente-1',
      estado: EstadoAprobacion.PENDIENTE,
    });

    const result = await makeService(prisma).registrarGasto({
      descripcion: 'Gasolina',
      monto: 25000,
      rutaId: 'ruta-1',
      cobradorId: 'cobrador-1',
      solicitadoPorId: 'cobrador-1',
      tipoAprobacion: TipoAprobacion.GASTO,
      esPersonal: false,
      idempotencyKey: 'offline-gasto-1',
    } as any);

    expect(result).toMatchObject({
      success: true,
      approvalId: 'approval-existente-1',
      idempotentReplay: true,
    });
    expect(prisma.aprobacion.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('retorna la transacción existente al reintentar un movimiento con la misma idempotencyKey', async () => {
    const prisma = buildPrismaMock();
    prisma.transaccion.findFirst.mockResolvedValue({
      id: 'trx-existente-1',
      idempotencyKey: 'offline-trx-1',
    });

    const result = await makeService(prisma).createTransaccion({
      cajaId: 'caja-ruta-1',
      tipo: TipoTransaccion.INGRESO,
      monto: 30000,
      descripcion: 'Ingreso manual',
      creadoPorId: 'admin-1',
      idempotencyKey: 'offline-trx-1',
    } as any);

    expect(result).toMatchObject({
      id: 'trx-existente-1',
      idempotentReplay: true,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('genera números de transacción sin depender de count + 1', async () => {
    const prisma = buildPrismaMock();

    await makeService(prisma).createTransaccion({
      cajaId: 'caja-ruta-1',
      tipo: TipoTransaccion.INGRESO,
      monto: 30000,
      descripcion: 'Ingreso manual',
      creadoPorId: 'admin-1',
    } as any);

    expect(prisma.transaccion.count).not.toHaveBeenCalled();
    expect(prisma._tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          numeroTransaccion: expect.stringMatching(/^TRX-\d+-[0-9a-f]{8}$/),
        }),
      }),
    );
  });

  it('bloquea el arqueo cuando hay cola offline pendiente anterior o igual al cierre', async () => {
    const prisma = buildPrismaMock({
      colaSincronizacion: { count: jest.fn().mockResolvedValue(1) },
      syncConflict: { count: jest.fn().mockResolvedValue(0) },
    });

    await expect(
      makeService(prisma).registrarArqueo(
        'caja-ruta-1',
        { efectivoReal: 100000, saldoSistema: 100000, diferencia: 0 },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('en arqueo con sobrante devuelve candidatos morosos recientes de la ruta sin bloquear', async () => {
    const prisma = buildPrismaMock();
    prisma.cuota.findMany.mockResolvedValue([
      {
        id: 'cuota-1',
        numeroCuota: 3,
        fechaVencimiento: new Date('2026-05-08T12:00:00-05:00'),
        monto: 10000,
        montoPagado: 0,
        prestamo: {
          id: 'prestamo-1',
          numeroPrestamo: 'PRES-1',
          cliente: { id: 'cliente-1', nombres: 'Ana', apellidos: 'Rojas' },
          pagos: [],
        },
      },
    ]);

    const result = await makeService(prisma).registrarArqueo(
      'caja-ruta-1',
      { efectivoReal: 110000, saldoSistema: 100000, diferencia: 10000 },
      'admin-1',
    );

    expect(result.alertaSobrante.candidatos).toHaveLength(1);
    expect(result.alertaSobrante.candidatos[0]).toMatchObject({
      clienteId: 'cliente-1',
      cliente: 'Ana Rojas',
      prestamoId: 'prestamo-1',
    });
  });

  it('prepara migración histórica en dry-run usando fecha de corte e idempotencia', async () => {
    const cutoff = new Date('2026-05-01T00:00:00.000Z');
    const prisma = buildPrismaMock({
      journalEntry: {
        findFirst: jest.fn().mockResolvedValue({ createdAt: cutoff }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { referenceType: 'PAGO', referenceId: 'pago-existente' },
          ]),
      },
      transaccion: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'trx-1',
            tipoReferencia: 'PAGO',
            referenciaId: 'pago-existente',
            monto: 10000,
            tipo: 'INGRESO',
            cajaId: 'caja-ruta-1',
          },
          {
            id: 'trx-2',
            tipoReferencia: 'GASTO',
            referenciaId: 'gasto-1',
            monto: 5000,
            tipo: 'EGRESO',
            cajaId: 'caja-ruta-1',
          },
        ]),
      },
    });

    const result = await (makeService(prisma) as any).migrarHistoricoLedger({
      dryRun: true,
      userId: 'admin-1',
    });

    expect((prisma.transaccion as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaTransaccion: { lt: cutoff },
        }),
      }),
    );
    expect(result.dryRun).toBe(true);
    expect(result.fechaCorte).toBe(cutoff.toISOString());
    expect(result.candidatos).toHaveLength(1);
    expect(result.omitidosPorAsientoExistente).toBe(1);
  });

  it('bloquea la reparación de caja oficina cuando ya existe libro mayor y no es dry-run', async () => {
    const prisma = buildPrismaMock({
      journalEntry: {
        ...buildPrismaMock().journalEntry,
        count: jest.fn().mockResolvedValue(1),
      },
    });

    await expect(
      makeService(prisma).repararCajaOficinaIngresosMalAsignados({
        dryRun: false,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.caja.findFirst).not.toHaveBeenCalled();
  });

  it('lista movimientos ledger agrupados con totales débito y crédito', async () => {
    const prisma = buildPrismaMock({
      journalEntry: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'journal-1',
            referenceType: 'PAGO',
            referenceId: 'pago-1',
            description: 'Pago recibido',
            createdAt: new Date('2026-05-08T12:00:00.000Z'),
            createdBy: 'user-1',
            lines: [
              {
                debitAmount: 10000,
                creditAmount: null,
                accountCode: '1.2.1',
                cajaId: 'caja-1',
                account: { name: 'Caja Ruta' },
              },
              {
                debitAmount: null,
                creditAmount: 10000,
                accountCode: '3.1',
                cajaId: null,
                account: { name: 'Intereses' },
              },
            ],
          },
        ]),
      },
    });

    const result = await makeService(prisma).getMovimientosLedger({
      page: 1,
      limit: 10,
      cajaId: 'caja-1',
    } as any);

    expect((prisma as any).journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lines: { some: { cajaId: 'caja-1' } },
        }),
      }),
    );

    expect(result.data[0]).toMatchObject({
      id: 'journal-1',
      tipo: 'PAGO',
      totalDebito: 10000,
      totalCredito: 10000,
      cuadrado: true,
    });
    expect(result.paginacion.total).toBe(1);
  });

  it('expone metadata de pago regularizado en movimientos ledger', async () => {
    const prisma = buildPrismaMock({
      journalEntry: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'journal-regularizado-1',
            referenceType: 'PAGO',
            referenceId: 'pago-regularizado-1',
            description: 'Pago recibido',
            createdAt: new Date('2026-06-11T07:54:00.000Z'),
            createdBy: 'user-1',
            lines: [
              {
                debitAmount: 43333,
                creditAmount: null,
                accountCode: '1.2.1',
                cajaId: 'caja-1',
                account: { name: 'Caja Ruta' },
              },
              {
                debitAmount: null,
                creditAmount: 43333,
                accountCode: '1.3.1',
                cajaId: null,
                account: { name: 'Cartera' },
              },
            ],
          },
        ]),
      },
      pago: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pago-regularizado-1',
            origenGestion: 'CIERRE_PENDIENTE',
            fechaOperativaRuta: '2026-06-10',
          },
        ]),
      },
    });

    const result = await makeService(prisma).getMovimientosLedger({
      page: 1,
      limit: 10,
      cajaId: 'caja-1',
    } as any);

    expect((prisma as any).pago.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['pago-regularizado-1'] },
        origenGestion: 'CIERRE_PENDIENTE',
      },
      select: {
        id: true,
        origenGestion: true,
        fechaOperativaRuta: true,
      },
    });
    expect(result.data[0]).toMatchObject({
      origenGestion: 'CIERRE_PENDIENTE',
      fechaOperativaRuta: '2026-06-10',
    });
  });

  it('exporta el reporte contable desde JournalEntry en lugar de Transaccion', async () => {
    const prisma = buildPrismaMock({
      caja: {
        ...buildPrismaMock().caja,
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'caja-1',
            nombre: 'Caja Ruta',
            codigo: 'CAJA-RUTA',
            tipo: 'RUTA',
            saldoActual: 10000,
            responsable: { nombres: 'Cobra', apellidos: 'Dor' },
            ruta: { nombre: 'Ruta 1' },
          },
        ]),
      },
      journalEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'journal-1',
            referenceType: 'PAGO',
            referenceId: 'pago-1',
            description: 'Pago recibido',
            createdAt: new Date('2026-05-08T12:00:00.000Z'),
            createdBy: 'user-1',
            lines: [
              {
                cajaId: 'caja-1',
                accountCode: '1.2.1',
                debitAmount: 10000,
                creditAmount: null,
                account: { name: 'Caja Ruta' },
              },
              {
                cajaId: null,
                accountCode: '3.1',
                debitAmount: null,
                creditAmount: 10000,
                account: { name: 'Intereses' },
              },
            ],
          },
        ]),
      },
      transaccion: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'trx-zero', tipoReferencia: 'ARQUEO' }),
      },
      usuario: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ nombres: 'Cobra', apellidos: 'Dor' }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'user-1', nombres: 'Admin', apellidos: 'Uno' },
          ]),
      },
    });

    await makeService(prisma).exportAccountingReport('excel');

    expect(prisma.journalEntry.findMany).toHaveBeenCalled();
    expect(prisma.transaccion.findMany).not.toHaveBeenCalled();
  });

  it('calcula deudas de cobrador desde la cuenta ledger 1.4.x', async () => {
    const prisma = buildPrismaMock({
      journalLine: {
        aggregate: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'line-1',
            debitAmount: 30000,
            creditAmount: null,
            accountCode: '1.4.1',
            journalEntry: {
              id: 'journal-arqueo',
              referenceType: 'ARQUEO',
              referenceId: 'trx-arqueo',
              createdAt: new Date('2026-05-08T12:00:00.000Z'),
              description: 'Faltante arqueo',
            },
          },
          {
            id: 'line-2',
            debitAmount: null,
            creditAmount: 10000,
            accountCode: '1.4.1',
            journalEntry: {
              id: 'journal-abono',
              referenceType: 'ABONO_DEUDA',
              referenceId: 'cobrador-1',
              createdAt: new Date('2026-05-08T13:00:00.000Z'),
              description: 'Abono deuda',
            },
          },
        ]),
      },
      transaccion: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'trx-arqueo',
            cajaId: 'caja-ruta-1',
            caja: { ruta: { cobradorId: 'cobrador-1' } },
          },
        ]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'trx-zero', tipoReferencia: 'ARQUEO' }),
      },
      usuario: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ nombres: 'Cobra', apellidos: 'Dor' }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cobrador-1',
            nombres: 'Cobra',
            apellidos: 'Dor',
            rol: 'COBRADOR',
          },
        ]),
      },
    });

    const result = await makeService(prisma).getDeudoresCobrador();

    expect(prisma.journalLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountCode: { startsWith: '1.4' } },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cobradorId: 'cobrador-1',
      totalDeuda: 20000,
      descuadres: 20000,
    });
  });

  it('usa el saldo actual de la caja activa sin duplicar deudas de cierres previos', async () => {
    const prisma = buildPrismaMock({
      journalLine: {
        aggregate: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      caja: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { saldoActual: 500000 } }),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'caja-ruta-1',
            saldoActual: 700000,
            ruta: { cobradorId: 'cobrador-1' },
          },
        ]),
      },
      transaccion: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'deuda-cierre-anterior',
            cajaId: 'caja-ruta-1',
            monto: 500000,
            descripcion: 'Deuda del cobrador por cierre de ruta',
            tipoReferencia: 'DEUDA_COBRADOR',
            referenciaId:
              'DD:500000|SD:500000|FD:0|RC:0|MT:0|EF:0|CF:0|CO:Cobrador|SD:500000',
            fechaTransaccion: new Date('2026-06-05T12:00:00.000Z'),
            tipo: 'EGRESO',
            caja: { ruta: { cobradorId: 'cobrador-1' } },
          },
        ]),
      },
      usuario: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cobrador-1',
            nombres: 'Cobra',
            apellidos: 'Dor',
            rol: 'COBRADOR',
          },
        ]),
      },
    });

    const result = await makeService(prisma).getDeudoresCobrador();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cobradorId: 'cobrador-1',
      totalDeuda: 700000,
      descuadres: 700000,
    });
  });
});
