import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Moon, Sun, Compass as CompassIcon, CornerUpRight, Flag, Loader2, Navigation, Share2, Search, MoreHorizontal, X as CloseIcon, Sparkles, Megaphone, UtensilsCrossed } from 'lucide-react';
import { MasterPlanBoard, type AdPin, type MapFocus, type TourMarker } from './LiveInventoryBoard';
import type { HoleReport } from './HoleByHole';
import { useMapLayers } from '@/lib/mapLayers';
import { loadPublicMenu, rememberedOrder } from '@/lib/food';
import { SITE_CONTACT } from '@/lib/emergency';
import { DirectionsControls, type DirectionsPhase, type DirectionsView } from './Directions';
import { useDeviceHeading, facingBearing } from '@/lib/compass';
import { fitTransform, loadPublicCalibration, smoothFix, bearing, distanceM, HeadingTracker, MIN_HEADING_SPEED, type Calibration, type GpsFix } from '@/lib/tour';
import Compass from './Compass';
import { EmergencyButton } from './EmergencyButton';
import { MapInfoCard } from './MapInfoCard';
import { LoadingSplash } from './LoadingSplash';
import { useNightControl } from '@/lib/night';
import { useDaylight } from '@/lib/daylight';
import { useAtmosphere } from '@/lib/mapInfo';
import { rainLevel } from '@/lib/sky';
import { WelcomeGreeting, guestFromLink } from './WelcomeGreeting';
import { useKeepAwake } from '@/lib/wake';
import { useWaterCaution, WaterCautionBanner } from './WaterCaution';
import { findPlace, planMetres } from '@/lib/directions';
import { SAMPLE_PLOTS } from '@/lib/inventory';
import { centroidOf } from '@/lib/plotMap';
import { SPONSORS } from '@/lib/mapInfo';
import { lxEyebrow, lxFab, lxGlass, lxIvory, lxOrange } from '@/lib/luxury';
import { Navigation2, X } from 'lucide-react';

// The estate map for anyone with the link — opens without a login:
//
//   #/map                 the master plan with directions between places
//   #/map?to=villa-202    the same, with directions to that place already chosen
//                         (place ids: villa-202, clubhouse, entry-main, plot-p-606 …)
//
// It draws the plots coloured by availability, exactly like the tour map, but shows no
// prices, leads or any CRM data. "Show my
// location" puts the visitor's own GPS dot on the plan once the team's GPS
// calibration can be read (see the public_tour_calibration SQL); without it the
// map and directions still work from a starting place the visitor picks.

const LOGO = '/zion-hills-logo.svg';
// Separate downloads, fetched only when the visitor switches the layer on (More → layers).
const HoleByHole = lazy(() => import('./HoleByHole'));
const RainOverlay = lazy(() => import('./RainOverlay').then((m) => ({ default: m.RainOverlay })));
const NO_HOLES: HoleReport = { pins: [], trail: null, showing: false };
const FoodOrder = lazy(() => import('./FoodOrder'));
const FOLLOW_ZOOM = 2.2;
const NAV_ZOOM = 2.6;

const menuItem = `flex items-center gap-2.5 whitespace-nowrap rounded-full py-2.5 pl-3.5 pr-4 text-[13px] font-semibold tracking-wide transition active:scale-95 ${lxFab}`;

const fab = `pointer-events-auto grid h-12 w-12 place-items-center rounded-[17px] transition active:scale-95 sm:h-14 sm:w-14 sm:rounded-[20px] ${lxFab}`;


