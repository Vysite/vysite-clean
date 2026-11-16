import { useState, useMemo } from 'react';
import { Plus, X, Save, Trash2, AlertCircle, Printer, Copy, Eye, CreditCard as Edit2 } from 'lucide-react';
import type { Project } from './types';
import { fmtCurrency, fmtDate } from './types';
import type { DBCommercialApplication } from '../../lib/store';
import { useAppStore } from '../../lib/StoreContext';
import { exportApplicationsPDF } from './CommercialPDF';
import { RowActionsMenu } from '../../components/RowActionsMenu';
import { nextSeqVal } from '../../lib/refSequence';
import { cumulativeCertifiedPayment, isValuationFrozen, round2 } from './finance';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES: { value: string; label: string; color: string }[] = [
  { value: 'draft',     label: 'Draft',      color: 'text-slate-400 border-slate-600 bg-slate-800/40'   },
  { value: 'submitted', label: 'Submitted',   color: 'text-sky-400 border-sky-800 bg-sky-900/30'        },
  { value: 'certified', label: 'Certified',   color: 'text-amber-400 border-amber-800 bg-amber-900/30'  },
  { value: 'part_paid', label: 'Part Paid',   color: 'text-orange-400 border-orange-800 bg-orange-900/30' },
  { value: 'paid',      label: 'Paid',        color: 'text-emerald-400 border-emerald-800 bg-emerald-900/30' },
  { value: 'overdue',   label: 'Overdue',     color: 'text-red-400 border-red-800 bg-red-900/30'        },
  { value: 'disputed',  label: 'Disputed',    color: 'text-yellow-400 border-yellow-800 bg-yellow-900/30' },
  { value: 'withdrawn', label: 'Withdrawn',   color: 'text-slate-500 border-slate-700 bg-slate-800/30'  },
];

function statusMeta(s: string) {
  return STATUSES.find(x => x.value === s) ?? STATUSES[0];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls  = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#f97316] focus:border-[#f97316] transition-colors';
const labelCls  = 'block text-xs font-medium text-slate-400 mb-1';
const selectCls = `${inputCls} appearance-none cursor-pointer`;

// ─── UUID helper ──────────────────────────────────────────────────────────────

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── Summary metric card ──────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl px-4 py-3">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${m.color}`}>
      {m.label}
    </span>
  );
}

// ─── Inline status dropdown ───────────────────────────────────────────────────

function InlineStatus({ status, canEdit, onChange }: {
  status: string;
  canEdit: boolean;
  onChange: (s: string) => void;
}) {
  const m = statusMeta(status);
  if (!canEdit) return <StatusBadge status={status} />;
  return (
    <select
      value={status}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className={`appearance-none cursor-pointer inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border focus:outline-none ${m.color}`}
      style={{ backgroundImage: 'none' }}
    >
      {STATUSES.map(s => (
        <option key={s.value} value={s.value} className="bg-[#1a2236] text-slate-200">{s.label}</option>
      ))}
    </select>
  );
}

// ─── Drawer (create / edit) ───────────────────────────────────────────────────

interface DrawerForm {
  appNumber: string;
  period: string;
  appDate: string;
  paymentDue: string;
  paymentRecd: string;
  appliedValue: string;
  certifiedValue: string;
  paidValue: string;
  retention: string;
  grossCertifiedToDate: string;
  cumulativeRetention: string;
  certifiedPaymentToDate: string;
  valuationRef: string;
  status: string;
  notes: string;
}

const BLANK_FORM: DrawerForm = {
  appNumber: '',
  period: '',
  appDate: '',
  paymentDue: '',
  paymentRecd: '',
  appliedValue: '',
  certifiedValue: '',
  paidValue: '',
  retention: '',
  grossCertifiedToDate: '',
  cumulativeRetention: '',
  certifiedPaymentToDate: '',
  valuationRef: '',
  status: 'draft',
  notes: '',
};

