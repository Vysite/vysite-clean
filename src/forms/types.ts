import type { SiteForm, FormStatus } from '../data/types';

export type ExtendedFormType =
  | SiteForm['type']
  | 'RFI' | 'Hold Up Notice' | 'H&S Inspection' | 'Delay Notice'
  | 'Variation' | 'Early Warning Notice' | 'Site Instruction' | 'Technical Query'
  | 'Pressure Test' | 'Flushing Record' | 'Valve Checklist' | 'AHU Commissioning'
  | 'Dead Testing' | 'Continuity Test' | 'Toolbox Talk' | 'Site Walk Audit'
  | 'Electrical Commissioning Report' | 'Risk Assessment'
  | 'Accident / Incident Report'
  | 'Plantroom Commissioning Record'
  | 'HIU Commissioning Record'
  | 'MVHR Commissioning Record'
  | 'Temperature Water Readings'
  | 'Practical Completion Certificate'
  | 'Site Hold Up'
  | 'Site Change Request';

export type ExtendedFormStatus =
  | FormStatus
  | 'Issued' | 'Awaiting Response' | 'Closed' | 'Resolved' | 'Escalated' | 'Action Required'
  | 'Open' | 'Acknowledged' | 'Actioned';

export interface ExtendedSiteForm extends Omit<SiteForm, 'type' | 'status'> {
  type: ExtendedFormType;
  status: ExtendedFormStatus;
  title?: string;
  // RFI
  rfiRef?: string;
  subject?: string;
  question?: string;
  response?: string;
  requiredResponseDate?: string;
  // Hold Up / Delay
  areaLocation?: string;
  cause?: string;
  impact?: string;
  programmeImpact?: string;
  commercialImpact?: string;
  noticeRef?: string;
  dateTime?: string;
  // Variation
  variationRef?: string;
  instructionSource?: string;
  costImpact?: string;
  variationStatus?: string;
  // H&S
  areaInspected?: string;
  inspectionDate?: string;
  inspectionType?: string;
  findings?: string;
  actionsRequired?: string;
  riskLevel?: string;
  inspectorName?: string;
  notes?: string;
  // TQ
  tqRef?: string;
  drawingRef?: string;
  assignedTo?: string;
  priority?: string;
  // Pressure Test
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
  // Flushing Record
  flushMedium?: string;
  flushTemperature?: string;
  flushDuration?: string;
  turbidity?: string;
  chlorineResidual?: string;
  flushResult?: string;
  flushWitnessedBy?: string;
  // Valve Checklist
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
  // AHU Commissioning
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
  // Dead Testing
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
  // Continuity Test
  conductorRef?: string;
  conductorType?: string;
  conductorLength?: string;
  measuredResistance?: string;
  calculatedResistance?: string;
  deviationPercent?: string;
  continuityResult?: string;
  continuityWitness?: string;
  // Toolbox Talk
  tbtTopic?: string;
  tbtDuration?: string;
  tbtLocation?: string;
  tbtPresentedBy?: string;
  tbtAttendees?: string;
  tbtKeyPoints?: string;
  tbtActionItems?: string;
  tbtSignOff?: string;
  // Site Walk Audit
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
  swaChecklist?: string;
  // Electrical Commissioning Report
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
  ecrAttendees?: string;
  ecrActivities?: string;
  ecrDelays?: string;
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
  ecrQaChecklist?: string;
  ecrQaComments?: string;
  ecrSignLead?: string;
  ecrSignWitness?: string;
  ecrSignSiteManager?: string;
  ecrSignContractor?: string;
  ecrOverallComments?: string;
  // Daily Site Report
  dsrSiteManager?: string;
  dsrWeather?: string;
  dsrTemperature?: string;
  dsrSiteConditions?: string;
  dsrOperativesOnSite?: string;
  dsrAttendees?: string;
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
  dsrDelays?: string;
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
  ramsHazards?: string;
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
  ramsSignOffs?: string;
  ramsPreparedBy?: string;
  ramsReviewedBy?: string;
  ramsRevisionNotes?: string;
  ramsOverallRiskRating?: string;
  // Accident / Incident Report
  airIncidentType?: string;
  airTime?: string;
  airInjuredPerson?: string;
  airEmployer?: string;
  airContactNumber?: string;
  airWitnesses?: string;
  airInjuryClassification?: string;
  airWhatHappened?: string;
  airImmediateActions?: string;    // JSON array of checked action keys
  airWitnessStatements?: string;   // JSON array of witness objects
  airRiddorKilled?: string;
  airRiddorSpecifiedInjury?: string;
  airRiddorOverSevenDay?: string;
  airRiddorDangerousOccurrence?: string;
  airRiddorPublicAffected?: string;
  airRiddorOccupationalDisease?: string;
  airRiddorGuidance?: string;
  airRootCause?: string;
  airContributoryFactors?: string;
  airCorrectiveActions?: string;
  airPreventativeActions?: string;
  airResponsiblePerson?: string;
  airTargetCompletionDate?: string;
  airInvestigationComplete?: string;
  airActionsComplete?: string;
  airLessonsLearned?: string;
  airClosedBy?: string;
  airClosedDate?: string;
  // Plantroom Commissioning Record
  pcrPlantroom?: string;
  pcrEngineer?: string;
  pcrWitness?: string;
  pcrMainContractor?: string;
  pcrConsultant?: string;
  pcrAssets?: string;           // JSON: PlantAssetRecord[]
  pcrFillChecklist?: string;    // JSON: Record<string, boolean>
  pcrFillPressureInitial?: string;
  pcrFillPressureFinal?: string;
  pcrStaticHead?: string;
  pcrFillMedium?: string;
  pcrFillComments?: string;
  pcrTestMedium?: string;
  pcrTestPressure?: string;
  pcrTestDuration?: string;
  pcrTestStartTime?: string;
  pcrTestFinishTime?: string;
  pcrTestChecklist?: string;    // JSON
  pcrTestComments?: string;
  pcrFlushChecklist?: string;   // JSON
  pcrFlushChemical?: string;
  pcrWaterClarity?: string;
  pcrFlushComments?: string;
  pcrTreatmentInhibitor?: string;
  pcrTreatmentBatch?: string;
  pcrTreatmentQty?: string;
  pcrTreatmentChecklist?: string; // JSON
  pcrCommChecklist?: string;    // JSON
  pcrCommComments?: string;
  pcrDefects?: string;          // JSON: PlantDefectRecord[]
  pcrHandoverWitness?: string;
  pcrHandoverCompany?: string;
  pcrHandoverDate?: string;
  pcrHandoverComments?: string;
  // HIU Commissioning Record
  hiuPlot?: string;
  hiuBlock?: string;
  hiuLevel?: string;
  hiuCommissioningEngineer?: string;
  hiuCompany?: string;
  hiuWitness?: string;
  hiuRef?: string;
  hiuManufacturer?: string;
  hiuModel?: string;
  hiuSerialNumber?: string;
  hiuLocation?: string;
  hiuAssetTag?: string;
  heatMeterRef?: string;
  heatMeterManufacturer?: string;
  heatMeterModel?: string;
  heatMeterSerialNumber?: string;
  heatMeterReading?: string;
  heatMeterPulseChecked?: string;
  heatMeterMBusConnected?: string;
  valvePrimaryFlow?: string;
  valvePrimaryReturn?: string;
  valveSecondaryFlow?: string;
  valveSecondaryReturn?: string;
  valveColdWater?: string;
  valveDHWOutlet?: string;
  hiuValveChecklist?: string;      // JSON: string[]
  primaryFlowTemp?: string;
  primaryReturnTemp?: string;
  primaryDiffPressure?: string;
  primaryFlowRate?: string;
  systemPressure?: string;
  secondaryFlowTemp?: string;
  secondaryReturnTemp?: string;
  heatingFlowConfirmed?: string;
  heatingReturnConfirmed?: string;
  radUFHWarmed?: string;
  cwInletTemp?: string;
  dhwOutletTemp?: string;
  dhwFlowRate?: string;
  dhwTempStabilised?: string;
  dhwOutletAcceptable?: string;
  hiuControlsChecklist?: string;   // JSON: string[]
  hiuDefects?: string;             // JSON: HIUDefectRecord[]
  hiuCommissioningStatus?: string;
  hiuEngineerName?: string;
  hiuWitnessName?: string;
  hiuSignOffDate?: string;
  hiuFinalComments?: string;
  // MVHR Commissioning Record
  mvhrPlot?: string;
  mvhrBlock?: string;
  mvhrLevel?: string;
  mvhrCommissioningEngineer?: string;
  mvhrCompany?: string;
  mvhrWitness?: string;
  mvhrUnitRef?: string;
  mvhrManufacturer?: string;
  mvhrModel?: string;
  mvhrSerialNumber?: string;
  mvhrLocation?: string;
  mvhrAssetTag?: string;
  mvhrUnitCapacity?: string;
  mvhrInstallChecklist?: string;    // JSON: Record<string, string> — Yes/No/N/A
  mvhrInstallComments?: string;
  mvhrRooms?: string;               // JSON: MVHRRoom[]
  mvhrFunctionalChecklist?: string; // JSON: Record<string, string>
  mvhrFunctionalComments?: string;
  mvhrNoiseChecklist?: string;      // JSON: Record<string, string>
  mvhrNoiseComments?: string;
  mvhrDefects?: string;             // JSON: MVHRDefect[]
  mvhrCommissioningStatus?: string;
  mvhrEngineerName?: string;
  mvhrWitnessName?: string;
  mvhrSignOffDate?: string;
  mvhrFinalComments?: string;
  // Temperature Water Readings
  twrSystem?: string;
  twrLocation?: string;
  twrArea?: string;
  twrWitnessedBy?: string;
  twrReadings?: string;          // JSON: TWRReadingRecord[]
  // Practical Completion Certificate
  pccRef?: string;
  pccContract?: string;
  pccClient?: string;
  pccLocationArea?: string;
  pccDescriptionOfWorks?: string;
  pccAssets?: string;            // JSON: PCCAssetRecord[]
  pccChecklist?: string;         // JSON: PCCChecklistItem[]
  pccOutstandingItems?: string;
  pccHandedOverBy?: string;
  pccHandedOverByTitle?: string;
  pccAcceptedBy?: string;
  pccAcceptedByTitle?: string;
  pccAcceptedByCompany?: string;
  pccAcceptanceDate?: string;
  pccSignature?: string;
  // Site Hold Up
  shuRef?: string;
  shuImmediateActions?: string;
  // Site Change Request
  scrRef?: string;
  scrReason?: string;
  scrProgrammeImpact?: string;
  scrCommercialImpact?: string;
}

