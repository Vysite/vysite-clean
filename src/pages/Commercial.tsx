import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  TrendingUp, Plus, X, Save,
  Paperclip, Trash2, Eye, Download, FileText,
  Banknote,
  ChevronRight, AlertCircle, CheckCircle2, Clock, CircleDot,
  GitBranch, MessageSquare, Send,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import FileUploadComponent from '../components/FileUpload';
import type { UploadedFile } from '../components/FileUpload';
import type { CommercialRecord, CommercialLineItem, CommercialRecordType, CommercialRecordStatus } from '../data/types';
import type { DBAttachment, DBCommercialRecordComment } from '../lib/store';

import CommercialOverview from './commercial/CommercialOverview';
import CommercialRegister from './commercial/CommercialRegister';
import VariationAccount, { calcVAMetrics } from './commercial/VariationAccount';
import CommercialApplications from './commercial/CommercialApplications';
import CommercialTimeline from './commercial/CommercialTimeline';
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
    id:            r.id as string,
    orgId:         r.org_id as string,
    projectId:     r.project_id as string | null,
    projectName,
    recordType:    r.record_type as CommercialRecordType,
    reference:     r.reference as string,
    title:         r.title as string,
    client:        r.client as string,
    status:        r.status as CommercialRecordStatus,
    dateRaised:    r.date_raised as string | null,
    dateSubmitted: r.date_submitted as string | null,
    dateAgreed:    r.date_agreed as string | null,
    notes:         r.notes as string,
    createdBy:     r.created_by as string | null,
    createdAt:     r.created_at as string,
    updatedAt:     r.updated_at as string,
    extraData:     r.extra_data as Record<string, unknown> | null ?? null,
  };
}

