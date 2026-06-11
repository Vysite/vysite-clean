/**
 * Commercial PDF export helpers.
 * All PDFs share a single CSS sheet and utility functions.
 * Each export function returns an HTML string suitable for openPrintTab().
 */

import { openPrintTab } from '../../lib/printTab';
import type { DBVariationAccountItem, DBCommercialApplication } from '../../lib/store';
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
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    color: #1a1a2e;
    background: white;
    font-size: 10.5px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { max-width: 860px; margin: 0 auto; padding: 48px 52px; }

  /* ── Document header ─────────────────────────────────────────────────────── */
  .doc-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 20px;
    border-bottom: 0.75px solid #1a1a2e;
    margin-bottom: 32px;
  }
  .doc-brand { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; font-weight: 800; color: #ea6c00; letter-spacing: 0.08em; line-height: 1; }
  .doc-tagline { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 7.5px; color: #94a3b8; margin-top: 4px; letter-spacing: 0.1em; text-transform: uppercase; }
  .doc-header-right { text-align: right; }
  .doc-type { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 5px; }
  .doc-title { font-size: 20px; font-weight: 700; color: #1a1a2e; line-height: 1.15; margin-bottom: 4px; }
  .doc-project { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 10px; color: #475569; }

  /* ── Project summary strip ───────────────────────────────────────────────── */
  .project-strip {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0 0 14px;
    border-bottom: 0.75px solid #e2e8f0;
    margin-bottom: 32px;
  }
  .project-strip-name { font-size: 15px; font-weight: 700; color: #1a1a2e; }
  .project-strip-client { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9.5px; color: #64748b; }
  .project-strip-meta { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 8.5px; color: #94a3b8; text-align: right; }

  /* ── Section headings ────────────────────────────────────────────────────── */
  .section-rule { border: none; border-top: 0.75px solid #e2e8f0; margin: 36px 0 22px; }
  .section-label {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 7.5px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: 18px;
  }

  /* ── Financial statement ─────────────────────────────────────────────────── */
  .fin-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .fin-row td { padding: 6px 0; vertical-align: baseline; }
  .fin-row td:last-child { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .fin-label { font-size: 10.5px; color: #334155; padding-right: 12px; }
  .fin-sub { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 8px; color: #94a3b8; display: block; margin-top: 1px; }
  .fin-value { font-size: 11px; font-weight: 600; color: #1a1a2e; }
  .fin-rule td { border-top: 0.75px solid #e2e8f0; padding-top: 0; height: 10px; }
  .fin-total td { padding: 8px 0 10px; border-top: 0.75px solid #1a1a2e; }
  .fin-total .fin-label { font-size: 11px; font-weight: 700; color: #1a1a2e; }
  .fin-total .fin-value { font-size: 15px; font-weight: 700; color: #ea6c00; letter-spacing: -0.01em; }
  .fin-accent .fin-label { color: #92400e; }
  .fin-accent .fin-value { color: #92400e; }

  /* ── Applications valuation summary ─────────────────────────────────────── */
  .val-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 32px; }
  .val-row { display: flex; align-items: baseline; justify-content: space-between; padding: 7px 0; border-bottom: 0.75px solid #f1f5f9; }
  .val-row:last-child { border-bottom: none; }
  .val-col { padding: 0 0 0 28px; }
  .val-col:first-child { padding: 0 28px 0 0; border-right: 0.75px solid #f1f5f9; }
  .val-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 8.5px; color: #64748b; }
  .val-value { font-size: 11px; font-weight: 600; color: #1a1a2e; font-variant-numeric: tabular-nums; }
  .val-value.warn { color: #92400e; }
  .val-value.danger { color: #991b1b; }
  .val-total-block { grid-column: 1 / -1; display: flex; align-items: baseline; justify-content: space-between; margin-top: 14px; padding-top: 12px; border-top: 0.75px solid #1a1a2e; }
  .val-total-label { font-size: 11px; font-weight: 700; color: #1a1a2e; }
  .val-total-value { font-size: 16px; font-weight: 700; color: #ea6c00; font-variant-numeric: tabular-nums; }

  /* ── Data table (clean, minimal) ─────────────────────────────────────────── */
  .data-table { width: 100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9.5px; }
  .data-table th {
    padding: 0 10px 8px 0;
    text-align: left;
    font-size: 7.5px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    border-bottom: 0.75px solid #1a1a2e;
    white-space: nowrap;
  }
  .data-table th.num { text-align: right; padding-right: 0; }
  .data-table td { padding: 8px 10px 8px 0; border-bottom: 0.75px solid #f1f5f9; color: #1e293b; vertical-align: top; }
  .data-table td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; padding-right: 0; }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table .ref { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9px; font-weight: 700; color: #ea6c00; }
  .data-table .strong { font-weight: 600; color: #1a1a2e; }
  .data-table .muted { color: #94a3b8; }

  /* ── Record entry (register) ─────────────────────────────────────────────── */
  .record-entry { padding: 18px 0; border-bottom: 0.75px solid #f1f5f9; page-break-inside: avoid; }
  .record-entry:last-child { border-bottom: none; }
  .record-entry-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
  .record-ref { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9px; font-weight: 700; color: #ea6c00; margin-right: 10px; letter-spacing: 0.04em; }
  .record-title { font-size: 12px; font-weight: 700; color: #1a1a2e; }
  .record-meta { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 8.5px; color: #64748b; margin-top: 6px; display: flex; gap: 20px; flex-wrap: wrap; }
  .record-meta-item { display: flex; gap: 5px; }
  .record-meta-key { color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; font-size: 7.5px; }
  .record-notes { font-size: 9.5px; color: #475569; margin-top: 8px; padding-top: 8px; border-top: 0.75px solid #f1f5f9; line-height: 1.5; white-space: pre-wrap; }

  /* ── Status tag (inline text, no box) ───────────────────────────────────── */
  .tag { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }
  .tag-green  { background: #f0fdf4; color: #166534; }
  .tag-amber  { background: #fffbeb; color: #92400e; }
  .tag-orange { background: #fff7ed; color: #c2410c; }
  .tag-blue   { background: #eff6ff; color: #1e40af; }
  .tag-red    { background: #fef2f2; color: #991b1b; }
  .tag-slate  { background: #f8fafc; color: #475569; }

  /* ── Timeline ────────────────────────────────────────────────────────────── */
  .tl-wrap { padding-left: 24px; }
  .tl-entry { display: flex; gap: 16px; margin-bottom: 0; page-break-inside: avoid; }
  .tl-left { text-align: right; min-width: 80px; padding-top: 1px; flex-shrink: 0; }
  .tl-date { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9px; color: #64748b; }
  .tl-right { flex: 1; padding-bottom: 20px; border-left: 1px solid #e2e8f0; padding-left: 18px; position: relative; }
  .tl-right::before { content: ''; position: absolute; left: -4.5px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: var(--dot-color, #94a3b8); }
  .tl-kind { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 3px; }
  .tl-title { font-size: 11px; font-weight: 600; color: #1a1a2e; margin-bottom: 3px; }
  .tl-ref { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9px; color: #ea6c00; margin-right: 6px; font-weight: 700; }
  .tl-val { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9px; font-weight: 700; margin-left: 8px; font-variant-numeric: tabular-nums; }
  .tl-sub { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 8.5px; color: #94a3b8; }
  .tl-entry:last-child .tl-right { border-left-color: transparent; }

  /* ── Key dates ───────────────────────────────────────────────────────────── */
  .kd-table { width: 100%; border-collapse: collapse; }
  .kd-table td { padding: 8px 12px 8px 0; border-bottom: 0.75px solid #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9.5px; vertical-align: baseline; }
  .kd-table tr:last-child td { border-bottom: none; }
  .kd-date { color: #64748b; width: 80px; white-space: nowrap; font-size: 9px; }
  .kd-title { font-weight: 600; color: #1a1a2e; }
  .kd-desc { color: #64748b; padding-left: 12px; }
  .kd-status { width: 70px; text-align: right; }
  .kd-days { width: 90px; text-align: right; color: #94a3b8; font-size: 8.5px; }

  /* ── Cover page ──────────────────────────────────────────────────────────── */
  .cover { padding: 0 0 40px; border-bottom: 0.75px solid #1a1a2e; margin-bottom: 40px; }
  .cover-brand { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; font-weight: 800; color: #ea6c00; letter-spacing: 0.1em; margin-bottom: 60px; }
  .cover-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 14px; }
  .cover-title { font-size: 32px; font-weight: 700; color: #1a1a2e; line-height: 1.1; margin-bottom: 24px; }
  .cover-project { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
  .cover-client { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #64748b; margin-bottom: 28px; }
  .cover-figures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border-top: 0.75px solid #e2e8f0; border-bottom: 0.75px solid #e2e8f0; padding: 20px 0; margin-bottom: 28px; }
  .cover-figure { padding: 0 20px 0 0; }
  .cover-figure:not(:last-child) { border-right: 0.75px solid #e2e8f0; margin-right: 20px; }
  .cover-figure-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
  .cover-figure-value { font-size: 18px; font-weight: 700; color: #1a1a2e; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .cover-figure-value.accent { color: #ea6c00; }
  .cover-date { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 8.5px; color: #94a3b8; }

  /* ── Page break ──────────────────────────────────────────────────────────── */
  .page-break { page-break-before: always; padding-top: 48px; }

  /* ── Footer ──────────────────────────────────────────────────────────────── */
  .doc-footer {
    margin-top: 48px;
    padding-top: 12px;
    border-top: 0.75px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .doc-footer-left { font-size: 7.5px; color: #94a3b8; }
  .doc-footer-right { font-size: 7.5px; color: #94a3b8; text-align: right; }

  .empty-notice { padding: 24px; text-align: center; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9.5px; border-top: 0.75px solid #f1f5f9; }

  @media print {
    .page { padding: 32px 36px; }
    .record-entry { page-break-inside: avoid; }
    .tl-entry { page-break-inside: avoid; }
  }
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

function docHeader(docType: string, title: string, projectName: string, client?: string, today?: string): string {
  return `
  <div class="doc-header">
    <div>
      <div class="doc-brand">VYSITE</div>
      <div class="doc-tagline">Construction Operating System</div>
    </div>
    <div class="doc-header-right">
      <div class="doc-type">${esc(docType)}</div>
      <div class="doc-title">${esc(title)}</div>
      <div class="doc-project">${esc(projectName)}${client ? ' &mdash; ' + esc(client) : ''}</div>
    </div>
  </div>
  ${today ? `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:8px;color:#94a3b8;text-align:right;margin-top:-22px;margin-bottom:28px;">${today}</div>` : ''}`;
}

// ─── Shared footer ────────────────────────────────────────────────────────────

function docFooter(generatedBy: string, today: string): string {
  return `
  <div class="doc-footer">
    <div class="doc-footer-left">Confidential &mdash; VYSITE Commercial Document</div>
    <div class="doc-footer-right">${esc(generatedBy || 'VYSITE')} &bull; ${today} &bull; &copy; VYSITE</div>
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
  return `<table class="kd-table">${rows}</table>`;
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
}

function positionStatementBody(d: PositionData): string {
  const today = todayStr();
  const forecastContractSum = d.contractNum + d.variationExposure;
  const adjustedContractSum = d.contractNum + d.agreedVariations;
  const remainingValue = d.completedNum != null ? adjustedContractSum - d.completedNum : null;

  const statRows: StatRow[] = [
    { label: 'Original Contract Sum', value: d.contractNum > 0 ? fv(d.contractNum) : '—' },
  ];
  if (d.variationExposure !== 0) {
    statRows.push({ label: 'Outstanding Variation Exposure', sub: 'Submitted + Under Review', value: `+${fv(d.variationExposure)}`, style: 'accent' });
  }
  statRows.push({ label: 'Forecast Contract Sum', value: d.contractNum > 0 ? fv(forecastContractSum) : '—', style: 'total' });
  if (d.agreedVariations !== 0) {
    statRows.push({ label: 'Agreed Variations', value: `+${fv(d.agreedVariations)}` });
  }
  statRows.push({ label: 'Adjusted Contract Sum', value: d.contractNum > 0 ? fv(adjustedContractSum) : '—', style: 'total' });
  if (d.completedNum != null) {
    statRows.push({ label: 'Completed / Certified Value', value: fv(d.completedNum) });
  }
  if (remainingValue != null) {
    statRows.push({ label: 'Remaining Value', value: fv(remainingValue) });
  }

  const meta = [
    ['Project Manager', d.project.projectManager || '—'],
    ['Location', d.project.location || '—'],
    ['Start Date', fmtD(d.project.startDate)],
    ['Completion Date', fmtD(d.project.completionDate)],
    ['Status', d.project.status || '—'],
    ['Generated By', d.currentUserName || '—'],
  ].map(([k, v]) => `<span style="margin-right:28px;"><span style="font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;font-size:7.5px;">${esc(k)}&ensp;</span><span style="color:#334155;">${esc(v)}</span></span>`).join('');

  return `
  ${docHeader('Commercial Document', 'Position Statement', d.project.name, d.project.client, today)}

  <div class="project-strip">
    <div>
      <div class="project-strip-name">${esc(d.project.name)}</div>
      ${d.project.client ? `<div class="project-strip-client">${esc(d.project.client)}</div>` : ''}
    </div>
    <div class="project-strip-meta" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:8.5px;color:#94a3b8;text-align:right;">
      ${d.contractNum > 0 ? `<div style="font-size:18px;font-weight:700;color:#1a1a2e;font-variant-numeric:tabular-nums;">${fv(d.contractNum)}</div><div style="font-size:7.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Original Contract Sum</div>` : ''}
    </div>
  </div>

  <div class="section-label">Commercial Position</div>
  ${finStatement(statRows)}

  <div style="margin-top:24px;padding-top:16px;border-top:0.75px solid #f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:8.5px;color:#475569;line-height:2;">${meta}</div>

  ${d.keyDates.length > 0 ? `
  <hr class="section-rule">
  <div class="section-label">Key Dates</div>
  ${keyDatesTable(d.keyDates)}` : ''}

  ${docFooter(d.currentUserName, today)}`;
}

// ─── Register body ────────────────────────────────────────────────────────────

interface RegisterData {
  project: Project | null;
  records: CommercialRecord[];
  currentUserName: string;
}

function registerBody(d: RegisterData): string {
  const today = todayStr();
  const projName = d.project?.name ?? 'All Projects';

  const entries = d.records.map(r => {
    const ti = typeInfo(r.recordType);
    const si = statusInfo(r.status);
    const dateMeta = [
      r.dateRaised ? `Raised ${fmtD(r.dateRaised)}` : null,
      r.dateSubmitted ? `Submitted ${fmtD(r.dateSubmitted)}` : null,
      r.dateAgreed ? `Agreed ${fmtD(r.dateAgreed)}` : null,
    ].filter(Boolean).join(' &bull; ');

    return `
    <div class="record-entry">
      <div class="record-entry-header">
        <div>
          <span class="record-ref">${esc(r.reference || '—')}</span>
          <span class="record-title">${esc(r.title || 'Untitled')}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;margin-left:12px;">
          ${typeTag(r.recordType, ti.label)}
          ${statusTag(r.status, si.label)}
        </div>
      </div>
      <div class="record-meta">
        ${r.projectName ? `<span class="record-meta-item"><span class="record-meta-key">Project</span><span>${esc(r.projectName)}</span></span>` : ''}
        ${r.client ? `<span class="record-meta-item"><span class="record-meta-key">Client</span><span>${esc(r.client)}</span></span>` : ''}
        ${r.createdBy ? `<span class="record-meta-item"><span class="record-meta-key">By</span><span>${esc(r.createdBy)}</span></span>` : ''}
        ${dateMeta ? `<span style="color:#94a3b8;">${dateMeta}</span>` : ''}
      </div>
      ${r.notes ? `<div class="record-notes">${esc(r.notes)}</div>` : ''}
    </div>`;
  }).join('');

  return `
  ${docHeader('Commercial Document', 'Commercial Register', projName, d.project?.client, today)}

  <div class="project-strip">
    <div>
      <div class="project-strip-name">${esc(projName)}</div>
      ${d.project?.client ? `<div class="project-strip-client">${esc(d.project.client)}</div>` : ''}
    </div>
    <div class="project-strip-meta">
      <div style="font-size:18px;font-weight:700;color:#1a1a2e;">${d.records.length}</div>
      <div style="font-size:7.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Record${d.records.length !== 1 ? 's' : ''}</div>
    </div>
  </div>

  <div class="section-label">Commercial Records</div>
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
    const valColor = val >= 0 ? '#166534' : '#991b1b';
    return `<tr>
      <td class="ref">${esc(item.reference || '—')}</td>
      <td class="strong">${esc(item.title || 'Untitled')}</td>
      <td style="color:#64748b;font-size:9px;">${esc(item.description || '—')}</td>
      <td style="color:#64748b;font-size:9px;">${esc(item.reason || '—')}</td>
      <td class="num" style="color:${valColor};font-weight:700;">${val >= 0 ? '+' : ''}${fv(val)}</td>
      <td>${statusTag(item.status, vaStatusLabels[item.status] || item.status)}</td>
      <td style="color:#64748b;font-size:9px;">${fmtD(item.date_raised)}</td>
      <td style="color:#64748b;font-size:9px;">${fmtD(item.date_agreed)}</td>
    </tr>`;
  }).join('');

  const statRows: StatRow[] = [
    { label: 'Outstanding Variation Exposure', sub: 'Submitted + Under Review', value: fv(d.vaExposure), style: 'accent' },
    { label: 'Forecast Contract Sum', value: d.forecastContractSum > 0 ? fv(d.forecastContractSum) : '—', style: 'total' },
    { label: 'Agreed Variations', value: fv(d.vaAgreed) },
    { label: 'Adjusted Contract Sum', value: d.adjustedContractSum > 0 ? fv(d.adjustedContractSum) : '—', style: 'total' },
  ];

  return `
  ${docHeader('Commercial Document', 'Variation Account', projName, d.project?.client, today)}

  <div class="project-strip">
    <div>
      <div class="project-strip-name">${esc(projName)}</div>
      ${d.project?.client ? `<div class="project-strip-client">${esc(d.project.client)}</div>` : ''}
    </div>
    <div class="project-strip-meta">
      <div style="font-size:18px;font-weight:700;color:#ea6c00;font-variant-numeric:tabular-nums;">${fv(d.vaExposure)}</div>
      <div style="font-size:7.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Variation Exposure</div>
    </div>
  </div>

  <div class="section-label">Account Position</div>
  ${finStatement(statRows)}

  ${d.items.length > 0 ? `
  <hr class="section-rule">
  <div class="section-label">Variation Account Items &mdash; ${d.items.length} item${d.items.length !== 1 ? 's' : ''}</div>
  <table class="data-table">
    <thead><tr>
      <th style="width:60px">Ref</th>
      <th>Title</th>
      <th>Description</th>
      <th>Reason</th>
      <th class="num">Value</th>
      <th>Status</th>
      <th style="width:68px">Raised</th>
      <th style="width:68px">Agreed</th>
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
  value?: number;
  isPositive?: boolean;
  createdBy?: string | null;
}

interface TimelineData {
  project: Project | null;
  events: TimelineEvent[];
  currentUserName: string;
}

const KIND_DOT: Record<string, string> = {
  'va-raised':   '#d97706',
  'va-agreed':   '#16a34a',
  'cr-added':    '#ea6c00',
  'cr-submitted':'#2563eb',
  'cr-agreed':   '#16a34a',
};
const KIND_LABEL: Record<string, string> = {
  'va-raised':   'Variation Raised',
  'va-agreed':   'Variation Agreed',
  'cr-added':    'Record Added',
  'cr-submitted':'Submitted',
  'cr-agreed':   'Agreed',
};

function timelineBody(d: TimelineData): string {
  const today = todayStr();
  const projName = d.project?.name ?? '—';

  const eventRows = d.events.map(e => {
    const dot  = KIND_DOT[e.kind]  || '#94a3b8';
    const klbl = KIND_LABEL[e.kind] || e.kind;
    const val  = e.value != null
      ? `<span class="tl-val" style="color:${e.isPositive ? '#16a34a' : '#991b1b'};">${e.isPositive ? '+' : ''}${fv(e.isPositive ? e.value : -e.value)}</span>`
      : '';
    return `<div class="tl-entry">
      <div class="tl-left"><div class="tl-date">${esc(e.displayDate)}</div></div>
      <div class="tl-right" style="--dot-color:${dot}">
        <div class="tl-kind">${klbl} &bull; ${esc(e.source)}</div>
        <div class="tl-title"><span class="tl-ref">${esc(e.reference || '')}</span>${esc(e.title || '')}${val}</div>
        ${e.statusLabel || e.createdBy ? `<div class="tl-sub">${e.statusLabel ? esc(e.statusLabel) : ''}${e.createdBy ? ' &bull; ' + esc(e.createdBy) : ''}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `
  ${docHeader('Commercial Document', 'Commercial Timeline', projName, d.project?.client, today)}

  <div class="project-strip">
    <div>
      <div class="project-strip-name">${esc(projName)}</div>
      ${d.project?.client ? `<div class="project-strip-client">${esc(d.project.client)}</div>` : ''}
    </div>
    <div class="project-strip-meta">
      <div style="font-size:18px;font-weight:700;color:#1a1a2e;">${d.events.length}</div>
      <div style="font-size:7.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Event${d.events.length !== 1 ? 's' : ''}</div>
    </div>
  </div>

  <div class="section-label">Timeline</div>
  ${d.events.length === 0
    ? '<div class="empty-notice">No timeline events recorded for this project.</div>'
    : `<div class="tl-wrap">${eventRows}</div>`}
  ${docFooter(d.currentUserName, today)}`;
}

// ─── Full Commercial Report body ──────────────────────────────────────────────

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
  const cover = `
  <div class="cover">
    <div class="cover-brand">VYSITE</div>
    <div class="cover-label">Commercial Report</div>
    <div class="cover-title">Full Commercial<br>Report</div>
    <div class="cover-project">${esc(p.name)}</div>
    ${p.client ? `<div class="cover-client">${esc(p.client)}</div>` : ''}
    ${d.contractNum > 0 ? `
    <div class="cover-figures">
      <div class="cover-figure">
        <div class="cover-figure-label">Contract Sum</div>
        <div class="cover-figure-value">${fv(d.contractNum)}</div>
      </div>
      <div class="cover-figure">
        <div class="cover-figure-label">Forecast Contract Sum</div>
        <div class="cover-figure-value accent">${fv(forecastContractSum)}</div>
      </div>
      ${d.completedNum != null ? `
      <div class="cover-figure">
        <div class="cover-figure-label">Completed Value</div>
        <div class="cover-figure-value">${fv(d.completedNum)}</div>
      </div>` : `
      <div class="cover-figure">
        <div class="cover-figure-label">Variation Exposure</div>
        <div class="cover-figure-value accent">${fv(d.vaExposure)}</div>
      </div>`}
    </div>` : ''}
    <div class="cover-date">Generated ${today} by ${esc(d.currentUserName || 'VYSITE')}</div>
  </div>`;

  // ── Position statement rows ──
  const statRows: StatRow[] = [
    { label: 'Original Contract Sum', value: d.contractNum > 0 ? fv(d.contractNum) : '—' },
  ];
  if (d.variationExposure !== 0) statRows.push({ label: 'Outstanding Variation Exposure', sub: 'Submitted + Under Review', value: `+${fv(d.variationExposure)}`, style: 'accent' });
  statRows.push({ label: 'Forecast Contract Sum', value: d.contractNum > 0 ? fv(forecastContractSum) : '—', style: 'total' });
  if (d.agreedVariations !== 0) statRows.push({ label: 'Agreed Variations', value: `+${fv(d.agreedVariations)}` });
  statRows.push({ label: 'Adjusted Contract Sum', value: d.contractNum > 0 ? fv(adjustedContractSum) : '—', style: 'total' });
  if (d.completedNum != null) statRows.push({ label: 'Completed Value', value: fv(d.completedNum) });
  if (remainingValue != null) statRows.push({ label: 'Remaining Value', value: fv(remainingValue) });

  // ── Register rows ──
  const regRows = d.records.map(r => {
    const ti = typeInfo(r.recordType);
    const si = statusInfo(r.status);
    return `<tr>
      <td>${typeTag(r.recordType, ti.label)}</td>
      <td class="ref">${esc(r.reference || '—')}</td>
      <td class="strong">${esc(r.title || 'Untitled')}</td>
      <td>${statusTag(r.status, si.label)}</td>
      <td style="color:#64748b;font-size:9px;">${fmtD(r.dateRaised)}</td>
    </tr>`;
  }).join('');

  // ── VA rows ──
  const vaStatusLabels: Record<string, string> = { draft:'Draft', submitted:'Submitted', under_review:'Under Review', agreed:'Agreed', rejected:'Rejected', paid:'Paid', withdrawn:'Withdrawn' };
  const vaRows = d.vaItems.map(item => {
    const val = item.is_positive ? item.value : -item.value;
    return `<tr>
      <td class="ref">${esc(item.reference || '—')}</td>
      <td class="strong">${esc(item.title)}</td>
      <td class="num" style="color:${val >= 0 ? '#166534' : '#991b1b'};font-weight:700;">${val >= 0 ? '+' : ''}${fv(val)}</td>
      <td>${statusTag(item.status, vaStatusLabels[item.status] || item.status)}</td>
      <td style="color:#64748b;font-size:9px;">${fmtD(item.date_raised)}</td>
    </tr>`;
  }).join('');

  // ── App rows ──
  const appRows = d.apps.map(a => `<tr>
    <td class="ref">${String(a.app_number).padStart(2, '0')}</td>
    <td class="strong">${esc(a.period || '—')}</td>
    <td class="num">${fv(a.applied_value)}</td>
    <td class="num">${fv(a.certified_value)}</td>
    <td class="num">${fv(a.paid_value)}</td>
    <td>${statusTag(a.status, APP_STATUS_LABELS[a.status] || a.status)}</td>
  </tr>`).join('');

  // ── Timeline rows ──
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

  return `
  ${cover}

  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:8.5px;color:#64748b;line-height:2;margin-bottom:36px;">
    <span style="margin-right:28px;"><span style="font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;font-size:7.5px;">Project Manager&ensp;</span>${esc(p.projectManager || '—')}</span>
    <span style="margin-right:28px;"><span style="font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;font-size:7.5px;">Location&ensp;</span>${esc(p.location || '—')}</span>
    <span style="margin-right:28px;"><span style="font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;font-size:7.5px;">Start&ensp;</span>${fmtD(p.startDate)}</span>
    <span><span style="font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;font-size:7.5px;">Completion&ensp;</span>${fmtD(p.completionDate)}</span>
  </div>

  <div class="section-label">1. Commercial Position</div>
  ${finStatement(statRows)}

  <hr class="section-rule">
  <div class="section-label">2. Key Dates</div>
  ${keyDatesTable(d.keyDates)}

  <div class="page-break">
  <div class="section-label">3. Commercial Register &mdash; ${d.records.length} record${d.records.length !== 1 ? 's' : ''}</div>
  ${d.records.length === 0
    ? '<div class="empty-notice">No commercial register records for this project.</div>'
    : `<table class="data-table"><thead><tr><th>Type</th><th style="width:60px">Ref</th><th>Title</th><th>Status</th><th style="width:72px">Raised</th></tr></thead><tbody>${regRows}</tbody></table>`}

  <hr class="section-rule">
  <div class="section-label">4. Variation Account &mdash; ${d.vaItems.length} item${d.vaItems.length !== 1 ? 's' : ''}</div>
  ${d.vaItems.length === 0
    ? '<div class="empty-notice">No variation account items for this project.</div>'
    : `<table class="data-table"><thead><tr><th style="width:60px">Ref</th><th>Title</th><th class="num">Value</th><th>Status</th><th style="width:72px">Raised</th></tr></thead><tbody>${vaRows}</tbody></table>`}
  </div>

  <div class="page-break">
  <div class="section-label">5. Valuation Applications &mdash; ${d.apps.length} application${d.apps.length !== 1 ? 's' : ''}</div>
  <div class="val-summary" style="margin-bottom:20px;">
    <div class="val-col">
      ${[['Applied To Date', fv(appliedToDate), false], ['Certified To Date', fv(certifiedToDate), false], ['Certification Shortfall', fv(certShortfall), certShortfall > 0]].map(([l, v, w]) => `<div class="val-row"><div class="val-label">${l}</div><div class="val-value${w ? ' warn' : ''}">${v}</div></div>`).join('')}
    </div>
    <div class="val-col">
      ${[['Paid To Date', fv(paidToDate), false], ['Outstanding', fv(outstanding), outstanding > 0], ['Retention', fv(totalRetention), false]].map(([l, v, w]) => `<div class="val-row"><div class="val-label">${l}</div><div class="val-value${w ? ' warn' : ''}">${v}</div></div>`).join('')}
    </div>
    ${remaining != null ? `<div class="val-total-block"><div class="val-total-label">Remaining Contract Value</div><div class="val-total-value">${fv(remaining)}</div></div>` : ''}
  </div>
  ${d.apps.length === 0
    ? '<div class="empty-notice">No applications for this project.</div>'
    : `<table class="data-table" style="font-size:9px;"><thead><tr><th style="width:28px">No.</th><th>Period</th><th class="num">Applied</th><th class="num">Certified</th><th class="num">Paid</th><th>Status</th></tr></thead><tbody>${appRows}</tbody></table>`}

  <hr class="section-rule">
  <div class="section-label">6. Commercial Timeline &mdash; ${d.events.length} event${d.events.length !== 1 ? 's' : ''}</div>
  ${d.events.length === 0
    ? '<div class="empty-notice">No timeline events for this project.</div>'
    : `<div class="tl-wrap">${tlRows}</div>`}
  </div>

  ${docFooter(d.currentUserName, today)}`;
}

// ─── Public export functions ──────────────────────────────────────────────────

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
