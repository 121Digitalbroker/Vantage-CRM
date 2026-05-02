-- ============================================================
-- EstatesCRM — Status change history (server-side)
-- Run in Supabase SQL Editor when using VITE_USE_DEMO_LEADS=false
-- so Lead Details "Status History" is populated from the database.
-- ============================================================

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
