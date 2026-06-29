import { supabase } from './supabase';

export type ActivityActionType =
  // Records
  | 'record_created'
  | 'record_updated'
  | 'record_deleted'
  | 'status_changed'
  // Comments & Attachments
  | 'comment_added'
  | 'attachment_uploaded'
  | 'attachment_deleted'
  // Exports
  | 'pdf_exported'
  // Users
  | 'user_invited'
  | 'user_created'
  | 'user_updated'
  | 'user_removed'
  | 'permission_changed'
  // Settings
  | 'settings_changed';

export interface ActivityLogParams {
  orgId: string;
  userName: string;
  module: string;
  recordId?: string | null;
  recordRef?: string | null;
  recordType?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  actionType: ActivityActionType;
  description: string;
  prevValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ─── Field-diff helper ────────────────────────────────────────────────────────

export interface FieldSpec {
  /** Human-readable label shown in the audit trail */
  label: string;
  /** Key to read from the before/after objects */
  key: string;
  /** Optional value formatter; defaults to string coercion with '—' for empty */
  format?: (v: unknown) => string;
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return String(v);
  return String(v);
}

/**
 * Compare two plain objects field-by-field using the provided field spec.
 * Returns:
 *   changesText  — semicolon-joined list of "Label: old → new" strings
 *   prevValue    — single prev value if exactly one field changed, else null
 *   newValue     — single new value if exactly one field changed, else null
 *   hasChanges   — whether any fields changed
 *   actionType   — 'status_changed' if the 'status' key changed, else 'record_updated'
 */
export function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: FieldSpec[],
): {
  changesText: string;
  prevValue: string | null;
  newValue: string | null;
  hasChanges: boolean;
  actionType: 'status_changed' | 'record_updated';
} {
  const changes: string[] = [];
  let statusChanged = false;
  let singlePrev: string | null = null;
  let singleNew: string | null = null;

  for (const { label, key, format } of fields) {
    const fmt = format ?? fmtValue;
    const bv = fmt(before[key]);
    const av = fmt(after[key]);
    if (bv === av) continue;
    changes.push(`${label}: ${bv} → ${av}`);
    if (key === 'status') {
      statusChanged = true;
      singlePrev = bv;
      singleNew = av;
    }
  }

  const hasChanges = changes.length > 0;

  return {
    changesText: changes.join('; '),
    prevValue:   changes.length === 1 ? singlePrev ?? changes[0].split(' → ')[0].split(': ').slice(1).join(': ') : (statusChanged ? singlePrev : null),
    newValue:    changes.length === 1 ? singleNew  ?? changes[0].split(' → ')[1]                                  : (statusChanged ? singleNew  : null),
    hasChanges,
    actionType:  statusChanged ? 'status_changed' : 'record_updated',
  };
}

// ─── Core insert ─────────────────────────────────────────────────────────────

export async function logActivity(params: ActivityLogParams): Promise<void> {
  if (!params.orgId) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const authUserId = session?.user?.id ?? null;

    const { error } = await supabase.from('vy_activity_log').insert({
      org_id:       params.orgId,
      user_id:      authUserId,
      user_name:    params.userName,
      module:       params.module,
      record_id:    params.recordId ?? null,
      record_ref:   params.recordRef ?? null,
      record_type:  params.recordType ?? null,
      project_id:   params.projectId ?? null,
      project_name: params.projectName ?? null,
      action_type:  params.actionType,
      description:  params.description,
      prev_value:   params.prevValue ?? null,
      new_value:    params.newValue ?? null,
      reason:       params.reason ?? null,
      metadata:     params.metadata ?? null,
    });

    if (error) {
      console.error('[ActivityLog] Insert failed:', error.message, '| code:', error.code);
    }
  } catch (err) {
    console.error('[ActivityLog] Unexpected error:', err);
  }
}
