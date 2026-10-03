# AI Handoff — Zion CRM ("ZionSALEs")

**Last verified: 2026-10-03, against branch `main` (production) at the commit that added this
version of the file.** Earlier versions of this document lived only on the `demo` branch and
described that branch; this one describes `main`. Where `demo` differs, it says so (Section 3).

## 0. How to use this document

Paste or upload this whole file as your first message to any AI assistant (Claude, ChatGPT,
Gemini, etc.) before asking it to work on this project. It is written to be a complete,
standalone briefing — you should not need to re-explain the product, the stack, or the
history behind any decision.

Rules for the AI reading this:
- Treat every fact below as true **as of the date at the top**, not necessarily true today.
  Where a fact is likely to have changed (pending SQL, open questions, branch state), that is
  called out explicitly — verify those before acting on them.
- Section 6 ("Formulas") is the load-bearing part of this document. These are exact
  business-logic definitions. Quote them precisely if asked what a metric means; don't
  paraphrase them into something subtly different. Functions are named rather than given line
  numbers, because line numbers go stale.
- Section 7 ("Known issues") contains a live, unresolved security vulnerability. Do not "fix"
  it unprompted — it needs a deliberate go-ahead from the user — but do mention it if
  security, production-readiness, or hosting comes up and it hasn't been raised yet.
- If you make a structural change — new table, new formula, new module, resolved issue, new
  hosting fact — **update this file in the same session**, in the relevant section, and add a
  one-line dated note under "Changelog" (bottom) rather than rewriting history.
- This file lives at the root of the code repository. It is not deployed or read by the app.

---

## 1. What this project is

**Zion CRM** (repo `ZionSALEs`) is a real-estate + hospitality sales CRM for a golf-community
real-estate developer ("Zion Hills"). Sales reps track leads from first contact through site
visits to booking ("sale"), plus a smaller, separate pipeline for hospitality (villa stays,
corporate events). Originally scaffolded in **bolt.new**, since developed by hand (mostly via
Claude Code).

It is a **live product with real production data and a real sales team** (as of 2026-10:
Amit — the owner/admin, Sukrit, Shabaz Khan; ~150 Real Estate leads, ~1,400 activities).
Treat schema/data changes on the production Supabase project like any live customer database.

Related but separate projects (don't conflate): **ORM CRM website** (`orm-crm-website/`, the
marketing site) and the **Zion Hills tour app**.

---

## 2. Tech stack

- **Frontend**: React 18 + TypeScript, Vite 5, Tailwind CSS 3 (utilities + a CSS-variable brand
  theme; the orange brand gradient class is `brand-gradient`).
- **Backend**: Supabase (Postgres + PostgREST + Auth + **Realtime**), called directly from the
  browser via `@supabase/supabase-js`. No custom server.
- **Routing**: hash-based (`#/leads`, `#/lead/<id>`, `#/reports`, …). `App.tsx` has a `Route`
  union, `parseHash()` and `navigate()`; every page renders from `route.name`.
- **Icons** `lucide-react`; **spreadsheet import** `xlsx`.
- Scripts: `npm run dev`, `npm run build`, `npm run lint`, **`npm run typecheck`**.
- **Typecheck trap**: `npx tsc --noEmit -p .` checks *nothing* (the root `tsconfig.json` has
  `"files": []` plus project references), and `vite build` doesn't typecheck either. Always run
  `npx tsc --noEmit -p tsconfig.app.json` (= `npm run typecheck`). `npm run lint` reports a few
  pre-existing errors (e.g. unused `ss` variables in `LeadManagement.tsx`, unused imports in
  `LeadDetail.tsx`) — don't mistake those for regressions.

---

## 3. Repository & deployment topology — read before touching git or asking "is it live"

**GitHub**: `https://github.com/znxare/ZionSALEs`. Branches: `main` (production), `demo`
(stale staging branch — see below), `backup-local-cleanup`.

**Production = `main` → Vercel → `zion.ormcrm.com`.** Pushing to `main` auto-deploys via
Vercel's GitHub integration (no `vercel.json`; configured only in the Vercel dashboard).
Deploys have consistently gone live within ~20–60 seconds. To confirm a deploy without
dashboard access, fetch `https://zion.ormcrm.com/`, find the `assets/index-*.js` bundle name,
and grep that bundle for a string unique to your change.

