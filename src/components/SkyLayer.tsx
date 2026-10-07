import { memo, useEffect, useMemo, useState } from 'react';
import { liteMode } from '@/lib/perf';
import { STARS, VILLAGE_LIGHTS } from '@/lib/marginSpots';
import { bodyOnArc, moonCycle } from '@/lib/sky';

// What lives in the blank paper around the estate: the sun or moon travelling along an arc, drifting clouds,
// birds and kites by day; stars, a shooting star and far-off village lights at night; and the odd vehicle
// on the road to Kolar. All of it sits on the plan, so it moves and grows with the map.

const ASPECT = 3369.9 / 2383.8; // plan width over height, to keep round things round in the stretched 100x100 box
const UX = 14.137; // plan % -> svg units (x) in the plan-shaped box, which is 1413.7 x 1000
const UY = 10;

type Pt = [number, number];

// The arc across the top of the paper: left foot, right foot and the control point that makes the peak.
const ARC = { p0: [62 * UX, 11 * UY] as Pt, p1: [80.5 * UX, -8 * UY] as Pt, p2: [99 * UX, 11 * UY] as Pt };
const arcPoint = (t: number): Pt => [
  (1 - t) * (1 - t) * ARC.p0[0] + 2 * (1 - t) * t * ARC.p1[0] + t * t * ARC.p2[0],
  (1 - t) * (1 - t) * ARC.p0[1] + 2 * (1 - t) * t * ARC.p1[1] + t * t * ARC.p2[1],
];

// The road to Kolar, from the west edge past the main gate and round the south of the estate (% of the plan).
const KOLAR: Pt[] = [
  [11.3, 53.9], [12.3, 54.8], [13.1, 55.5], [14.2, 56.0], [15, 56.8], [15.9, 57.6], [17, 58.84], [18, 59.82], [20, 61.55], [25, 66.03],
  [30, 69.87], [35, 73.37], [40, 76.9], [43, 79.03], [45.2, 80.55], [46.14, 81.19], [53.42, 85.82], [54.14, 86.76], [54.86, 87.78],
  [56.36, 88.73], [57.36, 89.2], [70.08, 95.95], [72.14, 96.11], [74.08, 96.27], [77.75, 96.74], [80.69, 96.66], [83.58, 96.27], [84.08, 95.88],
];

function pathOf(points: Pt[], reverse = false, roundTrip = true): string {
  const pts = (reverse ? [...points].reverse() : points).map(([x, y]) => `${(x * UX).toFixed(1)} ${(y * UY).toFixed(1)}`);
  const back = [...pts].reverse().slice(1);
  return `M ${pts.join(' L ')}${roundTrip ? ` L ${back.join(' L ')}` : ''}`;
}

function Moon({ cycle }: { cycle: number }) {
  const r = 11;
  const k = Math.cos(2 * Math.PI * cycle);
  const rx = Math.abs(k) * r;
  const lit = `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx.toFixed(2)} ${r} 0 0 ${k > 0 ? 0 : 1} 0 ${-r} Z`;
  return (
    <g>
      <circle r={r * 2.6} fill="url(#sky-moon-glow)" />
      <circle r={r} fill="#2a3552" opacity={0.7} />
      <g transform={cycle > 0.5 ? 'scale(-1 1)' : undefined}><path d={lit} fill="#f6efd9" /></g>
      <circle r={r} fill="none" stroke="#ffd9bf" strokeWidth={0.5} opacity={0.6} />
    </g>
  );
}

function Sun() {
  return (
    <g>
      <circle r={34} fill="url(#sky-sun-glow)" />
      <g style={{ animation: 'zh-orbit 80s linear infinite' }}>
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={0} y1={-17} x2={0} y2={-23} stroke="#ffd36a" strokeWidth={1.6} strokeLinecap="round" transform={`rotate(${i * 30})`} opacity={0.85} />
        ))}
      </g>
      <circle r={12.5} fill="#ffd978" />
      <circle r={12.5} fill="none" stroke="#fff1c4" strokeWidth={1} />
    </g>
  );
}

function Cloud({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <ellipse cx={0} cy={4} rx={34} ry={9} fill="#fff" opacity={0.78} />
      <circle cx={-12} cy={-2} r={12} fill="#fff" opacity={0.82} />
      <circle cx={6} cy={-7} r={15} fill="#fff" opacity={0.85} />
      <circle cx={22} cy={0} r={10} fill="#fff" opacity={0.8} />
    </g>
  );
}

