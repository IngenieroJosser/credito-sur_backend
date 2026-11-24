import { calcularDiasMoraOperativos } from './mora.service';
import { getBogotaDayKey, getBogotaWeekday } from '../utils/date-utils';

/**
 * Los días de atraso ya no se cuentan día por día, y dan exactamente lo mismo.
 *
 * ── Lo que costaba ─────────────────────────────────────────────────────────
 *
 * Para la frecuencia DIARIO —la normal en este negocio— la cuenta era un bucle
 * desde el vencimiento hasta hoy, y cada vuelta llamaba a `shiftBogotaKey`
 * (construye una fecha y formatea con `Intl`), a `buildBogotaNoon` otra vez y a
 * `getBogotaWeekday` (formatea otra vez). **Dos llamadas a `Intl` por cada día
 * de atraso.**
 *
 * Medido con una sonda dentro de `getAllClients`, sobre una base de carga de
 * 2.000 clientes y 3.000 créditos:
 *
 * ```
 * SONDA /clients  5 consultas=435ms  2 consultas raw=269ms
 *                 pegar relaciones=41ms  transformar=11891ms  ordenar=1ms
 *                 TOTAL=12637ms
 * ```
 *
 * O sea que de los 12,6 s del listado, **11,9 s (el 94%) estaban en el `map`
 * que transforma cada cliente**, y dentro de él en esta cuenta: ~6 ms por
 * cliente, con clientes de 160 a 264 días de atraso. Unas 640.000 llamadas a
 * `Intl` en una sola petición. Y empeora con la antigüedad de la cartera.
 *
 * Las consultas a la base eran 700 ms de los 12.600: **no era la base de
 * datos.**
 *
 * ── Por qué esta prueba está escrita así ──────────────────────────────────
 *
 * Porque lo que hay que demostrar no es que el resultado sea «razonable», sino
 * que es **el mismo**. Así que el bucle original se copia aquí tal cual, como
 * implementación de referencia, y se comparan las dos día a día. Si alguien
 * cambia la regla de negocio (por ejemplo, dejar de contar los sábados),
 * tendrá que cambiar las dos y la comparación seguirá valiendo.
 */

/**
 * El bucle ORIGINAL, copiado literal de `mora.service.ts` antes del cambio.
 *
 * No se importa de ningún sitio a propósito: es la referencia contra la que se
 * compara, y tiene que quedarse congelada aunque el código cambie.
 */
const buildBogotaNoon = (key: string): Date =>
  new Date(`${key}T12:00:00-05:00`);

const shiftBogotaKey = (key: string, days: number): string =>
  getBogotaDayKey(new Date(buildBogotaNoon(key).getTime() + days * 86_400_000));

function referenciaRecorriendoLosDias(
  fechaVencimiento: Date,
  hoy: Date,
  frecuenciaPago?: string | null,
): number {
  const vencimientoKey = getBogotaDayKey(fechaVencimiento);
  const hoyKey = getBogotaDayKey(hoy);
  if (!vencimientoKey || !hoyKey || vencimientoKey >= hoyKey) return 0;

  if (String(frecuenciaPago || '').toUpperCase() !== 'DIARIO') {
    const vencimiento = buildBogotaNoon(vencimientoKey);
    const actual = buildBogotaNoon(hoyKey);
    return Math.max(
      0,
      Math.floor((actual.getTime() - vencimiento.getTime()) / 86_400_000),
    );
  }

  let dias = 0;
  let cursorKey = shiftBogotaKey(vencimientoKey, 1);
  while (cursorKey && cursorKey <= hoyKey) {
    if (getBogotaWeekday(buildBogotaNoon(cursorKey)) !== 0) {
      dias++;
    }
    cursorKey = shiftBogotaKey(cursorKey, 1);
  }

  return dias;
}

/** Mediodía de Bogotá del día indicado, que es la convención del repo. */
const mediodiaBogota = (clave: string) => new Date(`${clave}T12:00:00-05:00`);

