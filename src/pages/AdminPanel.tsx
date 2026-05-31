import { useEffect, useState } from 'react';
import { Shield, LogOut, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import SuperAdmin from './SuperAdmin';

// Standalone shell for /adminpanel.
// Has its own login form — completely separate from the customer app.
// After sign-in the vy_super_admins table is checked; non-super-admins are
// shown an access-denied screen and cannot proceed.

function AdminLogin() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    if (signInError) {
      // Deliberately vague — don't distinguish "user not found" vs "wrong password"
      setError('Invalid credentials. Platform admin access only.');
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#f97316] rounded-xl flex items-center justify-center font-black text-white text-2xl mx-auto mb-4">V</div>
          <h1 className="text-xl font-bold text-white">VYSITE</h1>
          <p className="text-[11px] font-bold text-[#f97316] uppercase tracking-widest mt-1">Platform Administration</p>
        </div>

        <div className="bg-[#111827] border border-[#1e2d4a] rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[#1e2d4a]">
            <Shield size={14} className="text-slate-500" />
            <p className="text-xs text-slate-500">Restricted access — authorised personnel only</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 mb-4 bg-red-900/30 border border-red-900/50 rounded-lg text-xs text-red-300">
              <Shield size={13} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="admin@vysite.co.uk"
                className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="w-full py-2.5 bg-[#f97316] hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-700 mt-4">
          This is not the customer portal.{' '}
          <a href="/" className="text-slate-500 hover:text-slate-300 transition-colors">Go to app</a>
        </p>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { user, loading, session, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setChecking(false); setAllowed(false); return; }

    // Use a SECURITY DEFINER RPC function to bypass the self-referential RLS
    // policy on vy_super_admins, which can silently return no rows on the first
    // query in a fresh JWT session due to the circular EXISTS sub-select.
    (async () => {
      const { data, error } = await supabase.rpc('is_super_admin');
      setAllowed(!error && data === true);
      setChecking(false);
    })();
  }, [user, loading]);

  // Not logged in — show the dedicated admin login screen
  if (!loading && !session) {
    return <AdminLogin />;
  }

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-[#f97316] flex items-center justify-center font-black text-white text-xl mx-auto mb-3">V</div>
          <p className="text-slate-400 text-sm">Verifying access…</p>
        </div>
      </div>
    );
  }

  // Logged in but not a super admin
  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#1a2236] border border-red-900/40 flex items-center justify-center mx-auto mb-4">
            <Shield size={24} className="text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Access Denied</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-5">
            Your account (<span className="text-slate-300">{user?.email}</span>) does not have platform admin access.
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/"
              className="px-4 py-2 border border-[#1e2d4a] text-slate-400 hover:text-white rounded-lg text-sm transition-colors"
            >
              Go to app
            </a>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 border border-red-900/50 text-red-400 hover:text-red-300 rounded-lg text-sm transition-colors"
            >
              <LogOut size={14} />Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated super admin — render the admin panel
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Minimal top bar */}
      <div className="border-b border-[#1a2236] bg-black/60 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-[#f97316] rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-sm">V</span>
          </div>
          <span className="text-white font-bold text-sm">VYSITE</span>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-[11px] font-bold text-[#f97316] uppercase tracking-widest">Platform Administration</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-slate-500">{user?.email}</span>
          <a href="/" className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
            Back to app
          </a>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={12} />Sign out
          </button>
        </div>
      </div>

      <SuperAdmin />
    </div>
  );
}
