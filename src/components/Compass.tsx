import { useSmoothedAngle } from '@/lib/smoothAngle';
import { cardinal } from '@/lib/compass';

// The map's compass: the needle points to north on screen. Tap to switch between
// "turn with the traveller" (heading up) and "north up". Shared by the tour and the public map.
export default function Compass({ rotation, headingUp, onToggle, top = 'top-16', facing = null, weak = false }: { rotation: number; headingUp: boolean; onToggle: () => void; top?: string; /** The compass sensor is unsure: ask the person to wave the phone in a figure 8. */ weak?: boolean; /** The way the traveller is facing, in compass degrees (shown as "Facing NE"). */ facing?: number | null }) {
  // Turns with the same smoothing as the map itself, so the needle and the map never disagree.
  const shown = useSmoothedAngle(rotation);
  return (
    <button
      onClick={onToggle}
      aria-label={headingUp ? 'Show north up' : 'Turn the map with your direction of travel'}
      className={`absolute right-3 ${top} z-40 flex flex-col items-center gap-1 rounded-[20px] bg-[#fbf7ee]/[0.97] p-1.5 pb-1.5 shadow-[0_14px_30px_-10px_rgba(70,48,12,0.45)] ring-1 ring-[#c9a96e]/[0.55] backdrop-blur-xl active:scale-95 sm:right-5`}
    >
      <svg viewBox="0 0 48 48" className="h-12 w-12" style={{ transform: `rotate(${-shown}deg)` }}>
        <defs>
          <radialGradient id="compass-face" cx="50%" cy="40%" r="60%">
            <stop offset="0" stopColor="#fffcf4" />
            <stop offset="1" stopColor="#ece1c6" />
          </radialGradient>
          <linearGradient id="compass-north" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0.5" stopColor="#f26a35" />
            <stop offset="0.5" stopColor="#c2410c" />
          </linearGradient>
          <linearGradient id="compass-south" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0.5" stopColor="#3b4a3f" />
            <stop offset="0.5" stopColor="#13261c" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="22.5" fill="url(#compass-face)" stroke="#c9a96e" strokeWidth="1.2" />
        {/* Ticks every 30°, longer at E/S/W (north has its letter). */}
        {Array.from({ length: 12 }, (_, i) => i).filter((i) => i !== 0).map((i) => {
          const major = i % 3 === 0;
          const a = (i * 30 * Math.PI) / 180;
          const r1 = 20.5, r2 = major ? 17 : 18.8;
          return <line key={i} x1={24 + r1 * Math.sin(a)} y1={24 - r1 * Math.cos(a)} x2={24 + r2 * Math.sin(a)} y2={24 - r2 * Math.cos(a)} stroke={major ? '#8a7a52' : '#d6c79c'} strokeWidth={major ? 1.4 : 1} strokeLinecap="round" />;
        })}
        <text x="24" y="10.6" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#d9480f">N</text>
        <path d="M24 12.5 L27.2 24 L20.8 24 Z" fill="url(#compass-north)" />
        <path d="M24 35.5 L27.2 24 L20.8 24 Z" fill="url(#compass-south)" />
        <circle cx="24" cy="24" r="2.3" fill="#fbf7ee" stroke="#13261c" strokeWidth="1.2" />
      </svg>
      <span className="rounded-full bg-[#13261c] px-2 py-0.5 text-[9px] font-semibold uppercase leading-tight tracking-[0.14em] text-[#e9d8aa]">{headingUp ? 'Heading up' : 'North up'}</span>
      {facing != null && <span className="text-[10px] font-bold leading-none tracking-wide text-[#d9480f]">Facing {cardinal(facing)} {Math.round(((facing % 360) + 360) % 360)}°</span>}
      {weak && <span className="max-w-[84px] text-center text-[8.5px] font-semibold leading-tight text-[#a3241c]">Wave phone in a figure 8</span>}
    </button>
  );
}
