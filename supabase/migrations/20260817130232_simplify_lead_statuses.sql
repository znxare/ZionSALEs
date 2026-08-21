-- Map old statuses to the new simplified set: Hot, Warm, Cold, Calling, Dead, Junk
-- 'Sold' and 'Booked' are now tracked via booked_at timestamp, not status
UPDATE leads SET status = 'Warm' WHERE status = 'New';
UPDATE leads SET status = 'Warm' WHERE status = 'Site Visit Scheduled';
UPDATE leads SET status = 'Warm' WHERE status = 'Follow-up-Progress';
UPDATE leads SET status = 'Calling' WHERE status = 'Not Reachable';
UPDATE leads SET status = 'Dead' WHERE status = 'Not Interested';

-- For any leads previously marked Sold or Booked, ensure booked_at is set
UPDATE leads SET booked_at = COALESCE(booked_at, created_at) WHERE status IN ('Sold', 'Booked');
UPDATE leads SET status = 'Warm' WHERE status IN ('Sold', 'Booked');

-- Add a CHECK constraint to enforce the allowed status values
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('Hot', 'Warm', 'Cold', 'Calling', 'Dead', 'Junk'));
