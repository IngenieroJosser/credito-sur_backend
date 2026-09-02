const { execFileSync } = require('node:child_process');

const schema = 'src/prisma/schema.prisma';

/**
 * Migraciones que pueden quedar marcadas como FALLIDAS en producción y que es
 * seguro re-aplicar (su SQL es idempotente: usa ON CONFLICT DO NOTHING).
 *
 * Cuando una migración falla, Prisma bloquea TODOS los despliegues siguientes
 * hasta que alguien la resuelve a mano — y en Render no hay shell. Por eso este
 * script, que corre ANTES de `migrate deploy`, la marca como revertida para que
 * `migrate deploy` la vuelva a aplicar ya corregida.
 *
 * Solo actúa si la migración está realmente en estado fallido.
 */
const MIGRACIONES_AUTO_REPARABLES = ['20260901120000_permiso_importaciones'];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: options.stdio || 'pipe',
    encoding: 'utf8',
    env: process.env,
  });
}

/** Salida de `prisma migrate status`, aunque termine con código distinto de 0. */
function estadoMigraciones() {
  try {
    return run('pnpm', ['exec', 'prisma', 'migrate', 'status', '--schema', schema]);
  } catch (error) {
    return `${error.stdout || ''}\n${error.stderr || ''}`;
  }
}

function main() {
  let estado = '';
  try {
    estado = estadoMigraciones();
  } catch {
    console.log('[migrate] No se pudo consultar el estado de migraciones; se continúa.');
    return;
  }

  for (const nombre of MIGRACIONES_AUTO_REPARABLES) {
    const mencionada = estado.includes(nombre);
    const hayFallo = /failed|fallida|failed to apply/i.test(estado);

    if (!mencionada || !hayFallo) continue;

    try {
      run('pnpm', ['exec', 'prisma', 'migrate', 'resolve', '--rolled-back', nombre, '--schema', schema]);
      console.log(
        `[migrate] '${nombre}' estaba fallida: se marcó como revertida para re-aplicarla corregida.`,
      );
    } catch (error) {
      // No estaba en estado fallido (o ya se resolvió). No bloqueamos el arranque.
      console.log(`[migrate] '${nombre}' no requirió resolución.`);
    }
  }
}

main();
