import React, { memo } from 'react';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { TakeoffGeometry, CountGeometry, LinearGeometry, AreaGeometry, NormPoint, LinearSegment } from './takeoffGeometry';
import { isCountGeometry, isLinearGeometry, isAreaGeometry } from './takeoffGeometry';
import type { DBTenderDrawingCalibration } from './drawingTypes';
import { distanceInPdfPoints, polygonAreaPdfPoints, groupLinearRuns } from './takeoffCalculations';

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
          return renderArea(geo, item, selectedGeometryId, calibration, pageWidth, pageHeight, onGeometryClick, onVertexMouseDown);
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

function renderLinear(
  geo: LinearGeometry,
  item: DBTenderTakeoffItem,
  selectedGeometryId: string,
  calibration: DBTenderDrawingCalibration | null,
  pageWidth: number,
  pageHeight: number,
  onGeometryClick: (itemId: string, gt: string, gid: string) => void,
  onVertexMouseDown: (itemId: string, gt: string, gid: string, vi: number, e: React.PointerEvent) => void,
) {
  const runs = groupLinearRuns(geo, calibration, pageWidth, pageHeight);

  return runs.map(run => {
    const isRunSelected = selectedGeometryId === run.runId;
    const segs = run.segments;
    const totalPdfPts = segs.reduce((sum, s) => sum + distanceInPdfPoints(s.start, s.end, pageWidth, pageHeight), 0);
    const realDist = calibration?.scale_factor ? totalPdfPts * calibration.scale_factor : 0;

    // Label at midpoint of the entire run (middle segment)
    const midSeg = segs[Math.floor(segs.length / 2)];
    const midX = (midSeg.start.x + midSeg.end.x) / 2;
    const midY = (midSeg.start.y + midSeg.end.y) / 2;
    const label = realDist > 0 ? `${realDist.toFixed(2)} ${calibration?.unit ?? ''}`.trim() : '';

    return (
      <g key={run.runId}>
        {/* All segments of the run, drawn as individual lines for vertex editing */}
        {segs.map((seg, si) => (
          <line
            key={seg.id}
            x1={seg.start.x} y1={seg.start.y} x2={seg.end.x} y2={seg.end.y}
            stroke={item.colour}
            strokeWidth={isRunSelected ? 0.0024 : 0.0015}
            strokeLinecap="round"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onGeometryClick(item.id, 'linear', run.runId); }}
          />
        ))}
        {/* Endpoint markers at run start and end only */}
        <circle cx={segs[0].start.x} cy={segs[0].start.y} r={0.0025} fill={item.colour} pointerEvents="none" />
        <circle cx={segs[segs.length - 1].end.x} cy={segs[segs.length - 1].end.y} r={0.0025} fill={item.colour} pointerEvents="none" />
        {/* Measurement label — subtle when unselected, clearer when selected */}
        {label && (
          <g pointerEvents="none">
            {isRunSelected ? (
              <>
                <rect x={midX - 0.035} y={midY - 0.006} width={0.07} height={0.012} fill="#0d1628" rx={0.002} opacity={0.9} />
                <text x={midX} y={midY + 0.001} fontSize={0.005} fill={item.colour} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text>
              </>
            ) : (
              <>
                <rect x={midX - 0.03} y={midY - 0.005} width={0.06} height={0.01} fill="#0d1628" rx={0.002} opacity={0.55} />
                <text x={midX} y={midY + 0.001} fontSize={0.004} fill={item.colour} textAnchor="middle" dominantBaseline="middle" fontWeight="normal" opacity={0.85}>{label}</text>
              </>
            )}
          </g>
        )}
        {/* Vertex handles when run is selected */}
        {isRunSelected && segs.map((seg, si) => [
          <circle key={`${seg.id}-s-hit`} cx={seg.start.x} cy={seg.start.y} r={0.012} fill="transparent"
            style={{ pointerEvents: 'all', cursor: 'move' }}
            onPointerDown={(e) => { e.stopPropagation(); onVertexMouseDown(item.id, 'linear', seg.id, 0, e); }}
          />,
          <circle key={`${seg.id}-s-vis`} cx={seg.start.x} cy={seg.start.y} r={0.004} fill="white" stroke={item.colour} strokeWidth={0.0012} pointerEvents="none" />,
          // Only show end vertex handle on the last segment of the run
          ...(si === segs.length - 1 ? [
            <circle key={`${seg.id}-e-hit`} cx={seg.end.x} cy={seg.end.y} r={0.012} fill="transparent"
              style={{ pointerEvents: 'all', cursor: 'move' }}
              onPointerDown={(e) => { e.stopPropagation(); onVertexMouseDown(item.id, 'linear', seg.id, 1, e); }}
            />,
            <circle key={`${seg.id}-e-vis`} cx={seg.end.x} cy={seg.end.y} r={0.004} fill="white" stroke={item.colour} strokeWidth={0.0012} pointerEvents="none" />,
          ] : []),
        ])}
      </g>
    );
  });
}

function renderArea(
  geo: AreaGeometry,
  item: DBTenderTakeoffItem,
  selectedGeometryId: string,
  calibration: DBTenderDrawingCalibration | null,
  pageWidth: number,
  pageHeight: number,
  onGeometryClick: (itemId: string, gt: string, gid: string) => void,
  onVertexMouseDown: (itemId: string, gt: string, gid: string, vi: number, e: React.PointerEvent) => void,
) {
  return geo.polygons.map(poly => {
    const isPolySelected = selectedGeometryId === poly.id;
    const pointsStr = poly.vertices.map(v => `${v.x},${v.y}`).join(' ');
    const area = calibration?.scale_factor
      ? polygonAreaPdfPoints(poly.vertices, pageWidth, pageHeight) * calibration.scale_factor * calibration.scale_factor
      : 0;
    const label = area > 0 ? `${area.toFixed(2)} ${calibration?.unit ?? ''}²`.trim() : '';

    // Label at centroid
    let cx = 0, cy = 0;
    for (const v of poly.vertices) { cx += v.x; cy += v.y; }
    cx /= poly.vertices.length;
    cy /= poly.vertices.length;

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
        {label && (
          <g pointerEvents="none">
            <rect x={cx - 0.035} y={cy - 0.006} width={0.07} height={0.012} fill="#0d1628" rx={0.002} opacity={isPolySelected ? 0.9 : 0.55} />
            <text x={cx} y={cy + 0.001} fontSize={isPolySelected ? 0.005 : 0.004} fill={item.colour} textAnchor="middle" dominantBaseline="middle" fontWeight={isPolySelected ? 'bold' : 'normal'} opacity={isPolySelected ? 1 : 0.85}>{label}</text>
          </g>
        )}
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
