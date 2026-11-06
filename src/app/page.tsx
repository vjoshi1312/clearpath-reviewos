import { SiteHeader } from "@/components/site-header";
import { ReviewQueue } from "@/components/review-queue";
import { LinkButton } from "@/components/ui/button";
import { getQueue } from "@/lib/queries";
import type { QueueRow } from "@/lib/types";

// Always read fresh queue state; never cache demo mutations.
export const dynamic = "force-dynamic";

export default async function QueuePage() {
  let rows: QueueRow[] | null = null;
  try {
    rows = await getQueue();
  } catch (err) {
    console.error("Queue load failed:", err instanceof Error ? err.name : "Error");
  }

  return (
    <>
      <SiteHeader showNew />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {rows === null ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
            <h2 className="text-lg font-medium text-high">The review queue is unavailable</h2>
            <p className="mt-1 text-sm text-muted">We couldn&apos;t reach the database. Your data is not affected. Try again in a moment.</p>
            <div className="mt-4">
              <LinkButton href="/" variant="secondary">
                Retry
              </LinkButton>
            </div>
          </div>
        ) : (
          <ReviewQueue rows={rows} nowIso={new Date().toISOString()} />
        )}
      </main>
    </>
  );
}
