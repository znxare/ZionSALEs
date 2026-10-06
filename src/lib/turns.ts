import { PLAN_TO_METRES } from './directions';

// Turn-by-turn instructions from a route (a polyline in % of the plan): where it turns,
// which way, and how far along the route each turn is.

type MapPt = [number, number];

export type TurnKind = 'left' | 'right' | 'slight-left' | 'slight-right' | 'uturn' | 'arrive';

export interface Maneuver {
  kind: TurnKind;
  /** Where on the plan the turn is. */
  at: MapPt;
  /** Metres along the route from its start. */
  s: number;
  /** How sharp the bend is, in degrees (used to pick between turns close together). */
  deg?: number;
}

const STEP_M = 4;       // route is resampled this finely
const WINDOW = 5;       // samples either side used to measure a bend (20 m)
const BEND_DEG = 38;    // a bend at least this sharp is announced
const TURN_DEG = 62;    // from here it is a full turn, below it "bear"
const UTURN_DEG = 150;

// Plan % to metres with y pointing down the screen, so a clockwise bend is a right turn.
const toM = ([x, y]: MapPt): [number, number] => [
  PLAN_TO_METRES[0][0] * x + PLAN_TO_METRES[0][1] * y,
  -(PLAN_TO_METRES[1][0] * x + PLAN_TO_METRES[1][1] * y),
];

function resample(points: MapPt[]): { xy: [number, number][]; plan: MapPt[]; total: number } {
  const m = points.map(toM);
  const xy: [number, number][] = [m[0]];
  const plan: MapPt[] = [points[0]];
  let carried = 0, total = 0;
  for (let i = 1; i < m.length; i++) {
    const [ax, ay] = m[i - 1], [bx, by] = m[i];
    const len = Math.hypot(bx - ax, by - ay);
    let d = STEP_M - carried;
    while (d <= len) {
      const t = d / len;
      xy.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      plan.push([points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t]);
      d += STEP_M;
    }
    carried = len - (d - STEP_M);
    total += len;
  }
  xy.push(m[m.length - 1]);
  plan.push(points[points.length - 1]);
  return { xy, plan, total };
}

/** Signed bend in degrees between two direction vectors: positive = right (clockwise on the plan). */
function bend(a: [number, number], b: [number, number]): number {
  return (Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]) * 180) / Math.PI;
}

const dir = (p: [number, number], q: [number, number]): [number, number] => [q[0] - p[0], q[1] - p[1]];

export function maneuversOf(points: MapPt[]): { steps: Maneuver[]; total: number } {
  if (points.length < 2) return { steps: [], total: 0 };
  const k = WINDOW;
  const r = resample(points);
  const { plan, total } = r;
  // The route starts at the traveller, so extend it straight back: a turn just ahead is then
  // still measured against the way they are going, not missed for lack of road behind them.
  const [fx, fy] = dir(r.xy[0], r.xy[Math.min(1, r.xy.length - 1)]);
  const fl = Math.hypot(fx, fy) || 1;
  const back: [number, number][] = Array.from({ length: k }, (_, j) => [r.xy[0][0] - (fx / fl) * STEP_M * (k - j), r.xy[0][1] - (fy / fl) * STEP_M * (k - j)]);
  const xy = [...back, ...r.xy];
  const n = xy.length;
  const steps: Maneuver[] = [];
  // Where the route bends: runs of samples whose in/out directions differ by more than BEND_DEG.
  let i = k;
  while (i < n - 1 - k) {
    const a = bend(dir(xy[i - k], xy[i]), dir(xy[i], xy[i + k]));
    if (Math.abs(a) < BEND_DEG) { i++; continue; }
    let j = i;
    while (j + 1 < n - 1 - k && Math.abs(bend(dir(xy[j + 1 - k], xy[j + 1]), dir(xy[j + 1], xy[j + 1 + k]))) >= BEND_DEG) j++;
    // The turn itself: direction 30 m before the bend against direction 30 m after it.
    const bi = Math.max(0, i - k - 2), ai = Math.min(n - 1, j + k + 2);
    const angle = bend(dir(xy[bi], xy[i]), dir(xy[j], xy[ai]));
    const mid = Math.round((i + j) / 2);
    const abs = Math.abs(angle);
    if (abs >= BEND_DEG) {
      const right = angle > 0;
      const kind: TurnKind = abs >= UTURN_DEG ? 'uturn' : abs >= TURN_DEG ? (right ? 'right' : 'left') : right ? 'slight-right' : 'slight-left';
      steps.push({ kind, at: plan[mid - k], s: (mid - k) * STEP_M, deg: abs });
    }
    i = j + 1 + k; // don't announce the same bend twice
  }
  // Tidy up: the join between the traveller's position and the road, and the join at the destination,
  // make small kinks that aren't real turns, and one bend can show up twice a few metres apart.
  const tidy: Maneuver[] = [];
  for (const st of steps) {
    if (st.s < 12 && st.kind.startsWith('slight')) continue;
    if (st.kind === 'uturn' && (st.s < 12 || total - st.s < 30)) continue;
    if (total - st.s < 15) continue;
    const last = tidy[tidy.length - 1];
    if (last && st.s - last.s < 20) { if ((st.deg ?? 0) > (last.deg ?? 0)) tidy[tidy.length - 1] = st; continue; }
    tidy.push(st);
  }
  tidy.push({ kind: 'arrive', at: plan[plan.length - 1], s: total });
  return { steps: tidy, total };
}

export function turnWords(kind: TurnKind): string {
  switch (kind) {
    case 'left': return 'Turn left';
    case 'right': return 'Turn right';
    case 'slight-left': return 'Bear left';
    case 'slight-right': return 'Bear right';
    case 'uturn': return 'Make a U-turn';
    case 'arrive': return 'Arrive';
  }
}

/** "50 m", "340 m", "1.2 km" — to the nearest 10 m under a kilometre, to 0.1 km above. */
export function distanceWords(m: number): string {
  const tens = Math.max(10, Math.round(m / 10) * 10);
  return tens >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${tens} m`;
}
