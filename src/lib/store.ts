import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import type {
  Action, Snag, Tender, Project,
} from '../data/types';

// ─── Types for DB rows ────────────────────────────────────────────────────────

export type PlatformUserRole = 'Admin' | 'Manager' | 'User' | 'Client User';

export interface DBPlatformUser {
  id: string;
  name: string;
  email: string;
  role: PlatformUserRole;
  company: string;
  status: 'Active' | 'Inactive';
  avatar_initials: string;
  join_date: string;
  assigned_project_ids: string[];
  auth_user_id?: string | null;
  org_id?: string | null;
  created_at?: string;
}

export interface DBNotification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string;
  linked_type: string;
  linked_id: string;
  project_id: string;
  project_name: string;
  read: boolean;
  created_at?: string;
}

export interface DBProject {
  id: string;
  name: string;
  client: string;
  location: string;
  project_manager: string;
  status: string;
  start_date: string;
  completion_date: string;
  progress: number;
  value: string;
  open_actions: number;
  open_snags: number;
}

export interface DBProjectDocument {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  type: string;
  size: number;
  category: string;
  data_url: string;
  uploaded_by: string;
  created_at?: string;
}

export interface DBAttachment {
  id: string;
  linked_type: string; // 'action' | 'snag'
  linked_id: string;
  project_id: string;
  project_name: string;
  name: string;
  type: string;
  size: number;
  category: string;
  data_url: string;
  uploaded_by: string;
  created_at?: string;
}

export interface DBActionComment {
  id: string;
  user: string;
  datetime: string;
  text: string;
}

export interface DBAction {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  owner: string;
  due_date: string;
  status: string;
  priority: string;
  created_by: string;
  created_date: string;
  overdue: boolean;
  comments: DBActionComment[];
}

export interface DBSnag {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assigned_to: string;
  raised_by: string;
  raised_date: string;
  due_date: string;
  location: string;
  comments: string[];
}

export interface DBFormComment {
  id: string;
  user: string;
  datetime: string;
  text: string;
}

export interface DBSiteForm {
  id: string;
  type: string;
  project_id: string;
  project_name: string;
  date: string;
  completed_by: string;
  description: string;
  comments: string;
  form_comments: DBFormComment[];
  status: string;
  submitted_date?: string;
  notes: string;
  extra_data: Record<string, unknown>;
}

export interface DBTender {
  id: string;
  ref: string;
  name: string;
  client: string;
  location: string;
  received_date: string;
  return_date: string;
  estimated_value: number;
  status: string;
  owner: string;
  priority: string;
  last_updated: string;
  next_action: string;
  internal_notes: string;
  scope_notes: Record<string, string>;
  scope_entries: unknown[];
  subcontractors: unknown[];
  rfis: unknown[];
  documents: unknown[];
  comments: unknown[];
  outcome_notes: string;
  converted_project_id?: string;
  progress?: number;
  estimate_items?: unknown[];
  ai_review?: unknown;
}

export interface DBTCRecord {
  id: string;
  project_id: string;
  project_name: string;
  category: string;
  ref: string;
  title: string;
  area: string;
  engineer: string;
  date: string;
  status: string;
  result?: string;
  notes: string;
  files: unknown[];
  comments: unknown[];
}

// ─── Mappers: DB row → frontend type ─────────────────────────────────────────

function dbToProject(r: DBProject): Project {
  return {
    id: r.id,
    name: r.name,
    client: r.client,
    location: r.location,
    projectManager: r.project_manager,
    status: r.status as Project['status'],
    startDate: r.start_date,
    completionDate: r.completion_date,
    progress: r.progress,
    value: r.value,
    openActions: r.open_actions,
    openSnags: r.open_snags,
  };
}

function projectToDB(p: Project): DBProject {
  return {
    id: p.id,
    name: p.name,
    client: p.client,
    location: p.location,
    project_manager: p.projectManager,
    status: p.status,
    start_date: p.startDate,
    completion_date: p.completionDate,
    progress: p.progress,
    value: p.value,
    open_actions: p.openActions,
    open_snags: p.openSnags,
  };
}

function dbToAction(r: DBAction): Action {
  return {
    id: r.id,
    projectId: r.project_id,
    projectName: r.project_name,
    title: r.title,
    description: r.description,
    owner: r.owner,
    dueDate: r.due_date,
    status: r.status as Action['status'],
    priority: r.priority as Action['priority'],
    createdBy: r.created_by,
    createdDate: r.created_date,
    overdue: r.overdue,
    comments: (r.comments ?? []) as Action['comments'],
  };
}

