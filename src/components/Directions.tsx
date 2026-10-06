import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigation2, X, Search, MapPin, Home, Layers, CheckCircle2, Waves, ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, Undo2, Flag, Volume2, VolumeX } from 'lucide-react';
import { AMENITIES, VILLAS, PLOT_PLACES, findRoute, type Place } from '@/lib/directions';
import type { MapPt } from '@/lib/tour';
import { routeWaterContact, WATER_CAUTION_M } from '@/lib/water';
import { maneuversOf, turnWords, distanceWords, type TurnKind } from '@/lib/turns';
import { speak, useVoiceEnabled, setVoiceEnabled, voiceAvailable } from '@/lib/voice';

// Directions and map layers, shared by the live tour (from the cart's GPS
// position) and buyer presentation (from a chosen starting place).

export interface DirectionsView {
  route: MapPt[] | null;
  destination: { pt: MapPt; label: string } | null;
  places: { pt: MapPt; label: string; kind?: 'villa' }[];
}

export function DirectionsControls({ from, toGps, offRoad = false, initialDestination, onView, className = '', dark = false }: {
  /** Live position (tour). Leave undefined to let the user pick a starting place. */
  from?: MapPt | null;
  toGps?: ((pt: MapPt) => { lat: number; lng: number }) | null;
  /** Live tour: the cart has left the road (the banner says so). */
  offRoad?: boolean;
  /** Start with directions to this place already chosen (a shared link). */
  initialDestination?: Place;
  onView: (v: DirectionsView) => void;
  className?: string;
  dark?: boolean;
}) {
  const live = from !== undefined;
  const [picking, setPicking] = useState(false);
  const [dest, setDest] = useState<Place | null>(initialDestination ?? null);
  const [start, setStart] = useState<Place>(AMENITIES[0]);
  const [showPlaces, setShowPlaces] = useState(false);
  const [arrived, setArrived] = useState(false);

  const origin: MapPt | null = live ? from ?? null : start.pt;
  const route = useMemo(() => (origin && dest ? findRoute(origin, dest.pt) : null), [origin?.[0], origin?.[1], dest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Does the road run close to a lake? Said in the banner, ahead of time.
  const passesWater = useMemo(() => !!route && route.points.length > 1 && routeWaterContact(route.points).metres <= WATER_CAUTION_M, [route]);

  // Turn-by-turn (live position only). The route is rebuilt from the traveller's position at
  // every fix, so its first turn is always the next one to make.
  const guide = useMemo(() => (live && route && route.points.length > 1 ? maneuversOf(route.points) : null), [live, route]);
  const next = guide?.steps[0] ?? null;
  const voiceOn = useVoiceEnabled();
  const spoken = useRef(new Set<string>());
  const turnId = useRef<{ kind: TurnKind; at: MapPt; id: string } | null>(null);
  useEffect(() => { spoken.current = new Set(); turnId.current = null; }, [dest]);

  useEffect(() => {
    if (!dest || !live) return;
    if (!spoken.current.has('start')) { spoken.current.add('start'); speak(`Directions to ${dest.label} started. Follow the orange line.`); }
  }, [dest, live]);

  useEffect(() => {
    if (!next || !guide || offRoad || arrived) return;
    // Say each turn three times: well ahead, then close, then now. If a stage was skipped (fast
    // driving, a gap in GPS) only the latest is spoken.
    // The same turn is found a few metres apart as the route is rebuilt each fix, so treat turns of
    // the same kind within ~35 m as one.
    const prev = turnId.current;
    const same = prev && prev.kind === next.kind && Math.hypot((prev.at[0] - next.at[0]) * 23.7, (prev.at[1] - next.at[1]) * 16.9) < 35;
    if (!same) turnId.current = { kind: next.kind, at: next.at, id: `${next.kind}@${next.at[0].toFixed(2)},${next.at[1].toFixed(2)}` };
    const id = turnId.current!.id;
    const stage = next.s <= 40 ? 'now' : next.s <= 150 ? 'near' : next.s <= 400 ? 'far' : null;
    if (!stage) return;
    const order = ['far', 'near', 'now'];
    const mine = order.indexOf(stage);
    if (order.slice(mine).some((st) => spoken.current.has(`${id}:${st}`))) return;
    order.slice(0, mine + 1).forEach((st) => spoken.current.add(`${id}:${st}`));
    const where = next.kind === 'arrive' ? `arrive at ${dest?.label ?? 'your destination'}` : turnWords(next.kind).toLowerCase();
    speak(stage === 'now' ? (next.kind === 'arrive' ? `You will arrive at ${dest?.label ?? 'your destination'}` : `${turnWords(next.kind)} now`) : `In ${distanceWords(next.s).replace(' m', ' metres').replace(' km', ' kilometres')}, ${where}`);
  }, [next?.kind, next?.at[0], next?.at[1], next && Math.round(next.s / 10), offRoad, arrived]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!live || !dest) return;
    if (offRoad) { if (!spoken.current.has('off')) { spoken.current.add('off'); speak("You have left the road. Get back on it."); } }
    else spoken.current.delete('off');
  }, [offRoad, live, dest]);
  useEffect(() => { if (arrived && dest) speak(`You have arrived at ${dest.label}`); }, [arrived]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arrival (live tour): within ~25 m of the destination.
  useEffect(() => {
    if (!live || !dest || !origin || !toGps) return;
    const a = toGps(origin), b = toGps(dest.pt);
    const m = Math.hypot((b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180), (b.lat - a.lat) * 110540);
    if (m < 25 && !arrived) setArrived(true);
  }, [live, dest, origin, toGps, arrived]);
  useEffect(() => {
    if (!arrived) return;
    const t = window.setTimeout(() => { setDest(null); setArrived(false); }, 12000);
    return () => window.clearTimeout(t);
  }, [arrived]);

  useEffect(() => {
    onView({
      route: route?.points ?? null,
      destination: dest ? { pt: dest.pt, label: dest.label } : null,
      places: showPlaces
        ? [
            ...AMENITIES.map((p) => ({ pt: p.pt, label: p.label })),
            // Just the number on the map; the full name shows once picked as a destination.
            // Hidden while a route is showing, so only the destination stands out.
            ...(dest ? [] : VILLAS).map((p) => ({ pt: p.pt, label: p.label.replace('Villa ', ''), kind: 'villa' as const })),
          ]
        : [],
    });
  }, [route, dest, showPlaces, onView]);

  const pill = dark
    ? 'bg-[#13261c]/90 text-white ring-1 ring-white/15 hover:bg-[#13261c]'
    : 'bg-white/90 text-gray-800 hover:bg-white';

  return (
    <>
      <div className={`pointer-events-auto flex items-center gap-2 ${className}`}>
        <button onClick={() => setPicking(true)} className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold shadow-md backdrop-blur ${dest ? 'bg-[#f05a22] text-white' : pill}`}>
          <Navigation2 className="h-4 w-4" /> Directions
        </button>
        <button
          onClick={() => setShowPlaces((v) => !v)}
          aria-pressed={showPlaces}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold shadow-md backdrop-blur ${showPlaces ? 'bg-[#13261c] text-white' : pill}`}
        >
          <Layers className="h-4 w-4" /> Places
        </button>
      </div>

      {/* Route banner */}
      {dest && (
        <div className="pointer-events-auto fixed inset-x-3 bottom-20 z-[45] mx-auto max-w-md animate-slide-up rounded-2xl bg-white/95 px-4 py-3 shadow-xl ring-1 ring-black/5 backdrop-blur">
          {arrived ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-gray-900">You've arrived</div>
                <div className="truncate text-[13px] text-gray-500">{dest.label}</div>
              </div>
              <button onClick={() => { setDest(null); setArrived(false); }} className="rounded-full p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {guide && next && !offRoad ? (
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#f05a22] text-white"><TurnIcon kind={next.kind} className="h-9 w-9" /></div>
              ) : (
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white ${live && offRoad ? 'bg-red-600' : 'bg-[#f05a22]'}`}><Navigation2 className="h-5 w-5" /></div>
              )}
              <div className="min-w-0 flex-1">
                {guide && next && !offRoad ? (
                  <>
                    <div className="truncate text-[20px] font-extrabold leading-tight text-gray-900">{next.s <= 25 ? 'Now' : `In ${distanceWords(next.s)}`}</div>
                    <div className="truncate text-[15px] font-bold leading-tight text-[#f05a22]">{next.kind === 'arrive' ? `Arrive at ${dest.label}` : turnWords(next.kind)}</div>
                    <div className="truncate text-[12px] text-gray-500">{dest.label} · {distanceWords(guide.total)} to go</div>
                  </>
                ) : (
                  <>
                    <div className="truncate text-[15px] font-bold text-gray-900">{dest.label}</div>
                    <div className={`truncate text-[13px] ${live && offRoad ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                      {!origin ? 'Waiting for your location…' : !route ? 'No road inside the estate to here' : live && offRoad ? "You've left the road — get back on it" : live ? 'Follow the orange line' : `From ${start.label}`}
                    </div>
                  </>
                )}
                {passesWater && !!route && (
                  <div className="mt-0.5 flex items-center gap-1 text-[12px] font-semibold text-red-600"><Waves className="h-3.5 w-3.5 shrink-0" /> Route passes close to deep water — go slowly</div>
                )}
              </div>
              {live && voiceAvailable() && (
                <button
                  onClick={() => setVoiceEnabled(!voiceOn)}
                  aria-label={voiceOn ? 'Mute voice directions' : 'Turn on voice directions'}
                  aria-pressed={voiceOn}
                  className={`rounded-full p-2 hover:bg-gray-100 ${voiceOn ? 'text-[#f05a22]' : 'text-gray-400'}`}
                >
                  {voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </button>
              )}
              <button onClick={() => setDest(null)} aria-label="End directions" className="rounded-full p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
          )}
        </div>
      )}

      {picking && (
        <PlacePicker
          live={live}
          start={start}
          onStart={setStart}
          onPick={(p) => { setDest(p); setArrived(false); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

// Groups shown as a grid of short number buttons rather than a list.
const GRID_GROUPS = ['Plots', 'Hospitality villas'];

function PlacePicker({ live, start, onStart, onPick, onClose }: {
  live: boolean;
  start: Place;
  onStart: (p: Place) => void;
  onPick: (p: Place) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const match = (p: Place) => !s || p.label.toLowerCase().includes(s);
  const groups: { title: string; icon: typeof MapPin; items: Place[] }[] = [
    { title: 'Places', icon: Home, items: AMENITIES.filter(match) },
    { title: 'Hospitality villas', icon: Home, items: VILLAS.filter(match) },
    { title: 'Plots', icon: MapPin, items: PLOT_PLACES.filter(match) },
  ].filter((g) => g.items.length > 0);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[85dvh] w-full max-w-md animate-slide-up flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="font-display text-lg font-bold text-gray-900">Where to?</h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        {!live && (
          <label className="mx-5 mb-2 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-[13px] text-gray-600">
            From
            <select value={start.id} onChange={(e) => onStart(AMENITIES.find((a) => a.id === e.target.value) ?? AMENITIES[0])} className="flex-1 bg-transparent font-semibold text-gray-900 outline-none">
              {AMENITIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
        )}
        <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search — clubhouse, plot 622, villa 124…" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <div className="flex-1 overflow-y-auto pb-4">
          {groups.length === 0 && <div className="px-5 py-10 text-center text-sm text-gray-400">Nothing matches.</div>}
          {groups.map((g) => (
            <div key={g.title} className="mb-2">
              <div className="px-5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.title}</div>
              <div className={GRID_GROUPS.includes(g.title) ? 'grid grid-cols-3 gap-1.5 px-5' : 'px-2'}>
                {g.items.map((p) =>
                  GRID_GROUPS.includes(g.title) ? (
                    <button key={p.id} onClick={() => onPick(p)} className="truncate rounded-xl bg-gray-50 px-2 py-2 text-[13px] font-semibold text-gray-800 hover:bg-[#f05a22]/10 hover:text-[#f05a22]">
                      {p.label.replace('Plot ', '').replace('Villa ', '')}
                    </button>
                  ) : (
                    <button key={p.id} onClick={() => onPick(p)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-gray-50">
                      <g.icon className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate text-[14px] font-medium text-gray-800">{p.label}</span>
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TurnIcon({ kind, className }: { kind: TurnKind; className?: string }) {
  const Icon = { left: CornerUpLeft, right: CornerUpRight, 'slight-left': ArrowUpLeft, 'slight-right': ArrowUpRight, uturn: Undo2, arrive: Flag }[kind] ?? ArrowUp;
  return <Icon className={className} strokeWidth={2.5} />;
}
