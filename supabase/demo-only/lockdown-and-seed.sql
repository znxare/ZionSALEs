-- ============================================================================
-- DEMO PROJECT ONLY — never run this against the production Zion Hills
-- Supabase project. Run once, manually, in the demo project's SQL Editor
-- (SQL Editor executes as `postgres`, so it bypasses RLS — the lockdown
-- section at the bottom doesn't block the seed inserts above it).
--
-- What this does:
--   1. Seeds realistic sample data so the public demo isn't empty.
--   2. Locks every table to SELECT-only for anon + authenticated, so no
--      visitor (logged in or not — this demo doesn't expose login at all,
--      but this also closes the "sign up via the Supabase Auth API
--      directly" loophole) can write or delete anything.
--
-- Kept outside supabase/migrations/ on purpose: `supabase db push` must
-- never apply this to a real customer project.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Seed data
-- ---------------------------------------------------------------------------

insert into campaigns (id, name, type, platform, start_date, end_date, budget, description, archived) values
  ('22222222-2222-2222-2222-222222222201', 'Monsoon Golf Championship Event', 'Golf Championship Event', 'Event', current_date - 45, current_date - 40, 850000, 'Invitational golf event at the club to showcase the villa plots to high-net-worth prospects.', false),
  ('22222222-2222-2222-2222-222222222202', 'Meta Lead Ads — Lakeview Launch', 'Meta Lead Ads', 'Meta', current_date - 30, current_date + 15, 250000, 'Facebook/Instagram lead-gen campaign for the new Lakeview Plot phase.', false),
  ('22222222-2222-2222-2222-222222222203', 'Referral Drive Q3', 'Referral Drive', 'Referral', current_date - 60, null, 0, 'Existing owner referral incentive program.', false)
on conflict (id) do nothing;

insert into leads (id, name, phone, email, city, source, status, priority, budget, budget_lakhs, project_interest, next_followup_at, last_contacted_at, site_visit_at, booked_at, notes, assigned_to, last_activity_type, last_activity_at, campaign_id, inquiry_date) values
  ('11111111-1111-1111-1111-111111111101', 'Arjun Mehta', '+91 98765 43210', 'arjun.mehta@example.com', 'Bengaluru', 'Golf Championship Event', 'Hot', 'High', '2.5 Cr', 250, 'Golf-facing Villa Plot', now() + interval '1 day', now() - interval '2 days', now() + interval '3 days', null, 'Very keen after the club event, wants a golf-facing plot near the 9th hole.', 'Priya Nair', 'Site Visit Scheduled', now() - interval '2 days', '22222222-2222-2222-2222-222222222201', current_date - 42),
  ('11111111-1111-1111-1111-111111111102', 'Sneha Rao', '+91 98450 11223', 'sneha.rao@example.com', 'Chennai', 'Meta Ads', 'Warm', 'Medium', '1.8 Cr', 180, 'Lakeview Plot', now() + interval '2 days', now() - interval '1 day', null, null, 'Comparing with two other projects, wants a payment plan breakdown.', 'Karthik Iyer', 'Called', now() - interval '1 day', '22222222-2222-2222-2222-222222222202', current_date - 20),
  ('11111111-1111-1111-1111-111111111103', 'Rahul Verma', '+91 99887 76655', 'rahul.verma@example.com', 'Bengaluru', 'Referral', 'Hot', 'High', '3 Cr', 300, 'Premium Villa', now() + interval '1 day', now() - interval '3 hours', now() + interval '5 days', null, 'Referred by an existing owner (Villa 12). Ready to move fast.', 'Priya Nair', 'Note Added', now() - interval '3 hours', '22222222-2222-2222-2222-222222222203', current_date - 10),
  ('11111111-1111-1111-1111-111111111104', 'Divya Krishnan', '+91 97025 88991', null, 'Coimbatore', 'Website', 'Warm', 'Medium', '1.5 Cr', 150, 'Garden Plot', now() + interval '4 days', now() - interval '4 days', null, null, 'Requested a virtual tour, out of station until next week.', null, 'WhatsApp Sent', now() - interval '4 days', null, null),
  ('11111111-1111-1111-1111-111111111105', 'Vikram Singh', '+91 98220 33445', 'vikram.singh@example.com', 'Hyderabad', 'Instagram', 'Cold', 'Low', '1.2 Cr', 120, 'East Gate Plot', now() + interval '20 days', now() - interval '35 days', null, null, null, 'Karthik Iyer', 'Status Changed', now() - interval '30 days', '22222222-2222-2222-2222-222222222202', current_date - 50),
  ('11111111-1111-1111-1111-111111111106', 'Ananya Iyer', '+91 90040 12233', 'ananya.iyer@example.com', 'Chennai', 'Walk-in', 'Warm', 'Medium', '2 Cr', 200, 'Clubhouse Villa', now() + interval '2 days', now() - interval '6 days', now() - interval '6 days', null, 'Visited with family, positive feedback on the clubhouse amenities.', 'Priya Nair', 'Site Visit Completed', now() - interval '6 days', null, current_date - 6),
  ('11111111-1111-1111-1111-111111111107', 'Manoj Pillai', '+91 89393 22110', null, 'Kochi', 'Referral', 'Calling', 'Medium', '1.6 Cr', 160, 'Lakeview Plot', now() + interval '1 day', now() - interval '1 day', null, null, 'Third follow-up call attempted, no answer yet.', 'Karthik Iyer', 'No Answer', now() - interval '1 day', '22222222-2222-2222-2222-222222222203', current_date - 15),
  ('11111111-1111-1111-1111-111111111108', 'Kavya Reddy', '+91 91234 56789', 'kavya.reddy@example.com', 'Hyderabad', 'Property Expo', 'Warm', 'High', '2.2 Cr', 220, 'Golf-facing Villa Plot', now() + interval '3 days', now() - interval '5 days', now() + interval '8 days', null, 'Met at the property expo, loved the golf course views.', 'Priya Nair', 'Site Visit Scheduled', now() - interval '5 days', null, current_date - 8),
  ('11111111-1111-1111-1111-111111111109', 'Farhan Sheikh', '+91 88990 11223', null, 'Bengaluru', 'Google Ads', 'Dead', 'Low', null, null, null, null, now() - interval '40 days', null, null, 'Budget mismatch, went with a competitor project.', null, 'Status Changed', now() - interval '40 days', '22222222-2222-2222-2222-222222222202', current_date - 60),
  ('11111111-1111-1111-1111-111111111110', 'Meera Nambiar', '+91 97890 12345', 'meera.n@example.com', 'Kochi', 'WhatsApp Campaign', 'Junk', 'Low', null, null, null, null, now() - interval '20 days', null, null, 'Number unreachable, likely invalid entry.', null, 'Note Added', now() - interval '20 days', null, current_date - 25),
  ('11111111-1111-1111-1111-111111111111', 'Rohit Bhatia', '+91 99001 22334', 'rohit.bhatia@example.com', 'Delhi', 'Corporate Event', 'Hot', 'High', '3.5 Cr', 350, 'Premium Villa', now() + interval '1 day', now() - interval '12 hours', now() + interval '2 days', null, 'Corporate tie-up lead, company is subsidizing part of the down payment.', 'Karthik Iyer', 'Negotiation', now() - interval '12 hours', null, current_date - 5),
  ('11111111-1111-1111-1111-111111111112', 'Priyanka Das', '+91 96540 87654', 'priyanka.das@example.com', 'Bengaluru', 'Golf Championship Event', 'Warm', 'Medium', '1.9 Cr', 190, 'Lakeview Plot', now() + interval '5 days', now() - interval '8 days', null, null, 'Wants to bring in her financial advisor before deciding.', 'Priya Nair', 'Called', now() - interval '8 days', '22222222-2222-2222-2222-222222222201', current_date - 43)
on conflict (id) do nothing;

insert into activities (id, lead_id, type, summary, meta, actor_name, created_at) values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111101', 'Created', 'Lead created from Golf Championship Event', '{"source":"Golf Championship Event"}', 'Priya Nair', now() - interval '42 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111101', 'Called', 'Discussed pricing and payment plan', '{}', 'Priya Nair', now() - interval '10 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111101', 'Site Visit Scheduled', 'Site visit scheduled for golf-facing plot', '{}', 'Priya Nair', now() - interval '2 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111102', 'Created', 'Lead created from Meta Ads', '{"source":"Meta Ads"}', 'Karthik Iyer', now() - interval '20 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111102', 'Called', 'Sent comparison sheet vs competitor projects', '{}', 'Karthik Iyer', now() - interval '1 day'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111103', 'Created', 'Lead created from Referral', '{"source":"Referral"}', 'Priya Nair', now() - interval '10 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111103', 'Note Added', 'Referred by Villa 12 owner, very warm intro', '{}', 'Priya Nair', now() - interval '3 hours'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111104', 'Created', 'Lead created from Website', '{"source":"Website"}', 'Karthik Iyer', now() - interval '9 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111104', 'WhatsApp Sent', 'Sent virtual tour link', '{}', 'Karthik Iyer', now() - interval '4 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111105', 'Created', 'Lead created from Instagram', '{"source":"Instagram"}', 'Karthik Iyer', now() - interval '50 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111105', 'Status Changed', 'Marked Cold — Reason: Budget Issue', '{"reason":"Budget Issue"}', 'Karthik Iyer', now() - interval '30 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111106', 'Created', 'Lead created from Walk-in', '{"source":"Walk-in"}', 'Priya Nair', now() - interval '6 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111106', 'Site Visit Completed', 'Site visit 1 completed', '{}', 'Priya Nair', now() - interval '6 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111107', 'Created', 'Lead created from Referral', '{"source":"Referral"}', 'Karthik Iyer', now() - interval '15 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111107', 'No Answer', 'Third follow-up call attempted, no answer', '{}', 'Karthik Iyer', now() - interval '1 day'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111108', 'Created', 'Lead created from Property Expo', '{"source":"Property Expo"}', 'Priya Nair', now() - interval '8 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111108', 'Site Visit Scheduled', 'Site visit scheduled', '{}', 'Priya Nair', now() - interval '5 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111109', 'Created', 'Lead created from Google Ads', '{"source":"Google Ads"}', 'Karthik Iyer', now() - interval '60 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111109', 'Status Changed', 'Marked Dead — went with a competitor', '{}', 'Karthik Iyer', now() - interval '40 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Created', 'Lead created from Corporate Event', '{"source":"Corporate Event"}', 'Karthik Iyer', now() - interval '5 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Negotiation', 'Discussing corporate subsidy terms', '{}', 'Karthik Iyer', now() - interval '12 hours'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111112', 'Created', 'Lead created from Golf Championship Event', '{"source":"Golf Championship Event"}', 'Priya Nair', now() - interval '43 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111112', 'Called', 'Wants to loop in financial advisor', '{}', 'Priya Nair', now() - interval '8 days');

insert into tours (id, lead_id, scheduled_at, property, sales_executive, status, outcome, family_attended, customer_feedback, interest_level, next_followup_at) values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111101', now() + interval '3 days', 'Golf-facing Villa Plot', 'Priya Nair', 'Confirmed', null, 'Spouse', null, 'Hot', null),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111103', now() + interval '5 days', 'Premium Villa', 'Priya Nair', 'Scheduled', null, null, null, 'Hot', null),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111106', now() - interval '6 days', 'Clubhouse Villa', 'Priya Nair', 'Completed', 'Needs Another Visit', 'Spouse, 2 children', 'Loved the clubhouse, wants to see the villa interiors next', 'Warm', now() + interval '2 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111108', now() + interval '8 days', 'Golf-facing Villa Plot', 'Priya Nair', 'Scheduled', null, null, null, 'Warm', null);

insert into site_visits (id, lead_id, visit_number, scheduled_at, property, family_members, customer_feedback, interest_level, outcome, status) values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111106', 1, now() - interval '6 days', 'Clubhouse Villa', 'Spouse, 2 children', 'Loved the clubhouse, wants to see villa interiors next', 'Warm', 'Needs Another Visit', 'Completed'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111101', 1, now() + interval '3 days', 'Golf-facing Villa Plot', 'Spouse', null, null, null, 'Scheduled');