describe('la cuenta de días de atraso da lo mismo que recorriendo los días', () => {
  /*
   * Cuatro vencimientos que caen en días de la semana distintos, para que la
   * aritmética de los domingos se ejercite desde todos los puntos de partida.
   * El 2026-01-01 fue jueves.
   */
  const vencimientos = [
    '2026-01-01',
    '2026-01-02',
    '2026-01-03',
    '2026-01-04',
    '2025-02-27',
    '2024-02-28', // año bisiesto, por el 29
  ];
  const frecuencias = ['DIARIO', 'diario', 'SEMANAL', 'MENSUAL', null, ''];

  it.each(vencimientos)(
    'vencida el %s: coincide en los 200 días siguientes, en todas las frecuencias',
    (clave) => {
      const venc = mediodiaBogota(clave);
      let comparaciones = 0;
      const discrepancias: string[] = [];

      for (let d = -3; d <= 200; d++) {
        const hoy = new Date(venc.getTime() + d * 86_400_000);
        for (const f of frecuencias) {
          comparaciones++;
          const nuevo = calcularDiasMoraOperativos(venc, hoy, f);
          const viejo = referenciaRecorriendoLosDias(venc, hoy, f);
          if (nuevo !== viejo) {
            discrepancias.push(
              `${clave} +${d}d freq=${String(f)}: nuevo=${nuevo} viejo=${viejo}`,
            );
          }
        }
      }

      // Piso medido: si el bucle de la prueba se rompiera, esto delataría que
      // no comparó nada en vez de pasar en verde.
      expect(comparaciones).toBe(204 * frecuencias.length);
      expect(discrepancias).toEqual([]);
    },
  );

  it('coincide también en rangos largos, de hasta ocho años', () => {
    /*
      Se avanza de 29 en 29 dias y no de uno en uno porque la REFERENCIA es el
      bucle caro: cubrirlo dia a dia durante ocho años hacia que esta sola
      prueba tardara mas de dos minutos. 29 es primo respecto a 7, asi que los
      puntos de muestreo recorren todos los dias de la semana.
    */
    // Una cartera vieja es justo donde el bucle se volvía caro, así que es
    // donde más importa que el resultado no cambie.
    const venc = mediodiaBogota('2018-06-15');
    const discrepancias: string[] = [];
    for (let d = 0; d <= 8 * 365; d += 29) {
      const hoy = new Date(venc.getTime() + d * 86_400_000);
      const nuevo = calcularDiasMoraOperativos(venc, hoy, 'DIARIO');
      const viejo = referenciaRecorriendoLosDias(venc, hoy, 'DIARIO');
      if (nuevo !== viejo) discrepancias.push(`+${d}d: ${nuevo} vs ${viejo}`);
    }
    expect(discrepancias).toEqual([]);
  });

  it('sigue sin contar los domingos', () => {
    /*
     * La regla de negocio, afirmada aparte de la comparación: el domingo no hay
     * jornada, así que un cliente diario no puede atrasarse ese día. Una semana
     * entera de atraso son SEIS días, no siete.
     */
    const jueves = mediodiaBogota('2026-01-01');
    const jueves7 = mediodiaBogota('2026-01-08');
    expect(calcularDiasMoraOperativos(jueves, jueves7, 'DIARIO')).toBe(6);
    // Y en calendario sí son siete.
    expect(calcularDiasMoraOperativos(jueves, jueves7, 'MENSUAL')).toBe(7);
  });

  it('una cuota que vence hoy o después no tiene atraso', () => {
    const hoy = mediodiaBogota('2026-03-10');
    expect(calcularDiasMoraOperativos(hoy, hoy, 'DIARIO')).toBe(0);
    expect(
      calcularDiasMoraOperativos(mediodiaBogota('2026-03-20'), hoy, 'DIARIO'),
    ).toBe(0);
  });

  it('ya no llama a `Intl` una vez por día de atraso', () => {
    /*
     * La aserción que vigila el motivo del cambio. Se cuentan las llamadas
     * reales interceptando el formateador: con el bucle, un atraso de 200 días
     * daba cientos de llamadas; con la forma cerrada son las dos de las claves
     * (vencimiento y hoy) y ni una más.
     */
    /*
      Solo se intercepta `formatToParts`, que es un METODO de verdad.
      `Intl.DateTimeFormat.prototype.format` es un **getter** que devuelve una
      funcion ligada: leerlo para guardarlo lanza «Method UnwrapDateTimeFormat
      called on incompatible receiver». Y no hace falta: con el bucle,
      `shiftBogotaKey` llamaba a `getBogotaDayKey` -que usa `formatToParts`- en
      CADA vuelta, asi que contar solo este ya distingue las dos
      implementaciones.
    */
    const original = Intl.DateTimeFormat.prototype.formatToParts;
    let llamadas = 0;
    Intl.DateTimeFormat.prototype.formatToParts = function (
      ...args: Parameters<typeof original>
    ) {
      llamadas++;
      return original.apply(this, args);
    };

    try {
      const venc = mediodiaBogota('2025-05-01');
      const hoy = mediodiaBogota('2025-11-17'); // 200 dias despues
      const dias = calcularDiasMoraOperativos(venc, hoy, 'DIARIO');
      // Que de verdad hubo un atraso largo: si fuera 0, no habria recorrido
      // nada y la cuenta de llamadas no probaria nada.
      expect(dias).toBeGreaterThan(150);
      expect(llamadas).toBeLessThanOrEqual(4);
    } finally {
      Intl.DateTimeFormat.prototype.formatToParts = original;
    }
  });
});
