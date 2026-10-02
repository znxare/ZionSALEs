/*
  # Access levels (Admin / Team / Viewer)

  - profiles.email: shown in the admin's team list (backfilled from auth.users;
    the app also fills it in on each user's next sign-in).
  - profiles.access_level: 'admin' | 'team' | 'viewer' | 'removed'.
    amit@zionhills.in is always admin (the app also hard-codes this).
  - The admin may insert/update any profile (add members, change roles).
  - Nobody else can change an access_level — not even their own — so a team
    member can't promote themselves through the API.

  The app enforces what each role can see and do on screen; lead/activity
  tables are not locked down here yet. Safe to run more than once.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'team';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_access_level_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_access_level_check
      CHECK (access_level IN ('admin', 'team', 'viewer', 'removed'));
  END IF;
END $$;

UPDATE profiles p SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS NULL;

UPDATE profiles SET access_level = 'admin' WHERE lower(email) = 'amit@zionhills.in';

CREATE OR REPLACE FUNCTION public.is_crm_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'amit@zionhills.in'
$$;

DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
CREATE POLICY "admin_update_profiles" ON profiles FOR UPDATE
  TO authenticated USING (public.is_crm_admin()) WITH CHECK (public.is_crm_admin());

DROP POLICY IF EXISTS "admin_insert_profiles" ON profiles;
CREATE POLICY "admin_insert_profiles" ON profiles FOR INSERT
  TO authenticated WITH CHECK (public.is_crm_admin());

CREATE OR REPLACE FUNCTION public.guard_profile_access_level() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- No signed-in user = SQL editor / service role (anon requests can't reach
  -- profiles writes at all: RLS only grants them to authenticated users).
  IF public.is_crm_admin() OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.access_level IS DISTINCT FROM 'team' THEN
    RAISE EXCEPTION 'Only an admin can set access levels';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.access_level IS DISTINCT FROM OLD.access_level THEN
    RAISE EXCEPTION 'Only an admin can change access levels';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_profile_access_level ON profiles;
CREATE TRIGGER guard_profile_access_level
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_access_level();

SELECT full_name, email, access_level FROM profiles ORDER BY access_level, full_name;
