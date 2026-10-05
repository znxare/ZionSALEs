import { useEffect } from 'react';
import { Download, Home, Ruler, BedDouble, MapPin } from 'lucide-react';
import type { Plot } from '@/lib/inventory';
import { findPlot, outlineOf, centroidOf, formatCrore, formatLakh, SHAPE_COLORS } from '@/lib/plotMap';

// Shared with buyers over WhatsApp — opens without a login and shows only this
// plot's location, details and price. Nothing internal (other buyers, holds,
// notes, rates) is on this page.

const MAP_W = 11233, MAP_H = 7946;
const L2 = { name: 'l2', width: 7200, height: 5093, cols: 8, rows: 5, tile: 1024 };

/** Close-up of the master plan around one plot, built from the sharp map tiles. */
function PlanCrop({ plot }: { plot: Plot }) {
  const [cx, cy] = centroidOf(plot);
  const rw = 9; // % of map width shown
  const rh = (rw * MAP_W * 3) / (4 * MAP_H); // keeps a 4:3 frame
  const rx = Math.min(100 - rw, Math.max(0, cx - rw / 2));
  const ry = Math.min(100 - rh, Math.max(0, cy - rh / 2));
  const tiles: { key: string; src: string; style: React.CSSProperties }[] = [];
  for (let ty = 0; ty < L2.rows; ty++) {
    for (let tx = 0; tx < L2.cols; tx++) {
      const left = (tx * L2.tile * 100) / L2.width, top = (ty * L2.tile * 100) / L2.height;
      const right = Math.min(100, ((tx + 1) * L2.tile * 100) / L2.width), bottom = Math.min(100, ((ty + 1) * L2.tile * 100) / L2.height);
      if (right < rx || left > rx + rw || bottom < ry || top > ry + rh) continue;
      tiles.push({
        key: `${tx}-${ty}`,
        src: `/master-plan/${L2.name}/${tx}_${ty}.webp`,
        style: { left: `${((left - rx) / rw) * 100}%`, top: `${((top - ry) / rh) * 100}%`, width: `${((right - left) / rw) * 100}%`, height: `${((bottom - top) / rh) * 100}%` },
      });
    }
  }
  const c = SHAPE_COLORS[plot.status];
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gray-100" style={{ aspectRatio: '4 / 3' }}>
      {tiles.map((t) => <img key={t.key} src={t.src} alt="" className="absolute max-w-none" style={t.style} />)}
      <svg className="absolute inset-0 h-full w-full" viewBox={`${rx} ${ry} ${rw} ${rh}`} preserveAspectRatio="none">
        <polygon
          points={outlineOf(plot).map(([x, y]) => `${x},${y}`).join(' ')}
          fill={c.fill}
          fillOpacity={0.35}
          stroke="#f97316"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold text-gray-800 shadow">
        <MapPin className="h-3.5 w-3.5 text-orange-600" /> Plot {plot.plotNo}
      </div>
    </div>
  );
}

export default function PublicPlotPage({ plotId, buyerName, senderName }: { plotId: string; buyerName?: string; senderName?: string }) {
  const plot = findPlot(plotId);

  useEffect(() => {
    document.title = plot ? `Plot ${plot.plotNo} · Zion Hills Golf County` : 'Zion Hills Golf County';
  }, [plot]);

  if (!plot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f2] p-6 text-center">
        <div>
          <div className="font-display text-xl font-bold tracking-[0.18em] text-gray-900">ZION HILLS</div>
          <p className="mt-3 text-sm text-gray-500">This plot link is no longer valid. Please contact your Zion Hills sales advisor.</p>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const available = plot.status === 'Available';
  const k = plot.cost;

  return (
    <div className="min-h-screen bg-[#f7f5f2] py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl px-4 print:max-w-none print:px-0">
        {/* Header */}
        <div className="flex items-end justify-between border-b border-gray-200 pb-4">
          <div>
            <div className="font-display text-2xl font-bold tracking-[0.18em] text-gray-900">ZION HILLS</div>
            <div className="text-sm text-gray-500">Golf County</div>
          </div>
          <div className="text-right text-[12px] text-gray-500">
            <div className="font-semibold text-gray-700">Plot quotation</div>
            <div>{today}</div>
          </div>
        </div>

        {buyerName && (
          <p className="mt-5 text-[15px] text-gray-700">
            Prepared for <span className="font-semibold text-gray-900">{buyerName}</span>
          </p>
        )}

        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-sm text-gray-500">{plot.phase}</div>
            <h1 className="font-display text-3xl font-bold text-gray-900">Plot {plot.plotNo}</h1>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ color: SHAPE_COLORS[plot.status].stroke, backgroundColor: SHAPE_COLORS[plot.status].fill + '22' }}
          >
            {available ? 'Available' : SHAPE_COLORS[plot.status].label}
          </span>
        </div>

        <div className="mt-4">
          <PlanCrop plot={plot} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Fact icon={Home} label="Villa" value={`${plot.bedrooms}BHK`} />
          <Fact icon={Ruler} label="Plot area" value={`${Math.round(plot.landAreaSft).toLocaleString('en-IN')} sq ft`} />
          <Fact icon={BedDouble} label="Built-up" value={`${plot.builtUpSft.toLocaleString('en-IN')} sq ft`} />
        </div>

        {/* Quote */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Price breakdown</div>
          <dl className="divide-y divide-gray-100 text-[14px]">
            <Line label="Land">{formatLakh(k.landCostLacs)}</Line>
            <Line label="Villa construction">{formatLakh(k.constnCostLacs)}</Line>
            <Line label="Club membership">{formatLakh(k.clubChargesLacs)}</Line>
            <Line label="Landscaping">{formatLakh(k.landscapeChargesLacs)}</Line>
            <Line label="Utilities">{formatLakh(k.utilityChargesLacs)}</Line>
            <Line label="GST">{formatLakh(k.gstLacs)}</Line>
          </dl>
          <div className="flex items-center justify-between bg-gray-50 px-5 py-4">
            <span className="font-semibold text-gray-900">Total (all-inclusive)</span>
            <span className="font-display text-2xl font-bold text-gray-900">{formatCrore(k.totalCostLacs)}</span>
          </div>
        </div>

        {!available && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            This plot is currently {SHAPE_COLORS[plot.status].label.toLowerCase()}. Your advisor can suggest similar plots.
          </p>
        )}

        <p className="mt-4 text-[12px] leading-relaxed text-gray-400">
          Prices are indicative and subject to change; the final price is as per the sale agreement.
          {senderName ? ` Shared by ${senderName}, Zion Hills.` : ''}
        </p>

        <div className="mt-5 flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            <Download className="h-4 w-4" /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
      <Icon className="h-4 w-4 text-gray-400" />
      <div className="mt-2 text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-[15px] font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{children}</dd>
    </div>
  );
}