function actionToDB(a: Action): DBAction {
  return {
    id: a.id,
    project_id: a.projectId,
    project_name: a.projectName,
    title: a.title,
    description: a.description,
    owner: a.owner,
    due_date: a.dueDate,
    status: a.status,
    priority: a.priority,
    created_by: a.createdBy,
    created_date: a.createdDate,
    overdue: a.overdue,
    comments: a.comments ?? [],
  };
}

function dbToSnag(r: DBSnag): Snag {
  return {
    id: r.id,
    projectId: r.project_id,
    projectName: r.project_name,
    title: r.title,
    description: r.description,
    priority: r.priority as Snag['priority'],
    status: r.status as Snag['status'],
    assignedTo: r.assigned_to,
    raisedBy: r.raised_by,
    raisedDate: r.raised_date,
    dueDate: r.due_date,
    location: r.location,
    comments: r.comments ?? [],
  };
}

function snagToDB(s: Snag): DBSnag {
  return {
    id: s.id,
    project_id: s.projectId,
    project_name: s.projectName,
    title: s.title,
    description: s.description,
    priority: s.priority,
    status: s.status,
    assigned_to: s.assignedTo,
    raised_by: s.raisedBy,
    raised_date: s.raisedDate,
    due_date: s.dueDate,
    location: s.location,
    comments: s.comments,
  };
}

function dbToTender(r: DBTender): Tender {
  return {
    id: r.id,
    ref: r.ref,
    name: r.name,
    client: r.client,
    location: r.location,
    receivedDate: r.received_date,
    returnDate: r.return_date,
    estimatedValue: Number(r.estimated_value),
    status: r.status as Tender['status'],
    owner: r.owner,
    priority: r.priority as Tender['priority'],
    lastUpdated: r.last_updated,
    nextAction: r.next_action,
    internalNotes: r.internal_notes,
    scopeNotes: (r.scope_notes ?? {}) as unknown as Tender['scopeNotes'],
    scopeEntries: (r.scope_entries ?? []) as Tender['scopeEntries'],
    subcontractors: (r.subcontractors ?? []) as Tender['subcontractors'],
    rfis: (r.rfis ?? []) as Tender['rfis'],
    documents: (r.documents ?? []) as Tender['documents'],
    comments: (r.comments ?? []) as Tender['comments'],
    outcomeNotes: r.outcome_notes ?? '',
    convertedProjectId: r.converted_project_id,
    progress: r.progress ?? 0,
    estimateItems: (r.estimate_items ?? []) as Tender['estimateItems'],
    aiReview: r.ai_review as Tender['aiReview'] ?? undefined,
  };
}

function tenderToDB(t: Tender): DBTender {
  return {
    id: t.id,
    ref: t.ref,
    name: t.name,
    client: t.client,
    location: t.location,
    received_date: t.receivedDate,
    return_date: t.returnDate,
    estimated_value: t.estimatedValue,
    status: t.status,
    owner: t.owner,
    priority: t.priority,
    last_updated: t.lastUpdated,
    next_action: t.nextAction,
    internal_notes: t.internalNotes,
    scope_notes: (t.scopeNotes ?? {}) as unknown as Record<string, string>,
    scope_entries: t.scopeEntries ?? [],
    subcontractors: t.subcontractors,
    rfis: t.rfis,
    documents: t.documents,
    comments: t.comments,
    outcome_notes: t.outcomeNotes,
    converted_project_id: t.convertedProjectId,
    progress: t.progress ?? 0,
    estimate_items: t.estimateItems ?? [],
    ai_review: t.aiReview ?? null,
  };
}

// ─── Settings type ────────────────────────────────────────────────────────────

export interface DBSettings {
  id: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  company_vat_number: string;
  company_number: string;
  pdf_footer: string;
  logo_data_url: string;
  accent_color: string;
  default_action_priority: string;
  default_snag_priority: string;
  default_project_status: string;
  rfi_number_prefix: string;
  rfi_number_start: number;
  snag_number_prefix: string;
  snag_number_start: number;
  action_number_prefix: string;
  action_number_start: number;
  notification_toggles: Record<string, boolean>;
  updated_at?: string;
}

