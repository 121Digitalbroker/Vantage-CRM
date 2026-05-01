-- =============================================================================
-- Meta Leads CRM / Google Sheet export alignment
-- Run in Supabase → SQL Editor after supabase-add-facebook-fields.sql
--
-- Maps typical Meta export columns (Sheet2 style) to `public.leads`:
--   full_name        → name (via your import / Make mapping)
--   phone_number     → phone
--   email            → email
--   platform         → platform (ig, fb, …)
--   id (Graph l:…)   → facebook_lead_id (recommended)
--   created_time     → meta_created_time (+ created_at on insert)
--   lead_status      → meta_lead_status (Meta state e.g. CREATED; not CRM pipeline)
--   Custom questions → meta_field_data (JSON) when keys vary per form
-- =============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS leadgen_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_created_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_lead_status TEXT,
  ADD COLUMN IF NOT EXISTS meta_field_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.leads.platform IS 'Meta export: ig, fb, etc.';
COMMENT ON COLUMN public.leads.leadgen_id IS 'Meta leadgen id when available (distinct from Graph lead id in facebook_lead_id)';
COMMENT ON COLUMN public.leads.meta_created_time IS 'Graph lead created_time from Meta export';
COMMENT ON COLUMN public.leads.meta_lead_status IS 'Meta delivery state e.g. CREATED — not the CRM pipeline status';
COMMENT ON COLUMN public.leads.meta_field_data IS 'Arbitrary Meta form fields (what_is_your_*, etc.) as JSON';

CREATE INDEX IF NOT EXISTS idx_leads_leadgen_id ON public.leads(leadgen_id);
