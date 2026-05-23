import { useState, useEffect, useMemo } from 'react';
import { X, Camera, FileText, ChevronDown, Search, Calendar, ClipboardList, AlertTriangle, ShieldCheck, MessageSquare, Clock, CreditCard as Edit2, Trash2, Eye, Download, Paperclip, File, Image, LayoutGrid, List, Printer } from 'lucide-react';
import { openPrintTab, buildPrintDocument } from '../lib/printTab';
import RFIRegister, { type RFIRecord, type RFIStatus } from './RFIRegister';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import MentionTextarea, { renderWithMentions } from '../components/MentionTextarea';
import { type SiteForm, type FormType, type FormStatus } from '../data/types';
import { useAppStore } from '../lib/StoreContext';
import type { DBSiteForm, DBAttachment } from '../lib/store';
import FileUploadComponent, { type UploadedFile } from '../components/FileUpload';

// ─── Extended Types ──────────────────────────────────────────────────────────
type ExtendedFormType = FormType | 'RFI' | 'Hold Up Notice' | 'H&S Inspection' | 'Delay Notice' | 'Variation' | 'Early Warning Notice' | 'Site Instruction' | 'Technical Query';
type ExtendedFormStatus = FormStatus | 'Issued' | 'Awaiting Response' | 'Closed' | 'Resolved' | 'Escalated' | 'Action Required';

interface ExtendedSiteForm extends Omit<SiteForm, 'type' | 'status'> {
  type: ExtendedFormType;
  status: ExtendedFormStatus;
  // RFI extras
  rfiRef?: string;
  subject?: string;
  question?: string;
  response?: string;
  requiredResponseDate?: string;
  // Hold Up / Delay Notice extras
  areaLocation?: string;
  cause?: string;
  impact?: string;
  programmeImpact?: string;
  commercialImpact?: string;
  noticeRef?: string;
  dateTime?: string;
  // Variation extras
  variationRef?: string;
  instructionSource?: string;
  costImpact?: string;
  variationStatus?: string;
  // H&S extras
  areaInspected?: string;
  inspectionDate?: string;
  inspectionType?: string;
  findings?: string;
  actionsRequired?: string;
  riskLevel?: string;
  inspectorName?: string;
  notes?: string;
  // TQ extras
  tqRef?: string;
  drawingRef?: string;
  assignedTo?: string;
  priority?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  Draft: 'bg-[#1e2d4a] text-slate-400',
  Submitted: 'bg-blue-900/60 text-blue-400',
  Approved: 'bg-emerald-900/60 text-emerald-400',
  Issued: 'bg-purple-900/60 text-purple-400',
  'Awaiting Response': 'bg-yellow-900/60 text-yellow-400',
  Closed: 'bg-slate-700 text-slate-400',
  Resolved: 'bg-emerald-900/60 text-emerald-400',
  Escalated: 'bg-red-900/60 text-red-400',
  Open: 'bg-rose-900/60 text-rose-400',
  'Action Required': 'bg-amber-900/60 text-amber-400',
};

const TYPE_MAP: Record<string, { bg: string; text: string; label: string; border: string }> = {
  'Daily Site Report': { bg: 'bg-orange-900/60', text: 'text-orange-400', label: 'Daily Report',    border: 'border-l-orange-700' },
  'QA Inspection':     { bg: 'bg-teal-900/60',   text: 'text-teal-400',   label: 'QA Inspection',  border: 'border-l-teal-700' },
  'RFI':               { bg: 'bg-cyan-900/60',   text: 'text-cyan-400',   label: 'RFI',            border: 'border-l-cyan-700' },
  'Hold Up Notice':    { bg: 'bg-rose-900/60',   text: 'text-rose-400',   label: 'Hold Up',        border: 'border-l-rose-700' },
  'H&S Inspection':    { bg: 'bg-amber-900/60',  text: 'text-amber-400',  label: 'H&S',            border: 'border-l-amber-700' },
  'Delay Notice':      { bg: 'bg-red-900/60',    text: 'text-red-400',    label: 'Delay Notice',   border: 'border-l-red-700' },
  'Variation':         { bg: 'bg-blue-900/60',   text: 'text-blue-400',   label: 'Variation',      border: 'border-l-blue-700' },
  'Early Warning Notice': { bg: 'bg-yellow-900/60', text: 'text-yellow-400', label: 'Early Warning', border: 'border-l-yellow-700' },
  'Site Instruction':  { bg: 'bg-slate-700',     text: 'text-slate-300',  label: 'Site Instruction', border: 'border-l-slate-600' },
  'Technical Query':   { bg: 'bg-sky-900/60',    text: 'text-sky-400',    label: 'TQ',             border: 'border-l-sky-700' },
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_MAP[status] ?? 'bg-slate-700 text-slate-400';
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>{status}</span>;
}

