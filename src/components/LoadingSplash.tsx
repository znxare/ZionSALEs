import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// The opening of the public map: the Zion Hills logo on warm paper (index.html shows the very same picture before
// any code has loaded, so there is no flash). When the plan has drawn, the logo does not vanish: it glides up
// into its place in the corner while the paper lifts away and the map is revealed underneath.

export function LoadingSplash({ done, targetId = 'map-logo' }: { done: boolean; targetId?: string }) {
  const logo = useRef<HTMLImageElement>(null);
  const [fly, setFly] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  useLayoutEffect(() => {
    if (!done || !logo.current) return;
    const from = logo.current.getBoundingClientRect();
    const to = document.getElementById(targetId)?.getBoundingClientRect();
    if (!to || to.width === 0) { setFly('none'); return; }
    const s = to.width / from.width;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    setFly(`translate(${dx}px, ${dy}px) scale(${s})`);
  }, [done, targetId]);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setGone(true), 1500);
    return () => window.clearTimeout(t);
  }, [done]);

  if (gone) return null;
  return (
    <div className="fixed inset-0 z-[70]" style={{ pointerEvents: done ? 'none' : 'auto' }} aria-hidden={done}>
      <div className="absolute inset-0 bg-[#f6f1e7]" style={{ opacity: done ? 0 : 1, transition: 'opacity 900ms ease 350ms' }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <img
          ref={logo}
          src="/zion-hills-logo.svg"
          alt="Zion Hills Golf County"
          className="h-16 w-auto sm:h-20"
          style={{ transform: fly ?? undefined, transition: fly ? 'transform 1100ms cubic-bezier(.65,0,.2,1)' : undefined, willChange: 'transform' }}
        />
        <div className="mt-6 h-[2px] w-24 overflow-hidden rounded-full bg-[#f05a22]/[0.18]" style={{ opacity: done ? 0 : 1, transition: 'opacity 300ms ease' }}>
          <div className="h-full w-full origin-left rounded-full bg-[#f05a22]" style={{ animation: 'zh-progress 1.5s ease-in-out infinite alternate' }} />
        </div>
      </div>
    </div>
  );
}
