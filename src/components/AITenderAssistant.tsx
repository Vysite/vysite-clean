import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Loader, AlertTriangle, CheckCircle, FileText, HelpCircle, Plus, Save, RotateCcw, Upload, FileSearch, File, Layers, RefreshCw, Trash2, Copy, Check, Info, ZapOff, GitMerge, Download } from 'lucide-react';
import type { TenderRFI, TenderScopeEntry, RFIStatus, StoredAIReview, AIReviewRFI, AIReviewRisk, LucideIcon, DraftChunk, FindingSource, AIReviewListItem } from '../data/types';
import { splitPdfIntoChunks, getPdfPageCount, type PdfChunk } from '../lib/pdfChunker';
import ReconcileFindings, { type ReconcileApplyResult } from './ReconcileFindings';
import ChatGPTImport from './ChatGPTImport';
import { useAuth } from '../lib/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type AITask = 'draft-rfi' | 'suggest-assumptions' | 'suggest-exclusions' | 'draft-scope-note' | 'identify-risks' | 'review-document';

type RFIResult = AIReviewRFI;
type RiskResult = AIReviewRisk;

interface DocumentReviewResult {
  rfis: RFIResult[];
  assumptions: ListItem[];
  exclusions: ListItem[];
  scopeNotes: ListItem[];
  risks: RiskResult[];
}

interface ChunkStatus {
  label: string;
  status: 'pending' | 'processing' | 'done' | 'error' | 'warning';
  error?: string;
  canRetry?: boolean;
  findings?: number; // total findings extracted from this chunk
}

// Single atomic commit — all changes applied in one onUpdate call in the parent,
// eliminating the race where two separate callbacks each spread tenderRef.current
// and the second one overwrites the first.
interface CommitPayload {
  rfis?: TenderRFI[];
  scopeEntries?: TenderScopeEntry[];
  review?: StoredAIReview | null;
  // When true, rfis/scopeEntries fully replace the existing arrays instead of appending
  replaceRfis?: boolean;
  replaceScopeEntries?: boolean;
}

interface Props {
  tender: { id: string; name: string; client: string; rfis: TenderRFI[]; scopeEntries?: TenderScopeEntry[]; aiReview?: StoredAIReview };
  currentUser: { name: string; avatar?: string } | null;
  onCommit: (payload: CommitPayload) => void;
  onClose: () => void;
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: FindingSource }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
      {source.document && (
        <span className="text-[10px] bg-slate-800/80 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700/60 truncate max-w-[180px]" title={source.document}>
          {source.document.length > 30 ? `${source.document.slice(0, 28)}…` : source.document}
        </span>
      )}
      {source.pageRange && (
        <span className="text-[10px] bg-slate-800/80 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700/60">
          pp.{source.pageRange}
        </span>
      )}
      {source.section && (
        <span className="text-[10px] bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700/60 truncate max-w-[200px]" title={source.section}>
          {source.section.length > 40 ? `${source.section.slice(0, 38)}…` : source.section}
        </span>
      )}
      {source.clause && (
        <span className="text-[10px] bg-slate-800/80 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700/60">
          {source.clause}
        </span>
      )}
    </div>
  );
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TASKS: { id: AITask; label: string; description: string; icon: LucideIcon }[] = [
  { id: 'review-document',     label: 'Review Document',      description: 'Upload a tender document for full AI commercial review', icon: FileSearch   },
  { id: 'draft-rfi',           label: 'Draft RFI',            description: 'Convert rough notes into a professional RFI',            icon: HelpCircle   },
  { id: 'suggest-assumptions', label: 'Suggest Assumptions',  description: 'Generate practical pricing & programme assumptions',     icon: CheckCircle  },
  { id: 'suggest-exclusions',  label: 'Suggest Exclusions',   description: 'Identify items to exclude from scope and price',         icon: AlertTriangle},
  { id: 'draft-scope-note',    label: 'Draft Scope Note',     description: 'Convert rough wording into a professional scope note',   icon: FileText     },
  { id: 'identify-risks',      label: 'Identify Risks',       description: 'Review notes and flag commercial & programme risks',     icon: AlertTriangle},
];

const inputPlaceholders: Partial<Record<AITask, string>> = {
  'draft-rfi':           'e.g. No insulation spec shown for chilled water pipework — need clarification before pricing',
  'suggest-assumptions': 'Describe the tender scope, project type, or paste relevant details from the tender documents...',
  'suggest-exclusions':  'Describe the scope of works or paste relevant tender notes to generate appropriate exclusions...',
  'draft-scope-note':    'e.g. allow to relocate fan coil unit and reconnect chilled water pipework, including isolation valves',
  'identify-risks':      'Paste tender notes, scope text, or your observations about this tender to identify potential risks...',
};

const severityColors: Record<string, string> = {
  High:   'bg-red-900/50 text-red-300 border-red-800/60',
  Medium: 'bg-amber-900/50 text-amber-300 border-amber-800/60',
  Low:    'bg-slate-700/60 text-slate-300 border-slate-600/60',
};

const actionColors: Record<string, string> = {
  RFI:          'bg-blue-900/50 text-blue-300',
  Assumption:   'bg-emerald-900/50 text-emerald-300',
  Exclusion:    'bg-orange-900/50 text-orange-300',
  'Scope Note': 'bg-teal-900/50 text-teal-300',
  None:         'bg-slate-700/50 text-slate-400',
};

const ACCEPTED_TYPES = '.pdf,.txt,.doc,.docx,.rtf,.csv';
const MAX_FILE_MB = 50;
const PDF_CHUNK_THRESHOLD = 50;
const LARGE_DOC_WARNING_PAGES = 300; // show cost warning above this
const LARGE_DOC_SKIP_LLM_CONSOLIDATION = 200; // use deterministic merge above this (avoids consolidation token overflow)

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Field({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] resize-none leading-relaxed transition-colors"
      />
    </div>
  );
}

function SaveBar({ label, onSave, disabled }: { label: string; onSave: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-end pt-1">
      <button
        onClick={onSave}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Save size={13} />{label}
      </button>
    </div>
  );
}

type ErrorVariant = 'auth' | 'credit' | 'zero_results' | 'generic';

