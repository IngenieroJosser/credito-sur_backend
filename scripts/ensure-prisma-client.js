const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Genera el cliente de Prisma, pero solo cuando hace falta.
 *
 * Antes se generaba dos veces en cada despliegue: una en `postinstall` y otra
 * al principio de `start:prod`. Medido en local, cada `prisma generate` tarda
 * ~32 s; en Render, con menos CPU, mas. Era medio minuto largo repetido sin
 * que nada hubiera cambiado entre una y otra.
 *
 * La segunda no estaba de adorno. Se agrego (commit 4b23c3f) porque en
 * produccion corrio un cliente viejo: pnpm decidio no reinstalar -el lockfile
 * no habia cambiado-, `postinstall` no se ejecuto, y el cliente se quedo sin
 * un campo que el esquema si tenia. El servidor arranco y fallo al usarlo.
 *
 * Aqui se conserva esa garantia sin pagarla dos veces: junto al cliente
 * generado se guarda el hash del esquema con el que se genero. Si el hash del
 * esquema actual coincide, el cliente esta al dia y no se hace nada; si no
 * coincide -o no hay cliente, o no hay marca- se genera. El caso que rompio
 * produccion (esquema nuevo, node_modules viejo) da hashes distintos y se
 * regenera igual que antes.
 *
 * Se invoca desde `postinstall` y desde `start:prod`: la primera deja la marca
 * y la segunda normalmente solo la comprueba.
 */

const ESQUEMA = path.join('src', 'prisma', 'schema.prisma');
const NOMBRE_MARCA = '.credisur-esquema.sha256';

/**
 * Ruta al CLI de Prisma, resuelta desde el propio paquete.
 *
 * Igual que en `migrate-deploy.js`, y por el mismo motivo: no se invoca a
 * traves de `npx` ni del gestor de paquetes, porque el arranque no puede
 * quedar a merced de una descarga.
 */
function cliPrisma() {
  const manifiesto = require.resolve('prisma/package.json');
  const { bin } = require('prisma/package.json');
  const entrada = typeof bin === 'string' ? bin : bin.prisma;
  return path.join(path.dirname(manifiesto), entrada);
}

/** Carpeta donde `prisma-client-js` deja el cliente generado. */
function carpetaGenerada() {
  const paquete = path.dirname(require.resolve('@prisma/client/package.json'));
  try {
    return path.dirname(
      require.resolve('.prisma/client/default', { paths: [paquete] }),
    );
  } catch {
    return null;
  }
}

function hashDelEsquema() {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(ESQUEMA))
    .digest('hex');
}

function generar() {
  execFileSync(
    process.execPath,
    [cliPrisma(), 'generate', '--schema', ESQUEMA],
    { stdio: 'inherit' },
  );
}

const hash = hashDelEsquema();
const antes = carpetaGenerada();
const marcaPrevia = antes && path.join(antes, NOMBRE_MARCA);

if (marcaPrevia && fs.existsSync(marcaPrevia)) {
  let guardado = '';
  try {
    guardado = fs.readFileSync(marcaPrevia, 'utf8').trim();
  } catch {
    /* si no se puede leer la marca, se genera igual */
  }
  if (guardado === hash) {
    console.log(
      '[prisma] El cliente ya corresponde a este esquema; no se regenera.',
    );
    process.exit(0);
  }
  console.log(
    '[prisma] El esquema cambio desde la ultima generacion; se regenera.',
  );
} else {
  console.log('[prisma] No hay cliente generado para este esquema; se genera.');
}

generar();

// La marca se escribe despues de generar y sobre la carpeta resultante: si
// `generate` falla, `execFileSync` lanza y no queda una marca mintiendo.
const despues = carpetaGenerada();
if (despues) {
  try {
    fs.writeFileSync(path.join(despues, NOMBRE_MARCA), hash + '\n');
  } catch (error) {
    // No es fatal: sin marca, el proximo arranque genera de nuevo. Se avisa
    // para que no parezca que la mejora no sirve.
    console.warn(
      '[prisma] No se pudo guardar la marca del esquema:',
      error.message,
    );
  }
} else {
  console.warn(
    '[prisma] No se encontro la carpeta del cliente generado; no se guarda la marca.',
  );
}
