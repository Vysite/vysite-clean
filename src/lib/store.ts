import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import type {
  Action, Snag, Tender, Project,
  ContractReviewRecord, StoredContractReview,
} from '../data/types';
import type {
  DBSupplier, DBSupplierTrade, DBSupplierSpecialism, DBSupplierLabourRateType,
} from '../pages/supplychain/types';

// ─── Types for DB rows ────────────────────────────────────────────────────────

export type PlatformUserRole =
  | 'Admin'
  | 'Commercial Lead'
  | 'Project Manager'
  | 'Site Manager'
  | 'Engineer'
  | 'Estimator / QS'
  | 'Client'
  | 'External / Subcontractor'
  // Legacy aliases kept for backwards compatibility
  | 'Manager'
  | 'User'
  | 'Client User';

// Flat permission key map — null means "use role default"
export type UserPermissions = Partial<Record<PermissionKey, boolean>> & { is_test_user?: boolean };

export type PermissionKey =
  // Projects
  | 'projects.view_all'
  | 'projects.view_assigned'
  | 'projects.create'
  | 'projects.edit'
  | 'projects.archive'
  | 'projects.delete'
  | 'projects.view_financials'
  // Tender Tracker
  | 'tender.view'
  | 'tender.rfi.create'
  | 'tender.rfi.edit'
  | 'tender.rfi.delete'
  | 'tender.assumptions.edit'
  | 'tender.exclusions.edit'
  | 'tender.scope_notes.edit'
  | 'tender.risks.edit'
  | 'tender.reclassify'
  | 'tender.reconcile'
  | 'tender.view_financials'
  // Commercial
  | 'commercial.view_pricing'
  | 'commercial.edit_pricing'
  | 'commercial.view_rates'
  | 'commercial.view_values'
  | 'commercial.view_reports'
  | 'commercial.export_reports'
  | 'commercial.edit_project_finance_progress'
  // AI
  | 'ai.upload_docs'
  | 'ai.run_review'
  | 'ai.approve_findings'
  | 'ai.reconcile'
  | 'ai.import'
  | 'ai.export'
  // Documents
  | 'docs.view'
  | 'docs.upload'
  | 'docs.download'
  | 'docs.delete'
  | 'docs.view_confidential'
  // Client / External
  | 'external.comment_only'
  | 'external.respond_tickets'
  | 'external.upload_responses'
  | 'external.view_shared_reports'
  // Admin
  | 'admin.invite_users'
  | 'admin.edit_users'
  | 'admin.assign_permissions'
  | 'admin.view_audit_logs'
  | 'admin.view_activity_register'
  | 'admin.manage_settings'
  // Module-level access gates (sidebar visibility + route access)
  | 'modules.projects'
  | 'modules.snagging'
  | 'modules.site_forms'
  | 'modules.testing'
  | 'modules.actions'
  | 'modules.comments'
  | 'modules.reports'
  // Snagging — action-level
  | 'snagging.create'
  | 'snagging.edit'
  | 'snagging.delete'
  | 'snagging.export'
  // Actions — action-level
  | 'actions.create'
  | 'actions.edit'
  | 'actions.delete'
  | 'actions.export'
  // Site Forms — action-level
  | 'site_forms.create'
  | 'site_forms.edit'
  | 'site_forms.delete'
  | 'site_forms.export'
  // Testing & Commissioning — action-level
  | 'commissioning.create'
  | 'commissioning.edit'
  | 'commissioning.delete'
  | 'commissioning.export'
  // Maintenance & Servicing
  | 'maintenance.view'
  | 'maintenance.create'
  | 'maintenance.edit'
  | 'maintenance.delete'
  | 'maintenance.assign'
  | 'maintenance.export'
  | 'maintenance.comment'
  | 'maintenance.upload'
  | 'maintenance.complete'
  // Programmes
  | 'programmes.view'
  | 'programmes.create'
  | 'programmes.edit'
  | 'programmes.delete'
  | 'programmes.export'
  // Commercial Module
  | 'modules.commercial'
  | 'commercial.create'
  | 'commercial.edit'
  | 'commercial.delete'
  // Supply Chain
  | 'modules.supply_chain'
  | 'supply_chain.view'
  | 'supply_chain.create_edit';

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
  permissions?: UserPermissions | null;
  auth_user_id?: string | null;
  org_id?: string | null;
  created_at?: string;
}

// ─── Role default permission templates ───────────────────────────────────────

