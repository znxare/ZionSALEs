import { supabase, type Lead, type LeadInsert, type Activity, type ActivityInsert, type LeadSource, type LeadStatus, type Tour, type TourInsert, type TourStatus, type TourOutcome, type InterestLevel, type Campaign, type CampaignInsert, type CampaignType, type CampaignPlatform, type SiteVisit, type SiteVisitInsert, type SiteVisitStatus, type LeadBankEntry, type LeadBankInsert, type LeadBankStatus, type Todo, type TodoInsert, type ColdReason, type ReactivationOutcome, type ReactivationAttempt, type ReactivationAttemptInsert, type LeadImport, type LeadImportInsert } from './supabase';
import { normalizePhone } from './normalize';
import { getCurrentUser } from './auth';

export type { Lead, LeadInsert, Activity, ActivityInsert, LeadSource, LeadStatus, Tour, TourInsert, TourStatus, TourOutcome, InterestLevel, Campaign, CampaignInsert, CampaignType, CampaignPlatform, SiteVisit, SiteVisitInsert, SiteVisitStatus, LeadBankEntry, LeadBankInsert, LeadBankStatus, Todo, TodoInsert, ColdReason, ReactivationOutcome, ReactivationAttempt, ReactivationAttemptInsert, LeadImport, LeadImportInsert };

export const SOURCES: LeadSource[] = [
  'Walk-in', 'Website', 'Referral', 'Call', 'Social Media', 'Other',
  'Google Ads', 'Meta Ads', 'Instagram', 'Facebook', 'Email Campaign',
  'WhatsApp Campaign', 'Property Expo', 'Corporate Event', 'Golf Championship Event',
];

export const STATUSES: LeadStatus[] = [
  'Hot', 'Warm', 'Cold', 'Calling', 'Dead', 'Junk',
];

export const SALESPEOPLE = ['Aarav Mehta', 'Diya Sharma', 'Kabir Singh', 'Unassigned'];

export const CAMPAIGN_TYPES: CampaignType[] = ['Google Search', 'Meta Lead Ads', 'Instagram Reels', 'Referral Drive', 'Golf Championship Event', 'Email Campaign', 'WhatsApp Campaign', 'Property Expo', 'Corporate Tie-up', 'Walk-in', 'Organic', 'Other'];

export const CAMPAIGN_PLATFORMS: CampaignPlatform[] = ['Google', 'Meta', 'Instagram', 'WhatsApp', 'Email', 'Referral', 'Event', 'Other'];

export const TOUR_STATUSES: TourStatus[] = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No Show', 'Rescheduled'];

export const TOUR_OUTCOMES: TourOutcome[] = ['Ready to Book', 'Negotiation Started', 'Needs Another Visit', 'Follow-up Required', 'Loan Discussion', 'Not Interested'];

export const INTEREST_LEVELS: InterestLevel[] = ['Hot', 'Warm', 'Cold'];

export const PROPERTIES = ['Golf-facing Villa Plot', 'Lakeview Plot', 'Premium Villa', 'Garden Plot', 'East Gate Plot', 'Clubhouse Villa'];

