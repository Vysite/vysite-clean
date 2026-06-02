import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { env } from '../lib/env';

type LoginView = 'signin' | 'forgot' | 'forgot-sent';

export default function Login() {
  const { signIn } = useAuth();
  const [view, setView] = useState<LoginView>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await signIn(email.trim(), password);
    setLoading(false);
    if (authError) setError(authError);
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const redirectTo = `${env.appUrl.replace(/\/$/, '')}/set-password?type=recovery`;
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      resetEmail.trim().toLowerCase(),
      { redirectTo }
    );
    setLoading(false);
    if (resetErr) {
      setError(resetErr.message);
      return;
    }
    setView('forgot-sent');
  }

  const Background = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#f97316]/5 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-900/10 blur-3xl" />
    </div>
  );

  const Logo = () => (
    <div className="flex justify-center mb-8">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#f97316] flex items-center justify-center font-black text-white text-2xl select-none shadow-lg shadow-orange-900/40">V</div>
        <div>
          <span className="text-xl font-black text-white tracking-tight">VY</span>
          <span className="text-xl font-black text-[#f97316] tracking-tight">SITE</span>
        </div>
      </div>
    </div>
  );

  if (view === 'forgot-sent') {
    return (
      <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center px-4">
        <Background />
        <div className="relative w-full max-w-sm">
          <Logo />
          <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white mb-1">Check your email</h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                We've sent a password reset link to{' '}
                <span className="text-slate-200 font-medium">{resetEmail}</span>.
              </p>
              <p className="text-xs text-slate-500 mt-2">Click the link in the email to set a new password. The link expires after 1 hour.</p>
            </div>
            <button
              onClick={() => { setView('signin'); setError(null); }}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mt-2"
            >
              <ArrowLeft size={13} />Back to sign in
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-600 mt-6">VYSITE &copy; {new Date().getFullYear()} — Authorised access only</p>
        </div>
      </div>
    );
  }

  if (view === 'forgot') {
    return (
      <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center px-4">
        <Background />
        <div className="relative w-full max-w-sm">
          <Logo />
          <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl overflow-hidden">
            <div className="px-8 pt-8 pb-6 border-b border-[#1e2d4a]">
              <h1 className="text-lg font-bold text-white">Reset your password</h1>
              <p className="text-xs text-slate-500 mt-1">Enter your email and we'll send you a link to set a new password.</p>
            </div>
            <form onSubmit={handleForgotPassword} className="px-8 py-6 flex flex-col gap-4">
              {error && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300 leading-relaxed">{error}</p>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#f97316] hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-orange-900/30"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Sending…
                  </span>
                ) : 'Send Reset Link'}
              </button>
              <button
                type="button"
                onClick={() => { setView('signin'); setError(null); }}
                className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <ArrowLeft size={13} />Back to sign in
              </button>
            </form>
          </div>
          <p className="text-center text-[11px] text-slate-600 mt-6">VYSITE &copy; {new Date().getFullYear()} — Authorised access only</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center px-4">
      <Background />
      <div className="relative w-full max-w-sm">
        <Logo />
        <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-[#1e2d4a]">
            <h1 className="text-lg font-bold text-white">Sign in to your account</h1>
            <p className="text-xs text-slate-500 mt-1">Access to VYSITE is restricted to authorised users.</p>
          </div>
          <form onSubmit={handleSubmit} className="px-8 py-6 flex flex-col gap-4">
            {error && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">{error}</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg pl-9 pr-10 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="flex justify-end -mt-1">
              <button type="button"
                onClick={() => { setResetEmail(email); setView('forgot'); setError(null); }}
                className="text-xs text-slate-500 hover:text-[#f97316] transition-colors">
                Forgot password?
              </button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#f97316] hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-orange-900/30 mt-1">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-[11px] text-slate-600 mt-6">VYSITE &copy; {new Date().getFullYear()} — Authorised access only</p>
      </div>
    </div>
  );
}
