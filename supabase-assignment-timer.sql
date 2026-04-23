-- Add assignment timer columns to leads table in Supabase

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_status_update TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assignment_expires_at TIMESTAMPTZ;

-- Create an index for faster queries on expired assignments
CREATE INDEX IF NOT EXISTS idx_leads_assignment_expires 
ON public.leads(assignment_expires_at) 
WHERE assignment_expires_at IS NOT NULL;

-- Create an index for checking assignments that need status updates
CREATE INDEX IF NOT EXISTS idx_leads_assigned_pending 
ON public.leads(assigned_to, assigned_at) 
WHERE assigned_to IS NOT NULL AND last_status_update IS NULL;
