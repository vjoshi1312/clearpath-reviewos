import "server-only";
import postgres from "postgres";

// Server-only PostgreSQL access. DATABASE_URL must be the Supabase *transaction pooler*
// URL, which does not support prepared statements, hence `prepare: false`.
const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 });
}

export function getSql() {
  if (!globalForDb.__sql) globalForDb.__sql = createClient();
  return globalForDb.__sql;
}
