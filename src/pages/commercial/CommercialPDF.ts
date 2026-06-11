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
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1e293b; background: white; font-size: 11px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 900px; margin: 0 auto; padding: 36px 40px; }

  /* ── Header ─────────────────────────────────────────────────────────────── */
  .doc-header { display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid #f97316; margin-bottom: 22px; }
  .doc-logo-text { font-size: 24px; font-weight: 900; color: #f97316; letter-spacing: 0.05em; line-height: 1; }
  .doc-tagline { font-size: 8.5px; color: #94a3b8; margin-top: 3px; letter-spacing: 0.06em; text-transform: uppercase; }
  .doc-header-right { text-align: right; }
  .doc-title { font-size: 18px; font-weight: 900; color: #0f172a; line-height: 1.2; margin-bottom: 3px; }
  .doc-dateline { font-size: 10px; color: #64748b; }

  /* ── Report meta grid ────────────────────────────────────────────────────── */
  .report-meta { display: grid; grid-template-columns: 140px 1fr 140px 1fr; gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 22px; }
  .report-meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; padding: 7px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
  .report-meta-value { font-size: 10.5px; font-weight: 600; color: #0f172a; padding: 7px 12px; background: white; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
  .report-meta-value:nth-child(4n) { border-right: none; }

  /* ── Section headings ────────────────────────────────────────────────────── */
  .section-heading { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 12px; margin-top: 26px; }
  .section-heading:first-of-type { margin-top: 0; }

  /* ── Financial statement block ───────────────────────────────────────────── */
  .statement-block { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 22px; }
  .statement-header { background: #f1f5f9; padding: 8px 14px; border-bottom: 1px solid #e2e8f0; }
  .statement-header-title { font-size: 9px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.1em; }
  .statement-row { display: flex; align-items: baseline; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid #f1f5f9; }
  .statement-row:last-child { border-bottom: none; }
  .statement-row.statement-total { background: #f8fafc; }
  .statement-row.statement-accent { background: #fff7ed; }
  .statement-label { font-size: 10.5px; color: #334155; }
  .statement-sub { font-size: 8.5px; color: #94a3b8; margin-top: 1px; }
  .statement-value { font-size: 11.5px; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
  .statement-total .statement-label { font-weight: 700; color: #0f172a; }
  .statement-total .statement-value { font-size: 13px; color: #f97316; }
  .statement-divider { height: 1px; background: #e2e8f0; margin: 0; }

  /* ── Summary KPI bar ─────────────────────────────────────────────────────── */
  .kpi-bar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 22px; }
  .kpi-cell { padding: 10px 10px 8px; background: #f8fafc; border-right: 1px solid #e2e8f0; }
  .kpi-cell:last-child { border-right: none; }
  .kpi-label { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 4px; }
  .kpi-value { font-size: 11px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
  .kpi-value.warning { color: #b45309; }
  .kpi-value.danger  { color: #b91c1c; }
  .kpi-value.positive{ color: #047857; }

  /* ── Data table ──────────────────────────────────────────────────────────── */
  .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .data-table th { padding: 8px 10px; text-align: left; font-size: 8px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.06em; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
  .data-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: top; }
  .data-table tr:nth-child(even) td { background: #f8fafc; }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table .mono { font-family: monospace; font-size: 9.5px; font-weight: 700; color: #f97316; }
  .data-table .num  { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }

  /* ── Record detail card ──────────────────────────────────────────────────── */
  .record-card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 14px; page-break-inside: avoid; }
  .record-card-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  .record-card-ref { font-family: monospace; font-size: 10px; font-weight: 700; color: #f97316; margin-right: 8px; }
  .record-card-title { font-size: 11.5px; font-weight: 700; color: #0f172a; }
  .record-card-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .record-card-field { padding: 7px 14px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; }
  .record-card-field:nth-child(2n) { border-right: none; }
  .record-card-field:last-child, .record-card-field:nth-last-child(2):nth-child(odd) { border-bottom: none; }
  .field-label { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
  .field-value { font-size: 10.5px; color: #1e293b; }
  .record-card-notes { padding: 10px 14px; border-top: 1px solid #f1f5f9; background: #fafafa; }
  .record-card-notes .field-label { margin-bottom: 4px; }
  .record-card-notes .field-value { font-size: 10px; color: #475569; white-space: pre-wrap; }
  .record-card-full { padding: 7px 14px; border-bottom: 1px solid #f1f5f9; }

  /* ── Badges ──────────────────────────────────────────────────────────────── */
  .badge { display: inline-block; font-size: 8px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
  .badge-orange { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
  .badge-green  { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
  .badge-amber  { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
  .badge-blue   { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
  .badge-slate  { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
  .badge-red    { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
  .badge-sky    { background: #e0f2fe; color: #0c4a6e; border: 1px solid #bae6fd; }
  .badge-teal   { background: #ccfbf1; color: #134e4a; border: 1px solid #99f6e4; }

  /* ── Timeline ────────────────────────────────────────────────────────────── */
  .timeline-row { display: grid; grid-template-columns: 90px 12px 1fr; gap: 0 12px; margin-bottom: 10px; page-break-inside: avoid; }
  .timeline-date { font-size: 9.5px; color: #64748b; padding-top: 3px; text-align: right; white-space: nowrap; }
  .timeline-dot-col { display: flex; flex-direction: column; align-items: center; }
  .timeline-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }
  .timeline-line { flex: 1; width: 2px; background: #e2e8f0; margin-top: 3px; }
  .timeline-content { padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
  .timeline-content:last-child { border-bottom: none; }
  .timeline-kind { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .timeline-title { font-size: 10.5px; font-weight: 600; color: #0f172a; margin-bottom: 2px; }
  .timeline-ref { font-family: monospace; font-size: 9.5px; color: #f97316; margin-right: 6px; }
  .timeline-meta { font-size: 9px; color: #94a3b8; }

  /* ── Cover page ──────────────────────────────────────────────────────────── */
  .cover-page { min-height: 260px; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 28px; border-bottom: 3px solid #f97316; margin-bottom: 28px; }
  .cover-brand { font-size: 32px; font-weight: 900; color: #f97316; letter-spacing: 0.04em; margin-bottom: 6px; }
  .cover-tagline { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 28px; }
  .cover-report-title { font-size: 26px; font-weight: 900; color: #0f172a; line-height: 1.2; margin-bottom: 8px; }
  .cover-project { font-size: 14px; color: #334155; margin-bottom: 4px; }
  .cover-client { font-size: 12px; color: #64748b; }
  .cover-date { font-size: 10px; color: #94a3b8; margin-top: 16px; }

  /* ── Page break ──────────────────────────────────────────────────────────── */
  .page-break { page-break-before: always; padding-top: 20px; }

  /* ── Footer ──────────────────────────────────────────────────────────────── */
  .doc-footer { margin-top: 36px; padding-top: 10px; border-top: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
  .doc-footer-left { font-size: 8px; color: #94a3b8; }
  .doc-footer-right { font-size: 8px; color: #94a3b8; text-align: right; }

  .empty-notice { padding: 20px; text-align: center; color: #94a3b8; font-size: 10px; background: #f8fafc; border: 1px dashed #e2e8f0; border-radius: 6px; margin-bottom: 16px; }

  @media print {
    .page { padding: 20px 24px; }
    .record-card { page-break-inside: avoid; }
    .timeline-row { page-break-inside: avoid; }
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

function docHeader(title: string, projectName: string, client?: string): string {
  return `
  <div class="doc-header">
    <div>
      <div class="doc-logo-text">VYSITE</div>
      <div class="doc-tagline">Construction Operating System</div>
    </div>
    <div class="doc-header-right">
      <div class="doc-title">${esc(title)}</div>
      <div class="doc-dateline">${esc(projectName)}${client ? ' &mdash; ' + esc(client) : ''}</div>
    </div>
  </div>`;
}

// ─── Shared report meta block ─────────────────────────────────────────────────

interface MetaEntry { label: string; value: string; }

function reportMeta(entries: MetaEntry[]): string {
  const cells = entries.map(e =>
    `<div class="report-meta-label">${esc(e.label)}</div><div class="report-meta-value">${esc(e.value)}</div>`
  ).join('');
  return `<div class="report-meta">${cells}</div>`;
}

// ─── Shared footer ────────────────────────────────────────────────────────────

function docFooter(generatedBy: string, today: string): string {
  return `
  <div class="doc-footer">
    <div class="doc-footer-left">VYSITE &bull; Construction Operating System &bull; Commercial Document &mdash; Confidential</div>
    <div class="doc-footer-right">Generated by ${esc(generatedBy || 'VYSITE')} &bull; ${today} &bull; &copy; VYSITE. All rights reserved.</div>
  </div>`;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function statusBadgeCls(s: string): string {
  if (['agreed','added_to_valuation','paid','complete','paid_va'].includes(s)) return 'badge-green';
  if (s === 'submitted') return 'badge-blue';
  if (s === 'awaiting_agreement' || s === 'under_review') return 'badge-amber';
  if (s === 'rejected' || s === 'overdue') return 'badge-red';
  if (s === 'certified') return 'badge-amber';
  if (s === 'part_paid') return 'badge-orange';
  if (s === 'disputed') return 'badge-amber';
  if (s === 'withdrawn' || s === 'draft') return 'badge-slate';
  return 'badge-slate';
}

function typeBadgeCls(t: string): string {
  if (t === 'variation') return 'badge-orange';
  if (t === 'delay_notice') return 'badge-amber';
  if (t === 'compensation_event') return 'badge-blue';
  return 'badge-slate';
}

const APP_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', certified: 'Certified',
  part_paid: 'Part Paid', paid: 'Paid', overdue: 'Overdue',
  disputed: 'Disputed', withdrawn: 'Withdrawn',
};

// ─── Financial statement block ─────────────────────────────────────────────────

interface StatRow { label: string; sub?: string; value: string; style?: 'normal' | 'total' | 'accent'; }

function statementBlock(heading: string, rows: StatRow[]): string {
  const rowHtml = rows.map(r => {
    const cls = r.style === 'total' ? ' statement-total' : r.style === 'accent' ? ' statement-accent' : '';
    const sub = r.sub ? `<div class="statement-sub">${esc(r.sub)}</div>` : '';
    return `<div class="statement-row${cls}">
      <div class="statement-label">${esc(r.label)}${sub}</div>
      <div class="statement-value">${r.value}</div>
    </div>`;
  }).join('<div class="statement-divider"></div>');
  return `
  <div class="statement-block">
    <div class="statement-header"><div class="statement-header-title">${esc(heading)}</div></div>
    ${rowHtml}
  </div>`;
}

// ─── Key dates table ──────────────────────────────────────────────────────────

function keyDatesTable(keyDates: DBKeyDate[]): string {
  if (!keyDates.length) return `<div class="empty-notice">No key dates recorded for this project.</div>`;
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const sorted = [...keyDates].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const rows = sorted.map(d => {
    const isOverdue = d.status === 'Open' && d.date && new Date(d.date) < todayMidnight;
    const label = d.status === 'Closed' ? 'Closed' : isOverdue ? 'Overdue' : 'Open';
    const bcls  = d.status === 'Closed' ? 'badge-green' : isOverdue ? 'badge-red' : 'badge-amber';
    const diff  = d.date && d.status === 'Open' ? Math.round((new Date(d.date).getTime() - todayMidnight.getTime()) / 86400000) : null;
    const dr    = diff === null ? '—' : diff === 0 ? 'Today' : diff < 0 ? `${Math.abs(diff)}d overdue` : `${diff}d remaining`;
    return `<tr>
      <td>${fmtD(d.date)}</td>
      <td style="font-weight:600;">${esc(d.title)}</td>
      <td>${d.description ? esc(d.description) : '—'}</td>
      <td><span class="badge ${bcls}">${label}</span></td>
      <td>${dr}</td>
    </tr>`;
  }).join('');
  return `
  <table class="data-table">
    <thead><tr><th style="width:80px">Date</th><th>Title</th><th>Description</th><th style="width:70px">Status</th><th style="width:100px">Days</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
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
    statRows.push({ label: 'Outstanding Variation Exposure', sub: 'Submitted + Under Review variations', value: `+${fv(d.variationExposure)}`, style: 'accent' });
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

  const meta: MetaEntry[] = [
    { label: 'Report Type', value: 'Commercial Position Statement' },
    { label: 'Project', value: d.project.name || '—' },
    { label: 'Client', value: d.project.client || '—' },
    { label: 'Location', value: d.project.location || '—' },
    { label: 'Project Manager', value: d.project.projectManager || '—' },
    { label: 'Start Date', value: fmtD(d.project.startDate) },
    { label: 'Completion Date', value: fmtD(d.project.completionDate) },
    { label: 'Status', value: d.project.status || '—' },
    { label: 'Generated By', value: d.currentUserName || '—' },
    { label: 'Generated Date', value: today },
  ];

  return `
  ${docHeader('Commercial Position Statement', d.project.name, d.project.client)}
  ${reportMeta(meta)}
  <div class="section-heading">Commercial Position</div>
  ${statementBlock('Financial Summary', statRows)}
  ${d.keyDates.length > 0 ? `<div class="section-heading">Key Dates (${d.keyDates.length})</div>${keyDatesTable(d.keyDates)}` : ''}
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

  const cards = d.records.map(r => {
    const ti = typeInfo(r.recordType);
    const si = statusInfo(r.status);
    return `
    <div class="record-card">
      <div class="record-card-header">
        <div>
          <span class="record-card-ref">${esc(r.reference || '—')}</span>
          <span class="record-card-title">${esc(r.title || 'Untitled')}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="badge ${typeBadgeCls(r.recordType)}">${esc(ti.label)}</span>
          <span class="badge ${statusBadgeCls(r.status)}">${esc(si.label)}</span>
        </div>
      </div>
      <div class="record-card-body">
        <div class="record-card-field"><div class="field-label">Project</div><div class="field-value">${esc(r.projectName || '—')}</div></div>
        <div class="record-card-field"><div class="field-label">Client</div><div class="field-value">${esc(r.client || '—')}</div></div>
        <div class="record-card-field"><div class="field-label">Date Raised</div><div class="field-value">${fmtD(r.dateRaised)}</div></div>
        <div class="record-card-field"><div class="field-label">Date Submitted</div><div class="field-value">${fmtD(r.dateSubmitted)}</div></div>
        <div class="record-card-field"><div class="field-label">Date Agreed</div><div class="field-value">${fmtD(r.dateAgreed)}</div></div>
        <div class="record-card-field"><div class="field-label">Created By</div><div class="field-value">${esc(r.createdBy || '—')}</div></div>
      </div>
      ${r.notes ? `<div class="record-card-notes"><div class="field-label">Notes</div><div class="field-value">${esc(r.notes)}</div></div>` : ''}
    </div>`;
  }).join('');

  const meta: MetaEntry[] = [
    { label: 'Report Type', value: 'Commercial Register' },
    { label: 'Project', value: projName },
    { label: 'Records', value: `${d.records.length} record${d.records.length !== 1 ? 's' : ''}` },
    { label: 'Generated Date', value: today },
    { label: 'Generated By', value: d.currentUserName || '—' },
    { label: 'Client', value: d.project?.client || '—' },
  ];

  return `
  ${docHeader('Commercial Register', projName, d.project?.client)}
  ${reportMeta(meta)}
  <div class="section-heading">Commercial Records (${d.records.length})</div>
  ${d.records.length === 0 ? '<div class="empty-notice">No commercial records found for this project.</div>' : cards}
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

  const rows = d.items.map(item => {
    const val = item.is_positive ? item.value : -item.value;
    const valStr = `${val >= 0 ? '+' : ''}${fv(val)}`;
    const vaStatuses: Record<string, string> = {
      draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
      agreed: 'Agreed', rejected: 'Rejected', paid: 'Paid', withdrawn: 'Withdrawn',
    };
    return `<tr>
      <td class="mono">${esc(item.reference || '—')}</td>
      <td style="font-weight:600;">${esc(item.title || 'Untitled')}</td>
      <td>${esc(item.description || '—')}</td>
      <td>${esc(item.reason || '—')}</td>
      <td class="num" style="color:${val >= 0 ? '#047857' : '#b91c1c'};font-weight:700;">${valStr}</td>
      <td><span class="badge ${statusBadgeCls(item.status)}">${esc(vaStatuses[item.status] || item.status)}</span></td>
      <td>${fmtD(item.date_raised)}</td>
      <td>${fmtD(item.date_agreed)}</td>
      <td style="font-size:9px;color:#64748b;">${esc(item.created_by || '—')}</td>
    </tr>`;
  }).join('');

  const statRows: StatRow[] = [
    { label: 'Outstanding Variation Exposure', sub: 'Submitted + Under Review', value: fv(d.vaExposure), style: 'accent' },
    { label: 'Forecast Contract Sum', value: d.forecastContractSum > 0 ? fv(d.forecastContractSum) : '—', style: 'total' },
    { label: 'Agreed Variations', value: fv(d.vaAgreed) },
    { label: 'Adjusted Contract Sum', value: d.adjustedContractSum > 0 ? fv(d.adjustedContractSum) : '—', style: 'total' },
  ];

  const meta: MetaEntry[] = [
    { label: 'Report Type', value: 'Variation Account' },
    { label: 'Project', value: projName },
    { label: 'Items', value: `${d.items.length} item${d.items.length !== 1 ? 's' : ''}` },
    { label: 'Generated Date', value: today },
    { label: 'Generated By', value: d.currentUserName || '—' },
    { label: 'Client', value: d.project?.client || '—' },
  ];

  return `
  ${docHeader('Variation Account', projName, d.project?.client)}
  ${reportMeta(meta)}
  <div class="section-heading">VA Summary</div>
  ${statementBlock('Variation Account Position', statRows)}
  <div class="section-heading">Variation Account Items (${d.items.length})</div>
  ${d.items.length === 0
    ? '<div class="empty-notice">No variation account items recorded for this project.</div>'
    : `<table class="data-table">
    <thead><tr><th>Ref</th><th>Title</th><th>Description</th><th>Reason / Cause</th><th class="num">Value</th><th>Status</th><th style="width:72px">Raised</th><th style="width:72px">Agreed</th><th>Created By</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`}
  ${docFooter(d.currentUserName, today)}`;
}

// ─── Applications body ────────────────────────────────────────────────────────

interface ApplicationsData {
  project: Project | null;
  apps: DBCommercialApplication[];
  forecastContractSum: number;
  currentUserName: string;
}

function applicationsBody(d: ApplicationsData): string {
  const today = todayStr();
  const projName = d.project?.name ?? '—';

  const appliedToDate    = d.apps.reduce((s, a) => s + a.applied_value, 0);
  const certifiedToDate  = d.apps.reduce((s, a) => s + a.certified_value, 0);
  const paidToDate       = d.apps.reduce((s, a) => s + a.paid_value, 0);
  const totalRetention   = d.apps.reduce((s, a) => s + a.retention, 0);
  const certShortfall    = appliedToDate - certifiedToDate;
  const outstanding      = certifiedToDate - paidToDate;
  const remaining        = d.forecastContractSum > 0 ? d.forecastContractSum - appliedToDate : null;

  const rows = d.apps.map(a => {
    const outstandingA = a.certified_value - a.paid_value;
    return `<tr>
      <td class="mono">${String(a.app_number).padStart(2, '0')}</td>
      <td style="font-weight:600;">${esc(a.period || '—')}</td>
      <td>${fmtD(a.app_date)}</td>
      <td class="num">${fv(a.applied_value)}</td>
      <td class="num">${fv(a.certified_value)}</td>
      <td class="num">${fv(a.paid_value)}</td>
      <td class="num">${fv(a.retention)}</td>
      <td class="num" style="${outstandingA > 0 ? 'color:#b45309;font-weight:700;' : ''}">${fv(outstandingA)}</td>
      <td>${fmtD(a.payment_due)}</td>
      <td>${fmtD(a.payment_recd)}</td>
      <td><span class="badge ${statusBadgeCls(a.status)}">${esc(APP_STATUS_LABELS[a.status] || a.status)}</span></td>
      <td style="font-size:9px;color:#64748b;">${esc(a.notes || '—')}</td>
      <td style="font-size:9px;color:#64748b;">${esc(a.created_by || '—')}</td>
    </tr>`;
  }).join('');

  const kpiCells = [
    { label: 'Applied To Date',         value: fv(appliedToDate) },
    { label: 'Certified To Date',        value: fv(certifiedToDate) },
    { label: 'Certification Shortfall',  value: fv(certShortfall), cls: certShortfall > 0 ? 'warning' : '' },
    { label: 'Paid To Date',             value: fv(paidToDate) },
    { label: 'Outstanding',              value: fv(outstanding), cls: outstanding > 0 ? 'warning' : '' },
    { label: 'Retention',                value: fv(totalRetention) },
    { label: 'Remaining Contract',       value: remaining != null ? fv(remaining) : '—' },
  ].map(c => `<div class="kpi-cell"><div class="kpi-label">${esc(c.label)}</div><div class="kpi-value ${c.cls || ''}">${c.value}</div></div>`).join('');

  const meta: MetaEntry[] = [
    { label: 'Report Type', value: 'Valuation Applications' },
    { label: 'Project', value: projName },
    { label: 'Applications', value: `${d.apps.length} application${d.apps.length !== 1 ? 's' : ''}` },
    { label: 'Generated Date', value: today },
    { label: 'Generated By', value: d.currentUserName || '—' },
    { label: 'Client', value: d.project?.client || '—' },
  ];

  return `
  ${docHeader('Valuation Applications', projName, d.project?.client)}
  ${reportMeta(meta)}
  <div class="section-heading">Summary Position</div>
  <div class="kpi-bar">${kpiCells}</div>
  <div class="section-heading">Application Records (${d.apps.length})</div>
  ${d.apps.length === 0
    ? '<div class="empty-notice">No valuation applications recorded for this project.</div>'
    : `<table class="data-table" style="font-size:9.5px;">
    <thead><tr>
      <th>No.</th><th>Period</th><th style="width:72px">App Date</th>
      <th class="num">Applied</th><th class="num">Certified</th><th class="num">Paid</th>
      <th class="num">Retention</th><th class="num">Outstanding</th>
      <th style="width:72px">Due</th><th style="width:72px">Recd</th>
      <th>Status</th><th>Notes</th><th>By</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`}
  ${docFooter(d.currentUserName, today)}`;
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
  'va-raised':   '#f59e0b',
  'va-agreed':   '#10b981',
  'cr-added':    '#f97316',
  'cr-submitted':'#38bdf8',
  'cr-agreed':   '#10b981',
};
const KIND_LABEL: Record<string, string> = {
  'va-raised':   'Variation Raised',
  'va-agreed':   'Variation Agreed',
  'cr-added':    'Record Added',
  'cr-submitted':'Submitted',
  'cr-agreed':   'Agreed',
};
const KIND_COLOR: Record<string, string> = {
  'va-raised':   '#b45309',
  'va-agreed':   '#047857',
  'cr-added':    '#c2410c',
  'cr-submitted':'#0c4a6e',
  'cr-agreed':   '#047857',
};

function timelineBody(d: TimelineData): string {
  const today = todayStr();
  const projName = d.project?.name ?? '—';

  const eventRows = d.events.map((e, i) => {
    const dot  = KIND_DOT[e.kind]   || '#94a3b8';
    const klbl = KIND_LABEL[e.kind] || e.kind;
    const kcol = KIND_COLOR[e.kind] || '#64748b';
    const val  = e.value != null
      ? `<span style="font-size:9.5px;font-weight:700;color:${e.isPositive ? '#047857' : '#b91c1c'};margin-left:8px;">${e.isPositive ? '+' : ''}${fv(e.isPositive ? e.value : -e.value)}</span>`
      : '';
    const isLast = i === d.events.length - 1;
    return `<div class="timeline-row">
      <div class="timeline-date">${esc(e.displayDate)}</div>
      <div class="timeline-dot-col">
        <div class="timeline-dot" style="background:${dot};"></div>
        ${!isLast ? '<div class="timeline-line"></div>' : ''}
      </div>
      <div class="timeline-content">
        <div class="timeline-kind" style="color:${kcol};">${klbl} &bull; ${esc(e.source)}</div>
        <div class="timeline-title"><span class="timeline-ref">${esc(e.reference || '')}</span>${esc(e.title || '')}${val}</div>
        ${e.statusLabel ? `<div class="timeline-meta">Status: ${esc(e.statusLabel)}${e.createdBy ? ' &bull; By: ' + esc(e.createdBy) : ''}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  const meta: MetaEntry[] = [
    { label: 'Report Type', value: 'Commercial Timeline' },
    { label: 'Project', value: projName },
    { label: 'Events', value: `${d.events.length} event${d.events.length !== 1 ? 's' : ''}` },
    { label: 'Generated Date', value: today },
    { label: 'Generated By', value: d.currentUserName || '—' },
    { label: 'Client', value: d.project?.client || '—' },
  ];

  return `
  ${docHeader('Commercial Timeline', projName, d.project?.client)}
  ${reportMeta(meta)}
  <div class="section-heading">Timeline Events (${d.events.length})</div>
  ${d.events.length === 0
    ? '<div class="empty-notice">No timeline events recorded for this project.</div>'
    : eventRows}
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

  // ── Cover ──
  const cover = `
  <div class="cover-page">
    <div class="cover-brand">VYSITE</div>
    <div class="cover-tagline">Construction Operating System</div>
    <div class="cover-report-title">Full Commercial Report</div>
    <div class="cover-project">${esc(p.name)}</div>
    <div class="cover-client">${p.client ? esc(p.client) : ''}</div>
    <div class="cover-date">Generated ${today} by ${esc(d.currentUserName || 'VYSITE')}</div>
  </div>`;

  // ── Project info meta ──
  const meta: MetaEntry[] = [
    { label: 'Project', value: p.name || '—' },
    { label: 'Client', value: p.client || '—' },
    { label: 'Location', value: p.location || '—' },
    { label: 'Project Manager', value: p.projectManager || '—' },
    { label: 'Start Date', value: fmtD(p.startDate) },
    { label: 'Completion Date', value: fmtD(p.completionDate) },
    { label: 'Status', value: p.status || '—' },
    { label: 'Generated By', value: d.currentUserName || '—' },
  ];

  // ── Section 1: Position ──
  const forecastContractSum = d.contractNum + d.variationExposure;
  const adjustedContractSum = d.contractNum + d.agreedVariations;
  const remainingValue = d.completedNum != null ? adjustedContractSum - d.completedNum : null;
  const statRows: StatRow[] = [
    { label: 'Original Contract Sum', value: d.contractNum > 0 ? fv(d.contractNum) : '—' },
  ];
  if (d.variationExposure !== 0) statRows.push({ label: 'Outstanding Variation Exposure', sub: 'Submitted + Under Review', value: `+${fv(d.variationExposure)}`, style: 'accent' });
  statRows.push({ label: 'Forecast Contract Sum', value: d.contractNum > 0 ? fv(forecastContractSum) : '—', style: 'total' });
  if (d.agreedVariations !== 0) statRows.push({ label: 'Agreed Variations', value: `+${fv(d.agreedVariations)}` });
  statRows.push({ label: 'Adjusted Contract Sum', value: d.contractNum > 0 ? fv(adjustedContractSum) : '—', style: 'total' });
  if (d.completedNum != null) statRows.push({ label: 'Completed Value', value: fv(d.completedNum) });
  if (remainingValue != null) statRows.push({ label: 'Remaining Value', value: fv(remainingValue) });

  // ── Section 4: Applications KPI ──
  const appliedToDate   = d.apps.reduce((s, a) => s + a.applied_value, 0);
  const certifiedToDate = d.apps.reduce((s, a) => s + a.certified_value, 0);
  const paidToDate      = d.apps.reduce((s, a) => s + a.paid_value, 0);
  const totalRetention  = d.apps.reduce((s, a) => s + a.retention, 0);
  const certShortfall   = appliedToDate - certifiedToDate;
  const outstanding     = certifiedToDate - paidToDate;
  const remaining       = d.forecastContractSum > 0 ? d.forecastContractSum - appliedToDate : null;

  const appKpiCells = [
    { label: 'Applied To Date',        value: fv(appliedToDate) },
    { label: 'Certified To Date',       value: fv(certifiedToDate) },
    { label: 'Cert. Shortfall',         value: fv(certShortfall), cls: certShortfall > 0 ? 'warning' : '' },
    { label: 'Paid To Date',            value: fv(paidToDate) },
    { label: 'Outstanding',             value: fv(outstanding), cls: outstanding > 0 ? 'warning' : '' },
    { label: 'Retention',               value: fv(totalRetention) },
    { label: 'Remaining Contract',      value: remaining != null ? fv(remaining) : '—' },
  ].map(c => `<div class="kpi-cell"><div class="kpi-label">${esc(c.label)}</div><div class="kpi-value ${c.cls || ''}">${c.value}</div></div>`).join('');

  // ── Register summary rows ──
  const regRows = d.records.map(r => {
    const ti = typeInfo(r.recordType);
    const si = statusInfo(r.status);
    return `<tr>
      <td><span class="badge ${typeBadgeCls(r.recordType)}">${esc(ti.label)}</span></td>
      <td class="mono">${esc(r.reference || '—')}</td>
      <td style="font-weight:600;">${esc(r.title || 'Untitled')}</td>
      <td><span class="badge ${statusBadgeCls(r.status)}">${esc(si.label)}</span></td>
      <td>${fmtD(r.dateRaised)}</td>
      <td>${esc(r.createdBy || '—')}</td>
    </tr>`;
  }).join('');

  // ── VA summary rows ──
  const vaStatuses: Record<string, string> = {
    draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
    agreed: 'Agreed', rejected: 'Rejected', paid: 'Paid', withdrawn: 'Withdrawn',
  };
  const vaRows = d.vaItems.map(item => {
    const val = item.is_positive ? item.value : -item.value;
    return `<tr>
      <td class="mono">${esc(item.reference || '—')}</td>
      <td style="font-weight:600;">${esc(item.title)}</td>
      <td class="num" style="color:${val >= 0 ? '#047857' : '#b91c1c'};font-weight:700;">${val >= 0 ? '+' : ''}${fv(val)}</td>
      <td><span class="badge ${statusBadgeCls(item.status)}">${esc(vaStatuses[item.status] || item.status)}</span></td>
      <td>${fmtD(item.date_raised)}</td>
    </tr>`;
  }).join('');

  // ── Apps summary rows ──
  const appRows = d.apps.map(a => `<tr>
    <td class="mono">${String(a.app_number).padStart(2, '0')}</td>
    <td style="font-weight:600;">${esc(a.period || '—')}</td>
    <td class="num">${fv(a.applied_value)}</td>
    <td class="num">${fv(a.certified_value)}</td>
    <td class="num">${fv(a.paid_value)}</td>
    <td><span class="badge ${statusBadgeCls(a.status)}">${esc(APP_STATUS_LABELS[a.status] || a.status)}</span></td>
  </tr>`).join('');

  // ── Timeline rows ──
  const tlRows = d.events.map((e, i) => {
    const dot  = KIND_DOT[e.kind]   || '#94a3b8';
    const klbl = KIND_LABEL[e.kind] || e.kind;
    const kcol = KIND_COLOR[e.kind] || '#64748b';
    const val  = e.value != null ? `<span style="color:${e.isPositive ? '#047857' : '#b91c1c'};font-weight:700;margin-left:6px;">${e.isPositive ? '+' : ''}${fv(e.isPositive ? e.value : -e.value)}</span>` : '';
    const isLast = i === d.events.length - 1;
    return `<div class="timeline-row">
      <div class="timeline-date">${esc(e.displayDate)}</div>
      <div class="timeline-dot-col">
        <div class="timeline-dot" style="background:${dot};"></div>
        ${!isLast ? '<div class="timeline-line"></div>' : ''}
      </div>
      <div class="timeline-content">
        <div class="timeline-kind" style="color:${kcol};">${klbl} &bull; ${esc(e.source)}</div>
        <div class="timeline-title"><span class="timeline-ref">${esc(e.reference || '')}</span>${esc(e.title || '')}${val}</div>
        ${e.statusLabel ? `<div class="timeline-meta">${esc(e.statusLabel)}${e.createdBy ? ' &bull; ' + esc(e.createdBy) : ''}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `
  ${cover}
  <div class="section-heading">Project Information</div>
  ${reportMeta(meta)}

  <div class="section-heading">1. Commercial Position</div>
  ${statementBlock('Financial Summary', statRows)}

  <div class="section-heading">2. Key Dates</div>
  ${keyDatesTable(d.keyDates)}

  <div class="page-break">
  <div class="section-heading">3. Commercial Register (${d.records.length} records)</div>
  ${d.records.length === 0
    ? '<div class="empty-notice">No commercial register records for this project.</div>'
    : `<table class="data-table"><thead><tr><th>Type</th><th>Ref</th><th>Title</th><th>Status</th><th style="width:72px">Raised</th><th>By</th></tr></thead><tbody>${regRows}</tbody></table>`}

  <div class="section-heading">4. Variation Account (${d.vaItems.length} items)</div>
  ${d.vaItems.length === 0
    ? '<div class="empty-notice">No variation account items for this project.</div>'
    : `<table class="data-table"><thead><tr><th>Ref</th><th>Title</th><th class="num">Value</th><th>Status</th><th style="width:72px">Raised</th></tr></thead><tbody>${vaRows}</tbody></table>`}
  </div>

  <div class="page-break">
  <div class="section-heading">5. Valuation Applications (${d.apps.length} applications)</div>
  <div class="kpi-bar">${appKpiCells}</div>
  ${d.apps.length === 0
    ? '<div class="empty-notice">No applications for this project.</div>'
    : `<table class="data-table"><thead><tr><th>No.</th><th>Period</th><th class="num">Applied</th><th class="num">Certified</th><th class="num">Paid</th><th>Status</th></tr></thead><tbody>${appRows}</tbody></table>`}

  <div class="section-heading">6. Commercial Timeline (${d.events.length} events)</div>
  ${d.events.length === 0
    ? '<div class="empty-notice">No timeline events for this project.</div>'
    : tlRows}
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
  openPrintTab(pageShell(`Valuation Applications — ${name}`, applicationsBody(data)));
}

export function exportTimelinePDF(data: TimelineData): void {
  const name = data.project?.name ?? '—';
  openPrintTab(pageShell(`Commercial Timeline — ${name}`, timelineBody(data)));
}

export function exportFullCommercialReport(data: FullReportData): void {
  openPrintTab(pageShell(`Full Commercial Report — ${data.project.name}`, fullReportBody(data)));
}
