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
  {
    key: 'company_info',
    title: 'Company Information',
    fields: [
      { id: 'date_established', label: 'Date Established', type: 'date' },
      { id: 'legal_status', label: 'Legal Status (Ltd, LLP, Sole Trader, etc.)', type: 'text' },
      { id: 'parent_company', label: 'Parent Company Name (if applicable)', type: 'text' },
      { id: 'parent_guarantee', label: 'Is a parent company guarantee available?', type: 'yesnona' },
      { id: 'employee_count', label: 'Number of Employees', type: 'number' },
      { id: 'annual_turnover', label: 'Annual Turnover (£)', type: 'number' },
      { id: 'trading_years', label: 'Years Trading', type: 'number' },
    ],
  },
  {
    key: 'financial',
    title: 'Financial Information',
    fields: [
      { id: 'turnover_y1', label: 'Turnover — Year 1 (£)', type: 'number' },
      { id: 'turnover_y2', label: 'Turnover — Year 2 (£)', type: 'number' },
      { id: 'turnover_y3', label: 'Turnover — Year 3 (£)', type: 'number' },
      { id: 'net_profit', label: 'Net Profit Last Year (£)', type: 'number' },
      { id: 'vat_registered', label: 'Are you VAT registered?', type: 'yesno' },
      { id: 'ccj_history', label: 'Do you have any outstanding CCJs?', type: 'yesno' },
      { id: 'insolvency_history', label: 'Have you been involved in any insolvency proceedings in the last 5 years?', type: 'yesno' },
      { id: 'payment_terms', label: 'Required Payment Terms', type: 'text' },
    ],
  },
  {
    key: 'health_safety',
    title: 'Health & Safety',
    fields: [
      { id: 'hs_policy', label: 'Do you hold a written Health & Safety policy?', type: 'yesno' },
      { id: 'hs_policy_reviewed', label: 'Has the policy been reviewed in the last 12 months?', type: 'yesno' },
      { id: 'riddor_history', label: 'Do you have a RIDDOR history in the last 3 years?', type: 'yesno' },
      { id: 'fatalities', label: 'Have there been any fatalities in the last 3 years?', type: 'yesno' },
      { id: 'afr', label: 'Accident Frequency Rate (last 12 months)', type: 'number' },
      { id: 'hs_accreditation', label: 'H&S Accreditation (e.g. CHAS, Constructionline)', type: 'text' },
      { id: 'method_statements', label: 'Do you produce Method Statements and Risk Assessments?', type: 'yesno' },
      { id: 'toolbox_talks', label: 'Are Toolbox Talks carried out regularly?', type: 'yesno' },
    ],
  },
  {
    key: 'quality',
    title: 'Quality',
    fields: [
      { id: 'iso9001', label: 'Do you hold ISO 9001 certification?', type: 'yesno' },
      { id: 'iso9001_expiry', label: 'ISO 9001 Expiry Date', type: 'date' },
      { id: 'qms', label: 'Is a Quality Management System in place?', type: 'yesno' },
      { id: 'major_ncr', label: 'Have there been any major non-conformances in the last 3 years?', type: 'yesno' },
      { id: 'qms_description', label: 'Describe your quality management approach', type: 'text' },
    ],
  },
  {
    key: 'environmental',
    title: 'Environmental',
    fields: [
      { id: 'iso14001', label: 'Do you hold ISO 14001 certification?', type: 'yesno' },
      { id: 'iso14001_expiry', label: 'ISO 14001 Expiry Date', type: 'date' },
      { id: 'env_policy', label: 'Do you have an Environmental policy?', type: 'yesno' },
      { id: 'waste_carrier_reg', label: 'Waste Carrier Registration Number', type: 'text' },
      { id: 'carbon_reduction', label: 'Do you have a carbon reduction plan in place?', type: 'yesnona' },
    ],
  },
  {
    key: 'modern_slavery',
    title: 'Modern Slavery',
    fields: [
      { id: 'ms_policy', label: 'Do you have a Modern Slavery policy?', type: 'yesno' },
      { id: 'ms_statement', label: 'Is an annual Transparency Statement published?', type: 'yesnona' },
      { id: 'ms_training', label: 'Is Modern Slavery training provided to employees?', type: 'yesno' },
      { id: 'ms_due_diligence', label: 'Are supply chain due diligence checks carried out?', type: 'yesno' },
    ],
  },
  {
    key: 'equality_diversity',
    title: 'Equality & Diversity',
    fields: [
      { id: 'edi_policy', label: 'Do you have an Equality & Diversity policy?', type: 'yesno' },
      { id: 'equal_opportunities', label: 'Are you an equal opportunities employer?', type: 'yesno' },
      { id: 'equal_pay_issues', label: 'Have there been any equal pay issues in the last 3 years?', type: 'yesno' },
      { id: 'edi_training', label: 'Is EDI training provided to employees?', type: 'yesno' },
    ],
  },
  {
    key: 'insurance',
    title: 'Insurance',
    fields: [
      { id: 'pl_limit', label: 'Public Liability — Limit (£)', type: 'number' },
      { id: 'pl_insurer', label: 'Public Liability — Insurer', type: 'text' },
      { id: 'pl_expiry', label: 'Public Liability — Expiry Date', type: 'date' },
      { id: 'el_limit', label: "Employer's Liability — Limit (£)", type: 'number' },
      { id: 'el_insurer', label: "Employer's Liability — Insurer", type: 'text' },
      { id: 'el_expiry', label: "Employer's Liability — Expiry Date", type: 'date' },
      { id: 'pi_limit', label: 'Professional Indemnity — Limit (£)', type: 'number' },
      { id: 'pi_expiry', label: 'Professional Indemnity — Expiry Date', type: 'date' },
      { id: 'cw_limit', label: 'Contract Works — Limit (£)', type: 'number' },
      { id: 'cw_expiry', label: 'Contract Works — Expiry Date', type: 'date' },
    ],
  },
  {
    key: 'accreditations',
    title: 'Accreditations',
    fields: [
      { id: 'chas', label: 'CHAS registered?', type: 'yesno' },
      { id: 'chas_expiry', label: 'CHAS Expiry Date', type: 'date' },
      { id: 'constructionline', label: 'Constructionline registered?', type: 'yesno' },
      { id: 'niceic', label: 'NICEIC / ECA / NAPIT registered?', type: 'yesnona' },
      { id: 'gas_safe', label: 'Gas Safe registered?', type: 'yesnona' },
      { id: 'besa', label: 'BESA member?', type: 'yesnona' },
      { id: 'other_accreditations', label: 'Other accreditations / memberships', type: 'text' },
    ],
  },
  {
    key: 'workforce',
    title: 'Workforce Competency',
    fields: [
      { id: 'qualified_pct', label: '% of workforce with relevant trade qualifications', type: 'number' },
      { id: 'cscs_scheme', label: 'CSCS scheme in use?', type: 'yesno' },
      { id: 'apprenticeships', label: 'Do you operate an apprenticeship scheme?', type: 'yesno' },
      { id: 'nvq_training', label: 'Is NVQ / SVQ training provided?', type: 'yesno' },
      { id: 'gang_subcontracting', label: 'Do you use labour-only gangs or sub-contracting?', type: 'yesno' },
      { id: 'direct_workforce_pct', label: '% of works carried out by direct workforce', type: 'number' },
    ],
  },
  {
    key: 'references',
    title: 'References',
    fields: [
      { id: 'ref1_company', label: 'Reference 1 — Company', type: 'text' },
      { id: 'ref1_contact', label: 'Reference 1 — Contact Name', type: 'text' },
      { id: 'ref1_phone', label: 'Reference 1 — Phone', type: 'text' },
      { id: 'ref1_email', label: 'Reference 1 — Email', type: 'text' },
      { id: 'ref1_works', label: 'Reference 1 — Nature of Works', type: 'text' },
      { id: 'ref1_value', label: 'Reference 1 — Contract Value (£)', type: 'number' },
      { id: 'ref2_company', label: 'Reference 2 — Company', type: 'text' },
      { id: 'ref2_contact', label: 'Reference 2 — Contact Name', type: 'text' },
      { id: 'ref2_phone', label: 'Reference 2 — Phone', type: 'text' },
      { id: 'ref2_email', label: 'Reference 2 — Email', type: 'text' },
      { id: 'ref2_works', label: 'Reference 2 — Nature of Works', type: 'text' },
      { id: 'ref2_value', label: 'Reference 2 — Contract Value (£)', type: 'number' },
      { id: 'ref3_company', label: 'Reference 3 — Company', type: 'text' },
      { id: 'ref3_contact', label: 'Reference 3 — Contact Name', type: 'text' },
      { id: 'ref3_phone', label: 'Reference 3 — Phone', type: 'text' },
      { id: 'ref3_email', label: 'Reference 3 — Email', type: 'text' },
      { id: 'ref3_works', label: 'Reference 3 — Nature of Works', type: 'text' },
      { id: 'ref3_value', label: 'Reference 3 — Contract Value (£)', type: 'number' },
    ],
  },
  {
    key: 'commercial_pqq',
    title: 'Commercial Information',
    fields: [
      { id: 'payment_terms_req', label: 'Required Payment Terms', type: 'text' },
      { id: 'retention_acceptable', label: 'Are standard retention terms acceptable?', type: 'yesno' },
      { id: 'dlp_acceptable', label: 'Are standard defects liability period terms acceptable?', type: 'yesno' },
      { id: 'max_contract_value', label: 'Maximum Single Contract Value (£)', type: 'number' },
      { id: 'preferred_procurement', label: 'Preferred Procurement Route', type: 'text' },
      { id: 'insurance_backed_warranty', label: 'Can you provide an insurance-backed warranty?', type: 'yesnona' },
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
