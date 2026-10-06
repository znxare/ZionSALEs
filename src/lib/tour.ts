import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Live cart tour: the salesperson's phone (GPS) sends its position to the iPad
// over a private Supabase Realtime broadcast channel, keyed by a 4-digit code.
// Nothing is stored — positions only pass between the two paired devices.

export type MapPt = [number, number]; // % of the master plan's width / height
const PLAN_W = 3369.9, PLAN_H = 2383.8; // master plan proportions (for directions on the plan)

export interface GpsFix {
  lat: number;
  lng: number;
  accuracy: number; // metres
  heading: number | null; // degrees from north, when moving
  t: number;
}

export interface CalPoint {
  lat: number;
  lng: number;
  /** Position on the plan (map %). Null = recorded on site but not placed on the plan yet. */
  x: number | null;
  y: number | null;
  /** The spot's name, e.g. "Entry gate". */
  label?: string;
  /** Average GPS accuracy (m) of the readings that made this spot, how many, and when. */
  accuracy?: number;
  readings?: number;
  recordedAt?: string;
}

/** Spots that are placed on the plan (only these can line the plan up with GPS). */
export function placedPoints(points: CalPoint[]): (CalPoint & { x: number; y: number })[] {
  return points.filter((p): p is CalPoint & { x: number; y: number } => typeof p.x === 'number' && typeof p.y === 'number');
}

export interface Calibration {
  points: CalPoint[];
}

// ---------- GPS ↔ master plan ----------

// Flat local metres around the calibration's centre: plenty accurate across a
// few kilometres, and keeps the fit well-conditioned.
function toMetres(lat: number, lng: number, lat0: number, lng0: number): [number, number] {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return [(lng - lng0) * kx, (lat - lat0) * 110540];
}

function solve3(m: number[][], v: number[]): number[] | null {
  // Gaussian elimination for a 3x3 system.
  const a = m.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    if (Math.abs(a[piv][c]) < 1e-12) return null;
    [a[c], a[piv]] = [a[piv], a[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

export interface GpsTransform {
  toMap: (lat: number, lng: number) => MapPt;
  toGps: (pt: MapPt) => { lat: number; lng: number };
  /** Roughly how many metres one % of map width spans (for drawing accuracy circles). */
  metresPerPct: number;
  /** Per calibration point: how far (m) a single overall fit lands from where it was tapped
   *  (a big number usually means a mis-tapped spot, or a part of the drawing that's distorted). */
  errors: number[];
  /** Map-direction (degrees clockwise from "up" on the plan) of a compass heading at a GPS point. */
  mapHeading: (lat: number, lng: number, compassDeg: number) => number;
  /** The spots imply a mirror-image map (east↔west) — almost always a mis-tapped spot. */
  mirrored: boolean;
}

// ---------- Delaunay triangulation (Bowyer–Watson; fine for a few dozen points) ----------

type Tri = [number, number, number];

function circumcircleContains(pts: [number, number][], t: Tri, p: [number, number]): boolean {
  const [a, b, c] = t.map((i) => pts[i]);
  const ax = a[0] - p[0], ay = a[1] - p[1];
  const bx = b[0] - p[0], by = b[1] - p[1];
  const cx = c[0] - p[0], cy = c[1] - p[1];
  const det = (ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay) + (cx * cx + cy * cy) * (ax * by - bx * ay);
  const orient = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return orient > 0 ? det > 0 : det < 0;
}

function delaunay(input: [number, number][]): Tri[] {
  const n = input.length;
  const xs = input.map((p) => p[0]), ys = input.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const d = Math.max(maxX - minX, maxY - minY) * 20 || 1;
  const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const pts: [number, number][] = [...input, [mx - d, my - d], [mx + d, my - d], [mx, my + d]];
  let tris: Tri[] = [[n, n + 1, n + 2]];
  for (let i = 0; i < n; i++) {
    const bad = tris.filter((t) => circumcircleContains(pts, t, pts[i]));
    const edges: [number, number][] = [];
    for (const t of bad) {
      for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]] as [number, number][]) {
        const shared = bad.some((o) => o !== t && o.includes(a) && o.includes(b));
        if (!shared) edges.push([a, b]);
      }
    }
    tris = tris.filter((t) => !bad.includes(t));
    for (const [a, b] of edges) tris.push([a, b, i]);
  }
  return tris.filter((t) => t.every((i) => i < n));
}

