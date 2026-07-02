import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Activity, Search, Filter, RefreshCw, Download, Plus, CreditCard as Edit2, Trash2, MessageSquare, Paperclip, FileText, UserPlus, UserMinus, Settings, Shield, ChevronDown, Clock, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../lib/StoreContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityLogEntry {
  id: string;
  org_id: string;
  user_id: string | null;
  user_name: string;
  module: string;
  record_id: string | null;
  record_ref: string | null;
  record_type: string | null;
  project_id: string | null;
  project_name: string | null;
  action_type: string;
  description: string;
  prev_value: string | null;
  new_value: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface FieldDiff {
  label: string;
  prev: string;
  new: string;
}

// ─── Action type config ───────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ReactNode> = {
  record_created:    <Plus size={12} />,
  record_updated:    <Edit2 size={12} />,
  record_deleted:    <Trash2 size={12} />,
  status_changed:    <CheckCircle2 size={12} />,
  comment_added:     <MessageSquare size={12} />,
  attachment_uploaded: <Paperclip size={12} />,
  attachment_deleted:  <Trash2 size={12} />,
  pdf_exported:      <FileText size={12} />,
  user_invited:      <UserPlus size={12} />,
  user_created:      <UserPlus size={12} />,
  user_updated:      <Edit2 size={12} />,
  user_removed:      <UserMinus size={12} />,
  permission_changed: <Shield size={12} />,
  settings_changed:  <Settings size={12} />,
};

const ACTION_COLORS: Record<string, string> = {
  record_created:    'bg-emerald-900/40 text-emerald-400 border-emerald-700/40',
  record_updated:    'bg-blue-900/40 text-blue-400 border-blue-700/40',
  record_deleted:    'bg-red-900/40 text-red-400 border-red-700/40',
  status_changed:    'bg-amber-900/40 text-amber-400 border-amber-700/40',
  comment_added:     'bg-slate-800 text-slate-300 border-slate-600/40',
  attachment_uploaded: 'bg-sky-900/40 text-sky-400 border-sky-700/40',
  attachment_deleted:  'bg-red-900/40 text-red-400 border-red-700/40',
  pdf_exported:      'bg-slate-800 text-slate-300 border-slate-600/40',
  user_invited:      'bg-teal-900/40 text-teal-400 border-teal-700/40',
  user_created:      'bg-teal-900/40 text-teal-400 border-teal-700/40',
  user_updated:      'bg-blue-900/40 text-blue-400 border-blue-700/40',
  user_removed:      'bg-red-900/40 text-red-400 border-red-700/40',
  permission_changed: 'bg-orange-900/40 text-orange-400 border-orange-700/40',
  settings_changed:  'bg-purple-900/40 text-purple-400 border-purple-700/40',
};

const ACTION_LABELS: Record<string, string> = {
  record_created:    'Created',
  record_updated:    'Updated',
  record_deleted:    'Deleted',
  status_changed:    'Status Changed',
  comment_added:     'Comment',
  attachment_uploaded: 'Attachment',
  attachment_deleted:  'Attachment Deleted',
  pdf_exported:      'PDF Exported',
  user_invited:      'User Invited',
  user_created:      'User Added',
  user_updated:      'User Updated',
  user_removed:      'User Removed',
  permission_changed: 'Permissions',
  settings_changed:  'Settings',
};

const MODULE_LABELS: Record<string, string> = {
  commercial:  'Commercial',
  users:       'Users',
  settings:    'Settings',
  projects:    'Projects',
  tenders:     'Tenders',
  snagging:    'Snagging',
  actions:     'Actions',
  site_forms:  'Site Forms',
  testing:     'Testing',
  maintenance: 'Maintenance',
  programmes:  'Programmes',
};

