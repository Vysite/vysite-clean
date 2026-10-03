import type { MeasurementType } from './takeoffTypes';

export interface NormPoint {
  x: number;
  y: number;
}

export interface CountPoint {
  id: string;
  x: number;
  y: number;
}

export interface LinearSegment {
  id: string;
  start: NormPoint;
  end: NormPoint;
}

export interface AreaPolygon {
  id: string;
  vertices: NormPoint[];
  labelPos: NormPoint | null;
}

export interface CountGeometry {
  type: 'count';
  page: number;
  points: CountPoint[];
}

export interface LinearGeometry {
  type: 'linear';
  page: number;
  segments: LinearSegment[];
}

export interface AreaGeometry {
  type: 'area';
  page: number;
  polygons: AreaPolygon[];
}

export type TakeoffGeometry = CountGeometry | LinearGeometry | AreaGeometry;

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyGeometry(type: MeasurementType, page: number): TakeoffGeometry {
  switch (type) {
    case 'count': return { type: 'count', page, points: [] };
    case 'linear': return { type: 'linear', page, segments: [] };
    case 'area': return { type: 'area', page, polygons: [] };
  }
}

export function isCountGeometry(g: TakeoffGeometry): g is CountGeometry {
  return g.type === 'count';
}
export function isLinearGeometry(g: TakeoffGeometry): g is LinearGeometry {
  return g.type === 'linear';
}
export function isAreaGeometry(g: TakeoffGeometry): g is AreaGeometry {
  return g.type === 'area';
}

export function cloneGeometry(g: TakeoffGeometry): TakeoffGeometry {
  return JSON.parse(JSON.stringify(g));
}
