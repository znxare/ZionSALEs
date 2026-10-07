import { memo, useMemo } from 'react';
import { roadLampPoints } from '@/lib/directions';

// Night on the plan: a deep blue wash over the drawing, and warm lamps along every open road.
// `level` runs from 0 (day) to 1 (full night) so dusk and dawn fade in and out.
// Drawn without blend modes or per-lamp animation, so panning and zooming stay smooth.

const ASPECT = 3369.9 / 2383.8; // the plan's width over its height, to keep the glows round

function NightLayerBase({ level }: { level: number }) {
  const lamps = useMemo(() => roadLampPoints(32), []);
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg,#0d1a3c 0%,#0b1834 55%,#081329 100%)', opacity: 0.7 * level, transition: 'opacity 3s ease' }}
      />
      <svg
        className="zh-anim pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ opacity: level, transition: 'opacity 3s ease' }}
      >
        <defs>
          <radialGradient id="lamp-glow">
            <stop offset="0" stopColor="#ffd98a" stopOpacity="0.85" />
            <stop offset="0.35" stopColor="#ffb54d" stopOpacity="0.38" />
            <stop offset="1" stopColor="#ff9a2e" stopOpacity="0" />
          </radialGradient>
        </defs>
        {[0, 1].map((g) => (
          <g key={g} style={{ animation: `zh-glow ${3.6 + g * 1.4}s ease-in-out ${-g * 1.8}s infinite` }}>
            {lamps.filter((_, i) => i % 2 === g).map(([x, y], i) => (
              <g key={i}>
                <ellipse cx={x} cy={y} rx={0.42} ry={0.42 * ASPECT} fill="url(#lamp-glow)" />
                <ellipse cx={x} cy={y} rx={0.09} ry={0.09 * ASPECT} fill="#fff4cf" />
              </g>
            ))}
          </g>
        ))}
      </svg>
    </>
  );
}

export const NightLayer = memo(NightLayerBase);
