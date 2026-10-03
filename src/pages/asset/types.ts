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
