import { useState } from 'react';
import {
  Plus, X, Search, ChevronDown, Wrench, AlertTriangle, Clock, CheckCircle2,
  Filter, Printer, Trash2, Eye, Download, Paperclip, MessageSquare,
  Package, FileText, User, MapPin, Phone, Calendar, ArrowRight, Archive,
} from 'lucide-react';
import { openPrintTab, buildPrintDocument } from '../lib/printTab';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import FileUploadComponent, { type UploadedFile } from '../components/FileUpload';
import type { DBMaintenanceJob, MaintenanceStatus, MaintenancePriority, MaintenanceMaterial, MaintenanceComment } from '../lib/store';
import { logActivity, buildDiff, type FieldSpec } from '../lib/activityLog';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_ORDER: MaintenanceStatus[] = [
  'New Job',
  'Engineer Allocated',
  'Site Visit Booked',
  'Attended',
  'Awaiting Decision',
  'Awaiting Quote Approval',
  'Awaiting Materials',
  'Materials Ordered',
  'Reattend Required',
  'Follow-Up Required',
  'Job Complete',
  'Ready to Invoice',
  'Invoiced',
  'Closed / Complete',
  'Cancelled',
];

const CLOSED_STATUSES: MaintenanceStatus[] = ['Invoiced', 'Closed / Complete', 'Cancelled'];

const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  'New Job':                'bg-slate-700 text-slate-300',
  'Engineer Allocated':     'bg-blue-900/60 text-blue-400',
  'Site Visit Booked':      'bg-sky-900/60 text-sky-400',
  'Attended':               'bg-indigo-900/60 text-sky-300',
  'Awaiting Decision':      'bg-amber-900/60 text-amber-400',
  'Awaiting Quote Approval':'bg-yellow-900/60 text-yellow-400',
  'Awaiting Materials':     'bg-orange-900/60 text-orange-400',
  'Materials Ordered':      'bg-orange-900/40 text-orange-300',
  'Reattend Required':      'bg-rose-900/60 text-rose-400',
  'Follow-Up Required':     'bg-pink-900/60 text-pink-400',
  'Job Complete':           'bg-teal-900/60 text-teal-400',
  'Ready to Invoice':       'bg-cyan-900/60 text-cyan-400',
  'Invoiced':               'bg-emerald-900/60 text-emerald-400',
  'Closed / Complete':      'bg-emerald-900/80 text-emerald-300',
  'Cancelled':              'bg-slate-800 text-slate-500',
};

const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  Low:      'bg-slate-700/60 text-slate-400 border-slate-600',
  Medium:   'bg-blue-900/60 text-blue-400 border-blue-700',
  High:     'bg-amber-900/60 text-amber-400 border-amber-700',
  Critical: 'bg-red-900/60 text-red-400 border-red-700',
};

const PRIORITY_DOT: Record<MaintenancePriority, string> = {
  Low:      'bg-slate-500',
  Medium:   'bg-blue-400',
  High:     'bg-amber-400',
  Critical: 'bg-red-500',
};

const PRIORITY_BORDER: Record<MaintenancePriority, string> = {
  Low:      'border-l-slate-600',
  Medium:   'border-l-blue-700',
  High:     'border-l-amber-600',
  Critical: 'border-l-red-600',
};

const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateJobNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Date.now()).slice(-4);
  return `MNT-${yy}${mm}-${seq}`;
}

