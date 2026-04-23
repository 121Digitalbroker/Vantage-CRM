import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchUsers, createUser, updateUserStatus, resetUserPassword } from '@/src/services/usersService';
import { supabase } from '@/lib/supabaseClient';

export type UserRole = 'Admin' | 'Manager' | 'Telecaller';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  initials: string;
  status: 'Active' | 'Inactive';
  phone?: string;
  createdAt: string;
  lastLogin?: string;
}

// ── Seed users (always present) ─────────────────────────────────────────────
const SEED_USERS: AppUser[] = [
  {
    id: 'admin-1', name: 'Admin User',   email: 'admin@estatescrm.com',
    password: 'admin123', role: 'Admin', initials: 'AU',
    status: 'Active', createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u1', name: 'Rahul Sharma',  email: 'rahul@estatescrm.com',
    password: 'telecaller123', role: 'Telecaller', initials: 'RS',
    status: 'Active', phone: '+91 98765-11111', createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'u2', name: 'Priya Mehta',   email: 'priya@estatescrm.com',
    password: 'telecaller123', role: 'Telecaller', initials: 'PM',
    status: 'Active', phone: '+91 98765-22222', createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'u3', name: 'Arjun Patel',   email: 'arjun@estatescrm.com',
    password: 'telecaller123', role: 'Telecaller', initials: 'AP',
    status: 'Active', phone: '+91 98765-33333', createdAt: '2026-01-06T00:00:00Z',
  },
  {
    id: 'u4', name: 'Sneha Gupta',   email: 'sneha@estatescrm.com',
    password: 'telecaller123', role: 'Telecaller', initials: 'SG',
    status: 'Active', phone: '+91 98765-44444', createdAt: '2026-01-06T00:00:00Z',
  },
];

const STORAGE_USERS_KEY   = 'crm_users';
const STORAGE_SESSION_KEY = 'crm_session';
const USE_DEMO_USERS = import.meta.env.VITE_USE_DEMO_USERS !== 'false';

function loadUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      const saved: AppUser[] = JSON.parse(raw);
      // Merge seed users (by id) with any admin-created users
      const merged = [...SEED_USERS];
      saved.forEach(u => { if (!merged.find(m => m.id === u.id)) merged.push(u); });
      return merged;
    }
  } catch { /* ignore */ }
  return [...SEED_USERS];
}

function saveUsers(users: AppUser[]) {
  try { localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users)); } catch { /* ignore */ }
}

function loadSession(): AppUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(user: AppUser | null) {
  try {
    if (user) localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_SESSION_KEY);
  } catch { /* ignore */ }
}

function makeInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Context types ────────────────────────────────────────────────────────────
interface LoginResult { success: boolean; error?: string }

interface RoleContextType {
  currentUser: AppUser | null;
  allUsers: AppUser[];
  telecallers: AppUser[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTelecaller: boolean;
  login: (email: string, password: string) => LoginResult;
  logout: () => void;
  addTelecaller: (data: { name: string; email: string; password: string; phone?: string; role: UserRole }) => Promise<{ success: boolean; error?: string }>;
  toggleUserStatus: (userId: string) => Promise<void>;
  resetPassword: (userId: string, newPassword: string) => Promise<void>;
  /** Demo-only: switch active user without password */
  switchUser: (userId: string) => void;
}

const RoleContext = createContext<RoleContextType | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────
export function RoleProvider({ children }: { children: ReactNode }) {
  const [allUsers,     setAllUsers]     = useState<AppUser[]>(() => USE_DEMO_USERS ? loadUsers() : []);
  const [currentUser,  setCurrentUser]  = useState<AppUser | null>(loadSession);
  const [loading,      setLoading]      = useState(true);

  const syncCurrentUser = (users: AppUser[]) => {
    setCurrentUser(prev => {
      if (!prev) return prev;
      const fresh = users.find(u => u.id === prev.id);
      if (!fresh) return prev;
      saveSession(fresh);
      return fresh;
    });
  };

  // Load users from Supabase on mount (if not in demo mode)
  useEffect(() => {
    async function load() {
      if (!USE_DEMO_USERS) {
        const users = await fetchUsers();
        setAllUsers(users);
        syncCurrentUser(users);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Keep users in sync across tabs/devices with Supabase Realtime.
  useEffect(() => {
    if (USE_DEMO_USERS) return;

    const refreshUsers = async () => {
      const users = await fetchUsers();
      setAllUsers(users);
      syncCurrentUser(users);
    };

    const channel = supabase
      .channel('public:users')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => { void refreshUsers(); }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Persist user roster to localStorage whenever it changes (for demo/fallback)
  useEffect(() => {
    if (USE_DEMO_USERS) {
      saveUsers(allUsers);
    }
  }, [allUsers]);

  const telecallers = allUsers.filter(u => (u.role === 'Telecaller' || u.role === 'Manager') && u.status === 'Active');

  // ── Auth actions ───────────────────────────────────────────────────────────
  const login = (email: string, password: string): LoginResult => {
    const user = allUsers.find(u =>
      u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!user)  return { success: false, error: 'Invalid email or password' };
    if (user.status === 'Inactive')
      return { success: false, error: 'Your account has been deactivated. Contact admin.' };
    setCurrentUser(user);
    saveSession(user);
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    saveSession(null);
  };

  // ── Admin actions ──────────────────────────────────────────────────────────
  const addTelecaller = async (data: { name: string; email: string; password: string; phone?: string; role: UserRole }) => {
    if (allUsers.find(u => u.email.toLowerCase() === data.email.toLowerCase()))
      return { success: false, error: 'A user with this email already exists.' };

    const newUserPayload = {
      name:      data.name.trim(),
      email:     data.email.trim().toLowerCase(),
      password:  data.password,
      role:      data.role,
      initials:  makeInitials(data.name),
      status:    'Active' as const,
      phone:     data.phone,
    };

    const created = await createUser(newUserPayload);
    if (!created) {
      return { success: false, error: 'Failed to create user in database.' };
    }

    setAllUsers(prev => [...prev, created]);
    return { success: true };
  };

  const toggleUserStatus = async (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    const success = await updateUserStatus(userId, newStatus);
    
    if (success) {
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      // If this was the current logged-in user, update session too
      if (currentUser?.id === userId) {
        setCurrentUser(prev => prev ? { ...prev, status: newStatus } : prev);
      }
    }
  };

  const resetPassword = async (userId: string, newPassword: string) => {
    const success = await resetUserPassword(userId, newPassword);
    if (success) {
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, password: newPassword } : u));
    }
  };

  /** Demo shortcut – switch without password (shows in sidebar as "Switch user") */
  const switchUser = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) { setCurrentUser(user); saveSession(user); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-slate-500">Loading...</div>;
  }

  return (
    <RoleContext.Provider
      value={{
        currentUser,
        allUsers,
        telecallers,
        isAuthenticated: currentUser !== null,
        isAdmin:      currentUser?.role === 'Admin' || currentUser?.role === 'Manager',
        isTelecaller: currentUser?.role === 'Telecaller',
        login,
        logout,
        addTelecaller,
        toggleUserStatus,
        resetPassword,
        switchUser,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextType {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside <RoleProvider>');
  return ctx;
}

// Legacy named export so old imports still compile
export const ALL_USERS  = SEED_USERS;
export const TELECALLERS = SEED_USERS.filter(u => u.role === 'Telecaller');
