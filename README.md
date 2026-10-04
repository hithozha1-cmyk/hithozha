# Hithozha

Tamil Nadu's freelance marketplace, as a mobile app. Hire local talent or get paid for your skills.

**Phases 1, 1.5 and 2** (this repo): auth (email + password with an emailed code), onboarding for freelancers and clients (individuals or companies), profiles, company pages with business verification, jobs, proposals, chat with contact-detail scanning, orders with Razorpay escrow, and reviews. Orders, chat, search and payments (Razorpay) come in later phases.

## Stack

- Expo SDK 57, TypeScript (strict), Expo Router
- Supabase: Postgres, Auth, Edge Functions (Deno)
- Cloudflare R2 for images (presigned uploads)
- i18next for Tamil (`ta`, default) and English (`en`)

## Quick start

```bash
npm install
cp .env.example .env      # then fill in the two values below
npx expo start            # scan the QR code with Expo Go
```

`npm run typecheck` runs the TypeScript check.

## Environment

The app reads only two public values from `.env`:

| Variable | Where to get it |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same page → `anon` `public` key |

Everything else is a **secret and lives only in Supabase Edge Function secrets**. Never put the service role key, R2 keys, or Razorpay secrets in `.env`.

| Secret (Edge Function) | Where to get it |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare dashboard → R2 → Overview → Account ID |
| `R2_ACCESS_KEY_ID` | R2 → Manage R2 API Tokens → create token → Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Same token screen (shown once) |
| `R2_BUCKET` | The bucket name you create below |
| `R2_PUBLIC_URL` | The bucket's public URL, e.g. `https://pub-xxxx.r2.dev` or your custom domain |
| `RAZORPAY_KEY_ID` | Razorpay dashboard → Settings → API Keys (use Test Mode while building) |
| `RAZORPAY_KEY_SECRET` | Same page (shown once) |
| `RAZORPAY_WEBHOOK_SECRET` | A random string you choose, then paste into the Razorpay webhook (see section 3) |
| `RESEND_API_KEY` | Resend dashboard → API Keys. Used by `review-identity` to email freelancers when their ID check is approved or rejected |
| `EMAIL_FROM` | Optional. e.g. `Hithozha <hello@yourdomain.com>`. Defaults to Resend's test sender, which can only email the Resend account owner until you verify a domain |
| `APP_URL` | Optional. The link in those emails. Defaults to `https://hithozha.in` |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected into Edge Functions automatically.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Link the CLI and run the migrations (they create the tables, RLS policies, the signup trigger, and seed the categories):

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   Or paste the eighteen files in `supabase/migrations/` into the SQL editor, in order.

### Email and password sign-up with a verification code

Users create an account with an email and password (minimum 8 characters), then enter a code emailed to them. Returning users sign in with email and password.

1. Authentication → Sign In / Providers → Email: enable the provider and keep **Confirm email** on.
2. Authentication → Emails → templates. The **Confirm sign up** template must contain `{{ .Token }}` so the email shows the code. A ready-made branded template is in `supabase/templates/otp-code.html`.
3. **Email OTP Length** can be anything from 6 to 8. The app accepts 6 to 8 digits.
4. **Forgot password** also uses a code. Edit the **Reset password** template the same way (it must contain `{{ .Token }}`). A ready-made one is in `supabase/templates/reset-password.html`. While the code is being verified the app stays on the reset screen, because verifying signs the person in before they have chosen a new password.
5. Email delivery: Supabase's built-in sender is heavily rate limited. Use your own SMTP (for example Resend) under Authentication → SMTP Settings. Until you verify a sending domain, Resend only delivers to your own account email.

### Making someone an admin

`is_admin` cannot be changed from the app. Run this in the SQL editor:

```sql
update public.profiles set is_admin = true where id = '<auth user id>';
```

## 2. Cloudflare R2 and the upload function

