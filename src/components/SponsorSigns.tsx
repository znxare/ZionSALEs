import { useState, type CSSProperties } from 'react';
import { COURSE_SPONSORS, SPONSOR_BOARD_AT, type CourseSponsor } from '@/lib/sponsors';
import { holeGuide } from '@/lib/holes';
import { lxEyebrow, lxIvory } from '@/lib/luxury';

// Course sponsors, as part of the course: a small tee-box sign at each sponsored hole, and a board by the
// main gate that lists them all. Small, calm, and quiet until you zoom in.

type Pt = [number, number];

function Logo({ s, w, h }: { s: CourseSponsor; w: number; h: number }) {
  return <img src={s.logo} alt={s.name} draggable={false} loading="lazy" decoding="async" className="select-none object-contain" style={{ width: w, height: h }} />;
}

export function SponsorSigns({ toScreen, zoom, upright, safe, viewport }: {
  toScreen: (p: Pt) => number[];
  zoom: number;
  upright?: CSSProperties;
  safe?: { top: number; bottom: number; right: number; left: number } | null;
  viewport?: { width: number; height: number };
}) {
  const [open, setOpen] = useState<string | null>(null);
  const clear = (x: number, y: number) => !safe || !viewport || (y > safe.top && y < viewport.height - safe.bottom && x < viewport.width - safe.right && x > safe.left);
  const k = Math.min(1.5, Math.max(0.85, zoom / 2.4));
  const showTees = zoom >= 2.0;
  const showBoard = zoom >= 1.45;

  const press = (id: string) => ({
    onPointerDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); setOpen((o) => (o === id ? null : id)); },
  });

  const bubble = (id: string, title: string, line: string) => open === id && (
    <div className={`absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 rounded-2xl p-3 text-left ${lxIvory}`} style={{ animation: 'zh-bubble .25s ease-out both' }}>
      <div className={`${lxEyebrow} text-[#9a8450]`}>Course sponsor</div>
      <div className="font-serif text-[19px] font-semibold leading-tight text-[#13261c]">{title}</div>
      <div className="mt-0.5 text-[12px] leading-snug text-[#5b5a4c]">{line}</div>
    </div>
  );

  const [bx, by] = toScreen(SPONSOR_BOARD_AT);

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 14 }}>
      {showTees && COURSE_SPONSORS.map((s) => {
        const tee = holeGuide(s.hole)?.tee;
        if (!tee) return null;
        const [x, y] = toScreen(tee);
        if (!clear(x, y)) return null;
        const w = 56 * k, h = 34 * k;
        return (
          <div key={s.id} className="absolute" style={{ left: x, top: y, zIndex: open === s.id ? 20 : 14, ...upright, transformOrigin: '0 0' }}>
            <div className="absolute -translate-x-1/2 -translate-y-full" style={{ marginTop: 2 }}>
              <button
                type="button"
                aria-label={`${s.name}, course sponsor, hole ${s.hole}`}
                {...press(s.id)}
                className="pointer-events-auto relative block"
              >
                {bubble(s.id, s.name, `Presents hole ${s.hole}.`)}
                <span className="block rounded-[5px] bg-[#0f2118] p-[2.5px] shadow-[0_6px_10px_-4px_rgba(5,14,9,0.7)] ring-[1px] ring-[#c9a96e]" style={{ width: w, height: h }}>
                  <span className="grid h-full w-full place-items-center rounded-[3px] bg-[#fbf7ee]" style={{ padding: 3 * k }}>
                    <Logo s={s} w={w - 12 * k} h={h - 12 * k} />
                  </span>
                </span>
                <span className="mx-auto block h-[9px] w-[2px] bg-[#c9a96e]" style={{ height: 9 * k }} />
                <span className="mx-auto block h-[4px] w-[10px] rounded-full bg-black/25 blur-[1px]" />
              </button>
            </div>
          </div>
        );
      })}

      {showBoard && clear(bx, by) && (
        <div className="absolute" style={{ left: bx, top: by, zIndex: open === 'board' ? 20 : 14, ...upright, transformOrigin: '0 0' }}>
          <div className="absolute -translate-x-1/2 -translate-y-full" style={{ marginTop: 2 }}>
            <button type="button" aria-label="Course sponsors" {...press('board')} className="pointer-events-auto relative block text-left">
              {bubble('board', 'Our course sponsors', COURSE_SPONSORS.map((s) => s.name).join(' · '))}
              <span className="block rounded-[6px] bg-[#0f2118] p-[3px] shadow-[0_10px_14px_-6px_rgba(5,14,9,0.7)] ring-[1px] ring-[#c9a96e]" style={{ width: 150 * k }}>
                <span className="block text-center font-semibold uppercase text-[#e3c98d]" style={{ fontSize: 6.2 * k, letterSpacing: '0.24em', padding: `${2.5 * k}px 0 ${3 * k}px` }}>Course sponsors</span>
                <span className="grid grid-cols-2 gap-[2px] rounded-[3px] bg-[#c9a96e]/[0.5] p-[2px]">
                  {COURSE_SPONSORS.map((s) => (
                    <span key={s.id} className="grid place-items-center rounded-[2px] bg-[#fbf7ee]" style={{ height: 24 * k, padding: 2.5 * k }}>
                      <Logo s={s} w={64 * k} h={19 * k} />
                    </span>
                  ))}
                </span>
              </span>
              <span className="mx-auto flex justify-between" style={{ width: 100 * k }}>
                <span className="block w-[2px] bg-[#c9a96e]" style={{ height: 8 * k }} />
                <span className="block w-[2px] bg-[#c9a96e]" style={{ height: 8 * k }} />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
