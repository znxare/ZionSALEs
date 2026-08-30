import { supabase, type Profile } from './supabase';
import type { Session } from '@supabase/supabase-js';

export interface CurrentUser {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
}

let cachedUser: CurrentUser | null = null;

// Synchronous access for call sites (like activity logging) that can't await
// a round trip just to stamp who performed the action.
export function getCurrentUser(): CurrentUser | null {
  return cachedUser;
}

async function loadProfile(session: Session): Promise<CurrentUser> {
  // A valid session already tells us who this is — build that fallback first so a
  // flaky connection (e.g. mobile data during a site tour) can never turn a real,
  // logged-in user into "nobody" and strip authorship off anything they log.
  const fallback: CurrentUser = {
    id: session.user.id,
    email: session.user.email ?? null,
    full_name: session.user.email ?? 'Team member',
    role: 'Sales Team',
  };
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    const profile = data as Profile | null;
    return {
      id: session.user.id,
      email: session.user.email ?? null,
      full_name: profile?.full_name ?? fallback.full_name,
      role: profile?.role ?? fallback.role,
    };
  } catch {
    return fallback;
  }
}

export async function getSession(): Promise<CurrentUser | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  cachedUser = data.session ? await loadProfile(data.session) : null;
  return cachedUser;
}

export function onAuthChange(callback: (user: CurrentUser | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      cachedUser = null;
      callback(null);
      return;
    }
    loadProfile(session)
      .then((user) => {
        cachedUser = user;
        callback(user);
      })
      .catch(() => {
        cachedUser = null;
        callback(null);
      });
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, fullName: string): Promise<void> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Could not create account — check your email to confirm, then sign in.');

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, full_name: fullName.trim() });
  if (profileError) throw profileError;
}

export async function signOutUser(): Promise<void> {
  await supabase.auth.signOut();
  cachedUser = null;
}
