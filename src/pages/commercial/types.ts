import type { CommercialRecord, CommercialLineItem, CommercialRecordType, CommercialRecordStatus } from '../../data/types';
import type { DBAttachment, DBKeyDate } from '../../lib/store';
import type { Project } from '../../data/types';

export type { CommercialRecord, CommercialLineItem, CommercialRecordType, CommercialRecordStatus };
export type { DBAttachment, DBKeyDate };
export type { Project };

export type CommercialTab = 'overview' | 'register' | 'variation-account' | 'applications' | 'timeline';

export interface BannerValues {
  contractEdit: string;
  completedEdit: string;
  variationsEdit: string;
}

export const RECORD_TYPES: { value: CommercialRecordType; label: string; prefix: string; color: string }[] = [
  { value: 'variation',           label: 'Variation',           prefix: 'V',  color: 'bg-blue-900/40 text-blue-300 border-blue-700/50' },
  { value: 'delay_notice',        label: 'Delay Notice',        prefix: 'DN', color: 'bg-amber-900/40 text-amber-300 border-amber-700/50' },
  { value: 'compensation_event',  label: 'Compensation Event',  prefix: 'CE', color: 'bg-rose-900/40 text-rose-300 border-rose-700/50' },
];

export const STATUSES: { value: CommercialRecordStatus; label: string; color: string }[] = [
  { value: 'draft',               label: 'Draft',               color: 'bg-slate-700/60 text-slate-300 border-slate-600/50' },
  { value: 'submitted',           label: 'Submitted',           color: 'bg-sky-900/40 text-sky-300 border-sky-700/50' },
  { value: 'awaiting_agreement',  label: 'Awaiting Agreement',  color: 'bg-amber-900/40 text-amber-300 border-amber-700/50' },
  { value: 'agreed',              label: 'Agreed',              color: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50' },
  { value: 'added_to_valuation',  label: 'Added to Valuation',  color: 'bg-teal-900/40 text-teal-300 border-teal-700/50' },
  { value: 'paid',                label: 'Paid',                color: 'bg-green-900/40 text-green-300 border-green-700/50' },
  { value: 'complete',            label: 'Complete',            color: 'bg-green-900/60 text-green-200 border-green-700/60' },
  { value: 'rejected',            label: 'Rejected',            color: 'bg-red-900/40 text-red-300 border-red-700/50' },
];

export function typeInfo(t: CommercialRecordType) {
  return RECORD_TYPES.find(r => r.value === t) ?? RECORD_TYPES[0];
}

export function statusInfo(s: CommercialRecordStatus) {
  return STATUSES.find(x => x.value === s) ?? STATUSES[0];
}

export function fmtCurrency(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseRawValue(raw: string): number {
  const n = parseFloat(raw.replace(/[£,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
