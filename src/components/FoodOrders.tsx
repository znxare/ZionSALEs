import { useCallback, useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, Phone, MessageCircle, Plus, Trash2, Save, Loader2, MapPin, BellRing } from 'lucide-react';
import {
  fetchOrders, setOrderStatus, onOrdersChanged, loadMenu, saveMenu, rupees, STATUS_STEPS,
  type FoodMenu, type FoodOrder, type FoodStatus, type MenuItem,
} from '@/lib/food';
import { MasterPlanBoard } from './LiveInventoryBoard';
import { SAMPLE_PLOTS } from '@/lib/inventory';
import { getCurrentUser } from '@/lib/auth';

// The clubhouse kitchen's screen: food ordered from the public map arrives here live (with a sound),
// shows where on the estate to deliver, and moves through Accepted → Preparing → On the way → Delivered.
// The menu and the "kitchen open" switch are edited here too. Keep this page open in the kitchen.

const NEXT: Partial<Record<FoodStatus, { to: FoodStatus; label: string }>> = {
  new: { to: 'accepted', label: 'Accept order' },
  accepted: { to: 'preparing', label: 'Start preparing' },
  preparing: { to: 'on_the_way', label: 'Out for delivery' },
  on_the_way: { to: 'delivered', label: 'Mark delivered (paid)' },
};

function ago(iso: string | null): string {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.18, 0.36].forEach((t, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = [880, 1175, 1568][i]; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.32);
    });
  } catch { /* no audio */ }
}

const waLink = (phone: string) => { const d = phone.replace(/\D/g, ''); return `https://wa.me/${d.length === 10 ? `91${d}` : d}`; };

