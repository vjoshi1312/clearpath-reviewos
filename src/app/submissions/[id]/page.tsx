import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReviewWorkspace } from "@/components/review-workspace";
import { LinkButton } from "@/components/ui/button";
import { getSubmissionDetail } from "@/lib/queries";
import type { SubmissionDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SubmissionPage({ params }: PageProps<"/submissions/[id]">) {
  const { id } = await params;

  let detail: SubmissionDetail | null;
  try {
    detail = await getSubmissionDetail(id);
  } catch (err) {
    console.error("Submission load failed:", err instanceof Error ? err.name : "Error");
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-16 text-center" role="alert">
          <h1 className="text-2xl font-semibold text-high">This submission can&apos;t be loaded right now</h1>
          <p className="mt-2 text-sm text-muted">We couldn&apos;t reach the database. Nothing has been changed. Try again in a moment.</p>
          <div className="mt-6 flex justify-center gap-3">
            <LinkButton href={`/submissions/${id}`} variant="secondary">
              Retry
            </LinkButton>
            <LinkButton href="/">Back to Queue</LinkButton>
          </div>
        </main>
      </>
    );
  }

  if (!detail) notFound();

  return (
    <>
      <SiteHeader />
      <ReviewWorkspace detail={detail} />
    </>
  );
}
