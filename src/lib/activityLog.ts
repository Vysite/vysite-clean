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

export async function logActivity(params: ActivityLogParams): Promise<void> {
  console.log('[ActivityLog] called:', params.actionType, '| orgId:', params.orgId || '(empty)', '| module:', params.module);

  if (!params.orgId) {
    console.warn('[ActivityLog] EARLY EXIT — orgId is empty/null. No insert will occur.');
    return;
  }

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[ActivityLog] getSession() error:', sessionError.message);
    }
    const authUserId = session?.user?.id ?? null;
    console.log('[ActivityLog] authUserId:', authUserId ?? '(null — no active session)');

    if (!authUserId) {
      console.warn('[ActivityLog] WARNING — no auth session. Insert may fail RLS if policies require auth.uid().');
    }

    const payload = {
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
    };
    console.log('[ActivityLog] inserting payload:', payload);

    const { error } = await supabase.from('vy_activity_log').insert(payload);

    if (error) {
      console.error('[ActivityLog] INSERT FAILED:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);
    } else {
      console.log('[ActivityLog] INSERT OK:', params.actionType, params.description);
    }
  } catch (err) {
    console.error('[ActivityLog] Unexpected exception:', err);
  }
}
