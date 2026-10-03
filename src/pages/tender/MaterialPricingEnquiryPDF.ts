import { openPrintTab, buildPrintDocument } from '../../lib/printTab';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { DBTenderDrawing } from './drawingTypes';
import { finalQuantity } from './takeoffCalculations';

export interface MaterialEnquiryData {
  tenderName: string;
  tenderRef: string;
  client: string;
  location: string;
  exportDate: string;
  logoDataUrl: string | null | undefined;
  items: DBTenderTakeoffItem[];
  drawings: DBTenderDrawing[];
  disciplineLabel: string;
  includeOmissions: boolean;
  showScope: boolean;
}

function drawingName(drawings: DBTenderDrawing[], id: string | null): string {
  if (!id) return 'Manual';
  const d = drawings.find(dr => dr.id === id);
  return d ? `${d.drawing_number || d.title}` : 'Unknown';
}

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const SCOPE_LABELS: Record<string, string> = { standard: 'STD', addition: '+ ADD', omission: 'OMIT' };

const STYLES = `
  .ep-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:20px;margin-bottom:24px}
  .ep-logo{font-size:26px;font-weight:900;color:#f97316;letter-spacing:2px}
  .ep-logo-sub{font-size:10px;color:#94a3b8;margin-top:4px;letter-spacing:1px;text-transform:uppercase}
  .ep-doc-title{font-size:20px;font-weight:800;color:#1e293b;margin-bottom:3px;text-align:right}
  .ep-doc-sub{font-size:11px;color:#64748b;text-align:right}
  .ep-meta{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:24px}
  .ep-mc{padding:9px 13px;border-right:1px solid #e2e8f0}
  .ep-mc:last-child{border-right:none}
  .ep-ml{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:3px}
  .ep-mv{font-size:12px;font-weight:600;color:#1e293b}
  .ep-mv-orange{color:#f97316}
  .ep-section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:10px;page-break-after:avoid}
  table{width:100%;border-collapse:collapse;font-size:11px;page-break-inside:auto}
  th{background:#f1f5f9;color:#475569;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
  th.num{text-align:right}
  th.center{text-align:center}
  td{padding:8px 10px;color:#1e293b;border-bottom:1px solid #e2e8f0;vertical-align:top}
  td.num{text-align:right;font-family:monospace}
  td.center{text-align:center}
  td.blank{background:#fafafa}
  tr{page-break-inside:avoid}
  tr:nth-child(even) td:not(.blank){background:#f8fafc}
  thead{display:table-header-group}
  .ep-summary{margin-top:20px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;page-break-inside:avoid}
  .ep-summary-row{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #e2e8f0;font-size:11px}
  .ep-summary-row:last-child{border-bottom:none}
  .ep-summary-label{color:#475569}
  .ep-footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8}
  .ep-footer-logo{font-size:13px;font-weight:900;color:#f97316;letter-spacing:1px}
  .ep-badge{font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;display:inline-block}
  .ep-badge-standard{background:#e2e8f0;color:#475569}
  .ep-badge-addition{background:#dcfce7;color:#059669}
  .ep-badge-omission{background:#fee2e2;color:#dc2626}
  .ep-note{font-size:10px;color:#64748b;margin-bottom:16px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px}
`;

