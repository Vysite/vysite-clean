import React, { memo } from 'react';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { TakeoffGeometry, CountGeometry, LinearGeometry, AreaGeometry, NormPoint } from './takeoffGeometry';
import { isCountGeometry, isLinearGeometry, isAreaGeometry } from './takeoffGeometry';

interface Props {
  items: DBTenderTakeoffItem[];
  selectedItemIds: Set<string>;
  selectedGeometryId: string | null;
  draftPoints: NormPoint[];
  tool: string;
  onGeometryClick: (itemId: string, geometryType: string, geometryId: string) => void;
  onVertexMouseDown: (itemId: string, geometryType: string, geometryId: string, vertexIndex: number, e: React.PointerEvent) => void;
}

function AnnotationLayerInner({ items, selectedItemIds, selectedGeometryId, draftPoints, tool, onGeometryClick, onVertexMouseDown }: Props) {
  const visibleItems = items.filter(i => i.is_visible && i.geometry);

  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {visibleItems.map(item => {
        const geo = item.geometry!;
        const isSelected = selectedGeometryId !== null && selectedItemIds.has(item.id);

        if (isCountGeometry(geo)) {
          return renderCount(geo, item, isSelected, selectedGeometryId, onGeometryClick);
        }
        if (isLinearGeometry(geo)) {
          return renderLinear(geo, item, isSelected, selectedGeometryId, onGeometryClick, onVertexMouseDown);
        }
        if (isAreaGeometry(geo)) {
          return renderArea(geo, item, isSelected, selectedGeometryId, onGeometryClick, onVertexMouseDown);
        }
        return null;
      })}

      {/* Draft preview for linear/area */}
      {draftPoints.length >= 2 && tool === 'linear' && (
        <polyline
          points={draftPoints.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#f97316"
          strokeWidth={0.003}
          strokeDasharray="0.01 0.005"
          pointerEvents="none"
        />
      )}
      {draftPoints.length >= 3 && tool === 'area' && (
        <polygon
          points={draftPoints.map(p => `${p.x},${p.y}`).join(' ')}
          fill="rgba(249,115,22,0.15)"
          stroke="#f97316"
          strokeWidth={0.003}
          strokeDasharray="0.01 0.005"
          pointerEvents="none"
        />
      )}
      {draftPoints.length > 0 && (tool === 'linear' || tool === 'area') && draftPoints.map((p, i) => (
        <circle key={`draft-${i}`} cx={p.x} cy={p.y} r={0.005} fill="#f97316" pointerEvents="none" />
      ))}
    </svg>
  );
}

function renderCount(geo: CountGeometry, item: DBTenderTakeoffItem, _isSelected: boolean, selectedGeometryId: string, onGeometryClick: (itemId: string, gt: string, gid: string) => void) {
  return geo.points.map((pt, i) => {
    const isPtSelected = selectedGeometryId === pt.id;
    return (
      <g key={pt.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onGeometryClick(item.id, 'count', pt.id); }}>
        <circle cx={pt.x} cy={pt.y} r={isPtSelected ? 0.012 : 0.008} fill={item.colour} stroke="white" strokeWidth={0.002} />
        <text x={pt.x} y={pt.y + 0.002} fontSize={0.008} fill="white" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{i + 1}</text>
        {isPtSelected && <circle cx={pt.x} cy={pt.y} r={0.016} fill="none" stroke="white" strokeWidth={0.002} strokeDasharray="0.004 0.002" />}
      </g>
    );
  });
}

function renderLinear(geo: LinearGeometry, item: DBTenderTakeoffItem, isSelected: boolean, selectedGeometryId: string, onGeometryClick: (itemId: string, gt: string, gid: string) => void, onVertexMouseDown: (itemId: string, gt: string, gid: string, vi: number, e: React.PointerEvent) => void) {
  return geo.segments.map(seg => {
    const isSegSelected = selectedGeometryId === seg.id;
    return (
      <g key={seg.id}>
        <line
          x1={seg.start.x} y1={seg.start.y} x2={seg.end.x} y2={seg.end.y}
          stroke={item.colour} strokeWidth={isSegSelected ? 0.005 : 0.003}
          strokeLinecap="round"
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onGeometryClick(item.id, 'linear', seg.id); }}
        />
        {/* Endpoint handles when selected */}
        {isSegSelected && [
          <circle key={`${seg.id}-s`} cx={seg.start.x} cy={seg.start.y} r={0.01} fill="white" stroke={item.colour} strokeWidth={0.003}
            style={{ pointerEvents: 'all', cursor: 'move' }}
            onPointerDown={(e) => { e.stopPropagation(); onVertexMouseDown(item.id, 'linear', seg.id, 0, e); }}
          />,
          <circle key={`${seg.id}-e`} cx={seg.end.x} cy={seg.end.y} r={0.01} fill="white" stroke={item.colour} strokeWidth={0.003}
            style={{ pointerEvents: 'all', cursor: 'move' }}
            onPointerDown={(e) => { e.stopPropagation(); onVertexMouseDown(item.id, 'linear', seg.id, 1, e); }}
          />,
        ]}
      </g>
    );
  });
}

function renderArea(geo: AreaGeometry, item: DBTenderTakeoffItem, isSelected: boolean, selectedGeometryId: string, onGeometryClick: (itemId: string, gt: string, gid: string) => void, onVertexMouseDown: (itemId: string, gt: string, gid: string, vi: number, e: React.PointerEvent) => void) {
  return geo.polygons.map(poly => {
    const isPolySelected = selectedGeometryId === poly.id;
    const pointsStr = poly.vertices.map(v => `${v.x},${v.y}`).join(' ');
    return (
      <g key={poly.id}>
        <polygon
          points={pointsStr}
          fill={`${item.colour}33`}
          stroke={item.colour}
          strokeWidth={isPolySelected ? 0.005 : 0.003}
          style={{ pointerEvents: 'all', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onGeometryClick(item.id, 'area', poly.id); }}
        />
        {isPolySelected && poly.vertices.map((v, vi) => (
          <circle key={`${poly.id}-v${vi}`} cx={v.x} cy={v.y} r={0.01} fill="white" stroke={item.colour} strokeWidth={0.003}
            style={{ pointerEvents: 'all', cursor: 'move' }}
            onPointerDown={(e) => { e.stopPropagation(); onVertexMouseDown(item.id, 'area', poly.id, vi, e); }}
          />
        ))}
      </g>
    );
  });
}

export const TakeoffAnnotationLayer = memo(AnnotationLayerInner);
