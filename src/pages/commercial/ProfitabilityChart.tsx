import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

interface ProfitabilityChartProps {
  originalForecastProfit: number | null;
  currentForecastProfit: number | null;
  originalMargin: number | null;
  currentMargin: number | null;
  marginMovement: number | null;
  marginImproving: boolean | null;
  loading?: boolean;
}

function fmtGBP(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return sign + '£' + abs.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(0)}k`;
  return `${sign}£${abs.toFixed(0)}`;
}

export default function ProfitabilityChart({
  originalForecastProfit,
  currentForecastProfit,
  originalMargin,
  currentMargin,
  marginMovement,
  marginImproving,
  loading,
}: ProfitabilityChartProps) {
  const hasOriginal = originalForecastProfit != null;
  const hasCurrent = currentForecastProfit != null;
  const hasAnyData = hasOriginal || hasCurrent;

  // Chart geometry
  const chartH = 280;
  const chartW = 760;
  const padding = { top: 28, right: 32, bottom: 44, left: 32 };
  const plotW = chartW - padding.left - padding.right;
  const plotH = chartH - padding.top - padding.bottom;

  const values: number[] = [];
  if (hasOriginal) values.push(originalForecastProfit!);
  if (hasCurrent) values.push(currentForecastProfit!);

  const maxVal = values.length > 0 ? Math.max(...values, 0) : 1;
  const minVal = values.length > 0 ? Math.min(...values, 0) : 0;
  const range = maxVal - minVal || 1;

  const zeroY = padding.top + plotH * (maxVal / range);
  const barW = 120;
  const barGap = plotW / 2;

  function valToY(v: number): number {
    return padding.top + plotH * ((maxVal - v) / range);
  }

  const barCenters = [padding.left + barGap * 0.5, padding.left + barGap * 1.5];

  function renderBar(
    cx: number,
    value: number | null,
    label: string,
    sublabel: string | null,
    color: string,
    available: boolean,
  ) {
    if (!available || value == null) {
      const yMid = zeroY;
      return (
        <g key={label}>
          <rect
            x={cx - barW / 2}
            y={yMid - 12}
            width={barW}
            height={24}
            rx={4}
            fill="#0d1628"
            stroke="#1e2d4a"
            strokeDasharray="4 3"
          />
          <text x={cx} y={yMid + 4} textAnchor="middle" className="fill-slate-600" style={{ fontSize: 9 }}>
            Unavailable
          </text>
          <text x={cx} y={chartH - 22} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10, fontWeight: 600 }}>
            {label}
          </text>
          {sublabel && (
            <text x={cx} y={chartH - 8} textAnchor="middle" className="fill-slate-600" style={{ fontSize: 8.5 }}>
              {sublabel}
            </text>
          )}
        </g>
      );
    }

    const y = valToY(value);
    const isPositive = value >= 0;
    const barTop = isPositive ? y : zeroY;
    const barHeight = Math.abs(y - zeroY);
    const minBarH = 3;

    return (
      <g key={label}>
        <rect
          x={cx - barW / 2}
          y={barTop}
          width={barW}
          height={Math.max(barHeight, minBarH)}
          rx={4}
          fill={color}
          opacity={0.85}
        />
        <text x={cx} y={isPositive ? y - 8 : y + 16} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700 }} className={isPositive ? 'fill-emerald-300' : 'fill-red-300'}>
          {fmtShort(value)}
        </text>
        <text x={cx} y={chartH - 22} textAnchor="middle" className="fill-slate-300" style={{ fontSize: 10, fontWeight: 600 }}>
          {label}
        </text>
        {sublabel && (
          <text x={cx} y={chartH - 8} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 600 }} className={isPositive ? 'fill-emerald-400' : 'fill-red-400'}>
            {sublabel}
          </text>
        )}
      </g>
    );
  }

  return (
    <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl overflow-hidden">
      <div className="border-b border-[#1e2d4a] px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={16} className="text-[#f97316]" />
          <h3 className="text-sm font-bold text-white">Project Profitability Comparison</h3>
        </div>
        <p className="text-xs text-slate-500">
          Compares the original expected profit against the current agreed-basis forecast profit.
          Current forecast uses the Adjusted Contract Sum and Forecast Final Cost — unagreed variations are excluded.
        </p>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-slate-500">Loading cost data…</p>
          </div>
        ) : !hasAnyData ? (
          <div className="flex flex-col items-center justify-center py-16">
            <BarChart3 size={28} className="text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">Budget cost and project cost data required to display profitability comparison.</p>
            <p className="text-xs text-slate-600 mt-1">Set an Original Budget Cost and add project costs to enable this chart.</p>
          </div>
        ) : (
          <>
            {/* SVG bar chart */}
            <div className="w-full overflow-x-auto">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ minWidth: 360, maxWidth: 760 }}>
                {/* Zero baseline */}
                <line
                  x1={padding.left}
                  y1={zeroY}
                  x2={chartW - padding.right}
                  y2={zeroY}
                  stroke="#334155"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                />
                <text x={padding.left - 4} y={zeroY + 4} textAnchor="end" className="fill-slate-600" style={{ fontSize: 8 }}>
                  £0
                </text>

                {/* Bars */}
                {renderBar(barCenters[0], originalForecastProfit, 'Original Expected Profit', originalMargin != null ? `${originalMargin.toFixed(1)}% margin` : null, '#3b82f6', hasOriginal)}
                {renderBar(barCenters[1], currentForecastProfit, 'Current Forecast Profit', currentMargin != null ? `${currentMargin.toFixed(1)}% margin` : null, hasCurrent && currentForecastProfit! >= 0 ? '#10b981' : '#ef4444', hasCurrent)}
              </svg>
            </div>

            {/* Summary row below chart */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[#1e2d4a]/50">
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Original Profit</span>
                <p className={`text-sm font-bold tabular-nums mt-0.5 ${hasOriginal ? (originalForecastProfit! >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'}`}>
                  {hasOriginal ? fmtGBP(originalForecastProfit!) : 'Budget required'}
                </p>
              </div>
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Current Profit</span>
                <p className={`text-sm font-bold tabular-nums mt-0.5 ${hasCurrent ? (currentForecastProfit! >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'}`}>
                  {hasCurrent ? fmtGBP(currentForecastProfit!) : 'Cost data required'}
                </p>
              </div>
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Margin Movement</span>
                <p className={`text-sm font-bold tabular-nums mt-0.5 flex items-center gap-1 ${marginMovement == null ? 'text-slate-600' : marginImproving ? 'text-emerald-400' : 'text-red-400'}`}>
                  {marginMovement != null && (marginImproving ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
                  {marginMovement != null ? `${marginMovement >= 0 ? '+' : ''}${marginMovement.toFixed(1)} pp` : 'Budget required'}
                </p>
              </div>
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Current Margin</span>
                <p className={`text-sm font-bold tabular-nums mt-0.5 ${currentMargin != null ? (currentMargin >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'}`}>
                  {currentMargin != null ? `${currentMargin.toFixed(1)}%` : 'Cost data required'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
