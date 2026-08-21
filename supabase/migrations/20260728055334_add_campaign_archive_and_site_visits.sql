/*
# Campaign archiving + Site Visit History

## campaigns table — new column
- `archived` (boolean, default false) — allows archiving completed campaigns
  without deleting them. Archived campaigns are hidden from the active
  campaign list but remain linked to their leads for historical reporting.

## New Table: site_visits
Stores a complete, append-only history of every site visit for each lead.
Each visit is a separate row — previous visits are never overwritten.

Columns:
- `id` (uuid PK)
- `lead_id` (uuid FK → leads, cascade delete)
- `visit_number` (integer, computed by app) — Visit 1, 2, 3…
- `scheduled_at` (timestamptz, required) — date + time of visit
- `property` (text, nullable) — property/villa visited
- `family_members` (text, nullable) — family members present
- `customer_feedback` (text, nullable)
- `interest_level` (text, nullable) — Hot, Warm, Cold
- `outcome` (text, nullable) — Ready to Book, Negotiation, Needs Another Visit, etc.
- `notes` (text, nullable)
- `next_followup_at` (timestamptz, nullable)
- `status` (text, default 'Scheduled') — Scheduled, Completed, Cancelled, No Show
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on site_visits, anon + authenticated full CRUD.

## Notes
- Idempotent. Safe to re-run.
*/

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  visit_number integer NOT NULL DEFAULT 1,
  scheduled_at timestamptz NOT NULL,
  property text,
  family_members text,
  customer_feedback text,
  interest_level text,
  outcome text,
  notes text,
  next_followup_at timestamptz,
  status text NOT NULL DEFAULT 'Scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_site_visits" ON site_visits;
CREATE POLICY "anon_select_site_visits" ON site_visits FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_site_visits" ON site_visits;
CREATE POLICY "anon_insert_site_visits" ON site_visits FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_site_visits" ON site_visits;
CREATE POLICY "anon_update_site_visits" ON site_visits FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_site_visits" ON site_visits;
CREATE POLICY "anon_delete_site_visits" ON site_visits FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_site_visits_lead_id ON site_visits (lead_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_scheduled_at ON site_visits (scheduled_at);
