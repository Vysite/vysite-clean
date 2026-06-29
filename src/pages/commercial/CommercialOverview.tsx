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
import { exportPositionStatementPDF } from './CommercialPDF';

interface CommercialOverviewProps {
  project: Project | null;
  projects: Project[];
  records: CommercialRecord[];
  keyDates: DBKeyDate[];
  canEdit: boolean;
  canCreate: boolean;
  currentUserName: string;
  orgSettings?: { company_name?: string; logo_data_url?: string } | null;
  // VA metrics — passed from parent so Overview reflects live Variation Account data
  vaExposure: number;
  vaAgreed: number;
  vaHasItems: boolean;
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

// ─── Overview component ───────────────────────────────────────────────────────

export default function CommercialOverview({
  project, projects, records, keyDates, canEdit, canCreate,
  currentUserName, vaExposure, vaAgreed, vaHasItems,
  onProjectChange, onAddKeyDate, onUpdateKeyDate,
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

  // When VA items exist use live calculations; otherwise fall back to manual variationsValue
  const variationExposure   = vaHasItems ? vaExposure : (project.variationsValue ?? 0);
  const agreedVariations    = vaHasItems ? vaAgreed : 0;
  const forecastContractSum = contractNum + variationExposure;
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
    exportPositionStatementPDF({
      project,
      keyDates: projectKeyDates,
      contractNum,
      completedNum,
      variationExposure,
      agreedVariations,
      currentUserName: currentUserName || '',
      logoUrl: orgSettings?.logo_data_url,
    });
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

            {/* Row: Outstanding Variation Exposure */}
            <div className="flex items-center justify-between py-1.5 border-b border-[#1e2d4a]/50">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-300">Outstanding Variation Exposure</span>
                {vaHasItems ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0d1628] border border-[#1e2d4a] text-slate-500">
                    From Variation Account
                  </span>
                ) : (
                  <button
                    onClick={() => setShowVariationsInfo(v => !v)}
                    className="text-slate-600 hover:text-slate-400 transition-colors"
                    title="Manual value — add variations in the Variation Account tab to calculate automatically"
                  >
                    <Info size={12} />
                  </button>
                )}
              </div>
              <span className="text-sm font-semibold text-orange-300 tabular-nums">
                {variationExposure !== 0 ? (variationExposure > 0 ? '+' : '') + fmtCurrency(variationExposure) : '—'}
              </span>
            </div>
            {showVariationsInfo && !vaHasItems && (
              <div className="py-1.5 px-3 bg-[#0d1628] text-[10px] text-slate-500 italic border-b border-[#1e2d4a]/50 rounded">
                Manual value from project settings. Add variations in the Variation Account tab to calculate this automatically.
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
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-400">Agreed Variations</span>
                {vaHasItems && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0d1628] border border-[#1e2d4a] text-slate-500">
                    From Variation Account
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-emerald-400 tabular-nums">
                {agreedVariations !== 0 ? (agreedVariations > 0 ? '+' : '') + fmtCurrency(agreedVariations) : '—'}
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
