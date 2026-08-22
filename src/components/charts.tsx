import { useMemo, useState } from 'react';

interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}

export function BarChart({ data, height = 200, color = '#F05A22' }: BarChartProps) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[11px] font-bold text-gray-700">{d.value}</span>
          <div
            className="w-full max-w-[48px] rounded-t-lg transition-all duration-500"
            style={{
              height: `${(d.value / max) * (height - 50)}px`,
              background: `linear-gradient(180deg, ${color} 0%, ${color}cc 100%)`,
              minHeight: d.value > 0 ? 4 : 0,
            }}
          />
          <span className="truncate text-[10px] font-medium text-gray-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)));
  const normalized = v / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function LineChart({ data, height = 220, color = '#F05A22' }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const plotH = height - 26;
  const rawMax = Math.max(1, ...data.map((d) => d.value));
  const top = niceMax(rawMax);
  const ticks = [0, top * 0.5, top].map((v) => Math.round(v));

  const points = data.map((d, i) => {
    const xPct = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
    const yPct = 100 - (d.value / top) * 100;
    return { xPct, yPct, ...d };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.xPct} ${p.yPct}`).join(' ');
  const areaPath = `${linePath} L 100 100 L 0 100 Z`;
  const hasData = data.some((d) => d.value > 0);

  return (
    <div className="w-full select-none">
      <div className="flex gap-2">
        <div className="flex shrink-0 flex-col justify-between py-0 text-right" style={{ height: plotH }}>
          {[...ticks].reverse().map((t, i) => (
            <span key={i} className="text-[10px] font-medium leading-none text-gray-400">{t}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height: plotH }}>
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-t border-dashed border-gray-100" />
            ))}
          </div>

          {!hasData ? (
            <div className="absolute inset-0 flex items-center justify-center text-[12px] text-gray-300">No leads in this period</div>
          ) : (
            <>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#lineGrad)" />
                <path d={linePath} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              </svg>

              {points.map((p, i) => (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                >
                  <div
                    className="rounded-full border-2 border-white shadow-sm transition-transform"
                    style={{ width: hover === i ? 10 : 7, height: hover === i ? 10 : 7, background: color }}
                  />
                  {hover === i && (
                    <div className="absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white shadow-lg">
                      {p.label}: {p.value}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex justify-between pl-8">
        {data.map((d, i) => (
          <span key={i} className={'text-[10px] font-medium transition-colors ' + (hover === i ? 'text-gray-700' : 'text-gray-400')}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

interface DonutProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
}

export function DonutChart({ data, size = 160 }: DonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {total === 0 ? (
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
          ) : (
            data.map((d, i) => {
              const len = (d.value / total) * circumference;
              const seg = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={d.color}
                  strokeWidth="12"
                  strokeDasharray={`${len} ${circumference - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                />
              );
              offset += len;
              return seg;
            })
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-bold text-gray-900">{total}</span>
          <span className="text-[10px] font-medium text-gray-400">Total</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="font-medium text-gray-600">{d.label}</span>
            <span className="font-bold text-gray-900">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
