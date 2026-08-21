/*
# Zion Hills CRM — Follow-up Management System

Creates the core schema for an action-first sales CRM focused on
follow-ups rather than data entry. Single-tenant (no auth) so the
anon-key frontend can read/write its own data.

## Tables

### leads
The central record for each prospect.
- `id` (uuid PK)
- `name` (text, required)
- `phone` (text, required)
- `email` (text, optional)
- `city` (text, optional)
- `source` (text, required) — Walk-in, Website, Referral, Call, Social Media, Other
- `status` (text) — New, Hot, Warm, Cold, Site Visit Scheduled, Site Visit Done, Booked, Not Interested
- `priority` (text) — High, Medium, Low
- `budget` (text, optional)
- `project_interest` (text, optional) — which plot/villa they're interested in
- `next_followup_at` (timestamptz, required) — the heart of the follow-up system
- `last_contacted_at` (timestamptz, optional)
- `site_visit_at` (timestamptz, optional)
- `booked_at` (date, optional)
- `notes` (text, optional)
- `created_at` (timestamptz, default now())

### activities
Auto-maintained timeline of every interaction with a lead.
- `id` (uuid PK)
- `lead_id` (uuid FK → leads, cascade delete)
- `type` (text) — Created, Called, WhatsApp Sent, Site Visit Scheduled, Site Visit Completed, Pricing Shared, Brochure Sent, Follow-up Scheduled, Status Changed, Not Interested, No Answer, Note Added
- `summary` (text) — human-readable line for the timeline
- `meta` (jsonb, optional) — structured details (e.g. scheduled date, new status)
- `created_at` (timestamptz, default now())

## Smart Defaults (enforced in app layer)
- Walk-in → status = Warm
- Website → status = New
- Referral → priority = High

## Security
- RLS enabled on both tables.
- Anon + authenticated full CRUD (single-tenant, intentionally shared data).

## Indexes
- leads.next_followup_at (dashboard queries by date)
- leads.status, leads.priority (filtering)
- activities.lead_id + created_at (timeline ordering)
*/

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  city text,
  source text NOT NULL DEFAULT 'Walk-in',
  status text NOT NULL DEFAULT 'New',
  priority text NOT NULL DEFAULT 'Medium',
  budget text,
  project_interest text,
  next_followup_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  last_contacted_at timestamptz,
  site_visit_at timestamptz,
  booked_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_leads" ON leads;
CREATE POLICY "anon_select_leads" ON leads FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_leads" ON leads;
CREATE POLICY "anon_insert_leads" ON leads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_leads" ON leads;
CREATE POLICY "anon_update_leads" ON leads FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_leads" ON leads;
CREATE POLICY "anon_delete_leads" ON leads FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads (next_followup_at);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads (priority);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type text NOT NULL,
  summary text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_activities" ON activities;
CREATE POLICY "anon_select_activities" ON activities FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_activities" ON activities;
CREATE POLICY "anon_insert_activities" ON activities FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_activities" ON activities;
CREATE POLICY "anon_update_activities" ON activities FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_activities" ON activities;
CREATE POLICY "anon_delete_activities" ON activities FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_activities_lead_created ON activities (lead_id, created_at DESC);
