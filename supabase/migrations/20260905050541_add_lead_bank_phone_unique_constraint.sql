/*
# Enforce Unique Phone Numbers in Lead Bank

## Purpose
The Lead Import wizard and Lead Bank paste-import screen both check for
duplicate phone numbers before inserting, but that check is a client-side,
point-in-time snapshot only — nothing at the database level actually
prevents two identical (or differently-formatted-but-same) phone numbers
from being inserted. This let an exact duplicate ("Srinivasa MV") through
via two Meta Lead Ads imports run a day apart.

## Approach
Add a `normalize_phone` SQL function that mirrors `normalizePhone()` in
`src/lib/normalize.ts` exactly (same country-code/leading-zero handling),
then create a UNIQUE index on `lead_bank(normalize_phone(phone))`. A
partial index (excluding empty normalized results) so unparseable/blank
phone values don't collide with each other.

This makes duplicate phone numbers a hard database error, not just a UI
suggestion — any future insert path (a different import tool, a script,
a bug in the app) will be rejected outright by Postgres.

## Notes
- Existing data was already deduplicated for this specific case before
  this migration was written. If other duplicates exist, this migration
  will fail to apply — run the SELECT below first to check:

    SELECT normalize_phone(phone), array_agg(id), count(*)
    FROM lead_bank GROUP BY 1 HAVING count(*) > 1;

- Keeps `leads` (the main CRM table) unconstrained for now, since
  historical/legacy data there may have looser phone formats. This
  migration only targets `lead_bank`, the raw-import staging table where
  this specific incident happened.
*/

CREATE OR REPLACE FUNCTION normalize_phone(input text) RETURNS text AS $$
DECLARE
  digits text;
BEGIN
  digits := regexp_replace(coalesce(input, ''), '\D', '', 'g');

  IF left(digits, 2) = '91' AND length(digits) = 12 THEN
    digits := substring(digits from 3);
  END IF;

  IF left(digits, 1) = '0' AND length(digits) = 11 THEN
    digits := substring(digits from 2);
  END IF;

  IF length(digits) > 10 AND length(digits) <= 13 THEN
    digits := right(digits, 10);
  END IF;

  RETURN digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE UNIQUE INDEX IF NOT EXISTS lead_bank_normalized_phone_unique
  ON lead_bank (normalize_phone(phone))
  WHERE normalize_phone(phone) <> '';
