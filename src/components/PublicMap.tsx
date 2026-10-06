import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, LocateFixed, Share2 } from 'lucide-react';
import { MasterPlanBoard, type MapFocus, type TourMarker } from './LiveInventoryBoard';
import { DirectionsControls, type DirectionsView } from './Directions';
import { fitTransform, loadPublicCalibration, smoothFix, type Calibration, type GpsFix } from '@/lib/tour';
import { findPlace } from '@/lib/directions';
import { SAMPLE_PLOTS } from '@/lib/inventory';

// The estate map for anyone with the link — opens without a login:
//
//   #/map                 the master plan with directions between places
//   #/map?to=villa-202    the same, with directions to that place already chosen
//                         (place ids: villa-202, clubhouse, entry-main, plot-p-606 …)
//
// It draws the plot outlines in one neutral colour, like the CRM's map, but with no plot
// status, prices, leads or any CRM data. "Show my
// location" puts the visitor's own GPS dot on the plan once the team's GPS
// calibration can be read (see the public_tour_calibration SQL); without it the
// map and directions still work from a starting place the visitor picks.

const LOGO = '/zion-hills-logo.svg';
const FOLLOW_ZOOM = 2.2;

const pill = 'pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-sm font-semibold text-gray-800 shadow-md backdrop-blur transition hover:bg-white';

export default function PublicMap({ toId }: { toId?: string }) {
  const [cal, setCal] = useState<Calibration | null>(null);
  const [locating, setLocating] = useState(false);
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [dirView, setDirView] = useState<DirectionsView>({ route: null, destination: null, places: [] });
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [copied, setCopied] = useState(false);
  const centred = useRef(false);
  const initialDest = useMemo(() => (toId ? findPlace(toId) : undefined), [toId]);

  useEffect(() => {
    document.title = 'Map & directions · Zion Hills Golf County';
    void loadPublicCalibration().then(setCal);
  }, []);

  const tf = useMemo(() => fitTransform(cal), [cal]);

  // The visitor's own location, only once they ask for it.
  useEffect(() => {
    if (!locating) { setFix(null); centred.current = false; return; }
    if (!('geolocation' in navigator)) { setNote("This device can't share its location."); setLocating(false); return; }
    setNote(null);
    let last: GpsFix | null = null;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        last = smoothFix(last, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, heading: null, t: pos.timestamp });
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

  const marker: TourMarker | null = tf && fix
    ? { pt: tf.toMap(fix.lat, fix.lng), accuracyPct: fix.accuracy / tf.metresPerPct, heading: null }
    : null;
  const onPlan = !!marker && marker.pt[0] > -5 && marker.pt[0] < 105 && marker.pt[1] > -5 && marker.pt[1] < 105;
  const markerX = marker?.pt[0], markerY = marker?.pt[1];

  useEffect(() => {
    if (!locating || !fix || !tf) return;
    if (!onPlan) { setNote("You don't seem to be at Zion Hills right now — pick a starting place instead."); return; }
    setNote(null);
    if (!centred.current && markerX !== undefined && markerY !== undefined) {
      centred.current = true;
      setFocus({ pt: [markerX, markerY], zoom: FOLLOW_ZOOM, exact: true, nonce: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locating, !!fix, onPlan]);

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
          neutral
          tooltip="buyer"
          marker={onPlan ? marker : null}
          route={dirView.route}
          destination={dirView.destination}
          places={dirView.places}
          focus={focus}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-white/90 py-1.5 pl-3 pr-4 shadow-md backdrop-blur">
          <img src={LOGO} alt="Zion Hills Golf County" className="h-7 w-auto" />
          <span className="hidden text-sm font-semibold text-gray-800 sm:inline">Map &amp; directions</span>
        </div>
        <div className="flex items-center gap-2">
          {tf && (
            locating && onPlan ? (
              <>
                <button
                  onClick={() => marker && setFocus({ pt: marker.pt, zoom: FOLLOW_ZOOM, exact: true, nonce: Date.now() })}
                  className={pill}
                ><LocateFixed className="h-4 w-4 text-[#1a73e8]" /> <span className="hidden sm:inline">Find me</span></button>
                <button onClick={() => setLocating(false)} className={pill}>Stop</button>
              </>
            ) : (
              <button onClick={() => setLocating((v) => !v)} className={pill}>
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                <span className="hidden sm:inline">{locating ? 'Locating…' : 'Show my location'}</span>
              </button>
            )
          )}
          <button onClick={share} className={pill}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{copied ? 'Link copied' : 'Share'}</span>
          </button>
        </div>
      </div>

      <DirectionsControls
        className="absolute left-3 top-16 z-40 sm:left-5"
        from={from}
        toGps={tf ? (pt) => tf.toGps(pt) : null}
        initialDestination={initialDest}
        onView={setDirView}
      />

      {note && (
        <div className="pointer-events-none absolute inset-x-3 bottom-4 z-40 mx-auto max-w-md rounded-2xl bg-gray-900/90 px-4 py-2.5 text-center text-[13px] font-medium text-white shadow-lg">
          {note}
        </div>
      )}
    </div>
  );
}
