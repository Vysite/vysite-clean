import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, Plus, Search, Filter, X, Save,
  Paperclip, Trash2, Eye, Download, FileText,
  Banknote,
  ChevronRight, AlertCircle, CheckCircle2, Clock, CircleDot,
  Printer, MapPin, User, Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import KeyDatesPanel from '../components/KeyDatesPanel';
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

function parseRawValue(raw: string): number {
  const n = parseFloat(raw.replace(/[£,\s]/g, ''));
  return isNaN(n) ? 0 : n;
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

  // Banner project selection — defaults to first available project
  const [bannerProjectId, setBannerProjectId] = useState<string>('');
  const effectiveBannerProjectId = bannerProjectId || store.projects[0]?.id || '';
  const bannerProject = store.projects.find(p => p.id === effectiveBannerProjectId) ?? null;

  // Editable banner commercial values
  const [bannerContractEdit, setBannerContractEdit] = useState('');
  const [bannerCompletedEdit, setBannerCompletedEdit] = useState('');
  const [bannerVariationsEdit, setBannerVariationsEdit] = useState('');
  const [bannerSaving, setBannerSaving] = useState(false);

  // When banner project changes, reset edit fields to stored values
  useEffect(() => {
    if (!bannerProject) return;
    const raw = bannerProject.value ? parseRawValue(bannerProject.value) : 0;
    setBannerContractEdit(raw > 0 ? String(raw) : '');
    setBannerCompletedEdit(bannerProject.committed != null ? String(bannerProject.committed) : '');
    setBannerVariationsEdit(bannerProject.variationsValue != null ? String(bannerProject.variationsValue) : '');
  }, [effectiveBannerProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveBannerValues() {
    if (!bannerProject) return;
    const contractNum = parseFloat(bannerContractEdit) || 0;
    const completedNum = bannerCompletedEdit.trim() !== '' ? parseFloat(bannerCompletedEdit) : null;
    const variationsNum = bannerVariationsEdit.trim() !== '' ? parseFloat(bannerVariationsEdit) : null;
    const newProgress = contractNum > 0 && completedNum != null
      ? Math.min(100, Math.round((completedNum / contractNum) * 100))
      : bannerProject.progress;
    const updated = {
      ...bannerProject,
      value: contractNum > 0 ? `£${Math.round(contractNum).toLocaleString('en-GB')}` : bannerProject.value,
      committed: completedNum,
      variationsValue: variationsNum,
      progress: newProgress,
    };
    setBannerSaving(true);
    await store.updateProject(updated);
    setBannerSaving(false);
  }

  function selectBannerProject(id: string) {
    setBannerProjectId(id);
    setFilterProject(id);
  }

  // Record selection for export
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    }
  }

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

  // ── PDF export helpers ────────────────────────────────────────────────────

  const PDF_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1e293b; background: white; font-size: 11px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 880px; margin: 0 auto; padding: 36px 40px; }
    .doc-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid #f97316; margin-bottom: 20px; }
    .doc-logo-text { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: 0.05em; }
    .doc-type-label { font-size: 10px; color: #64748b; margin-top: 4px; }
    .doc-header-right { text-align: right; }
    .doc-title { font-size: 18px; font-weight: 900; color: #111; margin-bottom: 4px; line-height: 1.25; max-width: 420px; }
    .doc-dateline { font-size: 11px; color: #64748b; }
    .kpi-bar { display: grid; gap: 10px; margin: 16px 0; }
    .kpi-bar-3 { grid-template-columns: repeat(3, 1fr); }
    .kpi-bar-4 { grid-template-columns: repeat(4, 1fr); }
    .kpi-cell { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; text-align: center; }
    .kpi-value { font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1; }
    .kpi-label { font-size: 8.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 4px; }
    .kpi-orange { color: #f97316; } .kpi-amber { color: #d97706; } .kpi-green { color: #059669; } .kpi-red { color: #dc2626; }
    .meta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 18px; }
    .meta-grid { display: grid; gap: 10px 20px; }
    .meta-grid-4 { grid-template-columns: repeat(4, 1fr); }
    .meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
    .meta-value { font-size: 11px; font-weight: 600; color: #0f172a; }
    .progress-wrap { margin: 12px 0 4px; }
    .progress-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; display: flex; justify-content: space-between; }
    .progress-track { height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; }
    .progress-fill { height: 100%; background: #f97316; border-radius: 20px; }
    .badge { display: inline-block; font-size: 8.5px; font-weight: 700; padding: 2px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge-orange { background: #fff7ed; color: #c2410c; } .badge-green { background: #d1fae5; color: #065f46; }
    .badge-amber { background: #fef3c7; color: #92400e; } .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .badge-slate { background: #f1f5f9; color: #475569; } .badge-red { background: #fee2e2; color: #991b1b; }
    .section-heading { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 12px; margin-top: 20px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .data-table th { padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; }
    .data-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: top; }
    .data-table tr:nth-child(even) td { background: #f8fafc; }
    .ticket-card { border: 1.5px solid #e2e8f0; border-radius: 10px; margin-bottom: 24px; overflow: hidden; page-break-inside: avoid; }
    .ticket-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; gap: 12px; }
    .ticket-ref { font-family: monospace; font-size: 9.5px; font-weight: 700; color: #f97316; background: #fff7ed; padding: 2px 8px; border-radius: 5px; display: inline-block; margin-bottom: 4px; }
    .ticket-title { font-size: 13px; font-weight: 800; color: #0f172a; }
    .ticket-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
    .ticket-body { padding: 14px 16px; }
    .data-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
    .data-cell { background: white; padding: 8px 10px; }
    .data-cell-label { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 2px; }
    .data-cell-value { font-size: 10.5px; font-weight: 600; color: #0f172a; }
    .text-field { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 12px; margin-bottom: 10px; }
    .text-field-label { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
    .text-field-value { font-size: 10.5px; color: #334155; line-height: 1.6; white-space: pre-wrap; }
    .li-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
    .li-table th { padding: 7px 10px; text-align: left; font-size: 8.5px; font-weight: 700; color: #64748b; text-transform: uppercase; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
    .li-table th.r { text-align: right; }
    .li-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
    .li-table td.r { text-align: right; }
    .li-table tr:nth-child(even) td { background: #f8fafc; }
    .li-total { display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding: 9px 10px; border-top: 1.5px solid #e2e8f0; background: #f8fafc; }
    .li-total-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .li-total-value { font-size: 13px; font-weight: 900; color: #f97316; }
    .legal-footer { margin-top: 32px; border-top: 2px solid #e2e8f0; }
    .legal-footer-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 0 8px; }
    .legal-footer-title { font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
    .legal-footer-ref { font-size: 8px; color: #94a3b8; }
    .legal-branding { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid #e2e8f0; }
    .legal-branding-left { font-size: 8px; color: #94a3b8; }
    .legal-branding-right { font-size: 8px; color: #94a3b8; }
    @media print { .page { padding: 20px 24px; } .ticket-card { page-break-inside: avoid; } }
  `;

  function buildProjectMetaHTML(
    proj: { name: string; status: string; client: string; location: string; projectManager: string; startDate: string; completionDate: string },
    progress: number,
    contractNum: number,
    completedNum: number | null,
    remaining: number | null,
  ): string {
    const fv = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');
    const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const barPct = Math.min(100, progress);
    const statusBadge = proj.status === 'Active' ? 'badge-green' : proj.status === 'Completed' ? 'badge-blue' : proj.status === 'On Hold' ? 'badge-amber' : 'badge-slate';
    const remainCls = remaining == null ? '' : remaining < 0 ? 'kpi-red' : remaining < contractNum * 0.1 ? 'kpi-amber' : 'kpi-green';
    return `
      <div class="meta-block">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
              <span style="font-size:15px;font-weight:800;color:#0f172a;">${proj.name}</span>
              <span class="badge ${statusBadge}">${proj.status}</span>
            </div>
            ${proj.client ? `<p style="font-size:10.5px;color:#64748b;margin:0;">${proj.client}</p>` : ''}
          </div>
          ${contractNum > 0 ? `<div style="text-align:right;"><p style="font-size:18px;font-weight:900;color:#0f172a;margin:0;">${fv(contractNum)}</p><p style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin:2px 0 0;">Contract Value</p></div>` : ''}
        </div>
        <div class="meta-grid meta-grid-4" style="margin-bottom:12px;">
          <div><div class="meta-label">Location</div><div class="meta-value">${proj.location || '—'}</div></div>
          <div><div class="meta-label">Project Manager</div><div class="meta-value">${proj.projectManager || '—'}</div></div>
          <div><div class="meta-label">Start Date</div><div class="meta-value">${fmtDate(proj.startDate)}</div></div>
          <div><div class="meta-label">Completion</div><div class="meta-value">${fmtDate(proj.completionDate)}</div></div>
        </div>
        <div class="progress-wrap">
          <div class="progress-label"><span>Overall Progress</span><span>${barPct}%</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${barPct}%;"></div></div>
        </div>
        ${contractNum > 0 && completedNum != null && remaining != null ? `
        <div class="kpi-bar kpi-bar-4" style="margin-top:12px;">
          <div class="kpi-cell"><div class="kpi-value">${fv(contractNum)}</div><div class="kpi-label">Contract Value</div></div>
          <div class="kpi-cell"><div class="kpi-value">${fv(completedNum)}</div><div class="kpi-label">Completed Value</div></div>
          <div class="kpi-cell"><div class="kpi-value kpi-orange">${barPct}%</div><div class="kpi-label">Progress</div></div>
          <div class="kpi-cell"><div class="kpi-value ${remainCls}">${fv(remaining)}</div><div class="kpi-label">Remaining</div></div>
        </div>` : ''}
      </div>`;
  }

  function exportRegisterSummary(
    proj: { name: string; status: string; client: string; location: string; projectManager: string; startDate: string; completionDate: string },
    progress: number, contractNum: number, completedNum: number | null, remaining: number | null,
    recordList: CommercialRecord[],
  ) {
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
    const totalR = recordList.length;
    const openR  = recordList.filter(r => !['complete','rejected'].includes(r.status)).length;
    const agreeR = recordList.filter(r => ['agreed','added_to_valuation','paid','complete'].includes(r.status)).length;
    const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const statusBadgeCls = (s: string) => ['agreed','added_to_valuation','paid','complete'].includes(s) ? 'badge-green' : s === 'submitted' || s === 'under_review' ? 'badge-blue' : s === 'rejected' ? 'badge-red' : 'badge-amber';
    const typeBadgeCls = (t: string) => t === 'variation' ? 'badge-orange' : t === 'delay_notice' ? 'badge-amber' : t === 'compensation_event' ? 'badge-blue' : 'badge-slate';

    const rows = recordList.map(r => `
      <tr>
        <td><span class="badge ${typeBadgeCls(r.recordType)}">${typeInfo(r.recordType).label}</span></td>
        <td style="font-family:monospace;font-size:9.5px;font-weight:700;color:#f97316;">${r.reference || '—'}</td>
        <td style="font-weight:600;">${r.title || 'Untitled'}</td>
        <td>${r.projectName || '—'}</td>
        <td>${r.client || '—'}</td>
        <td><span class="badge ${statusBadgeCls(r.status)}">${statusInfo(r.status).label}</span></td>
        <td>${fmtDate(r.dateRaised)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Commercial Register — ${proj.name}</title>
    <style>${PDF_CSS}</style>
    <script>window.onload=function(){window.print();}<\/script>
    </head><body><div class="page">
      <div class="doc-header">
        <div>
          <div class="doc-logo-text">VYSITE</div>
          <div class="doc-type-label">Commercial Register — ${proj.name}</div>
        </div>
        <div class="doc-header-right">
          <div class="doc-title">Commercial Register Summary</div>
          <div class="doc-dateline">Exported ${todayStr}</div>
        </div>
      </div>
      ${buildProjectMetaHTML(proj, progress, contractNum, completedNum, remaining)}
      <div class="kpi-bar kpi-bar-3">
        <div class="kpi-cell"><div class="kpi-value">${totalR}</div><div class="kpi-label">Total Records</div></div>
        <div class="kpi-cell"><div class="kpi-value kpi-amber">${openR}</div><div class="kpi-label">Open / Active</div></div>
        <div class="kpi-cell"><div class="kpi-value kpi-green">${agreeR}</div><div class="kpi-label">Agreed / Paid</div></div>
      </div>
      <div class="section-heading">Commercial Register (${totalR} record${totalR !== 1 ? 's' : ''})</div>
      <table class="data-table">
        <thead><tr><th>Type</th><th>Reference</th><th>Title</th><th>Project</th><th>Client</th><th>Status</th><th>Date Raised</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="legal-footer">
        <div class="legal-footer-header">
          <div class="legal-footer-title">Commercial Document — Confidential</div>
          <div class="legal-footer-ref">Exported ${todayStr}</div>
        </div>
        <div class="legal-branding">
          <div class="legal-branding-left">Generated by VYSITE — powered by <strong>VYSITE</strong> | Construction Operating System</div>
          <div class="legal-branding-right">&copy; VYSITE. All rights reserved.</div>
        </div>
      </div>
    </div></body></html>`;
    openPrintTab(html);
  }

  function exportFullTickets(
    proj: { name: string; status: string; client: string; location: string; projectManager: string; startDate: string; completionDate: string },
    progress: number, contractNum: number, completedNum: number | null, remaining: number | null,
    recordList: CommercialRecord[],
  ) {
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '—';
    const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const statusBadgeCls = (s: string) => ['agreed','added_to_valuation','paid','complete'].includes(s) ? 'badge-green' : s === 'submitted' || s === 'under_review' ? 'badge-blue' : s === 'rejected' ? 'badge-red' : 'badge-amber';
    const typeBadgeCls = (t: string) => t === 'variation' ? 'badge-orange' : t === 'delay_notice' ? 'badge-amber' : t === 'compensation_event' ? 'badge-blue' : 'badge-slate';

    const tickets = recordList.map((r, idx) => {
      const totals = r.lineItems && r.lineItems.length > 0 ? recordTotals(r.lineItems) : null;
      const lineRows = r.lineItems && r.lineItems.length > 0
        ? r.lineItems.map(l => `<tr>
            <td>${l.description || '—'}</td>
            <td>${l.unit}</td>
            <td class="r">${l.quantity}</td>
            <td class="r">${fmtCurrency(l.clientRate)}</td>
            <td class="r" style="font-weight:700;color:#f97316;">${fmtCurrency(l.quantity * l.clientRate)}</td>
          </tr>`).join('')
        : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:10px;">No line items</td></tr>`;
      return `
        ${idx > 0 ? '<div style="page-break-before:always;height:1px;"></div>' : ''}
        <div class="ticket-card">
          <div class="ticket-header">
            <div>
              ${r.reference ? `<span class="ticket-ref">${r.reference}</span>` : ''}
              <div class="ticket-title">${r.title || 'Untitled'}</div>
              <div class="ticket-sub">${r.projectName || proj.name}${(r.client || proj.client) ? ' · ' + (r.client || proj.client) : ''}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-top:2px;">
              <span class="badge ${typeBadgeCls(r.recordType)}">${typeInfo(r.recordType).label}</span>
              <span class="badge ${statusBadgeCls(r.status)}">${statusInfo(r.status).label}</span>
            </div>
          </div>
          <div class="ticket-body">
            <div class="data-grid">
              <div class="data-cell"><div class="data-cell-label">Date Raised</div><div class="data-cell-value">${fmtDate(r.dateRaised)}</div></div>
              <div class="data-cell"><div class="data-cell-label">Date Submitted</div><div class="data-cell-value">${fmtDate(r.dateSubmitted)}</div></div>
              <div class="data-cell"><div class="data-cell-label">Date Agreed</div><div class="data-cell-value">${fmtDate(r.dateAgreed)}</div></div>
              <div class="data-cell"><div class="data-cell-label">Created By</div><div class="data-cell-value">${r.createdBy || '—'}</div></div>
            </div>
            ${r.notes ? `<div class="text-field"><div class="text-field-label">Notes / Description</div><div class="text-field-value">${r.notes}</div></div>` : ''}
            ${r.lineItems && r.lineItems.length > 0 ? `
            <div class="section-heading" style="margin-top:12px;">Cost Breakdown</div>
            <table class="li-table">
              <thead><tr><th>Description</th><th>Unit</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Total</th></tr></thead>
              <tbody>${lineRows}</tbody>
            </table>
            ${totals ? `<div class="li-total"><span class="li-total-label">Total Client Value</span><span class="li-total-value">${fmtCurrency(totals.totalClient)}</span></div>` : ''}
            ` : ''}
          </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Commercial Full Export — ${proj.name}</title>
    <style>${PDF_CSS}</style>
    <script>window.onload=function(){window.print();}<\/script>
    </head><body><div class="page">
      <div class="doc-header">
        <div>
          <div class="doc-logo-text">VYSITE</div>
          <div class="doc-type-label">Commercial Full Ticket Export — ${proj.name}</div>
        </div>
        <div class="doc-header-right">
          <div class="doc-title">Commercial Full Ticket Export</div>
          <div class="doc-dateline">${recordList.length} record${recordList.length !== 1 ? 's' : ''} · ${todayStr}</div>
        </div>
      </div>
      ${buildProjectMetaHTML(proj, progress, contractNum, completedNum, remaining)}
      <div class="section-heading">Tickets (${recordList.length})</div>
      ${tickets}
      <div class="legal-footer">
        <div class="legal-footer-header">
          <div class="legal-footer-title">Commercial Document — Confidential</div>
          <div class="legal-footer-ref">Exported ${todayStr}</div>
        </div>
        <div class="legal-branding">
          <div class="legal-branding-left">Generated by VYSITE — powered by <strong>VYSITE</strong> | Construction Operating System</div>
          <div class="legal-branding-right">&copy; VYSITE. All rights reserved.</div>
        </div>
      </div>
    </div></body></html>`;
    openPrintTab(html);
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

      {/* Project summary banner */}
      {bannerProject ? (() => {
        const proj = bannerProject;
        const contractNum  = parseFloat(bannerContractEdit)  || (proj.value ? parseRawValue(proj.value) : 0);
        const completedNum = bannerCompletedEdit.trim() !== '' ? parseFloat(bannerCompletedEdit) : (proj.committed ?? null);
        const progress     = contractNum > 0 && completedNum != null
          ? Math.min(100, Math.round((completedNum / contractNum) * 100))
          : proj.progress;
        const remaining    = completedNum != null ? contractNum - completedNum : null;
        const variationsNum = bannerVariationsEdit.trim() !== '' ? parseFloat(bannerVariationsEdit) : (proj.variationsValue ?? null);
        const contractInclVariations = contractNum + (variationsNum ?? 0);
        const fmtVal = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');
        const contractDirty   = bannerContractEdit   !== '' && parseFloat(bannerContractEdit)   !== (proj.value ? parseRawValue(proj.value) : 0);
        const completedDirty  = bannerCompletedEdit  !== '' && parseFloat(bannerCompletedEdit)  !== (proj.committed ?? NaN);
        const variationsDirty = bannerVariationsEdit !== '' && parseFloat(bannerVariationsEdit) !== (proj.variationsValue ?? NaN);
        const isDirty = contractDirty || completedDirty || variationsDirty;

        return (
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-6 mb-6">
            {/* Project name / status / project selector / contract value */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold text-white leading-tight">{proj.name}</h2>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    proj.status === 'Active'    ? 'bg-emerald-900/60 text-emerald-400'
                    : proj.status === 'Completed' ? 'bg-blue-900/60 text-blue-400'
                    : proj.status === 'On Hold'   ? 'bg-amber-900/60 text-amber-400'
                    : 'bg-slate-700/60 text-slate-400'
                  }`}>{proj.status}</span>
                </div>
                <p className="text-sm text-slate-500">{proj.client}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {store.projects.length > 1 && (
                  <select
                    value={effectiveBannerProjectId}
                    onChange={e => selectBannerProject(e.target.value)}
                    className="bg-[#0d1628] border border-[#1e2d4a] text-slate-300 text-sm rounded-lg px-3 py-1.5 min-w-[220px] focus:outline-none focus:ring-1 focus:ring-[#f97316] focus:border-[#f97316] transition-colors"
                  >
                    {store.projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Meta grid: location / PM / dates */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { icon: MapPin,   label: 'Location',        value: proj.location ? proj.location.split(',').slice(-2).join(',').trim() : '—' },
                { icon: User,     label: 'Project Manager', value: proj.projectManager || '—' },
                { icon: Calendar, label: 'Start Date',      value: proj.startDate    ? new Date(proj.startDate).toLocaleDateString('en-GB',    { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                { icon: Calendar, label: 'Completion',      value: proj.completionDate ? new Date(proj.completionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2">
                  <item.icon size={14} className="text-slate-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm text-slate-300 font-medium">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar — driven by values */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-400 font-medium">Overall Progress</span>
                <span className="font-bold text-[#f97316]">{progress}%</span>
              </div>
              <div className="w-full bg-[#0d1628] rounded-full h-2">
                <div className="h-2 rounded-full bg-[#f97316] transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* Editable financial cards */}
            {canEdit && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
                {/* Contract Value — editable */}
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Contract Value</p>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-sm">£</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={bannerContractEdit}
                      onChange={e => setBannerContractEdit(e.target.value)}
                      placeholder={proj.value ? String(parseRawValue(proj.value)) : '0'}
                      className="bg-transparent text-sm font-bold text-white w-full focus:outline-none placeholder-slate-600"
                    />
                  </div>
                </div>
                {/* Completed Value — editable */}
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Completed Value</p>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-sm">£</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={bannerCompletedEdit}
                      onChange={e => setBannerCompletedEdit(e.target.value)}
                      placeholder="0"
                      className="bg-transparent text-sm font-bold text-slate-300 w-full focus:outline-none placeholder-slate-600"
                    />
                  </div>
                </div>
                {/* Variations Value — editable */}
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Variations Value</p>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-sm">£</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={bannerVariationsEdit}
                      onChange={e => setBannerVariationsEdit(e.target.value)}
                      placeholder="0"
                      className="bg-transparent text-sm font-bold text-amber-300 w-full focus:outline-none placeholder-slate-600"
                    />
                  </div>
                </div>
                {/* Progress % — auto-calculated */}
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Progress</p>
                  <p className="text-sm font-bold text-[#f97316]">{progress}%</p>
                  <p className="text-[9px] text-slate-600 mt-0.5">Auto-calculated</p>
                </div>
                {/* Remaining — auto-calculated */}
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Remaining</p>
                  <p className={`text-sm font-bold ${remaining == null ? 'text-slate-500' : remaining < 0 ? 'text-red-400' : remaining < contractNum * 0.1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {remaining != null ? fmtVal(remaining) : '—'}
                  </p>
                  <p className="text-[9px] text-slate-600 mt-0.5">Auto-calculated</p>
                </div>
              </div>
            )}
            {!canEdit && contractNum > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-2">
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Contract Value</p>
                  <p className="text-sm font-bold text-white">{contractNum > 0 ? fmtVal(contractNum) : '—'}</p>
                </div>
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Variations Value</p>
                  <p className="text-sm font-bold text-amber-300">{variationsNum != null ? fmtVal(variationsNum) : '—'}</p>
                </div>
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] border-l-2 border-l-orange-500/50 px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Contract incl. Variations</p>
                  <p className="text-sm font-bold text-orange-300">{contractNum > 0 || variationsNum != null ? fmtVal(contractInclVariations) : '—'}</p>
                </div>
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Completed Value</p>
                  <p className="text-sm font-bold text-slate-300">{completedNum != null ? fmtVal(completedNum) : '—'}</p>
                </div>
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Progress</p>
                  <p className="text-sm font-bold text-[#f97316]">{progress}%</p>
                </div>
                <div className="bg-[#0d1628] rounded-lg border border-[#1e2d4a] px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Remaining</p>
                  <p className={`text-sm font-bold ${remaining == null ? 'text-slate-500' : remaining < 0 ? 'text-red-400' : remaining < contractNum * 0.1 ? 'text-amber-400' : 'text-emerald-400'}`}>{remaining != null ? fmtVal(remaining) : '—'}</p>
                </div>
              </div>
            )}

            {/* Save / export actions */}
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                {isDirty && canEdit && (
                  <button
                    onClick={saveBannerValues}
                    disabled={bannerSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-orange-400 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Save size={12} />{bannerSaving ? 'Saving…' : 'Save Values'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportRegisterSummary(proj, progress, contractNum, completedNum, remaining, filteredRecords)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1628] hover:bg-[#1a2236] border border-[#1e2d4a] text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <FileText size={12} />Register Summary
                </button>
                <button
                  onClick={() => exportFullTickets(proj, progress, contractNum, completedNum, remaining, selectedIds.size > 0 ? filteredRecords.filter(r => selectedIds.has(r.id)) : filteredRecords)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1628] hover:bg-[#1a2236] border border-[#1e2d4a] text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Printer size={12} />{selectedIds.size > 0 ? `Full Export (${selectedIds.size})` : 'Full Export (All)'}
                </button>
              </div>
            </div>
          </div>
        );
      })() : store.projects.length === 0 ? (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] px-5 py-4 mb-6">
          <p className="text-sm text-slate-500">No projects found — create a project first to see its commercial summary here.</p>
        </div>
      ) : null}

      {/* Key Dates Panel — full component, same as Projects */}
      {bannerProject && (
        <div className="mb-6">
          <KeyDatesPanel
            project={bannerProject}
            keyDates={store.keyDates.filter(d => d.project_id === effectiveBannerProjectId)}
            currentUserName={store.currentUser?.name ?? ''}
            onAdd={store.addKeyDate}
            onUpdate={store.updateKeyDate}
            onRemove={store.removeKeyDate}
            collapsible
          />
        </div>
      )}

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
        <div className="grid grid-cols-[32px_120px_1fr_160px_160px_120px_100px] gap-4 px-4 py-3 border-b border-[#1e2d4a] text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="flex items-center">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 rounded border-slate-600 bg-[#0d1628] accent-[#f97316] cursor-pointer"
              checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length}
              onChange={toggleSelectAll}
            />
          </div>
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
            <div
              key={r.id}
              className={`grid grid-cols-[32px_120px_1fr_160px_160px_120px_100px] gap-4 px-4 py-3.5 transition-colors hover:bg-[#1a2236] ${
                i < filteredRecords.length - 1 ? 'border-b border-[#1e2d4a]/60' : ''
              } ${selectedIds.has(r.id) ? 'bg-[#1a2236]/60' : ''}`}
            >
              <div className="flex items-center" onClick={e => { e.stopPropagation(); toggleSelect(r.id); }}>
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-[#0d1628] accent-[#f97316] cursor-pointer"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                />
              </div>
              <button className="text-left" onClick={() => openRecord(r)}><TypeBadge type={r.recordType} /></button>
              <button className="text-left min-w-0" onClick={() => openRecord(r)}>
                <div className="flex items-center gap-2">
                  {r.reference && (
                    <span className="text-xs font-mono text-[#f97316] shrink-0">{r.reference}</span>
                  )}
                  <span className="text-sm text-white font-medium truncate">{r.title || 'Untitled'}</span>
                </div>
              </button>
              <button className="text-left text-sm text-slate-400 truncate" onClick={() => openRecord(r)}>{r.projectName || '—'}</button>
              <button className="text-left text-sm text-slate-400 truncate" onClick={() => openRecord(r)}>{r.client || '—'}</button>
              <button className="text-left" onClick={() => openRecord(r)}><StatusBadge status={r.status} /></button>
              <button className="text-left text-xs text-slate-500" onClick={() => openRecord(r)}>
                {r.dateRaised ? new Date(r.dateRaised).toLocaleDateString('en-GB') : '—'}
              </button>
            </div>
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
