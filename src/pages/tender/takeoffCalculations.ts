import type { NormPoint } from './takeoffGeometry';
import type { TakeoffGeometry, CountGeometry, LinearGeometry, AreaGeometry } from './takeoffGeometry';
import { isCountGeometry, isLinearGeometry, isAreaGeometry } from './takeoffGeometry';
import type { DBTenderDrawingCalibration } from './drawingTypes';

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
