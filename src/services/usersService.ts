import { supabase } from '@/lib/supabaseClient';
import type { AppUser } from '@/src/contexts/RoleContext';

function makeInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function normalizeRole(role: string): AppUser['role'] {
  if (role === 'Manager' || role === 'General Manager') return 'Manager';
  if (role === 'Digital Marketer') return 'Digital Marketer';
  if (role === 'Telecaller') return 'Telecaller';
  return 'Admin';
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
    managerId: row.manager_id ?? undefined,
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
    manager_id: user.managerId ?? null,
    initials: user.initials || makeInitials(user.name),
    created_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from('users')
    .insert(newUser)
    .select()
    .single();

  // Backward compatibility: older DBs may not have the `position` / `manager_id` columns yet.
  if (error && /(position|manager_id)/i.test(error.message || '')) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { position, manager_id, ...fallbackUser } = newUser;
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
  updates: { name?: string; email?: string; phone?: string; role?: string; position?: string; managerId?: string }
): Promise<boolean> {
  const payload: Record<string, any> = {};
  if (updates.name)  payload.name     = updates.name.trim();
  if (updates.email) payload.email    = updates.email.trim().toLowerCase();
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.role)  payload.role     = normalizeRole(updates.role);
  if (updates.position !== undefined) payload.position = updates.position.trim();
  if (updates.managerId !== undefined) payload.manager_id = updates.managerId || null;
  if (updates.name)  payload.initials = updates.name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  let { error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId);

  if (error && /(position|manager_id)/i.test(error.message || '')) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { position, manager_id, ...fallbackPayload } = payload;
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
