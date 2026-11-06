import "server-only";
import type postgres from "postgres";
import { getSql } from "./db";
import { AppError } from "./errors";
import { sortQueue, STATUS_LABELS } from "./formatting";
import { screenCopy } from "./screening";
import {
  RULESET_VERSION,
  type ActorRole,
  type Channel,
  type EventType,
  type Finding,
  type ProductType,
  type QueueRow,
  type ReviewEvent,
  type Revision,
  type Status,
  type SubmissionDetail,
} from "./types";
import { type SubmissionInput, isUuid, LIMITS, parseNote } from "./validation";
import { approvalRequiresRationale, canTransition, transitionTarget, type WorkflowAction } from "./workflow";

type Sql = postgres.Sql | postgres.TransactionSql;
type Json = postgres.JSONValue;

const iso = (d: Date | string) => new Date(d).toISOString();
const asFindings = (v: unknown): Finding[] => (Array.isArray(v) ? (v as Finding[]) : []);
const json = (sql: Sql, findings: Finding[]) => sql.json(findings as unknown as Json);

// ---------- reads ----------

type QueueDbRow = {
  id: string;
  title: string;
  product_type: ProductType;
  channel: Channel;
  partner_name: string | null;
  status: Status;
  created_at: Date;
  updated_at: Date;
  version_number: number;
  findings: unknown;
};

/** Every submission with its latest revision's findings, in default queue order. */
export async function getQueue(): Promise<QueueRow[]> {
  const rows = await getSql()<QueueDbRow[]>`
    select s.id, s.title, s.product_type, s.channel, s.partner_name, s.status,
           s.created_at, s.updated_at, r.version_number, r.findings
    from submissions s
    join lateral (
      select version_number, findings
      from revisions
      where submission_id = s.id
      order by version_number desc
      limit 1
    ) r on true`;
  return sortQueue(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      productType: r.product_type,
      channel: r.channel,
      partnerName: r.partner_name,
      status: r.status,
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
      latestVersion: r.version_number,
      findings: asFindings(r.findings),
    })),
  );
}

/** Returns null for an invalid or unknown id. */
export async function getSubmissionDetail(id: string): Promise<SubmissionDetail | null> {
  if (!isUuid(id)) return null;
  const sql = getSql();
  const [s] = await sql<
    {
      id: string;
      title: string;
      product_type: ProductType;
      channel: Channel;
      partner_name: string | null;
      status: Status;
      created_at: Date;
      updated_at: Date;
    }[]
  >`select id, title, product_type, channel, partner_name, status, created_at, updated_at
    from submissions where id = ${id}`;
  if (!s) return null;

  const revisions = await sql<
    { id: string; version_number: number; content: string; findings: unknown; ruleset_version: string; created_at: Date }[]
  >`select id, version_number, content, findings, ruleset_version, created_at
    from revisions where submission_id = ${id} order by version_number asc`;

  const events = await sql<
    {
      id: string;
      revision_id: string | null;
      version_number: number | null;
      event_type: EventType;
      actor_role: ActorRole;
      note: string | null;
      created_at: Date;
    }[]
  >`select e.id, e.revision_id, r.version_number, e.event_type, e.actor_role, e.note, e.created_at
    from review_events e
    left join revisions r on r.id = e.revision_id
    where e.submission_id = ${id}
    order by e.created_at desc, e.id desc`;

  return {
    id: s.id,
    title: s.title,
    productType: s.product_type,
    channel: s.channel,
    partnerName: s.partner_name,
    status: s.status,
    createdAt: iso(s.created_at),
    updatedAt: iso(s.updated_at),
    revisions: revisions.map(
      (r): Revision => ({
        id: r.id,
        versionNumber: r.version_number,
        content: r.content,
        findings: asFindings(r.findings),
        rulesetVersion: r.ruleset_version,
        createdAt: iso(r.created_at),
      }),
    ),
    events: events.map(
      (e): ReviewEvent => ({
        id: e.id,
        revisionId: e.revision_id,
        versionNumber: e.version_number,
        eventType: e.event_type,
        actorRole: e.actor_role,
        note: e.note,
        createdAt: iso(e.created_at),
      }),
    ),
  };
}

// ---------- writes (each runs in one transaction) ----------

type Locked = {
  id: string;
  status: Status;
  product_type: ProductType;
  channel: Channel;
  partner_name: string | null;
};

/** Locks the submission row for the rest of the transaction so decisions serialize. */
async function lockSubmission(tx: Sql, id: string): Promise<Locked> {
  if (!isUuid(id)) throw new AppError("not_found", "Submission not found.");
  const [s] = await tx<Locked[]>`
    select id, status, product_type, channel, partner_name
    from submissions where id = ${id} for update`;
  if (!s) throw new AppError("not_found", "Submission not found.");
  return s;
}

