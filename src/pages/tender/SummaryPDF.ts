import { openPrintTab, buildPrintDocument } from '../../lib/printTab';
import type { Tender, EstimateItem } from '../../data/types';
import type { DBTenderDrawing } from './drawingTypes';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import { finalQuantity, calcTakeoffCosts, signedTakeoffCosts } from './takeoffCalculations';
import { getSyncStatus } from './TakeoffEstimateSync';
import { calcLine, computeEstimateSummary, fmtNum, fmtC, fmtDeduction } from './estimateCalculations';

interface SummaryData {
  tender: Tender;
  drawings: DBTenderDrawing[];
  takeoffItems: DBTenderTakeoffItem[];
  canViewFinancials: boolean;
}

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
  .ep-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px}
  .ep-kpi{border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px}
  .ep-kpi-label{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:4px}
  .ep-kpi-value{font-size:14px;font-weight:700;color:#1e293b}
  .ep-kpi-accent{background:#0f172a;border-color:#f97316}
  .ep-kpi-accent .ep-kpi-label{color:#f97316}
  .ep-kpi-accent .ep-kpi-value{color:white}
  table{width:100%;border-collapse:collapse;font-size:11px;page-break-inside:auto;margin-bottom:16px}
  th{background:#f1f5f9;color:#475569;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
  th.num{text-align:right}
  td{padding:7px 10px;color:#1e293b;border-bottom:1px solid #e2e8f0;vertical-align:top}
  td.num{text-align:right;font-family:monospace}
  tr{page-break-inside:avoid}
  tr:nth-child(even) td{background:#f8fafc}
  .ep-summary{margin-top:16px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;page-break-inside:avoid}
  .ep-summary-row{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #e2e8f0;font-size:11px}
  .ep-summary-row:last-child{border-bottom:none}
  .ep-summary-label{color:#475569}
  .ep-confidential{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#dc2626;border:1px solid #dc2626;padding:2px 8px;border-radius:4px}
  .ep-footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8}
  .ep-footer-logo{font-size:13px;font-weight:900;color:#f97316;letter-spacing:1px}
  .ep-status-ok{color:#059669;font-weight:700}
  .ep-status-warn{color:#f59e0b;font-weight:700}
  .ep-omit{color:#dc2626}
  .ep-add{color:#059669}
  .ep-card{border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin-bottom:16px;page-break-inside:avoid}
  .ep-card-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:8px}
  .ep-row{display:flex;justify-content:space-between;font-size:11px;padding:4px 0}
  .ep-row-label{color:#475569}
  .ep-row-value{color:#1e293b;font-weight:600}
`;

function buildHeader(title: string, subtitle: string, tender: Tender, logoUrl?: string) {
  const exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const headerLogo = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="height:36px;max-width:160px;object-fit:contain;display:block;margin-bottom:4px">`
    : `<div class="ep-logo">VYSITE</div><div class="ep-logo-sub">Construction Management Platform</div>`;
  const footerLogo = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="height:22px;max-width:100px;object-fit:contain;display:block;margin-bottom:3px">`
    : `<div class="ep-footer-logo">VYSITE</div>`;
  return { headerLogo, footerLogo, exportDate };
}

function buildKpiGrid(items: { label: string; value: string; accent?: boolean }[]) {
  return `<div class="ep-kpi-grid">${items.map(k =>
    `<div class="ep-kpi${k.accent ? ' ep-kpi-accent' : ''}"><div class="ep-kpi-label">${k.label}</div><div class="ep-kpi-value">${k.value}</div></div>`
  ).join('')}</div>`;
}

export function exportInternalSummary(data: SummaryData, logoUrl?: string) {
  const { tender, drawings, takeoffItems, canViewFinancials } = data;
  const est = computeEstimateSummary(tender);
  const { headerLogo, footerLogo, exportDate } = buildHeader('Estimating Summary — Internal', 'Commercial — Confidential', tender, logoUrl);

  // Take-Off calculations
  const takeoffSigned = takeoffItems.map(i => signedTakeoffCosts(i));
  const totalMaterial = takeoffSigned.reduce((s, c) => s + c.signedMaterialCost, 0);
  const totalLabour = takeoffSigned.reduce((s, c) => s + c.signedLabourCost, 0);
  const totalTakeoffCost = takeoffSigned.reduce((s, c) => s + c.signedTotalCost, 0);
  const totalLabourHours = takeoffItems.reduce((s, i) => s + calcTakeoffCosts(i).totalLabourHours, 0);

  const counted = takeoffItems.filter(i => i.measurement_type === 'count');
  const linear = takeoffItems.filter(i => i.measurement_type === 'linear');
  const area = takeoffItems.filter(i => i.measurement_type === 'area');
  const countTotal = counted.reduce((s, i) => s + finalQuantity(i), 0);
  const linearTotal = linear.reduce((s, i) => s + finalQuantity(i), 0);
  const areaTotal = area.reduce((s, i) => s + finalQuantity(i), 0);

  const stdItems = takeoffItems.filter(i => i.line_type === 'standard');
  const addItems = takeoffItems.filter(i => i.line_type === 'addition');
  const omitItems = takeoffItems.filter(i => i.line_type === 'omission');
  const stdCost = stdItems.reduce((s, i) => s + calcTakeoffCosts(i).totalCost, 0);
  const addCost = addItems.reduce((s, i) => s + calcTakeoffCosts(i).totalCost, 0);
  const omitCost = omitItems.reduce((s, i) => s + calcTakeoffCosts(i).totalCost, 0);

  // Discipline breakdown
  const disciplineMap = new Map<string, { count: number; material: number; labour: number; total: number }>();
  for (const item of takeoffItems) {
    const d = item.discipline || 'Uncategorised';
    const existing = disciplineMap.get(d) ?? { count: 0, material: 0, labour: 0, total: 0 };
    const signed = signedTakeoffCosts(item);
    existing.count++;
    existing.material += signed.signedMaterialCost;
    existing.labour += signed.signedLabourCost;
    existing.total += signed.signedTotalCost;
    disciplineMap.set(d, existing);
  }
  const disciplines = Array.from(disciplineMap.entries()).sort((a, b) => b[1].total - a[1].total);

  // Sync status
  const syncStatuses = takeoffItems.map(i => getSyncStatus(i, tender.estimateItems ?? []));
  const syncedCount = syncStatuses.filter(s => s === 'synced').length;
  const notSyncedCount = syncStatuses.filter(s => s === 'not_synced').length;
  const changedCount = syncStatuses.filter(s => s === 'changed').length;
  const allSynced = takeoffItems.length > 0 && notSyncedCount === 0 && changedCount === 0;

  // Drawings
  const drawingIdsWithTakeoff = new Set(takeoffItems.map(i => i.drawing_id).filter(Boolean));
  const drawingsWithTakeoff = drawings.filter(d => drawingIdsWithTakeoff.has(d.id)).length;
  const drawingsWithoutTakeoff = drawings.length - drawingsWithTakeoff;
  const totalPages = drawings.reduce((s, d) => s + (d.page_count || 0), 0);

  // Estimate omissions/additions
  const estimateOmissions = (tender.estimateItems ?? []).filter(it => it.sourceLineType === 'omission');
  const estimateAdditions = (tender.estimateItems ?? []).filter(it => it.sourceLineType === 'addition');
  const estimateOmissionSale = estimateOmissions.reduce((s, it) => s + calcLine(it).saleTotal, 0);
  const estimateAdditionSale = estimateAdditions.reduce((s, it) => s + calcLine(it).saleTotal, 0);

  // KPI grid
  const kpis: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Drawings', value: String(drawings.length) },
    { label: 'Take-Off Items', value: String(takeoffItems.length) },
  ];
  if (canViewFinancials) {
    kpis.push(
      { label: 'Material Cost', value: fmtC(totalMaterial) },
      { label: 'Labour Cost', value: fmtC(totalLabour) },
    );
  }
  kpis.push({ label: 'Total Labour', value: `${fmtNum(totalLabourHours)} hrs` });
  if (canViewFinancials) {
    kpis.push(
      { label: 'Estimate Cost', value: fmtC(est.includedCost) },
      { label: 'Tender Value', value: fmtC(est.tenderValueBeforeMcd) },
      { label: 'Final Tender Sum', value: fmtC(est.finalTenderSum), accent: true },
      { label: 'Margin', value: `${est.marginAfterMcd.toFixed(1)}%` },
    );
  }

  // Build sections
  let sectionsHtml = '';

  // Drawings section
  sectionsHtml += `<div class="ep-card">
    <div class="ep-card-title">Drawings</div>
    <div class="ep-row"><span class="ep-row-label">Total Drawings</span><span class="ep-row-value">${drawings.length}</span></div>
    <div class="ep-row"><span class="ep-row-label">With Take-Off</span><span class="ep-row-value" style="color:#059669">${drawingsWithTakeoff}</span></div>
    <div class="ep-row"><span class="ep-row-label">Without Take-Off</span><span class="ep-row-value">${drawingsWithoutTakeoff}</span></div>
    ${totalPages > 0 ? `<div class="ep-row"><span class="ep-row-label">Total PDF Pages</span><span class="ep-row-value">${totalPages}</span></div>` : ''}
  </div>`;

  // Take-Off section
  sectionsHtml += `<div class="ep-card">
    <div class="ep-card-title">Take-Off</div>
    <div class="ep-row"><span class="ep-row-label">Total Items</span><span class="ep-row-value">${takeoffItems.length}</span></div>
    ${counted.length > 0 ? `<div class="ep-row"><span class="ep-row-label">Counted</span><span class="ep-row-value">${countTotal.toFixed(0)} nr</span></div>` : ''}
    ${linear.length > 0 ? `<div class="ep-row"><span class="ep-row-label">Linear</span><span class="ep-row-value">${linearTotal.toFixed(2)} m</span></div>` : ''}
    ${area.length > 0 ? `<div class="ep-row"><span class="ep-row-label">Area</span><span class="ep-row-value">${areaTotal.toFixed(2)} m²</span></div>` : ''}
    <div class="ep-row"><span class="ep-row-label">Total Labour</span><span class="ep-row-value">${fmtNum(totalLabourHours)} hrs</span></div>
    ${canViewFinancials ? `
      <div class="ep-row"><span class="ep-row-label">Material Cost</span><span class="ep-row-value">${fmtC(totalMaterial)}</span></div>
      <div class="ep-row"><span class="ep-row-label">Labour Cost</span><span class="ep-row-value">${fmtC(totalLabour)}</span></div>
      <div class="ep-row" style="border-top:1px solid #e2e8f0;padding-top:6px;margin-top:4px"><span class="ep-row-label" style="font-weight:600">Net Take-Off Cost</span><span class="ep-row-value" style="color:#f97316;font-weight:700">${fmtC(totalTakeoffCost)}</span></div>
    ` : ''}
  </div>`;

  // Scope classification
  sectionsHtml += `<div class="ep-card">
    <div class="ep-card-title">Scope / Commercial Classification</div>
    <div class="ep-row"><span class="ep-row-label">Standard</span><span class="ep-row-value">${stdItems.length} items</span></div>
    <div class="ep-row"><span class="ep-row-label" style="color:#059669">Additions</span><span class="ep-row-value" style="color:#059669">${addItems.length} items</span></div>
    <div class="ep-row"><span class="ep-row-label" style="color:#dc2626">Omissions</span><span class="ep-row-value" style="color:#dc2626">${omitItems.length} items</span></div>
    ${canViewFinancials && takeoffItems.length > 0 ? `
      <div style="border-top:1px solid #e2e8f0;padding-top:6px;margin-top:4px">
        <div class="ep-row"><span class="ep-row-label">Standard</span><span class="ep-row-value">${fmtC(stdCost)}</span></div>
        <div class="ep-row"><span class="ep-row-label" style="color:#059669">Additions</span><span class="ep-row-value" style="color:#059669">+${fmtC(addCost)}</span></div>
        <div class="ep-row"><span class="ep-row-label" style="color:#dc2626">Omissions</span><span class="ep-row-value" style="color:#dc2626">${fmtDeduction(omitCost)}</span></div>
        <div class="ep-row" style="border-top:1px solid #e2e8f0;padding-top:6px;margin-top:4px"><span class="ep-row-label" style="font-weight:600">Net Take-Off</span><span class="ep-row-value" style="color:#f97316;font-weight:700">${fmtC(totalTakeoffCost)}</span></div>
      </div>
    ` : ''}
  </div>`;

  // Sync status
  sectionsHtml += `<div class="ep-card">
    <div class="ep-card-title">Take-Off → Estimate Sync</div>
    <div class="ep-row"><span class="ep-row-label" style="color:#059669">Synced</span><span class="ep-row-value" style="color:#059669">${syncedCount}</span></div>
    <div class="ep-row"><span class="ep-row-label">Not Synced</span><span class="ep-row-value">${notSyncedCount}</span></div>
    <div class="ep-row"><span class="ep-row-label" style="color:#f59e0b">Changed</span><span class="ep-row-value" style="color:#f59e0b">${changedCount}</span></div>
    <div style="margin-top:6px">${takeoffItems.length === 0 ? '<span style="font-size:10px;color:#94a3b8;font-style:italic">No take-off items to sync.</span>' : allSynced ? '<span class="ep-status-ok">All Take-Off items are up to date</span>' : '<span class="ep-status-warn">Take-Off changes require Estimate review</span>'}</div>
  </div>`;

  // Discipline breakdown
  if (disciplines.length > 0) {
    sectionsHtml += `<div class="ep-section-label">Trade / Discipline Breakdown</div>
    <table>
      <thead><tr><th>Discipline</th><th class="num">Items</th>${canViewFinancials ? '<th class="num">Material</th><th class="num">Labour</th><th class="num">Total</th>' : ''}</tr></thead>
      <tbody>${disciplines.map(([d, v]) => `<tr><td>${d}</td><td class="num">${v.count}</td>${canViewFinancials ? `<td class="num">${fmtC(v.material)}</td><td class="num">${fmtC(v.labour)}</td><td class="num" style="font-weight:600">${fmtC(v.total)}</td>` : ''}</tr>`).join('')}</tbody>
    </table>`;
  }

  // Estimate summary
  if (canViewFinancials) {
    let estSummaryRows = '';
    estSummaryRows += `<div class="ep-summary-row"><span class="ep-summary-label">Works</span><span>${fmtC(est.worksTotals.sale)}</span></div>`;
    if (est.prelimItems.length > 0)
      estSummaryRows += `<div class="ep-summary-row"><span class="ep-summary-label">Preliminaries</span><span>${fmtC(est.prelimTotals.sale)}</span></div>`;
    if (est.optionalIncluded.length > 0)
      estSummaryRows += `<div class="ep-summary-row"><span class="ep-summary-label">Included Options</span><span>${fmtC(est.optIncludedTotals.sale)}</span></div>`;
    if (est.allowanceItems.length > 0)
      estSummaryRows += `<div class="ep-summary-row"><span class="ep-summary-label">Internal Allowances</span><span>${fmtC(est.allowanceTotals.sale)}</span></div>`;
    if (estimateAdditions.length > 0)
      estSummaryRows += `<div class="ep-summary-row"><span class="ep-summary-label" style="color:#059669">Additions</span><span style="color:#059669">+${fmtC(estimateAdditionSale)}</span></div>`;
    if (estimateOmissions.length > 0)
      estSummaryRows += `<div class="ep-summary-row"><span class="ep-summary-label" style="color:#dc2626">Omissions</span><span style="color:#dc2626">${fmtDeduction(estimateOmissionSale)}</span></div>`;
    estSummaryRows += `<div class="ep-summary-row" style="border-top:2px solid #e2e8f0;font-weight:600"><span class="ep-summary-label">Total Included Cost</span><span>${fmtC(est.includedCost)}</span></div>`;
    estSummaryRows += `<div class="ep-summary-row"><span class="ep-summary-label">Tender Value Before MCD</span><span style="font-weight:700">${fmtC(est.tenderValueBeforeMcd)}</span></div>`;
    if (est.mcdType !== 'none') {
      const mcdLabel = est.mcdType === 'percentage' ? `MCD (${est.mcdPct}%)` : 'MCD';
      estSummaryRows += `<div class="ep-summary-row"><span class="ep-summary-label">${mcdLabel}</span><span style="color:#dc2626">(${fmtC(est.mcdValue)})</span></div>`;
    }
    estSummaryRows += `<div class="ep-summary-row" style="background:#0f172a;color:white;font-weight:700;font-size:13px;border-top:3px solid #f97316"><span class="ep-summary-label" style="color:white">FINAL TENDER SUM</span><span>${fmtC(est.finalTenderSum)}</span></div>`;
    estSummaryRows += `<div class="ep-summary-row"><span class="ep-summary-label">Profit ${est.mcdType !== 'none' ? 'After MCD' : ''}</span><span style="color:${est.profitAfterMcd >= 0 ? '#059669' : '#dc2626'}">${fmtC(est.profitAfterMcd)}</span></div>`;
    estSummaryRows += `<div class="ep-summary-row"><span class="ep-summary-label">Margin ${est.mcdType !== 'none' ? 'After MCD' : ''}</span><span style="color:${est.marginAfterMcd >= 15 ? '#059669' : est.marginAfterMcd >= 8 ? '#f59e0b' : '#dc2626'}">${est.marginAfterMcd.toFixed(1)}%</span></div>`;

    sectionsHtml += `<div class="ep-section-label">Estimate</div><div class="ep-summary">${estSummaryRows}</div>`;
  }

  const body = `
    <div class="ep-header">
      <div>${headerLogo}</div>
      <div><div class="ep-doc-title">Estimating Summary — Internal</div><div class="ep-doc-sub">Commercial — Confidential</div></div>
    </div>
    <div class="ep-meta">
      <div class="ep-mc"><div class="ep-ml">Tender Name</div><div class="ep-mv">${tender.name}</div></div>
      <div class="ep-mc"><div class="ep-ml">Client</div><div class="ep-mv">${tender.client}</div></div>
      <div class="ep-mc"><div class="ep-ml">Tender Reference</div><div class="ep-mv ep-mv-orange">${tender.ref}</div></div>
      <div class="ep-mc"><div class="ep-ml">Location</div><div class="ep-mv">${tender.location || '—'}</div></div>
      <div class="ep-mc" style="grid-column:span 2"><div class="ep-ml">Export Date</div><div class="ep-mv">${exportDate}</div></div>
    </div>
    ${buildKpiGrid(kpis)}
    ${sectionsHtml}
    <div class="ep-footer">
      <div>${footerLogo}<div style="margin-top:3px">Generated ${exportDate} · Internal Summary · ${tender.ref}</div></div>
      <div><span class="ep-confidential">Commercially Sensitive — Internal Only</span></div>
    </div>
  `;
  openPrintTab(buildPrintDocument('Internal Estimating Summary — VYSITE', STYLES, body));
}

export function exportExternalSummary(data: SummaryData, logoUrl?: string) {
  const { tender, drawings, takeoffItems } = data;
  const est = computeEstimateSummary(tender);
  const { headerLogo, footerLogo, exportDate } = buildHeader('Tender Summary', 'Tender Summary', tender, logoUrl);

  // Take-Off quantities only (no costs)
  const counted = takeoffItems.filter(i => i.measurement_type === 'count');
  const linear = takeoffItems.filter(i => i.measurement_type === 'linear');
  const area = takeoffItems.filter(i => i.measurement_type === 'area');
  const countTotal = counted.reduce((s, i) => s + finalQuantity(i), 0);
  const linearTotal = linear.reduce((s, i) => s + finalQuantity(i), 0);
  const areaTotal = area.reduce((s, i) => s + finalQuantity(i), 0);

  const stdItems = takeoffItems.filter(i => i.line_type === 'standard');
  const addItems = takeoffItems.filter(i => i.line_type === 'addition');
  const omitItems = takeoffItems.filter(i => i.line_type === 'omission');

  // Discipline breakdown — items only, no costs
  const disciplineMap = new Map<string, number>();
  for (const item of takeoffItems) {
    const d = item.discipline || 'Uncategorised';
    disciplineMap.set(d, (disciplineMap.get(d) ?? 0) + 1);
  }
  const disciplines = Array.from(disciplineMap.entries()).sort((a, b) => b[1] - a[1]);

  // KPI grid — external: no costs, no margin, no profit
  const kpis: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Drawings', value: String(drawings.length) },
    { label: 'Take-Off Items', value: String(takeoffItems.length) },
    { label: 'Tender Value', value: fmtC(est.tenderValueBeforeMcd) },
    { label: 'Final Tender Sum', value: fmtC(est.finalTenderSum), accent: true },
  ];

  let sectionsHtml = '';

  // Drawings
  sectionsHtml += `<div class="ep-card">
    <div class="ep-card-title">Drawings</div>
    <div class="ep-row"><span class="ep-row-label">Total Drawings</span><span class="ep-row-value">${drawings.length}</span></div>
  </div>`;

  // Take-Off quantities
  sectionsHtml += `<div class="ep-card">
    <div class="ep-card-title">Take-Off Quantities</div>
    <div class="ep-row"><span class="ep-row-label">Total Items</span><span class="ep-row-value">${takeoffItems.length}</span></div>
    ${counted.length > 0 ? `<div class="ep-row"><span class="ep-row-label">Counted</span><span class="ep-row-value">${countTotal.toFixed(0)} nr</span></div>` : ''}
    ${linear.length > 0 ? `<div class="ep-row"><span class="ep-row-label">Linear</span><span class="ep-row-value">${linearTotal.toFixed(2)} m</span></div>` : ''}
    ${area.length > 0 ? `<div class="ep-row"><span class="ep-row-label">Area</span><span class="ep-row-value">${areaTotal.toFixed(2)} m²</span></div>` : ''}
  </div>`;

  // Scope classification — item counts only, no costs
  sectionsHtml += `<div class="ep-card">
    <div class="ep-card-title">Scope Classification</div>
    <div class="ep-row"><span class="ep-row-label">Standard</span><span class="ep-row-value">${stdItems.length} items</span></div>
    <div class="ep-row"><span class="ep-row-label" style="color:#059669">Additions</span><span class="ep-row-value" style="color:#059669">${addItems.length} items</span></div>
    <div class="ep-row"><span class="ep-row-label" style="color:#dc2626">Omissions</span><span class="ep-row-value" style="color:#dc2626">${omitItems.length} items</span></div>
  </div>`;

  // Discipline breakdown — items only
  if (disciplines.length > 0) {
    sectionsHtml += `<div class="ep-section-label">Trade / Discipline Breakdown</div>
    <table>
      <thead><tr><th>Discipline</th><th class="num">Items</th></tr></thead>
      <tbody>${disciplines.map(([d, c]) => `<tr><td>${d}</td><td class="num">${c}</td></tr>`).join('')}</tbody>
    </table>`;
  }

  // Tender summary — sale values only
  let tenderSummary = '';
  tenderSummary += `<div class="ep-summary-row"><span class="ep-summary-label">Tender Value</span><span style="font-weight:700">${fmtC(est.tenderValueBeforeMcd)}</span></div>`;
  if (est.mcdType !== 'none') {
    const mcdLabel = est.mcdType === 'percentage' ? `Main Contractor's Discount (${est.mcdPct}%)` : "Main Contractor's Discount";
    tenderSummary += `<div class="ep-summary-row"><span class="ep-summary-label">${mcdLabel}</span><span style="color:#dc2626">(${fmtC(est.mcdValue)})</span></div>`;
  }
  tenderSummary += `<div class="ep-summary-row" style="background:#0f172a;color:white;font-weight:700;font-size:13px;border-top:3px solid #f97316"><span class="ep-summary-label" style="color:white">FINAL TENDER SUM</span><span>${fmtC(est.finalTenderSum)}</span></div>`;

  sectionsHtml += `<div class="ep-section-label">Tender Summary</div><div class="ep-summary">${tenderSummary}</div>`;

  const body = `
    <div class="ep-header">
      <div>${headerLogo}</div>
      <div><div class="ep-doc-title">Tender Summary</div><div class="ep-doc-sub">${tender.client}</div></div>
    </div>
    <div class="ep-meta">
      <div class="ep-mc"><div class="ep-ml">Tender Name</div><div class="ep-mv">${tender.name}</div></div>
      <div class="ep-mc"><div class="ep-ml">Client</div><div class="ep-mv">${tender.client}</div></div>
      <div class="ep-mc"><div class="ep-ml">Tender Reference</div><div class="ep-mv ep-mv-orange">${tender.ref}</div></div>
      <div class="ep-mc"><div class="ep-ml">Location</div><div class="ep-mv">${tender.location || '—'}</div></div>
      <div class="ep-mc" style="grid-column:span 2"><div class="ep-ml">Export Date</div><div class="ep-mv">${exportDate}</div></div>
    </div>
    ${buildKpiGrid(kpis)}
    ${sectionsHtml}
    <div class="ep-footer">
      <div>${footerLogo}<div style="margin-top:3px">Generated ${exportDate} · Tender Summary · ${tender.ref}</div></div>
      <div></div>
    </div>
  `;
  openPrintTab(buildPrintDocument('Tender Summary — VYSITE', STYLES, body));
}