const MODULE_COLORS: Record<string, string> = {
  commercial:  'bg-orange-900/40 text-orange-400',
  users:       'bg-teal-900/40 text-teal-400',
  settings:    'bg-slate-700 text-slate-300',
  projects:    'bg-sky-900/40 text-sky-400',
  tenders:     'bg-blue-900/40 text-blue-400',
  snagging:    'bg-amber-900/40 text-amber-400',
  actions:     'bg-emerald-900/40 text-emerald-400',
  site_forms:  'bg-violet-900/40 text-violet-400',
  testing:     'bg-cyan-900/40 text-cyan-400',
  maintenance: 'bg-rose-900/40 text-rose-400',
  programmes:  'bg-indigo-900/40 text-indigo-400',
};

const ACTION_TYPE_OPTIONS = [
  { value: '', label: 'All action types' },
  { value: 'record_created',    label: 'Record Created' },
  { value: 'record_updated',    label: 'Record Updated' },
  { value: 'record_deleted',    label: 'Record Deleted' },
  { value: 'status_changed',    label: 'Status Changed' },
  { value: 'comment_added',     label: 'Comment Added' },
  { value: 'attachment_uploaded', label: 'Attachment Uploaded' },
  { value: 'attachment_deleted',  label: 'Attachment Deleted' },
  { value: 'pdf_exported',      label: 'PDF Exported' },
  { value: 'user_invited',      label: 'User Invited' },
  { value: 'user_created',      label: 'User Added' },
  { value: 'user_updated',      label: 'User Updated' },
  { value: 'user_removed',      label: 'User Removed' },
  { value: 'permission_changed', label: 'Permission Changed' },
  { value: 'settings_changed',  label: 'Settings Changed' },
];

