import { LedgerService } from './ledger.service';

/**
 * El peso colombiano no tiene centavos.
 *
 * El motor contable validaba que débitos = créditos, pero no que los montos
 * fueran enteros. Una simulación contra la base real metió un asiento de
 * $100,55 sin que nada protestara, y los residuos se fueron acumulando: 34
 * centavos que entraron por ahí dejaron la cuenta de cartera descuadrada
 * frente al capital pendiente de los préstamos. Ninguna otra comprobación lo
 * veía, porque el asiento cuadraba consigo mismo.
 */

function servicio() {
  const tx = {
    journalEntry: {
      create: jest.fn().mockResolvedValue({ id: 'journal-1', lines: [] }),
    },
    caja: {
      findUnique: jest.fn().mockResolvedValue({ id: 'caja-1', saldoActual: 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    _tx: tx,
  };
  return { service: new LedgerService(prisma as any), prisma };
}

const asiento = (debito: number, credito: number) => ({
  referenceType: 'AJUSTE' as any,
  referenceId: 'ref-1',
  description: 'Prueba',
  createdBy: 'admin-1',
  lines: [
    { accountCode: '1.1.1', debitAmount: debito },
    { accountCode: '3.3', creditAmount: credito },
  ],
});

describe('El libro no admite centavos', () => {
  it('rechaza un asiento con decimales y dice cuál es el monto', async () => {
    const { service, prisma } = servicio();

    await expect(
      service.registrarAsiento(asiento(100.55, 100.55) as any),
    ).rejects.toThrow(/100\.55 tiene centavos/);

    // Y no alcanza a escribir nada.
    expect(prisma._tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('rechaza aunque los centavos estén solo en una línea', async () => {
    const { service } = servicio();

    // Estas dos cuadran entre sí, así que la validación de balance las deja
    // pasar: el descuadre que causan aparece más tarde y en otra parte.
    await expect(
      service.registrarAsiento({
        referenceType: 'AJUSTE' as any,
        referenceId: 'ref-2',
        description: 'Prueba',
        createdBy: 'admin-1',
        lines: [
          { accountCode: '1.1.1', debitAmount: 50.5 },
          { accountCode: '1.3.1', debitAmount: 49.5 },
          { accountCode: '3.3', creditAmount: 100 },
        ],
      } as any),
    ).rejects.toThrow(/centavos/);
  });

  it('deja pasar los pesos enteros', async () => {
    const { service, prisma } = servicio();

    await service.registrarAsiento(asiento(100, 100) as any);

    expect(prisma._tx.journalEntry.create).toHaveBeenCalled();
  });

  it('el cero de la columna que no se usa no cuenta como decimal', async () => {
    // Una línea de débito lleva `creditAmount` en cero o sin definir: si la
    // validación mirara eso como un monto, no pasaría ningún asiento.
    const { service, prisma } = servicio();

    await service.registrarAsiento({
      referenceType: 'AJUSTE' as any,
      referenceId: 'ref-3',
      description: 'Prueba',
      createdBy: 'admin-1',
      lines: [
        { accountCode: '1.1.1', debitAmount: 250000, creditAmount: 0 },
        { accountCode: '3.3', creditAmount: 250000 },
      ],
    } as any);

    expect(prisma._tx.journalEntry.create).toHaveBeenCalled();
  });
});