function dbToLineItem(r: Record<string, unknown>): CommercialLineItem {
  return {
    id:                r.id as string,
    orgId:             r.org_id as string,
    recordId:          r.record_id as string,
    sortOrder:         r.sort_order as number,
    description:       r.description as string,
    clientDescription: r.client_description as string,
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

function buildExportHTML(
  record: CommercialRecord,
  lines: CommercialLineItem[],
  view: 'internal' | 'client',
  attachments: DBAttachment[],
  logoUrl?: string,
  companyName?: string,
): string {
  const t = typeInfo(record.recordType);
  const s = statusInfo(record.status);
  const totals = recordTotals(lines);
  const orgName = companyName || 'VYSITE';
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const docRef = record.reference || `COM-${record.id.slice(0, 8).toUpperCase()}`;
  const viewLabel = view === 'internal' ? 'Internal Copy \u2014 Confidential' : 'Client Copy';
  const fmtD = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014';

  const CSS = `
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
  `;

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
    const clientDesc = l.clientDescription || l.description || '\u2014';
    const internalDesc = l.description || l.clientDescription || '\u2014';
    const it = lineTotal(l, 'internal'), ct = lineTotal(l, 'client');
    if (view === 'internal') {
      return `<tr>
        <td class="num" style="color:#94a3b8;font-size:9px">${i+1}</td>
        <td>${esc(internalDesc)}</td><td>${esc(clientDesc)}</td>
        <td class="num">${l.quantity}</td><td>${esc(l.unit)}</td>
        <td class="num">\u00a3${fmt(l.internalRate)}</td><td class="num">\u00a3${fmt(it)}</td>
        <td class="num">\u00a3${fmt(l.clientRate)}</td><td class="num">\u00a3${fmt(ct)}</td>
        <td class="num">${l.markupPct != null ? l.markupPct.toFixed(1)+'%' : '\u2014'}</td>
        <td class="num">${lineMarginPct(l)}</td>
      </tr>`;
    }
    return `<tr>
      <td class="num" style="color:#94a3b8;font-size:9px">${i+1}</td>
      <td>${esc(clientDesc)}</td>
      <td class="num">${l.quantity}</td><td>${esc(l.unit)}</td>
      <td class="num">\u00a3${fmt(l.clientRate)}</td><td class="num">\u00a3${fmt(ct)}</td>
    </tr>`;
  }).join('');

  const internalThead = `<tr><th class="num">#</th><th>Internal Desc.</th><th>Client Desc.</th><th class="num">Qty</th><th>Unit</th><th class="num">Int. Rate</th><th class="num">Int. Total</th><th class="num">Client Rate</th><th class="num">Client Total</th><th class="num">Markup %</th><th class="num">Margin %</th></tr>`;
  const clientThead   = `<tr><th class="num">#</th><th>Description</th><th class="num">Qty</th><th>Unit</th><th class="num">Rate</th><th class="num">Total</th></tr>`;
  const emptyColspan  = view === 'internal' ? 11 : 6;
  const totalsHtml    = view === 'internal'
    ? `<table class="totals-block"><tr><td class="label">Total Internal Cost</td><td class="val">\u00a3${fmt(totals.totalInternal)}</td></tr><tr><td class="label">Total Client Value</td><td class="val">\u00a3${fmt(totals.totalClient)}</td></tr><tr><td class="label">Gross Margin</td><td class="val">\u00a3${fmt(totals.margin)} (${totals.marginPct.toFixed(1)}%)</td></tr></table>`
    : `<table class="totals-block"><tr><td class="label">Total Client Value</td><td class="val">\u00a3${fmt(totals.totalClient)}</td></tr></table>`;

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

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(record.reference || 'Record')} — ${esc(record.title || '')}</title><style>${CSS}</style></head>
    <body><div class="page">${header}${metaBlock}${refRow}${notesSection}${typeFieldsSection}${costSection}${evidenceSection}
    <div class="legal-footer">
      <div class="legal-footer-header"><span class="legal-footer-title">Legal &amp; Contractual Information</span><span class="legal-footer-ref">Ref: ${esc(docRef)}</span></div>
      ${noticeBar}
      <div class="legal-branding"><div class="legal-branding-left">VYSITE &bull; Construction Operating System &bull; Generated ${today}</div><div class="legal-branding-right">&copy; VYSITE. All rights reserved. Confidential.</div></div>
    </div>
    </div></body></html>`;
}

// ─── Line Item Editor ──────────────────────────────────────────────────────────

type DraftLineItem = Omit<CommercialLineItem, 'id' | 'orgId' | 'recordId'> & { id?: string };

function LineItemEditor({
  lines, onChange, canViewPricing,
}: { lines: DraftLineItem[]; onChange: (l: DraftLineItem[]) => void; canViewPricing: boolean }) {
  const numCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded px-2 py-1 text-xs text-right text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#f97316]/60 focus:border-[#f97316]/60 transition-colors';

  function addLine() {
    onChange([...lines, { sortOrder: lines.length, description: '', clientDescription: '', unit: 'item', quantity: 1, internalRate: 0, clientRate: 0, markupPct: null }]);
  }

  function removeLine(i: number) { onChange(lines.filter((_, idx) => idx !== i)); }

  function updateLine(i: number, patch: Partial<DraftLineItem>) {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    if (patch.internalRate !== undefined && canViewPricing) {
      const rate = patch.internalRate as number;
      const markup = next[i].markupPct ?? null;
      if (markup != null) next[i].clientRate = parseFloat((rate * (1 + markup / 100)).toFixed(2));
    }
    if (patch.markupPct !== undefined) {
      const markup = patch.markupPct as number | null;
      if (markup != null) next[i].clientRate = parseFloat((next[i].internalRate * (1 + markup / 100)).toFixed(2));
    }
    onChange(next);
  }

  const totals = recordTotals(lines as CommercialLineItem[]);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-[#1e2d4a]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e2d4a] bg-[#0d1628]">
              {canViewPricing && <th className="px-3 py-2 text-left text-slate-500 font-semibold">Internal Desc.</th>}
              <th className="px-3 py-2 text-left text-slate-500 font-semibold">Client Desc.</th>
              <th className="px-3 py-2 text-right text-slate-500 font-semibold w-16">Qty</th>
              <th className="px-3 py-2 text-left text-slate-500 font-semibold w-20">Unit</th>
              {canViewPricing && <th className="px-3 py-2 text-right text-slate-500 font-semibold w-24">Int. Rate</th>}
              {canViewPricing && <th className="px-3 py-2 text-right text-slate-500 font-semibold w-20">Markup %</th>}
              <th className="px-3 py-2 text-right text-slate-500 font-semibold w-24">Client Rate</th>
              <th className="px-3 py-2 text-right text-slate-500 font-semibold w-24">Total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-[#1e2d4a]/50 group hover:bg-[#0d1628]/40 transition-colors">
                {canViewPricing && (
                  <td className="py-1.5 pl-3 pr-2">
                    <input className={`${numCls} text-left`} value={l.description} onChange={e => updateLine(i, { description: e.target.value })} placeholder="Internal description" />
                  </td>
                )}
                <td className="py-1.5 px-2">
                  <input className={`${numCls} text-left`} value={l.clientDescription} onChange={e => updateLine(i, { clientDescription: e.target.value })} placeholder="Client description" />
                </td>
                <td className="py-1.5 px-2">
                  <input type="number" min="0" step="any" className={numCls} value={l.quantity} onChange={e => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })} />
                </td>
                <td className="py-1.5 px-2">
                  <select className={`${numCls} text-left`} value={l.unit} onChange={e => updateLine(i, { unit: e.target.value })}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </td>
                {canViewPricing && (
                  <>
                    <td className="py-1.5 px-2">
                      <input type="number" min="0" step="any" className={numCls} value={l.internalRate} onChange={e => updateLine(i, { internalRate: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input type="number" min="0" max="100" step="0.1" className={numCls} value={l.markupPct ?? ''} onChange={e => updateLine(i, { markupPct: e.target.value ? parseFloat(e.target.value) : null })} placeholder="—" />
                    </td>
                  </>
                )}
                <td className="py-1.5 pr-2">
                  <input type="number" min="0" step="any" className={numCls} value={l.clientRate} onChange={e => updateLine(i, { clientRate: parseFloat(e.target.value) || 0 })} />
                </td>
                <td className="py-1.5 pr-2 text-right text-slate-300 font-mono">
                  {fmtCurrency(lineTotal(l as CommercialLineItem, 'client'))}
                </td>
                <td className="py-1.5">
                  <button onClick={() => removeLine(i)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all rounded">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-start justify-between gap-4">
        <button onClick={addLine} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[#1e2d4a] text-slate-400 hover:text-white hover:border-[#f97316] text-xs transition-colors">
          <Plus size={13} /> Add Line
        </button>
        {lines.length > 0 && (
          <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg p-3 min-w-[240px] space-y-1.5 text-xs">
            {canViewPricing && (
              <div className="flex justify-between text-slate-400">
                <span>Total Internal Cost</span>
                <span className="font-mono text-slate-300">{fmtCurrency(totals.totalInternal)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-400">
              <span>Total Client Value</span>
              <span className="font-mono text-white font-semibold">{fmtCurrency(totals.totalClient)}</span>
            </div>
            {canViewPricing && (
              <div className={`flex justify-between border-t border-[#1e2d4a] pt-1.5 font-semibold ${totals.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                <span>Gross Margin</span>
                <span className="font-mono">{fmtCurrency(totals.margin)} ({totals.marginPct.toFixed(1)}%)</span>
              </div>
            )}
          </div>
        )}
      </div>
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
  canViewPricing: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (r: CommercialRecord) => void;
  onDeleted: (id: string) => void;
}