const WING_UP = 'M 0 0 C -3 -1.4 -6 -5 -10 -6.8 C -7 -3.4 -4 -1.4 0 0.9 C 4 -1.4 7 -3.4 10 -6.8 C 6 -5 3 -1.4 0 0 Z';
const WING_MID = 'M 0 0 C -3 -0.6 -6 -1.7 -10 -1.6 C -7 0.1 -4 0.9 0 1.1 C 4 0.9 7 0.1 10 -1.6 C 6 -1.7 3 -0.6 0 0 Z';
const WING_DOWN = 'M 0 0 C -3 0.9 -6 3.1 -10 4.8 C -7 2.3 -4 1.2 0 1.2 C 4 1.2 7 2.3 10 4.8 C 6 3.1 3 0.9 0 0 Z';
const FLAP_VALUES = `${WING_UP};${WING_MID};${WING_DOWN};${WING_MID};${WING_UP}`;
const FLAP_SPLINES = '.42 0 .58 1;.42 0 .58 1;.42 0 .58 1;.42 0 .58 1';

/** A bird in flight, seen from the side: the wings morph smoothly through up, level and down. */
function Bird({ delay, scale = 1 }: { delay: number; scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <path d={WING_MID} fill="#2c2a22" opacity="0.12" transform="translate(5 11)" />
      <path d={WING_MID} fill="#2c2a22" opacity="0.92">
        <animate attributeName="d" values={FLAP_VALUES} dur={`${0.95 + delay * 0.2}s`} begin={`${-delay}s`} repeatCount="indefinite" calcMode="spline" keySplines={FLAP_SPLINES} keyTimes="0;.28;.5;.78;1" />
      </path>
      <ellipse cx="0" cy="0.5" rx="2.3" ry="0.95" fill="#2c2a22" />
      <path d="M 1.8 0.3 L 4.6 0.9 L 1.8 1 Z" fill="#2c2a22" />
    </g>
  );
}

function Kite({ x, y, colours, delay }: { x: number; y: number; colours: [string, string]; delay: number }) {
  return (
    <g transform={`translate(${x * UX} ${y * UY})`}>
      <line x1={0} y1={14} x2={-26} y2={96} stroke="#6b5b3e" strokeWidth={0.5} opacity={0.6} />
      <g style={{ transformOrigin: '0 14px', animation: `zh-kite 6s ease-in-out ${delay}s infinite alternate` }}>
        <polygon points="0,-10 6,0 0,14 -6,0" fill={colours[0]} />
        <polygon points="0,-10 6,0 0,14" fill={colours[1]} />
        <path d="M 0 14 q 4 6 0 12 q -4 6 1 12 q 4 5 -1 10" fill="none" stroke="#ffd9bf" strokeWidth={1.1} strokeLinecap="round" />
      </g>
    </g>
  );
}

function Car({ body, night }: { body: string; night: number }) {
  return (
    <g>
      {night > 0.05 && <polygon points="2.8,-1 14,-5 14,5 2.8,1" fill="url(#cart-beam)" opacity={Math.min(1, night) * 0.8} />}
      <rect x={-3} y={-1.5} width={6} height={3} rx={0.9} fill={body} />
      <rect x={-0.6} y={-1.15} width={2.4} height={2.3} rx={0.5} fill="#9fc7d8" opacity={0.85} />
      {night > 0.05 && <circle cx={-3} cy={0} r={0.7} fill="#ff4a3a" opacity={night} />}
    </g>
  );
}

