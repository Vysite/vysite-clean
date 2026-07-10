import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Plus, X, Save, Trash2, Paperclip, Eye, Download, FileText, AlertCircle, TrendingUp, TrendingDown, Info, Printer, MessageSquare, HardHat, ChevronDown, Calculator, Copy, CreditCard as Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../lib/StoreContext';
import FileUploadComponent from '../../components/FileUpload';
import type { UploadedFile } from '../../components/FileUpload';
import type { DBVariationAccountItem, DBAttachment, DBVABuildUpLine, DBVAComment, DBNotification } from '../../lib/store';
import type { Project } from '../../data/types';
import { fmtCurrency, fmtDate, parseRawValue } from './types';
import { exportVariationAccountPDF, buildVAInternalHTML, buildVAClientHTML } from './CommercialPDF';
import { openPrintTab } from '../../lib/printTab';
import { RowActionsMenu } from '../../components/RowActionsMenu';

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

const LINE_TYPES = ['Labour', 'Materials', 'Plant', 'Subcontract', 'Preliminaries', 'Other'] as const;

function statusInfo(s: string) {
  return VA_STATUSES.find(x => x.value === s) ?? VA_STATUSES[0];
}

// Outstanding Variation Exposure: submitted + under_review only (agreed is no longer an exposure)
const EXPOSURE_STATUSES: VAStatus[] = ['submitted', 'under_review'];
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

