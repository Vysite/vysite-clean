import type { EstimateItem, EstimateLineType, Tender } from '../../data/types';

export function calcLine(item: EstimateItem) {
  const costTotal = item.quantity * item.costRate;
  const saleRate = item.costRate * (1 + item.markupPct / 100);
  const saleTotal = item.quantity * saleRate;
  const profit = saleTotal - costTotal;
  return { costTotal, saleRate, saleTotal, profit };
}

export function lineSign(item: EstimateItem): number {
  return item.sourceLineType === 'omission' ? -1 : 1;
}

export function calcLineSigned(item: EstimateItem) {
  const { costTotal, saleRate, saleTotal, profit } = calcLine(item);
  const sign = lineSign(item);
  return { costTotal, saleRate, saleTotal, profit, signedCostTotal: costTotal * sign, signedSaleTotal: saleTotal * sign, signedProfit: profit * sign };
}

export function getLineType(item: EstimateItem): EstimateLineType {
  return item.lineType ?? 'works';
}

export function isIncluded(item: EstimateItem): boolean {
  return item.includedInTenderSum ?? true;
}

export function groupTotals(arr: EstimateItem[]) {
  return arr.reduce((acc, it) => {
    const { signedCostTotal, signedSaleTotal, signedProfit } = calcLineSigned(it);
    return { cost: acc.cost + signedCostTotal, sale: acc.sale + signedSaleTotal, profit: acc.profit + signedProfit };
  }, { cost: 0, sale: 0, profit: 0 });
}

export interface EstimateSummary {
  worksItems: EstimateItem[];
  prelimItems: EstimateItem[];
  optionalItems: EstimateItem[];
  allowanceItems: EstimateItem[];
  optionalIncluded: EstimateItem[];
  optionalExcluded: EstimateItem[];
  worksTotals: { cost: number; sale: number; profit: number };
  prelimTotals: { cost: number; sale: number; profit: number };
  optIncludedTotals: { cost: number; sale: number; profit: number };
  optExcludedTotals: { cost: number; sale: number; profit: number };
  allowanceTotals: { cost: number; sale: number; profit: number };
  includedCost: number;
  tenderValueBeforeMcd: number;
  mcdType: 'none' | 'percentage' | 'fixed';
  mcdPct: number;
  mcdFixedValue: number;
  mcdValue: number;
  finalTenderSum: number;
  profitAfterMcd: number;
  marginAfterMcd: number;
}

export function computeEstimateSummary(tender: Tender): EstimateSummary {
  const items = tender.estimateItems ?? [];
  const worksItems = items.filter(it => getLineType(it) === 'works');
  const prelimItems = items.filter(it => getLineType(it) === 'preliminaries');
  const optionalItems = items.filter(it => getLineType(it) === 'optional');
  const allowanceItems = items.filter(it => getLineType(it) === 'allowance');
  const optionalIncluded = optionalItems.filter(it => isIncluded(it));
  const optionalExcluded = optionalItems.filter(it => !isIncluded(it));

  const worksTotals = groupTotals(worksItems);
  const prelimTotals = groupTotals(prelimItems);
  const optIncludedTotals = groupTotals(optionalIncluded);
  const optExcludedTotals = groupTotals(optionalExcluded);
  const allowanceTotals = groupTotals(allowanceItems);

  const includedCost = worksTotals.cost + prelimTotals.cost + optIncludedTotals.cost + allowanceTotals.cost;
  const tenderValueBeforeMcd = worksTotals.sale + prelimTotals.sale + optIncludedTotals.sale + allowanceTotals.sale;

  const mcdType = tender.mcdType ?? 'none';
  const mcdPct = tender.mcdPct ?? 0;
  const mcdFixedValue = tender.mcdFixedValue ?? 0;
  const mcdValue = mcdType === 'percentage'
    ? tenderValueBeforeMcd * mcdPct / 100
    : mcdType === 'fixed'
      ? mcdFixedValue
      : 0;
  const finalTenderSum = tenderValueBeforeMcd - mcdValue;
  const profitAfterMcd = finalTenderSum - includedCost;
  const marginAfterMcd = finalTenderSum > 0 ? (profitAfterMcd / finalTenderSum) * 100 : 0;

  return {
    worksItems, prelimItems, optionalItems, allowanceItems, optionalIncluded, optionalExcluded,
    worksTotals, prelimTotals, optIncludedTotals, optExcludedTotals, allowanceTotals,
    includedCost, tenderValueBeforeMcd, mcdType, mcdPct, mcdFixedValue, mcdValue,
    finalTenderSum, profitAfterMcd, marginAfterMcd,
  };
}

export function fmtNum(n: number): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtC(n: number): string {
  return `£${fmtNum(n)}`;
}

export function fmtDeduction(n: number): string {
  return `(${fmtC(Math.abs(n))})`;
}
