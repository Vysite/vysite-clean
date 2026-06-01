import { useState, useEffect, useCallback } from 'react';
import {
  Zap, TrendingUp, DollarSign, Building2, ChevronDown, ChevronUp,
  RefreshCw, ArrowUpDown, Calendar, Search, X, BarChart2, AlertCircle,
  ChevronRight, Clock, FileText, CheckCircle, XCircle, Ban,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UsageLogRow {
  id: string;
  org_id: string;
  user_id: string | null;
  feature: string;
  call_type: string;
  model: string;
  pages_processed: number | null;
  chunks_total: number | null;
  chunk_index: number | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  estimated_cost_usd: number;
  status: 'success' | 'failed' | 'blocked';
  error_code: string | null;
  document_name: string | null;
  document_size_kb: number | null;
  created_at: string;
}

interface OrgUsageSummary {
  org_id: string;
  org_name: string;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  blocked_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  ai_monthly_limit: number;
  ai_used_this_month: number;
  ai_bonus_credits: number;
  ai_enabled: boolean;
  remaining: number;
}

type SortKey = 'org_name' | 'total_calls' | 'total_cost_usd' | 'total_input_tokens' | 'remaining';
type SortDir = 'asc' | 'desc';
type DateRange = '7d' | '30d' | '90d' | 'all';

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  '7d':  'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'all': 'All time',
};

function dateRangeCutoff(range: DateRange): string | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function fmtCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function callTypeName(ct: string): string {
  const map: Record<string, string> = {
    'contract-review':    'Contract Review',
    'review-document':    'Document Review',
    'consolidate-review': 'Consolidate',
    'reconcile-findings': 'Reconcile',
    'draft-rfi':          'Draft RFI',
    'suggest-assumptions':'Suggestions',
    'suggest-exclusions': 'Exclusions',
    'draft-scope-note':   'Scope Note',
    'identify-risks':     'Risk Identification',
  };
  return map[ct] ?? ct;
}

function StatusBadge({ status }: { status: 'success' | 'failed' | 'blocked' }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-800/40">
        <CheckCircle size={9} /> OK
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-800/40">
        <XCircle size={9} /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-800/40">
      <Ban size={9} /> Blocked
    </span>
  );
}

// ─── Org drill-down panel ─────────────────────────────────────────────────────

