import { describe, expect, it } from "vitest";
import { isUuid, parseCopy, parseNote, parseSubmissionInput } from "../src/lib/validation";

const valid = {
  title: "  Spring Card Promo  ",
  productType: "credit_card",
  channel: "email",
  partnerName: "should be dropped",
  copy: "  Apply for the ClearPath card today.  ",
};

describe("parseSubmissionInput", () => {
  it("trims, and discards the partner name for non-affiliate channels", () => {
    const r = parseSubmissionInput(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.title).toBe("Spring Card Promo");
      expect(r.data.copy).toBe("Apply for the ClearPath card today.");
      expect(r.data.partnerName).toBeNull();
    }
  });

  it("requires a partner name (2-80 chars) for affiliate", () => {
    const missing = parseSubmissionInput({ ...valid, channel: "affiliate", partnerName: "  " });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.partnerName).toMatch(/required/i);

    const short = parseSubmissionInput({ ...valid, channel: "affiliate", partnerName: "A" });
    expect(short.ok).toBe(false);

    const tooLong = parseSubmissionInput({ ...valid, channel: "affiliate", partnerName: "x".repeat(81) });
    expect(tooLong.ok).toBe(false);

    const ok = parseSubmissionInput({ ...valid, channel: "affiliate", partnerName: " Maple Blog " });
    expect(ok.ok && ok.data.partnerName).toBe("Maple Blog");
  });

  it("enforces title and copy bounds with field-specific errors", () => {
    const r = parseSubmissionInput({ ...valid, title: "ab", copy: "too short" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.title).toMatch(/at least 3/);
      expect(r.errors.copy).toMatch(/at least 10/);
    }
    expect(parseSubmissionInput({ ...valid, title: "x".repeat(101) }).ok).toBe(false);
    expect(parseSubmissionInput({ ...valid, copy: "x".repeat(5001) }).ok).toBe(false);
    expect(parseSubmissionInput({ ...valid, copy: "x".repeat(5000) }).ok).toBe(true);
  });

  it("rejects unknown enum values and missing fields", () => {
    const r = parseSubmissionInput({ ...valid, productType: "auto_loan", channel: "sms" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.productType).toBeDefined();
      expect(r.errors.channel).toBeDefined();
    }
    expect(parseSubmissionInput({}).ok).toBe(false);
    expect(parseSubmissionInput(null).ok).toBe(false);
  });
});

describe("parseCopy / parseNote", () => {
  it("validates revised copy length after trimming", () => {
    expect(parseCopy("short").ok).toBe(false);
    expect(parseCopy("   ten chars!  ").ok).toBe(true);
  });

  it("validates notes at 10-1000 characters", () => {
    expect(parseNote("too short").ok).toBe(false);
    expect(parseNote("   ").ok).toBe(false);
    expect(parseNote("This is long enough.").ok).toBe(true);
    expect(parseNote("x".repeat(1000)).ok).toBe(true);
    expect(parseNote("x".repeat(1001)).ok).toBe(false);
    const r = parseNote("no", "rationale");
    expect(!r.ok && r.errors.rationale).toBeDefined();
  });
});

describe("isUuid", () => {
  it("accepts UUIDs and rejects other strings", () => {
    expect(isUuid("a1000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
