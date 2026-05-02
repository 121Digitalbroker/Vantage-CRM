-- ============================================================
-- EstatesCRM — Lead rotation config (shared across devices)
-- Run in Supabase SQL Editor when using VITE_USE_DEMO_LEADS=false
-- so Lead Rotation settings sync for all admins/browsers.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_lead_rotation_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  selected_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_index INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO crm_lead_rotation_config (id, enabled, selected_user_ids, next_index)
VALUES (1, false, '[]'::jsonb, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE crm_lead_rotation_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_lead_rotation_config_select_anon" ON crm_lead_rotation_config;
DROP POLICY IF EXISTS "crm_lead_rotation_config_insert_anon" ON crm_lead_rotation_config;
DROP POLICY IF EXISTS "crm_lead_rotation_config_update_anon" ON crm_lead_rotation_config;
DROP POLICY IF EXISTS "crm_lead_rotation_config_delete_anon" ON crm_lead_rotation_config;

CREATE POLICY "crm_lead_rotation_config_select_anon"
  ON crm_lead_rotation_config FOR SELECT TO anon USING (true);
CREATE POLICY "crm_lead_rotation_config_insert_anon"
  ON crm_lead_rotation_config FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "crm_lead_rotation_config_update_anon"
  ON crm_lead_rotation_config FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "crm_lead_rotation_config_delete_anon"
  ON crm_lead_rotation_config FOR DELETE TO anon USING (true);
