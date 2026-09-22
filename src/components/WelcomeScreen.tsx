import { useEffect, useState } from 'react';
import type { CurrentUser } from '@/lib/auth';
import { greetingForNow } from '@/lib/crm';
import { usePrefersReducedMotion } from '@/lib/hooks';

const HOLD_MS = 1900;
const FADE_MS = 450;

/** Full-screen "Welcome, {name}" moment shown once, right after an active sign-in — never on a page reload with an existing session. */
export default function WelcomeScreen({ user, onDone }: { user: CurrentUser; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const firstName = user.full_name.trim().split(/\s+/)[0] || user.full_name;
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      onDone();
      return;
    }
    const leaveTimer = setTimeout(() => setLeaving(true), HOLD_MS);
    const doneTimer = setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => { clearTimeout(leaveTimer); clearTimeout(doneTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  function skip() {
    setLeaving(true);
    setTimeout(onDone, FADE_MS);
  }

  return (
    <div
      onClick={skip}
      className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center overflow-hidden brand-gradient transition-opacity"
      style={{ opacity: leaving ? 0 : 1, transitionDuration: FADE_MS + 'ms' }}
    >
      <div className="bg-dot-pattern pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative px-6 text-center">
        <p
          className="animate-fade-up text-sm font-medium tracking-wide text-orange-100/80"
          style={{ animationDelay: '80ms' }}
        >
          {greetingForNow()}
        </p>
        <h1
          className="animate-fade-up mt-2 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl"
          style={{ animationDelay: '200ms' }}
        >
          Welcome, {firstName}
        </h1>
        <p
          className="animate-fade-up mt-3 text-sm text-orange-100/70"
          style={{ animationDelay: '420ms' }}
        >
          Zion Hills CRM
        </p>
      </div>
    </div>
  );
}
