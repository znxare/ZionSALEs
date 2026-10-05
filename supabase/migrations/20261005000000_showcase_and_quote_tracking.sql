/*
  # Buyer showcase + quote tracking

  1. `showcase` storage bucket — renders, plot views, host photos, testimonial
     videos. Anyone can view (they're shown to buyers); only signed-in team
     members can upload or remove.
  2. `quote_links` — one row per quote sent to a buyer (plot, buyer, who sent it).
     `quote_views` — one row each time the buyer opens it.
     Buyers never touch these tables directly: the quote page calls
     `open_quote()`, which returns just that one quote and records the view.
  3. `public_showcase()` — the renders/host details the buyer page needs,
     without opening app_settings to the public.
  Safe to re-run.
*/

-- 1. Storage bucket -----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('showcase', 'showcase', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;

DROP POLICY IF EXISTS "showcase_public_read" ON storage.objects;
CREATE POLICY "showcase_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'showcase');

DROP POLICY IF EXISTS "showcase_team_insert" ON storage.objects;
CREATE POLICY "showcase_team_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'showcase');

DROP POLICY IF EXISTS "showcase_team_update" ON storage.objects;
CREATE POLICY "showcase_team_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'showcase');

DROP POLICY IF EXISTS "showcase_team_delete" ON storage.objects;
CREATE POLICY "showcase_team_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'showcase');

-- 2. Quote links and views ----------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_links (
  id text PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  plot_id text NOT NULL,
  buyer_name text,
  buyer_phone text,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  sender_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_views (
  id bigserial PRIMARY KEY,
  link_id text NOT NULL REFERENCES quote_links(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  device text
);
CREATE INDEX IF NOT EXISTS quote_views_link_idx ON quote_views (link_id, viewed_at DESC);

ALTER TABLE quote_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_all_quote_links" ON quote_links;
CREATE POLICY "team_all_quote_links" ON quote_links FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "team_read_quote_views" ON quote_views;
CREATE POLICY "team_read_quote_views" ON quote_views FOR SELECT
  TO authenticated USING (true);

-- The buyer's page: returns one quote and (unless count_view is false, e.g.
-- the sender previewing it) records that it was opened.
CREATE OR REPLACE FUNCTION public.open_quote(link text, count_view boolean DEFAULT true, device text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q quote_links%ROWTYPE;
BEGIN
  SELECT * INTO q FROM quote_links WHERE id = link;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF count_view THEN
    INSERT INTO quote_views (link_id, device) VALUES (q.id, left(device, 200));
  END IF;
  RETURN json_build_object('plot_id', q.plot_id, 'buyer_name', q.buyer_name, 'sender_id', q.sender_id, 'sender_name', q.sender_name);
END $$;

-- What the buyer page shows besides the plot: renders, host photo/phone, video.
CREATE OR REPLACE FUNCTION public.public_showcase()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT value FROM app_settings WHERE key = 'showcase'
$$;

REVOKE ALL ON FUNCTION public.open_quote(text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_quote(text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_showcase() TO anon, authenticated;

-- Live "just opened your quote" alerts in the CRM.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE quote_views;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Team members may save the showcase settings (renders etc.), not just the admin.
DROP POLICY IF EXISTS "team_upsert_showcase" ON app_settings;
CREATE POLICY "team_upsert_showcase" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (key = 'showcase');
DROP POLICY IF EXISTS "team_update_showcase" ON app_settings;
CREATE POLICY "team_update_showcase" ON app_settings FOR UPDATE
  TO authenticated USING (key = 'showcase') WITH CHECK (key = 'showcase');

SELECT 'showcase + quote tracking ready' AS status;
