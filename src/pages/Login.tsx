import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRole } from '@/src/contexts/RoleContext';

const DEMO_CREDENTIALS = [
  { label: 'Admin',       email: 'admin@estatescrm.com',  password: 'admin123',       role: 'Admin' },
  { label: 'Rahul (TC)',  email: 'rahul@estatescrm.com',  password: 'telecaller123',  role: 'Telecaller' },
  { label: 'Priya (TC)',  email: 'priya@estatescrm.com',  password: 'telecaller123',  role: 'Telecaller' },
];

export default function Login() {
  const navigate  = useNavigate();
  const { login } = useRole();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim())    { setError('Please enter your email address.'); return; }
    if (!password.trim()) { setError('Please enter your password.'); return; }

    setLoading(true);
    // Simulate network delay for realistic feel
    await new Promise(r => setTimeout(r, 400));

    const result = login(email.trim(), password);
    setLoading(false);

    if (result.success) {
      // Role-based redirect handled in App.tsx ProtectedRoute
      navigate('/', { replace: true });
    } else {
      setError(result.error ?? 'Login failed. Please try again.');
    }
  };

  const fillCredentials = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/30">
              EF
            </div>
            <span className="text-2xl font-bold text-slate-900 tracking-tight">EstatesCRM</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Real estate telecaller management platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden">
          {/* Card header */}
          <div className="px-8 pt-8 pb-6 border-b border-slate-100">
            <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to your account to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
            {/* Error banner */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠️</span>
                {error}
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@estatescrm.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-10 border-slate-200 focus-visible:ring-blue-500 text-sm"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-10 border-slate-200 focus-visible:ring-blue-500 text-sm pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm shadow-sm shadow-blue-500/30 transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign in
                </span>
              )}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="px-8 pb-8">
            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Quick demo login
              </p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_CREDENTIALS.map(cred => (
                  <button
                    key={cred.email}
                    type="button"
                    onClick={() => fillCredentials(cred.email, cred.password)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      cred.role === 'Admin' ? 'bg-blue-500' : 'bg-emerald-500'
                    }`}>
                      {cred.role === 'Admin' ? 'AU' : cred.label.split(' ')[0].slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[0.7rem] font-medium text-slate-600 group-hover:text-blue-700 leading-tight text-center">
                      {cred.label}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[0.68rem] text-slate-400 text-center mt-3">
                Click any card above to auto-fill credentials, then press Sign in
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Phone className="w-3.5 h-3.5" />
          EstatesCRM · Real Estate Telecaller Platform
        </div>
      </div>
    </div>
  );
}
