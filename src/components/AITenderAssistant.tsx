import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Loader, AlertTriangle, CheckCircle, FileText, HelpCircle, Plus, Save, RotateCcw, Upload, FileSearch, File, Layers, RefreshCw, Trash2 } from 'lucide-react';
import type { TenderRFI, TenderScopeEntry, RFIStatus, StoredAIReview, AIReviewRFI, AIReviewRisk, LucideIcon } from '../data/types';
import { splitPdfIntoChunks, getPdfPageCount, type PdfChunk } from '../lib/pdfChunker';

// ─── Types ────────────────────────────────────────────────────────────────────

type AITask = 'draft-rfi' | 'suggest-assumptions' | 'suggest-exclusions' | 'draft-scope-note' | 'identify-risks' | 'review-document';

type RFIResult = AIReviewRFI;
type RiskResult = AIReviewRisk;

interface DocumentReviewResult {
  rfis: RFIResult[];
  assumptions: string[];
  exclusions: string[];
  scopeNotes: string[];
  risks: RiskResult[];
}

interface ChunkStatus {
  label: string;
  status: 'pending' | 'processing' | 'done' | 'error' | 'warning';
  error?: string;
  canRetry?: boolean;
}

// Single atomic commit — all changes applied in one onUpdate call in the parent,
// eliminating the race where two separate callbacks each spread tenderRef.current
// and the second one overwrites the first.
interface CommitPayload {
  rfis?: TenderRFI[];
  scopeEntries?: TenderScopeEntry[];
  review?: StoredAIReview | null;
}

interface Props {
  tender: { id: string; name: string; client: string; rfis: TenderRFI[]; scopeEntries?: TenderScopeEntry[]; aiReview?: StoredAIReview };
  currentUser: { name: string; avatar?: string } | null;
  onCommit: (payload: CommitPayload) => void;
  onClose: () => void;
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

function ListOutput({ items, category, singularLabel, savedIndices, onSave, onEditItem }: {
  items: string[]; category: string; singularLabel: string;
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
    onSave(toSave, toSave.map(i => items[i]));
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
      {items.map((item, i) => (
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
          <textarea
            value={item}
            onChange={e => onEditItem(i, e.target.value)}
            disabled={savedSet.has(i)}
            rows={2}
            className="flex-1 bg-transparent text-sm text-slate-300 resize-none outline-none leading-relaxed disabled:opacity-60"
          />
          {savedSet.has(i) && <span className="text-[10px] text-emerald-400 font-semibold shrink-0 mt-0.5">Saved</span>}
        </div>
      ))}
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
  const assumptions = review.editedAssumptions ?? review.assumptions;
  const exclusions = review.editedExclusions ?? review.exclusions;
  const scopeNotes = review.editedScopeNotes ?? review.scopeNotes;

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
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers size={14} className="text-[#f97316] shrink-0" />
        <p className="text-xs font-semibold text-slate-300">Processing large tender pack in sections</p>
      </div>
      <div className="space-y-2">
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
                <p className="text-[10px] text-amber-400/80 mt-0.5">No results extracted from this section</p>
              )}
            </div>
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
      <p className="text-[11px] text-slate-500 pl-0.5">{currentStep}</p>
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

function mergeChunkResults(results: DocumentReviewResult[]): DocumentReviewResult {
  return {
    rfis: results.flatMap(r => Array.isArray(r.rfis) ? r.rfis : []),
    assumptions: results.flatMap(r => Array.isArray(r.assumptions) ? r.assumptions.filter(x => typeof x === 'string') : []),
    exclusions: results.flatMap(r => Array.isArray(r.exclusions) ? r.exclusions.filter(x => typeof x === 'string') : []),
    scopeNotes: results.flatMap(r => Array.isArray(r.scopeNotes) ? r.scopeNotes.filter(x => typeof x === 'string') : []),
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
  const [selectedTask, setSelectedTask] = useState<AITask>('review-document');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreditError, setIsCreditError] = useState(false);

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
    const base = (review[editedKey] ?? [...review[baseKey]]) as string[];
    const updated = base.map((x, j) => j === i ? text : x);
    persistReviewOnly({ ...review, [editedKey]: updated });
  }

  // ─── Error / Reset ───────────────────────────────────────────────────────────

  function setAIError(err: unknown) {
    const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
    const isCredit = (err as Error & { errorCode?: string }).errorCode === 'INSUFFICIENT_CREDIT' ||
      msg.toLowerCase().includes('insufficient api credit');
    setError(msg);
    setIsCreditError(isCredit);
  }

