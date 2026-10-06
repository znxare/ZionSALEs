import { useEffect, useState } from 'react';
import { lxEyebrow } from '@/lib/luxury';

// The opening line of the public map: a greeting that follows the time of day (estate time), fading in over
// the map as it glides in to the main gate, and again when a visitor actually arrives.

/** "Good morning", "Good afternoon" or "Good evening" for estate time. */
export function greetingFor(now: Date = new Date()): string {
  let hour = now.getHours();
  try { hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(now)); } catch { /* the phone's own clock */ }
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

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
    <div
      className="pointer-events-none absolute inset-x-0 top-[24%] z-[58] flex justify-center px-6"
      style={{ animation: `zh-welcome ${ms}ms ease-in-out both` }}
      role="status"
    >
      <div className="rounded-[26px] bg-[#0f2118]/[0.82] px-7 py-5 text-center text-[#f3ead3] shadow-[0_24px_60px_-16px_rgba(5,14,9,0.7)] ring-1 ring-[#c9a96e]/[0.55] backdrop-blur-xl">
        <div className={`${lxEyebrow} text-[#e3c98d]`}>{eyebrow}</div>
        <div className="mx-auto my-2 h-px w-14 bg-gradient-to-r from-transparent via-[#c9a96e] to-transparent" />
        <div className="font-serif text-[34px] font-semibold leading-[1.05] sm:text-[40px]">{title}</div>
      </div>
    </div>
  );
}