insert into lead_bank (id, name, phone, email, city, source, status, notes, inquiry_date, original_source) values
  (gen_random_uuid(), 'Suresh Kumar', '+91 90909 11223', 'suresh.k@example.com', 'Bengaluru', 'Facebook Form', 'New', 'Not yet contacted, imported from last week''s ad batch.', current_date - 4, 'US Real Estate — meta form'),
  (gen_random_uuid(), 'Lakshmi Menon', '+91 89898 44556', null, 'Kochi', 'Google Form', 'New', null, current_date - 2, 'Organic — website enquiry form'),
  (gen_random_uuid(), 'Aditya Kapoor', '+91 91919 77889', 'aditya.k@example.com', 'Chennai', 'Referral', 'Hot', 'Referred by Rahul Verma, very promising.', current_date - 1, 'Referral Drive Q3');

insert into todos (id, title, description, due_date, done, assignee) values
  (gen_random_uuid(), 'Call Manoj Pillai — 3rd attempt', 'No answer twice, try after 6pm', current_date + 1, false, 'Karthik Iyer'),
  (gen_random_uuid(), 'Prepare payment plan sheet for Sneha Rao', 'Include EMI comparison for Lakeview Plot', current_date, false, 'Karthik Iyer'),
  (gen_random_uuid(), 'Follow up with Priyanka Das after advisor call', null, current_date + 5, false, 'Priya Nair'),
  (gen_random_uuid(), 'Send golf event photos to all Hot leads', 'Use last month''s championship event album', current_date - 1, true, 'Priya Nair');

