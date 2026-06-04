import { useState } from 'react';
import {
  Bell, Shield, Users, Globe,
  ChevronRight, ToggleLeft, ToggleRight, Save,
  Hash, CheckSquare, ArrowLeft, Eye, EyeOff, Lock, CheckCircle, AlertCircle,
  CreditCard, ExternalLink, Zap,
} from 'lucide-react';
import type { LucideIcon } from '../data/types';
import { useAppStore } from '../lib/StoreContext';
import { supabase } from '../lib/supabase';
import { useOrgSettings } from '../lib/OrgSettingsContext';
import type { DBSettings } from '../lib/store';

type ToggleKey =
  | 'snag_email' | 'action_email' | 'daily_digest' | 'overdue_alert'
  | 'form_submit' | 'report_ready' | 'comment_added' | 'tagged_user';

const defaultToggles: Record<ToggleKey, boolean> = {
  snag_email: true, action_email: true, daily_digest: false, overdue_alert: true,
  form_submit: false, report_ready: true, comment_added: true, tagged_user: true,
};

// ─── Saved banner ─────────────────────────────────────────────────────────────

function SavedBanner() {
  return <span className="text-xs text-emerald-400 font-semibold">Saved</span>;
}

// ─── Notification Settings ────────────────────────────────────────────────────

