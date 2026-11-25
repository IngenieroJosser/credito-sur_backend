import * as fs from 'fs';
import * as path from 'path';
import { AccountingService } from './accounting.service';
import { comoPrisma, type DobleDePrisma } from '../common/testing/dobles';

/**
 * El saldo de una caja en un rango lo suma el servidor, no el navegador.
 *
 * ── Lo que hacía la pantalla ───────────────────────────────────────────────
 *
 * Para enseñar dos cifras —el saldo previo al rango y el total registrado
 * dentro de él— se bajaba **hasta 5.000 asientos del libro con sus líneas**
 * (`getMovimientosLedger({ limit: 5000 })`) y los sumaba en el navegador.
 *
 * Dos problemas. El primero es el tope: si la caja tiene más asientos que
 * 5.000, el saldo previo sale **corto y sin decirlo**. Medido en desarrollo,
 * la caja más activa va por 301, así que está lejos —pero el libro es
 * append-only y solo crece—. El segundo es traer miles de filas para obtener
 * dos números.
 *
 * ── Que la cuenta es la MISMA no se razona, se comprueba ──────────────────
 *
 * Antes de cambiar nada se corrió el endpoint contra el cálculo que hacía el
 * navegador, replicado línea por línea, sobre **5 cajas × 5 rangos de fechas**
 * —sin rango, el año entero, un mes, abierto por la derecha y abierto por la
 * izquierda—: **50 comparaciones, cero discrepancias**.
 *
 * La primera versión del SQL daba **0 en todo**, y la comparación fue lo que
 * lo encontró: faltaba el `COALESCE`. El navegador hace `Number(x || 0)`, y en
 * SQL una resta con NULL da NULL, así que el delta del día entero salía nulo.
 * Por eso esta prueba lo exige explícitamente.
 *
 * ── Y la pantalla conserva el camino viejo ────────────────────────────────
 *
 * Si el endpoint falla, cae al cálculo de antes. Lo peor que puede pasar es lo
 * que pasaba ayer.
 */
const FUENTE = fs
  .readFileSync(path.join(__dirname, 'accounting.service.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

/** El cuerpo del método, para no acusar a otra consulta del archivo. */
const CUERPO = (() => {
  const inicio = FUENTE.indexOf('async getSaldoDeCajaEnRango(');
  expect(inicio).toBeGreaterThan(0);
  const resto = FUENTE.slice(inicio + 20);
  const siguiente = resto.search(/\n {2}(?:private |protected )?async \w+\(/);
  const cuerpo = siguiente > 0 ? resto.slice(0, siguiente) : resto;
  expect(cuerpo.length).toBeGreaterThan(800);
  return cuerpo;
})();

describe('la consulta suma como sumaba el navegador', () => {
  it('trata los NULL como cero, en las DOS columnas', () => {
    /*
     * La aserción que nació de un fallo real: sin esto el endpoint devolvía
     * cero en las cinco cajas y los cinco rangos.
     */
    expect(CUERPO).toMatch(/COALESCE\(l\."debitAmount", 0\)/);
    expect(CUERPO).toMatch(/COALESCE\(l\."creditAmount", 0\)/);
  });

  it('agrupa por el día de BOGOTÁ, no por el de UTC', () => {
    /*
     * El listado entrega `fecha: formatBogotaOffsetIso(createdAt)` y la
     * pantalla se queda con su `YYYY-MM-DD`. Agrupar en UTC correría los
     * movimientos de la tarde al día siguiente.
     */
    expect(CUERPO).toMatch(/AT TIME ZONE 'America\/Bogota'/);
  });

  it('no lleva ningún tope: ese era el defecto', () => {
    expect(CUERPO).not.toMatch(/\bLIMIT\b/i);
    expect(CUERPO).not.toMatch(/\btake\b/);
  });

  it('sin fecha de inicio no hay saldo previo', () => {
    // Es lo que hacía el `if (!inicioKey) return acc` del navegador: sin
    // inicio no existe un «antes del rango».
    expect(CUERPO).toMatch(/<> ''/);
  });
});

describe('el método devuelve números, no lo que venga', () => {
  const servicioCon = (fila: unknown) => {
    const prisma: DobleDePrisma = {
      $queryRaw: jest.fn().mockResolvedValue(fila === null ? [] : [fila]),
    };
    const vacio = {} as never;
    return new AccountingService(comoPrisma(prisma), vacio, vacio, vacio);
  };

  it('devuelve las dos cifras tal como las da la base', async () => {
    const r = await servicioCon({
      saldoPrevio: 1368333,
      totalRegistrado: -534832,
    }).getSaldoDeCajaEnRango('caja-1', '2026-08-01', '2026-08-31');

    expect(r.saldoPrevio).toBe(1368333);
    expect(r.totalRegistrado).toBe(-534832);
    expect(r.inicio).toBe('2026-08-01');
    expect(r.fin).toBe('2026-08-31');
  });

  it('con la caja sin movimientos devuelve ceros, no undefined', async () => {
    /*
     * Aquí un cero SÍ es la respuesta correcta —la caja no tiene asientos— y
     * lo que no puede salir es `undefined`, que la pantalla pintaría como
     * «NaN» o como vacío.
     */
    const r = await servicioCon(null).getSaldoDeCajaEnRango('caja-2');
    expect(r.saldoPrevio).toBe(0);
    expect(r.totalRegistrado).toBe(0);
    expect(r.inicio).toBeNull();
    expect(r.fin).toBeNull();
  });
});