1. R2 → Create bucket (for example `hithozha-media`).
2. Make the bucket publicly readable: bucket → Settings → Public access → enable the `r2.dev` URL (or connect a custom domain). Use that URL as `R2_PUBLIC_URL`.
3. Create an API token: R2 → Manage R2 API Tokens → *Object Read & Write*, scoped to the bucket. Note the Access Key ID and Secret.
4. CORS (bucket → Settings → CORS policy). The native app is not subject to CORS, but this keeps web or future uses working:

   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["Content-Type", "Content-Length"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

5. Set the secrets and deploy:

   ```bash
   npx supabase secrets set \
     R2_ACCOUNT_ID=... \
     R2_ACCESS_KEY_ID=... \
     R2_SECRET_ACCESS_KEY=... \
     R2_BUCKET=hithozha-media \
     R2_PUBLIC_URL=https://pub-xxxx.r2.dev

   npx supabase functions deploy r2-presign
   ```

### `r2-presign` contract

`POST /functions/v1/r2-presign` with the user's JWT (the app does this through `supabase.functions.invoke`).

Request: `{ "kind": "avatar" | "portfolio" | "company_logo", "contentType": "image/jpeg" | "image/png" | "image/webp", "size": <bytes> }`

Size limits: 5 MB for `avatar` and `portfolio`, 2 MB for `company_logo`. The app shrinks avatars and portfolio images to 800px (JPEG) and logos to 400px (PNG, so transparency survives).

`size` is required in addition to `kind` and `contentType`: R2 enforces the signed `Content-Length`, which is how the size cap is actually held.

After changing this function, redeploy it (`npx supabase functions deploy r2-presign`, or paste the new code into the dashboard editor).

Response: `{ "uploadUrl", "publicUrl", "key", "expiresIn" }`. Keys look like `{kind}/{userId}/{uuid}.{ext}`. The URL expires after 5 minutes.

## 3. Razorpay payments

Three more Edge Functions handle money. The app never talks to Razorpay directly and never sends an amount: the price always comes from the database.

| Function | Verify JWT | What it does |
| --- | --- | --- |
| `create-payment` | on | Creates a Razorpay payment link for an order the caller is the client of. Reuses an open link instead of making a second one. |
| `razorpay-webhook` | **off** | Receives `payment_link.paid`, checks the Razorpay signature, and marks the order paid. Idempotent, so retries are harmless. |
| `cancel-order` | on | Cancels an unpaid order. It cancels the Razorpay link first and refuses if the link was just paid. |
| `review-identity` | on | An admin approves or rejects an identity check. The decision is the `admin_review_identity` database function (which refuses non-admins); then the freelancer is emailed in their language. If the email fails the decision still stands and the admin is told. Deploy it, or admins cannot approve checks. |

Set up:

1. In Razorpay (start in **Test Mode**), create API keys and add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` as Edge Function secrets.
2. Deploy the three functions. **`razorpay-webhook` must have "Verify JWT" switched off** (Razorpay cannot send a Supabase token; the signature check protects it instead). `supabase/config.toml` already says so if you deploy with the CLI. In the dashboard editor, switch it off in the function's settings.
3. In Razorpay → Settings → Webhooks, add:
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/razorpay-webhook`
   - Secret: any long random string. Save the same string as the `RAZORPAY_WEBHOOK_SECRET` Edge Function secret.
   - Event: `payment_link.paid`
4. Test with Razorpay's test UPI id `success@razorpay` or its test cards.

How the money works (escrow):

- The client pays the full price. Razorpay collects it into **your** Razorpay account, so it is held there.
- When the client taps **Approve and release payment**, the payment is marked `released`. That is a ledger entry: it says the freelancer is owed their earnings (price minus the 5% fee).
- **Paying the freelancer is not automated.** After release, send the freelancer their earnings yourself (UPI or bank transfer), or connect RazorpayX Payouts later. The order screen tells freelancers "Hithozha will pay out" the amount.
- Refunds are also manual in the Razorpay dashboard. The webhook logs `REFUND NEEDED` if a payment arrives for an order that was cancelled.

## Database

| Table | Purpose |
| --- | --- |
| `profiles` | One row per user, created by a trigger on signup. Name, city, language, role, verification status. |
| `freelancer_profiles` | Headline, skills, experience level, languages, availability, starting price (paise), bio, education, portfolio images, plus system-managed rating and order counters and premium flag. |
| `proposals` | A freelancer's offer on a job: message, price, delivery days, status. |
| `conversations`, `messages` | One chat per proposal. Messages are saved only through `send_message()`. |
| `chat_violations` | Every redaction, with the original text, for trust and safety. No client access. |
| `orders` | A hired proposal: amounts in paise, the 5% fee, and its status. |
| `payments` | The escrow ledger. Written only by the Edge Functions. |
| `reviews` | One rating and comment per completed order. |
| `jobs` | Work posted by clients: type, budget, hours, location and status, optionally under a company. |
| `companies` | One per client who hires as a company: name, logo, website, LinkedIn, team size, industry, city, about, and a verification status. GST and Udyam numbers are private to the owner. |
| `categories` | Seeded service categories with Tamil and English names. |

Security model: RLS is on for every table, and column-level grants back it up. Users can update only their own `profiles` row, and never `is_admin` or `verification_status`. `phone` and `is_admin` are not readable from the client (service role and Edge Functions only), so the app selects an explicit column list. Categories are public to read and admin-only to write.

### Companies and business verification

- `profiles.client_type` is `individual` or `company` (null for pure freelancers, enforced by a constraint).
- Any signed-in user can read a company's public fields. `gst_number` and `udyam_number` are not selectable through the table API; the owner reads them through the `get_my_company()` function.
- `verification_status` cannot be written by users. They call `submit_company_verification(p_gst, p_udyam)`, which stores the number and moves the status to `pending`. GST (15 characters) and Udyam (`UDYAM-XX-00-0000000`) formats are enforced by CHECK constraints, and one number can back only one business.
- A reviewer decides the outcome with the service role, for example in the SQL editor:

  ```sql
  update public.companies set verification_status = 'verified' where id = '<company id>';
  -- or 'rejected' (the owner can then submit again)
  ```

### Jobs

Clients (individuals and companies) post jobs; everyone signed in can browse open ones.

- `job_type` is `one_time`, `monthly` or `part_time`. `hours_per_week` is set only for `part_time` (and always for it), enforced by a CHECK constraint. For `monthly` and `part_time` jobs the budget is a monthly budget, and the Post a job form labels it "Monthly budget".
- `company_id` references `companies` and is null for individuals. A company client's jobs are posted under the company automatically, and RLS only lets you attach a company you own.
- Budgets are stored as integer paise (`budget_min_paise`, `budget_max_paise`). In-person jobs must have a city.
- RLS: signed-in users read open jobs, and posters also read their own closed ones. Only clients can post. After posting, the only field a poster can change is `status` (the Close job button).
- Job cards and the job detail screen show the company logo, name, a "Verified business" badge (for verified companies) and a job type chip. Individuals show their name and photo instead.
- The Browse tab lists open jobs (newest first, pull to refresh). The company page (`app/company/[id].tsx`) lists that company's open jobs. Client users see a Post a job button on Home.

Not built yet: editing a job after posting.

### Finding work and keeping a profile

- **Browse** has a search box and filters for category, job type and city. Search looks in titles and descriptions and ignores punctuation (so it cannot be used to inject filter syntax). Tapping a category tile or searching from Home opens Browse with that choice already applied.
- **Edit profile** (Profile tab) changes name, city and photo. Freelancers also get **Edit freelancer details**, which uses the same form as onboarding (headline, services, experience, languages, availability, starting price, bio, education, portfolio), and **View my public page**.

### My jobs, earnings, badges, admin and legal pages

- **My jobs** (Profile tab, for clients) lists every job posted with how many proposals are waiting. A poster can fix the **title, description and budget** of an open job; category, type and place are locked, and a job that already has an order cannot be edited at all (enforced by a row level security policy).
- **Earnings** (Profile tab, for freelancers) shows three totals: *in escrow* (client paid, not yet approved), *released, awaiting payout* (approved, Hithozha still owes it) and *paid out*. An admin records a payout with **Mark as paid out**, which sets `payments.paid_out_at`.
- **Tab badges** show unread messages and orders waiting for you to act (client: pay or approve; freelancer: deliver). They come from `my_badges()`, update live through Supabase Realtime, and unread state is stored per person in `conversation_reads`.
- **Disputes.** Either person on a paid order can tap *Report a problem*; the order freezes (no delivery, no approval) until an admin decides: pay the freelancer, refund the client in full, or split (fee is 5% of what the freelancer keeps). The opener can withdraw before a decision. Both people see the decision and the admin's note. Opening the chat from the admin panel is audit-logged.
- **Identity checks.** A freelancer sends an ID photo and a selfie (Profile → Verify your identity). They go to a private Supabase Storage bucket `identity`: only the person can upload (into their own folder), nobody can read them except admins, and admins only through links that expire after 60 seconds. The admin approves or rejects, then **deletes the photos by hand** from the admin panel (Identity checks → Photos to delete, with a delete-all button); the app tells users and admins that photos are deleted after verification, and the Privacy page says so. Only the result stays on record. Opening, deciding and deleting are all audit-logged. **New freelancer-only accounts wait on a holding screen** (`app/verification.tsx`) after sign-up until an admin approves; the screen checks every 20 seconds and lets them in on its own, and they get an approval or rejection email (with the reason). People who also hire can use the app meanwhile but cannot apply to jobs until verified (enforced by a database policy, migration 13).
- **Notifications.** A bell on the Home screen (with an unread count that updates live) opens the inbox. The database writes the notifications itself with triggers, so nothing can forget to and nobody can send one to someone else: new proposal, proposal declined, hired, payment received, work delivered, order approved, order cancelled, new message (one per chat until read), review, payout sent, dispute opened/withdrawn/decided, identity and business verification results. People can only read their own and mark them read. Not built yet: push notifications to the phone (needs a native build and push tokens) and email alerts (needs a verified Resend domain).
- **Application credits.** Every freelancer gets 10 free applications per calendar month (India time). A database trigger enforces it, counting withdrawn and declined proposals too, so it cannot be dodged; the apply screen shows how many are left and when they come back, and says clearly when none are. `application_allowance()` is the one place where purchased packs (planned: 10 for Rs 49) will be added once Razorpay is live. The Terms page says applications are free up to 10 a month.
- **Admin panel** (Profile tab, admins only; sidebar on wide screens, tabs on phones). Sections: Overview (today's numbers, money held, commission by day or month), Users (search, activity, suspend with a reason, restore), Jobs (search, close spam), Orders (payment and payout status), Disputes (read the chat, then refund, release or split), Identity checks (ID photo + selfie review, then delete the photos), Verifications (GST/Udyam shown masked in the list, in full only after opening a business, which is logged), Flagged chats (original text), Payouts (shows the freelancer's UPI id; you pay outside the app, then record the bank reference/UTR), Categories (Tamil + English names, hide or show), and the Audit log.
  - **Security:** every admin function begins with `require_admin()` in the database, so hiding the screen is only a convenience. Every approve, reject, payout, suspension, job close, category change and full-number view writes a row to `admin_audit_log`, which nobody can read or write directly. A suspended user cannot post jobs, apply, message or be hired (database triggers). Freelancers save where to be paid on the Earnings screen (`payout_details`, readable only by them and admins).
  - **Not built yet** (needs features that do not exist): withdrawal requests, Razorpay refunds (refunds are sent by bank transfer and recorded with a UTR for now), push announcements, featured listings/boosts. Make someone an admin with the SQL under "Making someone an admin".
- **Legal pages** (Terms, Privacy, Refund and Cancellation, Contact) are public screens, linked from the welcome screen, in Tamil and English. Their text is in `src/legal/content.ts`. These are plain-language drafts that match how the app works: **have a lawyer review them before launch**, and fill in `BUSINESS.phone` and `BUSINESS.address` in that file (empty values are hidden).

### Phone push notifications (Android, built on GitHub)

**How it works.** Every in-app notification is also sent to the person's phone. After sign-in an Android phone registers its own Firebase (FCM) token (`register_push_token`; removed again on sign-out). When a row is added to `notifications`, a database trigger (`push_on_notification`, using `pg_net`) calls the `send-push` Edge Function, which looks up the person's phones and language and sends the push straight to Firebase. Tapping a push opens the same screen the inbox does. Phones Firebase reports as gone are forgotten. It does nothing on the website or an emulator. No Expo account is needed. (An iPhone would register an Expo push token instead; that comes later with the Apple Developer account.)

**Setup, once:**
1. Run migrations `20261003000015`, `16` and `17`.
2. Deploy `send-push` with **Verify JWT off** (the trigger sends a shared secret, not a user JWT). Add two Edge Function secrets: `PUSH_WEBHOOK_SECRET` (a long random string you choose) and `FIREBASE_SERVICE_ACCOUNT` (the whole contents of the Firebase service-account key `.json`, pasted into the secret value). `EXPO_ACCESS_TOKEN` is optional and only for iPhone later.
3. Enable the **pg_net** extension. In the SQL editor run, with your own values (stored encrypted in Vault, never in the repository): `select vault.create_secret('<the PUSH_WEBHOOK_SECRET value>', 'push_webhook_secret');` and `select vault.create_secret('https://<project>.supabase.co/functions/v1/send-push', 'push_function_url');` (use `vault.update_secret` if a name already exists). To see what happened to a call: `select status_code, content from net._http_response order by created desc limit 5;`
4. Firebase: a free project with an Android app named `com.hithozha.app`. Its `google-services.json` is committed in the project root (it is client configuration, not a secret); the service-account key from Project settings -> Service accounts is secret and only goes into the Supabase secret above. Never commit it.
5. Build the APK on GitHub: add two repository secrets (Settings -> Secrets and variables -> Actions): `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Then **Actions -> Build Android APK -> Run workflow**. About 15 to 25 minutes later, download `hithozha-android-apk` from the run page, unzip it and install the `.apk` on a phone. (It is signed with a debug key, which is fine for testing; the Play Store later needs your own signing key.)

**Testing.** Sign in on the phone, allow notifications, then check `select platform, updated_at from public.push_tokens;` shows a row. Create a notification for yourself, for example `select public.notify_user((select id from auth.users where email = 'you@example.com'), 'identity_verified', '{}'::jsonb);` and the phone should buzz. If it does not, check **Edge Functions -> send-push -> Logs** and `net._http_response`.

### Proposals, chat, orders and reviews

The hiring flow, and who is allowed to do what at each step. All of it is enforced in the database, so a modified app cannot skip a step.

1. **Apply.** A freelancer sends a proposal (message, price, delivery days) to an open job they do not own. One per job. They can withdraw it while it is pending. A conversation is created automatically.
2. **Chat.** Both people can message. `send_message()` scans every message on the server and replaces phone numbers (including +91 and spaced digits), emails, links, UPI ids, and phrases like "pay me directly", "outside the platform", GPay, WhatsApp and bank details with ███. The original is logged in `chat_violations`. Nobody can insert into `messages` directly. New messages arrive live through Supabase Realtime.
3. **Hire.** The job owner taps **Accept and hire**. `accept_proposal()` closes the job and creates the order with the 5% platform fee taken out of the freelancer's side: the client pays the proposal price; the freelancer receives price minus 5% (rounded half up, to the paisa). A job has one live order at a time.
4. **Pay.** The client pays through a Razorpay payment link (opens in the browser). The webhook moves the order to `in_progress`. An unpaid order can be cancelled, which reopens the job and the proposal.
5. **Deliver.** The freelancer taps **Mark as delivered**.
6. **Approve.** The client taps **Approve and release payment**. The order is `completed`, the escrow is `released`, and the freelancer's completed-orders count goes up.
7. **Review.** The client rates 1 to 5 with an optional comment, once per order. The freelancer's average rating and review count update, and show on their public page (`app/freelancer/[id].tsx`) and on proposal cards.

Not built yet: disputes and revision requests, refunds from the app, automatic freelancer payouts, push notifications, rate limiting on chat, and an admin screen for `chat_violations`.

### Tests

```bash
npm test             # app logic + database + Edge Function tests
npm run test:db      # applies every migration to a local Postgres and checks the security rules
npm run test:functions  # runs the three payment functions against mocks
npm run typecheck
```

`test:db` uses PGlite (Postgres compiled to WebAssembly) with Supabase's roles and `auth.uid()` emulated, so it needs no Docker and no Supabase account. It checks who can read and write what as each kind of user, the escrow state machine, the 5% fee maths, and the message redaction. Run it after changing any migration.

## Project layout

```
app/                  Expo Router screens
  (auth)/             welcome (sign in / create account), verify (code), forgot-password
  (onboarding)/       role, client-type, company-profile, profile, professional (freelancers only)
  company/            [id] (public page), edit, verify
  jobs/               new, mine (my jobs), edit/[id], [id] (job detail), apply/[id], proposals/[id]
  account/            edit-profile, freelancer (edit freelancer details), earnings
  admin.tsx           admin tools (admins only)
  legal/              [page] terms, privacy, refunds, contact (public)
  chat/               [id] (a conversation)
  orders/             [id] (pay, deliver, approve), review/[id]
  freelancer/         [id] (public freelancer page with reviews)
  (tabs)/             home, browse, messages, orders, profile
src/
  theme/              colors, typography, spacing, radius
  components/         Button, Input, Select, RadioCard, Card, Avatar, Screen, TabIcon, ...
  i18n/               ta.json, en.json
  providers/          AuthProvider (session + profile)
  lib/                supabase client, upload helper, shared types
supabase/
  migrations/         SQL
  functions/          r2-presign, create-payment, razorpay-webhook, cancel-order, review-identity, send-push
  tests/              database and Edge Function tests (npm test)
  templates/          branded email template for the sign-up code
```

The root layout (`app/_layout.tsx`) is the auth gate: no session shows the welcome screen, a session without a completed profile shows onboarding, otherwise the tabs.

## Admin site (separate from the public app)

The admin panel is **not** part of the public app or website. It is a second build of this project that contains only the admin screens (`admin-app/`), while the public build (`app/`) contains none of the admin code (checked: the public bundle has no admin function names).

- **Two steps to get in:** email + password, then a 6-digit code from an authenticator app (Google Authenticator, Authy). The first time, the site shows a QR code to set it up.
- **The database enforces it.** Since migration `20261004000020_admin_needs_mfa.sql`, `is_admin()` is true only when the session passed the authenticator step (`aal2`). Even someone with an admin password cannot read ID photos or run any admin action without the code.
- **Turn it on in Supabase:** Authentication -> Sign In / Providers -> Multi-Factor -> make sure **TOTP** is enabled (enrol and verify).
- **Deploy as its own Vercel project** (same GitHub repo): add the environment variable `APP_MODE=admin`; leave the build command and output folder as they are. Give it its own address, for example `admin.hithozha.in`, and later put Cloudflare Access in front of it.
- **Run locally:** `APP_MODE=admin npx expo start --web` (PowerShell: `$env:APP_MODE='admin'; npx expo start --web`).
