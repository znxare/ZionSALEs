import { ROAD_GRID, ROAD_PIXELS_B64 } from './roadNetwork';
import { SAMPLE_PLOTS } from './inventory';
import { centroidOf } from './plotMap';
import type { MapPt } from './tour';

// Directions on the master plan: shortest way along the estate's roads (traced
// from the plan's grey roads into centre lines — see roadNetwork.ts) between
// any two points, e.g. the cart and a plot or the clubhouse.

export interface Place {
  id: string;
  label: string;
  kind: 'amenity' | 'hole' | 'plot' | 'spot';
  pt: MapPt;
}

/** Numbered places from the master plan's legend (positions of its red markers). */
export const AMENITIES: Place[] = [
  { id: 'entry-main', label: 'Main entry gate', kind: 'amenity', pt: [47.0, 79.63] },
  { id: 'entry-west', label: 'West entry gate', kind: 'amenity', pt: [15.8, 58.46] },
  { id: 'clubhouse', label: 'Club House', kind: 'amenity', pt: [40.24, 58.38] },
  { id: 'practice', label: 'Golf practice facilities', kind: 'amenity', pt: [48.16, 46.93] },
  { id: 'sports', label: 'Sports courts', kind: 'amenity', pt: [43.83, 56.33] },
  { id: 'camp', label: 'Camp site', kind: 'amenity', pt: [38.21, 33.32] },
  { id: 'commercial', label: 'Commercial & residential', kind: 'amenity', pt: [14.89, 54.36] },
  { id: 'parking', label: 'Utility & parking', kind: 'amenity', pt: [45.08, 74.5] },
];

const HOLE_PTS: Record<number, MapPt> = {
  1: [48.44, 64.36], 2: [63.06, 84.62], 3: [75.89, 91.92], 4: [83.33, 77.71], 5: [78.67, 70.49], 6: [62.89, 73.31],
  7: [56.0, 66.41], 8: [54.28, 47.88], 9: [43.83, 45.68], 10: [42.06, 32.57], 11: [56.0, 19.07], 12: [48.17, 12.17],
  13: [46.06, 21.19], 14: [34.5, 30.69], 15: [22.06, 44.03], 16: [20.89, 56.04], 17: [25.56, 47.17], 18: [32.5, 45.45],
};
export const HOLES: Place[] = Object.entries(HOLE_PTS).map(([n, pt]) => ({ id: `hole-${n}`, label: `Hole ${n}`, kind: 'hole', pt }));

export const PLOT_PLACES: Place[] = SAMPLE_PLOTS.map((p) => ({ id: `plot-${p.id}`, label: `Plot ${p.plotNo}`, kind: 'plot', pt: centroidOf(p) }));

// ---------- road graph (built once, on first use) ----------

/**
 * Cart paths the plan's grey roads don't include, traced by hand (% of the
 * plan). Each path's first point is joined to the nearest road.
 * - Main road by the basketball courts → past the Sports courts → up the cart
 *   path → into the Golf practice range (marked on the plan by the sales team, 6 Oct 2026).
 */
const EXTRA_PATHS: MapPt[][] = [
  [
    [42.68, 57.25], [43.28, 56.72], [43.84, 56.27], [44.48, 55.14], [45.16, 54.23], [45.26, 53.61], [45.4, 52.93],
    [45.76, 52.68], [46.16, 52.42], [46.44, 52.14], [46.6, 51.69], [46.68, 51.01], [46.7, 50.33], [46.6, 49.77],
    [46.42, 49.31], [46.28, 48.75], [46.24, 48.07], [46.26, 47.39], [46.36, 46.88], [46.52, 46.6], [46.8, 46.43],
    [47.12, 46.32], [47.34, 46.66], [47.6, 47.28],
  ],
];

type Graph = { xs: Int16Array; ys: Int16Array; index: Map<number, number>; n: number };
let graph: Graph | null = null;

