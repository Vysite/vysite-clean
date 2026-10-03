import type { EstimateItem } from '../../data/types';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import { finalQuantity, calcTakeoffCosts } from './takeoffCalculations';

export type SyncStatus = 'not_synced' | 'synced' | 'changed' | 'zero_qty' | 'source_deleted';

export interface SyncReviewItem {
  takeoffItem: DBTenderTakeoffItem;
  status: SyncStatus;
  estimateLine: EstimateItem | null;
  takeoffQuantity: number;
  takeoffCostRate: number;
  takeoffLineType: string;
  estimateQuantity?: number;
  estimateCostRate?: number;
  estimateLineType?: string;
  isSelected: boolean;
}

export interface SyncResult {
  newEstimateItems: EstimateItem[];
  updatedEstimateItems: EstimateItem[];
  reviewItems: SyncReviewItem[];
}

const DEFAULT_MARKUP_PCT = 15;

export function takeoffCostRate(item: DBTenderTakeoffItem): number {
  const fq = finalQuantity(item);
  if (fq <= 0) return 0;
  const costs = calcTakeoffCosts(item);
  return costs.totalCost / fq;
}

export function takeoffSyncHash(item: DBTenderTakeoffItem): string {
  const fq = finalQuantity(item);
  const costRate = takeoffCostRate(item);
  const parts = [
    item.label || '',
    fq.toFixed(4),
    item.unit,
    costRate.toFixed(4),
    item.line_type,
  ];
  return parts.join('|');
}

export function getSyncStatus(
  takeoffItem: DBTenderTakeoffItem,
  estimateItems: EstimateItem[],
): SyncStatus {
  const fq = finalQuantity(takeoffItem);
  if (fq <= 0) return 'zero_qty';

  const linked = estimateItems.find(
    e => e.sourceType === 'takeoff' && e.sourceTakeoffItemId === takeoffItem.id,
  );
  if (!linked) return 'not_synced';
  if (!linked.sourceTakeoffSyncHash) return 'synced';
  const currentHash = takeoffSyncHash(takeoffItem);
  return linked.sourceTakeoffSyncHash === currentHash ? 'synced' : 'changed';
}

export function buildSyncReview(
  takeoffItems: DBTenderTakeoffItem[],
  estimateItems: EstimateItem[],
): SyncReviewItem[] {
  return takeoffItems.map(item => {
    const fq = finalQuantity(item);
    const status = getSyncStatus(item, estimateItems);
    const linked = estimateItems.find(
      e => e.sourceType === 'takeoff' && e.sourceTakeoffItemId === item.id,
    );

    return {
      takeoffItem: item,
      status,
      estimateLine: linked ?? null,
      takeoffQuantity: fq,
      takeoffCostRate: takeoffCostRate(item),
      takeoffLineType: item.line_type,
      estimateQuantity: linked?.quantity,
      estimateCostRate: linked?.costRate,
      estimateLineType: linked?.lineType,
      isSelected: status === 'not_synced' || status === 'changed',
    };
  });
}

function mapLineType(takeoffLineType: string): EstimateItem['lineType'] {
  return 'works';
}

export function createEstimateLineFromTakeoff(
  item: DBTenderTakeoffItem,
  lineNo: number,
): EstimateItem {
  const fq = finalQuantity(item);
  const costRate = takeoffCostRate(item);
  return {
    id: crypto.randomUUID(),
    lineNo,
    description: item.label || 'Untitled',
    unit: item.unit || 'Item',
    quantity: fq,
    costRate,
    markupPct: DEFAULT_MARKUP_PCT,
    lineType: mapLineType(item.line_type),
    includedInTenderSum: true,
    sourceType: 'takeoff',
    sourceTakeoffItemId: item.id,
    sourceTakeoffSyncHash: takeoffSyncHash(item),
    sourceTakeoffSyncedAt: new Date().toISOString(),
    sourceLineType: item.line_type,
  };
}

export function updateEstimateLineFromTakeoff(
  line: EstimateItem,
  item: DBTenderTakeoffItem,
): EstimateItem {
  const fq = finalQuantity(item);
  const costRate = takeoffCostRate(item);
  return {
    ...line,
    description: item.label || line.description,
    unit: item.unit || line.unit,
    quantity: fq,
    costRate,
    lineType: mapLineType(item.line_type),
    sourceTakeoffSyncHash: takeoffSyncHash(item),
    sourceTakeoffSyncedAt: new Date().toISOString(),
    sourceLineType: item.line_type,
  };
}

export function isLinkedEstimateLine(line: EstimateItem): boolean {
  return line.sourceType === 'takeoff' && !!line.sourceTakeoffItemId;
}

export function findOrphanedTakeoffEstimateLines(
  estimateItems: EstimateItem[],
  takeoffItemIds: Set<string>,
): EstimateItem[] {
  return estimateItems.filter(
    e => e.sourceType === 'takeoff' && e.sourceTakeoffItemId && !takeoffItemIds.has(e.sourceTakeoffItemId),
  );
}
