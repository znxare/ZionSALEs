import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type LeadStatus =
  | 'Hot'
  | 'Warm'
  | 'Cold'
  | 'Calling'
  | 'Dead'
  | 'Junk';

export type LeadPriority = 'High' | 'Medium' | 'Low';

export type LeadSource =
  | 'Walk-in'
  | 'Website'
  | 'Referral'
  | 'Call'
  | 'Social Media'
  | 'Other'
  | 'Google Ads'
  | 'Meta Ads'
  | 'Instagram'
  | 'Facebook'
  | 'Email Campaign'
  | 'WhatsApp Campaign'
  | 'Property Expo'
  | 'Corporate Event'
  | 'Golf Championship Event';

export type ActivityType =
  | 'Created'
  | 'Called'
  | 'WhatsApp Sent'
  | 'Site Visit Scheduled'
  | 'Site Visit Completed'
  | 'Follow-up Scheduled'
  | 'Status Changed'
  | 'Not Interested'
  | 'No Answer'
  | 'Note Added'
  | 'Customer Feedback'
  | 'Negotiation'
  | 'Booking'
  | 'Sale Completed';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  source: string;
  status: LeadStatus;
  priority: LeadPriority;
  budget: string | null;
  budget_lakhs: number | null;
  project_interest: string | null;
  next_followup_at: string | null;
  last_contacted_at: string | null;
  last_activity_type: string | null;
  last_activity_at: string | null;
  assigned_to: string | null;
  campaign_id: string | null;
  site_visit_at: string | null;
  booked_at: string | null;
  notes: string | null;
  created_at: string;
  cold_reason: string | null;
  cold_since: string | null;
  next_reactivation_at: string | null;
  inquiry_date: string | null;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: ActivityType;
  summary: string;
  meta: Record<string, unknown> | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'cold_reason' | 'cold_since' | 'next_reactivation_at' | 'inquiry_date'> & Partial<Pick<Lead, 'cold_reason' | 'cold_since' | 'next_reactivation_at' | 'inquiry_date'>>;
export type ActivityInsert = Omit<Activity, 'id' | 'created_at' | 'actor_id' | 'actor_name'>;

export type TourStatus =
  | 'Scheduled'
  | 'Confirmed'
  | 'Completed'
  | 'Cancelled'
  | 'No Show'
  | 'Rescheduled';

export type TourOutcome =
  | 'Ready to Book'
  | 'Negotiation Started'
  | 'Needs Another Visit'
  | 'Follow-up Required'
  | 'Loan Discussion'
  | 'Not Interested';

export type InterestLevel = 'Hot' | 'Warm' | 'Cold';

export interface Tour {
  id: string;
  lead_id: string;
  scheduled_at: string;
  property: string | null;
  sales_executive: string | null;
  status: TourStatus;
  outcome: TourOutcome | null;
  family_attended: string | null;
  customer_feedback: string | null;
  objections: string | null;
  budget: string | null;
  interest_level: InterestLevel | null;
  notes: string | null;
  next_followup_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TourInsert = Omit<Tour, 'id' | 'created_at' | 'updated_at'>;

export type CampaignType =
  | 'Google Search'
  | 'Meta Lead Ads'
  | 'Instagram Reels'
  | 'Referral Drive'
  | 'Golf Championship Event'
  | 'Email Campaign'
  | 'WhatsApp Campaign'
  | 'Property Expo'
  | 'Corporate Tie-up'
  | 'Walk-in'
  | 'Organic'
  | 'Other';

export type CampaignPlatform = 'Google' | 'Meta' | 'Instagram' | 'WhatsApp' | 'Email' | 'Referral' | 'Event' | 'Other';

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  platform: CampaignPlatform | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  description: string | null;
  archived: boolean;
  created_at: string;
}

export type CampaignInsert = Omit<Campaign, 'id' | 'created_at' | 'archived'> & Partial<Pick<Campaign, 'archived'>>;

export type SiteVisitStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';

export interface SiteVisit {
  id: string;
  lead_id: string;
  visit_number: number;
  scheduled_at: string;
  property: string | null;
  family_members: string | null;
  customer_feedback: string | null;
  interest_level: InterestLevel | null;
  outcome: TourOutcome | null;
  notes: string | null;
  next_followup_at: string | null;
  status: SiteVisitStatus;
  created_at: string;
}

export type SiteVisitInsert = Omit<SiteVisit, 'id' | 'created_at'>;

export type LeadBankStatus = 'New' | 'Hot' | 'Cold' | 'Not Reachable' | 'Not Interested' | 'Converted';

export interface LeadBankEntry {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  source: string | null;
  campaign_id: string | null;
  status: LeadBankStatus;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
  inquiry_date: string | null;
  original_source: string | null;
}

export type LeadBankInsert = Omit<LeadBankEntry, 'id' | 'created_at' | 'status' | 'last_contacted_at' | 'notes' | 'inquiry_date' | 'original_source'> & Partial<Pick<LeadBankEntry, 'status' | 'last_contacted_at' | 'notes' | 'inquiry_date' | 'original_source'>>;

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  done: boolean;
  assignee: string | null;
  created_at: string;
}

export type TodoInsert = Omit<Todo, 'id' | 'created_at' | 'done'> & Partial<Pick<Todo, 'done'>>;

export type ColdReason =
  | 'Budget Issue'
  | 'Loan Pending'
  | 'Family Decision Pending'
  | 'Investment Planned Later'
  | 'Wants to Buy Next Year'
  | 'Location Preference'
  | 'Comparing Other Projects'
  | 'Stopped Responding'
  | 'Out of Station'
  | 'Existing Property Not Sold'
  | 'Looking for Ready-to-Move Property'
  | 'Personal Reasons'
  | 'Other';

export type ReactivationOutcome =
  | 'Interested Again'
  | 'Wants Site Visit'
  | 'Requested More Information'
  | 'Call Later'
  | 'Still Not Interested'
  | 'No Response';

export interface ReactivationAttempt {
  id: string;
  lead_id: string;
  reason: string;
  outcome: string;
  notes: string | null;
  contacted_at: string;
  reactivated: boolean;
  created_at: string;
}

export type ReactivationAttemptInsert = Omit<ReactivationAttempt, 'id' | 'created_at'>;

export interface LeadImport {
  id: string;
  file_name: string;
  import_type: string;
  total_rows: number;
  new_rows: number;
  duplicate_rows: number;
  invalid_rows: number;
  conflict_rows: number;
  campaigns_created: number;
  completed_at: string | null;
  created_at: string;
}

export type LeadImportInsert = Omit<LeadImport, 'id' | 'created_at'>;
