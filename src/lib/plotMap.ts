import { SAMPLE_PLOTS, type Plot, type PlotStatus } from './inventory';
import { PLOT_OUTLINES } from './plotOutlines';

export type Pt = [number, number];

/** Budget buttons for the "show me" filter (prices are in lakhs). */
export const BUDGETS = [
  { id: 'u5', label: 'Under ₹5 Cr', min: 0, max: 500 },
  { id: '5-6', label: '₹5–6 Cr', min: 500, max: 600 },
  { id: '6-7', label: '₹6–7 Cr', min: 600, max: 700 },
  { id: '7+', label: '₹7 Cr+', min: 700, max: Infinity },
] as const;
export type BudgetId = (typeof BUDGETS)[number]['id'];

export function inBudget(p: Plot, budget: BudgetId | 'All'): boolean {
  if (budget === 'All') return true;
  const b = BUDGETS.find((x) => x.id === budget)!;
  return p.cost.totalCostLacs >= b.min && p.cost.totalCostLacs < b.max;
}

export function outlineOf(p: Plot): Pt[] {
  return PLOT_OUTLINES[p.id] ?? [];
}

export function centroidOf(p: Plot): Pt {
  const o = outlineOf(p);
  if (o.length === 0) return [p.positionPct.x, p.positionPct.y];
  const sx = o.reduce((s, q) => s + q[0], 0);
  const sy = o.reduce((s, q) => s + q[1], 0);
  return [sx / o.length, sy / o.length];
}

function insidePolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The plot under a point on the map (in % of the map), if any. */
export function plotAt(plots: Plot[], pt: Pt): Plot | null {
  return plots.find((p) => insidePolygon(pt, outlineOf(p))) ?? null;
}

export const SHAPE_COLORS: Record<PlotStatus, { fill: string; stroke: string; label: string }> = {
  Available: { fill: '#10b981', stroke: '#047857', label: 'Available' },
  'On-Hold': { fill: '#0ea5e9', stroke: '#0369a1', label: 'On hold' },
  Sold: { fill: '#6b7280', stroke: '#374151', label: 'Sold' },
};

export function formatCrore(lacs: number): string {
  return `₹${(lacs / 100).toFixed(2)} Cr`;
}

export function formatLakh(lacs: number): string {
  return `₹${lacs.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} L`;
}

export function findPlot(id: string): Plot | undefined {
  return SAMPLE_PLOTS.find((p) => p.id === id);
}

/** Public, login-free link to one plot's page (optionally personalised). */
export function plotShareLink(p: Plot, buyerName?: string, senderName?: string): string {
  const q = new URLSearchParams();
  if (buyerName?.trim()) q.set('to', buyerName.trim());
  if (senderName?.trim()) q.set('by', senderName.trim());
  const qs = q.toString();
  return `${window.location.origin}/#/p/${encodeURIComponent(p.id)}${qs ? `?${qs}` : ''}`;
}
