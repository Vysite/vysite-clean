// ─── Supply Chain Types ───────────────────────────────────────────────────────

export const SUPPLIER_TYPES = [
  'Contractor',
  'Subcontractor',
  'Specialist Subcontractor',
  'Consultant',
  'Supplier / Manufacturer',
  'Labour Only',
  'Other',
] as const;

export const APPROVAL_STATUSES = [
  'Pending',
  'Under Review',
  'Approved',
  'Conditionally Approved',
  'Rejected',
  'Suspended',
] as const;

export const PQQ_STATUSES = ['Not Started', 'In Progress', 'Complete'] as const;

export const REGIONS = [
  'Nationwide',
  'North East',
  'North West',
  'Yorkshire & Humber',
  'East Midlands',
  'West Midlands',
  'East of England',
  'London',
  'South East',
  'South West',
  'Wales',
  'Scotland',
  'Northern Ireland',
] as const;

export const DOCUMENT_CATEGORIES = [
  'Insurance',
  'Policy',
  'Accreditation',
  'CSCS Evidence',
  'Reference',
  'Financial',
  'PQQ Document',
  'Other',
] as const;

export const DEFAULT_LABOUR_RATE_TYPES = [
  'Apprentice',
  'Labourer',
  'Improver',
  'Skilled Operative',
  'Trade',
  'Specialist Trade',
  'Supervisor',
  'Site Manager',
  'Project Manager',
  'Commissioning Engineer',
  'Testing Engineer',
] as const;

// ─── PQQ Section definitions ─────────────────────────────────────────────────

export type PqqFieldType = 'yesno' | 'yesnona' | 'text' | 'date' | 'number' | 'checkbox';

export interface PqqField {
  id: string;
  label: string;
  type: PqqFieldType;
  options?: string[]; // for checkbox
  required?: boolean;
}

export interface PqqSectionDef {
  key: string;
  title: string;
  fields: PqqField[];
}

