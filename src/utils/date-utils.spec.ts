import {
  formatBogotaFecha,
  formatBogotaFechaHora,
  getBogotaDayKey,
} from './date-utils';

/**
 * El servidor corre en UTC. Todo lo registrado desde las 7 p. m. de Bogota ya
 * es el dia siguiente en UTC, y ahi es donde las exportaciones mostraban la
 * fecha "corrida" un dia.
 */
describe('fechas en hora de Bogota', () => {
  // 5 de junio, 7:30 p. m. en Bogota = 6 de junio, 00:30 UTC.
  const nocheEnBogota = new Date('2026-06-06T00:30:00.000Z');
  // Medianoche de Bogota, que es como se guardan los vencimientos de cuota.
  const medianocheBogota = new Date('2026-06-05T05:00:00.000Z');

  it('mantiene el dia real aunque en UTC ya sea el siguiente', () => {
    expect(formatBogotaFecha(nocheEnBogota)).toBe('5/6/2026');
    expect(getBogotaDayKey(nocheEnBogota)).toBe('2026-06-05');
    // Asi salia antes: el formateo sin zona sigue el reloj del proceso.
    expect(nocheEnBogota.toISOString().slice(0, 10)).toBe('2026-06-06');
  });

  it('no corre la fecha de una medianoche de Bogota', () => {
    expect(formatBogotaFecha(medianocheBogota)).toBe('5/6/2026');
    expect(getBogotaDayKey(medianocheBogota)).toBe('2026-06-05');
  });

  it('formatea fecha y hora en Bogota, no en UTC', () => {
    const texto = formatBogotaFechaHora(nocheEnBogota);
    expect(texto).toContain('5/6/2026');
    expect(texto).toMatch(/7:30/);
  });

  it('acepta cadenas y numeros, y devuelve vacio si la fecha no sirve', () => {
    expect(formatBogotaFecha('2026-06-06T00:30:00.000Z')).toBe('5/6/2026');
    expect(formatBogotaFecha(nocheEnBogota.getTime())).toBe('5/6/2026');
    expect(formatBogotaFecha('no es una fecha')).toBe('');
    expect(formatBogotaFechaHora('no es una fecha')).toBe('');
  });
});