export function tourStatusStyles(status: TourStatus): { bg: string; text: string; ring: string; dot: string } {
  switch (status) {
    case 'Scheduled': return { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', dot: 'bg-blue-500' };
    case 'Confirmed': return { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200', dot: 'bg-violet-500' };
    case 'Completed': return { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' };
    case 'Cancelled': return { bg: 'bg-gray-100', text: 'text-gray-500', ring: 'ring-gray-200', dot: 'bg-gray-400' };
    case 'No Show': return { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200', dot: 'bg-rose-500' };
    case 'Rescheduled': return { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', dot: 'bg-amber-500' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-200', dot: 'bg-gray-400' };
  }
}



// Smart defaults: reduce manual work by auto-assigning values based on source.
export function smartDefaults(source: string): { status: LeadStatus } {
  switch (source) {
    case 'Walk-in':
      return { status: 'Warm' };
    case 'Referral':
      return { status: 'Hot' };
    default:
      return { status: 'Warm' };
  }
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('next_followup_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function fetchLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Lead | null;
}

export async function fetchActivities(leadId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Activity[];
}

export interface ActivityFeedEntry extends Activity {
  lead_name: string | null;
}

// Global feed for the Activity Log page — recent actions across every lead, by everyone.
export async function fetchRecentActivities(limit = 100): Promise<ActivityFeedEntry[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const activities = (data ?? []) as Activity[];

  const leadIds = Array.from(new Set(activities.map((a) => a.lead_id)));
  if (leadIds.length === 0) return [];

  const { data: leadRows, error: leadError } = await supabase
    .from('leads')
    .select('id, name')
    .in('id', leadIds);
  if (leadError) throw leadError;
  const nameById = new Map((leadRows ?? []).map((l) => [l.id as string, l.name as string]));

  return activities.map((a) => ({ ...a, lead_name: nameById.get(a.lead_id) ?? null }));
}

// Lightweight server-side lookup for a single phone number — used to warn about
// duplicates in Add/Edit Lead without pulling every lead's phone to the client.
export async function findLeadByPhone(phone: string, excludeId?: string): Promise<{ id: string; name: string } | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  // Stored phone numbers keep the user's original formatting (e.g. "+91 98765 43210"),
  // so a plain substring match on the normalized digits misses numbers split up by
  // spaces/dashes/the country code. Match the digits in order with anything allowed
  // between them instead.
  const pattern = `%${normalized.split('').join('%')}%`;
  let query = supabase
    .from('leads')
    .select('id, name')
    .filter('phone', 'ilike', pattern);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string } | null;
}

export async function createLead(input: LeadInsert): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  const lead = data as Lead;

  await logActivity({
    lead_id: lead.id,
    type: 'Created',
    summary: `Lead created from ${lead.source}`,
    meta: { source: lead.source, status: lead.status, priority: lead.priority },
  });

  return lead;
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw error;
}

export async function logActivity(input: ActivityInsert): Promise<Activity> {
  const actor = getCurrentUser();
  const { data, error } = await supabase
    .from('activities')
    .insert({ ...input, actor_id: actor?.id ?? null, actor_name: actor?.full_name ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Activity;
}

// Record a quick action: save activity, update lead, suggest next follow-up.
export interface ActionResult {
  lead: Lead;
  activity: Activity;
}

const TERMINAL_STATUSES: LeadStatus[] = ['Dead', 'Junk'];

export function isFollowUpRequired(lead: Lead): boolean {
  return !TERMINAL_STATUSES.includes(lead.status) && !lead.booked_at;
}

export async function recordAction(
  lead: Lead,
  type: ActivityInsert['type'],
  summary: string,
  patch: Partial<Lead> = {},
  meta: Record<string, unknown> = {},
): Promise<ActionResult> {
  const finalPatch: Partial<Lead> = { ...patch };
  if (patch.status && TERMINAL_STATUSES.includes(patch.status)) {
    finalPatch.next_followup_at = null;
  }
  const updated = await updateLead(lead.id, {
    ...finalPatch,
    last_contacted_at: new Date().toISOString(),
  });
  const activity = await logActivity({
    lead_id: lead.id,
    type,
    summary,
    meta,
  });
  return { lead: updated, activity };
}

export async function scheduleFollowUp(
  lead: Lead,
  when: string,
  summary: string,
  patch: Partial<Lead> = {},
): Promise<ActionResult> {
  const previous = lead.next_followup_at;
  const updated = await updateLead(lead.id, {
    next_followup_at: when,
    ...patch,
  });
  const activity = await logActivity({
    lead_id: lead.id,
    type: 'Follow-up Scheduled',
    summary: previous ? `Rescheduled from ${formatDate(previous)} to ${formatDate(when)}` : summary,
    meta: { when, previous, ...patch },
  });
  return { lead: updated, activity };
}

export async function scheduleSiteVisit(
  lead: Lead,
  when: string,
): Promise<ActionResult> {
  const updated = await updateLead(lead.id, {
    site_visit_at: when,
    status: 'Warm',
    next_followup_at: when,
  });
  const activity = await logActivity({
    lead_id: lead.id,
    type: 'Site Visit Scheduled',
    summary: `Site visit scheduled for ${formatDate(when)}`,
    meta: { when },
  });
  return { lead: updated, activity };
}

export async function completeSiteVisit(lead: Lead): Promise<ActionResult> {
  // Create a completed site visit record so repeat visits are all counted.
  const existingVisits = await fetchSiteVisits(lead.id);
  const visitNumber = existingVisits.length + 1;
  await createSiteVisit({
    lead_id: lead.id,
    property: lead.project_interest ?? null,
    scheduled_at: new Date().toISOString(),
    status: 'Completed',
    visit_number: visitNumber,
    notes: 'Marked completed directly',
    family_members: null,
    customer_feedback: null,
    interest_level: null,
    outcome: null,
    next_followup_at: null,
  });

  const updated = await updateLead(lead.id, {
    status: 'Warm',
    next_followup_at: new Date(Date.now() + 2 * 86400000).toISOString(),
  });
  const activity = await logActivity({
    lead_id: lead.id,
    type: 'Site Visit Completed',
    summary: `Site visit ${visitNumber} completed`,
    meta: {},
  });
  return { lead: updated, activity };
}

// ---------- date helpers ----------

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return startOfDay(d).getTime() === startOfDay(now).getTime();
}

export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < startOfDay(new Date()).getTime();
}

export function isThisMonth(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function relativeDay(iso: string | null): string {
  if (!iso) return 'No follow-up';
  const d = new Date(iso);
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  return `in ${diff} days`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString();
}

// ---------- tour helpers ----------

export async function fetchTours(): Promise<Tour[]> {
  const { data, error } = await supabase
    .from('tours')
    .select('*')
    .order('scheduled_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tour[];
}

export async function createTour(input: TourInsert): Promise<Tour> {
  const { data, error } = await supabase
    .from('tours')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  const tour = data as Tour;

  // log activity on the linked lead
  await logActivity({
    lead_id: tour.lead_id,
    type: 'Site Visit Scheduled',
    summary: `Tour scheduled for ${formatDate(tour.scheduled_at)}${tour.property ? ' · ' + tour.property : ''}`,
    meta: { tour_id: tour.id, when: tour.scheduled_at },
  });

  // update lead's site_visit_at + status
  await updateLead(tour.lead_id, {
    site_visit_at: tour.scheduled_at,
    status: 'Warm',
    next_followup_at: tour.scheduled_at,
  });

  return tour;
}

export async function updateTour(id: string, patch: Partial<Tour>): Promise<Tour> {
  const { data, error } = await supabase
    .from('tours')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Tour;
}

export async function deleteTour(id: string): Promise<void> {
  const { error } = await supabase.from('tours').delete().eq('id', id);
  if (error) throw error;
}

// Mark tour completed, prompt outcome, auto-create follow-up.
export async function completeTour(tour: Tour, outcome: TourOutcome, details: {
  feedback?: string; objections?: string; interest?: InterestLevel; notes?: string;
}): Promise<{ tour: Tour; followUpAt: string }> {
  // Determine follow-up delay based on outcome
  const followUpDays = outcomeFollowUpDays(outcome);
  const followUpAt = daysFromNow(followUpDays);

  const updated = await updateTour(tour.id, {
    status: 'Completed',
    outcome,
    customer_feedback: details.feedback ?? null,
    objections: details.objections ?? null,
    interest_level: details.interest ?? null,
    notes: details.notes ?? null,
    next_followup_at: followUpAt,
  });

  // log activity on lead
  await logActivity({
    lead_id: tour.lead_id,
    type: 'Site Visit Completed',
    summary: `Tour completed · Outcome: ${outcome}`,
    meta: { tour_id: tour.id, outcome, interest: details.interest },
  });

  // update lead status based on outcome
  const leadPatch: Partial<Lead> = { next_followup_at: followUpAt };
  if (outcome === 'Ready to Book') leadPatch.status = 'Hot';
  else if (outcome === 'Not Interested') { leadPatch.status = 'Dead'; leadPatch.next_followup_at = null; }
  else if (outcome === 'Needs Another Visit') leadPatch.status = 'Warm';
  else leadPatch.status = 'Warm';
  if (details.interest === 'Hot') leadPatch.status = 'Hot';
  else if (details.interest === 'Cold' && outcome !== 'Ready to Book') leadPatch.status = 'Cold';

  await updateLead(tour.lead_id, leadPatch);

  return { tour: updated, followUpAt };
}

export function outcomeFollowUpDays(outcome: TourOutcome): number {
  switch (outcome) {
    case 'Ready to Book': return 1;
    case 'Negotiation Started': return 2;
    case 'Needs Another Visit': return 3;
    case 'Follow-up Required': return 2;
    case 'Loan Discussion': return 3;
    case 'Not Interested': return 30;
    default: return 3;
  }
}

// ---------- week / month helpers ----------

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - diff);
  return x;
}

export function isThisWeek(iso: string): boolean {
  const d = new Date(iso);
  const sow = startOfWeek(new Date());
  const eow = new Date(sow);
  eow.setDate(eow.getDate() + 7);
  return d >= sow && d < eow;
}

export function isUpcoming(iso: string): boolean {
  return new Date(iso).getTime() >= new Date().getTime();
}

// ---------- campaign helpers ----------

export async function fetchCampaigns(includeArchived = false): Promise<Campaign[]> {
  let q = supabase.from('campaigns').select('*');
  if (!includeArchived) q = q.eq('archived', false);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Campaign[];
}

export async function archiveCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('campaigns').update({ archived: true }).eq('id', id);
  if (error) throw error;
}

export async function unarchiveCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('campaigns').update({ archived: false }).eq('id', id);
  if (error) throw error;
}

