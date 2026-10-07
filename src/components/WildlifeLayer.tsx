import { useState, type CSSProperties, type ReactNode } from 'react';
import { lxEyebrow, lxIvory } from '@/lib/luxury';
import { FISH_SPOTS, type LakeSpot } from '@/lib/lakePoints';
import { WATER_BODIES } from '@/lib/waterBodies';
import { holeGuide } from '@/lib/holes';
import { useAtmosphere } from '@/lib/mapInfo';

// Life on the public map: groves whose leaves sway and drift, peacocks strolling the 4th green,
// a small bird circling above it, and parrots round the clubhouse trees. Purely decorative,
// positioned on the plan (% of the plan); tap one for a line about it.

type Pt = [number, number];

const GROVES: { id: string; pt: Pt; size: number; delay: number }[] = [
  { id: 'g1', pt: [38.4, 61.4], size: 1.0, delay: 0 },       // by the clubhouse
  { id: 'g2', pt: [41.6, 60.2], size: 0.8, delay: 1.3 },
  { id: 'g3', pt: [81.2, 79.6], size: 1.0, delay: 0.6 },     // hole 4
  { id: 'g4', pt: [85.4, 76.0], size: 0.85, delay: 2.1 },
  { id: 'g5', pt: [47.8, 45.0], size: 0.9, delay: 1.0 },     // hole 9 / practice
  { id: 'g6', pt: [24.6, 40.8], size: 0.9, delay: 2.6 },     // west fairways
  { id: 'g7', pt: [60.4, 70.2], size: 0.85, delay: 0.3 },    // by hole 6
];

const SPOTS: Record<string, { title: string; text: string }> = {
  grove: { title: 'Shade grove', text: 'Mature trees, cool shade and birdsong — a quiet place to pause between holes.' },
  peacock: { title: 'Peacocks', text: 'Peacocks wander onto the 4th green at first light. Come and watch them strut.' },
  bird: { title: 'Over the 4th', text: 'Small birds wheel over the green and its trees, all day long.' },
  parrot: { title: 'Parrot perch', text: 'Parrots chatter in the trees around the clubhouse — listen as you arrive.' },
  egret: { title: 'Egret Lake', text: 'An egret keeps watch over the water, always at a safe distance.' },
  fish: { title: 'Life in the lake', text: 'Fish glide just under the surface — watch for the ripples, and the odd leap.' },
  flock: { title: 'Birds of the course', text: 'Swallows and bulbuls sweep over the fairways from morning to dusk.' },
  turtle: { title: 'Lake turtles', text: 'Turtles drift across the lakes and slip under the surface when anyone gets too close.' },
  kingfisher: { title: 'Kingfisher', text: 'A flash of blue on the bank — it watches the water, then dives for a fish.' },
  rabbit: { title: 'The rabbit', text: 'A rabbit nibbles beside the bushes and darts back inside at the first footstep.' },
  sprinkler: { title: 'The greens\u2019 morning drink', text: 'Sprinklers keep the bent-grass greens cool and true. Please stay off while they run.' },
};

// Small birds that circle over the fairways: [x, y] on the plan, loop size, seconds per loop, colours.
const COURSE_BIRDS: { pt: Pt; r: number; sec: number; rev?: boolean; delay: number; b: string; w: string; h: string; k: string }[] = [
  { pt: [48.6, 62.0], r: 46, sec: 13, delay: 0, b: '#1f3a6e', w: '#2b4f94', h: '#14264a', k: '#e8b04a' },       // hole 1
  { pt: [64.0, 72.5], r: 62, sec: 17, rev: true, delay: -5, b: '#6b4a2b', w: '#8a6238', h: '#43301c', k: '#f2c04a' }, // hole 6
  { pt: [60.5, 84.0], r: 54, sec: 15, delay: -3, b: '#1f3a6e', w: '#2b4f94', h: '#14264a', k: '#e8b04a' },       // hole 2
  { pt: [44.2, 44.6], r: 50, sec: 14, rev: true, delay: -7, b: '#3b3b3b', w: '#555', h: '#222', k: '#f2c04a' },   // hole 9
  { pt: [21.8, 42.5], r: 58, sec: 18, delay: -2, b: '#6b4a2b', w: '#8a6238', h: '#43301c', k: '#f2c04a' },       // hole 15
  { pt: [26.0, 45.0], r: 44, sec: 12, rev: true, delay: -9, b: '#1f3a6e', w: '#2b4f94', h: '#14264a', k: '#e8b04a' }, // hole 17
  { pt: [49.5, 13.0], r: 52, sec: 16, delay: -4, b: '#3b3b3b', w: '#555', h: '#222', k: '#f2c04a' },             // hole 12
  { pt: [75.5, 90.0], r: 48, sec: 13.5, rev: true, delay: -6, b: '#6b4a2b', w: '#8a6238', h: '#43301c', k: '#f2c04a' }, // hole 3
  { pt: [34.8, 31.0], r: 40, sec: 11.5, delay: -1, b: '#1f3a6e', w: '#2b4f94', h: '#14264a', k: '#e8b04a' },     // hole 14
];

