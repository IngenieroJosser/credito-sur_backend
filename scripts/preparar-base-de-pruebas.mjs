/**
 * Prepara `credito_sur_test`, la base contra la que corren las pruebas de integración.
 *
 *     node scripts/preparar-base-de-pruebas.mjs
 *
 * Qué hace: crea la base si no existe y le aplica las migraciones. Es idempotente, así que
 * se puede volver a correr sin pensarlo.
 *
 * Por qué una base aparte y no la de desarrollo: las pruebas de integración escriben y
 * borran filas. Con una sola base, una prueba a medias deja basura en los datos con los que
 * se trabaja todos los días, y un `deleteMany` mal escrito se lleva algo real. Por eso el
 * nombre va fijo aquí y las pruebas, además, se niegan a arrancar si la URL que arman no
 * termina en `_test`.
 *
 * Si no hay Postgres a mano, las pruebas de integración se saltan solas: el resto de la
 * suite sigue sirviendo sin necesidad de tener una base levantada.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_DE_PRUEBAS = 'credito_sur_test';

const urlDeDesarrollo = () => {
  const env = readFileSync(join(raiz, '.env'), 'utf8');
  const url = env.match(/postgresql:\/\/[^\s"'\r\n]*/)?.[0];
  if (!url) throw new Error('No se encontró una URL de Postgres en .env');
  return url;
};

const main = async () => {
  const desarrollo = urlDeDesarrollo();
  const pruebas = desarrollo.replace(
    /\/[^/?]+(\?|$)/,
    `/${BASE_DE_PRUEBAS}$1`,
  );
  if (!new RegExp(`/${BASE_DE_PRUEBAS}(\\?|$)`).test(pruebas)) {
    throw new Error('No se pudo armar la URL de la base de pruebas; se aborta.');
  }

  // Para CREATE DATABASE hay que estar conectado a otra base.
  const administracion = desarrollo.replace(/\/[^/?]+(\?|$)/, '/postgres$1');
  const cliente = new pg.Client({ connectionString: administracion });
  await cliente.connect();
  const existe = await cliente.query(
    'select 1 from pg_database where datname = $1',
    [BASE_DE_PRUEBAS],
  );
  if (existe.rowCount === 0) {
    await cliente.query(`CREATE DATABASE ${BASE_DE_PRUEBAS}`);
    console.log(`Creada la base ${BASE_DE_PRUEBAS}.`);
  } else {
    console.log(`La base ${BASE_DE_PRUEBAS} ya existía.`);
  }
  await cliente.end();

  // Como cadena y no con `execFileSync(..., {shell:true})`: en Windows npx necesita shell,
  // y pasar argumentos sueltos con shell activo dispara un aviso de deprecacion de Node.
  execSync('npx prisma migrate deploy --schema src/prisma/schema.prisma', {
    cwd: raiz,
    env: { ...process.env, DATABASE_URL: pruebas },
    stdio: 'inherit',
  });
  console.log('\nBase de pruebas lista.');
};

main().catch((error) => {
  console.error(`No se pudo preparar la base de pruebas: ${error.message}`);
  process.exit(1);
});
