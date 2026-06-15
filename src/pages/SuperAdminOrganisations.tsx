import { useEffect, useRef, useState } from 'react';
import {
  Building2, Search, Archive, RotateCcw, Trash2,
  AlertCircle, ChevronDown, Calendar, Users, ArrowLeft,
  Save, Upload, Mail, Phone, Globe, Hash,
  Shield, Plus, Zap, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ConfirmDeleteOrgModal from '../components/ConfirmDeleteOrgModal';

type OrgStatus = 'active' | 'archived' | 'deleted';

interface Org {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  created_at: string;
  archived_at: string | null;
  deleted_at: string | null;
  // joined from org_settings
  account_type?: string;
  account_status?: string;
  trial_expires_at?: string | null;
  subscription_status?: string | null;
  // free access override
  free_access_enabled?: boolean;
  free_access_enabled_at?: string | null;
  free_access_enabled_by?: string | null;
  // joined counts
  user_count?: number;
}

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
  company_name: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_website: '',
  company_vat_number: '',
  company_number: '',
  logo_data_url: '',
};

const STATUS_FILTERS: { label: string; value: OrgStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
];

const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] transition-colors';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

function StatusBadge({ status }: { status: OrgStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-900/40 text-emerald-400 border border-emerald-800/50">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Active
      </span>
    );
  }
  if (status === 'archived') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-900/40 text-amber-400 border border-amber-800/50">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Archived
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-900/40 text-red-400 border border-red-800/50">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Deleted
    </span>
  );
}

function AccountTypeBadge({ type }: { type?: string }) {
  if (type === 'trial') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-900/40 text-sky-400 border border-sky-800/50">
        Trial
      </span>
    );
  }
  if (type === 'internal') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700/60 text-slate-300 border border-slate-600/50">
        Internal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-900/40 text-[#f97316] border border-orange-800/50">
      Paid
    </span>
  );
}

// ─── Derived subscription status ──────────────────────────────────────────────

type SubscriptionLabel = 'trial_active' | 'trial_expired' | 'active_subscription' | 'suspended' | 'free_access';

function getSubscriptionLabel(org: Org): SubscriptionLabel {
  if (org.free_access_enabled) return 'free_access';
  if (org.account_status === 'disabled') return 'suspended';
  const subStatus = org.subscription_status;
  if (subStatus === 'active' || subStatus === 'trialing') return 'active_subscription';
  if (subStatus === 'canceled' || subStatus === 'unpaid') return 'suspended';
  if (org.account_type === 'trial') {
    if (org.trial_expires_at && new Date(org.trial_expires_at) < new Date()) return 'trial_expired';
    return 'trial_active';
  }
  if (org.account_type === 'paid' || org.account_type === 'internal') return 'active_subscription';
  return 'trial_active';
}

function SubscriptionBadge({ org }: { org: Org }) {
  const label = getSubscriptionLabel(org);
  if (label === 'free_access') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-900/40 text-violet-300 border border-violet-700/50">
        <Zap size={9} className="shrink-0" />
        Free Access
      </span>
    );
  }
  if (label === 'active_subscription') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-900/40 text-emerald-400 border border-emerald-800/50">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Active Subscription
      </span>
    );
  }
  if (label === 'trial_active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-900/40 text-sky-400 border border-sky-800/50">
        <Clock size={9} className="shrink-0" />
        Trial Active
      </span>
    );
  }
  if (label === 'trial_expired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-900/40 text-amber-400 border border-amber-800/50">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Trial Expired
      </span>
    );
  }
  // suspended
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-900/40 text-red-400 border border-red-800/50">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Suspended
    </span>
  );
}

// ─── Subscription Override Panel ──────────────────────────────────────────────