**Local folders (Windows, user `Thisi`):**
- `C:\Users\Thisi\ZION CRM` — checked out on **`demo`**, with a lot of **uncommitted work**
  (and `demo` is ~70 commits behind `main`). It contains things that never reached `main`:
  a 24-hour app-level session timeout (`auth.ts`), a `cold_reason_note` field + migration
  (`20260903000000_add_cold_reason_note.sql`), demo-mode `assertWritable()` calls throughout
  `crm.ts`, and an older copy of this doc. **Don't build production fixes there and don't
  assume a clean tree.**
- `C:\Users\Thisi\ZION-CRM-main` — a git worktree on `main`, but often stale (not pulled).
- **Working pattern that's been used for every production change**: create a fresh worktree
  from `origin/main` (e.g. `git worktree add ../zion-<task> origin/main -b <branch>`), junction
  `node_modules` from `ZION CRM` (`mklink /J node_modules "..\ZION CRM\node_modules"`), make the
  change, run the real typecheck + build, commit, and push **only after the user says so**
  (`git push origin HEAD:main`), confirm it's live, then remove the worktree. GitHub
  connectivity from this machine is occasionally flaky — retry a failed push.

**Public demo** `demo.ormcrm.com`: meant to be a sandboxed build of the `demo` branch against a
separate Supabase project with fake data (`supabase/demo-only/lockdown-and-seed.sql`). Its
GitHub Actions workflow is **not on `main`**, and its infra (demo Supabase project, DNS, Pages)
was last known to be pending on the user's side. `src/lib/demoMode.ts` exists on `main` but only
`hospitality.ts` calls `assertWritable()` there.

**Nightly backup**: `.github/workflows/backup-db.yml` dumps the production DB at ~02:00 IST
(`supabase db dump` using repo secret `PROD_SUPABASE_DB_URL`) and keeps 30 days of artifacts —
the only backup, since the Supabase project is on the **Free** plan (no automatic backups;
5 GB/month egress).

**Supabase projects** — don't mix them up:
- **Production**: ref `dhnlzseiqhwqvvwuchdu`. In the Supabase dashboard the project is
  **named "hospitality"** (org "znxare's Org") — that name is misleading; it holds all CRM data.
- Demo: a separate project (see above).

**No CLI/DB access from this machine**: the Supabase CLI isn't linked, there's no Docker, and
`.env` holds only the public anon key. So **no session here can apply a migration**. Pattern:
write the file under `supabase/migrations/`, and give the user the raw SQL to paste into
Supabase → SQL Editor. Ask which project(s) need it.

---

## 4. Data model (Postgres via Supabase)

Migrations in `supabase/migrations/` (timestamp order) on `main`:

1. `20260728043340_create_crm_schema.sql` — `leads`, `activities`.
2. `20260728045505_add_lead_management_fields.sql` — priority, budget fields, assignment, and a
   trigger that keeps `leads.last_activity_type/last_activity_at` in sync with `activities`.
3. `20260728050502_create_tours_module.sql` — `tours`.
4. `20260728052547_create_campaigns_module.sql` — `campaigns`; `leads.campaign_id`.
5. `20260728055334_add_campaign_archive_and_site_visits.sql` — `campaigns.archived`,
   `site_visits` (many per lead).
6. `20260731093927_create_lead_bank_and_todos.sql` — `lead_bank`, `todos`.
7. `20260804051018_..._create_reactivation_module.sql.sql` — `reactivation_attempts`; cold
   fields on leads (`cold_reason`, `cold_since`, `next_reactivation_at`).
8. `20260808032753_add_import_module_schema.sql` — `lead_imports`.
9. `20260817130232_simplify_lead_statuses.sql` — six statuses: Hot, Warm, Cold, Calling, Dead,
   Junk.
10. `20260820123027_make_next_followup_at_nullable.sql`.
11. `20260823160817_add_user_profiles_and_activity_actors.sql` — `profiles` (`id`,
    `full_name`, `role` = free-text job title) + `activities.actor_id/actor_name`.
12. `20260905050541_add_lead_bank_phone_unique_constraint.sql`.
13. `20260919123455_create_hospitality_leads.sql` — `hospitality_leads`,
    `hospitality_activities` (applied on production — the tables exist).
14. `20260929000000_enable_realtime_live_updates.sql` — adds `leads`, `hospitality_leads`,
    `site_visits`, `campaigns` to the `supabase_realtime` publication. **Applied and verified
    on production 2026-09-29** (a live UPDATE event was observed).