function barycentric(p: [number, number], a: [number, number], b: [number, number], c: [number, number]): [number, number, number] | null {
  const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(den) < 1e-9) return null;
  const w1 = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / den;
  const w2 = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / den;
  return [w1, w2, 1 - w1 - w2];
}

/**
 * GPS → master plan. The master plan is an illustration, not a survey, so one
 * overall fit is only right near the calibration spots. With 4+ spots the area
 * between neighbouring spots is matched separately ("rubber-sheeting" over a
 * triangulation of the spots): exact at every spot, smooth in between — like
 * pinning a stretchy sheet at each one. Outside the spots' outline (and with
 * only 3 spots) a least-squares affine fit is used.
 */
export function fitTransform(cal: Calibration | null, opts: { rubberSheet?: boolean } = {}): GpsTransform | null {
  const pts = placedPoints(cal?.points ?? []);
  if (pts.length < 3) return null;
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng0 = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  const m = pts.map((p) => toMetres(p.lat, p.lng, lat0, lng0));
  // Normal equations for [x, y] = [X, Y, 1] · coefficients
  const ata = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const atx = [0, 0, 0], aty = [0, 0, 0];
  m.forEach(([X, Y], i) => {
    const row = [X, Y, 1];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) ata[r][c] += row[r] * row[c];
      atx[r] += row[r] * pts[i].x;
      aty[r] += row[r] * pts[i].y;
    }
  });
  const cx = solve3(ata, atx), cy = solve3(ata, aty);
  if (!cx || !cy) return null; // points in a straight line — need a spread
  const toMapM = (X: number, Y: number): MapPt => [cx[0] * X + cx[1] * Y + cx[2], cy[0] * X + cy[1] * Y + cy[2]];
  const det = cx[0] * cy[1] - cx[1] * cy[0];
  if (Math.abs(det) < 1e-12) return null;
  const metresPerPct = 1 / Math.hypot(cx[0], cy[0]);
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const errors = pts.map((p, i) => {
    const [px, py] = toMapM(m[i][0], m[i][1]);
    return Math.hypot(px - p.x, py - p.y) * metresPerPct;
  });
  const tris = pts.length >= 4 && opts.rubberSheet !== false ? delaunay(m) : [];
  const toMap = (lat: number, lng: number): MapPt => {
    const P = toMetres(lat, lng, lat0, lng0);
    for (const [i, j, k] of tris) {
      const w = barycentric(P, m[i], m[j], m[k]);
      if (w && w[0] >= -1e-9 && w[1] >= -1e-9 && w[2] >= -1e-9) {
        return [w[0] * pts[i].x + w[1] * pts[j].x + w[2] * pts[k].x, w[0] * pts[i].y + w[1] * pts[j].y + w[2] * pts[k].y];
      }
    }
    return toMapM(P[0], P[1]);
  };
  return {
    toMap,
    // Map y grows downward while north grows upward, so a correct fit has a
    // negative determinant; positive means the plan came out mirrored.
    mirrored: det > 0,
    mapHeading: (lat, lng, compassDeg) => {
      // Project a point 15 m ahead along the compass heading and see where it lands on the plan.
      const r = (compassDeg * Math.PI) / 180;
      const a = toMap(lat, lng);
      const b = toMap(lat + (Math.cos(r) * 15) / 110540, lng + (Math.sin(r) * 15) / kx);
      return (Math.atan2((b[0] - a[0]) * PLAN_W, -(b[1] - a[1]) * PLAN_H) * 180) / Math.PI;
    },
    toGps: ([x, y]) => {
      const bx = x - cx[2], by = y - cy[2];
      const X = (bx * cy[1] - cx[1] * by) / det;
      const Y = (cx[0] * by - bx * cy[0]) / det;
      return { lat: lat0 + Y / 110540, lng: lng0 + X / kx };
    },
    metresPerPct,
    errors,
  };
}