// Flocks that fly across the course now and then, from a starting point on the plan.
const FLOCKS: { pt: Pt; sec: number; delay: number }[] = [
  { pt: [52.0, 56.0], sec: 19, delay: 0 },
  { pt: [28.0, 40.0], sec: 23, delay: -9 },
  { pt: [66.0, 80.0], sec: 21, delay: -14 },
  { pt: [46.0, 18.0], sec: 25, delay: -5 },
];

// More peacocks, beyond the 4th green: under the mango trees by the 12th, and on the 15th.
const PEACOCKS: { pt: Pt; delay: number; flip?: boolean }[] = [
  { pt: [50.4, 11.6], delay: -4 },
  { pt: [19.6, 47.4], delay: -13, flip: true },
];

// Greens that are being watered, by hole number (just a couple, lightly).
const SPRINKLED = [9, 16];

// Kingfishers: perched on a lake bank, watching the water, diving, and back to the perch.
const KINGFISHERS: { bank: [number, number]; water: [number, number] }[] = (() => {
  const best = new Map<number, LakeSpot>();
  for (const f of FISH_SPOTS) if (!best.has(f.lake) || f.room > best.get(f.lake)!.room) best.set(f.lake, f);
  return [...best.values()].filter((f) => f.room > 1.1).sort((x, y) => y.room - x.room).slice(0, 4).map((f) => {
    const poly = WATER_BODIES[f.lake];
    let v = poly[0], bd = Infinity;
    for (const q of poly) { const d = Math.hypot((q[0] - f.pt[0]) * 1.4, q[1] - f.pt[1]); if (d < bd) { bd = d; v = q; } }
    return { bank: [v[0], v[1]] as [number, number], water: f.pt };
  });
})();

function Tree({ s }: { s: number }) {
  return (
    <svg width={44 * s} height={44 * s} viewBox="0 0 44 44" className="overflow-visible">
      <defs>
        <radialGradient id="zh-canopy" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#9fd08f" />
          <stop offset="0.55" stopColor="#3f8b52" />
          <stop offset="1" stopColor="#1f5a35" />
        </radialGradient>
      </defs>
      <circle cx="22" cy="24" r="17" fill="#0b2415" opacity="0.18" transform="translate(2.5 3.5)" />
      <circle cx="15" cy="21" r="10.5" fill="url(#zh-canopy)" />
      <circle cx="28" cy="20" r="11.5" fill="url(#zh-canopy)" />
      <circle cx="22" cy="28" r="11" fill="url(#zh-canopy)" />
      <circle cx="22" cy="21" r="9" fill="#7cbf78" opacity="0.55" />
      <circle cx="18" cy="17" r="3" fill="#d9f0c4" opacity="0.55" />
    </svg>
  );
}

function Leaf({ dx, dy, delay, dur }: { dx: number; dy: number; delay: number; dur: number }) {
  const style = { '--lx': `${dx}px`, '--ly': `${dy}px`, animation: `zh-leaf ${dur}s ease-in ${delay}s infinite` } as CSSProperties;
  return <span className="absolute left-0 top-0 block h-1.5 w-2.5 rounded-[60%_0_60%_0] bg-[#8fc98a]" style={style} />;
}

/** A bird seen from above, facing up. wings/body colours differ per species. */
function Bird({ body, wing, head, beak, size, tail }: { body: string; wing: string; head: string; beak: string; size: number; tail?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="overflow-visible">
      {tail && <path d="M10.6 15 L12 23 L13.4 15 Z" fill={tail} />}
      <ellipse cx="12" cy="12" rx="2.3" ry="5.2" fill={body} />
      <g style={{ transformOrigin: '12px 11px', animation: 'zh-flap 0.34s ease-in-out infinite' }}>
        <ellipse cx="5" cy="11" rx="5.4" ry="2.1" fill={wing} />
        <ellipse cx="19" cy="11" rx="5.4" ry="2.1" fill={wing} />
      </g>
      <circle cx="12" cy="6.2" r="2" fill={head} />
      <path d="M11.2 4.6 L12 2.6 L12.8 4.6 Z" fill={beak} />
    </svg>
  );
}

