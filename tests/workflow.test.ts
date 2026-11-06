import { describe, expect, it } from "vitest";
import { approvalRequiresRationale, availableActions, canTransition, transitionTarget } from "../src/lib/workflow";
import { countByStatus, filterQueue, formatAge, sortQueue } from "../src/lib/formatting";
import type { Finding, Status } from "../src/lib/types";

describe("status transitions", () => {
  it("allows exactly the specified transitions", () => {
    expect(canTransition("needs_review", "request_changes")).toBe(true);
    expect(canTransition("needs_review", "approve")).toBe(true);
    expect(canTransition("changes_requested", "resubmit")).toBe(true);

    expect(canTransition("needs_review", "resubmit")).toBe(false);
    expect(canTransition("changes_requested", "approve")).toBe(false);
    expect(canTransition("changes_requested", "request_changes")).toBe(false);
  });

  it("treats approved as terminal", () => {
    expect(availableActions("approved")).toEqual([]);
    for (const a of ["request_changes", "resubmit", "approve"] as const) {
      expect(canTransition("approved", a)).toBe(false);
    }
  });

  it("maps each action to the right target status and event", () => {
    expect(transitionTarget("request_changes")).toEqual({ to: "changes_requested", event: "changes_requested" });
    expect(transitionTarget("resubmit")).toEqual({ to: "needs_review", event: "resubmitted" });
    expect(transitionTarget("approve")).toEqual({ to: "approved", event: "approved" });
  });
});

const f = (severity: Finding["severity"]): Finding => ({
  id: "x",
  ruleId: "R1",
  severity,
  title: "t",
  evidence: null,
  start: null,
  end: null,
  explanation: "e",
  suggestedAction: "a",
});

describe("approval rationale", () => {
  it("is required only when a high-severity finding exists", () => {
    expect(approvalRequiresRationale([])).toBe(false);
    expect(approvalRequiresRationale([f("medium")])).toBe(false);
    expect(approvalRequiresRationale([f("medium"), f("high")])).toBe(true);
  });
});

const row = (title: string, status: Status, createdAt: string, updatedAt: string, partnerName: string | null = null) => ({
  title,
  status,
  createdAt,
  updatedAt,
  partnerName,
});

describe("queue helpers", () => {
  const rows = [
    row("approved-old", "approved", "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"),
    row("approved-new", "approved", "2026-01-01T00:00:00Z", "2026-01-05T00:00:00Z"),
    row("changes-new", "changes_requested", "2026-01-01T00:00:00Z", "2026-01-04T00:00:00Z"),
    row("changes-old", "changes_requested", "2026-01-03T00:00:00Z", "2026-01-03T00:00:00Z"),
    row("review-new", "needs_review", "2026-01-04T00:00:00Z", "2026-01-04T00:00:00Z"),
    row("review-old", "needs_review", "2026-01-02T00:00:00Z", "2026-01-09T00:00:00Z", "Acme Partners"),
  ];

  it("orders Needs Review oldest-created first, Changes Requested oldest-updated first, Approved newest-updated first", () => {
    expect(sortQueue(rows).map((r) => r.title)).toEqual([
      "review-old",
      "review-new",
      "changes-old",
      "changes-new",
      "approved-new",
      "approved-old",
    ]);
  });

  it("derives counts from the rows", () => {
    expect(countByStatus(rows)).toEqual({ needs_review: 2, changes_requested: 2, approved: 2 });
    expect(countByStatus([])).toEqual({ needs_review: 0, changes_requested: 0, approved: 0 });
  });

  it("searches title and partner case-insensitively and combines with the status filter", () => {
    expect(filterQueue(rows, "ACME", "all").map((r) => r.title)).toEqual(["review-old"]);
    expect(filterQueue(rows, "approved", "all")).toHaveLength(2);
    expect(filterQueue(rows, "approved", "needs_review")).toHaveLength(0);
    expect(filterQueue(rows, "  ", "changes_requested")).toHaveLength(2);
    expect(filterQueue(rows, "", "all")).toHaveLength(6);
  });

  it("formats age in minutes, hours, and days", () => {
    const now = "2026-01-10T12:00:00Z";
    expect(formatAge("2026-01-10T11:59:40Z", now)).toBe("<1m");
    expect(formatAge("2026-01-10T11:15:00Z", now)).toBe("45m");
    expect(formatAge("2026-01-10T00:00:00Z", now)).toBe("12h");
    expect(formatAge("2026-01-05T12:00:00Z", now)).toBe("5d");
  });
});
