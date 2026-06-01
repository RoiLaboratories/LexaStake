-- Dedicated Supabase migration for adding tx_hash to the existing referrals table.
-- Safe to run without deleting or recreating the referrals table.
--
-- Target column:
-- tx_hash VARCHAR(255) NOT NULL UNIQUE
--
-- This lets the same referrer/referred wallet pair earn rewards on multiple swaps,
-- while still preventing the exact same transaction from being recorded twice.

BEGIN;

-- Add as nullable first so existing rows do not block the migration.
ALTER TABLE public.referrals
ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(255);

-- Existing historical rows may not have a transaction hash. Give each one a
-- stable legacy value so the column can become NOT NULL and UNIQUE.
UPDATE public.referrals
SET tx_hash = 'legacy-' || id::text
WHERE tx_hash IS NULL OR btrim(tx_hash) = '';

-- Ensure future referral records always provide a transaction hash.
ALTER TABLE public.referrals
ALTER COLUMN tx_hash SET NOT NULL;

-- Remove any old unique rule that only allowed one record per wallet pair.
-- Keep transaction-hash uniqueness as the duplicate protection instead.
DO $$
DECLARE
  pair_constraint_name text;
BEGIN
  FOR pair_constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'referrals'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY keys.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS keys(attnum, ord)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = keys.attnum
      ) = ARRAY['referrer_address', 'referred_address']
  LOOP
    EXECUTE format('ALTER TABLE public.referrals DROP CONSTRAINT %I', pair_constraint_name);
  END LOOP;
END $$;

-- Also remove old pair-only unique indexes that were created outside a constraint.
DO $$
DECLARE
  pair_index_name text;
BEGIN
  FOR pair_index_name IN
    SELECT idx.relname
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class idx ON idx.oid = i.indexrelid
    WHERE n.nspname = 'public'
      AND t.relname = 'referrals'
      AND i.indisunique
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conindid = i.indexrelid
      )
      AND (
        SELECT array_agg(a.attname::text ORDER BY keys.ord)
        FROM unnest(i.indkey) WITH ORDINALITY AS keys(attnum, ord)
        JOIN pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = keys.attnum
      ) = ARRAY['referrer_address', 'referred_address']
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', pair_index_name);
  END LOOP;
END $$;

-- Add the unique transaction-hash rule if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'referrals'
      AND i.indisunique
      AND (
        SELECT array_agg(a.attname::text ORDER BY keys.ord)
        FROM unnest(i.indkey) WITH ORDINALITY AS keys(attnum, ord)
        JOIN pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = keys.attnum
      ) = ARRAY['tx_hash']
  ) THEN
    ALTER TABLE public.referrals
    ADD CONSTRAINT referrals_tx_hash_key UNIQUE (tx_hash);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_tx_hash
ON public.referrals(tx_hash);

COMMENT ON COLUMN public.referrals.tx_hash IS
'Unique transaction hash; repeat wallet pairs are allowed with new txs';

COMMIT;
