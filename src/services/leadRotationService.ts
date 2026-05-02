import { supabase } from '@/lib/supabaseClient';
import { useDemoLeads } from '@/src/services/leadsService';

/** localStorage map for demo mode */
const LS_BY_PROJECT_KEY = 'crm_lead_rotation_by_project';

const TABLE = 'crm_lead_rotation_by_project';

export interface LeadRotationConfig {
  enabled: boolean;
  selectedUserIds: string[];
}

/** Stable key for `leads.project` (trimmed). Empty / missing → shared default queue. */
export function normalizeProjectKey(project: string | undefined | null): string {
  const t = String(project ?? '').trim();
  return t.length > 0 ? t : '__default__';
}

interface StoredProjectRow {
  enabled: boolean;
  selectedUserIds: string[];
  nextIndex: number;
}

type LocalProjectMap = Record<string, StoredProjectRow>;

function readLocalMap(): LocalProjectMap {
  try {
    const raw = localStorage.getItem(LS_BY_PROJECT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as LocalProjectMap;
  } catch {
    return {};
  }
}

function writeLocalMap(map: LocalProjectMap): void {
  localStorage.setItem(LS_BY_PROJECT_KEY, JSON.stringify(map));
}

function readLocalRow(projectKey: string): StoredProjectRow {
  const map = readLocalMap();
  const row = map[projectKey];
  return {
    enabled: row?.enabled ?? false,
    selectedUserIds: Array.isArray(row?.selectedUserIds)
      ? row!.selectedUserIds.map(String).filter(Boolean)
      : [],
    nextIndex: Number.isFinite(row?.nextIndex) && (row!.nextIndex as number) >= 0 ? (row!.nextIndex as number) : 0,
  };
}

function writeLocalRow(projectKey: string, patch: Partial<StoredProjectRow>): void {
  const map = readLocalMap();
  const prev = readLocalRow(projectKey);
  map[projectKey] = {
    enabled: patch.enabled ?? prev.enabled,
    selectedUserIds: patch.selectedUserIds ?? prev.selectedUserIds,
    nextIndex: patch.nextIndex ?? prev.nextIndex,
  };
  writeLocalMap(map);
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
 * Load rotation for one project (`project_key` matches `normalizeProjectKey(lead.project)`).
 */
export async function loadLeadRotationConfig(projectKey: string): Promise<LeadRotationConfig> {
  const key = normalizeProjectKey(projectKey);
  if (useDemoLeads()) {
    const row = readLocalRow(key);
    return { enabled: row.enabled, selectedUserIds: row.selectedUserIds };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('enabled, selected_user_ids')
    .eq('project_key', key)
    .maybeSingle();

  if (error) {
    if (isMissingRotationTableError(error)) {
      console.warn(
        '[CRM] crm_lead_rotation_by_project missing; using localStorage. Run supabase-crm-lead-rotation-config.sql.',
        error.message
      );
      const row = readLocalRow(key);
      return { enabled: row.enabled, selectedUserIds: row.selectedUserIds };
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

async function ensureSupabaseProjectRow(projectKey: string): Promise<void> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('project_key')
    .eq('project_key', projectKey)
    .maybeSingle();

  if (error && !isMissingRotationTableError(error)) throw new Error(error.message);
  if (error && isMissingRotationTableError(error)) throw error;
  if (data) return;

  const { error: insertError } = await supabase.from(TABLE).insert({
    project_key: projectKey,
    enabled: false,
    selected_user_ids: [],
    next_index: 0,
  });
  if (insertError && !String(insertError.message).toLowerCase().includes('duplicate')) {
    throw new Error(insertError.message);
  }
}

/**
 * Save enabled + user order for this project only. Does not reset `next_index`.
 */
export async function persistLeadRotationConfig(
  projectKey: string,
  config: LeadRotationConfig
): Promise<void> {
  const key = normalizeProjectKey(projectKey);
  if (useDemoLeads()) {
    writeLocalRow(key, { enabled: config.enabled, selectedUserIds: config.selectedUserIds });
    return;
  }

  try {
    await ensureSupabaseProjectRow(key);
    const { error } = await supabase
      .from(TABLE)
      .update({
        enabled: config.enabled,
        selected_user_ids: config.selectedUserIds,
        updated_at: new Date().toISOString(),
      })
      .eq('project_key', key);
    if (error) throw error;
  } catch (e) {
    if (e && typeof e === 'object' && 'message' in e && isMissingRotationTableError(e as { message?: string; code?: string })) {
      console.warn('[CRM] Saving rotation to localStorage (Supabase table missing).');
      writeLocalRow(key, { enabled: config.enabled, selectedUserIds: config.selectedUserIds });
      return;
    }
    throw e;
  }
}

/** Round-robin pointer for this project (no advance). */
export async function peekLeadRotationNextIndex(projectKey: string): Promise<number> {
  const key = normalizeProjectKey(projectKey);
  if (useDemoLeads()) return readLocalRow(key).nextIndex;

  const { data, error } = await supabase
    .from(TABLE)
    .select('next_index')
    .eq('project_key', key)
    .maybeSingle();

  if (error) {
    if (isMissingRotationTableError(error)) return readLocalRow(key).nextIndex;
    throw new Error(error.message);
  }
  if (!data) return 0;
  const n = Number(data.next_index);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Next assignee for this project’s queue; advances that project’s `next_index` only.
 */
export async function takeNextRoundRobinAssigneeId(projectKey: string): Promise<string> {
  const key = normalizeProjectKey(projectKey);

  if (useDemoLeads()) {
    const row = readLocalRow(key);
    if (!row.enabled) return '';
    const userIds = row.selectedUserIds;
    if (userIds.length === 0) return '';

    const currentIndex = row.nextIndex % userIds.length;
    const selectedId = userIds[currentIndex];
    writeLocalRow(key, { nextIndex: (currentIndex + 1) % userIds.length });
    return selectedId;
  }

  try {
    await ensureSupabaseProjectRow(key);
    const { data, error } = await supabase
      .from(TABLE)
      .select('enabled, selected_user_ids, next_index')
      .eq('project_key', key)
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
      .from(TABLE)
      .update({
        next_index: newIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('project_key', key);
    if (upErr) throw upErr;

    return selectedId;
  } catch (e) {
    if (e && typeof e === 'object' && 'message' in e && isMissingRotationTableError(e as { message?: string; code?: string })) {
      console.warn('[CRM] takeNextRoundRobinAssigneeId falling back to localStorage.');
      const row = readLocalRow(key);
      if (!row.enabled) return '';
      const userIds = row.selectedUserIds;
      if (userIds.length === 0) return '';
      const currentIndex = row.nextIndex % userIds.length;
      const selectedId = userIds[currentIndex];
      writeLocalRow(key, { nextIndex: (currentIndex + 1) % userIds.length });
      return selectedId;
    }
    throw e;
  }
}
