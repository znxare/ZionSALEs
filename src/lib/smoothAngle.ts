import { useEffect, useRef, useState } from 'react';

// One steady way to turn a rotating thing (the map, the compass, the heading beam) towards
// a target angle that keeps changing: small changes are followed continuously at a fixed
// time constant (so a stream of sensor readings looks like one smooth motion), and a big
// swing (switching to north-up, for instance) eases in and out.

const FOLLOW_SECONDS = 0.16;
const BIG_SWING = 45;
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** `target` is in degrees and may run past 360 (keep it "unwrapped" so it never spins the long way round). */
export function useSmoothedAngle(target: number): number {
  const [shown, setShown] = useState(target);
  const cur = useRef(target);
  const tgt = useRef(target);
  const raf = useRef(0);

  useEffect(() => {
    tgt.current = target;
    window.cancelAnimationFrame(raf.current);
    const delta = target - cur.current;
    if (Math.abs(delta) < 0.01) return;

    if (Math.abs(delta) > BIG_SWING) {
      const from = cur.current;
      const ms = Math.min(1500, 450 + Math.abs(delta) * 8);
      const start = performance.now();
      const swing = (now: number) => {
        const k = Math.min(1, (now - start) / ms);
        cur.current = from + (tgt.current - from) * easeInOut(k);
        setShown(cur.current);
        if (k < 1) raf.current = window.requestAnimationFrame(swing);
      };
      raf.current = window.requestAnimationFrame(swing);
      return () => window.cancelAnimationFrame(raf.current);
    }

    let last = performance.now();
    const follow = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const d = tgt.current - cur.current;
      cur.current = Math.abs(d) < 0.02 ? tgt.current : cur.current + d * (1 - Math.exp(-dt / FOLLOW_SECONDS));
      setShown(cur.current);
      if (cur.current !== tgt.current) raf.current = window.requestAnimationFrame(follow);
    };
    raf.current = window.requestAnimationFrame(follow);
    return () => window.cancelAnimationFrame(raf.current);
  }, [target]);

  return shown;
}

/** Keeps an angle "unwrapped" (350 -> 370, not 350 -> 10) so it takes the short way round. */
export function unwrapInto(prev: number, deg: number): number {
  return prev + ((((deg - prev) % 360) + 540) % 360) - 180;
}
