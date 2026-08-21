/*
# Tours Module — site visit tracking and analytics

## New Table: tours
Tracks every property tour / site visit conducted by the sales team.

Columns:
- `id` (uuid PK)
- `lead_id` (uuid FK → leads, cascade delete) — links tour to customer
- `scheduled_at` (timestamptz, required) — when the tour is scheduled
- `property` (text, nullable) — which plot/villa/project was shown
- `sales_executive` (text, nullable) — assigned salesperson
- `status` (text) — Scheduled, Confirmed, Completed, Cancelled, No Show, Rescheduled
- `outcome` (text, nullable) — Ready to Book, Negotiation Started, Needs Another Visit, Follow-up Required, Loan Discussion, Not Interested
- `family_attended` (text, nullable) — who came along (free text)
- `customer_feedback` (text, nullable)
- `objections` (text, nullable)
- `budget` (text, nullable)
- `interest_level` (text, nullable) — Hot, Warm, Cold
- `notes` (text, nullable)
- `next_followup_at` (timestamptz, nullable) — follow-up created from outcome
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

## Security
- RLS enabled, anon + authenticated full CRUD (single-tenant).

## Indexes
- tours.scheduled_at (date-range queries, calendar)
- tours.status (filtering)
- tours.sales_executive (per-executive analytics)
- tours.lead_id (join to lead)

## Notes
- Idempotent. Safe to re-run.
*/

CREATE TABLE IF NOT EXISTS tours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  property text,
  sales_executive text,
  status text NOT NULL DEFAULT 'Scheduled',
  outcome text,
  family_attended text,
  customer_feedback text,
  objections text,
  budget text,
  interest_level text,
  notes text,
  next_followup_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tours" ON tours;
CREATE POLICY "anon_select_tours" ON tours FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tours" ON tours;
CREATE POLICY "anon_insert_tours" ON tours FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tours" ON tours;
CREATE POLICY "anon_update_tours" ON tours FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tours" ON tours;
CREATE POLICY "anon_delete_tours" ON tours FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_tours_scheduled_at ON tours (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tours_status ON tours (status);
CREATE INDEX IF NOT EXISTS idx_tours_sales_executive ON tours (sales_executive);
CREATE INDEX IF NOT EXISTS idx_tours_lead_id ON tours (lead_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_tours_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tours_updated_at ON tours;
CREATE TRIGGER trg_tours_updated_at
  BEFORE UPDATE ON tours
  FOR EACH ROW
  EXECUTE FUNCTION set_tours_updated_at();
