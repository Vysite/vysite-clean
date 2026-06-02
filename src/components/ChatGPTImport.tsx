import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Upload, FileText, Download, AlertTriangle, CheckCircle,
  ChevronDown, Save, RefreshCw, Info,
} from 'lucide-react';
import type { ImportRow, ImportCategory, TenderRFI, TenderScopeEntry, RFIStatus } from '../data/types';
import { IMPORT_CATEGORIES } from '../data/types';

// ─── Template definition ──────────────────────────────────────────────────────

const TEMPLATE_HEADERS = [
  'Category', 'Title', 'Finding / Description', 'Suggested Wording',
  'Source Document', 'Page Reference', 'Section / Clause Reference',
  'Priority', 'Action Required', 'Status', 'Notes',
];

const TEMPLATE_EXAMPLE_ROWS: string[][] = [
  ['Scope Note', 'Chilled water pipework insulation', 'All LTHW and CHW pipework to be thermally insulated to specification section M45.', 'Allow to supply and install thermal insulation to all LTHW and CHW pipework in accordance with NBS M45.', '0710826-SP-ME-100.pdf', '14', 'Section M45 — Thermal insulation', 'High', 'Confirm insulation spec and include in pricing', 'Open', ''],
  ['Assumption', 'Normal working hours', '', 'Assumed all works will be carried out during normal working hours Monday–Friday 07:30–17:30.', '', '', '', 'Medium', '', 'Open', ''],
  ['Exclusion', 'Builders work', '', 'All builders work, cutting, chasing, making good and structural modifications are excluded.', '', '', '', 'Medium', '', 'Open', ''],
  ['RFI', 'Inertia base specification', 'No inertia base weight or spring isolator spec provided for AHU-01.', 'Please confirm inertia base weight requirement and spring deflection spec for AHU-01.', '0710826-SP-ME-100.pdf', '22', 'Pr_80_77_94 — 3.3.1.2', 'High', 'Required before pricing', 'Open', ''],
  ['Risk', 'Structural capacity for inertia bases', 'Inertia base weight requirement of 1.5x supported equipment weight may exceed structural capacity assumptions.', '', '0710826-SP-ME-100.pdf', '22', 'Pr_80_77_94 — 3.3.1.2', 'High', 'Raise RFI or add as exclusion', 'Open', ''],
];

function exportTemplate() {
  const rows = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE_ROWS];
  const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'VYSITE_ChatGPT_Review_Template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(c => c.trim())) rows.push(row);
        row = [];
      } else cell += ch;
    }
  }
  if (cell || row.length) { row.push(cell); if (row.some(c => c.trim())) rows.push(row); }
  return rows;
}

function parseImportFile(text: string): { rows: ImportRow[]; unknownHeaders: string[] } {
  const all = parseCSV(text);
  if (all.length < 2) return { rows: [], unknownHeaders: [] };

  const headers = all[0].map(h => h.trim().toLowerCase());
  const find = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n.toLowerCase())));

  const colCategory    = find(['category']);
  const colTitle       = find(['title']);
  const colFinding     = find(['finding', 'description']);
  const colWording     = find(['suggested wording', 'wording']);
  const colSourceDoc   = find(['source document', 'source doc']);
  const colPageRef     = find(['page reference', 'page ref', 'page']);
  const colSection     = find(['section', 'clause']);
  const colPriority    = find(['priority']);
  const colAction      = find(['action required', 'action']);
  const colStatus      = find(['status']);
  const colNotes       = find(['notes']);

  const unknownHeaders: string[] = [];
  const dataRows = all.slice(1).filter(r => r.some(c => c.trim()));

  const rows: ImportRow[] = dataRows.map(r => {
    const get = (i: number) => (i >= 0 && i < r.length ? r[i].trim() : '');
    const rawCat = get(colCategory);
    const matched = IMPORT_CATEGORIES.find(
      c => c.toLowerCase() === rawCat.toLowerCase()
    ) as ImportCategory | undefined;
    const unknownCat = !!rawCat && !matched;
    if (unknownCat && rawCat && !unknownHeaders.includes(rawCat)) unknownHeaders.push(rawCat);
    return {
      category: matched ?? rawCat,
      title: get(colTitle),
      finding: get(colFinding),
      suggestedWording: get(colWording),
      sourceDocument: get(colSourceDoc),
      pageReference: get(colPageRef),
      sectionClauseReference: get(colSection),
      priority: get(colPriority),
      actionRequired: get(colAction),
      status: get(colStatus),
      notes: get(colNotes),
      _valid: !!rawCat && (!!get(colTitle) || !!get(colFinding)),
      _duplicate: false,
      _unknownCategory: unknownCat,
      _selected: !unknownCat && !!rawCat && (!!get(colTitle) || !!get(colFinding)),
    };
  });

  return { rows, unknownHeaders };
}

