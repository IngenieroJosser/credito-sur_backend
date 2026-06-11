const { execFileSync } = require('node:child_process');

const migrationName = '20260611120000_fix_route_activation_bogota_day_unique';
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

  if (!status.includes(migrationName)) {
    console.log(`[migrate] ${migrationName} not reported by migrate status, continuing.`);
    return;
  }

  if (!/failed|P3018|failed migrations/i.test(status)) {
    console.log(`[migrate] ${migrationName} was not in a failed state, continuing.`);
    return;
  }

  console.log(`[migrate] Marking failed migration ${migrationName} as rolled back before deploy.`);
  run(
    'npx',
    ['prisma', 'migrate', 'resolve', '--rolled-back', migrationName, '--schema', schema],
    { stdio: 'inherit' },
  );
}

main();
