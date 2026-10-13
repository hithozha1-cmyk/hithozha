# Pricing: hithozha

## An important correction before the numbers

The consumer panel's four price questions ("too cheap / a bargain / getting expensive / too
expensive") asked buyers what they'd pay **for a local-service booking** — that's the
freelancer's price to the buyer, which hithozha doesn't set. hithozha's own price, the thing it
actually controls, is the **commission it takes from the freelancer** (currently ~5% default,
lower on paid plans) plus the **subscription plan prices** for freelancers and clients. Both
matter here, but they are not the same number, and the van Westendorp range below answers the
first question, not the second.

## Step 1: what buyers said (booking price, for context)

From `founder/pricing-curve.md` (20 complete answers, all given in ₹ per the panel transcripts —
the tool's `$` labels are a generic currency placeholder, read every figure below as rupees):

| point | price | meaning |
| --- | ---: | --- |
| PMC | ₹298.89 | below this, too many think it's too cheap to be good |
| OPP | ₹303.04 | least resistance point |
| IPP | ₹708.32 | as many call it a bargain as call it expensive |
| PME | ₹1,497.05 | above this, too many won't buy |

**Acceptable range for a typical single local-service booking: ₹299 to ₹1,497.** Useful as a
sanity check for the freelancers who set prices on hithozha, not as hithozha's own price.

**The more important finding from the panel isn't in this table:** of the 17 buyers who passed,
9 cited trust and 8 cited habit as the reason — zero cited price as the primary blocker, and one
buyer (P019) said explicitly "money is not his real barrier, trust is." **Price is not currently
the binding constraint on hithozha's hyper-local side.** Discounting the commission further, or
running a buyer-side promotion, would not move the buy rate on this evidence — the panel's own
"what would flip a no" answers (`founder/panel/results.md`) are almost entirely about social
proof, not cost. Treat that as the headline for `/founder-marketing` and `/founder-offer`, not
this pricing table.

## Step 2: what competitors charge (take rate, not booking price)

From `founder/competitors.md` — these are platform commissions, the actual lever hithozha
controls, compared like-for-like:

| platform | take rate |
| --- | ---: |
| Upwork | ~10% typical (variable 0-15%) |
| Urban Company | 25% (cut from 30% in 2021) |
| Fiverr | ~27.7% all-in (20% + ~5.5% buyer fee) |
| **hithozha** | **~5% default, lower on paid plans** |

hithozha's commission undercuts every one of these by a wide margin. That is real and
verifiable — but the panel result above means it is not currently the thing winning or losing
buyers. It matters more to the *freelancer's* decision to list on hithozha over a competitor
than to the *buyer's* decision to book through it.

## Step 3: what the business needs

**Not available yet.** `/founder-cfo` hasn't run, so there is no `founder/numbers.json` and no
unit-economics check on whether 5% commission covers hithozha's own costs (payment processing,
support, verification checks) at realistic order volumes. This is a genuine open question, not a
guess — flagged here per this skill's own rule ("do not invent a range"), and will be revisited
once `/founder-cfo` produces real numbers. If 5% turns out too thin to cover costs, that's a
constraint from the business side, independent of what buyers said.

## Step 4: the decision

1. **The commission price stays at ~5% for now** — not because the panel asked for a lower
   number (it didn't; price wasn't the blocker), but because it's already a genuine, defensible
   differentiator against every competitor in the map, and because there is no evidence yet
   (pending `/founder-cfo`) that it's unsustainable. **This is provisional, not final — revisit
   the moment the CFO numbers exist.**
2. **The ladder is the subscription plans, not booking price**: a free tier (current ~5%
   commission, base limits), and paid freelancer/client plans (lower commission, higher open-
   job/package limits) — which the brief says already exists as a mechanic. The step-up reason
   for each rung should be capacity (more open jobs/packages) and take-home (lower commission),
   not a buyer-facing discount, since buyers aren't the ones price-blocked.
3. **No opening offer on price.** Given the panel's finding, a launch discount on commission or
   booking price would spend money solving a problem buyers didn't report having. The opening
   offer that would actually move the buy rate is a **trust offer**, not a price one — see
   `/founder-offer`, next.
4. **What to test with real buyers:** not two prices — two *trust signals*, since that's what
   the panel says actually gates the decision. For example: (a) a visible "N people in your area
   have booked through hithozha" counter vs. (b) a specific no-show/bad-job refund guarantee
   stated up front. Test which one moves a real pilot group's booking rate more; price A/B
   testing is not the next experiment to run on this evidence.
5. **The panel's top three price-adjacent quotes** (for marketing to have on hand, even though
   they're not the dominant objection):
   - "The 5% fee instead of 25% and having it in Tamil are real pluses, so I'd try it once for
     something low-risk like a home cleaning, but that's as far as I'll go on a first try."
     (P016)
   - "Naan JustDial-la rendu moonu number call pannitu than aalu edukuven, but pathi per phone
     eduthadhe illa, fake listing dhan. Idhula identity verification iruku nu sonnudhadhal,
     konjam risk kammi irukum nu feel aguthu." (P004 — on the verification claim mattering more
     than the fee)
   - "money is not his real barrier, trust is" (P019, paraphrased from the panel's own summary)

**Next step:** `/founder-offer` — build the trust-answering offer the panel is actually asking
for (a guarantee, visible social proof, or both) before `/founder-cfo` checks whether the
business can afford to keep commission at ~5% while paying for whatever that offer costs.
