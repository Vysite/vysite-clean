import React, { memo } from 'react';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { CountGeometry } from './takeoffGeometry';
import { isCountGeometry } from './takeoffGeometry';

interface Props {
  items: DBTenderTakeoffItem[];
  selectedGeometryId: string | null;
  onSelect: (itemId: string, geometryId: string) => void;
}

function CountHitOverlayInner({ items, selectedGeometryId, onSelect }: Props) {
  const countItems = items.filter(i => i.is_visible && i.geometry && isCountGeometry(i.geometry));

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {countItems.map(item => {
        const geo = item.geometry as CountGeometry;
        return geo.points.map(pt => {
          const isSel = selectedGeometryId === pt.id;
          return (
            <button
              key={pt.id}
              onClick={(e) => { e.stopPropagation(); onSelect(item.id, pt.id); }}
              style={{
                position: 'absolute',
                left: `${pt.x * 100}%`,
                top: `${pt.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                pointerEvents: 'all',
                padding: 0,
              }}
              title={`Count #${geo.points.indexOf(pt) + 1}`}
            >
              {isSel && (
                <div style={{
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '50%',
                  border: '2px solid white',
                  pointerEvents: 'none',
                }} />
              )}
            </button>
          );
        });
      })}
    </div>
  );
}

export const TakeoffCountHitOverlay = memo(CountHitOverlayInner);
