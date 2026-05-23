import { useState, useMemo, useEffect } from 'react';
import { Plus, X, MessageSquare, AlertTriangle, Search, ChevronDown, CheckSquare, Mail, Printer, Send, Paperclip, Trash2, Eye, Download, File, FileText, Image, CreditCard as Edit2 } from 'lucide-react';
import { openPrintTab, buildPrintDocument } from '../lib/printTab';
import { type Snag, type SnagPriority, type SnagStatus } from '../data/types';
import FileUploadComponent from '../components/FileUpload';
import type { UploadedFile } from '../components/FileUpload';
import { useAppStore } from '../lib/StoreContext';
import type { DBAttachment } from '../lib/store';
import MentionTextarea, { renderWithMentions } from '../components/MentionTextarea';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const priorityColors: Record<SnagPriority, { dot: string; badge: string; border: string }> = {
  Critical: { dot: 'bg-red-500', badge: 'bg-red-900/60 text-red-400 border-red-800', border: 'border-l-red-500' },
  High: { dot: 'bg-orange-400', badge: 'bg-orange-900/60 text-orange-400 border-orange-800', border: 'border-l-orange-400' },
  Medium: { dot: 'bg-amber-400', badge: 'bg-amber-900/60 text-amber-400 border-amber-800', border: 'border-l-amber-400' },
  Low: { dot: 'bg-slate-600', badge: 'bg-[#1e2d4a] text-slate-400 border-slate-700', border: 'border-l-slate-600' },
};

const statusColors: Record<SnagStatus, string> = {
  Open: 'bg-red-900/60 text-red-400',
  'In Progress': 'bg-blue-900/60 text-blue-400',
  Closed: 'bg-emerald-900/60 text-emerald-400',
};

function PriorityBadge({ priority }: { priority: SnagPriority }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColors[priority].badge}`}>{priority}</span>;
}

function StatusBadge({ status }: { status: SnagStatus }) {
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[status]}`}>{status}</span>;
}

// ─── Attachment helpers ────────────────────────────────────────────────────────

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentListProps {
  attachments: DBAttachment[];
  onRemove: (id: string) => void;
}

