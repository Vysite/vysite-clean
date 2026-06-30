import { useState, useMemo } from 'react';
import {
  Search, Filter, Plus, TrendingUp, FileText, Printer,
  ChevronRight, CheckCircle2, Clock, AlertCircle, CircleDot, Banknote,
} from 'lucide-react';
import { RECORD_TYPES, STATUSES, typeInfo, statusInfo } from './types';
import type { CommercialRecord, CommercialRecordType, CommercialRecordStatus } from './types';
import type { DBKeyDate } from '../../lib/store';
import type { Project } from '../../data/types';
import { exportRegisterPDF } from './CommercialPDF';

interface CommercialRegisterProps {
  records: CommercialRecord[];
  loading: boolean;
  canCreate: boolean;
  canEdit: boolean;
  currentProject: Project | null;
  keyDates: DBKeyDate[];
  currentUserName: string;
  settings?: { company_name?: string; logo_data_url?: string } | null;
  onNewRecord: () => void;
  onOpenRecord: (r: CommercialRecord) => void;
  onUpdateStatus: (r: CommercialRecord, newStatus: CommercialRecordStatus) => void;
  onExportFull: (records: CommercialRecord[]) => void;
}

// ─── Inline status dropdown ───────────────────────────────────────────────────

function InlineStatus({ status, canEdit, onChange }: {
  status: CommercialRecordStatus;
  canEdit: boolean;
  onChange: (s: CommercialRecordStatus) => void;
}) {
  const s = statusInfo(status);
  if (!canEdit) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${s.color}`}>
        {ICON_MAP[status]}{s.label}
      </span>
    );
  }
  return (
    <select
      value={status}
      onChange={e => onChange(e.target.value as CommercialRecordStatus)}
      onClick={e => e.stopPropagation()}
      className={`appearance-none cursor-pointer inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border focus:outline-none ${s.color}`}
      style={{ backgroundImage: 'none' }}
    >
      {STATUSES.map(opt => (
        <option key={opt.value} value={opt.value} className="bg-[#1a2236] text-slate-200">{opt.label}</option>
      ))}
    </select>
  );
}

function fmtCurrency(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ICON_MAP: Record<string, React.ReactNode> = {
  draft:              <CircleDot size={11} />,
  submitted:          <ChevronRight size={11} />,
  awaiting_agreement: <Clock size={11} />,
  agreed:             <CheckCircle2 size={11} />,
  added_to_valuation: <Banknote size={11} />,
  paid:               <CheckCircle2 size={11} />,
  complete:           <CheckCircle2 size={11} />,
  rejected:           <AlertCircle size={11} />,
};

function TypeBadge({ type }: { type: CommercialRecordType }) {
  const t = typeInfo(type);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${t.color}`}>
      {t.label}
    </span>
  );
}

