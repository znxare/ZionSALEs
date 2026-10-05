import { useEffect, useState } from 'react';

/**
 * Cinematic opening for a buyer: their name over a slow drift across the
 * estate, then it fades away to reveal the map behind. Tap to skip.
 */
export function WelcomeIntro({ guest, image, onDone }: { guest: string; image?: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), 5200);
    const t2 = window.setTimeout(onDone, 6600);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      onClick={() => { setLeaving(true); window.setTimeout(onDone, 700); }}
      className={`absolute inset-0 z-[70] cursor-pointer overflow-hidden bg-[#0d1c14] transition-opacity duration-[1400ms] ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      <img
        src={image || '/master-plan/l1.webp'}
        alt=""
        className={`absolute inset-0 h-full w-full animate-hero-zoom object-cover ${image ? 'opacity-70' : 'opacity-40 blur-[2px]'}`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(13,28,20,0.35)_0%,rgba(13,28,20,0.85)_75%)]" />
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center text-white">
        <div className="animate-lux-rise text-[12px] uppercase tracking-[0.45em] text-[#e9dcc0] sm:text-sm" style={{ animationDelay: '300ms' }}>
          Welcome to
        </div>
        <div className="mt-3 animate-lux-rise font-lux text-6xl font-medium tracking-[0.12em] sm:text-8xl" style={{ animationDelay: '900ms' }}>
          ZION HILLS
        </div>
        <div className="mt-3 h-px w-20 animate-lux-rise bg-[#c9a96e]" style={{ animationDelay: '1500ms' }} />
        {guest && (
          <div className="mt-6 animate-lux-rise font-lux text-3xl italic text-white/90 sm:text-5xl" style={{ animationDelay: '2100ms' }}>
            {guest}
          </div>
        )}
        <div className="absolute bottom-8 animate-lux-rise text-[11px] uppercase tracking-[0.3em] text-white/40" style={{ animationDelay: '3200ms' }}>
          Golf County
        </div>
      </div>
    </div>
  );
}
