import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Navigation, Radio, Smartphone, Tablet, Crosshair, Trash2, Save, Locate, Loader2, Download, Sparkles, LocateFixed } from 'lucide-react';
import { SAMPLE_PLOTS } from '@/lib/inventory';
import { centroidOf } from '@/lib/plotMap';
import { usePermissions } from '@/lib/access';
import {
  fitTransform, loadCalibration, saveCalibration, joinTour, newPairCode, smoothFix, keepScreenOn, bearing, distanceM,
  placedPoints, type Calibration, type CalPoint, type GpsFix, type MapPt, type TourMessage,
} from '@/lib/tour';
import { MasterPlanBoard, type TourMarker, type MapFocus } from './LiveInventoryBoard';
import { WelcomeIntro } from './BuyerWelcome';
import { VideoModal, TestimonialButton } from './ShowcaseMedia';
import { loadShowcase, type Showcase, type TourStop } from '@/lib/showcase';

const FOLLOW_ZOOM = 2.5;
const SEND_EVERY_MS = 700;

const TEAM_CAL_CACHE = 'zion-tour-team-calibration';

function useCalibration() {
  // Last team calibration kept on this device, so a tour starts straight away
  // (and still works where mobile data is weak); refreshed from the server.
  const [cal, setCal] = useState<Calibration | null>(() => {
    try { return JSON.parse(localStorage.getItem(TEAM_CAL_CACHE) ?? 'null') as Calibration | null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadCalibration()
      .then((c) => {
        if (!c) return;
        setCal(c);
        try { localStorage.setItem(TEAM_CAL_CACHE, JSON.stringify(c)); } catch { /* storage unavailable */ }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { cal, setCal, loading };
}

function markerFor(fix: GpsFix | null, cal: Calibration | null): TourMarker | null {
  const tf = fitTransform(cal);
  if (!fix || !tf) return null;
  return {
    pt: tf.toMap(fix.lat, fix.lng),
    accuracyPct: fix.accuracy / tf.metresPerPct,
    // GPS headings are compass bearings; the plan isn't drawn north-up, so turn
    // them into a direction on the plan.
    heading: fix.heading == null ? null : tf.mapHeading(fix.lat, fix.lng, fix.heading),
  };
}

// ---------------------------------------------------------------------------
// Calibration kept on this phone too — never lost, even if saving fails
// ---------------------------------------------------------------------------
const LOCAL_CAL_KEY = 'zion-tour-calibration';

function loadLocalCalibration(): Calibration | null {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL_CAL_KEY) ?? 'null') as Calibration | null;
    return v && Array.isArray(v.points) && v.points.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function saveLocalCalibration(cal: Calibration) {
  try { localStorage.setItem(LOCAL_CAL_KEY, JSON.stringify(cal)); } catch { /* storage unavailable */ }
}

function downloadSpots(points: CalPoint[]) {
  const rows = [['Spot name', 'Latitude', 'Longitude', 'GPS accuracy (m)', 'GPS readings', 'Recorded at', 'Map X %', 'Map Y %', 'On plan?']];
  points.forEach((p, i) => rows.push([
    p.label ?? `Spot ${i + 1}`,
    p.lat.toFixed(7),
    p.lng.toFixed(7),
    p.accuracy != null ? p.accuracy.toFixed(1) : '',
    p.readings != null ? String(p.readings) : '',
    p.recordedAt ? new Date(p.recordedAt).toLocaleString('en-IN') : '',
    p.x != null ? p.x.toFixed(3) : '',
    p.y != null ? p.y.toFixed(3) : '',
    p.x != null ? 'Yes' : 'No — place from name',
  ]));
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `zion-tour-spots-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  const lastRaw = useRef<{ lat: number; lng: number } | null>(null);

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
        const heading = bearing(tf.toGps(a), tf.toGps(b));
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
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // Direction of travel: the phone's own heading when moving, else worked
        // out from the last few metres travelled (many phones report none).
        let heading: number | null = last.current?.heading ?? null;
        if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading) && (pos.coords.speed ?? 0) > 0.5) {
          heading = pos.coords.heading;
        } else if (lastRaw.current && distanceM(lastRaw.current, here) >= 4) {
          heading = bearing(lastRaw.current, here);
        }
        if (!lastRaw.current || distanceM(lastRaw.current, here) >= 4) lastRaw.current = here;
        const raw: GpsFix = { ...here, accuracy: pos.coords.accuracy, heading, t: pos.timestamp };
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
  const [guest, setGuest] = useState('');
  const [welcomed, setWelcomed] = useState(false);
  const { cal: savedCal, setCal, loading } = useCalibration();
  const [localCal, setLocalCal] = useState<Calibration | null>(() => loadLocalCalibration());
  // Team calibration first, else the one recorded on this phone (works even if
  // it was never saved), else — in simulation — a stand-in. The iPad gets the same.
  const usingLocal = !savedCal && !!localCal && !!fitTransform(localCal);
  const cal = savedCal ?? (usingLocal ? localCal : null) ?? (sim ? SIM_CAL : null);
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
    return (
      <Calibrate
        fix={fix}
        gpsError={error}
        cal={savedCal ?? localCal}
        onChange={(c) => { setLocalCal(c); if (fitTransform(c)) link.current?.send({ kind: 'calibration', cal: c }); }}
        onSaved={(c) => { setCal(c); link.current?.send({ kind: 'calibration', cal: c }); }}
        onClose={() => setCalibrating(false)}
      />
    );
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

      {usingLocal && (
        <div className="mx-4 mt-3 rounded-xl bg-sky-50 px-4 py-3 text-[13px] text-sky-800">
          Using the calibration recorded on this phone (not saved for the team yet) — tours work normally.
        </div>
      )}
      {!loading && !tf && (
        <div className="mx-4 mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          Not calibrated yet — the dot can't be placed on the map until you calibrate (3+ spots, 5–6 is best).
        </div>
      )}
      {error && <div className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>}

      <div className="mx-4 mt-3">
        <MasterPlanBoard plots={SAMPLE_PLOTS} onSelect={() => {}} bare marker={marker} focus={marker && follow ? { pt: marker.pt, zoom: FOLLOW_ZOOM } : null} />
      </div>

      {/* Personal welcome on the iPad */}
      <div className="mx-4 mt-3 flex gap-2">
        <input
          value={guest}
          onChange={(e) => { setGuest(e.target.value); setWelcomed(false); }}
          placeholder="Guest's name, e.g. Mr & Mrs Rao"
          className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
        />
        <button
          onClick={() => { link.current?.send({ kind: 'welcome', guest: guest.trim() }); setWelcomed(true); }}
          disabled={!ipadConnected || !guest.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#13261c] px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" /> {welcomed ? 'Shown' : 'Welcome'}
        </button>
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
function Calibrate({ fix, gpsError, cal, onChange, onSaved, onClose }: {
  fix: GpsFix | null;
  gpsError: string | null;
  cal: Calibration | null;
  onChange: (c: Calibration) => void;
  onSaved: (c: Calibration) => void;
  onClose: () => void;
}) {
  const can = usePermissions();
  const [points, setPoints] = useState<CalPoint[]>(cal?.points ?? []);
  const [picked, setPicked] = useState<MapPt | null>(null);
  const [name, setName] = useState('');
  const [placing, setPlacing] = useState<number | null>(null); // index of a spot being placed on the plan later
  const [sampling, setSampling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const samples = useRef<GpsFix[]>([]);
  const tf = useMemo(() => fitTransform({ points }), [points]);
  const [calFocus, setCalFocus] = useState<MapFocus | null>(null);
  const calMarker = markerFor(fix, { points });

  // Errors are per placed spot; look them up by the spot's position in the full list.
  const errorOf = useMemo(() => {
    const m = new Map<number, number>();
    if (!tf) return m;
    let k = 0;
    points.forEach((p, i) => { if (p.x != null && p.y != null) m.set(i, tf.errors[k++]); });
    return m;
  }, [points, tf]);
  const placedCount = placedPoints(points).length;
  const showErrors = placedCount >= 4;

  // Every change is kept on this phone straight away and used for tours, so
  // nothing recorded on site is ever lost — even if saving for the team fails.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const c = { points };
    saveLocalCalibration(c);
    onChange(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  useEffect(() => {
    if (sampling && fix) samples.current.push(fix);
  }, [fix, sampling]);

  function onMapPoint(pt: MapPt) {
    setMsg(null);
    if (placing != null) {
      setPoints((ps) => ps.map((p, i) => (i === placing ? { ...p, x: pt[0], y: pt[1] } : p)));
      setMsg({ ok: true, text: `“${points[placing]?.label ?? 'Spot'}” placed on the plan.` });
      setPlacing(null);
      return;
    }
    setPicked(pt);
  }

  // Average ~6 s of GPS readings at this spot.
  function recordHere() {
    samples.current = [];
    setSampling(true);
    setMsg(null);
    const where = picked;
    const label = name.trim();
    window.setTimeout(() => {
      setSampling(false);
      const good = samples.current.filter((f) => f.accuracy <= 20);
      if (good.length === 0) {
        setMsg({ ok: false, text: 'GPS not precise enough here yet (needs ±20 m or better). Wait a moment in the open and try again.' });
        return;
      }
      const avg = (k: 'lat' | 'lng' | 'accuracy') => good.reduce((s2, f) => s2 + f[k], 0) / good.length;
      setPoints((ps) => [...ps, {
        lat: avg('lat'),
        lng: avg('lng'),
        x: where ? where[0] : null,
        y: where ? where[1] : null,
        label: label || `Spot ${ps.length + 1}`,
        accuracy: avg('accuracy'),
        readings: good.length,
        recordedAt: new Date().toISOString(),
      }]);
      setPicked(null);
      setName('');
      setMsg({ ok: true, text: `“${label || 'Spot'}” recorded from ${good.length} GPS readings (±${Math.round(avg('accuracy'))} m)${where ? '' : ' — not placed on the plan yet; you or Claude can place it from its name'}.` });
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
      const why = e instanceof Error ? e.message : String(e);
      setMsg({ ok: false, text: `Couldn't save for the team (${why}). Your spots are still kept on this phone and work for tours — or tap Download and send the file.` });
    } finally {
      setSaving(false);
    }
  }

  const errs = [...errorOf.values()];
  const avgErr = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null;
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f7f5f2] pb-4">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2 font-display text-lg font-bold text-gray-900"><Crosshair className="h-5 w-5 text-orange-600" /> Calibrate</div>
        <button onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
      </div>
      <ol className="mx-4 list-decimal space-y-0.5 rounded-xl bg-white px-8 py-3 text-[13px] text-gray-600 card-shadow">
        <li>At each place, type its <b>name</b> (e.g. “Entry gate”).</li>
        <li>Zoom in and tap where you're standing on the plan (skip if you can't find it).</li>
        <li>Tap <b>Record this spot</b> and stay still for 6 seconds.</li>
        <li>Cover 8–12 places across the whole site, then <b>Download</b> and send the file.</li>
      </ol>

      {/* Big map for calibrating: pinch or use + / − to zoom in where you're standing. */}
      <div className="relative mx-4 mt-3 h-[58dvh] min-h-[320px] overflow-hidden rounded-2xl bg-[#d7dac7]">
        <MasterPlanBoard
          plots={SAMPLE_PLOTS}
          onSelect={() => {}}
          bare
          cover
          large
          focus={calFocus}
          onMapPoint={onMapPoint}
          pins={[
            ...points.flatMap((p, i) => (p.x != null && p.y != null
              ? [{ pt: [p.x, p.y] as MapPt, label: String(i + 1), tone: (showErrors && (errorOf.get(i) ?? 0) > 25 ? 'warn' : 'ok') as 'warn' | 'ok' }]
              : [])),
            ...(picked ? [{ pt: picked, label: '+', tone: 'new' as const }] : []),
          ]}
          marker={calMarker}
        />
        {calMarker && (
          <button
            onClick={() => setCalFocus({ pt: calMarker.pt, zoom: 5, exact: true, durationMs: 600, nonce: Date.now() })}
            className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-[13px] font-semibold text-blue-700 shadow-md"
          >
            <Locate className="h-4 w-4" /> Zoom to me
          </button>
        )}
      </div>
      {placing != null && (
        <div className="mx-4 mt-2 flex items-center justify-between rounded-xl bg-orange-50 px-4 py-2 text-[13px] font-medium text-orange-800">
          Tap the plan to place “{points[placing]?.label}”
          <button onClick={() => setPlacing(null)} className="text-orange-600 underline">Cancel</button>
        </div>
      )}

      <div className="mx-4 mt-3 flex flex-wrap items-center gap-2 text-[12px]">
        <Status ok={!!fix && fix.accuracy <= 15} label={fix ? `GPS ±${Math.round(fix.accuracy)} m` : 'Finding GPS…'} />
        {avgErr != null && showErrors && <Status ok={avgErr <= 15} label={`Drawing match ≈ ${Math.round(avgErr)} m`} />}
        <span className="text-gray-500">{points.length} spot{points.length === 1 ? '' : 's'} · {placedCount} on the plan</span>
      </div>
      {tf?.mirrored && (
        <div className="mx-4 mt-2 rounded-xl bg-red-50 px-4 py-2 text-[13px] font-medium text-red-700">
          These spots make the map come out mirror-image, so the dot would move the wrong way. One spot is probably tapped in the wrong place — check the newest one or any marked orange.
        </div>
      )}
      {gpsError && <div className="mx-4 mt-2 rounded-xl bg-red-50 px-4 py-2 text-[13px] text-red-700">{gpsError}</div>}
      {msg && <div className={`mx-4 mt-2 rounded-xl px-4 py-2 text-[13px] ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{msg.text}</div>}

      {/* Record a spot */}
      <div className="mx-4 mt-3 space-y-2 rounded-2xl bg-white p-3 card-shadow">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this spot — e.g. Entry gate, Clubhouse front, Hole 9 tee"
          className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-[14px] outline-none focus:border-orange-300"
        />
        <button
          onClick={recordHere}
          disabled={sampling}
          className="flex w-full items-center justify-center gap-2 rounded-2xl brand-gradient py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
        >
          {sampling ? <><Loader2 className="h-5 w-5 animate-spin" /> Hold still — reading GPS…</> : <><Locate className="h-5 w-5" /> Record this spot</>}
        </button>
        <p className="text-center text-[11.5px] text-gray-400">
          {picked ? 'Plan position selected ✓' : 'Tip: tap your spot on the plan first for best accuracy — or record anyway and place it later.'}
        </p>
      </div>

      {points.length > 0 && (
        <ul className="mx-4 mt-3 divide-y divide-gray-100 rounded-xl bg-white text-[13px] card-shadow">
          {points.map((p, i) => {
            const err = errorOf.get(i);
            return (
              <li key={i} className="flex items-center gap-2 px-3 py-2">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${p.x == null ? 'bg-gray-300' : showErrors && (err ?? 0) > 25 ? 'bg-amber-500' : 'bg-emerald-600'}`}>{i + 1}</span>
                <input
                  value={p.label ?? ''}
                  onChange={(e) => { const v = e.target.value; setPoints((ps) => ps.map((q, j) => (j === i ? { ...q, label: v } : q))); }}
                  className="min-w-0 flex-1 rounded-lg border border-transparent px-1.5 py-1 font-medium text-gray-800 outline-none hover:border-gray-200 focus:border-orange-300"
                  aria-label={`Name of spot ${i + 1}`}
                />
                {p.x == null ? (
                  <button onClick={() => { setPlacing(i); setMsg(null); }} className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-[11.5px] font-semibold text-orange-700">Place on plan</button>
                ) : showErrors && err != null ? (
                  <span className={`shrink-0 text-[11.5px] ${err > 25 ? 'font-semibold text-amber-600' : 'text-gray-400'}`}>off {Math.round(err)} m</span>
                ) : null}
                <button onClick={() => setPoints((ps) => ps.filter((_, j) => j !== i))} className="shrink-0 text-gray-300 hover:text-red-600" aria-label={`Remove ${p.label}`}><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => downloadSpots(points)}
          disabled={points.length === 0}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-gray-800 card-shadow disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Download spots
        </button>
        <button
          onClick={save}
          disabled={placedCount < 3 || saving || !can.isAdmin}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3.5 text-sm font-bold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save for team'}
        </button>
        <p className="col-span-2 text-center text-[11.5px] text-gray-500">
          {can.isAdmin ? 'Spots are kept on this phone as you go.' : 'Saving for the team needs the Admin login — spots are kept on this phone and work for your tours anyway.'}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// iPad: the buyer's screen
// ---------------------------------------------------------------------------
export function TourScreen({ onExit }: { onExit: () => void }) {
  const sim = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('sim') === '1';
  // 'self' = this iPad's own GPS (starts straight away, no phone needed);
  // 'pair' = follow a phone running Tour (phone), for iPads without GPS.
  const [mode, setMode] = useState<'self' | 'pair'>('self');
  const [code, setCode] = useState('');
  const [joined, setJoined] = useState<string | null>(null);
  const [remoteFix, setFix] = useState<GpsFix | null>(null);
  const [follow, setFollow] = useState(true);
  const [live, setLive] = useState(false);
  const { cal, setCal } = useCalibration();
  const [now, setNow] = useState(Date.now());
  // Heading-up (like a car sat-nav): the map turns so the road ahead is at the top.
  const [headingUp, setHeadingUp] = useState(true);
  const turn = useRef(0);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [showcase, setShowcase] = useState<Showcase>({});
  const [stop, setStop] = useState<TourStop | null>(null);
  const stopShownAt = useRef(new Map<string, number>());
  const [video, setVideo] = useState(false);

  useEffect(() => { void loadShowcase().then(setShowcase); }, []);

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  const own = useGps(mode === 'self', sim, cal);
  const fix = mode === 'self' ? own.fix : remoteFix;

  useEffect(() => {
    if (mode !== 'self') return;
    let release: (() => void) | undefined;
    void keepScreenOn().then((r) => { release = r; });
    return () => release?.();
  }, [mode]);

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
      else if (m.kind === 'welcome') setWelcome(m.guest);
    }, (isLive) => {
      setLive(isLive);
      if (isLive) sayHello(); // only once the channel is open, so replies aren't lost
    });
    const hello = window.setInterval(sayHello, 3000);
    let release: (() => void) | undefined;
    void keepScreenOn().then((r) => { release = r; });
    return () => { window.clearInterval(hello); l.leave(); release?.(); };
  }, [joined, setCal]);

  // Reaching a tour stop pops its picture up (once per 10 minutes per stop).
  useEffect(() => {
    if (!fix || !showcase.stops?.length) return;
    const near = showcase.stops.find((st) => st.image && distanceM(fix, st) <= st.radiusM);
    if (!near) return;
    const last = stopShownAt.current.get(near.id) ?? 0;
    if (Date.now() - last < 10 * 60 * 1000) return;
    stopShownAt.current.set(near.id, Date.now());
    setStop(near);
  }, [fix, showcase.stops]);
  useEffect(() => {
    if (!stop) return;
    const t = window.setTimeout(() => setStop(null), 15000);
    return () => window.clearTimeout(t);
  }, [stop]);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = ''; };
  }, []);

  if (mode === 'pair' && !joined) {
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
          <button onClick={() => setMode('self')} className="mt-3 block w-full text-sm font-medium text-gray-500">Use this iPad's own GPS instead</button>
          <button onClick={onExit} className="mt-2 text-sm font-medium text-gray-400">Cancel</button>
        </div>
      </div>
    );
  }

  const marker = markerFor(fix, cal);
  // Keep the turn "unwrapped" (e.g. 350° → 370°, not back to 10°) so passing
  // north animates the short way, and ignore tiny wobbles in the heading.
  if (marker?.heading != null) {
    const delta = ((marker.heading - turn.current) % 360 + 540) % 360 - 180;
    if (Math.abs(delta) >= 4) turn.current += delta;
  }
  const rotation = headingUp ? turn.current : 0;
  const age = fix ? Math.round((now - fix.t) / 1000) : null;
  const state = mode === 'self'
    ? (!fix ? 'Finding GPS…' : age != null && age > 15 ? `GPS signal lost · ${age}s` : 'Live')
    : (!live ? 'Connecting…' : !fix ? 'Waiting for the phone to start…' : age != null && age > 15 ? `Signal lost · last seen ${age}s ago` : 'Live');
  // A Wi-Fi-only iPad has no GPS chip; its location comes from nearby Wi-Fi and
  // is far too rough for a cart tour — say so, and offer the phone instead.
  const rough = mode === 'self' && !!fix && !sim && fix.accuracy > 35;

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
          rotation={rotation}
          // Heading-up shows more of the road ahead: cart sits below the centre.
          focus={marker && follow ? { pt: marker.pt, zoom: FOLLOW_ZOOM, offsetY: headingUp ? window.innerHeight * 0.18 : 0 } : null}
          onUserMove={() => setFollow(false)}
        />
      </div>

      {/* Compass: the needle points to north on screen. Tap to switch between
          "turn with the cart" and "north up" (matches the plan's drawn compass). */}
      <button
        onClick={() => setHeadingUp((v) => !v)}
        aria-label={headingUp ? 'Show north up' : 'Turn map with the cart'}
        className="absolute right-3 top-16 z-40 flex flex-col items-center gap-0.5 rounded-2xl bg-white/90 px-2 py-1.5 shadow-md backdrop-blur sm:right-5"
      >
        <svg viewBox="0 0 40 40" className="h-9 w-9" style={{ transform: `rotate(${-rotation}deg)`, transition: 'transform 0.8s ease-out' }}>
          <circle cx="20" cy="20" r="18" fill="white" stroke="#e5e7eb" strokeWidth="2" />
          <path d="M20 5 L25 20 L15 20 Z" fill="#dc2626" />
          <path d="M20 35 L25 20 L15 20 Z" fill="#9ca3af" />
          <text x="20" y="15.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="white">N</text>
        </svg>
        <span className="text-[10px] font-semibold text-gray-600">{headingUp ? 'Cart up' : 'North up'}</span>
      </button>

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
          The map isn't calibrated yet — calibrate from Tour (phone).
        </div>
      )}

      {mode === 'self' && (own.error || rough) && (
        <div className="absolute left-1/2 top-16 z-40 w-[min(92vw,460px)] -translate-x-1/2 rounded-2xl bg-white/95 px-4 py-3 text-center text-[13px] text-gray-700 shadow-lg">
          {own.error ?? `Location is only approximate here (±${Math.round(fix!.accuracy)} m) — this iPad may not have GPS.`}
          <button onClick={() => { setMode('pair'); setFix(null); }} className="mt-1 block w-full font-semibold text-orange-600">
            Use a phone's GPS instead
          </button>
        </div>
      )}

      {showcase.testimonial?.url && (
        <div className="absolute bottom-3 left-1/2 z-40 -translate-x-1/2">
          <TestimonialButton onClick={() => setVideo(true)} />
        </div>
      )}

      {/* Tour stop picture */}
      {stop && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/30 p-4 animate-fade-in sm:items-center" onClick={() => setStop(null)}>
          <div className="animate-scale-in w-full max-w-3xl overflow-hidden rounded-3xl bg-[#13261c] text-white shadow-2xl">
            <img src={stop.image} alt={stop.label} className="max-h-[65dvh] w-full object-cover" />
            <div className="px-6 py-4">
              <div className="text-[11px] uppercase tracking-[0.25em] text-[#e9dcc0]">You are at</div>
              <div className="font-lux text-3xl">{stop.label}</div>
              {stop.caption && <div className="mt-1 text-[15px] text-white/75">{stop.caption}</div>}
            </div>
          </div>
        </div>
      )}

      {welcome !== null && <WelcomeIntro guest={welcome} image={showcase.welcomeImage} onDone={() => setWelcome(null)} />}
      {video && showcase.testimonial?.url && <VideoModal url={showcase.testimonial.url} caption={showcase.testimonial.caption} onClose={() => setVideo(false)} />}

      {/* "My location" (like Google Maps): blue when the map is following the
          cart; tap after dragging the map to jump back to the cart. */}
      {marker && (
        <button
          onClick={() => setFollow(true)}
          aria-label={follow ? 'Following the cart' : 'Show my location'}
          className="absolute bottom-6 right-3 z-40 grid h-12 w-12 place-items-center rounded-full bg-white shadow-lg ring-1 ring-black/5 sm:right-5"
        >
          {follow ? <LocateFixed className="h-6 w-6 text-[#1a73e8]" /> : <Locate className="h-6 w-6 text-gray-600" />}
        </button>
      )}
    </div>
  );
}
