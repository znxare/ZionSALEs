import { useEffect, useState } from 'react';

// A welcome in the Zion Hills way: an orange pennant, like the flag in the logo, that slides in from the edge of
// the screen, stays a few seconds and slides away. Used for a named guest (#/map?guest=Name) and when someone
// really arrives at the gate. Nothing pops up for an ordinary visit: the logo opening is the welcome.

/** A guest's name from the link (#/map?guest=Rao), kept to plain letters. */
export function guestFromLink(): string | null {
  try {
    const m = /[?&]guest=([^&]+)/.exec(window.location.hash + window.location.search);
    if (!m) return null;
    const name = decodeURIComponent(m[1]).replace(/[^\p{L} .'-]/gu, '').trim().slice(0, 24);
    return name || null;
  } catch { return null; }
}

export function WelcomeGreeting({ eyebrow, title, onDone, ms = 5200 }: { eyebrow: string; title: string; onDone: () => void; ms?: number }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => { setGone(true); onDone(); }, ms);
    return () => window.clearTimeout(t);
  }, [ms, onDone]);
  if (gone) return null;
  return (
    <div className="pointer-events-none absolute left-0 top-[7.4rem] z-[58] sm:top-[8.2rem]" style={{ animation: `zh-pennant ${ms}ms cubic-bezier(.22,.8,.2,1) both` }} role="status">
      <div className="flex items-stretch drop-shadow-[0_8px_14px_rgba(38,35,31,0.3)]">
        <div className="w-[4px] rounded-full bg-[#26231f]" />
        <div
          className="bg-[#f05a22] py-2.5 pl-3.5 pr-9 text-white"
          style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 16px) 50%, 100% 100%, 0 100%)' }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">{eyebrow}</div>
          <div className="text-[19px] font-bold leading-tight tracking-tight">{title}</div>
        </div>
      </div>
    </div>
  );
}
