import { useState, useMemo, useEffect } from 'react';
import {
  Plus, MapPin, User, Calendar, AlertTriangle, CheckSquare, ArrowLeft, X,
  Search, FolderOpen, FileText, Wrench, ClipboardList, Upload,
  Activity, ChevronRight, Trash2, File, Eye, Download, Printer, Pencil,
} from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import type { Project, ProjectStatus } from '../data/types';
import { useAppStore } from '../lib/StoreContext';
import type { DBProjectDocument } from '../lib/store';
import FileUpload from '../components/FileUpload';
import type { UploadedFile } from '../components/FileUpload';
import type { PendingOpen } from '../App';

// Normalise any project value input into £X,XXX format for consistent display
function formatProjectValue(raw: string): string {
  if (!raw.trim()) return '';
  // Strip existing currency symbols/commas/spaces, parse as number
  const num = parseFloat(raw.replace(/[£,\s]/g, ''));
  if (isNaN(num)) return raw; // preserve as-is if unparseable
  return '£' + num.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

type DetailTab = 'overview' | 'snags' | 'actions' | 'forms' | 'testing' | 'documents' | 'activity';

const TABS: { id: DetailTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: FolderOpen },
  { id: 'snags', label: 'Snags', icon: AlertTriangle },
  { id: 'actions', label: 'Actions', icon: CheckSquare },
  { id: 'forms', label: 'Forms', icon: ClipboardList },
  { id: 'testing', label: 'T&C', icon: Wrench },
  { id: 'documents', label: 'Documents', icon: FileText },
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

function ViewDocumentModal({ doc, onClose, onDelete }: { doc: import('../lib/store').DBProjectDocument; onClose: () => void; onDelete: () => void }) {
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
            <button onClick={onDelete} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors" title="Delete">
              <Trash2 size={15} />
            </button>
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
  const isAdmin = store.currentUser?.role === 'Admin';
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [localProgress, setLocalProgress] = useState(project.progress);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<DBProjectDocument | null>(null);

  const projectSnags = useMemo(() => store.snags.filter(s => s.projectId === project.id || s.projectName === project.name), [store.snags, project]);
  const projectActions = useMemo(() => store.actions.filter(a => a.projectId === project.id || a.projectName === project.name), [store.actions, project]);
  const projectForms = useMemo(() => store.siteForms.filter(f => f.project_id === project.id || f.project_name === project.name), [store.siteForms, project]);
  const projectTC = useMemo(() => store.tcRecords.filter(r => r.project_id === project.id || r.project_name === project.name), [store.tcRecords, project]);
  const projectDocs = useMemo(() => store.projectDocuments.filter(d => d.project_id === project.id), [store.projectDocuments, project]);

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

  function handleSaveProgress() {
    store.updateProject({ ...project, progress: localProgress });
  }

  function handlePrint() {
    const completionDate = project.completionDate
      ? new Date(project.completionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    const startDate = project.startDate
      ? new Date(project.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    const openSnags = projectSnags.filter(s => s.status !== 'Closed').length;
    const openActions = projectActions.filter(a => a.status !== 'Complete').length;

    const snagRows = projectSnags.map(s =>
      `<tr><td>${s.title}</td><td>${s.priority}</td><td>${s.status}</td><td>${s.location}</td><td>${s.assignedTo}</td></tr>`
    ).join('');
    const actionRows = projectActions.map(a =>
      `<tr><td>${a.title}</td><td>${a.priority}</td><td>${a.status}</td><td>${a.owner}</td><td>${a.dueDate ? new Date(a.dueDate).toLocaleDateString('en-GB') : '—'}</td></tr>`
    ).join('');
    const formRows = projectForms.map(f =>
      `<tr><td>${f.type}</td><td>${f.completed_by}</td><td>${f.status}</td><td>${f.date ? new Date(f.date).toLocaleDateString('en-GB') : '—'}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${project.name} — Project Report</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:white;padding:40px;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:16px;margin-bottom:24px}
    .logo{font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#f97316}
    .dateline{color:#888;font-size:11px;margin-top:3px}
    .proj-name{font-size:20px;font-weight:700;text-align:right}
    .proj-client{color:#666;font-size:12px;text-align:right;margin-top:3px}
    .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:22px}
    .meta-label{font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#888;display:block;margin-bottom:2px}
    .meta-val{font-weight:700;font-size:12px;color:#111}
    .section{margin-bottom:22px}
    .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#f97316;border-bottom:1px solid #e5e7eb;padding-bottom:5px;margin-bottom:10px}
    .progress-bar{height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden;margin:6px 0}
    .progress-fill{height:100%;background:#f97316;border-radius:5px}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#666;border-bottom:2px solid #e5e7eb;padding:6px 8px;font-weight:700}
    td{padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#1e293b}
    tr:nth-child(even) td{background:#f9fafb}
    .footer{margin-top:32px;border-top:1px solid #e5e7eb;padding-top:10px;font-size:10px;color:#999;display:flex;justify-content:space-between}
    @media print{body{padding:24px}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">VYSITE</div>
      <div class="dateline">Project Report — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
    <div>
      <div class="proj-name">${project.name}</div>
      <div class="proj-client">${project.client}</div>
    </div>
  </div>
  <div class="meta">
    <div><span class="meta-label">Status</span><span class="meta-val">${project.status}</span></div>
    <div><span class="meta-label">Contract Value</span><span class="meta-val">${project.value || '—'}</span></div>
    <div><span class="meta-label">Project Manager</span><span class="meta-val">${project.projectManager || '—'}</span></div>
    <div><span class="meta-label">Location</span><span class="meta-val">${project.location || '—'}</span></div>
    <div><span class="meta-label">Start Date</span><span class="meta-val">${startDate}</span></div>
    <div><span class="meta-label">Completion Date</span><span class="meta-val">${completionDate}</span></div>
    <div><span class="meta-label">Open Snags</span><span class="meta-val">${openSnags}</span></div>
    <div><span class="meta-label">Open Actions</span><span class="meta-val">${openActions}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Overall Progress — ${localProgress}%</div>
    <div class="progress-bar"><div class="progress-fill" style="width:${localProgress}%"></div></div>
  </div>
  ${snagRows ? `<div class="section">
    <div class="section-title">Snags (${projectSnags.length})</div>
    <table><thead><tr><th>Title</th><th>Priority</th><th>Status</th><th>Location</th><th>Assigned To</th></tr></thead>
    <tbody>${snagRows}</tbody></table>
  </div>` : ''}
  ${actionRows ? `<div class="section">
    <div class="section-title">Actions (${projectActions.length})</div>
    <table><thead><tr><th>Title</th><th>Priority</th><th>Status</th><th>Owner</th><th>Due Date</th></tr></thead>
    <tbody>${actionRows}</tbody></table>
  </div>` : ''}
  ${formRows ? `<div class="section">
    <div class="section-title">Site Forms (${projectForms.length})</div>
    <table><thead><tr><th>Type</th><th>Completed By</th><th>Status</th><th>Date</th></tr></thead>
    <tbody>${formRows}</tbody></table>
  </div>` : ''}
  <div class="footer">
    <span>Generated by VYSITE — ${project.name}</span>
    <span>Printed ${new Date().toLocaleDateString('en-GB')}</span>
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
            {/* Action buttons — match Tender & Estimating button style */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-sm font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
            >
              <Printer size={14} />Export
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-sm font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
            >
              <Pencil size={14} />Edit Project
            </button>
            {isAdmin && (
              <button
                onClick={onDelete}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a2236] border border-red-900/50 text-slate-400 rounded-lg text-sm font-semibold hover:border-red-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />Delete
              </button>
            )}
            {/* Contract value */}
            <div className="text-right ml-2 pl-3 border-l border-[#1e2d4a]">
              <p className="text-2xl font-bold text-white">{project.value || '—'}</p>
              <p className="text-xs text-slate-500">Contract Value</p>
            </div>
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
          <input
            type="range" min={0} max={100} value={localProgress}
            onChange={e => setLocalProgress(Number(e.target.value))}
            className="w-full cursor-pointer h-2" style={{ accentColor: '#f97316' }}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-slate-500">Drag to update completion percentage</span>
            {localProgress !== project.progress && (
              <button onClick={handleSaveProgress} className="text-xs font-semibold text-[#f97316] hover:text-orange-400 transition-colors">Save →</button>
            )}
          </div>
          {project.value && (() => {
            const contractNum = parseFloat(project.value.replace(/[£,\s]/g, ''));
            if (isNaN(contractNum) || contractNum === 0) return null;
            const completed = contractNum * localProgress / 100;
            const remaining = contractNum - completed;
            const fmt = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');
            return (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Contract Value</p>
                  <p className="text-sm font-bold text-white">{fmt(contractNum)}</p>
                </div>
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Progress</p>
                  <p className="text-sm font-bold text-[#f97316]">{localProgress}%</p>
                </div>
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Approx. Completed</p>
                  <p className="text-sm font-bold text-emerald-400">{fmt(completed)}</p>
                </div>
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Approx. Remaining</p>
                  <p className="text-sm font-bold text-amber-400">{fmt(remaining)}</p>
                </div>
                <p className="col-span-2 md:col-span-4 text-[10px] text-slate-600 mt-0.5">Approximate values — indicative only. Not a valuation.</p>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-1 mb-4 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const count = tabCounts[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-[#0d1628]'
              }`}
            >
              <Icon size={13} />
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#0d1628] text-slate-400'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Overview tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Snags summary */}
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a] cursor-pointer hover:bg-[#0d1628]/40 transition-colors rounded-t-xl" onClick={() => setActiveTab('snags')}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-400" />
                <span className="text-sm font-semibold text-white">Snags</span>
              </div>
              <div className="flex gap-3 items-center">
                {Object.entries(snagStatusCounts).map(([s, c]) => (
                  <span key={s} className="text-[10px] text-slate-500"><span className="font-bold text-slate-300">{c}</span> {s}</span>
                ))}
                <span className="text-[10px] text-[#f97316] font-semibold">View →</span>
              </div>
            </div>
            <div className="divide-y divide-[#1e2d4a] max-h-56 overflow-y-auto">
              {projectSnags.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No snags raised</p>
              ) : projectSnags.slice(0, 5).map(snag => {
                const dotC: Record<string, string> = { Critical: 'bg-red-500', High: 'bg-orange-400', Medium: 'bg-amber-400', Low: 'bg-slate-600' };
                const sC: Record<string, string> = { Open: 'bg-red-900/60 text-red-400', 'In Progress': 'bg-blue-900/60 text-blue-400', Closed: 'bg-emerald-900/60 text-emerald-400' };
                return (
                  <div key={snag.id} className="p-3 hover:bg-[#0d1628]/50 cursor-pointer" onClick={() => onNavigate('snagging', { linkedType: 'snag', linkedId: snag.id })}>
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
              {projectSnags.length > 5 && (
                <button className="w-full py-2.5 text-xs text-[#f97316] font-semibold hover:bg-[#0d1628]/50" onClick={() => setActiveTab('snags')}>
                  +{projectSnags.length - 5} more snags →
                </button>
              )}
            </div>
          </div>

          {/* Actions summary */}
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a] cursor-pointer hover:bg-[#0d1628]/40 transition-colors rounded-t-xl" onClick={() => setActiveTab('actions')}>
              <div className="flex items-center gap-2">
                <CheckSquare size={15} className="text-blue-400" />
                <span className="text-sm font-semibold text-white">Actions</span>
              </div>
              <div className="flex gap-2 items-center">
                {Object.entries(actionStatusCounts).map(([s, c]) => (
                  <span key={s} className="text-[10px] text-slate-500"><span className="font-bold text-slate-300">{c}</span> {s.split(' ')[0]}</span>
                ))}
                <span className="text-[10px] text-[#f97316] font-semibold ml-1">View →</span>
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
                  <div key={action.id} className="p-3 hover:bg-[#0d1628]/50 cursor-pointer" onClick={() => onNavigate('actions', { linkedType: 'action', linkedId: action.id })}>
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
              {projectActions.length > 5 && (
                <button className="w-full py-2.5 text-xs text-[#f97316] font-semibold hover:bg-[#0d1628]/50" onClick={() => setActiveTab('actions')}>
                  +{projectActions.length - 5} more actions →
                </button>
              )}
            </div>
          </div>

          {/* Forms summary */}
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a] cursor-pointer hover:bg-[#0d1628]/40 transition-colors rounded-t-xl" onClick={() => setActiveTab('forms')}>
              <div className="flex items-center gap-2">
                <ClipboardList size={15} className="text-emerald-400" />
                <span className="text-sm font-semibold text-white">Site Forms</span>
              </div>
              <span className="text-[10px] text-[#f97316] font-semibold">View {projectForms.length} →</span>
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
            <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a] cursor-pointer hover:bg-[#0d1628]/40 transition-colors rounded-t-xl" onClick={() => setActiveTab('testing')}>
              <div className="flex items-center gap-2">
                <Wrench size={15} className="text-teal-400" />
                <span className="text-sm font-semibold text-white">Testing & Commissioning</span>
              </div>
              <span className="text-[10px] text-[#f97316] font-semibold">View {projectTC.length} →</span>
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
      )}

      {/* ── Snags tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'snags' && (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-white">Snags — {project.name}</h3>
            <button onClick={() => onNavigate('snagging')} className="text-xs text-[#f97316] font-semibold hover:text-orange-400 flex items-center gap-1">
              Open Snagging Module <ChevronRight size={12} />
            </button>
          </div>
          {projectSnags.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">No snags for this project</p>
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
      {activeTab === 'actions' && (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-white">Actions — {project.name}</h3>
            <button onClick={() => onNavigate('actions')} className="text-xs text-[#f97316] font-semibold hover:text-orange-400 flex items-center gap-1">
              Open Actions Module <ChevronRight size={12} />
            </button>
          </div>
          {projectActions.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">No actions for this project</p>
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
      {activeTab === 'forms' && (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="p-4 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-white">Site Forms — {project.name}</h3>
          </div>
          {projectForms.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">No forms submitted</p>
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
      {activeTab === 'testing' && (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="p-4 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-white">Testing & Commissioning — {project.name}</h3>
          </div>
          {projectTC.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">No T&C records for this project</p>
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
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Document register header */}
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
              <h3 className="text-sm font-semibold text-white">Document Register <span className="text-slate-600 font-normal ml-1">({projectDocs.length})</span></h3>
              <button
                onClick={() => setShowAddDocument(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus size={13} />Add Document
              </button>
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
                        <button
                          onClick={() => store.removeProjectDocument(doc.id)}
                          className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Activity tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="p-4 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-white">Activity Feed — {project.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{activityFeed.length} items across all modules</p>
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
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...project, ...form, value: formatProjectValue(form.value) });
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
          <div><label className={labelCls}>Contract Value</label><input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className={inputCls} placeholder="e.g. 125000 or £125,000" /></div>
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
  onSave: (project: Project) => void;
}

function CreateProjectModal({ onClose, onSave }: CreateProjectModalProps) {
  const [form, setForm] = useState({
    name: '', client: '', location: '', projectManager: '',
    status: 'Active' as ProjectStatus, startDate: '', completionDate: '', value: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      value: formatProjectValue(form.value),
      id: `p${Date.now()}`,
      openActions: 0,
      openSnags: 0,
      progress: 0,
    });
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
          <div><label className={labelCls}>Contract Value</label><input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className={inputCls} placeholder="£000,000" /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">Create Project</button>
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
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const isAdmin = store.currentUser?.role === 'Admin';

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

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">All Projects</h2>
          <p className="text-sm text-slate-500">{visibleProjects.length} projects total</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
          <Plus size={16} />New Project
        </button>
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
                  {isAdmin && (
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
