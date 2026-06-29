import { useState, useEffect } from 'react';
import type { LucideIcon } from '../data/types';
import { Plus, X, Search, ChevronDown, CheckCircle, FileText, Activity, Zap, Wind, Droplets, Thermometer, Settings, ClipboardList, Filter, Printer, Trash2, Eye, Download, Paperclip } from 'lucide-react';
import { openPrintTab, buildPrintDocument } from '../lib/printTab';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import FileUploadComponent, { type UploadedFile } from '../components/FileUpload';
import type { DBTCRecord } from '../lib/store';
import { logActivity, buildDiff, type FieldSpec } from '../lib/activityLog';

// ─── Types ────────────────────────────────────────────────────────────────────

type TCStatus = 'Not Started' | 'In Progress' | 'Complete' | 'Failed' | 'On Hold';
type TCCategory = 'AHU Commissioning' | 'Plantroom Testing' | 'Pipework Pressure Test' | 'Flushing Record' | 'Commissioning Sheet' | 'Valve Testing' | 'Electrical Testing' | 'QA Sign-Off';

interface TCRecord {
  id: string;
  projectId: string;
  projectName: string;
  category: TCCategory;
  ref: string;
  title: string;
  area: string;
  engineer: string;
  date: string;
  status: TCStatus;
  result?: string;
  notes: string;
  files: UploadedFile[];
  comments: { id: string; user: string; datetime: string; text: string }[];
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function dbToTC(r: DBTCRecord): TCRecord {
  return {
    id: r.id,
    projectId: r.project_id,
    projectName: r.project_name,
    category: r.category as TCCategory,
    ref: r.ref,
    title: r.title,
    area: r.area,
    engineer: r.engineer,
    date: r.date,
    status: r.status as TCStatus,
    result: r.result,
    notes: r.notes,
    files: (r.files ?? []) as UploadedFile[],
    comments: (r.comments ?? []) as TCRecord['comments'],
  };
}

function tcToDB(r: TCRecord): DBTCRecord {
  return {
    id: r.id,
    project_id: r.projectId,
    project_name: r.projectName,
    category: r.category,
    ref: r.ref,
    title: r.title,
    area: r.area,
    engineer: r.engineer,
    date: r.date,
    status: r.status,
    result: r.result,
    notes: r.notes,
    files: r.files,
    comments: r.comments,
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const categoryConfig: Record<TCCategory, { icon: LucideIcon; color: string; bg: string; border: string; description: string }> = {
  'AHU Commissioning':      { icon: Wind,         color: 'text-blue-400',    bg: 'bg-blue-900/60',    border: 'border-l-blue-700',    description: 'Air handling unit commissioning records & data sheets' },
  'Plantroom Testing':      { icon: Settings,      color: 'text-amber-400',   bg: 'bg-amber-900/60',   border: 'border-l-amber-700',   description: 'Plant room equipment testing and performance verification' },
  'Pipework Pressure Test': { icon: Droplets,      color: 'text-cyan-400',    bg: 'bg-cyan-900/60',    border: 'border-l-cyan-700',    description: 'Hydraulic pressure testing records for pipework systems' },
  'Flushing Record':        { icon: Activity,      color: 'text-teal-400',    bg: 'bg-teal-900/60',    border: 'border-l-teal-700',    description: 'Pre-commission flushing and chemical dosing records' },
  'Commissioning Sheet':    { icon: ClipboardList, color: 'text-orange-400',  bg: 'bg-orange-900/60',  border: 'border-l-orange-700',  description: 'General commissioning data sheets and performance records' },
  'Valve Testing':          { icon: Thermometer,   color: 'text-rose-400',    bg: 'bg-rose-900/60',    border: 'border-l-rose-700',    description: 'Isolation valve and control valve test records' },
  'Electrical Testing':     { icon: Zap,           color: 'text-yellow-400',  bg: 'bg-yellow-900/60',  border: 'border-l-yellow-700',  description: 'Electrical installation testing: continuity, insulation, EIC' },
  'QA Sign-Off':            { icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-900/60', border: 'border-l-emerald-700', description: 'Quality assurance sign-off sheets and client handover records' },
};

const statusColors: Record<TCStatus, string> = {
  'Not Started': 'bg-[#1e2d4a] text-slate-400',
  'In Progress': 'bg-blue-900/60 text-blue-400',
  'Complete':    'bg-emerald-900/60 text-emerald-400',
  'Failed':      'bg-red-900/60 text-red-400',
  'On Hold':     'bg-amber-900/60 text-amber-400',
};

const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

// ─── Components ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TCStatus }) {
  return <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${statusColors[status]}`}>{status}</span>;
}

interface CreateRecordModalProps {
  onClose: () => void;
  onSave: (record: TCRecord) => void;
}

function CreateRecordModal({ onClose, onSave }: CreateRecordModalProps) {
  const store = useAppStore();
  const [form, setForm] = useState({
    category: 'AHU Commissioning' as TCCategory,
    project: '',
    ref: '',
    title: '',
    area: '',
    engineer: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Not Started' as TCStatus,
    result: '',
    notes: '',
  });
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const proj = store.projects.find(p => p.name === form.project);
    onSave({
      id: `tc${Date.now()}`,
      projectId: proj?.id || '',
      projectName: form.project,
      category: form.category,
      ref: form.ref || `${form.category.replace(/\s+/g, '-').toUpperCase()}-${Date.now().toString().slice(-4)}`,
      title: form.title,
      area: form.area,
      engineer: form.engineer,
      date: form.date,
      status: form.status,
      result: form.result || undefined,
      notes: form.notes,
      files,
      comments: [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <h2 className="text-lg font-bold text-white">New T&C Record</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category *</label>
              <div className="relative">
                <select required value={form.category} onChange={set('category')} className={`${inputCls} appearance-none pr-8`}>
                  {Object.keys(categoryConfig).map(c => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Project *</label>
              <div className="relative">
                <select required value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                  <option value="">Select...</option>
                  {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Reference</label>
              <input value={form.ref} onChange={set('ref')} className={inputCls} placeholder="e.g. AHU-01-COMM" />
            </div>
            <div>
              <label className={labelCls}>Area / Location *</label>
              <input required value={form.area} onChange={set('area')} className={inputCls} placeholder="Plant room, ward, floor..." />
            </div>
          </div>
          <div>
            <label className={labelCls}>Title *</label>
            <input required value={form.title} onChange={set('title')} className={inputCls} placeholder="Descriptive title for this record" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Engineer *</label>
              <input required value={form.engineer} onChange={set('engineer')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Date *</label>
              <input required type="date" value={form.date} onChange={set('date')} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <div className="relative">
              <select value={form.status} onChange={set('status')} className={`${inputCls} appearance-none pr-8`}>
                {(['Not Started', 'In Progress', 'Complete', 'Failed', 'On Hold'] as TCStatus[]).map(s => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Test Result / Outcome</label>
            <input value={form.result} onChange={set('result')} className={inputCls} placeholder="Pass / Fail + brief result summary" />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3} className={`${inputCls} resize-none`} placeholder="Additional technical notes..." />
          </div>
          <div>
            <label className={labelCls}>Supporting Documents / Photos</label>
            <FileUploadComponent files={files} onChange={setFiles} accept="image/*,.pdf,.doc,.docx" label="Upload test sheets, photos or certificates" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">Save Record</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface RecordDetailProps {
  record: TCRecord;
  onClose: () => void;
  onUpdate: (r: TCRecord) => void;
  canEdit?: boolean;
  canExport?: boolean;
}

function buildTCRecordHTML(record: TCRecord, today: string, logoUrl?: string): string {
  const statusColor = record.status === 'Complete' ? '#059669' : record.status === 'Failed' ? '#dc2626' : record.status === 'In Progress' ? '#2563eb' : '#64748b';
  const dateFormatted = new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const resultBg = record.status === 'Complete' ? '#f0fdf4' : record.status === 'Failed' ? '#fef2f2' : '#f8fafc';
  const resultBorder = record.status === 'Complete' ? '#86efac' : record.status === 'Failed' ? '#fca5a5' : '#e2e8f0';
  const tcLogoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="height:32px;max-width:140px;object-fit:contain;display:block;margin-bottom:4px">`
    : `<div class="tc-logo">VYSITE</div>`;
  const styles = `
    .tc-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #f97316}
    .tc-logo{font-size:22px;font-weight:900;color:#f97316;letter-spacing:.05em;margin-bottom:4px}
    .tc-sub{font-size:14px;font-weight:700;color:#1e293b}
    .tc-ref{font-weight:700;color:#f97316;margin-bottom:2px}
    .tc-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .tc-mc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px}
    .tc-ml{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
    .tc-mv{font-size:12px;font-weight:600;color:#1e293b}
    .tc-sigs{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:36px;padding-top:20px;border-top:1px solid #e2e8f0}
    .tc-sig-label{font-size:10px;font-weight:700;color:#64748b;margin-bottom:32px}
    .tc-sig-line{border-bottom:1px solid #94a3b8;padding-bottom:4px;margin-bottom:4px}
    .tc-sig-hint{font-size:10px;color:#94a3b8}
    .tc-footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
  `;
  const body = `
    <div class="tc-header">
      <div>${tcLogoHtml}<div class="tc-sub">Testing &amp; Commissioning Certificate</div></div>
      <div style="text-align:right;font-size:11px;color:#64748b">
        <div class="tc-ref">${record.ref}</div>
        <div>Issued: ${today}</div>
        <div style="margin-top:2px;font-weight:600;color:${statusColor}">${record.status}</div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px">${record.title}</div>
      <div style="font-size:12px;color:#64748b">${record.category} — ${record.projectName}</div>
    </div>
    <div class="tc-meta">
      <div class="tc-mc"><div class="tc-ml">Engineer</div><div class="tc-mv">${record.engineer}</div></div>
      <div class="tc-mc"><div class="tc-ml">Date</div><div class="tc-mv">${dateFormatted}</div></div>
      <div class="tc-mc"><div class="tc-ml">Area / Location</div><div class="tc-mv">${record.area}</div></div>
      <div class="tc-mc"><div class="tc-ml">Reference</div><div class="tc-mv">${record.ref}</div></div>
    </div>
    ${record.result ? `<div style="margin-bottom:16px;padding:12px 14px;background:${resultBg};border:1px solid ${resultBorder};border-radius:8px"><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Result / Outcome</div><div style="font-size:12px;color:#1e293b;font-weight:500">${record.result}</div></div>` : ''}
    ${record.notes ? `<div style="margin-bottom:16px"><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Technical Notes</div><div style="font-size:12px;color:#334155;line-height:1.6">${record.notes}</div></div>` : ''}
    <div class="tc-sigs">
      <div><div class="tc-sig-label">Engineer Sign-Off</div><div class="tc-sig-line"></div><div class="tc-sig-hint">Signature &amp; Date</div></div>
      <div><div class="tc-sig-label">Client / Witness Sign-Off</div><div class="tc-sig-line"></div><div class="tc-sig-hint">Signature &amp; Date</div></div>
    </div>
    <div class="tc-footer">VY Construction Ltd · Generated by VYSITE · ${today}</div>
  `;
  return buildPrintDocument(`T&C Certificate — ${record.ref}`, styles, body);
}

function RecordDetail({ record, onClose, onUpdate, canEdit = true, canExport = true }: RecordDetailProps) {
  const store = useAppStore();
  const orgId = store.currentOrgId ?? '';
  const userName = store.currentUser?.name ?? '';
  const [tab, setTab] = useState<'details' | 'comments' | 'files'>('details');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: record.title, area: record.area, engineer: record.engineer, date: record.date, status: record.status, result: record.result || '', notes: record.notes });
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState(() => record.comments);
  const [files, setFiles] = useState(() => record.files);
  const [filePreview, setFilePreview] = useState<UploadedFile | null>(null);

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const cfg = categoryConfig[record.category];
  const Icon = cfg.icon;

  const handlePrintRecord = () => {
    openPrintTab(buildTCRecordHTML(record, today, store.settings?.logo_data_url));
    logActivity({ orgId, userName, module: 'testing', recordId: record.id, recordRef: record.ref, recordType: record.category, projectId: record.projectId, projectName: record.projectName, actionType: 'pdf_exported', description: `${userName} exported T&C certificate for ${record.ref}.` });
  };

  const saveEdit = () => {
    // Spread current comments/files state (not stale prop) to avoid losing in-session additions
    onUpdate({ ...record, ...editForm, result: editForm.result || undefined, comments, files });
    setEditing(false);
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    const c = { id: `c${Date.now()}`, user: store.currentUser?.name ?? '', datetime: new Date().toISOString(), text: newComment.trim() };
    const next = [...comments, c];
    setComments(next);
    onUpdate({ ...record, comments: next });
    setNewComment('');
  };

  const inputCls2 = 'mt-1 w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';

  return (
    <>
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-[#1e2d4a] shrink-0">
          <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
            <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
              <Icon size={17} className={cfg.color} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-500">{record.ref}</span>
              <h2 className="text-base font-bold text-white leading-snug">{record.title}</h2>
              <p className="text-xs text-slate-500">{record.projectName} — {record.area}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {canExport && (
              <button onClick={handlePrintRecord}
                title="Export certificate PDF"
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors">
                <Printer size={15} />
              </button>
            )}
            {canEdit && (
              <button onClick={() => { setEditing(e => !e); setTab('details'); }}
                className={`p-1.5 rounded-lg transition-colors ${editing ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-white hover:bg-[#1e2d4a]'}`}>
                <FileText size={15} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="flex border-b border-[#1e2d4a] shrink-0">
          {(['details', 'comments', 'files'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setEditing(false); }}
              className={`px-5 py-3 text-xs font-semibold transition-colors capitalize border-b-2 -mb-px ${
                tab === t ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}>
              {t}{t === 'comments' && comments.length > 0 && <span className="ml-1 bg-orange-500/20 text-[#f97316] text-[9px] px-1.5 py-0.5 rounded-full">{comments.length}</span>}
              {t === 'files' && files.length > 0 && <span className="ml-1 bg-slate-700 text-slate-300 text-[9px] px-1.5 py-0.5 rounded-full">{files.length}</span>}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {tab === 'details' && !editing && (
            <>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={record.status} />
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>{record.category}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Engineer', value: record.engineer },
                  { label: 'Date', value: new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
                  { label: 'Area', value: record.area },
                  { label: 'Reference', value: record.ref },
                ].map(item => (
                  <div key={item.label} className="bg-[#0d1628] rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-slate-200">{item.value}</p>
                  </div>
                ))}
              </div>
              {record.result && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Result / Outcome</p>
                  <div className={`rounded-xl p-3 border ${record.status === 'Complete' ? 'bg-emerald-950/30 border-emerald-800/50' : record.status === 'Failed' ? 'bg-red-950/30 border-red-800/50' : 'bg-[#0d1628] border-[#1e2d4a]'}`}>
                    <p className="text-sm text-slate-300">{record.result}</p>
                  </div>
                </div>
              )}
              {record.notes && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{record.notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Update Status</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['In Progress', 'Complete', 'Failed'] as TCStatus[]).map(s => (
                    <button key={s} onClick={() => onUpdate({ ...record, status: s })}
                      className={`py-2 rounded-lg text-xs font-semibold transition-colors border ${
                        record.status === s
                          ? s === 'In Progress' ? 'bg-blue-500 text-white border-blue-500'
                            : s === 'Complete' ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-red-500 text-white border-red-500'
                          : 'bg-[#0d1628] text-slate-400 border-[#1e2d4a] hover:border-slate-500'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'details' && editing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</label>
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className={inputCls2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Area</label>
                  <input value={editForm.area} onChange={e => setEditForm(f => ({ ...f, area: e.target.value }))} className={inputCls2} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Engineer</label>
                  <input value={editForm.engineer} onChange={e => setEditForm(f => ({ ...f, engineer: e.target.value }))} className={inputCls2} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
                  <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className={inputCls2} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                  <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as TCStatus }))} className={inputCls2}>
                    {(['Not Started', 'In Progress', 'Complete', 'Failed', 'On Hold'] as TCStatus[]).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Result / Outcome</label>
                <input value={editForm.result} onChange={e => setEditForm(f => ({ ...f, result: e.target.value }))} className={inputCls2} placeholder="Pass / Fail + result details" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={`${inputCls2} resize-none`} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
                <button onClick={saveEdit} className="flex-1 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">Save</button>
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <>
              {comments.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquareIcon size={28} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No comments yet</p>
                </div>
              )}
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="bg-[#0d1628] rounded-xl p-4 border border-[#1e2d4a]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-[#f97316]/20 flex items-center justify-center text-[9px] font-bold text-[#f97316]">
                        {c.user.split(' ').map((w: string) => w[0]).join('')}
                      </div>
                      <span className="text-xs font-semibold text-slate-300">{c.user}</span>
                      <span className="text-[10px] text-slate-600 ml-auto">
                        {new Date(c.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(c.datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addComment())}
                  rows={2} placeholder="Add a comment..."
                  className="flex-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 resize-none" />
                <button onClick={addComment} className="px-3 bg-[#f97316] text-white rounded-lg hover:bg-orange-600 transition-colors self-end py-2">
                  <MessageSquareIcon size={16} />
                </button>
              </div>
            </>
          )}

          {tab === 'files' && (
            <div className="space-y-4">
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map(f => {
                    const isImage = f.type.startsWith('image/');
                    const isPdf = f.type === 'application/pdf';
                    const canPreview = isImage || isPdf;
                    return (
                      <div key={f.id} className="flex items-center gap-3 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 group">
                        {isImage && f.dataUrl ? (
                          <img src={f.dataUrl} alt={f.name} className="w-9 h-9 rounded object-cover shrink-0 cursor-pointer" onClick={() => setFilePreview(f)} />
                        ) : (
                          <div className="w-9 h-9 rounded bg-[#1e2d4a] flex items-center justify-center shrink-0">
                            <Paperclip size={14} className="text-slate-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-300 truncate">{f.name}</p>
                          <p className="text-[10px] text-slate-600">{(f.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canPreview && (
                            <button onClick={() => setFilePreview(f)}
                              className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors" title="Preview">
                              <Eye size={13} />
                            </button>
                          )}
                          {f.dataUrl && (
                            <a href={f.dataUrl} download={f.name}
                              className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors" title="Download">
                              <Download size={13} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <FileUploadComponent files={[]} onChange={newFiles => {
                const existingIds = new Set(files.map(f => f.id));
                const merged = [...files, ...newFiles.filter(f => !existingIds.has(f.id))];
                setFiles(merged);
                onUpdate({ ...record, files: merged });
              }} accept="image/*,.pdf,.doc,.docx" label="Upload test sheets, photos or certificates" />
            </div>
          )}
        </div>
      </div>
      {filePreview && <TCAttachmentPreviewModal file={filePreview} onClose={() => setFilePreview(null)} />}
    </div>
    </>
  );
}

function TCAttachmentPreviewModal({ file, onClose }: { file: UploadedFile; onClose: () => void }) {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-semibold text-white truncate max-w-xs">{file.name}</p>
        <div className="flex items-center gap-2">
          {file.dataUrl && (
            <a href={file.dataUrl} download={file.name}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
              <Download size={13} />Download
            </a>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><X size={18} /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {isImage && file.dataUrl && (
          <img src={file.dataUrl} alt={file.name} className="max-w-full max-h-full object-contain rounded-lg" />
        )}
        {isPdf && file.dataUrl && (
          <iframe src={file.dataUrl} title={file.name} className="w-full h-full rounded-lg border-0" />
        )}
        {!isImage && !isPdf && (
          <div className="text-center">
            <Paperclip size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm mb-4">{file.name}</p>
            {file.dataUrl && (
              <a href={file.dataUrl} download={file.name}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
                <Download size={14} />Download File
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// We need MessageSquare without conflict
const MessageSquareIcon = ({ size, className }: { size?: number; className?: string }) => (
  <svg width={size ?? 24} height={size ?? 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

// ─── Main Page ────────────────────────────────────────────────────────────────


interface TCProps {
  pendingOpen?: { linkedType: string; linkedId: string } | null;
  onPendingOpenConsumed?: () => void;
  pendingFilter?: { filterKey: string; filterValue: string } | null;
  onPendingFilterConsumed?: () => void;
}

const TC_FIELDS: FieldSpec[] = [
  { label: 'Status',    key: 'status' },
  { label: 'Result',    key: 'result' },
  { label: 'Title',     key: 'title' },
  { label: 'Area',      key: 'area' },
  { label: 'Engineer',  key: 'engineer' },
  { label: 'Date',      key: 'date' },
  { label: 'Notes',     key: 'notes', isNarrative: true },
];

export default function TestingCommissioning({ pendingOpen, onPendingOpenConsumed, pendingFilter, onPendingFilterConsumed }: TCProps) {
  const store = useAppStore();
  const orgId = store.currentOrgId ?? '';
  const userName = store.currentUser?.name ?? '';
  const visibleTCRecords = store.visibleProjectIds
    ? store.tcRecords.filter(r => store.visibleProjectIds!.includes(r.project_id))
    : store.tcRecords;
  const records: TCRecord[] = visibleTCRecords.map(dbToTC);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TCRecord | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterProject, setFilterProject] = useState<string>('All');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const perms = usePermissions();
  const isAdmin = store.currentUser?.role === 'Admin';
  const canCreate = perms['commissioning.create'] || isAdmin;
  const canEdit   = perms['commissioning.edit']   || isAdmin;
  const canDelete = perms['commissioning.delete'] || isAdmin;
  const canExport = perms['commissioning.export'] || isAdmin;

  useEffect(() => {
    if (pendingOpen?.linkedType === 'testing' && pendingOpen.linkedId) {
      const dbRecord = store.tcRecords.find(r => r.id === pendingOpen.linkedId);
      if (dbRecord) { setSelectedRecord(dbToTC(dbRecord)); onPendingOpenConsumed?.(); }
    }
  }, [pendingOpen, store.tcRecords, onPendingOpenConsumed]);

  useEffect(() => {
    if (!pendingFilter) return;
    if (pendingFilter.filterKey === 'status') {
      setFilterStatus(pendingFilter.filterValue);
    } else if (pendingFilter.filterKey === 'project') {
      setFilterProject(pendingFilter.filterValue);
    }
    onPendingFilterConsumed?.();
  }, [pendingFilter, onPendingFilterConsumed]);

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const filtered = records.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.ref.toLowerCase().includes(search.toLowerCase()) ||
      r.engineer.toLowerCase().includes(search.toLowerCase()) ||
      r.area.toLowerCase().includes(search.toLowerCase());
    return matchSearch
      && (filterCategory === 'All' || r.category === filterCategory)
      && (filterStatus === 'All' || r.status === filterStatus)
      && (filterProject === 'All' || r.projectId === filterProject);
  });

  const stats = {
    total: records.length,
    complete: records.filter(r => r.status === 'Complete').length,
    inProgress: records.filter(r => r.status === 'In Progress').length,
    failed: records.filter(r => r.status === 'Failed').length,
  };

  const categories = Object.keys(categoryConfig) as TCCategory[];
  const exportRecords = selectMode && selectedIds.size > 0
    ? records.filter(r => selectedIds.has(r.id))
    : filtered;

  const handleExportPDF = () => {
    const rows = exportRecords.map(r => {
      const dateStr = new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
      const resultColor = r.result?.startsWith('Pass') ? '#059669' : r.result?.startsWith('Fail') ? '#dc2626' : '#64748b';
      return `<tr>
        <td style="font-family:monospace;font-size:10px;color:#64748b">${r.ref}</td>
        <td style="font-weight:600">${r.title}</td>
        <td>${r.category}</td>
        <td>${r.projectName}</td>
        <td>${r.area}</td>
        <td>${r.engineer}</td>
        <td>${dateStr}</td>
        <td>${r.status}</td>
        <td style="color:${resultColor}">${r.result || r.notes || '—'}</td>
      </tr>`;
    }).join('');
    const tcRegLogoUrl = store.settings?.logo_data_url;
    const tcRegLogoHtml = tcRegLogoUrl
      ? `<img src="${tcRegLogoUrl}" alt="Logo" style="height:32px;max-width:140px;object-fit:contain;display:block">`
      : `<div class="tc-logo">VYSITE</div>`;
    const styles = `
      table{width:100%;border-collapse:collapse}
      th{background:#f1f5f9;color:#334155;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
      td{padding:8px 10px;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:top;font-size:11px}
      tr:nth-child(even) td{background:#f8fafc}
      .tc-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #f97316}
      .tc-logo{font-size:24px;font-weight:900;color:#f97316;letter-spacing:2px}
      .tc-footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
    `;
    const body = `
      <div class="tc-header">
        <div>${tcRegLogoHtml}</div>
        <div style="text-align:right;font-size:11px;color:#64748b">
          <div>Testing &amp; Commissioning Report</div>
          <div>${today}</div>
          <div>${exportRecords.length} record${exportRecords.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Ref</th><th>Title</th><th>Category</th><th>Project</th><th>Area</th><th>Engineer</th><th>Date</th><th>Status</th><th>Result</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="tc-footer">VY Construction Ltd · ${today}</div>
    `;
    openPrintTab(buildPrintDocument('T&C Report — VYSITE', styles, body));
    logActivity({ orgId, userName, module: 'testing', actionType: 'pdf_exported', description: `${userName} exported ${exportRecords.length} T&C record${exportRecords.length !== 1 ? 's' : ''} to PDF.`, metadata: { count: exportRecords.length, refs: exportRecords.map(r => r.ref) } });
  };

  return (
    <>
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Testing & Commissioning</h2>
          <p className="text-sm text-slate-500">{stats.complete} of {stats.total} records complete · {stats.inProgress} in progress</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${selectMode ? 'bg-[#f97316] text-white border-[#f97316]' : 'bg-[#1a2236] text-slate-300 border-[#1e2d4a] hover:border-[#f97316] hover:text-[#f97316]'}`}>
              <Printer size={15} />{selectMode ? `Export ${selectedIds.size > 0 ? selectedIds.size : 'All'} PDF` : 'Export PDF'}
            </button>
          )}
          {canExport && selectMode && (
            <button onClick={handleExportPDF}
              className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
              <Printer size={15} />Print
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
              <Plus size={16} />New T&C Record
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {([
          { label: 'Total Records', value: stats.total,      color: 'text-white',       filter: 'All' },
          { label: 'Complete',      value: stats.complete,   color: 'text-emerald-400', filter: 'Complete' },
          { label: 'In Progress',   value: stats.inProgress, color: 'text-blue-400',    filter: 'In Progress' },
          { label: 'Failed',        value: stats.failed,     color: 'text-red-400',     filter: 'Failed' },
        ] as const).map(s => {
          const isAll = s.filter === 'All';
          const isActive = isAll
            ? filterStatus === 'All' && filterCategory === 'All' && filterProject === 'All'
            : filterStatus === s.filter;
          return (
            <div key={s.label}
              onClick={() => {
                if (isAll) {
                  setFilterStatus('All');
                  setFilterCategory('All');
                  setFilterProject('All');
                } else {
                  setFilterStatus(isActive ? 'All' : s.filter);
                }
              }}
              className={`bg-[#1a2236] rounded-xl border p-4 text-center cursor-pointer transition-all hover:border-[#2a3d5a] ${isActive ? 'border-[#f97316] ring-1 ring-[#f97316]/20' : 'border-[#1e2d4a]'}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        {categories.map(cat => {
          const cfg = categoryConfig[cat];
          const Icon = cfg.icon;
          const count = records.filter(r => r.category === cat).length;
          return (
            <button key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? 'All' : cat)}
              className={`bg-[#1a2236] rounded-xl border p-3 text-center transition-all hover:border-[#2a3d5a] ${
                filterCategory === cat ? 'border-[#f97316] ring-1 ring-[#f97316]/30' : 'border-[#1e2d4a]'
              }`}>
              <div className={`w-9 h-9 ${cfg.bg} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                <Icon size={17} className={cfg.color} />
              </div>
              <p className="text-[10px] font-semibold text-slate-400 leading-tight">{cat.split(' ').slice(0, 2).join(' ')}</p>
              <p className={`text-sm font-bold mt-0.5 ${cfg.color}`}>{count}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
            <Search size={14} className="text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..."
              className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600" />
          </div>
          <div className="relative">
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="appearance-none bg-[#1a2236] border border-[#1e2d4a] rounded-lg pl-3 pr-8 py-2 text-xs font-semibold text-slate-400 outline-none focus:border-[#f97316] hover:border-slate-600 transition-colors cursor-pointer">
              <option value="All">All Projects</option>
              {(store.visibleProjectIds ? store.projects.filter(p => store.visibleProjectIds!.includes(p.id)) : store.projects).map(p => <option key={p.id} value={p.id}>{p.name.split(' ').slice(0, 3).join(' ')}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          {(filterCategory !== 'All' || filterStatus !== 'All' || filterProject !== 'All') && (
            <button onClick={() => { setFilterCategory('All'); setFilterStatus('All'); setFilterProject('All'); }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <Filter size={12} />Clear
            </button>
          )}
        </div>
        <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
          {['All', 'Not Started', 'In Progress', 'Complete', 'Failed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                filterStatus === s ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Records list */}
      <div className="space-y-3">
        {filtered.map(record => {
          const cfg = categoryConfig[record.category];
          const Icon = cfg.icon;
          const isChecked = selectedIds.has(record.id);
          const commentCount = (record.comments ?? []).length;
          const fileCount = record.files.length;
          return (
            <div key={record.id}
              onClick={() => selectMode ? toggleSelect(record.id) : setSelectedRecord(record)}
              className={`bg-[#1a2236] rounded-xl border border-[#1e2d4a] border-l-4 ${cfg.border} hover:border-[#2a3d5a] transition-all ${selectMode ? 'cursor-default' : 'cursor-pointer'} ${isChecked ? 'ring-1 ring-[#f97316]/40' : ''}`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {selectMode && (
                    <div className="shrink-0 mt-0.5" onClick={e => { e.stopPropagation(); toggleSelect(record.id); }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(record.id)}
                        className="w-4 h-4 rounded accent-orange-500 cursor-pointer" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {/* Top row: icon + title + status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                          <Icon size={13} className={cfg.color} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-[10px] font-mono text-slate-600">{record.ref}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${cfg.bg} ${cfg.color}`}>
                              {record.category.split(' ')[0]}
                            </span>
                          </div>
                          <h3 className="font-semibold text-slate-200 text-sm leading-snug group-hover:text-white transition-colors">{record.title}</h3>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{record.projectName}{record.area ? ` · ${record.area}` : ''}</p>
                        </div>
                      </div>
                      <StatusBadge status={record.status} />
                    </div>
                    {/* Bottom row: engineer + date + counts + actions */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e2d4a]">
                      <span className="text-xs text-slate-500 truncate">Eng: <span className="font-medium text-slate-300">{record.engineer}</span></span>
                      <span className="text-xs text-slate-500 shrink-0">{new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                      <div className="flex items-center gap-2 ml-auto">
                        {commentCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                            <MessageSquareIcon size={11} />{commentCount}
                          </span>
                        )}
                        {fileCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-slate-500 bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">
                            <Paperclip size={9} />{fileCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedRecord(record); }}
                          className="p-1 rounded text-slate-600 hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
                          title="View record"
                        >
                          <Eye size={13} />
                        </button>
                        {canDelete && (
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteConfirm(record.id); }}
                            className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                            title="Delete record"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-14 bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <Activity size={32} className="text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No T&C records found</p>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRecordModal onClose={() => setShowCreate(false)}
          onSave={r => {
            store.addTCRecord(tcToDB(r));
            logActivity({ orgId, userName, module: 'testing', recordId: r.id, recordRef: r.ref, recordType: r.category, projectId: r.projectId, projectName: r.projectName, actionType: 'record_created', description: `${userName} created ${r.category} record ${r.ref} on project ${r.projectName}.` });
          }} />
      )}
      {selectedRecord && (
        <RecordDetail record={selectedRecord} onClose={() => setSelectedRecord(null)}
          onUpdate={updated => {
            const prev = records.find(r => r.id === updated.id);
            const { changesText, fieldDiffs, prevValue, newValue, actionType } = buildDiff(
              (prev ?? {}) as unknown as Record<string, unknown>,
              updated as unknown as Record<string, unknown>,
              TC_FIELDS,
            );
            const changePart = changesText ? ` Changes: ${changesText}.` : '';
            logActivity({ orgId, userName, module: 'testing', recordId: updated.id, recordRef: updated.ref, recordType: updated.category, projectId: updated.projectId, projectName: updated.projectName, actionType, description: `${userName} updated ${updated.category} ${updated.ref} "${updated.title}" on project ${updated.projectName}.${changePart}`, prevValue, newValue, metadata: fieldDiffs.length ? { diffs: fieldDiffs } : null });
            store.updateTCRecord(tcToDB(updated));
            setSelectedRecord(updated);
          }}
          canEdit={canEdit}
          canExport={canExport}
        />
      )}
      {deleteConfirm && (
        <ConfirmDeleteModal
          title="Delete T&C Record"
          description="This testing & commissioning record will be permanently deleted."
          onConfirm={async () => {
            const target = records.find(r => r.id === deleteConfirm);
            if (target) {
              await logActivity({ orgId, userName, module: 'testing', recordId: target.id, recordRef: target.ref, recordType: target.category, projectId: target.projectId, projectName: target.projectName, actionType: 'record_deleted', description: `${userName} deleted T&C record ${target.ref} on project ${target.projectName}.` });
            }
            store.removeTCRecord(deleteConfirm);
            setDeleteConfirm(null);
            if (selectedRecord?.id === deleteConfirm) setSelectedRecord(null);
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
    </>
  );
}