function isClosedJob(status: MaintenanceStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

// ─── Status/Priority badges ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: MaintenanceStatus }) {
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: MaintenancePriority }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${PRIORITY_COLORS[priority]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[priority]}`} />
      {priority}
    </span>
  );
}

// ─── Create Job Modal ─────────────────────────────────────────────────────────

interface CreateJobModalProps {
  onClose: () => void;
  onSave: (job: DBMaintenanceJob) => void;
  engineers: string[];
}

function CreateJobModal({ onClose, onSave, engineers }: CreateJobModalProps) {
  const store = useAppStore();
  const [form, setForm] = useState({
    client_name: '',
    site_address: '',
    contact_name: '',
    contact_number: '',
    assigned_engineer: '',
    description: '',
    priority: 'Medium' as MaintenancePriority,
    target_date: '',
    internal_notes: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const allEngineers = [
    ...engineers,
    ...store.platformUsers.filter(u => u.role === 'Engineer' || u.role === 'Site Manager').map(u => u.name),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: `mnt${Date.now()}`,
      job_number: generateJobNumber(),
      client_name: form.client_name,
      site_address: form.site_address,
      contact_name: form.contact_name,
      contact_number: form.contact_number,
      assigned_engineer: form.assigned_engineer,
      description: form.description,
      priority: form.priority,
      status: form.assigned_engineer ? 'Engineer Allocated' : 'New Job',
      engineer_notes: '',
      internal_notes: form.internal_notes,
      materials: [],
      comments: [],
      target_date: form.target_date,
      completion_date: '',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <h2 className="text-lg font-bold text-white">New Maintenance Job</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Client Name *</label>
              <input required value={form.client_name} onChange={set('client_name')} className={inputCls} placeholder="Client or company name" />
            </div>
            <div>
              <label className={labelCls}>Priority *</label>
              <div className="relative">
                <select value={form.priority} onChange={set('priority')} className={`${inputCls} appearance-none pr-8`}>
                  {(['Low', 'Medium', 'High', 'Critical'] as MaintenancePriority[]).map(p => <option key={p}>{p}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls}>Site Address *</label>
            <input required value={form.site_address} onChange={set('site_address')} className={inputCls} placeholder="Full site address" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Contact Name</label>
              <input value={form.contact_name} onChange={set('contact_name')} className={inputCls} placeholder="On-site contact" />
            </div>
            <div>
              <label className={labelCls}>Contact Number</label>
              <input value={form.contact_number} onChange={set('contact_number')} className={inputCls} placeholder="Phone number" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description of Work *</label>
            <textarea required value={form.description} onChange={set('description')} rows={3} className={`${inputCls} resize-none`} placeholder="Describe the fault, issue, or work required..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Assigned Engineer</label>
              <div className="relative">
                <select value={form.assigned_engineer} onChange={set('assigned_engineer')} className={`${inputCls} appearance-none pr-8`}>
                  <option value="">Unassigned</option>
                  {allEngineers.map(e => <option key={e}>{e}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Target Date</label>
              <input type="date" value={form.target_date} onChange={set('target_date')} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Internal Notes</label>
            <textarea value={form.internal_notes} onChange={set('internal_notes')} rows={2} className={`${inputCls} resize-none`} placeholder="Visible to office staff only..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">Create Job</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Job Detail Modal ─────────────────────────────────────────────────────────

interface JobDetailProps {
  job: DBMaintenanceJob;
  onClose: () => void;
  onUpdate: (j: DBMaintenanceJob) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canComment: boolean;
  canUpload: boolean;
  canComplete: boolean;
  canExport: boolean;
  engineers: string[];
}

function buildJobPrintHTML(job: DBMaintenanceJob, today: string): string {
  const statusColor = isClosedJob(job.status) ? '#059669' : job.status === 'Reattend Required' || job.status === 'Cancelled' ? '#dc2626' : '#f97316';
  const materialsRows = job.materials.map(m =>
    `<tr><td>${m.item}</td><td style="text-align:center">${m.qty}</td><td>${m.unit}</td></tr>`
  ).join('');
  const styles = `
    .mj-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #f97316}
    .mj-logo{font-size:22px;font-weight:900;color:#f97316;letter-spacing:.05em;margin-bottom:4px}
    .mj-sub{font-size:13px;font-weight:700;color:#1e293b}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
    .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px}
    .field{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px}
    .field-lbl{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
    .field-val{font-size:12px;font-weight:600;color:#1e293b}
    .section-title{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;margin-top:16px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th{background:#f1f5f9;color:#334155;font-size:10px;font-weight:700;padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
    td{padding:7px 10px;color:#1e293b;border-bottom:1px solid #f1f5f9;font-size:11px}
    .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0}
    .sig-label{font-size:10px;font-weight:700;color:#64748b;margin-bottom:28px}
    .sig-line{border-bottom:1px solid #94a3b8;margin-bottom:4px}
    .sig-hint{font-size:10px;color:#94a3b8}
    .footer{margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
  `;
  const body = `
    <div class="mj-header">
      <div><div class="mj-logo">VYSITE</div><div class="mj-sub">Maintenance &amp; Servicing Job Sheet</div></div>
      <div style="text-align:right;font-size:11px;color:#64748b">
        <div style="font-weight:700;color:#f97316;margin-bottom:2px">${job.job_number}</div>
        <div>Issued: ${today}</div>
        <div style="margin-top:2px;font-weight:600;color:${statusColor}">${job.status}</div>
      </div>
    </div>
    <div class="grid3">
      <div class="field"><div class="field-lbl">Client</div><div class="field-val">${job.client_name}</div></div>
      <div class="field"><div class="field-lbl">Priority</div><div class="field-val">${job.priority}</div></div>
      <div class="field"><div class="field-lbl">Assigned Engineer</div><div class="field-val">${job.assigned_engineer || '—'}</div></div>
    </div>
    <div class="grid2">
      <div class="field"><div class="field-lbl">Site Address</div><div class="field-val">${job.site_address}</div></div>
      <div class="field"><div class="field-lbl">Contact</div><div class="field-val">${job.contact_name || '—'}${job.contact_number ? ` · ${job.contact_number}` : ''}</div></div>
    </div>
    <div class="grid2">
      <div class="field"><div class="field-lbl">Target Date</div><div class="field-val">${job.target_date ? new Date(job.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</div></div>
      <div class="field"><div class="field-lbl">Completion Date</div><div class="field-val">${job.completion_date ? new Date(job.completion_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</div></div>
    </div>
    <div class="section-title">Description of Work</div>
    <div style="padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;color:#334155;line-height:1.6;margin-bottom:12px">${job.description}</div>
    ${job.engineer_notes ? `<div class="section-title">Engineer Notes</div><div style="padding:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:12px;color:#334155;line-height:1.6;margin-bottom:12px">${job.engineer_notes}</div>` : ''}
    ${job.materials.length > 0 ? `
    <div class="section-title">Materials Used</div>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Unit</th></tr></thead>
      <tbody>${materialsRows}</tbody>
    </table>` : ''}
    ${!isClosedJob(job.status) ? `
    <div class="sig-grid">
      <div><div class="sig-label">Engineer Sign-Off</div><div class="sig-line"></div><div class="sig-hint">Signature &amp; Date</div></div>
      <div><div class="sig-label">Client Sign-Off</div><div class="sig-line"></div><div class="sig-hint">Signature &amp; Date</div></div>
    </div>` : ''}
    <div class="footer">VY Construction Ltd · Generated by VYSITE · ${today}</div>
  `;
  return buildPrintDocument(`Job Sheet — ${job.job_number}`, styles, body);
}

function JobDetail({ job, onClose, onUpdate, onDelete, canEdit, canDelete, canAssign, canComment, canUpload, canComplete, canExport, engineers }: JobDetailProps) {
  const store = useAppStore();
  const [tab, setTab] = useState<'details' | 'notes' | 'materials' | 'files'>('details');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    client_name: job.client_name,
    site_address: job.site_address,
    contact_name: job.contact_name,
    contact_number: job.contact_number,
    description: job.description,
    priority: job.priority,
    target_date: job.target_date,
    completion_date: job.completion_date,
  });
  const [assigned, setAssigned] = useState(job.assigned_engineer);
  const [engineerNotes, setEngineerNotes] = useState(job.engineer_notes);
  const [internalNotes, setInternalNotes] = useState(job.internal_notes);
  const [materials, setMaterials] = useState<MaintenanceMaterial[]>(job.materials ?? []);
  const [newMat, setNewMat] = useState({ item: '', qty: '', unit: '' });
  const [comments, setComments] = useState<MaintenanceComment[]>(job.comments ?? []);
  const [newComment, setNewComment] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [filePreview, setFilePreview] = useState<UploadedFile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const isClosed = isClosedJob(job.status);

  const allEngineers = [
    ...engineers,
    ...store.platformUsers.filter(u => u.role === 'Engineer' || u.role === 'Site Manager').map(u => u.name),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const updateJob = (patch: Partial<DBMaintenanceJob>) => {
    const updated = { ...job, ...patch, comments, materials, engineer_notes: engineerNotes, internal_notes: internalNotes, assigned_engineer: assigned };
    onUpdate({ ...updated, ...patch });
  };

  const changeStatus = (s: MaintenanceStatus) => {
    const patch: Partial<DBMaintenanceJob> = { status: s };
    if (isClosedJob(s) && !job.completion_date) {
      patch.completion_date = new Date().toISOString().split('T')[0];
    }
    updateJob(patch);
  };

  const saveEdit = () => {
    updateJob({ ...editForm });
    setEditing(false);
  };

  const saveNotes = () => {
    updateJob({ engineer_notes: engineerNotes, internal_notes: internalNotes, assigned_engineer: assigned });
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    const c: MaintenanceComment = {
      id: `c${Date.now()}`,
      user: store.currentUser?.name ?? '',
      datetime: new Date().toISOString(),
      text: newComment.trim(),
      type: 'comment',
    };
    const next = [...comments, c];
    setComments(next);
    onUpdate({ ...job, comments: next });
    setNewComment('');
  };

  const addMaterial = () => {
    if (!newMat.item.trim()) return;
    const m: MaintenanceMaterial = { id: `m${Date.now()}`, ...newMat };
    const next = [...materials, m];
    setMaterials(next);
    onUpdate({ ...job, materials: next });
    setNewMat({ item: '', qty: '', unit: '' });
  };

  const removeMaterial = (id: string) => {
    const next = materials.filter(m => m.id !== id);
    setMaterials(next);
    onUpdate({ ...job, materials: next });
  };

  const inputCls2 = 'mt-1 w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';

  return (
    <>
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#1e2d4a] shrink-0">
          <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isClosed ? 'bg-emerald-900/60' : 'bg-orange-900/60'}`}>
              {isClosed ? <CheckCircle2 size={17} className="text-emerald-400" /> : <Wrench size={17} className="text-orange-400" />}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-500">{job.job_number}</span>
              <h2 className="text-base font-bold text-white leading-snug truncate">{job.client_name}</h2>
              <p className="text-xs text-slate-500 truncate">{job.site_address}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {canExport && (
              <button onClick={() => openPrintTab(buildJobPrintHTML(job, today))}
                title="Export job sheet PDF"
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
            {canDelete && (
              <button onClick={() => setDeleteConfirm(true)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors">
                <Trash2 size={15} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2d4a] shrink-0 overflow-x-auto">
          {(['details', 'notes', 'materials', 'files'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setEditing(false); }}
              className={`px-5 py-3 text-xs font-semibold transition-colors capitalize border-b-2 -mb-px whitespace-nowrap ${
                tab === t ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}>
              {t}
              {t === 'materials' && materials.length > 0 && <span className="ml-1 bg-slate-700 text-slate-300 text-[9px] px-1.5 py-0.5 rounded-full">{materials.length}</span>}
              {t === 'files' && files.length > 0 && <span className="ml-1 bg-slate-700 text-slate-300 text-[9px] px-1.5 py-0.5 rounded-full">{files.length}</span>}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* ── Details tab ── */}
          {tab === 'details' && !editing && (
            <>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={job.status} />
                <PriorityBadge priority={job.priority} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Client', value: job.client_name, icon: User },
                  { label: 'Assigned Engineer', value: job.assigned_engineer || 'Unassigned', icon: Wrench },
                  { label: 'Site Address', value: job.site_address, icon: MapPin },
                  { label: 'Contact', value: job.contact_name ? `${job.contact_name}${job.contact_number ? ` · ${job.contact_number}` : ''}` : '—', icon: Phone },
                  { label: 'Target Date', value: job.target_date ? new Date(job.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—', icon: Calendar },
                  { label: 'Completion Date', value: job.completion_date ? new Date(job.completion_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—', icon: CheckCircle2 },
                ].map(item => (
                  <div key={item.label} className="bg-[#0d1628] rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-slate-200">{item.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-slate-400 leading-relaxed">{job.description}</p>
              </div>

              {/* Status change */}
              {canComplete && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Update Status</p>
                  <div className="relative">
                    <select value={job.status} onChange={e => changeStatus(e.target.value as MaintenanceStatus)}
                      className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] appearance-none pr-8">
                      {STATUS_ORDER.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                  {/* Quick next-step buttons for active jobs */}
                  {!isClosed && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {STATUS_ORDER.filter(s => s !== job.status && !isClosedJob(s)).slice(0, 4).map(s => (
                        <button key={s} onClick={() => changeStatus(s)}
                          className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg text-[10px] font-semibold border bg-[#0d1628] text-slate-400 border-[#1e2d4a] hover:border-slate-500 hover:text-slate-200 transition-colors">
                          <ArrowRight size={10} />{s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Engineer assignment */}
              {canAssign && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assign Engineer</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select value={assigned} onChange={e => setAssigned(e.target.value)}
                        className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] appearance-none pr-8">
                        <option value="">Unassigned</option>
                        {allEngineers.map(eng => <option key={eng}>{eng}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    <button onClick={() => updateJob({ assigned_engineer: assigned, status: assigned && job.status === 'New Job' ? 'Engineer Allocated' : job.status })}
                      className="px-3 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Comments */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Comments {comments.length > 0 && <span className="text-[#f97316] normal-case font-normal">({comments.length})</span>}
                </p>
                {comments.length === 0 && <p className="text-xs text-slate-600 mb-2">No comments yet</p>}
                <div className="space-y-2 mb-3">
                  {comments.map(c => (
                    <div key={c.id} className="bg-[#0d1628] rounded-xl p-3 border border-[#1e2d4a]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-5 h-5 rounded-full bg-[#f97316]/20 flex items-center justify-center text-[8px] font-bold text-[#f97316]">
                          {c.user.split(' ').map((w: string) => w[0]).join('')}
                        </div>
                        <span className="text-xs font-semibold text-slate-300">{c.user}</span>
                        <span className="text-[10px] text-slate-600 ml-auto">
                          {new Date(c.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} {new Date(c.datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed">{c.text}</p>
                    </div>
                  ))}
                </div>
                {canComment && (
                  <div className="flex gap-2">
                    <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addComment())}
                      rows={2} placeholder="Add a comment..."
                      className="flex-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 resize-none" />
                    <button onClick={addComment} className="px-3 bg-[#f97316] text-white rounded-lg hover:bg-orange-600 transition-colors self-end py-2">
                      <MessageSquare size={15} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'details' && editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Client Name</label>
                  <input value={editForm.client_name} onChange={e => setEditForm(f => ({ ...f, client_name: e.target.value }))} className={inputCls2} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</label>
                  <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as MaintenancePriority }))} className={inputCls2}>
                    {(['Low', 'Medium', 'High', 'Critical'] as MaintenancePriority[]).map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Site Address</label>
                <input value={editForm.site_address} onChange={e => setEditForm(f => ({ ...f, site_address: e.target.value }))} className={inputCls2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Name</label>
                  <input value={editForm.contact_name} onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))} className={inputCls2} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Number</label>
                  <input value={editForm.contact_number} onChange={e => setEditForm(f => ({ ...f, contact_number: e.target.value }))} className={inputCls2} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className={`${inputCls2} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Date</label>
                  <input type="date" value={editForm.target_date} onChange={e => setEditForm(f => ({ ...f, target_date: e.target.value }))} className={inputCls2} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completion Date</label>
                  <input type="date" value={editForm.completion_date} onChange={e => setEditForm(f => ({ ...f, completion_date: e.target.value }))} className={inputCls2} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
                <button onClick={saveEdit} className="flex-1 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">Save</button>
              </div>
            </div>
          )}

          {/* ── Notes tab ── */}
          {tab === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Engineer Notes</label>
                <p className="text-[10px] text-slate-600 mb-1.5">Visible to engineers on site — job details, access instructions, reference info.</p>
                <textarea value={engineerNotes} onChange={e => setEngineerNotes(e.target.value)}
                  rows={5} placeholder="Enter engineer notes..."
                  disabled={!canEdit}
                  className={`mt-1 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 resize-none ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Internal Notes</label>
                <p className="text-[10px] text-slate-600 mb-1.5">Office use only — not shown to engineers or clients.</p>
                <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
                  rows={5} placeholder="Enter internal notes..."
                  disabled={!canEdit}
                  className={`mt-1 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 resize-none ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`} />
              </div>
              {canEdit && (
                <button onClick={saveNotes} className="w-full py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
                  Save Notes
                </button>
              )}
            </div>
          )}

          {/* ── Materials tab ── */}
          {tab === 'materials' && (
            <div className="space-y-3">
              {materials.length === 0 && (
                <div className="text-center py-8 bg-[#0d1628] rounded-xl border border-[#1e2d4a]">
                  <Package size={24} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No materials logged yet</p>
                </div>
              )}
              {materials.length > 0 && (
                <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1e2d4a]">
                        <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Item</th>
                        <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Qty</th>
                        <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Unit</th>
                        {canEdit && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map(m => (
                        <tr key={m.id} className="border-b border-[#1e2d4a] last:border-0">
                          <td className="px-4 py-3 text-slate-200 font-medium">{m.item}</td>
                          <td className="px-4 py-3 text-slate-300">{m.qty}</td>
                          <td className="px-4 py-3 text-slate-400">{m.unit}</td>
                          {canEdit && (
                            <td className="px-4 py-3">
                              <button onClick={() => removeMaterial(m.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                                <X size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {canEdit && (
                <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Add Material</p>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={newMat.item} onChange={e => setNewMat(m => ({ ...m, item: e.target.value }))}
                      placeholder="Item description"
                      className="col-span-3 bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600" />
                    <input value={newMat.qty} onChange={e => setNewMat(m => ({ ...m, qty: e.target.value }))}
                      placeholder="Qty"
                      className="bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600" />
                    <input value={newMat.unit} onChange={e => setNewMat(m => ({ ...m, unit: e.target.value }))}
                      placeholder="Unit (e.g. m, nr, kg)"
                      className="bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600" />
                    <button onClick={addMaterial} className="bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Files tab ── */}
          {tab === 'files' && (
            <div className="space-y-3">
              {files.length === 0 && (
                <div className="text-center py-8 bg-[#0d1628] rounded-xl border border-[#1e2d4a]">
                  <Paperclip size={24} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No files uploaded yet</p>
                </div>
              )}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map(f => {
                    const isImage = f.type.startsWith('image/');
                    const isPdf = f.type === 'application/pdf';
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
                          {(isImage || isPdf) && (
                            <button onClick={() => setFilePreview(f)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors">
                              <Eye size={13} />
                            </button>
                          )}
                          {f.dataUrl && (
                            <a href={f.dataUrl} download={f.name} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors">
                              <Download size={13} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {canUpload && (
                <FileUploadComponent files={[]} onChange={newFiles => {
                  const existingIds = new Set(files.map(f => f.id));
                  setFiles(prev => [...prev, ...newFiles.filter(f => !existingIds.has(f.id))]);
                }} accept="image/*,.pdf,.doc,.docx" label="Upload photos, reports or documentation" />
              )}
            </div>
          )}
        </div>
      </div>

      {filePreview && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col" onClick={() => setFilePreview(null)}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-white truncate max-w-xs">{filePreview.name}</p>
            <div className="flex items-center gap-2">
              {filePreview.dataUrl && (
                <a href={filePreview.dataUrl} download={filePreview.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
                  <Download size={13} />Download
                </a>
              )}
              <button onClick={() => setFilePreview(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><X size={18} /></button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            {filePreview.type.startsWith('image/') && filePreview.dataUrl && (
              <img src={filePreview.dataUrl} alt={filePreview.name} className="max-w-full max-h-full object-contain rounded-lg" />
            )}
            {filePreview.type === 'application/pdf' && filePreview.dataUrl && (
              <iframe src={filePreview.dataUrl} title={filePreview.name} className="w-full h-full rounded-lg border-0" />
            )}
          </div>
        </div>
      )}
    </div>

    {deleteConfirm && (
      <ConfirmDeleteModal
        title="Delete Maintenance Job"
        description={`Job ${job.job_number} will be permanently deleted.`}
        onConfirm={() => { onDelete(job.id); onClose(); }}
        onCancel={() => setDeleteConfirm(false)}
      />
    )}
    </>
  );
}

// ─── Job row card ─────────────────────────────────────────────────────────────

interface JobRowProps {
  job: DBMaintenanceJob;
  onOpen: () => void;
  onDelete: () => void;
  canDelete: boolean;
  dimmed?: boolean;
}

function JobRow({ job, onOpen, onDelete, canDelete, dimmed }: JobRowProps) {
  const commentCount = (job.comments ?? []).length;
  const materialCount = (job.materials ?? []).length;
  const isClosed = isClosedJob(job.status);

  return (
    <div
      onClick={onOpen}
      className={`bg-[#1a2236] rounded-xl border border-[#1e2d4a] border-l-4 cursor-pointer hover:border-[#2a3d5a] transition-all ${PRIORITY_BORDER[job.priority]} ${dimmed ? 'opacity-70' : ''}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isClosed ? 'bg-emerald-900/60' : 'bg-orange-900/60'}`}>
              {isClosed ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Wrench size={15} className="text-orange-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-[10px] font-mono text-slate-500">{job.job_number}</span>
                <PriorityBadge priority={job.priority} />
              </div>
              <h3 className="font-semibold text-slate-200 text-sm">{job.client_name}</h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{job.site_address}</p>
            </div>
          </div>
          <StatusBadge status={job.status} />
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e2d4a]">
          {job.assigned_engineer ? (
            <span className="text-xs text-slate-500 truncate">
              <span className="font-medium text-slate-300">{job.assigned_engineer}</span>
            </span>
          ) : (
            <span className="text-xs text-amber-500 flex items-center gap-1">
              <AlertTriangle size={11} />Unassigned
            </span>
          )}
          {job.target_date && (
            <span className="text-xs text-slate-500 shrink-0 flex items-center gap-1">
              <Clock size={11} />{new Date(job.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {commentCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                <MessageSquare size={11} />{commentCount}
              </span>
            )}
            {materialCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-slate-500 bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">
                <Package size={9} />{materialCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={e => { e.stopPropagation(); onOpen(); }}
              className="p-1 rounded text-slate-600 hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors">
              <Eye size={13} />
            </button>
            {canDelete && (
              <button onClick={e => { e.stopPropagation(); onDelete(); }}
                className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const MAINTENANCE_FIELDS: FieldSpec[] = [
  { label: 'Status',            key: 'status' },
  { label: 'Priority',          key: 'priority' },
  { label: 'Assigned Engineer', key: 'assigned_engineer' },
  { label: 'Description',       key: 'description' },
  { label: 'Client',            key: 'client_name' },
  { label: 'Site Address',      key: 'site_address' },
  { label: 'Target Date',       key: 'target_date' },
  { label: 'Completion Date',   key: 'completion_date' },
];

export default function MaintenanceServicing() {
  const store = useAppStore();
  const perms = usePermissions();
  const isAdmin = store.currentUser?.role === 'Admin';
  const canCreate  = perms['maintenance.create']  || isAdmin;
  const canEdit    = perms['maintenance.edit']    || isAdmin;
  const canDelete  = perms['maintenance.delete']  || isAdmin;
  const canAssign  = perms['maintenance.assign']  || isAdmin;
  const canExport  = perms['maintenance.export']  || isAdmin;
  const canComment = perms['maintenance.comment'] || isAdmin;
  const canUpload  = perms['maintenance.upload']  || isAdmin;
  const canComplete = perms['maintenance.complete'] || isAdmin;
  const orgId = store.currentOrgId ?? '';
  const userName = store.currentUser?.name ?? '';

  const jobs = store.maintenanceJobs;

  const [showCreate, setShowCreate] = useState(false);
  const [selectedJob, setSelectedJob] = useState<DBMaintenanceJob | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterEngineer, setFilterEngineer] = useState<string>('All');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showClosedJobs, setShowClosedJobs] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const engineers = [
    ...store.platformUsers.filter(u => u.role === 'Engineer' || u.role === 'Site Manager').map(u => u.name),
    ...jobs.map(j => j.assigned_engineer).filter(Boolean),
  ].filter((v, i, a) => v && a.indexOf(v) === i) as string[];

  const matchesFilters = (j: DBMaintenanceJob) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      j.job_number.toLowerCase().includes(q) ||
      j.client_name.toLowerCase().includes(q) ||
      j.site_address.toLowerCase().includes(q) ||
      j.assigned_engineer.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'All' || j.status === filterStatus;
    const matchPriority = filterPriority === 'All' || j.priority === filterPriority;
    const matchEngineer = filterEngineer === 'All' || j.assigned_engineer === filterEngineer;
    const matchDateFrom = !filterDateFrom || (j.target_date && j.target_date >= filterDateFrom);
    const matchDateTo = !filterDateTo || (j.target_date && j.target_date <= filterDateTo);
    return matchSearch && matchStatus && matchPriority && matchEngineer && matchDateFrom && matchDateTo;
  };

  const activeJobs = jobs.filter(j => !isClosedJob(j.status) && matchesFilters(j));
  const closedJobs = jobs.filter(j => isClosedJob(j.status) && matchesFilters(j));

  const allActive = jobs.filter(j => !isClosedJob(j.status));
  const allClosed = jobs.filter(j => isClosedJob(j.status));

  const stats = {
    total: allActive.length,
    critical: allActive.filter(j => j.priority === 'Critical').length,
    unassigned: allActive.filter(j => !j.assigned_engineer).length,
    closed: allClosed.length,
  };

  const hasFilters = search || filterStatus !== 'All' || filterPriority !== 'All' || filterEngineer !== 'All' || filterDateFrom || filterDateTo;

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('All');
    setFilterPriority('All');
    setFilterEngineer('All');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const handleExportPDF = (exportList: DBMaintenanceJob[], title: string) => {
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const rows = exportList.map(j => {
      const priorityColor = j.priority === 'Critical' ? '#dc2626' : j.priority === 'High' ? '#f59e0b' : '#64748b';
      const targetStr = j.target_date ? new Date(j.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
      return `<tr>
        <td style="font-family:monospace;font-size:10px;color:#64748b">${j.job_number}</td>
        <td style="font-weight:600">${j.client_name}</td>
        <td>${j.site_address}</td>
        <td style="color:${priorityColor};font-weight:600">${j.priority}</td>
        <td>${j.assigned_engineer || '—'}</td>
        <td>${targetStr}</td>
        <td>${j.status}</td>
      </tr>`;
    }).join('');
    const styles = `
      table{width:100%;border-collapse:collapse}
      th{background:#f1f5f9;color:#334155;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
      td{padding:8px 10px;color:#1e293b;border-bottom:1px solid #f1f5f9;font-size:11px}
      tr:nth-child(even) td{background:#f8fafc}
      .hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #f97316}
      .logo{font-size:24px;font-weight:900;color:#f97316;letter-spacing:2px}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
    `;
    const body = `
      <div class="hdr">
        <div class="logo">VYSITE</div>
        <div style="text-align:right;font-size:11px;color:#64748b">
          <div>${title}</div>
          <div>${today}</div>
          <div>${exportList.length} job${exportList.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Job No.</th><th>Client</th><th>Site</th><th>Priority</th><th>Engineer</th><th>Target</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">VY Construction Ltd · ${today}</div>
    `;
    openPrintTab(buildPrintDocument('Maintenance Register — VYSITE', styles, body));
  };

  return (
    <>
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Maintenance &amp; Servicing</h2>
          <p className="text-sm text-slate-500">
            {stats.total} active job{stats.total !== 1 ? 's' : ''}
            {stats.critical > 0 && <span className="text-red-400"> · {stats.critical} critical</span>}
            {stats.unassigned > 0 && <span className="text-amber-400"> · {stats.unassigned} unassigned</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <button onClick={() => handleExportPDF(activeJobs.length > 0 ? activeJobs : allActive, 'Maintenance Register')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border bg-[#1a2236] text-slate-300 border-[#1e2d4a] hover:border-[#f97316] hover:text-[#f97316] transition-colors">
              <Printer size={15} />Export PDF
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
              <Plus size={16} />New Job
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {([
          { label: 'Active Jobs',  value: stats.total,      color: 'text-white',       onClick: () => { setFilterStatus('All'); setShowClosedJobs(false); } },
          { label: 'Critical',     value: stats.critical,   color: 'text-red-400',     onClick: () => { setFilterPriority(filterPriority === 'Critical' ? 'All' : 'Critical'); } },
          { label: 'Unassigned',   value: stats.unassigned, color: 'text-amber-400',   onClick: () => {} },
          { label: 'Closed Jobs',  value: stats.closed,     color: 'text-emerald-400', onClick: () => setShowClosedJobs(v => !v) },
        ] as const).map(s => (
          <div key={s.label}
            onClick={s.onClick}
            className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-4 text-center cursor-pointer transition-all hover:border-[#2a3d5a]">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="space-y-3 mb-5">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search job no., client, address, engineer..."
              className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600" />
            {search && <button onClick={() => setSearch('')} className="text-slate-600 hover:text-slate-300"><X size={13} /></button>}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${showFilters || hasFilters ? 'bg-[#f97316]/10 border-[#f97316] text-[#f97316]' : 'bg-[#1a2236] border-[#1e2d4a] text-slate-400 hover:border-slate-600'}`}>
            <Filter size={14} />Filters{hasFilters && <span className="text-[10px] bg-[#f97316] text-white rounded-full w-4 h-4 flex items-center justify-center">!</span>}
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors px-2">
              <X size={12} />Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Status</label>
              <div className="relative">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="w-full appearance-none bg-[#0d1628] border border-[#1e2d4a] rounded-lg pl-3 pr-7 py-2 text-xs text-slate-300 outline-none focus:border-[#f97316]">
                  <option value="All">All Statuses</option>
                  {STATUS_ORDER.map(s => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Priority</label>
              <div className="relative">
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                  className="w-full appearance-none bg-[#0d1628] border border-[#1e2d4a] rounded-lg pl-3 pr-7 py-2 text-xs text-slate-300 outline-none focus:border-[#f97316]">
                  <option value="All">All Priorities</option>
                  {(['Low', 'Medium', 'High', 'Critical'] as MaintenancePriority[]).map(p => <option key={p}>{p}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Engineer</label>
              <div className="relative">
                <select value={filterEngineer} onChange={e => setFilterEngineer(e.target.value)}
                  className="w-full appearance-none bg-[#0d1628] border border-[#1e2d4a] rounded-lg pl-3 pr-7 py-2 text-xs text-slate-300 outline-none focus:border-[#f97316]">
                  <option value="All">All Engineers</option>
                  {engineers.map(e => <option key={e}>{e}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Target Date</label>
              <div className="flex gap-1.5 items-center">
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                  className="flex-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-2 py-2 text-xs text-slate-300 outline-none focus:border-[#f97316]" />
                <span className="text-slate-600 text-xs shrink-0">—</span>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                  className="flex-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-2 py-2 text-xs text-slate-300 outline-none focus:border-[#f97316]" />
              </div>
            </div>
          </div>
        )}

        {/* Status quick-strip */}
        <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
          {(['All', ...STATUS_ORDER.filter(s => !isClosedJob(s as MaintenanceStatus))] as string[]).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                filterStatus === s ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Active Jobs */}
      <div className="space-y-3">
        {activeJobs.map(job => (
          <JobRow key={job.id}
            job={job}
            onOpen={() => setSelectedJob(job)}
            onDelete={() => setDeleteConfirm(job.id)}
            canDelete={canDelete}
          />
        ))}

        {activeJobs.length === 0 && !hasFilters && allActive.length === 0 && (
          <div className="text-center py-14 bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <Wrench size={32} className="text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No active maintenance jobs</p>
            {canCreate && (
              <button onClick={() => setShowCreate(true)}
                className="mt-3 flex items-center gap-2 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors mx-auto">
                <Plus size={15} />Create first job
              </button>
            )}
          </div>
        )}

        {activeJobs.length === 0 && hasFilters && (
          <div className="text-center py-10 bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <Search size={24} className="text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No jobs match your filters</p>
            <button onClick={clearFilters} className="mt-2 text-xs text-[#f97316] hover:underline">Clear filters</button>
          </div>
        )}
      </div>

      {/* Closed / Completed Jobs section */}
      <div className="mt-6">
        <button
          onClick={() => setShowClosedJobs(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#1a2236] border border-[#1e2d4a] rounded-xl hover:border-[#2a3d5a] transition-colors group"
        >
          <div className="flex items-center gap-2.5">
            <Archive size={15} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
            <span className="text-sm font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
              Closed &amp; Completed Jobs
            </span>
            <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
              {closedJobs.length}{hasFilters && allClosed.length !== closedJobs.length ? ` / ${allClosed.length}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canExport && closedJobs.length > 0 && (
              <button onClick={e => { e.stopPropagation(); handleExportPDF(closedJobs, 'Closed Jobs Register'); }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-[#f97316] rounded-lg hover:bg-[#f97316]/10 transition-colors">
                <Printer size={12} />Export
              </button>
            )}
            <ChevronDown size={15} className={`text-slate-500 transition-transform ${showClosedJobs ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {showClosedJobs && (
          <div className="mt-3 space-y-3">
            {closedJobs.length === 0 && (
              <div className="text-center py-8 bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
                <CheckCircle2 size={24} className="text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No closed jobs{hasFilters ? ' match your filters' : ' yet'}</p>
              </div>
            )}
            {closedJobs.map(job => (
              <JobRow key={job.id}
                job={job}
                onOpen={() => setSelectedJob(job)}
                onDelete={() => setDeleteConfirm(job.id)}
                canDelete={canDelete}
                dimmed
              />
            ))}
          </div>
        )}
      </div>
    </div>

    {showCreate && (
      <CreateJobModal
        onClose={() => setShowCreate(false)}
        onSave={j => {
          store.addMaintenanceJob(j);
          logActivity({ orgId, userName, module: 'maintenance', recordId: j.id, recordRef: j.job_number ?? j.id, recordType: 'Maintenance Job', actionType: 'record_created', description: `${userName} created maintenance job ${j.job_number ?? j.id} — ${j.description ?? j.client_name}.` });
        }}
        engineers={engineers}
      />
    )}

    {selectedJob && (
      <JobDetail
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onUpdate={updated => {
          const prev = selectedJob;
          store.updateMaintenanceJob(updated);
          setSelectedJob(updated);
          const { changesText, prevValue, newValue, actionType } = buildDiff(
            prev as unknown as Record<string, unknown>,
            updated as unknown as Record<string, unknown>,
            MAINTENANCE_FIELDS,
          );
          const changePart = changesText ? ` Changes: ${changesText}.` : '';
          logActivity({ orgId, userName, module: 'maintenance', recordId: updated.id, recordRef: updated.job_number ?? updated.id, recordType: 'Maintenance Job', actionType, description: `${userName} updated Maintenance Job ${updated.job_number ?? updated.id} — ${updated.description ?? updated.client_name}.${changePart}`, prevValue, newValue });
        }}
        onDelete={id => {
          const target = store.maintenanceJobs.find(j => j.id === id);
          logActivity({ orgId, userName, module: 'maintenance', recordId: id, recordRef: target?.job_number ?? id, recordType: 'Maintenance Job', actionType: 'record_deleted', description: `${userName} deleted maintenance job ${target?.job_number ?? id} — ${target?.description ?? target?.client_name ?? ''}.` });
          store.removeMaintenanceJob(id);
          setSelectedJob(null);
        }}
        canEdit={canEdit}
        canDelete={canDelete}
        canAssign={canAssign}
        canComment={canComment}
        canUpload={canUpload}
        canComplete={canComplete}
        canExport={canExport}
        engineers={engineers}
      />
    )}

    {deleteConfirm && (
      <ConfirmDeleteModal
        title="Delete Maintenance Job"
        description="This job and all its data will be permanently deleted."
        onConfirm={() => {
          const target = store.maintenanceJobs.find(j => j.id === deleteConfirm);
          logActivity({ orgId, userName, module: 'maintenance', recordId: deleteConfirm, recordRef: target?.job_number ?? deleteConfirm, recordType: 'Maintenance Job', actionType: 'record_deleted', description: `${userName} deleted maintenance job ${target?.job_number ?? deleteConfirm} — ${target?.description ?? target?.client_name ?? ''}.` });
          store.removeMaintenanceJob(deleteConfirm);
          setDeleteConfirm(null);
          if (selectedJob?.id === deleteConfirm) setSelectedJob(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    )}
    </>
  );
}
