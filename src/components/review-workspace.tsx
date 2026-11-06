"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, History, MessageSquareWarning } from "lucide-react";
import { approveSubmission, requestChanges, resubmitRevision } from "@/app/actions";
import { FindingsList } from "@/components/findings-list";
import { LocalTime } from "@/components/local-time";
import { SeverityBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CHANNEL_LABELS, EVENT_LABELS, highestSeverity, PRODUCT_LABELS } from "@/lib/formatting";
import { screenCopy } from "@/lib/screening";
import type { ActionResult } from "@/lib/errors";
import type { Finding, SubmissionDetail } from "@/lib/types";
import { approvalRequiresRationale } from "@/lib/workflow";
import { LIMITS, parseCopy, parseNote } from "@/lib/validation";

const fieldClass = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm aria-[invalid=true]:border-high";

const ROLE_LABELS = { marketing: "Marketing", compliance: "Compliance", system: "System" } as const;

/** Runs a mutation with a double-click guard and turns thrown errors into a message. */
function useMutation() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T> | null> {
    if (busy.current) return null;
    busy.current = true;
    setPending(true);
    try {
      const result = await fn();
      // On success, or when the status changed under us, re-read persisted state.
      if (result.ok || result.code === "conflict" || result.code === "not_found") router.refresh();
      return result;
    } catch {
      return {
        ok: false,
        code: "unavailable",
        message: "We couldn't reach the server, so this action may not have been saved. Refresh to check, then try again.",
      } as const;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { run, pending };
}

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-high">
      {message}
    </p>
  );
}

