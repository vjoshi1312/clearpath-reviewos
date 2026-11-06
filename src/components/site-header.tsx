import Link from "next/link";
import { Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export function SiteHeader({ showNew = false }: { showNew?: boolean }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ClearPath ReviewOS
            </Link>
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              Demo
            </span>
          </div>
          <p className="text-sm text-muted">Marketing compliance review</p>
        </div>
        <div className="flex items-center gap-3">
          {showNew && (
            <LinkButton href="/submissions/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Submission
            </LinkButton>
          )}
        </div>
      </div>
    </header>
  );
}
