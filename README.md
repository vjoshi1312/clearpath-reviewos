# ClearPath ReviewOS

**Live demo:** https://clearpath-reviewos.vercel.app

A text-only marketing-compliance review app for **ClearPath Financial**, a *fictional* consumer-finance company (personal loans, credit cards, mortgage prequalification). It replaces the Excel-and-email approval loop with one place to submit ad copy, see what needs review, record decisions, and keep the exact copy that was reviewed.

> **Demo only.** All campaigns, partners, offers, and notes are fictional. There is no authentication, so anyone with the URL can use and change the demo. Never enter real customer or company content. This is **not** a production compliance determination or legal advice.

## Problem and users

ClearPath's compliance team tracks advertising approvals in Excel and email, which hides status, loses versions, and makes revision rounds slow.

- **Marketer:** writes copy, optionally runs an advisory check before submitting, revises when changes are requested.
- **Compliance reviewer:** sees the queue, reads findings, requests changes or approves.

**Workflow:** New Submission → optional *Check Copy* → *Submit for Review* → reviewer *Request Changes* or *Approve* → marketer *Edit & Resubmit* (new version) → reviewer decides again. Approved is final.

**Rationale:** We reduced rework by exposing checks before submission, consolidated review/decision tracking, and preserved the exact copy approved. We avoided a false compliance pass/fail and kept human review mandatory.

## Screens (exactly three routes)

| Route | Purpose |
|---|---|
| `/` | Review Queue: status counts, search, status filter, flags, age |
| `/submissions/new` | New Submission with advisory *Check Copy* |
| `/submissions/[id]` | Review Workspace: copy, findings, decisions, in-place revision, version selector, activity history |

Statuses: `needs_review`, `changes_requested`, `approved`.

## Advisory screening (five rules, ruleset `v1`)

Deterministic, pure TypeScript in `src/lib/screening.ts`; the same code runs in the browser preview and authoritatively on the server at submit/resubmit. Results are stored as a snapshot on each revision.

| Rule | Applies to | Severity | Flags |
|---|---|---|---|
| R1 Approval promises | all | high | "guaranteed approval", "everyone qualifies", "100% approval" … (negations like "Approval is not guaranteed" are not flagged) |
| R2 Credit-check/score claims | all | medium | "no credit check", "won't affect your credit score" … |
| R3 Credit terms | all | medium | "$99/month", "4.99% APR", "as low as … APR" |
| R4 Mortgage prequalification vs approval | mortgage only | high | "pre-approved", "you're approved", "instant mortgage approval" (R4 wins over R1 for the same issue) |
| R5 Possible endorsement without disclosure | affiliate only | medium | endorsement phrase ("I recommend", "my favorite") with no recognizable disclosure keyword. A contextual prompt only. |

**Limitations.** These are small, illustrative phrase rules, not a Reg Z / FTC / CFPB engine. A finding means "a human should verify", not "this violates a rule". No findings does not mean the copy is compliant. Keywords prove neither the presence nor the adequacy of a disclosure. No legal citations, rate lookups, or risk scores are generated. Findings never block submission; only a human approves. High-severity findings require a written rationale to approve.

## Architecture

- Next.js (App Router) + TypeScript + Tailwind CSS; deployed on Vercel.
- Supabase PostgreSQL, accessed **only on the server** with `postgres` (postgres.js) through the transaction pooler (`prepare: false`). No ORM and no browser DB client.
- Server Actions (`src/app/actions.ts`) validate with Zod and call transactional functions in `src/lib/queries.ts`. Each submit/resubmit/decision runs in one transaction with `SELECT … FOR UPDATE` on the submission row, so stale or concurrent decisions are rejected and version numbers cannot duplicate.
- Revisions are immutable; the current version is the highest `version_number`. Decision events reference the exact revision reviewed.
- Pages are `force-dynamic`, so mutations are never statically cached.

Three tables (`db/schema.sql`): `submissions`, `revisions`, `review_events`, with CHECK constraints, foreign keys, and the three specified indexes.

```
src/app/            routes + server actions
src/components/     queue, form, workspace, findings, small UI primitives
src/lib/            db, queries, screening, validation, workflow, formatting, types
db/schema.sql       schema
scripts/            apply-schema, seed (+ seed-data)
tests/              Vitest unit tests + opt-in DB integration test
```

## Local setup

Requires Node 20.19+.

```bash
npm install
cp .env.example .env.local     # then set DATABASE_URL (server-only; never commit it)
npm run db:schema              # applies db/schema.sql (idempotent)
npm run seed                   # loads/restores six fictional sample campaigns
npm run dev                    # http://localhost:3000
```

`DATABASE_URL` is the only variable: the Supabase **Transaction pooler** connection string (port 6543).

### Restoring demo data

`npm run seed` is idempotent. It re-creates only the six known sample submissions (fixed IDs) with relative timestamps and a consistent revision/event history, and it never touches records created by others. Run it any time a demo has changed the samples.

### Tests

```bash
npm test             # Vitest: screening rules (incl. negation cases), validation, transitions, queue helpers
npm run test:db      # opt-in: transaction/workflow integration test against DATABASE_URL (creates and deletes its own ZZ_TEST rows)
npm run lint && npm run typecheck && npm run build
```

CI (`.github/workflows/ci.yml`) runs lint, tests, typecheck, and build with no secrets and no database.

### Deploying (Vercel)

Set `DATABASE_URL` as a secret environment variable for Production, then `vercel deploy --prod`.

## Assumptions (not company facts)

- The most tractable bottlenecks are repeated copy problems, missing status visibility, and revision exchanges.
- The first useful slice is English, text-based advertising content.
- Humans make every approval decision; automated checks only flag items to verify.
- A complete submission-to-decision loop matters more than exhaustive rules.

## Out of scope

Authentication/roles, legal escalation, risk scores, AI/LLM use, claims library or policy editor, email/Slack integrations, uploads/OCR/URL crawling, publishing, charts, assignments, notifications, bulk actions, audit hash chains, billing, multi-tenancy, reopening approved items, and real-time collaboration.

## Metrics to validate (not measured here)

Time to first decision, number of revision rounds per campaign, and time to approval. This demo makes no throughput-improvement claim.

## Honest notes

Actual policies, rates, advertising disclosures, and applicable rules would need specialist verification and integration with the company's real processes. Demo actor labels (`marketing`, `compliance`, `system`) are conceptual; the app has no accounts.
