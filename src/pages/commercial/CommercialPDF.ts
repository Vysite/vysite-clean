/**
 * Commercial PDF export helpers.
 * All PDFs share a single CSS sheet and utility functions.
 * Each export function returns an HTML string suitable for openPrintTab().
 */

import { openPrintTab } from '../../lib/printTab';
import type { DBVariationAccountItem, DBCommercialApplication, DBVABuildUpLine, DBVAComment, DBAttachment, DBValuation, DBValuationWorkbook, DBWorkbookLine, DBWorkbookExtra, DBValuationLineEntry, DBValuationExtraEntry } from '../../lib/store';
import type { CommercialRecord } from './types';
import { typeInfo, statusInfo, parseRawValue } from './types';
import type { DBKeyDate, Project } from '../../lib/store';

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
.exec-brand-sub { font-size: 6.5pt; color: #475569; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3px; }
.exec-head-right { text-align: right; }
.exec-doc-type { font-size: 7pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #475569; margin-bottom: 3px; }
.exec-doc-title { font-size: 11pt; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }

/* ── Project band ── */
.exec-project-band {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding-bottom: 20px; border-bottom: 0.5px solid #e2e8f0; margin-bottom: 28px;
}
.exec-project-name { font-size: 17pt; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; line-height: 1.1; }
.exec-client { font-size: 9.5pt; color: #334155; margin-top: 4px; }
.exec-report-date { font-size: 7.5pt; color: #475569; text-align: right; line-height: 1.6; }

/* ── Section label ── */
.exec-section-label {
  font-size: 6.5pt; font-weight: 800; letter-spacing: 0.18em;
  text-transform: uppercase; color: #475569; margin-bottom: 16px;
}

/* ── Primary 2-col financial figures ── */
.fin-primary-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 0; }
.fin-primary-fig { padding: 0 36px 20px 0; }
.fin-primary-fig + .fin-primary-fig { border-left: 0.5px solid #e2e8f0; padding-left: 36px; padding-right: 0; }
.fin-fig-label { font-size: 7pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #334155; margin-bottom: 7px; }
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
.fin-sec-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
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
.fin-label { font-size: 9pt; color: #1e293b; padding-right: 16px; }
.fin-sub { font-size: 7.5pt; color: #475569; display: block; margin-top: 1px; }
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
.proj-meta-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; margin-bottom: 2px; }
.proj-meta-value { font-size: 8.5pt; font-weight: 600; color: #1e293b; }

/* ── Data table (VA schedule, compact register) ── */
.data-table { width: 100%; border-collapse: collapse; }
.data-table thead th {
  font-size: 6.5pt; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #334155;
  padding: 0 12px 12px 0; text-align: left; border-bottom: 1.5px solid #0f172a; white-space: nowrap; vertical-align: bottom;
}
.data-table thead th.r { text-align: right; padding-right: 0; padding-left: 12px; }
.data-table thead th.muted { color: #475569; }
.data-table tbody td {
  font-size: 8.5pt; color: #1e293b; padding: 12px 12px 11px 0; border-bottom: 0.5px solid #f1f5f9; vertical-align: top;
}
.data-table tbody td.r { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; padding-right: 0; padding-left: 12px; }
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tfoot td { padding: 11px 12px 10px 0; border-top: 1.5px solid #0f172a; font-size: 8.5pt; font-weight: 700; }
.data-table tfoot td.r { text-align: right; padding-right: 0; padding-left: 12px; font-variant-numeric: tabular-nums; }
.dt-ref { font-size: 9pt; font-weight: 800; color: #ea6c00; letter-spacing: -0.01em; }
.dt-title { font-weight: 700; color: #0f172a; line-height: 1.3; }
.dt-muted { color: #334155; font-size: 8pt; }
.dt-val-pos { color: #166534; font-weight: 700; font-variant-numeric: tabular-nums; }
.dt-val-neg { color: #991b1b; font-weight: 700; font-variant-numeric: tabular-nums; }

/* ── Register record entry ── */
.record-entry { padding: 16px 0; border-bottom: 0.5px solid #f1f5f9; page-break-inside: avoid; }
.record-entry:last-child { border-bottom: none; }
.record-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
.record-ref { font-size: 9pt; font-weight: 800; color: #ea6c00; margin-right: 10px; letter-spacing: -0.01em; }
.record-title { font-size: 10pt; font-weight: 700; color: #0f172a; line-height: 1.3; }
.record-badges { display: flex; gap: 6px; align-items: center; flex-shrink: 0; margin-left: 12px; }
.record-meta { font-size: 7.5pt; color: #334155; margin-top: 6px; display: flex; gap: 20px; flex-wrap: wrap; line-height: 1.4; }
.record-meta-key { color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 6.5pt; margin-right: 4px; }
.record-notes { font-size: 8.5pt; color: #1e293b; margin-top: 8px; padding-top: 8px; border-top: 0.5px solid #f1f5f9; line-height: 1.5; white-space: pre-wrap; }

/* ── Register summary bar ── */
.register-summary { display: flex; gap: 28px; padding: 14px 0; border-top: 0.5px solid #e2e8f0; border-bottom: 0.5px solid #e2e8f0; margin-bottom: 24px; }
.reg-sum-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; margin-bottom: 3px; }
.reg-sum-value { font-size: 13pt; font-weight: 700; color: #0f172a; }
.reg-sum-value.accent { color: #ea6c00; }

/* ── Timeline ── */
.tl-wrap { padding-left: 8px; }
.tl-entry { display: flex; gap: 20px; margin-bottom: 0; page-break-inside: avoid; }
.tl-left { text-align: right; min-width: 90px; padding-top: 2px; flex-shrink: 0; }
.tl-date { font-size: 8.5pt; color: #334155; font-weight: 500; }
.tl-right { flex: 1; padding-bottom: 18px; border-left: 1px solid #e2e8f0; padding-left: 20px; position: relative; }
.tl-right::before { content: ''; position: absolute; left: -4.5px; top: 5px; width: 8px; height: 8px; border-radius: 50%; background: var(--dot-color, #475569); }
.tl-kind { font-size: 6.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #475569; margin-bottom: 3px; }
.tl-title { font-size: 9.5pt; font-weight: 600; color: #0f172a; margin-bottom: 3px; line-height: 1.3; }
.tl-ref { font-size: 8.5pt; color: #ea6c00; margin-right: 6px; font-weight: 700; }
.tl-val { font-size: 8.5pt; font-weight: 700; margin-left: 8px; font-variant-numeric: tabular-nums; }
.tl-sub { font-size: 8pt; color: #475569; }
.tl-entry:last-child .tl-right { border-left-color: transparent; }
.tl-summary-item { flex: 1; padding-right: 20px; }
.tl-summary-value { font-size: 18pt; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
.tl-summary-label { font-size: 6.5pt; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; margin-top: 2px; }

/* ── Key dates ── */
.kd-table { width: 100%; border-collapse: collapse; }
.kd-table th {
  font-size: 6.5pt; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #334155;
  padding: 0 12px 10px 0; text-align: left; border-bottom: 1.5px solid #0f172a; white-space: nowrap;
}
.kd-table td { padding: 10px 12px 9px 0; border-bottom: 0.5px solid #f1f5f9; font-size: 8.5pt; vertical-align: top; }
.kd-table tr:last-child td { border-bottom: none; }
.kd-date { color: #334155; width: 80px; white-space: nowrap; font-size: 8pt; }
.kd-title { font-weight: 700; color: #0f172a; }
.kd-desc { color: #334155; padding-left: 12px; font-size: 8pt; }
.kd-status { width: 70px; text-align: right; }
.kd-days { width: 90px; text-align: right; color: #475569; font-size: 8pt; }

/* ── Status tags / pills ── */
.tag { font-size: 6.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 7px 3px; border-radius: 3px; white-space: nowrap; display: inline-block; }
.tag-green  { background: #f0fdf4; color: #166534; }
.tag-amber  { background: #fffbeb; color: #92400e; }
.tag-orange { background: #fff7ed; color: #c2410c; }
.tag-blue   { background: #eff6ff; color: #1e40af; }
.tag-red    { background: #fef2f2; color: #991b1b; }
.tag-slate  { background: #f8fafc; color: #1e293b; }

/* ── Footer ── */
.doc-footer { margin-top: 44px; padding-top: 10px; border-top: 0.5px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
.doc-footer-l { font-size: 7pt; color: #475569; }
.doc-footer-r { font-size: 7pt; color: #475569; text-align: right; }

/* ── Page break ── */
.page-break { page-break-before: always; padding-top: 40px; }

/* ── Full report cover ── */
.fr-cover { padding-bottom: 28px; border-bottom: 1.5px solid #0f172a; margin-bottom: 28px; }
.fr-cover-brand { font-size: 10pt; font-weight: 900; letter-spacing: 0.18em; color: #ea6c00; text-transform: uppercase; margin-bottom: 48px; }
.fr-cover-label { font-size: 6.5pt; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #475569; margin-bottom: 12px; }
.fr-cover-title { font-size: 28pt; font-weight: 700; color: #0f172a; line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 24px; }
.fr-cover-project { font-size: 15pt; font-weight: 700; color: #0f172a; margin-bottom: 4px; letter-spacing: -0.01em; }
.fr-cover-client { font-size: 10pt; color: #334155; margin-bottom: 36px; }
.fr-cover-figures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border-top: 0.5px solid #e2e8f0; border-bottom: 0.5px solid #e2e8f0; padding: 18px 0; margin-bottom: 24px; }
.fr-cover-fig { padding-right: 24px; }
.fr-cover-fig + .fr-cover-fig { border-left: 0.5px solid #e2e8f0; padding-left: 24px; }
.fr-cover-fig:last-child { padding-right: 0; }
.fr-cover-fig-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
.fr-cover-fig-value { font-size: 16pt; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.fr-cover-fig-value.accent { color: #ea6c00; }
.fr-cover-date { font-size: 7.5pt; color: #475569; }

/* ── Empty notice ── */
.empty-notice { padding: 20px 0; text-align: center; color: #475569; font-size: 9pt; border-top: 0.5px solid #f1f5f9; }
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
  logoUrl?: string;
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
  .exec-brand-sub { font-size: 6.5pt; color: #475569; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3px; }
  .exec-head-right { text-align: right; }
  .exec-doc-type { font-size: 7pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #475569; margin-bottom: 3px; }
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
  .exec-client { font-size: 9.5pt; color: #334155; margin-top: 4px; }
  .exec-report-date { font-size: 7.5pt; color: #475569; text-align: right; line-height: 1.6; }
  .exec-section-label {
    font-size: 6.5pt;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #475569;
    margin-bottom: 16px;
  }
  /* Applied + Certified: primary 2-col figures */
  .primary-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 0; }
  .primary-fig { padding: 0 36px 20px 0; }
  .primary-fig + .primary-fig { border-left: 0.5px solid #e2e8f0; padding-left: 36px; padding-right: 0; }
  .fig-label { font-size: 7pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #334155; margin-bottom: 7px; }
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
  .sec-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
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
  .app-meta-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; margin-bottom: 2px; }
  .app-meta-value { font-size: 8.5pt; font-weight: 600; color: #1e293b; }

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
    color: #334155;
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
    color: #475569;
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
    color: #1e293b;
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
    color: #334155;
    padding: 0 12px 12px 0;
    text-align: left;
    border-bottom: 1.5px solid #0f172a;
    white-space: nowrap;
    vertical-align: bottom;
  }
  .sched-table thead th.r { text-align: right; padding-right: 0; padding-left: 12px; }
  .sched-table thead th.secondary { color: #475569; }
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
  .sched-date { font-size: 7.5pt; color: #475569; margin-top: 2px; }
  /* Value cells — primary (applied/certified) vs secondary (paid/retention) */
  .val-primary { color: #0f172a; font-size: 8.5pt; }
  .val-secondary { color: #334155; font-size: 8.5pt; font-weight: 400; }
  .val-outstanding { color: #b45309; font-weight: 700; font-size: 8.5pt; }
  /* Date cells */
  .sched-date-cell { font-size: 7.5pt; color: #475569; padding-left: 12px; }

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
  .tfoot-label { font-size: 7.5pt; color: #334155; font-weight: 400; margin-top: 2px; }

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
  .pill-slate  { background: #f8fafc; color: #1e293b; }

  /* ── Footer ──────────────────────────────────────────────────────────────── */
  .doc-footer {
    margin-top: 56px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .doc-footer-l { font-size: 7.5pt; color: #475569; }
  .doc-footer-r { font-size: 7.5pt; color: #475569; text-align: right; }

  .empty-state {
    padding: 28px 0;
    color: #475569;
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

  const coverBrandHtml = d.logoUrl
    ? `<img src="${d.logoUrl}" alt="Logo" style="height:36px;max-width:160px;object-fit:contain;display:block;margin-bottom:4px">`
    : `<div class="exec-brand">VYSITE</div><div class="exec-brand-sub">Construction Operating System</div>`;

  const cover = `<div class="exec-page">
  <div class="exec-head">
    <div>
      ${coverBrandHtml}
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
  const pageHeadBrand = d.logoUrl
    ? `<img src="${d.logoUrl}" alt="Logo" style="height:28px;max-width:120px;object-fit:contain;display:block;margin-bottom:3px">`
    : `<div class="page-head-wordmark">VYSITE</div>`;
  const pageHead = `<div class="page-head">
  <div class="page-head-left">
    ${pageHeadBrand}
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
    <td class="r"><span style="font-size:8.5pt;color:#334155;">${fv(paidToDate)}</span></td>
    <td class="r"><span style="font-size:8.5pt;color:#334155;">${fv(totalRetention)}</span></td>
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
    const dot  = KIND_DOT[e.kind]  || '#475569';
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
      ${d.project?.client ? `<div style="font-size:9pt;color:#334155;margin-top:2px;">${esc(d.project.client)}</div>` : ''}
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
    ? '<div style="font-size:9pt;color:#475569;font-style:italic;padding:24px 0;">No timeline events recorded for this project.</div>'
    : `<div class="tl-wrap">${eventRows}</div>`}
  ${docFooter(d.currentUserName, today)}`;
}

interface FullReportData {
  project: Project;
  keyDates: DBKeyDate[];
  records: CommercialRecord[];
  vaItems: DBVariationAccountItem[];
  apps: DBCommercialApplication[];
  events: TimelineEvent[];
  contractNum: number;
  completedNum: number | null;
  variationExposure: number;
  agreedVariations: number;
  forecastContractSum: number;
  adjustedContractSum: number;
  vaExposure: number;
  vaAgreed: number;
  currentUserName: string;
  logoUrl?: string;
  // Valuation data (optional — omitted if project has no workbook)
  valuationWorkbook?: DBValuationWorkbook;
  wbLines?: DBWorkbookLine[];
  wbExtras?: DBWorkbookExtra[];
  valuations?: DBValuation[];
  valuationLineEntries?: DBValuationLineEntry[];
  valuationExtraEntries?: DBValuationExtraEntry[];
}

const VAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
  agreed: 'Agreed', locked: 'Locked', paid: 'Paid',
};

function valuationsSectionHtml(d: FullReportData): string {
  const wb = d.valuationWorkbook;

  if (!wb) {
    return `
  <div class="exec-section-label">7. Valuations</div>
  <div style="font-size:9pt;color:#475569;font-style:italic;padding:16px 0;">No valuation workbook has been set up for this project.</div>`;
  }

  const wbLines       = d.wbLines ?? [];
  const wbExtras      = d.wbExtras ?? [];
  const valuations    = (d.valuations ?? []).slice().sort((a, b) => {
    const an = parseInt(a.ref.replace(/\D/g, ''), 10) || 0;
    const bn = parseInt(b.ref.replace(/\D/g, ''), 10) || 0;
    return bn - an; // descending — latest first
  });
  const lineEntries   = d.valuationLineEntries ?? [];
  const extraEntries  = d.valuationExtraEntries ?? [];

  const contractTotal = wbLines.reduce((s, l) => s + l.contract_value, 0);
  const extrasTotal   = wbExtras.reduce((s, e) => s + e.agreed_value, 0);
  const retentionPct  = wb.retention_pct ?? 0;
  const mcdPct        = wb.mcd_pct ?? 0;
  const hasDeductions = retentionPct > 0 || mcdPct > 0;

  // ── Workbook summary ──
  const deductionCols = hasDeductions ? `
    <div style="padding:0 28px;border-left:0.5px solid #e2e8f0;">
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:4px;">Retention</div>
      <div style="font-size:13pt;font-weight:700;color:#d97706;font-variant-numeric:tabular-nums;">${retentionPct.toFixed(2)}%</div>
    </div>
    <div style="padding:0 0 0 28px;border-left:0.5px solid #e2e8f0;">
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:4px;">MCD</div>
      <div style="font-size:13pt;font-weight:700;color:#d97706;font-variant-numeric:tabular-nums;">${mcdPct.toFixed(2)}%</div>
    </div>` : '';

  const wbSummary = `
  <div style="display:flex;gap:0;border-top:0.5px solid #e2e8f0;border-bottom:0.5px solid #e2e8f0;padding:14px 0;margin-bottom:16px;">
    <div style="flex:1;padding-right:28px;">
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:4px;">Workbook</div>
      <div style="font-size:13pt;font-weight:700;color:#0f172a;">${esc(wb.title)}</div>
    </div>
    <div style="padding:0 28px;border-left:0.5px solid #e2e8f0;">
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:4px;">Contract Works</div>
      <div style="font-size:13pt;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;">${fv(contractTotal)}</div>
    </div>
    <div style="padding:0 28px;border-left:0.5px solid #e2e8f0;">
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:4px;">Extras / Variations</div>
      <div style="font-size:13pt;font-weight:700;color:#ea6c00;font-variant-numeric:tabular-nums;">${fv(extrasTotal)}</div>
    </div>
    ${deductionCols}
  </div>`;

  if (valuations.length === 0) {
    return `
  <div class="exec-section-label">7. Valuations — ${esc(wb.title)}</div>
  ${wbSummary}
  <div style="font-size:9pt;color:#475569;font-style:italic;padding:8px 0;">No valuations recorded yet.</div>`;
  }

  // Helper: compute deduction amounts for a given amountDue
  const computeDeductions = (amountDue: number) => {
    const retAmt   = amountDue * retentionPct / 100;
    const afterRet = amountDue - retAmt;
    const mcdAmt   = afterRet * mcdPct / 100;
    const net      = afterRet - mcdAmt;
    return { retAmt, mcdAmt, net };
  };

  // ── History table ──
  const historyRows = valuations.map((v, idx) => {
    const isLatest = idx === 0;
    const vLineEntries  = lineEntries.filter(e => e.valuation_id === v.id);
    const vExtraEntries = extraEntries.filter(e => e.valuation_id === v.id);

    const contractCurrValue = wbLines.reduce((s, l) => {
      const e = vLineEntries.find(x => x.workbook_line_id === l.id);
      return s + l.contract_value * (e?.current_pct ?? 0) / 100;
    }, 0);
    const extrasCurrValue = wbExtras.reduce((s, ex) => {
      const e = vExtraEntries.find(x => x.workbook_extra_id === ex.id);
      return s + ex.agreed_value * (e?.current_pct ?? 0) / 100;
    }, 0);
    const grossToDate = contractCurrValue + extrasCurrValue;

    // Previous valuation gross
    const prevVal = valuations[idx + 1];
    let prevGross = 0;
    if (prevVal) {
      const pvLineEntries  = lineEntries.filter(e => e.valuation_id === prevVal.id);
      const pvExtraEntries = extraEntries.filter(e => e.valuation_id === prevVal.id);
      const pvContract = wbLines.reduce((s, l) => {
        const e = pvLineEntries.find(x => x.workbook_line_id === l.id);
        return s + l.contract_value * (e?.current_pct ?? 0) / 100;
      }, 0);
      const pvExtras = wbExtras.reduce((s, ex) => {
        const e = pvExtraEntries.find(x => x.workbook_extra_id === ex.id);
        return s + ex.agreed_value * (e?.current_pct ?? 0) / 100;
      }, 0);
      prevGross = pvContract + pvExtras;
    }
    const amountDue = grossToDate - prevGross;
    const { retAmt, mcdAmt, net } = computeDeductions(amountDue);
    const statusLabel = VAL_STATUS_LABELS[v.status] ?? v.status;
    const rowStyle = isLatest ? ' background:#fff7ed;' : '';

    const retCol  = hasDeductions ? `<td class="num" style="font-size:8.5pt;color:#d97706;">${retentionPct > 0 ? `(${fv(retAmt)})` : '—'}</td>` : '';
    const mcdCol  = hasDeductions ? `<td class="num" style="font-size:8.5pt;color:#d97706;">${mcdPct > 0 ? `(${fv(mcdAmt)})` : '—'}</td>` : '';
    const netCol  = hasDeductions ? `<td class="num" style="font-size:9pt;font-weight:800;color:${net >= 0 ? '#16a34a' : '#991b1b'};">${fv(net)}</td>` : '';

    return `<tr style="${rowStyle}">
      <td class="dt-ref">${esc(v.ref)}${isLatest ? ' <span style="font-size:6.5pt;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#ea6c00;">LATEST</span>' : ''}</td>
      <td style="font-size:8.5pt;color:#334155;">${fmtD(v.valuation_date)}</td>
      <td>${statusTag(v.status, statusLabel)}</td>
      <td class="num" style="font-size:9pt;font-weight:600;">${fv(grossToDate)}</td>
      <td class="num" style="font-size:9pt;color:#334155;">${fv(prevGross)}</td>
      <td class="num" style="font-size:9pt;font-weight:700;color:${amountDue >= 0 ? '#16a34a' : '#991b1b'};">${amountDue >= 0 ? '+' : ''}${fv(amountDue)}</td>
      ${retCol}${mcdCol}${netCol}
    </tr>`;
  }).join('');

  const deductionHeaders = hasDeductions
    ? `<th class="num">Retention</th><th class="num">MCD</th><th class="num">Net Due</th>`
    : '';

  const historyTable = `
  <table class="data-table" style="width:100%;font-size:9pt;margin-bottom:0;">
    <thead><tr>
      <th style="width:72px;">Ref</th>
      <th style="width:80px;">Date</th>
      <th>Status</th>
      <th class="num">Gross to Date</th>
      <th class="num">Previous</th>
      <th class="num">Amount Due</th>
      ${deductionHeaders}
    </tr></thead>
    <tbody>${historyRows}</tbody>
  </table>`;

  // ── Per-valuation line detail ──
  const valDetailSections = valuations.map((v, idx) => {
    const isLatest = idx === 0;
    const vLineEntries  = lineEntries.filter(e => e.valuation_id === v.id);
    const vExtraEntries = extraEntries.filter(e => e.valuation_id === v.id);

    const lineRows = wbLines.map(l => {
      const e       = vLineEntries.find(x => x.workbook_line_id === l.id);
      const prevPct = e?.previous_pct ?? 0;
      const currPct = e?.current_pct  ?? 0;
      const prevVal = l.contract_value * prevPct / 100;
      const currVal = l.contract_value * currPct / 100;
      const thisVal = currVal - prevVal;
      return `<tr>
        <td class="dt-ref" style="width:40px;">${esc(l.item_number)}</td>
        <td style="font-size:9pt;color:#0f172a;">${esc(l.description)}</td>
        <td class="num" style="font-size:8.5pt;color:#334155;">${fv(l.contract_value)}</td>
        <td class="num" style="font-size:8.5pt;color:#334155;">${prevPct.toFixed(1)}%</td>
        <td class="num" style="font-size:8.5pt;color:#334155;">${fv(prevVal)}</td>
        <td class="num" style="font-size:8.5pt;">${currPct.toFixed(1)}%</td>
        <td class="num" style="font-size:9pt;font-weight:600;">${fv(currVal)}</td>
        <td class="num" style="font-size:9pt;font-weight:700;color:${thisVal > 0 ? '#16a34a' : thisVal < 0 ? '#991b1b' : '#334155'};">${thisVal > 0 ? '+' : ''}${fv(thisVal)}</td>
      </tr>`;
    }).join('');

    const extraRows = wbExtras.map(ex => {
      const e       = vExtraEntries.find(x => x.workbook_extra_id === ex.id);
      const prevPct = e?.previous_pct ?? 0;
      const currPct = e?.current_pct  ?? 0;
      const prevVal = ex.agreed_value * prevPct / 100;
      const currVal = ex.agreed_value * currPct / 100;
      const thisVal = currVal - prevVal;
      return `<tr style="background:#f8fafc;">
        <td class="dt-ref" style="width:40px;color:#334155;">${esc(ex.ref)}</td>
        <td style="font-size:9pt;color:#334155;font-style:italic;">${esc(ex.description)}</td>
        <td class="num" style="font-size:8.5pt;color:#334155;">${fv(ex.agreed_value)}</td>
        <td class="num" style="font-size:8.5pt;color:#475569;">${prevPct.toFixed(1)}%</td>
        <td class="num" style="font-size:8.5pt;color:#475569;">${fv(prevVal)}</td>
        <td class="num" style="font-size:8.5pt;color:#334155;">${currPct.toFixed(1)}%</td>
        <td class="num" style="font-size:9pt;font-weight:600;color:#334155;">${fv(currVal)}</td>
        <td class="num" style="font-size:9pt;font-weight:700;color:${thisVal > 0 ? '#16a34a' : thisVal < 0 ? '#991b1b' : '#334155'};">${thisVal > 0 ? '+' : ''}${fv(thisVal)}</td>
      </tr>`;
    }).join('');

    // Totals row
    const contractCurrValue = wbLines.reduce((s, l) => {
      const e = vLineEntries.find(x => x.workbook_line_id === l.id);
      return s + l.contract_value * (e?.current_pct ?? 0) / 100;
    }, 0);
    const contractPrevValue = wbLines.reduce((s, l) => {
      const e = vLineEntries.find(x => x.workbook_line_id === l.id);
      return s + l.contract_value * (e?.previous_pct ?? 0) / 100;
    }, 0);
    const extrasCurrValue = wbExtras.reduce((s, ex) => {
      const e = vExtraEntries.find(x => x.workbook_extra_id === ex.id);
      return s + ex.agreed_value * (e?.current_pct ?? 0) / 100;
    }, 0);
    const extrasPrevValue = wbExtras.reduce((s, ex) => {
      const e = vExtraEntries.find(x => x.workbook_extra_id === ex.id);
      return s + ex.agreed_value * (e?.previous_pct ?? 0) / 100;
    }, 0);
    const grossToDate  = contractCurrValue + extrasCurrValue;
    const prevGross    = contractPrevValue + extrasPrevValue;
    const amountDue    = grossToDate - prevGross;
    const { retAmt, mcdAmt, net } = computeDeductions(amountDue);

    const deductionTotals = hasDeductions ? `
      <td class="num" style="font-size:8.5pt;color:#d97706;">${retentionPct > 0 ? `(${fv(retAmt)})` : '—'}</td>
      <td class="num" style="font-size:8.5pt;color:#d97706;">${mcdPct > 0 ? `(${fv(mcdAmt)})` : '—'}</td>
      <td class="num" style="font-size:10pt;font-weight:800;color:${net >= 0 ? '#4ade80' : '#f87171'};">${fv(net)}</td>` : '';

    const totalsRow = `<tr style="background:#0f172a;color:#fff;">
      <td colspan="2" style="font-size:8.5pt;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:8px 10px;color:#fff;">Total</td>
      <td class="num" style="font-size:8.5pt;color:#475569;">${fv(contractTotal + extrasTotal)}</td>
      <td class="num" style="font-size:8.5pt;color:#475569;"></td>
      <td class="num" style="font-size:9pt;font-weight:600;color:#cbd5e1;">${fv(prevGross)}</td>
      <td class="num" style="font-size:8.5pt;color:#475569;"></td>
      <td class="num" style="font-size:9pt;font-weight:700;color:#f97316;">${fv(grossToDate)}</td>
      <td class="num" style="font-size:10pt;font-weight:800;color:${amountDue >= 0 ? '#4ade80' : '#f87171'};">${amountDue >= 0 ? '+' : ''}${fv(amountDue)}</td>
      ${deductionTotals}
    </tr>`;

    const heading = isLatest
      ? `<div style="font-size:9pt;font-weight:800;color:#ea6c00;margin-bottom:8px;">${esc(v.ref)} — ${fmtD(v.valuation_date)} <span style="font-size:6.5pt;letter-spacing:0.12em;text-transform:uppercase;background:#fff7ed;color:#ea6c00;border:1px solid #fed7aa;padding:2px 6px;border-radius:3px;margin-left:6px;">Latest</span> <span style="font-size:8pt;color:#475569;font-weight:400;">${VAL_STATUS_LABELS[v.status] ?? v.status}</span></div>`
      : `<div style="font-size:9pt;font-weight:700;color:#0f172a;margin-bottom:8px;">${esc(v.ref)} — ${fmtD(v.valuation_date)} <span style="font-size:8pt;color:#475569;font-weight:400;">${VAL_STATUS_LABELS[v.status] ?? v.status}</span></div>`;

    const hasExtras = wbExtras.length > 0;
    const deductionHeaders2 = hasDeductions
      ? `<th class="num" style="width:76px;">Retention</th><th class="num" style="width:76px;">MCD</th><th class="num" style="width:76px;">Net Due</th>`
      : '';

    return `
  <div style="margin-top:20px;page-break-inside:avoid;">
    ${heading}
    <table class="data-table" style="width:100%;font-size:8.5pt;">
      <thead><tr>
        <th style="width:40px;">Item</th>
        <th>Description</th>
        <th class="num" style="width:76px;">Orig Value</th>
        <th class="num" style="width:44px;">Prev %</th>
        <th class="num" style="width:76px;">Prev Value</th>
        <th class="num" style="width:44px;">Curr %</th>
        <th class="num" style="width:76px;">Curr Value</th>
        <th class="num" style="width:76px;">This Val</th>
        ${deductionHeaders2}
      </tr></thead>
      <tbody>
        ${lineRows}
        ${hasExtras ? `<tr><td colspan="${8 + (hasDeductions ? 3 : 0)}" style="font-size:7pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#475569;padding:8px 10px 4px;border-bottom:0.5px solid #e2e8f0;">Extras / Variations</td></tr>${extraRows}` : ''}
        ${totalsRow}
      </tbody>
    </table>
  </div>`;
  }).join('');

  return `
  <div class="exec-section-label">7. Valuations — ${esc(wb.title)}</div>
  ${wbSummary}
  <div style="font-size:8pt;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#475569;margin-bottom:8px;">Valuation History — ${valuations.length} valuation${valuations.length !== 1 ? 's' : ''}</div>
  ${historyTable}
  <div style="font-size:8pt;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#475569;margin-top:20px;margin-bottom:8px;">Line Breakdown</div>
  ${valDetailSections}`;
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
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:4px;">Original Contract Sum</div>
      <div class="fin-fig-xl">${ocs}</div>
    </div>
    <div>
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:4px;">Forecast Contract Sum</div>
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
      <td style="font-size:8pt;color:#334155;">${fmtD(r.dateRaised)}</td>
    </tr>`;
  }).join('');

  const registerSection = `
  <div class="exec-section-label">3. Commercial Register — ${d.records.length} record${d.records.length !== 1 ? 's' : ''}</div>
  ${d.records.length === 0
    ? '<div style="font-size:9pt;color:#475569;font-style:italic;padding:16px 0;">No commercial register records for this project.</div>'
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
      <td style="font-size:8pt;color:#334155;">${fmtD(item.date_raised)}</td>
    </tr>`;
  }).join('');

  const vaSection = `
  <div class="exec-section-label" style="margin-top:20px;">4. Variation Account — ${d.vaItems.length} item${d.vaItems.length !== 1 ? 's' : ''}</div>
  ${d.vaItems.length === 0
    ? '<div style="font-size:9pt;color:#475569;font-style:italic;padding:16px 0;">No variation account items for this project.</div>'
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
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:4px;">Applied To Date</div>
      <div class="fin-fig-xl">${fv(appliedToDate)}</div>
    </div>
    <div>
      <div style="font-size:6.5pt;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:4px;">Certified To Date</div>
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
      <div style="font-size:6.5pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#475569;margin-bottom:3px;">Paid To Date</div>
      <div style="font-size:15pt;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;">${fv(paidToDate)}</div>
    </div>
    <div>
      <div style="font-size:6.5pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#475569;margin-bottom:3px;">Outstanding</div>
      <div style="font-size:15pt;font-weight:700;color:${outstanding > 0 ? '#b45309' : '#0f172a'};font-variant-numeric:tabular-nums;">${fv(outstanding)}</div>
    </div>
    <div>
      <div style="font-size:6.5pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#475569;margin-bottom:3px;">Retention</div>
      <div style="font-size:15pt;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;">${fv(totalRetention)}</div>
    </div>
  </div>
  ${d.apps.length === 0
    ? '<div style="font-size:9pt;color:#475569;font-style:italic;padding:16px 0;">No applications recorded for this project.</div>'
    : `<table class="data-table" style="width:100%;font-size:9pt;"><thead><tr>
        <th style="width:32px;">No.</th><th>Period</th><th class="num">Applied</th><th class="num">Certified</th><th class="num">Paid</th><th>Status</th>
      </tr></thead><tbody>${appRows}</tbody></table>`}`;

  // ── Section 6: Timeline ──
  const tlRows = d.events.map(e => {
    const dot  = KIND_DOT[e.kind]  || '#475569';
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
    ? '<div style="font-size:9pt;color:#475569;font-style:italic;padding:16px 0;">No timeline events for this project.</div>'
    : `<div class="tl-wrap">${tlRows}</div>`}`;

  return `
  ${cover}

  <div class="exec-section-label" style="margin-bottom:6px;margin-top:0;">Project Details</div>
  <div style="font-size:8.5pt;color:#334155;line-height:2;margin-bottom:28px;display:flex;flex-wrap:wrap;gap:0 28px;">
    <span><span style="font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;font-size:7pt;">Project Manager&ensp;</span>${esc(p.projectManager || '—')}</span>
    <span><span style="font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;font-size:7pt;">Location&ensp;</span>${esc(p.location || '—')}</span>
    <span><span style="font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;font-size:7pt;">Start&ensp;</span>${fmtD(p.startDate)}</span>
    <span><span style="font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;font-size:7pt;">Completion&ensp;</span>${fmtD(p.completionDate)}</span>
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

  <div class="page-break">
  ${valuationsSectionHtml(d)}
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
  project?: { name?: string; client?: string; projectManager?: string; startDate?: string } | null;
}

const VA_BUILD_UP_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { margin: 0; size: A4; }
@media print {
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-break { page-break-inside: avoid; break-inside: avoid; }
  .pb-before { page-break-before: always; break-before: always; }
}
html, body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9pt;
  color: #0f172a;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── Header band (dark) ─────────────────────────────────────────────────────── */
.va-header {
  background: #0f172a;
  padding: 20px 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.va-header-logo img { height: 32px; max-width: 140px; object-fit: contain; display: block; }
.va-header-logo-text { font-size: 13pt; font-weight: 900; letter-spacing: 0.18em; color: #ea6c00; text-transform: uppercase; line-height: 1; }
.va-header-logo-sub { font-size: 6pt; color: #475569; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3px; }
.va-header-center { text-align: center; flex: 1; padding: 0 24px; }
.va-header-doc { font-size: 14pt; font-weight: 700; color: #fff; letter-spacing: 0.04em; text-transform: uppercase; }
.va-header-ref { font-size: 9pt; color: #475569; margin-top: 4px; letter-spacing: 0.06em; }
.va-header-right { text-align: right; min-width: 130px; }
.va-copy-badge {
  display: inline-block; font-size: 7.5pt; font-weight: 800; letter-spacing: 0.12em;
  text-transform: uppercase; padding: 5px 14px; border-radius: 4px; white-space: nowrap;
}
.va-copy-badge.internal { border: 1.5px solid #ea6c00; color: #ea6c00; }
.va-copy-badge.client   { border: 1.5px solid #38bdf8; color: #38bdf8; }
.va-header-date { font-size: 7pt; color: #334155; margin-top: 6px; }

/* ── Project info band ──────────────────────────────────────────────────────── */
.va-info-band {
  display: grid;
  grid-template-columns: 1fr 1fr 220px;
  gap: 0;
  border: 1px solid #e2e8f0;
  border-top: none;
  background: #fff;
}
.va-info-col {
  padding: 16px 20px;
  border-right: 1px solid #e2e8f0;
}
.va-info-col:last-child { border-right: none; }
.va-info-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #475569; margin-bottom: 2px; }
.va-info-value { font-size: 9pt; font-weight: 600; color: #0f172a; line-height: 1.3; }
.va-info-meta-row { margin-bottom: 10px; }
.va-info-meta-row:last-child { margin-bottom: 0; }

/* ── Summary box ────────────────────────────────────────────────────────────── */
.va-summary-box { border: 1px solid #e2e8f0; border-radius: 0; }
.va-summary-header {
  background: #f1f5f9; padding: 7px 14px;
  font-size: 7pt; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #1e293b;
  border-bottom: 1px solid #e2e8f0; text-align: center;
}
.va-summary-row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 14px; border-bottom: 1px solid #f1f5f9; }
.va-summary-row:last-child { border-bottom: none; padding: 9px 14px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
.va-summary-label { font-size: 8pt; color: #1e293b; }
.va-summary-value { font-size: 8.5pt; font-weight: 600; font-variant-numeric: tabular-nums; color: #0f172a; }
.va-summary-value.pos { color: #16a34a; }
.va-summary-value.neg { color: #dc2626; }
.va-summary-total-label { font-size: 9pt; font-weight: 700; color: #0f172a; }
.va-summary-total-value { font-size: 11pt; font-weight: 700; font-variant-numeric: tabular-nums; }
.va-summary-total-value.neg { color: #dc2626; }
.va-summary-total-value.pos { color: #16a34a; }
.va-summary-total-value.zero { color: #0f172a; }

/* ── Page body ──────────────────────────────────────────────────────────────── */
.va-body { padding: 24px 36px 36px; }

/* ── Section block ──────────────────────────────────────────────────────────── */
.va-section { border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 18px; overflow: hidden; }
.va-section-head {
  display: flex; align-items: center; gap: 8px;
  background: #f8fafc; padding: 9px 16px;
  border-bottom: 1px solid #e2e8f0;
}
.va-section-title { font-size: 8pt; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #0f172a; }
.va-section-body { padding: 14px 16px; }

/* ── Details grid ───────────────────────────────────────────────────────────── */
.va-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
.va-detail-row { padding: 7px 0; border-bottom: 1px solid #f1f5f9; display: grid; grid-template-columns: 110px 1fr; gap: 8px; align-items: baseline; }
.va-detail-row:last-child { border-bottom: none; }
.va-detail-label { font-size: 7pt; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; }
.va-detail-value { font-size: 8.5pt; color: #0f172a; font-weight: 500; line-height: 1.5; word-break: break-word; }
.va-detail-value.bold { font-weight: 700; }
.va-direction-badge {
  display: inline-block; padding: 3px 12px; border-radius: 4px; font-size: 7.5pt; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.va-direction-add { background: #f0fdf4; color: #166534; border: 1px solid #86efac; }
.va-direction-omit { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
.va-status-badge {
  display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 7pt; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.va-text-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 12px; font-size: 8.5pt; color: #1e293b; line-height: 1.7; white-space: pre-wrap; word-break: break-word; margin-top: 6px; }

/* ── Build-up table ─────────────────────────────────────────────────────────── */
.bu-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
.bu-table thead th {
  padding: 7px 10px; text-align: left; font-size: 6.5pt; font-weight: 800;
  letter-spacing: 0.1em; text-transform: uppercase; color: #334155;
  background: #f8fafc; border-bottom: 1.5px solid #0f172a;
}
.bu-table thead th.r { text-align: right; }
.bu-table tbody td { padding: 8px 10px; border-bottom: 0.5px solid #f1f5f9; color: #1e293b; vertical-align: top; }
.bu-table tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
.bu-table tbody tr:nth-child(even) td { background: #fafafa; }
.bu-table tbody tr:last-child td { border-bottom: none; }
.bu-table tfoot td { padding: 8px 10px; border-top: 1px solid #e2e8f0; font-size: 8pt; }
.bu-table tfoot td.r { text-align: right; font-variant-numeric: tabular-nums; }
.bu-table tfoot tr.bu-total-row td { border-top: 1.5px solid #0f172a; padding-top: 10px; font-weight: 700; }
.bu-ref { color: #475569; font-size: 7.5pt; }
.bu-desc { font-weight: 600; color: #0f172a; }
.bu-type { display: inline-block; padding: 1px 6px; background: #f1f5f9; border-radius: 3px; color: #334155; font-size: 6.5pt; font-weight: 700; text-transform: uppercase; }
.bu-grand { font-size: 10pt; font-weight: 700; color: #ea6c00; }

/* ── Bottom 3-col section ───────────────────────────────────────────────────── */
.va-bottom-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 18px; }
.va-bottom-box { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
.va-bottom-head {
  display: flex; align-items: center; gap: 6px;
  background: #f8fafc; padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 7pt; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #1e293b;
}
.va-bottom-body { padding: 10px 12px; }

/* Attachments */
.att-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 0.5px solid #f1f5f9; }
.att-item:last-child { border-bottom: none; }
.att-name { font-size: 8pt; font-weight: 600; color: #0f172a; word-break: break-all; }
.att-name a { color: #0f172a; text-decoration: none; }
.att-meta { font-size: 7pt; color: #475569; margin-top: 2px; }
.att-dl { font-size: 7pt; color: #ea6c00; text-decoration: none; font-weight: 700; }

/* Comments */
.comment-item { padding: 6px 0; border-bottom: 0.5px solid #f1f5f9; }
.comment-item:last-child { border-bottom: none; }
.comment-meta { font-size: 7.5pt; font-weight: 700; color: #0f172a; }
.comment-ts { color: #475569; font-weight: 400; font-size: 7pt; margin-left: 6px; }
.comment-body { font-size: 8pt; color: #1e293b; margin-top: 4px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }

/* Approval */
.approval-row { display: grid; grid-template-columns: 80px 1fr 70px; gap: 4px; padding: 6px 0; border-bottom: 0.5px solid #f1f5f9; align-items: baseline; }
.approval-row:last-child { border-bottom: none; }
.approval-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #475569; }
.approval-value { font-size: 8pt; color: #0f172a; font-weight: 500; }
.approval-date { font-size: 7.5pt; color: #334155; text-align: right; }
.sig-line { border-bottom: 1px solid #cbd5e1; margin-top: 8px; height: 18px; }
.sig-label { font-size: 6pt; color: #475569; margin-top: 2px; }

/* ── Contractual notice ─────────────────────────────────────────────────────── */
.va-notice { border: 1px solid #fed7aa; border-left: 3px solid #ea6c00; background: #fffbf5; border-radius: 4px; padding: 10px 14px; margin-bottom: 18px; }
.va-notice-label { font-size: 6.5pt; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 5px; }
.va-notice-text { font-size: 7.5pt; color: #92400e; line-height: 1.65; }
.va-notice-sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px; }
.va-notice-sign-box { }
.va-notice-sign-field { border-bottom: 1px solid #cbd5e1; height: 20px; margin-top: 10px; }
.va-notice-sign-label { font-size: 6.5pt; color: #475569; margin-top: 3px; }

/* ── Footer ─────────────────────────────────────────────────────────────────── */
.va-footer {
  border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;
  padding: 10px 36px; margin-top: 4px;
}
.va-footer-logo img { height: 22px; max-width: 100px; object-fit: contain; display: block; }
.va-footer-logo-text { font-size: 10pt; font-weight: 900; letter-spacing: 0.18em; color: #ea6c00; text-transform: uppercase; }
.va-footer-center { font-size: 7pt; color: #475569; }
.va-footer-right { font-size: 7pt; color: #475569; text-align: right; }
`;

// ─── Status badge HTML ────────────────────────────────────────────────────────

function statusBadgeHtml(status: string): string {
  const colours: Record<string, string> = {
    draft:        'background:#374151;color:#d1d5db;',
    submitted:    'background:#0c4a6e;color:#7dd3fc;',
    under_review: 'background:#78350f;color:#fcd34d;',
    agreed:       'background:#065f46;color:#6ee7b7;',
    rejected:     'background:#7f1d1d;color:#fca5a5;',
    paid:         'background:#14532d;color:#86efac;',
    withdrawn:    'background:#1e293b;color:#334155;',
  };
  const labels: Record<string, string> = {
    draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
    agreed: 'Agreed', rejected: 'Rejected', paid: 'Paid', withdrawn: 'Withdrawn',
  };
  const style = colours[status] ?? 'background:#374151;color:#d1d5db;';
  return `<span class="va-status-badge" style="${style}">${esc(labels[status] ?? status)}</span>`;
}

// ─── Build-up table HTML ──────────────────────────────────────────────────────

function buildUpTableHtml(lines: DBVABuildUpLine[], total: number, showCost: boolean): string {
  if (lines.length === 0) {
    return '<p style="font-size:8pt;color:#475569;font-style:italic;padding:8px 0;">No cost build-up lines recorded.</p>';
  }

  const costColsHead = showCost
    ? `<th class="r" style="width:68px;">Cost (£)</th><th class="r" style="width:60px;">Markup (%)</th>`
    : '';

  const rows = lines.map((l, i) => {
    const salesVal = `£${l.sales_price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const totalVal = `£${l.line_total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const costCells = showCost
      ? `<td class="r">£${l.cost_price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="r">${l.markup_pct}%</td>`
      : '';
    return `<tr>
      <td><span class="bu-desc">${esc(l.description)}</span></td>
      <td><span class="bu-type">${esc(l.type)}</span></td>
      <td>${esc(l.unit || '—')}</td>
      <td class="r">${l.quantity}</td>
      ${costCells}
      <td class="r">${salesVal}</td>
      <td class="r" style="font-weight:600;color:#0f172a;">${totalVal}</td>
    </tr>`;
  }).join('');

  // Totals section
  const grandVal = `£${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const colSpanLabel = showCost ? 6 : 4;

  let tfootRows = '';
  if (showCost) {
    const totalCost = lines.reduce((s, l) => s + l.cost_price * l.quantity, 0);
    const totalSales = lines.reduce((s, l) => s + l.sales_price * l.quantity, 0);
    const totalMarkup = totalCost > 0 ? ((totalSales - totalCost) / totalCost * 100) : 0;
    const markupAmt = totalSales - totalCost;
    const costVal = `£${totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const markupVal = `£${markupAmt.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    tfootRows = `
      <tr>
        <td colspan="${colSpanLabel}" class="r" style="font-size:7.5pt;color:#334155;font-weight:600;border-top:1px solid #e2e8f0;padding-top:8px;">Total Cost (Excl. Markup)</td>
        <td class="r" style="font-size:8pt;font-weight:600;color:#0f172a;border-top:1px solid #e2e8f0;padding-top:8px;">${costVal}</td>
      </tr>
      <tr>
        <td colspan="${colSpanLabel}" class="r" style="font-size:7.5pt;color:#334155;font-weight:600;">Markup (${totalMarkup.toFixed(0)}%)</td>
        <td class="r" style="font-size:8pt;font-weight:600;color:#0f172a;">${markupVal}</td>
      </tr>
      <tr class="bu-total-row">
        <td colspan="${colSpanLabel}" class="r" style="font-size:8pt;text-transform:uppercase;letter-spacing:.05em;">Total Variation Value (Incl. Markup)</td>
        <td class="r bu-grand">${grandVal}</td>
      </tr>`;
  } else {
    tfootRows = `
      <tr class="bu-total-row">
        <td colspan="${colSpanLabel}" class="r" style="font-size:8pt;text-transform:uppercase;letter-spacing:.05em;">Total Variation Value</td>
        <td class="r bu-grand">${grandVal}</td>
      </tr>`;
  }

  return `
  <table class="bu-table">
    <thead>
      <tr>
        <th>Description</th>
        <th style="width:72px;">Type</th>
        <th style="width:38px;">Unit</th>
        <th class="r" style="width:38px;">Qty</th>
        ${costColsHead}
        <th class="r" style="width:68px;">Sales (£)</th>
        <th class="r" style="width:70px;">Total (£)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>${tfootRows}</tfoot>
  </table>`;
}

// ─── Attachment list ──────────────────────────────────────────────────────────

function vaAttachmentHtml(attachments: DBAttachment[]): string {
  if (!attachments?.length) return '<p style="font-size:8pt;color:#475569;font-style:italic;">No attachments.</p>';

  return attachments.map(a => {
    const sz = a.size
      ? (a.size < 1024 * 1024 ? `${(a.size / 1024).toFixed(0)} KB` : `${(a.size / (1024 * 1024)).toFixed(1)} MB`)
      : '';
    const uploaded = a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB') : '';
    const uploadedBy = (a as any).uploaded_by ? ` by ${esc((a as any).uploaded_by)}` : '';
    const dlLink = a.data_url
      ? `<a class="att-dl" href="${a.data_url}" download="${esc(a.name)}">Download</a>`
      : '';
    return `<div class="att-item">
      <div style="flex:1;min-width:0;">
        <div class="att-name">${esc(a.name)}</div>
        <div class="att-meta">${a.category ? esc(a.category) + ' &middot; ' : ''}${sz}${uploaded ? ' &middot; Uploaded: ' + uploaded + uploadedBy : ''}</div>
        ${dlLink ? `<div style="margin-top:3px;">${dlLink}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// Converts plain text with newlines/bullets/numbered lists into semantic HTML
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
  return `<div style="font-size:8.5pt;color:#1e293b;line-height:1.7;">${out.join('')}</div>`;
}

// ─── Shared VA page layout ────────────────────────────────────────────────────

function vaPageHeader(item: DBVariationAccountItem, variant: 'Internal' | 'Client', logoUrl?: string, today?: string): string {
  const brandHtml = logoUrl
    ? `<div class="va-header-logo"><img src="${logoUrl}" alt="Logo"></div>`
    : `<div class="va-header-logo"><div class="va-header-logo-text">VYSITE</div><div class="va-header-logo-sub">Construction Management</div></div>`;
  const badgeCls = variant === 'Internal' ? 'internal' : 'client';
  const dateStr = today ?? new Date().toLocaleDateString('en-GB');
  return `<div class="va-header">
  ${brandHtml}
  <div class="va-header-center">
    <div class="va-header-doc">Variation Account</div>
    <div class="va-header-ref">${esc(item.reference || 'VAR')}</div>
  </div>
  <div class="va-header-right">
    <div class="va-copy-badge ${badgeCls}">${variant === 'Internal' ? 'Internal Copy' : 'Client Copy'}</div>
    <div class="va-header-date">Generated: ${esc(dateStr)}</div>
  </div>
</div>`;
}

function vaInfoBand(item: DBVariationAccountItem, project?: VABuildUpData['project']): string {
  const projName = project?.name ?? '—';
  const client   = project?.client ?? '—';
  const manager  = project?.projectManager ?? '—';
  const signedVal = item.is_positive ? item.value : -item.value;
  const totalAdd  = item.is_positive  ? item.value : 0;
  const totalOmit = !item.is_positive ? item.value : 0;
  const netVal    = item.is_positive  ? item.value : -item.value;
  const netFv = (n: number) => (n < 0 ? '-' : '') + '£' + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const addCls  = totalAdd > 0 ? 'pos' : '';
  const omitCls = totalOmit > 0 ? 'neg' : '';
  const netCls  = netVal < 0 ? 'neg' : netVal > 0 ? 'pos' : 'zero';

  return `<div class="va-info-band">
  <!-- Col 1: project/client/contractor -->
  <div class="va-info-col">
    <div class="va-info-meta-row">
      <div class="va-info-label">Project</div>
      <div class="va-info-value">${esc(projName)}</div>
    </div>
    <div class="va-info-meta-row">
      <div class="va-info-label">Client</div>
      <div class="va-info-value">${esc(client)}</div>
    </div>
    <div class="va-info-meta-row">
      <div class="va-info-label">Project Manager</div>
      <div class="va-info-value">${esc(manager)}</div>
    </div>
  </div>
  <!-- Col 2: ref/date/status -->
  <div class="va-info-col">
    <div class="va-info-meta-row">
      <div class="va-info-label">Variation Account No.</div>
      <div class="va-info-value">${esc(item.reference || '—')}</div>
    </div>
    <div class="va-info-meta-row">
      <div class="va-info-label">Date Raised</div>
      <div class="va-info-value">${item.date_raised ? new Date(item.date_raised).toLocaleDateString('en-GB') : '—'}</div>
    </div>
    <div class="va-info-meta-row">
      <div class="va-info-label">Date Agreed</div>
      <div class="va-info-value">${item.date_agreed ? new Date(item.date_agreed).toLocaleDateString('en-GB') : '—'}</div>
    </div>
    <div class="va-info-meta-row">
      <div class="va-info-label">Direction</div>
      <div class="va-info-value">${item.is_positive ? 'Addition (+)' : 'Omission (-)'}</div>
    </div>
  </div>
  <!-- Col 3: summary box -->
  <div class="va-info-col" style="padding:0;">
    <div class="va-summary-box">
      <div class="va-summary-header">Summary (Incl. Markup &amp; O/H)</div>
      <div class="va-summary-row">
        <span class="va-summary-label">Total Addition</span>
        <span class="va-summary-value ${addCls}">${netFv(totalAdd)}</span>
      </div>
      <div class="va-summary-row">
        <span class="va-summary-label">Total Omission</span>
        <span class="va-summary-value ${omitCls}">${omitCls ? netFv(-totalOmit) : '£0.00'}</span>
      </div>
      <div class="va-summary-row" style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:9px 14px;">
        <span class="va-summary-total-label">Net Variation Value</span>
        <span class="va-summary-total-value ${netCls}">${netFv(signedVal)}</span>
      </div>
    </div>
  </div>
</div>`;
}

function vaVariationDetails(item: DBVariationAccountItem): string {
  const fmtD = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB') : '—';

  const dirBadge = item.is_positive
    ? `<span class="va-direction-badge va-direction-add">Addition (+)</span>`
    : `<span class="va-direction-badge va-direction-omit">Omission (-)</span>`;

  const valueFmt = '£' + Math.abs(item.value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<div class="va-section no-break">
  <div class="va-section-head">
    <div class="va-section-title">Variation Details</div>
  </div>
  <div class="va-section-body">
    <div class="va-details-grid">
      <!-- Left column -->
      <div>
        <div class="va-detail-row">
          <div class="va-detail-label">Reference</div>
          <div class="va-detail-value bold">${esc(item.reference || '—')} &nbsp;${statusBadgeHtml(item.status)}</div>
        </div>
        <div class="va-detail-row">
          <div class="va-detail-label">Title</div>
          <div class="va-detail-value bold">${esc(item.title || '—')}</div>
        </div>
        ${item.reason ? `<div class="va-detail-row">
          <div class="va-detail-label">Reason / Cause</div>
          <div class="va-detail-value">${esc(item.reason)}</div>
        </div>` : ''}
        <div class="va-detail-row">
          <div class="va-detail-label">Value (£)</div>
          <div class="va-detail-value bold">${esc(valueFmt)}</div>
        </div>
        <div class="va-detail-row">
          <div class="va-detail-label">Direction</div>
          <div class="va-detail-value">${dirBadge}</div>
        </div>
      </div>
      <!-- Right column -->
      <div>
        <div class="va-detail-row">
          <div class="va-detail-label">Date Raised</div>
          <div class="va-detail-value">${fmtD(item.date_raised)}</div>
        </div>
        <div class="va-detail-row">
          <div class="va-detail-label">Date Agreed</div>
          <div class="va-detail-value">${fmtD(item.date_agreed)}</div>
        </div>
        ${item.notes ? `<div class="va-detail-row" style="grid-template-columns:110px 1fr;align-items:baseline;">
          <div class="va-detail-label">Notes</div>
          <div class="va-detail-value" style="white-space:pre-wrap;">${esc(item.notes)}</div>
        </div>` : ''}
      </div>
    </div>
    ${item.description ? `<div style="margin-top:12px;">
      <div class="va-detail-label" style="margin-bottom:4px;">Description</div>
      ${fmtText(item.description)}
    </div>` : ''}
  </div>
</div>`;
}

function vaContractualNotice(): string {
  return `<div class="va-notice no-break">
  <div class="va-notice-label">Contractual Notice</div>
  <div class="va-notice-text">
    This Variation Account has been raised in accordance with the terms and conditions of the contract/subcontract.
    The value and/or programme impact stated in this document is a direct result of the change described above and is not included within the original scope of works.
    We reserve the right to seek an appropriate adjustment to the Contract Sum and/or Programme as a result of this change.
    By accepting or failing to notify any objection within the contractual timeframe, the Client will be deemed to have accepted the contents of this Variation Account.
    Nothing in this document shall be construed as a waiver of any contractual right or entitlement of either party.
  </div>
  <div class="va-notice-sign-row">
    <div class="va-notice-sign-box">
      <div class="va-notice-sign-field"></div><div class="va-notice-sign-label">Authorised By</div>
      <div class="va-notice-sign-field"></div><div class="va-notice-sign-label">Name</div>
    </div>
    <div class="va-notice-sign-box">
      <div class="va-notice-sign-field"></div><div class="va-notice-sign-label">Position</div>
      <div class="va-notice-sign-field"></div><div class="va-notice-sign-label">Date</div>
    </div>
  </div>
</div>`;
}

function vaPageFooter(logoUrl?: string): string {
  const brand = logoUrl
    ? `<div class="va-footer-logo"><img src="${logoUrl}" alt="Logo"></div>`
    : `<div class="va-footer-logo-text">VYSITE</div>`;
  return `<div class="va-footer">
  ${brand}
  <div class="va-footer-center">Powered by VYSITE</div>
  <div class="va-footer-right">Page 1 of 1</div>
</div>`;
}

// ─── Internal body ────────────────────────────────────────────────────────────

function vaInternalBody(d: VABuildUpData): string {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const item = d.item;

  const atts   = d.attachments ?? [];
  const comms  = d.comments ?? [];

  const buildUpSection = `<div class="va-section no-break">
  <div class="va-section-head">
    <div class="va-section-title">VOST Build-Up Summary (Internal)</div>
  </div>
  <div class="va-section-body">
    ${buildUpTableHtml(d.lines, d.buildUpTotal, true)}
  </div>
</div>`;

  const attHtml = atts.length
    ? `<div class="va-bottom-box no-break">
        <div class="va-bottom-head">Attachments (${atts.length})</div>
        <div class="va-bottom-body">${vaAttachmentHtml(atts)}</div>
      </div>`
    : `<div class="va-bottom-box">
        <div class="va-bottom-head">Attachments</div>
        <div class="va-bottom-body"><p style="font-size:8pt;color:#475569;font-style:italic;">No attachments.</p></div>
      </div>`;

  const commHtml = `<div class="va-bottom-box no-break">
    <div class="va-bottom-head">Comments (${comms.length})</div>
    <div class="va-bottom-body">
      ${comms.length
        ? comms.map(c => `<div class="comment-item">
            <div class="comment-meta">${esc(c.author_name)}<span class="comment-ts">${c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB') + ' ' + new Date(c.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''} by ${esc(c.author_name)}</span></div>
            <div class="comment-body">${esc(c.body)}</div>
          </div>`).join('')
        : '<p style="font-size:8pt;color:#475569;font-style:italic;">No comments.</p>'}
    </div>
  </div>`;

  const approvalHtml = `<div class="va-bottom-box no-break">
    <div class="va-bottom-head">Approval</div>
    <div class="va-bottom-body">
      <div class="approval-row">
        <div class="approval-label">Raised By</div>
        <div class="approval-value">${esc(item.created_by ?? d.currentUserName ?? '—')}</div>
        <div class="approval-date">${item.date_raised ? new Date(item.date_raised).toLocaleDateString('en-GB') : ''}</div>
      </div>
      <div class="approval-row">
        <div class="approval-label">Agreed By</div>
        <div class="approval-value" style="color:#475569;">—</div>
        <div class="approval-date"></div>
      </div>
      <div class="approval-row">
        <div class="approval-label">Agreed Date</div>
        <div class="approval-value">${item.date_agreed ? new Date(item.date_agreed).toLocaleDateString('en-GB') : '—'}</div>
        <div class="approval-date"></div>
      </div>
    </div>
  </div>`;

  return `
  ${vaPageHeader(item, 'Internal', d.logoUrl, today)}
  ${vaInfoBand(item, d.project)}
  <div class="va-body">
    ${vaVariationDetails(item)}
    ${buildUpSection}
    <div class="va-bottom-grid">${attHtml}${commHtml}${approvalHtml}</div>
    ${vaContractualNotice()}
  </div>
  ${vaPageFooter(d.logoUrl)}`;
}

// ─── Client body ──────────────────────────────────────────────────────────────

function vaClientBody(d: VABuildUpData): string {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const item = d.item;
  const atts = d.attachments ?? [];

  const buildUpSection = `<div class="va-section no-break">
  <div class="va-section-head">
    <div class="va-section-title">Cost Build-Up</div>
  </div>
  <div class="va-section-body">
    ${buildUpTableHtml(d.lines, d.buildUpTotal, false)}
  </div>
</div>`;

  const attHtml = atts.length
    ? `<div class="va-bottom-box no-break">
        <div class="va-bottom-head">Attachments (${atts.length})</div>
        <div class="va-bottom-body">${vaAttachmentHtml(atts)}</div>
      </div>`
    : `<div class="va-bottom-box">
        <div class="va-bottom-head">Attachments</div>
        <div class="va-bottom-body"><p style="font-size:8pt;color:#475569;font-style:italic;">No attachments.</p></div>
      </div>`;

  const approvalHtml = `<div class="va-bottom-box no-break">
    <div class="va-bottom-head">Approval</div>
    <div class="va-bottom-body">
      <div class="approval-row">
        <div class="approval-label">Raised By</div>
        <div class="approval-value">${esc(item.created_by ?? d.currentUserName ?? '—')}</div>
        <div class="approval-date">${item.date_raised ? new Date(item.date_raised).toLocaleDateString('en-GB') : ''}</div>
      </div>
      <div class="approval-row">
        <div class="approval-label">Agreed By</div>
        <div class="approval-value" style="color:#475569;">—</div>
        <div class="approval-date"></div>
      </div>
      <div class="approval-row">
        <div class="approval-label">Agreed Date</div>
        <div class="approval-value">${item.date_agreed ? new Date(item.date_agreed).toLocaleDateString('en-GB') : '—'}</div>
        <div class="approval-date"></div>
      </div>
    </div>
  </div>`;

  const spacer = `<div style="flex:1;"></div>`;

  return `
  ${vaPageHeader(item, 'Client', d.logoUrl, today)}
  ${vaInfoBand(item, d.project)}
  <div class="va-body">
    ${vaVariationDetails(item)}
    ${buildUpSection}
    <div class="va-bottom-grid">${attHtml}${spacer}${approvalHtml}</div>
    ${vaContractualNotice()}
  </div>
  ${vaPageFooter(d.logoUrl)}`;
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
