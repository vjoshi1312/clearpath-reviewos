import { SiteHeader } from "@/components/site-header";
import { SubmissionForm } from "@/components/submission-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewSubmissionPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Queue
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">New Submission</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          Paste text-only ad copy. Optionally run Check Copy first for an advisory scan, then submit for human review.
        </p>
        <SubmissionForm />
      </main>
    </>
  );
}
