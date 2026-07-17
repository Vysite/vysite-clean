import { useState, type FormEvent } from 'react';
import {
  FlaskConical, CheckCircle, AlertCircle, ArrowRight, Layers,
  BarChart2, ClipboardList, Wrench, Zap, Shield,
} from 'lucide-react';
import { env } from '../lib/env';

const FEATURES = [
  { icon: <Layers size={14} />,      label: 'Tender & Estimating' },
  { icon: <BarChart2 size={14} />,   label: 'Projects & Programmes' },
  { icon: <Zap size={14} />,         label: 'AI Contract Review' },
  { icon: <ClipboardList size={14} />, label: 'Site Forms & Snagging' },
  { icon: <Wrench size={14} />,      label: 'Maintenance & Servicing' },
  { icon: <Shield size={14} />,      label: 'Actions & Testing' },
];

export default function StartTrial() {
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName]     = useState('');
  const [adminEmail, setAdminEmail]   = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(
        `${env.supabaseUrl}/functions/v1/provision-trial-org`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Authorization is required by Supabase when verify_jwt is true.
            // The anon key is a valid public JWT — safe to send from the browser.
            // Apikey is kept as a belt-and-suspenders fallback for older requests.
            'Authorization': `Bearer ${env.supabaseAnonKey}`,
            'Apikey': env.supabaseAnonKey,
          },
          body: JSON.stringify({
            companyName: companyName.trim(),
            adminName: adminName.trim(),
            adminEmail: adminEmail.trim().toLowerCase(),
            trialDays: 14,
            source: 'website',
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? json.message ?? 'Something went wrong. Please try again or contact hello@vysite.com.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col">
      {/* Background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -right-60 w-[700px] h-[700px] rounded-full bg-sky-900/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#f97316]/5 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[#1e2d4a]/60">
        <a href="/" className="flex items-center group">
          <img
            src="/ChatGPT_Image_Jun_1,_2026,_07_35_12_PM.png"
            alt="VYSITE"
            className="h-[108px] w-auto object-contain transition-opacity group-hover:opacity-80"
            style={{ mixBlendMode: 'lighten' }}
          />
        </a>
        <a
          href="/"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Already have an account? Sign in
        </a>
      </nav>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          {success ? (
            /* ── Success state ── */
            <div className="max-w-md mx-auto text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-900/40 border border-emerald-800/50 flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <h1 className="text-2xl font-black text-white mb-3">You're in.</h1>
              <p className="text-slate-400 leading-relaxed mb-2">
                Your VYSITE trial has been created for <span className="text-white font-semibold">{companyName}</span>.
              </p>
              <p className="text-slate-400 leading-relaxed mb-6">
                We've sent an invite to <span className="text-white font-semibold">{adminEmail}</span>.
                Click the link in that email to set your password and access your account.
              </p>
              <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-4 text-left space-y-2 mb-6">
                {[
                  'Check your inbox for the invite email',
                  'Click the link to set your password',
                  'Sign in and explore all modules — no restrictions',
                  '14-day trial, no card required',
                ].map((step, i) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#f97316] flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-300">{step}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-600">
                Questions? Email us at{' '}
                <a href="mailto:hello@vysite.com" className="text-[#f97316] hover:underline">hello@vysite.com</a>
              </p>
            </div>
          ) : (
            /* ── Form state ── */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
              {/* Left — pitch */}
              <div className="pt-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-900/40 border border-sky-800/50 rounded-full mb-6">
                  <FlaskConical size={12} className="text-sky-400" />
                  <span className="text-xs font-semibold text-sky-300">14-day free trial · No card required</span>
                </div>
                <h1 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
                  Try
                  <img
                    src="/ChatGPT_Image_Jun_1,_2026,_07_35_12_PM.png"
                    alt="VYSITE"
                    className="inline-block align-middle object-contain mx-2"
                    style={{ height: '1.65em', mixBlendMode: 'lighten' }}
                  />
                  free<br />
                  <span className="text-[#f97316]">for 14 days</span>
                </h1>
                <p className="text-slate-400 text-base leading-relaxed mb-8">
                  Get instant access to the complete VYSITE platform — tender management, AI contract review, snagging, site forms, and more. Set up takes under two minutes.
                </p>

                <div className="space-y-2.5 mb-8">
                  {FEATURES.map(f => (
                    <div key={f.label} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center text-[#f97316] shrink-0">
                        {f.icon}
                      </div>
                      <span className="text-sm text-slate-300">{f.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-3 p-4 bg-[#1a2236] border border-[#1e2d4a] rounded-xl">
                  <Shield size={16} className="text-slate-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Your data is isolated to your own organisation. All modules are enabled by default. No commitment required — cancel any time.
                  </p>
                </div>
              </div>

              {/* Right — form */}
              <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl overflow-hidden">
                <div className="px-7 pt-7 pb-5 border-b border-[#1e2d4a]">
                  <h2 className="text-lg font-bold text-white">Start your free trial</h2>
                  <p className="text-xs text-slate-500 mt-1">You'll receive an invite email to set your password.</p>
                </div>

                <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
                  {error && (
                    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
                      <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300 leading-relaxed">{error}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Company Name
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="Acme Construction Ltd"
                      className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={adminName}
                      onChange={e => setAdminName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Work Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="jane@acme.com"
                      className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !companyName.trim() || !adminName.trim() || !adminEmail.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#f97316] hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg shadow-orange-900/30 mt-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Setting up your trial…
                      </>
                    ) : (
                      <>
                        Start Free Trial <ArrowRight size={15} />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[11px] text-slate-600 leading-relaxed">
                    By starting a trial you agree to VYSITE's terms of service.
                    Your data is securely isolated and never shared.
                  </p>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="relative z-10 text-center py-4 border-t border-[#1e2d4a]/40">
        <p className="text-[11px] text-slate-700">
          VYSITE &copy; {new Date().getFullYear()} &mdash; Authorised access only &mdash;{' '}
          <a href="mailto:hello@vysite.com" className="hover:text-slate-500 transition-colors">hello@vysite.com</a>
        </p>
      </footer>
    </div>
  );
}