function SubscriptionOverridePanel({ org, onBack, onRefresh }: { org: Org; onBack: () => void; onRefresh: () => void }) {
  const [extendDays, setExtendDays] = useState<number>(14);
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  const [extendSuccess, setExtendSuccess] = useState<string | null>(null);

  const [freeAccess, setFreeAccess] = useState<boolean>(org.free_access_enabled ?? false);
  const [freeLoading, setFreeLoading] = useState(false);
  const [freeError, setFreeError] = useState<string | null>(null);
  const [freeSuccess, setFreeSuccess] = useState<string | null>(null);

  // Current settings snapshot (live from DB)
  const [settings, setSettings] = useState({
    trial_expires_at: org.trial_expires_at ?? null,
    free_access_enabled: org.free_access_enabled ?? false,
    free_access_enabled_at: org.free_access_enabled_at ?? null,
    free_access_enabled_by: org.free_access_enabled_by ?? null,
    account_type: org.account_type ?? '',
    subscription_status: org.subscription_status ?? null,
  });

  async function handleExtendTrial() {
    if (!extendDays || extendDays < 1) {
      setExtendError('Enter a number of days (minimum 1).');
      return;
    }
    setExtendLoading(true);
    setExtendError(null);
    setExtendSuccess(null);

    const base = settings.trial_expires_at
      ? new Date(settings.trial_expires_at)
      : new Date();
    // Always extend from the later of today or existing expiry
    if (base < new Date()) base.setTime(new Date().getTime());
    const newExpiry = new Date(base.getTime() + extendDays * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('org_settings')
      .update({
        trial_expires_at: newExpiry,
        account_type: 'trial',
        account_status: 'active',
        updated_by: 'super-admin:extend-trial',
      })
      .eq('org_id', org.id);

    if (error) {
      setExtendError(error.message);
    } else {
      setSettings(s => ({ ...s, trial_expires_at: newExpiry, account_type: 'trial', account_status: 'active' }));
      setExtendSuccess(`Trial extended to ${new Date(newExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`);
      onRefresh();
    }
    setExtendLoading(false);
  }

  async function handleToggleFreeAccess() {
    const enabling = !freeAccess;
    setFreeLoading(true);
    setFreeError(null);
    setFreeSuccess(null);

    const now = new Date().toISOString();
    const update = enabling
      ? { free_access_enabled: true, free_access_enabled_at: now, free_access_enabled_by: 'super-admin', updated_by: 'super-admin:free-access-enable' }
      : { free_access_enabled: false, free_access_enabled_at: null, free_access_enabled_by: null, updated_by: 'super-admin:free-access-disable' };

    const { error } = await supabase
      .from('org_settings')
      .update(update)
      .eq('org_id', org.id);

    if (error) {
      setFreeError(error.message);
    } else {
      setFreeAccess(enabling);
      setSettings(s => ({
        ...s,
        free_access_enabled: enabling,
        free_access_enabled_at: enabling ? now : null,
        free_access_enabled_by: enabling ? 'super-admin' : null,
      }));
      setFreeSuccess(enabling ? 'Free access override enabled.' : 'Free access override removed.');
      onRefresh();
    }
    setFreeLoading(false);
  }

  const subLabel = getSubscriptionLabel({ ...org, ...settings } as Org);

  return (
    <div className="flex-1 min-w-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200 transition-colors">
          <ArrowLeft size={14} />Organisations
        </button>
        <span className="text-slate-700">/</span>
        <span className="text-sm font-semibold text-slate-300">{org.name}</span>
        <span className="text-slate-700">/</span>
        <span className="text-sm text-slate-500">Subscription Override</span>
      </div>

      <div className="space-y-5">
        {/* Status overview card */}
        <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#1e2d4a]">
            <div className="w-10 h-10 rounded-xl bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center shrink-0">
              <Shield size={18} className="text-[#f97316]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white">Subscription Override</h2>
              <p className="text-xs text-slate-500 mt-0.5">Admin-only controls — extends or bypasses normal subscription rules.</p>
            </div>
            <SubscriptionBadge org={{ ...org, ...settings } as Org} />
          </div>

          {/* Current status grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0d1628] rounded-lg p-3 border border-[#1e2d4a]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Account Type</p>
              <p className="text-sm font-semibold text-slate-200 capitalize">{settings.account_type || '—'}</p>
            </div>
            <div className="bg-[#0d1628] rounded-lg p-3 border border-[#1e2d4a]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Subscription</p>
              <p className="text-sm font-semibold text-slate-200 capitalize">{settings.subscription_status || 'None'}</p>
            </div>
            <div className="bg-[#0d1628] rounded-lg p-3 border border-[#1e2d4a]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Trial Expiry</p>
              <p className={`text-sm font-semibold ${settings.trial_expires_at ? (new Date(settings.trial_expires_at) < new Date() ? 'text-red-400' : 'text-slate-200') : 'text-slate-500'}`}>
                {settings.trial_expires_at
                  ? new Date(settings.trial_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </p>
            </div>
            <div className="bg-[#0d1628] rounded-lg p-3 border border-[#1e2d4a]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Access Status</p>
              <p className="text-xs mt-0.5">
                <SubscriptionBadge org={{ ...org, ...settings } as Org} />
              </p>
            </div>
          </div>
        </div>

        {/* Extend Trial */}
        <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-sky-900/30 border border-sky-800/40 flex items-center justify-center shrink-0">
              <Plus size={15} className="text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Extend Trial</h3>
              <p className="text-xs text-slate-500 mt-0.5">Move the trial expiry date forward from today or current expiry, whichever is later.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            {[7, 14, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setExtendDays(d)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                  extendDays === d
                    ? 'bg-[#f97316] border-orange-600 text-white'
                    : 'bg-[#0d1628] border-[#1e2d4a] text-slate-400 hover:text-white hover:border-[#2e3d5a]'
                }`}
              >
                +{d} days
              </button>
            ))}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Custom:</span>
              <input
                type="number"
                min={1}
                max={365}
                value={extendDays}
                onChange={e => setExtendDays(Math.max(1, Math.min(365, Number(e.target.value))))}
                className="w-20 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] transition-colors"
              />
              <span className="text-xs text-slate-500">days</span>
            </div>
          </div>

          {extendError && (
            <div className="flex items-start gap-2 px-3 py-2.5 mb-3 rounded-lg bg-red-900/20 border border-red-800/40">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{extendError}</p>
            </div>
          )}
          {extendSuccess && (
            <div className="flex items-start gap-2 px-3 py-2.5 mb-3 rounded-lg bg-emerald-900/20 border border-emerald-800/40">
              <AlertCircle size={13} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300">{extendSuccess}</p>
            </div>
          )}

          <button
            onClick={handleExtendTrial}
            disabled={extendLoading || subLabel === 'free_access'}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-700 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {extendLoading ? (
              <><span className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />Extending…</>
            ) : (
              <><Plus size={14} />Extend Trial by +{extendDays} days</>
            )}
          </button>
          {subLabel === 'free_access' && (
            <p className="text-xs text-slate-600 mt-2">Trial extension not needed — Free Access override is active.</p>
          )}
        </div>

        {/* Free Access Override */}
        <div className={`bg-[#1a2236] rounded-xl p-5 border ${freeAccess ? 'border-violet-700/60' : 'border-[#1e2d4a]'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${freeAccess ? 'bg-violet-900/40 border border-violet-700/50' : 'bg-[#0d1628] border border-[#1e2d4a]'}`}>
                <Zap size={15} className={freeAccess ? 'text-violet-300' : 'text-slate-500'} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Free Access Override</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bypasses trial expiry, subscription status, and account_status checks. Use for internal orgs, beta testers, and strategic partners.
                </p>
              </div>
            </div>

            {/* Toggle */}
            <button
              onClick={handleToggleFreeAccess}
              disabled={freeLoading}
              className={`relative shrink-0 w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${freeAccess ? 'bg-violet-600' : 'bg-[#1e2d4a]'}`}
              aria-label={freeAccess ? 'Disable free access override' : 'Enable free access override'}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${freeAccess ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {freeAccess && settings.free_access_enabled_at && (
            <div className="mt-4 pt-4 border-t border-violet-800/40">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-violet-900/20 border border-violet-800/40">
                <Zap size={13} className="text-violet-300 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-violet-300">Free Access Active</p>
                  <p className="text-[11px] text-violet-400/80 mt-0.5">
                    Enabled {new Date(settings.free_access_enabled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {settings.free_access_enabled_by ? ` by ${settings.free_access_enabled_by}` : ''}
                  </p>
                </div>
              </div>
            </div>
          )}

          {freeError && (
            <div className="flex items-start gap-2 px-3 py-2.5 mt-3 rounded-lg bg-red-900/20 border border-red-800/40">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{freeError}</p>
            </div>
          )}
          {freeSuccess && (
            <div className="flex items-start gap-2 px-3 py-2.5 mt-3 rounded-lg bg-emerald-900/20 border border-emerald-800/40">
              <AlertCircle size={13} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300">{freeSuccess}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Company Profile Panel ─────────────────────────────────────────────────────

function CompanyProfilePanel({ org, onBack }: { org: Org; onBack: () => void }) {
  const [form, setForm] = useState<OrgProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('vy_settings')
        .select('company_name,company_address,company_phone,company_email,company_website,company_vat_number,company_number,logo_data_url')
        .eq('org_id', org.id)
        .maybeSingle();
      if (err) {
        setError(err.message);
      } else if (data) {
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
  }, [org.id]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, logo_data_url: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('vy_settings')
      .upsert(
        { ...form, org_id: org.id, id: org.id, updated_at: new Date().toISOString() },
        { onConflict: 'org_id' }
      );
    if (err) {
      setError(err.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const fields: { key: keyof OrgProfile; label: string; icon?: React.ReactNode; multiline?: boolean; placeholder?: string }[] = [
    { key: 'company_name',     label: 'Company Name',              icon: <Building2 size={13} />, placeholder: 'e.g. Acme Construction Ltd' },
    { key: 'company_number',   label: 'Companies House Number',    icon: <Hash size={13} />,      placeholder: '12345678' },
    { key: 'company_vat_number', label: 'VAT Number',              icon: <Hash size={13} />,      placeholder: 'GB 123 4567 89' },
    { key: 'company_address',  label: 'Registered Address',        multiline: true,               placeholder: '14 Broad Street, London EC2M 1QS' },
    { key: 'company_email',    label: 'Email Address',             icon: <Mail size={13} />,      placeholder: 'info@company.co.uk' },
    { key: 'company_phone',    label: 'Telephone',                 icon: <Phone size={13} />,     placeholder: '020 7123 4567' },
    { key: 'company_website',  label: 'Website',                   icon: <Globe size={13} />,     placeholder: 'www.company.co.uk' },
  ];

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={14} />
          Organisations
        </button>
        <span className="text-slate-700">/</span>
        <span className="text-sm font-semibold text-slate-300">{org.name}</span>
        <span className="text-slate-700">/</span>
        <span className="text-sm text-slate-500">Company Profile</span>
      </div>

      <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-6">
        {/* Panel title */}
        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-[#1e2d4a]">
          <div className="w-10 h-10 rounded-xl bg-orange-900/30 border border-orange-800/40 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-[#f97316]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Company Profile</h2>
            <p className="text-xs text-slate-500 mt-0.5">Organisation identity used on PDFs, reports and exports.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <StatusBadge status={org.status} />
            <AccountTypeBadge type={org.account_type} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Logo */}
            <div>
              <label className={labelCls}>Company Logo</label>
              <div className="mt-2 flex items-center gap-4 flex-wrap">
                <div className="w-28 h-16 bg-[#0d1628] rounded-xl flex items-center justify-center border border-[#1e2d4a] overflow-hidden shrink-0">
                  {form.logo_data_url ? (
                    <img src={form.logo_data_url} alt="Logo" className="w-full h-full object-contain p-1.5" />
                  ) : (
                    <Building2 size={24} className="text-slate-700" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] rounded-lg text-sm text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors"
                  >
                    <Upload size={13} />Upload Logo
                  </button>
                  <p className="text-xs text-slate-600">PNG, SVG or JPEG · Max 2 MB · Recommended 240×80px</p>
                  {form.logo_data_url && (
                    <button
                      onClick={() => setForm(f => ({ ...f, logo_data_url: '' }))}
                      className="text-xs text-red-500 hover:text-red-400 transition-colors"
                    >
                      Remove logo
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map(({ key, label, icon, multiline, placeholder }) => (
                <div key={key} className={multiline ? 'sm:col-span-2' : ''}>
                  <label className={labelCls}>
                    {icon && <span className="inline-flex items-center gap-1 align-middle">{icon} {label}</span>}
                    {!icon && label}
                  </label>
                  {multiline ? (
                    <textarea
                      value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      rows={2}
                      placeholder={placeholder}
                      className={`${inputCls} resize-none`}
                    />
                  ) : (
                    <input
                      value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className={inputCls}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-900/20 border border-red-800/40">
                <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {/* Save */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                <Save size={14} />{saving ? 'Saving…' : 'Save Profile'}
              </button>
              {saved && <span className="text-xs text-emerald-400 font-semibold">Saved</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Organisations list ───────────────────────────────────────────────────

export default function SuperAdminOrganisations() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrgStatus | 'all'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Org | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [profileOrg, setProfileOrg] = useState<Org | null>(null);
  const [overrideOrg, setOverrideOrg] = useState<Org | null>(null);

  useEffect(() => { loadOrgs(); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-org-menu]')) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function loadOrgs() {
    setLoading(true);
    setError(null);
    try {
      const { data: orgRows, error: orgErr } = await supabase
        .from('organisations')
        .select('id, name, slug, status, created_at, archived_at, deleted_at')
        .order('created_at', { ascending: false });

      if (orgErr) throw orgErr;

      const orgIds = (orgRows ?? []).map(o => o.id);

      const [settingsRes, userCountRes] = await Promise.all([
        supabase
          .from('org_settings')
          .select('org_id, account_type, account_status, trial_expires_at, subscription_status, free_access_enabled, free_access_enabled_at, free_access_enabled_by')
          .in('org_id', orgIds),
        supabase
          .from('user_orgs')
          .select('org_id')
          .in('org_id', orgIds)
          .eq('status', 'active'),
      ]);

      const settingsMap = new Map(
        (settingsRes.data ?? []).map(s => [s.org_id, s])
      );

      const userCountMap = new Map<string, number>();
      for (const row of userCountRes.data ?? []) {
        userCountMap.set(row.org_id, (userCountMap.get(row.org_id) ?? 0) + 1);
      }

      const enriched: Org[] = (orgRows ?? []).map(o => ({
        ...o,
        ...settingsMap.get(o.id),
        user_count: userCountMap.get(o.id) ?? 0,
      }));

      setOrgs(enriched);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load organisations');
    } finally {
      setLoading(false);
    }
  }

  async function archiveOrg(org: Org) {
    setActionLoading(org.id);
    setActionError(null);
    const { error } = await supabase
      .from('organisations')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    if (error) {
      setActionError(error.message);
    } else {
      await supabase
        .from('org_settings')
        .update({ account_status: 'disabled', updated_by: 'super-admin:archive' })
        .eq('org_id', org.id);
      await loadOrgs();
    }
    setActionLoading(null);
    setOpenMenuId(null);
  }

  async function restoreOrg(org: Org) {
    setActionLoading(org.id);
    setActionError(null);
    const { error } = await supabase
      .from('organisations')
      .update({
        status: 'active',
        archived_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    if (error) {
      setActionError(error.message);
    } else {
      await supabase
        .from('org_settings')
        .update({ account_status: 'active', updated_by: 'super-admin:restore' })
        .eq('org_id', org.id);
      await loadOrgs();
    }
    setActionLoading(null);
    setOpenMenuId(null);
  }

  async function handleDeleteConfirmed(org: Org) {
    setActionLoading(org.id);
    setActionError(null);
    setDeleteTarget(null);

    const { error } = await supabase.rpc('super_admin_delete_org', { p_org_id: org.id });

    if (error) {
      setActionError(`Delete failed: ${error.message}`);
      setActionLoading(null);
    } else {
      await loadOrgs();
      setActionLoading(null);
    }
  }

  // Show Company Profile panel when an org is selected
  if (profileOrg) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex">
        <CompanyProfilePanel org={profileOrg} onBack={() => setProfileOrg(null)} />
      </div>
    );
  }

  // Show Subscription Override panel
  if (overrideOrg) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex">
        <SubscriptionOverridePanel
          org={overrideOrg}
          onBack={() => setOverrideOrg(null)}
          onRefresh={loadOrgs}
        />
      </div>
    );
  }

  const filtered = orgs.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: orgs.length,
    active: orgs.filter(o => o.status === 'active').length,
    archived: orgs.filter(o => o.status === 'archived').length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center">
            <Building2 size={18} className="text-[#f97316]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Organisations</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {counts.active} active · {counts.archived} archived
            </p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="flex items-start gap-2.5 px-4 py-3 mb-4 rounded-lg bg-red-900/20 border border-red-800/40">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{actionError}</p>
          <button onClick={() => setActionError(null)} className="ml-auto text-red-500 hover:text-red-300 text-xs">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search organisations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#1a2236] border border-[#1e2d4a] rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors"
          />
        </div>
        <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                statusFilter === f.value
                  ? 'bg-[#f97316] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-[10px] ${statusFilter === f.value ? 'opacity-80' : 'text-slate-600'}`}>
                {counts[f.value === 'all' ? 'all' : f.value as 'active' | 'archived']}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No organisations found</p>
        </div>
      ) : (
        <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2d4a]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Organisation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Users</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Created</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d4a]/60">
              {filtered.map(org => (
                <tr
                  key={org.id}
                  className="hover:bg-[#0d1628]/40 transition-colors cursor-pointer"
                  onClick={() => setProfileOrg(org)}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-slate-300">
                          {org.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate">{org.name}</p>
                        <p className="text-xs text-slate-500 truncate">{org.slug}</p>
                      </div>
                    </div>
                    {/* Mobile-only status */}
                    <div className="mt-1.5 sm:hidden">
                      <StatusBadge status={org.status} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <div className="flex flex-col gap-1.5">
                      <StatusBadge status={org.status} />
                      {org.status === 'archived' && org.archived_at && (
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                          <Calendar size={9} />
                          {new Date(org.archived_at).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <div className="flex flex-col gap-1.5">
                      <SubscriptionBadge org={org} />
                      <AccountTypeBadge type={org.account_type} />
                      {org.account_type === 'trial' && org.trial_expires_at && !org.free_access_enabled && (
                        <span className={`text-[10px] flex items-center gap-1 ${
                          new Date(org.trial_expires_at) < new Date() ? 'text-red-400' : 'text-slate-600'
                        }`}>
                          <Calendar size={9} />
                          Expires {new Date(org.trial_expires_at).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="flex items-center gap-1.5 text-sm text-slate-300">
                      <Users size={13} className="text-slate-500" />
                      {org.user_count}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-xs text-slate-500">
                      {new Date(org.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                    <div className="relative inline-block" data-org-menu>
                      <button
                        onClick={() => setOpenMenuId(openMenuId === org.id ? null : org.id)}
                        disabled={actionLoading === org.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d1628] border border-[#1e2d4a] text-xs text-slate-300 hover:text-white hover:border-[#2e3d5a] transition-colors disabled:opacity-50"
                      >
                        {actionLoading === org.id ? (
                          <span className="w-3.5 h-3.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>Actions <ChevronDown size={12} /></>
                        )}
                      </button>

                      {openMenuId === org.id && (
                        <div className="absolute right-0 top-full mt-1 w-52 bg-[#0d1628] border border-[#1e2d4a] rounded-xl shadow-2xl shadow-black/50 z-50 py-1 overflow-hidden">
                          <button
                            onClick={() => { setProfileOrg(org); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-300 hover:bg-[#1e2d4a] transition-colors"
                          >
                            <Building2 size={13} />
                            Company Profile
                          </button>
                          <button
                            onClick={() => { setOverrideOrg(org); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-300 hover:bg-[#1e2d4a] transition-colors"
                          >
                            <Shield size={13} />
                            Subscription Override
                          </button>
                          <div className="border-t border-[#1e2d4a] my-1" />
                          {org.status === 'active' && (
                            <button
                              onClick={() => archiveOrg(org)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-amber-400 hover:bg-amber-900/20 transition-colors"
                            >
                              <Archive size={13} />
                              Archive Organisation
                            </button>
                          )}
                          {org.status === 'archived' && (
                            <button
                              onClick={() => restoreOrg(org)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-emerald-400 hover:bg-emerald-900/20 transition-colors"
                            >
                              <RotateCcw size={13} />
                              Restore Organisation
                            </button>
                          )}
                          <div className="border-t border-[#1e2d4a] my-1" />
                          <button
                            onClick={() => { setDeleteTarget(org); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-400 hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 size={13} />
                            Permanently Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmDeleteOrgModal
          org={deleteTarget}
          onConfirm={() => handleDeleteConfirmed(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
