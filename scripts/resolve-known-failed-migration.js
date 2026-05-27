const { spawnSync } = require('child_process');

const migrationsToResolve = [
  { name: '20260515103000_add_concurrency_unique_guards', action: '--rolled-back' },
  { name: 'add_registros_visitas_table', action: '--applied' },
];

for (const { name: migrationName, action } of migrationsToResolve) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'prisma',
      'migrate',
      'resolve',
      action,
      migrationName,
      '--schema',
      'src/prisma/schema.prisma',
    ],
    { stdio: 'inherit' },
  );

  if (result.status === 0) {
    console.log(`[migrate] Marked ${migrationName} as ${action.replace('--', '')}.`);
  } else {
    console.log(
      `[migrate] ${migrationName} was not in a failed state, continuing with migrate deploy.`,
    );
  }
}
