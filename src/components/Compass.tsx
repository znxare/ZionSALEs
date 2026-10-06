// The map's compass: the needle points to north on screen. Tap to switch between
// "turn with the traveller" (heading up) and "north up". Shared by the tour and the public map.
export default function Compass({ rotation, headingUp, onToggle, top = 'top-16' }: { rotation: number; headingUp: boolean; onToggle: () => void; top?: string }) {
  return (
    <button
      onClick={onToggle}
      aria-label={headingUp ? 'Show north up' : 'Turn the map with your direction of travel'}
      className={`absolute right-3 ${top} z-40 flex flex-col items-center gap-1 rounded-2xl bg-white/95 p-1.5 pb-1.5 shadow-lg ring-1 ring-black/5 backdrop-blur active:scale-95 sm:right-5`}
    >
      <svg viewBox="0 0 48 48" className="h-12 w-12" style={{ transform: `rotate(${-rotation}deg)`, transition: 'transform 0.9s linear' }}>
        <defs>
          <radialGradient id="compass-face" cx="50%" cy="40%" r="60%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#eef0f2" />
          </radialGradient>
          <linearGradient id="compass-north" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0.5" stopColor="#ef4444" />
            <stop offset="0.5" stopColor="#b91c1c" />
          </linearGradient>
          <linearGradient id="compass-south" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0.5" stopColor="#cbd5e1" />
            <stop offset="0.5" stopColor="#94a3b8" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="22.5" fill="url(#compass-face)" stroke="#d1d5db" strokeWidth="1" />
        {/* Ticks every 30°, longer at E/S/W (north has its letter). */}
        {Array.from({ length: 12 }, (_, i) => i).filter((i) => i !== 0).map((i) => {
          const major = i % 3 === 0;
          const a = (i * 30 * Math.PI) / 180;
          const r1 = 20.5, r2 = major ? 17 : 18.8;
          return <line key={i} x1={24 + r1 * Math.sin(a)} y1={24 - r1 * Math.cos(a)} x2={24 + r2 * Math.sin(a)} y2={24 - r2 * Math.cos(a)} stroke={major ? '#6b7280' : '#c4c9d0'} strokeWidth={major ? 1.4 : 1} strokeLinecap="round" />;
        })}
        <text x="24" y="10.6" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#dc2626">N</text>
        <path d="M24 12.5 L27.2 24 L20.8 24 Z" fill="url(#compass-north)" />
        <path d="M24 35.5 L27.2 24 L20.8 24 Z" fill="url(#compass-south)" />
        <circle cx="24" cy="24" r="2.3" fill="white" stroke="#475569" strokeWidth="1.2" />
      </svg>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold leading-tight text-gray-700">{headingUp ? 'Heading up' : 'North up'}</span>
    </button>
  );
}
