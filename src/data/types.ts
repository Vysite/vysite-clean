import type React from 'react';

// Shared type for Lucide icon components (size accepts number or string per Lucide's own props)
export type LucideIcon = React.ComponentType<{ size?: number | string; className?: string }>;

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
  committed?: number | null;
  variationsValue?: number | null;
  budgetCost?: number | null;
  commercialLeadId?: string | null;
  technicalLeadId?: string | null;
  siteManagerId?: string | null;
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
  // Optional traceability & import fields
  sourceDocument?: string;
  pageReference?: string;
  sectionClause?: string;
  importSource?: string;   // e.g. 'ChatGPT Import', 'AI Review'
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
  // Optional fields for traceability & import labelling
  sourceDocument?: string;
  pageReference?: string;
  sectionClause?: string;
  importSource?: string;   // e.g. 'ChatGPT Import', 'AI Review'
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

// ─── Commercial Module ────────────────────────────────────────────────────────

export type CommercialRecordType =
  | 'variation'
  | 'delay_notice'
  | 'compensation_event'
  | 'early_warning_notice'
  | 'extension_of_time'
  | 'loss_and_expense'
  | 'payment_notice'
  | 'pay_less_notice'
  | 'client_instruction'
  | 'commercial_risk'
  | 'commercial_opportunity'
  | 'dispute_query'
  | 'evidence_record'
  | 'commercial_note';

export type CommercialRecordStatus =
  | 'draft'
  | 'submitted'
  | 'awaiting_agreement'
  | 'agreed'
  | 'added_to_valuation'
  | 'paid'
  | 'complete'
  | 'rejected';

export interface CommercialRecord {
  id: string;
  orgId: string;
  projectId: string | null;
  projectName?: string;
  recordType: CommercialRecordType;
  reference: string;
  title: string;
  client: string;
  status: CommercialRecordStatus;
  dateRaised: string | null;
  dateSubmitted: string | null;
  dateAgreed: string | null;
  statusChangedAt: string | null;
  notes: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: CommercialLineItem[];
  extraData?: Record<string, unknown> | null;
  // EWN → DN conversion links
  convertedToId?: string | null;
  convertedFromId?: string | null;
}

export interface CommercialEvent {
  id: string;
  orgId: string;
  recordId: string;
  projectId: string | null;
  eventType: 'record_created' | 'submitted' | 'status_changed';
  fromStatus: string | null;
  toStatus: string;
  userName: string | null;
  occurredAt: string;
}

export interface CommercialLineItem {
  id: string;
  orgId: string;
  recordId: string;
  sortOrder: number;
  description: string;
  clientDescription: string;
  lineType: string;
  unit: string;
  quantity: number;
  internalRate: number;
  clientRate: number;
  markupPct: number | null;
}

// Source traceability — attached to every AI-extracted finding
export interface FindingSource {
  document: string;         // filename
  pageRange: string;        // e.g. "1–40"
  section?: string;         // e.g. "Pr_80_77_94 Vibration isolation products"
  clause?: string;          // e.g. "3.3.1.2"
}

export interface AIReviewRFI {
  subject: string;
  query: string;
  responseRequired: string;
  impact: string;
  source?: FindingSource;
}

export interface AIReviewRisk {
  risk: string;
  severity: 'High' | 'Medium' | 'Low';
  suggestedAction: string;
  actionNote: string;
  source?: FindingSource;
}

// A finding with optional source traceability (used for list-type findings: assumptions, exclusions, scopeNotes)
export interface AIReviewFinding {
  text: string;
  source?: FindingSource;
}

// Reconciliation types — second-pass review
export type ReconcileAction =
  | 'Keep'
  | 'Remove'
  | 'Reclassify'
  | 'Merge'
  | 'Convert to Scope Note'
  | 'Convert to Confirmed Requirement'
  | 'Mark as Answered';

export interface ReconciliationSuggestion {
  id: string;
  category: 'rfi' | 'assumption' | 'exclusion' | 'scopeNote' | 'risk';
  itemIndex: number;
  itemText: string;           // summary of the item being reviewed
  suggestedAction: ReconcileAction;
  reason: string;             // AI explanation
  targetCategory?: string;    // for Reclassify / Convert actions
  mergeWithIndex?: number;    // for Merge actions
  approved?: boolean;         // user-approved action
  rejected?: boolean;
}

// Per-chunk draft state for autosave/resume
export interface DraftChunk {
  chunkIndex: number;
  chunkLabel: string;
  startPage: number;
  endPage: number;
  findings: {
    rfis: AIReviewRFI[];
    assumptions: AIReviewListItem[];
    exclusions: AIReviewListItem[];
    scopeNotes: AIReviewListItem[];
    risks: AIReviewRisk[];
  };
  completedAt: string;
}

