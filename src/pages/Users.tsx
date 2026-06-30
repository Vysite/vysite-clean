import { useState, useMemo } from 'react';
import {
  Plus, Mail, Building2, X, User, Calendar, CheckSquare, Shield,
  Search, CreditCard as Edit2, Trash2, ChevronDown, Eye,
  Lock, Unlock, Info, ChevronRight, ChevronUp, FlaskConical, AlertTriangle,
  Loader,
} from 'lucide-react';
import { useAppStore } from '../lib/StoreContext';
import { useAuth } from '../lib/AuthContext';
import { env } from '../lib/env';
import { supabase } from '../lib/supabase';
import type { DBPlatformUser, PlatformUserRole, PermissionKey, UserPermissions } from '../lib/store';
import { ROLE_PERMISSIONS, resolvePermissions } from '../lib/store';
import { logActivity } from '../lib/activityLog';

// ─── Role config ──────────────────────────────────────────────────────────────

const ALL_ROLES: PlatformUserRole[] = [
  'Admin',
  'Commercial Lead',
  'Project Manager',
  'Site Manager',
  'Engineer',
  'Estimator / QS',
  'Client',
  'External / Subcontractor',
];

const ROLE_COLORS: Record<string, string> = {
  Admin:                    'bg-red-900/60 text-red-400',
  'Commercial Lead':        'bg-amber-900/60 text-amber-400',
  'Project Manager':        'bg-orange-900/60 text-orange-400',
  'Site Manager':           'bg-sky-900/60 text-sky-400',
  Engineer:                 'bg-blue-900/60 text-blue-400',
  'Estimator / QS':         'bg-teal-900/60 text-teal-400',
  Client:                   'bg-emerald-900/60 text-emerald-400',
  'External / Subcontractor': 'bg-slate-700 text-slate-300',
  // Legacy
  Manager:                  'bg-orange-900/60 text-orange-400',
  User:                     'bg-blue-900/60 text-blue-400',
  'Client User':            'bg-teal-900/60 text-teal-400',
};

const ROLE_DESCRIPTIONS: Partial<Record<PlatformUserRole, string>> = {
  Admin:                    'Full system access. Manages users, settings, and all commercial data.',
  'Commercial Lead':        'Full commercial access. View and edit all tenders, pricing, and AI tools.',
  'Project Manager':        'Manages assigned projects. Can create RFIs, qualifications, and risks. Pricing access optional.',
  'Site Manager':           'View-only on site-relevant items. Can create queries and upload site documents.',
  Engineer:                 'Technical access. Can create RFIs and upload/view technical documents.',
  'Estimator / QS':         'Full tender and commercial access. Runs AI reviews and exports clarification packs.',
  Client:                   'Least privileged role. View assigned project only. No tender, pricing, AI, or document library access. Admins grant additional access per user as needed.',
  'External / Subcontractor': 'Respond to assigned tickets and upload supporting documents only. No tender, pricing, or document access unless explicitly granted.',
  Manager:                  'Full project access — can create and manage all items.',
  User:                     'Can raise snags, forms and actions. View-only on commercial items.',
  'Client User':            'View-only access to assigned projects. Cannot edit or access internal data.',
};

// ─── Permission groups ────────────────────────────────────────────────────────

interface PermGroup {
  label: string;
  keys: { key: PermissionKey; label: string }[];
}

