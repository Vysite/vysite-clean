import { X, ChevronDown } from 'lucide-react';
import { inputCls, labelCls } from './types';

// ─── Site Walk Audit ──────────────────────────────────────────────────────────

export type ChecklistEntry = { result: string; comment: string; action: boolean; responsible: string; closeDate: string };
export const SWA_DEFAULT_ENTRY: ChecklistEntry = { result: 'N/A', comment: '', action: false, responsible: '', closeDate: '' };

interface CheckItemProps {
  itemKey: string;
  label: string;
  entry: ChecklistEntry;
  onUpdate: (key: string, field: keyof ChecklistEntry, value: string | boolean) => void;
}

export function SWACheckItem({ itemKey, label, entry, onUpdate }: CheckItemProps) {
  const showDetail = entry.result === 'Fail' || entry.action;
  const showComment = !showDetail && !!entry.comment;
  return (
    <div className="border border-[#1e2d4a] rounded-xl p-3 space-y-2 bg-[#0d1628]/50">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-slate-300 flex-1">{label}</span>
        <div className="flex gap-1.5 shrink-0">
          {(['Pass', 'Fail', 'N/A'] as const).map(r => (
            <button key={r} type="button" onClick={() => onUpdate(itemKey, 'result', r)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${entry.result === r
                ? r === 'Pass' ? 'bg-emerald-600 border-emerald-600 text-white'
                  : r === 'Fail' ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-slate-600 border-slate-600 text-white'
                : 'bg-transparent border-[#1e2d4a] text-slate-600 hover:border-slate-500 hover:text-slate-400'}`}>
              {r}
            </button>
          ))}
          <button type="button" onClick={() => onUpdate(itemKey, 'action', !entry.action)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${entry.action ? 'bg-amber-500 border-amber-500 text-white' : 'bg-transparent border-[#1e2d4a] text-slate-600 hover:border-slate-500'}`}
            title="Flag action required">
            ⚡
          </button>
        </div>
      </div>
      {showDetail && (
        <div className="space-y-1.5 pl-1 border-l-2 border-red-800/60">
          <input value={entry.comment} onChange={e => onUpdate(itemKey, 'comment', e.target.value)}
            className={`${inputCls} mt-0 text-xs py-1.5`} placeholder="Comment / defect detail..." />
          <div className="grid grid-cols-2 gap-1.5">
            <input value={entry.responsible} onChange={e => onUpdate(itemKey, 'responsible', e.target.value)}
              className={`${inputCls} mt-0 text-xs py-1.5`} placeholder="Responsible person" />
            <input type="date" value={entry.closeDate} onChange={e => onUpdate(itemKey, 'closeDate', e.target.value)}
              className={`${inputCls} mt-0 text-xs py-1.5`} />
          </div>
        </div>
      )}
      {showComment && (
        <input value={entry.comment} onChange={e => onUpdate(itemKey, 'comment', e.target.value)}
          className={`${inputCls} mt-0 text-xs py-1.5`} placeholder="Comment..." />
      )}
    </div>
  );
}

interface SWASectionProps {
  title: string;
  items: [string, string][];
  checklist: Record<string, ChecklistEntry>;
  onUpdate: (key: string, field: keyof ChecklistEntry, value: string | boolean) => void;
}

export function SWASection({ title, items, checklist, onUpdate }: SWASectionProps) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">{title}</p>
      {items.map(([key, label]) => (
        <SWACheckItem
          key={key}
          itemKey={key}
          label={label}
          entry={checklist[key] ?? SWA_DEFAULT_ENTRY}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

// ─── Operatives ───────────────────────────────────────────────────────────────

export interface OperativeRecord {
  name: string; company: string; trade: string; timeIn: string; timeOut: string;
  inducted: boolean; ramsRead: boolean; ppeCompliant: boolean; signedIn: boolean;
  competencyConfirmed: boolean; ecsConfirmed: boolean; permitBriefed: boolean;
}
export const DEFAULT_OPERATIVE: OperativeRecord = {
  name: '', company: '', trade: '', timeIn: '', timeOut: '',
  inducted: false, ramsRead: false, ppeCompliant: false, signedIn: false,
  competencyConfirmed: false, ecsConfirmed: false, permitBriefed: false,
};

export function OperativeRows({ rows, onChange }: { rows: OperativeRecord[]; onChange: (rows: OperativeRecord[]) => void }) {
  const update = (i: number, field: keyof OperativeRecord, val: string | boolean) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const add = () => onChange([...rows, { ...DEFAULT_OPERATIVE }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const boolFields: { key: keyof OperativeRecord; label: string }[] = [
    { key: 'inducted',            label: 'Inducted' },
    { key: 'ramsRead',            label: 'RAMS Read' },
    { key: 'ppeCompliant',        label: 'PPE' },
    { key: 'signedIn',            label: 'Signed In' },
    { key: 'competencyConfirmed', label: 'Competency' },
    { key: 'ecsConfirmed',        label: 'ECS/CSCS' },
    { key: 'permitBriefed',       label: 'Permit Briefed' },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Operative {i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="text-slate-700 hover:text-red-400 transition-colors"><X size={13} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><label className={labelCls}>Name *</label>
              <input value={r.name} onChange={e => update(i, 'name', e.target.value)} className={inputCls} placeholder="Full name" /></div>
            <div><label className={labelCls}>Company</label>
              <input value={r.company} onChange={e => update(i, 'company', e.target.value)} className={inputCls} placeholder="Employer" /></div>
            <div><label className={labelCls}>Trade</label>
              <input value={r.trade} onChange={e => update(i, 'trade', e.target.value)} className={inputCls} placeholder="e.g. Electrician" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Time In</label>
              <input type="time" value={r.timeIn} onChange={e => update(i, 'timeIn', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Time Out</label>
              <input type="time" value={r.timeOut} onChange={e => update(i, 'timeOut', e.target.value)} className={inputCls} /></div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {boolFields.map(bf => (
              <button key={bf.key} type="button"
                onClick={() => update(i, bf.key, !r[bf.key])}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${r[bf.key] ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-transparent border-[#1e2d4a] text-slate-600 hover:border-slate-500'}`}>
                {bf.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="w-full py-2 border border-dashed border-[#1e2d4a] rounded-xl text-xs text-slate-600 hover:text-slate-400 hover:border-slate-500 transition-colors">
        + Add Operative
      </button>
    </div>
  );
}

// ─── Delays ───────────────────────────────────────────────────────────────────

export interface DelayRecord {
  delayType: string; description: string; areaAffected: string; tradeResponsible: string;
  startTime: string; duration: string; severity: string; programmeImpact: string;
  labourImpact: string; taggedUser: string; comment: string;
}
export const DEFAULT_DELAY: DelayRecord = {
  delayType: '', description: '', areaAffected: '', tradeResponsible: '',
  startTime: '', duration: '', severity: 'Medium', programmeImpact: '', labourImpact: '',
  taggedUser: '', comment: '',
};
export const DELAY_TYPES = [
  'Access Issue', "Builder's Works Incomplete", 'No Power Available', 'Design Issue',
  'Material Shortage', 'Trade Interference', 'Permit Issue', 'H&S Restriction',
  'Waiting for Instruction', 'Waiting for Client Decision', 'Client Hold Point', 'Weather', 'Other',
];

export function DelayRows({ rows, onChange, platformUsers }: { rows: DelayRecord[]; onChange: (rows: DelayRecord[]) => void; platformUsers: { name: string }[] }) {
  const update = (i: number, field: keyof DelayRecord, val: string) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const add = () => onChange([...rows, { ...DEFAULT_DELAY }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const severityColors: Record<string, string> = { Low: 'bg-emerald-600', Medium: 'bg-amber-500', High: 'bg-red-600', Critical: 'bg-red-700' };
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="bg-[#0d1628] border border-red-900/40 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-400">Delay / Issue {i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="text-slate-700 hover:text-red-400 transition-colors"><X size={13} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Delay Type</label>
              <div className="relative mt-1.5">
                <select value={r.delayType} onChange={e => update(i, 'delayType', e.target.value)} className={`${inputCls} mt-0 appearance-none pr-8`}>
                  <option value="">Select type...</option>
                  {DELAY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div><label className={labelCls}>Area Affected</label>
              <input value={r.areaAffected} onChange={e => update(i, 'areaAffected', e.target.value)} className={inputCls} placeholder="Location / floor / zone" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><label className={labelCls}>Trade Responsible</label>
              <input value={r.tradeResponsible} onChange={e => update(i, 'tradeResponsible', e.target.value)} className={inputCls} placeholder="e.g. Main Contractor" /></div>
            <div><label className={labelCls}>Start Time</label>
              <input type="time" value={r.startTime} onChange={e => update(i, 'startTime', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Duration</label>
              <input value={r.duration} onChange={e => update(i, 'duration', e.target.value)} className={inputCls} placeholder="e.g. 2 hrs" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className={labelCls}>Programme Impact</label>
              <input value={r.programmeImpact} onChange={e => update(i, 'programmeImpact', e.target.value)} className={inputCls} placeholder="e.g. 1 day delay to circuit 4" /></div>
            <div><label className={labelCls}>Labour Impact</label>
              <input value={r.labourImpact} onChange={e => update(i, 'labourImpact', e.target.value)} className={inputCls} placeholder="e.g. 2 engineers idle 3 hrs" /></div>
          </div>
          <div>
            <label className={labelCls}>Severity</label>
            <div className="flex gap-2 mt-1.5">
              {(['Low', 'Medium', 'High', 'Critical'] as const).map(s => (
                <button key={s} type="button" onClick={() => update(i, 'severity', s)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${r.severity === s ? `${severityColors[s]} border-transparent text-white` : 'bg-transparent border-[#1e2d4a] text-slate-600 hover:border-slate-500'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Tag Responsible Person</label>
            <div className="relative mt-1.5">
              <select value={r.taggedUser} onChange={e => update(i, 'taggedUser', e.target.value)} className={`${inputCls} mt-0 appearance-none pr-8`}>
                <option value="">None</option>
                {platformUsers.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Detailed Description</label>
            <textarea value={r.description} onChange={e => update(i, 'description', e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Full description of the delay or issue..." />
          </div>
          <div>
            <label className={labelCls}>Additional Comment</label>
            <textarea value={r.comment} onChange={e => update(i, 'comment', e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Mitigation, actions taken, escalation required..." />
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="w-full py-2 border border-dashed border-red-900/40 rounded-xl text-xs text-red-900 hover:text-red-400 hover:border-red-700/40 transition-colors">
        + Add Delay / Issue
      </button>
    </div>
  );
}

// ─── Risk Assessment Hazards ──────────────────────────────────────────────────

export interface HazardRecord {
  category: string;
  customCategory: string;
  hazardDescription: string;
  personsAtRisk: string;
  existingControls: string;
  initLikelihood: number;
  initSeverity: number;
  additionalControls: string;
  residualLikelihood: number;
  residualSeverity: number;
  responsiblePerson: string;
  actionRequired: string;
  comments: string;
}

export const DEFAULT_HAZARD: HazardRecord = {
  category: '', customCategory: '', hazardDescription: '', personsAtRisk: '',
  existingControls: '', initLikelihood: 3, initSeverity: 3,
  additionalControls: '', residualLikelihood: 2, residualSeverity: 2,
  responsiblePerson: '', actionRequired: '', comments: '',
};

export const HAZARD_CATEGORIES = [
  'Working at Height', 'Electrical Works', 'Manual Handling', 'Hot Works',
  'Confined Spaces', 'Temporary Electrics', 'Dust / Fumes', 'Noise / Vibration',
  'Slips / Trips / Falls', 'Plant Movement', 'Lifting Operations', 'Stored Pressure',
  'Hazardous Substances', 'Fire Risk', 'Excavations', 'Lone Working',
  'Access / Egress', 'Public Interface', 'Temporary Works', 'Structural Risks', 'Other',
];

const PERSONS_AT_RISK_OPTIONS = [
  'All Site Operatives', 'Electricians', 'Mechanical Engineers', 'Labourers',
  'Site Management', 'Sub-contractors', 'Visitors', 'Public', 'Client Staff',
];

export function riskScore(l: number, s: number) { return l * s; }
export function riskLabel(score: number): { label: string; bg: string; text: string; border: string } {
  if (score <= 4)  return { label: 'Low',      bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-600' };
  if (score <= 9)  return { label: 'Medium',   bg: 'bg-amber-500',   text: 'text-white', border: 'border-amber-500'  };
  if (score <= 16) return { label: 'High',     bg: 'bg-orange-600',  text: 'text-white', border: 'border-orange-600' };
  return                   { label: 'Critical', bg: 'bg-red-700',    text: 'text-white', border: 'border-red-700'    };
}

export function ScoreSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`w-7 h-7 rounded-md text-xs font-bold border transition-all ${value === n
            ? n <= 2 ? 'bg-emerald-600 border-emerald-600 text-white'
              : n === 3 ? 'bg-amber-500 border-amber-500 text-white'
              : n === 4 ? 'bg-orange-600 border-orange-600 text-white'
              : 'bg-red-700 border-red-700 text-white'
            : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500 hover:text-slate-300'}`}>
          {n}
        </button>
      ))}
    </div>
  );
}

export function HazardRows({ rows, onChange }: { rows: HazardRecord[]; onChange: (rows: HazardRecord[]) => void }) {
  const update = <K extends keyof HazardRecord>(i: number, field: K, val: HazardRecord[K]) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const add = () => onChange([...rows, { ...DEFAULT_HAZARD }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      {rows.map((r, i) => {
        const initScore  = riskScore(r.initLikelihood, r.initSeverity);
        const residScore = riskScore(r.residualLikelihood, r.residualSeverity);
        const initRisk   = riskLabel(initScore);
        const residRisk  = riskLabel(residScore);
        return (
          <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#1a2236] border-b border-[#1e2d4a]">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hazard {i + 1}</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${initRisk.bg} ${initRisk.text}`}>
                  Initial: {initScore} — {initRisk.label}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${residRisk.bg} ${residRisk.text}`}>
                  Residual: {residScore} — {residRisk.label}
                </span>
              </div>
              <button type="button" onClick={() => remove(i)} className="text-slate-700 hover:text-red-400 transition-colors p-0.5">
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Hazard Category</label>
                  <div className="relative mt-1.5">
                    <select value={r.category} onChange={e => update(i, 'category', e.target.value)}
                      className={`${inputCls} mt-0 appearance-none pr-8`}>
                      <option value="">Select category...</option>
                      {HAZARD_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Persons at Risk</label>
                  <div className="relative mt-1.5">
                    <select value={r.personsAtRisk} onChange={e => update(i, 'personsAtRisk', e.target.value)}
                      className={`${inputCls} mt-0 appearance-none pr-8`}>
                      <option value="">Select...</option>
                      {PERSONS_AT_RISK_OPTIONS.map(p => <option key={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Hazard Description *</label>
                <textarea value={r.hazardDescription} onChange={e => update(i, 'hazardDescription', e.target.value)}
                  rows={2} className={`${inputCls} resize-none`} placeholder="Describe the specific hazard in detail..." />
              </div>
              <div>
                <label className={labelCls}>Existing Control Measures</label>
                <textarea value={r.existingControls} onChange={e => update(i, 'existingControls', e.target.value)}
                  rows={2} className={`${inputCls} resize-none`} placeholder="Controls already in place before additional measures..." />
              </div>
              <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Initial Risk Rating</p>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${initRisk.bg} ${initRisk.text} ${initRisk.border}`}>
                    {initScore} — {initRisk.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Likelihood (1–5)</label>
                    <div className="mt-2"><ScoreSelector value={r.initLikelihood} onChange={v => update(i, 'initLikelihood', v)} /></div>
                  </div>
                  <div>
                    <label className={labelCls}>Severity (1–5)</label>
                    <div className="mt-2"><ScoreSelector value={r.initSeverity} onChange={v => update(i, 'initSeverity', v)} /></div>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Additional Control Measures Required</label>
                <textarea value={r.additionalControls} onChange={e => update(i, 'additionalControls', e.target.value)}
                  rows={2} className={`${inputCls} resize-none`} placeholder="Specific controls to reduce residual risk..." />
              </div>
              <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Residual Risk Rating</p>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${residRisk.bg} ${residRisk.text} ${residRisk.border}`}>
                    {residScore} — {residRisk.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Residual Likelihood (1–5)</label>
                    <div className="mt-2"><ScoreSelector value={r.residualLikelihood} onChange={v => update(i, 'residualLikelihood', v)} /></div>
                  </div>
                  <div>
                    <label className={labelCls}>Residual Severity (1–5)</label>
                    <div className="mt-2"><ScoreSelector value={r.residualSeverity} onChange={v => update(i, 'residualSeverity', v)} /></div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Responsible Person</label>
                  <input value={r.responsiblePerson} onChange={e => update(i, 'responsiblePerson', e.target.value)}
                    className={inputCls} placeholder="Name / role" />
                </div>
                <div>
                  <label className={labelCls}>Action Required</label>
                  <input value={r.actionRequired} onChange={e => update(i, 'actionRequired', e.target.value)}
                    className={inputCls} placeholder="Specific action item..." />
                </div>
              </div>
              <div>
                <label className={labelCls}>Comments</label>
                <input value={r.comments} onChange={e => update(i, 'comments', e.target.value)}
                  className={inputCls} placeholder="Any additional notes..." />
              </div>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={add}
        className="w-full py-2.5 border border-dashed border-orange-900/50 rounded-xl text-xs text-orange-900 hover:text-orange-400 hover:border-orange-700/60 transition-colors font-semibold">
        + Add Hazard
      </button>
    </div>
  );
}

// ─── RAMS Sign-Off ────────────────────────────────────────────────────────────

export interface RamsSignOffRecord {
  name: string; company: string; role: string; date: string;
  ramsRead: boolean; briefingCompleted: boolean;
}
export const DEFAULT_RAMS_SIGNOFF: RamsSignOffRecord = {
  name: '', company: '', role: '', date: '',
  ramsRead: false, briefingCompleted: false,
};

export function RamsSignOffRows({ rows, onChange }: { rows: RamsSignOffRecord[]; onChange: (rows: RamsSignOffRecord[]) => void }) {
  const update = <K extends keyof RamsSignOffRecord>(i: number, field: K, val: RamsSignOffRecord[K]) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const add = () => onChange([...rows, { ...DEFAULT_RAMS_SIGNOFF, date: new Date().toISOString().split('T')[0] }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Signatory {i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="text-slate-700 hover:text-red-400 transition-colors"><X size={13} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><label className={labelCls}>Full Name *</label>
              <input value={r.name} onChange={e => update(i, 'name', e.target.value)} className={inputCls} placeholder="Full name" /></div>
            <div><label className={labelCls}>Company</label>
              <input value={r.company} onChange={e => update(i, 'company', e.target.value)} className={inputCls} placeholder="Employer" /></div>
            <div><label className={labelCls}>Role / Trade</label>
              <input value={r.role} onChange={e => update(i, 'role', e.target.value)} className={inputCls} placeholder="e.g. Electrician" /></div>
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={r.date} onChange={e => update(i, 'date', e.target.value)} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => update(i, 'ramsRead', !r.ramsRead)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${r.ramsRead ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-transparent border-[#1e2d4a] text-slate-600 hover:border-slate-500'}`}>
              {r.ramsRead ? '✓ RAMS Read & Understood' : 'RAMS Read & Understood'}
            </button>
            <button type="button" onClick={() => update(i, 'briefingCompleted', !r.briefingCompleted)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${r.briefingCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-transparent border-[#1e2d4a] text-slate-600 hover:border-slate-500'}`}>
              {r.briefingCompleted ? '✓ Briefing Completed' : 'Briefing Completed'}
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="w-full py-2 border border-dashed border-[#1e2d4a] rounded-xl text-xs text-slate-600 hover:text-slate-400 hover:border-slate-500 transition-colors">
        + Add Signatory
      </button>
    </div>
  );
}

// ─── Checklist view helper (read-only, used in ViewModal) ────────────────────

export function ChecklistResultBadge({ result }: { result: string }) {
  const cls = result === 'Pass' ? 'bg-emerald-900/60 text-emerald-300'
    : result === 'Fail' ? 'bg-red-900/60 text-red-300'
    : 'bg-slate-700 text-slate-400';
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>{result}</span>;
}

// Reusable view field for ViewModal
export function ViewField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export function ViewFieldInline({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3">
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

// ─── Inline useState wrapper for SWA checklist display ───────────────────────

export function SWAChecklistView({ checklistJson }: { checklistJson?: string }) {
  if (!checklistJson) return null;
  let checklist: Record<string, ChecklistEntry> = {};
  try { checklist = JSON.parse(checklistJson); } catch { return null; }
  const entries = Object.entries(checklist).filter(([, v]) => v.result !== 'N/A' || v.comment || v.action);
  if (!entries.length) return null;
  return (
    <div className="space-y-1.5">
      {entries.map(([key, v]) => (
        <div key={key} className="flex items-start gap-2 py-1.5 border-b border-[#1e2d4a]/50 last:border-0">
          <ChecklistResultBadge result={v.result} />
          {v.action && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-900/60 text-amber-300">Action</span>}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">{key.replace(/_/g, ' ')}</p>
            {v.comment && <p className="text-xs text-slate-500 mt-0.5 italic">{v.comment}</p>}
            {(v.responsible || v.closeDate) && (
              <p className="text-[10px] text-slate-600 mt-0.5">
                {v.responsible && `Responsible: ${v.responsible}`}
                {v.responsible && v.closeDate && ' · '}
                {v.closeDate && `Close by: ${v.closeDate}`}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Plant Asset Register ─────────────────────────────────────────────────────

export interface PlantAssetRecord {
  assetType: string;
  assetRef: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  valveNumber: string;
  assetTag: string;
  location: string;
  installedCorrectly: string;
  accessible: string;
  comments: string;
}

export const DEFAULT_PLANT_ASSET: PlantAssetRecord = {
  assetType: 'Pump',
  assetRef: '', manufacturer: '', model: '', serialNumber: '',
  valveNumber: '', assetTag: '', location: '',
  installedCorrectly: 'Yes', accessible: 'Yes',
  comments: '',
};

export const PLANT_ASSET_TYPES = [
  'Pump', 'Buffer Vessel', 'Expansion Vessel', 'Pressurisation Unit',
  'Heat Exchanger', 'Plate Heat Exchanger', 'Heat Meter', 'Water Meter',
  'Dirt Separator', 'Air Separator', 'Control Valve', 'PICV',
  'Balancing Valve', 'Motorised Valve', 'Isolation Valve', 'Safety Valve',
  'Sensor', 'BMS Device', 'Other',
];

export function PlantAssetRows({ rows, onChange }: { rows: PlantAssetRecord[]; onChange: (rows: PlantAssetRecord[]) => void }) {
  const update = (i: number, field: keyof PlantAssetRecord, val: string) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const add = () => onChange([...rows, { ...DEFAULT_PLANT_ASSET }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      {rows.map((r, i) => (
        <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-400">
              Asset {i + 1}{r.assetType ? ` — ${r.assetType}` : ''}{r.assetRef ? ` · ${r.assetRef}` : ''}
            </span>
            <button type="button" onClick={() => remove(i)} className="text-slate-700 hover:text-red-400 transition-colors"><X size={13} /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Asset Type</label>
              <div className="relative mt-1.5">
                <select value={r.assetType} onChange={e => update(i, 'assetType', e.target.value)} className={`${inputCls} mt-0 appearance-none pr-8`}>
                  {PLANT_ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Asset Reference</label>
              <input value={r.assetRef} onChange={e => update(i, 'assetRef', e.target.value)} className={inputCls} placeholder="e.g. P-01, BV-03" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Manufacturer</label>
              <input value={r.manufacturer} onChange={e => update(i, 'manufacturer', e.target.value)} className={inputCls} placeholder="Make" />
            </div>
            <div>
              <label className={labelCls}>Model</label>
              <input value={r.model} onChange={e => update(i, 'model', e.target.value)} className={inputCls} placeholder="Model no." />
            </div>
            <div>
              <label className={labelCls}>Serial Number</label>
              <input value={r.serialNumber} onChange={e => update(i, 'serialNumber', e.target.value)} className={inputCls} placeholder="Serial no." />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Valve Number</label>
              <input value={r.valveNumber} onChange={e => update(i, 'valveNumber', e.target.value)} className={inputCls} placeholder="e.g. V-14" />
            </div>
            <div>
              <label className={labelCls}>Asset Tag</label>
              <input value={r.assetTag} onChange={e => update(i, 'assetTag', e.target.value)} className={inputCls} placeholder="Tag ref" />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input value={r.location} onChange={e => update(i, 'location', e.target.value)} className={inputCls} placeholder="Plantroom area" />
            </div>
          </div>

          <div className="flex gap-6">
            {(['installedCorrectly', 'accessible'] as const).map(field => (
              <div key={field}>
                <label className={labelCls}>{field === 'installedCorrectly' ? 'Installed Correctly' : 'Accessible'}</label>
                <div className="flex gap-2 mt-1.5">
                  {['Yes', 'No'].map(v => (
                    <button key={v} type="button" onClick={() => update(i, field, v)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${r[field] === v ? (v === 'Yes' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-red-700 border-red-700 text-white') : 'bg-transparent border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className={labelCls}>Comments</label>
            <input value={r.comments} onChange={e => update(i, 'comments', e.target.value)} className={inputCls} placeholder="Any observations or defects" />
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="w-full py-2.5 border border-dashed border-[#1e2d4a] rounded-xl text-xs text-slate-600 hover:text-slate-400 hover:border-sky-700/60 transition-colors">
        + Add Asset
      </button>
    </div>
  );
}

// ─── Plant Defect / Outstanding Works ─────────────────────────────────────────

export interface PlantDefectRecord {
  description: string;
  responsiblePerson: string;
  dueDate: string;
  status: string;
}

export const DEFAULT_PLANT_DEFECT: PlantDefectRecord = {
  description: '', responsiblePerson: '', dueDate: '', status: 'Open',
};

export const PLANT_DEFECT_STATUSES = ['Open', 'In Progress', 'Complete', 'Closed'];

export function PlantDefectRows({ rows, onChange }: { rows: PlantDefectRecord[]; onChange: (rows: PlantDefectRecord[]) => void }) {
  const update = (i: number, field: keyof PlantDefectRecord, val: string) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const add = () => onChange([...rows, { ...DEFAULT_PLANT_DEFECT }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  const statusColors: Record<string, string> = {
    Open: 'bg-red-700 border-red-700 text-white',
    'In Progress': 'bg-amber-500 border-amber-500 text-white',
    Complete: 'bg-emerald-600 border-emerald-600 text-white',
    Closed: 'bg-slate-600 border-slate-600 text-white',
  };

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="bg-[#0d1628] border border-amber-900/40 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400">Defect {i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="text-slate-700 hover:text-red-400 transition-colors"><X size={13} /></button>
          </div>
          <div>
            <label className={labelCls}>Description *</label>
            <input value={r.description} onChange={e => update(i, 'description', e.target.value)} className={inputCls} placeholder="Describe the defect or outstanding work" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Responsible Person</label>
              <input value={r.responsiblePerson} onChange={e => update(i, 'responsiblePerson', e.target.value)} className={inputCls} placeholder="Name" />
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" value={r.dueDate} onChange={e => update(i, 'dueDate', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <div className="flex gap-2 mt-1.5">
              {PLANT_DEFECT_STATUSES.map(s => (
                <button key={s} type="button" onClick={() => update(i, 'status', s)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${r.status === s ? statusColors[s] ?? 'bg-slate-600 border-slate-600 text-white' : 'bg-transparent border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="w-full py-2 border border-dashed border-[#1e2d4a] rounded-xl text-xs text-slate-600 hover:text-slate-400 hover:border-amber-700/60 transition-colors">
        + Add Defect / Outstanding Work
      </button>
    </div>
  );
}

// ─── Temperature Water Readings ───────────────────────────────────────────────

export interface TWRReadingRecord {
  id: string;
  area: string;
  description: string;
  temp20s: string;
  temp60s: string;
  passFail: string;
  notes: string;
}

export const DEFAULT_TWR_READING: TWRReadingRecord = {
  id: '', area: '', description: '', temp20s: '', temp60s: '', passFail: 'Pass', notes: '',
};

export function TWRReadingRows({ rows, onChange }: { rows: TWRReadingRecord[]; onChange: (rows: TWRReadingRecord[]) => void }) {
  const update = (i: number, field: keyof TWRReadingRecord, val: string) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const add = () => onChange([...rows, { ...DEFAULT_TWR_READING, id: `R${rows.length + 1}` }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400">Reading {i + 1}{r.id ? ` — ${r.id}` : ''}</span>
            <button type="button" onClick={() => remove(i)} className="text-slate-700 hover:text-red-400 transition-colors"><X size={13} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Point ID / Ref</label>
              <input value={r.id} onChange={e => update(i, 'id', e.target.value)} className={inputCls} placeholder="e.g. CW-01" />
            </div>
            <div>
              <label className={labelCls}>Area / Location</label>
              <input value={r.area} onChange={e => update(i, 'area', e.target.value)} className={inputCls} placeholder="e.g. Floor 2, Riser B" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Outlet / Service Description</label>
            <input value={r.description} onChange={e => update(i, 'description', e.target.value)} className={inputCls} placeholder="e.g. Basin tap, shower, calorifier outlet..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Temp @ 20s (°C)</label>
              <input value={r.temp20s} onChange={e => update(i, 'temp20s', e.target.value)} className={inputCls} placeholder="°C" />
            </div>
            <div>
              <label className={labelCls}>Temp @ 60s (°C)</label>
              <input value={r.temp60s} onChange={e => update(i, 'temp60s', e.target.value)} className={inputCls} placeholder="°C" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Pass / Fail</label>
            <div className="flex gap-2 mt-1.5">
              {(['Pass', 'Fail', 'N/A'] as const).map(v => (
                <button key={v} type="button" onClick={() => update(i, 'passFail', v)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${r.passFail === v
                    ? v === 'Pass' ? 'bg-emerald-600 border-emerald-600 text-white'
                      : v === 'Fail' ? 'bg-red-700 border-red-700 text-white'
                      : 'bg-slate-600 border-slate-600 text-white'
                    : 'bg-transparent border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <input value={r.notes} onChange={e => update(i, 'notes', e.target.value)} className={inputCls} placeholder="Observations, remedial actions..." />
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="w-full py-2 border border-dashed border-blue-900/40 rounded-xl text-xs text-blue-900 hover:text-blue-400 hover:border-blue-700/40 transition-colors">
        + Add Reading
      </button>
    </div>
  );
}
