import { memo, useMemo } from 'react';
import { WATER_BODIES } from '@/lib/waterBodies';
import type { Daylight } from '@/lib/daylight';
import { liteMode } from '@/lib/perf';

// The light on the plan: a warm golden wash in the hour before sunset, a pale mist lifting off the
// lakes at dawn, and sun (or moonlight) sparkling on the water. No blur filters or blend modes.

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
    const want = Math.min(54, Math.max(5, Math.round(area(poly) * 0.85)));
    let made = 0;
    for (let tries = 0; made < want && tries < want * 40; tries++) {
      const p: Pt = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];
      if (!inside(p, poly)) continue;
      out.push({ x: p[0], y: p[1], g: Math.floor(rnd() * 2), s: 0.6 + rnd() * 0.8 });
      made++;
    }
  }
  return out;
}

function DaylightLayerBase({ light, night, rain = 0 }: { light: Daylight; night: number; rain?: number }) {
  const sparkles = useMemo(lakeSparkles, []);
  const silver = night > 0.5;
  const lite = liteMode();
  return (
    <>
      {light.golden > 0.01 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(100deg, rgba(255,170,70,0.34) 0%, rgba(255,132,52,0.22) 55%, rgba(214,92,40,0.2) 100%)', opacity: light.golden, transition: 'opacity 3s ease' }}
        />
      )}

      {light.mist > 0.01 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: 0.8 * light.mist, transition: 'opacity 3s ease' }}>
          {(WATER_BODIES as Pt[][]).map((poly, i) => {
            const pts = poly.map(([x, y]) => `${x},${y}`).join(' ');
            return (
              <g key={i}>
                {/* a soft edge without a blur filter: wide, faint outlines under the fill */}
                <polygon points={pts} fill="none" stroke="#eef5f4" strokeOpacity={0.12} strokeWidth={2.6} strokeLinejoin="round" />
                <polygon points={pts} fill="none" stroke="#eef5f4" strokeOpacity={0.2} strokeWidth={1.5} strokeLinejoin="round" />
                <polygon points={pts} fill="#eef5f4" fillOpacity={0.62} stroke="#eef5f4" strokeOpacity={0.3} strokeWidth={0.6} strokeLinejoin="round" />
              </g>
            );
          })}
        </svg>
      )}

      {rain > 0.05 && !lite && (
        <svg className="zh-anim pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: Math.min(1, rain + 0.2) }}>
          {sparkles.filter((_, i) => i % 3 === 0).map((s, i) => (
            <ellipse key={i} cx={s.x} cy={s.y} rx={0.6 * s.s} ry={0.6 * s.s * ASPECT} fill="none" stroke="#ffffff" strokeWidth={0.07} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `zh-ripple ${1.6 + (i % 5) * 0.35}s ease-out ${-(i % 7) * 0.3}s infinite` }} />
          ))}
        </svg>
      )}

      {light.shimmer > 0.01 && (
        <svg className="zh-anim pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: light.shimmer, transition: 'opacity 3s ease' }}>
          {[0, 1].map((g) => (
            <g key={g} style={lite ? undefined : { animation: `zh-twinkle ${2.6 + g * 1.1}s ease-in-out ${-g * 1.3}s infinite` }}>
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

export const DaylightLayer = memo(DaylightLayerBase);
