-- =============================================================================
-- EstatesCRM — Align Supabase `public.leads` with the Vite app (leadsService.ts)
-- Run in: Supabase → SQL Editor → New query → Run
-- =============================================================================
--
-- YOUR CURRENT TABLE (from screenshot) has:
--   id, created_at, name, phone, email, source, status, assigned_to (uuid), project, notes
--
-- PROBLEM: The CRM assigns telecallers using TEXT ids like "u1", "u2" (RoleContext).
--          PostgreSQL UUID columns cannot store "u1" — assignment updates will fail.
--
-- FIX: Change `assigned_to` to TEXT (nullable). Optionally add FK later to a profiles table.
-- If assigned_to has a foreign key to auth.users, drop it first, e.g.:
--   ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;
--
-- =============================================================================

-- 1) assigned_to: UUID → TEXT (keeps existing UUIDs as text strings if any)
ALTER TABLE public.leads
  ALTER COLUMN assigned_to DROP NOT NULL;

ALTER TABLE public.leads
  ALTER COLUMN assigned_to TYPE text
  USING (CASE WHEN assigned_to IS NULL THEN NULL ELSE assigned_to::text END);

COMMENT ON COLUMN public.leads.assigned_to IS 'Telecaller id from app (e.g. u1,u2) or future auth user uuid as text';

-- 2) Columns the CRM reads/writes (add only if missing)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_level text DEFAULT 'Cold';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS follow_up_date timestamptz DEFAULT now();
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS campaign_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS adset_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ad_name text;

-- 3) Optional: widen status values to match CRM (text is fine)
--    App statuses: New, Contacted, Interested, Site Visit Scheduled, Visit Completed,
--    Negotiation, Booked, Not Interested, Wrong Number, Low Budget

-- 4) Sample row (replace or delete your test row first if needed)
UPDATE public.leads
SET
  name = 'Demo Lead',
  phone = '+91 98765-00001',
  email = 'demo@example.com',
  source = 'Website',
  status = 'New',
  project = 'Sunset Villas',
  assigned_to = 'u1',
  lead_level = 'Hot',
  follow_up_date = now() + interval '1 day',
  notes = 'Seeded from CRM migration'
WHERE id IN (SELECT id FROM public.leads LIMIT 1);

-- If table was empty, insert instead:
INSERT INTO public.leads (
  name, phone, email, source, status, project, notes,
  assigned_to, lead_level, follow_up_date
)
SELECT
  'Alice Johnson', '+91 98765-43210', 'alice@example.com', 'Meta Ads', 'Negotiation', 'Sunset Villas', '',
  'u1', 'Hot', now() + interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.leads LIMIT 1);

-- 5) RLS — allow anon key from the browser to read/update (dev only; tighten for production)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select_anon" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_anon" ON public.leads;
DROP POLICY IF EXISTS "leads_update_anon" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_anon" ON public.leads;

CREATE POLICY "leads_select_anon" ON public.leads FOR SELECT TO anon USING (true);
CREATE POLICY "leads_insert_anon" ON public.leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "leads_update_anon" ON public.leads FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "leads_delete_anon" ON public.leads FOR DELETE TO anon USING (true);

-- =============================================================================
-- AFTER RUNNING:
-- 1. In project `.env` set:  VITE_USE_DEMO_LEADS=false
-- 2. Restart: npm run dev
-- 3. Log in as Admin → Leads should load from Supabase; assignment writes assigned_to
-- =============================================================================
