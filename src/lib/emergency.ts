// Numbers shown on the public map's Emergency sheet.
//
// 112 is India's all-in-one emergency number (police, fire, ambulance); 108 is the
// ambulance service. Put the estate's own security / site-office number in SITE_CONTACT
// and it appears as a third button.

export const NATIONAL_EMERGENCY = { label: 'Emergency services', phone: '112' };
export const AMBULANCE = { label: 'Ambulance', phone: '108' };
export const SITE_CONTACT: { label: string; phone: string } | null = null;
