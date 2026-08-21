/**
 * Normalize a phone number for duplicate detection.
 * Strips all non-digit characters, then normalizes Indian numbers:
 * - Removes leading 91 if the remaining digits are 10
 * - Removes leading 0 if the remaining digits are 10
 * Returns the raw digit string (or empty string if invalid).
 *
 * Does NOT alter the value displayed to the user — only used for matching.
 */
export function normalizePhone(input: string): string {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');

  // Indian number with country code
  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  }
  // Indian number with leading 0 (landline-style prefix)
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  // Generic: remove a single leading country code if it makes the number 10 digits
  if (digits.length > 10 && digits.length <= 13) {
    const candidate = digits.slice(-10);
    if (candidate.length === 10) {
      digits = candidate;
    }
  }

  return digits;
}

const COUNTRY_FLAG: { code: string; flag: string; name: string }[] = [
  { code: '91', flag: '🇮🇳', name: 'India' },
  { code: '1', flag: '🇺🇸', name: 'USA' },
  { code: '44', flag: '🇬🇧', name: 'UK' },
  { code: '971', flag: '🇦🇪', name: 'UAE' },
  { code: '966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '965', flag: '🇰🇼', name: 'Kuwait' },
  { code: '974', flag: '🇶🇦', name: 'Qatar' },
  { code: '968', flag: '🇴🇲', name: 'Oman' },
  { code: '973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '61', flag: '🇦🇺', name: 'Australia' },
  { code: '64', flag: '🇳🇿', name: 'New Zealand' },
  { code: '49', flag: '🇩🇪', name: 'Germany' },
  { code: '33', flag: '🇫🇷', name: 'France' },
  { code: '39', flag: '🇮🇹', name: 'Italy' },
  { code: '34', flag: '🇪🇸', name: 'Spain' },
  { code: '31', flag: '🇳🇱', name: 'Netherlands' },
  { code: '41', flag: '🇨🇭', name: 'Switzerland' },
  { code: '852', flag: '🇭🇰', name: 'Hong Kong' },
  { code: '65', flag: '🇸🇬', name: 'Singapore' },
  { code: '60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '977', flag: '🇳🇵', name: 'Nepal' },
  { code: '960', flag: '🇲🇻', name: 'Maldives' },
  { code: '27', flag: '🇿🇦', name: 'South Africa' },
  { code: '234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '20', flag: '🇪🇬', name: 'Egypt' },
  { code: '9665', flag: '🇸🇦', name: 'Saudi Arabia' },
];

export function phoneCountryFlag(phone: string): { flag: string; name: string } | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Indian: 10 digits starting 6-9, or 91 + 10 digits, or 0 + 10 digits
  const ten = digits.length === 10 && /^[6-9]/.test(digits);
  const with91 = digits.startsWith('91') && digits.length === 12;
  const with0 = digits.startsWith('0') && digits.length === 11;
  if (ten || with91 || with0) return { flag: '🇮🇳', name: 'India' };

  // Try matching country codes (longest first)
  const sorted = [...COUNTRY_FLAG].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (digits.startsWith(c.code)) return { flag: c.flag, name: c.name };
  }
  return null;
}

export function isIndianPhone(phone: string): boolean {
  return phoneCountryFlag(phone)?.name === 'India';
}

/**
 * Normalize an email for comparison: trim + lowercase.
 */
export function normalizeEmail(input: string): string {
  return (input ?? '').trim().toLowerCase();
}

/**
 * Normalize a campaign name for comparison:
 * trim, collapse repeated whitespace, lowercase.
 */
export function normalizeCampaignName(input: string): string {
  return (input ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Simple Levenshtein-based similarity ratio for campaign suggestions.
 * Returns 0..1. Only used for UX suggestions, never for automatic matching.
 */
export function similarity(a: string, b: string): number {
  const s1 = normalizeCampaignName(a);
  const s2 = normalizeCampaignName(b);
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  const dist = matrix[len1][len2];
  return 1 - dist / Math.max(len1, len2);
}