  function handleResetSingleTask() {
    setSingleResult(null);
    setError(null);
    setIsCreditError(false);
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
    setIsCreditError(false);
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
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.error) throwFromResponse(data, 'AI request failed');
    return data.result as DocumentReviewResult;
  }

  async function processChunk(file: File, chunk: PdfChunk, pageCount: number): Promise<DocumentReviewResult> {
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
        chunkInfo: `This is ${chunk.label} (pages ${chunk.startPage}–${chunk.endPage} of a ${pageCount}-page document). Extract all commercially relevant information from this section only.`,
      }),
    });
    const data = await res.json();
    if (!res.ok && !data.result) throwFromResponse(data, 'AI request failed');
    return data.result as DocumentReviewResult;
  }

  async function consolidateResults(merged: DocumentReviewResult, pageCount: number, chunkCount: number): Promise<DocumentReviewResult> {
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
      }),
    });
    const data = await res.json();
    if (!res.ok && !data.result) throwFromResponse(data, 'Consolidation failed');
    return data.result as DocumentReviewResult;
  }

  async function processChunkedPdf(file: File, pageCount: number) {
    setCurrentStep('Splitting document into sections...');
    const chunks: PdfChunk[] = await splitPdfIntoChunks(file, pageCount);
    chunksRef.current = chunks;
    chunkResultsRef.current = new Array(chunks.length).fill(null);

    setChunkStatuses([
      ...chunks.map(c => ({ label: c.label, status: 'pending' as const, canRetry: false })),
      { label: 'Consolidating results', status: 'pending' as const, canRetry: false },
    ]);

    for (let i = 0; i < chunks.length; i++) {
      await runChunk(file, chunks, i, pageCount, chunkResultsRef.current);
    }

    return await runConsolidation(file.name, chunks, pageCount);
  }

  async function runChunk(
    file: File,
    chunks: PdfChunk[],
    i: number,
    pageCount: number,
    results: (DocumentReviewResult | null)[],
  ) {
    setChunkStatuses(prev => prev.map((s, j) => j === i ? { ...s, status: 'processing', canRetry: false } : s));
    setCurrentStep(`Reviewing ${chunks[i].label}...`);
    try {
      const result = await processChunk(file, chunks[i], pageCount);
      results[i] = result;
      const isEmpty = !result.rfis?.length && !result.assumptions?.length &&
        !result.exclusions?.length && !result.scopeNotes?.length && !result.risks?.length;
      setChunkStatuses(prev => prev.map((s, j) =>
        j === i ? { ...s, status: isEmpty ? 'warning' : 'done', canRetry: false } : s
      ));
    } catch (err) {
      const isCredit = (err as Error & { errorCode?: string }).errorCode === 'INSUFFICIENT_CREDIT' ||
        (err instanceof Error && err.message.toLowerCase().includes('insufficient api credit'));
      const msg = err instanceof Error ? err.message : 'Failed';
      setChunkStatuses(prev => prev.map((s, j) =>
        j === i ? { ...s, status: 'error', error: msg, canRetry: !isCredit } : s
      ));
      if (isCredit) throw err;
    }
  }

  async function runConsolidation(_fileName: string, chunks: PdfChunk[], pageCount: number): Promise<DocumentReviewResult> {
    const consolidationIdx = chunks.length;
    const successfulResults = (chunkResultsRef.current).filter((r): r is DocumentReviewResult => r !== null);

    if (successfulResults.length === 0) {
      throw new Error('All document sections failed to process. Please try again.');
    }

    setChunkStatuses(prev => prev.map((s, j) =>
      j === consolidationIdx ? { ...s, status: 'processing', canRetry: false } : s
    ));
    setCurrentStep('Consolidating and deduplicating results...');

    const merged = mergeChunkResults(successfulResults);
    let finalResult: DocumentReviewResult;
    try {
      finalResult = await consolidateResults(merged, pageCount, chunks.length);
    } catch {
      finalResult = merged;
    }

    setChunkStatuses(prev => prev.map((s, j) =>
      j === consolidationIdx ? { ...s, status: 'done', canRetry: false } : s
    ));
    setCurrentStep('Review complete.');
    return finalResult;
  }

  async function handleRetryChunk(chunkIndex: number) {
    if (!uploadedFile || !pdfPageCount) return;
    setRetrying(true);
    const chunks = chunksRef.current;
    const results = chunkResultsRef.current;
    try {
      await runChunk(uploadedFile, chunks, chunkIndex, pdfPageCount, results);
      const finalResult = await runConsolidation(uploadedFile.name, chunks, pdfPageCount);
      const stored = makeStoredReview(finalResult, uploadedFile.name);
      persistReviewOnly(stored);
    } catch (e) {
      setAIError(e);
    } finally {
      setRetrying(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSingleResult(null);
    setSavedCount(0);
    setChunkStatuses([]);
    setCurrentStep('');

    try {
      if (selectedTask === 'review-document') {
        if (!uploadedFile) { setError('Please upload a document first.'); return; }

        const mime = uploadedFile.type;
        const isPDF = mime === 'application/pdf' || uploadedFile.name.toLowerCase().endsWith('.pdf');
        const isText = mime.startsWith('text/') || uploadedFile.name.endsWith('.txt') || uploadedFile.name.endsWith('.csv');

        let finalResult: DocumentReviewResult;

        if (isPDF && isLargePdf && pdfPageCount !== null) {
          finalResult = await processChunkedPdf(uploadedFile, pdfPageCount);
        } else if (isPDF) {
          const base64 = await readBlobAsBase64(uploadedFile);
          finalResult = await callEdgeFunction({
            task: 'review-document',
            tenderName: tender.name,
            tenderClient: tender.client,
            documentBase64: base64,
            documentMimeType: mime,
            documentName: uploadedFile.name,
          });
        } else if (isText) {
          const text = await readFileAsText(uploadedFile);
          finalResult = await callEdgeFunction({
            task: 'review-document',
            tenderName: tender.name,
            tenderClient: tender.client,
            documentText: text,
            documentName: uploadedFile.name,
          });
        } else {
          const base64 = await readBlobAsBase64(uploadedFile);
          finalResult = await callEdgeFunction({
            task: 'review-document',
            tenderName: tender.name,
            tenderClient: tender.client,
            documentBase64: base64,
            documentMimeType: mime,
            documentName: uploadedFile.name,
          });
        }

        // Persist review immediately so it survives tab switches
        const stored = makeStoredReview(finalResult, uploadedFile.name);
        persistReviewOnly(stored);

      } else {
        if (!context.trim()) { setError('Please enter some context first.'); return; }
        const res = await fetch(`${supabaseUrl}/functions/v1/ai-tender-assistant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({ task: selectedTask, tenderName: tender.name, tenderClient: tender.client, context }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? 'AI request failed');
        setSingleResult(data.result);
      }
    } catch (e) {
      setAIError(e);
    } finally {
      setLoading(false);
    }
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
                  onClick={() => { setSelectedTask(t.id); setSingleResult(null); setError(null); setIsCreditError(false); setSavedCount(0); setPdfPageCount(null); setChunkStatuses([]); setCurrentStep(''); }}
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
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Review Results — Review &amp; Save</p>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11} />Clear review
                </button>
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
                    <button onClick={() => { setUploadedFile(null); setPdfPageCount(null); setSingleResult(null); setError(null); setIsCreditError(false); setChunkStatuses([]); }}
                      className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-[#1a2236] rounded-lg transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  </div>

                  {isLargePdf && (
                    <div className="flex items-start gap-2.5 bg-blue-900/15 border border-blue-800/40 rounded-xl p-3.5">
                      <Layers size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-blue-300 mb-1">
                          Large tender pack detected — {pdfPageCount} pages
                        </p>
                        <p className="text-xs text-blue-400/80 leading-relaxed">
                          VYSITE will automatically split and review this document in 50-page sections, then
                          combine and consolidate all findings into one complete review. This may take a few minutes.
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

          {/* Error */}
          {error && !isCreditError && (
            <div className="flex items-start gap-2.5 bg-red-900/20 border border-red-800/50 rounded-xl p-3.5">
              <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
          {error && isCreditError && (
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                <p className="text-xs font-bold text-amber-300">Anthropic API Credit Required</p>
              </div>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                AI review could not continue because the connected Anthropic account has insufficient API credit. Please add credit to the Anthropic account and retry.
              </p>
              <p className="text-[10px] text-amber-500/70">
                This is an external billing issue — your tender document and chunking are working correctly.
              </p>
            </div>
          )}

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
              {retrying ? 'Retrying section and re-consolidating...' : 'Processing sections sequentially. This may take a few minutes for large documents.'}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader size={13} className="animate-spin text-[#f97316]" />
              <span>{retrying ? 'Retrying...' : 'Reviewing...'}</span>
            </div>
          </div>
        )}
      </div>

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
