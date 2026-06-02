import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Loader, Sparkles, CheckCircle, AlertTriangle, ChevronDown,
  ChevronRight, ThumbsUp, ThumbsDown, Check, RotateCcw, Info,
} from 'lucide-react';
import type {
  StoredAIReview, ReconciliationSuggestion, ReconcileAction, AIReviewListItem,
} from '../data/types';

function itemText(item: AIReviewListItem): string {
  return typeof item === 'string' ? item : item.text;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReconcileApplyResult {
  updatedReview: StoredAIReview;
  counts: {
    removed: number;
    merged: number;
    reclassified: number;
    converted: number;
    markedAnswered: number;
    total: number;
  };
  removedRfiTexts: string[];
  removedEntryTexts: string[];
  addedEntries: { category: string; text: string }[];
}

interface Props {
  tenderId: string;
  tenderName: string;
  tenderClient: string;
  review: StoredAIReview;
  supabaseUrl: string;
  supabaseKey: string;
  onApply: (result: ReconcileApplyResult) => void;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<ReconcileAction, string> = {
  Keep:                           'bg-emerald-900/40 text-emerald-300 border-emerald-800/50',
  Remove:                         'bg-red-900/40 text-red-300 border-red-800/50',
  Reclassify:                     'bg-blue-900/40 text-blue-300 border-blue-800/50',
  Merge:                          'bg-amber-900/40 text-amber-300 border-amber-800/50',
  'Convert to Scope Note':        'bg-teal-900/40 text-teal-300 border-teal-800/50',
  'Convert to Confirmed Requirement': 'bg-cyan-900/40 text-cyan-300 border-cyan-800/50',
  'Mark as Answered':             'bg-slate-700/60 text-slate-400 border-slate-600/50',
};

const CATEGORY_LABELS: Record<string, string> = {
  rfi:        'RFI',
  assumption: 'Assumption',
  exclusion:  'Exclusion',
  scopeNote:  'Qualification',
  risk:       'Risk',
};

const CATEGORY_COLORS: Record<string, string> = {
  rfi:        'bg-blue-900/40 text-blue-300',
  assumption: 'bg-emerald-900/40 text-emerald-300',
  exclusion:  'bg-orange-900/40 text-orange-300',
  scopeNote:  'bg-teal-900/40 text-teal-300',
  risk:       'bg-red-900/40 text-red-300',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAllFindingsSummary(review: StoredAIReview): string {
  const rfis = (review.editedRfis ?? review.rfis).map((r, i) =>
    `RFI[${i}]: ${r.subject} — ${r.query}`
  );
  const assumptions = (review.editedAssumptions ?? review.assumptions).map((a, i) =>
    `Assumption[${i}]: ${itemText(a)}`
  );
  const exclusions = (review.editedExclusions ?? review.exclusions).map((e, i) =>
    `Exclusion[${i}]: ${itemText(e)}`
  );
  const scopeNotes = (review.editedScopeNotes ?? review.scopeNotes).map((s, i) =>
    `ScopeNote[${i}]: ${itemText(s)}`
  );
  const risks = review.risks.map((r, i) =>
    `Risk[${i}] (${r.severity}): ${r.risk} — ${r.actionNote}`
  );
  return [...rfis, ...assumptions, ...exclusions, ...scopeNotes, ...risks].join('\n');
}

function applyApprovedSuggestions(
  review: StoredAIReview,
  suggestions: ReconciliationSuggestion[],
): ReconcileApplyResult {
  const approved = suggestions.filter(s => s.approved && !s.rejected);

  const rfis = [...(review.editedRfis ?? review.rfis)];
  const assumptions = [...(review.editedAssumptions ?? review.assumptions)];
  const exclusions = [...(review.editedExclusions ?? review.exclusions)];
  const scopeNotes = [...(review.editedScopeNotes ?? review.scopeNotes)];

  const removeRfis = new Set<number>();
  const removeAssumptions = new Set<number>();
  const removeExclusions = new Set<number>();
  const removeScopeNotes = new Set<number>();

  // Track texts removed from each source for live tender sync
  const removedRfiTexts: string[] = [];
  const removedEntryTexts: string[] = [];
  // Track new entries added by reclassify/convert for live tender sync
  const addedEntries: { category: string; text: string }[] = [];

  let countRemoved = 0;
  let countMerged = 0;
  let countReclassified = 0;
  let countConverted = 0;
  let countMarkedAnswered = 0;

  for (const s of approved) {
    const { category, itemIndex, suggestedAction } = s;

    if (suggestedAction === 'Remove') {
      if (category === 'rfi') { removeRfis.add(itemIndex); const r = rfis[itemIndex]; if (r) removedRfiTexts.push(r.subject ?? r.query); }
      if (category === 'assumption') { removeAssumptions.add(itemIndex); const item = assumptions[itemIndex]; if (item) removedEntryTexts.push(itemText(item)); }
      if (category === 'exclusion') { removeExclusions.add(itemIndex); const item = exclusions[itemIndex]; if (item) removedEntryTexts.push(itemText(item)); }
      if (category === 'scopeNote') { removeScopeNotes.add(itemIndex); const item = scopeNotes[itemIndex]; if (item) removedEntryTexts.push(itemText(item)); }
      countRemoved++;
    }

    if (suggestedAction === 'Mark as Answered' && category === 'rfi') {
      const r = rfis[itemIndex];
      if (r) removedRfiTexts.push(r.subject ?? r.query);
      removeRfis.add(itemIndex);
      countMarkedAnswered++;
    }

    if (suggestedAction === 'Convert to Scope Note') {
      if (category === 'rfi') {
        const rfi = rfis[itemIndex];
        if (rfi) {
          const text = `${rfi.subject}: ${rfi.query}`;
          scopeNotes.push(text);
          addedEntries.push({ category: 'Scope Note', text });
          removedRfiTexts.push(rfi.subject ?? rfi.query);
          removeRfis.add(itemIndex);
        }
      } else if (category === 'assumption') {
        const item = assumptions[itemIndex];
        if (item) {
          const text = itemText(item);
          scopeNotes.push(text);
          addedEntries.push({ category: 'Scope Note', text });
          removedEntryTexts.push(text);
          removeAssumptions.add(itemIndex);
        }
      }
      countConverted++;
    }

    if (suggestedAction === 'Convert to Confirmed Requirement') {
      if (category === 'assumption') {
        const item = assumptions[itemIndex];
        if (item) {
          const text = `[Confirmed] ${itemText(item)}`;
          scopeNotes.push(text);
          addedEntries.push({ category: 'Scope Note', text });
          removedEntryTexts.push(itemText(item));
          removeAssumptions.add(itemIndex);
        }
      }
      countConverted++;
    }

    if (suggestedAction === 'Reclassify' && s.targetCategory) {
      const target = s.targetCategory;
      let reclassText = '';
      if (category === 'rfi') { const r = rfis[itemIndex]; reclassText = r ? `${r.subject}: ${r.query}` : ''; if (r) removedRfiTexts.push(r.subject ?? r.query); removeRfis.add(itemIndex); }
      if (category === 'assumption') { const item = assumptions[itemIndex]; reclassText = item ? itemText(item) : ''; if (item) removedEntryTexts.push(reclassText); removeAssumptions.add(itemIndex); }
      if (category === 'exclusion') { const item = exclusions[itemIndex]; reclassText = item ? itemText(item) : ''; if (item) removedEntryTexts.push(reclassText); removeExclusions.add(itemIndex); }
      if (category === 'scopeNote') { const item = scopeNotes[itemIndex]; reclassText = item ? itemText(item) : ''; if (item) removedEntryTexts.push(reclassText); removeScopeNotes.add(itemIndex); }
      if (reclassText) {
        const catMap: Record<string, string> = { assumption: 'Assumptions', exclusion: 'Exclusions', scopeNote: 'Scope Note' };
        if (target === 'assumption') { assumptions.push(reclassText); addedEntries.push({ category: 'Assumptions', text: reclassText }); }
        else if (target === 'exclusion') { exclusions.push(reclassText); addedEntries.push({ category: 'Exclusions', text: reclassText }); }
        else if (target === 'scopeNote') { scopeNotes.push(reclassText); addedEntries.push({ category: 'Scope Note', text: reclassText }); }
        else { const cat = catMap[target]; if (cat) addedEntries.push({ category: cat, text: reclassText }); }
      }
      countReclassified++;
    }

    if (suggestedAction === 'Merge' && s.mergeWithIndex !== undefined) {
      if (category === 'rfi') { const r = rfis[itemIndex]; if (r) removedRfiTexts.push(r.subject ?? r.query); removeRfis.add(itemIndex); }
      if (category === 'assumption') { const item = assumptions[itemIndex]; if (item) removedEntryTexts.push(itemText(item)); removeAssumptions.add(itemIndex); }
      if (category === 'exclusion') { const item = exclusions[itemIndex]; if (item) removedEntryTexts.push(itemText(item)); removeExclusions.add(itemIndex); }
      if (category === 'scopeNote') { const item = scopeNotes[itemIndex]; if (item) removedEntryTexts.push(itemText(item)); removeScopeNotes.add(itemIndex); }
      countMerged++;
    }
  }

  const total = countRemoved + countMerged + countReclassified + countConverted + countMarkedAnswered;

  const updatedReview: StoredAIReview = {
    ...review,
    editedRfis: rfis.filter((_, i) => !removeRfis.has(i)),
    editedAssumptions: assumptions.filter((_, i) => !removeAssumptions.has(i)),
    editedExclusions: exclusions.filter((_, i) => !removeExclusions.has(i)),
    editedScopeNotes: scopeNotes.filter((_, i) => !removeScopeNotes.has(i)),
    reconciliationSuggestions: suggestions,
    reconciliationRunAt: review.reconciliationRunAt,
  };

  return {
    updatedReview,
    counts: { removed: countRemoved, merged: countMerged, reclassified: countReclassified, converted: countConverted, markedAnswered: countMarkedAnswered, total },
    removedRfiTexts,
    removedEntryTexts,
    addedEntries,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  index,
  onApprove,
  onReject,
  onReset,
}: {
  suggestion: ReconciliationSuggestion;
  index: number;
  onApprove: (i: number) => void;
  onReject: (i: number) => void;
  onReset: (i: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { category, itemText, suggestedAction, reason, targetCategory, approved, rejected } = suggestion;

  const actionCls = ACTION_COLORS[suggestedAction] ?? 'bg-slate-700/60 text-slate-400 border-slate-600/50';
  const catCls = CATEGORY_COLORS[category] ?? 'bg-slate-700/60 text-slate-400';

  return (
    <div className={`border rounded-xl transition-all ${
      approved ? 'bg-emerald-900/10 border-emerald-800/40' :
      rejected  ? 'bg-[#0d1628] border-[#1e2d4a] opacity-50' :
                  'bg-[#0d1628] border-[#1e2d4a]'
    }`}>
      <div className="flex items-start gap-3 p-3.5">
        {/* Status indicator */}
        <div className="shrink-0 mt-0.5">
          {approved ? (
            <div className="w-5 h-5 rounded-full bg-emerald-700 flex items-center justify-center">
              <Check size={11} className="text-white" />
            </div>
          ) : rejected ? (
            <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
              <X size={11} className="text-slate-400" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Category + action badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${catCls}`}>
              {CATEGORY_LABELS[category] ?? category}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${actionCls}`}>
              {suggestedAction}
              {targetCategory && ` → ${CATEGORY_LABELS[targetCategory] ?? targetCategory}`}
            </span>
          </div>

          {/* Item text */}
          <p className={`text-xs leading-relaxed ${approved ? 'text-emerald-200/80' : rejected ? 'text-slate-600' : 'text-slate-300'}`}>
            {itemText.length > 160 && !expanded ? `${itemText.slice(0, 160)}…` : itemText}
          </p>

          {/* Reason (collapsible) */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            AI reasoning
          </button>
          {expanded && (
            <p className="text-[11px] text-slate-500 leading-relaxed mt-1 pl-3 border-l border-slate-700">
              {reason}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(approved || rejected) ? (
            <button
              onClick={() => onReset(index)}
              className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-slate-400 transition-colors px-2 py-1 rounded border border-slate-700 hover:border-slate-600"
            >
              <RotateCcw size={9} />Undo
            </button>
          ) : (
            <>
              <button
                onClick={() => onReject(index)}
                className="p-1.5 rounded-lg border border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-700/50 hover:bg-red-900/20 transition-colors"
                title="Reject suggestion"
              >
                <ThumbsDown size={12} />
              </button>
              <button
                onClick={() => onApprove(index)}
                className="p-1.5 rounded-lg border border-slate-700 text-slate-500 hover:text-emerald-400 hover:border-emerald-700/50 hover:bg-emerald-900/20 transition-colors"
                title="Approve suggestion"
              >
                <ThumbsUp size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReconcileFindings({
  tenderName,
  tenderClient,
  review,
  supabaseUrl,
  supabaseKey,
  onApply,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ReconciliationSuggestion[]>(
    review.reconciliationSuggestions ?? []
  );
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [appliedCounts, setAppliedCounts] = useState<ReconcileApplyResult['counts'] | null>(null);

  const totalFindings =
    (review.editedRfis ?? review.rfis).length +
    (review.editedAssumptions ?? review.assumptions).length +
    (review.editedExclusions ?? review.exclusions).length +
    (review.editedScopeNotes ?? review.scopeNotes).length +
    review.risks.length;

  const approvedCount = suggestions.filter(s => s.approved).length;
  const rejectedCount = suggestions.filter(s => s.rejected).length;
  const pendingCount = suggestions.filter(s => !s.approved && !s.rejected).length;

  const runReconciliation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setApplied(false);

    try {
      const allFindings = buildAllFindingsSummary(review);
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-tender-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          task: 'reconcile-findings',
          tenderName,
          tenderClient,
          allFindings,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const err = new Error(data.error ?? 'Reconciliation failed');
        (err as Error & { errorCode?: string }).errorCode = data.errorCode;
        throw err;
      }

      const raw: ReconciliationSuggestion[] = Array.isArray(data.result) ? data.result : [];
      // Ensure each suggestion has an id and approved/rejected default
      const normalised = raw.map((s, i) => ({
        ...s,
        id: s.id ?? `rec-${Date.now()}-${i}`,
        approved: false,
        rejected: false,
      }));
      setSuggestions(normalised);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      console.error('[ReconcileFindings] Error:', e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [review, tenderName, tenderClient, supabaseUrl, supabaseKey]);

  function handleApprove(i: number) {
    setSuggestions(prev => prev.map((s, j) => j === i ? { ...s, approved: true, rejected: false } : s));
  }

  function handleReject(i: number) {
    setSuggestions(prev => prev.map((s, j) => j === i ? { ...s, rejected: true, approved: false } : s));
  }

  function handleReset(i: number) {
    setSuggestions(prev => prev.map((s, j) => j === i ? { ...s, approved: false, rejected: false } : s));
  }

  function handleApproveAll() {
    setSuggestions(prev => prev.map(s => ({ ...s, approved: true, rejected: false })));
  }

  function handleApplyApproved() {
    if (approvedCount === 0) return;
    setApplying(true);
    try {
      const result = applyApprovedSuggestions(review, suggestions);
      const finalResult: ReconcileApplyResult = {
        ...result,
        updatedReview: {
          ...result.updatedReview,
          reconciliationSuggestions: suggestions,
          reconciliationRunAt: new Date().toISOString(),
        },
      };
      onApply(finalResult);
      setAppliedCounts(result.counts);
      setApplied(true);
    } finally {
      setApplying(false);
    }
  }

  const hasExistingReconciliation = (review.reconciliationSuggestions?.length ?? 0) > 0;

  const modal = (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#111827] border border-[#1e2d4a] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1e2d4a] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#f97316]/15 border border-[#f97316]/30 flex items-center justify-center">
            <Sparkles size={16} className="text-[#f97316]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white">Second-Pass Reconciliation</h2>
            <p className="text-[11px] text-slate-500 truncate">
              AI reviews all {totalFindings} findings and suggests quality improvements
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1a2236] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Intro / run panel — shown when no suggestions loaded yet */}
          {suggestions.length === 0 && !loading && !error && (
            <div className="space-y-4">
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <Info size={14} className="text-[#f97316] shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-300">What this does</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      The AI reviews all extracted findings together — looking for duplicates, answered questions, mis-categorised items, and contradictions — then suggests targeted changes.
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      You approve or reject each suggestion before any changes are applied.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: 'RFIs', count: (review.editedRfis ?? review.rfis).length, color: 'text-blue-400' },
                    { label: 'Assumptions', count: (review.editedAssumptions ?? review.assumptions).length, color: 'text-emerald-400' },
                    { label: 'Exclusions', count: (review.editedExclusions ?? review.exclusions).length, color: 'text-orange-400' },
                    { label: 'Qualifications', count: (review.editedScopeNotes ?? review.scopeNotes).length, color: 'text-teal-400' },
                    { label: 'Risks', count: review.risks.length, color: 'text-red-400' },
                    { label: 'Total', count: totalFindings, color: 'text-white' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-2 text-center">
                      <p className={`text-base font-bold tabular-nums ${color}`}>{count}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {hasExistingReconciliation && (
                <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-800/40 rounded-xl p-3">
                  <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    A previous reconciliation was run on {new Date(review.reconciliationRunAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}. Running again will replace those suggestions.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader size={24} className="text-[#f97316] animate-spin" />
              <p className="text-sm font-semibold text-slate-300">Analysing {totalFindings} findings...</p>
              <p className="text-xs text-slate-600">This usually takes 15–30 seconds</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 flex-1 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Applied success banner */}
          {applied && appliedCounts && (
            <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-emerald-300">
                    {appliedCounts.total} reconciliation action{appliedCounts.total !== 1 ? 's' : ''} applied
                  </p>
                  <p className="text-xs text-emerald-400/70 mt-0.5">
                    Tender tabs and export have been updated. Close this panel to review the changes.
                  </p>
                </div>
              </div>
              {appliedCounts.total > 0 && (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {[
                    { label: 'Removed', count: appliedCounts.removed, color: 'text-red-400' },
                    { label: 'Merged', count: appliedCounts.merged, color: 'text-amber-400' },
                    { label: 'Reclassified', count: appliedCounts.reclassified, color: 'text-blue-400' },
                    { label: 'Converted', count: appliedCounts.converted, color: 'text-teal-400' },
                    { label: 'Answered', count: appliedCounts.markedAnswered, color: 'text-slate-400' },
                  ].filter(r => r.count > 0).map(({ label, count, color }) => (
                    <div key={label} className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500">{label}</span>
                      <span className={`text-sm font-bold tabular-nums ${color}`}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggestions list */}
          {suggestions.length > 0 && !loading && (
            <div className="space-y-3">
              {/* Stats bar */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {suggestions.length} suggestions
                </p>
                <div className="flex items-center gap-3">
                  {approvedCount > 0 && (
                    <span className="text-[10px] font-semibold text-emerald-400">
                      {approvedCount} approved
                    </span>
                  )}
                  {rejectedCount > 0 && (
                    <span className="text-[10px] font-semibold text-slate-500">
                      {rejectedCount} rejected
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <button
                      onClick={handleApproveAll}
                      className="text-[10px] font-semibold text-[#f97316] hover:text-orange-400 transition-colors"
                    >
                      Approve all
                    </button>
                  )}
                </div>
              </div>

              {suggestions.map((s, i) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  index={i}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onReset={handleReset}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#1e2d4a] shrink-0 bg-[#0d1628]/50">
          <p className="text-[10px] text-slate-600 max-w-xs leading-snug">
            {suggestions.length > 0
              ? 'Approve suggestions you want to apply. Rejected and pending items are ignored.'
              : 'AI will review all extracted findings and suggest improvements.'}
          </p>
          <div className="flex items-center gap-2">
            {suggestions.length > 0 && !applied && (
              <button
                onClick={handleApplyApproved}
                disabled={applying || approvedCount === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {applying ? <Loader size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                Apply {approvedCount > 0 ? `${approvedCount} ` : ''}Approved
              </button>
            )}
            {(suggestions.length === 0 || error) && !loading && (
              <button
                onClick={runReconciliation}
                disabled={loading || totalFindings === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-900/30"
              >
                <Sparkles size={13} />
                {hasExistingReconciliation && !error ? 'Re-run Reconciliation' : 'Run Reconciliation'}
              </button>
            )}
            {suggestions.length > 0 && !error && !applied && (
              <button
                onClick={runReconciliation}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 border border-[#1e2d4a] text-slate-500 hover:text-slate-300 hover:border-slate-500 rounded-xl text-xs font-semibold transition-colors"
              >
                <RotateCcw size={11} />Re-run
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
