"use server";

import { revalidatePath } from "next/cache";
import { AppError, type ActionResult } from "@/lib/errors";
import { approveRecord, createSubmissionRecord, requestChangesRecord, resubmitRecord } from "@/lib/queries";
import { isUuid, parseCopy, parseNote, parseSubmissionInput } from "@/lib/validation";

function fail(code: "validation" | "not_found", message: string, fieldErrors?: Record<string, string | undefined>) {
  return { ok: false, code, message, fieldErrors } as const;
}

/** Runs a mutation and converts every failure into a structured, human-readable result. */
async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, code: err.code, message: err.message, fieldErrors: err.fieldErrors };
    }
    // Log only the error class/code, never connection details or SQL.
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "unknown";
    console.error("Database operation failed:", err instanceof Error ? err.name : "Error", code);
    return {
      ok: false,
      code: "unavailable",
      message: "The database is temporarily unavailable. Nothing was saved. Please try again in a moment.",
    };
  }
}

function refresh(id?: string) {
  revalidatePath("/");
  if (id) revalidatePath(`/submissions/${id}`);
}

export async function createSubmission(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = parseSubmissionInput(input);
  if (!parsed.ok) return fail("validation", "Please fix the highlighted fields.", parsed.errors);
  return run(async () => {
    const id = await createSubmissionRecord(parsed.data);
    refresh(id);
    return { id };
  });
}

export async function requestChanges(submissionId: string, expectedRevisionId: string, note: unknown): Promise<ActionResult> {
  if (!isUuid(submissionId)) return fail("not_found", "Submission not found.");
  if (!isUuid(expectedRevisionId)) return fail("validation", "Invalid revision. Refresh the page and try again.");
  const parsed = parseNote(note, "note");
  if (!parsed.ok) return fail("validation", "Please fix the note.", parsed.errors);
  return run(async () => {
    await requestChangesRecord(submissionId, parsed.data, expectedRevisionId);
    refresh(submissionId);
    return null;
  });
}

export async function resubmitRevision(submissionId: string, newCopy: unknown): Promise<ActionResult<{ version: number }>> {
  if (!isUuid(submissionId)) return fail("not_found", "Submission not found.");
  const parsed = parseCopy(newCopy);
  if (!parsed.ok) return fail("validation", "Please fix the copy.", { copy: parsed.errors.copy });
  return run(async () => {
    const version = await resubmitRecord(submissionId, parsed.data);
    refresh(submissionId);
    return { version };
  });
}

export async function approveSubmission(submissionId: string, expectedRevisionId: string, rationale?: unknown): Promise<ActionResult> {
  if (!isUuid(submissionId)) return fail("not_found", "Submission not found.");
  if (!isUuid(expectedRevisionId)) return fail("validation", "Invalid revision. Refresh the page and try again.");
  const text = typeof rationale === "string" ? rationale.trim() : "";
  return run(async () => {
    await approveRecord(submissionId, text === "" ? null : text, expectedRevisionId);
    refresh(submissionId);
    return null;
  });
}