/** A koi seen from above, swimming up the screen. */
function Fish({ size, tone }: { size: number; tone: number }) {
  const body = ['#f26a35', '#f4efe3', '#e8b04a', '#e3552b'][tone % 4];
  const patch = ['#fff4e6', '#f26a35', '#fff4e6', '#f4efe3'][tone % 4];
  return (
    <svg width={size * 0.6} height={size} viewBox="0 0 24 40" className="overflow-visible">
      <ellipse cx="12" cy="20" rx="9" ry="3" fill="#0b2a3a" opacity="0.16" transform="translate(2 6)" />
      <g style={{ transformOrigin: '12px 28px', animation: 'zh-wag 0.9s ease-in-out infinite' }}>
        <path d="M12 27 L4.5 39.5 Q12 35.5 19.5 39.5 Z" fill={body} opacity="0.9" />
      </g>
      <ellipse cx="5.2" cy="14" rx="2.3" ry="4" fill={body} opacity="0.75" transform="rotate(-24 5.2 14)" />
      <ellipse cx="18.8" cy="14" rx="2.3" ry="4" fill={body} opacity="0.75" transform="rotate(24 18.8 14)" />
      <path d="M12 3 C18 4 19 18 17 25 Q12 31 7 25 C5 18 6 4 12 3 Z" fill={body} />
      <ellipse cx="12" cy="16" rx="3.6" ry="6" fill={patch} opacity="0.9" />
      <circle cx="9.2" cy="7.4" r="0.9" fill="#1b1b1b" /><circle cx="14.8" cy="7.4" r="0.9" fill="#1b1b1b" />
    </svg>
  );
}

/** A kingfisher seen from above, facing up: turquoise back, orange head, a long dark beak. */
function Kingfisher({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="overflow-visible">
      <ellipse cx="12" cy="12.5" rx="2.6" ry="5" fill="#1fb3d6" />
      <ellipse cx="12" cy="11" rx="1.1" ry="3.4" fill="#7fe3f2" opacity="0.8" />
      <g style={{ transformOrigin: '12px 11px' }}>
        <ellipse cx="6.2" cy="12" rx="4.2" ry="2" fill="#0f7fa8" />
        <ellipse cx="17.8" cy="12" rx="4.2" ry="2" fill="#0f7fa8" />
      </g>
      <circle cx="12" cy="6.4" r="2.3" fill="#e8873a" />
      <path d="M11.2 5.4 L12 0.6 L12.8 5.4 Z" fill="#1d1d1d" />
      <path d="M11 17 L12 21 L13 17 Z" fill="#0c6b8a" />
    </svg>
  );
}

/** A turtle seen from above, swimming up the screen; the flippers paddle. */
function Turtle({ size }: { size: number }) {
  const paddle = (d: number) => ({ transformOrigin: '50% 50%', animation: `zh-wag 1.7s ease-in-out ${d}s infinite` }) as CSSProperties;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="overflow-visible">
      <ellipse cx="20" cy="22" rx="12" ry="14" fill="#0b2a3a" opacity="0.18" transform="translate(2 4)" />
      <ellipse cx="7.5" cy="14" rx="5" ry="2.4" fill="#6f8f4e" transform="rotate(-30 7.5 14)" style={paddle(0)} />
      <ellipse cx="32.5" cy="14" rx="5" ry="2.4" fill="#6f8f4e" transform="rotate(30 32.5 14)" style={paddle(0.8)} />
      <ellipse cx="9" cy="29" rx="3.6" ry="2" fill="#6f8f4e" transform="rotate(30 9 29)" />
      <ellipse cx="31" cy="29" rx="3.6" ry="2" fill="#6f8f4e" transform="rotate(-30 31 29)" />
      <ellipse cx="20" cy="6" rx="3.3" ry="4.2" fill="#86a95f" />
      <circle cx="18.7" cy="5" r="0.7" fill="#1b1b1b" /><circle cx="21.3" cy="5" r="0.7" fill="#1b1b1b" />
      <path d="M19 36 L20 40 L21 36 Z" fill="#6f8f4e" />
      <ellipse cx="20" cy="21" rx="11" ry="13.5" fill="#46603a" stroke="#2a3b24" strokeWidth="1.1" />
      <path d="M20 9.5 L26 14 L26 24 L20 28.5 L14 24 L14 14 Z" fill="#587547" stroke="#2a3b24" strokeWidth="0.8" />
      <path d="M20 9.5 V28.5 M14 14 L26 24 M26 14 L14 24" stroke="#2a3b24" strokeWidth="0.5" opacity="0.6" />
      <ellipse cx="16.8" cy="15" rx="3" ry="2" fill="#a6c486" opacity="0.4" />
    </svg>
  );
}

