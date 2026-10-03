import { openPrintTab, vysiteLogoUrl } from '../../lib/printTab';
import type { DBAsset, DBAssetSite, DBAssetBuilding, DBAssetLocation } from './types';

function esc(v: unknown): string {
  const s = v == null ? '' : String(v);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusTagClass(status: string): string {
  if (status === 'Active') return 'tag-active';
  if (status === 'Out of Service') return 'tag-out';
  if (status === 'Under Repair') return 'tag-repair';
  if (status === 'Replaced') return 'tag-replaced';
  return 'tag-decomm';
}

const REGISTER_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { margin: 0; size: A4 landscape; }
body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 8pt; color: #0f172a; background: white;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.page { padding: 30px 40px 24px; min-height: 210mm; }

.doc-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
.doc-brand { font-size: 16pt; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
.doc-brand-sub { font-size: 7.5pt; color: #64748b; margin-top: 2px; }
.doc-logo { height: 24px; width: auto; object-fit: contain; display: block; }
.doc-type { font-size: 7.5pt; font-weight: 700; color: #ea6c00; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
.doc-title { font-size: 13pt; font-weight: 700; color: #0f172a; margin-top: 2px; text-align: right; }
.doc-date { font-size: 7.5pt; color: #64748b; margin-top: 4px; text-align: right; }

.filter-band { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 16px; margin-bottom: 14px; }
.filter-row { display: flex; gap: 24px; flex-wrap: wrap; }
.filter-item { font-size: 8pt; }
.filter-label { color: #64748b; font-weight: 600; margin-right: 4px; }
.filter-value { color: #0f172a; }
.filter-summary { margin-top: 6px; font-size: 8pt; color: #475569; }

.tag { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 7.5pt; font-weight: 600; }
.tag-active { background: #dcfce7; color: #15803d; }
.tag-out { background: #fef3c7; color: #b45309; }
.tag-repair { background: #ffedd5; color: #c2410c; }
.tag-replaced { background: #dbeafe; color: #1d4ed8; }
.tag-decomm { background: #e2e8f0; color: #64748b; }

.reg-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
.reg-table th { text-align: left; padding: 6px 8px; background: #0f172a; color: white; font-weight: 600; font-size: 7.5pt; white-space: nowrap; }
.reg-table td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; }
.reg-table tr:nth-child(even) td { background: #f8fafc; }
.reg-table .tag-cell { white-space: nowrap; }
.reg-table .tag-code { font-family: 'Courier New', monospace; font-weight: 600; color: #ea6c00; }

.doc-footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 7pt; color: #94a3b8; }
.empty-notice { color: #94a3b8; font-style: italic; padding: 20px 0; text-align: center; font-size: 9pt; }
`;

interface RegisterPDFData {
  assets: DBAsset[];
  sites: DBAssetSite[];
  buildings: DBAssetBuilding[];
  locations: DBAssetLocation[];
  filters: {
    site: string | null;
    building: string | null;
    type: string | null;
    status: string | null;
    search: string | null;
  };
  currentUserName: string;
}

export function exportAssetRegisterPDF(data: RegisterPDFData): void {
  const { assets, sites, buildings, locations, filters, currentUserName } = data;
  const today = todayStr();

  function siteName(id: string | null) { return id ? sites.find(s => s.id === id)?.name ?? '\u2014' : '\u2014'; }
  function buildingName(id: string | null) { return id ? buildings.find(b => b.id === id)?.name ?? '\u2014' : '\u2014'; }
  function locationName(id: string | null) { return id ? locations.find(l => l.id === id)?.name ?? '\u2014' : '\u2014'; }

  const filterItems: string[] = [];
  if (filters.site) filterItems.push(`<div class="filter-item"><span class="filter-label">Site:</span><span class="filter-value">${esc(siteName(filters.site))}</span></div>`);
  if (filters.building) filterItems.push(`<div class="filter-item"><span class="filter-label">Building:</span><span class="filter-value">${esc(buildingName(filters.building))}</span></div>`);
  if (filters.type) filterItems.push(`<div class="filter-item"><span class="filter-label">Type:</span><span class="filter-value">${esc(filters.type)}</span></div>`);
  if (filters.status) filterItems.push(`<div class="filter-item"><span class="filter-label">Status:</span><span class="filter-value">${esc(filters.status)}</span></div>`);
  if (filters.search) filterItems.push(`<div class="filter-item"><span class="filter-label">Search:</span><span class="filter-value">"${esc(filters.search)}"</span></div>`);

  const subtitle = filterItems.length > 0 ? 'Filtered Asset Register' : 'Asset Register';

  const rows = assets.length > 0
    ? assets.map(a => `<tr>
        <td class="tag-code">${esc(a.asset_tag)}</td>
        <td>${esc(a.name)}</td>
        <td>${esc(a.asset_type)}</td>
        <td>${esc(a.manufacturer) || '\u2014'}</td>
        <td>${esc(a.model) || '\u2014'}</td>
        <td>${esc(a.serial_number) || '\u2014'}</td>
        <td>${esc(siteName(a.site_id))}</td>
        <td>${esc(buildingName(a.building_id))}</td>
        <td>${esc(locationName(a.location_id))}</td>
        <td class="tag-cell"><span class="tag ${statusTagClass(a.status)}">${esc(a.status)}</span></td>
      </tr>`).join('')
    : `<tr><td colspan="10" class="empty-notice">No assets match the current filters.</td></tr>`;

  const filterHtml = filterItems.length > 0
    ? `<div class="filter-band"><div class="filter-row">${filterItems.join('')}</div></div>`
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Asset Register</title><style>${REGISTER_CSS}</style><script>window.onload=function(){window.print();};<\/script></head><body><div class="page">
<div class="doc-head">
  <div>
    <img class="doc-logo" src="${vysiteLogoUrl()}" alt="VYSITE" />
    <div class="doc-brand-sub">Construction Operating System</div>
  </div>
  <div>
    <div class="doc-type">Asset Management</div>
    <div class="doc-title">${esc(subtitle)}</div>
    <div class="doc-date">${today} &middot; ${esc(currentUserName || 'VYSITE')}</div>
  </div>
</div>

${filterHtml}

<div class="filter-summary">Total Assets: <strong>${assets.length}</strong> &middot; Export Date: ${today}</div>

<table class="reg-table">
  <thead><tr>
    <th>Asset Tag</th><th>Asset Name</th><th>Type</th><th>Manufacturer</th><th>Model</th><th>Serial</th>
    <th>Site</th><th>Building</th><th>Location</th><th>Status</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="doc-footer">
  <div>Confidential &mdash; VYSITE Asset Register</div>
  <div>${esc(currentUserName || 'VYSITE')} &bull; ${today}</div>
</div>
</div></body></html>`;

  openPrintTab(html);
}