function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

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

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = att.name ?? 'attachment';
    a.click();
  }

  const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0d1628] border border-[#1e2d4a] group">
        <FileText size={14} className="text-slate-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-300 truncate">{att.name}</p>
          {att.size != null && <p className="text-[10px] text-slate-600">{fmtSize(att.size)}</p>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isImage && (
            <button onClick={openPreview} disabled={loading} className="p-1.5 rounded hover:bg-[#1e2d4a] text-slate-400 hover:text-slate-200 transition-colors">
              <Eye size={13} />
            </button>
          )}
          <button onClick={handleDownload} disabled={!dataUrl} className="p-1.5 rounded hover:bg-[#1e2d4a] text-slate-400 hover:text-slate-200 transition-colors">
            <Download size={13} />
          </button>
          <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-900/30 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {previewing && dataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setPreviewing(false)}>
          <div className="relative max-w-3xl max-h-[80vh] p-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewing(false)} className="absolute -top-3 -right-3 p-1.5 rounded-full bg-[#1a2236] border border-[#1e2d4a] text-slate-400 hover:text-white">
              <X size={14} />
            </button>
            <img src={dataUrl} alt={att.name ?? ''} className="max-w-full max-h-[75vh] rounded-lg object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Build-up line form ───────────────────────────────────────────────────────

interface LineFormState {
  description: string;
  type: string;
  unit: string;
  quantity: string;
  cost_price: string;
  markup_pct: string;
}

function calcLine(f: LineFormState) {
  const qty   = parseFloat(f.quantity)   || 0;
  const cost  = parseFloat(f.cost_price) || 0;
  const mkup  = parseFloat(f.markup_pct) || 0;
  const salesPrice = cost * (1 + mkup / 100);
  const lineTotal  = salesPrice * qty;
  return { qty, cost, mkup, salesPrice, lineTotal };
}

const buThCls   = 'px-2 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap';
const buCellCls = 'px-2 py-2 align-middle';

function LineFormRow({
  form, onChange, onSave, onCancel,
}: { form: LineFormState; onChange: (f: LineFormState) => void; onSave: () => void; onCancel: () => void }) {
  const inCls = 'w-full bg-[#0a0f1e] border border-[#1e2d4a] rounded px-1.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#f97316]';
  const c = calcLine(form);
  return (
    <tr className="border-t border-[#1e2d4a]/50 bg-[#0d1e35]/60">
      <td className={buCellCls}></td>
      <td className={buCellCls}><input className={inCls} placeholder="Description" value={form.description} onChange={e => onChange({ ...form, description: e.target.value })} autoFocus /></td>
      <td className={buCellCls}>
        <select className={inCls} value={form.type} onChange={e => onChange({ ...form, type: e.target.value })}>
          {LINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className={buCellCls}><input className={inCls} placeholder="Unit" value={form.unit} onChange={e => onChange({ ...form, unit: e.target.value })} /></td>
      <td className={buCellCls}><input className={`${inCls} text-right`} placeholder="0" value={form.quantity} onChange={e => onChange({ ...form, quantity: e.target.value })} /></td>
      <td className={buCellCls}><input className={`${inCls} text-right`} placeholder="0.00" value={form.cost_price} onChange={e => onChange({ ...form, cost_price: e.target.value })} /></td>
      <td className={buCellCls}><input className={`${inCls} text-right`} placeholder="0" value={form.markup_pct} onChange={e => onChange({ ...form, markup_pct: e.target.value })} /></td>
      <td className={`${buCellCls} text-right tabular-nums text-slate-400`}>{fmtCurrency(c.salesPrice)}</td>
      <td className={`${buCellCls} text-right tabular-nums text-[#f97316] font-semibold`}>{fmtCurrency(c.lineTotal)}</td>
      <td className={buCellCls}>
        <div className="flex items-center gap-1">
          <button onClick={onSave} className="p-1 rounded bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/70 transition-colors"><Save size={12} /></button>
          <button onClick={onCancel} className="p-1 rounded bg-slate-700/40 text-slate-400 hover:bg-slate-700/70 transition-colors"><X size={12} /></button>
        </div>
      </td>
    </tr>
  );
}

// ─── Build-up table ───────────────────────────────────────────────────────────

function BuildUpTable({
  lines, vaItemId, orgId, projectId, canEdit, onAdd, onUpdate, onRemove,
}: {
  lines: DBVABuildUpLine[];
  vaItemId: string;
  orgId: string;
  projectId: string;
  canEdit: boolean;
  onAdd: (l: DBVABuildUpLine) => void;
  onUpdate: (l: DBVABuildUpLine) => void;
  onRemove: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [editForm, setEditForm] = useState<LineFormState>({ description: '', type: 'Labour', unit: '', quantity: '', cost_price: '', markup_pct: '' });
  const [newForm, setNewForm] = useState<LineFormState>({ description: '', type: 'Labour', unit: '', quantity: '', cost_price: '', markup_pct: '' });

  const buildUpTotal = lines.reduce((s, l) => s + (l.line_total ?? 0), 0);

  function startEdit(l: DBVABuildUpLine) {
    setEditingId(l.id);
    setEditForm({
      description: l.description,
      type: l.type,
      unit: l.unit,
      quantity: String(l.quantity),
      cost_price: String(l.cost_price),
      markup_pct: String(l.markup_pct),
    });
  }

  function saveEdit(l: DBVABuildUpLine) {
    const c = calcLine(editForm);
    onUpdate({
      ...l,
      description: editForm.description.trim(),
      type: editForm.type,
      unit: editForm.unit,
      quantity: c.qty,
      cost_price: c.cost,
      markup_pct: c.mkup,
      sales_price: c.salesPrice,
      line_total: c.lineTotal,
      updated_at: new Date().toISOString(),
    });
    setEditingId(null);
  }

  function saveNew() {
    if (!newForm.description.trim()) return;
    const c = calcLine(newForm);
    const nextLineNo = lines.length > 0 ? Math.max(...lines.map(l => l.line_no)) + 1 : 1;
    onAdd({ id: genId(), org_id: orgId, project_id: projectId, va_item_id: vaItemId, line_no: nextLineNo, description: newForm.description.trim(), type: newForm.type, unit: newForm.unit, quantity: c.qty, cost_price: c.cost, markup_pct: c.mkup, sales_price: c.salesPrice, line_total: c.lineTotal, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    setNewForm({ description: '', type: 'Labour', unit: '', quantity: '', cost_price: '', markup_pct: '' });
    setAddingNew(false);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-[#1e2d4a]">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-[#0d1628]">
            <tr>
              <th className={`${buThCls} w-8`}>No.</th>
              <th className={buThCls}>Description</th>
              <th className={buThCls}>Type</th>
              <th className={buThCls}>Unit</th>
              <th className={`${buThCls} text-right`}>Qty</th>
              <th className={`${buThCls} text-right`}>Cost</th>
              <th className={`${buThCls} text-right`}>Markup %</th>
              <th className={`${buThCls} text-right`}>Sales</th>
              <th className={`${buThCls} text-right`}>Total</th>
              {canEdit && <th className={`${buThCls} w-16`}></th>}
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              editingId === l.id ? (
                <LineFormRow
                  key={l.id}
                  form={editForm}
                  onChange={setEditForm}
                  onSave={() => saveEdit(l)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr key={l.id} className="border-t border-[#1e2d4a]/50 hover:bg-[#1a2236]/40 transition-colors">
                  <td className={`${buCellCls} text-slate-600 font-mono`}>{l.line_no}</td>
                  <td className={`${buCellCls} text-slate-200`}>{l.description}</td>
                  <td className={buCellCls}>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1e2d4a] text-slate-400 font-medium">
                      <HardHat size={10} />{l.type}
                    </span>
                  </td>
                  <td className={`${buCellCls} text-slate-500`}>{l.unit || '—'}</td>
                  <td className={`${buCellCls} text-right tabular-nums text-slate-300`}>{l.quantity}</td>
                  <td className={`${buCellCls} text-right tabular-nums text-slate-400`}>{fmtCurrency(l.cost_price)}</td>
                  <td className={`${buCellCls} text-right tabular-nums text-slate-400`}>{l.markup_pct}%</td>
                  <td className={`${buCellCls} text-right tabular-nums text-slate-400`}>{fmtCurrency(l.sales_price)}</td>
                  <td className={`${buCellCls} text-right tabular-nums text-sm font-semibold text-[#f97316]`}>{fmtCurrency(l.line_total)}</td>
                  {canEdit && (
                    <td className={buCellCls}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(l)}
                          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-[#1e2d4a] transition-colors"
                          title="Edit line"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => onRemove(l.id)}
                          className="p-1.5 rounded text-slate-300 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                          title="Delete line"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            ))}
            {addingNew && (
              <LineFormRow
                form={newForm}
                onChange={setNewForm}
                onSave={saveNew}
                onCancel={() => setAddingNew(false)}
              />
            )}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="border-t border-[#1e2d4a] bg-[#0d1628]">
                <td colSpan={canEdit ? 8 : 8} className="px-2 py-2.5 text-xs font-semibold text-slate-400 text-right">Build-Up Total</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-sm font-bold text-[#f97316]">{fmtCurrency(buildUpTotal)}</td>
                {canEdit && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {canEdit && !addingNew && !editingId && (
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[#1e2d4a] text-xs text-slate-500 hover:text-slate-300 hover:border-[#f97316]/50 transition-colors"
        >
          <Plus size={12} /> Add line
        </button>
      )}

      {lines.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0d1628] border border-[#1e2d4a]">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calculator size={12} />
            <span>{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="text-sm font-bold text-[#f97316] tabular-nums">
            Build-Up Total: {fmtCurrency(buildUpTotal)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Comments section ─────────────────────────────────────────────────────────

function CommentsSection({
  comments, vaItemId, orgId, projectId, canEdit, onAdd, onRemove, currentUserName,
}: {
  comments: DBVAComment[];
  vaItemId: string;
  orgId: string;
  projectId: string;
  canEdit: boolean;
  onAdd: (c: DBVAComment) => void;
  onRemove: (id: string) => void;
  currentUserName?: string | null;
}) {
  const [text, setText] = useState('');

  function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd({
      id: genId(),
      org_id: orgId,
      project_id: projectId,
      va_item_id: vaItemId,
      text: trimmed,
      author: currentUserName ?? 'Unknown',
      created_at: new Date().toISOString(),
    });
    setText('');
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 && (
        <p className="text-xs text-slate-600 py-4 text-center">No comments yet.</p>
      )}
      {comments.map(c => (
        <div key={c.id} className="flex gap-3 group">
          <div className="flex-1 rounded-lg bg-[#0d1628] border border-[#1e2d4a] px-3 py-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-slate-400">{c.author}</span>
              <span className="text-[10px] text-slate-600">{fmtDate(c.created_at)}</span>
            </div>
            <p className="text-xs text-slate-300 whitespace-pre-wrap">{c.text}</p>
          </div>
          {canEdit && (
            <button
              onClick={() => onRemove(c.id)}
              className="self-start p-1.5 rounded opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-all"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <div className="flex gap-2">
          <textarea
            className={`${inputCls} resize-none flex-1`}
            rows={2}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a comment…"
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd(); }}
          />
          <button
            onClick={handleAdd}
            disabled={!text.trim()}
            className="self-end px-3 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold disabled:opacity-40 hover:bg-[#ea6c0a] transition-colors"
          >
            Post
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Status select ────────────────────────────────────────────────────────────

function StatusSelect({ value, onChange, disabled }: { value: string; onChange: (v: VAStatus) => void; disabled?: boolean }) {
  const s = statusInfo(value);
  return (
    <select
      className={`${selectCls} ${s.color} border`}
      value={value}
      onChange={e => onChange(e.target.value as VAStatus)}
      disabled={disabled}
    >
      {VA_STATUSES.map(opt => (
        <option key={opt.value} value={opt.value} className="bg-[#1a2236] text-slate-200">{opt.label}</option>
      ))}
    </select>
  );
}

// ─── Variation drawer ─────────────────────────────────────────────────────────

type DrawerMode = 'create' | 'edit';
type DrawerTab = 'details' | 'build-up' | 'comments' | 'attachments';

interface VariationDrawerProps {
  mode: DrawerMode;
  item: DBVariationAccountItem | null;
  templateData?: DBVariationAccountItem | null;
  orgId: string;
  projectId: string;
  nextRef: string;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (v: DBVariationAccountItem) => void;
  onDeleted: (id: string) => void;
  onCrRecordCreated?: (crId: string, vaItem: DBVariationAccountItem) => void;
  onCrRecordDeleted?: (crId: string) => void;
}

function VariationDrawer({
  mode, item, templateData, orgId, projectId, nextRef, canEdit, canDelete,
  onClose, onSaved, onDeleted, onCrRecordCreated, onCrRecordDeleted,
}: VariationDrawerProps) {
  const store = useAppStore();

  const [tab, setTab] = useState<DrawerTab>('details');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const pdfMenuRef = useRef<HTMLDivElement>(null);
  // Pre-fetched attachment data_urls keyed by attachment id.
  // Populated by a background useEffect so export handlers can stay synchronous
  // (window.open must be called before any await or Chrome blocks the popup).
  const [attDataCache, setAttDataCache] = useState<Record<string, string>>({});

  // Stable ID: generated once at mount for new items, taken from existing item otherwise
  const [stableId] = useState<string>(() =>
    mode === 'create'
      ? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); })
      : (item?.id ?? '')
  );

  // Local accumulation for create mode
  const [localBuildUpLines, setLocalBuildUpLines] = useState<DBVABuildUpLine[]>([]);
  const [localComments, setLocalComments] = useState<DBVAComment[]>([]);

  const [form, setForm] = useState({
    reference:   item?.reference   ?? nextRef,
    title:       templateData ? templateData.title : (item?.title ?? ''),
    description: templateData ? templateData.description : (item?.description ?? ''),
    reason:      templateData ? templateData.reason : (item?.reason ?? ''),
    value:       (templateData?.value ?? item?.value) != null ? String(templateData?.value ?? item?.value) : '',
    isPositive:  templateData?.is_positive ?? item?.is_positive ?? true,
    status:      ((item?.status ?? 'draft')) as VAStatus,
    dateRaised:  item?.date_raised ?? new Date().toISOString().slice(0, 10),
    dateAgreed:  item?.date_agreed ?? '',
    notes:       item?.notes       ?? '',
  });

  const attachments = (store.attachments ?? []).filter(
    a => a.linked_type === 'variation_account' && a.linked_id === (item?.id ?? '')
  );

  // Stable key representing the current set of attachment IDs — drives the prefetch effect.
  const attachmentIds = useMemo(
    () => attachments.map(a => a.id).sort().join(','),
    [attachments]
  );

  // Prefetch attachment data_urls in the background so PDF export can be synchronous
  useEffect(() => {
    let cancelled = false;
    async function prefetch() {
      for (const att of attachments) {
        if (cancelled) return;
        if (attDataCache[att.id] || att.data_url) continue;
        try {
          const { data } = await supabase.from('vy_attachments').select('data_url').eq('id', att.id).single();
          if (!cancelled && data?.data_url) {
            setAttDataCache(prev => ({ ...prev, [att.id]: data.data_url }));
          }
        } catch { /* ignore */ }
      }
    }
    prefetch();
    return () => { cancelled = true; };
  }, [attachmentIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build-up lines: local state for create mode, store for edit mode
  const buildUpLines = mode === 'create'
    ? localBuildUpLines
    : (store.vaBuildUpLines ?? []).filter(l => l.va_item_id === (item?.id ?? ''));
  const buildUpTotal = buildUpLines.reduce((s, l) => s + (l.line_total ?? 0), 0);

  // Comments: local state for create mode, store for edit mode
  const comments = mode === 'create'
    ? localComments
    : (store.vaComments ?? []).filter(c => c.va_item_id === (item?.id ?? ''));

  // Handlers for local build-up lines in create mode
  const localAddLine = useCallback((l: DBVABuildUpLine) => {
    setLocalBuildUpLines(prev => [...prev, l].sort((a, b) => a.line_no - b.line_no));
  }, []);
  const localUpdateLine = useCallback((l: DBVABuildUpLine) => {
    setLocalBuildUpLines(prev => prev.map(x => x.id === l.id ? l : x));
  }, []);
  const localRemoveLine = useCallback((id: string) => {
    setLocalBuildUpLines(prev => prev.filter(l => l.id !== id));
  }, []);

  // Close PDF menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target as Node)) {
        setShowPdfMenu(false);
      }
    }
    if (showPdfMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPdfMenu]);

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    const valueNum = parseFloat(form.value.replace(/[£,\s]/g, ''));
    if (isNaN(valueNum) || valueNum < 0) { setError('Enter a valid positive number for Value'); return; }
    setSaving(true); setError(null);
    const now = new Date().toISOString();
    const row: DBVariationAccountItem = {
      id:          stableId,
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
        // Flush local build-up lines
        for (const l of localBuildUpLines) {
          await store.addVABuildUpLine(l);
        }
        // Flush local comments
        for (const c of localComments) {
          await store.addVAComment(c);
        }
        // Flush pending file attachments
        for (const f of pendingFiles) {
          await store.addAttachment({
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            linked_type: 'variation_account', linked_id: stableId,
            project_id: projectId, project_name: '',
            name: f.name, type: f.type, size: f.size,
            category: f.type.startsWith('image/') ? 'Photo' : 'Document',
            data_url: f.dataUrl ?? '', uploaded_by: store.currentUser?.name ?? '',
            created_at: now,
          });
        }
        // Create a matching Commercial Register entry so this variation appears in the CR
        const crId = genId();
        const { error: crErr } = await supabase.from('vy_commercial_records').insert({
          id: crId,
          org_id: orgId,
          project_id: projectId,
          record_type: 'variation',
          reference: row.reference,
          title: row.title,
          client: '',
          status: 'draft',
          date_raised: row.date_raised ?? null,
          notes: row.notes ?? '',
          extra_data: { va_item_id: stableId },
          created_at: now,
          updated_at: now,
        });
        if (!crErr) {
          onCrRecordCreated?.(crId, row);
        }
      } else {
        await store.updateVariationAccountItem(row);
        // Keep the CR entry title/reference in sync
        await supabase
          .from('vy_commercial_records')
          .update({ title: row.title, reference: row.reference, updated_at: now })
          .eq('org_id', orgId)
          .filter('extra_data->>va_item_id', 'eq', stableId);
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
    // Find and delete the linked Commercial Register entry (if any)
    try {
      const { data: crRows } = await supabase
        .from('vy_commercial_records')
        .select('id')
        .eq('org_id', orgId)
        .filter('extra_data->>va_item_id', 'eq', item.id);
      if (crRows && crRows.length > 0) {
        for (const cr of crRows) {
          await supabase.from('vy_commercial_records').delete().eq('id', cr.id);
          onCrRecordDeleted?.(cr.id);
        }
      }
      await store.removeVariationAccountItem(item.id);
      onDeleted(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setDeleting(false);
    }
  }

  async function handleExportPDF() {
    if (!item) return;
    setShowPdfMenu(false);
    const attsWithData = attachments.map(a => ({
      ...a,
      data_url: attDataCache[a.id] ?? a.data_url ?? '',
    }));
    const proj = store.projects.find(p => p.id === projectId) ?? null;
    await exportVariationAccountPDF({
      item, lines: buildUpLines, comments, attachments: attsWithData,
      buildUpTotal, logoUrl: store.settings?.logo_data_url, currentUserName: store.currentUser?.name,
      project: proj ? { name: proj.name, client: proj.client, projectManager: proj.projectManager, startDate: proj.startDate } : null,
    });
  }

  function handleExportInternal() {
    if (!item) return;
    setShowPdfMenu(false);
    const attsWithData = attachments.map(a => ({
      ...a,
      data_url: attDataCache[a.id] ?? a.data_url ?? '',
    }));
    const proj = store.projects.find(p => p.id === projectId) ?? null;
    openPrintTab(buildVAInternalHTML({
      item, lines: buildUpLines, comments, attachments: attsWithData,
      buildUpTotal, logoUrl: store.settings?.logo_data_url, currentUserName: store.currentUser?.name,
      project: proj ? { name: proj.name, client: proj.client, projectManager: proj.projectManager, startDate: proj.startDate } : null,
    }));
  }

  function handleExportClient() {
    if (!item) return;
    setShowPdfMenu(false);
    const attsWithData = attachments.map(a => ({
      ...a,
      data_url: attDataCache[a.id] ?? a.data_url ?? '',
    }));
    const proj = store.projects.find(p => p.id === projectId) ?? null;
    openPrintTab(buildVAClientHTML({
      item, lines: buildUpLines, attachments: attsWithData,
      buildUpTotal, logoUrl: store.settings?.logo_data_url, currentUserName: store.currentUser?.name,
      project: proj ? { name: proj.name, client: proj.client, projectManager: proj.projectManager, startDate: proj.startDate } : null,
    }));
  }

  const tabDefs: { key: DrawerTab; label: string; count?: number }[] = [
    { key: 'details', label: 'Details' },
    { key: 'build-up', label: 'Cost Build-Up', count: buildUpLines.length || undefined },
    { key: 'comments', label: 'Comments', count: comments.length || undefined },
    { key: 'attachments', label: 'Attachments', count: attachments.length + pendingFiles.length || undefined },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl bg-[#0d1628] border-l border-[#1e2d4a] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d4a] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#f97316]/10">
              <FileText size={16} className="text-[#f97316]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {mode === 'create' ? 'New Variation' : (item?.reference ?? 'Edit Variation')}
              </h2>
              {mode === 'edit' && item?.title && (
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">{item.title}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'edit' && item && (
              <div className="relative" ref={pdfMenuRef}>
                <button
                  onClick={() => setShowPdfMenu(v => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1e2d4a] text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                >
                  <Printer size={13} /> Export <ChevronDown size={11} />
                </button>
                {showPdfMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-[#1e2d4a] bg-[#0d1628] shadow-xl z-10 overflow-hidden">
                    <button onClick={handleExportPDF} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-[#1a2236] transition-colors flex items-center gap-2">
                      <FileText size={12} /> Export PDF
                    </button>
                    <button onClick={handleExportInternal} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-[#1a2236] transition-colors flex items-center gap-2">
                      <Info size={12} /> Internal Report
                    </button>
                    <button onClick={handleExportClient} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-[#1a2236] transition-colors flex items-center gap-2">
                      <Copy size={12} /> Client Report
                    </button>
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1a2236] transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2d4a] shrink-0 px-5 gap-1">
          {tabDefs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${tab === t.key ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              {t.label}
              {t.count != null && (
                <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold ${tab === t.key ? 'bg-[#f97316]/20 text-[#f97316]' : 'bg-slate-700/60 text-slate-500'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-800/50 text-xs text-red-300 mb-4">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* ── Details ── */}
          {tab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div>
                  <label className={labelCls}>Reference</label>
                  <input className={inputCls} value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} disabled={!canEdit} />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={selectCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as VAStatus }))} disabled={!canEdit}>
                    {VA_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Title <span className="text-red-400">*</span></label>
                  <input className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief title for this variation" disabled={!canEdit} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Description</label>
                  <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the scope of this variation…" disabled={!canEdit} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Reason / Cause</label>
                  <input className={inputCls} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Client instruction, design change, unforeseen condition…" disabled={!canEdit} />
                </div>

                {/* Value + Direction */}
                <div>
                  <label className={labelCls}>Value (£)</label>
                  <input type="text" inputMode="numeric" className={inputCls} value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="0.00" disabled={!canEdit} />
                </div>
                <div>
                  <label className={labelCls}>Direction</label>
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => canEdit && setForm(f => ({ ...f, isPositive: true }))} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${form.isPositive ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300' : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:text-slate-300'}`}>
                      <TrendingUp size={13} /> Addition
                    </button>
                    <button type="button" onClick={() => canEdit && setForm(f => ({ ...f, isPositive: false }))} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${!form.isPositive ? 'bg-red-900/40 border-red-700/50 text-red-300' : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:text-slate-300'}`}>
                      <TrendingDown size={13} /> Omission
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Date Raised</label>
                  <input type="date" className={inputCls} value={form.dateRaised} onChange={e => setForm(f => ({ ...f, dateRaised: e.target.value }))} disabled={!canEdit} />
                </div>
                <div>
                  <label className={labelCls}>Date Agreed</label>
                  <input type="date" className={inputCls} value={form.dateAgreed} onChange={e => setForm(f => ({ ...f, dateAgreed: e.target.value }))} disabled={!canEdit} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Notes</label>
                  <textarea className={`${inputCls} resize-none`} rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes, correspondence references, instructions…" disabled={!canEdit} />
                </div>
                {item?.created_by && (
                  <div className="md:col-span-2 text-xs text-slate-600">
                    Created by {item.created_by}{item.created_at ? ` · ${fmtDate(item.created_at)}` : ''}
                  </div>
                )}
              </div>

              {/* Build-Up Total callout when lines exist */}
              {buildUpLines.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#0d1628] border border-[#1e2d4a] mt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calculator size={13} />
                    <span>Cost Build-Up Total ({buildUpLines.length} line{buildUpLines.length !== 1 ? 's' : ''})</span>
                  </div>
                  <span className="text-sm font-bold text-[#f97316] tabular-nums">{fmtCurrency(buildUpTotal)}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Cost Build-Up ── */}
          {tab === 'build-up' && (
            <div>
              <BuildUpTable
                lines={buildUpLines}
                vaItemId={stableId}
                orgId={orgId}
                projectId={projectId}
                canEdit={canEdit}
                onAdd={mode === 'create' ? localAddLine : store.addVABuildUpLine}
                onUpdate={mode === 'create' ? localUpdateLine : store.updateVABuildUpLine}
                onRemove={mode === 'create' ? localRemoveLine : store.removeVABuildUpLine}
              />
            </div>
          )}

          {/* ── Comments ── */}
          {tab === 'comments' && (
            <div>
              <CommentsSection
                comments={comments}
                vaItemId={stableId}
                orgId={orgId}
                projectId={projectId}
                canEdit={canEdit}
                onAdd={mode === 'create'
                  ? (c: DBVAComment) => setLocalComments(prev => [...prev, c])
                  : store.addVAComment}
                onRemove={mode === 'create'
                  ? (id: string) => setLocalComments(prev => prev.filter(c => c.id !== id))
                  : store.removeVAComment}
                currentUserName={store.currentUser?.name}
              />
            </div>
          )}

          {/* ── Attachments ── */}
          {tab === 'attachments' && (
            <div className="space-y-3">
              {attachments.map(att => (
                <AttachmentRow
                  key={att.id}
                  att={att}
                  onRemove={() => store.removeAttachment(att.id)}
                  fetchData={async (id) => {
                    const { data } = await supabase.from('vy_attachments').select('data_url').eq('id', id).single();
                    return data?.data_url ?? '';
                  }}
                />
              ))}
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0d1628] border border-dashed border-[#1e2d4a]">
                  <Paperclip size={14} className="text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-400 flex-1 truncate">{f.name}</span>
                  <span className="text-[10px] text-amber-400">pending save</span>
                  <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
              {canEdit && (
                <FileUploadComponent
                  files={[]}
                  onChange={files => setPendingFiles(prev => [...prev, ...files])}
                  label="Upload attachment"
                  uploading={uploading}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1e2d4a] flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-2">
            {canDelete && mode === 'edit' && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-800/40 text-xs text-red-400 hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Delete this variation?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-500 disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Confirm'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded border border-[#1e2d4a] text-xs text-slate-400 hover:text-slate-200 transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#1e2d4a] text-xs text-slate-400 hover:text-slate-200 transition-colors">
              {canEdit ? 'Cancel' : 'Close'}
            </button>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea6c0a] disabled:opacity-50 transition-colors"
              >
                <Save size={13} /> {saving ? 'Saving…' : (mode === 'create' ? 'Create' : 'Save')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main VariationAccount page ───────────────────────────────────────────────

interface VariationAccountProps {
  project: Project;
  orgId: string;
  canEdit: boolean;
  canDelete: boolean;
}

export function VariationAccount({ project, orgId, canEdit, canDelete }: VariationAccountProps) {
  const store = useAppStore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [selectedItem, setSelectedItem] = useState<DBVariationAccountItem | null>(null);
  const [templateData, setTemplateData] = useState<DBVariationAccountItem | null>(null);

  const items = (store.variationAccountItems ?? []).filter(i => i.project_id === project.id);

  const nextRef = useMemo(() => {
    const nums = items.map(i => {
      const m = i.reference?.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `VAR-${String(next).padStart(3, '0')}`;
  }, [items]);

  const { exposure, agreed, rejected } = calcVAMetrics(items);

  function openCreate() {
    setDrawerMode('create');
    setSelectedItem(null);
    setTemplateData(null);
    setDrawerOpen(true);
  }

  function openEdit(item: DBVariationAccountItem) {
    setDrawerMode('edit');
    setSelectedItem(item);
    setTemplateData(null);
    setDrawerOpen(true);
  }

  function openDuplicate(item: DBVariationAccountItem) {
    setDrawerMode('create');
    setSelectedItem(null);
    setTemplateData(item);
    setDrawerOpen(true);
  }

  function handleSaved(v: DBVariationAccountItem) {
    setDrawerOpen(false);
    setSelectedItem(null);
  }

  function handleDeleted(id: string) {
    setDrawerOpen(false);
    setSelectedItem(null);
  }

  const thCls = 'px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap';
  const tdCls = 'px-3 py-2.5 align-middle';

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-[#0d1628] border border-[#1e2d4a] px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Exposure</p>
          <p className={`text-lg font-bold tabular-nums ${exposure >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{fmtCurrency(Math.abs(exposure))}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">submitted + under review</p>
        </div>
        <div className="rounded-lg bg-[#0d1628] border border-[#1e2d4a] px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Agreed</p>
          <p className={`text-lg font-bold tabular-nums ${agreed >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCurrency(Math.abs(agreed))}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">agreed + paid</p>
        </div>
        <div className="rounded-lg bg-[#0d1628] border border-[#1e2d4a] px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Rejected</p>
          <p className="text-lg font-bold tabular-nums text-red-400">{fmtCurrency(Math.abs(rejected))}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">rejected variations</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{items.length} variation{items.length !== 1 ? 's' : ''}</p>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea6c0a] transition-colors"
          >
            <Plus size={13} /> Add Variation
          </button>
        )}
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed border-[#1e2d4a] text-center">
          <FileText size={24} className="text-slate-600 mb-2" />
          <p className="text-sm text-slate-500">No variations recorded</p>
          {canEdit && <p className="text-xs text-slate-600 mt-1">Click "Add Variation" to get started</p>}
        </div>
      ) : (
        <div className="rounded-lg border border-[#1e2d4a] overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[#0d1628]">
              <tr>
                <th className={thCls}>Ref</th>
                <th className={thCls}>Title</th>
                <th className={thCls}>Status</th>
                <th className={`${thCls} text-right`}>Value</th>
                <th className={thCls}>Direction</th>
                <th className={thCls}>Date Raised</th>
                {(canEdit || canDelete) && <th className={`${thCls} w-10`}></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`border-t border-[#1e2d4a]/50 hover:bg-[#1a2236]/40 cursor-pointer transition-colors ${idx % 2 === 0 ? '' : 'bg-[#0a0f1e]/20'}`}
                  onClick={() => openEdit(item)}
                >
                  <td className={`${tdCls} font-mono text-slate-400`}>{item.reference}</td>
                  <td className={`${tdCls} text-slate-200 max-w-[200px] truncate`}>{item.title}</td>
                  <td className={tdCls}><StatusBadge status={item.status} /></td>
                  <td className={`${tdCls} text-right tabular-nums font-semibold ${item.is_positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.is_positive ? '+' : '−'}{fmtCurrency(item.value)}
                  </td>
                  <td className={tdCls}>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${item.is_positive ? 'text-emerald-500' : 'text-red-500'}`}>
                      {item.is_positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {item.is_positive ? 'Addition' : 'Omission'}
                    </span>
                  </td>
                  <td className={`${tdCls} text-slate-500`}>{item.date_raised ? fmtDate(item.date_raised) : '—'}</td>
                  {(canEdit || canDelete) && (
                    <td className={tdCls} onClick={e => e.stopPropagation()}>
                      <RowActionsMenu
                        actions={[
                          ...(canEdit ? [{ label: 'Edit', icon: Edit2, onClick: () => openEdit(item) }] : []),
                          ...(canEdit ? [{ label: 'Duplicate', icon: Copy, onClick: () => openDuplicate(item) }] : []),
                          ...(canDelete ? [{
                            label: 'Delete', icon: Trash2, danger: true, dividerBefore: true,
                            onClick: async () => {
                              if (!confirm(`Delete ${item.reference}?`)) return;
                              const { data: crRows } = await supabase
                                .from('vy_commercial_records')
                                .select('id')
                                .eq('org_id', orgId)
                                .filter('extra_data->>va_item_id', 'eq', item.id);
                              if (crRows) {
                                for (const cr of crRows) {
                                  await supabase.from('vy_commercial_records').delete().eq('id', cr.id);
                                }
                              }
                              await store.removeVariationAccountItem(item.id);
                            },
                          }] : []),
                        ]}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <VariationDrawer
          mode={drawerMode}
          item={selectedItem}
          templateData={templateData}
          orgId={orgId}
          projectId={project.id}
          nextRef={nextRef}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => { setDrawerOpen(false); setSelectedItem(null); }}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

export default VariationAccount;
