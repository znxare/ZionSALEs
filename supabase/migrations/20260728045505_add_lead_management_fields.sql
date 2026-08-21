/*
# Lead Management — extended statuses, assigned salesperson, last activity

## Changes

### leads table — new columns
- `assigned_to` (text, nullable) — salesperson name. Single-tenant app, no FK.
- `last_activity_type` (text, nullable) — denormalized type of the most recent activity for fast table display.
- `last_activity_at` (timestamptz, nullable) — timestamp of the most recent activity.
- `budget_lakhs` (numeric, nullable) — budget in lakhs for numeric filtering.

### Status vocabulary expanded
The app now uses a richer status set: Hot, Warm, Cold, Sold, Dead,
Follow-up Pending, Not Reachable, Duplicate, Junk, New, Site Visit Scheduled,
Site Visit Done, Booked, Not Interested. Existing rows keep their values;
new leads default to 'New'.

### Trigger: auto-maintain last_activity_*
A trigger `update_lead_last_activity` fires AFTER INSERT on `activities`
and copies the new activity's type + created_at onto the parent lead's
`last_activity_type` / `last_activity_at`. This keeps the Lead Management
table query fast (no join needed) and the dashboard accurate.

## Security
- RLS already enabled; policies unchanged (anon + authenticated full CRUD).
- No data loss: all additions are additive (new nullable columns).

## Notes
1. Idempotent — safe to re-run.
2. `budget_lakhs` is separate from the existing `budget` text column to
   allow numeric range filtering; the app writes to both.
*/

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS last_activity_type text,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS budget_lakhs numeric;

-- Backfill last_activity_* from the most recent activity per lead.
UPDATE leads l
SET
  last_activity_type = sub.type,
  last_activity_at = sub.created_at
FROM (
  SELECT DISTINCT ON (lead_id) lead_id, type, created_at
  FROM activities
  ORDER BY lead_id, created_at DESC
) sub
WHERE sub.lead_id = l.id;

-- Trigger function + trigger to keep last_activity_* in sync.
CREATE OR REPLACE FUNCTION update_lead_last_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE leads
  SET last_activity_type = NEW.type,
      last_activity_at = NEW.created_at
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_lead_last_activity ON activities;
CREATE TRIGGER trg_update_lead_last_activity
  AFTER INSERT ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_last_activity();

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_last_activity ON leads (last_activity_at DESC);
