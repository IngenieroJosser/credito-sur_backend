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

/**
 * La fecha importada tiene que ser el MISMO día en Bogotá, no el anterior.
 *
 * ── El defecto ─────────────────────────────────────────────────────────────
 *
 * `leerFecha` construía las fechas a **medianoche UTC**
 * (`new Date(Date.UTC(anio, mes - 1, dia))`), y en Bogotá eso son las 19:00 del
 * día ANTERIOR. La app no lo hace así: su convención es mediodía de Bogotá
 * (`T12:00:00-05:00`), en `loans.service.ts` y `mora.service.ts`.
 *
 * ── Lo que producía, medido ────────────────────────────────────────────────
 *
 * De 1.629 cuotas de la base de desarrollo, 1.541 vencen a las 17:00 UTC
 * (mediodía de Bogotá) y **88 a las 00:00**; cuatro de los siete créditos con
 * esas 88 vinieron de la importación. Y comprobado fila por fila: **las 88 se
 * leen vencidas el día en que toca pagarlas** —la comparación de mora es contra
 * el inicio del día de Bogotá, las 05:00 UTC, y medianoche UTC es anterior—,
 * mientras las de las 17:00 no.
 *
 * O sea que cada cuota importada entraba en mora un día antes: mueve la mora, la
 * meta del día y el semáforo del cliente, y manda al cobrador a cobrarle a
 * alguien que no está atrasado. Con la cartera real del cliente serían todas.
 */
describe('leerFecha ancla el día en Bogotá, no en UTC', () => {
  /** El inicio del día de Bogotá, que es contra lo que se compara la mora. */
  const inicioDelDiaBogota = (clave: string) =>
    new Date(`${clave}T00:00:00-05:00`);

  const claveBogota = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

  it.each([
    ['ISO', '2026-08-07'],
    ['día primero con barras', '07/08/2026'],
    ['día primero con guiones', '07-08-2026'],
  ])('%s: el día en Bogotá es el que dice el Excel', (_caso, texto) => {
    const leida = leerFecha(texto);

    expect(leida).not.toBeNull();
    expect(claveBogota(leida as Date)).toBe('2026-08-07');
  });

  it('y NO se lee vencida el día en que toca pagarla', () => {
    // Es la comprobación que de verdad importa: con medianoche UTC esto era
    // `true` y la cuota nacía en mora.
    const vence = leerFecha('2026-08-07') as Date;

    expect(vence.getTime()).toBeGreaterThan(
      inicioDelDiaBogota('2026-08-07').getTime(),
    );
  });

  it('un Date que ya viene de Excel también se reancla', () => {
    // La librería de xlsx entrega `Date` a medianoche; si no se reanclara, la
    // celda con formato de fecha seguiría trayendo el defecto.
    const deExcel = new Date(Date.UTC(2026, 7, 7));

    const leida = leerFecha(deExcel) as Date;

    expect(claveBogota(leida)).toBe('2026-08-07');
    expect(leida.getTime()).toBeGreaterThan(
      inicioDelDiaBogota('2026-08-07').getTime(),
    );
  });

  it('el serial de Excel, igual', () => {
    // 46241 = 2026-08-07 en el calendario de Excel (días desde 1899-12-30).
    const leida = leerFecha(46241) as Date;

    expect(leida).not.toBeNull();
    expect(claveBogota(leida)).toBe('2026-08-07');
  });

  it('y el día UTC sigue siendo el mismo: nada de lo que ya lo leía se mueve', () => {
    // A mediodía de Bogotá (17:00 UTC) el día UTC coincide, así que todo lo que
    // hacía `toISOString().slice(0, 10)` sobre estas fechas sigue viendo lo
    // mismo. Es lo que hace seguro el arreglo.
    expect(iso(leerFecha('2026-08-07'))).toBe('2026-08-07');
    expect(iso(leerFecha('31/12/2026'))).toBe('2026-12-31');
  });
});
