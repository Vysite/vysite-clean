export type AssetStatus = 'Active' | 'Out of Service' | 'Under Repair' | 'Replaced' | 'Decommissioned';
export type LocationStatus = 'Active' | 'Inactive';

export const ASSET_STATUSES: AssetStatus[] = [
  'Active', 'Out of Service', 'Under Repair', 'Replaced', 'Decommissioned',
];

export const ASSET_TYPES: string[] = [
  'AHU', 'Boiler', 'Pump', 'Fan', 'FCU', 'Chiller', 'Calorifier',
  'Control Panel', 'Valve', 'Electrical Panel', 'Medical Gas Equipment', 'Other',
];

export const ASSET_DOC_CATEGORIES: string[] = [
  'O&M Manual', 'Manufacturer Literature', 'Commissioning Record',
  'Warranty', 'Service Report', 'Service Receipt / Invoice',
  'Test Certificate', 'Photo', 'Other',
];

export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  'Active':        'bg-emerald-900/60 text-emerald-400',
  'Out of Service':'bg-amber-900/60 text-amber-400',
  'Under Repair':  'bg-orange-900/60 text-orange-400',
  'Replaced':      'bg-blue-900/60 text-blue-400',
  'Decommissioned':'bg-slate-800 text-slate-500',
};

export interface DBAssetSite {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  status: LocationStatus;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DBAssetBuilding {
  id: string;
  org_id: string;
  site_id: string | null;
  name: string;
  status: LocationStatus;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DBAssetLocation {
  id: string;
  org_id: string;
  building_id: string | null;
  name: string;
  floor: string | null;
  area: string | null;
  room: string | null;
  notes: string | null;
  status: LocationStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DBAsset {
  id: string;
  org_id: string;
  asset_tag: string;
  name: string;
  asset_type: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  site_id: string | null;
  building_id: string | null;
  location_id: string | null;
  status: AssetStatus;
  installation_date: string | null;
  commissioning_date: string | null;
  warranty_expiry: string | null;
  project_id: string | null;
  project_name: string | null;
  notes: string | null;
  public_asset_token: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DBAssetDocument {
  id: string;
  org_id: string;
  asset_id: string;
  name: string;
  category: string;
  file_type: string | null;
  file_size: number;
  storage_path: string | null;
  data_url: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  service_record_id?: string | null;
}

export interface DBAssetActivity {
  id: string;
  org_id: string;
  asset_id: string;
  type: string;
  text: string;
  user_name: string | null;
  created_at: string;
}

export interface DBAssetMedia {
  id: string;
  org_id: string;
  asset_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number;
  is_primary: boolean;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export type ServiceRecordStatus = 'Completed' | 'Open' | 'Follow-Up Required' | 'Awaiting Parts';
export type ServiceCondition = 'Good' | 'Satisfactory' | 'Poor' | 'Critical' | 'Not Assessed';

export const SERVICE_TYPES: string[] = [
  'Planned Service', 'Reactive Maintenance', 'Inspection', 'Repair',
  'Breakdown', 'Commissioning', 'Warranty Visit', 'Other',
];

export const SERVICE_STATUSES: ServiceRecordStatus[] = [
  'Completed', 'Open', 'Follow-Up Required', 'Awaiting Parts',
];

export const SERVICE_CONDITIONS: ServiceCondition[] = [
  'Good', 'Satisfactory', 'Poor', 'Critical', 'Not Assessed',
];

export const SERVICE_STATUS_COLORS: Record<ServiceRecordStatus, string> = {
  'Completed':           'bg-emerald-900/60 text-emerald-400',
  'Open':                'bg-sky-900/60 text-sky-400',
  'Follow-Up Required':  'bg-amber-900/60 text-amber-400',
  'Awaiting Parts':      'bg-orange-900/60 text-orange-400',
};

export const SERVICE_CONDITION_COLORS: Record<ServiceCondition, string> = {
  'Good':          'bg-emerald-900/60 text-emerald-400',
  'Satisfactory':  'bg-sky-900/60 text-sky-400',
  'Poor':          'bg-amber-900/60 text-amber-400',
  'Critical':      'bg-red-900/60 text-red-400',
  'Not Assessed':  'bg-slate-800 text-slate-500',
};

export interface DBAssetServiceRecord {
  id: string;
  org_id: string;
  asset_id: string;
  service_date: string;
  service_type: string;
  engineer_name: string | null;
  company: string | null;
  work_carried_out: string;
  condition: string | null;
  parts_replaced: string | null;
  recommendations: string | null;
  next_service_due: string | null;
  cost: number | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
