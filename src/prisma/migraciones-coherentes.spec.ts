import * as fs from 'fs';
import * as path from 'path';

/**
 * Que cada migración hable de tablas y columnas que existen en el esquema.
 *
 * Una migración escrita a mano no la valida nadie hasta que corre en el
 * despliegue, y allí ya es tarde: `migrate-deploy` va antes que el arranque, así
 * que un `ALTER TABLE` con el nombre equivocado deja el servicio sin levantar.
 *
 * No es hipotético: al añadir la marca de carga histórica escribí
 * `ALTER TABLE "prestamos"` y la tabla se llama `Prestamo`. Compilaba, el
 * esquema era válido, y habría reventado en Render.
 *
 * Se comprueban solo las migraciones que tocan tablas ya existentes
 * (ALTER TABLE). Las que crean tablas nuevas describen el estado al que se
 * llega, no del que se parte, y compararlas con el esquema de hoy no dice nada.
 */

const RAIZ = path.join(__dirname, '..', 'prisma');
const ESQUEMA = path.join(RAIZ, 'schema.prisma');
const MIGRACIONES = path.join(RAIZ, 'migrations');

/** Los nombres de tabla que el esquema declara, respetando `@@map`. */
function tablasDelEsquema(): Set<string> {
  const fuente = fs.readFileSync(ESQUEMA, 'utf8');
  const tablas = new Set<string>();

  const modelos = fuente.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm);
  for (const m of modelos) {
    const nombre = m[1];
    const cuerpo = m[2];
    const mapeo = /@@map\(\s*"([^"]+)"\s*\)/.exec(cuerpo);
    tablas.add(mapeo ? mapeo[1] : nombre);
  }
  return tablas;
}

function migraciones(): Array<{ nombre: string; sql: string }> {
  if (!fs.existsSync(MIGRACIONES)) return [];
  return fs
    .readdirSync(MIGRACIONES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({
      nombre: e.name,
      archivo: path.join(MIGRACIONES, e.name, 'migration.sql'),
    }))
    .filter((m) => fs.existsSync(m.archivo))
    .map((m) => ({
      nombre: m.nombre,
      sql: fs.readFileSync(m.archivo, 'utf8'),
    }));
}

describe('las migraciones cuadran con el esquema', () => {
  it('todo ALTER TABLE nombra una tabla que el esquema declara', () => {
    const tablas = tablasDelEsquema();
    expect(tablas.size).toBeGreaterThan(10); // la sonda funciona

    const fallos: string[] = [];

    for (const { nombre, sql } of migraciones()) {
      // Se ignora lo que va dentro de un comentario `--`.
      const limpio = sql.replace(/--[^\n]*/g, '');

      for (const m of limpio.matchAll(/ALTER TABLE\s+"([^"]+)"/gi)) {
        const tabla = m[1];
        if (!tablas.has(tabla)) {
          fallos.push(
            `${nombre}: ALTER TABLE "${tabla}" — el esquema no declara esa tabla. ` +
              `¿Quisiste decir "${[...tablas].find((t) => t.toLowerCase().startsWith(tabla.toLowerCase().slice(0, 5))) ?? '?'}"?`,
          );
        }
      }
    }

    expect(fallos.join('\n')).toBe('');
  });

  it('la marca de carga histórica está en el esquema y en una migración', () => {
    // Esta marca es la que distingue un crédito traído de cartera vieja, cuyas
    // cuotas pagadas NO tienen pago ni recibo detrás. Si se cae una de las dos
    // mitades, el despliegue queda a medias y la pantalla miente.
    const esquema = fs.readFileSync(ESQUEMA, 'utf8');
    expect(esquema).toContain('cargaHistoricaEn');

    const enAlgunaMigracion = migraciones().some((m) =>
      m.sql.includes('cargaHistoricaEn'),
    );
    expect(enAlgunaMigracion).toBe(true);
  });
});
