import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Search, ChevronDown, Clock, TrendingUp, FileText, MessageSquare, Users, HelpCircle, FolderOpen, Trophy, X, CheckCircle, AlertTriangle, Send, CreditCard as Edit2, Save, StickyNote, AtSign, Trash2, Calculator, ChevronUp, BookOpen } from 'lucide-react';
import { openPrintTab, buildPrintDocument } from '../lib/printTab';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import type {
  Tender,
  TenderStatus,
  TenderPriority,
  TenderSubcontractor,
  TenderRFI,
  TenderDocument,
  TenderDocComment,
  TenderComment,
  TenderScopeEntry,
  SubcontractorStatus,
  RFIStatus,
  EstimateItem,
  LucideIcon,
} from '../data/types';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import type { DBNotification, DBAttachment } from '../lib/store';
import FileUpload from '../components/FileUpload';
import type { UploadedFile } from '../components/FileUpload';
import { Paperclip, Eye, Download, Sparkles } from 'lucide-react';
import AITenderAssistant from '../components/AITenderAssistant';
import AIContractReview from '../components/AIContractReview';
import { logActivity, buildDiff, type FieldSpec } from '../lib/activityLog';

// ─── Colours ─────────────────────────────────────────────────────────────────

const statusColors: Record<TenderStatus, string> = {
  'New Enquiry':                   'bg-slate-700 text-slate-300',
  'Reviewing':                      'bg-blue-900/60 text-blue-300',
  'Pricing':                        'bg-amber-900/60 text-amber-300',
  'Awaiting Subcontractor Returns': 'bg-orange-900/60 text-orange-300',
  'Submitted':                      'bg-teal-900/60 text-teal-300',
  'Negotiation':                    'bg-yellow-900/60 text-yellow-300',
  'Won':                            'bg-emerald-900/60 text-emerald-300',
  'Lost':                           'bg-red-900/60 text-red-300',
  'No Bid':                         'bg-slate-800 text-slate-500',
};

const priorityColors: Record<TenderPriority, { badge: string; border: string; dot: string }> = {
  Critical: { badge: 'bg-red-900/60 text-red-400 border-red-800',    border: 'border-l-red-500',    dot: 'bg-red-500' },
  High:     { badge: 'bg-orange-900/60 text-orange-400 border-orange-800', border: 'border-l-orange-400', dot: 'bg-orange-400' },
  Medium:   { badge: 'bg-amber-900/60 text-amber-400 border-amber-800',  border: 'border-l-amber-400',  dot: 'bg-amber-400' },
  Low:      { badge: 'bg-[#1e2d4a] text-slate-400 border-slate-700',  border: 'border-l-slate-600',  dot: 'bg-slate-600' },
};

const scColors: Record<SubcontractorStatus, string> = {
  'Not Sent': 'bg-slate-700 text-slate-400',
  Sent:       'bg-blue-900/60 text-blue-400',
  Chased:     'bg-amber-900/60 text-amber-400',
  Returned:   'bg-emerald-900/60 text-emerald-400',
  Declined:   'bg-red-900/60 text-red-400',
};

