const { spawnSync } = require('child_process');
const { Client } = require('pg');

const MIGRATION_NAME = 'add_registros_visitas_constraints';
const SCHEMA_PATH = 'src/prisma/schema.prisma';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[migrate-repair] DATABASE_URL is not set. Skipping repair.');
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=disable')
      ? false
      : { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const migrationsTable = await client.query(`
      SELECT to_regclass('public._prisma_migrations') AS table_name
    `);

    if (!migrationsTable.rows[0]?.table_name) {
      console.log('[migrate-repair] _prisma_migrations does not exist. Skipping repair.');
      return;
    }

    const migration = await client.query(
      `
        SELECT migration_name, finished_at, rolled_back_at, logs
        FROM "_prisma_migrations"
        WHERE migration_name = $1
        ORDER BY started_at DESC
        LIMIT 1
      `,
      [MIGRATION_NAME],
    );

    const row = migration.rows[0];
    const isFailed =
      row &&
      row.finished_at === null &&
      row.rolled_back_at === null &&
      typeof row.logs === 'string' &&
      row.logs.trim().length > 0;

    if (!isFailed) {
      console.log(`[migrate-repair] ${MIGRATION_NAME} is not in a failed state. Skipping repair.`);
      return;
    }

    console.log(`[migrate-repair] Marking failed migration ${MIGRATION_NAME} as rolled back.`);
    const result = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      [
        'prisma',
        'migrate',
        'resolve',
        '--rolled-back',
        MIGRATION_NAME,
        '--schema',
        SCHEMA_PATH,
      ],
      { stdio: 'inherit' },
    );

    if (result.status !== 0) {
      throw new Error(`prisma migrate resolve failed with exit code ${result.status}`);
    }

    console.log(`[migrate-repair] ${MIGRATION_NAME} marked as rolled back.`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[migrate-repair] Failed:', error?.message || error);
  process.exit(1);
});
