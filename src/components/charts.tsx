import { useMemo } from 'react';

interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}

export function BarChart({ data, height = 200, color = '#1f6f43' }: BarChartProps) {
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

export function LineChart({ data, height = 200, color = '#c9a227' }: LineChartProps) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);
  const width = 100;
  const points = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * width;
    const y = height - 30 - (d.value / max) * (height - 50);
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${width} ${height - 30} L 0 ${height - 30} Z`;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill="url(#lineGrad)" />}
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-0.5">
        {data.map((d, i) => (
          <span key={i} className="text-[10px] font-medium text-gray-400">{d.label}</span>
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
