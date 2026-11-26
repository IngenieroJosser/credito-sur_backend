import * as fs from 'fs';
import * as path from 'path';
import { formatCurrency } from './date-utils';

/**
 * El dinero que el backend escribe sale en pesos y con separadores.
 *
 * ── Lo que se veía ────────────────────────────────────────────────────────
 *
 * Lo reportó el dueño con una captura del panel contable: al pasar el ratón
 * por un movimiento, el texto decía
 *
 *     «Entrada de inventario por importación — 10096: 5 und a $597995»
 *
 * Un importe de seis cifras sin un solo separador, que hay que contar con el
 * dedo. Venía de pegar el número crudo detrás del símbolo al construir la
 * descripción del asiento.
 *
 * ── Y lo que no se veía, que era peor ─────────────────────────────────────
 *
 * El backend YA tenía un `formatCurrency`, y formateaba en `es-PY` con moneda
 * `PYG`: guaraníes paraguayos, en una financiera colombiana. No había dado
 * problemas porque no lo llamaba nadie —barrido sobre `src/`: cero usos fuera
 * de su archivo—, o sea que era código muerto esperando a que alguien lo
 * usara y metiera la moneda de otro país en un asiento contable. Justo lo que
 * iba a pasar al arreglar lo de arriba.
 *
 * ── Lo que vigila ─────────────────────────────────────────────────────────
 *
 * Que el formateador sea de pesos, y que las descripciones de inventario no
 * vuelvan a pegar el número a pelo. Esto último se lee del código, porque lo
 * que se quiere impedir es la FORMA de escribirlo, no un resultado.
 */
describe('formatCurrency habla en pesos colombianos', () => {
  it('pone separador de miles', () => {
    /*
     * El caso de la captura: 597995 debe poder leerse de un vistazo. Se
     * comprueba por partes y no contra una cadena exacta, porque el espacio
     * que `Intl` mete entre el símbolo y el número no siempre es el normal.
     */
    const texto = formatCurrency(597995);

    expect(texto).toContain('597.995');
    expect(texto).toContain('$');
  });

  it('NO usa guaraníes ni ninguna otra moneda', () => {
    const texto = formatCurrency(1000);

    expect(texto).not.toContain('PYG');
    expect(texto).not.toContain('Gs');
  });

  it('no inventa decimales', () => {
    expect(formatCurrency(1500)).not.toContain(',00');
  });

  it('un importe que no es número sale como cero, no como «NaN»', () => {
    /*
     * «$ NaN» en la descripción de un asiento es peor que un cero: queda
     * guardado para siempre en el libro.
     */
    expect(formatCurrency(Number.NaN)).not.toContain('NaN');
  });
});

describe('las descripciones de inventario no pegan el número a pelo', () => {
  const RAIZ = path.join(process.cwd(), 'src');

  /**
   * Un importe pegado al simbolo SIN formatear.
   *
   * La primera version de esto acusaba a 25 archivos, y la mayoria estaban
   * BIEN: muchos ya llaman a `toLocaleString('es-CO')`, que separa igual. Y
   * las plantillas de Excel usan la misma forma para las referencias
   * absolutas de celda -`$A$2`-, que no son dinero y no se deben tocar.
   *
   * Una centinela que pide cambiar lo que ya funciona se desactiva sola: la
   * primera vez que alguien la mira y ve que no tiene razon, deja de
   * mirarla. Asi que solo acusa cuando la interpolacion NO pasa por un
   * formateador.
   */
  const INTERPOLADO = new RegExp('\\$\\${([^{}]*)}', 'g');
  const YA_FORMATEA = ['toLocaleString', 'formatCurrency', 'colLetra'];

  const crudosEn = (fuente: string): string[] =>
    [...fuente.matchAll(INTERPOLADO)]
      .map((m) => m[1])
      .filter((expr) => !YA_FORMATEA.some((bueno) => expr.includes(bueno)));

  const archivos = (() => {
    const salida: string[] = [];
    const recorrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const completo = path.join(dir, e.name);
        if (e.isDirectory()) {
          // Las plantillas de Excel usan la misma forma para las referencias
          // de celda, que no son dinero.
          if (
            e.name === 'node_modules' ||
            e.name === 'migrations' ||
            e.name === 'plantillas'
          )
            continue;
          recorrer(completo);
          continue;
        }
        if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) {
          salida.push(completo);
        }
      }
    };
    recorrer(RAIZ);
    return salida;
  })();

  it('el barrido lee el backend entero', () => {
    // Piso medido: hay varios cientos de archivos .ts en `src/`.
    expect(archivos.length).toBeGreaterThanOrEqual(100);
  });

  it('ningún texto arma un importe con el número sin formatear', () => {
    const culpables = archivos
      .filter((f) => crudosEn(fs.readFileSync(f, 'utf8')).length > 0)
      .map((f) => path.relative(process.cwd(), f).split(path.sep).join('/'));

    /*
     * Si esto falla con una línea tuya: usa `formatCurrency` de
     * `src/utils/date-utils.ts`. Un importe que acaba en pantalla sin
     * separadores no se lee, y si además queda guardado en la descripción de
     * un asiento, no hay forma de arreglarlo después.
     */
    expect(culpables).toEqual([]);
  });
});
