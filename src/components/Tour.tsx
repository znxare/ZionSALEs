import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Navigation, Radio, Smartphone, Tablet, Crosshair, Trash2, Save, Locate, MapPin, Loader2 } from 'lucide-react';
import { SAMPLE_PLOTS } from '@/lib/inventory';
import { centroidOf } from '@/lib/plotMap';
import { usePermissions } from '@/lib/access';
import {
  fitTransform, loadCalibration, saveCalibration, joinTour, newPairCode, smoothFix, keepScreenOn,
  type Calibration, type CalPoint, type GpsFix, type MapPt, type TourMessage,
} from '@/lib/tour';
import { MasterPlanBoard, type TourMarker } from './LiveInventoryBoard';

const FOLLOW_ZOOM = 2.5;
const SEND_EVERY_MS = 700;

function useCalibration() {
  const [cal, setCal] = useState<Calibration | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadCalibration().then(setCal).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return { cal, setCal, loading };
}

function markerFor(fix: GpsFix | null, cal: Calibration | null): TourMarker | null {
  const tf = fitTransform(cal);
  if (!fix || !tf) return null;
  return { pt: tf.toMap(fix.lat, fix.lng), accuracyPct: fix.accuracy / tf.metresPerPct, heading: fix.heading };
}

// ---------------------------------------------------------------------------
// Simulated drive (?sim=1) — lets the whole tour be tested off-site.
// Drives through plot centroids; with no calibration yet, a stand-in one is used.
// ---------------------------------------------------------------------------
const SIM_CAL: Calibration = {
  points: [
    { lat: 12.9600, lng: 77.6000, x: 10, y: 10 },
    { lat: 12.9600, lng: 77.6300, x: 90, y: 10 },
    { lat: 12.9400, lng: 77.6000, x: 10, y: 90 },
  ],
};
function simRoute(): MapPt[] {
  return SAMPLE_PLOTS.slice(0, 14).map((p) => centroidOf(p) as MapPt);
}

