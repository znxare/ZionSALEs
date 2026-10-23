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

// ---------- demo mode ----------
// Until the food SQL has been run there is nowhere to send orders, so the map runs a clearly-labelled
// demo instead: a sample menu, orders kept on this device that move through the steps by themselves,
// and the kitchen page shows the demo orders placed in the same browser. Once the SQL is run, real
// ordering takes over automatically.

let backend: boolean | null = null;
/** True once we know the food tables/functions aren't set up yet. */
export function isFoodDemo(): boolean { return backend === false; }
const isMissing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST202' || e.code === '42P01' || e.code === 'PGRST205' || e.code === '42883' || /does not exist|not find the function|schema cache/i.test(e.message ?? ''));

export const DEMO_MENU: FoodMenu = {
  open: true,
  items: [
    { id: 'd1', name: 'Masala dosa', price: 180, veg: true, category: 'Breakfast & snacks', available: true },
    { id: 'd2', name: 'Paneer tikka roll', price: 240, veg: true, category: 'Breakfast & snacks', available: true },
    { id: 'd3', name: 'Chicken club sandwich', price: 320, veg: false, category: 'Breakfast & snacks', available: true },
    { id: 'd4', name: 'Veg biryani', price: 360, veg: true, category: 'Mains', available: true },
    { id: 'd5', name: 'Chicken biryani', price: 420, veg: false, category: 'Mains', available: true },
    { id: 'd6', name: 'Filter coffee', price: 90, veg: true, category: 'Drinks', available: true },
    { id: 'd7', name: 'Fresh lime soda', price: 120, veg: true, category: 'Drinks', available: true },
    { id: 'd8', name: 'Cold coffee', price: 180, veg: true, category: 'Drinks', available: true },
  ],
};

const DEMO_ORDERS = 'zion-food-demo-orders';
const DEMO_MENU_KEY = 'zion-food-demo-menu';
type DemoOrder = FoodOrder & { auto: boolean };
function demoOrders(): DemoOrder[] {
  try { return JSON.parse(localStorage.getItem(DEMO_ORDERS) ?? '[]') as DemoOrder[]; } catch { return []; }
}
function saveDemoOrders(list: DemoOrder[]) {
  try { localStorage.setItem(DEMO_ORDERS, JSON.stringify(list.slice(0, 30))); } catch { /* no storage */ }
}
function demoMenu(): FoodMenu {
  try { const m = localStorage.getItem(DEMO_MENU_KEY); return m ? clean(JSON.parse(m)) : DEMO_MENU; } catch { return DEMO_MENU; }
}
/** In the demo an untouched order moves along by itself (the kitchen page can also move it). */
function withAutoStatus(o: DemoOrder): DemoOrder {
  if (!o.auto || o.status === 'cancelled' || o.status === 'delivered') return o;
  const sec = (Date.now() - new Date(o.created_at).getTime()) / 1000;
  const status: FoodStatus = sec < 8 ? 'new' : sec < 20 ? 'accepted' : sec < 40 ? 'preparing' : sec < 75 ? 'on_the_way' : 'delivered';
  return status === o.status ? o : { ...o, status, status_at: new Date().toISOString() };
}

function clean(v: unknown): FoodMenu {
  const m = (v ?? {}) as Partial<FoodMenu>;
  return { open: !!m.open, items: Array.isArray(m.items) ? m.items : [] };
}

/** Guests (no login). */
export async function loadPublicMenu(): Promise<FoodMenu> {
  const { data, error } = await supabase.rpc('public_food_menu');
  if (isMissing(error)) { backend = false; return demoMenu(); }
  if (error) return EMPTY;
  backend = true;
  return clean(data);
}

/** Team (signed in). */
export async function loadMenu(): Promise<FoodMenu> {
  if (backend === false) return demoMenu();
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'food_menu').maybeSingle();
  return error || !data ? EMPTY : clean(data.value);
}

