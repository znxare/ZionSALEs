// Zion Hills Golf County — Phase II sales battle card data.
// Condominium figures are reproduced from the official Q3 2026 pricing sheet and
// cross-checked against the sheet's own area/price math. Villa figures include the
// full itemized breakdown from the same sheet. Market Compare rates and amenity
// presence for competitor projects are public-listing estimates as of Aug 2026,
// not official builder data. Zion Hills' own amenities (spa, salon, co-working,
// on-site hotel, upcoming retail) are as described by the project team and are
// not yet reflected on public listing sites — this whole module is unverified
// against a second source and should not be treated as final.

export interface Condo {
  name: string;
  floor: string;
  reraCarpet: number;
  carpet: number;
  coveredDeck: number;
  openDeck: number;
  useable: number;
  sba: number;
  saleable: number;
  ratio: number;
  price: number;
  utility: number;
  landscape: number;
  club: number;
  total: number;
}

export const CONDOS: Condo[] = [
  { name: '3.5 BHK Penthouse', floor: 'Duplex — 2nd & 3rd Floor', reraCarpet: 2333, carpet: 2268, coveredDeck: 631, openDeck: 0, useable: 2900, sba: 3560, saleable: 3560, ratio: 81.5, price: 43243464, utility: 472000, landscape: 236000, club: 944000, total: 44895464 },
  { name: '3.5 BHK Condo', floor: '2nd Floor', reraCarpet: 1754, carpet: 1693, coveredDeck: 300, openDeck: 0, useable: 1992, sba: 2435, saleable: 2435, ratio: 81.8, price: 28233032, utility: 354000, landscape: 177000, club: 944000, total: 29708032 },
  { name: '3.5 BHK Condo', floor: '1st Floor', reraCarpet: 1754, carpet: 1692, coveredDeck: 300, openDeck: 0, useable: 1991, sba: 2435, saleable: 2435, ratio: 81.8, price: 26888601, utility: 354000, landscape: 177000, club: 944000, total: 28363601 },
  { name: '3 BHK Condo', floor: 'Ground Floor', reraCarpet: 1619, carpet: 1564, coveredDeck: 275, openDeck: 0, useable: 1839, sba: 2245, saleable: 2245, ratio: 81.9, price: 26031665, utility: 354000, landscape: 354000, club: 944000, total: 27683665 },
  { name: '2 BHK Condo', floor: '1st Floor', reraCarpet: 1037, carpet: 1012, coveredDeck: 274, openDeck: 0, useable: 1286, sba: 1569, saleable: 1569, ratio: 81.9, price: 17329442, utility: 236000, landscape: 118000, club: 944000, total: 18627442 },
  { name: '2 BHK Condo', floor: 'Ground Floor', reraCarpet: 1037, carpet: 1012, coveredDeck: 325, openDeck: 0, useable: 1338, sba: 1619, saleable: 1619, ratio: 82.6, price: 18767678, utility: 236000, landscape: 236000, club: 944000, total: 20183678 },
  { name: '1 BHK Penthouse', floor: '3rd Floor', reraCarpet: 1135, carpet: 1106, coveredDeck: 78, openDeck: 336, useable: 1521, sba: 1847, saleable: 1639, ratio: 92.8, price: 19909671, utility: 236000, landscape: 177000, club: 944000, total: 21266671 },
];

export interface Villa {
  name: string;
  land: string;
  sba: string;
  buaNum: number;
  landRate: string;
  constRate: string;
  landCost: string;
  constCost: number;
  landscapeCost: number;
  utilityCost: number;
  clubCost: number;
  gst: number;
  range: string;
  lowL: number;
  highL: number;
}

export const VILLAS: Villa[] = [
  { name: '3 Bedroom Villa', land: '4000 to 5000+ sft', sba: '3600 sft', buaNum: 3600, landRate: '₹5,750/sft', constRate: '₹5,250/sft',
    landCost: '₹230 L – 300 L+', constCost: 189, landscapeCost: 3, utilityCost: 3, clubCost: 8, gst: 34, range: '₹470 L – 530 L+', lowL: 470, highL: 530 },
  { name: '4 Bedroom Villa', land: '5000+ to 8000 sft', sba: '4350 sft', buaNum: 4350, landRate: '₹5,750/sft', constRate: '₹5,250/sft',
    landCost: '₹288 L – 460 L+', constCost: 228, landscapeCost: 4, utilityCost: 3, clubCost: 8, gst: 41, range: '₹575 L – 750 L+', lowL: 575, highL: 750 },
  { name: 'Extra Large 4 Bedroom Villa', land: '7000+ to 10,000+ sft', sba: '5800 sft', buaNum: 5800, landRate: '₹5,750/sft', constRate: '₹5,250/sft',
    landCost: '₹402 L – 600 L+', constCost: 305, landscapeCost: 5, utilityCost: 3, clubCost: 8, gst: 54, range: '₹780 L – 950 L+', lowL: 780, highL: 950 },
];

export type AmenityKey = 'golf' | 'clubhouse' | 'spa' | 'salon' | 'restaurant' | 'coworking' | 'hotel' | 'retail';

export const AMENITY_LABELS: Record<AmenityKey, string> = {
  golf: 'Golf course',
  clubhouse: 'Clubhouse',
  spa: 'Spa & sauna',
  salon: 'Salon',
  restaurant: 'Restaurant & bar',
  coworking: 'Co-working space',
  hotel: 'On-site hotel/resort',
  retail: 'Retail / shopping',
};

