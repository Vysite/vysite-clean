import { useState } from 'react';
import { X, FileText, ChevronDown, Search, Calendar, CreditCard as Edit2, Trash2, LayoutGrid, List, Printer, Wrench, Zap, DollarSign, CheckSquare, HardHat, Users } from 'lucide-react';
import { openPrintTab, buildPrintDocument } from '../lib/printTab';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { type SiteForm, type FormType, type FormStatus } from '../data/types';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import type { DBSiteForm } from '../lib/store';
import FileUploadComponent, { type UploadedFile } from '../components/FileUpload';

// ─── Extended Types ──────────────────────────────────────────────────────────
type ExtendedFormType = FormType | 'RFI' | 'Hold Up Notice' | 'H&S Inspection' | 'Delay Notice' | 'Variation' | 'Early Warning Notice' | 'Site Instruction' | 'Technical Query' | 'Pressure Test' | 'Flushing Record' | 'Valve Checklist' | 'AHU Commissioning' | 'Dead Testing' | 'Continuity Test' | 'Toolbox Talk' | 'Site Walk Audit' | 'Electrical Commissioning Report' | 'Risk Assessment';
type ExtendedFormStatus = FormStatus | 'Issued' | 'Awaiting Response' | 'Closed' | 'Resolved' | 'Escalated' | 'Action Required';

interface ExtendedSiteForm extends Omit<SiteForm, 'type' | 'status'> {
  type: ExtendedFormType;
  status: ExtendedFormStatus;
  title?: string;
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
  // Pressure Test extras
  plotArea?: string;
  systemService?: string;
  pipeworkDescription?: string;
  testMedium?: string;
  testPressure?: string;
  testPressureUnit?: string;
  startTime?: string;
  endTime?: string;
  durationOnTest?: string;
  testResult?: string;
  witnessedBy?: string;
  engineer?: string;
  company?: string;
  observations?: string;
  // Flushing Record extras
  flushMedium?: string;
  flushTemperature?: string;
  flushDuration?: string;
  turbidity?: string;
  chlorineResidual?: string;
  flushResult?: string;
  flushWitnessedBy?: string;
  // Valve Checklist extras
  valveTag?: string;
  valveType?: string;
  valveSize?: string;
  valveLocation?: string;
  operationCheck?: string;
  seatLeakageCheck?: string;
  glandLeakageCheck?: string;
  positionIndicator?: string;
  actuatorCheck?: string;
  overallCondition?: string;
  // AHU Commissioning extras
  ahuTag?: string;
  ahuLocation?: string;
  supplyAirflow?: string;
  returnAirflow?: string;
  supplyFanAmps?: string;
  returnFanAmps?: string;
  filterCondition?: string;
  beltCondition?: string;
  dampersOperation?: string;
  condensateTray?: string;
  vibrationCheck?: string;
  coilCondition?: string;
  setpointTemp?: string;
  measuredTemp?: string;
  ahuResult?: string;
  // Dead Testing extras
  circuitRef?: string;
  testInstrument?: string;
  insulationPhaseL1?: string;
  insulationPhaseL2?: string;
  insulationPhaseL3?: string;
  insulationNeutral?: string;
  continuityRing?: string;
  earthFault?: string;
  polarity?: string;
  deadTestResult?: string;
  deadTestWitness?: string;
  // Continuity Test extras
  conductorRef?: string;
  conductorType?: string;
  conductorLength?: string;
  measuredResistance?: string;
  calculatedResistance?: string;
  deviationPercent?: string;
  continuityResult?: string;
  continuityWitness?: string;
  // Toolbox Talk extras
  tbtTopic?: string;
  tbtDuration?: string;
  tbtLocation?: string;
  tbtPresentedBy?: string;
  tbtAttendees?: string;
  tbtKeyPoints?: string;
  tbtActionItems?: string;
  tbtSignOff?: string;
  // Site Walk Audit extras
  swaSiteArea?: string;
  swaAuditTime?: string;
  swaAuditorName?: string;
  swaWeather?: string;
  swaTradeTeam?: string;
  swaSiteManager?: string;
  swaOverallStatus?: string;
  swaPositiveObservations?: string;
  swaKeyRisks?: string;
  swaImmediateActions?: string;
  swaFurtherActions?: string;
  swaResponsiblePerson?: string;
  swaCloseOutDate?: string;
  swaReinspectionRequired?: string;
  swaReinspectionDate?: string;
  swaOverallComments?: string;
  // Checklist stored as JSON string: Record<itemKey, {result,comment,action,responsible,closeDate}>
  swaChecklist?: string;
  // Electrical Commissioning Report extras
  ecrShift?: string;
  ecrLeadEngineer?: string;
  ecrCompany?: string;
  ecrMainContractor?: string;
  ecrSystemBeingCommissioned?: string;
  ecrPermitRefs?: string;
  ecrOverallStatus?: string;
  ecrWeather?: string;
  ecrSiteArea?: string;
  ecrTicketRef?: string;
  ecrAttendees?: string;          // JSON: OperativeRecord[]
  ecrActivities?: string;         // JSON: ActivityRecord[]
  ecrDelays?: string;             // JSON: DelayRecord[]
  ecrProgressLabour?: string;
  ecrAreasCompleted?: string;
  ecrAreasInProgress?: string;
  ecrAreasDelayed?: string;
  ecrPercentProgress?: string;
  ecrPlannedWorks?: string;
  ecrActualWorks?: string;
  ecrKeyAchievements?: string;
  ecrKeyBlockers?: string;
  ecrTomorrowWorks?: string;
  ecrRequiredSupport?: string;
  ecrQaChecklist?: string;        // JSON: QAItem[]
  ecrQaComments?: string;
  ecrSignLead?: string;
  ecrSignWitness?: string;
  ecrSignSiteManager?: string;
  ecrSignContractor?: string;
  ecrOverallComments?: string;
  // Daily Site Report (upgraded) extras
  dsrSiteManager?: string;
  dsrWeather?: string;
  dsrTemperature?: string;
  dsrSiteConditions?: string;
  dsrOperativesOnSite?: string;
  dsrAttendees?: string;          // JSON: OperativeRecord[]
  dsrAreasWorkedIn?: string;
  dsrWorksCompleted?: string;
  dsrSystemsWorkedOn?: string;
  dsrEquipmentWorkedOn?: string;
  dsrTestingCompleted?: string;
  dsrMaterialsInstalled?: string;
  dsrIssuesEncountered?: string;
  dsrSnagsIdentified?: string;
  dsrAccessRestrictions?: string;
  dsrFollowOnWorks?: string;
  dsrPlanCompleted?: string;
  dsrDelaysEncountered?: string;
  dsrWaitingOtherTrades?: string;
  dsrWaitingMaterials?: string;
  dsrAdditionalWorks?: string;
  dsrVariationPotential?: string;
  dsrRevisitRequired?: string;
  dsrFurtherLabour?: string;
  dsrDelays?: string;             // JSON: DelayRecord[]
  dsrDeliveries?: string;
  dsrPlantEquipment?: string;
  dsrMaterialsUsed?: string;
  dsrMissingMaterials?: string;
  dsrHseObservations?: string;
  dsrIncidents?: string;
  dsrPermits?: string;
  dsrVisitors?: string;
  dsrTomorrowPlanned?: string;
  dsrCommercialObservations?: string;
  dsrSupervisorNotes?: string;
  dsrSignEngineer?: string;
  dsrSignSupervisor?: string;
  dsrStartTime?: string;
  dsrFinishTime?: string;
  dsrBreakDuration?: string;
  dsrTotalHours?: string;
  dsrOvertimeHours?: string;
  // Risk Assessment / RAMS
  ramsRef?: string;
  ramsRevision?: string;
  ramsAuthor?: string;
  ramsCompany?: string;
  ramsPrincipalContractor?: string;
  ramsClient?: string;
  ramsTradePackage?: string;
  ramsActivityDescription?: string;
  ramsLocationOfWorks?: string;
  ramsPermitRequirements?: string;
  ramsReviewDate?: string;
  ramsApprovedBy?: string;
  ramsDistribution?: string;
  ramsScopeOfWorks?: string;
  ramsSequenceOfWorks?: string;
  ramsAccessArrangements?: string;
  ramsWorkingHours?: string;
  ramsTradeInterfaces?: string;
  ramsRestrictedAreas?: string;
  ramsTemporaryWorks?: string;
  ramsIsolations?: string;
  ramsPlantEquipment?: string;
  ramsHazards?: string;         // JSON: HazardRecord[]
  ramsPpe?: string;
  ramsPermitsRequired?: string;
  ramsIsolationProcedure?: string;
  ramsEmergencyProcedure?: string;
  ramsFirstAid?: string;
  ramsFireArrangements?: string;
  ramsEnvironmentalControls?: string;
  ramsWelfareArrangements?: string;
  ramsSupervisionRequirements?: string;
  ramsCompetencyRequirements?: string;
  ramsInspectionRequirements?: string;
  ramsSignOffs?: string;        // JSON: RamsSignOffRecord[]
  ramsPreparedBy?: string;
  ramsReviewedBy?: string;
  ramsRevisionNotes?: string;
  ramsOverallRiskRating?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  'Pressure Test':     { bg: 'bg-blue-900/60',   text: 'text-blue-300',   label: 'Pressure Test',    border: 'border-l-blue-500' },
  'Flushing Record':   { bg: 'bg-cyan-900/60',   text: 'text-cyan-300',   label: 'Flushing Record',  border: 'border-l-cyan-500' },
  'Valve Checklist':   { bg: 'bg-indigo-900/60', text: 'text-indigo-300', label: 'Valve Checklist',  border: 'border-l-indigo-500' },
  'AHU Commissioning': { bg: 'bg-violet-900/60', text: 'text-violet-300', label: 'AHU Commissioning',border: 'border-l-violet-500' },
  'Dead Testing':      { bg: 'bg-yellow-900/60', text: 'text-yellow-300', label: 'Dead Testing',     border: 'border-l-yellow-500' },
  'Continuity Test':   { bg: 'bg-lime-900/60',   text: 'text-lime-300',   label: 'Continuity Test',  border: 'border-l-lime-500' },
  'Toolbox Talk':      { bg: 'bg-amber-900/60',  text: 'text-amber-300',  label: 'Toolbox Talk',     border: 'border-l-amber-500' },
  'Site Walk Audit':          { bg: 'bg-rose-900/60',    text: 'text-rose-300',    label: 'Site Walk Audit',          border: 'border-l-rose-500' },
  'Electrical Commissioning Report':{ bg: 'bg-yellow-900/60',  text: 'text-yellow-300',  label: 'Elec Commissioning',  border: 'border-l-yellow-400' },
  'Risk Assessment':                { bg: 'bg-orange-900/60',  text: 'text-orange-300',  label: 'Risk Assessment',      border: 'border-l-orange-400' },
};


let rfiCounter = 1;
function nextRfiRef() {
  return `RFI-${String(rfiCounter++).padStart(3, '0')}`;
}

// ─── CSS helpers ─────────────────────────────────────────────────────────────
const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

// ─── Site Walk Audit sub-components (stable — must be outside FormBuilder) ────
type ChecklistEntry = { result: string; comment: string; action: boolean; responsible: string; closeDate: string };

const SWA_DEFAULT_ENTRY: ChecklistEntry = { result: 'N/A', comment: '', action: false, responsible: '', closeDate: '' };

interface CheckItemProps {
  itemKey: string;
  label: string;
  entry: ChecklistEntry;
  onUpdate: (key: string, field: keyof ChecklistEntry, value: string | boolean) => void;
}

