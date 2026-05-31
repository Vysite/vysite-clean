import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function SetPassword() {
  const { updatePassword, user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = getStrength(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: err } = await updatePassword(password);
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center px-4">
        <div className="relative w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#f97316] flex items-center justify-center font-black text-white text-2xl select-none shadow-lg shadow-orange-900/40">V</div>
              <div>
                <span className="text-xl font-black text-white tracking-tight">VY</span>
                <span className="text-xl font-black text-[#f97316] tracking-tight">SITE</span>
              </div>
            </div>
          </div>
          <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white mb-1">Password set successfully</h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                You're now signed in as <span className="text-slate-200">{user?.email}</span>. VYSITE is loading your account…
              </p>
            </div>
            <div className="w-5 h-5 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin mt-2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#f97316]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-900/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#f97316] flex items-center justify-center font-black text-white text-2xl select-none shadow-lg shadow-orange-900/40">V</div>
            <div>
              <span className="text-xl font-black text-white tracking-tight">VY</span>
              <span className="text-xl font-black text-[#f97316] tracking-tight">SITE</span>
            </div>
          </div>
        </div>

        <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-[#1e2d4a]">
            <h1 className="text-lg font-bold text-white">Set your password</h1>
            <p className="text-xs text-slate-500 mt-1">
              Welcome to VYSITE. Choose a secure password to activate your account.
            </p>
            {user?.email && (
              <p className="text-xs text-[#f97316] mt-2 font-medium">{user.email}</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 flex flex-col gap-4">
            {error && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg pl-9 pr-10 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {password.length > 0 && (
                <StrengthBar strength={strength} />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirm password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg pl-9 pr-10 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {confirm.length > 0 && password !== confirm && (
                <p className="text-[11px] text-red-400">Passwords do not match</p>
              )}
              {confirm.length > 0 && password === confirm && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={11} /> Passwords match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || password !== confirm || password.length < 8}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#f97316] hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-orange-900/30 mt-1"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Setting password…
                </span>
              ) : 'Set Password & Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          VYSITE &copy; {new Date().getFullYear()} — Authorised access only
        </p>
      </div>
    </div>
  );
}

function getStrength(password: string): 'weak' | 'fair' | 'strong' {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return 'weak';
  if (score <= 3) return 'fair';
  return 'strong';
}

function StrengthBar({ strength }: { strength: 'weak' | 'fair' | 'strong' }) {
  const bars = [
    { active: true },
    { active: strength === 'fair' || strength === 'strong' },
    { active: strength === 'strong' },
  ];
  const color = strength === 'weak' ? 'bg-red-500' : strength === 'fair' ? 'bg-amber-400' : 'bg-emerald-500';
  const label = strength === 'weak' ? 'Weak' : strength === 'fair' ? 'Fair' : 'Strong';
  const labelColor = strength === 'weak' ? 'text-red-400' : strength === 'fair' ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex gap-1 flex-1">
        {bars.map((b, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${b.active ? color : 'bg-slate-700'}`} />
        ))}
      </div>
      <span className={`text-[11px] font-medium ${labelColor}`}>{label}</span>
    </div>
  );
}
