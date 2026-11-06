import type { Channel, EventType, Finding, ProductType, QueueRow, Severity, Status } from "./types";

export const PRODUCT_LABELS: Record<ProductType, string> = {
  personal_loan: "Personal Loan",
  credit_card: "Credit Card",
  mortgage_prequalification: "Mortgage Prequalification",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  affiliate: "Affiliate",
  email: "Email",
  paid_social: "Paid Social",
  landing_page: "Landing Page",
};

export const STATUS_LABELS: Record<Status, string> = {
  needs_review: "Needs Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
};

export const EVENT_LABELS: Record<EventType, string> = {
  submitted: "Submitted",
  changes_requested: "Changes requested",
  resubmitted: "Resubmitted",
  approved: "Approved",
};

export function highestSeverity(findings: Finding[]): Severity | null {
  if (findings.some((f) => f.severity === "high")) return "high";
  if (findings.length > 0) return "medium";
  return null;
}

const STATUS_ORDER: Record<Status, number> = { needs_review: 0, changes_requested: 1, approved: 2 };

/**
 * Default queue order: Needs Review (oldest created first), then Changes Requested
 * (oldest updated first), then Approved (most recently updated first).
 */
export function sortQueue<T extends Pick<QueueRow, "status" | "createdAt" | "updatedAt">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    const time = (r: T) => Date.parse(r.status === "needs_review" ? r.createdAt : r.updatedAt);
    return a.status === "approved" ? time(b) - time(a) : time(a) - time(b);
  });
}

export function countByStatus(rows: Pick<QueueRow, "status">[]): Record<Status, number> {
  const counts: Record<Status, number> = { needs_review: 0, changes_requested: 0, approved: 0 };
  for (const r of rows) counts[r.status] += 1;
  return counts;
}

export function filterQueue<T extends Pick<QueueRow, "status" | "title" | "partnerName">>(
  rows: T[],
  search: string,
  status: Status | "all",
): T[] {
  const q = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (!q) return true;
    return r.title.toLowerCase().includes(q) || (r.partnerName ?? "").toLowerCase().includes(q);
  });
}

/** What a queue row's Age measures, so the number is never ambiguous. */
export function ageBasis(row: Pick<QueueRow, "status" | "createdAt" | "updatedAt">): { iso: string; label: string } {
  switch (row.status) {
    case "needs_review":
      return { iso: row.createdAt, label: "since submitted" };
    case "changes_requested":
      return { iso: row.updatedAt, label: "since changes requested" };
    case "approved":
      return { iso: row.updatedAt, label: "since approved" };
  }
}

export function formatAge(iso: string, nowIso: string): string {
  const ms = Math.max(0, Date.parse(nowIso) - Date.parse(iso));
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Deterministic UTC fallback used for server render. */
export function formatUtc(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