15. `20261002000000_add_access_levels.sql` — `profiles.email`, `profiles.access_level`
    ('admin' | 'team' | 'viewer' | 'removed', default 'team'), `public.is_crm_admin()` (JWT email
    = amit@zionhills.in), admin insert/update policies on `profiles`, and a trigger so only the
    admin can change an `access_level`. **SQL given to the user 2026-10-02; apply status
    unconfirmed.**
16. `20261003000000_add_app_settings.sql` — `app_settings (key, value jsonb, updated_at)`;
    authenticated read, admin-only write. Holds `module_visibility`. **Apply status
    unconfirmed.**

Key `leads` columns: `id, name, phone, email, city, source, status, priority, budget,
budget_lakhs, project_interest, campaign_id, assigned_to (a person's name, free text),
next_followup_at, last_contacted_at, last_activity_type, last_activity_at, site_visit_at,
booked_at, notes, cold_reason, cold_since, next_reactivation_at, inquiry_date, created_at`.
There is **no `updated_at`** on `leads`.

`activities` (append-only audit log): `lead_id, type, summary, meta jsonb, actor_id,
actor_name, created_at`. `Follow-up Scheduled` rows carry `meta.when` (the due date) and
`meta.previous`. `actor_name` is a snapshot — one user appears under two names (an email, then
a full name), so **group people by `actor_id`**, not by name.

**Supabase returns at most 1,000 rows per request.** `fetchAllPages()` in `crm.ts` pages through
any "load everything" query; each such query needs a unique tiebreaker (`.order('id')`).
`activities` passed 1,000 rows in Sept 2026.

---

## 5. Domain concepts & app behaviour

**Statuses**: Hot, Warm, Cold, Calling, Dead, Junk. Dead/Junk are terminal
(`TERMINAL_STATUSES`): follow-up cleared, excluded from active views. `isFollowUpRequired()` =
not terminal and not booked. A booked lead shows **"Sold · <date>"** instead of a follow-up.

**Smart defaults** (`smartDefaults()`): Walk-in/default source → Warm; Referral → Hot.

**Add Lead** starts its Campaign picker on the **newest running (non-archived) campaign**
(`campaigns` from `fetchCampaigns()` is non-archived, newest first). Archived campaigns are
never offered anywhere; **Edit Lead** has an explicit "— Other Organic Sources —" (no campaign)
option and keeps a lead's archived campaign as "Archived campaign (unchanged)".

**Follow-up completion rule** (`rolledFollowUp()` / `recordAction()` in `crm.ts`, mirrored in
`recordHospitalityAction()`): logging **Called, WhatsApp Sent, No Answer or Note Added** on a
lead whose follow-up is due today or overdue moves `next_followup_at` to **tomorrow** (same time
offset as `daysFromNow(1)`), unless the patch sets a date explicitly, sets a terminal status, or
books the lead. For a **Cold** lead it also moves `next_reactivation_at` to the same date.
Adding a note to a due lead in Lead Detail then opens the follow-up picker so the real date can
be chosen. System notes (e.g. "site visit deleted") are written with `logActivity()` directly
and don't roll dates. Why: the team logs calls as notes, and leads kept reappearing as overdue
the next day.

**Auto-assign on qualifying**: setting a lead **Hot, Warm or Cold** (any path that goes through
`updateLead()` / `updateHospitalityLead()`, plus Lead Bank conversion) makes the current user its
`assigned_to` — **only if it's unassigned** (`claimIfUnassigned()` does a conditional
`update … where assigned_to is null`). Bulk status changes pass `{ claim: false }`.

**Two divisions**: **Real Estate** (full pipeline) and **Hospitality** (own tables,
`src/lib/hospitality.ts`, own components; no campaigns/site visits/reactivation). The
Hospitality fetch in `App.tsx` is deliberately isolated from the Real Estate `Promise.all` so a
Hospitality failure can never block Real Estate data — keep that. Hospitality's menu has
**All Leads** and a **Lead Bank** placeholder; the Booking Timeline placeholder was removed.

**Cold-lead reactivation**: marking Cold requires a `ColdReason`; `markLeadCold()` sets
`cold_since`, `next_reactivation_at` and `next_followup_at` from `coldReasonDays()`. Bulk "Cold"
and a Cold site-visit outcome use reason **Other** + 60 days so no lead goes Cold without a
reactivation date. The Reactivation Center (`LeadReactivation.tsx`) records outcomes via
`reactivateLead()`. As of 2026-10-02 **zero reactivation attempts had ever been recorded**.

**Lead Bank**: staging pool; `convertLeadBankToLead()` / `...Safe()` (dedupes by phone). The old
"Paste from Excel" modal was removed (Lead Import covers bulk entry).

