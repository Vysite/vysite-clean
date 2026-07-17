/**
 * refSequence.ts
 *
 * Universal auto-number service for every numbered record type in VYSITE.
 *
 * Delegates to the `get_next_seq_val` Postgres function which uses an atomic
 * INSERT … ON CONFLICT DO UPDATE so concurrent users can never receive the
 * same integer.  Numbers survive refreshes, deployments, and archived/deleted
 * records because the sequence only ever moves forward.
 *
 * Usage
 * ─────
 *   // String ref  e.g. "VAL-003"
 *   const ref = await nextRef(project.id, 'VAL', 3);
 *
 *   // Integer (no prefix), e.g. application numbers
 *   const num = await nextSeqVal(project.id, 'APP');
 *
 * scope_id
 * ────────
 *   VAL-   → project.id
 *   VAR-   → project.id
 *   EWN-   → org.id
 *   DN-    → org.id
 *   V-     → org.id
 *   APP    → project.id  (integer, no dash-prefix)
 *   SN-    → report.id
 *   RFI-   → tender.id
 */

import { supabase } from './supabase';

/**
 * Returns the next integer for (scopeId, prefix) and increments the counter.
 * Throws on DB error so the caller can surface the failure.
 */
export async function nextSeqVal(scopeId: string, prefix: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_next_seq_val', {
    p_scope_id: scopeId,
    p_prefix:   prefix,
  });
  if (error) throw new Error(`Sequence error (${prefix}): ${error.message}`);
  return data as number;
}

/**
 * Returns a formatted reference string like "VAL-003".
 * pad defaults to 3 (gives 001–999, then 1000+ without truncation).
 */
export async function nextRef(
  scopeId: string,
  prefix: string,
  pad = 3,
): Promise<string> {
  const val = await nextSeqVal(scopeId, prefix);
  return `${prefix}-${String(val).padStart(pad, '0')}`;
}
