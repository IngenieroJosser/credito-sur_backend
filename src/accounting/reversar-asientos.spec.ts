import { LedgerService } from './ledger.service';

/**
 * Deshacer un asiento sin borrarlo.
 *
 * Una importación que desembolsó dinero no se podía deshacer: se rechazaba con
 * el argumento de que reversar caja no era trabajo de una importación. En la
 * práctica eso dejaba un error de carga sin vuelta atrás, y había que
 * arreglarlo a mano asiento por asiento.
 *
 * La reversa no borra: escribe otro asiento con los débitos y los créditos
 * cambiados de lado. El original queda para saber qué pasó, la reversa para
 * saber que se deshizo, y la caja vuelve sola porque cada línea lleva su
 * `cajaDelta` con el signo contrario.
 */

function servicio(originales: any[]) {
  const tx = {
    journalEntry: {
      create: jest.fn().mockResolvedValue({ id: 'reversa-1', lines: [] }),
      findMany: jest.fn().mockResolvedValue(originales),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    caja: {
      findUnique: jest.fn().mockResolvedValue({ saldoActual: 10_000_000 }),
      update: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest
      .fn()
      .mockResolvedValue([
        { saldoActual: 10_000_000, nombre: 'Caja de Oficina' },
      ]),
  };

  const prisma = {
    $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
  };

  return { service: new LedgerService(prisma as any), tx };
}

const desembolso = {
  id: 'asiento-1',
  referenceType: 'DESEMBOLSO',
  referenceId: 'prestamo-1',
  lines: [
    { accountCode: '1.3.1', debitAmount: 500000, creditAmount: null },
    {
      accountCode: '1.1.1',
      debitAmount: null,
      creditAmount: 500000,
      cajaId: 'caja-oficina',
    },
  ],
};

describe('Reversar asientos ya registrados', () => {
  it('cambia de lado los débitos y los créditos', async () => {
    const { service, tx } = servicio([desembolso]);

    await service.reversarAsientos(tx as any, {
      referenceIds: ['prestamo-1'],
      referenceTypes: ['DESEMBOLSO'],
      createdBy: 'admin-1',
      motivo: 'Importación deshecha',
    });

    const creado = tx.journalEntry.create.mock.calls[0][0];
    expect(creado.data.lines.create).toEqual(
      expect.arrayContaining([
        // La cartera se acredita: el crédito deja de existir.
        expect.objectContaining({ accountCode: '1.3.1', creditAmount: 500000 }),
        // La caja se debita: la plata vuelve.
        expect.objectContaining({ accountCode: '1.1.1', debitAmount: 500000 }),
      ]),
    );
  });

  it('devuelve a la caja lo que salió de ella', async () => {
    const { service, tx } = servicio([desembolso]);

    await service.reversarAsientos(tx as any, {
      referenceIds: ['prestamo-1'],
      referenceTypes: ['DESEMBOLSO'],
      createdBy: 'admin-1',
    });

    expect(tx.caja.update).toHaveBeenCalledWith({
      where: { id: 'caja-oficina' },
      data: { saldoActual: { increment: 500000 } },
    });
  });

  it('no borra el asiento original: escribe uno nuevo', async () => {
    const { service, tx } = servicio([desembolso]);

    await service.reversarAsientos(tx as any, {
      referenceIds: ['prestamo-1'],
      referenceTypes: ['DESEMBOLSO'],
      createdBy: 'admin-1',
    });

    const creado = tx.journalEntry.create.mock.calls[0][0];
    // La reversa se identifica por el asiento que deshace, y así se puede
    // encontrar después y no se puede escribir dos veces.
    expect(creado.data.referenceId).toBe('REVERSA:asiento-1');
    expect(creado.data.referenceType).toBe('AJUSTE');
  });

  it('llamarla dos veces no descuenta dos veces', async () => {
    const { service, tx } = servicio([desembolso]);
    tx.journalEntry.findFirst.mockResolvedValue({ id: 'reversa-ya-existe' });

    const ids = await service.reversarAsientos(tx as any, {
      referenceIds: ['prestamo-1'],
      referenceTypes: ['DESEMBOLSO'],
      createdBy: 'admin-1',
    });

    expect(tx.journalEntry.create).not.toHaveBeenCalled();
    expect(tx.caja.update).not.toHaveBeenCalled();
    expect(ids).toEqual(['reversa-ya-existe']);
  });

  it('sin asientos que deshacer no escribe nada', async () => {
    const { service, tx } = servicio([]);

    const ids = await service.reversarAsientos(tx as any, {
      referenceIds: ['prestamo-sin-asientos'],
      referenceTypes: ['DESEMBOLSO'],
      createdBy: 'admin-1',
    });

    expect(ids).toEqual([]);
    expect(tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('la reversa de una venta de artículo devuelve la cuota inicial', async () => {
    const venta = {
      id: 'asiento-art',
      referenceType: 'VENTA_ARTICULO',
      referenceId: 'prestamo-art',
      lines: [
        {
          accountCode: '1.1.1',
          debitAmount: 150000,
          creditAmount: null,
          cajaId: 'caja-oficina',
        },
        { accountCode: '1.3.1', debitAmount: 350000, creditAmount: null },
        { accountCode: '3.4', debitAmount: null, creditAmount: 500000 },
      ],
    };
    const { service, tx } = servicio([venta]);

    await service.reversarAsientos(tx as any, {
      referenceIds: ['prestamo-art'],
      referenceTypes: ['VENTA_ARTICULO'],
      createdBy: 'admin-1',
    });

    // La inicial entró a la caja, así que al deshacer sale.
    expect(tx.caja.update).toHaveBeenCalledWith({
      where: { id: 'caja-oficina' },
      data: { saldoActual: { increment: -150000 } },
    });
  });
});