function getGraph(): Graph {
  if (graph) return graph;
  const bin = atob(ROAD_PIXELS_B64);
  const xs: number[] = [], ys: number[] = [];
  const index = new Map<number, number>();
  const add = (x: number, y: number) => {
    const k = y * ROAD_GRID.width + x;
    if (index.has(k)) return;
    index.set(k, xs.length); xs.push(x); ys.push(y);
  };
  for (let i = 0; i < bin.length / 4; i++) {
    add(bin.charCodeAt(i * 4) | (bin.charCodeAt(i * 4 + 1) << 8), bin.charCodeAt(i * 4 + 2) | (bin.charCodeAt(i * 4 + 3) << 8));
  }
  const roadCount = xs.length;
  // Lay each extra path into the grid as an 8-connected line of pixels.
  const line = (ax: number, ay: number, bx: number, by: number) => {
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) || 1;
    for (let s = 0; s <= steps; s++) add(Math.round(ax + ((bx - ax) * s) / steps), Math.round(ay + ((by - ay) * s) / steps));
  };
  for (const path of EXTRA_PATHS) {
    const grid = path.map((pt) => toGrid(pt).map(Math.round) as [number, number]);
    let best = 0, bd = Infinity;
    for (let i = 0; i < roadCount; i++) {
      const d = (xs[i] - grid[0][0]) ** 2 + (ys[i] - grid[0][1]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    line(xs[best], ys[best], grid[0][0], grid[0][1]);
    for (let i = 1; i < grid.length; i++) line(grid[i - 1][0], grid[i - 1][1], grid[i][0], grid[i][1]);
  }
  graph = { xs: Int16Array.from(xs), ys: Int16Array.from(ys), index, n: xs.length };
  return graph;
}

const toGrid = (pt: MapPt): [number, number] => [(pt[0] / 100) * ROAD_GRID.width - 0.5, (pt[1] / 100) * ROAD_GRID.height - 0.5];
const fromGrid = (x: number, y: number): MapPt => [((x + 0.5) / ROAD_GRID.width) * 100, ((y + 0.5) / ROAD_GRID.height) * 100];

function nearestRoad(pt: MapPt): number {
  const g = getGraph();
  const [gx, gy] = toGrid(pt);
  let best = 0, bd = Infinity;
  for (let i = 0; i < g.n; i++) {
    const d = (g.xs[i] - gx) ** 2 + (g.ys[i] - gy) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Binary heap keyed by f-score (A*). */
class Heap {
  private a: [number, number][] = [];
  push(k: number, v: number) {
    const a = this.a; a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop(): number | undefined {
    const a = this.a; if (!a.length) return undefined;
    const top = a[0][1]; const last = a.pop()!;
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

/** Douglas–Peucker, so the drawn line is smooth and light. */
function simplify(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const L = Math.hypot(bx - ax, by - ay);
  let best = 0, bi = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = L ? Math.abs((bx - ax) * (ay - py) - (by - ay) * (ax - px)) / L : Math.hypot(px - ax, py - ay);
    if (d > best) { best = d; bi = i; }
  }
  if (best <= eps) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, bi + 1), eps).slice(0, -1), ...simplify(pts.slice(bi), eps)];
}

export interface Route {
  /** The line to draw, in % of the plan: from → along the roads → to. */
  points: MapPt[];
}

/** Shortest way along the roads from one point on the plan to another. */
export function findRoute(from: MapPt, to: MapPt): Route | null {
  const g = getGraph();
  const s = nearestRoad(from), t = nearestRoad(to);
  const dist = new Float32Array(g.n).fill(Infinity);
  const prev = new Int32Array(g.n).fill(-1);
  const heap = new Heap();
  const h = (i: number) => Math.hypot(g.xs[i] - g.xs[t], g.ys[i] - g.ys[t]);
  dist[s] = 0; heap.push(h(s), s);
  const W = ROAD_GRID.width;
  for (let v = heap.pop(); v !== undefined; v = heap.pop()) {
    if (v === t) break;
    const x = g.xs[v], y = g.ys[v];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const u = g.index.get((y + dy) * W + (x + dx));
        if (u === undefined) continue;
        const nd = dist[v] + (dx && dy ? Math.SQRT2 : 1);
        if (nd < dist[u]) { dist[u] = nd; prev[u] = v; heap.push(nd + h(u), u); }
      }
    }
  }
  if (s !== t && prev[t] === -1) return null;
  const path: [number, number][] = [];
  for (let v = t; v !== -1; v = prev[v]) path.push([g.xs[v], g.ys[v]]);
  path.reverse();
  const road = simplify(path, 0.9).map(([x, y]) => fromGrid(x, y));
  return { points: [from, ...road, to] };
}

/** Length of a line on the plan in metres, using the GPS calibration. */
export function routeMetres(points: MapPt[], toGps: ((pt: MapPt) => { lat: number; lng: number }) | null): number | null {
  if (!toGps || points.length < 2) return null;
  let m = 0;
  let a = toGps(points[0]);
  for (let i = 1; i < points.length; i++) {
    const b = toGps(points[i]);
    const kx = 111320 * Math.cos((a.lat * Math.PI) / 180);
    m += Math.hypot((b.lng - a.lng) * kx, (b.lat - a.lat) * 110540);
    a = b;
  }
  return m;
}

/** "650 m · about 3 min by cart" (golf carts ~12 km/h). */
export function describeDistance(m: number | null): string | null {
  if (m == null) return null;
  const dist = m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
  const min = Math.max(1, Math.round(m / 200));
  return `${dist} · about ${min} min by cart`;
}

// ---------- distances without a login (e.g. the buyer's quote PDF) ----------

// Plan % → metres, from the 36-spot calibration ride of 5 Oct 2026 (the plan
// is ~2.37 km × 1.69 km). Good to within a few metres over a route.
const PLAN_TO_METRES = [[23.711, 0.175], [-0.006, -16.9]] as const;

export function planMetres(points: MapPt[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0], dy = points[i][1] - points[i - 1][1];
    m += Math.hypot(PLAN_TO_METRES[0][0] * dx + PLAN_TO_METRES[0][1] * dy, PLAN_TO_METRES[1][0] * dx + PLAN_TO_METRES[1][1] * dy);
  }
  return m;
}

export interface Yardage { label: string; metres: number; note?: string }

/** By-road distances from a point to the places that matter to a buyer. */
export function yardagesFrom(pt: MapPt): Yardage[] {
  const by = (to: MapPt) => { const r = findRoute(pt, to); return r ? planMetres(r.points) : Infinity; };
  const pick = (id: string) => AMENITIES.find((a) => a.id === id)!;
  const out: Yardage[] = [
    { label: 'Club House', metres: by(pick('clubhouse').pt) },
    { label: 'Golf practice', metres: by(pick('practice').pt) },
    { label: 'Sports courts', metres: by(pick('sports').pt) },
    { label: 'Main entry gate', metres: by(pick('entry-main').pt) },
  ];
  let nearest: Yardage | null = null;
  for (const h of HOLES) {
    // Straight-line first so only the few closest holes need a route.
    if (nearest && planMetres([pt, h.pt]) > nearest.metres) continue;
    const m = by(h.pt);
    if (!nearest || m < nearest.metres) nearest = { label: h.label, metres: m, note: 'nearest hole' };
  }
  if (nearest) out.splice(1, 0, nearest);
  return out.filter((y) => Number.isFinite(y.metres));
}
