import { supabase } from '@/lib/supabaseClient';
import type { AppUser } from '@/src/contexts/RoleContext';

function makeInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function normalizeRole(role: string): AppUser['role'] {
  if (role === 'Manager' || role === 'General Manager') return 'Manager';
  if (role === 'Manager1') return 'Manager1';
  if (role === 'Digital Marketer') return 'Digital Marketer';
  if (role === 'Telecaller') return 'Telecaller';
  return 'Admin';
}

/** Parse `manager_id`: JSON array `["a","b"]` or legacy single id string. */
export function parseManagerIdsFromDb(raw: unknown): string[] {
  if (raw == null || raw === '') return [];
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return [...new Set(arr.map(String).filter(Boolean))];
    } catch {
      return [];
    }
  }
  return [s];
}

export function serializeManagerIdsToDb(ids: string[]): string | null {
  const u = [...new Set(ids.map(id => String(id).trim()).filter(Boolean))];
  if (u.length === 0) return null;
  return JSON.stringify(u);
}

function mapToAppUser(row: any): AppUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: normalizeRole(row.role),
    position: row.position ?? undefined,
    status: row.status,
    phone: row.phone,
    managerIds: parseManagerIdsFromDb(row.manager_id),
    reportsToGmId: row.reports_to_gm_id ? String(row.reports_to_gm_id) : undefined,
    initials: row.initials,
    createdAt: row.created_at,
    lastLogin: row.last_login,
  };
}

export async function fetchUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch users from Supabase:', error);
    return [];
  }

  return (data || []).map(mapToAppUser);
}

export async function fetchUserByEmail(email: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !data) return null;
  return mapToAppUser(data);
}

export async function createUser(user: Omit<AppUser, 'id' | 'createdAt'>): Promise<AppUser | null> {
  const newUser = {
    id: `u${Date.now()}`,
    name: user.name.trim(),
    email: user.email.trim().toLowerCase(),
    password: user.password,
    role: normalizeRole(user.role),
    position: user.position ?? null,
    status: user.status,
    phone: user.phone,
    manager_id: serializeManagerIdsToDb(user.managerIds ?? []),
    reports_to_gm_id: user.reportsToGmId?.trim() || null,
    initials: user.initials || makeInitials(user.name),
    created_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from('users')
    .insert(newUser)
    .select()
    .single();

  // Backward compatibility: older DBs may not have the `position` / `manager_id` columns yet.
  if (error && /(position|manager_id|reports_to_gm_id)/i.test(error.message || '')) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { position, manager_id, reports_to_gm_id, ...fallbackUser } = newUser;
    const fallback = await supabase
      .from('users')
      .insert(fallbackUser)
      .select()
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    console.error('Failed to create user:', error);
    return null;
  }
  return mapToAppUser(data);
}

export async function updateUserStatus(userId: string, status: 'Active' | 'Inactive'): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', userId);

  return !error;
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ password: newPassword })
    .eq('id', userId);

  return !error;
}

export async function updateUser(
  userId: string,
  updates: {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    position?: string;
    managerIds?: string[];
    reportsToGmId?: string | null;
  }
): Promise<boolean> {
  const payload: Record<string, any> = {};
  if (updates.name)  payload.name     = updates.name.trim();
  if (updates.email) payload.email    = updates.email.trim().toLowerCase();
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.role)  payload.role     = normalizeRole(updates.role);
  if (updates.position !== undefined) payload.position = updates.position.trim();
  if (updates.managerIds !== undefined) payload.manager_id = serializeManagerIdsToDb(updates.managerIds);
  if (updates.reportsToGmId !== undefined) {
    payload.reports_to_gm_id = updates.reportsToGmId?.trim() || null;
  }
  if (updates.name)  payload.initials = updates.name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  let { error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId);

  if (error && /(position|manager_id|reports_to_gm_id)/i.test(error.message || '')) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { position, manager_id, reports_to_gm_id, ...fallbackPayload } = payload;
    const fallback = await supabase
      .from('users')
      .update(fallbackPayload)
      .eq('id', userId);
    error = fallback.error;
  }

  if (error) {
    console.error('Failed to update user:', error);
    return false;
  }
  return true;
}

export async function deleteUser(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) {
    console.error('Failed to delete user:', error);
    return false;
  }
  return true;
}