function RequestChangesDialog({ submissionId, open, onClose, onDone }: DialogProps) {
  const { run, pending } = useMutation();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();

  async function confirm() {
    setFormError(undefined);
    const checked = parseNote(note, "note");
    if (!checked.ok) {
      setError(checked.errors.note);
      return;
    }
    setError(undefined);
    const result = await run(() => requestChanges(submissionId, checked.data));
    if (!result) return;
    if (result.ok) {
      onDone("Changes requested. The marketer can now revise and resubmit.");
    } else {
      setError(result.fieldErrors?.note);
      setFormError(result.fieldErrors?.note ? undefined : result.message);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Request changes">
      <p className="mt-1 text-sm text-muted">The note is sent back with the submission and recorded in the history.</p>
      {formError && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-high">{formError}</div>}
      <label htmlFor="rc-note" className="mt-4 block text-sm font-medium">
        Reviewer note (required)
      </label>
      <textarea
        id="rc-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={5}
        aria-invalid={!!error}
        aria-describedby={error ? "rc-note-error" : undefined}
        className={`${fieldClass} mt-1`}
      />
      <ErrorText id="rc-note-error" message={error} />
      <p className="mt-1 text-xs text-muted">
        {LIMITS.note.min}-{LIMITS.note.max} characters.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={confirm} disabled={pending}>
          {pending ? "Saving…" : "Confirm Request Changes"}
        </Button>
      </div>
    </Dialog>
  );
}

function ApproveDialog({
  submissionId,
  open,
  onClose,
  onDone,
  findings,
}: DialogProps & { findings: Finding[] }) {
  const { run, pending } = useMutation();
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const required = approvalRequiresRationale(findings);

  async function confirm() {
    setFormError(undefined);
    const text = rationale.trim();
    if (required || text) {
      const checked = parseNote(text, "rationale");
      if (!checked.ok) {
        setError(
          required && !text
            ? `A rationale is required because the copy has high-severity flags (${LIMITS.note.min}-${LIMITS.note.max} characters).`
            : checked.errors.rationale,
        );
        return;
      }
    }
    setError(undefined);
    const result = await run(() => approveSubmission(submissionId, text));
    if (!result) return;
    if (result.ok) {
      onDone("Approved. This version is now final and read-only.");
    } else {
      setError(result.fieldErrors?.rationale);
      setFormError(result.fieldErrors?.rationale ? undefined : result.message);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Approve this version?">
      <p className="mt-1 text-sm text-muted">
        Approval is a human decision recorded against the exact version shown. Approved submissions cannot be reopened or edited in this demo.
      </p>
      {required && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-high">
          This version has high-severity flags that are unresolved. Enter a rationale acknowledging the flagged claim to approve.
        </div>
      )}
      {formError && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-high">{formError}</div>}
      <label htmlFor="ap-rationale" className="mt-4 block text-sm font-medium">
        {required ? "Reviewer rationale (required)" : "Reviewer note (optional)"}
      </label>
      <textarea
        id="ap-rationale"
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={4}
        aria-invalid={!!error}
        aria-describedby={error ? "ap-rationale-error" : undefined}
        className={`${fieldClass} mt-1`}
      />
      <ErrorText id="ap-rationale-error" message={error} />
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={confirm} disabled={pending}>
          {pending ? "Saving…" : "Confirm Approval"}
        </Button>
      </div>
    </Dialog>
  );
}

type DialogProps = {
  submissionId: string;
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
};

export function ReviewWorkspace({ detail }: { detail: SubmissionDetail }) {
  const { revisions, events } = detail;
  const latest = revisions[revisions.length - 1];
  const [selected, setSelected] = useState<number | null>(null); // null = latest
  const [dialog, setDialog] = useState<"changes" | "approve" | null>(null);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const viewed = selected === null ? latest : (revisions.find((r) => r.versionNumber === selected) ?? latest);
  const viewingLatest = viewed.id === latest.id;
  const severity = highestSeverity(latest.findings);

  const lastRequest = events.find((e) => e.eventType === "changes_requested");
  const approval = events.find((e) => e.eventType === "approved");

  function done(message: string) {
    setDialog(null);
    setEditing(false);
    setSelected(null);
    setNotice(message);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Queue
      </Link>

      <section aria-label="Summary" className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{detail.title}</h1>
          <StatusBadge status={detail.status} />
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
          <div className="flex gap-1">
            <dt className="sr-only">Product</dt>
            <dd>{PRODUCT_LABELS[detail.productType]}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Channel:</dt>
            <dd>{CHANNEL_LABELS[detail.channel]}</dd>
          </div>
          {detail.partnerName && (
            <div className="flex gap-1">
              <dt>Partner:</dt>
              <dd>{detail.partnerName}</dd>
            </div>
          )}
          <div className="flex gap-1">
            <dt>Created:</dt>
            <dd>
              <LocalTime iso={detail.createdAt} />
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>Current version:</dt>
            <dd>Version {latest.versionNumber}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt>Latest flags:</dt>
            <dd className="flex items-center gap-1.5">
              {severity ? (
                <>
                  {latest.findings.length} {latest.findings.length === 1 ? "flag" : "flags"}
                  <SeverityBadge severity={severity} />
                </>
              ) : (
                "No automated flags"
              )}
            </dd>
          </div>
        </dl>
      </section>

      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-approved">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Status-specific panels (latest version only) */}
      {viewingLatest && detail.status === "changes_requested" && !editing && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 font-medium text-medium">
            <MessageSquareWarning className="h-4 w-4" aria-hidden="true" />
            Reviewer requested changes
            {lastRequest?.versionNumber != null && <span className="text-sm font-normal">(on Version {lastRequest.versionNumber})</span>}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{lastRequest?.note ?? "No note was recorded."}</p>
          <div className="mt-3">
            <Button onClick={() => setEditing(true)}>Edit &amp; Resubmit</Button>
          </div>
        </section>
      )}

      {viewingLatest && detail.status === "approved" && (
        <section className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 font-medium text-approved">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Approved
            {approval?.versionNumber != null && <span className="text-sm font-normal">(Version {approval.versionNumber})</span>}
          </div>
          {approval?.note ? (
            <p className="mt-2 whitespace-pre-wrap text-sm">
              <span className="font-medium">Reviewer rationale: </span>
              {approval.note}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">No rationale recorded.</p>
          )}
          <p className="mt-2 text-xs text-muted">This approved version is final. No further workflow actions are available.</p>
        </section>
      )}

      {viewingLatest && detail.status === "needs_review" && (
        <section aria-label="Review actions" className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <span className="mr-auto text-sm text-muted">Awaiting a human reviewer&apos;s decision on Version {latest.versionNumber}.</span>
          <Button variant="secondary" onClick={() => setDialog("changes")}>
            Request Changes
          </Button>
          <Button onClick={() => setDialog("approve")}>Approve</Button>
        </section>
      )}

      {!viewingLatest && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-black/[0.04] px-4 py-3 text-sm">
          <span className="font-medium">Historical version — read-only</span>
          <span className="text-muted">
            Viewing Version {viewed.versionNumber} of {latest.versionNumber}. Workflow actions are hidden.
          </span>
          <Button variant="secondary" onClick={() => setSelected(null)}>
            Return to latest
          </Button>
        </div>
      )}

      {revisions.length > 1 && (
        <nav aria-label="Version history" className="flex flex-wrap items-center gap-2">
          <History className="h-4 w-4 text-muted" aria-hidden="true" />
          {revisions.map((r) => {
            const active = r.id === viewed.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r.id === latest.id ? null : r.versionNumber)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active ? "border-accent bg-accent text-white" : "border-border bg-surface hover:bg-black/5"
                }`}
              >
                Version {r.versionNumber}
              </button>
            );
          })}
        </nav>
      )}

      {editing && viewingLatest && detail.status === "changes_requested" ? (
        <Editor detail={detail} initial={latest.content} onCancel={() => setEditing(false)} onDone={done} lastNote={lastRequest?.note ?? null} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="copy-heading">
            <h2 id="copy-heading" className="mb-2 text-base font-semibold">
              Marketing copy · Version {viewed.versionNumber}
            </h2>
            <div className="whitespace-pre-wrap break-words rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed">
              {viewed.content}
            </div>
          </section>
          <section aria-labelledby="findings-heading">
            <h2 id="findings-heading" className="mb-2 text-base font-semibold">
              Advisory findings
              {!viewingLatest && <span className="ml-2 text-xs font-normal text-muted">(frozen scan, ruleset {viewed.rulesetVersion})</span>}
            </h2>
            <FindingsList findings={viewed.findings} />
          </section>
        </div>
      )}

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 text-base font-semibold">
          Activity history
        </h2>
        <ol className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{EVENT_LABELS[e.eventType]}</span>
                {e.versionNumber != null && <span className="rounded border border-border px-1.5 text-xs text-muted">Version {e.versionNumber}</span>}
                <span className="text-muted">by {ROLE_LABELS[e.actorRole]}</span>
                <span className="text-muted">
                  <LocalTime iso={e.createdAt} />
                </span>
              </div>
              {e.note && <p className="mt-2 whitespace-pre-wrap text-sm">{e.note}</p>}
            </li>
          ))}
        </ol>
      </section>

      <RequestChangesDialog submissionId={detail.id} open={dialog === "changes"} onClose={() => setDialog(null)} onDone={done} />
      <ApproveDialog
        submissionId={detail.id}
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        onDone={done}
        findings={latest.findings}
      />
    </main>
  );
}

function Editor({
  detail,
  initial,
  lastNote,
  onCancel,
  onDone,
}: {
  detail: SubmissionDetail;
  initial: string;
  lastNote: string | null;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const { run, pending } = useMutation();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [preview, setPreview] = useState<{ copy: string; findings: Finding[] } | null>(null);

  const previewCurrent = preview !== null && preview.copy === draft.trim();
  const previewStale = preview !== null && !previewCurrent;

  function check() {
    setFormError(undefined);
    const parsed = parseCopy(draft);
    if (!parsed.ok) {
      setError(parsed.errors.copy);
      setPreview(null);
      return;
    }
    setError(undefined);
    setPreview({
      copy: parsed.data,
      findings: screenCopy({
        productType: detail.productType,
        channel: detail.channel,
        partnerName: detail.partnerName,
        copy: parsed.data,
      }),
    });
  }

  async function resubmit() {
    setFormError(undefined);
    const parsed = parseCopy(draft);
    if (!parsed.ok) {
      setError(parsed.errors.copy);
      return;
    }
    setError(undefined);
    const result = await run(() => resubmitRevision(detail.id, parsed.data));
    if (!result) return;
    if (result.ok) {
      onDone(`Resubmitted as Version ${result.data.version}. The copy was rescanned and is back in the review queue.`);
    } else {
      setError(result.fieldErrors?.copy);
      setFormError(result.fieldErrors?.copy ? undefined : result.message);
    }
  }

  return (
    <section aria-labelledby="editor-heading" className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <h2 id="editor-heading" className="text-base font-semibold">
        Edit &amp; Resubmit
      </h2>
      <p className="text-sm text-muted">
        Product, channel, and partner are read-only. Resubmitting creates a new version and keeps earlier versions unchanged.
      </p>
      {lastNote && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm">
          <span className="font-medium">Reviewer note: </span>
          {lastNote}
        </p>
      )}
      {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-high">{formError}</div>}
      <div>
        <label htmlFor="revised-copy" className="mb-1 block text-sm font-medium">
          Advertising copy
        </label>
        <textarea
          id="revised-copy"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          aria-invalid={!!error}
          aria-describedby={error ? "revised-copy-error" : undefined}
          className={fieldClass}
        />
        <ErrorText id="revised-copy-error" message={error} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={check} disabled={pending}>
          Check Revised Copy
        </Button>
        <Button onClick={resubmit} disabled={pending}>
          {pending ? "Resubmitting…" : "Resubmit for Review"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
      {previewStale && (
        <p role="status" className="text-sm text-medium">
          Copy changed since last check. Run Check Revised Copy again to refresh the advisory scan.
        </p>
      )}
      {previewCurrent && (
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Advisory check results</h3>
          <FindingsList findings={preview.findings} />
        </div>
      )}
    </section>
  );
}
