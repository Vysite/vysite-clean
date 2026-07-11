import { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText, Search, Calendar, Wrench, Zap, CheckSquare, Award,
  HardHat, Users, Pencil, Trash2, ChevronDown, X,
  Plus, Clock, CheckCircle, AlertCircle, TrendingUp, Download,
  Eye, Copy, MoreVertical,
} from 'lucide-react';
import { openPrintTab } from '../lib/printTab';
import { buildFormPageHTML, FORM_PDF_CSS, renderFormPDF } from '../forms/PDFRenderer';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import type { DBSiteForm } from '../lib/store';
import type { UploadedFile } from '../components/FileUpload';
import { type ExtendedFormType, type ExtendedFormStatus, type ExtendedSiteForm, TYPE_MAP } from '../forms/types';
import { FormBuilder } from '../forms/FormBuilder';
import { ViewModal } from '../forms/ViewModal';
import { logActivity, buildDiff, type FieldSpec } from '../lib/activityLog';

// ─── Page props ───────────────────────────────────────────────────────────────
interface SiteFormsProps {
  pendingOpen?: import('../App').PendingOpen | null;
  onPendingOpenConsumed?: () => void;
  pendingFilter?: import('../App').PendingFilter | null;
  onPendingFilterConsumed?: () => void;
}

// ─── Status options per form type group ──────────────────────────────────────
const ALL_STATUSES: ExtendedFormStatus[] = [
  'Draft', 'Submitted', 'Approved', 'Issued',
  'Open', 'Acknowledged', 'Actioned', 'Resolved', 'Closed',
  'Action Required', 'Awaiting Response', 'Escalated',
];

