import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infrastructure/database/schema/index.ts',
  out: './src/infrastructure/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:mgrw0rtzmt8jm3c8@2.24.85.100:1293/postgres',
  },
  verbose: true,
  strict: true,
});