export default function PublicMap({ toId }: { toId?: string }) {
  const [cal, setCal] = useState<Calibration | null>(null);
  const [locating, setLocating] = useState(false);
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [dirView, setDirView] = useState<DirectionsView>({ route: null, destination: null, places: [] });
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [copied, setCopied] = useState(false);
  // Heading-up like the tour: the map turns so the way you are walking is at the top.
  // North-up while just looking around; heading-up once navigation starts (like Google Maps).
  const [headingUp, setHeadingUp] = useState(false);
  // The camera follows the visitor's dot (until they drag the map); the location button re-centres it.
  const [follow, setFollow] = useState(false);
  // Adverts drawn on the map: a few vacant plots as "can be yours" flags (more appear as dots once zoomed in).
  const [adSel, setAdSel] = useState<string | null>(null);
  const [pickerSignal, setPickerSignal] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  useKeepAwake(); // the screen stays on while the map is open
  const [ready, setReady] = useState(false);
  // The hole layer: numbered badges; tap one for its card. When the visitor is on a hole, only that hole shows.
  const { layers, set: setLayer } = useMapLayers();
  const holesOn = layers.holes;
  const env = layers.environment;
  const [holeSel, setHoleSel] = useState<number | null>(null);
  const [holeReport, setHoleReport] = useState<HoleReport>(NO_HOLES);
  const [holeFrame, setHoleFrame] = useState(0);
  const { level: night, isNight, toggle: toggleNight } = useNightControl();
  const daylight = useDaylight(night);
  const atmosphere = useAtmosphere();
  const rain = rainLevel(atmosphere?.code);
  const [greet, setGreet] = useState<{ eyebrow: string; title: string } | null>(null);
  const arrivedShown = useRef(false);
  // Height of whichever full-width panel (route preview / navigation bar) is sitting at the bottom, so the buttons stand just above it.
  const [dock, setDock] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      // only panels that reach under the right-hand button column count
      const h = Math.max(0, ...[...document.querySelectorAll('[data-dock="full"]')].filter((el) => el.getBoundingClientRect().right > window.innerWidth - 84).map((el) => window.innerHeight - el.getBoundingClientRect().top));
      setDock((d) => (Math.abs(d - h) > 2 ? h : d));
    }, 200);
    return () => window.clearInterval(id);
  }, []);
  const adPins = useMemo<AdPin[]>(() => {
    const open = SAMPLE_PLOTS.filter((p) => p.status === 'Available').sort(() => Math.random() - 0.5);
    const spots = open.map((p) => ({ p, pt: centroidOf(p) as [number, number] }));
    // Featured: a handful spread across the estate, so the flags never crowd each other.
    const featured: typeof spots = [];
    for (const c of spots) {
      if (featured.length >= 5) break;
      if (featured.every((f) => Math.hypot((f.pt[0] - c.pt[0]) * 1.4, f.pt[1] - c.pt[1]) > 11)) featured.push(c);
    }
    const ids = new Set(featured.map((f) => f.p.id));
    const pins: AdPin[] = spots.map(({ p, pt }) => ({ id: p.id, pt, kind: 'plot', featured: ids.has(p.id), label: `Plot ${p.plotNo} · can be yours`, sub: `${p.bedrooms} BHK villa · vacant` }));
    SPONSORS.forEach((s, n) => { if (s.pt) pins.push({ id: `sponsor-${n}`, pt: s.pt, kind: 'sponsor', featured: true, label: s.name, sub: s.tagline }); });
    return pins;
  }, []);
  const adPlot = adSel ? SAMPLE_PLOTS.find((p) => p.id === adSel) ?? null : null;
  const [phase, setPhase] = useState<DirectionsPhase>('idle');
  const turn = useRef(0);
  const initialDest = useMemo(() => (toId ? findPlace(toId) : undefined), [toId]);
  // The Emergency sheet's "way out" picks the destination (remounts the directions control with it chosen).
  const [exitDest, setExitDest] = useState<ReturnType<typeof findPlace>>(undefined);
  // Food from the clubhouse kitchen: the button shows while the kitchen is taking orders.
  const [kitchenOpen, setKitchenOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [foodOrderId, setFoodOrderId] = useState<string | null>(() => rememberedOrder());
  useEffect(() => { void loadPublicMenu().then((m) => setKitchenOpen(m.open && m.items.some((i) => i.available))); }, []);

  useEffect(() => {
    document.title = 'Map & directions · Zion Hills Golf County';
    void loadPublicCalibration().then(setCal);
  }, []);

  const tf = useMemo(() => fitTransform(cal), [cal]);

  // The visitor's own location, only once they ask for it.
  useEffect(() => {
    if (!locating) { setFix(null); return; }
    if (!('geolocation' in navigator)) { setNote("This device can't share its location."); setLocating(false); return; }
    setNote(null);
    let last: GpsFix | null = null;
    let lastAt = 0;
    const tracker = new HeadingTracker();
    let anchor: { lat: number; lng: number; t: number } | null = null;
    const onPos = (pos: GeolocationPosition) => {
        lastAt = Date.now();
        // Same heading logic as the tour: the phone's course when really moving, else the
        // bearing from a point well behind; held steady when slow or stopped.
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const accuracy = pos.coords.accuracy;
        let speed = pos.coords.speed != null && !Number.isNaN(pos.coords.speed) ? pos.coords.speed : null;
        let course: number | null = null;
        const gap = anchor ? distanceM(anchor, here) : 0;
        const farEnough = gap >= Math.max(15, accuracy * 1.5);
        if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading) && (speed ?? 0) >= MIN_HEADING_SPEED) {
          course = pos.coords.heading;
        } else if (anchor && farEnough) {
          course = bearing(anchor, here);
          speed = speed ?? gap / Math.max(1, (pos.timestamp - anchor.t) / 1000);
        }
        if (!anchor || farEnough) anchor = { ...here, t: pos.timestamp };
        const heading = tracker.update(course, speed ?? 0, accuracy);
        last = smoothFix(last, { ...here, accuracy, heading, speed, t: pos.timestamp });
        setFix(last);
    };
    const onErr = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) { setNote('Location is blocked — allow it for this site in your browser settings.'); setLocating(false); }
      else setNote('Waiting for a GPS signal… stay in the open.');
    };
    // Fresh positions only (no cached ones), and at least once a second: phones often go quiet when
    // the position barely changes, so if a second passes without one, ask for it directly.
    const id = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    const tick = window.setInterval(() => {
      if (Date.now() - lastAt < 1000) return;
      navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 4000 });
    }, 1000);
    return () => { navigator.geolocation.clearWatch(id); window.clearInterval(tick); };
  }, [locating]);

  // If the visitor has already allowed location on this site, show it straight away (no tap, no prompt).
  useEffect(() => {
    if (!tf || locating) return;
    const perms = (navigator as Navigator & { permissions?: { query: (d: { name: 'geolocation' }) => Promise<{ state: string }> } }).permissions;
    void perms?.query({ name: 'geolocation' }).then((r) => { if (r.state === 'granted') { setLocating(true); setFollow(true); } }).catch(() => {});
  }, [tf]); // eslint-disable-line react-hooks/exhaustive-deps

  // After the visitor drags the map away, it glides back to their dot by itself after a few quiet seconds.
  const [moved, setMoved] = useState(0);

  // Which way they face: the phone's compass at walking pace (works standing still), the GPS course at cart speed.
  const compass = useDeviceHeading(locating);
  const facing = fix ? facingBearing(fix.heading, compass.heading, fix.speed ?? null) : null;
  const marker: TourMarker | null = tf && fix
    ? { pt: tf.toMap(fix.lat, fix.lng), accuracyPct: fix.accuracy / tf.metresPerPct, heading: facing == null ? null : tf.mapHeading(fix.lat, fix.lng, facing) }
    : null;
  const onPlan = !!marker && marker.pt[0] > -5 && marker.pt[0] < 105 && marker.pt[1] > -5 && marker.pt[1] < 105;
  const markerX = marker?.pt[0], markerY = marker?.pt[1];
  const waterAlert = useWaterCaution(onPlan && markerX !== undefined && markerY !== undefined ? [markerX, markerY] : null, fix?.accuracy ?? null);

  // Keep the turn "unwrapped" (350° → 370°, not back to 10°) so passing north animates the short way.
  if (marker?.heading != null) {
    const delta = ((marker.heading - turn.current) % 360 + 540) % 360 - 180;
    if (Math.abs(delta) >= 0.3) turn.current += delta;
  }
  const rotation = headingUp && onPlan ? turn.current : 0;

  useEffect(() => {
    if (!locating || !fix || !tf) return;
    if (!onPlan) { setNote("You don't seem to be at Zion Hills right now — pick a starting place instead."); return; }
    setNote(null);
  }, [locating, !!fix, onPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigating = phase === 'navigating';



  function openHole(n: number) { setLayer('holes', true); setAdSel(null); setHoleSel(n); setHoleFrame((k) => k + 1); }

  // After the visitor drags the map away, it glides back to their dot by itself after 8 quiet seconds
  // (not while a route is being previewed).
  useEffect(() => {
    if (!locating || follow || !onPlan || phase === 'preview') return;
    const t = window.setTimeout(() => setFollow(true), 8000);
    return () => window.clearTimeout(t);
  }, [moved, locating, follow, onPlan, phase]);

  // Choosing a place shows the whole route first (like Google Maps' preview).
  const destX = dirView.destination?.pt[0], destY = dirView.destination?.pt[1];
  useEffect(() => {
    if (phase !== 'preview' || !dirView.route || dirView.route.length < 2) return;
    const xs = dirView.route.map((q) => q[0]), ys = dirView.route.map((q) => q[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const zoom = Math.min(3, Math.max(1.2, 0.7 * Math.min(100 / Math.max(w, 4), 100 / Math.max(h, 4))));
    setFollow(false);
    setFocus({ pt: [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2 + 4], zoom, exact: true, nonce: Date.now() });
  }, [phase, destX, destY]); // eslint-disable-line react-hooks/exhaustive-deps

  // The opening: a greeting for the time of day, and the map gliding in to the main gate (once per visit).
  useEffect(() => {
    if (toId) return; // a shared destination goes straight to its route
    try { if (sessionStorage.getItem('zion-welcomed')) return; sessionStorage.setItem('zion-welcomed', '1'); } catch { /* no storage */ }
    const guest = guestFromLink();
    // an ordinary visit gets the logo opening and nothing more; a named guest gets the pennant
    if (guest) setGreet({ eyebrow: 'Zion Hills Golf County', title: `Welcome, ${guest}` });
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const gate = findPlace('entry-main');
    const t = window.setTimeout(() => { if (gate) setFocus({ pt: gate.pt, zoom: 2.1, exact: true, durationMs: 3200, nonce: Date.now() }); }, 900);
    return () => window.clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Arriving at the gate in person gets its own welcome.
  useEffect(() => {
    if (arrivedShown.current || !onPlan || markerX === undefined || markerY === undefined) return;
    const gate = findPlace('entry-main');
    if (gate && planMetres([[markerX, markerY], gate.pt]) < 70) {
      arrivedShown.current = true;
      setGreet({ eyebrow: 'You have arrived', title: 'Welcome to Zion Hills' });
    }
  }, [markerX, markerY, onPlan]);

  // Full screen by default on touch devices: browsers only allow it from a tap, so the first touch asks for it.
  useEffect(() => {
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (!window.matchMedia?.('(pointer: coarse)').matches || document.fullscreenElement) return;
    const ask = () => {
      try { void (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen?.()); } catch { /* not allowed here */ }
      window.removeEventListener('pointerup', ask);
    };
    window.addEventListener('pointerup', ask, { once: true });
    return () => window.removeEventListener('pointerup', ask);
  }, []);

  // Messages fade away on their own.
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 7000);
    return () => window.clearTimeout(t);
  }, [note]);

  function onStartNav(): boolean {
    if (!tf) { setNote("Turn-by-turn isn't switched on for this map yet."); return false; }
    compass.request();
    if (!locating) setLocating(true);
    setFollow(true);
    setHeadingUp(true);
    return true;
  }

  function onLocateTap() {
    compass.request();
    if (!tf) { setNote("Live location isn't switched on for this map yet."); return; }
    if (!locating) { setLocating(true); setFollow(true); return; }
    setFollow(true); // already locating: bring the camera back to the dot
  }

  const followFocus: MapFocus | null = follow && onPlan && marker
    ? { pt: marker.pt, zoom: navigating ? NAV_ZOOM : FOLLOW_ZOOM, follow: true, offsetY: navigating && headingUp ? window.innerHeight * 0.18 : 0 }
    : null;

  async function share() {
    const url = `${window.location.origin}/#/map`;
    const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
    try {
      if (nav.share) { await nav.share({ title: 'Zion Hills Golf County — map & directions', url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* cancelled, or clipboard unavailable */ }
  }

  // Directions from where the visitor is (once they have a fix on the plan), else from a place they pick.
  const from = locating ? (marker ? (onPlan ? marker.pt : undefined) : null) : undefined;

  return (
    <div className={`fixed inset-0 overflow-hidden ${night > 0.5 ? 'bg-[#0b1426]' : 'bg-[#d4d5c6]'}`} style={{ height: '100dvh' }}>
      <div className="absolute inset-0">
        <MasterPlanBoard
          plots={SAMPLE_PLOTS}
          onSelect={() => {}}
          large
          bare
          cover
          publicView
          tooltip="buyer"
          marker={onPlan ? marker : null}
          route={dirView.route}
          destination={dirView.destination}
          places={dirView.places}
          focus={followFocus ?? focus}
          onUserMove={() => { setFollow(false); setMoved((k) => k + 1); }}
          rotation={rotation}
          turnable
          waterAlert={waterAlert?.index ?? null}
          wildlife={env && phase === 'idle'}
          night={night}
          daylight={env ? daylight : null}
          scenery={env}
          sponsors={layers.sponsors}
          onReady={() => setReady(true)}
          atmosphere={atmosphere}
          rain={env ? rain : 0}
          ambient={env && phase === 'idle'}
          adPins={phase === 'idle' ? adPins.filter((a) => a.kind !== 'sponsor' || layers.sponsors) : []}
          holePins={holesOn ? holeReport.pins : []}
          holeTrail={holesOn ? holeReport.trail : null}
          onHoleTap={openHole}
          selectedAdId={adSel}
          onAdTap={(id) => {
            setAdSel(id);
            const pin = adPins.find((a) => a.id === id);
            if (pin) { setFollow(false); setFocus({ pt: pin.pt, zoom: 2.4, exact: true, nonce: Date.now() }); }
          }}
        />
      </div>

      {!navigating && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-30 h-36"
          style={{ background: night > 0.5 ? 'linear-gradient(to bottom, rgba(8,19,41,0.72), rgba(8,19,41,0))' : 'linear-gradient(to bottom, rgba(251,247,238,0.86), rgba(251,247,238,0.5) 45%, rgba(251,247,238,0))', transition: 'background 1s ease' }}
        />
      )}

      {phase === 'idle' && (
        <button
          onClick={() => setPickerSignal((n) => n + 1)}
          aria-label="Directions"
          className={`pointer-events-auto absolute left-3 top-[3.9rem] z-40 flex items-center gap-2 rounded-full py-2 pl-3.5 pr-4 text-left transition active:scale-[0.98] sm:left-5 sm:top-[4.4rem] ${lxIvory}`}
          style={{ width: 'min(58vw, 15rem)' }}
        >
          <Search className="h-4 w-4 shrink-0 text-[#8a6a4a]" strokeWidth={2} />
          <span className="text-[15px] font-medium text-[#6b665c]">Where to?</span>
        </button>
      )}

      {!navigating && (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <div className="pointer-events-auto flex items-center gap-2.5 py-1 pl-1 pr-3">
          <img id="map-logo" src={LOGO} alt="Zion Hills Golf County" className="h-9 w-auto drop-shadow-[0_0_5px_rgba(255,252,240,0.95)] sm:h-10" />
          <span className="hidden text-[15px] font-bold tracking-tight text-[#26231f] [text-shadow:0_0_6px_rgba(255,252,240,0.95),0_0_2px_rgba(255,252,240,0.9)] sm:inline">The Estate Map</span>
        </div>
        <div className="flex items-center gap-2">
          <EmergencyButton
            position={fix ? { lat: fix.lat, lng: fix.lng } : null}
            onPlan={onPlan && marker ? marker.pt : null}
            locating={locating}
            onLocate={() => setLocating(true)}
            onRouteToGate={() => setExitDest(findPlace('entry-main'))}
          />
        </div>
      </div>
      )}

      {/* Bottom right: two buttons only. "More" holds hole-by-hole, share and the day / night switch. */}
      {menuOpen && <div className="absolute inset-0 z-[39]" onClick={() => setMenuOpen(false)} />}
      <div className="pointer-events-none absolute right-3 z-40 flex flex-col items-end gap-2.5 sm:right-5 sm:gap-3" style={{ bottom: dock > 0 ? dock + 12 : 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        {navigating && (
          <div className="self-end">
            <EmergencyButton
              position={fix ? { lat: fix.lat, lng: fix.lng } : null}
              onPlan={onPlan && marker ? marker.pt : null}
              locating={locating}
              onLocate={() => setLocating(true)}
              onRouteToGate={() => setExitDest(findPlace('entry-main'))}
            />
          </div>
        )}
        {phase === 'idle' && kitchenOpen && (
          <button onClick={() => { setMenuOpen(false); setFoodOpen(true); }} aria-label="Order food" className={fab}>
            <UtensilsCrossed className="h-6 w-6 text-[#d9480f]" strokeWidth={1.8} />
          </button>
        )}
        {phase === 'idle' && (
          <div className="relative">
            {menuOpen && (
              <div className="pointer-events-auto absolute bottom-full right-0 mb-2.5 flex flex-col items-end gap-2" style={{ animation: 'zh-bubble .2s ease-out both' }}>
                <button onClick={() => { setLayer('environment', !env); setMenuOpen(false); }} aria-label="Environment effects" aria-pressed={env} className={`${menuItem} ${env ? '!text-[#f26a35]' : ''}`}>
                  <Sparkles className="h-4 w-4" strokeWidth={1.8} /> Environment effects {env && <Check className="h-4 w-4" />}
                </button>
                <button onClick={() => { setLayer('sponsors', !layers.sponsors); setMenuOpen(false); }} aria-label="Sponsor signs" aria-pressed={layers.sponsors} className={`${menuItem} ${layers.sponsors ? '!text-[#f26a35]' : ''}`}>
                  <Megaphone className="h-4 w-4" strokeWidth={1.8} /> Sponsor signs {layers.sponsors && <Check className="h-4 w-4" />}
                </button>
                <button onClick={() => { setLayer('holes', !holesOn); setHoleSel(null); setMenuOpen(false); }} aria-label="Hole by hole" aria-pressed={holesOn} className={`${menuItem} ${holesOn ? '!text-[#f26a35]' : ''}`}>
                  <Flag className="h-4 w-4" strokeWidth={1.8} /> Hole by hole {holesOn && <Check className="h-4 w-4" />}
                </button>
                <button onClick={() => { void share(); setMenuOpen(false); }} aria-label="Share this map" className={menuItem}>
                  <Share2 className="h-4 w-4" strokeWidth={1.8} /> Share this map
                </button>
                <button onClick={() => { toggleNight(); setMenuOpen(false); }} aria-label={isNight ? 'Switch to day view' : 'Switch to night view'} className={menuItem}>
                  {isNight ? <Sun className="h-4 w-4" strokeWidth={1.8} /> : <Moon className="h-4 w-4" strokeWidth={1.8} />} {isNight ? 'Day view' : 'Night view'}
                </button>
              </div>
            )}
            <button onClick={() => setMenuOpen((v) => !v)} aria-label="More" aria-expanded={menuOpen} className={fab}>
              {menuOpen ? <CloseIcon className="h-6 w-6" strokeWidth={1.8} /> : <MoreHorizontal className="h-6 w-6" strokeWidth={1.8} />}
            </button>
          </div>
        )}
        <button onClick={onLocateTap} aria-label={locating ? 'Centre the map on my location' : 'Show my location'} className={fab}>
          {locating && !fix ? (
            <Loader2 className="h-6 w-6 animate-spin text-[#f26a35]" />
          ) : locating && fix && follow ? (
            <Navigation className="h-6 w-6 fill-[#f26a35] text-[#f26a35]" />
          ) : (
            <CompassIcon className={`h-6 w-6 sm:h-7 sm:w-7 ${locating ? 'text-[#f05a22]' : ''}`} strokeWidth={1.8} />
          )}
        </button>
      </div>

      <WaterCautionBanner alert={waterAlert} top={navigating ? 'top-[10rem]' : undefined} />

      <Compass rotation={rotation} facing={locating ? facing : null} weak={locating && compass.weak} headingUp={headingUp} onToggle={() => setHeadingUp((v) => !v)} top={navigating ? 'top-[9.6rem]' : undefined} />

      <DirectionsControls
        key={exitDest?.id ?? 'dir'}
        className="absolute left-3 top-16 z-40 sm:left-5"
        from={from}
        toGps={tf ? (pt) => tf.toGps(pt) : null}
        initialDestination={exitDest ?? initialDest}
        onView={setDirView}
        guided
        hidePill
        hidePlaces
        openSignal={pickerSignal}
        onStart={onStartNav}
        onPhase={(p) => { setPhase(p); if (p !== 'navigating') setHeadingUp(false); }}
      />



      {holesOn && (
        <Suspense fallback={null}>
          <HoleByHole
            markerPt={onPlan && markerX !== undefined && markerY !== undefined ? [markerX, markerY] : null}
            idle={phase === 'idle'}
            holeSel={holeSel}
            onSelect={openHole}
            onClose={() => setHoleSel(null)}
            onReport={setHoleReport}
            onFocus={(f) => { setFollow(false); setFocus(f); }}
            onTeeOff={(n) => { const dest = findPlace(`tee-${n}`); setHoleSel(null); setExitDest(dest); }}
            frameSignal={holeFrame}
          />
        </Suspense>
      )}

      {phase === 'idle' && !(holesOn && holeReport.showing) && adPlot && (
        <div data-dock="left" className={`pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 right-[4.5rem] z-40 animate-slide-up rounded-[22px] p-3 sm:left-24 sm:p-3.5 sm:right-auto sm:w-[26rem] ${lxIvory}`}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className={`${lxEyebrow} text-[#d9480f]`}>Vacant &middot; available now</div>
              <div className="font-serif text-[26px] font-semibold leading-tight text-[#26231f]">Plot {adPlot.plotNo} can be yours</div>
              <div className="text-[13px] leading-snug text-[#5b5a4c]">{adPlot.bedrooms} BHK villa &middot; {Math.round(adPlot.landAreaSft).toLocaleString('en-IN')} sq ft plot &middot; {Math.round(adPlot.builtUpSft).toLocaleString('en-IN')} sq ft built-up &middot; {adPlot.phase}</div>
            </div>
            <button onClick={() => setAdSel(null)} aria-label="Close" className="rounded-full p-1.5 text-[#8a6a4a] hover:bg-[#e3d8c2]/[0.15]"><X className="h-4 w-4" /></button>
          </div>
          <button
            onClick={() => { const dest = findPlace(`plot-${adPlot.id}`); setAdSel(null); setExitDest(dest); }}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-semibold uppercase tracking-[0.18em] active:scale-[0.98] ${lxOrange}`}
          ><Navigation2 className="h-4 w-4" /> Show me the way</button>
        </div>
      )}

      {phase === 'idle' && !adPlot && !(holesOn && holeReport.showing) && (
        <MapInfoCard
          className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 right-[4.5rem] z-40 sm:left-24 sm:right-auto sm:w-[26rem]"
          onShowPlace={(id) => setExitDest(findPlace(id))}
        />
      )}

      {env && rain > 0.02 && <Suspense fallback={null}><RainOverlay level={rain} /></Suspense>}
      {(foodOpen || foodOrderId) && (
        <Suspense fallback={null}>
          <FoodOrder
            open={foodOpen}
            onClose={() => setFoodOpen(false)}
            orderId={foodOrderId}
            onOrderId={setFoodOrderId}
            here={onPlan && marker && fix ? { lat: fix.lat, lng: fix.lng, x: marker.pt[0], y: marker.pt[1] } : null}
            locating={locating}
            onLocate={onLocateTap}
            sitePhone={SITE_CONTACT?.phone}
          />
        </Suspense>
      )}

      <LoadingSplash done={ready} />

      {greet && <WelcomeGreeting eyebrow={greet.eyebrow} title={greet.title} onDone={() => setGreet(null)} />}

      {note && (
        <div className={`pointer-events-none absolute left-3 right-[5.6rem] z-[60] rounded-2xl sm:left-5 sm:right-auto sm:max-w-sm ${navigating ? 'top-[9.5rem]' : 'top-[6.7rem] sm:top-[7.3rem]'}`}>
          <div className={`rounded-2xl px-4 py-2.5 text-center text-[13px] font-medium ${lxGlass}`}>{note}</div>
        </div>
      )}
    </div>
  );
}
