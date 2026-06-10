import { X, CreditCard as Edit2, Trash2, Printer } from 'lucide-react';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import { type ExtendedSiteForm, TYPE_MAP } from './types';
import {
  type HazardRecord, type RamsSignOffRecord,
  ViewField, SWAChecklistView,
  type PlantAssetRecord, type PlantDefectRecord,
} from './SubComponents';
import { renderFormPDF } from './PDFRenderer';

interface ViewModalProps {
  form: ExtendedSiteForm;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  Draft:             'bg-slate-700 text-slate-300',
  Submitted:         'bg-blue-900/60 text-blue-300',
  Approved:          'bg-emerald-900/60 text-emerald-300',
  Closed:            'bg-slate-800 text-slate-500',
  Open:              'bg-yellow-900/60 text-yellow-300',
  Acknowledged:      'bg-cyan-900/60 text-cyan-300',
  Actioned:          'bg-violet-900/60 text-violet-300',
  Resolved:          'bg-emerald-900/60 text-emerald-300',
  Escalated:         'bg-red-900/60 text-red-300',
  'Action Required': 'bg-red-900/60 text-red-300',
  Issued:            'bg-sky-900/60 text-sky-300',
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-[#1e2d4a] pb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Field2Col({ items }: { items: [string, string | undefined | null][] }) {
  const visible = items.filter(([, v]) => v);
  if (!visible.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {visible.map(([label, value]) => (
        <div key={label} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-xs font-semibold text-white leading-snug">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ResultBadge({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  const isPass = /pass/i.test(value);
  const isFail = /fail/i.test(value);
  const color = isPass ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700/40'
    : isFail ? 'bg-red-900/60 text-red-300 border-red-700/40'
    : 'bg-amber-900/60 text-amber-300 border-amber-700/40';
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${color}`}>
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function AttachmentsView({ attachments }: { attachments?: unknown }) {
  if (!attachments || !Array.isArray(attachments) || !attachments.length) return null;
  const files = attachments as { name?: string; dataUrl?: string; url?: string; type?: string }[];
  return (
    <Section label="Attachments & Evidence">
      <div className="space-y-2">
        {files.map((f, i) => {
          const src = f.dataUrl || f.url;
          const isImage = f.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name ?? '');
          return (
            <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl overflow-hidden">
              {isImage && src ? (
                <img src={src} alt={f.name ?? 'attachment'} className="w-full max-h-64 object-contain bg-black/30" />
              ) : null}
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-slate-400 flex-1 truncate">{f.name ?? 'File'}</span>
                {src && (
                  <a href={src} download={f.name} target="_blank" rel="noreferrer"
                    className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 shrink-0">
                    Download
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function ViewModal({ form, onClose, onEdit, onDelete }: ViewModalProps) {
  const store = useAppStore();
  const perms = usePermissions();
  const canEdit   = perms['site_forms.edit'];
  const canDelete = perms['site_forms.delete'];

  const typeEntry = TYPE_MAP[form.type] ?? { bg: 'bg-slate-700', text: 'text-slate-300', label: form.type, border: '' };
  const f = form as unknown as Record<string, unknown>;
  const s = (key: string) => f[key] ? String(f[key]) : undefined;

  const fmtDate = (d?: string | null) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
  };


  const handlePrint = () => renderFormPDF(form, store.settings);


  const isPT  = form.type === 'Pressure Test';
  const isFL  = form.type === 'Flushing Record';
  const isVC  = form.type === 'Valve Checklist';
  const isAHU = form.type === 'AHU Commissioning';
  const isDT  = form.type === 'Dead Testing';
  const isCT  = form.type === 'Continuity Test';
  const isTBT = form.type === 'Toolbox Talk';
  const isSWA = form.type === 'Site Walk Audit';
  const isECR = form.type === 'Electrical Commissioning Report';
  const isDSR = form.type === 'Daily Site Report';
  const isRAMS = form.type === 'Risk Assessment';
  const isRFI  = form.type === 'RFI';
  const isTQ   = form.type === 'Technical Query';
  const isHS   = form.type === 'H&S Inspection';
  const isCommercial = ['Hold Up Notice','Delay Notice','Variation','Early Warning Notice'].includes(form.type);
  const isSI   = form.type === 'Site Instruction';
  const isAIR  = form.type === 'Accident / Incident Report';
  const isPCR  = form.type === 'Plantroom Commissioning Record';
  const isMVHR = form.type === 'MVHR Commissioning Record';
  const isQA   = form.type === 'QA Inspection';

  // Parse JSON arrays for view
  let ramsHazards: HazardRecord[] = [];
  if (isRAMS && form.ramsHazards) { try { ramsHazards = JSON.parse(form.ramsHazards as string); } catch { /* */ } }
  let ramsSignOffs: RamsSignOffRecord[] = [];
  if (isRAMS && form.ramsSignOffs) { try { ramsSignOffs = JSON.parse(form.ramsSignOffs as string); } catch { /* */ } }
  let dsrAttendees: { name: string; company: string; trade: string; timeIn: string; timeOut: string }[] = [];
  if (isDSR && form.dsrAttendees) { try { dsrAttendees = JSON.parse(form.dsrAttendees as string); } catch { /* */ } }
  let ecrAttendees: { name: string; company: string; trade: string; timeIn: string; timeOut: string }[] = [];
  if (isECR && form.ecrAttendees) { try { ecrAttendees = JSON.parse(form.ecrAttendees as string); } catch { /* */ } }
  interface EcrDelayRec { delayType: string; areaAffected: string; duration: string; severity: string; programmeImpact: string; description: string; }
  let ecrDelays: EcrDelayRec[] = [];
  if (isECR && form.ecrDelays) { try { ecrDelays = JSON.parse(form.ecrDelays as string); } catch { /* */ } }
  let ecrActivities: Record<string, { status: string; comment: string }> = {};
  if (isECR && form.ecrActivities) { try { ecrActivities = JSON.parse(form.ecrActivities as string); } catch { /* */ } }
  let ecrQaChecklist: Record<string, { result: string; comment: string }> = {};
  if (isECR && form.ecrQaChecklist) { try { ecrQaChecklist = JSON.parse(form.ecrQaChecklist as string); } catch { /* */ } }
  let dsrDelays: EcrDelayRec[] = [];
  if (isDSR && form.dsrDelays) { try { dsrDelays = JSON.parse(form.dsrDelays as string); } catch { /* */ } }
  let airImmediateActionsList: string[] = [];
  if (isAIR && form.airImmediateActions) { try { airImmediateActionsList = JSON.parse(form.airImmediateActions as string); } catch { /* */ } }
  let airWitnessStatements: { name: string; company: string; contact: string; statement: string }[] = [];
  if (isAIR && form.airWitnessStatements) { try { airWitnessStatements = JSON.parse(form.airWitnessStatements as string); } catch { /* */ } }
  let pcrAssets: PlantAssetRecord[] = [];
  if (isPCR && form.pcrAssets) { try { pcrAssets = JSON.parse(form.pcrAssets as string); } catch { /* */ } }
  let pcrDefects: PlantDefectRecord[] = [];
  if (isPCR && form.pcrDefects) { try { pcrDefects = JSON.parse(form.pcrDefects as string); } catch { /* */ } }
  const parsePcrSet = (key: string): string[] => {
    if (!f[key]) return [];
    try { return JSON.parse(f[key] as string) as string[]; } catch { return []; }
  };

  interface MVHRRoom { roomName: string; roomType: string; designSupply: string; actualSupply: string; designExtract: string; actualExtract: string; passOrFail: string; comments: string; }
  interface MVHRDefect { description: string; responsiblePerson: string; dueDate: string; status: string; comments: string; }
  let mvhrRooms: MVHRRoom[] = [];
  if (isMVHR && form.mvhrRooms) { try { mvhrRooms = JSON.parse(form.mvhrRooms as string); } catch { /* */ } }
  let mvhrDefects: MVHRDefect[] = [];
  if (isMVHR && form.mvhrDefects) { try { mvhrDefects = JSON.parse(form.mvhrDefects as string); } catch { /* */ } }
  const parseMvhrSet = (key: string): string[] => {
    if (!f[key]) return [];
    try { return JSON.parse(f[key] as string) as string[]; } catch { return []; }
  };

  const attachments = f.attachments;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-3xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${typeEntry.bg} ${typeEntry.text}`}>{typeEntry.label}</div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white leading-snug truncate">{form.title || '(Untitled)'}</h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {fmtDate(form.date as string)}
                {form.projectName ? ` · ${form.projectName}` : ''}
                {form.completedBy ? ` · ${form.completedBy}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[form.status as string] ?? 'bg-slate-700 text-slate-300'}`}>{form.status}</span>
            <button onClick={handlePrint} title="Print / Export PDF" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e2d4a] transition-colors"><Printer size={16} /></button>
            {canEdit && onEdit && <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e2d4a] transition-colors"><Edit2 size={16} /></button>}
            {canDelete && onDelete && <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"><Trash2 size={16} /></button>}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={16} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Core meta */}
          <Field2Col items={[
            ['Project', s('projectName')],
            ['Date', fmtDate(s('date'))],
            ['Completed By', s('completedBy')],
          ]} />

          {/* Description / general */}
          {!isQA && form.description && <ViewField label="Description" value={form.description as string} />}

          {/* ── RFI ── */}
          {isRFI && <>
            <Field2Col items={[['RFI Ref', s('rfiRef')], ['Required Response Date', fmtDate(s('requiredResponseDate'))], ['Raised By', s('raisedBy')], ['Assigned To', s('assignedTo')]]} />
            <ViewField label="Subject" value={s('subject')} />
            <ViewField label="Question / Request" value={s('question')} />
            <ViewField label="Response" value={s('response')} />
            {s('notes') && <ViewField label="Notes" value={s('notes')} />}
          </>}

          {/* ── TQ ── */}
          {isTQ && <>
            <Field2Col items={[['TQ Ref', s('tqRef')], ['Priority', s('priority')], ['Drawing Ref', s('drawingRef')], ['Assigned To', s('assignedTo')], ['Required By', fmtDate(s('requiredResponseDate'))]]} />
            <ViewField label="Subject" value={s('subject')} />
            <ViewField label="Question" value={s('question')} />
            <ViewField label="Response" value={s('response')} />
          </>}

          {/* ── H&S Inspection ── */}
          {isHS && <>
            <Field2Col items={[['Inspection Date', fmtDate(s('inspectionDate'))], ['Type', s('inspectionType')], ['Risk Level', s('riskLevel')], ['Area Inspected', s('areaInspected')], ['Inspector', s('inspectorName')]]} />
            <ViewField label="Findings" value={s('findings')} />
            <ViewField label="Actions Required" value={s('actionsRequired')} />
            {s('notes') && <ViewField label="Notes" value={s('notes')} />}
          </>}

          {/* ── Commercial Notices ── */}
          {isCommercial && <>
            <Field2Col items={[['Notice Ref', s('noticeRef')], ['Variation Ref', s('variationRef')], ['Variation Status', s('variationStatus')], ['Area / Location', s('areaLocation')], ['Instruction Source', s('instructionSource')], ['Raised By', s('raisedBy')]]} />
            <ViewField label="Cause" value={s('cause')} />
            <ViewField label="Impact" value={s('impact')} />
            <ViewField label="Programme Impact" value={s('programmeImpact')} />
            <ViewField label="Commercial Impact" value={s('commercialImpact')} />
            <ViewField label="Cost Impact" value={s('costImpact')} />
            {s('notes') && <ViewField label="Notes" value={s('notes')} />}
          </>}

          {/* ── Site Instruction ── */}
          {isSI && <>
            <Field2Col items={[['Issued By', s('raisedBy')], ['Issued To', s('instructionSource')]]} />
            <ViewField label="Instruction" value={s('description')} />
            {s('notes') && <ViewField label="Notes" value={s('notes')} />}
          </>}

          {/* ── Pressure Test ── */}
          {isPT && <>
            <Section label="Pressure Test Details">
              <Field2Col items={[['Plot / Area', s('plotArea')], ['System / Service', s('systemService')], ['Test Medium', s('testMedium')], ['Test Pressure', s('testPressure') ? `${s('testPressure')} ${s('testPressureUnit')}` : undefined], ['Start Time', s('startTime')], ['End Time', s('endTime')], ['Duration on Test', s('durationOnTest')], ['Engineer', s('engineer')], ['Company', s('company')], ['Witnessed By', s('witnessedBy')]]} />
              <ViewField label="Pipework Description" value={s('pipeworkDescription')} />
              <ViewField label="Observations" value={s('observations')} />
            </Section>
            <ResultBadge label="Pressure Test Result" value={s('testResult')} />
          </>}

          {/* ── Flushing Record ── */}
          {isFL && <>
            <Section label="Flushing Details">
              <Field2Col items={[['Plot / Area', s('plotArea')], ['System / Service', s('systemService')], ['Flush Medium', s('flushMedium')], ['Temperature', s('flushTemperature')], ['Duration', s('flushDuration')], ['Turbidity (NTU)', s('turbidity')], ['Chlorine Residual', s('chlorineResidual')], ['Engineer', s('engineer')], ['Company', s('company')], ['Witnessed By', s('flushWitnessedBy')]]} />
              {s('pipeworkDescription') && <ViewField label="Pipework Description" value={s('pipeworkDescription')} />}
              <ViewField label="Observations" value={s('observations')} />
            </Section>
            <ResultBadge label="Flush Result" value={s('flushResult')} />
          </>}

          {/* ── Valve Checklist ── */}
          {isVC && <>
            <Section label="Valve Details">
              <Field2Col items={[['Plot / Area', s('plotArea')], ['Valve Tag', s('valveTag')], ['Type', s('valveType')], ['Size', s('valveSize')], ['Location', s('valveLocation')], ['Engineer', s('engineer')], ['Witnessed By', s('witnessedBy')]]} />
              <Field2Col items={[['Operation Check', s('operationCheck')], ['Seat Leakage', s('seatLeakageCheck')], ['Gland Leakage', s('glandLeakageCheck')], ['Position Indicator', s('positionIndicator')], ['Actuator Check', s('actuatorCheck')]]} />
              <ViewField label="Observations" value={s('observations')} />
            </Section>
            <ResultBadge label="Overall Condition" value={s('overallCondition')} />
          </>}

          {/* ── AHU Commissioning ── */}
          {isAHU && <>
            <Section label="AHU Details">
              <Field2Col items={[['AHU Tag', s('ahuTag')], ['Location', s('ahuLocation')], ['Supply Airflow', s('supplyAirflow')], ['Return Airflow', s('returnAirflow')], ['Supply Fan Amps', s('supplyFanAmps')], ['Return Fan Amps', s('returnFanAmps')], ['Filter Condition', s('filterCondition')], ['Belt Condition', s('beltCondition')], ['Dampers Operation', s('dampersOperation')], ['Condensate Tray', s('condensateTray')], ['Vibration Check', s('vibrationCheck')], ['Coil Condition', s('coilCondition')], ['Setpoint Temp', s('setpointTemp')], ['Measured Temp', s('measuredTemp')]]} />
              <ViewField label="Observations" value={s('observations')} />
            </Section>
            <ResultBadge label="AHU Commissioning Result" value={s('ahuResult')} />
          </>}

          {/* ── Dead Testing ── */}
          {isDT && <>
            <Section label="Dead Test Details">
              <Field2Col items={[['Circuit Ref', s('circuitRef')], ['Plot / Area', s('plotArea')], ['Test Instrument', s('testInstrument')], ['L1 Insulation Resistance', s('insulationPhaseL1')], ['L2 Insulation Resistance', s('insulationPhaseL2')], ['L3 Insulation Resistance', s('insulationPhaseL3')], ['Neutral Insulation Resistance', s('insulationNeutral')], ['Continuity Ring', s('continuityRing')], ['Earth Fault Loop', s('earthFault')], ['Polarity', s('polarity')], ['Engineer', s('engineer')], ['Witnessed By', s('deadTestWitness')]]} />
              {s('observations') && <ViewField label="Observations" value={s('observations')} />}
            </Section>
            <ResultBadge label="Dead Test Result" value={s('deadTestResult')} />
          </>}

          {/* ── Continuity Test ── */}
          {isCT && <>
            <Section label="Continuity Test Details">
              <Field2Col items={[['Conductor Ref', s('conductorRef')], ['Circuit Ref', s('circuitRef')], ['Conductor Type', s('conductorType')], ['Length (m)', s('conductorLength')], ['Test Instrument', s('testInstrument')], ['Measured Resistance (Ω)', s('measuredResistance')], ['Calculated Resistance (Ω)', s('calculatedResistance')], ['Deviation (%)', s('deviationPercent')], ['Engineer', s('engineer')], ['Witnessed By', s('continuityWitness')]]} />
            </Section>
            <ResultBadge label="Continuity Test Result" value={s('continuityResult')} />
          </>}

          {/* ── Toolbox Talk ── */}
          {isTBT && <>
            <Field2Col items={[['Topic', s('tbtTopic')], ['Duration', s('tbtDuration')], ['Location', s('tbtLocation')], ['Presented By', s('tbtPresentedBy')], ['Company', s('company')]]} />
            <ViewField label="Key Points Covered" value={s('tbtKeyPoints')} />
            <ViewField label="Attendees" value={s('tbtAttendees')} />
            <ViewField label="Action Items" value={s('tbtActionItems')} />
            <ViewField label="Sign Off" value={s('tbtSignOff')} />
          </>}

          {/* ── Site Walk Audit ── */}
          {isSWA && <>
            <Field2Col items={[['Site Area', s('swaSiteArea')], ['Audit Time', s('swaAuditTime')], ['Auditor', s('swaAuditorName')], ['Weather', s('swaWeather')], ['Trade / Team', s('swaTradeTeam')], ['Site Manager', s('swaSiteManager')]]} />
            <ResultBadge label="Overall Status" value={s('swaOverallStatus')} />
            <ViewField label="Positive Observations" value={s('swaPositiveObservations')} />
            <ViewField label="Key Risks Identified" value={s('swaKeyRisks')} />
            <ViewField label="Immediate Actions Required" value={s('swaImmediateActions')} />
            <ViewField label="Further Actions / Follow-Up" value={s('swaFurtherActions')} />
            {form.swaChecklist && (
              <Section label="Checklist Results">
                <SWAChecklistView checklistJson={form.swaChecklist as string} />
              </Section>
            )}
            <Field2Col items={[['Responsible Person', s('swaResponsiblePerson')], ['Close-Out Date', fmtDate(s('swaCloseOutDate'))], ['Re-inspection Required', s('swaReinspectionRequired')], ['Re-inspection Date', fmtDate(s('swaReinspectionDate'))]]} />
            <ViewField label="Overall Comments" value={s('swaOverallComments')} />
          </>}

          {/* ── Electrical Commissioning Report ── */}
          {isECR && <>
            <Field2Col items={[['Shift', s('ecrShift')], ['Lead Engineer', s('ecrLeadEngineer')], ['Company', s('ecrCompany')], ['Main Contractor', s('ecrMainContractor')], ['System Being Commissioned', s('ecrSystemBeingCommissioned')], ['Overall Status', s('ecrOverallStatus')], ['Site Area', s('ecrSiteArea')], ['Weather', s('ecrWeather')], ['Ticket Ref', s('ecrTicketRef')], ['Permit Refs', s('ecrPermitRefs')], ['% Progress', s('ecrPercentProgress')], ['Labour Progress', s('ecrProgressLabour')]]} />
            {ecrAttendees.length > 0 && (
              <Section label="Operative Attendance">
                <div className="space-y-1.5">
                  {ecrAttendees.map((op, i) => (
                    <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 grid grid-cols-3 gap-2 text-xs">
                      <span className="text-white font-semibold">{op.name}</span>
                      <span className="text-slate-400">{op.company} · {op.trade}</span>
                      <span className="text-slate-500">{op.timeIn} – {op.timeOut}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
            <ViewField label="Areas Completed" value={s('ecrAreasCompleted')} />
            <ViewField label="Areas In Progress" value={s('ecrAreasInProgress')} />
            {s('ecrAreasDelayed') && <ViewField label="Areas Delayed" value={s('ecrAreasDelayed')} />}
            {s('ecrActualWorks') && <ViewField label="Actual Works Completed" value={s('ecrActualWorks')} />}
            <ViewField label="Key Achievements" value={s('ecrKeyAchievements')} />
            <ViewField label="Key Blockers" value={s('ecrKeyBlockers')} />
            {ecrDelays.length > 0 && (
              <Section label={`Delays / Issues (${ecrDelays.length})`}>
                <div className="space-y-1.5">
                  {ecrDelays.map((d, i) => (
                    <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-900/60 text-amber-300">{d.delayType || 'Delay'}</span>
                        {d.severity && <span className="text-slate-400">{d.severity}</span>}
                        {d.duration && <span className="text-slate-500">{d.duration}</span>}
                        {d.areaAffected && <span className="text-slate-400">{d.areaAffected}</span>}
                      </div>
                      {d.description && <p className="text-slate-200">{d.description}</p>}
                      {d.programmeImpact && <p className="text-slate-400 italic mt-0.5">Programme: {d.programmeImpact}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {Object.keys(ecrActivities).length > 0 && (
              <Section label="Activity Status">
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(ecrActivities).map(([activity, entry]) => (
                    <div key={activity} className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-300 truncate">{activity}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${entry.status === 'Complete' ? 'bg-emerald-900/60 text-emerald-300' : entry.status === 'In Progress' ? 'bg-amber-900/60 text-amber-300' : entry.status === 'Not Applicable' ? 'bg-slate-700 text-slate-500' : 'bg-sky-900/60 text-sky-300'}`}>{entry.status}</span>
                      </div>
                      {entry.comment && <p className="text-slate-500 italic mt-0.5 text-[10px]">{entry.comment}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {Object.keys(ecrQaChecklist).length > 0 && (
              <Section label="QA Checklist">
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(ecrQaChecklist).map(([item, entry]) => (
                    <div key={item} className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-300 truncate">{item}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${entry.result === 'Yes' ? 'bg-emerald-900/60 text-emerald-300' : entry.result === 'No' ? 'bg-red-900/60 text-red-300' : 'bg-slate-700 text-slate-500'}`}>{entry.result}</span>
                      </div>
                      {entry.comment && <p className="text-slate-500 italic mt-0.5 text-[10px]">{entry.comment}</p>}
                    </div>
                  ))}
                </div>
                {s('ecrQaComments') && <ViewField label="QA Comments" value={s('ecrQaComments')} />}
              </Section>
            )}
            <ViewField label="Tomorrow's Works" value={s('ecrTomorrowWorks')} />
            <ViewField label="Required Support" value={s('ecrRequiredSupport')} />
            <ViewField label="Overall Comments" value={s('ecrOverallComments')} />
            <Field2Col items={[['Lead Sign', s('ecrSignLead')], ['Witness Sign', s('ecrSignWitness')], ['Site Manager Sign', s('ecrSignSiteManager')], ['Contractor Sign', s('ecrSignContractor')]]} />
          </>}

          {/* ── Daily Site Report ── */}
          {isDSR && <>
            <Field2Col items={[['Site Manager', s('dsrSiteManager')], ['Weather', s('dsrWeather')], ['Temperature', s('dsrTemperature')], ['Site Conditions', s('dsrSiteConditions')], ['Operatives On Site', s('dsrOperativesOnSite')], ['Visitors', s('dsrVisitors')], ['Start Time', s('dsrStartTime')], ['Finish Time', s('dsrFinishTime')], ['Break Duration', s('dsrBreakDuration')], ['Total Hours', s('dsrTotalHours')]]} />
            {dsrAttendees.length > 0 && (
              <Section label="Operative Attendance">
                <div className="space-y-1.5">
                  {dsrAttendees.map((op, i) => (
                    <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 grid grid-cols-3 gap-2 text-xs">
                      <span className="text-white font-semibold">{op.name}</span>
                      <span className="text-slate-400">{op.company} · {op.trade}</span>
                      <span className="text-slate-500">{op.timeIn} – {op.timeOut}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
            <ViewField label="Areas Worked In" value={s('dsrAreasWorkedIn')} />
            <ViewField label="Works Completed" value={s('dsrWorksCompleted')} />
            <ViewField label="Systems Worked On" value={s('dsrSystemsWorkedOn')} />
            {s('dsrEquipmentWorkedOn') && <ViewField label="Equipment Worked On" value={s('dsrEquipmentWorkedOn')} />}
            <ViewField label="Testing Completed" value={s('dsrTestingCompleted')} />
            <ViewField label="Materials Installed" value={s('dsrMaterialsInstalled')} />
            {s('dsrMaterialsUsed') && <ViewField label="Materials Used" value={s('dsrMaterialsUsed')} />}
            {s('dsrMissingMaterials') && <ViewField label="Missing / Outstanding Materials" value={s('dsrMissingMaterials')} />}
            {s('dsrDeliveries') && <ViewField label="Deliveries Received" value={s('dsrDeliveries')} />}
            {s('dsrPlantEquipment') && <ViewField label="Plant & Equipment On Site" value={s('dsrPlantEquipment')} />}
            <ViewField label="Issues Encountered" value={s('dsrIssuesEncountered')} />
            <ViewField label="Snags Identified" value={s('dsrSnagsIdentified')} />
            {s('dsrAccessRestrictions') && <ViewField label="Access Restrictions" value={s('dsrAccessRestrictions')} />}
            {s('dsrPermits') && <ViewField label="Permits / Isolations" value={s('dsrPermits')} />}
            {s('dsrIncidents') && <ViewField label="Incidents / Near Misses" value={s('dsrIncidents')} />}
            {s('dsrHseObservations') && <ViewField label="HSE Observations" value={s('dsrHseObservations')} />}
            {dsrDelays.length > 0 && (
              <Section label={`Delays / Issues (${dsrDelays.length})`}>
                <div className="space-y-1.5">
                  {dsrDelays.map((d, i) => (
                    <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-900/60 text-amber-300">{d.delayType || 'Delay'}</span>
                        {d.severity && <span className="text-slate-400">{d.severity}</span>}
                        {d.duration && <span className="text-slate-500">{d.duration}</span>}
                        {d.areaAffected && <span className="text-slate-400">{d.areaAffected}</span>}
                      </div>
                      {d.description && <p className="text-slate-200">{d.description}</p>}
                      {d.programmeImpact && <p className="text-slate-400 italic mt-0.5">Programme: {d.programmeImpact}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}
            <Field2Col items={[['Plan Completed', s('dsrPlanCompleted')], ['Delays Encountered', s('dsrDelaysEncountered')], ['Waiting Other Trades', s('dsrWaitingOtherTrades')], ['Waiting Materials', s('dsrWaitingMaterials')], ['Additional Works', s('dsrAdditionalWorks')], ['Variation Potential', s('dsrVariationPotential')], ['Revisit Required', s('dsrRevisitRequired')], ['Further Labour Required', s('dsrFurtherLabour')]]} />
            {s('dsrFollowOnWorks') && <ViewField label="Follow-On Works" value={s('dsrFollowOnWorks')} />}
            <ViewField label="Tomorrow's Planned Works" value={s('dsrTomorrowPlanned')} />
            <ViewField label="Commercial Observations" value={s('dsrCommercialObservations')} />
            <ViewField label="Supervisor Notes" value={s('dsrSupervisorNotes')} />
            <Field2Col items={[['Engineer Sign', s('dsrSignEngineer')], ['Supervisor Sign', s('dsrSignSupervisor')]]} />
          </>}

          {/* ── Risk Assessment / RAMS ── */}
          {isRAMS && <>
            <Field2Col items={[['RAMS Ref', s('ramsRef')], ['Revision', s('ramsRevision')], ['Author', s('ramsAuthor')], ['Company', s('ramsCompany')], ['Principal Contractor', s('ramsPrincipalContractor')], ['Client', s('ramsClient')], ['Trade Package', s('ramsTradePackage')], ['Location of Works', s('ramsLocationOfWorks')], ['Overall Risk Rating', s('ramsOverallRiskRating')]]} />
            <ViewField label="Scope of Works" value={s('ramsScopeOfWorks')} />
            <ViewField label="Sequence of Works" value={s('ramsSequenceOfWorks')} />
            <ViewField label="Access Arrangements" value={s('ramsAccessArrangements')} />
            <ViewField label="Working Hours" value={s('ramsWorkingHours')} />
            <ViewField label="Isolations Required" value={s('ramsIsolations')} />
            <ViewField label="Plant & Equipment" value={s('ramsPlantEquipment')} />
            <ViewField label="PPE Requirements" value={s('ramsPpe')} />
            <ViewField label="Emergency Procedures" value={s('ramsEmergencyProcedure')} />
            <ViewField label="First Aid" value={s('ramsFirstAid')} />
            {ramsHazards.length > 0 && (
              <Section label={`Hazard Register (${ramsHazards.length} hazards)`}>
                <div className="space-y-2">
                  {ramsHazards.map((h, i) => {
                    const rS = h.residualLikelihood * h.residualSeverity;
                    const color = rS <= 4 ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'
                      : rS <= 9 ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
                      : rS <= 16 ? 'bg-orange-900/20 border-orange-700/40 text-orange-300'
                      : 'bg-red-900/20 border-red-700/40 text-red-300';
                    return (
                      <div key={i} className={`border rounded-xl p-3 ${color}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold">{h.category || `Hazard ${i+1}`}</span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-current">
                            Residual: {rS}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-snug">{h.hazardDescription}</p>
                        {h.additionalControls && <p className="text-[10px] text-slate-500 mt-1 italic">Controls: {h.additionalControls}</p>}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}
            {ramsSignOffs.length > 0 && (
              <Section label={`RAMS Sign-Off (${ramsSignOffs.length} signatories)`}>
                <div className="space-y-1.5">
                  {ramsSignOffs.map((sig, i) => (
                    <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 flex items-center gap-4 text-xs">
                      <span className="text-white font-semibold flex-1">{sig.name}</span>
                      <span className="text-slate-400">{sig.company} · {sig.role}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sig.ramsRead ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-700 text-slate-500'}`}>RAMS</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sig.briefingCompleted ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-700 text-slate-500'}`}>Briefed</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>}

          {/* Accident / Incident Report */}
          {isAIR && <>
            <Section label="Incident Details">
              <Field2Col items={[
                ['Incident Type', s('airIncidentType')],
                ['Injury Classification', s('airInjuryClassification')],
                ['Date', fmtDate(s('date'))],
                ['Time', s('airTime')],
                ['Location', s('areaLocation')],
                ['Reported By', s('completedBy')],
                ['Injured / Affected Person', s('airInjuredPerson')],
                ['Employer', s('airEmployer')],
                ['Contact Number', s('airContactNumber')],
                ['Witnesses', s('airWitnesses')],
              ]} />
            </Section>
            {s('airWhatHappened') && <Section label="What Happened"><ViewField label="" value={s('airWhatHappened')} /></Section>}
            {airImmediateActionsList.length > 0 && (
              <Section label="Immediate Actions Taken">
                <div className="flex flex-wrap gap-1.5">
                  {airImmediateActionsList.map(a => (
                    <span key={a} className="px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 text-[10px] font-semibold">{a}</span>
                  ))}
                </div>
              </Section>
            )}
            <Section label="RIDDOR Assessment">
              <Field2Col items={[
                ['Anyone Killed?', s('airRiddorKilled')],
                ['Specified Injury?', s('airRiddorSpecifiedInjury')],
                ['Over-7-Day Injury?', s('airRiddorOverSevenDay')],
                ['Dangerous Occurrence?', s('airRiddorDangerousOccurrence')],
                ['Member of Public Affected?', s('airRiddorPublicAffected')],
                ['Reportable Disease?', s('airRiddorOccupationalDisease')],
              ]} />
              {s('airRiddorGuidance') && (
                <div className={`p-3 rounded-xl border text-xs leading-relaxed ${s('airRiddorGuidance')?.startsWith('Potential') ? 'bg-red-950/40 border-red-700/50 text-red-200' : 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'}`}>
                  <span className="font-bold block mb-1">{s('airRiddorGuidance')?.startsWith('Potential') ? 'RIDDOR Review Required' : 'RIDDOR Guidance'}</span>
                  {s('airRiddorGuidance')}
                </div>
              )}
            </Section>
            {(s('airRootCause') || s('airContributoryFactors') || s('airCorrectiveActions') || s('airPreventativeActions')) && (
              <Section label="Investigation">
                {s('airRootCause') && <ViewField label="Root Cause" value={s('airRootCause')} />}
                {s('airContributoryFactors') && <ViewField label="Contributory Factors" value={s('airContributoryFactors')} />}
                {s('airCorrectiveActions') && <ViewField label="Corrective Actions" value={s('airCorrectiveActions')} />}
                {s('airPreventativeActions') && <ViewField label="Preventative Actions" value={s('airPreventativeActions')} />}
                <Field2Col items={[
                  ['Responsible Person', s('airResponsiblePerson')],
                  ['Target Completion Date', fmtDate(s('airTargetCompletionDate'))],
                ]} />
              </Section>
            )}
            {airWitnessStatements.length > 0 && (
              <Section label={`Witness Statements (${airWitnessStatements.length})`}>
                <div className="space-y-2">
                  {airWitnessStatements.map((w, i) => (
                    <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-bold text-white">{w.name || `Witness ${i+1}`}</span>
                        {w.company && <span className="text-[10px] text-slate-400">{w.company}</span>}
                        {w.contact && <span className="text-[10px] text-slate-500">{w.contact}</span>}
                      </div>
                      {w.statement && <p className="text-xs text-slate-300 leading-relaxed">{w.statement}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {(s('airInvestigationComplete') || s('airActionsComplete') || s('airClosedBy')) && (
              <Section label="Close Out">
                <Field2Col items={[
                  ['Investigation Complete', s('airInvestigationComplete')],
                  ['Actions Complete', s('airActionsComplete')],
                  ['Closed By', s('airClosedBy')],
                  ['Closed Date', fmtDate(s('airClosedDate'))],
                ]} />
                {s('airLessonsLearned') && <ViewField label="Lessons Learned" value={s('airLessonsLearned')} />}
              </Section>
            )}
          </>}

          {/* Plantroom Commissioning Record */}
          {isPCR && <>
            <Section label="Project Information">
              <Field2Col items={[
                ['Plantroom Reference', s('pcrPlantroom')],
                ['Location', s('areaLocation')],
                ['Date', fmtDate(s('date'))],
                ['Engineer', s('pcrEngineer')],
                ['Witness', s('pcrWitness')],
                ['Main Contractor', s('pcrMainContractor')],
                ['Consultant', s('pcrConsultant')],
              ]} />
              {s('comments') && <ViewField label="Comments" value={s('comments')} />}
            </Section>

            {pcrAssets.length > 0 && (
              <Section label={`Plant Asset Register (${pcrAssets.length} assets)`}>
                <div className="space-y-2">
                  {pcrAssets.map((a, i) => (
                    <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-900/60 text-sky-300">{a.assetType}</span>
                        {a.assetRef && <span className="text-xs font-bold text-white">{a.assetRef}</span>}
                        {a.location && <span className="text-xs text-slate-400">{a.location}</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                        {a.manufacturer && <span className="text-slate-400">Make: <span className="text-slate-200">{a.manufacturer}</span></span>}
                        {a.model && <span className="text-slate-400">Model: <span className="text-slate-200">{a.model}</span></span>}
                        {a.serialNumber && <span className="text-slate-400">S/N: <span className="text-slate-200 font-mono">{a.serialNumber}</span></span>}
                        {a.valveNumber && <span className="text-slate-400">Valve: <span className="text-slate-200">{a.valveNumber}</span></span>}
                        {a.assetTag && <span className="text-slate-400">Tag: <span className="text-slate-200">{a.assetTag}</span></span>}
                        <span className="text-slate-400">Installed: <span className={a.installedCorrectly === 'Yes' ? 'text-emerald-300' : 'text-red-300'}>{a.installedCorrectly}</span></span>
                        <span className="text-slate-400">Accessible: <span className={a.accessible === 'Yes' ? 'text-emerald-300' : 'text-red-300'}>{a.accessible}</span></span>
                      </div>
                      {a.comments && <p className="text-xs text-slate-400 mt-1.5 italic">{a.comments}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section label="System Fill">
              {parsePcrSet('pcrFillChecklist').length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {parsePcrSet('pcrFillChecklist').map(item => (
                    <span key={item} className="px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 text-[10px] font-semibold">{item}</span>
                  ))}
                </div>
              )}
              <Field2Col items={[
                ['Initial Fill Pressure', s('pcrFillPressureInitial')],
                ['Final Fill Pressure', s('pcrFillPressureFinal')],
                ['Static Head', s('pcrStaticHead')],
                ['Fill Medium', s('pcrFillMedium')],
              ]} />
              {s('pcrFillComments') && <ViewField label="Comments" value={s('pcrFillComments')} />}
            </Section>

            <Section label="Pressure Test">
              <Field2Col items={[
                ['Test Medium', s('pcrTestMedium')],
                ['Test Pressure', s('pcrTestPressure')],
                ['Duration', s('pcrTestDuration')],
                ['Start Time', s('pcrTestStartTime')],
                ['Finish Time', s('pcrTestFinishTime')],
              ]} />
              {parsePcrSet('pcrTestChecklist').length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {parsePcrSet('pcrTestChecklist').map(item => (
                    <span key={item} className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold ${item === 'Remedial Works Required' ? 'bg-amber-900/40 border-amber-700/40 text-amber-300' : 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300'}`}>{item}</span>
                  ))}
                </div>
              )}
              {s('pcrTestComments') && <ViewField label="Comments" value={s('pcrTestComments')} />}
            </Section>

            <Section label="Flushing">
              {parsePcrSet('pcrFlushChecklist').length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {parsePcrSet('pcrFlushChecklist').map(item => (
                    <span key={item} className="px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 text-[10px] font-semibold">{item}</span>
                  ))}
                </div>
              )}
              <Field2Col items={[
                ['Chemical Used', s('pcrFlushChemical')],
                ['Water Clarity', s('pcrWaterClarity')],
              ]} />
              {s('pcrFlushComments') && <ViewField label="Comments" value={s('pcrFlushComments')} />}
            </Section>

            <Section label="Water Treatment">
              <Field2Col items={[
                ['Inhibitor Product', s('pcrTreatmentInhibitor')],
                ['Batch Number', s('pcrTreatmentBatch')],
                ['Quantity Added', s('pcrTreatmentQty')],
              ]} />
              {parsePcrSet('pcrTreatmentChecklist').length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {parsePcrSet('pcrTreatmentChecklist').map(item => (
                    <span key={item} className="px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 text-[10px] font-semibold">{item}</span>
                  ))}
                </div>
              )}
            </Section>

            {parsePcrSet('pcrCommChecklist').length > 0 && (
              <Section label="Commissioning Checks">
                <div className="flex flex-wrap gap-1.5">
                  {parsePcrSet('pcrCommChecklist').map(item => (
                    <span key={item} className="px-2.5 py-1 rounded-full bg-sky-900/40 border border-sky-700/40 text-sky-300 text-[10px] font-semibold">{item}</span>
                  ))}
                </div>
                {s('pcrCommComments') && <ViewField label="Comments" value={s('pcrCommComments')} />}
              </Section>
            )}

            {pcrDefects.length > 0 && (
              <Section label={`Defects / Outstanding Works (${pcrDefects.length})`}>
                <div className="space-y-2">
                  {pcrDefects.map((d, i) => (
                    <div key={i} className="bg-[#0d1628] border border-amber-900/30 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${d.status === 'Closed' || d.status === 'Complete' ? 'bg-emerald-900/60 text-emerald-300' : d.status === 'In Progress' ? 'bg-amber-900/60 text-amber-300' : 'bg-red-900/60 text-red-300'}`}>{d.status}</span>
                        {d.responsiblePerson && <span className="text-xs text-slate-400">{d.responsiblePerson}</span>}
                        {d.dueDate && <span className="text-xs text-slate-500">Due: {fmtDate(d.dueDate)}</span>}
                      </div>
                      <p className="text-xs text-slate-200">{d.description}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section label="Handover">
              <Field2Col items={[
                ['Witnessed By', s('pcrHandoverWitness')],
                ['Company', s('pcrHandoverCompany')],
                ['Handover Date', fmtDate(s('pcrHandoverDate'))],
              ]} />
              {s('pcrHandoverComments') && <ViewField label="Handover Comments" value={s('pcrHandoverComments')} />}
            </Section>
          </>}

          {/* QA Inspection */}
          {isQA && <>
            <Section label="Inspection Record">
              <ViewField label="Inspection Description" value={s('description')} />
              {s('comments') && <ViewField label="Comments / Observations" value={s('comments')} />}
              {s('notes') && <ViewField label="Notes" value={s('notes')} />}
            </Section>
          </>}

          {/* ── MVHR Commissioning Record ── */}
          {isMVHR && <>
            <Section label="Project / Plot Information">
              <Field2Col items={[
                ['Plot', s('mvhrPlot')],
                ['Block', s('mvhrBlock')],
                ['Level / Floor', s('mvhrLevel')],
                ['Commissioning Engineer', s('mvhrCommissioningEngineer')],
                ['Company', s('mvhrCompany')],
                ['Witness', s('mvhrWitness')],
              ]} />
            </Section>

            <Section label="MVHR Unit Details">
              <Field2Col items={[
                ['Unit Reference', s('mvhrUnitRef')],
                ['Manufacturer', s('mvhrManufacturer')],
                ['Model', s('mvhrModel')],
                ['Serial Number', s('mvhrSerialNumber')],
                ['Location', s('mvhrLocation')],
                ['Asset Tag', s('mvhrAssetTag')],
                ['Unit Capacity (l/s)', s('mvhrUnitCapacity')],
              ]} />
            </Section>

            {parseMvhrSet('mvhrInstallChecklist').length > 0 && (
              <Section label="Installation Checks">
                <div className="flex flex-wrap gap-1.5">
                  {parseMvhrSet('mvhrInstallChecklist').map(item => (
                    <span key={item} className="px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 text-[10px] font-semibold">{item}</span>
                  ))}
                </div>
                {s('mvhrInstallComments') && <ViewField label="Installation Comments" value={s('mvhrInstallComments')} />}
              </Section>
            )}

            {mvhrRooms.length > 0 && (
              <Section label={`Airflow Room Measurements (${mvhrRooms.length} rooms)`}>
                <div className="space-y-2">
                  {mvhrRooms.map((room, i) => {
                    const isPass = room.passOrFail === 'Pass';
                    return (
                      <div key={i} className={`bg-[#0d1628] border rounded-xl p-3 ${isPass ? 'border-emerald-700/30' : 'border-red-700/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-white">{room.roomName || `Room ${i + 1}`}</span>
                          <div className="flex items-center gap-2">
                            {room.roomType && <span className="text-[10px] text-slate-400">{room.roomType}</span>}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${isPass ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700/40' : 'bg-red-900/60 text-red-300 border-red-700/40'}`}>{room.passOrFail}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <span className="text-slate-400">Design Supply: <span className="text-slate-200">{room.designSupply || '—'} l/s</span></span>
                          <span className="text-slate-400">Actual Supply: <span className="text-slate-200">{room.actualSupply || '—'} l/s</span></span>
                          <span className="text-slate-400">Design Extract: <span className="text-slate-200">{room.designExtract || '—'} l/s</span></span>
                          <span className="text-slate-400">Actual Extract: <span className="text-slate-200">{room.actualExtract || '—'} l/s</span></span>
                        </div>
                        {room.comments && <p className="text-xs text-slate-400 mt-1.5 italic">{room.comments}</p>}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {parseMvhrSet('mvhrFunctionalChecklist').length > 0 && (
              <Section label="Functional Testing Checks">
                <div className="flex flex-wrap gap-1.5">
                  {parseMvhrSet('mvhrFunctionalChecklist').map(item => (
                    <span key={item} className="px-2.5 py-1 rounded-full bg-sky-900/40 border border-sky-700/40 text-sky-300 text-[10px] font-semibold">{item}</span>
                  ))}
                </div>
                {s('mvhrFunctionalComments') && <ViewField label="Functional Comments" value={s('mvhrFunctionalComments')} />}
              </Section>
            )}

            {parseMvhrSet('mvhrNoiseChecklist').length > 0 && (
              <Section label="Noise / Performance Checks">
                <div className="flex flex-wrap gap-1.5">
                  {parseMvhrSet('mvhrNoiseChecklist').map(item => (
                    <span key={item} className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold ${item.toLowerCase().includes('excessive') || item.toLowerCase().includes('vibration') ? 'bg-amber-900/40 border-amber-700/40 text-amber-300' : 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300'}`}>{item}</span>
                  ))}
                </div>
                {s('mvhrNoiseComments') && <ViewField label="Noise / Performance Comments" value={s('mvhrNoiseComments')} />}
              </Section>
            )}

            {mvhrDefects.length > 0 && (
              <Section label={`Defects / Outstanding Works (${mvhrDefects.length})`}>
                <div className="space-y-2">
                  {mvhrDefects.map((d, i) => (
                    <div key={i} className="bg-[#0d1628] border border-amber-900/30 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${d.status === 'Closed' || d.status === 'Complete' ? 'bg-emerald-900/60 text-emerald-300' : d.status === 'In Progress' ? 'bg-amber-900/60 text-amber-300' : 'bg-red-900/60 text-red-300'}`}>{d.status}</span>
                        {d.responsiblePerson && <span className="text-xs text-slate-400">{d.responsiblePerson}</span>}
                        {d.dueDate && <span className="text-xs text-slate-500">Due: {fmtDate(d.dueDate)}</span>}
                      </div>
                      <p className="text-xs text-slate-200">{d.description}</p>
                      {d.comments && <p className="text-xs text-slate-400 mt-1 italic">{d.comments}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section label="Sign-Off">
              <ResultBadge label="Commissioning Status" value={s('mvhrCommissioningStatus')} />
              <Field2Col items={[
                ['Engineer Name', s('mvhrEngineerName')],
                ['Witness Name', s('mvhrWitnessName')],
                ['Sign-Off Date', fmtDate(s('mvhrSignOffDate'))],
              ]} />
              {s('mvhrFinalComments') && <ViewField label="Final Comments" value={s('mvhrFinalComments')} />}
            </Section>
          </>}

          {/* Generic comments/notes fallback */}
          {!isRAMS && !isDSR && !isECR && !isAIR && !isPCR && !isMVHR && !isQA && (form.comments || form.notes) && (
            <ViewField label="Comments / Notes" value={String(form.comments || form.notes || '')} />
          )}

          {/* Attachments */}
          <AttachmentsView attachments={attachments} />

        </div>
      </div>
    </div>
  );
}
