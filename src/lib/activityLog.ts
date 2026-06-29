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
  if (!params.orgId) return;
  try {
    // Always use the current auth session UUID — never accept a caller-supplied
    // user ID, which may be a non-UUID platform user ID ("pu-xxx").
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
