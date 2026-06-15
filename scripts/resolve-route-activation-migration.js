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
  console.log('[migrate] Auto-resolve disabled. Production migrations are resolved manually or by explicit hotfix.');
}

main();
