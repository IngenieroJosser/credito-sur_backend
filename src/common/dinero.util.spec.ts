import { pesos, tieneCentavos } from './dinero.util';

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
});
