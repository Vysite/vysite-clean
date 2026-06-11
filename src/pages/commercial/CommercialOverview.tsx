import { useState, useEffect } from 'react';
import {
  MapPin, User, Calendar, Save, TrendingUp, Info,
  FileText, Printer, Clock, CheckCircle2, ChevronRight,
  AlertCircle,
} from 'lucide-react';
import KeyDatesPanel from '../../components/KeyDatesPanel';
import { fmtCurrency, parseRawValue, typeInfo, statusInfo } from './types';
import type { CommercialRecord, Project } from './types';
import type { DBKeyDate } from '../../lib/store';
import { openPrintTab } from '../../lib/printTab';

interface CommercialOverviewProps {
  project: Project | null;
  projects: Project[];
  records: CommercialRecord[];
  keyDates: DBKeyDate[];
  canEdit: boolean;
  canCreate: boolean;
  currentUserName: string;
  orgSettings?: { company_name?: string; logo_data_url?: string } | null;
  onProjectChange: (id: string) => void;
  onAddKeyDate: (d: DBKeyDate) => Promise<void>;
  onUpdateKeyDate: (d: DBKeyDate) => Promise<void>;
  onRemoveKeyDate: (id: string) => Promise<void>;
  onUpdateProject: (p: Project) => Promise<void>;
  onNewRecord: () => void;
}

const inputCls = 'bg-transparent text-sm font-bold text-white w-full focus:outline-none placeholder-slate-600';

function fmtEditDisplay(raw: string): string {
  const n = parseFloat(raw);
  if (!raw || isNaN(n)) return raw;
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normaliseInput(v: string): string {
  return v.replace(/[£,\s]/g, '');
}

// Recent activity derived from register records — last 8 events by date
function buildRecentActivity(records: CommercialRecord[]): { id: string; label: string; sub: string; date: string }[] {
  const events: { id: string; label: string; sub: string; date: string; ts: number }[] = [];
  for (const r of records) {
    const ref = r.reference ? r.reference + ' — ' : '';
    const typeName = typeInfo(r.recordType).label;
    if (r.dateRaised) {
      events.push({ id: r.id + '-raised', label: `${ref}${typeName} Raised`, sub: r.title, date: r.dateRaised, ts: new Date(r.dateRaised).getTime() });
    }
    if (r.dateAgreed && ['agreed', 'added_to_valuation', 'paid', 'complete'].includes(r.status)) {
      events.push({ id: r.id + '-agreed', label: `${ref}${typeName} Agreed`, sub: r.title, date: r.dateAgreed, ts: new Date(r.dateAgreed).getTime() });
    }
    if (r.dateSubmitted && r.status !== 'draft') {
      events.push({ id: r.id + '-submitted', label: `${ref}${typeName} Submitted`, sub: r.title, date: r.dateSubmitted, ts: new Date(r.dateSubmitted).getTime() });
    }
  }
  return events
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8)
    .map(({ id, label, sub, date }) => ({ id, label, sub, date }));
}

function activityIcon(label: string) {
  if (label.includes('Agreed')) return <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />;
  if (label.includes('Submitted')) return <ChevronRight size={12} className="text-sky-400 shrink-0 mt-0.5" />;
  if (label.includes('Raised')) return <Clock size={12} className="text-amber-400 shrink-0 mt-0.5" />;
  return <AlertCircle size={12} className="text-slate-400 shrink-0 mt-0.5" />;
}

// ─── PDF export CSS shared block ─────────────────────────────────────────────

const PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1e293b; background: white; font-size: 11px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 880px; margin: 0 auto; padding: 36px 40px; }
  .doc-header { display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 12px; border-bottom: 3px solid #f97316; margin-bottom: 22px; }
  .doc-logo-text { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: 0.05em; line-height: 1; }
  .doc-tagline { font-size: 9px; color: #94a3b8; margin-top: 3px; letter-spacing: 0.04em; }
  .doc-header-right { text-align: right; }
  .doc-title { font-size: 17px; font-weight: 900; color: #0f172a; line-height: 1.2; margin-bottom: 3px; }
  .doc-dateline { font-size: 10px; color: #64748b; }
  .report-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
  .report-meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; padding: 7px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
  .report-meta-value { font-size: 10.5px; font-weight: 600; color: #0f172a; padding: 7px 14px; background: white; border-bottom: 1px solid #e2e8f0; }
  .statement-block { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
  .statement-header { background: #fff7ed; padding: 8px 16px; border-bottom: 1px solid #fed7aa; }
  .statement-header-title { font-size: 8px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.1em; }
  .statement-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 16px; border-bottom: 1px solid #f1f5f9; }
  .statement-row:last-child { border-bottom: none; }
  .statement-label { font-size: 9.5px; color: #475569; }
  .statement-sub { font-size: 8px; color: #94a3b8; margin-top: 1px; }
  .statement-value { font-size: 11px; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; text-align: right; }
  .statement-divider { border-top: 1.5px solid #e2e8f0; margin: 2px 0; }
  .statement-total .statement-label { font-size: 10px; font-weight: 700; color: #0f172a; }
  .statement-total .statement-value { font-size: 12px; color: #f97316; }
  .statement-accent .statement-value { color: #f97316; }
  .section-heading { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 12px; margin-top: 24px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .data-table th { padding: 8px 10px; text-align: left; font-size: 8.5px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; }
  .data-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: top; }
  .data-table tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; font-size: 8.5px; font-weight: 700; padding: 2px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
  .badge-orange { background: #fff7ed; color: #c2410c; } .badge-green { background: #d1fae5; color: #065f46; }
  .badge-amber { background: #fef3c7; color: #92400e; } .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .badge-slate { background: #f1f5f9; color: #475569; } .badge-red { background: #fee2e2; color: #991b1b; }
  .doc-footer { margin-top: 36px; padding-top: 10px; border-top: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
  .doc-footer-left { font-size: 8px; color: #94a3b8; }
  .doc-footer-right { font-size: 8px; color: #94a3b8; text-align: right; }
  @media print { .page { padding: 20px 24px; } }
`;

function escHtml(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtD(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB');
}

// ─── Overview component ───────────────────────────────────────────────────────

export default function CommercialOverview({
  project, projects, records, keyDates, canEdit, canCreate,
  currentUserName, onProjectChange, onAddKeyDate, onUpdateKeyDate,
  onRemoveKeyDate, onUpdateProject, onNewRecord,
}: CommercialOverviewProps) {
  const [contractEdit, setContractEdit] = useState('');
  const [completedEdit, setCompletedEdit] = useState('');
  const [saving, setSaving] = useState(false);
  const [contractFocused, setContractFocused] = useState(false);
  const [completedFocused, setCompletedFocused] = useState(false);
  const [showVariationsInfo, setShowVariationsInfo] = useState(false);

  useEffect(() => {
    if (!project) return;
    const raw = project.value ? parseRawValue(project.value) : 0;
    setContractEdit(raw > 0 ? String(raw) : '');
    setCompletedEdit(project.committed != null ? String(project.committed) : '');
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) {
    return (
      <div className="py-16 text-center">
        <TrendingUp size={32} className="text-slate-700 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">No projects found — create a project first.</p>
      </div>
    );
  }

  const contractNum  = parseFloat(contractEdit) || (project.value ? parseRawValue(project.value) : 0);
  const completedNum = completedEdit.trim() !== '' ? parseFloat(completedEdit) : (project.committed ?? null);
  const variationsNum = project.variationsValue ?? null;

  // Commercial position calculations
  const variationExposure   = variationsNum ?? 0;
  const forecastContractSum = contractNum + variationExposure;
  const agreedVariations    = 0; // Phase 2b — will be derived from vy_variation_account
  const adjustedContractSum = contractNum + agreedVariations;
  const remainingValue      = completedNum != null ? adjustedContractSum - completedNum : null;

  const progress = contractNum > 0 && completedNum != null
    ? Math.min(100, Math.round((completedNum / contractNum) * 100))
    : project.progress;

  const contractDirty  = contractEdit !== '' && parseFloat(contractEdit) !== (project.value ? parseRawValue(project.value) : 0);
  const completedDirty = completedEdit !== '' && parseFloat(completedEdit) !== (project.committed ?? NaN);
  const isDirty = contractDirty || completedDirty;

  async function handleSave() {
    if (!project) return;
    const newContract  = parseFloat(contractEdit) || 0;
    const newCompleted = completedEdit.trim() !== '' ? parseFloat(completedEdit) : null;
    const newProgress  = newContract > 0 && newCompleted != null
      ? Math.min(100, Math.round((newCompleted / newContract) * 100))
      : project.progress;
    setSaving(true);
    await onUpdateProject({
      ...project,
      value: newContract > 0 ? fmtCurrency(newContract) : project.value,
      committed: newCompleted,
      progress: newProgress,
    });
    setSaving(false);
  }

  const recentActivity = buildRecentActivity(
    records.filter(r => r.projectId === project.id)
  );

  const projectKeyDates = keyDates.filter(d => d.project_id === project.id);

  function exportPositionStatement() {
    const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);

    const fv = (n: number) => '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const kdRows = [...projectKeyDates]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(d => {
        const isOverdue = d.status === 'Open' && d.date && new Date(d.date) < todayMidnight;
        const label = d.status === 'Closed' ? 'Closed' : isOverdue ? 'Overdue' : 'Open';
        const badgeCls = d.status === 'Closed' ? 'badge-green' : isOverdue ? 'badge-red' : 'badge-amber';
        const diff = d.date && d.status === 'Open' ? Math.round((new Date(d.date).getTime() - todayMidnight.getTime()) / 86400000) : null;
        const dr = diff === null ? '—' : diff === 0 ? 'Today' : diff < 0 ? `${Math.abs(diff)}d overdue` : `${diff}d remaining`;
        return `<tr><td>${fmtD(d.date)}</td><td style="font-weight:600;">${escHtml(d.title)}</td><td><span class="badge ${badgeCls}">${label}</span></td><td>${dr}</td></tr>`;
      }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Commercial Position Statement — ${escHtml(project.name)}</title>
    <style>${PDF_CSS}</style>
    <script>window.onload=function(){window.print();}<\/script>
    </head><body><div class="page">
      <div class="doc-header">
        <div><div class="doc-logo-text">VYSITE</div><div class="doc-tagline">Construction Operating System</div></div>
        <div class="doc-header-right">
          <div class="doc-title">Commercial Position Statement</div>
          <div class="doc-dateline">${escHtml(project.name)}${project.client ? ' &mdash; ' + escHtml(project.client) : ''}</div>
        </div>
      </div>
      <div class="report-meta">
        <div class="report-meta-label">Report Type</div><div class="report-meta-value">Commercial Position Statement</div>
        <div class="report-meta-label">Project</div><div class="report-meta-value">${escHtml(project.name)}</div>
        ${project.client ? `<div class="report-meta-label">Client</div><div class="report-meta-value">${escHtml(project.client)}</div>` : ''}
        <div class="report-meta-label">Project Manager</div><div class="report-meta-value">${escHtml(project.projectManager || '—')}</div>
        <div class="report-meta-label">Generated Date</div><div class="report-meta-value">${todayStr}</div>
        <div class="report-meta-label">Generated By</div><div class="report-meta-value">${escHtml(currentUserName || '—')}</div>
      </div>

      <div class="statement-block">
        <div class="statement-header"><div class="statement-header-title">Commercial Position</div></div>
        <div class="statement-row">
          <div class="statement-label">Original Contract Sum</div>
          <div class="statement-value">${contractNum > 0 ? fv(contractNum) : '—'}</div>
        </div>
        ${variationExposure !== 0 ? `
        <div class="statement-row statement-accent">
          <div class="statement-label">Variation Exposure<div class="statement-sub">All submitted / under review variations</div></div>
          <div class="statement-value">+${fv(variationExposure)}</div>
        </div>` : ''}
        <div class="statement-divider"></div>
        <div class="statement-row statement-total">
          <div class="statement-label">Forecast Contract Sum</div>
          <div class="statement-value">${contractNum > 0 ? fv(forecastContractSum) : '—'}</div>
        </div>
        ${agreedVariations !== 0 ? `
        <div class="statement-row">
          <div class="statement-label">Agreed Variations</div>
          <div class="statement-value">+${fv(agreedVariations)}</div>
        </div>` : ''}
        <div class="statement-divider"></div>
        <div class="statement-row statement-total">
          <div class="statement-label">Adjusted Contract Sum</div>
          <div class="statement-value">${contractNum > 0 ? fv(adjustedContractSum) : '—'}</div>
        </div>
        ${completedNum != null ? `
        <div class="statement-row">
          <div class="statement-label">Completed Value</div>
          <div class="statement-value">${fv(completedNum)}</div>
        </div>` : ''}
        ${remainingValue != null ? `
        <div class="statement-row">
          <div class="statement-label">Remaining Value</div>
          <div class="statement-value">${fv(remainingValue)}</div>
        </div>` : ''}
      </div>

      ${projectKeyDates.length > 0 ? `
      <div class="section-heading">Key Dates (${projectKeyDates.length})</div>
      <table class="data-table">
        <thead><tr><th style="width:90px">Date</th><th>Title</th><th style="width:80px">Status</th><th style="width:110px">Days Remaining</th></tr></thead>
        <tbody>${kdRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:12px">No key dates recorded</td></tr>'}</tbody>
      </table>` : ''}

      <div class="doc-footer">
        <div class="doc-footer-left">VYSITE &bull; Construction Operating System &bull; Commercial Document &mdash; Confidential</div>
        <div class="doc-footer-right">Generated by ${escHtml(currentUserName || 'VYSITE')} &bull; ${todayStr} &bull; &copy; VYSITE. All rights reserved.</div>
      </div>
    </div></body></html>`;
    openPrintTab(html);
  }

  return (
    <div className="space-y-5">

      {/* Project selector row */}
      {projects.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Project</span>
          <select
            value={project.id}
            onChange={e => onProjectChange(e.target.value)}
            className="bg-[#0d1628] border border-[#1e2d4a] text-slate-200 text-sm rounded-lg px-3 py-1.5 min-w-[240px] focus:outline-none focus:ring-1 focus:ring-[#f97316] focus:border-[#f97316] transition-colors"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Project header + commercial position statement */}
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl overflow-hidden">
        {/* Project meta header */}
        <div className="border-b border-[#1e2d4a] px-5 py-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h2 className="text-lg font-bold text-white leading-tight">{project.name}</h2>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                  project.status === 'Active'    ? 'bg-emerald-900/60 text-emerald-400'
                  : project.status === 'Completed' ? 'bg-blue-900/60 text-blue-400'
                  : project.status === 'On Hold'   ? 'bg-amber-900/60 text-amber-400'
                  : 'bg-slate-700/60 text-slate-400'
                }`}>{project.status}</span>
              </div>
              {project.client && <p className="text-sm text-slate-500">{project.client}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={exportPositionStatement}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-[#f97316] rounded-lg transition-colors"
                title="Export Commercial Position Statement"
              >
                <FileText size={12} /> Export PDF
              </button>
              {canCreate && (
                <button
                  onClick={onNewRecord}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#f97316] hover:bg-orange-400 text-white rounded-lg transition-colors"
                >
                  New Record
                </button>
              )}
            </div>
          </div>

          {/* Project meta */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: MapPin,   label: 'Location',   value: project.location ? project.location.split(',').slice(-2).join(',').trim() : '—' },
              { icon: User,     label: 'PM',         value: project.projectManager || '—' },
              { icon: Calendar, label: 'Start',      value: project.startDate    ? new Date(project.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
              { icon: Calendar, label: 'Completion', value: project.completionDate ? new Date(project.completionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <item.icon size={12} className="text-slate-600 shrink-0" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">{item.label}</span>
                <span className="text-xs text-slate-300 font-medium truncate">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Commercial Position Statement */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Commercial Position</p>

          <div className="space-y-0">
            {/* Row: Original Contract Sum */}
            <div className="flex items-center justify-between py-1.5 border-b border-[#1e2d4a]/50">
              <span className="text-sm text-slate-300">Original Contract Sum</span>
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <div className="bg-[#0d1628] border border-[#1e2d4a] focus-within:border-[#f97316] rounded px-2.5 py-1 min-w-[160px] transition-colors">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={contractFocused ? contractEdit : fmtEditDisplay(contractEdit)}
                      onFocus={() => setContractFocused(true)}
                      onBlur={() => { setContractFocused(false); setContractEdit(normaliseInput(contractEdit)); }}
                      onChange={e => setContractEdit(normaliseInput(e.target.value))}
                      placeholder="Enter value"
                      className={`${inputCls} text-right w-full`}
                    />
                  </div>
                </div>
              ) : (
                <span className="text-sm font-semibold text-white tabular-nums">
                  {contractNum > 0 ? fmtCurrency(contractNum) : '—'}
                </span>
              )}
            </div>

            {/* Row: Variation Exposure */}
            <div className="flex items-center justify-between py-1.5 border-b border-[#1e2d4a]/50">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-300">Variation Exposure</span>
                <button
                  onClick={() => setShowVariationsInfo(v => !v)}
                  className="text-slate-600 hover:text-slate-400 transition-colors"
                  title="All submitted and under-review variations — not yet agreed"
                >
                  <Info size={12} />
                </button>
              </div>
              <span className="text-sm font-semibold text-orange-300 tabular-nums">
                {variationExposure !== 0 ? (variationExposure > 0 ? '+' : '') + fmtCurrency(variationExposure) : '—'}
              </span>
            </div>
            {showVariationsInfo && (
              <div className="py-1.5 px-3 bg-[#0d1628] text-[10px] text-slate-500 italic border-b border-[#1e2d4a]/50 rounded">
                Variation Exposure = all submitted and under-review variations. Not yet agreed. Add via Variation Account tab once Phase 2b is live. Manual value shown here during Phase 2a.
              </div>
            )}

            {/* Separator + Forecast Contract Sum */}
            <div className="flex items-center justify-between py-2 border-b border-[#1e2d4a]">
              <span className="text-sm font-semibold text-white">Forecast Contract Sum</span>
              <span className="text-base font-bold text-[#f97316] tabular-nums">
                {contractNum > 0 ? fmtCurrency(forecastContractSum) : '—'}
              </span>
            </div>

            {/* Row: Agreed Variations */}
            <div className="flex items-center justify-between py-1.5 border-b border-[#1e2d4a]/50">
              <span className="text-sm text-slate-400">Agreed Variations</span>
              <span className="text-sm font-medium text-emerald-400 tabular-nums">
                {agreedVariations !== 0 ? fmtCurrency(agreedVariations) : '—'}
              </span>
            </div>

            {/* Separator + Adjusted Contract Sum */}
            <div className="flex items-center justify-between py-2 border-b border-[#1e2d4a]">
              <span className="text-sm font-semibold text-white">Adjusted Contract Sum</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {contractNum > 0 ? fmtCurrency(adjustedContractSum) : '—'}
              </span>
            </div>

            {/* Row: Completed Value */}
            <div className="flex items-center justify-between py-1.5 border-b border-[#1e2d4a]/50">
              <span className="text-sm text-slate-300">Completed Value</span>
              {canEdit ? (
                <div className="bg-[#0d1628] border border-[#1e2d4a] focus-within:border-[#f97316] rounded px-2.5 py-1 min-w-[160px] transition-colors">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={completedFocused ? completedEdit : fmtEditDisplay(completedEdit)}
                    onFocus={() => setCompletedFocused(true)}
                    onBlur={() => { setCompletedFocused(false); setCompletedEdit(normaliseInput(completedEdit)); }}
                    onChange={e => setCompletedEdit(normaliseInput(e.target.value))}
                    placeholder="Enter value"
                    className={`${inputCls} text-right w-full`}
                  />
                </div>
              ) : (
                <span className="text-sm font-semibold text-slate-200 tabular-nums">
                  {completedNum != null ? fmtCurrency(completedNum) : '—'}
                </span>
              )}
            </div>

            {/* Row: Remaining Value */}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-300">Remaining Value</span>
              <span className={`text-sm font-semibold tabular-nums ${
                remainingValue == null ? 'text-slate-500'
                : remainingValue < 0 ? 'text-red-400'
                : remainingValue < contractNum * 0.1 ? 'text-amber-400'
                : 'text-emerald-400'
              }`}>
                {remainingValue != null ? fmtCurrency(remainingValue) : '—'}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          {contractNum > 0 && (
            <div className="mt-4 pt-3 border-t border-[#1e2d4a]/50">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-500">Overall Progress</span>
                <span className="font-bold text-[#f97316]">{progress}%</span>
              </div>
              <div className="w-full bg-[#0d1628] rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-[#f97316] transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Save row */}
          {isDirty && canEdit && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-orange-400 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Save size={12} />{saving ? 'Saving…' : 'Save Values'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Two column layout: Key Dates + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Key Dates */}
        <div>
          <KeyDatesPanel
            project={project}
            keyDates={projectKeyDates}
            currentUserName={currentUserName}
            onAdd={onAddKeyDate}
            onUpdate={onUpdateKeyDate}
            onRemove={onRemoveKeyDate}
            collapsible
          />
        </div>

        {/* Recent Commercial Activity */}
        <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-white">Recent Commercial Activity</h3>
            <span className="text-xs text-slate-500">{recentActivity.length} event{recentActivity.length !== 1 ? 's' : ''}</span>
          </div>

          {recentActivity.length === 0 ? (
            <div className="py-10 text-center">
              <Printer size={24} className="text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No commercial activity recorded yet</p>
              {canCreate && (
                <button onClick={onNewRecord} className="mt-3 text-xs text-[#f97316] hover:underline">
                  Create your first record
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#1e2d4a]/50">
              {recentActivity.map(event => (
                <div key={event.id} className="flex items-start gap-3 px-4 py-2.5">
                  {activityIcon(event.label)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{event.label}</p>
                    {event.sub && <p className="text-[11px] text-slate-500 truncate">{event.sub}</p>}
                  </div>
                  <span className="text-[10px] text-slate-600 shrink-0 mt-0.5">
                    {new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
