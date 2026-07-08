import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ArrowLeft, Upload, Plus, Trash2, X, Check, ChevronDown, BookOpen, AlertCircle, Pencil, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBValuationWorkbook, DBWorkbookLine, DBWorkbookExtra } from '../../lib/store';
import type { Project } from '../../data/types';
import { logActivity } from '../../lib/activityLog';

type SaveState = 'idle' | 'saving' | 'saved';

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  workbook: DBValuationWorkbook;
  project: Project;
  orgId: string;
  canEdit: boolean;
  onBack: () => void;
}

type ImportTab = 'contract' | 'extras';

interface ParsedLine {
  item_number: string;
  description: string;
  section: string;
  unit: string;
  quantity: number | null;
  rate: number | null;
  contract_value: number;
}

interface ParsedExtra {
  ref: string;
  description: string;
  agreed_value: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(n);
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/[£,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[£,\s]/g, ''));
  return isNaN(n) ? null : n;
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

// Detect which column in the header row maps to each field
function detectColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const patterns: Record<string, RegExp> = {
    item_number:    /^(item[\s_-]?(no?\.?|number|ref)|#|no\.?)$/i,
    description:    /^(desc(ription)?|item[\s_-]?desc|name|work item)$/i,
    section:        /^(section|trade|category|group)$/i,
    unit:           /^(unit|uom|u\/m)$/i,
    quantity:       /^(qty|quantity|no\.|amount)$/i,
    rate:           /^(rate|unit[\s_-]?rate|price|£\/unit|cost)$/i,
    contract_value: /^(contract[\s_-]?(value|amount|sum)|total|amount|value|sum|£)$/i,
    ref:            /^(ref|reference|extra[\s_-]?ref|var[\s_-]?ref|no\.?)$/i,
    agreed_value:   /^(agreed[\s_-]?(value|amount)|variation[\s_-]?(value|amount)|value|amount|£)$/i,
  };
  headers.forEach((h, i) => {
    const clean = h.trim().replace(/[\s_-]+/g, ' ');
    for (const [field, re] of Object.entries(patterns)) {
      if (re.test(clean) && !(field in map)) map[field] = i;
    }
  });
  return map;
}

