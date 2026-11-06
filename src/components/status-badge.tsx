import { AlertTriangle, CheckCircle2, Clock, MessageSquareWarning } from "lucide-react";
import { STATUS_LABELS } from "@/lib/formatting";
import type { Severity, Status } from "@/lib/types";

const STATUS_STYLES: Record<Status, string> = {
  needs_review: "bg-blue-50 text-accent border-blue-200",
  changes_requested: "bg-amber-50 text-medium border-amber-200",
  approved: "bg-green-50 text-approved border-green-200",
};

const STATUS_ICONS = {
  needs_review: Clock,
  changes_requested: MessageSquareWarning,
  approved: CheckCircle2,
} as const;

export function StatusBadge({ status }: { status: Status }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const high = severity === "high";
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${
        high ? "border-red-200 bg-red-50 text-high" : "border-amber-200 bg-amber-50 text-medium"
      }`}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      {high ? "High" : "Medium"}
    </span>
  );
}
