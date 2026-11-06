// Deterministic, advisory screening rules (ruleset v1).
//
// Pure and synchronous: no network, database, model, or user state. The same module
// runs in the browser (Check Copy preview) and on the server (authoritative rescan at
// submit/resubmit). Findings are prompts for a human reviewer to verify. They are not
// legal determinations. Offsets (`start`/`end`) index into the exact `copy` string passed in.

import type { Finding, RuleId, ScreeningInput, Severity } from "./types";

type Span = { start: number; end: number; text: string };

// Treat curly apostrophes like straight ones so "you’re" and "you're" both match.
const APOS = "['’]";

// ---------- helpers ----------

function allMatches(regex: RegExp, copy: string): Span[] {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const re = new RegExp(regex.source, flags);
  const spans: Span[] = [];
  for (const m of copy.matchAll(re)) {
    const start = m.index ?? 0;
    spans.push({ start, end: start + m[0].length, text: m[0] });
  }
  return spans;
}

const NEGATION_WORDS = /^(?:not|never|cannot|can['’]t|isn['’]t|aren['’]t|don['’]t|doesn['’]t|won['’]t|without|no)$/i;
const STRONG_NEGATION_WORDS = /^(?:not|never|cannot|can['’]t|isn['’]t|aren['’]t|don['’]t|doesn['’]t|won['’]t)$/i;

/**
 * True when the match is negated by the words just before it in the same clause,
 * e.g. "We do not offer guaranteed approval" or "you're not pre-approved".
 * Clause boundaries (. ! ? ; : , newline) stop the look-back, so
 * "No credit check, guaranteed approval" is NOT treated as negated.
 */
function isNegated(copy: string, start: number): boolean {
  const before = copy.slice(0, start);
  const clause = before.split(/[.!?;:,\n]/).pop() ?? "";
  const words = clause.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const last = words[words.length - 1];
  if (NEGATION_WORDS.test(last)) return true;
  return words.slice(-3).some((w) => STRONG_NEGATION_WORDS.test(w));
}

function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

function makeFinding(
  ruleId: RuleId,
  severity: Severity,
  title: string,
  span: Span | null,
  explanation: string,
  suggestedAction: string,
): Finding {
  return {
    id: `${ruleId}:${span ? span.start : "context"}`,
    ruleId,
    severity,
    title,
    evidence: span ? span.text : null,
    start: span ? span.start : null,
    end: span ? span.end : null,
    explanation,
    suggestedAction,
  };
}

// ---------- R1: approval promises (all products, high) ----------

const R1_PATTERN = new RegExp(
  String.raw`\b(?:` +
    [
    String.raw`guaranteed\s+(?:loan\s+|credit\s+|card\s+)?approval`,
    String.raw`approval\s+(?:is\s+)?guaranteed`,
    String.raw`100\s?%\s+(?:approval|approved)`,
    String.raw`everyone\s+(?:qualifies|is\s+approved|gets\s+approved)`,
    String.raw`(?:you${APOS}re|you\s+are)\s+guaranteed\s+(?:to\s+be\s+)?approved`,
    String.raw`guaranteed\s+to\s+be\s+approved`,
    ].join("|") +
    String.raw`)\b`,
  "i",
);

function r1Candidates(copy: string): Span[] {
  return allMatches(R1_PATTERN, copy).filter((s) => !isNegated(copy, s.start));
}

// ---------- R2: credit-check / score claims (all products, medium) ----------

const R2_PATTERN = new RegExp(
  String.raw`\b(?:` +
    [
      String.raw`no\s+credit\s+(?:check|checks|inquiry|inquiries)`,
      String.raw`(?:won${APOS}t|will\s+not|does\s+not|doesn${APOS}t|will\s+never)\s+(?:affect|impact|hurt|harm|lower)\s+(?:your\s+)?credit(?:\s+score)?`,
      String.raw`(?:no|zero)\s+(?:impact|effect)\s+(?:on|to)\s+(?:your\s+)?credit(?:\s+score)?`,
    ].join("|") +
    String.raw`)\b`,
  "i",
);

// ---------- R3: credit terms (all products, medium) ----------

const R3_PATTERN = new RegExp(
  [
    // $99/month, $150 per month, $1,200.50 a month, $99/mo
    String.raw`\$\s?\d[\d,]*(?:\.\d{1,2})?\s*(?:/\s*|per\s+|a\s+|each\s+)(?:mo|month)\b`,
    // 4.99% APR, 0% intro APR, as low as 5.5% APR
    String.raw`\b(?:as\s+low\s+as\s+)?\d{1,2}(?:\.\d{1,3})?\s?%\s*(?:intro\s+|introductory\s+|fixed\s+|variable\s+)?APR\b`,
    // APR of 4.99%, APR as low as 4.99%
    String.raw`\bAPR\s+(?:of\s+|from\s+|as\s+low\s+as\s+)?\d{1,2}(?:\.\d{1,3})?\s?%`,
  ].join("|"),
  "i",
);

