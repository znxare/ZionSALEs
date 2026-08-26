// Zion Hills Golf County — searchable sales FAQ.
//
// Sources:
//  - "Construction agreement draft phase 2.pdf" (Mar 2025 draft, Phase II) — reliable,
//    recent, but still a DRAFT template; clauses may change before final execution.
//  - "FAQ 2022.doc" — an internal call-handling script from 2022 with visible, unresolved
//    track-changes: several answers contradict themselves within the same document
//    (e.g. two different green fee prices, golf course completion dates given as 2021,
//    2022, and 2024 in different places, home counts that don't reconcile). Anything
//    that conflicted with itself in the source was left out rather than guessed at.
//    What's kept below is the structural, non-time-sensitive material: location,
//    architects, amenities, financing partners, utilities, ownership model.
//
// Nothing here should be read to a customer as a final legal or commercial commitment —
// verify against the current signed agreement and price list before quoting.

export interface FaqEntry {
  id: string;
  category: string;
  q: string;
  a: string;
  source: 'construction-agreement' | 'faq-2022' | 'both';
}

export const FAQ_ENTRIES: FaqEntry[] = [
  // ---------- Construction process & timeline ----------
  {
    id: 'build-time',
    category: 'Construction & Timeline',
    q: 'How long does construction take?',
    a: 'The Builder commits to completing the villa within 21 months, plus a 3-month grace period — 24 months total — from the later of design approval or the first installment payment, provided the owner doesn\'t delay payments or request design changes.',
    source: 'construction-agreement',
  },
  {
    id: 'delay-penalty',
    category: 'Construction & Timeline',
    q: 'What happens if construction is delayed?',
    a: 'If the villa isn\'t complete within the 24-month window and the owner has kept up all payments, the Builder pays the owner ₹10 per sft per month from the expiry of that period until actual handover. This is a real contractual penalty on the Builder, not just a promise.',
    source: 'construction-agreement',
  },
  {
    id: 'force-majeure',
    category: 'Construction & Timeline',
    q: 'What counts as an acceptable reason for delay?',
    a: 'War, flood, natural calamities, litigation, government policy changes, or non-availability of materials — reasons genuinely outside the Builder\'s control. The timeline extends automatically for these, and neither party is compensated for that portion of the delay.',
    source: 'construction-agreement',
  },
  {
    id: 'design-changes',
    category: 'Construction & Timeline',
    q: 'Can I request design changes after approval?',
    a: 'Not normally — villas are built to standard designs. In an extreme case, a written change request can be considered; if the Builder agrees, there\'s a ₹5,000 administrative fee per instance (charged whether or not the change is implemented) plus the actual extra cost, and the timeline may extend as a result.',
    source: 'construction-agreement',
  },
  {
    id: 'area-tolerance',
    category: 'Construction & Timeline',
    q: 'What if the built-up area comes out slightly different from the plan?',
    a: 'A variation of ±3% in built-up area is accepted by both parties with no payment adjustment — that\'s normal tolerance for a civil construction product. Beyond ±3%, the difference is settled by additional payment or deduction.',
    source: 'construction-agreement',
  },

  // ---------- Payment ----------
  {
    id: 'payment-structure',
    category: 'Payment & Costs',
    q: 'How is the payment structured?',
    a: 'An advance up front, then the balance construction cost in installments tied to construction progress, per the cost & payment schedule attached to the agreement. Total cost is inclusive of all taxes and already includes landscaping, utility charges, and club house charges — nothing separate is added later for those.',
    source: 'construction-agreement',
  },
  {
    id: 'late-payment',
    category: 'Payment & Costs',
    q: 'What happens if I pay an installment late?',
    a: 'Payments are due within 15 days of the demand note (sent by email or WhatsApp). Late payment attracts a financial charge of 1% per month, or part thereof, until cleared. If you\'re financing through a bank and the bank\'s disbursal is late, that still counts as a late payment on your side.',
    source: 'construction-agreement',
  },
  {
    id: 'financing-banks',
    category: 'Payment & Costs',
    q: 'Is home loan financing available?',
    a: 'Yes. Multiple banks have approved the project for financing, including HDFC, Axis Bank, ICICI, Canara Bank, PNB, and Kotak Mahindra — confirm current panel and phase-wise approval status with sales ops, since bank approvals are updated periodically.',
    source: 'faq-2022',
  },

  // ---------- Possession & warranty ----------
  {
    id: 'possession-process',
    category: 'Possession & Warranty',
    q: 'How does possession work?',
    a: 'The Builder notifies the owner in writing once the villa is ready. The owner then has 30 days to take possession. Possession is only handed over after all dues are cleared and a "No Due certificate" is issued. The owner can inspect the villa — including with a third-party inspector — to confirm it matches the agreed plan, design, and specifications before accepting.',
    source: 'construction-agreement',
  },
  {
    id: 'warranty',
    category: 'Possession & Warranty',
    q: 'What warranty do I get after possession?',
    a: '12 months on finishes, electrical, plumbing, walls, and flooring defects beyond normal acceptance levels; 5 years on structural defects (or longer if a regulatory authority stipulates it). Painting and floor/door/window polishing issues after possession aren\'t treated as defects under the agreement.',
    source: 'construction-agreement',
  },
  {
    id: 'post-possession-rules',
    category: 'Possession & Warranty',
    q: 'Can I make changes to the villa after I move in?',
    a: 'Interior work is fine, but only after possession and within the Maintenance Agency\'s rules and timing. Structural alterations, changes to the plan or elevation, and enclosing an open terrace are not permitted — and exteriors stay as per the approved project design permanently, even after possession.',
    source: 'construction-agreement',
  },
  {
    id: 'maintenance-charges',
    category: 'Possession & Warranty',
    q: 'When do maintenance charges start?',
    a: '30 days after the Builder issues notice of handover, payable to the Builder or its appointed Maintenance Agency at the applicable rates.',
    source: 'construction-agreement',
  },

  // ---------- Specifications ----------
  {
    id: 'spec-structure',
    category: 'Specifications & Materials',
    q: 'What\'s the structural specification?',
    a: 'RCC framed structure with cement block or prefabricated panel walls on isolated footing foundations. Minimum 10 ft floor-to-ceiling height in all living areas. First-floor decks have a 1 m finished parapet wall, and the terrace above the first floor is a waterproofed utility terrace.',
    source: 'construction-agreement',
  },
  {
    id: 'spec-bathrooms',
    category: 'Specifications & Materials',
    q: 'What bathroom fittings are used?',
    a: 'Wall-mounted EWC with concealed cistern, shower with mixer, wash basin with granite counter, and CP fittings — all Toto / Kohler / Jaguar or equivalent brand. Anti-skid vitrified tile flooring and dado, Somany or equivalent.',
    source: 'construction-agreement',
  },
  {
    id: 'spec-flooring',
    category: 'Specifications & Materials',
    q: 'What flooring is used?',
    a: 'Double-charged vitrified tiles (Somany or equivalent) in the foyer, living, dining, kitchen, corridors, bedrooms, and family room. Vitrified tiles in the maid\'s room. Anti-skid vitrified tiles on balconies, decks, and utility areas.',
    source: 'construction-agreement',
  },
  {
    id: 'spec-doors-windows',
    category: 'Specifications & Materials',
    q: 'What are the doors and windows made of?',
    a: '7 ft high wooden-framed doors (Beach wood or equivalent) with flush shutters. Windows in high-quality imported aluminium frames (Tostem or equivalent) with 6 mm toughened glass (Saint Gobain or equivalent).',
    source: 'construction-agreement',
  },
  {
    id: 'spec-electrical',
    category: 'Specifications & Materials',
    q: 'What\'s the power and electrical specification?',
    a: '9 KW sanctioned power per villa with up to 3 KVA DG backup, individual meters for power, DG, and water. Concealed PVC-insulated copper wiring (Polycab or equivalent) with modular switches (Legrand / V-Guard or equivalent). A 1 KW solar panel is connected to external lights, expandable by the owner. TV and telephone points in the living, family room, and all bedrooms.',
    source: 'construction-agreement',
  },
  {
    id: 'spec-connectivity',
    category: 'Specifications & Materials',
    q: 'What internet and data connectivity comes with the villa?',
    a: 'Optic fibre connectivity into the home, OFC / Cat 6 data points, and one WiFi point on each floor. At the community level, both Airtel and Reliance have towers on or near the project providing connectivity at speeds of roughly 100 Mbps.',
    source: 'both',
  },
  {
    id: 'spec-landscape',
    category: 'Specifications & Materials',
    q: 'What landscaping is included per villa?',
    a: 'Stone-paved walkways, levelling and topsoil, ground cover, trees and shrubs, and drip irrigation / sprinklers for the external and open first-floor areas — plus villa signage. This is the "landscape charge" line already included in the total villa cost, not billed separately.',
    source: 'construction-agreement',
  },
  {
    id: 'spec-plumbing-water',
    category: 'Specifications & Materials',
    q: 'How is water supplied to each villa?',
    a: 'A centralised filtration and hydro-pneumatic pump system feeds an HDPE pipeline network to each villa, with CPVC pipes (Hindware or equivalent) for supply and SWR PVC Class A/B (Hindware or equivalent) for drainage. Community-wide, domestic water is filtered borewell water; a government pipeline supplying treated water from a reservoir project is expected to feed the community once commissioned. All sewage is treated on-site and reused for irrigation.',
    source: 'both',
  },
  {
    id: 'spec-optional',
    category: 'Specifications & Materials',
    q: 'Are there any optional upgrades available?',
    a: 'A hydraulic lift is available as an optional extra at additional cost — provision is made in the design for a Cooper-brand lift.',
    source: 'construction-agreement',
  },

  // ---------- Location & connectivity ----------
  {
    id: 'location',
    category: 'Location & Connectivity',
    q: 'Where exactly is Zion Hills, and how far is it?',
    a: 'On the KGF Road near Kolar, roughly 70 km from Whitefield and 80 km from MG Road. Drive time is about 45 minutes from KR Puram, and 1 to 1.5 hours from most eastern and northern parts of Bangalore, including the airport. Connected to Bangalore via NH4, which links Bangalore to Chennai.',
    source: 'faq-2022',
  },
  {
    id: 'nearby-towns',
    category: 'Location & Connectivity',
    q: 'What towns and facilities are nearby?',
    a: 'Zion Hills sits midway between Kolar and Bangarpet — both mid-sized towns of roughly 1.5 lakh people, about a 10-minute drive away, each with supermarkets and everyday amenities. Bangarpet is a major railway junction on the south-bound line.',
    source: 'faq-2022',
  },
  {
    id: 'nearby-hospitals',
    category: 'Location & Connectivity',
    q: 'What healthcare is nearby?',
    a: 'Jalappa Medical College, a multi-speciality hospital with a Narayana Hrudayalaya Heart Centre, is under a 15-minute drive. Several smaller hospitals are also available in Kolar and Bangarpet.',
    source: 'faq-2022',
  },
  {
    id: 'nearby-industry',
    category: 'Location & Connectivity',
    q: 'Is there an economic hub nearby?',
    a: 'The Narsapura and Vemgal industrial areas are about 20–25 minutes away, home to large manufacturers including Honda\'s biggest bike factory globally, Scania Trucks, Tata Electronics, Tata Advanced Systems, and Mitsubishi Electric, among others — a growing employment and infrastructure corridor.',
    source: 'faq-2022',
  },

  // ---------- Community, golf & amenities ----------
  {
    id: 'golf-course-design',
    category: 'Community, Golf & Amenities',
    q: 'Who designed the golf course?',
    a: 'Ronald Fream of Golfplan (USA), one of the most respected golf course architects internationally, with Kevin Ramsey as principal architect. Course construction has been directed on-site by Bill Kessener. The greens use A4 Bent Grass, a fine-bladed, cool-season grass rarely found in tropical climates — verify current hole-count and completion status with sales ops before quoting to a buyer, since this has moved through several phases.',
    source: 'faq-2022',
  },
  {
    id: 'amenities-list',
    category: 'Community, Golf & Amenities',
    q: 'What clubhouse and sports amenities are there?',
    a: 'Two indoor badminton courts, two squash courts, a billiards room, table tennis, hard-surface tennis courts, pickleball, a basketball court, sand volleyball, seven-a-side soccer, a swimming pool, a well-equipped gym, spa, steam room, sauna, yoga room, an open-air movie screening area, a banquet centre, and a restaurant and bar.',
    source: 'faq-2022',
  },
  {
    id: 'outdoor-activities',
    category: 'Community, Golf & Amenities',
    q: 'What outdoor / nature activities are available?',
    a: 'Camp sites, fishing, trekking on the nearby rocky hills, and cycling or running along the internal roads. There are 8–9 water bodies in and around the property, including government lakes outside the project boundary; there are future plans to seek permission for kayaking.',
    source: 'faq-2022',
  },
  {
    id: 'golf-membership',
    category: 'Community, Golf & Amenities',
    q: 'Do villa owners get free golf club membership?',
    a: 'Yes — membership is free for villa owners, with no monthly maintenance or subscription fee for golf access itself. Owners and immediate family get roughly a 60% discount on prevailing green fees, and about 20% off restaurant food, per the club\'s resident benefit structure.',
    source: 'faq-2022',
  },
  {
    id: 'lifetime-membership',
    category: 'Community, Golf & Amenities',
    q: 'Why isn\'t there a lifetime golf membership option?',
    a: 'Research showed lifetime memberships tend to create long-term maintenance funding issues for golf courses. The club\'s model is built around sustainable, ongoing revenue to fund maintenance instead.',
    source: 'faq-2022',
  },

  // ---------- Developer, architects & ownership model ----------
  {
    id: 'developer',
    category: 'Developer & Ownership Model',
    q: 'Who is developing Zion Hills?',
    a: 'ZionHills Homes Private Limited is the Builder, developed as a joint development project with Confident Projects India Pvt Ltd (the land-owning partner). The construction agreement is signed by ZionHills Homes\' Managing Director, George Menomparampil.',
    source: 'construction-agreement',
  },
  {
    id: 'architects',
    category: 'Developer & Ownership Model',
    q: 'Who are the architects for the homes and clubhouse?',
    a: 'The golf course is designed by Golfplan (USA) under Ron Fream and Kevin Ramsey. Phase I homes were designed by Advani Associates; the Phase II clubhouse and villas/condos are designed by Arun Nalapat Architects.',
    source: 'faq-2022',
  },
  {
    id: 'nri-hospitality-model',
    category: 'Developer & Ownership Model',
    q: 'What if I don\'t plan to live here full-time — can the property be managed for me?',
    a: 'Yes — there\'s a hospitality/property management option aimed largely at owners (including NRIs) who want the property looked after without needing to manage it themselves or chase monthly maintenance. Under this model, the owner isn\'t billed monthly maintenance; instead, hospitality revenue is shared, with roughly 60% to the owner and 40% to the management company. This hospitality operation has been running for 7–8 years, and complimentary stays are typically offered during your own construction period.',
    source: 'faq-2022',
  },
  {
    id: 'security',
    category: 'Developer & Ownership Model',
    q: 'What security is in place?',
    a: 'Boundary walls, CCTV at critical points, and in-house security personnel community-wide. Each villa additionally has a door video phone and an intercom line direct to the security cabin; owners can add their own CCTV or intrusion systems if they want extra coverage.',
    source: 'both',
  },
];

export const FAQ_CATEGORIES = Array.from(new Set(FAQ_ENTRIES.map((f) => f.category)));
