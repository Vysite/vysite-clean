import { useState, useMemo } from 'react';
import { X, Search, FileText, FlaskConical, FolderOpen, Check, Filter, Calendar, User } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBOAndMSection, OAndMSourceModule } from './types';
import { genId } from './types';

// ─── Rich record type (carries extra metadata for display) ────────────────────

interface SourceRecord {
  id: string;
  title: string;
  subtitle: string;
  module: OAndMSourceModule;
  // extra display fields
  typeTag?: string;
  statusTag?: string;
  dateStr?: string;
  byLine?: string;
}

// ─── Status colour helpers ────────────────────────────────────────────────────

function statusColour(status: string): string {
  const s = status.toLowerCase();
  if (s === 'complete' || s === 'completed' || s === 'approved' || s === 'closed' || s === 'resolved') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  if (s === 'failed' || s === 'escalated') return 'text-red-400 bg-red-400/10 border-red-400/20';
  if (s === 'in progress' || s === 'submitted' || s === 'issued' || s === 'acknowledged') return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
  if (s === 'draft' || s === 'not started' || s === 'open') return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  if (s === 'on hold' || s === 'awaiting response' || s === 'action required') return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
}

function fmtDate(d?: string): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }); } catch { return ''; }
}

// ─── Filter chip component ────────────────────────────────────────────────────