export async function createCampaign(input: CampaignInsert): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Campaign;
}

export async function updateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Campaign;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) throw error;
}

// Lead Quality Score: percentage of leads that reached Hot, Site Visit, or Booking.
export function leadQualityScore(leads: Lead[]): { score: number; rating: 'Excellent' | 'Good' | 'Average' | 'Poor' } {
  if (leads.length === 0) return { score: 0, rating: 'Poor' };
  const qualified = leads.filter((l) =>
    l.status === 'Hot' || l.status === 'Warm' || !!l.booked_at
  ).length;
  const score = Math.round((qualified / leads.length) * 100);
  const rating = score >= 60 ? 'Excellent' : score >= 40 ? 'Good' : score >= 20 ? 'Average' : 'Poor';
  return { score, rating };
}

// Derive a lead source from a campaign type.
export function sourceFromCampaignType(type: CampaignType): LeadSource {
  switch (type) {
    case 'Google Search': return 'Google Ads';
    case 'Meta Lead Ads': return 'Meta Ads';
    case 'Instagram Reels': return 'Instagram';
    case 'Referral Drive': return 'Referral';
    case 'Golf Championship Event': return 'Golf Championship Event';
    case 'Email Campaign': return 'Email Campaign';
    case 'WhatsApp Campaign': return 'WhatsApp Campaign';
    case 'Property Expo': return 'Property Expo';
    case 'Corporate Tie-up': return 'Corporate Event';
    case 'Walk-in': return 'Walk-in';
    case 'Organic': return 'Website';
    case 'Other': return 'Website';
    default: return 'Website';
  }
}

