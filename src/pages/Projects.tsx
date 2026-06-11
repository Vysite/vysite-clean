import { useState, useMemo, useEffect } from 'react';
import {
  Plus, MapPin, User, Calendar, AlertTriangle, CheckSquare, ArrowLeft, X,
  Search, FolderOpen, FileText, Wrench, ClipboardList, Upload,
  Activity, ChevronRight, Trash2, File, Eye, Download, Printer, Pencil,
  GanttChart, ChevronDown, GripVertical,
} from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import KeyDatesPanel from '../components/KeyDatesPanel';
import type { Project, ProjectStatus } from '../data/types';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import type { DBProjectDocument, DBProgramme, DBProgrammeTask, ProgrammeTaskStatus } from '../lib/store';
import FileUpload from '../components/FileUpload';
import type { UploadedFile } from '../components/FileUpload';
import type { PendingOpen } from '../App';

// Normalise any project value input into £X,XXX format for consistent display
function formatProjectValue(raw: string): string {
  if (!raw.trim()) return '';
  const num = parseFloat(raw.replace(/[£,\s]/g, ''));
  if (isNaN(num)) return raw;
  return '£' + num.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtCurrency(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function parseValue(raw: string): number {
  const n = parseFloat(raw.replace(/[£,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ─── Shared badges ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: 'bg-emerald-900/60 text-emerald-400 border-emerald-800',
    'On Hold': 'bg-amber-900/60 text-amber-400 border-amber-800',
    Completed: 'bg-[#1e2d4a] text-slate-400 border-slate-600',
    Tender: 'bg-blue-900/60 text-blue-400 border-blue-800',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${map[status] || 'bg-[#1e2d4a] text-slate-400'}`}>
      {status}
    </span>
  );
}

function ProgressBar({ progress, status }: { progress: number; status: string }) {
  const color = status === 'Active' ? 'bg-[#f97316]' : status === 'On Hold' ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="w-full bg-[#0d1628] rounded-full h-2">
      <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${progress}%` }} />
    </div>
  );
}

// ─── Tab definitions ────────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'snags' | 'actions' | 'forms' | 'testing' | 'documents' | 'programmes' | 'dates' | 'activity';

const TABS: { id: DetailTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: FolderOpen },
  { id: 'snags', label: 'Snags', icon: AlertTriangle },
  { id: 'actions', label: 'Actions', icon: CheckSquare },
  { id: 'forms', label: 'Forms', icon: ClipboardList },
  { id: 'testing', label: 'T&C', icon: Wrench },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'programmes', label: 'Programmes', icon: GanttChart },
  { id: 'dates', label: 'Key Dates', icon: Calendar },
  { id: 'activity', label: 'Activity', icon: Activity },
];

// ─── Document category ────────────────────────────────────────────────────────

const DOC_CATEGORIES = ['Drawing', 'Specification', 'Photo', 'Report', 'Commissioning Evidence', 'Other'] as const;
type DocCategory = typeof DOC_CATEGORIES[number];

