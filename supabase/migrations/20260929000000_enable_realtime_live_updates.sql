/*
  # Enable Realtime for live updates

  The app subscribes to changes on these tables so every open screen updates
  the moment anyone edits a lead, site visit or campaign, instead of
  re-downloading everything on a timer. Supabase only broadcasts changes for
  tables in the `supabase_realtime` publication. Safe to run more than once.
*/
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads', 'hospitality_leads', 'site_visits', 'campaigns'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;