function sheetToRows(file: File): Promise<unknown[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        resolve(rows as unknown[][]);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

interface ImportModalProps {
  tab: ImportTab;
  workbookId: string;
  orgId: string;
  onImportLines: (lines: DBWorkbookLine[]) => void;
  onImportExtras: (extras: DBWorkbookExtra[]) => void;
  onClose: () => void;
}

function ImportModal({ tab, workbookId, orgId, onImportLines, onImportExtras, onClose }: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>(tab);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<ParsedLine[] | ParsedExtra[] | null>(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError('');
    setPreview(null);
    setFileName(file.name);
    try {
      const rows = await sheetToRows(file);
      if (rows.length < 2) { setError('File appears to be empty.'); return; }
      const headers = (rows[0] as unknown[]).map(h => str(h));
      const colMap = detectColumns(headers);
      const dataRows = rows.slice(1).filter(r => (r as unknown[]).some(c => String(c ?? '').trim() !== ''));

      if (activeTab === 'contract') {
        const parsed: ParsedLine[] = dataRows.map(r => {
          const row = r as unknown[];
          const qty  = colMap.quantity !== undefined ? parseNumOrNull(row[colMap.quantity]) : null;
          const rate = colMap.rate !== undefined ? parseNumOrNull(row[colMap.rate]) : null;
          let cv = colMap.contract_value !== undefined ? parseNum(row[colMap.contract_value]) : 0;
          if (cv === 0 && qty !== null && rate !== null) cv = qty * rate;
          return {
            item_number:    colMap.item_number !== undefined ? str(row[colMap.item_number]) : '',
            description:    colMap.description !== undefined ? str(row[colMap.description]) : str(row[1]),
            section:        colMap.section !== undefined ? str(row[colMap.section]) : '',
            unit:           colMap.unit !== undefined ? str(row[colMap.unit]) : '',
            quantity:       qty,
            rate:           rate,
            contract_value: cv,
          };
        }).filter(l => l.description || l.contract_value > 0);
        if (parsed.length === 0) { setError('No valid rows detected. Check your column headers.'); return; }
        setPreview(parsed);
      } else {
        const parsed: ParsedExtra[] = dataRows.map(r => {
          const row = r as unknown[];
          return {
            ref:          colMap.ref !== undefined ? str(row[colMap.ref]) : '',
            description:  colMap.description !== undefined ? str(row[colMap.description]) : str(row[0]),
            agreed_value: colMap.agreed_value !== undefined ? parseNum(row[colMap.agreed_value]) : parseNum(row[colMap.contract_value ?? 1]),
          };
        }).filter(e => e.description || e.agreed_value > 0);
        if (parsed.length === 0) { setError('No valid rows detected. Check your column headers.'); return; }
        setPreview(parsed);
      }
    } catch {
      setError('Could not parse file. Please check the format.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleConfirm = () => {
    if (!preview) return;
    if (activeTab === 'contract') {
      const lines: DBWorkbookLine[] = (preview as ParsedLine[]).map((l, i) => ({
        id: genId(), workbook_id: workbookId,
        item_number: l.item_number, description: l.description,
        section: l.section, unit: l.unit, quantity: l.quantity, rate: l.rate,
        contract_value: l.contract_value, sort_order: i,
      }));
      onImportLines(lines);
    } else {
      const extras: DBWorkbookExtra[] = (preview as ParsedExtra[]).map((e, i) => ({
        id: genId(), workbook_id: workbookId,
        ref: e.ref, description: e.description, agreed_value: e.agreed_value, sort_order: i,
      }));
      onImportExtras(extras);
    }
    onClose();
  };

  const contractPreview = activeTab === 'contract' ? preview as ParsedLine[] | null : null;
  const extrasPreview   = activeTab === 'extras'   ? preview as ParsedExtra[] | null : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-3xl mx-4 rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: '#0d1628', border: '1px solid #1e2d4a', maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #1e2d4a' }}>
          <p className="text-sm font-bold text-white">Import from Spreadsheet</p>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"><X size={14} /></button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 gap-2 shrink-0">
          {(['contract', 'extras'] as ImportTab[]).map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setPreview(null); setError(''); setFileName(''); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === t ? 'bg-[#f97316] text-white' : 'bg-[#111827] text-slate-400 hover:text-white border border-[#1e2d4a]'}`}>
              {t === 'contract' ? 'Contract Lines' : 'Extras / Variations'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Drop zone */}
          {!preview && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-10 cursor-pointer transition-colors"
              style={{ borderColor: dragOver ? '#f97316' : '#1e2d4a', background: dragOver ? 'rgba(249,115,22,0.05)' : '#111827' }}
            >
              <div className="w-10 h-10 rounded-xl bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center">
                <Upload size={18} className="text-slate-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-300">Drop file here or click to browse</p>
                <p className="text-xs text-slate-600 mt-0.5">Supports .xlsx, .xls, .csv</p>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            </div>
          )}

          {/* Column mapping hint */}
          {!preview && (
            <div className="rounded-lg p-3" style={{ background: '#111827', border: '1px solid #1e2d4a' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Expected column headers</p>
              {activeTab === 'contract' ? (
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Item No, Description, Section, Unit, Qty, Rate, Contract Value
                  — columns are auto-detected from header names, order doesn't matter.
                </p>
              ) : (
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Ref, Description, Agreed Value
                  — columns are auto-detected from header names.
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle size={13} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Preview */}
          {contractPreview && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-white">{contractPreview.length} lines from <span className="text-slate-400">{fileName}</span></p>
                <button onClick={() => { setPreview(null); setFileName(''); }} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d4a' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: '#111827', borderBottom: '1px solid #1e2d4a' }}>
                      {['#', 'Description', 'Section', 'Unit', 'Qty', 'Rate', 'Contract Value'].map(h => (
                        <th key={h} className="px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contractPreview.slice(0, 20).map((l, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1e2d4a' }} className="hover:bg-[#111827]/50">
                        <td className="px-2 py-1.5 text-slate-500 font-mono">{l.item_number || i + 1}</td>
                        <td className="px-2 py-1.5 text-slate-300 max-w-[200px] truncate">{l.description}</td>
                        <td className="px-2 py-1.5 text-slate-500">{l.section}</td>
                        <td className="px-2 py-1.5 text-slate-500">{l.unit}</td>
                        <td className="px-2 py-1.5 text-slate-400">{l.quantity ?? ''}</td>
                        <td className="px-2 py-1.5 text-slate-400">{l.rate != null ? fmtCurrency(l.rate) : ''}</td>
                        <td className="px-2 py-1.5 text-white font-semibold">{fmtCurrency(l.contract_value)}</td>
                      </tr>
                    ))}
                    {contractPreview.length > 20 && (
                      <tr>
                        <td colSpan={7} className="px-2 py-1.5 text-[10px] text-slate-600 text-center">
                          + {contractPreview.length - 20} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-600 mt-2">
                Total: {fmtCurrency(contractPreview.reduce((s, l) => s + l.contract_value, 0))}
              </p>
            </div>
          )}

          {extrasPreview && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-white">{extrasPreview.length} extras from <span className="text-slate-400">{fileName}</span></p>
                <button onClick={() => { setPreview(null); setFileName(''); }} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d4a' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: '#111827', borderBottom: '1px solid #1e2d4a' }}>
                      {['Ref', 'Description', 'Agreed Value'].map(h => (
                        <th key={h} className="px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extrasPreview.map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1e2d4a' }} className="hover:bg-[#111827]/50">
                        <td className="px-2 py-1.5 text-slate-500 font-mono">{e.ref}</td>
                        <td className="px-2 py-1.5 text-slate-300">{e.description}</td>
                        <td className="px-2 py-1.5 text-white font-semibold">{fmtCurrency(e.agreed_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-5 pt-3 shrink-0" style={{ borderTop: '1px solid #1e2d4a' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors"
            style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={!preview}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-40"
            style={{ background: '#f97316' }}>
            Import {preview ? `(${preview.length} rows)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline editable cell ─────────────────────────────────────────────────────

interface EditCellProps {
  value: string;
  numeric?: boolean;
  onCommit: (val: string) => void;
  className?: string;
}

function EditCell({ value, numeric, onCommit, className = '' }: EditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onCommit(draft); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Tab') { onCommit(draft); setEditing(false); e.preventDefault(); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className={`w-full bg-[#111827] border border-[#f97316] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none ${className}`}
        style={{ minWidth: 60 }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-pointer hover:text-white transition-colors block truncate ${className}`}
    >
      {value || <span className="text-slate-700 italic">—</span>}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ValuationWorkbookEditor({ workbook, project, orgId, canEdit, onBack }: Props) {
  const store = useAppStore();
  const currentUserName = store.currentUser?.name ?? '';
  const [tab, setTab] = useState<'lines' | 'extras'>('lines');
  const [showImport, setShowImport] = useState<ImportTab | null>(null);
  const [deleteLineId, setDeleteLineId] = useState<string | null>(null);
  const [deleteExtraId, setDeleteExtraId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(workbook.title);
  const { state: saveState, lastSaved, onSaveStart, onSaveDone } = useSaveIndicator();

  const lines  = useMemo(() => store.workbookLines.filter(l => l.workbook_id === workbook.id), [store.workbookLines, workbook.id]);
  const extras = useMemo(() => store.workbookExtras.filter(e => e.workbook_id === workbook.id), [store.workbookExtras, workbook.id]);

  const contractTotal = useMemo(() => lines.reduce((s, l) => s + l.contract_value, 0), [lines]);
  const extrasTotal   = useMemo(() => extras.reduce((s, e) => s + e.agreed_value, 0), [extras]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const wbLog = (actionType: Parameters<typeof logActivity>[0]['actionType'], description: string, extra?: Partial<Parameters<typeof logActivity>[0]>) => {
    logActivity({
      orgId, userName: currentUserName, module: 'valuations',
      recordId: workbook.id, recordRef: workbook.title, recordType: 'valuation_workbook',
      projectId: project.id, projectName: project.name,
      actionType, description, ...extra,
    });
  };

  const handleImportLines = async (newLines: DBWorkbookLine[]) => {
    await store.batchAddWorkbookLines(newLines);
    // For every existing valuation, create carry-forward entries for new lines
    const projectValuations = store.valuations.filter(v => v.project_id === project.id);
    for (const val of projectValuations) {
      const existing = store.valuationLineEntries.filter(e => e.valuation_id === val.id);
      const toAdd = newLines.filter(l => !existing.some(e => e.workbook_line_id === l.id));
      if (toAdd.length > 0) {
        const entries = toAdd.map(l => ({
          id: genId(), valuation_id: val.id, workbook_line_id: l.id,
          previous_pct: 0, current_pct: 0, notes: '',
        }));
        await store.batchUpsertValuationLineEntries(entries);
      }
    }
    wbLog('record_updated', `Contract schedule imported: ${newLines.length} line${newLines.length !== 1 ? 's' : ''} added to workbook "${workbook.title}"`);
  };

  const handleImportExtras = async (newExtras: DBWorkbookExtra[]) => {
    await store.batchAddWorkbookExtras(newExtras);
    const projectValuations = store.valuations.filter(v => v.project_id === project.id);
    for (const val of projectValuations) {
      const existing = store.valuationExtraEntries.filter(e => e.valuation_id === val.id);
      const toAdd = newExtras.filter(ex => !existing.some(e => e.workbook_extra_id === ex.id));
      if (toAdd.length > 0) {
        const entries = toAdd.map(ex => ({
          id: genId(), valuation_id: val.id, workbook_extra_id: ex.id,
          previous_pct: 0, current_pct: 0, notes: '',
        }));
        await store.batchUpsertValuationExtraEntries(entries);
      }
    }
    wbLog('record_updated', `Extras / variations imported: ${newExtras.length} item${newExtras.length !== 1 ? 's' : ''} added to workbook "${workbook.title}"`);
  };

  const handleAddLine = async () => {
    const line: DBWorkbookLine = {
      id: genId(), workbook_id: workbook.id, item_number: '', description: 'New item',
      section: '', unit: '', quantity: null, rate: null, contract_value: 0, sort_order: lines.length,
    };
    await store.addWorkbookLine(line);
    wbLog('record_updated', `Contract line added to workbook "${workbook.title}"`);
  };

  const handleAddExtra = async () => {
    const extra: DBWorkbookExtra = {
      id: genId(), workbook_id: workbook.id, ref: '', description: 'New extra',
      agreed_value: 0, sort_order: extras.length,
    };
    await store.addWorkbookExtra(extra);
    wbLog('record_updated', `Extra / variation added to workbook "${workbook.title}"`);
  };

  const patchLine = async (id: string, patch: Partial<DBWorkbookLine>) => {
    const line = lines.find(l => l.id === id);
    if (!line) return;
    onSaveStart();
    await store.updateWorkbookLine({ ...line, ...patch });
    onSaveDone();
    const changes: string[] = [];
    if (patch.description !== undefined && patch.description !== line.description)
      changes.push(`description: "${line.description}" → "${patch.description}"`);
    if (patch.contract_value !== undefined && patch.contract_value !== line.contract_value)
      changes.push(`value: ${fmtCurrency(line.contract_value)} → ${fmtCurrency(patch.contract_value)}`);
    if (patch.item_number !== undefined && patch.item_number !== line.item_number)
      changes.push(`item number: "${line.item_number}" → "${patch.item_number}"`);
    if (changes.length > 0) {
      wbLog('record_updated', `Contract line updated (${line.item_number || line.description}): ${changes.join('; ')}`);
    }
  };

  const patchExtra = async (id: string, patch: Partial<DBWorkbookExtra>) => {
    const extra = extras.find(e => e.id === id);
    if (!extra) return;
    onSaveStart();
    await store.updateWorkbookExtra({ ...extra, ...patch });
    onSaveDone();
    const changes: string[] = [];
    if (patch.description !== undefined && patch.description !== extra.description)
      changes.push(`description: "${extra.description}" → "${patch.description}"`);
    if (patch.agreed_value !== undefined && patch.agreed_value !== extra.agreed_value)
      changes.push(`value: ${fmtCurrency(extra.agreed_value)} → ${fmtCurrency(patch.agreed_value)}`);
    if (changes.length > 0) {
      wbLog('record_updated', `Extra updated (${extra.ref || extra.description}): ${changes.join('; ')}`);
    }
  };

  const saveTitle = async () => {
    const newTitle = titleDraft.trim();
    if (newTitle && newTitle !== workbook.title) {
      await store.updateValuationWorkbook({ ...workbook, title: newTitle });
      wbLog('record_updated', `Workbook renamed: "${workbook.title}" → "${newTitle}"`, { prevValue: workbook.title, newValue: newTitle });
    } else if (newTitle) {
      await store.updateValuationWorkbook({ ...workbook, title: newTitle });
    }
    setEditingTitle(false);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={13} /> Back
        </button>
        <div className="w-px h-4 bg-[#1e2d4a]" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
            <BookOpen size={11} className="text-[#f97316]" />
          </div>
          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="bg-[#111827] border border-[#f97316] rounded px-2 py-0.5 text-sm font-bold text-white focus:outline-none"
                autoFocus />
              <button onClick={saveTitle} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"><Check size={12} /></button>
              <button onClick={() => setEditingTitle(false)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors"><X size={12} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <span className="text-sm font-bold text-white">{workbook.title}</span>
              {canEdit && (
                <button onClick={() => { setTitleDraft(workbook.title); setEditingTitle(true); }}
                  className="p-0.5 text-slate-600 hover:text-slate-400 transition-colors opacity-0 group-hover:opacity-100">
                  <Pencil size={11} />
                </button>
              )}
            </div>
          )}
        </div>
        <span className="text-[10px] text-slate-600">{project.name}</span>
        </div>

        {/* Save indicator */}
        {saveState !== 'idle' && (
          <span className={`text-[10px] font-medium flex items-center gap-1 ${saveState === 'saving' ? 'text-slate-400' : 'text-emerald-400'}`}>
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
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl px-4 py-3" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-0.5">Contract Lines</p>
          <p className="text-xl font-black text-white">{lines.length}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-0.5">Contract Total</p>
          <p className="text-base font-black text-white">{fmtCurrency(contractTotal)}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-0.5">Extras Total</p>
          <p className="text-base font-black text-white">{fmtCurrency(extrasTotal)}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1.5">
          {(['lines', 'extras'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === t ? 'bg-[#f97316] text-white' : 'bg-[#0d1628] text-slate-400 hover:text-white border border-[#1e2d4a]'}`}>
              {t === 'lines' ? `Contract Lines (${lines.length})` : `Extras (${extras.length})`}
            </button>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(tab === 'lines' ? 'contract' : 'extras')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-colors"
              style={{ background: '#111827', border: '1px solid #1e2d4a' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#f97316')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2d4a')}
            >
              <Upload size={11} /> Import
            </button>
            <button
              onClick={tab === 'lines' ? handleAddLine : handleAddExtra}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
              style={{ background: '#f97316' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#ea6c0a')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}
            >
              <Plus size={11} /> Add Row
            </button>
          </div>
        )}
      </div>

      {/* Contract Lines table */}
      {tab === 'lines' && (
        lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
            <ChevronDown size={24} className="text-slate-700 mb-3" />
            <p className="text-sm font-semibold text-slate-400 mb-1">No contract lines yet</p>
            <p className="text-xs text-slate-600 mb-4">Import from a spreadsheet or add lines manually.</p>
            {canEdit && (
              <button onClick={() => setShowImport('contract')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: '#f97316' }}>
                <Upload size={12} /> Import Spreadsheet
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d4a' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#111827', borderBottom: '1px solid #1e2d4a' }}>
                  {['#', 'Description', 'Section', 'Unit', 'Qty', 'Rate', 'Contract Value', ''].map((h, i) => (
                    <th key={i} className={`px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500 ${i === 6 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #1e2d4a' }} className="group hover:bg-[#111827]/40">
                    <td className="px-2 py-2 text-slate-500 font-mono w-12">
                      <EditCell value={l.item_number} onCommit={v => patchLine(l.id, { item_number: v })} className="text-slate-500" />
                    </td>
                    <td className="px-2 py-2 text-slate-300 max-w-[220px]">
                      <EditCell value={l.description} onCommit={v => patchLine(l.id, { description: v })} className="text-slate-300" />
                    </td>
                    <td className="px-2 py-2 text-slate-500 w-24">
                      <EditCell value={l.section ?? ''} onCommit={v => patchLine(l.id, { section: v })} className="text-slate-500" />
                    </td>
                    <td className="px-2 py-2 text-slate-500 w-16">
                      <EditCell value={l.unit ?? ''} onCommit={v => patchLine(l.id, { unit: v })} className="text-slate-500" />
                    </td>
                    <td className="px-2 py-2 text-slate-400 w-16">
                      <EditCell value={l.quantity != null ? String(l.quantity) : ''} numeric onCommit={v => patchLine(l.id, { quantity: v === '' ? null : parseFloat(v) || null })} className="text-slate-400" />
                    </td>
                    <td className="px-2 py-2 text-slate-400 w-20">
                      <EditCell value={l.rate != null ? String(l.rate) : ''} numeric onCommit={v => patchLine(l.id, { rate: v === '' ? null : parseFloat(v) || null })} className="text-slate-400" />
                    </td>
                    <td className="px-2 py-2 text-white font-semibold text-right w-28">
                      <EditCell value={String(l.contract_value)} numeric onCommit={v => patchLine(l.id, { contract_value: parseFloat(v) || 0 })} className="text-white font-semibold text-right" />
                    </td>
                    <td className="px-2 py-2 w-8">
                      {canEdit && (
                        <button onClick={() => setDeleteLineId(l.id)}
                          className="p-1 text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 rounded">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: '#111827' }}>
                  <td colSpan={6} className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Total</td>
                  <td className="px-2 py-2 text-right font-black text-white text-sm">{fmtCurrency(contractTotal)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Extras table */}
      {tab === 'extras' && (
        extras.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
            <Plus size={24} className="text-slate-700 mb-3" />
            <p className="text-sm font-semibold text-slate-400 mb-1">No extras yet</p>
            <p className="text-xs text-slate-600 mb-4">Add agreed variations and extras to this workbook.</p>
            {canEdit && (
              <button onClick={handleAddExtra} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: '#f97316' }}>
                <Plus size={12} /> Add Extra
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d4a' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#111827', borderBottom: '1px solid #1e2d4a' }}>
                  {['Ref', 'Description', 'Agreed Value', ''].map((h, i) => (
                    <th key={i} className={`px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500 ${i === 2 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {extras.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #1e2d4a' }} className="group hover:bg-[#111827]/40">
                    <td className="px-2 py-2 text-slate-500 font-mono w-20">
                      <EditCell value={e.ref ?? ''} onCommit={v => patchExtra(e.id, { ref: v })} className="text-slate-500" />
                    </td>
                    <td className="px-2 py-2 text-slate-300">
                      <EditCell value={e.description} onCommit={v => patchExtra(e.id, { description: v })} className="text-slate-300" />
                    </td>
                    <td className="px-2 py-2 text-white font-semibold text-right w-28">
                      <EditCell value={String(e.agreed_value)} numeric onCommit={v => patchExtra(e.id, { agreed_value: parseFloat(v) || 0 })} className="text-white font-semibold text-right" />
                    </td>
                    <td className="px-2 py-2 w-8">
                      {canEdit && (
                        <button onClick={() => setDeleteExtraId(e.id)}
                          className="p-1 text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 rounded">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#111827' }}>
                  <td colSpan={2} className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Total</td>
                  <td className="px-2 py-2 text-right font-black text-white text-sm">{fmtCurrency(extrasTotal)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Import modal */}
      {showImport && (
        <ImportModal
          tab={showImport}
          workbookId={workbook.id}
          orgId={orgId}
          onImportLines={handleImportLines}
          onImportExtras={handleImportExtras}
          onClose={() => setShowImport(null)}
        />
      )}

      {/* Delete line confirm */}
      {deleteLineId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl p-6" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
            <p className="text-sm font-bold text-white mb-1">Delete contract line?</p>
            <p className="text-xs text-slate-500 mb-4">This will remove the line from the workbook and all valuation entries for it.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteLineId(null)} className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
                style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}>Cancel</button>
              <button onClick={async () => {
                const line = lines.find(l => l.id === deleteLineId);
                await store.removeWorkbookLine(deleteLineId);
                if (line) wbLog('record_deleted', `Contract line deleted from workbook "${workbook.title}": ${line.item_number ? `[${line.item_number}] ` : ''}${line.description}`);
                setDeleteLineId(null);
              }}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete extra confirm */}
      {deleteExtraId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl p-6" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
            <p className="text-sm font-bold text-white mb-1">Delete extra?</p>
            <p className="text-xs text-slate-500 mb-4">This will remove the extra from the workbook and all valuation entries for it.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteExtraId(null)} className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
                style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}>Cancel</button>
              <button onClick={async () => {
                const extra = extras.find(e => e.id === deleteExtraId);
                await store.removeWorkbookExtra(deleteExtraId);
                if (extra) wbLog('record_deleted', `Extra deleted from workbook "${workbook.title}": ${extra.ref ? `[${extra.ref}] ` : ''}${extra.description}`);
                setDeleteExtraId(null);
              }}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
