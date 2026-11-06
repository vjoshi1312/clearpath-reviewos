// Opt-in integration test against the real database: `npm run test:db`.
// It creates its own records (titles prefixed "ZZ_TEST") and deletes them afterwards.
// Skipped in normal `npm test` and in CI, which have no database.
import { config } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";

const enabled = process.env.RUN_DB_TESTS === "1";
if (enabled) config({ path: ".env.local", quiet: true });

describe.skipIf(!enabled)("submission workflow (database)", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    const { getSql } = await import("../src/lib/db");
    const sql = getSql();
    for (const id of createdIds) {
      await sql`delete from review_events where submission_id = ${id}`;
      await sql`delete from revisions where submission_id = ${id}`;
      await sql`delete from submissions where id = ${id}`;
    }
    await sql.end();
  });

  async function create(copy: string, channel: "email" | "affiliate" = "email") {
    const { createSubmissionRecord } = await import("../src/lib/queries");
    const id = await createSubmissionRecord({
      title: "ZZ_TEST workflow",
      productType: "credit_card",
      channel,
      partnerName: channel === "affiliate" ? "ZZ Test Partner" : null,
      copy,
    });
    createdIds.push(id);
    return id;
  }

  it("runs submit -> request changes -> resubmit -> approve with versions and events", async () => {
    const q = await import("../src/lib/queries");
    const id = await create("Guaranteed approval. No credit check required.");

    let d = (await q.getSubmissionDetail(id))!;
    expect(d.status).toBe("needs_review");
    expect(d.revisions).toHaveLength(1);
    expect(d.revisions[0].findings.map((f) => f.ruleId)).toEqual(["R1", "R2"]);
    expect(d.revisions[0].rulesetVersion).toBe("v1");
    expect(d.events.map((e) => e.eventType)).toEqual(["submitted"]);

    // Cannot resubmit unless changes were requested.
    await expect(q.resubmitRecord(id, "Some new copy that is long enough.")).rejects.toMatchObject({ code: "conflict" });

    await q.requestChangesRecord(id, "Remove the guarantee and the credit-check claim.");
    d = (await q.getSubmissionDetail(id))!;
    expect(d.status).toBe("changes_requested");
    expect(d.events[0]).toMatchObject({ eventType: "changes_requested", actorRole: "compliance", versionNumber: 1 });
    expect(d.events[0].note).toMatch(/Remove the guarantee/);

    // A second request is rejected (stale status).
    await expect(q.requestChangesRecord(id, "Another note that is long enough.")).rejects.toMatchObject({ code: "conflict" });

    const v = await q.resubmitRecord(id, "Apply today. Approval is subject to eligibility.");
    expect(v).toBe(2);
    d = (await q.getSubmissionDetail(id))!;
    expect(d.status).toBe("needs_review");
    expect(d.revisions.map((r) => r.versionNumber)).toEqual([1, 2]);
    expect(d.revisions[0].content).toBe("Guaranteed approval. No credit check required."); // v1 untouched
    expect(d.revisions[0].findings).toHaveLength(2);
    expect(d.revisions[1].findings).toEqual([]);
    expect(d.events[0]).toMatchObject({ eventType: "resubmitted", actorRole: "marketing", versionNumber: 2 });

    await q.approveRecord(id, null); // v2 has no high findings, so no rationale needed
    d = (await q.getSubmissionDetail(id))!;
    expect(d.status).toBe("approved");
    expect(d.events[0]).toMatchObject({ eventType: "approved", versionNumber: 2 });

    // Terminal: every further mutation is rejected.
    await expect(q.approveRecord(id, null)).rejects.toMatchObject({ code: "conflict" });
    await expect(q.requestChangesRecord(id, "Trying to modify after approval.")).rejects.toMatchObject({ code: "conflict" });
    await expect(q.resubmitRecord(id, "Trying to edit after approval ok.")).rejects.toMatchObject({ code: "conflict" });
    d = (await q.getSubmissionDetail(id))!;
    expect(d.status).toBe("approved");
    expect(d.revisions).toHaveLength(2);
  });

  it("requires a rationale to approve copy with a high-severity finding", async () => {
    const q = await import("../src/lib/queries");
    const id = await create("Guaranteed approval for everyone.");
    await expect(q.approveRecord(id, null)).rejects.toMatchObject({ code: "validation" });
    await expect(q.approveRecord(id, "too short")).rejects.toMatchObject({ code: "validation" });
    expect((await q.getSubmissionDetail(id))!.status).toBe("needs_review");

    await q.approveRecord(id, "Reviewed the claim with legal; substantiation on file.");
    const d = (await q.getSubmissionDetail(id))!;
    expect(d.status).toBe("approved");
    expect(d.events[0].note).toMatch(/substantiation/);
  });

  it("serializes concurrent decisions so only one succeeds", async () => {
    const q = await import("../src/lib/queries");
    const id = await create("A perfectly ordinary piece of ad copy.");
    const results = await Promise.allSettled([
      q.approveRecord(id, null),
      q.requestChangesRecord(id, "Please rework this copy before approval."),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const d = (await q.getSubmissionDetail(id))!;
    // Exactly one decision event exists beyond `submitted`.
    expect(d.events).toHaveLength(2);
  });

  it("rejects unknown and malformed ids", async () => {
    const q = await import("../src/lib/queries");
    expect(await q.getSubmissionDetail("not-a-uuid")).toBeNull();
    expect(await q.getSubmissionDetail("00000000-0000-4000-8000-000000000000")).toBeNull();
    await expect(q.approveRecord("00000000-0000-4000-8000-000000000000", null)).rejects.toMatchObject({ code: "not_found" });
  });

  it("includes created submissions in the queue with latest-revision findings", async () => {
    const q = await import("../src/lib/queries");
    const id = await create("Pay only $99/month.");
    const row = (await q.getQueue()).find((r) => r.id === id)!;
    expect(row.status).toBe("needs_review");
    expect(row.latestVersion).toBe(1);
    expect(row.findings.map((f) => f.ruleId)).toEqual(["R3"]);
  });
});
