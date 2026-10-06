import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react';
import {
  Search, X, List as ListIcon, Map as MapIcon, ChevronDown,
  BedDouble, CheckCircle2, Trash2, Receipt, Tag, Clock3, Plus, Minus, RotateCcw,
  Presentation, Share2, FileText, Ruler, Home, MessageCircle, Smartphone, Tablet, Eye,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { SAMPLE_PLOTS, PHASES, PLOT_STATUSES, BEDROOM_OPTIONS, STATUS_COLORS, type Plot, type PlotStatus } from '@/lib/inventory';
import { BUDGETS, inBudget, outlineOf, centroidOf, plotAt, SHAPE_COLORS, plotShareLink, type BudgetId } from '@/lib/plotMap';
import { getCurrentUser } from '@/lib/auth';
import { createQuoteLink, quoteUrl, quoteMessage, whatsappTo } from '@/lib/quoteLinks';
import { SentQuotesPanel } from './QuoteActivity';
import { VideoModal, TestimonialButton } from './ShowcaseMedia';
import { loadShowcase, renderFor, viewFor, type Showcase } from '@/lib/showcase';
import { DirectionsControls, type DirectionsView } from './Directions';
import { loadCalibration, fitTransform } from '@/lib/tour';

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
  const [sentQuotes, setSentQuotes] = useState(false);
  const [selected, setSelected] = useState<Plot | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');

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
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex w-full items-center justify-end gap-2">
          <button
            onClick={() => setSentQuotes(true)}
            title="Quotes sent to buyers — who opened them and when"
            className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 card-shadow hover:bg-gray-50 sm:px-3.5"
          >
            <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Sent quotes</span>
          </button>
          <a
            href="#/tour/remote"
            title="On your phone: share the cart's live location with another screen"
            className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 card-shadow hover:bg-gray-50 sm:px-3.5"
          >
            <Smartphone className="h-4 w-4" /> <span className="hidden sm:inline">Tour (phone)</span>
          </a>
          <a
            href="#/tour/screen"
            title="Start the live cart tour on this device"
            className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 card-shadow hover:bg-gray-50 sm:px-3.5"
          >
            <Tablet className="h-4 w-4" /> <span className="hidden sm:inline">Live tour</span>
          </a>
          <button
            onClick={() => {
              // Lock the page behind before the map measures the screen, so the
              // page's scrollbar doesn't leave a strip down the side.
              document.documentElement.style.overflow = 'hidden';
              setPresenting(true);
            }}
            className="flex items-center gap-2 rounded-full brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            <Presentation className="h-4 w-4" /> <span className="hidden sm:inline">Present to buyer</span><span className="sm:hidden">Present</span>
          </button>
          </div>
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
          <MasterPlanBoard plots={plots} highlight={highlight} onSelect={setSelected} />
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

      {sentQuotes && <SentQuotesPanel onClose={() => setSentQuotes(false)} />}

      {/* Portalled to <body> so no animated/transformed ancestor can offset or clip it. */}
      {presenting && createPortal(
        <BuyerPresentation plots={plots} onClose={() => { document.documentElement.style.overflow = ''; setPresenting(false); }} />,
        document.body,
      )}

    </div>
  );
}

const MAP_RATIO = 3369.9 / 2383.8;
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;

type Size = { width: number; height: number };

/**
 * Pinch-to-zoom, drag-to-pan, scroll-to-zoom wrapper, plus +/- buttons for devices without gestures.
 *
 * The scaled `mapLayer` (the image) and the un-scaled `overlay` (pins) are rendered as siblings inside
 * the same gesture-handling container: the map gets a CSS transform so panning/zooming is instant and
 * GPU-smooth, while pins are placed with plain pixel math so they never grow or shrink with zoom and
 * are never fuzzy or misaligned.
 */
// `size` is the map layer's un-zoomed size; `viewport` is the visible box. They are
// equal when the map is fitted (contain); with `cover` the layer is larger than
// the viewport so the map fills it edge to edge and the rest is reached by dragging.
type ViewState = { zoom: number; pan: { x: number; y: number }; size: Size; viewport: Size; interacting: boolean };
type OverlayState = { zoom: number; pan: { x: number; y: number }; size: Size; viewport: Size; rotation: number };

