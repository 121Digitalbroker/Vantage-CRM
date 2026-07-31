-- ============================================================
-- EstatesCRM — Campaign Previous groups (shared across all users)
-- Run in Supabase SQL Editor once.
-- Fixes: Admin creates Previous groups but employees see "No groups yet"
-- because groups were only in the Admin's browser localStorage.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_campaign_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_campaign_groups_updated_at_idx
  ON crm_campaign_groups (updated_at DESC);

ALTER TABLE crm_campaign_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_campaign_groups_select_anon" ON crm_campaign_groups;
DROP POLICY IF EXISTS "crm_campaign_groups_insert_anon" ON crm_campaign_groups;
DROP POLICY IF EXISTS "crm_campaign_groups_update_anon" ON crm_campaign_groups;
DROP POLICY IF EXISTS "crm_campaign_groups_delete_anon" ON crm_campaign_groups;

CREATE POLICY "crm_campaign_groups_select_anon"
  ON crm_campaign_groups FOR SELECT TO anon USING (true);
CREATE POLICY "crm_campaign_groups_insert_anon"
  ON crm_campaign_groups FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "crm_campaign_groups_update_anon"
  ON crm_campaign_groups FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "crm_campaign_groups_delete_anon"
  ON crm_campaign_groups FOR DELETE TO anon USING (true);
