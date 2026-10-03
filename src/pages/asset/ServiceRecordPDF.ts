import { openPrintTab, vysiteLogoUrl } from '../../lib/printTab';
import type { DBAsset, DBAssetServiceRecord, DBAssetDocument } from './types';

function esc(v: unknown): string {
  const s = v == null ? '' : String(v);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtD(d: string | null | undefined): string {
  if (!d) return '\u2014';
  const date = new Date(d);
  if (isNaN(date.getTime())) return esc(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDT(d: string | null | undefined): string {
  if (!d) return '\u2014';
  const date = new Date(d);
  if (isNaN(date.getTime())) return esc(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sanitizeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function serviceRef(record: DBAssetServiceRecord, asset: DBAsset): string {
  const datePart = (record.service_date || '').replace(/[^0-9]/g, '');
  return `${asset.asset_tag}-SVC-${datePart || 'NODATE'}`;
}

export function exportServiceRecordFileName(asset: DBAsset, record: DBAssetServiceRecord, internal: boolean): string {
  const tag = sanitizeFileName(asset.asset_tag);
  const datePart = sanitizeFileName(record.service_date || 'nodate');
  const prefix = internal ? 'VYSITE_Internal_Service_Record' : 'VYSITE_Service_Record';
  return `${prefix}_${tag}_${datePart}.pdf`;
}

const SVC_PDF_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { margin: 0; size: A4; }
body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9pt; color: #0f172a; background: white;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.page { padding: 40px 52px 36px; min-height: 297mm; }
.page-break { page-break-before: always; }
.no-break { page-break-inside: avoid; }

/* Header */
.doc-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
.doc-brand { font-size: 18pt; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
.doc-brand-sub { font-size: 8pt; color: #64748b; margin-top: 2px; }
.doc-logo { height: 28px; width: auto; object-fit: contain; display: block; }
.doc-type { font-size: 8pt; font-weight: 700; color: #ea6c00; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
.doc-title { font-size: 14pt; font-weight: 700; color: #0f172a; margin-top: 2px; text-align: right; }
.doc-date { font-size: 8pt; color: #64748b; margin-top: 4px; text-align: right; }

/* Asset identity band */
.asset-id-band { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 20px; margin-bottom: 16px; }
.asset-tag { font-size: 9pt; font-weight: 700; color: #ea6c00; font-family: 'Courier New', monospace; }
.asset-name { font-size: 15pt; font-weight: 700; color: #0f172a; margin-top: 2px; }
.asset-type-line { font-size: 9pt; color: #475569; margin-top: 3px; }

/* Two-column */
.two-col { display: flex; gap: 20px; margin-bottom: 16px; }
.col-left { flex: 0 0 200px; }
.col-right { flex: 1; }

/* Asset image */
.asset-image-box { width: 200px; height: 150px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center; }
.asset-image-box img { width: 100%; height: 100%; object-fit: cover; }

/* Data table */
.data-table { width: 100%; border-collapse: collapse; }
.data-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 9pt; }
.data-table .label { color: #64748b; font-weight: 600; width: 140px; }
.data-table .value { color: #0f172a; }

/* Section label */
.section-label { font-size: 8pt; font-weight: 700; color: #ea6c00; text-transform: uppercase; letter-spacing: 1px; margin: 18px 0 8px; border-bottom: 1px solid #fed7aa; padding-bottom: 4px; }

/* Text block */
.text-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; font-size: 9pt; color: #334155; white-space: pre-wrap; margin-bottom: 14px; line-height: 1.5; }

/* Tag */
.tag { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 8pt; font-weight: 600; }
.tag-Completed { background: #dcfce7; color: #15803d; }
.tag-Open { background: #dbeafe; color: #1d4ed8; }
.tag-Follow-Up-Required { background: #fef3c7; color: #b45309; }
.tag-Awaiting-Parts { background: #ffedd5; color: #c2410c; }
.cond-tag { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 7.5pt; font-weight: 600; }
.cond-Good { background: #dcfce7; color: #15803d; }
.cond-Satisfactory { background: #dbeafe; color: #1d4ed8; }
.cond-Poor { background: #fef3c7; color: #b45309; }
.cond-Critical { background: #fee2e2; color: #991b1b; }
.cond-Not-Assessed { background: #e2e8f0; color: #64748b; }

/* List table */
.list-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.list-table th { text-align: left; padding: 6px 8px; background: #0f172a; color: white; font-weight: 600; font-size: 8pt; }
.list-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; }
.list-table tr:nth-child(even) td { background: #f8fafc; }

/* Footer */
.doc-footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8; }
.empty-notice { color: #94a3b8; font-style: italic; padding: 12px 0; font-size: 9pt; }
`;

interface ServiceRecordPDFData {
  asset: DBAsset;
  record: DBAssetServiceRecord;
  siteName: string;
  buildingName: string;
  locationName: string;
  linkedDocuments: DBAssetDocument[];
  primaryImageUrl: string | null;
  internal: boolean;
  currentUserName: string;
}

export function exportServiceRecordPDF(data: ServiceRecordPDFData): void {
  const { asset, record, siteName, buildingName, locationName, linkedDocuments, primaryImageUrl, internal, currentUserName } = data;
  const today = todayStr();
  const ref = serviceRef(record, asset);
  const docTypeLabel = internal ? 'Internal Service Record' : 'Service & Maintenance Record';
  const footerLabel = internal ? 'Confidential \u2014 VYSITE Internal Service Record' : 'Powered by VYSITE';

  const condTag = record.condition
    ? `<span class="cond-tag cond-${record.condition.replace(/\\s+/g, '-')}">${esc(record.condition)}</span>`
    : '\u2014';
  const statusTag = record.status
    ? `<span class="tag tag-${record.status.replace(/\\s+/g, '-')}">${esc(record.status)}</span>`
    : '\u2014';

  const imageHtml = primaryImageUrl
    ? `<img src="${primaryImageUrl}" alt="${esc(asset.name)}" />`
    : '';

  const imageCol = imageHtml
    ? `<div class="col-left"><div class="asset-image-box">${imageHtml}</div></div>`
    : '';
  const detailsColFlex = imageHtml ? '' : 'flex: 1;';

  // Internal-only rows
  const internalCostRow = internal
    ? `<tr><td class="label">Cost</td><td class="value">${record.cost != null ? '\u00a3' + Number(record.cost).toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '\u2014'}</td></tr>`
    : '';

  const internalMetaSection = internal
    ? `
<div class="section-label">Internal Metadata</div>
<table class="data-table no-break">
  <tr><td class="label">Created By</td><td class="value">${esc(record.created_by) || '\u2014'}</td>
      <td class="label">Created At</td><td class="value">${fmtDT(record.created_at)}</td></tr>
  <tr><td class="label">Updated At</td><td class="value">${fmtDT(record.updated_at)}</td>
      <td class="label">Record Ref</td><td class="value">${esc(ref)}</td></tr>
</table>`
    : '';

  // Notes: client mode shows notes only if present (treated as client-safe per spec)
  // Internal mode shows all notes
  const notesSection = record.notes
    ? `<div class="section-label">${internal ? 'Internal Notes' : 'Notes'}</div><div class="text-block">${esc(record.notes)}</div>`
    : '';

  // Linked documents
  const docRows = linkedDocuments.length > 0
    ? linkedDocuments.map(d => `<tr>
        <td>${esc(d.name)}</td>
        <td>${esc(d.category)}</td>
      </tr>`).join('')
    : `<tr><td colspan="2" class="empty-notice">No documents linked.</td></tr>`;

  const page1 = `
<div class="doc-head">
  <div>
    <img class="doc-logo" src="${vysiteLogoUrl()}" alt="VYSITE" />
    <div class="doc-brand-sub">Construction Operating System</div>
  </div>
  <div>
    <div class="doc-type">${esc(docTypeLabel)}</div>
    <div class="doc-title">Service &amp; Maintenance Record</div>
    <div class="doc-date">${today} &middot; Ref: ${esc(ref)}</div>
  </div>
</div>

<div class="asset-id-band no-break">
  <div class="asset-tag">${esc(asset.asset_tag)}</div>
  <div class="asset-name">${esc(asset.name)}</div>
  <div class="asset-type-line">${esc(asset.asset_type)}</div>
</div>

<div class="two-col no-break" ${imageHtml ? '' : `style="${detailsColFlex}"`}>
  ${imageCol}
  <div class="col-right" style="${detailsColFlex}">
    <div class="section-label" style="margin-top:0">Asset Details</div>
    <table class="data-table">
      <tr><td class="label">Asset Tag</td><td class="value">${esc(asset.asset_tag)}</td></tr>
      <tr><td class="label">Asset Name</td><td class="value">${esc(asset.name)}</td></tr>
      <tr><td class="label">Asset Type</td><td class="value">${esc(asset.asset_type)}</td></tr>
      <tr><td class="label">Manufacturer</td><td class="value">${esc(asset.manufacturer) || '\u2014'}</td></tr>
      <tr><td class="label">Model</td><td class="value">${esc(asset.model) || '\u2014'}</td></tr>
      <tr><td class="label">Serial Number</td><td class="value">${esc(asset.serial_number) || '\u2014'}</td></tr>
    </table>
  </div>
</div>

<div class="section-label">Location</div>
<table class="data-table no-break">
  <tr><td class="label">Site</td><td class="value">${esc(siteName)}</td>
      <td class="label">Building</td><td class="value">${esc(buildingName)}</td></tr>
  <tr><td class="label">Location</td><td class="value">${esc(locationName)}</td><td></td><td></td></tr>
</table>

<div class="section-label">Service / Maintenance Details</div>
<table class="data-table no-break">
  <tr><td class="label">Service Date</td><td class="value">${fmtD(record.service_date)}</td>
      <td class="label">Service Type</td><td class="value">${esc(record.service_type)}</td></tr>
  <tr><td class="label">Engineer Name</td><td class="value">${esc(record.engineer_name) || '\u2014'}</td>
      <td class="label">Company</td><td class="value">${esc(record.company) || '\u2014'}</td></tr>
  <tr><td class="label">Condition</td><td class="value">${condTag}</td>
      <td class="label">Status</td><td class="value">${statusTag}</td></tr>
  <tr><td class="label">Next Service Due</td><td class="value">${fmtD(record.next_service_due)}</td><td></td><td></td></tr>
  ${internalCostRow}
</table>

<div class="section-label">Work Carried Out</div>
<div class="text-block">${esc(record.work_carried_out) || '\u2014'}</div>

${record.parts_replaced ? `<div class="section-label">Parts Replaced</div><div class="text-block">${esc(record.parts_replaced)}</div>` : ''}

${record.recommendations ? `<div class="section-label">Recommendations</div><div class="text-block">${esc(record.recommendations)}</div>` : ''}

${notesSection}
`;

  const page2 = `
<div class="page-break"></div>
<div class="doc-head">
  <div>
    <img class="doc-logo" src="${vysiteLogoUrl()}" alt="VYSITE" />
    <div class="doc-brand-sub">Construction Operating System</div>
  </div>
  <div>
    <div class="doc-type">${esc(docTypeLabel)}</div>
    <div class="doc-title">${esc(ref)} &mdash; Continued</div>
  </div>
</div>

<div class="section-label">Linked Documents</div>
<table class="list-table no-break">
  <thead><tr><th>Document Name</th><th>Category</th></tr></thead>
  <tbody>${docRows}</tbody>
</table>

${internalMetaSection}

<div class="doc-footer">
  <div>${esc(footerLabel)}</div>
  <div>${esc(asset.asset_tag)} &bull; ${today}</div>
</div>
`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Service Record - ${esc(ref)}</title><style>${SVC_PDF_CSS}</style><script>window.onload=function(){window.print();};<\/script></head><body><div class="page">${page1}${page2}</div></body></html>`;
  openPrintTab(html);
}
