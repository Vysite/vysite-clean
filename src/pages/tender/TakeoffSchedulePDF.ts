import { openPrintTab, buildPrintDocument } from '../../lib/printTab';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { DBTenderDrawing } from './drawingTypes';
import { finalQuantity, calcTakeoffCosts, signedTakeoffCosts, formatDuration, formatCurrency } from './takeoffCalculations';
import type { LinearGeometry, AreaGeometry } from './takeoffGeometry';
import { groupLinearRuns, areaPolygonQuantity } from './takeoffCalculations';
import type { DBTenderDrawingCalibration } from './drawingTypes';

export interface TakeoffSchedulePDFData {
  tenderName: string;
  tenderRef: string;
  client: string;
  location: string;
  exportDate: string;
  logoDataUrl: string | null | undefined;
  items: DBTenderTakeoffItem[];
  drawings: DBTenderDrawing[];
  calibrations: DBTenderDrawingCalibration[];
}

const TYPE_LABELS: Record<string, string> = { count: 'Count', linear: 'Linear', area: 'Area' };
const TYPE_SYMBOLS: Record<string, string> = { count: '\u25CF', linear: '\u2014', area: '\u25A0' };
const LINE_LABELS: Record<string, string> = { standard: 'STD', addition: '+ ADD', omission: '\u2212 OMIT' };
const LINE_COLORS: Record<string, string> = { standard: '#475569', addition: '#059669', omission: '#dc2626' };

function drawingName(drawings: DBTenderDrawing[], id: string | null): string {
  if (!id) return 'Manual';
  const d = drawings.find(dr => dr.id === id);
  return d ? `${d.drawing_number || d.title}` : 'Unknown';
}

function calForPage(calibrations: DBTenderDrawingCalibration[], drawingId: string, pageNum: number): DBTenderDrawingCalibration | null {
  return calibrations.find(c => c.drawing_id === drawingId && c.page_number === pageNum) ?? null;
}

function fmtNum(n: number, decimals = 3): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Shared styles ──────────────────────────────────────────────────────────

const SHARED_STYLES = `
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
  td{padding:8px 10px;color:#1e293b;border-bottom:1px solid #e2e8f0;vertical-align:top}
  td.num{text-align:right;font-family:monospace}
  tr{page-break-inside:avoid}
  tr:nth-child(even) td{background:#f8fafc}
  thead{display:table-header-group}
  .ep-summary{margin-top:20px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;page-break-inside:avoid}
  .ep-summary-row{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #e2e8f0;font-size:11px}
  .ep-summary-row:last-child{border-bottom:none}
  .ep-summary-label{color:#475569}
  .ep-confidential{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#dc2626;border:1px solid #dc2626;padding:2px 8px;border-radius:4px}
  .ep-footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8}
  .ep-footer-logo{font-size:13px;font-weight:900;color:#f97316;letter-spacing:1px}
  .ep-detail{margin-top:6px;padding-left:16px;font-size:10px;color:#64748b;page-break-inside:avoid}
  .ep-detail-row{display:flex;gap:8px;padding:2px 0}
  .ep-badge{font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;display:inline-block}
  .ep-badge-standard{background:#e2e8f0;color:#475569}
  .ep-badge-addition{background:#dcfce7;color:#059669}
  .ep-badge-omission{background:#fee2e2;color:#dc2626}
`;

function headerHtml(logoDataUrl: string | null | undefined, title: string, subtitle: string): string {
  const logo = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="Logo" style="height:36px;max-width:160px;object-fit:contain;display:block;margin-bottom:4px">`
    : `<div class="ep-logo">VYSITE</div><div class="ep-logo-sub">Construction Management Platform</div>`;
  return `<div class="ep-header"><div>${logo}</div><div><div class="ep-doc-title">${title}</div><div class="ep-doc-sub">${subtitle}</div></div></div>`;
}

function metaHtml(data: TakeoffSchedulePDFData): string {
  return `<div class="ep-meta">
    <div class="ep-mc"><div class="ep-ml">Tender Name</div><div class="ep-mv">${data.tenderName}</div></div>
    <div class="ep-mc"><div class="ep-ml">Client</div><div class="ep-mv">${data.client || '\u2014'}</div></div>
    <div class="ep-mc"><div class="ep-ml">Tender Reference</div><div class="ep-mv ep-mv-orange">${data.tenderRef}</div></div>
    <div class="ep-mc"><div class="ep-ml">Location</div><div class="ep-mv">${data.location || '\u2014'}</div></div>
    <div class="ep-mc" style="grid-column:span 2"><div class="ep-ml">Export Date</div><div class="ep-mv">${data.exportDate}</div></div>
  </div>`;
}

function footerHtml(logoDataUrl: string | null | undefined, exportDate: string, tenderRef: string, confidential: boolean): string {
  const logo = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="Logo" style="height:22px;max-width:100px;object-fit:contain;display:block;margin-bottom:3px">`
    : `<div class="ep-footer-logo">VYSITE</div>`;
  return `<div class="ep-footer">
    <div>${logo}<div style="margin-top:3px">Powered by VYSITE \u00B7 Generated ${exportDate} \u00B7 ${tenderRef}</div></div>
    <div>${confidential ? '<span class="ep-confidential">Commercially Sensitive \u2014 Internal Only</span>' : ''}</div>
  </div>`;
}