function OrgDrillDown({
  orgSummary,
  onClose,
}: {
  orgSummary: OrgUsageSummary;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<UsageLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    supabase
      .from('ai_usage_log')
      .select('*')
      .eq('org_id', orgSummary.org_id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .then(({ data }) => {
        setLogs(data ?? []);
        setLoading(false);
      });
  }, [orgSummary.org_id, page]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl h-full bg-[#0b1221] border-l border-[#1e2d4a] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d4a] shrink-0">
          <div>
            <p className="text-xs text-[#f97316] font-bold uppercase tracking-widest">AI Usage Detail</p>
            <h2 className="text-base font-bold text-white mt-0.5">{orgSummary.org_name}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-[#1e2d4a] shrink-0">
          {[
            { label: 'Total Calls', value: orgSummary.total_calls.toLocaleString(), color: 'text-white' },
            { label: 'Total Tokens', value: fmtTokens(orgSummary.total_input_tokens + orgSummary.total_output_tokens), color: 'text-sky-400' },
            { label: 'Est. Cost', value: fmtCost(orgSummary.total_cost_usd), color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-3">
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Allowance bar */}
        <div className="px-6 py-3 border-b border-[#1e2d4a] shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Monthly Allowance</span>
            <span className="text-xs text-slate-400">
              <span className="text-white font-semibold">{orgSummary.ai_used_this_month}</span>
              {orgSummary.ai_bonus_credits > 0 && <span className="text-[#f97316]"> +{orgSummary.ai_bonus_credits} bonus</span>}
              <span className="text-slate-600"> / {orgSummary.ai_monthly_limit + orgSummary.ai_bonus_credits} this month</span>
            </span>
          </div>
          <div className="h-1.5 bg-[#1e2d4a] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${orgSummary.remaining <= 0 ? 'bg-red-500' : orgSummary.remaining < 5 ? 'bg-amber-500' : 'bg-[#f97316]'}`}
              style={{ width: `${Math.min(100, (orgSummary.ai_used_this_month / Math.max(1, orgSummary.ai_monthly_limit + orgSummary.ai_bonus_credits)) * 100)}%` }}
            />
          </div>
          <p className={`text-[11px] mt-1 ${orgSummary.remaining <= 0 ? 'text-red-400' : 'text-slate-500'}`}>
            {orgSummary.remaining <= 0 ? 'Allowance exhausted' : `${orgSummary.remaining} remaining`}
          </p>
        </div>

        {/* Log table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={16} className="text-slate-600 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-600">
              <BarChart2 size={24} className="mb-2" />
              <p className="text-sm">No AI calls recorded yet</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0d1628] border-b border-[#1e2d4a] z-10">
                <tr>
                  {['Date', 'Type', 'Model', 'Tokens In', 'Tokens Out', 'Cost', 'Pages', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((row, i) => (
                  <tr key={row.id} className={`border-b border-[#1e2d4a]/50 ${i % 2 === 0 ? '' : 'bg-[#1a2236]/30'}`}>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmtDateTime(row.created_at)}</td>
                    <td className="px-4 py-2.5 text-slate-300">{callTypeName(row.call_type)}</td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px]">{row.model.replace('claude-', '')}</td>
                    <td className="px-4 py-2.5 text-sky-400 font-mono">{row.input_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-sky-400 font-mono">{row.output_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-emerald-400 font-mono">{fmtCost(row.estimated_cost_usd)}</td>
                    <td className="px-4 py-2.5 text-slate-400">{row.pages_processed ?? '—'}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#1e2d4a] shrink-0">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs text-slate-500 hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-slate-600">Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={logs.length < PAGE_SIZE}
            className="text-xs text-slate-500 hover:text-white disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SuperAdminAIBilling() {
  const [orgSummaries, setOrgSummaries] = useState<OrgUsageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [sortKey, setSortKey] = useState<SortKey>('total_cost_usd');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [drillOrg, setDrillOrg] = useState<OrgUsageSummary | null>(null);

  // Platform-level totals
  const [platformTotals, setPlatformTotals] = useState({
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    activeAiOrgs: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const cutoff = dateRangeCutoff(dateRange);

      // Load orgs + their org_settings
      const { data: orgs, error: orgErr } = await supabase
        .from('organisations')
        .select('id, name')
        .eq('status', 'active');

      if (orgErr) throw new Error(orgErr.message);

      const { data: settings } = await supabase
        .from('org_settings')
        .select('org_id, ai_enabled, ai_monthly_limit, ai_used_this_month, ai_bonus_credits');

      const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.org_id, s]));

      // Load all usage logs in range
      let query = supabase
        .from('ai_usage_log')
        .select('org_id, input_tokens, output_tokens, estimated_cost_usd, status');

      if (cutoff) query = query.gte('created_at', cutoff);

      const { data: logs, error: logErr } = await query;
      if (logErr) throw new Error(logErr.message);

      // Aggregate per org
      const orgAgg: Record<string, {
        total_calls: number;
        successful_calls: number;
        failed_calls: number;
        blocked_calls: number;
        total_input_tokens: number;
        total_output_tokens: number;
        total_cost_usd: number;
      }> = {};

      for (const log of (logs ?? [])) {
        if (!orgAgg[log.org_id]) {
          orgAgg[log.org_id] = { total_calls: 0, successful_calls: 0, failed_calls: 0, blocked_calls: 0, total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 0 };
        }
        const a = orgAgg[log.org_id];
        a.total_calls++;
        if (log.status === 'success') a.successful_calls++;
        else if (log.status === 'failed') a.failed_calls++;
        else a.blocked_calls++;
        a.total_input_tokens += log.input_tokens ?? 0;
        a.total_output_tokens += log.output_tokens ?? 0;
        a.total_cost_usd += log.estimated_cost_usd ?? 0;
      }

      const summaries: OrgUsageSummary[] = (orgs ?? []).map(org => {
        const s = settingsMap[org.id];
        const agg = orgAgg[org.id] ?? { total_calls: 0, successful_calls: 0, failed_calls: 0, blocked_calls: 0, total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 0 };
        const limit = s?.ai_monthly_limit ?? 50;
        const bonus = s?.ai_bonus_credits ?? 0;
        const used = s?.ai_used_this_month ?? 0;
        return {
          org_id: org.id,
          org_name: org.name,
          ...agg,
          ai_monthly_limit: limit,
          ai_used_this_month: used,
          ai_bonus_credits: bonus,
          ai_enabled: s?.ai_enabled ?? true,
          remaining: Math.max(0, limit + bonus - used),
        };
      });

      setOrgSummaries(summaries);

      // Platform totals
      const active = summaries.filter(s => s.ai_enabled);
      setPlatformTotals({
        totalCalls: summaries.reduce((a, s) => a + s.total_calls, 0),
        totalInputTokens: summaries.reduce((a, s) => a + s.total_input_tokens, 0),
        totalOutputTokens: summaries.reduce((a, s) => a + s.total_output_tokens, 0),
        totalCostUsd: summaries.reduce((a, s) => a + s.total_cost_usd, 0),
        activeAiOrgs: active.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load AI usage data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  // Sort + filter
  const filtered = orgSummaries
    .filter(s => s.org_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const v = (x: OrgUsageSummary) => {
        if (sortKey === 'org_name') return x.org_name.toLowerCase();
        return x[sortKey] as number;
      };
      const av = v(a), bv = v(b);
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown size={10} className="text-slate-600 ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp size={10} className="text-[#f97316] ml-1" />
      : <ChevronDown size={10} className="text-[#f97316] ml-1" />;
  }

  return (
    <div>
      {drillOrg && (
        <OrgDrillDown orgSummary={drillOrg} onClose={() => setDrillOrg(null)} />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">AI & Billing</h2>
          <p className="text-xs text-slate-500 mt-0.5">Platform-wide AI usage, token consumption and estimated Anthropic API costs</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range selector */}
          <div className="flex items-center gap-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg p-1">
            {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${dateRange === r ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-white'}`}
              >
                {DATE_RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#1e2d4a] text-slate-400 hover:text-white hover:border-[#f97316] rounded-lg text-xs font-semibold transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-900/40 rounded-xl text-sm text-red-300 mb-4">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Platform-level stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total AI Calls', value: platformTotals.totalCalls.toLocaleString(), icon: Zap, color: 'text-[#f97316]' },
          { label: 'Input Tokens', value: fmtTokens(platformTotals.totalInputTokens), icon: BarChart2, color: 'text-sky-400' },
          { label: 'Output Tokens', value: fmtTokens(platformTotals.totalOutputTokens), icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Est. API Cost', value: fmtCost(platformTotals.totalCostUsd), icon: DollarSign, color: 'text-emerald-400' },
          { label: 'AI-Enabled Orgs', value: platformTotals.activeAiOrgs.toLocaleString(), icon: Building2, color: 'text-white' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <stat.icon size={14} className={stat.color} />
              <p className="text-[11px] text-slate-500">{stat.label}</p>
            </div>
            <p className={`text-2xl font-black ${stat.color}`}>{loading ? '—' : stat.value}</p>
          </div>
        ))}
      </div>

      {/* Model pricing reference */}
      <div className="flex items-start gap-2 p-3 bg-[#1a2236] border border-[#1e2d4a] rounded-xl mb-5 text-xs text-slate-400">
        <FileText size={12} className="text-slate-600 mt-0.5 shrink-0" />
        <span>
          Cost estimates use Claude Opus pricing: <span className="text-slate-300">$15/1M input · $75/1M output · $1.50/1M cache read · $18.75/1M cache write</span>.
          Verify against your Anthropic billing dashboard for exact charges.
        </span>
      </div>

      {/* Org table */}
      <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl overflow-hidden">
        {/* Table toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2d4a]">
          <div className="relative flex-1 max-w-xs">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search organisations…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 bg-[#1a2236] border border-[#1e2d4a] rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <p className="text-xs text-slate-600 ml-auto">{filtered.length} organisations</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={16} className="text-slate-600 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-600">
            <BarChart2 size={24} className="mb-2" />
            <p className="text-sm">No data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#1a2236] border-b border-[#1e2d4a]">
                <tr>
                  <th className="text-left px-4 py-3">
                    <button className="flex items-center text-slate-500 hover:text-white font-semibold transition-colors" onClick={() => toggleSort('org_name')}>
                      Organisation <SortIcon k="org_name" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3">
                    <button className="flex items-center ml-auto text-slate-500 hover:text-white font-semibold transition-colors" onClick={() => toggleSort('total_calls')}>
                      Calls <SortIcon k="total_calls" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3">
                    <button className="flex items-center ml-auto text-slate-500 hover:text-white font-semibold transition-colors" onClick={() => toggleSort('total_input_tokens')}>
                      Tokens <SortIcon k="total_input_tokens" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3">
                    <button className="flex items-center ml-auto text-slate-500 hover:text-white font-semibold transition-colors" onClick={() => toggleSort('total_cost_usd')}>
                      Est. Cost <SortIcon k="total_cost_usd" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3">
                    <span className="text-slate-500 font-semibold">Used / Limit</span>
                  </th>
                  <th className="text-right px-4 py-3">
                    <button className="flex items-center ml-auto text-slate-500 hover:text-white font-semibold transition-colors" onClick={() => toggleSort('remaining')}>
                      Remaining <SortIcon k="remaining" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3">
                    <span className="text-slate-500 font-semibold">Success</span>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((org, i) => {
                  const totalAllowance = org.ai_monthly_limit + org.ai_bonus_credits;
                  const usedPct = totalAllowance > 0 ? Math.min(100, (org.ai_used_this_month / totalAllowance) * 100) : 0;
                  const lowRemaining = org.ai_enabled && org.remaining <= 5;
                  const exhausted = org.ai_enabled && org.remaining <= 0;
                  const successRate = org.total_calls > 0
                    ? Math.round((org.successful_calls / org.total_calls) * 100)
                    : null;

                  return (
                    <tr
                      key={org.org_id}
                      className={`border-b border-[#1e2d4a]/50 hover:bg-[#1a2236]/60 transition-colors cursor-pointer ${i % 2 === 0 ? '' : 'bg-[#1a2236]/20'}`}
                      onClick={() => setDrillOrg(org)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${org.ai_enabled ? 'bg-[#f97316]' : 'bg-slate-700'}`} />
                          <span className="text-white font-medium">{org.org_name}</span>
                          {!org.ai_enabled && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">AI OFF</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-white font-semibold">{org.total_calls.toLocaleString()}</span>
                        {org.failed_calls > 0 && (
                          <span className="ml-1 text-[10px] text-red-400">({org.failed_calls} fail)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sky-400 font-mono">
                        {fmtTokens(org.total_input_tokens + org.total_output_tokens)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-mono font-semibold">
                        {fmtCost(org.total_cost_usd)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-end gap-1 min-w-[90px]">
                          <span className="text-[11px] text-slate-400">
                            <span className="text-white font-semibold">{org.ai_used_this_month}</span>
                            {org.ai_bonus_credits > 0 && <span className="text-[#f97316]"> +{org.ai_bonus_credits}</span>}
                            <span className="text-slate-600"> / {totalAllowance}</span>
                          </span>
                          <div className="w-20 h-1 bg-[#1e2d4a] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${exhausted ? 'bg-red-500' : lowRemaining ? 'bg-amber-500' : 'bg-[#f97316]'}`}
                              style={{ width: `${usedPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${exhausted ? 'text-red-400' : lowRemaining ? 'text-amber-400' : 'text-slate-400'}`}>
                        {org.ai_enabled ? org.remaining : '—'}
                        {exhausted && <span className="ml-1 text-[9px] font-bold text-red-400 bg-red-900/30 px-1 py-0.5 rounded">FULL</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {successRate !== null ? (
                          <span className={`text-[11px] font-semibold ${successRate >= 90 ? 'text-emerald-400' : successRate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                            {successRate}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight size={14} className="text-slate-600 ml-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f97316] inline-block" /> AI enabled</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-700 inline-block" /> AI disabled</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Allowance exhausted</span>
        <span>Click any row for call-level detail</span>
      </div>
    </div>
  );
}
