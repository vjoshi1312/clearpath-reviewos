import { SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui/button";

export default function SubmissionNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Submission not found</h1>
        <p className="mt-2 text-sm text-muted">
          This link may be mistyped, or the submission may not exist in this demo database.
        </p>
        <div className="mt-6">
          <LinkButton href="/">Back to Queue</LinkButton>
        </div>
      </main>
    </>
  );
}
