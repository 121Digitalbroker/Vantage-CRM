import { supabase } from '@/lib/supabaseClient';
import type { AppUser } from '@/src/contexts/RoleContext';

const USE_DEMO = import.meta.env.VITE_USE_DEMO_USERS !== 'false';

// Local storage keys (fallback/demo mode)
const STORAGE_USERS_KEY = 'crm_users';

// Seed users (matches the SQL seed data)
const SEED_USERS: AppUser[] = [
  {
    id: 'admin-1', name: 'Admin User', email: 'admin@estatescrm.com',
    password: 'admin123', role: 'Admin', initials: 'AU',
    status: 'Active', createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u1', name: 'Rahul Sharma', email: 'rahul@estatescrm.com',
    password: 'telecaller123', role: 'Telecaller', initials: 'RS',
    status: 'Active', phone: '+91 98765-11111', createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'u2', name: 'Priya Mehta', email: 'priya@estatescrm.com',
    password: 'telecaller123', role: 'Telecaller', initials: 'PM',
    status: 'Active', phone: '+91 98765-22222', createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'u3', name: 'Arjun Patel', email: 'arjun@estatescrm.com',
    password: 'telecaller123', role: 'Telecaller', initials: 'AP',
    status: 'Active', phone: '+91 98765-33333', createdAt: '2026-01-06T00:00:00Z',
  },
  {
    id: 'u4', name: 'Sneha Gupta', email: 'sneha@estatescrm.com',
    password: 'telecaller123', role: 'Telecaller', initials: 'SG',
    status: 'Active', phone: '+91 98765-44444', createdAt: '2026-01-06T00:00:00Z',
  },
];

// Helper to map DB row to AppUser
function mapToAppUser(row: any): AppUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    status: row.status,
    phone: row.phone,
    initials: row.initials,
    createdAt: row.created_at,
    lastLogin: row.last_login,
  };
}

// Demo mode: load from localStorage
function loadDemoUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      const saved: AppUser[] = JSON.parse(raw);
      const merged = [...SEED_USERS];
      saved.forEach(u => { if (!merged.find(m => m.id === u.id)) merged.push(u); });
      return merged;
    }
  } catch { /* ignore */ }
  return [...SEED_USERS];
}

export async function fetchUsers(): Promise<AppUser[]> {
  if (USE_DEMO) {
    return loadDemoUsers();
  }

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
  if (USE_DEMO) {
    return loadDemoUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
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
    role: user.role,
    status: user.status,
    phone: user.phone,
    initials: user.initials || makeInitials(user.name),
    created_at: new Date().toISOString(),
  };

  if (USE_DEMO) {
    const users = loadDemoUsers();
    if (users.find(u => u.email.toLowerCase() === newUser.email)) return null;
    const appUser = mapToAppUser(newUser);
    users.push(appUser);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    return appUser;
  }

  const { data, error } = await supabase
    .from('users')
    .insert(newUser)
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to create user:', error);
    return null;
  }
  return mapToAppUser(data);
}

export async function updateUserStatus(userId: string, status: 'Active' | 'Inactive'): Promise<boolean> {
  if (USE_DEMO) {
    const users = loadDemoUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return false;
    users[idx].status = status;
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    return true;
  }

  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', userId);

  return !error;
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<boolean> {
  if (USE_DEMO) {
    const users = loadDemoUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return false;
    users[idx].password = newPassword;
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    return true;
  }

  const { error } = await supabase
    .from('users')
    .update({ password: newPassword })
    .eq('id', userId);

  return !error;
}

function makeInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
