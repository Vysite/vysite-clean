/**
 * PDFRenderer — builds a professional, print-ready HTML document from a saved form record.
 * Called by ViewModal's print button. Renders the same data the ticket view shows.
 */

import { openPrintTab } from '../lib/printTab';
import type { ExtendedSiteForm } from './types';
import type { HazardRecord, RamsSignOffRecord, OperativeRecord, DelayRecord } from './SubComponents';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(d?: string | null): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
}

function safeStr(v: unknown): string {
  return v ? String(v) : '';
}

// ─── Layout primitives ────────────────────────────────────────────────────────

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    color: #1e293b;
    background: white;
    font-size: 11px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { max-width: 860px; margin: 0 auto; padding: 36px 40px; }
  /* Header — matches platform PDF style (Reports, Actions, Snagging) */
  .doc-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid #f97316; margin-bottom: 20px; }
  .doc-logo-img { height: 38px; max-width: 160px; display: block; margin-bottom: 4px; }
  .doc-logo-text { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: 0.05em; }
  .doc-type-label { font-size: 10px; color: #64748b; margin-top: 4px; }
  .doc-header-right { text-align: right; }
  .doc-title { font-size: 18px; font-weight: 900; color: #111; margin-bottom: 4px; line-height: 1.25; max-width: 380px; }
  .doc-dateline { font-size: 11px; color: #64748b; }
  /* Subtitle bar — project/date/status summary line */
  .doc-subtitle-bar { font-size: 11px; color: #64748b; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
  /* Status badge */
  .status-badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 6px; vertical-align: middle; }
  .status-submitted    { background: #dbeafe; color: #1d4ed8; }
  .status-approved     { background: #d1fae5; color: #065f46; }
  .status-draft        { background: #f1f5f9; color: #475569; }
  .status-issued       { background: #e0f2fe; color: #0369a1; }
  .status-open         { background: #fef9c3; color: #854d0e; }
  .status-acknowledged { background: #cffafe; color: #0e7490; }
  .status-actioned     { background: #ede9fe; color: #5b21b6; }
  .status-resolved     { background: #d1fae5; color: #065f46; }
  .status-closed       { background: #f1f5f9; color: #475569; }
  .status-other        { background: #f1f5f9; color: #475569; }
  /* Meta block */
  .meta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }
  .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; }
  .meta-grid-2 { grid-template-columns: repeat(2, 1fr); }
  .meta-grid-4 { grid-template-columns: repeat(4, 1fr); }
  .meta-item {}
  .meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .meta-value { font-size: 11px; font-weight: 600; color: #0f172a; }
  /* Result badge */
  .result-block { display: flex; align-items: center; justify-content: space-between; border-radius: 8px; padding: 12px 18px; margin: 14px 0; page-break-inside: avoid; }
  .result-pass  { background: #f0fdf4; border: 1.5px solid #86efac; }
  .result-fail  { background: #fef2f2; border: 1.5px solid #fca5a5; }
  .result-other { background: #fffbeb; border: 1.5px solid #fcd34d; }
  .result-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
  .result-value-pass  { font-size: 14px; font-weight: 800; color: #16a34a; }
  .result-value-fail  { font-size: 14px; font-weight: 800; color: #dc2626; }
  .result-value-other { font-size: 14px; font-weight: 800; color: #d97706; }
  /* Sections */
  .section { margin-top: 20px; page-break-inside: avoid; }
  .section-heading { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 10px; }
  .section-content { font-size: 11px; color: #334155; line-height: 1.65; white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
  /* Data tables */
  .data-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 2px; }
  .data-table th { padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; }
  .data-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: top; }
  .data-table tr:nth-child(even) td { background: #f8fafc; }
  .data-table tr:last-child td { border-bottom: none; }
  /* Two-column data grid */
  .data-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 2px; }
  .data-grid-3 { grid-template-columns: repeat(3, 1fr); }
  .data-cell { background: white; padding: 9px 12px; }
  .data-cell-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
  .data-cell-value { font-size: 11px; font-weight: 600; color: #0f172a; }
  /* Risk badges */
  .risk-low      { background: #dcfce7; color: #166534; border-radius: 20px; padding: 2px 10px; font-size: 9px; font-weight: 700; display: inline-block; }
  .risk-medium   { background: #fef9c3; color: #854d0e; border-radius: 20px; padding: 2px 10px; font-size: 9px; font-weight: 700; display: inline-block; }
  .risk-high     { background: #fed7aa; color: #9a3412; border-radius: 20px; padding: 2px 10px; font-size: 9px; font-weight: 700; display: inline-block; }
  .risk-critical { background: #fee2e2; color: #991b1b; border-radius: 20px; padding: 2px 10px; font-size: 9px; font-weight: 700; display: inline-block; }
  /* Hazard card */
  .hazard-card { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; overflow: hidden; page-break-inside: avoid; }
  .hazard-header { background: #f8fafc; padding: 9px 14px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
  .hazard-body { padding: 10px 14px; }
  .hazard-row { display: grid; grid-template-columns: 140px 1fr; gap: 8px; margin-bottom: 6px; font-size: 10px; }
  .hazard-row-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; padding-top: 1px; }
  .hazard-controls { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 5px; padding: 8px 10px; margin-top: 8px; font-size: 10px; color: #166534; }
  /* SWA checklist */
  .checklist-row { display: grid; grid-template-columns: 1fr 80px; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
  .checklist-row:last-child { border-bottom: none; }
  .checklist-fail { color: #dc2626; font-weight: 600; }
  .badge-pass { background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 20px; font-size: 8.5px; font-weight: 700; }
  .badge-fail { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 20px; font-size: 8.5px; font-weight: 700; }
  .badge-na   { background: #f1f5f9; color: #64748b;  padding: 2px 8px; border-radius: 20px; font-size: 8.5px; font-weight: 700; }
  .badge-action { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 20px; font-size: 8.5px; font-weight: 700; margin-left: 4px; }
  /* Legal footer */
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
  /* Images — thumbnail grid */
  .evidence-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; }
  .evidence-item { border: 1px solid #e2e8f0; border-radius: 5px; overflow: hidden; page-break-inside: avoid; }
  .evidence-img { width: 100%; height: 110px; object-fit: cover; display: block; background: #f8fafc; }
  .evidence-caption { padding: 3px 6px; font-size: 7.5px; color: #64748b; background: #f8fafc; border-top: 1px solid #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Sign-off table */
  .signoff-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .signoff-table th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0; }
  .signoff-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .signoff-table tr:nth-child(even) td { background: #f8fafc; }
  .sig-box { min-width: 90px; height: 28px; border-bottom: 1px solid #cbd5e1; }
  /* doc-footer retained for any external callers — kept but not emitted by this renderer */
  .doc-footer { margin-top: 32px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
  @page { margin: 0; size: A4; }
  @media print {
    .page { padding: 20px 24px; }
    .section { page-break-inside: avoid; }
    .hazard-card { page-break-inside: avoid; }
    .evidence-item { page-break-inside: avoid; }
  }
`;

// ─── Building-block helpers ───────────────────────────────────────────────────

function sectionHeading(label: string): string {
  return `<div class="section-heading">${esc(label)}</div>`;
}

function section(label: string, content: string): string {
  if (!content) return '';
  return `<div class="section">${sectionHeading(label)}<div class="section-content">${esc(content)}</div></div>`;
}

function sectionHtml(label: string, inner: string): string {
  if (!inner) return '';
  return `<div class="section">${sectionHeading(label)}${inner}</div>`;
}

function dataGrid(pairs: [string, string | undefined | null][], cols: 2 | 3 = 2): string {
  const visible = pairs.filter(([, v]) => v);
  if (!visible.length) return '';
  const cls = cols === 3 ? 'data-grid data-grid-3' : 'data-grid';
  return `<div class="${cls}">${visible.map(([l, v]) => `<div class="data-cell"><div class="data-cell-label">${esc(l)}</div><div class="data-cell-value">${esc(v ?? '')}</div></div>`).join('')}</div>`;
}

function resultBlock(label: string, value: string | undefined | null): string {
  if (!value) return '';
  const isPass = /pass/i.test(value);
  const isFail = /fail/i.test(value);
  const cls = isPass ? 'result-block result-pass' : isFail ? 'result-block result-fail' : 'result-block result-other';
  const valCls = isPass ? 'result-value-pass' : isFail ? 'result-value-fail' : 'result-value-other';
  return `<div class="${cls}"><span class="result-label">${esc(label)}</span><span class="${valCls}">${esc(value)}</span></div>`;
}

function riskBadge(score: number): string {
  const label = score <= 4 ? 'Low' : score <= 9 ? 'Medium' : score <= 16 ? 'High' : 'Critical';
  const cls = `risk-${label.toLowerCase()}`;
  return `<span class="${cls}">${label} (${score})</span>`;
}

function statusBadge(status: string): string {
  const lower = status.toLowerCase();
  const cls = lower === 'submitted'    ? 'status-submitted'
    : lower === 'approved'             ? 'status-approved'
    : lower === 'draft'                ? 'status-draft'
    : lower === 'issued'               ? 'status-issued'
    : lower === 'open'                 ? 'status-open'
    : lower === 'acknowledged'         ? 'status-acknowledged'
    : lower === 'actioned'             ? 'status-actioned'
    : lower === 'resolved'             ? 'status-resolved'
    : lower === 'closed'               ? 'status-closed'
    : 'status-other';
  return `<span class="status-badge ${cls}">${esc(status)}</span>`;
}

// ─── Operative attendance table ───────────────────────────────────────────────

function operativeTable(jsonStr: string | undefined): string {
  if (!jsonStr) return '';
  let rows: OperativeRecord[] = [];
  try { rows = JSON.parse(jsonStr); } catch { return ''; }
  if (!rows.length) return '';
  return `<table class="data-table">
    <tr><th>Name</th><th>Company</th><th>Trade</th><th>Time In</th><th>Time Out</th><th>Inducted</th><th>PPE</th><th>Permit</th></tr>
    ${rows.map(r => `<tr>
      <td style="font-weight:600">${esc(r.name)}</td>
      <td>${esc(r.company)}</td>
      <td>${esc(r.trade)}</td>
      <td>${esc(r.timeIn)}</td>
      <td>${esc(r.timeOut)}</td>
      <td>${r.inducted ? '<span class="badge-pass">Y</span>' : '<span class="badge-na">N</span>'}</td>
      <td>${r.ppeCompliant ? '<span class="badge-pass">Y</span>' : '<span class="badge-na">N</span>'}</td>
      <td>${r.permitBriefed ? '<span class="badge-pass">Y</span>' : '<span class="badge-na">N</span>'}</td>
    </tr>`).join('')}
  </table>`;
}

// ─── Delay table ─────────────────────────────────────────────────────────────

function delayTable(jsonStr: string | undefined): string {
  if (!jsonStr) return '';
  let rows: DelayRecord[] = [];
  try { rows = JSON.parse(jsonStr); } catch { return ''; }
  if (!rows.length) return '';
  return `<table class="data-table">
    <tr><th>#</th><th>Type</th><th>Area</th><th>Duration</th><th>Severity</th><th>Programme Impact</th></tr>
    ${rows.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td>${esc(r.delayType)}</td>
      <td>${esc(r.areaAffected)}</td>
      <td>${esc(r.duration)}</td>
      <td>${esc(r.severity)}</td>
      <td>${esc(r.programmeImpact)}</td>
    </tr>`).join('')}
  </table>`;
}

// ─── SWA checklist ────────────────────────────────────────────────────────────

interface ChecklistEntry { result: string; comment: string; action: boolean; responsible: string; closeDate: string }

function swaChecklistHtml(jsonStr: string | undefined): string {
  if (!jsonStr) return '';
  let cl: Record<string, ChecklistEntry> = {};
  try { cl = JSON.parse(jsonStr); } catch { return ''; }
  const entries = Object.entries(cl);
  if (!entries.length) return '';
  const rows = entries.map(([key, v]) => {
    const badgeCls = v.result === 'Pass' ? 'badge-pass' : v.result === 'Fail' ? 'badge-fail' : 'badge-na';
    const actionBadge = v.action ? `<span class="badge-action">Action</span>` : '';
    const detail = v.comment ? `<div style="font-size:9px;color:#64748b;margin-top:2px;font-style:italic">${esc(v.comment)}</div>` : '';
    const resp = v.responsible ? `<div style="font-size:9px;color:#64748b">Responsible: ${esc(v.responsible)}${v.closeDate ? ' · Close: ' + esc(v.closeDate) : ''}</div>` : '';
    return `<tr>
      <td>${esc(key.replace(/_/g, ' '))}</td>
      <td style="text-align:center"><span class="${badgeCls}">${esc(v.result)}</span>${actionBadge}</td>
      <td>${detail}${resp}</td>
    </tr>`;
  }).join('');
  return `<table class="data-table">
    <tr><th style="width:40%">Item</th><th style="width:15%">Result</th><th>Notes / Action</th></tr>
    ${rows}
  </table>`;
}

// ─── RAMS hazards ─────────────────────────────────────────────────────────────

function ramsHazardsHtml(jsonStr: string | undefined): string {
  if (!jsonStr) return '';
  let hazards: HazardRecord[] = [];
  try { hazards = JSON.parse(jsonStr); } catch { return ''; }
  if (!hazards.length) return '';

  const tally = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  const riskLabelStr = (sc: number) => sc <= 4 ? 'Low' : sc <= 9 ? 'Medium' : sc <= 16 ? 'High' : 'Critical';
  hazards.forEach(h => {
    const sc = h.residualLikelihood * h.residualSeverity;
    tally[riskLabelStr(sc) as keyof typeof tally]++;
  });

  const tallyHtml = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
    ${Object.entries(tally).map(([l, c]) => {
      const cls = `risk-${l.toLowerCase()}`;
      return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:4px">${l}</div>
        <div style="font-size:22px;font-weight:900"><span class="${cls}" style="padding:4px 12px">${c}</span></div>
      </div>`;
    }).join('')}
  </div>`;

  const cards = hazards.map((h, i) => {
    const iS = h.initLikelihood * h.initSeverity;
    const rS = h.residualLikelihood * h.residualSeverity;
    return `<div class="hazard-card">
      <div class="hazard-header">
        <span style="font-size:11px;font-weight:700;color:#0f172a">Hazard ${i + 1}${h.category ? ': ' + esc(h.category) : ''}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span>Initial: ${riskBadge(iS)}</span>
          <span>Residual: ${riskBadge(rS)}</span>
        </div>
      </div>
      <div class="hazard-body">
        ${h.hazardDescription ? `<div class="hazard-row"><div class="hazard-row-label">Hazard</div><div>${esc(h.hazardDescription)}</div></div>` : ''}
        ${h.personsAtRisk ? `<div class="hazard-row"><div class="hazard-row-label">Persons at Risk</div><div>${esc(h.personsAtRisk)}</div></div>` : ''}
        ${h.existingControls ? `<div class="hazard-row"><div class="hazard-row-label">Existing Controls</div><div>${esc(h.existingControls)}</div></div>` : ''}
        ${h.additionalControls ? `<div class="hazard-controls"><strong style="font-size:8.5px;text-transform:uppercase;letter-spacing:.05em">Additional Controls Required:</strong><div style="margin-top:4px">${esc(h.additionalControls)}</div></div>` : ''}
        ${h.responsiblePerson ? `<div style="margin-top:8px;font-size:9.5px;color:#64748b">Responsible: <strong>${esc(h.responsiblePerson)}</strong>${h.actionRequired ? ' · Action: ' + esc(h.actionRequired) : ''}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return tallyHtml + cards;
}

// ─── RAMS sign-off table ──────────────────────────────────────────────────────

function ramsSignOffHtml(jsonStr: string | undefined): string {
  if (!jsonStr) return '';
  let sigs: RamsSignOffRecord[] = [];
  try { sigs = JSON.parse(jsonStr); } catch { return ''; }
  if (!sigs.length) return '';
  return `<table class="signoff-table">
    <tr>
      <th>Name</th><th>Company</th><th>Role</th><th>Date</th>
      <th style="text-align:center">RAMS Read</th><th style="text-align:center">Briefed</th><th>Signature</th>
    </tr>
    ${sigs.map(sig => `<tr>
      <td style="font-weight:600">${esc(sig.name)}</td>
      <td>${esc(sig.company)}</td>
      <td>${esc(sig.role)}</td>
      <td>${fmtDate(sig.date)}</td>
      <td style="text-align:center">${sig.ramsRead ? '<span class="badge-pass">Yes</span>' : '<span class="badge-fail">No</span>'}</td>
      <td style="text-align:center">${sig.briefingCompleted ? '<span class="badge-pass">Yes</span>' : '<span class="badge-fail">No</span>'}</td>
      <td><div class="sig-box"></div></td>
    </tr>`).join('')}
  </table>`;
}

// ─── Evidence / images section ────────────────────────────────────────────────

interface AttachmentFile {
  name?: string;
  dataUrl?: string;
  url?: string;
  type?: string;
  size?: number;
}

function evidenceHtml(attachments: unknown): string {
  if (!attachments || !Array.isArray(attachments) || !attachments.length) return '';
  const files = attachments as AttachmentFile[];
  const images = files.filter(f => {
    const type = f.type ?? '';
    const name = f.name ?? '';
    return type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
  });
  const docs = files.filter(f => !images.includes(f));

  let html = '';

  if (images.length) {
    html += `<div class="evidence-grid">
      ${images.map(img => {
        const src = img.dataUrl || img.url || '';
        return `<div class="evidence-item">
          ${src
            ? `<img class="evidence-img" src="${src}" alt="${esc(img.name ?? 'Photo')}" />`
            : `<div class="evidence-img" style="display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:9px">Unavailable</div>`}
          <div class="evidence-caption" title="${esc(img.name ?? 'Photo')}">${esc(img.name ?? 'Photo')}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  if (docs.length) {
    html += `<div style="margin-top:${images.length ? '14px' : '0'}">
      ${docs.map(d => {
        const name = esc(d.name ?? 'File');
        const ext = (d.name ?? '').split('.').pop()?.toUpperCase().slice(0, 4) || 'DOC';
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 11px;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:5px;background:#f8fafc">
          <div style="width:28px;height:28px;background:#e2e8f0;border-radius:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:7.5px;font-weight:800;color:#475569;letter-spacing:.02em">${ext}</div>
          <span style="font-size:10px;color:#1e293b;font-weight:500">${name}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  return html;
}

// ─── Per-type contractual notice ──────────────────────────────────────────────

const CONTRACTUAL_NOTICE: Partial<Record<string, string>> = {
  'Hold Up Notice':
    'This notice formally records a hold-up event affecting the progress of works. The issuing party expressly reserves all rights to recover additional costs, loss and expense, and programme impacts arising from this event in accordance with the applicable building contract.',
  'Delay Notice':
    'Issued pursuant to the applicable building contract to formally notify of a delay event. The issuing party reserves all rights to an extension of time, recovery of prolongation costs, and all associated contractual entitlements. This notice must be responded to within the period stipulated in the contract.',
  'Variation':
    'This variation notice is issued in accordance with the applicable contract conditions. No additional or changed works should be instructed or undertaken until written authorisation has been received. All costs and programme impacts must be agreed in advance unless otherwise instructed in writing.',
  'Early Warning Notice':
    'Issued pursuant to applicable contract conditions to formally draw the attention of the other party to a matter that could adversely affect cost, programme, quality or performance. Early warning obligations are contractual; failure to respond may affect entitlements under the contract.',
  'Site Instruction':
    'Issued by an authorised representative in accordance with the contract. The receiving party is required to comply with this instruction within the specified timeframe. Any disagreement with this instruction or cost/programme implications must be raised in writing within the notice period specified in the contract.',
  'RFI':
    'Issued to obtain a formal written response on the matter described. The responding party is required to provide a response within the requested timescale. Delay in responding to this RFI may constitute a compensation event or cause of delay entitling the issuing party to an extension of time and associated costs.',
  'Technical Query':
    'This technical query is raised to seek formal written clarification. A written response is required. The issuing party reserves the right to claim additional time and cost where a delayed or inadequate response impacts the works or programme.',
  'QA Inspection':
    'This record has been completed in accordance with the project Quality Management Plan and applicable British Standards. Any non-conformance items identified must be closed out prior to programme sign-off. This document forms part of the project quality register and O&M documentation.',
  'Daily Site Report':
    'This is a contemporaneous record of site activities, operative attendance, conditions and progress as observed on the date stated. This document may be relied upon as evidence of site conditions, progress and delay events in any future contractual or legal proceedings.',
  'Electrical Commissioning Report':
    'This report is a contemporaneous record of electrical commissioning activities completed on the date stated. All works have been carried out in accordance with BS 7671 (IET Wiring Regulations), the project specification, and applicable statutory instruments. This document forms part of the project O&M and commissioning handover package.',
  'Pressure Test':
    'This test has been carried out in accordance with the project specification, BSRIA BG 29/2021 and applicable British Standards. Test results and witness sign-off form part of the statutory commissioning and O&M documentation package. Copies must be retained on the project health and safety file.',
  'Flushing Record':
    'System flushing has been carried out in accordance with BSRIA BG 29/2021, CIBSE Commissioning Code W, and the project specification. Water quality results and witness signatures form part of the commissioning handover record and O&M documentation.',
  'Valve Checklist':
    'Valve commissioning has been carried out in accordance with the project specification and applicable standards. Results form part of the mechanical commissioning record and O&M documentation package.',
  'AHU Commissioning':
    'AHU commissioning has been completed in accordance with CIBSE Commissioning Code A and the project specification. All recorded data forms part of the commissioning handover package and O&M documentation.',
  'Dead Testing':
    'Dead testing has been carried out in accordance with BS 7671 (IET Wiring Regulations) and the project specification. All test results have been witnessed and recorded contemporaneously. This document forms part of the electrical inspection and testing certification package.',
  'Continuity Test':
    'Continuity testing has been performed in accordance with BS 7671 and the project specification. Recorded measurements have been witnessed and form part of the electrical commissioning documentation.',
  'Toolbox Talk':
    'This toolbox talk has been delivered in accordance with the project Health & Safety plan and CDM Regulations 2015. Attendance and briefing confirmation constitute acknowledgement that the content was understood. These records form part of the project health and safety file.',
  'Site Walk Audit':
    'Completed as part of the project Health & Safety management system in accordance with CDM Regulations 2015. All identified actions must be closed out within the specified timescales. Failure to close out actions may result in formal notices being issued. This record forms part of the project H&S file.',
  'H&S Inspection':
    'Completed in accordance with the Health and Safety at Work Act 1974, CDM Regulations 2015, and the project Health & Safety management plan. All observations and actions form part of the project H&S file and must be addressed within the timescales stated.',
  'Risk Assessment':
    'This document has been prepared in accordance with the Health and Safety at Work Act 1974, the Management of Health and Safety at Work Regulations 1999, and CDM Regulations 2015. This RAMS must be briefed to all operatives before works commence, and all operatives must sign to confirm they have read and understood its content. Operative sign-off constitutes legal acknowledgement of the risk controls.',
  'Accident / Incident Report':
    'This report has been completed in accordance with the Health and Safety at Work Act 1974, the Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013 (RIDDOR), and the project Health & Safety management plan. This record forms part of the statutory accident book and the project health and safety file. Where RIDDOR reporting indicators are identified, the responsible person must assess the obligation to report to the HSE within the statutory timescales (immediate for fatalities and specified injuries; within 15 days for over-seven-day injuries). This document does not constitute formal notification to the HSE. Further investigation may alter conclusions. Photographs, witness statements and associated documentation form part of the permanent accident record.',
  'Plantroom Commissioning Record':
    'This record has been compiled in accordance with BSRIA BG 29/2021 (Pre-Commission Cleaning), BSRIA BG 8/2009 (Commissioning Management), CIBSE Commissioning Codes, and the project specification. All test results, asset details, serial numbers, valve numbers and photographic evidence recorded in this document form part of the project O&M documentation, commissioning handover package, and Health & Safety file. This document must be retained as part of the permanent project record.',
  'Temperature Water Readings':
    'Temperature measurements have been taken in accordance with CIBSE TM13, HSG274 (Part 2), the Water Supply (Water Fittings) Regulations 1999, and the project specification. All readings form part of the Legionella risk management programme and must be retained as part of the permanent water hygiene record. Where temperatures fall outside the recommended range, remedial action must be taken immediately and the results re-tested and recorded.',
  'Site Note':
    'This Site Note has been issued to formally record information, observations, existing conditions or matters relevant to the Project. It is intended to maintain an accurate contemporaneous project record and does not, by itself, constitute a contractual instruction, variation, acceptance or waiver of any contractual rights or obligations unless expressly stated elsewhere within the Contract.',
};

// ─── Reusable report footer / legal block ─────────────────────────────────────

interface ReportFooterOptions {
  formType: string;
  docRef: string;
  status: string;
  generatedDate: string;
  orgName: string;
  projectName: string;
}

function reportFooter(opts: ReportFooterOptions): string {
  const { formType, docRef, status, generatedDate, orgName, projectName } = opts;
  const contractualNotice = CONTRACTUAL_NOTICE[formType] ?? '';

  const statusCls = /submitted/i.test(status) ? 'status-submitted'
    : /approved/i.test(status) ? 'status-approved'
    : /issued/i.test(status) ? 'status-issued'
    : /draft/i.test(status) ? 'status-draft'
    : 'status-other';

  const noticeBar = contractualNotice
    ? `<div class="legal-notice-bar">
        <div class="legal-notice-label">Contractual Notice</div>
        <div class="legal-notice-text">${esc(contractualNotice)}</div>
      </div>`
    : '';

  return `
  <div class="legal-footer">
    <div class="legal-footer-header">
      <div class="legal-footer-title">Document Legal &amp; Compliance Statement</div>
      <div class="legal-footer-ref">Ref: ${esc(docRef)}</div>
    </div>

    ${noticeBar}

    <div class="legal-grid">
      <div class="legal-cell">
        <div class="legal-cell-label">Document Status</div>
        <div class="legal-cell-text">
          This document has a current status of <strong><span class="status-badge ${statusCls}" style="margin-left:0">${esc(status || 'Draft')}</span></strong>
          ${/draft/i.test(status) ? ' and should not be relied upon as a finalised or approved record until formally submitted or approved.' : ' and is issued as a formal project record.'}
        </div>
      </div>
      <div class="legal-cell">
        <div class="legal-cell-label">Evidence Statement</div>
        <div class="legal-cell-text">
          This document constitutes a contemporaneous site record created on the date stated. It may be used as primary evidence of site conditions, works progress, attendance and events in any dispute resolution, adjudication, arbitration, or legal proceedings arising from the project.
        </div>
      </div>
      <div class="legal-cell">
        <div class="legal-cell-label">Liability &amp; Record Statement</div>
        <div class="legal-cell-text">
          The accuracy of the information contained within this document is the responsibility of the named signatory or completing party. This record must be retained as part of the project health and safety file and/or O&amp;M documentation as applicable. Falsification of any entry in this document may constitute a criminal offence.
        </div>
      </div>
      <div class="legal-cell">
        <div class="legal-cell-label">Confidentiality</div>
        <div class="legal-cell-text">
          This document is issued in confidence for project purposes only. Distribution is restricted to the named parties and the project team. Unauthorised disclosure to third parties is not permitted without the express written consent of the issuing organisation.
        </div>
      </div>
    </div>

    <div class="legal-branding">
      <div class="legal-branding-left">
        Generated by <strong>${esc(orgName)}</strong> &mdash; powered by <strong>VYSITE</strong> | Construction Operating System
        &nbsp;&middot;&nbsp; ${esc(projectName || 'Project Record')}
        &nbsp;&middot;&nbsp; ${esc(generatedDate)}
      </div>
      <div class="legal-branding-right">
        &copy; VYSITE. All rights reserved.<br/>
        Document Ref: ${esc(docRef)}
      </div>
    </div>
  </div>`;
}

// ─── Form-type-specific body builders ────────────────────────────────────────

function buildPressureTestBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Pressure Test Details', dataGrid([
      ['Plot / Area', safeStr(f.plotArea)], ['System / Service', safeStr(f.systemService)],
      ['Test Medium', safeStr(f.testMedium)], ['Test Pressure', f.testPressure ? `${safeStr(f.testPressure)} ${safeStr(f.testPressureUnit)}` : ''],
      ['Start Time', safeStr(f.startTime)], ['End Time', safeStr(f.endTime)],
      ['Duration on Test', safeStr(f.durationOnTest)], ['Engineer', safeStr(f.engineer)],
      ['Company', safeStr(f.company)], ['Witnessed By', safeStr(f.witnessedBy)],
    ]))}
    ${safeStr(f.pipeworkDescription) ? section('Pipework Description', safeStr(f.pipeworkDescription)) : ''}
    ${resultBlock('Pressure Test Result', safeStr(f.testResult))}
    ${safeStr(f.observations) ? section('Observations / Notes', safeStr(f.observations)) : ''}
  `;
}

function buildFlushingBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Flushing Details', dataGrid([
      ['Plot / Area', safeStr(f.plotArea)], ['System / Service', safeStr(f.systemService)],
      ['Flush Medium', safeStr(f.flushMedium)],
      ['Temperature', safeStr(f.flushTemperature)], ['Duration', safeStr(f.flushDuration)],
      ['Turbidity (NTU)', safeStr(f.turbidity)], ['Chlorine Residual', safeStr(f.chlorineResidual)],
      ['Engineer', safeStr(f.engineer)], ['Company', safeStr(f.company)],
      ['Witnessed By', safeStr(f.flushWitnessedBy)],
    ]))}
    ${safeStr(f.pipeworkDescription) ? section('Pipework Description', safeStr(f.pipeworkDescription)) : ''}
    ${resultBlock('Flush Result', safeStr(f.flushResult))}
    ${safeStr(f.observations) ? section('Observations / Notes', safeStr(f.observations)) : ''}
  `;
}

function buildValveBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Valve Details', dataGrid([
      ['Plot / Area', safeStr(f.plotArea)], ['Valve Tag', safeStr(f.valveTag)],
      ['Type', safeStr(f.valveType)],
      ['Size', safeStr(f.valveSize)], ['Location', safeStr(f.valveLocation)],
      ['Engineer', safeStr(f.engineer)], ['Witnessed By', safeStr(f.witnessedBy)],
    ]))}
    ${sectionHtml('Inspection Results', dataGrid([
      ['Operation Check', safeStr(f.operationCheck)], ['Seat Leakage', safeStr(f.seatLeakageCheck)],
      ['Gland Leakage', safeStr(f.glandLeakageCheck)], ['Position Indicator', safeStr(f.positionIndicator)],
      ['Actuator Check', safeStr(f.actuatorCheck)], ['Overall Condition', safeStr(f.overallCondition)],
    ]))}
    ${safeStr(f.observations) ? section('Observations / Notes', safeStr(f.observations)) : ''}
  `;
}

function buildAHUBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('AHU Details', dataGrid([
      ['AHU Tag', safeStr(f.ahuTag)], ['Location', safeStr(f.ahuLocation)],
      ['Supply Airflow', safeStr(f.supplyAirflow)], ['Return Airflow', safeStr(f.returnAirflow)],
      ['Supply Fan Amps', safeStr(f.supplyFanAmps)], ['Return Fan Amps', safeStr(f.returnFanAmps)],
      ['Filter Condition', safeStr(f.filterCondition)], ['Belt Condition', safeStr(f.beltCondition)],
      ['Dampers Operation', safeStr(f.dampersOperation)], ['Condensate Tray', safeStr(f.condensateTray)],
      ['Vibration Check', safeStr(f.vibrationCheck)], ['Coil Condition', safeStr(f.coilCondition)],
      ['Setpoint Temp', safeStr(f.setpointTemp)], ['Measured Temp', safeStr(f.measuredTemp)],
    ]))}
    ${resultBlock('AHU Commissioning Result', safeStr(f.ahuResult))}
    ${safeStr(f.observations) ? section('Observations / Notes', safeStr(f.observations)) : ''}
  `;
}

function buildDeadTestBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Dead Test Details', dataGrid([
      ['Circuit Ref', safeStr(f.circuitRef)], ['Plot / Area', safeStr(f.plotArea)],
      ['Test Instrument', safeStr(f.testInstrument)], ['Engineer', safeStr(f.engineer)],
      ['Witnessed By', safeStr(f.deadTestWitness)],
    ]))}
    ${sectionHtml('Test Measurements', dataGrid([
      ['L1 Insulation Resistance (MΩ)', safeStr(f.insulationPhaseL1)],
      ['L2 Insulation Resistance (MΩ)', safeStr(f.insulationPhaseL2)],
      ['L3 Insulation Resistance (MΩ)', safeStr(f.insulationPhaseL3)],
      ['Neutral Insulation Resistance (MΩ)', safeStr(f.insulationNeutral)],
      ['Continuity Ring (Ω)', safeStr(f.continuityRing)],
      ['Earth Fault Loop (Ω)', safeStr(f.earthFault)],
      ['Polarity', safeStr(f.polarity)],
    ]))}
    ${resultBlock('Dead Test Result', safeStr(f.deadTestResult))}
    ${safeStr(f.observations) ? section('Observations / Notes', safeStr(f.observations)) : ''}
  `;
}

function buildContinuityBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Continuity Test Details', dataGrid([
      ['Conductor Ref', safeStr(f.conductorRef)], ['Circuit Ref', safeStr(f.circuitRef)],
      ['Conductor Type', safeStr(f.conductorType)], ['Length (m)', safeStr(f.conductorLength)],
      ['Test Instrument', safeStr(f.testInstrument)], ['Engineer', safeStr(f.engineer)],
      ['Witnessed By', safeStr(f.continuityWitness)],
    ]))}
    ${sectionHtml('Resistance Measurements', dataGrid([
      ['Measured Resistance (Ω)', safeStr(f.measuredResistance)],
      ['Calculated Resistance (Ω)', safeStr(f.calculatedResistance)],
      ['Deviation (%)', safeStr(f.deviationPercent)],
    ]))}
    ${resultBlock('Continuity Test Result', safeStr(f.continuityResult))}
  `;
}

function buildToolboxTalkBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Talk Details', dataGrid([
      ['Topic', safeStr(f.tbtTopic)], ['Duration', safeStr(f.tbtDuration)],
      ['Location', safeStr(f.tbtLocation)], ['Presented By', safeStr(f.tbtPresentedBy)],
      ['Company', safeStr(f.company)],
    ]))}
    ${section('Key Points Covered', safeStr(f.tbtKeyPoints))}
    ${section('Attendees', safeStr(f.tbtAttendees))}
    ${section('Action Items', safeStr(f.tbtActionItems))}
    ${section('Sign-Off Notes', safeStr(f.tbtSignOff))}
  `;
}

function buildSWABody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Audit Details', dataGrid([
      ['Site Area', safeStr(f.swaSiteArea)], ['Audit Time', safeStr(f.swaAuditTime)],
      ['Auditor', safeStr(f.swaAuditorName)], ['Weather', safeStr(f.swaWeather)],
      ['Trade / Team', safeStr(f.swaTradeTeam)], ['Site Manager', safeStr(f.swaSiteManager)],
    ]))}
    ${resultBlock('Overall Status', safeStr(f.swaOverallStatus))}
    ${section('Positive Observations', safeStr(f.swaPositiveObservations))}
    ${section('Key Risks Identified', safeStr(f.swaKeyRisks))}
    ${section('Immediate Actions Required', safeStr(f.swaImmediateActions))}
    ${f.swaChecklist ? sectionHtml('Checklist Results', swaChecklistHtml(safeStr(f.swaChecklist))) : ''}
    ${section('Further Actions / Follow-Up', safeStr(f.swaFurtherActions))}
    ${sectionHtml('Closeout', dataGrid([
      ['Responsible Person', safeStr(f.swaResponsiblePerson)],
      ['Close-Out Date', fmtDate(safeStr(f.swaCloseOutDate))],
      ['Re-inspection Required', safeStr(f.swaReinspectionRequired)],
      ['Re-inspection Date', fmtDate(safeStr(f.swaReinspectionDate))],
    ]))}
    ${section('Overall Comments', safeStr(f.swaOverallComments))}
  `;
}

function buildECRBody(f: Record<string, unknown>): string {
  // Render activities status table from JSON
  const activitiesHtml = (() => {
    if (!f.ecrActivities) return '';
    let acts: Record<string, { status: string; comment: string }> = {};
    try { acts = JSON.parse(f.ecrActivities as string); } catch { return ''; }
    const entries = Object.entries(acts);
    if (!entries.length) return '';
    return `<table class="data-table">
      <tr><th>Activity</th><th>Status</th><th>Comment</th></tr>
      ${entries.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v.status)}</td><td>${esc(v.comment)}</td></tr>`).join('')}
    </table>`;
  })();
  // Render QA checklist table from JSON
  const qaChecklistHtml = (() => {
    if (!f.ecrQaChecklist) return '';
    let items: Record<string, { result: string; comment: string }> = {};
    try { items = JSON.parse(f.ecrQaChecklist as string); } catch { return ''; }
    const entries = Object.entries(items);
    if (!entries.length) return '';
    return `<table class="data-table">
      <tr><th>Item</th><th>Result</th><th>Comment</th></tr>
      ${entries.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v.result)}</td><td>${esc(v.comment)}</td></tr>`).join('')}
    </table>`;
  })();
  return `
    ${sectionHtml('Commissioning Report Details', dataGrid([
      ['Shift', safeStr(f.ecrShift)], ['Lead Engineer', safeStr(f.ecrLeadEngineer)],
      ['Company', safeStr(f.ecrCompany)], ['Main Contractor', safeStr(f.ecrMainContractor)],
      ['System Being Commissioned', safeStr(f.ecrSystemBeingCommissioned)],
      ['Overall Status', safeStr(f.ecrOverallStatus)],
      ['Site Area', safeStr(f.ecrSiteArea)], ['Weather', safeStr(f.ecrWeather)],
      ['Ticket Ref', safeStr(f.ecrTicketRef)], ['Permit Refs', safeStr(f.ecrPermitRefs)],
      ['% Progress', safeStr(f.ecrPercentProgress)], ['Labour Progress', safeStr(f.ecrProgressLabour)],
    ], 3))}
    ${f.ecrAttendees ? sectionHtml('Operative Attendance', operativeTable(safeStr(f.ecrAttendees))) : ''}
    ${section('Areas Completed', safeStr(f.ecrAreasCompleted))}
    ${section('Areas In Progress', safeStr(f.ecrAreasInProgress))}
    ${section('Areas Delayed', safeStr(f.ecrAreasDelayed))}
    ${section('Actual Works Completed', safeStr(f.ecrActualWorks))}
    ${section('Key Achievements', safeStr(f.ecrKeyAchievements))}
    ${section('Key Blockers', safeStr(f.ecrKeyBlockers))}
    ${f.ecrDelays ? sectionHtml('Delays / Issues', delayTable(safeStr(f.ecrDelays))) : ''}
    ${activitiesHtml ? sectionHtml('Activity Status', activitiesHtml) : ''}
    ${qaChecklistHtml ? sectionHtml('QA Checklist', qaChecklistHtml) : ''}
    ${section('QA Comments', safeStr(f.ecrQaComments))}
    ${section("Tomorrow's Works", safeStr(f.ecrTomorrowWorks))}
    ${section('Required Support', safeStr(f.ecrRequiredSupport))}
    ${section('Overall Comments', safeStr(f.ecrOverallComments))}
    ${sectionHtml('Sign-Off', dataGrid([
      ['Lead Engineer', safeStr(f.ecrSignLead)],
      ['Witness', safeStr(f.ecrSignWitness)],
      ['Site Manager', safeStr(f.ecrSignSiteManager)],
      ['Contractor', safeStr(f.ecrSignContractor)],
    ]))}
  `;
}

function buildDSRBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Site Report Details', dataGrid([
      ['Site Manager', safeStr(f.dsrSiteManager)], ['Weather', safeStr(f.dsrWeather)],
      ['Temperature', safeStr(f.dsrTemperature)], ['Site Conditions', safeStr(f.dsrSiteConditions)],
      ['Operatives on Site', safeStr(f.dsrOperativesOnSite)], ['Visitors', safeStr(f.dsrVisitors)],
      ['Start Time', safeStr(f.dsrStartTime)], ['Finish Time', safeStr(f.dsrFinishTime)],
      ['Break Duration', safeStr(f.dsrBreakDuration)],
      ['Total Hours', safeStr(f.dsrTotalHours)],
    ], 3))}
    ${f.dsrAttendees ? sectionHtml('Operative Attendance', operativeTable(safeStr(f.dsrAttendees))) : ''}
    ${section('Areas Worked In', safeStr(f.dsrAreasWorkedIn))}
    ${section('Works Completed', safeStr(f.dsrWorksCompleted))}
    ${section('Systems Worked On', safeStr(f.dsrSystemsWorkedOn))}
    ${section('Equipment Worked On', safeStr(f.dsrEquipmentWorkedOn))}
    ${section('Testing Completed', safeStr(f.dsrTestingCompleted))}
    ${section('Materials Installed', safeStr(f.dsrMaterialsInstalled))}
    ${section('Materials Used', safeStr(f.dsrMaterialsUsed))}
    ${section('Missing / Outstanding Materials', safeStr(f.dsrMissingMaterials))}
    ${section('Deliveries Received', safeStr(f.dsrDeliveries))}
    ${section('Plant & Equipment On Site', safeStr(f.dsrPlantEquipment))}
    ${section('Issues Encountered', safeStr(f.dsrIssuesEncountered))}
    ${section('Snags Identified', safeStr(f.dsrSnagsIdentified))}
    ${section('Access Restrictions', safeStr(f.dsrAccessRestrictions))}
    ${section('Permits / Isolations', safeStr(f.dsrPermits))}
    ${section('Incidents / Near Misses', safeStr(f.dsrIncidents))}
    ${section('HSE Observations', safeStr(f.dsrHseObservations))}
    ${f.dsrDelays ? sectionHtml('Delays / Issues', delayTable(safeStr(f.dsrDelays))) : ''}
    ${sectionHtml('Status Flags', dataGrid([
      ['Plan Completed', safeStr(f.dsrPlanCompleted)],
      ['Delays Encountered', safeStr(f.dsrDelaysEncountered)],
      ['Waiting Other Trades', safeStr(f.dsrWaitingOtherTrades)],
      ['Waiting Materials', safeStr(f.dsrWaitingMaterials)],
      ['Additional Works', safeStr(f.dsrAdditionalWorks)],
      ['Variation Potential', safeStr(f.dsrVariationPotential)],
      ['Revisit Required', safeStr(f.dsrRevisitRequired)],
      ['Further Labour Required', safeStr(f.dsrFurtherLabour)],
    ]))}
    ${section('Follow-On Works', safeStr(f.dsrFollowOnWorks))}
    ${section("Tomorrow's Planned Works", safeStr(f.dsrTomorrowPlanned))}
    ${section('Commercial Observations', safeStr(f.dsrCommercialObservations))}
    ${section('Supervisor Notes', safeStr(f.dsrSupervisorNotes))}
    ${sectionHtml('Sign-Off', dataGrid([
      ['Engineer Sign', safeStr(f.dsrSignEngineer)],
      ['Supervisor Sign', safeStr(f.dsrSignSupervisor)],
    ]))}
  `;
}

function buildRAMSBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Document Details', dataGrid([
      ['RAMS Ref', safeStr(f.ramsRef)], ['Revision', safeStr(f.ramsRevision)],
      ['Author', safeStr(f.ramsAuthor)], ['Company', safeStr(f.ramsCompany)],
      ['Principal Contractor', safeStr(f.ramsPrincipalContractor)], ['Client', safeStr(f.ramsClient)],
      ['Trade Package', safeStr(f.ramsTradePackage)], ['Location of Works', safeStr(f.ramsLocationOfWorks)],
      ['Review Date', fmtDate(safeStr(f.ramsReviewDate))], ['Approved By', safeStr(f.ramsApprovedBy)],
      ['Overall Risk Rating', safeStr(f.ramsOverallRiskRating)],
    ], 3))}
    ${section('Activity Description', safeStr(f.ramsActivityDescription))}
    ${section('Scope of Works', safeStr(f.ramsScopeOfWorks))}
    ${section('Sequence of Works', safeStr(f.ramsSequenceOfWorks))}
    ${section('Access Arrangements', safeStr(f.ramsAccessArrangements))}
    ${section('Working Hours', safeStr(f.ramsWorkingHours))}
    ${section('Plant & Equipment', safeStr(f.ramsPlantEquipment))}
    ${section('Isolations Required', safeStr(f.ramsIsolations))}
    ${section('PPE Requirements', safeStr(f.ramsPpe))}
    ${f.ramsHazards ? sectionHtml('Hazard & Risk Assessment', ramsHazardsHtml(safeStr(f.ramsHazards))) : ''}
    ${section('Emergency Procedures', safeStr(f.ramsEmergencyProcedure))}
    ${section('First Aid', safeStr(f.ramsFirstAid))}
    ${section('Fire Arrangements', safeStr(f.ramsFireArrangements))}
    ${section('Environmental Controls', safeStr(f.ramsEnvironmentalControls))}
    ${section('Welfare Arrangements', safeStr(f.ramsWelfareArrangements))}
    ${f.ramsSignOffs ? sectionHtml('Operative Briefing & Sign-Off', ramsSignOffHtml(safeStr(f.ramsSignOffs))) : ''}
  `;
}

function buildRFIBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('RFI Details', dataGrid([
      ['RFI Ref', safeStr(f.rfiRef)], ['Raised By', safeStr(f.raisedBy)],
      ['Required Response Date', fmtDate(safeStr(f.requiredResponseDate))],
      ['Assigned To', safeStr(f.assignedTo)],
    ]))}
    ${section('Subject', safeStr(f.subject))}
    ${section('Question / Request', safeStr(f.question))}
    ${section('Response', safeStr(f.response))}
    ${section('Notes', safeStr(f.notes))}
  `;
}

function buildHSBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Inspection Details', dataGrid([
      ['Inspection Date', fmtDate(safeStr(f.inspectionDate))],
      ['Inspection Type', safeStr(f.inspectionType)],
      ['Area Inspected', safeStr(f.areaInspected)],
      ['Risk Level', safeStr(f.riskLevel)],
      ['Inspector', safeStr(f.inspectorName)],
    ]))}
    ${section('Findings', safeStr(f.findings))}
    ${section('Actions Required', safeStr(f.actionsRequired))}
    ${section('Notes', safeStr(f.notes))}
  `;
}

function buildAIRBody(f: Record<string, unknown>): string {
  let immediateActions: string[] = [];
  try { immediateActions = JSON.parse(safeStr(f.airImmediateActions) || '[]'); } catch { /* */ }
  let witnesses: { name: string; company: string; contact: string; statement: string }[] = [];
  try { witnesses = JSON.parse(safeStr(f.airWitnessStatements) || '[]'); } catch { /* */ }

  const riddorYes = ['airRiddorKilled','airRiddorSpecifiedInjury','airRiddorOverSevenDay',
    'airRiddorDangerousOccurrence','airRiddorPublicAffected','airRiddorOccupationalDisease']
    .some(k => safeStr(f[k]) === 'Yes');

  const riddorBlock = riddorYes
    ? `<div style="background:#fff1f2;border:1.5px solid #fca5a5;border-left:4px solid #ef4444;border-radius:8px;padding:12px 16px;margin-top:8px">
        <div style="font-size:9px;font-weight:800;color:#991b1b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">RIDDOR Review Required</div>
        <div style="font-size:10px;color:#7f1d1d;line-height:1.65">${esc(safeStr(f.airRiddorGuidance))}</div>
       </div>`
    : `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:10px 14px;margin-top:8px">
        <div style="font-size:9px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">No RIDDOR Indicators</div>
        <div style="font-size:10px;color:#14532d;line-height:1.65">${esc(safeStr(f.airRiddorGuidance))}</div>
       </div>`;

  const immediateActionsHtml = immediateActions.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${immediateActions.map(a =>
        `<span style="background:#d1fae5;color:#065f46;font-size:9px;font-weight:700;padding:3px 10px;border-radius:20px">${esc(a)}</span>`
      ).join('')}</div>`
    : '<p style="font-size:10px;color:#94a3b8;font-style:italic">None recorded</p>';

  const witnessesHtml = witnesses.length
    ? witnesses.map((w, i) => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:10px;page-break-inside:avoid">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <span style="font-size:11px;font-weight:700;color:#0f172a">Witness ${i+1}${w.name ? ': ' + esc(w.name) : ''}</span>
            ${w.company ? `<span style="font-size:10px;color:#64748b">${esc(w.company)}</span>` : ''}
            ${w.contact ? `<span style="font-size:10px;color:#94a3b8">${esc(w.contact)}</span>` : ''}
          </div>
          ${w.statement ? `<p style="font-size:10px;color:#334155;line-height:1.65;white-space:pre-wrap">${esc(w.statement)}</p>` : ''}
        </div>
      `).join('')
    : '<p style="font-size:10px;color:#94a3b8;font-style:italic">No witness statements recorded</p>';

  return `
    ${sectionHtml('Incident Details', dataGrid([
      ['Incident Type', safeStr(f.airIncidentType)],
      ['Injury Classification', safeStr(f.airInjuryClassification)],
      ['Date', fmtDate(safeStr(f.date))],
      ['Time', safeStr(f.airTime)],
      ['Location / Area', safeStr(f.areaLocation)],
      ['Reported By', safeStr(f.completedBy)],
      ['Injured / Affected Person', safeStr(f.airInjuredPerson)],
      ['Employer', safeStr(f.airEmployer)],
      ['Contact Number', safeStr(f.airContactNumber)],
      ['Witnesses', safeStr(f.airWitnesses)],
    ], 3))}
    ${section('What Happened', safeStr(f.airWhatHappened))}
    ${sectionHtml('Immediate Actions Taken', immediateActionsHtml)}
    ${sectionHtml('RIDDOR Assessment', `
      ${dataGrid([
        ['Anyone Killed?', safeStr(f.airRiddorKilled)],
        ['Specified Injury?', safeStr(f.airRiddorSpecifiedInjury)],
        ['Over-7-Day Injury?', safeStr(f.airRiddorOverSevenDay)],
        ['Dangerous Occurrence?', safeStr(f.airRiddorDangerousOccurrence)],
        ['Member of Public Affected?', safeStr(f.airRiddorPublicAffected)],
        ['Reportable Disease?', safeStr(f.airRiddorOccupationalDisease)],
      ])}
      ${riddorBlock}
    `)}
    ${section('Root Cause', safeStr(f.airRootCause))}
    ${section('Contributory Factors', safeStr(f.airContributoryFactors))}
    ${section('Corrective Actions', safeStr(f.airCorrectiveActions))}
    ${section('Preventative Actions', safeStr(f.airPreventativeActions))}
    ${safeStr(f.airResponsiblePerson) || safeStr(f.airTargetCompletionDate) ? sectionHtml('Investigation Accountability', dataGrid([
      ['Responsible Person', safeStr(f.airResponsiblePerson)],
      ['Target Completion Date', fmtDate(safeStr(f.airTargetCompletionDate))],
    ])) : ''}
    ${sectionHtml('Witness Statements', witnessesHtml)}
    ${(safeStr(f.airInvestigationComplete) || safeStr(f.airClosedBy)) ? sectionHtml('Close Out', `
      ${dataGrid([
        ['Investigation Complete', safeStr(f.airInvestigationComplete)],
        ['Actions Complete', safeStr(f.airActionsComplete)],
        ['Closed By', safeStr(f.airClosedBy)],
        ['Closed Date', fmtDate(safeStr(f.airClosedDate))],
      ])}
      ${safeStr(f.airLessonsLearned) ? `<div class="section-content" style="margin-top:8px">${esc(safeStr(f.airLessonsLearned))}</div>` : ''}
    `) : ''}
  `;
}

function buildPCRBody(f: Record<string, unknown>): string {
  // Parse JSON arrays/sets
  let assets: { assetType: string; assetRef: string; manufacturer: string; model: string; serialNumber: string; valveNumber: string; assetTag: string; location: string; installedCorrectly: string; accessible: string; comments: string }[] = [];
  try { assets = JSON.parse(safeStr(f.pcrAssets) || '[]'); } catch { /* */ }
  let defects: { description: string; responsiblePerson: string; dueDate: string; status: string }[] = [];
  try { defects = JSON.parse(safeStr(f.pcrDefects) || '[]'); } catch { /* */ }
  const getSet = (key: string): string[] => { try { return JSON.parse(safeStr(f[key]) || '[]'); } catch { return []; } };
  const pillHtml = (items: string[], color = '#d1fae5', textColor = '#065f46') =>
    items.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">${items.map(a => `<span style="background:${color};color:${textColor};font-size:9px;font-weight:700;padding:2px 9px;border-radius:20px">${esc(a)}</span>`).join('')}</div>` : '';

  const assetTable = assets.length ? `
    <table class="data-table">
      <tr>
        <th>Type</th><th>Ref</th><th>Manufacturer</th><th>Model</th>
        <th>Serial No.</th><th>Valve No.</th><th>Tag</th><th>Location</th>
        <th>Installed</th><th>Accessible</th><th>Comments</th>
      </tr>
      ${assets.map((a) => `<tr>
        <td><strong>${esc(a.assetType)}</strong></td>
        <td style="font-family:monospace;font-weight:700">${esc(a.assetRef)}</td>
        <td>${esc(a.manufacturer)}</td>
        <td>${esc(a.model)}</td>
        <td style="font-family:monospace">${esc(a.serialNumber)}</td>
        <td style="font-family:monospace">${esc(a.valveNumber)}</td>
        <td>${esc(a.assetTag)}</td>
        <td>${esc(a.location)}</td>
        <td>${a.installedCorrectly === 'Yes' ? '<span class="badge-pass">Yes</span>' : '<span class="badge-fail">No</span>'}</td>
        <td>${a.accessible === 'Yes' ? '<span class="badge-pass">Yes</span>' : '<span class="badge-fail">No</span>'}</td>
        <td style="font-style:italic;color:#64748b">${esc(a.comments)}</td>
      </tr>`).join('')}
    </table>
    <div style="font-size:9px;color:#94a3b8;margin-top:4px">${assets.length} asset${assets.length !== 1 ? 's' : ''} registered</div>
  ` : '<p style="font-size:10px;color:#94a3b8;font-style:italic">No assets recorded</p>';

  const defectRows = defects.length ? `
    <table class="data-table">
      <tr><th>#</th><th>Description</th><th>Responsible</th><th>Due Date</th><th>Status</th></tr>
      ${defects.map((d, i) => {
        const stClr = d.status === 'Closed' || d.status === 'Complete' ? '#065f46' : d.status === 'In Progress' ? '#854d0e' : '#991b1b';
        const stBg  = d.status === 'Closed' || d.status === 'Complete' ? '#d1fae5' : d.status === 'In Progress' ? '#fef9c3' : '#fee2e2';
        return `<tr>
          <td>${i+1}</td>
          <td>${esc(d.description)}</td>
          <td>${esc(d.responsiblePerson)}</td>
          <td>${fmtDate(d.dueDate)}</td>
          <td><span style="background:${stBg};color:${stClr};font-size:9px;font-weight:700;padding:2px 9px;border-radius:20px">${esc(d.status)}</span></td>
        </tr>`;
      }).join('')}
    </table>
  ` : '<p style="font-size:10px;color:#94a3b8;font-style:italic">No defects recorded</p>';

  return `
    ${sectionHtml('Project Information', dataGrid([
      ['Plantroom Reference', safeStr(f.pcrPlantroom)],
      ['Location', safeStr(f.areaLocation)],
      ['Date', fmtDate(safeStr(f.date))],
      ['Engineer', safeStr(f.pcrEngineer)],
      ['Witness', safeStr(f.pcrWitness)],
      ['Main Contractor', safeStr(f.pcrMainContractor)],
      ['Consultant', safeStr(f.pcrConsultant)],
    ], 3))}
    ${section('Comments', safeStr(f.comments))}
    ${sectionHtml('Plant Asset Register', assetTable)}
    ${sectionHtml('System Fill', `
      ${pillHtml(getSet('pcrFillChecklist'))}
      ${dataGrid([
        ['Initial Fill Pressure', safeStr(f.pcrFillPressureInitial)],
        ['Final Fill Pressure', safeStr(f.pcrFillPressureFinal)],
        ['Static Head', safeStr(f.pcrStaticHead)],
        ['Fill Medium', safeStr(f.pcrFillMedium)],
      ])}
      ${safeStr(f.pcrFillComments) ? `<div class="section-content" style="margin-top:6px">${esc(safeStr(f.pcrFillComments))}</div>` : ''}
    `)}
    ${sectionHtml('Pressure Test', `
      ${dataGrid([
        ['Test Medium', safeStr(f.pcrTestMedium)],
        ['Test Pressure', safeStr(f.pcrTestPressure)],
        ['Duration', safeStr(f.pcrTestDuration)],
        ['Start Time', safeStr(f.pcrTestStartTime)],
        ['Finish Time', safeStr(f.pcrTestFinishTime)],
      ])}
      ${pillHtml(getSet('pcrTestChecklist'))}
      ${safeStr(f.pcrTestComments) ? `<div class="section-content" style="margin-top:6px">${esc(safeStr(f.pcrTestComments))}</div>` : ''}
    `)}
    ${sectionHtml('Flushing', `
      ${pillHtml(getSet('pcrFlushChecklist'))}
      ${dataGrid([
        ['Chemical Used', safeStr(f.pcrFlushChemical)],
        ['Water Clarity', safeStr(f.pcrWaterClarity)],
      ])}
      ${safeStr(f.pcrFlushComments) ? `<div class="section-content" style="margin-top:6px">${esc(safeStr(f.pcrFlushComments))}</div>` : ''}
    `)}
    ${sectionHtml('Water Treatment', `
      ${dataGrid([
        ['Inhibitor Product', safeStr(f.pcrTreatmentInhibitor)],
        ['Batch Number', safeStr(f.pcrTreatmentBatch)],
        ['Quantity Added', safeStr(f.pcrTreatmentQty)],
      ])}
      ${pillHtml(getSet('pcrTreatmentChecklist'))}
    `)}
    ${getSet('pcrCommChecklist').length ? sectionHtml('Commissioning Checks', `
      ${pillHtml(getSet('pcrCommChecklist'), '#e0f2fe', '#0369a1')}
      ${safeStr(f.pcrCommComments) ? `<div class="section-content" style="margin-top:6px">${esc(safeStr(f.pcrCommComments))}</div>` : ''}
    `) : ''}
    ${sectionHtml('Defects / Outstanding Works', defectRows)}
    ${sectionHtml('Handover', `
      ${dataGrid([
        ['Witnessed By', safeStr(f.pcrHandoverWitness)],
        ['Company', safeStr(f.pcrHandoverCompany)],
        ['Handover Date', fmtDate(safeStr(f.pcrHandoverDate))],
      ])}
      ${safeStr(f.pcrHandoverComments) ? `<div class="section-content" style="margin-top:6px">${esc(safeStr(f.pcrHandoverComments))}</div>` : ''}
    `)}
  `;
}

function buildMVHRBody(f: Record<string, unknown>): string {
  interface MVHRRoom { roomName: string; roomType: string; designSupply: string; actualSupply: string; designExtract: string; actualExtract: string; passOrFail: string; comments: string; }
  interface MVHRDefect { description: string; responsiblePerson: string; dueDate: string; status: string; comments: string; }

  let rooms: MVHRRoom[] = [];
  try { rooms = JSON.parse(safeStr(f.mvhrRooms) || '[]'); } catch { /* */ }
  let defects: MVHRDefect[] = [];
  try { defects = JSON.parse(safeStr(f.mvhrDefects) || '[]'); } catch { /* */ }

  const getCheck = (key: string): Record<string, string> => { try { return JSON.parse(safeStr(f[key]) || '{}'); } catch { return {}; } };
  const installCheck = getCheck('mvhrInstallChecklist');
  const functionalCheck = getCheck('mvhrFunctionalChecklist');
  const noiseCheck = getCheck('mvhrNoiseChecklist');

  const ynaBadge = (v: string) =>
    v === 'Yes' ? '<span class="badge-pass">Yes</span>'
    : v === 'No' ? '<span class="badge-fail">No</span>'
    : `<span style="background:#e2e8f0;color:#475569;font-size:9px;font-weight:700;padding:2px 9px;border-radius:20px">${esc(v || 'N/A')}</span>`;

  const checklistTable = (checks: Record<string, string>, items: string[]) => `
    <table class="data-table">
      <tr><th style="width:60%">Check Item</th><th>Result</th></tr>
      ${items.map(item => `<tr><td>${esc(item)}</td><td>${ynaBadge(checks[item] || '')}</td></tr>`).join('')}
    </table>`;

  const INSTALL_ITEMS = ['Unit Installed Securely', 'Intake Duct Connected', 'Exhaust Duct Connected', 'Supply Duct Connected', 'Extract Duct Connected', 'Condensate Drain Connected', 'Filters Installed', 'Access for Maintenance Available', 'Ductwork Insulated Where Required', 'Fire Stopping Complete', 'Identification Labels Installed'];
  const FUNCTIONAL_ITEMS = ['Unit Powered', 'Controller Operational', 'Boost Function Operational', 'Summer Bypass Operational', 'Frost Protection Operational', 'Supply Fan Operational', 'Extract Fan Operational', 'Unit Responds to Controls', 'No Fault Codes Displayed'];
  const NOISE_ITEMS = ['Unit Running Quietly', 'Excessive Vibration Observed', 'Airflow Balanced', 'Occupant Controls Demonstrated'];

  const roomRows = rooms.length ? `
    <table class="data-table">
      <tr><th>#</th><th>Room</th><th>Type</th><th>Design Supply</th><th>Actual Supply</th><th>Design Extract</th><th>Actual Extract</th><th>Result</th><th>Comments</th></tr>
      ${rooms.map((r, i) => {
        const pass = r.passOrFail === 'Pass';
        const badge = pass ? '<span class="badge-pass">Pass</span>' : '<span class="badge-fail">Fail</span>';
        return `<tr>
          <td>${i + 1}</td>
          <td>${esc(r.roomName)}</td>
          <td>${esc(r.roomType)}</td>
          <td>${esc(r.designSupply)} l/s</td>
          <td>${esc(r.actualSupply)} l/s</td>
          <td>${esc(r.designExtract)} l/s</td>
          <td>${esc(r.actualExtract)} l/s</td>
          <td>${badge}</td>
          <td style="font-style:italic;color:#64748b">${esc(r.comments)}</td>
        </tr>`;
      }).join('')}
    </table>` : '<p style="font-size:10px;color:#94a3b8;font-style:italic">No room entries recorded</p>';

  const defectRows = defects.length ? `
    <table class="data-table">
      <tr><th>#</th><th>Description</th><th>Responsible</th><th>Due Date</th><th>Status</th><th>Comments</th></tr>
      ${defects.map((d, i) => {
        const stClr = d.status === 'Closed' || d.status === 'Complete' ? '#065f46' : d.status === 'In Progress' ? '#854d0e' : '#991b1b';
        const stBg  = d.status === 'Closed' || d.status === 'Complete' ? '#d1fae5' : d.status === 'In Progress' ? '#fef9c3' : '#fee2e2';
        return `<tr>
          <td>${i + 1}</td>
          <td>${esc(d.description)}</td>
          <td>${esc(d.responsiblePerson)}</td>
          <td>${fmtDate(d.dueDate)}</td>
          <td><span style="background:${stBg};color:${stClr};font-size:9px;font-weight:700;padding:2px 9px;border-radius:20px">${esc(d.status)}</span></td>
          <td style="font-style:italic;color:#64748b">${esc(d.comments)}</td>
        </tr>`;
      }).join('')}
    </table>` : '<p style="font-size:10px;color:#94a3b8;font-style:italic">No defects recorded</p>';

  const statusColor = (() => {
    const s = safeStr(f.mvhrCommissioningStatus);
    if (s === 'Passed') return { bg: '#d1fae5', text: '#065f46' };
    if (s === 'Passed with Comments') return { bg: '#fef9c3', text: '#854d0e' };
    if (s === 'Failed') return { bg: '#fee2e2', text: '#991b1b' };
    return { bg: '#e2e8f0', text: '#475569' };
  })();

  return `
    ${sectionHtml('Project / Plot Information', dataGrid([
      ['Project', safeStr(f.projectName)],
      ['Plot / Apartment No.', safeStr(f.mvhrPlot)],
      ['Block', safeStr(f.mvhrBlock)],
      ['Level / Floor', safeStr(f.mvhrLevel)],
      ['Date', fmtDate(safeStr(f.date))],
      ['Commissioning Engineer', safeStr(f.mvhrCommissioningEngineer)],
      ['Company', safeStr(f.mvhrCompany)],
      ['Witness / Client Rep.', safeStr(f.mvhrWitness)],
    ], 3))}
    ${section('Comments', safeStr(f.comments))}
    ${sectionHtml('MVHR Unit Details', dataGrid([
      ['Unit Reference', safeStr(f.mvhrUnitRef)],
      ['Manufacturer', safeStr(f.mvhrManufacturer)],
      ['Model', safeStr(f.mvhrModel)],
      ['Serial Number', safeStr(f.mvhrSerialNumber)],
      ['Location', safeStr(f.mvhrLocation)],
      ['Asset Tag', safeStr(f.mvhrAssetTag)],
      ['Unit Capacity', safeStr(f.mvhrUnitCapacity)],
    ], 3))}
    ${sectionHtml('Installation Checks', checklistTable(installCheck, INSTALL_ITEMS))}
    ${section('Installation Comments', safeStr(f.mvhrInstallComments))}
    ${sectionHtml('Airflow Commissioning — Room Readings', roomRows)}
    ${sectionHtml('Functional Testing', checklistTable(functionalCheck, FUNCTIONAL_ITEMS))}
    ${section('Functional Testing Comments', safeStr(f.mvhrFunctionalComments))}
    ${sectionHtml('Noise / Performance Checks', checklistTable(noiseCheck, NOISE_ITEMS))}
    ${section('Performance Comments', safeStr(f.mvhrNoiseComments))}
    ${sectionHtml('Defects / Outstanding Works', defectRows)}
    ${sectionHtml('Commissioning Result', `
      <div style="display:flex;align-items:center;justify-content:space-between;background:${statusColor.bg};border:1.5px solid ${statusColor.text}40;border-radius:8px;padding:14px 18px;margin-bottom:12px">
        <div>
          <div style="font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Commissioning Status</div>
          <div style="font-size:16px;font-weight:800;color:${statusColor.text}">${esc(safeStr(f.mvhrCommissioningStatus) || 'Not Set')}</div>
        </div>
      </div>
      ${dataGrid([
        ['Engineer Name', safeStr(f.mvhrEngineerName)],
        ['Witness Name', safeStr(f.mvhrWitnessName)],
        ['Sign-Off Date', fmtDate(safeStr(f.mvhrSignOffDate))],
      ], 3)}
    `)}
    ${section('Final Comments', safeStr(f.mvhrFinalComments))}
  `;
}

function buildHIUBody(f: Record<string, unknown>): string {
  interface HIUDefect { description: string; responsiblePerson: string; dueDate: string; status: string; comments: string; }
  let defects: HIUDefect[] = [];
  try { defects = JSON.parse(safeStr(f.hiuDefects) || '[]'); } catch { /* */ }
  const getSet = (key: string): string[] => { try { return JSON.parse(safeStr(f[key]) || '[]'); } catch { return []; } };
  const pillHtml = (items: string[], color = '#ccfbf1', textColor = '#115e59') =>
    items.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">${items.map(a => `<span style="background:${color};color:${textColor};font-size:9px;font-weight:700;padding:2px 9px;border-radius:20px">${esc(a)}</span>`).join('')}</div>` : '';
  const defectRows = defects.length ? `
    <table class="data-table">
      <tr><th>#</th><th>Description</th><th>Responsible</th><th>Due Date</th><th>Status</th><th>Comments</th></tr>
      ${defects.map((d, i) => {
        const stClr = d.status === 'Closed' || d.status === 'Complete' ? '#065f46' : d.status === 'In Progress' ? '#854d0e' : '#991b1b';
        const stBg  = d.status === 'Closed' || d.status === 'Complete' ? '#d1fae5' : d.status === 'In Progress' ? '#fef9c3' : '#fee2e2';
        return `<tr>
          <td>${i + 1}</td>
          <td>${esc(d.description)}</td>
          <td>${esc(d.responsiblePerson)}</td>
          <td>${fmtDate(d.dueDate)}</td>
          <td><span style="background:${stBg};color:${stClr};font-size:9px;font-weight:700;padding:2px 9px;border-radius:20px">${esc(d.status)}</span></td>
          <td style="font-style:italic;color:#64748b">${esc(d.comments)}</td>
        </tr>`;
      }).join('')}
    </table>
  ` : '<p style="font-size:10px;color:#94a3b8;font-style:italic">No defects recorded</p>';

  const statusColor = (() => {
    const s = safeStr(f.hiuCommissioningStatus);
    if (s === 'Passed') return { bg: '#d1fae5', text: '#065f46' };
    if (s === 'Passed with Comments') return { bg: '#fef9c3', text: '#854d0e' };
    if (s === 'Failed') return { bg: '#fee2e2', text: '#991b1b' };
    return { bg: '#e2e8f0', text: '#475569' };
  })();

  return `
    ${sectionHtml('Project / Plot Information', dataGrid([
      ['Project', safeStr(f.projectName)],
      ['Plot / Apartment No.', safeStr(f.hiuPlot)],
      ['Block', safeStr(f.hiuBlock)],
      ['Level / Floor', safeStr(f.hiuLevel)],
      ['Date', fmtDate(safeStr(f.date))],
      ['Commissioning Engineer', safeStr(f.hiuCommissioningEngineer)],
      ['Company', safeStr(f.hiuCompany)],
      ['Witness / Client Rep.', safeStr(f.hiuWitness)],
    ], 3))}
    ${section('Comments', safeStr(f.comments))}
    ${sectionHtml('HIU Asset Details', dataGrid([
      ['HIU Reference', safeStr(f.hiuRef)],
      ['Manufacturer', safeStr(f.hiuManufacturer)],
      ['Model', safeStr(f.hiuModel)],
      ['Serial Number', safeStr(f.hiuSerialNumber)],
      ['Location', safeStr(f.hiuLocation)],
      ['Asset Tag', safeStr(f.hiuAssetTag)],
    ], 3))}
    ${sectionHtml('Heat Meter Details', `
      ${dataGrid([
        ['Heat Meter Ref', safeStr(f.heatMeterRef)],
        ['Manufacturer', safeStr(f.heatMeterManufacturer)],
        ['Model', safeStr(f.heatMeterModel)],
        ['Serial Number', safeStr(f.heatMeterSerialNumber)],
        ['Reading at Commissioning', safeStr(f.heatMeterReading)],
      ], 3)}
      ${dataGrid([
        ['Pulse Output Checked', safeStr(f.heatMeterPulseChecked)],
        ['M-Bus / BMS Connected', safeStr(f.heatMeterMBusConnected)],
      ], 2)}
    `)}
    ${sectionHtml('Valve / Strainer Checks', `
      ${dataGrid([
        ['Primary Flow Valve', safeStr(f.valvePrimaryFlow)],
        ['Primary Return Valve', safeStr(f.valvePrimaryReturn)],
        ['Secondary Flow Valve', safeStr(f.valveSecondaryFlow)],
        ['Secondary Return Valve', safeStr(f.valveSecondaryReturn)],
        ['Cold Water Isolation Valve', safeStr(f.valveColdWater)],
        ['DHW Outlet Valve', safeStr(f.valveDHWOutlet)],
      ], 3)}
      ${pillHtml(getSet('hiuValveChecklist'))}
    `)}
    ${sectionHtml('Primary Heating Readings', dataGrid([
      ['Primary Flow Temp', safeStr(f.primaryFlowTemp) ? safeStr(f.primaryFlowTemp) + ' °C' : ''],
      ['Primary Return Temp', safeStr(f.primaryReturnTemp) ? safeStr(f.primaryReturnTemp) + ' °C' : ''],
      ['Primary Diff. Pressure', safeStr(f.primaryDiffPressure) ? safeStr(f.primaryDiffPressure) + ' kPa' : ''],
      ['Primary Flow Rate', safeStr(f.primaryFlowRate) ? safeStr(f.primaryFlowRate) + ' l/min' : ''],
      ['System Pressure', safeStr(f.systemPressure) ? safeStr(f.systemPressure) + ' bar' : ''],
    ], 3))}
    ${sectionHtml('Secondary Heating Readings', `
      ${dataGrid([
        ['Secondary Flow Temp', safeStr(f.secondaryFlowTemp) ? safeStr(f.secondaryFlowTemp) + ' °C' : ''],
        ['Secondary Return Temp', safeStr(f.secondaryReturnTemp) ? safeStr(f.secondaryReturnTemp) + ' °C' : ''],
      ], 2)}
      ${dataGrid([
        ['Heating Flow Confirmed', safeStr(f.heatingFlowConfirmed)],
        ['Heating Return Confirmed', safeStr(f.heatingReturnConfirmed)],
        ['Radiators / UFH Warmed', safeStr(f.radUFHWarmed)],
      ], 3)}
    `)}
    ${sectionHtml('DHW Performance', `
      ${dataGrid([
        ['Cold Water Inlet Temp', safeStr(f.cwInletTemp) ? safeStr(f.cwInletTemp) + ' °C' : ''],
        ['DHW Outlet Temp', safeStr(f.dhwOutletTemp) ? safeStr(f.dhwOutletTemp) + ' °C' : ''],
        ['DHW Flow Rate', safeStr(f.dhwFlowRate) ? safeStr(f.dhwFlowRate) + ' l/min' : ''],
      ], 3)}
      ${dataGrid([
        ['Temperature Stabilised', safeStr(f.dhwTempStabilised)],
        ['Outlet Temperature Acceptable', safeStr(f.dhwOutletAcceptable)],
      ], 2)}
    `)}
    ${getSet('hiuControlsChecklist').length ? sectionHtml('Controls / Electrical Interface', `
      ${pillHtml(getSet('hiuControlsChecklist'), '#ccfbf1', '#115e59')}
    `) : ''}
    ${sectionHtml('Defects / Outstanding Works', defectRows)}
    ${sectionHtml('Commissioning Result / Sign-off', `
      <div style="margin-bottom:8px">
        <span style="background:${statusColor.bg};color:${statusColor.text};font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px">${esc(safeStr(f.hiuCommissioningStatus))}</span>
      </div>
      ${dataGrid([
        ['Engineer Name', safeStr(f.hiuEngineerName)],
        ['Witness Name', safeStr(f.hiuWitnessName)],
        ['Sign-off Date', fmtDate(safeStr(f.hiuSignOffDate))],
      ], 3)}
      ${safeStr(f.hiuFinalComments) ? `<div class="section-content" style="margin-top:6px">${esc(safeStr(f.hiuFinalComments))}</div>` : ''}
    `)}
  `;
}

function buildCommercialBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Notice Details', dataGrid([
      ['Notice Ref', safeStr(f.noticeRef)], ['Variation Ref', safeStr(f.variationRef)],
      ['Area / Location', safeStr(f.areaLocation)],
      ['Instruction Source', safeStr(f.instructionSource)],
      ['Variation Status', safeStr(f.variationStatus)],
      ['Raised By / Issued By', safeStr(f.raisedBy)],
    ]))}
    ${section('Description', safeStr(f.description))}
    ${section('Cause', safeStr(f.cause))}
    ${section('Impact', safeStr(f.impact))}
    ${section('Programme Impact', safeStr(f.programmeImpact))}
    ${section('Commercial Impact / Cost', safeStr(f.commercialImpact) || safeStr(f.costImpact))}
    ${section('Notes', safeStr(f.notes))}
  `;
}

function buildQABody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Inspection Record', `
      ${section('Inspection Description', safeStr(f.description))}
      ${section('Comments / Observations', safeStr(f.comments))}
      ${section('Notes', safeStr(f.notes))}
    `)}
  `;
}

function buildGenericBody(f: Record<string, unknown>): string {
  return `
    ${section('Description', safeStr(f.description))}
    ${section('Subject', safeStr(f.subject))}
    ${section('Question / Request', safeStr(f.question))}
    ${section('Response', safeStr(f.response))}
    ${section('Findings', safeStr(f.findings))}
    ${section('Actions Required', safeStr(f.actionsRequired))}
    ${section('Comments / Notes', safeStr(f.comments) || safeStr(f.notes))}
  `;
}

// ─── Site Hold Up ─────────────────────────────────────────────────────────────

function buildSiteHoldUpBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Record Details', dataGrid([
      ['Reference', safeStr(f.shuRef)],
      ['Location / Area', safeStr(f.areaLocation)],
    ]))}
    ${section('Description of Hold Up', safeStr(f.description))}
    ${section('Cause of Hold Up', safeStr(f.cause))}
    ${section('Impact on Progress', safeStr(f.impact))}
    ${section('Immediate Actions Taken', safeStr(f.shuImmediateActions))}
    ${section('Additional Comments', safeStr(f.comments))}
  `;
}

// ─── Site Change Request ───────────────────────────────────────────────────────

function buildSiteChangeRequestBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Record Details', dataGrid([
      ['Reference', safeStr(f.scrRef)],
      ['Location / Area', safeStr(f.areaLocation)],
    ]))}
    ${section('Description of Requested Change', safeStr(f.description))}
    ${section('Reason for Change', safeStr(f.scrReason))}
    ${section('Potential Programme Impact', safeStr(f.scrProgrammeImpact))}
    ${section('Potential Commercial Impact', safeStr(f.scrCommercialImpact))}
    ${section('Additional Comments', safeStr(f.comments))}
  `;
}

