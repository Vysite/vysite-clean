import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft, FileText, Download, ChevronDown, ChevronRight, X, CreditCard as Edit2, Lock, Unlock, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type {
  DBValuation, DBValuationWorkbook, DBWorkbookLine, DBWorkbookExtra,
  DBValuationLineEntry, DBValuationExtraEntry,
} from '../../lib/store';
import type { Project } from '../../data/types';
import { buildValuationPdf } from './ValuationPDF';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  valuation: DBValuation;
  workbook: DBValuationWorkbook | null;
  wbLines: DBWorkbookLine[];
  wbExtras: DBWorkbookExtra[];
  project: Project;
  orgId: string;
  canEdit: boolean;
  canDelete: boolean;
  currentUserName: string;
  onBack: () => void;
}

type ValuationStatus = 'draft' | 'submitted' | 'certified' | 'superseded' | 'locked';

const STATUS_OPTS: { value: ValuationStatus; label: string }[] = [
  { value: 'draft',      label: 'Draft' },
  { value: 'submitted',  label: 'Submitted' },
  { value: 'certified',  label: 'Certified' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'locked',     label: 'Locked' },
];

const STATUS_STYLES: Record<ValuationStatus, string> = {
  draft:      'bg-slate-700/30 text-slate-400 border-slate-600/40',
  submitted:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  certified:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  superseded: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  locked:     'bg-slate-600/20 text-slate-300 border-slate-500/30',
};

type SaveState = 'idle' | 'saving' | 'saved';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(n);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

// ─── Save indicator hook ──────────────────────────────────────────────────────

