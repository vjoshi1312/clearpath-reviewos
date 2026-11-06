import { describe, expect, it } from "vitest";
import { screenCopy } from "../src/lib/screening";
import { SEED_CAMPAIGNS } from "../scripts/seed-data";
import type { Channel, ProductType } from "../src/lib/types";

const run = (copy: string, productType: ProductType = "credit_card", channel: Channel = "email") =>
  screenCopy({ productType, channel, partnerName: channel === "affiliate" ? "Test Partner" : null, copy });
const ids = (copy: string, p?: ProductType, c?: Channel) => run(copy, p, c).map((f) => f.ruleId);

describe("R1 approval promises", () => {
  it.each([
    "Guaranteed approval for everyone.",
    "Apply now: approval guaranteed!",
    "It's 100% approval, no exceptions.",
    "Everyone qualifies for this card.",
    "You're guaranteed approved today.",
  ])("flags %s", (copy) => {
    expect(ids(copy)).toContain("R1");
  });

  it("returns exact evidence, preserved casing, and matching offsets", () => {
    const copy = "Act now. GUARANTEED APPROVAL awaits.";
    const f = run(copy).find((x) => x.ruleId === "R1")!;
    expect(f.severity).toBe("high");
    expect(f.evidence).toBe("GUARANTEED APPROVAL");
    expect(copy.slice(f.start!, f.end!)).toBe(f.evidence);
    expect(f.id).toBe(`R1:${f.start}`);
  });

  it.each([
    "Approval is not guaranteed.",
    "Approval is never guaranteed and depends on eligibility.",
    "We do not offer guaranteed approval.",
    "There is no guaranteed approval here.",
    "Approval is subject to eligibility.",
  ])("does not flag negated or conditional wording: %s", (copy) => {
    expect(ids(copy)).not.toContain("R1");
  });

  it("does not treat a preceding 'No credit check,' as a negation", () => {
    expect(ids("No credit check, guaranteed approval!")).toEqual(expect.arrayContaining(["R1", "R2"]));
  });

  it("returns at most one finding per rule, using the first match", () => {
    const f = run("Guaranteed approval! Everyone qualifies! 100% approval!").filter((x) => x.ruleId === "R1");
    expect(f).toHaveLength(1);
    expect(f[0].evidence).toBe("Guaranteed approval");
  });
});

describe("R2 credit-check / score claims", () => {
  it.each([
    "No credit check needed.",
    "Checking your rate won't affect your credit score.",
    "Applying has no impact on credit score.",
    "This will not hurt your credit.",
  ])("flags %s", (copy) => {
    const f = run(copy).find((x) => x.ruleId === "R2");
    expect(f).toBeDefined();
    expect(f!.severity).toBe("medium");
  });

  it("does not flag unrelated credit wording", () => {
    expect(ids("Build your credit with everyday purchases.")).not.toContain("R2");
  });
});

describe("R3 credit terms", () => {
  it.each([
    ["Pay just $99/month.", "$99/month"],
    ["Only $150 per month for a year.", "$150 per month"],
    ["Rates from 4.99% APR today.", "4.99% APR"],
    ["Enjoy 0% APR for 12 months.", "0% APR"],
    ["Rates as low as 5.5% APR.", "as low as 5.5% APR"],
  ])("flags %s", (copy, evidence) => {
    const f = run(copy).find((x) => x.ruleId === "R3");
    expect(f?.evidence).toBe(evidence);
    expect(f?.severity).toBe("medium");
  });

  it("does not flag copy without a rate or payment", () => {
    expect(ids("Flexible repayment options. Learn about APR on our terms page.")).not.toContain("R3");
  });
});

