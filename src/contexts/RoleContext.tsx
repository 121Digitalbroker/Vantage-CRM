import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchUsers, createUser, updateUserStatus, resetUserPassword, updateUser, deleteUser } from '@/src/services/usersService';
import { supabase } from '@/lib/supabaseClient';

export type UserRole = 'Admin' | 'Manager' | 'Digital Marketer' | 'Telecaller';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  position?: string;
  initials: string;
  status: 'Active' | 'Inactive';
  phone?: string;
  managerId?: string;
  createdAt: string;
  lastLogin?: string;
}

const STORAGE_SESSION_KEY = 'crm_session';

function loadSession(): AppUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser;
    return { ...parsed, role: normalizeRole(parsed.role) };
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

function normalizeRole(role: string): UserRole {
  if (role === 'Manager' || role === 'General Manager') return 'Manager';
  if (role === 'Digital Marketer') return 'Digital Marketer';
  if (role === 'Telecaller') return 'Telecaller';
  return 'Admin';
}

// ── Context types ────────────────────────────────────────────────────────────
interface LoginResult { success: boolean; error?: string }

interface RoleContextType {
  currentUser: AppUser | null;
  allUsers: AppUser[];
  telecallers: AppUser[];
  managedUsers: AppUser[];
  managedUserIds: string[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isDigitalMarketer: boolean;
  isTelecaller: boolean;
  login: (email: string, password: string) => LoginResult;
  logout: () => void;
  addTelecaller: (data: { name: string; email: string; password: string; phone?: string; role: UserRole; position?: string; managerId?: string }) => Promise<{ success: boolean; error?: string }>;
  editUser: (userId: string, updates: { name?: string; email?: string; phone?: string; role?: UserRole; position?: string; managerId?: string }) => Promise<boolean>;
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

  const telecallers = allUsers.filter(u => u.role === 'Telecaller' && u.status === 'Active');
  const managedUsers = allUsers.filter(
    u => u.role === 'Telecaller' && u.status === 'Active' && u.managerId === currentUser?.id
  );
  const managedUserIds = managedUsers.map(u => u.id);

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
  const addTelecaller = async (data: { name: string; email: string; password: string; phone?: string; role: UserRole; position?: string; managerId?: string }) => {
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
      position: data.position?.trim() || undefined,
      managerId: data.managerId?.trim() || undefined,
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

  const editUser = async (userId: string, updates: { name?: string; email?: string; phone?: string; role?: UserRole; position?: string; managerId?: string }): Promise<boolean> => {
    const success = await updateUser(userId, updates);
    if (success) {
      setAllUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        const newName = updates.name ?? u.name;
        return {
          ...u,
          name:     newName,
          email:    updates.email    ?? u.email,
          phone:    updates.phone    ?? u.phone,
          role:     updates.role ? normalizeRole(updates.role) : u.role,
          position: updates.position ?? u.position,
          managerId: updates.managerId ?? u.managerId,
          initials: newName.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2),
        };
      }));
      if (currentUser?.id === userId) {
        setCurrentUser(prev => {
          if (!prev) return prev;
          const newName = updates.name ?? prev.name;
          const updated = {
            ...prev,
            name:     newName,
            email:    updates.email ?? prev.email,
            phone:    updates.phone ?? prev.phone,
            role:     updates.role ? normalizeRole(updates.role) : prev.role,
            position: updates.position ?? prev.position,
            managerId: updates.managerId ?? prev.managerId,
            initials: newName.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2),
          };
          saveSession(updated);
          return updated;
        });
      }
    }
    return success;
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
        managedUsers,
        managedUserIds,
        isAuthenticated: currentUser !== null,
        isAdmin:      currentUser?.role === 'Admin',
        isManager:    currentUser?.role === 'Manager',
        isDigitalMarketer: currentUser?.role === 'Digital Marketer',
        isTelecaller: currentUser?.role === 'Telecaller',
        login,
        logout,
        addTelecaller,
        editUser,
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
