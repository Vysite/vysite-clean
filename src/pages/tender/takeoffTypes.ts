export type MeasurementType = 'count' | 'linear' | 'area';
export type TakeoffSource = 'drawing' | 'manual';
export type TakeoffLineType = 'standard' | 'addition' | 'omission';

export interface DBTenderTakeoffItem {
  id: string;
  org_id: string;
  tender_id: string;
  drawing_id: string | null;
  page_number: number;
  label: string;
  description: string;
  measurement_type: MeasurementType;
  quantity: number;
  unit: string;
  geometry: TakeoffGeometry | null;
  colour: string;
  notes: string;
  sort_order: number;
  is_visible: boolean;
  source: TakeoffSource;
  discipline: string;
  category: string;
  manual_quantity: number;
  adjustment_quantity: number;
  line_type: TakeoffLineType;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const TAKEOFF_COLOURS = [
  '#f97316', '#3b82f6', '#10b981', '#a855f7',
  '#ef4444', '#eab308', '#06b6d4', '#ec4899',
  '#84cc16', '#f59e0b',
];

export const DEFAULT_UNIT_FOR_TYPE: Record<MeasurementType, string> = {
  count: 'nr',
  linear: 'm',
  area: 'm²',
};
