import { useState } from 'react';
import {
  UserPlus, MoreHorizontal, Edit, Ban, CheckCircle,
  Users as UsersIcon, Phone, Key, Eye, EyeOff, Shield, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRole, UserRole } from '@/src/contexts/RoleContext';
import { format } from 'date-fns';

const roleBadgeColors: Record<string, string> = {
  Admin:      'bg-purple-50 text-purple-700 border-purple-200',
  Manager:    'bg-blue-50 text-blue-700 border-blue-200',
  Telecaller: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const roleAvatarColors: Record<string, string> = {
  Admin:      'bg-purple-500',
  Manager:    'bg-blue-500',
  Telecaller: 'bg-emerald-500',
};

export default function Users() {
  const { allUsers, addTelecaller, editUser, toggleUserStatus, resetPassword, removeUser } = useRole();

  // ── Add user dialog ────────────────────────────────────────────────────────
  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'Telecaller' as UserRole, position: '' });
  const [showNewPass,  setShowNewPass]  = useState(false);
  const [formError,    setFormError]    = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  // ── Reset password dialog ─────────────────────────────────────────────────
  const [resetDialogUser, setResetDialogUser] = useState<string | null>(null);
  const [newPassword,      setNewPassword]     = useState('');
  const [showResetPass,    setShowResetPass]   = useState(false);

  // ── Edit user dialog ──────────────────────────────────────────────────────
  const [editTarget,   setEditTarget]   = useState<{ id: string; name: string; email: string; phone: string; role: UserRole; position: string } | null>(null);
  const [editForm,     setEditForm]     = useState({ name: '', email: '', phone: '', role: 'Telecaller' as UserRole, position: '' });
  const [editError,    setEditError]    = useState('');
  const [editSaving,   setEditSaving]   = useState(false);

  // ── Delete confirmation dialog ────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  const resetForm = () => {
    setForm({ name: '', email: '', password: '', phone: '', role: 'Telecaller', position: '' });
    setFormError('');
    setShowNewPass(false);
  };

  const handleAdd = async () => {
    if (!form.name.trim())     { setFormError('Name is required.'); return; }
    if (!form.email.trim())    { setFormError('Email is required.'); return; }
    if (!form.password.trim()) { setFormError('Password is required.'); return; }
    if (form.password.length < 6) { setFormError('Password must be at least 6 characters.'); return; }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setFormError('Please enter a valid email.'); return; }

    setSubmitting(true);
    await new Promise(r => setTimeout(r, 300));

    const result = await addTelecaller(form);
    setSubmitting(false);

    if (result.success) {
      toast.success(`${form.role} "${form.name}" created successfully! They can now log in.`);
      setDialogOpen(false);
      resetForm();
    } else {
      setFormError(result.error ?? 'Failed to create user.');
    }
  };

  const handleToggleStatus = async (userId: string, name: string, current: string) => {
    await toggleUserStatus(userId);
    toast.success(`${name} has been ${current === 'Active' ? 'deactivated' : 'activated'}.`);
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    await resetPassword(resetDialogUser!, newPassword);
    toast.success('Password reset successfully.');
    setResetDialogUser(null);
    setNewPassword('');
  };

  const openEditDialog = (user: typeof allUsers[0]) => {
    setEditTarget({ id: user.id, name: user.name, email: user.email, phone: user.phone ?? '', role: user.role, position: user.position ?? '' });
    setEditForm({ name: user.name, email: user.email, phone: user.phone ?? '', role: user.role, position: user.position ?? '' });
    setEditError('');
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim())  { setEditError('Name is required.'); return; }
    if (!editForm.email.trim()) { setEditError('Email is required.'); return; }
    if (!/\S+@\S+\.\S+/.test(editForm.email)) { setEditError('Please enter a valid email.'); return; }

    setEditSaving(true);
    const ok = await editUser(editTarget.id, {
      name:  editForm.name.trim(),
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      role:  editForm.role,
      position: editForm.position.trim(),
    });
    setEditSaving(false);

    if (ok) {
      toast.success(`${editForm.name}'s details updated successfully.`);
      setEditTarget(null);
    } else {
      setEditError('Failed to save changes. Please try again.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await removeUser(deleteTarget.id);
    setDeleting(false);
    if (ok) {
      toast.success(`"${deleteTarget.name}" has been deleted.`);
    } else {
      toast.error('Failed to delete user. Please try again.');
    }
    setDeleteTarget(null);
  };

  const stats = {
    total:       allUsers.length,
    telecallers: allUsers.filter(u => u.role === 'Telecaller').length,
    active:      allUsers.filter(u => u.status === 'Active').length,
    admins:      allUsers.filter(u => u.role === 'Admin' || u.role === 'Manager').length,
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Create telecaller accounts and manage access.</p>
        </div>

        {/* Add user dialog trigger */}
        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white h-9">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Telecaller
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User Account</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Full Name *</Label>
                <Input
                  placeholder="e.g. Ravi Kumar"
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormError(''); }}
                  className="border-slate-200 h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Email Address *</Label>
                <Input
                  type="email"
                  placeholder="ravi@estatescrm.com"
                  value={form.email}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setFormError(''); }}
                  className="border-slate-200 h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Password *</Label>
                <div className="relative">
                  <Input
                    type={showNewPass ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={form.password}
                    onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setFormError(''); }}
                    className="border-slate-200 h-9 text-sm pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowNewPass(v => !v)}
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Phone (optional)</Label>
                <Input
                  placeholder="+91 98765-00000"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="border-slate-200 h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Position (optional)</Label>
                <Input
                  placeholder="e.g. Sales Executive"
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  className="border-slate-200 h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Role</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}>
                  <SelectTrigger className="h-9 border-slate-200 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Telecaller">Telecaller</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleAdd}
                disabled={submitting}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm"
              >
                {submitting ? 'Creating…' : 'Create Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',   value: stats.total,       icon: UsersIcon,      color: 'bg-blue-100 text-blue-500' },
          { label: 'Telecallers',   value: stats.telecallers, icon: Phone,          color: 'bg-emerald-100 text-emerald-500' },
          { label: 'Active',        value: stats.active,      icon: CheckCircle,    color: 'bg-green-100 text-green-500' },
          { label: 'Admin / Mgr',   value: stats.admins,      icon: Shield,         color: 'bg-purple-100 text-purple-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">All Users</h2>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-full text-[0.8125rem]">
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                <TableHead className="font-semibold text-slate-500 px-5 py-3">User</TableHead>
                <TableHead className="font-semibold text-slate-500 px-5 py-3">Role</TableHead>
                <TableHead className="font-semibold text-slate-500 px-5 py-3">Status</TableHead>
                <TableHead className="font-semibold text-slate-500 px-5 py-3">Phone</TableHead>
                <TableHead className="font-semibold text-slate-500 px-5 py-3">Position</TableHead>
                <TableHead className="font-semibold text-slate-500 px-5 py-3">Created</TableHead>
                <TableHead className="text-right font-semibold text-slate-500 px-5 py-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allUsers.map(user => (
                <TableRow key={user.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <TableCell className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${roleAvatarColors[user.role] ?? 'bg-slate-400'}`}>
                        {user.initials}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{user.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="px-5 py-3">
                    <Badge variant="outline" className={`text-xs font-semibold shadow-none ${roleBadgeColors[user.role] ?? ''}`}>
                      {user.role}
                    </Badge>
                  </TableCell>

                  <TableCell className="px-5 py-3">
                    <Badge variant="secondary" className={`text-xs shadow-none ${user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {user.status}
                    </Badge>
                  </TableCell>

                  <TableCell className="px-5 py-3 text-xs text-slate-500">
                    {user.phone || <span className="text-slate-300">—</span>}
                  </TableCell>

                  <TableCell className="px-5 py-3 text-xs text-slate-500">
                    {user.position || <span className="text-slate-300">—</span>}
                  </TableCell>

                  <TableCell className="px-5 py-3 text-xs text-slate-500">
                    {(() => { try { return format(new Date(user.createdAt), 'MMM d, yyyy'); } catch { return '—'; } })()}
                  </TableCell>

                  <TableCell className="text-right px-5 py-3">
                    {/* Don't allow actions on the Admin seed account */}
                    {user.id !== 'admin-1' ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent hover:bg-muted text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                          <DropdownMenuItem
                            className="cursor-pointer text-xs"
                            onClick={() => { setResetDialogUser(user.id); setNewPassword(''); }}
                          >
                            <Key className="w-3.5 h-3.5 mr-2 text-slate-500" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => openEditDialog(user)}>
                            <Edit className="w-3.5 h-3.5 mr-2 text-slate-500" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className={`cursor-pointer text-xs ${user.status === 'Active' ? 'text-orange-600 focus:text-orange-600 focus:bg-orange-50' : 'text-green-600 focus:text-green-600 focus:bg-green-50'}`}
                            onClick={() => handleToggleStatus(user.id, user.name, user.status)}
                          >
                            {user.status === 'Active' ? (
                              <><Ban className="w-3.5 h-3.5 mr-2" />Deactivate</>
                            ) : (
                              <><CheckCircle className="w-3.5 h-3.5 mr-2" />Activate</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer text-xs text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => setDeleteTarget({ id: user.id, name: user.name })}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-xs text-slate-300 pr-3">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
          {allUsers.length} users total · Telecallers can log in with their email and password
        </div>
      </div>

      {/* Edit user dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-4 h-4 text-blue-500" />
              Edit User Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {editError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
                {editError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Full Name *</Label>
              <Input
                placeholder="e.g. Ravi Kumar"
                value={editForm.name}
                onChange={e => { setEditForm(f => ({ ...f, name: e.target.value })); setEditError(''); }}
                className="border-slate-200 h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Email Address *</Label>
              <Input
                type="email"
                placeholder="user@vantagerealtors.in"
                value={editForm.email}
                onChange={e => { setEditForm(f => ({ ...f, email: e.target.value })); setEditError(''); }}
                className="border-slate-200 h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Phone</Label>
              <Input
                placeholder="+91 98765-00000"
                value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                className="border-slate-200 h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Role</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger className="h-9 border-slate-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Telecaller">Telecaller</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Position</Label>
              <Input
                placeholder="e.g. Team Lead"
                value={editForm.position}
                onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))}
                className="border-slate-200 h-9 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="text-sm"
              onClick={() => setEditTarget(null)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editSaving}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm"
            >
              {editSaving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetDialogUser} onOpenChange={open => { if (!open) setResetDialogUser(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500">
              Set a new password for <strong>{allUsers.find(u => u.id === resetDialogUser)?.name}</strong>.
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">New Password</Label>
              <div className="relative">
                <Input
                  type={showResetPass ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="border-slate-200 h-9 text-sm pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowResetPass(v => !v)}
                >
                  {showResetPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleResetPassword}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm"
            >
              Save New Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete User
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-slate-600">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900">{deleteTarget?.name}</strong>?
            </p>
            <p className="text-xs text-slate-400 mt-2">
              This action cannot be undone. The user will lose all access immediately.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="text-sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white text-sm"
            >
              {deleting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  Yes, Delete
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
