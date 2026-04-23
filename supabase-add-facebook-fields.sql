-- Add new columns for Facebook Leads and better tracking

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS campaign_id TEXT,
ADD COLUMN IF NOT EXISTS adset_id TEXT,
ADD COLUMN IF NOT EXISTS ad_id TEXT,
ADD COLUMN IF NOT EXISTS form_name TEXT,
ADD COLUMN IF NOT EXISTS form_id TEXT,
ADD COLUMN IF NOT EXISTS is_organic BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS investment_budget TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS best_time_to_contact TEXT,
ADD COLUMN IF NOT EXISTS planning_to_buy TEXT,
ADD COLUMN IF NOT EXISTS facebook_lead_id TEXT;

-- Create an index on the facebook_lead_id so we can quickly check for duplicates
CREATE INDEX IF NOT EXISTS idx_leads_facebook_lead_id ON public.leads(facebook_lead_id);
