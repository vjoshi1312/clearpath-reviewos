import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Checkpoint A skeleton: proves the deployed app can reach the database.
// Replaced by the Review Queue in Checkpoint B.
export default async function Home() {
  let dbStatus: string;
  try {
    const rows = await getSql()`select count(*)::int as n from submissions`;
    dbStatus = `Database connected. ${rows[0].n} submission(s) stored.`;
  } catch {
    dbStatus = "Database unavailable.";
  }
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">ClearPath ReviewOS</h1>
      <p className="text-sm text-muted">Marketing compliance review</p>
      <p className="mt-6 text-sm">{dbStatus}</p>
    </main>
  );
}
