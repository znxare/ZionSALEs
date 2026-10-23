import { supabase } from './supabase';

// Food from the clubhouse kitchen, ordered from the public map and delivered to the guest's live
// location, paid on delivery. Run supabase/migrations/20261023000000_food_orders.sql first.

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  veg: boolean;
  category: string;
  available: boolean;
  note?: string;
}

export interface FoodMenu {
  /** The kitchen is taking orders. */
  open: boolean;
  items: MenuItem[];
}

export type FoodStatus = 'new' | 'accepted' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';

export interface FoodOrder {
  id: string;
  code: string;
  created_at: string;
  guest_name: string;
  guest_phone: string;
  note: string | null;
  items: { id: string; name: string; price: number; qty: number }[];
  total: number;
  lat: number | null;
  lng: number | null;
  map_x: number | null;
  map_y: number | null;
  located_at: string | null;
  status: FoodStatus;
  status_at: string;
  handled_by: string | null;
}

export const STATUS_STEPS: { id: FoodStatus; guest: string; kitchen: string }[] = [
  { id: 'new', guest: 'Order sent — waiting for the kitchen', kitchen: 'New' },
  { id: 'accepted', guest: 'The kitchen has your order', kitchen: 'Accepted' },
  { id: 'preparing', guest: 'Being prepared', kitchen: 'Preparing' },
  { id: 'on_the_way', guest: 'On the way to you', kitchen: 'On the way' },
  { id: 'delivered', guest: 'Delivered — enjoy!', kitchen: 'Delivered' },
];

export const SETUP_MESSAGE = 'Run the food-orders SQL in Supabase first (supabase/migrations/20261023000000_food_orders.sql).';

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const EMPTY: FoodMenu = { open: false, items: [] };

function clean(v: unknown): FoodMenu {
  const m = (v ?? {}) as Partial<FoodMenu>;
  return { open: !!m.open, items: Array.isArray(m.items) ? m.items : [] };
}

/** Guests (no login). */
export async function loadPublicMenu(): Promise<FoodMenu> {
  const { data, error } = await supabase.rpc('public_food_menu');
  return error ? EMPTY : clean(data);
}

/** Team (signed in). */
export async function loadMenu(): Promise<FoodMenu> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'food_menu').maybeSingle();
  return error || !data ? EMPTY : clean(data.value);
}

export async function saveMenu(menu: FoodMenu): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert({ key: 'food_menu', value: menu, updated_at: new Date().toISOString() });
  if (error) throw error.code === '42501' || error.code === 'PGRST205' ? new Error(SETUP_MESSAGE) : error;
}

export interface PlaceOrder {
  name: string;
  phone: string;
  note: string;
  cart: { id: string; qty: number }[];
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
}

export async function placeOrder(o: PlaceOrder): Promise<{ id: string; code: string; total: number }> {
  const { data, error } = await supabase.rpc('place_food_order', {
    guest_name: o.name, guest_phone: o.phone, note: o.note, cart: o.cart,
    lat: o.lat, lng: o.lng, map_x: o.mapX, map_y: o.mapY,
  });
  if (error) throw new Error(/function .* does not exist|not find the function/i.test(error.message) ? 'Food ordering isn’t switched on yet.' : error.message);
  return data as { id: string; code: string; total: number };
}

export async function orderStatus(id: string): Promise<Pick<FoodOrder, 'id' | 'code' | 'status' | 'status_at' | 'total' | 'items' | 'created_at'> | null> {
  const { data, error } = await supabase.rpc('food_order_status', { order_id: id });
  return error || !data ? null : (data as Pick<FoodOrder, 'id' | 'code' | 'status' | 'status_at' | 'total' | 'items' | 'created_at'>);
}

export async function sendOrderLocation(id: string, lat: number, lng: number, mapX: number, mapY: number): Promise<void> {
  await supabase.rpc('update_food_order_location', { order_id: id, lat, lng, map_x: mapX, map_y: mapY });
}

export async function cancelOrder(id: string): Promise<boolean> {
  const { data } = await supabase.rpc('cancel_food_order', { order_id: id });
  return !!data;
}

// ---------- kitchen (signed in) ----------

export async function fetchOrders(): Promise<FoodOrder[]> {
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const { data, error } = await supabase.from('food_orders').select('*').gte('created_at', since).order('created_at', { ascending: false });
  if (error) throw error.code === '42P01' || error.code === 'PGRST205' ? new Error(SETUP_MESSAGE) : error;
  return (data ?? []) as FoodOrder[];
}

export async function setOrderStatus(id: string, status: FoodStatus, by?: string): Promise<void> {
  const { error } = await supabase.from('food_orders').update({ status, status_at: new Date().toISOString(), handled_by: by ?? null }).eq('id', id);
  if (error) throw error;
}

/** Calls back on any new or changed order. Returns an unsubscribe function. */
export function onOrdersChanged(cb: (o: FoodOrder, isNew: boolean) => void): () => void {
  const ch = supabase
    .channel('food-orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'food_orders' }, (p) => cb(p.new as FoodOrder, p.eventType === 'INSERT'))
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}

// The guest's open order is remembered on their phone so it survives a reload.
const ACTIVE_KEY = 'zion-food-order';
export function rememberOrder(id: string | null) {
  try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch { /* no storage */ }
}
export function rememberedOrder(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}