**Site visits** can be deleted from the Site Visits page (`removeSiteVisit()`): confirm →
delete → re-sync the lead's `site_visit_at` to its latest remaining visit → log a note.

**Roles (screen-level only)** — `src/lib/access.ts`:
- **Admin** = `amit@zionhills.in`, always (hard-coded via `ADMIN_EMAIL`). Sees everything,
  can delete leads, sees Reports and Campaigns, manages the team in Settings.
- **Team** = everyone else by default: normal work, **no lead deletion**.
- **Viewer** = read-only (sees phone numbers). **Removed** = signed straight out.
- Enforcement: a `global.fetch` wrapper in `src/lib/supabase.ts` blocks every non-GET
  `/rest/v1/` request for viewers/removed users and `DELETE` on `leads`/`hospitality_leads` for
  non-admins, plus hidden buttons. **The database does not enforce any of this** (Section 7).
- **Module access**: the admin ticks which pages Team/Viewer can open (Settings → Module
  access), saved to `app_settings.module_visibility` as hidden ids per role. Defaults
  (`DEFAULT_MODULE_VISIBILITY`): Team and Viewer can't see Campaigns or Reports; Viewer also
  can't see Lead Import. Dashboard and Settings are always visible. Hidden routes render "Not
  available"; `#/lead/<id>` follows the All Leads module.
- **Settings** (all users): profile, change password, presentation mode (blurs phones/emails),
  team list, sign out. Admin also gets user management: change roles, remove/restore, email a
  password reset (link lands on Settings via the `PASSWORD_RECOVERY` event — needs
  `zion.ormcrm.com` in Supabase Auth redirect URLs), add a member (created via a throwaway
  Supabase client so the admin stays signed in; needs the access-levels SQL).
- The login page still has a self-serve "Create an account" link (new sign-ups become Team).
  Removing it was suggested; the user hasn't decided.

**Live updates**: `App.tsx` subscribes to Supabase Realtime (`crm-live` channel) on `leads`,
`hospitality_leads`, `site_visits`, `campaigns`; any change triggers a debounced (800 ms)
refetch. Fallback refresh every 30 s if the channel isn't subscribed, a 5-minute safety refresh
while it is, and an immediate refresh when the tab regains focus. Only the first load shows
the spinner; identical refetches keep old array references (`keepIfSame`) so nothing
re-renders.

---

## 6. Formulas — exact

### 6.1 Lead Quality Score (`leadQualityScore()`, `crm.ts`)
```
qualified = count of leads where status is 'Hot' OR 'Warm' OR booked_at is set
score     = round(qualified / total * 100)          // 0 if no leads
rating    = >=60 Excellent, >=40 Good, >=20 Average, else Poor
```
`Warm` is the proxy for "reached engagement". Don't change the definition without asking.

### 6.2 Campaign conversion (`CampaignAnalytics.tsx`)
Per campaign (and for the "organic/unassigned" bucket = `campaign_id is null`, labelled
`UNASSIGNED_CAMPAIGN_LABEL`):
```
conversionRate = round(bookings / total * 100)
tourToBooking  = round(bookings / site_visits_done * 100)
costPerLead    = budget && total > 0 ? round(budget / total) : null
```
`site_visit_done` and `site_visit_scheduled` are both `!!lead.site_visit_at`.

### 6.3 Campaign insights
Best performing = highest quality score (≥1 lead); Highest conversion (≥1 booking); Most site
visits (>0); "consider reducing budget" = among campaigns with ≥3 leads, lowest quality score
**if below 20%** (qualitative — budgets are null); Needs attention = first campaign with ≥5
leads where `contacted / total < 0.5`.

### 6.4 Dashboard metrics (`Dashboard.tsx`)
```
leadToSaleRate      = round(total_booked / total_leads * 100)
bestCampaign/Rate   = campaign (≥1 lead) with highest sold/total*100
avgCampaignRate     = mean of sold/total*100 over campaigns with ≥1 lead
closeStats          = per booked lead: max(0, round((booked_at − created_at)/1 day)); avg/min/max
avgVisitsBeforeSale = site_visits rows of booked leads / distinct booked leads (1 dp)
```
**Avg Time to Call was removed from the dashboard (2026-09-29)** at the user's request.
Follow-up counts: **Today** = follow-up today, not terminal/booked, and no activity logged today;
**Overdue** = follow-up before today, same exclusions. `priorityList` sorts active leads
overdue-first, then Hot > Warm > Calling > other, then soonest follow-up; top 8.

