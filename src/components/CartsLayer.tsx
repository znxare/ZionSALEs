import { useMemo } from 'react';
import { AMENITIES, findRoute, planMetres } from '@/lib/directions';
import { HOLE_GUIDE } from '@/lib/holes';

// A few golf carts rolling slowly along the estate's roads, out and back. They live in the plan layer
// (an SVG with the plan's own proportions, so they keep their shape), and grow as you zoom in.

const UX = 14.137; // plan % -> svg units (x): the plan is 1413.7 x 1000 units
const UY = 10;
const SPEED = 3.2; // metres per second: a gentle roll

type Pt = [number, number];

function routesForCarts(): { d: string; secs: number }[] {
  const at = (id: string) => AMENITIES.find((a) => a.id === id)?.pt;
  const club = at('clubhouse'), gate = at('entry-main'), sports = at('sports'), practice = at('practice');
  const tee = (n: number) => HOLE_GUIDE.find((h) => h.n === n)?.tee;
  const pairs: [Pt | undefined, Pt | undefined][] = [
    [club, tee(1)], [gate, club], [club, tee(9)], [sports, tee(10) ?? practice], [gate, tee(2)],
  ];
  const out: { d: string; secs: number }[] = [];
  for (const [a, b] of pairs) {
    if (!a || !b) continue;
    const r = findRoute(a, b);
    if (!r || r.points.length < 3) continue;
    const m = planMetres(r.points);
    if (m < 120) continue;
    const there = r.points.map(([x, y]) => `${(x * UX).toFixed(1)} ${(y * UY).toFixed(1)}`);
    const back = [...there].reverse().slice(1);
    out.push({ d: `M ${there.join(' L ')} L ${back.join(' L ')}`, secs: (2 * m) / SPEED });
  }
  return out;
}

function Cart({ night }: { night: number }) {
  return (
    <g>
      {night > 0.05 && <polygon points="3.6,-1.4 16,-6 16,6 3.6,1.4" fill="url(#cart-beam)" opacity={Math.min(1, night)} />}
      <rect x="-3.7" y="-1.9" width="7.4" height="3.8" rx="1.1" fill="#0f2118" stroke="#c9a96e" strokeWidth="0.35" />
      <rect x="-2.6" y="-1.55" width="4.2" height="3.1" rx="0.7" fill="#fbf7ee" />
      <rect x="-2.6" y="-0.25" width="4.2" height="0.5" fill="#c9a96e" />
      <rect x="1.9" y="-1.4" width="1.3" height="2.8" rx="0.4" fill="#9fc7d8" opacity="0.85" />
    </g>
  );
}

export function CartsLayer({ night }: { night: number }) {
  const routes = useMemo(routesForCarts, []);
  if (routes.length === 0) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1413.7 1000" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="cart-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe3a0" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffe3a0" stopOpacity="0" />
        </linearGradient>
      </defs>
      {routes.map((r, i) => (
        <g key={i}>
          <animateMotion dur={`${r.secs}s`} begin={`${-((i * 37) % r.secs)}s`} repeatCount="indefinite" rotate="auto" path={r.d} />
          <Cart night={night} />
        </g>
      ))}
    </svg>
  );
}
