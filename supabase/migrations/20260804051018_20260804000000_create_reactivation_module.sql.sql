/*
# Lead Reactivation Center

Adds reactivation tracking to the CRM so cold leads are never forgotten.

## Changes to existing tables

### leads (new columns)
- `cold_reason` (text, nullable) — why the lead became cold (Budget Issue, Loan Pending, etc.)
- `cold_since` (timestamptz, nullable) — when the lead was marked cold
- `next_reactivation_at` (timestamptz, nullable) — when to next attempt reactivation

These are nullable so existing rows are unaffected. They are populated when a
lead's status changes to Cold.

## New tables

### reactivation_attempts
Records every reactivation attempt on a cold lead so history is never lost.
- `id` (uuid PK)
- `lead_id` (uuid FK → leads, cascade delete)
- `reason` (text) — the cold reason at time of attempt
- `outcome` (text) — Interested Again, Wants Site Visit, Requested More Information, Call Later, Still Not Interested, No Response
- `notes` (text, nullable)
- `contacted_at` (timestamptz, default now())
- `reactivated` (boolean, default false) — true if this attempt moved the lead back to warm
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on reactivation_attempts.
- Anon + authenticated full CRUD (single-tenant, intentionally shared data).

## Indexes
- reactivation_attempts.lead_id + contacted_at (timeline ordering)
- leads.next_reactivation_at (dashboard queries)
- leads.cold_since (reporting)
*/

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS cold_reason text,
  ADD COLUMN IF NOT EXISTS cold_since timestamptz,
  ADD COLUMN IF NOT EXISTS next_reactivation_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_next_reactivation ON leads (next_reactivation_at);
CREATE INDEX IF NOT EXISTS idx_leads_cold_since ON leads (cold_since);

CREATE TABLE IF NOT EXISTS reactivation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'Other',
  outcome text NOT NULL DEFAULT 'No Response',
  notes text,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  reactivated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reactivation_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reactivation_attempts" ON reactivation_attempts;
CREATE POLICY "anon_select_reactivation_attempts" ON reactivation_attempts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reactivation_attempts" ON reactivation_attempts;
CREATE POLICY "anon_insert_reactivation_attempts" ON reactivation_attempts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reactivation_attempts" ON reactivation_attempts;
CREATE POLICY "anon_update_reactivation_attempts" ON reactivation_attempts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reactivation_attempts" ON reactivation_attempts;
CREATE POLICY "anon_delete_reactivation_attempts" ON reactivation_attempts FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_react_lead_contacted ON reactivation_attempts (lead_id, contacted_at DESC);
