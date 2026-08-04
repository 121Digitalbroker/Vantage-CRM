-- ============================================================
-- EstatesCRM — Shared app settings (visible to every user)
-- Run in Supabase SQL Editor once.
-- Fixes: Admin applies a date range on Campaign Sources but other users
-- still see all leads, because the range lived in the Admin's localStorage.
-- Currently holds id = 'global_date_range' -> {"from":"2026-04-01","to":"2026-04-30"}
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_app_settings (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_app_settings_select_anon" ON crm_app_settings;
DROP POLICY IF EXISTS "crm_app_settings_insert_anon" ON crm_app_settings;
DROP POLICY IF EXISTS "crm_app_settings_update_anon" ON crm_app_settings;
DROP POLICY IF EXISTS "crm_app_settings_delete_anon" ON crm_app_settings;

CREATE POLICY "crm_app_settings_select_anon"
  ON crm_app_settings FOR SELECT TO anon USING (true);
CREATE POLICY "crm_app_settings_insert_anon"
  ON crm_app_settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "crm_app_settings_update_anon"
  ON crm_app_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "crm_app_settings_delete_anon"
  ON crm_app_settings FOR DELETE TO anon USING (true);

-- Push changes to every open browser instantly.
ALTER PUBLICATION supabase_realtime ADD TABLE crm_app_settings;

INSERT INTO crm_app_settings (id, value)
VALUES ('global_date_range', '{"from":"","to":""}'::jsonb)
ON CONFLICT (id) DO NOTHING;
