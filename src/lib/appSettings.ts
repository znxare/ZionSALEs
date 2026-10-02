import { supabase } from './supabase';
import type { ModuleVisibility } from './access';

// Team-wide settings stored in the app_settings table (one row per key).

const MODULE_KEY = 'module_visibility';

/** Saved module visibility, or null if none saved yet / table not created. */
export async function fetchModuleVisibility(): Promise<ModuleVisibility | null> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', MODULE_KEY).maybeSingle();
  if (error || !data) return null;
  const v = data.value as Partial<ModuleVisibility> | null;
  if (!v || !Array.isArray(v.team) || !Array.isArray(v.viewer)) return null;
  return { team: v.team, viewer: v.viewer };
}

export async function saveModuleVisibility(v: ModuleVisibility): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: MODULE_KEY, value: v, updated_at: new Date().toISOString() });
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      throw new Error("Can't save yet — run the module-access SQL in Supabase first.");
    }
    throw error;
  }
}