describe("R4 mortgage prequalification vs approval", () => {
  it.each(["You're pre-approved!", "You are approved for a home loan.", "Instant mortgage approval in minutes."])(
    "flags %s on mortgage products",
    (copy) => {
      const f = run(copy, "mortgage_prequalification").find((x) => x.ruleId === "R4");
      expect(f?.severity).toBe("high");
    },
  );

  it("only applies to mortgage_prequalification", () => {
    expect(ids("You're pre-approved!", "credit_card")).not.toContain("R4");
    expect(ids("You're pre-approved!", "personal_loan")).not.toContain("R4");
  });

  it("does not flag negations or prequalification wording", () => {
    expect(ids("You are not pre-approved yet.", "mortgage_prequalification")).not.toContain("R4");
    expect(ids("Prequalification is not a loan approval.", "mortgage_prequalification")).toEqual([]);
  });

  it("prefers R4 over R1 for the same underlying issue", () => {
    const rules = ids("Instant mortgage approval guaranteed!", "mortgage_prequalification");
    expect(rules).toContain("R4");
    expect(rules).not.toContain("R1");
  });

  it("keeps a distinct R1 finding alongside R4", () => {
    const rules = ids("You're pre-approved! Also, everyone qualifies for our lowest tier.", "mortgage_prequalification");
    expect(rules).toEqual(expect.arrayContaining(["R1", "R4"]));
  });

  it("still reports R1 for mortgage copy when there is no R4 overlap", () => {
    expect(ids("Guaranteed approval for every buyer.", "mortgage_prequalification")).toEqual(["R1"]);
  });
});

describe("R5 paid endorsement disclosure prompt", () => {
  it("flags affiliate copy with an endorsement phrase and no disclosure", () => {
    const copy = "I recommend this card. My favorite perk is cash back.";
    const f = run(copy, "credit_card", "affiliate").find((x) => x.ruleId === "R5");
    expect(f?.evidence).toBe("I recommend");
    expect(f?.severity).toBe("medium");
    expect(f?.explanation).toMatch(/not proof/i);
  });

  it.each([
    "I recommend this card. #ad",
    "I recommend this card. This post is sponsored.",
    "We recommend it. Paid partnership with ClearPath.",
    "My favorite card. I may earn a commission if you apply.",
    "I love this card. (Affiliate link.)",
  ])("does not flag when a disclosure phrase is present: %s", (copy) => {
    expect(ids(copy, "credit_card", "affiliate")).not.toContain("R5");
  });

  it("does not flag affiliate copy without an endorsement phrase", () => {
    expect(ids("The ClearPath card offers cash back on purchases.", "credit_card", "affiliate")).toEqual([]);
  });

  it("does not flag endorsement language on non-affiliate channels", () => {
    expect(ids("I recommend this card.", "credit_card", "email")).not.toContain("R5");
    expect(ids("I recommend this card.", "credit_card", "paid_social")).not.toContain("R5");
  });
});

describe("engine behavior", () => {
  it("returns no findings for clean copy", () => {
    expect(run("Learn how ClearPath can help you pick the right card for your needs.")).toEqual([]);
  });

  it("is deterministic and orders high severity first", () => {
    const copy = "No credit check! Guaranteed approval!";
    const a = run(copy);
    expect(run(copy)).toEqual(a);
    expect(a.map((f) => f.ruleId)).toEqual(["R1", "R2"]);
  });

  it("every finding with evidence points at the exact substring", () => {
    const copy = "Guaranteed approval! No credit check. Only $99/month. I recommend this.";
    for (const f of run(copy, "credit_card", "affiliate")) {
      expect(f.evidence).not.toBeNull();
      expect(copy.slice(f.start!, f.end!)).toBe(f.evidence);
    }
  });

  it("the example from the acceptance checklist yields R1 and R2 with evidence", () => {
    const f = run("Guaranteed approval. No credit check required.");
    expect(f.map((x) => [x.ruleId, x.evidence])).toEqual([
      ["R1", "Guaranteed approval"],
      ["R2", "No credit check"],
    ]);
  });
});

describe("seed campaigns", () => {
  it.each(SEED_CAMPAIGNS.map((c) => [c.title, c] as const))("%s triggers exactly the documented rules", (_t, c) => {
    const rules = screenCopy({
      productType: c.productType,
      channel: c.channel,
      partnerName: c.partnerName,
      copy: c.copy,
    })
      .map((f) => f.ruleId)
      .sort();
    expect(rules).toEqual([...c.expectedRules].sort());
  });
});
