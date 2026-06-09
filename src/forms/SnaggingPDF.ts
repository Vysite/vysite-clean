/**
 * SnaggingPDF — builds a professional, print-ready snagging report PDF.
 * Renders the report header + every snag item including photos.
 * Uses the same CSS/layout conventions as PDFRenderer.ts.
 */

import { openPrintTab } from '../lib/printTab';
import type { DBSnaggingReport } from '../lib/store';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SnagItemForPDF {
  id: string;
  snagNumber?: string;
  title: string;
  location?: string;
  trade?: string;
  priority?: string;
  status?: string;
  description?: string;
  rectification?: string;
  responsibleParty?: string;
  assignedTo?: string;
  raisedBy?: string;
  raisedDate?: string;
  targetCompletionDate?: string;
  dueDate?: string;
  comments?: string[];
  closedBy?: string;
  closedDate?: string;
  closureComments?: string;
  photos?: AttachmentForPDF[];
  closurePhotos?: AttachmentForPDF[];
}

export interface AttachmentForPDF {
  id: string;
  name: string;
  type: string;
  data_url?: string;
  category?: string;
}

export interface OrgSettings {
  company_name?: string;
  logo_data_url?: string;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
}

function safe(v: unknown): string { return v ? String(v) : ''; }

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    color: #1e293b; background: white; font-size: 11px; line-height: 1.5;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { max-width: 880px; margin: 0 auto; padding: 36px 40px; }

  /* ── Document header ── */
  .doc-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid #f97316; margin-bottom: 20px; }
  .doc-logo-text { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: 0.05em; }
  .doc-logo-img { height: 38px; max-width: 160px; display: block; margin-bottom: 4px; }
  .doc-type-label { font-size: 10px; color: #64748b; margin-top: 4px; }
  .doc-header-right { text-align: right; }
  .doc-title { font-size: 18px; font-weight: 900; color: #111; margin-bottom: 4px; line-height: 1.25; max-width: 420px; }
  .doc-dateline { font-size: 11px; color: #64748b; }

  /* ── Summary KPI bar ── */
  .kpi-bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 18px 0; }
  .kpi-cell { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; text-align: center; }
  .kpi-value { font-size: 22px; font-weight: 900; color: #0f172a; line-height: 1; }
  .kpi-label { font-size: 8.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 4px; }
  .kpi-open    { color: #dc2626; }
  .kpi-prog    { color: #2563eb; }
  .kpi-review  { color: #d97706; }
  .kpi-closed  { color: #059669; }
  .kpi-overdue { color: #7c3aed; }

  /* ── Report meta block ── */
  .meta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }
  .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; }
  .meta-item {}
  .meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .meta-value { font-size: 11px; font-weight: 600; color: #0f172a; }

  /* ── Progress bar ── */
  .progress-wrap { margin-bottom: 20px; }
  .progress-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; display: flex; justify-content: space-between; }
  .progress-track { height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; }
  .progress-fill { height: 100%; background: #22c55e; border-radius: 20px; }

  /* ── Section heading ── */
  .section-heading { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 12px; margin-top: 24px; }

  /* ── Snag card ── */
  .snag-card { border: 1.5px solid #e2e8f0; border-radius: 10px; margin-bottom: 18px; overflow: hidden; page-break-inside: avoid; }
  .snag-card-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
  .snag-card-header-left { display: flex; align-items: center; gap: 10px; }
  .snag-number { font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 3px 8px; border-radius: 5px; }
  .snag-title { font-size: 12px; font-weight: 800; color: #0f172a; }
  .snag-badges { display: flex; gap: 6px; align-items: center; }
  .snag-card-body { padding: 12px 14px; }

  /* ── Data grid inside snag ── */
  .data-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 10px; }
  .data-cell { background: white; padding: 8px 10px; }
  .data-cell-label { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 2px; }
  .data-cell-value { font-size: 10.5px; font-weight: 600; color: #0f172a; }
  .data-grid-2 { grid-template-columns: repeat(2, 1fr); }

  /* ── Text fields ── */
  .text-field { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 12px; margin-bottom: 8px; }
  .text-field-label { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
  .text-field-value { font-size: 10.5px; color: #334155; line-height: 1.6; white-space: pre-wrap; }

  /* ── Comments ── */
  .comment { background: #f8fafc; border-left: 3px solid #e2e8f0; border-radius: 0 5px 5px 0; padding: 7px 10px; margin-bottom: 5px; font-size: 10px; color: #475569; }

  /* ── Priority badges ── */
  .badge { display: inline-block; font-size: 8.5px; font-weight: 700; padding: 2px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
  .badge-critical { background: #fee2e2; color: #991b1b; }
  .badge-high     { background: #ffedd5; color: #9a3412; }
  .badge-medium   { background: #fef9c3; color: #854d0e; }
  .badge-low      { background: #f1f5f9; color: #475569; }
  .badge-open     { background: #fee2e2; color: #991b1b; }
  .badge-inprog   { background: #dbeafe; color: #1d4ed8; }
  .badge-review   { background: #fef3c7; color: #92400e; }
  .badge-closed   { background: #d1fae5; color: #065f46; }

  /* ── Closure block ── */
  .closure-block { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 12px 14px; margin-top: 10px; }
  .closure-header { font-size: 8.5px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }

  /* ── Photos ── */
  .photo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 8px; }
  .photo-item { border: 1px solid #e2e8f0; border-radius: 7px; overflow: hidden; page-break-inside: avoid; }
  .photo-img { width: 100%; max-height: 260px; object-fit: contain; background: #f8fafc; display: block; }
  .photo-caption { padding: 5px 9px; font-size: 9px; color: #64748b; background: #f8fafc; border-top: 1px solid #e2e8f0; }

  /* ── Legal footer ── */
  .legal-footer { margin-top: 28px; border-top: 2px solid #e2e8f0; page-break-inside: avoid; }
  .legal-footer-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 0 8px; }
  .legal-footer-title { font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
  .legal-footer-ref { font-size: 8px; color: #94a3b8; }
  .legal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .legal-cell { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 8px 12px; }
  .legal-cell-label { font-size: 7.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .legal-cell-text { font-size: 8.5px; color: #475569; line-height: 1.6; }
  .legal-branding { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid #e2e8f0; }
  .legal-branding-left { font-size: 8px; color: #94a3b8; }
  .legal-branding-right { font-size: 8px; color: #94a3b8; text-align: right; }

  @media print {
    .page { padding: 20px 24px; }
    .snag-card { page-break-inside: avoid; }
    .photo-item { page-break-inside: avoid; }
  }
`;

// ─── Badge helpers ────────────────────────────────────────────────────────────

function priorityBadge(p?: string): string {
  if (!p) return '';
  const cls = p === 'Critical' ? 'badge-critical' : p === 'High' ? 'badge-high' : p === 'Medium' ? 'badge-medium' : 'badge-low';
  return `<span class="badge ${cls}">${esc(p)}</span>`;
}

function statusBadge(s?: string): string {
  if (!s) return '';
  const cls = s === 'Closed' ? 'badge-closed' : s === 'In Progress' ? 'badge-inprog' : s === 'Awaiting Review' ? 'badge-review' : 'badge-open';
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}

// ─── Photo grid ───────────────────────────────────────────────────────────────

function photoGrid(photos: AttachmentForPDF[]): string {
  const images = photos.filter(p => p.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(p.name ?? ''));
  if (!images.length) return '';
  return `<div class="photo-grid">
    ${images.map(img => `
      <div class="photo-item">
        ${img.data_url
          ? `<img class="photo-img" src="${img.data_url}" alt="${esc(img.name)}" />`
          : `<div class="photo-img" style="min-height:120px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px">Photo unavailable</div>`
        }
        <div class="photo-caption">${esc(img.name)} ${img.category ? '· ' + esc(img.category) : ''}</div>
      </div>
    `).join('')}
  </div>`;
}

// ─── Data grid helper ─────────────────────────────────────────────────────────

function dataGrid(pairs: [string, string | undefined][], cols: 2 | 3 = 3): string {
  const visible = pairs.filter(([, v]) => v && v !== '—');
  if (!visible.length) return '';
  const cls = cols === 2 ? 'data-grid data-grid-2' : 'data-grid';
  return `<div class="${cls}">
    ${visible.map(([l, v]) => `<div class="data-cell">
      <div class="data-cell-label">${esc(l)}</div>
      <div class="data-cell-value">${esc(v ?? '')}</div>
    </div>`).join('')}
  </div>`;
}

function textField(label: string, value: string | undefined | null): string {
  if (!value) return '';
  return `<div class="text-field">
    <div class="text-field-label">${esc(label)}</div>
    <div class="text-field-value">${esc(value)}</div>
  </div>`;
}

// ─── Single snag card ─────────────────────────────────────────────────────────

function snagCard(snag: SnagItemForPDF, index: number): string {
  const num = snag.snagNumber ?? `SN-${String(index + 1).padStart(3, '0')}`;
  const isClosed = snag.status === 'Closed';

  const comments = (snag.comments ?? []).filter(Boolean);
  const commentsHtml = comments.length
    ? `<div style="margin-top:8px">
        <div class="text-field-label" style="margin-bottom:4px">Audit Comments (${comments.length})</div>
        ${comments.map(c => `<div class="comment">${esc(c)}</div>`).join('')}
      </div>`
    : '';

  const photosHtml = snag.photos?.length
    ? `<div style="margin-top:10px">
        <div class="text-field-label" style="margin-bottom:5px">Evidence Photos (${snag.photos.length})</div>
        ${photoGrid(snag.photos)}
      </div>`
    : '';

  const closureHtml = isClosed
    ? `<div class="closure-block">
        <div class="closure-header">Closure Record</div>
        ${dataGrid([
          ['Closed By', snag.closedBy],
          ['Closed Date', fmtDate(snag.closedDate)],
        ], 2)}
        ${textField('Closure Comments', snag.closureComments)}
        ${snag.closurePhotos?.length
          ? `<div style="margin-top:8px">
              <div class="text-field-label" style="margin-bottom:5px">Closure Photos (${snag.closurePhotos.length})</div>
              ${photoGrid(snag.closurePhotos)}
            </div>`
          : ''}
      </div>`
    : '';

  return `
  <div class="snag-card">
    <div class="snag-card-header">
      <div class="snag-card-header-left">
        <span class="snag-number">${esc(num)}</span>
        <span class="snag-title">${esc(snag.title)}</span>
      </div>
      <div class="snag-badges">
        ${priorityBadge(snag.priority)}
        ${statusBadge(snag.status)}
      </div>
    </div>
    <div class="snag-card-body">
      ${dataGrid([
        ['Location', snag.location],
        ['Trade', snag.trade],
        ['Responsible Party', snag.responsibleParty],
        ['Assigned To', snag.assignedTo],
        ['Raised By', snag.raisedBy],
        ['Raised Date', fmtDate(snag.raisedDate)],
        ['Target Completion', fmtDate(snag.targetCompletionDate || snag.dueDate)],
        ['Due Date', fmtDate(snag.dueDate)],
      ])}
      ${textField('Issue Description', snag.description)}
      ${textField('Required Rectification', snag.rectification)}
      ${commentsHtml}
      ${photosHtml}
      ${closureHtml}
    </div>
  </div>`;
}

// ─── Legal footer ─────────────────────────────────────────────────────────────

function legalFooter(docRef: string, today: string, orgName: string, projectName: string): string {
  return `
  <div class="legal-footer">
    <div class="legal-footer-header">
      <div class="legal-footer-title">Document Legal &amp; Compliance Statement</div>
      <div class="legal-footer-ref">Ref: ${esc(docRef)}</div>
    </div>
    <div style="background:#fffbf5;border:1px solid #fed7aa;border-left:3px solid #f97316;border-radius:6px;padding:10px 14px;margin-bottom:8px">
      <div style="font-size:7.5px;font-weight:800;color:#c2410c;text-transform:uppercase;letter-spacing:.09em;margin-bottom:3px">Contractual Notice</div>
      <div style="font-size:8.5px;color:#92400e;line-height:1.65">
        This snagging report constitutes a formal project defect record issued in accordance with the applicable building contract and project quality management plan.
        All identified defects must be rectified by the responsible party within the specified timescales. Failure to close out items may result in formal withholding notices,
        retention deductions, or enforcement under the applicable contract. The issuing party expressly reserves all rights to recover costs associated with outstanding defects.
      </div>
    </div>
    <div class="legal-grid">
      <div class="legal-cell">
        <div class="legal-cell-label">Evidence Statement</div>
        <div class="legal-cell-text">This document constitutes a contemporaneous site record. It may be used as primary evidence in any dispute resolution, adjudication, arbitration, or legal proceedings arising from the project.</div>
      </div>
      <div class="legal-cell">
        <div class="legal-cell-label">Liability &amp; Record Statement</div>
        <div class="legal-cell-text">The accuracy of this document is the responsibility of the named inspector or completing party. This record must be retained as part of the project health and safety file and O&amp;M documentation.</div>
      </div>
      <div class="legal-cell">
        <div class="legal-cell-label">Confidentiality</div>
        <div class="legal-cell-text">This document is issued in confidence for project purposes only. Unauthorised disclosure to third parties is not permitted without express written consent of the issuing organisation.</div>
      </div>
      <div class="legal-cell">
        <div class="legal-cell-label">Photo Evidence</div>
        <div class="legal-cell-text">All photographs included in this report were captured contemporaneously and are attached as primary evidence of the defects recorded. Photos are timestamped where available and form part of the formal defect record.</div>
      </div>
    </div>
    <div class="legal-branding">
      <div class="legal-branding-left">
        Generated by <strong>${esc(orgName)}</strong> &mdash; powered by <strong>VYSITE</strong> | NEXA Solutions Ltd
        &nbsp;&middot;&nbsp; ${esc(projectName || 'Project Record')}
        &nbsp;&middot;&nbsp; ${esc(today)}
      </div>
      <div class="legal-branding-right">
        &copy; NEXA Solutions Ltd. All rights reserved.<br/>
        Document Ref: ${esc(docRef)}
      </div>
    </div>
  </div>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export { CSS as SNAGGING_PDF_CSS };

export function buildSnaggingReportPageHTML(
  report: DBSnaggingReport,
  snags: SnagItemForPDF[],
  orgSettings?: OrgSettings | null,
): string {
  const orgName  = orgSettings?.company_name || 'VYSITE';
  const orgLogo  = orgSettings?.logo_data_url;
  const today    = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const docRef   = `SNR-${report.id.toUpperCase()}`;

  const total    = snags.length;
  const open     = snags.filter(s => s.status === 'Open').length;
  const inProg   = snags.filter(s => s.status === 'In Progress').length;
  const closed   = snags.filter(s => s.status === 'Closed').length;
  const now      = new Date();
  const overdue  = snags.filter(s => s.status !== 'Closed' && s.dueDate && new Date(s.dueDate) < now).length;
  const pct      = report.overall_completion_pct ?? (total > 0 ? Math.round((closed / total) * 100) : 0);

  const logoHtml = orgLogo
    ? `<img class="doc-logo-img" src="${orgLogo}" alt="${esc(orgName)}" />`
    : `<div class="doc-logo-text">${esc(orgName)}</div>`;

  const header = `
    <div class="doc-header">
      <div>
        ${logoHtml}
        <div class="doc-type-label">Snagging Report &mdash; ${esc(report.project_name || 'Project')}</div>
      </div>
      <div class="doc-header-right">
        <div class="doc-title">${esc(report.title || 'Snagging Report')}</div>
        <div class="doc-dateline">${today}${report.project_name ? ' &nbsp;&middot;&nbsp; ' + esc(report.project_name) : ''}</div>
      </div>
    </div>`;

  const kpiBar = `
    <div class="kpi-bar">
      <div class="kpi-cell"><div class="kpi-value">${total}</div><div class="kpi-label">Total Snags</div></div>
      <div class="kpi-cell"><div class="kpi-value kpi-open">${open}</div><div class="kpi-label">Open</div></div>
      <div class="kpi-cell"><div class="kpi-value kpi-prog">${inProg}</div><div class="kpi-label">In Progress</div></div>
      <div class="kpi-cell"><div class="kpi-value kpi-closed">${closed}</div><div class="kpi-label">Closed</div></div>
      <div class="kpi-cell"><div class="kpi-value kpi-overdue">${overdue}</div><div class="kpi-label">Overdue</div></div>
    </div>`;

  const progressBar = `
    <div class="progress-wrap">
      <div class="progress-label"><span>Overall Completion</span><span>${pct}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;

  const metaItems: [string, string][] = [
    ['Project',          safe(report.project_name)],
    ['Area / Block',     safe(report.area_block)],
    ['Floor / Location', safe(report.floor_location)],
    ['Inspection Date',  fmtDate(safe(report.inspection_date))],
    ['Inspector',        safe(report.inspector)],
    ['Contractor',       safe(report.contractor)],
    ['Client',           safe(report.client)],
    ['Status',           safe(report.status)],
    ['Report Ref',       docRef],
  ].filter(([, v]) => v && v !== '—') as [string, string][];

  const metaBlock = `
    <div class="meta-block">
      <div class="meta-grid">
        ${metaItems.map(([l, v]) => `<div class="meta-item">
          <div class="meta-label">${esc(l)}</div>
          <div class="meta-value">${esc(v)}</div>
        </div>`).join('')}
      </div>
    </div>`;

  const notesHtml = report.notes
    ? `<div class="text-field" style="margin-bottom:18px">
        <div class="text-field-label">Report Notes</div>
        <div class="text-field-value">${esc(report.notes)}</div>
       </div>`
    : '';

  const snagItemsHtml = snags.length
    ? `<div class="section-heading">Snag Items (${snags.length})</div>
       ${snags.map((s, i) => snagCard(s, i)).join('')}`
    : `<div style="text-align:center;padding:32px;color:#94a3b8;font-size:12px;">No snag items in this report.</div>`;

  const summaryTable = snags.length
    ? `<div class="section-heading">Snag Summary</div>
       <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:20px">
         <thead>
           <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0">
             <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.05em">Ref</th>
             <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.05em">Title</th>
             <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.05em">Location</th>
             <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.05em">Trade</th>
             <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.05em">Priority</th>
             <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.05em">Status</th>
             <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.05em">Responsible</th>
             <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.05em">Due Date</th>
           </tr>
         </thead>
         <tbody>
           ${snags.map((s, i) => {
             const num = s.snagNumber ?? `SN-${String(i + 1).padStart(3, '0')}`;
             const isDue = s.status !== 'Closed' && s.dueDate && new Date(s.dueDate) < new Date();
             return `<tr style="${i % 2 === 1 ? 'background:#f8fafc' : ''}">
               <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:9.5px;color:#64748b">${esc(num)}</td>
               <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-weight:600;max-width:180px">${esc(s.title)}</td>
               <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#475569">${esc(s.location ?? '—')}</td>
               <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#475569">${esc(s.trade ?? '—')}</td>
               <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9">${priorityBadge(s.priority)}</td>
               <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9">${statusBadge(s.status)}</td>
               <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#475569">${esc(s.responsibleParty ?? '—')}</td>
               <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:${isDue ? '#dc2626' : '#475569'};font-weight:${isDue ? '700' : '400'}">${fmtDate(s.dueDate)}</td>
             </tr>`;
           }).join('')}
         </tbody>
       </table>`
    : '';

  return `<div class="page">
    ${header}
    ${kpiBar}
    ${progressBar}
    ${metaBlock}
    ${notesHtml}
    ${summaryTable}
    ${snagItemsHtml}
    ${legalFooter(docRef, today, orgName, safe(report.project_name))}
  </div>`;
}

export function renderSnaggingReportPDF(
  report: DBSnaggingReport,
  snags: SnagItemForPDF[],
  orgSettings?: OrgSettings | null,
): void {
  const orgName  = orgSettings?.company_name || 'VYSITE';
  const fullBody = buildSnaggingReportPageHTML(report, snags, orgSettings);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Snagging Report - ${esc(report.title || report.project_name)} - ${esc(orgName)}</title>
  <style>${CSS}</style>
</head>
<body>
${fullBody}
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

  openPrintTab(html);
}
