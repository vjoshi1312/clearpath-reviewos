// Shared finite unions and record types. No runtime dependencies so this file is
// safe to import from client components, server code, and scripts.

export const PRODUCT_TYPES = ["personal_loan", "credit_card", "mortgage_prequalification"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const CHANNELS = ["affiliate", "email", "paid_social", "landing_page"] as const;
export type Channel = (typeof CHANNELS)[number];

export const STATUSES = ["needs_review", "changes_requested", "approved"] as const;
export type Status = (typeof STATUSES)[number];

export const EVENT_TYPES = ["submitted", "changes_requested", "resubmitted", "approved"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const ACTOR_ROLES = ["marketing", "compliance", "system"] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export const RULESET_VERSION = "v1" as const;

export type Severity = "high" | "medium";
export type RuleId = "R1" | "R2" | "R3" | "R4" | "R5";

export type Finding = {
  id: string; // `${ruleId}:${start ?? 'context'}`
  ruleId: RuleId;
  severity: Severity;
  title: string;
  evidence: string | null; // exact substring of the copy, or null
  start: number | null; // zero-based offset into the copy when evidence exists
  end: number | null; // exclusive offset when evidence exists
  explanation: string;
  suggestedAction: string;
};

export type ScreeningInput = {
  productType: ProductType;
  channel: Channel;
  partnerName: string | null;
  copy: string;
};

export const ADVISORY_NOTICE =
  "Automated checks are advisory, based on illustrative rules, and do not establish legal compliance. Final approval requires human review.";

// Row shapes returned by server-side queries (timestamps are ISO strings so they can
// cross the server/client boundary).
export type QueueRow = {
  id: string;
  title: string;
  productType: ProductType;
  channel: Channel;
  partnerName: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
  latestVersion: number;
  findings: Finding[];
};

export type Revision = {
  id: string;
  versionNumber: number;
  content: string;
  findings: Finding[];
  rulesetVersion: string;
  createdAt: string;
};

export type ReviewEvent = {
  id: string;
  revisionId: string | null;
  versionNumber: number | null;
  eventType: EventType;
  actorRole: ActorRole;
  note: string | null;
  createdAt: string;
};

export type SubmissionDetail = {
  id: string;
  title: string;
  productType: ProductType;
  channel: Channel;
  partnerName: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
  revisions: Revision[]; // ascending by version
  events: ReviewEvent[]; // newest first
};
