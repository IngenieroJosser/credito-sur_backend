const { execFileSync } = require('node:child_process');
const path = require('node:path');

const schema = 'src/prisma/schema.prisma';

/**
 * Aplica las migraciones en el arranque, esquivando el problema del pooler.
 *
 * En Render la base es Neon y `DATABASE_URL` apunta al endpoint con pooler
 * (`...-pooler...neon.tech`). `prisma migrate deploy` toma un advisory lock de
 * Postgres (`SELECT pg_advisory_lock(...)`) para que dos despliegues no migren
 * a la vez, y a traves del pooler ese lock no funciona: la sesion que lo pide
 * no es siempre la misma, el lock se queda colgado y el arranque muere con
 *
 *     Error: P1002 ... Timed out trying to acquire a postgres advisory lock
 *
 * Neon expone el MISMO cluster sin pooler quitando `-pooler` del host. Ahi el
 * lock se comporta bien. Este script migra contra ese endpoint directo y, si no
 * existe o falla, reintenta con la URL original: el objetivo es que un lock
 * momentaneo no deje el servicio caido.
 *
 * No se cambia `DATABASE_URL` de la aplicacion: el servidor sigue usando el
 * pooler, que es lo correcto para atender peticiones. Aqui solo se migra.
 */

/**
 * Ruta al CLI de Prisma, resuelta desde el propio paquete.
 *
 * A proposito NO se invoca a traves del gestor de paquetes (`pnpm exec` /
 * `npx`): el servidor de produccion decide con que gestor instala, y `npx`
 * puede intentar descargar prisma en pleno arranque.
 */
function cliPrisma() {
  const manifiesto = require.resolve('prisma/package.json');
  const { bin } = require('prisma/package.json');
  const entrada = typeof bin === 'string' ? bin : bin.prisma;
  return path.join(path.dirname(manifiesto), entrada);
}

/** Host sin credenciales, para poder registrar que se uso sin filtrar la clave. */
function hostDe(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '(url invalida)';
  }
}

/** Misma base, endpoint directo: Neon lo expone quitando `-pooler` del host. */
function urlDirecta(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes('-pooler')) return null;
    u.hostname = u.hostname.replace('-pooler', '');
    // `pgbouncer=true` solo tiene sentido contra el pooler.
    u.searchParams.delete('pgbouncer');
    return u.toString();
  } catch {
    return null;
  }
}

function esperar(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function migrar(url) {
  execFileSync(
    process.execPath,
    [cliPrisma(), 'migrate', 'deploy', '--schema', schema],
    {
      stdio: 'inherit',
      env: url ? { ...process.env, DATABASE_URL: url } : process.env,
    },
  );
}

const INTENTOS_POR_URL = 3;
const ESPERA_MS = 15000;

function intentar(url, etiqueta) {
  for (let intento = 1; intento <= INTENTOS_POR_URL; intento++) {
    try {
      console.log(
        `[migrate] Aplicando migraciones contra ${etiqueta} (${hostDe(url || process.env.DATABASE_URL || '')}), intento ${intento}/${INTENTOS_POR_URL}...`,
      );
      migrar(url);
      console.log('[migrate] Migraciones aplicadas.');
      return true;
    } catch {
      if (intento < INTENTOS_POR_URL) {
        console.warn(
          `[migrate] Fallo el intento ${intento}. Puede ser un lock momentaneo de otro despliegue; se reintenta en ${ESPERA_MS / 1000}s.`,
        );
        esperar(ESPERA_MS);
      }
    }
  }
  return false;
}

const original = process.env.DATABASE_URL || '';
const directa = urlDirecta(original);

if (directa && intentar(directa, 'el endpoint directo')) {
  process.exit(0);
}

if (directa) {
  console.warn(
    '[migrate] El endpoint directo no funciono; se intenta con la URL original.',
  );
}

if (intentar(null, 'la URL configurada')) {
  process.exit(0);
}

console.error(
  '[migrate] No se pudieron aplicar las migraciones. El servicio no arranca para no quedar con la base a medias.',
);
process.exit(1);