const PERM_GROUPS: PermGroup[] = [
  {
    label: 'Projects',
    keys: [
      { key: 'projects.view_all',      label: 'View all projects' },
      { key: 'projects.view_assigned', label: 'View assigned projects' },
      { key: 'projects.create',        label: 'Create projects' },
      { key: 'projects.edit',          label: 'Edit projects' },
      { key: 'projects.archive',          label: 'Archive projects' },
      { key: 'projects.delete',           label: 'Delete projects' },
      { key: 'projects.view_financials',  label: 'View project financial values' },
    ],
  },
  {
    label: 'Tender Tracker',
    keys: [
      { key: 'tender.view',               label: 'View tender tracker' },
      { key: 'tender.rfi.create',         label: 'Create RFIs' },
      { key: 'tender.rfi.edit',           label: 'Edit RFIs' },
      { key: 'tender.rfi.delete',         label: 'Delete RFIs' },
      { key: 'tender.assumptions.edit',   label: 'Create/edit assumptions' },
      { key: 'tender.exclusions.edit',    label: 'Create/edit exclusions' },
      { key: 'tender.scope_notes.edit',   label: 'Create/edit qualifications' },
      { key: 'tender.risks.edit',         label: 'Create/edit risks' },
      { key: 'tender.reclassify',         label: 'Reclassify items' },
      { key: 'tender.reconcile',          label: 'Reconcile findings' },
      { key: 'tender.view_financials',    label: 'View tender financial values' },
    ],
  },
  {
    label: 'Commercial',
    keys: [
      { key: 'commercial.view_pricing',                  label: 'View pricing' },
      { key: 'commercial.edit_pricing',                  label: 'Edit pricing' },
      { key: 'commercial.view_rates',                    label: 'View rates' },
      { key: 'commercial.view_values',                   label: 'View financial totals' },
      { key: 'commercial.view_reports',                  label: 'View commercial reports' },
      { key: 'commercial.export_reports',                label: 'Export commercial reports' },
      { key: 'commercial.edit_project_finance_progress', label: 'Edit project finance/progress bar' },
    ],
  },
  {
    label: 'AI Tools',
    keys: [
      { key: 'ai.upload_docs',       label: 'Upload documents for AI review' },
      { key: 'ai.run_review',        label: 'Run AI review' },
      { key: 'ai.approve_findings',  label: 'Approve AI findings' },
      { key: 'ai.reconcile',         label: 'Reconcile AI findings' },
      { key: 'ai.import',            label: 'Import ChatGPT/Excel findings' },
      { key: 'ai.export',            label: 'Export AI outputs' },
    ],
  },
  {
    label: 'Documents',
    keys: [
      { key: 'docs.view',              label: 'View documents' },
      { key: 'docs.upload',            label: 'Upload documents' },
      { key: 'docs.download',          label: 'Download documents' },
      { key: 'docs.delete',            label: 'Delete documents' },
      { key: 'docs.view_confidential', label: 'View confidential documents' },
    ],
  },
  {
    label: 'Module Access',
    keys: [
      { key: 'modules.projects',    label: 'Access Projects' },
      { key: 'modules.snagging',    label: 'Access Snagging' },
      { key: 'modules.actions',     label: 'Access Actions Tracker' },
      { key: 'modules.site_forms',  label: 'Access Site Forms' },
      { key: 'modules.testing',     label: 'Access O&M Manual' },
      { key: 'modules.reports',     label: 'Access Reports' },
      { key: 'modules.comments',    label: 'Access Comments / Activity' },
      { key: 'modules.commercial',  label: 'Access Commercial' },
    ],
  },
  {
    label: 'Maintenance & Servicing',
    keys: [
      { key: 'maintenance.view',      label: 'View maintenance jobs' },
      { key: 'maintenance.create',    label: 'Create new jobs' },
      { key: 'maintenance.edit',      label: 'Edit job details' },
      { key: 'maintenance.delete',    label: 'Delete jobs' },
      { key: 'maintenance.assign',    label: 'Assign engineers' },
      { key: 'maintenance.export',    label: 'Export job reports' },
      { key: 'maintenance.comment',   label: 'Add comments / notes' },
      { key: 'maintenance.upload',    label: 'Upload files' },
      { key: 'maintenance.complete',  label: 'Mark jobs complete' },
    ],
  },
  {
    label: 'Programmes',
    keys: [
      { key: 'programmes.view',    label: 'View programmes' },
      { key: 'programmes.create',  label: 'Create programmes & tasks' },
      { key: 'programmes.edit',    label: 'Edit programmes & tasks' },
      { key: 'programmes.delete',  label: 'Delete programmes & tasks' },
      { key: 'programmes.export',  label: 'Export programme PDFs' },
    ],
  },
  {
    label: 'Snagging',
    keys: [
      { key: 'snagging.create',  label: 'Raise snags' },
      { key: 'snagging.edit',    label: 'Edit snags' },
      { key: 'snagging.delete',  label: 'Delete snags' },
      { key: 'snagging.export',  label: 'Export snag reports' },
    ],
  },
  {
    label: 'Actions',
    keys: [
      { key: 'actions.create',  label: 'Create actions' },
      { key: 'actions.edit',    label: 'Edit actions' },
      { key: 'actions.delete',  label: 'Delete actions' },
      { key: 'actions.export',  label: 'Export action reports' },
    ],
  },
  {
    label: 'Site Forms',
    keys: [
      { key: 'site_forms.create',  label: 'Create site forms' },
      { key: 'site_forms.edit',    label: 'Edit site forms' },
      { key: 'site_forms.delete',  label: 'Delete site forms' },
      { key: 'site_forms.export',  label: 'Export/print site forms' },
    ],
  },
  {
    label: 'Testing & Commissioning',
    keys: [
      { key: 'commissioning.create',  label: 'Create T&C records' },
      { key: 'commissioning.edit',    label: 'Edit T&C records' },
      { key: 'commissioning.delete',  label: 'Delete T&C records' },
      { key: 'commissioning.export',  label: 'Export T&C certificates' },
    ],
  },
  {
    label: 'Client & External',
    keys: [
      { key: 'external.comment_only',         label: 'Comment only' },
      { key: 'external.respond_tickets',       label: 'Respond to assigned tickets' },
      { key: 'external.upload_responses',      label: 'Upload response files' },
      { key: 'external.view_shared_reports',   label: 'View shared reports only' },
    ],
  },
  {
    label: 'Administration',
    keys: [
      { key: 'admin.invite_users',              label: 'Invite users' },
      { key: 'admin.edit_users',                label: 'Edit users' },
      { key: 'admin.assign_permissions',        label: 'Assign permissions' },
      { key: 'admin.view_audit_logs',           label: 'View audit logs' },
      { key: 'admin.view_activity_register',    label: 'View Activity Register' },
      { key: 'admin.manage_settings',           label: 'Manage company settings' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const avatarColors = [
  'bg-orange-500','bg-blue-500','bg-emerald-500','bg-teal-500',
  'bg-rose-500','bg-amber-500','bg-cyan-500','bg-sky-500',
];
function getAvatarColor(idx: number) { return avatarColors[idx % avatarColors.length]; }

function isTestUser(user: DBPlatformUser): boolean {
  return user.permissions?.is_test_user === true || user.email.endsWith('@vysite.local');
}

function TestBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-900/60 text-amber-400 border border-amber-700/50 uppercase tracking-wider shrink-0">
      <FlaskConical size={8} />TEST
    </span>
  );
}

function RoleBadge({ role }: { role: PlatformUserRole }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[role] ?? 'bg-slate-700 text-slate-300'}`}>
      {role}
    </span>
  );
}

// ─── Permissions panel ────────────────────────────────────────────────────────

interface PermissionsPanelProps {
  role: PlatformUserRole;
  overrides: UserPermissions;
  onChange: (overrides: UserPermissions) => void;
}

function PermissionsPanel({ role, overrides, onChange }: PermissionsPanelProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['Projects', 'Tender Tracker']));
  const roleDefaults = ROLE_PERMISSIONS[role] ?? {};

  function toggleGroup(label: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  function getState(key: PermissionKey): 'override-on' | 'override-off' | 'default-on' | 'default-off' {
    if (key in overrides) return overrides[key] ? 'override-on' : 'override-off';
    return roleDefaults[key] ? 'default-on' : 'default-off';
  }

  function togglePerm(key: PermissionKey) {
    const current = getState(key);
    const roleDefault = roleDefaults[key] ?? false;
    if (current === 'default-on') {
      // Override to off
      onChange({ ...overrides, [key]: false });
    } else if (current === 'default-off') {
      // Override to on
      onChange({ ...overrides, [key]: true });
    } else if (current === 'override-on') {
      // Remove override if it matches the default, otherwise toggle
      if (roleDefault) {
        const next = { ...overrides }; delete next[key]; onChange(next);
      } else {
        onChange({ ...overrides, [key]: false });
      }
    } else {
      // override-off -> remove override if default is off, otherwise turn on
      if (!roleDefault) {
        const next = { ...overrides }; delete next[key]; onChange(next);
      } else {
        onChange({ ...overrides, [key]: true });
      }
    }
  }

  function resetAllOverrides() {
    onChange({});
  }

  const overrideCount = Object.keys(overrides).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={13} className="text-[#f97316]" />
          <span className="text-xs font-bold text-slate-300">Permission Overrides</span>
        </div>
        <div className="flex items-center gap-3">
          {overrideCount > 0 && (
            <button
              type="button"
              onClick={resetAllOverrides}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Reset all ({overrideCount})
            </button>
          )}
          <span className="text-[10px] text-slate-600 italic">Role: {role}</span>
        </div>
      </div>

      <div className="bg-[#0a1120] border border-[#1e2d4a] rounded-xl overflow-hidden">
        <div className="flex items-start gap-2.5 px-3 py-2.5 border-b border-[#1e2d4a]">
          <Info size={11} className="text-slate-600 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-600 leading-relaxed">
            Checkboxes show role defaults. Toggle to override for this user only. Overrides are highlighted in orange.
          </p>
        </div>

        {PERM_GROUPS.map(group => {
          const isOpen = openGroups.has(group.label);
          const groupOverrides = group.keys.filter(({ key }) => key in overrides).length;
          const groupEnabled = group.keys.filter(({ key }) => {
            const st = getState(key);
            return st === 'default-on' || st === 'override-on';
          }).length;

          return (
            <div key={group.label} className="border-b border-[#1e2d4a] last:border-b-0">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#111827] transition-colors text-left"
              >
                {isOpen ? <ChevronUp size={11} className="text-slate-600 shrink-0" /> : <ChevronRight size={11} className="text-slate-600 shrink-0" />}
                <span className="text-[11px] font-bold text-slate-400 flex-1">{group.label}</span>
                <span className="text-[9px] text-slate-600 shrink-0">{groupEnabled}/{group.keys.length}</span>
                {groupOverrides > 0 && (
                  <span className="text-[9px] bg-[#f97316]/20 text-[#f97316] px-1.5 py-0.5 rounded-full font-bold">{groupOverrides} override{groupOverrides !== 1 ? 's' : ''}</span>
                )}
              </button>

              {isOpen && (
                <div className="px-3 pb-2 space-y-0.5">
                  {group.keys.map(({ key, label }) => {
                    const state = getState(key);
                    const isOn = state === 'default-on' || state === 'override-on';
                    const isOverride = state === 'override-on' || state === 'override-off';

                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          isOverride ? 'bg-[#f97316]/5 hover:bg-[#f97316]/10' : 'hover:bg-[#111827]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={() => togglePerm(key)}
                          className="w-3.5 h-3.5 rounded accent-orange-500 shrink-0"
                        />
                        <span className={`text-xs flex-1 ${isOn ? 'text-slate-300' : 'text-slate-600'}`}>
                          {label}
                        </span>
                        {isOverride && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                            isOn ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                          }`}>
                            {isOn ? 'Granted' : 'Denied'}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── View Profile Modal ───────────────────────────────────────────────────────

interface ViewProfileModalProps {
  user: DBPlatformUser;
  idx: number;
  onClose: () => void;
  onEdit: () => void;
}

function ViewProfileModal({ user, idx, onClose, onEdit }: ViewProfileModalProps) {
  const store = useAppStore();
  const [showPerms, setShowPerms] = useState(false);

  const userActions = store.actions.filter(a => a.owner === user.name);
  const userSnags = store.snags.filter(s => s.assignedTo === user.name);
  const openActions = userActions.filter(a => a.status !== 'Complete');
  const overdueActions = userActions.filter(a => a.overdue);
  const openSnags = userSnags.filter(s => s.status !== 'Closed');
  const assignedProjects = store.projects.filter(p => user.assigned_project_ids.includes(p.id));
  const resolved = resolvePermissions(user);
  const isTest = isTestUser(user);
  // Exclude is_test_user flag from displayed override count
  const overrideCount = Object.keys(user.permissions ?? {}).filter(k => k !== 'is_test_user').length;

  const isClientLike = user.role === 'Client' || user.role === 'Client User' || user.role === 'External / Subcontractor';

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className={`bg-[#1a2236] rounded-2xl border shadow-2xl w-full max-w-2xl my-4 ${isTest ? 'border-amber-700/50' : 'border-[#1e2d4a]'}`}>
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">User Profile</h2>
            {isTest && <TestBadge />}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors">
              <Edit2 size={12} />Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Test user banner */}
          {isTest && (
            <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-700/40 rounded-xl p-3.5">
              <FlaskConical size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-400">Test Account — Remove Before Launch</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  This is a seeded test user for role and permission validation only. Delete from the Users page before going live.
                </p>
              </div>
            </div>
          )}

          {/* Identity */}
          <div className="flex items-start gap-5">
            <div className={`w-16 h-16 rounded-2xl ${getAvatarColor(idx)} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
              {user.avatar_initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-white">{user.name}</h3>
                <RoleBadge role={user.role} />
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${user.status === 'Active' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                  {user.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-400 mt-1">
                <span className="flex items-center gap-1.5"><Mail size={13} className="text-slate-600" />{user.email}</span>
                {user.company && <span className="flex items-center gap-1.5"><Building2 size={13} className="text-slate-600" />{user.company}</span>}
                <span className="flex items-center gap-1.5"><Calendar size={13} className="text-slate-600" />
                  Joined {new Date(user.join_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">{ROLE_DESCRIPTIONS[user.role]}</p>
            </div>
          </div>

          {isClientLike && (
            <div className="flex items-start gap-3 bg-teal-900/20 border border-teal-800/40 rounded-xl p-4">
              <Eye size={15} className="text-teal-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-teal-400">Restricted Access — No Tender or Commercial Visibility</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  This user cannot access the tender tracker, pricing, AI review, assumptions, exclusions, or the document library. Any access beyond viewing their assigned project must be granted explicitly by an Admin.
                </p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4 text-center">
              <p className="text-2xl font-bold text-white">{openActions.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Open Actions</p>
            </div>
            <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4 text-center">
              <p className={`text-2xl font-bold ${overdueActions.length > 0 ? 'text-red-400' : 'text-white'}`}>{overdueActions.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Overdue</p>
            </div>
            <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4 text-center">
              <p className="text-2xl font-bold text-white">{openSnags.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Open Snags</p>
            </div>
          </div>

          {/* Projects */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Assigned Projects</p>
            {assignedProjects.length === 0 ? (
              <p className="text-sm text-slate-600">No projects currently assigned.</p>
            ) : (
              <div className="space-y-2">
                {assignedProjects.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-[#0d1628] rounded-xl border border-[#1e2d4a] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.client}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      p.status === 'Active' ? 'bg-emerald-900/60 text-emerald-400' :
                      p.status === 'On Hold' ? 'bg-amber-900/60 text-amber-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Permission summary */}
          <div>
            <button
              onClick={() => setShowPerms(s => !s)}
              className="flex items-center gap-2 w-full text-left mb-3"
            >
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex-1">Effective Permissions</p>
              {overrideCount > 0 && (
                <span className="text-[9px] bg-[#f97316]/20 text-[#f97316] px-2 py-0.5 rounded-full font-bold">{overrideCount} override{overrideCount !== 1 ? 's' : ''}</span>
              )}
              {showPerms ? <ChevronUp size={12} className="text-slate-600" /> : <ChevronDown size={12} className="text-slate-600" />}
            </button>
            {showPerms && (
              <div className="space-y-3">
                {PERM_GROUPS.map(group => {
                  const granted = group.keys.filter(({ key }) => resolved[key]);
                  if (granted.length === 0) return null;
                  return (
                    <div key={group.label} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">{group.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {granted.map(({ key, label }) => {
                          const isOverride = (user.permissions ?? {})[key] !== undefined;
                          return (
                            <span key={key} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              isOverride
                                ? 'bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent actions */}
          {userActions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Recent Actions</p>
              <div className="space-y-2">
                {userActions.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-start justify-between bg-[#0d1628] rounded-xl border border-[#1e2d4a] px-4 py-3 gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <CheckSquare size={13} className="text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-slate-300 line-clamp-1">{a.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.overdue && <span className="text-[9px] font-bold text-red-400 bg-red-900/50 px-1.5 py-0.5 rounded-full border border-red-800">OVERDUE</span>}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        a.status === 'Complete' ? 'bg-emerald-900/60 text-emerald-400' :
                        a.status === 'In Progress' ? 'bg-blue-900/60 text-blue-400' :
                        'bg-[#1e2d4a] text-slate-400'
                      }`}>{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end p-6 border-t border-[#1e2d4a]">
          <button onClick={onClose} className="px-5 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-300 hover:bg-[#1e2d4a] transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit / Invite / Add User Modal ──────────────────────────────────────────

type FormTab = 'details' | 'permissions';

interface UserFormModalProps {
  existing?: DBPlatformUser;
  mode?: 'invite' | 'add' | 'edit';
  onClose: () => void;
  onSave: (u: DBPlatformUser) => void;
  onInviteSuccess?: (u: DBPlatformUser, authUserId: string) => void;
}

function UserFormModal({ existing, mode = existing ? 'edit' : 'invite', onClose, onSave, onInviteSuccess }: UserFormModalProps) {
  const store = useAppStore();
  const auth = useAuth();
  const isEdit = mode === 'edit';
  const [activeTab, setActiveTab] = useState<FormTab>('details');

  const [form, setForm] = useState({
    name: existing?.name ?? '',
    email: existing?.email ?? '',
    role: (existing?.role ?? 'Project Manager') as PlatformUserRole,
    company: existing?.company ?? store.settings.company_name ?? '',
    status: (existing?.status ?? 'Active') as 'Active' | 'Inactive',
    assigned_project_ids: existing?.assigned_project_ids ?? [] as string[],
  });
  const [permOverrides, setPermOverrides] = useState<UserPermissions>(existing?.permissions ?? {});
  const [sent, setSent] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  const toggleProject = (id: string) => {
    setForm(f => ({
      ...f,
      assigned_project_ids: f.assigned_project_ids.includes(id)
        ? f.assigned_project_ids.filter(x => x !== id)
        : [...f.assigned_project_ids, id],
    }));
  };

  function handleRoleChange(role: PlatformUserRole) {
    setForm(f => ({ ...f, role }));
    if (!isEdit) setPermOverrides({});
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    const initials = form.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const user: DBPlatformUser = {
      id: existing?.id ?? `pu-${Date.now()}`,
      name: form.name,
      email: form.email,
      role: form.role,
      company: form.company,
      status: form.status,
      avatar_initials: existing?.avatar_initials ?? initials,
      join_date: existing?.join_date ?? new Date().toISOString().split('T')[0],
      assigned_project_ids: form.assigned_project_ids,
      permissions: Object.keys(permOverrides).length > 0 ? permOverrides : null,
      org_id: existing?.org_id ?? null,
      auth_user_id: existing?.auth_user_id ?? null,
    };

    if (mode === 'invite') {
      setInviting(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? auth.session?.access_token;
        if (!token) {
          setInviteError('You must be logged in to invite users.');
          setInviting(false);
          return;
        }

        const res = await fetch(
          `${env.supabaseUrl}/functions/v1/invite-org-user`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: form.email.trim().toLowerCase(),
              name: form.name.trim(),
              role: form.role,
              company: form.company,
              assigned_project_ids: form.assigned_project_ids,
              permissions: Object.keys(permOverrides).length > 0 ? permOverrides : null,
            }),
          }
        );

        const json = await res.json();

        if (!res.ok) {
          setInviteError(json.error ?? 'Invite failed. Please try again.');
          setInviting(false);
          return;
        }

        // Invite succeeded — notify parent with the created user data
        const invitedUser: DBPlatformUser = {
          ...user,
          id: `pu-${json.auth_user_id}`,
          auth_user_id: json.auth_user_id,
        };
        onInviteSuccess?.(invitedUser, json.auth_user_id);
        setSent(true);
        setTimeout(() => onClose(), 3000);
      } catch {
        setInviteError('Network error — invite not sent. Please check your connection and try again.');
        setInviting(false);
      }
      return;
    }

    onSave(user);
    onClose();
  };

  const overrideCount = Object.keys(permOverrides).length;
  const tabCls = (t: FormTab) =>
    `px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
      activeTab === t ? 'text-[#f97316] border-[#f97316]' : 'text-slate-500 border-transparent hover:text-slate-300'
    }`;

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a] shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">
              {mode === 'edit' ? 'Edit User' : mode === 'add' ? 'Add User' : 'Invite Team Member'}
            </h2>
            {mode === 'invite' && <p className="text-xs text-slate-500 mt-0.5">They will receive an email invitation to join VYSITE.</p>}
            {mode === 'add' && <p className="text-xs text-slate-500 mt-0.5">Create an internal account directly. No email sent.</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-900/40 border border-emerald-700 flex items-center justify-center mx-auto mb-4">
              <Mail size={24} className="text-emerald-400" />
            </div>
            <p className="text-white font-bold mb-1">Invitation Sent</p>
            <p className="text-sm text-slate-400">An invitation email has been sent to <span className="text-[#f97316]">{form.email}</span></p>
            <p className="text-xs text-slate-600 mt-2">They will receive a link to create their password and access VYSITE.</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-[#1e2d4a] px-5 shrink-0">
              <button className={tabCls('details')} onClick={() => setActiveTab('details')}>Details</button>
              <button className={tabCls('permissions')} onClick={() => setActiveTab('permissions')}>
                Permissions
                {overrideCount > 0 && (
                  <span className="ml-1.5 text-[9px] bg-[#f97316]/30 text-[#f97316] px-1.5 py-0.5 rounded-full font-bold">{overrideCount}</span>
                )}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              {activeTab === 'details' && (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Full Name *</label>
                      <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. John Smith" />
                    </div>
                    <div>
                      <label className={labelCls}>Email Address *</label>
                      <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="john@company.co.uk" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Role</label>
                      <div className="relative mt-1.5">
                        <select
                          value={form.role}
                          onChange={e => handleRoleChange(e.target.value as PlatformUserRole)}
                          className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] appearance-none pr-8"
                        >
                          {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Company</label>
                      <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={inputCls} />
                    </div>
                  </div>

                  {isEdit && (
                    <div>
                      <label className={labelCls}>Status</label>
                      <div className="flex gap-2 mt-1.5">
                        {(['Active', 'Inactive'] as const).map(s => (
                          <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                              form.status === s
                                ? s === 'Active' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-600 text-white border-slate-600'
                                : 'bg-[#0d1628] text-slate-400 border-[#1e2d4a] hover:border-slate-500'
                            }`}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Role description */}
                  <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
                    <div className="flex items-start gap-3">
                      <Shield size={15} className="text-[#f97316] mt-0.5 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-semibold text-slate-300">Base Role: <span className="text-[#f97316]">{form.role}</span></p>
                          {overrideCount > 0 && (
                            <span className="text-[9px] bg-[#f97316]/20 text-[#f97316] px-1.5 py-0.5 rounded-full font-bold">{overrideCount} override{overrideCount !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{ROLE_DESCRIPTIONS[form.role]}</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('permissions')}
                          className="mt-2 text-[10px] text-[#f97316] hover:text-orange-400 transition-colors font-semibold"
                        >
                          Customise permissions →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Project assignment */}
                  <div>
                    <label className={labelCls}>Assign to Projects</label>
                    <div className="mt-2 space-y-1.5">
                      {store.projects.length === 0 && (
                        <p className="text-xs text-slate-600 italic">No projects yet.</p>
                      )}
                      {store.projects.map(p => (
                        <label key={p.id} className="flex items-center gap-3 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-600 transition-colors">
                          <input type="checkbox" checked={form.assigned_project_ids.includes(p.id)} onChange={() => toggleProject(p.id)}
                            className="w-4 h-4 rounded accent-orange-500" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{p.name}</p>
                            <p className="text-xs text-slate-500 truncate">{p.client}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                            p.status === 'Active' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-amber-900/60 text-amber-400'
                          }`}>{p.status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'permissions' && (
                <div className="p-5">
                  <PermissionsPanel
                    role={form.role}
                    overrides={permOverrides}
                    onChange={setPermOverrides}
                  />
                </div>
              )}

              {/* Footer */}
              <div className="px-5 pb-5 space-y-3">
                {inviteError && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
                    <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300 leading-relaxed">{inviteError}</p>
                  </div>
                )}
                <div className="flex gap-3 border-t border-[#1e2d4a] pt-4">
                  <button type="button" onClick={onClose} disabled={inviting} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors disabled:opacity-50">Cancel</button>
                  <button type="submit" disabled={inviting} className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
                    {inviting
                      ? <><Loader size={14} className="animate-spin" />Sending…</>
                      : mode === 'edit' ? <><Edit2 size={14} />Save Changes</>
                      : mode === 'add' ? <><Plus size={14} />Add User</>
                      : <><Mail size={14} />Send Invitation</>
                    }
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Delete User Confirm Modal ────────────────────────────────────────────────

function DeleteUserModal({ user, onClose, onConfirm }: { user: DBPlatformUser; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-sm">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-900/40 border border-red-800 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={20} className="text-red-400" />
          </div>
          <h3 className="text-base font-bold text-white text-center mb-2">Delete User</h3>
          <p className="text-sm text-slate-400 text-center mb-1">
            <span className="font-semibold text-slate-200">{user.name}</span>
          </p>
          <p className="text-sm text-slate-500 text-center mb-6">
            This permanently removes the user from the system. Historical operational records may still retain references for audit purposes.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">Delete User</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Users() {
  const store = useAppStore();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [viewProfile, setViewProfile] = useState<{ user: DBPlatformUser; idx: number } | null>(null);
  const [editUser, setEditUser] = useState<DBPlatformUser | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DBPlatformUser | null>(null);
  const [showDeleteTestConfirm, setShowDeleteTestConfirm] = useState(false);
  const [deletingTests, setDeletingTests] = useState(false);

  const platformUsers = store.platformUsers;

  const filtered = useMemo(() => platformUsers.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.company.toLowerCase().includes(search.toLowerCase());
    return matchSearch
      && (filterRole === 'All' || u.role === filterRole)
      && (filterStatus === 'All' || u.status === filterStatus);
  }), [platformUsers, search, filterRole, filterStatus]);

  const stats = useMemo(() => ({
    total: platformUsers.filter(u => u.status === 'Active').length,
    admins: platformUsers.filter(u => u.role === 'Admin').length,
    commercial: platformUsers.filter(u => ['Commercial Lead', 'Estimator / QS', 'Manager'].includes(u.role)).length,
    external: platformUsers.filter(u => ['Client', 'Client User', 'External / Subcontractor'].includes(u.role)).length,
  }), [platformUsers]);

  const handleSaveUser = async (u: DBPlatformUser) => {
    const isEdit = !!platformUsers.find(x => x.id === u.id);
    if (isEdit) {
      const prev = platformUsers.find(x => x.id === u.id);
      await store.updatePlatformUser(u);
      const permChanged = JSON.stringify(prev?.permissions) !== JSON.stringify(u.permissions);
      const roleChanged = prev?.role !== u.role;
      if (permChanged || roleChanged) {
        logActivity({
          orgId: store.currentOrgId ?? '',
          userName: store.currentUser?.name ?? '',
          module: 'users', recordRef: u.name,
          actionType: 'permission_changed',
          description: `${store.currentUser?.name ?? 'Unknown'} updated permissions/role for ${u.name}${roleChanged ? ` (role: ${prev?.role} → ${u.role})` : ''}`,
          prevValue: roleChanged ? prev?.role : undefined,
          newValue: roleChanged ? u.role : undefined,
        });
      } else {
        logActivity({
          orgId: store.currentOrgId ?? '',
          userName: store.currentUser?.name ?? '',
          module: 'users', recordRef: u.name,
          actionType: 'user_updated',
          description: `${store.currentUser?.name ?? 'Unknown'} updated user profile for ${u.name}`,
        });
      }
    } else {
      await store.addPlatformUser(u);
      logActivity({
        orgId: store.currentOrgId ?? '',
        userName: store.currentUser?.name ?? '',
        module: 'users', recordRef: u.name,
        actionType: 'user_created',
        description: `${store.currentUser?.name ?? 'Unknown'} created user ${u.name} (${u.email}) with role ${u.role}`,
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    const session = (await supabase.auth.getSession()).data.session;
    const res = await fetch(
      `${env.supabaseUrl}/functions/v1/remove-org-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'Apikey': env.supabaseAnonKey,
        },
        body: JSON.stringify({ platform_user_id: deleteTarget.id }),
      }
    );
    if (res.ok) {
      logActivity({
        orgId: store.currentOrgId ?? '',
        userName: store.currentUser?.name ?? '',
        module: 'users', recordRef: deleteTarget.name,
        actionType: 'user_removed',
        description: `${store.currentUser?.name ?? 'Unknown'} removed user ${deleteTarget.name} (${deleteTarget.email})`,
        metadata: { removedEmail: deleteTarget.email, removedRole: deleteTarget.role },
      });
      store.removePlatformUser(deleteTarget.id);
    } else {
      const body = await res.json().catch(() => ({}));
      console.error('[Users] remove-org-user failed:', body);
      alert(`Failed to delete user: ${body.error ?? res.statusText}`);
    }
    setDeleteTarget(null);
  };

  const testUserCount = platformUsers.filter(isTestUser).length;

  const handleDeleteAllTestUsers = async () => {
    setDeletingTests(true);
    const session = (await supabase.auth.getSession()).data.session;
    const testUsers = platformUsers.filter(isTestUser);
    for (const u of testUsers) {
      const res = await fetch(
        `${env.supabaseUrl}/functions/v1/remove-org-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
            'Apikey': env.supabaseAnonKey,
          },
          body: JSON.stringify({ platform_user_id: u.id }),
        }
      );
      if (res.ok) {
        store.removePlatformUser(u.id);
      } else {
        const body = await res.json().catch(() => ({}));
        console.error('[Users] remove-org-user failed for test user:', u.email, body);
      }
    }
    setDeletingTests(false);
    setShowDeleteTestConfirm(false);
  };

  const liveProfile = viewProfile
    ? (platformUsers.find(u => u.id === viewProfile.user.id) ?? viewProfile.user)
    : null;

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Users</h2>
          <p className="text-sm text-slate-500">{stats.total} active team members</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {testUserCount > 0 && (
            <button
              onClick={() => setShowDeleteTestConfirm(true)}
              className="flex items-center gap-2 border border-amber-700/50 text-amber-400 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-900/20 transition-colors"
            >
              <FlaskConical size={15} />Delete Test Users ({testUserCount})
            </button>
          )}
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 border border-[#1e2d4a] text-slate-300 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1e2d4a] transition-colors">
            <Plus size={16} />Add User
          </button>
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
            <Mail size={16} />Invite User
          </button>
        </div>
      </div>

      {/* Test user warning banner */}
      {testUserCount > 0 && (
        <div className="flex items-start gap-3 bg-amber-900/15 border border-amber-800/40 rounded-xl px-4 py-3 mb-5">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-400">
            <span className="font-bold">{testUserCount} test account{testUserCount !== 1 ? 's' : ''} active.</span>
            {' '}These are seeded for role and permission validation only. Delete them before going live.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active Users',       value: stats.total,      color: 'text-white' },
          { label: 'Admins',             value: stats.admins,     color: 'text-red-400' },
          { label: 'Commercial',         value: stats.commercial, color: 'text-amber-400' },
          { label: 'Client / External',  value: stats.external,   color: 'text-teal-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={14} className="text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
            {['All', ...ALL_ROLES].map(r => (
              <button key={r} onClick={() => setFilterRole(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${filterRole === r ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{r}</button>
            ))}
          </div>
          <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1">
            {['All', 'Active', 'Inactive'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${filterStatus === s ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* User cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((user, idx) => {
          const userActions = store.actions.filter(a => a.owner === user.name && a.status !== 'Complete');
          const overdueCount = store.actions.filter(a => a.owner === user.name && a.overdue).length;
          const openSnags = store.snags.filter(s => s.assignedTo === user.name && s.status !== 'Closed').length;
          const overrideCount = Object.keys(user.permissions ?? {}).filter(k => k !== 'is_test_user').length;
          const isClientLike = ['Client', 'Client User', 'External / Subcontractor'].includes(user.role);
          const testUser = isTestUser(user);

          return (
            <div key={user.id} className={`bg-[#1a2236] rounded-xl border transition-all ${
              testUser ? 'border-amber-800/40 hover:border-amber-700/60'
              : user.status === 'Inactive' ? 'border-[#1e2d4a] opacity-60'
              : 'border-[#1e2d4a] hover:border-[#2a3d5a]'
            }`}>
              {testUser && (
                <div className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-900/20 border-b border-amber-800/30 rounded-t-xl">
                  <FlaskConical size={9} className="text-amber-500" />
                  <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Test Account — Remove Before Launch</span>
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${getAvatarColor(idx)} flex items-center justify-center text-white font-bold text-sm shrink-0 ${user.status === 'Inactive' ? 'grayscale' : ''}`}>
                    {user.avatar_initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{user.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <RoleBadge role={user.role} />
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-[#1e2d4a] text-slate-500'}`}>{user.status}</span>
                      {testUser && <TestBadge />}
                      {overrideCount > 0 && (
                        <span className="text-[9px] bg-[#f97316]/15 text-[#f97316]/80 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                          <Lock size={7} />{overrideCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Mail size={12} className="text-slate-600 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  {user.company && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Building2 size={12} className="text-slate-600 shrink-0" />
                      <span className="truncate">{user.company}</span>
                    </div>
                  )}
                </div>

                {!isClientLike && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="bg-[#0d1628] rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-white">{userActions.length}</p>
                      <p className="text-[10px] text-slate-600">Actions</p>
                    </div>
                    <div className="bg-[#0d1628] rounded-lg p-2 text-center">
                      <p className={`text-sm font-bold ${overdueCount > 0 ? 'text-red-400' : 'text-white'}`}>{overdueCount}</p>
                      <p className="text-[10px] text-slate-600">Overdue</p>
                    </div>
                    <div className="bg-[#0d1628] rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-white">{openSnags}</p>
                      <p className="text-[10px] text-slate-600">Snags</p>
                    </div>
                  </div>
                )}

                {isClientLike && user.assigned_project_ids.length > 0 && (
                  <div className="mt-3 bg-[#0d1628] rounded-lg px-3 py-2 flex items-center gap-2">
                    <Eye size={11} className="text-teal-500 shrink-0" />
                    <p className="text-xs text-slate-400">{user.assigned_project_ids.length} project{user.assigned_project_ids.length !== 1 ? 's' : ''} assigned</p>
                  </div>
                )}

                {/* Permission summary line */}
                <div className="mt-3 bg-[#0d1628] rounded-lg px-3 py-2 flex items-center gap-2">
                  {overrideCount > 0
                    ? <Unlock size={10} className="text-[#f97316]/70 shrink-0" />
                    : <Shield size={10} className="text-slate-600 shrink-0" />
                  }
                  <p className="text-[10px] text-slate-600 truncate">
                    {overrideCount > 0
                      ? `${overrideCount} permission override${overrideCount !== 1 ? 's' : ''} on ${user.role} defaults`
                      : `${user.role} defaults apply`
                    }
                  </p>
                </div>
              </div>

              <div className="px-5 pb-4 border-t border-[#1e2d4a] pt-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-600">
                  Joined {new Date(user.join_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setViewProfile({ user, idx })}
                    className="flex items-center gap-1 text-xs text-[#f97316] font-semibold hover:text-orange-400 transition-colors px-2 py-1 rounded hover:bg-orange-950/30">
                    <User size={11} />Profile
                  </button>
                  <button onClick={() => setEditUser(user)}
                    className="flex items-center gap-1 text-xs text-slate-500 font-semibold hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-[#1e2d4a]">
                    <Edit2 size={11} />Edit
                  </button>
                  <button onClick={() => setDeleteTarget(user)}
                    className="flex items-center gap-1 text-xs text-slate-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-[#1e2d4a]"
                    title="Permanently delete user">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <User size={36} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No users match your filters</p>
          </div>
        )}
      </div>

      {/* Role reference card */}
      <div className="mt-8 bg-[#1a2236] rounded-2xl border border-[#1e2d4a] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2d4a] flex items-center gap-2">
          <Shield size={14} className="text-slate-500" />
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Role Reference</h3>
          <p className="text-xs text-slate-600 ml-2">Base permission templates — override per user in Edit</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#1e2d4a]">
          {ALL_ROLES.map(role => {
            const perms = ROLE_PERMISSIONS[role] ?? {};
            const grantedCount = Object.values(perms).filter(Boolean).length;
            return (
              <div key={role} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <RoleBadge role={role} />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{ROLE_DESCRIPTIONS[role]}</p>
                <p className="text-[10px] text-slate-600">{grantedCount} permissions granted by default</p>
              </div>
            );
          })}
        </div>
      </div>

      {liveProfile && viewProfile && (
        <ViewProfileModal
          user={liveProfile}
          idx={viewProfile.idx}
          onClose={() => setViewProfile(null)}
          onEdit={() => { setEditUser(liveProfile); setViewProfile(null); }}
        />
      )}
      {showInvite && (
        <UserFormModal
          mode="invite"
          onClose={() => setShowInvite(false)}
          onSave={() => {/* not used for invite mode */}}
          onInviteSuccess={async (u) => {
            await store.addPlatformUser(u);
            logActivity({
              orgId: store.currentOrgId ?? '',
              userName: store.currentUser?.name ?? '',
              module: 'users', recordRef: u.name,
              actionType: 'user_invited',
              description: `${store.currentUser?.name ?? 'Unknown'} invited ${u.name} (${u.email}) with role ${u.role}`,
              metadata: { invitedEmail: u.email, role: u.role },
            });
          }}
        />
      )}
      {showAdd && (
        <UserFormModal
          mode="add"
          onClose={() => setShowAdd(false)}
          onSave={async (u) => { await handleSaveUser(u); setShowAdd(false); }}
        />
      )}
      {editUser && (
        <UserFormModal
          mode="edit"
          existing={editUser}
          onClose={() => setEditUser(null)}
          onSave={async (u) => { await handleSaveUser(u); setEditUser(null); }}
        />
      )}
      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteUser}
        />
      )}

      {showDeleteTestConfirm && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a2236] rounded-2xl border border-amber-700/50 shadow-2xl w-full max-w-sm">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-amber-900/40 border border-amber-700 flex items-center justify-center mx-auto mb-4">
                <FlaskConical size={20} className="text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white text-center mb-2">Delete All Test Users</h3>
              <p className="text-sm text-slate-400 text-center mb-1">
                This will remove <span className="font-semibold text-amber-400">{testUserCount} test account{testUserCount !== 1 ? 's' : ''}</span> from VYSITE.
              </p>
              <p className="text-xs text-slate-500 text-center mb-6">
                Auth logins for @vysite.local accounts will also be deleted. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteTestConfirm(false)}
                  className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllTestUsers}
                  disabled={deletingTests}
                  className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {deletingTests ? 'Deleting…' : 'Delete Test Users'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
