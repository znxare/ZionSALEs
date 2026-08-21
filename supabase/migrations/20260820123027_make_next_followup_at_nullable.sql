/*
# Allow null next_followup_at on leads

## Reason
When a lead is marked Dead or Junk, follow-ups are no longer required and the app sets `next_followup_at = null`. The column currently has a NOT NULL constraint, so every such update fails with `23502 null value in column "next_followup_at" violates not-null constraint`, which breaks editing leads in the UI.

## Changes
1. Alters `leads.next_followup_at` to drop the NOT NULL constraint so it accepts null values (for Dead/Junk/Booked leads where no follow-up is needed).
*/

ALTER TABLE leads ALTER COLUMN next_followup_at DROP NOT NULL;