// ---------- saved calibration (team-wide; admin saves) ----------

const CAL_KEY = 'tour_calibration';

export async function loadCalibration(): Promise<Calibration | null> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', CAL_KEY).maybeSingle();
  if (error || !data) return null;
  const v = data.value as Calibration | null;
  return v && Array.isArray(v.points) ? v : null;
}

/**
 * The same calibration for someone who isn't logged in (the public map). It comes
 * through a database function, so it only works once public_tour_calibration has
 * been added (see supabase/migrations); without it this is just null and the
 * public map hides "Show my location". A GET, so a viewer's write block never applies.
 */
export async function loadPublicCalibration(): Promise<Calibration | null> {
  try {
    const { data, error } = await supabase.rpc('public_tour_calibration', {}, { get: true });
    if (error || !data) return null;
    const v = data as Calibration;
    return Array.isArray(v.points) ? v : null;
  } catch {
    return null;
  }
}

export async function saveCalibration(cal: Calibration): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert({ key: CAL_KEY, value: cal, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ---------- phone ↔ iPad link ----------

export type TourMessage =
  | { kind: 'fix'; fix: GpsFix }
  | { kind: 'follow'; on: boolean }
  | { kind: 'hello'; role: 'screen' | 'remote'; needCal?: boolean }
  | { kind: 'calibration'; cal: Calibration }
  /** Show the personal welcome on the iPad. */
  | { kind: 'welcome'; guest: string };

export function newPairCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Join the private channel for a pair code; returns a sender and a cleanup. */
export function joinTour(code: string, onMessage: (m: TourMessage) => void, onStatus?: (live: boolean) => void) {
  const channel: RealtimeChannel = supabase.channel(`tour-${code}`, { config: { broadcast: { self: false } } });
  channel.on('broadcast', { event: 'm' }, ({ payload }) => onMessage(payload as TourMessage));
  channel.subscribe((status) => onStatus?.(status === 'SUBSCRIBED'));
  return {
    send: (m: TourMessage) => { void channel.send({ type: 'broadcast', event: 'm', payload: m }); },
    leave: () => { void supabase.removeChannel(channel); },
  };
}

// ---------- GPS helpers ----------

/** Compass bearing (degrees from north) from one GPS point to another. */
export function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const kx = Math.cos((a.lat * Math.PI) / 180);
  return ((Math.atan2((b.lng - a.lng) * kx, b.lat - a.lat) * 180) / Math.PI + 360) % 360;
}

/** Metres between two GPS points (short distances). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const [x, y] = toMetres(b.lat, b.lng, a.lat, a.lng);
  return Math.hypot(x, y);
}

// ---------- GPS smoothing ----------

/** Light exponential smoothing so the dot glides instead of jittering. */
export function smoothFix(prev: GpsFix | null, next: GpsFix): GpsFix {
  if (!prev || next.t - prev.t > 15000) return next;
  // Trust precise fixes more; jumpy, imprecise ones move the dot less.
  const w = Math.min(1, Math.max(0.25, 8 / Math.max(next.accuracy, 1)));
  return {
    ...next,
    lat: prev.lat + (next.lat - prev.lat) * w,
    lng: prev.lng + (next.lng - prev.lng) * w,
  };
}

/** Keep the screen on while touring (supported on Android Chrome). */
export async function keepScreenOn(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const lock = await nav.wakeLock?.request('screen');
    return () => { void lock?.release(); };
  } catch {
    return () => {};
  }
}
