export interface DBTenderDrawing {
  id: string;
  org_id: string;
  tender_id: string;
  drawing_number: string;
  title: string;
  discipline: string;
  revision: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  page_count: number;
  current_page: number;
  status: 'active' | 'archived';
  notes: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export type CalibrationMethod = 'preset' | 'manual' | 'none';

export interface CalibrationPoint {
  x: number;
  y: number;
}

export interface DBTenderDrawingCalibration {
  id: string;
  org_id: string;
  tender_id: string;
  drawing_id: string;
  page_number: number;
  method: CalibrationMethod;
  scale_ratio: string | null;
  scale_value: number | null;
  unit: string;
  reference_distance: number | null;
  pixel_distance: number | null;
  scale_factor: number | null;
  calibration_points: CalibrationPoint[] | null;
  created_at: string;
  updated_at: string;
}

export const PRESET_SCALES: { label: string; ratio: string; value: number }[] = [
  { label: '1:20', ratio: '1:20', value: 20 },
  { label: '1:50', ratio: '1:50', value: 50 },
  { label: '1:100', ratio: '1:100', value: 100 },
  { label: '1:200', ratio: '1:200', value: 200 },
  { label: '1:500', ratio: '1:500', value: 500 },
];

export const DISCIPLINES = [
  'General',
  'Architectural',
  'Structural',
  'Mechanical',
  'Electrical',
  'Civil',
  'Landscape',
  'Interior',
  'Fire Protection',
  'Drainage',
] as const;
