# Competitor map: hithozha

Public sources only, every fact linked. Where a figure could not be independently verified in
this pass, it is marked so rather than guessed at.

## The table

| Name | Type | Price/take rate | What it sells | Rating / reviews |
| --- | --- | --- | --- | --- |
| [Fiverr](https://www.fiverr.com) | Direct | 20% flat seller commission + ~5.5% buyer fee (~27.7% total take rate) | Fixed-price gigs, digital/creative | Not found this pass |
| [Upwork](https://www.upwork.com) | Direct | Variable 0-15% freelancer fee (since May 2025), ~10% typical | Bid-based jobs + fixed contracts, digital/creative/professional | Not found this pass |
| [Urban Company](https://www.urbancompany.com) | Direct | 25% commission (cut from 30% in 2021) | Fixed-price, verified-pro home services | ~4.8 / ~1.17M (iOS, India, aggregated) |
| [JustDial](https://www.justdial.com) | Indirect | ~₹2,000/mo paid listing (unconfirmed) | Local business directory, lead-gen only (no checkout) | 1.7 / 3-62 (self-selected complaint sites) |
| [Workers app](https://www.appgoblin.info/apps/com.worker26.workers) | Indirect | Not found this pass | Local-services marketplace, supports Tamil among 5 languages | Not found this pass |
| [ManyJobs.com](https://www.matrimony.com/node/2393) | Indirect | Free to seekers (unconfirmed revenue model) | Tamil Nadu job board, frontline/entry-level roles | Not found this pass |
| WhatsApp groups / local referral | Substitute | Free | How most hyper-local services are actually found in Tamil Nadu today | n/a |

Full detail in `founder/competitors.csv`.

## Price range

No single comparable "item" exists across these — Fiverr/Upwork/Urban Company are all
commission-on-transaction models, not fixed menus, so the honest comparison is take rate, not
item price:

- **Lowest take rate:** Upwork, ~10% typical (variable 0-15%).
- **Median:** Urban Company, 25% flat.
- **Highest:** Fiverr, ~27.7% all-in (20% seller commission + ~5.5% buyer fee).
- **hithozha's current ~5% default commission** undercuts all three by a wide margin — this is
  real and verifiable, not a rounding difference. It is the clearest, most defensible fact in
  this whole map.

## Positioning map (text)

Two axes that matter here: **price (platform take rate)** vs. **trust/verification depth**.

```
High take rate   |  Fiverr (27.7%, open marketplace,            Urban Company (25%, verified
                 |  minimal vetting, race-to-bottom pricing      pros, fixed price, India-
                 |  per Skydo's analysis of Indian sellers)      specific trust layer)
                 |
                 |  Upwork (~10%, bid-based, client vets
                 |  freelancer directly)
Low take rate    |  JustDial (lead-gen only, no escrow,          hithozha (~5% commission,
                 |  no transaction, "fake enquiry"               verification gates packages
                 |  complaints)                                  but not job-bidding --
                 |                                                see the gap below)
                 +------------------------------------------------------------------------
                   Low trust/verification depth              High trust/verification depth
```

WhatsApp groups / local referral sit off this grid entirely: zero take rate, and trust comes
from the personal relationship, not a platform mechanism — which is exactly why they're a
substitute, not a competitor. No platform fee beats free.

## What their customers complain about (ranked, linked)

1. **Promised service not delivered / delayed — Urban Company.** The government consumer
   helpline logged 97 "delay in providing promised service" and 52 "promised service not
   provided" complaints (Jan 1 – Jul 22, 2025) — [source: consumerhelpline.gov.in via search
   summary](https://consumerhelpline.gov.in/public/dashboard/sectorcompanyNatureWise/20/2825).
   Thin but consistent with the brand's core promise (verified pros) under real strain.
2. **Fake leads / fake enquiries — JustDial.** Multiple independent complainants on
   [Voxya](https://voxya.com/company/justdial.com-complaints/10312) describe receiving "not a
   single genuine enquiry," all fake. This is the clearest articulated gap in the whole map:
   JustDial sells *discovery*, not a transaction, so nobody is accountable when the lead is junk.
3. **Funds held / account suspended without clear process — Fiverr.** A Trustpilot reviewer
   reports funds held 121 days with "zero support"; Indian sellers on a forum describe clients
   suspending active contracts specifically to withhold final payment — [source: Trustpilot via
   search summary](https://www.trustpilot.com/review/fiverr.com?page=3). Thin sample (anecdotal,
   not a counted theme) but it's a structural complaint about dispute resolution, which matters
   directly to the board's "no guarantee, no escrow" condition on hithozha.
4. **Worker-side burden, not buyer-side — Urban Company.** A 2024 Al Jazeera report describes
   partners facing qualifying fees, compulsory product purchases, and account blockings. Not a
   buyer complaint, but relevant: hithozha's freelancer-side economics (commission + plans) will
   face the same scrutiny if freelancers feel squeezed.
5. **Billing without consent — JustDial.** Complainants describe listings created without their
   consent and recurring ECS payments continuing after a business closed. Thin (self-selected
   complaint-site sample), flagged as thin per the skill's own rule.

## The gap

Two gaps, matching the board's finding that this is two businesses:

- **On the hyper-local side:** nobody in this map combines (a) a real transaction with escrow-
  style trust, (b) Tamil-language-first UX, and (c) a take rate under 25%. Urban Company has (a)
  but not (b) and charges 5x hithozha's commission. JustDial has neither (a) nor (b) — it doesn't
  even complete a transaction, which is exactly what its "fake enquiry" complaints are about.
  WhatsApp/referral has (b) informally and (a) informally, at zero cost, which is the real
  competitor to beat, not a company. **The gap is real but narrow**: it only holds if hithozha
  actually ships the verification/escrow layer the board flagged as currently missing on the
  job-bidding side. Without that, hithozha isn't ahead of Urban Company on trust — it's behind it
  with a cheaper price tag, which is not the same gap.
- **On the digital-gig side:** the gap is much weaker. Fiverr and Upwork have global liquidity,
  established buyer trust, and (per this search) no confirmed Tamil-first competitor exists —
  but a lower commission alone doesn't address why a global buyer would choose a Tamil Nadu-
  specific app over Fiverr's existing scale, and Tamil-speaking *sellers* can already sell on
  Fiverr/Upwork to global buyers today. This side's gap is thin; it matches the board's Monopoly
  lens finding that breadth here dilutes rather than strengthens the thesis.

## The threat

**ManyJobs.com (Matrimony.com group)** is the most credible fast-copy threat found in this
search — not because it does the same thing today (it's a job board, not a services
marketplace), but because its parent, Matrimony.com, is an existing large, funded, Tamil
Nadu-literate consumer company that already ships bilingual Tamil/English apps at scale and
already moved into adjacent Tamil Nadu local-market apps in November 2024. If any player can
credibly launch a Tamil-first services marketplace fast, with distribution Tamil Nadu already
trusts, it's a company like this, not a Fiverr/Urban Company clone from outside. This matches
the Monopoly lens's warning that the language edge is "real but thin and copyable."

The **Workers app** is a second, quieter threat: a local-services marketplace that already
supports Tamil among five languages. It was not confirmed as Tamil Nadu-specific or Tamil-first
in this pass, and its scale/ratings weren't found — but its existence means hithozha cannot
claim to be the only multilingual local-services marketplace that happens to support Tamil; it
can only claim to be built *for* Tamil Nadu first, which is a positioning claim, not yet a
structural moat.

**Next step:** `/founder-consumer` — the fake-enquiry and delayed-service complaints above give
real objections to test on the simulated buyer panel, instead of assumed ones.
