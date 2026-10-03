import type { NormPoint } from './takeoffGeometry';
import type { TakeoffGeometry, CountGeometry, LinearGeometry, AreaGeometry, LinearSegment, AreaPolygon } from './takeoffGeometry';
import { isCountGeometry, isLinearGeometry, isAreaGeometry } from './takeoffGeometry';
import type { DBTenderDrawingCalibration } from './drawingTypes';

// 1 PDF point = 1/72 inch = 25.4/72 mm on paper.
// At scale 1:N, 1 PDF point represents N × (25.4/72) mm in the real world.
const MM_PER_PDF_POINT = 25.4 / 72;

const UNIT_TO_MM: Record<string, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
};

/**
 * Compute the scale factor (real-world units per PDF point) for a preset scale.
 * Formula: (MM_PER_PDF_POINT × scaleRatio) / UNIT_TO_MM[unit]
 * This is independent of paper size — PDF points are a fixed physical unit.
 */
export function presetScaleFactor(scaleRatio: number, unit: string): number {
  const unitMm = UNIT_TO_MM[unit] ?? 1000;
  return (MM_PER_PDF_POINT * scaleRatio) / unitMm;
}

export function distanceInPdfPoints(a: NormPoint, b: NormPoint, pageWidth: number, pageHeight: number): number {
  const dx = (b.x - a.x) * pageWidth;
  const dy = (b.y - a.y) * pageHeight;
  return Math.sqrt(dx * dx + dy * dy);
}

export function polygonAreaPdfPoints(vertices: NormPoint[], pageWidth: number, pageHeight: number): number {
  if (vertices.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const xi = vertices[i].x * pageWidth;
    const yi = vertices[i].y * pageHeight;
    const xj = vertices[j].x * pageWidth;
    const yj = vertices[j].y * pageHeight;
    sum += xi * yj - xj * yi;
  }
  return Math.abs(sum) / 2;
}

export function calcQuantity(
  geometry: TakeoffGeometry | null,
  calibration: DBTenderDrawingCalibration | null,
  pageWidth: number,
  pageHeight: number,
): number {
  if (!geometry) return 0;

  if (isCountGeometry(geometry)) {
    return geometry.points.length;
  }

  if (!calibration || !calibration.scale_factor || calibration.scale_factor <= 0) return 0;

  if (isLinearGeometry(geometry)) {
    let totalPdfPoints = 0;
    for (const seg of geometry.segments) {
      totalPdfPoints += distanceInPdfPoints(seg.start, seg.end, pageWidth, pageHeight);
    }
    return totalPdfPoints * calibration.scale_factor;
  }

  if (isAreaGeometry(geometry)) {
    let totalArea = 0;
    for (const poly of geometry.polygons) {
      totalArea += polygonAreaPdfPoints(poly.vertices, pageWidth, pageHeight);
    }
    return totalArea * calibration.scale_factor * calibration.scale_factor;
  }

  return 0;
}

export function finalQuantity(item: {
  quantity: number;
  adjustment_quantity: number;
  manual_quantity: number;
  source: string;
}): number {
  if (item.source === 'manual') {
    return item.manual_quantity + item.adjustment_quantity;
  }
  return item.quantity + item.adjustment_quantity;
}

// ── Linear run helpers ────────────────────────────────────────────────────

export interface LinearRun {
  runId: string;
  segments: LinearSegment[];
  quantity: number;
}

export function groupLinearRuns(
  geo: LinearGeometry,
  calibration: DBTenderDrawingCalibration | null,
  pageWidth: number,
  pageHeight: number,
): LinearRun[] {
  const byRun = new Map<string, LinearSegment[]>();
  for (const seg of geo.segments) {
    const key = seg.runId || seg.id;
    if (!byRun.has(key)) byRun.set(key, []);
    byRun.get(key)!.push(seg);
  }
  const runs: LinearRun[] = [];
  for (const [runId, segs] of byRun) {
    let pdfPts = 0;
    for (const s of segs) {
      pdfPts += distanceInPdfPoints(s.start, s.end, pageWidth, pageHeight);
    }
    const qty = calibration?.scale_factor ? pdfPts * calibration.scale_factor : 0;
    runs.push({ runId, segments: segs, quantity: Math.round(qty * 10000) / 10000 });
  }
  return runs;
}

export function areaPolygonQuantity(
  poly: AreaPolygon,
  calibration: DBTenderDrawingCalibration | null,
  pageWidth: number,
  pageHeight: number,
): number {
  if (!calibration?.scale_factor) return 0;
  return polygonAreaPdfPoints(poly.vertices, pageWidth, pageHeight) * calibration.scale_factor * calibration.scale_factor;
}
