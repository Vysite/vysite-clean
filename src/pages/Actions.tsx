import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Search, ChevronDown, Clock, CheckCircle, Download, FileText, CreditCard as Edit2, MessageSquare, Paperclip, Trash2, Eye, File, Image, Copy, Printer } from 'lucide-react';
import { openPrintTab } from '../lib/printTab';
import { type Action, type ActionStatus, type ActionComment } from '../data/types';
import FileUploadComponent from '../components/FileUpload';
import type { UploadedFile } from '../components/FileUpload';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import type { DBAttachment } from '../lib/store';
import MentionTextarea, { renderWithMentions } from '../components/MentionTextarea';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { logActivity, buildDiff, type FieldSpec } from '../lib/activityLog';
import { RowActionsMenu } from '../components/RowActionsMenu';

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

const ACTION_STATUSES: ActionStatus[] = ['Not Started', 'In Progress', 'Waiting', 'Complete'];

interface InlineStatusProps {
  status: ActionStatus;
  canEdit: boolean;
  onChange: (s: ActionStatus) => void;
}
function InlineStatus({ status, canEdit, onChange }: InlineStatusProps) {
  const cls = statusColors[status] ?? 'bg-[#1e2d4a] text-slate-300';
  if (!canEdit) {
    return <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${cls}`}>{status}</span>;
  }
  return (
    <select
      value={status}
      onClick={e => e.stopPropagation()}
      onChange={e => { e.stopPropagation(); onChange(e.target.value as ActionStatus); }}
      className={`text-[10px] font-semibold px-2.5 py-1 rounded-full cursor-pointer outline-none appearance-none ${cls} hover:opacity-80 transition-opacity`}
      style={{ backgroundImage: 'none' }}
    >
      {ACTION_STATUSES.map(s => (
        <option key={s} value={s} className="bg-[#1a2236] text-slate-200 text-xs font-normal">{s}</option>
      ))}
    </select>
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
  initialData?: Action | null;
}

function CreateActionModal({ onClose, onSave, initialData }: CreateActionModalProps) {
  const store = useAppStore();
  const [form, setForm] = useState({
    project: initialData?.projectName ?? '',
    title: initialData?.title ?? '',
    description: initialData?.description ?? '',
    owner: initialData?.owner ?? '',
    dueDate: initialData?.dueDate ?? '',
    priority: (initialData?.priority ?? 'Medium') as 'High' | 'Medium' | 'Low',
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

// ─── PDF export ───────────────────────────────────────────────────────────────

const ACTION_PDF_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { margin: 0; size: A4; }
@media print {
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-break { page-break-inside: avoid; break-inside: avoid; }
  .pb-before { page-break-before: always; break-before: always; }
}
html, body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9pt;
  color: #0f172a;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.act-header {
  background: #0f172a;
  padding: 20px 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.act-header-logo img { height: 32px; max-width: 140px; object-fit: contain; display: block; }
.act-header-logo-text { font-size: 13pt; font-weight: 900; letter-spacing: 0.18em; color: #ea6c00; text-transform: uppercase; }
.act-header-logo-sub { font-size: 6pt; color: #94a3b8; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3px; }
.act-header-center { text-align: center; flex: 1; padding: 0 24px; }
.act-header-doc { font-size: 14pt; font-weight: 700; color: #fff; letter-spacing: 0.04em; text-transform: uppercase; }
.act-header-ref { font-size: 9pt; color: #94a3b8; margin-top: 4px; letter-spacing: 0.06em; }
.act-header-right { text-align: right; min-width: 110px; }
.act-header-date { font-size: 7pt; color: #64748b; margin-top: 4px; }

.act-info-band {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border: 1px solid #e2e8f0;
  border-top: none;
  background: #fff;
}
.act-info-col { padding: 14px 20px; border-right: 1px solid #e2e8f0; }
.act-info-col:last-child { border-right: none; }
.act-info-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #94a3b8; margin-bottom: 2px; }
.act-info-value { font-size: 9pt; font-weight: 600; color: #0f172a; line-height: 1.3; }
.act-info-meta-row { margin-bottom: 8px; }
.act-info-meta-row:last-child { margin-bottom: 0; }

.act-body { padding: 24px 36px 36px; }

.act-section { border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 16px; overflow: hidden; }
.act-section-head {
  background: #f8fafc; padding: 9px 16px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 8pt; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #0f172a;
}
.act-section-body { padding: 14px 16px; }

.act-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
.act-detail-row { padding: 7px 0; border-bottom: 1px solid #f1f5f9; display: grid; grid-template-columns: 110px 1fr; gap: 8px; align-items: baseline; }
.act-detail-row:last-child { border-bottom: none; }
.act-detail-label { font-size: 7pt; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; }
.act-detail-value { font-size: 8.5pt; color: #0f172a; font-weight: 500; line-height: 1.5; word-break: break-word; }
.act-detail-value.bold { font-weight: 700; }
.act-status-badge {
  display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 7pt; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.act-priority-high { color: #991b1b; background: #fef2f2; border: 1px solid #fca5a5; }
.act-priority-medium { color: #92400e; background: #fffbeb; border: 1px solid #fde68a; }
.act-priority-low { color: #374151; background: #f9fafb; border: 1px solid #d1d5db; }
.act-text-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 12px; font-size: 8.5pt; color: #334155; line-height: 1.7; white-space: pre-wrap; word-break: break-word; margin-top: 6px; }

.att-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 0.5px solid #f1f5f9; }
.att-item:last-child { border-bottom: none; }
.att-name { font-size: 8pt; font-weight: 600; color: #0f172a; word-break: break-all; }
.att-meta { font-size: 7pt; color: #94a3b8; margin-top: 2px; }
.att-dl { font-size: 7pt; color: #ea6c00; text-decoration: none; font-weight: 700; }

.act-notice { border: 1px solid #fed7aa; border-left: 3px solid #ea6c00; background: #fffbf5; border-radius: 4px; padding: 10px 14px; margin-bottom: 16px; }
.act-notice-label { font-size: 6.5pt; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 5px; }
.act-notice-text { font-size: 7.5pt; color: #92400e; line-height: 1.65; }

.act-footer {
  border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;
  padding: 10px 36px; margin-top: 4px;
}
.act-footer-logo img { height: 22px; max-width: 100px; object-fit: contain; display: block; }
.act-footer-logo-text { font-size: 10pt; font-weight: 900; letter-spacing: 0.18em; color: #ea6c00; text-transform: uppercase; }
.act-footer-center { font-size: 7pt; color: #94a3b8; }
.act-footer-right { font-size: 7pt; color: #94a3b8; text-align: right; }
`;

function escAct(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtActDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return '—'; }
}

function actStatusStyle(status: string): string {
  const styles: Record<string, string> = {
    'Not Started': 'background:#1e293b;color:#94a3b8;',
    'In Progress':  'background:#0c4a6e;color:#7dd3fc;',
    'Waiting':      'background:#78350f;color:#fcd34d;',
    'Complete':     'background:#065f46;color:#6ee7b7;',
  };
  return styles[status] ?? 'background:#374151;color:#d1d5db;';
}

interface ActionPDFData {
  action: Action;
  attachments: DBAttachment[];
  logoUrl?: string;
  today: string;
}

function buildActionPageHTML(d: ActionPDFData): string {
  const { action, attachments, logoUrl, today } = d;
  const priorityCls = action.priority === 'High' ? 'act-priority-high' : action.priority === 'Medium' ? 'act-priority-medium' : 'act-priority-low';

  const brandHtml = logoUrl
    ? `<div class="act-header-logo"><img src="${logoUrl}" alt="Logo"></div>`
    : `<div class="act-header-logo"><div class="act-header-logo-text">VYSITE</div><div class="act-header-logo-sub">Construction Management</div></div>`;

  const header = `<div class="act-header">
    ${brandHtml}
    <div class="act-header-center">
      <div class="act-header-doc">Action Record</div>
      <div class="act-header-ref">#${escAct(action.id.toUpperCase())}</div>
    </div>
    <div class="act-header-right">
      <div class="act-status-badge" style="${actStatusStyle(action.status)}">${escAct(action.status)}</div>
      <div class="act-header-date">Generated: ${escAct(today)}</div>
    </div>
  </div>`;

  const infoBand = `<div class="act-info-band">
    <div class="act-info-col">
      <div class="act-info-meta-row">
        <div class="act-info-label">Project</div>
        <div class="act-info-value">${escAct(action.projectName || '—')}</div>
      </div>
      <div class="act-info-meta-row">
        <div class="act-info-label">Owner</div>
        <div class="act-info-value">${escAct(action.owner || '—')}</div>
      </div>
    </div>
    <div class="act-info-col">
      <div class="act-info-meta-row">
        <div class="act-info-label">Priority</div>
        <div class="act-info-value"><span class="act-status-badge ${priorityCls}">${escAct(action.priority)}</span></div>
      </div>
      <div class="act-info-meta-row">
        <div class="act-info-label">Due Date</div>
        <div class="act-info-value" style="${action.overdue ? 'color:#dc2626;font-weight:700;' : ''}">${fmtActDate(action.dueDate)}${action.overdue ? ' — OVERDUE' : ''}</div>
      </div>
    </div>
  </div>`;

  const detailsSection = `<div class="act-section no-break">
    <div class="act-section-head">Action Details</div>
    <div class="act-section-body">
      <div class="act-details-grid">
        <div>
          <div class="act-detail-row">
            <div class="act-detail-label">Title</div>
            <div class="act-detail-value bold">${escAct(action.title)}</div>
          </div>
          <div class="act-detail-row">
            <div class="act-detail-label">Status</div>
            <div class="act-detail-value"><span class="act-status-badge" style="${actStatusStyle(action.status)}">${escAct(action.status)}</span></div>
          </div>
          <div class="act-detail-row">
            <div class="act-detail-label">Priority</div>
            <div class="act-detail-value"><span class="act-status-badge ${priorityCls}">${escAct(action.priority)}</span></div>
          </div>
        </div>
        <div>
          <div class="act-detail-row">
            <div class="act-detail-label">Assigned To</div>
            <div class="act-detail-value">${escAct(action.owner)}</div>
          </div>
          <div class="act-detail-row">
            <div class="act-detail-label">Due Date</div>
            <div class="act-detail-value" style="${action.overdue ? 'color:#dc2626;font-weight:700;' : ''}">${fmtActDate(action.dueDate)}</div>
          </div>
          <div class="act-detail-row">
            <div class="act-detail-label">Created By</div>
            <div class="act-detail-value">${escAct(action.createdBy)}</div>
          </div>
          <div class="act-detail-row">
            <div class="act-detail-label">Created</div>
            <div class="act-detail-value">${fmtActDate(action.createdDate)}</div>
          </div>
        </div>
      </div>
      ${action.description ? `<div style="margin-top:12px;">
        <div class="act-detail-label" style="margin-bottom:4px;">Description</div>
        <div class="act-text-block">${escAct(action.description)}</div>
      </div>` : ''}
    </div>
  </div>`;

  const attSection = `<div class="act-section no-break">
    <div class="act-section-head">Attachments${attachments.length > 0 ? ` (${attachments.length})` : ''}</div>
    <div class="act-section-body">
      ${attachments.length === 0
        ? '<p style="font-size:8pt;color:#94a3b8;font-style:italic;">No attachments.</p>'
        : attachments.map(a => {
            const sz = a.size ? (a.size < 1024 * 1024 ? `${(a.size / 1024).toFixed(0)} KB` : `${(a.size / (1024 * 1024)).toFixed(1)} MB`) : '';
            const uploaded = a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB') : '';
            const dlLink = a.data_url ? `<a class="att-dl" href="${a.data_url}" download="${escAct(a.name)}">Download</a>` : '';
            return `<div class="att-item">
              <div style="flex:1;min-width:0;">
                <div class="att-name">${escAct(a.name)}</div>
                <div class="att-meta">${a.category ? escAct(a.category) + ' &middot; ' : ''}${sz}${uploaded ? ' &middot; Uploaded: ' + uploaded : ''}</div>
                ${dlLink ? `<div style="margin-top:3px;">${dlLink}</div>` : ''}
              </div>
            </div>`;
          }).join('')
      }
    </div>
  </div>`;

  const notice = `<div class="act-notice no-break">
    <div class="act-notice-label">Notice</div>
    <div class="act-notice-text">
      This Action Record has been issued in accordance with the project management procedures applicable to this contract.
      The action described above requires resolution by the due date specified. Failure to complete this action within the required timeframe
      may result in an impact to programme, cost, or quality. The assigned owner is responsible for ensuring the action is completed and
      evidenced accordingly. This document has been generated electronically and is valid without a wet signature.
    </div>
  </div>`;

  const footer = `<div class="act-footer">
    ${logoUrl
      ? `<div class="act-footer-logo"><img src="${logoUrl}" alt="Logo"></div>`
      : `<div class="act-footer-logo-text">VYSITE</div>`}
    <div class="act-footer-center">Powered by VYSITE</div>
    <div class="act-footer-right">Page 1 of 1</div>
  </div>`;

  return `${header}${infoBand}<div class="act-body">${detailsSection}${attSection}${notice}</div>${footer}`;
}

function buildActionPDFShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escAct(title)}</title>
<style>${ACTION_PDF_CSS}</style>
<script>window.onload=function(){window.print();};<\/script>
</head>
<body>${body}</body>
</html>`;
}

function exportActionsPDF(actions: Action[], attachmentsByActionId: Record<string, DBAttachment[]>, logoUrl?: string) {
  if (actions.length === 0) return;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const pages = actions.map((a, i) => {
    const atts = attachmentsByActionId[a.id] ?? [];
    const page = buildActionPageHTML({ action: a, attachments: atts, logoUrl, today });
    return i > 0 ? `<div class="pb-before">${page}</div>` : page;
  }).join('');
  openPrintTab(buildActionPDFShell(
    actions.length === 1 ? `Action — ${actions[0].title}` : `Actions (${actions.length})`,
    pages,
  ));
}

function exportSingleActionPDF(action: Action, attachments: DBAttachment[], logoUrl?: string) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  openPrintTab(buildActionPDFShell(
    `Action — ${action.title}`,
    buildActionPageHTML({ action, attachments, logoUrl, today }),
  ));
}

// ─── Main Actions page ─────────────────────────────────────────────────────────

const ACTION_FIELDS: FieldSpec[] = [
  { label: 'Status',      key: 'status' },
  { label: 'Priority',    key: 'priority' },
  { label: 'Title',       key: 'title' },
  { label: 'Owner',       key: 'owner' },
  { label: 'Due Date',    key: 'dueDate' },
  { label: 'Description', key: 'description', isNarrative: true },
];

interface ActionsProps {
  pendingOpen?: { linkedType: string; linkedId: string } | null;
  onPendingOpenConsumed?: () => void;
  pendingFilter?: { filterKey: string; filterValue: string } | null;
  onPendingFilterConsumed?: () => void;
}

export default function Actions({ pendingOpen, onPendingOpenConsumed, pendingFilter, onPendingFilterConsumed }: ActionsProps) {
  const store = useAppStore();
  const orgId   = store.currentOrgId ?? '';
  const userName = store.currentUser?.name ?? '';
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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [similarTemplate, setSimilarTemplate] = useState<Action | null>(null);
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
    logActivity({ orgId, userName, module: 'actions', recordId: newAction.id, recordRef: newAction.id.toUpperCase(), recordType: 'Action', projectId: newAction.projectId, projectName: newAction.projectName, actionType: 'record_created', description: `${userName} created action "${newAction.title}" on project ${newAction.projectName}.` });
  }

  const handleQuickStatus = async (action: Action, newStatus: ActionStatus) => {
    if (action.status === newStatus) return;
    const updated = { ...action, status: newStatus };
    await store.updateAction(updated);
    if (selectedAction?.id === action.id) setSelectedAction(updated);
    logActivity({ orgId, userName, module: 'actions', recordId: action.id, recordRef: action.id.toUpperCase(), recordType: 'Action', projectId: action.projectId, projectName: action.projectName, actionType: 'status_changed', description: `${userName} changed action "${action.title}" status from "${action.status}" to "${newStatus}".`, prevValue: action.status, newValue: newStatus });
  };

  const handleCreateSimilar = (source: Action) => {
    setSimilarTemplate({
      ...source,
      id: '',
      status: 'Not Started',
      createdBy: userName,
      createdDate: new Date().toISOString().split('T')[0],
      comments: [],
      overdue: false,
    });
    setShowCreate(true);
  };

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
          <button onClick={() => {
              const attMap: Record<string, DBAttachment[]> = {};
              selectedActions.forEach(a => { attMap[a.id] = store.attachments.filter(att => att.linked_type === 'action' && att.linked_id === a.id); });
              exportActionsPDF(selectedActions, attMap, store.settings?.logo_data_url);
            }} className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
            <Printer size={14} />Export PDF
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
                      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <InlineStatus status={action.status} canEdit={canEdit} onChange={s => handleQuickStatus(action, s)} />
                        <RowActionsMenu actions={[
                          { label: 'View', icon: Eye, onClick: () => setSelectedAction(action) },
                          ...(canEdit ? [{ label: 'Edit', icon: Edit2, onClick: () => setSelectedAction(action) }] : []),
                          { label: 'Create Similar', icon: Copy, onClick: () => handleCreateSimilar(action) },
                          ...(canExport ? [{ label: 'Export PDF', icon: Printer, onClick: () => exportSingleActionPDF(action, store.attachments.filter(att => att.linked_type === 'action' && att.linked_id === action.id), store.settings?.logo_data_url) }] : []),
                          ...(canDelete ? [{ label: 'Delete', icon: Trash2, onClick: () => setDeleteConfirm(action.id), danger: true, dividerBefore: true }] : []),
                        ]} />
                      </div>
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
          onUpdate={async (updated) => {
            const prev = liveSelected;
            await store.updateAction(updated);
            setSelectedAction(updated);
            // Only log field edits — comment additions log via their own path
            if (JSON.stringify(prev.comments) === JSON.stringify(updated.comments)) {
              const { changesText, fieldDiffs, prevValue, newValue, actionType } = buildDiff(
                prev as unknown as Record<string, unknown>,
                updated as unknown as Record<string, unknown>,
                ACTION_FIELDS,
              );
              const changePart = changesText ? ` Changes: ${changesText}.` : '';
              logActivity({ orgId, userName, module: 'actions', recordId: updated.id, recordRef: updated.id.toUpperCase(), recordType: 'Action', projectId: updated.projectId, projectName: updated.projectName, actionType, description: `${userName} updated action "${updated.title}" on project ${updated.projectName}.${changePart}`, prevValue, newValue, metadata: fieldDiffs.length ? { diffs: fieldDiffs } : null });
            }
          }}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
      {showCreate && (
        <CreateActionModal
          onClose={() => { setShowCreate(false); setSimilarTemplate(null); }}
          onSave={handleCreateAction}
          initialData={similarTemplate}
        />
      )}
      {deleteConfirm && (
        <ConfirmDeleteModal
          title="Delete Action"
          description="This action and all linked attachments will be permanently deleted."
          onConfirm={() => {
            const target = actionList.find(a => a.id === deleteConfirm);
            if (target) logActivity({ orgId, userName, module: 'actions', recordId: deleteConfirm, recordRef: deleteConfirm.toUpperCase(), recordType: 'Action', projectId: target.projectId, projectName: target.projectName, actionType: 'record_deleted', description: `${userName} deleted action "${target.title}" on project ${target.projectName}.` });
            store.removeAction(deleteConfirm);
            setDeleteConfirm(null);
            if (selectedAction?.id === deleteConfirm) setSelectedAction(null);
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
