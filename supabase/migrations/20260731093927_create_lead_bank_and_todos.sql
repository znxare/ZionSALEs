/*
# Create Lead Bank and Todos tables

1. New Tables
- `lead_bank`: Raw leads pasted from external Google Sheets / Excel before being qualified.
  - id (uuid, primary key)
  - name (text, not null)
  - phone (text, not null)
  - email (text, nullable)
  - city (text, nullable)
  - source (text, nullable) - free-form source description from the sheet
  - campaign_id (uuid, nullable, references campaigns)
  - status (text, not null default 'New') - LeadBankStatus: New, Hot, Cold, Not Reachable, Not Interested, Converted
  - notes (text, nullable)
  - last_contacted_at (timestamptz, nullable)
  - created_at (timestamptz, default now())
- `todos`: Team daily-planner to-do items.
  - id (uuid, primary key)
  - title (text, not null)
  - description (text, nullable)
  - due_date (date, nullable)
  - done (boolean, default false)
  - assignee (text, nullable)
  - created_at (timestamptz, default now())

2. Security
- Enable RLS on both tables.
- Single-tenant no-auth app: allow anon + authenticated full CRUD on both tables.
*/

CREATE TABLE IF NOT EXISTS lead_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  city text,
  source text,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'New',
  notes text,
  last_contacted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lead_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_lead_bank" ON lead_bank;
CREATE POLICY "anon_select_lead_bank" ON lead_bank FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_lead_bank" ON lead_bank;
CREATE POLICY "anon_insert_lead_bank" ON lead_bank FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_lead_bank" ON lead_bank;
CREATE POLICY "anon_update_lead_bank" ON lead_bank FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_lead_bank" ON lead_bank;
CREATE POLICY "anon_delete_lead_bank" ON lead_bank FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  assignee text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_todos" ON todos;
CREATE POLICY "anon_select_todos" ON todos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_todos" ON todos;
CREATE POLICY "anon_insert_todos" ON todos FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_todos" ON todos;
CREATE POLICY "anon_update_todos" ON todos FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_todos" ON todos;
CREATE POLICY "anon_delete_todos" ON todos FOR DELETE
  TO anon, authenticated USING (true);