/** A rabbit seen from above, facing up. */
function Rabbit({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" className="overflow-visible">
      <ellipse cx="15" cy="18" rx="7.5" ry="9" fill="#0b2415" opacity="0.18" transform="translate(1.5 2)" />
      <ellipse cx="15" cy="18" rx="6" ry="8" fill="#b9a68a" />
      <ellipse cx="15" cy="17" rx="3.4" ry="5" fill="#cdbca3" opacity="0.8" />
      <circle cx="15" cy="26.4" r="2.1" fill="#fbf7ee" />
      <circle cx="15" cy="9.6" r="3.9" fill="#b9a68a" />
      <ellipse cx="12.4" cy="3.6" rx="1.5" ry="4.2" fill="#a8947a" transform="rotate(-8 12.4 3.6)" />
      <ellipse cx="17.6" cy="3.6" rx="1.5" ry="4.2" fill="#a8947a" transform="rotate(8 17.6 3.6)" />
      <ellipse cx="12.4" cy="3.8" rx="0.6" ry="3" fill="#e7b9b0" /><ellipse cx="17.6" cy="3.8" rx="0.6" ry="3" fill="#e7b9b0" />
      <circle cx="13.6" cy="9" r="0.7" fill="#1b1b1b" /><circle cx="16.4" cy="9" r="0.7" fill="#1b1b1b" />
      <circle cx="15" cy="11.4" r="0.7" fill="#c97b74" />
    </svg>
  );
}

function Bush({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="overflow-visible">
      <ellipse cx="20" cy="24" rx="17" ry="12" fill="#0b2415" opacity="0.2" transform="translate(2 3)" />
      <circle cx="12" cy="22" r="9" fill="#2f7a46" />
      <circle cx="26" cy="21" r="10" fill="#33854d" />
      <circle cx="19" cy="15" r="9.5" fill="#3a9355" />
      <circle cx="16" cy="12" r="3.4" fill="#9ed48f" opacity="0.5" />
      <circle cx="24" cy="24" r="1.2" fill="#e8553a" /><circle cx="14" cy="24" r="1.1" fill="#e8553a" /><circle cx="21" cy="19" r="1" fill="#e8553a" />
    </svg>
  );
}

/** Water on a green, kept very light: a soft cool mist and a gentle shine on the grass - no spray dots. */
function Sprinkler({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="-44 -44 88 88" className="overflow-visible">
      <defs>
        <radialGradient id="zh-mist" cx="0" cy="0" r="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d8efff" stopOpacity="0.32" />
          <stop offset="0.7" stopColor="#b4defa" stopOpacity="0.14" />
          <stop offset="1" stopColor="#b4defa" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="40" fill="url(#zh-mist)" style={{ animation: 'zh-wet 4.4s ease-in-out infinite' }} />
    </svg>
  );
}

function Peacock({ size }: { size: number }) {
  const feathers = [-62, -42, -22, 0, 22, 42, 62];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="overflow-visible">
      <g style={{ transformOrigin: '24px 28px', animation: 'zh-fan 9s ease-in-out infinite' }}>
        {feathers.map((a) => (
          <g key={a} transform={`rotate(${180 + a} 24 28)`}>
            <ellipse cx="24" cy="12" rx="3.1" ry="11" fill="#1d7a63" />
            <ellipse cx="24" cy="12" rx="1.1" ry="8" fill="#52b48a" opacity="0.7" />
            <circle cx="24" cy="3.2" r="2.4" fill="#2a5db0" />
            <circle cx="24" cy="3.2" r="1.1" fill="#e3c050" />
          </g>
        ))}
      </g>
      <ellipse cx="24" cy="26" rx="4.6" ry="7.4" fill="#1c6f94" />
      <ellipse cx="24" cy="24" rx="2.2" ry="4.6" fill="#2f95b8" opacity="0.8" />
      <circle cx="24" cy="16.6" r="3.1" fill="#1a5f82" />
      <path d="M22.4 14.6 q-1.6 -3 -0.4 -4.4 M24 14.2 q0 -3.6 0 -5 M25.6 14.6 q1.6 -3 0.4 -4.4" stroke="#1a5f82" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <circle cx="22.6" cy="9.8" r="0.9" fill="#e3c050" /><circle cx="24" cy="8.6" r="0.9" fill="#e3c050" /><circle cx="25.4" cy="9.8" r="0.9" fill="#e3c050" />
      <path d="M23.2 18.6 L24 20.8 L24.8 18.6 Z" fill="#e8a43a" />
    </svg>
  );
}

