// The public map's look, in the Zion Hills way: warm paper and charcoal, the logo's orange as the one bright
// accent, and the golf course's deep green for dark panels. Class strings shared by its pieces.
//
// Kept restrained so the map stays the main thing on screen: flat colours (no gradients), one soft
// shadow per floating piece, and hairlines only where an edge would otherwise be lost.

export const GOLD = '#e3d8c2';      // warm sand: hairlines and rings
export const CHAMPAGNE = '#ffd9bf'; // soft peach highlight

/** A floating panel on deep green, for things that must stand out from the map (navigation, messages). */
export const lxGlass = 'bg-[#1f2a24]/[0.96] text-white shadow-[0_6px_18px_-6px_rgba(20,28,24,0.5)]';

/** A floating card on warm paper. */
export const lxIvory = 'bg-[#fbf8f1] text-[#26231f] ring-1 ring-black/[0.05] shadow-[0_6px_20px_-8px_rgba(38,35,31,0.32)]';

/** A light round-cornered button / pill: the everyday control. */
export const lxFab = 'bg-white text-[#26231f] ring-1 ring-black/[0.06] shadow-[0_3px_10px_-3px_rgba(38,35,31,0.3)]';

/** The orange call to action. */
export const lxOrange = 'bg-[#f05a22] text-white shadow-[0_4px_12px_-4px_rgba(224,78,23,0.55)]';

/** Deep red for safety warnings: serious, not shouting. */
export const lxCrimson = 'bg-[#b3261e] text-white shadow-[0_4px_12px_-4px_rgba(122,23,18,0.55)]';

/** Small caps label above a title. */
export const lxEyebrow = 'text-[10.5px] font-semibold uppercase tracking-[0.2em]';
