# Product lens
Score: 4 | Vote: FUND IF

## What is strong

- **A real point of focus exists underneath the sprawl.** Bilingual Tamil/English, narrowed to
  Tamil Nadu specifically rather than a generic pan-India play, is a genuine "one thing" — it is
  a language and geography gap the big international players (Fiverr, Upwork) and the big
  generic Indian ones don't address on purpose. That is a one-sentence pitch Jobs would
  recognize: "Fiverr, but it speaks Tamil and knows Tamil Nadu."
- **The experience has already shipped, not just been imagined.** This is not a deck — it's a
  working Expo/React Native app plus a Supabase backend plus a web presence. The founder is
  iterating on a live product (the taxonomy overhaul), which means the "work back from the
  experience" discipline has something real to work back from.
- **The commission-plus-subscription model is simple to explain to both sides** (pay less
  commission by paying for a plan) — that's a rare case of the monetization itself being
  legible rather than needing a paragraph.

## What would kill it (the top 3, most dangerous first)

1. **The catalog is two different products wearing one skin.** 16 categories / 346
   subcategories span globally-tradeable digital gig work (logo design, app dev — Fiverr/Upwork's
   turf) and hyper-local in-person services (wedding photography, tuition, astrology, handyman —
   Urban Company/JustDial/WhatsApp-group turf). These need different discovery flows, different
   trust signals, different payment/completion semantics, and arguably different apps. Isaacson's
   lens says focus means saying no — 346 subcategories is the opposite of "the one thing this
   must do brilliantly," and it reads like a taxonomy decision made before a product decision.
2. **The trust model has an exposed seam at the moment money and safety matter most.**
   Freelancers need identity verification to publish a fixed-price package, but the brief says
   they can apparently bid on jobs without it. For a marketplace whose entire value proposition
   is trust between strangers — some of it in-person, in someone's home (handyman, tutoring) —
   an inconsistent trust bar is exactly the kind of seam the lens warns about: quality erodes
   fastest at the handoff nobody fully specified. The brief itself flags this as unverified in
   practice, which is the risk, not the reassurance.
3. **The last mile of "owning the whole experience" is currently broken, not just unglamorous.**
   A major taxonomy overhaul (8→16 categories, 346 subcategories) just went to main, but the
   Vercel project expected to serve hithozha.in is linked to an unrelated older repo, and the
   Supabase production migration for the new taxonomy is pending and manual, with no CI/CD. The
   receipt and the follow-up are part of the product too — if the taxonomy a customer sees on the
   website doesn't match what's actually live, or existing listings get orphaned by the
   migration, the "craft in the parts nobody sees" is absent right where it would hurt most: a
   first-time visitor's first five minutes.

## The questions I would ask the founder

- If you had to cut the catalog down to the one category or the one geography you'd stake the
  business on first, what survives — and why ship 16 categories / 346 subcategories before that
  bet is proven?
- Walk me through the first five minutes for a client posting a one-time plumbing job versus a
  client buying a ₹500 logo package. Are these actually one product, or two products you're
  hoping will share a login screen?
- Why does a freelancer need identity verification to sell a fixed package but not to bid on a
  job? What's the reasoning, and what's the plan for when an unverified bidder wins a job that
  goes wrong?
- What happens, concretely, to existing listings and freelancer profiles tagged under the old
  8-category scheme once the new 346-subcategory migration runs in production?
- If a Tamil Nadu user described this app to a friend in one sentence, what sentence do you want
  it to be — and does the current catalog breadth support that sentence or fight it?

## If FUND IF: the conditions

- Pick one side of the catalog (either the globally-tradeable digital-gig side or the hyperlocal
  in-person side) as the launch focus, and treat the other as a later expansion, not a parallel
  day-one offering — even if both stay in the codebase.
- Resolve the verification asymmetry before growth spend: either verification gates all
  transacting freelancers (jobs and packages alike) or there's a documented, deliberate reason
  it doesn't, with a mitigation for the in-person-service fraud/safety case specifically.
- Fix and confirm the production path end to end — correct domain-to-repo linkage on Vercel, the
  Supabase taxonomy migration run and verified in production, and some minimal CI/CD or
  pre-release checklist — before the next feature push, so the next change doesn't repeat this
  gap.
- Open questions this lens can't answer and shouldn't guess at: market size and demand for the
  hyperlocal side specifically (`/founder-competitors` for who already serves it, `/founder-consumer`
  for whether Tamil Nadu buyers want it in-app versus WhatsApp/JustDial), and CAC/conversion
  economics for running two very different marketplaces under one app (`/founder-cfo`).
