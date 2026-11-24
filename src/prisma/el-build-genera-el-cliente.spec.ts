import * as fs from 'fs';
import * as path from 'path';

/**
 * El build tiene que generar el cliente de Prisma antes de compilar.
 *
 * ── Lo que rompio el despliegue (2026-11-24) ──────────────────────────────
 *
 * El build de Render fallo con OCHO errores de tipos, todos el mismo:
 *
 *     error TS2339: Property 'cantidadProducto' does not exist on type ...
 *
 * El campo SI existe: `src/prisma/schema.prisma:298`, con su migracion
 * (`20261114120000_cantidad_producto_prestamo`). Lo que no existia era en el
 * CLIENTE GENERADO, que es contra lo que `nest build` comprueba los tipos.
 *
 * El comando de Render es `pnpm install --frozen-lockfile && pnpm build`, y en
 * el log no aparece ni una linea `[prisma]`. Medido en local, es exactamente lo
 * que pasa: con `node_modules` al dia, `pnpm install --frozen-lockfile`
 * responde «Already up to date» en menos de un segundo y **no ejecuta el
 * `postinstall`**. Render conserva `node_modules` entre builds, asi que el
 * cliente se quedo en la version anterior al cambio de esquema y nadie lo
 * regeneraba antes de compilar.
 *
 * `start:prod` si lo invoca —se agrego en 4b23c3f justo por una variante de
 * esto— pero `start:prod` corre DESPUES del build, y el build ya habia fallado.
 *
 * Arreglo: encadenarlo tambien al `build`. No se paga dos veces: el script
 * guarda el hash del esquema junto al cliente y si coincide no hace nada.
 *
 * ── Por que una prueba que lee package.json ───────────────────────────────
 *
 * Porque lo que no puede volver es que la cadena se corte, y eso se lee. No
 * hay funcion que llamar: es un comando. Comprobada al reves quitando el
 * script del `build`, con lo que falla.
 */
const PAQUETE = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
) as { scripts?: Record<string, string> };

const SCRIPTS = PAQUETE.scripts ?? {};
const GENERADOR = 'scripts/ensure-prisma-client.js';

describe('el cliente de Prisma se genera antes de compilar', () => {
  it('el `build` invoca el generador', () => {
    /*
     * Piso: si `build` desapareciera o se renombrara, las demas aserciones
     * mirarian una cadena vacia y pasarian sin comprobar nada.
     */
    expect(typeof SCRIPTS.build).toBe('string');
    expect(SCRIPTS.build).toContain(GENERADOR);
  });

  it('y lo invoca ANTES de `nest build`, no despues', () => {
    // Despues no serviria de nada: la comprobacion de tipos ya habria corrido.
    const build = SCRIPTS.build ?? '';
    /*
     * Los dos `indexOf` tienen que ser posiciones REALES antes de compararlas.
     * Sin esto la asercion pasaba en vacio: con el generador ausente da -1, y
     * -1 siempre es menor que cualquier posicion. Lo vi al meter el defecto a
     * mano: de cuatro pruebas solo caia una.
     */
    const posGenerador = build.indexOf(GENERADOR);
    const posCompilar = build.indexOf('nest build');
    expect(posGenerador).toBeGreaterThanOrEqual(0);
    expect(posCompilar).toBeGreaterThanOrEqual(0);
    expect(posGenerador).toBeLessThan(posCompilar);
  });

  it('el arranque sigue comprobandolo por su cuenta', () => {
    /*
     * El build y el arranque son maquinas distintas en algunas
     * configuraciones, y el esquema puede cambiar entre uno y otro: la garantia
     * de 4b23c3f se conserva.
     */
    expect(SCRIPTS['start:prod']).toContain(GENERADOR);
  });

  it('el generador existe donde los scripts dicen', () => {
    expect(fs.existsSync(path.join(process.cwd(), GENERADOR))).toBe(true);
  });
});