// Per Zion Hills project team — not independently published, so kept separate from researched competitor data.
export const ZION_AMENITIES: Record<AmenityKey, boolean | 'upcoming'> = {
  golf: true, clubhouse: true, spa: true, salon: true, restaurant: true, coworking: true, hotel: true, retail: 'upcoming',
};

export interface Competitor {
  name: string;
  loc: string;
  rate: number;
  editableName: boolean;
  amenities: Partial<Record<AmenityKey, boolean>> | null;
}

// amenities: true = confirmed present in research, false = not found in official/listing sources
// (absence isn't proof, just "not advertised"), null = unknown (custom row).
export const DEFAULT_COMPETITORS: Competitor[] = [
  {
    name: 'Prestige Golfshire', loc: 'Nandi Hills / Chikkaballapur', rate: 16000, editableName: false,
    amenities: { golf: true, clubhouse: true, spa: true, salon: false, restaurant: true, coworking: false, hotel: true, retail: false },
  },
  {
    name: 'Prestige Augusta Golf Village', loc: 'Kothanur, near Hennur', rate: 17000, editableName: false,
    amenities: { golf: true, clubhouse: true, spa: false, salon: false, restaurant: true, coworking: false, hotel: false, retail: false },
  },
  {
    name: 'Eagleton Golf Village', loc: 'Bidadi, west of Bangalore', rate: 10600, editableName: false,
    amenities: { golf: true, clubhouse: true, spa: false, salon: false, restaurant: false, coworking: false, hotel: true, retail: false },
  },
];

export const DRIVE_TIMES: { name: string; loc: string; time: string; isZion: boolean }[] = [
  { name: 'Prestige Augusta', loc: 'Kothanur / Hennur', time: '~20–30 min', isZion: false },
  { name: 'Prestige Golfshire', loc: 'Nandi Hills / Devanahalli', time: '~40–45 min', isZion: false },
  { name: 'Eagleton Golf Village', loc: 'Bidadi', time: '~45–60 min', isZion: false },
  { name: 'Zion Hills', loc: 'Kolar Road', time: '~60–90 min', isZion: true },
];

export const OBJECTIONS: { q: string; tag: string; a: string }[] = [
  { q: '"The price is higher than the other project we looked at."', tag: 'Price', a: 'Ask what they\'re comparing on — sticker price per sft, or usable space per sft? On Zion Hills, 81–93% of what you pay for is space you actually stand in. A "cheaper" project at 68% efficiency can cost more per usable square foot once you do that math. Walk them through the Useable Area on the Condominiums tab, not just the Super Built Up figure.' },
  { q: '"Club, landscape, utility charges — why are these extra?"', tag: 'Charges', a: 'They\'re not extra — they\'re itemized. The Total Price incl. GST on the sheet already includes all of it. Nothing gets added at booking or possession. Contrast this with projects that quote a bare base price and reveal charges later; here the buyer sees the full number today.' },
  { q: '"Why does the ground floor / top floor cost more?"', tag: 'Floor premium', a: 'Ground and 2nd floor carry a 5% premium, 3rd floor and penthouses carry 10% — tied to a real advantage in each case: ground floor gets direct garden/deck access, top floor gets the largest deck and best views (the 1 BHK penthouse alone has a 336 sft private open deck). It\'s priced for what the floor gives them, not arbitrary.' },
  { q: '"The villa price is a range — what will I actually pay?"', tag: 'Villas', a: 'The range reflects plot size within that villa type\'s land area band and any PLC for lake/green-facing or double-side-view plots. Land rate (₹5,750/sft) and construction rate (₹5,250/sft) are fixed — the final number is plot size × rate, plus PLC if applicable. Get their preferred plot characteristics and narrow the range on the spot.' },
  { q: '"What\'s actually included in the community — is it just a golf course?"', tag: 'Lifestyle', a: 'Every unit — condo or villa — carries a club charge, so clubhouse access is standard, not an upsell. Villas sit on 4000 to 10,000+ sft plots with optional premium locations (lake-facing, green-facing, double-side view) for buyers who want a specific outlook.' },
  { q: '"Where does the villa total price actually come from?"', tag: 'Villas', a: 'Walk them through the Villas tab breakdown: land cost (their plot size × ₹5,750/sft), plus a fixed construction cost, landscape, utility, club charges, and GST. Nothing is a black box — every line adds up to the total shown. The land cost is the only variable piece, which is exactly why the total is a range, not a single number.' },
  { q: '"Kolar is far — why not something closer to the city?"', tag: 'Location', a: 'Don\'t argue the distance — it\'s real. Ask what they\'re actually comparing it to: if it\'s a golf community, every one of them (Golfshire, Augusta, Eagleton) is also a drive out of the city, because golf needs land the inner suburbs don\'t have. Zion Hills is farther than Golfshire and Augusta, and that\'s exactly why it\'s priced 15–22% below them for the same size. The Satellite Town Ring Road connecting Kolar Road is targeted to open by late 2026 — cite that as a fact, not a promise. Have this conversation after they\'ve seen the amenities and price gap, not before.' },
];

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
export const inrShort = (n: number) => {
  const cr = n / 10000000;
  return cr >= 1 ? '₹' + cr.toFixed(2) + ' Cr' : '₹' + (n / 100000).toFixed(2) + ' L';
};
export const lac = (n: number) => '₹' + n.toLocaleString('en-IN') + ' L';
