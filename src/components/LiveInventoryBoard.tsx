import { useMemo, useState, type ReactNode } from 'react';
import {
  LayoutGrid, Search, X, Maximize2, List as ListIcon, Map as MapIcon,
  BedDouble, CheckCircle2, Trash2, Receipt,
} from 'lucide-react';
import { SAMPLE_PLOTS, PHASES, PLOT_STATUSES, BEDROOM_OPTIONS, STATUS_COLORS, type Plot, type PlotStatus } from '@/lib/inventory';

function formatL(lacs: number) {
  return `₹${lacs.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} L`;
}

function formatCr(lacs: number) {
  return `₹${(lacs / 100).toFixed(2)} Cr`;
}

export default function LiveInventoryBoard() {
  const [plots, setPlots] = useState<Plot[]>(SAMPLE_PLOTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PlotStatus | 'All'>('All');
  const [phaseFilter, setPhaseFilter] = useState<string>('All');
  const [bedroomFilter, setBedroomFilter] = useState<3 | 4 | 'All'>('All');
  const [selected, setSelected] = useState<Plot | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [fullscreen, setFullscreen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<PlotStatus, number> = { Available: 0, Sold: 0, 'On-Hold': 0 };
    plots.forEach((p) => c[p.status]++);
    return c;
  }, [plots]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plots.filter((p) => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (phaseFilter !== 'All' && p.phase !== phaseFilter) return false;
      if (bedroomFilter !== 'All' && p.bedrooms !== bedroomFilter) return false;
      if (q && !p.plotNo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [plots, search, statusFilter, phaseFilter, bedroomFilter]);

  function updatePlot(next: Plot) {
    setPlots((prev) => prev.map((p) => (p.id === next.id ? next : p)));
    setSelected(next);
  }

  function deletePlot(id: string) {
    setPlots((prev) => prev.filter((p) => p.id !== id));
    setSelected(null);
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Live Inventory Board</h1>
          </div>
        </div>
      </div>

      {/* Legend / stats */}
      <div className="grid grid-cols-3 gap-3">
        {PLOT_STATUSES.map((s) => {
          const c = STATUS_COLORS[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'All' : s)}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                statusFilter === s ? `${c.bg} ${c.border} ring-1 ${c.ring}` : 'border-black/5 bg-white hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-gray-700">
                <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                {s}
              </span>
              <span className="font-display text-lg font-bold text-gray-900">{counts[s]}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-3 card-shadow sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plot number…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-emerald-400"
        >
          <option value="All">All phases</option>
          {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setBedroomFilter('All')}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${bedroomFilter === 'All' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            All BHK
          </button>
          {BEDROOM_OPTIONS.map((b) => (
            <button
              key={b}
              onClick={() => setBedroomFilter(b)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${bedroomFilter === b ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {b}BHK
            </button>
          ))}
        </div>
        {statusFilter !== 'All' && (
          <button
            onClick={() => setStatusFilter('All')}
            className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-[12.5px] font-medium text-gray-500 hover:bg-gray-50"
          >
            <X className="h-3.5 w-3.5" /> Clear status filter
          </button>
        )}
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setView('map')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${view === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            <MapIcon className="h-3.5 w-3.5" /> Map
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            <ListIcon className="h-3.5 w-3.5" /> List
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
          No plots match these filters.
        </div>
      ) : view === 'map' ? (
        <MasterPlanBoard plots={filtered} onSelect={setSelected} onExpand={() => setFullscreen(true)} />
      ) : (
        <PlotListGrid plots={filtered} onSelect={setSelected} />
      )}

      {selected && (
        <PlotDetailModal plot={selected} onClose={() => setSelected(null)} onSave={updatePlot} onDelete={deletePlot} />
      )}

      {fullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setFullscreen(false)}>
          <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl bg-white p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-sm font-semibold text-gray-700">Zion Hills — Master Plan</span>
              <button onClick={() => setFullscreen(false)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <MasterPlanBoard plots={filtered} onSelect={(p) => { setFullscreen(false); setSelected(p); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function MasterPlanBoard({ plots, onSelect, onExpand }: { plots: Plot[]; onSelect: (p: Plot) => void; onExpand?: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white card-shadow">
      <div className="relative w-full bg-gray-100" style={{ aspectRatio: '3369.9 / 2383.8' }}>
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
          </div>
        )}
        <img
          src="/zion-hills-master-plan.svg"
          alt="Zion Hills master plan"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
        {loaded && plots.map((p) => {
          const c = STATUS_COLORS[p.status];
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              style={{ left: `${p.positionPct.x}%`, top: `${p.positionPct.y}%` }}
              className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 focus:outline-none"
            >
              <span className={`relative z-10 block h-2 w-2 rounded-full ring-1 ring-white shadow ${c.dot} transition group-hover:z-30 group-hover:h-3 group-hover:w-3`} />

              {/* Hover tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-gray-900/95 px-2.5 py-1.5 text-left text-white opacity-0 shadow-xl transition group-hover:opacity-100">
                <div className="text-[11.5px] font-bold">Plot {p.plotNo} · {p.status}</div>
                <div className="text-[10.5px] text-white/70">{p.bedrooms}BHK · {p.phase} · {formatCr(p.cost.totalCostLacs)}</div>
              </div>
            </button>
          );
        })}

        {onExpand && (
          <button
            onClick={onExpand}
            className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11.5px] font-semibold text-gray-600 shadow backdrop-blur hover:bg-white"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Expand
          </button>
        )}
      </div>
    </div>
  );
}

function PlotListGrid({ plots, onSelect }: { plots: Plot[]; onSelect: (p: Plot) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {plots.map((p) => {
        const c = STATUS_COLORS[p.status];
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={`group relative overflow-hidden rounded-2xl border-2 ${c.border} ${c.bg} p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg`}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-gray-900">Plot {p.plotNo}</span>
              <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
            </div>
            <div className="mt-1 truncate text-[11px] text-gray-500">{p.phase}</div>
            <div className="mt-2 flex flex-wrap gap-1 text-[10.5px] text-gray-500">
              <span>{p.bedrooms}BHK</span>
              <span>·</span>
              <span>{p.builtUpSft.toLocaleString()} sqft built-up</span>
            </div>
            <div className={`mt-2 text-[13px] font-semibold ${c.text}`}>{formatCr(p.cost.totalCostLacs)}</div>

            {/* Hover status tooltip */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gray-900/85 p-3 text-white opacity-0 transition group-hover:opacity-100">
              <span className="text-[12px] font-bold">{p.status}</span>
              {p.status === 'Available' && <span className="text-[10.5px] text-white/80">Click to view or update status</span>}
              {p.status === 'Sold' && <span className="text-[10.5px] text-white/80">No longer available</span>}
              {p.status === 'On-Hold' && <span className="text-[10.5px] text-white/80">Temporarily paused — click for details</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PlotDetailModal({ plot, onClose, onSave, onDelete }: { plot: Plot; onClose: () => void; onSave: (p: Plot) => void; onDelete: (id: string) => void }) {
  const c = STATUS_COLORS[plot.status];

  function markAvailable() {
    onSave({ ...plot, status: 'Available' });
  }

  function markSold() {
    onSave({ ...plot, status: 'Sold' });
  }

  function markOnHold() {
    onSave({ ...plot, status: 'On-Hold' });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="animate-scale-in flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — always visible, never scrolls away */}
        <div className={`flex shrink-0 items-center justify-between border-b border-black/5 px-4 py-3 ${c.bg}`}>
          <div>
            <div className="font-display text-base font-bold text-gray-900">Plot {plot.plotNo}</div>
            <div className="text-[12px] text-gray-500">{plot.phase}</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-white/70 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — scrolls if content is tall */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${c.bg} ${c.text} ring-1 ${c.ring}`}>
              <span className={`h-2 w-2 rounded-full ${c.dot}`} /> {plot.status}
            </span>
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-gray-600">
              <BedDouble className="h-4 w-4 text-gray-400" /> {plot.bedrooms}BHK
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 px-3 py-2 text-[12.5px]">
            <div>
              <div className="text-gray-400">Land area</div>
              <div className="font-medium text-gray-800">{plot.landAreaSft.toLocaleString()} sqft</div>
            </div>
            <div>
              <div className="text-gray-400">Built-up area</div>
              <div className="font-medium text-gray-800">{plot.builtUpSft.toLocaleString()} sqft</div>
            </div>
            <div>
              <div className="text-gray-400">Land rate</div>
              <div className="font-medium text-gray-800">₹{plot.cost.landRate.toLocaleString('en-IN')}/sqft</div>
            </div>
            <div>
              <div className="text-gray-400">Construction rate</div>
              <div className="font-medium text-gray-800">₹{plot.cost.constnRate.toLocaleString('en-IN')}/sqft</div>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-gray-400">
              <Receipt className="h-3.5 w-3.5" /> Cost breakdown
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <dl className="divide-y divide-gray-100 text-[12.5px]">
                <Row label="Land cost">{formatL(plot.cost.landCostLacs)}</Row>
                <Row label="Construction cost">{formatL(plot.cost.constnCostLacs)}</Row>
                <Row label="Club charges">{formatL(plot.cost.clubChargesLacs)}</Row>
                <Row label="Landscape charges">{formatL(plot.cost.landscapeChargesLacs)}</Row>
                <Row label="Utility charges">{formatL(plot.cost.utilityChargesLacs)}</Row>
                <Row label="GST">{formatL(plot.cost.gstLacs)}</Row>
                <div className="flex items-center justify-between bg-gray-50 px-3 py-1.5">
                  <dt className="text-[12.5px] font-semibold text-gray-900">Total cost</dt>
                  <dd className="font-display text-[12.5px] font-bold text-gray-900">{formatL(plot.cost.totalCostLacs)} · {formatCr(plot.cost.totalCostLacs)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Actions — always visible, never scrolls away */}
        <div className="shrink-0 border-t border-gray-100 px-4 py-3">
          {plot.status === 'Available' && (
            <div className="flex flex-wrap gap-2">
              <button onClick={markOnHold} className="rounded-xl border border-gray-200 px-3 py-2 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50">
                Mark On-Hold
              </button>
              <button onClick={markSold} className="rounded-xl border border-gray-200 px-3 py-2 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50">
                Mark Sold
              </button>
            </div>
          )}

          {plot.status === 'On-Hold' && (
            <button onClick={markAvailable} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50">
              <CheckCircle2 className="h-4 w-4" /> Mark Available again
            </button>
          )}

          {plot.status === 'Sold' && (
            <div className="flex flex-wrap gap-2">
              <button onClick={markAvailable} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50">
                <CheckCircle2 className="h-4 w-4" /> Mark Available again
              </button>
              <button onClick={() => onDelete(plot.id)} className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-[12.5px] font-medium text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Delete pin
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{children}</dd>
    </div>
  );
}