function TypeBadge({ type }: { type: ExtendedFormType }) {
  const t = TYPE_MAP[type] ?? { bg: 'bg-slate-700', text: 'text-slate-400', label: type };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${t.bg} ${t.text}`}>
      {t.label}
    </span>
  );
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

let rfiCounter = 1;
function nextRfiRef() {
  return `RFI-${String(rfiCounter++).padStart(3, '0')}`;
}

// ─── CSS helpers ─────────────────────────────────────────────────────────────
const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

// ─── Photo Placeholder ───────────────────────────────────────────────────────
function PhotoUploadArea() {
  return (
    <div className="mt-1.5 border-2 border-dashed border-[#1e2d4a] rounded-xl p-6 text-center hover:border-orange-800 hover:bg-orange-950/20 transition-colors cursor-pointer">
      <Camera size={24} className="text-slate-600 mx-auto mb-2" />
      <p className="text-sm text-slate-500">Click to upload photos or drag &amp; drop</p>
      <p className="text-xs text-slate-600 mt-1">PNG, JPG up to 10MB each</p>
    </div>
  );
}

// ─── Form Builder ─────────────────────────────────────────────────────────────
interface FormBuilderProps {
  type: ExtendedFormType;
  onClose: () => void;
  onSave: (form: ExtendedSiteForm) => void;
}

function FormBuilder({ type, onClose, onSave }: FormBuilderProps) {
  const store = useAppStore();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [form, setForm] = useState<Record<string, string>>({
    project: '',
    date: new Date().toISOString().split('T')[0],
    completedBy: '',
    description: '',
    comments: '',
    status: 'Draft',
    rfiRef: nextRfiRef(),
    subject: '',
    question: '',
    response: '',
    requiredResponseDate: '',
    raisedBy: '',
    assignedTo: '',
    tqRef: `TQ-${String(Math.floor(Math.random() * 900) + 100)}`,
    drawingRef: '',
    priority: 'Medium',
    areaLocation: '',
    cause: '',
    impact: '',
    dateTime: '',
    areaInspected: '',
    inspectionDate: new Date().toISOString().split('T')[0],
    inspectionType: 'Routine',
    findings: '',
    actionsRequired: '',
    riskLevel: 'Low',
    inspectorName: '',
    notes: '',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleAction = (status: string) => {
    const base: ExtendedSiteForm = {
      id: `f${Date.now()}`,
      type,
      projectId: store.projects.find(p => p.name === form.project)?.id || '',
      projectName: form.project,
      date: form.date,
      completedBy: form.completedBy,
      description: form.description,
      comments: form.comments,
      status: status as ExtendedFormStatus,
      submittedDate: status === 'Submitted' || status === 'Issued' ? new Date().toISOString().split('T')[0] : undefined,
      notes: form.notes,
    };

    if (type === 'RFI') {
      Object.assign(base, {
        rfiRef: form.rfiRef,
        subject: form.subject,
        question: form.question,
        response: form.response,
        requiredResponseDate: form.requiredResponseDate,
      });
    }
    if (type === 'Hold Up Notice') {
      Object.assign(base, {
        areaLocation: form.areaLocation,
        cause: form.cause,
        impact: form.impact,
        dateTime: form.dateTime,
      });
    }
    if (type === 'H&S Inspection') {
      Object.assign(base, {
        areaInspected: form.areaInspected,
        inspectionDate: form.inspectionDate,
        inspectionType: form.inspectionType,
        findings: form.findings,
        actionsRequired: form.actionsRequired,
        riskLevel: form.riskLevel,
        inspectorName: form.inspectorName,
      });
    }
    if (type === 'Delay Notice') {
      Object.assign(base, {
        noticeRef: form.noticeRef,
        areaLocation: form.areaLocation,
        cause: form.cause,
        impact: form.impact,
        programmeImpact: form.programmeImpact,
        commercialImpact: form.commercialImpact,
      });
    }
    if (type === 'Variation') {
      Object.assign(base, {
        variationRef: form.variationRef,
        instructionSource: form.instructionSource,
        costImpact: form.costImpact,
        programmeImpact: form.programmeImpact,
        variationStatus: form.variationStatus,
      });
    }
    if (type === 'Technical Query') {
      Object.assign(base, {
        tqRef: form.tqRef,
        subject: form.subject,
        question: form.question,
        drawingRef: form.drawingRef,
        assignedTo: form.assignedTo,
        priority: form.priority,
        requiredResponseDate: form.requiredResponseDate,
        response: form.response,
        areaLocation: form.areaLocation,
      });
    }

    onSave(base);
    onClose();
  };

  const isDaily = type === 'Daily Site Report';
  const isQA = type === 'QA Inspection';
  const isRFI = type === 'RFI';
  const isHoldUp = type === 'Hold Up Notice';
  const isHS = type === 'H&S Inspection';
  const isDelay = type === 'Delay Notice';
  const isVariation = type === 'Variation';
  const isEWN = type === 'Early Warning Notice';
  const isSI = type === 'Site Instruction';
  const isTQ = type === 'Technical Query';

  const accentColor = isRFI
    ? 'bg-cyan-600 hover:bg-cyan-700'
    : isHoldUp
    ? 'bg-rose-600 hover:bg-rose-700'
    : isHS
    ? 'bg-amber-500 hover:bg-amber-600'
    : isDelay
    ? 'bg-red-600 hover:bg-red-700'
    : isVariation
    ? 'bg-blue-600 hover:bg-blue-700'
    : isEWN
    ? 'bg-yellow-500 hover:bg-yellow-600'
    : isTQ
    ? 'bg-sky-600 hover:bg-sky-700'
    : 'bg-[#f97316] hover:bg-orange-600';

  const rfiStatuses = ['Draft', 'Issued', 'Awaiting Response', 'Closed'];
  const holdUpStatuses = ['Open', 'Resolved', 'Escalated'];
  const hsStatuses = ['Draft', 'Submitted', 'Approved', 'Action Required'];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <div>
            <h2 className="text-lg font-bold text-white">{type}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Complete all required fields before submitting</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* ── RFI Fields ── */}
          {isRFI && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>RFI Reference</label>
                  <input value={form.rfiRef} readOnly className={`${inputCls} opacity-60 cursor-not-allowed`} />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <div className="relative">
                    <select value={form.status} onChange={set('status')} className={`${inputCls} appearance-none pr-8`}>
                      {rfiStatuses.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Project *</label>
                <div className="relative">
                  <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                    <option value="">Select project...</option>
                    {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Subject *</label>
                <input value={form.subject} onChange={set('subject')} className={inputCls} placeholder="Brief subject of the RFI..." />
              </div>
              <div>
                <label className={labelCls}>Question *</label>
                <textarea value={form.question} onChange={set('question')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="Detail the question or clarification required..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Raised By *</label>
                  <input value={form.raisedBy} onChange={set('raisedBy')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Date Raised *</label>
                  <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Required Response Date</label>
                <input type="date" value={form.requiredResponseDate} onChange={set('requiredResponseDate')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Response</label>
                <textarea value={form.response} onChange={set('response')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="Response to the RFI (complete once answered)..." />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} placeholder="Any additional notes..." />
              </div>
              <div>
                <label className={labelCls}>Attachments</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx,.dwg" label="Upload drawings, specs or supporting documents" />
              </div>
            </>
          )}

          {/* ── Hold Up / Delay Notice Fields ── */}
          {isHoldUp && (
            <>
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-3">
                <p className="text-[11px] font-semibold text-amber-400 mb-0.5 uppercase tracking-wider">Contractual Notice</p>
                <p className="text-xs text-amber-300/80 leading-relaxed">This notice is issued to formally notify and record operational impacts and potential contractual implications associated with the referenced matter, in accordance with project communication and contract procedures.</p>
              </div>
              <div>
                <label className={labelCls}>Project *</label>
                <div className="relative">
                  <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                    <option value="">Select project...</option>
                    {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Area / Location *</label>
                <input value={form.areaLocation} onChange={set('areaLocation')} className={inputCls} placeholder="e.g. Level 2 – Corridor B" />
              </div>
              <div>
                <label className={labelCls}>Description of Hold Up *</label>
                <textarea value={form.description} onChange={set('description')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="Describe the hold up or delay in detail..." />
              </div>
              <div>
                <label className={labelCls}>Cause *</label>
                <input value={form.cause} onChange={set('cause')} className={inputCls} placeholder="Root cause of the delay..." />
              </div>
              <div>
                <label className={labelCls}>Impact *</label>
                <textarea value={form.impact} onChange={set('impact')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="Describe the impact on schedule, resources, safety..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Date / Time *</label>
                  <input type="datetime-local" value={form.dateTime} onChange={set('dateTime')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Raised By *</label>
                  <input value={form.raisedBy} onChange={set('raisedBy')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Photos</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload photos or documents" />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <div className="relative">
                  <select value={form.status} onChange={set('status')} className={`${inputCls} appearance-none pr-8`}>
                    {holdUpStatuses.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} placeholder="Any additional notes..." />
              </div>
            </>
          )}

          {/* ── H&S Inspection Fields ── */}
          {isHS && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Project *</label>
                  <div className="relative">
                    <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                      <option value="">Select project...</option>
                      {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Area Inspected *</label>
                  <input value={form.areaInspected} onChange={set('areaInspected')} className={inputCls} placeholder="e.g. Roof Level, Plant Room..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Inspection Date *</label>
                  <input type="date" value={form.inspectionDate} onChange={set('inspectionDate')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Inspection Type *</label>
                  <div className="relative">
                    <select value={form.inspectionType} onChange={set('inspectionType')} className={`${inputCls} appearance-none pr-8`}>
                      {['Routine', 'Post-Incident', 'Pre-Start', 'Reactive'].map(t => <option key={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Findings *</label>
                <textarea value={form.findings} onChange={set('findings')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="Detail all findings from the inspection..." />
              </div>
              <div>
                <label className={labelCls}>Actions Required</label>
                <textarea value={form.actionsRequired} onChange={set('actionsRequired')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="List any corrective or preventive actions required..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Risk Level</label>
                  <div className="relative">
                    <select value={form.riskLevel} onChange={set('riskLevel')} className={`${inputCls} appearance-none pr-8`}>
                      {['Low', 'Medium', 'High', 'Critical'].map(r => <option key={r}>{r}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Inspector Name *</label>
                  <input value={form.inspectorName} onChange={set('inspectorName')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Photos</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload photos or documents" />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <div className="relative">
                  <select value={form.status} onChange={set('status')} className={`${inputCls} appearance-none pr-8`}>
                    {hsStatuses.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </>
          )}

          {/* ── Daily Site Report & QA Inspection Fields (existing) ── */}
          {(isDaily || isQA) && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Project *</label>
                  <div className="relative">
                    <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                      <option value="">Select project...</option>
                      {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Date *</label>
                  <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Completed By *</label>
                <input value={form.completedBy} onChange={set('completedBy')} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>{isDaily ? 'Works Carried Out Today *' : 'Inspection Description *'}</label>
                <textarea value={form.description} onChange={set('description')} rows={5} className={`${inputCls} resize-none`}
                  placeholder={isDaily ? 'Describe all works carried out on site today...' : 'Describe the inspection area, items checked, standards applied...'} />
              </div>

              {isDaily && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {['Operatives on Site', 'Weather Conditions', 'Visitors to Site'].map(field => (
                    <div key={field}>
                      <label className={labelCls}>{field}</label>
                      <input className={inputCls} placeholder={field === 'Weather Conditions' ? 'Fine' : field === 'Operatives on Site' ? '0' : 'None'} />
                    </div>
                  ))}
                </div>
              )}

              {isQA && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Inspection Area</label>
                    <input className={inputCls} placeholder="e.g. Ward 2A Cabling" />
                  </div>
                  <div>
                    <label className={labelCls}>Inspection Result</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-8`}>
                        <option>Pass</option>
                        <option>Pass with observations</option>
                        <option>Fail - remedial required</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Photos</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload photos or documents" />
              </div>

              <div>
                <label className={labelCls}>Comments</label>
                <textarea value={form.comments} onChange={set('comments')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="Any additional comments or notes..." />
              </div>
            </>
          )}

          {/* ── Delay Notice Fields ── */}
          {isDelay && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Notice Reference</label>
                  <input value={form.noticeRef} onChange={set('noticeRef')} className={inputCls} placeholder="e.g. DN-001" />
                </div>
                <div>
                  <label className={labelCls}>Project *</label>
                  <div className="relative">
                    <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                      <option value="">Select project...</option>
                      {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Date *</label>
                  <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Raised By *</label>
                  <input value={form.raisedBy} onChange={set('raisedBy')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description of Delay *</label>
                <textarea value={form.description} onChange={set('description')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="Provide a full description of the delay event..." />
              </div>
              <div>
                <label className={labelCls}>Cause *</label>
                <textarea value={form.cause} onChange={set('cause')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="Identify the root cause of the delay..." />
              </div>
              <div>
                <label className={labelCls}>Impact on Works *</label>
                <textarea value={form.impact} onChange={set('impact')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="Describe the impact on the works..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Programme Impact</label>
                  <input value={form.programmeImpact} onChange={set('programmeImpact')} className={inputCls} placeholder="e.g. 5 days extension of time" />
                </div>
                <div>
                  <label className={labelCls}>Commercial Impact</label>
                  <input value={form.commercialImpact} onChange={set('commercialImpact')} className={inputCls} placeholder="e.g. Additional prelims £2,500" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Supporting Evidence / Photos</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload photos or documents" />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <div className="relative">
                  <select value={form.status} onChange={set('status')} className={`${inputCls} appearance-none pr-8`}>
                    {['Open', 'Submitted', 'Under Review', 'Resolved', 'Escalated'].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} placeholder="Any additional notes..." />
              </div>
            </>
          )}

          {/* ── Variation / Change Order Fields ── */}
          {isVariation && (
            <>
              <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg px-4 py-3">
                <p className="text-[11px] font-semibold text-blue-400 mb-0.5 uppercase tracking-wider">Variation Notice</p>
                <p className="text-xs text-blue-300/80 leading-relaxed">This variation record is issued to document proposed changes, associated impacts and ongoing commercial review, subject to instruction, agreement and applicable contract procedures where required.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Variation Reference</label>
                  <input value={form.variationRef} onChange={set('variationRef')} className={inputCls} placeholder="e.g. VO-001" />
                </div>
                <div>
                  <label className={labelCls}>Project *</label>
                  <div className="relative">
                    <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                      <option value="">Select project...</option>
                      {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Description of Variation *</label>
                <textarea value={form.description} onChange={set('description')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="Describe the variation or change order in detail..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Instruction Source</label>
                  <input value={form.instructionSource} onChange={set('instructionSource')} className={inputCls} placeholder="e.g. Architect's Instruction, Client email" />
                </div>
                <div>
                  <label className={labelCls}>Raised By *</label>
                  <input value={form.raisedBy} onChange={set('raisedBy')} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Cost Impact</label>
                  <input value={form.costImpact} onChange={set('costImpact')} className={inputCls} placeholder="e.g. +£5,000" />
                </div>
                <div>
                  <label className={labelCls}>Programme Impact</label>
                  <input value={form.programmeImpact} onChange={set('programmeImpact')} className={inputCls} placeholder="e.g. +3 days" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <div className="relative">
                  <select value={form.variationStatus} onChange={set('variationStatus')} className={`${inputCls} appearance-none pr-8`}>
                    {['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Closed'].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Supporting Files / Photos</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload photos or documents" />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} placeholder="Any additional notes..." />
              </div>
            </>
          )}

          {/* ── Early Warning Notice ── */}
          {isEWN && (
            <>
              <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-4 mb-2">
                <p className="text-xs font-semibold text-yellow-400">Early Warning Notice</p>
                <p className="text-xs text-slate-400 mt-1">Use to formally notify the client of potential matters that could affect the price, programme, or quality.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Project *</label>
                  <div className="relative">
                    <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                      <option value="">Select project...</option>
                      {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Date *</label>
                  <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Warning Description *</label>
                <textarea value={form.description} onChange={set('description')} rows={5} className={`${inputCls} resize-none`}
                  placeholder="Describe the matter that may affect cost, programme or quality..." />
              </div>
              <div>
                <label className={labelCls}>Impact</label>
                <textarea value={form.impact} onChange={set('impact')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="Potential impact if the matter is not addressed..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Raised By *</label>
                  <input value={form.raisedBy} onChange={set('raisedBy')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <div className="relative">
                    <select value={form.status} onChange={set('status')} className={`${inputCls} appearance-none pr-8`}>
                      {['Open', 'Acknowledged', 'Resolved', 'Closed'].map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className={labelCls}>Attachments</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx,.dwg" label="Upload supporting documents or evidence" />
              </div>
            </>
          )}

          {/* ── Site Instruction ── */}
          {isSI && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Project *</label>
                  <div className="relative">
                    <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                      <option value="">Select project...</option>
                      {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Date *</label>
                  <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Issued By *</label>
                  <input value={form.raisedBy} onChange={set('raisedBy')} className={inputCls} placeholder="Name of person issuing" />
                </div>
                <div>
                  <label className={labelCls}>Instruction Issued To *</label>
                  <input value={form.instructionSource || ''} onChange={set('instructionSource')} className={inputCls} placeholder="Name, company or trade" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Instruction *</label>
                <textarea value={form.description} onChange={set('description')} rows={5} className={`${inputCls} resize-none`}
                  placeholder="Detail the site instruction clearly and precisely..." />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <div className="relative">
                  <select value={form.status} onChange={set('status')} className={`${inputCls} appearance-none pr-8`}>
                    {['Open', 'Actioned', 'Closed'].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Photos / Evidence</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload photos or documents" />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 mt-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contractual Notice</p>
                <p className="text-xs text-slate-400 leading-relaxed italic">
                  This instruction does not constitute approval of additional payment unless separately agreed in writing.
                </p>
              </div>
            </>
          )}

          {/* ── Technical Query ── */}
          {isTQ && (
            <>
              <div className="bg-sky-900/20 border border-sky-800/40 rounded-xl p-4">
                <p className="text-xs font-semibold text-sky-400">Technical Query (TQ)</p>
                <p className="text-xs text-slate-400 mt-1">Internal operational query raised to resolve technical or design questions before work proceeds.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>TQ Reference</label>
                  <input value={form.tqRef} readOnly className={`${inputCls} opacity-60 cursor-not-allowed`} />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <div className="relative">
                    <select value={form.status} onChange={set('status')} className={`${inputCls} appearance-none pr-8`}>
                      {['Draft', 'Open', 'Under Review', 'Responded', 'Closed'].map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Project *</label>
                  <div className="relative">
                    <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                      <option value="">Select project...</option>
                      {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Area / Location</label>
                  <input value={form.areaLocation} onChange={set('areaLocation')} className={inputCls} placeholder="e.g. Level 3 – Plant Room" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Subject *</label>
                <input value={form.subject} onChange={set('subject')} className={inputCls} placeholder="Brief subject of the query..." />
              </div>
              <div>
                <label className={labelCls}>Technical Query *</label>
                <textarea value={form.question} onChange={set('question')} rows={5} className={`${inputCls} resize-none`}
                  placeholder="Describe the technical issue or question in detail..." />
              </div>
              <div>
                <label className={labelCls}>Drawing / Specification Reference</label>
                <input value={form.drawingRef} onChange={set('drawingRef')} className={inputCls} placeholder="e.g. M101 Rev C, Spec Section 15.2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Raised By *</label>
                  <input value={form.raisedBy} onChange={set('raisedBy')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Assigned To</label>
                  <input value={form.assignedTo} onChange={set('assignedTo')} className={inputCls} placeholder="Engineer or designer..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Priority</label>
                  <div className="relative">
                    <select value={form.priority} onChange={set('priority')} className={`${inputCls} appearance-none pr-8`}>
                      {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Required Response Date</label>
                  <input type="date" value={form.requiredResponseDate} onChange={set('requiredResponseDate')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Response</label>
                <textarea value={form.response} onChange={set('response')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="Technical response (complete once answered)..." />
              </div>
              <div>
                <label className={labelCls}>Attachments</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx,.dwg" label="Upload drawings, specs or photos" />
              </div>
              <div>
                <label className={labelCls}>Comments</label>
                <textarea value={form.comments} onChange={set('comments')} rows={2} className={`${inputCls} resize-none`} placeholder="Any additional notes..." />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-[#1e2d4a]">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => handleAction('Draft')}
            className="px-4 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-300 hover:bg-[#1e2d4a] transition-colors">
            Save Draft
          </button>
          <button type="button" onClick={() => handleAction(
            isRFI ? 'Issued' : isHoldUp ? 'Open' : isDelay ? 'Open' : isVariation ? 'Draft' : isEWN ? 'Open' : isSI ? 'Open' : isTQ ? 'Open' : 'Submitted'
          )}
            className={`flex-1 py-2.5 text-white rounded-lg text-sm font-semibold transition-colors ${accentColor}`}>
            {isRFI ? 'Issue RFI' : isHoldUp ? 'Raise Notice' : isDelay ? 'Issue Delay Notice' : isVariation ? 'Submit Variation' : isEWN ? 'Issue Warning' : isSI ? 'Issue Instruction' : isTQ ? 'Raise TQ' : 'Submit Form'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form View Modal ──────────────────────────────────────────────────────────
interface FormComment {
  id: string;
  user: string;
  datetime: string;
  text: string;
}

interface FormViewModalProps {
  form: ExtendedSiteForm;
  formComments: FormComment[];
  onClose: () => void;
  onUpdateComments: (comments: FormComment[]) => void;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1048576).toFixed(1)}MB`;
}

function AttachmentList({ attachments, onRemove }: { attachments: DBAttachment[]; onRemove: (id: string) => void }) {
  const store = useAppStore();
  const [preview, setPreview] = useState<DBAttachment | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  if (attachments.length === 0) return null;

  const openPreview = async (att: DBAttachment) => {
    if (att.data_url) { setPreview(att); return; }
    setLoadingId(att.id);
    const dataUrl = await store.fetchAttachmentData(att.id);
    setLoadingId(null);
    setPreview({ ...att, data_url: dataUrl });
  };

  return (
    <>
      <div className="space-y-2">
        {attachments.map(att => {
          const isImage = att.type.startsWith('image/');
          const isPDF = att.type === 'application/pdf';
          const isLoading = loadingId === att.id;
          return (
            <div key={att.id} className="flex items-center gap-3 bg-[#0d1628] rounded-lg p-2.5 border border-[#1e2d4a] group">
              <div
                className="w-8 h-8 rounded bg-[#111827] border border-[#1e2d4a] flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
                onClick={() => openPreview(att)}
              >
                {isLoading ? (
                  <div className="w-3 h-3 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" />
                ) : isImage && att.data_url ? (
                  <img src={att.data_url} alt={att.name} className="w-full h-full object-cover" />
                ) : isPDF ? (
                  <FileText size={14} className="text-red-400" />
                ) : (
                  <File size={14} className="text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openPreview(att)}>
                <p className="text-xs font-medium text-slate-300 line-clamp-1">{att.name}</p>
                <p className="text-[10px] text-slate-600">{formatBytes(att.size)} · {att.category}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openPreview(att)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100" title="Preview">
                  <Eye size={13} />
                </button>
                <button onClick={() => onRemove(att.id)} className="p-1 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Remove">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {preview && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col" onClick={() => setPreview(null)}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-white truncate max-w-xs">{preview.name}</p>
            <div className="flex items-center gap-2">
              {preview.data_url && (
                <a href={preview.data_url} download={preview.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
                  <Download size={13} />Download
                </a>
              )}
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><X size={18} /></button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            {preview.type.startsWith('image/') && preview.data_url ? (
              <img src={preview.data_url} alt={preview.name} className="max-w-full max-h-full object-contain rounded-lg" />
            ) : preview.type === 'application/pdf' && preview.data_url ? (
              <iframe src={preview.data_url} title={preview.name} className="w-full h-full rounded-lg border-0" />
            ) : preview.data_url ? (
              <a href={preview.data_url} download={preview.name}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
                <Download size={14} />Download File
              </a>
            ) : (
              <div className="text-center">
                <Paperclip size={40} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">{preview.name}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FormViewModal({ form, formComments, onClose, onUpdateComments, onEdit, onDelete, isAdmin }: FormViewModalProps) {
  const store = useAppStore();
  const [tab, setTab] = useState<'details' | 'comments' | 'files'>('details');
  const [newComment, setNewComment] = useState('');
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const handlePrint = () => {
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const title = form.subject || form.description || form.question || form.type;
    const typeLabel = TYPE_MAP[form.type]?.label ?? form.type;
    const rows = [
      ['Form Type', typeLabel],
      ['Project', form.projectName || '—'],
      ['Date', formatDate(form.date)],
      ['Completed By', (form.inspectorName as string) || form.completedBy || '—'],
      ['Status', form.status],
      form.rfiRef ? ['RFI Ref', form.rfiRef as string] : null,
      form.tqRef ? ['TQ Ref', form.tqRef as string] : null,
      form.subject ? ['Subject', form.subject as string] : null,
      form.areaLocation ? ['Area / Location', form.areaLocation as string] : null,
      form.cause ? ['Cause', form.cause as string] : null,
      form.impact ? ['Impact', form.impact as string] : null,
      form.riskLevel ? ['Risk Level', form.riskLevel as string] : null,
      form.inspectionType ? ['Inspection Type', form.inspectionType as string] : null,
      form.requiredResponseDate ? ['Response Required', formatDate(form.requiredResponseDate as string)] : null,
      form.assignedTo ? ['Assigned To', form.assignedTo as string] : null,
      form.variationRef ? ['Variation Ref', form.variationRef as string] : null,
      form.costImpact ? ['Cost Impact', form.costImpact as string] : null,
      form.submittedDate ? ['Submitted', formatDate(form.submittedDate)] : null,
    ].filter(Boolean) as [string, string][];

    const metaHtml = rows.map(([l, v]) => `
      <div style="padding:8px 12px;border-bottom:1px solid #e2e8f0">
        <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">${l}</div>
        <div style="font-size:12px;color:#1e293b;font-weight:500">${v}</div>
      </div>`).join('');

    const bodySection = (label: string, content: string) => content ? `
      <div style="margin-top:16px">
        <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${label}</div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-size:12px;color:#334155;line-height:1.6;white-space:pre-wrap">${content}</div>
      </div>` : '';

    const styles = `
      .sf-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:16px;margin-bottom:20px}
      .sf-logo{font-size:22px;font-weight:900;color:#f97316;letter-spacing:.05em}
      .sf-logo-sub{font-size:10px;color:#94a3b8;margin-top:3px;text-transform:uppercase;letter-spacing:.08em}
      .sf-title{font-size:16px;font-weight:800;color:#0f172a;margin-bottom:6px}
      .sf-meta{border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:4px}
      .sf-footer{margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
    `;
    const body = `
      <div class="sf-header">
        <div><div class="sf-logo">VYSITE</div><div class="sf-logo-sub">Site Forms — ${typeLabel}</div></div>
        <div style="text-align:right;font-size:11px;color:#64748b">
          <div style="font-weight:700;color:#f97316">${form.rfiRef || form.tqRef || form.type}</div>
          <div>${today}</div>
          <div style="margin-top:2px;font-weight:600;color:#1e293b">${form.status}</div>
        </div>
      </div>
      <div class="sf-title">${title}</div>
      <div class="sf-meta">${metaHtml}</div>
      ${bodySection(form.type === 'RFI' ? 'Question' : form.type === 'Technical Query' ? 'Technical Query' : form.type === 'H&S Inspection' ? 'Findings' : 'Works / Description', (form.question as string) || (form.findings as string) || form.description || '')}
      ${bodySection('Response', (form.response as string) || '')}
      ${bodySection('Impact', (form.impact as string) || '')}
      ${bodySection('Actions Required', (form.actionsRequired as string) || '')}
      ${bodySection('Notes', form.comments || form.notes || '')}
      <div class="sf-footer">VY Construction Ltd · Generated by VYSITE · ${today}</div>
    `;
    openPrintTab(buildPrintDocument(`${typeLabel} — VYSITE`, styles, body));
  };

  const formAttachments = useMemo(
    () => store.attachments.filter(a => a.linked_type === 'form' && a.linked_id === form.id),
    [store.attachments, form.id]
  );

  const totalFiles = formAttachments.length + pendingFiles.length;

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    for (const f of pendingFiles) {
      const att: DBAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        linked_type: 'form',
        linked_id: form.id,
        project_id: form.projectId,
        project_name: form.projectName ?? '',
        name: f.name,
        type: f.type,
        size: f.size,
        category: f.type.startsWith('image/') ? 'Photo' : f.type === 'application/pdf' ? 'Document' : 'Other',
        data_url: f.dataUrl ?? '',
        uploaded_by: store.currentUser?.name ?? '',
        created_at: new Date().toISOString(),
      };
      await store.addAttachment(att);
    }
    setPendingFiles([]);
    setUploading(false);
  };

  const Field = ({ label, value }: { label: string; value?: string }) =>
    value ? (
      <div>
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm text-slate-300">{value}</p>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#1e2d4a] shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <TypeBadge type={form.type} />
              <StatusBadge status={form.status} />
              {(form.rfiRef || form.tqRef) && (
                <span className="text-[10px] font-mono text-slate-400 bg-[#0d1628] px-2 py-0.5 rounded border border-[#1e2d4a]">
                  {form.tqRef || form.rfiRef}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white leading-snug">{form.subject || form.description || form.question || form.type}</p>
            <p className="text-xs text-slate-500 mt-0.5">{form.projectName} · {formatDate(form.date)}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} title="Edit form"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-xs font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors">
              <Edit2 size={13} />Edit
            </button>
            <button onClick={handlePrint} title="Export PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-xs font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors">
              <Printer size={13} />PDF
            </button>
            {isAdmin && (
              <button onClick={onDelete} title="Delete form"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2236] border border-red-900/50 text-slate-400 rounded-lg text-xs font-semibold hover:border-red-500 hover:text-red-400 transition-colors">
                <Trash2 size={13} />Delete
              </button>
            )}
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2d4a] shrink-0">
          {(['details', 'comments', 'files'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-xs font-semibold transition-colors capitalize border-b-2 -mb-px ${
                tab === t ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}>
              {t}
              {t === 'comments' && formComments.length > 0 && (
                <span className="ml-1.5 bg-[#f97316]/20 text-[#f97316] text-[9px] px-1.5 py-0.5 rounded-full">{formComments.length}</span>
              )}
              {t === 'files' && totalFiles > 0 && (
                <span className="ml-1.5 bg-slate-700 text-slate-300 text-[9px] px-1.5 py-0.5 rounded-full">{totalFiles}</span>
              )}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Details Tab */}
          {tab === 'details' && (
            <>
              {/* Meta grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#0d1628] rounded-xl border border-[#1e2d4a]">
                <Field label="Project" value={form.projectName || '—'} />
                <Field label="Date" value={formatDate(form.date)} />
                <Field label={form.type === 'H&S Inspection' ? 'Inspector' : 'Completed By'} value={form.inspectorName as string || form.completedBy} />
                <Field label="Submitted" value={form.submittedDate ? formatDate(form.submittedDate) : '—'} />
              </div>

              {/* TQ-specific meta */}
              {form.type === 'Technical Query' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-[#0d1628] rounded-xl border border-[#1e2d4a]">
                  <Field label="Subject" value={form.subject as string} />
                  <Field label="Area / Location" value={form.areaLocation as string} />
                  <Field label="Drawing / Spec Ref" value={form.drawingRef as string} />
                  <Field label="Required Response" value={form.requiredResponseDate ? formatDate(form.requiredResponseDate as string) : '—'} />
                  <Field label="Assigned To" value={form.assignedTo as string} />
                  <Field label="Priority" value={form.priority as string} />
                </div>
              )}

              {/* RFI-specific meta */}
              {form.type === 'RFI' && (
                <div className="grid grid-cols-2 gap-3 p-4 bg-[#0d1628] rounded-xl border border-[#1e2d4a]">
                  <Field label="Subject" value={form.subject as string} />
                  <Field label="Required Response Date" value={form.requiredResponseDate ? formatDate(form.requiredResponseDate as string) : '—'} />
                </div>
              )}

              {/* Contractual notice banners */}
              {(form.type === 'Hold Up Notice' || form.type === 'Delay Notice') && (
                <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-3">
                  <p className="text-[11px] font-semibold text-amber-400 mb-0.5 uppercase tracking-wider">Contractual Notice</p>
                  <p className="text-xs text-amber-300/80 leading-relaxed">This notice is issued to formally notify and record operational impacts and potential contractual implications in accordance with project communication and contract procedures.</p>
                </div>
              )}
              {form.type === 'Variation' && (
                <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg px-4 py-3">
                  <p className="text-[11px] font-semibold text-blue-400 mb-0.5 uppercase tracking-wider">Variation Notice</p>
                  <p className="text-xs text-blue-300/80 leading-relaxed">Variation records remain subject to review, agreement and formal instruction where applicable.</p>
                </div>
              )}

              {/* Hold Up-specific meta */}
              {form.type === 'Hold Up Notice' && (
                <div className="grid grid-cols-2 gap-3 p-4 bg-[#0d1628] rounded-xl border border-[#1e2d4a]">
                  <Field label="Area / Location" value={form.areaLocation as string} />
                  <Field label="Date / Time" value={form.dateTime as string} />
                  <Field label="Cause" value={form.cause as string} />
                </div>
              )}

              {/* H&S-specific meta */}
              {form.type === 'H&S Inspection' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#0d1628] rounded-xl border border-[#1e2d4a]">
                  <Field label="Area Inspected" value={form.areaInspected as string} />
                  <Field label="Inspection Type" value={form.inspectionType as string} />
                  <Field label="Risk Level" value={form.riskLevel as string} />
                  <Field label="Inspection Date" value={form.inspectionDate ? formatDate(form.inspectionDate as string) : undefined} />
                </div>
              )}

              {/* Description / question / findings */}
              {(form.description || form.question || form.findings) && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {form.type === 'RFI' ? 'Question' : form.type === 'Technical Query' ? 'Technical Query' : form.type === 'H&S Inspection' ? 'Findings' : 'Works / Description'}
                  </p>
                  <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {form.question as string || form.findings as string || form.description || <span className="text-slate-600 italic">No description provided.</span>}
                    </p>
                  </div>
                </div>
              )}

              {/* RFI / TQ Response */}
              {(form.type === 'RFI' || form.type === 'Technical Query') && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Response</p>
                  <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
                    {form.response ? (
                      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{form.response as string}</p>
                    ) : (
                      <p className="text-sm text-slate-600 italic">No response recorded yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Hold Up Impact */}
              {form.type === 'Hold Up Notice' && form.impact && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Impact</p>
                  <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{form.impact as string}</p>
                  </div>
                </div>
              )}

              {/* H&S Actions Required */}
              {form.type === 'H&S Inspection' && form.actionsRequired && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Actions Required</p>
                  <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{form.actionsRequired as string}</p>
                  </div>
                </div>
              )}

              {/* Notes from form builder */}
              {(form.comments || form.notes) && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Form Notes</p>
                  <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{form.comments || form.notes}</p>
                  </div>
                </div>
              )}

              {/* Submission history */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Submission History</p>
                <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Calendar size={13} className="text-slate-600" />
                      {form.submittedDate ? formatDate(form.submittedDate) : `${formatDate(form.date)} — created`}
                    </div>
                    <StatusBadge status={form.status} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Comments Tab */}
          {tab === 'comments' && (
            <>
              {formComments.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare size={28} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No comments yet</p>
                </div>
              )}
              <div className="space-y-3 mb-3">
                {formComments.map(c => (
                  <div key={c.id} className="bg-[#0d1628] rounded-xl p-4 border border-[#1e2d4a]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-[#f97316]/20 flex items-center justify-center text-[9px] font-bold text-[#f97316]">
                        {c.user.split(' ').map(w => w[0]).join('')}
                      </div>
                      <span className="text-xs font-semibold text-slate-300">{c.user}</span>
                      <span className="text-[10px] text-slate-600 ml-auto">
                        {new Date(c.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(c.datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{renderWithMentions(c.text)}</p>
                  </div>
                ))}
              </div>
              <MentionTextarea
                value={newComment}
                onChange={setNewComment}
                onSubmit={(text) => {
                  const newC: FormComment = {
                    id: `fc-${Date.now()}`,
                    user: store.currentUser?.name ?? '',
                    datetime: new Date().toISOString(),
                    text,
                  };
                  onUpdateComments([...formComments, newC]);
                  setNewComment('');
                }}
                linkedType="form"
                linkedId={form.id}
                projectId={form.projectId}
                projectName={form.projectName}
              />
            </>
          )}

          {/* Files Tab */}
          {tab === 'files' && (
            <div className="space-y-4">
              {formAttachments.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Saved Attachments ({formAttachments.length})
                  </p>
                  <AttachmentList attachments={formAttachments} onRemove={id => store.removeAttachment(id)} />
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {formAttachments.length > 0 ? 'Add More Files' : 'Upload Files, Documents & Photos'}
                </p>
                <FileUploadComponent
                  files={pendingFiles}
                  onChange={setPendingFiles}
                  accept="image/*,.pdf,.doc,.docx,.dwg"
                  label="Drop files, photos or documents here"
                  maxFiles={20}
                />
                {pendingFiles.length > 0 && (
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-[#f97316] hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    <Paperclip size={14} />
                    {uploading ? 'Saving...' : `Save ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
              {formAttachments.length === 0 && pendingFiles.length === 0 && (
                <div className="text-center py-8">
                  <Image size={28} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No attachments yet</p>
                  <p className="text-xs text-slate-700 mt-1">Upload photos, drawings or documents as evidence</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Form Type Cards Config ───────────────────────────────────────────────────
interface FormCardConfig {
  type: ExtendedFormType;
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
  iconBg: string;
  countColor: string;
}

function getFormCards(formList: ExtendedSiteForm[]): FormCardConfig[] {
  return [
    {
      type: 'Daily Site Report',
      icon: <FileText size={22} />,
      title: 'Daily Site Report',
      description: 'Record daily site activities, attendance & progress',
      accent: 'group-hover:bg-[#f97316]',
      iconBg: 'bg-orange-900/60',
      countColor: 'text-[#f97316]',
    },
    {
      type: 'QA Inspection',
      icon: <ClipboardList size={22} />,
      title: 'QA Inspection',
      description: 'Quality assurance checks and inspection records',
      accent: 'group-hover:bg-teal-600',
      iconBg: 'bg-teal-900/60',
      countColor: 'text-teal-400',
    },
    {
      type: 'RFI',
      icon: <MessageSquare size={22} />,
      title: 'RFI Form',
      description: 'Request for information — track queries and responses',
      accent: 'group-hover:bg-cyan-600',
      iconBg: 'bg-cyan-900/60',
      countColor: 'text-cyan-400',
    },
    {
      type: 'Hold Up Notice',
      icon: <AlertTriangle size={22} />,
      title: 'Hold Up / Delay Notice',
      description: 'Report site delays, causes and impact on programme',
      accent: 'group-hover:bg-rose-600',
      iconBg: 'bg-rose-900/60',
      countColor: 'text-rose-400',
    },
    {
      type: 'H&S Inspection',
      icon: <ShieldCheck size={22} />,
      title: 'H&S Inspection',
      description: 'Health & safety site inspections and risk assessments',
      accent: 'group-hover:bg-amber-500',
      iconBg: 'bg-amber-900/60',
      countColor: 'text-amber-400',
    },
    {
      type: 'Delay Notice',
      icon: <AlertTriangle size={22} />,
      title: 'Delay Notice',
      description: 'Formal contractual delay notice with programme & commercial impact',
      accent: 'group-hover:bg-red-600',
      iconBg: 'bg-red-900/60',
      countColor: 'text-red-400',
    },
    {
      type: 'Variation',
      icon: <FileText size={22} />,
      title: 'Variation / Change Order',
      description: 'Record scope changes, cost and programme impacts',
      accent: 'group-hover:bg-blue-600',
      iconBg: 'bg-blue-900/60',
      countColor: 'text-blue-400',
    },
    {
      type: 'Early Warning Notice',
      icon: <Clock size={22} />,
      title: 'Early Warning Notice',
      description: 'Notify potential matters affecting cost, programme or quality',
      accent: 'group-hover:bg-yellow-500',
      iconBg: 'bg-yellow-900/60',
      countColor: 'text-yellow-400',
    },
    {
      type: 'Site Instruction',
      icon: <ClipboardList size={22} />,
      title: 'Site Instruction',
      description: 'Record verbal or written instructions issued on site',
      accent: 'group-hover:bg-slate-600',
      iconBg: 'bg-slate-700',
      countColor: 'text-slate-400',
    },
    {
      type: 'Technical Query',
      icon: <MessageSquare size={22} />,
      title: 'Technical Query (TQ)',
      description: 'Raise internal technical questions to resolve design or specification issues',
      accent: 'group-hover:bg-sky-600',
      iconBg: 'bg-sky-900/60',
      countColor: 'text-sky-400',
    },
  ].map(c => ({ ...c, _count: formList.filter(f => f.type === c.type).length } as FormCardConfig & { _count: number })) as FormCardConfig[];
}

// ─── Main Page ────────────────────────────────────────────────────────────────
interface SiteFormsProps {
  pendingOpen?: { linkedType: string; linkedId: string } | null;
  onPendingOpenConsumed?: () => void;
  pendingFilter?: { filterKey: string; filterValue: string } | null;
  onPendingFilterConsumed?: () => void;
}

export default function SiteForms({ pendingOpen, onPendingOpenConsumed, pendingFilter: _pendingFilter, onPendingFilterConsumed: _onPendingFilterConsumed }: SiteFormsProps) {
  const store = useAppStore();
  const visibleForms = store.visibleProjectIds
    ? store.siteForms.filter(f => store.visibleProjectIds!.includes(f.project_id))
    : store.siteForms;
  // Map DBSiteForm to ExtendedSiteForm shape
  const formList: ExtendedSiteForm[] = visibleForms.map(f => ({
    id: f.id,
    type: f.type as ExtendedFormType,
    projectId: f.project_id,
    projectName: f.project_name,
    date: f.date,
    completedBy: f.completed_by,
    description: f.description,
    comments: f.comments,
    status: f.status as ExtendedFormStatus,
    submittedDate: f.submitted_date,
    notes: f.notes,
    ...(f.extra_data as Record<string, unknown>),
  }));
  const [showFormBuilder, setShowFormBuilder] = useState<ExtendedFormType | null>(null);
  const [viewForm, setViewForm] = useState<ExtendedSiteForm | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterProject, setFilterProject] = useState<string>('All');
  const [rfiView, setRfiView] = useState<'register' | 'list'>('register');

  const filtered = formList.filter(f => {
    const matchSearch =
      f.projectName.toLowerCase().includes(search.toLowerCase()) ||
      f.completedBy.toLowerCase().includes(search.toLowerCase());
    return matchSearch
      && (filterType === 'All' || f.type === filterType)
      && (filterProject === 'All' || f.projectId === filterProject);
  });

  const todayCount = formList.filter(f => f.date === new Date().toISOString().split('T')[0]).length;
  const cards = getFormCards(formList);

  // Derive RFI records for the register view
  const rfiRecords: RFIRecord[] = useMemo(() => formList
    .filter(f => f.type === 'RFI')
    .map(f => ({
      id: f.id,
      rfiRef: (f.rfiRef as string) ?? '',
      subject: (f.subject as string) ?? '',
      question: (f.question as string) ?? '',
      response: (f.response as string) ?? '',
      requiredResponseDate: (f.requiredResponseDate as string) ?? '',
      projectId: f.projectId,
      projectName: f.projectName,
      raisedBy: f.completedBy,
      assignedTo: (f.assignedTo as string) ?? '',
      date: f.date,
      status: f.status as RFIStatus,
      notes: f.notes ?? '',
      attachmentCount: store.attachments.filter(a => a.linked_type === 'form' && a.linked_id === f.id).length,
    })), [formList, store.attachments]);

  const showRFIRegister = filterType === 'RFI' && rfiView === 'register';

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const isAdmin = store.currentUser?.role === 'Admin';

  useEffect(() => {
    if (pendingOpen?.linkedType === 'form' && pendingOpen.linkedId) {
      const dbForm = store.siteForms.find(f => f.id === pendingOpen.linkedId);
      if (dbForm) {
        const form: ExtendedSiteForm = {
          id: dbForm.id, type: dbForm.type as ExtendedFormType,
          projectId: dbForm.project_id, projectName: dbForm.project_name,
          date: dbForm.date, completedBy: dbForm.completed_by,
          description: dbForm.description, comments: dbForm.comments,
          status: dbForm.status as ExtendedFormStatus,
          submittedDate: dbForm.submitted_date, notes: dbForm.notes,
          ...(dbForm.extra_data as Record<string, unknown>),
        };
        setViewForm(form);
        onPendingOpenConsumed?.();
      }
    }
  }, [pendingOpen, store.siteForms, onPendingOpenConsumed]);

  const filterTabs = ['All', 'Daily Site Report', 'QA Inspection', 'RFI', 'Technical Query', 'Hold Up Notice', 'H&S Inspection', 'Delay Notice', 'Variation', 'Early Warning Notice', 'Site Instruction'];
  const filterLabels: Record<string, string> = {
    All: 'All',
    'Daily Site Report': 'Daily Reports',
    'QA Inspection': 'QA',
    'RFI': 'RFI',
    'Technical Query': 'TQ',
    'Hold Up Notice': 'Hold Up',
    'H&S Inspection': 'H&S',
    'Delay Notice': 'Delay Notice',
    'Variation': 'Variation',
    'Early Warning Notice': 'Early Warning',
    'Site Instruction': 'Site Instruction',
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Site Forms</h2>
        <p className="text-sm text-slate-500">{todayCount} submitted today &middot; {formList.length} total &middot; Select a form type below to begin</p>
      </div>

      {/* Form type cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {cards.map(card => {
          const count = formList.filter(f => f.type === card.type).length;
          const iconTextColor = TYPE_MAP[card.type]?.text ?? 'text-slate-400';
          return (
            <div key={card.type}
              className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-4 flex flex-col gap-3 hover:border-[#2a3d5a] transition-all cursor-pointer group"
              onClick={() => setShowFormBuilder(card.type)}>
              <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center ${card.accent} transition-colors`}>
                <span className={`${iconTextColor} group-hover:text-white transition-colors`}>{card.icon}</span>
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm leading-snug">{card.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">{card.description}</p>
                <p className={`text-xs font-semibold mt-1.5 ${card.countColor}`}>{count} submitted</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search + filter tabs */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search forms..."
            className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600" />
        </div>
        <div className="relative">
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 pr-8 text-sm text-slate-300 outline-none focus:border-[#f97316] appearance-none">
            <option value="All">All Projects</option>
            {(store.visibleProjectIds ? store.projects.filter(p => store.visibleProjectIds!.includes(p.id)) : store.projects).map(p => <option key={p.id} value={p.id}>{p.name.split(' ').slice(0, 3).join(' ')}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
        <div className="flex flex-wrap gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
          {filterTabs.map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                filterType === t ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {filterLabels[t] ?? t}
            </button>
          ))}
        </div>

        {/* RFI view toggle */}
        {filterType === 'RFI' && (
          <div className="flex items-center gap-0.5 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 shrink-0">
            <button onClick={() => setRfiView('register')} title="Register view"
              className={`p-1.5 rounded-md transition-colors ${rfiView === 'register' ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setRfiView('list')} title="List view"
              className={`p-1.5 rounded-md transition-colors ${rfiView === 'list' ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              <List size={14} />
            </button>
          </div>
        )}
      </div>

      {/* RFI Register view */}
      {showRFIRegister && (
        <RFIRegister
          rfis={rfiRecords}
          filterProject={filterProject}
          onFilterProject={setFilterProject}
          onNewRFI={() => setShowFormBuilder('RFI')}
          onOpenTicket={id => {
            const form = formList.find(f => f.id === id);
            if (form) setViewForm(form);
          }}
          onUpdateStatus={(id, status) => {
            const dbForm = store.siteForms.find(f => f.id === id);
            if (dbForm) store.updateSiteForm({ ...dbForm, status });
          }}
        />
      )}

      {/* Forms list */}
      {!showRFIRegister && (
        <div className="space-y-3">
          {filtered.map(form => {
            const typeCfg = TYPE_MAP[form.type] ?? { bg: 'bg-slate-700', text: 'text-slate-300', label: form.type, border: 'border-l-slate-600' };
            const dbForm = store.siteForms.find(f => f.id === form.id);
            const commentCount = (dbForm?.form_comments ?? []).length;
            const attCount = store.attachments.filter(a => a.linked_type === 'form' && a.linked_id === form.id).length;
            return (
              <div key={form.id}
                onClick={() => setViewForm(form)}
                className={`bg-[#1a2236] rounded-xl border border-[#1e2d4a] border-l-4 ${typeCfg.border} hover:border-[#2a3d5a] transition-all cursor-pointer group`}
              >
                <div className="p-4">
                  <div className="flex-1 min-w-0">
                    {/* Top row: type badge + title + status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <TypeBadge type={form.type} />
                        </div>
                        <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors leading-snug">
                          {form.subject || form.description || form.question || form.type}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{form.projectName}</p>
                      </div>
                      <StatusBadge status={form.status} />
                    </div>
                    {/* Bottom row: date + completed by + counts + actions */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e2d4a]">
                      <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                        <Calendar size={11} className="text-slate-600" />
                        {formatDate(form.date)}
                      </span>
                      <span className="text-xs text-slate-500 truncate">{form.completedBy}</span>
                      <div className="flex items-center gap-2 ml-auto">
                        {commentCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                            <MessageSquare size={11} />{commentCount}
                          </span>
                        )}
                        {attCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 bg-[#0d1628] border border-[#1e2d4a] px-1.5 py-0.5 rounded-full">
                            <Paperclip size={9} />{attCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); setViewForm(form); }}
                          className="p-1 rounded text-slate-600 hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
                          title="View / edit form"
                        >
                          <Edit2 size={13} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteConfirm(form.id); }}
                            className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                            title="Delete form"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
              <FileText size={32} className="text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No forms found</p>
            </div>
          )}
        </div>
      )}

      {/* Form Builder Modal */}
      {showFormBuilder && (
        <FormBuilder
          type={showFormBuilder}
          onClose={() => setShowFormBuilder(null)}
          onSave={formData => {
            const dbForm: DBSiteForm = {
              id: formData.id,
              type: formData.type,
              project_id: formData.projectId,
              project_name: formData.projectName,
              date: formData.date,
              completed_by: formData.completedBy,
              description: formData.description,
              comments: formData.comments ?? '',
              form_comments: [],
              status: formData.status,
              submitted_date: formData.submittedDate,
              notes: formData.notes ?? '',
              extra_data: {
                rfiRef: formData.rfiRef,
                subject: formData.subject,
                question: formData.question,
                response: formData.response,
                requiredResponseDate: formData.requiredResponseDate,
                areaLocation: formData.areaLocation,
                cause: formData.cause,
                impact: formData.impact,
                programmeImpact: formData.programmeImpact,
                commercialImpact: formData.commercialImpact,
                noticeRef: formData.noticeRef,
                dateTime: formData.dateTime,
                variationRef: formData.variationRef,
                instructionSource: formData.instructionSource,
                costImpact: formData.costImpact,
                variationStatus: formData.variationStatus,
                areaInspected: formData.areaInspected,
                inspectionDate: formData.inspectionDate,
                inspectionType: formData.inspectionType,
                findings: formData.findings,
                actionsRequired: formData.actionsRequired,
                riskLevel: formData.riskLevel,
                inspectorName: formData.inspectorName,
                tqRef: formData.tqRef,
                drawingRef: formData.drawingRef,
                assignedTo: formData.assignedTo,
                priority: formData.priority,
              },
            };
            store.addSiteForm(dbForm);
          }}
        />
      )}

      {/* Form View Modal */}
      {viewForm && (
        <FormViewModal
          form={viewForm}
          formComments={(() => {
            const dbForm = store.siteForms.find(f => f.id === viewForm.id);
            return (dbForm?.form_comments ?? []) as FormComment[];
          })()}
          onClose={() => setViewForm(null)}
          onUpdateComments={(comments) => {
            const dbForm = store.siteForms.find(f => f.id === viewForm.id);
            if (dbForm) store.updateSiteForm({ ...dbForm, form_comments: comments });
          }}
          onEdit={() => { setViewForm(null); setShowFormBuilder(viewForm.type); }}
          onDelete={() => { setDeleteConfirm(viewForm.id); }}
          isAdmin={isAdmin}
        />
      )}
      {deleteConfirm && (
        <ConfirmDeleteModal
          title="Delete Site Form"
          description="This site form will be permanently deleted and cannot be recovered."
          onConfirm={() => { store.removeSiteForm(deleteConfirm); setDeleteConfirm(null); if (viewForm?.id === deleteConfirm) setViewForm(null); }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