export function WildlifeLayer({ toScreen, zoom, upright, night = 0, safe = null, viewport }: { toScreen: (p: Pt) => number[]; zoom: number; upright?: CSSProperties; night?: number; safe?: { top: number; bottom: number; right: number; left: number } | null; viewport?: { width: number; height: number } }) {
  const [open, setOpen] = useState<string | null>(null);
  const atm = useAtmosphere();
  if (zoom < 1.35) return null;
  const k = Math.min(2, Math.max(0.9, zoom / 1.6)); // creatures grow a little as you zoom in
  const fade = Math.min(1, (zoom - 1.35) / 0.5);

  const at = (pt: Pt, node: ReactNode, key: string, z = 15) => {
    const [x, y] = toScreen(pt);
    // Nothing wanders behind the buttons, compass or cards.
    if (safe && viewport && !(y > safe.top && y < viewport.height - safe.bottom && x < viewport.width - safe.right && x > safe.left)) return null;
    return (
      <div key={key} className="absolute" style={{ left: x, top: y, zIndex: z, ...upright, transformOrigin: '0 0' }}>{node}</div>
    );
  };

  const Hit = ({ id, children, label }: { id: string; children: ReactNode; label: string }) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); setOpen((o) => (o === id ? null : id)); }}
      className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
    >{children}</button>
  );

  const bubble = (id: string, spot: keyof typeof SPOTS) => open === id && (
    <div className={`absolute bottom-full left-1/2 mb-2 w-52 -translate-x-1/2 rounded-2xl p-3 text-left ${lxIvory}`} style={{ animation: 'zh-bubble .25s ease-out both' }}>
      <div className={`${lxEyebrow} text-[#9a8450]`}>Zion Hills</div>
      <div className="font-serif text-[19px] font-semibold leading-tight text-[#13261c]">{SPOTS[spot].title}</div>
      <div className="mt-0.5 text-[12px] leading-snug text-[#5b5a4c]">{SPOTS[spot].text}</div>
    </div>
  );

  // The breeze: wind direction and strength from the live weather (a gentle south-westerly if it can't be reached).
  const windFrom = atm?.windDeg ?? 235;
  const windKmh = atm?.windKmh ?? 8;
  const flowDeg = ((windFrom + 180) % 360) - 90; // streaks travel along +x, so turn them to the wind's heading
  const streakSec = Math.max(7, Math.min(18, 17 - windKmh * 0.55));
  const STREAKS = [[8, 12], [30, 28], [55, 8], [72, 34], [14, 52], [44, 60], [66, 72], [24, 82], [82, 90], [50, 38]];

  return (
    <div className="zh-anim pointer-events-none absolute inset-0" style={{ opacity: fade }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: night > 0.5 ? 0.4 : 0.9 }}>
        {STREAKS.map(([lx, ty], n) => (
          <div key={n} className="absolute" style={{ left: `${lx}%`, top: `${ty}%`, transform: `rotate(${flowDeg}deg)` }}>
            <svg width="120" height="14" viewBox="0 0 120 14" className="overflow-visible" style={{ animation: `zh-streak ${streakSec + (n % 4)}s ease-in-out ${-n * 1.9}s infinite` }}>
              <path d="M0 7 C18 1 32 13 52 7 S92 1 108 7 Q116 10 112 4" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
        ))}
        {[[18, 22], [60, 46], [38, 70], [78, 18]].map(([lx, ty], n) => (
          <div key={`p${n}`} className="absolute" style={{ left: `${lx}%`, top: `${ty}%`, transform: `rotate(${flowDeg}deg)` }}>
            <span className="block h-2 w-3 rounded-[60%_0_60%_0] bg-[#f6d7e2]" style={{ animation: `zh-petal ${streakSec + 5 + n * 2}s linear ${-n * 3.4}s infinite` }} />
          </div>
        ))}
      </div>
      {/* groves: trees that sway, leaves that drift */}
      {GROVES.map((g) => at(g.pt, (
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ animation: `zh-sway ${4.4 + g.delay}s ease-in-out ${g.delay}s infinite`, transformOrigin: '50% 60%' }}>
          <Hit id={g.id} label="Shade grove"><Tree s={k * g.size * 1.05} /></Hit>
          <div className="pointer-events-none absolute left-1/2 top-1/2">
            <Leaf dx={20 * k} dy={30 * k} delay={g.delay} dur={5.5} />
            <Leaf dx={-16 * k} dy={26 * k} delay={g.delay + 2.4} dur={6.2} />
          </div>
          {open === g.id && <div className="pointer-events-none absolute left-1/2 top-0">{bubble(g.id, 'grove')}</div>}
        </div>
      ), g.id, 14))}

      {/* at night the birds roost and fireflies come out round the groves */}
      {night > 0.5 && GROVES.map((g) => at(g.pt, (
        <>
          {[0, 1, 2].map((n) => (
            <span key={n} className="absolute block h-1.5 w-1.5 rounded-full bg-[#e8ff8a] shadow-[0_0_8px_3px_rgba(214,255,120,0.75)]" style={{ left: (n - 1) * 14 * k, top: (n % 2 ? 8 : -6) * k, ['--fx' as string]: `${(n + 1) * 7 - 12}px`, ['--fy' as string]: `${-8 - n * 5}px`, animation: `zh-drift ${5 + n * 1.7}s ease-in-out ${-n * 1.9 - g.delay}s infinite` } as CSSProperties} />
          ))}
        </>
      ), `ff-${g.id}`, 18))}

      {night <= 0.5 && <>
      {/* hole 4: peacocks on the green, a small bird above */}
      {at([83.0, 77.6], (
        <>
          <div className="absolute" style={{ animation: 'zh-strut 24s ease-in-out infinite' }}>
            <div className="absolute -translate-x-1/2 -translate-y-1/2"><Hit id="peacock" label="Peacocks"><Peacock size={56 * k} /></Hit></div>
          </div>
          <div className="absolute" style={{ animation: 'zh-strut 31s ease-in-out -11s infinite', left: 22 * k, top: 20 * k }}>
            <div className="absolute -translate-x-1/2 -translate-y-1/2"><Hit id="peacock" label="Peacocks"><Peacock size={42 * k} /></Hit></div>
          </div>
          <div className="absolute left-0 top-0">{bubble('peacock', 'peacock')}</div>
        </>
      ), 'peacocks', 16)}
      {at([83.0, 77.6], (
        <div className="absolute" style={{ width: 0, height: 0, animation: 'zh-orbit 15s linear infinite' }}>
          <div style={{ transform: `translateY(${-58 * k}px) rotate(90deg)` }} className="absolute -translate-x-1/2 -translate-y-1/2">
            <Hit id="bird" label="Small bird"><Bird size={28 * k} body="#5a3b22" wing="#7a5632" head="#3f2a18" beak="#e8b04a" /></Hit>
          </div>
        </div>
      ), 'bird', 17)}
      {at([83.0, 77.6], <div className="absolute left-0 top-0">{bubble('bird', 'bird')}</div>, 'bird-bubble', 30)}

      {/* clubhouse: parrots circling the trees */}
      {[0, 1, 2].map((n) => at([39.9, 59.6], (
        <div className="absolute" style={{ width: 0, height: 0, animation: `zh-orbit ${13 + n * 3}s linear ${-n * 4.3}s ${n === 1 ? 'reverse' : 'normal'} infinite` }}>
          <div style={{ transform: `translateY(${-(38 + n * 13) * k}px) rotate(${n === 1 ? -90 : 90}deg)` }} className="absolute -translate-x-1/2 -translate-y-1/2">
            <Hit id="parrot" label="Parrots"><Bird size={(26 - n * 2) * k} body="#2fa44f" wing="#1f8a42" head="#d6322b" beak="#f2c04a" tail="#1f7a3c" /></Hit>
          </div>
        </div>
      ), `parrot-${n}`, 17))}
      {at([39.9, 59.6], <div className="absolute left-0 top-0">{bubble('parrot', 'parrot')}</div>, 'parrot-bubble', 30)}
      </>}

      {/* small birds flying round the golf course, and flocks crossing it */}
      {night <= 0.5 && COURSE_BIRDS.map((b, n) => at(b.pt, (
        <div className="absolute" style={{ width: 0, height: 0, animation: `zh-orbit ${b.sec}s linear ${b.delay}s ${b.rev ? 'reverse' : 'normal'} infinite` }}>
          <div style={{ transform: `translateY(${-b.r * k}px) rotate(${b.rev ? -90 : 90}deg)` }} className="absolute -translate-x-1/2 -translate-y-1/2">
            <Hit id={`songbird-${n}`} label="A small bird"><Bird size={(20 + (n % 3) * 2) * k} body={b.b} wing={b.w} head={b.h} beak={b.k} /></Hit>
          </div>
        </div>
      ), `cb-${n}`, 16))}
      {night <= 0.5 && COURSE_BIRDS.map((b, n) => open === `songbird-${n}` && at(b.pt, <div className="absolute left-0 top-0">{bubble(`songbird-${n}`, 'flock')}</div>, `cb-b-${n}`, 30))}
      {night <= 0.5 && FLOCKS.map((f, n) => at(f.pt, (
        <div className="absolute" style={{ animation: `zh-cross ${f.sec}s linear ${f.delay}s infinite` }}>
          {[[0, 0, 22], [-16, 10, 18], [-8, 22, 17]].map(([dx, dy, sz], i) => (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: dx * k, top: dy * k, transform: 'rotate(68deg)' }}>
              <Bird size={sz * k} body="#1f3a6e" wing="#2b4f94" head="#14264a" beak="#e8b04a" />
            </div>
          ))}
        </div>
      ), `flock-${n}`, 18))}

      {/* fish in the lakes: slow loops, ripples, and the odd leap */}
      {zoom >= 1.6 && FISH_SPOTS.map((f, n) => {
        const [x0] = toScreen([50, 50]), [x1] = toScreen([51, 50]);
        const pxPerPct = Math.abs(x1 - x0);
        const r = Math.max(7, Math.min(46, f.room * pxPerPct * 0.55));
        const sec = 15 + (n % 5) * 3;
        const size = (17 + (n % 3) * 3) * k;
        return at(f.pt, (
          <div style={{ opacity: night > 0.5 ? 0.55 : 1 }}>
            <span className="absolute left-0 top-0 block h-5 w-5 rounded-full border border-white/70" style={{ animation: `zh-ripple 4.2s ease-out ${-(n * 1.3) % 4}s infinite` }} />
            <div className="absolute" style={{ width: 0, height: 0, animation: `zh-orbit ${sec}s linear ${-n * 2.7}s ${n % 2 ? 'reverse' : 'normal'} infinite` }}>
              <div style={{ transform: `translateY(${-r}px) rotate(${n % 2 ? -90 : 90}deg)` }} className="absolute -translate-x-1/2 -translate-y-1/2">
                <div style={{ animation: `zh-leap ${9 + (n % 4) * 2}s ease-in-out ${-n * 1.7}s infinite` }}>
                  <Hit id={`fish-${n}`} label="Fish"><Fish size={size} tone={n} /></Hit>
                </div>
              </div>
            </div>
            {open === `fish-${n}` && <div className="absolute left-0 top-0">{bubble(`fish-${n}`, 'fish')}</div>}
          </div>
        ), `fish-${n}`, 13);
      })}

      {/* more peacocks: mango trees by the 12th, the 15th fairway */}
      {night <= 0.5 && PEACOCKS.map((pk, n) => at(pk.pt, (
        <div className="absolute" style={{ animation: `zh-strut ${27 + n * 6}s ease-in-out ${pk.delay}s infinite` }}>
          <div className="absolute -translate-x-1/2 -translate-y-1/2"><Hit id="peacock" label="Peacock"><Peacock size={46 * k} /></Hit></div>
        </div>
      ), `pk-${n}`, 16))}

      {/* kingfishers: perched on the bank, then a dive */}
      {night <= 0.5 && zoom >= 1.6 && KINGFISHERS.map((kf, n) => {
        const [x0] = toScreen([50, 50]), [x1] = toScreen([51, 50]);
        const ppp = Math.abs(x1 - x0);
        let dx = (kf.water[0] - kf.bank[0]) * ppp, dy = ((kf.water[1] - kf.bank[1]) * ppp) / 1.4137;
        const len = Math.hypot(dx, dy) || 1, cap = Math.min(len, 36 * k);
        dx = (dx / len) * cap; dy = (dy / len) * cap;
        const rot = (Math.atan2(dx, -dy) * 180) / Math.PI;
        const dur = 15, delay = -n * 4.6;
        return at(kf.bank, (
          <>
            <span className="absolute left-0 top-0 block h-5 w-5 rounded-full border border-white/80" style={{ left: dx, top: dy, animation: `zh-splash ${dur}s ease-out ${delay}s infinite` }} />
            <div className="absolute left-0 top-0" style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`, animation: `zh-dive ${dur}s ease-in-out ${delay}s infinite` } as CSSProperties}>
              <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(-50%, -50%) rotate(${rot}deg)` }}>
                <Hit id={`kingfisher-${n}`} label="Kingfisher"><Kingfisher size={22 * k} /></Hit>
              </div>
            </div>
            {open === `kingfisher-${n}` && <div className="absolute left-0 top-0">{bubble(`kingfisher-${n}`, 'kingfisher')}</div>}
          </>
        ), `kf-${n}`, 17);
      })}

      {/* turtles in the lakes: drifting, then under the surface and back up */}
      {zoom >= 1.7 && FISH_SPOTS.filter((_, i) => i % 3 === 1).map((f, n) => {
        const [x0] = toScreen([50, 50]), [x1] = toScreen([51, 50]);
        const r = Math.max(5, Math.min(26, f.room * Math.abs(x1 - x0) * 0.32));
        const sec = 34 + (n % 4) * 7, cyc = 18, delay = -n * 5.3;
        return at(f.pt, (
          <div style={{ opacity: night > 0.5 ? 0.5 : 1 }}>
            <span className="absolute left-0 top-0 block h-5 w-5 rounded-full border border-white/70" style={{ animation: `zh-splash ${cyc}s ease-out ${delay}s infinite` }} />
            <div className="absolute" style={{ width: 0, height: 0, animation: `zh-orbit ${sec}s linear ${-n * 7}s ${n % 2 ? 'normal' : 'reverse'} infinite` }}>
              <div style={{ transform: `translateY(${-r}px) rotate(${n % 2 ? 90 : -90}deg)` }} className="absolute -translate-x-1/2 -translate-y-1/2">
                <div style={{ animation: `zh-turtle ${cyc}s ease-in-out ${delay}s infinite` }}>
                  <Hit id={`turtle-${n}`} label="Turtle"><Turtle size={(19 + (n % 3) * 3) * k} /></Hit>
                </div>
              </div>
            </div>
            {open === `turtle-${n}` && <div className="absolute left-0 top-0">{bubble(`turtle-${n}`, 'turtle')}</div>}
          </div>
        ), `turtle-${n}`, 13);
      })}

      {/* a rabbit by the bushes: out for a nibble, then back inside */}
      {night <= 0.5 && zoom >= 1.9 && at([46.6, 50.8], (
        <>
          <div className="absolute left-0 top-0" style={{ animation: 'zh-rabbit 22s ease-in-out infinite' }}>
            <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ animation: 'zh-rabbit-turn 22s ease-in-out infinite' }}>
              <div style={{ animation: 'zh-bounce 0.7s ease-in-out infinite' }}>
                <Hit id="rabbit" label="Rabbit"><Rabbit size={24 * k} /></Hit>
              </div>
            </div>
          </div>
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ animation: 'zh-sway 7s ease-in-out infinite', transformOrigin: '50% 60%' }}><Bush size={40 * k} /></div>
          <div className="absolute left-0 top-0">{bubble('rabbit', 'rabbit')}</div>
        </>
      ), 'rabbit', 15)}

      {/* greens getting their water */}
      {zoom >= 1.7 && SPRINKLED.map((hn, n) => {
        const g = holeGuide(hn)?.green;
        if (!g) return null;
        return at(g, (
          <div style={{ animation: `zh-spray 26s ease-in-out ${-n * 6.5}s infinite` }}>
            <div className="absolute -translate-x-1/2 -translate-y-1/2">
              <Hit id={`spr-${n}`} label="Sprinkler"><Sprinkler size={64 * k} /></Hit>
            </div>
            {open === `spr-${n}` && <div className="absolute left-0 top-0">{bubble(`spr-${n}`, 'sprinkler')}</div>}
          </div>
        ), `spr-${n}`, 15);
      })}

      {night <= 0.5 && at([46.4, 37.4], (
        <>
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ animation: 'zh-sway 6s ease-in-out infinite' }}>
            <Hit id="egret" label="Egret Lake"><Bird size={28 * k} body="#f7f7f2" wing="#ffffff" head="#ffffff" beak="#e8b04a" tail="#e9e9e0" /></Hit>
          </div>
          <div className="absolute left-0 top-0">{bubble('egret', 'egret')}</div>
        </>
      ), 'egret', 17)}
    </div>
  );
}
