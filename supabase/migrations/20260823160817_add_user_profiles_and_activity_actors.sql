/*
# User Profiles & Activity Actor Tracking

Adds real per-user identity on top of Supabase Auth, so the CRM can show
who did what instead of one shared login.

## Tables

### profiles
One row per authenticated user, keyed to `auth.users`.
- `id` (uuid PK, references auth.users, cascade delete)
- `full_name` (text, required)
- `role` (text, required) — free-text job title shown in the top bar
- `created_at` (timestamptz, default now())

## Activities
- Adds `actor_id` (uuid, references auth.users, nullable) and
  `actor_name` (text, nullable) — a name snapshot taken at insert time so
  the log still reads correctly even if a profile is later renamed.
- Existing rows are left with null actor fields (pre-dates per-user auth).

## Security
- profiles: readable by any authenticated user (needed to show actor names
  across the team); a user may only insert/update their own row.
- leads/activities policies are intentionally left untouched — they still
  allow anon + authenticated access, so this migration is purely additive
  and does not lock out any client that hasn't moved to real auth yet.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'Sales Team',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_profiles" ON profiles;
CREATE POLICY "authenticated_select_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "self_insert_profile" ON profiles;
CREATE POLICY "self_insert_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "self_update_profile" ON profiles;
CREATE POLICY "self_update_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

ALTER TABLE activities ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES auth.users(id);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS actor_name text;

CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities (created_at DESC);