function FilterChips({ all, active, onToggle }: {
  all: string[];
  active: string | null;
  onToggle: (v: string | null) => void;
}) {
  if (all.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-6 pb-2">
      <button
        onClick={() => onToggle(null)}
        className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-colors ${
          active === null
            ? 'bg-[#f97316] border-[#f97316] text-white'
            : 'border-[#1e2d4a] text-slate-500 hover:text-slate-300 hover:border-[#2a3a5a]'
        }`}
      >
        All
      </button>
      {all.map(v => (
        <button
          key={v}
          onClick={() => onToggle(active === v ? null : v)}
          className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-colors ${
            active === v
              ? 'bg-[#f97316] border-[#f97316] text-white'
              : 'border-[#1e2d4a] text-slate-500 hover:text-slate-300 hover:border-[#2a3a5a]'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TAB_DEFS: { key: OAndMSourceModule; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'project_document', label: 'Documents',   icon: FolderOpen },
  { key: 'tc_record',        label: 'T&C Records', icon: FlaskConical },
  { key: 'site_form',        label: 'Site Forms',  icon: FileText },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  section: DBOAndMSection;
  projectId: string;
  existingSourceIds: Set<string>;
  onAdd: (items: { source_module: OAndMSourceModule; source_record_id: string; title: string; subtitle: string }[]) => void;
  onClose: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OAndMSourcePicker({ section, projectId, existingSourceIds, onAdd, onClose }: Props) {
  const store = useAppStore();
  const [activeTab, setActiveTab] = useState<OAndMSourceModule>('project_document');
  const [search, setSearch] = useState('');
  const [filterValue, setFilterValue] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Build typed record lists ─────────────────────────────────────────────

  const docs = useMemo<SourceRecord[]>(() =>
    store.projectDocuments
      .filter(d => d.project_id === projectId)
      .map(d => ({
        id: d.id,
        title: (d.doc_title ?? '').trim() || d.name,
        subtitle: d.name,
        module: 'project_document' as const,
        typeTag: d.category || undefined,
        dateStr: fmtDate(d.created_at),
        byLine: d.uploaded_by || undefined,
      })),
    [store.projectDocuments, projectId],
  );

  const tcRecords = useMemo<SourceRecord[]>(() =>
    store.tcRecords
      .filter(r => r.project_id === projectId)
      .map(r => ({
        id: r.id,
        title: r.title || r.ref || r.category,
        subtitle: [r.ref, r.area].filter(Boolean).join(' · '),
        module: 'tc_record' as const,
        typeTag: r.category || undefined,
        statusTag: r.status || undefined,
        dateStr: fmtDate(r.date),
        byLine: r.engineer || undefined,
      })),
    [store.tcRecords, projectId],
  );

  const siteForms = useMemo<SourceRecord[]>(() =>
    store.siteForms
      .filter(f => f.project_id === projectId)
      .map(f => ({
        id: f.id,
        title: f.description || f.type || 'Site Form',
        subtitle: f.type || '',
        module: 'site_form' as const,
        typeTag: f.type || undefined,
        statusTag: f.status || undefined,
        dateStr: fmtDate(f.date),
        byLine: f.completed_by || undefined,
      })),
    [store.siteForms, projectId],
  );

  const allByTab: Record<OAndMSourceModule, SourceRecord[]> = { project_document: docs, tc_record: tcRecords, site_form: siteForms };

  // ── Derive filter chips from actual data ─────────────────────────────────

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    allByTab[activeTab].forEach(r => { if (r.typeTag) set.add(r.typeTag); });
    return [...set].sort();
  }, [activeTab, docs, tcRecords, siteForms]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    allByTab[activeTab].forEach(r => { if (r.statusTag) set.add(r.statusTag); });
    return [...set].sort();
  }, [activeTab, docs, tcRecords, siteForms]);

  // ── Filtered list ────────────────────────────────────────────────────────

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return allByTab[activeTab].filter(r => {
      if (filterValue && r.typeTag !== filterValue) return false;
      if (statusFilter && r.statusTag !== statusFilter) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.subtitle.toLowerCase().includes(q) && !(r.typeTag ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activeTab, docs, tcRecords, siteForms, search, filterValue, statusFilter]);

  const handleTabChange = (tab: OAndMSourceModule) => {
    setActiveTab(tab);
    setSearch('');
    setFilterValue(null);
    setStatusFilter(null);
  };

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleAdd = () => {
    const allRecords = [...docs, ...tcRecords, ...siteForms];
    const toAdd = [...selected]
      .map(id => allRecords.find(r => r.id === id))
      .filter((r): r is SourceRecord => !!r)
      .map(r => ({ source_module: r.module, source_record_id: r.id, title: r.title, subtitle: r.subtitle }));
    if (toAdd.length) onAdd(toAdd);
  };

  const totalForTab = allByTab[activeTab].length;
  const showStatusFilter = statusOptions.length > 0 && activeTab !== 'project_document';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-[#111827] border border-[#1e2d4a] rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: 'min(82vh, 700px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-[#1e2d4a] shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">Add Records to Section</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-sm">{section.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white hover:bg-[#1e2d4a] rounded-lg transition-colors shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 pt-3 pb-0 border-b border-[#1e2d4a] shrink-0">
          {TAB_DEFS.map(tab => {
            const Icon = tab.icon;
            const count = allByTab[tab.key].length;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'text-white border-[#f97316]'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                <Icon size={12} />
                {tab.label}
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key ? 'bg-[#f97316]/20 text-[#f97316]' : 'bg-[#1e2d4a] text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + status filter row */}
        <div className="px-6 pt-3 pb-2 shrink-0 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${TAB_DEFS.find(t => t.key === activeTab)?.label ?? ''}…`}
              className="w-full pl-8 pr-4 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
          {showStatusFilter && (
            <select
              value={statusFilter ?? ''}
              onChange={e => setStatusFilter(e.target.value || null)}
              className="bg-[#0d1628] border border-[#1e2d4a] text-xs text-slate-300 rounded-lg px-2 py-2 focus:outline-none focus:border-slate-500 min-w-[110px]"
            >
              <option value="">All statuses</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        {/* Type filter chips */}
        {typeOptions.length > 0 && (
          <FilterChips all={typeOptions} active={filterValue} onToggle={setFilterValue} />
        )}

        {/* Results summary */}
        {(filterValue || statusFilter || search) && (
          <div className="px-6 pb-1.5 shrink-0">
            <p className="text-[10px] text-slate-600">
              Showing {visible.length} of {totalForTab} records
              {filterValue ? ` · ${filterValue}` : ''}
              {statusFilter ? ` · ${statusFilter}` : ''}
              {search ? ` · "${search}"` : ''}
            </p>
          </div>
        )}

        {/* Record list */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-1 min-h-0">
          {visible.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">No records found</p>
              {totalForTab === 0 ? (
                <p className="text-xs text-slate-600 mt-1">No {TAB_DEFS.find(t => t.key === activeTab)?.label} exist for this project yet.</p>
              ) : (
                <button
                  onClick={() => { setFilterValue(null); setStatusFilter(null); setSearch(''); }}
                  className="text-xs text-[#f97316] hover:underline mt-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            visible.map(record => {
              const alreadyAdded = existingSourceIds.has(record.id);
              const isSelected = selected.has(record.id);
              return (
                <button
                  key={record.id}
                  onClick={() => !alreadyAdded && toggle(record.id)}
                  disabled={alreadyAdded}
                  className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
                    alreadyAdded
                      ? 'opacity-40 cursor-not-allowed bg-transparent'
                      : isSelected
                        ? 'bg-[#f97316]/8 border border-[#f97316]/25'
                        : 'hover:bg-[#1a2236] border border-transparent'
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    alreadyAdded ? 'border-slate-700 bg-slate-800' : isSelected ? 'border-[#f97316] bg-[#f97316]' : 'border-[#2a3a5a]'
                  }`} style={{ width: 18, height: 18 }}>
                    {(isSelected || alreadyAdded) && <Check size={10} className="text-white" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className={`text-sm font-semibold leading-snug ${alreadyAdded ? 'text-slate-500' : 'text-slate-200'}`}>
                        {record.title}
                      </p>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {record.typeTag && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-700/60 bg-slate-800/60 text-slate-400">
                          {record.typeTag}
                        </span>
                      )}
                      {record.statusTag && (
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusColour(record.statusTag)}`}>
                          {record.statusTag}
                        </span>
                      )}
                      {record.dateStr && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
                          <Calendar size={9} />
                          {record.dateStr}
                        </span>
                      )}
                      {record.byLine && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
                          <User size={9} />
                          {record.byLine}
                        </span>
                      )}
                    </div>

                    {/* Subtitle / filename for docs */}
                    {record.subtitle && record.subtitle !== record.title && (
                      <p className="text-[10px] text-slate-700 truncate mt-0.5">{record.subtitle}</p>
                    )}
                  </div>

                  {alreadyAdded && (
                    <span className="text-[9px] text-slate-600 shrink-0 mt-0.5 font-semibold">In section</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2d4a] shrink-0">
          <div className="text-xs text-slate-500">
            {selected.size > 0
              ? <span><span className="text-white font-semibold">{selected.size}</span> selected</span>
              : 'Select records to add'
            }
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="px-5 py-2 bg-[#f97316] hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Add {selected.size > 0 ? selected.size : ''} Record{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