function StatusBadge({ status }: { status: CommercialRecordStatus }) {
  const s = statusInfo(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${s.color}`}>
      {ICON_MAP[status]}{s.label}
    </span>
  );
}

export default function CommercialRegister({
  records, loading, canCreate, canEdit, currentProject,
  currentUserName, onNewRecord, onOpenRecord, onUpdateStatus, onExportFull, settings,
}: CommercialRegisterProps) {
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterType, setFilterType]     = useState<CommercialRecordType | ''>('');
  const [filterStatus, setFilterStatus] = useState<CommercialRecordStatus | ''>('');
  const [showFilters, setShowFilters]   = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  const activeFilterCount = [filterType, filterStatus].filter(Boolean).length;

  const filteredRecords = useMemo(() => {
    let list = records;
    if (filterType)   list = list.filter(r => r.recordType === filterType);
    if (filterStatus) list = list.filter(r => r.status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.reference.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.client.toLowerCase().includes(q)
      );
    }
    return list;
  }, [records, filterType, filterStatus, searchQuery]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredRecords.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredRecords.map(r => r.id)));
  }

  function handleExportPDF(list: CommercialRecord[]) {
    exportRegisterPDF({ project: currentProject, records: list, currentUserName: currentUserName || '', logoUrl: settings?.logo_data_url });
  }

  const inputCls = 'bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#f97316] focus:border-[#f97316] transition-colors';
  const selectCls = `${inputCls} appearance-none cursor-pointer`;
  const labelCls  = 'block text-xs font-medium text-slate-400 mb-1';

  const exportList = selectedIds.size > 0 ? filteredRecords.filter(r => selectedIds.has(r.id)) : filteredRecords;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative max-w-sm flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className={`${inputCls} pl-8`}
              placeholder="Search reference, title, client..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
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
            <button
              onClick={() => { setFilterType(''); setFilterStatus(''); }}
              className="text-xs text-slate-500 hover:text-white transition-colors shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleExportPDF(exportList)}            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-[#f97316] rounded-lg transition-colors"
          >
            <FileText size={12} />Export
          </button>
          <button
            onClick={() => onExportFull(exportList)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-[#f97316] rounded-lg transition-colors"
            title="Export full individual record sheets — one page per record"
          >
            <Printer size={12} />Export Full
          </button>
          {canCreate && (
            <button
              onClick={onNewRecord}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#f97316] hover:bg-orange-400 text-white rounded-lg transition-colors"
            >
              <Plus size={13} />New Record
            </button>
          )}
        </div>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-[#0d1628] border border-[#1e2d4a] rounded-xl">
          <div className="min-w-[180px]">
            <label className={labelCls}>Record Type</label>
            <select className={selectCls} value={filterType} onChange={e => setFilterType(e.target.value as CommercialRecordType | '')}>
              <option value="">All types</option>
              {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className={labelCls}>Status</label>
            <select className={selectCls} value={filterStatus} onChange={e => setFilterStatus(e.target.value as CommercialRecordStatus | '')}>
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Register table */}
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[32px_130px_1fr_160px_160px_180px_90px_100px] gap-3 px-4 py-2.5 border-b border-[#1e2d4a] text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
          <div className="flex items-center">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 rounded border-slate-600 bg-[#0d1628] accent-[#f97316] cursor-pointer"
              checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length}
              onChange={toggleSelectAll}
            />
          </div>
          <span>Type</span>
          <span>Record</span>
          <span>Project</span>
          <span>Client</span>
          <span>Status</span>
          <span>Raised</span>
          <span>Status Changed</span>
        </div>

        {loading ? (
          <div className="py-14 text-center text-slate-500">
            <div className="w-5 h-5 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-14 text-center">
            <TrendingUp size={28} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">
              {records.length === 0 ? 'No commercial records yet' : 'No records match your filters'}
            </p>
            {records.length === 0 && canCreate && (
              <button
                onClick={onNewRecord}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2236] border border-[#1e2d4a] text-slate-300 hover:text-white text-sm mx-auto transition-colors"
              >
                <Plus size={14} /> Create your first record
              </button>
            )}
          </div>
        ) : (
          filteredRecords.map((r, i) => (
            <div
              key={r.id}
              className={`grid grid-cols-[32px_130px_1fr_160px_160px_180px_90px_100px] gap-3 px-4 py-3 transition-colors hover:bg-[#1a2236] ${
                i < filteredRecords.length - 1 ? 'border-b border-[#1e2d4a]/50' : ''
              } ${selectedIds.has(r.id) ? 'bg-[#1a2236]/60' : ''}`}
            >
              <div className="flex items-center" onClick={e => { e.stopPropagation(); toggleSelect(r.id); }}>
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-[#0d1628] accent-[#f97316] cursor-pointer"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                />
              </div>
              <button className="text-left" onClick={() => onOpenRecord(r)}>
                <TypeBadge type={r.recordType} />
              </button>
              <button className="text-left min-w-0" onClick={() => onOpenRecord(r)}>
                <div className="flex items-center gap-2 min-w-0">
                  {r.reference && <span className="text-[11px] font-mono text-[#f97316] shrink-0">{r.reference}</span>}
                  <span className="text-sm text-white font-medium truncate">{r.title || 'Untitled'}</span>
                </div>
              </button>
              <button className="text-left text-sm text-slate-400 truncate" onClick={() => onOpenRecord(r)}>{r.projectName || '—'}</button>
              <button className="text-left text-sm text-slate-400 truncate" onClick={() => onOpenRecord(r)}>{r.client || '—'}</button>
              <div className="flex items-center" onClick={e => e.stopPropagation()}>
                <InlineStatus status={r.status} canEdit={canEdit} onChange={s => onUpdateStatus(r, s)} />
              </div>
              <button className="text-left text-xs text-slate-500" onClick={() => onOpenRecord(r)}>
                {r.dateRaised ? new Date(r.dateRaised).toLocaleDateString('en-GB') : '—'}
              </button>
              <button className="text-left text-xs" onClick={() => onOpenRecord(r)}>
                {r.statusChangedAt
                  ? <span className="text-slate-300">{new Date(r.statusChangedAt).toLocaleDateString('en-GB')}</span>
                  : <span className="text-slate-600">—</span>}
              </button>
            </div>
          ))
        )}
      </div>

      {filteredRecords.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-600">
            {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
            {activeFilterCount > 0 ? ` (filtered from ${records.length})` : ''}
            {selectedIds.size > 0 && <span className="text-[#f97316] ml-2">{selectedIds.size} selected</span>}
          </p>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportPDF(exportList)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#f97316] border border-[#f97316]/30 hover:bg-[#f97316]/10 rounded-lg transition-colors"
              >
                <FileText size={12} /> Export Selected ({selectedIds.size})
              </button>
              <button
                onClick={() => onExportFull(exportList)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#f97316] border border-[#f97316]/30 hover:bg-[#f97316]/10 rounded-lg transition-colors"
              >
                <Printer size={12} /> Export Full ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
