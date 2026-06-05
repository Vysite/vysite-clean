import React, { useState, useRef, useCallback } from 'react';
import {
  Sparkles, Upload, FileText, AlertTriangle, Loader,
  X, Save, Info, ChevronDown, ChevronUp, Trash2, ShieldAlert,
  BookOpen, Copy, Check, Plus, ArrowLeft, FileSearch, Clock,
  Download,
} from 'lucide-react';
import type { Tender, TenderDocument } from '../data/types';
import { openPrintTab, buildPrintDocument } from '../lib/printTab';
import type {
  ContractReviewRecord, ContractReviewFinding, ContractRiskLevel,
  ContractReviewDoc,
} from '../data/types';
import { splitPdfIntoChunks, getPdfPageCount } from '../lib/pdfChunker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  tender: Tender;
  currentUser: { name: string } | null;
  // Replaces the whole reviews array — parent persists to DB
  onUpdateReviews: (reviews: ContractReviewRecord[]) => void;
  // Appends a document to tender.documents so it shows in Documents tab
  onAddDocument: (doc: TenderDocument) => void;
}

type ProcessState = 'idle' | 'running' | 'complete' | 'error';
type View = 'list' | 'detail';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = '.pdf,.txt,.doc,.docx,.rtf';
const MAX_FILE_MB = 50;
const PDF_CHUNK_THRESHOLD = 50;

const RISK_COLORS: Record<ContractRiskLevel, string> = {
  high:   'bg-red-900/50 text-red-300 border-red-800/60',
  medium: 'bg-amber-900/50 text-amber-300 border-amber-800/60',
  low:    'bg-slate-700/60 text-slate-300 border-slate-600/60',
};

const RISK_DOT: Record<ContractRiskLevel, string> = {
  high:   'bg-red-400',
  medium: 'bg-amber-400',
  low:    'bg-slate-400',
};

