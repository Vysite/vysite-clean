import { useState, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Save, Download, Upload, X, Check, ChevronDown, ChevronUp, AlertTriangle, CreditCard as Edit3, Send, CheckCircle2, Archive } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBValuation, DBValuationLine, DBValuationExtraLine } from '../../lib/store';
import type { Project } from '../../data/types';
import { buildValuationPdf } from './ValuationPDF';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  valuation: DBValuation;
  project: Project;
  orgId: string;
  canEdit: boolean;
  canDelete: boolean;
  currentUserName: string;
  onBack: () => void;
}

type ValuationStatus = 'draft' | 'submitted' | 'certified' | 'superseded';

const STATUSES: { key: ValuationStatus; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'draft',      label: 'Draft',      icon: Edit3 },
  { key: 'submitted',  label: 'Submitted',  icon: Send },
  { key: 'certified',  label: 'Certified',  icon: CheckCircle2 },
  { key: 'superseded', label: 'Superseded', icon: Archive },
];

function genId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function n(v: unknown): number {
  const parsed = parseFloat(String(v));
  return isNaN(parsed) ? 0 : parsed;
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

function parseCsv(text: string): string[][] {
  return text.trim().split('\n').map(row => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

function importCsvToLines(csv: string, valuationId: string, projectId: string): Omit<DBValuationLine, 'id' | 'org_id'>[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.toLowerCase().replace(/[\s_\-/]+/g, ''));
  const col = (names: string[]): number => {
    for (const nm of names) {
      const idx = header.findIndex(h => h.includes(nm));
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const iItem  = col(['item', 'ref', 'clause', 'no']);
  const iDesc  = col(['desc', 'name', 'title', 'work']);
  const iSec   = col(['section', 'trade', 'category', 'div']);
  const iUnit  = col(['unit', 'uom']);
  const iQty   = col(['qty', 'quantity', 'amount']);
  const iRate  = col(['rate', 'unitrate', 'price']);
  const iVal   = col(['value', 'total', 'contractvalue', 'lineval', 'sum']);

  return rows.slice(1).filter(r => r.some(c => c)).map((row, idx) => {
    const qty  = iQty  >= 0 ? n(row[iQty])  : 0;
    const rate = iRate >= 0 ? n(row[iRate]) : 0;
    let contractValue = iVal >= 0 ? n(row[iVal]) : 0;
    if (contractValue === 0 && qty > 0 && rate > 0) contractValue = qty * rate;
    return {
      valuation_id: valuationId,
      project_id: projectId,
      item_number:    iItem >= 0 ? row[iItem] ?? '' : '',
      description:    iDesc >= 0 ? row[iDesc] ?? '' : (row[0] ?? ''),
      section:        iSec  >= 0 ? row[iSec]  ?? '' : '',
      unit:           iUnit >= 0 ? row[iUnit] ?? '' : '',
      quantity:       qty,
      rate:           rate,
      contract_value: contractValue,
      previous_pct:   0,
      current_pct:    0,
      notes:          '',
      sort_order:     idx,
    };
  }).filter(l => l.description);
}

// ─── Editable Number Cell ─────────────────────────────────────────────────────

function NumCell({ value, onChange, className = '', placeholder = '0' }: { value: number; onChange: (v: number) => void; className?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  return editing ? (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onChange(n(draft)); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') { onChange(n(draft)); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
      className={`w-full bg-[#0d1628] border border-[#f97316] rounded px-1.5 py-0.5 text-right text-xs text-white focus:outline-none ${className}`}
      placeholder={placeholder}
    />
  ) : (
    <button
      onClick={() => { setDraft(value === 0 ? '' : String(value)); setEditing(true); }}
      className={`w-full text-right text-xs px-1.5 py-0.5 rounded hover:bg-[#1a2640] transition-colors ${className}`}
    >
      {value === 0 ? <span className="text-slate-700">{placeholder}</span> : value.toLocaleString('en-GB')}
    </button>
  );
}

function TextCell({ value, onChange, placeholder = '' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  return editing ? (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onChange(draft); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') { onChange(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
      className="w-full bg-[#0d1628] border border-[#f97316] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
      placeholder={placeholder}
    />
  ) : (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="w-full text-left text-xs px-1.5 py-0.5 rounded hover:bg-[#1a2640] transition-colors truncate"
    >
      {value || <span className="text-slate-700">{placeholder}</span>}
    </button>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, expanded, onToggle, right }: { title: string; count: number; expanded: boolean; onToggle: () => void; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1e2d4a] mb-0">
      <button onClick={onToggle} className="flex items-center gap-2 text-left group">
        {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
        <span className="text-sm font-bold text-white">{title}</span>
        <span className="text-[10px] text-slate-500 bg-[#111827] px-1.5 py-0.5 rounded-full border border-[#1e2d4a]">{count}</span>
      </button>
      {right}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ValuationDetail({ valuation, project, orgId, canEdit, currentUserName, onBack }: Props) {
  const store = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingHeader, setEditingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState<Partial<DBValuation>>({});
  const [linesExpanded, setLinesExpanded] = useState(true);
  const [extrasExpanded, setExtrasExpanded] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const lines = useMemo(() =>
    store.valuationLines
      .filter(l => l.valuation_id === valuation.id)
      .sort((a, b) => a.sort_order - b.sort_order),
    [store.valuationLines, valuation.id]
  );

  const extras = useMemo(() =>
    store.valuationExtraLines
      .filter(l => l.valuation_id === valuation.id)
      .sort((a, b) => a.sort_order - b.sort_order),
    [store.valuationExtraLines, valuation.id]
  );

  // ── Totals ───────────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const contractOriginal  = lines.reduce((s, l) => s + l.contract_value, 0);
    const contractPrevValue = lines.reduce((s, l) => s + l.contract_value * l.previous_pct / 100, 0);
    const contractCurrValue = lines.reduce((s, l) => s + l.contract_value * l.current_pct  / 100, 0);
    const contractThisVal   = contractCurrValue - contractPrevValue;

    const extrasOriginal  = extras.reduce((s, e) => s + e.agreed_value, 0);
    const extrasPrevValue = extras.reduce((s, e) => s + e.agreed_value * e.previous_pct / 100, 0);
    const extrasCurrValue = extras.reduce((s, e) => s + e.agreed_value * e.current_pct  / 100, 0);
    const extrasThisVal   = extrasCurrValue - extrasPrevValue;

    const grossToDate   = contractCurrValue + extrasCurrValue;
    const previousTotal = contractPrevValue + extrasPrevValue;
    const amountDue     = grossToDate - previousTotal;

    return {
      contractOriginal, contractPrevValue, contractCurrValue, contractThisVal,
      extrasOriginal, extrasPrevValue, extrasCurrValue, extrasThisVal,
      grossToDate, previousTotal, amountDue,
    };
  }, [lines, extras]);

  // ── Line edit helpers ────────────────────────────────────────────────────────

  const updateLine = useCallback((updated: DBValuationLine) => {
    store.updateValuationLine(updated);
  }, [store]);

  const removeLine = useCallback((id: string) => {
    store.removeValuationLine(id);
  }, [store]);

  const addLine = useCallback(() => {
    const newLine: DBValuationLine = {
      id: genId(),
      valuation_id: valuation.id,
      project_id: valuation.project_id,
      item_number: '',
      description: '',
      section: '',
      unit: '',
      quantity: 0,
      rate: 0,
      contract_value: 0,
      previous_pct: 0,
      current_pct: 0,
      notes: '',
      sort_order: lines.length,
    };
    store.addValuationLine(newLine);
  }, [store, valuation, lines.length]);

  const updateExtra = useCallback((updated: DBValuationExtraLine) => {
    store.updateValuationExtraLine(updated);
  }, [store]);

  const removeExtra = useCallback((id: string) => {
    store.removeValuationExtraLine(id);
  }, [store]);

  const addExtra = useCallback(() => {
    const newExtra: DBValuationExtraLine = {
      id: genId(),
      valuation_id: valuation.id,
      project_id: valuation.project_id,
      ref: '',
      description: '',
      agreed_value: 0,
      previous_pct: 0,
      current_pct: 0,
      notes: '',
      sort_order: extras.length,
    };
    store.addValuationExtraLine(newExtra);
  }, [store, valuation, extras.length]);

  // ── Header edit ──────────────────────────────────────────────────────────────

  const startEditHeader = () => {
    setHeaderDraft({ ...valuation });
    setEditingHeader(true);
  };

  const saveHeader = async () => {
    await store.updateValuation({ ...valuation, ...headerDraft });
    setEditingHeader(false);
  };

  // ── CSV import ───────────────────────────────────────────────────────────────

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const imported = importCsvToLines(text, valuation.id, valuation.project_id);
        if (imported.length === 0) {
          setImportError('No valid rows found. Check the file has a header row and Description column.');
          setImporting(false);
          return;
        }
        const baseOrder = lines.length;
        for (const [i, l] of imported.entries()) {
          await store.addValuationLine({ ...l, id: genId(), sort_order: baseOrder + i });
        }
        setImporting(false);
      } catch {
        setImportError('Could not parse file. Please use CSV format.');
        setImporting(false);
      }
      if (e.target) e.target.value = '';
    };
    reader.readAsText(file);
  };

  // ── PDF export ───────────────────────────────────────────────────────────────

  const handleExportPdf = async () => {
    setExporting(true);
    setExportError('');
    try {
      const bytes = await buildValuationPdf(valuation, project, lines, extras, {
        companyName: store.settings?.company_name || '',
        logoDataUrl: store.settings?.logo_data_url,
      });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${valuation.ref} — ${valuation.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    }
    setExporting(false);
  };

  const StatusIcon = STATUSES.find(s => s.key === valuation.status)?.icon ?? Edit3;

  return (
    <div>
      {/* Back + Header */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-[#1a2640] rounded-lg transition-colors shrink-0 mt-0.5"
          >
            <ArrowLeft size={15} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold font-mono text-slate-500">{valuation.ref}</span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-slate-700/30 text-slate-400 border-slate-600/40">
                <StatusIcon size={8} />
                {STATUSES.find(s => s.key === valuation.status)?.label ?? valuation.status}
              </span>
            </div>
            <h2 className="text-lg font-black text-white leading-tight truncate">{valuation.title}</h2>
            {(valuation.valuation_date || valuation.period) && (
              <p className="text-xs text-slate-500 mt-0.5">
                {valuation.valuation_date && new Date(valuation.valuation_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                {valuation.period && ` · ${valuation.period}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <button
              onClick={startEditHeader}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={{ background: '#111827', color: '#94a3b8', border: '1px solid #1e2d4a' }}
            >
              <Edit3 size={11} /> Edit Details
            </button>
          )}
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50"
            style={{ background: '#f97316' }}
            onMouseEnter={e => !exporting && (e.currentTarget.style.background = '#ea6c0a')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}
          >
            <Download size={11} />
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4 text-xs text-red-400">
          <AlertTriangle size={12} className="shrink-0" />
          {exportError}
        </div>
      )}

      {/* Totals panel */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Contract Value',    value: totals.contractOriginal,  sub: `+ ${fmtCurrency(totals.extrasOriginal)} extras` },
          { label: 'Gross to Date',     value: totals.grossToDate,       sub: 'Contract + Extras' },
          { label: 'Previously Claimed',value: totals.previousTotal,     sub: ' ' },
          { label: 'Amount Due',        value: totals.amountDue,         sub: 'This Valuation', highlight: true },
          { label: 'Extras Total',      value: totals.extrasOriginal,    sub: `${fmtPct(totals.extrasOriginal > 0 ? totals.extrasCurrValue / totals.extrasOriginal * 100 : 0)} complete` },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1">{label}</p>
            <p className={`text-base font-black ${highlight && value !== 0 ? 'text-emerald-400' : 'text-white'}`}>
              {fmtCurrency(value)}
            </p>
            <p className="text-[9px] text-slate-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Contract lines section */}
      <div className="bg-[#0a1220] border border-[#1e2d4a] rounded-xl mb-4 overflow-hidden">
        <div className="px-4 pt-4">
          <SectionHeader
            title="Contract Works"
            count={lines.length}
            expanded={linesExpanded}
            onToggle={() => setLinesExpanded(v => !v)}
            right={
              canEdit && (
                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileImport} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                    style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}
                    title="Import CSV"
                  >
                    <Upload size={10} /> {importing ? 'Importing…' : 'Import CSV'}
                  </button>
                  <button
                    onClick={addLine}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white transition-colors"
                    style={{ background: '#f97316' }}
                  >
                    <Plus size={10} /> Add Line
                  </button>
                </div>
              )
            }
          />
        </div>

        {importError && (
          <div className="mx-4 mt-2 flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] text-amber-400">
            <AlertTriangle size={10} /> {importError}
          </div>
        )}

        {linesExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2d4a', background: '#0d1628' }}>
                  {['#', 'Description', 'Section', 'Unit', 'Qty', 'Rate', 'Contract Value', 'Prev %', 'Prev Value', 'Curr %', 'Curr Value', 'This Val', 'Notes', ''].map(h => (
                    <th key={h} className="px-2 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-600 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const prevVal = line.contract_value * line.previous_pct / 100;
                  const currVal = line.contract_value * line.current_pct  / 100;
                  const thisVal = currVal - prevVal;
                  return (
                    <tr key={line.id} className="border-b border-[#0f1a2e] hover:bg-[#0d1628] transition-colors group">
                      <td className="px-2 py-1.5 text-[10px] font-mono text-slate-600 w-8">{idx + 1}</td>
                      <td className="px-2 py-1.5 w-52">
                        {canEdit ? (
                          <TextCell value={line.description} onChange={v => updateLine({ ...line, description: v })} placeholder="Description…" />
                        ) : (
                          <span className="text-xs text-slate-200">{line.description}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-28">
                        {canEdit ? (
                          <TextCell value={line.section} onChange={v => updateLine({ ...line, section: v })} placeholder="Section" />
                        ) : (
                          <span className="text-xs text-slate-400">{line.section}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-14">
                        {canEdit ? (
                          <TextCell value={line.unit} onChange={v => updateLine({ ...line, unit: v })} placeholder="unit" />
                        ) : (
                          <span className="text-xs text-slate-400">{line.unit}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-16">
                        {canEdit ? (
                          <NumCell value={line.quantity} onChange={v => updateLine({ ...line, quantity: v, contract_value: v * line.rate })} />
                        ) : (
                          <span className="text-xs text-slate-400 text-right block">{line.quantity}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-20">
                        {canEdit ? (
                          <NumCell value={line.rate} onChange={v => updateLine({ ...line, rate: v, contract_value: line.quantity * v })} />
                        ) : (
                          <span className="text-xs text-slate-400 text-right block">{line.rate}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-28">
                        {canEdit ? (
                          <NumCell value={line.contract_value} onChange={v => updateLine({ ...line, contract_value: v })} />
                        ) : (
                          <span className="text-xs text-slate-200 text-right block font-medium">{fmtCurrency(line.contract_value)}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-16">
                        {canEdit ? (
                          <NumCell value={line.previous_pct} onChange={v => updateLine({ ...line, previous_pct: Math.min(100, Math.max(0, v)) })} placeholder="0" />
                        ) : (
                          <span className="text-xs text-slate-500 text-right block">{fmtPct(line.previous_pct)}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-28 text-right">
                        <span className="text-xs text-slate-500">{fmtCurrency(prevVal)}</span>
                      </td>
                      <td className="px-2 py-1.5 w-16">
                        {canEdit ? (
                          <NumCell value={line.current_pct} onChange={v => updateLine({ ...line, current_pct: Math.min(100, Math.max(0, v)) })} placeholder="0" />
                        ) : (
                          <span className="text-xs text-slate-300 text-right block font-medium">{fmtPct(line.current_pct)}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-28 text-right">
                        <span className="text-xs text-slate-200 font-medium">{fmtCurrency(currVal)}</span>
                      </td>
                      <td className="px-2 py-1.5 w-28 text-right">
                        <span className={`text-xs font-bold ${thisVal > 0 ? 'text-emerald-400' : thisVal < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                          {fmtCurrency(thisVal)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 w-36">
                        {canEdit ? (
                          <TextCell value={line.notes} onChange={v => updateLine({ ...line, notes: v })} placeholder="Note…" />
                        ) : (
                          <span className="text-xs text-slate-500">{line.notes}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-8">
                        {canEdit && (
                          <button
                            onClick={() => removeLine(line.id)}
                            className="p-1 text-slate-700 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {lines.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid #1e2d4a', background: '#0d1628' }}>
                    <td colSpan={6} className="px-2 py-2 text-xs font-bold text-slate-400">Subtotal — Contract Works</td>
                    <td className="px-2 py-2 text-xs font-bold text-white text-right">{fmtCurrency(totals.contractOriginal)}</td>
                    <td />
                    <td className="px-2 py-2 text-xs text-slate-500 text-right">{fmtCurrency(totals.contractPrevValue)}</td>
                    <td />
                    <td className="px-2 py-2 text-xs font-bold text-white text-right">{fmtCurrency(totals.contractCurrValue)}</td>
                    <td className="px-2 py-2 text-xs font-bold text-emerald-400 text-right">{fmtCurrency(totals.contractThisVal)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
            {lines.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-xs text-slate-600">No contract lines added yet.</p>
                {canEdit && (
                  <p className="text-[10px] text-slate-700 mt-1">Use "Add Line" to enter manually, or "Import CSV" to upload a spreadsheet.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extras / Agreed Variations */}
      <div className="bg-[#0a1220] border border-[#1e2d4a] rounded-xl mb-6 overflow-hidden">
        <div className="px-4 pt-4">
          <SectionHeader
            title="Extras / Agreed Variations"
            count={extras.length}
            expanded={extrasExpanded}
            onToggle={() => setExtrasExpanded(v => !v)}
            right={
              canEdit && (
                <button
                  onClick={addExtra}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white transition-colors"
                  style={{ background: '#f97316' }}
                >
                  <Plus size={10} /> Add Extra
                </button>
              )
            }
          />
        </div>
        {extrasExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2d4a', background: '#0d1628' }}>
                  {['Ref', 'Description', 'Agreed Value', 'Prev %', 'Prev Value', 'Curr %', 'Curr Value', 'This Val', 'Notes', ''].map(h => (
                    <th key={h} className="px-2 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-600 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {extras.map(extra => {
                  const prevVal = extra.agreed_value * extra.previous_pct / 100;
                  const currVal = extra.agreed_value * extra.current_pct  / 100;
                  const thisVal = currVal - prevVal;
                  return (
                    <tr key={extra.id} className="border-b border-[#0f1a2e] hover:bg-[#0d1628] transition-colors group">
                      <td className="px-2 py-1.5 w-20">
                        {canEdit ? (
                          <TextCell value={extra.ref} onChange={v => updateExtra({ ...extra, ref: v })} placeholder="EV-01" />
                        ) : (
                          <span className="text-xs font-mono text-slate-400">{extra.ref}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-56">
                        {canEdit ? (
                          <TextCell value={extra.description} onChange={v => updateExtra({ ...extra, description: v })} placeholder="Description…" />
                        ) : (
                          <span className="text-xs text-slate-200">{extra.description}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-28">
                        {canEdit ? (
                          <NumCell value={extra.agreed_value} onChange={v => updateExtra({ ...extra, agreed_value: v })} />
                        ) : (
                          <span className="text-xs text-slate-200 text-right block">{fmtCurrency(extra.agreed_value)}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-16">
                        {canEdit ? (
                          <NumCell value={extra.previous_pct} onChange={v => updateExtra({ ...extra, previous_pct: Math.min(100, Math.max(0, v)) })} />
                        ) : (
                          <span className="text-xs text-slate-500 text-right block">{fmtPct(extra.previous_pct)}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-28 text-right">
                        <span className="text-xs text-slate-500">{fmtCurrency(prevVal)}</span>
                      </td>
                      <td className="px-2 py-1.5 w-16">
                        {canEdit ? (
                          <NumCell value={extra.current_pct} onChange={v => updateExtra({ ...extra, current_pct: Math.min(100, Math.max(0, v)) })} />
                        ) : (
                          <span className="text-xs text-slate-300 text-right block font-medium">{fmtPct(extra.current_pct)}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-28 text-right">
                        <span className="text-xs text-slate-200 font-medium">{fmtCurrency(currVal)}</span>
                      </td>
                      <td className="px-2 py-1.5 w-28 text-right">
                        <span className={`text-xs font-bold ${thisVal > 0 ? 'text-emerald-400' : thisVal < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                          {fmtCurrency(thisVal)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 w-36">
                        {canEdit ? (
                          <TextCell value={extra.notes} onChange={v => updateExtra({ ...extra, notes: v })} placeholder="Note…" />
                        ) : (
                          <span className="text-xs text-slate-500">{extra.notes}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 w-8">
                        {canEdit && (
                          <button
                            onClick={() => removeExtra(extra.id)}
                            className="p-1 text-slate-700 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {extras.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid #1e2d4a', background: '#0d1628' }}>
                    <td colSpan={2} className="px-2 py-2 text-xs font-bold text-slate-400">Subtotal — Extras</td>
                    <td className="px-2 py-2 text-xs font-bold text-white text-right">{fmtCurrency(totals.extrasOriginal)}</td>
                    <td />
                    <td className="px-2 py-2 text-xs text-slate-500 text-right">{fmtCurrency(totals.extrasPrevValue)}</td>
                    <td />
                    <td className="px-2 py-2 text-xs font-bold text-white text-right">{fmtCurrency(totals.extrasCurrValue)}</td>
                    <td className="px-2 py-2 text-xs font-bold text-emerald-400 text-right">{fmtCurrency(totals.extrasThisVal)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
            {extras.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-xs text-slate-600">No extras added yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary totals */}
      <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1e2d4a' }}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valuation Summary</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {[
            { label: 'Original Contract Works',      value: totals.contractOriginal, bold: false },
            { label: 'Extras / Agreed Variations',   value: totals.extrasOriginal,   bold: false },
          ].map(({ label, value, bold }) => (
            <div key={label} className="flex items-center justify-between">
              <span className={`text-sm ${bold ? 'font-bold text-white' : 'text-slate-400'}`}>{label}</span>
              <span className={`text-sm ${bold ? 'font-bold text-white' : 'text-slate-400'}`}>{fmtCurrency(value)}</span>
            </div>
          ))}
          <div className="pt-2" style={{ borderTop: '1px solid #1e2d4a' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Gross Valuation to Date</span>
              <span className="text-sm font-bold text-white">{fmtCurrency(totals.grossToDate)}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">Less: Previous Valuation Total</span>
              <span className="text-sm text-slate-400">({fmtCurrency(totals.previousTotal)})</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="text-sm font-bold text-emerald-300">Amount Due This Valuation</span>
              <span className="text-xl font-black text-emerald-400">{fmtCurrency(totals.amountDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Header edit modal */}
      {editingHeader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e2d4a' }}>
              <p className="text-sm font-bold text-white">Edit Valuation Details</p>
              <button onClick={() => setEditingHeader(false)} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"><X size={14} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Title</label>
                <input value={headerDraft.title ?? ''} onChange={e => setHeaderDraft(d => ({ ...d, title: e.target.value }))}
                  className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
                  <select value={headerDraft.status ?? 'draft'} onChange={e => setHeaderDraft(d => ({ ...d, status: e.target.value }))}
                    className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors">
                    {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Valuation Date</label>
                  <input type="date" value={headerDraft.valuation_date ?? ''} onChange={e => setHeaderDraft(d => ({ ...d, valuation_date: e.target.value }))}
                    className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Period</label>
                  <input value={headerDraft.period ?? ''} onChange={e => setHeaderDraft(d => ({ ...d, period: e.target.value }))}
                    className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Client</label>
                  <input value={headerDraft.client ?? ''} onChange={e => setHeaderDraft(d => ({ ...d, client: e.target.value }))}
                    className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Contractor</label>
                <input value={headerDraft.contractor ?? ''} onChange={e => setHeaderDraft(d => ({ ...d, contractor: e.target.value }))}
                  className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Notes</label>
                <textarea value={headerDraft.notes ?? ''} onChange={e => setHeaderDraft(d => ({ ...d, notes: e.target.value }))} rows={2}
                  className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] resize-none transition-colors" />
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-5">
              <button onClick={() => setEditingHeader(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold" style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}>Cancel</button>
              <button onClick={saveHeader} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: '#f97316' }}>
                <Save size={11} className="inline mr-1.5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