export const ROLE_PERMISSIONS: Record<PlatformUserRole, Partial<Record<PermissionKey, boolean>>> = {
  Admin: {
    'projects.view_all': true, 'projects.view_assigned': true, 'projects.create': true,
    'projects.edit': true, 'projects.archive': true, 'projects.delete': true,
    'tender.view': true, 'tender.rfi.create': true, 'tender.rfi.edit': true, 'tender.rfi.delete': true,
    'tender.assumptions.edit': true, 'tender.exclusions.edit': true, 'tender.scope_notes.edit': true,
    'tender.risks.edit': true, 'tender.reclassify': true, 'tender.reconcile': true,
    'projects.view_financials': true, 'tender.view_financials': true,
    'commercial.view_pricing': true, 'commercial.edit_pricing': true, 'commercial.view_rates': true,
    'commercial.view_values': true, 'commercial.view_reports': true, 'commercial.export_reports': true,
    'commercial.edit_project_finance_progress': true,
    'ai.upload_docs': true, 'ai.run_review': true, 'ai.approve_findings': true, 'ai.reconcile': true,
    'ai.import': true, 'ai.export': true,
    'docs.view': true, 'docs.upload': true, 'docs.download': true, 'docs.delete': true, 'docs.view_confidential': true,
    'admin.invite_users': true, 'admin.edit_users': true, 'admin.assign_permissions': true,
    'admin.view_audit_logs': true, 'admin.view_activity_register': true, 'admin.manage_settings': true,
    'modules.projects': true, 'modules.snagging': true, 'modules.site_forms': true, 'modules.testing': true,
    'modules.actions': true, 'modules.comments': true, 'modules.reports': true,
    'snagging.create': true, 'snagging.edit': true, 'snagging.delete': true, 'snagging.export': true,
    'actions.create': true, 'actions.edit': true, 'actions.delete': true, 'actions.export': true,
    'site_forms.create': true, 'site_forms.edit': true, 'site_forms.delete': true, 'site_forms.export': true,
    'commissioning.create': true, 'commissioning.edit': true, 'commissioning.delete': true, 'commissioning.export': true,
    'maintenance.view': true, 'maintenance.create': true, 'maintenance.edit': true, 'maintenance.delete': true,
    'maintenance.assign': true, 'maintenance.export': true, 'maintenance.comment': true, 'maintenance.upload': true, 'maintenance.complete': true,
    'programmes.view': true, 'programmes.create': true, 'programmes.edit': true, 'programmes.delete': true, 'programmes.export': true,
    'modules.commercial': true, 'commercial.create': true, 'commercial.edit': true, 'commercial.delete': true,
    'modules.supply_chain': true, 'supply_chain.view': true, 'supply_chain.create_edit': true,
  },
  'Commercial Lead': {
    'projects.view_all': true, 'projects.view_assigned': true,
    'tender.view': true, 'tender.rfi.create': true, 'tender.rfi.edit': true,
    'tender.assumptions.edit': true, 'tender.exclusions.edit': true, 'tender.scope_notes.edit': true,
    'tender.risks.edit': true, 'tender.reclassify': true, 'tender.reconcile': true,
    'projects.view_financials': true, 'tender.view_financials': true,
    'commercial.view_pricing': true, 'commercial.edit_pricing': true, 'commercial.view_rates': true,
    'commercial.view_values': true, 'commercial.view_reports': true, 'commercial.export_reports': true,
    'commercial.edit_project_finance_progress': true,
    'ai.upload_docs': true, 'ai.run_review': true, 'ai.approve_findings': true, 'ai.reconcile': true,
    'ai.import': true, 'ai.export': true,
    'docs.view': true, 'docs.upload': true, 'docs.download': true,
    'modules.projects': true, 'modules.snagging': true, 'modules.site_forms': true, 'modules.testing': true,
    'modules.actions': true, 'modules.comments': true, 'modules.reports': true,
    'snagging.create': true, 'snagging.edit': true, 'snagging.delete': true, 'snagging.export': true,
    'actions.create': true, 'actions.edit': true, 'actions.delete': true, 'actions.export': true,
    'site_forms.create': true, 'site_forms.edit': true, 'site_forms.delete': true, 'site_forms.export': true,
    'commissioning.create': true, 'commissioning.edit': true, 'commissioning.delete': true, 'commissioning.export': true,
    'maintenance.view': true, 'maintenance.create': true, 'maintenance.edit': true, 'maintenance.delete': true,
    'maintenance.assign': true, 'maintenance.export': true, 'maintenance.comment': true, 'maintenance.upload': true, 'maintenance.complete': true,
    'programmes.view': true, 'programmes.create': true, 'programmes.edit': true, 'programmes.delete': true, 'programmes.export': true,
    'modules.commercial': true, 'commercial.create': true, 'commercial.edit': true, 'commercial.delete': true,
    'modules.supply_chain': true, 'supply_chain.view': true,
  },
  'Project Manager': {
    'projects.view_assigned': true, 'projects.edit': true,
    'projects.view_financials': true,
    'tender.view': true, 'tender.rfi.create': true, 'tender.rfi.edit': true,
    'tender.assumptions.edit': true, 'tender.scope_notes.edit': true, 'tender.risks.edit': true,
    'docs.view': true, 'docs.upload': true, 'docs.download': true,
    'modules.projects': true, 'modules.snagging': true, 'modules.site_forms': true, 'modules.testing': true,
    'modules.actions': true, 'modules.comments': true, 'modules.reports': true,
    'snagging.create': true, 'snagging.edit': true, 'snagging.delete': false, 'snagging.export': true,
    'actions.create': true, 'actions.edit': true, 'actions.delete': false, 'actions.export': true,
    'site_forms.create': true, 'site_forms.edit': true, 'site_forms.delete': false, 'site_forms.export': true,
    'commissioning.create': true, 'commissioning.edit': true, 'commissioning.delete': false, 'commissioning.export': true,
    'maintenance.view': true, 'maintenance.create': true, 'maintenance.edit': true, 'maintenance.delete': false,
    'maintenance.assign': true, 'maintenance.export': true, 'maintenance.comment': true, 'maintenance.upload': true, 'maintenance.complete': true,
    'programmes.view': true, 'programmes.create': true, 'programmes.edit': true, 'programmes.delete': false, 'programmes.export': true,
  },
  'Site Manager': {
    'projects.view_assigned': true,
    'tender.view': false, 'tender.rfi.create': false,
    'docs.view': true, 'docs.upload': true, 'docs.download': true,
    'external.comment_only': true, 'external.respond_tickets': true, 'external.upload_responses': true,
    'modules.projects': true, 'modules.snagging': true, 'modules.site_forms': true, 'modules.testing': true,
    'modules.actions': true, 'modules.comments': true, 'modules.reports': false,
    'snagging.create': true, 'snagging.edit': true, 'snagging.delete': false, 'snagging.export': true,
    'actions.create': true, 'actions.edit': true, 'actions.delete': false, 'actions.export': true,
    'site_forms.create': true, 'site_forms.edit': true, 'site_forms.delete': false, 'site_forms.export': true,
    'commissioning.create': true, 'commissioning.edit': true, 'commissioning.delete': false, 'commissioning.export': true,
    'maintenance.view': true, 'maintenance.create': false, 'maintenance.edit': true, 'maintenance.delete': false,
    'maintenance.assign': false, 'maintenance.export': true, 'maintenance.comment': true, 'maintenance.upload': true, 'maintenance.complete': true,
    'programmes.view': true, 'programmes.create': false, 'programmes.edit': true, 'programmes.delete': false, 'programmes.export': true,
  },
  Engineer: {
    'projects.view_assigned': true,
    'tender.view': true, 'tender.rfi.create': true,
    'docs.view': true, 'docs.upload': true, 'docs.download': true,
    'modules.projects': true, 'modules.snagging': true, 'modules.site_forms': true, 'modules.testing': true,
    'modules.actions': true, 'modules.comments': true, 'modules.reports': false,
    'snagging.create': true, 'snagging.edit': true, 'snagging.delete': false, 'snagging.export': true,
    'actions.create': true, 'actions.edit': true, 'actions.delete': false, 'actions.export': true,
    'site_forms.create': true, 'site_forms.edit': true, 'site_forms.delete': false, 'site_forms.export': true,
    'commissioning.create': true, 'commissioning.edit': true, 'commissioning.delete': false, 'commissioning.export': true,
    'maintenance.view': true, 'maintenance.create': false, 'maintenance.edit': true, 'maintenance.delete': false,
    'maintenance.assign': false, 'maintenance.export': true, 'maintenance.comment': true, 'maintenance.upload': true, 'maintenance.complete': true,
    'programmes.view': true, 'programmes.create': false, 'programmes.edit': true, 'programmes.delete': false, 'programmes.export': true,
  },
  'Estimator / QS': {
    'projects.view_assigned': true,
    'tender.view': true, 'tender.rfi.create': true, 'tender.rfi.edit': true,
    'tender.assumptions.edit': true, 'tender.exclusions.edit': true, 'tender.scope_notes.edit': true,
    'tender.risks.edit': true, 'tender.reclassify': true, 'tender.reconcile': true,
    'projects.view_financials': true, 'tender.view_financials': true,
    'commercial.view_pricing': true, 'commercial.edit_pricing': true, 'commercial.view_rates': true,
    'commercial.view_values': true, 'commercial.view_reports': true, 'commercial.export_reports': true,
    'ai.upload_docs': true, 'ai.run_review': true, 'ai.approve_findings': true, 'ai.reconcile': true,
    'ai.import': true, 'ai.export': true,
    'docs.view': true, 'docs.upload': true, 'docs.download': true,
    'modules.projects': true, 'modules.snagging': false, 'modules.site_forms': false, 'modules.testing': false,
    'modules.actions': false, 'modules.comments': true, 'modules.reports': true,
    'snagging.create': false, 'snagging.edit': false, 'snagging.delete': false, 'snagging.export': false,
    'actions.create': false, 'actions.edit': false, 'actions.delete': false, 'actions.export': false,
    'site_forms.create': false, 'site_forms.edit': false, 'site_forms.delete': false, 'site_forms.export': false,
    'commissioning.create': false, 'commissioning.edit': false, 'commissioning.delete': false, 'commissioning.export': false,
    'maintenance.view': false, 'maintenance.create': false, 'maintenance.edit': false, 'maintenance.delete': false,
    'maintenance.assign': false, 'maintenance.export': false, 'maintenance.comment': false, 'maintenance.upload': false, 'maintenance.complete': false,
    'programmes.view': false, 'programmes.create': false, 'programmes.edit': false, 'programmes.delete': false, 'programmes.export': false,
    'modules.commercial': true, 'commercial.create': true, 'commercial.edit': true, 'commercial.delete': false,
  },
  Client: {
    // Least privileged role — project overview only, no operational submodules.
    'projects.view_assigned': true,
    'external.comment_only': true,
    'external.view_shared_reports': true,
    'modules.projects': true, 'modules.snagging': false, 'modules.site_forms': false, 'modules.testing': false,
    'modules.actions': false, 'modules.comments': false, 'modules.reports': false,
    'snagging.create': false, 'snagging.edit': false, 'snagging.delete': false, 'snagging.export': false,
    'actions.create': false, 'actions.edit': false, 'actions.delete': false, 'actions.export': false,
    'site_forms.create': false, 'site_forms.edit': false, 'site_forms.delete': false, 'site_forms.export': false,
    'commissioning.create': false, 'commissioning.edit': false, 'commissioning.delete': false, 'commissioning.export': false,
    'maintenance.view': false, 'maintenance.create': false, 'maintenance.edit': false, 'maintenance.delete': false,
    'maintenance.assign': false, 'maintenance.export': false, 'maintenance.comment': false, 'maintenance.upload': false, 'maintenance.complete': false,
    'programmes.view': false, 'programmes.create': false, 'programmes.edit': false, 'programmes.delete': false, 'programmes.export': false,
  },
  'External / Subcontractor': {
    // View and respond to assigned items only — no operational submodules.
    'projects.view_assigned': true,
    'external.comment_only': true,
    'external.respond_tickets': true,
    'external.upload_responses': true,
    'modules.projects': true, 'modules.snagging': false, 'modules.site_forms': false, 'modules.testing': false,
    'modules.actions': false, 'modules.comments': false, 'modules.reports': false,
    'snagging.create': false, 'snagging.edit': false, 'snagging.delete': false, 'snagging.export': false,
    'actions.create': false, 'actions.edit': false, 'actions.delete': false, 'actions.export': false,
    'site_forms.create': false, 'site_forms.edit': false, 'site_forms.delete': false, 'site_forms.export': false,
    'commissioning.create': false, 'commissioning.edit': false, 'commissioning.delete': false, 'commissioning.export': false,
    'maintenance.view': false, 'maintenance.create': false, 'maintenance.edit': false, 'maintenance.delete': false,
    'maintenance.assign': false, 'maintenance.export': false, 'maintenance.comment': false, 'maintenance.upload': false, 'maintenance.complete': false,
    'programmes.view': false, 'programmes.create': false, 'programmes.edit': false, 'programmes.delete': false, 'programmes.export': false,
  },
  // Legacy aliases — map to closest equivalent defaults
  Manager: {
    'projects.view_all': true, 'projects.view_assigned': true, 'projects.create': true, 'projects.edit': true,
    'tender.view': true, 'tender.rfi.create': true, 'tender.rfi.edit': true,
    'tender.assumptions.edit': true, 'tender.exclusions.edit': true, 'tender.scope_notes.edit': true,
    'tender.risks.edit': true,
    'projects.view_financials': true, 'tender.view_financials': true,
    'commercial.view_pricing': true, 'commercial.view_values': true,
    'docs.view': true, 'docs.upload': true, 'docs.download': true,
    'modules.projects': true, 'modules.snagging': true, 'modules.site_forms': true, 'modules.testing': true,
    'modules.actions': true, 'modules.comments': true, 'modules.reports': true,
    'snagging.create': true, 'snagging.edit': true, 'snagging.delete': false, 'snagging.export': true,
    'actions.create': true, 'actions.edit': true, 'actions.delete': false, 'actions.export': true,
    'site_forms.create': true, 'site_forms.edit': true, 'site_forms.delete': false, 'site_forms.export': true,
    'commissioning.create': true, 'commissioning.edit': true, 'commissioning.delete': false, 'commissioning.export': true,
    'maintenance.view': true, 'maintenance.create': true, 'maintenance.edit': true, 'maintenance.delete': false,
    'maintenance.assign': true, 'maintenance.export': true, 'maintenance.comment': true, 'maintenance.upload': true, 'maintenance.complete': true,
    'programmes.view': true, 'programmes.create': true, 'programmes.edit': true, 'programmes.delete': false, 'programmes.export': true,
    'modules.commercial': true, 'commercial.create': true, 'commercial.edit': true, 'commercial.delete': false,
  },
  User: {
    'projects.view_assigned': true,
    'docs.view': true, 'docs.upload': true,
    'modules.projects': true, 'modules.snagging': true, 'modules.site_forms': true, 'modules.testing': true,
    'modules.actions': true, 'modules.comments': true, 'modules.reports': false,
    'snagging.create': true, 'snagging.edit': true, 'snagging.delete': false, 'snagging.export': true,
    'actions.create': true, 'actions.edit': true, 'actions.delete': false, 'actions.export': true,
    'site_forms.create': true, 'site_forms.edit': true, 'site_forms.delete': false, 'site_forms.export': true,
    'commissioning.create': true, 'commissioning.edit': true, 'commissioning.delete': false, 'commissioning.export': true,
    'maintenance.view': true, 'maintenance.create': false, 'maintenance.edit': true, 'maintenance.delete': false,
    'maintenance.assign': false, 'maintenance.export': true, 'maintenance.comment': true, 'maintenance.upload': true, 'maintenance.complete': true,
    'programmes.view': true, 'programmes.create': false, 'programmes.edit': true, 'programmes.delete': false, 'programmes.export': true,
  },
  'Client User': {
    'projects.view_assigned': true,
    'docs.view': true, 'docs.download': true,
    'external.comment_only': true, 'external.view_shared_reports': true,
    'modules.projects': true, 'modules.snagging': false, 'modules.site_forms': false, 'modules.testing': false,
    'modules.actions': false, 'modules.comments': false, 'modules.reports': false,
    'snagging.create': false, 'snagging.edit': false, 'snagging.delete': false, 'snagging.export': false,
    'actions.create': false, 'actions.edit': false, 'actions.delete': false, 'actions.export': false,
    'site_forms.create': false, 'site_forms.edit': false, 'site_forms.delete': false, 'site_forms.export': false,
    'commissioning.create': false, 'commissioning.edit': false, 'commissioning.delete': false, 'commissioning.export': false,
    'maintenance.view': false, 'maintenance.create': false, 'maintenance.edit': false, 'maintenance.delete': false,
    'maintenance.assign': false, 'maintenance.export': false, 'maintenance.comment': false, 'maintenance.upload': false, 'maintenance.complete': false,
    'programmes.view': false, 'programmes.create': false, 'programmes.edit': false, 'programmes.delete': false, 'programmes.export': false,
  },
};

// Resolve effective permissions for a user (role defaults + overrides)
export function resolvePermissions(user: DBPlatformUser): Record<PermissionKey, boolean> {
  const defaults = ROLE_PERMISSIONS[user.role] ?? {};
  const overrides = user.permissions ?? {};
  const all = {} as Record<PermissionKey, boolean>;
  const allKeys: PermissionKey[] = [
    'projects.view_all','projects.view_assigned','projects.create','projects.edit','projects.archive','projects.delete',
    'projects.view_financials',
    'tender.view','tender.rfi.create','tender.rfi.edit','tender.rfi.delete',
    'tender.assumptions.edit','tender.exclusions.edit','tender.scope_notes.edit','tender.risks.edit',
    'tender.reclassify','tender.reconcile','tender.view_financials',
    'commercial.view_pricing','commercial.edit_pricing','commercial.view_rates','commercial.view_values',
    'commercial.view_reports','commercial.export_reports','commercial.edit_project_finance_progress',
    'ai.upload_docs','ai.run_review','ai.approve_findings','ai.reconcile','ai.import','ai.export',
    'docs.view','docs.upload','docs.download','docs.delete','docs.view_confidential',
    'external.comment_only','external.respond_tickets','external.upload_responses','external.view_shared_reports',
    'admin.invite_users','admin.edit_users','admin.assign_permissions','admin.view_audit_logs','admin.manage_settings',
    'modules.projects','modules.snagging','modules.site_forms','modules.testing','modules.actions','modules.comments','modules.reports',
    'snagging.create','snagging.edit','snagging.delete','snagging.export',
    'actions.create','actions.edit','actions.delete','actions.export',
    'site_forms.create','site_forms.edit','site_forms.delete','site_forms.export',
    'commissioning.create','commissioning.edit','commissioning.delete','commissioning.export',
    'maintenance.view','maintenance.create','maintenance.edit','maintenance.delete',
    'maintenance.assign','maintenance.export','maintenance.comment','maintenance.upload','maintenance.complete',
    'programmes.view','programmes.create','programmes.edit','programmes.delete','programmes.export',
    'modules.commercial','commercial.create','commercial.edit','commercial.delete',
  ];
  for (const key of allKeys) {
    all[key] = key in overrides ? (overrides[key] ?? false) : (defaults[key] ?? false);
  }
  return all;
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
  committed?: number | null;
  variations_value?: number | null;
}

export interface DBProjectDocument {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  doc_title?: string;
  type: string;
  size: number;
  category: string;
  data_url?: string;
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
  snag_number?: string | null;
  report_id?: string | null;
  extra_data?: Record<string, unknown> | null;
}