insert into reactivation_attempts (id, lead_id, reason, outcome, notes, contacted_at, reactivated) values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111105', 'Budget Issue', 'Call Later', 'Asked to check back next quarter after a bonus payout.', now() - interval '5 days', false);

insert into lead_imports (id, file_name, import_type, total_rows, new_rows, duplicate_rows, invalid_rows, conflict_rows, campaigns_created, completed_at) values
  (gen_random_uuid(), 'expo_leads_batch_march.xlsx', 'Meta / Advertisement', 48, 41, 5, 2, 0, 1, now() - interval '10 days');

-- ---------------------------------------------------------------------------
-- 2. Lockdown: read-only for everyone (anon AND authenticated), on every
--    table. Drops the wide-open insert/update/delete policies; with no
--    policy left for those commands, RLS denies them outright.
-- ---------------------------------------------------------------------------

drop policy if exists "anon_insert_leads" on leads;
drop policy if exists "anon_update_leads" on leads;
drop policy if exists "anon_delete_leads" on leads;

drop policy if exists "anon_insert_activities" on activities;
drop policy if exists "anon_update_activities" on activities;
drop policy if exists "anon_delete_activities" on activities;

drop policy if exists "anon_insert_tours" on tours;
drop policy if exists "anon_update_tours" on tours;
drop policy if exists "anon_delete_tours" on tours;

