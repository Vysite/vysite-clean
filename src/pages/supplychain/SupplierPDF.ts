/**
 * Supplier Summary PDF export.
 * Uses the VYSITE COMM_PDF_CSS design standard and openPrintTab pattern.
 * Designed for future extension: Full Supplier Pack can append supporting
 * documents in the same assembly pattern used by the O&M module.
 */

import { COMM_PDF_CSS, esc, fmtD } from '../commercial/CommercialPDF';
import { openPrintTab } from '../../lib/printTab';
import type {
  DBSupplier, DBSupplierDocument, DBSupplierLabourRate, DBSupplierPqqResponse,
} from './types';
import { PQQ_SECTIONS } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fv(n: number | null | undefined): string {
  if (n == null) return '—';
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function rate(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  return '£' + n.toFixed(2);
}

function chips(items: string[]): string {
  if (!items.length) return '<span style="color:#94a3b8">None recorded</span>';
  return items.map(i => `<span class="chip">${esc(i)}</span>`).join('');
}

function metaItem(label: string, value: string): string {
  return `<div class="proj-meta-item"><div class="proj-meta-label">${esc(label)}</div><div class="proj-meta-value">${value || '—'}</div></div>`;
}

function sectionLabel(title: string): string {
  return `<div class="exec-section-label">${esc(title)}</div>`;
}

function todayLong(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function supplierRef(id: string): string {
  return 'SUP-' + id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
}

// ─── Supplemental CSS ─────────────────────────────────────────────────────────

const SUPP_CSS = `
.chip {
  display: inline-block; background: #f1f5f9; color: #334155;
  border-radius: 3px; padding: 2px 7px 3px; font-size: 7.5pt;
  font-weight: 600; margin: 2px 3px 2px 0;
}
.chip.green  { background: #f0fdf4; color: #166534; }
.chip.amber  { background: #fffbeb; color: #92400e; }
.chip.orange { background: #fff7ed; color: #c2410c; }
.chip.red    { background: #fef2f2; color: #991b1b; }

.pqq-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.pqq-cell { padding: 5px 6px; border-radius: 3px; font-size: 7pt; font-weight: 600; text-align: center; }
.pqq-cell.complete   { background: #f0fdf4; color: #166534; }
.pqq-cell.progress   { background: #fffbeb; color: #92400e; }
.pqq-cell.na         { background: #f8fafc; color: #94a3b8; }
.pqq-cell.not-started { background: #f8fafc; color: #94a3b8; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 40px; }
.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 24px; }

.info-block { margin-bottom: 12px; }
.info-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
.info-value { font-size: 9pt; color: #0f172a; font-weight: 500; }

.doc-row { display: flex; align-items: baseline; gap: 12px; padding: 7px 0; border-bottom: 0.5px solid #f1f5f9; }
.doc-row:last-child { border-bottom: none; }
.doc-title { flex: 1; font-size: 8.5pt; font-weight: 600; color: #0f172a; }
.doc-cat   { font-size: 7pt; color: #475569; width: 90px; shrink-0 }
.doc-dates { font-size: 7pt; color: #475569; text-align: right; min-width: 120px; }
.doc-dates.expired { color: #dc2626; font-weight: 700; }
.doc-dates.expiring { color: #d97706; font-weight: 700; }

.pack-note {
  margin-top: 44px; padding: 10px 14px; border-left: 3px solid #e2e8f0;
  background: #f8fafc; font-size: 7pt; color: #64748b; border-radius: 0 4px 4px 0;
}
`;

// ─── Main export ──────────────────────────────────────────────────────────────

export interface SupplierSummaryData {
  supplier: DBSupplier;
  tradeNames: string[];
  specialismNames: string[];
  labourRates: DBSupplierLabourRate[];
  rateTypeNames: Map<string, string>;
  pqqResponses: DBSupplierPqqResponse[];
  documents: DBSupplierDocument[];
  orgLogo?: string;
}

export function exportSupplierSummaryPdf(data: SupplierSummaryData): void {
  const { supplier: s, tradeNames, specialismNames, labourRates, rateTypeNames, pqqResponses, documents, orgLogo } = data;

  const ref = supplierRef(s.id);

  // ── Header ─────────────────────────────────────────────────────────────────
  const brandHtml = orgLogo
    ? `<img src="${orgLogo}" alt="Logo" style="height:32px;max-width:140px;object-fit:contain;display:block">`
    : `<div class="exec-brand">VYSITE</div><div class="exec-brand-sub">Construction Operating System</div>`;

  const header = `
<div class="exec-head">
  <div>${brandHtml}</div>
  <div class="exec-head-right">
    <div class="exec-doc-type">Supply Chain</div>
    <div class="exec-doc-title">Supplier Summary</div>
  </div>
</div>`;

  // ── Company band ───────────────────────────────────────────────────────────
  const approvalTag = () => {
    const a = s.approval_status;
    const cls = a === 'Approved' ? 'tag-green' : a === 'Rejected' || a === 'Suspended' ? 'tag-red' : a === 'Conditionally Approved' ? 'tag-blue' : 'tag-amber';
    return `<span class="tag ${cls}">${esc(a)}</span>`;
  };

  const companyBand = `
<div class="exec-project-band">
  <div>
    <div class="exec-project-name">${esc(s.company_name)}</div>
    ${s.trading_name && s.trading_name !== s.company_name ? `<div class="exec-client">t/a ${esc(s.trading_name)}</div>` : ''}
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      ${approvalTag()}
      ${s.preferred_supplier ? '<span class="tag tag-amber">&#9733; Preferred Supplier</span>' : ''}
      ${s.supplier_type ? `<span class="tag tag-slate">${esc(s.supplier_type)}</span>` : ''}
    </div>
  </div>
  <div class="exec-report-date">
    <div><strong>Reference</strong> ${esc(ref)}</div>
    <div><strong>Generated</strong> ${todayLong()}</div>
    ${s.approval_date ? `<div><strong>Approved</strong> ${fmtD(s.approval_date)}</div>` : ''}
  </div>
</div>`;

  // ── Company Details ────────────────────────────────────────────────────────
  const regAddr = [s.reg_address_line1, s.reg_address_line2, s.reg_address_city, s.reg_address_county, s.reg_address_postcode, s.reg_address_country].filter(Boolean).join(', ');
  const tradeAddr = s.trading_address_same ? regAddr : [s.trade_address_line1, s.trade_address_line2, s.trade_address_city, s.trade_address_county, s.trade_address_postcode, s.trade_address_country].filter(Boolean).join(', ');

  const companyDetails = `
${sectionLabel('Company Details')}
<div class="two-col" style="margin-bottom:24px">
  <div>
    ${metaItem('Company Registration No.', s.company_number)}
    ${metaItem('VAT Number', s.vat_number)}
    ${metaItem('UTR Number', s.utr_number)}
    ${metaItem('Website', s.website)}
    ${metaItem('Registered Address', regAddr)}
    ${s.trading_address_same ? '' : metaItem('Trading Address', tradeAddr)}
  </div>
  <div>
    ${metaItem('General Telephone', s.general_telephone)}
    ${metaItem('General Email', s.general_email)}
    ${metaItem('Primary Contact', s.primary_contact)}
    ${metaItem('Position', s.contact_position)}
    ${metaItem('Mobile', s.mobile_number)}
  </div>
</div>`;

  // ── Classification ─────────────────────────────────────────────────────────
  const classification = `
${sectionLabel('Classification & Coverage')}
<div class="three-col" style="margin-bottom:20px">
  <div>
    <div class="info-label">Trades</div>
    <div style="margin-top:4px">${chips(tradeNames)}</div>
  </div>
  <div>
    <div class="info-label">Specialisms</div>
    <div style="margin-top:4px">${chips(specialismNames)}</div>
  </div>
  <div>
    <div class="info-label">Geographic Coverage</div>
    <div style="margin-top:4px">${chips(s.regions)}</div>
  </div>
</div>
<div class="three-col" style="margin-bottom:24px">
  ${metaItem('Minimum Package Value', fv(s.min_package_value))}
  ${metaItem('Preferred Package Value', fv(s.preferred_package_value))}
  ${metaItem('Maximum Package Value', fv(s.max_package_value))}
</div>`;

  // ── Labour Rates ───────────────────────────────────────────────────────────
  let labourRatesHtml = '';
  if (labourRates.length > 0) {
    const rows = labourRates.map(lr => {
      const name = rateTypeNames.get(lr.rate_type_id) ?? lr.rate_type_id;
      const hasAny = lr.standard_rate || lr.overtime_rate || lr.weekend_rate || lr.night_rate;
      if (!hasAny) return '';
      return `<tr>
        <td class="dt-title">${esc(name)}</td>
        <td class="r">${rate(lr.standard_rate)}</td>
        <td class="r">${rate(lr.overtime_rate)}</td>
        <td class="r">${rate(lr.weekend_rate)}</td>
        <td class="r">${rate(lr.night_rate)}</td>
      </tr>`;
    }).filter(Boolean).join('');

    if (rows) {
      labourRatesHtml = `
${sectionLabel('Labour Rates')}
<table class="data-table" style="margin-bottom:24px">
  <thead>
    <tr>
      <th>Role / Category</th>
      <th class="r">Standard</th>
      <th class="r">Overtime</th>
      <th class="r">Weekend</th>
      <th class="r">Night</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
    }
  }

  // ── PQQ Summary ────────────────────────────────────────────────────────────
  const pqqComplete = pqqResponses.filter(r => r.section_status === 'complete').length;
  const pqqPct = Math.round((pqqComplete / PQQ_SECTIONS.length) * 100);
  const pqqCells = PQQ_SECTIONS.map(s => {
    const resp = pqqResponses.find(r => r.section_key === s.key);
    const status = resp?.section_status ?? 'not_started';
    const cls = status === 'complete' ? 'complete' : status === 'in_progress' ? 'progress' : status === 'na' ? 'na' : 'not-started';
    const label = status === 'complete' ? '&#10003; ' : status === 'in_progress' ? '&#8230; ' : '';
    return `<div class="pqq-cell ${cls}">${label}${esc(s.title)}</div>`;
  }).join('');

  const pqqSummary = `
${sectionLabel('PQQ Completion Summary')}
<div style="margin-bottom:12px;display:flex;align-items:center;gap:16px">
  <div style="font-size:18pt;font-weight:700;color:${pqqPct === 100 ? '#16a34a' : pqqPct > 50 ? '#d97706' : '#0f172a'};font-variant-numeric:tabular-nums">${pqqComplete}/${PQQ_SECTIONS.length}</div>
  <div>
    <div style="font-size:8pt;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Sections Complete — ${pqqPct}%</div>
    <div style="background:#f1f5f9;border-radius:2px;height:6px;width:200px">
      <div style="background:${pqqPct === 100 ? '#16a34a' : '#ea6c00'};height:6px;border-radius:2px;width:${pqqPct}%"></div>
    </div>
  </div>
</div>
<div class="pqq-grid" style="margin-bottom:24px">${pqqCells}</div>`;

  // ── Insurance & Compliance (from PQQ responses) ───────────────────────────
  const insResp = pqqResponses.find(r => r.section_key === 'insurance')?.responses ?? {};
  const accResp = pqqResponses.find(r => r.section_key === 'accreditations')?.responses ?? {};
  const hsResp  = pqqResponses.find(r => r.section_key === 'health_safety')?.responses ?? {};

  function yesno(val: unknown): string {
    if (val === true || val === 'yes') return '<span class="tag tag-green">Yes</span>';
    if (val === false || val === 'no') return '<span class="tag tag-red">No</span>';
    if (val === 'na') return '<span class="tag tag-slate">N/A</span>';
    return val ? `<span style="font-size:8pt;color:#1e293b">${esc(String(val))}</span>` : '—';
  }

  const complianceSection = `
${sectionLabel('Insurance & Compliance')}
<div class="two-col" style="margin-bottom:8px">
  <div>
    <div class="info-label" style="margin-bottom:6px">Insurance</div>
    ${metaItem('Public Liability Limit', insResp['pl_limit'] ? fv(Number(insResp['pl_limit'])) : '—')}
    ${metaItem('PL Insurer', String(insResp['pl_insurer'] ?? '—'))}
    ${metaItem('PL Expiry', fmtD(String(insResp['pl_expiry'] ?? '')))}
    ${metaItem("Employer's Liability Limit", insResp['el_limit'] ? fv(Number(insResp['el_limit'])) : '—')}
    ${metaItem('EL Insurer', String(insResp['el_insurer'] ?? '—'))}
    ${metaItem('EL Expiry', fmtD(String(insResp['el_expiry'] ?? '')))}
    ${metaItem('Professional Indemnity Limit', insResp['pi_limit'] ? fv(Number(insResp['pi_limit'])) : '—')}
    ${metaItem('PI Expiry', fmtD(String(insResp['pi_expiry'] ?? '')))}
  </div>
  <div>
    <div class="info-label" style="margin-bottom:6px">Accreditations & H&amp;S</div>
    ${metaItem('CHAS', yesno(accResp['chas']))}
    ${metaItem('CHAS Expiry', fmtD(String(accResp['chas_expiry'] ?? '')))}
    ${metaItem('Constructionline', yesno(accResp['constructionline']))}
    ${metaItem('NICEIC / ECA / NAPIT', yesno(accResp['niceic']))}
    ${metaItem('Gas Safe', yesno(accResp['gas_safe']))}
    ${metaItem('H&S Policy', yesno(hsResp['hs_policy']))}
    ${metaItem('H&S Accreditation', String(hsResp['hs_accreditation'] ?? '—'))}
    ${metaItem('Other Accreditations', String(accResp['other_accreditations'] ?? '—'))}
  </div>
</div>`;

  // ── Document Register ─────────────────────────────────────────────────────
  let docRegisterHtml = '';
  if (documents.length > 0) {
    const now = Date.now();
    const rows = documents.map(doc => {
      const expMs = doc.expiry_date ? new Date(doc.expiry_date).getTime() : null;
      const expired = expMs ? expMs < now : false;
      const expiring = expMs ? !expired && (expMs - now) / 86400000 <= 30 : false;
      const dateCls = expired ? 'expired' : expiring ? 'expiring' : '';
      return `<div class="doc-row">
        <div class="doc-title">${esc(doc.document_title)}</div>
        <div class="doc-cat">${esc(doc.document_category)}</div>
        <div class="doc-dates ${dateCls}">
          ${doc.issue_date ? `Issued ${fmtD(doc.issue_date)}&nbsp;&nbsp;` : ''}
          ${doc.expiry_date ? `Expires ${fmtD(doc.expiry_date)}` : ''}
          ${expired ? ' &#9888; EXPIRED' : expiring ? ' &#9888; Expiring' : ''}
        </div>
      </div>`;
    }).join('');
    docRegisterHtml = `
${sectionLabel('Document Register')}
<div style="margin-bottom:24px">${rows}</div>`;
  }

  // ── Review & Approval ─────────────────────────────────────────────────────
  const approvalSection = `
${sectionLabel('Review & Approval')}
<div class="proj-meta" style="margin-bottom:24px">
  ${metaItem('Approval Status', `${approvalTag()}`)}
  ${metaItem('Approval Date', fmtD(s.approval_date))}
  ${metaItem('Approved By', s.approved_by)}
  ${metaItem('PQQ Status', s.pqq_status)}
</div>
${s.approval_notes ? `<div style="font-size:8.5pt;color:#1e293b;padding:10px 14px;background:#f8fafc;border-left:3px solid #e2e8f0;border-radius:0 4px 4px 0;margin-bottom:24px;line-height:1.5">${esc(s.approval_notes)}</div>` : ''}`;

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footer = `
<div class="doc-footer">
  <div class="doc-footer-l">
    ${orgLogo ? '<span style="color:#94a3b8">Powered by </span><span style="font-weight:700;color:#ea6c00">VYSITE</span><span style="color:#94a3b8"> Construction Operating System &nbsp;·&nbsp; </span>' : ''}VYSITE · Supply Chain · ${esc(ref)} · ${esc(s.company_name)}
  </div>
  <div class="doc-footer-r">Generated ${todayLong()}</div>
</div>
<div class="pack-note">
  <strong>Full Supplier Pack:</strong> This Supplier Summary can be extended to include selected supporting documents
  using the VYSITE document assembly process — equivalent to the O&amp;M Manual pack builder.
  To produce a Full Supplier Pack, use the Export Supplier Pack action when available.
</div>`;

  // ── Assemble ───────────────────────────────────────────────────────────────
  const body = [
    header, companyBand, companyDetails, classification,
    labourRatesHtml,
    pqqSummary, complianceSection, docRegisterHtml, approvalSection, footer,
  ].join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Supplier Summary — ${esc(s.company_name)}</title>
<style>${COMM_PDF_CSS}${SUPP_CSS}</style>
<script>window.onload=function(){window.print();};<\/script>
</head>
<body><div class="page">${body}</div></body>
</html>`;

  openPrintTab(html);
}
