import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let cached: DrizzleDb | null = null;

function getDb(): DrizzleDb {
  if (cached) return cached;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not set. Add it to .env (see .env.example) and restart the dev server.');
  }
  const client = createClient({ url, authToken });
  cached = drizzle(client, { schema });
  return cached;
}

// A lazy proxy so importing this module never throws — only using `db`
// (inside a request handler, where callers can catch it) does. Without
// this, a missing env var would crash the whole route module graph at
// import time instead of failing cleanly inside one request.
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