// ─── Category → tender tab mapping ───────────────────────────────────────────

const CATEGORY_TAB_MAP: Record<string, string> = {
  'Scope Note':             'Qualifications',
  'Assumption':             'Assumptions',
  'Exclusion':              'Exclusions',
  'RFI':                    'RFIs',
  'Risk':                   'Risks',
  'Clarification':          'Qualifications',
  'Subcontractor':          'Qualifications',
  'Commercial Note':        'Qualifications',
  'Design Responsibility':  'Qualifications',
  'Programme / Logistics':  'Qualifications',
  'Compliance Requirement': 'Qualifications',
};

const categoryBadge: Record<string, string> = {
  'Scope Note':             'bg-teal-900/40 text-teal-300 border-teal-800/40',
  'Assumption':             'bg-emerald-900/40 text-emerald-300 border-emerald-800/40',
  'Exclusion':              'bg-orange-900/40 text-orange-300 border-orange-800/40',
  'RFI':                    'bg-blue-900/40 text-blue-300 border-blue-800/40',
  'Risk':                   'bg-red-900/40 text-red-300 border-red-800/40',
  'Clarification':          'bg-sky-900/40 text-sky-300 border-sky-800/40',
  'Subcontractor':          'bg-violet-900/40 text-violet-300 border-violet-800/40',
  'Commercial Note':        'bg-amber-900/40 text-amber-300 border-amber-800/40',
  'Design Responsibility':  'bg-rose-900/40 text-rose-300 border-rose-800/40',
  'Programme / Logistics':  'bg-cyan-900/40 text-cyan-300 border-cyan-800/40',
  'Compliance Requirement': 'bg-lime-900/40 text-lime-300 border-lime-800/40',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  tender: { id: string; name: string; rfis: TenderRFI[]; scopeEntries?: TenderScopeEntry[] };
  currentUser: { name: string; avatar?: string } | null;
  onImport: (rfis: TenderRFI[], scopeEntries: TenderScopeEntry[]) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatGPTImport({ tender, currentUser, onImport, onClose }: Props) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [unknownCats, setUnknownCats] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [catOverrides, setCatOverrides] = useState<Record<number, ImportCategory>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    const { rows: parsed, unknownHeaders } = parseImportFile(text);
    // Mark duplicates against existing tender entries
    const existingTexts = new Set([
      ...(tender.scopeEntries ?? []).map(e => e.text.trim().toLowerCase()),
      ...tender.rfis.map(r => (r.subject ?? r.question).trim().toLowerCase()),
    ]);
    const deduped = parsed.map(r => ({
      ...r,
      _duplicate: existingTexts.has((r.suggestedWording || r.finding || r.title).trim().toLowerCase()),
    }));
    setRows(deduped);
    setUnknownCats(unknownHeaders);
    setFileName(file.name);
    setStep('preview');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function toggleRow(i: number) {
    setRows(prev => prev.map((r, j) => j === i ? { ...r, _selected: !r._selected } : r));
  }

  function toggleAll(val: boolean) {
    setRows(prev => prev.map(r => r._valid && !r._duplicate && !r._unknownCategory ? { ...r, _selected: val } : r));
  }

  function resolveCategory(row: ImportRow, i: number): ImportCategory | string {
    return catOverrides[i] ?? row.category;
  }

  function handleImport() {
    const user = currentUser?.name ?? 'Import';
    const avatar = user.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const now = new Date().toISOString();
    const newRFIs: TenderRFI[] = [];
    const newEntries: TenderScopeEntry[] = [];
    let rfiIdx = tender.rfis.length + 1;

    rows.filter(r => r._selected).forEach((r, _i) => {
      const cat = resolveCategory(r, rows.indexOf(r));
      const tab = CATEGORY_TAB_MAP[cat] ?? 'Qualifications';
      const text = r.suggestedWording || r.finding || r.title;

      if (cat === 'RFI') {
        newRFIs.push({
          id: `rfi-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ref: `RFI-${String(rfiIdx++).padStart(3, '0')}`,
          subject: r.title || r.finding.slice(0, 80),
          question: r.suggestedWording || r.finding,
          dateRaised: now.split('T')[0],
          status: 'Draft' as RFIStatus,
          notes: [r.notes, r.actionRequired].filter(Boolean).join('\n'),
          sourceDocument: r.sourceDocument || undefined,
          pageReference: r.pageReference || undefined,
          sectionClause: r.sectionClauseReference || undefined,
          importSource: 'ChatGPT Import',
        });
      } else {
        newEntries.push({
          id: `se-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: tab === 'Risks' ? 'Risks' : cat,
          user,
          avatar,
          datetime: now,
          text,
          sourceDocument: r.sourceDocument || undefined,
          pageReference: r.pageReference || undefined,
          sectionClause: r.sectionClauseReference || undefined,
          importSource: 'ChatGPT Import',
        });
      }
    });

    onImport(newRFIs, newEntries);
    setStep('done');
  }

  const selectedCount = rows.filter(r => r._selected).length;
  const validCount = rows.filter(r => r._valid && !r._unknownCategory).length;
  const dupCount = rows.filter(r => r._duplicate).length;

  const modal = (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-[#111827] border border-[#1e2d4a] rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1e2d4a] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center">
            <FileText size={15} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white">ChatGPT Findings Import</h2>
            <p className="text-[11px] text-slate-500">{tender.name}</p>
          </div>
          <button
            onClick={exportTemplate}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 border border-[#1e2d4a] hover:border-slate-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download size={12} />Export Template
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1a2236] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Upload step */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-400 leading-relaxed space-y-1">
                    <p>Upload a CSV file exported from ChatGPT or another AI review tool. The file must contain a <span className="font-semibold text-slate-300">Category</span> column and at least a <span className="font-semibold text-slate-300">Title</span> or <span className="font-semibold text-slate-300">Finding</span> column.</p>
                    <p>Supported categories: {IMPORT_CATEGORIES.join(', ')}.</p>
                  </div>
                </div>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-emerald-500 bg-emerald-900/10' : 'border-[#1e2d4a] hover:border-[#2a3d5a] hover:bg-[#0d1628]/60'}`}
              >
                <Upload size={24} className="text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-400 mb-1">Drop CSV file here</p>
                <p className="text-xs text-slate-600">or click to browse — CSV only</p>
                <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              </div>

              <div className="flex justify-center">
                <button onClick={exportTemplate} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  <Download size={12} />Download blank import template with example rows
                </button>
              </div>
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <FileText size={12} className="text-slate-500" />
                  <span className="font-semibold text-slate-300">{fileName}</span>
                </div>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-400">{rows.length} rows</span>
                {dupCount > 0 && (
                  <span className="text-[10px] font-semibold text-amber-400 bg-amber-900/30 border border-amber-800/40 px-2 py-0.5 rounded-full">
                    {dupCount} possible duplicates
                  </span>
                )}
                {unknownCats.length > 0 && (
                  <span className="text-[10px] font-semibold text-red-400 bg-red-900/30 border border-red-800/40 px-2 py-0.5 rounded-full">
                    {unknownCats.length} unknown categories
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => toggleAll(true)} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">Select all</button>
                  <span className="text-slate-700">·</span>
                  <button onClick={() => toggleAll(false)} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">Deselect all</button>
                  <button onClick={() => { setRows([]); setStep('upload'); }} className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors ml-2">
                    <RefreshCw size={10} />New file
                  </button>
                </div>
              </div>

              {unknownCats.length > 0 && (
                <div className="bg-amber-900/15 border border-amber-700/40 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                    <p className="text-xs font-semibold text-amber-300">Unknown categories — assign before importing</p>
                  </div>
                  <p className="text-[10px] text-amber-400/80">
                    These categories were not recognised: <span className="font-semibold">{unknownCats.join(', ')}</span>. Use the dropdown on each row to reclassify them.
                  </p>
                </div>
              )}

              {/* Row list */}
              <div className="space-y-1.5">
                {rows.map((row, i) => {
                  const cat = resolveCategory(row, i) as string;
                  const badgeCls = categoryBadge[cat] ?? 'bg-slate-700/40 text-slate-400 border-slate-600/40';
                  const tab = CATEGORY_TAB_MAP[cat];
                  return (
                    <div key={i} className={`rounded-xl border transition-colors ${
                      !row._valid              ? 'bg-[#0d1628] border-[#1e2d4a] opacity-40' :
                      row._duplicate           ? 'bg-amber-900/10 border-amber-800/40' :
                      row._unknownCategory     ? 'bg-red-900/10 border-red-800/40' :
                      row._selected            ? 'bg-[#0d1e36] border-[#f97316]/30' :
                                                 'bg-[#0d1628] border-[#1e2d4a]'
                    }`}>
                      <div className="flex items-start gap-3 p-3">
                        <button
                          onClick={() => row._valid && !row._duplicate && !row._unknownCategory && toggleRow(i)}
                          disabled={!row._valid || row._duplicate || row._unknownCategory}
                          className={`mt-0.5 w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors ${
                            row._selected ? 'bg-[#f97316] border-[#f97316]' : 'border-slate-600 hover:border-slate-400'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {row._selected && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </button>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Category selector */}
                            {row._unknownCategory ? (
                              <div className="relative">
                                <select
                                  value={catOverrides[i] ?? ''}
                                  onChange={e => {
                                    const v = e.target.value as ImportCategory;
                                    setCatOverrides(prev => ({ ...prev, [i]: v }));
                                    setRows(prev => prev.map((r, j) => j === i ? { ...r, _unknownCategory: false, _selected: true } : r));
                                  }}
                                  className="text-[10px] font-semibold bg-red-900/40 text-red-300 border border-red-700/60 rounded px-2 py-0.5 pr-6 outline-none cursor-pointer appearance-none"
                                >
                                  <option value="">Assign category...</option>
                                  {IMPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none" />
                              </div>
                            ) : (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeCls}`}>{cat}</span>
                            )}
                            {tab && !row._unknownCategory && (
                              <span className="text-[10px] text-slate-600">→ {tab}</span>
                            )}
                            {row._duplicate && (
                              <span className="text-[10px] font-semibold text-amber-400 bg-amber-900/30 border border-amber-800/40 px-1.5 py-0.5 rounded-full">Possible duplicate</span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-slate-200 leading-snug">{row.title || row.finding.slice(0, 100)}</p>
                          {row.suggestedWording && row.suggestedWording !== row.title && (
                            <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{row.suggestedWording}</p>
                          )}
                          <div className="flex items-center gap-3 flex-wrap mt-1">
                            {row.sourceDocument && <span className="text-[10px] text-slate-600">{row.sourceDocument}</span>}
                            {row.pageReference && <span className="text-[10px] text-slate-600">p.{row.pageReference}</span>}
                            {row.sectionClauseReference && <span className="text-[10px] text-slate-600">{row.sectionClauseReference}</span>}
                            {row.priority && <span className="text-[10px] text-slate-600">Priority: {row.priority}</span>}
                          </div>
                        </div>

                        {row._duplicate && (
                          <button
                            onClick={() => setRows(prev => prev.map((r, j) => j === i ? { ...r, _duplicate: false, _selected: true } : r))}
                            className="text-[10px] text-amber-500 hover:text-amber-300 transition-colors shrink-0 mt-0.5"
                          >
                            Import anyway
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Done step */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center">
                <CheckCircle size={24} className="text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-white">Import complete</p>
              <p className="text-xs text-slate-400">{selectedCount} finding{selectedCount !== 1 ? 's' : ''} imported and marked as <span className="font-semibold text-slate-300">ChatGPT Import</span>.</p>
              <p className="text-[10px] text-slate-600">Items are now visible in the relevant tender tabs.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#1e2d4a] shrink-0 bg-[#0d1628]/50">
            <p className="text-[10px] text-slate-600 max-w-xs leading-snug">
              {selectedCount > 0
                ? `${selectedCount} of ${validCount} findings selected for import. All imported items are marked as "ChatGPT Import" and will not overwrite existing live items.`
                : 'Select findings to import.'}
            </p>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={13} />Import {selectedCount > 0 ? selectedCount : ''} Finding{selectedCount !== 1 ? 's' : ''}
            </button>
          </div>
        )}
        {step === 'done' && (
          <div className="flex justify-end px-5 py-4 border-t border-[#1e2d4a] shrink-0">
            <button onClick={onClose} className="px-5 py-2 bg-[#f97316] hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-colors">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
