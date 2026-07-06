import { useState, useMemo } from 'react';
import { X, Search, FileText, FlaskConical, FolderOpen, Check } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBOAndMSection, OAndMSourceModule } from './types';
import { SOURCE_MODULE_LABELS, SOURCE_MODULE_COLOURS, genId } from './types';

interface SourceRecord {
  id: string;
  title: string;
  subtitle: string;
  module: OAndMSourceModule;
}

const TAB_DEFS: { key: OAndMSourceModule; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'project_document', label: 'Documents',      icon: FolderOpen },
  { key: 'tc_record',        label: 'T&C Records',    icon: FlaskConical },
  { key: 'site_form',        label: 'Site Forms',     icon: FileText },
];

interface Props {
  section: DBOAndMSection;
  projectId: string;
  existingSourceIds: Set<string>;
  onAdd: (items: { source_module: OAndMSourceModule; source_record_id: string; title: string; subtitle: string }[]) => void;
  onClose: () => void;
}

export default function OAndMSourcePicker({ section, projectId, existingSourceIds, onAdd, onClose }: Props) {
  const store = useAppStore();
  const [activeTab, setActiveTab] = useState<OAndMSourceModule>('project_document');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allRecords = useMemo<SourceRecord[]>(() => {
    const proj = projectId;

    const docs = store.projectDocuments
      .filter(d => d.project_id === proj)
      .map<SourceRecord>(d => ({
        id: d.id,
        title: (d.doc_title ?? '').trim() || d.name,
        subtitle: d.category || d.type || '',
        module: 'project_document',
      }));

    const tc = store.tcRecords
      .filter(r => r.project_id === proj)
      .map<SourceRecord>(r => ({
        id: r.id,
        title: r.title,
        subtitle: r.category || '',
        module: 'tc_record',
      }));

    const forms = store.siteForms
      .filter(f => f.project_id === proj)
      .map<SourceRecord>(f => ({
        id: f.id,
        title: f.description || f.type || 'Site Form',
        subtitle: f.type || '',
        module: 'site_form',
      }));

    return [...docs, ...tc, ...forms];
  }, [store.projectDocuments, store.tcRecords, store.siteForms, projectId]);

  const tabRecords = useMemo(() => {
    const q = search.toLowerCase();
    return allRecords
      .filter(r => r.module === activeTab)
      .filter(r => !q || r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q));
  }, [allRecords, activeTab, search]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const toAdd = [...selected]
      .map(id => allRecords.find(r => r.id === id))
      .filter((r): r is SourceRecord => !!r)
      .map(r => ({ source_module: r.module, source_record_id: r.id, title: r.title, subtitle: r.subtitle }));
    if (toAdd.length) onAdd(toAdd);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-[#111827] border border-[#1e2d4a] rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-[#1e2d4a]">
          <div>
            <h2 className="text-base font-bold text-white">Add Records to Section</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-sm">
              {section.title}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white hover:bg-[#1e2d4a] rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 pb-0">
          {TAB_DEFS.map(tab => {
            const Icon = tab.icon;
            const count = allRecords.filter(r => r.module === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearch(''); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'text-white border-[#f97316]'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                <Icon size={12} />
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-[#f97316]/20 text-[#f97316]' : 'bg-[#1e2d4a] text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="px-6 pt-3 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${TAB_DEFS.find(t => t.key === activeTab)?.label ?? ''}…`}
              className="w-full pl-9 pr-4 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
        </div>

        {/* Record list */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-1">
          {tabRecords.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">No records found</p>
              {allRecords.filter(r => r.module === activeTab).length === 0 && (
                <p className="text-xs text-slate-600 mt-1">No {TAB_DEFS.find(t => t.key === activeTab)?.label} exist for this project yet.</p>
              )}
            </div>
          ) : (
            tabRecords.map(record => {
              const alreadyAdded = existingSourceIds.has(record.id);
              const isSelected = selected.has(record.id);
              return (
                <button
                  key={record.id}
                  onClick={() => !alreadyAdded && toggle(record.id)}
                  disabled={alreadyAdded}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    alreadyAdded
                      ? 'opacity-40 cursor-not-allowed'
                      : isSelected
                        ? 'bg-[#f97316]/10 border border-[#f97316]/30'
                        : 'hover:bg-[#1a2236] border border-transparent'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    alreadyAdded ? 'border-slate-700 bg-slate-800' : isSelected ? 'border-[#f97316] bg-[#f97316]' : 'border-[#2a3a5a]'
                  }`}>
                    {(isSelected || alreadyAdded) && <Check size={11} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${alreadyAdded ? 'text-slate-500' : 'text-slate-200'}`}>{record.title}</p>
                    {record.subtitle && (
                      <p className="text-xs text-slate-600 truncate mt-0.5">{record.subtitle}</p>
                    )}
                  </div>
                  {alreadyAdded && (
                    <span className="text-[10px] text-slate-600 shrink-0">Already added</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2d4a]">
          <span className="text-xs text-slate-500">
            {selected.size > 0 ? `${selected.size} selected` : 'Select records to add'}
          </span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="px-5 py-2 bg-[#f97316] hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Add {selected.size > 0 ? selected.size : ''} Record{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
