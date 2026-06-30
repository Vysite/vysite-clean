import { useState, useMemo } from 'react';
import { Plus, X, Save, Trash2, AlertCircle, Printer, Copy, Eye, CreditCard as Edit2 } from 'lucide-react';
import type { Project } from './types';
import { fmtCurrency, fmtDate } from './types';
import type { DBCommercialApplication } from '../../lib/store';
import { useAppStore } from '../../lib/StoreContext';
import { exportApplicationsPDF } from './CommercialPDF';
import { RowActionsMenu } from '../../components/RowActionsMenu';

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
                <label className={labelCls}>Retention</label>
                <input type="number" step="0.01" min={0} placeholder="0.00" className={inputCls} value={form.retention}
                  onChange={e => set('retention', e.target.value)} />
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

  const nextAppNumber = useMemo(
    () => items.length > 0 ? Math.max(...items.map(a => a.app_number)) + 1 : 1,
    [items]
  );

  // Summary metrics
  const appliedToDate    = items.reduce((s, a) => s + a.applied_value, 0);
  const certifiedToDate  = items.reduce((s, a) => s + a.certified_value, 0);
  const paidToDate       = items.reduce((s, a) => s + a.paid_value, 0);
  const totalRetention   = items.reduce((s, a) => s + a.retention, 0);
  const certificationShortfall = appliedToDate - certifiedToDate;
  const outstanding      = certifiedToDate - paidToDate;
  const remainingContract = forecastContractSum > 0 ? forecastContractSum - appliedToDate : null;

  function openNew() {
    setSelected(null);
    setSimilarTemplate(null);
    setDrawerOpen(true);
  }
  function openItem(a: DBCommercialApplication) {
    setSelected(a);
    setSimilarTemplate(null);
    setDrawerOpen(true);
  }
  function handleCreateSimilar(source: DBCommercialApplication) {
    setSelected(null);
    setSimilarTemplate({ ...source, id: generateId(), app_number: nextAppNumber, app_date: new Date().toISOString().slice(0, 10), payment_due: null, payment_recd: null, status: 'draft', notes: '' });
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
            onClick={() => exportApplicationsPDF({ project, apps: items, forecastContractSum, currentUserName: currentUserName || '' })}
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
        <MetricCard label="Applied To Date"         value={fmtCurrency(appliedToDate)} />
        <MetricCard label="Certified To Date"       value={fmtCurrency(certifiedToDate)} />
        <MetricCard label="Certification Shortfall" value={fmtCurrency(certificationShortfall)}
          sub={certificationShortfall > 0 ? 'Applied – Certified' : undefined} />
        <MetricCard label="Paid To Date"            value={fmtCurrency(paidToDate)} />
        <MetricCard label="Outstanding"             value={fmtCurrency(outstanding)}
          sub={outstanding > 0 ? 'Certified – Paid' : undefined} />
        <MetricCard label="Retention"               value={fmtCurrency(totalRetention)} />
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
        <div className="bg-[#0a1120] border border-[#1e2d4a] rounded-xl overflow-hidden">
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