function useGps(active: boolean, sim: boolean, cal: Calibration | null) {
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<GpsFix | null>(null);

  useEffect(() => {
    if (!active) return;
    setError(null);
    if (sim) {
      const tf = fitTransform(cal ?? SIM_CAL) ?? fitTransform(SIM_CAL)!;
      const route = simRoute();
      let i = 0, t = 0;
      const timer = window.setInterval(() => {
        const a = route[i % route.length], b = route[(i + 1) % route.length];
        const pt: MapPt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const g = tf.toGps(pt);
        const heading = (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI;
        const next = { lat: g.lat, lng: g.lng, accuracy: 4, heading, t: Date.now() };
        last.current = next;
        setFix(next);
        t += 0.2;
        if (t >= 1) { t = 0; i++; }
      }, 600);
      return () => window.clearInterval(timer);
    }
    if (!('geolocation' in navigator)) {
      setError('This browser has no location access.');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const raw: GpsFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading != null && !Number.isNaN(pos.coords.heading) && (pos.coords.speed ?? 0) > 0.5 ? pos.coords.heading : last.current?.heading ?? null,
          t: pos.timestamp,
        };
        const next = smoothFix(last.current, raw);
        last.current = next;
        setFix(next);
      },
      (err) => setError(err.code === err.PERMISSION_DENIED
        ? 'Location is blocked. Allow location for this site in Chrome (lock icon → Permissions → Location).'
        : 'Waiting for a GPS signal… stay in the open sky.'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active, sim, cal]);

  return { fix, error };
}

// ---------------------------------------------------------------------------
// Phone: tracker + remote
// ---------------------------------------------------------------------------
export function TourRemote({ onExit }: { onExit: () => void }) {
  const sim = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('sim') === '1';
  const [code] = useState(() => sessionStorage.getItem('tour-code') ?? (() => { const c = newPairCode(); sessionStorage.setItem('tour-code', c); return c; })());
  const [sharing, setSharing] = useState(false);
  const [follow, setFollow] = useState(true);
  const [screenSeen, setScreenSeen] = useState(0);
  const [live, setLive] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const { cal: savedCal, setCal, loading } = useCalibration();
  // In simulation with no real calibration yet, use the stand-in one (and hand it to the iPad).
  const cal = savedCal ?? (sim ? SIM_CAL : null);
  const { fix, error } = useGps(sharing || calibrating, sim, cal);
  const link = useRef<ReturnType<typeof joinTour> | null>(null);
  const lastSent = useRef(0);
  const screenSeenRef = useRef(0);
  const followRef = useRef(follow);
  followRef.current = follow;

  useEffect(() => {
    const l = joinTour(code, (m) => {
      if (m.kind === 'hello' && m.role === 'screen') {
        // Only when the iPad (re)connects: hand it the calibration and the
        // follow setting. Not on every heartbeat — that would undo the buyer
        // dragging the map to look around.
        const fresh = Date.now() - screenSeenRef.current > 8000;
        screenSeenRef.current = Date.now();
        setScreenSeen(screenSeenRef.current);
        if ((fresh || m.needCal) && cal) l.send({ kind: 'calibration', cal });
        if (fresh) l.send({ kind: 'follow', on: followRef.current });
      }
    }, setLive);
    link.current = l;
    return () => l.leave();
  }, [code, cal]);

  useEffect(() => {
    if (!sharing || !fix || !link.current) return;
    if (fix.t - lastSent.current < SEND_EVERY_MS) return;
    lastSent.current = fix.t;
    link.current.send({ kind: 'fix', fix });
  }, [fix, sharing]);

  useEffect(() => {
    if (!sharing) return;
    let release: (() => void) | undefined;
    void keepScreenOn().then((r) => { release = r; });
    return () => release?.();
  }, [sharing]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 2000); return () => window.clearInterval(t); }, []);
  const ipadConnected = now - screenSeen < 8000;

  const marker = markerFor(fix, cal);
  const tf = fitTransform(cal);

  if (calibrating) {
    return <Calibrate fix={fix} gpsError={error} cal={savedCal} onSaved={(c) => { setCal(c); link.current?.send({ kind: 'calibration', cal: c }); }} onClose={() => setCalibrating(false)} />;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f7f5f2]">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2 font-display text-lg font-bold text-gray-900">
          <Smartphone className="h-5 w-5 text-orange-600" /> Tour remote {sim && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">SIMULATION</span>}
        </div>
        <button onClick={onExit} className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
      </div>

      <div className="mx-4 rounded-2xl bg-white p-4 text-center card-shadow">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-gray-400">Pair code — type this on the iPad</div>
        <div className="mt-1 font-display text-5xl font-bold tracking-[0.3em] text-gray-900">{code}</div>
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-[12px] font-medium">
          <Status ok={live} label={live ? 'Online' : 'Connecting…'} />
          <Status ok={ipadConnected} label={ipadConnected ? 'iPad connected' : 'iPad not connected'} />
          <Status ok={!!fix && fix.accuracy <= 15} label={fix ? `GPS ±${Math.round(fix.accuracy)} m` : sharing ? 'Finding GPS…' : 'GPS off'} />
        </div>
      </div>

      {!loading && !tf && (
        <div className="mx-4 mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          Not calibrated yet — the dot can't be placed on the map until you calibrate (3+ spots, 5–6 is best).
        </div>
      )}
      {error && <div className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>}

      <div className="mx-4 mt-3">
        <MasterPlanBoard plots={SAMPLE_PLOTS} onSelect={() => {}} bare marker={marker} focus={marker && follow ? { pt: marker.pt, zoom: FOLLOW_ZOOM } : null} />
      </div>

      <div className="mt-auto space-y-2 p-4">
        <button
          onClick={() => setSharing((v) => !v)}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow ${sharing ? 'bg-red-600' : 'brand-gradient'}`}
        >
          <Radio className="h-5 w-5" /> {sharing ? 'Stop sharing location' : 'Start tour — share my location'}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { const on = !follow; setFollow(on); link.current?.send({ kind: 'follow', on }); }}
            className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold ${follow ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 card-shadow'}`}
          >
            <Navigation className="h-4 w-4" /> {follow ? 'iPad follows cart' : 'Follow is off'}
          </button>
          <button onClick={() => setCalibrating(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-gray-700 card-shadow">
            <Crosshair className="h-4 w-4" /> Calibrate
          </button>
        </div>
        <p className="text-center text-[11.5px] text-gray-400">Keep this screen open during the tour — phones pause location for pages in the background.</p>
      </div>
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-gray-400'}`} /> {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Calibration — tap a spot on the plan, record the phone's averaged GPS there
// ---------------------------------------------------------------------------
function Calibrate({ fix, gpsError, cal, onSaved, onClose }: {
  fix: GpsFix | null;
  gpsError: string | null;
  cal: Calibration | null;
  onSaved: (c: Calibration) => void;
  onClose: () => void;
}) {
  const can = usePermissions();
  const [points, setPoints] = useState<CalPoint[]>(cal?.points ?? []);
  const [picked, setPicked] = useState<MapPt | null>(null);
  const [sampling, setSampling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const samples = useRef<GpsFix[]>([]);
  const tf = useMemo(() => fitTransform({ points }), [points]);

  // While sampling, collect fixes for ~6 s and average the good ones.
  useEffect(() => {
    if (sampling && fix) samples.current.push(fix);
  }, [fix, sampling]);

  function recordHere() {
    if (!picked) return;
    samples.current = [];
    setSampling(true);
    setMsg(null);
    window.setTimeout(() => {
      setSampling(false);
      const good = samples.current.filter((f) => f.accuracy <= 20);
      if (good.length === 0) {
        setMsg({ ok: false, text: 'GPS not precise enough here yet (needs ±20 m or better). Wait a moment in the open and try again.' });
        return;
      }
      const lat = good.reduce((s, f) => s + f.lat, 0) / good.length;
      const lng = good.reduce((s, f) => s + f.lng, 0) / good.length;
      setPoints((ps) => [...ps, { lat, lng, x: picked[0], y: picked[1], label: `Spot ${ps.length + 1}` }]);
      setPicked(null);
      setMsg({ ok: true, text: `Spot recorded from ${good.length} GPS readings.` });
    }, 6000);
  }

  async function save() {
    setSaving(true);
    try {
      const c = { points };
      await saveCalibration(c);
      onSaved(c);
      setMsg({ ok: true, text: 'Calibration saved for the whole team.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  }

  const avgErr = tf ? tf.errors.reduce((s, e) => s + e, 0) / tf.errors.length : null;
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f7f5f2]">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2 font-display text-lg font-bold text-gray-900"><Crosshair className="h-5 w-5 text-orange-600" /> Calibrate</div>
        <button onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
      </div>
      <ol className="mx-4 list-decimal space-y-0.5 rounded-xl bg-white px-8 py-3 text-[13px] text-gray-600 card-shadow">
        <li>Stand at a spot you can find on the plan (gate, junction, clubhouse corner).</li>
        <li>Zoom in and tap that exact spot on the plan below.</li>
        <li>Tap <b>Record this spot</b> and stay still for 6 seconds.</li>
        <li>Repeat at 5–6 spots spread across the whole site, then <b>Save</b>.</li>
      </ol>

      <div className="mx-4 mt-3">
        <MasterPlanBoard
          plots={SAMPLE_PLOTS}
          onSelect={() => {}}
          bare
          onMapPoint={(pt) => { setPicked(pt); setMsg(null); }}
          pins={[
            ...points.map((p, i) => ({ pt: [p.x, p.y] as MapPt, label: String(i + 1), tone: (tf && tf.errors[i] > 25 ? 'warn' : 'ok') as 'warn' | 'ok' })),
            ...(picked ? [{ pt: picked, label: '+', tone: 'new' as const }] : []),
          ]}
          marker={markerFor(fix, { points })}
        />
      </div>

      <div className="mx-4 mt-3 flex flex-wrap items-center gap-2 text-[12px]">
        <Status ok={!!fix && fix.accuracy <= 15} label={fix ? `GPS ±${Math.round(fix.accuracy)} m` : 'Finding GPS…'} />
        {avgErr != null && points.length >= 4 && <Status ok={avgErr <= 12} label={`Fit accuracy ≈ ${Math.round(avgErr)} m`} />}
        {points.length === 3 && <span className="text-gray-500">3 spots always fit exactly — add 2–3 more to measure real accuracy</span>}
        {points.length > 0 && points.length < 3 && <span className="text-gray-500">{3 - points.length} more spot(s) needed</span>}
      </div>
      {gpsError && <div className="mx-4 mt-2 rounded-xl bg-red-50 px-4 py-2 text-[13px] text-red-700">{gpsError}</div>}
      {msg && <div className={`mx-4 mt-2 rounded-xl px-4 py-2 text-[13px] ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{msg.text}</div>}

      {points.length > 0 && (
        <ul className="mx-4 mt-3 divide-y divide-gray-100 rounded-xl bg-white text-[13px] card-shadow">
          {points.map((p, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-2">
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-600" /> Spot {i + 1}</span>
              <span className="flex items-center gap-3">
                {tf && points.length >= 4 && <span className={tf.errors[i] > 25 ? 'font-semibold text-amber-600' : 'text-gray-500'}>off by {Math.round(tf.errors[i])} m</span>}
                <button onClick={() => setPoints((ps) => ps.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600" aria-label="Remove spot"><Trash2 className="h-4 w-4" /></button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2 p-4">
        <button
          onClick={recordHere}
          disabled={!picked || sampling}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-gray-800 card-shadow disabled:opacity-50"
        >
          {sampling ? <><Loader2 className="h-4 w-4 animate-spin" /> Hold still…</> : <><Locate className="h-4 w-4" /> Record this spot</>}
        </button>
        <button
          onClick={save}
          disabled={points.length < 3 || saving || !can.isAdmin}
          className="flex items-center justify-center gap-2 rounded-2xl brand-gradient py-3.5 text-sm font-bold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
        </button>
        {!can.isAdmin && <p className="col-span-2 text-center text-[12px] text-gray-500">Only the admin can save the calibration.</p>}
        {!picked && !sampling && <p className="col-span-2 text-center text-[12px] text-gray-400">Tap your current spot on the plan first.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// iPad: the buyer's screen
// ---------------------------------------------------------------------------
export function TourScreen({ onExit }: { onExit: () => void }) {
  const [code, setCode] = useState('');
  const [joined, setJoined] = useState<string | null>(null);
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [follow, setFollow] = useState(true);
  const [live, setLive] = useState(false);
  const { cal, setCal } = useCalibration();
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  const calRef = useRef(cal);
  calRef.current = cal;

  useEffect(() => {
    if (!joined) return;
    // Hello = "I'm listening" (and "I still need the calibration" until it arrives).
    const sayHello = () => l.send({ kind: 'hello', role: 'screen', needCal: !fitTransform(calRef.current) });
    const l = joinTour(joined, (m: TourMessage) => {
      if (m.kind === 'fix') setFix(m.fix);
      else if (m.kind === 'follow') setFollow(m.on);
      else if (m.kind === 'calibration') setCal(m.cal);
    }, (isLive) => {
      setLive(isLive);
      if (isLive) sayHello(); // only once the channel is open, so replies aren't lost
    });
    const hello = window.setInterval(sayHello, 3000);
    let release: (() => void) | undefined;
    void keepScreenOn().then((r) => { release = r; });
    return () => { window.clearInterval(hello); l.leave(); release?.(); };
  }, [joined, setCal]);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = ''; };
  }, []);

  if (!joined) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#d7dac7] p-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
          <Tablet className="mx-auto h-8 w-8 text-orange-600" />
          <h1 className="mt-2 font-display text-xl font-bold text-gray-900">Tour screen</h1>
          <p className="mt-1 text-sm text-gray-500">Type the 4-digit code shown on your phone's Tour remote.</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            autoFocus
            className="mt-4 w-full rounded-2xl border border-gray-200 py-3 text-center font-display text-4xl font-bold tracking-[0.4em] outline-none focus:border-orange-300"
          />
          <button
            onClick={() => setJoined(code)}
            disabled={code.length !== 4}
            className="mt-4 w-full rounded-2xl brand-gradient py-3.5 font-bold text-white disabled:opacity-50"
          >
            Connect
          </button>
          <button onClick={onExit} className="mt-3 text-sm font-medium text-gray-400">Cancel</button>
        </div>
      </div>
    );
  }

  const marker = markerFor(fix, cal);
  const age = fix ? Math.round((now - fix.t) / 1000) : null;
  const state = !live ? 'Connecting…' : !fix ? 'Waiting for the phone to start…' : age != null && age > 15 ? `Signal lost · last seen ${age}s ago` : 'Live';

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#d7dac7]" style={{ height: '100dvh' }}>
      <div className="absolute inset-0">
        <MasterPlanBoard
          plots={SAMPLE_PLOTS}
          onSelect={() => {}}
          large
          bare
          cover
          tooltip="buyer"
          marker={marker}
          focus={marker && follow ? { pt: marker.pt, zoom: FOLLOW_ZOOM } : null}
          onUserMove={() => setFollow(false)}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <span className={`pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold shadow-md backdrop-blur ${state === 'Live' ? 'bg-white/90 text-emerald-700' : 'bg-white/90 text-gray-600'}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${state === 'Live' ? 'animate-pulse bg-emerald-500' : 'bg-gray-400'}`} /> {state}
        </span>
        <button onClick={onExit} className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-sm font-semibold text-gray-800 shadow-md backdrop-blur hover:bg-white">
          <X className="h-4 w-4" /> Exit
        </button>
      </div>

      {fix && !marker && (
        <div className="absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-full bg-amber-50/95 px-4 py-2 text-sm font-medium text-amber-800 shadow">
          The map isn't calibrated yet — calibrate from the phone's Tour remote.
        </div>
      )}

      {marker && !follow && (
        <button
          onClick={() => setFollow(true)}
          className="absolute bottom-16 right-3 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
        >
          <Navigation className="h-4 w-4" /> Follow cart
        </button>
      )}
    </div>
  );
}