function appToForm(a: DBCommercialApplication): DrawerForm {
  return {
    appNumber:      String(a.app_number),
    period:         a.period,
    appDate:        a.app_date ?? '',
    paymentDue:     a.payment_due ?? '',
    paymentRecd:    a.payment_recd ?? '',
    appliedValue:   String(a.applied_value),
    certifiedValue: String(a.certified_value),
    paidValue:      String(a.paid_value),
    retention:      String(a.retention),
    grossCertifiedToDate: a.gross_certified_to_date != null ? String(a.gross_certified_to_date) : '',
    cumulativeRetention:  a.cumulative_retention != null ? String(a.cumulative_retention) : '',
    certifiedPaymentToDate: a.certified_payment_to_date != null ? String(a.certified_payment_to_date) : '',
    valuationRef:   '',
    status:         a.status,
    notes:          a.notes,
  };
}

interface DrawerProps {
  item: DBCommercialApplication | null;
  templateData?: DBCommercialApplication | null;
  projectId: string;
  orgId: string;
  canDelete: boolean;
  nextAppNumber: number;
  createdBy: string | null;
  onClose: () => void;
  onSaved: (a: DBCommercialApplication) => void;
  onDeleted: () => void;
}

function ApplicationDrawer({
  item, templateData, projectId, orgId, canDelete, nextAppNumber, createdBy,
  onClose, onSaved, onDeleted,
}: DrawerProps) {
  const store = useAppStore();
  const isNew = !item;
  const [form, setForm] = useState<DrawerForm>(() =>
    item ? appToForm(item) : templateData ? appToForm(templateData) : { ...BLANK_FORM, appNumber: String(nextAppNumber) }
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof DrawerForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    const appNum = parseInt(form.appNumber) || 1;
    const applied    = parseFloat(form.appliedValue)    || 0;
    const certified  = parseFloat(form.certifiedValue)  || 0;
    const paid       = parseFloat(form.paidValue)       || 0;
    const retention  = parseFloat(form.retention)       || 0;
    setSaving(true); setError(null);
    const now = new Date().toISOString();
    // Resolve the linked valuation from its reference (e.g. VAL 004).
    let valuationId: string | null = item?.valuation_id ?? null;
    const refText = form.valuationRef.trim();
    if (refText) {
      const match = store.valuations.find(v =>
        v.project_id === projectId &&
        (v.ref.toLowerCase() === refText.toLowerCase() || v.ref.toLowerCase().endsWith(refText.toLowerCase()))
      );
      valuationId = match ? match.id : valuationId;
    }
    const row: DBCommercialApplication = {
      id:              item?.id ?? generateId(),
      org_id:          orgId,
      project_id:      projectId,
      app_number:      appNum,
      period:          form.period.trim(),
      app_date:        form.appDate || null,
      payment_due:     form.paymentDue || null,
      payment_recd:    form.paymentRecd || null,
      applied_value:   applied,
      certified_value: certified,
      paid_value:      paid,
      retention:       retention,
      valuation_id:    valuationId,
      gross_certified_to_date: form.grossCertifiedToDate.trim() !== '' ? (parseFloat(form.grossCertifiedToDate) || 0) : (item?.gross_certified_to_date ?? null),
      cumulative_retention:    form.cumulativeRetention.trim() !== '' ? (parseFloat(form.cumulativeRetention) || 0) : (item?.cumulative_retention ?? null),
      certified_payment_to_date: form.certifiedPaymentToDate.trim() !== '' ? (parseFloat(form.certifiedPaymentToDate) || 0) : (item?.certified_payment_to_date ?? null),
      status:          form.status,
      notes:           form.notes.trim(),
      created_by:      item?.created_by ?? createdBy,
      created_at:      item?.created_at ?? now,
      updated_at:      now,
    };
    try {
      if (isNew) {
        await store.addCommercialApplication(row);
      } else {
        await store.updateCommercialApplication(row);
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
    try {
      await store.removeCommercialApplication(item.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-[#0a1120] border-l border-[#1e2d4a] h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d4a] sticky top-0 bg-[#0a1120] z-10">
          <h2 className="text-sm font-bold text-white">
            {isNew ? 'New Application' : `Application No. ${item.app_number}`}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-800 text-xs text-red-400">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>App Number</label>
              <input type="number" min={1} className={inputCls} value={form.appNumber}
                onChange={e => set('appNumber', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={selectCls} value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Valuation Period</label>
            <input type="text" placeholder="e.g. June 2026 / Month 3" className={inputCls} value={form.period}
              onChange={e => set('period', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Application Date</label>
              <input type="date" className={inputCls} value={form.appDate}
                onChange={e => set('appDate', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Payment Due</label>
              <input type="date" className={inputCls} value={form.paymentDue}
                onChange={e => set('paymentDue', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Payment Received</label>
            <input type="date" className={inputCls} value={form.paymentRecd}
              onChange={e => set('paymentRecd', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Linked Valuation Reference</label>
            <input type="text" placeholder="e.g. VAL 004" className={inputCls} value={form.valuationRef}
              onChange={e => set('valuationRef', e.target.value)} />
            <p className="text-[10px] text-slate-600 mt-1">Links this payment notice to a valuation so its certified figures feed back to the valuation and Overview.</p>
          </div>

          <div className="border-t border-[#1e2d4a] pt-4">
            <p className="text-xs font-semibold text-slate-400 mb-3">Values (£)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Applied Value</label>
                <input type="number" step="0.01" min={0} placeholder="0.00" className={inputCls} value={form.appliedValue}
                  onChange={e => set('appliedValue', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Certified Value</label>
                <input type="number" step="0.01" min={0} placeholder="0.00" className={inputCls} value={form.certifiedValue}
                  onChange={e => set('certifiedValue', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Paid Value</label>
                <input type="number" step="0.01" min={0} placeholder="0.00" className={inputCls} value={form.paidValue}
                  onChange={e => set('paidValue', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Retention (this notice)</label>
                <input type="number" step="0.01" min={0} placeholder="0.00" className={inputCls} value={form.retention}
                  onChange={e => set('retention', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="border-t border-[#1e2d4a] pt-4">
            <p className="text-xs font-semibold text-slate-400 mb-1">Cumulative Certified Figures (£)</p>
            <p className="text-[10px] text-slate-600 mb-3">Cumulative totals per this payment notice — these feed the Certified to Date and Retention Held figures on the Overview.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Gross Certified to Date (after MCD, before retention)</label>
                <input type="number" step="0.01" min={0} placeholder="0.00" className={inputCls} value={form.grossCertifiedToDate}
                  onChange={e => set('grossCertifiedToDate', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Cumulative Retention Held</label>
                <input type="number" step="0.01" min={0} placeholder="0.00" className={inputCls} value={form.cumulativeRetention}
                  onChange={e => set('cumulativeRetention', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Certified Payment to Date (after retention)</label>
                <input type="number" step="0.01" min={0} placeholder="0.00" className={inputCls} value={form.certifiedPaymentToDate}
                  onChange={e => set('certifiedPaymentToDate', e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={3} className={inputCls} placeholder="Optional notes…" value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#1e2d4a] sticky bottom-0 bg-[#0a1120] flex items-center justify-between gap-3">
          {canDelete && !isNew ? (
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-900/20 border border-red-900/30 hover:border-red-800 transition-colors disabled:opacity-50">
              <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-slate-600 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-xs font-semibold transition-colors shadow-lg shadow-orange-900/30 disabled:opacity-60">
              <Save size={13} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function AppRow({ app, canEdit, canCreate, canDelete, onClick, onQuickStatus, onCreateSimilar, onDelete }: {
  app: DBCommercialApplication;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onClick: () => void;
  onQuickStatus: (s: string) => void;
  onCreateSimilar: () => void;
  onDelete: () => void;
}) {
  const outstanding = app.certified_value - app.paid_value;
  return (
    <div
      onClick={canEdit ? onClick : undefined}
      className={`w-full grid grid-cols-[2.5rem_1fr_6rem_6rem_6rem_6rem_6rem_6rem_auto] gap-2 items-center px-4 py-3 hover:bg-[#0d1628] transition-colors border-b border-[#1a2236] last:border-0 text-left group ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <span className="text-xs font-mono font-semibold text-slate-300 tabular-nums">
        {String(app.app_number).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-white truncate">{app.period || '—'}</p>
        <p className="text-[10px] text-slate-600 tabular-nums">{fmtDate(app.app_date)}</p>
      </div>
      <span className="text-xs tabular-nums text-slate-300 text-right">{fmtCurrency(app.applied_value)}</span>
      <span className="text-xs tabular-nums text-slate-300 text-right">{fmtCurrency(app.certified_value)}</span>
      <span className="text-xs tabular-nums text-slate-300 text-right">{fmtCurrency(app.paid_value)}</span>
      <span className={`text-xs tabular-nums text-right font-semibold ${outstanding > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
        {fmtCurrency(outstanding)}
      </span>
      <span className="text-xs tabular-nums text-slate-500 text-right">{fmtCurrency(app.retention)}</span>
      <span className="flex justify-end" onClick={e => e.stopPropagation()}>
        <InlineStatus status={app.status} canEdit={canEdit} onChange={onQuickStatus} />
      </span>
      <div className="flex items-center justify-end" onClick={e => e.stopPropagation()}>
        <RowActionsMenu actions={[
          { label: 'View / Edit', icon: canEdit ? Edit2 : Eye, onClick },
          ...(canCreate ? [{ label: 'Create Similar', icon: Copy, onClick: onCreateSimilar }] : []),
          ...(canDelete ? [{ label: 'Delete', icon: Trash2, onClick: onDelete, danger: true, dividerBefore: true }] : []),
        ]} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CommercialApplicationsProps {
  project: Project | null;
  orgId: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  forecastContractSum: number;
  currentUserName?: string;
  onProjectChange: (id: string) => void;
}

export default function CommercialApplications({
  project,
  orgId,
  canCreate,
  canEdit,
  canDelete,
  forecastContractSum,
  currentUserName,
}: CommercialApplicationsProps) {
  const store = useAppStore();

  const items = useMemo(
    () => (store.commercialApplications ?? []).filter(a => a.project_id === (project?.id ?? '')),
    [store.commercialApplications, project?.id]
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<DBCommercialApplication | null>(null);
  const [similarTemplate, setSimilarTemplate] = useState<DBCommercialApplication | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [pendingAppNumber, setPendingAppNumber] = useState<number>(0);
  const nextAppNumber = pendingAppNumber; // set before drawer opens

  // Summary metrics — status-scoped per the reconciliation rules:
  // Draft, withdrawn and disputed applications are excluded from current financial totals;
  // cumulative figures come from the latest valid payment notice, not summed across rows.
  const countable = useMemo(
    () => items.filter(a => !['draft', 'withdrawn', 'disputed'].includes(a.status)),
    [items]
  );
  const validNotices = useMemo(
    () => countable.slice().sort((a, b) => b.app_number - a.app_number),
    [countable]
  );
  const latestNotice = validNotices[0] ?? null;
  // Cumulative certified figures: prefer the latest notice's stored cumulative fields;
  // only fall back to summing per-notice values when no cumulative figures are recorded.
  const latestCumCertified = useMemo(() => cumulativeCertifiedPayment(items), [items]);
  const latestCumRetention = latestNotice
    ? (latestNotice.cumulative_retention ?? null)
    : null;
  const appliedToDate    = countable.reduce((s, a) => s + a.applied_value, 0);
  const certifiedToDate  = latestCumCertified ?? 0;
  const paidToDate       = countable.reduce((s, a) => s + a.paid_value, 0);
  const totalRetention   = latestCumRetention ?? countable.reduce((s, a) => s + a.retention, 0);
  // Awaiting Certification matches the Overview and Full Report: latest submitted
  // valuation's cumulative applied payment (workbook chain) less cumulative certified.
  const workbook = store.valuationWorkbooks.find(w => w.project_id === project?.id) ?? null;
  const valuationsFrozen = store.valuations.filter(v => v.project_id === project?.id && isValuationFrozen(v.status));
  const latestFrozenVal = valuationsFrozen
    .slice()
    .sort((a, b) => (b.valuation_date || '').localeCompare(a.valuation_date || '') || b.ref.localeCompare(a.ref))[0] ?? null;
  const workbookApplied = useMemo(() => {
    if (!workbook || !latestFrozenVal) return null;
    const le = store.valuationLineEntries.filter(e => e.valuation_id === latestFrozenVal.id);
    const xe = store.valuationExtraEntries.filter(e => e.valuation_id === latestFrozenVal.id);
    const gross = store.workbookLines.filter(l => l.workbook_id === workbook.id).reduce((s, l) => s + l.contract_value * (le.find(x => x.workbook_line_id === l.id)?.current_pct ?? 0) / 100, 0)
      + store.workbookExtras.filter(e => e.workbook_id === workbook.id).reduce((s, e) => s + e.agreed_value * (xe.find(x => x.workbook_extra_id === e.id)?.current_pct ?? 0) / 100, 0);
    const mcd  = round2(gross * (workbook.mcd_pct ?? 0) / 100);
    const nett = round2(gross - mcd);
    const ret  = round2(nett * (workbook.retention_pct ?? 0) / 100);
    return round2(nett - ret);
  }, [workbook, latestFrozenVal, store.valuationLineEntries, store.valuationExtraEntries, store.workbookLines, store.workbookExtras]);
  const awaitingCertification = workbookApplied != null && latestCumCertified != null
    ? Math.max(0, round2(workbookApplied - latestCumCertified))
    : Math.max(0, appliedToDate - certifiedToDate);
  const certificationShortfall = latestNotice?.certified_value ? Math.max(0, appliedToDate - certifiedToDate) : null;
  const outstanding      = certifiedToDate - paidToDate;
  const remainingContract = forecastContractSum > 0 ? forecastContractSum - appliedToDate : null;

  async function openNew() {
    const num = await nextSeqVal(project.id, 'APP');
    setPendingAppNumber(num);
    setSelected(null);
    setSimilarTemplate(null);
    setDrawerOpen(true);
  }
  function openItem(a: DBCommercialApplication) {
    setSelected(a);
    setSimilarTemplate(null);
    setDrawerOpen(true);
  }
  async function handleCreateSimilar(source: DBCommercialApplication) {
    const num = await nextSeqVal(project.id, 'APP');
    setSelected(null);
    setSimilarTemplate({ ...source, id: generateId(), app_number: num, app_date: new Date().toISOString().slice(0, 10), payment_due: null, payment_recd: null, status: 'draft', notes: '' });
    setDrawerOpen(true);
  }
  async function handleQuickStatus(app: DBCommercialApplication, newStatus: string) {
    if (app.status === newStatus) return;
    await store.updateCommercialApplication({ ...app, status: newStatus, updated_at: new Date().toISOString() });
  }
  async function handleDelete(id: string) {
    await store.removeCommercialApplication(id);
    setDeleteConfirm(null);
  }
  function handleSaved() {
    setDrawerOpen(false);
    setSelected(null);
    setSimilarTemplate(null);
  }
  function handleDeleted() {
    setDrawerOpen(false);
    setSelected(null);
    setSimilarTemplate(null);
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-slate-500">Select a project to view applications.</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white">Applications</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Valuation applications — {project.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportApplicationsPDF({
              project, apps: items, forecastContractSum, currentUserName: currentUserName || '', logoUrl: store.settings?.logo_data_url,
              valuationWorkbook: store.valuationWorkbooks.find(w => w.project_id === project?.id) ?? null,
              valuations: store.valuations.filter(v => v.project_id === project?.id),
              valuationLineEntries: store.valuationLineEntries.filter(e => store.valuations.some(v => v.project_id === project?.id && v.id === e.valuation_id)),
              valuationExtraEntries: store.valuationExtraEntries.filter(e => store.valuations.some(v => v.project_id === project?.id && v.id === e.valuation_id)),
              wbLines: store.workbookLines.filter(l => store.valuationWorkbooks.some(w => w.project_id === project?.id && w.id === l.workbook_id)),
              wbExtras: store.workbookExtras.filter(x => store.valuationWorkbooks.some(w => w.project_id === project?.id && w.id === x.workbook_id)),
            })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-slate-600 transition-colors"
            title="Export Applications PDF"
          >
            <Printer size={13} /> Export PDF
          </button>
          {canCreate && (
            <button onClick={openNew}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-xs font-semibold transition-colors shadow-lg shadow-orange-900/30">
              <Plus size={13} /> New Application
            </button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <MetricCard label="Applied To Date"         value={fmtCurrency(appliedToDate)} sub="Excludes drafts, withdrawn, disputed" />
        <MetricCard label="Certified To Date"       value={fmtCurrency(certifiedToDate)}
          sub={latestNotice?.certified_payment_to_date != null ? `Per Notice ${String(latestNotice.app_number).padStart(2, '0')}` : 'Sum of notices (no cumulative figure)'} />
        <MetricCard label="Awaiting Certification"  value={fmtCurrency(awaitingCertification)}
          sub={certificationShortfall == null ? 'Latest notice not yet certified' : undefined} />
        <MetricCard label="Paid To Date"            value={fmtCurrency(paidToDate)} />
        <MetricCard label="Outstanding Certified"   value={fmtCurrency(outstanding)}
          sub={outstanding > 0 ? 'Certified – Paid' : undefined} />
        <MetricCard label="Retention Held"          value={fmtCurrency(totalRetention)}
          sub={latestCumRetention != null ? 'Cumulative per latest notice' : undefined} />
        <MetricCard label="Remaining Contract"
          value={remainingContract != null ? fmtCurrency(remainingContract) : '—'}
          sub={remainingContract != null ? 'Forecast – Applied' : 'No contract value'} />
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#1e2d4a] rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-[#111827] border border-[#1e2d4a] flex items-center justify-center mb-3">
            <div className="text-[#f97316]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-1">No applications yet</p>
          <p className="text-xs text-slate-600 mb-4">
            Create your first valuation application for this project.
          </p>
          {canCreate && (
            <button onClick={openNew}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-xs font-semibold transition-colors">
              <Plus size={13} /> New Application
            </button>
          )}
        </div>
      ) : (
        <div className="bg-[#0a1120] border border-[#1e2d4a] rounded-xl overflow-visible">
          {/* Table header */}
          <div className="grid grid-cols-[2.5rem_1fr_6rem_6rem_6rem_6rem_6rem_6rem_auto] gap-2 px-4 py-2.5 bg-[#0d1628] border-b border-[#1e2d4a]">
            {['No.', 'Period', 'Applied', 'Certified', 'Paid', 'Outstanding', 'Retention', 'Status', ''].map((h, i) => (
              <span key={i} className={`text-[10px] font-semibold text-slate-500 uppercase tracking-wider ${i >= 2 && i <= 6 ? 'text-right' : ''}`}>
                {h}
              </span>
            ))}
          </div>
          {/* Rows */}
          {items.map(app => (
            <AppRow
              key={app.id}
              app={app}
              canEdit={canEdit}
              canCreate={canCreate}
              canDelete={canDelete}
              onClick={() => openItem(app)}
              onQuickStatus={s => handleQuickStatus(app, s)}
              onCreateSimilar={() => handleCreateSimilar(app)}
              onDelete={() => handleDelete(app.id)}
            />
          ))}
          {/* Totals footer */}
          {items.length > 1 && (
            <div className="grid grid-cols-[2.5rem_1fr_6rem_6rem_6rem_6rem_6rem_6rem_auto] gap-2 items-center px-4 py-3 bg-[#0d1628] border-t border-[#1e2d4a]">
              <span />
              <span className="text-[11px] font-semibold text-slate-400">Totals</span>
              <span className="text-xs tabular-nums font-semibold text-white text-right">{fmtCurrency(appliedToDate)}</span>
              <span className="text-xs tabular-nums font-semibold text-white text-right">{fmtCurrency(certifiedToDate)}</span>
              <span className="text-xs tabular-nums font-semibold text-white text-right">{fmtCurrency(paidToDate)}</span>
              <span className={`text-xs tabular-nums font-semibold text-right ${outstanding > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {fmtCurrency(outstanding)}
              </span>
              <span className="text-xs tabular-nums text-slate-400 text-right">{fmtCurrency(totalRetention)}</span>
              <span />
              <span />
            </div>
          )}
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <ApplicationDrawer
          item={selected}
          templateData={similarTemplate}
          projectId={project.id}
          orgId={orgId}
          canDelete={canDelete}
          nextAppNumber={nextAppNumber}
          createdBy={store.currentUser?.name ?? null}
          onClose={() => { setDrawerOpen(false); setSelected(null); setSimilarTemplate(null); }}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}