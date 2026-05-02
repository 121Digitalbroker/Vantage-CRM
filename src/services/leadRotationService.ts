import { supabase } from '@/lib/supabaseClient';
import { useDemoLeads } from '@/src/services/leadsService';

const STORAGE_ENABLED_KEY = 'crm_lead_rotation_enabled';
const STORAGE_USER_IDS_KEY = 'crm_lead_rotation_user_ids';
const STORAGE_NEXT_INDEX_KEY = 'crm_lead_rotation_next_index';

const ROTATION_ROW_ID = 1;

export interface LeadRotationConfig {
  enabled: boolean;
  selectedUserIds: string[];
}

function parseBoolean(raw: string | null): boolean {
  return raw === 'true' || raw === '1';
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => String(id)).filter(Boolean);
  } catch {
    return [];
  }
}

function readLocalNextIndex(): number {
  const n = Number.parseInt(localStorage.getItem(STORAGE_NEXT_INDEX_KEY) || '0', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function writeLocalNextIndex(index: number): void {
  localStorage.setItem(STORAGE_NEXT_INDEX_KEY, String(index));
}

function readLocalConfig(): LeadRotationConfig {
  return {
    enabled: parseBoolean(localStorage.getItem(STORAGE_ENABLED_KEY)),
    selectedUserIds: parseJsonArray(localStorage.getItem(STORAGE_USER_IDS_KEY)),
  };
}

function writeLocalConfig(config: LeadRotationConfig): void {
  localStorage.setItem(STORAGE_ENABLED_KEY, config.enabled ? 'true' : 'false');
  localStorage.setItem(STORAGE_USER_IDS_KEY, JSON.stringify(config.selectedUserIds));
}

function isMissingRotationTableError(error: { message?: string; code?: string; details?: string }): boolean {
  const code = String(error?.code ?? '');
  const blob = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return (
    code === 'PGRST205'
    || code === '42P01'
    || blob.includes('schema cache')
    || blob.includes('could not find the table')
    || (blob.includes('relation') && blob.includes('does not exist'))
  );
}

function normalizeUserIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((id) => String(id)).filter(Boolean);
  return [];
}

/**
 * Load rotation settings (Supabase when not in demo mode, else this browser's localStorage).
 */
export async function loadLeadRotationConfig(): Promise<LeadRotationConfig> {
  if (useDemoLeads()) return readLocalConfig();

  const { data, error } = await supabase
    .from('crm_lead_rotation_config')
    .select('enabled, selected_user_ids')
    .eq('id', ROTATION_ROW_ID)
    .maybeSingle();

  if (error) {
    if (isMissingRotationTableError(error)) {
      console.warn(
        '[CRM] crm_lead_rotation_config missing; using localStorage for this browser. Run supabase-crm-lead-rotation-config.sql.',
        error.message
      );
      return readLocalConfig();
    }
    throw new Error(error.message);
  }

  if (!data) {
    return { enabled: false, selectedUserIds: [] };
  }

  return {
    enabled: Boolean(data.enabled),
    selectedUserIds: normalizeUserIds(data.selected_user_ids),
  };
}

async function ensureSupabaseRotationRow(): Promise<void> {
  const { data, error } = await supabase
    .from('crm_lead_rotation_config')
    .select('id')
    .eq('id', ROTATION_ROW_ID)
    .maybeSingle();

  if (error && !isMissingRotationTableError(error)) throw new Error(error.message);
  if (error && isMissingRotationTableError(error)) throw error;
  if (data) return;

  const { error: insertError } = await supabase.from('crm_lead_rotation_config').insert({
    id: ROTATION_ROW_ID,
    enabled: false,
    selected_user_ids: [],
    next_index: 0,
  });
  if (insertError && !String(insertError.message).includes('duplicate')) {
    throw new Error(insertError.message);
  }
}

/**
 * Persist enabled + assignment order. Does not reset round-robin `next_index` (same as before).
 */
export async function persistLeadRotationConfig(config: LeadRotationConfig): Promise<void> {
  if (useDemoLeads()) {
    writeLocalConfig(config);
    return;
  }

  try {
    await ensureSupabaseRotationRow();
    const { error } = await supabase
      .from('crm_lead_rotation_config')
      .update({
        enabled: config.enabled,
        selected_user_ids: config.selectedUserIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ROTATION_ROW_ID);
    if (error) throw error;
  } catch (e) {
    if (e && typeof e === 'object' && 'message' in e && isMissingRotationTableError(e as { message?: string; code?: string })) {
      console.warn('[CRM] Saving rotation to localStorage (Supabase table missing).');
      writeLocalConfig(config);
      return;
    }
    throw e;
  }
}

/**
 * Current round-robin pointer (who is next), without advancing it.
 */
export async function peekLeadRotationNextIndex(): Promise<number> {
  if (useDemoLeads()) return readLocalNextIndex();

  const { data, error } = await supabase
    .from('crm_lead_rotation_config')
    .select('next_index')
    .eq('id', ROTATION_ROW_ID)
    .maybeSingle();

  if (error) {
    if (isMissingRotationTableError(error)) return readLocalNextIndex();
    throw new Error(error.message);
  }
  if (!data) return 0;
  const n = Number(data.next_index);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Returns the next assignee id and advances the shared round-robin index (Supabase or localStorage).
 */
export async function takeNextRoundRobinAssigneeId(): Promise<string> {
  if (useDemoLeads()) {
    const cfg = readLocalConfig();
    if (!cfg.enabled) return '';
    const userIds = cfg.selectedUserIds;
    if (userIds.length === 0) return '';

    const currentIndex = readLocalNextIndex() % userIds.length;
    const selectedId = userIds[currentIndex];
    writeLocalNextIndex((currentIndex + 1) % userIds.length);
    return selectedId;
  }

  try {
    await ensureSupabaseRotationRow();
    const { data, error } = await supabase
      .from('crm_lead_rotation_config')
      .select('enabled, selected_user_ids, next_index')
      .eq('id', ROTATION_ROW_ID)
      .single();

    if (error) throw error;

    if (!data.enabled) return '';
    const userIds = normalizeUserIds(data.selected_user_ids);
    if (userIds.length === 0) return '';

    let currentIndex = Number(data.next_index);
    if (!Number.isFinite(currentIndex) || currentIndex < 0) currentIndex = 0;
    currentIndex = currentIndex % userIds.length;
    const selectedId = userIds[currentIndex];
    const newIndex = (currentIndex + 1) % userIds.length;

    const { error: upErr } = await supabase
      .from('crm_lead_rotation_config')
      .update({
        next_index: newIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ROTATION_ROW_ID);
    if (upErr) throw upErr;

    return selectedId;
  } catch (e) {
    if (e && typeof e === 'object' && 'message' in e && isMissingRotationTableError(e as { message?: string; code?: string })) {
      console.warn('[CRM] takeNextRoundRobinAssigneeId falling back to localStorage.');
      const cfg = readLocalConfig();
      if (!cfg.enabled) return '';
      const userIds = cfg.selectedUserIds;
      if (userIds.length === 0) return '';
      const currentIndex = readLocalNextIndex() % userIds.length;
      const selectedId = userIds[currentIndex];
      writeLocalNextIndex((currentIndex + 1) % userIds.length);
      return selectedId;
    }
    throw e;
  }
}