export const PQQ_SECTIONS: PqqSectionDef[] = [
  // Section 1 — Company Information
  // Consolidated from the previous separate company_info + financial sections.
  // Kept proportionate: three years of detailed accounts removed; key indicators retained.
  {
    key: 'company_info',
    title: 'Company Information',
    fields: [
      { id: 'legal_status',        label: 'Legal Status (Ltd, LLP, Sole Trader, Partnership, etc.)', type: 'text' },
      { id: 'date_established',    label: 'Date Established / Years Trading', type: 'text' },
      { id: 'employee_count',      label: 'Approximate Number of Employees (including sub-contracted operatives)', type: 'number' },
      { id: 'annual_turnover',     label: 'Approximate Annual Turnover (£)', type: 'number' },
      { id: 'vat_registered',      label: 'Are you VAT registered?', type: 'yesno' },
      { id: 'ccj_history',         label: 'Do you have any outstanding County Court Judgements (CCJs)?', type: 'yesno' },
      { id: 'insolvency_history',  label: 'Have you been involved in any insolvency or administration proceedings in the last 3 years?', type: 'yesno' },
      { id: 'parent_company',      label: 'Parent Company Name (if applicable)', type: 'text' },
    ],
  },

  // Section 2 — Health & Safety
  {
    key: 'health_safety',
    title: 'Health & Safety',
    fields: [
      { id: 'hs_policy',           label: 'Do you hold a written Health & Safety policy?', type: 'yesno' },
      { id: 'hs_policy_reviewed',  label: 'Has the policy been reviewed in the last 12 months?', type: 'yesno' },
      { id: 'method_statements',   label: 'Do you produce Risk Assessments and Method Statements (RAMS) for your works?', type: 'yesno' },
      { id: 'toolbox_talks',       label: 'Are Toolbox Talks or safety briefings carried out regularly?', type: 'yesno' },
      { id: 'riddor_history',      label: 'Have you had any RIDDOR-reportable incidents in the last 3 years?', type: 'yesno' },
      { id: 'hs_accreditation',    label: 'Do you hold any H&S accreditation (e.g. CHAS, Constructionline, SafeContractor)? If yes, please provide details.', type: 'text' },
    ],
  },

  // Section 3 — Insurance
  {
    key: 'insurance',
    title: 'Insurance',
    fields: [
      { id: 'pl_limit',    label: 'Public Liability — Indemnity Limit (£)', type: 'number' },
      { id: 'pl_insurer',  label: 'Public Liability — Insurer', type: 'text' },
      { id: 'pl_expiry',   label: 'Public Liability — Expiry Date', type: 'date' },
      { id: 'el_limit',    label: "Employer's Liability — Indemnity Limit (£)", type: 'number' },
      { id: 'el_insurer',  label: "Employer's Liability — Insurer", type: 'text' },
      { id: 'el_expiry',   label: "Employer's Liability — Expiry Date", type: 'date' },
      { id: 'pi_limit',    label: 'Professional Indemnity — Indemnity Limit (£) — if applicable', type: 'number' },
      { id: 'pi_expiry',   label: 'Professional Indemnity — Expiry Date', type: 'date' },
      { id: 'cw_limit',    label: 'Contract Works — Indemnity Limit (£) — if applicable', type: 'number' },
      { id: 'cw_expiry',   label: 'Contract Works — Expiry Date', type: 'date' },
    ],
  },

  // Section 4 — Quality & Environmental
  // Merged to reduce form length. ISO treated as a bonus, not a baseline.
  {
    key: 'quality',
    title: 'Quality & Environmental',
    fields: [
      { id: 'qms',              label: 'Do you operate a Quality Management System (formal or informal)?', type: 'yesno' },
      { id: 'qms_description',  label: 'Briefly describe your approach to quality and checking work before handover', type: 'text' },
      { id: 'iso9001',          label: 'Do you hold ISO 9001 certification?', type: 'yesnona' },
      { id: 'iso9001_expiry',   label: 'ISO 9001 Expiry Date (if held)', type: 'date' },
      { id: 'env_policy',       label: 'Do you have an Environmental Policy?', type: 'yesno' },
      { id: 'iso14001',         label: 'Do you hold ISO 14001 certification?', type: 'yesnona' },
      { id: 'waste_carrier_reg',label: 'Waste Carrier Registration Number (if applicable)', type: 'text' },
    ],
  },

  // Section 5 — Accreditations
  // Reframed as "tick all that apply" — no implied expectation to hold everything.
  {
    key: 'accreditations',
    title: 'Accreditations & Memberships',
    fields: [
      { id: 'chas',                 label: 'CHAS — registered?', type: 'yesnona' },
      { id: 'chas_expiry',          label: 'CHAS — Expiry Date (if held)', type: 'date' },
      { id: 'constructionline',     label: 'Constructionline — registered?', type: 'yesnona' },
      { id: 'niceic',               label: 'NICEIC / ECA / NAPIT — registered? (electrical works)', type: 'yesnona' },
      { id: 'gas_safe',             label: 'Gas Safe — registered? (gas works)', type: 'yesnona' },
      { id: 'iso45001',             label: 'ISO 45001 (Occupational H&S) — certified?', type: 'yesnona' },
      { id: 'besa',                 label: 'BESA member? (building engineering)', type: 'yesnona' },
      { id: 'other_accreditations', label: 'Any other accreditations, scheme memberships or industry registrations', type: 'text' },
    ],
  },

  // Section 6 — Workforce Competency
  {
    key: 'workforce',
    title: 'Workforce Competency',
    fields: [
      { id: 'cscs_scheme',          label: 'Do your site operatives hold CSCS cards or equivalent skills cards?', type: 'yesno' },
      { id: 'direct_workforce_pct', label: 'Approximate % of works carried out by your direct workforce', type: 'number' },
      { id: 'gang_subcontracting',  label: 'Do you use labour-only sub-contractors or labour gangs?', type: 'yesno' },
      { id: 'apprenticeships',      label: 'Do you employ apprentices or trainees?', type: 'yesnona' },
      { id: 'nvq_training',         label: 'Is trade training or NVQ/SVQ development provided to staff?', type: 'yesnona' },
    ],
  },

  // Section 7 — Policies & Compliance
  // Consolidated ethical/compliance policies. SME-friendly: a simple Yes/No
  // with the option to supply the document — no extensive detail required.
  {
    key: 'modern_slavery',
    title: 'Policies & Compliance',
    fields: [
      { id: 'ms_policy',       label: 'Do you have a Modern Slavery or ethical sourcing policy?', type: 'yesnona' },
      { id: 'edi_policy',      label: 'Do you have an Equality & Diversity policy?', type: 'yesnona' },
      { id: 'equal_opportunities', label: 'Do you operate as an equal opportunities employer?', type: 'yesno' },
      { id: 'anti_bribery',    label: 'Do you have an Anti-Bribery & Corruption policy?', type: 'yesnona' },
      { id: 'gdpr_compliant',  label: 'Are you GDPR compliant and do you have a Privacy Policy?', type: 'yesno' },
    ],
  },

  // Section 8 — Recent Projects & References
  // Reduced from three references to two. Project value added for context.
  {
    key: 'references',
    title: 'Recent Projects & References',
    fields: [
      { id: 'ref1_company', label: 'Reference 1 — Client / Main Contractor', type: 'text' },
      { id: 'ref1_contact', label: 'Reference 1 — Contact Name', type: 'text' },
      { id: 'ref1_phone',   label: 'Reference 1 — Telephone / Email', type: 'text' },
      { id: 'ref1_works',   label: 'Reference 1 — Nature of Works', type: 'text' },
      { id: 'ref1_value',   label: 'Reference 1 — Approximate Contract Value (£)', type: 'number' },
      { id: 'ref2_company', label: 'Reference 2 — Client / Main Contractor', type: 'text' },
      { id: 'ref2_contact', label: 'Reference 2 — Contact Name', type: 'text' },
      { id: 'ref2_phone',   label: 'Reference 2 — Telephone / Email', type: 'text' },
      { id: 'ref2_works',   label: 'Reference 2 — Nature of Works', type: 'text' },
      { id: 'ref2_value',   label: 'Reference 2 — Approximate Contract Value (£)', type: 'number' },
    ],
  },

  // Section 9 — Commercial Terms
  {
    key: 'commercial_pqq',
    title: 'Commercial Terms',
    fields: [
      { id: 'payment_terms_req',        label: 'Required Payment Terms (e.g. 30 days from application)', type: 'text' },
      { id: 'retention_acceptable',     label: 'Are standard retention deduction terms acceptable?', type: 'yesno' },
      { id: 'dlp_acceptable',           label: 'Are standard Defects Liability Period terms acceptable?', type: 'yesno' },
      { id: 'insurance_backed_warranty',label: 'Can you provide an insurance-backed warranty if required?', type: 'yesnona' },
      { id: 'max_contract_value',       label: 'Maximum single contract value you are comfortable undertaking (£)', type: 'number' },
    ],
  },
];

