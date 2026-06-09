import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, Plus, Search, Filter, X, Save,
  Paperclip, Trash2, Eye, Download, FileText,
  Banknote,
  ChevronRight, AlertCircle, CheckCircle2, Clock, CircleDot,
  Printer,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import FileUploadComponent from '../components/FileUpload';
import type { UploadedFile } from '../components/FileUpload';
import type { CommercialRecord, CommercialLineItem, CommercialRecordType, CommercialRecordStatus } from '../data/types';
import type { DBAttachment } from '../lib/store';
import { openPrintTab, buildPrintDocument } from '../lib/printTab';

// ─── Constants ────────────────────────────────────────────────────────────────

const RECORD_TYPES: { value: CommercialRecordType; label: string; prefix: string; color: string }[] = [
  { value: 'variation',           label: 'Variation',           prefix: 'V',    color: 'bg-blue-900/40 text-blue-300 border-blue-700/50' },
  { value: 'delay_notice',        label: 'Delay Notice',        prefix: 'DN',   color: 'bg-amber-900/40 text-amber-300 border-amber-700/50' },
  { value: 'compensation_event',  label: 'Compensation Event',  prefix: 'CE',   color: 'bg-rose-900/40 text-rose-300 border-rose-700/50' },
];

const STATUSES: { value: CommercialRecordStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'draft',               label: 'Draft',               icon: <CircleDot size={12} />,     color: 'bg-slate-700/60 text-slate-300 border-slate-600/50' },
  { value: 'submitted',           label: 'Submitted',           icon: <ChevronRight size={12} />,  color: 'bg-sky-900/40 text-sky-300 border-sky-700/50' },
  { value: 'awaiting_agreement',  label: 'Awaiting Agreement',  icon: <Clock size={12} />,         color: 'bg-amber-900/40 text-amber-300 border-amber-700/50' },
  { value: 'agreed',              label: 'Agreed',              icon: <CheckCircle2 size={12} />,  color: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50' },
  { value: 'added_to_valuation',  label: 'Added to Valuation',  icon: <Banknote size={12} />,     color: 'bg-teal-900/40 text-teal-300 border-teal-700/50' },
  { value: 'paid',                label: 'Paid',                icon: <CheckCircle2 size={12} />,  color: 'bg-green-900/40 text-green-300 border-green-700/50' },
  { value: 'complete',            label: 'Complete',            icon: <CheckCircle2 size={12} />,  color: 'bg-green-900/60 text-green-200 border-green-700/60' },
  { value: 'rejected',            label: 'Rejected',            icon: <AlertCircle size={12} />,   color: 'bg-red-900/40 text-red-300 border-red-700/50' },
];

const UNITS = ['nr', 'item', 'm', 'm²', 'm³', 'hrs', 'days', 'wks', 'sum', 'tonnes', 'kg', 'l'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCurrency(n: number): string {
  return `£${fmt(n)}`;
}

function typeInfo(t: CommercialRecordType) {
  return RECORD_TYPES.find(r => r.value === t) ?? RECORD_TYPES[0];
}

function statusInfo(s: CommercialRecordStatus) {
  return STATUSES.find(x => x.value === s) ?? STATUSES[0];
}

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

// ─── DB mappers ───────────────────────────────────────────────────────────────

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

// ─── Small shared components ──────────────────────────────────────────────────

function TypeBadge({ type }: { type: CommercialRecordType }) {
  const t = typeInfo(type);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${t.color}`}>
      {t.label}
    </span>
  );
}

function StatusBadge({ status }: { status: CommercialRecordStatus }) {
  const s = statusInfo(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${s.color}`}>
      {s.icon}{s.label}
    </span>
  );
}

const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#f97316] focus:border-[#f97316] transition-colors';
const labelCls = 'block text-xs font-medium text-slate-400 mb-1';
const selectCls = `${inputCls} appearance-none cursor-pointer`;

