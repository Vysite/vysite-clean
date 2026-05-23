import { useState, useRef } from 'react';
import {
  Building2, Bell, Palette, Shield, Users, Globe,
  ChevronRight, ToggleLeft, ToggleRight, Save, Upload,
  Hash, CheckSquare, ArrowLeft,
} from 'lucide-react';
import { useAppStore } from '../lib/StoreContext';
import type { DBSettings } from '../lib/store';

const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] transition-colors';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

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

// ─── Company Settings ─────────────────────────────────────────────────────────

function CompanySettings({ settings, onSave }: { settings: DBSettings; onSave: (s: DBSettings) => void }) {
  const [form, setForm] = useState({
    company_name: settings.company_name,
    company_address: settings.company_address,
    company_phone: settings.company_phone,
    company_email: settings.company_email,
    company_website: settings.company_website,
    pdf_footer: settings.pdf_footer,
    company_vat_number: settings.company_vat_number,
    company_number: settings.company_number,
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

  const fieldConfig: { key: keyof typeof form; label: string; multiline?: boolean; placeholder?: string }[] = [
    { key: 'company_name', label: 'Company Name', placeholder: 'e.g. Acme Construction Ltd' },
    { key: 'company_number', label: 'Companies House Number', placeholder: 'e.g. 12345678' },
    { key: 'company_address', label: 'Registered Address', multiline: true, placeholder: '14 Broad Street, London EC2M 1QS' },
    { key: 'company_phone', label: 'Phone Number', placeholder: '020 7123 4567' },
    { key: 'company_email', label: 'Email Address', placeholder: 'info@yourcompany.co.uk' },
    { key: 'company_website', label: 'Website', placeholder: 'www.yourcompany.co.uk' },
    { key: 'company_vat_number', label: 'VAT Number', placeholder: 'GB 123 4567 89' },
    { key: 'pdf_footer', label: 'PDF Report Footer', multiline: true, placeholder: 'Appears at the bottom of all exported reports' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-white">Company Identity</h3>
        <p className="text-xs text-slate-500 mt-1">These details appear on PDFs, reports and operational exports.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fieldConfig.map(({ key, label, multiline, placeholder }) => (
          <div key={key} className={multiline ? 'sm:col-span-2' : ''}>
            <label className={labelCls}>{label}</label>
            {multiline ? (
              <textarea value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                rows={2} placeholder={placeholder} className={`${inputCls} resize-none`} />
            ) : (
              <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} className={inputCls} />
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
          <Save size={14} />{saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <SavedBanner />}
      </div>
    </div>
  );
}

// ─── Branding Settings ────────────────────────────────────────────────────────

function BrandingSettings({ settings, onSave }: { settings: DBSettings; onSave: (s: DBSettings) => void }) {
  const [selectedColor, setSelectedColor] = useState(settings.accent_color || '#f97316');
  const [logoDataUrl, setLogoDataUrl] = useState(settings.logo_data_url || '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setLogoDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...settings, accent_color: selectedColor, logo_data_url: logoDataUrl });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const colors = [
    { color: '#f97316', label: 'Orange' },
    { color: '#3b82f6', label: 'Blue' },
    { color: '#10b981', label: 'Emerald' },
    { color: '#ef4444', label: 'Red' },
    { color: '#0891b2', label: 'Cyan' },
    { color: '#d97706', label: 'Amber' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-white">Branding</h3>
        <p className="text-xs text-slate-500 mt-1">Logo and platform appearance settings.</p>
      </div>

      <div>
        <label className={labelCls}>Company Logo</label>
        <div className="mt-2 flex items-center gap-4 flex-wrap">
          <div className="w-24 h-16 bg-[#0d1628] rounded-xl flex items-center justify-center border border-[#1e2d4a] overflow-hidden shrink-0">
            {logoDataUrl ? (
              <img src={logoDataUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : settings.logo_data_url ? (
              <img src={settings.logo_data_url} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <img src="/VYSITE_Logo_Long.png" alt="Logo" className="w-full h-full object-contain p-1" />
            )}
          </div>
          <div className="space-y-2">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] rounded-lg text-sm text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors">
              <Upload size={13} />Upload Logo
            </button>
            <p className="text-xs text-slate-600">PNG or SVG · Max 2MB · Recommended 240×80px</p>
            <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden" onChange={handleLogoUpload} />
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Platform Accent Colour</label>
        <p className="text-xs text-slate-600 mt-1 mb-3">Used for buttons, highlights and active states across the platform.</p>
        <div className="flex gap-4 flex-wrap">
          {colors.map(({ color, label }) => (
            <button key={color} onClick={() => setSelectedColor(color)} title={label}
              className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-lg border-2 transition-all ${selectedColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: color }} />
              <span className="text-[10px] text-slate-500">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
          <Save size={14} />{saving ? 'Saving…' : 'Save Branding'}
        </button>
        {saved && <SavedBanner />}
      </div>
    </div>
  );
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
            { label: 'RFI References', prefixKey: 'rfi_number_prefix' as const, startKey: 'rfi_number_start' as const, example: 'RFI-001' },
            { label: 'Snag References', prefixKey: 'snag_number_prefix' as const, startKey: 'snag_number_start' as const, example: 'SNG-001' },
            { label: 'Action References', prefixKey: 'action_number_prefix' as const, startKey: 'action_number_start' as const, example: 'ACT-001' },
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

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
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
  { id: 'company',       title: 'Company Identity',     description: 'Name, address, contact details and PDF footer', icon: Building2,   color: 'bg-orange-900/60 text-orange-400' },
  { id: 'branding',      title: 'Branding',             description: 'Logo upload and platform accent colour',        icon: Palette,     color: 'bg-blue-900/60 text-blue-400' },
  { id: 'notifications', title: 'Notifications',        description: 'Operational alerts and preference controls',    icon: Bell,        color: 'bg-amber-900/60 text-amber-400' },
  { id: 'operational',   title: 'Operational Settings', description: 'Defaults, priorities and numbering logic',      icon: CheckSquare, color: 'bg-emerald-900/60 text-emerald-400' },
  { id: 'users',         title: 'User Management',      description: 'Roles, permissions and access control',        icon: Users,       color: 'bg-teal-900/60 text-teal-400' },
  { id: 'security',      title: 'Security',             description: 'Password policy, 2FA and session control',     icon: Shield,      color: 'bg-red-900/60 text-red-400' },
  { id: 'integrations',  title: 'Integrations',         description: 'Connect to third-party tools and services',   icon: Globe,       color: 'bg-slate-700 text-slate-400' },
] as const;

type SectionId = typeof settingsSections[number]['id'];

// ─── Main Settings page ───────────────────────────────────────────────────────

export default function Settings() {
  const store = useAppStore();
  const isAdmin = store.currentUser?.role === 'Admin';
  const [activeSection, setActiveSection] = useState<SectionId | null>('company');

  const handleSave = async (updated: DBSettings) => {
    await store.updateSettings(updated);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'company':       return <CompanySettings settings={store.settings} onSave={handleSave} />;
      case 'branding':      return <BrandingSettings settings={store.settings} onSave={handleSave} />;
      case 'notifications': return <NotificationSettings settings={store.settings} onSave={handleSave} />;
      case 'operational':   return <OperationalSettings settings={store.settings} onSave={handleSave} />;
      case 'users':         return <ComingSoon title="User Management" icon={Users} />;
      case 'security':      return <ComingSoon title="Security Settings" icon={Shield} />;
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
              <div className="w-14 h-14 bg-orange-950/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building2 size={24} className="text-[#f97316]" />
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
