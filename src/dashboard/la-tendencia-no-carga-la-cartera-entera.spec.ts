import * as fs from 'fs';
import * as path from 'path';

/**
 * El periodo «Año» del tablero tardaba 114 SEGUNDOS.
 *
 * ── Lo medido ──────────────────────────────────────────────────────────────
 *
 * Con la base de carga (2.000 clientes, 3.000 creditos, 90.000 cuotas, 30.000
 * pagos), `GET /dashboard` por periodo:
 *
 *     periodo   antes                     despues
 *     today     1,24 - 1,46 s             0,34 - 0,61 s
 *     week      1,72 - 1,98 s             0,39 - 0,86 s
 *     month     1,92 - 2,21 s             0,88 - 1,01 s
 *     year      114,0 - 115,2 s   <--     0,87 - 1,04 s
 *
 * «Año» no era lento: era **inutilizable**. Casi dos minutos para pintar doce
 * barras, y es justo el periodo al que se cambia desde «Mes» en el panel del
 * superadministrador.
 *
 * ── Las dos causas ────────────────────────────────────────────────────────
 *
 * Una sonda dentro de `getDashboardData` dijo primero donde mirar: de las
 * quince consultas del tablero, **`trendData` era el 90%** —1.516 ms de
 * 1.630— y las otras catorce juntas sumaban unos 100 ms. (Por eso NO se
 * paralelizaron las catorce, que era el plan inicial: no habria cambiado
 * nada.)
 *
 * Dentro de `processTrendData`:
 *
 * 1. **Cargaba todas las cuotas impagas de la historia** hasta el fin del
 *    rango. Pero el bucle, por cada dia, recorre esas cuotas en orden y se
 *    queda con **la primera de cada credito**: de las treinta que puede tener
 *    un credito, solo la mas antigua puede salir elegida. Ahora se pide una
 *    por credito con `DISTINCT ON` —la mas antigua CON PENDIENTE, porque una
 *    PARCIAL ya cubierta cede el turno a la siguiente—, mas las PAGADA del
 *    rango, que pueden ser mas antiguas. De **60.000 filas a 3.000**.
 *
 * 2. **La rama mensual recalculaba la clave de dia de cada cuota en cada
 *    pasada.** Con «Año» son hasta 366 dias: ~1,1 millones de llamadas a
 *    `Intl` para obtener 3.000 valores distintos. El precalculo existia desde
 *    antes, pero solo se habia aplicado a la rama de dias.
 *
 * Y de paso se dejo de pedir `prestamo: { select: { frecuenciaPago: true } }`,
 * que forzaba una union por fila y **no se usaba en ningun sitio** de la
 * funcion.
 *
 * ── Que se comprobo ───────────────────────────────────────────────────────
 *
 * Las respuestas de los cuatro periodos, campo por campo, antes y despues:
 * **cero diferencias**. Los 50 puntos de grafica (1 + 7 + 30 + 12) llevan dato
 * en todos, y la suma de objetivos del año coincide exacta:
 * 24.540.000.000.
 */
const FUENTE = fs
  .readFileSync(path.join(__dirname, 'dashboard.service.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(new RegExp('\\/\\/[^\\n]*', 'g'), ' ');

/** El cuerpo de `processTrendData`, para no acusar a otro metodo. */
const CUERPO = (() => {
  const inicio = FUENTE.indexOf('private async processTrendData(');
  expect(inicio).toBeGreaterThan(0);
  const resto = FUENTE.slice(inicio + 20);
  const siguiente = resto.search(
    /\n {2}(?:private |protected )?(?:async )?\w+\(/,
  );
  const cuerpo = siguiente > 0 ? resto.slice(0, siguiente) : resto;
  // Piso: si el recorte sale corto, la centinela mira casi nada.
  expect(cuerpo.length).toBeGreaterThan(4_000);
  return cuerpo;
})();

describe('la tendencia no se trae la cartera entera', () => {
  it('pide UNA cuota por credito, no todas las impagas', () => {
    expect(CUERPO).toMatch(/DISTINCT ON \(q\."prestamoId"\)/);
  });

  it('y la que pide es la mas antigua CON pendiente', () => {
    /*
     * Importa el matiz: una cuota PARCIAL ya cubierta se salta en el bucle y
     * el turno pasa a la siguiente. Sin esta condicion, el `DISTINCT ON`
     * devolveria una fila que el bucle descarta y el objetivo saldria menor.
     */
    expect(CUERPO).toMatch(/q\.estado <> 'PARCIAL' OR/);
    expect(CUERPO).toMatch(
      /ORDER BY q\."prestamoId", q\."fechaVencimiento" ASC/,
    );
  });

  it('sigue trayendo las PAGADA del rango', () => {
    /*
     * Una cuota pagada DENTRO del rango pudo estar impaga en un dia anterior,
     * y para ese dia es la que corresponde. Si se perdieran, los objetivos de
     * los dias pasados saldrian mas bajos.
     */
    expect(CUERPO).toMatch(/q\.estado = 'PAGADA'/);
    expect(CUERPO).toMatch(/q\."fechaPago" >=/);
  });

  it('ya no pide `frecuenciaPago`, que no usaba', () => {
    expect(CUERPO).not.toMatch(/frecuenciaPago/);
  });
});

describe('ninguna rama recalcula la clave de dia por cuota y por bucket', () => {
  it('el precalculo esta fuera de las ramas, compartido', () => {
    const posPrecalculo = CUERPO.indexOf('const cuotasPreparadas');
    const posRamaDia = CUERPO.indexOf("if (groupBy === 'day')");
    expect(posPrecalculo).toBeGreaterThan(0);
    expect(posRamaDia).toBeGreaterThan(0);
    // Antes estaba DENTRO de la rama diaria; ahora va antes de las dos.
    expect(posPrecalculo).toBeLessThan(posRamaDia);
  });

  it('la rama mensual usa el precalculo', () => {
    const i = CUERPO.indexOf("} else if (groupBy === 'month')");
    expect(i).toBeGreaterThan(0);
    const rama = CUERPO.slice(i);
    expect(rama.length).toBeGreaterThan(1_000);
    expect(rama).toMatch(/for \(const c of cuotasPreparadas\)/);
  });

  it('y no queda ninguna llamada a getBogotaDayKey dentro de un bucle de cuotas', () => {
    /*
     * Comprobado al reves devolviendo la llamada dentro del bucle mensual:
     * esta asercion cae. El patron busca `getBogotaDayKey` precedido de poco
     * texto despues de un `for (const c of`.
     */
    const bucles = CUERPO.split(/for \(const c of /).slice(1);
    expect(bucles.length).toBeGreaterThanOrEqual(2);
    for (const bucle of bucles) {
      const cuerpoDelBucle = bucle.slice(0, 900);
      expect(cuerpoDelBucle).not.toMatch(/getBogotaDayKey/);
    }
  });
});
