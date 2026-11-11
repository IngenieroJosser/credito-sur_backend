import {
  MAXIMO_EN_PESOS,
  pesos,
  porQueNoEsDinero,
  tieneCentavos,
} from './dinero.util';

describe('El dinero se maneja en pesos enteros', () => {
  it('trunca en vez de redondear, para no inventar un peso que nadie entregó', () => {
    // Redondear hacia arriba le sumaría al cliente un peso que no pagó.
    expect(pesos(49382.99)).toBe(49382);
    expect(pesos(49382.01)).toBe(49382);
    expect(pesos(49382)).toBe(49382);
  });

  it('no deja pasar valores raros como si fueran plata', () => {
    expect(pesos(null)).toBe(0);
    expect(pesos(undefined)).toBe(0);
    expect(pesos(NaN)).toBe(0);
    expect(pesos(Infinity)).toBe(0);
    expect(pesos('12345')).toBe(12345);
  });

  it('con los negativos redondea hacia cero, no hacia abajo', () => {
    // Conviene tenerlo escrito porque no es neutral: `Math.trunc` acerca la
    // cifra a cero en las dos direcciones, así que encoge tanto un cobro como
    // una deuda. Siempre cede a favor de quien paga.
    expect(pesos(-49382.99)).toBe(-49382);
    // Y en el extremo, una deuda por debajo del peso desaparece.
    expect(pesos(-0.99)).toBe(-0);

    // Se mantiene así porque es lo mismo que hace `truncCop` en pagos, y dos
    // reglas distintas para el mismo peso sería peor. Pero a esta función no
    // deberían llegarle fracciones: donde una nace de verdad —el interés— se
    // resuelve en su origen con `Math.round`, igual que en el modal de crear
    // créditos. Aquí actúa de red, no de calculadora.
    expect(pesos(-49382)).toBe(-49382);
  });

  it('detecta las fracciones de peso para poder avisar de ellas', () => {
    expect(tieneCentavos(1000.5)).toBe(true);
    expect(tieneCentavos(1000)).toBe(false);
    expect(tieneCentavos(null)).toBe(false);
    expect(tieneCentavos(undefined)).toBe(false);
  });

  /**
   * El signo de un importe no puede llevar la dirección del movimiento.
   *
   * La lleva su tipo —INGRESO o EGRESO—. Medido contra la base de pruebas: un
   * EGRESO de −3.000.000 sobre una caja con fondos respondía 201 y **subía** el
   * saldo en tres millones, porque la única validación de cifra que había
   * (`monto > saldoDisponible`) se cumple sola con un negativo. El libro de
   * doble entrada tampoco lo veía: las dos patas cuadran igual con el signo
   * invertido.
   */
  describe('porQueNoEsDinero', () => {
    it('acepta un importe normal', () => {
      expect(porQueNoEsDinero(50000)).toBeNull();
      expect(porQueNoEsDinero(1)).toBeNull();
      expect(porQueNoEsDinero(MAXIMO_EN_PESOS)).toBeNull();
    });

    it('rechaza el negativo, que invierte el movimiento sin decirlo', () => {
      expect(porQueNoEsDinero(-3000000)).toContain('mayor que cero');
      expect(porQueNoEsDinero(-1)).toContain('mayor que cero');
    });

    it('rechaza el cero, que ensucia el historial sin mover nada', () => {
      expect(porQueNoEsDinero(0)).toContain('mayor que cero');
    });

    it('rechaza lo que no es un número', () => {
      expect(porQueNoEsDinero('mucho dinero')).toContain('no es un número');
      expect(porQueNoEsDinero(NaN)).toContain('no es un número');
      // `1e309` desborda a Infinity al leerse; sin esto entraba como cifra.
      expect(porQueNoEsDinero(1e309)).toContain('no es un número');
    });

    it('rechaza el hueco, que no es lo mismo que un cero', () => {
      expect(porQueNoEsDinero(null)).toContain('no llegó ninguna cifra');
      expect(porQueNoEsDinero(undefined)).toContain('no llegó ninguna cifra');
      expect(porQueNoEsDinero('')).toContain('no llegó ninguna cifra');
    });

    it('rechaza lo que no cabe en la columna antes de tocar la base', () => {
      // 1e15 respondía 500 «Ocurrió un error inesperado» después de haber
      // abierto la transacción, porque Decimal(15,2) no lo admite.
      expect(porQueNoEsDinero(1e15)).toContain('demasiado grande');
      expect(porQueNoEsDinero(MAXIMO_EN_PESOS + 1)).toContain(
        'demasiado grande',
      );
    });

    it('el motivo nombra la cifra que llegó, para poder leerlo en pantalla', () => {
      // Un «importe inválido» a secas obliga a adivinar qué se escribió mal.
      expect(porQueNoEsDinero(-3000000)).toContain('-3000000');
    });
  });
});