export interface DBSnaggingReport {
  id: string;
  org_id?: string;
  project_id: string;
  project_name: string;
  title: string;
  area_block: string;
  floor_location: string;
  inspection_date: string;
  inspector: string;
  contractor: string;
  client: string;
  status: string;
  overall_completion_pct: number;
  notes: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
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
  contract_review?: unknown;  // legacy — kept for backward compat read
  contract_reviews?: unknown;
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
    committed: r.committed ?? null,
    variationsValue: r.variations_value ?? null,
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
    committed: p.committed ?? null,
    variations_value: p.variationsValue ?? null,
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
    // Extended fields stored in extra_data
    ...(r.extra_data ?? {}),
    snagNumber: r.snag_number ?? (r.extra_data as Record<string, unknown>)?.snagNumber ?? undefined,
    reportId: r.report_id ?? undefined,
  } as Snag;
}

function snagToDB(s: Snag & { snagNumber?: string; reportId?: string; extra_data?: Record<string, unknown> }): DBSnag {
  // Pull out known top-level fields; pack everything else into extra_data
  const { id, projectId, projectName, title, description, priority, status,
          assignedTo, raisedBy, raisedDate, dueDate, location, comments,
          snagNumber, reportId, extra_data, ...rest } = s as unknown as Record<string, unknown>;
  return {
    id: id as string,
    project_id: projectId as string,
    project_name: projectName as string,
    title: title as string,
    description: description as string,
    priority: priority as string,
    status: status as string,
    assigned_to: assignedTo as string,
    raised_by: raisedBy as string,
    raised_date: raisedDate as string,
    due_date: dueDate as string,
    location: location as string,
    comments: (comments as string[]) ?? [],
    snag_number: (snagNumber as string) ?? null,
    report_id: (reportId as string) ?? null,
    extra_data: { ...((extra_data as Record<string, unknown>) ?? {}), ...(rest as Record<string, unknown>) },
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
    contractReviews: migrateContractReviews(r),
  };
}

