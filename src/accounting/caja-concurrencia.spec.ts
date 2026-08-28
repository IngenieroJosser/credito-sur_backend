import { LedgerService } from './ledger.service';

/**
 * Dos personas moviendo la misma caja al mismo tiempo.
 *
 * La comprobación de saldo era leer-y-después-escribir: se leía el saldo, se
 * concluía que alcanzaba, y se escribía. Cinco egresos simultáneos leían todos
 * la misma foto, todos concluían que alcanzaba, y los cinco se guardaban.
 * Medido contra la base real: cinco retiros de $14.804.944 contra una caja de
 * $44.414.832 pasaron los cinco y la dejaron en -$29.609.888. No hace falta un
 * caso raro para provocarlo: basta un día con dos personas en la misma caja.
 *
 * La lectura va ahora con la fila bloqueada, así que la segunda transacción
 * espera y vuelve a leer el saldo ya descontado.
 */

function servicio(saldos: number[]) {
  let i = 0;
  const $queryRaw = jest.fn().mockImplementation(() => {
    const saldo = saldos[Math.min(i++, saldos.length - 1)];
    return Promise.resolve([{ saldoActual: saldo }]);
  });

  const tx = {
    journalEntry: {
      create: jest.fn().mockResolvedValue({ id: 'j-1', lines: [] }),
    },
    caja: {
      findUnique: jest.fn().mockResolvedValue({ saldoActual: 999999999 }),
      update: jest.fn().mockResolvedValue({}),
    },
    $queryRaw,
  };

  const prisma = {
    $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    _tx: tx,
  };

  return { service: new LedgerService(prisma as any), tx, $queryRaw };
}

const sqlDe = (llamada: any[]) => {
  const partes = llamada[0];
  return Array.isArray(partes) ? partes.join(' ') : String(partes);
};

const egreso = (cajaId: string, monto: number) => ({
  referenceType: 'EGRESO' as any,
  referenceId: 'ref-1',
  description: 'Retiro',
  createdBy: 'admin-1',
  lines: [
    { accountCode: '4.2', debitAmount: monto },
    {
      accountCode: '1.1.1',
      creditAmount: monto,
      cajaId,
      cajaDelta: -monto,
    },
  ],
});

describe('El saldo de una caja se lee con la fila bloqueada', () => {
  it('lee el saldo bloqueando la fila, no con una consulta suelta', async () => {
    const { service, tx, $queryRaw } = servicio([500000]);

    await service.registrarAsiento(egreso('caja-1', 100000) as any);

    expect($queryRaw).toHaveBeenCalled();
    expect(sqlDe($queryRaw.mock.calls[0])).toMatch(/FOR NO KEY UPDATE/);
    // Un `findUnique` sin bloqueo es justo lo que dejaba pasar los cinco.
    expect(tx.caja.findUnique).not.toHaveBeenCalled();
  });

  it('el bloqueo no es FOR UPDATE, que se traba con la llave foránea', async () => {
    // `FOR UPDATE` choca con el `KEY SHARE` que Postgres toma sobre la caja al
    // insertar la línea que la referencia: seis egresos simultáneos terminaron
    // los seis en deadlock y no pasó ninguno. Seguro, pero inservible.
    const { service, $queryRaw } = servicio([500000]);

    await service.registrarAsiento(egreso('caja-1', 100000) as any);

    expect(sqlDe($queryRaw.mock.calls[0])).not.toMatch(/FOR UPDATE/);
  });

  it('rechaza cuando el saldo ya descontado no alcanza', async () => {
    // El segundo egreso lee 20.000: lo que dejó el primero, no la foto inicial.
    const { service } = servicio([20000]);

    await expect(
      service.registrarAsiento(egreso('caja-1', 100000) as any),
    ).rejects.toThrow(/Saldo insuficiente/);
  });

  it('un ingreso no necesita bloquear: sumar no puede dejar la caja negativa', async () => {
    const { service, $queryRaw } = servicio([0]);

    await service.registrarAsiento({
      referenceType: 'INGRESO' as any,
      referenceId: 'ref-2',
      description: 'Aporte',
      createdBy: 'admin-1',
      lines: [
        {
          accountCode: '1.1.1',
          debitAmount: 100000,
          cajaId: 'caja-1',
          cajaDelta: 100000,
        },
        { accountCode: '3.3', creditAmount: 100000 },
      ],
    } as any);

    expect($queryRaw).not.toHaveBeenCalled();
  });
});

describe('Los movimientos de caja de un asiento se suman y se ordenan', () => {
  it('dos líneas sobre la misma caja se validan por el neto', async () => {
    // Por separado, la salida de 100.000 rebotaría contra un saldo de 50.000
    // aunque el asiento completo deje la caja en 30.000.
    const { service, tx } = servicio([50000]);

    await service.registrarAsiento({
      referenceType: 'AJUSTE' as any,
      referenceId: 'ref-3',
      description: 'Sale y entra',
      createdBy: 'admin-1',
      lines: [
        {
          accountCode: '1.1.1',
          creditAmount: 100000,
          cajaId: 'caja-1',
          cajaDelta: -100000,
        },
        {
          accountCode: '1.1.1',
          debitAmount: 80000,
          cajaId: 'caja-1',
          cajaDelta: 80000,
        },
        { accountCode: '3.3', creditAmount: 80000 },
        { accountCode: '4.2', debitAmount: 100000 },
      ],
    } as any);

    // Una sola actualización, por el neto de -20.000.
    expect(tx.caja.update).toHaveBeenCalledTimes(1);
    expect(tx.caja.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { saldoActual: { increment: -20000 } },
      }),
    );
  });

  it('las cajas se bloquean siempre en el mismo orden', async () => {
    // Dos consolidaciones en sentido contrario bloquearían las mismas dos
    // cajas al revés y se quedarían esperando la una a la otra. Con un orden
    // fijo por id, eso no puede pasar.
    const { service, tx } = servicio([900000, 900000]);

    await service.registrarAsiento({
      referenceType: 'CONSOLIDACION' as any,
      referenceId: 'ref-4',
      description: 'Traslado',
      createdBy: 'admin-1',
      lines: [
        {
          accountCode: '1.1.1',
          creditAmount: 50000,
          cajaId: 'caja-z',
          cajaDelta: -50000,
        },
        {
          accountCode: '1.2.1',
          debitAmount: 50000,
          cajaId: 'caja-a',
          cajaDelta: -50000,
        },
        { accountCode: '4.2', debitAmount: 100000 },
        { accountCode: '3.3', creditAmount: 100000 },
      ],
    } as any);

    const orden = tx.caja.update.mock.calls.map((c: any) => c[0].where.id);
    expect(orden).toEqual(['caja-a', 'caja-z']);
  });
});
