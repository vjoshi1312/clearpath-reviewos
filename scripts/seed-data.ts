// Fictional demo campaigns. All names, offers, and notes are invented.
// `expectedRules` documents which advisory rules each sample is meant to demonstrate;
// tests and the seed script both check the real screening engine against it.
import type { Channel, ProductType, RuleId, Status } from "../src/lib/types";

export type SeedCampaign = {
  id: string;
  title: string;
  productType: ProductType;
  channel: Channel;
  partnerName: string | null;
  status: Status;
  copy: string;
  expectedRules: RuleId[];
  hoursAgoSubmitted: number;
  /** Hours ago the reviewer acted (changes_requested / approved). */
  hoursAgoDecided?: number;
  decisionNote?: string;
};

export const SEED_CAMPAIGNS: SeedCampaign[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    title: "Affiliate Card Launch",
    productType: "credit_card",
    channel: "affiliate",
    partnerName: "BrightSpend Reviews",
    status: "needs_review",
    copy: "Get the ClearPath Everyday Card today: guaranteed approval for everyone who applies! No credit check required, and you could be earning rewards on your very first purchase. Apply in minutes.",
    expectedRules: ["R1", "R2"],
    hoursAgoSubmitted: 74,
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    title: "Summer Loan Offer",
    productType: "personal_loan",
    channel: "paid_social",
    partnerName: null,
    status: "needs_review",
    copy: "Beat the summer budget crunch with a ClearPath Personal Loan. Roll your bills into one simple payment of $189 per month and keep more cash for what matters. Check your options today.",
    expectedRules: ["R3"],
    hoursAgoSubmitted: 29,
  },
  {
    id: "a1000000-0000-4000-8000-000000000003",
    title: "Mortgage Prequal Email",
    productType: "mortgage_prequalification",
    channel: "email",
    partnerName: null,
    status: "needs_review",
    copy: "Subject: You're pre-approved for your dream home!\n\nTake the next step with ClearPath Mortgage. Start your prequalification in about ten minutes and talk with a home loan specialist this week.",
    expectedRules: ["R4"],
    hoursAgoSubmitted: 6,
  },
  {
    id: "a1000000-0000-4000-8000-000000000004",
    title: "Rewards Card Partner Copy",
    productType: "credit_card",
    channel: "affiliate",
    partnerName: "Maple & Main Money Blog",
    status: "changes_requested",
    copy: "I recommend the ClearPath Rewards Card to anyone who wants simple cash back on everyday purchases. My favorite part is the flexible redemption options. Learn more and apply at the link below.",
    expectedRules: ["R5"],
    hoursAgoSubmitted: 52,
    hoursAgoDecided: 20,
    decisionNote:
      "This reads as a personal endorsement. Please add a clear disclosure near the endorsement if the partner is compensated for applications, then resubmit.",
  },
  {
    id: "a1000000-0000-4000-8000-000000000005",
    title: "Loan Options Landing Page",
    productType: "personal_loan",
    channel: "landing_page",
    partnerName: null,
    status: "approved",
    copy: "Explore personal loan options with ClearPath Financial. Tell us a little about your goals, review the terms you are offered, and decide if a loan is right for you. Approval is not guaranteed and is subject to eligibility and verification.",
    expectedRules: [],
    hoursAgoSubmitted: 140,
    hoursAgoDecided: 118,
    decisionNote: "Copy reviewed. No flagged claims; approved for use as written.",
  },
  {
    id: "a1000000-0000-4000-8000-000000000006",
    title: "Mortgage Basics Email",
    productType: "mortgage_prequalification",
    channel: "email",
    partnerName: null,
    status: "approved",
    copy: "Thinking about buying a home? ClearPath Mortgage offers prequalification to help you understand what you may be able to borrow. Prequalification is not a loan approval, and it does not commit you or ClearPath to a loan. Start a conversation with a home loan specialist today.",
    expectedRules: [],
    hoursAgoSubmitted: 96,
    hoursAgoDecided: 80,
    decisionNote: "Wording distinguishes prequalification from approval. Approved.",
  },
];