drop policy if exists "anon_insert_campaigns" on campaigns;
drop policy if exists "anon_update_campaigns" on campaigns;
drop policy if exists "anon_delete_campaigns" on campaigns;

drop policy if exists "anon_insert_site_visits" on site_visits;
drop policy if exists "anon_update_site_visits" on site_visits;
drop policy if exists "anon_delete_site_visits" on site_visits;

drop policy if exists "anon_insert_lead_bank" on lead_bank;
drop policy if exists "anon_update_lead_bank" on lead_bank;
drop policy if exists "anon_delete_lead_bank" on lead_bank;

drop policy if exists "anon_insert_todos" on todos;
drop policy if exists "anon_update_todos" on todos;
drop policy if exists "anon_delete_todos" on todos;

drop policy if exists "anon_insert_reactivation_attempts" on reactivation_attempts;
drop policy if exists "anon_update_reactivation_attempts" on reactivation_attempts;
drop policy if exists "anon_delete_reactivation_attempts" on reactivation_attempts;

drop policy if exists "anon_insert_lead_imports" on lead_imports;
drop policy if exists "anon_update_lead_imports" on lead_imports;
drop policy if exists "anon_delete_lead_imports" on lead_imports;

drop policy if exists "self_insert_profile" on profiles;
drop policy if exists "self_update_profile" on profiles;

-- profiles is normally authenticated-only for SELECT; this demo never
-- authenticates, so add an anon read policy purely for display purposes
-- (assigned-to / actor names in seeded data).
drop policy if exists "anon_select_profiles" on profiles;
create policy "anon_select_profiles" on profiles for select
  to anon using (true);
