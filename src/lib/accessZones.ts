import type { MapPt } from './tour';
import { PRIVATE_AREAS, inside } from './mapAreas';

// Who may go where, shown on the public map as small round badges (the map itself is not shaded);
// tapping one opens a short card. Points in % of the plan. Roads, Restaurant & Golf Practice and
// parking are open to everyone and have no badge.

export type AccessKind = 'construction' | 'golfers' | 'residents' | 'limited';

export interface AccessBadge {
  id: string;
  kind: AccessKind;
  pt: MapPt;
  title: string;
  note: string;
  /** Outline shown while the card is open (none for homes: they are spread all over the estate). */
  area?: MapPt[][];
}

/** The few words shown beside a badge once the map is zoomed in. */
export const ACCESS_SHORT: Record<AccessKind, string> = { construction: 'No entry', golfers: 'Golfers only', residents: 'Residents only', limited: 'Paid access' };

/** Phase II as marked by hand on the plan by the user (17 Nov 2026); it is not on the master plan itself. */
export const PHASE_II: MapPt[][] = [
  [[46.15, 2.26], [64.15, 13.07], [44.15, 32.65], [38.15, 42.4], [37.25, 73.5], [37.6, 78.6], [7.15, 54.9], [14.25, 37.2], [35.65, 13.1]],
];
const COURSE = PRIVATE_AREAS.find((a) => a.id === 'golf-course')?.polygons ?? [];
const CLUB: MapPt[][] = [[[38.29, 55.43], [41.83, 55.43], [41.83, 61.9], [38.29, 61.9]]];
const COURTS: MapPt[][] = [
  [[42.25, 52.78], [44.47, 52.78], [44.47, 55.43], [42.25, 55.43]],
  [[43.36, 58.47], [44.4, 57.49], [45.72, 61.16], [45.17, 61.86]],
];

const PHASE_II_CARD = { title: 'Phase II · construction site', note: 'Danger zone. No entry for visitors.', area: PHASE_II };
const GOLF = { title: 'Golf course', note: 'Danger zone. Playing golfers only; please stay on the roads.', area: COURSE };
const HOMES = { title: 'Villas & homes', note: 'Residents only. Please do not enter private plots.' };

export const ACCESS_BADGES: AccessBadge[] = [
  { id: 'phase-2', kind: 'construction', pt: [27.5, 44], ...PHASE_II_CARD },
  { id: 'phase-2-north', kind: 'construction', pt: [45.5, 23.5], ...PHASE_II_CARD },
  { id: 'golf-front', kind: 'golfers', pt: [48.5, 60.5], ...GOLF },
  { id: 'golf-east', kind: 'golfers', pt: [68, 72.5], ...GOLF },
  { id: 'homes-north', kind: 'residents', pt: [44, 38], ...HOMES },
  { id: 'homes-south', kind: 'residents', pt: [58, 77], ...HOMES },
  { id: 'homes-east', kind: 'residents', pt: [79, 78.5], ...HOMES },
  { id: 'club-zion', kind: 'limited', pt: [40, 58.6], title: 'Club Zion', note: 'Limited / paid access. Please ask at the club.', area: CLUB },
  { id: 'sports', kind: 'limited', pt: [43.4, 54.1], title: 'Sports courts', note: 'Limited / paid access. Please ask at Club Zion.', area: COURTS },
];

/** Is this plan point inside Phase II? */
export function inPhaseII(pt: MapPt): boolean {
  return PHASE_II.some((poly) => inside(pt, poly));
}
