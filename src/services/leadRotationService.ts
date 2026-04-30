const STORAGE_ENABLED_KEY = 'crm_lead_rotation_enabled';
const STORAGE_USER_IDS_KEY = 'crm_lead_rotation_user_ids';
const STORAGE_NEXT_INDEX_KEY = 'crm_lead_rotation_next_index';

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

function readNextIndex(): number {
  const n = Number.parseInt(localStorage.getItem(STORAGE_NEXT_INDEX_KEY) || '0', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function writeNextIndex(index: number): void {
  localStorage.setItem(STORAGE_NEXT_INDEX_KEY, String(index));
}

export function getLeadRotationConfig(): LeadRotationConfig {
  return {
    enabled: parseBoolean(localStorage.getItem(STORAGE_ENABLED_KEY)),
    selectedUserIds: parseJsonArray(localStorage.getItem(STORAGE_USER_IDS_KEY)),
  };
}

export function saveLeadRotationConfig(config: LeadRotationConfig): void {
  localStorage.setItem(STORAGE_ENABLED_KEY, config.enabled ? 'true' : 'false');
  localStorage.setItem(STORAGE_USER_IDS_KEY, JSON.stringify(config.selectedUserIds));
  // Do NOT reset index — keep the queue position where it was so rotation continues correctly
}

export function getLeadRotationNextIndex(): number {
  return readNextIndex();
}

/**
 * Returns the next user ID in the round-robin order.
 * Reads purely from localStorage — no network call, no Supabase, always reliable.
 */
export function getNextRoundRobinAssigneeId(): string {
  const config = getLeadRotationConfig();
  if (!config.enabled) return '';
  const userIds = config.selectedUserIds;
  if (userIds.length === 0) return '';

  const currentIndex = readNextIndex() % userIds.length;
  const selectedId = userIds[currentIndex];
  writeNextIndex((currentIndex + 1) % userIds.length);
  return selectedId;
}
