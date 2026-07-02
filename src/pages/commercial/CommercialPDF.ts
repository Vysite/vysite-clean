/**
 * Commercial PDF export helpers.
 * All PDFs share a single CSS sheet and utility functions.
 * Each export function returns an HTML string suitable for openPrintTab().
 */

import { openPrintTab } from '../../lib/printTab';
import type { DBVariationAccountItem, DBCommercialApplication, DBVABuildUpLine, DBVAComment, DBAttachment } from '../../lib/store';
import type { CommercialRecord } from './types';
import { typeInfo, statusInfo, parseRawValue } from './types';
import type { DBKeyDate } from '../../data/types';
import type { Project } from '../../data/types';

// ─── Shared utilities ─────────────────────────────────────────────────────────

export function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function fv(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtD(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB'); } catch { return '—'; }
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────

export const COMM_PDF_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
/* Zero page margins eliminate browser URL / date / title print chrome */
@page { margin: 0; size: A4; }
@media print { html { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
html, body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9pt;
  color: #0f172a;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page { padding: 40px 52px 36px; }

/* ── Executive header ── */
.exec-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  padding-bottom: 14px; border-bottom: 1.5px solid #0f172a; margin-bottom: 28px;
}
.exec-brand { font-size: 10pt; font-weight: 900; letter-spacing: 0.18em; color: #ea6c00; text-transform: uppercase; line-height: 1; }
.exec-brand-sub { font-size: 6.5pt; color: #94a3b8; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3px; }
.exec-head-right { text-align: right; }
.exec-doc-type { font-size: 7pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8; margin-bottom: 3px; }
.exec-doc-title { font-size: 11pt; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }

/* ── Project band ── */
.exec-project-band {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding-bottom: 20px; border-bottom: 0.5px solid #e2e8f0; margin-bottom: 28px;
}
.exec-project-name { font-size: 17pt; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; line-height: 1.1; }
.exec-client { font-size: 9.5pt; color: #64748b; margin-top: 4px; }
.exec-report-date { font-size: 7.5pt; color: #94a3b8; text-align: right; line-height: 1.6; }

/* ── Section label ── */
.exec-section-label {
  font-size: 6.5pt; font-weight: 800; letter-spacing: 0.18em;
  text-transform: uppercase; color: #94a3b8; margin-bottom: 16px;
}

/* ── Primary 2-col financial figures ── */
.fin-primary-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 0; }
.fin-primary-fig { padding: 0 36px 20px 0; }
.fin-primary-fig + .fin-primary-fig { border-left: 0.5px solid #e2e8f0; padding-left: 36px; padding-right: 0; }
.fin-fig-label { font-size: 7pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b; margin-bottom: 7px; }
.fin-fig-xl { font-size: 26pt; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; line-height: 1; }
.fin-fig-xl.accent { color: #ea6c00; }

/* ── Exposure / shortfall highlighted band ── */
.exposure-band {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 20px; border-left: 3px solid #ea6c00; background: #fff7ed; margin: 16px 0 20px;
}
.exposure-band.zero { border-left-color: #16a34a; background: #f0fdf4; }
.exposure-label { font-size: 7pt; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #92400e; }
.exposure-band.zero .exposure-label { color: #166534; }
.exposure-sub { font-size: 7pt; color: #a16207; margin-top: 2px; }
.exposure-band.zero .exposure-sub { color: #166534; }
.exposure-value { font-size: 22pt; font-weight: 700; color: #ea6c00; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.exposure-band.zero .exposure-value { color: #16a34a; }

/* ── Secondary 3-col figures ── */
.fin-secondary-row {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0;
  padding: 16px 0; border-top: 0.5px solid #e2e8f0; border-bottom: 0.5px solid #e2e8f0; margin-bottom: 16px;
}
.fin-sec-fig { padding-right: 24px; }
.fin-sec-fig + .fin-sec-fig { border-left: 0.5px solid #e2e8f0; padding-left: 24px; }
.fin-sec-fig:last-child { padding-right: 0; }
.fin-sec-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
.fin-sec-value { font-size: 15pt; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.fin-sec-value.warn { color: #b45309; }

/* ── Remaining / total band ── */
.fin-remaining-band {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 14px 0 13px; border-bottom: 1.5px solid #0f172a; margin-bottom: 24px;
}
.fin-remaining-label { font-size: 9.5pt; font-weight: 700; color: #0f172a; }
.fin-remaining-value { font-size: 22pt; font-weight: 700; color: #ea6c00; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }

/* ── Financial statement waterfall (contract sum cascade) ── */
.fin-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.fin-row td { padding: 7px 0; vertical-align: baseline; }
.fin-row td:last-child { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fin-label { font-size: 9pt; color: #334155; padding-right: 16px; }
.fin-sub { font-size: 7.5pt; color: #94a3b8; display: block; margin-top: 1px; }
.fin-value { font-size: 9.5pt; font-weight: 600; color: #0f172a; }
.fin-rule td { border-top: 0.5px solid #e2e8f0; padding-top: 0; height: 8px; }
.fin-total td { padding: 9px 0 11px; border-top: 0.75px solid #0f172a; }
.fin-total .fin-label { font-size: 9.5pt; font-weight: 700; color: #0f172a; }
.fin-total .fin-value { font-size: 13pt; font-weight: 700; color: #ea6c00; letter-spacing: -0.01em; }
.fin-accent .fin-label { color: #92400e; }
.fin-accent .fin-value { color: #b45309; }

/* ── Project meta strip ── */
.proj-meta { display: flex; flex-wrap: wrap; gap: 0 32px; padding: 14px 0; border-top: 0.5px solid #e2e8f0; border-bottom: 0.5px solid #e2e8f0; margin-bottom: 24px; }
.proj-meta-item { min-width: 120px; margin-bottom: 8px; }
.proj-meta-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-bottom: 2px; }
.proj-meta-value { font-size: 8.5pt; font-weight: 600; color: #334155; }

/* ── Data table (VA schedule, compact register) ── */
.data-table { width: 100%; border-collapse: collapse; }
.data-table thead th {
  font-size: 6.5pt; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b;
  padding: 0 12px 12px 0; text-align: left; border-bottom: 1.5px solid #0f172a; white-space: nowrap; vertical-align: bottom;
}
.data-table thead th.r { text-align: right; padding-right: 0; padding-left: 12px; }
.data-table thead th.muted { color: #94a3b8; }
.data-table tbody td {
  font-size: 8.5pt; color: #1e293b; padding: 12px 12px 11px 0; border-bottom: 0.5px solid #f1f5f9; vertical-align: top;
}
.data-table tbody td.r { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; padding-right: 0; padding-left: 12px; }
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tfoot td { padding: 11px 12px 10px 0; border-top: 1.5px solid #0f172a; font-size: 8.5pt; font-weight: 700; }
.data-table tfoot td.r { text-align: right; padding-right: 0; padding-left: 12px; font-variant-numeric: tabular-nums; }
.dt-ref { font-size: 9pt; font-weight: 800; color: #ea6c00; letter-spacing: -0.01em; }
.dt-title { font-weight: 700; color: #0f172a; line-height: 1.3; }
.dt-muted { color: #64748b; font-size: 8pt; }
.dt-val-pos { color: #166534; font-weight: 700; font-variant-numeric: tabular-nums; }
.dt-val-neg { color: #991b1b; font-weight: 700; font-variant-numeric: tabular-nums; }

/* ── Register record entry ── */
.record-entry { padding: 16px 0; border-bottom: 0.5px solid #f1f5f9; page-break-inside: avoid; }
.record-entry:last-child { border-bottom: none; }
.record-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
.record-ref { font-size: 9pt; font-weight: 800; color: #ea6c00; margin-right: 10px; letter-spacing: -0.01em; }
.record-title { font-size: 10pt; font-weight: 700; color: #0f172a; line-height: 1.3; }
.record-badges { display: flex; gap: 6px; align-items: center; flex-shrink: 0; margin-left: 12px; }
.record-meta { font-size: 7.5pt; color: #64748b; margin-top: 6px; display: flex; gap: 20px; flex-wrap: wrap; line-height: 1.4; }
.record-meta-key { color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 6.5pt; margin-right: 4px; }
.record-notes { font-size: 8.5pt; color: #475569; margin-top: 8px; padding-top: 8px; border-top: 0.5px solid #f1f5f9; line-height: 1.5; white-space: pre-wrap; }

/* ── Register summary bar ── */
.register-summary { display: flex; gap: 28px; padding: 14px 0; border-top: 0.5px solid #e2e8f0; border-bottom: 0.5px solid #e2e8f0; margin-bottom: 24px; }
.reg-sum-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-bottom: 3px; }
.reg-sum-value { font-size: 13pt; font-weight: 700; color: #0f172a; }
.reg-sum-value.accent { color: #ea6c00; }

/* ── Timeline ── */
.tl-wrap { padding-left: 8px; }
.tl-entry { display: flex; gap: 20px; margin-bottom: 0; page-break-inside: avoid; }
.tl-left { text-align: right; min-width: 90px; padding-top: 2px; flex-shrink: 0; }
.tl-date { font-size: 8.5pt; color: #64748b; font-weight: 500; }
.tl-right { flex: 1; padding-bottom: 18px; border-left: 1px solid #e2e8f0; padding-left: 20px; position: relative; }
.tl-right::before { content: ''; position: absolute; left: -4.5px; top: 5px; width: 8px; height: 8px; border-radius: 50%; background: var(--dot-color, #94a3b8); }
.tl-kind { font-size: 6.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; margin-bottom: 3px; }
.tl-title { font-size: 9.5pt; font-weight: 600; color: #0f172a; margin-bottom: 3px; line-height: 1.3; }
.tl-ref { font-size: 8.5pt; color: #ea6c00; margin-right: 6px; font-weight: 700; }
.tl-val { font-size: 8.5pt; font-weight: 700; margin-left: 8px; font-variant-numeric: tabular-nums; }
.tl-sub { font-size: 8pt; color: #94a3b8; }
.tl-entry:last-child .tl-right { border-left-color: transparent; }
.tl-summary-item { flex: 1; padding-right: 20px; }
.tl-summary-value { font-size: 18pt; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
.tl-summary-label { font-size: 6.5pt; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-top: 2px; }

/* ── Key dates ── */
.kd-table { width: 100%; border-collapse: collapse; }
.kd-table th {
  font-size: 6.5pt; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b;
  padding: 0 12px 10px 0; text-align: left; border-bottom: 1.5px solid #0f172a; white-space: nowrap;
}
.kd-table td { padding: 10px 12px 9px 0; border-bottom: 0.5px solid #f1f5f9; font-size: 8.5pt; vertical-align: top; }
.kd-table tr:last-child td { border-bottom: none; }
.kd-date { color: #64748b; width: 80px; white-space: nowrap; font-size: 8pt; }
.kd-title { font-weight: 700; color: #0f172a; }
.kd-desc { color: #64748b; padding-left: 12px; font-size: 8pt; }
.kd-status { width: 70px; text-align: right; }
.kd-days { width: 90px; text-align: right; color: #94a3b8; font-size: 8pt; }

/* ── Status tags / pills ── */
.tag { font-size: 6.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 7px 3px; border-radius: 3px; white-space: nowrap; display: inline-block; }
.tag-green  { background: #f0fdf4; color: #166534; }
.tag-amber  { background: #fffbeb; color: #92400e; }
.tag-orange { background: #fff7ed; color: #c2410c; }
.tag-blue   { background: #eff6ff; color: #1e40af; }
.tag-red    { background: #fef2f2; color: #991b1b; }
.tag-slate  { background: #f8fafc; color: #475569; }

/* ── Footer ── */
.doc-footer { margin-top: 44px; padding-top: 10px; border-top: 0.5px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
.doc-footer-l { font-size: 7pt; color: #94a3b8; }
.doc-footer-r { font-size: 7pt; color: #94a3b8; text-align: right; }

/* ── Page break ── */
.page-break { page-break-before: always; padding-top: 40px; }

/* ── Full report cover ── */
.fr-cover { padding-bottom: 28px; border-bottom: 1.5px solid #0f172a; margin-bottom: 28px; }
.fr-cover-brand { font-size: 10pt; font-weight: 900; letter-spacing: 0.18em; color: #ea6c00; text-transform: uppercase; margin-bottom: 48px; }
.fr-cover-label { font-size: 6.5pt; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #94a3b8; margin-bottom: 12px; }
.fr-cover-title { font-size: 28pt; font-weight: 700; color: #0f172a; line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 24px; }
.fr-cover-project { font-size: 15pt; font-weight: 700; color: #0f172a; margin-bottom: 4px; letter-spacing: -0.01em; }
.fr-cover-client { font-size: 10pt; color: #64748b; margin-bottom: 36px; }
.fr-cover-figures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border-top: 0.5px solid #e2e8f0; border-bottom: 0.5px solid #e2e8f0; padding: 18px 0; margin-bottom: 24px; }
.fr-cover-fig { padding-right: 24px; }
.fr-cover-fig + .fr-cover-fig { border-left: 0.5px solid #e2e8f0; padding-left: 24px; }
.fr-cover-fig:last-child { padding-right: 0; }
.fr-cover-fig-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
.fr-cover-fig-value { font-size: 16pt; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.fr-cover-fig-value.accent { color: #ea6c00; }
.fr-cover-date { font-size: 7.5pt; color: #94a3b8; }

/* ── Empty notice ── */
.empty-notice { padding: 20px 0; text-align: center; color: #94a3b8; font-size: 9pt; border-top: 0.5px solid #f1f5f9; }
`;

// ─── Shared page shell ────────────────────────────────────────────────────────

function pageShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>${COMM_PDF_CSS}</style>
<script>window.onload=function(){window.print();};<\/script>
</head>
<body>
<div class="page">
${body}
</div>
</body>
</html>`;
}

// ─── Shared header ────────────────────────────────────────────────────────────

function docHeader(docType: string, title: string, _projectName: string, _client?: string, _today?: string, logoUrl?: string): string {
  const brandHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="height:36px;max-width:160px;object-fit:contain;display:block;margin-bottom:4px">`
    : `<div class="exec-brand">VYSITE</div><div class="exec-brand-sub">Construction Operating System</div>`;
  return `<div class="exec-head">
  <div>${brandHtml}</div>
  <div class="exec-head-right">
    <div class="exec-doc-type">${esc(docType)}</div>
    <div class="exec-doc-title">${esc(title)}</div>
  </div>
</div>`;
}

// ─── Shared footer ────────────────────────────────────────────────────────────

function docFooter(generatedBy: string, today: string): string {
  return `<div class="doc-footer">
  <div class="doc-footer-l">Confidential &mdash; VYSITE Commercial Document</div>
  <div class="doc-footer-r">${esc(generatedBy || 'VYSITE')} &bull; ${today}</div>
</div>`;
}

// ─── Status tag helper ────────────────────────────────────────────────────────

function statusTag(s: string, label: string): string {
  const cls = (['agreed','added_to_valuation','paid','complete'].includes(s)) ? 'tag-green'
    : (s === 'submitted') ? 'tag-blue'
    : (s === 'awaiting_agreement' || s === 'under_review' || s === 'certified') ? 'tag-amber'
    : (s === 'part_paid') ? 'tag-orange'
    : (s === 'rejected' || s === 'overdue' || s === 'disputed') ? 'tag-red'
    : 'tag-slate';
  return `<span class="tag ${cls}">${esc(label)}</span>`;
}

function typeTag(t: string, label: string): string {
  const cls = t === 'variation' ? 'tag-orange' : t === 'delay_notice' ? 'tag-amber' : t === 'compensation_event' ? 'tag-blue' : 'tag-slate';
  return `<span class="tag ${cls}">${esc(label)}</span>`;
}

const APP_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', certified: 'Certified',
  part_paid: 'Part Paid', paid: 'Paid', overdue: 'Overdue',
  disputed: 'Disputed', withdrawn: 'Withdrawn',
};

// ─── Financial statement ───────────────────────────────────────────────────────

interface StatRow { label: string; sub?: string; value: string; style?: 'normal' | 'total' | 'accent'; }

function finStatement(rows: StatRow[]): string {
  const rowHtml = rows.map(r => {
    if (r.style === 'total') {
      return `<tr class="fin-total"><td class="fin-label">${esc(r.label)}</td><td class="fin-value">${r.value}</td></tr>`;
    }
    const sub = r.sub ? `<span class="fin-sub">${esc(r.sub)}</span>` : '';
    const accentClass = r.style === 'accent' ? ' fin-accent' : '';
    return `<tr class="fin-row${accentClass}"><td class="fin-label">${esc(r.label)}${sub}</td><td class="fin-value">${r.value}</td></tr>`;
  });
  // Insert thin rules before totals
  const withRules: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].style === 'total' && i > 0 && rows[i - 1].style !== 'total') {
      withRules.push(`<tr class="fin-rule"><td colspan="2"></td></tr>`);
    }
    withRules.push(rowHtml[i]);
  }
  return `<table class="fin-table">${withRules.join('')}</table>`;
}

// ─── Key dates ────────────────────────────────────────────────────────────────

function keyDatesTable(keyDates: DBKeyDate[]): string {
  if (!keyDates.length) return `<div class="empty-notice">No key dates recorded for this project.</div>`;
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const sorted = [...keyDates].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const rows = sorted.map(d => {
    const isOverdue = d.status === 'Open' && d.date && new Date(d.date) < todayMidnight;
    const label = d.status === 'Closed' ? 'Closed' : isOverdue ? 'Overdue' : 'Open';
    const diff  = d.date && d.status === 'Open' ? Math.round((new Date(d.date).getTime() - todayMidnight.getTime()) / 86400000) : null;
    const dr    = diff === null ? '' : diff === 0 ? 'Today' : diff < 0 ? `${Math.abs(diff)}d overdue` : `${diff}d remaining`;
    const tagCls = d.status === 'Closed' ? 'tag-green' : isOverdue ? 'tag-red' : 'tag-amber';
    return `<tr>
      <td class="kd-date">${fmtD(d.date)}</td>
      <td class="kd-title">${esc(d.title)}</td>
      <td class="kd-desc">${d.description ? esc(d.description) : ''}</td>
      <td class="kd-status"><span class="tag ${tagCls}">${label}</span></td>
      <td class="kd-days">${dr}</td>
    </tr>`;
  }).join('');
  const thead = `<thead><tr>
    <th class="kd-date">Date</th>
    <th>Title</th>
    <th class="kd-desc">Description</th>
    <th class="kd-status">Status</th>
    <th class="kd-days">Days</th>
  </tr></thead>`;
  return `<table class="kd-table">${thead}<tbody>${rows}</tbody></table>`;
}

// ─── Position statement body ──────────────────────────────────────────────────

interface PositionData {
  project: Project;
  keyDates: DBKeyDate[];
  contractNum: number;
  completedNum: number | null;
  variationExposure: number;
  agreedVariations: number;
  currentUserName: string;
  logoUrl?: string;
}

function positionStatementBody(d: PositionData): string {
  const today = todayStr();
  const forecastContractSum = d.contractNum + d.variationExposure;
  const adjustedContractSum = d.contractNum + d.agreedVariations;
  const remainingValue = d.completedNum != null ? adjustedContractSum - d.completedNum : null;

  const metaItems: [string, string][] = [
    ['Project Manager', d.project.projectManager || '—'],
    ['Location',        d.project.location       || '—'],
    ['Start Date',      fmtD(d.project.startDate)],
    ['Completion',      fmtD(d.project.completionDate)],
    ['Status',          d.project.status         || '—'],
  ];

  return `
  ${docHeader('Commercial Document', 'Commercial Position Statement', d.project.name, d.project.client, today, d.logoUrl)}
  <div class="exec-project-band">
    <div>
      <div class="exec-project-name">${esc(d.project.name)}</div>
      ${d.project.client ? `<div class="exec-client">${esc(d.project.client)}</div>` : ''}
    </div>
    <div class="exec-report-date">
      <div>${today}</div>
      <div>Prepared by ${esc(d.currentUserName || 'VYSITE')}</div>
    </div>
  </div>

  <div class="exec-section-label">Commercial Position</div>

  <div class="fin-primary-row">
    <div class="fin-primary-fig">
      <div class="fin-fig-label">Original Contract Sum</div>
      <div class="fin-fig-xl">${d.contractNum > 0 ? fv(d.contractNum) : '—'}</div>
    </div>
    <div class="fin-primary-fig">
      <div class="fin-fig-label">Forecast Contract Sum</div>
      <div class="fin-fig-xl accent">${d.contractNum > 0 ? fv(forecastContractSum) : '—'}</div>
    </div>
  </div>

  ${d.variationExposure > 0 ? `
  <div class="exposure-band">
    <div>
      <div class="exposure-label">Outstanding Variation Exposure</div>
      <div class="exposure-sub">Submitted &amp; Under Review &mdash; not yet agreed</div>
    </div>
    <div class="exposure-value">+${fv(d.variationExposure)}</div>
  </div>` : ''}

  ${d.agreedVariations !== 0 || adjustedContractSum !== forecastContractSum ? `<div style="margin-top:16px;">
  ${finStatement([
    { label: 'Agreed Variations', value: d.agreedVariations !== 0 ? '+' + fv(d.agreedVariations) : fv(0) },
    { label: 'Adjusted Contract Sum', value: d.contractNum > 0 ? fv(adjustedContractSum) : '—', style: 'total' },
  ])}</div>` : ''}

  ${d.completedNum != null ? `
  <div class="fin-secondary-row" style="margin-top:16px;">
    <div class="fin-sec-fig">
      <div class="fin-sec-label">Completed / Certified Value</div>
      <div class="fin-sec-value">${fv(d.completedNum)}</div>
    </div>
    ${remainingValue != null ? `
    <div class="fin-sec-fig">
      <div class="fin-sec-label">Remaining Value</div>
      <div class="fin-sec-value${remainingValue < 0 ? ' warn' : ''}">${fv(remainingValue)}</div>
    </div>` : ''}
  </div>` : ''}

  <div class="proj-meta">
    ${metaItems.map(([k, v]) => `<div class="proj-meta-item"><div class="proj-meta-label">${esc(k)}</div><div class="proj-meta-value">${esc(v)}</div></div>`).join('')}
  </div>

  ${d.keyDates.length > 0 ? `
  <div class="exec-section-label">Key Dates</div>
  ${keyDatesTable(d.keyDates)}` : ''}

  ${docFooter(d.currentUserName, today)}`;
}

// ─── Register body ────────────────────────────────────────────────────────────

interface RegisterData {
  project: Project | null;
  records: CommercialRecord[];
  currentUserName: string;
  logoUrl?: string;
}

function registerBody(d: RegisterData): string {
  const today = todayStr();
  const projName = d.project?.name ?? 'All Projects';

  const byType = {
    variation:          d.records.filter(r => r.recordType === 'variation').length,
    delay_notice:       d.records.filter(r => r.recordType === 'delay_notice').length,
    compensation_event: d.records.filter(r => r.recordType === 'compensation_event').length,
  };
  const agreedCount  = d.records.filter(r => ['agreed','added_to_valuation','paid','complete'].includes(r.status)).length;
  const pendingCount = d.records.filter(r => ['submitted','awaiting_agreement','under_review'].includes(r.status)).length;
  const rejectedCount = d.records.filter(r => r.status === 'rejected').length;

  const entries = d.records.map(r => {
    const ti = typeInfo(r.recordType);
    const si = statusInfo(r.status);
    const dateMeta: string[] = [];
    if (r.dateRaised)    dateMeta.push(`Raised ${fmtD(r.dateRaised)}`);
    if (r.dateSubmitted) dateMeta.push(`Submitted ${fmtD(r.dateSubmitted)}`);
    if (r.dateAgreed)    dateMeta.push(`Agreed ${fmtD(r.dateAgreed)}`);
    return `<div class="record-entry">
      <div class="record-header">
        <div>
          <span class="record-ref">${esc(r.reference || '—')}</span>
          <span class="record-title">${esc(r.title || 'Untitled')}</span>
        </div>
        <div class="record-badges">
          ${typeTag(r.recordType, ti.label)}
          ${statusTag(r.status, si.label)}
        </div>
      </div>
      <div class="record-meta">
        ${r.createdBy ? `<span><span class="record-meta-key">By</span>${esc(r.createdBy)}</span>` : ''}
        ${dateMeta.length ? `<span>${dateMeta.join(' &bull; ')}</span>` : ''}
        ${(r as any).description ? `<span>${esc(((r as any).description as string).substring(0, 120))}${((r as any).description as string).length > 120 ? '…' : ''}</span>` : ''}
      </div>
      ${r.notes ? `<div class="record-notes">${esc(r.notes)}</div>` : ''}
    </div>`;
  }).join('');

  return `
  ${docHeader('Commercial Document', 'Commercial Register', projName, d.project?.client, today, d.logoUrl)}
  <div class="exec-project-band">
    <div>
      <div class="exec-project-name">${esc(projName)}</div>
      ${d.project?.client ? `<div class="exec-client">${esc(d.project.client)}</div>` : ''}
    </div>
    <div class="exec-report-date">
      <div>${today}</div>
      <div>Prepared by ${esc(d.currentUserName || 'VYSITE')}</div>
    </div>
  </div>

  <div class="register-summary">
    <div><div class="reg-sum-label">Total Records</div><div class="reg-sum-value accent">${d.records.length}</div></div>
    ${byType.variation > 0          ? `<div><div class="reg-sum-label">Variations</div><div class="reg-sum-value">${byType.variation}</div></div>` : ''}
    ${byType.delay_notice > 0       ? `<div><div class="reg-sum-label">Delay Notices</div><div class="reg-sum-value">${byType.delay_notice}</div></div>` : ''}
    ${byType.compensation_event > 0 ? `<div><div class="reg-sum-label">Comp. Events</div><div class="reg-sum-value">${byType.compensation_event}</div></div>` : ''}
    ${agreedCount > 0   ? `<div><div class="reg-sum-label">Agreed / Complete</div><div class="reg-sum-value">${agreedCount}</div></div>` : ''}
    ${pendingCount > 0  ? `<div><div class="reg-sum-label">Pending</div><div class="reg-sum-value">${pendingCount}</div></div>` : ''}
    ${rejectedCount > 0 ? `<div><div class="reg-sum-label">Rejected</div><div class="reg-sum-value">${rejectedCount}</div></div>` : ''}
  </div>

  <div class="exec-section-label">Commercial Records &mdash; ${d.records.length} record${d.records.length !== 1 ? 's' : ''}</div>
  ${d.records.length === 0 ? '<div class="empty-notice">No commercial records found for this project.</div>' : entries}

  ${docFooter(d.currentUserName, today)}`;
}

// ─── Variation Account body ───────────────────────────────────────────────────

interface VAData {
  project: Project | null;
  items: DBVariationAccountItem[];
  forecastContractSum: number;
  adjustedContractSum: number;
  vaExposure: number;
  vaAgreed: number;
  currentUserName: string;
  logoUrl?: string;
}

function variationAccountBody(d: VAData): string {
  const today = todayStr();
  const projName = d.project?.name ?? '—';

  const vaStatusLabels: Record<string, string> = {
    draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
    agreed: 'Agreed', rejected: 'Rejected', paid: 'Paid', withdrawn: 'Withdrawn',
  };

  const rows = d.items.map(item => {
    const val = item.is_positive ? item.value : -item.value;
    const desc = (item.description || '').substring(0, 80);
    return `<tr>
      <td><span class="dt-ref">${esc(item.reference || '—')}</span></td>
      <td>
        <div class="dt-title">${esc(item.title || 'Untitled')}</div>
        ${desc ? `<div class="dt-muted" style="margin-top:2px;">${esc(desc)}${(item.description || '').length > 80 ? '…' : ''}</div>` : ''}
      </td>
      <td><span class="dt-muted">${esc(item.reason || '—')}</span></td>
      <td class="r"><span class="${val >= 0 ? 'dt-val-pos' : 'dt-val-neg'}">${val >= 0 ? '+' : ''}${fv(val)}</span></td>
      <td>${statusTag(item.status, vaStatusLabels[item.status] || item.status)}</td>
      <td><span class="dt-muted">${fmtD(item.date_raised)}</span></td>
      <td><span class="dt-muted">${fmtD(item.date_agreed)}</span></td>
    </tr>`;
  }).join('');

  return `
  ${docHeader('Commercial Document', 'Variation Account', projName, d.project?.client, today, d.logoUrl)}
  <div class="exec-project-band">
    <div>
      <div class="exec-project-name">${esc(projName)}</div>
      ${d.project?.client ? `<div class="exec-client">${esc(d.project.client)}</div>` : ''}
    </div>
    <div class="exec-report-date">
      <div>${today}</div>
      <div>Prepared by ${esc(d.currentUserName || 'VYSITE')}</div>
    </div>
  </div>

  <div class="exec-section-label">Account Position</div>

  <div class="fin-primary-row">
    <div class="fin-primary-fig">
      <div class="fin-fig-label">Forecast Contract Sum</div>
      <div class="fin-fig-xl">${d.forecastContractSum > 0 ? fv(d.forecastContractSum) : '—'}</div>
    </div>
    <div class="fin-primary-fig">
      <div class="fin-fig-label">Adjusted Contract Sum</div>
      <div class="fin-fig-xl accent">${d.adjustedContractSum > 0 ? fv(d.adjustedContractSum) : '—'}</div>
    </div>
  </div>

  ${d.vaExposure > 0 ? `
  <div class="exposure-band">
    <div>
      <div class="exposure-label">Outstanding Variation Exposure</div>
      <div class="exposure-sub">Submitted &amp; Under Review &mdash; not yet agreed</div>
    </div>
    <div class="exposure-value">+${fv(d.vaExposure)}</div>
  </div>` : ''}

  <div style="margin-top:16px;">
  ${finStatement([
    { label: 'Agreed Variations', value: fv(d.vaAgreed) },
    { label: 'Adjusted Contract Sum', value: d.adjustedContractSum > 0 ? fv(d.adjustedContractSum) : '—', style: 'total' },
  ])}
  </div>

  ${d.items.length > 0 ? `
  <div class="exec-section-label" style="margin-top:28px;">Variation Account Schedule &mdash; ${d.items.length} item${d.items.length !== 1 ? 's' : ''}</div>
  <table class="data-table">
    <thead><tr>
      <th style="width:60px">Ref</th>
      <th>Title / Description</th>
      <th>Reason / Cause</th>
      <th class="r">Value</th>
      <th>Status</th>
      <th style="width:72px">Raised</th>
      <th style="width:72px">Agreed</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>` : '<div class="empty-notice">No variation account items recorded for this project.</div>'}

  ${docFooter(d.currentUserName, today)}`;
}

// ─── Applications body ────────────────────────────────────────────────────────

interface ApplicationsData {
  project: Project | null;
  apps: DBCommercialApplication[];
  forecastContractSum: number;
  currentUserName: string;
}

// Dedicated CSS for the Applications PDF — injected into its own page shell
const APPLICATIONS_PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  /* Zero margins eliminate all browser print chrome (URL, date, page number) */
  @page { margin: 0; size: A4; }
  @media print {
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  html, body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 9pt;
    color: #0f172a;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Suppress browser chrome ─────────────────────────────────────────────── */
  @media print {
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  /* ── Page 1: Executive Commercial Summary ───────────────────────────────── */
  .exec-page {
    padding: 40px 52px 36px;
  }
  .exec-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding-bottom: 14px;
    border-bottom: 1.5px solid #0f172a;
    margin-bottom: 28px;
  }
  .exec-brand { font-size: 10pt; font-weight: 900; letter-spacing: 0.18em; color: #ea6c00; text-transform: uppercase; line-height: 1; }
  .exec-brand-sub { font-size: 6.5pt; color: #94a3b8; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3px; }
  .exec-head-right { text-align: right; }
  .exec-doc-type { font-size: 7pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8; margin-bottom: 3px; }
  .exec-doc-title { font-size: 11pt; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
  .exec-project-band {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 20px;
    border-bottom: 0.5px solid #e2e8f0;
    margin-bottom: 28px;
  }
  .exec-project-name { font-size: 17pt; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; line-height: 1.1; }
  .exec-client { font-size: 9.5pt; color: #64748b; margin-top: 4px; }
  .exec-report-date { font-size: 7.5pt; color: #94a3b8; text-align: right; line-height: 1.6; }
  .exec-section-label {
    font-size: 6.5pt;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #94a3b8;
    margin-bottom: 16px;
  }
  /* Applied + Certified: primary 2-col figures */
  .primary-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 0; }
  .primary-fig { padding: 0 36px 20px 0; }
  .primary-fig + .primary-fig { border-left: 0.5px solid #e2e8f0; padding-left: 36px; padding-right: 0; }
  .fig-label { font-size: 7pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b; margin-bottom: 7px; }
  .fig-value { font-size: 26pt; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; line-height: 1; }
  .fig-value.accent { color: #ea6c00; }
  /* Certification Shortfall: hero highlighted band */
  .shortfall-band {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 13px 20px;
    border-left: 3px solid #ea6c00;
    background: #fff7ed;
    margin: 16px 0 20px;
  }
  .shortfall-band.zero { border-left-color: #16a34a; background: #f0fdf4; }
  .shortfall-band-left {}
  .shortfall-label { font-size: 7pt; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #92400e; }
  .shortfall-band.zero .shortfall-label { color: #166534; }
  .shortfall-sub { font-size: 7pt; color: #a16207; margin-top: 2px; }
  .shortfall-band.zero .shortfall-sub { color: #166534; }
  .shortfall-value { font-size: 22pt; font-weight: 700; color: #ea6c00; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .shortfall-band.zero .shortfall-value { color: #16a34a; }
  /* Paid, Outstanding, Retention: secondary 3-col */
  .secondary-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0;
    padding: 16px 0;
    border-top: 0.5px solid #e2e8f0;
    border-bottom: 0.5px solid #e2e8f0;
    margin-bottom: 16px;
  }
  .sec-fig { padding-right: 24px; }
  .sec-fig + .sec-fig { border-left: 0.5px solid #e2e8f0; padding-left: 24px; }
  .sec-fig:last-child { padding-right: 0; }
  .sec-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
  .sec-value { font-size: 15pt; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .sec-value.warn { color: #b45309; }
  /* Remaining Contract Value: strong bottom total */
  .remaining-band {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 14px 0 13px;
    border-bottom: 1.5px solid #0f172a;
    margin-bottom: 24px;
  }
  .remaining-label { font-size: 9.5pt; font-weight: 700; color: #0f172a; }
  .remaining-value { font-size: 22pt; font-weight: 700; color: #ea6c00; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  /* Application metadata strip */
  .app-meta-strip { display: flex; gap: 32px; padding: 10px 0 0; }
  .app-meta-item {}
  .app-meta-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-bottom: 2px; }
  .app-meta-value { font-size: 8.5pt; font-weight: 600; color: #334155; }

  /* ── Body page ───────────────────────────────────────────────────────────── */
  .body-page {
    padding: 40px 52px 36px;
  }

  /* ── Page header (running head on body pages) ────────────────────────────── */
  .page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding-bottom: 14px;
    border-bottom: 1px solid #0f172a;
    margin-bottom: 40px;
  }
  .page-head-left {}
  .page-head-wordmark {
    font-size: 9pt;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: #ea6c00;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .page-head-doc {
    font-size: 8pt;
    font-weight: 700;
    color: #0f172a;
  }
  .page-head-right {
    text-align: right;
  }
  .page-head-project {
    font-size: 9pt;
    font-weight: 700;
    color: #0f172a;
  }
  .page-head-client {
    font-size: 8pt;
    color: #64748b;
    margin-top: 2px;
  }

  /* ── Section ─────────────────────────────────────────────────────────────── */
  .section {
    margin-bottom: 44px;
  }
  .section-head {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 20px;
  }
  .section-number {
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #94a3b8;
    flex-shrink: 0;
  }
  .section-title {
    font-size: 11pt;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }

  /* ── Summary position (two-column financial layout) ─────────────────────── */
  .summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
  .summary-col {
    padding-right: 40px;
  }
  .summary-col + .summary-col {
    padding-left: 40px;
    padding-right: 0;
    border-left: 1px solid #e2e8f0;
  }
  .summary-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #f8fafc;
  }
  .summary-row.total-row {
    border-bottom: none;
    padding-top: 12px;
    margin-top: 4px;
    border-top: 1px solid #0f172a;
  }
  .summary-label {
    font-size: 9pt;
    color: #334155;
    padding-right: 16px;
  }
  .summary-value {
    font-size: 9.5pt;
    font-weight: 600;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .summary-value.warn {
    color: #b45309;
  }
  .summary-value.danger {
    color: #991b1b;
  }
  .summary-label.total-label {
    font-size: 9.5pt;
    font-weight: 700;
    color: #0f172a;
  }
  .summary-value.total-value {
    font-size: 14pt;
    font-weight: 700;
    color: #ea6c00;
  }

  /* ── Full-width total band ───────────────────────────────────────────────── */
  .total-band {
    grid-column: 1 / -1;
    margin-top: 24px;
    padding: 16px 0 14px;
    border-top: 1px solid #0f172a;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .total-band-label {
    font-size: 10pt;
    font-weight: 700;
    color: #0f172a;
  }
  .total-band-value {
    font-size: 18pt;
    font-weight: 700;
    color: #ea6c00;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  /* ── Application schedule table ─────────────────────────────────────────── */
  .sched-table {
    width: 100%;
    border-collapse: collapse;
  }
  .sched-table thead th {
    font-size: 6.5pt;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #64748b;
    padding: 0 12px 12px 0;
    text-align: left;
    border-bottom: 1.5px solid #0f172a;
    white-space: nowrap;
    vertical-align: bottom;
  }
  .sched-table thead th.r { text-align: right; padding-right: 0; padding-left: 12px; }
  .sched-table thead th.secondary { color: #94a3b8; }
  .sched-table tbody td {
    font-size: 8.5pt;
    color: #1e293b;
    padding: 13px 12px 12px 0;
    border-bottom: 0.5px solid #f1f5f9;
    vertical-align: top;
  }
  .sched-table tbody td.r {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    padding-right: 0;
    padding-left: 12px;
    vertical-align: top;
  }
  .sched-table tbody tr:last-child td { border-bottom: none; }
  /* App number cell */
  .sched-app-num {
    font-size: 9.5pt;
    font-weight: 800;
    color: #ea6c00;
    letter-spacing: -0.01em;
    line-height: 1.4;
  }
  /* Period cell */
  .sched-period { font-size: 9pt; font-weight: 700; color: #0f172a; line-height: 1.3; }
  .sched-date { font-size: 7.5pt; color: #94a3b8; margin-top: 2px; }
  /* Value cells — primary (applied/certified) vs secondary (paid/retention) */
  .val-primary { color: #0f172a; font-size: 8.5pt; }
  .val-secondary { color: #64748b; font-size: 8.5pt; font-weight: 400; }
  .val-outstanding { color: #b45309; font-weight: 700; font-size: 8.5pt; }
  /* Date cells */
  .sched-date-cell { font-size: 7.5pt; color: #94a3b8; padding-left: 12px; }

  /* Totals footer */
  .sched-table tfoot td {
    border-top: 1.5px solid #0f172a;
    border-bottom: none;
    padding: 12px 12px 10px 0;
    font-size: 8.5pt;
    font-weight: 700;
    color: #0f172a;
    vertical-align: baseline;
  }
  .sched-table tfoot td.r {
    text-align: right;
    padding-right: 0;
    padding-left: 12px;
    font-variant-numeric: tabular-nums;
  }
  .tfoot-total { font-size: 10pt; font-weight: 700; color: #ea6c00; }
  .tfoot-label { font-size: 7.5pt; color: #64748b; font-weight: 400; margin-top: 2px; }

  /* ── Status pill ─────────────────────────────────────────────────────────── */
  .pill {
    display: inline-block;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 3px;
    white-space: nowrap;
  }
  .pill-green  { background: #f0fdf4; color: #166534; }
  .pill-blue   { background: #eff6ff; color: #1e40af; }
  .pill-amber  { background: #fffbeb; color: #92400e; }
  .pill-orange { background: #fff7ed; color: #c2410c; }
  .pill-red    { background: #fef2f2; color: #991b1b; }
  .pill-slate  { background: #f8fafc; color: #475569; }

  /* ── Footer ──────────────────────────────────────────────────────────────── */
  .doc-footer {
    margin-top: 56px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .doc-footer-l { font-size: 7.5pt; color: #94a3b8; }
  .doc-footer-r { font-size: 7.5pt; color: #94a3b8; text-align: right; }

  .empty-state {
    padding: 28px 0;
    color: #94a3b8;
    font-size: 9pt;
    text-align: center;
  }
`;

function applicationsPillCls(status: string): string {
  if (['paid'].includes(status))                              return 'pill-green';
  if (status === 'certified')                                 return 'pill-amber';
  if (status === 'submitted')                                 return 'pill-blue';
  if (status === 'part_paid')                                 return 'pill-orange';
  if (['overdue','disputed'].includes(status))                return 'pill-red';
  return 'pill-slate';
}

function applicationsBody(d: ApplicationsData): string {
  const today = todayStr();
  const projName = d.project?.name ?? '—';
  const client = d.project?.client ?? '';

  const appliedToDate    = d.apps.reduce((s, a) => s + a.applied_value, 0);
  const certifiedToDate  = d.apps.reduce((s, a) => s + a.certified_value, 0);
  const paidToDate       = d.apps.reduce((s, a) => s + a.paid_value, 0);
  const totalRetention   = d.apps.reduce((s, a) => s + a.retention, 0);
  const certShortfall    = appliedToDate - certifiedToDate;
  const outstanding      = certifiedToDate - paidToDate;
  const remaining        = d.forecastContractSum > 0 ? d.forecastContractSum - appliedToDate : null;

  // ── Page 1: Executive Commercial Summary ──
  const isZeroShortfall = certShortfall <= 0;
  const sortedApps = [...d.apps].sort((a, b) => (a.app_date ?? '').localeCompare(b.app_date ?? ''));
  const firstPeriod = sortedApps.length > 0 ? (sortedApps[0].period || fmtD(sortedApps[0].app_date)) : '—';
  const lastPeriod  = sortedApps.length > 1 ? (sortedApps[sortedApps.length - 1].period || fmtD(sortedApps[sortedApps.length - 1].app_date)) : firstPeriod;

  const cover = `<div class="exec-page">
  <div class="exec-head">
    <div>
      <div class="exec-brand">VYSITE</div>
      <div class="exec-brand-sub">Construction Operating System</div>
    </div>
    <div class="exec-head-right">
      <div class="exec-doc-type">Valuation &amp; Payment</div>
      <div class="exec-doc-title">Valuation Applications</div>
    </div>
  </div>

  <div class="exec-project-band">
    <div>
      <div class="exec-project-name">${esc(projName)}</div>
      ${client ? `<div class="exec-client">${esc(client)}</div>` : ''}
    </div>
    <div class="exec-report-date">
      <div>${today}</div>
      <div>Prepared by ${esc(d.currentUserName || 'VYSITE')}</div>
    </div>
  </div>

  <div class="exec-section-label">Commercial Position</div>

  <div class="primary-row">
    <div class="primary-fig">
      <div class="fig-label">Applied To Date</div>
      <div class="fig-value accent">${fv(appliedToDate)}</div>
    </div>
    <div class="primary-fig">
      <div class="fig-label">Certified To Date</div>
      <div class="fig-value">${fv(certifiedToDate)}</div>
    </div>
  </div>

  <div class="shortfall-band${isZeroShortfall ? ' zero' : ''}">
    <div class="shortfall-band-left">
      <div class="shortfall-label">Certification Shortfall</div>
      <div class="shortfall-sub">Applied to Date minus Certified to Date</div>
    </div>
    <div class="shortfall-value">${fv(Math.abs(certShortfall))}</div>
  </div>

  <div class="secondary-row">
    <div class="sec-fig">
      <div class="sec-label">Paid To Date</div>
      <div class="sec-value">${fv(paidToDate)}</div>
    </div>
    <div class="sec-fig">
      <div class="sec-label">Outstanding</div>
      <div class="sec-value${outstanding > 0 ? ' warn' : ''}">${fv(outstanding)}</div>
    </div>
    <div class="sec-fig">
      <div class="sec-label">Retention</div>
      <div class="sec-value">${fv(totalRetention)}</div>
    </div>
  </div>

  ${remaining != null ? `
  <div class="remaining-band">
    <span class="remaining-label">Remaining Contract Value</span>
    <span class="remaining-value">${fv(remaining)}</span>
  </div>` : '<div style="margin-bottom:24px;border-bottom:1.5px solid #0f172a;"></div>'}

  <div class="app-meta-strip">
    <div class="app-meta-item">
      <div class="app-meta-label">Applications</div>
      <div class="app-meta-value">${d.apps.length} submitted</div>
    </div>
    ${d.apps.length > 0 ? `<div class="app-meta-item">
      <div class="app-meta-label">Period</div>
      <div class="app-meta-value">${esc(firstPeriod)}${d.apps.length > 1 ? ' &ndash; ' + esc(lastPeriod) : ''}</div>
    </div>` : ''}
    ${d.forecastContractSum > 0 ? `<div class="app-meta-item">
      <div class="app-meta-label">Forecast Contract Sum</div>
      <div class="app-meta-value">${fv(d.forecastContractSum)}</div>
    </div>` : ''}
  </div>

  <div class="doc-footer">
    <div class="doc-footer-l">Confidential &mdash; VYSITE Commercial Document</div>
    <div class="doc-footer-r">${esc(d.currentUserName || 'VYSITE')} &bull; ${today}</div>
  </div>
</div>`;

  // ── Body: page head ──
  const pageHead = `<div class="page-head">
  <div class="page-head-left">
    <div class="page-head-wordmark">VYSITE</div>
    <div class="page-head-doc">Valuation Applications</div>
  </div>
  <div class="page-head-right">
    <div class="page-head-project">${esc(projName)}</div>
    ${client ? `<div class="page-head-client">${esc(client)}</div>` : ''}
  </div>
</div>`;

  // ── Section 1: Summary position ──
  const leftRows = [
    { label: 'Applied To Date',        value: fv(appliedToDate),   cls: '' },
    { label: 'Certified To Date',      value: fv(certifiedToDate), cls: '' },
    { label: 'Certification Shortfall',value: fv(certShortfall),   cls: certShortfall > 0 ? ' warn' : '' },
  ];
  const rightRows = [
    { label: 'Paid To Date',  value: fv(paidToDate),      cls: '' },
    { label: 'Outstanding',   value: fv(outstanding),     cls: outstanding > 0 ? ' warn' : '' },
    { label: 'Retention',     value: fv(totalRetention),  cls: '' },
  ];

  const summarySection = `<div class="section">
  <div class="section-head">
    <span class="section-number">01</span>
    <span class="section-title">Summary Position</span>
  </div>
  <div class="summary-grid">
    <div class="summary-col">
      ${leftRows.map(r => `<div class="summary-row">
        <span class="summary-label">${esc(r.label)}</span>
        <span class="summary-value${r.cls}">${r.value}</span>
      </div>`).join('')}
    </div>
    <div class="summary-col">
      ${rightRows.map(r => `<div class="summary-row">
        <span class="summary-label">${esc(r.label)}</span>
        <span class="summary-value${r.cls}">${r.value}</span>
      </div>`).join('')}
    </div>
    ${remaining != null ? `
    <div class="total-band">
      <span class="total-band-label">Remaining Contract Value</span>
      <span class="total-band-value">${fv(remaining)}</span>
    </div>` : ''}
  </div>
</div>`;

  // ── Section 2: Application schedule ──
  const schedRows = d.apps.map(a => {
    const outs = a.certified_value - a.paid_value;
    const pillCls = applicationsPillCls(a.status);
    const label   = APP_STATUS_LABELS[a.status] || a.status;
    return `<tr>
      <td><span class="sched-app-num">${String(a.app_number).padStart(2, '0')}</span></td>
      <td>
        <div class="sched-period">${esc(a.period || '—')}</div>
        ${a.app_date ? `<div class="sched-date">${fmtD(a.app_date)}</div>` : ''}
      </td>
      <td class="r"><span class="val-primary">${fv(a.applied_value)}</span></td>
      <td class="r"><span class="val-primary">${fv(a.certified_value)}</span></td>
      <td class="r"><span class="val-secondary">${fv(a.paid_value)}</span></td>
      <td class="r"><span class="val-secondary">${fv(a.retention)}</span></td>
      <td class="r"><span class="${outs > 0 ? 'val-outstanding' : 'val-secondary'}">${fv(outs)}</span></td>
      <td class="sched-date-cell">${fmtD(a.payment_due)}</td>
      <td class="sched-date-cell">${fmtD(a.payment_recd)}</td>
      <td style="padding-left:12px;vertical-align:top;"><span class="pill ${pillCls}">${esc(label)}</span></td>
    </tr>`;
  }).join('');

  const totalOut = certifiedToDate - paidToDate;
  const schedFooter = d.apps.length > 1 ? `<tfoot><tr>
    <td colspan="2">
      <div style="font-size:8.5pt;font-weight:700;color:#0f172a;">Totals</div>
      <div class="tfoot-label">${d.apps.length} applications</div>
    </td>
    <td class="r"><span class="tfoot-total">${fv(appliedToDate)}</span></td>
    <td class="r"><span class="tfoot-total">${fv(certifiedToDate)}</span></td>
    <td class="r"><span style="font-size:8.5pt;color:#64748b;">${fv(paidToDate)}</span></td>
    <td class="r"><span style="font-size:8.5pt;color:#64748b;">${fv(totalRetention)}</span></td>
    <td class="r"><span class="${totalOut > 0 ? 'tfoot-total" style="color:#b45309;' : 'tfoot-total'}">${fv(totalOut)}</span></td>
    <td colspan="3"></td>
  </tr></tfoot>` : '';

  const schedSection = `<div class="section">
  <div class="section-head">
    <span class="section-number">02</span>
    <span class="section-title">Application Schedule</span>
  </div>
  ${d.apps.length === 0
    ? '<div class="empty-state">No valuation applications recorded for this project.</div>'
    : `<table class="sched-table">
        <thead><tr>
          <th style="width:32px">No.</th>
          <th>Period</th>
          <th class="r">Applied</th>
          <th class="r">Certified</th>
          <th class="r secondary">Paid</th>
          <th class="r secondary">Retention</th>
          <th class="r">Outstanding</th>
          <th class="secondary" style="width:72px;padding-left:12px;">Due</th>
          <th class="secondary" style="width:72px;">Received</th>
          <th style="width:68px;padding-left:12px;">Status</th>
        </tr></thead>
        <tbody>${schedRows}</tbody>
        ${schedFooter}
      </table>`}
</div>`;

  // ── Footer ──
  const footer = `<div class="doc-footer">
  <div class="doc-footer-l">Confidential &mdash; VYSITE Commercial Document</div>
  <div class="doc-footer-r">${esc(d.currentUserName || 'VYSITE')} &bull; ${today}</div>
</div>`;

  return `${cover}
<div style="page-break-before:always;"></div>
<div class="body-page">
  ${pageHead}
  ${summarySection}
  ${schedSection}
  ${footer}
</div>`;
}

// ─── Timeline body ────────────────────────────────────────────────────────────

interface TimelineEvent {
  id: string;
  sortDate: string;
  displayDate: string;
  kind: string;
  source: string;
  reference: string;
  title: string;
  statusLabel?: string;
  fromStatusLabel?: string;
  value?: number;
  isPositive?: boolean;
  createdBy?: string | null;
}

interface TimelineData {
  project: Project | null;
  events: TimelineEvent[];
  currentUserName: string;
  logoUrl?: string;
}

const KIND_DOT: Record<string, string> = {
  'va-raised':          '#d97706',
  'va-agreed':          '#16a34a',
  'cr-added':           '#ea6c00',
  'cr-submitted':       '#2563eb',
  'cr-agreed':          '#16a34a',
  'cr-status-changed':  '#7c3aed',
};
const KIND_LABEL: Record<string, string> = {
  'va-raised':          'Variation Raised',
  'va-agreed':          'Variation Agreed',
  'cr-added':           'Record Added',
  'cr-submitted':       'Submitted',
  'cr-agreed':          'Agreed',
  'cr-status-changed':  'Status Changed',
};

function timelineBody(d: TimelineData): string {
  const today = todayStr();
  const projName = d.project?.name ?? '—';

  // Kind summary counts
  const kindCounts: Record<string, number> = {};
  for (const e of d.events) kindCounts[e.kind] = (kindCounts[e.kind] || 0) + 1;
  const kindOrder = ['va-raised', 'va-agreed', 'cr-added', 'cr-submitted', 'cr-status-changed', 'cr-agreed'];
  const summaryItems = kindOrder
    .filter(k => kindCounts[k])
    .map(k => `<div class="tl-summary-item">
        <div class="tl-summary-value">${kindCounts[k]}</div>
        <div class="tl-summary-label">${KIND_LABEL[k] || k}</div>
      </div>`).join('');

  const eventRows = d.events.map(e => {
    const dot  = KIND_DOT[e.kind]  || '#94a3b8';
    const klbl = KIND_LABEL[e.kind] || e.kind;
    const val  = e.value != null
      ? `<span class="tl-val" style="color:${e.isPositive ? '#16a34a' : '#991b1b'};">${e.isPositive ? '+' : ''}${fv(e.isPositive ? e.value : -e.value)}</span>`
      : '';
    const statusText = e.kind === 'cr-status-changed' && e.fromStatusLabel
      ? `${esc(e.fromStatusLabel)} → ${esc(e.statusLabel ?? '')}`
      : (e.statusLabel ? esc(e.statusLabel) : '');
    return `<div class="tl-entry">
      <div class="tl-left"><div class="tl-date">${esc(e.displayDate)}</div></div>
      <div class="tl-right" style="--dot-color:${dot}">
        <div class="tl-kind">${klbl} &bull; ${esc(e.source)}</div>
        <div class="tl-title"><span class="tl-ref">${esc(e.reference || '')}</span>${esc(e.title || '')}${val}</div>
        ${statusText || e.createdBy ? `<div class="tl-sub">${statusText}${e.createdBy ? ' &bull; ' + esc(e.createdBy) : ''}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `
  ${docHeader('Commercial Document', 'Commercial Timeline', projName, d.project?.client, today, d.logoUrl)}

  <div class="exec-project-band">
    <div>
      <div class="exec-project-name">${esc(projName)}</div>
      ${d.project?.client ? `<div style="font-size:9pt;color:#64748b;margin-top:2px;">${esc(d.project.client)}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:22pt;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;">${d.events.length}</div>
      <div class="exec-section-label" style="margin-bottom:0;">Total Event${d.events.length !== 1 ? 's' : ''}</div>
    </div>
  </div>

  ${d.events.length > 0 && summaryItems ? `
  <div style="display:flex;gap:0;border-top:0.5px solid #e2e8f0;border-bottom:0.5px solid #e2e8f0;padding:14px 0;margin-bottom:28px;">
    ${summaryItems}
  </div>` : ''}

  <div class="exec-section-label">Chronological Events — ${d.events.length} event${d.events.length !== 1 ? 's' : ''}</div>
  ${d.events.length === 0
    ? '<div style="font-size:9pt;color:#94a3b8;font-style:italic;padding:24px 0;">No timeline events recorded for this project.</div>'
    : `<div class="tl-wrap">${eventRows}</div>`}
  ${docFooter(d.currentUserName, today)}`;
}

function fullReportBody(d: FullReportData): string {
  const today = todayStr();
  const p = d.project;

  const forecastContractSum = d.contractNum + d.variationExposure;
  const adjustedContractSum = d.contractNum + d.agreedVariations;
  const remainingValue = d.completedNum != null ? adjustedContractSum - d.completedNum : null;

  const appliedToDate   = d.apps.reduce((s, a) => s + a.applied_value, 0);
  const certifiedToDate = d.apps.reduce((s, a) => s + a.certified_value, 0);
  const paidToDate      = d.apps.reduce((s, a) => s + a.paid_value, 0);
  const totalRetention  = d.apps.reduce((s, a) => s + a.retention, 0);
  const certShortfall   = appliedToDate - certifiedToDate;
  const outstanding     = certifiedToDate - paidToDate;
  const remaining       = d.forecastContractSum > 0 ? d.forecastContractSum - appliedToDate : null;

  // ── Cover ──
  const coverBrandHtml = d.logoUrl
    ? `<img src="${d.logoUrl}" alt="Logo" style="height:48px;max-width:200px;object-fit:contain;display:block;margin-bottom:8px">`
    : `<div class="fr-cover-brand">VYSITE</div>`;
  const cover = `<div class="fr-cover">
    ${coverBrandHtml}
    <div class="fr-cover-label">Full Commercial Report</div>
    <div class="fr-cover-title">Full Commercial<br>Report</div>
    <div class="fr-cover-project">${esc(p.name)}</div>
    ${p.client ? `<div class="fr-cover-client">${esc(p.client)}</div>` : ''}
    ${d.contractNum > 0 ? `
    <div class="fr-cover-figures">
      <div class="fr-cover-fig">
        <div class="fr-cover-fig-label">Original Contract Sum</div>
        <div class="fr-cover-fig-value">${fv(d.contractNum)}</div>
      </div>
      <div class="fr-cover-fig">
        <div class="fr-cover-fig-label">Forecast Contract Sum</div>
        <div class="fr-cover-fig-value accent">${fv(forecastContractSum)}</div>
      </div>
      <div class="fr-cover-fig">
        <div class="fr-cover-fig-label">${d.completedNum != null ? 'Completed Value' : 'Variation Exposure'}</div>
        <div class="fr-cover-fig-value${d.completedNum != null ? '' : ' accent'}">${fv(d.completedNum != null ? d.completedNum : d.vaExposure)}</div>
      </div>
    </div>` : ''}
    <div class="fr-cover-date">Generated ${today} by ${esc(d.currentUserName || 'VYSITE')}</div>
  </div>`;

  // ── Section 1: Commercial Position ──
  const ocs = d.contractNum > 0 ? fv(d.contractNum) : '—';
  const fcs = d.contractNum > 0 ? fv(forecastContractSum) : '—';
  const positionSection = `
  <div class="exec-section-label">1. Commercial Position</div>
  <div class="fin-primary-row" style="gap:0;border-top:0.5px solid #e2e8f0;border-bottom:0.5px solid #e2e8f0;padding:16px 0;margin-bottom:16px;">
    <div>
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Original Contract Sum</div>
      <div class="fin-fig-xl">${ocs}</div>
    </div>
    <div>
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Forecast Contract Sum</div>
      <div class="fin-fig-xl accent">${fcs}</div>
    </div>
  </div>
  ${d.variationExposure > 0 ? `
  <div class="exposure-band" style="margin-bottom:16px;">
    <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#b45309;margin-bottom:4px;">Outstanding Variation Exposure</div>
    <div class="exposure-value">${fv(d.variationExposure)}</div>
  </div>` : ''}
  ${finStatement((() => {
    const rows: StatRow[] = [{ label: 'Original Contract Sum', value: ocs }];
    if (d.agreedVariations !== 0) rows.push({ label: 'Agreed Variations', value: `+${fv(d.agreedVariations)}` });
    rows.push({ label: 'Adjusted Contract Sum', value: d.contractNum > 0 ? fv(adjustedContractSum) : '—', style: 'total' });
    if (d.completedNum != null) rows.push({ label: 'Completed Value', value: fv(d.completedNum) });
    if (remainingValue != null) rows.push({ label: 'Remaining Value', value: fv(remainingValue) });
    return rows;
  })())}`;

  // ── Section 2: Key Dates ──
  const keyDatesSection = `
  <div class="exec-section-label" style="margin-top:20px;">2. Key Dates</div>
  ${keyDatesTable(d.keyDates)}`;

  // ── Section 3: Register ──
  const regRows = d.records.map(r => {
    const ti = typeInfo(r.recordType);
    const si = statusInfo(r.status);
    return `<tr>
      <td class="dt-ref">${esc(r.reference || '—')}</td>
      <td style="font-size:9pt;font-weight:600;color:#0f172a;">${esc(r.title || 'Untitled')}</td>
      <td>${typeTag(r.recordType, ti.label)}</td>
      <td>${statusTag(r.status, si.label)}</td>
      <td style="font-size:8pt;color:#64748b;">${fmtD(r.dateRaised)}</td>
    </tr>`;
  }).join('');

  const registerSection = `
  <div class="exec-section-label">3. Commercial Register — ${d.records.length} record${d.records.length !== 1 ? 's' : ''}</div>
  ${d.records.length === 0
    ? '<div style="font-size:9pt;color:#94a3b8;font-style:italic;padding:16px 0;">No commercial register records for this project.</div>'
    : `<table class="data-table" style="width:100%;font-size:9pt;"><thead><tr>
        <th style="width:56px;">Ref</th><th>Title</th><th>Type</th><th>Status</th><th style="width:72px;">Raised</th>
      </tr></thead><tbody>${regRows}</tbody></table>`}`;

  // ── Section 4: Variation Account ──
  const vaStatusLabels: Record<string, string> = { draft:'Draft', submitted:'Submitted', under_review:'Under Review', agreed:'Agreed', rejected:'Rejected', paid:'Paid', withdrawn:'Withdrawn' };
  const vaRows = d.vaItems.map(item => {
    const val = item.is_positive ? item.value : -item.value;
    return `<tr>
      <td class="dt-ref">${esc(item.reference || '—')}</td>
      <td style="font-size:9pt;font-weight:600;color:#0f172a;">${esc(item.title)}</td>
      <td class="${val >= 0 ? 'dt-val-pos' : 'dt-val-neg'}">${val >= 0 ? '+' : ''}${fv(val)}</td>
      <td>${statusTag(item.status, vaStatusLabels[item.status] || item.status)}</td>
      <td style="font-size:8pt;color:#64748b;">${fmtD(item.date_raised)}</td>
    </tr>`;
  }).join('');

  const vaSection = `
  <div class="exec-section-label" style="margin-top:20px;">4. Variation Account — ${d.vaItems.length} item${d.vaItems.length !== 1 ? 's' : ''}</div>
  ${d.vaItems.length === 0
    ? '<div style="font-size:9pt;color:#94a3b8;font-style:italic;padding:16px 0;">No variation account items for this project.</div>'
    : `<table class="data-table" style="width:100%;font-size:9pt;"><thead><tr>
        <th style="width:56px;">Ref</th><th>Title</th><th class="num" style="width:90px;">Value</th><th>Status</th><th style="width:72px;">Raised</th>
      </tr></thead><tbody>${vaRows}</tbody></table>`}`;

  // ── Section 5: Applications ──
  const appRows = d.apps.map(a => `<tr>
    <td class="dt-ref">${String(a.app_number).padStart(2, '0')}</td>
    <td style="font-size:9pt;font-weight:600;color:#0f172a;">${esc(a.period || '—')}</td>
    <td class="num" style="font-size:9pt;">${fv(a.applied_value)}</td>
    <td class="num" style="font-size:9pt;">${fv(a.certified_value)}</td>
    <td class="num" style="font-size:9pt;">${fv(a.paid_value)}</td>
    <td>${statusTag(a.status, APP_STATUS_LABELS[a.status] || a.status)}</td>
  </tr>`).join('');

  const appSection = `
  <div class="exec-section-label">5. Valuation Applications — ${d.apps.length} application${d.apps.length !== 1 ? 's' : ''}</div>
  <div class="fin-primary-row" style="gap:0;border-top:0.5px solid #e2e8f0;border-bottom:0.5px solid #e2e8f0;padding:14px 0;margin-bottom:14px;">
    <div>
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Applied To Date</div>
      <div class="fin-fig-xl">${fv(appliedToDate)}</div>
    </div>
    <div>
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Certified To Date</div>
      <div class="fin-fig-xl accent">${fv(certifiedToDate)}</div>
    </div>
  </div>
  ${certShortfall > 0 ? `
  <div class="exposure-band" style="margin-bottom:14px;">
    <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#b45309;margin-bottom:4px;">Certification Shortfall</div>
    <div class="exposure-value">${fv(certShortfall)}</div>
  </div>` : ''}
  <div class="fin-secondary-row" style="gap:0;border-top:0.5px solid #e2e8f0;border-bottom:0.5px solid #e2e8f0;padding:12px 0;margin-bottom:16px;">
    <div>
      <div style="font-size:6.5pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:3px;">Paid To Date</div>
      <div style="font-size:15pt;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;">${fv(paidToDate)}</div>
    </div>
    <div>
      <div style="font-size:6.5pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:3px;">Outstanding</div>
      <div style="font-size:15pt;font-weight:700;color:${outstanding > 0 ? '#b45309' : '#0f172a'};font-variant-numeric:tabular-nums;">${fv(outstanding)}</div>
    </div>
    <div>
      <div style="font-size:6.5pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:3px;">Retention</div>
      <div style="font-size:15pt;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;">${fv(totalRetention)}</div>
    </div>
  </div>
  ${d.apps.length === 0
    ? '<div style="font-size:9pt;color:#94a3b8;font-style:italic;padding:16px 0;">No applications recorded for this project.</div>'
    : `<table class="data-table" style="width:100%;font-size:9pt;"><thead><tr>
        <th style="width:32px;">No.</th><th>Period</th><th class="num">Applied</th><th class="num">Certified</th><th class="num">Paid</th><th>Status</th>
      </tr></thead><tbody>${appRows}</tbody></table>`}`;

  // ── Section 6: Timeline ──
  const tlRows = d.events.map(e => {
    const dot  = KIND_DOT[e.kind]  || '#94a3b8';
    const klbl = KIND_LABEL[e.kind] || e.kind;
    const val  = e.value != null ? `<span class="tl-val" style="color:${e.isPositive ? '#16a34a' : '#991b1b'};">${e.isPositive ? '+' : ''}${fv(e.isPositive ? e.value : -e.value)}</span>` : '';
    return `<div class="tl-entry">
      <div class="tl-left"><div class="tl-date">${esc(e.displayDate)}</div></div>
      <div class="tl-right" style="--dot-color:${dot}">
        <div class="tl-kind">${klbl} &bull; ${esc(e.source)}</div>
        <div class="tl-title"><span class="tl-ref">${esc(e.reference || '')}</span>${esc(e.title || '')}${val}</div>
        ${e.statusLabel ? `<div class="tl-sub">${esc(e.statusLabel)}${e.createdBy ? ' &bull; ' + esc(e.createdBy) : ''}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  const tlSection = `
  <div class="exec-section-label">6. Commercial Timeline — ${d.events.length} event${d.events.length !== 1 ? 's' : ''}</div>
  ${d.events.length === 0
    ? '<div style="font-size:9pt;color:#94a3b8;font-style:italic;padding:16px 0;">No timeline events for this project.</div>'
    : `<div class="tl-wrap">${tlRows}</div>`}`;

  return `
  ${cover}

  <div class="exec-section-label" style="margin-bottom:6px;margin-top:0;">Project Details</div>
  <div style="font-size:8.5pt;color:#64748b;line-height:2;margin-bottom:28px;display:flex;flex-wrap:wrap;gap:0 28px;">
    <span><span style="font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-size:7pt;">Project Manager&ensp;</span>${esc(p.projectManager || '—')}</span>
    <span><span style="font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-size:7pt;">Location&ensp;</span>${esc(p.location || '—')}</span>
    <span><span style="font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-size:7pt;">Start&ensp;</span>${fmtD(p.startDate)}</span>
    <span><span style="font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-size:7pt;">Completion&ensp;</span>${fmtD(p.completionDate)}</span>
  </div>

  ${positionSection}
  ${keyDatesSection}

  <div class="page-break">
  ${registerSection}
  ${vaSection}
  </div>

  <div class="page-break">
  ${appSection}
  </div>

  <div class="page-break">
  ${tlSection}
  </div>

  ${docFooter(d.currentUserName, today)}`;
}

// ─── Public export functions ──────────────────────────────────────────────────

// ── VA Build-Up PDF helpers ────────────────────────────────────────────────────

interface VABuildUpData {
  item: DBVariationAccountItem;
  lines: DBVABuildUpLine[];
  buildUpTotal: number;
  comments?: DBVAComment[];
  attachments?: DBAttachment[];
  logoUrl?: string;
  currentUserName?: string;
}

const VA_BUILD_UP_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
/* Zero bottom margin eliminates browser URL / date / page-number chrome.
   Top and side margins are 40px / 52px so every printed page — including
   page 2 and beyond — starts with the same breathing room as page 1. */
@page { margin: 40px 52px 0; size: A4; }
@media print {
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-break { page-break-inside: avoid; break-inside: avoid; }
  .page-break-before { page-break-before: always; break-before: always; }
  orphans: 3; widows: 3;
}
html, body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9pt;
  color: #0f172a;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
/* Print: @page margin handles all spacing, so .page needs no padding.
   Screen: restore padding so the blob tab preview looks correct. */
.page { padding: 0 0 44px; }
@media screen { .page { padding: 40px 52px 44px; } }

/* ── Executive header ── */
.exec-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  padding-bottom: 14px; border-bottom: 1.5px solid #0f172a; margin-bottom: 32px;
}
.exec-brand { font-size: 10pt; font-weight: 900; letter-spacing: 0.18em; color: #ea6c00; text-transform: uppercase; line-height: 1; }
.exec-brand-sub { font-size: 6.5pt; color: #94a3b8; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3px; }
.exec-head-right { text-align: right; }
.exec-doc-type { font-size: 7pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8; margin-bottom: 3px; }
.exec-doc-title { font-size: 11pt; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }

/* ── Variation header band ── */
.var-header { padding-bottom: 24px; border-bottom: 0.5px solid #e2e8f0; margin-bottom: 32px; }
.var-ref { font-size: 8.5pt; font-weight: 800; letter-spacing: 0.14em; color: #ea6c00; text-transform: uppercase; margin-bottom: 8px; }
.var-title { font-size: 18pt; font-weight: 700; color: #0f172a; line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 14px; }
.var-meta-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px 0; margin-top: 16px; padding-top: 16px; border-top: 0.5px solid #f1f5f9;
}
.var-meta-item { }
.var-meta-label { font-size: 6.5pt; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 3px; }
.var-meta-value { font-size: 8.5pt; color: #334155; font-weight: 500; }
.status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }

/* ── Section labels ── */
.section-label {
  font-size: 6.5pt; font-weight: 800; letter-spacing: 0.18em;
  text-transform: uppercase; color: #94a3b8;
  border-bottom: 0.5px solid #e2e8f0; padding-bottom: 7px;
  margin-top: 40px; margin-bottom: 14px;
}

/* ── Description / rich text blocks ── */
.desc-block { margin-bottom: 0; }
.desc-text { font-size: 9pt; color: #334155; line-height: 1.75; }
.desc-text p { margin: 0 0 12px; }
.desc-text p:last-child { margin-bottom: 0; }
.desc-text p.gap { margin: 0 0 8px; height: 0; }
.desc-text ul { margin: 4px 0 14px 22px; padding: 0; list-style: disc; }
.desc-text ol { margin: 4px 0 14px 22px; padding: 0; list-style: decimal; }
.desc-text li { margin-bottom: 5px; line-height: 1.65; }

/* ── Cost build-up table ── */
.build-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 24px; }
.build-table thead th {
  font-size: 6pt; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
  color: #94a3b8; border-bottom: 1.5px solid #0f172a; padding: 0 10px 10px 0; text-align: left;
}
.build-table thead th:first-child { padding-left: 0; }
.build-table thead th.num { text-align: right; padding-right: 0; }
.build-table tbody tr:nth-child(even) td { background: #fafafa; }
.build-table tbody td { padding: 11px 10px 11px 0; border-bottom: 0.5px solid #f1f5f9; vertical-align: top; }
.build-table tbody td:first-child { padding-left: 0; }
.build-table tbody td.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; }
.build-table tfoot td { padding: 14px 10px 0 0; border-top: 1.5px solid #0f172a; font-weight: 700; font-variant-numeric: tabular-nums; }
.build-table tfoot td.num { text-align: right; padding-right: 0; }
.bt-ref { font-size: 7.5pt; color: #94a3b8; }
.bt-desc { font-size: 9pt; font-weight: 600; color: #0f172a; line-height: 1.4; }
.bt-type { display: inline-block; padding: 2px 7px; border-radius: 3px; background: #f1f5f9; color: #64748b; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
.bt-total { font-size: 11pt; font-weight: 700; color: #ea6c00; }

/* ── Summary figure bands ── */
.grand-band { border-left: 3px solid #ea6c00; background: #fff7ed; padding: 18px 24px; margin-bottom: 28px; }
.grand-label { font-size: 6.5pt; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #b45309; margin-bottom: 6px; }
.grand-value { font-size: 24pt; font-weight: 700; color: #ea6c00; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.value-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 0.5px solid #e2e8f0; border-bottom: 0.5px solid #e2e8f0; padding: 18px 0; margin-bottom: 32px; }
.value-summary-item { padding-right: 28px; }
.value-summary-item + .value-summary-item { border-left: 0.5px solid #e2e8f0; padding-left: 28px; padding-right: 0; }
.value-summary-label { font-size: 6.5pt; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
.value-summary-value { font-size: 17pt; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.value-summary-value.accent { color: #ea6c00; }

/* ── Comments ── */
.comments-block { margin-top: 32px; }
.comment-entry { padding: 14px 0; border-bottom: 0.5px solid #f1f5f9; }
.comment-author { font-size: 8pt; font-weight: 700; color: #0f172a; }
.comment-ts { font-size: 7pt; color: #94a3b8; margin-left: 8px; }
.comment-body { font-size: 8.5pt; color: #334155; margin-top: 6px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }

/* ── Attachments table ── */
.att-section { margin-top: 32px; }
.att-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 12px; }
.att-table thead th {
  text-align: left; padding: 7px 10px;
  border-bottom: 1.5px solid #0f172a;
  font-size: 6pt; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #94a3b8;
}
.att-table thead th.r { text-align: right; }
.att-table tbody tr:nth-child(even) td { background: #fafafa; }
.att-table tbody td { padding: 9px 10px; border-bottom: 0.5px solid #f1f5f9; color: #64748b; vertical-align: top; }
.att-table tbody td.name { color: #0f172a; font-weight: 600; }
.att-table tbody td.r { text-align: right; }

/* ── Evidence images ── */
.evidence-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 14px; }
.evidence-img-card { border: 0.5px solid #e2e8f0; border-radius: 6px; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
.evidence-img { width: 100%; max-height: 220px; object-fit: contain; background: #f8fafc; display: block; }
.evidence-img-caption { padding: 7px 10px; font-size: 7.5pt; color: #64748b; background: #f8fafc; border-top: 0.5px solid #e2e8f0; }

/* ── Footer ── */
.doc-footer { margin-top: 48px; padding-top: 12px; border-top: 0.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: baseline; }
.doc-footer-l { font-size: 7pt; color: #94a3b8; }
.doc-footer-r { font-size: 7pt; color: #94a3b8; text-align: right; }
`;

function statusBadgeHtml(status: string): string {
  const colours: Record<string, string> = {
    draft: 'background:#374151;color:#d1d5db;',
    submitted: 'background:#0c4a6e;color:#7dd3fc;',
    under_review: 'background:#78350f;color:#fcd34d;',
    agreed: 'background:#065f46;color:#6ee7b7;',
    rejected: 'background:#7f1d1d;color:#fca5a5;',
    paid: 'background:#14532d;color:#86efac;',
    withdrawn: 'background:#1e293b;color:#64748b;',
  };
  const labels: Record<string, string> = { draft:'Draft', submitted:'Submitted', under_review:'Under Review', agreed:'Agreed', rejected:'Rejected', paid:'Paid', withdrawn:'Withdrawn' };
  const style = colours[status] ?? 'background:#374151;color:#d1d5db;';
  return `<span class="status-badge" style="${style}">${labels[status] ?? status}</span>`;
}

function buildUpTableHtml(lines: DBVABuildUpLine[], total: number, showCost: boolean): string {
  if (lines.length === 0) {
    return '<p style="font-size:8.5pt;color:#94a3b8;font-style:italic;padding:10px 0;">No cost build-up lines recorded.</p>';
  }
  const costCols = showCost
    ? `<th class="num" style="width:70px;">Cost</th><th class="num" style="width:55px;">Markup</th>`
    : '';
  const rows = lines.map((l, i) => {
    const salesVal = `£${l.sales_price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const totalVal = `£${l.line_total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const costVal  = `£${l.cost_price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const costCells = showCost ? `<td class="num">${costVal}</td><td class="num">${l.markup_pct}%</td>` : '';
    return `<tr>
      <td><span class="bt-ref">${i + 1}</span></td>
      <td><span class="bt-desc">${esc(l.description)}</span></td>
      <td><span class="bt-type">${esc(l.type)}</span></td>
      <td>${esc(l.unit || '—')}</td>
      <td class="num">${l.quantity}</td>
      ${costCells}
      <td class="num">${salesVal}</td>
      <td class="num bt-total">${totalVal}</td>
    </tr>`;
  }).join('');

  const totalVal = `£${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const colCount = showCost ? 9 : 7;
  return `
  <table class="build-table">
    <thead>
      <tr>
        <th style="width:24px;">No.</th>
        <th>Description</th>
        <th style="width:90px;">Type</th>
        <th style="width:40px;">Unit</th>
        <th class="num" style="width:50px;">Qty</th>
        ${costCols}
        <th class="num" style="width:70px;">Sales Price</th>
        <th class="num" style="width:70px;">Line Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="${colCount - 1}" style="text-align:right;font-size:8pt;color:#64748b;padding-right:12px;">Build-Up Total</td>
        <td class="num bt-total">${totalVal}</td>
      </tr>
    </tfoot>
  </table>`;
}

function vaDocHeader(docType: string, variant: string, logoUrl?: string): string {
  const brandHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="height:36px;max-width:160px;object-fit:contain;display:block;margin-bottom:4px">`
    : `<div class="exec-brand">VYSITE</div><div class="exec-brand-sub">Construction Operating System</div>`;
  return `<div class="exec-head">
    <div>${brandHtml}</div>
    <div class="exec-head-right">
      <div class="exec-doc-type">${esc(docType)}</div>
      <div class="exec-doc-title">${esc(variant)}</div>
    </div>
  </div>`;
}

function vaDocFooter(today: string, variant: string, generatedBy?: string): string {
  const conf = variant === 'Internal' ? 'Confidential — Internal Use Only' : 'Commercial Document — Client Copy';
  const byLine = generatedBy ? `${esc(generatedBy)} &bull; ` : '';
  return `<div class="doc-footer">
    <div class="doc-footer-l">${conf}</div>
    <div class="doc-footer-r">${byLine}${today}</div>
  </div>`;
}

// Converts plain text with newlines/bullets/numbered lists into semantic HTML
// preserving exactly what the user typed, without leaking whitespace into render.
function fmtText(raw: string): string {
  if (!raw) return '';
  const lines = raw.split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  function closeList() {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  }

  for (const line of lines) {
    const trimmed = line.trimEnd();
    const ulMatch = trimmed.match(/^(\s*)([-*•]\s+)(.*)/);
    const olMatch = trimmed.match(/^(\s*)(\d+[.)]\s+)(.*)/);

    if (ulMatch) {
      if (!inUl) { closeList(); out.push('<ul>'); inUl = true; }
      out.push(`<li>${esc(ulMatch[3])}</li>`);
    } else if (olMatch) {
      if (!inOl) { closeList(); out.push('<ol>'); inOl = true; }
      out.push(`<li>${esc(olMatch[3])}</li>`);
    } else {
      closeList();
      if (trimmed === '') {
        out.push('<p class="gap"></p>');
      } else {
        out.push(`<p>${esc(trimmed)}</p>`);
      }
    }
  }
  closeList();
  return `<div class="desc-text">${out.join('')}</div>`;
}

function vaAttachmentHtml(attachments: DBAttachment[]): string {
  if (!attachments?.length) return '';
  const images = attachments.filter(a => a.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(a.name ?? ''));
  const docs   = attachments.filter(a => !images.includes(a));

  const imagesHtml = images.length
    ? `<div class="evidence-grid">${images.map(img =>
        `<div class="evidence-img-card">${
          img.data_url
            ? `<img class="evidence-img" src="${img.data_url}" alt="${esc(img.name)}" />`
            : `<div class="evidence-img" style="min-height:100px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:8pt;">Image unavailable</div>`
        }<div class="evidence-img-caption">${esc(img.name)}${img.category ? ` — ${esc(img.category)}` : ''}</div></div>`
      ).join('')}</div>` : '';

  const docsHtml = docs.length
    ? `<table class="att-table">
        <thead><tr>
          <th>File</th>
          <th>Category</th>
          <th class="r">Size</th>
          <th class="r">Uploaded</th>
        </tr></thead>
        <tbody>${docs.map(d => {
          const sz = d.size ? (d.size < 1024 * 1024 ? `${(d.size / 1024).toFixed(0)} KB` : `${(d.size / (1024 * 1024)).toFixed(1)} MB`) : '—';
          const dt = d.created_at ? new Date(d.created_at).toLocaleDateString('en-GB') : '—';
          return `<tr>
            <td class="name">${esc(d.name)}</td>
            <td>${esc(d.category || '—')}</td>
            <td class="r">${sz}</td>
            <td class="r">${dt}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>` : '';

  return `<div class="att-section"><div class="section-label">Evidence &amp; Attachments (${attachments.length})</div>${imagesHtml}${docsHtml}</div>`;
}

function vaInternalBody(d: VABuildUpData): string {
  const today = todayStr();
  const item = d.item;
  const signedVal = item.is_positive ? item.value : -item.value;
  const signedStr = (signedVal >= 0 ? '+' : '') + fv(Math.abs(signedVal));

  const commentsHtml = (d.comments ?? []).length > 0
    ? `<div class="comments-block">
        <div class="section-label">Comments (${d.comments!.length})</div>
        ${(d.comments ?? []).map(c => `<div class="comment-entry no-break">
          <span class="comment-author">${esc(c.author_name)}</span>
          <span class="comment-ts">${fmtD(c.created_at)}</span>
          <div class="comment-body">${esc(c.body)}</div>
        </div>`).join('')}
      </div>`
    : '';

  const attHtml = vaAttachmentHtml(d.attachments ?? []);

  return `<div class="page">
    ${vaDocHeader('Variation Account', 'Internal Build-Up', d.logoUrl)}

    <div class="var-header no-break">
      <div class="var-ref">${esc(item.reference || 'VAR')}</div>
      <div class="var-title">${esc(item.title || 'Untitled Variation')}</div>
      <div style="margin-bottom:14px;">${statusBadgeHtml(item.status)}</div>
      <div class="var-meta-grid">
        <div class="var-meta-item"><span class="var-meta-label">Date Raised</span><span class="var-meta-value">${fmtD(item.date_raised)}</span></div>
        ${item.date_agreed ? `<div class="var-meta-item"><span class="var-meta-label">Date Agreed</span><span class="var-meta-value">${fmtD(item.date_agreed)}</span></div>` : ''}
        <div class="var-meta-item"><span class="var-meta-label">Direction</span><span class="var-meta-value">${item.is_positive ? 'Addition (+)' : 'Omission (-)'}</span></div>
        <div class="var-meta-item"><span class="var-meta-label">Manual Value</span><span class="var-meta-value">${fv(item.value)}</span></div>
        ${item.created_by ? `<div class="var-meta-item"><span class="var-meta-label">Raised By</span><span class="var-meta-value">${esc(item.created_by)}</span></div>` : ''}
      </div>
    </div>

    ${item.description ? `<div class="desc-block">
      <div class="section-label">Description of Works</div>
      ${fmtText(item.description)}
    </div>` : ''}

    ${item.reason ? `<div class="desc-block">
      <div class="section-label">Reason / Cause</div>
      ${fmtText(item.reason)}
    </div>` : ''}

    ${item.notes ? `<div class="desc-block">
      <div class="section-label">Internal Notes</div>
      ${fmtText(item.notes)}
    </div>` : ''}

    <div class="section-label">Cost Build-Up</div>
    ${buildUpTableHtml(d.lines, d.buildUpTotal, true)}

    ${d.buildUpTotal > 0 ? `<div class="grand-band no-break">
      <div class="grand-label">Build-Up Total (Internal)</div>
      <div class="grand-value">${fv(d.buildUpTotal)}</div>
    </div>` : ''}

    <div class="value-summary-grid no-break">
      <div class="value-summary-item">
        <div class="value-summary-label">Manual Variation Value</div>
        <div class="value-summary-value">${signedStr}</div>
      </div>
      ${d.buildUpTotal > 0 ? `<div class="value-summary-item">
        <div class="value-summary-label">Build-Up Total</div>
        <div class="value-summary-value accent">${fv(d.buildUpTotal)}</div>
      </div>` : ''}
    </div>

    ${commentsHtml}
    ${attHtml}
    ${vaDocFooter(today, 'Internal', d.currentUserName)}
  </div>`;
}

function vaClientBody(d: VABuildUpData): string {
  const today = todayStr();
  const item = d.item;
  const attHtml = vaAttachmentHtml(d.attachments ?? []);

  return `<div class="page">
    ${vaDocHeader('Variation Account', 'Client Copy', d.logoUrl)}

    <div class="var-header no-break">
      <div class="var-ref">${esc(item.reference || 'VAR')}</div>
      <div class="var-title">${esc(item.title || 'Untitled Variation')}</div>
      <div style="margin-bottom:14px;">${statusBadgeHtml(item.status)}</div>
      <div class="var-meta-grid">
        <div class="var-meta-item"><span class="var-meta-label">Date Raised</span><span class="var-meta-value">${fmtD(item.date_raised)}</span></div>
        ${item.date_agreed ? `<div class="var-meta-item"><span class="var-meta-label">Date Agreed</span><span class="var-meta-value">${fmtD(item.date_agreed)}</span></div>` : ''}
        <div class="var-meta-item"><span class="var-meta-label">Direction</span><span class="var-meta-value">${item.is_positive ? 'Addition (+)' : 'Omission (-)'}</span></div>
      </div>
    </div>

    ${item.description ? `<div class="desc-block">
      <div class="section-label">Description of Works</div>
      ${fmtText(item.description)}
    </div>` : ''}

    ${item.reason ? `<div class="desc-block">
      <div class="section-label">Reason / Cause</div>
      ${fmtText(item.reason)}
    </div>` : ''}

    <div class="section-label">Cost Build-Up</div>
    ${buildUpTableHtml(d.lines, d.buildUpTotal, false)}

    ${d.buildUpTotal > 0 ? `<div class="grand-band no-break">
      <div class="grand-label">Variation Total</div>
      <div class="grand-value">${fv(d.buildUpTotal)}</div>
    </div>` : ''}

    ${attHtml}
    ${vaDocFooter(today, 'Client', d.currentUserName)}
  </div>`;
}

function vaBuildUpShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>${VA_BUILD_UP_CSS}</style>
<script>window.onload=function(){window.print();};<\/script>
</head>
<body>${body}</body>
</html>`;
}



export function exportPositionStatementPDF(data: PositionData): void {
  openPrintTab(pageShell(`Commercial Position Statement — ${data.project.name}`, positionStatementBody(data)));
}

export function exportRegisterPDF(data: RegisterData): void {
  const name = data.project?.name ?? 'All Projects';
  openPrintTab(pageShell(`Commercial Register — ${name}`, registerBody(data)));
}

export function exportVariationAccountPDF(data: VAData): void {
  const name = data.project?.name ?? '—';
  openPrintTab(pageShell(`Variation Account — ${name}`, variationAccountBody(data)));
}

export function buildVAInternalHTML(data: VABuildUpData): string {
  const ref = data.item.reference || 'VAR';
  return vaBuildUpShell(`${ref} — Internal Build-Up`, vaInternalBody(data));
}

export function buildVAClientHTML(data: VABuildUpData): string {
  const ref = data.item.reference || 'VAR';
  return vaBuildUpShell(`${ref} — Client Copy`, vaClientBody(data));
}

export function exportVAInternalPDF(data: VABuildUpData): void {
  openPrintTab(buildVAInternalHTML(data));
}

export function exportVAClientPDF(data: VABuildUpData): void {
  openPrintTab(buildVAClientHTML(data));
}

export function exportApplicationsPDF(data: ApplicationsData): void {
  const name = data.project?.name ?? '—';
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(`Valuation Applications — ${name}`)}</title>
<style>${APPLICATIONS_PDF_CSS}</style>
<script>window.onload=function(){window.print();};<\/script>
</head>
<body>
${applicationsBody(data)}
</body>
</html>`;
  openPrintTab(html);
}

export function exportTimelinePDF(data: TimelineData): void {
  const name = data.project?.name ?? '—';
  openPrintTab(pageShell(`Commercial Timeline — ${name}`, timelineBody(data)));
}

export function exportFullCommercialReport(data: FullReportData): void {
  openPrintTab(pageShell(`Full Commercial Report — ${data.project.name}`, fullReportBody(data)));
}
