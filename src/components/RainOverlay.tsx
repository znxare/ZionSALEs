// Rain falling over the map, only when the weather feed says it is raining: soft streaks in two layers,
// a grey wash, nothing that gets in the way of the buttons (it sits under them).

const TILE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cg stroke='rgba(228,240,252,0.7)' stroke-width='1.1' stroke-linecap='round'%3E%3Cpath d='M12 4v22M44 44v20M80 14v24M104 74v20M26 84v22M62 98v20M92 52v16'/%3E%3C/g%3E%3C/svg%3E\")";

export function RainOverlay({ level }: { level: number }) {
  if (level <= 0.02) return null;
  return (
    <div className="zh-anim pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden style={{ opacity: Math.min(1, level + 0.1), transition: 'opacity 2s ease' }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(rgba(70,90,110,0.12), rgba(70,90,110,0.2))' }} />
      <div className="absolute -inset-[30%]" style={{ transform: 'rotate(9deg)' }}>
        <div className="absolute inset-0" style={{ backgroundImage: TILE, backgroundSize: '120px 120px', animation: 'zh-rain 0.6s linear infinite', opacity: 0.75 }} />
        <div className="absolute inset-0" style={{ backgroundImage: TILE, backgroundSize: '84px 84px', backgroundPosition: '40px 20px', animation: 'zh-rain-b 0.85s linear infinite', opacity: 0.45 }} />
      </div>
    </div>
  );
}