/** Where the map should look. `durationMs` glides there slowly (the welcome
 *  fly-in); change `nonce` to fly to the same place again. With `exact`, the
 *  zoom is set as given (it may zoom out); otherwise it only ever zooms in. */
export type MapFocus = { pt: [number, number]; zoom: number; offsetY?: number; durationMs?: number; nonce?: number; exact?: boolean };

/** Full-screen maps can be dragged this many px past the plan's edge. */
const EDGE_OVERSCROLL = 120;

function ZoomPanMap({
  mapLayer,
  overlay,
  onTap,
  onHover,
  controlsClassName = '',
  cover = false,
  focus = null,
  onUserMove,
  rotation = 0,
  turnable = false,
}: {
  mapLayer: (state: ViewState) => ReactNode;
  overlay: (state: OverlayState) => ReactNode;
  /** Fill the whole viewport (cropping, draggable) instead of fitting inside it. */
  cover?: boolean;
  /** Keep this map point (in %) centred — e.g. the cart during a live tour.
   *  `offsetY` (px) puts it that far below the centre instead (more road ahead). */
  focus?: MapFocus | null;
  /** Turn the map this many degrees anticlockwise about the screen centre
   *  (heading-up: the direction of travel points to the top of the screen).
   *  May run past ±360 so a turn through north animates the short way. */
  rotation?: number;
  /** The map may be turned (heading-up): make it big enough that its edges
   *  never show in the screen's corners, whatever the angle. */
  turnable?: boolean;
  /** The user dragged or pinched the map (so a follow mode can pause). */
  onUserMove?: () => void;
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
  // Pinch: the map point under the fingers' midpoint stays under them while zooming.
  const pinch = useRef<{ startDist: number; startZoom: number; d0: { x: number; y: number }; m: { x: number; y: number } } | null>(null);
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

  // Screen ↔ map-frame directions while the map is turned.
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const unturn = (dx: number, dy: number) => ({ x: dx * cos - dy * sin, y: dx * sin + dy * cos });

  function clampZoom(z: number) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  }

  // Un-zoomed map layer: the viewport itself, or — with `cover` — the smallest
  // map-shaped box that fills it, centred.
  // When the map can turn, the area it must cover is a square as wide as the
  // screen's diagonal (the screen's corners sweep that circle as it turns).
  const diag = Math.hypot(size.width, size.height);
  const reach: Size = turnable ? { width: diag, height: diag } : size;
  const layer: Size = !cover || size.width === 0
    ? size
    : (() => {
        const w = Math.max(reach.width, reach.height * MAP_RATIO);
        return { width: w, height: w / MAP_RATIO };
      })();

  /** Screen point → point on the (un-zoomed) map, in % of its width/height. */
  function toMapPct(clientX: number, clientY: number): [number, number] | null {
    const el = viewportRef.current;
    if (!el || size.width === 0) return null;
    const r = el.getBoundingClientRect();
    const d = unturn(clientX - r.left - size.width / 2, clientY - r.top - size.height / 2);
    const x = layer.width / 2 + (d.x - pan.x) / zoom;
    const y = layer.height / 2 + (d.y - pan.y) / zoom;
    return [(x / layer.width) * 100, (y / layer.height) * 100];
  }

  // How far the map may be dragged: until its edge meets the edge of what the
  // screen shows. When the map is turned, the screen covers a tilted rectangle,
  // so measure its extent along the map's own axes (not the worst case at every
  // angle), plus a little extra in full-screen mode so a corner can be dragged
  // out from under the floating buttons and banners.
  const absCos = Math.abs(cos), absSin = Math.abs(sin);
  const halfW = turnable ? (size.width * absCos + size.height * absSin) / 2 : size.width / 2;
  const halfH = turnable ? (size.width * absSin + size.height * absCos) / 2 : size.height / 2;
  const overscroll = cover ? EDGE_OVERSCROLL : 0;
  const panLimit = (z: number) => ({
    x: Math.max(0, (layer.width * z) / 2 - halfW + overscroll),
    y: Math.max(0, (layer.height * z) / 2 - halfH + overscroll),
  });

  /** Keeps the scaled image from being panned past its own edge (plus the overscroll). */
  function clampPan(p: { x: number; y: number }, z: number) {
    const { x: maxX, y: maxY } = panLimit(z);
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
  }
  const canPan = panLimit(zoom).x > 0.5 || panLimit(zoom).y > 0.5;

  // Follow mode: glide the view so the focus point sits in the centre.
  const fx = focus?.pt[0], fy = focus?.pt[1], fz = focus?.zoom, fo = focus?.offsetY ?? 0;
  const fd = focus?.durationMs, fn = focus?.nonce, fe = focus?.exact;
  const [glideMs, setGlideMs] = useState(0);
  // Following: zoom in to the focus zoom when following starts, then keep
  // whatever zoom the user picks (+ / − / pinch) while it keeps following.
  const following = useRef(false);
  // A one-off fly-to (`exact`) happens once per nonce, never again on zoom changes.
  const flown = useRef<number | undefined>(undefined);
  const focusOn = focus != null;
  useEffect(() => { if (!focusOn) following.current = false; }, [focusOn]);
  useEffect(() => {
    if (fx === undefined || fy === undefined || fz === undefined || layer.width === 0) return;
    if (pointers.current.size > 0) return; // never fight a finger on the map
    if (fe) {
      if (flown.current === fn) return;
      flown.current = fn;
    }
    if (fd) {
      setGlideMs(fd);
      window.setTimeout(() => setGlideMs(0), fd + 50);
    }
    const z = clampZoom(fe ? fz : following.current ? zoom : Math.max(zoom, fz));
    following.current = true;
    const o = unturn(0, fo);
    setZoom(z);
    setPan(clampPan({ x: -((fx / 100) * layer.width - layer.width / 2) * z + o.x, y: -((fy / 100) * layer.height - layer.height / 2) * z + o.y }, z));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, fy, fz, fo, fn, rotation, layer.width, layer.height, zoom]);

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
        const r = viewportRef.current?.getBoundingClientRect();
        const cx = (pts[0].x + pts[1].x) / 2 - (r?.left ?? 0) - size.width / 2;
        const cy = (pts[0].y + pts[1].y) / 2 - (r?.top ?? 0) - size.height / 2;
        const d0 = unturn(cx, cy);
        pinch.current = { startDist: dist, startZoom: zoom, d0, m: { x: layer.width / 2 + (d0.x - pan.x) / zoom, y: layer.height / 2 + (d0.y - pan.y) / zoom } };
      } else {
        dragged.current = true;
        onUserMove?.();
        const { d0, m, startZoom, startDist } = pinch.current;
        const z = clampZoom(startZoom * (dist / startDist));
        setZoom(z);
        setPan(clampPan({ x: d0.x - z * (m.x - layer.width / 2), y: d0.y - z * (m.y - layer.height / 2) }, z));
      }
    } else if (pts.length === 1 && canPan) {
      // A drag moves the map under the finger, whichever way the map is turned.
      const { x: dx, y: dy } = unturn(e.movementX, e.movementY);
      if (dx || dy) {
        setPan((p) => clampPan({ x: p.x + dx, y: p.y + dy }, zoom));
        if (dragStart.current) {
          const traveled = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
          if (traveled > DRAG_THRESHOLD) { dragged.current = true; onUserMove?.(); }
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
  const transition = interacting ? 'none' : glideMs ? `transform ${glideMs}ms cubic-bezier(0.45, 0, 0.15, 1)` : 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)';

  return (
    <div
      ref={viewportRef}
      className="absolute inset-0 touch-none select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onLostPointerCapture={endPointer}
      onPointerLeave={(e) => { endPointer(e); onHover?.(null); }}
      onWheel={onWheel}
      onClickCapture={onClickCapture}
    >
      {/* will-change only while a finger/mouse is moving the map: kept on, it makes
          the browser freeze the map at its first (zoomed-out) sharpness and just
          stretch that bitmap — the cause of the blurry zoom. */}
      {/* Turned frame (heading-up). Rotating about the screen centre keeps the
          cart — which follow mode puts there — in place while the map turns. */}
      <div
        className="absolute inset-0"
        style={rotation ? { transform: `rotate(${-rotation}deg)`, transformOrigin: 'center center', transition: 'transform 0.8s ease-out' } : { transition: 'transform 0.8s ease-out' }}
      >
      <div
        className={`absolute ${interacting ? 'will-change-transform' : ''}`}
        style={{
          left: (size.width - layer.width) / 2,
          top: (size.height - layer.height) / 2,
          width: layer.width || '100%',
          height: layer.height || '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition,
        }}
      >
        {/* While turned, the screen's corners reach further out than the screen
            itself, so load tiles for a square as wide as its diagonal. */}
        {mapLayer({ zoom, pan, size: layer, viewport: rotation || turnable ? { width: diag, height: diag } : size, interacting })}
      </div>

      {size.width > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {overlay({ zoom, pan, size: layer, viewport: size, rotation })}
        </div>
      )}
      </div>

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
    const { zoom, pan, size, viewport } = view;
    const fx = (sx: number) => (size.width / 2 + (sx - viewport.width / 2 - pan.x) / zoom) / size.width;
    const fy = (sy: number) => (size.height / 2 + (sy - viewport.height / 2 - pan.y) / zoom) / size.height;
    const mx = (PLAN_TILE / lvl.width) / 2;
    const my = (PLAN_TILE / lvl.height) / 2;
    const x0 = fx(0) - mx, x1 = fx(viewport.width) + mx, y0 = fy(0) - my, y1 = fy(viewport.height) + my;
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

export type TourMarker = { pt: [number, number]; accuracyPct?: number; heading?: number | null };

export function MasterPlanBoard({
  plots, highlight = null, onSelect, large, selectedId, tooltip = 'internal', bare, cover,
  marker = null, focus = null, onUserMove, onMapPoint, pins = [], rotation = 0, turnable = false, route = null, places = [], destination = null, offRoad = false,
}: {
  plots: Plot[];
  /** Plots matching the active filters; null = no filter (everything at full colour). */
  highlight?: Set<string> | null;
  onSelect: (p: Plot) => void;
  /** Presentation mode: thicker outlines, bigger controls. */
  large?: boolean;
  selectedId?: string | null;
  /** 'buyer' tooltips never show internal status wording beyond Available/Sold. */
  tooltip?: 'internal' | 'buyer';
  /** No card frame (presentation mode supplies its own). */
  bare?: boolean;
  /** Fill the parent edge to edge (presentation mode) instead of a map-shaped box. */
  cover?: boolean;
  /** Live tour: the cart's position ("You are here"). */
  marker?: TourMarker | null;
  focus?: MapFocus | null;
  onUserMove?: () => void;
  /** Heading-up: degrees to turn the map anticlockwise (see ZoomPanMap). */
  rotation?: number;
  turnable?: boolean;
  /** Calibration: taps report the raw map point instead of selecting a plot. */
  onMapPoint?: (pt: [number, number]) => void;
  /** Numbered pins (calibration points). */
  pins?: { pt: [number, number]; label: string; tone?: 'ok' | 'warn' | 'new' }[];
  /** Directions: the line to follow, in % of the plan. */
  route?: [number, number][] | null;
  /** Labelled places layer (clubhouse, entry gates…). */
  places?: { pt: [number, number]; label: string; kind?: 'villa' }[];
  /** Where the directions lead (a flag is drawn there). */
  destination?: { pt: [number, number]; label: string } | null;
  /** The cart has left the road: the dot and the route line turn red. */
  offRoad?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hovered = hoverId ? plots.find((p) => p.id === hoverId) ?? null : null;

  const board = (
    <div
      className={`relative w-full ${cover ? 'h-full bg-[#d4d5c6]' : 'bg-gray-100'} ${bare && !cover ? 'overflow-hidden rounded-xl' : ''}`}
      style={cover ? undefined : { aspectRatio: '3369.9 / 2383.8' }}
    >
      {!loaded && <div className="skeleton absolute inset-0" />}

      <ZoomPanMap
        cover={cover}
        // On phones the zoom buttons sit mid-left, clear of the directions banner and bottom buttons.
        controlsClassName={large ? 'max-sm:bottom-auto max-sm:top-1/2 max-sm:-translate-y-1/2 sm:scale-125 sm:origin-bottom-left' : ''}
        focus={focus}
        onUserMove={onUserMove}
        rotation={rotation}
        turnable={turnable}
        onTap={(pt) => {
          if (onMapPoint) { onMapPoint(pt); return; }
          const hit = plotAt(plots, pt);
          if (hit) onSelect(hit);
        }}
        onHover={(pt) => setHoverId(pt ? plotAt(plots, pt)?.id ?? null : null)}
        mapLayer={(view) => (
          <>
            <MasterPlanImage view={view} loaded={loaded} onLoad={() => setLoaded(true)} />
            {loaded && <PlotShapes plots={plots} highlight={highlight} hoverId={hoverId} selectedId={selectedId} large={large} />}
          </>
        )}
        overlay={({ zoom, pan, size, viewport, rotation: turned }) => {
          if (!loaded) return null;
          const toScreen = ([px, py]: [number, number]) => [
            viewport.width / 2 + pan.x + zoom * ((px / 100) * size.width - size.width / 2),
            viewport.height / 2 + pan.y + zoom * ((py / 100) * size.height - size.height / 2),
          ];
          // Labels stay upright even when the map is turned (heading-up).
          const upright = turned ? { transform: `rotate(${turned}deg)` } : undefined;
          const extras = (
            <>
              {route && route.length > 1 && (
                <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" style={{ zIndex: 15 }}>
                  <polyline points={route.map((q) => toScreen(q).join(',')).join(' ')} fill="none" stroke="white" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points={route.map((q) => toScreen(q).join(',')).join(' ')} fill="none" stroke={offRoad ? '#dc2626' : '#f05a22'} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points={route.map((q) => toScreen(q).join(',')).join(' ')} fill="none" stroke="white" strokeOpacity={0.7} strokeWidth={2} strokeDasharray="2 10" strokeLinecap="round" className="animate-route-flow" />
                </svg>
              )}
              {places.map((pl, i) => {
                const [px, py] = toScreen(pl.pt);
                return (
                  <div key={`pl-${i}`} className="absolute z-20" style={{ left: px, top: py, ...upright, transformOrigin: '0 0' }}>
                    <div
                      title={pl.kind === 'villa' ? `Villa ${pl.label}` : undefined}
                      className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full py-0.5 pl-1 pr-2 text-[11px] font-semibold text-white shadow ring-1 ring-white/30 ${pl.kind === 'villa' ? 'bg-[#f05a22]' : 'bg-[#13261c]/90'}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${pl.kind === 'villa' ? 'bg-white' : 'bg-[#e9dcc0]'}`} /> {pl.label}
                    </div>
                  </div>
                );
              })}
              {destination && (() => {
                const [dx, dy] = toScreen(destination.pt);
                return (
                  <div className="absolute z-30" style={{ left: dx, top: dy, ...upright, transformOrigin: '0 0' }}>
                    <div className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center" style={{ marginTop: 5 }}>
                      <div className="whitespace-nowrap rounded-full bg-red-600 px-2.5 py-1 text-[12px] font-bold text-white shadow-lg">{destination.label}</div>
                      <div className="h-3 w-0.5 bg-red-600" />
                      <div className="h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
                    </div>
                  </div>
                );
              })()}
              {pins.map((pin, i) => {
                const [px, py] = toScreen(pin.pt);
                const tone = pin.tone === 'warn' ? 'bg-amber-500' : pin.tone === 'new' ? 'bg-orange-600 animate-pulse' : 'bg-emerald-600';
                return (
                  <div key={i} className={`absolute z-20 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[11px] font-bold text-white shadow ring-2 ring-white ${tone}`} style={{ left: px, top: py }}>
                    {pin.label}
                  </div>
                );
              })}
              {marker && (() => {
                const [mx, my] = toScreen(marker.pt);
                const halo = marker.accuracyPct ? Math.max(14, (marker.accuracyPct / 100) * size.width * zoom) : 0;
                // Always Google blue; leaving the road shows on the route line and banner instead.
                const dot = '#1a73e8';
                // Google Maps-style "you are here": soft accuracy circle, a light
                // beam showing which way you're heading, and the dot.
                return (
                  <div className="absolute z-30" style={{ left: mx, top: my }}>
                    {halo > 0 && (
                      <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border" style={{ width: halo * 2, height: halo * 2, borderColor: `${dot}40`, backgroundColor: `${dot}1a` }} />
                    )}
                    {marker.heading != null && (
                      <svg width="72" height="72" viewBox="-36 -36 72 72" className="absolute -translate-x-1/2 -translate-y-1/2 overflow-visible" style={{ transform: `translate(-50%, -50%) rotate(${marker.heading}deg)` }}>
                        <defs>
                          <radialGradient id="gm-beam" cx="0" cy="0" r="36" gradientUnits="userSpaceOnUse">
                            <stop offset="0.2" stopColor={dot} stopOpacity="0.45" />
                            <stop offset="1" stopColor={dot} stopOpacity="0" />
                          </radialGradient>
                        </defs>
                        <path d="M0 0 L-17 -32 A36 36 0 0 1 17 -32 Z" fill="url(#gm-beam)" />
                      </svg>
                    )}
                    <div className="absolute h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.35)] ring-[3px] ring-white" style={{ backgroundColor: dot }} />
                  </div>
                );
              })()}
            </>
          );
          if (!hovered) return extras;
          const [x, y] = toScreen(centroidOf(hovered));
          return (
            <>
            {extras}
            <div
              className="pointer-events-none absolute z-20 hidden w-max max-w-[240px] -translate-x-1/2 -translate-y-full rounded-lg bg-gray-900/95 px-2.5 py-1.5 text-left text-white shadow-xl sm:block"
              style={{ left: x, top: y - 10 }}
            >
              <div className="text-[12px] font-bold">
                Plot {hovered.plotNo} · {tooltip === 'buyer' ? SHAPE_COLORS[hovered.status].label : hovered.status}
              </div>
              <div className="text-[11px] text-white/70">{hovered.bedrooms}BHK · {hovered.phase} · {formatCr(hovered.cost.totalCostLacs)}</div>
            </div>
            </>
          );
        }}
      />

    </div>
  );

  if (bare) return board;
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white card-shadow">
      {board}
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
function SendToBuyer({ plot, dark, defaultName = '' }: { plot: Plot; dark?: boolean; defaultName?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState('');
  const sender = getCurrentUser()?.full_name;
  const [busy, setBusy] = useState(false);
  // Each send creates a tracked link (#/q/…) so the team sees when the buyer
  // opens it. The window is opened straight away (before the save) so phones
  // don't treat it as an unwanted pop-up.
  async function send(kind: 'whatsapp' | 'preview') {
    const w = window.open('about:blank', '_blank');
    setBusy(true);
    const id = await createQuoteLink(plot, name, phone, sender);
    setBusy(false);
    const link = id ? quoteUrl(id) : plotShareLink(plot, name, sender);
    const target = kind === 'whatsapp' ? whatsappTo(phone, quoteMessage(plot, name, link)) : link;
    if (w) w.location.href = target;
    else window.location.href = target;
  }
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
        <button
          onClick={() => void send('whatsapp')}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-[13px] font-semibold text-white hover:opacity-95 disabled:opacity-60"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </button>
        <button
          onClick={() => void send('preview')}
          disabled={busy}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold disabled:opacity-60 ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          <FileText className="h-4 w-4" /> Quote / PDF
        </button>
      </div>
      <p className={`text-[11px] ${dark ? 'text-white/50' : 'text-gray-400'}`}>A personal invitation page for this buyer — only this plot, nothing internal. You'll see when they open it.</p>
    </div>
  );
}

/**
 * Full-screen showroom view for buyers: the master plan fills the whole screen
 * edge to edge (drag to see the rest), with filters and Exit floating on top.
 * No hold/sold controls, no rate maths, no internal notes.
 */
function BuyerPresentation({ plots, onClose }: { plots: Plot[]; onClose: () => void }) {
  const [bhk, setBhk] = useState<3 | 4 | 'All'>('All');
  const [phase, setPhase] = useState<string>('All');
  const [budget, setBudget] = useState<BudgetId | 'All'>('All');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selected, setSelected] = useState<Plot | null>(null);
  const [showcase, setShowcase] = useState<Showcase>({});
  const [video, setVideo] = useState(false);
  const [dirView, setDirView] = useState<DirectionsView>({ route: null, destination: null, places: [] });
  const [toGps, setToGps] = useState<((pt: [number, number]) => { lat: number; lng: number }) | null>(null);

  useEffect(() => { void loadShowcase().then(setShowcase); }, []);
  // Calibration only to show distances in metres on the directions.
  useEffect(() => {
    void loadCalibration().then((c) => { const tf = fitTransform(c); if (tf) setToGps(() => (pt: [number, number]) => tf.toGps(pt)); }).catch(() => {});
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
  const chip = (on: boolean) => `shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold shadow-md backdrop-blur transition sm:px-4 sm:text-sm ${on ? 'bg-[#1f3a2b] text-white' : 'bg-white/85 text-gray-800 hover:bg-white'}`;
  const selectedRender = selected ? renderFor(showcase, selected.id, selected.bedrooms) : undefined;
  const selectedView = selected ? viewFor(showcase, selected.id) : undefined;

  return (
    <div data-buyer-facing className="fixed inset-0 z-[60] overflow-hidden bg-[#d4d5c6]" style={{ height: '100dvh' }}>
      {/* The map, edge to edge */}
      <div className="absolute inset-0">
        <MasterPlanBoard
          plots={plots} highlight={highlight} onSelect={setSelected} large bare cover tooltip="buyer" selectedId={selected?.id}
          route={dirView.route} destination={dirView.destination} places={dirView.places}
        />
      </div>

      {/* Floating controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <div className="flex items-start gap-2">
          <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible">
            <button onClick={() => setBhk('All')} className={chip(bhk === 'All')}>All homes</button>
            {BEDROOM_OPTIONS.map((b) => <button key={b} onClick={() => setBhk(b)} className={chip(bhk === b)}>{b}BHK</button>)}
            <div className="relative shrink-0">
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value as BudgetId | 'All')}
                aria-label="Budget"
                className={`${chip(budget !== 'All')} cursor-pointer appearance-none pr-9 outline-none`}
              >
                <option value="All">All budgets</option>
                {BUDGETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${budget !== 'All' ? 'text-white' : 'text-gray-500'}`} />
            </div>
            {PHASES.map((ph) => (
              <button key={ph} onClick={() => setPhase(phase === ph ? 'All' : ph)} className={chip(phase === ph)}>{ph}</button>
            ))}
            <button onClick={() => setAvailableOnly((v) => !v)} className={chip(availableOnly)}>Available only</button>
          </div>
          <button onClick={onClose} className="pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-sm font-semibold text-gray-800 shadow-md backdrop-blur hover:bg-white">
            <X className="h-4 w-4" /> Exit
          </button>
        </div>
        <DirectionsControls className="mt-1.5" toGps={toGps} onView={setDirView} />
        {filtering && (
          <div className="mt-1.5 inline-block rounded-full bg-white/85 px-3 py-1 text-[13px] font-semibold text-[#1f3a2b] shadow-md backdrop-blur">
            {matches.length === 0 ? 'No homes match — try another budget' : `${matches.length} home${matches.length === 1 ? '' : 's'} match`}
          </div>
        )}
      </div>

      {/* Owner stories */}
      {showcase.testimonial?.url && (
        <div className="absolute bottom-3 right-3 z-40 sm:right-5">
          <TestimonialButton onClick={() => setVideo(true)} />
        </div>
      )}

      {/* Buyer plot card */}
      {selected && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setSelected(null)}>
          <div className="animate-scale-in max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#13261c] text-white shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
            {selectedRender && (
              <div className="relative">
                <img src={selectedRender} alt={`Villa at plot ${selected.plotNo}`} className="aspect-[16/10] w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#13261c] to-transparent px-6 pb-2 pt-10 text-[11px] uppercase tracking-[0.2em] text-[#e9dcc0]">How it will look</div>
              </div>
            )}
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
            {selectedView && (
              <div className="px-6 pb-4">
                <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/50">The view from this plot</div>
                <img src={selectedView} alt={`View from plot ${selected.plotNo}`} className="aspect-[16/9] w-full rounded-2xl object-cover" />
              </div>
            )}
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

      {video && showcase.testimonial?.url && <VideoModal url={showcase.testimonial.url} caption={showcase.testimonial.caption} onClose={() => setVideo(false)} />}
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