function useSaveIndicator() {
  const [state, setState] = useState<SaveState>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSaveStart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setState('saving');
  }, []);

  const onSaveDone = useCallback(() => {
    setState('saved');
    setLastSaved(new Date());
    timer.current = setTimeout(() => setState('idle'), 3000);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { state, lastSaved, onSaveStart, onSaveDone };
}

// ─── Pct input ────────────────────────────────────────────────────────────────

interface PctInputProps {
  value: number;
  disabled?: boolean;
  onCommit: (v: number) => void;
}

function PctInput({ value, disabled, onCommit }: PctInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (disabled) return <span className="text-slate-500 tabular-nums">{value.toFixed(2)}%</span>;

  if (editing) {
    return (
      <input
        value={draft} autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { const n = parseFloat(draft); onCommit(isNaN(n) ? value : Math.min(100, Math.max(0, n))); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            const n = parseFloat(draft);
            onCommit(isNaN(n) ? value : Math.min(100, Math.max(0, n)));
            setEditing(false); e.preventDefault();
          }
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-16 bg-[#111827] border border-[#f97316] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none tabular-nums text-right"
      />
    );
  }

  return (
    <button onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="text-xs text-white hover:text-[#f97316] transition-colors tabular-nums font-semibold">
      {value.toFixed(2)}%
    </button>
  );
}

// ─── Notes input ──────────────────────────────────────────────────────────────

interface NotesInputProps { value: string; onCommit: (v: string) => void; }

function NotesInput({ value, onCommit }: NotesInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (editing) {
    return (
      <input value={draft} autoFocus onChange={e => setDraft(e.target.value)}
        onBlur={() => { onCommit(draft); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onCommit(draft); setEditing(false); e.preventDefault(); } if (e.key === 'Escape') setEditing(false); }}
        className="w-full bg-[#111827] border border-[#f97316] rounded px-1.5 py-0.5 text-xs text-slate-300 focus:outline-none" />
    );
  }

  return (
    <span onClick={() => { setDraft(value); setEditing(true); }}
      className="cursor-pointer text-slate-600 hover:text-slate-400 transition-colors text-xs truncate block max-w-[120px]">
      {value || <span className="italic">—</span>}
    </span>
  );
}

// ─── Edit Header Modal ────────────────────────────────────────────────────────

interface EditHeaderModalProps {
  valuation: DBValuation;
  onSave: (patch: Partial<DBValuation>) => void;
  onClose: () => void;
}

function EditHeaderModal({ valuation, onSave, onClose }: EditHeaderModalProps) {
  const [title, setTitle]           = useState(valuation.title);
  const [status, setStatus]         = useState(valuation.status as ValuationStatus);
  const [date, setDate]             = useState(valuation.valuation_date);
  const [period, setPeriod]         = useState(valuation.period);
  const [client, setClient]         = useState(valuation.client);
  const [contractor, setContractor] = useState(valuation.contractor);
  const [notes, setNotes]           = useState(valuation.notes);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e2d4a' }}>
          <p className="text-sm font-bold text-white">Edit Valuation Details</p>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"><X size={14} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
              className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as ValuationStatus)}
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors">
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Period</label>
              <input value={period} onChange={e => setPeriod(e.target.value)}
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
              className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] resize-none transition-colors" />
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors"
            style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}>Cancel</button>
          <button onClick={() => { onSave({ title, status, valuation_date: date, period, client, contractor, notes }); onClose(); }}
            disabled={!title.trim()} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40"
            style={{ background: '#f97316' }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, total, expanded, onToggle }: {
  title: string; count: number; total: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[#111827]/50 transition-colors"
      style={{ background: '#0a1020', border: '1px solid #1e2d4a' }}>
      <div className="flex items-center gap-2">
        {expanded ? <ChevronDown size={13} className="text-slate-500" /> : <ChevronRight size={13} className="text-slate-500" />}
        <span className="text-xs font-bold text-white">{title}</span>
        <span className="text-[10px] text-slate-600">({count} lines)</span>
      </div>
      <span className="text-xs font-bold text-slate-300">{fmtCurrency(total)}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ValuationDetail({
  valuation, workbook, wbLines, wbExtras, project, orgId, canEdit, onBack,
}: Props) {
  const store = useAppStore();
  const [showEditHeader, setShowEditHeader] = useState(false);
  const [linesExpanded, setLinesExpanded]   = useState(true);
  const [extrasExpanded, setExtrasExpanded] = useState(true);
  const [pdfLoading, setPdfLoading]         = useState(false);
  const { state: saveState, lastSaved, onSaveStart, onSaveDone } = useSaveIndicator();

  const isLocked = valuation.status === 'locked';
  const effectiveCanEdit = canEdit && !isLocked;

  const lineEntries  = useMemo(() => store.valuationLineEntries.filter(e => e.valuation_id === valuation.id), [store.valuationLineEntries, valuation.id]);
  const extraEntries = useMemo(() => store.valuationExtraEntries.filter(e => e.valuation_id === valuation.id), [store.valuationExtraEntries, valuation.id]);

  const getLineEntry = useCallback((lineId: string): DBValuationLineEntry => (
    lineEntries.find(e => e.workbook_line_id === lineId) ?? {
      id: '', valuation_id: valuation.id, workbook_line_id: lineId, previous_pct: 0, current_pct: 0, notes: '',
    }
  ), [lineEntries, valuation.id]);

  const getExtraEntry = useCallback((extraId: string): DBValuationExtraEntry => (
    extraEntries.find(e => e.workbook_extra_id === extraId) ?? {
      id: '', valuation_id: valuation.id, workbook_extra_id: extraId, previous_pct: 0, current_pct: 0, notes: '',
    }
  ), [extraEntries, valuation.id]);

  const totals = useMemo(() => {
    const contractOriginal  = wbLines.reduce((s, l) => s + l.contract_value, 0);
    const contractPrevValue = wbLines.reduce((s, l) => s + l.contract_value * getLineEntry(l.id).previous_pct / 100, 0);
    const contractCurrValue = wbLines.reduce((s, l) => s + l.contract_value * getLineEntry(l.id).current_pct  / 100, 0);
    const contractThisVal   = contractCurrValue - contractPrevValue;
    const extrasOriginal    = wbExtras.reduce((s, e) => s + e.agreed_value, 0);
    const extrasPrevValue   = wbExtras.reduce((s, e) => s + e.agreed_value * getExtraEntry(e.id).previous_pct / 100, 0);
    const extrasCurrValue   = wbExtras.reduce((s, e) => s + e.agreed_value * getExtraEntry(e.id).current_pct  / 100, 0);
    const extrasThisVal     = extrasCurrValue - extrasPrevValue;
    return {
      contractOriginal, contractPrevValue, contractCurrValue, contractThisVal,
      extrasOriginal, extrasPrevValue, extrasCurrValue, extrasThisVal,
      grossToDate:    contractCurrValue + extrasCurrValue,
      previousTotal:  contractPrevValue + extrasPrevValue,
      amountDue:      contractThisVal   + extrasThisVal,
    };
  }, [wbLines, wbExtras, getLineEntry, getExtraEntry]);

  const handleLinePct = useCallback(async (lineId: string, current_pct: number) => {
    onSaveStart();
    const existing = lineEntries.find(e => e.workbook_line_id === lineId);
    if (existing) {
      await store.upsertValuationLineEntry({ ...existing, current_pct });
    } else {
      await store.upsertValuationLineEntry({
        id: crypto.randomUUID(), valuation_id: valuation.id, workbook_line_id: lineId,
        previous_pct: 0, current_pct, notes: '',
      });
    }
    onSaveDone();
  }, [lineEntries, store, valuation.id, onSaveStart, onSaveDone]);

  const handleLineNotes = useCallback(async (lineId: string, notes: string) => {
    const existing = lineEntries.find(e => e.workbook_line_id === lineId);
    if (existing) { onSaveStart(); await store.upsertValuationLineEntry({ ...existing, notes }); onSaveDone(); }
  }, [lineEntries, store, onSaveStart, onSaveDone]);

  const handleExtraPct = useCallback(async (extraId: string, current_pct: number) => {
    onSaveStart();
    const existing = extraEntries.find(e => e.workbook_extra_id === extraId);
    if (existing) {
      await store.upsertValuationExtraEntry({ ...existing, current_pct });
    } else {
      await store.upsertValuationExtraEntry({
        id: crypto.randomUUID(), valuation_id: valuation.id, workbook_extra_id: extraId,
        previous_pct: 0, current_pct, notes: '',
      });
    }
    onSaveDone();
  }, [extraEntries, store, valuation.id, onSaveStart, onSaveDone]);

  const handleExtraNotes = useCallback(async (extraId: string, notes: string) => {
    const existing = extraEntries.find(e => e.workbook_extra_id === extraId);
    if (existing) { onSaveStart(); await store.upsertValuationExtraEntry({ ...existing, notes }); onSaveDone(); }
  }, [extraEntries, store, onSaveStart, onSaveDone]);

  const handleUnlock = async () => {
    onSaveStart();
    await store.updateValuation({ ...valuation, status: 'draft' });
    onSaveDone();
  };

  const handleExportPdf = async () => {
    setPdfLoading(true);
    try {
      const lineData  = wbLines.map(l  => ({ line: l,  entry: getLineEntry(l.id) }));
      const extraData = wbExtras.map(e => ({ extra: e, entry: getExtraEntry(e.id) }));
      await buildValuationPdf(valuation, project, lineData, extraData, totals);
    } finally { setPdfLoading(false); }
  };

  const statusStyle = STATUS_STYLES[valuation.status as ValuationStatus] ?? STATUS_STYLES.draft;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft size={13} /> Valuations
          </button>
          <div className="w-px h-4 bg-[#1e2d4a]" />
          <span className="text-[10px] font-bold font-mono text-slate-500">{valuation.ref}</span>
          <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusStyle}`}>
            {isLocked && <Lock size={8} />}
            {valuation.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Save indicator */}
          {saveState !== 'idle' && (
            <span className={`text-[10px] font-medium transition-all ${saveState === 'saving' ? 'text-slate-400' : 'text-emerald-400'} flex items-center gap-1`}>
              {saveState === 'saving' ? (
                <><span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" /> Saving…</>
              ) : (
                <><CheckCircle size={10} /> Saved</>
              )}
            </span>
          )}
          {saveState === 'idle' && lastSaved && (
            <span className="text-[10px] text-slate-600">
              Saved {lastSaved.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {isLocked && canEdit && (
            <button onClick={handleUnlock}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
              style={{ background: '#111827', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Unlock size={11} /> Unlock
            </button>
          )}
          {effectiveCanEdit && (
            <button onClick={() => setShowEditHeader(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-colors"
              style={{ background: '#111827', border: '1px solid #1e2d4a' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#f97316')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2d4a')}>
              <Edit2 size={11} /> Edit Details
            </button>
          )}
          <button onClick={handleExportPdf} disabled={pdfLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50"
            style={{ background: '#f97316' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#ea6c0a')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}>
            <Download size={11} /> {pdfLoading ? 'Generating…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Locked banner */}
      {isLocked && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-4"
          style={{ background: 'rgba(71,85,105,0.12)', border: '1px solid rgba(71,85,105,0.25)' }}>
          <Lock size={13} className="text-slate-400 shrink-0" />
          <p className="text-xs text-slate-400">
            This valuation is <strong className="text-slate-300">locked</strong> and cannot be edited. It can still be viewed and exported as a PDF.
            {canEdit && <> Use the <strong className="text-amber-400">Unlock</strong> button to enable editing.</>}
          </p>
        </div>
      )}

      {/* Info strip */}
      <div className="rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-4" style={{ background: '#0a1020', border: '1px solid #1e2d4a' }}>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{valuation.title}</p>
          <p className="text-[10px] text-slate-500">{project.name}</p>
        </div>
        {valuation.valuation_date && (
          <div className="text-right">
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Date</p>
            <p className="text-xs text-slate-300">{fmtDate(valuation.valuation_date)}</p>
          </div>
        )}
        {valuation.period && (
          <div className="text-right">
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Period</p>
            <p className="text-xs text-slate-300">{valuation.period}</p>
          </div>
        )}
        {valuation.client && (
          <div className="text-right">
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Client</p>
            <p className="text-xs text-slate-300">{valuation.client}</p>
          </div>
        )}
        {valuation.contractor && (
          <div className="text-right">
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Contractor</p>
            <p className="text-xs text-slate-300">{valuation.contractor}</p>
          </div>
        )}
      </div>

      {/* Empty state */}
      {wbLines.length === 0 && wbExtras.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl mb-4"
          style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
          <FileText size={24} className="text-slate-700 mb-3" />
          <p className="text-sm font-semibold text-slate-400 mb-1">No contract lines in workbook</p>
          <p className="text-xs text-slate-600">Go back and set up the contract workbook first.</p>
        </div>
      )}

      {/* Contract Lines */}
      {wbLines.length > 0 && (
        <div className="mb-4">
          <SectionHeader title="Contract Works" count={wbLines.length} total={totals.contractCurrValue}
            expanded={linesExpanded} onToggle={() => setLinesExpanded(v => !v)} />
          {linesExpanded && (
            <div className="mt-1 rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d4a' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[860px]">
                  <thead>
                    <tr style={{ background: '#111827', borderBottom: '1px solid #1e2d4a' }}>
                      {[
                        ['#', 'w-10', ''], ['Description', '', ''], ['Sec', 'w-16', ''],
                        ['Unit', 'w-12', ''], ['Qty', 'w-12', 'text-right'], ['Rate', 'w-20', 'text-right'],
                        ['Contract Value', 'w-24', 'text-right'], ['Prev %', 'w-16', 'text-right'],
                        ['Prev Value', 'w-24', 'text-right'], ['Curr %', 'w-16', 'text-right'],
                        ['Curr Value', 'w-24', 'text-right'], ['This Val', 'w-24', 'text-right'],
                        ['Notes', 'w-28', ''],
                      ].map(([label, w, align]) => (
                        <th key={label} className={`px-2 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 ${w} ${align}`}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wbLines.map((l, idx) => {
                      const entry = getLineEntry(l.id);
                      const prevV = l.contract_value * entry.previous_pct / 100;
                      const currV = l.contract_value * entry.current_pct  / 100;
                      const thisV = currV - prevV;
                      return (
                        <tr key={l.id} style={{ borderBottom: '1px solid #1a2640' }} className={idx % 2 !== 0 ? 'bg-[#0a0f1a]' : ''}>
                          <td className="px-2 py-1.5 text-slate-600 font-mono">{l.item_number || idx + 1}</td>
                          <td className="px-2 py-1.5 text-slate-300">{l.description}</td>
                          <td className="px-2 py-1.5 text-slate-500">{l.section}</td>
                          <td className="px-2 py-1.5 text-slate-500">{l.unit}</td>
                          <td className="px-2 py-1.5 text-slate-400 text-right tabular-nums">{l.quantity != null ? l.quantity : ''}</td>
                          <td className="px-2 py-1.5 text-slate-400 text-right tabular-nums">{l.rate != null ? fmtCurrency(l.rate) : ''}</td>
                          <td className="px-2 py-1.5 text-slate-300 text-right tabular-nums font-medium">{fmtCurrency(l.contract_value)}</td>
                          <td className="px-2 py-1.5 text-slate-500 text-right tabular-nums">{entry.previous_pct.toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-slate-500 text-right tabular-nums">{fmtCurrency(prevV)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <PctInput value={entry.current_pct} disabled={!effectiveCanEdit} onCommit={v => handleLinePct(l.id, v)} />
                          </td>
                          <td className="px-2 py-1.5 text-white text-right tabular-nums font-medium">{fmtCurrency(currV)}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${thisV >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCurrency(thisV)}</td>
                          <td className="px-2 py-1.5">
                            {effectiveCanEdit
                              ? <NotesInput value={entry.notes} onCommit={v => handleLineNotes(l.id, v)} />
                              : <span className="text-slate-600 text-xs">{entry.notes}</span>}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: '#111827' }}>
                      <td colSpan={6} className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Subtotal</td>
                      <td className="px-2 py-2 text-right text-slate-300 font-bold">{fmtCurrency(totals.contractOriginal)}</td>
                      <td />
                      <td className="px-2 py-2 text-right text-slate-400 font-bold">{fmtCurrency(totals.contractPrevValue)}</td>
                      <td />
                      <td className="px-2 py-2 text-right text-white font-bold">{fmtCurrency(totals.contractCurrValue)}</td>
                      <td className="px-2 py-2 text-right text-emerald-400 font-bold">{fmtCurrency(totals.contractThisVal)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Extras */}
      {wbExtras.length > 0 && (
        <div className="mb-4">
          <SectionHeader title="Extras / Agreed Variations" count={wbExtras.length} total={totals.extrasCurrValue}
            expanded={extrasExpanded} onToggle={() => setExtrasExpanded(v => !v)} />
          {extrasExpanded && (
            <div className="mt-1 rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d4a' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[700px]">
                  <thead>
                    <tr style={{ background: '#111827', borderBottom: '1px solid #1e2d4a' }}>
                      {[['Ref', 'w-16', ''], ['Description', '', ''], ['Agreed Value', 'w-24', 'text-right'],
                        ['Prev %', 'w-16', 'text-right'], ['Prev Value', 'w-24', 'text-right'],
                        ['Curr %', 'w-16', 'text-right'], ['Curr Value', 'w-24', 'text-right'],
                        ['This Val', 'w-24', 'text-right'], ['Notes', 'w-28', '']
                      ].map(([label, w, align]) => (
                        <th key={label} className={`px-2 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 ${w} ${align}`}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wbExtras.map((ex, idx) => {
                      const entry = getExtraEntry(ex.id);
                      const prevV = ex.agreed_value * entry.previous_pct / 100;
                      const currV = ex.agreed_value * entry.current_pct  / 100;
                      const thisV = currV - prevV;
                      return (
                        <tr key={ex.id} style={{ borderBottom: '1px solid #1a2640' }} className={idx % 2 !== 0 ? 'bg-[#0a0f1a]' : ''}>
                          <td className="px-2 py-1.5 text-slate-500 font-mono">{ex.ref}</td>
                          <td className="px-2 py-1.5 text-slate-300">{ex.description}</td>
                          <td className="px-2 py-1.5 text-slate-300 text-right tabular-nums font-medium">{fmtCurrency(ex.agreed_value)}</td>
                          <td className="px-2 py-1.5 text-slate-500 text-right tabular-nums">{entry.previous_pct.toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-slate-500 text-right tabular-nums">{fmtCurrency(prevV)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <PctInput value={entry.current_pct} disabled={!effectiveCanEdit} onCommit={v => handleExtraPct(ex.id, v)} />
                          </td>
                          <td className="px-2 py-1.5 text-white text-right tabular-nums font-medium">{fmtCurrency(currV)}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${thisV >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCurrency(thisV)}</td>
                          <td className="px-2 py-1.5">
                            {effectiveCanEdit
                              ? <NotesInput value={entry.notes} onCommit={v => handleExtraNotes(ex.id, v)} />
                              : <span className="text-slate-600 text-xs">{entry.notes}</span>}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: '#111827' }}>
                      <td colSpan={2} className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Subtotal</td>
                      <td className="px-2 py-2 text-right text-slate-300 font-bold">{fmtCurrency(totals.extrasOriginal)}</td>
                      <td />
                      <td className="px-2 py-2 text-right text-slate-400 font-bold">{fmtCurrency(totals.extrasPrevValue)}</td>
                      <td />
                      <td className="px-2 py-2 text-right text-white font-bold">{fmtCurrency(totals.extrasCurrValue)}</td>
                      <td className="px-2 py-2 text-right text-emerald-400 font-bold">{fmtCurrency(totals.extrasThisVal)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary panel */}
      {(wbLines.length > 0 || wbExtras.length > 0) && (
        <div className="rounded-xl overflow-hidden mt-4" style={{ border: '1px solid #1e2d4a' }}>
          {[
            { label: 'Contract Works (Gross to Date)',  value: totals.contractCurrValue },
            { label: 'Extras / Agreed Variations',      value: totals.extrasCurrValue },
            { label: 'Gross Total to Date',             value: totals.grossToDate },
            { label: 'Less: Previous Valuation Total',  value: -totals.previousTotal },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: '1px solid #1e2d4a', background: i % 2 === 0 ? '#0d1628' : '#0a1020' }}>
              <span className="text-xs text-slate-400">{row.label}</span>
              <span className={`text-xs font-bold tabular-nums ${row.value < 0 ? 'text-red-400' : 'text-white'}`}>{fmtCurrency(row.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ background: 'rgba(16,185,129,0.08)', borderTop: '1px solid rgba(16,185,129,0.2)' }}>
            <span className="text-sm font-bold text-emerald-400">Amount Due This Valuation</span>
            <span className={`text-lg font-black tabular-nums ${totals.amountDue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtCurrency(totals.amountDue)}
            </span>
          </div>
        </div>
      )}

      {showEditHeader && (
        <EditHeaderModal
          valuation={valuation}
          onSave={async patch => { onSaveStart(); await store.updateValuation({ ...valuation, ...patch }); onSaveDone(); }}
          onClose={() => setShowEditHeader(false)}
        />
      )}
    </div>
  );
}
