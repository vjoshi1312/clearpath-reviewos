import Link from "next/link";
import { Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export function SiteHeader({ showNew = false }: { showNew?: boolean }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <Link href="/" className="text-lg font-semibold tracking-tight">
            ClearPath ReviewOS
          </Link>
          <p className="text-sm text-muted">Marketing compliance review</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">Demo · fictional data</span>
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
