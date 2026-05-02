-- ============================================================
-- EstatesCRM — Lead rotation **per project** (shared across devices)
-- Run in Supabase SQL Editor. Replaces singleton pattern: one row per
-- `project_key` (matches `leads.project` after trim; empty → __default__).
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_lead_rotation_by_project (
  project_key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  selected_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_index INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_lead_rotation_by_project_updated_at_idx
  ON crm_lead_rotation_by_project (updated_at DESC);

ALTER TABLE crm_lead_rotation_by_project ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_lead_rotation_by_project_select_anon" ON crm_lead_rotation_by_project;
DROP POLICY IF EXISTS "crm_lead_rotation_by_project_insert_anon" ON crm_lead_rotation_by_project;
DROP POLICY IF EXISTS "crm_lead_rotation_by_project_update_anon" ON crm_lead_rotation_by_project;
DROP POLICY IF EXISTS "crm_lead_rotation_by_project_delete_anon" ON crm_lead_rotation_by_project;

CREATE POLICY "crm_lead_rotation_by_project_select_anon"
  ON crm_lead_rotation_by_project FOR SELECT TO anon USING (true);
CREATE POLICY "crm_lead_rotation_by_project_insert_anon"
  ON crm_lead_rotation_by_project FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "crm_lead_rotation_by_project_update_anon"
  ON crm_lead_rotation_by_project FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "crm_lead_rotation_by_project_delete_anon"
  ON crm_lead_rotation_by_project FOR DELETE TO anon USING (true);

-- One-time: copy legacy global row into Default bucket (if old table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crm_lead_rotation_config'
  ) THEN
    INSERT INTO crm_lead_rotation_by_project (project_key, enabled, selected_user_ids, next_index)
    SELECT '__default__'::text, c.enabled, c.selected_user_ids, c.next_index
    FROM crm_lead_rotation_config c
    WHERE c.id = 1
    ON CONFLICT (project_key) DO NOTHING;
  END IF;
END $$;
