import { openPrintTab } from '../../lib/printTab';
import type { DBAsset, DBAssetServiceRecord } from './types';
import type { SummaryCalc, ReviewStatus } from './AssetSummary';

function esc(v: unknown): string {
  const s = v == null ? '' : String(v);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtGBP(v: number | null | undefined): string {
  if (v == null) return '\u2014';
  return '\u00a3' + Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '\u2014';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return esc(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtAge(d: string | null | undefined): string {
  if (!d) return '\u2014';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '\u2014';
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  if (diffMs < 0) return '\u2014';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  const months = (now.getFullYear() - dt.getFullYear()) * 12 + (now.getMonth() - dt.getMonth());
  if (months < 12) return `${Math.max(1, months)} month${months === 1 ? '' : 's'}`;
  const years = months / 12;
  if (years < 10) return `${years.toFixed(1)} years`;
  return `${Math.floor(years)} years`;
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sanitizeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function exportSummaryFileName(asset: DBAsset, internal: boolean): string {
  const tag = sanitizeFileName(asset.asset_tag);
  const prefix = internal ? 'VYSITE_Internal_Lifecycle_Summary' : 'VYSITE_Lifecycle_Summary';
  return `${prefix}_${tag}.pdf`;
}

const reviewLabels: Record<ReviewStatus, string> = {
  normal: 'NORMAL',
  monitor: 'MONITOR',
  review: 'LIFECYCLE COST REVIEW RECOMMENDED',
};

const reviewColors: Record<ReviewStatus, { bg: string; border: string; text: string }> = {
  normal: { bg: '#ecfdf5', border: '#a7f3d0', text: '#15803d' },
  monitor: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
  review: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
};

const nextDueText: Record<string, string> = {
  up_to_date: 'Up to Date',
  due_soon: 'Due Soon',
  overdue: 'Overdue',
  not_scheduled: 'Not Scheduled',
};

const nextDueColors: Record<string, { bg: string; text: string }> = {
  up_to_date: { bg: '#dcfce7', text: '#15803d' },
  due_soon: { bg: '#fef3c7', text: '#b45309' },
  overdue: { bg: '#fee2e2', text: '#991b1b' },
  not_scheduled: { bg: '#e2e8f0', text: '#64748b' },
};

const warrantyText: Record<string, string> = {
  under: 'Under Warranty',
  expired: 'Warranty Expired',
  not_recorded: 'Not Recorded',
};

const warrantyColors: Record<string, { bg: string; text: string }> = {
  under: { bg: '#dcfce7', text: '#15803d' },
  expired: { bg: '#fee2e2', text: '#991b1b' },
  not_recorded: { bg: '#e2e8f0', text: '#64748b' },
};

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { margin: 0; size: A4; }
body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt; color: #0f172a; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { padding: 40px 52px 36px; min-height: 297mm; }
.page-break { page-break-before: always; }
.no-break { page-break-inside: avoid; }

.doc-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
.doc-brand { font-size: 18pt; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
.doc-brand-sub { font-size: 8pt; color: #64748b; margin-top: 2px; }
.doc-type { font-size: 8pt; font-weight: 700; color: #ea6c00; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
.doc-title { font-size: 14pt; font-weight: 700; color: #0f172a; margin-top: 2px; text-align: right; }
.doc-date { font-size: 8pt; color: #64748b; margin-top: 4px; text-align: right; }

.asset-id-band { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 20px; margin-bottom: 16px; }
.asset-tag { font-size: 9pt; font-weight: 700; color: #ea6c00; font-family: 'Courier New', monospace; }
.asset-name { font-size: 15pt; font-weight: 700; color: #0f172a; margin-top: 2px; }
.asset-type-line { font-size: 9pt; color: #475569; margin-top: 3px; }

.two-col { display: flex; gap: 20px; margin-bottom: 16px; }
.col-left { flex: 0 0 200px; }
.col-right { flex: 1; }
.asset-image-box { width: 200px; height: 150px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f1f5f9; }
.asset-image-box img { width: 100%; height: 100%; object-fit: cover; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 9pt; }
.data-table .label { color: #64748b; font-weight: 600; width: 160px; }
.data-table .value { color: #0f172a; }

.section-label { font-size: 8pt; font-weight: 700; color: #ea6c00; text-transform: uppercase; letter-spacing: 1px; margin: 18px 0 8px; border-bottom: 1px solid #fed7aa; padding-bottom: 4px; }

.kpi-grid { display: flex; gap: 10px; margin-bottom: 16px; }
.kpi-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
.kpi-label { font-size: 7.5pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.kpi-value { font-size: 13pt; font-weight: 700; color: #0f172a; margin-top: 3px; }
.kpi-sub { font-size: 7pt; color: #b45309; margin-top: 2px; }

.review-panel { border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; }
.review-title { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
.review-reason { font-size: 9pt; color: #334155; line-height: 1.5; margin-top: 6px; }
.review-disclaimer { font-size: 7.5pt; color: #94a3b8; margin-top: 8px; font-style: italic; }

.tag { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 8pt; font-weight: 600; }

.list-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.list-table th { text-align: left; padding: 6px 8px; background: #0f172a; color: white; font-weight: 600; font-size: 8pt; }
.list-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; }
.list-table tr:nth-child(even) td { background: #f8fafc; }
.list-table .total-row td { border-top: 2px solid #0f172a; font-weight: 700; color: #0f172a; background: #f1f5f9; }

.bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.bar-year { font-size: 8pt; color: #64748b; font-family: 'Courier New', monospace; width: 40px; }
.bar-track { flex: 1; height: 20px; background: #f1f5f9; border-radius: 4px; overflow: hidden; position: relative; }
.bar-fill { height: 100%; background: #ea6c00; border-radius: 4px; }
.bar-value { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); font-size: 7.5pt; font-weight: 600; color: #0f172a; }

.timeline-grid { display: flex; gap: 8px; }
.timeline-item { flex: 1; text-align: center; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 4px; background: #f8fafc; }
.timeline-label { font-size: 7pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.timeline-date { font-size: 9pt; font-weight: 600; color: #0f172a; margin-top: 3px; }

.data-bar { display: flex; gap: 2px; margin: 4px 0 8px; }
.data-bar-seg { height: 6px; flex: 1; border-radius: 3px; }
.data-bar-present { background: #ea6c00; }
.data-bar-absent { background: #e2e8f0; }
.data-field { display: flex; align-items: center; gap: 6px; font-size: 8pt; }
.data-dot { width: 6px; height: 6px; border-radius: 50%; }
.dot-present { background: #15803d; }
.dot-absent { background: #cbd5e1; }
.data-field-absent { color: #94a3b8; font-style: italic; }

.cond-tag { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 7.5pt; font-weight: 600; }
.cond-Good { background: #dcfce7; color: #15803d; }
.cond-Satisfactory { background: #dbeafe; color: #1d4ed8; }
.cond-Poor { background: #fef3c7; color: #b45309; }
.cond-Critical { background: #fee2e2; color: #991b1b; }
.cond-Not-Assessed { background: #e2e8f0; color: #64748b; }

.doc-footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8; }
.empty-notice { color: #94a3b8; font-style: italic; padding: 8px 0; font-size: 9pt; }
`;

interface AssetSummaryPDFData {
  asset: DBAsset;
  records: DBAssetServiceRecord[];
  calc: SummaryCalc;
  siteName: string;
  buildingName: string;
  locationName: string;
  primaryImageUrl: string | null;
  internal: boolean;
  currentUserName: string;
}

export function exportAssetSummaryPDF(data: AssetSummaryPDFData): void {
  const { asset, records, calc, siteName, buildingName, locationName, primaryImageUrl, internal, currentUserName } = data;
  const today = todayStr();
  const docTypeLabel = internal ? 'Internal Lifecycle Summary' : 'Asset Lifecycle Summary';
  const footerLabel = internal ? 'Confidential \u2014 VYSITE Internal Lifecycle Summary' : 'Powered by VYSITE';
  const reviewColor = reviewColors[calc.review.status];
  const reviewLabel = reviewLabels[calc.review.status];
  const ndu = nextDueColors[calc.nextDueStatus];
  const nduText = nextDueText[calc.nextDueStatus];
  const wc = warrantyColors[calc.warrantyStatus];
  const wcText = warrantyText[calc.warrantyStatus];

  const imageHtml = primaryImageUrl
    ? `<img src="${primaryImageUrl}" alt="${esc(asset.name)}" />`
    : '';
  const imageCol = imageHtml
    ? `<div class="col-left"><div class="asset-image-box">${imageHtml}</div></div>`
    : '';
  const detailsColFlex = imageHtml ? '' : 'flex: 1;';

  const condTag = calc.latestCondition
    ? `<span class="cond-tag cond-${calc.latestCondition.replace(/\s+/g, '-')}">${esc(calc.latestCondition)}</span>`
    : '\u2014';

  // Lifecycle financials shown in both client and internal; Original Asset Cost internal-only
  const lifecycleFinancialKPIs = `
<div class="kpi-grid no-break">
  <div class="kpi-card"><div class="kpi-label">Current Replacement Cost</div><div class="kpi-value">${fmtGBP(asset.current_replacement_cost)}</div></div>
  <div class="kpi-card"><div class="kpi-label">Lifetime Service Spend</div><div class="kpi-value">${fmtGBP(calc.lifetimeSpend)}</div></div>
  <div class="kpi-card"><div class="kpi-label">Spend vs Replacement</div><div class="kpi-value">${calc.spendVsReplacement != null ? (calc.spendVsReplacement * 100).toFixed(1) + '%' : '\u2014'}</div>${calc.spendVsReplacement == null ? '<div class="kpi-sub">Replacement cost required</div>' : ''}</div>
  <div class="kpi-card"><div class="kpi-label">Last 12 Months Spend</div><div class="kpi-value">${fmtGBP(calc.last12Spend)}</div></div>
</div>`;

  const originalCostKPI = internal ? `
<div class="kpi-grid no-break">
  <div class="kpi-card"><div class="kpi-label">Original Asset Cost</div><div class="kpi-value">${fmtGBP(asset.original_asset_cost)}</div></div>
</div>` : '';

  const operationalKPIs = `
<div class="kpi-grid no-break">
  <div class="kpi-card"><div class="kpi-label">Asset Age</div><div class="kpi-value">${fmtAge(calc.ageDate)}</div></div>
  <div class="kpi-card"><div class="kpi-label">Total Records</div><div class="kpi-value">${calc.totalRecords}</div></div>
  <div class="kpi-card"><div class="kpi-label">Reactive Visits (12m)</div><div class="kpi-value">${calc.reactiveCount12m}</div></div>
  <div class="kpi-card"><div class="kpi-label">Breakdowns (12m)</div><div class="kpi-value">${calc.breakdownCount12m}</div></div>
  <div class="kpi-card"><div class="kpi-label">Current Condition</div><div class="kpi-value">${esc(calc.latestCondition) || '\u2014'}</div></div>
</div>`;

  // Lifecycle review reasons
  const reviewReasons = calc.review.reasons.map(r => `<p class="review-reason">${esc(r)}</p>`).join('');
  const reviewDisclaimer = calc.review.status !== 'normal'
    ? '<p class="review-disclaimer">This is decision support based on recorded data. Replacement decisions should consider engineering condition, criticality, operational requirements, compliance, and other factors.</p>'
    : '';

  // Cost breakdown
  const breakdownRows = calc.costBreakdown.length > 0
    ? calc.costBreakdown.map(c => `<tr><td>${esc(c.type)}</td><td style="text-align:right">${c.count}</td><td style="text-align:right">${fmtGBP(c.total)}</td></tr>`).join('') +
      `<tr class="total-row"><td>Total</td><td style="text-align:right">${calc.totalRecords}</td><td style="text-align:right">${fmtGBP(calc.lifetimeSpend)}</td></tr>`
    : `<tr><td colspan="3" class="empty-notice">No service cost data recorded.</td></tr>`;

  // Spend trend bars
  const trendBars = calc.annualSpend.length > 0
    ? (() => {
        const maxVal = Math.max(...calc.annualSpend.map(a => a.total), 1);
        return calc.annualSpend.map(a => {
          const pct = (a.total / maxVal) * 100;
          return `<div class="bar-row"><span class="bar-year">${a.year}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(pct, 2)}%"></div><span class="bar-value">${fmtGBP(a.total)}</span></div></div>`;
        }).join('');
      })()
    : '<p class="empty-notice">No spend data recorded.</p>';

  // Trend comparison
  let trendChangeHtml: string;
  if (calc.trendPct != null) {
    trendChangeHtml = `+${calc.trendPct.toFixed(1)}%`;
  } else if (calc.prev12Spend === 0 && calc.last12Spend > 0) {
    trendChangeHtml = 'Previous period \u00a30';
  } else {
    trendChangeHtml = 'No change';
  }

  // Key dates timeline
  const timelineItems = [
    { label: 'Installed', date: asset.installation_date },
    { label: 'Commissioned', date: asset.commissioning_date },
    { label: 'Warranty Expiry', date: asset.warranty_expiry },
    { label: 'Last Service', date: calc.lastService?.service_date ?? null },
    { label: 'Next Service', date: calc.nextServiceDue },
    { label: 'Today', date: new Date().toISOString().slice(0, 10) },
  ];
  const timelineHtml = `<div class="timeline-grid no-break">${timelineItems.map(t => `<div class="timeline-item"><div class="timeline-label">${t.label}</div><div class="timeline-date">${fmtDate(t.date)}</div></div>`).join('')}</div>`;

  // Data quality
  const dataBarHtml = `<div class="data-bar">${Array.from({ length: calc.dataTotal }).map((_, i) => `<div class="data-bar-seg ${i < calc.dataComplete ? 'data-bar-present' : 'data-bar-absent'}"></div>`).join('')}</div>`;
  const dataFieldsHtml = calc.dataFields.map(f =>
    `<div class="data-field"><div class="data-dot ${f.present ? 'dot-present' : 'dot-absent'}"></div><span class="${f.present ? '' : 'data-field-absent'}">${esc(f.label)}${f.present ? '' : ' not recorded'}</span></div>`
  ).join('');

  // Recent service history — cost column shown in both client and internal
  const recentRows = records.length > 0
    ? records.slice(0, 5).map(r => `<tr>
        <td>${fmtDate(r.service_date)}</td>
        <td>${esc(r.service_type)}</td>
        <td>${r.condition ? `<span class="cond-tag cond-${r.condition.replace(/\s+/g, '-')}">${esc(r.condition)}</span>` : '\u2014'}</td>
        <td>${esc(r.status)}</td>
        <td style="text-align:right">${r.cost != null ? fmtGBP(r.cost) : '\u2014'}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="empty-notice">No Service &amp; Maintenance history recorded.</td></tr>`;

  // ─── PAGE 1 ───
  const page1 = `
<div class="doc-head">
  <div>
    <div class="doc-brand">VYSITE</div>
    <div class="doc-brand-sub">Construction Operating System</div>
  </div>
  <div>
    <div class="doc-type">${esc(docTypeLabel)}</div>
    <div class="doc-title">Asset Lifecycle Summary</div>
    <div class="doc-date">${today}</div>
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
    <div class="section-label" style="margin-top:0">Asset Identity</div>
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

${lifecycleFinancialKPIs}
${originalCostKPI}
${operationalKPIs}

<div class="review-panel no-break" style="background:${reviewColor.bg};border:1px solid ${reviewColor.border};">
  <div class="review-title" style="color:${reviewColor.text};">${reviewLabel}</div>
  ${reviewReasons}
  ${reviewDisclaimer}
</div>
`;

  // ─── PAGE 2 ───
  const page2 = `
<div class="page-break"></div>
<div class="doc-head">
  <div>
    <div class="doc-brand">VYSITE</div>
    <div class="doc-brand-sub">Construction Operating System</div>
  </div>
  <div>
    <div class="doc-type">${esc(docTypeLabel)}</div>
    <div class="doc-title">${esc(asset.asset_tag)} &mdash; Continued</div>
  </div>
</div>

<div class="section-label">Service Position</div>
<table class="data-table no-break">
  <tr><td class="label">Last Service</td><td class="value">${calc.lastService ? fmtDate(calc.lastService.service_date) : '\u2014'}</td>
      <td class="label">Next Service Due</td><td class="value">${fmtDate(calc.nextServiceDue)}</td></tr>
  <tr><td class="label">Service Status</td><td class="value"><span class="tag" style="background:${ndu.bg};color:${ndu.text};">${nduText}</span></td>
      <td class="label">Current Condition</td><td class="value">${condTag}</td></tr>
  <tr><td class="label">Total Service Records</td><td class="value">${calc.totalRecords}</td>
      <td class="label">Reactive Visits (12m)</td><td class="value">${calc.reactiveCount12m}</td></tr>
  <tr><td class="label">Breakdowns (12m)</td><td class="value">${calc.breakdownCount12m}</td><td></td><td></td></tr>
</table>

<div class="section-label">Warranty Status</div>
<table class="data-table no-break">
  <tr><td class="label">Warranty</td><td class="value"><span class="tag" style="background:${wc.bg};color:${wc.text};">${wcText}</span></td>
      <td class="label">Warranty Expiry</td><td class="value">${fmtDate(asset.warranty_expiry)}</td></tr>
</table>

<div class="section-label">Lifecycle Data Completeness</div>
<div class="no-break">
  <p style="font-size:9pt;color:#0f172a;margin-bottom:4px;">${calc.dataComplete} of ${calc.dataTotal} key lifecycle fields available</p>
  ${dataBarHtml}
  ${dataFieldsHtml}
</div>

<div class="section-label">Cost Breakdown by Service Type</div>
<table class="list-table no-break">
  <thead><tr><th>Service Type</th><th style="text-align:right">Records</th><th style="text-align:right">Total Cost</th></tr></thead>
  <tbody>${breakdownRows}</tbody>
</table>
`;

  // ─── PAGE 3 ───
  const page3 = `
<div class="page-break"></div>
<div class="doc-head">
  <div>
    <div class="doc-brand">VYSITE</div>
    <div class="doc-brand-sub">Construction Operating System</div>
  </div>
  <div>
    <div class="doc-type">${esc(docTypeLabel)}</div>
    <div class="doc-title">${esc(asset.asset_tag)} &mdash; Continued</div>
  </div>
</div>

<div class="section-label">Service &amp; Maintenance Spend Over Time</div>
<div class="no-break">${trendBars}</div>

<div style="margin-top:14px;">
  <table class="data-table no-break">
    <tr><td class="label">Last 12 Months Spend</td><td class="value">${fmtGBP(calc.last12Spend)}</td>
        <td class="label">Previous 12 Months Spend</td><td class="value">${fmtGBP(calc.prev12Spend)}</td></tr>
    <tr><td class="label">Change</td><td class="value">${trendChangeHtml}</td><td></td><td></td></tr>
  </table>
</div>

<div class="section-label">Key Dates / Lifecycle Timeline</div>
${timelineHtml}

<div class="section-label">Recent Service History</div>
<table class="list-table no-break">
  <thead><tr><th>Date</th><th>Service Type</th><th>Condition</th><th>Status</th><th style="text-align:right">Cost</th></tr></thead>
  <tbody>${recentRows}</tbody>
</table>

${internal ? `
<div class="section-label">Internal Metadata</div>
<table class="data-table no-break">
  <tr><td class="label">Generated By</td><td class="value">${esc(currentUserName) || '\u2014'}</td>
      <td class="label">Generated At</td><td class="value">${today}</td></tr>
</table>
` : ''}

<div class="doc-footer">
  <div>${esc(footerLabel)}</div>
  <div>${esc(asset.asset_tag)} &bull; ${today}</div>
</div>
`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Asset Lifecycle Summary - ${esc(asset.asset_tag)}</title><style>${CSS}</style><script>window.onload=function(){window.print();};<\/script></head><body><div class="page">${page1}${page2}${page3}</div></body></html>`;
  openPrintTab(html);
}
