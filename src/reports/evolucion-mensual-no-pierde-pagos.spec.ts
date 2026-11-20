import * as fs from 'fs';
import * as path from 'path';

/**
 * Un `NOT` sobre una columna que puede ser NULL se lleva las filas NULL.
 *
 * ── El defecto ─────────────────────────────────────────────────────────────
 *
 * `getMonthlyEvolution` —el gráfico de evolución mensual del reporte
 * financiero, que la pantalla sí usa (`getMonthlyEvolution` en
 * `app/admin/reportes/financieros/page.tsx`)— filtraba así:
 *
 *     NOT: { origenGestion: 'CIERRE_PENDIENTE' }
 *
 * En SQL `NOT (columna = 'X')` vale UNKNOWN cuando la columna es NULL, y una
 * fila UNKNOWN no pasa el `WHERE`. Y `origenGestion` es nulo en el cobro normal
 * de la calle: **medido, 84 de 85 pagos**.
 *
 * Así que ese `NOT` dejaba fuera casi todos los pagos. Lo que veía el dueño:
 * **ingresos 0 en los DOCE meses y solo egresos** —un negocio que pierde dinero
 * todos los meses— habiendo 7.883.331 de cobranza.
 *
 * Medido contra la API, antes y después:
 *
 *     antes:   may 0/10.000, jun 0/1.000, ago 0/45.000, sept 0/64.000
 *     después: may 521.666, jun 109.165, ago 4.490.000, sept 105.000,
 *              oct 27.500, nov 2.630.000  → 7.883.331 en el año
 *
 * Y los 2.630.000 de noviembre coinciden con el `recaudo` del panel, que sale
 * del libro contable por otro camino.
 *
 * ── Por qué la forma correcta es un `OR` ───────────────────────────────────
 *
 *     OR: [{ origenGestion: null }, { origenGestion: { not: 'X' } }]
 *
 * Los otros **siete** sitios del backend que filtran por `origenGestion` ya la
 * usaban. Este se quedó atrás, y nada lo vigilaba.
 */
/*
 * La raiz se toma del directorio de trabajo, no de `__dirname`.
 *
 * Con `path.join(__dirname, '..')` el barrido acusaba SIETE sitios que si
 * tienen la guarda, y replicando el mismo recorrido en node salia uno. La
 * diferencia era la raiz: jest corre desde la raiz del proyecto y conviene
 * decirlo explicito en vez de derivarlo.
 */
const RAIZ = path.join(process.cwd(), 'src');

/**
 * El codigo sin comentarios.
 *
 * Hace falta porque esta misma prueba fallaba por el comentario que explica el
 * defecto: la frase citaba `NOT: { origenGestion: ... }` y el barrido la contaba
 * como un uso. Es el mismo tropiezo que ya costo una centinela en el frontend,
 * donde existe `lib/testing/sin-comentarios.ts`.
 */
const sinComentarios = (fuente: string) =>
  fuente
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(new RegExp('\\/\\/[^\\n]*', 'g'), ' ');

/** Los `.ts` del backend, sin pruebas ni migraciones de un solo uso. */
const archivos = (() => {
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === 'node_modules' || entrada.name === 'migrations')
          continue;
        recorrer(completo);
        continue;
      }
      if (!entrada.name.endsWith('.ts')) continue;
      if (entrada.name.endsWith('.spec.ts')) continue;
      salida.push(completo);
    }
  };
  recorrer(RAIZ);
  return salida;
})();

describe('ningún filtro de origenGestion pierde los pagos de la calle', () => {
  /**
   * Cada sitio donde se excluye un `origenGestion`, con su ventana de contexto.
   *
   * La ventana se mira HACIA ATRÁS porque la forma correcta pone primero la
   * alternativa `{ origenGestion: null }` y después el `not`. 300 caracteres
   * cubren de sobra el `OR` de dos ramas tal como lo escriben los siete sitios
   * que ya lo hacen bien, y no tanto como para alcanzar otra consulta.
   */
  const exclusiones = archivos.flatMap((archivo) => {
    const fuente = sinComentarios(fs.readFileSync(archivo, 'utf8'));
    const encontrados: Array<{ archivo: string; linea: number; ok: boolean }> =
      [];
    const patron = /origenGestion:\s*\{\s*not:|NOT:\s*\{\s*origenGestion:/g;
    let m: RegExpExecArray | null;
    while ((m = patron.exec(fuente)) !== null) {
      const ventana = fuente.slice(Math.max(0, m.index - 300), m.index);
      encontrados.push({
        archivo: path.relative(RAIZ, archivo).replace(/\\/g, '/'),
        linea: fuente.slice(0, m.index).split('\n').length,
        ok: /origenGestion:\s*null/.test(ventana),
      });
    }
    return encontrados;
  });

  it('hay sitios que lo excluyen: el barrido mira algo', () => {
    /*
     * Piso medido: ocho. Sin esto, si el patrón dejara de casar —un cambio de
     * formato, un renombrado— la prueba daría cero hallazgos y pasaría en verde
     * sin haber comprobado nada. Ya pasó cuatro veces en este proyecto.
     */
    expect(exclusiones.length).toBeGreaterThanOrEqual(8);
  });

  it('todos van acompañados de la alternativa `origenGestion: null`', () => {
    const sinGuarda = exclusiones.filter((e) => !e.ok);

    expect(sinGuarda).toEqual([]);
  });
});

describe('la evolución mensual suma los pagos de verdad', () => {
  const FUENTE = sinComentarios(
    fs.readFileSync(path.join(__dirname, 'reports.service.ts'), 'utf8'),
  );

  /** El cuerpo de `getMonthlyEvolution`, para no acusar a otro método. */
  const CUERPO = (() => {
    const inicio = FUENTE.indexOf('async getMonthlyEvolution(');
    expect(inicio).toBeGreaterThan(0);
    const resto = FUENTE.slice(inicio + 10);
    const siguiente = resto.search(/\n {2}(?:private |protected )?async \w+\(/);
    const cuerpo = siguiente > 0 ? resto.slice(0, siguiente) : resto;
    // Piso: si el recorte sale corto, la centinela mira casi nada.
    expect(cuerpo.length).toBeGreaterThan(900);
    return cuerpo;
  })();

  it('excluye el cierre pendiente con la forma que no pierde NULL', () => {
    expect(CUERPO).toMatch(/origenGestion: null/);
    expect(CUERPO).toMatch(/origenGestion: \{ not: 'CIERRE_PENDIENTE' \}/);
  });

  it('y ya no usa el `NOT` suelto que los perdía', () => {
    expect(CUERPO).not.toMatch(/NOT:\s*\{\s*origenGestion:/);
  });
});
