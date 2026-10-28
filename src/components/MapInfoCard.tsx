import { Sun, Moon, Cloud, CloudSun, CloudMoon, CloudRain, CloudLightning, CloudFog, Sunset, Sunrise, type LucideIcon } from 'lucide-react';
import { clockTime, feelsWord, skyWord, useAtmosphere } from '@/lib/mapInfo';

// The public map's bottom card: the weather at the estate right now and the sunset time
// (sunrise once the sun has gone down). Nothing else.

function skyIcon(code: number, isDay: boolean): LucideIcon {
  if (code === 0) return isDay ? Sun : Moon;
  if (code <= 2) return isDay ? CloudSun : CloudMoon;
  if (code === 3) return Cloud;
  if (code >= 45 && code <= 48) return CloudFog;
  if (code >= 95) return CloudLightning;
  if (code >= 51) return CloudRain;
  return Cloud;
}

export function MapInfoCard({ className = '' }: { className?: string }) {
  const a = useAtmosphere();
  if (!a) return null;
  const Sky = skyIcon(a.code, a.isDay);
  const now = Date.now();
  const sunGone = !!a.sunset && now > a.sunset.getTime();
  const sunTime = sunGone ? a.sunrise && new Date(a.sunrise.getTime() + 864e5) : a.sunset;
  const SunIcon = sunGone ? Sunrise : Sunset;

  return (
    <div data-dock="left" className={`pointer-events-auto [@media(max-height:460px)]:hidden ${className}`}>
      <div className="flex animate-slide-up items-stretch overflow-hidden rounded-[22px] bg-[#fbf8f1]/[0.97] text-[#26231f] shadow-[0_14px_34px_-14px_rgba(38,35,31,0.45)] ring-1 ring-black/[0.06]">
        <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${a.isDay ? 'bg-gradient-to-br from-[#ffd9bf] to-[#f7a46f] text-[#b4400f]' : 'bg-gradient-to-br from-[#2c3a52] to-[#16203a] text-[#e8e2cf]'}`}>
            <Sky className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-[30px] font-semibold leading-none tabular-nums">{Math.round(a.tempC)}°</span>
              <span className="truncate text-[12px] font-semibold text-[#8a6a4a]">{feelsWord(a.feelsC)}</span>
            </div>
            <div className="mt-0.5 truncate text-[12px] text-[#5b5a4c]">{skyWord(a.code, a.isDay)} · feels {Math.round(a.feelsC)}°</div>
          </div>
        </div>
        {sunTime && (
          <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-[#e3d8c2]/80 bg-[#f6efe0]/70 px-3.5">
            <SunIcon className="h-5 w-5 text-[#d9480f]" strokeWidth={1.8} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a6a4a]">{sunGone ? 'Sunrise' : 'Sunset'}</span>
            <span className="text-[13px] font-bold tabular-nums leading-none">{clockTime(sunTime)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