### 6.5 Reactivation Center (`LeadReactivation.tsx`)
```
successRate = round(attempts with reactivated=true / total attempts * 100)
avgDays     = mean over cold leads with cold_since of max(0, round((now − cold_since)/1 day))
score       = overdueDays*10 + visitCount*5 + callCount*3 + min(daysSinceContact,100)*0.5
```
The Monthly Reactivation Trend toggle is 3M / 6M / 12M.

### 6.6 Cold-reason reschedule days (`coldReasonDays()`)
| Reason | Days | Reason | Days |
|---|---|---|---|
| Family Decision Pending | 30 | Stopped Responding | 30 |
| Out of Station | 45 | Personal Reasons | 60 |
| Comparing Other Projects | 60 | Loan Pending | 60 |
| Budget Issue | 90 | Location Preference | 90 |
| Looking for Ready-to-Move Property | 90 | Existing Property Not Sold | 120 |
| Investment Planned Later | 180 | Wants to Buy Next Year | 365 |
| Other | null → user picks; falls back to 60 | | |

### 6.7 Reactivation outcome (`reactivateLead()`)
Interested = 'Interested Again' | 'Wants Site Visit' | 'Requested More Information' → status
Warm, cold fields cleared, follow-up in 2 days. Otherwise → next reactivation =
today + coldReasonDays(reason) (60 default), lead stays Cold.

### 6.8 Tour outcome (`outcomeFollowUpDays()`)
Ready to Book 1, Negotiation Started 2, Follow-up Required 2, Needs Another Visit 3, Loan
Discussion 3, Not Interested 30, default 3. Status: Ready to Book → Hot; Not Interested → Dead
(follow-up cleared); otherwise Warm; `interest: 'Hot'` forces Hot; `interest: 'Cold'` forces Cold
(with reason Other + 60-day reactivation) unless Ready to Book.

### 6.9 Funnel drop-off (`CampaignAnalytics.tsx`)
Leads → Contacted → Interested (Hot/Warm) → Site Visits; each stage
`conv = round(stage / previous * 100)`, `dropOff = 100 − conv`.

### 6.10 Reports page (`Reports.tsx`, admin) — filters: vertical (All / Real Estate /
Hospitality) and date range (this/last month, 30/90 days, this year, custom). Loads the
**full** activity history of both verticals once. People are grouped by `actor_id` and shown by
current `profiles.full_name`.
- **Pipeline summary**: new leads = created in range; contacted = new leads with a Called /
  No Answer / WhatsApp in range; visits scheduled/done = site visits scheduled in range
  (done = status Completed); sales = `booked_at` in range; conversion = sales / new leads.
- **Team productivity** (per person, range): counts of Called, No Answer, WhatsApp, Notes,
  Follow-ups set, Visits scheduled/done, Sales/bookings, Total (excludes `Created`).
  - **Answer rate** = answered / (answered + not answered), where answered = `Called` +
    notes matching `ANSWERED_NOTE` and not-answered = `No Answer` + notes matching
    `NO_ANSWER_NOTE` ("no response", "not picking", "switched off", "voicemail", "rnr"…);
    notes matching neither are ignored. A wording heuristic — the team rarely taps No Answer.
  - **Follow-up discipline**: every `Follow-up Scheduled` activity whose `meta.when` falls in
    the range and is already past; skipped if rescheduled again before its due day. On time =
    a Called/No Answer/WhatsApp/Note on that lead after it was scheduled and by end of the due
    day; late = after; missed = none yet. Attributed to whoever scheduled it.
  - **Overdue now**: active leads with follow-up before today and no activity today,
    attributed to the **owner** = `assigned_to`, else the last person who logged an activity,
    else "Unassigned".
- **Team activity** tab: one person's actions in range, grouped by day, with CSV.
- **Follow-ups** tab (current state, ignores dates): overdue buckets 1–3 / 4–7 / 8–14 / 15+
  days; **neglected** = active, non-Cold leads with no activity for 7/14/30+ days
  (`last_activity_at`, else `created_at`).
- **Never contacted**: leads created in range, not Junk/booked, with no Called/No Answer/WhatsApp
  ever.
- **Cold & lost**: leads still Cold whose `cold_since` is in range — reasons, top sources per
  reason, who marked them (from the "Marked Cold" activity); lost = new leads now Dead/Junk by
  source (no reason is recorded for Dead).
- Every section has a CSV export. The **marketing-vs-sales gap report** the user asked for is
  **not built** — the user will describe it later; don't invent it.

