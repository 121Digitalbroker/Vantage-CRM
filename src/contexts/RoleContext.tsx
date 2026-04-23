import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchUsers, createUser, updateUserStatus, resetUserPassword, deleteUser } from '@/src/services/usersService';
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

const STORAGE_SESSION_KEY = 'crm_session';

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
  removeUser: (userId: string) => Promise<boolean>;
}

const RoleContext = createContext<RoleContextType | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────
export function RoleProvider({ children }: { children: ReactNode }) {
  const [allUsers,    setAllUsers]    = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(loadSession);
  const [loading,     setLoading]     = useState(true);

  const syncCurrentUser = (users: AppUser[]) => {
    setCurrentUser(prev => {
      if (!prev) return prev;
      const fresh = users.find(u => u.id === prev.id);
      if (!fresh) return prev;
      saveSession(fresh);
      return fresh;
    });
  };

  // Load users from Supabase on mount
  useEffect(() => {
    async function load() {
      const users = await fetchUsers();
      setAllUsers(users);
      syncCurrentUser(users);
      setLoading(false);
    }
    load();
  }, []);

  // Keep users in sync across tabs/devices with Supabase Realtime
  useEffect(() => {
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

  const telecallers = allUsers.filter(u => (u.role === 'Telecaller' || u.role === 'Manager') && u.status === 'Active');

  // ── Auth actions ───────────────────────────────────────────────────────────
  const login = (email: string, password: string): LoginResult => {
    const user = allUsers.find(u =>
      u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!user) return { success: false, error: 'Invalid email or password.' };
    if (user.status === 'Inactive')
      return { success: false, error: 'Your account has been deactivated. Contact your admin.' };
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
      name:     data.name.trim(),
      email:    data.email.trim().toLowerCase(),
      password: data.password,
      role:     data.role,
      initials: makeInitials(data.name),
      status:   'Active' as const,
      phone:    data.phone,
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

  const removeUser = async (userId: string): Promise<boolean> => {
    const success = await deleteUser(userId);
    if (success) {
      setAllUsers(prev => prev.filter(u => u.id !== userId));
    }
    return success;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading Vantage CRM…</p>
        </div>
      </div>
    );
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
        removeUser,
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

// Legacy named exports kept for backward compatibility
export const ALL_USERS: AppUser[] = [];
export const TELECALLERS: AppUser[] = [];
