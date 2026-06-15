const { execFileSync } = require('node:child_process');

const schema = 'src/prisma/schema.prisma';

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: options.stdio || 'pipe',
    encoding: 'utf8',
    env: process.env,
  });
}

function main() {
  const migrationName = '20260614113000_add_efecto_provisional';

  console.log(`[migrate] Resolviendo migración fallida puntual: ${migrationName}`);

  try {
    run(
      'npx',
      [
        'prisma',
        'migrate',
        'resolve',
        '--rolled-back',
        migrationName,
        '--schema',
        schema,
      ],
      { stdio: 'inherit' },
    );

    console.log(`[migrate] ${migrationName} marcada como rolled back.`);
  } catch (error) {
    console.warn(
      `[migrate] No se pudo marcar ${migrationName} como rolled back. Continuando para que migrate deploy reporte el estado actual.`,
    );
  }
}

main();
