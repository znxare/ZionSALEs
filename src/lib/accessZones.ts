import type { MapPt } from './tour';
import { PRIVATE_AREAS } from './mapAreas';

// Who may go where. On the public map only Phase II is marked (a dashed line and its name); the rest is
// in the "Who can go where" card (More menu). Tapping a row there outlines that area. Points in % of the plan.

export type AccessKind = 'construction' | 'golfers' | 'residents' | 'limited' | 'open';

export interface AccessRow {
  id: string;
  kind: AccessKind;
  title: string;
  note: string;
  /** Outlined while the row is picked (none for homes and roads: they run all over the estate). */
  area?: MapPt[][];
}

/** Phase II as marked by hand on the plan by the user (17 Nov 2026); it is not on the master plan itself. */
export const PHASE_II: MapPt[][] = [
  [[46.15, 2.26], [64.15, 13.07], [44.15, 32.65], [38.15, 42.4], [37.25, 73.5], [37.6, 78.6], [7.15, 54.9], [14.25, 37.2], [35.65, 13.1]],
];
/** Where the "Phase II" name sits on the map (inside the area, on holes 17-18). */
export const PHASE_II_LABEL_AT: MapPt = [28.5, 44];

const COURSE = PRIVATE_AREAS.find((a) => a.id === 'golf-course')?.polygons ?? [];
const CLUB_AND_COURTS: MapPt[][] = [
  [[38.29, 55.43], [41.83, 55.43], [41.83, 61.9], [38.29, 61.9]],
  [[42.25, 52.78], [44.47, 52.78], [44.47, 55.43], [42.25, 55.43]],
  [[43.36, 58.47], [44.4, 57.49], [45.72, 61.16], [45.17, 61.86]],
];

export const ACCESS_ROWS: AccessRow[] = [
  { id: 'phase-2', kind: 'construction', title: 'Phase II', note: 'Construction site · no entry', area: PHASE_II },
  { id: 'golf', kind: 'golfers', title: 'Golf course', note: 'Golfers only · stay on the roads', area: COURSE },
  { id: 'homes', kind: 'residents', title: 'Villas & homes', note: 'Residents only' },
  { id: 'club', kind: 'limited', title: 'Club Zion & sports courts', note: 'Limited / paid access', area: CLUB_AND_COURTS },
  { id: 'open', kind: 'open', title: 'Roads, Restaurant & range', note: 'Open to all' },
];

/** Swatch / outline colour per kind. */
export const ACCESS_HEX: Record<AccessKind, string> = { construction: '#b3261e', golfers: '#1f3a2b', residents: '#3f3e34', limited: '#f05a22', open: '#c8c1b0' };