function ErrorBanner({ message, variant, onDismiss }: { message: string; variant: ErrorVariant; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const prefix =
      variant === 'auth'         ? 'AI Tender Assistant — Authentication Error' :
      variant === 'credit'       ? 'AI Tender Assistant — Anthropic API Credit Error' :
      variant === 'zero_results' ? 'AI Tender Assistant — Zero Results Warning' :
                                   'AI Tender Assistant Error';
    navigator.clipboard.writeText(`${prefix}\n\n${message}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const copyBtn = (colorCls: string, borderCls: string) => (
    <button onClick={handleCopy} className={`flex items-center gap-1.5 text-[10px] font-semibold transition-colors px-2 py-1 rounded border ${colorCls} ${borderCls}`}>
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? 'Copied' : 'Copy error details'}
    </button>
  );

  if (variant === 'auth') {
    return (
      <div className="bg-red-900/20 border border-red-700/60 rounded-xl p-4 space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-300">Anthropic API Key Invalid</p>
            <p className="text-xs text-red-200/80 leading-relaxed mt-1">
              The ANTHROPIC_API_KEY stored in the Supabase project secrets is invalid or has expired. To fix this:
            </p>
            <ol className="text-xs text-red-300/80 leading-relaxed mt-1 ml-3 space-y-0.5 list-decimal">
              <li>Generate a new API key at console.anthropic.com</li>
              <li>Update the <span className="font-mono bg-red-900/40 px-1 rounded">ANTHROPIC_API_KEY</span> secret in Supabase project settings</li>
              <li>Redeploy the edge function, then retry</li>
            </ol>
          </div>
          <button onClick={onDismiss} className="p-1 rounded text-red-700 hover:text-red-400 hover:bg-red-900/40 transition-colors shrink-0" title="Dismiss">
            <X size={13} />
          </button>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {copyBtn('text-red-500 hover:text-red-300', 'border-red-800/50 hover:border-red-700/70')}
        </div>
      </div>
    );
  }

  if (variant === 'credit') {
    return (
      <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-300">Anthropic API Credit Required</p>
            <p className="text-xs text-amber-200/80 leading-relaxed mt-1">
              AI review could not continue because the connected Anthropic account has insufficient API credit. Please add credit to the Anthropic account and retry.
            </p>
            <p className="text-[10px] text-amber-500/70 mt-1">
              This is an external billing issue — your tender document and chunking are working correctly.
            </p>
          </div>
          <button onClick={onDismiss} className="p-1 rounded text-amber-600 hover:text-amber-400 hover:bg-amber-900/40 transition-colors shrink-0" title="Dismiss">
            <X size={13} />
          </button>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {copyBtn('text-amber-500 hover:text-amber-300', 'border-amber-800/50 hover:border-amber-700/70')}
        </div>
      </div>
    );
  }

  if (variant === 'zero_results') {
    return (
      <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 space-y-2">
        <div className="flex items-start gap-2">
          <ZapOff size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-300">No findings extracted</p>
            <p className="text-xs text-amber-200/80 leading-relaxed mt-1">{message}</p>
          </div>
          <button onClick={onDismiss} className="p-1 rounded text-amber-600 hover:text-amber-400 hover:bg-amber-900/40 transition-colors shrink-0" title="Dismiss">
            <X size={13} />
          </button>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {copyBtn('text-amber-500 hover:text-amber-300', 'border-amber-800/50 hover:border-amber-700/70')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-3.5 space-y-2">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
        <p className="text-xs text-red-300 flex-1 leading-relaxed break-words">{message}</p>
        <button onClick={onDismiss} className="p-1 rounded text-red-700 hover:text-red-400 hover:bg-red-900/40 transition-colors shrink-0" title="Dismiss">
          <X size={13} />
        </button>
      </div>
      <div className="flex items-center gap-2 pl-6">
        {copyBtn('text-red-500 hover:text-red-300', 'border-red-800/50 hover:border-red-700/70')}
      </div>
    </div>
  );
}

function LargeDocWarningModal({ pageCount, chunkCount, onConfirm, onCancel }: {
  pageCount: number;
  chunkCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const estimatedMinutes = Math.ceil(chunkCount * 1.5);
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-[#1a2236] border border-amber-700/40 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-900/30 border border-amber-700/40 flex items-center justify-center shrink-0">
            <Info size={18} className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-200 text-sm">Large document — confirm before processing</h3>
            <p className="text-xs text-slate-500 mt-0.5">This document is {pageCount} pages and will require significant AI processing.</p>
          </div>
        </div>
        <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Document size</span>
            <span className="text-slate-300 font-semibold">{pageCount} pages</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Sections to analyse</span>
            <span className="text-slate-300 font-semibold">{chunkCount} sections of 40 pages</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Estimated time</span>
            <span className="text-slate-300 font-semibold">{estimatedMinutes}–{estimatedMinutes + 3} minutes</span>
          </div>
          <div className="border-t border-[#1e2d4a] pt-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Strategy</span>
              <span className="text-emerald-400 font-semibold">Section-by-section extraction + merge</span>
            </div>
            <p className="text-[10px] text-slate-600 mt-1">Each 40-page section is analysed independently. Findings are merged and deduplicated without a lossy consolidation step.</p>
          </div>
        </div>
        <p className="text-xs text-amber-300/80 leading-relaxed">
          Each section uses one AI call. For a {pageCount}-page document this is {chunkCount} API calls. This will consume Anthropic API credit. Make sure you are happy to proceed.
        </p>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onCancel} className="px-4 py-2 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex items-center gap-2 px-5 py-2 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors">
            <Sparkles size={12} />Process {chunkCount} sections
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Single-task result renderers ─────────────────────────────────────────────

function RFIOutput({ result, onSave }: { result: RFIResult; onSave: (r: RFIResult) => void }) {
  const [edited, setEdited] = useState<RFIResult>(result);
  return (
    <div className="space-y-3">
      <Field label="Subject"           value={edited.subject}           onChange={v => setEdited(e => ({ ...e, subject: v }))}           rows={1} />
      <Field label="Query"             value={edited.query}             onChange={v => setEdited(e => ({ ...e, query: v }))}             rows={3} />
      <Field label="Response Required" value={edited.responseRequired}  onChange={v => setEdited(e => ({ ...e, responseRequired: v }))}  rows={2} />
      <Field label="Impact / Urgency"  value={edited.impact}            onChange={v => setEdited(e => ({ ...e, impact: v }))}            rows={2} />
      <SaveBar label="Save to RFIs" onSave={() => onSave(edited)} />
    </div>
  );
}

// Items can be either plain strings (legacy) or {text, source} objects (new AI extraction format)
type ListItem = AIReviewListItem;
function listItemText(item: ListItem): string {
  return typeof item === 'string' ? item : item.text;
}
function listItemSource(item: ListItem): FindingSource | undefined {
  return typeof item === 'object' && item !== null ? item.source : undefined;
}

function ListOutput({ items, category, singularLabel, savedIndices, onSave, onEditItem }: {
  items: ListItem[]; category: string; singularLabel: string;
  savedIndices: number[];
  onSave: (indices: number[], texts: string[]) => void;
  onEditItem: (i: number, text: string) => void;
}) {
  const savedSet = new Set(savedIndices);
  const [selected, setSelected] = useState<Set<number>>(new Set(items.map((_, i) => i).filter(i => !savedSet.has(i))));

  const toggle = (i: number) => {
    if (savedSet.has(i)) return;
    setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  function handleSave() {
    const toSave = Array.from(selected).filter(i => !savedSet.has(i));
    if (toSave.length === 0) return;
    onSave(toSave, toSave.map(i => listItemText(items[i])));
    setSelected(new Set());
  }

  const unsavedSelected = Array.from(selected).filter(i => !savedSet.has(i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-500">Select items to save. Edit wording inline before saving.</p>
        {savedIndices.length > 0 && (
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-900/30 border border-emerald-800/40 px-2 py-0.5 rounded-full shrink-0">
            {savedIndices.length} saved
          </span>
        )}
      </div>
      {items.map((item, i) => {
        const text = listItemText(item);
        const source = listItemSource(item);
        return (
          <div key={i} className={`flex gap-2.5 items-start p-3 rounded-lg border transition-colors ${
            savedSet.has(i)    ? 'bg-emerald-900/10 border-emerald-800/40' :
            selected.has(i)    ? 'bg-[#0d1e36] border-[#f97316]/40' :
                                 'bg-[#0d1628] border-[#1e2d4a]'
          }`}>
            <button onClick={() => toggle(i)} disabled={savedSet.has(i)} className={`mt-0.5 w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors ${
              savedSet.has(i)  ? 'bg-emerald-700 border-emerald-700 cursor-default' :
              selected.has(i)  ? 'bg-[#f97316] border-[#f97316]' :
                                 'border-slate-600 hover:border-slate-400'
            }`}>
              {(selected.has(i) || savedSet.has(i)) && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
            <div className="flex-1 min-w-0">
              <textarea
                value={text}
                onChange={e => onEditItem(i, e.target.value)}
                disabled={savedSet.has(i)}
                rows={2}
                className="w-full bg-transparent text-sm text-slate-300 resize-none outline-none leading-relaxed disabled:opacity-60"
              />
              {source && <SourceBadge source={source} />}
            </div>
            {savedSet.has(i) && <span className="text-[10px] text-emerald-400 font-semibold shrink-0 mt-0.5">Saved</span>}
          </div>
        );
      })}
      {unsavedSelected.length > 0 && (
        <SaveBar
          label={`Save ${unsavedSelected.length} ${unsavedSelected.length === 1 ? singularLabel : category} to Tender`}
          onSave={handleSave}
        />
      )}
      {savedIndices.length > 0 && unsavedSelected.length === 0 && savedIndices.length >= items.length && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <CheckCircle size={13} className="text-emerald-400" />
          <span className="text-xs text-emerald-400 font-semibold">All items saved to Tender</span>
        </div>
      )}
    </div>
  );
}

function RisksOutput({ risks, convertedIndices, onConvert }: {
  risks: RiskResult[];
  convertedIndices: number[];
  onConvert: (risk: RiskResult, action: string, i: number) => void;
}) {
  const convertedSet = new Set(convertedIndices);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-500">Review identified risks. Use "Convert" to create an RFI, Assumption, Exclusion or Scope Note.</p>
        {convertedIndices.length > 0 && (
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-900/30 border border-emerald-800/40 px-2 py-0.5 rounded-full shrink-0">
            {convertedIndices.length} converted
          </span>
        )}
      </div>
      {risks.map((r, i) => (
        <div key={i} className={`border rounded-xl p-3.5 space-y-2 transition-colors ${convertedSet.has(i) ? 'bg-emerald-900/10 border-emerald-800/40' : 'bg-[#0d1628] border-[#1e2d4a]'}`}>
          <div className="flex items-start gap-2.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${severityColors[r.severity] ?? severityColors.Low}`}>{r.severity}</span>
            <p className={`text-sm font-medium leading-snug flex-1 ${convertedSet.has(i) ? 'text-slate-400' : 'text-slate-200'}`}>{r.risk}</p>
            {convertedSet.has(i) && <span className="text-[10px] text-emerald-400 font-semibold shrink-0">Converted</span>}
          </div>
          <p className="text-xs text-slate-500 pl-0.5">{r.actionNote}</p>
          {r.source && <SourceBadge source={r.source} />}
          {r.suggestedAction !== 'None' && !convertedSet.has(i) && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-slate-600">Suggested action:</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${actionColors[r.suggestedAction] ?? ''}`}>{r.suggestedAction}</span>
              <button onClick={() => onConvert(r, r.suggestedAction, i)} className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-[#f97316] hover:text-orange-400 transition-colors">
                <Plus size={11} />Convert
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScopeNoteOutput({ scopeNote, onSave }: { scopeNote: string; onSave: (text: string) => void }) {
  const [edited, setEdited] = useState(scopeNote);
  return (
    <div className="space-y-3">
      <Field label="Scope Note" value={edited} onChange={setEdited} rows={5} />
      <SaveBar label="Save to Scope Notes" onSave={() => onSave(edited)} />
    </div>
  );
}

// ─── Document Review result renderer ─────────────────────────────────────────

type ReviewTab = 'rfis' | 'assumptions' | 'exclusions' | 'scopeNotes' | 'risks';

function DocumentReviewOutput({
  review,
  onSaveRFIs,
  onSaveList,
  onConvertRisk,
  onEditRfi,
  onEditListItem,
}: {
  review: StoredAIReview;
  onSaveRFIs: (items: Array<{ rfi: RFIResult; index: number }>) => void;
  onSaveList: (indices: number[], texts: string[], category: string) => void;
  onConvertRisk: (risk: RiskResult, action: string, i: number) => void;
  onEditRfi: (i: number, field: keyof RFIResult, value: string) => void;
  onEditListItem: (category: 'assumptions' | 'exclusions' | 'scopeNotes', i: number, text: string) => void;
}) {
  const rfis = review.editedRfis ?? review.rfis;
  const assumptions: ListItem[] = review.editedAssumptions ?? review.assumptions;
  const exclusions: ListItem[] = review.editedExclusions ?? review.exclusions;
  const scopeNotes: ListItem[] = review.editedScopeNotes ?? review.scopeNotes;

  const firstNonEmpty = (['rfis', 'assumptions', 'exclusions', 'scopeNotes', 'risks'] as ReviewTab[])
    .find(t => {
      if (t === 'rfis') return rfis.length > 0;
      if (t === 'assumptions') return assumptions.length > 0;
      if (t === 'exclusions') return exclusions.length > 0;
      if (t === 'scopeNotes') return scopeNotes.length > 0;
      if (t === 'risks') return review.risks.length > 0;
      return false;
    }) ?? 'rfis';
  const [activeTab, setActiveTab] = useState<ReviewTab>(firstNonEmpty);

  const tabs: { id: ReviewTab; label: string; count: number; saved: number; color: string }[] = ([
    { id: 'rfis' as ReviewTab,        label: 'RFIs',        count: rfis.length,        saved: review.savedRfiIndices.length,         color: 'blue'    },
    { id: 'assumptions' as ReviewTab, label: 'Assumptions',  count: assumptions.length,  saved: review.savedAssumptionIndices.length,  color: 'emerald' },
    { id: 'exclusions' as ReviewTab,  label: 'Exclusions',   count: exclusions.length,   saved: review.savedExclusionIndices.length,   color: 'orange'  },
    { id: 'scopeNotes' as ReviewTab,  label: 'Scope Notes',  count: scopeNotes.length,   saved: review.savedScopeNoteIndices.length,   color: 'teal'    },
    { id: 'risks' as ReviewTab,       label: 'Risks',        count: review.risks.length, saved: review.convertedRiskIndices.length,    color: 'red'     },
  ] as { id: ReviewTab; label: string; count: number; saved: number; color: string }[]).filter(t => t.count > 0);

  const tabColorMap: Record<string, string> = {
    blue:    'border-blue-500/60 text-blue-300',
    emerald: 'border-emerald-500/60 text-emerald-300',
    orange:  'border-orange-500/60 text-orange-300',
    teal:    'border-teal-500/60 text-teal-300',
    red:     'border-red-500/60 text-red-300',
  };
  const tabBadgeMap: Record<string, string> = {
    blue:    'bg-blue-900/40 text-blue-300',
    emerald: 'bg-emerald-900/40 text-emerald-300',
    orange:  'bg-orange-900/40 text-orange-300',
    teal:    'bg-teal-900/40 text-teal-300',
    red:     'bg-red-900/40 text-red-300',
  };

  const totalItems = tabs.reduce((a, t) => a + t.count, 0);
  const totalSaved = tabs.reduce((a, t) => a + t.saved, 0);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-2">
        <CheckCircle size={13} className="text-emerald-400 shrink-0" />
        <p className="text-xs text-slate-400 flex-1">
          Document reviewed — {totalItems} items found across {tabs.length} categories.
          {totalSaved > 0 && <span className="text-emerald-400 ml-1">{totalSaved} saved.</span>}
        </p>
        <div className="text-[10px] text-slate-600 shrink-0 flex items-center gap-1">
          <span>{new Date(review.reviewedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
          {review.documentName && <span className="text-slate-700">· {review.documentName}</span>}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(t => {
          const isActive = activeTab === t.id;
          const allSaved = t.saved >= t.count;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                isActive
                  ? `bg-[#1a2236] ${tabColorMap[t.color]} border-opacity-80`
                  : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-[#2a3d5a] hover:text-slate-400'
              }`}
            >
              {t.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? tabBadgeMap[t.color] : 'bg-[#1a2236] text-slate-500'}`}>
                {t.count}
              </span>
              {t.saved > 0 && (
                <span className={`text-[10px] font-bold ${allSaved ? 'text-emerald-400' : 'text-emerald-500'}`}>
                  {allSaved ? '✓' : `${t.saved}✓`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active section content */}
      <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
        {activeTab === 'rfis' && (
          <ReviewRFIList
            rfis={rfis}
            savedIndices={review.savedRfiIndices}
            onSave={onSaveRFIs}
            onEdit={onEditRfi}
          />
        )}
        {activeTab === 'assumptions' && (
          <ListOutput
            items={assumptions}
            category="Assumptions"
            singularLabel="Assumption"
            savedIndices={review.savedAssumptionIndices}
            onSave={(indices, texts) => onSaveList(indices, texts, 'Assumptions')}
            onEditItem={(i, text) => onEditListItem('assumptions', i, text)}
          />
        )}
        {activeTab === 'exclusions' && (
          <ListOutput
            items={exclusions}
            category="Exclusions"
            singularLabel="Exclusion"
            savedIndices={review.savedExclusionIndices}
            onSave={(indices, texts) => onSaveList(indices, texts, 'Exclusions')}
            onEditItem={(i, text) => onEditListItem('exclusions', i, text)}
          />
        )}
        {activeTab === 'scopeNotes' && (
          <ListOutput
            items={scopeNotes}
            category="Scope Notes"
            singularLabel="Scope Note"
            savedIndices={review.savedScopeNoteIndices}
            onSave={(indices, texts) => onSaveList(indices, texts, 'Scope Note')}
            onEditItem={(i, text) => onEditListItem('scopeNotes', i, text)}
          />
        )}
        {activeTab === 'risks' && (
          <RisksOutput
            risks={review.risks}
            convertedIndices={review.convertedRiskIndices}
            onConvert={onConvertRisk}
          />
        )}
      </div>
    </div>
  );
}

function ReviewRFIList({ rfis, savedIndices, onSave, onEdit }: {
  rfis: RFIResult[];
  savedIndices: number[];
  onSave: (items: Array<{ rfi: RFIResult; index: number }>) => void;
  onEdit: (i: number, field: keyof RFIResult, value: string) => void;
}) {
  const savedSet = new Set(savedIndices);
  const [selected, setSelected] = useState<Set<number>>(new Set(rfis.map((_, i) => i).filter(i => !savedSet.has(i))));

  const toggle = (i: number) => setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  function handleSaveSelected() {
    const toSave = Array.from(selected).filter(i => !savedSet.has(i));
    if (toSave.length === 0) return;
    // Collect ALL items first, then call onSave ONCE — prevents N sequential onUpdate calls
    onSave(toSave.map(i => ({ rfi: rfis[i], index: i })));
    setSelected(new Set());
  }

  const unsaved = Array.from(selected).filter(i => !savedSet.has(i));

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-2">Select RFIs to save. Edit fields inline before saving.</p>
      {rfis.map((rfi, i) => (
        <div key={i} className={`rounded-lg border transition-colors ${savedSet.has(i) ? 'border-emerald-800/40 bg-emerald-900/10' : selected.has(i) ? 'border-[#f97316]/40 bg-[#0d1e36]' : 'border-[#1e2d4a] bg-[#111827]'}`}>
          <div className="flex items-start gap-2 p-3 pb-2">
            <button onClick={() => !savedSet.has(i) && toggle(i)} disabled={savedSet.has(i)} className={`mt-0.5 w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors ${savedSet.has(i) ? 'bg-emerald-700 border-emerald-700' : selected.has(i) ? 'bg-[#f97316] border-[#f97316]' : 'border-slate-600 hover:border-slate-400'}`}>
              {(selected.has(i) || savedSet.has(i)) && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
            <input
              value={rfi.subject}
              onChange={e => onEdit(i, 'subject', e.target.value)}
              disabled={savedSet.has(i)}
              className="flex-1 bg-transparent text-xs font-bold text-white outline-none placeholder:text-slate-600 disabled:opacity-60"
              placeholder="RFI subject..."
            />
            {savedSet.has(i) && <span className="text-[10px] text-emerald-400 font-semibold shrink-0">Saved</span>}
          </div>
          <div className="pl-9 pr-3 pb-3 space-y-2">
            <div>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">Query</p>
              <textarea
                value={rfi.query}
                onChange={e => onEdit(i, 'query', e.target.value)}
                disabled={savedSet.has(i)}
                rows={2}
                className="w-full bg-transparent text-xs text-slate-400 resize-none outline-none leading-relaxed disabled:opacity-60"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">Response Required</p>
                <textarea
                  value={rfi.responseRequired}
                  onChange={e => onEdit(i, 'responseRequired', e.target.value)}
                  disabled={savedSet.has(i)}
                  rows={2}
                  className="w-full bg-transparent text-xs text-slate-500 resize-none outline-none leading-relaxed disabled:opacity-60"
                />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">Impact / Urgency</p>
                <textarea
                  value={rfi.impact}
                  onChange={e => onEdit(i, 'impact', e.target.value)}
                  disabled={savedSet.has(i)}
                  rows={2}
                  className="w-full bg-transparent text-xs text-slate-500 resize-none outline-none leading-relaxed disabled:opacity-60"
                />
              </div>
            </div>
            {rfi.source && <SourceBadge source={rfi.source} />}
          </div>
        </div>
      ))}
      {unsaved.length > 0 && (
        <div className="flex justify-end pt-1">
          <button onClick={handleSaveSelected} className="flex items-center gap-2 px-4 py-2 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors">
            <Save size={13} />Save {unsaved.length} RFI{unsaved.length !== 1 ? 's' : ''} to Tender
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Chunk progress UI ────────────────────────────────────────────────────────

function ChunkProgressUI({ chunks, currentStep, onRetry, retrying }: {
  chunks: ChunkStatus[];
  currentStep: string;
  onRetry?: (index: number) => void;
  retrying?: boolean;
}) {
  const extractionChunks = chunks.filter(c => c.label !== 'Merging findings');
  const totalFindings = extractionChunks.reduce((sum, c) => sum + (c.findings ?? 0), 0);
  const doneCount = extractionChunks.filter(c => c.status === 'done' || c.status === 'warning').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[#f97316] shrink-0" />
          <p className="text-xs font-semibold text-slate-300">Analysing tender document in sections</p>
        </div>
        {doneCount > 0 && (
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-900/30 border border-emerald-800/40 px-2 py-0.5 rounded-full shrink-0">
            {totalFindings} findings so far
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {chunks.map((chunk, i) => (
          <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
            chunk.status === 'done'       ? 'bg-emerald-900/15 border-emerald-800/40' :
            chunk.status === 'warning'    ? 'bg-amber-900/15 border-amber-800/40' :
            chunk.status === 'processing' ? 'bg-[#1a2236] border-[#f97316]/40' :
            chunk.status === 'error'      ? 'bg-red-900/15 border-red-800/40' :
                                            'bg-[#0d1628] border-[#1e2d4a]'
          }`}>
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              {chunk.status === 'done'       && <CheckCircle size={14} className="text-emerald-400" />}
              {chunk.status === 'warning'    && <AlertTriangle size={14} className="text-amber-400" />}
              {chunk.status === 'processing' && <Loader size={14} className="text-[#f97316] animate-spin" />}
              {chunk.status === 'error'      && <AlertTriangle size={14} className="text-red-400" />}
              {chunk.status === 'pending'    && <div className="w-3 h-3 rounded-full border-2 border-slate-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold truncate ${
                chunk.status === 'done'       ? 'text-emerald-300' :
                chunk.status === 'warning'    ? 'text-amber-300' :
                chunk.status === 'processing' ? 'text-white' :
                chunk.status === 'error'      ? 'text-red-300' : 'text-slate-500'
              }`}>{chunk.label}</p>
              {chunk.status === 'error' && chunk.error && (
                <p className="text-[10px] text-red-400 mt-0.5 truncate">{chunk.error}</p>
              )}
              {chunk.status === 'warning' && (
                <p className="text-[10px] text-amber-400/80 mt-0.5">No findings in this section</p>
              )}
            </div>
            {chunk.status === 'done' && chunk.findings !== undefined && (
              <span className="text-[10px] font-semibold text-emerald-500 shrink-0 tabular-nums">
                {chunk.findings} found
              </span>
            )}
            {chunk.status === 'error' && chunk.canRetry && onRetry && !retrying && (
              <button
                onClick={() => onRetry(i)}
                className="flex items-center gap-1 text-[10px] font-semibold text-[#f97316] hover:text-orange-400 transition-colors shrink-0 px-2 py-1 rounded border border-[#f97316]/30 hover:border-[#f97316]/60"
              >
                <RefreshCw size={10} />Retry
              </button>
            )}
          </div>
        ))}
      </div>
      {currentStep && <p className="text-[11px] text-slate-500 pl-0.5">{currentStep}</p>}
    </div>
  );
}

// ─── File reading utilities ───────────────────────────────────────────────────

async function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Accept both legacy plain strings and new {text, source} objects — never filter objects out
function isValidListItem(x: unknown): x is ListItem {
  if (typeof x === 'string') return x.length > 0;
  if (typeof x === 'object' && x !== null && 'text' in (x as Record<string, unknown>)) return true;
  return false;
}

function mergeChunkResults(results: DocumentReviewResult[]): DocumentReviewResult {
  return {
    rfis: results.flatMap(r => Array.isArray(r.rfis) ? r.rfis : []),
    assumptions: results.flatMap(r => Array.isArray(r.assumptions) ? r.assumptions.filter(isValidListItem) : []),
    exclusions: results.flatMap(r => Array.isArray(r.exclusions) ? r.exclusions.filter(isValidListItem) : []),
    scopeNotes: results.flatMap(r => Array.isArray(r.scopeNotes) ? r.scopeNotes.filter(isValidListItem) : []),
    risks: results.flatMap(r => Array.isArray(r.risks) ? r.risks : []),
  };
}

function makeStoredReview(result: DocumentReviewResult, documentName: string): StoredAIReview {
  return {
    documentName,
    reviewedAt: new Date().toISOString(),
    rfis: result.rfis,
    assumptions: result.assumptions,
    exclusions: result.exclusions,
    scopeNotes: result.scopeNotes,
    risks: result.risks,
    savedRfiIndices: [],
    savedAssumptionIndices: [],
    savedExclusionIndices: [],
    savedScopeNoteIndices: [],
    convertedRiskIndices: [],
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AITenderAssistant({ tender, currentUser, onCommit, onClose }: Props) {
  const { currentOrgId, user: authUser } = useAuth();
  const [selectedTask, setSelectedTask] = useState<AITask>('review-document');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorVariant, setErrorVariant] = useState<ErrorVariant>('generic');

  // Single-task results (these are ephemeral — only document review is persisted)
  const [singleResult, setSingleResult] = useState<unknown>(null);
  const [savedCount, setSavedCount] = useState(0);

  // Persisted review — initialised from tender.aiReview on mount
  const [review, setReview] = useState<StoredAIReview | null>(tender.aiReview ?? null);

  // Confirm clear dialog
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Document review state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chunked processing state
  const [chunkStatuses, setChunkStatuses] = useState<ChunkStatus[]>([]);
  const [currentStep, setCurrentStep] = useState('');
  const [retrying, setRetrying] = useState(false);
  const chunksRef = useRef<PdfChunk[]>([]);
  const chunkResultsRef = useRef<(DocumentReviewResult | null)[]>([]);

  // Large document warning modal
  const [showLargeDocWarning, setShowLargeDocWarning] = useState(false);
  const [pendingChunkCount, setPendingChunkCount] = useState(0);
  const pendingGenerateRef = useRef<(() => Promise<void>) | null>(null);

  // Feature 3: Reconcile modal
  const [showReconcile, setShowReconcile] = useState(false);

  // Feature 4: ChatGPT import modal
  const [showImport, setShowImport] = useState(false);

  // Feature 1: beforeunload warning during active processing
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (loading || retrying) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [loading, retrying]);

  const task = TASKS.find(t => t.id === selectedTask)!;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const isLargePdf = pdfPageCount !== null && pdfPageCount > PDF_CHUNK_THRESHOLD;
  const isChunking = (loading || retrying) && chunkStatuses.length > 0;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function makeEntries(items: string[], category: string): TenderScopeEntry[] {
    const now = new Date().toISOString();
    const user = currentUser?.name ?? 'Team Member';
    const avatar = currentUser?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'TM';
    return items.map((text, i) => ({
      id: `se-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      category,
      user,
      avatar,
      datetime: now,
      text,
    }));
  }

  // Build a TenderRFI from an RFIResult — pure, no side effects
  function buildTenderRFI(r: RFIResult, refIndex: number): TenderRFI {
    const notesParts: string[] = [];
    if (r.responseRequired?.trim()) notesParts.push(`Response Required: ${r.responseRequired.trim()}`);
    if (r.impact?.trim()) notesParts.push(`Impact / Urgency: ${r.impact.trim()}`);
    return {
      id: `rfi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ref: `RFI-${String(refIndex).padStart(3, '0')}`,
      subject: r.subject,
      question: r.query,
      dateRaised: new Date().toISOString().split('T')[0],
      status: 'Draft' as RFIStatus,
      notes: notesParts.join('\n\n'),
      comments: [],
    };
  }

  // Single atomic commit for review-level saves.
  // Passes rfis, scopeEntries, AND updated review in one payload so the parent
  // can merge everything into one onUpdate call — no two-callback race.
  function commitReviewSave(payload: { rfis?: TenderRFI[]; scopeEntries?: TenderScopeEntry[]; updatedReview: StoredAIReview }) {
    setReview(payload.updatedReview);
    onCommit({ rfis: payload.rfis, scopeEntries: payload.scopeEntries, review: payload.updatedReview });
    if (payload.rfis) setSavedCount(c => c + payload.rfis!.length);
    if (payload.scopeEntries) setSavedCount(c => c + payload.scopeEntries!.length);
  }

  // Review-only persist (no tender data changes — e.g. clear, edit wording, clear review)
  function persistReviewOnly(updated: StoredAIReview | null) {
    setReview(updated);
    onCommit({ review: updated });
  }

  // Non-review single-task saves (draft-rfi, suggest-assumptions, etc.)
  function commitSingleSave(payload: { rfis?: TenderRFI[]; scopeEntries?: TenderScopeEntry[] }) {
    onCommit(payload);
    if (payload.rfis) setSavedCount(c => c + payload.rfis!.length);
    if (payload.scopeEntries) setSavedCount(c => c + payload.scopeEntries!.length);
  }

  function handleSaveRFIResult(r: RFIResult) {
    const startRef = tender.rfis.length + 1;
    commitSingleSave({ rfis: [buildTenderRFI(r, startRef)] });
  }

  function handleSaveList(items: string[], category: string) {
    if (items.length === 0) return;
    commitSingleSave({ scopeEntries: makeEntries(items, category) });
  }

  function handleSaveScopeNote(text: string) {
    commitSingleSave({ scopeEntries: makeEntries([text], 'Scope Note') });
  }

  function handleConvertRisk(risk: RiskResult, action: string) {
    const categoryMap: Record<string, string> = { RFI: 'RFI', Assumption: 'Assumptions', Exclusion: 'Exclusions', 'Scope Note': 'Scope Note' };
    const category = categoryMap[action];
    if (!category) return;
    if (action === 'RFI') {
      const startRef = tender.rfis.length + 1;
      commitSingleSave({ rfis: [buildTenderRFI({
        subject: risk.risk,
        query: risk.actionNote,
        responseRequired: 'Clarification required before pricing',
        impact: `${risk.severity} severity risk — commercial exposure if unresolved`,
      }, startRef)] });
    } else {
      const text = `[${risk.severity} Risk] ${risk.risk} — ${risk.actionNote}`;
      commitSingleSave({ scopeEntries: makeEntries([text], category) });
    }
  }

  // ─── Review-level save handlers ──────────────────────────────────────────────

  function handleReviewSaveRFIs(items: Array<{ rfi: RFIResult; index: number }>) {
    if (!review || items.length === 0) return;
    const startRef = tender.rfis.length + 1;
    const tenderRFIs = items.map(({ rfi }, offset) => buildTenderRFI(rfi, startRef + offset));
    const newIndices = items.map(({ index }) => index);
    commitReviewSave({
      rfis: tenderRFIs,
      updatedReview: {
        ...review,
        savedRfiIndices: [...new Set([...review.savedRfiIndices, ...newIndices])],
      },
    });
  }

  function handleReviewSaveList(indices: number[], texts: string[], category: string) {
    if (!review || indices.length === 0) return;
    const field: keyof StoredAIReview =
      category === 'Assumptions' ? 'savedAssumptionIndices' :
      category === 'Exclusions'  ? 'savedExclusionIndices'  :
                                   'savedScopeNoteIndices';
    const catKey = category === 'Scope Note' ? 'Scope Note' : category;
    // texts already extracted as plain strings by ListOutput
    commitReviewSave({
      scopeEntries: makeEntries(texts, catKey),
      updatedReview: {
        ...review,
        [field]: [...new Set([...(review[field] as number[]), ...indices])],
      },
    });
  }

  function handleReviewConvertRisk(risk: RiskResult, action: string, i: number) {
    if (!review) return;
    const categoryMap: Record<string, string> = { RFI: 'RFI', Assumption: 'Assumptions', Exclusion: 'Exclusions', 'Scope Note': 'Scope Note' };
    const category = categoryMap[action];
    if (!category) return;
    const updatedReview: StoredAIReview = {
      ...review,
      convertedRiskIndices: [...new Set([...review.convertedRiskIndices, i])],
    };
    if (action === 'RFI') {
      const startRef = tender.rfis.length + 1;
      commitReviewSave({
        rfis: [buildTenderRFI({
          subject: risk.risk,
          query: risk.actionNote,
          responseRequired: 'Clarification required before pricing',
          impact: `${risk.severity} severity risk — commercial exposure if unresolved`,
        }, startRef)],
        updatedReview,
      });
    } else {
      const text = `[${risk.severity} Risk] ${risk.risk} — ${risk.actionNote}`;
      commitReviewSave({
        scopeEntries: makeEntries([text], category),
        updatedReview,
      });
    }
  }

  function handleEditRfi(i: number, field: keyof RFIResult, value: string) {
    if (!review) return;
    const base = review.editedRfis ?? [...review.rfis];
    const updated = base.map((r, j) => j === i ? { ...r, [field]: value } : r);
    persistReviewOnly({ ...review, editedRfis: updated });
  }

  function handleEditListItem(category: 'assumptions' | 'exclusions' | 'scopeNotes', i: number, text: string) {
    if (!review) return;
    const fieldMap: Record<string, keyof StoredAIReview> = {
      assumptions: 'editedAssumptions',
      exclusions:  'editedExclusions',
      scopeNotes:  'editedScopeNotes',
    };
    const editedKey = fieldMap[category] as 'editedAssumptions' | 'editedExclusions' | 'editedScopeNotes';
    const baseKey = category as 'assumptions' | 'exclusions' | 'scopeNotes';
    const base = (review[editedKey] ?? [...review[baseKey]]) as ListItem[];
    // Preserve source traceability when editing — only update the text
    const updated: ListItem[] = base.map((x, j) => {
      if (j !== i) return x;
      if (typeof x === 'object' && x !== null) return { ...x, text };
      return text;
    });
    persistReviewOnly({ ...review, [editedKey]: updated });
  }

  // Feature 3: Handle reconciliation result — sync changes to live tender.rfis and tender.scopeEntries
  function handleReconcileApply(result: ReconcileApplyResult) {
    const { updatedReview, removedRfiTexts, removedEntryTexts, addedEntries } = result;

    // Build updated rfis by removing entries whose subject/question text matches removed items.
    // We normalise to lowercase for a robust fuzzy match.
    const removedRfiNorm = new Set(removedRfiTexts.map(t => t.trim().toLowerCase()));
    const newRfis = tender.rfis.filter(rfi => {
      const subject = (rfi.subject ?? '').trim().toLowerCase();
      const question = (rfi.question ?? '').trim().toLowerCase();
      // Match on subject (preferred) or first 80 chars of question
      return !removedRfiNorm.has(subject) && !removedRfiNorm.has(question.slice(0, 80));
    });

    // Build updated scopeEntries by removing entries whose text matches removed items.
    const removedEntryNorm = new Set(removedEntryTexts.map(t => t.trim().toLowerCase().slice(0, 120)));
    const baseEntries = tender.scopeEntries ?? [];
    const keptEntries = baseEntries.filter(e => {
      const norm = e.text.trim().toLowerCase().slice(0, 120);
      return !removedEntryNorm.has(norm);
    });

    // Append newly added/reclassified/converted entries
    const now = new Date().toISOString();
    const user = currentUser?.name ?? 'Team Member';
    const avatar = currentUser?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'TM';
    const newScopeEntries: TenderScopeEntry[] = addedEntries.map((e, i) => ({
      id: `se-rec-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      category: e.category,
      user,
      avatar,
      datetime: now,
      text: e.text,
    }));

    setReview(updatedReview);
    onCommit({
      rfis: newRfis,
      replaceRfis: true,
      scopeEntries: [...keptEntries, ...newScopeEntries],
      replaceScopeEntries: true,
      review: updatedReview,
    });
    setShowReconcile(false);
  }

  // Feature 4: Handle ChatGPT import commit
  function handleImportCommit(rfis: TenderRFI[], entries: TenderScopeEntry[]) {
    onCommit({ rfis: rfis.length > 0 ? rfis : undefined, scopeEntries: entries.length > 0 ? entries : undefined });
    setShowImport(false);
  }

  // ─── Error / Reset ───────────────────────────────────────────────────────────

  function setAIError(err: unknown) {
    const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
    const code = (err as Error & { errorCode?: string }).errorCode;
    const variant: ErrorVariant =
      code === 'INVALID_API_KEY'     ? 'auth'         :
      code === 'INSUFFICIENT_CREDIT' ? 'credit'        :
      code === 'ZERO_RESULTS'        ? 'zero_results'  :
                                       'generic';
    console.error('[AITenderAssistant] Error:', err);
    setError(msg);
    setErrorVariant(variant);
  }

  function handleResetSingleTask() {
    setSingleResult(null);
    setError(null);
    setErrorVariant('generic');
    setChunkStatuses([]);
    setCurrentStep('');
  }

  function handleClearReview() {
    persistReviewOnly(null);
    setShowClearConfirm(false);
    setUploadedFile(null);
    setPdfPageCount(null);
    setChunkStatuses([]);
    setCurrentStep('');
    setError(null);
    setErrorVariant('generic');
  }

  // ─── File handling ───────────────────────────────────────────────────────────

  async function handleFileSelect(file: File) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_FILE_MB}MB.`);
      return;
    }
    setPdfPageCount(null);
    setUploadedFile(file);
    setError(null);
    setErrorVariant('generic');
    setSingleResult(null);
    setChunkStatuses([]);
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const pages = await getPdfPageCount(file);
      setPdfPageCount(pages);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function throwFromResponse(data: { error?: string; errorCode?: string }, fallback: string): never {
    const msg = data.error ?? fallback;
    const err = new Error(msg);
    (err as Error & { errorCode?: string }).errorCode = data.errorCode;
    throw err;
  }

  // ─── API calls ───────────────────────────────────────────────────────────────

  async function callEdgeFunction(body: Record<string, unknown>): Promise<DocumentReviewResult> {
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-tender-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        ...body,
        ...(currentOrgId ? { orgId: currentOrgId } : {}),
        ...(authUser?.id ? { userId: authUser.id } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throwFromResponse(data, 'AI request failed');
    const result = data.result as DocumentReviewResult;
    const counts = data.findings ?? {
      rfis: result?.rfis?.length ?? 0,
      assumptions: result?.assumptions?.length ?? 0,
      exclusions: result?.exclusions?.length ?? 0,
      scopeNotes: result?.scopeNotes?.length ?? 0,
      risks: result?.risks?.length ?? 0,
    };
    const total = (counts.rfis ?? 0) + (counts.assumptions ?? 0) + (counts.exclusions ?? 0) + (counts.scopeNotes ?? 0) + (counts.risks ?? 0);
    console.log(`[AITenderAssistant] callEdgeFunction response: rfis:${counts.rfis} assumptions:${counts.assumptions} exclusions:${counts.exclusions} scopeNotes:${counts.scopeNotes} risks:${counts.risks} total:${total}`);
    if (total === 0) {
      console.warn(`[AITenderAssistant] callEdgeFunction: ZERO findings returned. Raw data keys: ${Object.keys(data).join(',')}`);
    }
    return result;
  }

  async function processChunk(file: File, chunk: PdfChunk, chunkIndex: number, chunkTotal: number, pageCount: number): Promise<{ result: DocumentReviewResult; findings: number }> {
    const base64 = await readBlobAsBase64(chunk.blob);
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-tender-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        task: 'review-document',
        tenderName: tender.name,
        tenderClient: tender.client,
        documentBase64: base64,
        documentMimeType: 'application/pdf',
        documentName: `${file.name} — ${chunk.label}`,
        chunkIndex,
        chunkTotal,
        chunkInfo: `This is section ${chunkIndex + 1} of ${chunkTotal} (pages ${chunk.startPage}–${chunk.endPage} of ${pageCount} total pages).`,
        pagesProcessed: chunk.endPage - chunk.startPage + 1,
        ...(currentOrgId ? { orgId: currentOrgId } : {}),
        ...(authUser?.id ? { userId: authUser.id } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok && !data.result) throwFromResponse(data, 'AI request failed');
    const result = data.result as DocumentReviewResult;
    const findings: number = data.findings?.total ?? (
      (result.rfis?.length ?? 0) + (result.assumptions?.length ?? 0) +
      (result.exclusions?.length ?? 0) + (result.scopeNotes?.length ?? 0) + (result.risks?.length ?? 0)
    );
    console.log(
      `[AITenderAssistant] chunk ${chunkIndex + 1}/${chunkTotal} (pages ${chunk.startPage}–${chunk.endPage}): ` +
      `rfis:${result.rfis?.length ?? 0} assumptions:${result.assumptions?.length ?? 0} ` +
      `exclusions:${result.exclusions?.length ?? 0} scopeNotes:${result.scopeNotes?.length ?? 0} ` +
      `risks:${result.risks?.length ?? 0} total:${findings}`,
      'assumption[0] type:', result.assumptions?.[0] !== undefined ? typeof result.assumptions[0] : 'none'
    );
    return { result, findings };
  }

  async function llmConsolidateResults(merged: DocumentReviewResult, pageCount: number, chunkCount: number): Promise<DocumentReviewResult> {
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-tender-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        task: 'consolidate-review',
        tenderName: tender.name,
        tenderClient: tender.client,
        mergedResult: merged,
        totalPages: pageCount,
        chunkCount,
        ...(currentOrgId ? { orgId: currentOrgId } : {}),
        ...(authUser?.id ? { userId: authUser.id } : {}),
      }),
    });
    const data = await res.json();
    // Both CONSOLIDATION_EMPTY and CONSOLIDATION_PARSE_FAILED are signals to fall back to merged
    if (data.errorCode === 'CONSOLIDATION_EMPTY' || data.errorCode === 'CONSOLIDATION_PARSE_FAILED') {
      console.warn('[AITenderAssistant] LLM consolidation failed/empty — using deterministic merged result');
      throw new Error('consolidation_fallback');
    }
    if (!res.ok && !data.result) throwFromResponse(data, 'Consolidation failed');
    return data.result as DocumentReviewResult;
  }

  // Deterministic deduplication — removes only exact text duplicates
  function deterministicMerge(results: DocumentReviewResult[]): DocumentReviewResult {
    const merged = mergeChunkResults(results);

    // For list items (strings or {text,source} objects): deduplicate by normalised text only.
    // Using text-only key means different source refs for the same sentence don't create duplicates,
    // and {text,source} objects are correctly deduplicated against plain strings.
    const dedupListItems = (arr: ListItem[]): ListItem[] => {
      const seen = new Set<string>();
      return arr.filter(x => {
        const k = (typeof x === 'string' ? x : x.text).trim().toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };

    // For objects (RFIs): deduplicate by subject+query fingerprint so source field doesn't create false duplicates
    const dedupRFIs = (arr: RFIResult[]): RFIResult[] => {
      const seen = new Set<string>();
      return arr.filter(x => {
        const k = `${x.subject?.trim().toLowerCase()}|${x.query?.trim().toLowerCase()}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };

    // For risks: deduplicate by risk text
    const dedupRisks = (arr: RiskResult[]): RiskResult[] => {
      const seen = new Set<string>();
      return arr.filter(x => {
        const k = x.risk?.trim().toLowerCase() ?? '';
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };

    const result = {
      rfis: dedupRFIs(merged.rfis),
      assumptions: dedupListItems(merged.assumptions),
      exclusions: dedupListItems(merged.exclusions),
      scopeNotes: dedupListItems(merged.scopeNotes),
      risks: dedupRisks(merged.risks),
    };

    console.log(`[AITenderAssistant] deterministicMerge: rfis:${merged.rfis.length}→${result.rfis.length} assumptions:${merged.assumptions.length}→${result.assumptions.length} exclusions:${merged.exclusions.length}→${result.exclusions.length} scopeNotes:${merged.scopeNotes.length}→${result.scopeNotes.length} risks:${merged.risks.length}→${result.risks.length}`);
    return result;
  }

  // Autosave draft chunks to review state after each completed chunk
  function saveDraftChunk(
    chunkIndex: number,
    chunk: PdfChunk,
    result: DocumentReviewResult,
    fileName: string,
    totalChunks: number,
    pageCount: number,
  ) {
    const draftChunk: DraftChunk = {
      chunkIndex,
      chunkLabel: chunk.label,
      startPage: chunk.startPage,
      endPage: chunk.endPage,
      findings: {
        rfis: result.rfis ?? [],
        assumptions: result.assumptions ?? [],
        exclusions: result.exclusions ?? [],
        scopeNotes: result.scopeNotes ?? [],
        risks: result.risks ?? [],
      },
      completedAt: new Date().toISOString(),
    };

    const existing = review?.draftChunks ?? [];
    const updated = [...existing.filter(d => d.chunkIndex !== chunkIndex), draftChunk];
    const updatedReview: StoredAIReview = {
      ...(review ?? {
        documentName: fileName,
        reviewedAt: new Date().toISOString(),
        rfis: [], assumptions: [], exclusions: [], scopeNotes: [], risks: [],
        savedRfiIndices: [], savedAssumptionIndices: [], savedExclusionIndices: [],
        savedScopeNoteIndices: [], convertedRiskIndices: [],
      }),
      draftChunks: updated,
      processingState: 'running',
      processingMeta: {
        fileName,
        totalPages: pageCount,
        totalChunks,
        completedChunks: updated.length,
        startedAt: review?.processingMeta?.startedAt ?? new Date().toISOString(),
      },
    };
    // Persist draft state without disturbing the main review result
    onCommit({ review: updatedReview });
    setReview(updatedReview);
  }

  async function processChunkedPdf(file: File, pageCount: number) {
    setCurrentStep('Splitting document into sections...');
    const chunks: PdfChunk[] = await splitPdfIntoChunks(file, pageCount);
    chunksRef.current = chunks;
    chunkResultsRef.current = new Array(chunks.length).fill(null);

    // Check if we have a resumable draft from a previous interrupted run
    const existingDrafts = review?.draftChunks ?? [];
    const resumableIndices = new Set(existingDrafts.map(d => d.chunkIndex));

    const mergeLabel = 'Merging findings';
    setChunkStatuses([
      ...chunks.map((c, i) => ({
        label: c.label,
        status: resumableIndices.has(i) ? 'done' as const : 'pending' as const,
        canRetry: false,
        findings: resumableIndices.has(i)
          ? existingDrafts.find(d => d.chunkIndex === i)
              ? Object.values(existingDrafts.find(d => d.chunkIndex === i)!.findings).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0)
              : undefined
          : undefined,
      })),
      { label: mergeLabel, status: 'pending' as const, canRetry: false },
    ]);

    console.log(`[AITenderAssistant] Starting large document processing: "${file.name}" — ${pageCount} pages, ${chunks.length} chunks`);

    // Restore any completed chunk results from draft
    for (const draft of existingDrafts) {
      if (draft.chunkIndex < chunks.length) {
        chunkResultsRef.current[draft.chunkIndex] = draft.findings as unknown as DocumentReviewResult;
      }
    }

    for (let i = 0; i < chunks.length; i++) {
      if (resumableIndices.has(i)) {
        console.log(`[AITenderAssistant] Skipping chunk ${i + 1}/${chunks.length} — already completed in draft`);
        continue;
      }
      await runChunk(file, chunks, i, pageCount, chunkResultsRef.current, file.name);
    }

    return await runMerge(file.name, chunks, pageCount);
  }

  async function runChunk(
    file: File,
    chunks: PdfChunk[],
    i: number,
    pageCount: number,
    results: (DocumentReviewResult | null)[],
    fileName?: string,
  ) {
    setChunkStatuses(prev => prev.map((s, j) => j === i ? { ...s, status: 'processing', canRetry: false } : s));
    setCurrentStep(`Analysing section ${i + 1} of ${chunks.length} (pages ${chunks[i].startPage}–${chunks[i].endPage})...`);
    try {
      const { result, findings } = await processChunk(file, chunks[i], i, chunks.length, pageCount);
      results[i] = result;
      const isEmpty = findings === 0;
      setChunkStatuses(prev => prev.map((s, j) =>
        j === i ? { ...s, status: isEmpty ? 'warning' : 'done', canRetry: false, findings: isEmpty ? 0 : findings } : s
      ));
      // Feature 1: autosave this chunk's findings as a draft
      if (!isEmpty && fileName) {
        saveDraftChunk(i, chunks[i], result, fileName, chunks.length, pageCount);
      }
    } catch (err) {
      const code = (err as Error & { errorCode?: string }).errorCode;
      const isFatal = code === 'INSUFFICIENT_CREDIT' || code === 'INVALID_API_KEY';
      const msg = err instanceof Error ? err.message : 'Failed';
      console.error(`[AITenderAssistant] chunk ${i + 1}/${chunks.length} failed:`, msg);
      setChunkStatuses(prev => prev.map((s, j) =>
        j === i ? { ...s, status: 'error', error: msg, canRetry: !isFatal } : s
      ));
      if (isFatal) throw err;
    }
  }

  async function runMerge(_fileName: string, chunks: PdfChunk[], pageCount: number): Promise<DocumentReviewResult> {
    const mergeIdx = chunks.length;
    const successfulResults = (chunkResultsRef.current).filter((r): r is DocumentReviewResult => r !== null);

    if (successfulResults.length === 0) {
      throw new Error('All document sections failed to process. Please check your API key and try again.');
    }

    setChunkStatuses(prev => prev.map((s, j) =>
      j === mergeIdx ? { ...s, status: 'processing', canRetry: false } : s
    ));

    const totalChunkFindings = successfulResults.reduce((sum, r) =>
      sum + (r.rfis?.length ?? 0) + (r.assumptions?.length ?? 0) +
      (r.exclusions?.length ?? 0) + (r.scopeNotes?.length ?? 0) + (r.risks?.length ?? 0), 0
    );
    console.log(`[AITenderAssistant] Merging ${successfulResults.length}/${chunks.length} successful chunks. Total pre-merge findings: ${totalChunkFindings}`);

    // For large documents, skip LLM consolidation entirely — it silently drops results when
    // the merged payload is too large. Use deterministic dedup instead.
    const skipLLM = pageCount >= LARGE_DOC_SKIP_LLM_CONSOLIDATION || chunks.length > 5;
    let finalResult: DocumentReviewResult;

    if (skipLLM) {
      setCurrentStep('Merging and deduplicating findings...');
      finalResult = deterministicMerge(successfulResults);
      console.log(`[AITenderAssistant] Deterministic merge complete. Final findings: rfis:${finalResult.rfis.length} assumptions:${finalResult.assumptions.length} exclusions:${finalResult.exclusions.length} scopeNotes:${finalResult.scopeNotes.length} risks:${finalResult.risks.length}`);
    } else {
      setCurrentStep('Deduplicating and consolidating findings...');
      try {
        finalResult = await llmConsolidateResults(mergeChunkResults(successfulResults), pageCount, chunks.length);
        const outTotal = (finalResult.rfis?.length ?? 0) + (finalResult.assumptions?.length ?? 0) +
          (finalResult.exclusions?.length ?? 0) + (finalResult.scopeNotes?.length ?? 0) + (finalResult.risks?.length ?? 0);
        // If LLM consolidation dropped more than 60% of findings, fall back to deterministic
        if (outTotal < totalChunkFindings * 0.4 && totalChunkFindings > 10) {
          console.warn(`[AITenderAssistant] LLM consolidation dropped too many findings (${totalChunkFindings} → ${outTotal}). Falling back to deterministic merge.`);
          finalResult = deterministicMerge(successfulResults);
        }
        console.log(`[AITenderAssistant] LLM consolidation complete. Final findings: rfis:${finalResult.rfis.length} assumptions:${finalResult.assumptions.length} exclusions:${finalResult.exclusions.length} scopeNotes:${finalResult.scopeNotes.length} risks:${finalResult.risks.length}`);
      } catch {
        finalResult = deterministicMerge(successfulResults);
        console.log(`[AITenderAssistant] Fell back to deterministic merge. Final findings: rfis:${finalResult.rfis.length} assumptions:${finalResult.assumptions.length} exclusions:${finalResult.exclusions.length} scopeNotes:${finalResult.scopeNotes.length} risks:${finalResult.risks.length}`);
      }
    }

    const finalTotal = (finalResult.rfis?.length ?? 0) + (finalResult.assumptions?.length ?? 0) +
      (finalResult.exclusions?.length ?? 0) + (finalResult.scopeNotes?.length ?? 0) + (finalResult.risks?.length ?? 0);

    if (finalTotal === 0 && totalChunkFindings > 0) {
      // Merge/consolidation destroyed all findings — this is a critical failure
      console.error(`[AITenderAssistant] CRITICAL: merge produced zero results despite ${totalChunkFindings} chunk-level findings. Using raw merged result as last resort.`);
      finalResult = mergeChunkResults(successfulResults);
    }

    setChunkStatuses(prev => prev.map((s, j) =>
      j === mergeIdx ? { ...s, status: 'done', canRetry: false, findings: finalTotal } : s
    ));
    setCurrentStep(`Complete — ${finalTotal} findings extracted.`);
    return finalResult;
  }

  async function handleRetryChunk(chunkIndex: number) {
    if (!uploadedFile || !pdfPageCount) return;
    setRetrying(true);
    const chunks = chunksRef.current;
    const results = chunkResultsRef.current;
    try {
      await runChunk(uploadedFile, chunks, chunkIndex, pdfPageCount, results, uploadedFile.name);
      const finalResult = await runMerge(uploadedFile.name, chunks, pdfPageCount);
      const stored = makeStoredReview(finalResult, uploadedFile.name);
      persistReviewOnly(stored);
    } catch (e) {
      setAIError(e);
    } finally {
      setRetrying(false);
    }
  }

  // Core document processing — called after any warning confirmation
  const executeGenerate = useCallback(async (file: File, pageCount: number | null) => {
    setLoading(true);
    setError(null);
    setSingleResult(null);
    setSavedCount(0);
    setChunkStatuses([]);
    setCurrentStep('');

    try {
      const mime = file.type;
      const isPDF = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isText = mime.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.csv');

      let finalResult: DocumentReviewResult;

      if (isPDF && pageCount !== null && pageCount > PDF_CHUNK_THRESHOLD) {
        finalResult = await processChunkedPdf(file, pageCount);
      } else if (isPDF) {
        setCurrentStep('Sending document to AI...');
        const base64 = await readBlobAsBase64(file);
        finalResult = await callEdgeFunction({
          task: 'review-document',
          tenderName: tender.name,
          tenderClient: tender.client,
          documentBase64: base64,
          documentMimeType: mime,
          documentName: file.name,
        });
        setCurrentStep('');
      } else if (isText) {
        setCurrentStep('Extracting text...');
        const text = await readFileAsText(file);
        setCurrentStep('Analysing document...');
        finalResult = await callEdgeFunction({
          task: 'review-document',
          tenderName: tender.name,
          tenderClient: tender.client,
          documentText: text,
          documentName: file.name,
        });
        setCurrentStep('');
      } else {
        setCurrentStep('Sending document to AI...');
        const base64 = await readBlobAsBase64(file);
        finalResult = await callEdgeFunction({
          task: 'review-document',
          tenderName: tender.name,
          tenderClient: tender.client,
          documentBase64: base64,
          documentMimeType: mime,
          documentName: file.name,
        });
        setCurrentStep('');
      }

      const totalFindings = (finalResult.rfis?.length ?? 0) + (finalResult.assumptions?.length ?? 0) +
        (finalResult.exclusions?.length ?? 0) + (finalResult.scopeNotes?.length ?? 0) + (finalResult.risks?.length ?? 0);

      console.log(
        `[AITenderAssistant] executeGenerate FINAL: rfis:${finalResult.rfis?.length ?? 0}` +
        ` assumptions:${finalResult.assumptions?.length ?? 0}` +
        ` exclusions:${finalResult.exclusions?.length ?? 0}` +
        ` scopeNotes:${finalResult.scopeNotes?.length ?? 0}` +
        ` risks:${finalResult.risks?.length ?? 0}` +
        ` total:${totalFindings} pages:${pageCount ?? 'unknown'}`
      );

      // Only warn on zero results — don't block storage or show error for very small docs
      // where zero findings might be legitimate (e.g. cover page only)
      if (totalFindings === 0) {
        console.warn(`[AITenderAssistant] Zero findings after full pipeline. Pages: ${pageCount ?? 'unknown'}`);
        // Only show the warning banner for docs large enough to realistically have findings
        if (pageCount === null || pageCount > 5) {
          setAIError(Object.assign(new Error(
            `The document was processed but no findings were extracted. This may indicate a scanned PDF (image-only, not text-searchable), an encrypted document, or a document with no commercially relevant content. Please check the PDF is text-searchable and try again.`
          ), { errorCode: 'ZERO_RESULTS' }));
          return;
        }
      }

      const stored = makeStoredReview(finalResult, file.name);
      // Clear draft/processing state now that review is complete
      persistReviewOnly({ ...stored, processingState: 'complete', draftChunks: undefined, processingMeta: undefined });
    } catch (e) {
      setAIError(e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tender.name, tender.client, supabaseUrl, supabaseKey]);

  async function handleGenerate() {
    if (selectedTask !== 'review-document') {
      setLoading(true);
      setError(null);
      setSingleResult(null);
      setSavedCount(0);
      try {
        if (!context.trim()) { setError('Please enter some context first.'); setLoading(false); return; }
        const res = await fetch(`${supabaseUrl}/functions/v1/ai-tender-assistant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            task: selectedTask,
            tenderName: tender.name,
            tenderClient: tender.client,
            context,
            ...(currentOrgId ? { orgId: currentOrgId } : {}),
            ...(authUser?.id ? { userId: authUser.id } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? 'AI request failed');
        setSingleResult(data.result);
      } catch (e) {
        setAIError(e);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!uploadedFile) { setError('Please upload a document first.'); return; }

    // Show large-doc warning before starting expensive run
    if (pdfPageCount !== null && pdfPageCount >= LARGE_DOC_WARNING_PAGES) {
      const chunks = Math.ceil(pdfPageCount / 40);
      pendingGenerateRef.current = () => executeGenerate(uploadedFile, pdfPageCount);
      setShowLargeDocWarning(true);
      // Store chunk count for the modal
      setPendingChunkCount(chunks);
      return;
    }

    await executeGenerate(uploadedFile, pdfPageCount);
  }

  const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 resize-none leading-relaxed transition-colors';

  const totalSaved = review
    ? review.savedRfiIndices.length + review.savedAssumptionIndices.length +
      review.savedExclusionIndices.length + review.savedScopeNoteIndices.length +
      review.convertedRiskIndices.length
    : savedCount;

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-[#111827] border border-[#1e2d4a] rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1e2d4a] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#f97316]/15 border border-[#f97316]/30 flex items-center justify-center">
            <Sparkles size={16} className="text-[#f97316]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white">AI Tender Assistant</h2>
            <p className="text-[11px] text-slate-500 truncate">{tender.name}</p>
          </div>
          {totalSaved > 0 && (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-900/40 border border-emerald-800/50 px-2.5 py-1 rounded-full">
              {totalSaved} saved to tender
            </span>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1a2236] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Task selector */}
        <div className="px-5 pt-4 pb-3 border-b border-[#1e2d4a] shrink-0">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Select Task</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TASKS.map(t => {
              const Icon = t.icon;
              const active = selectedTask === t.id;
              return (
                <button key={t.id}
                  onClick={() => { setSelectedTask(t.id); setSingleResult(null); setError(null); setErrorVariant('generic'); setSavedCount(0); setPdfPageCount(null); setChunkStatuses([]); setCurrentStep(''); }}
                  className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all ${active ? 'bg-[#1a2236] border-[#f97316]/60 ring-1 ring-[#f97316]/20' : 'bg-[#0d1628] border-[#1e2d4a] hover:border-[#2a3d5a]'}`}
                >
                  <Icon size={13} className={`shrink-0 mt-0.5 ${active ? 'text-[#f97316]' : 'text-slate-500'}`} />
                  <div>
                    <p className={`text-xs font-semibold leading-snug ${active ? 'text-white' : 'text-slate-400'}`}>{t.label}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5 leading-snug hidden sm:block">{t.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">

          {/* Persisted review results — shown when review-document is selected and review exists */}
          {selectedTask === 'review-document' && review && !loading && !isChunking && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Review Results — Review &amp; Save</p>
                <div className="flex items-center gap-2">
                  {/* Feature 4: ChatGPT import button */}
                  <button
                    onClick={() => setShowImport(true)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 hover:text-[#f97316] transition-colors px-2 py-1 rounded border border-slate-700 hover:border-[#f97316]/50"
                    title="Import findings from ChatGPT or Excel"
                  >
                    <Download size={11} />Import
                  </button>
                  {/* Feature 3: Reconcile button */}
                  <button
                    onClick={() => setShowReconcile(true)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 hover:text-[#f97316] transition-colors px-2 py-1 rounded border border-slate-700 hover:border-[#f97316]/50"
                    title="Run second-pass reconciliation review"
                  >
                    <GitMerge size={11} />Reconcile
                    {review.reconciliationRunAt && (
                      <span className="text-emerald-500 ml-0.5">✓</span>
                    )}
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={11} />Clear review
                  </button>
                </div>
              </div>
              <DocumentReviewOutput
                review={review}
                onSaveRFIs={handleReviewSaveRFIs}
                onSaveList={handleReviewSaveList}
                onConvertRisk={handleReviewConvertRisk}
                onEditRfi={handleEditRfi}
                onEditListItem={handleEditListItem}
              />
            </div>
          )}

          {/* Feature 4: Import button when no review yet */}
          {selectedTask === 'review-document' && !review && !isChunking && !loading && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 hover:text-[#f97316] transition-colors px-2 py-1 rounded border border-slate-700 hover:border-[#f97316]/50"
                title="Import findings from ChatGPT or Excel CSV"
              >
                <Download size={11} />Import from ChatGPT / Excel
              </button>
            </div>
          )}

          {/* Upload UI — only shown if no persisted review and not chunking */}
          {selectedTask === 'review-document' && !review && !isChunking && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Upload Tender Document</p>

              {!uploadedFile ? (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 sm:p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-[#f97316] bg-[#f97316]/5' : 'border-[#1e2d4a] hover:border-[#2a3d5a] hover:bg-[#0d1628]/60'}`}
                >
                  <Upload size={24} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-400 mb-1">Drop tender document here</p>
                  <p className="text-xs text-slate-600">or click to browse</p>
                  <p className="text-[10px] text-slate-700 mt-2">PDF, Word, TXT — up to {MAX_FILE_MB}MB</p>
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isLargePdf ? 'bg-blue-900/20 border border-blue-800/40' : 'bg-[#f97316]/10 border border-[#f97316]/20'}`}>
                      {isLargePdf ? <Layers size={18} className="text-blue-400" /> : <File size={18} className="text-[#f97316]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{uploadedFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(uploadedFile.size)}
                        {pdfPageCount !== null && ` · ${pdfPageCount} pages`}
                        {isLargePdf && ' · large tender pack'}
                      </p>
                    </div>
                    <button onClick={() => { setUploadedFile(null); setPdfPageCount(null); setSingleResult(null); setError(null); setErrorVariant('generic'); setChunkStatuses([]); }}
                      className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-[#1a2236] rounded-lg transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  </div>

                  {isLargePdf && pdfPageCount !== null && (
                    <div className="flex items-start gap-2.5 bg-blue-900/15 border border-blue-800/40 rounded-xl p-3.5">
                      <Layers size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-blue-300 mb-1">
                          Large tender pack — {pdfPageCount} pages · {Math.ceil(pdfPageCount / 40)} sections
                        </p>
                        <p className="text-xs text-blue-400/80 leading-relaxed">
                          Each 40-page section will be analysed independently. Findings are merged deterministically — no lossy consolidation step for large documents.
                          {pdfPageCount >= LARGE_DOC_WARNING_PAGES && (
                            <span className="block mt-1 text-amber-400/80">You will be asked to confirm before the {Math.ceil(pdfPageCount / 40)}-section run begins.</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[10px] text-slate-600 mt-2">
                Supported: PDF (native), plain text, Word documents. AI will extract commercial information and organise it into RFIs, Assumptions, Exclusions, Scope Notes and Risks for your review.
              </p>
            </div>
          )}

          {/* Chunk progress */}
          {chunkStatuses.length > 0 && !review && (
            <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
              <ChunkProgressUI
                chunks={chunkStatuses}
                currentStep={currentStep}
                onRetry={handleRetryChunk}
                retrying={retrying}
              />
            </div>
          )}

          {/* Context input for non-document tasks */}
          {selectedTask !== 'review-document' && singleResult === null && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                {selectedTask === 'draft-rfi' ? 'Your Rough Notes' :
                 selectedTask === 'identify-risks' ? 'Tender Notes / Scope Text' :
                 selectedTask === 'draft-scope-note' ? 'Rough Scope Wording' : 'Tender Context'}
              </p>
              <textarea rows={5} value={context} onChange={e => setContext(e.target.value)}
                placeholder={inputPlaceholders[selectedTask]}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-600 mt-1.5">The more context you provide, the more relevant the suggestions will be.</p>
            </div>
          )}

          {/* Error — persistent until manually dismissed */}
          {error && <ErrorBanner message={error} variant={errorVariant} onDismiss={() => { setError(null); setErrorVariant('generic'); }} />}

          {/* Single-task results */}
          {singleResult !== null && !error && selectedTask !== 'review-document' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Draft — Review &amp; Edit Before Saving</p>
                <button onClick={handleResetSingleTask} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                  <RotateCcw size={11} />New request
                </button>
              </div>

              {selectedTask === 'draft-rfi' && <RFIOutput result={singleResult as RFIResult} onSave={handleSaveRFIResult} />}
              {selectedTask === 'suggest-assumptions' && <ListOutput items={singleResult as string[]} category="Assumptions" singularLabel="Assumption" savedIndices={[]} onSave={(_, texts) => handleSaveList(texts, 'Assumptions')} onEditItem={() => {}} />}
              {selectedTask === 'suggest-exclusions' && <ListOutput items={singleResult as string[]} category="Exclusions" singularLabel="Exclusion" savedIndices={[]} onSave={(_, texts) => handleSaveList(texts, 'Exclusions')} onEditItem={() => {}} />}
              {selectedTask === 'draft-scope-note' && <ScopeNoteOutput scopeNote={(singleResult as { scopeNote: string }).scopeNote} onSave={handleSaveScopeNote} />}
              {selectedTask === 'identify-risks' && <RisksOutput risks={singleResult as RiskResult[]} convertedIndices={[]} onConvert={(r, a) => handleConvertRisk(r, a)} />}
            </div>
          )}
        </div>

        {/* Footer — generate button */}
        {!review && !isChunking && singleResult === null && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#1e2d4a] shrink-0 bg-[#0d1628]/50">
            <p className="text-[10px] text-slate-600 max-w-xs leading-snug">
              AI suggestions are drafts only. Review and edit all output before saving.
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading || (selectedTask === 'review-document' ? !uploadedFile : !context.trim())}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-900/30"
            >
              {loading ? <Loader size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {loading
                ? selectedTask === 'review-document' ? 'Reviewing...' : 'Generating...'
                : selectedTask === 'review-document'
                  ? isLargePdf ? 'Review in Sections' : 'Review Document'
                  : `Generate ${task.label}`}
            </button>
          </div>
        )}

        {/* Footer — re-review button when review exists */}
        {selectedTask === 'review-document' && review && !loading && !isChunking && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#1e2d4a] shrink-0 bg-[#0d1628]/50">
            <p className="text-[10px] text-slate-600 max-w-xs leading-snug">
              Review results are saved to this tender and will persist between sessions.
            </p>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] text-slate-500 hover:text-slate-300 hover:border-slate-500 rounded-xl text-xs font-semibold transition-colors"
            >
              <RotateCcw size={12} />Run New Review
            </button>
          </div>
        )}

        {/* Footer during chunk processing */}
        {(isChunking || (retrying && chunkStatuses.length > 0 && !review)) && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#1e2d4a] shrink-0 bg-[#0d1628]/50">
            <p className="text-[10px] text-slate-600 max-w-xs leading-snug">
              {retrying ? 'Retrying section and re-merging...' : 'Each section is analysed independently. Findings are preserved even if later sections fail.'}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader size={13} className="animate-spin text-[#f97316]" />
              <span>{retrying ? 'Retrying...' : 'Analysing...'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Large doc warning modal */}
      {showLargeDocWarning && pdfPageCount !== null && (
        <LargeDocWarningModal
          pageCount={pdfPageCount}
          chunkCount={pendingChunkCount}
          onConfirm={() => {
            setShowLargeDocWarning(false);
            const fn = pendingGenerateRef.current;
            pendingGenerateRef.current = null;
            if (fn) fn();
          }}
          onCancel={() => {
            setShowLargeDocWarning(false);
            pendingGenerateRef.current = null;
          }}
        />
      )}

      {/* Feature 3: Reconcile modal */}
      {showReconcile && review && (
        <ReconcileFindings
          tenderId={tender.id}
          tenderName={tender.name}
          tenderClient={tender.client}
          review={review}
          supabaseUrl={supabaseUrl}
          supabaseKey={supabaseKey}
          onApply={handleReconcileApply}
          onClose={() => setShowReconcile(false)}
        />
      )}

      {/* Feature 4: ChatGPT import modal */}
      {showImport && (
        <ChatGPTImport
          tender={tender}
          currentUser={currentUser}
          onImport={handleImportCommit}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-900/40 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">Clear AI Review?</h3>
                <p className="text-xs text-slate-500 mt-0.5">This will remove the saved review results from this tender. Saved items already transferred to Tender &amp; Estimating will not be affected.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors">Cancel</button>
              <button onClick={handleClearReview} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors">Clear Review</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