const MODULE_OPTIONS = [
  { value: '', label: 'All modules' },
  ...Object.entries(MODULE_LABELS).map(([value, label]) => ({ value, label })),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateTimeShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ActionBadge({ actionType }: { actionType: string }) {
  const icon = ACTION_ICONS[actionType] ?? <Info size={12} />;
  const color = ACTION_COLORS[actionType] ?? 'bg-slate-800 text-slate-300 border-slate-600/40';
  const label = ACTION_LABELS[actionType] ?? actionType;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${color}`}>
      {icon}{label}
    </span>
  );
}

function ModuleBadge({ module }: { module: string }) {
  const color = MODULE_COLORS[module] ?? 'bg-slate-700 text-slate-300';
  const label = MODULE_LABELS[module] ?? module;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${color}`}>
      {label}
    </span>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function EntryDetail({ entry, onClose }: { entry: ActivityLogEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-end p-4" onClick={onClose}>
      <div
        className="bg-[#1a2236] border border-[#1e2d4a] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d4a]">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-[#f97316]" />
            <h3 className="text-sm font-bold text-white">Activity Detail</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-[#1e2d4a] transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Description</p>
            <p className="text-sm text-slate-200 leading-relaxed">{entry.description}</p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <ActionBadge actionType={entry.action_type} />
            <ModuleBadge module={entry.module} />
          </div>

          {/* Metadata grid */}
          <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] divide-y divide-[#1e2d4a]">
            {[
              { label: 'User', value: entry.user_name || '—' },
              { label: 'Module', value: MODULE_LABELS[entry.module] ?? entry.module },
              { label: 'Record', value: entry.record_ref || '—' },
              { label: 'Record Type', value: entry.record_type || '—' },
              { label: 'Project', value: entry.project_name || '—' },
              { label: 'Date & Time', value: fmtDateTime(entry.created_at) },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-2.5 gap-4">
                <span className="text-xs text-slate-500 shrink-0">{row.label}</span>
                <span className="text-xs text-slate-300 text-right truncate">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Single-field value change (short fields like status) */}
          {(entry.prev_value || entry.new_value) && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Change</p>
              <div className="space-y-2">
                {entry.prev_value && (
                  <div className="bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-red-400 font-semibold mb-0.5">Previous</p>
                    <p className="text-xs text-red-200">{entry.prev_value}</p>
                  </div>
                )}
                {entry.new_value && (
                  <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-emerald-400 font-semibold mb-0.5">New</p>
                    <p className="text-xs text-emerald-200">{entry.new_value}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Full field diffs — stored in metadata.diffs for narrative/text fields */}
          {Array.isArray((entry.metadata as Record<string, unknown> | null)?.diffs) && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Field Changes</p>
              <div className="space-y-3">
                {((entry.metadata as { diffs: FieldDiff[] }).diffs).map((diff, i) => (
                  <div key={i} className="rounded-xl border border-[#1e2d4a] overflow-hidden">
                    <div className="px-3 py-1.5 bg-[#0d1628] border-b border-[#1e2d4a]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{diff.label}</span>
                    </div>
                    <div className="divide-y divide-[#1e2d4a]">
                      <div className="px-3 py-2 bg-red-900/10">
                        <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider mb-1">Before</p>
                        <p className="text-xs text-red-200 leading-relaxed whitespace-pre-wrap break-words">{diff.prev === '—' ? <span className="italic text-slate-500">empty</span> : diff.prev}</p>
                      </div>
                      <div className="px-3 py-2 bg-emerald-900/10">
                        <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider mb-1">After</p>
                        <p className="text-xs text-emerald-200 leading-relaxed whitespace-pre-wrap break-words">{diff.new === '—' ? <span className="italic text-slate-500">empty</span> : diff.new}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other metadata (non-diffs) */}
          {entry.metadata && Object.keys(entry.metadata).some(k => k !== 'diffs') && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Additional Info</p>
              <pre className="text-[10px] text-slate-400 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(
                  Object.fromEntries(Object.entries(entry.metadata).filter(([k]) => k !== 'diffs')),
                  null, 2
                )}
              </pre>
            </div>
          )}

          {/* Reason */}
          {entry.reason && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Reason</p>
              <p className="text-sm text-slate-300 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2">{entry.reason}</p>
            </div>
          )}

          {/* Audit note */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[#0d1628] border border-[#1e2d4a]">
            <AlertCircle size={13} className="text-slate-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-600 leading-relaxed">
              This is a permanent audit record. Activity log entries cannot be edited or deleted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const inputCls  = 'bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#f97316] focus:border-[#f97316] transition-colors';
const selectCls = `${inputCls} appearance-none cursor-pointer`;
const labelCls  = 'block text-xs font-medium text-slate-400 mb-1';

export default function ActivityRegister() {
  const store = useAppStore();
  const orgId = store.currentOrgId;

  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // Use a ref for offset so fetchEntries does not need it in its useCallback deps,
  // preventing unnecessary callback re-creation on every page load.
  const offsetRef = useRef(0);
  const [selected, setSelected] = useState<ActivityLogEntry | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterUser, setFilterUser]         = useState('');
  const [filterModule, setFilterModule]     = useState('');
  const [filterAction, setFilterAction]     = useState('');
  const [filterProject, setFilterProject]   = useState('');
  const [filterRef, setFilterRef]           = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');

  const activeFilterCount = [filterUser, filterModule, filterAction, filterProject, filterRef, filterDateFrom, filterDateTo].filter(Boolean).length;

  // Unique users from loaded entries (for filter dropdown)
  const uniqueUsers = useMemo(() => {
    const names = new Set(entries.map(e => e.user_name).filter(Boolean));
    return Array.from(names).sort();
  }, [entries]);

  // Unique projects from loaded entries
  const uniqueProjects = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach(e => { if (e.project_id && e.project_name) map.set(e.project_id, e.project_name); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const fetchEntries = useCallback(async (reset: boolean) => {
    if (!orgId) return;
    if (reset) setLoading(true); else setLoadingMore(true);

    const currentOffset = reset ? 0 : offsetRef.current;

    let query = supabase
      .from('vy_activity_log')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (filterModule) query = query.eq('module', filterModule);
    if (filterAction) query = query.eq('action_type', filterAction);
    if (filterProject) query = query.eq('project_id', filterProject);
    if (filterDateFrom) query = query.gte('created_at', filterDateFrom + 'T00:00:00Z');
    if (filterDateTo)   query = query.lte('created_at', filterDateTo + 'T23:59:59Z');
    if (filterRef)      query = query.ilike('record_ref', `%${filterRef}%`);
    if (filterUser)     query = query.eq('user_name', filterUser);

    const { data, error } = await query;
    if (error) console.error('[ActivityRegister] fetch error:', error);

    const rows = (data ?? []) as ActivityLogEntry[];

    if (reset) {
      setEntries(rows);
      offsetRef.current = rows.length;
    } else {
      setEntries(prev => [...prev, ...rows]);
      offsetRef.current += rows.length;
    }

    setHasMore(rows.length === PAGE_SIZE);
    if (reset) setLoading(false); else setLoadingMore(false);
  }, [orgId, filterModule, filterAction, filterProject, filterDateFrom, filterDateTo, filterRef, filterUser]);

  // Re-fetch on filter change or org change
  useEffect(() => {
    fetchEntries(true);
  }, [fetchEntries]);

  function clearFilters() {
    setFilterUser(''); setFilterModule(''); setFilterAction('');
    setFilterProject(''); setFilterRef('');
    setFilterDateFrom(''); setFilterDateTo('');
  }

  // Export to CSV
  function exportCSV() {
    const headers = ['Date & Time', 'User', 'Module', 'Action', 'Record', 'Project', 'Description', 'Previous Value', 'New Value', 'Reason'];
    const rows = entries.map(e => [
      fmtDateTime(e.created_at),
      e.user_name,
      MODULE_LABELS[e.module] ?? e.module,
      ACTION_LABELS[e.action_type] ?? e.action_type,
      e.record_ref ?? '',
      e.project_name ?? '',
      e.description,
      e.prev_value ?? '',
      e.new_value ?? '',
      e.reason ?? '',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-[#f97316]/20 border border-[#f97316]/30 flex items-center justify-center">
              <Activity size={15} className="text-[#f97316]" />
            </div>
            <h2 className="text-lg font-bold text-white">Activity Register</h2>
          </div>
          <p className="text-sm text-slate-500">Permanent audit log of all platform activity. Read-only.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchEntries(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-slate-600 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} />Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-[#f97316] rounded-lg transition-colors"
          >
            <Download size={13} />Export CSV
          </button>
        </div>
      </div>

      {/* Audit lock notice */}
      <div className="flex items-start gap-3 p-3.5 bg-[#0d1628] border border-[#1e2d4a] rounded-xl">
        <AlertCircle size={14} className="text-[#f97316] shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          The Activity Register is a permanent, system-generated audit log. Records cannot be edited, deleted, or modified through the application. All entries are retained even if the original record is deleted.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            className={`${inputCls} pl-8`}
            placeholder="Search by record reference..."
            value={filterRef}
            onChange={e => setFilterRef(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors shrink-0 ${
            activeFilterCount > 0 || showFilters
              ? 'border-[#f97316] text-[#f97316]'
              : 'border-[#1e2d4a] text-slate-400 hover:text-white'
          }`}
        >
          <Filter size={13} />Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 w-4 h-4 rounded-full bg-[#f97316] text-white text-[10px] flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-white transition-colors">
            Clear all
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-[#0d1628] border border-[#1e2d4a] rounded-xl">
          <div className="min-w-[180px]">
            <label className={labelCls}>User</label>
            <select className={selectCls} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="">All users</option>
              {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className={labelCls}>Module</label>
            <select className={selectCls} value={filterModule} onChange={e => setFilterModule(e.target.value)}>
              {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className={labelCls}>Action Type</label>
            <select className={selectCls} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
              {ACTION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className={labelCls}>Project</label>
            <select className={selectCls} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="">All projects</option>
              {uniqueProjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className={labelCls}>Date From</label>
            <input type="date" className={inputCls} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          </div>
          <div className="min-w-[150px]">
            <label className={labelCls}>Date To</label>
            <input type="date" className={inputCls} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          </div>
        </div>
      )}

      {/* Log table */}
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl overflow-hidden flex flex-col">
        {/* Column headers — fixed above scroll area */}
        <div className="grid grid-cols-[160px_130px_120px_120px_1fr_130px] gap-3 px-4 py-2.5 border-b border-[#1e2d4a] text-[10px] font-semibold text-slate-500 uppercase tracking-wide shrink-0">
          <span>Date & Time</span>
          <span>User</span>
          <span>Module</span>
          <span>Action</span>
          <span>Description</span>
          <span>Record</span>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
        {loading ? (
          <div className="py-14 text-center text-slate-500">
            <div className="w-5 h-5 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading activity log...
          </div>
        ) : entries.length === 0 ? (
          <div className="py-14 text-center">
            <Clock size={28} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">
              {activeFilterCount > 0 ? 'No activity matches your filters' : 'No activity recorded yet'}
            </p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="mt-3 text-xs text-[#f97316] hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {entries.map((entry, i) => (
              <button
                key={entry.id}
                className={`w-full grid grid-cols-[160px_130px_120px_120px_1fr_130px] gap-3 px-4 py-3 text-left transition-colors hover:bg-[#1a2236] ${
                  i < entries.length - 1 ? 'border-b border-[#1e2d4a]/50' : ''
                }`}
                onClick={() => setSelected(entry)}
              >
                {/* Date */}
                <div className="flex items-start gap-1.5 min-w-0">
                  <Clock size={11} className="text-slate-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-300 font-medium truncate">{fmtDateTimeShort(entry.created_at)}</p>
                    <p className="text-[10px] text-slate-600">{new Date(entry.created_at).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>

                {/* User */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-[#1e2d4a] flex items-center justify-center text-[9px] font-bold text-[#f97316] shrink-0">
                    {(entry.user_name || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-300 truncate">{entry.user_name || '—'}</span>
                </div>

                {/* Module */}
                <div><ModuleBadge module={entry.module} /></div>

                {/* Action */}
                <div><ActionBadge actionType={entry.action_type} /></div>

                {/* Description */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-xs text-slate-400 truncate">{entry.description}</p>
                  {Array.isArray((entry.metadata as Record<string, unknown> | null)?.diffs) &&
                    ((entry.metadata as { diffs: unknown[] }).diffs).length > 0 && (
                    <span className="shrink-0 text-[9px] font-semibold text-[#f97316] bg-[#f97316]/10 border border-[#f97316]/30 rounded px-1 py-0.5 leading-none">
                      {((entry.metadata as { diffs: unknown[] }).diffs).length} field{((entry.metadata as { diffs: unknown[] }).diffs).length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Record ref */}
                <div className="min-w-0">
                  {entry.record_ref && (
                    <span className="text-[11px] font-mono text-[#f97316] truncate block">{entry.record_ref}</span>
                  )}
                  {entry.project_name && (
                    <span className="text-[10px] text-slate-600 truncate block">{entry.project_name}</span>
                  )}
                </div>
              </button>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="border-t border-[#1e2d4a] px-4 py-3 text-center">
                <button
                  onClick={() => fetchEntries(false)}
                  disabled={loadingMore}
                  className="text-xs text-[#f97316] hover:underline disabled:opacity-60 flex items-center gap-1.5 mx-auto"
                >
                  {loadingMore ? (
                    <><div className="w-3 h-3 border border-[#f97316] border-t-transparent rounded-full animate-spin" />Loading...</>
                  ) : (
                    <><ChevronDown size={13} />Load more</>
                  )}
                </button>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {/* Footer count */}
      {!loading && entries.length > 0 && (
        <p className="text-xs text-slate-600">
          Showing {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
          {activeFilterCount > 0 ? ' (filtered)' : ''}
        </p>
      )}

      {/* Detail drawer */}
      {selected && <EntryDetail entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