const rfiColors: Record<RFIStatus, string> = {
  Draft:              'bg-slate-700 text-slate-400',
  Issued:             'bg-blue-900/60 text-blue-400',
  'Awaiting Response':'bg-amber-900/60 text-amber-400',
  Closed:             'bg-emerald-900/60 text-emerald-400',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysRemaining(returnDate: string): number {
  const diff = new Date(returnDate).getTime() - new Date('2026-05-19').getTime();
  return Math.ceil(diff / 86400000);
}

function formatValue(v: number): string {
  return `£${v.toLocaleString()}`;
}

function StatusBadge({ status }: { status: TenderStatus }) {
  return <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${statusColors[status]}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: TenderPriority }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColors[priority].badge}`}>{priority}</span>;
}

// ─── @Mention rendering ───────────────────────────────────────────────────────

function renderMentions(text: string) {
  const parts = text.split(/(@\w[\w\s.]*)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-[#f97316] font-semibold bg-orange-950/40 px-1 rounded">{part}</span>
      : part
  );
}

// ─── Tab component ────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Estimating', 'Qualifications', 'Assumptions', 'Exclusions', 'Discussion', 'Subcontractors', 'RFIs', 'Documents', 'Contract Review', 'Outcome'] as const;
type Tab = typeof TABS[number];

const tabIcons: Record<Tab, LucideIcon> = {
  Overview:          TrendingUp,
  Estimating:        Calculator,
  'Qualifications':  FileText,
  Assumptions:       CheckCircle,
  Exclusions:        AlertTriangle,
  Discussion:        MessageSquare,
  Subcontractors:    Users,
  RFIs:              HelpCircle,
  Documents:         FolderOpen,
  'Contract Review': BookOpen,
  Outcome:           Trophy,
};

// ─── Shared attachment helpers ────────────────────────────────────────────────

function AttachmentRow({ att, onPreview }: { att: DBAttachment; onPreview: (a: DBAttachment) => void }) {
  const store = useAppStore();
  const [loading, setLoading] = useState(false);
  const isImage = att.type.startsWith('image/');
  const isPDF = att.type === 'application/pdf';
  const fmtSize = (n: number) => n < 1024 ? `${n}B` : n < 1048576 ? `${(n / 1024).toFixed(0)}KB` : `${(n / 1048576).toFixed(1)}MB`;

  const handlePreview = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (att.data_url) { onPreview(att); return; }
    setLoading(true);
    const dataUrl = await store.fetchAttachmentData(att.id);
    setLoading(false);
    onPreview({ ...att, data_url: dataUrl });
  };

  return (
    <div className="flex items-center gap-2.5 bg-[#0d1628] rounded-lg px-3 py-2 border border-[#1e2d4a] group cursor-pointer"
      onClick={() => handlePreview()}>
      <div className="w-7 h-7 rounded bg-[#111827] border border-[#1e2d4a] flex items-center justify-center shrink-0 overflow-hidden">
        {loading ? (
          <div className="w-3 h-3 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" />
        ) : isImage && att.data_url ? (
          <img src={att.data_url} alt={att.name} className="w-full h-full object-cover" />
        ) : isPDF ? (
          <FileText size={13} className="text-red-400" />
        ) : (
          <Paperclip size={13} className="text-slate-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-300 truncate">{att.name}</p>
        <p className="text-[10px] text-slate-600">{fmtSize(att.size)}</p>
      </div>
      <button type="button" onClick={e => handlePreview(e)} className="p-1 text-slate-500 hover:text-[#f97316] transition-colors opacity-0 group-hover:opacity-100" title="Preview">
        <Eye size={13} />
      </button>
    </div>
  );
}

function AttachmentPreviewModal({ att, onClose }: { att: DBAttachment; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/90 z-[90] flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-semibold text-white truncate max-w-xs">{att.name}</p>
        <div className="flex items-center gap-2">
          {att.data_url && (
            <a href={att.data_url} download={att.name}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
              <Download size={13} />Download
            </a>
          )}
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><X size={18} /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {att.type.startsWith('image/') && att.data_url ? (
          <img src={att.data_url} alt={att.name} className="max-w-full max-h-full object-contain rounded-lg" />
        ) : att.type === 'application/pdf' && att.data_url ? (
          <iframe src={att.data_url} title={att.name} className="w-full h-full rounded-lg border-0" />
        ) : (
          <div className="text-center">
            <Paperclip size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm mb-4">{att.name}</p>
            {att.data_url && (
              <a href={att.data_url} download={att.name}
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

// ─── Tender Doc Detail Modal ──────────────────────────────────────────────────

interface TenderDocDetailProps {
  doc: TenderDocument;
  tenderId: string;
  tenderName: string;
  onClose: () => void;
  onEdit: () => void;
  onUpdateComments: (comments: TenderDocComment[]) => void;
}

function TenderDocDetail({ doc, tenderId, tenderName, onClose, onEdit, onUpdateComments }: TenderDocDetailProps) {
  const store = useAppStore();
  const [tab, setTab] = useState<'details' | 'comments' | 'files'>('details');
  const [newComment, setNewComment] = useState('');
  const [preview, setPreview] = useState<DBAttachment | null>(null);

  const atts = store.attachments.filter(a => a.linked_type === 'tender_doc' && a.linked_id === doc.id);
  const comments = doc.comments ?? [];

  const addComment = () => {
    if (!newComment.trim()) return;
    const c: TenderDocComment = {
      id: `dc${Date.now()}`,
      user: store.currentUser?.name ?? '',
      datetime: new Date().toISOString(),
      text: newComment.trim(),
    };
    onUpdateComments([...comments, c]);
    setNewComment('');
  };

  const handleUpload = (files: UploadedFile[]) => {
    const storedIds = new Set(atts.map(a => a.id));
    files.forEach(f => {
      if (storedIds.has(f.id)) return;
      store.addAttachment({
        id: f.id,
        linked_type: 'tender_doc',
        linked_id: doc.id,
        project_id: tenderId,
        project_name: tenderName,
        name: f.name,
        type: f.type,
        size: f.size,
        category: 'document',
        data_url: f.dataUrl ?? '',
        uploaded_by: store.currentUser?.name ?? '',
      });
    });
  };

  const tabCls = (t: typeof tab) =>
    `px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
      tab === t
        ? 'text-[#f97316] border-[#f97316]'
        : 'text-slate-500 border-transparent hover:text-slate-300'
    }`;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl my-4 flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#1e2d4a] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center shrink-0">
              <FileText size={16} className="text-[#f97316]" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-base leading-snug truncate">{doc.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-semibold text-slate-500 bg-[#0d1628] border border-[#1e2d4a] px-2 py-0.5 rounded-full">{doc.type}</span>
                <span className="text-[10px] font-mono text-slate-600">{doc.revision}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] rounded-lg hover:bg-[#1e2d4a] transition-colors">
              <Edit2 size={12} />Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2d4a] px-6 shrink-0">
          <button className={tabCls('details')} onClick={() => setTab('details')}>Details</button>
          <button className={tabCls('comments')} onClick={() => setTab('comments')}>
            Comments{comments.length > 0 && <span className="ml-1.5 text-[10px] bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">{comments.length}</span>}
          </button>
          <button className={tabCls('files')} onClick={() => setTab('files')}>
            Files{atts.length > 0 && <span className="ml-1.5 text-[10px] bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">{atts.length}</span>}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[280px]">

          {/* Details */}
          {tab === 'details' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Type</p>
                  <p className="text-sm text-slate-300">{doc.type}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Revision</p>
                  <p className="text-sm font-mono text-slate-300">{doc.revision}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Date Received</p>
                  <p className="text-sm text-slate-300">{new Date(doc.dateReceived).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Files</p>
                  <p className="text-sm text-slate-300">{atts.length} file{atts.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {doc.notes ? (
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Notes</p>
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{doc.notes}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic">No notes recorded for this document.</p>
              )}
            </div>
          )}

          {/* Comments */}
          {tab === 'comments' && (
            <div className="space-y-4">
              {comments.length === 0 && (
                <p className="text-xs text-slate-600 italic text-center py-4">No comments yet.</p>
              )}
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#f97316] flex items-center justify-center text-[9px] font-bold text-white">
                        {c.user.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-xs font-semibold text-slate-300">{c.user}</span>
                      <span className="text-[10px] text-slate-600 ml-auto">{new Date(c.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addComment(); }}
                  rows={2}
                  placeholder="Add a comment... (Ctrl+Enter to submit)"
                  className="flex-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 resize-none"
                />
                <button
                  onClick={addComment}
                  disabled={!newComment.trim()}
                  className="self-end flex items-center gap-1.5 px-3 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={12} />Add
                </button>
              </div>
            </div>
          )}

          {/* Files */}
          {tab === 'files' && (
            <div className="space-y-3">
              <FileUpload
                files={[]}
                onChange={handleUpload}
                accept="image/*,.pdf,.doc,.docx,.xlsx,.dwg,.dxf"
                label="Upload drawings, specs, photos or documents"
              />
              {atts.length > 0 && (
                <div className="space-y-2 mt-2">
                  {atts.map(a => (
                    <div key={a.id} className="flex items-center gap-2 group">
                      <div className="flex-1 min-w-0">
                        <AttachmentRow att={a} onPreview={setPreview} />
                      </div>
                      <button
                        type="button"
                        onClick={() => store.removeAttachment(a.id)}
                        className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                        title="Remove file"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {atts.length === 0 && (
                <p className="text-xs text-slate-600 text-center pt-1">No files attached yet.</p>
              )}
            </div>
          )}

        </div>
      </div>
      {preview && <AttachmentPreviewModal att={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ─── Add Document Modal ───────────────────────────────────────────────────────

interface AddDocumentModalProps {
  tenderId: string;
  tenderName: string;
  onClose: () => void;
  onSave: (doc: TenderDocument) => void;
  initial?: TenderDocument;
}

function AddDocumentModal({ tenderId: _tenderId, tenderName: _tenderName, onClose, onSave, initial }: AddDocumentModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [docId] = useState(() => initial?.id ?? `doc${Date.now()}`);

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: (initial?.type ?? 'Tender') as TenderDocument['type'],
    revision: initial?.revision ?? '',
    dateReceived: initial?.dateReceived ?? today,
    notes: initial?.notes ?? '',
  });

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const doc: TenderDocument = {
      id: docId,
      name: form.name,
      type: form.type,
      revision: form.revision || 'Rev A',
      dateReceived: form.dateReceived,
      notes: form.notes,
      comments: initial?.comments,
    };
    onSave(doc);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <h2 className="text-lg font-bold text-white">{initial ? 'Edit Document' : 'Add Document'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Document Name *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Tender Drawings Issue A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as TenderDocument['type'] }))} className={inputCls}>
                <option>Tender</option><option>Drawing</option><option>Specification</option>
                <option>Schedule</option><option>Survey</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Revision</label>
              <input value={form.revision} onChange={e => setForm(f => ({ ...f, revision: e.target.value }))} className={inputCls} placeholder="Rev A" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Date Received</label>
            <input type="date" value={form.dateReceived} onChange={e => setForm(f => ({ ...f, dateReceived: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Any additional notes..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tender RFI Detail Modal ──────────────────────────────────────────────────

interface TenderRFIDetailProps {
  rfi: TenderRFI;
  tenderId: string;
  tenderName: string;
  onClose: () => void;
  onEdit: () => void;
  onUpdateComments: (comments: TenderDocComment[]) => void;
  onUpdateStatus: (status: RFIStatus) => void;
}

function TenderRFIDetail({ rfi, tenderId, tenderName, onClose, onEdit, onUpdateComments, onUpdateStatus }: TenderRFIDetailProps) {
  const store = useAppStore();
  const [tab, setTab] = useState<'details' | 'comments' | 'files'>('details');
  const [newComment, setNewComment] = useState('');
  const [preview, setPreview] = useState<DBAttachment | null>(null);

  const atts = store.attachments.filter(a => a.linked_type === 'tender_rfi' && a.linked_id === rfi.id);
  const comments = rfi.comments ?? [];

  const addComment = () => {
    if (!newComment.trim()) return;
    const c: TenderDocComment = {
      id: `rc${Date.now()}`,
      user: store.currentUser?.name ?? '',
      datetime: new Date().toISOString(),
      text: newComment.trim(),
    };
    onUpdateComments([...comments, c]);
    setNewComment('');
  };

  const handleUpload = (files: UploadedFile[]) => {
    const storedIds = new Set(atts.map(a => a.id));
    files.forEach(f => {
      if (storedIds.has(f.id)) return;
      store.addAttachment({
        id: f.id,
        linked_type: 'tender_rfi',
        linked_id: rfi.id,
        project_id: tenderId,
        project_name: tenderName,
        name: f.name,
        type: f.type,
        size: f.size,
        category: 'attachment',
        data_url: f.dataUrl ?? '',
        uploaded_by: store.currentUser?.name ?? '',
      });
    });
  };

  const tabCls = (t: typeof tab) =>
    `px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
      tab === t ? 'text-[#f97316] border-[#f97316]' : 'text-slate-500 border-transparent hover:text-slate-300'
    }`;

  function fmtDate(d?: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const daysOpen = Math.max(0, Math.floor((Date.now() - new Date(rfi.dateRaised).getTime()) / 86_400_000));

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl my-4 flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#1e2d4a] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center shrink-0">
              <HelpCircle size={16} className="text-[#f97316]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono font-bold text-slate-500">{rfi.ref}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rfiColors[rfi.status]}`}>{rfi.status}</span>
              </div>
              <p className="text-white font-bold text-base leading-snug truncate">{rfi.subject || rfi.question}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] rounded-lg hover:bg-[#1e2d4a] transition-colors">
              <Edit2 size={12} />Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2d4a] px-6 shrink-0">
          <button className={tabCls('details')} onClick={() => setTab('details')}>Details</button>
          <button className={tabCls('comments')} onClick={() => setTab('comments')}>
            Comments{comments.length > 0 && <span className="ml-1.5 text-[10px] bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">{comments.length}</span>}
          </button>
          <button className={tabCls('files')} onClick={() => setTab('files')}>
            Files{atts.length > 0 && <span className="ml-1.5 text-[10px] bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">{atts.length}</span>}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[280px]">

          {/* Details */}
          {tab === 'details' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Date Raised</p>
                  <p className="text-sm text-slate-300">{fmtDate(rfi.dateRaised)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Response Required By</p>
                  <p className={`text-sm font-semibold ${rfi.requiredResponseDate && rfi.requiredResponseDate < today && rfi.status !== 'Closed' ? 'text-red-400' : 'text-slate-300'}`}>
                    {fmtDate(rfi.requiredResponseDate)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Directed To</p>
                  <p className="text-sm text-slate-300">{rfi.assignedTo || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Days Open</p>
                  <p className={`text-sm font-semibold ${daysOpen > 14 && rfi.status !== 'Closed' ? 'text-amber-400' : 'text-slate-300'}`}>{daysOpen}d</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Question</p>
                <p className="text-sm text-slate-300 leading-relaxed">{rfi.question}</p>
              </div>
              {rfi.notes && (
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Notes</p>
                  <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{rfi.notes}</p>
                </div>
              )}

              {/* Source Traceability */}
              {(rfi.sourceDocument || rfi.pageReference || rfi.sectionClause || rfi.importSource ||
                (rfi as TenderRFI & { drawingNumber?: string }).drawingNumber ||
                (rfi as TenderRFI & { specification?: string }).specification) && (
                <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={12} className="text-slate-500" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Source Traceability</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                    {[
                      { label: 'Source Document', val: rfi.sourceDocument },
                      { label: 'Drawing Number', val: (rfi as TenderRFI & { drawingNumber?: string }).drawingNumber },
                      { label: 'Specification', val: (rfi as TenderRFI & { specification?: string }).specification },
                      { label: 'Section / Clause', val: rfi.sectionClause },
                      { label: 'Page Reference', val: rfi.pageReference },
                      { label: 'Revision', val: (rfi as TenderRFI & { revision?: string }).revision },
                      { label: 'Extracted From', val: rfi.importSource },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">{label}</p>
                        <p className={`text-xs ${val ? 'text-slate-400' : 'text-slate-700 italic'}`}>{val || 'Not identified'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {(['Draft', 'Issued', 'Awaiting Response', 'Closed'] as RFIStatus[]).map(s => (
                    <button key={s} onClick={() => onUpdateStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        rfi.status === s
                          ? s === 'Closed' ? 'bg-emerald-600 text-white border-emerald-600'
                            : s === 'Awaiting Response' ? 'bg-amber-600 text-white border-amber-600'
                            : s === 'Issued' ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-600 text-white border-slate-600'
                          : 'bg-[#0d1628] text-slate-400 border-[#1e2d4a] hover:text-slate-300 hover:border-slate-500'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Comments */}
          {tab === 'comments' && (
            <div className="space-y-4">
              {comments.length === 0 && (
                <p className="text-xs text-slate-600 italic text-center py-4">No comments yet.</p>
              )}
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#f97316] flex items-center justify-center text-[9px] font-bold text-white">
                        {c.user.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-xs font-semibold text-slate-300">{c.user}</span>
                      <span className="text-[10px] text-slate-600 ml-auto">{new Date(c.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addComment(); }}
                  rows={2}
                  placeholder="Add a comment... (Ctrl+Enter to submit)"
                  className="flex-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 resize-none"
                />
                <button
                  onClick={addComment}
                  disabled={!newComment.trim()}
                  className="self-end flex items-center gap-1.5 px-3 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={12} />Add
                </button>
              </div>
            </div>
          )}

          {/* Files */}
          {tab === 'files' && (
            <div className="space-y-3">
              <FileUpload
                files={[]}
                onChange={handleUpload}
                accept="image/*,.pdf,.doc,.docx,.xlsx,.dwg,.dxf"
                label="Upload supporting documents, drawings or photos"
              />
              {atts.length > 0 && (
                <div className="space-y-2 mt-2">
                  {atts.map(a => (
                    <div key={a.id} className="flex items-center gap-2 group">
                      <div className="flex-1 min-w-0">
                        <AttachmentRow att={a} onPreview={setPreview} />
                      </div>
                      <button
                        type="button"
                        onClick={() => store.removeAttachment(a.id)}
                        className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                        title="Remove file"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {atts.length === 0 && (
                <p className="text-xs text-slate-600 text-center pt-1">No files attached yet.</p>
              )}
            </div>
          )}

        </div>
      </div>
      {preview && <AttachmentPreviewModal att={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ─── Tender RFI Register (commercial monitoring layer) ────────────────────────

interface TenderRFIRegisterProps {
  rfis: TenderRFI[];
  tenderId: string;
  tenderName: string;
  attachments: DBAttachment[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onAddRFI: () => void;
  onEditRFI: (rfi: TenderRFI) => void;
  onOpenRFI: (rfi: TenderRFI) => void;
  onUpdateStatus: (rfiId: string, status: RFIStatus) => void;
  onDeleteRFI: (rfi: TenderRFI) => void;
}

function TenderRFIRegister({ rfis, attachments, canCreate, canEdit, canDelete, onAddRFI, onEditRFI, onOpenRFI, onDeleteRFI }: TenderRFIRegisterProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Open' | 'Overdue' | RFIStatus>('All');
  const today = new Date().toISOString().slice(0, 10);

  const filtered = rfis.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      r.ref.toLowerCase().includes(q) ||
      (r.subject ?? '').toLowerCase().includes(q) ||
      r.question.toLowerCase().includes(q) ||
      (r.assignedTo ?? '').toLowerCase().includes(q);
    let matchFilter = true;
    if (filterStatus === 'Open') matchFilter = r.status !== 'Closed';
    else if (filterStatus === 'Overdue') matchFilter = r.status !== 'Closed' && !!r.requiredResponseDate && r.requiredResponseDate < today;
    else if (filterStatus !== 'All') matchFilter = r.status === filterStatus;
    return matchSearch && matchFilter;
  });

  const counts = {
    total: rfis.length,
    open: rfis.filter(r => r.status !== 'Closed').length,
    awaiting: rfis.filter(r => r.status === 'Awaiting Response').length,
    overdue: rfis.filter(r =>
      r.status !== 'Closed' && r.requiredResponseDate && r.requiredResponseDate < today
    ).length,
  };

  function fmtDate(d?: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  function daysOpen(d: string) {
    return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
  }

  function responseDays(d?: string): { label: string; urgent: boolean; late: boolean } {
    if (!d) return { label: '—', urgent: false, late: false };
    const diff = Math.floor((new Date(d).getTime() - Date.now()) / 86_400_000);
    if (diff < 0) return { label: `${Math.abs(diff)}d late`, urgent: false, late: true };
    if (diff === 0) return { label: 'Today', urgent: true, late: false };
    if (diff <= 3) return { label: `${diff}d`, urgent: true, late: false };
    return { label: `${diff}d`, urgent: false, late: false };
  }

  return (
    <div className="space-y-4">
      {/* Compact monitoring strip — clickable filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Total',    value: counts.total,    filter: 'All' as const,     activeColor: 'text-slate-300',  activeBorder: 'border-slate-500/60'  },
          { label: 'Open',     value: counts.open,     filter: 'Open' as const,    activeColor: 'text-cyan-400',   activeBorder: 'border-cyan-600/60'   },
          { label: 'Awaiting', value: counts.awaiting, filter: 'Awaiting Response' as const, activeColor: 'text-amber-400', activeBorder: 'border-amber-600/60' },
          { label: 'Overdue',  value: counts.overdue,  filter: 'Overdue' as const, activeColor: counts.overdue > 0 ? 'text-red-400' : 'text-slate-600', activeBorder: 'border-red-600/60' },
        ].map(s => {
          const isActive = filterStatus === s.filter;
          return (
            <button
              key={s.label}
              onClick={() => setFilterStatus(isActive ? 'All' : s.filter)}
              className={`bg-[#0d1628] border rounded-lg px-3 py-2.5 text-center transition-all hover:border-slate-500/40 ${
                isActive ? `${s.activeBorder} ring-1 ring-inset ring-white/5` : 'border-[#1e2d4a]'
              }`}
            >
              <p className={`text-xl font-bold ${s.activeColor}`}>{s.value}</p>
              <p className={`text-[10px] uppercase tracking-wider mt-0.5 ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>{s.label}</p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex items-center gap-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={13} className="text-slate-600 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ref, subject, question…"
            className="bg-transparent text-xs text-slate-300 outline-none flex-1 placeholder:text-slate-600" />
        </div>
        <div className="flex items-center gap-0.5 bg-[#0d1628] border border-[#1e2d4a] rounded-lg p-1">
          {(['All', 'Draft', 'Issued', 'Awaiting Response', 'Closed'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                filterStatus === s ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>{s === 'Awaiting Response' ? 'Awaiting' : s}</button>
          ))}
        </div>
        {canCreate && (
          <button onClick={onAddRFI}
            className="flex items-center gap-1.5 bg-[#f97316] text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors shrink-0">
            <Plus size={13} />New RFI
          </button>
        )}
      </div>

      {/* Register grid */}
      <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] overflow-hidden flex flex-col">
        {/* Column headers — sticky */}
        <div className="hidden md:grid grid-cols-[70px_40px_1fr_110px_100px_110px_120px_32px_32px] gap-2 px-3 py-2 border-b border-[#1e2d4a] bg-[#111827] shrink-0">
          {['Ref', 'Age', 'Subject / Question', 'Directed To', 'Raised', 'Response Due', 'Status', '', ''].map(h => (
            <span key={h} className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-10">
            <HelpCircle size={28} className="text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">{rfis.length === 0 ? 'No RFIs raised yet.' : 'No RFIs match filters.'}</p>
            {rfis.length === 0 && canCreate && (
              <button onClick={onAddRFI} className="mt-2 text-xs text-[#f97316] hover:underline">Raise the first RFI</button>
            )}
          </div>
        )}

        <div className="divide-y divide-[#1e2d4a] overflow-y-auto max-h-[52vh] scrollbar-thin">
          {filtered.map(rfi => {
            const attCount = attachments.filter(a => a.linked_type === 'tender_rfi' && a.linked_id === rfi.id).length;
            const days = daysOpen(rfi.dateRaised);
            const resp = responseDays(rfi.requiredResponseDate);
            const isOverdue = rfi.status !== 'Closed' && rfi.requiredResponseDate && rfi.requiredResponseDate < today;
            return (
              <div key={rfi.id}
                className={`border-l-2 transition-colors ${
                  isOverdue ? 'border-l-red-800' : 'border-l-transparent'
                }`}>
                {/* Main row */}
                <div
                  onClick={() => onOpenRFI(rfi)}
                  className="grid grid-cols-1 md:grid-cols-[70px_40px_1fr_110px_100px_110px_120px_32px_32px] gap-2 px-3 py-3 cursor-pointer group hover:bg-[#111827] transition-colors items-center">

                  {/* Ref */}
                  <span className="text-[11px] font-mono font-bold text-slate-500">{rfi.ref}</span>

                  {/* Age bubble */}
                  <div className="hidden md:flex">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      rfi.status === 'Closed' ? 'bg-[#1a2236] text-slate-600'
                        : days > 21 ? 'bg-red-900/50 text-red-400'
                        : days > 7 ? 'bg-amber-900/50 text-amber-400'
                        : 'bg-[#1a2236] text-slate-500'
                    }`}>{days}d</span>
                  </div>

                  {/* Subject / Question */}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors truncate">
                      {rfi.subject || rfi.question}
                    </p>
                    {rfi.subject && (
                      <p className="text-[10px] text-slate-600 truncate mt-0.5">{rfi.question}</p>
                    )}
                    {attCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-600 mt-0.5">
                        <Paperclip size={8} />{attCount}
                      </span>
                    )}
                  </div>

                  {/* Directed To */}
                  <p className="hidden md:block text-[11px] text-slate-500 truncate">{rfi.assignedTo || '—'}</p>

                  {/* Date Raised */}
                  <p className="hidden md:block text-[11px] text-slate-500">{fmtDate(rfi.dateRaised)}</p>

                  {/* Response Due */}
                  <div className="hidden md:block">
                    {rfi.requiredResponseDate ? (
                      <span className={`text-[11px] font-semibold ${
                        resp.late ? 'text-red-400' : resp.urgent ? 'text-amber-400' : rfi.status === 'Closed' ? 'text-slate-600' : 'text-slate-400'
                      }`}>
                        {fmtDate(rfi.requiredResponseDate)}
                        {(resp.late || resp.urgent) && <span className="ml-1 text-[9px]">({resp.label})</span>}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-700">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${rfiColors[rfi.status]}`}>
                    {rfi.status}
                  </span>

                  {/* Edit */}
                  {canEdit && (
                    <button type="button"
                      onClick={e => { e.stopPropagation(); onEditRFI(rfi); }}
                      className="p-1 rounded text-slate-600 hover:text-[#f97316] transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                      <Edit2 size={12} />
                    </button>
                  )}

                  {/* Delete */}
                  {canDelete && (
                    <button type="button"
                      onClick={e => { e.stopPropagation(); onDeleteRFI(rfi); }}
                      className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-3 py-2 border-t border-[#1e2d4a] bg-[#111827] flex items-center justify-between">
            <p className="text-[10px] text-slate-600">
              {filtered.length} of {rfis.length} RFI{rfis.length !== 1 ? 's' : ''}
              {filterStatus !== 'All' || search ? ' (filtered)' : ''}
            </p>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-slate-600"><span className="text-amber-400 font-semibold">{filtered.filter(r => r.status === 'Awaiting Response').length}</span> awaiting</span>
              <span className="text-slate-600"><span className={`font-semibold ${counts.overdue > 0 ? 'text-red-400' : 'text-slate-600'}`}>
                {filtered.filter(r => r.status !== 'Closed' && r.requiredResponseDate && r.requiredResponseDate < today).length}
              </span> overdue</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add RFI Modal ────────────────────────────────────────────────────────────

interface AddRFIModalProps {
  rfiRef: string;
  tenderId: string;
  tenderName: string;
  onClose: () => void;
  onSave: (rfi: TenderRFI) => void;
  initial?: TenderRFI;
}

function AddRFIModal({ rfiRef, tenderId: _tenderId, tenderName: _tenderName, onClose, onSave, initial }: AddRFIModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [rfiId] = useState(() => initial?.id ?? `rfi${Date.now()}`);
  const [showSource, setShowSource] = useState(!!(initial?.sourceDocument || initial?.pageReference || initial?.sectionClause));

  const [form, setForm] = useState({
    subject: initial?.subject ?? '',
    question: initial?.question ?? '',
    dateRaised: initial?.dateRaised ?? today,
    requiredResponseDate: initial?.requiredResponseDate ?? '',
    assignedTo: initial?.assignedTo ?? '',
    status: (initial?.status ?? 'Draft') as RFIStatus,
    notes: initial?.notes ?? '',
    sourceDocument: initial?.sourceDocument ?? '',
    drawingNumber: (initial as TenderRFI & { drawingNumber?: string })?.drawingNumber ?? '',
    specification: (initial as TenderRFI & { specification?: string })?.specification ?? '',
    section: initial?.sectionClause?.split(' §')[0] ?? '',
    clause: initial?.sectionClause?.includes(' §') ? initial.sectionClause.split(' §')[1] : '',
    page: initial?.pageReference ?? '',
    revision: (initial as TenderRFI & { revision?: string })?.revision ?? '',
    extractedFrom: initial?.importSource ?? '',
  });

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sectionClause = form.section && form.clause
      ? `${form.section} §${form.clause}`
      : form.section || form.clause || undefined;
    const rfi: TenderRFI & { drawingNumber?: string; specification?: string; revision?: string } = {
      id: rfiId,
      ref: initial?.ref ?? rfiRef,
      subject: form.subject || undefined,
      question: form.question,
      dateRaised: form.dateRaised,
      requiredResponseDate: form.requiredResponseDate || undefined,
      assignedTo: form.assignedTo || undefined,
      status: form.status,
      notes: form.notes,
      comments: initial?.comments,
      sourceDocument: form.sourceDocument || undefined,
      drawingNumber: form.drawingNumber || undefined,
      specification: form.specification || undefined,
      sectionClause,
      pageReference: form.page || undefined,
      revision: form.revision || undefined,
      importSource: form.extractedFrom || initial?.importSource,
    };
    onSave(rfi);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <h2 className="text-lg font-bold text-white">{initial ? 'Edit RFI' : 'Add RFI'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>RFI Reference</label>
              <input readOnly value={initial?.ref ?? rfiRef} className={`${inputCls} opacity-60 cursor-not-allowed`} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as RFIStatus }))} className={inputCls}>
                <option>Draft</option><option>Issued</option><option>Awaiting Response</option><option>Closed</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Subject</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={inputCls} placeholder="Brief subject line for this RFI…" />
          </div>
          <div>
            <label className={labelCls}>Question *</label>
            <textarea required value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} rows={3} className={`${inputCls} resize-none`} placeholder="Describe the request for information..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date Raised</label>
              <input type="date" value={form.dateRaised} onChange={e => setForm(f => ({ ...f, dateRaised: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Response Required By</label>
              <input type="date" value={form.requiredResponseDate} onChange={e => setForm(f => ({ ...f, requiredResponseDate: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Directed To / Assigned To</label>
            <input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className={inputCls} placeholder="Consultant, architect, engineer…" />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Any additional notes..." />
          </div>

          {/* Source traceability collapsible */}
          <div className="border border-[#1e2d4a] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSource(s => !s)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#0d1628] hover:bg-[#111827] transition-colors"
            >
              <div className="flex items-center gap-2">
                <BookOpen size={13} className="text-slate-500" />
                <span className="text-xs font-semibold text-slate-400">Source Traceability</span>
                {(form.sourceDocument || form.page || form.section) && (
                  <span className="text-[9px] bg-[#f97316]/20 text-[#f97316] px-1.5 py-0.5 rounded-full font-bold">Populated</span>
                )}
              </div>
              {showSource ? <ChevronUp size={13} className="text-slate-600" /> : <ChevronDown size={13} className="text-slate-600" />}
            </button>
            {showSource && (
              <div className="p-4 space-y-3 bg-[#0a1120]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Source Document</label>
                    <input value={form.sourceDocument} onChange={e => setForm(f => ({ ...f, sourceDocument: e.target.value }))} className={inputCls} placeholder="e.g. M&E Spec Rev C" />
                  </div>
                  <div>
                    <label className={labelCls}>Drawing Number</label>
                    <input value={form.drawingNumber} onChange={e => setForm(f => ({ ...f, drawingNumber: e.target.value }))} className={inputCls} placeholder="e.g. EL-001-Rev2" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Specification</label>
                  <input value={form.specification} onChange={e => setForm(f => ({ ...f, specification: e.target.value }))} className={inputCls} placeholder="e.g. NBS K10 / Electrical Spec" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Section</label>
                    <input value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} className={inputCls} placeholder="e.g. 3.2 Containment" />
                  </div>
                  <div>
                    <label className={labelCls}>Clause</label>
                    <input value={form.clause} onChange={e => setForm(f => ({ ...f, clause: e.target.value }))} className={inputCls} placeholder="e.g. 3.2.1.4" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Page Reference</label>
                    <input value={form.page} onChange={e => setForm(f => ({ ...f, page: e.target.value }))} className={inputCls} placeholder="e.g. pp.12–15" />
                  </div>
                  <div>
                    <label className={labelCls}>Revision</label>
                    <input value={form.revision} onChange={e => setForm(f => ({ ...f, revision: e.target.value }))} className={inputCls} placeholder="e.g. Rev C" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Extracted From</label>
                  <input value={form.extractedFrom} onChange={e => setForm(f => ({ ...f, extractedFrom: e.target.value }))} className={inputCls} placeholder="e.g. AI Review, ChatGPT Import, Manual" />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Subcontractor Modal ──────────────────────────────────────────────────

interface AddSubcontractorModalProps {
  tenderId: string;
  tenderName: string;
  onClose: () => void;
  onSave: (sc: TenderSubcontractor) => void;
  initial?: TenderSubcontractor;
}

function AddSubcontractorModal({ tenderId, tenderName, onClose, onSave, initial }: AddSubcontractorModalProps) {
  const store = useAppStore();
  const [scId] = useState(() => initial?.id ?? `sc${Date.now()}`);

  const [form, setForm] = useState({
    package: initial?.package ?? '',
    company: initial?.company ?? '',
    contact: initial?.contact ?? '',
    dateSent: initial?.dateSent ?? '',
    returnDue: initial?.returnDue ?? '',
    status: (initial?.status ?? 'Not Sent') as SubcontractorStatus,
    notes: initial?.notes ?? '',
  });
  const [preview, setPreview] = useState<DBAttachment | null>(null);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);

  const existingAtts = store.attachments.filter(a => a.linked_type === 'tender_sc' && a.linked_id === scId);

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sc: TenderSubcontractor = {
      id: scId,
      package: form.package,
      company: form.company,
      contact: form.contact,
      dateSent: form.dateSent,
      returnDue: form.returnDue,
      status: form.status,
      notes: form.notes,
    };
    onSave(sc);
  };

  function handleFiles(newFiles: UploadedFile[]) {
    const storedIds = new Set(existingAtts.map(a => a.id));
    newFiles.forEach(f => {
      if (storedIds.has(f.id)) return;
      store.addAttachment({
        id: f.id,
        linked_type: 'tender_sc',
        linked_id: scId,
        project_id: tenderId,
        project_name: tenderName,
        name: f.name,
        type: f.type,
        size: f.size,
        category: 'attachment',
        data_url: f.dataUrl ?? '',
        uploaded_by: store.currentUser?.name ?? '',
      });
    });
    setPendingFiles(newFiles);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <h2 className="text-lg font-bold text-white">{initial ? 'Edit Subcontractor' : 'Add Subcontractor'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Package *</label>
              <input required value={form.package} onChange={e => setForm(f => ({ ...f, package: e.target.value }))} className={inputCls} placeholder="e.g. Mechanical" />
            </div>
            <div>
              <label className={labelCls}>Company *</label>
              <input required value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={inputCls} placeholder="Company name" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Contact</label>
            <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} className={inputCls} placeholder="Contact name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date Sent</label>
              <input type="date" value={form.dateSent} onChange={e => setForm(f => ({ ...f, dateSent: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Return Due *</label>
              <input required type="date" value={form.returnDue} onChange={e => setForm(f => ({ ...f, returnDue: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SubcontractorStatus }))} className={inputCls}>
              <option>Not Sent</option><option>Sent</option><option>Chased</option><option>Returned</option><option>Declined</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Any additional notes..." />
          </div>
          <div>
            <label className={labelCls}>Attachments</label>
            <FileUpload files={pendingFiles} onChange={handleFiles} accept="image/*,.pdf,.doc,.docx,.xlsx" label="Upload quotes, drawings or supporting documents" />
            {existingAtts.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {existingAtts.map(att => <AttachmentRow key={att.id} att={att} onPreview={setPreview} />)}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">Save</button>
          </div>
        </form>
      </div>
      {preview && <AttachmentPreviewModal att={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ─── Edit Tender Modal ────────────────────────────────────────────────────────

interface EditTenderModalProps {
  tender: Tender;
  onClose: () => void;
  onSave: (t: Tender) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}

function EditTenderModal({ tender, onClose, onSave, onDelete, canDelete }: EditTenderModalProps) {
  const store = useAppStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState({
    name: tender.name,
    client: tender.client,
    location: tender.location,
    returnDate: tender.returnDate,
    receivedDate: tender.receivedDate,
    estimatedValue: String(tender.estimatedValue),
    owner: tender.owner,
    priority: tender.priority,
    status: tender.status,
    nextAction: tender.nextAction,
    internalNotes: tender.internalNotes,
  });

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...tender,
      name: form.name,
      client: form.client,
      location: form.location,
      returnDate: form.returnDate,
      receivedDate: form.receivedDate,
      estimatedValue: parseFloat(form.estimatedValue.replace(/[^0-9.]/g, '')) || tender.estimatedValue,
      owner: form.owner,
      priority: form.priority as TenderPriority,
      status: form.status as TenderStatus,
      nextAction: form.nextAction,
      internalNotes: form.internalNotes,
      lastUpdated: '2026-05-19',
    });
    onClose();
  };

  if (showDeleteConfirm) {
    return (
      <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-sm">
          <div className="p-6">
            <div className="w-12 h-12 rounded-full bg-red-900/40 border border-red-800 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-base font-bold text-white text-center mb-2">Delete Tender</h3>
            <p className="text-sm text-slate-400 text-center mb-1">
              <span className="font-semibold text-slate-200">{tender.name}</span>
            </p>
            <p className="text-sm text-slate-500 text-center mb-6">
              This permanently removes the tender from the system. All associated RFIs, qualifications, and documents will also be deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
              <button onClick={() => onDelete(tender.id)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors">Delete Tender</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Tender</h2>
            <p className="text-xs text-slate-500 mt-0.5">{tender.ref}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Tender Name *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Client *</label>
            <input required value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Site / Location</label>
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Received Date</label>
              <input type="date" value={form.receivedDate} onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Return Date *</label>
              <input required type="date" value={form.returnDate} onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Estimated Value</label>
            <input value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))} className={inputCls} placeholder="£000,000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TenderStatus }))} className={inputCls}>
                {(['New Enquiry','Reviewing','Pricing','Awaiting Subcontractor Returns','Submitted','Negotiation','Won','Lost','No Bid'] as TenderStatus[]).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TenderPriority }))} className={inputCls}>
                <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Tender Owner</label>
            <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} className={inputCls}>
              <option value="">— Select owner —</option>
              {store.platformUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Next Action</label>
            <input value={form.nextAction} onChange={e => setForm(f => ({ ...f, nextAction: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Internal Notes</label>
            <textarea value={form.internalNotes} onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))} rows={3} className={`${inputCls} resize-none`} />
          </div>
          <div className="pt-2 space-y-2">
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
              <button type="submit" className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
                <Save size={14} />Save Changes
              </button>
            </div>
            {canDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-red-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors border border-transparent hover:border-red-900/50"
            >
              <Trash2 size={13} />Delete Tender
            </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Source traceability display helper ──────────────────────────────────────

function SourceBadges({ entry }: { entry: TenderScopeEntry | TenderRFI }) {
  const src = entry.sourceDocument;
  const page = entry.pageReference;
  const sc = entry.sectionClause;
  const imported = entry.importSource;
  const drawing = (entry as TenderRFI & { drawingNumber?: string }).drawingNumber;
  const revision = (entry as TenderRFI & { revision?: string }).revision;
  if (!src && !page && !sc && !imported && !drawing && !revision) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5 pl-8">
      {src && <span className="text-[9px] bg-slate-800/80 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700/60 truncate max-w-[160px]" title={src}>{src}</span>}
      {drawing && <span className="text-[9px] bg-slate-800/80 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700/60">{drawing}</span>}
      {page && <span className="text-[9px] bg-slate-800/80 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700/60">pp.{page}</span>}
      {sc && <span className="text-[9px] bg-slate-800/80 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700/60 truncate max-w-[160px]">{sc}</span>}
      {revision && <span className="text-[9px] bg-slate-800/80 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700/60">{revision}</span>}
      {imported && <span className="text-[9px] bg-[#f97316]/10 text-[#f97316]/70 px-1.5 py-0.5 rounded border border-[#f97316]/20">{imported}</span>}
    </div>
  );
}

// ─── Edit Scope Entry Modal ───────────────────────────────────────────────────

interface EditScopeEntryModalProps {
  entry: TenderScopeEntry;
  onClose: () => void;
  onSave: (updated: TenderScopeEntry) => void;
}

function EditScopeEntryModal({ entry, onClose, onSave }: EditScopeEntryModalProps) {
  const [showSource, setShowSource] = useState(!!(entry.sourceDocument || entry.pageReference || entry.sectionClause));
  const [form, setForm] = useState({
    text: entry.text,
    category: entry.category,
    sourceDocument: entry.sourceDocument ?? '',
    drawingNumber: (entry as TenderScopeEntry & { drawingNumber?: string }).drawingNumber ?? '',
    specification: (entry as TenderScopeEntry & { specification?: string }).specification ?? '',
    section: entry.sectionClause?.split(' §')[0] ?? '',
    clause: entry.sectionClause?.includes(' §') ? entry.sectionClause.split(' §')[1] : '',
    page: entry.pageReference ?? '',
    revision: (entry as TenderScopeEntry & { revision?: string }).revision ?? '',
    extractedFrom: entry.importSource ?? '',
  });

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  const CATEGORIES = ['Assumptions', 'Exclusions', 'Qualification'];

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.text.trim()) return;
    const sectionClause = form.section && form.clause
      ? `${form.section} §${form.clause}`
      : form.section || form.clause || undefined;
    const updated: TenderScopeEntry & { drawingNumber?: string; specification?: string; revision?: string } = {
      ...entry,
      text: form.text.trim(),
      category: form.category,
      sourceDocument: form.sourceDocument || undefined,
      drawingNumber: form.drawingNumber || undefined,
      specification: form.specification || undefined,
      sectionClause,
      pageReference: form.page || undefined,
      revision: form.revision || undefined,
      importSource: form.extractedFrom || entry.importSource,
    };
    onSave(updated);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
          <h2 className="text-base font-bold text-white">Edit {entry.category === 'Scope Note' ? 'Qualification' : entry.category.slice(0, -1)}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className={labelCls}>Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Description *</label>
            <textarea required value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} rows={4} className={`${inputCls} resize-none`} placeholder="Enter the full text..." />
          </div>

          {/* Source traceability collapsible */}
          <div className="border border-[#1e2d4a] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSource(s => !s)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#0d1628] hover:bg-[#111827] transition-colors"
            >
              <div className="flex items-center gap-2">
                <BookOpen size={13} className="text-slate-500" />
                <span className="text-xs font-semibold text-slate-400">Source Traceability</span>
                {(form.sourceDocument || form.page || form.section) && (
                  <span className="text-[9px] bg-[#f97316]/20 text-[#f97316] px-1.5 py-0.5 rounded-full font-bold">Populated</span>
                )}
              </div>
              {showSource ? <ChevronUp size={13} className="text-slate-600" /> : <ChevronDown size={13} className="text-slate-600" />}
            </button>
            {showSource && (
              <div className="p-4 space-y-3 bg-[#0a1120]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Source Document</label>
                    <input value={form.sourceDocument} onChange={e => setForm(f => ({ ...f, sourceDocument: e.target.value }))} className={inputCls} placeholder="e.g. M&E Spec Rev C" />
                  </div>
                  <div>
                    <label className={labelCls}>Drawing Number</label>
                    <input value={form.drawingNumber} onChange={e => setForm(f => ({ ...f, drawingNumber: e.target.value }))} className={inputCls} placeholder="e.g. EL-001-Rev2" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Specification</label>
                  <input value={form.specification} onChange={e => setForm(f => ({ ...f, specification: e.target.value }))} className={inputCls} placeholder="e.g. NBS K10 / Electrical Spec" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Section</label>
                    <input value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} className={inputCls} placeholder="e.g. 3.2 Containment" />
                  </div>
                  <div>
                    <label className={labelCls}>Clause</label>
                    <input value={form.clause} onChange={e => setForm(f => ({ ...f, clause: e.target.value }))} className={inputCls} placeholder="e.g. 3.2.1.4" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Page Reference</label>
                    <input value={form.page} onChange={e => setForm(f => ({ ...f, page: e.target.value }))} className={inputCls} placeholder="e.g. pp.12–15" />
                  </div>
                  <div>
                    <label className={labelCls}>Revision</label>
                    <input value={form.revision} onChange={e => setForm(f => ({ ...f, revision: e.target.value }))} className={inputCls} placeholder="e.g. Rev C" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Extracted From</label>
                  <input value={form.extractedFrom} onChange={e => setForm(f => ({ ...f, extractedFrom: e.target.value }))} className={inputCls} placeholder="e.g. AI Review, ChatGPT Import, Manual" />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Scope Entry Tab (Assumptions / Exclusions / Qualifications) ──────────────

function ScopeEntryTab({ category, entries, sectionCls, onAdd, onEdit, onDelete }: {
  category: string;
  entries: TenderScopeEntry[];
  sectionCls: string;
  onAdd: (entry: TenderScopeEntry) => void;
  onEdit: (entry: TenderScopeEntry) => void;
  onDelete: (entry: TenderScopeEntry) => void;
}) {
  const store = useAppStore();
  const [text, setText] = useState('');
  const filtered = entries.filter(e => e.category === category);
  const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 resize-none';

  const singularLabel = category === 'Assumptions' ? 'Assumption'
    : category === 'Exclusions' ? 'Exclusion'
    : 'Qualification';

  const emptyIcon = category === 'Assumptions'
    ? <CheckCircle size={32} className="text-slate-700 mx-auto mb-2" />
    : category === 'Exclusions'
    ? <AlertTriangle size={32} className="text-slate-700 mx-auto mb-2" />
    : <FileText size={32} className="text-slate-700 mx-auto mb-2" />;

  const placeholder = category === 'Assumptions'
    ? 'State a pricing or programme assumption...'
    : category === 'Exclusions'
    ? 'State what is excluded from the tender scope or price...'
    : 'Record a qualification, commercial observation or key decision...';

  function handleAdd() {
    if (!text.trim()) return;
    onAdd({
      id: `se-${Date.now()}`,
      category,
      user: store.currentUser?.name ?? '',
      avatar: store.currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase() ?? '',
      datetime: new Date().toISOString(),
      text: text.trim(),
    });
    setText('');
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className={`text-center py-12 ${sectionCls}`}>
            {emptyIcon}
            <p className="text-sm text-slate-500">No {category.toLowerCase()}s logged yet.</p>
            <p className="text-xs text-slate-600 mt-1">Add the first entry below.</p>
          </div>
        )}
        {filtered.map(entry => (
          <div key={entry.id} className={`${sectionCls} group`}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-full bg-[#f97316] flex items-center justify-center text-white text-[9px] font-bold shrink-0">{entry.avatar}</div>
              <span className="text-xs font-semibold text-slate-300">{entry.user}</span>
              <span className="text-[10px] text-slate-600">{new Date(entry.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(entry.datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => onEdit(entry)}
                  className="p-1 rounded text-slate-600 hover:text-[#f97316] transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  title="Edit entry"
                >
                  <Edit2 size={11} />
                </button>
                <button
                  onClick={() => onDelete(entry)}
                  className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  title="Delete entry"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed pl-8 whitespace-pre-wrap">{entry.text}</p>
            <SourceBadges entry={entry} />
          </div>
        ))}
      </div>
      <div className={sectionCls}>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Add {singularLabel}</p>
        <textarea
          rows={category === 'Scope Note' ? 5 : 3}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAdd(); }}
          className={`${inputCls} mb-3`}
          placeholder={placeholder}
        />
        <div className="flex items-center gap-3">
          <button onClick={handleAdd} disabled={!text.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus size={13} />Add {singularLabel}
          </button>
          <p className="text-[10px] text-slate-600">Ctrl+Enter to add</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tender Export Modal ──────────────────────────────────────────────────────

type ExportType = 'rfi' | 'assumptions' | 'exclusions' | 'scope-notes';

interface TenderExportModalProps {
  tender: Tender;
  companyName: string;
  onClose: () => void;
}

const EXPORT_OPTIONS: { id: ExportType; label: string; icon: string; description: string }[] = [
  { id: 'rfi',          label: 'RFI Schedule',          icon: '?', description: 'All tender RFIs with status and details' },
  { id: 'assumptions',  label: 'Assumptions Schedule',  icon: '✓', description: 'All pricing and programme assumptions' },
  { id: 'exclusions',   label: 'Exclusions Schedule',   icon: '✕', description: 'All exclusions from scope and price' },
  { id: 'scope-notes',  label: 'Qualifications Schedule',  icon: '≡', description: 'All qualifications and commercial observations' },
];

function TenderExportModal({ tender, companyName, onClose }: TenderExportModalProps) {
  const store = useAppStore();
  const [selected, setSelected] = useState<Set<ExportType>>(new Set());
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const exportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const generatedBy = store.currentUser?.name ?? '';

  function toggleSelect(id: ExportType) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function getItemCount(id: ExportType) {
    return id === 'rfi'
      ? (tender.rfis ?? []).length
      : (tender.scopeEntries ?? []).filter((e: TenderScopeEntry) =>
          e.category === (id === 'assumptions' ? 'Assumptions' : id === 'exclusions' ? 'Exclusions' : 'Scope Note')
        ).length;
  }

  // Ordered list of selected schedules for print, preserving EXPORT_OPTIONS order
  const selectedOrdered = EXPORT_OPTIONS.filter(o => selected.has(o.id));
  const totalRecords = selectedOrdered.reduce((sum, o) => sum + getItemCount(o.id), 0);

  function handlePrint() {
    if (selected.size === 0) return;
    const docTitle = selectedOrdered.length === 1 ? selectedOrdered[0].label : 'Tender Clarification Package';
    const docSub = selectedOrdered.length === 1 ? selectedOrdered[0].description : `${selectedOrdered.length} schedules · ${selectedOrdered.map(o => o.label).join(', ')}`;

    const metaHTML = [
      { label: 'Tender Name', value: tender.name, orange: false },
      { label: 'Client', value: tender.client, orange: false },
      { label: 'Tender Reference', value: tender.ref, orange: true },
      { label: 'Location', value: tender.location || '—', orange: false },
      { label: 'Export Date', value: exportDate, orange: false },
      { label: 'Generated By', value: generatedBy, orange: false },
    ].map(m => `<div class="vtp-mc"><div class="vtp-ml">${m.label}</div><div class="vtp-mv${m.orange ? ' vtp-mv-orange' : ''}">${m.value}</div></div>`).join('');

    const sectionsHTML = selectedOrdered.map((opt, idx) => {
      const count = getItemCount(opt.id);
      let tableHTML = '';
      if (opt.id === 'rfi') {
        const rfis: TenderRFI[] = tender.rfis ?? [];
        const rfiRows = rfis.length === 0
          ? `<tr><td colspan="6" style="padding:16px;text-align:center;color:#94a3b8;font-style:italic">No RFIs raised for this tender.</td></tr>`
          : rfis.map(rfi => {
              const statusCls = rfi.status === 'Closed' ? 'vtp-status-closed' : rfi.status === 'Awaiting Response' ? 'vtp-status-awaiting' : rfi.status === 'Issued' ? 'vtp-status-issued' : 'vtp-status-draft';
              const notesRow = rfi.notes ? `<tr><td colspan="6" style="padding:2px 10px 6px 10px;color:#94a3b8;font-size:10px;font-style:italic">Notes: ${rfi.notes}</td></tr>` : '';
              const srcParts = [
                rfi.sourceDocument ? `Doc: ${rfi.sourceDocument}` : '',
                (rfi as TenderRFI & { drawingNumber?: string }).drawingNumber ? `Dwg: ${(rfi as TenderRFI & { drawingNumber?: string }).drawingNumber}` : '',
                rfi.sectionClause ? `§ ${rfi.sectionClause}` : '',
                rfi.pageReference ? `pp.${rfi.pageReference}` : '',
                (rfi as TenderRFI & { revision?: string }).revision ? `Rev: ${(rfi as TenderRFI & { revision?: string }).revision}` : '',
                rfi.importSource ? `Source: ${rfi.importSource}` : '',
              ].filter(Boolean).join(' · ');
              const srcRow = srcParts ? `<tr><td colspan="6" style="padding:1px 10px 8px 10px;color:#64748b;font-size:9px;letter-spacing:0.03em">${srcParts}</td></tr>` : '';
              return `<tr>
                <td style="font-family:monospace;font-size:11px;color:#64748b;white-space:nowrap">${rfi.ref}</td>
                <td style="font-weight:600;color:#1e293b">${rfi.subject || '—'}</td>
                <td style="color:#334155;max-width:260px">${rfi.question}</td>
                <td style="color:#64748b;white-space:nowrap">${rfi.assignedTo || '—'}</td>
                <td style="color:#64748b;white-space:nowrap">${rfi.dateRaised ? new Date(rfi.dateRaised).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                <td><span class="${statusCls}">${rfi.status}</span></td>
              </tr>${notesRow}${srcRow}`;
            }).join('');
        tableHTML = `<table><thead><tr><th>Ref</th><th>Subject</th><th>Question / Detail</th><th>Assigned To</th><th>Date Raised</th><th>Status</th></tr></thead><tbody>${rfiRows}</tbody></table>`;
      } else {
        const cat = opt.id === 'assumptions' ? 'Assumptions' : opt.id === 'exclusions' ? 'Exclusions' : 'Scope Note';
        const catLabel = opt.id === 'assumptions' ? 'Assumptions' : opt.id === 'exclusions' ? 'Exclusions' : 'Qualifications';
        const entries = (tender.scopeEntries ?? []).filter((e: TenderScopeEntry) => e.category === cat);
        const entryRows = entries.length === 0
          ? `<tr><td colspan="3" style="padding:16px;text-align:center;color:#94a3b8;font-style:italic">No ${catLabel.toLowerCase()} recorded for this tender.</td></tr>`
          : entries.map((e: TenderScopeEntry, i: number) => {
              const srcParts = [
                e.sourceDocument ? `Doc: ${e.sourceDocument}` : '',
                (e as TenderScopeEntry & { drawingNumber?: string }).drawingNumber ? `Dwg: ${(e as TenderScopeEntry & { drawingNumber?: string }).drawingNumber}` : '',
                e.sectionClause ? `§ ${e.sectionClause}` : '',
                e.pageReference ? `pp.${e.pageReference}` : '',
                (e as TenderScopeEntry & { revision?: string }).revision ? `Rev: ${(e as TenderScopeEntry & { revision?: string }).revision}` : '',
                e.importSource ? `Source: ${e.importSource}` : '',
              ].filter(Boolean).join(' · ');
              const srcRow = srcParts ? `<tr><td></td><td colspan="2" style="padding:1px 10px 8px 10px;color:#64748b;font-size:9px;letter-spacing:0.03em">${srcParts}</td></tr>` : '';
              return `<tr>
                <td style="font-family:monospace;color:#94a3b8;vertical-align:top">${String(i + 1).padStart(2, '0')}</td>
                <td style="white-space:pre-wrap;line-height:1.6;color:#1e293b">${e.text}</td>
                <td style="vertical-align:top"><div style="font-weight:600;color:#334155">${e.user}</div><div style="font-size:10px;color:#94a3b8;margin-top:2px">${new Date(e.datetime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div></td>
              </tr>${srcRow}`;
            }).join('');
        tableHTML = `<table><thead><tr><th style="width:40px">#</th><th>Description</th><th style="width:130px">Recorded By</th></tr></thead><tbody>${entryRows}</tbody></table>`;
      }
      return `<div class="${idx === 0 ? 'vtp-section' : 'vtp-section-break'}">
        <div class="vtp-section-label">${opt.label} <span class="vtp-count">${count}</span></div>
        ${tableHTML}
      </div>`;
    }).join('');

    const vtpStyles = `
      .vtp-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:20px;margin-bottom:24px}
      .vtp-logo{font-size:26px;font-weight:900;color:#f97316;letter-spacing:2px}
      .vtp-logo-sub{font-size:10px;color:#94a3b8;margin-top:4px;letter-spacing:1px;text-transform:uppercase}
      .vtp-doc-title{font-size:20px;font-weight:800;color:#1e293b;margin-bottom:3px;text-align:right}
      .vtp-doc-sub{font-size:11px;color:#64748b;text-align:right}
      .vtp-meta{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:24px}
      .vtp-mc{padding:9px 13px;border-right:1px solid #e2e8f0}
      .vtp-mc:last-child{border-right:none}
      .vtp-ml{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:3px}
      .vtp-mv{font-size:12px;font-weight:600;color:#1e293b}
      .vtp-mv-orange{color:#f97316}
      .vtp-section{margin-bottom:36px}
      .vtp-section-break{page-break-before:always;padding-top:32px;margin-bottom:36px}
      .vtp-section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:10px}
      .vtp-count{background:#f97316;color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:9999px;margin-left:6px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#f1f5f9;color:#475569;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
      td{padding:8px 10px;color:#1e293b;border-bottom:1px solid #e2e8f0;vertical-align:top}
      tr:nth-child(even) td{background:#f8fafc}
      .vtp-footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8}
      .vtp-footer-logo{font-size:13px;font-weight:900;color:#f97316;letter-spacing:1px}
      .vtp-confidential{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#cbd5e1;border:1px solid #e2e8f0;padding:2px 8px;border-radius:4px}
      .vtp-status-closed{background:#dcfce7;color:#166534;padding:2px 7px;border-radius:9999px;font-size:9px;font-weight:700}
      .vtp-status-awaiting{background:#fef9c3;color:#854d0e;padding:2px 7px;border-radius:9999px;font-size:9px;font-weight:700}
      .vtp-status-issued{background:#dbeafe;color:#1e40af;padding:2px 7px;border-radius:9999px;font-size:9px;font-weight:700}
      .vtp-status-draft{background:#f1f5f9;color:#475569;padding:2px 7px;border-radius:9999px;font-size:9px;font-weight:700}
    `;

    const body = `
      <div class="vtp-header">
        <div><div class="vtp-logo">VYSITE</div><div class="vtp-logo-sub">${companyName || 'Construction Management Platform'}</div></div>
        <div><div class="vtp-doc-title">${docTitle}</div><div class="vtp-doc-sub">${docSub}</div></div>
      </div>
      <div class="vtp-meta">${metaHTML}</div>
      ${sectionsHTML}
      <div class="vtp-footer">
        <div><div class="vtp-footer-logo">VYSITE</div><div style="margin-top:3px">Generated ${today} · ${docTitle} · ${tender.ref}</div></div>
        <div><span class="vtp-confidential">Commercially Sensitive</span></div>
      </div>
    `;
    openPrintTab(buildPrintDocument(`${tender.ref} — ${docTitle}`, vtpStyles, body));
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a] shrink-0">
            <div>
              <h2 className="text-base font-bold text-white">Export Tender Schedules</h2>
              <p className="text-xs text-slate-500 mt-0.5">{tender.name} · {tender.ref} · Select one or more schedules</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
          </div>

          <div className="p-6 space-y-3">
            {EXPORT_OPTIONS.map(opt => {
              const isSelected = selected.has(opt.id);
              const count = getItemCount(opt.id);

              return (
                <button
                  key={opt.id}
                  onClick={() => toggleSelect(opt.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-[#f97316] bg-orange-950/20'
                      : 'border-[#1e2d4a] hover:border-[#2a3d5a] bg-[#0d1628]'
                  }`}
                >
                  {/* Checkbox indicator */}
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? 'bg-[#f97316] border-[#f97316]' : 'border-slate-600 bg-transparent'
                  }`}>
                    {isSelected && (
                      <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                        <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-black shrink-0 ${
                    isSelected ? 'bg-[#f97316] text-white' : 'bg-[#1a2236] border border-[#1e2d4a] text-slate-400'
                  }`}>
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{opt.label}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        count > 0 ? 'bg-[#f97316]/20 text-[#f97316]' : 'bg-[#1e2d4a] text-slate-500'
                      }`}>{count} item{count !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {selected.size > 0 && (
            <div className="px-6 pb-3">
              <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] px-4 py-3 text-xs text-slate-400">
                <p className="font-semibold text-slate-300 mb-1.5">
                  {selected.size === 1 ? 'Single schedule export' : `Combined package · ${selected.size} schedules`}
                </p>
                <div className="space-y-0.5">
                  {selectedOrdered.map(o => (
                    <p key={o.id}>{o.label}: <span className="text-slate-200">{getItemCount(o.id)} item{getItemCount(o.id) !== 1 ? 's' : ''}</span></p>
                  ))}
                </div>
                <p className="mt-1.5 pt-1.5 border-t border-[#1e2d4a]">
                  Total records: <span className="text-slate-200">{totalRecords}</span> · Generated by: <span className="text-slate-200">{generatedBy}</span>
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 p-6 border-t border-[#1e2d4a] shrink-0">
            <button onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button
              onClick={handlePrint}
              disabled={selected.size === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} />{selected.size > 1 ? `Export ${selected.size} Schedules` : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Estimating Tab ───────────────────────────────────────────────────────────

const UNITS = ['Item', 'hr', 'day', 'wk', 'm', 'm²', 'm³', 'nr', 'sum', 'tonne', 'kg', 'l', 'set'];

function calcLine(item: EstimateItem) {
  const costTotal = item.quantity * item.costRate;
  const saleRate = item.costRate * (1 + item.markupPct / 100);
  const saleTotal = item.quantity * saleRate;
  const profit = saleTotal - costTotal;
  return { costTotal, saleRate, saleTotal, profit };
}

const BLANK_LINE = (): EstimateItem => ({
  id: crypto.randomUUID(),
  lineNo: 1,
  description: '',
  unit: 'Item',
  quantity: 1,
  costRate: 0,
  markupPct: 15,
});

interface EstimatingTabProps {
  tender: Tender;
  onUpdate: (t: Tender) => void;
}

function EstimatingTab({ tender, onUpdate }: EstimatingTabProps) {
  const [items, setItems] = useState<EstimateItem[]>(() => tender.estimateItems ?? []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<EstimateItem | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  function save(updated: EstimateItem[]) {
    const renumbered = updated.map((it, i) => ({ ...it, lineNo: i + 1 }));
    setItems(renumbered);
    onUpdate({ ...tender, estimateItems: renumbered });
  }

  function addLine() {
    const next: EstimateItem = { ...BLANK_LINE(), lineNo: items.length + 1 };
    const updated = [...items, next];
    setItems(updated);
    setEditingId(next.id);
    setEditBuf(next);
  }

  function startEdit(item: EstimateItem) {
    setEditingId(item.id);
    setEditBuf({ ...item });
  }

  function commitEdit() {
    if (!editBuf) return;
    const updated = items.map(it => it.id === editBuf.id ? editBuf : it);
    save(updated);
    setEditingId(null);
    setEditBuf(null);
  }

  function cancelEdit() {
    // Remove the line if it was freshly added (empty description)
    if (editBuf && editBuf.description === '' && items.find(it => it.id === editBuf.id)) {
      const updated = items.filter(it => it.id !== editBuf.id);
      save(updated);
    }
    setEditingId(null);
    setEditBuf(null);
  }

  function deleteLine(id: string) {
    save(items.filter(it => it.id !== id));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const updated = [...items];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    save(updated);
  }

  function moveDown(idx: number) {
    if (idx === items.length - 1) return;
    const updated = [...items];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    save(updated);
  }

  // Totals
  const totals = items.reduce((acc, it) => {
    const { costTotal, saleTotal, profit } = calcLine(it);
    return { cost: acc.cost + costTotal, sale: acc.sale + saleTotal, profit: acc.profit + profit };
  }, { cost: 0, sale: 0, profit: 0 });
  const overallMarginPct = totals.sale > 0 ? (totals.profit / totals.sale) * 100 : 0;

  const fmt = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtC = (n: number) => `£${fmt(n)}`;

  // PDF print handlers
  function handlePrintInternal() {
    setShowExportMenu(false);
    const exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const rows = items.map(item => {
      const { costTotal, saleRate, saleTotal, profit } = calcLine(item);
      return `<tr>
        <td style="font-family:monospace;color:#94a3b8">${String(item.lineNo).padStart(2,'0')}</td>
        <td>${item.description}</td>
        <td>${item.unit}</td>
        <td class="num">${fmt(item.quantity)}</td>
        <td class="num">${fmtC(item.costRate)}</td>
        <td class="num">${fmtC(costTotal)}</td>
        <td class="num">${item.markupPct}%</td>
        <td class="num">${fmtC(saleRate)}</td>
        <td class="num">${fmtC(saleTotal)}</td>
        <td class="num" style="color:${profit>=0?'#059669':'#dc2626'}">${fmtC(profit)}</td>
      </tr>`;
    }).join('');
    const styles = `
      .ep-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:20px;margin-bottom:24px}
      .ep-logo{font-size:26px;font-weight:900;color:#f97316;letter-spacing:2px}
      .ep-logo-sub{font-size:10px;color:#94a3b8;margin-top:4px;letter-spacing:1px;text-transform:uppercase}
      .ep-doc-title{font-size:20px;font-weight:800;color:#1e293b;margin-bottom:3px;text-align:right}
      .ep-doc-sub{font-size:11px;color:#64748b;text-align:right}
      .ep-meta{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:24px}
      .ep-mc{padding:9px 13px;border-right:1px solid #e2e8f0}
      .ep-mc:last-child{border-right:none}
      .ep-ml{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:3px}
      .ep-mv{font-size:12px;font-weight:600;color:#1e293b}
      .ep-mv-orange{color:#f97316}
      .ep-section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:10px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#f1f5f9;color:#475569;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
      th.num{text-align:right}
      td{padding:8px 10px;color:#1e293b;border-bottom:1px solid #e2e8f0;vertical-align:top}
      td.num{text-align:right;font-family:monospace}
      tr:nth-child(even) td{background:#f8fafc}
      .ep-summary{margin-top:20px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
      .ep-summary-row{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #e2e8f0;font-size:11px}
      .ep-summary-row:last-child{border-bottom:none;background:#f97316;color:white;font-weight:700}
      .ep-summary-label{color:#475569}
      .ep-summary-row:last-child .ep-summary-label{color:white}
      .ep-confidential{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#dc2626;border:1px solid #dc2626;padding:2px 8px;border-radius:4px}
      .ep-footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8}
      .ep-footer-logo{font-size:13px;font-weight:900;color:#f97316;letter-spacing:1px}
    `;
    const body = `
      <div class="ep-header">
        <div><div class="ep-logo">VYSITE</div><div class="ep-logo-sub">Construction Management Platform</div></div>
        <div><div class="ep-doc-title">Internal Estimate</div><div class="ep-doc-sub">Commercial — Confidential</div></div>
      </div>
      <div class="ep-meta">
        <div class="ep-mc"><div class="ep-ml">Tender Name</div><div class="ep-mv">${tender.name}</div></div>
        <div class="ep-mc"><div class="ep-ml">Client</div><div class="ep-mv">${tender.client}</div></div>
        <div class="ep-mc"><div class="ep-ml">Tender Reference</div><div class="ep-mv ep-mv-orange">${tender.ref}</div></div>
        <div class="ep-mc"><div class="ep-ml">Location</div><div class="ep-mv">${tender.location||'—'}</div></div>
        <div class="ep-mc"><div class="ep-ml">Export Date</div><div class="ep-mv">${exportDate}</div></div>
        <div class="ep-mc"><div class="ep-ml">Line Items</div><div class="ep-mv">${items.length}</div></div>
      </div>
      <div class="ep-section-label">Estimate Schedule — Internal</div>
      <table><thead><tr><th>#</th><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Cost Rate</th><th class="num">Cost Total</th><th class="num">Markup %</th><th class="num">Sale Rate</th><th class="num">Sale Total</th><th class="num">Profit</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="10" style="text-align:center;color:#94a3b8;font-style:italic;padding:20px">No estimate items added.</td></tr>'}</tbody></table>
      <div class="ep-summary">
        <div class="ep-summary-row"><span class="ep-summary-label">Total Cost</span><span>${fmtC(totals.cost)}</span></div>
        <div class="ep-summary-row"><span class="ep-summary-label">Total Sale Value</span><span>${fmtC(totals.sale)}</span></div>
        <div class="ep-summary-row"><span class="ep-summary-label">Total Profit</span><span style="color:${totals.profit>=0?'#059669':'#dc2626'}">${fmtC(totals.profit)}</span></div>
        <div class="ep-summary-row"><span class="ep-summary-label">Overall Margin</span><span>${overallMarginPct.toFixed(1)}%</span></div>
      </div>
      <div class="ep-footer">
        <div><div class="ep-footer-logo">VYSITE</div><div style="margin-top:3px">Generated ${exportDate} · Internal Estimate · ${tender.ref}</div></div>
        <div><span class="ep-confidential">Commercially Sensitive — Internal Only</span></div>
      </div>
    `;
    openPrintTab(buildPrintDocument('Internal Estimate — VYSITE', styles, body));
  }

  function handlePrintClient() {
    setShowExportMenu(false);
    const exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const rows = items.map(item => {
      const { saleRate, saleTotal } = calcLine(item);
      return `<tr>
        <td style="font-family:monospace;color:#94a3b8">${String(item.lineNo).padStart(2,'0')}</td>
        <td>${item.description}</td>
        <td>${item.unit}</td>
        <td class="num">${fmt(item.quantity)}</td>
        <td class="num">${fmtC(saleRate)}</td>
        <td class="num">${fmtC(saleTotal)}</td>
      </tr>`;
    }).join('');
    const styles = `
      .ep-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:20px;margin-bottom:24px}
      .ep-logo{font-size:26px;font-weight:900;color:#f97316;letter-spacing:2px}
      .ep-logo-sub{font-size:10px;color:#94a3b8;margin-top:4px;letter-spacing:1px;text-transform:uppercase}
      .ep-doc-title{font-size:20px;font-weight:800;color:#1e293b;margin-bottom:3px;text-align:right}
      .ep-doc-sub{font-size:11px;color:#64748b;text-align:right}
      .ep-meta{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:24px}
      .ep-mc{padding:9px 13px;border-right:1px solid #e2e8f0}
      .ep-mc:last-child{border-right:none}
      .ep-ml{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:3px}
      .ep-mv{font-size:12px;font-weight:600;color:#1e293b}
      .ep-mv-orange{color:#f97316}
      .ep-section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:10px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#f1f5f9;color:#475569;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
      th.num{text-align:right}
      td{padding:8px 10px;color:#1e293b;border-bottom:1px solid #e2e8f0;vertical-align:top}
      td.num{text-align:right;font-family:monospace}
      tr:nth-child(even) td{background:#f8fafc}
      .ep-summary{margin-top:20px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
      .ep-summary-row{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #e2e8f0;font-size:11px}
      .ep-summary-row:last-child{border-bottom:none;background:#f97316;color:white;font-weight:700}
      .ep-summary-label{color:#475569}
      .ep-summary-row:last-child .ep-summary-label{color:white}
      .ep-footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8}
      .ep-footer-logo{font-size:13px;font-weight:900;color:#f97316;letter-spacing:1px}
    `;
    const body = `
      <div class="ep-header">
        <div><div class="ep-logo">VYSITE</div><div class="ep-logo-sub">Construction Management Platform</div></div>
        <div><div class="ep-doc-title">Tender Estimate</div><div class="ep-doc-sub">Tender Clarification — Pricing Schedule</div></div>
      </div>
      <div class="ep-meta">
        <div class="ep-mc"><div class="ep-ml">Tender Name</div><div class="ep-mv">${tender.name}</div></div>
        <div class="ep-mc"><div class="ep-ml">Client</div><div class="ep-mv">${tender.client}</div></div>
        <div class="ep-mc"><div class="ep-ml">Tender Reference</div><div class="ep-mv ep-mv-orange">${tender.ref}</div></div>
        <div class="ep-mc"><div class="ep-ml">Location</div><div class="ep-mv">${tender.location||'—'}</div></div>
        <div class="ep-mc"><div class="ep-ml">Export Date</div><div class="ep-mv">${exportDate}</div></div>
        <div class="ep-mc"><div class="ep-ml">Line Items</div><div class="ep-mv">${items.length}</div></div>
      </div>
      <div class="ep-section-label">Pricing Schedule</div>
      <table><thead><tr><th>#</th><th>Description</th><th>Unit</th><th class="num">Quantity</th><th class="num">Rate</th><th class="num">Total</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="6" style="text-align:center;color:#94a3b8;font-style:italic;padding:20px">No estimate items added.</td></tr>'}</tbody></table>
      <div class="ep-summary">
        <div class="ep-summary-row"><span class="ep-summary-label">Total Tender Value</span><span style="font-weight:700">${fmtC(totals.sale)}</span></div>
      </div>
      <div class="ep-footer">
        <div><div class="ep-footer-logo">VYSITE</div><div style="margin-top:3px">Generated ${exportDate} · Tender Estimate · ${tender.ref}</div></div>
        <div></div>
      </div>
    `;
    openPrintTab(buildPrintDocument('Tender Estimate — VYSITE', styles, body));
  }

  const inputCls = 'bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#f97316] w-full';
  const numInputCls = `${inputCls} text-right`;
  const thCls = 'px-3 py-2.5 text-[10px] font-700 uppercase tracking-wider text-slate-500 text-left whitespace-nowrap';
  const tdCls = 'px-3 py-2 text-xs text-slate-300 align-middle';
  const tdNumCls = `${tdCls} text-right font-mono`;


  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Estimate Schedule</h3>
          <p className="text-xs text-slate-500 mt-0.5">{items.length} line item{items.length !== 1 ? 's' : ''} · Total sale: {fmtC(totals.sale)}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-xs font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
            >
              <Download size={13} />Export PDF<ChevronDown size={11} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-[#1a2236] border border-[#1e2d4a] rounded-xl shadow-xl z-20 overflow-hidden">
                <button onClick={handlePrintInternal} className="w-full flex items-center gap-3 px-4 py-3 text-xs text-slate-300 hover:bg-[#1e2d4a] hover:text-white transition-colors text-left">
                  <div className="w-6 h-6 rounded bg-red-900/40 flex items-center justify-center shrink-0">
                    <FileText size={12} className="text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Internal Estimate</p>
                    <p className="text-[10px] text-slate-500">Full cost + margin detail</p>
                  </div>
                </button>
                <button onClick={handlePrintClient} className="w-full flex items-center gap-3 px-4 py-3 text-xs text-slate-300 hover:bg-[#1e2d4a] hover:text-white transition-colors text-left border-t border-[#1e2d4a]">
                  <div className="w-6 h-6 rounded bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <FileText size={12} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Client Estimate</p>
                    <p className="text-[10px] text-slate-500">Sale totals only — no margin</p>
                  </div>
                </button>
              </div>
            )}
          </div>
          <button onClick={addLine} className="flex items-center gap-1.5 px-3 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
            <Plus size={13} />Add Line
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calculator size={32} className="text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-400">No estimate items yet</p>
            <p className="text-xs text-slate-600 mt-1">Click Add Line to start building your estimate</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[#1e2d4a]">
                <tr>
                  <th className={thCls} style={{ width: 32 }}>#</th>
                  <th className={thCls}>Description</th>
                  <th className={thCls} style={{ width: 72 }}>Unit</th>
                  <th className={`${thCls} text-right`} style={{ width: 80 }}>Qty</th>
                  <th className={`${thCls} text-right`} style={{ width: 96 }}>Cost Rate</th>
                  <th className={`${thCls} text-right`} style={{ width: 96 }}>Cost Total</th>
                  <th className={`${thCls} text-right`} style={{ width: 80 }}>Markup %</th>
                  <th className={`${thCls} text-right`} style={{ width: 96 }}>Sale Rate</th>
                  <th className={`${thCls} text-right`} style={{ width: 96 }}>Sale Total</th>
                  <th className={`${thCls} text-right`} style={{ width: 96 }}>Profit</th>
                  <th className={thCls} style={{ width: 72 }}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4a]">
                {items.map((item, idx) => {
                  const { costTotal, saleRate, saleTotal, profit } = calcLine(item);
                  const isEditing = editingId === item.id;

                  if (isEditing && editBuf) {
                    const buf = editBuf;
                    const { costTotal: bCT, saleRate: bSR, saleTotal: bST, profit: bP } = calcLine(buf);
                    return (
                      <tr key={item.id} className="bg-orange-950/10 border-l-2 border-l-[#f97316]">
                        <td className={tdCls}>
                          <span className="text-[10px] font-mono text-slate-500">{String(item.lineNo).padStart(2,'0')}</span>
                        </td>
                        <td className={tdCls}>
                          <input
                            autoFocus
                            value={buf.description}
                            onChange={e => setEditBuf({ ...buf, description: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                            className={inputCls}
                            placeholder="Line item description..."
                          />
                        </td>
                        <td className={tdCls}>
                          <select value={buf.unit} onChange={e => setEditBuf({ ...buf, unit: e.target.value })} className={inputCls}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className={tdCls}>
                          <input type="number" min="0" step="any" value={buf.quantity} onChange={e => setEditBuf({ ...buf, quantity: parseFloat(e.target.value) || 0 })} className={numInputCls} />
                        </td>
                        <td className={tdCls}>
                          <input type="number" min="0" step="any" value={buf.costRate} onChange={e => setEditBuf({ ...buf, costRate: parseFloat(e.target.value) || 0 })} className={numInputCls} />
                        </td>
                        <td className={`${tdNumCls} text-slate-500`}>{fmtC(bCT)}</td>
                        <td className={tdCls}>
                          <input type="number" min="0" max="100" step="0.5" value={buf.markupPct} onChange={e => setEditBuf({ ...buf, markupPct: parseFloat(e.target.value) || 0 })} className={numInputCls} />
                        </td>
                        <td className={`${tdNumCls} text-slate-500`}>{fmtC(bSR)}</td>
                        <td className={`${tdNumCls} text-slate-500`}>{fmtC(bST)}</td>
                        <td className={`${tdNumCls} ${bP >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtC(bP)}</td>
                        <td className={tdCls}>
                          <div className="flex items-center gap-1">
                            <button onClick={commitEdit} className="p-1 rounded bg-[#f97316]/20 text-[#f97316] hover:bg-[#f97316]/30 transition-colors" title="Save">
                              <Save size={12} />
                            </button>
                            <button onClick={cancelEdit} className="p-1 rounded bg-slate-700/40 text-slate-400 hover:bg-slate-700/60 transition-colors" title="Cancel">
                              <X size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={item.id} className="hover:bg-[#1e2d4a]/40 group cursor-pointer" onClick={() => startEdit(item)}>
                      <td className={tdCls}>
                        <span className="text-[10px] font-mono text-slate-500">{String(item.lineNo).padStart(2,'0')}</span>
                      </td>
                      <td className={`${tdCls} font-medium text-slate-200`}>{item.description || <span className="text-slate-600 italic">No description</span>}</td>
                      <td className={tdCls}>{item.unit}</td>
                      <td className={tdNumCls}>{fmt(item.quantity)}</td>
                      <td className={tdNumCls}>{fmtC(item.costRate)}</td>
                      <td className={tdNumCls}>{fmtC(costTotal)}</td>
                      <td className={`${tdNumCls} text-amber-400`}>{item.markupPct}%</td>
                      <td className={tdNumCls}>{fmtC(saleRate)}</td>
                      <td className={`${tdNumCls} text-white font-semibold`}>{fmtC(saleTotal)}</td>
                      <td className={`${tdNumCls} ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'} font-semibold`}>{fmtC(profit)}</td>
                      <td className={tdCls} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1 rounded text-slate-500 hover:text-slate-300 disabled:opacity-20 transition-colors" title="Move up">
                            <ChevronUp size={12} />
                          </button>
                          <button onClick={() => moveDown(idx)} disabled={idx === items.length - 1} className="p-1 rounded text-slate-500 hover:text-slate-300 disabled:opacity-20 transition-colors" title="Move down">
                            <ChevronDown size={12} />
                          </button>
                          <button onClick={() => deleteLine(item.id)} className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Cost', value: fmtC(totals.cost), color: 'text-slate-300', sub: 'Internal build cost' },
            { label: 'Total Sale Value', value: fmtC(totals.sale), color: 'text-white', sub: 'Client-facing value' },
            { label: 'Total Profit', value: fmtC(totals.profit), color: totals.profit >= 0 ? 'text-emerald-400' : 'text-red-400', sub: 'Sale minus cost' },
            { label: 'Overall Margin', value: `${overallMarginPct.toFixed(1)}%`, color: overallMarginPct >= 15 ? 'text-emerald-400' : overallMarginPct >= 8 ? 'text-amber-400' : 'text-red-400', sub: 'Profit / Sale × 100' },
          ].map(card => (
            <div key={card.label} className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{card.label}</p>
              <p className={`text-xl font-bold font-mono ${card.color}`}>{card.value}</p>
              <p className="text-[10px] text-slate-600 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Click-outside close for export menu */}
      {showExportMenu && <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />}
    </div>
  );
}

// ─── Tender Detail ────────────────────────────────────────────────────────────

interface TenderDetailProps {
  tender: Tender;
  onBack: () => void;
  onUpdate: (t: Tender) => void;
  onConvertToProject: (t: Tender) => void;
  convertLoading?: boolean;
  convertError?: string | null;
}

function TenderDetail({ tender, onBack, onUpdate, onConvertToProject, convertLoading, convertError }: TenderDetailProps) {
  const store = useAppStore();
  const perms = usePermissions();
  const isAdmin = store.currentUser?.role === 'Admin';
  const canRunAI = perms['ai.run_review'];
  const canUploadDocs = perms['ai.upload_docs'];
  const canEditTender = perms['tender.reclassify'] || isAdmin;
  const canCreateRFI = perms['tender.rfi.create'];
  const canEditRFI = perms['tender.rfi.edit'];
  const canDeleteRFI = perms['tender.rfi.delete'];
  const canViewPricing = perms['commercial.view_pricing'] || perms['commercial.view_values'];
  const canExport = perms['ai.export'] || perms['commercial.export_reports'];

  // Always-current tender ref so callbacks never close over a stale prop snapshot
  const tenderRef = useRef(tender);
  useEffect(() => { tenderRef.current = tender; }, [tender]);

  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [newComment, setNewComment] = useState('');
  const [editNotes, setEditNotes] = useState(tender.internalNotes);
  const scopeNotes = tender.scopeNotes ?? { summary: '', inclusions: '', exclusions: '', assumptions: '', risks: '', opportunities: '', specialistItems: '', siteVisitNotes: '' };
  const [scopeEntries, setScopeEntries] = useState<TenderScopeEntry[]>(tender.scopeEntries ?? []);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');

  const [showAddDocument, setShowAddDocument] = useState(false);
  const [showAddRFI, setShowAddRFI] = useState(false);
  const [showAddSubcontractor, setShowAddSubcontractor] = useState(false);
  const [showEditTender, setShowEditTender] = useState(false);

  const [editingDoc, setEditingDoc] = useState<TenderDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<TenderDocument | null>(null);
  const [editingRFI, setEditingRFI] = useState<TenderRFI | null>(null);
  const [viewingRFI, setViewingRFI] = useState<TenderRFI | null>(null);
  const [editingSC, setEditingSC] = useState<TenderSubcontractor | null>(null);
  const [editingScopeEntry, setEditingScopeEntry] = useState<TenderScopeEntry | null>(null);

  const [noteSaved, setNoteSaved] = useState(false);
  const [localProgress, setLocalProgress] = useState(tender.progress ?? 0);
  const [showExport, setShowExport] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ type: 'rfi' | 'scopeEntry' | 'comment'; id: string } | null>(null);

  const days = daysRemaining(tender.returnDate);
  const isActive = !['Won', 'Lost', 'No Bid'].includes(tender.status);

  const activeUsers = store.platformUsers.filter(u => u.status === 'Active');
  const filteredMentions = activeUsers.filter(u => u.name.toLowerCase().includes(mentionSearch.toLowerCase())).slice(0, 6);

  const handleCommentChange = (val: string) => {
    setNewComment(val);
    const atIndex = val.lastIndexOf('@');
    if (atIndex !== -1 && atIndex === val.length - 1) {
      setShowMentionList(true);
      setMentionSearch('');
    } else if (atIndex !== -1 && val.slice(atIndex + 1).match(/^\w[\w\s.]*$/)) {
      setShowMentionList(true);
      setMentionSearch(val.slice(atIndex + 1));
    } else {
      setShowMentionList(false);
    }
  };

  const insertMention = (name: string) => {
    const atIndex = newComment.lastIndexOf('@');
    setNewComment(newComment.slice(0, atIndex) + `@${name} `);
    setShowMentionList(false);
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    const text = newComment.trim();
    const c: TenderComment = {
      id: `c${Date.now()}`,
      user: store.currentUser?.name ?? '',
      avatar: store.currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase() ?? '',
      datetime: new Date().toISOString(),
      text,
    };
    onUpdate({ ...tender, comments: [...tender.comments, c] });
    setNewComment('');
    // Fire notifications for @mentioned users
    activeUsers.filter(u => text.includes(`@${u.name}`)).forEach(async u => {
      const notif: DBNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        recipient_id: u.id,
        type: 'mention',
        title: `You were mentioned in tender: ${tender.name}`,
        body: text.slice(0, 120),
        linked_type: 'tender',
        linked_id: tender.id,
        project_id: tender.id,
        project_name: tender.name,
        read: false,
        created_at: new Date().toISOString(),
      };
      await store.addNotification(notif);
    });
  };

  const saveNotes = () => {
    onUpdate({ ...tender, scopeNotes, internalNotes: editNotes });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  const setStatus = (status: TenderStatus) => onUpdate({ ...tender, status, lastUpdated: '2026-05-19' });

  const handleSaveDocument = (doc: TenderDocument) => {
    if (editingDoc) {
      onUpdate({ ...tender, documents: tender.documents.map(d => d.id === doc.id ? doc : d) });
      setEditingDoc(null);
      // Restore detail view with the updated doc (preserving comments)
      setViewingDoc({ ...doc, comments: editingDoc.comments });
    } else {
      onUpdate({ ...tender, documents: [...tender.documents, doc] });
      setShowAddDocument(false);
      setActiveTab('Documents');
    }
  };

  const handleSaveRFI = (rfi: TenderRFI) => {
    if (editingRFI) {
      onUpdate({ ...tender, rfis: tender.rfis.map(r => r.id === rfi.id ? rfi : r) });
      setEditingRFI(null);
      // Restore detail view with updated RFI (preserving comments)
      setViewingRFI({ ...rfi, comments: editingRFI.comments });
    } else {
      onUpdate({ ...tender, rfis: [...tender.rfis, rfi] });
      setShowAddRFI(false);
      setActiveTab('RFIs');
    }
  };

  const handleSaveScopeEntry = (updated: TenderScopeEntry) => {
    const newEntries = scopeEntries.map(e => e.id === updated.id ? updated : e);
    setScopeEntries(newEntries);
    onUpdate({ ...tender, scopeEntries: newEntries });
    setEditingScopeEntry(null);
  };

  const handleSaveSubcontractor = (sc: TenderSubcontractor) => {
    if (editingSC) {
      onUpdate({ ...tender, subcontractors: tender.subcontractors.map(s => s.id === sc.id ? sc : s) });
      setEditingSC(null);
    } else {
      onUpdate({ ...tender, subcontractors: [...tender.subcontractors, sc] });
      setShowAddSubcontractor(false);
      setActiveTab('Subcontractors');
    }
  };

  const sectionCls = 'bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-5';
  const labelCls = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1';
  const valCls = 'text-sm font-medium text-slate-200';
  const textareaCls = 'w-full bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-[#f97316] resize-none placeholder:text-slate-600';
  const quickBtnCls = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e2d4a] text-xs font-semibold text-slate-400 hover:border-[#f97316] hover:text-[#f97316] transition-colors';

  return (
    <div className="p-4 lg:p-6">
      {/* Back + header */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 mb-5 transition-colors">
        <ArrowLeft size={16} />Back to Tender & Estimating
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-white">{tender.name}</h1>
            <StatusBadge status={tender.status} />
            <PriorityBadge priority={tender.priority} />
          </div>
          <p className="text-sm text-slate-500">{tender.ref} · {tender.client}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isActive && (
            <div className={`text-sm font-bold px-4 py-2 rounded-lg border ${
              days < 0 ? 'bg-red-900/40 text-red-400 border-red-800' :
              days <= 7 ? 'bg-amber-900/40 text-amber-400 border-amber-800' :
              'bg-[#1a2236] text-slate-300 border-[#1e2d4a]'
            }`}>
              {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
            </div>
          )}
          {canExport && (
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-sm font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
            >
              <Download size={14} />Export
            </button>
          )}
          {canEditTender && (
            <button
              onClick={() => setShowEditTender(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-sm font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
            >
              <Edit2 size={14} />Edit Tender
            </button>
          )}
          {canViewPricing && (
            <div className="text-right">
              <p className="text-xl font-bold text-[#f97316]">{formatValue(tender.estimatedValue)}</p>
              <p className="text-xs text-slate-500">Estimated Value</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick-action buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        {canRunAI && (
          <button
            onClick={() => setShowAIAssistant(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316]/10 hover:bg-[#f97316]/20 border border-[#f97316]/40 hover:border-[#f97316]/70 text-[#f97316] rounded-lg text-xs font-semibold transition-all"
          >
            <Sparkles size={13} />AI Tender Assistant
          </button>
        )}
        {canUploadDocs && (
          <button onClick={() => setShowAddDocument(true)} className={quickBtnCls}>
            <Plus size={13} />Add Document
          </button>
        )}
        {canCreateRFI && (
          <button onClick={() => setShowAddRFI(true)} className={quickBtnCls}>
            <Plus size={13} />Add RFI
          </button>
        )}
        <button onClick={() => setShowAddSubcontractor(true)} className={quickBtnCls}>
          <Plus size={13} />Add Subcontractor
        </button>
        <button onClick={() => setActiveTab('Assumptions')} className={quickBtnCls}>
          <Plus size={13} />Add Assumption
        </button>
        <button onClick={() => setActiveTab('Exclusions')} className={quickBtnCls}>
          <Plus size={13} />Add Exclusion
        </button>
        <button onClick={() => setActiveTab('Qualifications')} className={quickBtnCls}>
          <Plus size={13} />Add Qualification
        </button>
        <button onClick={() => setActiveTab('Discussion')} className={quickBtnCls}>
          <MessageSquare size={13} />Discussion
        </button>
      </div>

      {/* Tabs */}
      {(() => {
        const tabCounts: Partial<Record<Tab, number>> = {
          'RFIs':          tender.rfis.length,
          'Assumptions':   scopeEntries.filter(e => e.category === 'Assumptions').length,
          'Exclusions':    scopeEntries.filter(e => e.category === 'Exclusions').length,
          'Qualifications':   scopeEntries.filter(e => e.category === 'Scope Note').length,
          'Discussion':    tender.comments.length,
          'Documents':     tender.documents.length,
          'Subcontractors': tender.subcontractors.length,
          'Estimating':       (tender.estimateItems ?? []).length,
          'Contract Review':  (tender.contractReviews ?? []).length,
        };
        return (
          <div className="flex gap-1 mb-6 overflow-x-auto bg-[#1a2236] rounded-xl p-1.5 border border-[#1e2d4a]">
            {TABS.map(tab => {
              const Icon = tabIcons[tab];
              const count = tabCounts[tab];
              const showCount = typeof count === 'number' && count > 0;
              const isActive = activeTab === tab;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  <Icon size={13} />{tab}
                  {showCount && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#0d1628] text-slate-400'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ── OVERVIEW ── */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className={sectionCls}>
              <h3 className="text-sm font-bold text-white mb-4">Tender Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Client', value: tender.client },
                  { label: 'Site / Location', value: tender.location },
                  { label: 'Tender Reference', value: tender.ref },
                  { label: 'Received Date', value: new Date(tender.receivedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                  { label: 'Return Date', value: new Date(tender.returnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                  { label: 'Estimated Value', value: formatValue(tender.estimatedValue) },
                  { label: 'Tender Owner', value: tender.owner },
                  { label: 'Status', value: tender.status },
                  { label: 'Priority', value: tender.priority },
                  { label: 'Last Updated', value: new Date(tender.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                ].map(item => (
                  <div key={item.label}>
                    <p className={labelCls}>{item.label}</p>
                    <p className={valCls}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={sectionCls}>
              <p className={labelCls}>Key Next Action</p>
              <p className="text-sm text-[#f97316] font-semibold">{tender.nextAction || '—'}</p>
            </div>

            {/* Tender Progress */}
            <div className={sectionCls}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-white">Tender Progress</p>
                <span className="text-sm font-bold text-[#f97316]">{localProgress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={localProgress}
                onChange={e => setLocalProgress(Number(e.target.value))}
                onMouseUp={() => onUpdate({ ...tender, progress: localProgress })}
                onTouchEnd={() => onUpdate({ ...tender, progress: localProgress })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#f97316] bg-[#0d1628]"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1.5">
                {['New', 'Reviewing', 'Pricing', 'Sub Returns', 'Submitted', 'Negotiation', 'Closed'].map((label, i) => (
                  <span key={label} style={{ width: `${100/7}%` }} className={`text-center ${localProgress >= Math.round(i * 100 / 6) ? 'text-slate-400' : ''}`}>{label}</span>
                ))}
              </div>
              <p className="text-[10px] text-slate-600 mt-2">Indicative completion stage only. Not a contractual value.</p>
            </div>

            <div className={sectionCls}>
              <div className="flex items-center gap-2 mb-3">
                <StickyNote size={14} className="text-[#f97316]" />
                <p className="text-sm font-bold text-white">Internal Notes</p>
              </div>
              <textarea
                id="internal-notes-area"
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={5}
                className={textareaCls}
                placeholder="Add internal notes, pricing assumptions, commercial observations..."
              />
              <div className="flex items-center gap-3 mt-3">
                <button onClick={saveNotes} className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
                  <Save size={12} />Save Notes
                </button>
                {noteSaved && <span className="text-xs text-emerald-400 font-semibold">Saved</span>}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className={sectionCls}>
              <p className="text-sm font-bold text-white mb-3">Update Status</p>
              <div className="space-y-1.5">
                {(['New Enquiry', 'Reviewing', 'Pricing', 'Awaiting Subcontractor Returns', 'Submitted', 'Negotiation'] as TenderStatus[]).map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                      tender.status === s ? 'bg-[#f97316] text-white border-[#f97316]' : 'bg-[#1a2236] text-slate-400 border-[#1e2d4a] hover:border-slate-500'
                    }`}>{s}</button>
                ))}
              </div>
            </div>

            <div className={sectionCls}>
              <p className="text-sm font-bold text-white mb-1">Return Date</p>
              <p className={`text-2xl font-bold ${days < 0 ? 'text-red-400' : days <= 7 ? 'text-amber-400' : 'text-white'}`}>
                {days < 0 ? `${Math.abs(days)}` : days}
              </p>
              <p className="text-xs text-slate-500">{days < 0 ? 'days overdue' : 'days remaining'}</p>
              <p className="text-xs text-slate-500 mt-2">
                Due {new Date(tender.returnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Recent discussion preview */}
            {tender.comments.length > 0 && (
              <div className={sectionCls}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-white">Recent Discussion</p>
                  <button onClick={() => setActiveTab('Discussion')} className="text-xs text-[#f97316] font-semibold hover:text-orange-400 transition-colors">View all</button>
                </div>
                <div className="space-y-3">
                  {tender.comments.slice(-2).map(c => (
                    <div key={c.id} className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#f97316] flex items-center justify-center text-white text-[9px] font-bold shrink-0">{c.avatar}</div>
                      <div>
                        <p className="text-xs font-semibold text-slate-300">{c.user}</p>
                        <p className="text-xs text-slate-500 line-clamp-2">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ESTIMATING ── */}
      {activeTab === 'Estimating' && (
        <EstimatingTab tender={tender} onUpdate={onUpdate} />
      )}

      {/* ── QUALIFICATIONS ── */}
      {activeTab === 'Qualifications' && (
        <ScopeEntryTab
          category="Scope Note"
          entries={scopeEntries}
          sectionCls={sectionCls}
          onAdd={(entry) => {
            const updated = [...scopeEntries, entry];
            setScopeEntries(updated);
            onUpdate({ ...tender, scopeEntries: updated });
          }}
          onEdit={setEditingScopeEntry}
          onDelete={(entry) => setDeleteConfirmItem({ type: 'scopeEntry', id: entry.id })}
        />
      )}

      {/* ── ASSUMPTIONS ── */}
      {activeTab === 'Assumptions' && (
        <ScopeEntryTab
          category="Assumptions"
          entries={scopeEntries}
          sectionCls={sectionCls}
          onAdd={(entry) => {
            const updated = [...scopeEntries, entry];
            setScopeEntries(updated);
            onUpdate({ ...tender, scopeEntries: updated });
          }}
          onEdit={setEditingScopeEntry}
          onDelete={(entry) => setDeleteConfirmItem({ type: 'scopeEntry', id: entry.id })}
        />
      )}

      {/* ── EXCLUSIONS ── */}
      {activeTab === 'Exclusions' && (
        <ScopeEntryTab
          category="Exclusions"
          entries={scopeEntries}
          sectionCls={sectionCls}
          onAdd={(entry) => {
            const updated = [...scopeEntries, entry];
            setScopeEntries(updated);
            onUpdate({ ...tender, scopeEntries: updated });
          }}
          onEdit={setEditingScopeEntry}
          onDelete={(entry) => setDeleteConfirmItem({ type: 'scopeEntry', id: entry.id })}
        />
      )}

      {/* ── DISCUSSION ── */}
      {activeTab === 'Discussion' && (
        <div className="space-y-4">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {tender.comments.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare size={32} className="text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No comments yet. Start the discussion.</p>
              </div>
            )}
            {tender.comments.map(c => (
              <div key={c.id} className={`${sectionCls} group`}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#f97316] flex items-center justify-center text-white text-xs font-bold shrink-0">{c.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{c.user}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(c.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(c.datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => setDeleteConfirmItem({ type: 'comment', id: c.id })}
                        className="ml-auto p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        title="Delete comment"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{renderMentions(c.text)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={`${sectionCls} flex gap-3`}>
            <div className="w-8 h-8 rounded-full bg-[#f97316] flex items-center justify-center text-white text-xs font-bold shrink-0">JT</div>
            <div className="flex-1 relative">
              <div className="flex items-center gap-1 mb-1.5">
                <AtSign size={12} className="text-slate-600" />
                <span className="text-[10px] text-slate-600">Type @name to mention a team member</span>
              </div>
              <textarea
                value={newComment}
                onChange={e => handleCommentChange(e.target.value)}
                rows={3}
                className={`${textareaCls} mb-2`}
                placeholder="Add a comment... Use @name to mention someone"
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addComment(); if (e.key === 'Escape') setShowMentionList(false); }}
              />
              {showMentionList && filteredMentions.length > 0 && (
                <div className="absolute left-0 right-0 bottom-full mb-1 bg-[#1a2236] border border-[#1e2d4a] rounded-xl shadow-xl overflow-hidden z-10">
                  {filteredMentions.map(u => (
                    <button key={u.id} onClick={() => insertMention(u.name)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-[#0d1628] hover:text-[#f97316] transition-colors flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#f97316]/20 flex items-center justify-center text-[#f97316] text-[10px] font-bold">{u.avatar_initials}</div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-500">{u.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={addComment} className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
                <Send size={13} />Add Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBCONTRACTORS ── */}
      {activeTab === 'Subcontractors' && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e2d4a]">
                  {['Package', 'Company', 'Contact', 'Date Sent', 'Return Due', 'Status', 'Notes', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4a]">
                {tender.subcontractors.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-500">No subcontractor enquiries yet.</td></tr>
                )}
                {tender.subcontractors.map((sc: TenderSubcontractor) => {
                  const scAttCount = store.attachments.filter(a => a.linked_type === 'tender_sc' && a.linked_id === sc.id).length;
                  return (
                  <tr key={sc.id} className="hover:bg-[#0d1628]/40 transition-colors group">
                    <td className="py-3 pr-4 text-sm font-semibold text-slate-200 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {sc.package}
                        {scAttCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">
                            <Paperclip size={9} />{scAttCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-300 whitespace-nowrap">{sc.company}</td>
                    <td className="py-3 pr-4 text-sm text-slate-400 whitespace-nowrap">{sc.contact}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500 whitespace-nowrap">{sc.dateSent ? new Date(sc.dateSent).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500 whitespace-nowrap">{new Date(sc.returnDue).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${scColors[sc.status]}`}>{sc.status}</span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500 max-w-[180px] truncate">{sc.notes || '—'}</td>
                    <td className="py-3">
                      <button type="button" onClick={() => setEditingSC(sc)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-[#f97316] hover:bg-[#1e2d4a] transition-all">
                        <Edit2 size={13} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RFIs ── */}
      {activeTab === 'RFIs' && (
        <TenderRFIRegister
          rfis={tender.rfis}
          tenderId={tender.id}
          tenderName={tender.name}
          attachments={store.attachments}
          canCreate={canCreateRFI}
          canEdit={canEditRFI}
          canDelete={canDeleteRFI}
          onAddRFI={() => setShowAddRFI(true)}
          onEditRFI={rfi => { setEditingRFI(rfi); setViewingRFI(null); }}
          onOpenRFI={setViewingRFI}
          onUpdateStatus={(rfiId, status) => {
            onUpdate({
              ...tender,
              rfis: tender.rfis.map((r: TenderRFI) => r.id === rfiId ? { ...r, status } : r),
            });
          }}
          onDeleteRFI={rfi => setDeleteConfirmItem({ type: 'rfi', id: rfi.id })}
        />
      )}

      {/* ── DOCUMENTS ── */}
      {activeTab === 'Documents' && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Document Register</p>
          <div className="space-y-2">
            {tender.documents.length === 0 && (
              <div className="py-12 text-center bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
                <FileText size={32} className="text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No documents registered. Click Add Document above.</p>
              </div>
            )}
            {tender.documents.map((doc: TenderDocument) => {
              const docAttCount = store.attachments.filter(a => a.linked_type === 'tender_doc' && a.linked_id === doc.id).length;
              const docCommentCount = (doc.comments ?? []).length;
              return (
                <div
                  key={doc.id}
                  onClick={() => setViewingDoc(doc)}
                  className="group bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-3.5 hover:bg-[#0d1628]/60 hover:border-[#f97316]/30 transition-all cursor-pointer border-l-2 border-l-transparent hover:border-l-[#f97316]/50"
                >
                  {/* Top row: icon + name + type badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center shrink-0">
                        <FileText size={14} className="text-slate-500 group-hover:text-[#f97316]/70 transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors leading-snug truncate">{doc.name}</p>
                        {doc.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{doc.notes}</p>}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0d1628] border border-[#1e2d4a] text-slate-400 shrink-0">{doc.type}</span>
                  </div>

                  {/* Bottom row: meta + counts + actions */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e2d4a]">
                    <span className="text-xs text-slate-500">Rev: <span className="font-mono text-slate-300">{doc.revision}</span></span>
                    <span className="text-xs text-slate-500">{new Date(doc.dateReceived).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                    <div className="flex items-center gap-2 ml-auto">
                      {docCommentCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                          <MessageSquare size={11} />{docCommentCount}
                        </span>
                      )}
                      {docAttCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-500 bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">
                          <Paperclip size={9} />{docAttCount}
                        </span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setEditingDoc(doc); }}
                        className="p-1 rounded text-slate-600 hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
                        title="Edit document"
                      >
                        <Edit2 size={13} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); onUpdate({ ...tender, documents: tender.documents.filter((d: TenderDocument) => d.id !== doc.id) }); }}
                          className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                          title="Delete document"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CONTRACT REVIEW ── */}
      {activeTab === 'Contract Review' && (
        <div className="max-w-3xl">
          <AIContractReview
            tender={tender}
            currentUser={store.currentUser}
            onUpdateReviews={reviews => onUpdate({ ...tender, contractReviews: reviews })}
            onAddDocument={doc => onUpdate({ ...tender, documents: [...tender.documents, doc] })}
          />
        </div>
      )}

      {/* ── OUTCOME ── */}
      {activeTab === 'Outcome' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className={sectionCls}>
            <p className="text-sm font-bold text-white mb-4">Tender Outcome</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {(['Won', 'Lost', 'No Bid', 'Negotiation'] as TenderStatus[]).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`py-3 rounded-xl text-sm font-bold transition-all border ${
                    tender.status === s
                      ? s === 'Won' ? 'bg-emerald-600 text-white border-emerald-600'
                        : s === 'Lost' ? 'bg-red-600 text-white border-red-600'
                        : s === 'No Bid' ? 'bg-slate-600 text-white border-slate-600'
                        : 'bg-amber-600 text-white border-amber-600'
                      : 'bg-[#1a2236] text-slate-400 border-[#1e2d4a] hover:border-slate-500'
                  }`}>{s}</button>
              ))}
            </div>

            <div>
              <p className={`${labelCls} mb-2`}>Outcome Notes</p>
              <textarea
                value={tender.outcomeNotes}
                onChange={e => onUpdate({ ...tender, outcomeNotes: e.target.value })}
                rows={5}
                className={textareaCls}
                placeholder="Record outcome details, agreed value, lessons learned..."
              />
              <button onClick={() => onUpdate(tender)} className="mt-3 flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
                <Save size={12} />Save Outcome
              </button>
            </div>
          </div>

          {tender.status === 'Won' && (
            <div className={`${sectionCls} flex flex-col items-center justify-center text-center`}>
              {tender.convertedProjectId ? (
                <>
                  <CheckCircle size={40} className="text-emerald-400 mb-3" />
                  <p className="text-white font-bold mb-1">Project Created</p>
                  <p className="text-sm text-slate-400">This tender has been converted to a project in the Projects module.</p>
                </>
              ) : (
                <>
                  <Trophy size={40} className="text-[#f97316] mb-3" />
                  <p className="text-white font-bold text-lg mb-1">Tender Won!</p>
                  <p className="text-sm text-slate-400 mb-5">Convert this tender to a live project to begin operational tracking.</p>
                  {convertError && (
                    <p className="text-sm text-red-400 mb-3">{convertError}</p>
                  )}
                  <button
                    onClick={() => onConvertToProject(tender)}
                    disabled={convertLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {convertLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FolderOpen size={16} />
                    )}
                    {convertLoading ? 'Converting…' : 'Convert to Project'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {viewingDoc && !editingDoc && (
        <TenderDocDetail
          doc={viewingDoc}
          tenderId={tender.id}
          tenderName={tender.name}
          onClose={() => setViewingDoc(null)}
          onEdit={() => { setEditingDoc(viewingDoc); setViewingDoc(null); }}
          onUpdateComments={comments => {
            // Find the current doc from tender to avoid stale closure on doc fields
            const current = tender.documents.find((d: TenderDocument) => d.id === viewingDoc.id) ?? viewingDoc;
            const updated = { ...current, comments };
            setViewingDoc(updated);
            onUpdate({ ...tender, documents: tender.documents.map((d: TenderDocument) => d.id === updated.id ? updated : d) });
          }}
        />
      )}
      {(showAddDocument || editingDoc) && (
        <AddDocumentModal
          tenderId={tender.id}
          tenderName={tender.name}
          onClose={() => {
            const wasEditing = editingDoc;
            setShowAddDocument(false);
            setEditingDoc(null);
            // If cancel came from editing a viewed doc, restore the detail view
            if (wasEditing) setViewingDoc(wasEditing);
          }}
          onSave={handleSaveDocument}
          initial={editingDoc ?? undefined}
        />
      )}
      {viewingRFI && !editingRFI && (
        <TenderRFIDetail
          rfi={viewingRFI}
          tenderId={tender.id}
          tenderName={tender.name}
          onClose={() => setViewingRFI(null)}
          onEdit={() => { setEditingRFI(viewingRFI); setViewingRFI(null); }}
          onUpdateComments={comments => {
            const current = tender.rfis.find((r: TenderRFI) => r.id === viewingRFI.id) ?? viewingRFI;
            const updated = { ...current, comments };
            setViewingRFI(updated);
            onUpdate({ ...tender, rfis: tender.rfis.map((r: TenderRFI) => r.id === updated.id ? updated : r) });
          }}
          onUpdateStatus={status => {
            const updated = { ...viewingRFI, status };
            setViewingRFI(updated);
            onUpdate({ ...tender, rfis: tender.rfis.map((r: TenderRFI) => r.id === updated.id ? updated : r) });
          }}
        />
      )}
      {(showAddRFI || editingRFI) && (
        <AddRFIModal
          rfiRef={`RFI-00${tender.rfis.length + 1}`}
          tenderId={tender.id}
          tenderName={tender.name}
          onClose={() => {
            const wasEditing = editingRFI;
            setShowAddRFI(false);
            setEditingRFI(null);
            if (wasEditing) setViewingRFI(wasEditing);
          }}
          onSave={handleSaveRFI}
          initial={editingRFI ?? undefined}
        />
      )}
      {(showAddSubcontractor || editingSC) && (
        <AddSubcontractorModal
          tenderId={tender.id}
          tenderName={tender.name}
          onClose={() => { setShowAddSubcontractor(false); setEditingSC(null); }}
          onSave={handleSaveSubcontractor}
          initial={editingSC ?? undefined}
        />
      )}
      {editingScopeEntry && (
        <EditScopeEntryModal
          entry={editingScopeEntry}
          onClose={() => setEditingScopeEntry(null)}
          onSave={handleSaveScopeEntry}
        />
      )}
      {showEditTender && (
        <EditTenderModal
          tender={tender}
          onClose={() => setShowEditTender(false)}
          onSave={updated => { onUpdate(updated); setShowEditTender(false); }}
          onDelete={async (id) => {
            await logActivity({ orgId: store.currentOrgId ?? '', userName: store.currentUser?.name ?? '', module: 'tenders', recordId: id, recordRef: tender.ref ?? tender.name, recordType: 'Tender', actionType: 'record_deleted', description: `${store.currentUser?.name ?? 'Unknown'} deleted tender ${tender.ref ?? tender.name} — ${tender.name}.` });
            await store.removeTender(id);
            setShowEditTender(false);
            onBack();
          }}
          canDelete={isAdmin}
        />
      )}
      {showExport && (
        <TenderExportModal
          tender={tender}
          companyName={store.settings.company_name}
          onClose={() => setShowExport(false)}
        />
      )}
      {showAIAssistant && (
        <AITenderAssistant
          tender={tender}
          currentUser={store.currentUser}
          onCommit={({ rfis, scopeEntries, review, replaceRfis, replaceScopeEntries }) => {
            // Single read of tenderRef.current — one onUpdate call — no two-callback race
            const latest = tenderRef.current;
            const newRfis = rfis
              ? (replaceRfis ? rfis : [...latest.rfis, ...rfis])
              : latest.rfis;
            const newScopeEntries = scopeEntries
              ? (replaceScopeEntries ? scopeEntries : [...(latest.scopeEntries ?? []), ...scopeEntries])
              : latest.scopeEntries;
            const newAiReview = review !== undefined ? (review ?? undefined) : latest.aiReview;
            const updated = { ...latest, rfis: newRfis, scopeEntries: newScopeEntries, aiReview: newAiReview };
            if (scopeEntries) setScopeEntries(updated.scopeEntries ?? []);
            onUpdate(updated);
          }}
          onClose={() => setShowAIAssistant(false)}
        />
      )}

      {deleteConfirmItem && (
        <ConfirmDeleteModal
          title={
            deleteConfirmItem.type === 'rfi' ? 'Delete RFI' :
            deleteConfirmItem.type === 'scopeEntry' ? 'Delete Entry' :
            'Delete Comment'
          }
          description={
            deleteConfirmItem.type === 'rfi' ? 'This RFI will be permanently removed from this tender.' :
            deleteConfirmItem.type === 'scopeEntry' ? 'This entry will be permanently removed from this tender.' :
            'This comment will be permanently removed from this tender.'
          }
          onCancel={() => setDeleteConfirmItem(null)}
          onConfirm={() => {
            if (deleteConfirmItem.type === 'rfi') {
              onUpdate({ ...tender, rfis: tender.rfis.filter((r: TenderRFI) => r.id !== deleteConfirmItem.id) });
            } else if (deleteConfirmItem.type === 'scopeEntry') {
              setScopeEntries(prev => {
                const updated = prev.filter(e => e.id !== deleteConfirmItem.id);
                onUpdate({ ...tender, scopeEntries: updated });
                return updated;
              });
            } else if (deleteConfirmItem.type === 'comment') {
              onUpdate({ ...tender, comments: tender.comments.filter((c: { id: string }) => c.id !== deleteConfirmItem.id) });
            }
            setDeleteConfirmItem(null);
          }}
        />
      )}

    </div>
  );
}

// ─── Create Tender Modal ──────────────────────────────────────────────────────

function CreateTenderModal({ onClose, onSave }: { onClose: () => void; onSave: (t: Tender) => Promise<string | null> }) {
  const store = useAppStore();
  const [form, setForm] = useState({
    name: '', client: '', location: '', returnDate: '', estimatedValue: '',
    owner: '', priority: 'High' as TenderPriority, nextAction: '', internalNotes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const today = new Date().toISOString().slice(0, 10);
    const t: Tender = {
      id: `t${Date.now()}`,
      ref: `TND-2026-${String(Math.floor(Math.random() * 900) + 100)}`,
      name: form.name,
      client: form.client,
      location: form.location,
      receivedDate: today,
      returnDate: form.returnDate,
      estimatedValue: parseFloat(form.estimatedValue.replace(/[^0-9.]/g, '')) || 0,
      status: 'New Enquiry',
      owner: form.owner,
      priority: form.priority,
      lastUpdated: today,
      nextAction: form.nextAction,
      internalNotes: form.internalNotes,
      scopeNotes: { summary: '', inclusions: '', exclusions: '', assumptions: '', risks: '', opportunities: '', specialistItems: '', siteVisitNotes: '' },
      scopeEntries: [],
      subcontractors: [],
      rfis: [],
      documents: [],
      comments: [],
      outcomeNotes: '',
      progress: 0,
      estimateItems: [],
    };
    const err = await onSave(t);
    setSaving(false);
    if (err) { setSaveError(err); return; }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <h2 className="text-lg font-bold text-white">New Tender Enquiry</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {saveError && (
            <div className="bg-red-900/40 border border-red-500/50 rounded-lg px-4 py-3 text-sm text-red-300">
              {saveError}
            </div>
          )}
          <div><label className={labelCls}>Tender Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Ward 5 Electrical Upgrade" /></div>
          <div><label className={labelCls}>Client *</label><input required value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} className={inputCls} placeholder="Client name" /></div>
          <div><label className={labelCls}>Site / Location</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputCls} placeholder="Site address" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Return Date *</label><input required type="date" value={form.returnDate} onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>Estimated Value</label><input value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))} className={inputCls} placeholder="£000,000" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tender Owner</label>
              <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} className={inputCls}>
                <option value="">— Select owner —</option>
                {store.platformUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TenderPriority }))} className={inputCls}>
                <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
              </select>
            </div>
          </div>
          <div><label className={labelCls}>Next Action</label><input value={form.nextAction} onChange={e => setForm(f => ({ ...f, nextAction: e.target.value }))} className={inputCls} placeholder="What needs to happen next?" /></div>
          <div><label className={labelCls}>Internal Notes</label><textarea value={form.internalNotes} onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Create Tender'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Pipeline Report — Blob URL generator ─────────────────────────────────────

function openPipelineReport(tenders: Tender[], companyName: string, generatedBy: string): void {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const active = tenders.filter(t => !['Won', 'Lost', 'No Bid'].includes(t.status));
  const totalValue = tenders.reduce((sum, t) => sum + t.estimatedValue, 0);
  const fmt = (n: number) => n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}m` : n >= 1000 ? `£${(n / 1000).toFixed(0)}k` : `£${n.toLocaleString()}`;

  const rows = tenders.map((t, i) => {
    const statusBg = t.status === 'Won' ? '#dcfce7' : t.status === 'Lost' ? '#fee2e2' : t.status === 'Submitted' ? '#ccfbf1' : t.status === 'No Bid' ? '#f1f5f9' : '#dbeafe';
    const statusColor = t.status === 'Won' ? '#166534' : t.status === 'Lost' ? '#991b1b' : t.status === 'Submitted' ? '#0f766e' : t.status === 'No Bid' ? '#475569' : '#1e40af';
    const priorityColor = t.priority === 'Critical' ? '#dc2626' : t.priority === 'High' ? '#f97316' : t.priority === 'Medium' ? '#d97706' : '#64748b';
    return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
      <td style="font-family:monospace;font-size:10px;color:#64748b;white-space:nowrap">${t.ref}</td>
      <td style="font-weight:600;color:#1e293b">${t.name}</td>
      <td style="color:#334155">${t.client}</td>
      <td><span style="display:inline-block;font-size:9px;font-weight:700;padding:2px 7px;border-radius:9999px;white-space:nowrap;background:${statusBg};color:${statusColor}">${t.status}</span></td>
      <td style="color:${priorityColor};font-weight:600">${t.priority}</td>
      <td style="color:#64748b">${t.owner}</td>
      <td style="color:#64748b;white-space:nowrap">${t.returnDate ? new Date(t.returnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
      <td style="font-weight:700;color:#1e293b">${fmt(t.estimatedValue)}</td>
      <td style="color:#64748b">${t.progress != null ? `${t.progress}%` : '—'}</td>
    </tr>`;
  }).join('');

  const metaCells = [
    { label: 'Total Tenders', value: String(tenders.length), orange: false },
    { label: 'Active Pipeline', value: String(active.length), orange: false },
    { label: 'Pipeline Value', value: fmt(totalValue), orange: true },
    { label: 'Report Date', value: today, orange: false },
  ].map((m, i) => `<div style="padding:9px 13px;border-right:${i < 3 ? '1px solid #e2e8f0' : 'none'}">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:3px">${m.label}</div>
    <div style="font-size:13px;font-weight:700;color:${m.orange ? '#f97316' : '#1e293b'}">${m.value}</div>
  </div>`).join('');

  const styles = `
    table{width:100%;border-collapse:collapse}
    th{background:#f1f5f9;color:#475569;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:7px 9px;text-align:left;border-bottom:2px solid #e2e8f0}
    td{padding:7px 9px;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:top;font-size:11px}
  `;
  const body = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:18px;margin-bottom:22px">
      <div>
        <div style="font-size:24px;font-weight:900;color:#f97316;letter-spacing:2px">VYSITE</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:3px;letter-spacing:1px;text-transform:uppercase">${companyName || 'Construction Management Platform'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:800;color:#1e293b;margin-bottom:3px">Tender Pipeline Report</div>
        <div style="font-size:11px;color:#64748b">Commercial Summary · All Tenders</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:22px">${metaCells}</div>
    <div style="font-size:11px;color:#475569;margin-bottom:16px;line-height:1.6">
      ${tenders.length} tender${tenders.length !== 1 ? 's' : ''} total &nbsp;·&nbsp;
      Active: ${active.length} &nbsp;·&nbsp;
      Won: ${tenders.filter(t => t.status === 'Won').length} &nbsp;·&nbsp;
      Lost: ${tenders.filter(t => t.status === 'Lost').length} &nbsp;·&nbsp;
      No Bid: ${tenders.filter(t => t.status === 'No Bid').length} &nbsp;·&nbsp;
      Submitted: ${tenders.filter(t => t.status === 'Submitted').length}
    </div>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:8px">
      Tender Register <span style="background:#f97316;color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:9999px;margin-left:6px">${tenders.length}</span>
    </div>
    <table>
      <thead><tr><th>Ref</th><th>Tender Name</th><th>Client</th><th>Status</th><th>Priority</th><th>Owner</th><th>Return Date</th><th>Est. Value</th><th>Progress</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">No tenders recorded</td></tr>`}</tbody>
    </table>
    <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8">
      <div>
        <div style="font-size:13px;font-weight:900;color:#f97316;letter-spacing:1px">VYSITE</div>
        <div style="margin-top:2px">Generated ${today} · Tender Pipeline Report · ${generatedBy}</div>
      </div>
      <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#cbd5e1;border:1px solid #e2e8f0;padding:2px 8px;border-radius:4px">Commercially Sensitive</span>
    </div>
  `;
  openPrintTab(buildPrintDocument('Tender Pipeline Report — VYSITE', styles, body));
}

// ─── Main Export ──────────────────────────────────────────────────────────────

const TENDER_FIELDS: FieldSpec[] = [
  { label: 'Tender Name',     key: 'name' },
  { label: 'Status',          key: 'status' },
  { label: 'Priority',        key: 'priority' },
  { label: 'Estimated Value', key: 'estimatedValue' },
  { label: 'Client',          key: 'client' },
  { label: 'Owner',           key: 'owner' },
  { label: 'Return Date',     key: 'returnDate' },
];

interface TenderTrackerProps {
  onConvertToProject: (t: Tender) => void;
  pendingOpen?: { linkedType: string; linkedId: string } | null;
  onPendingOpenConsumed?: () => void;
}

export default function TenderTracker({ onConvertToProject, pendingOpen, onPendingOpenConsumed }: TenderTrackerProps) {
  const store = useAppStore();
  const perms = usePermissions();
  const tenderList = store.tenders;
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterOwner, setFilterOwner] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const isAdmin = store.currentUser?.role === 'Admin';
  const canCreateTender = isAdmin || perms['tender.reclassify'];
  const canDeleteTender = isAdmin;
  const canViewPricingList = perms['commercial.view_pricing'] || perms['commercial.view_values'];
  const canExportPipeline = perms['commercial.export_reports'] || isAdmin;
  const orgId = store.currentOrgId ?? '';
  const userName = store.currentUser?.name ?? '';

  useEffect(() => {
    if (pendingOpen?.linkedType === 'tender' && pendingOpen.linkedId) {
      const found = store.tenders.find(t => t.id === pendingOpen.linkedId);
      if (found) { setSelectedTender(found); onPendingOpenConsumed?.(); }
    }
  }, [pendingOpen, store.tenders, onPendingOpenConsumed]);

  const updateTender = (updated: Tender) => {
    const prev = store.tenders.find(t => t.id === updated.id);
    store.updateTender(updated);
    setSelectedTender(updated);
    const { changesText, prevValue, newValue, actionType } = buildDiff(
      (prev ?? {}) as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      TENDER_FIELDS,
    );
    const changePart = changesText ? ` Changes: ${changesText}.` : '';
    logActivity({ orgId, userName, module: 'tenders', recordId: updated.id, recordRef: updated.ref ?? updated.name, recordType: 'Tender', actionType, description: `${userName} updated Tender ${updated.ref ?? updated.name} — ${updated.name}.${changePart}`, prevValue, newValue });
  };

  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);

  const handleConvert = async (tender: Tender) => {
    setConvertError(null);
    setConvertLoading(true);
    const newProject = {
      id: `p${Date.now()}`,
      name: tender.name,
      client: tender.client,
      location: tender.location,
      projectManager: tender.owner,
      status: 'Active' as const,
      startDate: new Date().toISOString().slice(0, 10),
      completionDate: '',
      openActions: 0,
      openSnags: 0,
      progress: 0,
      value: formatValue(tender.estimatedValue),
    };
    const err = await store.addProject(newProject);
    if (err) {
      setConvertError(err);
      setConvertLoading(false);
      return;
    }
    const updated = { ...tender, convertedProjectId: newProject.id };
    updateTender(updated);
    setConvertLoading(false);
    onConvertToProject(updated);
  };

  if (selectedTender) {
    return (
      <TenderDetail
        tender={selectedTender}
        onBack={() => setSelectedTender(null)}
        onUpdate={updateTender}
        onConvertToProject={handleConvert}
        convertLoading={convertLoading}
        convertError={convertError}
      />
    );
  }

  const filtered = tenderList.filter(t => {
    const ms = t.name.toLowerCase().includes(search.toLowerCase()) || t.client.toLowerCase().includes(search.toLowerCase()) || t.ref.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'All' ? true
      : filterStatus === '__open__' ? !['Won', 'Lost', 'No Bid'].includes(t.status)
      : filterStatus === '__dueweek__' ? (() => { const d = daysRemaining(t.returnDate); return d >= 0 && d <= 7 && !['Won', 'Lost', 'No Bid'].includes(t.status); })()
      : t.status === filterStatus;
    return ms && matchStatus
      && (filterOwner === 'All' || t.owner === filterOwner)
      && (filterPriority === 'All' || t.priority === filterPriority);
  });

  const open = tenderList.filter(t => !['Won', 'Lost', 'No Bid'].includes(t.status));
  const dueThisWeek = tenderList.filter(t => { const d = daysRemaining(t.returnDate); return d >= 0 && d <= 7 && !['Won', 'Lost', 'No Bid'].includes(t.status); });
  const submitted = tenderList.filter(t => t.status === 'Submitted');
  const won = tenderList.filter(t => t.status === 'Won');
  const lost = tenderList.filter(t => t.status === 'Lost');
  const pipeline = open.reduce((sum, t) => sum + t.estimatedValue, 0);

  const owners = Array.from(new Set(tenderList.map(t => t.owner)));

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Tender & Estimating</h2>
          <p className="text-sm text-slate-500">{open.length} active tenders · {formatValue(pipeline)} pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          {canExportPipeline && (
            <button
              onClick={() => openPipelineReport(tenderList, store.settings.company_name, store.currentUser?.name ?? 'VYSITE')}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-sm font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
            >
              <FileText size={15} />Pipeline Report
            </button>
          )}
          {canCreateTender && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
              <Plus size={16} />New Tender
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {([
          { label: 'Open Tenders',  value: open.length,           color: 'text-white',          filter: '__open__' },
          { label: 'Due This Week', value: dueThisWeek.length,    color: 'text-amber-400',      filter: '__dueweek__' },
          { label: 'Submitted',     value: submitted.length,      color: 'text-teal-400',       filter: 'Submitted' },
          { label: 'Won',           value: won.length,            color: 'text-emerald-400',    filter: 'Won' },
          { label: 'Lost',          value: lost.length,           color: 'text-red-400',        filter: 'Lost' },
          { label: 'Pipeline Value',value: canViewPricingList ? formatValue(pipeline) : '—', color: 'text-[#f97316]', filter: null },
        ] as const).map(s => {
          const isActive = s.filter !== null && filterStatus === s.filter;
          const clickable = s.filter !== null;
          return (
            <div
              key={s.label}
              className={`bg-[#1a2236] rounded-xl border p-4 text-center transition-all${clickable ? ' cursor-pointer hover:border-[#2a3d5a]' : ''} ${isActive ? 'border-[#f97316] ring-1 ring-[#f97316]/20' : 'border-[#1e2d4a]'}`}
              onClick={clickable ? () => setFilterStatus(filterStatus === s.filter ? 'All' : s.filter!) : undefined}
            >
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenders, clients, refs..."
            className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600" />
        </div>

        <div className="relative">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 pr-8 text-sm text-slate-300 outline-none focus:border-[#f97316] appearance-none">
            <option value="All">All Statuses</option>
            {(['New Enquiry','Reviewing','Pricing','Awaiting Subcontractor Returns','Submitted','Negotiation','Won','Lost','No Bid'] as TenderStatus[]).map(s => <option key={s}>{s}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>

        <div className="relative">
          <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)}
            className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 pr-8 text-sm text-slate-300 outline-none focus:border-[#f97316] appearance-none">
            <option value="All">All Owners</option>
            {owners.map(o => <option key={o}>{o}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>

        <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
          {['All', 'Critical', 'High', 'Medium', 'Low'].map(p => (
            <button key={p} onClick={() => setFilterPriority(p)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${filterPriority === p ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{p}</button>
          ))}
        </div>
      </div>

      {/* Tender table */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
        <div className="hidden xl:grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-[#1e2d4a] bg-[#0d1628]">
          {['Tender', 'Client', 'Return Date', 'Days', 'Value', 'Status', 'Priority', 'Owner'].map(h => (
            <span key={h} className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        <div className="divide-y divide-[#1e2d4a]">
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <AlertTriangle size={32} className="text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No tenders match your filters</p>
            </div>
          )}
          {filtered.map(tender => {
            const days = daysRemaining(tender.returnDate);
            const isActive = !['Won', 'Lost', 'No Bid'].includes(tender.status);
            const tenderAttCount = store.attachments.filter(a => a.linked_type === 'tender' && a.linked_id === tender.id).length;
            const tenderCommentCount = tender.comments?.length ?? 0;
            return (
              <div key={tender.id}
                className={`group grid grid-cols-1 xl:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 xl:gap-4 px-5 py-4 hover:bg-[#0d1628]/50 transition-all cursor-pointer border-l-4 ${priorityColors[tender.priority].border}`}
                onClick={() => setSelectedTender(tender)}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200 group-hover:text-[#f97316] transition-colors line-clamp-1">{tender.name}</p>
                  <p className="text-[10px] font-mono text-slate-600 mt-0.5">{tender.ref}</p>
                </div>
                <p className="text-sm text-slate-400 truncate hidden xl:block">{tender.client.split(' ').slice(0, 4).join(' ')}{tender.client.split(' ').length > 4 ? '…' : ''}</p>
                <p className="text-xs text-slate-400 hidden xl:block">
                  {new Date(tender.returnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                </p>
                <div className="hidden xl:block">
                  {isActive ? (
                    <span className={`flex items-center gap-1 text-xs font-bold ${days < 0 ? 'text-red-400' : days <= 7 ? 'text-amber-400' : 'text-slate-400'}`}>
                      <Clock size={11} />
                      {days < 0 ? `${Math.abs(days)}d late` : `${days}d`}
                    </span>
                  ) : <span className="text-xs text-slate-600">—</span>}
                </div>
                {canViewPricingList
                  ? <p className="text-sm font-semibold text-slate-300 hidden xl:block">{formatValue(tender.estimatedValue)}</p>
                  : <p className="hidden xl:block" />
                }
                <div className="xl:hidden flex flex-wrap gap-2 items-center">
                  <StatusBadge status={tender.status} />
                  {canViewPricingList && <span className="text-xs text-slate-500">{formatValue(tender.estimatedValue)}</span>}
                  {isActive && <span className={`text-xs font-bold ${days < 0 ? 'text-red-400' : days <= 7 ? 'text-amber-400' : 'text-slate-500'}`}>{days < 0 ? `${Math.abs(days)}d late` : `${days}d`}</span>}
                </div>
                <div className="hidden xl:block"><StatusBadge status={tender.status} /></div>
                <div className="hidden xl:block"><PriorityBadge priority={tender.priority} /></div>
                <div className="hidden xl:flex items-center gap-2">
                  <span className="text-xs text-slate-400">{tender.owner.split(' ')[0]}</span>
                </div>
                <div className="hidden xl:flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  {tenderCommentCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                      <MessageSquare size={11} />{tenderCommentCount}
                    </span>
                  )}
                  {tenderAttCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-500 bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">
                      <Paperclip size={9} />{tenderAttCount}
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedTender(tender); }}
                    className="p-1.5 rounded text-slate-600 hover:text-[#f97316] hover:bg-orange-900/20 transition-colors"
                    title="Open tender"
                  >
                    <Edit2 size={13} />
                  </button>
                  {canDeleteTender && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteConfirm(tender.id); }}
                      className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                      title="Delete tender"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showCreate && (
        <CreateTenderModal onClose={() => setShowCreate(false)} onSave={t => {
          store.addTender(t);
          logActivity({ orgId, userName, module: 'tenders', recordId: t.id, recordRef: t.ref ?? t.name, recordType: 'Tender', actionType: 'record_created', description: `${userName} created tender ${t.ref ?? t.name} — ${t.name}.` });
        }} />
      )}
      {deleteConfirm && (
        <ConfirmDeleteModal
          title="Delete Tender"
          description="This tender and all its data will be permanently deleted."
          onConfirm={async () => {
            const id = deleteConfirm;
            const target = store.tenders.find(t => t.id === id);
            await logActivity({ orgId, userName, module: 'tenders', recordId: id, recordRef: target?.ref ?? target?.name ?? null, recordType: 'Tender', actionType: 'record_deleted', description: `${userName} deleted tender ${target?.ref ?? target?.name ?? id} — ${target?.name ?? ''}.` });
            store.removeTender(id);
            setDeleteConfirm(null);
            setSelectedTender(prev => (prev?.id === id ? null : prev));
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
