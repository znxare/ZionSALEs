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
  canManageUsers: boolean;
}

export function permissionsFor(level: AccessLevel): Permissions {
  const isAdmin = level === 'admin';
  return {
    isAdmin,
    canWrite: level === 'admin' || level === 'team',
    canDeleteLeads: isAdmin,
    canManageUsers: isAdmin,
  };
}

// ---------- module visibility (admin-configurable per role) ----------

// Pages the admin can show/hide for Team and Viewer. Dashboard and Settings
// are always visible; the admin always sees everything.
export const CONFIGURABLE_MODULES: { id: string; label: string; group: string }[] = [
  { id: 'leads', label: 'All Leads', group: 'Real Estate' },
  { id: 'leadbank', label: 'Lead Bank', group: 'Real Estate' },
  { id: 'sitevisits', label: 'Site Visits', group: 'Real Estate' },
  { id: 'inventory', label: 'Live Inventory Board', group: 'Real Estate' },
  { id: 'hospitality-leads', label: 'All Leads', group: 'Hospitality' },
  { id: 'hospitality-leadbank', label: 'Lead Bank', group: 'Hospitality' },
  { id: 'import', label: 'Lead Import', group: 'Tools' },
  { id: 'planner', label: 'Day Planner', group: 'Tools' },
  { id: 'campaigns', label: 'Campaigns', group: 'Tools' },
  { id: 'reactivation', label: 'Reactivation', group: 'Tools' },
  { id: 'battlecard', label: 'Battle Card', group: 'Tools' },
  { id: 'activitylog', label: 'Activity Log', group: 'Tools' },
  { id: 'reports', label: 'Reports', group: 'Tools' },
];

/** Module ids hidden from each non-admin role. */
export interface ModuleVisibility {
  team: string[];
  viewer: string[];
}

// Used until the admin saves their own choice (matches the original rules).
export const DEFAULT_MODULE_VISIBILITY: ModuleVisibility = {
  team: ['campaigns', 'reports'],
  viewer: ['campaigns', 'reports', 'import'],
};

let hiddenModules: ModuleVisibility = DEFAULT_MODULE_VISIBILITY;
const moduleListeners = new Set<(v: ModuleVisibility) => void>();

export function getModuleVisibility(): ModuleVisibility {
  return hiddenModules;
}

export function setModuleVisibility(v: ModuleVisibility | null): void {
  hiddenModules = v ?? DEFAULT_MODULE_VISIBILITY;
  moduleListeners.forEach((l) => l(hiddenModules));
}

export function canSeeModule(level: AccessLevel, id: string, v: ModuleVisibility = hiddenModules): boolean {
  if (level === 'admin' || id === 'dashboard' || id === 'settings') return true;
  if (level === 'removed') return false;
  return !v[level].includes(id);
}

/** Returns a checker for the signed-in user: canSee('campaigns'). */
export function useModuleAccess(): (id: string) => boolean {
  const [level, setLevel] = useState(current);
  const [v, setV] = useState(hiddenModules);
  useEffect(() => {
    listeners.add(setLevel);
    moduleListeners.add(setV);
    return () => { listeners.delete(setLevel); moduleListeners.delete(setV); };
  }, []);
  return (id: string) => canSeeModule(level, id, v);
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