function DetailModal({ record, isNew, orgId, projects, canViewPricing, canEdit, canDelete, onClose, onSaved, onDeleted }: DetailModalProps) {
  const store = useAppStore();
  const [tab, setTab] = useState<ModalTab>('overview');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

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
    // Supporting evidence / doc reference (Priority 5)
    documentRef:   (record?.extraData?.document_ref as string) ?? '',
    relatedRefs:   (record?.extraData?.related_refs as string) ?? '',
    // Delay Notice specific fields (Priority 4)
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

  const attachments = store.attachments.filter(a => a.linked_type === 'commercial' && a.linked_id === (record?.id ?? ''));

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
      const row = {
        org_id: orgId, project_id: form.projectId || null,
        record_type: form.recordType, reference: form.reference.trim(),
        title: form.title.trim(), client: form.client.trim(),
        status: form.status, date_raised: form.dateRaised || null,
        date_submitted: form.dateSubmitted || null, date_agreed: form.dateAgreed || null,
        notes: form.notes.trim(), created_by: null,
        extra_data: extra,
        updated_at: now,
      };
      if (isNew) {
        const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        const { data, error: err } = await supabase.from('vy_commercial_records').insert({ ...row, id, created_at: now }).select('*').single();
        if (err) throw err;
        const projectName = projects.find(p => p.id === form.projectId)?.name;
        onSaved(dbToRecord(data as Record<string, unknown>, projectName));
      } else {
        const { data, error: err } = await supabase.from('vy_commercial_records').update(row).eq('id', record!.id).select('*').single();
        if (err) throw err;
        if (lineItemsLoaded && lineItems.length > 0) {
          await supabase.from('vy_commercial_line_items').delete().eq('record_id', record!.id);
          await supabase.from('vy_commercial_line_items').insert(
            lineItems.map((l, idx) => ({
              id: l.id ?? `li-${Date.now()}-${idx}`,
              org_id: orgId, record_id: record!.id, sort_order: idx,
              description: l.description, client_description: l.clientDescription,
              unit: l.unit, quantity: l.quantity,
              internal_rate: l.internalRate, client_rate: l.clientRate,
              markup_pct: l.markupPct,
            }))
          );
        }
        const projectName = projects.find(p => p.id === form.projectId)?.name;
        onSaved(dbToRecord(data as Record<string, unknown>, projectName));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!record) return;
    setDeleting(true);
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
  }

  const recordComments = store.commercialRecordComments.filter(c => c.record_id === (record?.id ?? ''));

  const HAS_TYPE_FIELDS = form.recordType === 'delay_notice';

  const MODAL_TABS: { key: ModalTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview',    label: 'Details',    icon: <FileText size={13} /> },
    ...(HAS_TYPE_FIELDS ? [{ key: 'type_fields' as ModalTab, label: 'Notice Fields', icon: <AlertCircle size={13} /> }] : []),
    { key: 'cost',        label: 'Cost Breakdown', icon: <TrendingUp size={13} /> },
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
              recordId={record?.id ?? ''}
              currentUser={store.currentUser}
              canAdd={!isNew && canEdit}
              onAdd={store.addCommercialRecordComment}
              onRemove={store.removeCommercialRecordComment}
            />
          )}

          {tab === 'cost' && (
            <div>
              {!canViewPricing && (
                <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-800/30 text-amber-300 text-sm">
                  <AlertCircle size={15} /><span>Internal rates and pricing are restricted to authorised commercial users.</span>
                </div>
              )}
              <LineItemEditor lines={lineItems} onChange={setLineItems} canViewPricing={canViewPricing} />
            </div>
          )}

          {tab === 'attachments' && (
            <div className="space-y-4">
              {isNew ? (
                <p className="text-sm text-slate-500 text-center py-8">Save the record first, then attach files.</p>
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
          <div>
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
  { key: 'applications',      label: 'Applications',        icon: <div className="text-current"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>, comingSoon: true },
  { key: 'timeline',          label: 'Commercial Timeline', icon: <Clock size={13} /> },
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

  useEffect(() => { loadRecords(); }, [loadRecords]);

  function openNew() { setSelectedRecord(null); setIsNewRecord(true); setModalOpen(true); }
  function openRecord(r: CommercialRecord) { setSelectedRecord(r); setIsNewRecord(false); setModalOpen(true); }

  function handleSaved(r: CommercialRecord) {
    setRecords(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = r; return next; }
      return [r, ...prev];
    });
    setModalOpen(false);
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
                  const evts: {id:string;sortDate:string;displayDate:string;kind:string;source:string;reference:string;title:string;statusLabel?:string;value?:number;isPositive?:boolean;createdBy?:string|null}[] = [];
                  const safeDate = (d?: string|null) => { if (!d) return ''; try { return new Date(d).toISOString().slice(0,10); } catch { return ''; } };
                  const fmtEvtDate = (d?: string|null) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-GB'); } catch { return '—'; } };
                  for (const item of projectVAItems) {
                    const rd = safeDate(item.date_raised || item.created_at);
                    if (rd) evts.push({ id:`va-r-${item.id}`, sortDate:rd, displayDate:fmtEvtDate(item.date_raised||item.created_at), kind:'va-raised', source:'Variation Account', reference:item.reference, title:item.title, statusLabel:item.status, value:item.value, isPositive:item.is_positive, createdBy:item.created_by });
                    if (item.date_agreed && (item.status==='agreed'||item.status==='paid')) { const ad = safeDate(item.date_agreed); if (ad) evts.push({ id:`va-a-${item.id}`, sortDate:ad, displayDate:fmtEvtDate(item.date_agreed), kind:'va-agreed', source:'Variation Account', reference:item.reference, title:item.title, statusLabel:item.status, value:item.value, isPositive:item.is_positive, createdBy:item.created_by }); }
                  }
                  for (const r of records.filter(r => r.projectId === bannerProject.id)) {
                    const cd = safeDate(r.createdAt); if (cd) evts.push({ id:`cr-a-${r.id}`, sortDate:cd, displayDate:fmtEvtDate(r.createdAt), kind:'cr-added', source:'Commercial Register', reference:r.reference, title:r.title, statusLabel:r.status, createdBy:r.createdBy });
                    if (r.dateSubmitted && r.status!=='draft') { const sd=safeDate(r.dateSubmitted); if (sd) evts.push({ id:`cr-s-${r.id}`, sortDate:sd, displayDate:fmtEvtDate(r.dateSubmitted), kind:'cr-submitted', source:'Commercial Register', reference:r.reference, title:r.title, statusLabel:r.status, createdBy:r.createdBy }); }
                    if (r.dateAgreed && ['agreed','added_to_valuation','paid','complete'].includes(r.status)) { const ad=safeDate(r.dateAgreed); if (ad) evts.push({ id:`cr-ag-${r.id}`, sortDate:ad, displayDate:fmtEvtDate(r.dateAgreed), kind:'cr-agreed', source:'Commercial Register', reference:r.reference, title:r.title, statusLabel:r.status, createdBy:r.createdBy }); }
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
          records={records}
          loading={loadingRecords}
          projects={projectsForModal}
          canCreate={canCreate}
          canEdit={canEdit}
          currentProject={bannerProject}
          keyDates={projectKeyDates}
          currentUserName={store.currentUser?.name ?? ''}
          onNewRecord={openNew}
          onOpenRecord={openRecord}
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
          currentUserName={store.currentUser?.name ?? ''}
        />
      )}

      {/* Record detail modal */}
      {modalOpen && (
        <DetailModal
          record={selectedRecord}
          isNew={isNewRecord}
          orgId={orgId}
          projects={projectsForModal}
          canViewPricing={canViewPricing}
          canEdit={isNewRecord ? canCreate : canEdit}
          canDelete={canDelete}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
