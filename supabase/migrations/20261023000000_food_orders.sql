/*
  # Food orders from the public map (clubhouse kitchen, pay on delivery)

  - The menu lives in app_settings (key `food_menu`): { open: bool, items: [{ id, name, price, veg, category, available, note? }] }.
    Team members edit it in the CRM (Food orders page); guests read it through `public_food_menu()`.
  - `food_orders`: one row per order. Guests never touch the table directly — they place, follow and
    update their order only through the functions below (which also re-price the order from the menu,
    so a guest can't change prices). Signed-in team members see and update all orders.
  Safe to re-run.
*/

CREATE TABLE IF NOT EXISTS food_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)),
  created_at timestamptz NOT NULL DEFAULT now(),
  guest_name text NOT NULL,
  guest_phone text NOT NULL,
  note text,
  items jsonb NOT NULL,              -- [{ id, name, price, qty }]
  total numeric NOT NULL,
  lat double precision,
  lng double precision,
  map_x double precision,            -- where on the master plan (% of width / height)
  map_y double precision,
  located_at timestamptz,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'preparing', 'on_the_way', 'delivered', 'cancelled')),
  status_at timestamptz NOT NULL DEFAULT now(),
  handled_by text
);
CREATE INDEX IF NOT EXISTS food_orders_open_idx ON food_orders (status, created_at DESC);

ALTER TABLE food_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_all_food_orders" ON food_orders;
CREATE POLICY "team_all_food_orders" ON food_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Team members (not only the admin) can save the menu.
DROP POLICY IF EXISTS "team_upsert_food_menu" ON app_settings;
CREATE POLICY "team_upsert_food_menu" ON app_settings FOR INSERT TO authenticated WITH CHECK (key = 'food_menu');
DROP POLICY IF EXISTS "team_update_food_menu" ON app_settings;
CREATE POLICY "team_update_food_menu" ON app_settings FOR UPDATE TO authenticated USING (key = 'food_menu') WITH CHECK (key = 'food_menu');

-- The menu, for the public map.
CREATE OR REPLACE FUNCTION public.public_food_menu()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT value FROM app_settings WHERE key = 'food_menu'
$$;

-- Place an order. `cart` = [{ id, qty }]; prices and names are taken from the menu, not from the guest.
CREATE OR REPLACE FUNCTION public.place_food_order(
  guest_name text, guest_phone text, note text, cart jsonb,
  lat double precision, lng double precision, map_x double precision, map_y double precision
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_variable
DECLARE
  menu jsonb;
  line jsonb;
  item jsonb;
  qty int;
  lines jsonb := '[]'::jsonb;
  sum numeric := 0;
  digits text := regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g');
  o food_orders%ROWTYPE;
BEGIN
  SELECT value INTO menu FROM app_settings WHERE key = 'food_menu';
  IF menu IS NULL OR coalesce((menu->>'open')::boolean, false) = false THEN
    RAISE EXCEPTION 'The kitchen is closed right now.';
  END IF;
  IF length(trim(coalesce(guest_name, ''))) < 2 THEN RAISE EXCEPTION 'Please enter your name.'; END IF;
  IF length(digits) < 10 THEN RAISE EXCEPTION 'Please enter a valid phone number.'; END IF;
  IF lat IS NULL OR lng IS NULL THEN RAISE EXCEPTION 'Turn on your location so we can find you.'; END IF;
  IF (SELECT count(*) FROM food_orders f WHERE regexp_replace(f.guest_phone, '\D', '', 'g') = digits
        AND f.status NOT IN ('delivered', 'cancelled') AND f.created_at > now() - interval '6 hours') >= 3 THEN
    RAISE EXCEPTION 'You already have 3 orders on the way — please wait for them first.';
  END IF;

  FOR line IN SELECT * FROM jsonb_array_elements(coalesce(cart, '[]'::jsonb)) LOOP
    qty := greatest(0, least(20, coalesce((line->>'qty')::int, 0)));
    CONTINUE WHEN qty = 0;
    SELECT i INTO item FROM jsonb_array_elements(menu->'items') i WHERE i->>'id' = line->>'id' AND coalesce((i->>'available')::boolean, true);
    IF item IS NULL THEN RAISE EXCEPTION 'Something in your order is no longer available — please check the menu.'; END IF;
    lines := lines || jsonb_build_object('id', item->>'id', 'name', item->>'name', 'price', (item->>'price')::numeric, 'qty', qty);
    sum := sum + (item->>'price')::numeric * qty;
  END LOOP;
  IF jsonb_array_length(lines) = 0 THEN RAISE EXCEPTION 'Your order is empty.'; END IF;

  INSERT INTO food_orders (guest_name, guest_phone, note, items, total, lat, lng, map_x, map_y, located_at)
  VALUES (trim(guest_name), trim(guest_phone), nullif(trim(coalesce(note, '')), ''), lines, sum, lat, lng, map_x, map_y, now())
  RETURNING * INTO o;
  RETURN json_build_object('id', o.id, 'code', o.code, 'total', o.total);
END $$;

-- The guest following their order (needs the order's id, which only they have).
CREATE OR REPLACE FUNCTION public.food_order_status(order_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('id', id, 'code', code, 'status', status, 'status_at', status_at, 'total', total, 'items', items, 'created_at', created_at)
  FROM food_orders WHERE id = order_id
$$;

-- The guest's phone keeps the delivery spot current while the order is open.
CREATE OR REPLACE FUNCTION public.update_food_order_location(order_id uuid, lat double precision, lng double precision, map_x double precision, map_y double precision)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE food_orders SET lat = $2, lng = $3, map_x = $4, map_y = $5, located_at = now()
  WHERE id = order_id AND status NOT IN ('delivered', 'cancelled')
$$;

-- The guest cancelling before the kitchen has accepted.
CREATE OR REPLACE FUNCTION public.cancel_food_order(order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE food_orders SET status = 'cancelled', status_at = now() WHERE id = order_id AND status = 'new';
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.place_food_order(text, text, text, jsonb, double precision, double precision, double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_food_order_location(uuid, double precision, double precision, double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_food_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_food_menu() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_food_order(text, text, text, jsonb, double precision, double precision, double precision, double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.food_order_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_food_order_location(uuid, double precision, double precision, double precision, double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_food_order(uuid) TO anon, authenticated;

-- Live "new order" alerts in the kitchen.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE food_orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT 'food orders ready' AS status;
