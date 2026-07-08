import { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Shield, Building2, ChevronRight, ChevronLeft, ToggleLeft, ToggleRight,
  Save, AlertCircle, CheckCircle, RefreshCw, UserPlus, Trash2, Ban, Search,
  FlaskConical, X, Clock, Archive, RotateCcw, AlertTriangle, ChevronDown,
  Upload, Mail, Phone, Globe, Hash, Send, Zap, Plus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { env } from '../lib/env';
import { useAuth } from '../lib/AuthContext';
import SuperAdminAIBilling from './SuperAdminAIBilling';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  status: 'active' | 'archived' | 'deleted';
  archived_at: string | null;
  deleted_at: string | null;
}

interface OrgSettings {
  org_id: string;
  account_status: 'active' | 'disabled';
  account_type: 'trial' | 'paid' | 'internal';
  trial_expires_at: string | null;
  modules_enabled: Record<string, boolean>;
  ai_enabled: boolean;
  ai_monthly_limit: number;
  ai_used_this_month: number;
  ai_bonus_credits: number;
  user_limit: number | null;
  updated_at: string;
  updated_by: string;
  // Free access override
  free_access_enabled?: boolean;
  free_access_enabled_at?: string | null;
  free_access_enabled_by?: string | null;
}

interface OrgWithSettings extends OrgRow {
  settings: OrgSettings | null;
  userCount: number;
}

interface SuperAdminRow {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  status: 'active' | 'disabled';
  created_at: string;
}

// ─── Module config — mirrors the main sidebar ─────────────────────────────────

const MODULES = [
  { key: 'tenders',     label: 'Tender & Estimating' },
  { key: 'projects',    label: 'Projects' },
  { key: 'commercial',  label: 'Commercial' },
  { key: 'maintenance', label: 'Maintenance & Servicing' },
  { key: 'site-forms',  label: 'Site Forms' },
  { key: 'snagging',    label: 'Snagging' },
  { key: 'actions',     label: 'Actions Tracker' },
  { key: 'testing',     label: 'O&M Manual' },
  { key: 'reports',     label: 'Reports' },
];