function SkyLayerBase({ night, cloud, sunrise, sunset }: { night: number; cloud: number; sunrise: Date | null; sunset: Date | null }) {
  const lite = liteMode();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(t);
  }, []);
  const { t, moon } = bodyOnArc(now, sunrise, sunset, night);
  const [bx, by] = arcPoint(t);
  const cycle = useMemo(() => moonCycle(now), [now.getUTCDate()]); // eslint-disable-line react-hooks/exhaustive-deps
  const day = 1 - night;
  const kolarThere = useMemo(() => pathOf(KOLAR), []);
  const kolarBack = useMemo(() => pathOf(KOLAR, true), []);
  const arcD = `M ${ARC.p0[0]} ${ARC.p0[1]} Q ${ARC.p1[0]} ${ARC.p1[1]} ${ARC.p2[0]} ${ARC.p2[1]}`;

  return (
    <>
      {/* things that are round: the arc, the sun and moon, clouds, birds, kites, vehicles */}
      <svg className="zh-anim pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1413.7 1000" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="sky-sun-glow"><stop offset="0" stopColor="#ffe9a8" stopOpacity="0.7" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></radialGradient>
          <radialGradient id="sky-moon-glow"><stop offset="0" stopColor="#cfe0ff" stopOpacity="0.5" /><stop offset="1" stopColor="#cfe0ff" stopOpacity="0" /></radialGradient>
          <linearGradient id="cart-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffe3a0" stopOpacity="0.85" /><stop offset="1" stopColor="#ffe3a0" stopOpacity="0" /></linearGradient>
          <linearGradient id="sky-shoot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="0.95" /></linearGradient>
        </defs>

        {/* the arc and whichever of sun or moon is up */}
        <path d={arcD} fill="none" stroke="#b9a27c" strokeWidth={1.2} strokeDasharray="1.5 7" strokeLinecap="round" opacity={0.75} />
        <circle cx={ARC.p0[0]} cy={ARC.p0[1]} r={2.4} fill="#e3d8c2" opacity={0.8} />
        <circle cx={ARC.p2[0]} cy={ARC.p2[1]} r={2.4} fill="#e3d8c2" opacity={0.8} />
        <g transform={`translate(${bx} ${by})`} style={{ transition: 'opacity 2s ease' }}>
          {moon ? <Moon cycle={cycle} /> : <Sun />}
        </g>

        {/* by day */}
        {!lite && (
        <g opacity={day * (0.45 + cloud * 0.55)} style={{ transition: 'opacity 3s ease' }}>
          <g style={{ animation: 'zh-cloudx 150s linear -40s infinite' }}><g transform={`translate(0 ${14 * UY})`}><Cloud s={1.1} /></g></g>
          <g style={{ animation: 'zh-cloudx 210s linear -150s infinite' }}><g transform={`translate(0 ${60 * UY})`}><Cloud s={0.9} /></g></g>
          <g style={{ animation: 'zh-cloudx 190s linear -20s infinite' }}><g transform={`translate(0 ${42 * UY})`}><Cloud s={1} /></g></g>
        </g>
        )}
        {!lite && (
        <g opacity={day} style={{ transition: 'opacity 3s ease' }}>
          <g>
            <animateMotion dur="68s" begin="-14s" repeatCount="indefinite" rotate="auto" path="M -120 250 C 260 120, 620 340, 980 200 S 1420 120, 1580 150" />
            {[[0, 0, 1], [-17, 9, 0.9], [-15, -10, 0.92], [-34, 19, 0.8], [-31, -19, 0.82]].map(([dx, dy, sc], i) => (
              <g key={i} transform={`translate(${dx} ${dy})`}><Bird delay={i * 0.17} scale={sc} /></g>
            ))}
          </g>
          <Kite x={6.2} y={61} colours={['#f05a22', '#e3d8c2']} delay={0} />
          <Kite x={10.6} y={53} colours={['#2f8a5a', '#ffd9bf']} delay={-2.4} />
        </g>
        )}

        {/* the road to Kolar: two vehicles, one each way, faint */}
        {!lite && (
        <g opacity={0.8}>
          <g><animateMotion dur="175s" begin="-30s" repeatCount="indefinite" rotate="auto" path={kolarThere} /><Car body="#f1ede2" night={night} /></g>
          <g><animateMotion dur="230s" begin="-120s" repeatCount="indefinite" rotate="auto" path={kolarBack} /><Car body="#7a1f1a" night={night} /></g>
        </g>
        )}

        {/* by night: a shooting star now and then */}
        {!lite && night > 0.05 && (
        <g opacity={night} style={{ transition: 'opacity 3s ease' }}>
          <g style={{ animation: 'zh-shoot 27s linear -9s infinite' }}>
            <line x1={0} y1={0} x2={90} y2={36} stroke="url(#sky-shoot)" strokeWidth={1.6} strokeLinecap="round" transform={`translate(${24 * UX} ${5 * UY})`} />
          </g>
        </g>
        )}
      </svg>

      {/* things that sit in the stretched 100x100 box: stars and far-off lights */}
      <svg
        className="zh-anim pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ opacity: night, transition: 'opacity 3s ease' }}
      >
        <g opacity={1 - 0.6 * cloud}>
          {[0, 1].map((g) => (
            <g key={g} style={lite ? undefined : { animation: `zh-twinkle ${3 + g * 1.3}s ease-in-out ${-g * 1.5}s infinite` }}>
              {STARS.filter((s) => s[3] % 2 === g).map(([x, y, sz], i) => (
                <ellipse key={i} cx={x} cy={y} rx={0.085 * sz} ry={0.085 * sz * ASPECT} fill="#f6f1e2" />
              ))}
            </g>
          ))}
        </g>
        {[0, 1].map((g) => (
          <g key={g} style={lite ? undefined : { animation: `zh-glow ${3.6 + g * 1.5}s ease-in-out ${-g * 1.7}s infinite` }}>
            {VILLAGE_LIGHTS.filter((s) => s[3] % 2 === g).map(([x, y, sz], i) => (
              <g key={i}>
                <ellipse cx={x} cy={y} rx={0.24 * sz} ry={0.24 * sz * ASPECT} fill="#ffb347" opacity={0.28} />
                <ellipse cx={x} cy={y} rx={0.075 * sz} ry={0.075 * sz * ASPECT} fill="#ffe2a8" />
              </g>
            ))}
          </g>
        ))}
      </svg>
    </>
  );
}

export const SkyLayer = memo(SkyLayerBase);
