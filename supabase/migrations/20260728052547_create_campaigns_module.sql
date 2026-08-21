/*
# Campaign Intelligence Module

## New Table: campaigns
Stores marketing campaigns and their metadata.

Columns:
- `id` (uuid PK)
- `name` (text, required) — campaign name
- `type` (text) — Google Search, Meta Lead Ads, Instagram Reels, Referral Drive, Golf Championship Event, Email Campaign, WhatsApp Campaign, Property Expo, Corporate Tie-up, Walk-in, Organic, Other
- `platform` (text, nullable) — Google, Meta, Instagram, WhatsApp, Email, Referral, Event, Other
- `start_date` (date, nullable)
- `end_date` (date, nullable)
- `budget` (numeric, nullable) — campaign budget in rupees
- `description` (text, nullable)
- `created_at` (timestamptz, default now())

## leads table — new column
- `campaign_id` (uuid, nullable, FK → campaigns ON DELETE SET NULL)

## Security
- RLS enabled on campaigns, anon + authenticated full CRUD.
- leads.campaign_id is nullable so existing leads are unaffected.

## Notes
- Idempotent. Safe to re-run.
- The "Assigned To" field is being removed from the app UI but the
  `assigned_to` column is kept in the database to avoid data loss.
*/

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'Other',
  platform text,
  start_date date,
  end_date date,
  budget numeric,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_campaigns" ON campaigns;
CREATE POLICY "anon_select_campaigns" ON campaigns FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_campaigns" ON campaigns;
CREATE POLICY "anon_insert_campaigns" ON campaigns FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_campaigns" ON campaigns;
CREATE POLICY "anon_update_campaigns" ON campaigns FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_campaigns" ON campaigns;
CREATE POLICY "anon_delete_campaigns" ON campaigns FOR DELETE
  TO anon, authenticated USING (true);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads (campaign_id);
