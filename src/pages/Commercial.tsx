import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  TrendingUp, Plus, X, Save,
  Paperclip, Trash2, Eye, Download, FileText,
  Banknote, HardHat, Calculator,
  ChevronRight, AlertCircle, CheckCircle2, Clock, CircleDot,
  GitBranch, GitMerge, MessageSquare, Send, ArrowRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import { logActivity, buildDiff, type FieldSpec } from '../lib/activityLog';
import FileUploadComponent from '../components/FileUpload';
import type { UploadedFile } from '../components/FileUpload';
import type { CommercialRecord, CommercialLineItem, CommercialRecordType, CommercialRecordStatus, CommercialEvent } from '../data/types';
import type { DBAttachment, DBCommercialRecordComment } from '../lib/store';

import CommercialOverview from './commercial/CommercialOverview';
import CommercialRegister from './commercial/CommercialRegister';
import VariationAccount, { calcVAMetrics } from './commercial/VariationAccount';
import CommercialApplications from './commercial/CommercialApplications';
import CommercialTimeline from './commercial/CommercialTimeline';
import CommercialValuations from './commercial/CommercialValuations';
import type { CommercialTab } from './commercial/types';
import { RECORD_TYPES, STATUSES, typeInfo, statusInfo, parseRawValue, fmtCurrency as fmtC } from './commercial/types';
import { exportFullCommercialReport } from './commercial/CommercialPDF';
import { openPrintTab } from '../lib/printTab';

// ─── Constants ─────────────────────────────────────────────────────────────────

const UNITS = ['nr', 'item', 'm', 'm²', 'm³', 'hrs', 'days', 'wks', 'sum', 'tonnes', 'kg', 'l'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCurrency(n: number): string { return fmtC(n); }

function lineTotal(line: CommercialLineItem, field: 'internal' | 'client'): number {
  if (field === 'internal') return line.quantity * line.internalRate;
  return line.quantity * line.clientRate;
}

function recordTotals(lines: CommercialLineItem[]) {
  const totalInternal = lines.reduce((s, l) => s + lineTotal(l, 'internal'), 0);
  const totalClient   = lines.reduce((s, l) => s + lineTotal(l, 'client'), 0);
  const margin        = totalClient - totalInternal;
  const marginPct     = totalClient > 0 ? (margin / totalClient) * 100 : 0;
  return { totalInternal, totalClient, margin, marginPct };
}

// ─── DB mappers ────────────────────────────────────────────────────────────────

function dbToRecord(r: Record<string, unknown>, projectName?: string): CommercialRecord {
  return {
    id:              r.id as string,
    orgId:           r.org_id as string,
    projectId:       r.project_id as string | null,
    projectName,
    recordType:      r.record_type as CommercialRecordType,
    reference:       r.reference as string,
    title:           r.title as string,
    client:          r.client as string,
    status:          r.status as CommercialRecordStatus,
    dateRaised:      r.date_raised as string | null,
    dateSubmitted:   r.date_submitted as string | null,
    dateAgreed:      r.date_agreed as string | null,
    statusChangedAt: r.status_changed_at as string | null,
    notes:           r.notes as string,
    createdBy:       r.created_by as string | null,
    createdAt:       r.created_at as string,
    updatedAt:       r.updated_at as string,
    extraData:       r.extra_data as Record<string, unknown> | null ?? null,
    convertedToId:   r.converted_to_id as string | null ?? null,
    convertedFromId: r.converted_from_id as string | null ?? null,
  };
}

function dbToEvent(r: Record<string, unknown>): CommercialEvent {
  return {
    id:          r.id as string,
    orgId:       r.org_id as string,
    recordId:    r.record_id as string,
    projectId:   r.project_id as string | null,
    eventType:   r.event_type as CommercialEvent['eventType'],
    fromStatus:  r.from_status as string | null,
    toStatus:    r.to_status as string,
    userName:    r.user_name as string | null,
    occurredAt:  r.occurred_at as string,
  };
}

function dbToLineItem(r: Record<string, unknown>): CommercialLineItem {
  return {
    id:                r.id as string,
    orgId:             r.org_id as string,
    recordId:          r.record_id as string,
    sortOrder:         r.sort_order as number,
    description:       (r.description as string) || (r.client_description as string) || '',
    clientDescription: (r.client_description as string) || (r.description as string) || '',
    lineType:          (r.line_type as string) || 'Labour',
    unit:              r.unit as string,
    quantity:          Number(r.quantity),
    internalRate:      Number(r.internal_rate),
    clientRate:        Number(r.client_rate),
    markupPct:         r.markup_pct != null ? Number(r.markup_pct) : null,
  };
}

// ─── Shared input styles ───────────────────────────────────────────────────────

const inputCls  = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#f97316] focus:border-[#f97316] transition-colors';
const labelCls  = 'block text-xs font-medium text-slate-400 mb-1';
const selectCls = `${inputCls} appearance-none cursor-pointer`;

// ─── Type / Status badges ──────────────────────────────────────────────────────

function TypeBadge({ type }: { type: CommercialRecordType }) {
  const t = typeInfo(type);
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${t.color}`}>{t.label}</span>;
}

function StatusBadge({ status }: { status: CommercialRecordStatus }) {
  const s = statusInfo(status);
  const icons: Record<string, React.ReactNode> = {
    draft: <CircleDot size={11} />, submitted: <ChevronRight size={11} />,
    awaiting_agreement: <Clock size={11} />, agreed: <CheckCircle2 size={11} />,
    added_to_valuation: <Banknote size={11} />, paid: <CheckCircle2 size={11} />,
    complete: <CheckCircle2 size={11} />, rejected: <AlertCircle size={11} />,
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${s.color}`}>{icons[status]}{s.label}</span>;
}