// ---------- site visit helpers ----------

export async function fetchSiteVisits(leadId: string): Promise<SiteVisit[]> {
  const { data, error } = await supabase
    .from('site_visits')
    .select('*')
    .eq('lead_id', leadId)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SiteVisit[];
}

export async function fetchAllSiteVisits(): Promise<SiteVisit[]> {
  const { data, error } = await supabase
    .from('site_visits')
    .select('*')
    .order('scheduled_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SiteVisit[];
}

export async function createSiteVisit(input: SiteVisitInsert): Promise<SiteVisit> {
  const { data, error } = await supabase
    .from('site_visits')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  const visit = data as SiteVisit;

  await logActivity({
    lead_id: visit.lead_id,
    type: 'Site Visit Scheduled',
    summary: `Visit ${visit.visit_number} scheduled for ${formatDate(visit.scheduled_at)}${visit.property ? ' · ' + visit.property : ''}`,
    meta: { site_visit_id: visit.id, when: visit.scheduled_at },
  });

  await updateLead(visit.lead_id, {
    site_visit_at: visit.scheduled_at,
    status: 'Warm',
    next_followup_at: visit.scheduled_at,
  });

  return visit;
}

export async function updateSiteVisit(id: string, patch: Partial<SiteVisit>): Promise<SiteVisit> {
  const { data, error } = await supabase
    .from('site_visits')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as SiteVisit;
}

export async function deleteSiteVisit(id: string): Promise<void> {
  const { error } = await supabase.from('site_visits').delete().eq('id', id);
  if (error) throw error;
}

// Mark a site visit completed (can be called multiple times for repeat visits).
export async function completeSiteVisitById(visitId: string, leadId: string): Promise<void> {
  const { data: visit, error: fetchErr } = await supabase
    .from('site_visits')
    .select('*')
    .eq('id', visitId)
    .single();
  if (fetchErr) throw fetchErr;

  const { error: vErr } = await supabase
    .from('site_visits')
    .update({ status: 'Completed' })
    .eq('id', visitId);
  if (vErr) throw vErr;

  await logActivity({
    lead_id: leadId,
    type: 'Site Visit Completed',
    summary: `Site visit ${visit?.visit_number ?? ''} completed`,
    meta: { site_visit_id: visitId },
  });

  await updateLead(leadId, {
    status: 'Warm',
    next_followup_at: new Date(Date.now() + 2 * 86400000).toISOString(),
  });
}

// ---------- lead bank helpers ----------

export async function fetchLeadBank(): Promise<LeadBankEntry[]> {
  const { data, error } = await supabase
    .from('lead_bank')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadBankEntry[];
}

export async function createLeadBankEntry(input: LeadBankInsert): Promise<LeadBankEntry> {
  const { data, error } = await supabase
    .from('lead_bank')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as LeadBankEntry;
}

export async function updateLeadBankEntry(id: string, patch: Partial<LeadBankEntry>): Promise<void> {
  const { error } = await supabase.from('lead_bank').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteLeadBankEntry(id: string): Promise<void> {
  const { error } = await supabase.from('lead_bank').delete().eq('id', id);
  if (error) throw error;
}

// Convert a lead bank entry into a full lead in the CRM.
export async function convertLeadBankToLead(entry: LeadBankEntry, campaignId: string | null, status: LeadStatus): Promise<Lead> {
  const lead = await createLead({
    name: entry.name,
    phone: entry.phone,
    email: entry.email ?? null,
    city: entry.city ?? null,
    source: (entry.source as LeadSource) ?? 'Other',
    campaign_id: campaignId,
    status,
    priority: 'Medium',
    budget: null,
    budget_lakhs: null,
    project_interest: null,
    next_followup_at: new Date(Date.now() + 86400000).toISOString(),
    last_contacted_at: new Date().toISOString(),
    last_activity_type: 'Called',
    last_activity_at: new Date().toISOString(),
    assigned_to: null,
    site_visit_at: null,
    booked_at: null,
    notes: entry.notes ?? null,
    inquiry_date: entry.inquiry_date ?? null,
  });
  if (entry.notes && entry.notes.trim()) {
    await logActivity({
      lead_id: lead.id,
      type: 'Note Added',
      summary: entry.notes.trim(),
      meta: { source: 'lead_bank' },
    });
  }
  await updateLeadBankEntry(entry.id, { status: 'Converted' });
  return lead;
}

// ---------- lead import helpers ----------

export async function fetchLeadImports(): Promise<LeadImport[]> {
  const { data, error } = await supabase
    .from('lead_imports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadImport[];
}

export async function createLeadImportRecord(input: LeadImportInsert): Promise<LeadImport> {
  const { data, error } = await supabase
    .from('lead_imports')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as LeadImport;
}

export async function updateLeadImportRecord(id: string, patch: Partial<LeadImport>): Promise<void> {
  const { error } = await supabase.from('lead_imports').update(patch).eq('id', id);
  if (error) throw error;
}

// Only phone numbers are needed for duplicate-detection lookups — selecting just
// that column (instead of id/email too) roughly halves the payload on large tables.
export async function fetchAllLeadBankPhones(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('lead_bank')
    .select('phone');
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    const key = normalizePhone(row.phone ?? '');
    if (key) set.add(key);
  }
  return set;
}

export async function fetchAllLeadsPhones(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('leads')
    .select('phone');
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    const key = normalizePhone(row.phone ?? '');
    if (key) set.add(key);
  }
  return set;
}

export async function batchInsertLeadBank(rows: LeadBankInsert[]): Promise<{ inserted: number; errors: string[] }> {
  const BATCH_SIZE = 500;
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('lead_bank').insert(batch);
    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }
  return { inserted, errors };
}

