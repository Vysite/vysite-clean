import React, { memo } from 'react';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { TakeoffGeometry, CountGeometry, LinearGeometry, AreaGeometry, NormPoint } from './takeoffGeometry';
import { isCountGeometry, isLinearGeometry, isAreaGeometry } from './takeoffGeometry';
import type { DBTenderDrawingCalibration } from './drawingTypes';
import { calcQuantity, distanceInPdfPoints } from './takeoffCalculations';

interface Props {
  items: DBTenderTakeoffItem[];
  selectedItemIds: Set<string>;
  selectedGeometryId: string | null;
  draftPoints: NormPoint[];
  tool: string;
  calibration: DBTenderDrawingCalibration | null;
  pageWidth: number;
  pageHeight: number;
  onGeometryClick: (itemId: string, geometryType: string, geometryId: string) => void;
  onVertexMouseDown: (itemId: string, geometryType: string, geometryId: string, vertexIndex: number, e: React.PointerEvent) => void;
}

function AnnotationLayerInner({ items, selectedItemIds, selectedGeometryId, draftPoints, tool, calibration, pageWidth, pageHeight, onGeometryClick, onVertexMouseDown }: Props) {
  const visibleItems = items.filter(i => i.is_visible && i.geometry);

  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {visibleItems.map(item => {
        const geo = item.geometry!;

        if (isCountGeometry(geo)) {
          return renderCount(geo, item, selectedGeometryId, onGeometryClick);
        }
        if (isLinearGeometry(geo)) {
          return renderLinear(geo, item, selectedGeometryId, calibration, pageWidth, pageHeight, onGeometryClick, onVertexMouseDown);
        }
        if (isAreaGeometry(geo)) {
          return renderArea(geo, item, selectedGeometryId, onGeometryClick, onVertexMouseDown);
        }
        return null;
      })}

      {/* Draft preview for linear/area */}
      {draftPoints.length >= 2 && tool === 'linear' && (
        <polyline
          points={draftPoints.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#f97316"
          strokeWidth={0.0015}
          strokeDasharray="0.008 0.004"
          pointerEvents="none"
        />
      )}
      {draftPoints.length >= 3 && tool === 'area' && (
        <polygon
          points={draftPoints.map(p => `${p.x},${p.y}`).join(' ')}
          fill="rgba(249,115,22,0.12)"
          stroke="#f97316"
          strokeWidth={0.0015}
          strokeDasharray="0.008 0.004"
          pointerEvents="none"
        />
      )}
      {draftPoints.length > 0 && (tool === 'linear' || tool === 'area') && draftPoints.map((p, i) => (
        <circle key={`draft-${i}`} cx={p.x} cy={p.y} r={0.003} fill="#f97316" pointerEvents="none" />
      ))}
    </svg>
  );
}

function renderCount(geo: CountGeometry, item: DBTenderTakeoffItem, selectedGeometryId: string, onGeometryClick: (itemId: string, gt: string, gid: string) => void) {
  return geo.points.map((pt, i) => {
    const isPtSelected = selectedGeometryId === pt.id;
    return (
      <g key={pt.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onGeometryClick(item.id, 'count', pt.id); }}>
        <circle cx={pt.x} cy={pt.y} r={isPtSelected ? 0.010 : 0.007} fill={item.colour} stroke="white" strokeWidth={0.0015} />
        <text x={pt.x} y={pt.y + 0.001} fontSize={0.006} fill="white" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{i + 1}</text>
        {isPtSelected && <circle cx={pt.x} cy={pt.y} r={0.014} fill="none" stroke="white" strokeWidth={0.0015} strokeDasharray="0.003 0.002" />}
      </g>
    );
  });
}