// ─── DB Types ─────────────────────────────────────────────────────────────────

export interface DBSupplier {
  id: string;
  org_id: string;
  company_name: string;
  trading_name: string;
  company_number: string;
  vat_number: string;
  utr_number: string;
  reg_address_line1: string;
  reg_address_line2: string;
  reg_address_city: string;
  reg_address_county: string;
  reg_address_postcode: string;
  reg_address_country: string;
  trading_address_same: boolean;
  trade_address_line1: string;
  trade_address_line2: string;
  trade_address_city: string;
  trade_address_county: string;
  trade_address_postcode: string;
  trade_address_country: string;
  website: string;
  general_email: string;
  general_telephone: string;
  primary_contact: string;
  contact_position: string;
  mobile_number: string;
  company_description: string;
  supplier_type: string;
  preferred_supplier: boolean;
  approval_status: string;
  approval_date: string;
  approved_by: string;
  approval_notes: string;
  primary_trade_id: string;
  regions: string[];
  min_package_value: number | null;
  preferred_package_value: number | null;
  max_package_value: number | null;
  pqq_status: string;
  pqq_import_raw: unknown;
  notes: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface DBSupplierTrade {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface DBSupplierSpecialism {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface DBSupplierLabourRateType {
  id: string;
  org_id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface DBSupplierTradeLink {
  supplier_id: string;
  trade_id: string;
  org_id: string;
}

export interface DBSupplierSpecialismLink {
  supplier_id: string;
  specialism_id: string;
  org_id: string;
}

export interface DBSupplierLabourRate {
  id: string;
  supplier_id: string;
  org_id: string;
  rate_type_id: string;
  standard_rate: number | null;
  overtime_rate: number | null;
  weekend_rate: number | null;
  night_rate: number | null;
  updated_at?: string;
}

export interface DBSupplierPqqResponse {
  id: string;
  supplier_id: string;
  org_id: string;
  section_key: string;
  responses: Record<string, unknown>;
  section_status: string;
  notes: string;
  completed_at?: string | null;
  completed_by: string;
  updated_at?: string;
}

export interface DBSupplierDocument {
  id: string;
  supplier_id: string;
  org_id: string;
  document_category: string;
  document_title: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  data_url: string;
  issue_date: string;
  expiry_date: string;
  verified: boolean;
  verified_by: string;
  verification_date: string;
  notes: string;
  created_by: string;
  created_at?: string;
}
