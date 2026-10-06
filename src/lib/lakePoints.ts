import { WATER_BODIES } from './waterBodies';

// Where the fish swim: a few points well inside each lake (traced in waterBodies.ts), with how much
// open water there is around each, so a fish's loop stays inside the lake at any zoom.

type Pt = [number, number];

export interface LakeSpot {
  lake: number;
  pt: Pt;
  /** Open water around the point, as the distance to the nearest bank in % of the plan. */
  room: number;
}

const X_SCALE = 1.4; // the plan is wider than it is tall: make a % in x and in y comparable

function inside(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function bankDistance(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0] * X_SCALE, ay = poly[j][1], bx = poly[i][0] * X_SCALE, by = poly[i][1];
    const px = p[0] * X_SCALE, py = p[1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

function pick(poly: Pt[], lake: number): LakeSpot[] {
  const xs = poly.map((q) => q[0]), ys = poly.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const cand: { pt: Pt; d: number }[] = [];
  const N = 22;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const pt: Pt = [x0 + ((x1 - x0) * i) / N, y0 + ((y1 - y0) * j) / N];
    if (inside(pt, poly)) cand.push({ pt, d: bankDistance(pt, poly) });
  }
  cand.sort((a, b) => b.d - a.d);
  if (cand.length === 0) return [];
  const best = cand[0].d;
  // Big lakes get more fish.
  const want = best > 3 ? 4 : best > 1.6 ? 3 : best > 0.8 ? 2 : 1;
  const out: LakeSpot[] = [{ lake, pt: cand[0].pt, room: best }];
  for (const c of cand) {
    if (out.length >= want) break;
    if (c.d < best * 0.45) break;
    if (out.every((o) => Math.hypot((o.pt[0] - c.pt[0]) * X_SCALE, o.pt[1] - c.pt[1]) > Math.max(2.2, best * 1.4))) out.push({ lake, pt: c.pt, room: c.d });
  }
  return out;
}

export const FISH_SPOTS: LakeSpot[] = WATER_BODIES.flatMap((poly, i) => pick(poly as Pt[], i));