// Reads the new contract_reviews array, falling back to the legacy single
// contract_review object so no existing data is lost on upgrade.
function migrateContractReviews(r: DBTender): ContractReviewRecord[] | undefined {
  if (Array.isArray(r.contract_reviews) && r.contract_reviews.length > 0) {
    return r.contract_reviews as ContractReviewRecord[];
  }
  // Migrate legacy single-review object into the new array shape
  if (r.contract_review && typeof r.contract_review === 'object') {
    const legacy = r.contract_review as StoredContractReview;
    const migrated: ContractReviewRecord = {
      id: `cr-migrated-${Date.now()}`,
      title: legacy.documentName ?? 'Contract Review',
      createdAt: legacy.reviewedAt ?? new Date().toISOString(),
      createdBy: '',
      documents: legacy.documentName
        ? [{ name: legacy.documentName, size: 0, type: 'application/pdf', addedAt: legacy.reviewedAt ?? new Date().toISOString() }]
        : [],
      executiveSummary: legacy.executiveSummary ?? '',
      findings: legacy.findings ?? [],
      commercialHandoverNotes: legacy.commercialHandoverNotes ?? '',
      notes: '',
      savedToDocuments: false,
    };
    return [migrated];
  }
  return undefined;
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
    contract_reviews: t.contractReviews ?? null,
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

// ─── Maintenance Job ──────────────────────────────────────────────────────────

export type MaintenanceStatus =
  | 'New Job'
  | 'Engineer Allocated'
  | 'Site Visit Booked'
  | 'Attended'
  | 'Awaiting Decision'
  | 'Awaiting Quote Approval'
  | 'Awaiting Materials'
  | 'Materials Ordered'
  | 'Reattend Required'
  | 'Follow-Up Required'
  | 'Job Complete'
  | 'Ready to Invoice'
  | 'Invoiced'
  | 'Closed / Complete'
  | 'Cancelled';

export type MaintenancePriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface MaintenanceMaterial {
  id: string;
  item: string;
  qty: string;
  unit: string;
}

export interface MaintenanceComment {
  id: string;
  user: string;
  datetime: string;
  text: string;
  type?: 'comment' | 'engineer' | 'internal' | 'status';
}

export interface DBMaintenanceJob {
  id: string;
  job_number: string;
  client_name: string;
  site_address: string;
  contact_name: string;
  contact_number: string;
  assigned_engineer: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  engineer_notes: string;
  internal_notes: string;
  materials: MaintenanceMaterial[];
  comments: MaintenanceComment[];
  target_date: string;
  completion_date: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Programmes ───────────────────────────────────────────────────────────────

export type ProgrammeTaskStatus = 'Not Started' | 'In Progress' | 'Awaiting Others' | 'Blocked' | 'Complete';

export interface DBProgrammeTask {
  id: string;
  org_id?: string;
  programme_id: string;
  project_id: string;
  task_name: string;
  assigned_to: string;
  start_date: string;
  finish_date: string;
  status: ProgrammeTaskStatus;
  notes: string;
  sort_order: number;
  created_at?: string;
}

export interface DBProgramme {
  id: string;
  org_id?: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface DBKeyDate {
  id: string;
  org_id?: string;
  project_id: string;
  project_name: string;
  title: string;
  date: string;
  description: string;
  comments: string;
  status: string;
  created_by: string;
  created_date: string;
  updated_at?: string;
}

export interface DBVariationAccountItem {
  id: string;
  org_id?: string;
  project_id: string;
  reference: string;
  title: string;
  description: string;
  reason: string;
  value: number;
  is_positive: boolean;
  status: string;
  date_raised: string | null;
  date_agreed: string | null;
  notes: string;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DBVABuildUpLine {
  id: string;
  org_id?: string;
  project_id: string;
  va_item_id: string;
  line_no: number;
  description: string;
  type: string;
  unit: string;
  quantity: number;
  cost_price: number;
  markup_pct: number;
  sales_price: number;
  line_total: number;
  created_at?: string;
  updated_at?: string;
}

export interface DBVAComment {
  id: string;
  org_id?: string;
  project_id: string;
  va_item_id: string;
  body: string;
  author_name: string;
  author_id: string;
  created_at?: string;
}

export interface DBCommercialRecordComment {
  id: string;
  org_id?: string;
  record_id: string;
  body: string;
  author_name: string;
  author_id: string;
  created_at?: string;
}

// ─── O&M Manual ───────────────────────────────────────────────────────────────

export type OAndMManualStatus = 'draft' | 'in_progress' | 'finalised';
export type OAndMSourceModule = 'tc_record' | 'site_form' | 'project_document';

export interface DBOAndMManual {
  id: string;
  org_id?: string;
  project_id: string;
  title: string;
  status: OAndMManualStatus;
  version: string;
  notes: string;
  introduction: string;
  cover_image_data_url: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface DBOAndMSection {
  id: string;
  org_id?: string;
  manual_id: string;
  project_id: string;
  title: string;
  description: string;
  sort_order: number;
  created_at?: string;
}

export interface DBOAndMItem {
  id: string;
  org_id?: string;
  section_id: string;
  manual_id: string;
  project_id: string;
  source_module: OAndMSourceModule;
  source_record_id: string;
  title: string;
  subtitle: string;
  notes: string;
  sort_order: number;
  created_by: string;
  created_at?: string;
}

export interface DBCommercialApplication {
  id: string;
  org_id?: string;
  project_id: string;
  app_number: number;
  period: string;
  app_date: string | null;
  payment_due: string | null;
  payment_recd: string | null;
  applied_value: number;
  certified_value: number;
  paid_value: number;
  retention: number;
  status: string;
  notes: string;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DBCommercialRecord {
  id: string;
  org_id?: string;
  project_id: string | null;
  record_type: string;
  reference: string;
  title: string;
  client: string;
  status: string;
  date_raised: string | null;
  date_submitted: string | null;
  date_agreed: string | null;
  notes: string;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
  converted_to_id?: string | null;
  converted_from_id?: string | null;
}

// ─── Main store hook ──────────────────────────────────────────────────────────

export interface DBValuation {
  id: string;
  org_id?: string;
  project_id: string;
  workbook_id?: string;
  ref: string;
  title: string;
  valuation_date: string;
  period: string;
  client: string;
  contractor: string;
  notes: string;
  status: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface DBValuationWorkbook {
  id: string;
  org_id?: string;
  project_id: string;
  title: string;
  retention_pct?: number;
  mcd_pct?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DBWorkbookLine {
  id: string;
  org_id?: string;
  workbook_id: string;
  item_number: string;
  description: string;
  section: string;
  unit: string;
  quantity: number | null;
  rate: number | null;
  contract_value: number;
  sort_order: number;
  created_at?: string;
}

export interface DBWorkbookExtra {
  id: string;
  org_id?: string;
  workbook_id: string;
  ref: string;
  description: string;
  agreed_value: number;
  sort_order: number;
  created_at?: string;
}

export interface DBValuationLineEntry {
  id: string;
  org_id?: string;
  valuation_id: string;
  workbook_line_id: string;
  previous_pct: number;
  current_pct: number;
  notes: string;
}

export interface DBValuationExtraEntry {
  id: string;
  org_id?: string;
  valuation_id: string;
  workbook_extra_id: string;
  previous_pct: number;
  current_pct: number;
  notes: string;
}

export interface AppStore {
  projects: Project[];
  projectDocuments: DBProjectDocument[];
  attachments: DBAttachment[];
  actions: Action[];
  snags: Snag[];
  snaggingReports: DBSnaggingReport[];
  siteForms: DBSiteForm[];
  tenders: Tender[];
  tcRecords: DBTCRecord[];
  maintenanceJobs: DBMaintenanceJob[];
  programmes: DBProgramme[];
  programmeTasks: DBProgrammeTask[];
  keyDates: DBKeyDate[];
  platformUsers: DBPlatformUser[];
  notifications: DBNotification[];
  loading: boolean;
  // True while Phase 2 background queries (module data) are still in flight.
  // Check this in module pages to show a loading skeleton instead of "no records".
  modulesLoading: boolean;
  currentUser: DBPlatformUser | null;
  currentOrgId: string | null;
  visibleProjectIds: string[] | null; // null = all (Admin)
  switchUser: (name: string) => void;
  settings: DBSettings;
  updateSettings: (s: DBSettings) => Promise<void>;

  // Projects
  addProject: (p: Project) => Promise<string | null>;
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

  // Snagging Reports
  addSnaggingReport: (r: DBSnaggingReport) => Promise<void>;
  updateSnaggingReport: (r: DBSnaggingReport) => Promise<void>;
  removeSnaggingReport: (id: string) => Promise<void>;

  // Site forms
  addSiteForm: (f: DBSiteForm) => Promise<void>;
  updateSiteForm: (f: DBSiteForm) => Promise<void>;
  removeSiteForm: (id: string) => Promise<void>;

  // Tenders
  addTender: (t: Tender) => Promise<string | null>;
  updateTender: (t: Tender) => Promise<void>;
  removeTender: (id: string) => Promise<void>;

  // TC Records
  addTCRecord: (r: DBTCRecord) => Promise<void>;
  updateTCRecord: (r: DBTCRecord) => Promise<void>;
  removeTCRecord: (id: string) => Promise<void>;

  // Maintenance Jobs
  addMaintenanceJob: (j: DBMaintenanceJob) => Promise<void>;
  updateMaintenanceJob: (j: DBMaintenanceJob) => Promise<void>;
  removeMaintenanceJob: (id: string) => Promise<void>;

  // Programmes
  addProgramme: (p: DBProgramme) => Promise<void>;
  updateProgramme: (p: DBProgramme) => Promise<void>;
  removeProgramme: (id: string) => Promise<void>;
  addProgrammeTask: (t: DBProgrammeTask) => Promise<void>;
  updateProgrammeTask: (t: DBProgrammeTask) => Promise<void>;
  removeProgrammeTask: (id: string) => Promise<void>;

  // Key Dates
  addKeyDate: (d: DBKeyDate) => Promise<void>;
  updateKeyDate: (d: DBKeyDate) => Promise<void>;
  removeKeyDate: (id: string) => Promise<void>;

  // Platform Users
  addPlatformUser: (u: DBPlatformUser) => Promise<void>;
  updatePlatformUser: (u: DBPlatformUser) => Promise<void>;
  removePlatformUser: (id: string) => Promise<void>;

  // Notifications
  addNotification: (n: DBNotification) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Variation Account
  variationAccountItems: DBVariationAccountItem[];
  addVariationAccountItem: (v: DBVariationAccountItem) => Promise<void>;
  updateVariationAccountItem: (v: DBVariationAccountItem) => Promise<void>;
  removeVariationAccountItem: (id: string) => Promise<void>;

  // VA Build-Up Lines
  vaBuildUpLines: DBVABuildUpLine[];
  addVABuildUpLine: (l: DBVABuildUpLine) => Promise<void>;
  updateVABuildUpLine: (l: DBVABuildUpLine) => Promise<void>;
  removeVABuildUpLine: (id: string) => Promise<void>;

  // VA Comments
  vaComments: DBVAComment[];
  addVAComment: (c: DBVAComment) => Promise<void>;
  removeVAComment: (id: string) => Promise<void>;

  // Commercial Record Comments
  commercialRecordComments: DBCommercialRecordComment[];
  addCommercialRecordComment: (c: DBCommercialRecordComment) => Promise<void>;
  removeCommercialRecordComment: (id: string) => Promise<void>;

  // On-demand loaders for detail data excluded from startup
  loadVADetailData: () => Promise<void>;
  loadCommercialRecordComments: () => Promise<void>;

  // Commercial Applications
  commercialApplications: DBCommercialApplication[];
  addCommercialApplication: (a: DBCommercialApplication) => Promise<void>;
  updateCommercialApplication: (a: DBCommercialApplication) => Promise<void>;
  removeCommercialApplication: (id: string) => Promise<void>;

  // O&M Manual
  oAndMManuals: DBOAndMManual[];
  oAndMSections: DBOAndMSection[];
  oAndMItems: DBOAndMItem[];
  addOAndMManual: (m: DBOAndMManual) => Promise<void>;
  updateOAndMManual: (m: DBOAndMManual) => Promise<void>;
  removeOAndMManual: (id: string) => Promise<void>;
  addOAndMSection: (s: DBOAndMSection) => Promise<void>;
  updateOAndMSection: (s: DBOAndMSection) => Promise<void>;
  removeOAndMSection: (id: string) => Promise<void>;
  reorderOAndMSections: (sections: DBOAndMSection[]) => Promise<void>;
  addOAndMItem: (item: DBOAndMItem) => Promise<void>;
  updateOAndMItem: (item: DBOAndMItem) => Promise<void>;
  removeOAndMItem: (id: string) => Promise<void>;
  reorderOAndMItems: (items: DBOAndMItem[]) => Promise<void>;

  // Valuations
  valuations: DBValuation[];
  valuationWorkbooks: DBValuationWorkbook[];
  workbookLines: DBWorkbookLine[];
  workbookExtras: DBWorkbookExtra[];
  valuationLineEntries: DBValuationLineEntry[];
  valuationExtraEntries: DBValuationExtraEntry[];
  addValuation: (v: DBValuation) => Promise<void>;
  updateValuation: (v: DBValuation) => Promise<void>;
  removeValuation: (id: string) => Promise<void>;
  addValuationWorkbook: (w: DBValuationWorkbook) => Promise<void>;
  updateValuationWorkbook: (w: DBValuationWorkbook) => Promise<void>;
  removeValuationWorkbook: (workbookId: string, projectId: string) => Promise<void>;
  addWorkbookLine: (l: DBWorkbookLine) => Promise<void>;
  updateWorkbookLine: (l: DBWorkbookLine) => Promise<void>;
  removeWorkbookLine: (id: string) => Promise<void>;
  batchAddWorkbookLines: (lines: DBWorkbookLine[]) => Promise<void>;
  addWorkbookExtra: (e: DBWorkbookExtra) => Promise<void>;
  updateWorkbookExtra: (e: DBWorkbookExtra) => Promise<void>;
  removeWorkbookExtra: (id: string) => Promise<void>;
  batchAddWorkbookExtras: (extras: DBWorkbookExtra[]) => Promise<void>;
  upsertValuationLineEntry: (e: DBValuationLineEntry) => Promise<void>;
  batchUpsertValuationLineEntries: (entries: DBValuationLineEntry[]) => Promise<void>;
  upsertValuationExtraEntry: (e: DBValuationExtraEntry) => Promise<void>;
  batchUpsertValuationExtraEntries: (entries: DBValuationExtraEntry[]) => Promise<void>;

  // Supply Chain
  suppliers: DBSupplier[];
  supplierTrades: DBSupplierTrade[];
  supplierSpecialisms: DBSupplierSpecialism[];
  supplierLabourRateTypes: DBSupplierLabourRateType[];
  addSupplier: (s: DBSupplier) => Promise<void>;
  updateSupplier: (s: DBSupplier) => Promise<void>;
  removeSupplier: (id: string) => Promise<void>;
  addSupplierTrade: (t: DBSupplierTrade) => Promise<void>;
  updateSupplierTrade: (t: DBSupplierTrade) => Promise<void>;
  removeSupplierTrade: (id: string) => Promise<void>;
  addSupplierSpecialism: (s: DBSupplierSpecialism) => Promise<void>;
  updateSupplierSpecialism: (s: DBSupplierSpecialism) => Promise<void>;
  removeSupplierSpecialism: (id: string) => Promise<void>;
  addSupplierLabourRateType: (rt: DBSupplierLabourRateType) => Promise<void>;
  updateSupplierLabourRateType: (rt: DBSupplierLabourRateType) => Promise<void>;
  removeSupplierLabourRateType: (id: string) => Promise<void>;
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

const DEV = import.meta.env.DEV;

// Returns orgId or null. Always logs if missing — not gated on DEV — so the
// failure is visible in the production browser console.
function getOrgId(orgId: string | null): string | null {
  if (!orgId) {
    console.error('[VYSITE] Write blocked: currentOrgId is null. User may not have a user_orgs entry, or org resolution has not completed yet.');
    return null;
  }
  return orgId;
}

function logWrite(op: string, table: string, error: unknown, data?: unknown) {
  // Errors are always logged (production + dev). Success is dev-only.
  if (error) {
    console.error(`[VYSITE] ${op} ${table} FAILED:`, error);
  } else if (DEV) {
    console.log(`[VYSITE] ${op} ${table} OK`, data ?? '');
  }
}

export function useStore(orgId: string | null, authUserId: string | null): AppStore {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDocuments, setProjectDocuments] = useState<DBProjectDocument[]>([]);
  const [attachments, setAttachments] = useState<DBAttachment[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [snags, setSnags] = useState<Snag[]>([]);
  const [snaggingReports, setSnaggingReports] = useState<DBSnaggingReport[]>([]);
  const [siteForms, setSiteForms] = useState<DBSiteForm[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [tcRecords, setTCRecords] = useState<DBTCRecord[]>([]);
  const [maintenanceJobs, setMaintenanceJobs] = useState<DBMaintenanceJob[]>([]);
  const [programmes, setProgrammes] = useState<DBProgramme[]>([]);
  const [programmeTasks, setProgrammeTasks] = useState<DBProgrammeTask[]>([]);
  const [keyDates, setKeyDates] = useState<DBKeyDate[]>([]);
  const [platformUsers, setPlatformUsers] = useState<DBPlatformUser[]>([]);
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [variationAccountItems, setVariationAccountItems] = useState<DBVariationAccountItem[]>([]);
  const [vaBuildUpLines, setVABuildUpLines] = useState<DBVABuildUpLine[]>([]);
  const [vaComments, setVAComments] = useState<DBVAComment[]>([]);
  const [commercialRecordComments, setCommercialRecordComments] = useState<DBCommercialRecordComment[]>([]);
  const [commercialApplications, setCommercialApplications] = useState<DBCommercialApplication[]>([]);
  const [oAndMManuals, setOAndMManuals] = useState<DBOAndMManual[]>([]);
  const [oAndMSections, setOAndMSections] = useState<DBOAndMSection[]>([]);
  const [oAndMItems, setOAndMItems] = useState<DBOAndMItem[]>([]);
  const [valuations, setValuations] = useState<DBValuation[]>([]);
  const [valuationWorkbooks, setValuationWorkbooks] = useState<DBValuationWorkbook[]>([]);
  const [workbookLines, setWorkbookLines] = useState<DBWorkbookLine[]>([]);
  const [workbookExtras, setWorkbookExtras] = useState<DBWorkbookExtra[]>([]);
  const [valuationLineEntries, setValuationLineEntries] = useState<DBValuationLineEntry[]>([]);
  const [valuationExtraEntries, setValuationExtraEntries] = useState<DBValuationExtraEntry[]>([]);
  const [suppliers, setSuppliers] = useState<DBSupplier[]>([]);
  const [supplierTrades, setSupplierTrades] = useState<DBSupplierTrade[]>([]);
  const [supplierSpecialisms, setSupplierSpecialisms] = useState<DBSupplierSpecialism[]>([]);
  const [supplierLabourRateTypes, setSupplierLabourRateTypes] = useState<DBSupplierLabourRateType[]>([]);
  const [settings, setSettings] = useState<DBSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  // True while Phase 2 background queries are in flight.
  // Module pages whose data comes from Phase 2 should show a loading state
  // when this is true rather than rendering "no records" against empty arrays.
  const [modulesLoading, setModulesLoading] = useState(true);

  // Keep a stable ref to orgId so callbacks always read the latest value
  // without needing to be re-created (avoids cascading re-renders).
  const orgIdRef = useRef(orgId);
  orgIdRef.current = orgId;

  useEffect(() => {
    // Block all data loading if org context is not resolved.
    // This prevents global reads and cross-org data leakage.
    if (!orgId) {
      setProjects([]);
      setProjectDocuments([]);
      setAttachments([]);
      setActions([]);
      setSnags([]);
      setSnaggingReports([]);
      setSiteForms([]);
      setTenders([]);
      setTCRecords([]);
      setMaintenanceJobs([]);
      setProgrammes([]);
      setProgrammeTasks([]);
      setKeyDates([]);
      setNotifications([]);
      setVariationAccountItems([]);
      setVABuildUpLines([]);
      setVAComments([]);
      setCommercialRecordComments([]);
      setCommercialApplications([]);
      setOAndMManuals([]);
      setOAndMSections([]);
      setOAndMItems([]);
      setSuppliers([]);
      setSupplierTrades([]);
      setSupplierSpecialisms([]);
      setSupplierLabourRateTypes([]);
      // Keep platformUsers/settings as-is — they load below with org filter
      setLoading(false);
      setModulesLoading(false);
      return;
    }

    setLoading(true);
    setModulesLoading(true);

    let cancelled = false;

    const loadingTimeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 15000);

    async function load() {
      console.log('[VYSITE] store.load() started, orgId:', orgId);
      const ATT_COLS = 'id,linked_type,linked_id,project_id,project_name,name,type,size,category,uploaded_by,created_at';
      // data_url excluded — fetched on-demand when a document is opened
      const DOC_COLS = 'id,project_id,project_name,name,doc_title,type,size,category,uploaded_by,created_at,org_id';

      // ── Phase 1: essential shell data — blocks the loading spinner ──────────
      // Keep this list short: only data needed to render the first visible screen
      // (dashboard, nav, permissions, notifications). Everything else defers.
      const [projRes, puRes, settingsRes, actRes, snaRes, notifRes, kdRes] = await Promise.all([
        supabase.from('vy_projects').select('*').eq('org_id', orgId).order('created_at', { ascending: true }),
        supabase.from('vy_platform_users').select('*').eq('org_id', orgId).order('created_at', { ascending: true }),
        supabase.from('vy_settings').select('*').eq('org_id', orgId).maybeSingle(),
        supabase.from('vy_actions').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_snags').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_notifications').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_key_dates').select('*').eq('org_id', orgId).order('date', { ascending: true }),
      ]);

      if (cancelled) return;

      console.log('[VYSITE] load() phase-1 done:',
        'projects:', projRes.data?.length ?? 0,
        '| platformUsers:', puRes.data?.length ?? 0,
        '| settings:', settingsRes.data ? 'found' : 'none',
      );
      if (projRes.error) console.error('[VYSITE] load vy_projects error:', projRes.error);
      if (puRes.error) console.error('[VYSITE] load vy_platform_users error:', puRes.error);
      if (settingsRes.error) console.error('[VYSITE] load vy_settings error:', settingsRes.error);

      setProjects((projRes.data ?? []).map(r => dbToProject(r as DBProject)));
      setPlatformUsers((puRes.data ?? []) as DBPlatformUser[]);
      if (settingsRes.data) setSettings({ ...DEFAULT_SETTINGS, ...(settingsRes.data as DBSettings) });
      setActions((actRes.data ?? []).map(r => dbToAction(r as DBAction)));
      setSnags((snaRes.data ?? []).map(r => dbToSnag(r as DBSnag)));
      setNotifications((notifRes.data ?? []) as DBNotification[]);
      setKeyDates((kdRes.data ?? []) as DBKeyDate[]);

      // Release loading spinner — UI can render now. Phase 2 runs in background.
      setLoading(false);

      // ── Phase 2: supporting data — non-blocking, loads after UI renders ─────
      // These tables are only needed when the user navigates to specific modules.
      // Loading them here (rather than on-demand) keeps state management simple
      // while still avoiding blocking the initial render.
      const [docRes, attRes, snrRes, frmRes, tenRes, tcRes, mjRes, progRes, ptaskRes, vaRes, appRes, oomRes, ooSRes, ooIRes, valRes, wbRes, wblRes, wbeRes, vleRes, veeRes, supRes, scTRes, scSpRes, scLRTRes] = await Promise.all([
        supabase.from('vy_project_documents').select(DOC_COLS).eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_attachments').select(ATT_COLS).eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_snagging_reports').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_site_forms').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_tenders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_tc_records').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_maintenance_jobs').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_programmes').select('*').eq('org_id', orgId).order('created_at', { ascending: true }),
        supabase.from('vy_programme_tasks').select('*').eq('org_id', orgId).order('sort_order', { ascending: true }),
        supabase.from('vy_variation_account').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_commercial_applications').select('*').eq('org_id', orgId).order('app_number', { ascending: true }),
        supabase.from('vy_o_and_m_manuals').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_o_and_m_sections').select('*').eq('org_id', orgId).order('sort_order', { ascending: true }),
        supabase.from('vy_o_and_m_items').select('*').eq('org_id', orgId).order('sort_order', { ascending: true }),
        supabase.from('vy_valuations').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_valuation_workbooks').select('*').eq('org_id', orgId),
        supabase.from('vy_workbook_lines').select('*').eq('org_id', orgId).order('sort_order', { ascending: true }),
        supabase.from('vy_workbook_extras').select('*').eq('org_id', orgId).order('sort_order', { ascending: true }),
        supabase.from('vy_valuation_line_entries').select('*').eq('org_id', orgId),
        supabase.from('vy_valuation_extra_entries').select('*').eq('org_id', orgId),
        supabase.from('vy_suppliers').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vy_supplier_trades').select('*').eq('org_id', orgId).order('sort_order', { ascending: true }),
        supabase.from('vy_supplier_specialisms').select('*').eq('org_id', orgId).order('sort_order', { ascending: true }),
        supabase.from('vy_supplier_labour_rate_types').select('*').eq('org_id', orgId).order('sort_order', { ascending: true }),
      ]);

      if (cancelled) return;

      setProjectDocuments((docRes.data ?? []) as DBProjectDocument[]);
      setAttachments((attRes.data ?? []) as DBAttachment[]);
      setSnaggingReports((snrRes.data ?? []) as DBSnaggingReport[]);
      setSiteForms(((frmRes.data ?? []) as DBSiteForm[]).map(f => ({
        ...(f.extra_data as Record<string, unknown> ?? {}),
        ...f,
        form_comments: f.form_comments ?? [],
        projectName: f.project_name,
        projectId: f.project_id,
        completedBy: f.completed_by,
        submittedDate: f.submitted_date,
      })));
      setTenders((tenRes.data ?? []).map(r => dbToTender(r as DBTender)));
      setTCRecords((tcRes.data ?? []) as DBTCRecord[]);
      setMaintenanceJobs((mjRes.data ?? []) as DBMaintenanceJob[]);
      setProgrammes((progRes.data ?? []) as DBProgramme[]);
      setProgrammeTasks((ptaskRes.data ?? []) as DBProgrammeTask[]);
      setVariationAccountItems((vaRes.data ?? []) as DBVariationAccountItem[]);
      setCommercialApplications((appRes.data ?? []) as DBCommercialApplication[]);
      setOAndMManuals((oomRes.data ?? []) as DBOAndMManual[]);
      setOAndMSections((ooSRes.data ?? []) as DBOAndMSection[]);
      setOAndMItems((ooIRes.data ?? []) as DBOAndMItem[]);
      setValuations((valRes.data ?? []) as DBValuation[]);
      setValuationWorkbooks((wbRes.data ?? []) as DBValuationWorkbook[]);
      setWorkbookLines((wblRes.data ?? []) as DBWorkbookLine[]);
      setWorkbookExtras((wbeRes.data ?? []) as DBWorkbookExtra[]);
      setValuationLineEntries((vleRes.data ?? []) as DBValuationLineEntry[]);
      setValuationExtraEntries((veeRes.data ?? []) as DBValuationExtraEntry[]);
      setSuppliers((supRes.data ?? []) as DBSupplier[]);
      setSupplierTrades((scTRes.data ?? []) as DBSupplierTrade[]);
      setSupplierSpecialisms((scSpRes.data ?? []) as DBSupplierSpecialism[]);
      setSupplierLabourRateTypes((scLRTRes.data ?? []) as DBSupplierLabourRateType[]);
      // Phase 2 complete — module pages can now render their full data.
      setModulesLoading(false);

      // ── Phase 3: detail data loaded on-demand ────────────────────────────────
      // vy_va_build_up_lines, vy_va_comments, vy_commercial_record_comments are
      // never needed until the user opens a specific variation or record.
      // Call store.loadVADetailData() / store.loadCommercialRecordComments()
      // from the relevant component on first mount.
    }

    load().finally(() => clearTimeout(loadingTimeout));
    return () => {
      cancelled = true;
      clearTimeout(loadingTimeout);
    };
  }, [orgId]);

  // ── Projects ──────────────────────────────────────────────────────────────────

  const addProject = useCallback(async (p: Project): Promise<string | null> => {
    console.log('[VYSITE] addProject called, id:', p.id, 'orgId:', orgIdRef.current);
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return 'No organisation context — cannot save project.';
    setProjects(prev => [...prev, p]);
    const { data, error } = await supabase.from('vy_projects').upsert({ ...projectToDB(p), org_id: oid }, { onConflict: 'id' }).select('id,name,org_id').maybeSingle();
    logWrite('addProject', 'vy_projects', error, data);
    return error ? `Save failed: ${error.message}` : null;
  }, []);

  const updateProject = useCallback(async (p: Project) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setProjects(prev => prev.map(x => x.id === p.id ? p : x));
    const { data, error } = await supabase.from('vy_projects').upsert({ ...projectToDB(p), org_id: oid }, { onConflict: 'id' }).select('id,name').maybeSingle();
    logWrite('updateProject', 'vy_projects', error, data);
  }, []);

  const removeProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from('vy_projects').delete().eq('id', id);
    logWrite('removeProject', 'vy_projects', error, { id });
  }, []);

  // ── Project Documents ─────────────────────────────────────────────────────────

  const addProjectDocument = useCallback(async (d: DBProjectDocument) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setProjectDocuments(prev => [d, ...prev]);
    const { error } = await supabase.from('vy_project_documents').upsert({ ...d, org_id: oid }, { onConflict: 'id' });
    logWrite('addProjectDocument', 'vy_project_documents', error);
  }, []);

  const removeProjectDocument = useCallback(async (id: string) => {
    setProjectDocuments(prev => prev.filter(d => d.id !== id));
    const { error } = await supabase.from('vy_project_documents').delete().eq('id', id);
    logWrite('removeProjectDocument', 'vy_project_documents', error);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const addAction = useCallback(async (a: Action) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setActions(prev => [a, ...prev]);
    const { data, error } = await supabase.from('vy_actions').upsert({ ...actionToDB(a), org_id: oid }, { onConflict: 'id' }).select('id,title,org_id').maybeSingle();
    logWrite('addAction', 'vy_actions', error, data);
  }, []);

  const updateAction = useCallback(async (a: Action) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setActions(prev => prev.map(x => x.id === a.id ? a : x));
    const { error } = await supabase.from('vy_actions').upsert({ ...actionToDB(a), org_id: oid }, { onConflict: 'id' });
    logWrite('updateAction', 'vy_actions', error);
  }, []);

  const removeAction = useCallback(async (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
    setAttachments(prev => prev.filter(a => !(a.linked_type === 'action' && a.linked_id === id)));
    const { error } = await supabase.from('vy_actions').delete().eq('id', id);
    logWrite('removeAction', 'vy_actions', error);
    await supabase.from('vy_attachments').delete().eq('linked_type', 'action').eq('linked_id', id);
  }, []);

  // ── Snags ─────────────────────────────────────────────────────────────────────

  const addSnag = useCallback(async (s: Snag) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSnags(prev => [s, ...prev]);
    const { data, error } = await supabase.from('vy_snags').upsert({ ...snagToDB(s), org_id: oid }, { onConflict: 'id' }).select('id,title,org_id').maybeSingle();
    logWrite('addSnag', 'vy_snags', error, data);
  }, []);

  const updateSnag = useCallback(async (s: Snag) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSnags(prev => prev.map(x => x.id === s.id ? s : x));
    const { error } = await supabase.from('vy_snags').upsert({ ...snagToDB(s), org_id: oid }, { onConflict: 'id' });
    logWrite('updateSnag', 'vy_snags', error);
  }, []);

  const removeSnag = useCallback(async (id: string) => {
    setSnags(prev => prev.filter(s => s.id !== id));
    setAttachments(prev => prev.filter(a => !(a.linked_type === 'snag' && a.linked_id === id)));
    const { error } = await supabase.from('vy_snags').delete().eq('id', id);
    logWrite('removeSnag', 'vy_snags', error);
    await supabase.from('vy_attachments').delete().eq('linked_type', 'snag').eq('linked_id', id);
  }, []);

  // ── Snagging Reports ──────────────────────────────────────────────────────────

  const addSnaggingReport = useCallback(async (r: DBSnaggingReport) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSnaggingReports(prev => [r, ...prev]);
    const { error } = await supabase.from('vy_snagging_reports').upsert({ ...r, org_id: oid }, { onConflict: 'id' });
    logWrite('addSnaggingReport', 'vy_snagging_reports', error);
  }, []);

  const updateSnaggingReport = useCallback(async (r: DBSnaggingReport) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSnaggingReports(prev => prev.map(x => x.id === r.id ? r : x));
    const { error } = await supabase.from('vy_snagging_reports').upsert({ ...r, org_id: oid }, { onConflict: 'id' });
    logWrite('updateSnaggingReport', 'vy_snagging_reports', error);
  }, []);

  const removeSnaggingReport = useCallback(async (id: string) => {
    setSnaggingReports(prev => prev.filter(r => r.id !== id));
    // Orphan snags in this report — unlink them rather than delete
    setSnags(prev => prev.map(s => (s as Snag & { reportId?: string }).reportId === id
      ? { ...s, reportId: undefined } as Snag
      : s
    ));
    const { error } = await supabase.from('vy_snagging_reports').delete().eq('id', id);
    logWrite('removeSnaggingReport', 'vy_snagging_reports', error);
    // Unlink snags from this report in DB
    await supabase.from('vy_snags').update({ report_id: null }).eq('report_id', id);
  }, []);

  // ── Site Forms ────────────────────────────────────────────────────────────────

  const addSiteForm = useCallback(async (f: DBSiteForm) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    const merged = {
      ...(f.extra_data as Record<string, unknown> ?? {}),
      ...f,
      form_comments: f.form_comments ?? [],
      projectName: f.project_name,
      projectId: f.project_id,
      completedBy: f.completed_by,
      submittedDate: f.submitted_date,
    };
    setSiteForms(prev => [merged, ...prev]);
    const { error } = await supabase.from('vy_site_forms').upsert({ ...f, org_id: oid }, { onConflict: 'id' });
    logWrite('addSiteForm', 'vy_site_forms', error);
  }, []);

  const updateSiteForm = useCallback(async (f: DBSiteForm) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    const merged = {
      ...(f.extra_data as Record<string, unknown> ?? {}),
      ...f,
      form_comments: f.form_comments ?? [],
      projectName: f.project_name,
      projectId: f.project_id,
      completedBy: f.completed_by,
      submittedDate: f.submitted_date,
    };
    setSiteForms(prev => prev.map(x => x.id === f.id ? merged : x));
    const { error } = await supabase.from('vy_site_forms').upsert({ ...f, org_id: oid }, { onConflict: 'id' });
    logWrite('updateSiteForm', 'vy_site_forms', error);
  }, []);

  const removeSiteForm = useCallback(async (id: string) => {
    setSiteForms(prev => prev.filter(f => f.id !== id));
    const { error } = await supabase.from('vy_site_forms').delete().eq('id', id);
    logWrite('removeSiteForm', 'vy_site_forms', error);
  }, []);

  // ── Tenders ───────────────────────────────────────────────────────────────────

  const addTender = useCallback(async (t: Tender): Promise<string | null> => {
    console.log('[VYSITE] addTender called, id:', t.id, 'orgId:', orgIdRef.current);
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return 'No organisation context — cannot save tender.';
    setTenders(prev => [t, ...prev]);
    const { data, error } = await supabase.from('vy_tenders').upsert({ ...tenderToDB(t), org_id: oid }, { onConflict: 'id' }).select('id,name,org_id').maybeSingle();
    logWrite('addTender', 'vy_tenders', error, data);
    return error ? `Save failed: ${error.message}` : null;
  }, []);

  const updateTender = useCallback(async (t: Tender) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setTenders(prev => prev.map(x => x.id === t.id ? t : x));
    const { error } = await supabase.from('vy_tenders').upsert({ ...tenderToDB(t), org_id: oid }, { onConflict: 'id' });
    logWrite('updateTender', 'vy_tenders', error);
  }, []);

  const removeTender = useCallback(async (id: string) => {
    setTenders(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from('vy_tenders').delete().eq('id', id);
    logWrite('removeTender', 'vy_tenders', error);
  }, []);

  // ── TC Records ────────────────────────────────────────────────────────────────

  const addTCRecord = useCallback(async (r: DBTCRecord) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setTCRecords(prev => [r, ...prev]);
    const { error } = await supabase.from('vy_tc_records').upsert({ ...r, org_id: oid }, { onConflict: 'id' });
    logWrite('addTCRecord', 'vy_tc_records', error);
  }, []);

  const updateTCRecord = useCallback(async (r: DBTCRecord) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setTCRecords(prev => prev.map(x => x.id === r.id ? r : x));
    const { error } = await supabase.from('vy_tc_records').upsert({ ...r, org_id: oid }, { onConflict: 'id' });
    logWrite('updateTCRecord', 'vy_tc_records', error);
  }, []);

  const removeTCRecord = useCallback(async (id: string) => {
    setTCRecords(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase.from('vy_tc_records').delete().eq('id', id);
    logWrite('removeTCRecord', 'vy_tc_records', error);
  }, []);

  // ── Maintenance Jobs ──────────────────────────────────────────────────────────

  const addMaintenanceJob = useCallback(async (j: DBMaintenanceJob) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setMaintenanceJobs(prev => [j, ...prev]);
    const { error } = await supabase.from('vy_maintenance_jobs').upsert({ ...j, org_id: oid }, { onConflict: 'id' });
    logWrite('addMaintenanceJob', 'vy_maintenance_jobs', error);
  }, []);

  const updateMaintenanceJob = useCallback(async (j: DBMaintenanceJob) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setMaintenanceJobs(prev => prev.map(x => x.id === j.id ? j : x));
    const { error } = await supabase.from('vy_maintenance_jobs').upsert({ ...j, org_id: oid }, { onConflict: 'id' });
    logWrite('updateMaintenanceJob', 'vy_maintenance_jobs', error);
  }, []);

  const removeMaintenanceJob = useCallback(async (id: string) => {
    setMaintenanceJobs(prev => prev.filter(j => j.id !== id));
    const { error } = await supabase.from('vy_maintenance_jobs').delete().eq('id', id);
    logWrite('removeMaintenanceJob', 'vy_maintenance_jobs', error);
  }, []);

  // ── Programmes ────────────────────────────────────────────────────────────────

  const addProgramme = useCallback(async (p: DBProgramme) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setProgrammes(prev => [...prev, p]);
    const { error } = await supabase.from('vy_programmes').upsert({ ...p, org_id: oid }, { onConflict: 'id' });
    logWrite('addProgramme', 'vy_programmes', error);
  }, []);

  const updateProgramme = useCallback(async (p: DBProgramme) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setProgrammes(prev => prev.map(x => x.id === p.id ? p : x));
    const { error } = await supabase.from('vy_programmes').upsert({ ...p, org_id: oid }, { onConflict: 'id' });
    logWrite('updateProgramme', 'vy_programmes', error);
  }, []);

  const removeProgramme = useCallback(async (id: string) => {
    setProgrammes(prev => prev.filter(p => p.id !== id));
    setProgrammeTasks(prev => prev.filter(t => t.programme_id !== id));
    const { error } = await supabase.from('vy_programmes').delete().eq('id', id);
    logWrite('removeProgramme', 'vy_programmes', error);
  }, []);

  const addProgrammeTask = useCallback(async (t: DBProgrammeTask) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setProgrammeTasks(prev => [...prev, t]);
    const { error } = await supabase.from('vy_programme_tasks').upsert({ ...t, org_id: oid }, { onConflict: 'id' });
    logWrite('addProgrammeTask', 'vy_programme_tasks', error);
  }, []);

  const updateProgrammeTask = useCallback(async (t: DBProgrammeTask) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setProgrammeTasks(prev => prev.map(x => x.id === t.id ? t : x));
    const { error } = await supabase.from('vy_programme_tasks').upsert({ ...t, org_id: oid }, { onConflict: 'id' });
    logWrite('updateProgrammeTask', 'vy_programme_tasks', error);
  }, []);

  const removeProgrammeTask = useCallback(async (id: string) => {
    setProgrammeTasks(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from('vy_programme_tasks').delete().eq('id', id);
    logWrite('removeProgrammeTask', 'vy_programme_tasks', error);
  }, []);

  // ── Key Dates ─────────────────────────────────────────────────────────────────

  const addKeyDate = useCallback(async (d: DBKeyDate) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setKeyDates(prev => [...prev, d]);
    const { error } = await supabase.from('vy_key_dates').upsert({ ...d, org_id: oid }, { onConflict: 'id' });
    logWrite('addKeyDate', 'vy_key_dates', error);
  }, []);

  const updateKeyDate = useCallback(async (d: DBKeyDate) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setKeyDates(prev => prev.map(x => x.id === d.id ? d : x));
    const { error } = await supabase.from('vy_key_dates').upsert({ ...d, org_id: oid }, { onConflict: 'id' });
    logWrite('updateKeyDate', 'vy_key_dates', error);
  }, []);

  const removeKeyDate = useCallback(async (id: string) => {
    setKeyDates(prev => prev.filter(d => d.id !== id));
    const { error } = await supabase.from('vy_key_dates').delete().eq('id', id);
    logWrite('removeKeyDate', 'vy_key_dates', error);
  }, []);

  // ── Attachments ───────────────────────────────────────────────────────────────

  const addAttachment = useCallback(async (a: DBAttachment) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setAttachments(prev => [a, ...prev]);
    const { error } = await supabase.from('vy_attachments').upsert({ ...a, org_id: oid }, { onConflict: 'id' });
    logWrite('addAttachment', 'vy_attachments', error);
  }, []);

  const removeAttachment = useCallback(async (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
    const { error } = await supabase.from('vy_attachments').delete().eq('id', id);
    logWrite('removeAttachment', 'vy_attachments', error);
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
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    const row = { ...u, org_id: oid };
    setPlatformUsers(prev => [...prev, row]);
    const { data, error } = await supabase.from('vy_platform_users').upsert(row, { onConflict: 'id' }).select('id,name').maybeSingle();
    logWrite('addPlatformUser', 'vy_platform_users', error, data);
  }, []);

  const updatePlatformUser = useCallback(async (u: DBPlatformUser) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    const row = { ...u, org_id: u.org_id ?? oid };
    setPlatformUsers(prev => prev.map(x => x.id === row.id ? row : x));
    const { error } = await supabase.from('vy_platform_users').upsert(row, { onConflict: 'id' });
    logWrite('updatePlatformUser', 'vy_platform_users', error);
  }, []);

  const removePlatformUser = useCallback(async (id: string) => {
    setPlatformUsers(prev => prev.filter(u => u.id !== id));
    const { error } = await supabase.from('vy_platform_users').delete().eq('id', id);
    logWrite('removePlatformUser', 'vy_platform_users', error);
  }, []);

  // ── Notifications ─────────────────────────────────────────────────────────────

  const addNotification = useCallback(async (n: DBNotification) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setNotifications(prev => [n, ...prev]);
    const { error } = await supabase.from('vy_notifications').upsert({ ...n, org_id: oid }, { onConflict: 'id' });
    logWrite('addNotification', 'vy_notifications', error);
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const { error } = await supabase.from('vy_notifications').update({ read: true }).eq('id', id);
    logWrite('markNotificationRead', 'vy_notifications', error);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const { error } = await supabase.from('vy_notifications').update({ read: true }).eq('read', false);
    logWrite('markAllNotificationsRead', 'vy_notifications', error);
  }, []);

  // ── Variation Account ─────────────────────────────────────────────────────────

  const addVariationAccountItem = useCallback(async (v: DBVariationAccountItem) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setVariationAccountItems(prev => [v, ...prev]);
    const { error } = await supabase.from('vy_variation_account').upsert({ ...v, org_id: oid }, { onConflict: 'id' });
    logWrite('addVariationAccountItem', 'vy_variation_account', error);
  }, []);

  const updateVariationAccountItem = useCallback(async (v: DBVariationAccountItem) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setVariationAccountItems(prev => prev.map(x => x.id === v.id ? v : x));
    const { error } = await supabase.from('vy_variation_account').upsert({ ...v, org_id: oid }, { onConflict: 'id' });
    logWrite('updateVariationAccountItem', 'vy_variation_account', error);
  }, []);

  const removeVariationAccountItem = useCallback(async (id: string) => {
    setVariationAccountItems(prev => prev.filter(v => v.id !== id));
    const { error } = await supabase.from('vy_variation_account').delete().eq('id', id);
    logWrite('removeVariationAccountItem', 'vy_variation_account', error);
  }, []);

  // ── VA Build-Up Lines ─────────────────────────────────────────────────────────

  const addVABuildUpLine = useCallback(async (l: DBVABuildUpLine) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setVABuildUpLines(prev => [...prev, l].sort((a, b) => a.line_no - b.line_no));
    const { error } = await supabase.from('vy_va_build_up_lines').upsert({ ...l, org_id: oid }, { onConflict: 'id' });
    logWrite('addVABuildUpLine', 'vy_va_build_up_lines', error);
  }, []);

  const updateVABuildUpLine = useCallback(async (l: DBVABuildUpLine) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setVABuildUpLines(prev => prev.map(x => x.id === l.id ? l : x));
    const { error } = await supabase.from('vy_va_build_up_lines').upsert({ ...l, org_id: oid }, { onConflict: 'id' });
    logWrite('updateVABuildUpLine', 'vy_va_build_up_lines', error);
  }, []);

  const removeVABuildUpLine = useCallback(async (id: string) => {
    setVABuildUpLines(prev => prev.filter(l => l.id !== id));
    const { error } = await supabase.from('vy_va_build_up_lines').delete().eq('id', id);
    logWrite('removeVABuildUpLine', 'vy_va_build_up_lines', error);
  }, []);

  // ── VA Comments ───────────────────────────────────────────────────────────────

  const addVAComment = useCallback(async (c: DBVAComment) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setVAComments(prev => [...prev, c]);
    const { error } = await supabase.from('vy_va_comments').upsert({ ...c, org_id: oid }, { onConflict: 'id' });
    logWrite('addVAComment', 'vy_va_comments', error);
  }, []);

  const removeVAComment = useCallback(async (id: string) => {
    setVAComments(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('vy_va_comments').delete().eq('id', id);
    logWrite('removeVAComment', 'vy_va_comments', error);
  }, []);

  // ── Commercial Record Comments ─────────────────────────────────────────────

  const addCommercialRecordComment = useCallback(async (c: DBCommercialRecordComment) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setCommercialRecordComments(prev => [...prev, c]);
    const { error } = await supabase.from('vy_commercial_record_comments').upsert({ ...c, org_id: oid }, { onConflict: 'id' });
    logWrite('addCommercialRecordComment', 'vy_commercial_record_comments', error);
  }, []);

  const removeCommercialRecordComment = useCallback(async (id: string) => {
    setCommercialRecordComments(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('vy_commercial_record_comments').delete().eq('id', id);
    logWrite('removeCommercialRecordComment', 'vy_commercial_record_comments', error);
  }, []);

  // ── On-demand detail loaders ──────────────────────────────────────────────────
  // These tables are excluded from startup to reduce initial load time.
  // Call them once from the relevant component on first mount.
  // They are idempotent — safe to call multiple times; already-loaded data is merged.

  const loadVADetailData = useCallback(async () => {
    const oid = orgIdRef.current;
    if (!oid) return;
    const [linesRes, commentsRes] = await Promise.all([
      supabase.from('vy_va_build_up_lines').select('*').eq('org_id', oid).order('line_no', { ascending: true }),
      supabase.from('vy_va_comments').select('*').eq('org_id', oid).order('created_at', { ascending: true }),
    ]);
    if (linesRes.data) setVABuildUpLines(linesRes.data as DBVABuildUpLine[]);
    if (commentsRes.data) setVAComments(commentsRes.data as DBVAComment[]);
  }, []);

  const loadCommercialRecordComments = useCallback(async () => {
    const oid = orgIdRef.current;
    if (!oid) return;
    const { data } = await supabase.from('vy_commercial_record_comments').select('*').eq('org_id', oid).order('created_at', { ascending: true });
    if (data) setCommercialRecordComments(data as DBCommercialRecordComment[]);
  }, []);

  // ── Commercial Applications ────────────────────────────────────────────────

  const addCommercialApplication = useCallback(async (a: DBCommercialApplication) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setCommercialApplications(prev => [...prev, a].sort((x, y) => x.app_number - y.app_number));
    const { error } = await supabase.from('vy_commercial_applications').upsert({ ...a, org_id: oid }, { onConflict: 'id' });
    logWrite('addCommercialApplication', 'vy_commercial_applications', error);
  }, []);

  const updateCommercialApplication = useCallback(async (a: DBCommercialApplication) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setCommercialApplications(prev => prev.map(x => x.id === a.id ? a : x));
    const { error } = await supabase.from('vy_commercial_applications').upsert({ ...a, org_id: oid }, { onConflict: 'id' });
    logWrite('updateCommercialApplication', 'vy_commercial_applications', error);
  }, []);

  const removeCommercialApplication = useCallback(async (id: string) => {
    setCommercialApplications(prev => prev.filter(a => a.id !== id));
    const { error } = await supabase.from('vy_commercial_applications').delete().eq('id', id);
    logWrite('removeCommercialApplication', 'vy_commercial_applications', error);
  }, []);

  // ── O&M Manual ────────────────────────────────────────────────────────────────

  const addOAndMManual = useCallback(async (m: DBOAndMManual) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setOAndMManuals(prev => [m, ...prev]);
    const { error } = await supabase.from('vy_o_and_m_manuals').upsert({ ...m, org_id: oid }, { onConflict: 'id' });
    logWrite('addOAndMManual', 'vy_o_and_m_manuals', error);
  }, []);

  const updateOAndMManual = useCallback(async (m: DBOAndMManual) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setOAndMManuals(prev => prev.map(x => x.id === m.id ? m : x));
    const { error } = await supabase.from('vy_o_and_m_manuals').upsert({ ...m, org_id: oid }, { onConflict: 'id' });
    logWrite('updateOAndMManual', 'vy_o_and_m_manuals', error);
  }, []);

  const removeOAndMManual = useCallback(async (id: string) => {
    setOAndMManuals(prev => prev.filter(m => m.id !== id));
    setOAndMSections(prev => prev.filter(s => s.manual_id !== id));
    setOAndMItems(prev => prev.filter(i => i.manual_id !== id));
    const { error } = await supabase.from('vy_o_and_m_manuals').delete().eq('id', id);
    logWrite('removeOAndMManual', 'vy_o_and_m_manuals', error);
  }, []);

  const addOAndMSection = useCallback(async (s: DBOAndMSection) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setOAndMSections(prev => [...prev, s].sort((a, b) => a.sort_order - b.sort_order));
    const { error } = await supabase.from('vy_o_and_m_sections').upsert({ ...s, org_id: oid }, { onConflict: 'id' });
    logWrite('addOAndMSection', 'vy_o_and_m_sections', error);
  }, []);

  const updateOAndMSection = useCallback(async (s: DBOAndMSection) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setOAndMSections(prev => prev.map(x => x.id === s.id ? s : x));
    const { error } = await supabase.from('vy_o_and_m_sections').upsert({ ...s, org_id: oid }, { onConflict: 'id' });
    logWrite('updateOAndMSection', 'vy_o_and_m_sections', error);
  }, []);

  const removeOAndMSection = useCallback(async (id: string) => {
    setOAndMSections(prev => prev.filter(s => s.id !== id));
    setOAndMItems(prev => prev.filter(i => i.section_id !== id));
    const { error } = await supabase.from('vy_o_and_m_sections').delete().eq('id', id);
    logWrite('removeOAndMSection', 'vy_o_and_m_sections', error);
  }, []);

  const reorderOAndMSections = useCallback(async (sections: DBOAndMSection[]) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setOAndMSections(prev => {
      const updated = sections.map((s, i) => ({ ...s, sort_order: i }));
      const ids = new Set(updated.map(s => s.id));
      return [...prev.filter(s => !ids.has(s.id)), ...updated].sort((a, b) => a.sort_order - b.sort_order);
    });
    const rows = sections.map((s, i) => ({ ...s, sort_order: i, org_id: oid }));
    const { error } = await supabase.from('vy_o_and_m_sections').upsert(rows, { onConflict: 'id' });
    logWrite('reorderOAndMSections', 'vy_o_and_m_sections', error);
  }, []);

  const addOAndMItem = useCallback(async (item: DBOAndMItem) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setOAndMItems(prev => [...prev, item].sort((a, b) => a.sort_order - b.sort_order));
    const { error } = await supabase.from('vy_o_and_m_items').upsert({ ...item, org_id: oid }, { onConflict: 'id' });
    logWrite('addOAndMItem', 'vy_o_and_m_items', error);
  }, []);

  const updateOAndMItem = useCallback(async (item: DBOAndMItem) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setOAndMItems(prev => prev.map(x => x.id === item.id ? item : x));
    const { error } = await supabase.from('vy_o_and_m_items').upsert({ ...item, org_id: oid }, { onConflict: 'id' });
    logWrite('updateOAndMItem', 'vy_o_and_m_items', error);
  }, []);

  const removeOAndMItem = useCallback(async (id: string) => {
    setOAndMItems(prev => prev.filter(i => i.id !== id));
    const { error } = await supabase.from('vy_o_and_m_items').delete().eq('id', id);
    logWrite('removeOAndMItem', 'vy_o_and_m_items', error);
  }, []);

  const reorderOAndMItems = useCallback(async (items: DBOAndMItem[]) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setOAndMItems(prev => {
      const updated = items.map((it, i) => ({ ...it, sort_order: i }));
      const ids = new Set(updated.map(it => it.id));
      return [...prev.filter(it => !ids.has(it.id)), ...updated].sort((a, b) => a.sort_order - b.sort_order);
    });
    const rows = items.map((it, i) => ({ ...it, sort_order: i, org_id: oid }));
    const { error } = await supabase.from('vy_o_and_m_items').upsert(rows, { onConflict: 'id' });
    logWrite('reorderOAndMItems', 'vy_o_and_m_items', error);
  }, []);

  // ── Valuations ────────────────────────────────────────────────────────────────

  const addValuation = useCallback(async (v: DBValuation) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setValuations(prev => [v, ...prev]);
    const { error } = await supabase.from('vy_valuations').upsert({ ...v, org_id: oid }, { onConflict: 'id' });
    logWrite('addValuation', 'vy_valuations', error);
  }, []);

  const updateValuation = useCallback(async (v: DBValuation) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setValuations(prev => prev.map(x => x.id === v.id ? v : x));
    const { error } = await supabase.from('vy_valuations').upsert({ ...v, org_id: oid }, { onConflict: 'id' });
    logWrite('updateValuation', 'vy_valuations', error);
  }, []);

  const removeValuation = useCallback(async (id: string) => {
    setValuations(prev => prev.filter(v => v.id !== id));
    setValuationLineEntries(prev => prev.filter(e => e.valuation_id !== id));
    setValuationExtraEntries(prev => prev.filter(e => e.valuation_id !== id));
    const { error } = await supabase.from('vy_valuations').delete().eq('id', id);
    logWrite('removeValuation', 'vy_valuations', error);
  }, []);

  const addValuationWorkbook = useCallback(async (w: DBValuationWorkbook) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setValuationWorkbooks(prev => [...prev, w]);
    const { error } = await supabase.from('vy_valuation_workbooks').upsert({ ...w, org_id: oid }, { onConflict: 'id' });
    logWrite('addValuationWorkbook', 'vy_valuation_workbooks', error);
  }, []);

  const updateValuationWorkbook = useCallback(async (w: DBValuationWorkbook) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setValuationWorkbooks(prev => prev.map(x => x.id === w.id ? w : x));
    const { error } = await supabase.from('vy_valuation_workbooks').upsert({ ...w, org_id: oid }, { onConflict: 'id' });
    logWrite('updateValuationWorkbook', 'vy_valuation_workbooks', error);
  }, []);

  const removeValuationWorkbook = useCallback(async (workbookId: string, projectId: string) => {
    // 1. Clear local state for everything tied to this workbook/project
    const valIds = new Set(
      (valuations as DBValuation[]).filter(v => v.project_id === projectId).map(v => v.id)
    );
    setValuationLineEntries(prev => prev.filter(e => !valIds.has(e.valuation_id)));
    setValuationExtraEntries(prev => prev.filter(e => !valIds.has(e.valuation_id)));
    setValuations(prev => prev.filter(v => v.project_id !== projectId));
    setWorkbookLines(prev => prev.filter(l => l.workbook_id !== workbookId));
    setWorkbookExtras(prev => prev.filter(e => e.workbook_id !== workbookId));
    setValuationWorkbooks(prev => prev.filter(w => w.id !== workbookId));

    // 2. Delete valuations (DB cascade removes line/extra entries)
    for (const id of valIds) {
      await supabase.from('vy_valuations').delete().eq('id', id);
    }
    // 3. Delete workbook (DB cascade removes lines and extras)
    const { error } = await supabase.from('vy_valuation_workbooks').delete().eq('id', workbookId);
    logWrite('removeValuationWorkbook', 'vy_valuation_workbooks', error);
  }, [valuations]);

  const addWorkbookLine = useCallback(async (l: DBWorkbookLine) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setWorkbookLines(prev => [...prev, l].sort((a, b) => a.sort_order - b.sort_order));
    const { error } = await supabase.from('vy_workbook_lines').upsert({ ...l, org_id: oid }, { onConflict: 'id' });
    logWrite('addWorkbookLine', 'vy_workbook_lines', error);
  }, []);

  const updateWorkbookLine = useCallback(async (l: DBWorkbookLine) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setWorkbookLines(prev => prev.map(x => x.id === l.id ? l : x));
    const { error } = await supabase.from('vy_workbook_lines').upsert({ ...l, org_id: oid }, { onConflict: 'id' });
    logWrite('updateWorkbookLine', 'vy_workbook_lines', error);
  }, []);

  const removeWorkbookLine = useCallback(async (id: string) => {
    setWorkbookLines(prev => prev.filter(l => l.id !== id));
    setValuationLineEntries(prev => prev.filter(e => e.workbook_line_id !== id));
    const { error } = await supabase.from('vy_workbook_lines').delete().eq('id', id);
    logWrite('removeWorkbookLine', 'vy_workbook_lines', error);
  }, []);

  const batchAddWorkbookLines = useCallback(async (lines: DBWorkbookLine[]) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid || lines.length === 0) return;
    setWorkbookLines(prev => {
      const wbId = lines[0].workbook_id;
      const kept = prev.filter(l => l.workbook_id !== wbId);
      return [...kept, ...lines].sort((a, b) => a.sort_order - b.sort_order);
    });
    const rows = lines.map(l => ({ ...l, org_id: oid }));
    const { error } = await supabase.from('vy_workbook_lines').upsert(rows, { onConflict: 'id' });
    logWrite('batchAddWorkbookLines', 'vy_workbook_lines', error);
  }, []);

  const addWorkbookExtra = useCallback(async (e: DBWorkbookExtra) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setWorkbookExtras(prev => [...prev, e].sort((a, b) => a.sort_order - b.sort_order));
    const { error } = await supabase.from('vy_workbook_extras').upsert({ ...e, org_id: oid }, { onConflict: 'id' });
    logWrite('addWorkbookExtra', 'vy_workbook_extras', error);
  }, []);

  const updateWorkbookExtra = useCallback(async (e: DBWorkbookExtra) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setWorkbookExtras(prev => prev.map(x => x.id === e.id ? e : x));
    const { error } = await supabase.from('vy_workbook_extras').upsert({ ...e, org_id: oid }, { onConflict: 'id' });
    logWrite('updateWorkbookExtra', 'vy_workbook_extras', error);
  }, []);

  const removeWorkbookExtra = useCallback(async (id: string) => {
    setWorkbookExtras(prev => prev.filter(e => e.id !== id));
    setValuationExtraEntries(prev => prev.filter(e => e.workbook_extra_id !== id));
    const { error } = await supabase.from('vy_workbook_extras').delete().eq('id', id);
    logWrite('removeWorkbookExtra', 'vy_workbook_extras', error);
  }, []);

  const batchAddWorkbookExtras = useCallback(async (extras: DBWorkbookExtra[]) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid || extras.length === 0) return;
    setWorkbookExtras(prev => {
      const wbId = extras[0].workbook_id;
      const kept = prev.filter(e => e.workbook_id !== wbId);
      return [...kept, ...extras].sort((a, b) => a.sort_order - b.sort_order);
    });
    const rows = extras.map(e => ({ ...e, org_id: oid }));
    const { error } = await supabase.from('vy_workbook_extras').upsert(rows, { onConflict: 'id' });
    logWrite('batchAddWorkbookExtras', 'vy_workbook_extras', error);
  }, []);

  const upsertValuationLineEntry = useCallback(async (entry: DBValuationLineEntry) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setValuationLineEntries(prev => {
      const existing = prev.findIndex(e => e.valuation_id === entry.valuation_id && e.workbook_line_id === entry.workbook_line_id);
      if (existing >= 0) { const next = [...prev]; next[existing] = entry; return next; }
      return [...prev, entry];
    });
    const { error } = await supabase.from('vy_valuation_line_entries').upsert({ ...entry, org_id: oid }, { onConflict: 'id' });
    logWrite('upsertValuationLineEntry', 'vy_valuation_line_entries', error);
  }, []);

  const batchUpsertValuationLineEntries = useCallback(async (entries: DBValuationLineEntry[]) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid || entries.length === 0) return;
    setValuationLineEntries(prev => {
      const valId = entries[0].valuation_id;
      const kept = prev.filter(e => e.valuation_id !== valId);
      return [...kept, ...entries];
    });
    const rows = entries.map(e => ({ ...e, org_id: oid }));
    const { error } = await supabase.from('vy_valuation_line_entries').upsert(rows, { onConflict: 'id' });
    logWrite('batchUpsertValuationLineEntries', 'vy_valuation_line_entries', error);
  }, []);

  const upsertValuationExtraEntry = useCallback(async (entry: DBValuationExtraEntry) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setValuationExtraEntries(prev => {
      const existing = prev.findIndex(e => e.valuation_id === entry.valuation_id && e.workbook_extra_id === entry.workbook_extra_id);
      if (existing >= 0) { const next = [...prev]; next[existing] = entry; return next; }
      return [...prev, entry];
    });
    const { error } = await supabase.from('vy_valuation_extra_entries').upsert({ ...entry, org_id: oid }, { onConflict: 'id' });
    logWrite('upsertValuationExtraEntry', 'vy_valuation_extra_entries', error);
  }, []);

  const batchUpsertValuationExtraEntries = useCallback(async (entries: DBValuationExtraEntry[]) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid || entries.length === 0) return;
    setValuationExtraEntries(prev => {
      const valId = entries[0].valuation_id;
      const kept = prev.filter(e => e.valuation_id !== valId);
      return [...kept, ...entries];
    });
    const rows = entries.map(e => ({ ...e, org_id: oid }));
    const { error } = await supabase.from('vy_valuation_extra_entries').upsert(rows, { onConflict: 'id' });
    logWrite('batchUpsertValuationExtraEntries', 'vy_valuation_extra_entries', error);
  }, []);

  // ── Settings ──────────────────────────────────────────────────────────────────

  const updateSettings = useCallback(async (s: DBSettings) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSettings(s);
    // Upsert by org_id — each org has exactly one settings row.
    // id is set to the org_id string to satisfy the PK uniqueness requirement.
    const { error } = await supabase.from('vy_settings').upsert(
      { ...s, id: oid, org_id: oid, updated_at: new Date().toISOString() },
      { onConflict: 'org_id' }
    );
    logWrite('updateSettings', 'vy_settings', error);
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

  // ── Supply Chain ──────────────────────────────────────────────────────────────

  const addSupplier = useCallback(async (s: DBSupplier) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSuppliers(prev => [s, ...prev]);
    const { error } = await supabase.from('vy_suppliers').upsert({ ...s, org_id: oid }, { onConflict: 'id' });
    logWrite('addSupplier', 'vy_suppliers', error);
  }, []);

  const updateSupplier = useCallback(async (s: DBSupplier) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSuppliers(prev => prev.map(x => x.id === s.id ? s : x));
    const { error } = await supabase.from('vy_suppliers').upsert({ ...s, org_id: oid, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    logWrite('updateSupplier', 'vy_suppliers', error);
  }, []);

  const removeSupplier = useCallback(async (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    const { error } = await supabase.from('vy_suppliers').delete().eq('id', id);
    logWrite('removeSupplier', 'vy_suppliers', error);
  }, []);

  const addSupplierTrade = useCallback(async (t: DBSupplierTrade) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSupplierTrades(prev => [...prev, t]);
    const { error } = await supabase.from('vy_supplier_trades').upsert({ ...t, org_id: oid }, { onConflict: 'id' });
    logWrite('addSupplierTrade', 'vy_supplier_trades', error);
  }, []);

  const updateSupplierTrade = useCallback(async (t: DBSupplierTrade) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSupplierTrades(prev => prev.map(x => x.id === t.id ? t : x));
    const { error } = await supabase.from('vy_supplier_trades').upsert({ ...t, org_id: oid }, { onConflict: 'id' });
    logWrite('updateSupplierTrade', 'vy_supplier_trades', error);
  }, []);

  const removeSupplierTrade = useCallback(async (id: string) => {
    setSupplierTrades(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from('vy_supplier_trades').delete().eq('id', id);
    logWrite('removeSupplierTrade', 'vy_supplier_trades', error);
  }, []);

  const addSupplierSpecialism = useCallback(async (s: DBSupplierSpecialism) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSupplierSpecialisms(prev => [...prev, s]);
    const { error } = await supabase.from('vy_supplier_specialisms').upsert({ ...s, org_id: oid }, { onConflict: 'id' });
    logWrite('addSupplierSpecialism', 'vy_supplier_specialisms', error);
  }, []);

  const updateSupplierSpecialism = useCallback(async (s: DBSupplierSpecialism) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSupplierSpecialisms(prev => prev.map(x => x.id === s.id ? s : x));
    const { error } = await supabase.from('vy_supplier_specialisms').upsert({ ...s, org_id: oid }, { onConflict: 'id' });
    logWrite('updateSupplierSpecialism', 'vy_supplier_specialisms', error);
  }, []);

  const removeSupplierSpecialism = useCallback(async (id: string) => {
    setSupplierSpecialisms(prev => prev.filter(s => s.id !== id));
    const { error } = await supabase.from('vy_supplier_specialisms').delete().eq('id', id);
    logWrite('removeSupplierSpecialism', 'vy_supplier_specialisms', error);
  }, []);

  const addSupplierLabourRateType = useCallback(async (rt: DBSupplierLabourRateType) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSupplierLabourRateTypes(prev => [...prev, rt]);
    const { error } = await supabase.from('vy_supplier_labour_rate_types').upsert({ ...rt, org_id: oid }, { onConflict: 'id' });
    logWrite('addSupplierLabourRateType', 'vy_supplier_labour_rate_types', error);
  }, []);

  const updateSupplierLabourRateType = useCallback(async (rt: DBSupplierLabourRateType) => {
    const oid = getOrgId(orgIdRef.current);
    if (!oid) return;
    setSupplierLabourRateTypes(prev => prev.map(x => x.id === rt.id ? rt : x));
    const { error } = await supabase.from('vy_supplier_labour_rate_types').upsert({ ...rt, org_id: oid }, { onConflict: 'id' });
    logWrite('updateSupplierLabourRateType', 'vy_supplier_labour_rate_types', error);
  }, []);

  const removeSupplierLabourRateType = useCallback(async (id: string) => {
    setSupplierLabourRateTypes(prev => prev.filter(rt => rt.id !== id));
    const { error } = await supabase.from('vy_supplier_labour_rate_types').delete().eq('id', id);
    logWrite('removeSupplierLabourRateType', 'vy_supplier_labour_rate_types', error);
  }, []);

  return {
    projects, projectDocuments, attachments,
    actions, snags, snaggingReports, siteForms, tenders, tcRecords, maintenanceJobs, programmes, programmeTasks, keyDates,
    platformUsers, notifications,
    loading, modulesLoading,
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
    addSnaggingReport, updateSnaggingReport, removeSnaggingReport,
    addSiteForm, updateSiteForm, removeSiteForm,
    addTender, updateTender, removeTender,
    addTCRecord, updateTCRecord, removeTCRecord,
    addMaintenanceJob, updateMaintenanceJob, removeMaintenanceJob,
    addProgramme, updateProgramme, removeProgramme,
    addProgrammeTask, updateProgrammeTask, removeProgrammeTask,
    addKeyDate, updateKeyDate, removeKeyDate,
    addPlatformUser, updatePlatformUser, removePlatformUser,
    addNotification, markNotificationRead, markAllNotificationsRead,
    variationAccountItems,
    addVariationAccountItem, updateVariationAccountItem, removeVariationAccountItem,
    vaBuildUpLines,
    addVABuildUpLine, updateVABuildUpLine, removeVABuildUpLine,
    vaComments,
    addVAComment, removeVAComment,
    commercialRecordComments,
    addCommercialRecordComment, removeCommercialRecordComment,
    loadVADetailData, loadCommercialRecordComments,
    commercialApplications,
    addCommercialApplication, updateCommercialApplication, removeCommercialApplication,
    oAndMManuals,
    oAndMSections,
    oAndMItems,
    addOAndMManual, updateOAndMManual, removeOAndMManual,
    addOAndMSection, updateOAndMSection, removeOAndMSection, reorderOAndMSections,
    addOAndMItem, updateOAndMItem, removeOAndMItem, reorderOAndMItems,
    valuations, valuationWorkbooks, workbookLines, workbookExtras, valuationLineEntries, valuationExtraEntries,
    addValuation, updateValuation, removeValuation,
    addValuationWorkbook, updateValuationWorkbook, removeValuationWorkbook,
    addWorkbookLine, updateWorkbookLine, removeWorkbookLine, batchAddWorkbookLines,
    addWorkbookExtra, updateWorkbookExtra, removeWorkbookExtra, batchAddWorkbookExtras,
    upsertValuationLineEntry, batchUpsertValuationLineEntries,
    upsertValuationExtraEntry, batchUpsertValuationExtraEntries,
    suppliers, supplierTrades, supplierSpecialisms, supplierLabourRateTypes,
    addSupplier, updateSupplier, removeSupplier,
    addSupplierTrade, updateSupplierTrade, removeSupplierTrade,
    addSupplierSpecialism, updateSupplierSpecialism, removeSupplierSpecialism,
    addSupplierLabourRateType, updateSupplierLabourRateType, removeSupplierLabourRateType,
  };
}
