import { useState } from 'react';
import { Search, Plus, Paperclip, ChevronDown, Clock, FileQuestion, X } from 'lucide-react';
import { useAppStore } from '../lib/StoreContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RFIRecord {
  id: string;
  rfiRef: string;
  subject: string;
  question: string;
  response: string;
  requiredResponseDate: string;
  projectId: string;
  projectName: string;
  raisedBy: string;
  assignedTo: string;
  date: string;
  status: RFIStatus;
  notes: string;
  attachmentCount: number;
}

export type RFIStatus = 'Draft' | 'Issued' | 'Awaiting Response' | 'Closed';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function daysOpen(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function daysUntilResponse(dateStr?: string): number | null {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

const STATUS_CFG: Record<RFIStatus, { dot: string; badge: string; label: string }> = {
  Draft:             { dot: 'bg-slate-500',   badge: 'bg-[#1e2d4a] text-slate-400',              label: 'Draft' },
  Issued:            { dot: 'bg-cyan-400',    badge: 'bg-cyan-900/60 text-cyan-300',               label: 'Issued' },
  'Awaiting Response': { dot: 'bg-amber-400', badge: 'bg-amber-900/60 text-amber-300',            label: 'Awaiting Response' },
  Closed:            { dot: 'bg-emerald-400', badge: 'bg-emerald-900/60 text-emerald-300',        label: 'Closed' },
};

function StatusPill({ status }: { status: RFIStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG['Draft'];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
      {cfg.label}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-4">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main RFI Register ────────────────────────────────────────────────────────

interface RFIRegisterProps {
  rfis: RFIRecord[];
  onNewRFI: () => void;
  onOpenTicket: (id: string) => void;
  onUpdateStatus: (id: string, status: RFIStatus) => void;
  filterProject: string;
  onFilterProject: (p: string) => void;
}

export default function RFIRegister({
  rfis, onNewRFI, onOpenTicket, filterProject, onFilterProject,
}: RFIRegisterProps) {
  const store = useAppStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'date' | 'ref' | 'response' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const visibleProjects = store.visibleProjectIds
    ? store.projects.filter(p => store.visibleProjectIds!.includes(p.id))
    : store.projects;

  const today = new Date().toISOString().slice(0, 10);

  const filtered = rfis
    .filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        r.rfiRef.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.question.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q) ||
        r.raisedBy.toLowerCase().includes(q) ||
        r.assignedTo.toLowerCase().includes(q);
      const matchProject = filterProject === 'All' || r.projectId === filterProject;
      const matchStatus = filterStatus === 'All' || r.status === filterStatus;
      return matchSearch && matchProject && matchStatus;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortBy === 'ref') cmp = a.rfiRef.localeCompare(b.rfiRef);
      else if (sortBy === 'response') cmp = (a.requiredResponseDate || '9999').localeCompare(b.requiredResponseDate || '9999');
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const stats = {
    total: rfis.length,
    open: rfis.filter(r => r.status !== 'Closed').length,
    awaiting: rfis.filter(r => r.status === 'Awaiting Response').length,
    overdue: rfis.filter(r => r.status !== 'Closed' && r.requiredResponseDate && r.requiredResponseDate < today).length,
    closed: rfis.filter(r => r.status === 'Closed').length,
  };

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <span className="text-slate-700 ml-0.5">↕</span>;
    return <span className="text-[#f97316] ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total RFIs" value={stats.total} sub="all time" color="text-white" />
        <StatCard label="Open" value={stats.open} sub="not yet closed" color="text-cyan-400" />
        <StatCard label="Awaiting Response" value={stats.awaiting} sub="pending reply" color="text-amber-400" />
        <StatCard label="Overdue" value={stats.overdue} sub="past response date" color={stats.overdue > 0 ? 'text-red-400' : 'text-slate-500'} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search RFIs — ref, subject, question, assignee…"
            className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600" />
          {search && <button onClick={() => setSearch('')} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={13} /></button>}
        </div>

        {/* Project filter */}
        <div className="relative">
          <select value={filterProject} onChange={e => onFilterProject(e.target.value)}
            className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 pr-8 text-sm text-slate-300 outline-none focus:border-[#f97316] appearance-none">
            <option value="All">All Projects</option>
            {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
          {(['All', 'Draft', 'Issued', 'Awaiting Response', 'Closed'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                filterStatus === s ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>{s}</button>
          ))}
        </div>

        <button onClick={onNewRFI}
          className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors shrink-0">
          <Plus size={15} />New RFI
        </button>
      </div>

      {/* Register grid */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
        {/* Column headers */}
        <div className="hidden lg:grid grid-cols-[80px_60px_1fr_1fr_130px_130px_130px_140px_60px] gap-3 px-4 py-3 bg-[#0d1628] border-b border-[#1e2d4a]">
          {[
            { label: 'Ref', col: 'ref' as const },
            { label: '#', col: null },
            { label: 'Subject', col: null },
            { label: 'Project', col: null },
            { label: 'Raised By', col: null },
            { label: 'Date Raised', col: 'date' as const },
            { label: 'Response Due', col: 'response' as const },
            { label: 'Status', col: 'status' as const },
            { label: '', col: null },
          ].map(({ label, col }) => (
            <button key={label}
              onClick={() => col && toggleSort(col)}
              className={`text-left text-[10px] font-bold uppercase tracking-wider ${col ? 'hover:text-slate-300 cursor-pointer' : 'cursor-default'} text-slate-600`}
            >
              {label}{col && <SortIcon col={col} />}
            </button>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#1e2d4a]">
          {filtered.length === 0 && (
            <div className="text-center py-14">
              <FileQuestion size={32} className="text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No RFIs found</p>
              {stats.total === 0 && (
                <button onClick={onNewRFI} className="mt-3 text-xs text-[#f97316] hover:underline">Raise the first RFI</button>
              )}
            </div>
          )}

          {filtered.map(rfi => {
            const dtr = daysUntilResponse(rfi.requiredResponseDate);
            const isOverdue = rfi.status !== 'Closed' && dtr !== null && dtr < 0;
            const isUrgent = rfi.status !== 'Closed' && dtr !== null && dtr >= 0 && dtr <= 3;
            const days = daysOpen(rfi.date);

            return (
              <div key={rfi.id}
                onClick={() => onOpenTicket(rfi.id)}
                className={`cursor-pointer transition-colors group hover:bg-[#0d1628]/60 ${isOverdue ? 'border-l-2 border-l-red-800' : ''}`}>

                {/* Mobile card layout */}
                <div className="lg:hidden px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-slate-500">{rfi.rfiRef}</span>
                        <StatusPill status={rfi.status} />
                      </div>
                      <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors line-clamp-1">
                        {rfi.subject || <span className="text-slate-600 italic">No subject</span>}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{rfi.projectName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {rfi.requiredResponseDate && (
                      <span className={`text-[10px] font-semibold ${isOverdue ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-slate-500'}`}>
                        Due {fmt(rfi.requiredResponseDate)}
                        {isOverdue && ` (${Math.abs(dtr!)}d late)`}
                        {isUrgent && ` (${dtr}d left)`}
                      </span>
                    )}
                    {rfi.attachmentCount > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                        <Paperclip size={9} />{rfi.attachmentCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Desktop grid layout */}
                <div className="hidden lg:grid grid-cols-[80px_60px_1fr_1fr_130px_130px_130px_140px_60px] gap-3 px-4 py-3.5 items-center">

                {/* Ref */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-slate-400">{rfi.rfiRef}</span>
                </div>

                {/* Days open bubble */}
                <div className="flex">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    rfi.status === 'Closed' ? 'bg-[#1e2d4a] text-slate-600'
                      : days > 21 ? 'bg-red-900/50 text-red-400'
                      : days > 7 ? 'bg-amber-900/50 text-amber-400'
                      : 'bg-[#1e2d4a] text-slate-500'
                  }`}>{days}d</span>
                </div>

                {/* Subject */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors truncate">
                    {rfi.subject || <span className="text-slate-600 italic">No subject</span>}
                  </p>
                  {rfi.question && (
                    <p className="text-[11px] text-slate-600 truncate mt-0.5">{rfi.question}</p>
                  )}
                </div>

                {/* Project */}
                <p className="text-sm text-slate-500 truncate">{rfi.projectName}</p>

                {/* Raised By */}
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#f97316]/20 flex items-center justify-center text-[8px] font-bold text-[#f97316] shrink-0">
                    {(rfi.raisedBy || '?').split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <span className="text-xs text-slate-500 truncate">{rfi.raisedBy || '—'}</span>
                </div>

                {/* Date Raised */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock size={11} className="text-slate-600 shrink-0" />
                  {fmt(rfi.date)}
                </div>

                {/* Response Due */}
                <div>
                  {rfi.requiredResponseDate ? (
                    <span className={`text-xs font-semibold ${
                      isOverdue ? 'text-red-400'
                        : isUrgent ? 'text-amber-400'
                        : rfi.status === 'Closed' ? 'text-slate-600'
                        : 'text-slate-400'
                    }`}>
                      {fmt(rfi.requiredResponseDate)}
                      {isOverdue && <span className="ml-1 text-[9px] text-red-500">({Math.abs(dtr!)}d late)</span>}
                      {isUrgent && <span className="ml-1 text-[9px] text-amber-500">({dtr}d left)</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-700">—</span>
                  )}
                </div>

                {/* Status */}
                <StatusPill status={rfi.status} />

                {/* Attachments */}
                <div className="flex justify-end">
                  {rfi.attachmentCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-500 bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">
                      <Paperclip size={9} />{rfi.attachmentCount}
                    </span>
                  )}
                </div>
                </div>{/* end desktop grid */}
              </div>
            );
          })}
        </div>

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 bg-[#0d1628] border-t border-[#1e2d4a] flex items-center justify-between">
            <p className="text-[11px] text-slate-600">
              {filtered.length} of {rfis.length} RFI{rfis.length !== 1 ? 's' : ''}
              {filterStatus !== 'All' || filterProject !== 'All' || search ? ' (filtered)' : ''}
            </p>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-slate-600">
                <span className="text-amber-400 font-semibold">{filtered.filter(r => r.status === 'Awaiting Response').length}</span> awaiting
              </span>
              <span className="text-slate-600">
                <span className={`font-semibold ${stats.overdue > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {filtered.filter(r => r.status !== 'Closed' && r.requiredResponseDate && r.requiredResponseDate < today).length}
                </span> overdue
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
