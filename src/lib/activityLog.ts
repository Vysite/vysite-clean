import { supabase } from './supabase';

// ─── Cached auth user ID ──────────────────────────────────────────────────────
// Maintained by a single onAuthStateChange listener registered at module load.
// logActivity() reads this directly — no per-insert getSession() round-trip.

let _cachedUserId: string | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  _cachedUserId = session?.user?.id ?? null;
});

// Seed the cache from the current session on first import (non-blocking).
supabase.auth.getSession().then(({ data: { session } }) => {
  if (_cachedUserId === null) _cachedUserId = session?.user?.id ?? null;
});

// ─── Types ────────────────────────────────────────────────────────────────────

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
  /**
   * Mark as true for important free-text narrative fields (description,
   * notes, comments, scope, etc.). These fields are stored in full in
   * metadata.diffs so the complete before/after text is always retrievable,
   * not just a truncated inline summary.
   */
  isNarrative?: boolean;
  /** Optional value formatter; defaults to string coercion with '—' for empty */
  format?: (v: unknown) => string;
}

/** Full before/after record for a single changed field, stored in metadata */
export interface FieldDiff {
  label: string;
  prev: string;
  new: string;
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

/**
 * Compare two plain objects field-by-field using the provided field spec.
 *
 * Returns:
 *   changesText  — semicolon-joined "Label: old → new" for short fields;
 *                  narrative fields appear as "Label was edited"
 *   fieldDiffs   — full before/after objects for every changed field
 *                  (pass to logActivity as metadata.diffs)
 *   prevValue    — single prev string when exactly one short field changed
 *   newValue     — single new string when exactly one short field changed
 *   hasChanges   — whether any fields changed
 *   actionType   — 'status_changed' if the 'status' key changed, else 'record_updated'
 */
export function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: FieldSpec[],
): {
  changesText: string;
  fieldDiffs: FieldDiff[];
  prevValue: string | null;
  newValue: string | null;
  hasChanges: boolean;
  actionType: 'status_changed' | 'record_updated';
} {
  const inlineChanges: string[] = [];
  const fieldDiffs: FieldDiff[] = [];
  let statusChanged = false;
  let statusPrev: string | null = null;
  let statusNew: string | null = null;
  let shortFieldCount = 0;
  let singleShortPrev: string | null = null;
  let singleShortNew: string | null = null;

  for (const { label, key, isNarrative, format } of fields) {
    const fmt = format ?? fmtValue;
    const bv = fmt(before[key]);
    const av = fmt(after[key]);
    if (bv === av) continue;

    // Always collect full diff for every changed field
    fieldDiffs.push({ label, prev: bv, new: av });

    if (isNarrative) {
      // Narrative fields: note they changed but don't inline the full text
      inlineChanges.push(`${label} was edited`);
    } else {
      // Short fields: inline the old → new values
      inlineChanges.push(`${label}: ${bv} → ${av}`);
      shortFieldCount++;
      singleShortPrev = bv;
      singleShortNew = av;

      if (key === 'status') {
        statusChanged = true;
        statusPrev = bv;
        statusNew = av;
      }
    }
  }

  const hasChanges = fieldDiffs.length > 0;
  const changesText = inlineChanges.join('; ');

  // prevValue / newValue: use status values if status changed, otherwise
  // use the single short-field values if only one short field changed.
  const prevValue = statusChanged
    ? statusPrev
    : shortFieldCount === 1
    ? singleShortPrev
    : null;
  const newValue = statusChanged
    ? statusNew
    : shortFieldCount === 1
    ? singleShortNew
    : null;

  return {
    changesText,
    fieldDiffs,
    prevValue,
    newValue,
    hasChanges,
    actionType: statusChanged ? 'status_changed' : 'record_updated',
  };
}

// ─── Core insert ─────────────────────────────────────────────────────────────

export async function logActivity(params: ActivityLogParams): Promise<void> {
  if (!params.orgId) return;
  try {
    const { error } = await supabase.from('vy_activity_log').insert({
      org_id:       params.orgId,
      user_id:      _cachedUserId,
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