const CONTRACT_SECTIONS = [
  'Key Commercial Risks',
  'Payment Terms',
  'Valuation / Application Process',
  'Notice Requirements',
  'Delay / Hold-Up Procedures',
  'Variation Procedures',
  'Retention',
  'Liquidated Damages',
  'Design Liability',
  'Programme / Time Obligations',
  'Key Dates / Timeframes',
  'Commercial Exposure',
  'Suggested Renegotiation Points',
  'Operational Considerations',
  'Commercial Handover Notes',
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function riskLabel(r: ContractRiskLevel) {
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function newId() {
  return `cr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SL({ text }: { text: string }) {
  return <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{text}</p>;
}

// ─── Finding card ─────────────────────────────────────────────────────────────

function FindingCard({
  finding,
  onChange,
}: {
  finding: ContractReviewFinding;
  onChange: (f: ContractReviewFinding) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(finding);

  const save = () => { onChange(draft); setEditing(false); };

  const riskBadge = (r: ContractRiskLevel) => (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RISK_COLORS[r]}`}>
      {riskLabel(r)}
    </span>
  );

  return (
    <div className={`bg-[#0d1628] border rounded-xl overflow-hidden ${
      finding.risk === 'high' ? 'border-red-800/40' :
      finding.risk === 'medium' ? 'border-amber-800/30' : 'border-[#1e2d4a]'
    }`}>
      <div
        className="flex items-start gap-2.5 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => !editing && setExpanded(e => !e)}
      >
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${RISK_DOT[finding.risk]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full">{finding.section}</span>
            {riskBadge(finding.risk)}
          </div>
          <p className="text-sm font-semibold text-slate-200 mt-1 leading-snug">{finding.title}</p>
        </div>
        <button onClick={e => { e.stopPropagation(); setEditing(v => !v); setExpanded(true); }}
          className="p-1 rounded text-slate-600 hover:text-[#f97316] transition-colors shrink-0" title="Edit">
          <BookOpen size={12} />
        </button>
        <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className="p-1 rounded text-slate-600 hover:text-slate-400 transition-colors shrink-0">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#1e2d4a]">
          {editing ? (
            <div className="pt-3 space-y-3">
              <div>
                <SL text="Section" />
                <select value={draft.section} onChange={e => setDraft(d => ({ ...d, section: e.target.value }))}
                  className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316]">
                  {CONTRACT_SECTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <SL text="Title" />
                <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316]" />
              </div>
              <div>
                <SL text="Risk Level" />
                <div className="flex gap-2">
                  {(['high', 'medium', 'low'] as ContractRiskLevel[]).map(r => (
                    <button key={r} type="button" onClick={() => setDraft(d => ({ ...d, risk: r }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        draft.risk === r ? RISK_COLORS[r] : 'bg-[#111827] border-[#1e2d4a] text-slate-500 hover:border-slate-500'
                      }`}>
                      {riskLabel(r)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <SL text="Summary" />
                <textarea value={draft.summary} onChange={e => setDraft(d => ({ ...d, summary: e.target.value }))} rows={3}
                  className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] resize-none leading-relaxed" />
              </div>
              <div>
                <SL text="Recommendation" />
                <textarea value={draft.recommendation} onChange={e => setDraft(d => ({ ...d, recommendation: e.target.value }))} rows={2}
                  className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] resize-none leading-relaxed" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => { setDraft(finding); setEditing(false); }}
                  className="px-3 py-1.5 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-400 hover:bg-[#1e2d4a]">Cancel</button>
                <button onClick={save}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
                  <Save size={11} />Save
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-3 space-y-3">
              <div>
                <SL text="Summary" />
                <p className="text-sm text-slate-300 leading-relaxed">{finding.summary}</p>
              </div>
              <div>
                <SL text="Recommendation" />
                <p className="text-sm text-emerald-300/90 leading-relaxed">{finding.recommendation}</p>
              </div>
              {finding.source && (finding.source.clause || finding.source.section || finding.source.page || finding.source.snippet) && (
                <div className="bg-[#111827] border border-[#1e2d4a] rounded-lg p-3 space-y-1.5">
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-2">Source Traceability</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                    {finding.source.clause && (
                      <div>
                        <p className="text-[9px] text-slate-600 uppercase tracking-wider">Clause</p>
                        <p className="text-xs text-slate-400 font-mono">{finding.source.clause}</p>
                      </div>
                    )}
                    {finding.source.section && (
                      <div>
                        <p className="text-[9px] text-slate-600 uppercase tracking-wider">Section</p>
                        <p className="text-xs text-slate-400">{finding.source.section}</p>
                      </div>
                    )}
                    {finding.source.page && (
                      <div>
                        <p className="text-[9px] text-slate-600 uppercase tracking-wider">Page</p>
                        <p className="text-xs text-slate-400">{finding.source.page}</p>
                      </div>
                    )}
                  </div>
                  {finding.source.snippet && (
                    <div className="mt-2 bg-[#0d1628] border border-[#1e2d4a] rounded px-3 py-2">
                      <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">Contract wording</p>
                      <p className="text-xs text-slate-500 italic leading-relaxed">"{finding.source.snippet}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Review list panel ────────────────────────────────────────────────────────

function ReviewListPanel({
  reviews,
  onOpen,
  onNew,
  onDelete,
}: {
  reviews: ContractReviewRecord[];
  onOpen: (r: ContractReviewRecord) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-200">Contract Reviews</p>
          <p className="text-xs text-slate-500 mt-0.5">{reviews.length} review{reviews.length !== 1 ? 's' : ''} saved</p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors"
        >
          <Plus size={13} />New Review
        </button>
      </div>

      {reviews.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-[#1e2d4a] rounded-xl text-center">
          <FileSearch size={28} className="text-slate-700 mb-3" />
          <p className="text-sm font-semibold text-slate-500 mb-1">No contract reviews yet</p>
          <p className="text-xs text-slate-600 mb-4 max-w-xs">
            Upload a contract PDF and run the AI review to identify commercial risks before mobilisation.
          </p>
          <button onClick={onNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors">
            <Sparkles size={12} />Start First Review
          </button>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-2">
          {[...reviews].reverse().map(r => {
            const highCount = r.findings.filter(f => f.risk === 'high').length;
            const medCount  = r.findings.filter(f => f.risk === 'medium').length;
            return (
              <div
                key={r.id}
                className="group flex items-center gap-3 bg-[#0d1628] border border-[#1e2d4a] hover:border-slate-500/60 rounded-xl px-4 py-3.5 cursor-pointer transition-all"
                onClick={() => onOpen(r)}
              >
                <div className="w-9 h-9 rounded-lg bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center shrink-0">
                  <FileText size={15} className="text-[#f97316]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{r.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-slate-600">
                      <Clock size={9} />{fmtDate(r.createdAt)}
                    </span>
                    {r.createdBy && (
                      <span className="text-[10px] text-slate-600">· {r.createdBy}</span>
                    )}
                    <span className="text-[10px] text-slate-600">· {r.documents.length} doc{r.documents.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {highCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-900/50 text-red-300 border border-red-800/50">
                      {highCount} high
                    </span>
                  )}
                  {medCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-800/40">
                      {medCount} med
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(r.id); }}
                    className="p-1.5 rounded text-slate-700 hover:text-red-400 hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete review"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Review detail panel ──────────────────────────────────────────────────────

function ReviewDetailPanel({
  record,
  tenderName,
  currentUser,
  processState,
  progress,
  error,
  onRunReview,
  onCancelRun,
  onUpdateRecord,
  onBack,
  onRemoveFile,
  stagedFiles,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  fileInputRef,
  onFileInput,
  savedFeedback,
}: {
  record: ContractReviewRecord;
  tenderName: string;
  currentUser: { name: string } | null;
  processState: ProcessState;
  progress: { current: number; total: number; label: string };
  error: { message: string; code: string } | null;
  onRunReview: () => void;
  onCancelRun: () => void;
  onUpdateRecord: (r: ContractReviewRecord) => void;
  onBack: () => void;
  onRemoveFile: (name: string) => void;
  stagedFiles: File[];
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  savedFeedback: boolean;
}) {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const hasResults = record.findings.length > 0 || record.executiveSummary;
  const isRunning = processState === 'running';

  const riskCounts = {
    high:   record.findings.filter(f => f.risk === 'high').length,
    medium: record.findings.filter(f => f.risk === 'medium').length,
    low:    record.findings.filter(f => f.risk === 'low').length,
  };

  const sectionGroups = CONTRACT_SECTIONS.reduce<Record<string, ContractReviewFinding[]>>((acc, s) => {
    const group = record.findings.filter(f => f.section === s);
    if (group.length > 0) acc[s] = group;
    return acc;
  }, {});

  const otherFindings = record.findings.filter(
    f => !CONTRACT_SECTIONS.includes(f.section as typeof CONTRACT_SECTIONS[number])
  );

  const updateFinding = (index: number, updated: ContractReviewFinding) => {
    const findings = record.findings.map((f, i) => i === index ? updated : f);
    onUpdateRecord({ ...record, findings });
  };

  const removeFinding = (index: number) => {
    const findings = record.findings.filter((_, i) => i !== index);
    onUpdateRecord({ ...record, findings });
  };

  const handleExportPDF = () => {
    const allDocs = [...record.documents, ...stagedFiles.map(f => ({ name: f.name }))];
    const docListHtml = allDocs.length
      ? allDocs.map(d => `<li>${d.name}</li>`).join('')
      : '<li>No documents listed</li>';

    const riskBadge = (r: ContractRiskLevel) => {
      const colors: Record<ContractRiskLevel, string> = {
        high: 'background:#7f1d1d;color:#fca5a5',
        medium: 'background:#78350f;color:#fcd34d',
        low: 'background:#1e293b;color:#94a3b8',
      };
      return `<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:9px;${colors[r]};text-transform:uppercase;letter-spacing:0.06em">${r}</span>`;
    };

    const findingRowHtml = (f: ContractReviewFinding, i: number) => {
      const sourceHtml = f.source
        ? `<div style="margin-top:4px;font-size:10px;color:#64748b">`
          + (f.source.clause ? `Clause: ${f.source.clause}` : '')
          + (f.source.section ? (f.source.clause ? ' · ' : '') + `Section: ${f.source.section}` : '')
          + (f.source.page ? ` · Page: ${f.source.page}` : '')
          + (f.source.snippet ? `<br/><em style="color:#94a3b8">"${f.source.snippet}"</em>` : '')
          + `</div>`
        : '';
      return `<div style="margin-bottom:10px;padding:10px 12px;border:1px solid #1e2d4a;border-left:3px solid ${f.risk === 'high' ? '#ef4444' : f.risk === 'medium' ? '#f59e0b' : '#475569'};border-radius:6px;background:#0d1628">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">
          <strong style="font-size:11px;color:#e2e8f0">${i + 1}. ${f.title}</strong>
          ${riskBadge(f.risk)}
        </div>
        <p style="font-size:11px;color:#94a3b8;margin-bottom:4px">${f.summary}</p>
        ${f.recommendation ? `<p style="font-size:11px;color:#cbd5e1"><strong style="color:#f97316">Recommendation:</strong> ${f.recommendation}</p>` : ''}
        ${sourceHtml}
      </div>`;
    };

    const sectionHtml = CONTRACT_SECTIONS.map(section => {
      const findings = record.findings.filter(f => f.section === section);
      if (!findings.length) return '';
      return `<div style="margin-bottom:16px">
        <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#f97316;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #1e2d4a">${section}</h3>
        ${findings.map((f, i) => findingRowHtml(f, i)).join('')}
      </div>`;
    }).join('');

    const otherFindings = record.findings.filter(
      f => !CONTRACT_SECTIONS.includes(f.section as typeof CONTRACT_SECTIONS[number])
    );
    const otherHtml = otherFindings.length
      ? `<div style="margin-bottom:16px">
          <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#f97316;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #1e2d4a">Other Findings</h3>
          ${otherFindings.map((f, i) => findingRowHtml(f, i)).join('')}
        </div>`
      : '';

    const handoverHtml = record.commercialHandoverNotes
      ? `<div style="margin-bottom:16px">
          <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#f97316;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #1e2d4a">Commercial Handover Notes</h3>
          <p style="font-size:11px;color:#94a3b8;white-space:pre-wrap">${record.commercialHandoverNotes}</p>
        </div>`
      : '';

    const notesHtml = record.notes
      ? `<div style="margin-bottom:16px">
          <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#f97316;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #1e2d4a">Internal Notes</h3>
          <p style="font-size:11px;color:#94a3b8;white-space:pre-wrap">${record.notes}</p>
        </div>`
      : '';

    const body = `
      <div style="background:#0d1628;min-height:100vh;padding:0">
        <!-- Header -->
        <div style="background:#1a2236;border-bottom:2px solid #f97316;padding:24px 32px;margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#f97316;margin-bottom:4px">VYSITE · AI Contract Review</div>
              <h1 style="font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:2px">${record.title || 'Contract Review'}</h1>
              <p style="font-size:12px;color:#64748b">${tenderName}</p>
            </div>
            <div style="text-align:right">
              <p style="font-size:11px;color:#64748b">Date: ${fmtDate(record.createdAt)}</p>
              ${currentUser ? `<p style="font-size:11px;color:#64748b">Prepared by: ${currentUser.name}</p>` : ''}
              <div style="display:flex;gap:8px;margin-top:6px;justify-content:flex-end">
                <span style="font-size:10px;padding:3px 8px;background:#7f1d1d;color:#fca5a5;border-radius:6px">${riskCounts.high} High</span>
                <span style="font-size:10px;padding:3px 8px;background:#78350f;color:#fcd34d;border-radius:6px">${riskCounts.medium} Medium</span>
                <span style="font-size:10px;padding:3px 8px;background:#1e293b;color:#94a3b8;border-radius:6px">${riskCounts.low} Low</span>
              </div>
            </div>
          </div>
        </div>

        <div style="padding:0 32px 32px">
          <!-- Disclaimer -->
          <div style="background:#1a2236;border:1px solid #f97316;border-radius:8px;padding:10px 14px;margin-bottom:20px;display:flex;gap:8px">
            <span style="color:#f97316;font-size:14px;line-height:1">⚠</span>
            <p style="font-size:10px;color:#94a3b8;line-height:1.5"><strong style="color:#f97316">Disclaimer:</strong> This AI review is intended as operational and commercial support only and does not constitute legal advice. Contracts should be reviewed by a qualified professional where legal certainty is required.</p>
          </div>

          <!-- Documents reviewed -->
          <div style="margin-bottom:20px">
            <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#f97316;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #1e2d4a">Contract Documents Reviewed</h3>
            <ul style="list-style:disc;padding-left:16px;font-size:11px;color:#94a3b8;line-height:1.8">${docListHtml}</ul>
          </div>

          ${record.executiveSummary ? `
          <!-- Executive Summary -->
          <div style="margin-bottom:20px">
            <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#f97316;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #1e2d4a">Executive Summary</h3>
            <div style="background:#1a2236;border:1px solid #1e2d4a;border-radius:8px;padding:12px 14px">
              <p style="font-size:11px;color:#cbd5e1;line-height:1.7;white-space:pre-wrap">${record.executiveSummary}</p>
            </div>
          </div>` : ''}

          ${sectionHtml}
          ${otherHtml}
          ${handoverHtml}
          ${notesHtml}

          <!-- Footer -->
          <div style="border-top:1px solid #1e2d4a;margin-top:24px;padding-top:12px;display:flex;justify-content:space-between">
            <p style="font-size:9px;color:#475569">Generated by VYSITE · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <p style="font-size:9px;color:#475569">CONFIDENTIAL — FOR INTERNAL USE ONLY</p>
          </div>
        </div>
      </div>`;

    const styles = `
      body { background: #0d1628 !important; color: #e2e8f0; padding: 0; }
      @media print {
        body { background: #0d1628 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { margin: 0; size: A4; }
      }
    `;

    openPrintTab(buildPrintDocument(
      `Contract Review — ${tenderName} — ${record.title || fmtDate(record.createdAt)}`,
      styles,
      body,
    ));
  };

  const canRun = (record.documents.length > 0 || stagedFiles.length > 0) && !isRunning;

  return (
    <div className="space-y-5">

      {/* Back + title bar */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
          <ArrowLeft size={12} />All Reviews
        </button>
        <div className="flex-1 min-w-0">
          <input
            value={record.title}
            onChange={e => onUpdateRecord({ ...record, title: e.target.value })}
            className="w-full bg-transparent text-sm font-bold text-slate-200 outline-none focus:text-white placeholder:text-slate-600 border-b border-transparent focus:border-[#f97316] transition-colors pb-0.5"
            placeholder="Review title…"
          />
          <p className="text-[10px] text-slate-600 mt-0.5">
            {fmtDateTime(record.createdAt)}{record.createdBy ? ` · ${record.createdBy}` : ''}
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-3">
        <Info size={13} className="text-slate-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-400">Disclaimer:</span>{' '}
          This AI review is for operational and commercial support only and does not constitute legal advice.
          Contracts should be reviewed by a qualified professional where legal certainty is required.
        </p>
      </div>

      {/* Documents section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contract Documents</p>
          <span className="text-[10px] text-slate-600">{record.documents.length + stagedFiles.length} file{(record.documents.length + stagedFiles.length) !== 1 ? 's' : ''}</span>
        </div>

        {/* PDF-first upload zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !isRunning && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl px-5 py-5 text-center transition-all ${
            isRunning ? 'opacity-50 cursor-not-allowed' :
            dragOver ? 'border-[#f97316] bg-orange-900/10 cursor-pointer' :
            'border-[#1e2d4a] hover:border-slate-500/60 bg-[#0d1628] cursor-pointer'
          }`}
        >
          <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={onFileInput} className="hidden" multiple />
          <Upload size={18} className="text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-400 mb-0.5">Upload Contract PDF</p>
          <p className="text-[11px] text-slate-600">For best AI review results, upload clean searchable PDF documents.</p>
          <p className="text-[10px] text-slate-700 mt-0.5">Word documents can be converted to PDF before upload. Max {MAX_FILE_MB}MB.</p>
        </div>

        {/* Saved document metadata list */}
        {record.documents.map((doc, i) => (
          <div key={`${doc.name}-${i}`} className="flex items-center gap-2.5 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2">
            <div className="w-7 h-7 rounded bg-[#111827] border border-[#1e2d4a] flex items-center justify-center shrink-0">
              <FileText size={12} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">{doc.name}</p>
              <p className="text-[10px] text-slate-600">{doc.size > 0 ? fmtSize(doc.size) : 'Previously uploaded'} · {fmtDate(doc.addedAt)}</p>
            </div>
          </div>
        ))}

        {/* Staged (in-memory) files ready to run */}
        {stagedFiles.map(f => (
          <div key={f.name} className="flex items-center gap-2.5 bg-emerald-900/10 border border-emerald-700/40 rounded-lg px-3 py-2 group">
            <div className="w-7 h-7 rounded bg-[#111827] border border-emerald-800/40 flex items-center justify-center shrink-0">
              <FileText size={12} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{f.name}</p>
              <p className="text-[10px] text-emerald-600">{fmtSize(f.size)} · Ready to process</p>
            </div>
            <button onClick={() => !isRunning && onRemoveFile(f.name)}
              disabled={isRunning}
              className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className={`flex items-start gap-2.5 rounded-xl p-3.5 ${
          error.code === 'provider_overloaded'
            ? 'bg-sky-900/20 border border-sky-800/50'
            : 'bg-red-900/20 border border-red-800/50'
        }`}>
          <AlertTriangle size={14} className={`shrink-0 mt-0.5 ${error.code === 'provider_overloaded' ? 'text-sky-400' : 'text-red-400'}`} />
          <div className="flex-1">
            <p className={`text-xs font-bold mb-0.5 ${error.code === 'provider_overloaded' ? 'text-sky-300' : 'text-red-300'}`}>
              {error.code === 'provider_overloaded' ? 'AI Service Temporarily Overloaded' : 'Review failed'}
            </p>
            <p className={`text-xs leading-relaxed ${error.code === 'provider_overloaded' ? 'text-sky-300/80' : 'text-red-300/80'}`}>
              {error.message}
            </p>
            {error.code === 'auth_error' && (
              <p className="text-xs text-red-400/70 mt-1">Check that ANTHROPIC_API_KEY is configured in Supabase project secrets.</p>
            )}
            {error.code === 'provider_overloaded' && (
              <p className="text-[10px] text-sky-500/70 mt-1">No AI allowance has been consumed. Your document is still ready to review.</p>
            )}
          </div>
        </div>
      )}

      {/* Run / progress */}
      <div className="space-y-2">
        <button
          onClick={onRunReview}
          disabled={!canRun}
          className="w-full flex items-center justify-center gap-2.5 py-3 bg-[#f97316] hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <><Loader size={14} className="animate-spin" />{progress.label || 'Processing…'}</>
          ) : (
            <><Sparkles size={14} />Run AI Contract Review</>
          )}
        </button>

        {isRunning && progress.total > 1 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>{progress.label}</span>
              <span>{progress.current}/{progress.total}</span>
            </div>
            <div className="h-1.5 bg-[#1e2d4a] rounded-full overflow-hidden">
              <div className="h-full bg-[#f97316] rounded-full transition-all duration-500"
                style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {isRunning && (
          <button onClick={onCancelRun}
            className="w-full py-2 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors">
            Cancel
          </button>
        )}
      </div>

      {/* Results */}
      {hasResults && !isRunning && (
        <div className="space-y-5">

          {/* Risk strip */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'High', value: riskCounts.high, color: 'text-red-400', border: 'border-red-900/50' },
              { label: 'Medium', value: riskCounts.medium, color: 'text-amber-400', border: 'border-amber-900/40' },
              { label: 'Low', value: riskCounts.low, color: 'text-slate-400', border: 'border-[#1e2d4a]' },
            ].map(s => (
              <div key={s.label} className={`bg-[#0d1628] border ${s.border} rounded-xl px-3 py-2.5 text-center`}>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-600 mt-0.5">{s.label} Risk</p>
              </div>
            ))}
          </div>

          {/* Executive Summary */}
          {record.executiveSummary && (
            <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={14} className="text-[#f97316]" />
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Executive Summary</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(record.executiveSummary); setCopiedSummary(true); setTimeout(() => setCopiedSummary(false), 2000); }}
                  className="p-1 rounded text-slate-600 hover:text-slate-400 transition-colors" title="Copy">
                  {copiedSummary ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{record.executiveSummary}</p>
            </div>
          )}

          {/* Findings by section */}
          {Object.entries(sectionGroups).map(([section, findings]) => (
            <div key={section} className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-0.5">{section}</p>
              {findings.map(finding => {
                const idx = record.findings.indexOf(finding);
                return (
                  <div key={finding.id} className="flex items-start gap-1.5 group">
                    <div className="flex-1 min-w-0">
                      <FindingCard finding={finding} onChange={updated => updateFinding(idx, updated)} />
                    </div>
                    <button onClick={() => removeFinding(idx)}
                      className="p-1.5 rounded text-slate-700 hover:text-red-400 hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-1" title="Remove">
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Uncategorised */}
          {otherFindings.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-0.5">Other Findings</p>
              {otherFindings.map(finding => {
                const idx = record.findings.indexOf(finding);
                return (
                  <div key={finding.id} className="flex items-start gap-1.5 group">
                    <div className="flex-1 min-w-0">
                      <FindingCard finding={finding} onChange={updated => updateFinding(idx, updated)} />
                    </div>
                    <button onClick={() => removeFinding(idx)}
                      className="p-1.5 rounded text-slate-700 hover:text-red-400 hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-1" title="Remove">
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Commercial Handover Notes */}
          {record.commercialHandoverNotes !== undefined && (
            <div className="bg-[#0d1628] border border-emerald-900/40 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <BookOpen size={14} className="text-emerald-400" />
                <p className="text-xs font-bold text-emerald-300/80 uppercase tracking-wider">Commercial Handover Notes</p>
              </div>
              <textarea
                value={record.commercialHandoverNotes}
                onChange={e => onUpdateRecord({ ...record, commercialHandoverNotes: e.target.value })}
                rows={4}
                className="w-full bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-[#f97316] resize-none leading-relaxed"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <SL text="Review Notes" />
            <textarea
              value={record.notes}
              onChange={e => onUpdateRecord({ ...record, notes: e.target.value })}
              rows={3}
              placeholder="Add any additional notes, actions or observations…"
              className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-[#f97316] resize-none leading-relaxed placeholder:text-slate-600"
            />
          </div>

          {/* Save bar */}
          <div className="flex items-center justify-between pt-1 border-t border-[#1e2d4a] gap-2 flex-wrap">
            <p className="text-xs text-slate-600">
              {record.findings.length} findings · {fmtDateTime(record.createdAt)}
              {currentUser ? ` · ${currentUser.name}` : ''}
            </p>
            <div className="flex items-center gap-2">
              {hasResults && (
                <button onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-4 py-2 border border-[#1e2d4a] hover:border-slate-500 text-slate-400 hover:text-white rounded-lg text-xs font-semibold transition-colors">
                  <Download size={12} />Export PDF Report
                </button>
              )}
              <button onClick={() => onUpdateRecord(record)}
                className="flex items-center gap-2 px-5 py-2 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors">
                {savedFeedback ? <><Check size={12} />Saved</> : <><Save size={12} />Save Review</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state — ready to run */}
      {!hasResults && !isRunning && !error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileSearch size={24} className="text-slate-700 mb-2" />
          <p className="text-xs text-slate-600">Upload a contract PDF above and click Run AI Contract Review.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIContractReview({ tender, currentUser, onUpdateReviews, onAddDocument: _onAddDocument }: Props) {
  const reviews: ContractReviewRecord[] = tender.contractReviews ?? [];
  const { currentOrgId, user: authUser } = useAuth();

  const [view, setView] = useState<View>('list');
  const [activeRecord, setActiveRecord] = useState<ContractReviewRecord | null>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [savedFeedback, setSavedFeedback] = useState(false); // flash "Saved" on Save Review button
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  // ─── Navigation ────────────────────────────────────────────────────────────

  const openReview = (r: ContractReviewRecord) => {
    setActiveRecord(r);
    setStagedFiles([]);
    setError(null);
    setProcessState('idle');
    setView('detail');
  };

  const startNewReview = () => {
    const now = new Date().toISOString();
    const record: ContractReviewRecord = {
      id: newId(),
      title: `Contract Review — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      createdAt: now,
      createdBy: currentUser?.name ?? '',
      documents: [],
      executiveSummary: '',
      findings: [],
      commercialHandoverNotes: '',
      notes: '',
      savedToDocuments: false,
    };
    setActiveRecord(record);
    setStagedFiles([]);
    setError(null);
    setProcessState('idle');
    setView('detail');
  };

  const backToList = () => {
    setView('list');
    setActiveRecord(null);
    setStagedFiles([]);
    setError(null);
    setProcessState('idle');
  };

  const handleSaveReview = (record: ContractReviewRecord) => {
    const exists = reviews.some(r => r.id === record.id);
    if (exists) {
      onUpdateReviews(reviews.map(r => r.id === record.id ? record : r));
    } else {
      onUpdateReviews([...reviews, record]);
    }
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleDeleteReview = (id: string) => {
    onUpdateReviews(reviews.filter(r => r.id !== id));
    if (activeRecord?.id === id) backToList();
  };

  // ─── File handling ─────────────────────────────────────────────────────────

  const acceptFile = useCallback((f: File) => {
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError({ message: `File exceeds ${MAX_FILE_MB}MB limit.`, code: 'file_too_large' });
      return;
    }
    setStagedFiles(prev => prev.some(x => x.name === f.name) ? prev : [...prev, f]);
    setError(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(acceptFile);
  }, [acceptFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(acceptFile);
    e.target.value = '';
  };

  const removeStaged = (name: string) => setStagedFiles(prev => prev.filter(f => f.name !== name));

  // ─── AI processing ─────────────────────────────────────────────────────────

  const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-contract-review`;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  async function callEdgeFn(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${anonKey}`;
    const res = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'Apikey': anonKey },
      body: JSON.stringify({
        ...body,
        ...(currentOrgId ? { orgId: currentOrgId } : {}),
        ...(authUser?.id ? { userId: authUser.id } : {}),
      }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      throw Object.assign(new Error(json.error ?? 'Edge function error'), { code: json.code ?? 'generic_error' });
    }
    return json as Record<string, unknown>;
  }

  async function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function fileToText(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(f);
    });
  }

  const runReview = async () => {
    if (!activeRecord || stagedFiles.length === 0) return;
    abortRef.current = false;
    setProcessState('running');
    setError(null);
    setProgress({ current: 0, total: 1, label: 'Preparing documents…' });

    const allFindings: ContractReviewFinding[] = [];
    let executiveSummary = '';
    let commercialHandoverNotes = '';
    let chunkTotal = 0;
    let chunkDone = 0;

    // Pre-calculate total chunks across all staged files
    try {
      type Chunk = { base64?: string; text?: string; pageRange: string; index: number; total: number; fileName: string };
      const allChunks: Chunk[] = [];

      for (const file of stagedFiles) {
        const isPdf = file.type === 'application/pdf';
        if (isPdf) {
          const rawPages = await getPdfPageCount(file);
          const pageCount = rawPages ?? 1;
          if (pageCount > PDF_CHUNK_THRESHOLD) {
            const pdfChunks = await splitPdfIntoChunks(file, pageCount);
            for (let i = 0; i < pdfChunks.length; i++) {
              allChunks.push({
                base64: await fileToBase64(new File([pdfChunks[i].blob], file.name, { type: 'application/pdf' })),
                pageRange: `${pdfChunks[i].startPage}–${pdfChunks[i].endPage}`,
                index: i,
                total: pdfChunks.length,
                fileName: file.name,
              });
            }
          } else {
            allChunks.push({ base64: await fileToBase64(file), pageRange: `1–${pageCount}`, index: 0, total: 1, fileName: file.name });
          }
        } else {
          const text = await fileToText(file);
          const CHUNK_CHARS = 8000;
          if (text.length > CHUNK_CHARS) {
            const parts: string[] = [];
            for (let i = 0; i < text.length; i += CHUNK_CHARS) parts.push(text.slice(i, i + CHUNK_CHARS));
            parts.forEach((t, i) => allChunks.push({ text: t, pageRange: `Part ${i + 1}`, index: i, total: parts.length, fileName: file.name }));
          } else {
            allChunks.push({ text, pageRange: 'Full document', index: 0, total: 1, fileName: file.name });
          }
        }
      }

      chunkTotal = allChunks.length;
      setProgress({ current: 0, total: chunkTotal, label: `Analysing section 1 of ${chunkTotal}…` });

      for (const chunk of allChunks) {
        if (abortRef.current) break;
        setProgress({ current: chunkDone + 1, total: chunkTotal, label: `Analysing section ${chunkDone + 1} of ${chunkTotal}…` });

        const body: Record<string, unknown> = {
          tenderName: tender.name,
          tenderClient: tender.client,
          documentName: chunk.fileName,
          chunkIndex: chunk.index,
          chunkTotal: chunk.total,
          chunkPageRange: chunk.pageRange,
        };
        if (chunk.base64) { body.documentBase64 = chunk.base64; body.documentMimeType = 'application/pdf'; }
        else { body.documentText = chunk.text; }

        const result = await callEdgeFn(body);
        const findings = result.findings as ContractReviewFinding[] | undefined;
        if (Array.isArray(findings)) {
          findings.forEach((f, idx) => allFindings.push({ ...f, id: f.id ?? `cr-${Date.now()}-${chunkDone}-${idx}` }));
        }
        if (chunkDone === 0) {
          executiveSummary = (result.executiveSummary as string) ?? '';
          commercialHandoverNotes = (result.commercialHandoverNotes as string) ?? '';
        } else {
          if (result.executiveSummary) executiveSummary += '\n\n' + (result.executiveSummary as string);
          if (result.commercialHandoverNotes) commercialHandoverNotes += '\n\n' + (result.commercialHandoverNotes as string);
        }
        chunkDone++;
      }

      if (abortRef.current) { setProcessState('idle'); return; }

      const finalFindings = allFindings.map((f, i) => ({ ...f, id: f.id ?? `cr-${Date.now()}-${i}` }));

      // Build document metadata from staged files (no binary)
      const now = new Date().toISOString();
      const newDocs: ContractReviewDoc[] = stagedFiles.map(f => ({
        name: f.name, size: f.size, type: f.type, addedAt: now,
      }));

      // Deduplicate against already-saved documents
      const existingNames = new Set(activeRecord.documents.map(d => d.name));
      const docsToAdd = newDocs.filter(d => !existingNames.has(d.name));

      const updated: ContractReviewRecord = {
        ...activeRecord,
        documents: [...activeRecord.documents, ...docsToAdd],
        executiveSummary,
        findings: finalFindings,
        commercialHandoverNotes,
      };

      setActiveRecord(updated);
      setStagedFiles([]);
      setProcessState('complete');
      setProgress({ current: chunkTotal, total: chunkTotal, label: 'Review complete' });
      // Auto-persist the results
      handleSaveReview(updated);

    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      setError({ message: e.message ?? 'Unknown error', code: e.code ?? 'generic_error' });
      setProcessState('error');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <ReviewListPanel
        reviews={reviews}
        onOpen={openReview}
        onNew={startNewReview}
        onDelete={handleDeleteReview}
      />
    );
  }

  if (!activeRecord) return null;

  return (
    <ReviewDetailPanel
      record={activeRecord}
      tenderName={tender.name}
      currentUser={currentUser}
      processState={processState}
      progress={progress}
      error={error}
      onRunReview={runReview}
      onCancelRun={() => { abortRef.current = true; setProcessState('idle'); }}
      onUpdateRecord={r => { setActiveRecord(r); handleSaveReview(r); }}
      onBack={backToList}
      onRemoveFile={removeStaged}
      stagedFiles={stagedFiles}
      dragOver={dragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      fileInputRef={fileInputRef}
      onFileInput={handleFileInput}
      savedFeedback={savedFeedback}
    />
  );
}
