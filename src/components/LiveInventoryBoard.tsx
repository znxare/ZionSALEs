import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react';
import {
  LayoutGrid, Search, X, Maximize2, List as ListIcon, Map as MapIcon, ChevronDown,
  BedDouble, CheckCircle2, Trash2, Receipt, Tag, Clock3, Plus, Minus, RotateCcw,
  Presentation, Share2, FileText, Ruler, Home, MessageCircle,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { SAMPLE_PLOTS, PHASES, PLOT_STATUSES, BEDROOM_OPTIONS, STATUS_COLORS, type Plot, type PlotStatus } from '@/lib/inventory';
import { BUDGETS, inBudget, outlineOf, centroidOf, plotAt, SHAPE_COLORS, plotShareLink, whatsappLink, type BudgetId } from '@/lib/plotMap';
import { getCurrentUser } from '@/lib/auth';

const STAT_TINT: Record<PlotStatus, { border: string; from: string; iconBg: string; iconText: string; ring: string }> = {
  Available: { border: 'border-emerald-200/60 hover:border-emerald-300/60', from: 'from-emerald-50/60', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', ring: 'ring-emerald-400' },
  Sold: { border: 'border-gray-200/60 hover:border-gray-300/60', from: 'from-gray-50/60', iconBg: 'bg-gray-100', iconText: 'text-gray-500', ring: 'ring-gray-400' },
  'On-Hold': { border: 'border-sky-200/60 hover:border-sky-300/60', from: 'from-sky-50/60', iconBg: 'bg-sky-100', iconText: 'text-sky-600', ring: 'ring-sky-400' },
};

const STAT_ICON: Record<PlotStatus, typeof CheckCircle2> = {
  Available: CheckCircle2,
  Sold: Tag,
  'On-Hold': Clock3,
};

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
  const [budget, setBudget] = useState<BudgetId | 'All'>('All');
  const [presenting, setPresenting] = useState(false);
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
      if (!inBudget(p, budget)) return false;
      if (q && !p.plotNo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [plots, search, statusFilter, phaseFilter, bedroomFilter, budget]);

  // On the map every plot stays visible; plots outside the filters fade out
  // and the matches glow, so the buyer sees where their options sit.
  const anyFilter = statusFilter !== 'All' || phaseFilter !== 'All' || bedroomFilter !== 'All' || budget !== 'All' || search.trim() !== '';
  const highlight = useMemo(() => (anyFilter ? new Set(filtered.map((p) => p.id)) : null), [anyFilter, filtered]);

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
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Live Inventory Board</h1>
          </div>
          <button
            onClick={() => setPresenting(true)}
            className="flex items-center gap-2 rounded-full brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            <Presentation className="h-4 w-4" /> Present to buyer
          </button>
        </div>
      </div>

      {/* KPI cards — same language as the Dashboard's stat tiles */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {PLOT_STATUSES.map((s) => {
          const t = STAT_TINT[s];
          const Icon = STAT_ICON[s];
          const active = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(active ? 'All' : s)} className="group text-left">
              <div
                className={`rounded-2xl border bg-gradient-to-br to-white p-4 card-shadow transition hover:shadow-md ${t.border} ${t.from} ${
                  active ? `ring-2 ring-offset-1 ${t.ring}` : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl shadow-sm ${t.iconBg} ${t.iconText}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-display text-2xl font-bold tracking-tight text-gray-900">{counts[s]}</span>
                </div>
                <div className="mt-3 text-[13px] font-medium text-gray-600">{s}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar — pill controls, matching the filter bar on All Leads */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plot number…"
            className="w-full rounded-full border border-black/5 bg-white py-2.5 pl-11 pr-4 text-sm font-medium text-gray-900 outline-none card-shadow placeholder:text-gray-400 focus:border-emerald-200"
          />
        </div>

        <div className="relative">
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="appearance-none rounded-full border border-black/5 bg-white py-2.5 pl-3.5 pr-9 text-sm font-medium text-gray-600 outline-none card-shadow focus:border-emerald-200"
          >
            <option value="All">All phases</option>
            {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        <div className="flex overflow-hidden rounded-full border border-black/5 bg-white card-shadow">
          <button
            onClick={() => setBedroomFilter('All')}
            className={`px-3.5 py-2.5 text-sm font-medium transition ${bedroomFilter === 'All' ? 'brand-gradient text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All BHK
          </button>
          {BEDROOM_OPTIONS.map((b) => (
            <button
              key={b}
              onClick={() => setBedroomFilter(b)}
              className={`px-3.5 py-2.5 text-sm font-medium transition ${bedroomFilter === b ? 'brand-gradient text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {b}BHK
            </button>
          ))}
        </div>

        <div className="relative">
          <select
            value={budget}
            onChange={(e) => setBudget(e.target.value as BudgetId | 'All')}
            aria-label="Budget"
            className="appearance-none rounded-full border border-black/5 bg-white py-2.5 pl-3.5 pr-9 text-sm font-medium text-gray-600 outline-none card-shadow focus:border-emerald-200"
          >
            <option value="All">Any budget</option>
            {BUDGETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        {statusFilter !== 'All' && (
          <button
            onClick={() => setStatusFilter('All')}
            className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700 card-shadow"
          >
            <X className="h-3.5 w-3.5" /> Clear status
          </button>
        )}

        <div className="ml-auto flex overflow-hidden rounded-full border border-black/5 bg-white card-shadow">
          <button
            onClick={() => setView('map')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition ${view === 'map' ? 'brand-gradient text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <MapIcon className="h-3.5 w-3.5" /> Map
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition ${view === 'list' ? 'brand-gradient text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ListIcon className="h-3.5 w-3.5" /> List
          </button>
        </div>
      </div>

      {view === 'map' ? (
        <div className="space-y-2">
          {anyFilter && (
            <p className="text-[12.5px] text-gray-500">
              {filtered.length === 0 ? 'No plots match these filters — showing all plots faded.' : `${filtered.length} plot${filtered.length === 1 ? '' : 's'} match — highlighted on the map.`}
            </p>
          )}
          <MasterPlanBoard plots={plots} highlight={highlight} onSelect={setSelected} onExpand={() => setFullscreen(true)} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
          No plots match these filters.
        </div>
      ) : (
        <PlotListGrid plots={filtered} onSelect={setSelected} />
      )}

      {selected && (
        <PlotDetailModal plot={selected} onClose={() => setSelected(null)} onSave={updatePlot} onDelete={deletePlot} />
      )}

      {/* Portalled to <body> so no animated/transformed ancestor can offset or clip it. */}
      {presenting && createPortal(<BuyerPresentation plots={plots} onClose={() => setPresenting(false)} />, document.body)}

      {fullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setFullscreen(false)}>
          <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl bg-white p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-sm font-semibold text-gray-700">Zion Hills — Master Plan</span>
              <button onClick={() => setFullscreen(false)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <MasterPlanBoard plots={plots} highlight={highlight} onSelect={(p) => { setFullscreen(false); setSelected(p); }} />
          </div>
        </div>
      )}
    </div>
  );
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;

type Size = { width: number; height: number };

/**
 * Pinch-to-zoom, drag-to-pan, scroll-to-zoom wrapper, plus +/- buttons for devices without gestures.
 *
 * The scaled `mapLayer` (the image) and the un-scaled `overlay` (pins) are rendered as siblings inside
 * the same gesture-handling container: the map gets a CSS transform so panning/zooming is instant and
 * GPU-smooth, while pins are placed with plain pixel math so they never grow or shrink with zoom and
 * are never fuzzy or misaligned.
 */
type ViewState = { zoom: number; pan: { x: number; y: number }; size: Size; interacting: boolean };

function ZoomPanMap({
  mapLayer,
  overlay,
  onTap,
  onHover,
  controlsClassName = '',
}: {
  mapLayer: (state: ViewState) => ReactNode;
  overlay: (state: { zoom: number; pan: { x: number; y: number }; size: Size }) => ReactNode;
  /** A tap/click that wasn't a drag, at a point on the map in % of its width/height. */
  onTap?: (pt: [number, number]) => void;
  /** Mouse hovering over the map (null when it leaves) — desktop tooltips. */
  onHover?: (pt: [number, number] | null) => void;
  controlsClassName?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [interacting, setInteracting] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ startDist: number; startZoom: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const DRAG_THRESHOLD = 6;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function clampZoom(z: number) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  }

  /** Screen point → point on the (un-zoomed) map, in % of its width/height. */
  function toMapPct(clientX: number, clientY: number): [number, number] | null {
    const el = viewportRef.current;
    if (!el || size.width === 0) return null;
    const r = el.getBoundingClientRect();
    const sx = clientX - r.left, sy = clientY - r.top;
    const x = size.width / 2 + (sx - size.width / 2 - pan.x) / zoom;
    const y = size.height / 2 + (sy - size.height / 2 - pan.y) / zoom;
    return [(x / size.width) * 100, (y / size.height) * 100];
  }

  /** Keeps the scaled image from being panned past its own edge, so it never leaves empty space in view. */
  function clampPan(p: { x: number; y: number }, z: number) {
    const maxX = Math.max(0, (size.width * (z - 1)) / 2);
    const maxY = Math.max(0, (size.height * (z - 1)) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
  }

  /**
   * Accepts either an absolute zoom or an updater — always resolves against the
   * latest React state (never a closure-captured `zoom`), so rapid events fired
   * within the same batch (e.g. a fast wheel/trackpad gesture) each compose onto
   * the previous one instead of collapsing down to just the last event's delta.
   */
  function setZoomClamped(next: number | ((z: number) => number)) {
    setZoom((prevZoom) => {
      const z = clampZoom(typeof next === 'function' ? next(prevZoom) : next);
      setPan((p) => clampPan(p, z));
      return z;
    });
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY };
    }
    setInteracting(true);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (onHover && e.pointerType === 'mouse' && pointers.current.size === 0) onHover(toMapPct(e.clientX, e.clientY));
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(pointers.current.values());

    if (pts.length === 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (!pinch.current) {
        pinch.current = { startDist: dist, startZoom: zoom };
      } else {
        dragged.current = true;
        setZoomClamped(pinch.current.startZoom * (dist / pinch.current.startDist));
      }
    } else if (pts.length === 1 && zoom > 1) {
      const dx = e.movementX;
      const dy = e.movementY;
      if (dx || dy) {
        setPan((p) => clampPan({ x: p.x + dx, y: p.y + dy }, zoom));
        if (dragStart.current) {
          const traveled = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
          if (traveled > DRAG_THRESHOLD) dragged.current = true;
        }
      }
    }
  }

  function endPointer(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      dragStart.current = null;
      setInteracting(false);
    }
  }

  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    e.preventDefault();
    setZoomClamped((z) => z - e.deltaY * 0.0015);
  }

  function onClickCapture(e: ReactMouseEvent<HTMLDivElement>) {
    if (dragged.current) {
      e.stopPropagation();
      dragged.current = false;
      return;
    }
    // Clicks on the zoom buttons aren't map taps.
    if ((e.target as HTMLElement).closest('button')) return;
    const pt = toMapPct(e.clientX, e.clientY);
    if (pt && onTap) onTap(pt);
  }

  function zoomBy(delta: number) {
    setZoomClamped((z) => z + delta);
  }

  function reset() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  const isReset = zoom === 1 && pan.x === 0 && pan.y === 0;
  const transition = interacting ? 'none' : 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)';

  return (
    <div
      ref={viewportRef}
      className="absolute inset-0 touch-none select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={(e) => { endPointer(e); onHover?.(null); }}
      onWheel={onWheel}
      onClickCapture={onClickCapture}
    >
      {/* will-change only while a finger/mouse is moving the map: kept on, it makes
          the browser freeze the map at its first (zoomed-out) sharpness and just
          stretch that bitmap — the cause of the blurry zoom. */}
      <div
        className={`h-full w-full ${interacting ? 'will-change-transform' : ''}`}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center', transition }}
      >
        {mapLayer({ zoom, pan, size, interacting })}
      </div>

      {size.width > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {overlay({ zoom, pan, size })}
        </div>
      )}

      {/* Zoom controls */}
      <div className={`absolute bottom-3 left-3 z-30 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white/95 shadow backdrop-blur ${controlsClassName}`}>
        <button onClick={() => zoomBy(0.6)} aria-label="Zoom in" className="p-2.5 text-gray-600 hover:bg-gray-50 active:bg-gray-100">
          <Plus className="h-4 w-4" />
        </button>
        <div className="h-px bg-gray-100" />
        <button onClick={() => zoomBy(-0.6)} aria-label="Zoom out" className="p-2.5 text-gray-600 hover:bg-gray-50 active:bg-gray-100">
          <Minus className="h-4 w-4" />
        </button>
        {!isReset && (
          <>
            <div className="h-px bg-gray-100" />
            <button onClick={reset} aria-label="Reset zoom" className="p-2.5 text-gray-600 hover:bg-gray-50 active:bg-gray-100">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// The master plan as a zoom pyramid (generated from the original 11233x7946 scan):
// l0/l1 are whole-map images for zoomed-out views, l2/l3 are 1024px tiles so a
// close zoom loads only the visible area at full sharpness — no single image
// is too big for a phone to decode at full resolution.
const PLAN_LEVELS = [
  { name: 'l0', width: 1600, tiled: false, cols: 1, rows: 1 },
  { name: 'l1', width: 3600, tiled: false, cols: 1, rows: 1 },
  { name: 'l2', width: 7200, height: 5093, tiled: true, cols: 8, rows: 5 },
  { name: 'l3', width: 11233, height: 7946, tiled: true, cols: 11, rows: 8 },
] as const;
const PLAN_TILE = 1024;

/** Sharpest level the screen can actually show at this zoom. */
function planLevelFor(view: ViewState): number {
  const needed = view.size.width * view.zoom * (window.devicePixelRatio || 1);
  const i = PLAN_LEVELS.findIndex((l) => l.width >= needed);
  return i === -1 ? PLAN_LEVELS.length - 1 : i;
}

function MasterPlanImage({ view, loaded, onLoad }: { view: ViewState; loaded: boolean; onLoad: () => void }) {
  // Switch to a sharper level only once zooming settles, so a pinch doesn't
  // fire off tile requests for every in-between zoom.
  const [level, setLevel] = useState(0);
  const target = view.size.width > 0 ? planLevelFor(view) : 0;
  useEffect(() => {
    if (view.interacting) return;
    const t = window.setTimeout(() => setLevel(target), 150);
    return () => window.clearTimeout(t);
  }, [target, view.interacting]);

  const lvl = PLAN_LEVELS[level];
  let tiles: { key: string; src: string; style: React.CSSProperties }[] = [];
  if (lvl.tiled && view.size.width > 0) {
    // Visible part of the map, as fractions of its width/height (plus half a
    // tile of margin so panning doesn't show unloaded edges).
    const { zoom, pan, size } = view;
    const fx = (sx: number) => (size.width / 2 + (sx - size.width / 2 - pan.x) / zoom) / size.width;
    const fy = (sy: number) => (size.height / 2 + (sy - size.height / 2 - pan.y) / zoom) / size.height;
    const mx = (PLAN_TILE / lvl.width) / 2;
    const my = (PLAN_TILE / lvl.height) / 2;
    const x0 = fx(0) - mx, x1 = fx(size.width) + mx, y0 = fy(0) - my, y1 = fy(size.height) + my;
    for (let ty = 0; ty < lvl.rows; ty++) {
      const top = (ty * PLAN_TILE) / lvl.height;
      const bottom = Math.min(1, ((ty + 1) * PLAN_TILE) / lvl.height);
      if (bottom < y0 || top > y1) continue;
      for (let tx = 0; tx < lvl.cols; tx++) {
        const left = (tx * PLAN_TILE) / lvl.width;
        const right = Math.min(1, ((tx + 1) * PLAN_TILE) / lvl.width);
        if (right < x0 || left > x1) continue;
        tiles.push({
          key: `${lvl.name}-${tx}-${ty}`,
          src: `/master-plan/${lvl.name}/${tx}_${ty}.webp`,
          style: { left: `${left * 100}%`, top: `${top * 100}%`, width: `${(right - left) * 100}%`, height: `${(bottom - top) * 100}%` },
        });
      }
    }
  }
  if (!lvl.tiled) tiles = [];

  return (
    <>
      <img
        src="/master-plan/l0.webp"
        alt="Zion Hills master plan"
        onLoad={onLoad}
        className={`absolute inset-0 h-full w-full transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
        draggable={false}
      />
      {level >= 1 && (
        <img src="/master-plan/l1.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full" draggable={false} />
      )}
      {tiles.map((t) => (
        <img key={t.key} src={t.src} alt="" aria-hidden decoding="async" className="absolute" style={t.style} draggable={false} />
      ))}
    </>
  );
}

/** Plot outlines drawn on the map (inside the zoomed layer, in % coordinates). */
function PlotShapes({ plots, highlight, hoverId, selectedId, large }: {
  plots: Plot[];
  highlight: Set<string> | null;
  hoverId: string | null;
  selectedId?: string | null;
  large?: boolean;
}) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {plots.map((p) => {
        const c = SHAPE_COLORS[p.status];
        const dim = highlight !== null && !highlight.has(p.id);
        const glow = highlight !== null && highlight.has(p.id);
        const hot = p.id === hoverId || p.id === selectedId;
        return (
          <polygon
            key={p.id}
            points={outlineOf(p).map(([x, y]) => `${x},${y}`).join(' ')}
            fill={dim ? '#ffffff' : c.fill}
            fillOpacity={dim ? 0.08 : hot ? 0.75 : 0.5}
            stroke={dim ? '#9ca3af' : c.stroke}
            strokeOpacity={dim ? 0.5 : 1}
            strokeWidth={hot ? (large ? 4 : 3) : large ? 2.5 : 1.75}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
                       style={glow ? { filter: `drop-shadow(0 0 3px ${c.fill})` } : undefined}
          />
        );
      })}
    </svg>
  );
}

function MasterPlanBoard({ plots, highlight = null, onSelect, onExpand, large, selectedId, tooltip = 'internal', bare }: {
  plots: Plot[];
  /** Plots matching the active filters; null = no filter (everything at full colour). */
  highlight?: Set<string> | null;
  onSelect: (p: Plot) => void;
  onExpand?: () => void;
  /** Presentation mode: thicker outlines, bigger controls. */
  large?: boolean;
  selectedId?: string | null;
  /** 'buyer' tooltips never show internal status wording beyond Available/Sold. */
  tooltip?: 'internal' | 'buyer';
  /** No card frame (presentation mode supplies its own). */
  bare?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hovered = hoverId ? plots.find((p) => p.id === hoverId) ?? null : null;

  const board = (
    <div className={`relative w-full bg-gray-100 ${bare ? 'overflow-hidden rounded-xl' : ''}`} style={{ aspectRatio: '3369.9 / 2383.8' }}>
      {!loaded && <div className="skeleton absolute inset-0" />}

      <ZoomPanMap
        controlsClassName={large ? 'scale-125 origin-bottom-left' : ''}
        onTap={(pt) => { const hit = plotAt(plots, pt); if (hit) onSelect(hit); }}
        onHover={(pt) => setHoverId(pt ? plotAt(plots, pt)?.id ?? null : null)}
        mapLayer={(view) => (
          <>
            <MasterPlanImage view={view} loaded={loaded} onLoad={() => setLoaded(true)} />
            {loaded && <PlotShapes plots={plots} highlight={highlight} hoverId={hoverId} selectedId={selectedId} large={large} />}
          </>
        )}
        overlay={({ zoom, pan, size }) => {
          if (!loaded || !hovered) return null;
          const [cx, cy] = centroidOf(hovered);
          const x = size.width / 2 + pan.x + zoom * ((cx / 100) * size.width - size.width / 2);
          const y = size.height / 2 + pan.y + zoom * ((cy / 100) * size.height - size.height / 2);
          return (
            <div
              className="pointer-events-none absolute z-20 hidden w-max max-w-[240px] -translate-x-1/2 -translate-y-full rounded-lg bg-gray-900/95 px-2.5 py-1.5 text-left text-white shadow-xl sm:block"
              style={{ left: x, top: y - 10 }}
            >
              <div className="text-[12px] font-bold">
                Plot {hovered.plotNo} · {tooltip === 'buyer' ? SHAPE_COLORS[hovered.status].label : hovered.status}
              </div>
              <div className="text-[11px] text-white/70">{hovered.bedrooms}BHK · {hovered.phase} · {formatCr(hovered.cost.totalCostLacs)}</div>
            </div>
          );
        }}
      />

      {onExpand && (
        <button
          onClick={onExpand}
          className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11.5px] font-semibold text-gray-600 shadow backdrop-blur hover:bg-white"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Expand
        </button>
      )}
    </div>
  );

  if (bare) return board;
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white card-shadow">
      {board}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-gray-100 px-3 py-2 text-[11px] text-gray-500">
        {(Object.keys(SHAPE_COLORS) as PlotStatus[]).map((st) => (
          <span key={st} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SHAPE_COLORS[st].fill }} /> {SHAPE_COLORS[st].label}
          </span>
        ))}
        <span className="text-gray-400 sm:hidden">· Pinch or use +/- to zoom, tap a plot</span>
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
        <div className="shrink-0 space-y-3 border-t border-gray-100 px-4 py-3">
          <SendToBuyer plot={plot} />
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

/** Share one plot with a buyer: WhatsApp message with a public link, or open the quote. */
function SendToBuyer({ plot, dark }: { plot: Plot; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const sender = getCurrentUser()?.full_name;
  const input = `w-full rounded-xl border px-3 py-2 text-[13px] outline-none ${dark ? 'border-white/15 bg-white/10 text-white placeholder:text-white/40 focus:border-white/40' : 'border-gray-200 bg-white text-gray-800 focus:border-emerald-300'}`;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${dark ? 'bg-white text-gray-900 hover:bg-white/90' : 'brand-gradient text-white hover:opacity-95'}`}
      >
        <Share2 className="h-4 w-4" /> Send to buyer
      </button>
    );
  }
  return (
    <div className={`space-y-2 rounded-xl p-3 ${dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-gray-50'}`}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Buyer's name" className={input} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="WhatsApp number (optional)" className={input} />
      <div className="flex gap-2">
        <a
          href={whatsappLink(plot, name, phone, sender)}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-[13px] font-semibold text-white hover:opacity-95"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <a
          href={plotShareLink(plot, name, sender)}
          target="_blank"
          rel="noreferrer"
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          <FileText className="h-4 w-4" /> Quote / PDF
        </a>
      </div>
      <p className={`text-[11px] ${dark ? 'text-white/50' : 'text-gray-400'}`}>The link shows only this plot's details and price — nothing internal.</p>
    </div>
  );
}

/**
 * Full-screen showroom view for buyers: just the master plan, plot outlines,
 * simple filters and a buyer-friendly plot card. No hold/sold controls, no
 * rate maths, no internal notes.
 */
const PLAN_RATIO = 3369.9 / 2383.8;
const PAPER = '#d7dac7'; // the master plan's own paper colour, so no bars show around it

function BuyerPresentation({ plots, onClose }: { plots: Plot[]; onClose: () => void }) {
  const [bhk, setBhk] = useState<3 | 4 | 'All'>('All');
  const [phase, setPhase] = useState<string>('All');
  const [budget, setBudget] = useState<BudgetId | 'All'>('All');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selected, setSelected] = useState<Plot | null>(null);
  // The map is sized to the space actually left under the header, so it can
  // never spill over the header (which hid the Exit button on phones).
  const areaRef = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState(0);
  const [roomy, setRoomy] = useState(false); // tall, narrow screen — suggest turning the phone

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const fit = () => {
      const w = Math.floor(Math.min(el.clientWidth, el.clientHeight * PLAN_RATIO));
      setMapWidth(w);
      setRoomy(el.clientHeight - w / PLAN_RATIO > 160);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // Real full screen where the browser allows it; the overlay works either way.
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [onClose]);

  const matches = plots.filter((p) =>
    (bhk === 'All' || p.bedrooms === bhk) && (phase === 'All' || p.phase === phase) && inBudget(p, budget) && (!availableOnly || p.status === 'Available'));
  const filtering = bhk !== 'All' || phase !== 'All' || budget !== 'All' || availableOnly;
  const highlight = filtering ? new Set(matches.map((p) => p.id)) : null;
  const chip = (on: boolean) => `shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold shadow-sm transition sm:px-4 sm:text-sm ${on ? 'bg-[#1f3a2b] text-white' : 'bg-white/85 text-gray-700 hover:bg-white'}`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: PAPER, height: '100dvh' }}>
      {/* Brand bar — always visible */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 sm:pt-3">
        <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
          <span className="font-display text-lg font-bold tracking-[0.18em] text-[#1f3a2b] sm:text-2xl">ZION HILLS</span>
          <span className="hidden truncate text-sm text-[#1f3a2b]/70 sm:inline">Golf County · Master Plan</span>
        </div>
        <button onClick={onClose} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/85 px-3.5 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-white">
          <X className="h-4 w-4" /> Exit
        </button>
      </div>

      {/* "Show me" filters — one swipeable row on phones */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:px-6 lg:flex-wrap lg:overflow-visible">
        <button onClick={() => setBhk('All')} className={chip(bhk === 'All')}>All homes</button>
        {BEDROOM_OPTIONS.map((b) => <button key={b} onClick={() => setBhk(b)} className={chip(bhk === b)}>{b}BHK</button>)}
        <span className="mx-0.5 h-6 w-px shrink-0 bg-[#1f3a2b]/20" />
        {BUDGETS.map((b) => (
          <button key={b.id} onClick={() => setBudget(budget === b.id ? 'All' : b.id)} className={chip(budget === b.id)}>{b.label}</button>
        ))}
        <span className="mx-0.5 h-6 w-px shrink-0 bg-[#1f3a2b]/20" />
        {PHASES.map((ph) => (
          <button key={ph} onClick={() => setPhase(phase === ph ? 'All' : ph)} className={chip(phase === ph)}>{ph}</button>
        ))}
        <button onClick={() => setAvailableOnly((v) => !v)} className={chip(availableOnly)}>Available only</button>
      </div>
      {filtering && (
        <div className="shrink-0 px-3 pb-2 text-[13px] font-medium text-[#1f3a2b] sm:px-6">
          {matches.length === 0 ? 'No homes match — try another budget' : `${matches.length} home${matches.length === 1 ? '' : 's'} match`}
        </div>
      )}

      {/* Map — fits the remaining space exactly */}
      <div ref={areaRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-2 sm:px-4 sm:pb-3">
        {mapWidth > 0 && (
          <div className="relative" style={{ width: mapWidth }}>
            <MasterPlanBoard plots={plots} highlight={highlight} onSelect={setSelected} large bare tooltip="buyer" selectedId={selected?.id} />
            {/* Legend floats on the map so it costs no height on phones */}
            <div className="pointer-events-none absolute bottom-2 right-2 z-30 flex gap-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-medium text-gray-700 shadow-sm sm:text-[12px]">
              {(Object.keys(SHAPE_COLORS) as PlotStatus[]).map((st) => (
                <span key={st} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SHAPE_COLORS[st].fill }} /> {SHAPE_COLORS[st].label}
                </span>
              ))}
            </div>
            {roomy && <p className="mt-3 text-center text-[13px] text-[#1f3a2b]/70">Turn your phone sideways for a bigger map · pinch to zoom</p>}
          </div>
        )}
      </div>

      {/* Buyer plot card */}
      {selected && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setSelected(null)}>
          <div className="animate-scale-in max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#13261c] text-white shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 pt-5">
              <div>
                <div className="text-sm text-white/60">{selected.phase}</div>
                <div className="font-display text-3xl font-bold">Plot {selected.plotNo}</div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 px-6 py-4">
              <BuyerFact icon={Home} label="Villa" value={`${selected.bedrooms}BHK`} />
              <BuyerFact icon={Ruler} label="Plot" value={`${Math.round(selected.landAreaSft).toLocaleString('en-IN')} sq ft`} />
              <BuyerFact icon={BedDouble} label="Built-up" value={`${selected.builtUpSft.toLocaleString('en-IN')} sq ft`} />
            </div>
            <div className="mx-6 rounded-2xl bg-white/5 px-5 py-4 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Price (all-inclusive, with GST)</div>
              <div className="font-display text-3xl font-bold">{formatCr(selected.cost.totalCostLacs)}</div>
              <div className="mt-1 inline-flex items-center gap-1.5 text-sm" style={{ color: SHAPE_COLORS[selected.status].fill }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SHAPE_COLORS[selected.status].fill }} />
                {selected.status === 'Available' ? 'Available now' : SHAPE_COLORS[selected.status].label}
              </div>
            </div>
            <div className="px-6 py-5">
              <SendToBuyer plot={selected} dark />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BuyerFact({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
      <Icon className="h-4 w-4 text-white/50" />
      <div className="mt-2 text-[11px] uppercase tracking-wide text-white/50">{label}</div>
      <div className="text-[15px] font-semibold">{value}</div>
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
