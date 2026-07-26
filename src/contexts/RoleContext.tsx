import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchUsers, fetchUserByEmail, createUser, updateUserStatus, resetUserPassword, updateUser, deleteUser } from '@/src/services/usersService';
import { supabase } from '@/lib/supabaseClient';
import { syncOneSignalUser } from '@/src/lib/onesignal';

export type UserRole = 'Admin' | 'Manager' | 'Manager1' | 'Digital Marketer' | 'Telecaller';

/** General Manager (`Manager`) or team Manager (`Manager1`). */
export function isManagerKindRole(role: string | undefined | null): boolean {
  return role === 'Manager' || role === 'Manager1';
}

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
  /** Telecallers: one or more GM / Manager1 ids (stored as JSON in `users.manager_id`). */
  managerIds?: string[];
  /** Manager1: optional General Manager user id (`users.reports_to_gm_id`). */
  reportsToGmId?: string;
  createdAt: string;
  lastLogin?: string;
}

const STORAGE_SESSION_KEY = 'crm_session';

function loadSession(): AppUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser & { managerId?: string };
    const role = normalizeRole(parsed.role);
    let managerIds = parsed.managerIds;
    if ((!managerIds || managerIds.length === 0) && parsed.managerId) {
      managerIds = [parsed.managerId];
    }
    const { managerId: _omit, ...rest } = parsed as AppUser & { managerId?: string };
    return { ...rest, role, managerIds };
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
  if (role === 'Manager1') return 'Manager1';
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
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  addTelecaller: (data: { name: string; email: string; password: string; phone?: string; role: UserRole; position?: string; managerIds?: string[]; reportsToGmId?: string }) => Promise<{ success: boolean; error?: string }>;
  editUser: (userId: string, updates: { name?: string; email?: string; phone?: string; role?: UserRole; position?: string; managerIds?: string[]; reportsToGmId?: string | null }) => Promise<boolean>;
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

  // OneSignal: same External ID as CRM `users.id` → target this user in OneSignal dashboard
  useEffect(() => {
    syncOneSignalUser(currentUser?.id ?? null);
  }, [currentUser?.id]);

  const telecallers = allUsers.filter(u => u.role === 'Telecaller' && u.status === 'Active');
  const managedUsers = allUsers.filter(
    u =>
      u.status === 'Active'
      && (
        (u.role === 'Telecaller' && currentUser?.id && u.managerIds?.includes(currentUser.id)) ||
        (u.role === 'Manager1' && currentUser?.id && u.reportsToGmId === currentUser.id)
      )
  );
  const managedUserIds = managedUsers.map(u => u.id);

  // ── Auth actions ───────────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<LoginResult> => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password; // passwords are case-sensitive

    // 1) Fast path: already loaded users
    let user = allUsers.find(u =>
      u.email.toLowerCase() === normalizedEmail && u.password === normalizedPassword
    );

    // 2) Reliable path: fetch this email directly from Supabase
    // (fixes empty allUsers / slow load / stale list)
    if (!user) {
      const fromDb = await fetchUserByEmail(normalizedEmail);
      if (fromDb && fromDb.password === normalizedPassword) {
        user = fromDb;
        setAllUsers(prev => {
          if (prev.some(u => u.id === fromDb.id)) {
            return prev.map(u => (u.id === fromDb.id ? fromDb : u));
          }
          return [...prev, fromDb];
        });
      } else if (!fromDb && allUsers.length === 0) {
        // Distinguish "wrong password" from "users table not readable"
        const probe = await fetchUsers();
        if (probe.length === 0) {
          return {
            success: false,
            error: 'Cannot load users from database. Check Supabase URL/key and RLS on public.users.',
          };
        }
        setAllUsers(probe);
        user = probe.find(u =>
          u.email.toLowerCase() === normalizedEmail && u.password === normalizedPassword
        );
      }
    }

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
  const addTelecaller = async (data: { name: string; email: string; password: string; phone?: string; role: UserRole; position?: string; managerIds?: string[]; reportsToGmId?: string }) => {
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
      managerIds: data.managerIds?.length ? data.managerIds : undefined,
      reportsToGmId: data.reportsToGmId?.trim() || undefined,
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

  const editUser = async (userId: string, updates: { name?: string; email?: string; phone?: string; role?: UserRole; position?: string; managerIds?: string[]; reportsToGmId?: string | null }): Promise<boolean> => {
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
          managerIds: updates.managerIds !== undefined ? updates.managerIds : u.managerIds,
          reportsToGmId:
            updates.reportsToGmId !== undefined
              ? (updates.reportsToGmId ?? undefined)
              : u.reportsToGmId,
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
            managerIds: updates.managerIds !== undefined ? updates.managerIds : prev.managerIds,
            reportsToGmId:
              updates.reportsToGmId !== undefined
                ? (updates.reportsToGmId ?? undefined)
                : prev.reportsToGmId,
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
        isManager:    isManagerKindRole(currentUser?.role),
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
