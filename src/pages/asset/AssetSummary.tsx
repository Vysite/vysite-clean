import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle, Clock, Wrench, Calendar, Activity, ShieldCheck, Gauge, PoundSterling, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBAsset, DBAssetServiceRecord, ServiceCondition } from './types';
import { SERVICE_CONDITION_COLORS, SERVICE_STATUS_COLORS, SERVICE_TYPES } from './types';

interface Props {
  asset: DBAsset;
  canViewFinancials: boolean;
}

function fmtGBP(v: number | null | undefined): string {
  if (v == null) return '\u2014';
  return '\u00a3' + Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '\u2014';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '\u2014';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtAge(d: string | null | undefined): string {
  if (!d) return '\u2014';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '\u2014';
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  if (diffMs < 0) return '\u2014';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  const months = (now.getFullYear() - dt.getFullYear()) * 12 + (now.getMonth() - dt.getMonth());
  if (now.getDate() < dt.getDate()) months - 1;
  if (months < 12) return `${Math.max(1, months)} month${months === 1 ? '' : 's'}`;
  const years = months / 12;
  if (years < 10) return `${years.toFixed(1)} years`;
  return `${Math.floor(years)} years`;
}

// ─── Lifecycle review logic ───

type ReviewStatus = 'normal' | 'monitor' | 'review';

interface ReviewResult {
  status: ReviewStatus;
  reasons: string[];
}

const REVIEW_THRESHOLDS = {
  spendVsReplacementHigh: 0.40,
  spendVsReplacementVeryHigh: 0.60,
  reactiveCountConcern: 3,
  breakdownCountConcern: 2,
  spendTrendIncreaseConcern: 0.50,
} as const;

function evaluateLifecycle(
  spendVsReplacement: number | null,
  hasReplacementCost: boolean,
  condition: string | null,
  reactiveCount12m: number,
  breakdownCount12m: number,
  last12Spend: number,
  prev12Spend: number,
  hasServiceHistory: boolean,
): ReviewResult {
  const reasons: string[] = [];

  if (!hasServiceHistory) {
    if (!hasReplacementCost) {
      return { status: 'normal', reasons: ['No Service & Maintenance history recorded for this Asset. Current replacement cost has not been recorded, so lifecycle expenditure cannot yet be compared against replacement value.'] };
    }
    return { status: 'normal', reasons: ['No Service & Maintenance history recorded for this Asset.'] };
  }

  const isCritical = condition === 'Critical';
  const isPoor = condition === 'Poor';
  const spendHigh = spendVsReplacement != null && spendVsReplacement >= REVIEW_THRESHOLDS.spendVsReplacementHigh;
  const spendVeryHigh = spendVsReplacement != null && spendVsReplacement >= REVIEW_THRESHOLDS.spendVsReplacementVeryHigh;
  const reactiveConcern = reactiveCount12m >= REVIEW_THRESHOLDS.reactiveCountConcern;
  const breakdownConcern = breakdownCount12m >= REVIEW_THRESHOLDS.breakdownCountConcern;

  let trendIncreasing = false;
  let trendPct: number | null = null;
  if (prev12Spend > 0 && last12Spend > prev12Spend) {
    trendPct = ((last12Spend - prev12Spend) / prev12Spend) * 100;
    if (trendPct >= REVIEW_THRESHOLDS.spendTrendIncreaseConcern * 100) trendIncreasing = true;
  }

  if (isCritical) {
    reasons.push('Current condition is recorded as Critical.');
  }
  if (isPoor) {
    reasons.push('Current condition is recorded as Poor.');
  }
  if (spendVeryHigh) {
    reasons.push(`Lifetime service and maintenance expenditure has reached ${Math.round(spendVsReplacement! * 100)}% of current replacement value.`);
  } else if (spendHigh) {
    reasons.push(`Lifetime service and maintenance expenditure has reached ${Math.round(spendVsReplacement! * 100)}% of current replacement value.`);
  }
  if (reactiveConcern) {
    reasons.push(`${reactiveCount12m} reactive maintenance visits during the last 12 months.`);
  }
  if (breakdownConcern) {
    reasons.push(`${breakdownCount12m} breakdown events during the last 12 months.`);
  }
  if (trendIncreasing && trendPct != null) {
    reasons.push(`Maintenance expenditure has increased by ${Math.round(trendPct)}% compared to the previous 12 months.`);
  }

  // Determine status
  if (isCritical) return { status: 'review', reasons };
  if (spendVeryHigh && (isPoor || reactiveConcern || breakdownConcern)) return { status: 'review', reasons };
  if (spendHigh && isPoor && (reactiveConcern || breakdownConcern)) return { status: 'review', reasons };
  if (isPoor && reactiveConcern && trendIncreasing) return { status: 'review', reasons };
  if (isPoor && breakdownConcern) return { status: 'review', reasons };
  if (spendVeryHigh) return { status: 'review', reasons };
  if (spendHigh && (reactiveConcern || breakdownConcern || trendIncreasing || isPoor)) return { status: 'monitor', reasons };
  if (isPoor) return { status: 'monitor', reasons };
  if (reactiveConcern || breakdownConcern) return { status: 'monitor', reasons };
  if (trendIncreasing) return { status: 'monitor', reasons };

  if (!hasReplacementCost) {
    return {
      status: 'normal',
      reasons: ['No significant reactive maintenance or breakdown pattern has been identified. Current replacement cost has not been recorded, so lifecycle expenditure cannot yet be compared against replacement value.'],
    };
  }

  return {
    status: 'normal',
    reasons: ['Recorded maintenance expenditure remains low relative to current replacement cost and no significant reactive pattern has been identified.'],
  };
}

// ─── Spend trend chart ───

function SpendTrendChart({ annualSpend }: { annualSpend: { year: number; total: number }[] }) {
  if (annualSpend.length === 0) {
    return <p className="text-sm text-slate-600 italic py-4">No spend data recorded.</p>;
  }

  const maxVal = Math.max(...annualSpend.map(a => a.total), 1);
  const barColor = 'bg-[#f97316]';

  return (
    <div className="space-y-2">
      {annualSpend.map(a => {
        const pct = (a.total / maxVal) * 100;
        return (
          <div key={a.year} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono w-12 shrink-0">{a.year}</span>
            <div className="flex-1 h-7 bg-[#0d1628] rounded-lg overflow-hidden relative">
              <div className={`${barColor} h-full rounded-lg transition-all duration-500`} style={{ width: `${Math.max(pct, 2)}%` }} />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-300">{fmtGBP(a.total)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───

export default function AssetSummary({ asset, canViewFinancials }: Props) {
  const store = useAppStore();
  const [records, setRecords] = useState<DBAssetServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    store.loadAssetServiceRecords(asset.id).then(() => setLoading(false));
  }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setRecords(store.assetServiceRecords ?? []);
  }, [store.assetServiceRecords]);

  const calc = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const twentyFourMonthsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

    const lifetimeSpend = records.reduce((sum, r) => sum + (r.cost ?? 0), 0);

    const last12Records = records.filter(r => r.service_date && new Date(r.service_date) >= twelveMonthsAgo);
    const last12Spend = last12Records.reduce((sum, r) => sum + (r.cost ?? 0), 0);

    const prev12Records = records.filter(r => {
      if (!r.service_date) return false;
      const d = new Date(r.service_date);
      return d >= twentyFourMonthsAgo && d < twelveMonthsAgo;
    });
    const prev12Spend = prev12Records.reduce((sum, r) => sum + (r.cost ?? 0), 0);

    const spendVsReplacement = asset.current_replacement_cost != null && asset.current_replacement_cost > 0
      ? lifetimeSpend / asset.current_replacement_cost
      : null;

    const reactiveTypes = ['Reactive Maintenance', 'Repair', 'Breakdown'];
    const reactiveCount12m = last12Records.filter(r => reactiveTypes.includes(r.service_type)).length;
    const breakdownCount12m = last12Records.filter(r => r.service_type === 'Breakdown').length;

    // Cost breakdown by type
    const breakdownMap = new Map<string, { total: number; count: number }>();
    records.forEach(r => {
      const existing = breakdownMap.get(r.service_type) ?? { total: 0, count: 0 };
      existing.total += r.cost ?? 0;
      existing.count += 1;
      breakdownMap.set(r.service_type, existing);
    });
    const costBreakdown = Array.from(breakdownMap.entries())
      .map(([type, v]) => ({ type, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total);

    // Annual spend
    const annualMap = new Map<number, number>();
    records.forEach(r => {
      if (!r.service_date) return;
      const yr = new Date(r.service_date).getFullYear();
      annualMap.set(yr, (annualMap.get(yr) ?? 0) + (r.cost ?? 0));
    });
    const annualSpend = Array.from(annualMap.entries())
      .map(([year, total]) => ({ year, total }))
      .sort((a, b) => a.year - b.year);

    // Latest condition
    const sortedByDate = [...records].sort((a, b) => (b.service_date || '').localeCompare(a.service_date || ''));
    const latestCondition = sortedByDate.find(r => r.condition && r.condition !== 'Not Assessed')?.condition ?? sortedByDate[0]?.condition ?? null;

    // Last service
    const lastService = sortedByDate[0] ?? null;

    // Next service due — find the most relevant future due date from completed records
    const nextDueDates = records
      .filter(r => r.next_service_due && r.status !== 'Open')
      .map(r => r.next_service_due!)
      .sort((a, b) => a.localeCompare(b));
    const todayStr = now.toISOString().slice(0, 10);
    const nextServiceDue = nextDueDates.length > 0 ? nextDueDates[nextDueDates.length - 1] : null;
    const nextDueStatus: 'up_to_date' | 'due_soon' | 'overdue' | 'not_scheduled' = (() => {
      if (!nextServiceDue) return 'not_scheduled';
      const dueDate = new Date(nextServiceDue);
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return 'overdue';
      if (diffDays <= 30) return 'due_soon';
      return 'up_to_date';
    })();

    // Asset age
    const ageDate = asset.installation_date ?? asset.commissioning_date ?? null;

    // Warranty
    const warrantyStatus: 'under' | 'expired' | 'not_recorded' = (() => {
      if (!asset.warranty_expiry) return 'not_recorded';
      return new Date(asset.warranty_expiry) > now ? 'under' : 'expired';
    })();

    // Data completeness
    const dataFields = [
      { label: 'Installation Date', present: !!asset.installation_date },
      { label: 'Current Replacement Cost', present: asset.current_replacement_cost != null },
      { label: 'Service History', present: records.length > 0 },
      { label: 'Current Condition', present: !!latestCondition && latestCondition !== 'Not Assessed' },
      { label: 'Next Service Due', present: !!nextServiceDue },
    ];
    const dataComplete = dataFields.filter(f => f.present).length;
    const dataTotal = dataFields.length;

    // Trend comparison
    let trendPct: number | null = null;
    if (prev12Spend > 0 && last12Spend > prev12Spend) {
      trendPct = ((last12Spend - prev12Spend) / prev12Spend) * 100;
    }

    // Lifecycle review
    const hasReplacementCost = asset.current_replacement_cost != null && asset.current_replacement_cost > 0;

    const review = evaluateLifecycle(
      spendVsReplacement,
      hasReplacementCost,
      latestCondition,
      reactiveCount12m,
      breakdownCount12m,
      last12Spend,
      prev12Spend,
      records.length > 0,
    );

    return {
      lifetimeSpend,
      last12Spend,
      prev12Spend,
      spendVsReplacement,
      reactiveCount12m,
      breakdownCount12m,
      costBreakdown,
      annualSpend,
      latestCondition,
      lastService,
      nextServiceDue,
      nextDueStatus,
      ageDate,
      warrantyStatus,
      dataFields,
      dataComplete,
      dataTotal,
      trendPct,
      review,
      totalRecords: records.length,
    };
  }, [records, asset.current_replacement_cost, asset.installation_date, asset.commissioning_date, asset.warranty_expiry]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" />
      </div>
    );
  }

  const reviewConfig = {
    normal: { bg: 'bg-emerald-900/20', border: 'border-emerald-800/40', text: 'text-emerald-400', icon: CheckCircle, label: 'NORMAL' },
    monitor: { bg: 'bg-amber-900/20', border: 'border-amber-800/40', text: 'text-amber-400', icon: AlertTriangle, label: 'MONITOR' },
    review: { bg: 'bg-red-900/20', border: 'border-red-800/40', text: 'text-red-400', icon: AlertTriangle, label: 'LIFECYCLE COST REVIEW RECOMMENDED' },
  };
  const rc = reviewConfig[calc.review.status];
  const ReviewIcon = rc.icon;

  const nextDueConfig = {
    up_to_date: { text: 'Up to Date', cls: 'bg-emerald-900/60 text-emerald-400' },
    due_soon: { text: 'Due Soon', cls: 'bg-amber-900/60 text-amber-400' },
    overdue: { text: 'Overdue', cls: 'bg-red-900/60 text-red-400' },
    not_scheduled: { text: 'Not Scheduled', cls: 'bg-slate-800 text-slate-500' },
  };
  const ndc = nextDueConfig[calc.nextDueStatus];

  const warrantyConfig = {
    under: { text: 'Under Warranty', cls: 'bg-emerald-900/60 text-emerald-400' },
    expired: { text: 'Warranty Expired', cls: 'bg-red-900/60 text-red-400' },
    not_recorded: { text: 'Not Recorded', cls: 'bg-slate-800 text-slate-500' },
  };
  const wc = warrantyConfig[calc.warrantyStatus];

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {canViewFinancials ? (
          <>
            <KPICard label="Original Asset Cost" value={fmtGBP(asset.original_asset_cost)} icon={PoundSterling} />
            <KPICard label="Current Replacement Cost" value={fmtGBP(asset.current_replacement_cost)} icon={PoundSterling} />
            <KPICard label="Lifetime Service Spend" value={fmtGBP(calc.lifetimeSpend)} icon={TrendingUp} />
            <KPICard
              label="Spend vs Replacement"
              value={calc.spendVsReplacement != null ? `${(calc.spendVsReplacement * 100).toFixed(1)}%` : '\u2014'}
              icon={Gauge}
              subText={calc.spendVsReplacement == null && asset.current_replacement_cost == null ? 'Replacement cost required' : undefined}
            />
            <KPICard label="Last 12 Months Spend" value={fmtGBP(calc.last12Spend)} icon={Activity} />
          </>
        ) : (
          <>
            <KPICard label="Asset Age" value={fmtAge(calc.ageDate)} icon={Clock} />
            <KPICard label="Total Service Records" value={String(calc.totalRecords)} icon={Wrench} />
            <KPICard label="Current Condition" value={calc.latestCondition ?? '\u2014'} icon={Gauge} />
            <KPICard label="Service Status" value={ndc.text} icon={CheckCircle} />
            <KPICard label="Warranty" value={wc.text} icon={ShieldCheck} />
          </>
        )}
      </div>

      {canViewFinancials && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPICard label="Asset Age" value={fmtAge(calc.ageDate)} icon={Clock} />
          <KPICard label="Total Service Records" value={String(calc.totalRecords)} icon={Wrench} />
          <KPICard label="Reactive Visits (12m)" value={String(calc.reactiveCount12m)} icon={AlertTriangle} />
          <KPICard label="Breakdowns (12m)" value={String(calc.breakdownCount12m)} icon={AlertTriangle} />
          <KPICard label="Current Condition" value={calc.latestCondition ?? '\u2014'} icon={Gauge} />
        </div>
      )}

      {/* Lifecycle Review */}
      <div className={`rounded-xl border p-5 ${rc.bg} ${rc.border}`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl ${rc.bg} border ${rc.border} flex items-center justify-center shrink-0`}>
            <ReviewIcon size={20} className={rc.text} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-bold ${rc.text} uppercase tracking-wider`}>{rc.label}</h3>
            <div className="mt-2 space-y-1">
              {calc.review.reasons.map((reason, i) => (
                <p key={i} className="text-sm text-slate-300 leading-relaxed">{reason}</p>
              ))}
            </div>
            {calc.review.status !== 'normal' && (
              <p className="text-[10px] text-slate-500 mt-3">
                This is decision support based on recorded data. Replacement decisions should consider engineering condition, criticality, operational requirements, compliance, and other factors.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Service Position + Warranty */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
          <h3 className="text-xs font-bold text-[#f97316] uppercase tracking-wider mb-4">Service Position</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Last Service</span>
              <div className="text-right">
                <span className="text-sm text-slate-200 font-medium">{calc.lastService ? fmtDate(calc.lastService.service_date) : '\u2014'}</span>
                {calc.lastService && <span className="text-[10px] text-slate-600 block">{calc.lastService.service_type}</span>}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Next Service Due</span>
              <span className="text-sm text-slate-200 font-medium">{fmtDate(calc.nextServiceDue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Service Status</span>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${ndc.cls}`}>{ndc.text}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Current Condition</span>
              {calc.latestCondition ? (
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${SERVICE_CONDITION_COLORS[calc.latestCondition as ServiceCondition] ?? 'bg-slate-800 text-slate-500'}`}>{calc.latestCondition}</span>
              ) : <span className="text-sm text-slate-600">Not Assessed</span>}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Total Records</span>
              <span className="text-sm text-slate-200 font-medium">{calc.totalRecords}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
          <h3 className="text-xs font-bold text-[#f97316] uppercase tracking-wider mb-4">Warranty & Data Quality</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Warranty Status</span>
              <div className="text-right">
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${wc.cls}`}>{wc.text}</span>
                {asset.warranty_expiry && <span className="text-[10px] text-slate-600 block mt-0.5">Expires {fmtDate(asset.warranty_expiry)}</span>}
              </div>
            </div>
            <div className="pt-2 border-t border-[#0d1628]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-500">Lifecycle Data</span>
                <span className="text-xs text-slate-300 font-medium">{calc.dataComplete} of {calc.dataTotal} key fields</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: calc.dataTotal }).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < calc.dataComplete ? 'bg-[#f97316]' : 'bg-[#0d1628]'}`} />
                ))}
              </div>
              <div className="mt-2 space-y-0.5">
                {calc.dataFields.map(f => (
                  <div key={f.label} className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${f.present ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                    <span className="text-[10px] text-slate-600">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown + Spend Trend */}
      {canViewFinancials && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
            <h3 className="text-xs font-bold text-[#f97316] uppercase tracking-wider mb-4">Cost Breakdown by Service Type</h3>
            {calc.costBreakdown.length === 0 ? (
              <p className="text-sm text-slate-600 italic py-4">No service cost data recorded.</p>
            ) : (
              <div className="space-y-2">
                {calc.costBreakdown.map(c => (
                  <div key={c.type} className="flex items-center gap-3 py-1">
                    <span className="text-xs text-slate-400 flex-1">{c.type}</span>
                    <span className="text-sm text-slate-200 font-medium w-24 text-right">{fmtGBP(c.total)}</span>
                    <span className="text-[10px] text-slate-600 w-20 text-right">{c.count} {c.count === 1 ? 'record' : 'records'}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-2 mt-1 border-t border-[#0d1628]">
                  <span className="text-xs text-[#f97316] font-bold flex-1 uppercase tracking-wider">Total</span>
                  <span className="text-sm text-white font-bold w-24 text-right">{fmtGBP(calc.lifetimeSpend)}</span>
                  <span className="text-[10px] text-slate-500 w-20 text-right">{calc.totalRecords} records</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
            <h3 className="text-xs font-bold text-[#f97316] uppercase tracking-wider mb-4">Service & Maintenance Spend Over Time</h3>
            <SpendTrendChart annualSpend={calc.annualSpend} />

            {/* Recent cost trend comparison */}
            <div className="mt-4 pt-4 border-t border-[#0d1628]">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Cost Trend</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-slate-600">Last 12 Months</p>
                  <p className="text-sm text-slate-200 font-semibold">{fmtGBP(calc.last12Spend)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-600">Previous 12 Months</p>
                  <p className="text-sm text-slate-200 font-semibold">{fmtGBP(calc.prev12Spend)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-600">Change</p>
                  {calc.trendPct != null ? (
                    <p className="text-sm font-semibold flex items-center gap-1 text-amber-400">
                      <ArrowUpRight size={12} />+{calc.trendPct.toFixed(1)}%
                    </p>
                  ) : calc.prev12Spend === 0 && calc.last12Spend > 0 ? (
                    <p className="text-sm text-slate-500">Previous period £0</p>
                  ) : (
                    <p className="text-sm text-slate-500 flex items-center gap-1"><Minus size={12} />No change</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Dates / Lifecycle Timeline */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
        <h3 className="text-xs font-bold text-[#f97316] uppercase tracking-wider mb-4">Key Dates / Lifecycle Timeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <TimelineItem label="Installed" date={asset.installation_date} />
          <TimelineItem label="Commissioned" date={asset.commissioning_date} />
          <TimelineItem label="Warranty Expiry" date={asset.warranty_expiry} />
          <TimelineItem label="Last Service" date={calc.lastService?.service_date} />
          <TimelineItem label="Next Service" date={calc.nextServiceDue} />
          <TimelineItem label="Today" date={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>

      {/* Recent Service History */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
        <h3 className="text-xs font-bold text-[#f97316] uppercase tracking-wider mb-4">Recent Service History</h3>
        {records.length === 0 ? (
          <p className="text-sm text-slate-600 italic py-4">No Service & Maintenance history recorded.</p>
        ) : (
          <div className="space-y-1">
            {records.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-[#0d1628] last:border-0">
                <Calendar size={12} className="text-slate-600 shrink-0" />
                <span className="text-xs text-slate-300 w-24 shrink-0">{fmtDate(r.service_date)}</span>
                <span className="text-xs text-slate-400 flex-1 truncate">{r.service_type}</span>
                {r.condition && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${SERVICE_CONDITION_COLORS[r.condition as ServiceCondition] ?? ''}`}>{r.condition}</span>
                )}
                {canViewFinancials && (
                  <span className="text-xs text-slate-300 font-mono w-20 text-right">{r.cost != null ? fmtGBP(r.cost) : '\u2014'}</span>
                )}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${SERVICE_STATUS_COLORS[r.status as keyof typeof SERVICE_STATUS_COLORS] ?? 'bg-slate-800 text-slate-500'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({ label, value, icon: Icon, subText }: { label: string; value: string; icon: React.ComponentType<{ size?: number; className?: string }>; subText?: string }) {
  return (
    <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-slate-600" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold text-white truncate">{value}</p>
      {subText && <p className="text-[10px] text-amber-400 mt-1">{subText}</p>}
    </div>
  );
}

function TimelineItem({ label, date }: { label: string; date: string | null | undefined }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xs text-slate-200 font-medium">{fmtDate(date)}</p>
    </div>
  );
}
