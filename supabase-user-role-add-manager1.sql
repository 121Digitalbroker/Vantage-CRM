-- Deprecated as a standalone requirement: `supabase-users-table.sql` now includes
-- Manager1 + Digital Marketer on the enum and section 1b adds them to existing DBs.
-- Keep this file only if you prefer a tiny one-off migration; it is idempotent.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'Manager1'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'Manager1';
    END IF;
  END IF;
END$$;
