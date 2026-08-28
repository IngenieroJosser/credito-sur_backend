import { LedgerService } from './ledger.service';

function makeService() {
  const tx = {
    journalEntry: {
      create: jest.fn().mockResolvedValue({ id: 'journal-1', lines: [] }),
    },
    caja: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'caja-ruta-1',
        saldoActual: 100000,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    // El saldo se lee con `SELECT ... FOR UPDATE` para que dos egresos
    // simultáneos no lean la misma foto vieja y pasen los dos.
    $queryRaw: jest.fn().mockResolvedValue([{ saldoActual: 100000 }]),
  };

  const prisma = {
    $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    _tx: tx,
  };

  return { service: new LedgerService(prisma as any), prisma };
}

describe('LedgerService article sales', () => {
  it('registra venta de artículo separando cartera, ingreso, costo e inventario', async () => {
    const { service, prisma } = makeService();

    await service.registrarVentaArticulo({
      prestamoId: 'prestamo-art-1',
      precioVenta: 100000,
      costoArticulo: 65000,
      montoFinanciado: 80000,
      cuotaInicial: 20000,
      cajaId: 'caja-oficina',
      accountCodeCaja: '1.1.1',
      createdBy: 'admin-1',
    });

    expect(prisma._tx.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenceType: 'VENTA_ARTICULO',
          referenceId: 'prestamo-art-1',
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({
                accountCode: '1.1.1',
                debitAmount: 20000,
                cajaId: 'caja-oficina',
              }),
              expect.objectContaining({
                accountCode: '1.3.1',
                debitAmount: 80000,
              }),
              expect.objectContaining({
                accountCode: '3.4',
                creditAmount: 100000,
              }),
              expect.objectContaining({
                accountCode: '5.1',
                debitAmount: 65000,
              }),
              expect.objectContaining({
                accountCode: '1.5',
                creditAmount: 65000,
              }),
            ]),
          },
        }),
      }),
    );

    expect(prisma._tx.caja.update).toHaveBeenCalledWith({
      where: { id: 'caja-oficina' },
      data: { saldoActual: { increment: 20000 } },
    });
  });
});

describe('LedgerService payments', () => {
  it('registra pagos sin línea de cartera cuando el abono no amortiza capital', async () => {
    const { service, prisma } = makeService();

    await service.registrarPago({
      pagoId: 'pago-solo-interes',
      cajaRutaId: 'caja-ruta',
      montoCapital: 0,
      montoInteres: 1000,
      montoMora: 0,
      metodoPago: 'EFECTIVO',
      createdBy: 'cobrador-1',
    });

    const createCall = prisma._tx.journalEntry.create.mock.calls[0][0];
    const lines = createCall.data.lines.create;

    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: '1.2.1.E',
          debitAmount: 1000,
          cajaId: 'caja-ruta',
        }),
        expect.objectContaining({
          accountCode: '3.1',
          creditAmount: 1000,
        }),
      ]),
    );
    expect(lines).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: '1.3.1',
          creditAmount: 0,
        }),
      ]),
    );
    expect(prisma._tx.caja.update).toHaveBeenCalledWith({
      where: { id: 'caja-ruta' },
      data: { saldoActual: { increment: 1000 } },
    });
  });
});

