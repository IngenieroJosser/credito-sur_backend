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

  it('trata los negativos igual, sin acercarlos a cero de más', () => {
    // Math.trunc(-0.5) es -0: una deuda de menos de un peso no se convierte
    // en un abono.
    expect(pesos(-49382.99)).toBe(-49382);
  });

  it('detecta las fracciones de peso para poder avisar de ellas', () => {
    expect(tieneCentavos(1000.5)).toBe(true);
    expect(tieneCentavos(1000)).toBe(false);
    expect(tieneCentavos(null)).toBe(false);
    expect(tieneCentavos(undefined)).toBe(false);
  });
});
