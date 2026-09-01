// Zion Hills Golf County — Live Inventory Board data.
//
// HOW TO UPDATE THIS DATA (pricing, sizes, new/removed plots, etc.):
// Every plot below is a plain object in the SAMPLE_PLOTS array — there's no
// database or spreadsheet link yet, so edits mean editing this file directly:
//   1. Find the plot's line (search this file for its plot number, e.g. "622").
//   2. Edit whichever field changed — e.g. `cost.totalCostLacs` for a new
//      price, `builtUpSft` if the built-up area changed (this also drives the
//      3BHK/4BHK label automatically), `status` to mark it Sold/On-Hold.
//   3. Save the file — the dev server hot-reloads and the board updates.
// To add a brand-new plot, copy an existing line, give it a unique `id`, and
// set `positionPct` — that's the pin's {x, y} position as a percentage of the
// master plan image's width/height (0-100). To find it: open the master plan
// image, note the plot's pixel position, divide by the image's full pixel
// width/height, and multiply by 100.
// To bulk-update from a fresh spreadsheet export, the fastest path is to hand
// Claude the new file and ask it to regenerate this array — same as how this
// file was first generated from inventory.xlsx.

export type PlotStatus = 'Available' | 'Sold' | 'On-Hold';

export const PLOT_STATUSES: PlotStatus[] = ['Available', 'Sold', 'On-Hold'];

export const PHASES = ['Phase II', 'Enclave'] as const;

export const BEDROOM_OPTIONS = [3, 4] as const;

export interface PlotCostBreakdown {
  landRate: number; // Rs/sft
  constnRate: number; // Rs/sft
  landCostLacs: number;
  constnCostLacs: number;
  clubChargesLacs: number;
  landscapeChargesLacs: number;
  utilityChargesLacs: number;
  gstLacs: number;
  totalCostLacs: number;
}

export interface Plot {
  id: string;
  plotNo: string;
  phase: string;
  landAreaSft: number;
  builtUpSft: number;
  bedrooms: 3 | 4;
  status: PlotStatus;
  /** Hand-digitized position on the master plan image, in % of image width/height. */
  positionPct: { x: number; y: number };
  cost: PlotCostBreakdown;
}

export const STATUS_COLORS: Record<PlotStatus, { bg: string; border: string; text: string; dot: string; ring: string }> = {
  Available: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  Sold: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-600', dot: 'bg-gray-500', ring: 'ring-gray-200' },
  'On-Hold': { bg: 'bg-sky-50', border: 'border-sky-400', text: 'text-sky-700', dot: 'bg-sky-500', ring: 'ring-sky-200' },
};

