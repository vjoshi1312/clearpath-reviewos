import { SeverityBadge } from "@/components/status-badge";
import { ADVISORY_NOTICE, type Finding } from "@/lib/types";

export function AdvisoryNotice() {
  return <p className="text-xs leading-relaxed text-muted">{ADVISORY_NOTICE}</p>;
}

/** Findings cards (or a neutral empty state) followed by the required advisory notice. */
export function FindingsList({ findings }: { findings: Finding[] }) {
  return (
    <div className="space-y-3">
      {findings.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-medium">No automated flags found; human review still required</p>
          <p className="mt-1 text-sm text-muted">
            The rule set is small and illustrative. A clean scan does not mean the copy is compliant.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {findings.map((f) => (
            <li key={f.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={f.severity} />
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <span className="rounded border border-border px-1.5 text-xs text-muted">{f.ruleId}</span>
                {f.ruleId === "R5" && <span className="text-xs text-muted">Contextual review prompt</span>}
              </div>
              {f.evidence && (
                <blockquote className="mt-3 break-words rounded-lg border-l-4 border-border bg-black/[0.03] px-3 py-2 text-sm italic">
                  &ldquo;{f.evidence}&rdquo;
                </blockquote>
              )}
              <p className="mt-3 text-sm">{f.explanation}</p>
              <p className="mt-2 text-sm">
                <span className="font-medium">Suggested reviewer action: </span>
                {f.suggestedAction}
              </p>
            </li>
          ))}
        </ul>
      )}
      <AdvisoryNotice />
    </div>
  );
}