// ─── Print / Export builders ──────────────────────────────────────────────────

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

  // ── CSS — matches PDFRenderer standard ──
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
    .s-draft { background: #f1f5f9; color: #475569; }
    .s-submitted { background: #dbeafe; color: #1d4ed8; }
    .s-agreed { background: #d1fae5; color: #065f46; }
    .s-other { background: #f1f5f9; color: #475569; }
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

  // ── Logo & status badge ──
  const logoHtml = logoUrl
    ? `<img class="doc-logo-img" src="${logoUrl}" alt="${esc(orgName)}" />`
    : `<div class="doc-logo-text">${esc(orgName)}</div>`;

  const statusCls = ['agreed', 'paid', 'complete', 'added_to_valuation'].includes(record.status) ? 's-agreed'
    : ['submitted', 'awaiting_agreement'].includes(record.status) ? 's-submitted'
    : record.status === 'draft' ? 's-draft' : 's-other';
  const statusBadge = `<span class="status-badge ${statusCls}">${esc(s.label)}</span>`;

  // ── Header ──
  const header = `
    <div class="doc-header">
      <div>
        ${logoHtml}
        <div class="doc-type-label">Commercial Record &mdash; ${esc(t.label)}</div>
      </div>
      <div class="doc-header-right">
        <div class="doc-title">${esc(record.reference ? record.reference + ' \u2014 ' : '')}${esc(record.title || 'Untitled')}</div>
        <div class="doc-dateline">${today}${record.projectName ? ' &nbsp;&middot;&nbsp; ' + esc(record.projectName) : ''}</div>
      </div>
    </div>
    <div class="doc-subtitle-bar">
      ${esc(t.label)}${record.reference ? ' &nbsp;&middot;&nbsp; ' + esc(record.reference) : ''}${record.projectName ? ' &nbsp;&middot;&nbsp; ' + esc(record.projectName) : ''}${statusBadge}
      &nbsp;&middot;&nbsp; <strong>${esc(viewLabel)}</strong>
    </div>`;

  // ── Meta block ──
  const metaItems = [
    ['Reference',      record.reference || '\u2014'],
    ['Record Type',    t.label],
    ['Client',         record.client || '\u2014'],
    ['Status',         s.label],
    ['Date Raised',    fmtD(record.dateRaised)],
    ['Date Submitted', fmtD(record.dateSubmitted)],
    ['Date Agreed',    fmtD(record.dateAgreed)],
    ['Document Ref',   docRef],
    ['Project',        record.projectName || '\u2014'],
  ].map(([label, value]) =>
    `<div class="meta-item"><div class="meta-label">${esc(label)}</div><div class="meta-value">${esc(value)}</div></div>`
  ).join('');
  const metaBlock = `<div class="meta-block"><div class="meta-grid">${metaItems}</div></div>`;

  // ── Commercial details / notes ──
  const notesSection = record.notes
    ? `<div class="section">
        <div class="section-heading">Commercial Details &amp; Notes</div>
        <div class="section-content">${esc(record.notes)}</div>
      </div>`
    : '';

  // ── Cost breakdown ──
  const lineMarginPct = (l: CommercialLineItem): string => {
    const ct = lineTotal(l, 'client');
    const it = lineTotal(l, 'internal');
    return ct > 0 ? ((ct - it) / ct * 100).toFixed(1) + '%' : '\u2014';
  };

  const lineRowsHtml = lines.map((l, i) => {
    const clientDesc   = l.clientDescription || l.description || '\u2014';
    const internalDesc = l.description || l.clientDescription || '\u2014';
    const it = lineTotal(l, 'internal');
    const ct = lineTotal(l, 'client');
    if (view === 'internal') {
      return `<tr>
        <td class="num" style="color:#94a3b8;font-size:9px">${i + 1}</td>
        <td>${esc(internalDesc)}</td><td>${esc(clientDesc)}</td>
        <td class="num">${l.quantity}</td><td>${esc(l.unit)}</td>
        <td class="num">\u00a3${fmt(l.internalRate)}</td><td class="num">\u00a3${fmt(it)}</td>
        <td class="num">\u00a3${fmt(l.clientRate)}</td><td class="num">\u00a3${fmt(ct)}</td>
        <td class="num">${l.markupPct != null ? l.markupPct.toFixed(1) + '%' : '\u2014'}</td>
        <td class="num">${lineMarginPct(l)}</td>
      </tr>`;
    }
    return `<tr>
      <td class="num" style="color:#94a3b8;font-size:9px">${i + 1}</td>
      <td>${esc(clientDesc)}</td>
      <td class="num">${l.quantity}</td><td>${esc(l.unit)}</td>
      <td class="num">\u00a3${fmt(l.clientRate)}</td><td class="num">\u00a3${fmt(ct)}</td>
    </tr>`;
  }).join('');

  const internalThead = `<tr>
    <th class="num">#</th><th>Internal Desc.</th><th>Client Desc.</th>
    <th class="num">Qty</th><th>Unit</th>
    <th class="num">Int. Rate</th><th class="num">Int. Total</th>
    <th class="num">Client Rate</th><th class="num">Client Total</th>
    <th class="num">Markup %</th><th class="num">Margin %</th>
  </tr>`;

  const clientThead = `<tr>
    <th class="num">#</th><th>Description</th>
    <th class="num">Qty</th><th>Unit</th>
    <th class="num">Rate</th><th class="num">Total</th>
  </tr>`;

  const emptyColspan = view === 'internal' ? 11 : 6;
  const totalsHtml = view === 'internal'
    ? `<table class="totals-block">
        <tr><td class="label">Total Internal Cost</td><td class="val">\u00a3${fmt(totals.totalInternal)}</td></tr>
        <tr><td class="label">Total Client Value</td><td class="val">\u00a3${fmt(totals.totalClient)}</td></tr>
        <tr><td class="label">Gross Margin</td><td class="val">\u00a3${fmt(totals.margin)} (${totals.marginPct.toFixed(1)}%)</td></tr>
      </table>`
    : `<table class="totals-block">
        <tr><td class="label">Total Client Value</td><td class="val">\u00a3${fmt(totals.totalClient)}</td></tr>
      </table>`;

  const costSection = `
    <div class="section">
      <div class="section-heading">Cost Breakdown</div>
      <table class="data-table">
        <thead>${view === 'internal' ? internalThead : clientThead}</thead>
        <tbody>${lineRowsHtml || `<tr><td colspan="${emptyColspan}" style="text-align:center;color:#94a3b8;padding:16px">No line items recorded.</td></tr>`}</tbody>
      </table>
      ${totalsHtml}
    </div>`;

  // ── Evidence & Attachments ──
  const images = attachments.filter(a =>
    a.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(a.name ?? '')
  );
  const docs = attachments.filter(a => !images.includes(a));

  const imagesHtml = images.length
    ? `<div class="evidence-grid">
        ${images.map(img => `
          <div class="evidence-item">
            ${img.data_url
              ? `<img class="evidence-img" src="${img.data_url}" alt="${esc(img.name)}" />`
              : `<div class="evidence-img" style="min-height:120px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px">Image unavailable</div>`}
            <div class="evidence-caption">${esc(img.name)}${img.created_at ? ' &nbsp;&middot;&nbsp; ' + fmtD(img.created_at) : ''}</div>
          </div>`).join('')}
      </div>`
    : '';

  const docsHtml = docs.length
    ? `<table class="data-table" style="margin-top:${images.length ? '14px' : '2px'}">
        <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Download / View</th></tr></thead>
        <tbody>
          ${docs.map(d => {
            const tl = d.type ? (d.type.split('/').pop()?.toUpperCase() ?? d.type) : (d.name?.split('.').pop()?.toUpperCase() ?? 'File');
            const sz = d.size ? fmtFileSize(d.size) : '\u2014';
            const up = d.created_at ? fmtD(d.created_at) : '\u2014';
            const link = d.data_url
              ? `<a href="${d.data_url}" download="${esc(d.name)}" style="color:#f97316;text-decoration:none;font-weight:600;white-space:nowrap">&#11015; Download</a>`
              : '\u2014';
            return `<tr><td>${esc(d.name)}</td><td>${esc(tl)}</td><td>${esc(sz)}</td><td>${esc(up)}</td><td>${link}</td></tr>`;
          }).join('')}
        </tbody>
      </table>`
    : '';

  const evidenceSection = (images.length || docs.length)
    ? `<div class="section">
        <div class="section-heading">Evidence &amp; Attachments (${attachments.length})</div>
        ${imagesHtml}
        ${docsHtml}
      </div>`
    : '';

  // ── Contractual notice by record type ──
  const COMMERCIAL_NOTICES: Record<string, string> = {
    variation:
      'This variation record has been prepared using the information available at the date of issue. The value contained within this record remains subject to review, substantiation, amendment and agreement until formally accepted by the relevant parties. Nothing within this record shall be construed as agreement of entitlement, liability, quantum or final account position.',
    delay_notice:
      'This delay notice has been issued to notify an event which may affect progress, completion or resource requirements. The duration, effects and associated costs of the delaying event remain under review and may be amended whilst the event remains ongoing. This notice is issued without prejudice to any contractual entitlement or future assessment of time and cost.',
    compensation_event:
      'This compensation event record has been prepared using the information available at the time of issue. The value and impact recorded may be revised as further information becomes available. This record does not constitute final agreement of entitlement, assessment or valuation.',
  };
  const contractualNotice = COMMERCIAL_NOTICES[record.recordType] ?? '';
  const noticeBar = contractualNotice
    ? `<div class="legal-notice-bar">
        <div class="legal-notice-label">Contractual Notice</div>
        <div class="legal-notice-text">${esc(contractualNotice)}</div>
      </div>`
    : '';

  // ── Audit trail ──
  const auditText = [
    record.createdBy ? `Created by ${record.createdBy}: ${fmtD(record.createdAt)}` : `Created: ${fmtD(record.createdAt)}`,
    `Last updated: ${fmtD(record.updatedAt)}`,
    `Current status: ${s.label}`,
  ].join('. ');

  // ── Legal & compliance footer ──
  const legalFooter = `
    <div class="legal-footer">
      <div class="legal-footer-header">
        <div class="legal-footer-title">Document Legal &amp; Compliance Statement</div>
        <div class="legal-footer-ref">Ref: ${esc(docRef)}</div>
      </div>
      ${noticeBar}
      <div class="legal-grid">
        <div class="legal-cell">
          <div class="legal-cell-label">Document Status</div>
          <div class="legal-cell-text">This document has a current status of <strong>${esc(s.label)}</strong> and is issued as a formal commercial project record.</div>
        </div>
        <div class="legal-cell">
          <div class="legal-cell-label">Evidence Statement</div>
          <div class="legal-cell-text">This document constitutes a contemporaneous commercial record created on the date stated. It may be used as evidence of project events, commercial notifications, valuation submissions, cost impact, entitlement tracking and related correspondence.</div>
        </div>
        <div class="legal-cell">
          <div class="legal-cell-label">Commercial Audit Trail</div>
          <div class="legal-cell-text">${esc(auditText)}.</div>
        </div>
        <div class="legal-cell">
          <div class="legal-cell-label">Liability &amp; Record Statement</div>
          <div class="legal-cell-text">The accuracy of the information contained within this document is the responsibility of the named completing party or issuing organisation. Values, quantities, rates and assessments are based on the information available at the time of preparation and remain subject to substantiation, review and agreement.</div>
        </div>
        <div class="legal-cell">
          <div class="legal-cell-label">Confidentiality</div>
          <div class="legal-cell-text">This document is issued in confidence for project and commercial management purposes only. Distribution is restricted to the named parties and project team. Unauthorised disclosure to third parties is not permitted without the express written consent of the issuing organisation.</div>
        </div>
      </div>
      <div class="legal-branding">
        <div class="legal-branding-left">
          Generated by <strong>${esc(orgName)}</strong> &mdash; powered by <strong>VYSITE</strong> | Construction Operating System
          &nbsp;&middot;&nbsp; ${esc(record.projectName || 'Project Record')}
          &nbsp;&middot;&nbsp; ${esc(today)}
        </div>
        <div class="legal-branding-right">
          &copy; VYSITE. All rights reserved.<br/>
          Document Ref: ${esc(docRef)}
        </div>
      </div>
    </div>`;

  const body = `
    <div class="page">
      ${header}
      ${metaBlock}
      ${notesSection}
      ${costSection}
      ${evidenceSection}
      ${legalFooter}
    </div>`;

  return buildPrintDocument(
    `${record.reference || 'Commercial'} \u2014 ${t.label} \u2014 ${view === 'internal' ? 'Internal' : 'Client'}`,
    CSS,
    body,
  );
}

// ─── Line Item Editor ─────────────────────────────────────────────────────────

interface DraftLineItem extends CommercialLineItem { _new?: boolean }

function LineItemEditor({
  lines,
  onChange,
  canViewPricing,
}: {
  lines: DraftLineItem[];
  onChange: (lines: DraftLineItem[]) => void;
  canViewPricing: boolean;
}) {
  function addLine() {
    const newLine: DraftLineItem = {
      id: `new-${Date.now()}`,
      orgId: '',
      recordId: '',
      sortOrder: lines.length,
      description: '',
      clientDescription: '',
      unit: 'nr',
      quantity: 1,
      internalRate: 0,
      clientRate: 0,
      markupPct: null,
      _new: true,
    };
    onChange([...lines, newLine]);
  }

  function updateLine(idx: number, patch: Partial<DraftLineItem>) {
    const next = lines.map((l, i) => i === idx ? { ...l, ...patch } : l);
    onChange(next);
  }

  function removeLine(idx: number) {
    onChange(lines.filter((_, i) => i !== idx));
  }

  const totals = recordTotals(lines);

  const numCls = `${inputCls} text-right`;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#1e2d4a]">
              <th className="text-left pb-2 pr-2 text-slate-500 font-medium w-8">#</th>
              <th className="text-left pb-2 pr-2 text-slate-500 font-medium min-w-[140px]">Internal Description</th>
              <th className="text-left pb-2 pr-2 text-slate-500 font-medium min-w-[140px]">Client Description</th>
              <th className="text-left pb-2 pr-2 text-slate-500 font-medium w-20">Unit</th>
              <th className="text-right pb-2 pr-2 text-slate-500 font-medium w-24">Qty</th>
              {canViewPricing && (
                <>
                  <th className="text-right pb-2 pr-2 text-slate-500 font-medium w-28">Internal Rate</th>
                  <th className="text-right pb-2 pr-2 text-slate-500 font-medium w-28">Internal Total</th>
                  <th className="text-right pb-2 pr-2 text-slate-500 font-medium w-20">Markup %</th>
                </>
              )}
              <th className="text-right pb-2 pr-2 text-slate-500 font-medium w-28">Client Rate</th>
              <th className="text-right pb-2 text-slate-500 font-medium w-28">Client Total</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={canViewPricing ? 11 : 8} className="py-8 text-center text-slate-500 text-sm">
                  No line items yet. Click Add Line to begin.
                </td>
              </tr>
            )}
            {lines.map((l, i) => (
              <tr key={l.id} className="border-b border-[#1a2236] group">
                <td className="py-1.5 pr-2 text-slate-500">{i + 1}</td>
                <td className="py-1.5 pr-2">
                  <input
                    className={inputCls}
                    value={l.description}
                    onChange={e => updateLine(i, { description: e.target.value })}
                    placeholder="Internal description"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    className={inputCls}
                    value={l.clientDescription}
                    onChange={e => updateLine(i, { clientDescription: e.target.value })}
                    placeholder="Client-facing description"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <select
                    className={selectCls}
                    value={l.unit}
                    onChange={e => updateLine(i, { unit: e.target.value })}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    <option value={l.unit && !UNITS.includes(l.unit) ? l.unit : ''}>{l.unit && !UNITS.includes(l.unit) ? l.unit : 'other'}</option>
                  </select>
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={numCls}
                    value={l.quantity}
                    onChange={e => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                {canViewPricing && (
                  <>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={numCls}
                        value={l.internalRate}
                        onChange={e => updateLine(i, { internalRate: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-right text-slate-300 font-mono">
                      {fmtCurrency(lineTotal(l, 'internal'))}
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className={numCls}
                        value={l.markupPct ?? ''}
                        onChange={e => updateLine(i, { markupPct: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="—"
                      />
                    </td>
                  </>
                )}
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={numCls}
                    value={l.clientRate}
                    onChange={e => updateLine(i, { clientRate: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </td>
                <td className="py-1.5 pr-2 text-right text-slate-300 font-mono">
                  {fmtCurrency(lineTotal(l, 'client'))}
                </td>
                <td className="py-1.5">
                  <button
                    onClick={() => removeLine(i)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all rounded"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-start justify-between gap-4">
        <button
          onClick={addLine}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[#1e2d4a] text-slate-400 hover:text-white hover:border-[#f97316] text-xs transition-colors"
        >
          <Plus size={13} /> Add Line
        </button>

        {lines.length > 0 && (
          <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg p-3 min-w-[240px] space-y-1.5 text-xs">
            {canViewPricing && (
              <>
                <div className="flex justify-between text-slate-400">
                  <span>Total Internal Cost</span>
                  <span className="font-mono text-slate-300">{fmtCurrency(totals.totalInternal)}</span>
                </div>
              </>
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

// ─── Record Detail Modal ──────────────────────────────────────────────────────

type ModalTab = 'overview' | 'cost' | 'attachments';

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

function DetailModal({
  record, isNew, orgId, projects, canViewPricing, canEdit, canDelete,
  onClose, onSaved, onDeleted,
}: DetailModalProps) {
  const store = useAppStore();
  const [tab, setTab] = useState<ModalTab>('overview');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // Overview form state
  const [form, setForm] = useState({
    recordType: (record?.recordType ?? 'variation') as CommercialRecordType,
    reference:     record?.reference ?? '',
    title:         record?.title ?? '',
    projectId:     record?.projectId ?? '',
    client:        record?.client ?? '',
    status:        (record?.status ?? 'draft') as CommercialRecordStatus,
    dateRaised:    record?.dateRaised ?? new Date().toISOString().slice(0, 10),
    dateSubmitted: record?.dateSubmitted ?? '',
    dateAgreed:    record?.dateAgreed ?? '',
    notes:         record?.notes ?? '',
  });

  // Line items state
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([]);
  const [lineItemsLoaded, setLineItemsLoaded] = useState(false);

  // Attachments
  const attachments = store.attachments.filter(
    a => a.linked_type === 'commercial' && a.linked_id === (record?.id ?? '')
  );

  // Auto-populate client when project changes
  function handleProjectChange(projectId: string) {
    const proj = projects.find(p => p.id === projectId);
    setForm(f => ({
      ...f,
      projectId,
      client: proj ? proj.client : f.client,
    }));
  }

  // Load line items when switching to cost tab or on open for existing record
  useEffect(() => {
    if (!record?.id || lineItemsLoaded) return;
    supabase
      .from('vy_commercial_line_items')
      .select('*')
      .eq('record_id', record.id)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setLineItems((data as Record<string, unknown>[]).map(dbToLineItem));
        setLineItemsLoaded(true);
      });
  }, [record?.id, lineItemsLoaded]);

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError(null);

    try {
      const payload = {
        org_id:         orgId,
        project_id:     form.projectId || null,
        record_type:    form.recordType,
        reference:      form.reference.trim(),
        title:          form.title.trim(),
        client:         form.client.trim(),
        status:         form.status,
        date_raised:    form.dateRaised || null,
        date_submitted: form.dateSubmitted || null,
        date_agreed:    form.dateAgreed || null,
        notes:          form.notes.trim(),
      };

      let savedRecord: CommercialRecord;
      if (isNew) {
        const { data, error: err } = await supabase
          .from('vy_commercial_records')
          .insert(payload)
          .select()
          .single();
        if (err || !data) throw err ?? new Error('Insert failed');
        const proj = projects.find(p => p.id === data.project_id);
        savedRecord = dbToRecord(data as Record<string, unknown>, proj?.name);
      } else {
        const { data, error: err } = await supabase
          .from('vy_commercial_records')
          .update(payload)
          .eq('id', record!.id)
          .select()
          .single();
        if (err || !data) throw err ?? new Error('Update failed');
        const proj = projects.find(p => p.id === data.project_id);
        savedRecord = dbToRecord(data as Record<string, unknown>, proj?.name);
      }

      // Persist line items
      if (lineItemsLoaded || isNew) {
        await supabase.from('vy_commercial_line_items').delete().eq('record_id', savedRecord.id);
        if (lineItems.length > 0) {
          const rows = lineItems.map((l, i) => ({
            org_id:             orgId,
            record_id:          savedRecord.id,
            sort_order:         i,
            description:        l.description,
            client_description: l.clientDescription,
            unit:               l.unit,
            quantity:           l.quantity,
            internal_rate:      l.internalRate,
            client_rate:        l.clientRate,
            markup_pct:         l.markupPct,
          }));
          await supabase.from('vy_commercial_line_items').insert(rows);
        }
        savedRecord.lineItems = lineItems.map((l, i) => ({ ...l, sortOrder: i, recordId: savedRecord.id, orgId }));
      }

      onSaved(savedRecord);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!record?.id) return;
    setDeleting(true);
    await supabase.from('vy_commercial_records').delete().eq('id', record.id);
    onDeleted(record.id);
  }

  async function handleExport(view: 'internal' | 'client') {
    const r = {
      ...record!,
      ...form,
      projectName: projects.find(p => p.id === form.projectId)?.name ?? record?.projectName,
    } as CommercialRecord;

    // Pre-fetch data_url for every attachment — the store omits it on initial load
    const enriched = await Promise.all(
      attachments.map(async (att) => {
        if (att.data_url) return att;
        const url = await store.fetchAttachmentData(att.id);
        return { ...att, data_url: url };
      })
    );

    openPrintTab(buildExportHTML(
      r,
      lineItems,
      view,
      enriched,
      store.settings?.logo_data_url,
      store.settings?.company_name,
    ));
  }

  const tabs: { key: ModalTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview',    label: 'Overview',       icon: <FileText size={14} /> },
    { key: 'cost',        label: 'Cost Breakdown',  icon: <Banknote size={14} /> },
    { key: 'attachments', label: `Attachments${attachments.length + pendingFiles.length > 0 ? ` (${attachments.length + pendingFiles.length})` : ''}`, icon: <Paperclip size={14} /> },
  ];

  const projName = projects.find(p => p.id === form.projectId)?.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-[#1e2d4a] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-[#f97316]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {form.reference && <span className="text-xs font-mono text-[#f97316]">{form.reference}</span>}
                <TypeBadge type={form.recordType} />
                <StatusBadge status={form.status} />
              </div>
              <h2 className="text-white font-semibold text-base truncate mt-0.5">
                {form.title || (isNew ? 'New Record' : 'Untitled')}
              </h2>
              {projName && <p className="text-xs text-slate-500 mt-0.5">{projName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#1e2d4a] transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2d4a] px-6 shrink-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-[#f97316] text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Overview tab ── */}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {/* Record Type */}
              <div>
                <label className={labelCls}>Record Type</label>
                <select
                  className={selectCls}
                  value={form.recordType}
                  onChange={e => setForm(f => ({ ...f, recordType: e.target.value as CommercialRecordType }))}
                  disabled={!canEdit}
                >
                  {RECORD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Reference */}
              <div>
                <label className={labelCls}>Reference Number</label>
                <input
                  className={inputCls}
                  value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder={`e.g. ${typeInfo(form.recordType).prefix}001`}
                  disabled={!canEdit}
                />
              </div>

              {/* Title */}
              <div className="md:col-span-2">
                <label className={labelCls}>Title / Description <span className="text-red-400">*</span></label>
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Brief description of the commercial event"
                  disabled={!canEdit}
                />
              </div>

              {/* Project */}
              <div>
                <label className={labelCls}>Project</label>
                <select
                  className={selectCls}
                  value={form.projectId}
                  onChange={e => handleProjectChange(e.target.value)}
                  disabled={!canEdit}
                >
                  <option value="">— No project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Client */}
              <div>
                <label className={labelCls}>Client</label>
                <input
                  className={inputCls}
                  value={form.client}
                  onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                  placeholder="Client name"
                  disabled={!canEdit}
                />
              </div>

              {/* Status */}
              <div>
                <label className={labelCls}>Status</label>
                <select
                  className={selectCls}
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as CommercialRecordStatus }))}
                  disabled={!canEdit}
                >
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Date Raised */}
              <div>
                <label className={labelCls}>Date Raised</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.dateRaised}
                  onChange={e => setForm(f => ({ ...f, dateRaised: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>

              {/* Date Submitted */}
              <div>
                <label className={labelCls}>Date Submitted</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.dateSubmitted}
                  onChange={e => setForm(f => ({ ...f, dateSubmitted: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>

              {/* Date Agreed */}
              <div>
                <label className={labelCls}>Date Agreed / Closed</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.dateAgreed}
                  onChange={e => setForm(f => ({ ...f, dateAgreed: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={4}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Internal notes, background, instructions..."
                  disabled={!canEdit}
                />
              </div>
            </div>
          )}

          {/* ── Cost Breakdown tab ── */}
          {tab === 'cost' && (
            <div>
              {!canViewPricing && (
                <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-800/30 text-amber-300 text-sm">
                  <AlertCircle size={15} />
                  <span>Internal rates and pricing are restricted to authorised commercial users.</span>
                </div>
              )}
              <LineItemEditor
                lines={lineItems}
                onChange={setLineItems}
                canViewPricing={canViewPricing}
              />
            </div>
          )}

          {/* ── Attachments tab ── */}
          {tab === 'attachments' && (
            <div className="space-y-4">
              {isNew && (
                <p className="text-sm text-slate-500 text-center py-8">
                  Save the record first, then attach files.
                </p>
              )}
              {!isNew && (
                <>
                  <FileUploadComponent
                    files={pendingFiles}
                    onChange={setPendingFiles}
                    label="Drop files, photos or documents here"
                    maxFiles={20}
                  />
                  {pendingFiles.length > 0 && (
                    <button
                      onClick={async () => {
                        setUploading(true);
                        for (const f of pendingFiles) {
                          const att: DBAttachment = {
                            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            linked_type: 'commercial',
                            linked_id: record!.id,
                            project_id: form.projectId || '',
                            project_name: projects.find(p => p.id === form.projectId)?.name ?? '',
                            name: f.name,
                            type: f.type,
                            size: f.size,
                            category: f.type.startsWith('image/') ? 'Photo' : f.type === 'application/pdf' ? 'Document' : 'Other',
                            data_url: f.dataUrl ?? '',
                            uploaded_by: store.currentUser?.name ?? '',
                            created_at: new Date().toISOString(),
                          };
                          await store.addAttachment(att);
                        }
                        setPendingFiles([]);
                        setUploading(false);
                      }}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 bg-[#f97316] hover:bg-orange-400 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      <Paperclip size={14} />
                      {uploading ? 'Saving…' : `Save ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}`}
                    </button>
                  )}
                  {attachments.length === 0 && pendingFiles.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">No attachments yet.</p>
                  )}
                  {attachments.map(att => (
                    <AttachmentRow
                      key={att.id}
                      att={att}
                      onRemove={() => store.removeAttachment(att.id)}
                      fetchData={store.fetchAttachmentData}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2d4a] shrink-0 gap-3">
          <div className="flex items-center gap-2">
            {/* Export buttons — available for any tab on saved records */}
            {!isNew && (
              <>
                {canViewPricing && (
                  <button
                    onClick={() => handleExport('internal')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1e2d4a] text-slate-300 hover:text-white hover:border-[#f97316] text-xs transition-colors"
                  >
                    <Printer size={13} /> Internal Print
                  </button>
                )}
                <button
                  onClick={() => handleExport('client')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1e2d4a] text-slate-300 hover:text-white hover:border-[#f97316] text-xs transition-colors"
                >
                  <Printer size={13} /> Client Print
                </button>
              </>
            )}
            {/* Delete */}
            {!isNew && canDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete this record?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 hover:bg-red-900/50 text-xs transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-400 hover:text-white">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1e2d4a] text-slate-500 hover:text-red-400 hover:border-red-800/50 text-xs transition-colors"
                >
                  <Trash2 size={13} /> Delete
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#1e2d4a] text-slate-400 hover:text-white text-sm transition-colors"
            >
              {canEdit ? 'Cancel' : 'Close'}
            </button>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-orange-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-900/30 disabled:opacity-60"
              >
                <Save size={14} />
                {saving ? 'Saving…' : (isNew ? 'Create Record' : 'Save Changes')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Attachment row ───────────────────────────────────────────────────────────

function fileTypeLabel(mimeType: string | undefined, name: string): string {
  if (!mimeType) return name.split('.').pop()?.toUpperCase() ?? 'File';
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'Word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'text/csv': 'CSV',
    'text/plain': 'Text',
  };
  if (mimeType.startsWith('image/')) return mimeType.split('/')[1].toUpperCase();
  return map[mimeType] ?? mimeType.split('/').pop()?.toUpperCase() ?? 'File';
}

function AttachmentRow({
  att,
  onRemove,
  fetchData,
}: {
  att: DBAttachment;
  onRemove: () => void;
  fetchData: (id: string) => Promise<string>;
}) {
  const [previewing, setPreviewing] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(att.data_url || null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const isImage = att.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.name ?? '');

  async function openPreview() {
    if (!dataUrl) {
      setLoadingPreview(true);
      const url = await fetchData(att.id);
      setDataUrl(url);
      setLoadingPreview(false);
    }
    setPreviewing(true);
  }

  async function handleDownload() {
    let url = dataUrl;
    if (!url) {
      setLoadingPreview(true);
      url = await fetchData(att.id);
      setDataUrl(url);
      setLoadingPreview(false);
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name;
    a.click();
  }

  const size = att.size ? (att.size < 1024 * 1024 ? `${(att.size / 1024).toFixed(0)} KB` : `${(att.size / (1024 * 1024)).toFixed(1)} MB`) : '';
  const typeLabel = fileTypeLabel(att.type, att.name);
  const uploadDate = att.created_at
    ? new Date(att.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const meta = [typeLabel, size, uploadDate ? `Uploaded ${uploadDate}` : null].filter(Boolean).join(' · ');

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1628] border border-[#1e2d4a] group">
        {isImage ? (
          <button
            onClick={openPreview}
            title="View image"
            className="w-14 h-10 rounded-lg overflow-hidden shrink-0 border border-[#1e2d4a] bg-[#1a2236] flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            {dataUrl ? (
              <img src={dataUrl} alt={att.name} className="w-full h-full object-cover" />
            ) : (
              <Eye size={14} className={`text-slate-400 ${loadingPreview ? 'animate-pulse' : ''}`} />
            )}
          </button>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-[#1a2236] flex items-center justify-center shrink-0">
            <FileText size={14} className="text-slate-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">{att.name}</p>
          {meta && <p className="text-xs text-slate-500">{meta}</p>}
        </div>
        {!isImage && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-900/30 border border-orange-700/40 text-orange-400 hover:bg-orange-900/50 hover:text-orange-300 text-xs font-medium transition-colors shrink-0"
            title="Download"
          >
            <Download size={12} /> Download
          </button>
        )}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={openPreview} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1e2d4a]" title={isImage ? 'View image' : 'Preview'}>
            <Eye size={14} />
          </button>
          <button onClick={onRemove} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-[#1e2d4a]">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {previewing && dataUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={() => setPreviewing(false)}>
          {isImage ? (
            <img src={dataUrl} alt={att.name} className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
          ) : (
            <iframe src={dataUrl} title={att.name} className="w-[90vw] h-[90vh] rounded-xl bg-white" onClick={(e: React.MouseEvent) => e.stopPropagation()} />
          )}
          <button onClick={() => setPreviewing(false)} className="absolute top-4 right-4 p-2 bg-black/60 rounded-full text-white hover:bg-black/80">
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}

// ─── Main Commercial page ─────────────────────────────────────────────────────

export default function Commercial() {
  const { currentOrgId } = useAuth();
  const perms = usePermissions();
  const store = useAppStore();

  const orgId = currentOrgId ?? '';
  const canViewPricing = perms['commercial.view_pricing'] ?? false;
  const canEdit        = perms['commercial.edit']         ?? false;
  const canCreate      = perms['commercial.create']       ?? false;
  const canDelete      = perms['commercial.delete']       ?? false;

  const [records, setRecords] = useState<CommercialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<CommercialRecord | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType]   = useState<CommercialRecordType | ''>('');
  const [filterStatus, setFilterStatus] = useState<CommercialRecordStatus | ''>('');
  const [filterProject, setFilterProject] = useState('');
  const [showFilters, setShowFilters]   = useState(false);

  const projects = useMemo(() =>
    store.projects.map(p => ({ id: p.id, name: p.name, client: p.client })),
    [store.projects]
  );

  const loadRecords = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from('vy_commercial_records')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (data) {
      const projectMap = Object.fromEntries(store.projects.map(p => [p.id, p.name]));
      setRecords((data as Record<string, unknown>[]).map(r =>
        dbToRecord(r, r.project_id ? projectMap[r.project_id as string] : undefined)
      ));
    }
    setLoading(false);
  }, [orgId, store.projects]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const filteredRecords = useMemo(() => {
    let list = records;
    if (filterType)    list = list.filter(r => r.recordType === filterType);
    if (filterStatus)  list = list.filter(r => r.status === filterStatus);
    if (filterProject) list = list.filter(r => r.projectId === filterProject);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.reference.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.client.toLowerCase().includes(q) ||
        (r.projectName ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [records, filterType, filterStatus, filterProject, searchQuery]);

  function openNew() {
    setSelectedRecord(null);
    setIsNewRecord(true);
    setModalOpen(true);
  }

  function openRecord(r: CommercialRecord) {
    setSelectedRecord(r);
    setIsNewRecord(false);
    setModalOpen(true);
  }

  function handleSaved(r: CommercialRecord) {
    setRecords(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = r;
        return next;
      }
      return [r, ...prev];
    });
    setModalOpen(false);
  }

  function handleDeleted(id: string) {
    setRecords(prev => prev.filter(r => r.id !== id));
    setModalOpen(false);
  }

  const activeFilterCount = [filterType, filterStatus, filterProject].filter(Boolean).length;

  // ── Summary counts (for the top stat cards) ──────────────────────────────
  const totalRecords     = records.length;
  const openRecords      = records.filter(r => !['complete', 'rejected'].includes(r.status)).length;
  const agreedRecords    = records.filter(r => r.status === 'agreed' || r.status === 'added_to_valuation' || r.status === 'paid' || r.status === 'complete').length;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center">
            <TrendingUp size={20} className="text-[#f97316]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Commercial</h1>
            <p className="text-xs text-slate-500">Variations, Delay Notices &amp; Compensation Events</p>
          </div>
        </div>
        {canCreate && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f97316] hover:bg-orange-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-900/30"
          >
            <Plus size={16} /> New Record
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Records',  value: totalRecords,   color: 'text-white' },
          { label: 'Open / Active',  value: openRecords,    color: 'text-amber-400' },
          { label: 'Agreed / Paid',  value: agreedRecords,  color: 'text-emerald-400' },
        ].map(card => (
          <div key={card.label} className="bg-[#111827] border border-[#1e2d4a] rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className={`${inputCls} pl-8`}
            placeholder="Search reference, title, client..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
            activeFilterCount > 0 || showFilters
              ? 'border-[#f97316] text-[#f97316]'
              : 'border-[#1e2d4a] text-slate-400 hover:text-white'
          }`}
        >
          <Filter size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 w-4 h-4 rounded-full bg-[#f97316] text-white text-xs flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={() => { setFilterType(''); setFilterStatus(''); setFilterProject(''); }}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 p-4 bg-[#0d1628] border border-[#1e2d4a] rounded-xl">
          <div className="min-w-[180px]">
            <label className={labelCls}>Record Type</label>
            <select className={selectCls} value={filterType} onChange={e => setFilterType(e.target.value as CommercialRecordType | '')}>
              <option value="">All types</option>
              {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className={labelCls}>Status</label>
            <select className={selectCls} value={filterStatus} onChange={e => setFilterStatus(e.target.value as CommercialRecordStatus | '')}>
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="min-w-[220px]">
            <label className={labelCls}>Project</label>
            <select className={selectCls} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Register table */}
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[120px_1fr_160px_160px_120px_100px] gap-4 px-4 py-3 border-b border-[#1e2d4a] text-xs font-medium text-slate-500 uppercase tracking-wide">
          <span>Type</span>
          <span>Record</span>
          <span>Project</span>
          <span>Client</span>
          <span>Status</span>
          <span>Date Raised</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center">
            <TrendingUp size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">
              {records.length === 0 ? 'No commercial records yet' : 'No records match your filters'}
            </p>
            {records.length === 0 && canCreate && (
              <button
                onClick={openNew}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2236] border border-[#1e2d4a] text-slate-300 hover:text-white text-sm mx-auto transition-colors"
              >
                <Plus size={14} /> Create your first record
              </button>
            )}
          </div>
        ) : (
          filteredRecords.map((r, i) => (
            <button
              key={r.id}
              onClick={() => openRecord(r)}
              className={`w-full grid grid-cols-[120px_1fr_160px_160px_120px_100px] gap-4 px-4 py-3.5 text-left transition-colors hover:bg-[#1a2236] ${
                i < filteredRecords.length - 1 ? 'border-b border-[#1e2d4a]/60' : ''
              }`}
            >
              <div><TypeBadge type={r.recordType} /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {r.reference && (
                    <span className="text-xs font-mono text-[#f97316] shrink-0">{r.reference}</span>
                  )}
                  <span className="text-sm text-white font-medium truncate">{r.title || 'Untitled'}</span>
                </div>
              </div>
              <div className="text-sm text-slate-400 truncate">{r.projectName || '—'}</div>
              <div className="text-sm text-slate-400 truncate">{r.client || '—'}</div>
              <div><StatusBadge status={r.status} /></div>
              <div className="text-xs text-slate-500">
                {r.dateRaised ? new Date(r.dateRaised).toLocaleDateString('en-GB') : '—'}
              </div>
            </button>
          ))
        )}
      </div>

      {filteredRecords.length > 0 && (
        <p className="mt-3 text-xs text-slate-600 text-right">
          {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
          {activeFilterCount > 0 ? ` (filtered from ${records.length})` : ''}
        </p>
      )}

      {/* Detail / Create modal */}
      {modalOpen && (
        <DetailModal
          record={selectedRecord}
          isNew={isNewRecord}
          orgId={orgId}
          projects={projects}
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