const DOC_CATEGORY_COLORS: Record<DocCategory, string> = {
  Drawing: 'bg-blue-900/60 text-blue-400',
  Specification: 'bg-teal-900/60 text-teal-400',
  Photo: 'bg-emerald-900/60 text-emerald-400',
  Report: 'bg-orange-900/60 text-orange-400',
  'Commissioning Evidence': 'bg-purple-900/60 text-purple-300',
  Other: 'bg-[#1e2d4a] text-slate-400',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Add Document Modal ────────────────────────────────────────────────────────

interface AddDocumentModalProps {
  projectId: string;
  projectName: string;
  uploadedByDefault: string;
  onClose: () => void;
  onSave: (doc: import('../lib/store').DBProjectDocument) => void;
}

function AddDocumentModal({ projectId, projectName, uploadedByDefault, onClose, onSave }: AddDocumentModalProps) {
  const [category, setCategory] = useState<DocCategory>('Drawing');
  const [uploadedBy, setUploadedBy] = useState(uploadedByDefault);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  function handleSave() {
    if (files.length === 0) return;
    files.forEach(f => {
      onSave({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        project_id: projectId,
        project_name: projectName,
        name: f.name,
        type: f.type,
        size: f.size,
        category,
        data_url: f.dataUrl ?? '',
        uploaded_by: uploadedBy || 'Unknown',
        created_at: new Date().toISOString(),
      });
    });
    onClose();
  }

  const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316]';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block';

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
          <h3 className="text-base font-bold text-white">Add Document</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as DocCategory)} className={inputCls}>
                {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Uploaded By</label>
              <input value={uploadedBy} onChange={e => setUploadedBy(e.target.value)} className={inputCls} placeholder="Your name" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Files</label>
            <FileUpload files={files} onChange={setFiles} label="Drop drawings, specs, photos or reports here" maxFiles={20} />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-[#1e2d4a]">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={files.length === 0} className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Save {files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''}` : 'Document'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── View Document Modal ───────────────────────────────────────────────────────

function ViewDocumentModal({ doc, onClose, onDelete, canDelete }: { doc: import('../lib/store').DBProjectDocument; onClose: () => void; onDelete: () => void; canDelete: boolean }) {
  const isImage = doc.type.startsWith('image/');
  const isPDF = doc.type === 'application/pdf';

  function openDoc() {
    if (!doc.data_url) return;
    const link = document.createElement('a');
    link.href = doc.data_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (!isImage && !isPDF) link.download = doc.name;
    link.click();
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={16} className="text-slate-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{doc.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${DOC_CATEGORY_COLORS[doc.category as DocCategory] || 'bg-[#1e2d4a] text-slate-400'}`}>{doc.category}</span>
                <span className="text-[10px] text-slate-600">{formatBytes(doc.size)}</span>
                {doc.uploaded_by && <span className="text-[10px] text-slate-600">{doc.uploaded_by}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-3 shrink-0">
            {doc.data_url && (
              isImage || isPDF ? (
                <a href={doc.data_url} download={doc.name} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors" title="Download">
                  <Download size={15} />
                </a>
              ) : (
                <button onClick={openDoc} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors" title="Open / Download">
                  <Download size={15} />
                </button>
              )
            )}
            {canDelete && (
              <button onClick={onDelete} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors" title="Delete">
                <Trash2 size={15} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors ml-1"><X size={16} /></button>
          </div>
        </div>
        <div>
          {isImage && doc.data_url ? (
            <img src={doc.data_url} alt={doc.name} className="max-h-[70vh] w-auto mx-auto object-contain p-3" />
          ) : isPDF && doc.data_url ? (
            <iframe src={doc.data_url} className="w-full h-[65vh]" title={doc.name} />
          ) : doc.data_url ? (
            <div className="p-8 text-center">
              <File size={48} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm mb-4">{doc.name}</p>
              <button onClick={openDoc} className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors flex items-center gap-2 mx-auto">
                <Download size={14} />Open / Download
              </button>
            </div>
          ) : (
            <div className="p-8 text-center">
              <File size={48} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No file data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Programmes Tab ─────────────────────────────────────────────────────────────

const TASK_STATUS_COLORS: Record<ProgrammeTaskStatus, string> = {
  'Not Started': 'bg-[#1e2d4a] text-slate-400',
  'In Progress': 'bg-blue-900/60 text-blue-400',
  'Awaiting Others': 'bg-amber-900/60 text-amber-400',
  'Blocked': 'bg-red-900/60 text-red-400',
  'Complete': 'bg-emerald-900/60 text-emerald-400',
};

const TASK_STATUS_BAR: Record<ProgrammeTaskStatus, string> = {
  'Not Started': 'bg-slate-600',
  'In Progress': 'bg-blue-500',
  'Awaiting Others': 'bg-amber-500',
  'Blocked': 'bg-red-500',
  'Complete': 'bg-emerald-500',
};

function ganttRange(tasks: DBProgrammeTask[]): { minDate: Date; maxDate: Date; totalDays: number } | null {
  const dates = tasks.flatMap(t => [t.start_date, t.finish_date]).filter(Boolean).map(d => new Date(d));
  if (dates.length === 0) return null;
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000) + 1);
  return { minDate, maxDate, totalDays };
}

interface ProgrammesTabProps {
  project: Project;
  programmes: DBProgramme[];
  tasks: DBProgrammeTask[];
  currentUserName: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  onAddProgramme: (p: DBProgramme) => void;
  onUpdateProgramme: (p: DBProgramme) => void;
  onRemoveProgramme: (id: string) => void;
  onAddTask: (t: DBProgrammeTask) => void;
  onUpdateTask: (t: DBProgrammeTask) => void;
  onRemoveTask: (id: string) => void;
}

function ProgrammesTab({
  project, programmes, tasks, currentUserName,
  canCreate, canEdit, canDelete, canExport,
  onAddProgramme, onUpdateProgramme, onRemoveProgramme,
  onAddTask, onUpdateTask, onRemoveTask,
}: ProgrammesTabProps) {
  const projectProgrammes = useMemo(
    () => programmes.filter(p => p.project_id === project.id),
    [programmes, project.id]
  );

  const [selectedProgrammeId, setSelectedProgrammeId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'gantt'>('list');
  const [showNewProgramme, setShowNewProgramme] = useState(false);
  const [editingProgramme, setEditingProgramme] = useState<DBProgramme | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'programme' | 'task'; id: string; label: string } | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState<DBProgrammeTask | null>(null);

  const selectedProgramme = projectProgrammes.find(p => p.id === selectedProgrammeId) ?? projectProgrammes[0] ?? null;
  const activeProgramme = selectedProgramme;

  const programmeTasks = useMemo(
    () => tasks.filter(t => t.programme_id === activeProgramme?.id).sort((a, b) => a.sort_order - b.sort_order),
    [tasks, activeProgramme]
  );

  const range = ganttRange(programmeTasks);

  const [showExportMenu, setShowExportMenu] = useState(false);

  const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block';

  function openPrintWindow(html: string) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, '_blank');
    if (tab) tab.addEventListener('afterprint', () => URL.revokeObjectURL(url), { once: true });
    else setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function exportListPDF() {
    if (!activeProgramme) return;
    setShowExportMenu(false);
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const taskRows = programmeTasks.map((t, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td><strong>${t.task_name}</strong>${t.notes ? `<br/><span class="note">${t.notes}</span>` : ''}</td>
        <td>${t.assigned_to || '—'}</td>
        <td>${t.start_date ? new Date(t.start_date).toLocaleDateString('en-GB') : '—'}</td>
        <td>${t.finish_date ? new Date(t.finish_date).toLocaleDateString('en-GB') : '—'}</td>
        <td><span class="badge badge-${t.status.replace(/\s+/g, '-').toLowerCase()}">${t.status}</span></td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${activeProgramme.title} — List View</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:white;padding:36px 40px;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:14px;margin-bottom:20px}
    .logo{font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#f97316}
    .logo-sub{color:#888;font-size:10px;margin-top:2px}
    .prog-name{font-size:17px;font-weight:700;text-align:right;color:#111}
    .prog-proj{color:#555;font-size:11px;text-align:right;margin-top:3px}
    .meta{background:#f8f8f8;border-radius:6px;padding:12px 16px;margin-bottom:18px;display:flex;gap:32px;align-items:flex-start}
    .meta-item{flex:1}
    .meta-label{font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:#888;display:block;margin-bottom:2px}
    .meta-val{font-weight:700;font-size:11px;color:#111}
    .meta-desc{font-size:11px;color:#555;margin-top:3px;line-height:1.5}
    .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#f97316;padding-bottom:5px;border-bottom:1.5px solid #e5e7eb;margin-bottom:10px}
    table{width:100%;border-collapse:collapse}
    thead tr{background:#f97316}
    th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:white;padding:7px 8px;font-weight:700}
    th.num{width:32px;text-align:center}
    td{padding:7px 8px;border-bottom:1px solid #f0f4f8;font-size:11px;color:#1e293b;vertical-align:top}
    td.num{text-align:center;color:#999;font-size:10px}
    tr:nth-child(even) td{background:#f9fafb}
    .note{color:#888;font-size:10px;font-style:italic;margin-top:2px;display:block}
    .badge{display:inline-block;padding:2px 7px;border-radius:12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em}
    .badge-not-started{background:#e8edf4;color:#64748b}
    .badge-in-progress{background:#dbeafe;color:#1d4ed8}
    .badge-awaiting-others{background:#fef3c7;color:#92400e}
    .badge-blocked{background:#fee2e2;color:#991b1b}
    .badge-complete{background:#d1fae5;color:#065f46}
    .summary{display:flex;gap:16px;margin-top:16px;flex-wrap:wrap}
    .summary-item{background:#f8f8f8;border-radius:5px;padding:8px 14px;text-align:center}
    .summary-num{font-size:18px;font-weight:800;color:#f97316}
    .summary-lbl{font-size:9px;text-transform:uppercase;color:#888;letter-spacing:0.05em}
    .footer{margin-top:28px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:9px;color:#aaa;display:flex;justify-content:space-between}
    @media print{body{padding:20px 24px}@page{margin:16mm 14mm}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">VYSITE</div>
      <div class="logo-sub">Programme — List View &nbsp;·&nbsp; ${dateStr}</div>
    </div>
    <div>
      <div class="prog-name">${activeProgramme.title}</div>
      <div class="prog-proj">${project.name}</div>
    </div>
  </div>
  <div class="meta">
    <div class="meta-item"><span class="meta-label">Project</span><span class="meta-val">${project.name}</span></div>
    <div class="meta-item"><span class="meta-label">Programme</span><span class="meta-val">${activeProgramme.title}</span></div>
    <div class="meta-item"><span class="meta-label">Created By</span><span class="meta-val">${activeProgramme.created_by}</span></div>
    <div class="meta-item"><span class="meta-label">Created</span><span class="meta-val">${activeProgramme.created_at ? new Date(activeProgramme.created_at).toLocaleDateString('en-GB') : '—'}</span></div>
  </div>
  ${activeProgramme.description ? `<p class="meta-desc" style="margin-bottom:18px;padding:10px 14px;background:#fffbf5;border-left:3px solid #f97316;border-radius:0 4px 4px 0">${activeProgramme.description}</p>` : ''}
  <div class="section-title">Task Register — ${programmeTasks.length} task${programmeTasks.length !== 1 ? 's' : ''}</div>
  ${programmeTasks.length === 0
    ? '<p style="color:#999;font-size:11px;padding:12px 0">No tasks added to this programme yet.</p>'
    : `<table>
    <thead><tr><th class="num">#</th><th>Task</th><th>Assigned To</th><th>Start Date</th><th>Finish Date</th><th>Status</th></tr></thead>
    <tbody>${taskRows}</tbody>
  </table>`}
  <div class="summary">
    <div class="summary-item"><div class="summary-num">${programmeTasks.length}</div><div class="summary-lbl">Total</div></div>
    <div class="summary-item"><div class="summary-num">${programmeTasks.filter(t => t.status === 'Complete').length}</div><div class="summary-lbl">Complete</div></div>
    <div class="summary-item"><div class="summary-num">${programmeTasks.filter(t => t.status === 'In Progress').length}</div><div class="summary-lbl">In Progress</div></div>
    <div class="summary-item"><div class="summary-num">${programmeTasks.filter(t => t.status === 'Blocked').length}</div><div class="summary-lbl">Blocked</div></div>
    <div class="summary-item"><div class="summary-num">${programmeTasks.filter(t => t.status === 'Not Started').length}</div><div class="summary-lbl">Not Started</div></div>
  </div>
  <div class="footer">
    <span>Generated by VYSITE &nbsp;·&nbsp; ${activeProgramme.title} &nbsp;·&nbsp; ${project.name}</span>
    <span>Printed ${new Date().toLocaleDateString('en-GB')}</span>
  </div>
  <script>window.onload=function(){window.print();};<\/script>
</body>
</html>`;
    openPrintWindow(html);
  }

  function exportGanttPDF() {
    if (!activeProgramme) return;
    setShowExportMenu(false);
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const r = ganttRange(programmeTasks);

    // Build date column headers — spread across visible days
    const totalDays = r ? r.totalDays : 0;

    // Build task rows with bar data
    const STATUS_COLOR: Record<string, string> = {
      'Not Started': '#94a3b8',
      'In Progress': '#3b82f6',
      'Awaiting Others': '#f59e0b',
      'Blocked': '#ef4444',
      'Complete': '#10b981',
    };
    const BADGE_BG: Record<string, string> = {
      'Not Started': '#e8edf4',
      'In Progress': '#dbeafe',
      'Awaiting Others': '#fef3c7',
      'Blocked': '#fee2e2',
      'Complete': '#d1fae5',
    };
    const BADGE_FG: Record<string, string> = {
      'Not Started': '#64748b',
      'In Progress': '#1d4ed8',
      'Awaiting Others': '#92400e',
      'Blocked': '#991b1b',
      'Complete': '#065f46',
    };

    // Generate week markers for header (every 7 days)
    let weekHeaders = '';
    if (r) {
      const weekCount = Math.ceil(totalDays / 7);
      for (let w = 0; w < weekCount; w++) {
        const d = new Date(r.minDate.getTime() + w * 7 * 86400000);
        const leftPct = (w * 7 / totalDays) * 100;
        const widthPct = Math.min((7 / totalDays) * 100, 100 - leftPct);
        weekHeaders += `<div style="position:absolute;left:${leftPct.toFixed(2)}%;width:${widthPct.toFixed(2)}%;border-right:1px solid #e5e7eb;padding:0 4px;font-size:8px;color:#888;white-space:nowrap;overflow:hidden">${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>`;
      }
    }

    const taskRows = programmeTasks.map((t, i) => {
      let barHtml = '<span style="color:#ccc;font-size:9px;font-style:italic">No dates</span>';
      if (r && t.start_date && t.finish_date) {
        const start = new Date(t.start_date);
        const end = new Date(t.finish_date);
        const startOff = Math.max(0, (start.getTime() - r.minDate.getTime()) / 86400000);
        const dur = Math.max(1, (end.getTime() - start.getTime()) / 86400000 + 1);
        const leftPct = (startOff / totalDays) * 100;
        const widthPct = Math.min((dur / totalDays) * 100, 100 - leftPct);
        const color = STATUS_COLOR[t.status] ?? '#94a3b8';
        const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        barHtml = `<div style="position:relative;height:22px">
          <div style="position:absolute;left:${leftPct.toFixed(2)}%;width:${Math.max(widthPct, 1.5).toFixed(2)}%;height:20px;background:${color};border-radius:3px;display:flex;align-items:center;padding:0 5px;overflow:hidden" title="${t.task_name}">
            <span style="color:white;font-size:8.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${startStr} – ${endStr}</span>
          </div>
        </div>`;
      }
      const bg = i % 2 === 0 ? 'white' : '#f9fafb';
      const badgeBg = BADGE_BG[t.status] ?? '#e8edf4';
      const badgeFg = BADGE_FG[t.status] ?? '#64748b';
      return `<tr style="background:${bg}">
        <td style="padding:6px 8px;border-bottom:1px solid #f0f4f8;font-size:10px;color:#999;width:28px;text-align:center">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f4f8;font-size:10px;color:#1e293b;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis" title="${t.task_name}"><strong>${t.task_name}</strong><br/><span style="color:#888;font-size:9px">${t.assigned_to || '—'}</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f4f8;font-size:9px;width:60px;text-align:center"><span style="background:${badgeBg};color:${badgeFg};padding:2px 6px;border-radius:10px;font-size:8px;font-weight:700;white-space:nowrap">${t.status}</span></td>
        <td style="padding:4px 6px;border-bottom:1px solid #f0f4f8;width:100%">${barHtml}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${activeProgramme.title} — Gantt View</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:white;padding:24px 28px;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:12px;margin-bottom:16px}
    .logo{font-size:18px;font-weight:900;letter-spacing:-0.5px;color:#f97316}
    .logo-sub{color:#888;font-size:9px;margin-top:2px}
    .prog-name{font-size:15px;font-weight:700;text-align:right;color:#111}
    .prog-proj{color:#555;font-size:10px;text-align:right;margin-top:2px}
    .meta{background:#f8f8f8;border-radius:5px;padding:8px 14px;margin-bottom:14px;display:flex;gap:24px;font-size:10px}
    .meta-label{font-size:8px;text-transform:uppercase;letter-spacing:0.07em;color:#888;display:block;margin-bottom:1px}
    .meta-val{font-weight:700;color:#111}
    .gantt-wrap{border:1px solid #e5e7eb;border-radius:5px;overflow:hidden}
    .gantt-header{display:flex;background:#f97316}
    .col-task{width:190px;shrink:0;padding:6px 8px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:white;border-right:1px solid rgba(255,255,255,0.2)}
    .col-status{width:70px;shrink:0;padding:6px 8px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:white;text-align:center;border-right:1px solid rgba(255,255,255,0.2)}
    .col-bar{flex:1;padding:5px 6px;position:relative;height:32px;overflow:hidden}
    .footer{margin-top:20px;border-top:1px solid #e5e7eb;padding-top:7px;font-size:8px;color:#aaa;display:flex;justify-content:space-between}
    @media print{body{padding:14px 16px}@page{size:A4 landscape;margin:10mm 12mm}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">VYSITE</div>
      <div class="logo-sub">Programme — Gantt View &nbsp;·&nbsp; ${dateStr}</div>
    </div>
    <div>
      <div class="prog-name">${activeProgramme.title}</div>
      <div class="prog-proj">${project.name}</div>
    </div>
  </div>
  <div class="meta">
    <div><span class="meta-label">Project</span><span class="meta-val">${project.name}</span></div>
    <div><span class="meta-label">Programme</span><span class="meta-val">${activeProgramme.title}</span></div>
    <div><span class="meta-label">Created By</span><span class="meta-val">${activeProgramme.created_by}</span></div>
    ${r ? `<div><span class="meta-label">Date Range</span><span class="meta-val">${r.minDate.toLocaleDateString('en-GB')} – ${r.maxDate.toLocaleDateString('en-GB')}</span></div>` : ''}
    <div><span class="meta-label">Tasks</span><span class="meta-val">${programmeTasks.length}</span></div>
    <div><span class="meta-label">Complete</span><span class="meta-val">${programmeTasks.filter(t => t.status === 'Complete').length} / ${programmeTasks.length}</span></div>
  </div>
  ${programmeTasks.length === 0 || !r
    ? '<p style="color:#999;font-size:11px;padding:12px 0">No tasks with dates to display. Set start and finish dates on tasks to generate a Gantt chart.</p>'
    : `<div class="gantt-wrap">
    <div class="gantt-header">
      <div class="col-task">#&nbsp;&nbsp;Task / Assigned</div>
      <div class="col-status">Status</div>
      <div class="col-bar" style="position:relative">
        ${weekHeaders}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <tbody>${taskRows}</tbody>
    </table>
  </div>`}
  <div class="footer">
    <span>Generated by VYSITE &nbsp;·&nbsp; ${activeProgramme.title} &nbsp;·&nbsp; ${project.name}</span>
    <span>Printed ${new Date().toLocaleDateString('en-GB')}</span>
  </div>
  <script>window.onload=function(){window.print();};<\/script>
</body>
</html>`;
    openPrintWindow(html);
  }

  // ── Programme form ──
  function ProgrammeForm({ prog, onSave, onClose }: { prog?: DBProgramme; onSave: (p: DBProgramme) => void; onClose: () => void }) {
    const [form, setForm] = useState({ title: prog?.title ?? '', description: prog?.description ?? '' });
    function handleSave() {
      if (!form.title.trim()) return;
      const now = new Date().toISOString();
      onSave({
        id: prog?.id ?? crypto.randomUUID(),
        project_id: project.id,
        project_name: project.name,
        title: form.title.trim(),
        description: form.description.trim(),
        created_by: prog?.created_by ?? currentUserName,
        created_at: prog?.created_at ?? now,
        updated_at: now,
      });
      onClose();
    }
    return (
      <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
            <h3 className="text-base font-bold text-white">{prog ? 'Edit Programme' : 'New Programme'}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={16} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className={labelCls}>Programme Title *</label>
              <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="e.g. Commissioning Programme" />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls + ' resize-none'} placeholder="Optional description or scope notes" />
            </div>
          </div>
          <div className="flex gap-3 p-5 border-t border-[#1e2d4a]">
            <button onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={!form.title.trim()} className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {prog ? 'Save Changes' : 'Create Programme'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Task form ──
  function TaskForm({ task, onSave, onClose }: { task?: DBProgrammeTask; onSave: (t: DBProgrammeTask) => void; onClose: () => void }) {
    const [form, setForm] = useState({
      task_name: task?.task_name ?? '',
      assigned_to: task?.assigned_to ?? '',
      start_date: task?.start_date ?? '',
      finish_date: task?.finish_date ?? '',
      status: task?.status ?? 'Not Started' as ProgrammeTaskStatus,
      notes: task?.notes ?? '',
    });
    function handleSave() {
      if (!form.task_name.trim()) return;
      onSave({
        id: task?.id ?? crypto.randomUUID(),
        programme_id: activeProgramme!.id,
        project_id: project.id,
        task_name: form.task_name.trim(),
        assigned_to: form.assigned_to.trim(),
        start_date: form.start_date,
        finish_date: form.finish_date,
        status: form.status,
        notes: form.notes.trim(),
        sort_order: task?.sort_order ?? (programmeTasks.length + 1) * 10,
      });
      onClose();
    }
    return (
      <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
            <h3 className="text-base font-bold text-white">{task ? 'Edit Task' : 'Add Task'}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={16} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className={labelCls}>Task Name *</label>
              <input autoFocus value={form.task_name} onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))} className={inputCls} placeholder="e.g. Complete panel installation" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Assigned To</label>
                <input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className={inputCls} placeholder="Name or team" />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProgrammeTaskStatus }))} className={inputCls}>
                  {(['Not Started', 'In Progress', 'Awaiting Others', 'Blocked', 'Complete'] as ProgrammeTaskStatus[]).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Finish Date</label>
                <input type="date" value={form.finish_date} onChange={e => setForm(f => ({ ...f, finish_date: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls + ' resize-none'} placeholder="Optional notes" />
            </div>
          </div>
          <div className="flex gap-3 p-5 border-t border-[#1e2d4a]">
            <button onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={!form.task_name.trim()} className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {task ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Programme selector + new button */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
        <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <GanttChart size={16} className="text-[#f97316] shrink-0" />
            <h3 className="text-sm font-semibold text-white">Programmes</h3>
            <span className="text-[10px] text-slate-600">({projectProgrammes.length})</span>
            {projectProgrammes.length > 0 && (
              <div className="flex gap-1 ml-2 overflow-x-auto">
                {projectProgrammes.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProgrammeId(p.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeProgramme?.id === p.id
                        ? 'bg-[#f97316] text-white'
                        : 'text-slate-400 hover:text-white hover:bg-[#0d1628]'
                    }`}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {activeProgramme && canExport && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d4a] text-slate-400 rounded-lg text-xs font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                >
                  <Printer size={12} />Export<ChevronDown size={11} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-[#1a2236] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden z-50 w-52">
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider px-3 pt-2.5 pb-1.5">Export Format</p>
                    <button
                      onClick={exportListPDF}
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-[#0d1628] transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded bg-[#0d1628] flex items-center justify-center shrink-0 mt-0.5">
                        <FileText size={13} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-300">List View PDF</p>
                        <p className="text-[10px] text-slate-600">Portrait — tasks, owners, dates, status</p>
                      </div>
                    </button>
                    <button
                      onClick={exportGanttPDF}
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-[#0d1628] transition-colors text-left border-t border-[#1e2d4a]"
                    >
                      <div className="w-7 h-7 rounded bg-[#0d1628] flex items-center justify-center shrink-0 mt-0.5">
                        <GanttChart size={13} className="text-[#f97316]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-300">Gantt View PDF</p>
                        <p className="text-[10px] text-slate-600">Landscape — timeline bars, dates</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
            {activeProgramme && canEdit && (
              <button
                onClick={() => setEditingProgramme(activeProgramme)}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] rounded-lg transition-colors"
                title="Edit programme"
              >
                <Pencil size={13} />
              </button>
            )}
            {activeProgramme && canDelete && (
              <button
                onClick={() => setDeleteTarget({ type: 'programme', id: activeProgramme.id, label: activeProgramme.title })}
                className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                title="Delete programme"
              >
                <Trash2 size={13} />
              </button>
            )}
            {canCreate && (
              <button
                onClick={() => setShowNewProgramme(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus size={13} />New Programme
              </button>
            )}
          </div>
        </div>

        {projectProgrammes.length === 0 ? (
          <div className="py-14 text-center">
            <GanttChart size={36} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No programmes yet</p>
            {canCreate && (
              <button
                onClick={() => setShowNewProgramme(true)}
                className="mt-3 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
              >
                Create First Programme
              </button>
            )}
          </div>
        ) : activeProgramme ? (
          <div>
            {/* Programme meta row */}
            <div className="px-4 py-3 flex flex-wrap items-center gap-4 border-b border-[#1e2d4a] bg-[#0d1628]/40">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Created by</span>
                <p className="text-xs font-semibold text-slate-300">{activeProgramme.created_by}</p>
              </div>
              {activeProgramme.created_at && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Created</span>
                  <p className="text-xs font-semibold text-slate-300">{new Date(activeProgramme.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              )}
              {activeProgramme.description && (
                <p className="text-xs text-slate-500 flex-1">{activeProgramme.description}</p>
              )}
              {/* View toggle */}
              <div className="ml-auto flex gap-1 bg-[#0d1628] rounded-lg p-0.5 border border-[#1e2d4a]">
                <button onClick={() => setView('list')} className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${view === 'list' ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>List</button>
                <button onClick={() => setView('gantt')} className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${view === 'gantt' ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>Gantt</button>
              </div>
            </div>

            {/* Tasks header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <p className="text-xs font-semibold text-slate-400">Tasks ({programmeTasks.length})</p>
              {canCreate && (
                <button
                  onClick={() => setShowNewTask(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-[#f97316] hover:text-orange-400 transition-colors"
                >
                  <Plus size={13} />Add Task
                </button>
              )}
            </div>

            {programmeTasks.length === 0 ? (
              <div className="py-8 text-center border-t border-[#1e2d4a]">
                <p className="text-sm text-slate-600">No tasks yet</p>
                {canCreate && (
                  <button onClick={() => setShowNewTask(true)} className="mt-2 text-xs text-[#f97316] font-semibold hover:text-orange-400">Add first task →</button>
                )}
              </div>
            ) : view === 'list' ? (
              /* ── List View ── */
              <div className="border-t border-[#1e2d4a] divide-y divide-[#1e2d4a]">
                {programmeTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#0d1628]/40 group">
                    <GripVertical size={13} className="text-slate-700 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-200">{task.task_name}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TASK_STATUS_COLORS[task.status]}`}>{task.status}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                        {task.assigned_to && <span>{task.assigned_to}</span>}
                        {task.start_date && <span>{new Date(task.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                        {task.start_date && task.finish_date && <span>→</span>}
                        {task.finish_date && <span>{new Date(task.finish_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                        {task.notes && <span className="text-slate-600 italic line-clamp-1">{task.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {canEdit && (
                        <button onClick={() => setEditingTask(task)} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] rounded transition-colors" title="Edit">
                          <Pencil size={12} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteTarget({ type: 'task', id: task.id, label: task.task_name })} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors" title="Delete">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Gantt View ── */
              <div className="border-t border-[#1e2d4a] overflow-x-auto">
                {!range ? (
                  <p className="text-sm text-slate-500 text-center py-8">Set start and finish dates on tasks to see the Gantt chart.</p>
                ) : (
                  <div className="min-w-[700px]">
                    {/* Date header */}
                    <div className="flex border-b border-[#1e2d4a] bg-[#0d1628]/60">
                      <div className="w-56 shrink-0 px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-r border-[#1e2d4a]">Task</div>
                      <div className="flex-1 relative px-2 py-2">
                        <div className="flex justify-between">
                          <span className="text-[10px] text-slate-600">{range.minDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          <span className="text-[10px] text-slate-600">{range.maxDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                    </div>
                    {programmeTasks.map(task => {
                      const start = task.start_date ? new Date(task.start_date) : null;
                      const end = task.finish_date ? new Date(task.finish_date) : null;
                      let leftPct = 0, widthPct = 0;
                      if (start && end && range) {
                        const startOffset = Math.max(0, (start.getTime() - range.minDate.getTime()) / 86400000);
                        const dur = Math.max(1, (end.getTime() - start.getTime()) / 86400000 + 1);
                        leftPct = (startOffset / range.totalDays) * 100;
                        widthPct = Math.min((dur / range.totalDays) * 100, 100 - leftPct);
                      }
                      return (
                        <div key={task.id} className="flex border-b border-[#1e2d4a] hover:bg-[#0d1628]/30 group">
                          <div className="w-56 shrink-0 px-4 py-2.5 border-r border-[#1e2d4a]">
                            <p className="text-xs font-medium text-slate-300 line-clamp-1">{task.task_name}</p>
                            <p className="text-[10px] text-slate-600 mt-0.5">{task.assigned_to || '—'}</p>
                          </div>
                          <div className="flex-1 relative px-2 flex items-center min-h-[44px]">
                            {(start && end) ? (
                              <div
                                className={`absolute h-6 rounded flex items-center px-2 ${TASK_STATUS_BAR[task.status]}`}
                                style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%` }}
                                title={`${task.task_name} — ${task.status}`}
                              >
                                <span className="text-[10px] font-semibold text-white truncate">{task.task_name}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-700 italic px-2">No dates set</span>
                            )}
                            <div className="absolute right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canEdit && (
                                <button onClick={() => setEditingTask(task)} className="p-1 text-slate-500 hover:text-slate-300 bg-[#1a2236] rounded transition-colors">
                                  <Pencil size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Modals */}
      {showNewProgramme && (
        <ProgrammeForm onSave={onAddProgramme} onClose={() => setShowNewProgramme(false)} />
      )}
      {editingProgramme && (
        <ProgrammeForm prog={editingProgramme} onSave={onUpdateProgramme} onClose={() => setEditingProgramme(null)} />
      )}
      {showNewTask && activeProgramme && (
        <TaskForm onSave={onAddTask} onClose={() => setShowNewTask(false)} />
      )}
      {editingTask && (
        <TaskForm task={editingTask} onSave={onUpdateTask} onClose={() => setEditingTask(null)} />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          title={`Delete ${deleteTarget.type === 'programme' ? 'Programme' : 'Task'}`}
          description={`Are you sure you want to delete "${deleteTarget.label}"?${deleteTarget.type === 'programme' ? ' All tasks in this programme will also be deleted.' : ''}`}
          onConfirm={() => {
            if (deleteTarget.type === 'programme') {
              onRemoveProgramme(deleteTarget.id);
              setSelectedProgrammeId(null);
            } else {
              onRemoveTask(deleteTarget.id);
            }
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Project Detail ─────────────────────────────────────────────────────────────

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onNavigate: (page: 'snagging' | 'actions' | 'site-forms' | 'testing', open?: PendingOpen) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ProjectDetail({ project, onBack, onNavigate, onEdit, onDelete }: ProjectDetailProps) {
  const store = useAppStore();
  const perms = usePermissions();
  const isAdmin = store.currentUser?.role === 'Admin';
  const canEdit = perms['projects.edit'] || isAdmin;
  const canDelete = perms['projects.delete'] || isAdmin;
  const canUploadDocs = perms['docs.upload'];
  const canDeleteDocs = perms['docs.delete'] || isAdmin;

  // Tab visibility driven by module permissions
  const hiddenTabs = new Set<DetailTab>();
  if (!perms['modules.snagging']) hiddenTabs.add('snags');
  if (!perms['modules.actions']) hiddenTabs.add('actions');
  if (!perms['modules.site_forms']) hiddenTabs.add('forms');
  if (!perms['modules.testing']) hiddenTabs.add('testing');
  if (!perms['modules.comments'] && !canEdit) hiddenTabs.add('activity');
  if (!perms['docs.view'] && !canEdit) hiddenTabs.add('documents');
  if (!perms['programmes.view']) hiddenTabs.add('programmes');

  const visibleTabs = TABS.filter(t => !hiddenTabs.has(t.id));

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // If the current tab becomes hidden (e.g. after a permission change), fall back to overview
  const safeActiveTab: DetailTab = hiddenTabs.has(activeTab) ? 'overview' : activeTab;

  // Progress is driven by commercial values — committed / contract value
  const contractNum  = project.value    ? parseFloat(project.value.replace(/[£,\s]/g, ''))    : 0;
  const committedNum = project.committed != null ? project.committed : null;
  const localProgress = contractNum > 0
    ? Math.min(100, Math.round(((committedNum ?? 0) / contractNum) * 100))
    : project.progress;
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<DBProjectDocument | null>(null);

  const projectSnags = useMemo(() => store.snags.filter(s => s.projectId === project.id || s.projectName === project.name), [store.snags, project]);
  const projectActions = useMemo(() => store.actions.filter(a => a.projectId === project.id || a.projectName === project.name), [store.actions, project]);
  const projectForms = useMemo(() => store.siteForms.filter(f => f.project_id === project.id || f.project_name === project.name), [store.siteForms, project]);
  const projectTC = useMemo(() => store.tcRecords.filter(r => r.project_id === project.id || r.project_name === project.name), [store.tcRecords, project]);
  const projectDocs = useMemo(() => store.projectDocuments.filter(d => d.project_id === project.id), [store.projectDocuments, project]);
  const projectProgrammes = useMemo(() => store.programmes.filter(p => p.project_id === project.id), [store.programmes, project]);
  const projectKeyDates = useMemo(() => store.keyDates.filter(d => d.project_id === project.id), [store.keyDates, project]);

  // Build an activity feed from all linked records, sorted newest first
  const activityFeed = useMemo(() => {
    const items: { id: string; icon: React.ElementType; iconColor: string; text: string; sub: string; ts: string; linkedType?: string; linkedId?: string; page?: 'snagging' | 'actions' | 'site-forms' | 'testing' }[] = [];

    projectActions.forEach(a => items.push({
      id: `act-${a.id}`,
      icon: CheckSquare,
      iconColor: 'text-blue-400',
      text: `Action: ${a.title}`,
      sub: `${a.owner} · ${a.status}${a.overdue && a.status !== 'Complete' ? ' · OVERDUE' : ''}`,
      ts: a.createdDate || '',
      linkedType: 'action',
      linkedId: a.id,
      page: 'actions',
    }));

    projectSnags.forEach(s => items.push({
      id: `sna-${s.id}`,
      icon: AlertTriangle,
      iconColor: 'text-red-400',
      text: `Snag: ${s.title}`,
      sub: `${s.raisedBy} · ${s.priority} · ${s.status}`,
      ts: s.raisedDate || '',
      linkedType: 'snag',
      linkedId: s.id,
      page: 'snagging',
    }));

    projectForms.forEach(f => items.push({
      id: `frm-${f.id}`,
      icon: ClipboardList,
      iconColor: 'text-emerald-400',
      text: `${f.type}: submitted`,
      sub: `${f.completed_by} · ${f.status}`,
      ts: f.submitted_date || f.date || '',
      linkedType: 'form',
      linkedId: f.id,
      page: 'site-forms',
    }));

    projectTC.forEach(r => items.push({
      id: `tc-${r.id}`,
      icon: Wrench,
      iconColor: 'text-teal-400',
      text: `T&C: ${r.title}`,
      sub: `${r.engineer} · ${r.category} · ${r.status}`,
      ts: r.date || '',
      linkedType: 'testing',
      linkedId: r.id,
      page: 'testing',
    }));

    projectDocs.forEach(d => items.push({
      id: `doc-${d.id}`,
      icon: Upload,
      iconColor: 'text-orange-400',
      text: `Document uploaded: ${d.name}`,
      sub: `${d.uploaded_by || 'Unknown'} · ${d.category}`,
      ts: d.created_at || '',
    }));

    return items.sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0));
  }, [projectActions, projectSnags, projectForms, projectTC, projectDocs]);

  function handlePrint() {
    const today = new Date();
    const exportedDate = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const openSnags = projectSnags.filter(s => s.status !== 'Closed').length;
    const openActions = projectActions.filter(a => a.status !== 'Complete').length;
    const progress = localProgress;

    // KPI counts
    const snagOpen = projectSnags.filter(s => s.status === 'Open').length;
    const snagInProg = projectSnags.filter(s => s.status === 'In Progress').length;
    const snagClosed = projectSnags.filter(s => s.status === 'Closed').length;
    const actOpen = projectActions.filter(a => a.status !== 'Complete').length;
    const actComplete = projectActions.filter(a => a.status === 'Complete').length;

    const snagRows = projectSnags.map(s => `
      <tr>
        <td style="font-weight:600;">${esc(s.title)}</td>
        <td>${esc(s.priority)}</td>
        <td><span class="badge ${s.status === 'Closed' ? 'badge-green' : s.status === 'In Progress' ? 'badge-blue' : 'badge-red'}">${esc(s.status)}</span></td>
        <td>${esc(s.location || '—')}</td>
        <td>${esc(s.assignedTo || '—')}</td>
      </tr>`).join('');

    const actionRows = projectActions.map(a => `
      <tr>
        <td style="font-weight:600;">${esc(a.title)}</td>
        <td><span class="badge ${a.priority === 'High' ? 'badge-red' : a.priority === 'Medium' ? 'badge-amber' : 'badge-slate'}">${esc(a.priority)}</span></td>
        <td><span class="badge ${a.status === 'Complete' ? 'badge-green' : a.status === 'In Progress' ? 'badge-blue' : 'badge-amber'}">${esc(a.status)}</span></td>
        <td>${esc(a.owner || '—')}</td>
        <td>${a.dueDate ? fmtDate(a.dueDate) : '—'}</td>
      </tr>`).join('');

    const formRows = projectForms.map(f => `
      <tr>
        <td style="font-weight:600;">${esc(f.type)}</td>
        <td>${esc(f.completed_by || '—')}</td>
        <td><span class="badge ${f.status === 'Complete' ? 'badge-green' : 'badge-amber'}">${esc(f.status)}</span></td>
        <td>${f.date ? fmtDate(f.date) : '—'}</td>
      </tr>`).join('');

    const tcRows = projectTC.map(r => `
      <tr>
        <td style="font-weight:600;">${esc(r.title || '—')}</td>
        <td>${esc(r.category || '—')}</td>
        <td>${esc(r.area || '—')}</td>
        <td><span class="badge ${r.status === 'Complete' ? 'badge-green' : r.status === 'In Progress' ? 'badge-blue' : r.status === 'Failed' ? 'badge-red' : r.status === 'On Hold' ? 'badge-amber' : 'badge-slate'}">${esc(r.status || '—')}</span></td>
        <td>${esc(r.engineer || '—')}</td>
        <td>${r.date ? fmtDate(r.date) : '—'}</td>
      </tr>`).join('');

    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    const sortedKd = [...projectKeyDates].sort((a, b) => {
      if (!a.date) return 1; if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    const kdRows = sortedKd.map(d => {
      const isOverdue = d.status === 'Open' && d.date && new Date(d.date) < todayMidnight;
      const label = d.status === 'Closed' ? 'Closed' : isOverdue ? 'Overdue' : 'Open';
      const badgeCls = d.status === 'Closed' ? 'badge-green' : isOverdue ? 'badge-red' : 'badge-amber';
      const dr = d.status === 'Open' && d.date ? (() => {
        const diff = Math.round((new Date(d.date).getTime() - todayMidnight.getTime()) / 86400000);
        if (diff === 0) return 'Today';
        if (diff < 0) return `${Math.abs(diff)}d overdue`;
        return `${diff}d remaining`;
      })() : '—';
      return `<tr>
        <td>${fmtDate(d.date)}</td>
        <td style="font-weight:600;">${esc(d.title)}</td>
        <td><span class="badge ${badgeCls}">${esc(label)}</span></td>
        <td>${esc(dr)}</td>
        <td style="color:#64748b;">${esc(d.description || '—')}</td>
        <td style="color:#64748b;font-style:italic;">${esc(d.comments || '—')}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${esc(project.name)} — Project Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      color: #1e293b; background: white; font-size: 11px; line-height: 1.5;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .page { max-width: 880px; margin: 0 auto; padding: 36px 40px; }
    .doc-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid #f97316; margin-bottom: 20px; }
    .doc-logo { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: 0.05em; }
    .doc-type-label { font-size: 10px; color: #64748b; margin-top: 4px; }
    .doc-header-right { text-align: right; }
    .doc-title { font-size: 18px; font-weight: 900; color: #111; margin-bottom: 4px; line-height: 1.25; }
    .doc-dateline { font-size: 11px; color: #64748b; }
    .meta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 20px; }
    .meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
    .meta-value { font-size: 11px; font-weight: 600; color: #0f172a; }
    .progress-wrap { margin: 14px 0 4px; }
    .progress-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; display: flex; justify-content: space-between; }
    .progress-track { height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; }
    .progress-fill { height: 100%; background: #f97316; border-radius: 20px; }
    .kpi-bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 14px 0; }
    .kpi-cell { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; text-align: center; }
    .kpi-value { font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1; }
    .kpi-label { font-size: 8.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 4px; }
    .kpi-orange { color: #f97316; } .kpi-red { color: #dc2626; } .kpi-green { color: #059669; } .kpi-blue { color: #2563eb; } .kpi-amber { color: #d97706; }
    .section-heading { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 12px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f97316; color: #fff; font-weight: 700; padding: 8px 10px; text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; font-size: 10px; }
    tr:nth-child(even) td { background: #fafafa; }
    .badge { display: inline-block; padding: 2px 9px; border-radius: 9999px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge-green  { background: #d1fae5; color: #065f46; }
    .badge-red    { background: #fee2e2; color: #991b1b; }
    .badge-amber  { background: #fef3c7; color: #92400e; }
    .badge-blue   { background: #dbeafe; color: #1d4ed8; }
    .badge-slate  { background: #f1f5f9; color: #475569; }
    .badge-orange { background: #fff7ed; color: #c2410c; }
    .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
    @media print { body { padding: 0; } .page { padding: 20px 24px; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="doc-header">
      <div>
        <div class="doc-logo">VYSITE</div>
        <div class="doc-type-label">Project Report</div>
      </div>
      <div class="doc-header-right">
        <div class="doc-title">${esc(project.name)}</div>
        <div class="doc-dateline">${esc(project.client || '')}${project.client ? ' &mdash; ' : ''}Exported ${exportedDate}</div>
      </div>
    </div>

    <div class="meta-block">
      <div class="meta-grid">
        <div><div class="meta-label">Status</div><div class="meta-value">${esc(project.status)}</div></div>
        <div><div class="meta-label">Project Manager</div><div class="meta-value">${esc(project.projectManager || '—')}</div></div>
        <div><div class="meta-label">Location</div><div class="meta-value">${esc(project.location || '—')}</div></div>
        <div><div class="meta-label">Open Key Dates</div><div class="meta-value">${projectKeyDates.filter(d => d.status === 'Open').length}</div></div>
        <div><div class="meta-label">Start Date</div><div class="meta-value">${fmtDate(project.startDate)}</div></div>
        <div><div class="meta-label">Completion Date</div><div class="meta-value">${fmtDate(project.completionDate)}</div></div>
        <div><div class="meta-label">Open Snags</div><div class="meta-value">${openSnags}</div></div>
        <div><div class="meta-label">Open Actions</div><div class="meta-value">${openActions}</div></div>
      </div>
      <div class="progress-wrap">
        <div class="progress-label"><span>Overall Progress</span><span>${progress}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
      </div>
      <div class="kpi-bar">
        <div class="kpi-cell"><div class="kpi-value kpi-red">${snagOpen}</div><div class="kpi-label">Snags Open</div></div>
        <div class="kpi-cell"><div class="kpi-value kpi-blue">${snagInProg}</div><div class="kpi-label">In Progress</div></div>
        <div class="kpi-cell"><div class="kpi-value kpi-green">${snagClosed}</div><div class="kpi-label">Snags Closed</div></div>
        <div class="kpi-cell"><div class="kpi-value kpi-amber">${actOpen}</div><div class="kpi-label">Actions Open</div></div>
        <div class="kpi-cell"><div class="kpi-value kpi-green">${actComplete}</div><div class="kpi-label">Actions Done</div></div>
      </div>
    </div>

    ${projectKeyDates.length > 0 ? `
    <div class="section-heading">Key Dates (${projectKeyDates.length})</div>
    <table>
      <thead><tr><th style="width:90px;">Date</th><th>Title</th><th style="width:80px;">Status</th><th style="width:100px;">Days Remaining</th><th>Description</th><th>Notes</th></tr></thead>
      <tbody>${kdRows}</tbody>
    </table>` : ''}

    ${projectSnags.length > 0 ? `
    <div class="section-heading">Snags (${projectSnags.length})</div>
    <table>
      <thead><tr><th>Title</th><th style="width:70px;">Priority</th><th style="width:80px;">Status</th><th style="width:120px;">Location</th><th style="width:120px;">Assigned To</th></tr></thead>
      <tbody>${snagRows}</tbody>
    </table>` : ''}

    ${projectActions.length > 0 ? `
    <div class="section-heading">Actions (${projectActions.length})</div>
    <table>
      <thead><tr><th>Title</th><th style="width:70px;">Priority</th><th style="width:90px;">Status</th><th style="width:110px;">Owner</th><th style="width:90px;">Due Date</th></tr></thead>
      <tbody>${actionRows}</tbody>
    </table>` : ''}

    ${projectForms.length > 0 ? `
    <div class="section-heading">Site Forms (${projectForms.length})</div>
    <table>
      <thead><tr><th>Type</th><th style="width:130px;">Completed By</th><th style="width:80px;">Status</th><th style="width:90px;">Date</th></tr></thead>
      <tbody>${formRows}</tbody>
    </table>` : ''}

    ${projectTC.length > 0 ? `
    <div class="section-heading">Testing &amp; Commissioning (${projectTC.length})</div>
    <table>
      <thead><tr><th>Title</th><th style="width:100px;">Category</th><th style="width:100px;">Area</th><th style="width:90px;">Status</th><th style="width:110px;">Engineer</th><th style="width:90px;">Date</th></tr></thead>
      <tbody>${tcRows}</tbody>
    </table>` : ''}

    <div class="footer">
      <span>VYSITE &bull; Construction Operating System &bull; ${esc(project.name)}</span>
      <span>&copy; VYSITE. All rights reserved. Confidential.</span>
    </div>
  </div>
  <script>window.onload=function(){window.print();};<\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, '_blank');
    if (tab) {
      tab.addEventListener('afterprint', () => URL.revokeObjectURL(url), { once: true });
    } else {
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }

  async function handleSaveDocument(doc: DBProjectDocument) {
    await store.addProjectDocument(doc);
  }

  const snagStatusCounts = {
    Open: projectSnags.filter(s => s.status === 'Open').length,
    'In Progress': projectSnags.filter(s => s.status === 'In Progress').length,
    Closed: projectSnags.filter(s => s.status === 'Closed').length,
  };

  const actionStatusCounts = {
    'Not Started': projectActions.filter(a => a.status === 'Not Started').length,
    'In Progress': projectActions.filter(a => a.status === 'In Progress').length,
    Waiting: projectActions.filter(a => a.status === 'Waiting').length,
    Complete: projectActions.filter(a => a.status === 'Complete').length,
  };

  const tabCounts: Partial<Record<DetailTab, number>> = {
    snags: projectSnags.length,
    actions: projectActions.length,
    forms: projectForms.length,
    testing: projectTC.length,
    documents: projectDocs.length,
    programmes: projectProgrammes.length,
    dates: projectKeyDates.length,
    activity: activityFeed.length,
  };

  return (
    <div className="p-4 lg:p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 mb-4 transition-colors">
        <ArrowLeft size={16} />Back to Projects
      </button>

      {/* Project header card */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-white">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-sm text-slate-500">{project.client}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-sm font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
            >
              <Printer size={14} />Export
            </button>
            {canEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-sm font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
              >
                <Pencil size={14} />Edit Project
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a2236] border border-red-900/50 text-slate-400 rounded-lg text-sm font-semibold hover:border-red-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />Delete
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {[
            { icon: MapPin, label: 'Location', value: project.location.split(',').slice(-2).join(',').trim() },
            { icon: User, label: 'Project Manager', value: project.projectManager },
            { icon: Calendar, label: 'Start Date', value: new Date(project.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
            { icon: Calendar, label: 'Completion', value: new Date(project.completionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2">
              <item.icon size={15} className="text-slate-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</p>
                <p className="text-sm text-slate-300 font-medium">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-slate-400">Overall Progress</span>
            <span className="font-bold text-[#f97316] text-base">{localProgress}%</span>
          </div>
          <div className="w-full bg-[#0d1628] rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-[#f97316] transition-all"
              style={{ width: `${localProgress}%` }}
            />
          </div>
          {contractNum > 0 ? (
            <p className="text-xs text-slate-600 mt-1.5">Calculated from commercial values — update in the Commercial module.</p>
          ) : (
            <p className="text-xs text-slate-600 mt-1.5">Set Contract &amp; Completed values in the Commercial module to drive progress.</p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-1 mb-4 overflow-x-auto">
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          const count = tabCounts[tab.id];
          const isActive = safeActiveTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                isActive ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-[#0d1628]'
              }`}
            >
              <Icon size={13} />
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-[#0d1628] text-slate-400'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Overview tab ─────────────────────────────────────────────────────── */}
      {safeActiveTab === 'overview' && (
        <div className="space-y-4">

          {/* Key Dates — full-width banner */}
          {(() => {
            const todayKD = new Date(); todayKD.setHours(0,0,0,0);
            const openDates = projectKeyDates.filter(d => d.status === 'Open');
            const upcomingDates = openDates
              .filter(d => d.date && new Date(d.date) >= todayKD)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const overdueDates = openDates.filter(d => d.date && new Date(d.date) < todayKD);
            const hasOverdue = overdueDates.length > 0;

            function daysRemainingColor(days: number): string {
              if (days < 0)  return 'text-red-400';
              if (days < 7)  return 'text-orange-400';
              if (days <= 14) return 'text-amber-400';
              return 'text-emerald-400';
            }

            return (
              <div
                className={`rounded-xl border cursor-pointer transition-colors ${hasOverdue ? 'border-red-900/60 bg-red-950/20 hover:border-red-800/80' : 'border-[#f97316]/40 bg-[#1a2236] hover:border-[#f97316]/70'}`}
                onClick={() => setActiveTab('dates')}
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-inherit">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${hasOverdue ? 'bg-red-900/60' : 'bg-[#f97316]/20'}`}>
                      <Calendar size={17} className={hasOverdue ? 'text-red-400' : 'text-[#f97316]'} />
                    </div>
                    <div>
                      <span className="text-base font-bold text-white tracking-tight">Key Dates</span>
                      {projectKeyDates.length > 0 && (
                        <span className="text-xs text-slate-500 ml-2">{projectKeyDates.length} total · {openDates.length} open</span>
                      )}
                    </div>
                    {hasOverdue && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-900/60 text-red-400">
                        {overdueDates.length} overdue
                      </span>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setActiveTab('dates'); }}
                    className="text-xs font-semibold text-[#f97316] hover:text-orange-400 transition-colors flex items-center gap-1"
                  >
                    View All Key Dates <ChevronRight size={12} />
                  </button>
                </div>

                {projectKeyDates.length === 0 ? (
                  <div className="flex items-center justify-between px-5 py-5">
                    <p className="text-sm text-slate-500">No key dates added for this project</p>
                    <button
                      onClick={e => { e.stopPropagation(); setActiveTab('dates'); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Plus size={12} />Add Key Date
                    </button>
                  </div>
                ) : upcomingDates.length > 0 ? (
                  <div className="px-5 pt-4 pb-3">
                    <p className="text-[10px] font-semibold text-[#f97316] uppercase tracking-widest mb-3">Next Upcoming Key Dates</p>
                    <div className="space-y-0 divide-y divide-[#1e2d4a]">
                      {upcomingDates.slice(0, 5).map(d => {
                        const daysLeft = Math.round((new Date(d.date).getTime() - todayKD.getTime()) / 86400000);
                        const daysLabel = daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1 day' : `${daysLeft} days`;
                        const daysColor = daysRemainingColor(daysLeft);
                        return (
                          <div key={d.id} className="flex items-center gap-4 py-2.5">
                            <span className="text-xs font-semibold text-[#f97316] w-28 shrink-0">
                              {new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">{d.title}</span>
                            <span className={`text-xs font-bold shrink-0 ${daysColor}`}>{daysLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                    {upcomingDates.length > 5 && (
                      <p className="text-[11px] text-slate-500 mt-2">+{upcomingDates.length - 5} more upcoming dates</p>
                    )}
                  </div>
                ) : (
                  <div className="px-5 py-5 flex flex-wrap items-center gap-4">
                    {hasOverdue ? (
                      <p className="text-sm text-red-400 font-medium">
                        {overdueDates.length} open date{overdueDates.length !== 1 ? 's' : ''} past due — check Key Dates tab
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">No upcoming key dates</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 2-col grid: Snags / Actions / Forms / T&C */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Snags summary */}
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <div
              className={`flex items-center justify-between p-4 border-b border-[#1e2d4a] rounded-t-xl ${!hiddenTabs.has('snags') ? 'cursor-pointer hover:bg-[#0d1628]/40 transition-colors' : ''}`}
              onClick={!hiddenTabs.has('snags') ? () => setActiveTab('snags') : undefined}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-400" />
                <span className="text-sm font-semibold text-white">Snags</span>
              </div>
              <div className="flex gap-3 items-center">
                {projectSnags.length > 0 && Object.entries(snagStatusCounts).filter(([, c]) => c > 0).map(([s, c]) => (
                  <span key={s} className="text-[10px] text-slate-500"><span className="font-bold text-slate-300">{c}</span> {s}</span>
                ))}
                {!hiddenTabs.has('snags') && projectSnags.length > 0 && <span className="text-[10px] text-[#f97316] font-semibold">View →</span>}
              </div>
            </div>
            <div className="divide-y divide-[#1e2d4a] max-h-56 overflow-y-auto">
              {projectSnags.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No snags raised</p>
              ) : projectSnags.slice(0, 5).map(snag => {
                const dotC: Record<string, string> = { Critical: 'bg-red-500', High: 'bg-orange-400', Medium: 'bg-amber-400', Low: 'bg-slate-600' };
                const sC: Record<string, string> = { Open: 'bg-red-900/60 text-red-400', 'In Progress': 'bg-blue-900/60 text-blue-400', Closed: 'bg-emerald-900/60 text-emerald-400' };
                return (
                  <div key={snag.id} className={`p-3 ${!hiddenTabs.has('snags') ? 'hover:bg-[#0d1628]/50 cursor-pointer' : ''}`}
                    onClick={!hiddenTabs.has('snags') ? () => onNavigate('snagging', { linkedType: 'snag', linkedId: snag.id }) : undefined}>
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotC[snag.priority]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-slate-300 line-clamp-1">{snag.title}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${sC[snag.status]}`}>{snag.status}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">{snag.location} · {snag.assignedTo}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {projectSnags.length > 5 && !hiddenTabs.has('snags') && (
                <button className="w-full py-2.5 text-xs text-[#f97316] font-semibold hover:bg-[#0d1628]/50" onClick={() => setActiveTab('snags')}>
                  +{projectSnags.length - 5} more snags →
                </button>
              )}
            </div>
          </div>

          {/* Actions summary */}
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <div
              className={`flex items-center justify-between p-4 border-b border-[#1e2d4a] rounded-t-xl ${!hiddenTabs.has('actions') ? 'cursor-pointer hover:bg-[#0d1628]/40 transition-colors' : ''}`}
              onClick={!hiddenTabs.has('actions') ? () => setActiveTab('actions') : undefined}
            >
              <div className="flex items-center gap-2">
                <CheckSquare size={15} className="text-blue-400" />
                <span className="text-sm font-semibold text-white">Actions</span>
              </div>
              <div className="flex gap-2 items-center">
                {projectActions.length > 0 && Object.entries(actionStatusCounts).filter(([, c]) => c > 0).map(([s, c]) => (
                  <span key={s} className="text-[10px] text-slate-500"><span className="font-bold text-slate-300">{c}</span> {s.split(' ')[0]}</span>
                ))}
                {!hiddenTabs.has('actions') && projectActions.length > 0 && <span className="text-[10px] text-[#f97316] font-semibold ml-1">View →</span>}
              </div>
            </div>
            <div className="divide-y divide-[#1e2d4a] max-h-56 overflow-y-auto">
              {projectActions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No actions raised</p>
              ) : projectActions.slice(0, 5).map(action => {
                const aC: Record<string, string> = {
                  'Not Started': 'bg-[#1e2d4a] text-slate-400',
                  'In Progress': 'bg-blue-900/60 text-blue-400',
                  Waiting: 'bg-amber-900/60 text-amber-400',
                  Complete: 'bg-emerald-900/60 text-emerald-400',
                };
                return (
                  <div key={action.id} className={`p-3 ${!hiddenTabs.has('actions') ? 'hover:bg-[#0d1628]/50 cursor-pointer' : ''}`}
                    onClick={!hiddenTabs.has('actions') ? () => onNavigate('actions', { linkedType: 'action', linkedId: action.id }) : undefined}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-slate-300 line-clamp-1">{action.title}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        {action.overdue && <span className="text-[9px] font-bold text-red-400 bg-red-900/50 px-1 py-0.5 rounded-full">OD</span>}
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${aC[action.status]}`}>{action.status}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{action.owner} · Due {new Date(action.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                  </div>
                );
              })}
              {projectActions.length > 5 && !hiddenTabs.has('actions') && (
                <button className="w-full py-2.5 text-xs text-[#f97316] font-semibold hover:bg-[#0d1628]/50" onClick={() => setActiveTab('actions')}>
                  +{projectActions.length - 5} more actions →
                </button>
              )}
            </div>
          </div>

          {/* Forms summary */}
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <div
              className={`flex items-center justify-between p-4 border-b border-[#1e2d4a] rounded-t-xl ${!hiddenTabs.has('forms') ? 'cursor-pointer hover:bg-[#0d1628]/40 transition-colors' : ''}`}
              onClick={!hiddenTabs.has('forms') ? () => setActiveTab('forms') : undefined}
            >
              <div className="flex items-center gap-2">
                <ClipboardList size={15} className="text-emerald-400" />
                <span className="text-sm font-semibold text-white">Site Forms</span>
              </div>
              {!hiddenTabs.has('forms') && projectForms.length > 0 && <span className="text-[10px] text-[#f97316] font-semibold">View {projectForms.length} →</span>}
            </div>
            <div className="divide-y divide-[#1e2d4a] max-h-44 overflow-y-auto">
              {projectForms.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No forms submitted</p>
              ) : projectForms.slice(0, 4).map(f => {
                const fC: Record<string, string> = { Submitted: 'bg-blue-900/60 text-blue-400', Approved: 'bg-emerald-900/60 text-emerald-400', Draft: 'bg-[#1e2d4a] text-slate-400' };
                return (
                  <div key={f.id} className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-300 line-clamp-1">{f.type}</p>
                      <p className="text-[11px] text-slate-500">{f.completed_by} · {f.date ? new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${fC[f.status] || ''}`}>{f.status}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* T&C summary */}
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <div
              className={`flex items-center justify-between p-4 border-b border-[#1e2d4a] rounded-t-xl ${!hiddenTabs.has('testing') ? 'cursor-pointer hover:bg-[#0d1628]/40 transition-colors' : ''}`}
              onClick={!hiddenTabs.has('testing') ? () => setActiveTab('testing') : undefined}
            >
              <div className="flex items-center gap-2">
                <Wrench size={15} className="text-teal-400" />
                <span className="text-sm font-semibold text-white">Testing & Commissioning</span>
              </div>
              {!hiddenTabs.has('testing') && projectTC.length > 0 && <span className="text-[10px] text-[#f97316] font-semibold">View {projectTC.length} →</span>}
            </div>
            <div className="divide-y divide-[#1e2d4a] max-h-44 overflow-y-auto">
              {projectTC.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No T&C records</p>
              ) : projectTC.slice(0, 4).map(r => {
                const tC: Record<string, string> = { 'Not Started': 'bg-[#1e2d4a] text-slate-400', 'In Progress': 'bg-blue-900/60 text-blue-400', Complete: 'bg-emerald-900/60 text-emerald-400', Failed: 'bg-red-900/60 text-red-400', 'On Hold': 'bg-amber-900/60 text-amber-400' };
                return (
                  <div key={r.id} className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-300 line-clamp-1">{r.title}</p>
                      <p className="text-[11px] text-slate-500">{r.category} · {r.engineer}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${tC[r.status] || ''}`}>{r.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ── Snags tab ─────────────────────────────────────────────────────────── */}
      {safeActiveTab === 'snags' && (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-white">Snags — {project.name}</h3>
            <button onClick={() => onNavigate('snagging')} className="text-xs text-[#f97316] font-semibold hover:text-orange-400 flex items-center gap-1">
              Open Snagging Module <ChevronRight size={12} />
            </button>
          </div>
          {projectSnags.length === 0 ? (
            <div className="py-10 text-center">
              <AlertTriangle size={32} className="text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No snags raised for this project</p>
              <p className="text-xs text-slate-600 mt-1">Open the Snagging module to raise a snag</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1e2d4a]">
              {projectSnags.map(snag => {
                const dotC: Record<string, string> = { Critical: 'bg-red-500', High: 'bg-orange-400', Medium: 'bg-amber-400', Low: 'bg-slate-600' };
                const sC: Record<string, string> = { Open: 'bg-red-900/60 text-red-400', 'In Progress': 'bg-blue-900/60 text-blue-400', Closed: 'bg-emerald-900/60 text-emerald-400' };
                return (
                  <div key={snag.id} className="p-4 hover:bg-[#0d1628]/50 cursor-pointer" onClick={() => onNavigate('snagging', { linkedType: 'snag', linkedId: snag.id })}>
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotC[snag.priority]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-200">{snag.title}</p>
                          <div className="flex gap-1.5 shrink-0">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0d1628] text-slate-400">{snag.priority}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sC[snag.status]}`}>{snag.status}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{snag.location} · Assigned: {snag.assignedTo}</p>
                        {snag.description && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{snag.description}</p>}
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-600">
                          <span>Raised: {snag.raisedDate ? new Date(snag.raisedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</span>
                          <span>Due: {snag.dueDate ? new Date(snag.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</span>
                          {snag.comments.length > 0 && <span>{snag.comments.length} comment{snag.comments.length !== 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Actions tab ───────────────────────────────────────────────────────── */}
      {safeActiveTab === 'actions' && (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-white">Actions — {project.name}</h3>
            <button onClick={() => onNavigate('actions')} className="text-xs text-[#f97316] font-semibold hover:text-orange-400 flex items-center gap-1">
              Open Actions Module <ChevronRight size={12} />
            </button>
          </div>
          {projectActions.length === 0 ? (
            <div className="py-10 text-center">
              <CheckSquare size={32} className="text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No actions created for this project</p>
              <p className="text-xs text-slate-600 mt-1">Open the Actions module to create an action</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1e2d4a]">
              {projectActions.map(action => {
                const aC: Record<string, string> = {
                  'Not Started': 'bg-[#1e2d4a] text-slate-400',
                  'In Progress': 'bg-blue-900/60 text-blue-400',
                  Waiting: 'bg-amber-900/60 text-amber-400',
                  Complete: 'bg-emerald-900/60 text-emerald-400',
                };
                const pC: Record<string, string> = { High: 'text-red-400', Medium: 'text-amber-400', Low: 'text-slate-500' };
                return (
                  <div key={action.id} className="p-4 hover:bg-[#0d1628]/50 cursor-pointer" onClick={() => onNavigate('actions', { linkedType: 'action', linkedId: action.id })}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-200">{action.title}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {action.overdue && action.status !== 'Complete' && (
                          <span className="text-[9px] font-bold text-red-400 bg-red-900/50 px-1.5 py-0.5 rounded-full">OVERDUE</span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${aC[action.status]}`}>{action.status}</span>
                      </div>
                    </div>
                    {action.description && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{action.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                      <span className={pC[action.priority]}>{action.priority}</span>
                      <span>Owner: {action.owner}</span>
                      <span>Due: {action.dueDate ? new Date(action.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Forms tab ─────────────────────────────────────────────────────────── */}
      {safeActiveTab === 'forms' && (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="p-4 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-white">Site Forms — {project.name}</h3>
          </div>
          {projectForms.length === 0 ? (
            <div className="py-10 text-center">
              <ClipboardList size={32} className="text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No forms submitted for this project</p>
              <p className="text-xs text-slate-600 mt-1">Open the Site Forms module to submit a form</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1e2d4a]">
              {projectForms.map(f => {
                const fC: Record<string, string> = { Submitted: 'bg-blue-900/60 text-blue-400', Approved: 'bg-emerald-900/60 text-emerald-400', Draft: 'bg-[#1e2d4a] text-slate-400' };
                return (
                  <div key={f.id} className="p-4 hover:bg-[#0d1628]/50 cursor-pointer" onClick={() => onNavigate('site-forms', { linkedType: 'form', linkedId: f.id })}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200">{f.type}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {f.completed_by} · {f.date ? new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                          {f.submitted_date && ` · Submitted ${new Date(f.submitted_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                        </p>
                        {f.description && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{f.description}</p>}
                        {f.comments && <p className="text-[11px] text-slate-600 mt-0.5 italic line-clamp-1">{f.comments}</p>}
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${fC[f.status] || ''}`}>{f.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Testing & Commissioning tab ───────────────────────────────────────── */}
      {safeActiveTab === 'testing' && (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="p-4 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-white">Testing & Commissioning — {project.name}</h3>
          </div>
          {projectTC.length === 0 ? (
            <div className="py-10 text-center">
              <Wrench size={32} className="text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No T&C records for this project</p>
              <p className="text-xs text-slate-600 mt-1">Open the Testing & Commissioning module to add records</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1e2d4a]">
              {projectTC.map(r => {
                const tC: Record<string, string> = { 'Not Started': 'bg-[#1e2d4a] text-slate-400', 'In Progress': 'bg-blue-900/60 text-blue-400', Complete: 'bg-emerald-900/60 text-emerald-400', Failed: 'bg-red-900/60 text-red-400', 'On Hold': 'bg-amber-900/60 text-amber-400' };
                return (
                  <div key={r.id} className="p-4 hover:bg-[#0d1628]/50 cursor-pointer" onClick={() => onNavigate('testing', { linkedType: 'testing', linkedId: r.id })}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono text-slate-500">{r.ref}</span>
                          <span className="text-[10px] text-slate-600">{r.category}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-200">{r.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{r.engineer} · {r.area}</p>
                        {r.notes && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{r.notes}</p>}
                        {r.result && <p className="text-[11px] text-teal-400 mt-0.5">Result: {r.result}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tC[r.status] || ''}`}>{r.status}</span>
                        {r.date && <span className="text-[11px] text-slate-600">{new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Documents tab ─────────────────────────────────────────────────────── */}
      {safeActiveTab === 'documents' && (
        <div className="space-y-4">
          {/* Document register header */}
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
              <h3 className="text-sm font-semibold text-white">Document Register <span className="text-slate-600 font-normal ml-1">({projectDocs.length})</span></h3>
              {canUploadDocs && (
                <button
                  onClick={() => setShowAddDocument(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus size={13} />Add Document
                </button>
              )}
            </div>
            {projectDocs.length === 0 ? (
              <div className="py-10 text-center">
                <FileText size={32} className="text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No documents uploaded yet</p>
                <p className="text-xs text-slate-600 mt-1">Click "Add Document" to upload the first file</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1e2d4a]">
                {projectDocs.map(doc => {
                  const isImage = doc.type.startsWith('image/');
                  const isPDF = doc.type === 'application/pdf';
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-4 hover:bg-[#0d1628]/50 cursor-pointer" onClick={() => setViewingDoc(doc)}>
                      {/* Thumbnail / icon */}
                      <div className="w-10 h-10 rounded-lg bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center shrink-0 overflow-hidden">
                        {isImage && doc.data_url ? (
                          <img src={doc.data_url} alt={doc.name} className="w-full h-full object-cover" />
                        ) : isPDF ? (
                          <FileText size={18} className="text-red-400" />
                        ) : (
                          <File size={18} className="text-slate-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-300 line-clamp-1">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${DOC_CATEGORY_COLORS[doc.category as DocCategory] || 'bg-[#1e2d4a] text-slate-400'}`}>{doc.category}</span>
                          <span className="text-[11px] text-slate-600">{formatBytes(doc.size)}</span>
                          {doc.uploaded_by && <span className="text-[11px] text-slate-600">{doc.uploaded_by}</span>}
                          {doc.created_at && <span className="text-[11px] text-slate-600">{new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        {doc.data_url && (
                          <button
                            onClick={() => setViewingDoc(doc)}
                            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] rounded transition-colors"
                            title="Open"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        {canDeleteDocs && (
                          <button
                            onClick={() => store.removeProjectDocument(doc.id)}
                            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Programmes tab ───────────────────────────────────────────────────── */}
      {safeActiveTab === 'programmes' && (
        <ProgrammesTab
          project={project}
          programmes={store.programmes}
          tasks={store.programmeTasks}
          currentUserName={store.currentUser?.name ?? ''}
          canCreate={perms['programmes.create'] || isAdmin}
          canEdit={perms['programmes.edit'] || isAdmin}
          canDelete={perms['programmes.delete'] || isAdmin}
          canExport={perms['programmes.export'] || isAdmin}
          onAddProgramme={store.addProgramme}
          onUpdateProgramme={store.updateProgramme}
          onRemoveProgramme={store.removeProgramme}
          onAddTask={store.addProgrammeTask}
          onUpdateTask={store.updateProgrammeTask}
          onRemoveTask={store.removeProgrammeTask}
        />
      )}

      {/* ── Key Dates tab ─────────────────────────────────────────────────────── */}
      {safeActiveTab === 'dates' && (
        <KeyDatesPanel
          project={project}
          keyDates={projectKeyDates}
          currentUserName={store.currentUser?.name ?? ''}
          onAdd={store.addKeyDate}
          onUpdate={store.updateKeyDate}
          onRemove={store.removeKeyDate}
        />
      )}

      {/* ── Activity tab ──────────────────────────────────────────────────────── */}
      {safeActiveTab === 'activity' && (        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="p-4 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-white">Activity Feed — {project.name}</h3>
            {activityFeed.length > 0 && <p className="text-xs text-slate-500 mt-0.5">{activityFeed.length} items across all modules</p>}
          </div>
          {activityFeed.length === 0 ? (
            <div className="py-10 text-center">
              <Activity size={32} className="text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No activity yet for this project</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1e2d4a]">
              {activityFeed.map(item => {
                const Icon = item.icon;
                const clickable = !!(item.page && item.linkedType && item.linkedId);
                return (
                  <div key={item.id}
                    className={`flex items-start gap-3 p-4 hover:bg-[#0d1628]/50 transition-colors${clickable ? ' cursor-pointer group' : ''}`}
                    onClick={clickable ? () => onNavigate(item.page!, { linkedType: item.linkedType!, linkedId: item.linkedId! }) : undefined}>
                    <div className="w-7 h-7 rounded-lg bg-[#0d1628] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={13} className={item.iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium text-slate-300${clickable ? ' group-hover:text-[#f97316] transition-colors' : ''}`}>{item.text}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
                    </div>
                    {item.ts && (
                      <span className="text-[11px] text-slate-600 shrink-0 mt-0.5">
                        {new Date(item.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Document Modal */}
      {showAddDocument && (
        <AddDocumentModal
          projectId={project.id}
          projectName={project.name}
          uploadedByDefault={store.currentUser?.name ?? ''}
          onClose={() => setShowAddDocument(false)}
          onSave={handleSaveDocument}
        />
      )}

      {/* View Document Modal */}
      {viewingDoc && (
        <ViewDocumentModal
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
          onDelete={() => { store.removeProjectDocument(viewingDoc.id); setViewingDoc(null); }}
          canDelete={canDeleteDocs}
        />
      )}

    </div>
  );
}

// ─── Edit project modal ──────────────────────────────────────────────────────────

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onSave: (project: Project) => void;
}

function EditProjectModal({ project, onClose, onSave }: EditProjectModalProps) {
  const [form, setForm] = useState({
    name: project.name,
    client: project.client,
    location: project.location,
    projectManager: project.projectManager,
    status: project.status,
    startDate: project.startDate,
    completionDate: project.completionDate,
    value: project.value,
    committed: project.committed != null ? String(project.committed) : '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const committedNum = form.committed.trim() ? parseFloat(form.committed.replace(/[£,\s]/g, '')) : null;
    onSave({ ...project, ...form, value: formatProjectValue(form.value), committed: isNaN(committedNum as number) ? null : committedNum });
    onClose();
  };

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <h2 className="text-lg font-bold text-white">Edit Project</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className={labelCls}>Project Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Client *</label><input required value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Location</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Project Manager</label><input value={form.projectManager} onChange={e => setForm(f => ({ ...f, projectManager: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))} className={inputCls}>
                <option>Active</option><option>On Hold</option><option>Tender</option><option>Completed</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Start Date</label><input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>Completion Date</label><input type="date" value={form.completionDate} onChange={e => setForm(f => ({ ...f, completionDate: e.target.value }))} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Contract Value</label><input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className={inputCls} placeholder="e.g. £125,000" /></div>
            <div><label className={labelCls}>Committed / Spent</label><input value={form.committed} onChange={e => setForm(f => ({ ...f, committed: e.target.value }))} className={inputCls} placeholder="e.g. 50000" /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Create project modal ────────────────────────────────────────────────────────

interface CreateProjectModalProps {
  onClose: () => void;
  onSave: (project: Project) => Promise<string | null>;
}

function CreateProjectModal({ onClose, onSave }: CreateProjectModalProps) {
  const [form, setForm] = useState({
    name: '', client: '', location: '', projectManager: '',
    status: 'Active' as ProjectStatus, startDate: '', completionDate: '', value: '', committed: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const committedNum = form.committed.trim() ? parseFloat(form.committed.replace(/[£,\s]/g, '')) : null;
    const err = await onSave({
      ...form,
      value: formatProjectValue(form.value),
      committed: committedNum && !isNaN(committedNum) ? committedNum : null,
      id: `p${Date.now()}`,
      openActions: 0,
      openSnags: 0,
      progress: 0,
    });
    setSaving(false);
    if (err) { setSaveError(err); return; }
    onClose();
  };

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <h2 className="text-lg font-bold text-white">Create New Project</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {saveError && (
            <div className="bg-red-900/40 border border-red-500/50 rounded-lg px-4 py-3 text-sm text-red-300">
              {saveError}
            </div>
          )}
          <div><label className={labelCls}>Project Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Ward 5 Electrical Upgrade" /></div>
          <div><label className={labelCls}>Client *</label><input required value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} className={inputCls} placeholder="Client name" /></div>
          <div><label className={labelCls}>Location</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputCls} placeholder="Site address" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Project Manager</label><input value={form.projectManager} onChange={e => setForm(f => ({ ...f, projectManager: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))} className={inputCls}>
                <option>Active</option><option>On Hold</option><option>Tender</option><option>Completed</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Start Date</label><input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>Completion Date</label><input type="date" value={form.completionDate} onChange={e => setForm(f => ({ ...f, completionDate: e.target.value }))} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Contract Value</label><input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className={inputCls} placeholder="£000,000" /></div>
            <div><label className={labelCls}>Committed / Spent</label><input value={form.committed} onChange={e => setForm(f => ({ ...f, committed: e.target.value }))} className={inputCls} placeholder="Optional" /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Projects page ──────────────────────────────────────────────────────────

interface ProjectsProps {
  onNavigate: (page: 'snagging' | 'actions' | 'site-forms' | 'testing', open?: PendingOpen) => void;
  pendingProjectId?: string | null;
  onPendingProjectConsumed?: () => void;
}

export default function Projects({ onNavigate, pendingProjectId, onPendingProjectConsumed }: ProjectsProps) {
  const store = useAppStore();
  const perms = usePermissions();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const isAdmin = store.currentUser?.role === 'Admin';
  const canCreate = perms['projects.create'] || isAdmin;
  const canDeleteProject = perms['projects.delete'] || isAdmin;

  const visibleProjects = store.visibleProjectIds
    ? store.projects.filter(p => store.visibleProjectIds!.includes(p.id))
    : store.projects;

  useEffect(() => {
    if (!pendingProjectId) return;
    const found = store.projects.find(p => p.id === pendingProjectId);
    if (found) { setSelectedProject(found); onPendingProjectConsumed?.(); }
  }, [pendingProjectId, store.projects, onPendingProjectConsumed]);

  // Reflect store updates on the selected project in real time
  const liveSelected = selectedProject
    ? (store.projects.find(p => p.id === selectedProject.id) ?? selectedProject)
    : null;

  if (liveSelected) {
    return (
      <>
        <ProjectDetail
          project={liveSelected}
          onBack={() => setSelectedProject(null)}
          onNavigate={onNavigate}
          onEdit={() => setShowEdit(true)}
          onDelete={() => setDeleteConfirm(liveSelected.id)}
        />
        {showEdit && (
          <EditProjectModal
            project={liveSelected}
            onClose={() => setShowEdit(false)}
            onSave={p => { store.updateProject(p); setShowEdit(false); }}
          />
        )}
        {deleteConfirm && (
          <ConfirmDeleteModal
            title="Delete Project"
            description="This project will be permanently deleted. Associated snags, actions, and forms will remain but will no longer be linked to this project."
            onConfirm={() => { store.removeProject(deleteConfirm); setDeleteConfirm(null); setSelectedProject(null); }}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
      </>
    );
  }

  const filtered = visibleProjects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase());
    return (filterStatus === 'All' || p.status === filterStatus) && matchSearch;
  });

  // KPI calculations
  const totalProjects = visibleProjects.length;
  const activeCount = visibleProjects.filter(p => p.status === 'Active').length;
  const onHoldCount = visibleProjects.filter(p => p.status === 'On Hold').length;
  const completedCount = visibleProjects.filter(p => p.status === 'Completed').length;
  const openActions = visibleProjects.reduce((sum, p) => sum + (p.openActions ?? 0), 0);
  const openSnags = visibleProjects.reduce((sum, p) => sum + (p.openSnags ?? 0), 0);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">All Projects</h2>
          <p className="text-sm text-slate-500">{visibleProjects.length} projects total</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
            <Plus size={16} />New Project
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total Projects',    value: totalProjects,    color: 'text-white' },
          { label: 'Active',            value: activeCount,      color: 'text-emerald-400' },
          { label: 'On Hold',           value: onHoldCount,      color: 'text-amber-400' },
          { label: 'Completed',         value: completedCount,   color: 'text-slate-400' },
          { label: 'Open Actions',      value: openActions,      color: 'text-blue-400' },
          { label: 'Open Snags',        value: openSnags,        color: 'text-red-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-3 text-center">
            <div className={`text-xl font-bold ${kpi.color} leading-none`}>{kpi.value}</div>
            <div className="text-[10px] text-slate-500 mt-1.5 leading-tight">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={14} className="text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
            className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600" />
        </div>
        <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
          {['All', 'Active', 'On Hold', 'Tender', 'Completed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${filterStatus === s ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((project) => (
          <div key={project.id}
            className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] hover:border-[#2a3d5a] transition-all cursor-pointer group"
            onClick={() => setSelectedProject(project)}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-200 group-hover:text-[#f97316] transition-colors line-clamp-1">{project.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{project.client}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={project.status} />
                  {canDeleteProject && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteConfirm(project.id); }}
                      className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                      title="Delete project"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><MapPin size={11} className="text-slate-600" />{project.location.split(',')[0]}</span>
                <span className="flex items-center gap-1"><User size={11} className="text-slate-600" />{project.projectManager}</span>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Progress</span>
                  <span className="font-bold text-slate-300">{project.progress}%</span>
                </div>
                <ProgressBar progress={project.progress} status={project.status} />
              </div>
              {/* Financial row — only shown when value is set */}
              {project.value && (() => {
                const contractVal = parseValue(project.value);
                const committed = project.committed ?? null;
                const remaining = committed != null ? contractVal - committed : null;
                return (
                  <div className="flex items-center gap-0 mb-3 bg-[#0d1628] rounded-lg overflow-hidden border border-[#1e2d4a]">
                    <div className="flex-1 px-3 py-2 text-center border-r border-[#1e2d4a]">
                      <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-0.5">Contract</div>
                      <div className="text-xs font-bold text-slate-300">{formatProjectValue(project.value)}</div>
                    </div>
                    <div className="flex-1 px-3 py-2 text-center border-r border-[#1e2d4a]">
                      <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-0.5">Committed</div>
                      <div className="text-xs font-bold text-slate-400">{committed != null ? fmtCurrency(committed) : '—'}</div>
                    </div>
                    <div className="flex-1 px-3 py-2 text-center">
                      <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-0.5">Remaining</div>
                      <div className={`text-xs font-bold ${remaining != null ? (remaining < 0 ? 'text-red-400' : remaining < contractVal * 0.1 ? 'text-amber-400' : 'text-emerald-400') : 'text-slate-600'}`}>
                        {remaining != null ? fmtCurrency(remaining) : '—'}
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="flex items-center justify-between pt-3 border-t border-[#1e2d4a]">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <AlertTriangle size={12} className="text-red-400" />
                    <span className="font-semibold text-slate-300">{project.openSnags}</span> snags
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CheckSquare size={12} className="text-blue-400" />
                    <span className="font-semibold text-slate-300">{project.openActions}</span> actions
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Calendar size={10} />
                  {new Date(project.completionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <FolderOpen size={40} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No projects match your filters</p>
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onSave={(project) => store.addProject(project)}
        />
      )}
      {deleteConfirm && (
        <ConfirmDeleteModal
          title="Delete Project"
          description="This project will be permanently deleted. Associated snags, actions, and forms will remain but will no longer be linked."
          onConfirm={() => { store.removeProject(deleteConfirm); setDeleteConfirm(null); }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
