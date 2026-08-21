import type { LeadStatus } from '@/lib/supabase';

export function statusStyles(status: LeadStatus): { bg: string; text: string; ring: string; dot: string } {
  switch (status) {
    case 'Hot':
      return { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', dot: 'bg-red-500' };
    case 'Warm':
      return { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', dot: 'bg-amber-500' };
    case 'Cold':
      return { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200', dot: 'bg-sky-400' };
    case 'Calling':
      return { bg: 'bg-cyan-50', text: 'text-cyan-700', ring: 'ring-cyan-200', dot: 'bg-cyan-500' };
    case 'Dead':
      return { bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-300', dot: 'bg-gray-700' };
    case 'Junk':
      return { bg: 'bg-gray-50', text: 'text-gray-400', ring: 'ring-gray-200', dot: 'bg-gray-300' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-200', dot: 'bg-gray-400' };
  }
}
