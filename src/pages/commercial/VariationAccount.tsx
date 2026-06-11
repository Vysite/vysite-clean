import { useState, useMemo } from 'react';
import {
  Plus, X, Save, Trash2,
  Paperclip, Eye, Download, FileText, AlertCircle,
  TrendingUp, TrendingDown, Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../lib/StoreContext';
import FileUploadComponent from '../../components/FileUpload';
import type { UploadedFile } from '../../components/FileUpload';
import type { DBVariationAccountItem, DBAttachment } from '../../lib/store';
import type { Project } from '../../data/types';
import { fmtCurrency, fmtDate } from './types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type VAStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'agreed'
  | 'rejected'
  | 'paid'
  | 'withdrawn';

const VA_STATUSES: { value: VAStatus; label: string; color: string }[] = [
  { value: 'draft',        label: 'Draft',        color: 'bg-slate-700/60 text-slate-300 border-slate-600/50' },
  { value: 'submitted',    label: 'Submitted',    color: 'bg-sky-900/40 text-sky-300 border-sky-700/50' },
  { value: 'under_review', label: 'Under Review', color: 'bg-amber-900/40 text-amber-300 border-amber-700/50' },
  { value: 'agreed',       label: 'Agreed',       color: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50' },
  { value: 'rejected',     label: 'Rejected',     color: 'bg-red-900/40 text-red-300 border-red-700/50' },
  { value: 'paid',         label: 'Paid',         color: 'bg-green-900/40 text-green-300 border-green-700/50' },
  { value: 'withdrawn',    label: 'Withdrawn',    color: 'bg-slate-800/60 text-slate-500 border-slate-700/40' },
];

function statusInfo(s: string) {
  return VA_STATUSES.find(x => x.value === s) ?? VA_STATUSES[0];
}

// Variation Exposure: submitted + under_review + agreed
const EXPOSURE_STATUSES: VAStatus[] = ['submitted', 'under_review', 'agreed'];
// Agreed Variations: agreed + paid (drives Adjusted Contract Sum)
const AGREED_STATUSES: VAStatus[] = ['agreed', 'paid'];

export function calcVAMetrics(items: DBVariationAccountItem[]) {
  function signedValue(item: DBVariationAccountItem) {
    return item.is_positive ? item.value : -item.value;
  }
  const exposure = items
    .filter(i => EXPOSURE_STATUSES.includes(i.status as VAStatus))
    .reduce((s, i) => s + signedValue(i), 0);
  const agreed = items
    .filter(i => AGREED_STATUSES.includes(i.status as VAStatus))
    .reduce((s, i) => s + signedValue(i), 0);
  const rejected = items
    .filter(i => i.status === 'rejected')
    .reduce((s, i) => s + signedValue(i), 0);
  const underReview = items
    .filter(i => i.status === 'under_review')
    .reduce((s, i) => s + signedValue(i), 0);
  return { exposure, agreed, rejected, underReview };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls  = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#f97316] focus:border-[#f97316] transition-colors';
const labelCls  = 'block text-xs font-medium text-slate-400 mb-1';
const selectCls = `${inputCls} appearance-none cursor-pointer`;

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = statusInfo(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${s.color}`}>
      {s.label}
    </span>
  );
}

// ─── Attachment row ───────────────────────────────────────────────────────────

function AttachmentRow({
  att, onRemove, fetchData,
}: { att: DBAttachment; onRemove: () => void; fetchData: (id: string) => Promise<string> }) {
  const [previewing, setPreviewing] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(att.data_url || null);
  const [loading, setLoading] = useState(false);
  const isImage = att.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.name ?? '');

  async function openPreview() {
    if (!dataUrl) { setLoading(true); const u = await fetchData(att.id); setDataUrl(u); setLoading(false); }
    setPreviewing(true);
  }
  async function handleDownload() {
    let url = dataUrl;
    if (!url) { setLoading(true); url = await fetchData(att.id); setDataUrl(url); setLoading(false); }
    const a = document.createElement('a'); a.href = url!; a.download = att.name; a.click();
  }

  const size = att.size
    ? (att.size < 1024 * 1024
        ? `${(att.size / 1024).toFixed(0)} KB`
        : `${(att.size / (1024 * 1024)).toFixed(1)} MB`)
    : '';

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1628] border border-[#1e2d4a] group">
        {isImage ? (
          <button onClick={openPreview} className="w-14 h-10 rounded-lg overflow-hidden shrink-0 border border-[#1e2d4a] bg-[#1a2236] flex items-center justify-center hover:opacity-80 transition-opacity">
            {dataUrl
              ? <img src={dataUrl} alt={att.name} className="w-full h-full object-cover" />
              : <Eye size={14} className={`text-slate-400 ${loading ? 'animate-pulse' : ''}`} />}
          </button>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-[#1a2236] flex items-center justify-center shrink-0">
            <FileText size={14} className="text-slate-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">{att.name}</p>
          {size && <p className="text-xs text-slate-500">{size}</p>}
        </div>
        {!isImage && (
          <button onClick={handleDownload} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-900/30 border border-orange-700/40 text-orange-400 hover:bg-orange-900/50 text-xs font-medium transition-colors shrink-0">
            <Download size={12} /> Download
          </button>
        )}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={openPreview} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a]"><Eye size={14} /></button>
          <button onClick={onRemove} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-[#1e2d4a]"><Trash2 size={14} /></button>
        </div>
      </div>
      {previewing && dataUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={() => setPreviewing(false)}>
          {isImage
            ? <img src={dataUrl} alt={att.name} className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
            : <iframe src={dataUrl} title={att.name} className="w-[90vw] h-[90vh] rounded-xl bg-white" onClick={(e: React.MouseEvent) => e.stopPropagation()} />
          }
          <button onClick={() => setPreviewing(false)} className="absolute top-4 right-4 p-2 bg-black/60 rounded-full text-white hover:bg-black/80"><X size={20} /></button>
        </div>
      )}
    </>
  );
}

// ─── Variation drawer ─────────────────────────────────────────────────────────

type DrawerMode = 'create' | 'edit';
type DrawerTab = 'details' | 'attachments';

interface VariationDrawerProps {
  mode: DrawerMode;
  item: DBVariationAccountItem | null;
  orgId: string;
  projectId: string;
  nextRef: string;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (v: DBVariationAccountItem) => void;
  onDeleted: (id: string) => void;
}

function VariationDrawer({
  mode, item, orgId, projectId, nextRef, canEdit, canDelete,
  onClose, onSaved, onDeleted,
}: VariationDrawerProps) {
  const store = useAppStore();

  const [tab, setTab] = useState<DrawerTab>('details');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    reference:   item?.reference   ?? nextRef,
    title:       item?.title       ?? '',
    description: item?.description ?? '',
    reason:      item?.reason      ?? '',
    value:       item?.value       != null ? String(item.value) : '',
    isPositive:  item?.is_positive ?? true,
    status:      (item?.status     ?? 'draft') as VAStatus,
    dateRaised:  item?.date_raised ?? new Date().toISOString().slice(0, 10),
    dateAgreed:  item?.date_agreed ?? '',
    notes:       item?.notes       ?? '',
  });

  const attachments = store.attachments.filter(
    a => a.linked_type === 'variation_account' && a.linked_id === (item?.id ?? '')
  );

  function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    const valueNum = parseFloat(form.value.replace(/[£,\s]/g, ''));
    if (isNaN(valueNum) || valueNum < 0) { setError('Enter a valid positive number for Value'); return; }
    setSaving(true); setError(null);
    const now = new Date().toISOString();
    const row: DBVariationAccountItem = {
      id:          item?.id ?? generateId(),
      org_id:      orgId,
      project_id:  projectId,
      reference:   form.reference.trim(),
      title:       form.title.trim(),
      description: form.description.trim(),
      reason:      form.reason.trim(),
      value:       valueNum,
      is_positive: form.isPositive,
      status:      form.status,
      date_raised: form.dateRaised || null,
      date_agreed: form.dateAgreed || null,
      notes:       form.notes.trim(),
      created_by:  item?.created_by ?? (store.currentUser?.name ?? null),
      created_at:  item?.created_at ?? now,
      updated_at:  now,
    };
    try {
      if (mode === 'create') {
        await store.addVariationAccountItem(row);
      } else {
        await store.updateVariationAccountItem(row);
      }
      onSaved(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    await store.removeVariationAccountItem(item.id);
    for (const att of attachments) {
      await supabase.from('vy_attachments').delete().eq('id', att.id);
    }
    onDeleted(item.id);
    setDeleting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d4a] shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">
              {mode === 'create'
                ? 'New Variation'
                : (form.reference ? `${form.reference} — ${form.title || 'Untitled'}` : form.title || 'Edit Variation')}
            </h2>
            <p className="text-xs text-slate-500">Variation Account</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-[#1e2d4a] rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2d4a] px-6 shrink-0">
          {(['details', 'attachments'] as DrawerTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-xs font-medium border-b-2 capitalize transition-colors ${
                tab === t
                  ? 'border-[#f97316] text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'attachments'
                ? `Attachments${attachments.length ? ` (${attachments.length})` : ''}`
                : t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
              <div>
                <label className={labelCls}>Reference</label>
                <input
                  className={inputCls}
                  value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  className={selectCls}
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as VAStatus }))}
                  disabled={!canEdit}
                >
                  {VA_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Title <span className="text-red-400">*</span></label>
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Brief title for this variation"
                  disabled={!canEdit}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the scope of this variation…"
                  disabled={!canEdit}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Reason / Cause</label>
                <input
                  className={inputCls}
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Client instruction, design change, unforeseen condition…"
                  disabled={!canEdit}
                />
              </div>

              {/* Value + Direction */}
              <div>
                <label className={labelCls}>Value (£)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={inputCls}
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value.replace(/[^0-9.]/g, '') }))}
                  placeholder="0.00"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className={labelCls}>Direction</label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => canEdit && setForm(f => ({ ...f, isPositive: true }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      form.isPositive
                        ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300'
                        : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <TrendingUp size={13} /> Addition (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => canEdit && setForm(f => ({ ...f, isPositive: false }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      !form.isPositive
                        ? 'bg-red-900/30 border-red-700/40 text-red-300'
                        : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <TrendingDown size={13} /> Omission (-)
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Date Raised</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.dateRaised}
                  onChange={e => setForm(f => ({ ...f, dateRaised: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className={labelCls}>Date Agreed</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.dateAgreed}
                  onChange={e => setForm(f => ({ ...f, dateAgreed: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Internal notes, correspondence references, instructions…"
                  disabled={!canEdit}
                />
              </div>
              {item?.created_by && (
                <div className="md:col-span-2 text-xs text-slate-600">
                  Created by {item.created_by}{item.created_at ? ` · ${fmtDate(item.created_at)}` : ''}
                </div>
              )}
            </div>
          )}

          {tab === 'attachments' && (
            <div className="space-y-4">
              {mode === 'create' ? (
                <p className="text-sm text-slate-500 text-center py-8">Save the variation first, then attach files.</p>
              ) : (
                <>
                  <FileUploadComponent
                    files={pendingFiles}
                    onChange={setPendingFiles}
                    label="Drop files, photos or documents here"
                    maxFiles={20}
                  />
                  {pendingFiles.length > 0 && (
                    <button
                      onClick={async () => {
                        setUploading(true);
                        for (const f of pendingFiles) {
                          const att: DBAttachment = {
                            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            linked_type: 'variation_account',
                            linked_id: item!.id,
                            project_id: projectId,
                            project_name: '',
                            name: f.name, type: f.type, size: f.size,
                            category: f.type.startsWith('image/') ? 'Photo' : 'Document',
                            data_url: f.dataUrl ?? '',
                            uploaded_by: store.currentUser?.name ?? '',
                            created_at: new Date().toISOString(),
                          };
                          await store.addAttachment(att);
                        }
                        setPendingFiles([]);
                        setUploading(false);
                      }}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      {uploading ? 'Uploading…' : `Upload ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}`}
                    </button>
                  )}
                  {attachments.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {attachments.map(att => (
                        <AttachmentRow
                          key={att.id}
                          att={att}
                          onRemove={() => store.removeAttachment(att.id)}
                          fetchData={store.fetchAttachmentData}
                        />
                      ))}
                    </div>
                  )}
                  {attachments.length === 0 && pendingFiles.length === 0 && (
                    <div className="text-center py-8">
                      <Paperclip size={24} className="text-slate-700 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No attachments yet</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2d4a] shrink-0">
          <div>
            {mode === 'edit' && canDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete this variation?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 hover:bg-red-900/50 text-xs transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-400 hover:text-white">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1e2d4a] text-slate-500 hover:text-red-400 hover:border-red-800/50 text-xs transition-colors"
                >
                  <Trash2 size={13} /> Delete
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#1e2d4a] text-slate-400 hover:text-white text-sm transition-colors"
            >
              {canEdit ? 'Cancel' : 'Close'}
            </button>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-900/30 disabled:opacity-60"
              >
                <Save size={14} />
                {saving ? 'Saving…' : mode === 'create' ? 'Create Variation' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Statement row helper ─────────────────────────────────────────────────────

function StatRow({
  label, sub, value, valueClass, dividerAfter = false,
}: { label: string; sub: string; value: string; valueClass: string; dividerAfter?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${dividerAfter ? 'border-b border-[#1e2d4a]' : 'border-b border-[#1e2d4a]/40'}`}>
      <div>
        <span className="text-sm text-slate-300">{label}</span>
        <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

// ─── Main VariationAccount component ──────────────────────────────────────────

interface VariationAccountProps {
  project: Project | null;
  projects: Project[];
  orgId: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onProjectChange: (id: string) => void;
}

export default function VariationAccount({
  project, projects, orgId, canCreate, canEdit, canDelete, onProjectChange,
}: VariationAccountProps) {
  const store = useAppStore();

  const items = useMemo(
    () => store.variationAccountItems.filter(v => v.project_id === (project?.id ?? '')),
    [store.variationAccountItems, project?.id]
  );

  const metrics = useMemo(() => calcVAMetrics(items), [items]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DBVariationAccountItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showMetricsInfo, setShowMetricsInfo] = useState(false);

  const filtered = filterStatus ? items.filter(i => i.status === filterStatus) : items;

  const nextRef = useMemo(() => {
    if (items.length === 0) return 'VAR-001';
    const nums = items
      .map(i => parseInt(i.reference.replace(/[^0-9]/g, ''), 10))
      .filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `VAR-${String(max + 1).padStart(3, '0')}`;
  }, [items]);

  function openNew() {
    setSelectedItem(null);
    setDrawerOpen(true);
  }

  function openItem(item: DBVariationAccountItem) {
    setSelectedItem(item);
    setDrawerOpen(true);
  }

  function handleSaved(_v: DBVariationAccountItem) {
    setDrawerOpen(false);
    setSelectedItem(null);
  }

  function handleDeleted(_id: string) {
    setDrawerOpen(false);
    setSelectedItem(null);
  }

  if (!project) {
    return (
      <div className="py-16 text-center">
        <TrendingUp size={32} className="text-slate-700 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">No projects found — create a project first.</p>
      </div>
    );
  }

  const fmtSigned = (n: number) => {
    if (n === 0) return '—';
    return (n > 0 ? '+' : '') + fmtCurrency(Math.abs(n));
  };

  return (
    <div className="space-y-4">

      {/* Project selector */}
      {projects.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Project</span>
          <select
            value={project.id}
            onChange={e => onProjectChange(e.target.value)}
            className="bg-[#0d1628] border border-[#1e2d4a] text-slate-200 text-sm rounded-lg px-3 py-1.5 min-w-[240px] focus:outline-none focus:ring-1 focus:ring-[#f97316] focus:border-[#f97316] transition-colors"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Summary statement */}
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2d4a]">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Variation Account Summary</p>
            <p className="text-sm font-bold text-white mt-0.5">{project.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMetricsInfo(v => !v)}
              className="p-1.5 text-slate-600 hover:text-slate-400 transition-colors"
              title="How are these calculated?"
            >
              <Info size={14} />
            </button>
            {canCreate && (
              <button
                onClick={openNew}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#f97316] hover:bg-orange-400 text-white rounded-lg transition-colors"
              >
                <Plus size={13} /> New Variation
              </button>
            )}
          </div>
        </div>

        {showMetricsInfo && (
          <div className="px-5 py-3 bg-[#0d1628] border-b border-[#1e2d4a] text-xs text-slate-500 space-y-1">
            <p><span className="text-slate-400 font-medium">Variation Exposure</span> = all Submitted + Under Review + Agreed variations. Commercial risk position.</p>
            <p><span className="text-slate-400 font-medium">Agreed Variations</span> = Agreed + Paid only. Drives Adjusted Contract Sum.</p>
            <p><span className="text-slate-400 font-medium">Under Review</span> = variations currently in review. Subset of Variation Exposure.</p>
            <p><span className="text-slate-400 font-medium">Rejected Variations</span> = rejected / not agreed. Excluded from all other totals.</p>
          </div>
        )}

        <div className="px-5 py-3">
          <div className="space-y-0">
            <StatRow
              label="Variation Exposure"
              sub="Submitted + Under Review + Agreed"
              value={fmtSigned(metrics.exposure)}
              valueClass={metrics.exposure > 0 ? 'text-orange-300' : metrics.exposure < 0 ? 'text-red-400' : 'text-slate-500'}
              dividerAfter
            />
            <StatRow
              label="Agreed Variations"
              sub="Agreed + Paid"
              value={fmtSigned(metrics.agreed)}
              valueClass={metrics.agreed !== 0 ? 'text-emerald-400' : 'text-slate-500'}
            />
            <StatRow
              label="Under Review"
              sub="Currently in review"
              value={fmtSigned(metrics.underReview)}
              valueClass={metrics.underReview !== 0 ? 'text-amber-400' : 'text-slate-500'}
            />
            <StatRow
              label="Rejected Variations"
              sub="Not agreed — excluded from totals"
              value={metrics.rejected !== 0 ? fmtCurrency(Math.abs(metrics.rejected)) : '—'}
              valueClass="text-red-400/70"
            />
          </div>
        </div>
      </div>

      {/* Register table */}
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2d4a]">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Variations ({filtered.length}{filtered.length !== items.length ? ` of ${items.length}` : ''})
          </p>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-[#0d1628] border border-[#1e2d4a] text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#f97316] transition-colors"
          >
            <option value="">All statuses</option>
            {VA_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {items.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center mx-auto mb-4">
              <TrendingUp size={20} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-400 font-medium mb-1">No variations recorded</p>
            <p className="text-xs text-slate-600 mb-4 max-w-xs mx-auto">
              Add variations to track value movements against the contract sum.
            </p>
            {canCreate && (
              <button
                onClick={openNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-sm font-semibold transition-colors"
              >
                <Plus size={14} /> Add First Variation
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <AlertCircle size={20} className="text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No variations match this filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e2d4a] bg-[#0d1628]">
                  <th className="px-4 py-2.5 text-left text-slate-500 font-semibold w-24">Ref</th>
                  <th className="px-4 py-2.5 text-left text-slate-500 font-semibold">Title</th>
                  <th className="px-4 py-2.5 text-left text-slate-500 font-semibold w-32 hidden sm:table-cell">Reason</th>
                  <th className="px-4 py-2.5 text-right text-slate-500 font-semibold w-32">Value</th>
                  <th className="px-4 py-2.5 text-left text-slate-500 font-semibold w-32">Status</th>
                  <th className="px-4 py-2.5 text-left text-slate-500 font-semibold w-28 hidden md:table-cell">Date Raised</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const signedVal = item.is_positive ? item.value : -item.value;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => openItem(item)}
                      className="border-b border-[#1e2d4a]/50 hover:bg-[#1a2236] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-slate-400 text-xs">{item.reference}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-200 truncate max-w-[200px]">{item.title}</p>
                        {item.description && (
                          <p className="text-slate-600 truncate max-w-[200px] mt-0.5">{item.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[120px] hidden sm:table-cell">
                        {item.reason || '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        <span className={signedVal > 0 ? 'text-emerald-400' : signedVal < 0 ? 'text-red-400' : 'text-slate-500'}>
                          {signedVal !== 0 ? (signedVal > 0 ? '+' : '-') : ''}
                          {fmtCurrency(Math.abs(item.value))}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{fmtDate(item.date_raised)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <VariationDrawer
          mode={selectedItem ? 'edit' : 'create'}
          item={selectedItem}
          orgId={orgId}
          projectId={project.id}
          nextRef={nextRef}
          canEdit={selectedItem ? canEdit : canCreate}
          canDelete={canDelete}
          onClose={() => { setDrawerOpen(false); setSelectedItem(null); }}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