function conflict(status: Status, action: WorkflowAction): AppError {
  if (status === "approved") {
    return new AppError("conflict", "This submission is already approved and can no longer be changed.");
  }
  const what = action === "resubmit" ? "is not waiting for changes" : "is not waiting for review";
  return new AppError(
    "conflict",
    `This submission ${what} (current status: ${STATUS_LABELS[status]}). Its status changed elsewhere, so refresh to see the latest state.`,
  );
}

async function latestRevision(tx: Sql, submissionId: string) {
  const [r] = await tx<{ id: string; version_number: number; findings: unknown }[]>`
    select id, version_number, findings from revisions
    where submission_id = ${submissionId}
    order by version_number desc limit 1`;
  if (!r) throw new AppError("conflict", "This submission has no revisions.");
  return r;
}

/** Inserts submission, revision 1, and a `submitted` event atomically. `input` must already be validated. */
export async function createSubmissionRecord(input: SubmissionInput): Promise<string> {
  const findings = screenCopy({
    productType: input.productType,
    channel: input.channel,
    partnerName: input.partnerName,
    copy: input.copy,
  });
  return getSql().begin(async (tx) => {
    const [s] = await tx<{ id: string }[]>`
      insert into submissions (title, product_type, channel, partner_name, status)
      values (${input.title}, ${input.productType}, ${input.channel}, ${input.partnerName}, 'needs_review')
      returning id`;
    const [r] = await tx<{ id: string }[]>`
      insert into revisions (submission_id, version_number, content, findings, ruleset_version)
      values (${s.id}, 1, ${input.copy}, ${json(tx, findings)}, ${RULESET_VERSION})
      returning id`;
    await tx`
      insert into review_events (submission_id, revision_id, event_type, actor_role)
      values (${s.id}, ${r.id}, 'submitted', 'marketing')`;
    return s.id;
  });
}

/** needs_review -> changes_requested. The event points at the revision that was reviewed. */
export async function requestChangesRecord(submissionId: string, note: string): Promise<void> {
  await getSql().begin(async (tx) => {
    const s = await lockSubmission(tx, submissionId);
    if (!canTransition(s.status, "request_changes")) throw conflict(s.status, "request_changes");
    const rev = await latestRevision(tx, s.id);
    const { to, event } = transitionTarget("request_changes");
    await tx`
      insert into review_events (submission_id, revision_id, event_type, actor_role, note)
      values (${s.id}, ${rev.id}, ${event}, 'compliance', ${note})`;
    await tx`update submissions set status = ${to}, updated_at = now() where id = ${s.id}`;
  });
}

/** changes_requested -> needs_review with a new immutable revision (max version + 1) and a fresh scan. */
export async function resubmitRecord(submissionId: string, copy: string): Promise<number> {
  return getSql().begin(async (tx) => {
    const s = await lockSubmission(tx, submissionId);
    if (!canTransition(s.status, "resubmit")) throw conflict(s.status, "resubmit");
    const findings = screenCopy({
      productType: s.product_type,
      channel: s.channel,
      partnerName: s.partner_name,
      copy,
    });
    const [{ next }] = await tx<{ next: number }[]>`
      select coalesce(max(version_number), 0) + 1 as next from revisions where submission_id = ${s.id}`;
    const [r] = await tx<{ id: string }[]>`
      insert into revisions (submission_id, version_number, content, findings, ruleset_version)
      values (${s.id}, ${next}, ${copy}, ${json(tx, findings)}, ${RULESET_VERSION})
      returning id`;
    const { to, event } = transitionTarget("resubmit");
    await tx`
      insert into review_events (submission_id, revision_id, event_type, actor_role)
      values (${s.id}, ${r.id}, ${event}, 'marketing')`;
    await tx`update submissions set status = ${to}, updated_at = now() where id = ${s.id}`;
    return next;
  });
}

/**
 * needs_review -> approved. If the revision being approved has any high-severity finding,
 * a rationale (10-1,000 chars) is mandatory. `rationale` is the trimmed text or null.
 */
export async function approveRecord(submissionId: string, rationale: string | null): Promise<void> {
  await getSql().begin(async (tx) => {
    const s = await lockSubmission(tx, submissionId);
    if (!canTransition(s.status, "approve")) throw conflict(s.status, "approve");
    const rev = await latestRevision(tx, s.id);
    const needsRationale = approvalRequiresRationale(asFindings(rev.findings));
    if (needsRationale && !rationale) {
      throw new AppError(
        "validation",
        "A rationale is required to approve copy with unresolved high-severity flags.",
        { rationale: `Enter a rationale (${LIMITS.note.min}-${LIMITS.note.max} characters) acknowledging the flagged claim.` },
      );
    }
    if (rationale) {
      const checked = parseNote(rationale, "rationale");
      if (!checked.ok) throw new AppError("validation", "Please fix the rationale.", checked.errors);
    }
    const { to, event } = transitionTarget("approve");
    await tx`
      insert into review_events (submission_id, revision_id, event_type, actor_role, note)
      values (${s.id}, ${rev.id}, ${event}, 'compliance', ${rationale})`;
    await tx`update submissions set status = ${to}, updated_at = now() where id = ${s.id}`;
  });
}
