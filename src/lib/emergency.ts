// Numbers shown on the public map's Emergency sheet.
//
// 112 is India's all-in-one emergency number (police, fire, ambulance); 108 is the
// ambulance service. SITE_CONTACT is the estate's main gate (security), shown as a third button.

export const NATIONAL_EMERGENCY = { label: 'Emergency services', phone: '112' };
export const AMBULANCE = { label: 'Ambulance', phone: '108' };
export const SITE_CONTACT: { label: string; phone: string; shown: string } | null = { label: 'Main Gate', phone: '+917899023906', shown: '78990 23906' };
