-- ============================================================
-- EstatesCRM — One-shot: assignment + status history tables
-- Paste into Supabase → SQL → New query → Run (fixes REST 404
-- on lead_assignment_history / lead_status_history).
--
-- Supabase may show "Potential issue / destructive operations"
-- because of DROP POLICY below. That is expected: it only removes
-- old policy definitions so they can be recreated. This file does
-- NOT use DROP TABLE — your history rows are not wiped by DROP POLICY.
--
-- If you pasted a script that contains DROP TABLE ... — Cancel and
-- use this file only, or you will delete all data in those tables.
-- ============================================================

-- Assignment history
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

-- Status history
CREATE TABLE IF NOT EXISTS lead_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_status_history_lead_id_created_at_idx
  ON lead_status_history (lead_id, created_at DESC);

ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_status_history_select_anon" ON lead_status_history;
DROP POLICY IF EXISTS "lead_status_history_insert_anon" ON lead_status_history;
DROP POLICY IF EXISTS "lead_status_history_update_anon" ON lead_status_history;
DROP POLICY IF EXISTS "lead_status_history_delete_anon" ON lead_status_history;

CREATE POLICY "lead_status_history_select_anon"
  ON lead_status_history FOR SELECT TO anon USING (true);
CREATE POLICY "lead_status_history_insert_anon"
  ON lead_status_history FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "lead_status_history_update_anon"
  ON lead_status_history FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lead_status_history_delete_anon"
  ON lead_status_history FOR DELETE TO anon USING (true);
