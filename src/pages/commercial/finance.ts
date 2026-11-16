// Shared financial calculation functions — the single source of commercial math.
// All monetary results are rounded to 2dp (decimal-safe); percentages are never rounded.

/** Round to 2 decimal places, guarding float drift (e.g. 0.1+0.2). */
export function round2(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Sum a list of monetary values, decimal-safe. */
export function sumMoney(values: number[]): number {
  return round2(values.reduce((s, v) => s + v, 0));
}

// ─── Valuation cumulative model ───────────────────────────────────────────────
// The Valuation Workbook is the authoritative source for applied values.
// Deduction order: MCD first (on gross valuation to date), then retention
// (on the nett valuation to date). Previous certified payments come from the
// latest preceding Payment Notice, with the preceding submitted valuation's
// cumulative gross payment as a clearly-labelled provisional fallback.

export interface ValuationInput {
  /** Cumulative current value of contract works (contract lines × current %). */
  contractCurrValue: number;
  /** Cumulative previous value of contract works (contract lines × previous %). */
  contractPrevValue: number;
  /** Cumulative current value of workbook extras / variations. */
  extrasCurrValue: number;
  /** Cumulative previous value of workbook extras / variations. */
  extrasPrevValue: number;
  mcdPct: number;
  retentionPct: number;
  /** Cumulative Gross Payment to Date from the latest preceding payment notice, if one exists. */
  previousCertifiedPayment: number | null;
  /** Cumulative Gross Payment to Date of the preceding submitted valuation (provisional fallback). */
  previousValuationGrossPayment: number | null;
}

export interface ValuationTotalsResult {
  contractCurrValue: number;
  contractPrevValue: number;
  contractThisVal: number;
  extrasCurrValue: number;
  extrasPrevValue: number;
  extrasThisVal: number;
  /** Gross Valuation to Date = contract + variations current values. */
  grossToDate: number;
  previousTotal: number;
  /** This-period amount before deductions (grossToDate − previousTotal). Not used for cumulative totals. */
  amountDue: number;
  mcdPct: number;
  mcdAmt: number;
  /** Nett Valuation to Date = grossToDate − MCD. */
  nettToDate: number;
  retentionPct: number;
  retentionAmt: number;
  /** Gross Payment to Date = nettToDate − retention (cumulative, after MCD, before retention-certified chain). */
  grossPaymentToDate: number;
  /** Source of the previous-payments figure. */
  previousPaymentsSource: 'payment_notice' | 'valuation_fallback' | 'none';
  /** Previous certified payments used (from notice, or provisional fallback). */
  previousPaymentsUsed: number;
  /** Cumulative payments certified to date (after retention). */
  cumulativeCertifiedToDate: number;
  /** Net Valuation Due = grossPaymentToDate − previousPaymentsUsed. */
  netValuationDue: number;
  /** True when previous payments came from the valuation fallback rather than a payment notice. */
  provisionalPrevious: boolean;
}

export function computeValuationTotals(input: ValuationInput): ValuationTotalsResult {
  const contractCurrValue = round2(input.contractCurrValue);
  const contractPrevValue = round2(input.contractPrevValue);
  const extrasCurrValue   = round2(input.extrasCurrValue);
  const extrasPrevValue   = round2(input.extrasPrevValue);

  const grossToDate   = round2(contractCurrValue + extrasCurrValue);
  const previousTotal = round2(contractPrevValue + extrasPrevValue);
  const amountDue     = round2(grossToDate - previousTotal);

  const mcdPct = input.mcdPct ?? 0;
  const mcdAmt = round2(grossToDate * mcdPct / 100);
  const nettToDate = round2(grossToDate - mcdAmt);

  const retentionPct = input.retentionPct ?? 0;
  const retentionAmt = round2(nettToDate * retentionPct / 100);
  const grossPaymentToDate = round2(nettToDate - retentionAmt);

  let previousPaymentsSource: ValuationTotalsResult['previousPaymentsSource'] = 'none';
  let previousPaymentsUsed = 0;
  if (input.previousCertifiedPayment != null) {
    previousPaymentsSource = 'payment_notice';
    previousPaymentsUsed = round2(input.previousCertifiedPayment);
  } else if (input.previousValuationGrossPayment != null) {
    previousPaymentsSource = 'valuation_fallback';
    previousPaymentsUsed = round2(input.previousValuationGrossPayment);
  }

  const cumulativeCertifiedToDate = round2(grossPaymentToDate);
  const netValuationDue = round2(grossPaymentToDate - previousPaymentsUsed);

  return {
    contractCurrValue, contractPrevValue,
    contractThisVal: round2(contractCurrValue - contractPrevValue),
    extrasCurrValue, extrasPrevValue,
    extrasThisVal: round2(extrasCurrValue - extrasPrevValue),
    grossToDate, previousTotal, amountDue,
    mcdPct, mcdAmt, nettToDate,
    retentionPct, retentionAmt, grossPaymentToDate,
    previousPaymentsSource, previousPaymentsUsed, cumulativeCertifiedToDate,
    netValuationDue, provisionalPrevious: previousPaymentsSource === 'valuation_fallback',
  };
}

/** True when a valuation's figures must be frozen (submitted, certified, locked, superseded). */
export function isValuationFrozen(status: string): boolean {
  return status === 'submitted' || status === 'certified' || status === 'locked' || status === 'superseded';
}

// ─── Variation Account classifications ────────────────────────────────────────
// signedValue treats magnitude + is_positive. classification distinguishes
// tendered items (already inside the original contract sum — they must never
// increase the Adjusted Contract Sum) from true additions/omissions.

export type VAClassification = 'addition' | 'omission' | 'tender_item';

export function signedValue(item: { value: number; is_positive: boolean }): number {
  return item.is_positive ? item.value : -item.value;
}

export function classificationOf(item: { classification?: string | null; is_positive: boolean }): VAClassification {
  if (item.classification === 'tender_item') return 'tender_item';
  return item.is_positive ? 'addition' : 'omission';
}

export interface ContractSumsInput {
  originalContractSum: number;
  /** Signed net agreed variations, EXCLUDING tendered items. */
  netAgreedVariations: number;
  /** Signed net outstanding exposure (submitted + under review), EXCLUDING tendered items. */
  netOutstandingExposure: number;
}

export interface ContractSumsResult {
  originalContractSum: number;
  adjustedContractSum: number;
  forecastContractSum: number;
}

export function computeContractSums(input: ContractSumsInput): ContractSumsResult {
  const original = round2(input.originalContractSum);
  const adjusted = round2(original + input.netAgreedVariations);
  const forecast = round2(adjusted + input.netOutstandingExposure);
  return { originalContractSum: original, adjustedContractSum: adjusted, forecastContractSum: forecast };
}

// ─── Overview valuation / payment model ───────────────────────────────────────

export interface OverviewPaymentModelInput {
  /** Cumulative gross payment (after MCD + retention) of the latest submitted valuation. */
  appliedPaymentToDate: number | null;
  /** Cumulative certified payment from the latest valid payment notice. */
  certifiedPaymentToDate: number | null;
  /** Total actual payments received. */
  paidToDate: number;
  /** Cumulative retention held per the latest valid notice. */
  retentionHeld: number | null;
}

export interface OverviewPaymentModel {
  appliedPaymentToDate: number | null;
  certifiedPaymentToDate: number | null;
  paidToDate: number;
  /** Latest submitted valuation's net due not yet certified. */
  awaitingCertification: number | null;
  /** Shortfall on an application with an actual notice (applied − certified). */
  certificationShortfall: number | null;
  outstandingCertifiedPayment: number | null;
  retentionHeld: number | null;
}

export function computeOverviewPayments(input: OverviewPaymentModelInput): OverviewPaymentModel {
  const applied = input.appliedPaymentToDate;
  const certified = input.certifiedPaymentToDate;
  const awaiting = applied != null && certified != null
    ? round2(applied - certified)
    : applied != null ? applied : null;
  return {
    appliedPaymentToDate: applied,
    certifiedPaymentToDate: certified,
    paidToDate: round2(input.paidToDate),
    awaitingCertification: awaiting,
    certificationShortfall: certified != null && applied != null ? round2(applied - certified) : null,
    outstandingCertifiedPayment: certified != null ? round2(certified - input.paidToDate) : null,
    retentionHeld: input.retentionHeld,
  };
}

// ─── Forecast revenue ─────────────────────────────────────────────────────────

export function netForecastRevenue(forecastContractSum: number, mcdPct: number, rebatePct: number): number {
  return round2(forecastContractSum * (1 - mcdPct / 100) * (1 - rebatePct / 100));
}

// ─── Progress / remaining ─────────────────────────────────────────────────────

export function financialProgress(grossAppliedToDate: number, adjustedContractSum: number): number | null {
  if (adjustedContractSum <= 0) return null;
  return Math.min(100, round2((grossAppliedToDate / adjustedContractSum) * 100));
}

export interface RemainingResult {
  remaining: number;
  /** Amount by which gross applied exceeds the adjusted contract sum (0 when within contract). */
  overContractValue: number;
}

export function remainingContractValue(grossAppliedToDate: number, adjustedContractSum: number): RemainingResult {
  const raw = round2(adjustedContractSum - grossAppliedToDate);
  return {
    remaining: Math.max(0, raw),
    overContractValue: raw < 0 ? round2(-raw) : 0,
  };
}