export default function FoodOrders() {
  const [tab, setTab] = useState<'orders' | 'menu'>('orders');
  const [orders, setOrders] = useState<FoodOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<FoodMenu | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [, tick] = useState(0);
  const me = getCurrentUser()?.full_name;

  const load = useCallback(() => { fetchOrders().then((o) => { setOrders(o); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : 'Could not load orders.')); }, []);
  useEffect(() => { load(); void loadMenu().then(setMenu); }, [load]);
  useEffect(() => onOrdersChanged((o, isNew) => {
    load();
    if (isNew) {
      chime();
      setFresh(`New order ${o.code} from ${o.guest_name} — ${rupees(o.total)}`);
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification(`New food order ${o.code}`, { body: `${o.guest_name} · ${rupees(o.total)}` }); } catch { /* unavailable */ }
    }
  }), [load]);
  // Refresh the "x min ago" labels and catch anything the live feed missed.
  useEffect(() => { const t = window.setInterval(() => { tick((n) => n + 1); load(); }, 30000); return () => window.clearInterval(t); }, [load]);

  const open = (orders ?? []).filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const done = (orders ?? []).filter((o) => o.status === 'delivered' || o.status === 'cancelled');
  const todayTotal = done.filter((o) => o.status === 'delivered' && new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((s, o) => s + Number(o.total), 0);

  async function toggleKitchen() {
    if (!menu) return;
    const next = { ...menu, open: !menu.open };
    setMenu(next);
    try { await saveMenu(next); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); setMenu(menu); }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-600"><UtensilsCrossed className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Food orders</h1>
          <p className="text-[13px] text-gray-500">From the public map · pay on delivery · keep this page open in the kitchen.</p>
        </div>
        {menu && (
          <button onClick={() => void toggleKitchen()} className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm ${menu.open ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${menu.open ? 'animate-pulse bg-white' : 'bg-gray-500'}`} /> {menu.open ? 'Kitchen open — taking orders' : 'Kitchen closed'}
          </button>
        )}
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {fresh && (
        <button onClick={() => setFresh(null)} className="flex w-full items-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-left text-sm font-semibold text-white shadow-lg">
          <BellRing className="h-5 w-5" /> {fresh}
        </button>
      )}

      <div className="flex gap-2">
        {(['orders', 'menu'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 card-shadow'}`}>
            {t === 'orders' ? `Orders${open.length ? ` (${open.length})` : ''}` : 'Menu'}
          </button>
        ))}
        {'Notification' in window && Notification.permission === 'default' && (
          <button onClick={() => void Notification.requestPermission()} className="ml-auto rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-700 card-shadow">Turn on pop-up alerts</button>
        )}
      </div>

      {tab === 'orders' ? (
        orders === null ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : (
          <>
            {open.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center text-sm text-gray-400">
                No open orders. {menu?.open ? 'New ones appear here with a sound.' : 'Switch the kitchen to open to start taking orders.'}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {open.map((o) => <OrderCard key={o.id} o={o} me={me} onChanged={load} />)}
              </div>
            )}
            {done.length > 0 && (
              <div className="rounded-2xl border border-black/5 bg-white p-4 card-shadow">
                <div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-gray-900">Finished (last 36 h)</span><span className="text-gray-500">Delivered today: {rupees(todayTotal)}</span></div>
                <ul className="divide-y divide-gray-100 text-[13px]">
                  {done.map((o) => (
                    <li key={o.id} className="flex justify-between gap-3 py-2">
                      <span className="truncate text-gray-700">{o.code} · {o.guest_name} · {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</span>
                      <span className={`shrink-0 ${o.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{rupees(o.total)} · {o.status === 'cancelled' ? 'cancelled' : 'delivered'} {ago(o.status_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )
      ) : (
        menu && <MenuEditor menu={menu} onSaved={setMenu} />
      )}
    </div>
  );
}

function OrderCard({ o, me, onChanged }: { o: FoodOrder; me?: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const next = NEXT[o.status];
  const step = STATUS_STEPS.find((s) => s.id === o.status);
  const pt: [number, number] | null = o.map_x != null && o.map_y != null ? [o.map_x, o.map_y] : null;
  const marker = useMemo(() => (pt ? { pt, accuracyPct: 0.6 } : null), [o.map_x, o.map_y]); // eslint-disable-line react-hooks/exhaustive-deps
  // Re-centre on the guest whenever their phone reports a new spot.
  const focus = useMemo(() => (pt ? { pt, zoom: 3.2, exact: true, nonce: Date.now() } : null), [o.map_x, o.map_y]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (to: FoodStatus) => { setBusy(true); try { await setOrderStatus(o.id, to, me); onChanged(); } finally { setBusy(false); } };

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white card-shadow ${o.status === 'new' ? 'border-orange-300 ring-2 ring-orange-200' : 'border-black/5'}`}>
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-gray-900 px-2 py-0.5 font-mono text-sm font-bold text-white">{o.code}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${o.status === 'new' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>{step?.kitchen}</span>
            <span className="text-[12px] text-gray-400">ordered {ago(o.created_at)}</span>
          </div>
          <div className="mt-2 text-[15px] font-semibold text-gray-900">{o.guest_name}</div>
          <ul className="mt-1 text-[14px] text-gray-700">
            {o.items.map((i) => <li key={i.id}>{i.qty} × {i.name} <span className="text-gray-400">· {rupees(i.price * i.qty)}</span></li>)}
          </ul>
          {o.note && <div className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[13px] text-amber-800">“{o.note}”</div>}
          <div className="mt-1.5 text-[15px] font-bold text-gray-900">{rupees(o.total)} <span className="text-[12px] font-medium text-gray-500">to collect on delivery</span></div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <a href={`tel:${o.guest_phone}`} className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-700" title="Call"><Phone className="h-4 w-4" /></a>
          <a href={waLink(o.guest_phone)} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-700" title="WhatsApp"><MessageCircle className="h-4 w-4" /></a>
        </div>
      </div>
      <div className="relative h-48 border-y border-gray-100 bg-[#d4d5c6]">
        {pt ? (
          <MasterPlanBoard plots={SAMPLE_PLOTS} onSelect={() => {}} bare cover marker={marker} focus={focus} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-gray-500">No location yet</div>
        )}
        <div className="absolute left-2 top-2 z-30 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold text-gray-700 shadow">
          <MapPin className="h-3.5 w-3.5 text-orange-600" /> Deliver here · seen {ago(o.located_at)}
        </div>
        {o.lat != null && o.lng != null && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}`} target="_blank" rel="noreferrer" className="absolute bottom-2 right-2 z-30 rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold text-blue-700 shadow">Open in Google Maps</a>
        )}
      </div>
      <div className="flex gap-2 p-3">
        {next && (
          <button disabled={busy} onClick={() => void go(next.to)} className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? '…' : next.label}</button>
        )}
        <button disabled={busy} onClick={() => { if (window.confirm(`Cancel order ${o.code}?`)) void go('cancelled'); }} className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-600">Cancel</button>
      </div>
    </div>
  );
}

function MenuEditor({ menu, onSaved }: { menu: FoodMenu; onSaved: (m: FoodMenu) => void }) {
  const [items, setItems] = useState<MenuItem[]>(menu.items);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (i: number, patch: Partial<MenuItem>) => setItems((list) => list.map((it, n) => (n === i ? { ...it, ...patch } : it)));
  const input = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-orange-300';

  async function save() {
    setSaving(true); setMsg(null);
    const clean = items.filter((it) => it.name.trim()).map((it) => ({ ...it, name: it.name.trim(), category: it.category.trim() || 'Menu', price: Math.max(0, Number(it.price) || 0) }));
    try { await saveMenu({ ...menu, items: clean }); setItems(clean); onSaved({ ...menu, items: clean }); setMsg('Menu saved — guests see it straight away.'); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 card-shadow">
      <div className="mb-3 hidden grid-cols-[1.6fr_1fr_0.7fr_auto_auto_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:grid">
        <span>Dish</span><span>Category</span><span>Price ₹</span><span>Veg</span><span>Available</span><span />
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={it.id} className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-2 sm:grid-cols-[1.6fr_1fr_0.7fr_auto_auto_auto] sm:items-center sm:bg-transparent sm:p-0">
            <input value={it.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="e.g. Masala dosa" className={`${input} col-span-2 sm:col-span-1`} />
            <input value={it.category} onChange={(e) => set(i, { category: e.target.value })} placeholder="e.g. Snacks" className={input} />
            <input value={it.price || ''} onChange={(e) => set(i, { price: Number(e.target.value.replace(/[^\d.]/g, '')) })} inputMode="decimal" placeholder="0" className={input} />
            <label className="flex items-center gap-1.5 text-[13px] text-gray-700"><input type="checkbox" checked={it.veg} onChange={(e) => set(i, { veg: e.target.checked })} className="h-4 w-4 accent-emerald-600" /> Veg</label>
            <label className="flex items-center gap-1.5 text-[13px] text-gray-700"><input type="checkbox" checked={it.available} onChange={(e) => set(i, { available: e.target.checked })} className="h-4 w-4 accent-orange-600" /> Available</label>
            <button onClick={() => setItems((l) => l.filter((_, n) => n !== i))} title="Remove" className="justify-self-end rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setItems((l) => [...l, { id: `m${Date.now()}`, name: '', price: 0, veg: true, category: l[l.length - 1]?.category ?? 'Snacks', available: true }])} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><Plus className="h-4 w-4" /> Add dish</button>
        <button onClick={() => void save()} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save menu</button>
        {msg && <span className="text-[13px] text-gray-600">{msg}</span>}
      </div>
    </div>
  );
}
