/*
# Add Lead Import Module Schema

## Purpose
Adds support for the Excel/CSV Lead Import module: preserves original inquiry dates and source attribution, and tracks import batches for auditability.

## 1. New Columns on lead_bank
- inquiry_date (date, nullable) — original inquiry date from the imported Excel file
- original_source (text, nullable) — exact source string from the imported file (e.g. "US Real Estate- meta form")

## 2. New Columns on leads
- inquiry_date (date, nullable) — original inquiry date, copied from lead_bank on conversion

## 3. New Table: lead_imports
Tracks each import batch for auditability and troubleshooting.
- id (uuid, primary key)
- file_name (text) — name of the uploaded file
- import_type (text) — "Meta / Advertisement" | "Organic" | "Other / Custom"
- total_rows (integer)
- new_rows (integer)
- duplicate_rows (integer)
- invalid_rows (integer)
- conflict_rows (integer)
- campaigns_created (integer, default 0)
- completed_at (timestamptz, nullable)
- created_at (timestamptz, default now())

## 4. Security
- Enable RLS on lead_imports
- This is a single-tenant app with no sign-in, so allow anon + authenticated full CRUD

## Notes
- All changes are additive — no existing columns or data are modified or removed
- Existing records remain valid with NULL inquiry_date and original_source
*/

-- Add inquiry_date and original_source to lead_bank
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead_bank' AND column_name = 'inquiry_date') THEN
    ALTER TABLE lead_bank ADD COLUMN inquiry_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead_bank' AND column_name = 'original_source') THEN
    ALTER TABLE lead_bank ADD COLUMN original_source text;
  END IF;
END $$;

-- Add inquiry_date to leads
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'inquiry_date') THEN
    ALTER TABLE leads ADD COLUMN inquiry_date date;
  END IF;
END $$;

-- Create lead_imports table
CREATE TABLE IF NOT EXISTS lead_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  import_type text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  new_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  invalid_rows integer NOT NULL DEFAULT 0,
  conflict_rows integer NOT NULL DEFAULT 0,
  campaigns_created integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_lead_imports" ON lead_imports;
CREATE POLICY "anon_select_lead_imports" ON lead_imports FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_lead_imports" ON lead_imports;
CREATE POLICY "anon_insert_lead_imports" ON lead_imports FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_lead_imports" ON lead_imports;
CREATE POLICY "anon_update_lead_imports" ON lead_imports FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_lead_imports" ON lead_imports;
CREATE POLICY "anon_delete_lead_imports" ON lead_imports FOR DELETE
  TO anon, authenticated USING (true);
