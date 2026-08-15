import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:mgrw0rtzmt8jm3c8@2.24.85.100:1293/postgres';

const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;

export async function closeDatabase(): Promise<void> {
  await queryClient.end();
}
