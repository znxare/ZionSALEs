import { createClient } from '@supabase/supabase-js';
import { supabase, url, anonKey, type Profile } from './supabase';
import type { AccessLevel } from './access';

// Admin-only team management. Changing someone else's profile relies on the
// admin policies added by the roles migration.

export async function setMemberAccess(id: string, access: AccessLevel): Promise<void> {
  const { error } = await supabase.from('profiles').update({ access_level: access }).eq('id', id);
  if (error) throw error;
}

// Creates the login from a throwaway client so the admin stays signed in as
// themselves (signUp on the main client would switch the session).
export async function addMember(input: { fullName: string; email: string; password: string; access: AccessLevel }): Promise<Profile> {
  const email = input.email.trim().toLowerCase();
  const temp = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'zion-add-member' },
  });
  const { data, error } = await temp.auth.signUp({ email, password: input.password });
  if (error) throw error;
  // Supabase returns a user with no identities when the email already has a login.
  if (!data.user || data.user.identities?.length === 0) throw new Error('That email already has a login.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, full_name: input.fullName.trim(), email, access_level: input.access })
    .select()
    .single();
  if (profileError) throw profileError;
  return profile as Profile;
}
