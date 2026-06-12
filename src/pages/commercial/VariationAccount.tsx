import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus, X, Save, Trash2,
  Paperclip, Eye, Download, FileText, AlertCircle,
  TrendingUp, TrendingDown, Info, Printer,
  MessageSquare, HardHat, ChevronDown, Calculator,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../lib/StoreContext';
import FileUploadComponent from '../../components/FileUpload';
import type { UploadedFile } from '../../components/FileUpload';
import type { DBVariationAccountItem, DBAttachment, DBVABuildUpLine, DBVAComment, DBNotification } from '../../lib/store';
import type { Project } from '../../data/types';
import { fmtCurrency, fmtDate, parseRawValue } from './types';
import { exportVariationAccountPDF, exportVAInternalPDF, exportVAClientPDF } from './CommercialPDF';

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

// ─── Cost Build-Up line editor ────────────────────────────────────────────────

interface LineFormState {
  description: string;
  type: string;
  unit: string;
  quantity: string;
  cost_price: string;
  markup_pct: string;
}

function calcLine(f: LineFormState) {
  const qty  = parseFloat(f.quantity)   || 0;
  const cost = parseFloat(f.cost_price) || 0;
  const mkup = parseFloat(f.markup_pct) || 0;
  const costTotal  = qty * cost;
  const salesPrice = cost * (1 + mkup / 100);
  const lineTotal  = qty * salesPrice;
  return { qty, cost, mkup, costTotal, salesPrice, lineTotal };
}

