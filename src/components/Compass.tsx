import { useSmoothedAngle } from '@/lib/smoothAngle';
import { cardinal } from '@/lib/compass';

// The map's compass: the needle points to north on screen. Tap to switch between
// "turn with the traveller" (heading up) and "north up". Shared by the tour and the public map.
export default function Compass({ rotation, headingUp, onToggle, top = 'top-16', facing = null, weak = false }: { rotation: number; headingUp: boolean; onToggle: () => void; top?: string; /** The compass sensor is unsure: ask the person to wave the phone in a figure 8. */ weak?: boolean; /** The way the traveller is facing, in compass degrees (shown as "Facing NE"). */ facing?: number | null }) {
  // Turns with the same smoothing as the map itself, so the needle and the map never disagree.
  const shown = useSmoothedAngle(rotation);
  return (
    <button
      onClick={() => { try { navigator.vibrate?.(8); } catch { /* not supported */ } onToggle(); }}
      aria-label={headingUp ? 'Show north up' : 'Turn the map with your direction of travel'}
      className={`absolute right-3 ${top} z-40 flex flex-col items-center gap-0.5 p-1 pb-1.5 sm:gap-1 sm:p-1.5 active:scale-95 sm:right-5`}
    >
      <svg viewBox="0 0 48 48" className="h-10 w-10 sm:h-12 sm:w-12" style={{ transform: `rotate(${-shown}deg)` }}>
        <circle cx="24" cy="24" r="22.4" fill="#fbf8f1" fillOpacity="0.42" stroke="#26231f" strokeOpacity="0.5" strokeWidth="1.1" />
        <circle cx="24" cy="24" r="19" fill="none" stroke="#26231f" strokeOpacity="0.12" strokeWidth="0.7" />
        {Array.from({ length: 24 }, (_, i) => i).filter((i) => i % 6 !== 0).map((i) => {
          const a = (i * 15 * Math.PI) / 180;
          const long = i % 2 === 0;
          const r1 = 22.4, r2 = long ? 19.6 : 20.9;
          return <line key={i} x1={24 + r1 * Math.sin(a)} y1={24 - r1 * Math.cos(a)} x2={24 + r2 * Math.sin(a)} y2={24 - r2 * Math.cos(a)} stroke="#26231f" strokeOpacity={long ? 0.55 : 0.3} strokeWidth={long ? 1 : 0.7} strokeLinecap="round" />;
        })}
        <text x="24" y="10.4" textAnchor="middle" fontSize="7" fontWeight="800" fill="#d9480f" fontFamily="Plus Jakarta Sans, sans-serif">N</text>
        <text x="40.4" y="26.6" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#26231f" fillOpacity="0.7" fontFamily="Plus Jakarta Sans, sans-serif">E</text>
        <text x="24" y="42.6" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#26231f" fillOpacity="0.7" fontFamily="Plus Jakarta Sans, sans-serif">S</text>
        <text x="7.6" y="26.6" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#26231f" fillOpacity="0.7" fontFamily="Plus Jakarta Sans, sans-serif">W</text>
        <path d="M24 13.4 L27 24 L21 24 Z" fill="#f05a22" />
        <path d="M24 34.6 L27 24 L21 24 Z" fill="#26231f" fillOpacity="0.85" />
        <circle cx="24" cy="24" r="2.2" fill="#fbf8f1" stroke="#26231f" strokeWidth="1.1" />
      </svg>
      <span className="px-1 text-[9px] font-bold uppercase leading-tight tracking-[0.14em] text-[#26231f] [text-shadow:0_0_6px_rgba(255,252,240,0.95),0_0_2px_rgba(255,252,240,0.9)] sm:text-[10px] sm:tracking-[0.16em]">{headingUp ? 'Heading up' : 'North up'}</span>
      {facing != null && <span className="text-[10px] font-bold leading-none tracking-wide text-[#c2410c] [text-shadow:0_0_6px_rgba(255,252,240,0.95),0_0_2px_rgba(255,252,240,0.9)]">Facing {cardinal(facing)} {Math.round(((facing % 360) + 360) % 360)}°</span>}
      {weak && <span className="max-w-[84px] text-center text-[8.5px] font-semibold leading-tight text-[#a3241c] [text-shadow:0_0_6px_rgba(255,252,240,0.95),0_0_2px_rgba(255,252,240,0.9)]">Wave phone in a figure 8</span>}
    </button>
  );
}
