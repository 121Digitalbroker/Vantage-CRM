-- ============================================================
-- EstatesCRM — Assignment history (server-side, matches UI)
-- Run in Supabase SQL Editor when using VITE_USE_DEMO_LEADS=false
-- so Lead Details "Assignment History" matches `leads.assigned_to`.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  from_user_id TEXT NOT NULL DEFAULT '',
  to_user_id TEXT NOT NULL DEFAULT '',
  assigned_by TEXT NOT NULL DEFAULT '',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_assignment_history_lead_id_created_at_idx
  ON lead_assignment_history (lead_id, created_at DESC);

ALTER TABLE lead_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_assignment_history_select_anon" ON lead_assignment_history;
DROP POLICY IF EXISTS "lead_assignment_history_insert_anon" ON lead_assignment_history;
DROP POLICY IF EXISTS "lead_assignment_history_update_anon" ON lead_assignment_history;
DROP POLICY IF EXISTS "lead_assignment_history_delete_anon" ON lead_assignment_history;

CREATE POLICY "lead_assignment_history_select_anon"
  ON lead_assignment_history FOR SELECT TO anon USING (true);
CREATE POLICY "lead_assignment_history_insert_anon"
  ON lead_assignment_history FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "lead_assignment_history_update_anon"
  ON lead_assignment_history FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lead_assignment_history_delete_anon"
  ON lead_assignment_history FOR DELETE TO anon USING (true);
