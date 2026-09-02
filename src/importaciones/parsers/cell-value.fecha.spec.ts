import { leerFecha } from './cell-value.util';

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe('leerFecha: fechas de la plantilla de importación', () => {
  it('acepta ISO YYYY-MM-DD (formato que declara la plantilla)', () => {
    expect(iso(leerFecha('2026-09-02'))).toBe('2026-09-02');
    expect(iso(leerFecha('2026-12-31'))).toBe('2026-12-31');
  });

  it('interpreta DD/MM/YYYY con el DÍA primero (convención colombiana)', () => {
    // 2 de septiembre, NO 9 de febrero
    expect(iso(leerFecha('02/09/2026'))).toBe('2026-09-02');
    expect(iso(leerFecha('5/6/2026'))).toBe('2026-06-05');
    expect(iso(leerFecha('31-12-2026'))).toBe('2026-12-31');
  });

  it('RECHAZA texto mal escrito en vez de adivinar', () => {
    expect(leerFecha('02/09 2026')).toBeNull(); // falta un separador
    expect(leerFecha('hola')).toBeNull();
    expect(leerFecha('2026/09/02')).toBeNull(); // año primero con barras
    expect(leerFecha('1/1/26')).toBeNull(); // año de 2 dígitos: ambiguo
  });

  it('RECHAZA fechas que no existen en el calendario', () => {
    expect(leerFecha('31/02/2026')).toBeNull(); // febrero no tiene 31
    expect(leerFecha('30/02/2026')).toBeNull();
    expect(leerFecha('2026-13-01')).toBeNull(); // mes 13
    expect(leerFecha('00/05/2026')).toBeNull(); // día 0
  });

  it('acepta Date nativo y serial de Excel', () => {
    expect(iso(leerFecha(new Date(Date.UTC(2026, 8, 2))))).toBe('2026-09-02');
    // Serial de Excel para 2026-09-02
    const serial = Date.UTC(2026, 8, 2) / 86400000 + 25569;
    expect(iso(leerFecha(serial))).toBe('2026-09-02');
  });

  it('vacío devuelve null (campo opcional)', () => {
    expect(leerFecha('')).toBeNull();
    expect(leerFecha(null)).toBeNull();
    expect(leerFecha(undefined)).toBeNull();
  });
});
