import { useState, useMemo } from 'react';
import { Plus, ChevronRight, Trash2, X, Check, FileText, Calculator, TrendingUp, Clock, CheckCircle2, Send, Archive, CreditCard as Edit3 } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBValuation } from '../../lib/store';
import type { Project } from '../../data/types';
import ValuationDetail from './ValuationDetail';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  project: Project | null;
  projects: Project[];
  orgId: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  currentUserName: string;
  onProjectChange: (id: string) => void;
}

type ValuationStatus = 'draft' | 'submitted' | 'certified' | 'superseded';

const STATUS_CONFIG: Record<ValuationStatus, { label: string; icon: React.ComponentType<{ size?: number }>; bg: string; text: string; border: string }> = {
  draft:      { label: 'Draft',      icon: Edit3,        bg: 'bg-slate-700/30',   text: 'text-slate-400',   border: 'border-slate-600/40' },
  submitted:  { label: 'Submitted',  icon: Send,         bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
  certified:  { label: 'Certified',  icon: CheckCircle2, bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  superseded: { label: 'Superseded', icon: Archive,      bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20' },
};

function genId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

interface CreateModalProps {
  project: Project;
  nextRef: string;
  currentUserName: string;
  onSave: (v: DBValuation) => void;
  onClose: () => void;
}

function CreateModal({ project, nextRef, currentUserName, onSave, onClose }: CreateModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState('');
  const [valuationDate, setValuationDate] = useState(today);
  const [period, setPeriod] = useState('');
  const [client, setClient] = useState(project.client || '');
  const [contractor, setContractor] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!title.trim()) return;
    const v: DBValuation = {
      id: genId(),
      project_id: project.id,
      ref: nextRef,
      title: title.trim(),
      valuation_date: valuationDate,
      period: period.trim(),
      client: client.trim(),
      contractor: contractor.trim(),
      notes: notes.trim(),
      status: 'draft',
      created_by: currentUserName,
    };
    onSave(v);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e2d4a' }}>
          <div>
            <p className="text-sm font-bold text-white">New Valuation</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{project.name} · {nextRef}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"><X size={14} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Valuation Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Valuation No. 3 – July 2026"
              autoFocus
              className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Valuation Date</label>
              <input
                type="date"
                value={valuationDate}
                onChange={e => setValuationDate(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Valuation Period</label>
              <input
                value={period}
                onChange={e => setPeriod(e.target.value)}
                placeholder="e.g. Month 6"
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Client</label>
              <input
                value={client}
                onChange={e => setClient(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Contractor</label>
              <input
                value={contractor}
                onChange={e => setContractor(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Notes / Description</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Brief description or notes about this valuation…"
              className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] resize-none transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors"
            style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-40"
            style={{ background: '#f97316' }}
          >
            Create Valuation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CommercialValuations({ project, projects, orgId, canCreate, canEdit, canDelete, currentUserName, onProjectChange }: Props) {
  const store = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const projectValuations = useMemo(() =>
    store.valuations
      .filter(v => v.project_id === project?.id)
      .sort((a, b) => {
        const aNum = parseInt(a.ref.replace(/\D/g, ''), 10) || 0;
        const bNum = parseInt(b.ref.replace(/\D/g, ''), 10) || 0;
        return bNum - aNum;
      }),
    [store.valuations, project?.id]
  );

  const nextRef = useMemo(() => {
    const existing = store.valuations.filter(v => v.project_id === project?.id);
    const nums = existing.map(v => parseInt(v.ref.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `VAL-${String(next).padStart(3, '0')}`;
  }, [store.valuations, project?.id]);

  // Summary metrics
  const totals = useMemo(() => {
    const lines = store.valuationLines.filter(l => l.project_id === project?.id);
    const extras = store.valuationExtraLines.filter(l => l.project_id === project?.id);
    const contractTotal = lines.reduce((s, l) => s + l.contract_value, 0);
    const extrasTotal = extras.reduce((s, e) => s + e.agreed_value, 0);
    return { contractTotal, extrasTotal };
  }, [store.valuationLines, store.valuationExtraLines, project?.id]);

  const handleCreate = async (v: DBValuation) => {
    await store.addValuation(v);
    setShowCreate(false);
    setOpenId(v.id);
  };

  const handleDelete = async (id: string) => {
    await store.removeValuation(id);
    setDeleteId(null);
    if (openId === id) setOpenId(null);
  };

  if (openId) {
    const val = store.valuations.find(v => v.id === openId);
    if (val && project) {
      return (
        <ValuationDetail
          valuation={val}
          project={project}
          orgId={orgId}
          canEdit={canEdit}
          canDelete={canDelete}
          currentUserName={currentUserName}
          onBack={() => setOpenId(null)}
        />
      );
    }
  }

  return (
    <div>
      {/* Project selector */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <select
            value={project?.id ?? ''}
            onChange={e => onProjectChange(e.target.value)}
            className="bg-[#0d1628] border border-[#1e2d4a] text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#f97316] transition-colors"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {project && (
            <span className="text-xs text-slate-500">{projectValuations.length} {projectValuations.length === 1 ? 'valuation' : 'valuations'}</span>
          )}
        </div>
        {canCreate && project && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors"
            style={{ background: '#f97316' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#ea6c0a')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}
          >
            <Plus size={14} /> New Valuation
          </button>
        )}
      </div>

      {!project ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Calculator size={28} className="text-slate-700 mb-3" />
          <p className="text-sm text-slate-500">Select a project to view valuations</p>
        </div>
      ) : projectValuations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-[#1e2d4a] flex items-center justify-center mb-4">
            <Calculator size={24} className="text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-400 mb-1">No valuations yet</p>
          <p className="text-xs text-slate-600 max-w-sm mb-5 leading-relaxed">
            Create your first valuation to start tracking progress against the contract.
          </p>
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: '#f97316' }}
            >
              <Plus size={14} /> Create First Valuation
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary cards */}
          {(totals.contractTotal > 0 || totals.extrasTotal > 0) && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">Contract Works Total</p>
                <p className="text-lg font-black text-white">{fmtCurrency(totals.contractTotal)}</p>
              </div>
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">Extras / Agreed Variations</p>
                <p className="text-lg font-black text-white">{fmtCurrency(totals.extrasTotal)}</p>
              </div>
            </div>
          )}

          {/* Valuation list */}
          {projectValuations.map(val => {
            const sc = STATUS_CONFIG[val.status as ValuationStatus] ?? STATUS_CONFIG.draft;
            const StatusIcon = sc.icon;
            const lines = store.valuationLines.filter(l => l.valuation_id === val.id);
            const extras = store.valuationExtraLines.filter(l => l.valuation_id === val.id);

            const contractTotal = lines.reduce((s, l) => s + l.contract_value, 0);
            const currentContractValue = lines.reduce((s, l) => s + l.contract_value * l.current_pct / 100, 0);
            const prevContractValue = lines.reduce((s, l) => s + l.contract_value * l.previous_pct / 100, 0);
            const extrasTotal = extras.reduce((s, e) => s + e.agreed_value * e.current_pct / 100, 0);
            const extrasPrev = extras.reduce((s, e) => s + e.agreed_value * e.previous_pct / 100, 0);

            const grossToDate = currentContractValue + extrasTotal;
            const prevToDate = prevContractValue + extrasPrev;
            const thisDue = grossToDate - prevToDate;

            return (
              <div
                key={val.id}
                className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl hover:border-[#2a3a5a] transition-all duration-150 group"
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Left icon */}
                  <div className="w-10 h-10 rounded-lg bg-[#111827] border border-[#1e2d4a] flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-slate-500" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold font-mono text-slate-500">{val.ref}</span>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${sc.bg} ${sc.text} ${sc.border}`}>
                        <StatusIcon size={8} />
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white truncate">{val.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {val.valuation_date && (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock size={9} />
                          {fmtDate(val.valuation_date)}
                        </span>
                      )}
                      {val.period && (
                        <span className="text-[10px] text-slate-500">{val.period}</span>
                      )}
                      <span className="text-[10px] text-slate-600">{lines.length + extras.length} lines</span>
                    </div>
                  </div>

                  {/* Financials */}
                  {(contractTotal > 0 || grossToDate > 0) && (
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 mr-2">
                      {thisDue !== 0 && (
                        <div className="text-right">
                          <p className="text-[9px] text-slate-600 uppercase tracking-wider">This Valuation</p>
                          <p className={`text-sm font-bold ${thisDue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCurrency(thisDue)}</p>
                        </div>
                      )}
                      {grossToDate > 0 && (
                        <div className="text-right">
                          <p className="text-[9px] text-slate-600 uppercase tracking-wider">Gross to Date</p>
                          <p className="text-xs text-slate-400">{fmtCurrency(grossToDate)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {canDelete && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteId(val.id); }}
                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => setOpenId(val.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
                      style={{ background: '#111827', border: '1px solid #1e2d4a' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#f97316')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2d4a')}
                    >
                      Open <ChevronRight size={11} />
                    </button>
                  </div>
                </div>

                {/* Progress bar — contract works completion */}
                {contractTotal > 0 && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-slate-600">Contract completion</span>
                      <span className="text-[9px] text-slate-500">
                        {contractTotal > 0 ? Math.round(currentContractValue / contractTotal * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-1 bg-[#111827] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${contractTotal > 0 ? Math.min(currentContractValue / contractTotal * 100, 100) : 0}%`,
                          background: 'linear-gradient(to right, #f97316, #fb923c)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && project && (
        <CreateModal
          project={project}
          nextRef={nextRef}
          currentUserName={currentUserName}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl p-6" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 size={15} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Delete Valuation?</p>
                <p className="text-[10px] text-slate-500">All lines and extras will also be deleted.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
                style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suppress unused */}
      {false && <TrendingUp size={0} />}
      {false && <Check size={0} />}
    </div>
  );
}