function lineBadge(lineType: string): string {
  const cls = lineType === 'addition' ? 'ep-badge-addition' : lineType === 'omission' ? 'ep-badge-omission' : 'ep-badge-standard';
  return `<span class="ep-badge ${cls}">${LINE_LABELS[lineType] ?? lineType}</span>`;
}

// ── Measurement breakdown ──────────────────────────────────────────────────

function measurementBreakdown(item: DBTenderTakeoffItem, calibrations: DBTenderDrawingCalibration[], drawings: DBTenderDrawing[]): string {
  if (!item.geometry) return '';
  const cal = item.drawing_id ? calForPage(calibrations, item.drawing_id, item.page_number) : null;
  const draw = drawings.find(d => d.id === item.drawing_id);

  if (item.measurement_type === 'linear' && item.geometry) {
    const geo = item.geometry as LinearGeometry;
    const runs = groupLinearRuns(geo, cal, 595, 842);
    if (runs.length <= 1) return '';
    return `<div class="ep-detail">${runs.map((r, i) => `<div class="ep-detail-row"><span>Run ${String(i+1).padStart(2,'0')}</span><span style="font-family:monospace;margin-left:auto">${fmtNum(r.quantity, 2)} ${item.unit}</span></div>`).join('')}</div>`;
  }
  if (item.measurement_type === 'area' && item.geometry) {
    const geo = item.geometry as AreaGeometry;
    if (geo.polygons.length <= 1) return '';
    return `<div class="ep-detail">${geo.polygons.map((p, i) => {
      const q = areaPolygonQuantity(p, cal, 595, 842);
      return `<div class="ep-detail-row"><span>Area ${String(i+1).padStart(2,'0')}</span><span style="font-family:monospace;margin-left:auto">${fmtNum(q, 2)} ${item.unit}</span></div>`;
    }).join('')}</div>`;
  }
  return '';
}

// ── Internal Take-Off Schedule PDF ─────────────────────────────────────────

