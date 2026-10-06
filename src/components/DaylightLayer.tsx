import { useMemo } from 'react';
import { WATER_BODIES } from '@/lib/waterBodies';
import type { Daylight } from '@/lib/daylight';

// The light on the plan: a warm golden wash in the hour before sunset, a pale mist lifting off the
// lakes at dawn, and sun (or moonlight) sparkling on the water.

const ASPECT = 3369.9 / 2383.8; // the plan's width over its height, to keep sparkles round

type Pt = [number, number];

function inside(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function area(poly: Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  return Math.abs(a / 2);
}

/** Sparkle positions inside the lakes (the same every time, so they don't jump). */
function lakeSparkles(): { x: number; y: number; g: number; s: number }[] {
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const out: { x: number; y: number; g: number; s: number }[] = [];
  for (const poly of WATER_BODIES as Pt[][]) {
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const want = Math.min(70, Math.max(5, Math.round(area(poly) * 1.1)));
    let made = 0;
    for (let tries = 0; made < want && tries < want * 40; tries++) {
      const p: Pt = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];
      if (!inside(p, poly)) continue;
      out.push({ x: p[0], y: p[1], g: Math.floor(rnd() * 5), s: 0.6 + rnd() * 0.8 });
      made++;
    }
  }
  return out;
}

export function DaylightLayer({ light, night }: { light: Daylight; night: number }) {
  const sparkles = useMemo(lakeSparkles, []);
  const silver = night > 0.5;
  return (
    <>
      {light.golden > 0.01 && (
        <>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(255,176,80,0.95) 0%, rgba(255,138,58,0.8) 55%, rgba(214,92,40,0.65) 100%)', mixBlendMode: 'soft-light', opacity: 0.9 * light.golden, transition: 'opacity 3s ease' }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(90% 70% at 8% 38%, rgba(255,212,140,0.6), rgba(255,212,140,0) 62%)', mixBlendMode: 'screen', opacity: 0.55 * light.golden, transition: 'opacity 3s ease' }} />
        </>
      )}

      {light.mist > 0.01 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: 0.8 * light.mist, filter: 'blur(9px)', transition: 'opacity 3s ease' }}>
          <g style={{ animation: 'zh-mist 16s ease-in-out infinite alternate' }}>
            {(WATER_BODIES as Pt[][]).map((poly, i) => (
              <polygon key={i} points={poly.map(([x, y]) => `${x},${y}`).join(' ')} fill="#eef5f4" fillOpacity={0.78} />
            ))}
          </g>
        </svg>
      )}

      {light.shimmer > 0.01 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: light.shimmer, transition: 'opacity 3s ease' }}>
          {[0, 1, 2, 3, 4].map((g) => (
            <g key={g} style={{ animation: `zh-twinkle ${2.4 + g * 0.55}s ease-in-out ${-g * 0.7}s infinite` }}>
              {sparkles.filter((s) => s.g === g).map((s, i) => (
                <g key={i}>
                  <ellipse cx={s.x} cy={s.y} rx={0.2 * s.s} ry={0.2 * s.s * ASPECT} fill={silver ? '#cfe0ff' : '#ffffff'} opacity={0.22} />
                  <ellipse cx={s.x} cy={s.y} rx={0.075 * s.s} ry={0.075 * s.s * ASPECT} fill={silver ? '#eaf2ff' : '#ffffff'} />
                </g>
              ))}
            </g>
          ))}
        </svg>
      )}
    </>
  );
}
