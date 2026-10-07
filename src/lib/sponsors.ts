// The course sponsors: each presents a hole (a small sign stands at its tee) and all four share the board
// by the main gate. Logos are in public/sponsors (background removed, so they sit on any surface).
// To add or change one, edit this list; `hole` is the hole whose tee carries the sign.

export interface CourseSponsor {
  id: string;
  name: string;
  logo: string;
  /** Hole presented by this sponsor (its sign stands at that hole's tee). */
  hole: number;
  /** Logo shape, width over height, so it is never squashed. */
  ratio: number;
}

export const COURSE_SPONSORS: CourseSponsor[] = [
  { id: 'hsbc', name: 'HSBC', logo: '/sponsors/hsbc.webp', hole: 1, ratio: 194 / 59 },
  { id: 'ipi', name: 'IPI', logo: '/sponsors/ipi.webp', hole: 7, ratio: 200 / 142 },
  { id: 'carnelian', name: 'Carnelian', logo: '/sponsors/carnelian.webp', hole: 10, ratio: 420 / 116 },
  { id: 'mysore-sandal', name: 'Mysore Sandal Soap', logo: '/sponsors/mysore-sandal.webp', hole: 16, ratio: 420 / 139 },
];

/** Where the sponsors' board stands: just outside the main gate (% of the plan, bottom centre of the board). */
export const SPONSOR_BOARD_AT: [number, number] = [41.5, 86.2];
