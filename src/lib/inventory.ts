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
  { id: 'p-606', plotNo: '606', phase: 'Phase II', landAreaSft: 6971.2, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 34.17, y: 57.6 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 400.844, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 684.929 } },
  { id: 'p-608', plotNo: '608', phase: 'Phase II', landAreaSft: 6837.8, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 33.7, y: 55.99 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 393.175, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 677.26 } },
  { id: 'p-609', plotNo: '609', phase: 'Phase II', landAreaSft: 6810.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 33.45, y: 55.05 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 408.6, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 692.685 } },
  { id: 'p-622', plotNo: '622', phase: 'Phase II', landAreaSft: 4920.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 31.6, y: 55.15 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 282.9, constnCostLacs: 189.0, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 36.54, totalCostLacs: 522.44 } },
  { id: 'p-623', plotNo: '623', phase: 'Phase II', landAreaSft: 4876.5, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 31.85, y: 56.08 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 280.4, constnCostLacs: 189.0, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 36.54, totalCostLacs: 519.94 } },
  { id: 'p-648', plotNo: '648', phase: 'Phase II', landAreaSft: 4510.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 24.11, y: 50.33 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 259.325, constnCostLacs: 189.0, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 36.54, totalCostLacs: 498.865 } },
  { id: 'p-657-658', plotNo: '657+658', phase: 'Phase II', landAreaSft: 11482.0, builtUpSft: 5800, bedrooms: 4, status: 'Available', positionPct: { x: 23.98, y: 52.89 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 688.92, constnCostLacs: 304.5, clubChargesLacs: 8.0, landscapeChargesLacs: 5.0, utilityChargesLacs: 3.0, gstLacs: 57.69, totalCostLacs: 1067.11 } },
  { id: 'p-659', plotNo: '659', phase: 'Phase II', landAreaSft: 6213.1, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 22.81, y: 52.62 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 357.253, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 641.338 } },
  { id: 'p-660', plotNo: '660', phase: 'Phase II', landAreaSft: 5629.4, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 22.12, y: 52.78 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 323.688, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 607.773 } },
  { id: 'p-661-662', plotNo: '661+662', phase: 'Phase II', landAreaSft: 8062.2, builtUpSft: 5800, bedrooms: 4, status: 'Available', positionPct: { x: 21.03, y: 53.27 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 483.735, constnCostLacs: 304.5, clubChargesLacs: 8.0, landscapeChargesLacs: 5.0, utilityChargesLacs: 3.0, gstLacs: 57.69, totalCostLacs: 861.925 } },
  { id: 'p-675', plotNo: '675', phase: 'Phase II', landAreaSft: 6885.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 17.5, y: 53.1 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 413.1, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 697.185 } },
  { id: 'p-682', plotNo: '682', phase: 'Phase II', landAreaSft: 5061.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 15.47, y: 48.11 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 303.66, constnCostLacs: 189.0, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 36.54, totalCostLacs: 543.2 } },
  { id: 'p-686', plotNo: '686', phase: 'Phase II', landAreaSft: 4848.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 17.5, y: 45.6 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 290.88, constnCostLacs: 189.0, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 36.54, totalCostLacs: 530.42 } },
  { id: 'p-711-712', plotNo: '711+712', phase: 'Phase II', landAreaSft: 9326.0, builtUpSft: 5800, bedrooms: 4, status: 'Available', positionPct: { x: 26.86, y: 30.32 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 559.56, constnCostLacs: 304.5, clubChargesLacs: 8.0, landscapeChargesLacs: 5.0, utilityChargesLacs: 3.0, gstLacs: 57.69, totalCostLacs: 937.75 } },
  { id: 'p-717', plotNo: '717', phase: 'Phase II', landAreaSft: 4133.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 28.84, y: 34.73 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 237.648, constnCostLacs: 189.0, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 36.54, totalCostLacs: 477.188 } },
  { id: 'p-723', plotNo: '723', phase: 'Phase II', landAreaSft: 4167.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 29.44, y: 32.06 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 239.602, constnCostLacs: 189.0, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 36.54, totalCostLacs: 479.142 } },
  { id: 'p-725', plotNo: '725', phase: 'Phase II', landAreaSft: 5775.2, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 28.73, y: 30.32 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 332.075, constnCostLacs: 189.0, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 36.72, totalCostLacs: 572.795 } },
  { id: 'p-806', plotNo: '806', phase: 'Phase II', landAreaSft: 5098.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 40.2, y: 14.5 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 305.88, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 589.965 } },
  { id: 'p-807', plotNo: '807', phase: 'Phase II', landAreaSft: 4859.0, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 41.02, y: 15.32 }, cost: { landRate: 6250, constnRate: 5250, landCostLacs: 303.688, constnCostLacs: 189.0, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 36.54, totalCostLacs: 543.227 } },
  { id: 'p-808', plotNo: '808', phase: 'Phase II', landAreaSft: 6974.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 44.79, y: 13.6 }, cost: { landRate: 6250, constnRate: 5250, landCostLacs: 435.875, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 43.155, totalCostLacs: 718.78 } },
  { id: 'p-816-817', plotNo: '816+817', phase: 'Phase II', landAreaSft: 10112.0, builtUpSft: 5800, bedrooms: 4, status: 'Available', positionPct: { x: 48.75, y: 19.45 }, cost: { landRate: 6250, constnRate: 5250, landCostLacs: 632.0, constnCostLacs: 304.5, clubChargesLacs: 8.0, landscapeChargesLacs: 5.0, utilityChargesLacs: 3.0, gstLacs: 57.69, totalCostLacs: 1010.19 } },
  { id: 'p-822', plotNo: '822', phase: 'Phase II', landAreaSft: 5958.9, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 51.4, y: 17.09 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 357.534, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 641.619 } },
  { id: 'p-825', plotNo: '825', phase: 'Phase II', landAreaSft: 6048.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 52.7, y: 15.6 }, cost: { landRate: 6250, constnRate: 5250, landCostLacs: 378.0, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 662.085 } },
  { id: 'p-834', plotNo: '834', phase: 'Phase II', landAreaSft: 6714.9, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 53.97, y: 11.39 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 386.107, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 670.192 } },
  { id: 'p-835', plotNo: '835', phase: 'Phase II', landAreaSft: 5056.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 53.36, y: 11.02 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 290.72, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 43.155, totalCostLacs: 573.625 } },
  { id: 'p-836', plotNo: '836', phase: 'Phase II', landAreaSft: 5056.0, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 52.63, y: 10.58 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 290.72, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 43.155, totalCostLacs: 573.625 } },
  { id: 'p-840', plotNo: '840', phase: 'Phase II', landAreaSft: 4738.8, builtUpSft: 3600, bedrooms: 3, status: 'Available', positionPct: { x: 50.32, y: 9.17 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 272.482, constnCostLacs: 189.0, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 36.54, totalCostLacs: 512.022 } },
  { id: 'p-2', plotNo: '2', phase: 'Enclave', landAreaSft: 6119.3, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 64.43, y: 70.4 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 367.157, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 651.242 } },
  { id: 'p-3', plotNo: '3', phase: 'Enclave', landAreaSft: 6014.8, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 63.7, y: 70.15 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 345.852, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 629.937 } },
  { id: 'p-6', plotNo: '6', phase: 'Enclave', landAreaSft: 5607.5, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 62.87, y: 67.72 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 336.45, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 620.535 } },
  { id: 'p-7', plotNo: '7', phase: 'Enclave', landAreaSft: 3968.2, builtUpSft: 3000, bedrooms: 3, status: 'Available', positionPct: { x: 64.01, y: 67.99 }, cost: { landRate: 5750, constnRate: 5250, landCostLacs: 228.169, constnCostLacs: 157.5, clubChargesLacs: 8.0, landscapeChargesLacs: 3.0, utilityChargesLacs: 3.0, gstLacs: 30.87, totalCostLacs: 430.539 } },
  { id: 'p-8', plotNo: '8', phase: 'Enclave', landAreaSft: 8457.9, builtUpSft: 4300, bedrooms: 4, status: 'Available', positionPct: { x: 63.6, y: 67.0 }, cost: { landRate: 6000, constnRate: 5250, landCostLacs: 507.475, constnCostLacs: 225.75, clubChargesLacs: 8.0, landscapeChargesLacs: 4.0, utilityChargesLacs: 3.0, gstLacs: 43.335, totalCostLacs: 791.56 } },
];
