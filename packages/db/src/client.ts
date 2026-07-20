import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import * as schema from "./schema.js";

/** Real Postgres, for production. */
export function createPostgresDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzlePg(pool, { schema });
}

/** In-process, Postgres-wire-compatible — for tests and local dev with no installed database server. */
export function createPgliteDb(client: PGlite) {
  return drizzlePglite(client, { schema });
}

export type PostgresDatabase = ReturnType<typeof createPostgresDb>;
export type PgliteDatabase = ReturnType<typeof createPgliteDb>;
/** The repository layer is written against this union so it works unmodified against either driver. */
export type Database = PostgresDatabase | PgliteDatabase;
