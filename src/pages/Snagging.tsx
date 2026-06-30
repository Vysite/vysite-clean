import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, X, MessageSquare, Search, CheckCircle, AlertTriangle, Clock, AlertCircle, FileText, Printer, Trash2, Eye, Download, File, Image, Paperclip, CreditCard as Edit2, TrendingUp, ClipboardList, Camera, Copy } from 'lucide-react';
import { openPrintTab } from '../lib/printTab';
import { buildSnaggingReportPageHTML, SNAGGING_PDF_CSS, renderSnaggingReportPDF } from '../forms/SnaggingPDF';
import type { SnagItemForPDF, AttachmentForPDF } from '../forms/SnaggingPDF';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import type { DBAttachment, DBSnaggingReport } from '../lib/store';
import type { Snag, SnagPriority, SnagStatus } from '../data/types';
import type { UploadedFile } from '../components/FileUpload';
import FileUploadComponent from '../components/FileUpload';
import { logActivity, buildDiff, type FieldSpec } from '../lib/activityLog';
import MentionTextarea, { renderWithMentions } from '../components/MentionTextarea';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { RowActionsMenu } from '../components/RowActionsMenu';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRADES = ['Mechanical', 'Electrical', 'Builders Work', 'Fire', 'HVAC', 'Plumbing', 'Decoration', 'General'] as const;
const RESPONSIBLE_PARTIES = ['Main Contractor', 'Subcontractor', 'Client', 'Supplier', 'Other'] as const;
const EXTENDED_STATUSES = ['Open', 'In Progress', 'Awaiting Review', 'Closed'] as const;
type ExtendedStatus = typeof EXTENDED_STATUSES[number];

// ─── Extended Snag type (extra fields stored in extra_data via store) ──────────