// ---------- R4: mortgage prequalification vs. approval (mortgage only, high) ----------

const R4_PATTERN = new RegExp(
  String.raw`\b(?:` +
    [
      String.raw`pre-?\s?approved`,
      String.raw`(?:you${APOS}re|you\s+are|you${APOS}ve\s+been)\s+approved`,
      String.raw`instant\s+(?:mortgage\s+|home\s+loan\s+)?(?:pre-?\s?)?approval`,
    ].join("|") +
    String.raw`)\b`,
  "i",
);

// ---------- R5: potential paid-endorsement disclosure (affiliate only, medium) ----------

const R5_ENDORSEMENT = new RegExp(
  String.raw`\b(?:` +
    [
      String.raw`i\s+(?:highly\s+|personally\s+|really\s+)?recommend`,
      String.raw`we\s+(?:highly\s+|personally\s+)?recommend`,
      String.raw`my\s+(?:favou?rite|top\s+pick|go-to)`,
      String.raw`our\s+(?:favou?rite|top\s+pick)`,
      String.raw`i\s+(?:love|swear\s+by)`,
    ].join("|") +
    String.raw`)\b`,
  "i",
);

const R5_DISCLOSURE = new RegExp(
  [
    String.raw`#ad\b`,
    String.raw`\badvertisement\b`,
    String.raw`\bsponsored\b`,
    String.raw`\bpaid\s+(?:partnership|promotion|endorsement)\b`,
    String.raw`\baffiliate\b`,
    String.raw`\bcommissions?\b`,
    String.raw`\bcompensat(?:ed|ion)\b`,
    String.raw`\bin\s+partnership\s+with\b`,
  ].join("|"),
  "i",
);

// ---------- engine ----------

export function screenCopy(input: ScreeningInput): Finding[] {
  const { productType, channel, copy } = input;
  const findings: Finding[] = [];

  // R4 first, because R1 defers to it when both describe the same span.
  let r4: Span | null = null;
  if (productType === "mortgage_prequalification") {
    r4 = allMatches(R4_PATTERN, copy).find((s) => !isNegated(copy, s.start)) ?? null;
  }

  // R1: first non-negated approval promise that is not the same issue as the R4 finding.
  const r1 = r1Candidates(copy).find((s) => !(r4 && overlaps(s, r4))) ?? null;
  if (r1) {
    findings.push(
      makeFinding(
        "R1",
        "high",
        "Possible unconditional approval claim",
        r1,
        "This wording may promise approval or qualification without conditions. Approval typically depends on eligibility and the applicant's circumstances.",
        "Verify the claim can be substantiated. If not, replace it with supportable terms (for example, that approval is subject to eligibility).",
      ),
    );
  }

  const r2 = allMatches(R2_PATTERN, copy)[0] ?? null;
  if (r2) {
    findings.push(
      makeFinding(
        "R2",
        "medium",
        "Credit-check or credit-score claim",
        r2,
        "This copy makes a statement about credit checks or the effect on a credit score. Accuracy depends on the actual application and underwriting process.",
        "Check the statement against the real application flow for this product (for example, whether a soft or hard inquiry occurs and when). Product-specific verification is required.",
      ),
    );
  }

  const r3 = allMatches(R3_PATTERN, copy)[0] ?? null;
  if (r3) {
    findings.push(
      makeFinding(
        "R3",
        "medium",
        "Advertised rate or payment amount",
        r3,
        "This copy states a payment amount or an APR. Rate and payment statements may carry additional terms or disclosure expectations.",
        "Verify the advertised rate or payment is accurate and currently available, and whether additional terms or disclosures are needed alongside it. Do not add figures from this tool.",
      ),
    );
  }

  if (r4) {
    findings.push(
      makeFinding(
        "R4",
        "high",
        "Mortgage prequalification described as approval",
        r4,
        "Mortgage prequalification is not necessarily an approval. This wording may suggest the consumer is already approved or pre-approved.",
        "Verify the exact claim against the actual process and supporting facts. Consider whether 'prequalified' or similar wording is more accurate.",
      ),
    );
  }

  if (channel === "affiliate") {
    const endorsement = allMatches(R5_ENDORSEMENT, copy)[0] ?? null;
    if (endorsement && !R5_DISCLOSURE.test(copy)) {
      findings.push(
        makeFinding(
          "R5",
          "medium",
          "Possible endorsement without a recognizable disclosure",
          endorsement,
          "Contextual review prompt: this affiliate copy reads like a personal endorsement and no recognizable material-connection disclosure keyword was found in the text. The full publishing context is not visible here, so this is not proof of missing disclosure, and a keyword would not prove a disclosure is adequate.",
          "Verify whether a material-connection disclosure is required and is sufficiently clear in the full presentation context.",
        ),
      );
    }
  }

  // High severity first, then by rule number, so output is stable.
  return findings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
    return a.ruleId.localeCompare(b.ruleId);
  });
}