export const DEFAULT_SETTINGS: DBSettings = {
  id: 'workspace',
  company_name: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_website: '',
  company_vat_number: '',
  company_number: '',
  pdf_footer: '',
  logo_data_url: '',
  accent_color: '#f97316',
  default_action_priority: 'Medium',
  default_snag_priority: 'Medium',
  default_project_status: 'Active',
  rfi_number_prefix: 'RFI',
  rfi_number_start: 1,
  snag_number_prefix: 'SNG',
  snag_number_start: 1,
  action_number_prefix: 'ACT',
  action_number_start: 1,
  notification_toggles: {},
};

// ─── Main store hook ──────────────────────────────────────────────────────────

export interface AppStore {
  projects: Project[];
  projectDocuments: DBProjectDocument[];
  attachments: DBAttachment[];
  actions: Action[];
  snags: Snag[];
  siteForms: DBSiteForm[];
  tenders: Tender[];
  tcRecords: DBTCRecord[];
  platformUsers: DBPlatformUser[];
  notifications: DBNotification[];
  loading: boolean;
  currentUser: DBPlatformUser | null;
  currentOrgId: string | null;
  visibleProjectIds: string[] | null; // null = all (Admin)
  switchUser: (name: string) => void;
  settings: DBSettings;
  updateSettings: (s: DBSettings) => Promise<void>;

  // Projects
  addProject: (p: Project) => Promise<void>;
  updateProject: (p: Project) => Promise<void>;
  removeProject: (id: string) => Promise<void>;

  // Project Documents
  addProjectDocument: (d: DBProjectDocument) => Promise<void>;
  removeProjectDocument: (id: string) => Promise<void>;

  // Ticket Attachments (actions, snags)
  addAttachment: (a: DBAttachment) => Promise<void>;
  removeAttachment: (id: string) => Promise<void>;
  fetchAttachmentData: (id: string) => Promise<string>;

  // Actions
  addAction: (a: Action) => Promise<void>;
  updateAction: (a: Action) => Promise<void>;
  removeAction: (id: string) => Promise<void>;

  // Snags
  addSnag: (s: Snag) => Promise<void>;
  updateSnag: (s: Snag) => Promise<void>;
  removeSnag: (id: string) => Promise<void>;

  // Site forms
  addSiteForm: (f: DBSiteForm) => Promise<void>;
  updateSiteForm: (f: DBSiteForm) => Promise<void>;
  removeSiteForm: (id: string) => Promise<void>;

  // Tenders
  addTender: (t: Tender) => Promise<void>;
  updateTender: (t: Tender) => Promise<void>;
  removeTender: (id: string) => Promise<void>;

  // TC Records
  addTCRecord: (r: DBTCRecord) => Promise<void>;
  updateTCRecord: (r: DBTCRecord) => Promise<void>;
  removeTCRecord: (id: string) => Promise<void>;

  // Platform Users
  addPlatformUser: (u: DBPlatformUser) => Promise<void>;
  updatePlatformUser: (u: DBPlatformUser) => Promise<void>;
  removePlatformUser: (id: string) => Promise<void>;

