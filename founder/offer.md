# Offer: hithozha

Built from the panel's own evidence (`founder/panel/results.md`), not a guess. 9 of 17 passes
cited trust, 8 cited habit, 0 cited price — so this offer stacks trust mechanisms, not a
discount.

## Step 2: the problem list (buyer's words, from the panel + competitor complaints)

**Before booking**
1. "I don't know this app from anywhere" — zero social proof (P001).
2. "No one in my building/WhatsApp group has used it" — repeated in nearly every pass (P005,
   P011, P013, P014, P015, and more).
3. "I already have a guy I call for this" — switching cost against an existing habit (P002,
   P011, P018).
4. "How do I know this verified freelancer is actually any good?" — identity verification
   doesn't prove skill (P016, P020).
5. "Is this app actually in Tamil, or just translated labels?" — authenticity doubt (P007,
   P015).
6. "This feels like it's for English-speaking city people, not people like me" (P008, P011).
7. "I don't trust giving payment details to a new app" (P001, P019).
8. "Will there be enough freelancers near me, or will I open the app and find nobody?" (P003,
   P020).
9. Fake/dead listings on JustDial (`founder/competitors.md`) — primes distrust of any new
   discovery claim, hithozha included.

**During the booking**
10. "What happens if the person doesn't show up or does a bad job — do I get my money back?" —
    the single most repeated concern across both buyers and non-buyers (P004, P008, P012, P018).
11. No visible per-freelancer ratings or completed-job history in the pitch — only "identity
    verified" is shown, which buyers correctly say isn't the same thing (P016, P020).
12. Must enter payment details upfront rather than pay on completion (P001).

**After the booking**
13. No stated guarantee or refund policy — its absence is noted explicitly, unprompted, by
    multiple buyers.
14. No accountability path if something goes wrong, unlike a known personal contact (P002,
    P012).
15. Urban Company's own delay/non-delivery complaints (97 + 52 logged, `founder/competitors.md`)
    show this isn't a hypothetical risk category — it happens even to the market leader.
16. The board's own finding: verification gates packages but not job-bidding — an inconsistency
    that would undermine the "verified" claim the moment a buyer or reviewer probes it.

## Step 3: solutions, trimmed and stacked

| problem | solution | value (1-5) | cost (1-5, estimated — CFO to confirm) |
| --- | --- | ---: | ---: |
| 10, 13, 14 | Escrow-style "Show up or it's free" guarantee: buyer's payment is held, not released to the freelancer, until the buyer confirms the job was done | 5 | 3 (dispute-handling ops cost, not cash cost — the held money was never hithozha's to lose) |
| 4, 11 | Per-freelancer star rating + completed-job count shown before booking, not just an "identity verified" badge | 5 | 2 (product/ops: aggregate existing order data, already captured by the schema) |
| 1, 2, 7, 12 | "Pay on completion" via UPI instead of entering payment details upfront | 4 | 3 (payment-flow rework + fraud-risk review needed) |
| 1, 2 | Honest, real "N completed bookings near you" counter — shown as the true number, including a low or zero count in a brand-new area, never fabricated | 3 | 1 (just a query against real data; the real cost is in `/founder-launch`'s job of making that number non-zero before claiming it widely) |
| 16 | Close the verification asymmetry: require the same identity verification for job-bidding as for packages, or state explicitly why not | 4 | 2 (policy decision + enforcement in the existing RLS/RPC layer) |
| 5, 6 | Native-reviewed Tamil copy throughout the booking flow, not just labels (ties to the earlier Tamil-translation review work already done on the category taxonomy) | 3 | 1 |
| 8 | Honest coverage indicator per category/area ("X verified pros near you") instead of implying universal coverage | 3 | 1 |

Cut from the stack (low value or cost this skill can't justify without more evidence):
- A referral/invite bonus (cash or credit for inviting a neighbour) — plausible given the panel's
  own ask, but needs `/founder-cfo` to confirm what it costs per activated referral before
  promising it. Flagged for the CFO step, not committed here.
- Any buyer-side discount — the pricing step already found price isn't the blocker; a discount
  would spend money solving a problem that wasn't reported.

## The stack

- **The core** (outcome-framed): *Book a local service in Tamil Nadu from a verified pro, and
  don't pay until you know the job was actually done.*
- **Bonus 1 — Per-freelancer rating & job history**, shown before booking, not after.
- **Bonus 2 — Real completed-bookings-near-you counter**, true to the actual number always.
- **Bonus 3 — Pay-on-completion (UPI on delivery)**, no upfront payment details required.
- **The guarantee — "Show up or it's free."** Payment released to the freelancer only after the
  buyer confirms completion; a no-show or a confirmed bad job is refunded from the held funds,
  not from hithozha's own margin. **Cost to hithozha at a realistic claim rate is not yet
  modeled — `/founder-cfo` must confirm this before it's promised publicly.**
- **Urgency (honest, not fabricated):** hithozha is onboarding its first batch of verified pros
  in one chosen city/category at a time (per the board's narrowing condition) — "first batch"
  framing is literally true during that rollout, not a manufactured countdown.
- **The name:** **"Book Safe, Pay on Delivery."**

## Step 4: the value equation, before and after

| element | before | after | what moved it |
| --- | ---: | ---: | --- |
| Dream outcome | 6 | 7 | The core promise is sharpened from "book a verified pro" to "don't pay until the job's actually done" — a clearer, more specific outcome. |
| Perceived likelihood | 3 | 6 | The escrow guarantee and per-freelancer ratings directly answer the panel's two loudest doubts ("verified ≠ good," "what if they don't show"). Not higher than 6: zero real social proof still exists at true cold start, and that can't be manufactured honestly. |
| Time to result | 7 | 7 | Unchanged — the booking flow itself isn't faster or slower. |
| Effort / sacrifice | 4 | 6 | Pay-on-completion removes the single most concrete fear in the panel (handing payment details to an unknown app) — a real reduction in what the buyer risks upfront. |

## Step 5: re-test

New pitch written to `founder/pitch.md` (old one kept as `founder/pitch-v1.md`). Re-running
`/founder-consumer` on the same 20 personas (seed 997448) with the new offer — result below once
the panel completes.
