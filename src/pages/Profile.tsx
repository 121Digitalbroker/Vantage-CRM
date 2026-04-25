import { useState } from 'react';
import { User, Mail, Phone, Lock, Eye, EyeOff, Save, Briefcase, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRole } from '@/src/contexts/RoleContext';

const avatarColors: Record<string, string> = {
  Admin:      'bg-blue-500',
  Manager:    'bg-purple-500',
  'Digital Marketer': 'bg-orange-500',
  Telecaller: 'bg-emerald-500',
};

export default function Profile() {
  const { currentUser, editUser, resetPassword } = useRole();

  // ── Profile form ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    name:  currentUser?.name  ?? '',
    email: currentUser?.email ?? '',
    phone: currentUser?.phone ?? '',
  });
  const [profileError,   setProfileError]   = useState('');
  const [profileSaving,  setProfileSaving]  = useState(false);

  // ── Password form ─────────────────────────────────────────────────────────
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passError,   setPassError]   = useState('');
  const [passSaving,  setPassSaving]  = useState(false);

  if (!currentUser) return null;

  const handleProfileSave = async () => {
    if (!profile.name.trim())  { setProfileError('Name is required.'); return; }
    if (!profile.email.trim()) { setProfileError('Email is required.'); return; }
    if (!/\S+@\S+\.\S+/.test(profile.email)) { setProfileError('Please enter a valid email.'); return; }

    setProfileSaving(true);
    const ok = await editUser(currentUser.id, {
      name:  profile.name.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim(),
    });
    setProfileSaving(false);

    if (ok) {
      toast.success('Profile updated successfully.');
      setProfileError('');
    } else {
      setProfileError('Failed to save changes. Please try again.');
    }
  };

  const handlePasswordChange = async () => {
    if (!passwords.current.trim()) { setPassError('Please enter your current password.'); return; }
    if (passwords.current !== currentUser.password) { setPassError('Current password is incorrect.'); return; }
    if (!passwords.newPass.trim()) { setPassError('Please enter a new password.'); return; }
    if (passwords.newPass.length < 6) { setPassError('New password must be at least 6 characters.'); return; }
    if (passwords.newPass !== passwords.confirm) { setPassError('Passwords do not match.'); return; }

    setPassSaving(true);
    await resetPassword(currentUser.id, passwords.newPass);
    setPassSaving(false);

    toast.success('Password changed successfully.');
    setPasswords({ current: '', newPass: '', confirm: '' });
    setPassError('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-2">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your personal information and account security.</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0 ${avatarColors[currentUser.role] ?? 'bg-slate-400'}`}>
              {currentUser.initials}
            </div>
            <div className="pt-1">
              <CardTitle className="text-lg">{currentUser.name}</CardTitle>
              <CardDescription className="text-sm">{currentUser.email}</CardDescription>
              <div className="text-xs font-medium text-slate-500 mt-2 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                {currentUser.position?.trim() || 'Position not set'}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 pb-2 border-b border-slate-100">
            <User className="w-4 h-4 text-slate-400" />
            Personal Information
          </div>

          {profileError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              {profileError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Your full name"
                  value={profile.name}
                  onChange={e => { setProfile(p => ({ ...p, name: e.target.value })); setProfileError(''); }}
                  className="border-slate-200 h-10 text-sm pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Email Address *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={profile.email}
                  onChange={e => { setProfile(p => ({ ...p, email: e.target.value })); setProfileError(''); }}
                  className="border-slate-200 h-10 text-sm pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="+91 98765-00000"
                  value={profile.phone}
                  onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                  className="border-slate-200 h-10 text-sm pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Position</Label>
              <div className="h-10 px-3 border border-slate-200 rounded-md bg-slate-50 flex items-center text-sm text-slate-600">
                {currentUser.position?.trim() || 'Not set by admin'}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm h-9"
            >
              {profileSaving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Changes
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-slate-500" />
            <div>
              <CardTitle className="text-base">Change Password</CardTitle>
              <CardDescription className="text-sm">Update your password to keep your account secure</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {passError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              {passError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current password */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Current password"
                  value={passwords.current}
                  onChange={e => { setPasswords(p => ({ ...p, current: e.target.value })); setPassError(''); }}
                  className="border-slate-200 h-10 text-sm pr-9"
                />
                <button type="button" className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600" onClick={() => setShowCurrent(v => !v)}>
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">New Password</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={passwords.newPass}
                  onChange={e => { setPasswords(p => ({ ...p, newPass: e.target.value })); setPassError(''); }}
                  className="border-slate-200 h-10 text-sm pr-9"
                />
                <button type="button" className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600" onClick={() => setShowNew(v => !v)}>
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={passwords.confirm}
                  onChange={e => { setPasswords(p => ({ ...p, confirm: e.target.value })); setPassError(''); }}
                  className="border-slate-200 h-10 text-sm pr-9"
                />
                <button type="button" className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600" onClick={() => setShowConfirm(v => !v)}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Password strength */}
          {passwords.newPass.length > 0 && (
            <div className="flex items-center gap-2 max-w-xs">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    passwords.newPass.length >= i * 3
                      ? passwords.newPass.length >= 10
                        ? 'bg-green-400'
                        : passwords.newPass.length >= 7
                          ? 'bg-yellow-400'
                          : 'bg-red-400'
                      : 'bg-slate-200'
                  }`}
                />
              ))}
              <span className="text-xs text-slate-500 ml-1 shrink-0">
                {passwords.newPass.length < 6 ? 'Too short' : passwords.newPass.length < 7 ? 'Weak' : passwords.newPass.length < 10 ? 'Fair' : 'Strong'}
              </span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              onClick={handlePasswordChange}
              disabled={passSaving || !passwords.current || !passwords.newPass || !passwords.confirm}
              className="bg-slate-800 hover:bg-slate-900 text-white text-sm h-9"
            >
              {passSaving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Update Password
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-1">User ID</p>
              <p className="font-mono text-slate-600 text-xs">{currentUser.id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Account Status</p>
              <Badge variant="outline" className={`text-xs font-semibold ${currentUser.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {currentUser.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Member Since</p>
              <p className="text-slate-600">
                {(() => { try { return new Date(currentUser.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; } })()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Position</p>
              <p className="text-slate-600">{currentUser.position?.trim() || 'Not set'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