  // Notifications
  addNotification: (n: DBNotification) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

// Legacy localStorage user-switching — kept for UI compatibility, no longer
// drives currentUser resolution. currentUser is now derived from auth_user_id.
let _activeUserName: string = (() => {
  try { return localStorage.getItem('vysite_active_user') ?? ''; } catch { return ''; }
})();

export function switchUser(name: string) {
  _activeUserName = name;
  try { localStorage.setItem('vysite_active_user', name); } catch { /* ignore */ }
  window.location.reload();
}

// Throws if orgId is missing — prevents silent null writes.
function requireOrgId(orgId: string | null): string {
  if (!orgId) throw new Error('No organisation context. Cannot write data without an active organisation.');
  return orgId;
}

export function useStore(orgId: string | null, authUserId: string | null): AppStore {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDocuments, setProjectDocuments] = useState<DBProjectDocument[]>([]);
  const [attachments, setAttachments] = useState<DBAttachment[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [snags, setSnags] = useState<Snag[]>([]);
  const [siteForms, setSiteForms] = useState<DBSiteForm[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [tcRecords, setTCRecords] = useState<DBTCRecord[]>([]);
  const [platformUsers, setPlatformUsers] = useState<DBPlatformUser[]>([]);
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [settings, setSettings] = useState<DBSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Keep a stable ref to orgId so callbacks always read the latest value
  // without needing to be re-created (avoids cascading re-renders).
  const orgIdRef = useRef(orgId);
  orgIdRef.current = orgId;

  useEffect(() => {
    let cancelled = false;

    const loadingTimeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 15000);

    async function load() {
      const ATT_COLS = 'id,linked_type,linked_id,project_id,project_name,name,type,size,category,uploaded_by,created_at';

      const [projRes, docRes, attRes, actRes, snaRes, frmRes, tenRes, tcRes, puRes, notifRes, settingsRes] = await Promise.all([
        supabase.from('vy_projects').select('*').order('created_at', { ascending: true }),
        supabase.from('vy_project_documents').select('*').order('created_at', { ascending: false }),
        supabase.from('vy_attachments').select(ATT_COLS).order('created_at', { ascending: false }),
        supabase.from('vy_actions').select('*').order('created_at', { ascending: false }),
        supabase.from('vy_snags').select('*').order('created_at', { ascending: false }),
        supabase.from('vy_site_forms').select('*').order('created_at', { ascending: false }),
        supabase.from('vy_tenders').select('*').order('created_at', { ascending: false }),
        supabase.from('vy_tc_records').select('*').order('created_at', { ascending: false }),
        supabase.from('vy_platform_users').select('*').order('created_at', { ascending: true }),
        supabase.from('vy_notifications').select('*').order('created_at', { ascending: false }),
        supabase.from('vy_settings').select('*').eq('id', 'workspace').maybeSingle(),
      ]);

      if (cancelled) return;

      setProjects((projRes.data ?? []).map(r => dbToProject(r as DBProject)));
      setProjectDocuments((docRes.data ?? []) as DBProjectDocument[]);
      setAttachments((attRes.data ?? []) as DBAttachment[]);
      setActions((actRes.data ?? []).map(r => dbToAction(r as DBAction)));
      setSnags((snaRes.data ?? []).map(r => dbToSnag(r as DBSnag)));
      setSiteForms(((frmRes.data ?? []) as DBSiteForm[]).map(f => ({ ...f, form_comments: f.form_comments ?? [] })));
      setTenders((tenRes.data ?? []).map(r => dbToTender(r as DBTender)));
      setTCRecords((tcRes.data ?? []) as DBTCRecord[]);
      setPlatformUsers((puRes.data ?? []) as DBPlatformUser[]);
      setNotifications((notifRes.data ?? []) as DBNotification[]);
      if (settingsRes.data) setSettings({ ...DEFAULT_SETTINGS, ...(settingsRes.data as DBSettings) });
      setLoading(false);
    }

    load().finally(() => clearTimeout(loadingTimeout));
    return () => {
      cancelled = true;
      clearTimeout(loadingTimeout);
    };
  }, []);

  // ── Projects ──────────────────────────────────────────────────────────────────

  const addProject = useCallback(async (p: Project) => {
    const oid = requireOrgId(orgIdRef.current);
    setProjects(prev => [...prev, p]);
    await supabase.from('vy_projects').upsert({ ...projectToDB(p), org_id: oid }, { onConflict: 'id' });
  }, []);

  const updateProject = useCallback(async (p: Project) => {
    const oid = requireOrgId(orgIdRef.current);
    setProjects(prev => prev.map(x => x.id === p.id ? p : x));
    await supabase.from('vy_projects').upsert({ ...projectToDB(p), org_id: oid }, { onConflict: 'id' });
  }, []);

  const removeProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    await supabase.from('vy_projects').delete().eq('id', id);
  }, []);

  // ── Project Documents ─────────────────────────────────────────────────────────

  const addProjectDocument = useCallback(async (d: DBProjectDocument) => {
    const oid = requireOrgId(orgIdRef.current);
    setProjectDocuments(prev => [d, ...prev]);
    await supabase.from('vy_project_documents').upsert({ ...d, org_id: oid }, { onConflict: 'id' });
  }, []);

  const removeProjectDocument = useCallback(async (id: string) => {
    setProjectDocuments(prev => prev.filter(d => d.id !== id));
    await supabase.from('vy_project_documents').delete().eq('id', id);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const addAction = useCallback(async (a: Action) => {
    const oid = requireOrgId(orgIdRef.current);
    setActions(prev => [a, ...prev]);
    await supabase.from('vy_actions').upsert({ ...actionToDB(a), org_id: oid }, { onConflict: 'id' });
  }, []);

  const updateAction = useCallback(async (a: Action) => {
    const oid = requireOrgId(orgIdRef.current);
    setActions(prev => prev.map(x => x.id === a.id ? a : x));
    await supabase.from('vy_actions').upsert({ ...actionToDB(a), org_id: oid }, { onConflict: 'id' });
  }, []);

  const removeAction = useCallback(async (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
    setAttachments(prev => prev.filter(a => !(a.linked_type === 'action' && a.linked_id === id)));
    await supabase.from('vy_actions').delete().eq('id', id);
    await supabase.from('vy_attachments').delete().eq('linked_type', 'action').eq('linked_id', id);
  }, []);

  // ── Snags ─────────────────────────────────────────────────────────────────────

  const addSnag = useCallback(async (s: Snag) => {
    const oid = requireOrgId(orgIdRef.current);
    setSnags(prev => [s, ...prev]);
    await supabase.from('vy_snags').upsert({ ...snagToDB(s), org_id: oid }, { onConflict: 'id' });
  }, []);

  const updateSnag = useCallback(async (s: Snag) => {
    const oid = requireOrgId(orgIdRef.current);
    setSnags(prev => prev.map(x => x.id === s.id ? s : x));
    await supabase.from('vy_snags').upsert({ ...snagToDB(s), org_id: oid }, { onConflict: 'id' });
  }, []);

  const removeSnag = useCallback(async (id: string) => {
    setSnags(prev => prev.filter(s => s.id !== id));
    setAttachments(prev => prev.filter(a => !(a.linked_type === 'snag' && a.linked_id === id)));
    await supabase.from('vy_snags').delete().eq('id', id);
    await supabase.from('vy_attachments').delete().eq('linked_type', 'snag').eq('linked_id', id);
  }, []);

  // ── Site Forms ────────────────────────────────────────────────────────────────

  const addSiteForm = useCallback(async (f: DBSiteForm) => {
    const oid = requireOrgId(orgIdRef.current);
    setSiteForms(prev => [f, ...prev]);
    await supabase.from('vy_site_forms').upsert({ ...f, org_id: oid }, { onConflict: 'id' });
  }, []);

  const updateSiteForm = useCallback(async (f: DBSiteForm) => {
    const oid = requireOrgId(orgIdRef.current);
    setSiteForms(prev => prev.map(x => x.id === f.id ? f : x));
    await supabase.from('vy_site_forms').upsert({ ...f, org_id: oid }, { onConflict: 'id' });
  }, []);

  const removeSiteForm = useCallback(async (id: string) => {
    setSiteForms(prev => prev.filter(f => f.id !== id));
    await supabase.from('vy_site_forms').delete().eq('id', id);
  }, []);

  // ── Tenders ───────────────────────────────────────────────────────────────────

  const addTender = useCallback(async (t: Tender) => {
    const oid = requireOrgId(orgIdRef.current);
    setTenders(prev => [t, ...prev]);
    await supabase.from('vy_tenders').upsert({ ...tenderToDB(t), org_id: oid }, { onConflict: 'id' });
  }, []);

  const updateTender = useCallback(async (t: Tender) => {
    const oid = requireOrgId(orgIdRef.current);
    setTenders(prev => prev.map(x => x.id === t.id ? t : x));
    await supabase.from('vy_tenders').upsert({ ...tenderToDB(t), org_id: oid }, { onConflict: 'id' });
  }, []);

  const removeTender = useCallback(async (id: string) => {
    setTenders(prev => prev.filter(t => t.id !== id));
    await supabase.from('vy_tenders').delete().eq('id', id);
  }, []);

  // ── TC Records ────────────────────────────────────────────────────────────────

  const addTCRecord = useCallback(async (r: DBTCRecord) => {
    const oid = requireOrgId(orgIdRef.current);
    setTCRecords(prev => [r, ...prev]);
    await supabase.from('vy_tc_records').upsert({ ...r, org_id: oid }, { onConflict: 'id' });
  }, []);

  const updateTCRecord = useCallback(async (r: DBTCRecord) => {
    const oid = requireOrgId(orgIdRef.current);
    setTCRecords(prev => prev.map(x => x.id === r.id ? r : x));
    await supabase.from('vy_tc_records').upsert({ ...r, org_id: oid }, { onConflict: 'id' });
  }, []);

  const removeTCRecord = useCallback(async (id: string) => {
    setTCRecords(prev => prev.filter(r => r.id !== id));
    await supabase.from('vy_tc_records').delete().eq('id', id);
  }, []);

  // ── Attachments ───────────────────────────────────────────────────────────────

  const addAttachment = useCallback(async (a: DBAttachment) => {
    const oid = requireOrgId(orgIdRef.current);
    setAttachments(prev => [a, ...prev]);
    await supabase.from('vy_attachments').upsert({ ...a, org_id: oid }, { onConflict: 'id' });
  }, []);

  const removeAttachment = useCallback(async (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
    await supabase.from('vy_attachments').delete().eq('id', id);
  }, []);

  const fetchAttachmentData = useCallback(async (id: string): Promise<string> => {
    const cached = attachments.find(a => a.id === id);
    if (cached?.data_url) return cached.data_url;
    const { data } = await supabase.from('vy_attachments').select('id,data_url').eq('id', id).maybeSingle();
    if (data?.data_url) {
      setAttachments(prev => prev.map(a => a.id === id ? { ...a, data_url: data.data_url } : a));
      return data.data_url;
    }
    return '';
  }, [attachments]);

  // ── Platform Users ────────────────────────────────────────────────────────────

  const addPlatformUser = useCallback(async (u: DBPlatformUser) => {
    setPlatformUsers(prev => [...prev, u]);
    await supabase.from('vy_platform_users').upsert(u, { onConflict: 'id' });
  }, []);

  const updatePlatformUser = useCallback(async (u: DBPlatformUser) => {
    setPlatformUsers(prev => prev.map(x => x.id === u.id ? u : x));
    await supabase.from('vy_platform_users').upsert(u, { onConflict: 'id' });
  }, []);

  const removePlatformUser = useCallback(async (id: string) => {
    setPlatformUsers(prev => prev.filter(u => u.id !== id));
    await supabase.from('vy_platform_users').delete().eq('id', id);
  }, []);

  // ── Notifications ─────────────────────────────────────────────────────────────

  const addNotification = useCallback(async (n: DBNotification) => {
    const oid = requireOrgId(orgIdRef.current);
    setNotifications(prev => [n, ...prev]);
    await supabase.from('vy_notifications').upsert({ ...n, org_id: oid }, { onConflict: 'id' });
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from('vy_notifications').update({ read: true }).eq('id', id);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from('vy_notifications').update({ read: true }).eq('read', false);
  }, []);

  // ── Settings ──────────────────────────────────────────────────────────────────

  const updateSettings = useCallback(async (s: DBSettings) => {
    const oid = requireOrgId(orgIdRef.current);
    setSettings(s);
    await supabase.from('vy_settings').upsert({ ...s, org_id: oid, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  }, []);

  // Resolve currentUser from the authenticated Supabase user id (auth_user_id).
  // Fall back to the legacy localStorage name match so existing switchUser() UI
  // still works during the transition period before full Phase 4 auth wiring.
  const currentUser =
    (authUserId ? platformUsers.find(u => u.auth_user_id === authUserId) : null)
    ?? platformUsers.find(u => u.name === _activeUserName)
    ?? null;

  const visibleProjectIds = !currentUser || currentUser.role === 'Admin'
    ? null
    : currentUser.assigned_project_ids;

  return {
    projects, projectDocuments, attachments,
    actions, snags, siteForms, tenders, tcRecords,
    platformUsers, notifications,
    loading,
    currentUser,
    currentOrgId: orgId,
    visibleProjectIds,
    switchUser,
    settings,
    updateSettings,
    addProject, updateProject, removeProject,
    addProjectDocument, removeProjectDocument,
    addAttachment, removeAttachment, fetchAttachmentData,
    addAction, updateAction, removeAction,
    addSnag, updateSnag, removeSnag,
    addSiteForm, updateSiteForm, removeSiteForm,
    addTender, updateTender, removeTender,
    addTCRecord, updateTCRecord, removeTCRecord,
    addPlatformUser, updatePlatformUser, removePlatformUser,
    addNotification, markNotificationRead, markAllNotificationsRead,
  };
}