interface ExtendedSnag extends Omit<Snag, 'status'> {
  status: ExtendedStatus;
  snagNumber?: string;
  reportId?: string;
  trade?: string;
  rectification?: string;
  responsibleParty?: string;
  targetCompletionDate?: string;
  closedBy?: string;
  closedDate?: string;
  closureComments?: string;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const priorityStyle: Record<SnagPriority, { dot: string; badge: string; border: string }> = {
  Critical: { dot: 'bg-red-500',    badge: 'bg-red-900/60 text-red-400 border border-red-800/60',       border: 'border-l-red-500' },
  High:     { dot: 'bg-orange-400', badge: 'bg-orange-900/60 text-orange-400 border border-orange-800/60', border: 'border-l-orange-400' },
  Medium:   { dot: 'bg-amber-400',  badge: 'bg-amber-900/60 text-amber-400 border border-amber-800/60',  border: 'border-l-amber-400' },
  Low:      { dot: 'bg-slate-600',  badge: 'bg-slate-700/60 text-slate-400 border border-slate-600/60',  border: 'border-l-slate-600' },
};

const statusStyle: Record<ExtendedStatus, string> = {
  'Open':            'bg-red-900/50 text-red-400',
  'In Progress':     'bg-blue-900/50 text-blue-400',
  'Awaiting Review': 'bg-amber-900/50 text-amber-400',
  'Closed':          'bg-emerald-900/50 text-emerald-400',
};

const REPORT_STATUSES = ['Draft', 'In Progress', 'Submitted', 'Approved', 'Closed'] as const;

const reportStatusStyle: Record<string, string> = {
  Draft:       'bg-slate-700/50 text-slate-400',
  'In Progress':'bg-blue-900/50 text-blue-400',
  Submitted:   'bg-amber-900/50 text-amber-400',
  Approved:    'bg-teal-900/50 text-teal-400',
  Closed:      'bg-emerald-900/50 text-emerald-400',
};

interface ReportStatusDropdownProps {
  status: string;
  canEdit: boolean;
  onChange: (s: string) => void;
}
function ReportStatusDropdown({ status, canEdit, onChange }: ReportStatusDropdownProps) {
  const cls = reportStatusStyle[status] ?? 'bg-slate-700/50 text-slate-400';
  if (!canEdit) {
    return <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
  }
  return (
    <select
      value={status}
      onClick={e => e.stopPropagation()}
      onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
      className={`text-[9px] font-bold px-2 py-0.5 rounded-full cursor-pointer outline-none appearance-none ${cls} hover:opacity-80 transition-opacity`}
      style={{ backgroundImage: 'none' }}
    >
      {REPORT_STATUSES.map(s => (
        <option key={s} value={s} className="bg-[#1a2236] text-slate-200 text-xs font-normal">{s}</option>
      ))}
    </select>
  );
}

function PriorityBadge({ p }: { p: SnagPriority }) {
  return <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${priorityStyle[p]?.badge ?? 'bg-slate-700 text-slate-400'}`}>{p}</span>;
}
function StatusBadge({ s }: { s: string }) {
  const cls = statusStyle[s as ExtendedStatus] ?? 'bg-slate-700/50 text-slate-400';
  return <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{s}</span>;
}

// ─── Shared input / label classes ─────────────────────────────────────────────

const inputCls  = 'mt-1 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
const selectCls = `${inputCls} appearance-none`;
const labelCls  = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider';

// ─── Attachment preview list ──────────────────────────────────────────────────

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttListProps { atts: DBAttachment[]; onRemove: (id: string) => void }
function AttList({ atts, onRemove }: AttListProps) {
  const store = useAppStore();
  const [preview, setPreview] = useState<DBAttachment | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  if (!atts.length) return null;

  const openPreview = async (att: DBAttachment) => {
    if (att.data_url) { setPreview(att); return; }
    setLoadingId(att.id);
    const url = await store.fetchAttachmentData(att.id);
    setLoadingId(null);
    setPreview({ ...att, data_url: url });
  };

  return (
    <>
      <div className="space-y-1.5">
        {atts.map(att => {
          const isImg = att.type.startsWith('image/');
          return (
            <div key={att.id} className="flex items-center gap-2.5 bg-[#0d1628] rounded-lg p-2 border border-[#1e2d4a] group">
              <div className="w-7 h-7 rounded bg-[#111827] border border-[#1e2d4a] flex items-center justify-center shrink-0 cursor-pointer overflow-hidden" onClick={() => openPreview(att)}>
                {loadingId === att.id
                  ? <div className="w-3 h-3 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" />
                  : isImg && att.data_url
                    ? <img src={att.data_url} alt={att.name} className="w-full h-full object-cover" />
                    : att.type === 'application/pdf'
                      ? <FileText size={12} className="text-red-400" />
                      : <File size={12} className="text-slate-500" />
                }
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openPreview(att)}>
                <p className="text-xs font-medium text-slate-300 line-clamp-1">{att.name}</p>
                <p className="text-[10px] text-slate-600">{formatBytes(att.size)}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openPreview(att)} className="p-1 text-slate-500 hover:text-slate-300"><Eye size={12} /></button>
                <button onClick={() => onRemove(att.id)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            </div>
          );
        })}
      </div>
      {preview && (
        <div className="fixed inset-0 bg-black/90 z-[80] flex flex-col" onClick={() => setPreview(null)}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-white truncate max-w-sm">{preview.name}</p>
            <div className="flex items-center gap-2">
              {preview.data_url && (
                <a href={preview.data_url} download={preview.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600">
                  <Download size={12} />Download
                </a>
              )}
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"><X size={16} /></button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            {preview.type.startsWith('image/') && preview.data_url
              ? <img src={preview.data_url} alt={preview.name} className="max-w-full max-h-full object-contain rounded-lg" />
              : <div className="text-center"><Paperclip size={32} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400 text-sm">{preview.name}</p></div>
            }
          </div>
        </div>
      )}
    </>
  );
}

// ─── Report Header form ───────────────────────────────────────────────────────

interface ReportFormData {
  title: string; projectId: string; projectName: string;
  areaBlock: string; floorLocation: string; inspectionDate: string;
  inspector: string; contractor: string; client: string;
  status: string; overallCompletionPct: number; notes: string;
}

interface ReportModalProps {
  initial?: DBSnaggingReport | null;
  onClose: () => void;
  onSave: (data: ReportFormData) => void;
}

function ReportModal({ initial, onClose, onSave }: ReportModalProps) {
  const store = useAppStore();
  const [form, setForm] = useState<ReportFormData>({
    title: initial?.title ?? '',
    projectId: initial?.project_id ?? '',
    projectName: initial?.project_name ?? '',
    areaBlock: initial?.area_block ?? '',
    floorLocation: initial?.floor_location ?? '',
    inspectionDate: initial?.inspection_date ?? new Date().toISOString().split('T')[0],
    inspector: initial?.inspector ?? store.currentUser?.name ?? '',
    contractor: initial?.contractor ?? '',
    client: initial?.client ?? '',
    status: initial?.status ?? 'Draft',
    overallCompletionPct: initial?.overall_completion_pct ?? 0,
    notes: initial?.notes ?? '',
  });

  const set = (k: keyof ReportFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const proj = store.projects.find(p => p.id === form.projectId || p.name === form.projectName);
    onSave({ ...form, projectId: proj?.id ?? form.projectId, projectName: proj?.name ?? form.projectName });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a] shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">{initial ? 'Edit Report' : 'New Snagging Report'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Fill in the report header — you can add snag items after saving</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a]"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Report Title *</label>
              <input required value={form.title} onChange={set('title')} className={inputCls} placeholder="e.g. Block A Snagging — Practical Completion" />
            </div>
            <div>
              <label className={labelCls}>Project *</label>
              <select required value={form.projectId} onChange={e => {
                const proj = store.projects.find(p => p.id === e.target.value);
                setForm(f => ({ ...f, projectId: e.target.value, projectName: proj?.name ?? '' }));
              }} className={selectCls}>
                <option value="">Select project...</option>
                {store.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Inspection Date</label>
              <input type="date" value={form.inspectionDate} onChange={set('inspectionDate')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Area / Block</label>
              <input value={form.areaBlock} onChange={set('areaBlock')} className={inputCls} placeholder="e.g. Block A" />
            </div>
            <div>
              <label className={labelCls}>Floor / Location</label>
              <input value={form.floorLocation} onChange={set('floorLocation')} className={inputCls} placeholder="e.g. Level 02 — Plant Room" />
            </div>
            <div>
              <label className={labelCls}>Inspector</label>
              <input value={form.inspector} onChange={set('inspector')} className={inputCls} placeholder="Name" />
            </div>
            <div>
              <label className={labelCls}>Contractor</label>
              <input value={form.contractor} onChange={set('contractor')} className={inputCls} placeholder="Company name" />
            </div>
            <div>
              <label className={labelCls}>Client</label>
              <input value={form.client} onChange={set('client')} className={inputCls} placeholder="Client name" />
            </div>
            <div>
              <label className={labelCls}>Report Status</label>
              <select value={form.status} onChange={set('status')} className={selectCls}>
                {['Draft', 'In Progress', 'Submitted', 'Approved', 'Closed'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3} className={`${inputCls} resize-none`} placeholder="Any general notes about this inspection..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a]">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600">
              {initial ? 'Save Changes' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Snag Item Form ───────────────────────────────────────────────────────────

interface SnagFormData {
  title: string; location: string; trade: string; priority: SnagPriority;
  description: string; rectification: string; responsibleParty: string;
  assignedTo: string; targetCompletionDate: string; status: ExtendedStatus;
}

interface SnagModalProps {
  initial?: ExtendedSnag | null;
  reportId: string;
  projectId: string;
  projectName: string;
  snagNumber: string;
  onClose: () => void;
  onSave: (data: SnagFormData, files: UploadedFile[]) => void;
}

function SnagModal({ initial, reportId: _reportId, projectName, snagNumber, onClose, onSave }: SnagModalProps) {
  const [form, setForm] = useState<SnagFormData>({
    title: initial?.title ?? '',
    location: initial?.location ?? '',
    trade: initial?.trade ?? '',
    priority: initial?.priority ?? 'Medium',
    description: initial?.description ?? '',
    rectification: initial?.rectification ?? '',
    responsibleParty: initial?.responsibleParty ?? '',
    assignedTo: initial?.assignedTo ?? '',
    targetCompletionDate: initial?.targetCompletionDate ?? initial?.dueDate ?? '',
    status: (initial?.status as ExtendedStatus) ?? 'Open',
  });
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const set = (k: keyof SnagFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form, files);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a] shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-slate-500 bg-[#0d1628] px-2 py-1 rounded-lg">{snagNumber}</span>
            <h2 className="text-sm font-bold text-white">{initial ? 'Edit Snag' : 'Add Snag Item'}</h2>
            {projectName && <span className="text-xs text-slate-500">{projectName}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className={labelCls}>Issue Title *</label>
            <input required value={form.title} onChange={set('title')} className={inputCls} placeholder="Brief description of the defect" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Trade</label>
              <select value={form.trade} onChange={set('trade')} className={selectCls}>
                <option value="">Select...</option>
                {TRADES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={set('priority')} className={selectCls}>
                {(['Critical', 'High', 'Medium', 'Low'] as SnagPriority[]).map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={set('status')} className={selectCls}>
                {EXTENDED_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Location</label>
              <input value={form.location} onChange={set('location')} className={inputCls} placeholder="Block / Level / Room" />
            </div>
            <div>
              <label className={labelCls}>Target Completion Date</label>
              <input type="date" value={form.targetCompletionDate} onChange={set('targetCompletionDate')} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Issue Description *</label>
            <textarea required value={form.description} onChange={set('description')} rows={3} className={`${inputCls} resize-none`} placeholder="Describe what is wrong in detail..." />
          </div>
          <div>
            <label className={labelCls}>Required Rectification</label>
            <textarea value={form.rectification} onChange={set('rectification')} rows={2} className={`${inputCls} resize-none`} placeholder="What must be done to resolve this issue..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Responsible Party</label>
              <select value={form.responsibleParty} onChange={set('responsibleParty')} className={selectCls}>
                <option value="">Select...</option>
                {RESPONSIBLE_PARTIES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Assigned To</label>
              <input value={form.assignedTo} onChange={set('assignedTo')} className={inputCls} placeholder="Person or company" />
            </div>
          </div>
          <div className="border-t border-[#1e2d4a] pt-4">
            <label className={labelCls}>Evidence Photos</label>
            <div className="mt-1.5">
              <FileUploadComponent files={files} onChange={setFiles} label="Drop photos or files here" maxFiles={20} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a]">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600">
              {initial ? 'Save Changes' : 'Add Snag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Closure Modal ────────────────────────────────────────────────────────────

interface ClosureModalProps {
  snag: ExtendedSnag;
  onClose: () => void;
  onSave: (closedBy: string, closedDate: string, comments: string, files: UploadedFile[]) => void;
}

function ClosureModal({ snag, onClose, onSave }: ClosureModalProps) {
  const store = useAppStore();
  const [closedBy, setClosedBy] = useState(snag.closedBy ?? store.currentUser?.name ?? '');
  const [closedDate, setClosedDate] = useState(snag.closedDate ?? new Date().toISOString().split('T')[0]);
  const [comments, setComments] = useState(snag.closureComments ?? '');
  const [files, setFiles] = useState<UploadedFile[]>([]);

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
          <div>
            <h2 className="text-sm font-bold text-white">Close Snag</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[320px]">{snag.snagNumber} — {snag.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Closed By</label>
              <input value={closedBy} onChange={e => setClosedBy(e.target.value)} className={inputCls} placeholder="Name" />
            </div>
            <div>
              <label className={labelCls}>Closed Date</label>
              <input type="date" value={closedDate} onChange={e => setClosedDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Closure Comments</label>
            <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Describe how the issue was resolved..." />
          </div>
          <div>
            <label className={labelCls}>Closure Photos</label>
            <div className="mt-1.5">
              <FileUploadComponent files={files} onChange={setFiles} label="Drop closure photos here" maxFiles={10} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a]">Cancel</button>
            <button onClick={() => { onSave(closedBy, closedDate, comments, files); onClose(); }}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2">
              <CheckCircle size={15} />Close Snag
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Snag Detail Drawer ───────────────────────────────────────────────────────

interface SnagDetailProps {
  snag: ExtendedSnag;
  reportId: string;
  projectName: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (s: ExtendedSnag) => void;
  canEdit: boolean;
  canDelete: boolean;
}

function SnagDetail({ snag, projectName, onClose, onEdit, onDelete, onUpdate, canEdit, canDelete }: SnagDetailProps) {
  const store = useAppStore();
  const [tab, setTab] = useState<'details' | 'comments' | 'files'>('details');
  const [newComment, setNewComment] = useState('');
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showClosure, setShowClosure] = useState(false);

  const snagAtts = useMemo(
    () => store.attachments.filter(a => a.linked_type === 'snag' && a.linked_id === snag.id),
    [store.attachments, snag.id]
  );

  const handleUpload = async () => {
    if (!pendingFiles.length) return;
    setUploading(true);
    for (const f of pendingFiles) {
      const att: DBAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        linked_type: 'snag', linked_id: snag.id,
        project_id: snag.projectId, project_name: snag.projectName,
        name: f.name, type: f.type, size: f.size,
        category: f.type.startsWith('image/') ? 'Photo' : 'Other',
        data_url: f.dataUrl ?? '',
        uploaded_by: store.currentUser?.name ?? '',
        created_at: new Date().toISOString(),
      };
      await store.addAttachment(att);
    }
    setPendingFiles([]);
    setUploading(false);
  };

  const isClosed = snag.status === 'Closed';

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[#1e2d4a] shrink-0">
            <div className="flex-1 min-w-0 pr-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] font-bold text-slate-500 bg-[#0d1628] px-2 py-0.5 rounded">{snag.snagNumber ?? snag.id}</span>
                <PriorityBadge p={snag.priority} />
                <StatusBadge s={snag.status} />
              </div>
              <h2 className="text-sm font-bold text-white leading-snug">{snag.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{projectName}{snag.location ? ` · ${snag.location}` : ''}{snag.trade ? ` · ${snag.trade}` : ''}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canEdit && !isClosed && (
                <button onClick={() => setShowClosure(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/40 border border-emerald-700/50 text-emerald-400 rounded-lg text-xs font-semibold hover:bg-emerald-800/50 transition-colors">
                  <CheckCircle size={12} />Close
                </button>
              )}
              {canEdit && (
                <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d4a] text-slate-300 rounded-lg text-xs font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors">
                  <Edit2 size={12} />Edit
                </button>
              )}
              {canDelete && (
                <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d4a] text-slate-400 rounded-lg text-xs font-semibold hover:border-red-500 hover:text-red-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a]"><X size={16} /></button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#1e2d4a] shrink-0">
            {(['details', 'comments', 'files'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2.5 text-xs font-semibold border-b-2 -mb-px capitalize transition-colors ${tab === t ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                {t}
                {t === 'comments' && snag.comments.length > 0 && <span className="ml-1.5 bg-[#f97316]/20 text-[#f97316] text-[9px] px-1.5 py-0.5 rounded-full">{snag.comments.length}</span>}
                {t === 'files' && snagAtts.length > 0 && <span className="ml-1.5 bg-slate-700 text-slate-300 text-[9px] px-1.5 py-0.5 rounded-full">{snagAtts.length}</span>}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            {/* Details tab */}
            {tab === 'details' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { l: 'Trade', v: snag.trade },
                    { l: 'Responsible Party', v: snag.responsibleParty },
                    { l: 'Assigned To', v: snag.assignedTo },
                    { l: 'Raised By', v: snag.raisedBy },
                    { l: 'Raised Date', v: snag.raisedDate ? new Date(snag.raisedDate).toLocaleDateString('en-GB') : '' },
                    { l: 'Target Completion', v: snag.targetCompletionDate ? new Date(snag.targetCompletionDate).toLocaleDateString('en-GB') : snag.dueDate ? new Date(snag.dueDate).toLocaleDateString('en-GB') : '' },
                  ].filter(x => x.v).map(x => (
                    <div key={x.l} className="bg-[#0d1628] rounded-lg p-2.5">
                      <p className={`${labelCls} mb-1`}>{x.l}</p>
                      <p className="text-xs font-medium text-slate-300">{x.v}</p>
                    </div>
                  ))}
                </div>
                {snag.description && (
                  <div>
                    <p className={`${labelCls} mb-1.5`}>Issue Description</p>
                    <p className="text-sm text-slate-400 leading-relaxed bg-[#0d1628] rounded-lg p-3">{snag.description}</p>
                  </div>
                )}
                {snag.rectification && (
                  <div>
                    <p className={`${labelCls} mb-1.5`}>Required Rectification</p>
                    <p className="text-sm text-slate-400 leading-relaxed bg-[#0d1628] rounded-lg p-3">{snag.rectification}</p>
                  </div>
                )}
                {isClosed && (snag.closedBy || snag.closureComments) && (
                  <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-4">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Closure Record</p>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      {snag.closedBy && <div><p className={`${labelCls} mb-0.5`}>Closed By</p><p className="text-xs text-slate-300">{snag.closedBy}</p></div>}
                      {snag.closedDate && <div><p className={`${labelCls} mb-0.5`}>Closed Date</p><p className="text-xs text-slate-300">{new Date(snag.closedDate).toLocaleDateString('en-GB')}</p></div>}
                    </div>
                    {snag.closureComments && <p className="text-xs text-slate-400">{snag.closureComments}</p>}
                  </div>
                )}
                {!isClosed && canEdit && (
                  <div>
                    <p className={`${labelCls} mb-2`}>Update Status</p>
                    <div className="flex gap-2">
                      {EXTENDED_STATUSES.filter(s => s !== 'Closed').map(s => (
                        <button key={s} onClick={() => onUpdate({ ...snag, status: s as SnagStatus })}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${snag.status === s
                            ? s === 'Open' ? 'bg-red-600 text-white border-red-600'
                              : s === 'In Progress' ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-amber-600 text-white border-amber-600'
                            : 'bg-[#0d1628] text-slate-400 border-[#1e2d4a] hover:border-slate-500'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Comments tab */}
            {tab === 'comments' && (
              <>
                {snag.comments.length === 0
                  ? <div className="text-center py-8"><MessageSquare size={24} className="text-slate-700 mx-auto mb-2" /><p className="text-sm text-slate-600">No comments yet</p></div>
                  : <div className="space-y-2">{snag.comments.map((c, i) => (
                      <div key={i} className="bg-[#0d1628] rounded-lg p-3 border-l-2 border-[#1e2d4a]">
                        <p className="text-sm text-slate-400">{renderWithMentions(c)}</p>
                      </div>
                    ))}</div>
                }
                <MentionTextarea value={newComment} onChange={setNewComment}
                  onSubmit={text => { onUpdate({ ...snag, comments: [...snag.comments, text] }); setNewComment(''); }}
                  linkedType="snag" linkedId={snag.id} projectId={snag.projectId} projectName={snag.projectName} />
              </>
            )}

            {/* Files tab */}
            {tab === 'files' && (
              <div className="space-y-4">
                {snagAtts.length > 0 && (
                  <div>
                    <p className={`${labelCls} mb-2`}>Saved ({snagAtts.length})</p>
                    <AttList atts={snagAtts} onRemove={id => store.removeAttachment(id)} />
                  </div>
                )}
                <div>
                  <p className={`${labelCls} mb-2`}>Add Photos / Files</p>
                  <FileUploadComponent files={pendingFiles} onChange={setPendingFiles} label="Drop files or photos here" maxFiles={20} />
                  {pendingFiles.length > 0 && (
                    <button onClick={handleUpload} disabled={uploading}
                      className="mt-3 flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-60">
                      <Camera size={14} />{uploading ? 'Saving...' : `Save ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}`}
                    </button>
                  )}
                  {!snagAtts.length && !pendingFiles.length && (
                    <div className="text-center py-8"><Image size={24} className="text-slate-700 mx-auto mb-2" /><p className="text-sm text-slate-600">No files yet</p></div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showClosure && (
        <ClosureModal snag={snag} onClose={() => setShowClosure(false)}
          onSave={async (closedBy, closedDate, comments, closureFiles) => {
            // Save closure photos as attachments with category 'Closure Photo'
            for (const f of closureFiles) {
              const att: DBAttachment = {
                id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                linked_type: 'snag', linked_id: snag.id,
                project_id: snag.projectId, project_name: snag.projectName,
                name: f.name, type: f.type, size: f.size,
                category: 'Closure Photo',
                data_url: f.dataUrl ?? '',
                uploaded_by: store.currentUser?.name ?? '',
                created_at: new Date().toISOString(),
              };
              await store.addAttachment(att);
            }
            onUpdate({ ...snag, status: 'Closed', closedBy, closedDate, closureComments: comments });
          }} />
      )}
    </>
  );
}

// ─── Report Detail View ───────────────────────────────────────────────────────

interface ReportViewProps {
  report: DBSnaggingReport;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canCreate: boolean;
}

const SNAG_FIELDS: FieldSpec[] = [
  { label: 'Status',              key: 'status' },
  { label: 'Priority',            key: 'priority' },
  { label: 'Title',               key: 'title' },
  { label: 'Location',            key: 'location' },
  { label: 'Trade',               key: 'trade' },
  { label: 'Assigned To',         key: 'assignedTo' },
  { label: 'Responsible Party',   key: 'responsibleParty' },
  { label: 'Target Completion',   key: 'targetCompletionDate' },
  { label: 'Description',         key: 'description',    isNarrative: true },
  { label: 'Rectification',       key: 'rectification',  isNarrative: true },
];

function ReportView({ report, onClose, onEdit, onDelete, canEdit, canDelete, canExport, canCreate }: ReportViewProps) {
  const store   = useAppStore();
  const orgId   = store.currentOrgId ?? '';
  const userName = store.currentUser?.name ?? '';
  const orgSettings = { company_name: store.settings?.company_name ?? '', logo_data_url: store.settings?.logo_data_url ?? '' };

  const snags = useMemo(
    () => (store.snags as ExtendedSnag[]).filter(s => s.reportId === report.id)
          .sort((a, b) => (a.snagNumber ?? '').localeCompare(b.snagNumber ?? '')),
    [store.snags, report.id]
  );

  const [showSnagModal, setShowSnagModal] = useState(false);
  const [editingSnag, setEditingSnag] = useState<ExtendedSnag | null>(null);
  const [selectedSnag, setSelectedSnag] = useState<ExtendedSnag | null>(null);
  const [deleteSnagId, setDeleteSnagId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');

  const stats = useMemo(() => ({
    total: snags.length,
    open: snags.filter(s => s.status === 'Open').length,
    inProg: snags.filter(s => s.status === 'In Progress').length,
    review: snags.filter(s => s.status === 'Awaiting Review').length,
    closed: snags.filter(s => s.status === 'Closed').length,
    overdue: snags.filter(s => s.status !== 'Closed' && s.dueDate && new Date(s.dueDate) < new Date()).length,
  }), [snags]);

  const filtered = useMemo(() => snags.filter(s => {
    if (filterStatus !== 'All' && s.status !== filterStatus) return false;
    if (filterPriority !== 'All' && s.priority !== filterPriority) return false;
    return true;
  }), [snags, filterStatus, filterPriority]);

  const nextSnagNumber = useCallback(() => {
    const nums = snags.map(s => {
      const m = s.snagNumber?.match(/SN-(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const max = nums.length ? Math.max(...nums) : 0;
    return `SN-${String(max + 1).padStart(3, '0')}`;
  }, [snags]);

  const handleSaveSnag = async (data: SnagFormData, files: UploadedFile[]) => {
    const snagNum = editingSnag?.snagNumber ?? nextSnagNumber();
    const id = editingSnag?.id ?? `snag-${Date.now()}`;
    const snag: ExtendedSnag = {
      id,
      projectId: report.project_id,
      projectName: report.project_name,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: data.status as SnagStatus,
      assignedTo: data.assignedTo,
      raisedBy: store.currentUser?.name ?? '',
      raisedDate: editingSnag?.raisedDate ?? new Date().toISOString().split('T')[0],
      dueDate: data.targetCompletionDate,
      location: data.location,
      comments: editingSnag?.comments ?? [],
      snagNumber: snagNum,
      reportId: report.id,
      trade: data.trade,
      rectification: data.rectification,
      responsibleParty: data.responsibleParty,
      targetCompletionDate: data.targetCompletionDate,
    };
    if (editingSnag) {
      const { changesText, fieldDiffs, prevValue, newValue, actionType } = buildDiff(
        editingSnag as unknown as Record<string, unknown>,
        snag as unknown as Record<string, unknown>,
        SNAG_FIELDS,
      );
      store.updateSnag(snag as Snag);
      const changePart = changesText ? ` Changes: ${changesText}.` : '';
      logActivity({ orgId, userName, module: 'snagging', recordId: snag.id, recordRef: snagNum, recordType: 'Snag', projectId: report.project_id, projectName: report.project_name, actionType, description: `${userName} updated Snag ${snagNum} "${snag.title}" on project ${report.project_name}.${changePart}`, prevValue, newValue, metadata: fieldDiffs.length ? { diffs: fieldDiffs } : null });
    } else {
      await store.addSnag(snag as Snag);
      logActivity({ orgId, userName, module: 'snagging', recordId: snag.id, recordRef: snagNum, recordType: 'Snag', projectId: report.project_id, projectName: report.project_name, actionType: 'record_created', description: `${userName} created Snag ${snagNum} "${snag.title}" on project ${report.project_name}.` });
    }
    if (files.length > 0) {
      for (const f of files) {
        const att: DBAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          linked_type: 'snag', linked_id: id,
          project_id: report.project_id, project_name: report.project_name,
          name: f.name, type: f.type, size: f.size,
          category: f.type.startsWith('image/') ? 'Photo' : 'Other',
          data_url: f.dataUrl ?? '',
          uploaded_by: store.currentUser?.name ?? '',
          created_at: new Date().toISOString(),
        };
        await store.addAttachment(att);
      }
    }
    setEditingSnag(null);
  };

  const handleExportPDF = () => {
    const snagItems: SnagItemForPDF[] = snags.map(s => {
      const atts = store.attachments.filter(a => a.linked_type === 'snag' && a.linked_id === s.id);
      const photos: AttachmentForPDF[] = atts
        .filter(a => a.type.startsWith('image/') && a.category !== 'Closure Photo')
        .map(a => ({ id: a.id, name: a.name, type: a.type, data_url: a.data_url, category: a.category }));
      const closurePhotos: AttachmentForPDF[] = atts
        .filter(a => a.category === 'Closure Photo')
        .map(a => ({ id: a.id, name: a.name, type: a.type, data_url: a.data_url, category: a.category }));
      return {
        id: s.id,
        snagNumber: s.snagNumber,
        title: s.title,
        location: s.location,
        trade: s.trade,
        priority: s.priority,
        status: s.status,
        description: s.description,
        rectification: s.rectification,
        responsibleParty: s.responsibleParty,
        assignedTo: s.assignedTo,
        raisedBy: s.raisedBy,
        raisedDate: s.raisedDate,
        targetCompletionDate: s.targetCompletionDate ?? s.dueDate,
        dueDate: s.dueDate,
        comments: s.comments,
        closedBy: s.closedBy,
        closedDate: s.closedDate,
        closureComments: s.closureComments,
        photos,
        closurePhotos,
      };
    });
    renderSnaggingReportPDF(report, snagItems, orgSettings);
  };

  // live-sync selected snag
  const liveSnag = selectedSnag ? (store.snags as ExtendedSnag[]).find(s => s.id === selectedSnag.id) ?? selectedSnag : null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4">
        <div className="bg-[#0f1929] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[#1e2d4a] shrink-0">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${report.status === 'Closed' ? 'bg-emerald-900/50 text-emerald-400' : report.status === 'Approved' ? 'bg-teal-900/50 text-teal-400' : report.status === 'Submitted' ? 'bg-blue-900/50 text-blue-400' : 'bg-slate-700/60 text-slate-400'}`}>{report.status}</span>
                {report.project_name && <span className="text-xs text-slate-500">{report.project_name}</span>}
              </div>
              <h2 className="text-base font-bold text-white leading-snug">{report.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {report.area_block && `${report.area_block} `}
                {report.floor_location && `· ${report.floor_location} `}
                {report.inspector && `· ${report.inspector}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {canExport && (
                <button onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d4a] text-slate-300 rounded-lg text-xs font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors">
                  <Printer size={13} />PDF
                </button>
              )}
              {canEdit && (
                <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d4a] text-slate-300 rounded-lg text-xs font-semibold hover:border-slate-500 transition-colors">
                  <Edit2 size={13} />Edit
                </button>
              )}
              {canDelete && (
                <button onClick={onDelete} className="p-1.5 rounded-lg border border-[#1e2d4a] text-slate-400 hover:border-red-500 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a]"><X size={16} /></button>
            </div>
          </div>

          {/* KPI bar */}
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 px-5 py-3 border-b border-[#1e2d4a] shrink-0">
            {[
              { l: 'Total', v: stats.total, c: 'text-slate-300' },
              { l: 'Open', v: stats.open, c: 'text-red-400' },
              { l: 'In Progress', v: stats.inProg, c: 'text-blue-400' },
              { l: 'Awaiting', v: stats.review, c: 'text-amber-400' },
              { l: 'Closed', v: stats.closed, c: 'text-emerald-400' },
              { l: 'Overdue', v: stats.overdue, c: 'text-rose-400' },
            ].map(s => (
              <div key={s.l} className="bg-[#1a2236] rounded-lg p-2.5 text-center">
                <div className={`text-base font-bold ${s.c}`}>{s.v}</div>
                <div className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Snag list */}
          <div className="overflow-y-auto flex-1 p-5">
            {/* Filters + add button */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
                {['All', 'Open', 'In Progress', 'Awaiting Review', 'Closed'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors whitespace-nowrap ${filterStatus === s ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{s}</button>
                ))}
              </div>
              <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1">
                {['All', 'Critical', 'High', 'Medium', 'Low'].map(p => (
                  <button key={p} onClick={() => setFilterPriority(p)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${filterPriority === p ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{p}</button>
                ))}
              </div>
              {canCreate && (
                <button onClick={() => { setEditingSnag(null); setShowSnagModal(true); }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600">
                  <Plus size={14} />Add Snag
                </button>
              )}
            </div>

            {filtered.length === 0
              ? <div className="text-center py-12 text-slate-600">
                  <ClipboardList size={28} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{snags.length === 0 ? 'No snag items yet. Click "Add Snag" to begin.' : 'No snags match the current filters.'}</p>
                </div>
              : <div className="space-y-2">
                  {filtered.map(snag => {
                    const attCount = store.attachments.filter(a => a.linked_type === 'snag' && a.linked_id === snag.id).length;
                    const isOverdue = snag.status !== 'Closed' && snag.dueDate && new Date(snag.dueDate) < new Date();
                    return (
                      <div key={snag.id}
                        onClick={() => setSelectedSnag(snag)}
                        className={`bg-[#1a2236] border border-l-4 ${priorityStyle[snag.priority]?.border ?? 'border-l-slate-600'} ${isOverdue ? 'border-red-900/40' : 'border-[#1e2d4a]'} rounded-xl px-4 py-3 hover:border-slate-500/50 hover:bg-[#1e2840] transition-all cursor-pointer group`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono text-[9px] font-bold text-slate-600">{snag.snagNumber ?? snag.id}</span>
                              <PriorityBadge p={snag.priority} />
                              {snag.trade && <span className="text-[9px] text-slate-600">{snag.trade}</span>}
                            </div>
                            <p className="text-sm font-semibold text-slate-200 group-hover:text-white truncate">{snag.title}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {snag.location && <span className="text-xs text-slate-500">{snag.location}</span>}
                              {snag.responsibleParty && <span className="text-xs text-slate-600">· {snag.responsibleParty}</span>}
                              {snag.dueDate && (
                                <span className={`text-xs ${isOverdue ? 'text-red-400 font-semibold' : 'text-slate-600'}`}>
                                  Due {new Date(snag.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge s={snag.status} />
                            {attCount > 0 && (
                              <span className="flex items-center gap-0.5 text-[9px] text-slate-500 bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">
                                <Camera size={9} />{attCount}
                              </span>
                            )}
                            {snag.comments.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[9px] text-slate-500">
                                <MessageSquare size={10} />{snag.comments.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        </div>
      </div>

      {showSnagModal && (
        <SnagModal
          reportId={report.id}
          projectId={report.project_id}
          projectName={report.project_name}
          snagNumber={editingSnag?.snagNumber ?? nextSnagNumber()}
          initial={editingSnag}
          onClose={() => { setShowSnagModal(false); setEditingSnag(null); }}
          onSave={handleSaveSnag}
        />
      )}

      {liveSnag && !showSnagModal && (
        <SnagDetail
          snag={liveSnag}
          reportId={report.id}
          projectName={report.project_name}
          onClose={() => setSelectedSnag(null)}
          onEdit={() => { setEditingSnag(liveSnag); setSelectedSnag(null); setShowSnagModal(true); }}
          onDelete={() => { setDeleteSnagId(liveSnag.id); setSelectedSnag(null); }}
          onUpdate={s => {
            const prev = liveSnag;
            store.updateSnag(s as Snag);
            setSelectedSnag(s);
            const { changesText, fieldDiffs, prevValue, newValue, actionType } = buildDiff(
              prev as unknown as Record<string, unknown>,
              s as unknown as Record<string, unknown>,
              SNAG_FIELDS,
            );
            const changePart = changesText ? ` Changes: ${changesText}.` : '';
            logActivity({ orgId, userName, module: 'snagging', recordId: s.id, recordRef: s.snagNumber ?? s.id, recordType: 'Snag', projectId: report.project_id, projectName: report.project_name, actionType, description: `${userName} updated Snag ${s.snagNumber ?? s.id} "${s.title}" on project ${report.project_name}.${changePart}`, prevValue, newValue, metadata: fieldDiffs.length ? { diffs: fieldDiffs } : null });
          }}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {deleteSnagId && (
        <ConfirmDeleteModal
          title="Delete Snag Item"
          description="This snag item and all linked attachments will be permanently deleted."
          onConfirm={() => {
            const target = (store.snags as ExtendedSnag[]).find(s => s.id === deleteSnagId);
            logActivity({ orgId, userName, module: 'snagging', recordId: deleteSnagId, recordRef: target?.snagNumber ?? deleteSnagId, recordType: 'Snag', projectId: report.project_id, projectName: report.project_name, actionType: 'record_deleted', description: `${userName} deleted Snag ${target?.snagNumber ?? deleteSnagId} "${target?.title ?? ''}" on project ${report.project_name}.` });
            store.removeSnag(deleteSnagId);
            setDeleteSnagId(null);
          }}
          onCancel={() => setDeleteSnagId(null)}
        />
      )}
    </>
  );
}

// ─── Main Snagging Page ───────────────────────────────────────────────────────

interface SnaggingProps {
  pendingOpen?: { linkedType: string; linkedId: string } | null;
  onPendingOpenConsumed?: () => void;
  pendingFilter?: { filterKey: string; filterValue: string } | null;
  onPendingFilterConsumed?: () => void;
}

export default function Snagging({ pendingOpen, onPendingOpenConsumed, pendingFilter, onPendingFilterConsumed }: SnaggingProps) {
  const store     = useAppStore();
  const perms     = usePermissions();
  const isAdmin   = store.currentUser?.role === 'Admin';
  const canCreate = perms['snagging.create'] || isAdmin;
  const canEdit   = perms['snagging.edit']   || isAdmin;
  const canDelete = perms['snagging.delete'] || isAdmin;
  const canExport = perms['snagging.export'] || isAdmin;

  const [search, setSearch]                 = useState('');
  const [filterStatus, setFilterStatus]     = useState('All');
  const [filterProject, setFilterProject]   = useState('All');
  const [showNewReport, setShowNewReport]   = useState(false);
  const [editingReport, setEditingReport]   = useState<DBSnaggingReport | null>(null);
  const [viewingReport, setViewingReport]   = useState<DBSnaggingReport | null>(null);
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const [selectMode, setSelectMode]         = useState(false);
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [similarReportTemplate, setSimilarReportTemplate] = useState<DBSnaggingReport | null>(null);

  const reports = store.snaggingReports ?? [];

  // Handle pendingOpen — open the matching report
  useEffect(() => {
    if (pendingOpen?.linkedType === 'snagging_report' && pendingOpen.linkedId) {
      const r = reports.find(x => x.id === pendingOpen.linkedId);
      if (r) { setViewingReport(r); onPendingOpenConsumed?.(); }
    }
  }, [pendingOpen, reports, onPendingOpenConsumed]);

  useEffect(() => {
    if (!pendingFilter) return;
    if (pendingFilter.filterKey === 'status') setFilterStatus(pendingFilter.filterValue);
    if (pendingFilter.filterKey === 'project') setFilterProject(pendingFilter.filterValue);
    onPendingFilterConsumed?.();
  }, [pendingFilter, onPendingFilterConsumed]);

  const projectOptions = useMemo(() => Array.from(new Set(reports.map(r => r.project_name).filter(Boolean))).sort(), [reports]);

  const filtered = useMemo(() => reports.filter(r => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !r.project_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'All' && r.status !== filterStatus) return false;
    if (filterProject !== 'All' && r.project_name !== filterProject) return false;
    return true;
  }), [reports, search, filterStatus, filterProject]);

  // Global stats — only count snags that belong to a report still in the list.
  // Orphaned snags (report_id null or pointing to a deleted report) are excluded
  // so the dashboard totals and the report list reflect the same dataset.
  const reportIds = useMemo(() => new Set(reports.map(r => r.id)), [reports]);
  const allSnags = useMemo(
    () => (store.snags as ExtendedSnag[]).filter(s => s.reportId && reportIds.has(s.reportId)),
    [store.snags, reportIds]
  );
  const statsTotal    = allSnags.length;
  const statsOpen     = allSnags.filter(s => s.status === 'Open').length;
  const statsInProg   = allSnags.filter(s => s.status === 'In Progress').length;
  const statsClosed   = allSnags.filter(s => s.status === 'Closed').length;
  const statsOverdue  = allSnags.filter(s => s.status !== 'Closed' && s.dueDate && new Date(s.dueDate) < new Date()).length;

  const toggleSelectMode = () => { setSelectMode(p => !p); setSelectedIds(new Set()); };
  const toggleId = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelectedIds(new Set(filtered.map(r => r.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleExportPDF = () => {
    const selectedReports = reports.filter(r => selectedIds.has(r.id));
    if (selectedReports.length === 0) return;
    const orgSettings = { company_name: store.settings?.company_name ?? '', logo_data_url: store.settings?.logo_data_url ?? '' };
    const pages = selectedReports.map((report, i) => {
      const rSnags = (store.snags as ExtendedSnag[])
        .filter(s => s.reportId === report.id)
        .sort((a, b) => (a.snagNumber ?? '').localeCompare(b.snagNumber ?? ''));
      const snagItems: SnagItemForPDF[] = rSnags.map(s => {
        const atts = store.attachments.filter(a => a.linked_type === 'snag' && a.linked_id === s.id);
        const photos: AttachmentForPDF[] = atts
          .filter(a => a.type.startsWith('image/') && a.category !== 'Closure Photo')
          .map(a => ({ id: a.id, name: a.name, type: a.type, data_url: a.data_url, category: a.category }));
        const closurePhotos: AttachmentForPDF[] = atts
          .filter(a => a.category === 'Closure Photo')
          .map(a => ({ id: a.id, name: a.name, type: a.type, data_url: a.data_url, category: a.category }));
        return {
          id: s.id, snagNumber: s.snagNumber, title: s.title, location: s.location,
          trade: s.trade, priority: s.priority, status: s.status, description: s.description,
          rectification: s.rectification, responsibleParty: s.responsibleParty,
          assignedTo: s.assignedTo, raisedBy: s.raisedBy, raisedDate: s.raisedDate,
          targetCompletionDate: s.targetCompletionDate ?? s.dueDate, dueDate: s.dueDate,
          comments: s.comments, closedBy: s.closedBy, closedDate: s.closedDate,
          closureComments: s.closureComments, photos, closurePhotos,
        };
      });
      const pageHtml = buildSnaggingReportPageHTML(report, snagItems, orgSettings);
      return i < selectedReports.length - 1
        ? `<div style="page-break-after:always;break-after:page;">${pageHtml}</div>`
        : pageHtml;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Snagging Reports — VYSITE</title><style>${SNAGGING_PDF_CSS}</style></head><body>${pages}<script>window.onload=function(){window.print();};<\/script></body></html>`;
    openPrintTab(html);
  };

  const handleSaveReport = async (data: ReportFormData) => {
    const isEdit = !!editingReport;
    const id = editingReport?.id ?? `snr-${Date.now()}`;
    const rec: DBSnaggingReport = {
      id,
      project_id: data.projectId,
      project_name: data.projectName,
      title: data.title,
      area_block: data.areaBlock,
      floor_location: data.floorLocation,
      inspection_date: data.inspectionDate,
      inspector: data.inspector,
      contractor: data.contractor,
      client: data.client,
      status: data.status,
      overall_completion_pct: data.overallCompletionPct,
      notes: data.notes,
      created_by: editingReport?.created_by ?? store.currentUser?.name ?? '',
      created_at: editingReport?.created_at,
    };
    if (isEdit) {
      await store.updateSnaggingReport(rec);
    } else {
      await store.addSnaggingReport(rec);
    }
    setEditingReport(null);
    setSimilarReportTemplate(null);
  };

  const handleQuickReportStatus = async (report: DBSnaggingReport, newStatus: string) => {
    if (report.status === newStatus) return;
    const updated = { ...report, status: newStatus };
    await store.updateSnaggingReport(updated);
    if (viewingReport?.id === report.id) setViewingReport(updated);
    logActivity({ orgId, userName, module: 'snagging', recordId: report.id, recordRef: report.id, recordType: 'Snagging Report', projectId: report.project_id, projectName: report.project_name, actionType: 'status_changed', description: `${userName} changed snagging report "${report.title}" status from "${report.status}" to "${newStatus}".`, prevValue: report.status, newValue: newStatus });
  };

  const handleCreateSimilarReport = (source: DBSnaggingReport) => {
    setSimilarReportTemplate(source);
    setEditingReport(null);
    setShowNewReport(true);
  };

  // live-sync viewing report
  const liveReport = viewingReport ? (reports.find(r => r.id === viewingReport.id) ?? viewingReport) : null;

  return (
    <div className="p-4 lg:p-6 space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Snagging</h1>
          <p className="text-sm text-slate-500 mt-0.5">Professional defect tracking and snagging reports</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canExport && reports.length > 0 && (
            <button
              onClick={toggleSelectMode}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
                selectMode ? 'bg-[#f97316] text-white border-[#f97316]' : 'border-[#1e2d4a] text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200'
              }`}
            >
              {selectMode ? 'Done' : 'Select'}
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowNewReport(true)}
              className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
              <Plus size={15} />New Report
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { l: 'Total Snags', v: statsTotal,  icon: FileText,       c: 'text-slate-300',  bg: 'bg-slate-700/40' },
          { l: 'Open',        v: statsOpen,   icon: AlertCircle,    c: 'text-red-400',    bg: 'bg-red-900/30' },
          { l: 'In Progress', v: statsInProg, icon: Clock,          c: 'text-blue-400',   bg: 'bg-blue-900/30' },
          { l: 'Closed',      v: statsClosed, icon: CheckCircle,    c: 'text-emerald-400',bg: 'bg-emerald-900/30' },
          { l: 'Overdue',     v: statsOverdue,icon: AlertTriangle,  c: 'text-rose-400',   bg: 'bg-rose-900/30' },
        ].map(s => (
          <div key={s.l} className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
              <s.icon size={15} className={s.c} />
            </div>
            <div>
              <div className={`text-lg font-bold leading-none ${s.c}`}>{s.v}</div>
              <div className="text-[10px] text-slate-600 mt-0.5 font-medium uppercase tracking-wide">{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-44">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports..."
            className="w-full bg-[#1a2236] border border-[#1e2d4a] rounded-lg pl-8 pr-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-slate-500" />
        </div>
        {projectOptions.length > 0 && (
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-slate-500 cursor-pointer">
            <option value="All">All Projects</option>
            {projectOptions.map(p => <option key={p}>{p}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-slate-500 cursor-pointer">
          <option value="All">All Statuses</option>
          {['Draft', 'In Progress', 'Submitted', 'Approved', 'Closed'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Selection action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-white">{selectedIds.size} selected</span>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
            <Download size={14} />Export to PDF
          </button>
          <button onClick={selectAll} className="px-3 py-2 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors">Select All</button>
          <button onClick={clearSelection} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors ml-auto">Clear selection</button>
        </div>
      )}

      {/* Reports grid */}
      {filtered.length === 0
        ? <div className="text-center py-16 bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <TrendingUp size={32} className="text-slate-700 mx-auto mb-3 opacity-40" />
            <p className="text-slate-500 text-sm font-medium">
              {reports.length === 0 ? 'No snagging reports yet. Create your first report to get started.' : 'No reports match your filters.'}
            </p>
          </div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(report => {
              const reportSnags = allSnags.filter(s => s.reportId === report.id);
              const openCount   = reportSnags.filter(s => s.status === 'Open').length;
              const closedCount = reportSnags.filter(s => s.status === 'Closed').length;
              const totalCount  = reportSnags.length;
              const pct = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0;
              const hasOverdue  = reportSnags.some(s => s.status !== 'Closed' && s.dueDate && new Date(s.dueDate) < new Date());
              const isSelected  = selectedIds.has(report.id);
              return (
                <div key={report.id}
                  onClick={() => selectMode ? toggleId(report.id) : setViewingReport(report)}
                  className={`bg-[#1a2236] border rounded-xl p-4 transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-orange-500/60'
                      : 'border-[#1e2d4a] hover:border-slate-500/60 hover:bg-[#1e2840]'
                  }`}>
                  <div className="flex items-start gap-3">
                    {selectMode && (
                      <div className="shrink-0 mt-0.5 pt-0.5" onClick={e => { e.stopPropagation(); toggleId(report.id); }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleId(report.id)}
                          className="w-4 h-4 rounded border-slate-600 bg-[#0d1628] accent-orange-500 cursor-pointer" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <ReportStatusDropdown
                          status={report.status}
                          canEdit={canEdit}
                          onChange={s => handleQuickReportStatus(report, s)}
                        />
                        {hasOverdue && <span className="text-[9px] font-bold text-rose-400 bg-rose-900/30 px-1.5 py-0.5 rounded-full">Overdue</span>}
                      </div>
                      <h3 className="text-sm font-bold text-white leading-snug group-hover:text-white truncate">{report.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{report.project_name}</p>
                    </div>
                    {!selectMode && (
                      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <RowActionsMenu actions={[
                          { label: 'View', icon: Eye, onClick: () => setViewingReport(report) },
                          ...(canEdit ? [{ label: 'Edit', icon: Edit2, onClick: () => { setEditingReport(report); setShowNewReport(true); } }] : []),
                          { label: 'Create Similar', icon: Copy, onClick: () => handleCreateSimilarReport(report) },
                          ...(canDelete ? [{ label: 'Delete', icon: Trash2, onClick: () => setDeleteReportId(report.id), danger: true, dividerBefore: true }] : []),
                        ]} />
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="h-1.5 bg-[#0d1628] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-slate-600">{pct}% complete</span>
                      <span className="text-[9px] text-slate-600">{closedCount}/{totalCount} closed</span>
                    </div>
                  </div>

                  {/* Meta footer */}
                  <div className="flex items-center gap-3 pt-2.5 border-t border-[#1e2d4a]">
                    {openCount > 0 && <span className="text-[10px] font-semibold text-red-400">{openCount} open</span>}
                    {report.area_block && <span className="text-[10px] text-slate-600">{report.area_block}</span>}
                    {report.inspection_date && (
                      <span className="text-[10px] text-slate-600 ml-auto">
                        {new Date(report.inspection_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      }

      {/* Modals */}
      {(showNewReport || editingReport) && (
        <ReportModal
          initial={editingReport ?? similarReportTemplate}
          onClose={() => { setShowNewReport(false); setEditingReport(null); setSimilarReportTemplate(null); }}
          onSave={handleSaveReport}
        />
      )}

      {liveReport && (
        <ReportView
          report={liveReport}
          onClose={() => setViewingReport(null)}
          onEdit={() => { setEditingReport(liveReport); setViewingReport(null); setShowNewReport(true); }}
          onDelete={() => { setDeleteReportId(liveReport.id); setViewingReport(null); }}
          canEdit={canEdit}
          canDelete={canDelete}
          canExport={canExport}
          canCreate={canCreate}
        />
      )}

      {deleteReportId && (
        <ConfirmDeleteModal
          title="Delete Snagging Report"
          description="This will permanently delete the report. Snag items linked to it will be unlinked but not deleted."
          onConfirm={() => { store.removeSnaggingReport(deleteReportId); setDeleteReportId(null); }}
          onCancel={() => setDeleteReportId(null)}
        />
      )}
    </div>
  );
}