export function exportInternalTakeoffPDF(data: TakeoffSchedulePDFData): void {
  if (data.items.length === 0) return;

  const thead = `<thead><tr>
    <th>#</th><th>Description</th><th>Drawing</th><th>Pg</th><th>Discipline</th><th>Type</th>
    <th class="num">Measured</th><th class="num">Adj</th><th class="num">Final</th><th>Unit</th><th>Line</th>
    <th class="num">Mat Rate</th><th class="num">Mat Cost</th>
    <th class="num">Labour</th><th class="num">Labour Cost</th>
    <th class="num">Total Cost</th><th class="num">Effect</th>
  </tr></thead>`;

  const rows = data.items.map((item, idx) => {
    const fq = finalQuantity(item);
    const costs = calcTakeoffCosts(item);
    const signed = signedTakeoffCosts(item);
    const measured = item.source === 'manual' ? item.manual_quantity : item.quantity;
    const adj = item.adjustment_quantity !== 0 ? (item.adjustment_quantity > 0 ? '+' : '') + fmtNum(item.adjustment_quantity) : '\u2014';
    const labourDisplay = costs.labourBasis === 'per_unit'
      ? `${formatDuration(costs.totalLabourMinutes)} @ ${formatCurrency(costs.labourRate)}/hr`
      : `${formatDuration(costs.totalLabourMinutes)} (lump)`;
    const effectStr = signed.lineType === 'omission'
      ? `<span style="color:#dc2626">\u2212${formatCurrency(costs.totalCost)}</span>`
      : formatCurrency(costs.totalCost);
    const breakdown = measurementBreakdown(item, data.calibrations, data.drawings);

    return `<tr>
      <td style="font-family:monospace;color:#94a3b8">${String(idx+1).padStart(2,'0')}</td>
      <td>${item.label || 'Untitled'}${breakdown}</td>
      <td style="white-space:nowrap">${drawingName(data.drawings, item.drawing_id)}</td>
      <td>${item.page_number}</td>
      <td>${item.discipline}</td>
      <td>${TYPE_SYMBOLS[item.measurement_type]} ${TYPE_LABELS[item.measurement_type]}</td>
      <td class="num">${fmtNum(measured)}</td>
      <td class="num">${adj}</td>
      <td class="num" style="font-weight:600">${fmtNum(fq)}</td>
      <td>${item.unit}</td>
      <td>${lineBadge(item.line_type)}</td>
      <td class="num">${formatCurrency(costs.materialCostRate)}</td>
      <td class="num">${formatCurrency(costs.materialCostTotal)}</td>
      <td class="num" style="font-size:10px">${labourDisplay}</td>
      <td class="num">${formatCurrency(costs.labourCostTotal)}</td>
      <td class="num">${formatCurrency(costs.totalCost)}</td>
      <td class="num" style="font-weight:600">${effectStr}</td>
    </tr>`;
  }).join('');

  // Financial summary
  const signedItems = data.items.map(i => signedTakeoffCosts(i));
  const grossMat = signedItems.filter(s => s.lineType !== 'omission').reduce((s, c) => s + c.materialCostTotal, 0);
  const grossLab = signedItems.filter(s => s.lineType !== 'omission').reduce((s, c) => s + c.labourCostTotal, 0);
  const grossCost = grossMat + grossLab;
  const addMat = signedItems.filter(s => s.lineType === 'addition').reduce((s, c) => s + c.materialCostTotal, 0);
  const addLab = signedItems.filter(s => s.lineType === 'addition').reduce((s, c) => s + c.labourCostTotal, 0);
  const omitMat = signedItems.filter(s => s.lineType === 'omission').reduce((s, c) => s + c.materialCostTotal, 0);
  const omitLab = signedItems.filter(s => s.lineType === 'omission').reduce((s, c) => s + c.labourCostTotal, 0);
  const netMat = signedItems.reduce((s, c) => s + c.signedMaterialCost, 0);
  const netLab = signedItems.reduce((s, c) => s + c.signedLabourCost, 0);
  const netTotal = signedItems.reduce((s, c) => s + c.signedTotalCost, 0);

  // Quantity summary
  const counted = data.items.filter(i => i.measurement_type === 'count');
  const linear = data.items.filter(i => i.measurement_type === 'linear');
  const area = data.items.filter(i => i.measurement_type === 'area');
  const countTotal = counted.reduce((s, i) => s + finalQuantity(i), 0);
  const linearTotal = linear.reduce((s, i) => s + finalQuantity(i), 0);
  const areaTotal = area.reduce((s, i) => s + finalQuantity(i), 0);

  let qtySummary = '';
  if (counted.length > 0) qtySummary += `<div class="ep-summary-row"><span class="ep-summary-label">Counted Items</span><span>${countTotal.toFixed(0)} nr</span></div>`;
  if (linear.length > 0) qtySummary += `<div class="ep-summary-row"><span class="ep-summary-label">Linear Total</span><span>${linearTotal.toFixed(2)} m</span></div>`;
  if (area.length > 0) qtySummary += `<div class="ep-summary-row"><span class="ep-summary-label">Area Total</span><span>${areaTotal.toFixed(2)} m\u00B2</span></div>`;

  let finSummary = '';
  finSummary += `<div class="ep-summary-row"><span class="ep-summary-label">Gross Material Cost (STD + ADD)</span><span style="font-family:monospace">${formatCurrency(grossMat)}</span></div>`;
  finSummary += `<div class="ep-summary-row"><span class="ep-summary-label">Gross Labour Cost (STD + ADD)</span><span style="font-family:monospace">${formatCurrency(grossLab)}</span></div>`;
  finSummary += `<div class="ep-summary-row" style="border-top:2px solid #e2e8f0;font-weight:600"><span class="ep-summary-label">Gross Cost</span><span style="font-family:monospace">${formatCurrency(grossCost)}</span></div>`;
  if (addMat + addLab > 0) {
    finSummary += `<div class="ep-summary-row"><span class="ep-summary-label">Additions</span><span style="font-family:monospace;color:#059669">+${formatCurrency(addMat + addLab)}</span></div>`;
  }
  if (omitMat + omitLab > 0) {
    finSummary += `<div class="ep-summary-row"><span class="ep-summary-label">Omissions</span><span style="font-family:monospace;color:#dc2626">\u2212${formatCurrency(omitMat + omitLab)}</span></div>`;
  }
  finSummary += `<div class="ep-summary-row"><span class="ep-summary-label">Net Material Effect</span><span style="font-family:monospace">${formatCurrency(netMat)}</span></div>`;
  finSummary += `<div class="ep-summary-row"><span class="ep-summary-label">Net Labour Effect</span><span style="font-family:monospace">${formatCurrency(netLab)}</span></div>`;
  finSummary += `<div class="ep-summary-row" style="background:#f97316;color:white;font-weight:700;font-size:13px"><span class="ep-summary-label" style="color:white">Net Take-Off Cost / Commercial Effect</span><span style="font-family:monospace">${formatCurrency(netTotal)}</span></div>`;

  const body = `
    ${headerHtml(data.logoDataUrl, 'Internal Take-Off Schedule', 'Commercial \u2014 Confidential')}
    ${metaHtml(data)}
    <div class="ep-section-label">Take-Off Items</div>
    <table>${thead}<tbody>${rows}</tbody></table>
    <div class="ep-summary">${qtySummary}</div>
    <div class="ep-summary">${finSummary}</div>
    ${footerHtml(data.logoDataUrl, data.exportDate, data.tenderRef, true)}
  `;

  openPrintTab(buildPrintDocument('Internal Take-Off Schedule \u2014 VYSITE', SHARED_STYLES + `@page{size:A4 landscape}`, body));
}

