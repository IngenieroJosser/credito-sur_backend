const { spawnSync } = require('child_process');

const migrationName = '20260515103000_add_concurrency_unique_guards';

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    'prisma',
    'migrate',
    'resolve',
    '--rolled-back',
    migrationName,
    '--schema',
    'src/prisma/schema.prisma',
  ],
  { stdio: 'inherit' },
);

if (result.status === 0) {
  console.log(`[migrate] Marked ${migrationName} as rolled back.`);
} else {
  console.log(
    `[migrate] ${migrationName} was not in a failed state, continuing with migrate deploy.`,
  );
}
