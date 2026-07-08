import { useState, useMemo } from 'react';
import { Plus, ChevronRight, Trash2, X, Check, FileText, Calculator, Clock, CheckCircle2, Send, Archive, CreditCard as Edit3, BookOpen, Settings2, AlertCircle, Pencil, MoreVertical } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBValuation, DBValuationWorkbook, DBValuationLineEntry, DBValuationExtraEntry } from '../../lib/store';
import type { Project } from '../../data/types';
import ValuationDetail from './ValuationDetail';
import ValuationWorkbookEditor from './ValuationWorkbookEditor';

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
type ActiveView = 'list' | 'workbook' | 'valuation';

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
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
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
              <input type="date" value={valuationDate} onChange={e => setValuationDate(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Valuation Period</label>
              <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. Month 6"
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Client</label>
              <input value={client} onChange={e => setClient(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Contractor</label>
              <input value={contractor} onChange={e => setContractor(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Brief description or notes about this valuation…"
              className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] resize-none transition-colors" />
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors"
            style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!title.trim()}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-40"
            style={{ background: '#f97316' }}>
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
  const [view, setView] = useState<ActiveView>('list');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showWbMenu, setShowWbMenu] = useState(false);
  const [showRenameWb, setShowRenameWb] = useState(false);
  const [renameWbDraft, setRenameWbDraft] = useState('');
  const [showDeleteWb, setShowDeleteWb] = useState(false);
  const [deletingWb, setDeletingWb] = useState(false);

  const workbook: DBValuationWorkbook | undefined = useMemo(
    () => store.valuationWorkbooks.find(w => w.project_id === project?.id),
    [store.valuationWorkbooks, project?.id]
  );

  const wbLines = useMemo(
    () => workbook ? store.workbookLines.filter(l => l.workbook_id === workbook.id) : [],
    [store.workbookLines, workbook]
  );

  const wbExtras = useMemo(
    () => workbook ? store.workbookExtras.filter(e => e.workbook_id === workbook.id) : [],
    [store.workbookExtras, workbook]
  );

  const contractTotal = useMemo(() => wbLines.reduce((s, l) => s + l.contract_value, 0), [wbLines]);
  const extrasTotal   = useMemo(() => wbExtras.reduce((s, e) => s + e.agreed_value, 0), [wbExtras]);

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

  // Carry-forward: find most recent (highest ref number) valuation for this project
  const latestValuation = useMemo(() => {
    if (projectValuations.length === 0) return null;
    return projectValuations[0]; // already sorted desc
  }, [projectValuations]);

  const handleCreate = async (v: DBValuation) => {
    if (!workbook) { setShowCreate(false); return; }

    // Attach workbook reference
    const newVal: DBValuation = { ...v, workbook_id: workbook.id };
    await store.addValuation(newVal);

    // Build entries with carry-forward from previous valuation
    const lineEntries: DBValuationLineEntry[] = wbLines.map(line => {
      const prevEntry = latestValuation
        ? store.valuationLineEntries.find(e => e.valuation_id === latestValuation.id && e.workbook_line_id === line.id)
        : null;
      const prevPct = prevEntry?.current_pct ?? 0;
      return {
        id: genId(),
        valuation_id: newVal.id,
        workbook_line_id: line.id,
        previous_pct: prevPct,
        current_pct: prevPct,
        notes: '',
      };
    });

    const extraEntries: DBValuationExtraEntry[] = wbExtras.map(extra => {
      const prevEntry = latestValuation
        ? store.valuationExtraEntries.find(e => e.valuation_id === latestValuation.id && e.workbook_extra_id === extra.id)
        : null;
      const prevPct = prevEntry?.current_pct ?? 0;
      return {
        id: genId(),
        valuation_id: newVal.id,
        workbook_extra_id: extra.id,
        previous_pct: prevPct,
        current_pct: prevPct,
        notes: '',
      };
    });

    if (lineEntries.length > 0) await store.batchUpsertValuationLineEntries(lineEntries);
    if (extraEntries.length > 0) await store.batchUpsertValuationExtraEntries(extraEntries);

    setShowCreate(false);
    setOpenId(newVal.id);
    setView('valuation');
  };

  const handleDelete = async (id: string) => {
    await store.removeValuation(id);
    setDeleteId(null);
    if (openId === id) { setOpenId(null); setView('list'); }
  };

  // ── Routing ──────────────────────────────────────────────────────────────────

  if (view === 'workbook' && project && workbook) {
    return (
      <ValuationWorkbookEditor
        workbook={workbook}
        project={project}
        orgId={orgId}
        canEdit={canEdit}
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'valuation' && openId && project) {
    const val = store.valuations.find(v => v.id === openId);
    if (val) {
      return (
        <ValuationDetail
          valuation={val}
          workbook={workbook ?? null}
          wbLines={wbLines}
          wbExtras={wbExtras}
          project={project}
          orgId={orgId}
          canEdit={canEdit}
          canDelete={canDelete}
          currentUserName={currentUserName}
          onBack={() => { setView('list'); setOpenId(null); }}
        />
      );
    }
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <select
            value={project?.id ?? ''}
            onChange={e => onProjectChange(e.target.value)}
            className="bg-[#0d1628] border border-[#1e2d4a] text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#f97316] transition-colors"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {project && (
            <span className="text-xs text-slate-500">{projectValuations.length} {projectValuations.length === 1 ? 'valuation' : 'valuations'}</span>
          )}
        </div>
        {canCreate && project && workbook && (
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
      ) : (
        <div className="space-y-4">
          {/* Workbook banner */}
          {workbook ? (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d4a', background: '#0a1020' }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e2d4a' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center shrink-0">
                    <BookOpen size={12} className="text-[#f97316]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{workbook.title}</p>
                    <p className="text-[10px] text-slate-500">{wbLines.length} contract lines · {wbExtras.length} extras</p>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setView('workbook')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
                      style={{ background: '#111827', border: '1px solid #1e2d4a' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#f97316')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2d4a')}
                    >
                      <Settings2 size={11} /> Manage Workbook
                    </button>
                    {/* Workbook actions menu */}
                    <div className="relative">
                      <button
                        onClick={() => setShowWbMenu(v => !v)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"
                      >
                        <MoreVertical size={13} />
                      </button>
                      {showWbMenu && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setShowWbMenu(false)} />
                          <div className="absolute right-0 top-full mt-1 z-40 rounded-xl overflow-hidden shadow-2xl min-w-[160px]"
                            style={{ background: '#111827', border: '1px solid #1e2d4a' }}>
                            <button
                              onClick={() => { setRenameWbDraft(workbook.title); setShowRenameWb(true); setShowWbMenu(false); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-[#1e2d4a] hover:text-white transition-colors text-left"
                            >
                              <Pencil size={11} /> Rename Workbook
                            </button>
                            <div style={{ height: '1px', background: '#1e2d4a' }} />
                            <button
                              onClick={() => { setShowDeleteWb(true); setShowWbMenu(false); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors text-left"
                            >
                              <Trash2 size={11} /> Delete Workbook
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 divide-x divide-[#1e2d4a]">
                <div className="px-4 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-0.5">Contract Works</p>
                  <p className="text-base font-black text-white">{fmtCurrency(contractTotal)}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-0.5">Agreed Extras</p>
                  <p className="text-base font-black text-white">{fmtCurrency(extrasTotal)}</p>
                </div>
              </div>
            </div>
          ) : (
            /* No workbook — setup CTA */
            <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <AlertCircle size={18} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white mb-1">Contract workbook not set up</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Before creating valuations, import your contract build-up. The workbook holds the master
                  contract lines and is shared across all valuations for this project.
                </p>
                {canEdit && (
                  <button
                    onClick={async () => {
                      if (!project) return;
                      const wb: DBValuationWorkbook = { id: genId(), project_id: project.id, title: 'Contract Build-Up' };
                      await store.addValuationWorkbook(wb);
                      setView('workbook');
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors"
                    style={{ background: '#f97316' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ea6c0a')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}
                  >
                    <BookOpen size={12} /> Set Up Contract Workbook
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Valuations list */}
          {projectValuations.length === 0 ? (
            workbook && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#111827] border border-[#1e2d4a] flex items-center justify-center mb-4">
                  <FileText size={22} className="text-slate-600" />
                </div>
                <p className="text-sm font-semibold text-slate-400 mb-1">No valuations yet</p>
                <p className="text-xs text-slate-600 max-w-sm mb-5 leading-relaxed">
                  Your contract workbook is ready. Create your first valuation to begin tracking progress.
                </p>
                {canCreate && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                    style={{ background: '#f97316' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ea6c0a')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}
                  >
                    <Plus size={14} /> Create First Valuation
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="space-y-2.5">
              {projectValuations.map(val => {
                const sc = STATUS_CONFIG[val.status as ValuationStatus] ?? STATUS_CONFIG.draft;
                const StatusIcon = sc.icon;
                const lineEntries = store.valuationLineEntries.filter(e => e.valuation_id === val.id);
                const extraEntries = store.valuationExtraEntries.filter(e => e.valuation_id === val.id);

                // Gross to date: sum contract_value * current_pct for each line + extras
                const contractCurrValue = wbLines.reduce((s, l) => {
                  const e = lineEntries.find(x => x.workbook_line_id === l.id);
                  return s + l.contract_value * (e?.current_pct ?? 0) / 100;
                }, 0);
                const contractPrevValue = wbLines.reduce((s, l) => {
                  const e = lineEntries.find(x => x.workbook_line_id === l.id);
                  return s + l.contract_value * (e?.previous_pct ?? 0) / 100;
                }, 0);
                const extrasCurrValue = wbExtras.reduce((s, ex) => {
                  const e = extraEntries.find(x => x.workbook_extra_id === ex.id);
                  return s + ex.agreed_value * (e?.current_pct ?? 0) / 100;
                }, 0);
                const extrasPrevValue = wbExtras.reduce((s, ex) => {
                  const e = extraEntries.find(x => x.workbook_extra_id === ex.id);
                  return s + ex.agreed_value * (e?.previous_pct ?? 0) / 100;
                }, 0);

                const grossToDate = contractCurrValue + extrasCurrValue;
                const prevTotal   = contractPrevValue + extrasPrevValue;
                const thisVal     = grossToDate - prevTotal;
                const grandTotal  = contractTotal + extrasTotal;
                const completionPct = grandTotal > 0 ? Math.min(grossToDate / grandTotal * 100, 100) : 0;

                return (
                  <div key={val.id} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl hover:border-[#2a3a5a] transition-all duration-150 group">
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-9 h-9 rounded-lg bg-[#111827] border border-[#1e2d4a] flex items-center justify-center shrink-0">
                        <FileText size={15} className="text-slate-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
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
                              <Clock size={9} />{fmtDate(val.valuation_date)}
                            </span>
                          )}
                          {val.period && <span className="text-[10px] text-slate-500">{val.period}</span>}
                        </div>
                      </div>

                      {grossToDate > 0 && (
                        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 mr-2">
                          <div className="text-right">
                            <p className="text-[9px] text-slate-600 uppercase tracking-wider">This Valuation</p>
                            <p className={`text-sm font-bold ${thisVal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCurrency(thisVal)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Gross to Date</p>
                            <p className="text-xs text-slate-400">{fmtCurrency(grossToDate)}</p>
                          </div>
                        </div>
                      )}

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
                          onClick={() => { setOpenId(val.id); setView('valuation'); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
                          style={{ background: '#111827', border: '1px solid #1e2d4a' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#f97316')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2d4a')}
                        >
                          Open <ChevronRight size={11} />
                        </button>
                      </div>
                    </div>

                    {grandTotal > 0 && (
                      <div className="px-4 pb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-slate-600">Contract completion</span>
                          <span className="text-[9px] text-slate-500">{Math.round(completionPct)}%</span>
                        </div>
                        <div className="h-1 bg-[#111827] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${completionPct}%`, background: 'linear-gradient(to right, #f97316, #fb923c)' }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && project && workbook && (
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
                <p className="text-[10px] text-slate-500">All period entries will also be deleted.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
                style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename workbook modal */}
      {showRenameWb && workbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e2d4a' }}>
              <p className="text-sm font-bold text-white">Rename Workbook</p>
              <button onClick={() => setShowRenameWb(false)} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"><X size={14} /></button>
            </div>
            <div className="px-5 py-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Workbook Name</label>
              <input
                value={renameWbDraft}
                onChange={e => setRenameWbDraft(e.target.value)}
                autoFocus
                onKeyDown={async e => {
                  if (e.key === 'Enter' && renameWbDraft.trim()) {
                    await store.updateValuationWorkbook({ ...workbook, title: renameWbDraft.trim() });
                    setShowRenameWb(false);
                  }
                  if (e.key === 'Escape') setShowRenameWb(false);
                }}
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setShowRenameWb(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}>Cancel</button>
              <button
                onClick={async () => {
                  if (!renameWbDraft.trim()) return;
                  await store.updateValuationWorkbook({ ...workbook, title: renameWbDraft.trim() });
                  setShowRenameWb(false);
                }}
                disabled={!renameWbDraft.trim()}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40"
                style={{ background: '#f97316' }}
              >
                <Check size={12} className="inline mr-1.5" />Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete workbook confirm */}
      {showDeleteWb && workbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Trash2 size={16} className="text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white mb-1">Delete Contract Workbook?</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This will permanently delete <span className="text-white font-semibold">{workbook.title}</span> and all associated data:
                  </p>
                </div>
              </div>

              {/* Warning list */}
              <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: '#111827', border: '1px solid #3b1e1e' }}>
                {[
                  `${wbLines.length} contract line${wbLines.length !== 1 ? 's' : ''}`,
                  `${wbExtras.length} extra${wbExtras.length !== 1 ? 's' : ''} / agreed variation${wbExtras.length !== 1 ? 's' : ''}`,
                  `${projectValuations.length} valuation${projectValuations.length !== 1 ? 's' : ''} (${projectValuations.map(v => v.ref).join(', ') || 'none'})`,
                  'All period entries and historical % progress',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                    <span className="text-xs text-red-300">{item}</span>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-slate-500 mb-4">
                This action cannot be undone. You can then create a new workbook and re-import the correct contract build-up.
              </p>

              <div className="flex gap-2">
                <button onClick={() => setShowDeleteWb(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}>
                  Cancel
                </button>
                <button
                  disabled={deletingWb}
                  onClick={async () => {
                    if (!project) return;
                    setDeletingWb(true);
                    try {
                      await store.removeValuationWorkbook(workbook.id, project.id);
                      setView('list');
                      setOpenId(null);
                    } finally {
                      setDeletingWb(false);
                      setShowDeleteWb(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {deletingWb ? 'Deleting…' : 'Delete Workbook & All Valuations'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
