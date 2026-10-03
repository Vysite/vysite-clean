import { openPrintTab } from '../../lib/printTab';
import type { DBAsset, DBAssetSite, DBAssetBuilding, DBAssetLocation, DBAssetDocument, DBAssetActivity, DBAssetServiceRecord } from './types';

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

function todayStr(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sanitizeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function exportAssetFileName(asset: DBAsset): string {
  const tag = sanitizeFileName(asset.asset_tag);
  const name = sanitizeFileName(asset.name).slice(0, 40);
  return `VYSITE_Asset_${tag}_${name}.pdf`;
}

const ASSET_PDF_CSS = `
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
.doc-type { font-size: 8pt; font-weight: 700; color: #ea6c00; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
.doc-title { font-size: 14pt; font-weight: 700; color: #0f172a; margin-top: 2px; text-align: right; }
.doc-date { font-size: 8pt; color: #64748b; margin-top: 4px; text-align: right; }

/* Asset identity */
.asset-id-band { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; }
.asset-tag { font-size: 10pt; font-weight: 700; color: #ea6c00; font-family: 'Courier New', monospace; }
.asset-name { font-size: 16pt; font-weight: 700; color: #0f172a; margin-top: 2px; }
.asset-type-line { font-size: 9pt; color: #475569; margin-top: 4px; }

/* Status tag */
.tag { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 8pt; font-weight: 600; }
.tag-active { background: #dcfce7; color: #15803d; }
.tag-out { background: #fef3c7; color: #b45309; }
.tag-repair { background: #ffedd5; color: #c2410c; }
.tag-replaced { background: #dbeafe; color: #1d4ed8; }
.tag-decomm { background: #e2e8f0; color: #64748b; }

/* Two-column layout */
.two-col { display: flex; gap: 20px; margin-bottom: 16px; }
.col-left { flex: 0 0 200px; }
.col-right { flex: 1; }

/* Asset image */
.asset-image-box { width: 200px; height: 200px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center; }
.asset-image-box img { width: 100%; height: 100%; object-fit: cover; }
.asset-image-placeholder { color: #94a3b8; font-size: 8pt; text-align: center; }

/* Data table */
.data-table { width: 100%; border-collapse: collapse; }
.data-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 9pt; }
.data-table .label { color: #64748b; font-weight: 600; width: 140px; }
.data-table .value { color: #0f172a; }

/* Section label */
.section-label { font-size: 8pt; font-weight: 700; color: #ea6c00; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 8px; border-bottom: 1px solid #fed7aa; padding-bottom: 4px; }

/* Notes */
.notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; font-size: 9pt; color: #334155; white-space: pre-wrap; margin-bottom: 16px; }

/* List table */
.list-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.list-table th { text-align: left; padding: 6px 8px; background: #0f172a; color: white; font-weight: 600; font-size: 8pt; }
.list-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; }
.list-table tr:nth-child(even) td { background: #f8fafc; }

/* Activity table */
.act-type { font-weight: 600; }
.act-type-created { color: #15803d; }
.act-type-status_change { color: #b45309; }
.act-type-document_upload, .act-type-document_removed { color: #1d4ed8; }
.act-type-image_upload, .act-type-image_removed, .act-type-primary_changed { color: #c2410c; }
.act-type-service_created, .act-type-service_updated, .act-type-service_deleted, .act-type-service_doc_linked { color: #0284c7; }

/* Service table */
.svc-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
.svc-table th { text-align: left; padding: 6px 8px; background: #0f172a; color: white; font-weight: 600; font-size: 7.5pt; }
.svc-table td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; vertical-align: top; }
.svc-table tr:nth-child(even) td { background: #f8fafc; }
.svc-cond { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 7pt; font-weight: 600; }
.svc-cond-Good { background: #dcfce7; color: #15803d; }
.svc-cond-Satisfactory { background: #dbeafe; color: #1d4ed8; }
.svc-cond-Poor { background: #fef3c7; color: #b45309; }
.svc-cond-Critical { background: #fee2e2; color: #991b1b; }
.svc-cond-Not-Assessed { background: #e2e8f0; color: #64748b; }
.svc-status { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 7pt; font-weight: 600; }
.svc-status-Completed { background: #dcfce7; color: #15803d; }
.svc-status-Open { background: #dbeafe; color: #1d4ed8; }
.svc-status-Follow-Up-Required { background: #fef3c7; color: #b45309; }
.svc-status-Awaiting-Parts { background: #ffedd5; color: #c2410c; }

/* Footer */
.doc-footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8; }
.empty-notice { color: #94a3b8; font-style: italic; padding: 12px 0; font-size: 9pt; }
`;

function statusTagClass(status: string): string {
  if (status === 'Active') return 'tag-active';
  if (status === 'Out of Service') return 'tag-out';
  if (status === 'Under Repair') return 'tag-repair';
  if (status === 'Replaced') return 'tag-replaced';
  return 'tag-decomm';
}

interface AssetPDFData {
  asset: DBAsset;
  siteName: string;
  buildingName: string;
  locationName: string;
  documents: DBAssetDocument[];
  activity: DBAssetActivity[];
  serviceRecords: DBAssetServiceRecord[];
  primaryImageUrl: string | null;
  currentUserName: string;
}

export function exportAssetPDF(data: AssetPDFData): void {
  const { asset, siteName, buildingName, locationName, documents, activity, serviceRecords, primaryImageUrl, currentUserName } = data;
  const today = todayStr();

  const imageHtml = primaryImageUrl
    ? `<img src="${primaryImageUrl}" alt="${esc(asset.name)}" />`
    : `<div class="asset-image-placeholder">No asset image</div>`;

  // Page 1: Identity + image + core data
  const page1 = `
<div class="doc-head">
  <div>
    <div class="doc-brand">VYSITE</div>
    <div class="doc-brand-sub">Construction Operating System</div>
  </div>
  <div>
    <div class="doc-type">Internal Asset Record</div>
    <div class="doc-title">Asset Record</div>
    <div class="doc-date">${today} &middot; ${esc(currentUserName || 'VYSITE')}</div>
  </div>
</div>

<div class="asset-id-band no-break">
  <div class="asset-tag">${esc(asset.asset_tag)}</div>
  <div class="asset-name">${esc(asset.name)}</div>
  <div class="asset-type-line">${esc(asset.asset_type)} &middot; <span class="tag ${statusTagClass(asset.status)}">${esc(asset.status)}</span></div>
</div>

<div class="two-col no-break">
  <div class="col-left">
    <div class="asset-image-box">${imageHtml}</div>
  </div>
  <div class="col-right">
    <table class="data-table">
      <tr><td class="label">Manufacturer</td><td class="value">${esc(asset.manufacturer) || '\u2014'}</td></tr>
      <tr><td class="label">Model</td><td class="value">${esc(asset.model) || '\u2014'}</td></tr>
      <tr><td class="label">Serial Number</td><td class="value">${esc(asset.serial_number) || '\u2014'}</td></tr>
      <tr><td class="label">Site</td><td class="value">${esc(siteName)}</td></tr>
      <tr><td class="label">Building</td><td class="value">${esc(buildingName)}</td></tr>
      <tr><td class="label">Location</td><td class="value">${esc(locationName)}</td></tr>
    </table>
  </div>
</div>

<table class="data-table no-break">
  <tr><td class="label">Installation Date</td><td class="value">${fmtD(asset.installation_date)}</td>
      <td class="label">Commissioning Date</td><td class="value">${fmtD(asset.commissioning_date)}</td></tr>
  <tr><td class="label">Warranty Expiry</td><td class="value">${fmtD(asset.warranty_expiry)}</td>
      <td class="label">Project Reference</td><td class="value">${esc(asset.project_name) || '\u2014'}</td></tr>
  <tr><td class="label">Original Asset Cost</td><td class="value">${asset.original_asset_cost != null ? '\u00a3' + Number(asset.original_asset_cost).toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '\u2014'}</td>
      <td class="label">Current Replacement Cost</td><td class="value">${asset.current_replacement_cost != null ? '\u00a3' + Number(asset.current_replacement_cost).toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '\u2014'}</td></tr>
</table>

${asset.notes ? `<div class="section-label">Notes</div><div class="notes-box">${esc(asset.notes)}</div>` : ''}
`;

  // Page 2: Document summary + Activity
  const docRows = documents.length > 0
    ? documents.map(d => `<tr>
        <td>${esc(d.name)}</td>
        <td>${esc(d.category)}</td>
        <td>${fmtD(d.created_at)}</td>
        <td>${esc(d.uploaded_by) || '\u2014'}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="empty-notice">No documents uploaded.</td></tr>`;

  const actRows = activity.length > 0
    ? activity.map(a => `<tr>
        <td>${fmtD(a.created_at)}</td>
        <td>${esc(a.user_name) || '\u2014'}</td>
        <td><span class="act-type act-type-${esc(a.type)}">${esc(a.type.replace(/_/g, ' '))}</span></td>
        <td>${esc(a.text)}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="empty-notice">No activity recorded.</td></tr>`;

  const page2 = `
<div class="page-break"></div>
<div class="doc-head">
  <div>
    <div class="doc-brand">VYSITE</div>
    <div class="doc-brand-sub">Construction Operating System</div>
  </div>
  <div>
    <div class="doc-type">Internal Asset Record</div>
    <div class="doc-title">${esc(asset.asset_tag)} &mdash; Continued</div>
  </div>
</div>

<div class="section-label">Document Schedule</div>
<table class="list-table no-break">
  <thead><tr><th>Document</th><th>Category</th><th>Upload Date</th><th>Uploaded By</th></tr></thead>
  <tbody>${docRows}</tbody>
</table>

<div class="section-label">Service &amp; Maintenance History</div>
${serviceRecords.length > 0 ? `
<table class="svc-table">
  <thead><tr><th>Date</th><th>Type</th><th>Engineer / Company</th><th>Condition</th><th>Status</th><th>Next Due</th><th>Cost</th><th>Work Summary</th></tr></thead>
  <tbody>${serviceRecords.map(s => {
    const condCls = 'svc-cond-' + (s.condition || 'Not-Assessed').replace(/\s+/g, '-');
    const statusCls = 'svc-status-' + (s.status || 'Completed').replace(/\s+/g, '-');
    const workSummary = (s.work_carried_out || '').length > 100 ? (s.work_carried_out || '').substring(0, 100) + '\u2026' : (s.work_carried_out || '');
    const engCo = [s.engineer_name, s.company].filter(Boolean).join(' / ') || '\u2014';
    return `<tr>
      <td>${fmtD(s.service_date)}</td>
      <td>${esc(s.service_type)}</td>
      <td>${esc(engCo)}</td>
      <td>${s.condition ? `<span class="svc-cond ${condCls}">${esc(s.condition)}</span>` : '\u2014'}</td>
      <td><span class="svc-status ${statusCls}">${esc(s.status)}</span></td>
      <td>${fmtD(s.next_service_due)}</td>
      <td>${s.cost != null ? '\u00a3' + s.cost.toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '\u2014'}</td>
      <td>${esc(workSummary)}</td>
    </tr>`;
  }).join('')}</tbody>
</table>` : '<div class="empty-notice">No service records.</div>'}

<div class="section-label">Activity / History</div>
<table class="list-table">
  <thead><tr><th>Date / Time</th><th>User</th><th>Activity</th><th>Details</th></tr></thead>
  <tbody>${actRows}</tbody>
</table>

<div class="doc-footer">
  <div>Confidential &mdash; VYSITE Internal Asset Record</div>
  <div>${esc(currentUserName || 'VYSITE')} &bull; ${today}</div>
</div>
`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Asset Record - ${esc(asset.asset_tag)}</title><style>${ASSET_PDF_CSS}</style><script>window.onload=function(){window.print();};<\/script></head><body><div class="page">${page1}${page2}</div></body></html>`;
  openPrintTab(html);
}
