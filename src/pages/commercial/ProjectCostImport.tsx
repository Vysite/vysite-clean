import { useState, useRef } from 'react';
import {
  Upload, FileText, X, CheckCircle2, AlertCircle,
  ArrowRight, PoundSterling,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLog';
import type { DBProjectCost } from '../../lib/store';
import type { Project } from '../../data/types';
import { fmtCurrency } from './types';

const COST_CATEGORIES = [
  'Labour', 'Materials', 'Subcontractors', 'Plant & Equipment',
  'Preliminaries', 'Specialist Suppliers', 'Design', 'Professional Fees',
  'Travel / Expenses', 'Other',
];

interface ParsedRow {
  rowNumber: number;
  cost_date: string;
  supplier: string;
  reference: string;
  description: string;
  cost_category: string;
  net_cost: number;
  vat_amount: number;
  cost_type: string;
  status: string;
  notes: string;
  _valid: boolean;
  _errors: string[];
  _duplicate: boolean;
}

interface ProjectCostImportProps {
  project: Project;
  orgId: string;
  currentUserName: string;
  onComplete: () => void;
  onCancel: () => void;
}

const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#f97316] focus:border-[#f97316] transition-colors';

export default function ProjectCostImport({
  project, orgId, currentUserName, onComplete, onCancel,
}: ProjectCostImportProps) {
  const [stage, setStage] = useState<'upload' | 'preview'>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseCSV(text: string): string[][] {
    const lines: string[][] = [];
    let current: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',' || ch === '\t' || ch === ';') { current.push(field); field = ''; }
        else if (ch === '\n') { current.push(field); lines.push(current); current = []; field = ''; }
        else if (ch === '\r') { /* skip */ }
        else field += ch;
      }
    }
    if (field || current.length) { current.push(field); lines.push(current); }
    return lines;
  }

  function findHeader(headers: string[], candidates: string[]): number {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.toLowerCase().trim() === c);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  function handleFile(file: File) {
    setError('');
    setImportResult(null);
    setFileName(file.name);
    file.text().then(text => {
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        setError('File appears to be empty or has no data rows.');
        return;
      }
      const headers = parsed[0].map(h => h.toLowerCase().trim());
      const dateIdx = findHeader(headers, ['date', 'cost_date', 'cost date']);
      const supplierIdx = findHeader(headers, ['supplier', 'payee', 'supplier/payee']);
      const refIdx = findHeader(headers, ['reference', 'ref', 'invoice', 'invoice number', 'invoice no', 'invoice_no']);
      const descIdx = findHeader(headers, ['description', 'desc', 'details']);
      const catIdx = findHeader(headers, ['category', 'cost_category', 'cost category']);
      const netIdx = findHeader(headers, ['net cost', 'net', 'net_cost', 'cost']);
      const vatIdx = findHeader(headers, ['vat', 'vat amount', 'vat_amount']);
      const typeIdx = findHeader(headers, ['type', 'cost_type', 'cost type']);
      const statusIdx = findHeader(headers, ['status']);
      const notesIdx = findHeader(headers, ['notes', 'note']);

      if (netIdx < 0) {
        setError('Required column "Net Cost" not found. Please ensure your file has a Net Cost column.');
        return;
      }

      const parsedRows: ParsedRow[] = [];
      for (let i = 1; i < parsed.length; i++) {
        const r = parsed[i];
        if (r.every(c => !c.trim())) continue;

        const dateStr = dateIdx >= 0 ? (r[dateIdx] || '').trim() : '';
        const supplier = supplierIdx >= 0 ? (r[supplierIdx] || '').trim() : '';
        const reference = refIdx >= 0 ? (r[refIdx] || '').trim() : '';
        const description = descIdx >= 0 ? (r[descIdx] || '').trim() : '';
        const category = catIdx >= 0 ? (r[catIdx] || '').trim() : 'Other';
        const netRaw = netIdx >= 0 ? (r[netIdx] || '').trim() : '0';
        const vatRaw = vatIdx >= 0 ? (r[vatIdx] || '').trim() : '0';
        const typeRaw = typeIdx >= 0 ? (r[typeIdx] || '').trim().toLowerCase() : 'actual';
        const statusRaw = statusIdx >= 0 ? (r[statusIdx] || '').trim().toLowerCase() : 'draft';
        const notes = notesIdx >= 0 ? (r[notesIdx] || '').trim() : '';

        const netNum = parseFloat(netRaw.replace(/[£,\s]/g, '')) || 0;
        const vatNum = parseFloat(vatRaw.replace(/[£,\s]/g, '')) || 0;

        const errors: string[] = [];
        if (!dateStr) errors.push('Missing date');
        if (netNum <= 0) errors.push('Net cost must be > 0');
        if (!supplier && !description) errors.push('Supplier or description required');
        if (!COST_CATEGORIES.includes(category) && category !== 'Other') {
          // Accept any category string — just validate it's not empty
        }
        const validTypes = ['actual', 'committed', 'forecast'];
        const costType = validTypes.includes(typeRaw) ? typeRaw : 'actual';
        const validStatuses = ['draft', 'confirmed', 'invoiced', 'paid'];
        const status = validStatuses.includes(statusRaw) ? statusRaw : 'draft';

        parsedRows.push({
          rowNumber: i,
          cost_date: dateStr,
          supplier,
          reference,
          description,
          cost_category: category || 'Other',
          net_cost: netNum,
          vat_amount: vatNum,
          cost_type: costType,
          status,
          notes,
          _valid: errors.length === 0,
          _errors: errors,
          _duplicate: false,
        });
      }

      // Duplicate detection within the batch
      for (let i = 0; i < parsedRows.length; i++) {
        for (let j = i + 1; j < parsedRows.length; j++) {
          if (
            parsedRows[i]._valid && parsedRows[j]._valid &&
            parsedRows[i].reference &&
            parsedRows[i].reference === parsedRows[j].reference &&
            parsedRows[i].supplier === parsedRows[j].supplier
          ) {
            parsedRows[j]._duplicate = true;
            parsedRows[j]._errors.push('Potential duplicate ref in file');
            parsedRows[j]._valid = false;
          }
        }
      }

      setRows(parsedRows);
      setStage('preview');
    }).catch(() => setError('Failed to read file.'));
  }

  const validRows = rows.filter(r => r._valid);
  const invalidRows = rows.filter(r => !r._valid);
  const totalNet = validRows.reduce((s, r) => s + r.net_cost, 0);

  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    setError('');

    const insertRows: Omit<DBProjectCost, 'id' | 'created_at' | 'updated_at'>[] = validRows.map(r => ({
      org_id: orgId,
      project_id: project.id,
      cost_date: r.cost_date,
      supplier: r.supplier,
      reference: r.reference,
      description: r.description,
      cost_category: r.cost_category,
      net_cost: r.net_cost,
      vat_amount: r.vat_amount,
      gross_cost: r.net_cost + r.vat_amount,
      cost_type: r.cost_type as DBProjectCost['cost_type'],
      status: r.status as DBProjectCost['status'],
      notes: r.notes,
      created_by: currentUserName || null,
    }));

    const { error: insertError } = await supabase.from('vy_project_costs').insert(insertRows);

    if (insertError) {
      setError(`Import failed: ${insertError.message}. No records were saved.`);
      setImporting(false);
      return;
    }

    logActivity({
      orgId,
      userName: currentUserName,
      module: 'commercial',
      recordType: 'Project Cost',
      projectId: project.id,
      projectName: project.name,
      actionType: 'record_created',
      description: `${currentUserName} imported ${validRows.length} project cost records (${fmtCurrency(totalNet)} total) from ${fileName}`,
      metadata: { count: validRows.length, totalNet, fileName },
    });

    setImportResult({ success: true, message: `Successfully imported ${validRows.length} cost record${validRows.length !== 1 ? 's' : ''}.` });
    setImporting(false);
    setTimeout(() => onComplete(), 1500);
  }

  function downloadTemplate() {
    const headers = 'Date,Supplier,Reference,Category,Description,Net Cost,VAT,Type,Status,Notes';
    const example = '2026-09-01,ABC Builders Ltd,INV-001,Materials,Concrete delivery,1250.00,250.00,actual,confirmed,Monthly delivery';
    const blob = new Blob([`${headers}\n${example}\n`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project-costs-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d4a] sticky top-0 bg-[#111827] z-10">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-[#f97316]" />
            <h3 className="text-sm font-bold text-white">Import Project Costs — {project.name}</h3>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="px-5 py-4">
          {importResult ? (
            <div className="py-8 text-center">
              <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-white font-medium">{importResult.message}</p>
            </div>
          ) : stage === 'upload' ? (
            <div className="space-y-4">
              <div className="bg-[#0d1628] border border-dashed border-[#1e2d4a] rounded-xl px-6 py-10 text-center">
                <FileText size={28} className="text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-300 mb-2">Upload a CSV or Excel-exported file</p>
                <p className="text-xs text-slate-500 mb-4">Required columns: Date, Supplier, Reference, Category, Description, Net Cost</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#f97316] hover:bg-orange-400 text-white rounded-lg transition-colors">
                    <Upload size={14} /> Choose File
                  </button>
                  <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white border border-[#1e2d4a] hover:border-[#f97316] rounded-lg transition-colors">
                    Download Template
                  </button>
                </div>
                {fileName && <p className="text-xs text-slate-400 mt-3">Selected: {fileName}</p>}
              </div>
              {error && (
                <div className="flex items-start gap-2 px-4 py-3 bg-red-900/20 border border-red-800/40 rounded-lg">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}
              <div className="text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-400">Accepted columns:</p>
                <p>Date, Supplier, Reference, Category, Description, Net Cost, VAT, Type (actual/committed/forecast), Status (draft/confirmed/invoiced/paid), Notes</p>
                <p className="text-slate-600">Type defaults to "actual". Status defaults to "draft" — draft costs do NOT affect live profitability until confirmed.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Valid Rows</p>
                  <p className="text-lg font-bold text-emerald-400">{validRows.length}</p>
                </div>
                <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Invalid Rows</p>
                  <p className="text-lg font-bold text-red-400">{invalidRows.length}</p>
                </div>
                <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Net Value</p>
                  <p className="text-lg font-bold text-[#f97316]">{fmtCurrency(totalNet)}</p>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-4 py-3 bg-red-900/20 border border-red-800/40 rounded-lg">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              {/* Preview table */}
              <div className="border border-[#1e2d4a] rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0d1628]">
                    <tr className="border-b border-[#1e2d4a] text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                      <th className="px-3 py-2 text-left font-semibold">Ref</th>
                      <th className="px-3 py-2 text-left font-semibold">Category</th>
                      <th className="px-3 py-2 text-left font-semibold">Type</th>
                      <th className="px-3 py-2 text-right font-semibold">Net</th>
                      <th className="px-3 py-2 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2d4a]/40">
                    {rows.map(r => (
                      <tr key={r.rowNumber} className={r._valid ? '' : 'bg-red-900/10'}>
                        <td className="px-3 py-2 text-slate-500">{r.rowNumber}</td>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{r.cost_date || '—'}</td>
                        <td className="px-3 py-2 text-slate-200">{r.supplier || '—'}</td>
                        <td className="px-3 py-2 text-slate-400">{r.reference || '—'}</td>
                        <td className="px-3 py-2 text-slate-400">{r.cost_category}</td>
                        <td className="px-3 py-2 text-slate-400">{r.cost_type}</td>
                        <td className="px-3 py-2 text-right text-white tabular-nums">{fmtCurrency(r.net_cost)}</td>
                        <td className="px-3 py-2">
                          {r._valid ? (
                            <CheckCircle2 size={14} className="text-emerald-400 mx-auto" />
                          ) : (
                            <div className="text-center">
                              <AlertCircle size={14} className="text-red-400 mx-auto" />
                              <p className="text-[9px] text-red-400 mt-0.5">{r._errors.join(', ')}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button onClick={() => { setStage('upload'); setRows([]); setFileName(''); }} className="text-xs text-slate-400 hover:text-white transition-colors">
                  ← Choose different file
                </button>
                <div className="flex gap-3">
                  <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-[#1e2d4a] hover:text-white transition-colors">Cancel</button>
                  <button
                    onClick={handleImport}
                    disabled={importing || validRows.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#f97316] hover:bg-orange-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {importing ? 'Importing…' : `Import ${validRows.length} record${validRows.length !== 1 ? 's' : ''}`}
                    {!importing && <ArrowRight size={14} />}
                  </button>
                </div>
              </div>
              {validRows.length === 0 && (
                <p className="text-xs text-amber-400 text-center">No valid rows to import. Fix the errors in your file and try again.</p>
              )}
              {validRows.length > 0 && invalidRows.length > 0 && (
                <p className="text-xs text-slate-500 text-center">Only {validRows.length} valid row{validRows.length !== 1 ? 's' : ''} will be imported. {invalidRows.length} invalid row{invalidRows.length !== 1 ? 's' : ''} will be skipped.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
