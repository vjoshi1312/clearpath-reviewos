import { z } from "zod";
import { CHANNELS, PRODUCT_TYPES, type Channel, type ProductType } from "./types";

export const LIMITS = {
  title: { min: 3, max: 100 },
  partner: { min: 2, max: 80 },
  copy: { min: 10, max: 5000 },
  note: { min: 10, max: 1000 },
} as const;

export type FieldErrors = Partial<Record<string, string>>;

const trimmed = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const copySchema = trimmed("Advertising copy", LIMITS.copy.min, LIMITS.copy.max);
export const noteSchema = trimmed("Note", LIMITS.note.min, LIMITS.note.max);

const submissionBase = z.object({
  title: trimmed("Campaign title", LIMITS.title.min, LIMITS.title.max),
  productType: z.enum(PRODUCT_TYPES, { error: "Choose a product." }),
  channel: z.enum(CHANNELS, { error: "Choose a channel." }),
  partnerName: z.string().nullish(),
  copy: copySchema,
});

export type SubmissionInput = {
  title: string;
  productType: ProductType;
  channel: Channel;
  partnerName: string | null;
  copy: string;
};

export type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

function toErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Validates a new submission. The partner name is required (2-80 chars) only for the
 * affiliate channel; for every other channel it is discarded and persisted as null.
 */
export function parseSubmissionInput(input: unknown): ParseResult<SubmissionInput> {
  const parsed = submissionBase.safeParse(input);
  if (!parsed.success) return { ok: false, errors: toErrors(parsed.error) };
  const { title, productType, channel, partnerName, copy } = parsed.data;

  let partner: string | null = null;
  if (channel === "affiliate") {
    const p = (partnerName ?? "").trim();
    if (p.length < LIMITS.partner.min || p.length > LIMITS.partner.max) {
      const message =
        p.length === 0
          ? "Affiliate partner name is required for the Affiliate channel."
          : `Affiliate partner name must be ${LIMITS.partner.min}-${LIMITS.partner.max} characters.`;
      return { ok: false, errors: { partnerName: message } };
    }
    partner = p;
  }
  return { ok: true, data: { title, productType, channel, partnerName: partner, copy } };
}

export function parseCopy(input: unknown): ParseResult<string> {
  const parsed = copySchema.safeParse(input);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, errors: toErrors(parsed.error) };
}

export function parseNote(input: unknown, field = "note"): ParseResult<string> {
  const parsed = noteSchema.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, errors: { [field]: parsed.error.issues[0].message } };
}

const uuidSchema = z.uuid();
export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}
