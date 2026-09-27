import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Please set DATABASE_URL in your .env or .env.local file " +
      "(e.g., DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_db or your cloud database URL)."
  );
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

// Ensure non-breaking schema additions exist in the database without dropping data
let schemaInitPromise: Promise<void> | null = null;
export async function ensureSchema() {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      try {
        await pool.query(
          `ALTER TABLE posts ADD COLUMN IF NOT EXISTS external_url TEXT`
        );
      } catch (err) {
        console.warn("[db] ensureSchema notice:", err);
      }
    })();
  }
  return schemaInitPromise;
}

// Trigger in background once
ensureSchema().catch(() => {});

export const db = drizzle(pool);