export type ReviewProcessingState = 'idle' | 'running' | 'paused' | 'complete' | 'error';

export interface ReviewProcessingMeta {
  fileName: string;
  totalPages: number;
  totalChunks: number;
  completedChunks: number;
  startedAt: string;
  interruptedAt?: string;
}

// List findings can be plain strings (legacy) or {text, source} objects (new AI extraction format)
export type AIReviewListItem = string | AIReviewFinding;

// Completed page range from a single reviewed batch
export interface BatchPageRange {
  startPage: number;
  endPage: number;
  chunkIndex: number;
  completedAt: string;
}

export interface StoredAIReview {
  documentName: string;
  reviewedAt: string;
  rfis: AIReviewRFI[];
  assumptions: AIReviewListItem[];
  exclusions: AIReviewListItem[];
  scopeNotes: AIReviewListItem[];
  risks: AIReviewRisk[];
  savedRfiIndices: number[];
  savedAssumptionIndices: number[];
  savedExclusionIndices: number[];
  savedScopeNoteIndices: number[];
  convertedRiskIndices: number[];
  editedRfis?: AIReviewRFI[];
  editedAssumptions?: AIReviewListItem[];
  editedExclusions?: AIReviewListItem[];
  editedScopeNotes?: AIReviewListItem[];
  // Autosave draft state (Feature 1)
  draftChunks?: DraftChunk[];
  processingState?: ReviewProcessingState;
  processingMeta?: ReviewProcessingMeta;
  // Batch-resume workflow: tracks which page ranges have been fully reviewed
  batchReviewedRanges?: BatchPageRange[];
  // Total chunks in the document — set on first batch so resume knows full scope
  totalDocumentChunks?: number;
  totalDocumentPages?: number;
  // Reconciliation (Feature 3)
  reconciliationSuggestions?: ReconciliationSuggestion[];
  reconciliationRunAt?: string;
}

// ─── AI Contract Review types ─────────────────────────────────────────────────

export type ContractRiskLevel = 'low' | 'medium' | 'high';

export interface ContractFindingSource {
  document: string;
  clause?: string;
  section?: string;
  page?: string;
  snippet?: string;
}

export interface ContractReviewFinding {
  id: string;
  section: string;
  title: string;
  summary: string;
  risk: ContractRiskLevel;
  recommendation: string;
  source?: ContractFindingSource;
}

// Metadata for a document uploaded against a review (no binary stored in DB)
export interface ContractReviewDoc {
  name: string;
  size: number;
  type: string;
  addedAt: string;
}

// A single review session — multiple per tender supported
export interface ContractReviewRecord {
  id: string;
  title: string;
  createdAt: string;
  createdBy: string;
  documents: ContractReviewDoc[];
  executiveSummary: string;
  findings: ContractReviewFinding[];
  commercialHandoverNotes: string;
  notes: string;
  // True once the user has explicitly saved this review
  savedToDocuments?: boolean;
}

// Legacy single-review type kept for backward-compat mapper only
export interface StoredContractReview {
  documentName: string;
  reviewedAt: string;
  executiveSummary: string;
  findings: ContractReviewFinding[];
  commercialHandoverNotes: string;
}

// ChatGPT import types (Feature 4)
export type ImportCategory =
  | 'Scope Note'
  | 'Assumption'
  | 'Exclusion'
  | 'RFI'
  | 'Risk'
  | 'Clarification'
  | 'Subcontractor'
  | 'Commercial Note'
  | 'Design Responsibility'
  | 'Programme / Logistics'
  | 'Compliance Requirement';

export const IMPORT_CATEGORIES: ImportCategory[] = [
  'Scope Note', 'Assumption', 'Exclusion', 'RFI', 'Risk',
  'Clarification', 'Subcontractor', 'Commercial Note',
  'Design Responsibility', 'Programme / Logistics', 'Compliance Requirement',
];

export interface ImportRow {
  category: ImportCategory | string;
  title: string;
  finding: string;
  suggestedWording: string;
  sourceDocument: string;
  pageReference: string;
  sectionClauseReference: string;
  priority: string;
  actionRequired: string;
  status: string;
  notes: string;
  // runtime flags
  _valid: boolean;
  _duplicate: boolean;
  _unknownCategory: boolean;
  _selected: boolean;
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
  contractReviews?: ContractReviewRecord[];
  submittedDate?: string;
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