export async function saveMenu(menu: FoodMenu): Promise<void> {
  if (backend === false) { try { localStorage.setItem(DEMO_MENU_KEY, JSON.stringify(menu)); } catch { /* no storage */ } return; }
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
  if (backend === false) {
    const menu = demoMenu();
    const items = o.cart.flatMap(({ id, qty }) => { const it = menu.items.find((m) => m.id === id); return it ? [{ id, name: it.name, price: it.price, qty }] : []; });
    const now = new Date().toISOString();
    const order: DemoOrder = {
      id: `demo-${Date.now()}`, code: Math.random().toString(36).slice(2, 6).toUpperCase(), created_at: now,
      guest_name: o.name.trim(), guest_phone: o.phone.trim(), note: o.note.trim() || null, items,
      total: items.reduce((s, i) => s + i.price * i.qty, 0), lat: o.lat, lng: o.lng, map_x: o.mapX, map_y: o.mapY,
      located_at: now, status: 'new', status_at: now, handled_by: null, auto: true,
    };
    saveDemoOrders([order, ...demoOrders()]);
    return { id: order.id, code: order.code, total: order.total };
  }
  const { data, error } = await supabase.rpc('place_food_order', {
    guest_name: o.name, guest_phone: o.phone, note: o.note, cart: o.cart,
    lat: o.lat, lng: o.lng, map_x: o.mapX, map_y: o.mapY,
  });
  if (error) throw new Error(/function .* does not exist|not find the function/i.test(error.message) ? 'Food ordering isn’t switched on yet.' : error.message);
  return data as { id: string; code: string; total: number };
}

export async function orderStatus(id: string): Promise<Pick<FoodOrder, 'id' | 'code' | 'status' | 'status_at' | 'total' | 'items' | 'created_at'> | null> {
  if (id.startsWith('demo-')) {
    const list = demoOrders().map(withAutoStatus);
    saveDemoOrders(list);
    return list.find((x) => x.id === id) ?? null;
  }
  const { data, error } = await supabase.rpc('food_order_status', { order_id: id });
  return error || !data ? null : (data as Pick<FoodOrder, 'id' | 'code' | 'status' | 'status_at' | 'total' | 'items' | 'created_at'>);
}

export async function sendOrderLocation(id: string, lat: number, lng: number, mapX: number, mapY: number): Promise<void> {
  if (id.startsWith('demo-')) { saveDemoOrders(demoOrders().map((x) => (x.id === id ? { ...x, lat, lng, map_x: mapX, map_y: mapY, located_at: new Date().toISOString() } : x))); return; }
  await supabase.rpc('update_food_order_location', { order_id: id, lat, lng, map_x: mapX, map_y: mapY });
}

export async function cancelOrder(id: string): Promise<boolean> {
  if (id.startsWith('demo-')) {
    const list = demoOrders().map(withAutoStatus);
    const o = list.find((x) => x.id === id);
    if (!o || o.status !== 'new') return false;
    saveDemoOrders(list.map((x) => (x.id === id ? { ...x, status: 'cancelled' as FoodStatus, status_at: new Date().toISOString(), auto: false } : x)));
    return true;
  }
  const { data } = await supabase.rpc('cancel_food_order', { order_id: id });
  return !!data;
}

// ---------- kitchen (signed in) ----------

export async function fetchOrders(): Promise<FoodOrder[]> {
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  if (backend !== false) {
    const { data, error } = await supabase.from('food_orders').select('*').gte('created_at', since).order('created_at', { ascending: false });
    if (!error) { backend = true; return (data ?? []) as FoodOrder[]; }
    if (!isMissing(error)) throw error;
    backend = false;
  }
  const list = demoOrders().map(withAutoStatus);
  saveDemoOrders(list);
  return list.filter((o) => o.created_at >= since);
}

export async function setOrderStatus(id: string, status: FoodStatus, by?: string): Promise<void> {
  if (id.startsWith('demo-')) { saveDemoOrders(demoOrders().map((x) => (x.id === id ? { ...x, status, status_at: new Date().toISOString(), handled_by: by ?? null, auto: false } : x))); return; }
  const { error } = await supabase.from('food_orders').update({ status, status_at: new Date().toISOString(), handled_by: by ?? null }).eq('id', id);
  if (error) throw error;
}

/** Calls back on any new or changed order. Returns an unsubscribe function. */
export function onOrdersChanged(cb: (o: FoodOrder, isNew: boolean) => void): () => void {
  // Demo orders placed in another tab of this browser.
  let seen = demoOrders().length;
  const onStorage = (e: StorageEvent) => {
    if (e.key !== DEMO_ORDERS) return;
    const list = demoOrders();
    if (list[0]) cb(list[0], list.length > seen);
    seen = list.length;
  };
  window.addEventListener('storage', onStorage);
  const ch = supabase
    .channel('food-orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'food_orders' }, (p) => cb(p.new as FoodOrder, p.eventType === 'INSERT'))
    .subscribe();
  return () => { window.removeEventListener('storage', onStorage); void supabase.removeChannel(ch); };
}

// The guest's open order is remembered on their phone so it survives a reload.
const ACTIVE_KEY = 'zion-food-order';
export function rememberOrder(id: string | null) {
  try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch { /* no storage */ }
}
export function rememberedOrder(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}