const DEFAULT_MODULES: Record<string, boolean> = {
  ...Object.fromEntries(MODULES.map(m => [m.key, true])),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeModules(stored: Record<string, boolean> | null): Record<string, boolean> {
  return { ...DEFAULT_MODULES, ...(stored ?? {}) };
}

function trialDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function TrialBadge({ expiresAt }: { expiresAt: string | null }) {
  const days = trialDaysRemaining(expiresAt);
  const expired = days !== null && days <= 0;
  const warning = days !== null && days <= 3 && !expired;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
      expired
        ? 'bg-red-900/60 text-red-400'
        : warning
        ? 'bg-amber-900/60 text-amber-400'
        : 'bg-sky-900/60 text-sky-400'
    }`}>
      <FlaskConical size={9} />
      {expired
        ? 'EXPIRED'
        : days === null
        ? 'TRIAL'
        : `TRIAL · ${days}d`}
    </span>
  );
}

// ─── Status badge for org lifecycle ──────────────────────────────────────────

function OrgStatusBadge({ status }: { status: OrgRow['status'] }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Active
      </span>
    );
  }
  if (status === 'archived') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Archived
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-900/60 text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />Deleted
    </span>
  );
}

// ─── Typed-name delete confirmation modal ─────────────────────────────────────

function ConfirmDeleteOrgModal({
  org,
  onConfirm,
  onCancel,
}: {
  org: OrgWithSettings;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const isMatch = typed === org.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0d1628] border border-red-900/60 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-[#1e2d4a]">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-red-900/30 border border-red-800/40 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white">Permanently delete organisation</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                This will <span className="text-red-400 font-semibold">permanently delete all data</span> for{' '}
                <span className="text-white font-semibold">{org.name}</span> including all projects, tenders, users, and records.
                This action <span className="text-red-400 font-semibold">cannot be undone</span>.
              </p>
            </div>
            <button onClick={onCancel} className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {org.userCount > 0 && (
          <div className="mx-6 mt-4 px-3.5 py-2.5 rounded-lg bg-red-900/20 border border-red-800/40">
            <p className="text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle size={12} className="shrink-0" />
              This organisation has <strong className="text-red-200">{org.userCount} active user{org.userCount !== 1 ? 's' : ''}</strong> who will lose all access.
            </p>
          </div>
        )}

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Type the organisation name to confirm
            </label>
            <div className="text-sm text-slate-300 font-mono bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 mb-3 select-all">
              {org.name}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={`Type "${org.name}" to confirm`}
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-slate-500 transition-colors"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#1e2d4a] text-slate-400 hover:text-white text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { if (isMatch) onConfirm(); }}
              disabled={!isMatch}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-red-900/40 disabled:text-red-700 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
            >
              <Trash2 size={14} />
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New Trial Modal ──────────────────────────────────────────────────────────

interface NewTrialModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function NewTrialModal({ onClose, onCreated }: NewTrialModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName]     = useState('');
  const [adminEmail, setAdminEmail]   = useState('');
  const [trialDays, setTrialDays]     = useState(14);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const res = await fetch(
        `${env.supabaseUrl}/functions/v1/provision-trial-org`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            companyName: companyName.trim(),
            adminName: adminName.trim(),
            adminEmail: adminEmail.trim().toLowerCase(),
            trialDays,
            source: 'super-admin',
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Provisioning failed. Please try again.');
      } else {
        setSuccess(`Trial created for ${json.orgName}. Invite email sent to ${adminEmail.trim().toLowerCase()}.`);
        setTimeout(() => {
          onCreated();
          onClose();
        }, 2500);
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d4a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-900/50 border border-sky-800/50 flex items-center justify-center">
              <FlaskConical size={15} className="text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">New Trial Organisation</h2>
              <p className="text-[11px] text-slate-500">Creates company, admin user, and sends invite</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-relaxed">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-emerald-900/20 border border-emerald-800/40">
              <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300 leading-relaxed">{success}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Company Name</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Acme Construction Ltd"
              className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Admin Full Name</label>
              <input
                type="text"
                required
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Trial Duration</label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={90}
                  required
                  value={trialDays}
                  onChange={e => setTrialDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 14)))}
                  className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 pr-12 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">days</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Admin Email Address</label>
            <input
              type="email"
              required
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              placeholder="jane@acme.com"
              className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
            />
          </div>

          {/* Summary */}
          {companyName.trim() && adminEmail.trim() && (
            <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg p-3 space-y-1">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2">This will:</p>
              {[
                `Create organisation: ${companyName.trim()}`,
                `Create admin user: ${adminName.trim() || '—'} (${adminEmail.trim()})`,
                `Enable all 8 modules`,
                `Set trial expiry: ${trialDays} days from now`,
                `Send invite email to ${adminEmail.trim()}`,
                `Notify hello@vysite.com`,
              ].map(line => (
                <div key={line} className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-sky-500 shrink-0" />
                  <p className="text-[11px] text-slate-400">{line}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-[#1e2d4a] text-slate-400 hover:text-white rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !!success || !companyName.trim() || !adminName.trim() || !adminEmail.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <FlaskConical size={14} />}
              {submitting ? 'Provisioning…' : 'Create Trial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Subscription status label ────────────────────────────────────────────────

function getSubLabel(s: OrgSettings | null): 'free_access' | 'trial_active' | 'trial_expired' | 'active_sub' | 'suspended' | 'none' {
  if (s?.free_access_enabled) return 'free_access';
  if (s?.account_status === 'disabled') return 'suspended';
  if (s?.account_type === 'trial') {
    const expired = s.trial_expires_at && new Date(s.trial_expires_at) < new Date();
    return expired ? 'trial_expired' : 'trial_active';
  }
  if (s?.account_type === 'paid' || s?.account_type === 'internal') return 'active_sub';
  return 'none';
}

function SubStatusBadge({ settings }: { settings: OrgSettings | null }) {
  const label = getSubLabel(settings);
  if (label === 'free_access') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-900/50 text-violet-300 border border-violet-700/50">
      <Zap size={9} />Free Access
    </span>
  );
  if (label === 'active_sub') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Active Sub
    </span>
  );
  if (label === 'trial_active') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-900/60 text-sky-400">
      <Clock size={9} />Trial Active
    </span>
  );
  if (label === 'trial_expired') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Trial Expired
    </span>
  );
  if (label === 'suspended') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-900/60 text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />Suspended
    </span>
  );
  return null;
}

// ─── Subscription Override Section (embedded in ManagePanel) ──────────────────

function SubscriptionOverrideSection({
  orgId,
  settings,
  onSaved,
}: {
  orgId: string;
  settings: OrgSettings | null;
  onSaved: (updated: Partial<OrgSettings>) => void;
}) {
  const [extendDays, setExtendDays] = useState<number>(14);
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendMsg, setExtendMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [freeAccess, setFreeAccess] = useState<boolean>(settings?.free_access_enabled ?? false);
  const [freeLoading, setFreeLoading] = useState(false);
  const [freeMsg, setFreeMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Mirror settings changes from parent (e.g. after a loadOrgs refresh)
  useEffect(() => {
    setFreeAccess(settings?.free_access_enabled ?? false);
  }, [settings?.free_access_enabled]);

  const currentExpiry = settings?.trial_expires_at ?? null;

  async function handleExtend() {
    if (extendDays < 1) return;
    setExtendLoading(true);
    setExtendMsg(null);

    const base = currentExpiry ? new Date(currentExpiry) : new Date();
    if (base < new Date()) base.setTime(Date.now());
    const newExpiry = new Date(base.getTime() + extendDays * 86400000).toISOString();

    const { error } = await supabase
      .from('org_settings')
      .update({
        trial_expires_at: newExpiry,
        account_type: 'trial',
        account_status: 'active',
        updated_by: 'super-admin:extend-trial',
      })
      .eq('org_id', orgId);

    if (error) {
      setExtendMsg({ type: 'err', text: error.message });
    } else {
      setExtendMsg({ type: 'ok', text: `Trial extended to ${new Date(newExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` });
      onSaved({ trial_expires_at: newExpiry, account_type: 'trial', account_status: 'active' });
    }
    setExtendLoading(false);
  }

  async function handleToggleFreeAccess() {
    const enabling = !freeAccess;
    setFreeLoading(true);
    setFreeMsg(null);

    const now = new Date().toISOString();
    const patch = enabling
      ? { free_access_enabled: true, free_access_enabled_at: now, free_access_enabled_by: 'super-admin', updated_by: 'super-admin:free-access-on' }
      : { free_access_enabled: false, free_access_enabled_at: null, free_access_enabled_by: null, updated_by: 'super-admin:free-access-off' };

    const { error } = await supabase.from('org_settings').update(patch).eq('org_id', orgId);

    if (error) {
      setFreeMsg({ type: 'err', text: error.message });
    } else {
      setFreeAccess(enabling);
      setFreeMsg({ type: 'ok', text: enabling ? 'Free access override enabled.' : 'Free access override removed.' });
      onSaved(patch);
    }
    setFreeLoading(false);
  }

  const isOverrideActive = freeAccess;

  return (
    <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5 lg:col-span-2">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
        <Shield size={12} />Subscription Override
      </h3>
      <p className="text-[11px] text-slate-600 mb-4">Admin-only controls. Free Access bypasses all trial/subscription checks entirely.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Current status ── */}
        <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] p-3 space-y-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Current Status</p>
          <div className="flex flex-wrap gap-2 items-center">
            <SubStatusBadge settings={settings ? { ...settings, free_access_enabled: freeAccess } : null} />
            {settings?.account_type && (
              <span className="text-[10px] text-slate-500 capitalize">{settings.account_type}</span>
            )}
          </div>
          {currentExpiry && (
            <p className={`text-[11px] flex items-center gap-1 ${new Date(currentExpiry) < new Date() ? 'text-red-400' : 'text-slate-500'}`}>
              <Clock size={9} />
              Trial expiry: {new Date(currentExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
          {isOverrideActive && settings?.free_access_enabled_at && (
            <p className="text-[11px] text-violet-400 flex items-center gap-1">
              <Zap size={9} />
              Active since {new Date(settings.free_access_enabled_at).toLocaleDateString('en-GB')}
            </p>
          )}
        </div>

        {/* ── Free Access toggle ── */}
        <div className={`rounded-lg border p-3 transition-colors ${isOverrideActive ? 'bg-violet-900/15 border-violet-700/50' : 'bg-[#0d1628] border-[#1e2d4a]'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Zap size={12} className={isOverrideActive ? 'text-violet-300' : 'text-slate-500'} />
                Free Access Override
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Bypasses trial, subscription, and account_status checks. For internal orgs, beta testers, and partners.
              </p>
            </div>
            <button
              onClick={handleToggleFreeAccess}
              disabled={freeLoading}
              className="shrink-0 mt-0.5"
              aria-label={isOverrideActive ? 'Disable free access' : 'Enable free access'}
            >
              {isOverrideActive
                ? <ToggleRight size={28} className="text-violet-400" />
                : <ToggleLeft size={28} className="text-slate-600" />}
            </button>
          </div>
          {isOverrideActive && (
            <div className="mt-2 px-2.5 py-1.5 rounded bg-violet-900/30 border border-violet-800/40">
              <p className="text-[10px] font-semibold text-violet-300">Free Access Active</p>
              {settings?.free_access_enabled_at && (
                <p className="text-[10px] text-violet-400/70 mt-0.5">
                  Enabled {new Date(settings.free_access_enabled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {settings.free_access_enabled_by ? ` · ${settings.free_access_enabled_by}` : ''}
                </p>
              )}
            </div>
          )}
          {freeMsg && (
            <p className={`text-[11px] mt-2 ${freeMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{freeMsg.text}</p>
          )}
        </div>

        {/* ── Extend Trial ── */}
        <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] p-3 lg:col-span-2">
          <p className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
            <Plus size={12} className="text-sky-400" />Extend Trial
          </p>
          <p className="text-[11px] text-slate-500 mb-3">
            Moves trial expiry forward from today or the current expiry date, whichever is later. Also resets account to Active Trial.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {[7, 14, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setExtendDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  extendDays === d
                    ? 'bg-sky-700 border-sky-600 text-white'
                    : 'bg-[#1a2236] border-[#1e2d4a] text-slate-400 hover:text-white hover:border-[#2e3d5a]'
                }`}
              >
                +{d}d
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={365}
                value={extendDays}
                onChange={e => setExtendDays(Math.max(1, Math.min(365, Number(e.target.value))))}
                className="w-16 text-center bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-600 transition-colors"
              />
              <span className="text-[11px] text-slate-500">days</span>
            </div>
            <button
              onClick={handleExtend}
              disabled={extendLoading || isOverrideActive}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-700 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors"
            >
              {extendLoading
                ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Extending…</>
                : <><Plus size={12} />Extend +{extendDays}d</>}
            </button>
          </div>
          {isOverrideActive && (
            <p className="text-[11px] text-slate-600 mt-2">Trial extension not needed — Free Access override is active.</p>
          )}
          {extendMsg && (
            <p className={`text-[11px] mt-2 ${extendMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{extendMsg.text}</p>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Company list row ─────────────────────────────────────────────────────────

function CompanyRow({
  org,
  onManage,
  onArchive,
  onRestore,
  onDelete,
  onResendInvite,
  actionLoading,
}: {
  org: OrgWithSettings;
  onManage: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onResendInvite: () => void;
  actionLoading: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const s = org.settings;
  const isTrial  = s?.account_type === 'trial';
  const aiOn = s?.ai_enabled ?? true;
  const limit = s?.ai_monthly_limit ?? 50;
  const used = s?.ai_used_this_month ?? 0;
  const bonus = s?.ai_bonus_credits ?? 0;
  const userLimit = s?.user_limit ?? null;
  const atUserLimit = userLimit !== null && org.userCount >= userLimit;

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(t) &&
        triggerRef.current && !triggerRef.current.contains(t)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  function openMenu() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < menuHeight + 8;

    setMenuStyle({
      position: 'fixed',
      right: window.innerWidth - rect.right,
      width: 220,
      zIndex: 9999,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
    setMenuOpen(v => !v);
  }

  return (
    <div className="grid grid-cols-[1fr_140px_1fr_80px_150px_110px_110px] gap-3 items-center px-4 py-3 border-b border-[#1e2d4a] hover:bg-[#0d1628]/40 transition-colors">
      {/* Company */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${org.status === 'archived' ? 'text-slate-400' : 'text-white'}`}>{org.name}</p>
          {isTrial && <TrialBadge expiresAt={s?.trial_expires_at ?? null} />}
          {s?.free_access_enabled && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-900/50 text-violet-300 border border-violet-700/50">
              <Zap size={8} />Free
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500">{org.slug}</p>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <OrgStatusBadge status={org.status} />
        {org.status === 'archived' && org.archived_at && (
          <span className="text-[10px] text-slate-600">
            {new Date(org.archived_at).toLocaleDateString('en-GB')}
          </span>
        )}
      </div>

      {/* Modules */}
      <div className="flex flex-wrap gap-1">
        {MODULES.map(m => {
          const on = s ? (mergeModules(s.modules_enabled)[m.key] ?? true) : true;
          return on ? (
            <span key={m.key} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2d4a] text-slate-400">{m.label}</span>
          ) : (
            <span key={m.key} className="text-[10px] px-1.5 py-0.5 rounded bg-[#0d1628] text-slate-700 line-through">{m.label}</span>
          );
        })}
      </div>

      {/* AI */}
      <div>
        <span className={`text-[11px] font-semibold ${aiOn ? 'text-[#f97316]' : 'text-slate-600'}`}>
          {aiOn ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* AI usage */}
      <div className="text-[11px] text-slate-400">
        <span className="text-white font-semibold">{used}</span>
        {bonus > 0 && <span className="text-[#f97316]"> +{bonus}</span>}
        <span className="text-slate-600"> / {limit} mo</span>
      </div>

      {/* Users */}
      <div className="text-[11px]">
        <span className={`font-semibold ${atUserLimit ? 'text-red-400' : 'text-white'}`}>{org.userCount}</span>
        <span className="text-slate-600"> / {userLimit === null ? '∞' : userLimit}</span>
        {atUserLimit && <span className="ml-1 text-[9px] font-bold text-red-400 bg-red-900/30 px-1 py-0.5 rounded">FULL</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {org.status === 'active' && (
          <button
            onClick={onManage}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Manage <ChevronRight size={11} />
          </button>
        )}

        <button
          ref={triggerRef}
          onClick={openMenu}
          disabled={actionLoading}
          className="flex items-center gap-1 px-2 py-1.5 bg-[#1a2236] border border-[#1e2d4a] hover:border-[#2e3d5a] text-slate-400 hover:text-white rounded-lg text-xs transition-colors disabled:opacity-50"
          title="More actions"
        >
          {actionLoading
            ? <RefreshCw size={12} className="animate-spin" />
            : <ChevronDown size={12} />}
        </button>

        {menuOpen && ReactDOM.createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl shadow-2xl shadow-black/60 py-1"
          >
            {org.status === 'active' && (
              <button
                onClick={() => { onManage(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-300 hover:bg-[#1e2d4a] transition-colors"
              >
                <Shield size={13} />
                Subscription Override
              </button>
            )}
            {org.status === 'active' && <div className="border-t border-[#1e2d4a] my-1" />}
            {org.status === 'active' && (
              <button
                onClick={() => { onArchive(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-amber-400 hover:bg-amber-900/20 transition-colors"
              >
                <Archive size={13} />
                Archive Organisation
              </button>
            )}
            {org.status === 'archived' && (
              <button
                onClick={() => { onRestore(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-emerald-400 hover:bg-emerald-900/20 transition-colors"
              >
                <RotateCcw size={13} />
                Restore Organisation
              </button>
            )}
            {org.settings?.account_type === 'trial' && org.status === 'active' && (
              <button
                onClick={() => { onResendInvite(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-sky-400 hover:bg-sky-900/20 transition-colors"
              >
                <Send size={13} />
                Resend Trial Invite
              </button>
            )}
            <div className="border-t border-[#1e2d4a] my-1" />
            <button
              onClick={() => { onDelete(); setMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-400 hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={13} />
              Permanently Delete
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

// ─── Company Profile section (embedded in ManagePanel) ────────────────────────

interface OrgProfile {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  company_vat_number: string;
  company_number: string;
  logo_data_url: string;
}

const EMPTY_PROFILE: OrgProfile = {
  company_name: '', company_address: '', company_phone: '',
  company_email: '', company_website: '', company_vat_number: '',
  company_number: '', logo_data_url: '',
};

const profileInputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] transition-colors';
const profileLabelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

function CompanyProfileSection({ orgId }: { orgId: string }) {
  const [form, setForm] = useState<OrgProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setProfileError(null);
      const { data, error } = await supabase
        .from('vy_settings')
        .select('company_name,company_address,company_phone,company_email,company_website,company_vat_number,company_number,logo_data_url')
        .eq('org_id', orgId)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setProfileError(error.message); }
      else if (data) {
        setForm({
          company_name: data.company_name ?? '',
          company_address: data.company_address ?? '',
          company_phone: data.company_phone ?? '',
          company_email: data.company_email ?? '',
          company_website: data.company_website ?? '',
          company_vat_number: data.company_vat_number ?? '',
          company_number: data.company_number ?? '',
          logo_data_url: data.logo_data_url ?? '',
        });
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [orgId]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setProfileError('Logo must be under 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, logo_data_url: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setProfileError(null);
    const { error } = await supabase
      .from('vy_settings')
      .upsert(
        { ...form, org_id: orgId, id: orgId, updated_at: new Date().toISOString() },
        { onConflict: 'org_id' }
      );
    if (error) {
      setProfileError(error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const fields: { key: keyof OrgProfile; label: string; icon: React.ReactNode; multiline?: boolean; placeholder?: string }[] = [
    { key: 'company_name',       label: 'Company Name',           icon: <Building2 size={12} />, placeholder: 'e.g. Acme Construction Ltd' },
    { key: 'company_number',     label: 'Companies House Number', icon: <Hash size={12} />,      placeholder: '12345678' },
    { key: 'company_vat_number', label: 'VAT Number',             icon: <Hash size={12} />,      placeholder: 'GB 123 4567 89' },
    { key: 'company_address',    label: 'Registered Address',     icon: <Building2 size={12} />, multiline: true, placeholder: '14 Broad Street, London EC2M 1QS' },
    { key: 'company_email',      label: 'Email Address',          icon: <Mail size={12} />,      placeholder: 'info@company.co.uk' },
    { key: 'company_phone',      label: 'Telephone',              icon: <Phone size={12} />,     placeholder: '020 7123 4567' },
    { key: 'company_website',    label: 'Website',                icon: <Globe size={12} />,     placeholder: 'www.company.co.uk' },
  ];

  return (
    <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Company Profile</h3>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Logo */}
          <div>
            <label className={profileLabelCls}>Company Logo</label>
            <div className="mt-2 flex items-center gap-4 flex-wrap">
              <div className="w-28 h-16 bg-[#0d1628] rounded-xl flex items-center justify-center border border-[#1e2d4a] overflow-hidden shrink-0">
                {form.logo_data_url
                  ? <img src={form.logo_data_url} alt="Logo" className="w-full h-full object-contain p-1.5" />
                  : <Building2 size={22} className="text-slate-700" />}
              </div>
              <div className="space-y-1.5">
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 border border-[#1e2d4a] rounded-lg text-xs text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors">
                  <Upload size={12} />Upload Logo
                </button>
                <p className="text-[11px] text-slate-600">PNG, SVG or JPEG · Max 2 MB</p>
                {form.logo_data_url && (
                  <button onClick={() => setForm(f => ({ ...f, logo_data_url: '' }))}
                    className="text-[11px] text-red-500 hover:text-red-400 transition-colors">
                    Remove logo
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg"
                className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(({ key, label, icon, multiline, placeholder }) => (
              <div key={key} className={multiline ? 'sm:col-span-2' : ''}>
                <label className={profileLabelCls}>
                  <span className="inline-flex items-center gap-1 align-middle">{icon}{label}</span>
                </label>
                {multiline ? (
                  <textarea value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    rows={2} placeholder={placeholder} className={`${profileInputCls} resize-none`} />
                ) : (
                  <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder} className={profileInputCls} />
                )}
              </div>
            ))}
          </div>

          {profileError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-900/20 border border-red-800/40">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{profileError}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
              <Save size={13} />{saving ? 'Saving…' : 'Save Profile'}
            </button>
            {saved && <span className="text-xs text-emerald-400 font-semibold">Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manage panel ─────────────────────────────────────────────────────────────

function ManagePanel({
  org,
  onBack,
  onSaved,
  adminEmail,
}: {
  org: OrgWithSettings;
  onBack: () => void;
  onSaved: (updated: OrgSettings) => void;
  adminEmail: string;
}) {
  const existing = org.settings;
  const isTrial = existing?.account_type === 'trial';
  const [accountStatus, setAccountStatus] = useState<'active' | 'disabled'>(
    existing?.account_status ?? 'active'
  );
  const [modules, setModules] = useState<Record<string, boolean>>(
    mergeModules(existing?.modules_enabled ?? null)
  );
  const [aiEnabled, setAiEnabled] = useState(existing?.ai_enabled ?? true);
  const [aiLimit, setAiLimit] = useState(existing?.ai_monthly_limit ?? 50);
  const [bonusToAdd, setBonusToAdd] = useState(0);
  const [userLimitEnabled, setUserLimitEnabled] = useState(existing?.user_limit !== null && existing?.user_limit !== undefined);
  const [userLimit, setUserLimit] = useState(existing?.user_limit ?? 10);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSave() {
    setSaving(true);
    const newBonus = (existing?.ai_bonus_credits ?? 0) + bonusToAdd;

    const payload: Omit<OrgSettings, 'org_id' | 'updated_at'> & { org_id: string } = {
      org_id: org.id,
      account_status: accountStatus,
      account_type: existing?.account_type ?? 'paid',
      trial_expires_at: existing?.trial_expires_at ?? null,
      modules_enabled: modules,
      ai_enabled: aiEnabled,
      ai_monthly_limit: aiLimit,
      ai_used_this_month: existing?.ai_used_this_month ?? 0,
      ai_bonus_credits: newBonus,
      user_limit: userLimitEnabled ? Math.max(1, userLimit) : null,
      updated_by: adminEmail,
    };

    const { data, error } = await supabase
      .from('org_settings')
      .upsert(payload, { onConflict: 'org_id' })
      .select()
      .maybeSingle();

    setSaving(false);
    if (error) {
      showToast('error', `Save failed: ${error.message}`);
    } else if (data) {
      setBonusToAdd(0);
      onSaved(data as OrgSettings);
      showToast('success', 'Settings saved successfully.');
    }
  }

  function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
      <button onClick={() => onChange(!value)} className="flex items-center gap-2 text-sm transition-colors">
        {value
          ? <ToggleRight size={28} className="text-[#f97316]" />
          : <ToggleLeft size={28} className="text-slate-600" />}
        <span className={value ? 'text-white font-semibold' : 'text-slate-500'}>
          {value ? 'On' : 'Off'}
        </span>
      </button>
    );
  }

  const trialDays = trialDaysRemaining(existing?.trial_expires_at ?? null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
          <ChevronLeft size={16} />Back
        </button>
        <div className="w-px h-4 bg-[#1e2d4a]" />
        <Building2 size={16} className="text-[#f97316]" />
        <h2 className="text-sm font-bold text-white">{org.name}</h2>
        <span className="text-[11px] text-slate-500">{org.slug}</span>
        {isTrial && <TrialBadge expiresAt={existing?.trial_expires_at ?? null} />}
      </div>

      {/* Trial expiry info banner */}
      {isTrial && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
          trialDays !== null && trialDays <= 0
            ? 'bg-red-900/20 border-red-800/50'
            : trialDays !== null && trialDays <= 3
            ? 'bg-amber-900/20 border-amber-800/50'
            : 'bg-sky-900/20 border-sky-800/50'
        }`}>
          <Clock size={15} className={`shrink-0 mt-0.5 ${
            trialDays !== null && trialDays <= 0 ? 'text-red-400' : trialDays !== null && trialDays <= 3 ? 'text-amber-400' : 'text-sky-400'
          }`} />
          <div>
            <p className={`text-xs font-semibold ${
              trialDays !== null && trialDays <= 0 ? 'text-red-300' : trialDays !== null && trialDays <= 3 ? 'text-amber-300' : 'text-sky-300'
            }`}>
              {trialDays !== null && trialDays <= 0
                ? 'Trial expired'
                : trialDays !== null
                ? `Trial expires in ${trialDays} day${trialDays === 1 ? '' : 's'}`
                : 'Trial organisation'}
            </p>
            {existing?.trial_expires_at && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                Expiry date: {new Date(existing.trial_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border ${
          toast.type === 'success'
            ? 'bg-emerald-900/30 border-emerald-800 text-emerald-300'
            : 'bg-red-900/30 border-red-800 text-red-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Account status */}
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Account Status</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Company Access</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {accountStatus === 'active'
                  ? 'Users can log in and use the platform normally.'
                  : 'All users are blocked from accessing the platform. No data is deleted.'}
              </p>
            </div>
            <Toggle value={accountStatus === 'active'} onChange={v => setAccountStatus(v ? 'active' : 'disabled')} />
          </div>
          {accountStatus === 'disabled' && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-red-900/20 border border-red-900/40 rounded-lg">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">Disabling this account will prevent all users in this company from logging in. All data is preserved and can be re-enabled at any time.</p>
            </div>
          )}
        </div>

        {/* User Allowance */}
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">User Allowance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Enforce User Limit</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Current active users: <span className="text-white font-semibold">{org.userCount}</span>
                </p>
              </div>
              <Toggle value={userLimitEnabled} onChange={setUserLimitEnabled} />
            </div>

            {userLimitEnabled && (
              <>
                <div className="h-px bg-[#1e2d4a]" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">User Limit</p>
                    <p className="text-xs text-slate-500 mt-0.5">Maximum active users for this organisation</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={userLimit}
                    onChange={e => setUserLimit(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>
                {org.userCount >= userLimit && (
                  <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-900/40 rounded-lg">
                    <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-300">
                      This organisation currently has {org.userCount} active user{org.userCount !== 1 ? 's' : ''}, which meets or exceeds the limit of {userLimit}. New invitations will be blocked until users are removed or the limit is raised.
                    </p>
                  </div>
                )}
              </>
            )}

            {!userLimitEnabled && (
              <p className="text-xs text-slate-600 italic">No limit set — unlimited users allowed.</p>
            )}
          </div>
        </div>

        {/* AI Settings */}
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">AI Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">AI Access</p>
                <p className="text-xs text-slate-500 mt-0.5">Enable AI Tender Assistant and review features</p>
              </div>
              <Toggle value={aiEnabled} onChange={setAiEnabled} />
            </div>

            <div className="h-px bg-[#1e2d4a]" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Monthly AI Limit</p>
                <p className="text-xs text-slate-500 mt-0.5">Max AI reviews per calendar month</p>
              </div>
              <input
                type="number"
                min={0}
                max={9999}
                value={aiLimit}
                onChange={e => setAiLimit(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 text-center bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors"
              />
            </div>

            <div className="h-px bg-[#1e2d4a]" />

            <div>
              <div className="flex items-center justify-between gap-4 mb-2">
                <div>
                  <p className="text-sm font-semibold text-white">Add Bonus Credits</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Current: <span className="text-white">{existing?.ai_used_this_month ?? 0}</span> used ·{' '}
                    <span className="text-[#f97316]">{existing?.ai_bonus_credits ?? 0}</span> bonus banked
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setBonusToAdd(b => Math.max(0, b - 1))}
                    className="w-7 h-7 flex items-center justify-center rounded bg-[#0d1628] border border-[#1e2d4a] text-slate-400 hover:text-white transition-colors text-sm font-bold"
                  >−</button>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={bonusToAdd}
                    onChange={e => setBonusToAdd(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 text-center bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                  <button
                    onClick={() => setBonusToAdd(b => b + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded bg-[#0d1628] border border-[#1e2d4a] text-slate-400 hover:text-white transition-colors text-sm font-bold"
                  >+</button>
                </div>
              </div>
              {bonusToAdd > 0 && (
                <p className="text-xs text-[#f97316]">+{bonusToAdd} credits will be added on save (total will be {(existing?.ai_bonus_credits ?? 0) + bonusToAdd})</p>
              )}
            </div>
          </div>
        </div>

        {/* Module toggles */}
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5 lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Enabled Modules</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MODULES.map(m => (
              <div
                key={m.key}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                  modules[m.key]
                    ? 'border-[#f97316]/30 bg-[#f97316]/5'
                    : 'border-[#1e2d4a] bg-[#0d1628]/40'
                }`}
                onClick={() => setModules(prev => ({ ...prev, [m.key]: !prev[m.key] }))}
              >
                <span className={`text-xs font-semibold ${modules[m.key] ? 'text-white' : 'text-slate-600'}`}>
                  {m.label}
                </span>
                {modules[m.key]
                  ? <ToggleRight size={20} className="text-[#f97316] shrink-0" />
                  : <ToggleLeft size={20} className="text-slate-700 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Subscription Override ─────────────────────────────────────────── */}
      <SubscriptionOverrideSection
        orgId={org.id}
        settings={existing}
        onSaved={(patch) => {
          const merged = existing ? { ...existing, ...patch } : (patch as OrgSettings);
          onSaved(merged as OrgSettings);
        }}
      />

      {/* ── Company Profile ──────────────────────────────────────────────────── */}
      <CompanyProfileSection orgId={org.id} />

      {/* Save */}
      <div className="flex justify-end gap-3">
        <button onClick={onBack} className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-[#1e2d4a] rounded-lg transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-[#f97316] hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── Super Admin Management tab ───────────────────────────────────────────────

function SuperAdminManagement({ currentUserId }: { currentUserId: string }) {
  const [admins, setAdmins] = useState<SuperAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; name: string; action: 'disable' | 'remove' } | null>(null);
  const [actioning, setActioning] = useState(false);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vy_super_admins')
      .select('id, auth_user_id, email, name, status, created_at')
      .order('created_at', { ascending: true });
    if (!error) setAdmins((data ?? []) as SuperAdminRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const res = await fetch(
        `${env.supabaseUrl}/functions/v1/admin-invite-super-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email: inviteEmail.trim(), name: inviteName.trim() }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        showToast('error', json.error ?? 'Invite failed');
      } else {
        showToast('success', json.note ?? `Invite sent to ${inviteEmail.trim()}`);
        setInviteEmail('');
        setInviteName('');
        loadAdmins();
      }
    } catch {
      showToast('error', 'Network error — invite not sent');
    } finally {
      setInviting(false);
    }
  }

  async function handleAction() {
    if (!confirmAction) return;
    setActioning(true);
    const { id, action } = confirmAction;

    if (action === 'disable') {
      const { error } = await supabase
        .from('vy_super_admins')
        .update({ status: 'disabled' })
        .eq('id', id);
      if (error) showToast('error', error.message);
      else { showToast('success', 'Super admin disabled.'); loadAdmins(); }
    } else {
      const { error } = await supabase
        .from('vy_super_admins')
        .delete()
        .eq('id', id);
      if (error) showToast('error', error.message);
      else { showToast('success', 'Super admin removed.'); loadAdmins(); }
    }

    setConfirmAction(null);
    setActioning(false);
  }

  async function handleReEnable(id: string) {
    const { error } = await supabase
      .from('vy_super_admins')
      .update({ status: 'active' })
      .eq('id', id);
    if (error) showToast('error', error.message);
    else { showToast('success', 'Super admin re-enabled.'); loadAdmins(); }
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border ${
          toast.type === 'success'
            ? 'bg-emerald-900/30 border-emerald-800 text-emerald-300'
            : 'bg-red-900/30 border-red-800 text-red-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              {confirmAction.action === 'remove'
                ? <Trash2 size={18} className="text-red-400" />
                : <Ban size={18} className="text-amber-400" />}
              <h3 className="text-sm font-bold text-white">
                {confirmAction.action === 'remove' ? 'Remove Super Admin' : 'Disable Super Admin'}
              </h3>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              {confirmAction.action === 'remove'
                ? `Remove ${confirmAction.name} as a super admin? They will immediately lose all platform admin access. This cannot be undone without re-inviting.`
                : `Disable ${confirmAction.name}? They will lose platform admin access but can be re-enabled later.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-[#1e2d4a] rounded-lg transition-colors"
              >Cancel</button>
              <button
                onClick={handleAction}
                disabled={actioning}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 ${
                  confirmAction.action === 'remove'
                    ? 'bg-red-700 hover:bg-red-600'
                    : 'bg-amber-700 hover:bg-amber-600'
                }`}
              >
                {actioning && <RefreshCw size={13} className="animate-spin" />}
                {confirmAction.action === 'remove' ? 'Remove' : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite form */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <UserPlus size={13} />Invite New Super Admin
        </h3>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Full name"
            value={inviteName}
            onChange={e => setInviteName(e.target.value)}
            required
            className="flex-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
          />
          <input
            type="email"
            placeholder="Email address"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            required
            className="flex-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
          />
          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-[#f97316] hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
          >
            {inviting ? <RefreshCw size={13} className="animate-spin" /> : <UserPlus size={13} />}
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
        <p className="text-[11px] text-slate-600 mt-2">
          An email invite will be sent. The recipient sets their own password and gains platform admin access on first sign-in.
        </p>
      </div>

      {/* Admin list */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_100px_130px] gap-3 px-4 py-2.5 border-b border-[#1e2d4a] bg-[#0d1628]/60">
          {['Name', 'Email', 'Status', ''].map(h => (
            <span key={h} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <RefreshCw size={18} className="text-slate-600 animate-spin" />
          </div>
        ) : admins.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No super admins found.</div>
        ) : (
          admins.map(admin => {
            const isYou = admin.auth_user_id === currentUserId;
            const isActive = admin.status === 'active';
            return (
              <div key={admin.id} className="grid grid-cols-[1fr_1fr_100px_130px] gap-3 items-center px-4 py-3 border-b border-[#1e2d4a] last:border-0 hover:bg-[#0d1628]/40 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-white">{admin.name}</p>
                  {isYou && <span className="text-[10px] text-[#f97316] font-bold">You</span>}
                </div>
                <p className="text-sm text-slate-400">{admin.email}</p>
                <div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-emerald-900/60 text-emerald-400' : 'bg-amber-900/60 text-amber-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!isYou && isActive && (
                    <button
                      onClick={() => setConfirmAction({ id: admin.id, name: admin.name, action: 'disable' })}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-amber-400 border border-amber-900/50 hover:bg-amber-900/20 rounded-lg transition-colors"
                      title="Disable"
                    >
                      <Ban size={11} />Disable
                    </button>
                  )}
                  {!isYou && !isActive && (
                    <button
                      onClick={() => handleReEnable(admin.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/20 rounded-lg transition-colors"
                    >
                      <CheckCircle size={11} />Enable
                    </button>
                  )}
                  {!isYou && (
                    <button
                      onClick={() => setConfirmAction({ id: admin.id, name: admin.name, action: 'remove' })}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-red-400 border border-red-900/50 hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={11} />Remove
                    </button>
                  )}
                  {isYou && <span className="text-[11px] text-slate-600 italic">Cannot modify own account</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-start gap-2 p-3 bg-[#0d1628] border border-[#1e2d4a] rounded-lg">
        <Shield size={13} className="text-slate-600 mt-0.5 shrink-0" />
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Super admins have full platform access. Only existing super admins can invite or remove others.
          You cannot modify your own account to prevent accidental lockout.
          Removing a super admin revokes their access immediately — they must be re-invited to regain it.
        </p>
      </div>
    </div>
  );
}

// ─── Main SuperAdmin page ──────────────────────────────────────────────────────

export default function SuperAdmin() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<OrgWithSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState<OrgWithSettings | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'companies' | 'admins' | 'ai-billing'>('companies');
  const [companySearch, setCompanySearch] = useState('');
  const [showNewTrialModal, setShowNewTrialModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgWithSettings | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc('is_super_admin');
      setIsSuperAdmin(data === true);
    })();
  }, [user]);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: orgData, error: orgErr } = await supabase
      .from('organisations')
      .select('id, name, slug, created_at, status, archived_at, deleted_at')
      .order('name');

    if (orgErr) { setError(orgErr.message); setLoading(false); return; }

    const { data: settingsData } = await supabase
      .from('org_settings')
      .select('*');

    const { data: userCountData } = await supabase
      .from('user_orgs')
      .select('org_id')
      .eq('status', 'active');

    const settingsMap: Record<string, OrgSettings> = {};
    (settingsData ?? []).forEach((s: OrgSettings) => { settingsMap[s.org_id] = s; });

    const userCountMap: Record<string, number> = {};
    (userCountData ?? []).forEach((u: { org_id: string }) => {
      userCountMap[u.org_id] = (userCountMap[u.org_id] ?? 0) + 1;
    });

    const combined: OrgWithSettings[] = (orgData ?? []).map((o: OrgRow) => ({
      ...o,
      settings: settingsMap[o.id] ?? null,
      userCount: userCountMap[o.id] ?? 0,
    }));

    setOrgs(combined);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isSuperAdmin) loadOrgs();
  }, [isSuperAdmin, loadOrgs]);

  async function handleArchive(org: OrgWithSettings) {
    setActionLoading(org.id);
    setActionError(null);
    const { error: orgErr } = await supabase
      .from('organisations')
      .update({ status: 'archived', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', org.id);
    if (orgErr) { setActionError(orgErr.message); setActionLoading(null); return; }
    await supabase.from('org_settings')
      .update({ account_status: 'disabled', updated_by: 'super-admin:archive' })
      .eq('org_id', org.id);
    await loadOrgs();
    setActionLoading(null);
  }

  async function handleRestore(org: OrgWithSettings) {
    setActionLoading(org.id);
    setActionError(null);
    const { error: orgErr } = await supabase
      .from('organisations')
      .update({ status: 'active', archived_at: null, updated_at: new Date().toISOString() })
      .eq('id', org.id);
    if (orgErr) { setActionError(orgErr.message); setActionLoading(null); return; }
    await supabase.from('org_settings')
      .update({ account_status: 'active', updated_by: 'super-admin:restore' })
      .eq('org_id', org.id);
    await loadOrgs();
    setActionLoading(null);
  }

  async function handleDeleteConfirmed(org: OrgWithSettings) {
    setActionLoading(org.id);
    setActionError(null);
    setDeleteTarget(null);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const res = await fetch(
        `${env.supabaseUrl}/functions/v1/delete-org`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ org_id: org.id }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setActionError(`Delete failed: ${json.error ?? 'Unknown error'}`);
      } else {
        await loadOrgs();
      }
    } catch {
      setActionError('Network error during deletion — please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResendInvite(org: OrgWithSettings) {
    setActionLoading(org.id);
    setActionError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const res = await fetch(
        `${env.supabaseUrl}/functions/v1/resend-trial-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ org_id: org.id }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setActionError(`Resend failed: ${json.error ?? 'Unknown error'}`);
      } else {
        setResendSuccess(`Invite email sent to ${json.sentTo}`);
        setTimeout(() => setResendSuccess(null), 5000);
      }
    } catch {
      setActionError('Network error — please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  if (isSuperAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center mb-4">
          <Shield size={24} className="text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Super Admin Access Required</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          This area is restricted to VYSITE platform administrators. Your account does not have super admin access.
        </p>
      </div>
    );
  }

  if (isSuperAdmin === null || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <RefreshCw size={24} className="text-slate-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading Super Admin…</p>
        </div>
      </div>
    );
  }

  const adminEmail = user?.email ?? '';

  const trialOrgs   = orgs.filter(o => o.settings?.account_type === 'trial');
  const expiredTrials = trialOrgs.filter(o => {
    const d = trialDaysRemaining(o.settings?.trial_expires_at ?? null);
    return d !== null && d <= 0;
  });
  const archivedOrgs = orgs.filter(o => o.status === 'archived');

  if (managing) {
    return (
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield size={16} className="text-[#f97316]" />
          <span className="text-xs font-bold text-[#f97316] uppercase tracking-widest">VYSITE Super Admin</span>
        </div>
        <ManagePanel
          org={managing}
          onBack={() => setManaging(null)}
          adminEmail={adminEmail}
          onSaved={(updated) => {
            setOrgs(prev => prev.map(o =>
              o.id === updated.org_id ? { ...o, settings: updated } : o
            ));
            setManaging(prev => prev ? { ...prev, settings: updated } : prev);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {showNewTrialModal && (
        <NewTrialModal
          onClose={() => setShowNewTrialModal(false)}
          onCreated={loadOrgs}
        />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-[#f97316]" />
            <span className="text-xs font-bold text-[#f97316] uppercase tracking-widest">VYSITE Platform Administration</span>
          </div>
          <h1 className="text-xl font-bold text-white">
            {activeTab === 'companies' ? 'Company Management' : activeTab === 'admins' ? 'Super Admin Management' : 'AI & Billing'}
          </h1>
        </div>
        {activeTab === 'companies' && (
          <div className="flex items-center gap-2">
            <button
              onClick={loadOrgs}
              className="flex items-center gap-1.5 px-3 py-2 border border-[#1e2d4a] text-slate-400 hover:text-white hover:border-[#f97316] rounded-lg text-xs font-semibold transition-colors"
            >
              <RefreshCw size={13} />Refresh
            </button>
            <button
              onClick={() => setShowNewTrialModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <FlaskConical size={13} />New Trial
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#0d1628] border border-[#1e2d4a] rounded-xl mb-5 w-fit">
        {([
          { id: 'companies',  label: 'Companies' },
          { id: 'admins',     label: 'Super Admins' },
          { id: 'ai-billing', label: 'AI & Billing' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-[#f97316] text-white shadow'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'admins' && (
        <SuperAdminManagement currentUserId={user?.id ?? ''} />
      )}

      {activeTab === 'ai-billing' && (
        <SuperAdminAIBilling />
      )}

      {activeTab === 'companies' && (
        <>
          {(error || actionError) && (
            <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-900/40 rounded-xl text-sm text-red-300 mb-4">
              <AlertCircle size={16} />
              {error || actionError}
              <button onClick={() => { setError(null); setActionError(null); }} className="ml-auto text-red-500 hover:text-red-300">✕</button>
            </div>
          )}
          {resendSuccess && (
            <div className="flex items-center gap-2 p-4 bg-emerald-900/20 border border-emerald-900/40 rounded-xl text-sm text-emerald-300 mb-4">
              <CheckCircle size={16} />
              {resendSuccess}
            </div>
          )}

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            {[
              { label: 'Total Companies',  value: orgs.length },
              { label: 'Active',           value: orgs.filter(o => o.status === 'active').length, color: 'text-emerald-400' },
              { label: 'Archived',         value: archivedOrgs.length, color: archivedOrgs.length > 0 ? 'text-amber-400' : 'text-slate-600' },
              { label: 'AI Enabled',       value: orgs.filter(o => o.settings?.ai_enabled !== false).length, color: 'text-[#f97316]' },
              { label: 'Active Trials',    value: trialOrgs.length, color: 'text-sky-400' },
              { label: 'Expired Trials',   value: expiredTrials.length, color: expiredTrials.length > 0 ? 'text-red-400' : 'text-slate-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-4">
                <p className={`text-2xl font-black ${stat.color ?? 'text-white'}`}>{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Search + status filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search companies…"
                value={companySearch}
                onChange={e => setCompanySearch(e.target.value)}
                className="w-full bg-[#1a2236] border border-[#1e2d4a] rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
            <div className="flex gap-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg p-1 h-fit">
              {(['all', 'active', 'archived'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors capitalize ${
                    statusFilter === f ? 'bg-[#f97316] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {(() => {
            const filtered = orgs.filter(o => {
              if (statusFilter !== 'all' && o.status !== statusFilter) return false;
              return o.name.toLowerCase().includes(companySearch.toLowerCase());
            });
            return (
              <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
                <div className="grid grid-cols-[1fr_140px_1fr_80px_150px_110px_110px] gap-3 px-4 py-2.5 border-b border-[#1e2d4a] bg-[#0d1628]/60">
                  {['Company', 'Status', 'Modules', 'AI', 'AI Usage', 'Users', 'Actions'].map(h => (
                    <span key={h} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</span>
                  ))}
                </div>

                {filtered.length === 0 ? (
                  <div className="py-14 text-center">
                    <Building2 size={32} className="text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">
                      {companySearch ? `No companies matching "${companySearch}"` : 'No companies found'}
                    </p>
                  </div>
                ) : (
                  filtered.map(org => (
                    <CompanyRow
                      key={org.id}
                      org={org}
                      onManage={() => setManaging(org)}
                      onArchive={() => handleArchive(org)}
                      onRestore={() => handleRestore(org)}
                      onDelete={() => setDeleteTarget(org)}
                      onResendInvite={() => handleResendInvite(org)}
                      actionLoading={actionLoading === org.id}
                    />
                  ))
                )}
              </div>
            );
          })()}

          <p className="text-[11px] text-slate-700 mt-4 text-center">
            Logged in as super admin · {adminEmail} · Changes are saved immediately to the database
          </p>

          {/* Delete confirmation modal */}
          {deleteTarget && (
            <ConfirmDeleteOrgModal
              org={deleteTarget}
              onConfirm={() => handleDeleteConfirmed(deleteTarget)}
              onCancel={() => setDeleteTarget(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
