/**
 * PQQ Template Generator.
 *
 * Produces a pre-filled questionnaire as either:
 *   • PDF — via openPrintTab (browser print dialog → save as PDF)
 *   • Word — true .docx via Office Open XML WordprocessingML blob
 *
 * All PQQ sections from types.ts are included.
 * Where supplier data is already known it is pre-filled.
 * A unique supplier reference on the cover allows completed questionnaires
 * to be matched back to the correct supplier record on upload.
 *
 * Future AI extraction: the document_id stored in pqq_import_raw links the
 * returned document back to this template; the supplier reference on the cover
 * provides a secondary matching key.
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

// ─── Submission checklist ─────────────────────────────────────────────────────

interface ChecklistItem {
  document: string;
  requirement: 'Mandatory' | 'If Applicable' | 'Optional';
  notes: string;
}

const SUBMISSION_CHECKLIST: ChecklistItem[] = [
  // ── Mandatory ──────────────────────────────────────────────────────────────
  { document: 'Public Liability Insurance Certificate',      requirement: 'Mandatory',      notes: 'Show policy number, indemnity limit and expiry date' },
  { document: "Employer's Liability Insurance Certificate",  requirement: 'Mandatory',      notes: 'Show policy number, indemnity limit and expiry date' },
  { document: 'Health & Safety Policy',                      requirement: 'Mandatory',      notes: 'Current signed and dated version — reviewed within last 12 months' },
  { document: 'Example Risk Assessment / Method Statement',  requirement: 'Mandatory',      notes: 'A sample RAMS relevant to the trades or works you are applying under' },
  // ── If Applicable ─────────────────────────────────────────────────────────
  { document: 'Professional Indemnity Insurance',            requirement: 'If Applicable',  notes: 'Required for design, consultancy or professional services' },
  { document: 'Contract Works Insurance',                    requirement: 'If Applicable',  notes: 'Required if you will be responsible for works in progress' },
  { document: 'NICEIC / ECA / NAPIT Registration',           requirement: 'If Applicable',  notes: 'Required for any electrical installation works' },
  { document: 'Gas Safe Registration Certificate',           requirement: 'If Applicable',  notes: 'Required for any gas installation or maintenance works' },
  { document: 'CHAS Certificate',                            requirement: 'If Applicable',  notes: 'Or equivalent SSIP-recognised scheme certificate' },
  { document: 'Constructionline Certificate',                requirement: 'If Applicable',  notes: 'Or SafeContractor / Achilles / equivalent' },
  { document: 'SafeContractor Certificate',                  requirement: 'If Applicable',  notes: 'If held' },
  { document: 'ISO 9001 Certificate',                        requirement: 'If Applicable',  notes: 'Include scope and expiry date if held' },
  { document: 'ISO 14001 Certificate',                       requirement: 'If Applicable',  notes: 'Include scope and expiry date if held' },
  { document: 'ISO 45001 Certificate',                       requirement: 'If Applicable',  notes: 'Occupational H&S — if held' },
  { document: 'Waste Carrier Licence',                       requirement: 'If Applicable',  notes: 'Required if removing waste from site — include licence number' },
  { document: 'Modern Slavery Policy / Statement',           requirement: 'If Applicable',  notes: 'If your organisation has published a statement' },
  // ── Optional ──────────────────────────────────────────────────────────────
  { document: 'Company Brochure / Capability Statement',     requirement: 'Optional',       notes: 'Helps assessors understand your business and typical works' },
  { document: 'Case Studies or Project References',          requirement: 'Optional',       notes: 'Recent relevant projects' },
  { document: 'Training Matrix / Competency Evidence',       requirement: 'Optional',       notes: 'Evidence of operative qualifications — CSCS, IPAF, PASMA, etc.' },
  { document: 'Equality & Diversity Policy',                 requirement: 'Optional',       notes: 'Current signed version' },
  { document: 'Environmental Policy',                        requirement: 'Optional',       notes: 'Current signed version' },
  { document: 'Anti-Bribery & Corruption Policy',            requirement: 'Optional',       notes: 'Current signed version' },
  { document: 'Latest Available Accounts',                   requirement: 'Optional',       notes: 'Most recent filed accounts or financial reference' },
];

// ─── Shared PDF CSS ───────────────────────────────────────────────────────────

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
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 14px; border-bottom: 1.5px solid #0f172a; margin-bottom: 28px;
}
.pqq-header-brand { display: flex; flex-direction: column; justify-content: flex-end; }
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

/* ── Powered by VYSITE footer ── */
.vysite-footer {
  margin-top: 24px; padding-top: 10px; border-top: 0.5px solid #e2e8f0;
  display: flex; align-items: center; justify-content: space-between;
}
.vysite-footer-l { font-size: 7pt; color: #94a3b8; }
.vysite-footer-l strong { color: #ea6c00; font-weight: 700; }
.vysite-footer-r { font-size: 7pt; color: #94a3b8; text-align: right; }

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
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
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

/* ── Submission checklist ── */
.checklist-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.checklist-table th {
  font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: #475569; padding: 5px 8px 5px 0; border-bottom: 1px solid #0f172a; text-align: left;
}
.checklist-table th.c { text-align: center; width: 54px; }
.checklist-table td {
  padding: 7px 8px 7px 0; border-bottom: 0.5px solid #f1f5f9; vertical-align: top;
}
.checklist-table td.c { text-align: center; vertical-align: middle; width: 54px; }
.checklist-table tr:nth-child(even) td { background: #fafafa; }
.checklist-table .doc-name { font-weight: 600; color: #0f172a; }
.checklist-table .doc-notes { font-size: 7.5pt; color: #64748b; margin-top: 1px; }
.req-badge {
  display: inline-block; font-size: 6.5pt; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; padding: 1px 6px; border-radius: 2px;
}
.req-mandatory { background: #fef2f2; color: #991b1b; border: 0.5px solid #fecaca; }
.req-applicable { background: #eff6ff; color: #1d4ed8; border: 0.5px solid #bfdbfe; }
.req-optional   { background: #f0fdf4; color: #166534; border: 0.5px solid #bbf7d0; }
.attach-box { width: 14px; height: 14px; border: 1.5px solid #cbd5e1; border-radius: 1px; margin: 0 auto; }
.notes-field { width: 100%; border-bottom: 1px solid #e2e8f0; min-height: 16px; display: block; }

/* ── Declaration ── */
.declaration-box {
  border: 1px solid #0f172a; padding: 16px 20px; margin-top: 16px;
  font-size: 8pt; color: #334155; line-height: 1.6; background: #f8fafc;
}
.sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0 40px; margin-top: 20px; }
.sig-line { border-bottom: 1px solid #0f172a; padding-bottom: 22px; margin-bottom: 4px; }
.sig-label { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; }

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

  switch (field.type) {
    case 'yesno':
    case 'yesnona': {
      const isYes = prefillValue === true || prefillValue === 'yes';
      const isNo  = prefillValue === false || prefillValue === 'no';
      const isNa  = prefillValue === 'na';
      return `<div class="field-row">
        <div class="field-label">${esc(field.label)}</div>
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
        <div class="field-label">${esc(field.label)}</div>
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

// ─── Data interface ───────────────────────────────────────────────────────────

export interface PqqTemplateData {
  supplier: DBSupplier;
  pqqResponses: DBSupplierPqqResponse[];
  tradeNames: string[];
  specialismNames: string[];
  rateTypeNames: Map<string, string>;
  labourRates: Array<{ rate_type_id: string; standard_rate: number | null; overtime_rate: number | null; weekend_rate: number | null; night_rate: number | null }>;
  orgLogo?: string;
}

// ─── PDF HTML builder ─────────────────────────────────────────────────────────

function buildPqqPdfHtml(data: PqqTemplateData): string {
  const { supplier: s, pqqResponses, tradeNames, specialismNames, rateTypeNames, labourRates, orgLogo } = data;
  const ref = supplierRef(s.id);

  // Org logo or VYSITE wordmark in header
  const brandHtml = orgLogo
    ? `<img src="${orgLogo}" alt="Logo" style="height:32px;max-width:140px;object-fit:contain;display:block">`
    : `<div class="brand-name">VYSITE</div><div class="brand-sub">Construction Operating System</div>`;

  function pageHeader(): string {
    return `<div class="pqq-header">
  <div class="pqq-header-brand">${brandHtml}</div>
  <div style="text-align:right">
    <div class="doc-type">Supply Chain Assessment</div>
    <div class="doc-title">Pre-Qualification Questionnaire</div>
    ${orgLogo ? '<div style="font-size:6pt;color:#94a3b8;margin-top:3px">Powered by VYSITE Construction Operating System</div>' : ''}
  </div>
</div>`;
  }

  function pageFooter(pageRef: string): string {
    return `<div class="vysite-footer">
  <div class="vysite-footer-l">Powered by <strong>VYSITE</strong> Construction Operating System &nbsp;·&nbsp; ${pageRef} &nbsp;·&nbsp; ${esc(ref)}</div>
  <div class="vysite-footer-r">Issued ${todayStr()} · Confidential</div>
</div>`;
  }

  // Cover page
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
        <div class="cover-meta-value" style="color:#475569">Supply Chain Portal — as directed</div>
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
    &bull; All information provided must be accurate and up to date at the time of submission.<br>
    &bull; Where a question is not applicable, select N/A and provide a brief explanation in the notes field.<br>
    &bull; Incomplete submissions may delay assessment. Please contact us if you have any queries.<br>
    &bull; Quote your <strong>Supplier Reference (${esc(ref)})</strong> on all correspondence and on the returned questionnaire cover.
  </div>
  ${pageFooter('Cover')}
</div>`;

  // Section 0: Applicant Details
  const regAddr = [s.reg_address_line1, s.reg_address_line2, s.reg_address_city, s.reg_address_county, s.reg_address_postcode, s.reg_address_country].filter(Boolean).join(', ');
  const tradeAddr = s.trading_address_same ? 'Same as Registered' : [s.trade_address_line1, s.trade_address_line2, s.trade_address_city, s.trade_address_county, s.trade_address_postcode, s.trade_address_country].filter(Boolean).join(', ');

  const overviewSection = `
<div class="page-break">
${pageHeader()}
<div class="section-heading">
  <div><span class="section-num">Section 0</span>Applicant Details</div>
  <div class="section-label">Pre-filled from record — please verify and correct</div>
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
${pageFooter('Section 0 — Applicant Details')}
</div>`;

  // Section T: Trades, Specialisms & Coverage
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
  <div class="field-label">Additional Trades Not Listed Above</div>
  <div class="field-input">&nbsp;</div>
</div>

<div class="field-row" style="margin-top:10px">
  <div class="field-label">Specialist Skills / Specialisms</div>
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
    <div class="section-label">All-in rates per hour, exclusive of materials</div>
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
${pageFooter('Section T — Trades, Specialisms & Coverage')}
</div>`;

  // PQQ Sections 1–12
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
${pageFooter(`Section ${idx + 1} — ${section.title}`)}
</div>`;
  }).join('');

  // Submission Checklist
  const reqBadge = (r: ChecklistItem['requirement']) => {
    const cls = r === 'Mandatory' ? 'req-mandatory' : r === 'If Applicable' ? 'req-applicable' : 'req-optional';
    return `<span class="req-badge ${cls}">${r}</span>`;
  };

  const checklistSection = `
<div class="page-break">
${pageHeader()}
<div class="section-heading">
  <div><span class="section-num">Checklist</span>Submission Checklist — Supporting Documents</div>
  <div class="section-label">Return all applicable documents with your completed questionnaire</div>
</div>
<table class="checklist-table">
  <thead>
    <tr>
      <th>Document</th>
      <th>Requirement</th>
      <th class="c">Attached</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    ${SUBMISSION_CHECKLIST.map(item => `<tr>
      <td>
        <div class="doc-name">${esc(item.document)}</div>
      </td>
      <td style="width:100px;vertical-align:middle">${reqBadge(item.requirement)}</td>
      <td class="c"><div class="attach-box"></div></td>
      <td style="width:200px">
        <div class="doc-notes">${esc(item.notes)}</div>
        <div class="notes-field">&nbsp;</div>
      </td>
    </tr>`).join('')}
  </tbody>
</table>
<div style="margin-top:16px;padding:10px 14px;background:#fafafa;border:0.5px solid #e2e8f0;border-radius:2px;font-size:7.5pt;color:#475569;line-height:1.5">
  <strong style="color:#0f172a">Checklist Key:</strong> &nbsp;
  <span class="req-badge req-mandatory">Mandatory</span>&nbsp; Must be included for your submission to be assessed. &nbsp;&nbsp;
  <span class="req-badge req-applicable">If Applicable</span>&nbsp; Include only if this applies to your organisation or scope of work. &nbsp;&nbsp;
  <span class="req-badge req-optional">Optional</span>&nbsp; Not required, but additional information is always welcome.
</div>
${pageFooter('Submission Checklist')}
</div>`;

  // Declaration
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
  I/We agree to notify the issuing organisation of any material changes to the information provided in this
  questionnaire within 30 days of such change occurring. I/We consent to the verification of information provided
  and to reasonable background checks being carried out as part of the assessment process.
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
  <div class="sig-label">Signature</div>
</div>

<div style="margin-top:32px;padding:12px 16px;border:1px dashed #cbd5e1;border-radius:2px;text-align:center">
  <div style="font-size:6.5pt;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:4px">Your Supplier Reference</div>
  <div style="font-size:18pt;font-weight:700;color:#ea6c00;font-family:monospace;letter-spacing:0.1em">${esc(ref)}</div>
  <div style="font-size:7pt;color:#94a3b8;margin-top:2px">Quote this reference on all correspondence and on the cover of the returned questionnaire</div>
</div>

${pageFooter('Declaration')}
</div>`;

  const bodyContent = [cover, overviewSection, tradesSection, pqqSections, checklistSection, declarationSection].join('');

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

// ─── True DOCX via Office Open XML ───────────────────────────────────────────
//
// Generates a proper .docx (ZIP containing word/document.xml and supporting
// parts). Uses the JSZip-free approach: constructs the Office Open XML
// WordprocessingML XML directly and assembles a ZIP blob in pure JavaScript
// using the stored-uncompressed method (no compression, valid ZIP structure).

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function docxPara(text: string, style = 'Normal', bold = false, size = 20, color = '000000', spaceAfter = 120): string {
  const rPr = `<w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
  return `<w:p>
    <w:pPr>
      <w:pStyle w:val="${style}"/>
      <w:spacing w:after="${spaceAfter}"/>
    </w:pPr>
    <w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>
  </w:p>`;
}

function docxEmptyLine(): string {
  return `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`;
}

function docxPageBreak(): string {
  return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
}

function docxHeading1(text: string): string {
  return `<w:p>
    <w:pPr>
      <w:pStyle w:val="Heading1"/>
      <w:spacing w:before="240" w:after="120"/>
    </w:pPr>
    <w:r><w:t>${xmlEsc(text)}</w:t></w:r>
  </w:p>`;
}

function docxHeading2(text: string): string {
  return `<w:p>
    <w:pPr>
      <w:pStyle w:val="Heading2"/>
      <w:spacing w:before="200" w:after="100"/>
    </w:pPr>
    <w:r><w:t>${xmlEsc(text)}</w:t></w:r>
  </w:p>`;
}

function docxLabel(label: string): string {
  return `<w:p>
    <w:pPr><w:spacing w:after="40"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="475569"/></w:rPr><w:t>${xmlEsc(label)}</w:t></w:r>
  </w:p>`;
}

function docxInputLine(prefilled = ''): string {
  const content = prefilled
    ? `<w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${xmlEsc(prefilled)}</w:t></w:r>`
    : `<w:r><w:rPr><w:sz w:val="22"/><w:color w:val="BBBBBB"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r>`;
  return `<w:p>
    <w:pPr>
      <w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="CBD5E1"/></w:pBdr>
      <w:spacing w:after="120"/>
    </w:pPr>
    ${content}
  </w:p>`;
}

function docxYesNoRow(value: unknown, includeNA = false): string {
  const isYes = value === true || value === 'yes';
  const isNo  = value === false || value === 'no';
  const isNa  = value === 'na';

  function cell(label: string, selected: boolean): string {
    const fill = selected ? (label === 'Yes' ? '166534' : label === 'No' ? '991B1B' : '475569') : 'FFFFFF';
    const textColor = selected ? 'FFFFFF' : '475569';
    return `<w:tc>
      <w:tcPr>
        <w:tcW w:w="800" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>
        <w:tcBorders>
          <w:top w:val="single" w:sz="4" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="4" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="4" w:color="CBD5E1"/>
        </w:tcBorders>
      </w:tcPr>
      <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${textColor}"/></w:rPr><w:t>${xmlEsc(label)}</w:t></w:r>
      </w:p>
    </w:tc>`;
  }

  function spacer(): string {
    return `<w:tc>
      <w:tcPr><w:tcW w:w="200" w:type="dxa"/><w:tcBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders></w:tcPr>
      <w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
    </w:tc>`;
  }

  const cells = includeNA
    ? `${cell('Yes', isYes)}${spacer()}${cell('No', isNo)}${spacer()}${cell('N/A', isNa)}`
    : `${cell('Yes', isYes)}${spacer()}${cell('No', isNo)}`;

  const totalWidth = includeNA ? '2400' : '1800';

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${totalWidth}" w:type="dxa"/>
      <w:tblBorders><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>
      <w:tblCellSpacing w:w="0" w:type="dxa"/>
      <w:tblLook w:val="0000"/>
    </w:tblPr>
    <w:tr>${cells}</w:tr>
  </w:tbl>
  <w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>`;
}

function docxFieldBlock(label: string, type: string, value: unknown): string {
  const val = fmtValFor(value);
  const isYN = type === 'yesno' || type === 'yesnona';
  if (isYN) {
    return docxLabel(label) + docxYesNoRow(value, type === 'yesnona');
  }
  return docxLabel(label) + docxInputLine(val);
}

function docxHRule(): string {
  return `<w:p>
    <w:pPr>
      <w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="0F172A"/></w:pBdr>
      <w:spacing w:after="120"/>
    </w:pPr>
  </w:p>`;
}

function docxTableRow(cells: Array<{ text: string; bold?: boolean; width: number; shaded?: boolean; color?: string }>): string {
  const tcs = cells.map(c => {
    const fill = c.shaded ? 'F1F5F9' : 'FFFFFF';
    return `<w:tc>
      <w:tcPr>
        <w:tcW w:w="${c.width}" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>
      </w:tcPr>
      <w:p>
        <w:pPr><w:spacing w:after="40"/></w:pPr>
        <w:r>
          <w:rPr>${c.bold ? '<w:b/>' : ''}<w:sz w:val="18"/><w:color w:val="${c.color ?? '0F172A'}"/></w:rPr>
          <w:t xml:space="preserve">${xmlEsc(c.text)}</w:t>
        </w:r>
      </w:p>
    </w:tc>`;
  }).join('');
  return `<w:tr>${tcs}</w:tr>`;
}

function buildDocxXml(data: PqqTemplateData): string {
  const { supplier: s, pqqResponses, tradeNames, specialismNames, rateTypeNames, labourRates } = data;
  const ref = supplierRef(s.id);
  const regAddr = [s.reg_address_line1, s.reg_address_line2, s.reg_address_city, s.reg_address_county, s.reg_address_postcode, s.reg_address_country].filter(Boolean).join(', ');
  const tradeAddr = s.trading_address_same ? 'Same as Registered' : [s.trade_address_line1, s.trade_address_line2, s.trade_address_city, s.trade_address_county, s.trade_address_postcode, s.trade_address_country].filter(Boolean).join(', ');

  const parts: string[] = [];

  // ── Cover Page ──────────────────────────────────────────────────────────────
  parts.push(docxPara('PRE-QUALIFICATION QUESTIONNAIRE', 'Normal', true, 36, 'EA6C00', 60));
  parts.push(docxPara('Construction Supply Chain Assessment', 'Normal', false, 22, '334155', 200));
  parts.push(docxHRule());
  parts.push(docxEmptyLine());
  parts.push(docxPara('SUPPLIER REFERENCE', 'Normal', true, 18, '475569', 40));
  parts.push(docxPara(ref, 'Normal', true, 28, 'EA6C00', 120));
  parts.push(docxEmptyLine());
  parts.push(docxPara('COMPANY NAME', 'Normal', true, 18, '475569', 40));
  parts.push(docxPara(s.company_name || ' ', 'Normal', false, 22, '0F172A', 120));
  parts.push(docxEmptyLine());
  parts.push(docxPara(`Date Issued: ${todayStr()}`, 'Normal', false, 20, '475569', 40));
  parts.push(docxPara('Return By: ___________________________________', 'Normal', false, 20, '475569', 120));
  parts.push(docxEmptyLine());
  parts.push(docxHRule());
  parts.push(docxEmptyLine());
  parts.push(docxPara('INSTRUCTIONS FOR COMPLETION', 'Normal', true, 18, '0F172A', 60));
  parts.push(docxPara('Please complete all sections of this questionnaire as fully as possible. Sections marked with supporting document requirements should be accompanied by the relevant certificates and policies.', 'Normal', false, 20, '334155', 60));
  parts.push(docxPara('\u2022  All information provided must be accurate and up to date at the time of submission.', 'Normal', false, 20, '334155', 40));
  parts.push(docxPara('\u2022  Where a question is not applicable, select N/A and provide a brief explanation in the notes field.', 'Normal', false, 20, '334155', 40));
  parts.push(docxPara('\u2022  Incomplete submissions may delay assessment.', 'Normal', false, 20, '334155', 40));
  parts.push(docxPara(`\u2022  Quote your Supplier Reference (${ref}) on all correspondence and on the cover of the returned questionnaire.`, 'Normal', false, 20, '334155', 80));
  parts.push(docxEmptyLine());
  parts.push(docxPara('Powered by VYSITE Construction Operating System', 'Normal', false, 16, '94A3B8', 0));

  // ── Section 0: Applicant Details ────────────────────────────────────────────
  parts.push(docxPageBreak());
  parts.push(docxHeading1('Section 0 — Applicant Details'));
  parts.push(docxPara('Pre-filled from record — please verify and correct any information before returning.', 'Normal', false, 18, '475569', 120));

  parts.push(docxFieldBlock('Company Name', 'text', s.company_name));
  parts.push(docxFieldBlock('Trading Name (if different)', 'text', s.trading_name));
  parts.push(docxFieldBlock('Company Registration Number', 'text', s.company_number));
  parts.push(docxFieldBlock('VAT Number', 'text', s.vat_number));
  parts.push(docxFieldBlock('UTR Number', 'text', s.utr_number));
  parts.push(docxFieldBlock('Website', 'text', s.website));
  parts.push(docxEmptyLine());
  parts.push(docxFieldBlock('Primary Contact Name', 'text', s.primary_contact));
  parts.push(docxFieldBlock('Position / Title', 'text', s.contact_position));
  parts.push(docxFieldBlock('General Email', 'text', s.general_email));
  parts.push(docxFieldBlock('General Telephone', 'text', s.general_telephone));
  parts.push(docxFieldBlock('Mobile', 'text', s.mobile_number));
  parts.push(docxEmptyLine());
  parts.push(docxFieldBlock('Registered Address', 'text', regAddr));
  parts.push(docxFieldBlock('Trading Address', 'text', tradeAddr));
  parts.push(docxEmptyLine());
  parts.push(docxLabel('Company Description / Summary of Activities'));
  for (let i = 0; i < 4; i++) parts.push(docxInputLine());

  // ── Section T: Trades, Specialisms & Coverage ────────────────────────────────
  parts.push(docxPageBreak());
  parts.push(docxHeading1('Section T — Trades, Specialisms & Coverage'));

  parts.push(docxFieldBlock('Trades Applied For', 'text', tradeNames.join(', ')));
  parts.push(docxFieldBlock('Additional Trades Not Listed Above', 'text', ''));
  parts.push(docxFieldBlock('Specialist Skills / Specialisms', 'text', specialismNames.join(', ')));
  parts.push(docxEmptyLine());

  parts.push(docxHeading2('UK Working Regions'));
  parts.push(docxPara('Please tick or highlight all applicable regions:', 'Normal', false, 18, '475569', 80));

  // Regions as a 4-column table
  const regionRows: string[] = [];
  const regionChunks: string[][] = [];
  for (let i = 0; i < REGIONS.length; i += 4) regionChunks.push(REGIONS.slice(i, i + 4));
  for (const chunk of regionChunks) {
    const cells = chunk.map(r => ({ text: (s.regions.includes(r) ? '\u2611 ' : '\u2610 ') + r, width: 2160, shaded: s.regions.includes(r) }));
    while (cells.length < 4) cells.push({ text: '', width: 2160 });
    regionRows.push(docxTableRow(cells));
  }

  parts.push(`<w:tbl>
    <w:tblPr>
      <w:tblW w:w="8640" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="E2E8F0"/>
        <w:left w:val="single" w:sz="4" w:color="E2E8F0"/>
        <w:bottom w:val="single" w:sz="4" w:color="E2E8F0"/>
        <w:right w:val="single" w:sz="4" w:color="E2E8F0"/>
        <w:insideH w:val="single" w:sz="4" w:color="E2E8F0"/>
        <w:insideV w:val="single" w:sz="4" w:color="E2E8F0"/>
      </w:tblBorders>
    </w:tblPr>
    ${regionRows.join('')}
  </w:tbl>`);
  parts.push(docxEmptyLine());

  parts.push(docxHeading2('Package Values'));
  parts.push(docxFieldBlock('Minimum Package Value', 'text', fv(s.min_package_value)));
  parts.push(docxFieldBlock('Preferred Package Value', 'text', fv(s.preferred_package_value)));
  parts.push(docxFieldBlock('Maximum Package Value', 'text', fv(s.max_package_value)));
  parts.push(docxEmptyLine());

  parts.push(docxHeading2('Labour Rates'));
  parts.push(docxPara('Please provide current all-in rates per hour (exclusive of materials):', 'Normal', false, 18, '475569', 80));

  const rateHeaders = [
    { text: 'Role / Category', bold: true, width: 2880, shaded: true },
    { text: 'Standard (£/hr)', bold: true, width: 1440, shaded: true, color: '475569' },
    { text: 'Overtime (£/hr)', bold: true, width: 1440, shaded: true, color: '475569' },
    { text: 'Weekend (£/hr)', bold: true, width: 1440, shaded: true, color: '475569' },
    { text: 'Night (£/hr)', bold: true, width: 1440, shaded: true, color: '475569' },
  ];

  const rateRows = Array.from(rateTypeNames.entries()).map(([id, name]) => {
    const lr = labourRates.find(r => r.rate_type_id === id);
    return docxTableRow([
      { text: name, width: 2880 },
      { text: lr?.standard_rate ? '£' + lr.standard_rate.toFixed(2) : '', width: 1440 },
      { text: lr?.overtime_rate ? '£' + lr.overtime_rate.toFixed(2) : '', width: 1440 },
      { text: lr?.weekend_rate  ? '£' + lr.weekend_rate.toFixed(2)  : '', width: 1440 },
      { text: lr?.night_rate    ? '£' + lr.night_rate.toFixed(2)    : '', width: 1440 },
    ]);
  });

  if (rateRows.length > 0) {
    parts.push(`<w:tbl>
      <w:tblPr>
        <w:tblW w:w="8640" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="4" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="4" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:color="F1F5F9"/>
          <w:insideV w:val="single" w:sz="4" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      ${docxTableRow(rateHeaders)}
      ${rateRows.join('')}
    </w:tbl>`);
    parts.push(docxEmptyLine());
  }

  // ── PQQ Sections 1–12 ────────────────────────────────────────────────────────
  for (let i = 0; i < PQQ_SECTIONS.length; i++) {
    const section = PQQ_SECTIONS[i];
    const resp = pqqResponses.find(r => r.section_key === section.key);
    const responses = resp?.responses ?? {};

    parts.push(docxPageBreak());
    parts.push(docxHeading1(`Section ${i + 1} — ${section.title}`));

    for (const field of section.fields) {
      parts.push(docxFieldBlock(field.label, field.type, responses[field.id]));
    }

    parts.push(docxEmptyLine());
    parts.push(docxLabel('Section Notes / Additional Information'));
    for (let n = 0; n < 3; n++) parts.push(docxInputLine(n === 0 ? (resp?.notes ?? '') : ''));
  }

  // ── Submission Checklist ────────────────────────────────────────────────────
  parts.push(docxPageBreak());
  parts.push(docxHeading1('Submission Checklist — Supporting Documents'));
  parts.push(docxPara('Return all applicable documents with your completed questionnaire. Use the Attached column to confirm each document is included.', 'Normal', false, 18, '475569', 120));

  // Legend
  parts.push(docxPara('MANDATORY: Must be included for your submission to be assessed.    IF APPLICABLE: Include only if this applies to your organisation.    OPTIONAL: Not required, but additional information is always welcome.', 'Normal', false, 16, '475569', 120));

  // Checklist table
  const clHeaders = [
    { text: 'Document', bold: true, width: 3240, shaded: true, color: '0F172A' },
    { text: 'Requirement', bold: true, width: 1200, shaded: true, color: '0F172A' },
    { text: 'Attached', bold: true, width: 720, shaded: true, color: '0F172A' },
    { text: 'Notes', bold: true, width: 3480, shaded: true, color: '0F172A' },
  ];

  const clRows = SUBMISSION_CHECKLIST.map(item =>
    docxTableRow([
      { text: item.document, width: 3240 },
      { text: item.requirement, width: 1200, color: item.requirement === 'Mandatory' ? '991B1B' : item.requirement === 'If Applicable' ? '1D4ED8' : '166534' },
      { text: '\u2610', width: 720 },
      { text: item.notes, width: 3480, color: '475569' },
    ])
  );
  parts.push(`<w:tbl>
    <w:tblPr>
      <w:tblW w:w="8640" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="CBD5E1"/>
        <w:left w:val="single" w:sz="4" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/>
        <w:right w:val="single" w:sz="4" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="4" w:color="E2E8F0"/>
        <w:insideV w:val="single" w:sz="4" w:color="E2E8F0"/>
      </w:tblBorders>
    </w:tblPr>
    ${docxTableRow(clHeaders)}
    ${clRows.join('')}
  </w:tbl>`);
  parts.push(docxEmptyLine());

  // ── Declaration ─────────────────────────────────────────────────────────────
  parts.push(docxPageBreak());
  parts.push(docxHeading1('Declaration — Authorised Signatory'));
  parts.push(docxPara('I/We confirm that the information provided in this Pre-Qualification Questionnaire is accurate and complete to the best of my/our knowledge and belief at the date of submission. I/We understand that any misrepresentation may result in immediate exclusion from the supply chain assessment process and removal from the approved supplier list. I/We agree to notify the issuing organisation of any material changes to the information provided in this questionnaire within 30 days of such change occurring. I/We consent to the verification of information provided and to reasonable background checks being carried out as part of the assessment process.', 'Normal', false, 20, '334155', 120));
  parts.push(docxEmptyLine());

  parts.push(docxFieldBlock('Full Name of Signatory', 'text', ''));
  parts.push(docxFieldBlock('Position / Title', 'text', ''));
  parts.push(docxFieldBlock('Date', 'text', ''));
  parts.push(docxFieldBlock('Company Name', 'text', s.company_name));

  parts.push(docxEmptyLine());
  parts.push(docxLabel('Signature'));
  parts.push(`<w:p>
    <w:pPr>
      <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="0F172A"/></w:pBdr>
      <w:spacing w:after="200"/>
    </w:pPr>
    <w:r><w:rPr><w:sz w:val="36"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r>
  </w:p>`);

  parts.push(docxEmptyLine());
  parts.push(docxHRule());
  parts.push(docxPara(`SUPPLIER REFERENCE: ${ref}`, 'Normal', true, 24, 'EA6C00', 40));
  parts.push(docxPara('Quote this reference on all correspondence and on the cover of the returned questionnaire.', 'Normal', false, 16, '94A3B8', 60));
  parts.push(docxEmptyLine());
  parts.push(docxPara('Powered by VYSITE Construction Operating System', 'Normal', false, 16, '94A3B8', 0));

  // Assemble document.xml
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mo="http://schemas.microsoft.com/office/mac/office/2008/main"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mv="urn:schemas-microsoft-com:mac:vml"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14">
  <w:body>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
    ${parts.join('\n    ')}
  </w:body>
</w:document>`;
}

// ─── ZIP builder (stored, no compression) ─────────────────────────────────────
// Produces a minimal valid OOXML .docx package without external dependencies.

function uint32LE(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
}
function uint16LE(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

interface ZipEntry { name: string; data: Uint8Array }

function buildZip(entries: ZipEntry[]): Uint8Array {
  const localHeaders: Uint8Array[] = [];
  const centralDirs: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = strToBytes(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const modTime = 0x6321; // arbitrary
    const modDate = 0x5a0e;

    // Local file header
    const lh = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // signature
      uint16LE(20),           // version needed
      uint16LE(0),            // general purpose bit flag
      uint16LE(0),            // compression method (stored)
      uint16LE(modTime),
      uint16LE(modDate),
      uint32LE(crc),
      uint32LE(size),         // compressed size
      uint32LE(size),         // uncompressed size
      uint16LE(nameBytes.length),
      uint16LE(0),            // extra field length
      nameBytes,
      entry.data,
    );

    // Central directory entry
    const cd = concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // signature
      uint16LE(20),           // version made by
      uint16LE(20),           // version needed
      uint16LE(0),
      uint16LE(0),            // stored
      uint16LE(modTime),
      uint16LE(modDate),
      uint32LE(crc),
      uint32LE(size),
      uint32LE(size),
      uint16LE(nameBytes.length),
      uint16LE(0),            // extra
      uint16LE(0),            // comment
      uint16LE(0),            // disk start
      uint16LE(0),            // internal attrs
      uint32LE(0),            // external attrs
      uint32LE(offset),       // local header offset
      nameBytes,
    );

    localHeaders.push(lh);
    centralDirs.push(cd);
    offset += lh.length;
  }

  const cdStart = offset;
  const cdSize = centralDirs.reduce((s, a) => s + a.length, 0);

  // End of central directory
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    uint16LE(0), uint16LE(0),
    uint16LE(entries.length),
    uint16LE(entries.length),
    uint32LE(cdSize),
    uint32LE(cdStart),
    uint16LE(0),
  );

  return concat(...localHeaders, ...centralDirs, eocd);
}

function buildDocxBlob(data: PqqTemplateData): Blob {
  const docXml = buildDocxXml(data);
  const s = data.supplier;

  const entries: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      data: strToBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`),
    },
    {
      name: '_rels/.rels',
      data: strToBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
    },
    {
      name: 'word/_rels/document.xml.rels',
      data: strToBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`),
    },
    {
      name: 'word/styles.xml',
      data: strToBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
    <w:pPr><w:spacing w:after="120"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="0F172A"/></w:rPr>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="280" w:after="120"/>
      <w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="0F172A"/></w:pBdr>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="200" w:after="80"/>
    </w:pPr>
  </w:style>
</w:styles>`),
    },
    {
      name: 'word/document.xml',
      data: strToBytes(docXml),
    },
  ];

  const zipBytes = buildZip(entries);
  return new Blob([zipBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function downloadPqqPdf(data: PqqTemplateData): void {
  openPrintTab(buildPqqPdfHtml(data));
}

export function downloadPqqWord(data: PqqTemplateData): void {
  const blob = buildDocxBlob(data);
  const filename = `PQQ_${data.supplier.company_name.replace(/[^a-z0-9]/gi, '_')}_${supplierRef(data.supplier.id)}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
