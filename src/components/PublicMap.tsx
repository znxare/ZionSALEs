import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, LocateFixed, Share2 } from 'lucide-react';
import { MasterPlanBoard, type AdPin, type MapFocus, type TourMarker } from './LiveInventoryBoard';
import { DirectionsControls, type DirectionsPhase, type DirectionsView } from './Directions';
import { useDeviceHeading, facingBearing } from '@/lib/compass';
import { fitTransform, loadPublicCalibration, smoothFix, bearing, distanceM, HeadingTracker, MIN_HEADING_SPEED, type Calibration, type GpsFix } from '@/lib/tour';
import Compass from './Compass';
import { EmergencyButton } from './EmergencyButton';
import { MapInfoCard } from './MapInfoCard';
import { useWaterCaution, WaterCautionBanner } from './WaterCaution';
import { findPlace } from '@/lib/directions';
import { SAMPLE_PLOTS } from '@/lib/inventory';
import { centroidOf } from '@/lib/plotMap';
import { SPONSORS } from '@/lib/mapInfo';
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
const FOLLOW_ZOOM = 2.2;
const NAV_ZOOM = 2.6;

const pill = 'pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-sm font-semibold text-gray-800 shadow-md backdrop-blur transition hover:bg-white';

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
    const tracker = new HeadingTracker();
    let anchor: { lat: number; lng: number; t: number } | null = null;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
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
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) { setNote('Location is blocked — allow it for this site in your browser settings.'); setLocating(false); }
        else setNote('Waiting for a GPS signal… stay in the open.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [locating]);

  // Which way they face: the phone's compass at walking pace (works standing still), the GPS course at cart speed.
  const compass = useDeviceHeading(locating);
  const facing = fix ? facingBearing(fix.heading, compass.heading, fix.speed ?? null) : null;
  const marker: TourMarker | null = tf && fix
    ? { pt: tf.toMap(fix.lat, fix.lng), accuracyPct: fix.accuracy / tf.metresPerPct, heading: facing == null ? null : tf.mapHeading(fix.lat, fix.lng, facing) }
    : null;
  const onPlan = !!marker && marker.pt[0] > -5 && marker.pt[0] < 105 && marker.pt[1] > -5 && marker.pt[1] < 105;
  const markerX = marker?.pt[0], markerY = marker?.pt[1];
  const waterAlert = useWaterCaution(onPlan && markerX !== undefined && markerY !== undefined ? [markerX, markerY] : null);

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

  function onStartNav() {
    compass.request();
    if (!locating) setLocating(true);
    setFollow(true);
    setHeadingUp(true);
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
    <div className="fixed inset-0 overflow-hidden bg-[#d4d5c6]" style={{ height: '100dvh' }}>
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
          onUserMove={() => setFollow(false)}
          rotation={rotation}
          turnable
          waterAlert={waterAlert?.index ?? null}
          adPins={phase === 'idle' ? adPins : []}
          selectedAdId={adSel}
          onAdTap={(id) => {
            setAdSel(id);
            const pin = adPins.find((a) => a.id === id);
            if (pin) { setFollow(false); setFocus({ pt: pin.pt, zoom: 2.4, exact: true, nonce: Date.now() }); }
          }}
        />
      </div>

      {!navigating && (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-white/90 py-1.5 pl-3 pr-4 shadow-md backdrop-blur">
          <img src={LOGO} alt="Zion Hills Golf County" className="h-7 w-auto" />
          <span className="hidden text-sm font-semibold text-gray-800 sm:inline">Map &amp; directions</span>
        </div>
        <div className="flex items-center gap-2">
          <EmergencyButton
            position={fix ? { lat: fix.lat, lng: fix.lng } : null}
            onPlan={onPlan && marker ? marker.pt : null}
            locating={locating}
            onLocate={() => setLocating(true)}
            onRouteToGate={() => setExitDest(findPlace('entry-main'))}
          />
          <button onClick={share} className={pill}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{copied ? 'Link copied' : 'Share'}</span>
          </button>
        </div>
      </div>
      )}

      {/* While navigating the SOS button stays within reach, above the location button. */}
      {navigating && (
        <div className="absolute bottom-[10rem] right-3 z-40 sm:right-5">
          <EmergencyButton
            position={fix ? { lat: fix.lat, lng: fix.lng } : null}
            onPlan={onPlan && marker ? marker.pt : null}
            locating={locating}
            onLocate={() => setLocating(true)}
            onRouteToGate={() => setExitDest(findPlace('entry-main'))}
          />
        </div>
      )}

      {/* Google Maps-style location button, bottom right: tap to find me / re-centre on me. */}
      <button
        onClick={onLocateTap}
        aria-label={locating ? 'Centre the map on my location' : 'Show my location'}
        className={`pointer-events-auto absolute right-3 z-40 grid h-14 w-14 place-items-center rounded-full bg-white shadow-xl ring-1 ring-black/10 transition active:scale-95 sm:right-5 ${navigating ? 'bottom-[6.5rem]' : phase === 'preview' ? 'bottom-[11rem]' : 'bottom-6'}`}
      >
        {locating && !fix ? (
          <Loader2 className="h-6 w-6 animate-spin text-[#1a73e8]" />
        ) : (
          <LocateFixed className={`h-6 w-6 ${locating && fix && follow ? 'text-[#1a73e8]' : locating ? 'text-[#1a73e8]/70' : 'text-gray-600'}`} strokeWidth={locating && fix && follow ? 3 : 2} />
        )}
      </button>

      <WaterCautionBanner alert={waterAlert} top={navigating ? 'top-[14rem]' : undefined} />

      <Compass rotation={rotation} facing={locating ? facing : null} headingUp={headingUp} onToggle={() => setHeadingUp((v) => !v)} top={navigating ? 'top-[7.75rem]' : undefined} />

      <DirectionsControls
        key={exitDest?.id ?? 'dir'}
        className="absolute left-3 top-16 z-40 sm:left-5"
        from={from}
        toGps={tf ? (pt) => tf.toGps(pt) : null}
        initialDestination={exitDest ?? initialDest}
        onView={setDirView}
        guided
        onStart={onStartNav}
        onPhase={(p) => { setPhase(p); if (p !== 'navigating') setHeadingUp(false); }}
      />

      {phase === 'idle' && adPlot && (
        <div className="pointer-events-auto absolute bottom-4 left-3 right-[5.25rem] z-40 animate-slide-up rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-black/5 sm:left-24 sm:right-auto sm:w-[26rem]">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#f05a22]">Vacant &middot; available now</div>
              <div className="text-[17px] font-extrabold leading-tight text-gray-900">Plot {adPlot.plotNo} can be yours</div>
              <div className="text-[13px] text-gray-600">{adPlot.bedrooms} BHK villa &middot; {Math.round(adPlot.landAreaSft).toLocaleString('en-IN')} sq ft plot &middot; {Math.round(adPlot.builtUpSft).toLocaleString('en-IN')} sq ft built-up &middot; {adPlot.phase}</div>
            </div>
            <button onClick={() => setAdSel(null)} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
          </div>
          <button
            onClick={() => { const dest = findPlace(`plot-${adPlot.id}`); setAdSel(null); setExitDest(dest); }}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-[#f05a22] py-2.5 text-[14px] font-bold text-white shadow active:scale-[0.98]"
          ><Navigation2 className="h-4 w-4" /> Show me the way</button>
        </div>
      )}

      {phase === 'idle' && !adPlot && (
        <MapInfoCard
          className="absolute bottom-4 left-3 right-[5.25rem] z-40 sm:left-24 sm:right-auto sm:w-[26rem]"
          onShowPlace={(id) => setExitDest(findPlace(id))}
        />
      )}

      {note && (
        <div className={`pointer-events-none absolute inset-x-3 z-[60] mx-auto max-w-md rounded-2xl ${navigating ? 'bottom-24' : phase === 'preview' ? 'bottom-44' : 'bottom-28'}`}>
          <div className="rounded-2xl bg-gray-900/90 px-4 py-2.5 text-center text-[13px] font-medium text-white shadow-lg">{note}</div>
        </div>
      )}
    </div>
  );
}
