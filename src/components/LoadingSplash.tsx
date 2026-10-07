import { useEffect, useState } from 'react';

// The first second of the public map: the Zion Hills logo on ivory with a thin gold line, until the plan has
// drawn. (index.html shows the same picture before any code has loaded, so there is no flash between them.)

export function LoadingSplash({ done }: { done: boolean }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setGone(true), 800);
    return () => window.clearTimeout(t);
  }, [done]);
  if (gone) return null;
  return (
    <div
      aria-hidden={done}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#fbf7ee]"
      style={{ opacity: done ? 0 : 1, transition: 'opacity 700ms ease', pointerEvents: done ? 'none' : 'auto' }}
    >
      <img src="/zion-hills-logo.svg" alt="Zion Hills Golf County" className="h-16 w-auto sm:h-20" />
      <div className="mt-6 h-px w-28 overflow-hidden bg-[#c9a96e]/[0.3]">
        <div className="h-full w-full origin-left bg-[#c9a96e]" style={{ animation: 'zh-progress 1.6s ease-in-out infinite alternate' }} />
      </div>
      <div className="mt-3 font-serif text-[15px] italic text-[#7a6830]">The Estate Map</div>
    </div>
  );
}
