/*
  # Team-wide app settings (module access per role)

  One row per setting key. Currently used for `module_visibility`: which
  pages Team and Viewer can open, chosen by the admin in Settings.
  Signed-in users can read; only the admin can change it. Safe to re-run.
*/

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Same check as the access-levels migration (re-declared so this file works on its own).
CREATE OR REPLACE FUNCTION public.is_crm_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'amit@zionhills.in'
$$;

DROP POLICY IF EXISTS "authenticated_select_app_settings" ON app_settings;
CREATE POLICY "authenticated_select_app_settings" ON app_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_app_settings" ON app_settings;
CREATE POLICY "admin_insert_app_settings" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (public.is_crm_admin());

DROP POLICY IF EXISTS "admin_update_app_settings" ON app_settings;
CREATE POLICY "admin_update_app_settings" ON app_settings FOR UPDATE
  TO authenticated USING (public.is_crm_admin()) WITH CHECK (public.is_crm_admin());

SELECT 'app_settings ready' AS status;
