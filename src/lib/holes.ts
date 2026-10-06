// Hole-by-hole guide, from the Zion Hills yardage book (24 pages, one hole per page) and the master plan.
// Yardages, par, green depth and the description are the book's. `tee` and `green` are where each hole starts and
// ends on the plan (% of the plan: x from the left, y from the top), placed by eye from the plan's tee boxes and
// flags - correct any that are off. The picture of each green and the full yardage-book page of each hole are in
// public/holes (h<N>-green.webp, h<N>-page.webp).

export type TeeColour = 'yellow' | 'black' | 'blue' | 'white' | 'red' | 'orange';

/** The book's tee boxes, longest to shortest. */
export const TEES: { id: TeeColour; label: string; hex: string; ink: string }[] = [
  { id: 'yellow', label: 'Yellow', hex: '#fed929', ink: '#3b2f00' },
  { id: 'black', label: 'Black', hex: '#111111', ink: '#ffffff' },
  { id: 'blue', label: 'Blue', hex: '#0440f0', ink: '#ffffff' },
  { id: 'white', label: 'White', hex: '#ffffff', ink: '#111111' },
  { id: 'red', label: 'Red', hex: '#f40000', ink: '#ffffff' },
  { id: 'orange', label: 'Orange', hex: '#f15821', ink: '#ffffff' },
];

export interface HoleGuide {
  n: number;
  par: 3 | 4 | 5;
  /** Yards from each tee box, in TEES order (yellow first). */
  yards: [number, number, number, number, number, number];
  /** Depth of the green, in yards. */
  depth: number;
  description: string;
  /** Where the hole starts (the tee boxes) and ends (the green), on the plan. */
  tee: [number, number];
  green: [number, number];
}

export const COURSE_NOTE = 'Designed by Ronald Fream and George Philpot. Bent-grass greens, granite shelves, rusty boulders and lakes throughout.';

