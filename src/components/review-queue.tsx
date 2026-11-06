"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { SeverityBadge, StatusBadge } from "@/components/status-badge";
import {
  ageBasis,
  CHANNEL_LABELS,
  countByStatus,
  filterQueue,
  formatAge,
  highestSeverity,
  PRODUCT_LABELS,
  STATUS_LABELS,
} from "@/lib/formatting";
import type { QueueRow, Status } from "@/lib/types";

const CARDS: Status[] = ["needs_review", "changes_requested", "approved"];
const CARD_STYLES: Record<Status, string> = {
  needs_review: "text-accent",
  changes_requested: "text-medium",
  approved: "text-approved",
};

function Flags({ row }: { row: QueueRow }) {
  const severity = highestSeverity(row.findings);
  if (!severity) return <span className="text-sm text-muted">No flags</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
      {row.findings.length} {row.findings.length === 1 ? "flag" : "flags"}
      <SeverityBadge severity={severity} />
    </span>
  );
}

function Age({ row, nowIso }: { row: QueueRow; nowIso: string }) {
  const basis = ageBasis(row);
  return (
    <div className="leading-tight">
      <div className="text-sm font-medium">{formatAge(basis.iso, nowIso)}</div>
      <div className="text-xs text-muted">{basis.label}</div>
    </div>
  );
}

export function ReviewQueue({ rows, nowIso }: { rows: QueueRow[]; nowIso: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | "all">("all");

  const counts = countByStatus(rows);
  const visible = filterQueue(rows, search, status);
  const clear = () => {
    setSearch("");
    setStatus("all");
  };

  return (
    <div className="space-y-6">
      <section aria-label="Summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CARDS.map((s) => (
          <div key={s} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">{STATUS_LABELS[s]}</p>
            <p className={`mt-1 text-3xl font-semibold ${CARD_STYLES[s]}`}>{counts[s]}</p>
          </div>
        ))}
      </section>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <h2 className="text-lg font-medium">No submissions yet</h2>
          <p className="mt-1 text-sm text-muted">Submit ad copy to start the review workflow.</p>
          <div className="mt-4">
            <LinkButton href="/submissions/new">Create a submission</LinkButton>
          </div>
        </div>
      ) : (
        <section aria-label="Submissions" className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Search by campaign title or affiliate partner</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaign or affiliate partner"
                className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm"
              />
            </label>
            <label>
              <span className="sr-only">Filter by status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status | "all")}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm sm:w-52"
              >
                <option value="all">All</option>
                {CARDS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
              <h2 className="text-lg font-medium">No matching submissions</h2>
              <p className="mt-1 text-sm text-muted">Try a different search or status.</p>
              <div className="mt-4">
                <Button variant="secondary" onClick={clear}>
                  Clear filters
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
                <table className="w-full text-left">
                  <thead className="border-b border-border bg-black/[0.02] text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Campaign</th>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Channel</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Flags</th>
                      <th className="px-4 py-3 font-medium">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => router.push(`/submissions/${r.id}`)}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-black/[0.03]"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/submissions/${r.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-accent hover:underline"
                          >
                            {r.title}
                          </Link>
                          {r.partnerName && <div className="text-xs text-muted">{r.partnerName}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm">{PRODUCT_LABELS[r.productType]}</td>
                        <td className="px-4 py-3 text-sm">{CHANNEL_LABELS[r.channel]}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3">
                          <Flags row={r} />
                        </td>
                        <td className="px-4 py-3">
                          <Age row={r} nowIso={nowIso} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked rows */}
              <ul className="space-y-3 md:hidden">
                {visible.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/submissions/${r.id}`}
                      className="block rounded-xl border border-border bg-surface p-4 hover:bg-black/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-accent">{r.title}</div>
                          {r.partnerName && <div className="text-xs text-muted">{r.partnerName}</div>}
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="mt-2 text-sm text-muted">
                        {PRODUCT_LABELS[r.productType]} · {CHANNEL_LABELS[r.channel]}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <Flags row={r} />
                        <Age row={r} nowIso={nowIso} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
