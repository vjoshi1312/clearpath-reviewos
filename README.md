# ClearPath ReviewOS

**[Try the live demo](https://clearpath-reviewos.vercel.app)**

I built ClearPath ReviewOS for a 24-hour product engineering take-home. The prompt described a fictional financial company whose marketing team was getting slowed down by compliance reviews managed in spreadsheets and email.

What stood out to me was how easy it would be to lose track of a review: which ads are waiting on someone, what needs to change, and which version actually got approved. I wanted to solve that first rather than try to build an entire automated compliance system in a day.

The result is a simple workflow for submitting ad copy, reviewing it, requesting changes, and keeping a record of what happened.

## What you can do

- **Submit a campaign.** Enter the product, marketing channel, and ad copy. Run **Check Copy** to catch a few common claims before submitting.
- **Work through a review queue.** See what needs review, filter by status, and open a campaign to see its copy and any flagged language.
- **Request changes or approve.** Reviewers can leave a note explaining what to fix, or approve the current version.
- **Go back to older versions.** Resubmitting creates a new version without overwriting the old copy or its review history.

The three statuses are **Needs Review**, **Changes Requested**, and **Approved**. Approval is final for this demo.

## Try it out

The demo comes with six fictional campaigns, but I'd recommend trying a submission yourself to see the full flow:

1. Open the [live app](https://clearpath-reviewos.vercel.app) and click **New Submission**.
2. Choose **Credit Card** and **Email**, give the campaign a title, and paste in: `Guaranteed approval. No credit check required.`
3. Click **Check Copy**. You should get two findings: one for the approval guarantee and another for the credit-check claim.
4. Submit it, then click **Request Changes** and leave a note.
5. Choose **Edit & Resubmit** and change the text to: `Apply today. Approval is subject to eligibility.`
6. Switch between Versions 1 and 2 to see what changed, then approve the revised version.

### Other phrases to test

The screening is rules-based, so here are examples that should trigger each check. Fill out the other required fields and click **Check Copy**.

| Check | Product | Channel | Copy to paste |
| --- | --- | --- | --- |
| R1: Approval promises | Credit Card | Email | `Get guaranteed approval today!` |
| R2: Credit-check claims | Personal Loan | Email | `No credit check required.` |
| R3: Rates and payments | Personal Loan | Email | `Pay just $99/month.` |
| R4: Mortgage prequalification | Mortgage Prequalification | Email | `You're pre-approved for a mortgage!` |
| R5: Affiliate endorsements | Credit Card | Affiliate | `I recommend ClearPath's credit card to everyone.` |

For R5, you'll also need to enter an affiliate partner name.

A few edge cases worth trying: `Approval is not guaranteed.` shouldn't trigger R1; the mortgage check only applies to mortgage prequalification; and the endorsement check only applies to affiliate campaigns. Adding `I may earn a commission` suppresses that particular affiliate flag, but that doesn't necessarily mean the disclosure is adequate.

## How I built it

The app uses **Next.js, React, TypeScript, and Tailwind CSS**, with **Supabase PostgreSQL** for storage and **Vercel** for deployment. Form submissions and review decisions go through Next.js Server Actions with Zod validation.

I went with five specific screening rules instead of an LLM for this first version. They're predictable, easy to test, and can point to the exact words that caused a flag. The rules live in [`src/lib/screening.ts`](src/lib/screening.ts) and run both when someone clicks **Check Copy** and again on the server when copy is submitted.

The downside is that they only catch the wording I've accounted for. Someone could make the same questionable claim in a different way and the tool might miss it. That's why the checks are just a starting point for the reviewer, not a pass/fail compliance decision. **No flags doesn't mean an ad is compliant.** Reviewers make the final decision, and approving copy with a high-severity flag requires an explanation.

On the database side, I used three tables: `submissions`, `revisions`, and `review_events`. Old revisions aren't overwritten, and each decision is tied to the version that was reviewed. Transactions and row locking also prevent two conflicting review actions from being saved at once.

## What I'd do next

I'd want to put this in front of actual compliance reviewers before adding much more. I'd look at how long reviews take, how many rounds of revisions campaigns go through, and where the process still gets stuck. If the workflow helped, I'd look at expanding the checks, potentially with AI for more context-sensitive issues. I haven't measured any throughput improvement from this demo.

## Running it locally

The [deployed app](https://clearpath-reviewos.vercel.app) is the easiest way to try it. If you'd rather run the code, you'll need **Node.js 20.19+** and a Supabase PostgreSQL connection.

```bash
npm install
cp .env.example .env.local
```

Add `DATABASE_URL` to `.env.local` using the Supabase transaction pooler connection string (port `6543`), then run:

```bash
npm run db:schema
npm run seed
npm run dev
```

Open `http://localhost:3000`. The seed script restores the six sample campaigns without removing unrelated submissions.

To run the automated checks:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

`npm run test:db` runs the database integration tests when `DATABASE_URL` is configured. GitHub Actions runs the other checks automatically on pushes and pull requests.

## A note about the demo

ClearPath Financial and the sample campaigns are fictional. This isn't a production compliance tool or legal advice, and it doesn't verify real lending terms. There's no login or role enforcement, so anyone with the link can change the demo data. Please don't enter real company, customer, or other sensitive information.
