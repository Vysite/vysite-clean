/**
 * PQQ Template Generator.
 * Produces a pre-filled questionnaire as either:
 *   • PDF — via openPrintTab (browser print dialog → save as PDF)
 *   • Word — via HTML-to-Word blob download (.doc)
 *
 * All 12 PQQ sections defined in types.ts are included.
 * Where supplier data is already known it is pre-filled.
 * A unique supplier reference on the cover allows completed questionnaires
 * to be matched back to the correct supplier record on upload.
 */

import { openPrintTab } from '../../lib/printTab';
import { esc } from '../commercial/CommercialPDF';
import type { DBSupplier, DBSupplierPqqResponse } from './types';
import { PQQ_SECTIONS, REGIONS } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function supplierRef(id: string): string {
  return 'SUP-' + id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
}

function fmtValFor(val: unknown): string {
  if (val == null || val === '') return '';
  if (val === true || val === 'yes') return 'Yes';
  if (val === false || val === 'no') return 'No';
  if (val === 'na') return 'N/A';
  return String(val);
}

function fv(n: number | null | undefined): string {
  if (n == null) return '';
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── Shared PQQ CSS ───────────────────────────────────────────────────────────

const PQQ_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { margin: 0; size: A4; }
@media print {
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page-break { page-break-before: always; padding-top: 36px; }
}
html, body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9pt; color: #0f172a; background: #fff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.page { padding: 40px 52px 36px; }

/* ── Brand header ── */
.pqq-header {
  display: flex; align-items: flex-end; justify-content: space-between;
  padding-bottom: 14px; border-bottom: 1.5px solid #0f172a; margin-bottom: 28px;
}
.brand-name { font-size: 10pt; font-weight: 900; letter-spacing: 0.18em; color: #ea6c00; text-transform: uppercase; }
.brand-sub  { font-size: 6.5pt; color: #475569; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3px; }
.doc-type { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #475569; }
.doc-title { font-size: 11pt; font-weight: 700; color: #0f172a; }

/* ── Cover page ── */
.cover-block {
  border: 1.5px solid #0f172a; padding: 32px 40px; margin: 40px 0 28px;
}
.cover-main-title {
  font-size: 24pt; font-weight: 700; color: #0f172a;
  letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 6px;
}
.cover-subtitle { font-size: 10pt; color: #334155; margin-bottom: 28px; }
.cover-meta-row { display: flex; gap: 40px; padding: 14px 0; border-top: 0.5px solid #e2e8f0; }
.cover-meta-item { flex: 1; }
.cover-meta-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; margin-bottom: 3px; }
.cover-meta-value { font-size: 9.5pt; font-weight: 600; color: #0f172a; }
.cover-ref { font-size: 9pt; font-weight: 700; color: #ea6c00; font-family: monospace; letter-spacing: 0.08em; }

/* ── Instructions block ── */
.instructions {
  background: #f8fafc; border-left: 3px solid #ea6c00;
  padding: 14px 16px; margin-bottom: 24px; font-size: 8.5pt; color: #334155; line-height: 1.6;
}
.instructions strong { color: #0f172a; }

/* ── Section headings ── */
.section-heading {
  font-size: 11pt; font-weight: 700; color: #0f172a;
  padding: 10px 0 8px; border-bottom: 1.5px solid #0f172a; margin-bottom: 18px;
  display: flex; align-items: baseline; justify-content: space-between;
}
.section-num {
  font-size: 7pt; font-weight: 800; letter-spacing: 0.14em;
  text-transform: uppercase; color: #ea6c00; margin-right: 10px;
}
.section-label { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; }

/* ── Fields ── */
.field-row { margin-bottom: 14px; }
.field-label {
  font-size: 7pt; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: #475569; margin-bottom: 4px;
  display: flex; gap: 6px; align-items: baseline;
}
.field-req { color: #ea6c00; font-size: 8pt; line-height: 1; }
.field-input {
  width: 100%; border: none; border-bottom: 1px solid #cbd5e1;
  padding: 4px 0 3px; font-size: 9pt; color: #0f172a;
  background: transparent; font-family: inherit; min-height: 22px;
}
.field-input.multiline {
  border: 1px solid #cbd5e1; padding: 5px 7px; height: 44px;
  border-radius: 2px; vertical-align: top; resize: none;
}
.field-input.prefilled { color: #0f172a; font-weight: 500; }

/* ── Yes / No / NA toggle row ── */
.yesno-row { display: flex; gap: 8px; margin-top: 2px; }
.yesno-box {
  border: 1px solid #cbd5e1; border-radius: 2px; padding: 4px 14px;
  font-size: 8pt; font-weight: 600; color: #475569; min-width: 50px; text-align: center;
}
.yesno-box.selected { border-color: #0f172a; background: #0f172a; color: #fff; }
.yesno-box.selected.yes { background: #166534; border-color: #166534; }
.yesno-box.selected.no  { background: #991b1b; border-color: #991b1b; }
.yesno-box.selected.na  { background: #475569; border-color: #475569; }

/* ── Two-col field grid ── */
.fields-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px; }
.fields-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 24px; }

/* ── Regions checklist ── */
.regions-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 16px; margin-top: 4px; }
.check-item { display: flex; align-items: center; gap: 6px; font-size: 8.5pt; color: #334155; padding: 3px 0; }
.check-box {
  width: 12px; height: 12px; border: 1.5px solid #cbd5e1; border-radius: 1px;
  shrink-0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.check-box.checked { border-color: #0f172a; background: #0f172a; }
.check-box.checked::after { content: '✓'; color: #fff; font-size: 8px; line-height: 1; }

/* ── Labour rates table ── */
.rates-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.rates-table th {
  font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: #475569; text-align: left; padding: 5px 10px 5px 0; border-bottom: 1px solid #0f172a;
}
.rates-table th.r { text-align: right; padding-left: 10px; padding-right: 0; }
.rates-table td { padding: 6px 10px 6px 0; border-bottom: 0.5px solid #f1f5f9; vertical-align: middle; color: #0f172a; }
.rates-table td.r { text-align: right; padding-left: 10px; padding-right: 0; }
.rate-field {
  width: 72px; border: none; border-bottom: 1px solid #cbd5e1;
  padding: 3px 0; text-align: right; font-size: 8.5pt; font-family: inherit;
  background: transparent; color: #0f172a;
}
.rate-field.prefilled { color: #0f172a; font-weight: 500; }

/* ── Supporting docs ── */
.support-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.support-table th {
  font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: #475569; padding: 5px 10px 5px 0; border-bottom: 1px solid #0f172a; text-align: left;
}
.support-table td { padding: 8px 10px 8px 0; border-bottom: 0.5px solid #f1f5f9; vertical-align: top; }
.include-cell { width: 60px; text-align: center; }
.incl-box { width: 14px; height: 14px; border: 1.5px solid #cbd5e1; border-radius: 1px; margin: 0 auto; }

/* ── Declaration ── */
.declaration-box {
  border: 1px solid #0f172a; padding: 16px 20px; margin-top: 16px;
  font-size: 8pt; color: #334155; line-height: 1.6; background: #f8fafc;
}
.sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0 40px; margin-top: 20px; }
.sig-line {
  border-bottom: 1px solid #0f172a; padding-bottom: 22px; margin-bottom: 4px;
}
.sig-label { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; }

/* ── Footer ── */
.doc-footer {
  margin-top: 32px; padding-top: 10px; border-top: 0.5px solid #e2e8f0;
  display: flex; align-items: center; justify-content: space-between;
}
.doc-footer-l { font-size: 7pt; color: #475569; }
.doc-footer-r { font-size: 7pt; color: #475569; text-align: right; }

/* ── Page break ── */
.page-break { page-break-before: always; padding-top: 40px; }
`;

// ─── Field renderer ───────────────────────────────────────────────────────────

function renderField(
  field: { id: string; label: string; type: string },
  prefillValue: unknown,
): string {
  const filled = prefillValue != null && prefillValue !== '';
  const val = fmtValFor(prefillValue);
  const req = ''; // Not marking required in template for cleaner look

  switch (field.type) {
    case 'yesno':
    case 'yesnona': {
      const isYes = prefillValue === true || prefillValue === 'yes';
      const isNo  = prefillValue === false || prefillValue === 'no';
      const isNa  = prefillValue === 'na';
      return `<div class="field-row">
        <div class="field-label">${esc(field.label)}${req}</div>
        <div class="yesno-row">
          <div class="yesno-box${isYes ? ' selected yes' : ''}">Yes</div>
          <div class="yesno-box${isNo  ? ' selected no'  : ''}">No</div>
          ${field.type === 'yesnona' ? `<div class="yesno-box${isNa ? ' selected na' : ''}">N/A</div>` : ''}
        </div>
      </div>`;
    }
    case 'date':
    case 'text':
    case 'number': {
      return `<div class="field-row">
        <div class="field-label">${esc(field.label)}${req}</div>
        <div class="field-input${filled ? ' prefilled' : ''}">${esc(val)}&nbsp;</div>
      </div>`;
    }
    default:
      return `<div class="field-row">
        <div class="field-label">${esc(field.label)}</div>
        <div class="field-input">&nbsp;</div>
      </div>`;
  }
}

// ─── Build PQQ HTML ───────────────────────────────────────────────────────────

interface PqqTemplateData {
  supplier: DBSupplier;
  pqqResponses: DBSupplierPqqResponse[];
  tradeNames: string[];
  specialismNames: string[];
  rateTypeNames: Map<string, string>;
  labourRates: Array<{ rate_type_id: string; standard_rate: number | null; overtime_rate: number | null; weekend_rate: number | null; night_rate: number | null }>;
}

function buildPqqHtml(data: PqqTemplateData, forWord: boolean): string {
  const { supplier: s, pqqResponses, tradeNames, specialismNames, rateTypeNames, labourRates } = data;
  const ref = supplierRef(s.id);

  // ── Shared page header ───────────────────────────────────────────────────
  function pageHeader(): string {
    return `<div class="pqq-header">
  <div><div class="brand-name">VYSITE</div><div class="brand-sub">Construction Operating System</div></div>
  <div style="text-align:right"><div class="doc-type">Supply Chain Assessment</div><div class="doc-title">Pre-Qualification Questionnaire</div></div>
</div>`;
  }

  // ── Cover page ───────────────────────────────────────────────────────────
  const cover = `${pageHeader()}
<div style="padding-top:20px">
  <div class="cover-block">
    <div class="cover-main-title">Pre-Qualification<br>Questionnaire</div>
    <div class="cover-subtitle">Construction Supply Chain Assessment</div>
    <div class="cover-meta-row">
      <div class="cover-meta-item">
        <div class="cover-meta-label">Supplier Reference</div>
        <div class="cover-meta-value cover-ref">${esc(ref)}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Company Name</div>
        <div class="cover-meta-value">${esc(s.company_name) || '____________________________'}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Date Issued</div>
        <div class="cover-meta-value">${todayStr()}</div>
      </div>
    </div>
    <div class="cover-meta-row" style="border-top:0.5px solid #e2e8f0">
      <div class="cover-meta-item">
        <div class="cover-meta-label">Return Completed PQQ To</div>
        <div class="cover-meta-value" style="color:#475569">VYSITE · Supply Chain Portal</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Return By</div>
        <div class="cover-meta-value" style="color:#475569">____________________________</div>
      </div>
    </div>
  </div>

  <div class="instructions">
    <strong>Instructions for Completion</strong><br><br>
    Please complete all sections of this questionnaire as fully as possible.
    Sections marked with supporting document requirements should be accompanied by the relevant certificates and policies.<br><br>
    • All information provided must be accurate and up to date at the time of submission.<br>
    • Where a question is not applicable to your organisation, select N/A and provide a brief explanation in the notes field.<br>
    • Incomplete submissions may delay assessment. Please contact us if you have any queries.<br>
    • Quote your <strong>Supplier Reference (${esc(ref)})</strong> on all correspondence and on the returned questionnaire cover.
  </div>
</div>`;

  // ── Section 0: Company Overview (pre-filled summary) ─────────────────────
  const regAddr = [s.reg_address_line1, s.reg_address_line2, s.reg_address_city, s.reg_address_county, s.reg_address_postcode, s.reg_address_country].filter(Boolean).join(', ');
  const tradeAddr = s.trading_address_same ? 'Same as Registered' : [s.trade_address_line1, s.trade_address_line2, s.trade_address_city, s.trade_address_county, s.trade_address_postcode, s.trade_address_country].filter(Boolean).join(', ');

  const overviewSection = `
<div class="${forWord ? 'page-break' : 'page-break'}">
${pageHeader()}
<div class="section-heading">
  <div><span class="section-num">Section 0</span>Applicant Details</div>
  <div class="section-label">Pre-filled from VYSITE record — please verify</div>
</div>
<div class="fields-2col">
  <div>
    <div class="field-row"><div class="field-label">Company Name</div><div class="field-input prefilled">${esc(s.company_name)}&nbsp;</div></div>
    <div class="field-row"><div class="field-label">Trading Name (if different)</div><div class="field-input${s.trading_name ? ' prefilled' : ''}">${esc(s.trading_name)}&nbsp;</div></div>
    <div class="field-row"><div class="field-label">Company Registration Number</div><div class="field-input${s.company_number ? ' prefilled' : ''}">${esc(s.company_number)}&nbsp;</div></div>
    <div class="field-row"><div class="field-label">VAT Number</div><div class="field-input${s.vat_number ? ' prefilled' : ''}">${esc(s.vat_number)}&nbsp;</div></div>
    <div class="field-row"><div class="field-label">UTR Number</div><div class="field-input${s.utr_number ? ' prefilled' : ''}">${esc(s.utr_number)}&nbsp;</div></div>
    <div class="field-row"><div class="field-label">Website</div><div class="field-input${s.website ? ' prefilled' : ''}">${esc(s.website)}&nbsp;</div></div>
  </div>
  <div>
    <div class="field-row"><div class="field-label">Primary Contact Name</div><div class="field-input${s.primary_contact ? ' prefilled' : ''}">${esc(s.primary_contact)}&nbsp;</div></div>
    <div class="field-row"><div class="field-label">Position / Title</div><div class="field-input${s.contact_position ? ' prefilled' : ''}">${esc(s.contact_position)}&nbsp;</div></div>
    <div class="field-row"><div class="field-label">General Email</div><div class="field-input${s.general_email ? ' prefilled' : ''}">${esc(s.general_email)}&nbsp;</div></div>
    <div class="field-row"><div class="field-label">General Telephone</div><div class="field-input${s.general_telephone ? ' prefilled' : ''}">${esc(s.general_telephone)}&nbsp;</div></div>
    <div class="field-row"><div class="field-label">Mobile</div><div class="field-input${s.mobile_number ? ' prefilled' : ''}">${esc(s.mobile_number)}&nbsp;</div></div>
  </div>
</div>
<div class="fields-2col">
  <div class="field-row"><div class="field-label">Registered Address</div><div class="field-input prefilled">${esc(regAddr)}&nbsp;</div></div>
  <div class="field-row"><div class="field-label">Trading Address</div><div class="field-input${tradeAddr ? ' prefilled' : ''}">${esc(tradeAddr)}&nbsp;</div></div>
</div>

<div style="margin-top:12px">
  <div class="field-row">
    <div class="field-label">Company Description / Summary of Activities</div>
    <div class="field-input multiline">${esc(s.company_description)}&nbsp;</div>
  </div>
</div>
</div>`;

  // ── Section: Trades, Specialisms & Coverage ───────────────────────────────
  const tradesSection = `
<div class="page-break">
${pageHeader()}
<div class="section-heading">
  <div><span class="section-num">Section T</span>Trades, Specialisms &amp; Coverage</div>
</div>

<div class="field-row">
  <div class="field-label">Trades Applied For</div>
  ${tradeNames.length > 0
    ? `<div class="field-input prefilled">${esc(tradeNames.join(', '))}&nbsp;</div>`
    : `<div class="field-input">&nbsp;</div>`
  }
</div>
<div class="field-row" style="margin-top:4px">
  <div class="field-label">Additional trades not listed above</div>
  <div class="field-input">&nbsp;</div>
</div>

<div class="field-row" style="margin-top:10px">
  <div class="field-label">Specialist skills or Specialisms</div>
  ${specialismNames.length > 0
    ? `<div class="field-input prefilled">${esc(specialismNames.join(', '))}&nbsp;</div>`
    : `<div class="field-input">&nbsp;</div>`
  }
</div>

<div style="margin-top:14px">
  <div class="field-label" style="margin-bottom:6px">UK Working Regions — Please tick all applicable regions</div>
  <div class="regions-grid">
    ${REGIONS.map(r => {
      const checked = s.regions.includes(r);
      return `<div class="check-item"><div class="check-box${checked ? ' checked' : ''}"></div>${esc(r)}</div>`;
    }).join('')}
  </div>
</div>

<div class="fields-3col" style="margin-top:18px">
  <div class="field-row"><div class="field-label">Minimum Package Value</div><div class="field-input${s.min_package_value ? ' prefilled' : ''}">${fv(s.min_package_value)}&nbsp;</div></div>
  <div class="field-row"><div class="field-label">Preferred Package Value</div><div class="field-input${s.preferred_package_value ? ' prefilled' : ''}">${fv(s.preferred_package_value)}&nbsp;</div></div>
  <div class="field-row"><div class="field-label">Maximum Package Value</div><div class="field-input${s.max_package_value ? ' prefilled' : ''}">${fv(s.max_package_value)}&nbsp;</div></div>
</div>

<div style="margin-top:18px">
  <div class="section-heading" style="font-size:10pt;margin-bottom:12px">
    <div>Labour Rates</div>
    <div class="section-label">Please provide current all-in rates per hour (exclusive of materials)</div>
  </div>
  <table class="rates-table">
    <thead>
      <tr>
        <th>Role / Category</th>
        <th class="r">Standard (£/hr)</th>
        <th class="r">Overtime (£/hr)</th>
        <th class="r">Weekend (£/hr)</th>
        <th class="r">Night (£/hr)</th>
      </tr>
    </thead>
    <tbody>
      ${Array.from(rateTypeNames.entries()).map(([id, name]) => {
        const lr = labourRates.find(r => r.rate_type_id === id);
        const rFmt = (v: number | null | undefined) => v ? v.toFixed(2) : '';
        return `<tr>
          <td>${esc(name)}</td>
          <td class="r"><div class="rate-field${lr?.standard_rate ? ' prefilled' : ''}">${rFmt(lr?.standard_rate)}</div></td>
          <td class="r"><div class="rate-field${lr?.overtime_rate ? ' prefilled' : ''}">${rFmt(lr?.overtime_rate)}</div></td>
          <td class="r"><div class="rate-field${lr?.weekend_rate ? ' prefilled' : ''}">${rFmt(lr?.weekend_rate)}</div></td>
          <td class="r"><div class="rate-field${lr?.night_rate ? ' prefilled' : ''}">${rFmt(lr?.night_rate)}</div></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>
</div>`;

  // ── PQQ Sections (1–12) ───────────────────────────────────────────────────
  const pqqSections = PQQ_SECTIONS.map((section, idx) => {
    const resp = pqqResponses.find(r => r.section_key === section.key);
    const responses = resp?.responses ?? {};
    const is2col = section.fields.length >= 4 && !section.fields.some(f => f.type === 'text');

    const fields = is2col
      ? `<div class="fields-2col">${section.fields.map(f => renderField(f, responses[f.id])).join('')}</div>`
      : section.fields.map(f => renderField(f, responses[f.id])).join('');

    return `<div class="page-break">
${pageHeader()}
<div class="section-heading">
  <div><span class="section-num">Section ${idx + 1}</span>${esc(section.title)}</div>
</div>
${fields}
<div class="field-row" style="margin-top:10px">
  <div class="field-label">Section Notes / Additional Information</div>
  <div class="field-input multiline">${esc(resp?.notes ?? '')}&nbsp;</div>
</div>
</div>`;
  }).join('');

  // ── Supporting Documents ──────────────────────────────────────────────────
  const supportingDocs = [
    { doc: 'Health & Safety Policy', note: 'Current signed & dated version' },
    { doc: 'Public Liability Insurance Certificate', note: 'Must show limit and expiry' },
    { doc: "Employer's Liability Insurance Certificate", note: 'Must show limit and expiry' },
    { doc: 'Professional Indemnity Insurance Certificate', note: 'If applicable' },
    { doc: 'Contract Works Insurance Certificate', note: 'If applicable' },
    { doc: 'ISO 9001 Quality Certificate', note: 'If held' },
    { doc: 'ISO 14001 Environmental Certificate', note: 'If held' },
    { doc: 'CHAS Certificate / Constructionline Certificate', note: 'If held' },
    { doc: 'Gas Safe Registration Certificate', note: 'If applicable' },
    { doc: 'NICEIC / ECA / NAPIT Registration', note: 'If applicable' },
    { doc: 'Modern Slavery Transparency Statement', note: 'If applicable' },
    { doc: 'Equality & Diversity Policy', note: 'Current signed version' },
    { doc: 'Environmental Policy', note: 'Current signed version' },
    { doc: 'Last 3 Years Accounts (or financial references)', note: 'Most recent available' },
    { doc: 'CSCS Card Evidence / Skills Certifications', note: 'Sample or registration evidence' },
  ];

  const docsSection = `
<div class="page-break">
${pageHeader()}
<div class="section-heading">
  <div><span class="section-num">Supporting</span>Required Documents Checklist</div>
  <div class="section-label">Please include the documents listed below with your completed PQQ</div>
</div>
<table class="support-table">
  <thead>
    <tr>
      <th class="include-cell">Include</th>
      <th>Document</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    ${supportingDocs.map(d => `<tr>
      <td class="include-cell"><div class="incl-box"></div></td>
      <td>${esc(d.doc)}</td>
      <td style="color:#475569;font-size:8pt">${esc(d.note)}</td>
    </tr>`).join('')}
  </tbody>
</table>
</div>`;

  // ── Declaration ───────────────────────────────────────────────────────────
  const declarationSection = `
<div class="page-break">
${pageHeader()}
<div class="section-heading">
  <div><span class="section-num">Declaration</span>Authorised Signatory</div>
</div>
<div class="declaration-box">
  I/We confirm that the information provided in this Pre-Qualification Questionnaire is accurate and complete
  to the best of my/our knowledge and belief at the date of submission. I/We understand that any misrepresentation
  may result in immediate exclusion from the supply chain assessment process and removal from the approved supplier list.
  I/We agree to notify VYSITE of any material changes to the information provided in this questionnaire within 30 days
  of such change occurring. I/We consent to the verification of information provided and to reasonable background checks
  being carried out as part of the assessment process.
</div>

<div class="fields-2col" style="margin-top:20px">
  <div class="field-row"><div class="field-label">Full Name of Signatory</div><div class="field-input">&nbsp;</div></div>
  <div class="field-row"><div class="field-label">Position / Title</div><div class="field-input">&nbsp;</div></div>
  <div class="field-row" style="margin-top:6px"><div class="field-label">Date</div><div class="field-input">&nbsp;</div></div>
  <div class="field-row" style="margin-top:6px"><div class="field-label">Company Name</div><div class="field-input prefilled">${esc(s.company_name)}&nbsp;</div></div>
</div>
<div class="field-row" style="margin-top:16px">
  <div class="field-label">Signature</div>
  <div class="sig-line"></div>
</div>

<div style="margin-top:32px;padding:10px 14px;border:1px dashed #cbd5e1;border-radius:2px;text-align:center">
  <div style="font-size:7pt;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:4px">Supplier Reference</div>
  <div style="font-size:16pt;font-weight:700;color:#ea6c00;font-family:monospace;letter-spacing:0.1em">${esc(ref)}</div>
  <div style="font-size:7pt;color:#94a3b8;margin-top:2px">Quote this reference on all correspondence and when returning this questionnaire</div>
</div>

<div class="doc-footer">
  <div class="doc-footer-l">VYSITE · Pre-Qualification Questionnaire · ${esc(ref)}</div>
  <div class="doc-footer-r">Issued ${todayStr()} · Confidential</div>
</div>
</div>`;

  const bodyContent = [cover, overviewSection, tradesSection, pqqSections, docsSection, declarationSection].join('');

  if (forWord) {
    return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
  xmlns:w='urn:schemas-microsoft-com:office:word'
  xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>PQQ — ${esc(s.company_name)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  ${PQQ_CSS}
  @page { size: A4; margin: 2cm; }
  body { font-family: Calibri, 'Helvetica Neue', sans-serif; font-size: 10pt; }
  .page-break { page-break-before: always; padding-top: 0; }
</style>
</head>
<body><div class="page">${bodyContent}</div></body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>PQQ — ${esc(s.company_name)}</title>
<style>${PQQ_CSS}</style>
<script>window.onload=function(){window.print();};<\/script>
</head>
<body><div class="page">${bodyContent}</div></body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function downloadPqqPdf(data: PqqTemplateData): void {
  openPrintTab(buildPqqHtml(data, false));
}

export function downloadPqqWord(data: PqqTemplateData): void {
  const html = buildPqqHtml(data, true);
  const filename = `PQQ_${data.supplier.company_name.replace(/[^a-z0-9]/gi, '_')}_${supplierRef(data.supplier.id)}.doc`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