function SWACheckItem({ itemKey, label, entry, onUpdate }: CheckItemProps) {
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

function SWASection({ title, items, checklist, onUpdate }: SWASectionProps) {
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

// ─── Shared operational sub-components ───────────────────────────────────────

export interface OperativeRecord {
  name: string; company: string; trade: string; timeIn: string; timeOut: string;
  inducted: boolean; ramsRead: boolean; ppeCompliant: boolean; signedIn: boolean;
  competencyConfirmed: boolean; ecsConfirmed: boolean; permitBriefed: boolean;
}
const DEFAULT_OPERATIVE: OperativeRecord = {
  name: '', company: '', trade: '', timeIn: '', timeOut: '',
  inducted: false, ramsRead: false, ppeCompliant: false, signedIn: false,
  competencyConfirmed: false, ecsConfirmed: false, permitBriefed: false,
};

function OperativeRows({ rows, onChange }: { rows: OperativeRecord[]; onChange: (rows: OperativeRecord[]) => void }) {
  const update = (i: number, field: keyof OperativeRecord, val: string | boolean) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const add = () => onChange([...rows, { ...DEFAULT_OPERATIVE }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const boolFields: { key: keyof OperativeRecord; label: string }[] = [
    { key: 'inducted',           label: 'Inducted' },
    { key: 'ramsRead',           label: 'RAMS Read' },
    { key: 'ppeCompliant',       label: 'PPE' },
    { key: 'signedIn',           label: 'Signed In' },
    { key: 'competencyConfirmed',label: 'Competency' },
    { key: 'ecsConfirmed',       label: 'ECS/CSCS' },
    { key: 'permitBriefed',      label: 'Permit Briefed' },
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

export interface DelayRecord {
  delayType: string; description: string; areaAffected: string; tradeResponsible: string;
  startTime: string; duration: string; severity: string; programmeImpact: string;
  labourImpact: string; taggedUser: string; comment: string;
}
const DEFAULT_DELAY: DelayRecord = {
  delayType: '', description: '', areaAffected: '', tradeResponsible: '',
  startTime: '', duration: '', severity: 'Medium', programmeImpact: '', labourImpact: '',
  taggedUser: '', comment: '',
};
const DELAY_TYPES = ['Access Issue', "Builder's Works Incomplete", 'No Power Available', 'Design Issue',
  'Material Shortage', 'Trade Interference', 'Permit Issue', 'H&S Restriction', 'Waiting for Instruction',
  'Waiting for Client Decision', 'Client Hold Point', 'Weather', 'Other'];

function DelayRows({ rows, onChange, platformUsers }: { rows: DelayRecord[]; onChange: (rows: DelayRecord[]) => void; platformUsers: { name: string }[] }) {
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

// ─── Risk Assessment sub-components ──────────────────────────────────────────

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

const DEFAULT_HAZARD: HazardRecord = {
  category: '', customCategory: '', hazardDescription: '', personsAtRisk: '',
  existingControls: '', initLikelihood: 3, initSeverity: 3,
  additionalControls: '', residualLikelihood: 2, residualSeverity: 2,
  responsiblePerson: '', actionRequired: '', comments: '',
};

const HAZARD_CATEGORIES = [
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

function riskScore(l: number, s: number) { return l * s; }
function riskLabel(score: number): { label: string; bg: string; text: string; border: string } {
  if (score <= 4)  return { label: 'Low',      bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-600' };
  if (score <= 9)  return { label: 'Medium',   bg: 'bg-amber-500',   text: 'text-white', border: 'border-amber-500'  };
  if (score <= 16) return { label: 'High',     bg: 'bg-orange-600',  text: 'text-white', border: 'border-orange-600' };
  return               { label: 'Critical', bg: 'bg-red-700',    text: 'text-white', border: 'border-red-700'    };
}

function ScoreSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
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

function HazardRows({ rows, onChange }: { rows: HazardRecord[]; onChange: (rows: HazardRecord[]) => void }) {
  const update = <K extends keyof HazardRecord>(i: number, field: K, val: HazardRecord[K]) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const add = () => onChange([...rows, { ...DEFAULT_HAZARD }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      {rows.map((r, i) => {
        const initScore = riskScore(r.initLikelihood, r.initSeverity);
        const residScore = riskScore(r.residualLikelihood, r.residualSeverity);
        const initRisk = riskLabel(initScore);
        const residRisk = riskLabel(residScore);
        return (
          <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl overflow-hidden">
            {/* Row header */}
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
              {/* Category + Description */}
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

              {/* Initial Risk */}
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
                    <div className="mt-2">
                      <ScoreSelector value={r.initLikelihood} onChange={v => update(i, 'initLikelihood', v)} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Severity (1–5)</label>
                    <div className="mt-2">
                      <ScoreSelector value={r.initSeverity} onChange={v => update(i, 'initSeverity', v)} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Additional Control Measures Required</label>
                <textarea value={r.additionalControls} onChange={e => update(i, 'additionalControls', e.target.value)}
                  rows={2} className={`${inputCls} resize-none`} placeholder="Specific controls to reduce residual risk..." />
              </div>

              {/* Residual Risk */}
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
                    <div className="mt-2">
                      <ScoreSelector value={r.residualLikelihood} onChange={v => update(i, 'residualLikelihood', v)} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Residual Severity (1–5)</label>
                    <div className="mt-2">
                      <ScoreSelector value={r.residualSeverity} onChange={v => update(i, 'residualSeverity', v)} />
                    </div>
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

export interface RamsSignOffRecord {
  name: string; company: string; role: string; date: string;
  ramsRead: boolean; briefingCompleted: boolean;
}
const DEFAULT_RAMS_SIGNOFF: RamsSignOffRecord = {
  name: '', company: '', role: '', date: '',
  ramsRead: false, briefingCompleted: false,
};

function RamsSignOffRows({ rows, onChange }: { rows: RamsSignOffRecord[]; onChange: (rows: RamsSignOffRecord[]) => void }) {
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

// ─── Form Builder ─────────────────────────────────────────────────────────────
interface FormBuilderProps {
  type: ExtendedFormType;
  onClose: () => void;
  onSave: (form: ExtendedSiteForm, files: UploadedFile[]) => void;
}

function FormBuilder({ type, onClose, onSave }: FormBuilderProps) {
  const store = useAppStore();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [form, setForm] = useState<Record<string, string>>({
    title: '',
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
    // Pressure Test
    plotArea: '',
    systemService: '',
    pipeworkDescription: '',
    testMedium: 'Water',
    testPressure: '',
    testPressureUnit: 'bar',
    startTime: '',
    endTime: '',
    durationOnTest: '',
    testResult: 'Pass',
    witnessedBy: '',
    engineer: '',
    company: '',
    observations: '',
    // Flushing Record
    flushMedium: 'Mains Water',
    flushTemperature: '',
    flushDuration: '',
    turbidity: '',
    chlorineResidual: '',
    flushResult: 'Pass',
    flushWitnessedBy: '',
    // Valve Checklist
    valveTag: '',
    valveType: '',
    valveSize: '',
    valveLocation: '',
    operationCheck: 'Pass',
    seatLeakageCheck: 'Pass',
    glandLeakageCheck: 'Pass',
    positionIndicator: 'Satisfactory',
    actuatorCheck: 'N/A',
    overallCondition: 'Satisfactory',
    // AHU Commissioning
    ahuTag: '',
    ahuLocation: '',
    supplyAirflow: '',
    returnAirflow: '',
    supplyFanAmps: '',
    returnFanAmps: '',
    filterCondition: 'Clean',
    beltCondition: 'Satisfactory',
    dampersOperation: 'Satisfactory',
    condensateTray: 'Clean',
    vibrationCheck: 'Satisfactory',
    coilCondition: 'Satisfactory',
    setpointTemp: '',
    measuredTemp: '',
    ahuResult: 'Pass',
    // Dead Testing
    circuitRef: '',
    testInstrument: '',
    insulationPhaseL1: '',
    insulationPhaseL2: '',
    insulationPhaseL3: '',
    insulationNeutral: '',
    continuityRing: '',
    earthFault: '',
    polarity: 'Correct',
    deadTestResult: 'Pass',
    deadTestWitness: '',
    // Continuity Test
    conductorRef: '',
    conductorType: '',
    conductorLength: '',
    measuredResistance: '',
    calculatedResistance: '',
    deviationPercent: '',
    continuityResult: 'Pass',
    continuityWitness: '',
    // Toolbox Talk
    tbtTopic: '',
    tbtDuration: '',
    tbtLocation: '',
    tbtPresentedBy: '',
    tbtAttendees: '',
    tbtKeyPoints: '',
    tbtActionItems: '',
    tbtSignOff: '',
    // Site Walk Audit
    swaSiteArea: '',
    swaAuditTime: '',
    swaAuditorName: '',
    swaWeather: '',
    swaTradeTeam: '',
    swaSiteManager: '',
    swaOverallStatus: 'Satisfactory',
    swaPositiveObservations: '',
    swaKeyRisks: '',
    swaImmediateActions: '',
    swaFurtherActions: '',
    swaResponsiblePerson: '',
    swaCloseOutDate: '',
    swaReinspectionRequired: 'No',
    swaReinspectionDate: '',
    swaOverallComments: '',
    // Electrical Commissioning Report
    ecrShift: 'Day', ecrLeadEngineer: '', ecrCompany: '', ecrMainContractor: '',
    ecrSystemBeingCommissioned: '', ecrPermitRefs: '', ecrOverallStatus: 'On Programme',
    ecrWeather: '', ecrSiteArea: '', ecrTicketRef: '',
    ecrProgressLabour: '', ecrAreasCompleted: '', ecrAreasInProgress: '',
    ecrAreasDelayed: '', ecrPercentProgress: '', ecrPlannedWorks: '',
    ecrActualWorks: '', ecrKeyAchievements: '', ecrKeyBlockers: '',
    ecrTomorrowWorks: '', ecrRequiredSupport: '', ecrQaComments: '',
    ecrSignLead: '', ecrSignWitness: '', ecrSignSiteManager: '', ecrSignContractor: '',
    ecrOverallComments: '',
    // Daily Site Report (upgraded)
    dsrSiteManager: '', dsrWeather: 'Fine', dsrTemperature: '', dsrSiteConditions: 'Good',
    dsrOperativesOnSite: '', dsrAreasWorkedIn: '', dsrWorksCompleted: '',
    dsrSystemsWorkedOn: '', dsrEquipmentWorkedOn: '', dsrTestingCompleted: '',
    dsrMaterialsInstalled: '', dsrIssuesEncountered: '', dsrSnagsIdentified: '',
    dsrAccessRestrictions: '', dsrFollowOnWorks: '',
    dsrPlanCompleted: 'Yes', dsrDelaysEncountered: 'No', dsrWaitingOtherTrades: 'No',
    dsrWaitingMaterials: 'No', dsrAdditionalWorks: 'No', dsrVariationPotential: 'No',
    dsrRevisitRequired: 'No', dsrFurtherLabour: 'No',
    dsrDeliveries: '', dsrPlantEquipment: '', dsrMaterialsUsed: '', dsrMissingMaterials: '',
    dsrHseObservations: '', dsrIncidents: 'None', dsrPermits: '', dsrVisitors: '',
    dsrTomorrowPlanned: '', dsrCommercialObservations: '', dsrSupervisorNotes: '',
    dsrSignEngineer: '', dsrSignSupervisor: '',
    dsrStartTime: '', dsrFinishTime: '', dsrBreakDuration: '', dsrTotalHours: '', dsrOvertimeHours: '',
    // Risk Assessment / RAMS
    ramsRef: `RAMS-${String(Math.floor(Math.random() * 900) + 100)}`,
    ramsRevision: 'Rev 0', ramsAuthor: '', ramsCompany: '', ramsPrincipalContractor: '',
    ramsClient: '', ramsTradePackage: '', ramsActivityDescription: '', ramsLocationOfWorks: '',
    ramsPermitRequirements: '', ramsReviewDate: '', ramsApprovedBy: '', ramsDistribution: '',
    ramsScopeOfWorks: '', ramsSequenceOfWorks: '', ramsAccessArrangements: '', ramsWorkingHours: '',
    ramsTradeInterfaces: '', ramsRestrictedAreas: '', ramsTemporaryWorks: '', ramsIsolations: '',
    ramsPlantEquipment: '', ramsPpe: '', ramsPermitsRequired: '', ramsIsolationProcedure: '',
    ramsEmergencyProcedure: '', ramsFirstAid: '', ramsFireArrangements: '', ramsEnvironmentalControls: '',
    ramsWelfareArrangements: '', ramsSupervisionRequirements: '', ramsCompetencyRequirements: '',
    ramsInspectionRequirements: '', ramsPreparedBy: '', ramsReviewedBy: '', ramsRevisionNotes: '',
    ramsOverallRiskRating: 'Medium',
  });

  // Site Walk checklist state — stored separately due to nested structure
  const [swaChecklist, setSwaChecklist] = useState<Record<string, ChecklistEntry>>({});
  const updateSwaCheck = (key: string, field: keyof ChecklistEntry, value: string | boolean) =>
    setSwaChecklist(prev => ({ ...prev, [key]: { ...SWA_DEFAULT_ENTRY, ...prev[key], [field]: value } }));

  // Elec Commissioning — dynamic rows
  const [ecrAttendees, setEcrAttendees] = useState<OperativeRecord[]>([]);
  const [ecrDelays, setEcrDelays] = useState<DelayRecord[]>([]);
  // ECR activities checklist
  const ECR_ACTIVITIES = [
    'Dead Testing', 'IR Testing', 'Continuity Testing', 'Functional Testing',
    'Cause & Effect Testing', 'Emergency Lighting Test', 'Fire Alarm Interface Testing',
    'BMS Integration Check', 'Panel Energisation', 'Temporary Energisation',
    'Witness Testing', 'Defects / Faults Identified', 'Retesting Required',
    'Isolation Requirements Active', 'Access Restrictions', 'Snagging',
    'Outstanding Works Recorded', 'Partial Completions',
  ] as const;
  const [ecrActivities, setEcrActivities] = useState<Record<string, { status: string; comment: string }>>({});
  const updateEcrActivity = (key: string, field: 'status' | 'comment', val: string) =>
    setEcrActivities(prev => {
      const existing = prev[key] ?? { status: 'Not Applicable', comment: '' };
      return { ...prev, [key]: { ...existing, [field]: val } };
    });

  // ECR QA checklist
  const ECR_QA_ITEMS = [
    'Test Sheets Completed', 'Inspection Records Updated', 'Red Line Drawings Updated',
    'QA Issues Identified', 'Snags Raised', 'Temporary Labels Applied',
    'Lock-offs in Place', 'Isolations Controlled', 'Permit Compliance Maintained',
    'Handover Packs Progressing',
  ] as const;
  const [ecrQaChecklist, setEcrQaChecklist] = useState<Record<string, { result: string; comment: string }>>({});
  const updateEcrQa = (key: string, field: 'result' | 'comment', val: string) =>
    setEcrQaChecklist(prev => {
      const existing = prev[key] ?? { result: 'N/A', comment: '' };
      return { ...prev, [key]: { ...existing, [field]: val } };
    });

  // Daily Site Report — dynamic rows
  const [dsrAttendees, setDsrAttendees] = useState<OperativeRecord[]>([]);
  const [dsrDelays, setDsrDelays] = useState<DelayRecord[]>([]);

  // Risk Assessment — dynamic rows
  const [ramsHazards, setRamsHazards] = useState<HazardRecord[]>([]);
  const [ramsSignOffs, setRamsSignOffs] = useState<RamsSignOffRecord[]>([]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleAction = (status: string) => {
    const base: ExtendedSiteForm = {
      id: `f${Date.now()}`,
      type,
      title: form.title,
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
    if (type === 'Pressure Test') {
      Object.assign(base, {
        plotArea: form.plotArea,
        systemService: form.systemService,
        pipeworkDescription: form.pipeworkDescription,
        testMedium: form.testMedium,
        testPressure: form.testPressure,
        testPressureUnit: form.testPressureUnit,
        startTime: form.startTime,
        endTime: form.endTime,
        durationOnTest: form.durationOnTest,
        testResult: form.testResult,
        witnessedBy: form.witnessedBy,
        engineer: form.engineer,
        company: form.company,
        observations: form.observations,
      });
    }
    if (type === 'Flushing Record') {
      Object.assign(base, {
        plotArea: form.plotArea, systemService: form.systemService,
        pipeworkDescription: form.pipeworkDescription,
        flushMedium: form.flushMedium, flushTemperature: form.flushTemperature,
        flushDuration: form.flushDuration, turbidity: form.turbidity,
        chlorineResidual: form.chlorineResidual, flushResult: form.flushResult,
        flushWitnessedBy: form.flushWitnessedBy,
        engineer: form.engineer, company: form.company, observations: form.observations,
      });
    }
    if (type === 'Valve Checklist') {
      Object.assign(base, {
        plotArea: form.plotArea, valveTag: form.valveTag, valveType: form.valveType,
        valveSize: form.valveSize, valveLocation: form.valveLocation,
        operationCheck: form.operationCheck, seatLeakageCheck: form.seatLeakageCheck,
        glandLeakageCheck: form.glandLeakageCheck, positionIndicator: form.positionIndicator,
        actuatorCheck: form.actuatorCheck, overallCondition: form.overallCondition,
        engineer: form.engineer, witnessedBy: form.witnessedBy, company: form.company,
        observations: form.observations,
      });
    }
    if (type === 'AHU Commissioning') {
      Object.assign(base, {
        plotArea: form.plotArea, ahuTag: form.ahuTag, ahuLocation: form.ahuLocation,
        supplyAirflow: form.supplyAirflow, returnAirflow: form.returnAirflow,
        supplyFanAmps: form.supplyFanAmps, returnFanAmps: form.returnFanAmps,
        filterCondition: form.filterCondition, beltCondition: form.beltCondition,
        dampersOperation: form.dampersOperation, condensateTray: form.condensateTray,
        vibrationCheck: form.vibrationCheck, coilCondition: form.coilCondition,
        setpointTemp: form.setpointTemp, measuredTemp: form.measuredTemp,
        ahuResult: form.ahuResult,
        engineer: form.engineer, witnessedBy: form.witnessedBy, company: form.company,
        observations: form.observations,
      });
    }
    if (type === 'Dead Testing') {
      Object.assign(base, {
        plotArea: form.plotArea, circuitRef: form.circuitRef, testInstrument: form.testInstrument,
        insulationPhaseL1: form.insulationPhaseL1, insulationPhaseL2: form.insulationPhaseL2,
        insulationPhaseL3: form.insulationPhaseL3, insulationNeutral: form.insulationNeutral,
        continuityRing: form.continuityRing, earthFault: form.earthFault,
        polarity: form.polarity, deadTestResult: form.deadTestResult,
        deadTestWitness: form.deadTestWitness,
        engineer: form.engineer, company: form.company, observations: form.observations,
      });
    }
    if (type === 'Continuity Test') {
      Object.assign(base, {
        plotArea: form.plotArea, circuitRef: form.circuitRef, conductorRef: form.conductorRef,
        conductorType: form.conductorType, conductorLength: form.conductorLength,
        testInstrument: form.testInstrument,
        measuredResistance: form.measuredResistance, calculatedResistance: form.calculatedResistance,
        deviationPercent: form.deviationPercent, continuityResult: form.continuityResult,
        continuityWitness: form.continuityWitness,
        engineer: form.engineer, company: form.company, observations: form.observations,
      });
    }
    if (type === 'Toolbox Talk') {
      Object.assign(base, {
        tbtTopic: form.tbtTopic, tbtDuration: form.tbtDuration, tbtLocation: form.tbtLocation,
        tbtPresentedBy: form.tbtPresentedBy, tbtAttendees: form.tbtAttendees,
        tbtKeyPoints: form.tbtKeyPoints, tbtActionItems: form.tbtActionItems,
        tbtSignOff: form.tbtSignOff,
        plotArea: form.plotArea, company: form.company,
      });
    }
    if (type === 'Site Walk Audit') {
      Object.assign(base, {
        swaSiteArea: form.swaSiteArea, swaAuditTime: form.swaAuditTime,
        swaAuditorName: form.swaAuditorName, swaWeather: form.swaWeather,
        swaTradeTeam: form.swaTradeTeam, swaSiteManager: form.swaSiteManager,
        swaOverallStatus: form.swaOverallStatus,
        swaPositiveObservations: form.swaPositiveObservations,
        swaKeyRisks: form.swaKeyRisks, swaImmediateActions: form.swaImmediateActions,
        swaFurtherActions: form.swaFurtherActions, swaResponsiblePerson: form.swaResponsiblePerson,
        swaCloseOutDate: form.swaCloseOutDate,
        swaReinspectionRequired: form.swaReinspectionRequired,
        swaReinspectionDate: form.swaReinspectionDate,
        swaOverallComments: form.swaOverallComments,
        swaChecklist: JSON.stringify(swaChecklist),
        company: form.company,
      });
    }
    if (type === 'Electrical Commissioning Report') {
      Object.assign(base, {
        ecrShift: form.ecrShift, ecrLeadEngineer: form.ecrLeadEngineer,
        ecrCompany: form.ecrCompany, ecrMainContractor: form.ecrMainContractor,
        ecrSystemBeingCommissioned: form.ecrSystemBeingCommissioned,
        ecrPermitRefs: form.ecrPermitRefs, ecrOverallStatus: form.ecrOverallStatus,
        ecrWeather: form.ecrWeather, ecrSiteArea: form.ecrSiteArea,
        ecrTicketRef: form.ecrTicketRef,
        ecrAttendees: JSON.stringify(ecrAttendees),
        ecrActivities: JSON.stringify(ecrActivities),
        ecrDelays: JSON.stringify(ecrDelays),
        ecrProgressLabour: form.ecrProgressLabour,
        ecrAreasCompleted: form.ecrAreasCompleted, ecrAreasInProgress: form.ecrAreasInProgress,
        ecrAreasDelayed: form.ecrAreasDelayed, ecrPercentProgress: form.ecrPercentProgress,
        ecrPlannedWorks: form.ecrPlannedWorks, ecrActualWorks: form.ecrActualWorks,
        ecrKeyAchievements: form.ecrKeyAchievements, ecrKeyBlockers: form.ecrKeyBlockers,
        ecrTomorrowWorks: form.ecrTomorrowWorks, ecrRequiredSupport: form.ecrRequiredSupport,
        ecrQaChecklist: JSON.stringify(ecrQaChecklist), ecrQaComments: form.ecrQaComments,
        ecrSignLead: form.ecrSignLead, ecrSignWitness: form.ecrSignWitness,
        ecrSignSiteManager: form.ecrSignSiteManager, ecrSignContractor: form.ecrSignContractor,
        ecrOverallComments: form.ecrOverallComments,
        company: form.ecrCompany,
      });
    }
    if (type === 'Daily Site Report') {
      Object.assign(base, {
        dsrSiteManager: form.dsrSiteManager, dsrWeather: form.dsrWeather,
        dsrTemperature: form.dsrTemperature, dsrSiteConditions: form.dsrSiteConditions,
        dsrOperativesOnSite: form.dsrOperativesOnSite,
        dsrAttendees: JSON.stringify(dsrAttendees),
        dsrAreasWorkedIn: form.dsrAreasWorkedIn, dsrWorksCompleted: form.dsrWorksCompleted,
        dsrSystemsWorkedOn: form.dsrSystemsWorkedOn, dsrEquipmentWorkedOn: form.dsrEquipmentWorkedOn,
        dsrTestingCompleted: form.dsrTestingCompleted, dsrMaterialsInstalled: form.dsrMaterialsInstalled,
        dsrIssuesEncountered: form.dsrIssuesEncountered, dsrSnagsIdentified: form.dsrSnagsIdentified,
        dsrAccessRestrictions: form.dsrAccessRestrictions, dsrFollowOnWorks: form.dsrFollowOnWorks,
        dsrPlanCompleted: form.dsrPlanCompleted, dsrDelaysEncountered: form.dsrDelaysEncountered,
        dsrWaitingOtherTrades: form.dsrWaitingOtherTrades, dsrWaitingMaterials: form.dsrWaitingMaterials,
        dsrAdditionalWorks: form.dsrAdditionalWorks, dsrVariationPotential: form.dsrVariationPotential,
        dsrRevisitRequired: form.dsrRevisitRequired, dsrFurtherLabour: form.dsrFurtherLabour,
        dsrDelays: JSON.stringify(dsrDelays),
        dsrDeliveries: form.dsrDeliveries, dsrPlantEquipment: form.dsrPlantEquipment,
        dsrMaterialsUsed: form.dsrMaterialsUsed, dsrMissingMaterials: form.dsrMissingMaterials,
        dsrHseObservations: form.dsrHseObservations, dsrIncidents: form.dsrIncidents,
        dsrPermits: form.dsrPermits, dsrVisitors: form.dsrVisitors,
        dsrTomorrowPlanned: form.dsrTomorrowPlanned,
        dsrCommercialObservations: form.dsrCommercialObservations,
        dsrSupervisorNotes: form.dsrSupervisorNotes,
        dsrSignEngineer: form.dsrSignEngineer, dsrSignSupervisor: form.dsrSignSupervisor,
        dsrStartTime: form.dsrStartTime, dsrFinishTime: form.dsrFinishTime,
        dsrBreakDuration: form.dsrBreakDuration, dsrTotalHours: form.dsrTotalHours,
        dsrOvertimeHours: form.dsrOvertimeHours,
      });
    }
    if (type === 'Risk Assessment') {
      Object.assign(base, {
        ramsRef: form.ramsRef, ramsRevision: form.ramsRevision,
        ramsAuthor: form.ramsAuthor, ramsCompany: form.ramsCompany,
        ramsPrincipalContractor: form.ramsPrincipalContractor, ramsClient: form.ramsClient,
        ramsTradePackage: form.ramsTradePackage, ramsActivityDescription: form.ramsActivityDescription,
        ramsLocationOfWorks: form.ramsLocationOfWorks, ramsPermitRequirements: form.ramsPermitRequirements,
        ramsReviewDate: form.ramsReviewDate, ramsApprovedBy: form.ramsApprovedBy,
        ramsDistribution: form.ramsDistribution, ramsScopeOfWorks: form.ramsScopeOfWorks,
        ramsSequenceOfWorks: form.ramsSequenceOfWorks, ramsAccessArrangements: form.ramsAccessArrangements,
        ramsWorkingHours: form.ramsWorkingHours, ramsTradeInterfaces: form.ramsTradeInterfaces,
        ramsRestrictedAreas: form.ramsRestrictedAreas, ramsTemporaryWorks: form.ramsTemporaryWorks,
        ramsIsolations: form.ramsIsolations, ramsPlantEquipment: form.ramsPlantEquipment,
        ramsHazards: JSON.stringify(ramsHazards),
        ramsPpe: form.ramsPpe, ramsPermitsRequired: form.ramsPermitsRequired,
        ramsIsolationProcedure: form.ramsIsolationProcedure,
        ramsEmergencyProcedure: form.ramsEmergencyProcedure, ramsFirstAid: form.ramsFirstAid,
        ramsFireArrangements: form.ramsFireArrangements,
        ramsEnvironmentalControls: form.ramsEnvironmentalControls,
        ramsWelfareArrangements: form.ramsWelfareArrangements,
        ramsSupervisionRequirements: form.ramsSupervisionRequirements,
        ramsCompetencyRequirements: form.ramsCompetencyRequirements,
        ramsInspectionRequirements: form.ramsInspectionRequirements,
        ramsSignOffs: JSON.stringify(ramsSignOffs),
        ramsPreparedBy: form.ramsPreparedBy, ramsReviewedBy: form.ramsReviewedBy,
        ramsRevisionNotes: form.ramsRevisionNotes,
        ramsOverallRiskRating: form.ramsOverallRiskRating,
        company: form.ramsCompany,
      });
    }

    onSave(base, uploadedFiles);
    onClose();
  };

  const isDaily = type === 'Daily Site Report';
  const isECR = type === 'Electrical Commissioning Report';
  const isRAMS = type === 'Risk Assessment';
  const isQA = type === 'QA Inspection';
  const isRFI = type === 'RFI';
  const isHoldUp = type === 'Hold Up Notice';
  const isHS = type === 'H&S Inspection';
  const isDelay = type === 'Delay Notice';
  const isVariation = type === 'Variation';
  const isEWN = type === 'Early Warning Notice';
  const isSI = type === 'Site Instruction';
  const isTQ = type === 'Technical Query';
  const isPressureTest = type === 'Pressure Test';
  const isFlushingRecord = type === 'Flushing Record';
  const isValveChecklist = type === 'Valve Checklist';
  const isAHUCommissioning = type === 'AHU Commissioning';
  const isDeadTesting = type === 'Dead Testing';
  const isContinuityTest = type === 'Continuity Test';
  const isToolboxTalk = type === 'Toolbox Talk';
  const isSiteWalkAudit = type === 'Site Walk Audit';

  const accentColor = isRAMS
    ? 'bg-orange-600 hover:bg-orange-700'
    : isECR
    ? 'bg-yellow-600 hover:bg-yellow-700'
    : isRFI
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
    : isPressureTest
    ? 'bg-blue-600 hover:bg-blue-700'
    : isFlushingRecord
    ? 'bg-cyan-600 hover:bg-cyan-700'
    : isValveChecklist
    ? 'bg-indigo-600 hover:bg-indigo-700'
    : isAHUCommissioning
    ? 'bg-violet-600 hover:bg-violet-700'
    : isDeadTesting
    ? 'bg-yellow-500 hover:bg-yellow-600'
    : isContinuityTest
    ? 'bg-lime-600 hover:bg-lime-700'
    : isToolboxTalk
    ? 'bg-amber-500 hover:bg-amber-600'
    : isSiteWalkAudit
    ? 'bg-rose-600 hover:bg-rose-700'
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

          {/* ── Title (all forms) ── */}
          <div>
            <label className={labelCls}>Title *</label>
            <input
              value={form.title}
              onChange={set('title')}
              className={`mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-3 text-base font-semibold text-white outline-none focus:border-[#f97316] placeholder:text-slate-600 placeholder:font-normal`}
              placeholder="Enter a clear, descriptive title for this record..."
            />
          </div>

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

          {/* ── QA Inspection Fields ── */}
          {isQA && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Project *</label>
                  <div className="relative">
                    <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                      <option value="">Select project...</option>
                      {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div><label className={labelCls}>Date *</label>
                  <input type="date" value={form.date} onChange={set('date')} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Completed By *</label>
                <input value={form.completedBy} onChange={set('completedBy')} className={inputCls} /></div>
              <div><label className={labelCls}>Inspection Description *</label>
                <textarea value={form.description} onChange={set('description')} rows={5} className={`${inputCls} resize-none`}
                  placeholder="Describe the inspection area, items checked, standards applied..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Inspection Area</label>
                  <input className={inputCls} placeholder="e.g. Ward 2A Cabling" /></div>
                <div><label className={labelCls}>Inspection Result</label>
                  <div className="relative">
                    <select className={`${inputCls} appearance-none pr-8`}>
                      <option>Pass</option><option>Pass with observations</option><option>Fail - remedial required</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div><label className={labelCls}>Photos</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload photos or documents" /></div>
              <div><label className={labelCls}>Comments</label>
                <textarea value={form.comments} onChange={set('comments')} rows={3} className={`${inputCls} resize-none`} placeholder="Any additional comments..." /></div>
            </>
          )}

          {/* ── Daily Site Report — Full Operational Form ── */}
          {isDaily && (
            <>
              {/* Header */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Report Header</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Project *</label>
                    <div className="relative">
                      <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                        <option value="">Select project...</option>
                        {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div><label className={labelCls}>Date *</label>
                    <input type="date" value={form.date} onChange={set('date')} className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Site / Building / Area</label>
                    <input value={form.dsrAreasWorkedIn} onChange={set('dsrAreasWorkedIn')} className={inputCls} placeholder="e.g. Block A, Level 3" /></div>
                  <div><label className={labelCls}>Site Manager</label>
                    <input value={form.dsrSiteManager} onChange={set('dsrSiteManager')} className={inputCls} placeholder="Name" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className={labelCls}>Lead Engineer / Supervisor *</label>
                    <input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Full name" /></div>
                  <div><label className={labelCls}>Operatives on Site</label>
                    <input value={form.dsrOperativesOnSite} onChange={set('dsrOperativesOnSite')} className={inputCls} placeholder="Number" /></div>
                  <div><label className={labelCls}>Visitors to Site</label>
                    <input value={form.dsrVisitors} onChange={set('dsrVisitors')} className={inputCls} placeholder="None" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className={labelCls}>Weather</label>
                    <div className="relative">
                      <select value={form.dsrWeather} onChange={set('dsrWeather')} className={`${inputCls} appearance-none pr-8`}>
                        {['Fine','Overcast','Rain','Heavy Rain','Snow','Fog','Hot','Windy'].map(w => <option key={w}>{w}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div><label className={labelCls}>Temperature (°C)</label>
                    <input value={form.dsrTemperature} onChange={set('dsrTemperature')} className={inputCls} placeholder="e.g. 18" /></div>
                  <div><label className={labelCls}>Site Conditions</label>
                    <div className="relative">
                      <select value={form.dsrSiteConditions} onChange={set('dsrSiteConditions')} className={`${inputCls} appearance-none pr-8`}>
                        {['Good','Fair','Poor','Restricted Access'].map(c => <option key={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><label className={labelCls}>Start Time</label>
                    <input type="time" value={form.dsrStartTime} onChange={set('dsrStartTime')} className={inputCls} /></div>
                  <div><label className={labelCls}>Finish Time</label>
                    <input type="time" value={form.dsrFinishTime} onChange={set('dsrFinishTime')} className={inputCls} /></div>
                  <div><label className={labelCls}>Break (hrs)</label>
                    <input value={form.dsrBreakDuration} onChange={set('dsrBreakDuration')} className={inputCls} placeholder="0.5" /></div>
                  <div><label className={labelCls}>Total Hours</label>
                    <input value={form.dsrTotalHours} onChange={set('dsrTotalHours')} className={inputCls} placeholder="8" /></div>
                </div>
              </div>

              {/* Operative Attendance */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Operative Attendance & Compliance</p>
                <OperativeRows rows={dsrAttendees} onChange={setDsrAttendees} />
              </div>

              {/* Work Activity */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Work Activity</p>
                <div><label className={labelCls}>Works Carried Out Today *</label>
                  <textarea value={form.description} onChange={set('description')} rows={4} className={`${inputCls} resize-none`}
                    placeholder="Describe all works carried out on site today in detail..." /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Areas Worked In</label>
                    <textarea value={form.dsrAreasWorkedIn} onChange={set('dsrAreasWorkedIn')} rows={2} className={`${inputCls} resize-none`} placeholder="Floors, zones, rooms..." /></div>
                  <div><label className={labelCls}>Systems Worked On</label>
                    <textarea value={form.dsrSystemsWorkedOn} onChange={set('dsrSystemsWorkedOn')} rows={2} className={`${inputCls} resize-none`} placeholder="e.g. HV distribution, lighting, LV DB..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Equipment Worked On</label>
                    <textarea value={form.dsrEquipmentWorkedOn} onChange={set('dsrEquipmentWorkedOn')} rows={2} className={`${inputCls} resize-none`} placeholder="Specific equipment, plant, assets..." /></div>
                  <div><label className={labelCls}>Testing Completed</label>
                    <textarea value={form.dsrTestingCompleted} onChange={set('dsrTestingCompleted')} rows={2} className={`${inputCls} resize-none`} placeholder="Tests performed today..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Materials Installed</label>
                    <textarea value={form.dsrMaterialsInstalled} onChange={set('dsrMaterialsInstalled')} rows={2} className={`${inputCls} resize-none`} placeholder="Quantities and descriptions..." /></div>
                  <div><label className={labelCls}>Issues Encountered</label>
                    <textarea value={form.dsrIssuesEncountered} onChange={set('dsrIssuesEncountered')} rows={2} className={`${inputCls} resize-none`} placeholder="Technical, access, coordination issues..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Snags Identified</label>
                    <textarea value={form.dsrSnagsIdentified} onChange={set('dsrSnagsIdentified')} rows={2} className={`${inputCls} resize-none`} placeholder="Defects, remedial works required..." /></div>
                  <div><label className={labelCls}>Follow-on Works Required</label>
                    <textarea value={form.dsrFollowOnWorks} onChange={set('dsrFollowOnWorks')} rows={2} className={`${inputCls} resize-none`} placeholder="Works required to complete scope..." /></div>
                </div>
              </div>

              {/* Progress */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progress & Productivity</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {([
                    { key: 'dsrPlanCompleted',      label: 'Daily plan completed?',          yesGood: true  },
                    { key: 'dsrDelaysEncountered',   label: 'Delays encountered?',            yesGood: false },
                    { key: 'dsrWaitingOtherTrades',  label: 'Waiting on other trades?',       yesGood: false },
                    { key: 'dsrWaitingMaterials',    label: 'Waiting on materials?',          yesGood: false },
                    { key: 'dsrAdditionalWorks',     label: 'Additional works identified?',   yesGood: false },
                    { key: 'dsrVariationPotential',  label: 'Variation potential?',           yesGood: false },
                    { key: 'dsrRevisitRequired',     label: 'Revisit required?',              yesGood: false },
                    { key: 'dsrFurtherLabour',       label: 'Further labour required?',       yesGood: false },
                  ] as { key: keyof typeof form; label: string; yesGood: boolean }[]).map(item => {
                    const val = form[item.key] as string;
                    const isYes = val === 'Yes';
                    const isNo = val === 'No';
                    const yesActive = isYes ? (item.yesGood ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-[#f97316] border-[#f97316] text-white') : 'bg-transparent border-[#1e2d4a] text-slate-500 hover:border-slate-500 hover:text-slate-300';
                    const noActive  = isNo  ? (item.yesGood ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-emerald-600 border-emerald-600 text-white') : 'bg-transparent border-[#1e2d4a] text-slate-500 hover:border-slate-500 hover:text-slate-300';
                    return (
                      <div key={item.key} className="flex items-center justify-between gap-3 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3.5 py-2.5">
                        <span className="text-xs font-semibold text-slate-300 leading-snug">{item.label}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => setForm(f => ({ ...f, [item.key]: 'Yes' }))}
                            className={`px-3.5 py-1 rounded-md text-xs font-bold border transition-all ${yesActive}`}>
                            Yes
                          </button>
                          <button type="button" onClick={() => setForm(f => ({ ...f, [item.key]: 'No' }))}
                            className={`px-3.5 py-1 rounded-md text-xs font-bold border transition-all ${noActive}`}>
                            No
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div><label className={labelCls}>Tomorrow's Planned Works</label>
                  <textarea value={form.dsrTomorrowPlanned} onChange={set('dsrTomorrowPlanned')} rows={3} className={`${inputCls} resize-none`}
                    placeholder="Outline works planned for tomorrow..." /></div>
              </div>

              {/* Delays & Commercial */}
              <div className="bg-[#0d1628] border border-red-900/30 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Delays / Commercial Issues</p>
                <DelayRows rows={dsrDelays} onChange={setDsrDelays} platformUsers={store.platformUsers} />
                <div><label className={labelCls}>Commercial Observations</label>
                  <textarea value={form.dsrCommercialObservations} onChange={set('dsrCommercialObservations')} rows={3} className={`${inputCls} resize-none`}
                    placeholder="Variation potential, early warning matters, commercial impacts..." /></div>
              </div>

              {/* Materials, Plant & Deliveries */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Materials, Plant & Deliveries</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Materials Used</label>
                    <textarea value={form.dsrMaterialsUsed} onChange={set('dsrMaterialsUsed')} rows={2} className={`${inputCls} resize-none`} placeholder="Description and quantities..." /></div>
                  <div><label className={labelCls}>Missing / Short Materials</label>
                    <textarea value={form.dsrMissingMaterials} onChange={set('dsrMissingMaterials')} rows={2} className={`${inputCls} resize-none`} placeholder="Items required to continue works..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Plant & Equipment Used</label>
                    <textarea value={form.dsrPlantEquipment} onChange={set('dsrPlantEquipment')} rows={2} className={`${inputCls} resize-none`} placeholder="e.g. MEWP, generators, test equipment..." /></div>
                  <div><label className={labelCls}>Deliveries Today</label>
                    <textarea value={form.dsrDeliveries} onChange={set('dsrDeliveries')} rows={2} className={`${inputCls} resize-none`} placeholder="Materials / equipment delivered to site..." /></div>
                </div>
              </div>

              {/* H&S */}
              <div className="bg-[#0d1628] border border-amber-900/30 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Health & Safety</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>H&S Observations</label>
                    <textarea value={form.dsrHseObservations} onChange={set('dsrHseObservations')} rows={3} className={`${inputCls} resize-none`}
                      placeholder="Positive observations, unsafe acts/conditions noted..." /></div>
                  <div><label className={labelCls}>Incidents / Near Misses</label>
                    <textarea value={form.dsrIncidents} onChange={set('dsrIncidents')} rows={3} className={`${inputCls} resize-none`}
                      placeholder="None — or describe any incidents, near misses, first aid..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Permits in Use</label>
                    <input value={form.dsrPermits} onChange={set('dsrPermits')} className={inputCls} placeholder="e.g. PTW-001, Hot Works, Confined Space" /></div>
                  <div><label className={labelCls}>Access Restrictions</label>
                    <input value={form.dsrAccessRestrictions} onChange={set('dsrAccessRestrictions')} className={inputCls} placeholder="Areas restricted today..." /></div>
                </div>
              </div>

              {/* Photos */}
              <div><label className={labelCls}>Photos / Evidence</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload site photos, evidence and documents" /></div>

              {/* Supervisor Notes & Sign-off */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Supervisor Notes & Sign-off</p>
                <div><label className={labelCls}>Supervisor Notes</label>
                  <textarea value={form.dsrSupervisorNotes} onChange={set('dsrSupervisorNotes')} rows={3} className={`${inputCls} resize-none`}
                    placeholder="Any additional notes from the supervisor / site manager..." /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Engineer Signature (Name)</label>
                    <input value={form.dsrSignEngineer} onChange={set('dsrSignEngineer')} className={inputCls} placeholder="Full name" /></div>
                  <div><label className={labelCls}>Supervisor Signature (Name)</label>
                    <input value={form.dsrSignSupervisor} onChange={set('dsrSignSupervisor')} className={inputCls} placeholder="Full name" /></div>
                </div>
              </div>
            </>
          )}

          {/* ── Electrical Commissioning Report ── */}
          {isECR && (
            <>
              {/* Header */}
              <div className="bg-[#0d1628] border border-yellow-900/40 rounded-xl p-4 space-y-4">
                <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">Electrical Commissioning Report</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Project *</label>
                    <div className="relative">
                      <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                        <option value="">Select project...</option>
                        {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div><label className={labelCls}>Date *</label>
                    <input type="date" value={form.date} onChange={set('date')} className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className={labelCls}>Ticket Reference</label>
                    <input value={form.ecrTicketRef} onChange={set('ecrTicketRef')} className={inputCls} placeholder="e.g. ELEC-COM-001" /></div>
                  <div><label className={labelCls}>Site / Building / Area *</label>
                    <input value={form.ecrSiteArea} onChange={set('ecrSiteArea')} className={inputCls} placeholder="e.g. Block B, Plant Room 3" /></div>
                  <div><label className={labelCls}>Shift</label>
                    <div className="relative">
                      <select value={form.ecrShift} onChange={set('ecrShift')} className={`${inputCls} appearance-none pr-8`}>
                        <option>Day</option><option>Night</option><option>Day / Night</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Lead Commissioning Engineer *</label>
                    <input value={form.ecrLeadEngineer} onChange={set('ecrLeadEngineer')} className={inputCls} placeholder="Full name" /></div>
                  <div><label className={labelCls}>Completed By</label>
                    <input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Report author name" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Company</label>
                    <input value={form.ecrCompany} onChange={set('ecrCompany')} className={inputCls} placeholder="Commissioning contractor" /></div>
                  <div><label className={labelCls}>Main Contractor / Client</label>
                    <input value={form.ecrMainContractor} onChange={set('ecrMainContractor')} className={inputCls} placeholder="Name" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>System Being Commissioned *</label>
                    <input value={form.ecrSystemBeingCommissioned} onChange={set('ecrSystemBeingCommissioned')} className={inputCls} placeholder="e.g. LV Distribution, Emergency Lighting..." /></div>
                  <div><label className={labelCls}>Permit References</label>
                    <input value={form.ecrPermitRefs} onChange={set('ecrPermitRefs')} className={inputCls} placeholder="e.g. PTW-004, PTW-007" /></div>
                </div>
                <div><label className={labelCls}>Weather Conditions</label>
                  <input value={form.ecrWeather} onChange={set('ecrWeather')} className={inputCls} placeholder="e.g. Fine, 18°C" /></div>
                <div>
                  <label className={labelCls}>Overall Site Status *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
                    {(['On Programme','Minor Delays','Significant Delays','Hold Point','Awaiting Access','Awaiting Builder\'s Works','Awaiting Power','Partial Completion'] as const).map(s => (
                      <button key={s} type="button" onClick={() => setForm(f => ({ ...f, ecrOverallStatus: s }))}
                        className={`py-2 px-2.5 rounded-xl text-[10px] font-bold border transition-all text-center leading-tight ${form.ecrOverallStatus === s
                          ? s === 'On Programme' ? 'bg-emerald-600 border-emerald-600 text-white'
                            : s === 'Minor Delays' ? 'bg-amber-500 border-amber-500 text-white'
                            : s === 'Significant Delays' || s === 'Hold Point' ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-yellow-600 border-yellow-600 text-white'
                          : 'bg-[#1a2236] border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Operative Attendance */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Engineer Attendance & Compliance</p>
                <OperativeRows rows={ecrAttendees} onChange={setEcrAttendees} />
              </div>

              {/* Commissioning Activities Checklist */}
              <div className="bg-[#0d1628] border border-yellow-900/30 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">Commissioning Activities</p>
                <div className="space-y-2">
                  {ECR_ACTIVITIES.map(activity => {
                    const entry = ecrActivities[activity] ?? { status: 'Not Applicable', comment: '' };
                    return (
                      <div key={activity} className="border border-[#1e2d4a] rounded-xl p-3 space-y-2 bg-[#1a2236]/50">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-xs text-slate-300 flex-1">{activity}</span>
                          <div className="flex gap-1 shrink-0">
                            {(['Completed','In Progress','Not Applicable','Fault Found','Pending'] as const).map(s => (
                              <button key={s} type="button" onClick={() => updateEcrActivity(activity, 'status', s)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all whitespace-nowrap ${entry.status === s
                                  ? s === 'Completed' ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : s === 'In Progress' ? 'bg-amber-500 border-amber-500 text-white'
                                    : s === 'Fault Found' ? 'bg-red-600 border-red-600 text-white'
                                    : s === 'Pending' ? 'bg-yellow-600 border-yellow-600 text-white'
                                    : 'bg-slate-600 border-slate-600 text-white'
                                  : 'bg-transparent border-[#1e2d4a] text-slate-600 hover:border-slate-500 hover:text-slate-400'}`}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        {(entry.status !== 'Not Applicable' || entry.comment) && (
                          <input value={entry.comment} onChange={e => updateEcrActivity(activity, 'comment', e.target.value)}
                            className={`${inputCls} mt-0 text-xs py-1.5`} placeholder="Comments, circuit refs, faults, observations..." />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delays / Commercial */}
              <div className="bg-[#0d1628] border border-red-900/30 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Delays / Commercial Issues</p>
                <DelayRows rows={ecrDelays} onChange={setEcrDelays} platformUsers={store.platformUsers} />
              </div>

              {/* Daily Progress Summary */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Daily Progress Summary</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><label className={labelCls}>Labour on Site</label>
                    <input value={form.ecrProgressLabour} onChange={set('ecrProgressLabour')} className={inputCls} placeholder="No. of engineers" /></div>
                  <div><label className={labelCls}>% Progress (Overall)</label>
                    <input value={form.ecrPercentProgress} onChange={set('ecrPercentProgress')} className={inputCls} placeholder="e.g. 65%" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Areas Completed Today</label>
                    <textarea value={form.ecrAreasCompleted} onChange={set('ecrAreasCompleted')} rows={2} className={`${inputCls} resize-none`} placeholder="Zones, panels, circuits..." /></div>
                  <div><label className={labelCls}>Areas In Progress</label>
                    <textarea value={form.ecrAreasInProgress} onChange={set('ecrAreasInProgress')} rows={2} className={`${inputCls} resize-none`} placeholder="Ongoing commissioning activities..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Areas Delayed / Inaccessible</label>
                    <textarea value={form.ecrAreasDelayed} onChange={set('ecrAreasDelayed')} rows={2} className={`${inputCls} resize-none`} placeholder="Restricted or unavailable areas..." /></div>
                  <div><label className={labelCls}>Planned vs Actual Works</label>
                    <textarea value={form.ecrActualWorks} onChange={set('ecrActualWorks')} rows={2} className={`${inputCls} resize-none`} placeholder="What was planned vs what was achieved..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Key Achievements Today</label>
                    <textarea value={form.ecrKeyAchievements} onChange={set('ecrKeyAchievements')} rows={2} className={`${inputCls} resize-none`} placeholder="Milestone completions, sign-offs, energisations..." /></div>
                  <div><label className={labelCls}>Key Blockers</label>
                    <textarea value={form.ecrKeyBlockers} onChange={set('ecrKeyBlockers')} rows={2} className={`${inputCls} resize-none`} placeholder="Issues preventing progress..." /></div>
                </div>
                <div><label className={labelCls}>Tomorrow's Planned Works</label>
                  <textarea value={form.ecrTomorrowWorks} onChange={set('ecrTomorrowWorks')} rows={3} className={`${inputCls} resize-none`} placeholder="Commissioning activities planned for tomorrow..." /></div>
                <div><label className={labelCls}>Required Support / Actions</label>
                  <textarea value={form.ecrRequiredSupport} onChange={set('ecrRequiredSupport')} rows={2} className={`${inputCls} resize-none`} placeholder="Support needed from PM, QS, site team, client..." /></div>
              </div>

              {/* QA / Compliance Checklist */}
              <div className="bg-[#0d1628] border border-teal-900/30 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">QA / Compliance</p>
                <div className="space-y-2">
                  {ECR_QA_ITEMS.map(item => {
                    const entry = ecrQaChecklist[item] ?? { result: 'N/A', comment: '' };
                    return (
                      <div key={item} className="border border-[#1e2d4a] rounded-xl p-3 space-y-2 bg-[#1a2236]/50">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-xs text-slate-300 flex-1">{item}</span>
                          <div className="flex gap-1.5 shrink-0">
                            {(['Pass', 'Fail', 'N/A'] as const).map(r => (
                              <button key={r} type="button" onClick={() => updateEcrQa(item, 'result', r)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${entry.result === r
                                  ? r === 'Pass' ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : r === 'Fail' ? 'bg-red-600 border-red-600 text-white'
                                    : 'bg-slate-600 border-slate-600 text-white'
                                  : 'bg-transparent border-[#1e2d4a] text-slate-600 hover:border-slate-500 hover:text-slate-400'}`}>
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                        {(entry.result === 'Fail' || entry.comment) && (
                          <input value={entry.comment} onChange={e => updateEcrQa(item, 'comment', e.target.value)}
                            className={`${inputCls} mt-0 text-xs py-1.5`} placeholder="Comment..." />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div><label className={labelCls}>QA / Compliance Comments</label>
                  <textarea value={form.ecrQaComments} onChange={set('ecrQaComments')} rows={2} className={`${inputCls} resize-none`} placeholder="Additional QA observations..." /></div>
              </div>

              {/* Photos */}
              <div><label className={labelCls}>Photos / Evidence</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload commissioning photos, test records and evidence" /></div>

              {/* Overall Comments */}
              <div><label className={labelCls}>Overall Comments / Notes</label>
                <textarea value={form.ecrOverallComments} onChange={set('ecrOverallComments')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="General observations, summary, anything notable for the record..." /></div>

              {/* Signatures */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Signatures</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Lead Commissioning Engineer</label>
                    <input value={form.ecrSignLead} onChange={set('ecrSignLead')} className={inputCls} placeholder="Full name" /></div>
                  <div><label className={labelCls}>Witness / Client Representative</label>
                    <input value={form.ecrSignWitness} onChange={set('ecrSignWitness')} className={inputCls} placeholder="Full name" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Site Manager</label>
                    <input value={form.ecrSignSiteManager} onChange={set('ecrSignSiteManager')} className={inputCls} placeholder="Full name" /></div>
                  <div><label className={labelCls}>Contractor Representative</label>
                    <input value={form.ecrSignContractor} onChange={set('ecrSignContractor')} className={inputCls} placeholder="Full name" /></div>
                </div>
              </div>
            </>
          )}

          {/* ── Risk Assessment / RAMS ── */}
          {isRAMS && (
            <>
              {/* Header */}
              <div className="bg-[#0d1628] border border-orange-900/40 rounded-xl p-4 space-y-4">
                <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Risk Assessment / RAMS — Document Header</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className={labelCls}>RAMS Reference *</label>
                    <input value={form.ramsRef} onChange={set('ramsRef')} className={inputCls} placeholder="e.g. RAMS-001" /></div>
                  <div><label className={labelCls}>Revision</label>
                    <input value={form.ramsRevision} onChange={set('ramsRevision')} className={inputCls} placeholder="Rev 0" /></div>
                  <div><label className={labelCls}>Date *</label>
                    <input type="date" value={form.date} onChange={set('date')} className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Project *</label>
                    <div className="relative">
                      <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                        <option value="">Select project...</option>
                        {store.projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div><label className={labelCls}>Site / Location of Works *</label>
                    <input value={form.ramsLocationOfWorks} onChange={set('ramsLocationOfWorks')} className={inputCls} placeholder="e.g. Block A, Level 2, Plant Room 3" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Author / Prepared By *</label>
                    <input value={form.ramsAuthor} onChange={set('ramsAuthor')} className={inputCls} placeholder="Full name" /></div>
                  <div><label className={labelCls}>Completed By</label>
                    <input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Full name" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Company</label>
                    <input value={form.ramsCompany} onChange={set('ramsCompany')} className={inputCls} placeholder="Issuing organisation" /></div>
                  <div><label className={labelCls}>Principal Contractor</label>
                    <input value={form.ramsPrincipalContractor} onChange={set('ramsPrincipalContractor')} className={inputCls} placeholder="Name" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Client</label>
                    <input value={form.ramsClient} onChange={set('ramsClient')} className={inputCls} placeholder="Client name" /></div>
                  <div><label className={labelCls}>Trade / Package</label>
                    <input value={form.ramsTradePackage} onChange={set('ramsTradePackage')} className={inputCls} placeholder="e.g. Electrical, Mechanical, Civils" /></div>
                </div>
                <div><label className={labelCls}>Activity / Task Description *</label>
                  <input value={form.ramsActivityDescription} onChange={set('ramsActivityDescription')} className={inputCls} placeholder="Brief description of the activity being assessed" /></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className={labelCls}>Permit Requirements</label>
                    <input value={form.ramsPermitRequirements} onChange={set('ramsPermitRequirements')} className={inputCls} placeholder="e.g. PTW, Hot Works" /></div>
                  <div><label className={labelCls}>Review Date</label>
                    <input type="date" value={form.ramsReviewDate} onChange={set('ramsReviewDate')} className={inputCls} /></div>
                  <div><label className={labelCls}>Approved By</label>
                    <input value={form.ramsApprovedBy} onChange={set('ramsApprovedBy')} className={inputCls} placeholder="Name / role" /></div>
                </div>
                <div><label className={labelCls}>Distribution List</label>
                  <input value={form.ramsDistribution} onChange={set('ramsDistribution')} className={inputCls} placeholder="e.g. Site Manager, Safety Officer, Client Representative" /></div>
              </div>

              {/* Work Activity */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Work Activity Description</p>
                <div><label className={labelCls}>Scope of Works *</label>
                  <textarea value={form.ramsScopeOfWorks} onChange={set('ramsScopeOfWorks')} rows={4} className={`${inputCls} resize-none`}
                    placeholder="Describe the full scope of works covered by this risk assessment..." /></div>
                <div><label className={labelCls}>Sequence of Works</label>
                  <textarea value={form.ramsSequenceOfWorks} onChange={set('ramsSequenceOfWorks')} rows={3} className={`${inputCls} resize-none`}
                    placeholder="Step-by-step sequence in which the work will be carried out..." /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Access Arrangements</label>
                    <textarea value={form.ramsAccessArrangements} onChange={set('ramsAccessArrangements')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="How operatives will access and egress the work area..." /></div>
                  <div><label className={labelCls}>Working Hours</label>
                    <textarea value={form.ramsWorkingHours} onChange={set('ramsWorkingHours')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Normal / extended hours, shift patterns, weekend working..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Interfaces with Other Trades</label>
                    <textarea value={form.ramsTradeInterfaces} onChange={set('ramsTradeInterfaces')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Coordination requirements with other contractors on site..." /></div>
                  <div><label className={labelCls}>Restricted Areas</label>
                    <textarea value={form.ramsRestrictedAreas} onChange={set('ramsRestrictedAreas')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Any areas requiring special access controls or exclusions..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Temporary Works</label>
                    <textarea value={form.ramsTemporaryWorks} onChange={set('ramsTemporaryWorks')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Scaffolding, propping, temporary power, barriers..." /></div>
                  <div><label className={labelCls}>Isolations Required</label>
                    <textarea value={form.ramsIsolations} onChange={set('ramsIsolations')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Electrical isolations, mechanical isolations, lock-off procedures..." /></div>
                </div>
                <div><label className={labelCls}>Plant & Equipment Involved</label>
                  <textarea value={form.ramsPlantEquipment} onChange={set('ramsPlantEquipment')} rows={2} className={`${inputCls} resize-none`}
                    placeholder="Tools, plant, test equipment, lifting equipment, vehicles..." /></div>
              </div>

              {/* Hazard & Risk Assessment Table */}
              <div className="bg-[#0d1628] border border-orange-900/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Hazard & Risk Assessment</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">Risk = Likelihood × Severity</span>
                    <div className="flex gap-1.5">
                      {[{l:'Low',bg:'bg-emerald-600'},{l:'Medium',bg:'bg-amber-500'},{l:'High',bg:'bg-orange-600'},{l:'Critical',bg:'bg-red-700'}].map(r => (
                        <span key={r.l} className={`text-[9px] font-bold px-2 py-0.5 rounded-full text-white ${r.bg}`}>{r.l}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <HazardRows rows={ramsHazards} onChange={setRamsHazards} />
              </div>

              {/* Control Measures */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Control Measures</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>PPE Requirements</label>
                    <textarea value={form.ramsPpe} onChange={set('ramsPpe')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Hard hat, safety boots, hi-vis, gloves, eye protection, RPE..." /></div>
                  <div><label className={labelCls}>Permits Required</label>
                    <textarea value={form.ramsPermitsRequired} onChange={set('ramsPermitsRequired')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Permit to Work, Hot Works Permit, Confined Space Permit..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Isolation Procedure</label>
                    <textarea value={form.ramsIsolationProcedure} onChange={set('ramsIsolationProcedure')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Lock-off, tag-out, test before touch procedures..." /></div>
                  <div><label className={labelCls}>Emergency Procedures</label>
                    <textarea value={form.ramsEmergencyProcedure} onChange={set('ramsEmergencyProcedure')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Emergency contacts, evacuation procedure, actions in emergency..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>First Aid Arrangements</label>
                    <textarea value={form.ramsFirstAid} onChange={set('ramsFirstAid')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="First aider name, location of first aid kit, hospital route..." /></div>
                  <div><label className={labelCls}>Fire Arrangements</label>
                    <textarea value={form.ramsFireArrangements} onChange={set('ramsFireArrangements')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Fire extinguisher location, fire marshal, muster point..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Environmental Controls</label>
                    <textarea value={form.ramsEnvironmentalControls} onChange={set('ramsEnvironmentalControls')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Waste segregation, dust suppression, spill control..." /></div>
                  <div><label className={labelCls}>Welfare Arrangements</label>
                    <textarea value={form.ramsWelfareArrangements} onChange={set('ramsWelfareArrangements')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Toilets, canteen, drinking water, rest area..." /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Supervision Requirements</label>
                    <textarea value={form.ramsSupervisionRequirements} onChange={set('ramsSupervisionRequirements')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Supervisor qualifications, attendance requirements, inspection frequency..." /></div>
                  <div><label className={labelCls}>Competency Requirements</label>
                    <textarea value={form.ramsCompetencyRequirements} onChange={set('ramsCompetencyRequirements')} rows={2} className={`${inputCls} resize-none`}
                      placeholder="Required qualifications, trade cards, training certificates..." /></div>
                </div>
                <div><label className={labelCls}>Inspection Requirements</label>
                  <textarea value={form.ramsInspectionRequirements} onChange={set('ramsInspectionRequirements')} rows={2} className={`${inputCls} resize-none`}
                    placeholder="Pre-start checks, daily inspection requirements, formal inspections..." /></div>
              </div>

              {/* Overall Risk Rating */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Overall Risk Rating</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Low','Medium','High','Critical'] as const).map(level => {
                    const colors: Record<string, string> = { Low: 'bg-emerald-600 border-emerald-600', Medium: 'bg-amber-500 border-amber-500', High: 'bg-orange-600 border-orange-600', Critical: 'bg-red-700 border-red-700' };
                    const active = form.ramsOverallRiskRating === level;
                    return (
                      <button key={level} type="button" onClick={() => setForm(f => ({ ...f, ramsOverallRiskRating: level }))}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${active ? `${colors[level]} text-white` : 'bg-[#1a2236] border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Photos / Evidence */}
              <div><label className={labelCls}>Supporting Evidence / Photos</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx,.dwg"
                  label="Upload drawings, photos, access routes, permits, marked-up plans" /></div>

              {/* Preparation & Approval */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Preparation, Review & Approval</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Prepared By</label>
                    <input value={form.ramsPreparedBy} onChange={set('ramsPreparedBy')} className={inputCls} placeholder="Name / role" /></div>
                  <div><label className={labelCls}>Reviewed By</label>
                    <input value={form.ramsReviewedBy} onChange={set('ramsReviewedBy')} className={inputCls} placeholder="Name / role" /></div>
                </div>
                <div><label className={labelCls}>Revision Notes</label>
                  <textarea value={form.ramsRevisionNotes} onChange={set('ramsRevisionNotes')} rows={2} className={`${inputCls} resize-none`}
                    placeholder="Changes made in this revision, reason for revision..." /></div>
                <div><label className={labelCls}>Additional Comments</label>
                  <textarea value={form.comments} onChange={set('comments')} rows={2} className={`${inputCls} resize-none`}
                    placeholder="Any other relevant notes..." /></div>
              </div>

              {/* RAMS Briefing Sign-Off */}
              <div className="bg-[#0d1628] border border-emerald-900/40 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">RAMS Briefing — Operative Sign-Off</p>
                <p className="text-[11px] text-slate-500">By signing below, each operative confirms they have read, understood, and been briefed on this risk assessment and method statement.</p>
                <RamsSignOffRows rows={ramsSignOffs} onChange={setRamsSignOffs} />
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

          {/* ── Pressure Test ── */}
          {isPressureTest && (
            <>
              <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-blue-300 mb-0.5 uppercase tracking-wider">Mechanical — Pressure Test Record</p>
                <p className="text-xs text-blue-300/70 leading-relaxed">Complete all fields accurately. This record forms part of the project commissioning documentation and should be retained on site.</p>
              </div>

              {/* Project + Date */}
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

              {/* Plot/Area + System */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Plot / Area *</label>
                  <input value={form.plotArea} onChange={set('plotArea')} className={inputCls} placeholder="e.g. Block A, Level 2, Plot 14" />
                </div>
                <div>
                  <label className={labelCls}>System / Service Tested *</label>
                  <input value={form.systemService} onChange={set('systemService')} className={inputCls} placeholder="e.g. LTHW, DHW, Chilled Water" />
                </div>
              </div>

              {/* Pipework description */}
              <div>
                <label className={labelCls}>Pipework Description</label>
                <input value={form.pipeworkDescription} onChange={set('pipeworkDescription')} className={inputCls} placeholder="e.g. 22mm copper, flow & return to AHU-01, Levels 1–3" />
              </div>

              {/* Test medium + pressure */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Test Medium *</label>
                  <div className="relative">
                    <select value={form.testMedium} onChange={set('testMedium')} className={`${inputCls} appearance-none pr-8`}>
                      {['Water', 'Air', 'Nitrogen', 'Other'].map(m => <option key={m}>{m}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Test Pressure *</label>
                  <input value={form.testPressure} onChange={set('testPressure')} className={inputCls} placeholder="e.g. 6.0" />
                </div>
                <div>
                  <label className={labelCls}>Unit</label>
                  <div className="relative">
                    <select value={form.testPressureUnit} onChange={set('testPressureUnit')} className={`${inputCls} appearance-none pr-8`}>
                      {['bar', 'mbar', 'kPa', 'psi'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Start Time *</label>
                  <input type="time" value={form.startTime} onChange={set('startTime')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End Time *</label>
                  <input type="time" value={form.endTime} onChange={set('endTime')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Duration on Test</label>
                  <input value={form.durationOnTest} onChange={set('durationOnTest')} className={inputCls} placeholder="e.g. 1 hour" />
                </div>
              </div>

              {/* Result */}
              <div>
                <label className={labelCls}>Test Result *</label>
                <div className="flex gap-3 mt-1.5">
                  {['Pass', 'Fail', 'Inconclusive'].map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, testResult: r }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                        form.testResult === r
                          ? r === 'Pass' ? 'bg-emerald-600 border-emerald-600 text-white'
                            : r === 'Fail' ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500'
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sign-off */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Engineer *</label>
                  <input value={form.engineer} onChange={set('engineer')} className={inputCls} placeholder="Name" />
                </div>
                <div>
                  <label className={labelCls}>Witnessed By</label>
                  <input value={form.witnessedBy} onChange={set('witnessedBy')} className={inputCls} placeholder="Name / Company" />
                </div>
                <div>
                  <label className={labelCls}>Company</label>
                  <input value={form.company} onChange={set('company')} className={inputCls} placeholder="Contractor" />
                </div>
              </div>

              {/* Observations */}
              <div>
                <label className={labelCls}>Observations / Notes</label>
                <textarea value={form.observations} onChange={set('observations')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="Record any pressure drops, anomalies, remedial actions taken, or special conditions during the test..." />
              </div>

              {/* Photos */}
              <div>
                <label className={labelCls}>Photos / Evidence</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf" label="Upload gauge photos, site photos or evidence" />
              </div>

              {/* Completed by */}
              <div>
                <label className={labelCls}>Completed By *</label>
                <input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Person completing this record" />
              </div>
            </>
          )}

          {/* ── Flushing Record ── */}
          {isFlushingRecord && (
            <>
              <div className="bg-cyan-900/20 border border-cyan-700/40 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-cyan-300 mb-0.5 uppercase tracking-wider">Mechanical — System Flushing Record</p>
                <p className="text-xs text-cyan-300/70 leading-relaxed">Complete all fields following the flushing procedure. This record forms part of the project commissioning and water treatment documentation.</p>
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
                <div><label className={labelCls}>Date *</label><input type="date" value={form.date} onChange={set('date')} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Plot / Area *</label><input value={form.plotArea} onChange={set('plotArea')} className={inputCls} placeholder="e.g. Block B, Level 3" /></div>
                <div><label className={labelCls}>System / Service *</label><input value={form.systemService} onChange={set('systemService')} className={inputCls} placeholder="e.g. LTHW Flow & Return" /></div>
              </div>
              <div><label className={labelCls}>Pipework Description</label><input value={form.pipeworkDescription} onChange={set('pipeworkDescription')} className={inputCls} placeholder="e.g. 28mm copper, S&R from HIU to manifold" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Flush Medium *</label>
                  <div className="relative">
                    <select value={form.flushMedium} onChange={set('flushMedium')} className={`${inputCls} appearance-none pr-8`}>
                      {['Mains Water','Treated Water','Chemical Flush','Clean Water'].map(m => <option key={m}>{m}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div><label className={labelCls}>Water Temp (°C)</label><input value={form.flushTemperature} onChange={set('flushTemperature')} className={inputCls} placeholder="e.g. 60" /></div>
                <div><label className={labelCls}>Flush Duration</label><input value={form.flushDuration} onChange={set('flushDuration')} className={inputCls} placeholder="e.g. 2 hours" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Turbidity (NTU)</label><input value={form.turbidity} onChange={set('turbidity')} className={inputCls} placeholder="e.g. &lt;1 NTU" /></div>
                <div><label className={labelCls}>Chlorine Residual (mg/l)</label><input value={form.chlorineResidual} onChange={set('chlorineResidual')} className={inputCls} placeholder="e.g. 0.5 mg/l" /></div>
              </div>
              <div>
                <label className={labelCls}>Flush Result *</label>
                <div className="flex gap-3 mt-1.5">
                  {['Pass','Fail','Repeat Required'].map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, flushResult: r }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${form.flushResult === r ? r === 'Pass' ? 'bg-emerald-600 border-emerald-600 text-white' : r === 'Fail' ? 'bg-red-600 border-red-600 text-white' : 'bg-amber-500 border-amber-500 text-white' : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Engineer *</label><input value={form.engineer} onChange={set('engineer')} className={inputCls} placeholder="Name" /></div>
                <div><label className={labelCls}>Witnessed By</label><input value={form.flushWitnessedBy} onChange={set('flushWitnessedBy')} className={inputCls} placeholder="Name / Company" /></div>
                <div><label className={labelCls}>Company</label><input value={form.company} onChange={set('company')} className={inputCls} placeholder="Contractor" /></div>
              </div>
              <div><label className={labelCls}>Observations / Notes</label><textarea value={form.observations} onChange={set('observations')} rows={3} className={`${inputCls} resize-none`} placeholder="Record any abnormal readings, remedial actions, or conditions during flushing..." /></div>
              <div><label className={labelCls}>Photos / Evidence</label><FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf" label="Upload site photos, water quality certificates or evidence" /></div>
              <div><label className={labelCls}>Completed By *</label><input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Person completing this record" /></div>
            </>
          )}

          {/* ── Valve Checklist ── */}
          {isValveChecklist && (
            <>
              <div className="bg-indigo-900/20 border border-indigo-700/40 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-indigo-300 mb-0.5 uppercase tracking-wider">Mechanical — Valve Inspection Checklist</p>
                <p className="text-xs text-indigo-300/70 leading-relaxed">Complete for each valve inspected. Record all operational and leakage checks prior to commissioning sign-off.</p>
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
                <div><label className={labelCls}>Date *</label><input type="date" value={form.date} onChange={set('date')} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Plot / Area *</label><input value={form.plotArea} onChange={set('plotArea')} className={inputCls} placeholder="e.g. Plant Room A, Level 1" /></div>
                <div><label className={labelCls}>Valve Tag / Reference *</label><input value={form.valveTag} onChange={set('valveTag')} className={inputCls} placeholder="e.g. V-LT-001" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Valve Type *</label>
                  <div className="relative">
                    <select value={form.valveType} onChange={set('valveType')} className={`${inputCls} appearance-none pr-8`}>
                      {['Gate','Globe','Ball','Butterfly','Check','Pressure Relief','Control','Other'].map(t => <option key={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div><label className={labelCls}>Size (mm/in)</label><input value={form.valveSize} onChange={set('valveSize')} className={inputCls} placeholder="e.g. DN50" /></div>
                <div><label className={labelCls}>Location</label><input value={form.valveLocation} onChange={set('valveLocation')} className={inputCls} placeholder="e.g. LTHW flow, IDF-02" /></div>
              </div>
              {/* Check items */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Inspection Checks</p>
                {([
                  ['Operation Check', 'operationCheck', ['Pass','Fail','N/A']],
                  ['Seat Leakage', 'seatLeakageCheck', ['Pass','Fail','N/A']],
                  ['Gland Leakage', 'glandLeakageCheck', ['Pass','Fail','N/A']],
                  ['Position Indicator', 'positionIndicator', ['Satisfactory','Unsatisfactory','N/A']],
                  ['Actuator Check', 'actuatorCheck', ['Pass','Fail','N/A']],
                ] as [string, string, string[]][]).map(([label, key, opts]) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-400 w-36 shrink-0">{label}</span>
                    <div className="flex gap-2 flex-1">
                      {opts.map(o => (
                        <button key={o} type="button" onClick={() => setForm(f => ({ ...f, [key]: o }))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form[key] === o ? o === 'Pass' || o === 'Satisfactory' ? 'bg-emerald-600 border-emerald-600 text-white' : o === 'Fail' || o === 'Unsatisfactory' ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-600 border-slate-600 text-white' : 'bg-transparent border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>{o}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className={labelCls}>Overall Condition</label>
                <div className="flex gap-3 mt-1.5">
                  {['Satisfactory','Unsatisfactory','Defects Noted'].map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, overallCondition: r }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${form.overallCondition === r ? r === 'Satisfactory' ? 'bg-emerald-600 border-emerald-600 text-white' : r === 'Unsatisfactory' ? 'bg-red-600 border-red-600 text-white' : 'bg-amber-500 border-amber-500 text-white' : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Engineer *</label><input value={form.engineer} onChange={set('engineer')} className={inputCls} placeholder="Name" /></div>
                <div><label className={labelCls}>Witnessed By</label><input value={form.witnessedBy} onChange={set('witnessedBy')} className={inputCls} placeholder="Name / Company" /></div>
                <div><label className={labelCls}>Company</label><input value={form.company} onChange={set('company')} className={inputCls} placeholder="Contractor" /></div>
              </div>
              <div><label className={labelCls}>Defects / Observations</label><textarea value={form.observations} onChange={set('observations')} rows={3} className={`${inputCls} resize-none`} placeholder="Record any defects found, remedial actions required or conditions noted..." /></div>
              <div><label className={labelCls}>Photos / Evidence</label><FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf" label="Upload valve photos or defect evidence" /></div>
              <div><label className={labelCls}>Completed By *</label><input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Person completing this record" /></div>
            </>
          )}

          {/* ── AHU Commissioning ── */}
          {isAHUCommissioning && (
            <>
              <div className="bg-violet-900/20 border border-violet-700/40 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-violet-300 mb-0.5 uppercase tracking-wider">Mechanical — AHU Commissioning Record</p>
                <p className="text-xs text-violet-300/70 leading-relaxed">Complete all sections following commissioning of the air handling unit. This record forms part of the O&amp;M documentation handover.</p>
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
                <div><label className={labelCls}>Date *</label><input type="date" value={form.date} onChange={set('date')} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>AHU Tag / Reference *</label><input value={form.ahuTag} onChange={set('ahuTag')} className={inputCls} placeholder="e.g. AHU-01" /></div>
                <div><label className={labelCls}>Location</label><input value={form.ahuLocation} onChange={set('ahuLocation')} className={inputCls} placeholder="e.g. Plant Room, Roof Level" /></div>
                <div><label className={labelCls}>Plot / Area</label><input value={form.plotArea} onChange={set('plotArea')} className={inputCls} placeholder="e.g. Block A" /></div>
              </div>
              {/* Airflow & electrical */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Airflow & Electrical Data</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>Supply Airflow (l/s)</label><input value={form.supplyAirflow} onChange={set('supplyAirflow')} className={inputCls} placeholder="e.g. 450" /></div>
                  <div><label className={labelCls}>Return Airflow (l/s)</label><input value={form.returnAirflow} onChange={set('returnAirflow')} className={inputCls} placeholder="e.g. 420" /></div>
                  <div><label className={labelCls}>Supply Fan Amps</label><input value={form.supplyFanAmps} onChange={set('supplyFanAmps')} className={inputCls} placeholder="e.g. 3.2A" /></div>
                  <div><label className={labelCls}>Return Fan Amps</label><input value={form.returnFanAmps} onChange={set('returnFanAmps')} className={inputCls} placeholder="e.g. 2.8A" /></div>
                </div>
              </div>
              {/* Component condition checks */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Component Condition Checks</p>
                {([
                  ['Filter Condition', 'filterCondition', ['Clean','Dirty – Replaced','Dirty – Scheduled','N/A']],
                  ['Belt Condition', 'beltCondition', ['Satisfactory','Worn – Replaced','Worn – Scheduled','N/A']],
                  ['Dampers Operation', 'dampersOperation', ['Satisfactory','Stiff','Faulty','N/A']],
                  ['Condensate Tray', 'condensateTray', ['Clean','Dirty – Cleaned','Blocked','N/A']],
                  ['Vibration Check', 'vibrationCheck', ['Satisfactory','Excessive','N/A']],
                  ['Coil Condition', 'coilCondition', ['Clean','Fouled – Cleaned','Fouled – Scheduled','N/A']],
                ] as [string, string, string[]][]).map(([label, key, opts]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-36 shrink-0">{label}</span>
                    <div className="flex gap-1.5 flex-1 flex-wrap">
                      {opts.map(o => (
                        <button key={o} type="button" onClick={() => setForm(f => ({ ...f, [key]: o }))}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${form[key] === o ? o.startsWith('Clean') || o === 'Satisfactory' ? 'bg-emerald-600 border-emerald-600 text-white' : o.startsWith('Fault') || o.startsWith('Bloc') || o === 'Excessive' ? 'bg-red-600 border-red-600 text-white' : o.includes('Replaced') || o.includes('Cleaned') ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-600 border-slate-600 text-white' : 'bg-transparent border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>{o}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Temperature */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Setpoint Temperature (°C)</label><input value={form.setpointTemp} onChange={set('setpointTemp')} className={inputCls} placeholder="e.g. 22" /></div>
                <div><label className={labelCls}>Measured Temperature (°C)</label><input value={form.measuredTemp} onChange={set('measuredTemp')} className={inputCls} placeholder="e.g. 21.5" /></div>
              </div>
              <div>
                <label className={labelCls}>Overall Commissioning Result *</label>
                <div className="flex gap-3 mt-1.5">
                  {['Pass','Fail','Pass with Defects'].map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, ahuResult: r }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${form.ahuResult === r ? r === 'Pass' ? 'bg-emerald-600 border-emerald-600 text-white' : r === 'Fail' ? 'bg-red-600 border-red-600 text-white' : 'bg-amber-500 border-amber-500 text-white' : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Engineer *</label><input value={form.engineer} onChange={set('engineer')} className={inputCls} placeholder="Name" /></div>
                <div><label className={labelCls}>Witnessed By</label><input value={form.witnessedBy} onChange={set('witnessedBy')} className={inputCls} placeholder="Name / Company" /></div>
                <div><label className={labelCls}>Company</label><input value={form.company} onChange={set('company')} className={inputCls} placeholder="Contractor" /></div>
              </div>
              <div><label className={labelCls}>Observations / Defects Noted</label><textarea value={form.observations} onChange={set('observations')} rows={3} className={`${inputCls} resize-none`} placeholder="Record any defects, remedial actions or conditions noted during commissioning..." /></div>
              <div><label className={labelCls}>Photos / Evidence</label><FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf" label="Upload commissioning photos, data sheets or evidence" /></div>
              <div><label className={labelCls}>Completed By *</label><input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Person completing this record" /></div>
            </>
          )}

          {/* ── Dead Testing ── */}
          {isDeadTesting && (
            <>
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-yellow-300 mb-0.5 uppercase tracking-wider">Electrical — Dead Testing Record</p>
                <p className="text-xs text-yellow-300/70 leading-relaxed">Complete all insulation resistance and continuity tests with installation isolated. Results must be recorded prior to energisation. Ensure safe isolation is confirmed before testing.</p>
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
                <div><label className={labelCls}>Date *</label><input type="date" value={form.date} onChange={set('date')} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Plot / Area *</label><input value={form.plotArea} onChange={set('plotArea')} className={inputCls} placeholder="e.g. Distribution Board DB-03, Level 2" /></div>
                <div><label className={labelCls}>Circuit Reference *</label><input value={form.circuitRef} onChange={set('circuitRef')} className={inputCls} placeholder="e.g. DB-03/Way 4 — Ring Final" /></div>
              </div>
              <div><label className={labelCls}>Test Instrument / Serial No.</label><input value={form.testInstrument} onChange={set('testInstrument')} className={inputCls} placeholder="e.g. Megger MFT1835 S/N 123456 — Cal. 01/2026" /></div>
              {/* Insulation resistance */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Insulation Resistance (MΩ at 500V DC)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Phase L1 to Earth</label><input value={form.insulationPhaseL1} onChange={set('insulationPhaseL1')} className={inputCls} placeholder="MΩ" /></div>
                  <div><label className={labelCls}>Phase L2 to Earth</label><input value={form.insulationPhaseL2} onChange={set('insulationPhaseL2')} className={inputCls} placeholder="MΩ" /></div>
                  <div><label className={labelCls}>Phase L3 to Earth</label><input value={form.insulationPhaseL3} onChange={set('insulationPhaseL3')} className={inputCls} placeholder="MΩ" /></div>
                  <div><label className={labelCls}>Neutral to Earth</label><input value={form.insulationNeutral} onChange={set('insulationNeutral')} className={inputCls} placeholder="MΩ" /></div>
                </div>
              </div>
              {/* Continuity & other */}
              <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Continuity & Other Tests</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Ring Continuity (Ω)</label><input value={form.continuityRing} onChange={set('continuityRing')} className={inputCls} placeholder="Ω" /></div>
                  <div><label className={labelCls}>Earth Fault Loop (Ω)</label><input value={form.earthFault} onChange={set('earthFault')} className={inputCls} placeholder="Ω" /></div>
                </div>
                <div className="mt-3">
                  <label className={labelCls}>Polarity</label>
                  <div className="flex gap-3 mt-1.5">
                    {['Correct','Incorrect','N/A'].map(r => (
                      <button key={r} type="button" onClick={() => setForm(f => ({ ...f, polarity: r }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${form.polarity === r ? r === 'Correct' ? 'bg-emerald-600 border-emerald-600 text-white' : r === 'Incorrect' ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-600 border-slate-600 text-white' : 'bg-transparent border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>{r}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Overall Test Result *</label>
                <div className="flex gap-3 mt-1.5">
                  {['Pass','Fail','Inconclusive'].map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, deadTestResult: r }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${form.deadTestResult === r ? r === 'Pass' ? 'bg-emerald-600 border-emerald-600 text-white' : r === 'Fail' ? 'bg-red-600 border-red-600 text-white' : 'bg-amber-500 border-amber-500 text-white' : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Engineer *</label><input value={form.engineer} onChange={set('engineer')} className={inputCls} placeholder="Name" /></div>
                <div><label className={labelCls}>Witnessed By</label><input value={form.deadTestWitness} onChange={set('deadTestWitness')} className={inputCls} placeholder="Name / Company" /></div>
                <div><label className={labelCls}>Company</label><input value={form.company} onChange={set('company')} className={inputCls} placeholder="Contractor" /></div>
              </div>
              <div><label className={labelCls}>Observations / Notes</label><textarea value={form.observations} onChange={set('observations')} rows={3} className={`${inputCls} resize-none`} placeholder="Record any anomalies, failed readings, remedial actions taken..." /></div>
              <div><label className={labelCls}>Photos / Evidence</label><FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf" label="Upload test instrument readings, certificates or site photos" /></div>
              <div><label className={labelCls}>Completed By *</label><input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Person completing this record" /></div>
            </>
          )}

          {/* ── Continuity Test ── */}
          {isContinuityTest && (
            <>
              <div className="bg-lime-900/20 border border-lime-700/40 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-lime-300 mb-0.5 uppercase tracking-wider">Electrical — Continuity Test Record</p>
                <p className="text-xs text-lime-300/70 leading-relaxed">Record conductor resistance measurements for each circuit tested. All results must satisfy BS 7671 requirements before energisation.</p>
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
                <div><label className={labelCls}>Date *</label><input type="date" value={form.date} onChange={set('date')} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Plot / Area *</label><input value={form.plotArea} onChange={set('plotArea')} className={inputCls} placeholder="e.g. Level 2, Distribution Board DB-04" /></div>
                <div><label className={labelCls}>Circuit Reference *</label><input value={form.circuitRef} onChange={set('circuitRef')} className={inputCls} placeholder="e.g. DB-04 / Way 6" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Conductor Reference</label><input value={form.conductorRef} onChange={set('conductorRef')} className={inputCls} placeholder="e.g. CPC, N, L1" /></div>
                <div>
                  <label className={labelCls}>Conductor Type</label>
                  <div className="relative">
                    <select value={form.conductorType} onChange={set('conductorType')} className={`${inputCls} appearance-none pr-8`}>
                      {['CPC','Neutral','Phase L1','Phase L2','Phase L3','Other'].map(t => <option key={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div><label className={labelCls}>Conductor Length (m)</label><input value={form.conductorLength} onChange={set('conductorLength')} className={inputCls} placeholder="e.g. 25" /></div>
              </div>
              <div><label className={labelCls}>Test Instrument / Serial No.</label><input value={form.testInstrument} onChange={set('testInstrument')} className={inputCls} placeholder="e.g. Megger MFT1835 S/N 123456 — Cal. 01/2026" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Measured Resistance (Ω)</label><input value={form.measuredResistance} onChange={set('measuredResistance')} className={inputCls} placeholder="Ω" /></div>
                <div><label className={labelCls}>Calculated Resistance (Ω)</label><input value={form.calculatedResistance} onChange={set('calculatedResistance')} className={inputCls} placeholder="Ω" /></div>
                <div><label className={labelCls}>Deviation (%)</label><input value={form.deviationPercent} onChange={set('deviationPercent')} className={inputCls} placeholder="%" /></div>
              </div>
              <div>
                <label className={labelCls}>Test Result *</label>
                <div className="flex gap-3 mt-1.5">
                  {['Pass','Fail','Inconclusive'].map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, continuityResult: r }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${form.continuityResult === r ? r === 'Pass' ? 'bg-emerald-600 border-emerald-600 text-white' : r === 'Fail' ? 'bg-red-600 border-red-600 text-white' : 'bg-amber-500 border-amber-500 text-white' : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Engineer *</label><input value={form.engineer} onChange={set('engineer')} className={inputCls} placeholder="Name" /></div>
                <div><label className={labelCls}>Witnessed By</label><input value={form.continuityWitness} onChange={set('continuityWitness')} className={inputCls} placeholder="Name / Company" /></div>
                <div><label className={labelCls}>Company</label><input value={form.company} onChange={set('company')} className={inputCls} placeholder="Contractor" /></div>
              </div>
              <div><label className={labelCls}>Observations / Notes</label><textarea value={form.observations} onChange={set('observations')} rows={3} className={`${inputCls} resize-none`} placeholder="Record any deviations, failed tests, remedial actions or special conditions..." /></div>
              <div><label className={labelCls}>Photos / Evidence</label><FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf" label="Upload test readings or instrument printouts" /></div>
              <div><label className={labelCls}>Completed By *</label><input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Person completing this record" /></div>
            </>
          )}

          {/* ── Toolbox Talk ── */}
          {isToolboxTalk && (
            <>
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-amber-300 mb-0.5 uppercase tracking-wider">H&amp;S — Toolbox Talk Record</p>
                <p className="text-xs text-amber-300/70 leading-relaxed">Record the toolbox talk details and attendees. This document forms part of the project health &amp; safety file and demonstrates worker engagement and competence.</p>
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
                <div><label className={labelCls}>Date *</label><input type="date" value={form.date} onChange={set('date')} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Topic / Subject *</label><input value={form.tbtTopic} onChange={set('tbtTopic')} className={inputCls} placeholder="e.g. Working at Height, Manual Handling" /></div>
                <div><label className={labelCls}>Duration</label><input value={form.tbtDuration} onChange={set('tbtDuration')} className={inputCls} placeholder="e.g. 15 minutes" /></div>
                <div><label className={labelCls}>Location</label><input value={form.tbtLocation} onChange={set('tbtLocation')} className={inputCls} placeholder="e.g. Site cabin, Level 2" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Presented By *</label><input value={form.tbtPresentedBy} onChange={set('tbtPresentedBy')} className={inputCls} placeholder="Name / role" /></div>
                <div><label className={labelCls}>Company</label><input value={form.company} onChange={set('company')} className={inputCls} placeholder="Contractor" /></div>
              </div>
              <div>
                <label className={labelCls}>Attendees *</label>
                <textarea value={form.tbtAttendees} onChange={set('tbtAttendees')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="List attendee names and trades, one per line&#10;e.g. J. Smith — Mechanical Fitter&#10;T. Jones — Plumber&#10;M. Ali — Apprentice" />
              </div>
              <div>
                <label className={labelCls}>Key Points Covered *</label>
                <textarea value={form.tbtKeyPoints} onChange={set('tbtKeyPoints')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="Summarise the key safety points and topics discussed during the talk..." />
              </div>
              <div>
                <label className={labelCls}>Action Items / Follow-up</label>
                <textarea value={form.tbtActionItems} onChange={set('tbtActionItems')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="Record any actions arising from the talk, including who is responsible and target dates..." />
              </div>
              <div><label className={labelCls}>Site / Plot Area</label><input value={form.plotArea} onChange={set('plotArea')} className={inputCls} placeholder="e.g. Block A, whole site" /></div>
              <div><label className={labelCls}>Photos / Sign-in Sheet</label><FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf" label="Upload sign-in sheet or supporting materials" /></div>
              <div><label className={labelCls}>Sign-off / Confirmation</label><textarea value={form.tbtSignOff} onChange={set('tbtSignOff')} rows={2} className={`${inputCls} resize-none`} placeholder="e.g. All operatives confirmed they understood the content and had no questions." /></div>
              <div><label className={labelCls}>Completed By *</label><input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Person completing this record" /></div>
            </>
          )}

          {/* ── Site Walk Audit ── */}
          {isSiteWalkAudit && (
            <>
                <div className="bg-rose-900/20 border border-rose-700/40 rounded-xl px-4 py-3">
                  <p className="text-[11px] font-semibold text-rose-300 mb-0.5 uppercase tracking-wider">H&amp;S — Site Walk Audit</p>
                  <p className="text-xs text-rose-300/70 leading-relaxed">Complete all sections applicable to the site being audited. Flag all failures and required actions. This document forms part of the project Health &amp; Safety file.</p>
                </div>

                {/* Header fields */}
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
                    <label className={labelCls}>Site / Area *</label>
                    <input value={form.swaSiteArea} onChange={set('swaSiteArea')} className={inputCls} placeholder="e.g. Block A, Level 2" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Audit Date *</label>
                    <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Audit Time</label>
                    <input type="time" value={form.swaAuditTime} onChange={set('swaAuditTime')} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Auditor Name *</label>
                    <input value={form.swaAuditorName} onChange={set('swaAuditorName')} className={inputCls} placeholder="Person completing audit" />
                  </div>
                  <div>
                    <label className={labelCls}>Trade / Team</label>
                    <input value={form.swaTradeTeam} onChange={set('swaTradeTeam')} className={inputCls} placeholder="Trade being audited" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Site Manager</label>
                    <input value={form.swaSiteManager} onChange={set('swaSiteManager')} className={inputCls} placeholder="Site manager present" />
                  </div>
                  <div>
                    <label className={labelCls}>Weather Conditions</label>
                    <input value={form.swaWeather} onChange={set('swaWeather')} className={inputCls} placeholder="e.g. Fine, Wet, Windy" />
                  </div>
                </div>

                {/* Overall Status */}
                <div>
                  <label className={labelCls}>Overall Site Status</label>
                  <div className="flex gap-2 mt-1.5">
                    {(['Satisfactory', 'Improvement Required', 'Unsatisfactory', 'Stop Work'] as const).map(s => (
                      <button key={s} type="button" onClick={() => setForm(f => ({ ...f, swaOverallStatus: s }))}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${form.swaOverallStatus === s
                          ? s === 'Satisfactory' ? 'bg-emerald-600 border-emerald-600 text-white'
                            : s === 'Improvement Required' ? 'bg-amber-500 border-amber-500 text-white'
                            : s === 'Unsatisfactory' ? 'bg-orange-600 border-orange-600 text-white'
                            : 'bg-red-700 border-red-700 text-white'
                          : 'bg-transparent border-[#1e2d4a] text-slate-600 hover:border-slate-500'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 1: Housekeeping */}
                <SWASection title="1. Housekeeping & General" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['hk_clear_walkways',    'Walkways and access routes clear'],
                  ['hk_waste_segregation', 'Waste segregation in place'],
                  ['hk_materials_stored',  'Materials properly stored and stacked'],
                  ['hk_welfare_clean',     'Welfare facilities clean and stocked'],
                  ['hk_signage',           'Site signage adequate and legible'],
                ]} />

                {/* Section 2: PPE */}
                <SWASection title="2. Personal Protective Equipment (PPE)" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['ppe_hard_hat',      'Hard hats worn correctly'],
                  ['ppe_safety_boots',  'Safety boots / footwear appropriate'],
                  ['ppe_hi_vis',        'Hi-vis vests / clothing worn'],
                  ['ppe_eye_protection','Eye protection in use where required'],
                  ['ppe_gloves',        'Gloves appropriate to task'],
                  ['ppe_rpe',           'RPE in use where required'],
                ]} />

                {/* Section 3: Working at Height */}
                <SWASection title="3. Working at Height" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['wah_edge_protection',  'Edge protection / barriers in place'],
                  ['wah_ladders',          'Ladders inspected, footed and secured'],
                  ['wah_scaffold',         'Scaffold tagged and inspected'],
                  ['wah_mewp',             'MEWP pre-use checks completed'],
                  ['wah_harness',          'Harness/lanyard used where required'],
                  ['wah_exclusion_zone',   'Exclusion zones below WAH works'],
                ]} />

                {/* Section 4: Electrical Safety */}
                <SWASection title="4. Electrical Safety" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['elec_isolations',      'Electrical isolations in place / LOTO'],
                  ['elec_temp_supplies',   'Temporary supplies properly connected'],
                  ['elec_cable_mgmt',      'Cables managed, no trip hazards'],
                  ['elec_rcd_protection',  'RCD protection in use'],
                  ['elec_permits',         'Permit to Work in place where required'],
                ]} />

                {/* Section 5: Fire Safety */}
                <SWASection title="5. Fire Safety" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['fire_extinguishers',   'Fire extinguishers present and accessible'],
                  ['fire_routes',          'Fire escape routes clear'],
                  ['fire_hot_works',       'Hot works permit in place if applicable'],
                  ['fire_detection',       'Fire detection not obstructed'],
                  ['fire_assembly_point',  'Assembly point identified and communicated'],
                ]} />

                {/* Section 6: Manual Handling */}
                <SWASection title="6. Manual Handling & Lifting" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['mh_techniques',      'Correct manual handling techniques used'],
                  ['mh_mechanical_aids', 'Mechanical aids used where available'],
                  ['mh_lifting_plan',    'Lifting plan in place for crane / MEWP lifts'],
                  ['mh_loads_secure',    'Loads properly secured during movement'],
                ]} />

                {/* Section 7: Plant & Equipment */}
                <SWASection title="7. Plant & Equipment" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['plant_inspections',  'Plant pre-use inspections completed'],
                  ['plant_operators',    'Operators hold valid certification'],
                  ['plant_exclusion',    'Plant exclusion zones in place'],
                  ['plant_banksman',     'Banksman/slinger in place for lifting ops'],
                  ['plant_maintenance',  'Plant visually in good condition'],
                ]} />

                {/* Section 8: Hazardous Substances */}
                <SWASection title="8. Hazardous Substances (COSHH)" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['coshh_storage',      'Hazardous substances stored correctly'],
                  ['coshh_datasheets',   'COSHH data sheets available on site'],
                  ['coshh_spill_kits',   'Spill kits available where required'],
                  ['coshh_ventilation',  'Adequate ventilation for chemical use'],
                ]} />

                {/* Section 9: Permits & Documentation */}
                <SWASection title="9. Permits & Documentation" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['docs_rams',          'RAMS briefed and signed by all operatives'],
                  ['docs_inductions',    'Site inductions completed for all personnel'],
                  ['docs_ptw',           'Permit to Work system in use where required'],
                  ['docs_cscs_cards',    'CSCS/ECS cards available and valid'],
                  ['docs_f10',           'F10 notification current and displayed'],
                ]} />

                {/* Section 10: Welfare */}
                <SWASection title="10. Welfare Facilities" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['welfare_toilets',    'Toilets — adequate, clean and supplied'],
                  ['welfare_washing',    'Washing facilities — hot water available'],
                  ['welfare_canteen',    'Canteen / rest area available'],
                  ['welfare_water',      'Drinking water available'],
                  ['welfare_first_aid',  'First aid kit stocked and accessible'],
                ]} />

                {/* Section 11: Environmental */}
                <SWASection title="11. Environmental Controls" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['env_waste',          'Waste disposed of correctly'],
                  ['env_dust',           'Dust suppression measures in place'],
                  ['env_noise',          'Noise controls in place / hours observed'],
                  ['env_drainage',       'Drainage and run-off controlled'],
                ]} />

                {/* Section 12: M&E Specific */}
                <SWASection title="12. M&E Specific Checks" checklist={swaChecklist} onUpdate={updateSwaCheck} items={[
                  ['me_cable_routes',    'Cable routes marked / protected'],
                  ['me_pipe_supports',   'Pipe supports installed correctly'],
                  ['me_test_equipment',  'Test equipment calibrated and in date'],
                  ['me_commissioning',   'Commissioning areas clearly identified'],
                  ['me_interfaces',      'M&E service interfaces coordinated'],
                ]} />

                {/* Section 13: Observations */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">13. Observations & Actions</p>
                  <div>
                    <label className={labelCls}>Positive Observations</label>
                    <textarea value={form.swaPositiveObservations} onChange={set('swaPositiveObservations')} rows={2}
                      className={`${inputCls} resize-none`} placeholder="Good practices observed on site..." />
                  </div>
                  <div>
                    <label className={labelCls}>Key Risks Identified</label>
                    <textarea value={form.swaKeyRisks} onChange={set('swaKeyRisks')} rows={2}
                      className={`${inputCls} resize-none`} placeholder="Outstanding risks requiring attention..." />
                  </div>
                  <div>
                    <label className={labelCls}>Immediate Actions Required</label>
                    <textarea value={form.swaImmediateActions} onChange={set('swaImmediateActions')} rows={2}
                      className={`${inputCls} resize-none`} placeholder="Actions required immediately / stop-work items..." />
                  </div>
                  <div>
                    <label className={labelCls}>Further Actions Required</label>
                    <textarea value={form.swaFurtherActions} onChange={set('swaFurtherActions')} rows={2}
                      className={`${inputCls} resize-none`} placeholder="Actions required within agreed timescales..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Responsible Person</label>
                      <input value={form.swaResponsiblePerson} onChange={set('swaResponsiblePerson')} className={inputCls} placeholder="Person actioning findings" />
                    </div>
                    <div>
                      <label className={labelCls}>Close-out Date</label>
                      <input type="date" value={form.swaCloseOutDate} onChange={set('swaCloseOutDate')} className={inputCls} />
                    </div>
                  </div>
                </div>

                {/* Section 14: Re-inspection & Sign-off */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">14. Re-inspection & Sign-off</p>
                  <div>
                    <label className={labelCls}>Re-inspection Required?</label>
                    <div className="flex gap-2 mt-1.5">
                      {(['Yes', 'No'] as const).map(v => (
                        <button key={v} type="button" onClick={() => setForm(f => ({ ...f, swaReinspectionRequired: v }))}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${form.swaReinspectionRequired === v
                            ? v === 'Yes' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-transparent border-[#1e2d4a] text-slate-600 hover:border-slate-500'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.swaReinspectionRequired === 'Yes' && (
                    <div>
                      <label className={labelCls}>Re-inspection Date</label>
                      <input type="date" value={form.swaReinspectionDate} onChange={set('swaReinspectionDate')} className={inputCls} />
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Overall Comments</label>
                    <textarea value={form.swaOverallComments} onChange={set('swaOverallComments')} rows={3}
                      className={`${inputCls} resize-none`} placeholder="Summary of audit findings and overall assessment..." />
                  </div>
                  <div>
                    <label className={labelCls}>Completed By *</label>
                    <input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Person completing this audit" />
                  </div>
                  <div>
                    <label className={labelCls}>Photos / Evidence</label>
                    <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf"
                      label="Upload site photos, evidence of findings or defects" />
                  </div>
                </div>
            </>
          )}

          {/* Common fields fallback */}
          {!isRFI && !isHoldUp && !isDelay && !isVariation && !isEWN && !isSI && !isTQ && !isHS
            && !isPressureTest && !isFlushingRecord && !isValveChecklist && !isAHUCommissioning
            && !isDeadTesting && !isContinuityTest && !isToolboxTalk && !isSiteWalkAudit
            && !isECR && !isDaily && !isRAMS && (
            <>
              <div>
                <label className={labelCls}>Project</label>
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
              <div>
                <label className={labelCls}>Completed By *</label>
                <input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Your name" />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={set('description')} rows={4}
                  className={`${inputCls} resize-none`} placeholder="Provide details..." />
              </div>
              <div>
                <label className={labelCls}>Attachments</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} />
              </div>
            </>
          )}

        </div>{/* end p-6 space-y-5 */}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2d4a]">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-slate-500 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => handleAction('Submitted')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all ${accentColor}`}>
            {isRFI ? 'Submit RFI'
              : isHoldUp ? 'Issue Hold Up Notice'
              : isDelay ? 'Issue Delay Notice'
              : isVariation ? 'Submit Variation'
              : isEWN ? 'Issue Early Warning'
              : isSI ? 'Issue Site Instruction'
              : isTQ ? 'Submit Technical Query'
              : isHS ? 'Submit H&S Record'
              : isPressureTest ? 'Submit Pressure Test'
              : isFlushingRecord ? 'Submit Flushing Record'
              : isValveChecklist ? 'Submit Valve Checklist'
              : isAHUCommissioning ? 'Submit AHU Commissioning'
              : isDeadTesting ? 'Submit Dead Test Record'
              : isContinuityTest ? 'Submit Continuity Test'
              : isToolboxTalk ? 'Submit Toolbox Talk'
              : isSiteWalkAudit ? 'Submit Site Walk Audit'
              : isECR ? 'Submit Electrical Commissioning Report'
              : isDaily ? 'Submit Site Report'
              : isRAMS ? 'Issue Risk Assessment'
              : 'Submit Form'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────
interface ViewModalProps {
  form: ExtendedSiteForm;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function ViewModal({ form, onClose, onEdit, onDelete }: ViewModalProps) {
  const store = useAppStore();
  const perms = usePermissions();
  const canEdit   = perms['site_forms.edit'];
  const canDelete = perms['site_forms.delete'];

  const typeEntry = TYPE_MAP[form.type] ?? { bg: 'bg-slate-700', text: 'text-slate-300', label: form.type, border: '' };
  const statusColors: Record<string, string> = {
    Draft: 'bg-slate-700 text-slate-300', Submitted: 'bg-blue-900/60 text-blue-300',
    Approved: 'bg-emerald-900/60 text-emerald-300', Closed: 'bg-slate-800 text-slate-500',
    Open: 'bg-amber-900/60 text-amber-300', Resolved: 'bg-emerald-900/60 text-emerald-300',
    Escalated: 'bg-red-900/60 text-red-300', 'Action Required': 'bg-red-900/60 text-red-300',
  };

  const handlePrint = () => {
    const isECR  = form.type === 'Electrical Commissioning Report';
    const isDSR  = form.type === 'Daily Site Report';
    const isRAMS = form.type === 'Risk Assessment';
    const isPT   = form.type === 'Pressure Test';
    const isFL   = form.type === 'Flushing Record';
    const isVC   = form.type === 'Valve Checklist';
    const isAHU  = form.type === 'AHU Commissioning';
    const isDT   = form.type === 'Dead Testing';
    const isCT   = form.type === 'Continuity Test';
    const isTBT  = form.type === 'Toolbox Talk';
    const isSWA  = form.type === 'Site Walk Audit';
    const typeLabel   = TYPE_MAP[form.type]?.label ?? form.type;
    const formTitle   = form.title || '(Untitled)';
    const esc         = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const safe        = (v: unknown) => v ? esc(String(v)) : '';
    const fmtDate     = (d: string) => { try { return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); } catch { return d; } };
    const metaRow     = (label: string, value: string) => value
      ? `<tr><td style="padding:3px 6px 3px 0;color:#64748b;font-size:10px;font-weight:600;width:180px;vertical-align:top">${esc(label)}</td><td style="padding:3px 0;color:#1e293b;font-size:10px">${value}</td></tr>`
      : '';
    const pdfLabel    = form.type === 'Risk Assessment' ? 'Risk Assessment / RAMS' : form.type === 'Daily Site Report' ? 'Daily Site Report' : typeLabel;
    const section     = (label: string, content: string) => content ? `<div style="margin-top:14px;page-break-inside:avoid"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid #e8ecf0">${esc(label)}</div><div style="background:#f8fafc;border:1px solid #e8ecf0;border-radius:5px;padding:10px 12px;font-size:11.5px;color:#334155;line-height:1.65;white-space:pre-wrap">${esc(content)}</div></div>` : '';
    const sectionHtml = (label: string, content: string) => content ? `<div style="margin-top:14px;page-break-inside:avoid"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid #e8ecf0">${esc(label)}</div><div style="font-size:11.5px;color:#334155;line-height:1.65">${content}</div></div>` : '';
    const legalBox    = (text: string, accent = '#f97316') => `<div style="margin-top:14px;border-left:3px solid ${accent};background:#fffbf5;border:1px solid #fed7aa;border-radius:5px;padding:10px 14px;page-break-inside:avoid"><div style="font-size:8.5px;color:#92400e;line-height:1.6">${esc(text)}</div></div>`;

    const riskColor = (s: number) => s<=4?'background:#dcfce7;color:#166534':s<=9?'background:#fef9c3;color:#854d0e':s<=16?'background:#fed7aa;color:#9a3412':'background:#fee2e2;color:#991b1b';
    const riskLabel = (s: number) => s<=4?'Low':s<=9?'Medium':s<=16?'High':'Critical';

    let ramsHazardHtml = '';
    if (isRAMS && form.ramsHazards) {
      try {
        const hazards: HazardRecord[] = JSON.parse(form.ramsHazards as string);
        if (hazards.length) {
          const tally = {Low:0,Medium:0,High:0,Critical:0};
          hazards.forEach(h => { const s=h.residualLikelihood*h.residualSeverity; tally[riskLabel(s) as keyof typeof tally]++; });
          ramsHazardHtml = `<div style="display:flex;gap:10px;margin-bottom:14px">${Object.entries(tally).map(([l,c])=>{const col=l==='Low'?'#166534;background:#dcfce7':l==='Medium'?'#854d0e;background:#fef9c3':l==='High'?'#9a3412;background:#fed7aa':'#991b1b;background:#fee2e2';return `<div style="flex:1;text-align:center;border:1px solid #e2e8f0;border-radius:6px;padding:8px"><div style="font-size:9px;font-weight:700;color:${col.split(';')[0]};text-transform:uppercase">${l}</div><div style="font-size:20px;font-weight:900;color:${col.split(';')[0]}">${c}</div></div>`;}).join('')}</div>`
            + hazards.map((h,i)=>{const iS=h.initLikelihood*h.initSeverity;const rS=h.residualLikelihood*h.residualSeverity;return `<div style="border:1px solid #e2e8f0;border-radius:6px;margin-bottom:12px;overflow:hidden;page-break-inside:avoid"><div style="background:#f8fafc;padding:8px 12px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between"><div style="font-size:11px;font-weight:700;color:#1e293b">Hazard ${i+1}${h.category?': '+esc(h.category):''}</div><div style="display:flex;gap:6px"><span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;${riskColor(iS)}">Initial: ${iS} - ${riskLabel(iS)}</span><span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;${riskColor(rS)}">Residual: ${rS} - ${riskLabel(rS)}</span></div></div><div style="padding:10px 12px"><table style="width:100%;border-collapse:collapse;font-size:10px">${h.hazardDescription?`<tr><td style="padding:3px 6px 3px 0;color:#64748b;font-weight:600;width:160px">Hazard</td><td style="color:#1e293b">${esc(h.hazardDescription)}</td></tr>`:''} ${h.existingControls?`<tr><td style="padding:3px 6px 3px 0;color:#64748b;font-weight:600">Existing Controls</td><td style="color:#1e293b">${esc(h.existingControls)}</td></tr>`:''}</table>${h.additionalControls?`<div style="margin-top:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:8px"><div style="font-size:9px;font-weight:700;color:#166534;text-transform:uppercase;margin-bottom:3px">Additional Controls</div><div style="font-size:10px;color:#1e293b">${esc(h.additionalControls)}</div></div>`:''}</div></div>`;}).join('');
        }
      } catch { /* ignore */ }
    }

    let ramsSignOffHtml = '';
    if (isRAMS && form.ramsSignOffs) {
      try {
        const sigs: RamsSignOffRecord[] = JSON.parse(form.ramsSignOffs as string);
        if (sigs.length) {
          ramsSignOffHtml = `<table style="width:100%;border-collapse:collapse;font-size:10px"><tr style="background:#f8fafc"><th style="padding:5px 8px;text-align:left;color:#64748b;font-size:9px;font-weight:700;border-bottom:1px solid #e2e8f0">Name</th><th style="padding:5px 8px;text-align:left;color:#64748b;font-size:9px;font-weight:700;border-bottom:1px solid #e2e8f0">Company</th><th style="padding:5px 8px;text-align:left;color:#64748b;font-size:9px;font-weight:700;border-bottom:1px solid #e2e8f0">Role</th><th style="padding:5px 8px;text-align:left;color:#64748b;font-size:9px;font-weight:700;border-bottom:1px solid #e2e8f0">Date</th><th style="padding:5px 8px;text-align:center;color:#64748b;font-size:9px;font-weight:700;border-bottom:1px solid #e2e8f0">RAMS</th><th style="padding:5px 8px;text-align:center;color:#64748b;font-size:9px;font-weight:700;border-bottom:1px solid #e2e8f0">Briefed</th><th style="padding:5px 8px;color:#64748b;font-size:9px;font-weight:700;border-bottom:1px solid #e2e8f0">Signature</th></tr>${sigs.map(s=>`<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:6px 8px;font-weight:600;color:#1e293b">${esc(s.name)}</td><td style="padding:6px 8px;color:#475569">${esc(s.company)}</td><td style="padding:6px 8px;color:#475569">${esc(s.role)}</td><td style="padding:6px 8px;color:#475569">${s.date?fmtDate(s.date):''}</td><td style="padding:6px 8px;text-align:center"><span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:20px;${s.ramsRead?'background:#dcfce7;color:#166534':'background:#fee2e2;color:#991b1b'}">${s.ramsRead?'Y':'N'}</span></td><td style="padding:6px 8px;text-align:center"><span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:20px;${s.briefingCompleted?'background:#dcfce7;color:#166534':'background:#fee2e2;color:#991b1b'}">${s.briefingCompleted?'Y':'N'}</span></td><td style="padding:6px 8px;min-width:100px"></td></tr>`).join('')}</table>`;
        }
      } catch { /* ignore */ }
    }

    const renderRows = (jsonStr: string|undefined, cols: string[], mapper: (r: Record<string,unknown>)=>string) => {
      if (!jsonStr) return '';
      try {
        const rows = JSON.parse(jsonStr as string) as Record<string,unknown>[];
        if (!rows.length) return '';
        return `<table style="width:100%;border-collapse:collapse;font-size:10px"><tr style="background:#f8fafc">${cols.map(c=>`<th style="padding:4px 6px;text-align:left;color:#64748b;font-size:9px;border-bottom:1px solid #e2e8f0">${c}</th>`).join('')}</tr>${rows.map(mapper).join('')}</table>`;
      } catch { return ''; }
    };

    const legalMap: Partial<Record<string,string>> = {
      'Hold Up Notice': 'This notice formally records operational impacts. The issuing party reserves the right to recover costs and programme impacts.',
      'Delay Notice': 'Issued pursuant to the applicable building contract. All rights to extension of time and associated costs are expressly reserved.',
      'Variation': 'Issued in accordance with contract conditions. No work should proceed until written authorisation has been received.',
      'Early Warning Notice': 'Issued pursuant to applicable contract conditions to draw attention to a matter which could affect cost, programme, quality or performance.',
      'Site Instruction': 'Issued by the authorised representative. The receiving party is required to carry out the instructed works in accordance with the contract.',
      'RFI': 'Issued to obtain a formal response. The response should be provided within the requested timescale to avoid programme impact.',
      'Technical Query': 'Raised to seek clarification on technical matters. A formal written response is required.',
      'QA Inspection': 'Completed in accordance with the project Quality Management Plan and applicable standards.',
      'Daily Site Report': 'A contemporaneous record of site activities, attendance, conditions and progress on the date stated.',
      'Electrical Commissioning Report': 'A contemporaneous record of electrical commissioning activities. All works carried out in accordance with BS 7671 and the project specification.',
      'Risk Assessment': 'Prepared in accordance with the Health and Safety at Work Act 1974, the Management of Health and Safety at Work Regulations 1999, and CDM Regulations 2015. This document must be briefed to all operatives before works commence.',
    };

    const orgName = store.settings?.company_name || 'VYSITE';
    const orgLogo = store.settings?.logo_data_url;

    const header = `<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #e2e8f0"><div>${orgLogo?`<img src="${orgLogo}" style="height:36px;margin-bottom:8px;display:block"/>`:`<div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px">${esc(orgName)}</div>`}<div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em">Site Forms - ${esc(pdfLabel)}</div></div><div style="text-align:right"><div style="font-size:18px;font-weight:800;color:#0f172a">${esc(formTitle)}</div><div style="font-size:10px;color:#64748b;margin-top:3px">${form.date?fmtDate(form.date as string):''}${form.status?` - ${esc(form.status as string)}`:''}${form.projectName?` - ${esc(form.projectName as string)}`:''}</div>${form.completedBy?`<div style="font-size:10px;color:#94a3b8;margin-top:2px">By: ${esc(form.completedBy as string)}</div>`:''}</div></div>`;

    const metaTable = `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:4px">${metaRow('Type',typeLabel)}${metaRow('Project',safe(form.projectName))}${metaRow('Date',form.date?fmtDate(form.date as string):'')}${metaRow('Completed By',safe(form.completedBy))}${metaRow('Status',safe(form.status))}${isECR?[metaRow('Lead Engineer',safe(form.ecrLeadEngineer)),metaRow('System',safe(form.ecrSystemBeingCommissioned)),metaRow('Overall Status',safe(form.ecrOverallStatus))].join(''):''}${isDSR?[metaRow('Site Manager',safe(form.dsrSiteManager)),metaRow('Weather',safe(form.dsrWeather)),metaRow('Operatives',safe(form.dsrOperativesOnSite))].join(''):''}${isRAMS?[metaRow('RAMS Ref',safe(form.ramsRef)),metaRow('Trade',safe(form.ramsTradePackage)),metaRow('Location',safe(form.ramsLocationOfWorks)),metaRow('Overall Risk',safe(form.ramsOverallRiskRating))].join(''):''}</table>`;

    const body = `${header}<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:10px">${metaTable}</div>
${section('Description',safe(form.description))}${section('Subject',safe(form.subject))}${section('Question / Request',safe(form.question))}${section('Response',safe(form.response))}${section('Cause',safe(form.cause))}${section('Impact',safe(form.impact))}${section('Actions Required',safe(form.actionsRequired))}${section('Findings',safe(form.findings))}
${isPT?section('Test Pressure',`${safe(form.testPressure)} ${safe(form.testPressureUnit)}`):''}${isPT?section('Test Result',safe(form.testResult)):''}${isPT?section('Witnessed By',safe(form.witnessedBy)):''}
${isFL?section('Flush Result',safe(form.flushResult)):''}${isVC?section('Valve Tag',safe(form.valveTag)):''}${isVC?section('Overall Condition',safe(form.overallCondition)):''}
${isAHU?section('AHU Result',safe(form.ahuResult)):''}${isDT?section('Dead Test Result',safe(form.deadTestResult)):''}${isCT?section('Continuity Result',safe(form.continuityResult)):''}
${isTBT?section('Talk Topic',safe(form.tbtTopic)):''}${isTBT?section('Attendees',safe(form.tbtAttendees)):''}${isTBT?section('Key Points Covered',safe(form.tbtKeyPoints)):''}
${isSWA?section('Overall Status',safe(form.swaOverallStatus)):''}${isSWA?section('Immediate Actions',safe(form.swaImmediateActions)):''}${isSWA?section('Overall Comments',safe(form.swaOverallComments)):''}
${isECR?section('Areas Completed',safe(form.ecrAreasCompleted)):''}${isECR?section('Key Achievements',safe(form.ecrKeyAchievements)):''}${isECR?section('Key Blockers',safe(form.ecrKeyBlockers)):''}${isECR?section("Tomorrow's Works",safe(form.ecrTomorrowWorks)):''}${isECR?section('Overall Comments',safe(form.ecrOverallComments)):''}
${isDSR?section('Works Carried Out Today',safe(form.description)):''}${isDSR?section('Issues Encountered',safe(form.dsrIssuesEncountered)):''}${isDSR?section("Tomorrow's Planned Works",safe(form.dsrTomorrowPlanned)):''}
${isDSR&&form.dsrAttendees?sectionHtml('Operative Attendance',renderRows(form.dsrAttendees as string,['Name','Company','Trade','Time In','Time Out'],(r)=>`<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:5px 6px;font-weight:600;color:#1e293b">${esc(String(r.name||''))}</td><td style="padding:5px 6px;color:#475569">${esc(String(r.company||''))}</td><td style="padding:5px 6px;color:#475569">${esc(String(r.trade||''))}</td><td style="padding:5px 6px;color:#475569">${String(r.timeIn||'')}</td><td style="padding:5px 6px;color:#475569">${String(r.timeOut||'')}</td></tr>`)):''}
${isRAMS?section('Scope of Works',safe(form.ramsScopeOfWorks)):''}${isRAMS?section('Sequence of Works',safe(form.ramsSequenceOfWorks)):''}${isRAMS?section('Plant & Equipment',safe(form.ramsPlantEquipment)):''}
${isRAMS&&ramsHazardHtml?sectionHtml('Hazard & Risk Assessment',ramsHazardHtml):''}
${isRAMS?section('PPE Requirements',safe(form.ramsPpe)):''}${isRAMS?section('Emergency Procedures',safe(form.ramsEmergencyProcedure)):''}${isRAMS?section('First Aid',safe(form.ramsFirstAid)):''}
${isRAMS&&ramsSignOffHtml?sectionHtml('RAMS Briefing - Operative Sign-Off',ramsSignOffHtml):''}
${!isPT&&!isFL&&!isVC&&!isAHU&&!isDT&&!isCT&&!isTBT&&!isSWA&&!isECR&&!isDSR&&!isRAMS?section('Notes',safe(form.comments)||safe(form.notes)):''}
${legalMap[form.type]?legalBox(legalMap[form.type]!,form.type==='Risk Assessment'?'#ea580c':'#f97316'):''}
<div style="margin-top:24px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between"><div style="font-size:8.5px;color:#cbd5e1">Generated by ${esc(orgName)} - ${new Date().toLocaleDateString('en-GB')}</div><div style="font-size:8.5px;color:#cbd5e1">VYSITE Platform</div></div>`;

    openPrintTab(buildPrintDocument(`${pdfLabel} - ${esc(formTitle)} - VYSITE`,`h1{font-size:18px;font-weight:800;color:#0f172a;margin:0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:4px 6px}`,body));
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-3xl my-4">
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
          <div className="flex items-center gap-3">
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${typeEntry.bg} ${typeEntry.text}`}>{typeEntry.label}</div>
            <div>
              <h2 className="text-base font-bold text-white leading-snug">{form.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {form.date ? new Date(form.date as string).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : ''}
                {form.projectName ? ` - ${form.projectName}` : ''}
                {form.completedBy ? ` - ${form.completedBy}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusColors[form.status as string] ?? 'bg-slate-700 text-slate-300'}`}>{form.status}</span>
            <button onClick={handlePrint} title="Print / Export PDF" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e2d4a] transition-colors"><Printer size={16} /></button>
            {canEdit && onEdit && <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e2d4a] transition-colors"><Edit2 size={16} /></button>}
            {canDelete && onDelete && <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"><Trash2 size={16} /></button>}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={16} /></button>
          </div>
        </div>
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {form.projectName && <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3"><p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Project</p><p className="text-xs font-semibold text-white">{form.projectName as string}</p></div>}
            {form.date && <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3"><p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date</p><p className="text-xs font-semibold text-white">{new Date(form.date as string).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</p></div>}
            {form.completedBy && <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3"><p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Completed By</p><p className="text-xs font-semibold text-white">{form.completedBy as string}</p></div>}
          </div>
          {form.type === 'Risk Assessment' && form.ramsRef && (
            <div className="bg-orange-900/20 border border-orange-700/40 rounded-xl p-3">
              <p className="text-[9px] font-bold text-orange-400 uppercase tracking-wider mb-2">Risk Assessment</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {form.ramsRef && <div><span className="text-slate-500">Ref: </span><span className="text-white font-semibold">{form.ramsRef as string}</span></div>}
                {form.ramsOverallRiskRating && <div><span className="text-slate-500">Risk: </span><span className="text-orange-300 font-bold">{form.ramsOverallRiskRating as string}</span></div>}
              </div>
            </div>
          )}
          {form.description && <div><p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</p><p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{form.description as string}</p></div>}
          {form.ramsScopeOfWorks && <div><p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Scope of Works</p><p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{form.ramsScopeOfWorks as string}</p></div>}
          {(form.comments || form.notes) && <div><p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Comments / Notes</p><p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{String(form.comments || form.notes || '')}</p></div>}
        </div>
      </div>
    </div>
  );
}

// ─── Main SiteForms Page ───────────────────────────────────────────────────────
interface SiteFormsProps {
  pendingOpen?: import('../App').PendingOpen | null;
  onPendingOpenConsumed?: () => void;
  pendingFilter?: import('../App').PendingFilter | null;
  onPendingFilterConsumed?: () => void;
}

export default function SiteForms(_props: SiteFormsProps = {}) {
  const store    = useAppStore();
  const perms    = usePermissions();
  const canCreate = perms['site_forms.create'];
  const canEdit   = perms['site_forms.edit'];
  const canDelete = perms['site_forms.delete'];
  const [view, setView]                           = useState<'grid'|'list'>('list');
  const [search, setSearch]                       = useState('');
  const [filterType, setFilterType]               = useState<string>('All');
  const [showBuilder, setShowBuilder]             = useState(false);
  const [editingForm, setEditingForm]             = useState<ExtendedSiteForm|null>(null);
  const [viewingForm, setViewingForm]             = useState<ExtendedSiteForm|null>(null);
  const [builderType, setBuilderType]             = useState<ExtendedFormType>('QA Inspection');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId]               = useState<string|null>(null);

  const forms = (store.siteForms ?? []) as unknown as ExtendedSiteForm[];

  const TYPE_SHORT: Record<string,string> = {
    'Pressure Test':'Pressure Test','Flushing Record':'Flushing','Valve Checklist':'Valve Check',
    'AHU Commissioning':'AHU','Dead Testing':'Dead Test','Continuity Test':'Continuity',
    'Daily Site Report':'Daily Report','QA Inspection':'QA','RFI':'RFI','Technical Query':'TQ',
    'H&S Inspection':'H&S','Toolbox Talk':'Toolbox Talk','Hold Up Notice':'Hold Up',
    'Delay Notice':'Delay','Variation':'Variation','Early Warning Notice':'Early Warning',
    'Site Instruction':'Site Instruction','Site Walk Audit':'Site Walk Audit',
    'Electrical Commissioning Report':'Elec Commissioning','Risk Assessment':'Risk Assessment',
  };

  const allTypes = Array.from(new Set(forms.map(f => f.type ?? '').filter(Boolean)));
  const filtered = forms.filter(f => {
    const matchSearch = !search || f.title?.toLowerCase().includes(search.toLowerCase()) || f.projectName?.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (filterType === 'All' || f.type === filterType);
  });

  const handleSave = (data: ExtendedSiteForm, files: UploadedFile[]) => {
    const extra = { ...data } as Record<string,unknown>;
    ['id','type','projectId','projectName','date','completedBy','description','comments','status','submittedDate','notes'].forEach(k => delete extra[k]);
    const dbForm: DBSiteForm = {
      id: editingForm?.id ?? data.id ?? `f${Date.now()}`,
      type: data.type, project_id: store.projects.find(p=>p.name===data.projectName)?.id??'',
      project_name: data.projectName??'', date: data.date??'', completed_by: data.completedBy??'',
      description: data.description??'', comments: data.comments??'', status: data.status??'Draft',
      notes: data.notes??'', form_comments: [], extra_data: { ...extra, attachments: files },
    };
    if (editingForm) { store.updateSiteForm(dbForm); } else { store.addSiteForm(dbForm); }
    setShowBuilder(false); setEditingForm(null);
  };

  const handleDelete = (id: string) => { setDeletingId(id); setShowDeleteConfirm(true); };
  const confirmDelete = async () => {
    if (deletingId) {
      await store.removeSiteForm(deletingId);
      setShowDeleteConfirm(false); setDeletingId(null);
      if (viewingForm?.id === deletingId) setViewingForm(null);
    }
  };
  const openNewForm = (type: ExtendedFormType) => { setBuilderType(type); setEditingForm(null); setShowBuilder(true); };
  const openEdit = (form: ExtendedSiteForm) => { setBuilderType(form.type as ExtendedFormType); setEditingForm(form); setViewingForm(null); setShowBuilder(true); };

  const FORM_CATEGORIES = [
    { id:'general',  label:'General',               icon:<Calendar size={18}/>,   iconBg:'bg-orange-900/60', iconText:'text-orange-300', borderAccent:'hover:border-orange-700/60',
      templates:[{type:'Daily Site Report',title:'Daily Site Report',description:'Full operational DSR - attendance, progress, delays, H&S, materials, sign-off'}]},
    { id:'mechanical',label:'Mechanical',            icon:<Wrench size={18}/>,     iconBg:'bg-sky-900/60',    iconText:'text-sky-300',    borderAccent:'hover:border-sky-700/60',
      templates:[
        {type:'Pressure Test',    title:'Pressure Test Record',    description:'Record pressure test details, results and witness sign-off'},
        {type:'Flushing Record',  title:'Flushing Record',         description:'Record system flushing details, water quality and sign-off'},
        {type:'Valve Checklist',  title:'Valve Commissioning',     description:'Valve operation, leakage and condition check record'},
        {type:'AHU Commissioning',title:'AHU Commissioning Record',description:'Record AHU airflows, fan data, filter/coil conditions and result'},
      ]},
    { id:'electrical',label:'Electrical',            icon:<Zap size={18}/>,        iconBg:'bg-yellow-900/60', iconText:'text-yellow-300', borderAccent:'hover:border-yellow-700/60',
      templates:[
        {type:'Electrical Commissioning Report',title:'Electrical Commissioning Report',description:'Daily ECR - shift, team, progress, testing, blockers, sign-off'},
        {type:'Dead Testing',   title:'Dead Test Record', description:'Electrical dead testing - insulation resistance and polarity'},
        {type:'Continuity Test',title:'Continuity Test',  description:'Record conductor continuity resistance measurements'},
      ]},
    { id:'hs',        label:'H&S',                   icon:<HardHat size={18}/>,    iconBg:'bg-amber-900/60',  iconText:'text-amber-300',  borderAccent:'hover:border-amber-700/60',
      templates:[
        {type:'Risk Assessment',title:'Risk Assessment / RAMS', description:'Professional RAMS - hazard table, risk scoring, control measures, operative sign-off'},
        {type:'Site Walk Audit',title:'Site Walk Audit',        description:'Full 14-section site walk audit - housekeeping, WAH, PPE, fire, M&E compliance'},
        {type:'Toolbox Talk',   title:'Toolbox Talk',           description:'Record toolbox talk topic, attendees, key points and actions'},
        {type:'H&S Inspection', title:'H&S Inspection',        description:'Health & safety site inspections and observations'},
        {type:'H&S Inspection', title:'Near Miss / Incident',  description:'Record near miss incidents and site accidents'},
      ]},
    { id:'qa',        label:'QA / Compliance',        icon:<CheckSquare size={18}/>,iconBg:'bg-teal-900/60',   iconText:'text-teal-300',   borderAccent:'hover:border-teal-700/60',
      templates:[
        {type:'QA Inspection',  title:'QA Inspection',          description:'Record a quality assurance inspection against a checklist or specification'},
        {type:'RFI',            title:'Request for Information', description:'Raise a formal RFI to obtain clarification on design or specification'},
        {type:'Technical Query',title:'Technical Query',        description:'Submit a technical query for a formal written response'},
      ]},
    { id:'commercial',label:'Commercial',             icon:<DollarSign size={18}/>, iconBg:'bg-blue-900/60',   iconText:'text-blue-300',   borderAccent:'hover:border-blue-700/60',
      templates:[
        {type:'Variation',           title:'Variation Notice',     description:'Issue a formal variation notice for additional works or changes to scope'},
        {type:'Early Warning Notice',title:'Early Warning Notice', description:'Formally notify of a risk to cost, programme or quality'},
        {type:'Delay Notice',        title:'Delay Notice',         description:'Formally record a delay event and its programme impact'},
        {type:'Hold Up Notice',      title:'Hold Up Notice',       description:'Notify of works being held up and the operational impact'},
      ]},
    { id:'subcontractor',label:'Sub-Contractor Notices',icon:<Users size={18}/>,   iconBg:'bg-slate-700',     iconText:'text-slate-300',  borderAccent:'hover:border-slate-600',
      templates:[
        {type:'Site Instruction',title:'Site Instruction',      description:'Issue a formal site instruction to a sub-contractor or trade'},
        {type:'Hold Up Notice',  title:'Sub-Contractor Notice', description:'Issue a formal notice to a sub-contractor regarding site compliance or performance'},
      ]},
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Site Forms</h1>
          <p className="text-sm text-slate-500 mt-0.5">{forms.length} record{forms.length!==1?'s':''}</p>
        </div>
      </div>

      {/* Form template categories */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">New Form</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {FORM_CATEGORIES.map(cat => (
            <div key={cat.id} className={`bg-[#1a2236] border border-[#1e2d4a] rounded-xl transition-colors group/cat`}>
              {/* Category header */}
              <div className={`flex items-center gap-3 px-4 py-3 border-b border-[#1e2d4a]`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cat.iconBg} ${cat.iconText}`}>{cat.icon}</div>
                <span className="text-sm font-semibold text-white">{cat.label}</span>
              </div>
              {/* Template buttons */}
              <div className="p-2 space-y-1">
                {cat.templates.map(t => (
                  <button key={`${t.type}-${t.title}`} onClick={() => canCreate && openNewForm(t.type as ExtendedFormType)} disabled={!canCreate}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#0d1628] border border-transparent hover:border-[#1e2d4a] transition-all group disabled:opacity-40 disabled:cursor-not-allowed">
                    <div className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors leading-snug">{t.title}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5 leading-snug line-clamp-2">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Records section — only shown when there are records */}
      {forms.length > 0 && (
        <div className="pt-2">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Records</p>
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search forms..."
                className="w-full bg-[#1a2236] border border-[#1e2d4a] rounded-lg pl-9 pr-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 outline-none focus:border-slate-500" />
            </div>
            <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
              {['All',...allTypes].map(t => (
                <button key={t} onClick={()=>setFilterType(t)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${filterType===t?'bg-[#f97316] text-white':'text-slate-500 hover:text-slate-300'}`}>
                  {TYPE_SHORT[t]??t}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={()=>setView('list')} className={`p-1.5 rounded-lg border transition-all ${view==='list'?'bg-[#1e2d4a] border-slate-500 text-white':'border-[#1e2d4a] text-slate-500 hover:text-slate-300'}`}><List size={14}/></button>
              <button onClick={()=>setView('grid')} className={`p-1.5 rounded-lg border transition-all ${view==='grid'?'bg-[#1e2d4a] border-slate-500 text-white':'border-[#1e2d4a] text-slate-500 hover:text-slate-300'}`}><LayoutGrid size={14}/></button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-600">
          <FileText size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">{forms.length===0?'No records yet. Select a template above to create your first form.':'No forms match your search.'}</p>
        </div>
      ) : (
        <div className={view==='grid'?'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3':'space-y-1.5'}>
          {filtered.map(f => {
            const te = TYPE_MAP[f.type] ?? {bg:'bg-slate-700',text:'text-slate-300',label:f.type,border:'border-l-slate-600'};
            return (
              <div key={f.id}
                className={`bg-[#1a2236] border ${f.status==='Action Required'?'border-red-900/60':'border-[#1e2d4a]'} border-l-4 ${te.border} rounded-xl p-4 hover:border-slate-500 hover:bg-[#1e2d4a]/30 transition-all group cursor-pointer`}
                onClick={()=>setViewingForm(f)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${te.bg} ${te.text} shrink-0`}>{te.label}</span>
                      {f.status && <span className={`text-[9px] font-semibold shrink-0 ${f.status==='Action Required'?'text-red-400':f.status==='Approved'?'text-emerald-400':f.status==='Submitted'?'text-blue-400':'text-slate-500'}`}>{f.status}</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors truncate">{f.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {f.date?new Date(f.date as string).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):''}
                      {f.projectName?` · ${f.projectName}`:''}
                      {f.completedBy?` · ${f.completedBy}`:''}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {canEdit && <button onClick={e=>{e.stopPropagation();openEdit(f);}} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#0d1628] transition-colors"><Edit2 size={13}/></button>}
                    {canDelete && <button onClick={e=>{e.stopPropagation();handleDelete(f.id);}} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"><Trash2 size={13}/></button>}
                  </div>
                </div>
                {(f.description||f.ramsScopeOfWorks) && <p className="text-[11px] text-slate-600 mt-1.5 line-clamp-1 leading-snug">{String(f.description||f.ramsScopeOfWorks||'')}</p>}
              </div>
            );
          })}
        </div>
      )}

      {showBuilder && <FormBuilder type={builderType} onSave={handleSave} onClose={()=>{setShowBuilder(false);setEditingForm(null);}} />}
      {viewingForm && <ViewModal form={viewingForm} onClose={()=>setViewingForm(null)} onEdit={()=>openEdit(viewingForm)} onDelete={()=>handleDelete(viewingForm.id)} />}
      {showDeleteConfirm && <ConfirmDeleteModal title="Delete Form Record" description="Are you sure you want to delete this form record? This action cannot be undone." onConfirm={confirmDelete} onCancel={()=>{setShowDeleteConfirm(false);setDeletingId(null);}} />}
    </div>
  );
}
