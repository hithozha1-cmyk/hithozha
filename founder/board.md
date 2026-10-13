# Board verdict: hithozha

**Vote: 2 fund if, 1 pass** (Offers: FUND IF, Monopoly: PASS, Product: FUND IF)
**Average score: 3.7 / 10** (Offers 4, Monopoly 3, Product 4)

## The risks more than one member raised

These go first because three independent readings of the same brief landed on them without
being told to.

1. **The catalog is two different businesses wearing one skin.** All three members flagged this
   as the single biggest problem, in their own words: Offers called it "cold-start liquidity
   spread across too many markets at once," Monopoly called it "breadth works against the
   small-market thesis," Product called it "two different products wearing one skin." 346
   subcategories span globally-tradeable digital gig work (competing with Fiverr/Upwork on their
   own turf) and hyper-local in-person services (competing with a free WhatsApp referral or
   JustDial). These need different discovery flows, different trust mechanics, and arguably
   different go-to-market plays — launching all of it at once dilutes the one real narrowing move
   (Tamil Nadu, Tamil language) that every member agreed was the strongest card in hand.

2. **The trust/verification model has an unexplained seam.** Freelancers need identity
   verification to publish a fixed-price package, but can apparently bid on jobs without it, and
   the brief states the fraud/trust outcome of that split is unknown. All three members called
   this out as a real risk, not a nitpick — Product put it sharpest: "quality erodes fastest at
   the handoff nobody fully specified."

3. **The production pipeline is currently broken, and that's part of the product, not separate
   from it.** The Vercel project expected to serve hithozha.in is linked to an unrelated older
   repo, and the Supabase migration for the new 346-subcategory taxonomy that just shipped to
   `main` is pending and manual. Product flagged this hardest (a mismatch between what the
   taxonomy migration changed and what's actually live would orphan listings or show a
   first-time visitor a broken catalog), and Offers independently said not to spend on
   acquisition until this is fixed.

4. **No visible distribution/liquidity plan.** Raised most sharply by Monopoly: nothing in the
   brief describes how the first 100 freelancers and first 100 clients actually show up in the
   same place at the same time. Without that, the Tamil Nadu narrowing is "a map, not a
   strategy."

## The conditions, merged into one checklist

- [ ] **Narrow the launch focus to one side of the catalog** — either the globally-tradeable
  digital-gig subcategories or the hyper-local in-person ones — and treat the other as a later
  expansion, not a parallel day-one offering. (All three members, independently.)
- [ ] **Close the verification gap.** Either require identity verification before any paid
  engagement (job or package), or document the specific trust/dispute mechanism that makes an
  unverified job-bidder acceptable to a client — and say which one, on purpose, not by omission.
- [ ] **Ship a concrete guarantee or escrow mechanism** (e.g. client payment held until delivery
  is confirmed, with a defined refund path) before increasing paid acquisition spend. (Offers.)
- [ ] **Fix the production pipeline end to end** before the next feature push: correct the
  Vercel-to-repo linkage, run and verify the Supabase taxonomy migration in production, and put
  some minimal pre-release checklist or CI/CD in place so this gap doesn't repeat. (Product,
  Offers.)
- [ ] **State a concrete, costed channel for the first 100 freelancers and first 100 clients** —
  not a hope, a plan. (Monopoly.)
- [ ] **Get real usage numbers, even from a small pilot**, rather than continuing to build catalog
  breadth on an unvalidated base. (Monopoly.)

Most of these conditions are exactly what `/founder-competitors`, `/founder-consumer`, and
`/founder-cfo` are built to test — the board flagged the open questions, it didn't guess at the
answers.

## The strongest version of this business the board can see

Not "a Tamil Nadu Fiverr with 346 categories." The strongest version is narrower: **a trusted,
Tamil-language marketplace for one tightly-scoped slice of hyper-local, in-person services in
Tamil Nadu** — the side where a language/trust edge over a WhatsApp group or JustDial listing is
real and hard to copy quickly, rather than the side where the product is competing head-on with
Fiverr and Upwork's existing global liquidity on their own terms. That version picks one or two
subcategories with the clearest evidence of real demand, builds a verification and
guarantee/escrow story solid enough that a first-time user trusts a stranger in their home, fixes
the production pipeline so the live app matches what shipped, and proves liquidity in that one
corner before the catalog grows back out to 346. This differs from the pitch as given — the
pitch is breadth-first across 16 categories; the board's strongest version is depth-first in one.

**Next step:** `/founder-competitors` — map who already serves Tamil Nadu buyers in the
candidate hyper-local categories (and what Fiverr/Upwork charge the digital-gig side), before
`/founder-consumer` tests whether a Tamil Nadu buyer actually switches.