function BuildUpTable({
  lines, vaItemId, orgId, projectId, canEdit,
  onAdd, onUpdate, onRemove,
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
    onUpdate({ ...l, description: editForm.description, type: editForm.type, unit: editForm.unit, quantity: c.qty, cost_price: c.cost, markup_pct: c.mkup, sales_price: c.salesPrice, line_total: c.lineTotal, updated_at: new Date().toISOString() });
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

  const cellCls = 'px-2 py-2 text-xs';
  const thCls   = 'px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500';
  const numIn   = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded px-1.5 py-1 text-xs text-white text-right placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#f97316]';
  const txtIn   = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded px-1.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#f97316]';
  const selIn   = `${txtIn} appearance-none cursor-pointer`;

  function LineFormRow({ form, onChange, onSave, onCancel }: { form: LineFormState; onChange: (f: LineFormState) => void; onSave: () => void; onCancel: () => void }) {
    const c = calcLine(form);
    return (
      <tr className="bg-[#1a2236]">
        <td className={cellCls}></td>
        <td className={cellCls} style={{ minWidth: 140 }}>
          <input className={txtIn} value={form.description} onChange={e => onChange({ ...form, description: e.target.value })} placeholder="Description" autoFocus />
        </td>
        <td className={cellCls} style={{ minWidth: 110 }}>
          <select className={selIn} value={form.type} onChange={e => onChange({ ...form, type: e.target.value })}>
            {LINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </td>
        <td className={cellCls} style={{ minWidth: 60 }}>
          <input className={numIn} value={form.unit} onChange={e => onChange({ ...form, unit: e.target.value })} placeholder="nr" />
        </td>
        <td className={cellCls} style={{ minWidth: 70 }}>
          <input className={numIn} type="text" inputMode="decimal" value={form.quantity} onChange={e => onChange({ ...form, quantity: e.target.value })} placeholder="0" />
        </td>
        <td className={cellCls} style={{ minWidth: 80 }}>
          <input className={numIn} type="text" inputMode="decimal" value={form.cost_price} onChange={e => onChange({ ...form, cost_price: e.target.value })} placeholder="0.00" />
        </td>
        <td className={cellCls} style={{ minWidth: 70 }}>
          <input className={numIn} type="text" inputMode="decimal" value={form.markup_pct} onChange={e => onChange({ ...form, markup_pct: e.target.value })} placeholder="0" />
        </td>
        <td className={`${cellCls} text-right tabular-nums text-slate-400`}>{fmtCurrency(c.salesPrice)}</td>
        <td className={`${cellCls} text-right tabular-nums font-semibold text-white`}>{fmtCurrency(c.lineTotal)}</td>
        <td className={cellCls}>
          <div className="flex items-center gap-1">
            <button onClick={onSave} className="p-1 rounded bg-[#f97316] hover:bg-orange-400 text-white transition-colors"><Save size={12} /></button>
            <button onClick={onCancel} className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors"><X size={12} /></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-[#1e2d4a]">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-[#0d1628]">
            <tr>
              <th className={`${thCls} w-8`}>No.</th>
              <th className={thCls}>Description</th>
              <th className={thCls}>Type</th>
              <th className={thCls}>Unit</th>
              <th className={`${thCls} text-right`}>Qty</th>
              <th className={`${thCls} text-right`}>Cost</th>
              <th className={`${thCls} text-right`}>Markup %</th>
              <th className={`${thCls} text-right`}>Sales</th>
              <th className={`${thCls} text-right`}>Total</th>
              {canEdit && <th className={`${thCls} w-16`}></th>}
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
                  <td className={`${cellCls} text-slate-600 font-mono`}>{l.line_no}</td>
                  <td className={`${cellCls} text-slate-200`}>{l.description}</td>
                  <td className={cellCls}>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1e2d4a] text-slate-400 font-medium">
                      <HardHat size={10} />{l.type}
                    </span>
                  </td>
                  <td className={`${cellCls} text-slate-500`}>{l.unit || '—'}</td>
                  <td className={`${cellCls} text-right tabular-nums text-slate-300`}>{l.quantity}</td>
                  <td className={`${cellCls} text-right tabular-nums text-slate-400`}>{fmtCurrency(l.cost_price)}</td>
                  <td className={`${cellCls} text-right tabular-nums text-slate-400`}>{l.markup_pct}%</td>
                  <td className={`${cellCls} text-right tabular-nums text-slate-300`}>{fmtCurrency(l.sales_price)}</td>
                  <td className={`${cellCls} text-right tabular-nums font-semibold text-white`}>{fmtCurrency(l.line_total)}</td>
                  {canEdit && (
                    <td className={cellCls}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={() => startEdit(l)} className="p-1 rounded text-slate-500 hover:text-[#f97316] hover:bg-[#1e2d4a] transition-colors" title="Edit">
                          <Save size={12} />
                        </button>
                        <button onClick={() => onRemove(l.id)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-[#1e2d4a] transition-colors" title="Delete">
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
            {lines.length === 0 && !addingNew && (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="px-4 py-8 text-center text-xs text-slate-600">
                  No cost lines yet — click Add Line to build up the variation cost.
                </td>
              </tr>
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[#1e2d4a] hover:border-[#f97316]/50 text-slate-500 hover:text-[#f97316] text-xs font-medium transition-colors"
        >
          <Plus size={12} /> Add Line
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
  comments, vaItemId, orgId, projectId, currentUser, platformUsers, canAdd,
  onAdd, onRemove, onNotify,
}: {
  comments: DBVAComment[];
  vaItemId: string;
  orgId: string;
  projectId: string;
  currentUser: { id?: string; name?: string; auth_user_id?: string } | null;
  platformUsers: { id: string; name: string; auth_user_id?: string }[];
  canAdd: boolean;
  onAdd: (c: DBVAComment) => void;
  onRemove: (id: string) => void;
  onNotify: (n: DBNotification) => void;
}) {
  const [body, setBody] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionPos, setMentionPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionMatches = useMemo(() => {
    if (!mentionQuery) return platformUsers.slice(0, 6);
    return platformUsers.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);
  }, [mentionQuery, platformUsers]);

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setBody(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionOpen(true);
      setMentionPos(cursor - atMatch[0].length);
    } else {
      setMentionOpen(false);
    }
  }

  function insertMention(name: string) {
    const before = body.slice(0, mentionPos);
    const after = body.slice(textareaRef.current?.selectionStart ?? body.length);
    const newBody = before + `@${name} ` + after;
    setBody(newBody);
    setMentionOpen(false);
    setMentionQuery('');
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function extractMentions(text: string): string[] {
    const matches = text.match(/@([\w\s]+?)(?=\s|$|[,.])/g) ?? [];
    return matches.map(m => m.slice(1).trim()).filter(Boolean);
  }

  function handleSubmit() {
    if (!body.trim()) return;
    const comment: DBVAComment = {
      id: genId(),
      org_id: orgId,
      project_id: projectId,
      va_item_id: vaItemId,
      body: body.trim(),
      author_name: currentUser?.name ?? 'Unknown',
      author_id: currentUser?.auth_user_id ?? currentUser?.id ?? '',
      created_at: new Date().toISOString(),
    };
    onAdd(comment);

    // Fire notifications for @mentions
    const mentioned = extractMentions(body.trim());
    for (const name of mentioned) {
      const recipient = platformUsers.find(u => u.name === name);
      if (recipient && recipient.auth_user_id) {
        const notif: DBNotification = {
          id: genId(),
          recipient_id: recipient.auth_user_id,
          type: 'mention',
          title: `${currentUser?.name ?? 'Someone'} mentioned you`,
          body: body.trim().slice(0, 120),
          linked_type: 'variation_account',
          linked_id: vaItemId,
          project_id: projectId,
          project_name: '',
          read: false,
          created_at: new Date().toISOString(),
        };
        onNotify(notif);
      }
    }
    setBody('');
    setMentionOpen(false);
  }

  function fmtTs(ts: string | undefined) {
    if (!ts) return '';
    return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare size={20} className="text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No comments yet</p>
          <p className="text-xs text-slate-600 mt-1">Use @name to mention a team member</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className="group flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#1e2d4a] flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-[#f97316]">{(c.author_name || 'U')[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-white">{c.author_name}</span>
                  <span className="text-[10px] text-slate-600">{fmtTs(c.created_at)}</span>
                </div>
                <p className="text-sm text-slate-300 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                  {c.body.split(/(@[\w\s]+?)(?=\s|$|[,.])/g).map((part, i) =>
                    part.startsWith('@')
                      ? <span key={i} className="text-[#f97316] font-medium">{part}</span>
                      : <span key={i}>{part}</span>
                  )}
                </p>
              </div>
              {currentUser?.auth_user_id === c.author_id && (
                <button
                  onClick={() => onRemove(c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-600 hover:text-red-400 hover:bg-[#1e2d4a] transition-all shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div className="relative">
          <textarea
            ref={textareaRef}
            className={`${inputCls} resize-none text-sm`}
            rows={3}
            value={body}
            onChange={handleBodyChange}
            placeholder="Add a comment… Use @name to mention a team member"
          />
          {mentionOpen && mentionMatches.length > 0 && (
            <div className="absolute bottom-full mb-1 left-0 bg-[#1a2236] border border-[#1e2d4a] rounded-lg shadow-xl overflow-hidden z-10 min-w-[180px]">
              {mentionMatches.map(u => (
                <button
                  key={u.id}
                  onClick={() => insertMention(u.name)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-200 hover:bg-[#1e2d4a] transition-colors text-left"
                >
                  <div className="w-5 h-5 rounded-full bg-[#f97316]/20 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-[#f97316]">{u.name[0].toUpperCase()}</span>
                  </div>
                  {u.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSubmit}
              disabled={!body.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <MessageSquare size={12} /> Post Comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Variation drawer ─────────────────────────────────────────────────────────

type DrawerMode = 'create' | 'edit';
type DrawerTab = 'details' | 'build-up' | 'comments' | 'attachments';

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
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const pdfMenuRef = useRef<HTMLDivElement>(null);

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

  const buildUpLines = (store.vaBuildUpLines ?? []).filter(l => l.va_item_id === (item?.id ?? ''));
  const buildUpTotal = buildUpLines.reduce((s, l) => s + (l.line_total ?? 0), 0);

  const comments = (store.vaComments ?? []).filter(c => c.va_item_id === (item?.id ?? ''));

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
      id:          item?.id ?? genId(),
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

  function handleExportInternal() {
    if (!item) return;
    setShowPdfMenu(false);
    exportVAInternalPDF({
      item,
      lines: buildUpLines,
      comments,
      attachments,
      buildUpTotal,
    });
  }

  function handleExportClient() {
    if (!item) return;
    setShowPdfMenu(false);
    exportVAClientPDF({
      item,
      lines: buildUpLines,
      buildUpTotal,
    });
  }

  const tabDefs: { key: DrawerTab; label: string; count?: number }[] = [
    { key: 'details', label: 'Details' },
    { key: 'build-up', label: 'Cost Build-Up', count: buildUpLines.length || undefined },
    { key: 'comments', label: 'Comments', count: comments.length || undefined },
    { key: 'attachments', label: 'Attachments', count: attachments.length || undefined },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-t-2xl md:rounded-2xl w-full md:max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">

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
          <div className="flex items-center gap-2">
            {mode === 'edit' && item && (
              <div className="relative" ref={pdfMenuRef}>
                <button
                  onClick={() => setShowPdfMenu(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e2d4a] text-slate-400 hover:text-white hover:border-slate-600 text-xs font-medium transition-colors"
                >
                  <Printer size={12} /> Export <ChevronDown size={10} className={`transition-transform ${showPdfMenu ? 'rotate-180' : ''}`} />
                </button>
                {showPdfMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg shadow-xl z-20 min-w-[180px] overflow-hidden">
                    <button
                      onClick={handleExportInternal}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-slate-200 hover:bg-[#1e2d4a] transition-colors text-left"
                    >
                      <FileText size={12} className="text-[#f97316]" /> Internal PDF
                    </button>
                    <button
                      onClick={handleExportClient}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-slate-200 hover:bg-[#1e2d4a] transition-colors text-left"
                    >
                      <FileText size={12} className="text-sky-400" /> Client PDF
                    </button>
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-[#1e2d4a] rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2d4a] px-6 shrink-0 overflow-x-auto">
          {tabDefs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                tab === t.key
                  ? 'border-[#f97316] text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#1e2d4a] text-slate-400 text-[10px] font-semibold">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

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
                      <TrendingUp size={13} /> Addition (+)
                    </button>
                    <button type="button" onClick={() => canEdit && setForm(f => ({ ...f, isPositive: false }))} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${!form.isPositive ? 'bg-red-900/30 border-red-700/40 text-red-300' : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:text-slate-300'}`}>
                      <TrendingDown size={13} /> Omission (-)
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
              {mode === 'create' ? (
                <p className="text-sm text-slate-500 text-center py-8">Save the variation first, then add cost build-up lines.</p>
              ) : (
                <BuildUpTable
                  lines={buildUpLines}
                  vaItemId={item!.id}
                  orgId={orgId}
                  projectId={projectId}
                  canEdit={canEdit}
                  onAdd={store.addVABuildUpLine}
                  onUpdate={store.updateVABuildUpLine}
                  onRemove={store.removeVABuildUpLine}
                />
              )}
            </div>
          )}

          {/* ── Comments ── */}
          {tab === 'comments' && (
            <div>
              {mode === 'create' ? (
                <p className="text-sm text-slate-500 text-center py-8">Save the variation first, then add comments.</p>
              ) : (
                <CommentsSection
                  comments={comments}
                  vaItemId={item!.id}
                  orgId={orgId}
                  projectId={projectId}
                  currentUser={store.currentUser}
                  platformUsers={store.platformUsers}
                  canAdd={canEdit}
                  onAdd={store.addVAComment}
                  onRemove={store.removeVAComment}
                  onNotify={store.addNotification}
                />
              )}
            </div>
          )}

          {/* ── Attachments ── */}
          {tab === 'attachments' && (
            <div className="space-y-4">
              {mode === 'create' ? (
                <p className="text-sm text-slate-500 text-center py-8">Save the variation first, then attach files.</p>
              ) : (
                <>
                  <FileUploadComponent files={pendingFiles} onChange={setPendingFiles} label="Drop files, photos or documents here" maxFiles={20} />
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
                        <AttachmentRow key={att.id} att={att} onRemove={() => store.removeAttachment(att.id)} fetchData={store.fetchAttachmentData} />
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
                  <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 hover:bg-red-900/50 text-xs transition-colors">
                    {deleting ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-400 hover:text-white">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1e2d4a] text-slate-500 hover:text-red-400 hover:border-red-800/50 text-xs transition-colors">
                  <Trash2 size={13} /> Delete
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#1e2d4a] text-slate-400 hover:text-white text-sm transition-colors">
              {canEdit ? 'Cancel' : 'Close'}
            </button>
            {canEdit && tab === 'details' && (
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-900/30 disabled:opacity-60">
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
  currentUserName?: string;
  onProjectChange: (id: string) => void;
}

export default function VariationAccount({
  project, projects, orgId, canCreate, canEdit, canDelete, currentUserName, onProjectChange,
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
            <button onClick={() => setShowMetricsInfo(v => !v)} className="p-1.5 text-slate-600 hover:text-slate-400 transition-colors" title="How are these calculated?">
              <Info size={14} />
            </button>
            <button
              onClick={() => {
                if (!project) return;
                const contractNum = project.value ? parseRawValue(project.value) : 0;
                exportVariationAccountPDF({
                  project, items,
                  forecastContractSum: contractNum + metrics.exposure,
                  adjustedContractSum: contractNum + metrics.agreed,
                  vaExposure: metrics.exposure,
                  vaAgreed: metrics.agreed,
                  currentUserName: currentUserName || '',
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-slate-600 rounded-lg transition-colors"
              title="Export Variation Account PDF"
            >
              <Printer size={13} /> Export PDF
            </button>
            {canCreate && (
              <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#f97316] hover:bg-orange-400 text-white rounded-lg transition-colors">
                <Plus size={13} /> New Variation
              </button>
            )}
          </div>
        </div>

        {showMetricsInfo && (
          <div className="px-5 py-3 bg-[#0d1628] border-b border-[#1e2d4a] text-xs text-slate-500 space-y-1">
            <p><span className="text-slate-400 font-medium">Outstanding Variation Exposure</span> = Submitted + Under Review only. Commercial risk not yet agreed.</p>
            <p><span className="text-slate-400 font-medium">Agreed Variations</span> = Agreed + Paid only. Drives Adjusted Contract Sum.</p>
            <p><span className="text-slate-400 font-medium">Under Review</span> = variations currently in review. Subset of Outstanding Variation Exposure.</p>
            <p><span className="text-slate-400 font-medium">Rejected Variations</span> = rejected / not agreed. Excluded from all other totals.</p>
          </div>
        )}

        <div className="px-5 py-3">
          <div className="space-y-0">
            <StatRow label="Outstanding Variation Exposure" sub="Submitted + Under Review" value={fmtSigned(metrics.exposure)} valueClass={metrics.exposure > 0 ? 'text-orange-300' : metrics.exposure < 0 ? 'text-red-400' : 'text-slate-500'} dividerAfter />
            <StatRow label="Agreed Variations" sub="Agreed + Paid" value={fmtSigned(metrics.agreed)} valueClass={metrics.agreed !== 0 ? 'text-emerald-400' : 'text-slate-500'} />
            <StatRow label="Under Review" sub="Currently in review" value={fmtSigned(metrics.underReview)} valueClass={metrics.underReview !== 0 ? 'text-amber-400' : 'text-slate-500'} />
            <StatRow label="Rejected Variations" sub="Not agreed — excluded from totals" value={metrics.rejected !== 0 ? fmtCurrency(Math.abs(metrics.rejected)) : '—'} valueClass="text-red-400/70" />
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
            <p className="text-xs text-slate-600 mb-4 max-w-xs mx-auto">Add variations to track value movements against the contract sum.</p>
            {canCreate && (
              <button onClick={openNew} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-sm font-semibold transition-colors">
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
                  const lineCount = (store.vaBuildUpLines ?? []).filter(l => l.va_item_id === item.id).length;
                  const commentCount = (store.vaComments ?? []).filter(c => c.va_item_id === item.id).length;
                  return (
                    <tr key={item.id} onClick={() => openItem(item)} className="border-b border-[#1e2d4a]/50 hover:bg-[#1a2236] cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-400 text-xs">{item.reference}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-200 truncate max-w-[200px]">{item.title}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {item.description && <p className="text-slate-600 truncate max-w-[160px]">{item.description}</p>}
                          {lineCount > 0 && (
                            <span className="flex items-center gap-0.5 text-slate-600 shrink-0">
                              <Calculator size={9} />{lineCount}
                            </span>
                          )}
                          {commentCount > 0 && (
                            <span className="flex items-center gap-0.5 text-slate-600 shrink-0">
                              <MessageSquare size={9} />{commentCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[120px] hidden sm:table-cell">{item.reason || '—'}</td>
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
