import * as fs from 'fs';
import * as path from 'path';
import { getBogotaDayKey, getBogotaWeekday } from './date-utils';

/**
 * Que calcular una fecha de Bogotá siga costando microsegundos.
 *
 * ── Lo que pasó ─────────────────────────────────────────────────────────────
 *
 * `new Intl.DateTimeFormat(...)` es de lo más caro que hay en JavaScript: carga
 * los datos de la zona y del idioma desde ICU. Estaba dentro de las funciones
 * de `date-utils`, así que se construía uno nuevo en CADA llamada.
 *
 * Medido con 20.000 llamadas:
 *
 *     formateador nuevo cada vez: 1.237 ms  (61,9 µs por llamada)
 *     reutilizando uno solo     :    95 ms  ( 4,8 µs por llamada)
 *
 * Trece veces. Y estas funciones son el reloj de todo el backend: la mora, los
 * reportes, los cierres de ruta y el listado de clientes.
 *
 * Donde más dolía: el panel llamaba a `getBogotaDayKey` dentro de un bucle
 * anidado —una vez por cada día del período y por cada cuota— y con 5.024
 * clientes eso eran 1,9 millones de llamadas. A 62 µs son casi dos minutos, y
 * el panel no respondía. A 4,8 µs son 9 segundos, y con el precálculo de la
 * clave fuera del bucle bajó a 1,25 s.
 *
 * ── Qué vigila esta prueba ──────────────────────────────────────────────────
 *
 * Dos cosas, y las dos son necesarias:
 *
 *  1. Que el código no vuelva a construir un formateador dentro de una
 *     función. Se lee el archivo: los formateadores tienen que estar en el
 *     ámbito del módulo.
 *  2. Que el coste real por llamada siga siendo bajo. Lo primero sin lo
 *     segundo se puede burlar de muchas formas; lo segundo sin lo primero no
 *     explica por qué falla.
 *
 * El umbral de tiempo es generoso a propósito —30 µs frente a los 4,8 medidos—
 * porque esta prueba corre en máquinas distintas y junto a otras suites. Lo que
 * tiene que atrapar es la diferencia de trece veces, no una de dos.
 */

const ARCHIVO = path.join(__dirname, 'date-utils.ts');

describe('las fechas de Bogotá no construyen un formateador por llamada', () => {
  it('los formateadores viven en el ámbito del módulo, no dentro de las funciones', () => {
    const fuente = fs.readFileSync(ARCHIVO, 'utf8');

    // Las líneas que construyen un formateador, sin comentarios.
    const lineas = fuente
      .split('\n')
      .map((linea, i) => ({ texto: linea, numero: i + 1 }))
      .filter(
        ({ texto }) =>
          texto.includes('new Intl.DateTimeFormat') &&
          !texto.trimStart().startsWith('*') &&
          !texto.trimStart().startsWith('//'),
      );

    // Una construcción en el ámbito del módulo empieza en la columna 0, como
    // `const FMT_... = new Intl.DateTimeFormat(`. Si está indentada, está
    // dentro de una función.
    const dentroDeFuncion = lineas
      .filter(({ texto }) => /^\s+/.test(texto))
      .map(({ numero, texto }) => `date-utils.ts:${numero} -> ${texto.trim()}`);

    const informe = dentroDeFuncion.length
      ? [
          'Estos formateadores se construyen dentro de una función, así que se',
          'crean otra vez en cada llamada. Son 62 µs por llamada en vez de 4,8:',
          '',
          ...dentroDeFuncion.map((d) => `  - ${d}`),
          '',
          'Súbelos a una constante del módulo. Son inmutables y sin estado, así',
          'que compartirlos entre peticiones es seguro.',
        ].join('\n')
      : 'ninguno';

    expect(informe).toBe('ninguno');
    // Y que de verdad haya formateadores en el módulo: si alguien los borrara,
    // la comprobación de arriba pasaría sin medir nada.
    expect(lineas.length).toBeGreaterThan(2);
  });

  it('una llamada cuesta microsegundos, no decenas', () => {
    const fecha = new Date('2026-11-11T15:30:00-05:00');
    const VECES = 5000;

    // Una pasada en vacío antes de medir: la primera llamada paga la carga de
    // ICU y mediría el arranque, no el coste por llamada.
    getBogotaDayKey(fecha);
    getBogotaWeekday(fecha);

    const inicio = process.hrtime.bigint();
    for (let i = 0; i < VECES; i++) {
      getBogotaDayKey(fecha);
    }
    const microsegundosPorLlamada =
      Number(process.hrtime.bigint() - inicio) / 1000 / VECES;

    // 30 µs es el umbral: lo medido es 4,8 y lo que se persigue son los 62 de
    // construir el formateador cada vez.
    expect(
      `µs por llamada bajo el umbral: ${microsegundosPorLlamada < 30}`,
    ).toBe('µs por llamada bajo el umbral: true');
  });

  it('cachear el formateador no cambió lo que devuelve', () => {
    // Un formateador compartido no guarda estado entre llamadas, pero eso hay
    // que comprobarlo, no suponerlo: dos llamadas seguidas con fechas
    // distintas tienen que dar resultados distintos y correctos.
    const unDia = new Date('2026-11-11T15:30:00-05:00');
    const otroDia = new Date('2026-12-25T08:00:00-05:00');

    expect(getBogotaDayKey(unDia)).toBe('2026-11-11');
    expect(getBogotaDayKey(otroDia)).toBe('2026-12-25');
    // Y de vuelta, para descartar que la segunda llamada contaminara algo.
    expect(getBogotaDayKey(unDia)).toBe('2026-11-11');

    // 11 de noviembre de 2026 es miércoles; 25 de diciembre, viernes.
    expect(getBogotaWeekday(unDia)).toBe(3);
    expect(getBogotaWeekday(otroDia)).toBe(5);
    expect(getBogotaWeekday(unDia)).toBe(3);
  });
});
