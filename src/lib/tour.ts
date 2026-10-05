import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Live cart tour: the salesperson's phone (GPS) sends its position to the iPad
// over a private Supabase Realtime broadcast channel, keyed by a 4-digit code.
// Nothing is stored — positions only pass between the two paired devices.

export type MapPt = [number, number]; // % of the master plan's width / height

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
  x: number; // map %
  y: number;
  label?: string;
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
  /** Per calibration point: how far (m) the fit lands from where it was tapped. */
  errors: number[];
}

/**
 * Best-fit (least-squares affine) mapping from GPS to the master plan, from 3+
 * calibration points. Affine absorbs the drawing's scale, rotation and skew;
 * the per-point errors show how well the illustration matches the ground.
 */
export function fitTransform(cal: Calibration | null): GpsTransform | null {
  const pts = cal?.points ?? [];
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
  return {
    toMap: (lat, lng) => { const [X, Y] = toMetres(lat, lng, lat0, lng0); return toMapM(X, Y); },
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

export async function saveCalibration(cal: Calibration): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert({ key: CAL_KEY, value: cal, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ---------- phone ↔ iPad link ----------

export type TourMessage =
  | { kind: 'fix'; fix: GpsFix }
  | { kind: 'follow'; on: boolean }
  | { kind: 'hello'; role: 'screen' | 'remote'; needCal?: boolean }
  | { kind: 'calibration'; cal: Calibration };

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
