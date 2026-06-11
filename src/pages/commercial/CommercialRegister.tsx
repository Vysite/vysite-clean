import { useState, useMemo } from 'react';
import {
  Search, Filter, Plus, TrendingUp, FileText, Printer,
  ChevronRight, CheckCircle2, Clock, AlertCircle, CircleDot, Banknote,
} from 'lucide-react';
import { RECORD_TYPES, STATUSES, typeInfo, statusInfo } from './types';
import type { CommercialRecord, CommercialRecordType, CommercialRecordStatus } from './types';
import type { DBKeyDate } from '../../lib/store';
import type { Project } from '../../data/types';
import { openPrintTab } from '../../lib/printTab';

interface CommercialRegisterProps {
  records: CommercialRecord[];
  loading: boolean;
  projects: { id: string; name: string; client: string }[];
  canCreate: boolean;
  canEdit: boolean;
  currentProject: Project | null;
  keyDates: DBKeyDate[];
  currentUserName: string;
  settings?: { company_name?: string; logo_data_url?: string } | null;
  onNewRecord: () => void;
  onOpenRecord: (r: CommercialRecord) => void;
}

function fmtCurrency(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escHtml(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtD(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB');
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

const PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1e293b; background: white; font-size: 11px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 880px; margin: 0 auto; padding: 36px 40px; }
  .doc-header { display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 12px; border-bottom: 3px solid #f97316; margin-bottom: 22px; }
  .doc-logo-text { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: 0.05em; line-height: 1; }
  .doc-tagline { font-size: 9px; color: #94a3b8; margin-top: 3px; letter-spacing: 0.04em; }
  .doc-header-right { text-align: right; }
  .doc-title { font-size: 17px; font-weight: 900; color: #0f172a; line-height: 1.2; margin-bottom: 3px; }
  .doc-dateline { font-size: 10px; color: #64748b; }
  .report-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
  .report-meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; padding: 7px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
  .report-meta-value { font-size: 10.5px; font-weight: 600; color: #0f172a; padding: 7px 14px; background: white; border-bottom: 1px solid #e2e8f0; }
  .section-heading { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 12px; margin-top: 24px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .data-table th { padding: 8px 10px; text-align: left; font-size: 8.5px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; }
  .data-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: top; }
  .data-table tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; font-size: 8.5px; font-weight: 700; padding: 2px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
  .badge-orange { background: #fff7ed; color: #c2410c; } .badge-green { background: #d1fae5; color: #065f46; }
  .badge-amber { background: #fef3c7; color: #92400e; } .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .badge-slate { background: #f1f5f9; color: #475569; } .badge-red { background: #fee2e2; color: #991b1b; }
  .doc-footer { margin-top: 36px; padding-top: 10px; border-top: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
  .doc-footer-left { font-size: 8px; color: #94a3b8; }
  .doc-footer-right { font-size: 8px; color: #94a3b8; text-align: right; }
  @media print { .page { padding: 20px 24px; } }
`;

export default function CommercialRegister({
  records, loading, projects, canCreate, currentProject,
  currentUserName, onNewRecord, onOpenRecord,
}: CommercialRegisterProps) {
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterType, setFilterType]     = useState<CommercialRecordType | ''>('');
  const [filterStatus, setFilterStatus] = useState<CommercialRecordStatus | ''>('');
  const [filterProject, setFilterProject] = useState('');
  const [showFilters, setShowFilters]   = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  const activeFilterCount = [filterType, filterStatus, filterProject].filter(Boolean).length;

  const filteredRecords = useMemo(() => {
    let list = records;
    if (filterType)    list = list.filter(r => r.recordType === filterType);
    if (filterStatus)  list = list.filter(r => r.status === filterStatus);
    if (filterProject) list = list.filter(r => r.projectId === filterProject);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.reference.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.client.toLowerCase().includes(q) ||
        (r.projectName ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [records, filterType, filterStatus, filterProject, searchQuery]);

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

  function exportRegisterPDF(list: CommercialRecord[]) {
    const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const projName = currentProject?.name ?? 'All Projects';
    const projClient = currentProject?.client ?? '';
    const statusBadgeCls = (s: string) => ['agreed','added_to_valuation','paid','complete'].includes(s) ? 'badge-green' : s === 'submitted' || s === 'awaiting_agreement' ? 'badge-blue' : s === 'rejected' ? 'badge-red' : 'badge-amber';
    const typeBadgeCls  = (t: string) => t === 'variation' ? 'badge-orange' : t === 'delay_notice' ? 'badge-amber' : t === 'compensation_event' ? 'badge-blue' : 'badge-slate';

    const rows = list.map(r => `
      <tr>
        <td><span class="badge ${typeBadgeCls(r.recordType)}">${escHtml(typeInfo(r.recordType).label)}</span></td>
        <td style="font-family:monospace;font-size:9.5px;font-weight:700;color:#f97316;">${escHtml(r.reference || '—')}</td>
        <td style="font-weight:600;">${escHtml(r.title || 'Untitled')}</td>
        <td>${escHtml(r.projectName || '—')}</td>
        <td>${escHtml(r.client || '—')}</td>
        <td><span class="badge ${statusBadgeCls(r.status)}">${escHtml(statusInfo(r.status).label)}</span></td>
        <td>${fmtD(r.dateRaised)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Commercial Register — ${escHtml(projName)}</title>
    <style>${PDF_CSS}</style>
    <script>window.onload=function(){window.print();}<\/script>
    </head><body><div class="page">
      <div class="doc-header">
        <div><div class="doc-logo-text">VYSITE</div><div class="doc-tagline">Construction Operating System</div></div>
        <div class="doc-header-right">
          <div class="doc-title">Commercial Register</div>
          <div class="doc-dateline">${escHtml(projName)}${projClient ? ' &mdash; ' + escHtml(projClient) : ''}</div>
        </div>
      </div>
      <div class="report-meta">
        <div class="report-meta-label">Report Type</div><div class="report-meta-value">Commercial Register</div>
        <div class="report-meta-label">Project</div><div class="report-meta-value">${escHtml(projName)}</div>
        <div class="report-meta-label">Records</div><div class="report-meta-value">${list.length} record${list.length !== 1 ? 's' : ''}</div>
        <div class="report-meta-label">Generated Date</div><div class="report-meta-value">${todayStr}</div>
        <div class="report-meta-label">Generated By</div><div class="report-meta-value">${escHtml(currentUserName || '—')}</div>
      </div>
      <div class="section-heading">Commercial Records (${list.length})</div>
      <table class="data-table">
        <thead><tr><th>Type</th><th>Reference</th><th>Title</th><th>Project</th><th>Client</th><th>Status</th><th>Date Raised</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">No records</td></tr>'}</tbody>
      </table>
      <div class="doc-footer">
        <div class="doc-footer-left">VYSITE &bull; Construction Operating System &bull; Commercial Document &mdash; Confidential</div>
        <div class="doc-footer-right">Generated by ${escHtml(currentUserName || 'VYSITE')} &bull; ${todayStr} &bull; &copy; VYSITE. All rights reserved.</div>
      </div>
    </div></body></html>`;
    openPrintTab(html);
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
              onClick={() => { setFilterType(''); setFilterStatus(''); setFilterProject(''); }}
              className="text-xs text-slate-500 hover:text-white transition-colors shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => exportRegisterPDF(exportList)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-[#f97316] rounded-lg transition-colors"
          >
            <FileText size={12} />Export PDF
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
          <div className="min-w-[220px]">
            <label className={labelCls}>Project</label>
            <select className={selectCls} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Register table */}
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[32px_130px_1fr_160px_160px_160px_100px] gap-3 px-4 py-2.5 border-b border-[#1e2d4a] text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
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
          <span>Date Raised</span>
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
              className={`grid grid-cols-[32px_130px_1fr_160px_160px_160px_100px] gap-3 px-4 py-3 transition-colors hover:bg-[#1a2236] ${
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
              <button className="text-left" onClick={() => onOpenRecord(r)}><StatusBadge status={r.status} /></button>
              <button className="text-left text-xs text-slate-500" onClick={() => onOpenRecord(r)}>
                {r.dateRaised ? new Date(r.dateRaised).toLocaleDateString('en-GB') : '—'}
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
            <button
              onClick={() => exportRegisterPDF(exportList)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#f97316] border border-[#f97316]/30 hover:bg-[#f97316]/10 rounded-lg transition-colors"
            >
              <Printer size={12} /> Export Selected ({selectedIds.size})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
