import { useState, type CSSProperties, type ReactNode } from 'react';
import { lxEyebrow, lxIvory } from '@/lib/luxury';

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
  peacock: { title: 'Peacock Green', text: 'Peacocks wander onto the 4th green at first light. Come and watch them strut.' },
  bird: { title: 'Over the 4th', text: 'Small birds wheel over the green and its trees, all day long.' },
  parrot: { title: 'Parrot perch', text: 'Parrots chatter in the trees around the clubhouse — listen as you arrive.' },
  egret: { title: 'Egret Lake', text: 'An egret keeps watch over the water, always at a safe distance.' },
};

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

export function WildlifeLayer({ toScreen, zoom, upright, night = 0 }: { toScreen: (p: Pt) => number[]; zoom: number; upright?: CSSProperties; night?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  if (zoom < 1.35) return null;
  const k = Math.min(2, Math.max(0.9, zoom / 1.6)); // creatures grow a little as you zoom in
  const fade = Math.min(1, (zoom - 1.35) / 0.5);

  const at = (pt: Pt, node: ReactNode, key: string, z = 15) => {
    const [x, y] = toScreen(pt);
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

  return (
    <div className="zh-anim pointer-events-none absolute inset-0" style={{ opacity: fade }}>
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
            <div className="absolute -translate-x-1/2 -translate-y-1/2"><Hit id="peacock" label="Peacock Green"><Peacock size={56 * k} /></Hit></div>
          </div>
          <div className="absolute" style={{ animation: 'zh-strut 31s ease-in-out -11s infinite', left: 22 * k, top: 20 * k }}>
            <div className="absolute -translate-x-1/2 -translate-y-1/2"><Hit id="peacock" label="Peacock Green"><Peacock size={42 * k} /></Hit></div>
          </div>
          <div className="absolute left-0 top-0">{bubble('peacock', 'peacock')}</div>
          {zoom >= 2 && (
            <div className="pointer-events-none absolute left-1/2 top-9 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#fbf7ee]/[0.9] px-2.5 py-0.5 font-serif text-[13px] font-semibold italic text-[#13261c] ring-1 ring-[#c9a96e]/50">Peacock Green</div>
          )}
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
