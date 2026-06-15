const { execFileSync } = require('node:child_process');

const migrations = [
  {
    name: '20260611120000_fix_route_activation_bogota_day_unique',
    resolveOnGlobalFailure: false,
  },
  {
    name: '20260613165000_add_arqueo_caja',
    resolveOnGlobalFailure: true,
    resolveAlways: true,
  },
  // NOTA: 20260614113000_add_efecto_provisional eliminado de auto-resolve
  // El CREATE TYPE ahora es idempotente con bloque DO, por lo que no necesita
  // marcado automático como rolled-back. Si falla, se debe resolver manualmente.
];
const schema = 'src/prisma/schema.prisma';

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: options.stdio || 'pipe',
    encoding: 'utf8',
    env: process.env,
  });
}

function main() {
  let status = '';
  try {
    status = run('npx', ['prisma', 'migrate', 'status', '--schema', schema]);
  } catch (error) {
    status = `${error.stdout || ''}\n${error.stderr || ''}`;
  }

  const hasFailedMigration = /failed|P3018|P3009|failed migrations/i.test(status);

  for (const migration of migrations) {
    const migrationName = migration.name;
    const migrationReported = status.includes(migrationName);
    const shouldResolve =
      migration.resolveAlways ||
      (hasFailedMigration &&
        (migrationReported || migration.resolveOnGlobalFailure));

    if (!shouldResolve) {
      console.log(`[migrate] ${migrationName} not reported as failed by migrate status, continuing.`);
      continue;
    }

    console.log(`[migrate] Marking failed migration ${migrationName} as rolled back before deploy.`);
    try {
      run(
        'npx',
        ['prisma', 'migrate', 'resolve', '--rolled-back', migrationName, '--schema', schema],
        { stdio: 'inherit' },
      );
    } catch (error) {
      console.warn(
        `[migrate] Could not mark ${migrationName} as rolled back. Continuing so migrate deploy can report the current state.`,
      );
    }
  }
}

main();
