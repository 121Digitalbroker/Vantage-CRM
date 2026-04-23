-- ============================================================
-- EstatesCRM — Allow anon key to read/update `leads` (dev only)
-- Run in Supabase SQL Editor if you use VITE_USE_DEMO_LEADS=false
-- and updates fail with "permission denied" or RLS errors.
-- ============================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DROP POLICY IF EXISTS "leads_select_anon" ON leads;
DROP POLICY IF EXISTS "leads_insert_anon" ON leads;
DROP POLICY IF EXISTS "leads_update_anon" ON leads;
DROP POLICY IF EXISTS "leads_delete_anon" ON leads;

CREATE POLICY "leads_select_anon" ON leads FOR SELECT TO anon USING (true);
CREATE POLICY "leads_insert_anon" ON leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "leads_update_anon" ON leads FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "leads_delete_anon" ON leads FOR DELETE TO anon USING (true);

-- Optional: authenticated role (if you add Supabase Auth later)
-- CREATE POLICY "leads_all_authenticated" ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