export const SAMPLE_PLOTS: Plot[] = [
  { id: 'p-606', plotNo: '606', phase: 'Phase II', landAreaSft: 6971.2, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 34.17, y: 57.6 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 365.988, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 619.629 } },
  { id: 'p-608', plotNo: '608', phase: 'Phase II', landAreaSft: 6837.8, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 33.7, y: 55.99 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 358.986, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 612.627 } },
  { id: 'p-609', plotNo: '609', phase: 'Phase II', landAreaSft: 6810.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 33.45, y: 55.05 }, cost: { landRate: 5500, constnRate: 4650, landCostLacs: 374.55, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 628.191 } },
  { id: 'p-622', plotNo: '622', phase: 'Phase II', landAreaSft: 4920.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 31.6, y: 55.15 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 258.3, constnCostLacs: 167.4, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 32.652, totalCostLacs: 472.352 } },
  { id: 'p-623', plotNo: '623', phase: 'Phase II', landAreaSft: 4876.5, builtUpSft: 3500, bedrooms: 3, status: 'Available', positionPct: { x: 31.85, y: 56.08 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 256.017, constnCostLacs: 162.75, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 31.815, totalCostLacs: 464.582 } },
  { id: 'p-648', plotNo: '648', phase: 'Phase II', landAreaSft: 4510.0, builtUpSft: 3500, bedrooms: 3, status: 'Available', positionPct: { x: 24.11, y: 50.33 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 236.775, constnCostLacs: 162.75, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 31.815, totalCostLacs: 445.34 } },
  { id: 'p-657-658', plotNo: '657+658', phase: 'Phase II', landAreaSft: 11482.0, builtUpSft: 5800, bedrooms: 4, status: 'Available', positionPct: { x: 23.98, y: 52.89 }, cost: { landRate: 5500, constnRate: 4650, landCostLacs: 631.51, constnCostLacs: 269.7, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 51.246, totalCostLacs: 967.456 } },
  { id: 'p-659', plotNo: '659', phase: 'Phase II', landAreaSft: 6213.1, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 22.81, y: 52.62 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 326.187, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 579.828 } },
  { id: 'p-660', plotNo: '660', phase: 'Phase II', landAreaSft: 5629.4, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 22.12, y: 52.78 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 295.541, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 549.182 } },
  { id: 'p-661-662', plotNo: '661+662', phase: 'Phase II', landAreaSft: 8062.2, builtUpSft: 5800, bedrooms: 4, status: 'Available', positionPct: { x: 21.03, y: 53.27 }, cost: { landRate: 5500, constnRate: 4650, landCostLacs: 443.424, constnCostLacs: 269.7, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 51.246, totalCostLacs: 779.37 } },
  { id: 'p-682', plotNo: '682', phase: 'Phase II', landAreaSft: 5061.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 15.47, y: 48.11 }, cost: { landRate: 5500, constnRate: 4650, landCostLacs: 278.355, constnCostLacs: 167.4, clubChargesLacs: 9.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 32.832, totalCostLacs: 493.587 } },
  { id: 'p-711-712', plotNo: '711+712', phase: 'Phase II', landAreaSft: 9326.0, builtUpSft: 5800, bedrooms: 4, status: 'Available', positionPct: { x: 26.86, y: 30.32 }, cost: { landRate: 5500, constnRate: 4650, landCostLacs: 512.93, constnCostLacs: 269.7, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 51.246, totalCostLacs: 848.876 } },
  { id: 'p-717', plotNo: '717', phase: 'Phase II', landAreaSft: 4133.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 28.84, y: 34.73 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 216.982, constnCostLacs: 167.4, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 32.652, totalCostLacs: 431.034 } },
  { id: 'p-723', plotNo: '723', phase: 'Phase II', landAreaSft: 4167.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 29.44, y: 32.06 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 218.768, constnCostLacs: 167.4, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 32.652, totalCostLacs: 432.82 } },
  { id: 'p-725', plotNo: '725', phase: 'Phase II', landAreaSft: 5775.2, builtUpSft: 3500, bedrooms: 3, status: 'Available', positionPct: { x: 28.73, y: 30.32 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 303.198, constnCostLacs: 162.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 31.995, totalCostLacs: 512.943 } },
  { id: 'p-807', plotNo: '807', phase: 'Phase II', landAreaSft: 4859.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 41.02, y: 15.32 }, cost: { landRate: 5750, constnRate: 4650, landCostLacs: 279.392, constnCostLacs: 167.4, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 32.652, totalCostLacs: 493.445 } },
  { id: 'p-808', plotNo: '808', phase: 'Phase II', landAreaSft: 6974.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 44.79, y: 13.6 }, cost: { landRate: 5750, constnRate: 4650, landCostLacs: 401.005, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 38.511, totalCostLacs: 653.466 } },
  { id: 'p-811', plotNo: '811', phase: 'Phase II', landAreaSft: 5056.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 46.44, y: 15.58 }, cost: { landRate: 5750, constnRate: 4650, landCostLacs: 290.72, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 38.511, totalCostLacs: 543.181 } },
  { id: 'p-812', plotNo: '812', phase: 'Phase II', landAreaSft: 5056.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 46.78, y: 16.36 }, cost: { landRate: 5750, constnRate: 4650, landCostLacs: 290.72, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 38.511, totalCostLacs: 543.181 } },
  { id: 'p-816-817', plotNo: '816+817', phase: 'Phase II', landAreaSft: 10112.0, builtUpSft: 5800, bedrooms: 4, status: 'Available', positionPct: { x: 48.75, y: 19.45 }, cost: { landRate: 5750, constnRate: 4650, landCostLacs: 581.44, constnCostLacs: 269.7, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 51.246, totalCostLacs: 917.386 } },
  { id: 'p-821', plotNo: '821', phase: 'Phase II', landAreaSft: 5959.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 50.92, y: 18.01 }, cost: { landRate: 5500, constnRate: 4650, landCostLacs: 327.745, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 581.386 } },
  { id: 'p-822', plotNo: '822', phase: 'Phase II', landAreaSft: 5958.9, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 51.4, y: 17.09 }, cost: { landRate: 5500, constnRate: 4650, landCostLacs: 327.74, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 581.381 } },
  { id: 'p-834', plotNo: '834', phase: 'Phase II', landAreaSft: 6714.9, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 53.97, y: 11.39 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 352.532, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 606.173 } },
  { id: 'p-835', plotNo: '835', phase: 'Phase II', landAreaSft: 5056.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 53.36, y: 11.02 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 265.44, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 38.511, totalCostLacs: 517.901 } },
  { id: 'p-836', plotNo: '836', phase: 'Phase II', landAreaSft: 5056.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 52.63, y: 10.58 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 265.44, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 38.511, totalCostLacs: 517.901 } },
  { id: 'p-840', plotNo: '840', phase: 'Phase II', landAreaSft: 4738.8, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 50.32, y: 9.17 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 248.788, constnCostLacs: 167.4, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 32.652, totalCostLacs: 462.84 } },
  { id: 'p-2', plotNo: '2', phase: 'Enclave', landAreaSft: 6119.3, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 64.43, y: 70.4 }, cost: { landRate: 5500, constnRate: 4650, landCostLacs: 336.561, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 590.202 } },
  { id: 'p-3', plotNo: '3', phase: 'Enclave', landAreaSft: 6014.8, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 63.7, y: 70.15 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 315.778, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 569.419 } },
  { id: 'p-6', plotNo: '6', phase: 'Enclave', landAreaSft: 5607.5, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 62.87, y: 67.72 }, cost: { landRate: 5500, constnRate: 4650, landCostLacs: 308.413, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 562.054 } },
  { id: 'p-7', plotNo: '7', phase: 'Enclave', landAreaSft: 3968.2, builtUpSft: 3000, bedrooms: 3, status: 'Available', positionPct: { x: 64.01, y: 67.99 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 208.329, constnCostLacs: 139.5, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 27.63, totalCostLacs: 389.459 } },
  { id: 'p-8', plotNo: '8', phase: 'Enclave', landAreaSft: 8457.9, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 63.6, y: 67.0 }, cost: { landRate: 5500, constnRate: 4650, landCostLacs: 465.186, constnCostLacs: 199.95, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 38.691, totalCostLacs: 718.827 } },
  { id: 'p-18', plotNo: '18', phase: 'Enclave', landAreaSft: 4556.5, builtUpSft: 3800, bedrooms: 3, status: 'Available', positionPct: { x: 65.07, y: 56.16 }, cost: { landRate: 5250, constnRate: 4650, landCostLacs: 239.214, constnCostLacs: 176.7, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 34.326, totalCostLacs: 464.24 } },
];