export function exportMaterialPricingPDF(data: MaterialEnquiryData): void {
  if (data.items.length === 0) return;

  const showScope = data.showScope;
  const scopeCol = showScope ? '<th>Scope</th>' : '';

  const thead = `<thead><tr>
    <th>#</th>
    <th>Description</th>
    <th>Discipline</th>
    ${showScope ? '<th>Category</th>' : ''}
    <th>Drawing</th>
    <th>Pg</th>
    <th class="num">Qty</th>
    <th>Unit</th>
    ${scopeCol}
    <th class="num">Supplier Rate</th>
    <th class="num">Supplier Total</th>
    <th>Mfr / Part Ref</th>
    <th class="center">Lead Time</th>
    <th>Supplier Notes</th>
  </tr></thead>`;

  const rows = data.items.map((item, idx) => {
    const fq = finalQuantity(item);
    const drawName = drawingName(data.drawings, item.drawing_id);
    const scopeBadge = `<span class="ep-badge ep-badge-${item.line_type}">${SCOPE_LABELS[item.line_type] ?? item.line_type}</span>`;
    const categoryCol = showScope ? `<td>${item.category || '-'}</td>` : '';

    return `<tr>
      <td style="font-family:monospace;color:#94a3b8">${String(idx + 1).padStart(2, '0')}</td>
      <td>${item.label || 'Untitled'}</td>
      <td>${item.discipline}</td>
      ${categoryCol}
      <td style="white-space:nowrap">${drawName}</td>
      <td>${item.page_number}</td>
      <td class="num" style="font-weight:600">${fmtNum(fq)}</td>
      <td>${item.unit}</td>
      ${showScope ? `<td>${scopeBadge}</td>` : ''}
      <td class="num blank"></td>
      <td class="num blank"></td>
      <td class="blank"></td>
      <td class="center blank"></td>
      <td class="blank"></td>
    </tr>`;
  }).join('');

  const logo = data.logoDataUrl
    ? `<img src="${data.logoDataUrl}" alt="Logo" style="height:36px;max-width:160px;object-fit:contain;display:block;margin-bottom:4px">`
    : `<div class="ep-logo">VYSITE</div><div class="ep-logo-sub">Construction Management Platform</div>`;

  const footerLogo = data.logoDataUrl
    ? `<img src="${data.logoDataUrl}" alt="Logo" style="height:22px;max-width:100px;object-fit:contain;display:block;margin-bottom:3px">`
    : `<div class="ep-footer-logo">VYSITE</div>`;

  const summary = `<div class="ep-summary">
    <div class="ep-summary-row" style="font-weight:600"><span class="ep-summary-label">Total Enquiry Items</span><span>${data.items.length}</span></div>
    <div class="ep-summary-row"><span class="ep-summary-label">Trade / Discipline Filter</span><span>${data.disciplineLabel}</span></div>
    ${data.includeOmissions ? '<div class="ep-summary-row"><span class="ep-summary-label">Omitted Items Included</span><span>Yes</span></div>' : ''}
  </div>`;

  const note = `<div class="ep-note">Please complete the supplier pricing columns and return this document. All quantities are final take-off quantities. ${data.includeOmissions ? 'Items marked OMIT are scope that has been removed but are included for pricing reference.' : ''}</div>`;

  const body = `
    <div class="ep-header">
      <div>${logo}</div>
      <div>
        <div class="ep-doc-title">Material Pricing Enquiry</div>
        <div class="ep-doc-sub">Tender Material Quantities</div>
      </div>
    </div>
    <div class="ep-meta">
      <div class="ep-mc"><div class="ep-ml">Tender Name</div><div class="ep-mv">${data.tenderName}</div></div>
      <div class="ep-mc"><div class="ep-ml">Client</div><div class="ep-mv">${data.client || '-'}</div></div>
      <div class="ep-mc"><div class="ep-ml">Tender Reference</div><div class="ep-mv ep-mv-orange">${data.tenderRef}</div></div>
      <div class="ep-mc"><div class="ep-ml">Location</div><div class="ep-mv">${data.location || '-'}</div></div>
      <div class="ep-mc" style="grid-column:span 2"><div class="ep-ml">Export Date</div><div class="ep-mv">${data.exportDate}</div></div>
    </div>
    ${note}
    <div class="ep-section-label">Material Schedule</div>
    <table>${thead}<tbody>${rows}</tbody></table>
    ${summary}
    <div class="ep-footer">
      <div>${footerLogo}<div style="margin-top:3px">Powered by VYSITE - Generated ${data.exportDate} - ${data.tenderRef}</div></div>
    </div>
  `;

  openPrintTab(buildPrintDocument('Material Pricing Enquiry - VYSITE', STYLES + `@page{size:A4 landscape}`, body));
}