export async function convertLeadBankToLeadSafe(entry: LeadBankEntry, campaignId: string | null, status: LeadStatus): Promise<Lead> {
  // Check if already converted — look for existing lead with same phone
  const normalizedPhone = normalizePhone(entry.phone ?? '');
  if (normalizedPhone) {
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .filter('phone', 'ilike', `%${normalizedPhone}%`)
      .limit(1)
      .maybeSingle();
    if (existing) {
      // Already exists — just mark as converted
      await updateLeadBankEntry(entry.id, { status: 'Converted' });
      return existing as Lead;
    }
  }

  const lead = await createLead({
    name: entry.name,
    phone: entry.phone,
    email: entry.email ?? null,
    city: entry.city ?? null,
    source: (entry.source as LeadSource) ?? 'Other',
    campaign_id: campaignId,
    status,
    priority: 'Medium',
    budget: null,
    budget_lakhs: null,
    project_interest: null,
    next_followup_at: new Date(Date.now() + 86400000).toISOString(),
    last_contacted_at: new Date().toISOString(),
    last_activity_type: 'Called',
    last_activity_at: new Date().toISOString(),
    assigned_to: null,
    site_visit_at: null,
    booked_at: null,
    notes: entry.notes ?? null,
    inquiry_date: entry.inquiry_date ?? null,
  });
  // Note: the caller (LeadBank's handleConvert) logs a 'Note Added' activity itself
  // for both the new-lead and existing-lead paths — don't duplicate it here.
  await updateLeadBankEntry(entry.id, { status: 'Converted' });
  return lead;
}

