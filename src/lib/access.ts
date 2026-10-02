import { useEffect, useState } from 'react';

// Screen-level roles. These hide pages/buttons and block writes inside this
// app (see the fetch guard in supabase.ts), but the database itself does not
// yet enforce them — anyone with the public API key could still bypass them.
export type AccessLevel = 'admin' | 'team' | 'viewer' | 'removed';

export const ADMIN_EMAIL = 'amit@zionhills.in';

export const ACCESS_LABELS: Record<Exclude<AccessLevel, 'removed'>, string> = {
  admin: 'Admin',
  team: 'Team',
  viewer: 'Viewer',
};

export function resolveAccess(email: string | null | undefined, stored: string | null | undefined): AccessLevel {
  if (email && email.trim().toLowerCase() === ADMIN_EMAIL) return 'admin';
  if (stored === 'admin' || stored === 'viewer' || stored === 'removed') return stored;
  return 'team';
}

export interface Permissions {
  isAdmin: boolean;
  canWrite: boolean;
  canDeleteLeads: boolean;
  canSeeCampaigns: boolean;
  canSeeReports: boolean;
  canManageUsers: boolean;
}

export function permissionsFor(level: AccessLevel): Permissions {
  const isAdmin = level === 'admin';
  return {
    isAdmin,
    canWrite: level === 'admin' || level === 'team',
    canDeleteLeads: isAdmin,
    canSeeCampaigns: isAdmin,
    canSeeReports: isAdmin,
    canManageUsers: isAdmin,
  };
}

// Module-level store so the Supabase fetch guard (outside React) and any
// component can read the signed-in user's level without prop drilling.
let current: AccessLevel = 'team';
const listeners = new Set<(level: AccessLevel) => void>();

export function getAccess(): AccessLevel {
  return current;
}

export function setAccess(level: AccessLevel): void {
  current = level;
  listeners.forEach((l) => l(level));
}

export function usePermissions(): Permissions {
  const [level, setLevel] = useState(current);
  useEffect(() => {
    listeners.add(setLevel);
    return () => { listeners.delete(setLevel); };
  }, []);
  return permissionsFor(level);
}
