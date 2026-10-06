import { WATER_BODIES } from './waterBodies';
import { PLAN_TO_METRES } from './directions';

// Deep-water caution: the lakes and ponds on the plan (traced by scripts/extract_water.py)
// and how far a point is from the nearest one.

type MapPt = [number, number];

/** The live warning goes off once, when someone is this close to the water's edge (as drawn on the plan)... */
export const WATER_CAUTION_M = 8;
/** ...and can go off again only after they have been this far away. */
export const WATER_REARM_M = 25;
/** A route that runs closer than this to a lake gets a note in the directions banner. */
export const WATER_ROUTE_NOTE_M = 25;
/** Positions less certain than this (metres of GPS error) are too vague to say someone is at the water. */
export const WATER_MAX_GPS_ERROR_M = 20;

const toMetres = ([x, y]: MapPt): MapPt => [PLAN_TO_METRES[0][0] * x + PLAN_TO_METRES[0][1] * y, PLAN_TO_METRES[1][0] * x + PLAN_TO_METRES[1][1] * y];
const METRE_POLYS = WATER_BODIES.map((poly) => poly.map(toMetres));

function inside(pt: MapPt, poly: MapPt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function edgeDistance(p: MapPt, poly: MapPt[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy)));
  }
  return best;
}

/** The nearest water body to a point on the plan (% coordinates): its index and the metres to its edge (0 = in the water). */
export function nearestWater(pt: MapPt): { index: number; metres: number } {
  const m = toMetres(pt);
  let index = -1, metres = Infinity;
  METRE_POLYS.forEach((poly, i) => {
    const d = inside(m, poly) ? 0 : edgeDistance(m, poly);
    if (d < metres) { metres = d; index = i; }
  });
  return { index, metres };
}

/** Metres from the nearest water along a route (the closest the route gets), with the first stretch that is near water. */
export function routeWaterContact(points: MapPt[]): { metres: number; at: MapPt | null } {
  let metres = Infinity, at: MapPt | null = null;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[i + 1] ?? a;
    // sample along each leg roughly every 5 m (plan % -> metres is ~24 m per 1%)
    const steps = Math.max(1, Math.ceil(Math.hypot(...toMetres([b[0] - a[0], b[1] - a[1]])) / 5));
    for (let k = 0; k < steps; k++) {
      const p: MapPt = [a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps];
      const d = nearestWater(p).metres;
      if (d < metres) { metres = d; at = p; }
    }
  }
  return { metres, at };
}
