import 'dotenv/config';
import { defineConfig } from 'prisma/config';

declare const process: {
  env: Record<string, string | undefined>;
};

export default defineConfig({
  schema: 'src/prisma/schema.prisma',

  datasource: {
    url: process.env.DATABASE_URL,
  },

  migrations: {
    path: 'src/prisma/migrations',
  },
});