// ─── PDF export builder (record detail) ───────────────────────────────────────

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CLIENT_COPY_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1e293b; background: white; font-size: 11px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 860px; margin: 0 auto; padding: 36px 40px; }
    .doc-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid #f97316; margin-bottom: 20px; }
    .doc-logo-img { height: 38px; max-width: 160px; display: block; margin-bottom: 4px; }
    .doc-logo-text { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: 0.05em; }
    .doc-type-label { font-size: 10px; color: #64748b; margin-top: 4px; }
    .doc-header-right { text-align: right; }
    .doc-title { font-size: 18px; font-weight: 900; color: #111; margin-bottom: 4px; line-height: 1.25; max-width: 380px; }
    .doc-dateline { font-size: 11px; color: #64748b; }
    .doc-subtitle-bar { font-size: 11px; color: #64748b; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
    .status-badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 6px; vertical-align: middle; }
    .s-draft { background: #f1f5f9; color: #475569; } .s-submitted { background: #dbeafe; color: #1d4ed8; }
    .s-agreed { background: #d1fae5; color: #065f46; } .s-other { background: #f1f5f9; color: #475569; }
    .meta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; }
    .meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
    .meta-value { font-size: 11px; font-weight: 600; color: #0f172a; }
    .section { margin-top: 20px; page-break-inside: avoid; }
    .section-heading { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 10px; }
    .section-content { font-size: 11px; color: #334155; line-height: 1.65; white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 2px; }
    .data-table th { padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; }
    .data-table th.num { text-align: right; }
    .data-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: top; }
    .data-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .data-table tr:nth-child(even) td { background: #f8fafc; }
    .data-table tr:last-child td { border-bottom: none; }
    .totals-block { border-collapse: collapse; width: auto; margin-left: auto; margin-top: 12px; }
    .totals-block td { padding: 5px 10px; font-size: 11px; border-top: 1px solid #e2e8f0; }
    .totals-block td.label { color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding-right: 24px; }
    .totals-block td.val { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; color: #0f172a; }
    .evidence-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 8px; }
    .evidence-item { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
    .evidence-img { width: 100%; max-height: 280px; object-fit: contain; background: #f8fafc; display: block; }
    .evidence-caption { padding: 6px 10px; font-size: 9px; color: #64748b; background: #f8fafc; border-top: 1px solid #e2e8f0; }
    .legal-footer { margin-top: 28px; border-top: 2px solid #e2e8f0; page-break-inside: avoid; }
    .legal-footer-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 0 8px; }
    .legal-footer-title { font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
    .legal-footer-ref { font-size: 8px; color: #94a3b8; }
    .legal-notice-bar { background: #fffbf5; border: 1px solid #fed7aa; border-left: 3px solid #f97316; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; }
    .legal-notice-label { font-size: 7.5px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.09em; margin-bottom: 3px; }
    .legal-notice-text { font-size: 8.5px; color: #92400e; line-height: 1.65; }
    .legal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
    .legal-cell { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 8px 12px; }
    .legal-cell-label { font-size: 7.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
    .legal-cell-text { font-size: 8.5px; color: #475569; line-height: 1.6; }
    .legal-branding { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid #e2e8f0; }
    .legal-branding-left { font-size: 8px; color: #94a3b8; }
    .legal-branding-right { font-size: 8px; color: #94a3b8; text-align: right; }
    @media print { .page { padding: 20px 24px; } .section { page-break-inside: avoid; } }
    @page { margin: 0; size: A4; }
    .page-break-before { page-break-before: always; }
  `;

interface ClientCopyParams {
  record: CommercialRecord;
  lines: CommercialLineItem[];
  view: 'internal' | 'client';
  attachments: DBAttachment[];
  logoUrl?: string;
  companyName?: string;
  pageBreakBefore?: boolean;
}

export function buildClientCopyPageContent(p: ClientCopyParams): string {
  const { record, lines, view, attachments, logoUrl, companyName, pageBreakBefore } = p;
  const t = typeInfo(record.recordType);
  const s = statusInfo(record.status);
  const totals = recordTotals(lines);
  const orgName = companyName || 'VYSITE';
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const docRef = record.reference || `COM-${record.id.slice(0, 8).toUpperCase()}`;
  const viewLabel = view === 'internal' ? 'Internal Copy \u2014 Confidential' : 'Client Copy';
  const fmtD = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014';

  const logoHtml = logoUrl
    ? `<img class="doc-logo-img" src="${logoUrl}" alt="${esc(orgName)}" />`
    : `<div class="doc-logo-text">${esc(orgName)}</div>`;

  const statusCls = ['agreed','paid','complete','added_to_valuation'].includes(record.status) ? 's-agreed'
    : ['submitted','awaiting_agreement'].includes(record.status) ? 's-submitted'
    : record.status === 'draft' ? 's-draft' : 's-other';

  const header = `
    <div class="doc-header">
      <div>${logoHtml}<div class="doc-type-label">Commercial Record &mdash; ${esc(t.label)}</div></div>
      <div class="doc-header-right">
        <div class="doc-title">${esc(record.reference ? record.reference + ' \u2014 ' : '')}${esc(record.title || 'Untitled')}</div>
        <div class="doc-dateline">${today}${record.projectName ? ' &nbsp;&middot;&nbsp; ' + esc(record.projectName) : ''}</div>
      </div>
    </div>
    <div class="doc-subtitle-bar">
      ${esc(t.label)}${record.reference ? ' &nbsp;&middot;&nbsp; ' + esc(record.reference) : ''}
      ${record.projectName ? ' &nbsp;&middot;&nbsp; ' + esc(record.projectName) : ''}
      <span class="status-badge ${statusCls}">${esc(s.label)}</span>
      &nbsp;&middot;&nbsp; <strong>${esc(viewLabel)}</strong>
    </div>`;

  const metaItems = [
    ['Reference', record.reference || '\u2014'],
    ['Record Type', t.label],
    ['Client', record.client || '\u2014'],
    ['Status', s.label],
    ['Date Raised', fmtD(record.dateRaised)],
    ['Date Submitted', fmtD(record.dateSubmitted)],
    ['Date Agreed', fmtD(record.dateAgreed)],
    ['Status Changed', fmtD(record.statusChangedAt)],
    ['Document Ref', docRef],
    ['Project', record.projectName || '\u2014'],
  ].map(([label, value]) =>
    `<div class="meta-item"><div class="meta-label">${esc(label)}</div><div class="meta-value">${esc(value)}</div></div>`
  ).join('');
  const metaBlock = `<div class="meta-block"><div class="meta-grid">${metaItems}</div></div>`;

  const notesSection = record.notes
    ? `<div class="section"><div class="section-heading">Commercial Details &amp; Notes</div><div class="section-content">${esc(record.notes)}</div></div>`
    : '';

  // Extra data sections — document refs and type-specific fields
  const ex = record.extraData ?? {};
  const docRefField   = ex.document_ref as string | undefined;
  const relatedRefs   = ex.related_refs as string | undefined;
  const refRow = (docRefField || relatedRefs)
    ? `<div class="section"><div class="section-heading">Document References</div><div class="meta-block"><div class="meta-grid">
        ${docRefField ? `<div class="meta-item"><div class="meta-label">Document Ref</div><div class="meta-value">${esc(docRefField)}</div></div>` : ''}
        ${relatedRefs ? `<div class="meta-item"><div class="meta-label">Related Records</div><div class="meta-value">${esc(relatedRefs)}</div></div>` : ''}
      </div></div></div>` : '';

  let typeFieldsSection = '';
  if (record.recordType === 'delay_notice') {
    const dnRows = [
      ['Related EWN Reference', ex.ewn_ref as string],
      ['Responsible Party',     ex.responsible_party as string],
      ['Date Delay First Occurred', ex.delay_start_date ? fmtD(ex.delay_start_date as string) : undefined],
      ['Date Notice Issued',    ex.notice_issued_date ? fmtD(ex.notice_issued_date as string) : undefined],
      ['Potential Programme Impact', ex.programme_days ? `${ex.programme_days} days` : undefined],
      ['Potential Cost Impact', ex.potential_cost ? `\u00a3${ex.potential_cost}` : undefined],
    ].filter(([, v]) => v);
    const causeField = ex.cause_of_delay as string | undefined;
    const impactField = ex.impacted_works as string | undefined;
    if (dnRows.length || causeField || impactField) {
      const dnMeta = dnRows.length
        ? `<div class="meta-block"><div class="meta-grid">${dnRows.map(([l, v]) => `<div class="meta-item"><div class="meta-label">${esc(l as string)}</div><div class="meta-value">${esc(v as string)}</div></div>`).join('')}</div></div>`
        : '';
      const causeSection = causeField ? `<div style="margin-top:10px"><div class="meta-label" style="margin-bottom:4px">Cause of Delay</div><div class="section-content">${esc(causeField)}</div></div>` : '';
      const impactSection = impactField ? `<div style="margin-top:10px"><div class="meta-label" style="margin-bottom:4px">Impacted Works</div><div class="section-content">${esc(impactField)}</div></div>` : '';
      typeFieldsSection = `<div class="section"><div class="section-heading">Delay Notice Details</div>${dnMeta}${causeSection}${impactSection}</div>`;
    }
  }

  const lineMarginPct = (l: CommercialLineItem) => {
    const ct = lineTotal(l, 'client'), it = lineTotal(l, 'internal');
    return ct > 0 ? ((ct - it) / ct * 100).toFixed(1) + '%' : '\u2014';
  };

  const lineRowsHtml = lines.map((l, i) => {
    const desc = l.description || l.clientDescription || '\u2014';
    const type = l.lineType || '\u2014';
    const it = lineTotal(l, 'internal'), ct = lineTotal(l, 'client');
    if (view === 'internal') {
      return `<tr>
        <td class="num" style="color:#94a3b8;font-size:9px">${i+1}</td>
        <td>${esc(desc)}</td><td>${esc(type)}</td>
        <td class="num">${l.quantity}</td><td>${esc(l.unit)}</td>
        <td class="num">\u00a3${fmt(l.internalRate)}</td>
        <td class="num">${l.markupPct != null ? l.markupPct.toFixed(1)+'%' : '\u2014'}</td>
        <td class="num">\u00a3${fmt(l.clientRate)}</td><td class="num">\u00a3${fmt(ct)}</td>
        <td class="num">${lineMarginPct(l)}</td>
      </tr>`;
    }
    return `<tr>
      <td class="num" style="color:#94a3b8;font-size:9px">${i+1}</td>
      <td>${esc(desc)}</td><td>${esc(type)}</td>
      <td class="num">${l.quantity}</td><td>${esc(l.unit)}</td>
      <td class="num">\u00a3${fmt(l.clientRate)}</td><td class="num">\u00a3${fmt(ct)}</td>
    </tr>`;
  }).join('');

  const internalThead = `<tr><th class="num">#</th><th>Description</th><th>Type</th><th class="num">Qty</th><th>Unit</th><th class="num">Cost Price</th><th class="num">Markup %</th><th class="num">Sales Price</th><th class="num">Total</th><th class="num">Margin %</th></tr>`;
  const clientThead   = `<tr><th class="num">#</th><th>Description</th><th>Type</th><th class="num">Qty</th><th>Unit</th><th class="num">Sales Price</th><th class="num">Total</th></tr>`;
  const emptyColspan  = view === 'internal' ? 10 : 7;
  const totalsHtml    = view === 'internal'
    ? `<table class="totals-block"><tr><td class="label">Total Cost</td><td class="val">\u00a3${fmt(totals.totalInternal)}</td></tr><tr><td class="label">Total Sales Value</td><td class="val">\u00a3${fmt(totals.totalClient)}</td></tr><tr><td class="label">Gross Margin</td><td class="val">\u00a3${fmt(totals.margin)} (${totals.marginPct.toFixed(1)}%)</td></tr></table>`
    : `<table class="totals-block"><tr><td class="label">Total Sales Value</td><td class="val">\u00a3${fmt(totals.totalClient)}</td></tr></table>`;

  const costSection = `<div class="section"><div class="section-heading">Cost Breakdown</div><table class="data-table"><thead>${view === 'internal' ? internalThead : clientThead}</thead><tbody>${lineRowsHtml || `<tr><td colspan="${emptyColspan}" style="text-align:center;color:#94a3b8;padding:16px">No line items recorded.</td></tr>`}</tbody></table>${totalsHtml}</div>`;

  const images = attachments.filter(a => a.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(a.name ?? ''));
  const docs   = attachments.filter(a => !images.includes(a));
  const imagesHtml = images.length ? `<div class="evidence-grid">${images.map(img => `<div class="evidence-item">${img.data_url ? `<img class="evidence-img" src="${img.data_url}" alt="${esc(img.name)}" />` : `<div class="evidence-img" style="min-height:120px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px">Image unavailable</div>`}<div class="evidence-caption">${esc(img.name)}</div></div>`).join('')}</div>` : '';
  const docsHtml   = docs.length ? `<table class="data-table" style="margin-top:${images.length ? '14px' : '2px'}"><thead><tr><th>File</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Download</th></tr></thead><tbody>${docs.map(d => { const tl = d.type ? (d.type.split('/').pop()?.toUpperCase() ?? d.type) : (d.name?.split('.').pop()?.toUpperCase() ?? 'File'); const sz = d.size ? fmtFileSize(d.size) : '\u2014'; const link = d.data_url ? `<a href="${d.data_url}" download="${esc(d.name)}" style="color:#f97316;text-decoration:none;font-weight:600">&#11015; Download</a>` : '\u2014'; return `<tr><td>${esc(d.name)}</td><td>${esc(tl)}</td><td>${esc(sz)}</td><td>${d.created_at ? new Date(d.created_at).toLocaleDateString('en-GB') : '\u2014'}</td><td>${link}</td></tr>`; }).join('')}</tbody></table>` : '';
  const evidenceSection = (images.length || docs.length) ? `<div class="section"><div class="section-heading">Evidence &amp; Attachments (${attachments.length})</div>${imagesHtml}${docsHtml}</div>` : '';

  const COMMERCIAL_NOTICES: Record<string, string> = {
    variation: 'This variation record has been prepared using the information available at the date of issue. The value contained within this record remains subject to review, substantiation, amendment and agreement until formally accepted by the relevant parties. Nothing within this record shall be construed as agreement of entitlement, liability, quantum or final account position.',
    delay_notice: 'This delay notice has been issued to notify an event which may affect progress, completion or resource requirements. The duration, effects and associated costs of the delaying event remain under review and may be amended whilst the event remains ongoing. This notice is issued without prejudice to any contractual entitlement or future assessment of time and cost.',
    compensation_event: 'This compensation event record has been prepared using the information available at the time of issue. The value and impact recorded may be revised as further information becomes available. This record does not constitute final agreement of entitlement, assessment or valuation.',
    early_warning_notice: 'This Early Warning Notice (EWN) has been issued in accordance with the contract to give notice of a matter which could increase the total price, delay completion, or impair performance. This notice is issued without prejudice to any assessment of time and cost impact and does not constitute admission of entitlement or liability.',
    extension_of_time: 'This Extension of Time (EOT) application has been prepared based on information available at the date of issue. The programme impact and entitlement claimed remain subject to substantiation, review and formal assessment by the contract administrator. This record is issued without prejudice.',
    loss_and_expense: 'This Loss and Expense notice has been prepared using the information available at the date of issue. The amounts recorded are preliminary assessments and remain subject to full substantiation, review and agreement. Nothing in this record constitutes final settlement of the claim.',
    payment_notice: 'This Payment Notice has been issued in accordance with the contract payment provisions. The sum stated is subject to any pay less notice issued by the paying party within the prescribed period. This document should be read in conjunction with the contract conditions.',
    pay_less_notice: 'This Pay Less Notice has been issued in accordance with the contract payment provisions and applicable legislation. The paying party intends to pay less than the notified sum for the reasons stated herein. This notice is issued within the required contractual timeframe.',
    client_instruction: 'This Client Instruction has been recorded for traceability purposes. Where the instruction has cost, programme or scope implications, a corresponding commercial record should be raised. The existence of this record does not imply that cost or time implications have been agreed.',
    commercial_risk: 'This commercial risk record is an internal document prepared for risk management purposes. The potential values stated are estimates only and do not represent agreed entitlement or liability. This document is confidential and must not be disclosed to external parties without authorisation.',
    commercial_opportunity: 'This commercial opportunity record is an internal document prepared for commercial management purposes. The potential values stated are estimates only and remain subject to realisation, substantiation and agreement. This document is confidential.',
    dispute_query: 'This dispute / query record has been raised for commercial management and traceability purposes. Nothing in this record constitutes a formal dispute notice under the contract. Legal advice should be sought before escalating any matter to formal dispute resolution.',
    evidence_record: 'This evidence record has been prepared to document events, instructions, site conditions or circumstances relevant to commercial entitlement. The information contained should be read in conjunction with the relevant contractual provisions and supporting documentation.',
    commercial_note: 'This commercial note is an internal record for information and reference purposes. It does not represent a formal contractual communication and should not be disclosed externally without authorisation.',
  };
  const contractualNotice = COMMERCIAL_NOTICES[record.recordType] ?? '';
  const noticeBar = contractualNotice ? `<div class="legal-notice-bar"><div class="legal-notice-label">Contractual Notice</div><div class="legal-notice-text">${esc(contractualNotice)}</div></div>` : '';

  const pageBreakDiv = pageBreakBefore ? '<div class="page-break-before"></div>' : '';

  return `${pageBreakDiv}<div class="page">${header}${metaBlock}${refRow}${notesSection}${typeFieldsSection}${costSection}${evidenceSection}
    <div class="legal-footer">
      <div class="legal-footer-header"><span class="legal-footer-title">Legal &amp; Contractual Information</span><span class="legal-footer-ref">Ref: ${esc(docRef)}</span></div>
      ${noticeBar}
      <div class="legal-branding"><div class="legal-branding-left">${esc(orgName)} &bull; Construction Operating System &bull; Generated ${today}</div><div class="legal-branding-right">&copy; ${esc(orgName)}. All rights reserved. Confidential.</div></div>
    </div>
    </div>`;
}

function buildExportHTML(
  record: CommercialRecord,
  lines: CommercialLineItem[],
  view: 'internal' | 'client',
  attachments: DBAttachment[],
  logoUrl?: string,
  companyName?: string,
): string {
  const ref = record.reference || 'Record';
  const body = buildClientCopyPageContent({ record, lines, view, attachments, logoUrl, companyName });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(ref)} — ${esc(record.title || '')}</title><style>${CLIENT_COPY_CSS}</style></head><body>${body}</body></html>`;
}

function genLineId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const LINE_TYPES = ['Labour', 'Material', 'Plant', 'Subcontractor', 'Prelims', 'Other'];

type DraftLineItem = Omit<CommercialLineItem, 'id' | 'orgId' | 'recordId'> & { id?: string };

// Shared cell/input styles matching VA build-up table
const liCellCls = 'px-2 py-2 text-xs';
const liThCls   = 'px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500';
const liNumIn   = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded px-1.5 py-1 text-xs text-white text-right placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#f97316]';
const liTxtIn   = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded px-1.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#f97316]';
const liSelIn   = `${liTxtIn} appearance-none cursor-pointer`;

interface LineEntryForm {
  description: string;
  lineType: string;
  unit: string;
  quantity: string;
  internalRate: string;
  markupPct: string;
  clientRate: string;
}

const BLANK_ENTRY: LineEntryForm = { description: '', lineType: 'Labour', unit: 'nr', quantity: '', internalRate: '', markupPct: '', clientRate: '' };

function calcEntryTotals(f: LineEntryForm) {
  const qty      = parseFloat(f.quantity)     || 0;
  const cost     = parseFloat(f.internalRate) || 0;
  const mkup     = parseFloat(f.markupPct)    || 0;
  const sales    = f.clientRate !== '' ? (parseFloat(f.clientRate) || 0) : cost * (1 + mkup / 100);
  const total    = qty * sales;
  return { qty, cost, mkup, sales, total };
}

function LineEntryRow({
  form, onChange, onSave, onCancel, canViewPricing,
}: {
  form: LineEntryForm;
  onChange: (f: LineEntryForm) => void;
  onSave: () => void;
  onCancel: () => void;
  canViewPricing: boolean;
}) {
  const c = calcEntryTotals(form);
  return (
    <tr className="bg-[#1a2236]">
      <td className={liCellCls}></td>
      <td className={liCellCls} style={{ minWidth: 140 }}>
        <input className={liTxtIn} value={form.description} onChange={e => onChange({ ...form, description: e.target.value })} placeholder="Description" autoFocus />
      </td>
      <td className={liCellCls} style={{ minWidth: 110 }}>
        <select className={liSelIn} value={form.lineType} onChange={e => onChange({ ...form, lineType: e.target.value })}>
          {LINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className={liCellCls} style={{ minWidth: 70 }}>
        <select className={liSelIn} value={form.unit} onChange={e => onChange({ ...form, unit: e.target.value })}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td className={liCellCls} style={{ minWidth: 60 }}>
        <input className={liNumIn} type="text" inputMode="decimal" value={form.quantity} onChange={e => onChange({ ...form, quantity: e.target.value })} placeholder="0" />
      </td>
      {canViewPricing && (
        <>
          <td className={liCellCls} style={{ minWidth: 80 }}>
            <input className={liNumIn} type="text" inputMode="decimal" value={form.internalRate} onChange={e => {
              const next = { ...form, internalRate: e.target.value };
              const cost2 = parseFloat(e.target.value) || 0;
              const mkup2 = parseFloat(form.markupPct) || 0;
              next.clientRate = String((cost2 * (1 + mkup2 / 100)).toFixed(2));
              onChange(next);
            }} placeholder="0.00" />
          </td>
          <td className={liCellCls} style={{ minWidth: 70 }}>
            <input className={liNumIn} type="text" inputMode="decimal" value={form.markupPct} onChange={e => {
              const next = { ...form, markupPct: e.target.value };
              const cost2 = parseFloat(form.internalRate) || 0;
              const mkup2 = parseFloat(e.target.value) || 0;
              next.clientRate = String((cost2 * (1 + mkup2 / 100)).toFixed(2));
              onChange(next);
            }} placeholder="0" />
          </td>
        </>
      )}
      <td className={liCellCls} style={{ minWidth: 80 }}>
        <input className={liNumIn} type="text" inputMode="decimal" value={form.clientRate} onChange={e => onChange({ ...form, clientRate: e.target.value })} placeholder="0.00" />
      </td>
      <td className={`${liCellCls} text-right tabular-nums font-semibold text-white`} style={{ minWidth: 80 }}>{fmtCurrency(c.total)}</td>
      <td className={liCellCls}>
        <div className="flex items-center gap-1">
          <button onClick={onSave} className="p-1 rounded bg-[#f97316] hover:bg-orange-400 text-white transition-colors"><Save size={12} /></button>
          <button onClick={onCancel} className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors"><X size={12} /></button>
        </div>
      </td>
    </tr>
  );
}

function LineItemEditor({
  lines, onChange, canViewPricing, onPersistLine, onDeleteLine,
}: {
  lines: DraftLineItem[];
  onChange: (l: DraftLineItem[]) => void;
  canViewPricing: boolean;
  onPersistLine?: (line: DraftLineItem, sortOrder: number) => Promise<void>;
  onDeleteLine?: (id: string) => Promise<void>;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<LineEntryForm>(BLANK_ENTRY);
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<LineEntryForm>(BLANK_ENTRY);

  const totals = recordTotals(lines as CommercialLineItem[]);

  function startEdit(i: number) {
    const l = lines[i];
    setEditingIdx(i);
    setEditForm({
      description: l.description,
      lineType: l.lineType || 'Labour',
      unit: l.unit,
      quantity: String(l.quantity),
      internalRate: String(l.internalRate),
      markupPct: l.markupPct != null ? String(l.markupPct) : '',
      clientRate: String(l.clientRate),
    });
  }

  function commitEdit(i: number) {
    const c = calcEntryTotals(editForm);
    const next = [...lines];
    next[i] = {
      ...next[i],
      description: editForm.description.trim(),
      clientDescription: editForm.description.trim(),
      lineType: editForm.lineType,
      unit: editForm.unit,
      quantity: c.qty,
      internalRate: c.cost,
      markupPct: editForm.markupPct !== '' ? c.mkup : null,
      clientRate: c.sales,
    };
    onChange(next);
    onPersistLine?.(next[i], i);
    setEditingIdx(null);
  }

  function saveNew() {
    if (!newForm.description.trim()) return;
    const c = calcEntryTotals(newForm);
    const newLine: DraftLineItem = {
      id: genLineId(),
      sortOrder: lines.length,
      description: newForm.description.trim(),
      clientDescription: newForm.description.trim(),
      lineType: newForm.lineType,
      unit: newForm.unit,
      quantity: c.qty,
      internalRate: c.cost,
      markupPct: newForm.markupPct !== '' ? c.mkup : null,
      clientRate: c.sales,
    };
    onChange([...lines, newLine]);
    onPersistLine?.(newLine, lines.length);
    setNewForm(BLANK_ENTRY);
    setAddingNew(false);
  }

  function removeLine(i: number) {
    const removed = lines[i];
    onChange(lines.filter((_, idx) => idx !== i));
    if (removed.id) onDeleteLine?.(removed.id);
    if (editingIdx === i) setEditingIdx(null);
  }

  const colCount = canViewPricing ? 10 : 8;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-[#1e2d4a]">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-[#0d1628]">
            <tr>
              <th className={`${liThCls} w-8`}>No.</th>
              <th className={liThCls}>Description</th>
              <th className={liThCls}>Type</th>
              <th className={liThCls}>Unit</th>
              <th className={`${liThCls} text-right`}>Qty</th>
              {canViewPricing && <th className={`${liThCls} text-right`}>Cost Price</th>}
              {canViewPricing && <th className={`${liThCls} text-right`}>Markup %</th>}
              <th className={`${liThCls} text-right`}>Sales Price</th>
              <th className={`${liThCls} text-right`}>Total</th>
              <th className={`${liThCls} w-16`}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              editingIdx === i ? (
                <LineEntryRow
                  key={i}
                  form={editForm}
                  onChange={setEditForm}
                  onSave={() => commitEdit(i)}
                  onCancel={() => setEditingIdx(null)}
                  canViewPricing={canViewPricing}
                />
              ) : (
                <tr key={i} className="border-t border-[#1e2d4a]/50 hover:bg-[#1a2236]/40 transition-colors group">
                  <td className={`${liCellCls} text-slate-600 font-mono`}>{i + 1}</td>
                  <td className={`${liCellCls} text-slate-200`}>{l.description || <span className="text-slate-600 italic">—</span>}</td>
                  <td className={liCellCls}>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1e2d4a] text-slate-400 font-medium">
                      <HardHat size={10} />{l.lineType || 'Labour'}
                    </span>
                  </td>
                  <td className={`${liCellCls} text-slate-500`}>{l.unit || '—'}</td>
                  <td className={`${liCellCls} text-right tabular-nums text-slate-300`}>{l.quantity}</td>
                  {canViewPricing && (
                    <>
                      <td className={`${liCellCls} text-right tabular-nums text-slate-400`}>{fmtCurrency(l.internalRate)}</td>
                      <td className={`${liCellCls} text-right tabular-nums text-slate-400`}>{l.markupPct != null ? `${l.markupPct}%` : '—'}</td>
                    </>
                  )}
                  <td className={`${liCellCls} text-right tabular-nums text-slate-300`}>{fmtCurrency(l.clientRate)}</td>
                  <td className={`${liCellCls} text-right tabular-nums font-semibold text-white`}>{fmtCurrency(lineTotal(l as CommercialLineItem, 'client'))}</td>
                  <td className={liCellCls}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(i)} className="p-1 rounded text-slate-500 hover:text-[#f97316] hover:bg-[#1e2d4a] transition-colors" title="Edit">
                        <Save size={12} />
                      </button>
                      <button onClick={() => removeLine(i)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-[#1e2d4a] transition-colors" title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            ))}
            {addingNew && (
              <LineEntryRow
                form={newForm}
                onChange={setNewForm}
                onSave={saveNew}
                onCancel={() => { setAddingNew(false); setNewForm(BLANK_ENTRY); }}
                canViewPricing={canViewPricing}
              />
            )}
            {lines.length === 0 && !addingNew && (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-xs text-slate-600">
                  No cost lines yet — click Add Line to build up the cost.
                </td>
              </tr>
            )}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="border-t border-[#1e2d4a] bg-[#0d1628]">
                <td colSpan={canViewPricing ? 8 : 6} className="px-2 py-2.5 text-xs font-semibold text-slate-400 text-right">Totals</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-sm font-bold text-[#f97316]">{fmtCurrency(totals.totalClient)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!addingNew && editingIdx === null && (
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[#1e2d4a] hover:border-[#f97316]/50 text-slate-500 hover:text-[#f97316] text-xs font-medium transition-colors"
        >
          <Plus size={12} /> Add Line
        </button>
      )}

      {lines.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0d1628] border border-[#1e2d4a]">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calculator size={12} />
            <span>{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {canViewPricing && (
              <span className="text-slate-500">Cost: <span className="font-mono text-slate-400">{fmtCurrency(totals.totalInternal)}</span></span>
            )}
            <span className="text-slate-500">Sales: <span className="font-mono font-semibold text-white">{fmtCurrency(totals.totalClient)}</span></span>
            {canViewPricing && (
              <span className={`font-semibold ${totals.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Margin: <span className="font-mono">{fmtCurrency(totals.margin)} ({totals.marginPct.toFixed(1)}%)</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Record Comments Section ──────────────────────────────────────────────────

function RecordCommentsSection({
  comments, recordId, currentUser, canAdd, onAdd, onRemove,
}: {
  comments: DBCommercialRecordComment[];
  recordId: string;
  currentUser: { id?: string; name?: string; auth_user_id?: string } | null;
  canAdd: boolean;
  onAdd: (c: DBCommercialRecordComment) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!body.trim() || !recordId) return;
    setSubmitting(true);
    const c: DBCommercialRecordComment = {
      id: `crc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      record_id: recordId,
      body: body.trim(),
      author_name: currentUser?.name ?? 'Unknown',
      author_id: currentUser?.auth_user_id ?? currentUser?.id ?? '',
      created_at: new Date().toISOString(),
    };
    await onAdd(c);
    setBody('');
    setSubmitting(false);
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 && (
        <div className="text-center py-10">
          <MessageSquare size={24} className="text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No comments yet</p>
        </div>
      )}
      <div className="space-y-3">
        {comments.map(c => (
          <div key={c.id} className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[#1e2d4a] flex items-center justify-center text-xs font-bold text-[#f97316] shrink-0">
              {(c.author_name || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-white">{c.author_name}</span>
                <span className="text-[10px] text-slate-600">{c.created_at ? new Date(c.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
              <div className="text-sm text-slate-300 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 whitespace-pre-wrap">{c.body}</div>
            </div>
            {currentUser && (c.author_id === currentUser.auth_user_id || c.author_id === currentUser.id) && (
              <button onClick={() => onRemove(c.id)} className="p-1 text-slate-600 hover:text-red-400 transition-colors self-start mt-6"><Trash2 size={12} /></button>
            )}
          </div>
        ))}
      </div>
      {canAdd && (
        <div className="flex gap-2 pt-2 border-t border-[#1e2d4a]">
          <textarea
            className="flex-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#f97316] resize-none"
            rows={2}
            placeholder="Add a comment..."
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); }}
          />
          <button
            onClick={submit}
            disabled={!body.trim() || submitting}
            className="self-end px-3 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Record Detail Modal ───────────────────────────────────────────────────────

type ModalTab = 'overview' | 'type_fields' | 'cost' | 'comments' | 'attachments';

interface DetailModalProps {
  record: CommercialRecord | null;
  isNew: boolean;
  orgId: string;
  projects: { id: string; name: string; client: string }[];
  allRecords: CommercialRecord[];
  canViewPricing: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (r: CommercialRecord) => void;
  onDeleted: (id: string) => void;
  onConverted: (ewn: CommercialRecord, dn: CommercialRecord) => void;
  onOpenRecord: (r: CommercialRecord) => void;
}

const COMMERCIAL_FIELDS: FieldSpec[] = [
  { label: 'Status',         key: 'status' },
  { label: 'Reference',      key: 'reference' },
  { label: 'Title',          key: 'title' },
  { label: 'Client',         key: 'client' },
  { label: 'Date Raised',    key: 'dateRaised' },
  { label: 'Date Submitted', key: 'dateSubmitted' },
  { label: 'Date Agreed',    key: 'dateAgreed' },
  { label: 'Notes',          key: 'notes', isNarrative: true },
];

function DetailModal({ record, isNew, orgId, projects, allRecords, canViewPricing, canEdit, canCreate, canDelete, onClose, onSaved, onDeleted, onConverted, onOpenRecord }: DetailModalProps) {
  const store = useAppStore();
  const [tab, setTab] = useState<ModalTab>('overview');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [converting, setConverting] = useState(false);

  // Stable ID: generated once at mount for new records, or taken from existing record
  const [stableId] = useState<string>(() =>
    isNew
      ? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); })
      : (record?.id ?? '')
  );

  // Pending comments for new records (flushed to DB at save time)
  const [pendingComments, setPendingComments] = useState<DBCommercialRecordComment[]>([]);

  const [form, setForm] = useState({
    recordType:    (record?.recordType ?? 'early_warning_notice') as CommercialRecordType,
    reference:     record?.reference ?? '',
    title:         record?.title ?? '',
    projectId:     record?.projectId ?? '',
    client:        record?.client ?? '',
    status:        (record?.status ?? 'draft') as CommercialRecordStatus,
    dateRaised:    record?.dateRaised ?? new Date().toISOString().slice(0, 10),
    dateSubmitted: record?.dateSubmitted ?? '',
    dateAgreed:    record?.dateAgreed ?? '',
    notes:         record?.notes ?? '',
    documentRef:   (record?.extraData?.document_ref as string) ?? '',
    relatedRefs:   (record?.extraData?.related_refs as string) ?? '',
    ewnRef:           (record?.extraData?.ewn_ref as string) ?? '',
    causeOfDelay:     (record?.extraData?.cause_of_delay as string) ?? '',
    responsibleParty: (record?.extraData?.responsible_party as string) ?? '',
    delayStartDate:   (record?.extraData?.delay_start_date as string) ?? '',
    noticeIssuedDate: (record?.extraData?.notice_issued_date as string) ?? '',
    impactedWorks:    (record?.extraData?.impacted_works as string) ?? '',
    programmeDays:    (record?.extraData?.programme_days as string) ?? '',
    potentialCost:    (record?.extraData?.potential_cost as string) ?? '',
  });

  const [lineItems, setLineItems] = useState<DraftLineItem[]>([]);
  const [lineItemsLoaded, setLineItemsLoaded] = useState(false);

  // For new records, show pending files as a preview list; for existing records, show uploaded attachments
  const attachments = store.attachments.filter(a => a.linked_type === 'commercial' && a.linked_id === (record?.id ?? ''));

  // Comments: local pending state for new records, store state for existing
  const recordComments = isNew
    ? pendingComments
    : store.commercialRecordComments.filter(c => c.record_id === (record?.id ?? ''));

  function handleProjectChange(projectId: string) {
    const proj = projects.find(p => p.id === projectId);
    setForm(f => ({ ...f, projectId, client: proj ? proj.client : f.client }));
  }

  useEffect(() => {
    if (!record?.id || lineItemsLoaded) return;
    supabase.from('vy_commercial_line_items').select('*').eq('record_id', record.id).order('sort_order', { ascending: true }).then(({ data }) => {
      if (data) setLineItems((data as Record<string, unknown>[]).map(dbToLineItem));
      setLineItemsLoaded(true);
    });
  }, [record?.id, lineItemsLoaded]);

  // For new records, mark line items as "loaded" immediately so the save path works
  useEffect(() => {
    if (isNew && !lineItemsLoaded) setLineItemsLoaded(true);
  }, [isNew, lineItemsLoaded]);

  function buildLineRow(l: DraftLineItem, idx: number, id: string) {
    return {
      id: l.id ?? `li-${Date.now()}-${idx}`,
      org_id: orgId, record_id: id, sort_order: idx,
      description: l.description,
      client_description: l.description,
      line_type: l.lineType || 'Labour',
      unit: l.unit, quantity: l.quantity,
      internal_rate: l.internalRate, client_rate: l.clientRate,
      markup_pct: l.markupPct,
    };
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError(null);
    try {
      const extra: Record<string, unknown> = {};
      if (form.documentRef.trim()) extra.document_ref = form.documentRef.trim();
      if (form.relatedRefs.trim()) extra.related_refs = form.relatedRefs.trim();
      if (form.recordType === 'delay_notice') {
        if (form.ewnRef.trim()) extra.ewn_ref = form.ewnRef.trim();
        if (form.causeOfDelay.trim()) extra.cause_of_delay = form.causeOfDelay.trim();
        if (form.responsibleParty.trim()) extra.responsible_party = form.responsibleParty.trim();
        if (form.delayStartDate) extra.delay_start_date = form.delayStartDate;
        if (form.noticeIssuedDate) extra.notice_issued_date = form.noticeIssuedDate;
        if (form.impactedWorks.trim()) extra.impacted_works = form.impactedWorks.trim();
        if (form.programmeDays.trim()) extra.programme_days = form.programmeDays.trim();
        if (form.potentialCost.trim()) extra.potential_cost = form.potentialCost.trim();
      }
      const now = new Date().toISOString();
      const statusChanged = !record || record.status !== form.status;
      const row = {
        org_id: orgId, project_id: form.projectId || null,
        record_type: form.recordType, reference: form.reference.trim(),
        title: form.title.trim(), client: form.client.trim(),
        status: form.status, date_raised: form.dateRaised || null,
        date_submitted: form.dateSubmitted || null, date_agreed: form.dateAgreed || null,
        notes: form.notes.trim(), created_by: null,
        extra_data: extra,
        updated_at: now,
        ...(statusChanged ? { status_changed_at: now } : {}),
      };
      const projectName = projects.find(p => p.id === form.projectId)?.name;

      if (isNew) {
        const id = stableId;
        const { data, error: err } = await supabase.from('vy_commercial_records').insert({ ...row, id, created_at: now }).select('*').single();
        if (err) throw err;
        if (lineItems.length > 0) {
          await supabase.from('vy_commercial_line_items').insert(lineItems.map((l, idx) => buildLineRow(l, idx, id)));
        }
        // Flush pending comments
        for (const c of pendingComments) {
          await store.addCommercialRecordComment({ ...c, record_id: id });
        }
        // Flush pending file attachments
        for (const f of pendingFiles) {
          await store.addAttachment({
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            linked_type: 'commercial', linked_id: id,
            project_id: form.projectId || '', project_name: projectName ?? '',
            name: f.name, type: f.type, size: f.size,
            category: f.type.startsWith('image/') ? 'Photo' : f.type === 'application/pdf' ? 'Document' : 'Other',
            data_url: f.dataUrl ?? '', uploaded_by: store.currentUser?.name ?? '',
            created_at: now,
          });
        }
        const saved = dbToRecord(data as Record<string, unknown>, projectName);
        logActivity({
          orgId,
          userName: store.currentUser?.name ?? '',
          module: 'commercial', recordId: id,
          recordRef: form.reference.trim() || form.title.trim(),
          recordType: form.recordType, projectId: form.projectId || null, projectName: projectName ?? null,
          actionType: 'record_created',
          description: `${store.currentUser?.name ?? 'Unknown'} created ${form.recordType.replace(/_/g, ' ')} ${form.reference ? form.reference + ' — ' : ''}${form.title}`,
        });
        // Write lifecycle event
        await supabase.from('vy_commercial_events').insert({
          org_id: orgId, record_id: id, project_id: form.projectId || null,
          event_type: 'record_created', from_status: null, to_status: form.status,
          user_name: store.currentUser?.name ?? null, occurred_at: now,
        });
        if (form.dateSubmitted && form.status !== 'draft') {
          await supabase.from('vy_commercial_events').insert({
            org_id: orgId, record_id: id, project_id: form.projectId || null,
            event_type: 'submitted', from_status: null, to_status: form.status,
            user_name: store.currentUser?.name ?? null,
            occurred_at: new Date(form.dateSubmitted).toISOString(),
          });
        }
        onSaved(saved);
      } else {
        const { data, error: err } = await supabase.from('vy_commercial_records').update(row).eq('id', record!.id).select('*').single();
        if (err) throw err;
        if (lineItemsLoaded) {
          await supabase.from('vy_commercial_line_items').delete().eq('record_id', record!.id);
          if (lineItems.length > 0) {
            await supabase.from('vy_commercial_line_items').insert(lineItems.map((l, idx) => buildLineRow(l, idx, record!.id)));
          }
        }
        const saved = dbToRecord(data as Record<string, unknown>, projectName);
        const { changesText, fieldDiffs, prevValue, newValue, actionType } = buildDiff(
          {
            status:        record!.status,
            reference:     record!.reference,
            title:         record!.title,
            client:        record!.client ?? '',
            dateRaised:    record!.dateRaised ?? '',
            dateSubmitted: record!.dateSubmitted ?? '',
            dateAgreed:    record!.dateAgreed ?? '',
            notes:         record!.notes ?? '',
          },
          {
            status:        form.status,
            reference:     form.reference.trim(),
            title:         form.title.trim(),
            client:        form.client.trim(),
            dateRaised:    form.dateRaised,
            dateSubmitted: form.dateSubmitted,
            dateAgreed:    form.dateAgreed,
            notes:         form.notes.trim(),
          },
          COMMERCIAL_FIELDS,
        );
        const recLabel = `${form.recordType.replace(/_/g, ' ')} ${form.reference ? form.reference + ' — ' : ''}${form.title}`;
        const changePart = changesText ? ` Changes: ${changesText}.` : '';
        logActivity({
          orgId,
          userName: store.currentUser?.name ?? '',
          module: 'commercial', recordId: record!.id,
          recordRef: form.reference.trim() || form.title.trim(),
          recordType: form.recordType, projectId: form.projectId || null, projectName: projectName ?? null,
          actionType,
          description: `${store.currentUser?.name ?? 'Unknown'} updated ${recLabel}.${changePart}`,
          prevValue, newValue,
          metadata: fieldDiffs.length ? { diffs: fieldDiffs } : null,
        });
        // Write lifecycle events for meaningful status/submission changes
        if (record!.status !== form.status) {
          await supabase.from('vy_commercial_events').insert({
            org_id: orgId, record_id: record!.id, project_id: form.projectId || null,
            event_type: 'status_changed', from_status: record!.status, to_status: form.status,
            user_name: store.currentUser?.name ?? null, occurred_at: now,
          });
        }
        if (form.dateSubmitted && !record!.dateSubmitted) {
          await supabase.from('vy_commercial_events').insert({
            org_id: orgId, record_id: record!.id, project_id: form.projectId || null,
            event_type: 'submitted', from_status: record!.status, to_status: form.status,
            user_name: store.currentUser?.name ?? null,
            occurred_at: new Date(form.dateSubmitted).toISOString(),
          });
        }
        onSaved(saved);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleConvertToDelayNotice() {
    if (!record) return;
    setConverting(true);
    setError(null);

    // Helper: generate a proper RFC-4122 v4 UUID
    function genUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }

    let newId: string | null = null;
    const warnings: string[] = [];

    try {
      const now = new Date().toISOString();
      newId = genUUID();

      // ── Step 1: Generate next DN reference ──────────────────────────────────
      const existingDns = allRecords.filter(r => r.recordType === 'delay_notice');
      const maxDn = existingDns.reduce((max, r) => {
        const m = r.reference?.match(/^DN[-–]?(\d+)$/i);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      const nextDnRef = `DN-${String(maxDn + 1).padStart(3, '0')}`;

      // ── Step 2: Insert the Delay Notice record ───────────────────────────────
      const dnRow = {
        id: newId,
        org_id: orgId,
        project_id: record.projectId,
        record_type: 'delay_notice',
        reference: nextDnRef,
        title: record.title,
        client: record.client,
        status: 'draft',
        date_raised: record.dateRaised ?? null,
        date_submitted: null,
        date_agreed: null,
        notes: record.notes ?? '',
        created_by: null,            // uuid column — must be null or a real uuid
        extra_data: {
          ...(record.extraData?.document_ref ? { document_ref: record.extraData.document_ref } : {}),
          ...(record.extraData?.related_refs ? { related_refs: record.extraData.related_refs } : {}),
          ewn_ref: record.reference || '',
        },
        converted_from_id: record.id,
        created_at: now,
        updated_at: now,
      };

      const { data: dnData, error: dnErr } = await supabase
        .from('vy_commercial_records')
        .insert(dnRow)
        .select('*')
        .single();
      if (dnErr) {
        console.error('[Convert] DN insert failed:', dnErr);
        throw new Error(`Failed to create Delay Notice: ${dnErr.message}`);
      }

      // ── Step 3: Mark EWN as converted ───────────────────────────────────────
      const { data: ewnData, error: ewnErr } = await supabase
        .from('vy_commercial_records')
        .update({ converted_to_id: newId, updated_at: now })
        .eq('id', record.id)
        .select('*')
        .single();
      if (ewnErr) {
        console.error('[Convert] EWN update failed:', ewnErr);
        throw new Error(`Failed to link Early Warning Notice: ${ewnErr.message}`);
      }

      // ── Step 4: Copy line items ──────────────────────────────────────────────
      try {
        const { data: ewnLines, error: linesErr } = await supabase
          .from('vy_commercial_line_items')
          .select('*')
          .eq('record_id', record.id)
          .order('sort_order');
        if (linesErr) throw linesErr;
        if (ewnLines && ewnLines.length > 0) {
          const { error: lineInsertErr } = await supabase
            .from('vy_commercial_line_items')
            .insert(
              ewnLines.map((l: Record<string, unknown>, idx: number) => ({
                id: genUUID(),          // must be a uuid
                org_id: orgId,
                record_id: newId,
                sort_order: typeof l.sort_order === 'number' ? l.sort_order : idx,
                description: l.description ?? '',
                client_description: l.client_description ?? '',
                line_type: l.line_type ?? 'Labour',
                unit: l.unit ?? 'item',
                quantity: l.quantity ?? 0,
                internal_rate: l.internal_rate ?? 0,
                client_rate: l.client_rate ?? 0,
                markup_pct: l.markup_pct ?? null,
              }))
            );
          if (lineInsertErr) {
            console.warn('[Convert] Line items copy failed:', lineInsertErr);
            warnings.push(`Cost breakdown could not be copied: ${lineInsertErr.message}`);
          }
        }
      } catch (e) {
        console.warn('[Convert] Line items step failed:', e);
        warnings.push('Cost breakdown could not be copied.');
      }

      // ── Step 5: Copy attachments ─────────────────────────────────────────────
      try {
        const ewnAttachments = store.attachments.filter(
          a => a.linked_type === 'commercial' && a.linked_id === record.id
        );
        for (const att of ewnAttachments) {
          await store.addAttachment({
            id: genUUID(),
            linked_type: 'commercial',
            linked_id: newId!,
            project_id: att.project_id,
            project_name: att.project_name,
            name: att.name,
            type: att.type,
            size: att.size,
            category: att.category,
            data_url: att.data_url ?? '',
            uploaded_by: att.uploaded_by,
            created_at: now,
          });
        }
      } catch (e) {
        console.warn('[Convert] Attachments copy failed:', e);
        warnings.push('Attachments could not be copied.');
      }

      // ── Step 6: Copy comments ────────────────────────────────────────────────
      try {
        const ewnComments = store.commercialRecordComments.filter(
          c => c.record_id === record.id
        );
        for (const c of ewnComments) {
          await store.addCommercialRecordComment({
            id: genUUID(),
            org_id: orgId,
            record_id: newId!,
            body: c.body,
            author_name: c.author_name,
            author_id: c.author_id,
            created_at: now,
          });
        }
      } catch (e) {
        console.warn('[Convert] Comments copy failed:', e);
        warnings.push('Comments could not be copied.');
      }

      // ── Step 7: Log lifecycle events ─────────────────────────────────────────
      try {
        await supabase.from('vy_commercial_events').insert({
          org_id: orgId, record_id: newId, project_id: record.projectId || null,
          event_type: 'record_created', from_status: null, to_status: 'draft',
          user_name: store.currentUser?.name ?? null, occurred_at: now,
        });
      } catch (e) {
        console.warn('[Convert] Events insert failed:', e);
      }

      // ── Step 8: Activity log ─────────────────────────────────────────────────
      try {
        const projectName = projects.find(p => p.id === record.projectId)?.name;
        logActivity({
          orgId, userName: store.currentUser?.name ?? '',
          module: 'commercial', recordId: record.id,
          recordRef: record.reference || record.title,
          recordType: record.recordType, projectId: record.projectId || null, projectName: projectName ?? null,
          actionType: 'record_created',
          description: `${store.currentUser?.name ?? 'Unknown'} converted ${record.reference || record.title} (Early Warning Notice) to Delay Notice ${nextDnRef}.`,
        });
      } catch (e) {
        console.warn('[Convert] Activity log failed:', e);
      }

      // ── Done ─────────────────────────────────────────────────────────────────
      const projectName = projects.find(p => p.id === record.projectId)?.name;
      const updatedEwn = dbToRecord(ewnData as Record<string, unknown>, projectName);
      const newDn = dbToRecord(dnData as Record<string, unknown>, projectName);

      if (warnings.length > 0) {
        setError(`Delay Notice created, but: ${warnings.join(' ')}`);
      }

      onConverted(updatedEwn, newDn);
      setShowConvertConfirm(false);
    } catch (e) {
      console.error('[Convert] Fatal error:', e);
      setError(e instanceof Error ? e.message : 'Conversion failed — please try again.');
    } finally {
      setConverting(false);
    }
  }

  async function handleDelete() {
    if (!record) return;
    setDeleting(true);
    // Log BEFORE deletion so the entry is permanent even if deletion fails.
    await logActivity({
      orgId,
      userName: store.currentUser?.name ?? '',
      module: 'commercial', recordId: record.id,
      recordRef: record.reference || record.title,
      recordType: record.recordType, projectId: record.projectId ?? null, projectName: record.projectName ?? null,
      actionType: 'record_deleted',
      description: `${store.currentUser?.name ?? 'Unknown'} deleted ${record.recordType.replace(/_/g, ' ')} ${record.reference ? record.reference + ' — ' : ''}${record.title}`,
    });
    await supabase.from('vy_commercial_line_items').delete().eq('record_id', record.id);
    await supabase.from('vy_commercial_records').delete().eq('id', record.id);
    onDeleted(record.id);
    setDeleting(false);
  }

  async function handleExport(view: 'internal' | 'client') {
    if (!record) return;
    const attsWithData = await Promise.all(
      attachments.map(async a => a.data_url ? a : { ...a, data_url: await store.fetchAttachmentData(a.id) })
    );
    const exportRecord: CommercialRecord = {
      ...record,
      recordType: form.recordType,
      reference: form.reference,
      title: form.title,
      client: form.client,
      status: form.status,
      dateRaised: form.dateRaised || null,
      dateSubmitted: form.dateSubmitted || null,
      dateAgreed: form.dateAgreed || null,
      notes: form.notes,
      projectName: projects.find(p => p.id === form.projectId)?.name ?? record.projectName,
      extraData: record.extraData,
    };
    const html = buildExportHTML(
      exportRecord,
      lineItems as CommercialLineItem[],
      view,
      attsWithData,
      store.settings?.logo_data_url,
      store.settings?.company_name,
    );
    openPrintTab(html);
    logActivity({
      orgId,
      userName: store.currentUser?.name ?? '',
      module: 'commercial', recordId: record.id,
      recordRef: form.reference || form.title,
      recordType: form.recordType, projectId: form.projectId || null,
      projectName: projects.find(p => p.id === form.projectId)?.name ?? record.projectName ?? null,
      actionType: 'pdf_exported',
      description: `${store.currentUser?.name ?? 'Unknown'} exported ${view} PDF for ${form.reference ? form.reference + ' — ' : ''}${form.title}`,
      metadata: { view },
    });
  }

  const HAS_TYPE_FIELDS = form.recordType === 'delay_notice';

  const MODAL_TABS: { key: ModalTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview',    label: 'Details',    icon: <FileText size={13} /> },
    ...(HAS_TYPE_FIELDS ? [{ key: 'type_fields' as ModalTab, label: 'Notice Fields', icon: <AlertCircle size={13} /> }] : []),
    { key: 'cost',        label: `Cost Breakdown${lineItems.length ? ` (${lineItems.length})` : ''}`, icon: <TrendingUp size={13} /> },
    { key: 'comments',    label: `Comments${recordComments.length ? ` (${recordComments.length})` : ''}`, icon: <MessageSquare size={13} /> },
    { key: 'attachments', label: `Attachments${attachments.length ? ` (${attachments.length})` : ''}`, icon: <Paperclip size={13} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d4a] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {!isNew && <TypeBadge type={form.recordType} />}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">{isNew ? 'New Commercial Record' : (form.reference ? `${form.reference} — ${form.title}` : form.title) || 'Untitled'}</h2>
              {!isNew && <p className="text-xs text-slate-500">Commercial Record</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isNew && canViewPricing && (
              <>
                <button onClick={() => handleExport('internal')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1628] border border-[#1e2d4a] text-slate-300 hover:text-[#f97316] hover:border-[#f97316] rounded-lg text-xs transition-colors"><FileText size={12} />Internal</button>
                <button onClick={() => handleExport('client')}   className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1628] border border-[#1e2d4a] text-slate-300 hover:text-[#f97316] hover:border-[#f97316] rounded-lg text-xs transition-colors"><FileText size={12} />Client</button>
              </>
            )}
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-[#1e2d4a] rounded-lg transition-colors"><X size={16} /></button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-[#1e2d4a] px-6 shrink-0">
          {MODAL_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#f97316] text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* ── Linked record banners ─────────────────────────────────────── */}
              {!isNew && record?.convertedToId && (() => {
                const dn = allRecords.find(r => r.id === record.convertedToId);
                return (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-0.5">Converted To</p>
                      <p className="text-xs text-emerald-300 font-semibold">
                        Delay Notice{dn ? ` · ${dn.reference}` : ''}
                        {dn?.title ? ` — ${dn.title}` : ''}
                      </p>
                    </div>
                    {dn && (
                      <button onClick={() => { onClose(); onOpenRecord(dn); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors shrink-0"
                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                        Open <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                );
              })()}
              {!isNew && record?.convertedFromId && (() => {
                const ewn = allRecords.find(r => r.id === record.convertedFromId);
                return (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <GitMerge size={14} className="text-orange-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-0.5">Origin — Created From</p>
                      <p className="text-xs text-orange-300 font-semibold">
                        Early Warning Notice{ewn ? ` · ${ewn.reference}` : ''}
                        {ewn?.title ? ` — ${ewn.title}` : ''}
                      </p>
                    </div>
                    {ewn && (
                      <button onClick={() => { onClose(); onOpenRecord(ewn); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors shrink-0"
                        style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}>
                        Open <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                );
              })()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className={labelCls}>Record Type</label>
                <select className={selectCls} value={form.recordType} onChange={e => setForm(f => ({ ...f, recordType: e.target.value as CommercialRecordType }))} disabled={!canEdit}>
                  {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Reference Number</label>
                <input className={inputCls} value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder={`e.g. ${typeInfo(form.recordType).prefix}001`} disabled={!canEdit} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Title / Description <span className="text-red-400">*</span></label>
                <input className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief description of the commercial event" disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>Project</label>
                <select className={selectCls} value={form.projectId} onChange={e => handleProjectChange(e.target.value)} disabled={!canEdit}>
                  <option value="">— No project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Client</label>
                <input className={inputCls} value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="Client name" disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select className={selectCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as CommercialRecordStatus }))} disabled={!canEdit}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Date Raised</label>
                <input type="date" className={inputCls} value={form.dateRaised} onChange={e => setForm(f => ({ ...f, dateRaised: e.target.value }))} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>Date Submitted</label>
                <input type="date" className={inputCls} value={form.dateSubmitted} onChange={e => setForm(f => ({ ...f, dateSubmitted: e.target.value }))} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>Date Agreed / Closed</label>
                <input type="date" className={inputCls} value={form.dateAgreed} onChange={e => setForm(f => ({ ...f, dateAgreed: e.target.value }))} disabled={!canEdit} />
              </div>
              {!isNew && record?.statusChangedAt && (
                <div>
                  <label className={labelCls}>Status Changed</label>
                  <div className={`${inputCls} opacity-60 cursor-default`}>
                    {new Date(record.statusChangedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              )}
              <div className="md:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea className={`${inputCls} resize-none`} rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes, background, instructions..." disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>Document Reference</label>
                <input className={inputCls} value={form.documentRef} onChange={e => setForm(f => ({ ...f, documentRef: e.target.value }))} placeholder="e.g. EWN-001, drawing ref, letter ref" disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls}>Related Records / Cross-References</label>
                <input className={inputCls} value={form.relatedRefs} onChange={e => setForm(f => ({ ...f, relatedRefs: e.target.value }))} placeholder="e.g. EWN-003, V-012" disabled={!canEdit} />
              </div>
            </div>
            </div>
          )}

          {tab === 'type_fields' && form.recordType === 'delay_notice' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className={labelCls}>Related EWN Reference</label>
                  <input className={inputCls} value={form.ewnRef} onChange={e => setForm(f => ({ ...f, ewnRef: e.target.value }))} placeholder="e.g. EWN-002" disabled={!canEdit} />
                </div>
                <div>
                  <label className={labelCls}>Responsible Party</label>
                  <input className={inputCls} value={form.responsibleParty} onChange={e => setForm(f => ({ ...f, responsibleParty: e.target.value }))} placeholder="Contractor / Employer / Third Party" disabled={!canEdit} />
                </div>
                <div>
                  <label className={labelCls}>Date Delay First Occurred</label>
                  <input type="date" className={inputCls} value={form.delayStartDate} onChange={e => setForm(f => ({ ...f, delayStartDate: e.target.value }))} disabled={!canEdit} />
                </div>
                <div>
                  <label className={labelCls}>Date Notice Issued</label>
                  <input type="date" className={inputCls} value={form.noticeIssuedDate} onChange={e => setForm(f => ({ ...f, noticeIssuedDate: e.target.value }))} disabled={!canEdit} />
                </div>
                <div>
                  <label className={labelCls}>Potential Programme Impact (days)</label>
                  <input className={inputCls} type="text" inputMode="decimal" value={form.programmeDays} onChange={e => setForm(f => ({ ...f, programmeDays: e.target.value }))} placeholder="0" disabled={!canEdit} />
                </div>
                <div>
                  <label className={labelCls}>Potential Cost Impact (£)</label>
                  <input className={inputCls} type="text" inputMode="decimal" value={form.potentialCost} onChange={e => setForm(f => ({ ...f, potentialCost: e.target.value }))} placeholder="0.00" disabled={!canEdit} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Cause of Delay</label>
                  <textarea className={`${inputCls} resize-none`} rows={3} value={form.causeOfDelay} onChange={e => setForm(f => ({ ...f, causeOfDelay: e.target.value }))} placeholder="Describe the cause of the delaying event..." disabled={!canEdit} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Impacted Works</label>
                  <textarea className={`${inputCls} resize-none`} rows={3} value={form.impactedWorks} onChange={e => setForm(f => ({ ...f, impactedWorks: e.target.value }))} placeholder="Describe the works impacted by this delay..." disabled={!canEdit} />
                </div>
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <RecordCommentsSection
              comments={recordComments}
              recordId={stableId}
              currentUser={store.currentUser}
              canAdd={canEdit}
              onAdd={isNew
                ? async (c) => { setPendingComments(prev => [...prev, c]); }
                : async (c) => {
                    await store.addCommercialRecordComment(c);
                    logActivity({
                      orgId,
                      userName: store.currentUser?.name ?? '',
                      module: 'commercial', recordId: record!.id,
                      recordRef: form.reference || form.title,
                      recordType: form.recordType, projectId: form.projectId || null,
                      projectName: projects.find(p => p.id === form.projectId)?.name ?? record?.projectName ?? null,
                      actionType: 'comment_added',
                      description: `${store.currentUser?.name ?? 'Unknown'} added a comment to ${form.reference ? form.reference + ' — ' : ''}${form.title}`,
                    });
                  }}
              onRemove={isNew
                ? async (id) => { setPendingComments(prev => prev.filter(x => x.id !== id)); }
                : store.removeCommercialRecordComment}
            />
          )}

          {tab === 'cost' && (
            <div>
              {!canViewPricing && (
                <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-800/30 text-amber-300 text-sm">
                  <AlertCircle size={15} /><span>Internal rates and pricing are restricted to authorised commercial users.</span>
                </div>
              )}
              <LineItemEditor
                lines={lineItems}
                onChange={setLineItems}
                canViewPricing={canViewPricing}
                onPersistLine={!isNew ? async (line, sortOrder) => {
                  const rowId = line.id ?? `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                  await supabase.from('vy_commercial_line_items').upsert({
                    id: rowId,
                    org_id: orgId,
                    record_id: record!.id,
                    sort_order: sortOrder,
                    description: line.description,
                    client_description: line.description,
                    line_type: line.lineType || 'Labour',
                    unit: line.unit,
                    quantity: line.quantity,
                    internal_rate: line.internalRate,
                    client_rate: line.clientRate,
                    markup_pct: line.markupPct,
                  }, { onConflict: 'id' });
                } : undefined}
                onDeleteLine={!isNew ? async (id) => {
                  await supabase.from('vy_commercial_line_items').delete().eq('id', id);
                } : undefined}
              />
            </div>
          )}

          {tab === 'attachments' && (
            <div className="space-y-4">
              {isNew ? (
                <>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-sky-900/20 border border-sky-800/30 text-sky-300 text-xs">
                    <Paperclip size={13} /><span>Files will be attached when you click Create Record.</span>
                  </div>
                  <FileUploadComponent files={pendingFiles} onChange={setPendingFiles} label="Drop files, photos or documents here" maxFiles={20} />
                  {pendingFiles.length > 0 && (
                    <div className="space-y-1.5 mt-1">
                      {pendingFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d1628] border border-[#1e2d4a] text-xs text-slate-300">
                          <FileText size={12} className="text-slate-500 shrink-0" />
                          <span className="truncate flex-1">{f.name}</span>
                          <span className="text-slate-600 shrink-0">{f.size ? `${(f.size / 1024).toFixed(0)} KB` : ''}</span>
                          <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="p-0.5 text-slate-600 hover:text-red-400 shrink-0"><Trash2 size={11} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {pendingFiles.length === 0 && (
                    <div className="text-center py-6">
                      <Paperclip size={22} className="text-slate-700 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No files selected yet</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <FileUploadComponent files={pendingFiles} onChange={setPendingFiles} label="Drop files, photos or documents here" maxFiles={20} />
                  {pendingFiles.length > 0 && (
                    <button
                      onClick={async () => {
                        setUploading(true);
                        for (const f of pendingFiles) {
                          const att: DBAttachment = {
                            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            linked_type: 'commercial', linked_id: record!.id,
                            project_id: form.projectId || '', project_name: projects.find(p => p.id === form.projectId)?.name ?? '',
                            name: f.name, type: f.type, size: f.size,
                            category: f.type.startsWith('image/') ? 'Photo' : f.type === 'application/pdf' ? 'Document' : 'Other',
                            data_url: f.dataUrl ?? '', uploaded_by: store.currentUser?.name ?? '',
                            created_at: new Date().toISOString(),
                          };
                          await store.addAttachment(att);
                          logActivity({
                            orgId,
                            userName: store.currentUser?.name ?? '',
                            module: 'commercial', recordId: record!.id,
                            recordRef: form.reference || form.title,
                            recordType: form.recordType, projectId: form.projectId || null,
                            projectName: projects.find(p => p.id === form.projectId)?.name ?? record?.projectName ?? null,
                            actionType: 'attachment_uploaded',
                            description: `${store.currentUser?.name ?? 'Unknown'} uploaded attachment "${f.name}" to ${form.reference ? form.reference + ' — ' : ''}${form.title}`,
                            metadata: { fileName: f.name, fileType: f.type },
                          });
                        }
                        setPendingFiles([]);
                        setUploading(false);
                      }}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      {uploading ? 'Uploading…' : `Upload ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}`}
                    </button>
                  )}
                  {attachments.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {attachments.map(att => (
                        <AttachmentRow key={att.id} att={att} onRemove={() => store.removeAttachment(att.id)} fetchData={store.fetchAttachmentData} />
                      ))}
                    </div>
                  )}
                  {attachments.length === 0 && pendingFiles.length === 0 && (
                    <div className="text-center py-8">
                      <Paperclip size={24} className="text-slate-700 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No attachments yet</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2d4a] shrink-0">
          <div className="flex items-center gap-2">
            {!isNew && canDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete this record?</span>
                  <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 hover:bg-red-900/50 text-xs transition-colors">{deleting ? 'Deleting…' : 'Confirm Delete'}</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-400 hover:text-white">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1e2d4a] text-slate-500 hover:text-red-400 hover:border-red-800/50 text-xs transition-colors">
                  <Trash2 size={13} /> Delete
                </button>
              )
            )}
            {/* Convert to Delay Notice — only for EWN records that haven't been converted yet */}
            {!isNew && canCreate && record?.recordType === 'early_warning_notice' && (
              record.convertedToId ? (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-emerald-500"
                  style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <CheckCircle2 size={12} />
                  Converted to {allRecords.find(r => r.id === record.convertedToId)?.reference ?? 'DN'}
                </div>
              ) : (
                <button onClick={() => setShowConvertConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1e2d4a] text-slate-400 hover:text-[#f97316] hover:border-[#f97316]/40 text-xs transition-colors">
                  <GitMerge size={13} /> Convert to Delay Notice
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#1e2d4a] text-slate-400 hover:text-white text-sm transition-colors">{canEdit ? 'Cancel' : 'Close'}</button>
            {canEdit && (
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-900/30 disabled:opacity-60">
                <Save size={14} />{saving ? 'Saving…' : isNew ? 'Create Record' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Convert to Delay Notice confirmation dialog ──────────────────────── */}
      {showConvertConfirm && record && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>
            {/* Dialog header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e2d4a' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.12)' }}>
                  <GitMerge size={15} className="text-[#f97316]" />
                </div>
                <p className="text-sm font-bold text-white">Convert Early Warning Notice</p>
              </div>
              <button onClick={() => setShowConvertConfirm(false)} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"><X size={14} /></button>
            </div>

            {/* Dialog body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-300">A new <strong className="text-white">Delay Notice</strong> will be created.</p>
              <div className="space-y-1.5 text-xs text-slate-400"
                style={{ background: 'rgba(30,45,74,0.4)', border: '1px solid #1e2d4a', borderRadius: '10px', padding: '14px 16px' }}>
                <p className="font-semibold text-slate-300 mb-2">The following will be copied:</p>
                {[
                  'Project', 'Title', 'Description / Notes', 'Client', 'Date Raised',
                  'Cost Breakdown', 'Comments', 'Attachments', 'Related Records & Cross References', 'Document References',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <p className="text-orange-300 font-semibold mb-1">Please note</p>
                <p className="text-slate-400">The Early Warning Notice will remain <strong className="text-slate-300">unchanged</strong>. Delay-specific fields (delay period, programme impact, etc.) will be blank for you to complete.</p>
              </div>
            </div>

            {/* Dialog footer */}
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowConvertConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors"
                style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d4a' }}>
                Cancel
              </button>
              <button onClick={handleConvertToDelayNotice} disabled={converting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-colors"
                style={{ background: '#f97316' }}>
                <GitMerge size={12} />
                {converting ? 'Creating…' : 'Create Delay Notice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attachment row ────────────────────────────────────────────────────────────

function AttachmentRow({ att, onRemove, fetchData }: { att: DBAttachment; onRemove: () => void; fetchData: (id: string) => Promise<string> }) {
  const [previewing, setPreviewing] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(att.data_url || null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const isImage = att.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.name ?? '');

  async function openPreview() {
    if (!dataUrl) { setLoadingPreview(true); const url = await fetchData(att.id); setDataUrl(url); setLoadingPreview(false); }
    setPreviewing(true);
  }
  async function handleDownload() {
    let url = dataUrl;
    if (!url) { setLoadingPreview(true); url = await fetchData(att.id); setDataUrl(url); setLoadingPreview(false); }
    const a = document.createElement('a'); a.href = url!; a.download = att.name; a.click();
  }

  const size = att.size ? (att.size < 1024*1024 ? `${(att.size/1024).toFixed(0)} KB` : `${(att.size/(1024*1024)).toFixed(1)} MB`) : '';
  const typeLabel = att.type?.startsWith('image/') ? att.type.split('/')[1].toUpperCase() : att.name?.split('.').pop()?.toUpperCase() ?? 'File';
  const meta = [typeLabel, size].filter(Boolean).join(' · ');

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1628] border border-[#1e2d4a] group">
        {isImage ? (
          <button onClick={openPreview} className="w-14 h-10 rounded-lg overflow-hidden shrink-0 border border-[#1e2d4a] bg-[#1a2236] flex items-center justify-center hover:opacity-80 transition-opacity">
            {dataUrl ? <img src={dataUrl} alt={att.name} className="w-full h-full object-cover" /> : <Eye size={14} className={`text-slate-400 ${loadingPreview ? 'animate-pulse' : ''}`} />}
          </button>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-[#1a2236] flex items-center justify-center shrink-0"><FileText size={14} className="text-slate-400" /></div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">{att.name}</p>
          {meta && <p className="text-xs text-slate-500">{meta}</p>}
        </div>
        {!isImage && (
          <button onClick={handleDownload} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-900/30 border border-orange-700/40 text-orange-400 hover:bg-orange-900/50 text-xs font-medium transition-colors shrink-0">
            <Download size={12} /> Download
          </button>
        )}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={openPreview} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a]"><Eye size={14} /></button>
          <button onClick={onRemove} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-[#1e2d4a]"><Trash2 size={14} /></button>
        </div>
      </div>
      {previewing && dataUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={() => setPreviewing(false)}>
          {isImage ? (
            <img src={dataUrl} alt={att.name} className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
          ) : (
            <iframe src={dataUrl} title={att.name} className="w-[90vw] h-[90vh] rounded-xl bg-white" onClick={(e: React.MouseEvent) => e.stopPropagation()} />
          )}
          <button onClick={() => setPreviewing(false)} className="absolute top-4 right-4 p-2 bg-black/60 rounded-full text-white hover:bg-black/80"><X size={20} /></button>
        </div>
      )}
    </>
  );
}

// ─── Tab definition ────────────────────────────────────────────────────────────

const TABS: { key: CommercialTab; label: string; icon: React.ReactNode; comingSoon?: boolean }[] = [
  { key: 'overview',          label: 'Overview',            icon: <TrendingUp size={13} /> },
  { key: 'register',          label: 'Register',            icon: <FileText size={13} /> },
  { key: 'variation-account', label: 'Variation Account',   icon: <GitBranch size={13} /> },
  { key: 'applications',      label: 'Applications',        icon: <div className="text-current"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div> },
  { key: 'timeline',          label: 'Commercial Timeline', icon: <Clock size={13} /> },
  { key: 'valuations',        label: 'Valuations',          icon: <Calculator size={13} /> },
];

// ─── Main Commercial page ──────────────────────────────────────────────────────

export default function Commercial() {
  const { currentOrgId } = useAuth();
  const perms = usePermissions();
  const store = useAppStore();

  const orgId      = currentOrgId ?? '';
  const canEdit    = perms['commercial.edit']    ?? false;
  const canCreate  = perms['commercial.create']  ?? false;
  const canDelete  = perms['commercial.delete']  ?? false;
  const canViewPricing = perms['commercial.view_pricing'] ?? false;

  const [activeTab, setActiveTab]   = useState<CommercialTab>('overview');
  const [records, setRecords]       = useState<CommercialRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<CommercialRecord | null>(null);
  const [isNewRecord, setIsNewRecord]       = useState(false);
  const [modalOpen, setModalOpen]           = useState(false);
  const [commercialEvents, setCommercialEvents] = useState<CommercialEvent[]>([]);

  const projects = useMemo(() => store.projects, [store.projects]);

  // Banner project — synced to register filter when user switches projects on Overview
  const [bannerProjectId, setBannerProjectId] = useState<string>('');
  const effectiveBannerProjectId = bannerProjectId || projects[0]?.id || '';
  const bannerProject = projects.find(p => p.id === effectiveBannerProjectId) ?? null;

  const projectsForModal = useMemo(() =>
    projects.map(p => ({ id: p.id, name: p.name, client: p.client })),
    [projects]
  );

  const totalContractValue = projects.reduce((sum, p) => {
    const raw = typeof p.value === 'string' ? parseFloat(p.value.replace(/[£,\s]/g, '')) : (p.value as number ?? 0);
    return sum + (isNaN(raw) ? 0 : raw);
  }, 0);

  const loadRecords = useCallback(async () => {
    if (!orgId) return;
    setLoadingRecords(true);
    const { data } = await supabase.from('vy_commercial_records').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
    if (data) {
      const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
      setRecords((data as Record<string, unknown>[]).map(r => dbToRecord(r, r.project_id ? projectMap[r.project_id as string] : undefined)));
    }
    setLoadingRecords(false);
  }, [orgId, projects]);

  const loadEvents = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from('vy_commercial_events').select('*').eq('org_id', orgId).order('occurred_at', { ascending: true });
    if (data) setCommercialEvents((data as Record<string, unknown>[]).map(dbToEvent));
  }, [orgId]);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Load detail data excluded from startup (VA build-up lines, VA comments, record
  // comments). These are only needed in the Commercial module, so defer until here.
  useEffect(() => {
    store.loadVADetailData();
    store.loadCommercialRecordComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() { setSelectedRecord(null); setIsNewRecord(true); setModalOpen(true); }
  function openRecord(r: CommercialRecord) { setSelectedRecord(r); setIsNewRecord(false); setModalOpen(true); }

  async function handleQuickStatus(r: CommercialRecord, newStatus: CommercialRecordStatus) {
    if (r.status === newStatus) return;
    const now = new Date().toISOString();
    const { data, error: err } = await supabase
      .from('vy_commercial_records')
      .update({ status: newStatus, status_changed_at: now, updated_at: now })
      .eq('id', r.id)
      .select('*')
      .single();
    if (err) return;
    const projectName = projects.find(p => p.id === r.projectId)?.name;
    const saved = dbToRecord(data as Record<string, unknown>, projectName);
    setRecords(prev => prev.map(x => x.id === saved.id ? saved : x));
    // Write lifecycle event
    await supabase.from('vy_commercial_events').insert({
      org_id: orgId, record_id: r.id, project_id: r.projectId || null,
      event_type: 'status_changed', from_status: r.status, to_status: newStatus,
      user_name: store.currentUser?.name ?? null, occurred_at: now,
    });
    logActivity({
      orgId,
      userName: store.currentUser?.name ?? '',
      module: 'commercial', recordId: r.id,
      recordRef: r.reference || r.title,
      recordType: r.recordType, projectId: r.projectId || null, projectName: r.projectName ?? null,
      actionType: 'status_changed',
      description: `${store.currentUser?.name ?? 'Unknown'} changed ${r.reference || r.title} status from "${r.status}" to "${newStatus}".`,
      prevValue: r.status, newValue: newStatus,
    });
    loadEvents();
  }

  async function handleExportFull(selectedRecords: CommercialRecord[]) {
    if (!selectedRecords.length) return;

    // Open a blank tab synchronously (before any await) to preserve the user gesture.
    // Chrome blocks window.open() that runs after an await. We populate the tab
    // with document.write() after building the HTML — reliable for same-origin blanks.
    const tab = window.open('', '_blank');

    const ids = selectedRecords.map(r => r.id);

    const [lineItemsRes, attachmentsRes] = await Promise.all([
      supabase.from('vy_commercial_line_items').select('*').in('record_id', ids).order('sort_order'),
      supabase.from('vy_attachments').select('*').in('linked_id', ids),
    ]);

    const allLines: Record<string, CommercialLineItem[]> = {};
    for (const row of (lineItemsRes.data ?? [])) {
      const li = dbToLineItem(row as Record<string, unknown>);
      if (!allLines[li.recordId]) allLines[li.recordId] = [];
      allLines[li.recordId].push(li);
    }

    const rawAtts = (attachmentsRes.data ?? []) as DBAttachment[];
    const attsWithData = await Promise.all(
      rawAtts.map(async a => a.data_url ? a : { ...a, data_url: await store.fetchAttachmentData(a.id) })
    );
    const allAtts: Record<string, DBAttachment[]> = {};
    for (const a of attsWithData) {
      const rid = (a as DBAttachment & { record_id?: string }).record_id;
      if (!rid) continue;
      if (!allAtts[rid]) allAtts[rid] = [];
      allAtts[rid].push(a);
    }

    const logoUrl = store.settings?.logo_data_url;
    const companyName = store.settings?.company_name;

    const pages = selectedRecords.map((r, i) =>
      buildClientCopyPageContent({
        record: r,
        lines: allLines[r.id] ?? [],
        view: 'client',
        attachments: allAtts[r.id] ?? [],
        logoUrl,
        companyName,
        pageBreakBefore: i > 0,
      })
    ).join('');

    const name = bannerProject?.name ?? 'Export';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(name)} — Commercial Records</title><style>${CLIENT_COPY_CSS}</style><script>window.onload=function(){window.print();};<\/script></head><body>${pages}</body></html>`;

    if (tab) {
      tab.document.write(html);
      tab.document.close();
    } else {
      // Popup was blocked — fall back to blob URL approach
      openPrintTab(html);
    }

    logActivity({
      orgId,
      userName: store.currentUser?.name ?? '',
      module: 'commercial',
      actionType: 'pdf_exported',
      description: `${store.currentUser?.name ?? 'Unknown'} exported ${selectedRecords.length} commercial record${selectedRecords.length !== 1 ? 's' : ''} (Export Full)`,
      metadata: { count: selectedRecords.length, recordRefs: selectedRecords.map(r => r.reference || r.title) },
    });
  }

  function handleSaved(r: CommercialRecord) {
    setRecords(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = r; return next; }
      return [r, ...prev];
    });
    loadEvents();
    setModalOpen(false);
  }

  function handleConverted(updatedEwn: CommercialRecord, newDn: CommercialRecord) {
    setRecords(prev => {
      const withUpdatedEwn = prev.map(r => r.id === updatedEwn.id ? updatedEwn : r);
      return [newDn, ...withUpdatedEwn];
    });
    loadEvents();
    // Changing selectedRecord.id causes the keyed DetailModal to unmount+remount,
    // so the new DN's form state initialises fresh from newDn (not from the EWN).
    setSelectedRecord(newDn);
    setIsNewRecord(false);
    setModalOpen(true);
  }

  function handleDeleted(id: string) {
    setRecords(prev => prev.filter(r => r.id !== id));
    setModalOpen(false);
  }

  const projectKeyDates = store.keyDates.filter(d => d.project_id === effectiveBannerProjectId);

  // Variation Account metrics for the active project
  const projectVAItems = store.variationAccountItems.filter(v => v.project_id === effectiveBannerProjectId);
  const vaMetrics = calcVAMetrics(projectVAItems);
  const vaHasItems = projectVAItems.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center">
            <TrendingUp size={18} className="text-[#f97316]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Commercial</h1>
            <p className="text-[11px] text-slate-500">Contract Management &amp; Commercial Control</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalContractValue > 0 && (
            <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-2 text-right">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider leading-none mb-0.5">Total Portfolio Value</p>
              <p className="text-sm font-bold text-[#f97316] leading-none tabular-nums">
                {'£' + totalContractValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          )}
          {bannerProject && (
            <button
              onClick={() => {
                const contractNum = bannerProject.value ? parseRawValue(bannerProject.value) : 0;
                const variationExposure = vaHasItems ? vaMetrics.exposure : (bannerProject.variationsValue ?? 0);
                const agreedVariations = vaHasItems ? vaMetrics.agreed : 0;
                const forecastContractSum = contractNum + variationExposure;
                const adjustedContractSum = contractNum + agreedVariations;
                const completedNum = bannerProject.committed ?? null;
                const projectApps = (store.commercialApplications ?? []).filter(a => a.project_id === bannerProject.id);
                const buildEventsForPDF = () => {
                  const evts: {id:string;sortDate:string;displayDate:string;kind:string;source:string;reference:string;title:string;statusLabel?:string;fromStatusLabel?:string;value?:number;isPositive?:boolean;createdBy?:string|null}[] = [];
                  const fmtD = (d?: string|null) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); } catch { return '—'; } };
                  const fmtDT = (d?: string|null) => { if (!d) return '—'; try { return new Date(d).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); } catch { return '—'; } };
                  for (const item of projectVAItems) {
                    const rd = item.date_raised || item.created_at || '';
                    if (rd) evts.push({ id:`va-r-${item.id}`, sortDate:rd, displayDate:fmtD(rd), kind:'va-raised', source:'Variation Account', reference:item.reference, title:item.title, statusLabel:item.status, value:item.value, isPositive:item.is_positive, createdBy:item.created_by });
                    if (item.date_agreed && (item.status==='agreed'||item.status==='paid')) evts.push({ id:`va-a-${item.id}`, sortDate:item.date_agreed, displayDate:fmtD(item.date_agreed), kind:'va-agreed', source:'Variation Account', reference:item.reference, title:item.title, statusLabel:item.status, value:item.value, isPositive:item.is_positive, createdBy:item.created_by });
                  }
                  const recMap = Object.fromEntries(records.filter(r => r.projectId === bannerProject.id).map(r => [r.id, r]));
                  for (const evt of commercialEvents.filter(e => e.projectId === bannerProject.id)) {
                    const rec = recMap[evt.recordId]; if (!rec) continue;
                    const ti = typeInfo(rec.recordType);
                    const toSi = statusInfo(evt.toStatus as Parameters<typeof statusInfo>[0]);
                    const fromSi = evt.fromStatus ? statusInfo(evt.fromStatus as Parameters<typeof statusInfo>[0]) : null;
                    if (evt.eventType === 'record_created') evts.push({ id:`cr-a-${evt.id}`, sortDate:evt.occurredAt, displayDate:fmtD(evt.occurredAt), kind:'cr-added', source:'Commercial Register', reference:rec.reference||ti.prefix, title:`${rec.title} — ${ti.label}`, statusLabel:toSi.label, createdBy:evt.userName });
                    else if (evt.eventType === 'submitted') evts.push({ id:`cr-s-${evt.id}`, sortDate:evt.occurredAt, displayDate:fmtD(evt.occurredAt), kind:'cr-submitted', source:'Commercial Register', reference:rec.reference, title:rec.title, createdBy:evt.userName });
                    else if (evt.eventType === 'status_changed') evts.push({ id:`cr-sc-${evt.id}`, sortDate:evt.occurredAt, displayDate:fmtDT(evt.occurredAt), kind:'cr-status-changed', source:'Commercial Register', reference:rec.reference, title:rec.title, statusLabel:toSi.label, fromStatusLabel:fromSi?.label, createdBy:evt.userName });
                  }
                  return evts.sort((a,b) => b.sortDate.localeCompare(a.sortDate));
                };
                exportFullCommercialReport({
                  project: bannerProject,
                  keyDates: projectKeyDates,
                  records: records.filter(r => r.projectId === bannerProject.id),
                  vaItems: projectVAItems,
                  apps: projectApps,
                  events: buildEventsForPDF(),
                  contractNum,
                  completedNum,
                  variationExposure,
                  agreedVariations,
                  forecastContractSum,
                  adjustedContractSum,
                  vaExposure: vaMetrics.exposure,
                  vaAgreed: vaMetrics.agreed,
                  currentUserName: store.currentUser?.name ?? '',
                  logoUrl: store.settings?.logo_data_url,
                });
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-slate-600 transition-colors"
              title="Export Full Commercial Report PDF"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Full Report
            </button>
          )}
          {canCreate && activeTab !== 'overview' && (
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f97316] hover:bg-orange-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-900/30">
              <Plus size={15} /> New Record
            </button>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-[#1e2d4a] mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors shrink-0 ${
              activeTab === t.key
                ? 'border-[#f97316] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            {t.icon}
            {t.label}
            {t.comingSoon && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-semibold rounded bg-slate-700/60 text-slate-400 border border-slate-600/40">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <CommercialOverview
          project={bannerProject}
          projects={projects}
          records={records}
          keyDates={projectKeyDates}
          canEdit={canEdit}
          canCreate={canCreate}
          currentUserName={store.currentUser?.name ?? ''}
          vaExposure={vaMetrics.exposure}
          vaAgreed={vaMetrics.agreed}
          vaHasItems={vaHasItems}
          onProjectChange={(id) => setBannerProjectId(id)}
          onAddKeyDate={store.addKeyDate}
          onUpdateKeyDate={store.updateKeyDate}
          onRemoveKeyDate={store.removeKeyDate}
          onUpdateProject={store.updateProject}
          onNewRecord={openNew}
        />
      )}

      {activeTab === 'register' && (
        <CommercialRegister
          key={effectiveBannerProjectId}
          records={records.filter(r => r.projectId === effectiveBannerProjectId)}
          loading={loadingRecords}
          canCreate={canCreate}
          canEdit={canEdit}
          currentProject={bannerProject}
          keyDates={projectKeyDates}
          currentUserName={store.currentUser?.name ?? ''}
          onNewRecord={openNew}
          onOpenRecord={openRecord}
          onUpdateStatus={handleQuickStatus}
          onExportFull={handleExportFull}
          settings={store.settings}
        />
      )}

      {activeTab === 'variation-account' && (
        <VariationAccount
          project={bannerProject}
          projects={projects}
          orgId={orgId}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
          currentUserName={store.currentUser?.name ?? ''}
          onProjectChange={(id) => setBannerProjectId(id)}
        />
      )}
      {activeTab === 'applications' && (() => {
        const contractNum = bannerProject?.value ? parseRawValue(bannerProject.value) : 0;
        const variationExposure = vaHasItems ? vaMetrics.exposure : (bannerProject?.variationsValue ?? 0);
        const forecastContractSum = contractNum + variationExposure;
        return (
          <CommercialApplications
            project={bannerProject}
            orgId={orgId}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
            forecastContractSum={forecastContractSum}
            currentUserName={store.currentUser?.name ?? ''}
            onProjectChange={(id) => setBannerProjectId(id)}
          />
        );
      })()}
      {activeTab === 'timeline'          && (
        <CommercialTimeline
          project={bannerProject}
          records={records}
          variationItems={projectVAItems}
          commercialEvents={commercialEvents}
          currentUserName={store.currentUser?.name ?? ''}
          logoUrl={store.settings?.logo_data_url}
        />
      )}
      {activeTab === 'valuations' && (
        <CommercialValuations
          project={bannerProject}
          projects={projects}
          orgId={orgId}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
          currentUserName={store.currentUser?.name ?? ''}
          onProjectChange={(id) => setBannerProjectId(id)}
        />
      )}

      {/* Record detail modal */}
      {modalOpen && (
        <DetailModal
          key={selectedRecord?.id ?? 'new'}
          record={selectedRecord}
          isNew={isNewRecord}
          orgId={orgId}
          projects={projectsForModal}
          allRecords={records}
          canViewPricing={canViewPricing}
          canEdit={isNewRecord ? canCreate : canEdit}
          canCreate={canCreate}
          canDelete={canDelete}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onConverted={handleConverted}
          onOpenRecord={r => { setSelectedRecord(r); setIsNewRecord(false); }}
        />
      )}
    </div>
  );
}
