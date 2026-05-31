import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Search, ChevronDown, Clock, CheckCircle, Mail, Download, FileText, CreditCard as Edit2, MessageSquare, Paperclip, Trash2, Eye, File, Image } from 'lucide-react';
import { openPrintTab, buildPrintDocument } from '../lib/printTab';
import { type Action, type ActionStatus, type ActionComment } from '../data/types';
import FileUploadComponent from '../components/FileUpload';
import type { UploadedFile } from '../components/FileUpload';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import type { DBAttachment } from '../lib/store';
import MentionTextarea, { renderWithMentions } from '../components/MentionTextarea';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const statusColors: Record<ActionStatus, string> = {
  'Not Started': 'bg-[#1e2d4a] text-slate-300',
  'In Progress': 'bg-blue-900/60 text-blue-300',
  Waiting: 'bg-amber-900/60 text-amber-300',
  Complete: 'bg-emerald-900/60 text-emerald-300',
};

const priorityBorderColors: Record<string, string> = {
  High: 'border-l-red-400',
  Medium: 'border-l-amber-400',
  Low: 'border-l-slate-600',
};

function StatusBadge({ status }: { status: ActionStatus }) {
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${statusColors[status]}`}>
      {status}
    </span>
  );
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

// ─── Action Detail modal ───────────────────────────────────────────────────────

interface ActionDetailProps {
  action: Action;
  onClose: () => void;
  onUpdate: (updated: Action) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

function ActionDetail({ action, onClose, onUpdate, canEdit = true, canDelete: _canDelete = false }: ActionDetailProps) {
  const store = useAppStore();
  const [tab, setTab] = useState<'details' | 'comments' | 'files'>('details');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: action.title, description: action.description, owner: action.owner, dueDate: action.dueDate, priority: action.priority });
  const [newComment, setNewComment] = useState('');
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // comments live in action.comments — persisted via onUpdate
  const comments: ActionComment[] = action.comments ?? [];

  // Live attachments for this action from the store
  const actionAttachments = useMemo(
    () => store.attachments.filter(a => a.linked_type === 'action' && a.linked_id === action.id),
    [store.attachments, action.id]
  );

  const totalFiles = actionAttachments.length + pendingFiles.length;

  const inputCls = 'mt-1 w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';

  const saveEdit = () => {
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = !!editForm.dueDate && editForm.dueDate < today && action.status !== 'Complete';
    onUpdate({ ...action, ...editForm, overdue: isOverdue });
    setEditing(false);
  };

  const addComment = (text: string) => {
    if (!text.trim()) return;
    const newC: ActionComment = { id: `c${Date.now()}`, user: store.currentUser?.name ?? '', datetime: new Date().toISOString(), text: text.trim() };
    onUpdate({ ...action, comments: [...comments, newC] });
    setNewComment('');
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    for (const f of pendingFiles) {
      const att: DBAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        linked_type: 'action',
        linked_id: action.id,
        project_id: action.projectId,
        project_name: action.projectName,
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
        <div className="flex items-start justify-between p-5 border-b border-[#1e2d4a] shrink-0">
          <div className="flex-1 pr-4 min-w-0">
            <span className="text-xs font-mono text-slate-500">#{action.id.toUpperCase()}</span>
            <h2 className="text-base font-bold text-white mt-0.5 leading-snug">{action.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{action.projectName}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                onClick={() => { setEditing(e => !e); setTab('details'); }}
                className={`p-1.5 rounded-lg transition-colors ${editing ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a]'}`}
                title="Edit"
              >
                <Edit2 size={15} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2d4a] shrink-0">
          {(['details', 'comments', 'files'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setEditing(false); }}
              className={`px-5 py-3 text-xs font-semibold transition-colors capitalize border-b-2 -mb-px ${
                tab === t ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t}
              {t === 'comments' && comments.length > 0 && (
                <span className="ml-1.5 bg-[#f97316]/20 text-[#f97316] text-[9px] px-1.5 py-0.5 rounded-full">{comments.length}</span>
              )}
              {t === 'files' && totalFiles > 0 && (
                <span className="ml-1.5 bg-slate-700 text-slate-300 text-[9px] px-1.5 py-0.5 rounded-full">{totalFiles}</span>
              )}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Details Tab — view */}
          {tab === 'details' && !editing && (
            <>
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={action.status} />
                {action.overdue && (
                  <span className="text-[10px] font-bold text-red-400 bg-red-900/50 px-2.5 py-1 rounded-full border border-red-800">OVERDUE</span>
                )}
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  action.priority === 'High' ? 'bg-red-900/50 text-red-400 border-red-800'
                    : action.priority === 'Medium' ? 'bg-amber-900/50 text-amber-400 border-amber-800'
                    : 'bg-[#1e2d4a] text-slate-400 border-slate-700'
                }`}>{action.priority} Priority</span>
                {actionAttachments.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-[#1e2d4a] px-2 py-1 rounded-full">
                    <Paperclip size={10} />{actionAttachments.length} attachment{actionAttachments.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Owner', value: action.owner },
                  { label: 'Due Date', value: new Date(action.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), overdue: action.overdue },
                  { label: 'Created By', value: action.createdBy },
                  { label: 'Created', value: new Date(action.createdDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                ].map(item => (
                  <div key={item.label} className="bg-[#0d1628] rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className={`text-sm font-medium ${item.overdue ? 'text-red-400' : 'text-slate-200'}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-slate-400 leading-relaxed">{action.description || <span className="italic text-slate-600">No description</span>}</p>
              </div>
              {/* Inline attachment summary on details tab */}
              {actionAttachments.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attachments</p>
                  <AttachmentList attachments={actionAttachments} onRemove={id => store.removeAttachment(id)} />
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Update Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['Not Started', 'In Progress', 'Waiting', 'Complete'] as ActionStatus[]).map(s => (
                    <button key={s} onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      const isOverdue = s !== 'Complete' && !!action.dueDate && action.dueDate < today;
                      onUpdate({ ...action, status: s, overdue: isOverdue });
                    }}
                      className={`py-2 rounded-lg text-xs font-semibold transition-colors border ${
                        action.status === s
                          ? s === 'Not Started' ? 'bg-slate-600 text-white border-slate-600'
                            : s === 'In Progress' ? 'bg-blue-500 text-white border-blue-500'
                            : s === 'Waiting' ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-[#0d1628] text-slate-400 border-[#1e2d4a] hover:border-slate-500'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Details Tab — edit */}
          {tab === 'details' && editing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</label>
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className={`${inputCls} resize-none`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Owner</label>
                  <input value={editForm.owner} onChange={e => setEditForm(f => ({ ...f, owner: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</label>
                  <input type="date" value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</label>
                <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as 'High' | 'Medium' | 'Low' }))} className={inputCls}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
                <button onClick={saveEdit} className="flex-1 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">Save Changes</button>
              </div>
            </div>
          )}

          {/* Comments Tab */}
          {tab === 'comments' && (
            <>
              {comments.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare size={28} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No comments yet</p>
                </div>
              )}
              <div className="space-y-3 mb-3">
                {comments.map(c => (
                  <div key={c.id} className="bg-[#0d1628] rounded-xl p-4 border border-[#1e2d4a]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-[#f97316]/20 flex items-center justify-center text-[9px] font-bold text-[#f97316]">
                        {c.user.split(' ').map(w => w[0]).join('')}
                      </div>
                      <span className="text-xs font-semibold text-slate-300">{c.user}</span>
                      <span className="text-[10px] text-slate-600 ml-auto">
                        {new Date(c.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(c.datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{renderWithMentions(c.text)}</p>
                  </div>
                ))}
              </div>
              <MentionTextarea
                value={newComment}
                onChange={setNewComment}
                onSubmit={addComment}
                linkedType="action"
                linkedId={action.id}
                projectId={action.projectId}
                projectName={action.projectName}
              />
            </>
          )}

          {/* Files Tab — persistent uploads */}
          {tab === 'files' && (
            <div className="space-y-4">
              {/* Existing persisted attachments */}
              {actionAttachments.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Saved Attachments ({actionAttachments.length})
                  </p>
                  <AttachmentList attachments={actionAttachments} onRemove={id => store.removeAttachment(id)} />
                </div>
              )}

              {/* Upload new files */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {actionAttachments.length > 0 ? 'Add More Files' : 'Upload Files, Documents & Photos'}
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

              {actionAttachments.length === 0 && pendingFiles.length === 0 && (
                <div className="text-center py-8">
                  <Image size={28} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No attachments yet</p>
                  <p className="text-xs text-slate-700 mt-1">Upload photos, drawings or documents as evidence</p>
                </div>
              )}
            </div>
          )}
        </div>

        {tab === 'details' && !editing && (
          <div className="p-5 border-t border-[#1e2d4a] shrink-0">
            <button
              onClick={() => { onUpdate({ ...action, status: 'Complete', overdue: false }); onClose(); }}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} />Mark as Complete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Action modal ───────────────────────────────────────────────────────

interface CreateActionModalProps {
  onClose: () => void;
  onSave: (action: Omit<Action, 'id'>, files: UploadedFile[]) => void;
}

function CreateActionModal({ onClose, onSave }: CreateActionModalProps) {
  const store = useAppStore();
  const [form, setForm] = useState({
    project: '',
    title: '',
    description: '',
    owner: '',
    dueDate: '',
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
  });
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const project = store.projects.find(p => p.name === form.project);
    onSave({
      projectId: project?.id || '',
      projectName: form.project,
      title: form.title,
      description: form.description,
      owner: form.owner,
      dueDate: form.dueDate,
      status: 'Not Started',
      priority: form.priority,
      createdBy: store.currentUser?.name ?? '',
      createdDate: new Date().toISOString().split('T')[0],
      overdue: !!form.dueDate && form.dueDate < new Date().toISOString().slice(0, 10),
      comments: [],
    }, pendingFiles);
    onClose();
  };

  const allProjects = useMemo(() => {
    return store.projects.map(p => p.name).sort();
  }, [store.projects]);

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a] shrink-0">
          <h2 className="text-lg font-bold text-white">Create Action</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <label className={labelCls}>Project *</label>
            <div className="relative">
              <select required value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
                className={`${inputCls} appearance-none pr-8`}>
                <option value="">Select project...</option>
                {allProjects.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Action Title *</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className={inputCls} placeholder="What needs to be done?" />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Owner *</label>
              <input required value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as 'High' | 'Medium' | 'Low' }))} className={inputCls}>
                <option>High</option><option>Medium</option><option>Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Due Date *</label>
            <input required type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inputCls} />
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
              Create Action{pendingFiles.length > 0 ? ` + ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}` : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Send PDF modal ────────────────────────────────────────────────────────────

interface SendPdfModalProps {
  selectedActions: Action[];
  onClose: () => void;
}

function SendPdfModal({ selectedActions, onClose }: SendPdfModalProps) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const [emailTo, setEmailTo] = useState('');
  const [subject, setSubject] = useState(`Actions Report — VYSITE — ${today}`);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5';

  const handleSend = () => { setSent(true); setTimeout(onClose, 1800); };

  const handleDownloadPDF = () => {
    const rows = selectedActions.map(a => {
      const overdueBadge = a.overdue ? ' <span style="display:inline-block;background:#fee2e2;color:#dc2626;font-size:9px;font-weight:700;padding:1px 6px;border-radius:9999px;margin-left:4px">OVERDUE</span>' : '';
      const priorityColor = a.priority === 'High' ? '#dc2626' : a.priority === 'Medium' ? '#d97706' : '#64748b';
      const dueDateColor = a.overdue ? '#dc2626' : '#1e293b';
      return `<tr>
        <td style="font-family:monospace;font-size:10px;color:#64748b">#${a.id.toUpperCase()}</td>
        <td>${a.title}${overdueBadge}</td>
        <td>${a.projectName}</td>
        <td>${a.owner}</td>
        <td>${a.status}</td>
        <td style="color:${priorityColor};font-weight:700">${a.priority}</td>
        <td style="color:${dueDateColor}">${new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
      </tr>`;
    }).join('');
    const styles = `
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:14px;margin-bottom:22px}
      .logo{font-size:22px;font-weight:900;color:#f97316;letter-spacing:2px}
      .dateline{font-size:11px;color:#666;margin-top:3px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#f1f5f9;color:#334155;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
      td{padding:8px 10px;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:top}
      tr:nth-child(even) td{background:#f8fafc}
    `;
    const body = `
      <div class="header">
        <div>
          <div class="logo">VYSITE</div>
          <div class="dateline">Actions Report · Generated ${today} · ${selectedActions.length} action${selectedActions.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Ref</th><th>Title</th><th>Project</th><th>Owner</th><th>Status</th><th>Priority</th><th>Due Date</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:10px;color:#94a3b8;text-align:center">Generated by VYSITE · ${today}</div>
    `;
    openPrintTab(buildPrintDocument('Actions Report — VYSITE', styles, body));
  };

  return (
    <>

      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500/20 rounded-lg flex items-center justify-center"><FileText size={18} className="text-[#f97316]" /></div>
              <div><h2 className="text-base font-bold text-white">Send Actions Report</h2><p className="text-xs text-slate-500">{selectedActions.length} action{selectedActions.length !== 1 ? 's' : ''} selected</p></div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
          </div>
          <div className="overflow-y-auto flex-1">
            <div className="p-6 border-b border-[#1e2d4a]">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Actions Included</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedActions.map(a => (
                  <div key={a.id} className="flex items-start gap-3 bg-[#0d1628] rounded-lg p-3">
                    <span className="text-[10px] font-mono text-slate-600 shrink-0 mt-0.5">#{a.id.toUpperCase()}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-200 truncate">{a.title}</span>
                        {a.overdue && <span className="text-[9px] font-bold text-red-400 bg-red-900/50 px-1.5 py-0.5 rounded-full border border-red-800 shrink-0">OVERDUE</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[10px] text-slate-500 truncate">{a.projectName}</span>
                        <span className="text-[10px] text-slate-500">Owner: <span className="text-slate-400">{a.owner}</span></span>
                        <span className={`text-[10px] font-semibold ${a.priority === 'High' ? 'text-red-400' : a.priority === 'Medium' ? 'text-amber-400' : 'text-slate-500'}`}>{a.priority}</span>
                        <StatusBadge status={a.status} />
                        <span className={`flex items-center gap-1 text-[10px] ${a.overdue ? 'text-red-400' : 'text-slate-500'}`}><Clock size={10} />{new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div><label className={labelCls}>Email To</label><input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} className={inputCls} placeholder="recipient@example.com" /></div>
              <div><label className={labelCls}>Subject</label><input value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Message</label><textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className={`${inputCls} resize-none`} placeholder="Add an optional message..." /></div>
              {sent && (
                <div className="flex items-center gap-2 bg-emerald-900/40 border border-emerald-800 rounded-lg px-4 py-3">
                  <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                  <span className="text-sm font-semibold text-emerald-300">Report sent successfully</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 p-6 border-t border-[#1e2d4a] shrink-0">
            <button type="button" onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors">
              <Download size={15} />Download PDF
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
              <button onClick={handleSend} disabled={sent} className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                <Mail size={15} />Send Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Actions page ─────────────────────────────────────────────────────────

interface ActionsProps {
  pendingOpen?: { linkedType: string; linkedId: string } | null;
  onPendingOpenConsumed?: () => void;
  pendingFilter?: { filterKey: string; filterValue: string } | null;
  onPendingFilterConsumed?: () => void;
}

export default function Actions({ pendingOpen, onPendingOpenConsumed, pendingFilter, onPendingFilterConsumed }: ActionsProps) {
  const store = useAppStore();
  const actionList = store.visibleProjectIds
    ? store.actions.filter(a => store.visibleProjectIds!.includes(a.projectId))
    : store.actions;
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterProject, setFilterProject] = useState<string>('All');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const perms = usePermissions();
  const isAdmin = store.currentUser?.role === 'Admin';
  const canCreate = perms['actions.create'] || isAdmin;
  const canEdit   = perms['actions.edit']   || isAdmin;
  const canDelete = perms['actions.delete'] || isAdmin;
  const canExport = perms['actions.export'] || isAdmin;

  useEffect(() => {
    if (pendingOpen?.linkedType === 'action' && pendingOpen.linkedId) {
      const found = store.actions.find(a => a.id === pendingOpen.linkedId);
      if (found) { setSelectedAction(found); onPendingOpenConsumed?.(); }
    }
  }, [pendingOpen, store.actions, onPendingOpenConsumed]);

  useEffect(() => {
    if (!pendingFilter) return;
    if (pendingFilter.filterKey === 'status') {
      setFilterStatus(pendingFilter.filterValue);
    } else if (pendingFilter.filterKey === 'project') {
      setFilterProject(pendingFilter.filterValue);
    }
    onPendingFilterConsumed?.();
  }, [pendingFilter, onPendingFilterConsumed]);

  const filtered = actionList.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.owner.toLowerCase().includes(search.toLowerCase()) ||
      a.projectName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || a.status === filterStatus || (filterStatus === 'Overdue' && a.overdue);
    const matchProject = filterProject === 'All' || a.projectName === filterProject || a.projectId === filterProject;
    return matchSearch && matchStatus && matchProject;
  });

  const stats = {
    total: actionList.length,
    overdue: actionList.filter(a => a.overdue).length,
    inProgress: actionList.filter(a => a.status === 'In Progress').length,
    complete: actionList.filter(a => a.status === 'Complete').length,
  };

  const uniqueProjects = Array.from(new Set(actionList.map(a => a.projectName)));

  const toggleSelectMode = () => { setSelectMode(p => !p); setSelectedIds(new Set()); };
  const toggleId = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelectedIds(new Set(filtered.map(a => a.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const selectedActions = actionList.filter(a => selectedIds.has(a.id));

  // Liveselect: keep modal in sync when store updates
  const liveSelected = selectedAction
    ? (actionList.find(a => a.id === selectedAction.id) ?? selectedAction)
    : null;

  async function handleCreateAction(data: Omit<Action, 'id'>, files: UploadedFile[]) {
    const newAction: Action = { ...data, id: `a${Date.now()}`, comments: [] };
    await store.addAction(newAction);
    // Persist any attached files
    if (files.length > 0) {
      for (const f of files) {
        const att: DBAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          linked_type: 'action',
          linked_id: newAction.id,
          project_id: newAction.projectId,
          project_name: newAction.projectName,
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
          <h2 className="text-lg font-bold text-white">Actions Tracker</h2>
          <p className="text-sm text-slate-500">{actionList.filter(a => a.status !== 'Complete').length} open actions · {stats.overdue} overdue</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
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
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
            >
              <Plus size={16} />Create Action
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'All Actions', value: stats.total, color: 'text-white', filter: 'All' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-400', filter: 'Overdue', extra: stats.overdue > 0 ? 'border-red-900/50' : '' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-400', filter: 'In Progress' },
          { label: 'Complete', value: stats.complete, color: 'text-emerald-400', filter: 'Complete' },
        ].map(s => (
          <button key={s.label} onClick={() => setFilterStatus(filterStatus === s.filter ? 'All' : s.filter)}
            className={`bg-[#1a2236] rounded-xl border p-4 text-center transition-all hover:border-[#2a3d5a] cursor-pointer ${filterStatus === s.filter ? 'border-[#f97316] ring-1 ring-[#f97316]/30' : `border-[#1e2d4a] ${s.extra || ''}`}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions..."
              className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600 min-w-0" />
          </div>
          <div className="relative shrink-0">
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-[#f97316] appearance-none pr-8 w-full sm:w-auto">
              <option value="All">All Projects</option>
              {uniqueProjects.map(p => <option key={p} value={p}>{p.split(' ').slice(0, 3).join(' ')}...</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>
        <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
          {['All', 'Not Started', 'In Progress', 'Waiting', 'Complete', 'Overdue'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${filterStatus === s ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{s}</button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-white">{selectedIds.size} selected</span>
          <button onClick={() => setShowPdfModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
            <Mail size={14} />Send as PDF via Email
          </button>
          <button onClick={selectAll} className="px-3 py-2 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors">Select All</button>
          <button onClick={clearSelection} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors ml-auto">Clear selection</button>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((action) => {
          const attCount = store.attachments.filter(a => a.linked_type === 'action' && a.linked_id === action.id).length;
          return (
            <div key={action.id}
              className={`bg-[#1a2236] rounded-xl border border-l-4 ${priorityBorderColors[action.priority]} transition-all ${
                selectMode ? selectedIds.has(action.id) ? 'border-orange-500/60 cursor-pointer' : 'border-[#1e2d4a] hover:border-[#2a3d5a] cursor-pointer'
                : 'border-[#1e2d4a] hover:border-[#2a3d5a] cursor-pointer'
              }`}
              onClick={() => selectMode ? toggleId(action.id) : setSelectedAction(action)}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {selectMode && (
                    <div className="shrink-0 mt-0.5 pt-0.5" onClick={e => { e.stopPropagation(); toggleId(action.id); }}>
                      <input type="checkbox" checked={selectedIds.has(action.id)} onChange={() => toggleId(action.id)}
                        className="w-4 h-4 rounded border-slate-600 bg-[#0d1628] accent-orange-500 cursor-pointer" />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-slate-600">#{action.id.toUpperCase()}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${action.priority === 'High' ? 'bg-red-900/50 text-red-400' : action.priority === 'Medium' ? 'bg-amber-900/50 text-amber-400' : 'bg-[#1e2d4a] text-slate-500'}`}>{action.priority}</span>
                        {action.overdue && <span className="text-[9px] font-bold text-red-400 bg-red-900/50 px-1.5 py-0.5 rounded-full border border-red-800">OVERDUE</span>}
                      </div>
                      <h3 className="font-semibold text-slate-200 text-sm leading-snug">{action.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{action.projectName}</p>
                    </div>
                    <StatusBadge status={action.status} />
                  </div>
                </div>
                <div className={`flex items-center gap-3 mt-3 pt-3 border-t border-[#1e2d4a] ${selectMode ? 'pl-7' : ''}`}>
                  <span className="text-xs text-slate-500">Owner: <span className="font-medium text-slate-300">{action.owner}</span></span>
                  <span className={`flex items-center gap-1 text-xs ${action.overdue ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>
                    <Clock size={11} />{new Date(action.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    {(action.comments?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                        <MessageSquare size={11} />{action.comments!.length}
                      </span>
                    )}
                    {attCount > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-500 bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">
                        <Paperclip size={9} />{attCount}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedAction(action); }}
                      className="p-1 rounded text-slate-600 hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
                      title="Edit action"
                    >
                      <Edit2 size={13} />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(action.id); }}
                        className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                        title="Delete action"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <CheckCircle size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No actions match your filters</p>
          </div>
        )}
      </div>

      {liveSelected && !selectMode && (
        <ActionDetail
          action={liveSelected}
          onClose={() => setSelectedAction(null)}
          onUpdate={async (updated) => { await store.updateAction(updated); setSelectedAction(updated); }}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
      {showCreate && (
        <CreateActionModal onClose={() => setShowCreate(false)} onSave={handleCreateAction} />
      )}
      {showPdfModal && (
        <SendPdfModal selectedActions={selectedActions} onClose={() => setShowPdfModal(false)} />
      )}
      {deleteConfirm && (
        <ConfirmDeleteModal
          title="Delete Action"
          description="This action and all linked attachments will be permanently deleted."
          onConfirm={() => { store.removeAction(deleteConfirm); setDeleteConfirm(null); if (selectedAction?.id === deleteConfirm) setSelectedAction(null); }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
