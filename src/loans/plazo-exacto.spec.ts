import { LoansService } from './loans.service';

/**
 * `plazoMeses` se guarda como entero, pero el interés se calcula con el plazo
 * exacto que sale de las cuotas y la frecuencia. Al recalcular hay que
 * recuperar ese exacto: si no, editar cualquier campo del crédito le cambia el
 * interés sin que nadie lo haya pedido.
 */
describe('LoansService · recuperación del plazo exacto', () => {
  const servicio = new LoansService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const recuperar = (prestamo: any) =>
    (servicio as any).recuperarPlazoExacto(prestamo);

  it('recupera el plazo fraccionario de un crédito derivado de sus cuotas', () => {
    // 45 cuotas diarias son 1,5 meses; en la base quedó guardado como 2.
    expect(
      recuperar({
        plazoMeses: 2,
        cantidadCuotas: 45,
        frecuenciaPago: 'DIARIO',
      }),
    ).toBe(1.5);
  });

  it('no toca el plazo cuando ya era exacto', () => {
    expect(
      recuperar({
        plazoMeses: 1,
        cantidadCuotas: 30,
        frecuenciaPago: 'DIARIO',
      }),
    ).toBe(1);
  });

  it('respeta un plazo puesto a mano que no coincide con las cuotas', () => {
    // 30 cuotas diarias derivarían 1 mes, pero se pactó a 3: manda lo pactado.
    expect(
      recuperar({
        plazoMeses: 3,
        cantidadCuotas: 30,
        frecuenciaPago: 'DIARIO',
      }),
    ).toBe(3);
  });

  it('cae al valor guardado si no hay cuotas o frecuencia', () => {
    expect(recuperar({ plazoMeses: 4, cantidadCuotas: 0 })).toBe(4);
    expect(
      recuperar({ plazoMeses: 4, cantidadCuotas: 45, frecuenciaPago: null }),
    ).toBe(4);
  });

  it('el interés deja de saltar al editar un crédito de plazo fraccionario', () => {
    const monto = 500000;
    const tasa = 10;

    const plazoGuardado = 2; // el redondeo que hay en la base
    const plazoExacto = recuperar({
      plazoMeses: plazoGuardado,
      cantidadCuotas: 45,
      frecuenciaPago: 'DIARIO',
    });

    const interesConGuardado = (monto * tasa * plazoGuardado) / 100;
    const interesConExacto = (monto * tasa * plazoExacto) / 100;

    expect(interesConGuardado).toBe(100000);
    expect(interesConExacto).toBe(75000); // el que realmente se pactó
  });
});
