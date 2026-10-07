import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Home, Sun, Wind, ThermometerSun, Sunset, Landmark, Waves, Smile, Sparkles, X, ChevronRight } from 'lucide-react';
import { SAMPLE_PLOTS } from '@/lib/inventory';
import { lxEyebrow, lxIvory, lxOrange } from '@/lib/luxury';
import { COURSE_SPONSORS } from '@/lib/sponsors';
import { aqiWord, clockTime, ESTATE_FACTS, feelsWord, skyWord, SPONSORS, useAtmosphere, uvWord, type Atmosphere } from '@/lib/mapInfo';

// A small rotating card on the public map: vacant plots ("can be yours"), the weather and air
// quality at the estate right now, sun and UV, facts, sponsors, and a note for kids.

type Slide = {
  key: string;
  tone: 'ad' | 'info' | 'warn';
  icon: ReactNode;
  title: string;
  text: string;
  cta?: { label: string; run: () => void };
};

const ROTATE_MS = 6500;

function weatherSlides(a: Atmosphere): Slide[] {
  const out: Slide[] = [];
  out.push({
    key: 'weather', tone: 'info', icon: <ThermometerSun className="h-5 w-5" />,
    title: `${Math.round(a.tempC)}°C · ${feelsWord(a.feelsC)}`,
    text: `${skyWord(a.code, a.isDay)}. Feels like ${Math.round(a.feelsC)}°, breeze ${Math.round(a.windKmh)} km/h.`,
  });
  if (!a.isDay && a.sunrise && a.sunset) {
    out.push({
      key: 'night', tone: 'info', icon: <Sunset className="h-5 w-5" />,
      title: `Sunset was ${clockTime(a.sunset)}`,
      text: `Sunrise tomorrow around ${clockTime(a.sunrise)}. Lakes are out of bounds after 6 PM.`,
    });
  }
  return out;
}

export function MapInfoCard({ onShowPlace, className = '' }: { onShowPlace: (placeId: string) => void; className?: string }) {
  const atmosphere = useAtmosphere();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [closed, setClosed] = useState(false);

  // A handful of plots that are available, picked fresh on each visit.
  const ads = useMemo(() => {
    const open = SAMPLE_PLOTS.filter((p) => p.status === 'Available');
    return [...open].sort(() => Math.random() - 0.5).slice(0, 4);
  }, []);

  const slides = useMemo(() => {
    const info: Slide[] = [
      ...(atmosphere ? weatherSlides(atmosphere) : []),
      ...ESTATE_FACTS.map((f, n): Slide => ({ key: `fact-${n}`, tone: 'info', icon: n === 1 ? <Waves className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />, title: f.title, text: f.text })),
      ...SPONSORS.map((s, n): Slide => ({ key: `sp-${n}`, tone: 'info', icon: s.logo ? <img src={s.logo} alt="" className="h-6 w-6 object-contain" /> : <Sparkles className="h-5 w-5" />, title: s.name, text: s.tagline })),
      { key: 'sponsors', tone: 'info', icon: <Sparkles className="h-5 w-5" />, title: 'Our course sponsors', text: COURSE_SPONSORS.map((s) => s.name).join(' \u00b7 ') },
      { key: 'kids', tone: 'info', icon: <Smile className="h-5 w-5" />, title: "Kids' corner", text: 'Stay with a grown-up, keep away from the lakes, and spot the flags on the greens!' },
      { key: 'lake', tone: 'warn', icon: <Waves className="h-5 w-5" />, title: 'Lakes are out of bounds after 6 PM', text: 'The water is deep. Please keep to the roads and paths.' },
    ];
    const adSlides = ads.map((p): Slide => ({
      key: `ad-${p.id}`, tone: 'ad', icon: <Home className="h-5 w-5" />,
      title: `Plot ${p.plotNo} can be yours`,
      text: `${p.bedrooms} BHK villa on ${Math.round(p.landAreaSft).toLocaleString('en-IN')} sq ft · ${p.phase} · vacant, available now`,
      cta: { label: 'Show me', run: () => onShowPlace(`plot-${p.id}`) },
    }));
    // An advert, then a couple of facts, and round again.
    const out: Slide[] = [];
    const per = Math.max(1, Math.ceil(info.length / Math.max(1, adSlides.length)));
    let k = 0;
    for (const ad of adSlides) { out.push(ad); for (let n = 0; n < per && k < info.length; n++) out.push(info[k++]); }
    while (k < info.length) out.push(info[k++]);
    return out;
  }, [atmosphere, ads, onShowPlace]);

  useEffect(() => {
    if (paused || closed || slides.length < 2) return;
    const t = window.setInterval(() => setI((n) => n + 1), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [paused, closed, slides.length]);

  if (closed || slides.length === 0) return null;
  const s = slides[i % slides.length];
  const tile = s.tone === 'ad' ? `${lxOrange}` : s.tone === 'warn' ? 'bg-gradient-to-br from-[#a3241c] to-[#7a1712] text-white ring-1 ring-[#f1d9a6]/50' : 'bg-[#13261c] text-[#e3c98d] ring-1 ring-[#c9a96e]/50';

  return (
    <div
      data-dock="left"
      className={`pointer-events-auto [@media(max-height:460px)]:hidden ${className}`}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className={`overflow-hidden rounded-[20px] ${lxIvory}`}>
        <div key={s.key} className="flex animate-slide-up items-center gap-2.5 py-2 pl-2 pr-1 sm:gap-3 sm:py-2.5 sm:pl-2.5">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] sm:h-11 sm:w-11 sm:rounded-[14px] ${tile}`}>{s.icon}</div>
          <button type="button" onClick={() => setI((n) => n + 1)} className="min-w-0 flex-1 text-left" aria-label="Next">
            <div className={`${lxEyebrow} mb-0.5 hidden sm:block ${s.tone === 'ad' ? 'text-[#d9480f]' : s.tone === 'warn' ? 'text-[#a3241c]' : 'text-[#7a6830]'}`}>{s.tone === 'ad' ? 'Available now' : s.tone === 'warn' ? 'For your safety' : 'Zion Hills'}</div>
            <div className="truncate font-serif text-[17px] font-semibold leading-tight text-[#13261c] sm:text-[18px]">{s.title}</div>
            <div className="line-clamp-1 text-[12px] leading-snug text-[#5b5a4c] sm:line-clamp-2">{s.text}</div>
          </button>
          {s.cta ? (
            <button onClick={s.cta.run} aria-label={s.cta.label} className={`flex shrink-0 items-center gap-0.5 rounded-full p-2 text-[13px] font-semibold tracking-wide active:scale-95 sm:px-3.5 ${lxOrange}`}>
              <span className="hidden sm:inline">{s.cta.label}</span> <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          ) : null}
          <button onClick={() => setClosed(true)} aria-label="Hide these tips" className="shrink-0 self-start rounded-full p-1 text-[#b7a574] hover:bg-[#c9a96e]/[0.15] hover:text-[#6f5f2f]"><X className="h-4 w-4" /></button>
        </div>
        <div className="h-[2px] w-full bg-[#c9a96e]/[0.18]">
          <div key={`${s.key}-${i}`} className="h-full origin-left bg-[#c9a96e]" style={{ animation: `zh-progress ${ROTATE_MS}ms linear`, animationPlayState: paused ? 'paused' : 'running' }} />
        </div>
      </div>
    </div>
  );
}