function AttachmentList({ attachments, onRemove }: AttachmentListProps) {
  const store = useAppStore();
  const [preview, setPreview] = useState<DBAttachment | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  const openPreview = async (att: DBAttachment) => {
    if (att.data_url) { setPreview(att); return; }
    setLoadingId(att.id);
    const dataUrl = await store.fetchAttachmentData(att.id);
    setLoadingId(null);
    setPreview({ ...att, data_url: dataUrl });
  };

  return (
    <>
      <div className="space-y-2">
        {attachments.map(att => {
          const isImage = att.type.startsWith('image/');
          const isPDF = att.type === 'application/pdf';
          const isLoading = loadingId === att.id;
          return (
            <div key={att.id} className="flex items-center gap-3 bg-[#0d1628] rounded-lg p-2.5 border border-[#1e2d4a] group">
              <div
                className="w-8 h-8 rounded bg-[#111827] border border-[#1e2d4a] flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
                onClick={() => openPreview(att)}
              >
                {isLoading ? (
                  <div className="w-3 h-3 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" />
                ) : isImage && att.data_url ? (
                  <img src={att.data_url} alt={att.name} className="w-full h-full object-cover" />
                ) : isPDF ? (
                  <FileText size={14} className="text-red-400" />
                ) : (
                  <File size={14} className="text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openPreview(att)}>
                <p className="text-xs font-medium text-slate-300 line-clamp-1">{att.name}</p>
                <p className="text-[10px] text-slate-600">{formatBytes(att.size)} · {att.category}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openPreview(att)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100" title="Preview">
                  <Eye size={13} />
                </button>
                <button onClick={() => onRemove(att.id)} className="p-1 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Remove">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col" onClick={() => setPreview(null)}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-white truncate max-w-xs">{preview.name}</p>
            <div className="flex items-center gap-2">
              {preview.data_url && (
                <a href={preview.data_url} download={preview.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
                  <Download size={13} />Download
                </a>
              )}
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><X size={18} /></button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            {preview.type.startsWith('image/') && preview.data_url ? (
              <img src={preview.data_url} alt={preview.name} className="max-w-full max-h-full object-contain rounded-lg" />
            ) : preview.type === 'application/pdf' && preview.data_url ? (
              <iframe src={preview.data_url} title={preview.name} className="w-full h-full rounded-lg border-0" />
            ) : preview.data_url ? (
              <a href={preview.data_url} download={preview.name}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
                <Download size={14} />Download File
              </a>
            ) : (
              <div className="text-center">
                <Paperclip size={40} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">{preview.name}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Snag Detail modal ─────────────────────────────────────────────────────────

interface SnagDetailProps {
  snag: Snag;
  onClose: () => void;
  onUpdate: (updated: Snag) => void;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}

function SnagDetail({ snag, onClose, onUpdate, onEdit, onDelete, isAdmin }: SnagDetailProps) {
  const store = useAppStore();
  const [tab, setTab] = useState<'details' | 'comments' | 'files'>('details');
  const [newComment, setNewComment] = useState('');
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const snagAttachments = useMemo(
    () => store.attachments.filter(a => a.linked_type === 'snag' && a.linked_id === snag.id),
    [store.attachments, snag.id]
  );

  const totalFiles = snagAttachments.length + pendingFiles.length;

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    for (const f of pendingFiles) {
      const att: DBAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        linked_type: 'snag',
        linked_id: snag.id,
        project_id: snag.projectId,
        project_name: snag.projectName,
        name: f.name,
        type: f.type,
        size: f.size,
        category: f.type.startsWith('image/') ? 'Photo' : f.type === 'application/pdf' ? 'Document' : 'Other',
        data_url: f.dataUrl ?? '',
        uploaded_by: store.currentUser?.name ?? '',
        created_at: new Date().toISOString(),
      };
      await store.addAttachment(att);
    }
    setPendingFiles([]);
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-[#1e2d4a] shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${priorityColors[snag.priority].dot} shrink-0`} />
              <span className="text-xs text-slate-600 font-mono">#{snag.id.toUpperCase()}</span>
            </div>
            <h2 className="text-base font-bold text-white leading-snug">{snag.title}</h2>
            <p className="text-xs text-slate-500 mt-1">{snag.projectName}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-xs font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors">
              <Edit2 size={13} />Edit
            </button>
            {isAdmin && (
              <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-xs font-semibold hover:border-red-500 hover:text-red-400 transition-colors">
                <Trash2 size={13} />Delete
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2d4a] shrink-0">
          {(['details', 'comments', 'files'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-xs font-semibold transition-colors capitalize border-b-2 -mb-px ${
                tab === t ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t}
              {t === 'comments' && snag.comments.length > 0 && (
                <span className="ml-1.5 bg-[#f97316]/20 text-[#f97316] text-[9px] px-1.5 py-0.5 rounded-full">{snag.comments.length}</span>
              )}
              {t === 'files' && totalFiles > 0 && (
                <span className="ml-1.5 bg-slate-700 text-slate-300 text-[9px] px-1.5 py-0.5 rounded-full">{totalFiles}</span>
              )}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Details Tab */}
          {tab === 'details' && (
            <>
              <div className="flex flex-wrap gap-2">
                <PriorityBadge priority={snag.priority} />
                <StatusBadge status={snag.status} />
                {snagAttachments.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-[#1e2d4a] px-2 py-1 rounded-full">
                    <Paperclip size={10} />{snagAttachments.length} attachment{snagAttachments.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Assigned To', value: snag.assignedTo },
                  { label: 'Raised By', value: snag.raisedBy },
                  { label: 'Raised Date', value: new Date(snag.raisedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                  { label: 'Due Date', value: new Date(snag.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                ].map(item => (
                  <div key={item.label} className="bg-[#0d1628] rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-slate-300">{item.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</p>
                <p className="text-sm text-slate-300">{snag.location}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-slate-400 leading-relaxed">{snag.description}</p>
              </div>

              {snagAttachments.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attachments</p>
                  <AttachmentList attachments={snagAttachments} onRemove={id => store.removeAttachment(id)} />
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Update Status</p>
                <div className="flex gap-2">
                  {(['Open', 'In Progress', 'Closed'] as SnagStatus[]).map(s => (
                    <button key={s} onClick={() => onUpdate({ ...snag, status: s })}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                        snag.status === s
                          ? s === 'Open' ? 'bg-red-500 text-white border-red-500'
                            : s === 'In Progress' ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-[#0d1628] text-slate-400 border-[#1e2d4a] hover:border-slate-500'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Comments Tab */}
          {tab === 'comments' && (
            <>
              <div className="space-y-2 mb-3">
                {snag.comments.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare size={28} className="text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">No comments yet</p>
                  </div>
                )}
                {snag.comments.map((c, i) => (
                  <div key={i} className="bg-[#0d1628] rounded-lg p-3">
                    <p className="text-sm text-slate-400">{renderWithMentions(c)}</p>
                  </div>
                ))}
              </div>
              <MentionTextarea
                value={newComment}
                onChange={setNewComment}
                onSubmit={(text) => {
                  onUpdate({ ...snag, comments: [...snag.comments, text] });
                  setNewComment('');
                }}
                linkedType="snag"
                linkedId={snag.id}
                projectId={snag.projectId}
                projectName={snag.projectName}
              />
            </>
          )}

          {/* Files Tab */}
          {tab === 'files' && (
            <div className="space-y-4">
              {snagAttachments.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Saved Attachments ({snagAttachments.length})
                  </p>
                  <AttachmentList attachments={snagAttachments} onRemove={id => store.removeAttachment(id)} />
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {snagAttachments.length > 0 ? 'Add More Files' : 'Upload Files, Documents & Photos'}
                </p>
                <FileUploadComponent
                  files={pendingFiles}
                  onChange={setPendingFiles}
                  label="Drop files, photos or documents here"
                  maxFiles={20}
                />
                {pendingFiles.length > 0 && (
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-[#f97316] hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    <Paperclip size={14} />
                    {uploading ? 'Saving...' : `Save ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>

              {snagAttachments.length === 0 && pendingFiles.length === 0 && (
                <div className="text-center py-8">
                  <Image size={28} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No attachments yet</p>
                  <p className="text-xs text-slate-700 mt-1">Upload photos, drawings or documents as evidence</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Raise Snag modal ──────────────────────────────────────────────────────────

interface RaiseSnagModalProps {
  onClose: () => void;
  onSave: (snag: Omit<Snag, 'id'>, files: UploadedFile[]) => void;
  initial?: Snag;
}

function RaiseSnagModal({ onClose, onSave, initial }: RaiseSnagModalProps) {
  const store = useAppStore();
  const [form, setForm] = useState({
    project: initial?.projectName ?? '',
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    priority: (initial?.priority ?? 'Medium') as SnagPriority,
    assignedTo: initial?.assignedTo ?? '',
    location: initial?.location ?? '',
    dueDate: initial?.dueDate ?? '',
  });
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  const allProjects = useMemo(() => {
    return store.projects.map(p => p.name).sort();
  }, [store.projects]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const project = store.projects.find(p => p.name === form.project);
    onSave({
      projectId: project?.id || initial?.projectId || '',
      projectName: form.project,
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: initial?.status ?? 'Open',
      assignedTo: form.assignedTo,
      raisedBy: initial?.raisedBy ?? store.currentUser?.name ?? '',
      raisedDate: new Date().toISOString().split('T')[0],
      dueDate: form.dueDate,
      location: form.location,
      comments: [],
    }, pendingFiles);
    onClose();
  };

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a] shrink-0">
          <h2 className="text-lg font-bold text-white">{initial ? 'Edit Snag' : 'Raise New Snag'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <label className={labelCls}>Project *</label>
            <div className="relative">
              <select required value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} className={`${inputCls} appearance-none pr-8`}>
                <option value="">Select project...</option>
                {allProjects.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Snag Title *</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Brief description of the snag" />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className={`${inputCls} resize-none`} placeholder="Detailed description..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as SnagPriority }))} className={inputCls}>
                <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Assigned To</label>
              <input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Location</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputCls} placeholder="Area / room" />
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inputCls} />
            </div>
          </div>

          {/* Attachments section */}
          <div className="border-t border-[#1e2d4a] pt-4">
            <button
              type="button"
              onClick={() => setShowUpload(v => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Paperclip size={13} />
              {pendingFiles.length > 0 ? `${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''} attached` : 'Attach files, photos or documents'}
              <ChevronDown size={12} className={`transition-transform ${showUpload ? 'rotate-180' : ''}`} />
            </button>
            {showUpload && (
              <div className="mt-3">
                <FileUploadComponent
                  files={pendingFiles}
                  onChange={setPendingFiles}
                  label="Drop files, photos or documents here"
                  maxFiles={10}
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
              {initial ? 'Save Changes' : `Raise Snag${pendingFiles.length > 0 ? ` + ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Send PDF modal ────────────────────────────────────────────────────────────

interface SendPdfModalProps {
  selectedSnags: Snag[];
  onClose: () => void;
}

function SendPdfModal({ selectedSnags, onClose }: SendPdfModalProps) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const [emailTo, setEmailTo] = useState('project@client.co.uk');
  const [subject, setSubject] = useState(`Snag Report — VYSITE — ${today}`);
  const [message, setMessage] = useState('Please find attached the snag report for your reference.');
  const [sent, setSent] = useState(false);

  const handleSend = () => { setSent(true); setTimeout(() => { onClose(); }, 1800); };

  const handleDownloadPDF = () => {
    const statusColor = (s: string) => s === 'Open' ? '#dc2626' : s === 'In Progress' ? '#2563eb' : '#059669';
    const priorityColor = (p: string) => p === 'Critical' ? '#dc2626' : p === 'High' ? '#f97316' : p === 'Medium' ? '#d97706' : '#64748b';
    const rows = selectedSnags.map(snag => `<tr>
      <td style="font-family:monospace;font-size:10px;color:#64748b">#${snag.id.toUpperCase()}</td>
      <td style="font-weight:600">${snag.title}</td>
      <td>${snag.projectName}</td>
      <td style="color:${statusColor(snag.status)}">${snag.status}</td>
      <td style="color:${priorityColor(snag.priority)};font-weight:700">${snag.priority}</td>
      <td>${snag.assignedTo}</td>
      <td>${new Date(snag.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
    </tr>`).join('');
    const styles = `
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #f97316;padding-bottom:14px;margin-bottom:22px}
      .logo{font-size:22px;font-weight:900;color:#f97316;letter-spacing:.05em}
      .meta{font-size:11px;color:#64748b;text-align:right}
      table{width:100%;border-collapse:collapse}
      th{background:#f1f5f9;color:#475569;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0}
      td{padding:9px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#1e293b}
      tr:nth-child(even) td{background:#f8fafc}
    `;
    const body = `
      <div class="header">
        <div class="logo">VYSITE</div>
        <div class="meta"><div>Snag Report</div><div>${today}</div><div>${selectedSnags.length} item${selectedSnags.length !== 1 ? 's' : ''}</div></div>
      </div>
      <table>
        <thead><tr><th>Ref</th><th>Title</th><th>Project</th><th>Status</th><th>Priority</th><th>Assigned To</th><th>Due Date</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:10px;color:#94a3b8;text-align:center">Generated by VYSITE · ${today}</div>
    `;
    openPrintTab(buildPrintDocument('Snag Report — VYSITE', styles, body));
  };

  const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block';

  return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Mail size={18} className="text-[#f97316]" />
              </div>
              <h2 className="text-lg font-bold text-white">Send Snag Report</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
          </div>

          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Selected Snags ({selectedSnags.length})</p>
              <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1e2d4a]">
                        {['Ref', 'Title', 'Project', 'Status', 'Priority', 'Due Date'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSnags.map((snag, i) => (
                        <tr key={snag.id} className={i % 2 === 1 ? 'bg-[#1a2236]/50' : ''}>
                          <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">#{snag.id.toUpperCase()}</td>
                          <td className="px-3 py-2 text-slate-200 max-w-[180px] truncate">{snag.title}</td>
                          <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{snag.projectName}</td>
                          <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={snag.status} /></td>
                          <td className="px-3 py-2 whitespace-nowrap"><PriorityBadge priority={snag.priority} /></td>
                          <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{new Date(snag.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Email To</label>
              <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} className={inputCls} placeholder="recipient@example.com" />
            </div>
            <div>
              <label className={labelCls}>Subject</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
            </div>

            {sent && (
              <div className="flex items-center gap-2 bg-emerald-900/40 border border-emerald-700 rounded-lg px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <p className="text-sm font-semibold text-emerald-400">Report sent successfully</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 p-6 border-t border-[#1e2d4a] shrink-0">
            <button onClick={onClose} className="px-4 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button type="button" onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-300 hover:bg-[#1e2d4a] transition-colors">
              <Printer size={15} />Download PDF
            </button>
            <button onClick={handleSend} disabled={sent}
              className="flex items-center gap-2 ml-auto px-5 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              <Send size={15} />Send Report
            </button>
          </div>
        </div>
      </div>
  );
}

// ─── Main Snagging page ────────────────────────────────────────────────────────

interface SnaggingProps {
  pendingOpen?: { linkedType: string; linkedId: string } | null;
  onPendingOpenConsumed?: () => void;
  pendingFilter?: { filterKey: string; filterValue: string } | null;
  onPendingFilterConsumed?: () => void;
}

export default function Snagging({ pendingOpen, onPendingOpenConsumed, pendingFilter, onPendingFilterConsumed }: SnaggingProps) {
  const store = useAppStore();
  const snagList = store.visibleProjectIds
    ? store.snags.filter(s => store.visibleProjectIds!.includes(s.projectId))
    : store.snags;
  const [selectedSnag, setSelectedSnag] = useState<Snag | null>(null);
  const [showRaise, setShowRaise] = useState(false);
  const [editSnag, setEditSnag] = useState<Snag | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterProject, setFilterProject] = useState<string>('All');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSendPdf, setShowSendPdf] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const isAdmin = store.currentUser?.role === 'Admin';

  useEffect(() => {
    if (pendingOpen?.linkedType === 'snag' && pendingOpen.linkedId) {
      const found = store.snags.find(s => s.id === pendingOpen.linkedId);
      if (found) { setSelectedSnag(found); onPendingOpenConsumed?.(); }
    }
  }, [pendingOpen, store.snags, onPendingOpenConsumed]);

  useEffect(() => {
    if (!pendingFilter) return;
    if (pendingFilter.filterKey === 'priority') {
      setFilterPriority(pendingFilter.filterValue);
    } else if (pendingFilter.filterKey === 'status') {
      setFilterStatus(pendingFilter.filterValue);
    } else if (pendingFilter.filterKey === 'project') {
      setFilterProject(pendingFilter.filterValue);
    }
    onPendingFilterConsumed?.();
  }, [pendingFilter, onPendingFilterConsumed]);

  const filtered = snagList.filter(s => {
    const matchSearch = s.title.toLowerCase().includes(search.toLowerCase()) || s.projectName.toLowerCase().includes(search.toLowerCase()) || s.assignedTo.toLowerCase().includes(search.toLowerCase());
    return matchSearch
      && (filterStatus === 'All' || s.status === filterStatus)
      && (filterPriority === 'All' || s.priority === filterPriority)
      && (filterProject === 'All' || s.projectId === filterProject);
  });

  const stats = {
    total: snagList.filter(s => s.status === 'Open').length,
    critical: snagList.filter(s => s.priority === 'Critical' && s.status !== 'Closed').length,
    inProgress: snagList.filter(s => s.status === 'In Progress').length,
    closed: snagList.filter(s => s.status === 'Closed').length,
  };

  const toggleSelectMode = () => { setSelectMode(prev => !prev); setSelectedIds(new Set()); };
  const toggleId = (id: string) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const selectAll = () => setSelectedIds(new Set(filtered.map(s => s.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const selectedSnags = filtered.filter(s => selectedIds.has(s.id));

  // liveSelected: keep modal in sync when store updates
  const liveSelected = selectedSnag
    ? (snagList.find(s => s.id === selectedSnag.id) ?? selectedSnag)
    : null;

  async function handleEditSnag(data: Omit<Snag, 'id'>, _files: UploadedFile[]) {
    if (!editSnag) return;
    const updated: Snag = { ...editSnag, ...data };
    store.updateSnag(updated);
    setSelectedSnag(updated);
    setEditSnag(null);
  }

  async function handleRaiseSnag(data: Omit<Snag, 'id'>, files: UploadedFile[]) {
    const newSnag: Snag = { ...data, id: `s${Date.now()}` };
    await store.addSnag(newSnag);
    if (files.length > 0) {
      for (const f of files) {
        const att: DBAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          linked_type: 'snag',
          linked_id: newSnag.id,
          project_id: newSnag.projectId,
          project_name: newSnag.projectName,
          name: f.name,
          type: f.type,
          size: f.size,
          category: f.type.startsWith('image/') ? 'Photo' : f.type === 'application/pdf' ? 'Document' : 'Other',
          data_url: f.dataUrl ?? '',
          uploaded_by: store.currentUser?.name ?? '',
          created_at: new Date().toISOString(),
        };
        await store.addAttachment(att);
      }
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Snagging</h2>
          <p className="text-sm text-slate-500">{snagList.filter(s => s.status !== 'Closed').length} open snags across all projects</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSelectMode}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
              selectMode ? 'bg-[#f97316] text-white border-[#f97316]' : 'border-[#1e2d4a] text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200'
            }`}
          >
            <CheckSquare size={15} />
            {selectMode ? 'Done' : 'Select'}
          </button>
          <button
            onClick={() => setShowRaise(true)}
            className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            <Plus size={16} />Raise Snag
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {([
          { label: 'Open Snags',  value: stats.total,      color: 'text-white',         statusFilter: 'Open',        priorityFilter: null },
          { label: 'Critical',    value: stats.critical,   color: 'text-red-400',       statusFilter: null,          priorityFilter: 'Critical' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-400',      statusFilter: 'In Progress', priorityFilter: null },
          { label: 'Closed',      value: stats.closed,     color: 'text-emerald-400',   statusFilter: 'Closed',      priorityFilter: null },
        ] as const).map(s => {
          const isActive = s.statusFilter !== null
            ? filterStatus === s.statusFilter && filterPriority === 'All'
            : filterPriority === s.priorityFilter && filterStatus === 'All';
          const handleClick = () => {
            if (s.statusFilter !== null) {
              if (isActive) { setFilterStatus('All'); } else { setFilterStatus(s.statusFilter); setFilterPriority('All'); }
            } else if (s.priorityFilter !== null) {
              if (isActive) { setFilterPriority('All'); } else { setFilterPriority(s.priorityFilter); setFilterStatus('All'); }
            }
          };
          return (
            <div key={s.label}
              onClick={handleClick}
              className={`bg-[#1a2236] rounded-xl border p-4 text-center cursor-pointer transition-all hover:border-[#2a3d5a] ${isActive ? 'border-[#f97316] ring-1 ring-[#f97316]/20' : 'border-[#1e2d4a]'}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search snags..."
            className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600 min-w-0" />
        </div>
        <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto shrink-0">
          {['All', 'Open', 'In Progress', 'Closed'].map(s => (
            <button key={s} onClick={() => { setFilterStatus(s); if (s === 'All') setFilterPriority('All'); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${filterStatus === s && (s !== 'All' || filterPriority === 'All') ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{s}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto shrink-0">
          {['All', 'Critical', 'High', 'Medium', 'Low'].map(p => (
            <button key={p} onClick={() => { setFilterPriority(p); if (p === 'All') setFilterStatus('All'); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${filterPriority === p && (p !== 'All' || filterStatus === 'All') ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{p}</button>
          ))}
        </div>
        <div className="relative shrink-0">
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="appearance-none bg-[#1a2236] border border-[#1e2d4a] rounded-lg pl-3 pr-8 py-2 text-xs font-semibold text-slate-400 outline-none focus:border-[#f97316] hover:border-slate-600 transition-colors cursor-pointer w-full sm:w-auto">
            <option value="All">All Projects</option>
            {(store.visibleProjectIds ? store.projects.filter(p => store.visibleProjectIds!.includes(p.id)) : store.projects).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-[#1a2236] border border-[#f97316]/40 rounded-xl px-4 py-3 mb-4 shadow-lg">
          <span className="text-sm font-semibold text-slate-200">{selectedIds.size} selected</span>
          <button onClick={() => setShowSendPdf(true)}
            className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
            <Mail size={14} />Send as PDF via Email
          </button>
          <button onClick={selectAll} className="px-3 py-2 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors">Select All</button>
          <button onClick={clearSelection} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors ml-auto">Clear selection</button>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((snag) => {
          const isChecked = selectedIds.has(snag.id);
          const attCount = store.attachments.filter(a => a.linked_type === 'snag' && a.linked_id === snag.id).length;
          return (
            <div key={snag.id}
              className={`bg-[#1a2236] rounded-xl border border-[#1e2d4a] border-l-4 ${priorityColors[snag.priority].border} hover:border-[#2a3d5a] transition-all ${selectMode ? 'cursor-default' : 'cursor-pointer'} ${isChecked ? 'ring-1 ring-[#f97316]/40' : ''}`}
              onClick={() => { if (selectMode) { toggleId(snag.id); } else { setSelectedSnag(snag); } }}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {selectMode && (
                    <div className="shrink-0 mt-0.5" onClick={e => { e.stopPropagation(); toggleId(snag.id); }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleId(snag.id)}
                        className="w-4 h-4 rounded accent-orange-500 cursor-pointer" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-600">#{snag.id.toUpperCase()}</span>
                          <PriorityBadge priority={snag.priority} />
                        </div>
                        <h3 className="font-semibold text-slate-200 text-sm leading-snug">{snag.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">{snag.projectName} · {snag.location}</p>
                      </div>
                      <StatusBadge status={snag.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e2d4a]">
                      <span className="text-xs text-slate-500">Assigned: <span className="font-medium text-slate-300">{snag.assignedTo}</span></span>
                      <span className="text-xs text-slate-500">Due: {new Date(snag.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      <div className="flex items-center gap-2 ml-auto">
                        {snag.comments.length > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-slate-500"><MessageSquare size={11} />{snag.comments.length}</span>
                        )}
                        {attCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">
                            <Paperclip size={9} />{attCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedSnag(snag); }}
                          className="p-1 rounded text-slate-600 hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
                          title="Edit snag"
                        >
                          <Edit2 size={13} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteConfirm(snag.id); }}
                            className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                            title="Delete snag"
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
          <div className="text-center py-16 bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <AlertTriangle size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No snags match your filters</p>
          </div>
        )}
      </div>

      {liveSelected && !selectMode && (
        <SnagDetail
          snag={liveSelected}
          onClose={() => setSelectedSnag(null)}
          onUpdate={(updated) => { store.updateSnag(updated); setSelectedSnag(updated); }}
          onEdit={() => { setEditSnag(liveSelected); setSelectedSnag(null); }}
          onDelete={() => { setDeleteConfirm(liveSelected.id); setSelectedSnag(null); }}
          isAdmin={isAdmin}
        />
      )}
      {showRaise && (
        <RaiseSnagModal onClose={() => setShowRaise(false)} onSave={handleRaiseSnag} />
      )}
      {editSnag && (
        <RaiseSnagModal initial={editSnag} onClose={() => setEditSnag(null)} onSave={handleEditSnag} />
      )}
      {showSendPdf && (
        <SendPdfModal selectedSnags={selectedSnags} onClose={() => setShowSendPdf(false)} />
      )}
      {deleteConfirm && (
        <ConfirmDeleteModal
          title="Delete Snag"
          description="This snag and all linked attachments will be permanently deleted."
          onConfirm={() => { store.removeSnag(deleteConfirm); setDeleteConfirm(null); if (selectedSnag?.id === deleteConfirm) setSelectedSnag(null); }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
