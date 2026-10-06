// The ground under the plan: soft contour lines and hill shading on the blank paper around the estate,
// a vignette so the paper fades off at the edges, and cloud shadows drifting over everything.

const CLOUDS: { y: number; w: number; h: number; dur: number; delay: number; dim: number }[] = [
  { y: 18, w: 34, h: 12, dur: 170, delay: -20, dim: 1 },
  { y: 44, w: 42, h: 15, dur: 215, delay: -120, dim: 0.8 },
  { y: 70, w: 30, h: 11, dur: 190, delay: -60, dim: 0.9 },
  { y: 30, w: 26, h: 9, dur: 140, delay: -95, dim: 0.65 },
  { y: 88, w: 38, h: 12, dur: 240, delay: -170, dim: 0.75 },
];

/** `cloud` is the sky's cloud cover, 0..1; `night` 0 (day) .. 1 (night), when shadows disappear. */
export function TerrainLayer({ cloud, night }: { cloud: number; night: number }) {
  const shadow = Math.min(1, 0.22 + cloud * 0.9) * (1 - night);
  return (
    <>
      <img src="/plan-terrain.webp" alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" style={{ opacity: 1 - night * 0.45 }} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 75% 75% at 50% 50%, rgba(0,0,0,0) 58%, rgba(74,54,24,0.2) 100%)', mixBlendMode: 'multiply' }}
      />
      {shadow > 0.02 && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ filter: 'blur(22px)', opacity: 0.2 * shadow, mixBlendMode: 'multiply', transition: 'opacity 3s ease' }}
        >
          {CLOUDS.map((c, i) => (
            <g key={i} className="zh-anim" style={{ animation: `zh-cloudshadow ${c.dur}s linear ${c.delay}s infinite` }}>
              <ellipse cx={0} cy={c.y} rx={c.w / 2} ry={c.h / 2} fill="#1e2a3a" opacity={c.dim} />
              <ellipse cx={-c.w * 0.28} cy={c.y + c.h * 0.22} rx={c.w * 0.34} ry={c.h * 0.4} fill="#1e2a3a" opacity={c.dim * 0.85} />
              <ellipse cx={c.w * 0.3} cy={c.y - c.h * 0.18} rx={c.w * 0.3} ry={c.h * 0.38} fill="#1e2a3a" opacity={c.dim * 0.8} />
            </g>
          ))}
        </svg>
      )}
    </>
  );
}
