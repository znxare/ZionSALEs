import { supabase } from './supabase';
import type { LeadStatus, LeadPriority, ActivityType } from './supabase';
import { normalizePhone } from './normalize';
import { getCurrentUser } from './auth';
import { assertWritable } from './demoMode';

// A parallel lead pipeline for the Hospitality division (getaway stays &
// corporate bookings), backed by its own `hospitality_leads` /
// `hospitality_activities` tables so this data never mixes with the
// Real Estate `leads` table. Reuses the same status/priority/activity
// vocabulary as `@/lib/crm` for a consistent UI, but every read/write
// here only ever touches the hospitality_* tables.

export type HospitalitySource =
  | 'Website' | 'Referral' | 'Walk-in' | 'OTA' | 'Travel Agent'
  | 'Corporate Tie-up' | 'MICE Agency' | 'Wedding Planner'
  | 'Social Media' | 'Repeat Guest' | 'Other';

export const HOSPITALITY_SOURCES: HospitalitySource[] = [
  'Website', 'Referral', 'Walk-in', 'OTA', 'Travel Agent',
  'Corporate Tie-up', 'MICE Agency', 'Wedding Planner',
  'Social Media', 'Repeat Guest', 'Other',
];

// Same funnel as Real Estate leads — keeps the two list UIs identical.
export const HOSPITALITY_STATUSES: LeadStatus[] = ['Hot', 'Warm', 'Cold', 'Calling', 'Dead', 'Junk'];

export interface HospitalityLead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  source: string;
  status: LeadStatus;
  priority: LeadPriority;
  budget: string | null;
  notes: string | null;
  next_followup_at: string | null;
  last_contacted_at: string | null;
  last_activity_type: string | null;
  last_activity_at: string | null;
  assigned_to: string | null;
  booked_at: string | null;
  created_at: string;
}

export type HospitalityLeadInsert = Omit<HospitalityLead, 'id' | 'created_at'>;

export interface HospitalityActivity {
  id: string;
  hospitality_lead_id: string;
  type: ActivityType;
  summary: string;
  meta: Record<string, unknown> | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export type HospitalityActivityInsert = Omit<HospitalityActivity, 'id' | 'created_at' | 'actor_id' | 'actor_name'>;

const TERMINAL_STATUSES: LeadStatus[] = ['Dead', 'Junk'];

export function isHospitalityFollowUpRequired(lead: HospitalityLead): boolean {
  return !TERMINAL_STATUSES.includes(lead.status) && !lead.booked_at;
}

export async function fetchHospitalityLeads(): Promise<HospitalityLead[]> {
  const { data, error } = await supabase
    .from('hospitality_leads')
    .select('*')
    .order('next_followup_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HospitalityLead[];
}

export async function fetchHospitalityLead(id: string): Promise<HospitalityLead | null> {
  const { data, error } = await supabase
    .from('hospitality_leads')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as HospitalityLead | null;
}

export async function findHospitalityLeadByPhone(phone: string, excludeId?: string): Promise<{ id: string; name: string } | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const pattern = `%${normalized.split('').join('%')}%`;
  let query = supabase
    .from('hospitality_leads')
    .select('id, name')
    .filter('phone', 'ilike', pattern);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string } | null;
}

export async function createHospitalityLead(input: HospitalityLeadInsert): Promise<HospitalityLead> {
  assertWritable();
  const { data, error } = await supabase
    .from('hospitality_leads')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  const lead = data as HospitalityLead;

  await logHospitalityActivity({
    hospitality_lead_id: lead.id,
    type: 'Created',
    summary: `Lead created from ${lead.source}`,
    meta: { source: lead.source, status: lead.status, priority: lead.priority },
  });

  return lead;
}

export async function updateHospitalityLead(id: string, patch: Partial<HospitalityLead>): Promise<HospitalityLead> {
  assertWritable();
  const { data, error } = await supabase
    .from('hospitality_leads')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as HospitalityLead;
}

export async function deleteHospitalityLead(id: string): Promise<void> {
  assertWritable();
  const { error } = await supabase.from('hospitality_leads').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchHospitalityActivities(leadId: string): Promise<HospitalityActivity[]> {
  const { data, error } = await supabase
    .from('hospitality_activities')
    .select('*')
    .eq('hospitality_lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as HospitalityActivity[];
}

export async function logHospitalityActivity(input: HospitalityActivityInsert): Promise<HospitalityActivity> {
  assertWritable();
  const actor = getCurrentUser();
  const { data, error } = await supabase
    .from('hospitality_activities')
    .insert({ ...input, actor_id: actor?.id ?? null, actor_name: actor?.full_name ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as HospitalityActivity;
}

export interface HospitalityActionResult {
  lead: HospitalityLead;
  activity: HospitalityActivity;
}

export async function recordHospitalityAction(
  lead: HospitalityLead,
  type: HospitalityActivityInsert['type'],
  summary: string,
  patch: Partial<HospitalityLead> = {},
  meta: Record<string, unknown> = {},
): Promise<HospitalityActionResult> {
  const finalPatch: Partial<HospitalityLead> = { ...patch };
  if (patch.status && TERMINAL_STATUSES.includes(patch.status)) {
    finalPatch.next_followup_at = null;
  }
  const updated = await updateHospitalityLead(lead.id, {
    ...finalPatch,
    last_contacted_at: new Date().toISOString(),
  });
  const activity = await logHospitalityActivity({
    hospitality_lead_id: lead.id,
    type,
    summary,
    meta,
  });
  return { lead: updated, activity };
}

export async function scheduleHospitalityFollowUp(
  lead: HospitalityLead,
  when: string,
  summary: string,
  patch: Partial<HospitalityLead> = {},
): Promise<HospitalityActionResult> {
  const previous = lead.next_followup_at;
  const updated = await updateHospitalityLead(lead.id, {
    next_followup_at: when,
    ...patch,
  });
  const activity = await logHospitalityActivity({
    hospitality_lead_id: lead.id,
    type: 'Follow-up Scheduled',
    summary: previous ? `Rescheduled from ${previous} to ${when}` : summary,
    meta: { when, previous, ...patch },
  });
  return { lead: updated, activity };
}
