import { useRef } from 'react';
import { HOLES, PLAN_TO_METRES } from './directions';
import { HOLE_GUIDE, type HoleGuide } from './holes';

// Which hole a position is on, and how far it is to that hole's green.

type MapPt = [number, number];

const ENTER_M = 45;  // within this of a hole's line: you are on that hole
const LEAVE_M = 80;  // ...and you stay "on" it until you are this far away

const toM = ([x, y]: MapPt): MapPt => [PLAN_TO_METRES[0][0] * x + PLAN_TO_METRES[0][1] * y, -(PLAN_TO_METRES[1][0] * x + PLAN_TO_METRES[1][1] * y)];

/** The mid-point of each hole (the number printed on the plan), so the line follows the fairway a little. */
export const holeMid = (n: number): MapPt => HOLES.find((h) => h.id === `hole-${n}`)?.pt ?? HOLE_GUIDE.find((h) => h.n === n)!.green;

function segDist(p: MapPt, a: MapPt, b: MapPt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Metres from a point on the plan to a hole's line (tee, middle, green). */
export function metresFromHole(pt: MapPt, h: HoleGuide): number {
  const p = toM(pt), t = toM(h.tee), m = toM(holeMid(h.n)), g = toM(h.green);
  return Math.min(segDist(p, t, m), segDist(p, m, g));
}

/** Yards from a point on the plan to the middle of a hole's green. */
export function yardsToGreen(pt: MapPt, h: HoleGuide): number {
  const p = toM(pt), g = toM(h.green);
  return Math.hypot(p[0] - g[0], p[1] - g[1]) / 0.9144;
}

/** The hole this position is on (null when not near any), steadied so it doesn't flicker at the edge. */
export function useNearHole(pt: MapPt | null): { hole: HoleGuide; yards: number } | null {
  const current = useRef<number | null>(null);
  if (!pt) { current.current = null; return null; }
  const dist = (h: HoleGuide) => metresFromHole(pt, h);
  if (current.current != null) {
    const h = HOLE_GUIDE.find((x) => x.n === current.current)!;
    if (dist(h) <= LEAVE_M) {
      // Stay on this hole unless another is clearly closer.
      const better = HOLE_GUIDE.filter((x) => x.n !== h.n && dist(x) < dist(h) - 20).sort((a, b) => dist(a) - dist(b))[0];
      if (!better) return { hole: h, yards: yardsToGreen(pt, h) };
    }
    current.current = null;
  }
  let best: HoleGuide | null = null, bd = Infinity;
  for (const h of HOLE_GUIDE) { const d = dist(h); if (d < bd) { bd = d; best = h; } }
  if (best && bd <= ENTER_M) { current.current = best.n; return { hole: best, yards: yardsToGreen(pt, best) }; }
  return null;
}
