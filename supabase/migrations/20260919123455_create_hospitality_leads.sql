/*
# Hospitality Leads — separate pipeline for getaway & corporate bookings

Creates a standalone lead pipeline for the Hospitality division (getaway
stays and corporate bookings), kept in its own tables so its leads never
mix with the Real Estate `leads` table. Mirrors the shape of `leads` /
`activities` closely so the app-layer UX (list, filters, status funnel,
activity timeline) can be identical, just pointed at different data.

## Tables

### hospitality_leads
- `id` (uuid PK)
- `name`, `phone` (required)
- `email`, `city` (optional)
- `source` (text) — Website, Referral, Walk-in, OTA, Travel Agent,
  Corporate Tie-up, MICE Agency, Wedding Planner, Social Media, Repeat
  Guest, Other
- `status` (text) — Hot, Warm, Cold, Calling, Dead, Junk (same funnel as
  Real Estate leads, for a consistent UI)
- `priority` (text) — High, Medium, Low
- `budget` (text, optional)
- `notes` (text, optional)
- `next_followup_at`, `last_contacted_at` (timestamptz, optional)
- `last_activity_type`, `last_activity_at` (optional)
- `assigned_to` (text, optional) — team member name, same free-text
  pattern as `leads.assigned_to`
- `booked_at` (date, optional) — confirmed booking date
- `created_at` (timestamptz, default now())

### hospitality_activities
Timeline of interactions with a hospitality lead, same shape as
`activities` but pointed at `hospitality_leads`.

## Security
RLS enabled on both tables with the same anon+authenticated full-CRUD
policy pattern already used by every other table in this app (see
`leads`/`activities`) — this migration does not change that posture
either way, just extends it to the new tables for consistency.

## Indexes
Mirrors the indexes on `leads`/`activities`.
*/

CREATE TABLE IF NOT EXISTS hospitality_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  city text,
  source text NOT NULL DEFAULT 'Website',
  status text NOT NULL DEFAULT 'Warm',
  priority text NOT NULL DEFAULT 'Medium',
  budget text,
  notes text,
  next_followup_at timestamptz,
  last_contacted_at timestamptz,
  last_activity_type text,
  last_activity_at timestamptz,
  assigned_to text,
  booked_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hospitality_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_hospitality_leads" ON hospitality_leads;
CREATE POLICY "anon_select_hospitality_leads" ON hospitality_leads FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_hospitality_leads" ON hospitality_leads;
CREATE POLICY "anon_insert_hospitality_leads" ON hospitality_leads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_hospitality_leads" ON hospitality_leads;
CREATE POLICY "anon_update_hospitality_leads" ON hospitality_leads FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_hospitality_leads" ON hospitality_leads;
CREATE POLICY "anon_delete_hospitality_leads" ON hospitality_leads FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_hospitality_leads_next_followup ON hospitality_leads (next_followup_at);
CREATE INDEX IF NOT EXISTS idx_hospitality_leads_status ON hospitality_leads (status);
CREATE INDEX IF NOT EXISTS idx_hospitality_leads_priority ON hospitality_leads (priority);
CREATE INDEX IF NOT EXISTS idx_hospitality_leads_created_at ON hospitality_leads (created_at);

CREATE TABLE IF NOT EXISTS hospitality_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospitality_lead_id uuid NOT NULL REFERENCES hospitality_leads(id) ON DELETE CASCADE,
  type text NOT NULL,
  summary text NOT NULL,
  meta jsonb,
  actor_id uuid REFERENCES auth.users(id),
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hospitality_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_hospitality_activities" ON hospitality_activities;
CREATE POLICY "anon_select_hospitality_activities" ON hospitality_activities FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_hospitality_activities" ON hospitality_activities;
CREATE POLICY "anon_insert_hospitality_activities" ON hospitality_activities FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_hospitality_activities" ON hospitality_activities;
CREATE POLICY "anon_update_hospitality_activities" ON hospitality_activities FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_hospitality_activities" ON hospitality_activities;
CREATE POLICY "anon_delete_hospitality_activities" ON hospitality_activities FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_hospitality_activities_lead_created ON hospitality_activities (hospitality_lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hospitality_activities_created_at ON hospitality_activities (created_at DESC);
