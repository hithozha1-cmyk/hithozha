# Board brief: hithozha

(This brief plus `founder/idea.md` is everything you need — you cannot see the founder's
conversation.)

## The business

hithozha is a bilingual (Tamil/English) freelance marketplace app for Tamil Nadu, India. Clients
post one-time, monthly, or part-time jobs, or buy fixed-price service packages from freelancers.
It's built on Expo/React Native (mobile) + Supabase (backend), with a web app at hithozha.in.
Positioning: a localized, India-first Fiverr/Upwork hybrid, but narrowed specifically to
Tamil-speaking users in Tamil Nadu — not a generic pan-India play.

## Catalog

16 broad categories, 346 subcategories: Writing & Translation, Graphics & Design, Video &
Animation, Music & Audio, Programming & Tech, AI & Data, Digital Marketing, Business & Finance,
Admin & Customer Support, Engineering & Architecture, Education & Training, Health & Wellness,
Lifestyle & Personal Services, Gaming & Esports, Web3 & Emerging Tech, Digital Products &
Templates. Covers everything from logo design and app development to wedding photography,
tuition, astrology consulting, and handyman repairs — i.e. both globally-tradeable digital
services (competing with Fiverr/Upwork directly) and hyper-local in-person services (competing
with nothing international, more like a Tamil Nadu Urban Company/JustDial/local WhatsApp groups).

## Two-sided mechanics

- **Freelancers**: must pass identity verification before they can publish a fixed-price package
  (jobs they can bid on without it, presumably — not fully specified). Pay commission on
  completed orders, default ~5%, lower on paid plans. Paid plans also raise how many open
  packages/jobs they can have live at once.
- **Clients**: can post jobs directly (one-time, monthly recurring, or part-time) or buy a
  freelancer's fixed package outright. Paid client plans raise how many open jobs they can have
  live at once.
- **Admin**: an internal token system where admins grant tokens/perks to users (mechanism and
  purpose not fully specified in this brief — treat as a loyalty/support lever, not a primary
  revenue line).

## Revenue model

1. Commission on completed orders (~5% default, reduced for paid-plan freelancers).
2. Freelancer subscription plans (higher limits, lower commission).
3. Client subscription plans (higher open-job limits).
No other revenue lines mentioned (no ads, no lead-gen fees, no featured-listing upsells
mentioned — don't assume they exist).

## Status

Already built, not a pre-launch concept. The founder just shipped a major category-taxonomy
overhaul (old flat 8 categories → 16 categories / 346 subcategories) to the main branch. The
production deployment pipeline is currently unclear/unconfirmed: the Vercel project expected to
serve hithozha.in was found linked to an unrelated older repo, and the Supabase production
database migration for the new taxonomy is pending, run by the founder manually (no CI/CD
migration automation exists). Real user/traction numbers were not given — treat market
validation and current scale as unknown, not zero and not large.

## What is NOT known (don't invent these)

- Current user count, GMV, or revenue to date.
- Customer acquisition cost or channel performance.
- Specific competitor pricing or market share in Tamil Nadu specifically.
- Whether the "jobs" side (bid without verification) vs "packages" side (requires verification)
  has different trust/fraud outcomes in practice.
- Any funding, runway, or team size.
