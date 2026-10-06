import { useMemo } from 'react';
import { roadLampPoints } from '@/lib/directions';

// Night on the plan: a deep blue wash over the drawing, and warm lamps along every open road.
// `level` runs from 0 (day) to 1 (full night) so dusk and dawn fade in and out.

const ASPECT = 3369.9 / 2383.8; // the plan's width over its height, to keep the glows round

export function NightLayer({ level }: { level: number }) {
  const lamps = useMemo(() => roadLampPoints(40), []);
  const groups = [0, 1, 2, 3];
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg,#1a2a58 0%,#15264a 55%,#101f3d 100%)', mixBlendMode: 'multiply', opacity: 0.78 * level, transition: 'opacity 3s ease' }}
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ opacity: level, mixBlendMode: 'screen', transition: 'opacity 3s ease' }}
      >
        <defs>
          <radialGradient id="lamp-glow">
            <stop offset="0" stopColor="#ffd98a" stopOpacity="0.85" />
            <stop offset="0.35" stopColor="#ffb54d" stopOpacity="0.38" />
            <stop offset="1" stopColor="#ff9a2e" stopOpacity="0" />
          </radialGradient>
        </defs>
        {groups.map((g) => (
          <g key={g} style={{ animation: `zh-glow ${3.2 + g * 0.7}s ease-in-out ${-g * 0.9}s infinite` }}>
            {lamps.filter((_, i) => i % groups.length === g).map(([x, y], i) => (
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