---

## 7. Known issues

**Critical, unresolved: production RLS grants `anon` full read/write on the CRM tables.** The
`leads`, `activities`, `campaigns`, `site_visits` etc. policies allow the `anon` role
`USING (true)` / `WITH CHECK (true)`. The anon key ships in the JS bundle, so anyone can read or
change data via the REST API without logging in (`profiles`, by contrast, is
authenticated-only). The login screen and the new Admin/Team/Viewer roles are **client-side
only** and don't change this. The user explicitly chose screen-level roles "for now". A real fix
means authenticated-only policies keyed on `profiles.access_level` — and **must keep an
authenticated SELECT on the four Realtime tables**, or live updates stop. Raise this whenever
security comes up; don't change it without a go-ahead.

**Pending SQL**: migrations 15 (access levels) and 16 (app_settings) were handed to the user
but not confirmed applied. Until 15 runs: role changes/removals/adding members fail, and any
user can still set their own `access_level`. Until 16 runs: Module access can't be saved
(defaults apply).

**`demo` branch has diverged** (Section 3) — its unique work (session timeout, cold-reason
note, demo-mode guards, hospitality iterations) would need porting by hand, not a merge.

**Data gaps that limit reporting** (as of 2026-10-02): `campaigns.budget` null on all 6
campaigns (no cost-per-lead); `leads.budget_lakhs` empty on every lead (no revenue/forecast);
`site_visits.outcome` empty on all 43 visits; ~45% of leads unassigned (auto-assign on qualify
will fill this over time); only 3 sales recorded.

---

## 8. Business context

- Organic/referral leads far outperform the main paid campaign ("Real Estate - meta form") on
  quality. In the 30 days to 2026-10-02, 12 of 68 new leads were never contacted, 9 of them
  from Meta forms.
- Active campaigns (newest first): Delhi Real Estate -Meta Form (created 2026-09-29), Walkin,
  Galabox website, Real Estate - meta form. Archived: US Real Estate- meta form, Middle East -
  meta form (6 leads still linked).
- "Other Organic Sources" is both a `LeadSource` value and the label for "no campaign".
  On 2026-10-03 the user personally reviewed walk-in leads: Saqlain, Dr Ramesh suri, Prahlad,
  Mona (walk-in), Manoj Prospect → Walkin campaign; Iswar Kapsi, Vandana, Sumit basu, Vikash
  Lachwani → no campaign; sources aligned to match.
- Follow-up on-time rate (last 30 days to 2026-10-02): Amit 59%, Shabaz 83%, Sukrit 39%.
- Design: brand tokens come from CSS variables feeding `tailwind.config.js`; `brand-gradient`
  is the orange gradient.

---

## 9. Working agreements with this user

- **Ask before every push to `main`** — it deploys to production. The user has approved each
  push individually; no standing auto-push permission has been given.
- **Ask before changing production data.** The user prefers to review data changes themselves
  (they stopped a bulk campaign re-link mid-way to review each lead). Show the exact list first.
- Never assume a migration is applied anywhere without the user confirming it.
- Work in a fresh worktree off `origin/main`, never in the `demo` folder, for production
  changes. Run the **real** typecheck and `npm run build` before calling anything done.
- After pushing, confirm the change is in the live bundle before saying it's live.
- Preserve the isolated Hospitality fetch in `App.tsx`.
- Don't touch production RLS/security without an explicit, separate go-ahead.
- Explain things to the user in plain language with concrete examples from their data — they
  are the business owner, not a developer.

---

## Changelog

- **2026-09-22** — Initial version (on `demo`, commit `9da63d6`).
- **2026-09-23** — Committed with `CLAUDE.md` on `demo` (`cb8e34a`); 24h session timeout added on
  `demo` only.
- **2026-10-03** — Rewritten to describe `main` (production) and committed to `main` for the
  first time. Covers work from 2026-09-28 to 2026-10-03: follow-up roll rule (incl. notes and
  Cold leads), Assigned To column, banner WebP, Sold label, site-visit delete, Call button in
  Log Call, guided call flow removed, Schedule Site Visit label, Realtime live updates, 1,000-row
  paging, Avg Time to Call removed, Lead Bank paste removed, reactivation fixes, Settings page,
  Admin/Team/Viewer roles, module access, Reports (productivity, answer rate, follow-up
  discipline, team activity, follow-ups, never contacted, cold & lost), Booking Timeline
  removed, Edit Lead campaign fix, Add Lead defaults to running campaign, auto-assign on
  qualify.