export const HOLE_GUIDE: HoleGuide[] = [
  { n: 1, par: 4, yards: [445, 365, 340, 310, 290, 235], depth: 31, tee: [45.6, 54.5], green: [49.45, 70.2],
    description: "A good drive avoiding the out of bound on the right and the bunker on the left should set up a relatively small approach to the green. The green is multi-tiered and it is important to be on the right level for a chance at birdie." },
  { n: 2, par: 5, yards: [555, 530, 510, 490, 460, 435], depth: 44, tee: [50.0, 77.8], green: [68.84, 88.4],
    description: "A short par 5. Avoid the bunker on the left from the tee and you might be able to reach this green in two shots if the wind is favorable. The green is well guarded with bunkers. Flag on the top level makes this hole challenging." },
  { n: 3, par: 4, yards: [390, 370, 340, 320, 295, 240], depth: 32, tee: [70.2, 80.3], green: [80.45, 92.6],
    description: "A reachable par 4 if you can miss all the massive bunkers from the tee and the wind is on your back. The green is amongst the toughest of any hole on the course with bunkers surrounding it and a giant rise that guards the back hole locations. Do not be long on the approach especially to a back flag." },
  { n: 4, par: 4, yards: [405, 360, 330, 315, 290, 260], depth: 46, tee: [82.5, 90.5], green: [84.5, 72.8],
    description: "With out of bounds on the right it is important to keep your drive on the left side of the fairway. The approach to one of the larger green on the course plays shorter than the yardage as it is downhill." },
  { n: 5, par: 3, yards: [220, 210, 190, 160, 135, 100], depth: 42, tee: [82.9, 70.9], green: [75.27, 69.9],
    description: "An intimidating Par 3 with water all the way up till the green. The green has a big hollow in the middle and cannot be taken lightly. A miss to the right of the green will give you a chance to save par on this difficult hole." },
  { n: 6, par: 5, yards: [565, 555, 510, 465, 420, 390], depth: 35, tee: [76.8, 74.7], green: [57.65, 69.75],
    description: "Beware of the bunkers and the out of bounds on both sides with the drive. Only the long hitters can think of reaching this green in two shots because of the water hazard short of the green. A flag on the right side of the green makes for an intimidating approach shot." },
  { n: 7, par: 3, yards: [225, 210, 185, 165, 145, 130], depth: 51, tee: [61.3, 65.4], green: [52.76, 67.04],
    description: "Toughest Par 3 on the course. The green is well guarded with water on the left and bunkers on the right. A par on this hole is a great score." },
  { n: 8, par: 4, yards: [450, 430, 405, 380, 340, 310], depth: 60, tee: [53.9, 60.5], green: [52.95, 41.2],
    description: "The toughest hole on the Front 9. With Out of bounds on the right and water running along the left side, keeping the tee shot in play is of the highest priority. This leads to an even more challenging approach over the trees with anything left being in the water." },
  { n: 9, par: 4, yards: [390, 380, 340, 320, 290, 255], depth: 39, tee: [49.0, 41.3], green: [40.5, 49.9],
    description: "This straight forward Par 4 tends to play longer than its yardage due to the elevated green. Beware of the Out of Bounds on the right from the tee. The green has two levels and a two putt cannot be taken for granted if the approach is on the wrong level." },
  { n: 10, par: 5, yards: [565, 535, 505, 470, 420, 365], depth: 40, tee: [38.4, 43.0], green: [48.2, 22.9],
    description: "This is a dogleg to the right, very difficult tee shot with bunkers and hazards on both sides of the fairway. The green is designed with a large bunker guarding the front with the left side bordering the hazard. A flag on the left side of the green makes for an intimidating approach shot." },
  { n: 11, par: 4, yards: [365, 320, 275, 250, 220, 145], depth: 24, tee: [47.3, 28.0], green: [56.7, 16.1],
    description: "The par 4 plays as a risk and reward hole with premium on driving accuracy. Long hitters can try driving the green but has a large bunker guarding the front with out of bounds on both sides of the fairway. The green has a large contour in the middle sloping to either side." },
  { n: 12, par: 4, yards: [405, 370, 345, 320, 270, 230], depth: 44, tee: [54.5, 13.5], green: [43.9, 10.6],
    description: "Short par 4 with premium on driving accuracy as both sides of the fairway has hazards and mango trees lining the fairway. The green is sloped from front to back guarded by bunkers on all sides. With an accurate drive, the approach shot is relatively easy to the green." },
  { n: 13, par: 4, yards: [345, 330, 315, 300, 265, 210], depth: 35, tee: [42.4, 12.3], green: [44.3, 25.9],
    description: "The signature hole with a island putting green. The drive is important to setup the approach shot to the contoured island putting green. The approach shot needs to be accurate or will land up in the lake surrounding the green." },
  { n: 14, par: 3, yards: [255, 230, 205, 190, 135, 75], depth: 40, tee: [39.8, 30.8], green: [31.65, 30.3],
    description: "The longest par 3 in India which will test the long game skills of all golfers. The green is guarded by bunkers on all sides. Golfers can aim the tee shot to front part of the green to play for par." },
  { n: 15, par: 4, yards: [410, 375, 345, 310, 280, 240], depth: 45, tee: [22.3, 34.7], green: [17.8, 49.2],
    description: "A dogleg hole to the right, golfers can plan two options from the tee, to play to the left fairway for a longer approach shot or drive to avoid the fairway bunker on the right side. Out of bounds is on the right side of the fairway to the green. The large green is sloped from front to back so approach shots need to be accurate to avoid the bunker on the left side of green." },
  { n: 16, par: 3, yards: [210, 175, 150, 140, 115, 80], depth: 32, tee: [16.9, 55.2], green: [24.2, 56.5],
    description: "A picturesque par 3 green surrounded by rocks on three sides and a bunker on the left side. The green is uniquely shaped from left to right, so yardages to the flag need to be checked accurately. The right side of the green presents a challenge to golfers of all skill levels." },
  { n: 17, par: 4, yards: [470, 415, 405, 380, 350, 320], depth: 40, tee: [28.8, 54.5], green: [24.3, 36.4],
    description: "A long par 4 with the tee shot playing downhill and the approach shot playing uphill. The creek running across the fairway has to be avoided in the tee shot. Approach shots playing uphill poses a challenge to all golfers." },
  { n: 18, par: 5, yards: [660, 620, 600, 570, 500, 460], depth: 46, tee: [22.8, 33.0], green: [37.6, 55.3],
    description: "The longest par 5 in India, is a tough finishing hole. It's unique double dogleg design tests the golfers from the tee to green. The tee shot needs to avoid the hazard on left side of fairway, the second shot needs to avoid the fairway bunkers on the left side and the third shot is played uphill to a large three tiered green wherein the flag position on back left side is very difficult with out of bounds behind the green and with a large bunker on left side of green." },
];

export const holeGuide = (n: number): HoleGuide | undefined => HOLE_GUIDE.find((h) => h.n === n);