function NotificationSettings({ settings, onSave }: { settings: DBSettings; onSave: (s: DBSettings) => void }) {
  const merged = { ...defaultToggles, ...settings.notification_toggles };
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(merged as Record<ToggleKey, boolean>);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggle = (key: ToggleKey) => setToggles(t => ({ ...t, [key]: !t[key] }));

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...settings, notification_toggles: toggles });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const groups: { heading: string; items: { key: ToggleKey; label: string; desc: string }[] }[] = [
    {
      heading: 'Actions',
      items: [
        { key: 'action_email', label: 'Action Assigned', desc: 'Notify when an action is assigned to you' },
        { key: 'overdue_alert', label: 'Overdue Alerts', desc: 'Alert when actions or snags become overdue' },
      ],
    },
    {
      heading: 'Snags',
      items: [
        { key: 'snag_email', label: 'Snag Raised', desc: 'Notify when a snag is raised on your project' },
      ],
    },
    {
      heading: 'Forms & Reports',
      items: [
        { key: 'form_submit', label: 'Form Submitted', desc: 'Notification when site forms are submitted' },
        { key: 'report_ready', label: 'Report Ready', desc: 'Notify when generated reports are available' },
      ],
    },
    {
      heading: 'Comments & Mentions',
      items: [
        { key: 'comment_added', label: 'Comment Added', desc: 'Notify when a comment is added to a record you own' },
        { key: 'tagged_user', label: 'Tagged in Comment', desc: 'Alert when someone tags you using @username' },
      ],
    },
    {
      heading: 'Digest',
      items: [
        { key: 'daily_digest', label: 'Daily Digest', desc: 'Summary of all platform activity each morning' },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-white">Notification Preferences</h3>
        <p className="text-xs text-slate-500 mt-1">Control which operational alerts are sent. Notifications appear in the bell and optionally via email.</p>
      </div>
      {groups.map(group => (
        <div key={group.heading}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{group.heading}</p>
          <div className="divide-y divide-[#1e2d4a] bg-[#0d1628] rounded-xl border border-[#1e2d4a] overflow-hidden">
            {group.items.map(item => (
              <div key={item.key} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-medium text-slate-300">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
                <button onClick={() => toggle(item.key)} className="transition-colors shrink-0">
                  {toggles[item.key]
                    ? <ToggleRight size={28} className="text-[#f97316]" />
                    : <ToggleLeft size={28} className="text-slate-600" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
          <Save size={14} />{saving ? 'Saving…' : 'Save Preferences'}
        </button>
        {saved && <SavedBanner />}
      </div>
    </div>
  );
}

// ─── Operational Settings ─────────────────────────────────────────────────────

function OperationalSettings({ settings, onSave }: { settings: DBSettings; onSave: (s: DBSettings) => void }) {
  const [form, setForm] = useState({
    default_action_priority: settings.default_action_priority,
    default_snag_priority: settings.default_snag_priority,
    default_project_status: settings.default_project_status,
    rfi_number_prefix: settings.rfi_number_prefix,
    rfi_number_start: settings.rfi_number_start,
    snag_number_prefix: settings.snag_number_prefix,
    snag_number_start: settings.snag_number_start,
    action_number_prefix: settings.action_number_prefix,
    action_number_start: settings.action_number_start,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...settings, ...form });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const selCls = 'bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-[#f97316] shrink-0';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-white">Operational Settings</h3>
        <p className="text-xs text-slate-500 mt-1">Default values and numbering logic for operational workflows.</p>
      </div>

      {/* Defaults */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Default Priorities & Status</p>
        <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] divide-y divide-[#1e2d4a]">
          {[
            { label: 'Default Action Priority', desc: 'Pre-selected when creating new actions', key: 'default_action_priority' as const, options: ['High', 'Medium', 'Low'] },
            { label: 'Default Snag Priority', desc: 'Pre-selected when raising new snags', key: 'default_snag_priority' as const, options: ['Critical', 'High', 'Medium', 'Low'] },
            { label: 'Default Project Status', desc: 'Pre-selected when creating new projects', key: 'default_project_status' as const, options: ['Active', 'On Hold', 'Tender'] },
          ].map(row => (
            <div key={row.key} className="flex items-center justify-between px-4 py-3.5 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-300">{row.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{row.desc}</p>
              </div>
              <select value={form[row.key]} onChange={e => setForm(f => ({ ...f, [row.key]: e.target.value }))} className={selCls}>
                {row.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Numbering logic */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reference Numbering</p>
        <p className="text-xs text-slate-600 mb-3">Configure the prefix and starting number for auto-generated reference codes.</p>
        <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] divide-y divide-[#1e2d4a]">
          {[
            { label: 'RFI References', prefixKey: 'rfi_number_prefix' as const, startKey: 'rfi_number_start' as const },
            { label: 'Snag References', prefixKey: 'snag_number_prefix' as const, startKey: 'snag_number_start' as const },
            { label: 'Action References', prefixKey: 'action_number_prefix' as const, startKey: 'action_number_start' as const },
          ].map(row => (
            <div key={row.label} className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <Hash size={13} className="text-slate-600 shrink-0" />
                  <p className="text-sm font-medium text-slate-300">{row.label}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    value={form[row.prefixKey]}
                    onChange={e => setForm(f => ({ ...f, [row.prefixKey]: e.target.value }))}
                    className="w-16 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#f97316] text-center font-mono uppercase"
                    placeholder="RFI"
                    maxLength={8}
                  />
                  <span className="text-slate-600 text-xs">-</span>
                  <input
                    type="number"
                    min={1}
                    value={form[row.startKey]}
                    onChange={e => setForm(f => ({ ...f, [row.startKey]: parseInt(e.target.value) || 1 }))}
                    className="w-16 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#f97316] text-center"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-600 mt-1.5 ml-5">
                Next ref: <span className="font-mono text-slate-500">{form[row.prefixKey]}-{String(form[row.startKey]).padStart(3, '0')}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Status colour reference */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status Colour Reference</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'Critical / Overdue', color: 'bg-red-500', textColor: 'text-red-400' },
            { label: 'In Progress', color: 'bg-blue-500', textColor: 'text-blue-400' },
            { label: 'Complete / Closed', color: 'bg-emerald-500', textColor: 'text-emerald-400' },
            { label: 'Waiting / On Hold', color: 'bg-amber-500', textColor: 'text-amber-400' },
            { label: 'High Priority', color: 'bg-orange-500', textColor: 'text-orange-400' },
            { label: 'Low Priority', color: 'bg-slate-500', textColor: 'text-slate-400' },
          ].map(({ label, color, textColor }) => (
            <div key={label} className="flex items-center gap-3 bg-[#0d1628] rounded-lg px-3 py-2.5 border border-[#1e2d4a]">
              <div className={`w-3 h-3 rounded-full ${color} shrink-0`} />
              <span className={`text-xs font-medium ${textColor}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
          <Save size={14} />{saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <SavedBanner />}
      </div>
    </div>
  );
}

// ─── Change Password ──────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (next !== confirm) { setError('New passwords do not match.'); return; }

    setSaving(true);

    // Re-authenticate with current password first to verify identity
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setError('Unable to verify your session. Please sign out and back in.'); setSaving(false); return; }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });

    if (signInErr) {
      setError('Current password is incorrect.');
      setSaving(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: next });
    setSaving(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setSuccess(true);
    setCurrent(''); setNext(''); setConfirm('');
    setTimeout(() => setSuccess(false), 4000);
  }

  const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg pl-9 pr-10 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors';

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-white">Change Password</h3>
        <p className="text-xs text-slate-500 mt-1">Update your account password. You'll need to enter your current password to confirm.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 leading-relaxed">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-emerald-900/20 border border-emerald-800/40">
            <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-300">Password updated successfully.</p>
          </div>
        )}

        <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] divide-y divide-[#1e2d4a] overflow-hidden">
          {[
            { label: 'Current password', value: current, set: setCurrent, show: showCurrent, toggle: () => setShowCurrent(v => !v), autoComplete: 'current-password' },
            { label: 'New password', value: next, set: setNext, show: showNext, toggle: () => setShowNext(v => !v), autoComplete: 'new-password' },
            { label: 'Confirm new password', value: confirm, set: setConfirm, show: showConfirm, toggle: () => setShowConfirm(v => !v), autoComplete: 'new-password' },
          ].map(field => (
            <div key={field.label} className="px-4 py-3.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">{field.label}</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type={field.show ? 'text' : 'password'}
                  autoComplete={field.autoComplete}
                  required
                  value={field.value}
                  onChange={e => field.set(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
                <button type="button" onClick={field.toggle} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {field.show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
            <Save size={14} />{saving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Billing Section ──────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  business: 'Business',
};

const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-sky-900/40 text-sky-300 border-sky-700/50',
  professional: 'bg-[#f97316]/20 text-orange-300 border-orange-700/40',
  business: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
};

function BillingSection() {
  const { orgSettings } = useOrgSettings();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [selecting, setSelecting] = useState<string | null>(null);

  const isPaid = orgSettings.account_type === 'paid';
  const planName = orgSettings.plan_name;
  const status = orgSettings.subscription_status;
  const periodEnd = orgSettings.current_period_end
    ? new Date(orgSettings.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  async function openPortal() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ return_url: window.location.origin }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setPortalError(json.error ?? 'Unable to open billing portal.');
        setPortalLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setPortalError('Network error — please try again.');
      setPortalLoading(false);
    }
  }

  async function startCheckout(plan: string) {
    setSelecting(plan);
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ plan, interval: billingInterval }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setCheckoutError(json.error ?? 'Unable to start checkout.');
        setCheckoutLoading(false);
        setSelecting(null);
        return;
      }
      window.location.href = json.url;
    } catch {
      setCheckoutError('Network error — please try again.');
      setCheckoutLoading(false);
      setSelecting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-white">Billing & Subscription</h3>
        <p className="text-xs text-slate-500 mt-1">Manage your VYSITE subscription, payment method, and billing details.</p>
      </div>

      {/* Current plan */}
      <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] divide-y divide-[#1e2d4a]">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Plan</p>
            {isPaid && planName ? (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${PLAN_COLORS[planName] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                <Zap size={10} />
                {PLAN_LABELS[planName] ?? planName}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-900/30 text-amber-300 border-amber-700/40">
                Trial
              </span>
            )}
          </div>
          {isPaid && (
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Billing</p>
              <p className="text-xs text-slate-300 capitalize">{orgSettings.billing_interval ?? '—'}</p>
            </div>
          )}
        </div>

        {isPaid && periodEnd && (
          <div className="px-4 py-3.5 flex items-center justify-between">
            <p className="text-sm text-slate-400">Next renewal</p>
            <p className="text-sm text-slate-200 font-medium">{periodEnd}</p>
          </div>
        )}

        {isPaid && status && status !== 'active' && (
          <div className="px-4 py-3.5">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-700/40">
              <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                {status === 'past_due'
                  ? 'Your last payment failed. Please update your payment method to avoid losing access.'
                  : status === 'canceled'
                  ? 'Your subscription has been cancelled.'
                  : `Subscription status: ${status}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Manage billing (paid users) */}
      {isPaid && orgSettings.stripe_customer_id && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Manage Billing</p>
          <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] px-4 py-4">
            <p className="text-sm text-slate-300 mb-3 leading-relaxed">
              Update your payment method, view invoices, or cancel your subscription through the secure Stripe customer portal.
            </p>
            {portalError && (
              <p className="text-xs text-red-400 mb-3">{portalError}</p>
            )}
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1a2236] border border-[#1e2d4a] hover:border-[#f97316] text-slate-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            >
              <CreditCard size={14} />
              {portalLoading ? 'Opening…' : 'Manage Billing'}
              <ExternalLink size={12} className="text-slate-500 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Upgrade / subscribe (trial or non-paid users) */}
      {!isPaid && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Subscribe</p>

          {/* Interval toggle */}
          <div className="flex items-center gap-3 mb-4">
            <span className={`text-sm font-medium ${billingInterval === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
            <button
              onClick={() => setBillingInterval(i => i === 'monthly' ? 'annual' : 'monthly')}
              className={`relative w-11 h-6 rounded-full transition-colors ${billingInterval === 'annual' ? 'bg-[#f97316]' : 'bg-[#1e2d4a]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${billingInterval === 'annual' ? 'translate-x-5' : ''}`} />
            </button>
            <span className={`text-sm font-medium ${billingInterval === 'annual' ? 'text-white' : 'text-slate-500'}`}>
              Annual <span className="text-emerald-400 text-xs font-bold ml-1">Save 20%</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'starter', name: 'Starter', desc: 'Core modules for small teams' },
              { id: 'professional', name: 'Professional', desc: 'AI features + priority support', popular: true },
              { id: 'business', name: 'Business', desc: 'Full access + Commercial Module' },
            ].map(plan => (
              <div key={plan.id} className={`relative rounded-xl border p-4 ${plan.popular ? 'border-[#f97316] bg-orange-950/10' : 'border-[#1e2d4a] bg-[#0d1628]'}`}>
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#f97316] text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                    Popular
                  </div>
                )}
                <p className="text-sm font-bold text-white mb-0.5">{plan.name}</p>
                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">{plan.desc}</p>
                <button
                  onClick={() => startCheckout(plan.id)}
                  disabled={checkoutLoading}
                  className={`w-full py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-60 ${
                    plan.popular
                      ? 'bg-[#f97316] hover:bg-orange-400 text-white'
                      : 'bg-[#1a2236] border border-[#1e2d4a] hover:border-[#f97316] text-slate-200'
                  }`}
                >
                  {checkoutLoading && selecting === plan.id ? 'Redirecting…' : `Subscribe`}
                </button>
              </div>
            ))}
          </div>

          {checkoutError && (
            <p className="text-xs text-red-400 mt-3">{checkoutError}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <div className="py-12 text-center">
      <div className="w-14 h-14 bg-[#0d1628] rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icon size={24} className="text-slate-600" />
      </div>
      <p className="text-slate-300 font-semibold">{title}</p>
      <p className="text-sm text-slate-500 mt-1.5 max-w-xs mx-auto">This settings section will be available in a future release.</p>
    </div>
  );
}

// ─── Settings navigation items ────────────────────────────────────────────────

const settingsSections = [
  { id: 'notifications', title: 'Notifications',        description: 'Operational alerts and preference controls',   icon: Bell,        color: 'bg-amber-900/60 text-amber-400' },
  { id: 'operational',   title: 'Operational Settings', description: 'Defaults, priorities and numbering logic',     icon: CheckSquare, color: 'bg-emerald-900/60 text-emerald-400' },
  { id: 'billing',       title: 'Billing',              description: 'Subscription, plan and payment management',    icon: CreditCard,  color: 'bg-sky-900/60 text-sky-400' },
  { id: 'users',         title: 'User Management',      description: 'Roles, permissions and access control',       icon: Users,       color: 'bg-teal-900/60 text-teal-400' },
  { id: 'security',      title: 'Security',             description: 'Password policy, 2FA and session control',    icon: Shield,      color: 'bg-red-900/60 text-red-400' },
  { id: 'integrations',  title: 'Integrations',         description: 'Connect to third-party tools and services',  icon: Globe,       color: 'bg-slate-700 text-slate-400' },
] as const;

type SectionId = typeof settingsSections[number]['id'];

// ─── Main Settings page ───────────────────────────────────────────────────────

export default function Settings() {
  const store = useAppStore();
  const isAdmin = store.currentUser?.role === 'Admin';
  const [activeSection, setActiveSection] = useState<SectionId | null>('notifications');

  const handleSave = async (updated: DBSettings) => {
    await store.updateSettings(updated);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'notifications': return <NotificationSettings settings={store.settings} onSave={handleSave} />;
      case 'operational':   return <OperationalSettings settings={store.settings} onSave={handleSave} />;
      case 'billing':       return <BillingSection />;
      case 'users':         return <ComingSoon title="User Management" icon={Users} />;
      case 'security':      return <ChangePasswordSection />;
      case 'integrations':  return <ComingSoon title="Integrations" icon={Globe} />;
      default:              return null;
    }
  };

  const activeLabel = settingsSections.find(s => s.id === activeSection)?.title;

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Settings</h2>
        <p className="text-sm text-slate-500">
          Configure your VYSITE workspace
          {!isAdmin && <span className="ml-1 text-amber-500">— read only (Admin access required to save changes)</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation — hidden on mobile when a section is active */}
        <div className={`space-y-2 ${activeSection ? 'hidden lg:block' : 'block'}`}>
          {settingsSections.map(section => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  isActive ? 'border-[#f97316] bg-orange-950/30' : 'border-[#1e2d4a] bg-[#1a2236] hover:border-[#2a3d5a]'
                }`}>
                <div className={`w-9 h-9 rounded-xl ${section.color} flex items-center justify-center shrink-0`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? 'text-[#f97316]' : 'text-slate-300'}`}>{section.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{section.description}</p>
                </div>
                <ChevronRight size={15} className={`shrink-0 transition-transform ${isActive ? 'rotate-90 text-[#f97316]' : 'text-slate-600'}`} />
              </button>
            );
          })}
        </div>

        {/* Content panel */}
        <div className={`lg:col-span-2 ${activeSection ? 'block' : 'hidden lg:block'}`}>
          {activeSection ? (
            <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5 lg:p-6">
              {/* Mobile back button */}
              <button
                onClick={() => setActiveSection(null)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-5 lg:hidden">
                <ArrowLeft size={13} />{activeLabel}
              </button>
              {renderContent()}
            </div>
          ) : (
            <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-12 text-center hidden lg:flex flex-col items-center justify-center">
              <div className="w-14 h-14 bg-amber-950/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bell size={24} className="text-amber-400" />
              </div>
              <h3 className="font-semibold text-slate-300 mb-1">Select a settings category</h3>
              <p className="text-sm text-slate-500">Choose from the menu on the left to configure your workspace</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
