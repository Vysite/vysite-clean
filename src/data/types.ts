export type ProjectStatus = 'Active' | 'On Hold' | 'Completed' | 'Tender';

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  projectManager: string;
  status: ProjectStatus;
  startDate: string;
  completionDate: string;
  openActions: number;
  openSnags: number;
  progress: number;
  value: string;
}

export type SnagPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type SnagStatus = 'Open' | 'In Progress' | 'Closed';

export interface Snag {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  priority: SnagPriority;
  status: SnagStatus;
  assignedTo: string;
  raisedBy: string;
  raisedDate: string;
  dueDate: string;
  location: string;
  comments: string[];
}

export type ActionStatus = 'Not Started' | 'In Progress' | 'Waiting' | 'Complete';

export interface ActionComment {
  id: string;
  user: string;
  datetime: string;
  text: string;
}

export interface Action {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  owner: string;
  dueDate: string;
  status: ActionStatus;
  priority: 'High' | 'Medium' | 'Low';
  createdBy: string;
  createdDate: string;
  overdue: boolean;
  comments: ActionComment[];
}

export type FormStatus = 'Draft' | 'Submitted' | 'Approved';
export type FormType = 'Daily Site Report' | 'QA Inspection';

export interface SiteForm {
  id: string;
  type: FormType;
  projectId: string;
  projectName: string;
  date: string;
  completedBy: string;
  description: string;
  comments: string;
  status: FormStatus;
  submittedDate?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Project Manager' | 'Site Engineer' | 'Supervisor' | 'Viewer';
  assignedProjects: string[];
  status: 'Active' | 'Inactive';
  avatar: string;
  joinDate: string;
}

export interface ActivityItem {
  id: string;
  type: 'snag' | 'action' | 'form' | 'project';
  title: string;
  project: string;
  user: string;
  timestamp: string;
  detail: string;
}

// All seed data arrays emptied — data lives in Supabase only
export const projects: Project[] = [];
export const snags: Snag[] = [];
export const siteForms: SiteForm[] = [];
export const users: User[] = [];
export const recentActivity: ActivityItem[] = [];

// ─── Tender Tracker types ─────────────────────────────────────────────────────

export type TenderStatus =
  | 'New Enquiry'
  | 'Reviewing'
  | 'Pricing'
  | 'Awaiting Subcontractor Returns'
  | 'Submitted'
  | 'Negotiation'
  | 'Won'
  | 'Lost'
  | 'No Bid';

export type TenderPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type SubcontractorStatus = 'Not Sent' | 'Sent' | 'Chased' | 'Returned' | 'Declined';
export type RFIStatus = 'Draft' | 'Issued' | 'Awaiting Response' | 'Closed';

export interface TenderSubcontractor {
  id: string;
  package: string;
  company: string;
  contact: string;
  dateSent: string;
  returnDue: string;
  status: SubcontractorStatus;
  notes: string;
}

export interface TenderRFI {
  id: string;
  ref: string;
  subject?: string;
  question: string;
  dateRaised: string;
  requiredResponseDate?: string;
  assignedTo?: string;
  status: RFIStatus;
  notes: string;
  comments?: TenderDocComment[];
}

export interface TenderDocComment {
  id: string;
  user: string;
  datetime: string;
  text: string;
}

export interface TenderDocument {
  id: string;
  name: string;
  type: string;
  revision: string;
  dateReceived: string;
  notes: string;
  comments?: TenderDocComment[];
}

export interface TenderComment {
  id: string;
  user: string;
  avatar: string;
  datetime: string;
  text: string;
}

export interface TenderScopeNotes {
  summary: string;
  inclusions: string;
  exclusions: string;
  assumptions: string;
  risks: string;
  opportunities: string;
  specialistItems: string;
  siteVisitNotes: string;
}

export interface TenderScopeEntry {
  id: string;
  category: string;
  user: string;
  avatar: string;
  datetime: string;
  text: string;
}

export interface EstimateItem {
  id: string;
  lineNo: number;
  description: string;
  unit: string;
  quantity: number;
  costRate: number;
  markupPct: number;
}

export interface AIReviewRFI { subject: string; query: string; responseRequired: string; impact: string; }
export interface AIReviewRisk { risk: string; severity: 'High' | 'Medium' | 'Low'; suggestedAction: string; actionNote: string; }

export interface StoredAIReview {
  documentName: string;
  reviewedAt: string;
  rfis: AIReviewRFI[];
  assumptions: string[];
  exclusions: string[];
  scopeNotes: string[];
  risks: AIReviewRisk[];
  savedRfiIndices: number[];
  savedAssumptionIndices: number[];
  savedExclusionIndices: number[];
  savedScopeNoteIndices: number[];
  convertedRiskIndices: number[];
  editedRfis?: AIReviewRFI[];
  editedAssumptions?: string[];
  editedExclusions?: string[];
  editedScopeNotes?: string[];
}

export interface Tender {
  id: string;
  ref: string;
  name: string;
  client: string;
  location: string;
  receivedDate: string;
  returnDate: string;
  estimatedValue: number;
  status: TenderStatus;
  owner: string;
  priority: TenderPriority;
  lastUpdated: string;
  nextAction: string;
  internalNotes: string;
  scopeNotes: TenderScopeNotes;
  scopeEntries?: TenderScopeEntry[];
  subcontractors: TenderSubcontractor[];
  rfis: TenderRFI[];
  documents: TenderDocument[];
  comments: TenderComment[];
  outcomeNotes: string;
  convertedProjectId?: string;
  progress?: number;
  estimateItems?: EstimateItem[];
  aiReview?: StoredAIReview;
}

export const tenders: Tender[] = [];

// ─── Legacy in-memory action store (stubbed — data lives in Supabase) ─────────
type ActionListener = () => void;
const actionListeners: ActionListener[] = [];
let _actionStore: Action[] = [];

export function getActions(): Action[] { return _actionStore; }
export function updateAction(updated: Action): void {
  _actionStore = _actionStore.map(a => a.id === updated.id ? updated : a);
  actionListeners.forEach(fn => fn());
}
export function addAction(action: Action): void {
  _actionStore = [action, ..._actionStore];
  actionListeners.forEach(fn => fn());
}
export function subscribeActions(fn: ActionListener): () => void {
  actionListeners.push(fn);
  return () => {
    const idx = actionListeners.indexOf(fn);
    if (idx > -1) actionListeners.splice(idx, 1);
  };
}