export async function fetchTodos(): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Todo[];
}

export async function createTodo(input: TodoInsert): Promise<Todo> {
  const { data, error } = await supabase
    .from('todos')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Todo;
}

export async function updateTodo(id: string, patch: Partial<Todo>): Promise<void> {
  const { error } = await supabase.from('todos').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('id', id);
  if (error) throw error;
}

// ---------- reactivation helpers ----------

export const COLD_REASONS: ColdReason[] = [
  'Budget Issue',
  'Loan Pending',
  'Family Decision Pending',
  'Investment Planned Later',
  'Wants to Buy Next Year',
  'Location Preference',
  'Comparing Other Projects',
  'Stopped Responding',
  'Out of Station',
  'Existing Property Not Sold',
  'Looking for Ready-to-Move Property',
  'Personal Reasons',
  'Other',
];

export const REACTIVATION_OUTCOMES: ReactivationOutcome[] = [
  'Interested Again',
  'Wants Site Visit',
  'Requested More Information',
  'Call Later',
  'Still Not Interested',
  'No Response',
];

export function coldReasonDays(reason: ColdReason): number | null {
  switch (reason) {
    case 'Budget Issue': return 90;
    case 'Loan Pending': return 60;
    case 'Family Decision Pending': return 30;
    case 'Investment Planned Later': return 180;
    case 'Wants to Buy Next Year': return 365;
    case 'Existing Property Not Sold': return 120;
    case 'Stopped Responding': return 30;
    case 'Location Preference': return 90;
    case 'Comparing Other Projects': return 60;
    case 'Out of Station': return 45;
    case 'Looking for Ready-to-Move Property': return 90;
    case 'Personal Reasons': return 60;
    default: return null; // Other — user selects
  }
}

export const REASON_SUGGESTIONS: Record<ColdReason, string[]> = {
  'Budget Issue': ['Share new pricing', 'Inform about payment plans', 'Offer limited-time discounts'],
  'Loan Pending': ['Share bank tie-ups', 'Explain EMI options', 'Arrange a finance consultation'],
  'Family Decision Pending': ['Schedule a weekend site visit', 'Invite the family', 'Share community amenities'],
  'Investment Planned Later': ['Send appreciation reports', 'Share market updates', 'Invite to investment events'],
  'Wants to Buy Next Year': ['Share early-bird pricing', 'Keep updated on new launches', 'Invite to preview events'],
  'Location Preference': ['Share location advantage map', 'Highlight nearby landmarks', 'Arrange a locality tour'],
  'Comparing Other Projects': ['Share comparison sheet', 'Highlight unique amenities', 'Offer a complimentary visit'],
  'Stopped Responding': ['Send a warm follow-up message', 'Share a new offer', 'Try a different channel (WhatsApp/Email)'],
  'Out of Station': ['Send a digital brochure', 'Schedule a virtual tour', 'Keep them updated on new launches'],
  'Existing Property Not Sold': ['Share resale support contacts', 'Offer flexible timelines', 'Update on inventory availability'],
  'Looking for Ready-to-Move Property': ['Share ready inventory', 'Arrange immediate site visit', 'Highlight completed amenities'],
  'Personal Reasons': ['Send a gentle check-in', 'Respect their timeline', 'Keep them in the newsletter loop'],
  'Other': ['Send a personalized follow-up', 'Check on their current situation', 'Share relevant updates'],
};

