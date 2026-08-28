import { AccountingService } from './accounting.service';

/**
 * La cuenta de inventario venía en negativo: registrar mercancía no tocaba el
 * libro, pero venderla sí lo acreditaba contra el costo. Bajaba con cada venta
 * y no subía nunca. El asiento de apertura tampoco la incluyó.
 *
 * Que las entradas de mercancía ahora se asienten evita que el hueco crezca,
 * pero no cierra el que ya estaba: para eso está esta regularización, que se
 * corre una vez y reconoce la bodega que ya existía.
 */

function servicio(params: {
  productos: Array<{ codigo: string; stock: number; costo: number }>;
  debe: number;
  haber: number;
}) {
  const registrarAsiento = jest.fn().mockResolvedValue({ id: 'j-1' });

  const prisma: any = {
    producto: { findMany: jest.fn().mockResolvedValue(params.productos) },
    journalLine: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { debitAmount: params.debe, creditAmount: params.haber },
      }),
    },
  };

  const service = new AccountingService(
    prisma,
    {} as any,
    {} as any,
    { registrarAsiento } as any,
  );

  return { service, registrarAsiento };
}

describe('Regularización del inventario', () => {
  const bodega = [
    { codigo: 'A', stock: 10, costo: 480000 }, // 4.800.000
    { codigo: 'B', stock: 4, costo: 350000 }, //  1.400.000
  ];

  it('calcula el ajuste sin escribir nada', async () => {
    // El libro está en -1.000.000 y la bodega vale 6.200.000.
    const { service, registrarAsiento } = servicio({
      productos: bodega,
      debe: 0,
      haber: 1000000,
    });

    const r = await service.regularizarInventario('admin-1');

    expect(r).toMatchObject({
      valorBodega: 6200000,
      saldoLibro: -1000000,
      ajuste: 7200000,
      aplicado: false,
    });
    expect(registrarAsiento).not.toHaveBeenCalled();
  });

  it('al aplicar, debita inventario contra el capital del propietario', async () => {
    const { service, registrarAsiento } = servicio({
      productos: bodega,
      debe: 0,
      haber: 1000000,
    });

    const r = await service.regularizarInventario('admin-1', false);

    expect(r.aplicado).toBe(true);
    expect(registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'AJUSTE',
        lines: [
          { accountCode: '1.5', debitAmount: 7200000 },
          { accountCode: '2.1', creditAmount: 7200000 },
        ],
      }),
    );
  });

  it('si el libro ya cuadra con la bodega, no escribe un asiento vacío', async () => {
    const { service, registrarAsiento } = servicio({
      productos: bodega,
      debe: 6200000,
      haber: 0,
    });

    const r = await service.regularizarInventario('admin-1', false);

    expect(r).toMatchObject({ ajuste: 0, aplicado: false });
    expect(registrarAsiento).not.toHaveBeenCalled();
  });

  it('si el libro quedara por encima de la bodega, el asiento va al revés', async () => {
    const { service, registrarAsiento } = servicio({
      productos: bodega,
      debe: 9200000,
      haber: 0,
    });

    await service.regularizarInventario('admin-1', false);

    expect(registrarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          { accountCode: '1.5', creditAmount: 3000000 },
          { accountCode: '2.1', debitAmount: 3000000 },
        ],
      }),
    );
  });

  it('el valor de la bodega se redondea a pesos enteros', async () => {
    // El libro rechaza centavos, así que el ajuste no puede traerlos.
    const { service, registrarAsiento } = servicio({
      productos: [{ codigo: 'A', stock: 3, costo: 333333.33 }],
      debe: 0,
      haber: 0,
    });

    await service.regularizarInventario('admin-1', false);

    const monto = registrarAsiento.mock.calls[0][0].lines[0].debitAmount;
    expect(Number.isInteger(monto)).toBe(true);
  });
});
