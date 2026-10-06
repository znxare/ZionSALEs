import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag, MapPinned, Navigation2, X, ZoomIn } from 'lucide-react';
import { COURSE_NOTE, HOLE_GUIDE, TEES, type HoleGuide } from '@/lib/holes';
import { lxEyebrow, lxIvory, lxOrange } from '@/lib/luxury';

// The card for one hole: its number, par, yardage from every tee, the green, and "Tee off here".

const parWord = (par: number) => (par === 3 ? 'Par 3' : par === 4 ? 'Par 4' : 'Par 5');

export function HoleCard({ hole, yards, onClose, onTeeOff, onShowOnMap, onPick, className = '' }: {
  hole: HoleGuide;
  /** Yards to the green from where the visitor is (only when they are on the hole). */
  yards: number | null;
  onClose: () => void;
  onTeeOff: () => void;
  onShowOnMap: () => void;
  onPick: (n: number) => void;
  className?: string;
}) {
  const [page, setPage] = useState(false);
  const [noGreen, setNoGreen] = useState(false);
  const longest = hole.yards[0];

  return (
    <div className={`pointer-events-auto max-h-[78dvh] animate-slide-up overflow-y-auto rounded-[26px] p-4 ${lxIvory} ${className}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#0f2118] font-serif text-[30px] font-bold leading-none text-[#f1d9a6] ring-[1.5px] ring-[#c9a96e]">{hole.n}</div>
        <div className="min-w-0 flex-1">
          <div className={`${lxEyebrow} text-[#9a8450]`}>Zion Hills Golf County</div>
          <div className="font-serif text-[28px] font-semibold leading-none text-[#13261c]">Hole {hole.n} <span className="text-[#d9480f]">&middot; {parWord(hole.par)}</span></div>
          <div className="mt-1 text-[12px] text-[#5b5a4c]">{longest} yards from the back tee &middot; green {hole.depth} yards deep</div>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[#8a7a52] hover:bg-[#c9a96e]/15"><X className="h-5 w-5" /></button>
      </div>

      {yards != null && (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#0f2118] px-4 py-2.5 text-[#f3ead3] ring-1 ring-[#c9a96e]/45">
          <div className="flex items-center gap-2"><Flag className="h-4 w-4 text-[#f26a35]" /><span className={`${lxEyebrow} text-[#e3c98d]`}>To the green</span></div>
          <div className="font-serif text-[30px] font-semibold leading-none">{Math.round(yards)}<span className="ml-1 text-[14px] font-medium text-[#e3c98d]">yd</span></div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {TEES.map((t, i) => (
          <div key={t.id} className="text-center">
            <div className="rounded-lg py-1.5 font-serif text-[17px] font-bold leading-none shadow-sm ring-1 ring-black/10" style={{ background: t.hex, color: t.ink }}>{hole.yards[i]}</div>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8a7a52]">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-3">
        {!noGreen && (
          <button onClick={() => setPage(true)} className="relative shrink-0" aria-label="Open the hole's yardage page">
            <img src={`/holes/h${hole.n}-green.webp`} alt={`The green on hole ${hole.n}`} onError={() => setNoGreen(true)} className="h-24 w-24 rounded-full object-cover ring-2 ring-[#c9a96e] shadow-md" />
            <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[#0f2118] text-[#f1d9a6] ring-1 ring-[#c9a96e]"><ZoomIn className="h-3.5 w-3.5" /></span>
          </button>
        )}
        <p className="text-[13px] leading-snug text-[#3f3f33]">{hole.description}</p>
      </div>

      <div className="mt-3.5 flex gap-2">
        <button onClick={onTeeOff} className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-[13px] font-semibold uppercase tracking-[0.16em] active:scale-[0.98] ${lxOrange}`}>
          <Navigation2 className="h-4 w-4" /> Tee off here
        </button>
        <button onClick={onShowOnMap} aria-label="Show the hole on the map" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#0f2118] text-[#f1d9a6] ring-1 ring-[#c9a96e]/60 active:scale-95"><MapPinned className="h-5 w-5" /></button>
      </div>

      <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-0.5">
        {HOLE_GUIDE.map((h) => (
          <button
            key={h.n}
            onClick={() => onPick(h.n)}
            aria-label={`Hole ${h.n}`}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-serif text-[14px] font-bold ${h.n === hole.n ? 'bg-[#d9480f] text-white' : 'bg-[#f3ecda] text-[#13261c] ring-1 ring-[#c9a96e]/40'}`}
          >
            {h.n}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[#8a7a52]">{COURSE_NOTE}</p>

      {page && createPortal(
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[#07120c]/85 p-3 backdrop-blur-sm" onClick={() => setPage(false)}>
          <img src={`/holes/h${hole.n}-page.webp`} alt={`Yardage book page for hole ${hole.n}`} className="max-h-[94dvh] max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-[#c9a96e]/60" />
          <button className="absolute right-4 top-4 rounded-full bg-[#0f2118] p-2 text-[#f1d9a6] ring-1 ring-[#c9a96e]" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>,
        document.body,
      )}
    </div>
  );
}