export async function fetchReactivationAttempts(leadId: string): Promise<ReactivationAttempt[]> {
  const { data, error } = await supabase
    .from('reactivation_attempts')
    .select('*')
    .eq('lead_id', leadId)
    .order('contacted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReactivationAttempt[];
}

export async function fetchAllReactivationAttempts(): Promise<ReactivationAttempt[]> {
  const { data, error } = await supabase
    .from('reactivation_attempts')
    .select('*')
    .order('contacted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReactivationAttempt[];
}

export async function createReactivationAttempt(input: ReactivationAttemptInsert): Promise<ReactivationAttempt> {
  const { data, error } = await supabase
    .from('reactivation_attempts')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as ReactivationAttempt;
}

// Mark a lead cold: sets reason, cold_since, and schedules next reactivation.
export async function markLeadCold(
  lead: Lead,
  reason: ColdReason,
  nextReactivationAt?: string,
): Promise<Lead> {
  const days = coldReasonDays(reason);
  const when = nextReactivationAt ?? (days ? daysFromNow(days) : daysFromNow(60));
  const updated = await updateLead(lead.id, {
    status: 'Cold',
    cold_reason: reason,
    cold_since: new Date().toISOString(),
    next_reactivation_at: when,
    next_followup_at: when,
  });
  await logActivity({
    lead_id: lead.id,
    type: 'Status Changed',
    summary: `Marked Cold — Reason: ${reason}. Reactivation scheduled ${formatDate(when)}.`,
    meta: { reason, next_reactivation_at: when },
  });
  return updated;
}

// One-click reactivation: record the attempt, and if interested, move back to warm.
export async function reactivateLead(
  lead: Lead,
  outcome: ReactivationOutcome,
  notes?: string,
): Promise<{ lead: Lead; reactivated: boolean }> {
  const interested = outcome === 'Interested Again' || outcome === 'Wants Site Visit' || outcome === 'Requested More Information';
  await createReactivationAttempt({
    lead_id: lead.id,
    reason: lead.cold_reason ?? 'Other',
    outcome,
    notes: notes ?? null,
    contacted_at: new Date().toISOString(),
    reactivated: interested,
  });

  if (interested) {
    const followUpAt = daysFromNow(2);
    const updated = await updateLead(lead.id, {
      status: 'Warm',
      cold_reason: null,
      cold_since: null,
      next_reactivation_at: null,
      next_followup_at: followUpAt,
      last_contacted_at: new Date().toISOString(),
    });
    await logActivity({
      lead_id: lead.id,
      type: 'Follow-up Scheduled',
      summary: `Reactivated — ${outcome}. Follow-up scheduled ${formatDate(followUpAt)}.`,
      meta: { outcome, reactivated: true },
    });
    return { lead: updated, reactivated: true };
  }

  // Not interested — schedule next reactivation based on reason.
  const days = lead.cold_reason ? coldReasonDays(lead.cold_reason as ColdReason) : 60;
  const when = daysFromNow(days ?? 60);
  const updated = await updateLead(lead.id, {
    next_reactivation_at: when,
    next_followup_at: when,
    last_contacted_at: new Date().toISOString(),
  });
  await logActivity({
    lead_id: lead.id,
    type: 'Note Added',
    summary: `Reactivation attempt — ${outcome}. Next reactivation ${formatDate(when)}.`,
    meta: { outcome, reactivated: false },
  });
  return { lead: updated, reactivated: false };
}
