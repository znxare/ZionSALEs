import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Home, Sun, Wind, ThermometerSun, Sunset, Landmark, Waves, Smile, Sparkles, X, ChevronRight } from 'lucide-react';
import { SAMPLE_PLOTS } from '@/lib/inventory';
import { lxEyebrow, lxIvory, lxOrange } from '@/lib/luxury';
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
    text: `${skyWord(a.code, a.isDay)}. Feels like ${Math.round(a.feelsC)}°, humidity ${Math.round(a.humidity)}%, breeze ${Math.round(a.windKmh)} km/h.`,
  });
  if (a.aqi != null) {
    const { word } = aqiWord(a.aqi);
    out.push({
      key: 'aqi', tone: 'info', icon: <Wind className="h-5 w-5" />,
      title: `Air quality ${Math.round(a.aqi)} · ${word}`,
      text: a.aqi <= 50 ? 'Fresh, clean air out on the course.' : a.aqi <= 100 ? 'Acceptable air — fine for a walk or a round.' : 'Sensitive visitors may want to take it easy outdoors.',
    });
  }
  const now = new Date();
  if (a.isDay) {
    const { word, advice } = uvWord(a.uv);
    out.push({
      key: 'uv', tone: 'info', icon: <Sun className="h-5 w-5" />,
      title: `Sun rays: UV ${a.uv.toFixed(a.uv < 10 ? 1 : 0)} · ${word}`,
      text: a.sunset ? `${advice} Sunset at ${clockTime(a.sunset)}.` : advice,
    });
  } else if (a.sunrise && a.sunset) {
    out.push({
      key: 'night', tone: 'info', icon: <Sunset className="h-5 w-5" />,
      title: `Sunset was ${clockTime(a.sunset)}`,
      text: `Sunrise tomorrow around ${clockTime(a.sunrise)}. Lakes are out of bounds after 6 PM.`,
    });
  }
  if (a.isDay && a.sunset && a.sunset.getTime() - now.getTime() < 90 * 60 * 1000 && a.sunset.getTime() > now.getTime()) {
    out.push({
      key: 'golden', tone: 'info', icon: <Sunset className="h-5 w-5" />,
      title: 'Golden hour on the course',
      text: `Soft, warm light until sunset at ${clockTime(a.sunset)} — the best time for photos.`,
    });
  }
  if (a.elevationM != null) {
    out.push({
      key: 'elev', tone: 'info', icon: <Landmark className="h-5 w-5" />,
      title: `${a.elevationM} m above sea level`,
      text: 'The altitude keeps the estate pleasantly cool.',
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
      className={`pointer-events-auto ${className}`}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className={`overflow-hidden rounded-[20px] ${lxIvory}`}>
        <div key={s.key} className="flex animate-slide-up items-center gap-3 py-2.5 pl-2.5 pr-1.5">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[14px] ${tile}`}>{s.icon}</div>
          <button type="button" onClick={() => setI((n) => n + 1)} className="min-w-0 flex-1 text-left" aria-label="Next">
            <div className={`${lxEyebrow} mb-0.5 ${s.tone === 'ad' ? 'text-[#d9480f]' : s.tone === 'warn' ? 'text-[#a3241c]' : 'text-[#9a8450]'}`}>{s.tone === 'ad' ? 'Available now' : s.tone === 'warn' ? 'For your safety' : 'Zion Hills'}</div>
            <div className="truncate font-serif text-[18px] font-semibold leading-tight text-[#13261c]">{s.title}</div>
            <div className="line-clamp-2 text-[12px] leading-snug text-[#5b5a4c]">{s.text}</div>
          </button>
          {s.cta ? (
            <button onClick={s.cta.run} className={`flex shrink-0 items-center gap-0.5 rounded-full px-3.5 py-2 text-[13px] font-semibold tracking-wide active:scale-95 ${lxOrange}`}>
              {s.cta.label} <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
          <button onClick={() => setClosed(true)} aria-label="Close" className="shrink-0 self-start rounded-full p-1 text-[#b7a574] hover:bg-[#c9a96e]/[0.15] hover:text-[#8a7a52]"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex justify-center gap-1 pb-1.5">
          {slides.map((sl, n) => (
            <span key={sl.key} className={`h-1 rounded-full transition-all ${n === i % slides.length ? 'w-4 bg-[#c9a96e]' : 'w-1 bg-[#c9a96e]/30'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
