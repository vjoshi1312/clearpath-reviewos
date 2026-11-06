// Applies db/schema.sql. Idempotent. Usage: npm run db:schema
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8"));
    const tables = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name in ('submissions', 'revisions', 'review_events')
      order by table_name`;
    console.log("Schema applied. Tables present:", tables.map((t) => t.table_name).join(", "));
  } catch (err) {
    console.error("Failed to apply schema:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
