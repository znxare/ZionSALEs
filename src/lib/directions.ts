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

type Graph = { xs: Int16Array; ys: Int16Array; index: Map<number, number>; n: number };
let graph: Graph | null = null;

function getGraph(): Graph {
  if (graph) return graph;
  const bin = atob(ROAD_PIXELS_B64);
  const n = bin.length / 4;
  const xs = new Int16Array(n), ys = new Int16Array(n);
  const index = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    xs[i] = bin.charCodeAt(i * 4) | (bin.charCodeAt(i * 4 + 1) << 8);
    ys[i] = bin.charCodeAt(i * 4 + 2) | (bin.charCodeAt(i * 4 + 3) << 8);
    index.set(ys[i] * ROAD_GRID.width + xs[i], i);
  }
  graph = { xs, ys, index, n };
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