// ── Client Take-Off Schedule PDF ───────────────────────────────────────────

export function exportClientTakeoffPDF(data: TakeoffSchedulePDFData): void {
  if (data.items.length === 0) return;

  const thead = `<thead><tr>
    <th>#</th><th>Description</th><th>Drawing</th><th>Pg</th><th>Discipline</th><th>Type</th>
    <th class="num">Measured</th><th class="num">Adj</th><th class="num">Final</th><th>Unit</th><th>Scope</th>
  </tr></thead>`;

  const rows = data.items.map((item, idx) => {
    const fq = finalQuantity(item);
    const measured = item.source === 'manual' ? item.manual_quantity : item.quantity;
    const adj = item.adjustment_quantity !== 0 ? (item.adjustment_quantity > 0 ? '+' : '') + fmtNum(item.adjustment_quantity) : '\u2014';

    return `<tr>
      <td style="font-family:monospace;color:#94a3b8">${String(idx+1).padStart(2,'0')}</td>
      <td>${item.label || 'Untitled'}</td>
      <td style="white-space:nowrap">${drawingName(data.drawings, item.drawing_id)}</td>
      <td>${item.page_number}</td>
      <td>${item.discipline}</td>
      <td>${TYPE_SYMBOLS[item.measurement_type]} ${TYPE_LABELS[item.measurement_type]}</td>
      <td class="num">${fmtNum(measured)}</td>
      <td class="num">${adj}</td>
      <td class="num" style="font-weight:600">${fmtNum(fq)}</td>
      <td>${item.unit}</td>
      <td>${lineBadge(item.line_type)}</td>
    </tr>`;
  }).join('');

  // Quantity summary only (no financial data)
  const counted = data.items.filter(i => i.measurement_type === 'count');
  const linear = data.items.filter(i => i.measurement_type === 'linear');
  const area = data.items.filter(i => i.measurement_type === 'area');
  const countTotal = counted.reduce((s, i) => s + finalQuantity(i), 0);
  const linearTotal = linear.reduce((s, i) => s + finalQuantity(i), 0);
  const areaTotal = area.reduce((s, i) => s + finalQuantity(i), 0);

  let qtySummary = '';
  if (counted.length > 0) qtySummary += `<div class="ep-summary-row"><span class="ep-summary-label">Counted Items</span><span>${countTotal.toFixed(0)} nr</span></div>`;
  if (linear.length > 0) qtySummary += `<div class="ep-summary-row"><span class="ep-summary-label">Linear Total</span><span>${linearTotal.toFixed(2)} m</span></div>`;
  if (area.length > 0) qtySummary += `<div class="ep-summary-row"><span class="ep-summary-label">Area Total</span><span>${areaTotal.toFixed(2)} m\u00B2</span></div>`;
  qtySummary += `<div class="ep-summary-row" style="font-weight:600"><span class="ep-summary-label">Total Take-Off Items</span><span>${data.items.length}</span></div>`;

  const body = `
    ${headerHtml(data.logoDataUrl, 'Take-Off Schedule', 'Measurement \u2014 Scope Quantities')}
    ${metaHtml(data)}
    <div class="ep-section-label">Take-Off Items</div>
    <table>${thead}<tbody>${rows}</tbody></table>
    <div class="ep-summary">${qtySummary}</div>
    ${footerHtml(data.logoDataUrl, data.exportDate, data.tenderRef, false)}
  `;

  openPrintTab(buildPrintDocument('Take-Off Schedule \u2014 VYSITE', SHARED_STYLES + `@page{size:A4 landscape}`, body));
}