function renderLinear(geo: LinearGeometry, item: DBTenderTakeoffItem, selectedGeometryId: string, calibration: DBTenderDrawingCalibration | null, pageWidth: number, pageHeight: number, onGeometryClick: (itemId: string, gt: string, gid: string) => void, onVertexMouseDown: (itemId: string, gt: string, gid: string, vi: number, e: React.PointerEvent) => void) {
  return geo.segments.map(seg => {
    const isSegSelected = selectedGeometryId === seg.id;
    // Calculate measurement label
    const pdfPtDist = distanceInPdfPoints(seg.start, seg.end, pageWidth, pageHeight);
    const realDist = calibration?.scale_factor ? pdfPtDist * calibration.scale_factor : 0;
    const midX = (seg.start.x + seg.end.x) / 2;
    const midY = (seg.start.y + seg.end.y) / 2;
    const label = realDist > 0 ? `${realDist.toFixed(2)} ${calibration?.unit ?? ''}`.trim() : '';

    return (
      <g key={seg.id}>
        <line
          x1={seg.start.x} y1={seg.start.y} x2={seg.end.x} y2={seg.end.y}
          stroke={item.colour} strokeWidth={isSegSelected ? 0.003 : 0.0018}
          strokeLinecap="round"
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onGeometryClick(item.id, 'linear', seg.id); }}
        />
        {/* Small endpoint markers — always visible but understated */}
        <circle cx={seg.start.x} cy={seg.start.y} r={0.003} fill={item.colour} pointerEvents="none" />
        <circle cx={seg.end.x} cy={seg.end.y} r={0.003} fill={item.colour} pointerEvents="none" />
        {/* Measurement label */}
        {label && (
          <g pointerEvents="none">
            <rect x={midX - 0.04} y={midY - 0.008} width={0.08} height={0.016} fill="#0d1628" rx={0.003} opacity={0.85} />
            <text x={midX} y={midY + 0.001} fontSize={0.007} fill={item.colour} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text>
          </g>
        )}
        {/* Editable vertex handles when selected — small visible, larger hit */}
        {isSegSelected && [
          <circle key={`${seg.id}-s-hit`} cx={seg.start.x} cy={seg.start.y} r={0.012} fill="transparent"
            style={{ pointerEvents: 'all', cursor: 'move' }}
            onPointerDown={(e) => { e.stopPropagation(); onVertexMouseDown(item.id, 'linear', seg.id, 0, e); }}
          />,
          <circle key={`${seg.id}-s-vis`} cx={seg.start.x} cy={seg.start.y} r={0.005} fill="white" stroke={item.colour} strokeWidth={0.0015} pointerEvents="none" />,
          <circle key={`${seg.id}-e-hit`} cx={seg.end.x} cy={seg.end.y} r={0.012} fill="transparent"
            style={{ pointerEvents: 'all', cursor: 'move' }}
            onPointerDown={(e) => { e.stopPropagation(); onVertexMouseDown(item.id, 'linear', seg.id, 1, e); }}
          />,
          <circle key={`${seg.id}-e-vis`} cx={seg.end.x} cy={seg.end.y} r={0.005} fill="white" stroke={item.colour} strokeWidth={0.0015} pointerEvents="none" />,
        ]}
      </g>
    );
  });
}

function renderArea(geo: AreaGeometry, item: DBTenderTakeoffItem, selectedGeometryId: string, onGeometryClick: (itemId: string, gt: string, gid: string) => void, onVertexMouseDown: (itemId: string, gt: string, gid: string, vi: number, e: React.PointerEvent) => void) {
  return geo.polygons.map(poly => {
    const isPolySelected = selectedGeometryId === poly.id;
    const pointsStr = poly.vertices.map(v => `${v.x},${v.y}`).join(' ');
    return (
      <g key={poly.id}>
        <polygon
          points={pointsStr}
          fill={`${item.colour}26`}
          stroke={item.colour}
          strokeWidth={isPolySelected ? 0.003 : 0.0018}
          style={{ pointerEvents: 'all', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onGeometryClick(item.id, 'area', poly.id); }}
        />
        {isPolySelected && poly.vertices.map((v, vi) => (
          <g key={`${poly.id}-v${vi}`}>
            <circle cx={v.x} cy={v.y} r={0.012} fill="transparent"
              style={{ pointerEvents: 'all', cursor: 'move' }}
              onPointerDown={(e) => { e.stopPropagation(); onVertexMouseDown(item.id, 'area', poly.id, vi, e); }}
            />
            <circle cx={v.x} cy={v.y} r={0.005} fill="white" stroke={item.colour} strokeWidth={0.0015} pointerEvents="none" />
          </g>
        ))}
      </g>
    );
  });
}

export const TakeoffAnnotationLayer = memo(AnnotationLayerInner);