describe('LedgerService consolidacion', () => {
  it('registrarConsolidacion crea asiento balanceado', async () => {
    const { service, prisma } = makeService();

    await service.registrarConsolidacion({
      referenceId: 'RECOL-001',
      monto: 50000,
      cajaOrigenId: 'caja-ruta-1',
      cajaDestinoId: 'caja-oficina',
      accountCodeDestino: '1.1.1',
      createdBy: 'admin-1',
    });

    const createCall = prisma._tx.journalEntry.create.mock.calls[0][0];
    const lines = createCall.data.lines.create;

    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: '1.1.1',
          debitAmount: 50000,
          cajaId: 'caja-oficina',
        }),
        expect.objectContaining({
          accountCode: '1.2.1',
          creditAmount: 50000,
          cajaId: 'caja-ruta-1',
        }),
      ]),
    );
  });

  it('registrarConsolidacion debita caja destino y acredita caja origen', async () => {
    const { service, prisma } = makeService();

    await service.registrarConsolidacion({
      referenceId: 'RECOL-001',
      monto: 50000,
      cajaOrigenId: 'caja-ruta-1',
      cajaDestinoId: 'caja-oficina',
      accountCodeDestino: '1.1.1',
      createdBy: 'admin-1',
    });

    const createCall = prisma._tx.journalEntry.create.mock.calls[0][0];
    const lines = createCall.data.lines.create;

    const destinoLine = lines.find((l: any) => l.accountCode === '1.1.1');
    const origenLine = lines.find((l: any) => l.accountCode === '1.2.1');

    expect(destinoLine.debitAmount).toBe(50000);
    expect(destinoLine.cajaId).toBe('caja-oficina');
    expect(origenLine.creditAmount).toBe(50000);
    expect(origenLine.cajaId).toBe('caja-ruta-1');
  });

  it('registrarConsolidacion incrementa saldo de caja destino', async () => {
    const { service, prisma } = makeService();

    await service.registrarConsolidacion({
      referenceId: 'RECOL-001',
      monto: 50000,
      cajaOrigenId: 'caja-ruta-1',
      cajaDestinoId: 'caja-oficina',
      accountCodeDestino: '1.1.1',
      createdBy: 'admin-1',
    });

    expect(prisma._tx.caja.update).toHaveBeenCalledWith({
      where: { id: 'caja-oficina' },
      data: { saldoActual: { increment: 50000 } },
    });
  });

  it('registrarConsolidacion descuenta saldo de caja origen', async () => {
    const { service, prisma } = makeService();

    await service.registrarConsolidacion({
      referenceId: 'RECOL-001',
      monto: 50000,
      cajaOrigenId: 'caja-ruta-1',
      cajaDestinoId: 'caja-oficina',
      accountCodeDestino: '1.1.1',
      createdBy: 'admin-1',
    });

    expect(prisma._tx.caja.update).toHaveBeenCalledWith({
      where: { id: 'caja-ruta-1' },
      data: { saldoActual: { increment: -50000 } },
    });
  });

  it('registrarConsolidacion usa accountCodeDestino 1.1.2 para CAJA-BANCO', async () => {
    const { service, prisma } = makeService();

    await service.registrarConsolidacion({
      referenceId: 'RECOL-001',
      monto: 50000,
      cajaOrigenId: 'caja-ruta-1',
      cajaDestinoId: 'caja-banco',
      accountCodeDestino: '1.1.2',
      createdBy: 'admin-1',
    });

    const createCall = prisma._tx.journalEntry.create.mock.calls[0][0];
    const lines = createCall.data.lines.create;

    const destinoLine = lines.find((l: any) => l.accountCode === '1.1.2');

    expect(destinoLine).toBeDefined();
    expect(destinoLine.debitAmount).toBe(50000);
    expect(destinoLine.cajaId).toBe('caja-banco');
  });

  it('registrarConsolidacion lanza error si caja origen queda negativa', async () => {
    const { service, prisma } = makeService();

    // El saldo se lee con la fila bloqueada, no con `findUnique`.
    prisma._tx.$queryRaw.mockResolvedValueOnce([{ saldoActual: 40000 }]);

    await expect(
      service.registrarConsolidacion({
        referenceId: 'RECOL-001',
        monto: 50000,
        cajaOrigenId: 'caja-ruta-1',
        cajaDestinoId: 'caja-oficina',
        accountCodeDestino: '1.1.1',
        createdBy: 'admin-1',
      }),
    ).rejects.toThrow();
  });
});

describe('El asiento de venta de artículo tiene que cuadrar', () => {
  it('rechaza el asiento si el precio no es lo financiado más la inicial', async () => {
    const { service } = makeService();

    // Este era el caso real: al escribir un monto a mano en la hoja de
    // artículo, el asiento acreditaba el precio del catálogo mientras la
    // cartera cargaba el monto escrito. La partida doble no cerraba.
    await expect(
      service.registrarVentaArticulo({
        prestamoId: 'prestamo-art-2',
        precioVenta: 980000, // precio de lista
        costoArticulo: 620000,
        montoFinanciado: 700000, // lo que de verdad se financió
        cuotaInicial: 150000, // 700.000 + 150.000 = 850.000, no 980.000
        cajaId: 'caja-oficina',
        accountCodeCaja: '1.1.1',
        createdBy: 'admin-1',
      }),
    ).rejects.toThrow('Desbalance contable');
  });

  it('acepta el asiento cuando el precio es el que el cliente paga de verdad', async () => {
    const { service, prisma } = makeService();

    await service.registrarVentaArticulo({
      prestamoId: 'prestamo-art-3',
      precioVenta: 850000, // 700.000 financiados + 150.000 de inicial
      costoArticulo: 620000,
      montoFinanciado: 700000,
      cuotaInicial: 150000,
      cajaId: 'caja-oficina',
      accountCodeCaja: '1.1.1',
      createdBy: 'admin-1',
    });

    const [[argumento]] = (prisma._tx.journalEntry.create as jest.Mock).mock
      .calls;
    const lineas = argumento.data.lines.create as Array<{
      debitAmount?: number;
      creditAmount?: number;
    }>;
    const debitos = lineas.reduce((a, l) => a + Number(l.debitAmount || 0), 0);
    const creditos = lineas.reduce(
      (a, l) => a + Number(l.creditAmount || 0),
      0,
    );

    expect(debitos).toBe(creditos);
    // 150.000 de caja + 700.000 de cartera + 620.000 de costo
    expect(debitos).toBe(1_470_000);
  });
});
