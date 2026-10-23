import { useEffect, useMemo, useState } from 'react';
import { X, Minus, Plus, MapPin, Loader2, ChevronLeft, UtensilsCrossed, Check, Phone } from 'lucide-react';
import {
  loadPublicMenu, placeOrder, orderStatus, sendOrderLocation, cancelOrder, rememberOrder, rupees, STATUS_STEPS, isFoodDemo,
  type FoodMenu, type FoodStatus, type MenuItem,
} from '@/lib/food';
import { lxEyebrow, lxIvory, lxOrange } from '@/lib/luxury';

// Ordering food on the public map: the clubhouse kitchen's menu, a cart, and delivery to wherever the
// guest's dot is on the estate. Paid on delivery. After ordering, a small card follows the order.

type Here = { lat: number; lng: number; x: number; y: number } | null;

const GUEST_KEY = 'zion-food-guest';
function savedGuest(): { name: string; phone: string } {
  try { return { name: '', phone: '', ...(JSON.parse(localStorage.getItem(GUEST_KEY) ?? '{}') as object) }; } catch { return { name: '', phone: '' }; }
}

function VegMark({ veg }: { veg: boolean }) {
  return (
    <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border ${veg ? 'border-emerald-600' : 'border-red-700'}`} title={veg ? 'Veg' : 'Non-veg'}>
      <span className={`h-1.5 w-1.5 rounded-full ${veg ? 'bg-emerald-600' : 'bg-red-700'}`} />
    </span>
  );
}

export default function FoodOrder({ open, onClose, orderId, onOrderId, here, locating, onLocate, sitePhone }: {
  /** The menu sheet is showing. */
  open: boolean;
  onClose: () => void;
  /** The guest's open order (followed with a small card). */
  orderId: string | null;
  onOrderId: (id: string | null) => void;
  /** Where the guest is right now (null until their location is on and they are on the estate). */
  here: Here;
  locating: boolean;
  onLocate: () => void;
  sitePhone?: string;
}) {
  const [menu, setMenu] = useState<FoodMenu | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [step, setStep] = useState<'menu' | 'checkout'>('menu');
  const [guest, setGuest] = useState(savedGuest);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (open && !menu) void loadPublicMenu().then(setMenu); }, [open, menu]);

  const items = useMemo(() => (menu?.items ?? []), [menu]);
  const byCat = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const it of items) { const c = it.category || 'Menu'; m.set(c, [...(m.get(c) ?? []), it]); }
    return [...m.entries()];
  }, [items]);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = items.reduce((s, it) => s + (cart[it.id] ?? 0) * it.price, 0);
  const add = (id: string, d: number) => setCart((c) => { const q = Math.max(0, Math.min(20, (c[id] ?? 0) + d)); const n = { ...c }; if (q) n[id] = q; else delete n[id]; return n; });

  async function submit() {
    if (!here) return;
    setBusy(true); setErr(null);
    try {
      const r = await placeOrder({ name: guest.name, phone: guest.phone, note, cart: Object.entries(cart).map(([id, qty]) => ({ id, qty })), lat: here.lat, lng: here.lng, mapX: here.x, mapY: here.y });
      try { localStorage.setItem(GUEST_KEY, JSON.stringify(guest)); } catch { /* no storage */ }
      rememberOrder(r.id);
      onOrderId(r.id);
      setCart({}); setNote(''); setStep('menu');
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not place the order. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {orderId && <OrderTracker id={orderId} here={here} onDone={() => { rememberOrder(null); onOrderId(null); }} sitePhone={sitePhone} />}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
          <div className={`flex max-h-[88dvh] w-full max-w-md animate-slide-up flex-col overflow-hidden rounded-t-[26px] sm:rounded-[26px] ${lxIvory}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 pb-2 pt-4">
              {step === 'checkout' && (
                <button onClick={() => setStep('menu')} aria-label="Back to the menu" className="-ml-2 rounded-full p-1.5 text-[#8a6a4a]"><ChevronLeft className="h-5 w-5" /></button>
              )}
              <div className="min-w-0 flex-1">
                <div className={`${lxEyebrow} text-[#d9480f]`}>{isFoodDemo() ? 'Demo · orders are not sent to the kitchen' : 'Clubhouse kitchen · pay on delivery'}</div>
                <div className="font-serif text-[24px] font-semibold leading-tight text-[#26231f]">{step === 'menu' ? 'Order food to where you are' : 'Your order'}</div>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-[#8a6a4a]"><X className="h-5 w-5" /></button>
            </div>

            {!menu ? (
              <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#f26a35]" /></div>
            ) : !menu.open || items.length === 0 ? (
              <div className="px-6 pb-10 pt-6 text-center text-[14px] text-[#5b5a4c]">
                The kitchen isn’t taking orders right now. Please try again a little later, or visit the clubhouse.
              </div>
            ) : step === 'menu' ? (
              <>
                <div className="flex-1 overflow-y-auto px-5 pb-3">
                  {byCat.map(([cat, list]) => (
                    <div key={cat} className="mb-3">
                      <div className={`${lxEyebrow} mb-1 mt-2 text-[#8a6a4a]`}>{cat}</div>
                      {list.map((it) => (
                        <div key={it.id} className={`flex items-center gap-3 border-b border-[#e3d8c2]/60 py-2.5 ${it.available ? '' : 'opacity-45'}`}>
                          <VegMark veg={it.veg} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-semibold text-[#26231f]">{it.name}</div>
                            {it.note && <div className="text-[12px] text-[#5b5a4c]">{it.note}</div>}
                            <div className="text-[13px] text-[#5b5a4c]">{rupees(it.price)}</div>
                          </div>
                          {!it.available ? (
                            <span className="text-[12px] font-semibold text-[#8a6a4a]">Sold out</span>
                          ) : cart[it.id] ? (
                            <div className="flex items-center gap-2 rounded-full bg-white px-1.5 py-1 ring-1 ring-[#e3d8c2]">
                              <button onClick={() => add(it.id, -1)} aria-label={`One less ${it.name}`} className="rounded-full p-1 text-[#d9480f]"><Minus className="h-4 w-4" /></button>
                              <span className="w-4 text-center text-[14px] font-bold text-[#26231f]">{cart[it.id]}</span>
                              <button onClick={() => add(it.id, 1)} aria-label={`One more ${it.name}`} className="rounded-full p-1 text-[#d9480f]"><Plus className="h-4 w-4" /></button>
                            </div>
                          ) : (
                            <button onClick={() => add(it.id, 1)} className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-[#d9480f] ring-1 ring-[#e3d8c2]">Add</button>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {count > 0 && (
                  <div className="border-t border-[#e3d8c2]/70 px-5 py-3">
                    <button onClick={() => { setErr(null); setStep('checkout'); }} className={`flex w-full items-center justify-between rounded-full px-5 py-3 text-[14px] font-semibold ${lxOrange}`}>
                      <span>{count} item{count === 1 ? '' : 's'}</span><span>Continue · {rupees(total)}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 pb-4">
                <div className="mb-3 rounded-2xl bg-white/70 p-3 ring-1 ring-[#e3d8c2]">
                  {items.filter((it) => cart[it.id]).map((it) => (
                    <div key={it.id} className="flex justify-between py-0.5 text-[14px] text-[#26231f]"><span>{cart[it.id]} × {it.name}</span><span>{rupees(cart[it.id] * it.price)}</span></div>
                  ))}
                  <div className="mt-1 flex justify-between border-t border-[#e3d8c2] pt-1.5 text-[15px] font-bold text-[#26231f]"><span>Total · pay on delivery</span><span>{rupees(total)}</span></div>
                </div>

                <div className="mb-3 flex items-start gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-[#e3d8c2]">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#d9480f]" />
                  {here ? (
                    <div className="text-[13px] text-[#26231f]"><b>Delivered to your live location.</b> We follow your dot on the map, so it’s fine to keep moving.</div>
                  ) : locating ? (
                    <div className="text-[13px] text-[#26231f]">Finding you… delivery is to your live location on the estate. Please stay on the estate with location on.</div>
                  ) : (
                    <div className="text-[13px] text-[#26231f]">
                      We deliver to your live location on the estate.
                      <button onClick={onLocate} className="mt-2 block rounded-full bg-[#26231f] px-4 py-1.5 text-[13px] font-semibold text-white">Turn on my location</button>
                    </div>
                  )}
                </div>

                <label className="mb-2 block">
                  <span className="text-[12px] font-semibold text-[#5b5a4c]">Your name</span>
                  <input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e3d8c2] bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#f26a35]" />
                </label>
                <label className="mb-2 block">
                  <span className="text-[12px] font-semibold text-[#5b5a4c]">Phone (the kitchen may call you)</span>
                  <input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} inputMode="tel" className="mt-1 w-full rounded-xl border border-[#e3d8c2] bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#f26a35]" />
                </label>
                <label className="mb-3 block">
                  <span className="text-[12px] font-semibold text-[#5b5a4c]">Note (optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. less spicy · white cart near the green" className="mt-1 w-full rounded-xl border border-[#e3d8c2] bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#f26a35]" />
                </label>
                {err && <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">{err}</div>}
                <button
                  onClick={() => void submit()}
                  disabled={busy || !here || guest.name.trim().length < 2 || guest.phone.replace(/\D/g, '').length < 10}
                  className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold disabled:opacity-50 ${lxOrange}`}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UtensilsCrossed className="h-4 w-4" />} Place order · {rupees(total)}
                </button>
                <p className="mt-2 text-center text-[11.5px] text-[#8a6a4a]">{isFoodDemo() ? 'This is a demo — no real order is placed and nothing will be delivered.' : 'Pay by cash or UPI when your food arrives.'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** The guest's open order: status, and their location kept current for the delivery. */
function OrderTracker({ id, here, onDone, sitePhone }: { id: string; here: Here; onDone: () => void; sitePhone?: string }) {
  const [st, setSt] = useState<{ code: string; status: FoodStatus; total: number } | null>(null);
  const [min, setMin] = useState(false);

  useEffect(() => {
    let live = true;
    const poll = () => void orderStatus(id).then((o) => {
      if (!live) return;
      if (!o) { onDone(); return; }
      setSt({ code: o.code, status: o.status, total: o.total });
    });
    poll();
    const t = window.setInterval(poll, 8000);
    return () => { live = false; window.clearInterval(t); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the delivery spot current while the order is open (every 15 s).
  const hx = here?.lat, hy = here?.lng;
  useEffect(() => {
    if (!here || !st || st.status === 'delivered' || st.status === 'cancelled') return;
    const send = () => void sendOrderLocation(id, here.lat, here.lng, here.x, here.y);
    const t = window.setInterval(send, 15000);
    return () => window.clearInterval(t);
  }, [id, hx, hy, st?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!st) return null;
  const finished = st.status === 'delivered' || st.status === 'cancelled';
  const idx = STATUS_STEPS.findIndex((s) => s.id === st.status);
  const label = st.status === 'cancelled' ? 'Order cancelled' : STATUS_STEPS[idx]?.guest;

  if (min) {
    return (
      <button onClick={() => setMin(false)} className={`pointer-events-auto absolute left-1/2 top-[6.6rem] z-[45] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-[#26231f] sm:top-[7.2rem] ${lxIvory}`}>
        <UtensilsCrossed className="h-4 w-4 text-[#d9480f]" /> {label}
      </button>
    );
  }
  return (
    <div className={`pointer-events-auto absolute left-3 right-3 top-[6.6rem] z-[45] mx-auto max-w-md rounded-[22px] p-3.5 sm:top-[7.2rem] ${lxIvory}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f26a35]/15 text-[#d9480f]">
          {finished ? <Check className="h-5 w-5" /> : <UtensilsCrossed className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`${lxEyebrow} text-[#8a6a4a]`}>{id.startsWith('demo-') ? 'Demo order — not sent to the kitchen' : `Order ${st.code} · ${rupees(st.total)} · pay on delivery`}</div>
          <div className="font-serif text-[19px] font-semibold leading-tight text-[#26231f]">{label}</div>
          {!finished && (
            <div className="mt-2 flex gap-1">
              {STATUS_STEPS.slice(0, 4).map((s, i) => <span key={s.id} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-[#f26a35]' : 'bg-[#e3d8c2]'}`} />)}
            </div>
          )}
          {!finished && !here && <div className="mt-1.5 text-[12px] text-[#a3241c]">Keep your location on so we can find you.</div>}
        </div>
        <button onClick={() => (finished ? onDone() : setMin(true))} aria-label={finished ? 'Close' : 'Minimise'} className="rounded-full p-1.5 text-[#8a6a4a]"><X className="h-4 w-4" /></button>
      </div>
      {!finished && (
        <div className="mt-2.5 flex gap-2">
          {st.status === 'new' && (
            <button onClick={() => void cancelOrder(id).then((ok) => { if (ok) setSt({ ...st, status: 'cancelled' }); })} className="flex-1 rounded-full bg-white py-2 text-[13px] font-semibold text-[#a3241c] ring-1 ring-[#e3d8c2]">Cancel order</button>
          )}
          {sitePhone && (
            <a href={`tel:${sitePhone}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[13px] font-semibold text-[#26231f] ring-1 ring-[#e3d8c2]"><Phone className="h-4 w-4" /> Call the clubhouse</a>
          )}
        </div>
      )}
    </div>
  );
}