export const TYPE_MAP: Record<string, { bg: string; text: string; label: string; border: string }> = {
  'Daily Site Report':              { bg: 'bg-orange-900/60', text: 'text-orange-400', label: 'Daily Report',        border: 'border-l-orange-700' },
  'QA Inspection':                  { bg: 'bg-teal-900/60',   text: 'text-teal-400',   label: 'QA Inspection',      border: 'border-l-teal-700' },
  'RFI':                            { bg: 'bg-cyan-900/60',   text: 'text-cyan-400',   label: 'RFI',                border: 'border-l-cyan-700' },
  'Hold Up Notice':                 { bg: 'bg-rose-900/60',   text: 'text-rose-400',   label: 'Hold Up',            border: 'border-l-rose-700' },
  'H&S Inspection':                 { bg: 'bg-amber-900/60',  text: 'text-amber-400',  label: 'H&S',                border: 'border-l-amber-700' },
  'Delay Notice':                   { bg: 'bg-red-900/60',    text: 'text-red-400',    label: 'Delay Notice',       border: 'border-l-red-700' },
  'Variation':                      { bg: 'bg-blue-900/60',   text: 'text-blue-400',   label: 'Variation',          border: 'border-l-blue-700' },
  'Early Warning Notice':           { bg: 'bg-yellow-900/60', text: 'text-yellow-400', label: 'Early Warning',      border: 'border-l-yellow-700' },
  'Site Instruction':               { bg: 'bg-slate-700',     text: 'text-slate-300',  label: 'Site Instruction',   border: 'border-l-slate-600' },
  'Technical Query':                { bg: 'bg-sky-900/60',    text: 'text-sky-400',    label: 'TQ',                 border: 'border-l-sky-700' },
  'Pressure Test':                  { bg: 'bg-blue-900/60',   text: 'text-blue-300',   label: 'Pressure Test',      border: 'border-l-blue-500' },
  'Flushing Record':                { bg: 'bg-cyan-900/60',   text: 'text-cyan-300',   label: 'Flushing Record',    border: 'border-l-cyan-500' },
  'Valve Checklist':                { bg: 'bg-indigo-900/60', text: 'text-indigo-300', label: 'Valve Checklist',    border: 'border-l-indigo-500' },
  'AHU Commissioning':              { bg: 'bg-violet-900/60', text: 'text-violet-300', label: 'AHU Commissioning',  border: 'border-l-violet-500' },
  'Dead Testing':                   { bg: 'bg-yellow-900/60', text: 'text-yellow-300', label: 'Dead Testing',       border: 'border-l-yellow-500' },
  'Continuity Test':                { bg: 'bg-lime-900/60',   text: 'text-lime-300',   label: 'Continuity Test',    border: 'border-l-lime-500' },
  'Toolbox Talk':                   { bg: 'bg-amber-900/60',  text: 'text-amber-300',  label: 'Toolbox Talk',       border: 'border-l-amber-500' },
  'Site Walk Audit':                { bg: 'bg-rose-900/60',   text: 'text-rose-300',   label: 'Site Walk Audit',    border: 'border-l-rose-500' },
  'Electrical Commissioning Report':{ bg: 'bg-yellow-900/60', text: 'text-yellow-300', label: 'Elec Commissioning', border: 'border-l-yellow-400' },
  'Risk Assessment':                { bg: 'bg-orange-900/60', text: 'text-orange-300', label: 'Risk Assessment',    border: 'border-l-orange-400' },
  'Accident / Incident Report':     { bg: 'bg-red-900/60',    text: 'text-red-300',    label: 'Incident Report',   border: 'border-l-red-500' },
  'Plantroom Commissioning Record': { bg: 'bg-sky-900/60',    text: 'text-sky-300',    label: 'Plantroom Comm.',   border: 'border-l-sky-500' },
  'HIU Commissioning Record':       { bg: 'bg-teal-900/60',   text: 'text-teal-300',   label: 'HIU Commissioning', border: 'border-l-teal-500' },
  'MVHR Commissioning Record':      { bg: 'bg-sky-900/60',    text: 'text-sky-300',    label: 'MVHR Commissioning', border: 'border-l-sky-500' },
  'Temperature Water Readings':     { bg: 'bg-blue-900/60',   text: 'text-blue-300',   label: 'Temp Water',         border: 'border-l-blue-500' },
  'Practical Completion Certificate': { bg: 'bg-emerald-900/60', text: 'text-emerald-300', label: 'PC Certificate', border: 'border-l-emerald-500' },
  'Site Hold Up':                     { bg: 'bg-amber-900/60',   text: 'text-amber-400',   label: 'Site Hold Up',       border: 'border-l-amber-600' },
  'Site Change Request':              { bg: 'bg-sky-900/60',     text: 'text-sky-400',     label: 'Change Request',     border: 'border-l-sky-600' },
};

export const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
export const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';
