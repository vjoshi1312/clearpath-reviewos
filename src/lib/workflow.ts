import type { EventType, Finding, Status } from "./types";

export type WorkflowAction = "request_changes" | "resubmit" | "approve";

// The only legal status transitions (spec §5). Anything else is rejected.
// `approved` is terminal.
const TRANSITIONS: Record<WorkflowAction, { from: Status; to: Status; event: EventType }> = {
  request_changes: { from: "needs_review", to: "changes_requested", event: "changes_requested" },
  resubmit: { from: "changes_requested", to: "needs_review", event: "resubmitted" },
  approve: { from: "needs_review", to: "approved", event: "approved" },
};

export function canTransition(current: Status, action: WorkflowAction): boolean {
  return TRANSITIONS[action].from === current;
}

export function transitionTarget(action: WorkflowAction): { to: Status; event: EventType } {
  const { to, event } = TRANSITIONS[action];
  return { to, event };
}

export function availableActions(status: Status): WorkflowAction[] {
  return (Object.keys(TRANSITIONS) as WorkflowAction[]).filter((a) => canTransition(status, a));
}

/** Approving content with any unresolved high-severity flag needs a written rationale. */
export function approvalRequiresRationale(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === "high");
}
