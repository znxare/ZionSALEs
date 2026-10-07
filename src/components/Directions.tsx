import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigation2, X, Search, MapPin, Home, Layers, CheckCircle2, Waves, ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, Undo2, Flag } from 'lucide-react';
import { AMENITIES, VILLAS, PLOT_PLACES, findRoute, planMetres, describeDistance, type Place } from '@/lib/directions';
import type { MapPt } from '@/lib/tour';
import { routeWaterContact, WATER_ROUTE_NOTE_M } from '@/lib/water';
import { maneuversOf, turnWords, distanceWords, type TurnKind } from '@/lib/turns';
import { lxEyebrow, lxGlass, lxIvory, lxOrange } from '@/lib/luxury';

// Directions and map layers, shared by the live tour (from the cart's GPS
// position) and buyer presentation (from a chosen starting place).

export interface DirectionsView {
  route: MapPt[] | null;
  destination: { pt: MapPt; label: string } | null;
  places: { pt: MapPt; label: string; kind?: 'villa' }[];
}

export type DirectionsPhase = 'idle' | 'preview' | 'navigating';

export function DirectionsControls({ from, toGps, offRoad = false, initialDestination, onView, className = '', dark = false, guided = false, onStart, onPhase, hidePill = false, hidePlaces = false, openSignal = 0 }: {
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
  /** Google Maps-style: choosing a place shows a route preview with a Start button; Start begins turn-by-turn navigation. */
  guided?: boolean;
  /** Guided: Start was tapped (the parent starts locating, follows the position, …). */
  onStart?: () => boolean | void;
  onPhase?: (phase: DirectionsPhase) => void;
  /** The parent has its own Directions button: hide this one. */
  hidePill?: boolean;
  /** Hide the Places layer button. */
  hidePlaces?: boolean;
  /** Bump this number to open the place picker from the parent's button. */
  openSignal?: number;
}) {
  const live = from !== undefined;
  const [picking, setPicking] = useState(false);
  const [dest, setDest] = useState<Place | null>(initialDestination ?? null);
  const [start, setStart] = useState<Place>(AMENITIES[0]);
  const [showPlaces, setShowPlaces] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [navigating, setNavigating] = useState(false);
  useEffect(() => { if (openSignal > 0) setPicking(true); }, [openSignal]);

  const origin: MapPt | null = live ? from ?? null : start.pt;
  const route = useMemo(() => (origin && dest ? findRoute(origin, dest.pt) : null), [origin?.[0], origin?.[1], dest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Does the road run close to a lake? Said in the banner, ahead of time.
  const passesWater = useMemo(() => !!route && route.points.length > 1 && routeWaterContact(route.points).metres <= WATER_ROUTE_NOTE_M, [route]);

  // Turn-by-turn (live position only). The route is rebuilt from the traveller's position at
  // every fix, so its first turn is always the next one to make.
  const guide = useMemo(() => (live && route && route.points.length > 1 ? maneuversOf(route.points) : null), [live, route]);
  const next = guide?.steps[0] ?? null;
  // Spoken alerts are for hazards only (deep water, see WaterCaution); turns are shown, not spoken.
  useEffect(() => { if (!dest) setNavigating(false); }, [dest]);
  const phase: DirectionsPhase = !dest ? 'idle' : guided && navigating ? 'navigating' : 'preview';
  useEffect(() => { onPhase?.(phase); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

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
    ? 'bg-[#13261c]/90 text-white ring-1 ring-white/[0.15] hover:bg-[#13261c]'
    : 'bg-white/90 text-gray-800 hover:bg-white';

  return (
    <>
      {phase !== 'navigating' && (
      <div className={`pointer-events-auto flex items-center gap-2 ${className}`}>
        {!hidePill && (
        <button onClick={() => setPicking(true)} className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold shadow-md backdrop-blur ${dest ? 'bg-[#f05a22] text-white' : pill}`}>
          <Navigation2 className="h-4 w-4" /> Directions
        </button>
        )}
        {!hidePlaces && (
        <button
          onClick={() => setShowPlaces((v) => !v)}
          aria-pressed={showPlaces}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold shadow-md backdrop-blur ${showPlaces ? 'bg-[#13261c] text-white' : pill}`}
        >
          <Layers className="h-4 w-4" /> Places
        </button>
        )}
      </div>
      )}

      {guided && dest && (
        <GuidedPanels
          phase={phase}
          dest={dest}
          live={live}
          origin={origin}
          start={start}
          route={route}
          guide={guide}
          next={next}
          offRoad={offRoad}
          arrived={arrived}
          passesWater={passesWater}
          onStart={() => { if (onStart?.() === false) return; setNavigating(true); setArrived(false); }}
          onEnd={() => { setDest(null); setArrived(false); setNavigating(false); }}
        />
      )}

      {/* Route banner */}
      {dest && !guided && (
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#07120c]/[0.55] backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className={`flex max-h-[85dvh] w-full max-w-md animate-slide-up flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px] ${lxIvory}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div><div className={`${lxEyebrow} text-[#7a6830]`}>Zion Hills Golf County</div><h2 className="font-serif text-[30px] font-semibold leading-none text-[#13261c]">Where to?</h2></div>
          <button onClick={onClose} className="rounded-full p-2 text-[#6f5f2f] hover:bg-[#c9a96e]/[0.15]"><X className="h-5 w-5" /></button>
        </div>
        {!live && (
          <label className="mx-5 mb-2 flex items-center gap-2 rounded-xl bg-[#f3ecda] px-3 py-2 text-[13px] text-[#5b5a4c]">
            From
            <select value={start.id} onChange={(e) => onStart(AMENITIES.find((a) => a.id === e.target.value) ?? AMENITIES[0])} className="flex-1 bg-transparent font-semibold text-[#13261c] outline-none">
              {AMENITIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
        )}
        <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-[#c9a96e]/50 bg-white/60 px-3 py-2">
          <Search className="h-4 w-4 text-[#7a6830]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search — clubhouse, plot 622, villa 124…" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <div className="flex-1 overflow-y-auto pb-4">
          {groups.length === 0 && <div className="px-5 py-10 text-center text-sm text-gray-400">Nothing matches.</div>}
          {groups.map((g) => (
            <div key={g.title} className="mb-2">
              <div className={`px-5 pb-1 pt-2 ${lxEyebrow} text-[#7a6830]`}>{g.title}</div>
              <div className={GRID_GROUPS.includes(g.title) ? 'grid grid-cols-3 gap-1.5 px-5' : 'px-2'}>
                {g.items.map((p) =>
                  GRID_GROUPS.includes(g.title) ? (
                    <button key={p.id} onClick={() => onPick(p)} className="truncate rounded-xl bg-[#f3ecda] px-2 py-2 text-[13px] font-semibold text-[#13261c] ring-1 ring-[#c9a96e]/25 hover:bg-[#f05a22]/10 hover:text-[#d9480f]">
                      {p.label.replace('Plot ', '').replace('Villa ', '')}
                    </button>
                  ) : (
                    <button key={p.id} onClick={() => onPick(p)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#c9a96e]/[0.12]">
                      <g.icon className="h-4 w-4 shrink-0 text-[#c9a96e]" />
                      <span className="truncate font-serif text-[18px] font-semibold text-[#13261c]">{p.label}</span>
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

// ---------------------------------------------------------------------------
// Google Maps-style panels: a route preview with a Start button, then, once started,
// the next turn at the top and time / distance / Exit at the bottom.
// ---------------------------------------------------------------------------

function GuidedPanels({ phase, dest, live, origin, start, route, guide, next, offRoad, arrived, passesWater, onStart, onEnd }: {
  phase: DirectionsPhase;
  dest: Place;
  live: boolean;
  origin: MapPt | null;
  start: Place;
  route: { points: MapPt[] } | null;
  guide: { steps: { kind: TurnKind; s: number }[]; total: number } | null;
  next: { kind: TurnKind; s: number } | null;
  offRoad: boolean;
  arrived: boolean;
  passesWater: boolean;
  onStart: () => void;
  onEnd: () => void;
}) {
  const total = guide?.total ?? (route && route.points.length > 1 ? planMetres(route.points) : null);
  const mins = total != null ? Math.max(1, Math.round(total / 200)) : null;
  const water = passesWater && !!route && (
    <div className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-[#a3241c]"><Waves className="h-3.5 w-3.5 shrink-0" /> Route passes close to deep water &mdash; go slowly</div>
  );

  if (phase === 'preview') {
    return (
      <div data-dock="full" className={`pointer-events-auto fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[55] [@media(max-height:460px)]:left-24 mx-auto max-w-md [@media(max-height:460px)]:right-auto [@media(max-height:460px)]:mx-0 [@media(max-height:460px)]:w-[24rem] animate-slide-up rounded-[24px] px-3.5 pb-3.5 pt-3 sm:rounded-[26px] sm:px-4 sm:pb-4 sm:pt-3.5 ${lxIvory}`}>
        <div className="flex items-start gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[14px] ${lxOrange}`}><Navigation2 className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className={`${lxEyebrow} text-[#7a6830]`}>Your route</div>
            <div className="truncate font-serif text-[22px] font-semibold leading-tight text-[#13261c] sm:text-[24px]">{dest.label}</div>
            <div className="truncate text-[13px] text-[#5b5a4c]">
              {!route ? 'No road inside the estate to here' : total != null ? `${mins} min \u00b7 ${distanceWords(total)}` : ''}
              {route ? ` \u00b7 ${live ? 'from your location' : `from ${start.label}`}` : ''}
            </div>
            {water}
          </div>
          <button onClick={onEnd} aria-label="Close directions" className="rounded-full p-2 text-[#6f5f2f] hover:bg-[#c9a96e]/[0.15]"><X className="h-5 w-5" /></button>
        </div>
        <button
          onClick={onStart}
          disabled={!route}
          className={`mt-3.5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[15px] font-semibold uppercase tracking-[0.2em] active:scale-[0.98] disabled:opacity-50 ${lxOrange}`}
        >
          <Navigation2 className="h-5 w-5" /> Start
        </button>
        {!live && <p className="mt-1.5 hidden text-center text-[12px] text-[#6f5f2f] [@media(min-height:700px)]:block">Start uses your location to guide you turn by turn.</p>}
      </div>
    );
  }

  // Navigating
  const bad = live && offRoad;
  return (
    <>
      <div className={`pointer-events-auto fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[55] mx-auto max-w-md [@media(max-height:460px)]:right-auto [@media(max-height:460px)]:mx-0 [@media(max-height:460px)]:w-[24rem] animate-slide-up rounded-[22px] px-4 py-3 ${bad ? 'bg-gradient-to-br from-[#a3241c] to-[#7a1712] text-white ring-1 ring-[#f1d9a6]/[0.55] shadow-[0_14px_30px_-10px_rgba(122,23,18,0.7)]' : lxGlass}`}>
        {arrived ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-9 w-9 shrink-0 text-[#e3c98d]" />
            <div className="min-w-0 flex-1"><div className="font-serif text-[26px] font-semibold leading-tight">You&rsquo;ve arrived</div><div className="truncate text-[14px] text-[#f3ead3]/80">{dest.label}</div></div>
          </div>
        ) : bad ? (
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.15]"><Navigation2 className="h-7 w-7" /></div>
            <div className="min-w-0 flex-1"><div className="font-serif text-[24px] font-semibold leading-tight">You&rsquo;ve left the road</div><div className="text-[13px] text-white/[0.85]">Get back on it &mdash; the route updates from where you are.</div></div>
          </div>
        ) : !live || !origin ? (
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#c9a96e]/[0.15] text-[#e3c98d]"><Navigation2 className="h-7 w-7" /></div>
            <div className="min-w-0 flex-1"><div className="font-serif text-[22px] font-semibold leading-tight">Finding your location&hellip;</div><div className="text-[13px] text-[#f3ead3]/75">Stay in the open. Allow location if your phone asks.</div></div>
          </div>
        ) : next ? (
          <div className="flex items-center gap-3">
            <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${lxOrange}`}><TurnIcon kind={next.kind} className="h-10 w-10" /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-[34px] font-semibold leading-none">{next.s <= 25 ? 'Now' : distanceWords(next.s)}</div>
              <div className="mt-1 truncate text-[15px] font-medium leading-tight text-[#f3ead3]/90">{next.kind === 'arrive' ? `Arrive at ${dest.label}` : turnWords(next.kind)}</div>
            </div>
          </div>
        ) : null}
        {!arrived && !bad && passesWater && live && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#a3241c]/90 px-2.5 py-1 text-[12px] font-semibold ring-1 ring-[#f1d9a6]/40"><Waves className="h-3.5 w-3.5 shrink-0" /> Route passes close to deep water &mdash; go slowly</div>
        )}
      </div>

      <div data-dock="full" className={`pointer-events-auto fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[55] [@media(max-height:460px)]:left-24 mx-auto flex max-w-md [@media(max-height:460px)]:right-auto [@media(max-height:460px)]:mx-0 [@media(max-height:460px)]:w-[24rem] animate-slide-up items-center gap-3 rounded-[22px] px-4 py-2.5 sm:py-3 ${lxIvory}`}>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[30px] font-semibold leading-none text-[#13261c]">{arrived ? 'Arrived' : mins != null ? `${mins} min` : '\u2014'}</div>
          <div className="mt-0.5 truncate text-[13px] text-[#5b5a4c]">{total != null && !arrived ? `${distanceWords(total)} \u00b7 ` : ''}{dest.label}</div>
        </div>
        <button onClick={onEnd} className="rounded-full bg-gradient-to-br from-[#a3241c] to-[#7a1712] px-5 py-2.5 text-[13px] font-semibold uppercase tracking-[0.18em] text-white ring-1 ring-[#f1d9a6]/[0.55] active:scale-95">{arrived ? 'Done' : 'Exit'}</button>
      </div>
    </>
  );
}
