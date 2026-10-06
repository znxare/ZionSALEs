/*
# Public tour calibration — optional

Lets the public map (#/map) show a visitor's own GPS dot on the plan. The team's
GPS calibration (which spots on the plan match which latitude/longitude) is in
app_settings, which only logged-in users can read; this exposes just that one
value to anyone, the same way public_showcase() exposes the buyer-page pictures.

Without this the public map still works: visitors pick where they are starting
from; only "Show my location" is hidden. Safe to run more than once.
*/

CREATE OR REPLACE FUNCTION public.public_tour_calibration()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT value FROM app_settings WHERE key = 'tour_calibration'
$$;

REVOKE ALL ON FUNCTION public.public_tour_calibration() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_tour_calibration() TO anon, authenticated;