// ─── Site Note ─────────────────────────────────────────────────────────────────

function buildSiteNoteBody(f: Record<string, unknown>): string {
  return `
    ${sectionHtml('Note Details', dataGrid([
      ['Reference',      safeStr(f.snRef)],
      ['Category',       safeStr(f.snCategory)],
      ['Date',           fmtDate(safeStr(f.date))],
      ['Time',           safeStr(f.snTime)],
      ['Created By',     safeStr(f.completedBy)],
      ['Location / Area', safeStr(f.areaLocation)],
    ]))}
    ${safeStr(f.snSubject) ? sectionHtml('Subject', `<div style="font-size:13px;font-weight:700;color:#0f172a">${esc(safeStr(f.snSubject))}</div>`) : ''}
    ${section('Site Note', safeStr(f.snBody))}
    ${safeStr(f.snRecommendedAction) ? section('Recommended Action', safeStr(f.snRecommendedAction)) : ''}
    ${safeStr(f.comments) ? section('Additional Comments', safeStr(f.comments)) : ''}
  `;
}

// ─── Main export ──────────────────────────────────────────────────────────────

function buildTWRBody(f: Record<string, unknown>): string {
  interface TWRReading { id: string; area: string; description: string; flowRate: string; temp20s: string; temp60s: string; passFail: string; notes: string; }
  let readings: TWRReading[] = [];
  try { readings = JSON.parse(safeStr(f.twrReadings) || '[]'); } catch { /* */ }

  const readingsHtml = readings.length > 0
    ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">
        <thead>
          <tr style="background:#1a2236">
            <th style="padding:5px 7px;text-align:left;border:1px solid #1e2d4a;color:#94a3b8;font-weight:700;font-size:9px;text-transform:uppercase">ID / Ref</th>
            <th style="padding:5px 7px;text-align:left;border:1px solid #1e2d4a;color:#94a3b8;font-weight:700;font-size:9px;text-transform:uppercase">Area</th>
            <th style="padding:5px 7px;text-align:left;border:1px solid #1e2d4a;color:#94a3b8;font-weight:700;font-size:9px;text-transform:uppercase">Outlet / Description</th>
            <th style="padding:5px 7px;text-align:center;border:1px solid #1e2d4a;color:#94a3b8;font-weight:700;font-size:9px;text-transform:uppercase">Flow Rate (L/min)</th>
            <th style="padding:5px 7px;text-align:center;border:1px solid #1e2d4a;color:#94a3b8;font-weight:700;font-size:9px;text-transform:uppercase">Temp @ 20s (°C)</th>
            <th style="padding:5px 7px;text-align:center;border:1px solid #1e2d4a;color:#94a3b8;font-weight:700;font-size:9px;text-transform:uppercase">Temp @ 60s (°C)</th>
            <th style="padding:5px 7px;text-align:center;border:1px solid #1e2d4a;color:#94a3b8;font-weight:700;font-size:9px;text-transform:uppercase">Result</th>
            <th style="padding:5px 7px;text-align:left;border:1px solid #1e2d4a;color:#94a3b8;font-weight:700;font-size:9px;text-transform:uppercase">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${readings.map(r => {
            const passColor = r.passFail === 'Pass' ? '#065f46' : r.passFail === 'Fail' ? '#7f1d1d' : '#334155';
            const passText  = r.passFail === 'Pass' ? '#6ee7b7' : r.passFail === 'Fail' ? '#fca5a5' : '#94a3b8';
            return `<tr>
              <td style="padding:5px 7px;border:1px solid #1e2d4a;color:#e2e8f0">${esc(r.id)}</td>
              <td style="padding:5px 7px;border:1px solid #1e2d4a;color:#e2e8f0">${esc(r.area)}</td>
              <td style="padding:5px 7px;border:1px solid #1e2d4a;color:#e2e8f0">${esc(r.description)}</td>
              <td style="padding:5px 7px;border:1px solid #1e2d4a;color:#e2e8f0;text-align:center">${r.flowRate ? `${esc(r.flowRate)} L/min` : '—'}</td>
              <td style="padding:5px 7px;border:1px solid #1e2d4a;color:#e2e8f0;text-align:center">${esc(r.temp20s)}</td>
              <td style="padding:5px 7px;border:1px solid #1e2d4a;color:#e2e8f0;text-align:center">${esc(r.temp60s)}</td>
              <td style="padding:5px 7px;border:1px solid #1e2d4a;text-align:center">
                <span style="background:${passColor};color:${passText};padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700">${esc(r.passFail)}</span>
              </td>
              <td style="padding:5px 7px;border:1px solid #1e2d4a;color:#94a3b8;font-style:italic">${esc(r.notes)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`
    : '<p style="color:#64748b;font-size:11px;font-style:italic">No readings recorded.</p>';

  return `
    ${sectionHtml('Survey Information', dataGrid([
      ['System / Service', safeStr(f.twrSystem)],
      ['Location / Building', safeStr(f.twrLocation)],
      ['Area / Zone', safeStr(f.twrArea)],
      ['Completed By', safeStr(f.completedBy)],
      ['Witnessed By', safeStr(f.twrWitnessedBy)],
    ], 3))}
    ${sectionHtml(`Temperature Readings (${readings.length} outlet${readings.length !== 1 ? 's' : ''})`, readingsHtml)}
  `;
}

// ─── Practical Completion Certificate ────────────────────────────────────────

interface PCCAsset { item?: string; manufacturer?: string; model?: string; serialNumber?: string; assetNumber?: string; quantity?: string; }
interface PCCCheckItem { description?: string; result?: string; }

function buildPCCBody(f: Record<string, unknown>): string {
  const assets: PCCAsset[] = (() => { try { return JSON.parse(safeStr(f.pccAssets)) as PCCAsset[]; } catch { return []; } })();
  const checklist: PCCCheckItem[] = (() => { try { return JSON.parse(safeStr(f.pccChecklist)) as PCCCheckItem[]; } catch { return []; } })();

  const assetsRows = assets.length
    ? `<table class="data-table" style="margin-top:6px">
        <thead><tr>
          <th>Item</th><th>Manufacturer</th><th>Model</th><th>Serial Number</th><th>Asset No.</th><th>Qty</th>
        </tr></thead>
        <tbody>
          ${assets.map(a => `<tr>
            <td style="font-weight:600">${esc(a.item)}</td>
            <td>${esc(a.manufacturer)}</td>
            <td>${esc(a.model)}</td>
            <td style="font-family:monospace">${esc(a.serialNumber)}</td>
            <td style="font-family:monospace">${esc(a.assetNumber)}</td>
            <td style="text-align:center;font-weight:600">${esc(a.quantity)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : '<p style="font-size:10px;color:#94a3b8;font-style:italic">No assets recorded.</p>';

  const checkRows = checklist.length
    ? `<table class="data-table" style="margin-top:6px">
        <tbody>
          ${checklist.map(c => {
            const badge = c.result === 'Pass' ? 'badge-pass' : c.result === 'Fail' ? 'badge-fail' : 'badge-na';
            return `<tr><td>${esc(c.description)}</td><td style="text-align:right"><span class="${badge}">${esc(c.result)}</span></td></tr>`;
          }).join('')}
        </tbody>
      </table>`
    : '<p style="font-size:10px;color:#94a3b8;font-style:italic">No checklist items.</p>';

  const metaItems: [string, string][] = [
    ['Certificate Ref', safeStr(f.pccRef)],
    ['Contract', safeStr(f.pccContract)],
    ['Client', safeStr(f.pccClient)],
    ['Location / Area', safeStr(f.pccLocationArea)],
    ['Date', fmtDate(safeStr(f.date))],
  ].filter(([, v]) => v) as [string, string][];

  const hovName = esc(safeStr(f.pccHandedOverBy));
  const hovTitle = esc(safeStr(f.pccHandedOverByTitle));
  const accName = esc(safeStr(f.pccAcceptedBy));
  const accTitle = esc(safeStr(f.pccAcceptedByTitle));
  const accCompany = esc(safeStr(f.pccAcceptedByCompany));

  return `
    <div class="meta-block">
      <div class="meta-grid meta-grid-2">
        ${metaItems.map(([l, v]) => `<div class="meta-item"><div class="meta-label">${esc(l)}</div><div class="meta-value">${esc(v)}</div></div>`).join('')}
      </div>
    </div>
    ${safeStr(f.pccDescriptionOfWorks) ? sectionHtml('Description of Works', `<div class="section-content">${esc(safeStr(f.pccDescriptionOfWorks))}</div>`) : ''}
    ${assets.length ? sectionHtml(`Assets / Equipment (${assets.length})`, assetsRows) : ''}
    ${checklist.length ? sectionHtml(`Completion Checklist (${checklist.length} items)`, checkRows) : ''}
    ${safeStr(f.pccOutstandingItems) ? sectionHtml('Outstanding Items', `<div class="section-content">${esc(safeStr(f.pccOutstandingItems))}</div>`) : ''}
    <div class="section" style="border-left:4px solid #f97316;background:#fffbf7;border-radius:6px;padding:14px 16px;margin-top:20px">
      <div class="section-heading" style="color:#c2410c">Certificate Statement</div>
      <p style="font-size:11px;color:#1e293b;line-height:1.8;font-style:italic">We certify that the works described above have been installed, tested and commissioned where applicable and, in our opinion, are practically complete, subject only to any outstanding items recorded within this certificate and the provisions of the applicable defects liability period.</p>
    </div>
    ${sectionHtml('Acceptance', `
      <div class="data-grid meta-grid-2" style="margin-bottom:14px">
        <div class="data-cell"><div class="data-cell-label">Handed Over By</div><div class="data-cell-value">${hovName || '—'}</div>${hovTitle ? `<div style="font-size:9px;color:#64748b;margin-top:2px">${hovTitle}</div>` : ''}</div>
        <div class="data-cell"><div class="data-cell-label">Accepted By</div><div class="data-cell-value">${accName || '—'}</div>${accTitle ? `<div style="font-size:9px;color:#64748b;margin-top:2px">${accTitle}</div>` : ''}</div>
        <div class="data-cell"><div class="data-cell-label">Company</div><div class="data-cell-value">${accCompany || '—'}</div></div>
        <div class="data-cell"><div class="data-cell-label">Date of Acceptance</div><div class="data-cell-value">${safeStr(f.pccAcceptanceDate) ? fmtDate(safeStr(f.pccAcceptanceDate)) : '—'}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:4px">
        <div>
          <div style="font-size:8.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Signature (Handing Over)</div>
          <div class="sig-box"></div>
          <div style="font-size:9px;color:#64748b;margin-top:3px">${hovName}${hovTitle ? ` &mdash; ${hovTitle}` : ''}</div>
        </div>
        <div>
          <div style="font-size:8.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Signature (Acceptance)</div>
          <div class="sig-box"></div>
          <div style="font-size:9px;color:#64748b;margin-top:3px">${accName}${accTitle ? ` &mdash; ${accTitle}` : ''}${accCompany ? ' &mdash; ' + accCompany : ''}</div>
        </div>
      </div>
    `)}
  `;
}

function buildPCCPageHTML(form: ExtendedSiteForm, orgSettings?: OrgSettings | null): string {
  const f = form as unknown as Record<string, unknown>;
  const orgName = orgSettings?.company_name || 'VYSITE';
  const orgLogo = orgSettings?.logo_data_url;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const certDate = safeStr(f.date) ? fmtDate(safeStr(f.date)) : today;
  const title = safeStr(f.title) || 'Practical Completion';

  const logoHtml = orgLogo
    ? `<img style="height:38px;max-width:140px;object-fit:contain;display:block" src="${orgLogo}" alt="${esc(orgName)}">`
    : `<div style="font-size:19px;font-weight:900;color:#f97316;letter-spacing:0">${esc(orgName)}</div>`;

  const assets: PCCAsset[] = (() => {
    try { return JSON.parse(safeStr(f.pccAssets)) as PCCAsset[]; } catch { return []; }
  })();
  const checklist: PCCCheckItem[] = (() => {
    try { return JSON.parse(safeStr(f.pccChecklist)) as PCCCheckItem[]; } catch { return []; }
  })();

  const anyFail = checklist.length > 0 && checklist.some(c => c.result === 'Fail');

  /* ── Styles ── */
  // micro-label above a value cell — keep spacing low so letters don't break apart
  const lbl  = 'font-size:7px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px';
  const val  = 'font-size:11px;font-weight:700;color:#0f172a;line-height:1.3';
  const sub  = 'font-size:9px;color:#64748b;margin-top:2px';
  const cell = 'background:#fff;border:1px solid #e2e8f0;border-radius:4px;padding:8px 12px';
  // section heading — letter-spacing must stay very low or word shapes distort
  const sh   = 'font-size:8px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;padding-bottom:6px;border-bottom:1.5px solid #e2e8f0;margin-bottom:11px';
  const sec  = 'margin-top:18px;page-break-inside:avoid';

  /* ── Assets table ── */
  const assetsTable = assets.length ? `
    <table style="width:100%;border-collapse:collapse;font-size:10px">
      <thead>
        <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
          <th style="padding:6px 9px;text-align:left;font-size:7px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.03em">Item</th>
          <th style="padding:6px 9px;text-align:left;font-size:7px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.03em">Manufacturer</th>
          <th style="padding:6px 9px;text-align:left;font-size:7px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.03em">Model</th>
          <th style="padding:6px 9px;text-align:left;font-size:7px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.03em">Serial Number</th>
          <th style="padding:6px 9px;text-align:left;font-size:7px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.03em">Asset Number</th>
          <th style="padding:6px 9px;text-align:center;font-size:7px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.03em">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${assets.map((a, i) => `<tr style="${i % 2 !== 0 ? 'background:#f8fafc' : ''}">
          <td style="padding:6px 9px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-weight:600">${esc(a.item)}</td>
          <td style="padding:6px 9px;border-bottom:1px solid #f1f5f9;color:#334155">${esc(a.manufacturer)}</td>
          <td style="padding:6px 9px;border-bottom:1px solid #f1f5f9;color:#334155">${esc(a.model)}</td>
          <td style="padding:6px 9px;border-bottom:1px solid #f1f5f9;color:#334155;font-family:'Courier New',monospace;font-size:9px">${esc(a.serialNumber)}</td>
          <td style="padding:6px 9px;border-bottom:1px solid #f1f5f9;color:#334155;font-family:'Courier New',monospace;font-size:9px">${esc(a.assetNumber)}</td>
          <td style="padding:6px 9px;border-bottom:1px solid #f1f5f9;color:#0f172a;text-align:center;font-weight:700">${esc(a.quantity)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
    : `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:10px 12px;font-size:10px;color:#94a3b8;font-style:italic">No assets or equipment recorded.</div>`;

  /* ── Checklist ── */
  const checklistHtml = checklist.length ? `
    <table style="width:100%;border-collapse:collapse;font-size:10.5px">
      <tbody>
        ${checklist.map((c, i) => {
          const isPassed = c.result === 'Pass';
          const isFailed = c.result === 'Fail';
          const badgeCss = isPassed
            ? 'background:#16a34a;color:#fff;border:1px solid #15803d'
            : isFailed
            ? 'background:#dc2626;color:#fff;border:1px solid #b91c1c'
            : 'background:#e2e8f0;color:#475569;border:1px solid #cbd5e1';
          const rowBg = isPassed ? 'background:#f0fdf4' : isFailed ? 'background:#fef2f2' : (i % 2 !== 0 ? 'background:#f8fafc' : '');
          return `<tr style="${rowBg}">
            <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;color:#1e293b">${esc(c.description)}</td>
            <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap">
              <span class="badge" style="display:inline-block;padding:2px 11px;border-radius:20px;font-size:8.5px;font-weight:700;letter-spacing:.01em;${badgeCss}">${esc(c.result || 'N/A')}</span>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`
    : `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:10px 12px;font-size:10px;color:#94a3b8;font-style:italic">No checklist items recorded.</div>`;

  /* ── Status badge ── */
  const statusBadge = anyFail
    ? `<span style="display:inline-flex;align-items:center;gap:6px;background:#fff7ed;border:1px solid #fed7aa;border-radius:4px;padding:5px 12px">
        <span style="width:7px;height:7px;background:#f97316;border-radius:50%;flex-shrink:0;display:inline-block"></span>
        <span style="font-size:9px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:.03em">Outstanding Items — Review Required</span>
       </span>`
    : `<span style="display:inline-flex;align-items:center;gap:6px;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:5px 12px">
        <span style="width:7px;height:7px;background:#16a34a;border-radius:50%;flex-shrink:0;display:inline-block"></span>
        <span style="font-size:9px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.03em">Practical Completion Certified</span>
       </span>`;

  /* ── Evidence ── */
  const attachments = (f.attachments ?? f['extra_data.attachments']) as unknown[];
  const evidenceSection = attachments && Array.isArray(attachments) && attachments.length
    ? `<div style="${sec}"><div style="${sh}">Evidence &amp; Attachments</div>${evidenceHtml(attachments)}</div>`
    : '';

  /* ── Acceptance parties ── */
  const hovName     = esc(safeStr(f.pccHandedOverBy));
  const hovPosition = esc(safeStr(f.pccHandedOverByTitle));
  const hovCompany  = esc(safeStr(f.pccHandedOverByCompany)) || esc(orgName);
  const accName     = esc(safeStr(f.pccAcceptedBy));
  const accPosition = esc(safeStr(f.pccAcceptedByTitle));
  const accCompany  = esc(safeStr(f.pccAcceptedByCompany));
  const accDate     = safeStr(f.pccAcceptanceDate) ? fmtDate(safeStr(f.pccAcceptanceDate)) : '';

  const partyBlock = (label: string, name: string, position: string, company: string, date: string) => `
    <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
      <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:7px 14px">
        <span style="font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#64748b">${label}</span>
      </div>
      <div style="padding:12px 14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          <div><div style="${lbl}">Name</div><div style="${val}">${name || '—'}</div></div>
          <div><div style="${lbl}">Position / Job Title</div><div style="${val}">${position || '—'}</div></div>
          ${company ? `<div><div style="${lbl}">Company</div><div style="${val}">${company}</div></div>` : '<div></div>'}
          ${date ? `<div><div style="${lbl}">Date</div><div style="${val}">${date}</div></div>` : '<div></div>'}
        </div>
        <div style="font-size:7px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.03em;margin-bottom:6px">Signature</div>
        <div style="height:40px;border-bottom:1.5px solid #cbd5e1;margin-bottom:6px"></div>
        <div style="font-size:9px;color:#94a3b8">${name}${position ? ` — ${position}` : ''}${company ? `, ${company}` : ''}</div>
      </div>
    </div>`;

  const CSS = `
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#1e293b; background:white; font-size:11px; line-height:1.5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { max-width:840px; margin:0 auto; padding:30px 36px 36px; }
    @page { margin:0; size:A4; }
    @media print { .page { padding:14mm 16mm 14mm 16mm; max-width:100%; } }
    .badge { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .evidence-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:8px; }
    .evidence-item { border:1px solid #e2e8f0; border-radius:5px; overflow:hidden; page-break-inside:avoid; }
    .evidence-img { width:100%; height:110px; object-fit:cover; display:block; background:#f8fafc; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .evidence-caption { padding:3px 6px; font-size:7.5px; color:#64748b; background:#f8fafc; border-top:1px solid #e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Practical Completion Certificate — ${esc(title)}</title>
  <style>${CSS}</style>
</head>
<body>
<div class="page">

  <!-- ══ HEADER ══════════════════════════════════════════════════ -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:14px;border-bottom:3px solid #f97316">
    <div>
      ${logoHtml}
      <div style="font-size:7.5px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.03em;margin-top:6px">Practical Completion Certificate</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#9ca3af;margin-bottom:4px">Certificate Reference</div>
      <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:4px;padding:5px 13px;display:inline-block">
        <span style="font-size:17px;font-family:'Courier New',monospace;color:#0f172a;font-weight:900;letter-spacing:1px">${esc(safeStr(f.pccRef))}</span>
      </div>
      <div style="font-size:8px;color:#9ca3af;margin-top:4px">Issued ${today}</div>
    </div>
  </div>

  <!-- ══ DOCUMENT IDENTITY ════════════════════════════════════════ -->
  <div style="padding:14px 0 12px;border-bottom:1px solid #e2e8f0">
    <div style="font-size:21px;font-weight:900;color:#0f172a;line-height:1.15;margin-bottom:4px;letter-spacing:0">${esc(title)}</div>
    ${safeStr(f.projectName) ? `<div style="font-size:11.5px;color:#64748b;font-weight:500;margin-bottom:9px">${esc(safeStr(f.projectName))}</div>` : `<div style="margin-bottom:9px"></div>`}
    ${statusBadge}
  </div>

  <!-- ══ PROJECT INFO ══════════════════════════════════════════════ -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px">
    ${safeStr(f.pccContract)     ? `<div style="${cell}"><div style="${lbl}">Contract</div><div style="${val}">${esc(safeStr(f.pccContract))}</div></div>` : ''}
    ${safeStr(f.pccClient)       ? `<div style="${cell}"><div style="${lbl}">Client</div><div style="${val}">${esc(safeStr(f.pccClient))}</div></div>` : ''}
    ${safeStr(f.pccLocationArea) ? `<div style="${cell}"><div style="${lbl}">Location / Area</div><div style="${val}">${esc(safeStr(f.pccLocationArea))}</div></div>` : ''}
    <div style="${cell}"><div style="${lbl}">Certificate Date</div><div style="${val}">${certDate}</div></div>
    ${safeStr(f.projectName)     ? `<div style="${cell}"><div style="${lbl}">Project</div><div style="${val}">${esc(safeStr(f.projectName))}</div></div>` : ''}
  </div>

  <!-- ══ DESCRIPTION OF WORKS ════════════════════════════════════ -->
  <div style="${sec}">
    <div style="${sh}">Description of Works</div>
    <div style="font-size:11px;color:#1e293b;line-height:1.85;background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #94a3b8;border-radius:0 4px 4px 0;padding:12px 15px;white-space:pre-wrap;min-height:48px">${esc(safeStr(f.pccDescriptionOfWorks)) || '<em style="color:#94a3b8">No description provided.</em>'}</div>
  </div>

  <!-- ══ ASSETS / EQUIPMENT ══════════════════════════════════════ -->
  <div style="${sec}">
    <div style="${sh}">Assets / Equipment — ${assets.length} Item${assets.length !== 1 ? 's' : ''}</div>
    ${assetsTable}
  </div>

  <!-- ══ COMPLETION CHECKLIST ════════════════════════════════════ -->
  <div style="${sec}">
    <div style="${sh}">Completion Checklist — ${checklist.length} Item${checklist.length !== 1 ? 's' : ''}</div>
    ${checklistHtml}
  </div>

  <!-- ══ OUTSTANDING ITEMS ════════════════════════════════════════ -->
  <div style="${sec}">
    <div style="${sh}">Outstanding Items / Observations</div>
    ${safeStr(f.pccOutstandingItems)
      ? `<div style="font-size:11px;color:#1e293b;line-height:1.75;background:#fff7ed;border:1px solid #fed7aa;border-left:3px solid #f97316;border-radius:0 4px 4px 0;padding:12px 15px;white-space:pre-wrap">${esc(safeStr(f.pccOutstandingItems))}</div>`
      : `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:10px 12px;font-size:10px;color:#94a3b8;font-style:italic">No outstanding items recorded at time of issue.</div>`}
  </div>

  <!-- ══ CERTIFICATE STATEMENT ════════════════════════════════════ -->
  <div style="margin-top:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:14px 16px;page-break-inside:avoid">
    <div style="font-size:7px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Certificate Statement</div>
    <p style="font-size:11px;color:#334155;line-height:1.85;font-style:italic">We certify that the works described within this certificate have been completed, installed, tested and commissioned where applicable and are hereby certified as Practically Complete, subject only to any outstanding items recorded within this certificate and the provisions of the applicable Defects Liability Period.</p>
  </div>

  <!-- ══ ACCEPTANCE ══════════════════════════════════════════════ -->
  <div style="${sec};page-break-before:always;padding-top:28px">
    <div style="${sh}">Acceptance &amp; Sign-Off</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${partyBlock('Handed Over By', hovName, hovPosition, hovCompany, certDate)}
      ${partyBlock('Accepted By', accName, accPosition, accCompany, accDate || certDate)}
    </div>
  </div>

  ${evidenceSection}

  <!-- ══ FOOTER ══════════════════════════════════════════════════ -->
  <div style="margin-top:24px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between">
    <div style="font-size:7px;color:#94a3b8;letter-spacing:.01em">${esc(orgName)} &nbsp;&middot;&nbsp; Practical Completion Certificate &nbsp;&middot;&nbsp; ${esc(safeStr(f.pccRef))}</div>
    <div style="font-size:7px;color:#94a3b8">Generated ${today}</div>
  </div>

</div>
<script>window.onload=function(){window.print();};<\/script>
</body>
</html>`;
}

export interface OrgSettings {
  company_name?: string;
  logo_data_url?: string;
}

export { CSS as FORM_PDF_CSS };

export function buildFormPageHTML(form: ExtendedSiteForm, orgSettings?: OrgSettings | null): string {
  const f = form as unknown as Record<string, unknown>;
  const formTitle = safeStr(f.title) || '(Untitled)';
  const orgName = orgSettings?.company_name || 'VYSITE';
  const orgLogo = orgSettings?.logo_data_url;
  const typeLabel = (() => {
    const map: Record<string, string> = {
      'Daily Site Report': 'Daily Site Report', 'QA Inspection': 'QA Inspection',
      'RFI': 'Request for Information', 'Hold Up Notice': 'Hold Up Notice',
      'H&S Inspection': 'H&S Inspection', 'Delay Notice': 'Delay Notice',
      'Variation': 'Variation Notice', 'Early Warning Notice': 'Early Warning Notice',
      'Site Instruction': 'Site Instruction', 'Technical Query': 'Technical Query',
      'Pressure Test': 'Pressure Test Record', 'Flushing Record': 'Flushing Record',
      'Valve Checklist': 'Valve Commissioning Record', 'AHU Commissioning': 'AHU Commissioning Record',
      'Dead Testing': 'Dead Testing Record', 'Continuity Test': 'Continuity Test Record',
      'Toolbox Talk': 'Toolbox Talk Record', 'Site Walk Audit': 'Site Walk Audit',
      'Electrical Commissioning Report': 'Electrical Commissioning Report',
      'Risk Assessment': 'Risk Assessment / RAMS',
      'Accident / Incident Report': 'Accident & Incident Report',
      'Plantroom Commissioning Record': 'Mechanical Plantroom Fill, Test & Commissioning Record',
      'HIU Commissioning Record': 'HIU Commissioning Record',
      'MVHR Commissioning Record': 'MVHR Commissioning Record',
      'Temperature Water Readings': 'Temperature Water Readings — Survey Record',
      'Practical Completion Certificate': 'Practical Completion Certificate',
      'Site Hold Up': 'Site Hold Up Record',
      'Site Change Request': 'Site Change Request',
      'Site Note': 'Site Note',
    };
    return map[form.type] ?? form.type;
  })();

  const logoHtml = orgLogo
    ? `<img class="doc-logo-img" src="${orgLogo}" alt="${esc(orgName)}" />`
    : `<div class="doc-logo-text">${esc(orgName)}</div>`;

  const statusStr = safeStr(f.status);
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const projectName = safeStr(f.projectName);

  const header = `
    <div class="doc-header">
      <div>
        ${logoHtml}
        <div class="doc-type-label">Site Documentation &mdash; ${esc(typeLabel)}</div>
      </div>
      <div class="doc-header-right">
        <div class="doc-title">${esc(formTitle)}</div>
        <div class="doc-dateline">
          ${today}${projectName ? ' &nbsp;&middot;&nbsp; ' + esc(projectName) : ''}
        </div>
      </div>
    </div>
    <div class="doc-subtitle-bar">
      ${esc(typeLabel)}${projectName ? ' &nbsp;&middot;&nbsp; ' + esc(projectName) : ''}${safeStr(f.date) ? ' &nbsp;&middot;&nbsp; ' + fmtDate(safeStr(f.date)) : ''}${safeStr(f.completedBy) ? ' &nbsp;&middot;&nbsp; ' + esc(safeStr(f.completedBy)) : ''}${statusStr ? statusBadge(statusStr) : ''}
    </div>`;

  const metaItems: [string, string][] = [
    ['Form Type', typeLabel],
    ['Project', projectName],
    ['Date', fmtDate(safeStr(f.date))],
    ['Completed By', safeStr(f.completedBy)],
    ['Status', statusStr],
    ['Document Ref', safeStr(f.rfiRef) || safeStr(f.tqRef) || safeStr(f.ramsRef) || safeStr(f.noticeRef) || safeStr(f.shuRef) || safeStr(f.scrRef) || safeStr(f.snRef) || safeStr(f.id)],
  ].filter(([, v]) => v) as [string, string][];

  const metaBlock = `
    <div class="meta-block">
      <div class="meta-grid">
        ${metaItems.map(([l, v]) => `<div class="meta-item"><div class="meta-label">${esc(l)}</div><div class="meta-value">${esc(v)}</div></div>`).join('')}
      </div>
    </div>`;

  let formBody = '';
  switch (form.type) {
    case 'Pressure Test':                  formBody = buildPressureTestBody(f); break;
    case 'Flushing Record':                formBody = buildFlushingBody(f); break;
    case 'Valve Checklist':                formBody = buildValveBody(f); break;
    case 'AHU Commissioning':              formBody = buildAHUBody(f); break;
    case 'Dead Testing':                   formBody = buildDeadTestBody(f); break;
    case 'Continuity Test':                formBody = buildContinuityBody(f); break;
    case 'Toolbox Talk':                   formBody = buildToolboxTalkBody(f); break;
    case 'Site Walk Audit':                formBody = buildSWABody(f); break;
    case 'Electrical Commissioning Report':formBody = buildECRBody(f); break;
    case 'Daily Site Report':              formBody = buildDSRBody(f); break;
    case 'Risk Assessment':                formBody = buildRAMSBody(f); break;
    case 'RFI': case 'Technical Query':    formBody = buildRFIBody(f); break;
    case 'H&S Inspection':                 formBody = buildHSBody(f); break;
    case 'Accident / Incident Report':     formBody = buildAIRBody(f); break;
    case 'Plantroom Commissioning Record': formBody = buildPCRBody(f); break;
    case 'HIU Commissioning Record':       formBody = buildHIUBody(f); break;
    case 'MVHR Commissioning Record':      formBody = buildMVHRBody(f); break;
    case 'Temperature Water Readings':     formBody = buildTWRBody(f); break;
    case 'Practical Completion Certificate': formBody = buildPCCBody(f); break;
    case 'QA Inspection':                  formBody = buildQABody(f); break;
    case 'Hold Up Notice': case 'Delay Notice':
    case 'Variation': case 'Early Warning Notice':
    case 'Site Instruction':               formBody = buildCommercialBody(f); break;
    case 'Site Hold Up':                   formBody = buildSiteHoldUpBody(f); break;
    case 'Site Change Request':            formBody = buildSiteChangeRequestBody(f); break;
    case 'Site Note':                      formBody = buildSiteNoteBody(f); break;
    default:                               formBody = buildGenericBody(f); break;
  }

  const attachments = f.attachments;
  const evidenceSection = attachments && Array.isArray(attachments) && attachments.length
    ? sectionHtml('Evidence & Attachments', evidenceHtml(attachments))
    : '';

  const docRef = safeStr(f.rfiRef) || safeStr(f.tqRef) || safeStr(f.ramsRef) || safeStr(f.noticeRef) || safeStr(f.shuRef) || safeStr(f.scrRef) || safeStr(f.snRef) || safeStr(f.id) || `VY-${Date.now()}`;
  const legalFooter = reportFooter({
    formType: form.type,
    docRef,
    status: statusStr || 'Draft',
    generatedDate: today,
    orgName,
    projectName,
  });

  return `<div class="page">${header}${metaBlock}${formBody}${evidenceSection}${legalFooter}</div>`;
}

export function renderFormPDF(form: ExtendedSiteForm, orgSettings?: OrgSettings | null): void {
  if (form.type === 'Practical Completion Certificate') {
    openPrintTab(buildPCCPageHTML(form, orgSettings));
    return;
  }
  const f = form as unknown as Record<string, unknown>;
  const orgName = orgSettings?.company_name || 'VYSITE';
  const typeLabel = (() => {
    const map: Record<string, string> = {
      'Daily Site Report': 'Daily Site Report', 'QA Inspection': 'QA Inspection',
      'RFI': 'Request for Information', 'Pressure Test': 'Pressure Test Record',
      'Risk Assessment': 'Risk Assessment / RAMS', 'Accident / Incident Report': 'Accident & Incident Report',
    };
    return map[form.type] ?? form.type;
  })();
  const formTitle = safeStr(f.title) || '(Untitled)';
  const fullBody = buildFormPageHTML(form, orgSettings);
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${esc(typeLabel)} - ${esc(formTitle)} - ${esc(orgName)}</title>
  <style>${CSS}</style>
</head>
<body>
${fullBody}
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
  openPrintTab(html);
}

// ─── Reusable HTML export for O&M assembler ───────────────────────────────────
// Returns a complete, self-contained HTML document (no print script, no tab).
// The O&M builder passes this to html2canvas to capture the form as PDF pages.

export const FORM_RENDERER_CSS: string = CSS;

export function buildStandaloneFormHtml(
  form: ExtendedSiteForm,
  orgSettings?: OrgSettings | null,
): string {
  if (form.type === 'Practical Completion Certificate') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${CSS}</style></head><body>${buildPCCPageHTML(form, orgSettings)}</body></html>`;
  }
  const body = buildFormPageHTML(form, orgSettings);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${CSS}</style></head><body>${body}</body></html>`;
}


