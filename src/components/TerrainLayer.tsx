import { memo } from 'react';
import { liteMode } from '@/lib/perf';

// The ground under the plan: soft contour lines and hill shading on the blank paper around the estate,
// a vignette so the paper fades off at the edges, and cloud shadows drifting over everything.
// Everything here is cheap to draw: no blur filters or blend modes, just a picture and soft gradients.

const CLOUDS: { y: number; w: number; h: number; dur: number; delay: number; dim: number }[] = [
  { y: 18, w: 40, h: 16, dur: 170, delay: -20, dim: 1 },
  { y: 48, w: 48, h: 19, dur: 215, delay: -120, dim: 0.8 },
  { y: 78, w: 40, h: 15, dur: 190, delay: -60, dim: 0.9 },
];

/** `cloud` is the sky's cloud cover, 0..1; `night` 0 (day) .. 1 (night), when shadows disappear. */
function TerrainLayerBase({ cloud, night }: { cloud: number; night: number }) {
  const shadow = Math.min(1, 0.22 + cloud * 0.9) * (1 - night);
  const lite = liteMode();
  return (
    <>
      <img src="/plan-terrain.webp" alt="" aria-hidden draggable={false} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full select-none" style={{ opacity: 1 - night * 0.45 }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 75% 75% at 50% 50%, rgba(74,54,24,0) 58%, rgba(74,54,24,0.16) 100%)' }} />
      {shadow > 0.02 && !lite && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: 0.55 * shadow, transition: 'opacity 3s ease' }}>
          <defs>
            <radialGradient id="cloud-shade">
              <stop offset="0" stopColor="#1e2a3a" stopOpacity="0.3" />
              <stop offset="0.55" stopColor="#1e2a3a" stopOpacity="0.16" />
              <stop offset="1" stopColor="#1e2a3a" stopOpacity="0" />
            </radialGradient>
          </defs>
          {CLOUDS.map((c, i) => (
            <g key={i} className="zh-anim" style={{ animation: `zh-cloudshadow ${c.dur}s linear ${c.delay}s infinite` }}>
              <ellipse cx={0} cy={c.y} rx={c.w / 2} ry={c.h / 2} fill="url(#cloud-shade)" opacity={c.dim} />
              <ellipse cx={-c.w * 0.3} cy={c.y + c.h * 0.2} rx={c.w * 0.36} ry={c.h * 0.42} fill="url(#cloud-shade)" opacity={c.dim * 0.9} />
            </g>
          ))}
        </svg>
      )}
    </>
  );
}

export const TerrainLayer = memo(TerrainLayerBase);
