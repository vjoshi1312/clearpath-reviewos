// Idempotent demo-data restore. Usage: npm run seed
//
// Re-creates ONLY the six known sample submissions (fixed IDs) with timestamps relative
// to "now" and an event/revision history consistent with each status. Records created by
// other users are never touched. Safe to run repeatedly; also resets sample records that
// someone has approved or modified during a demo.
import { config } from "dotenv";
import postgres from "postgres";
import { screenCopy } from "../src/lib/screening";
import { RULESET_VERSION, type Finding } from "../src/lib/types";
import { SEED_CAMPAIGNS } from "./seed-data";

config({ path: ".env.local", quiet: true });

const HOUR = 3_600_000;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }

  // Verify the real screening engine produces the documented findings before writing anything.
  const prepared = SEED_CAMPAIGNS.map((c) => {
    const findings = screenCopy({
      productType: c.productType,
      channel: c.channel,
      partnerName: c.partnerName,
      copy: c.copy,
    });
    const actual = findings.map((f) => f.ruleId).sort().join(",");
    const expected = [...c.expectedRules].sort().join(",");
    if (actual !== expected) {
      throw new Error(`Seed "${c.title}": expected rules [${expected}] but screening returned [${actual}]`);
    }
    return { c, findings };
  });

  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  const now = Date.now();
  try {
    for (const { c, findings } of prepared) {
      await sql.begin(async (tx) => {
        await tx`delete from review_events where submission_id = ${c.id}`;
        await tx`delete from revisions where submission_id = ${c.id}`;
        await tx`delete from submissions where id = ${c.id}`;

        const submittedAt = new Date(now - c.hoursAgoSubmitted * HOUR);
        const decidedAt = c.hoursAgoDecided !== undefined ? new Date(now - c.hoursAgoDecided * HOUR) : null;
        const updatedAt = decidedAt ?? submittedAt;

        await tx`
          insert into submissions (id, title, product_type, channel, partner_name, status, created_at, updated_at)
          values (${c.id}, ${c.title}, ${c.productType}, ${c.channel}, ${c.partnerName}, ${c.status}, ${submittedAt}, ${updatedAt})`;
        const [rev] = await tx<{ id: string }[]>`
          insert into revisions (submission_id, version_number, content, findings, ruleset_version, created_at)
          values (${c.id}, 1, ${c.copy}, ${tx.json(findings as unknown as postgres.JSONValue)}, ${RULESET_VERSION}, ${submittedAt})
          returning id`;
        await tx`
          insert into review_events (submission_id, revision_id, event_type, actor_role, created_at)
          values (${c.id}, ${rev.id}, 'submitted', 'marketing', ${submittedAt})`;

        if (c.status !== "needs_review" && decidedAt) {
          const eventType = c.status === "approved" ? "approved" : "changes_requested";
          await tx`
            insert into review_events (submission_id, revision_id, event_type, actor_role, note, created_at)
            values (${c.id}, ${rev.id}, ${eventType}, 'compliance', ${c.decisionNote ?? null}, ${decidedAt})`;
        }
      });
      const summary = (findings as Finding[]).map((f) => f.ruleId).join(", ") || "no flags";
      console.log(`Seeded: ${c.title} [${c.status}] (${summary})`);
    }
    console.log(`Done. ${prepared.length} sample submissions restored.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
