import type { ReactNode } from 'react';
import { usePresentationMode } from '@/lib/presentationMode';

/** Wraps a sensitive field (phone, email) so Presentation Mode can blur it out for screenshots, without changing layout or removing the data underneath. */
export default function Private({ children, className = '' }: { children: ReactNode; className?: string }) {
  const on = usePresentationMode();
  return (
    <span className={`${className} inline-block transition-[filter] duration-200 ${on ? 'select-none blur-[6px]' : ''}`}>
      {children}
    </span>
  );
}