// ─── Category definitions ─────────────────────────────────────────────────────
const FORM_CATEGORIES = [
  {
    id: 'general', label: 'General', icon: Calendar, iconBg: 'bg-orange-900/50', iconText: 'text-orange-400',
    accentBorder: 'border-orange-700/40', accentHover: 'hover:border-orange-600/60',
    templates: [
      { type: 'Daily Site Report',    title: 'Daily Site Report',    description: 'Full operational DSR — attendance, progress, delays, H&S, materials, sign-off' },
      { type: 'Site Hold Up',         title: 'Site Hold Up',         description: 'Record a site disruption, hold up or prevention of works — facts only, not a contractual notice' },
      { type: 'Site Change Request',  title: 'Site Change Request',  description: 'Record a requested change, additional works or scope change identified on site — not a Variation' },
      { type: 'Site Note',            title: 'Site Note',            description: 'Formal contemporaneous record of important site information, observations and existing conditions' },
    ],
  },
  {
    id: 'mechanical', label: 'Mechanical', icon: Wrench, iconBg: 'bg-sky-900/50', iconText: 'text-sky-400',
    accentBorder: 'border-sky-700/40', accentHover: 'hover:border-sky-600/60',
    templates: [
      { type: 'Pressure Test',     title: 'Pressure Test Record',     description: 'Record pressure test details, results and witness sign-off' },
      { type: 'Flushing Record',   title: 'Flushing Record',          description: 'System flushing details, water quality and sign-off' },
      { type: 'Valve Checklist',   title: 'Valve Commissioning',      description: 'Valve operation, leakage and condition check record' },
      { type: 'AHU Commissioning', title: 'AHU Commissioning Record', description: 'AHU airflows, fan data, filter/coil conditions and result' },
      { type: 'Plantroom Commissioning Record', title: 'Plantroom Fill, Test & Commissioning', description: 'Mechanical plantroom asset register, fill, pressure test, flushing, water treatment, commissioning checks and defects' },
      { type: 'HIU Commissioning Record', title: 'HIU Commissioning Record', description: 'Heat Interface Unit commissioning — plot info, HIU details, heat meter, valve checks, temperature/pressure readings, DHW, controls, defects and sign-off' },
      { type: 'MVHR Commissioning Record', title: 'MVHR Commissioning Record', description: 'Mechanical Ventilation with Heat Recovery commissioning — unit details, installation checks, airflow readings per room, functional testing, defects and sign-off' },
      { type: 'Temperature Water Readings', title: 'Temperature Water Readings', description: 'Domestic hot and cold water temperature survey — outlet readings, 20s/60s temps, pass/fail assessment and sign-off' },
      { type: 'Flushing Register', title: 'Flushing Register', description: 'Daily Legionella flushing register — start/end of shift checks, outlet register table, daily summary and declaration (ACoP L8 / HSG274 / BSRIA BG29)' },
    ],
  },
  {
    id: 'electrical', label: 'Electrical', icon: Zap, iconBg: 'bg-yellow-900/50', iconText: 'text-yellow-400',
    accentBorder: 'border-yellow-700/40', accentHover: 'hover:border-yellow-600/60',
    templates: [
      { type: 'Electrical Commissioning Report', title: 'Electrical Commissioning Report', description: 'Daily ECR — shift, team, progress, testing, blockers, sign-off' },
      { type: 'Dead Testing',    title: 'Dead Test Record', description: 'Electrical dead testing — insulation resistance and polarity' },
      { type: 'Continuity Test', title: 'Continuity Test',  description: 'Record conductor continuity resistance measurements' },
    ],
  },
  {
    id: 'hs', label: 'H&S', icon: HardHat, iconBg: 'bg-amber-900/50', iconText: 'text-amber-400',
    accentBorder: 'border-amber-700/40', accentHover: 'hover:border-amber-600/60',
    templates: [
      { type: 'Risk Assessment', title: 'Risk Assessment / RAMS', description: 'RAMS — hazard table, risk scoring, control measures, sign-off' },
      { type: 'Site Walk Audit', title: 'Site Walk Audit',        description: '14-section site walk audit — housekeeping, WAH, PPE, fire, M&E' },
      { type: 'Toolbox Talk',    title: 'Toolbox Talk',           description: 'Record toolbox talk topic, attendees, key points and actions' },
      { type: 'H&S Inspection',  title: 'H&S Inspection',        description: 'Health & safety site inspections and observations' },
      { type: 'Accident / Incident Report', title: 'Accident / Incident Report', description: 'Guided accident, incident, near miss and dangerous occurrence reporting with RIDDOR assessment' },
    ],
  },
  {
    id: 'qa', label: 'QA / Compliance', icon: CheckSquare, iconBg: 'bg-teal-900/50', iconText: 'text-teal-400',
    accentBorder: 'border-teal-700/40', accentHover: 'hover:border-teal-600/60',
    templates: [
      { type: 'QA Inspection',   title: 'QA Inspection',           description: 'Quality assurance inspection against a checklist or specification' },
      { type: 'RFI',             title: 'Request for Information',  description: 'Raise a formal RFI for clarification on design or specification' },
      { type: 'Technical Query', title: 'Technical Query',         description: 'Submit a technical query for a formal written response' },
    ],
  },
  {
    id: 'subcontractor', label: 'Sub-Contractor', icon: Users, iconBg: 'bg-slate-700/70', iconText: 'text-slate-300',
    accentBorder: 'border-slate-600/40', accentHover: 'hover:border-slate-500/60',
    templates: [
      { type: 'Site Instruction', title: 'Site Instruction',      description: 'Formal site instruction to a sub-contractor or trade' },
      { type: 'Hold Up Notice',   title: 'Sub-Contractor Notice', description: 'Formal notice regarding site compliance or performance' },
    ],
  },
  {
    id: 'certificates', label: 'Certificates', icon: Award, iconBg: 'bg-emerald-900/50', iconText: 'text-emerald-400',
    accentBorder: 'border-emerald-700/40', accentHover: 'hover:border-emerald-600/60',
    templates: [
      { type: 'Practical Completion Certificate', title: 'Practical Completion Certificate', description: 'Formally certify the practical completion and handover of works, a phase, area, system or equipment' },
    ],
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function fmtDate(s: string | undefined): string {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Category drawer ──────────────────────────────────────────────────────────
interface CategoryDrawerProps {
  cat: (typeof FORM_CATEGORIES)[number];
  onSelect: (type: ExtendedFormType) => void;
  canCreate: boolean;
}
function CategoryDrawer({ cat, onSelect, canCreate }: CategoryDrawerProps) {
  return (
    <div className="py-1">
      {cat.templates.map(t => (
        <button
          key={`${t.type}-${t.title}`}
          onClick={() => canCreate && onSelect(t.type as ExtendedFormType)}
          disabled={!canCreate}
          className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[#0d1628] transition-colors group disabled:opacity-40 disabled:cursor-not-allowed border-b border-[#1e2d4a]/60 last:border-b-0"
        >
          <Plus size={13} className="mt-0.5 text-slate-600 group-hover:text-orange-400 transition-colors shrink-0" />
          <div>
            <div className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{t.title}</div>
            <div className="text-[10px] text-slate-600 mt-0.5 leading-snug">{t.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Inline status dropdown ───────────────────────────────────────────────────
interface StatusDropdownProps {
  form: ExtendedSiteForm;
  onStatusChange: (form: ExtendedSiteForm, newStatus: ExtendedFormStatus) => void;
  canEdit: boolean;
}
function StatusDropdown({ form, onStatusChange, canEdit }: StatusDropdownProps) {
  const statusColor =
    form.status === 'Action Required' ? 'text-red-400 bg-red-900/20 border-red-800/40' :
    form.status === 'Approved'         ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800/40' :
    form.status === 'Submitted'        ? 'text-blue-400 bg-blue-900/20 border-blue-800/40' :
    form.status === 'Issued'           ? 'text-sky-400 bg-sky-900/20 border-sky-800/40' :
    form.status === 'Draft'            ? 'text-amber-400 bg-amber-900/20 border-amber-800/40' :
    form.status === 'Open'             ? 'text-yellow-400 bg-yellow-900/20 border-yellow-800/40' :
    form.status === 'Acknowledged'     ? 'text-cyan-400 bg-cyan-900/20 border-cyan-800/40' :
    form.status === 'Actioned'         ? 'text-violet-400 bg-violet-900/20 border-violet-800/40' :
    form.status === 'Resolved'         ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800/40' :
    form.status === 'Closed'           ? 'text-slate-400 bg-slate-700/30 border-slate-600/40' :
    'text-slate-400 bg-slate-700/30 border-slate-600/40';

  if (!canEdit) {
    return (
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${statusColor}`}>
        {form.status}
      </span>
    );
  }

  return (
    <select
      value={form.status}
      onClick={e => e.stopPropagation()}
      onChange={e => {
        e.stopPropagation();
        onStatusChange(form, e.target.value as ExtendedFormStatus);
      }}
      className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 border cursor-pointer outline-none appearance-none ${statusColor} hover:opacity-80 transition-opacity`}
      style={{ backgroundImage: 'none' }}
    >
      {ALL_STATUSES.map(s => (
        <option key={s} value={s} className="bg-[#1a2236] text-slate-200 text-xs font-normal">{s}</option>
      ))}
    </select>
  );
}

// ─── Row actions menu ─────────────────────────────────────────────────────────
interface RowActionsProps {
  form: ExtendedSiteForm;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  onView: () => void;
  onEdit: () => void;
  onCreateSimilar: () => void;
  onExportPDF: () => void;
  onDelete: () => void;
}
function RowActions({ form, canEdit, canDelete, canExport, onView, onEdit, onCreateSimilar, onExportPDF, onDelete }: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Always show view; show others conditionally
  const items = [
    { label: 'View', icon: Eye, action: onView, always: true },
    { label: 'Edit', icon: Pencil, action: onEdit, always: false, show: canEdit },
    { label: 'Create Similar', icon: Copy, action: onCreateSimilar, always: false, show: true },
    { label: 'Export PDF', icon: Download, action: onExportPDF, always: false, show: canExport },
    { label: 'Delete', icon: Trash2, action: onDelete, always: false, show: canDelete, danger: true },
  ];

  const visible = items.filter(i => i.always || i.show);

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(p => !p)}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-[#0d1628] transition-colors"
        title="Actions"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a2236] border border-[#1e2d4a] rounded-xl shadow-xl shadow-black/40 py-1 min-w-[160px]">
          {visible.map((item, idx) => {
            const Icon = item.icon;
            const isDanger = (item as { danger?: boolean }).danger;
            const isLast = idx === visible.length - 1;
            const showDivider = isDanger && idx > 0;
            return (
              <div key={item.label}>
                {showDivider && <div className="my-1 border-t border-[#1e2d4a]" />}
                <button
                  onClick={() => { setOpen(false); item.action(); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${
                    isDanger
                      ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                      : 'text-slate-300 hover:bg-[#0d1628] hover:text-white'
                  } ${!isLast && !showDivider ? '' : ''}`}
                >
                  <Icon size={13} className="shrink-0" />
                  {item.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Audit field specs ────────────────────────────────────────────────────────

const SITE_FORM_COMMON_FIELDS: FieldSpec[] = [
  { label: 'Status',       key: 'status' },
  { label: 'Date',         key: 'date' },
  { label: 'Completed By', key: 'completedBy' },
  { label: 'Description',  key: 'description',  isNarrative: true },
  { label: 'Notes',        key: 'notes',         isNarrative: true },
];

const SITE_FORM_TYPE_FIELDS: FieldSpec[] = [
  { label: 'Subject',          key: 'subject',          isNarrative: true },
  { label: 'Question',         key: 'question',         isNarrative: true },
  { label: 'Response',         key: 'response',         isNarrative: true },
  { label: 'Cause',            key: 'cause',            isNarrative: true },
  { label: 'Impact',           key: 'impact',           isNarrative: true },
  { label: 'Programme Impact', key: 'programmeImpact',  isNarrative: true },
  { label: 'Commercial Impact',key: 'commercialImpact', isNarrative: true },
  { label: 'Cost Impact',        key: 'costImpact',       isNarrative: true },
  { label: 'Variation Status',   key: 'variationStatus' },
  { label: 'Instruction Source', key: 'instructionSource', isNarrative: true },
  { label: 'Risk Level',        key: 'riskLevel' },
  { label: 'Findings',          key: 'findings',         isNarrative: true },
  { label: 'Actions Required',  key: 'actionsRequired',  isNarrative: true },
  { label: 'System / Service',  key: 'systemService' },
  { label: 'Test Pressure',     key: 'testPressure' },
  { label: 'Test Medium',       key: 'testMedium' },
  { label: 'Test Result',       key: 'testResult' },
  { label: 'Witnessed By',      key: 'witnessedBy' },
  { label: 'Observations',      key: 'observations',     isNarrative: true },
  { label: 'Flush Result',      key: 'flushResult' },
  { label: 'Turbidity',         key: 'turbidity' },
  { label: 'Chlorine Residual', key: 'chlorineResidual' },
  { label: 'Dead Test Result',  key: 'deadTestResult' },
  { label: 'Continuity Result', key: 'continuityResult' },
  { label: 'Area / Location',   key: 'areaLocation' },
  { label: 'Comments',          key: 'comments',         isNarrative: true },
  { label: 'Priority',          key: 'priority' },
  { label: 'Assigned To',       key: 'assignedTo' },
  { label: 'Site Note Category', key: 'snCategory' },
  { label: 'Subject',           key: 'snSubject',        isNarrative: true },
  { label: 'Site Note',         key: 'snBody',           isNarrative: true },
  { label: 'Recommended Action', key: 'snRecommendedAction', isNarrative: true },
];

const ALL_SITE_FORM_FIELDS = [...SITE_FORM_COMMON_FIELDS, ...SITE_FORM_TYPE_FIELDS];

// Fields that should NOT be copied when creating a similar form
const SKIP_COPY_FIELDS = new Set([
  'id', 'rfiRef', 'tqRef', 'noticeRef', 'variationRef', 'wcRef', 'inspectionRef', 'shuRef', 'scrRef', 'snRef',
  'comments', 'form_comments', 'submittedDate', 'completedBy', 'date',
]);

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SiteForms(_props: SiteFormsProps = {}) {
  const store    = useAppStore();
  const perms    = usePermissions();
  const isAdmin  = store.currentUser?.role === 'Admin';
  const canCreate = perms['site_forms.create'];
  const canEdit   = perms['site_forms.edit'];
  const canDelete = perms['site_forms.delete'];
  const canExport = canEdit || isAdmin;

  const [openCategory, setOpenCategory]           = useState<string | null>(null);
  const [search, setSearch]                       = useState('');
  const [filterProject, setFilterProject]         = useState('All');
  const [filterCategory, setFilterCategory]       = useState('All');
  const [filterType, setFilterType]               = useState('All');
  const [filterStatus, setFilterStatus]           = useState('All');
  const [showBuilder, setShowBuilder]             = useState(false);
  const [editingForm, setEditingForm]             = useState<ExtendedSiteForm | null>(null);
  const [similarTemplate, setSimilarTemplate]     = useState<ExtendedSiteForm | null>(null);
  const [viewingForm, setViewingForm]             = useState<ExtendedSiteForm | null>(null);
  const [builderType, setBuilderType]             = useState<ExtendedFormType>('QA Inspection');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId]               = useState<string | null>(null);
  const [selectMode, setSelectMode]               = useState(false);
  const [selectedIds, setSelectedIds]             = useState<Set<string>>(new Set());

  const forms = useMemo(() => {
    const all = (store.siteForms ?? []) as unknown as ExtendedSiteForm[];
    if (store.visibleProjectIds === null) return all;
    return all.filter(f => {
      const pid = store.projects.find(p => p.name === f.projectName)?.id ?? f.projectId;
      return pid ? store.visibleProjectIds!.includes(pid) : false;
    });
  }, [store.siteForms, store.visibleProjectIds, store.projects]);

  // ── Derived stats ──
  const weekStart = startOfWeek();
  const draftCount     = forms.filter(f => f.status === 'Draft').length;
  const submittedCount = forms.filter(f => f.status === 'Submitted' || f.status === 'Approved' || f.status === 'Issued').length;
  const thisWeekCount  = forms.filter(f => f.date && new Date(f.date as string) >= weekStart).length;
  const actionCount    = forms.filter(f => f.status === 'Action Required').length;

  // ── Per-category record counts ──
  const catTypeSets = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const cat of FORM_CATEGORIES) {
      map[cat.id] = new Set(cat.templates.map(t => t.type));
    }
    return map;
  }, []);

  const catCounts = useMemo(() => {
    const counts: Record<string, { total: number; drafts: number; submitted: number }> = {};
    for (const cat of FORM_CATEGORIES) {
      const types = catTypeSets[cat.id];
      const catForms = forms.filter(f => types.has(f.type));
      counts[cat.id] = {
        total: catForms.length,
        drafts: catForms.filter(f => f.status === 'Draft').length,
        submitted: catForms.filter(f => f.status === 'Submitted' || f.status === 'Approved' || f.status === 'Issued').length,
      };
    }
    return counts;
  }, [forms, catTypeSets]);

  // ── Filter options ──
  const projectOptions = useMemo(() => {
    const visibleProjects = store.visibleProjectIds === null
      ? store.projects
      : store.projects.filter(p => store.visibleProjectIds!.includes(p.id));
    return visibleProjects.map(p => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [store.projects, store.visibleProjectIds]);
  const typeOptions    = useMemo(() => Array.from(new Set(forms.map(f => f.type ?? '').filter(Boolean))).sort(), [forms]);
  const statusOptions  = useMemo(() => Array.from(new Set(forms.map(f => f.status ?? '').filter(Boolean))).sort(), [forms]);

  // ── Category lookup per form type ──
  const typeToCatId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of FORM_CATEGORIES) {
      for (const t of cat.templates) { map[t.type] = cat.id; }
    }
    return map;
  }, []);

  // ── Filtered records ──
  const filtered = useMemo(() => forms.filter(f => {
    if (search && !f.title?.toLowerCase().includes(search.toLowerCase()) && !f.projectName?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterProject !== 'All' && (f.projectId ?? f.project_id) !== filterProject) return false;
    if (filterCategory !== 'All' && typeToCatId[f.type] !== filterCategory) return false;
    if (filterType !== 'All' && f.type !== filterType) return false;
    if (filterStatus !== 'All' && f.status !== filterStatus) return false;
    return true;
  }), [forms, search, filterProject, filterCategory, filterType, filterStatus, typeToCatId]);

  const hasFilters = search || filterProject !== 'All' || filterCategory !== 'All' || filterType !== 'All' || filterStatus !== 'All';

  const orgId = store.currentOrgId ?? '';
  const userName = store.currentUser?.name ?? '';

  const isFormAccessible = (f: ExtendedSiteForm): boolean => {
    if (store.visibleProjectIds === null) return true;
    const pid = store.projects.find(p => p.name === f.projectName)?.id ?? f.projectId;
    return pid ? store.visibleProjectIds.includes(pid) : false;
  };
  const formRef = (data: ExtendedSiteForm): string => {
    const ref = (data as Record<string, unknown>).rfiRef
      ?? (data as Record<string, unknown>).tqRef
      ?? (data as Record<string, unknown>).noticeRef
      ?? (data as Record<string, unknown>).variationRef
      ?? (data as Record<string, unknown>).wcRef
      ?? (data as Record<string, unknown>).inspectionRef
      ?? (data as Record<string, unknown>).shuRef
      ?? (data as Record<string, unknown>).scrRef
      ?? (data as Record<string, unknown>).snRef;
    if (ref) return String(ref);
    return data.type;
  };

  const formDesc = (verb: string, data: ExtendedSiteForm, project: string): string => {
    const ref = formRef(data);
    const titleField = (data as Record<string, unknown>).title ?? (data as Record<string, unknown>).subject;
    const refPart = ref !== data.type ? ` ${ref}` : '';
    const titlePart = titleField ? ` "${titleField}"` : '';
    return `${userName} ${verb} ${data.type}${refPart}${titlePart} on project ${project}.`;
  };

  // ── Save handler ──
  const handleSave = (data: ExtendedSiteForm, files: UploadedFile[]) => {
    const extra = { ...data } as Record<string, unknown>;
    ['id', 'type', 'projectId', 'projectName', 'date', 'completedBy', 'description', 'comments', 'status', 'submittedDate', 'notes'].forEach(k => delete extra[k]);
    const isEdit = !!editingForm;
    const isSimilar = !!similarTemplate;
    const dbForm: DBSiteForm = {
      id: isEdit ? editingForm!.id : (data.id ?? `f${Date.now()}`),
      type: data.type,
      project_id: store.projects.find(p => p.name === data.projectName)?.id ?? '',
      project_name: data.projectName ?? '',
      date: data.date ?? '',
      completed_by: data.completedBy ?? '',
      description: data.description ?? '',
      comments: data.comments ?? '',
      status: data.status ?? 'Draft',
      notes: data.notes ?? '',
      form_comments: [],
      extra_data: { ...extra, attachments: files },
    };
    const ref = formRef(data);
    if (isEdit) {
      store.updateSiteForm(dbForm);
      const { changesText, fieldDiffs, prevValue, newValue, actionType } = buildDiff(
        editingForm as unknown as Record<string, unknown>,
        data as unknown as Record<string, unknown>,
        ALL_SITE_FORM_FIELDS,
      );
      const baseDesc = formDesc('updated', data, dbForm.project_name);
      const changePart = changesText ? ` Changes: ${changesText}.` : '';
      logActivity({ orgId, userName, module: 'site_forms', recordId: dbForm.id, recordRef: ref, recordType: data.type, projectId: dbForm.project_id, projectName: dbForm.project_name, actionType, description: `${baseDesc}${changePart}`, prevValue, newValue, metadata: fieldDiffs.length ? { diffs: fieldDiffs } : null });
    } else {
      store.addSiteForm(dbForm);
      const sourceRef = isSimilar ? formRef(similarTemplate!) : null;
      const desc = isSimilar
        ? `${userName} created a similar ${data.type}${sourceRef && sourceRef !== data.type ? ` (copied from ${sourceRef})` : ''} on project ${dbForm.project_name}.`
        : formDesc('created', data, dbForm.project_name);
      logActivity({ orgId, userName, module: 'site_forms', recordId: dbForm.id, recordRef: ref, recordType: data.type, projectId: dbForm.project_id, projectName: dbForm.project_name, actionType: 'record_created', description: desc });
    }
    setShowBuilder(false);
    setEditingForm(null);
    setSimilarTemplate(null);
  };

  // ── Quick status change ──
  const handleQuickStatusChange = async (form: ExtendedSiteForm, newStatus: ExtendedFormStatus) => {
    if (form.status === newStatus) return;
    const projectId = store.projects.find(p => p.name === form.projectName)?.id ?? '';
    const extra = { ...(form as unknown as Record<string, unknown>) };
    ['id', 'type', 'projectId', 'projectName', 'date', 'completedBy', 'description', 'comments', 'status', 'submittedDate', 'notes'].forEach(k => delete extra[k]);
    const dbForm: DBSiteForm = {
      id: form.id,
      type: form.type,
      project_id: projectId,
      project_name: form.projectName ?? '',
      date: (form.date as string) ?? '',
      completed_by: form.completedBy ?? '',
      description: form.description ?? '',
      comments: form.comments ?? '',
      status: newStatus,
      notes: form.notes ?? '',
      form_comments: [],
      extra_data: extra,
    };
    await store.updateSiteForm(dbForm);
    const ref = formRef(form);
    logActivity({
      orgId, userName,
      module: 'site_forms',
      recordId: form.id,
      recordRef: ref,
      recordType: form.type,
      projectId,
      projectName: form.projectName ?? null,
      actionType: 'status_changed',
      description: `${userName} changed status of ${form.type}${ref !== form.type ? ` ${ref}` : ''} from "${form.status}" to "${newStatus}" on project ${form.projectName ?? ''}.`,
      prevValue: form.status,
      newValue: newStatus,
    });
  };

  // ── Create Similar ──
  const handleCreateSimilar = (source: ExtendedSiteForm) => {
    if (!isFormAccessible(source)) return;
    const newId = `f${Date.now()}`;
    const now = new Date().toISOString().split('T')[0];

    // Copy all fields except those that must be fresh on the new form
    const copied = Object.fromEntries(
      Object.entries(source as unknown as Record<string, unknown>).filter(([k]) => !SKIP_COPY_FIELDS.has(k))
    ) as unknown as ExtendedSiteForm;

    const newForm: ExtendedSiteForm = {
      ...copied,
      id: newId,
      status: 'Draft' as ExtendedFormStatus,
      date: now,
      completedBy: userName,
    };

    // Open the new form as a fresh create (not edit) — editingForm must stay null
    // so handleSave calls addSiteForm (INSERT) not updateSiteForm (UPDATE).
    // similarTemplate holds the pre-fill data passed to FormBuilder.
    setBuilderType(source.type as ExtendedFormType);
    setEditingForm(null);
    setSimilarTemplate(newForm);
    setViewingForm(null);
    setShowBuilder(true);
  };

  const handleDelete = (id: string) => { setDeletingId(id); setShowDeleteConfirm(true); };
  const confirmDelete = async () => {
    if (deletingId) {
      const target = forms.find(f => f.id === deletingId);
      const targetRef = target ? formRef(target) : null;
      const titleField = target ? ((target as unknown as Record<string, unknown>).title ?? (target as unknown as Record<string, unknown>).subject) : null;
      const titlePart = titleField ? ` "${titleField}"` : '';
      const refPart = targetRef && targetRef !== target?.type ? ` ${targetRef}` : '';
      await logActivity({ orgId, userName, module: 'site_forms', recordId: deletingId, recordRef: targetRef, recordType: target?.type ?? null, projectId: target ? (store.projects.find(p => p.name === target.projectName)?.id ?? null) : null, projectName: target?.projectName ?? null, actionType: 'record_deleted', description: `${userName} deleted ${target?.type ?? 'form'}${refPart}${titlePart} on project ${target?.projectName ?? ''}.` });
      await store.removeSiteForm(deletingId);
      setShowDeleteConfirm(false);
      setDeletingId(null);
      if (viewingForm?.id === deletingId) setViewingForm(null);
    }
  };
  const openNewForm = (type: ExtendedFormType) => {
    setBuilderType(type);
    setEditingForm(null);
    setShowBuilder(true);
    setOpenCategory(null);
  };
  const openEdit = (form: ExtendedSiteForm) => {
    if (!isFormAccessible(form)) return;
    setBuilderType(form.type as ExtendedFormType);
    setEditingForm(form);
    setViewingForm(null);
    setShowBuilder(true);
  };

  const handleSingleExportPDF = (form: ExtendedSiteForm) => {
    const orgSettings = { company_name: store.settings?.company_name ?? '', logo_data_url: store.settings?.logo_data_url ?? '' };
    if (form.type === 'Practical Completion Certificate') {
      renderFormPDF(form, orgSettings);
    } else {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Site Forms — VYSITE</title><style>${FORM_PDF_CSS}</style></head><body>${buildFormPageHTML(form, orgSettings)}<script>window.onload=function(){window.print();};<\/script></body></html>`;
      openPrintTab(html);
    }
    logActivity({ orgId, userName, module: 'site_forms', recordId: form.id, recordRef: formRef(form), recordType: form.type, projectId: store.projects.find(p => p.name === form.projectName)?.id ?? null, projectName: form.projectName ?? null, actionType: 'pdf_exported', description: `${userName} exported ${form.type} to PDF on project ${form.projectName ?? ''}.` });
  };

  const toggleSelectMode = () => { setSelectMode(p => !p); setSelectedIds(new Set()); };
  const toggleId = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelectedIds(new Set(filtered.map(f => f.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const selectedForms = forms.filter(f => selectedIds.has(f.id));

  const handleExportPDF = () => {
    if (selectedForms.length === 0) return;
    const orgSettings = { company_name: store.settings?.company_name ?? '', logo_data_url: store.settings?.logo_data_url ?? '' };
    const pages = selectedForms.map((f, i) => {
      const pageHtml = buildFormPageHTML(f, orgSettings);
      return i < selectedForms.length - 1
        ? `<div style="page-break-after:always;break-after:page;">${pageHtml}</div>`
        : pageHtml;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Site Forms — VYSITE</title><style>${FORM_PDF_CSS}</style></head><body>${pages}<script>window.onload=function(){window.print();};<\/script></body></html>`;
    openPrintTab(html);
    logActivity({ orgId, userName, module: 'site_forms', actionType: 'pdf_exported', description: `${userName} exported ${selectedForms.length} site form${selectedForms.length !== 1 ? 's' : ''} to PDF.`, metadata: { count: selectedForms.length, refs: selectedForms.map(f => f.type) } });
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Site Forms</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage, create and export site documentation</p>
        </div>
        {canExport && forms.length > 0 && (
          <button
            onClick={toggleSelectMode}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border shrink-0 ${
              selectMode ? 'bg-[#f97316] text-white border-[#f97316]' : 'border-[#1e2d4a] text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200'
            }`}
          >
            {selectMode ? 'Done' : 'Select'}
          </button>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Forms', value: forms.length, icon: FileText,     color: 'text-slate-300', bg: 'bg-slate-700/40' },
          { label: 'Draft',       value: draftCount,   icon: Clock,        color: 'text-amber-400',  bg: 'bg-amber-900/30' },
          { label: 'Submitted',   value: submittedCount,icon: CheckCircle, color: 'text-emerald-400',bg: 'bg-emerald-900/30' },
          { label: 'This Week',   value: thisWeekCount, icon: TrendingUp,  color: 'text-sky-400',    bg: 'bg-sky-900/30' },
        ].map(s => (
          <div key={s.label} className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
              <s.icon size={15} className={s.color} />
            </div>
            <div>
              <div className={`text-lg font-bold leading-none ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-slate-600 mt-0.5 font-medium uppercase tracking-wide">{s.label}</div>
            </div>
          </div>
        ))}
        {actionCount > 0 && (
          <div className="col-span-2 sm:col-span-4 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <AlertCircle size={14} className="text-red-400 shrink-0" />
            <span className="text-xs font-semibold text-red-300">{actionCount} form{actionCount !== 1 ? 's' : ''} require action</span>
          </div>
        )}
      </div>

      {/* ── Category cards ── */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">New Form — Select Category</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {FORM_CATEGORIES.map(cat => {
            const counts = catCounts[cat.id];
            const isOpen = openCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setOpenCategory(isOpen ? null : cat.id)}
                className={`w-full text-left rounded-xl px-3 py-3.5 transition-all duration-150 group flex flex-col h-full ${
                  isOpen
                    ? 'bg-[#1e2840] border border-[#f97316]/70 shadow-[0_0_0_1px_rgba(249,115,22,0.15),0_0_16px_rgba(249,115,22,0.08)]'
                    : 'bg-[#1a2236] border border-[#1e2d4a] hover:border-slate-600/60 hover:bg-[#1e2840]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${cat.iconBg} ${isOpen ? 'ring-1 ring-white/10' : ''}`}>
                    <Icon size={15} className={cat.iconText} />
                  </div>
                  <ChevronDown
                    size={12}
                    className={`shrink-0 transition-all duration-150 ${isOpen ? 'rotate-180 text-[#f97316]' : 'text-slate-700 group-hover:text-slate-500'}`}
                  />
                </div>
                <div className={`text-xs font-bold leading-snug mb-0.5 transition-colors ${isOpen ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                  {cat.label}
                </div>
                <div className="text-[10px] text-slate-600 mb-3">
                  {cat.templates.length} form type{cat.templates.length !== 1 ? 's' : ''}
                </div>
                <div className="mt-auto pt-2.5 border-t border-[#1e2d4a] grid grid-cols-2 gap-x-2 gap-y-1">
                  <div>
                    <div className="text-[9px] text-slate-600 uppercase tracking-wide font-semibold">Draft</div>
                    <div className={`text-xs font-bold mt-0.5 ${counts.drafts > 0 ? 'text-amber-400' : 'text-slate-700'}`}>{counts.drafts}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-600 uppercase tracking-wide font-semibold">Submitted</div>
                    <div className={`text-xs font-bold mt-0.5 ${counts.submitted > 0 ? 'text-emerald-400' : 'text-slate-700'}`}>{counts.submitted}</div>
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-pulse shrink-0" />
                    <span className="text-[9px] font-bold text-[#f97316] uppercase tracking-wider">Viewing</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Category panel ── */}
      {openCategory && (() => {
        const cat = FORM_CATEGORIES.find(c => c.id === openCategory);
        if (!cat) return null;
        const Icon = cat.icon;
        return (
          <div className="bg-[#1a2236] border border-[#f97316]/30 rounded-xl overflow-hidden animate-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cat.iconBg}`}>
                  <Icon size={14} className={cat.iconText} />
                </div>
                <div>
                  <span className="text-sm font-bold text-white">{cat.label}</span>
                  <span className="text-xs text-slate-500 ml-2">{cat.templates.length} form type{cat.templates.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <button onClick={() => setOpenCategory(null)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#0d1628] transition-colors">
                <X size={14} />
              </button>
            </div>
            <CategoryDrawer cat={cat} onSelect={openNewForm} canCreate={canCreate} />
          </div>
        );
      })()}

      {/* ── Records section ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Records</p>
          {forms.length > 0 && <span className="text-[10px] text-slate-600">{filtered.length} of {forms.length}</span>}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {selectedIds.size > 0 && (
            <div className="w-full flex flex-wrap items-center gap-3 mb-1 bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-white">{selectedIds.size} selected</span>
              <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
                <Download size={14} />Export to PDF
              </button>
              <button onClick={selectAll} className="px-3 py-2 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors">Select All</button>
              <button onClick={clearSelection} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors ml-auto">Clear selection</button>
            </div>
          )}
          <div className="relative flex-1 min-w-44">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search forms, projects..."
              className="w-full bg-[#1a2236] border border-[#1e2d4a] rounded-lg pl-8 pr-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-slate-500 transition-colors"
            />
          </div>
          <select
              value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-slate-500 cursor-pointer"
            >
              <option value="All">All Projects</option>
              {projectOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          <select
            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-slate-500 cursor-pointer"
          >
            <option value="All">All Categories</option>
            {FORM_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {typeOptions.length > 0 && (
            <select
              value={filterType} onChange={e => setFilterType(e.target.value)}
              className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-slate-500 cursor-pointer"
            >
              <option value="All">All Types</option>
              {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {statusOptions.length > 0 && (
            <select
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-slate-500 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setFilterProject('All'); setFilterCategory('All'); setFilterType('All'); setFilterStatus('All'); }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-[#1a2236] border border-[#1e2d4a] transition-colors"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {/* Records list */}
        {store.modulesLoading && forms.length === 0 ? (
          // Phase 2 still loading — show skeleton rows, never an empty state
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-[#1a2236] border border-[#1e2d4a] border-l-[3px] border-l-slate-700 rounded-xl px-4 py-3.5 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-20 bg-slate-700/60 rounded-full" />
                  <div className="h-3 w-24 bg-slate-800/80 rounded-full" />
                  <div className="ml-auto h-5 w-16 bg-slate-700/40 rounded-md" />
                </div>
                <div className="h-4 w-2/3 bg-slate-700/50 rounded mb-2" />
                <div className="flex gap-3">
                  <div className="h-3 w-28 bg-slate-800/60 rounded" />
                  <div className="h-3 w-16 bg-slate-800/60 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 text-slate-600">
            <FileText size={28} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">
              {forms.length === 0
                ? 'No records yet. Select a category above to create your first form.'
                : 'No forms match your filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(f => {
              const te = TYPE_MAP[f.type] ?? { bg: 'bg-slate-700', text: 'text-slate-300', label: f.type, border: 'border-l-slate-600' };
              const catId  = typeToCatId[f.type];
              const catDef = FORM_CATEGORIES.find(c => c.id === catId);
              return (
                <div
                  key={f.id}
                  onClick={() => selectMode ? toggleId(f.id) : (isFormAccessible(f) && setViewingForm(f))}
                  className={`bg-[#1a2236] border ${
                    selectMode && selectedIds.has(f.id) ? 'border-orange-500/60' :
                    f.status === 'Action Required' ? 'border-red-900/40' : 'border-[#1e2d4a]'
                  } border-l-[3px] ${te.border} rounded-xl px-4 py-3.5 hover:border-slate-500/50 hover:bg-[#1e2840] transition-all duration-100 group cursor-pointer`}
                >
                  <div className="flex items-start gap-3">
                    {selectMode && (
                      <div className="shrink-0 mt-0.5 pt-0.5" onClick={e => { e.stopPropagation(); toggleId(f.id); }}>
                        <input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => toggleId(f.id)}
                          className="w-4 h-4 rounded border-slate-600 bg-[#0d1628] accent-orange-500 cursor-pointer" />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-4 flex-1 min-w-0">
                      {/* Left: main content */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: type badge + category + status */}
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${te.bg} ${te.text}`}>{te.label}</span>
                          {catDef && (
                            <span className="text-[9px] text-slate-600 shrink-0">{catDef.label}</span>
                          )}
                          <div className="ml-auto" onClick={e => e.stopPropagation()}>
                            <StatusDropdown
                              form={f}
                              onStatusChange={handleQuickStatusChange}
                              canEdit={canEdit}
                            />
                          </div>
                        </div>
                        {/* Row 2: title */}
                        <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors truncate leading-snug">{f.title || te.label}</p>
                        {/* Row 3: meta */}
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                          {f.projectName && (
                            <span className="text-xs text-slate-400 truncate max-w-[180px]">{f.projectName}</span>
                          )}
                          {f.date && (
                            <span className="text-xs text-slate-600">{fmtDate(f.date as string)}</span>
                          )}
                          {f.completedBy && (
                            <span className="text-xs text-slate-600">{f.completedBy}</span>
                          )}
                        </div>
                        {/* Row 4: description snippet */}
                        {(f.description || f.ramsScopeOfWorks) && (
                          <p className="text-[11px] text-slate-600 mt-1.5 line-clamp-1 leading-snug">
                            {String(f.description || f.ramsScopeOfWorks || '')}
                          </p>
                        )}
                      </div>
                      {/* Right: row actions menu */}
                      {!selectMode && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                          <RowActions
                            form={f}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            canExport={canExport}
                            onView={() => isFormAccessible(f) && setViewingForm(f)}
                            onEdit={() => openEdit(f)}
                            onCreateSimilar={() => handleCreateSimilar(f)}
                            onExportPDF={() => handleSingleExportPDF(f)}
                            onDelete={() => handleDelete(f.id)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showBuilder && (
        <FormBuilder
          type={builderType}
          onSave={handleSave}
          onClose={() => { setShowBuilder(false); setEditingForm(null); setSimilarTemplate(null); }}
          initialData={editingForm ?? similarTemplate}
        />
      )}
      {viewingForm && (
        <ViewModal
          form={viewingForm}
          onClose={() => setViewingForm(null)}
          onEdit={() => openEdit(viewingForm)}
          onDelete={() => handleDelete(viewingForm.id)}
        />
      )}
      {showDeleteConfirm && (
        <ConfirmDeleteModal
          title="Delete Form Record"
          description="Are you sure you want to delete this form record? This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => { setShowDeleteConfirm(false); setDeletingId(null); }}
        />
      )}
    </div>
  );
}
