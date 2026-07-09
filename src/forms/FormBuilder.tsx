import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { X, ChevronDown } from 'lucide-react';
import FileUploadComponent, { type UploadedFile } from '../components/FileUpload';
import { useAppStore } from '../lib/StoreContext';
import {
  type ExtendedFormType, type ExtendedSiteForm, type ExtendedFormStatus,
  inputCls, labelCls,
} from './types';
import {
  type ChecklistEntry, SWA_DEFAULT_ENTRY, SWASection,
  type OperativeRecord, OperativeRows,
  type DelayRecord, DelayRows,
  type HazardRecord, HazardRows,
  type RamsSignOffRecord, RamsSignOffRows,
  type PlantAssetRecord, PlantAssetRows,
  type PlantDefectRecord, PlantDefectRows,
  type TWRReadingRecord, TWRReadingRows,
  type PCCAssetRecord, PCCAssetRows,
  type PCCChecklistItem, PCCChecklistRows,
} from './SubComponents';

// counter lives in module scope — resets on full page reload, which is fine
let rfiCounter = 1;
function nextRfiRef() { return `RFI-${String(rfiCounter++).padStart(3, '0')}`; }

let snCounter = 1;
function nextSnRef() { return `SN-${String(snCounter++).padStart(4, '0')}`; }

export interface FormBuilderProps {
  type: ExtendedFormType;
  onClose: () => void;
  onSave: (form: ExtendedSiteForm, files: UploadedFile[]) => void;
  initialData?: ExtendedSiteForm | null;
}

export function FormBuilder({ type, onClose, onSave, initialData }: FormBuilderProps) {
  const store = useAppStore();
  const visibleProjects = store.visibleProjectIds === null
    ? store.projects
    : store.projects.filter(p => store.visibleProjectIds!.includes(p.id));
  const init = initialData as Record<string, unknown> | null | undefined;
  const sv = (key: string, def = '') => (init && init[key] != null ? String(init[key]) : def);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(() => {
    if (!init?.attachments) return [];
    try { return init.attachments as UploadedFile[]; } catch { return []; }
  });
  const [form, setForm] = useState<Record<string, string>>(() => ({
    title:       sv('title'),
    project:     sv('projectName') || sv('project'),
    date:        sv('date', new Date().toISOString().split('T')[0]),
    completedBy: sv('completedBy'),
    description: sv('description'),
    comments:    sv('comments'),
    status:      (() => {
      const raw = sv('status', ['Early Warning Notice', 'Site Instruction'].includes(type) ? 'Open' : 'Draft');
      // 'Draft' is not a valid status for EWN/SI — normalize to 'Open'
      if (['Early Warning Notice', 'Site Instruction'].includes(type) && raw === 'Draft') return 'Open';
      return raw;
    })(),
    rfiRef:      sv('rfiRef', nextRfiRef()),
    subject:     sv('subject'),
    question:    sv('question'),
    response:    sv('response'),
    requiredResponseDate: sv('requiredResponseDate'),
    raisedBy:    sv('raisedBy'),
    assignedTo:  sv('assignedTo'),
    tqRef:       sv('tqRef', `TQ-${String(Math.floor(Math.random() * 900) + 100)}`),
    drawingRef:  sv('drawingRef'),
    priority:    sv('priority', 'Medium'),
    areaLocation: sv('areaLocation'),
    cause:       sv('cause'),
    impact:      sv('impact'),
    dateTime:    sv('dateTime'),
    noticeRef:   sv('noticeRef'),
    programmeImpact:  sv('programmeImpact'),
    commercialImpact: sv('commercialImpact'),
    variationRef:      sv('variationRef'),
    instructionSource: sv('instructionSource'),
    costImpact:        sv('costImpact'),
    variationStatus:   sv('variationStatus'),
    areaInspected:   sv('areaInspected'),
    inspectionDate:  sv('inspectionDate', new Date().toISOString().split('T')[0]),
    inspectionType:  sv('inspectionType', 'Routine'),
    findings:        sv('findings'),
    actionsRequired: sv('actionsRequired'),
    riskLevel:       sv('riskLevel', 'Low'),
    inspectorName:   sv('inspectorName'),
    notes:           sv('notes'),
    // Pressure Test
    plotArea:            sv('plotArea'),
    systemService:       sv('systemService'),
    pipeworkDescription: sv('pipeworkDescription'),
    testMedium:          sv('testMedium', 'Water'),
    testPressure:        sv('testPressure'),
    testPressureUnit:    sv('testPressureUnit', 'bar'),
    startTime:           sv('startTime'),
    endTime:             sv('endTime'),
    durationOnTest:      sv('durationOnTest'),
    testResult:          sv('testResult', 'Pass'),
    witnessedBy:         sv('witnessedBy'),
    engineer:            sv('engineer'),
    company:             sv('company'),
    observations:        sv('observations'),
    // Flushing Record
    flushMedium:       sv('flushMedium', 'Mains Water'),
    flushTemperature:  sv('flushTemperature'),
    flushDuration:     sv('flushDuration'),
    turbidity:         sv('turbidity'),
    chlorineResidual:  sv('chlorineResidual'),
    flushResult:       sv('flushResult', 'Pass'),
    flushWitnessedBy:  sv('flushWitnessedBy'),
    // Valve Checklist
    valveTag:          sv('valveTag'),
    valveType:         sv('valveType'),
    valveSize:         sv('valveSize'),
    valveLocation:     sv('valveLocation'),
    operationCheck:    sv('operationCheck', 'Pass'),
    seatLeakageCheck:  sv('seatLeakageCheck', 'Pass'),
    glandLeakageCheck: sv('glandLeakageCheck', 'Pass'),
    positionIndicator: sv('positionIndicator', 'Satisfactory'),
    actuatorCheck:     sv('actuatorCheck', 'N/A'),
    overallCondition:  sv('overallCondition', 'Satisfactory'),
    // AHU Commissioning
    ahuTag:          sv('ahuTag'),
    ahuLocation:     sv('ahuLocation'),
    supplyAirflow:   sv('supplyAirflow'),
    returnAirflow:   sv('returnAirflow'),
    supplyFanAmps:   sv('supplyFanAmps'),
    returnFanAmps:   sv('returnFanAmps'),
    filterCondition: sv('filterCondition', 'Clean'),
    beltCondition:   sv('beltCondition', 'Satisfactory'),
    dampersOperation:sv('dampersOperation', 'Satisfactory'),
    condensateTray:  sv('condensateTray', 'Clean'),
    vibrationCheck:  sv('vibrationCheck', 'Satisfactory'),
    coilCondition:   sv('coilCondition', 'Satisfactory'),
    setpointTemp:    sv('setpointTemp'),
    measuredTemp:    sv('measuredTemp'),
    ahuResult:       sv('ahuResult', 'Pass'),
    // Dead Testing
    circuitRef:        sv('circuitRef'),
    testInstrument:    sv('testInstrument'),
    insulationPhaseL1: sv('insulationPhaseL1'),
    insulationPhaseL2: sv('insulationPhaseL2'),
    insulationPhaseL3: sv('insulationPhaseL3'),
    insulationNeutral: sv('insulationNeutral'),
    continuityRing:    sv('continuityRing'),
    earthFault:        sv('earthFault'),
    polarity:          sv('polarity', 'Correct'),
    deadTestResult:    sv('deadTestResult', 'Pass'),
    deadTestWitness:   sv('deadTestWitness'),
    // Continuity Test
    conductorRef:         sv('conductorRef'),
    conductorType:        sv('conductorType'),
    conductorLength:      sv('conductorLength'),
    measuredResistance:   sv('measuredResistance'),
    calculatedResistance: sv('calculatedResistance'),
    deviationPercent:     sv('deviationPercent'),
    continuityResult:     sv('continuityResult', 'Pass'),
    continuityWitness:    sv('continuityWitness'),
    // Toolbox Talk
    tbtTopic:       sv('tbtTopic'),
    tbtDuration:    sv('tbtDuration'),
    tbtLocation:    sv('tbtLocation'),
    tbtPresentedBy: sv('tbtPresentedBy'),
    tbtAttendees:   sv('tbtAttendees'),
    tbtKeyPoints:   sv('tbtKeyPoints'),
    tbtActionItems: sv('tbtActionItems'),
    tbtSignOff:     sv('tbtSignOff'),
    // Site Walk Audit
    swaSiteArea:            sv('swaSiteArea'),
    swaAuditTime:           sv('swaAuditTime'),
    swaAuditorName:         sv('swaAuditorName'),
    swaWeather:             sv('swaWeather'),
    swaTradeTeam:           sv('swaTradeTeam'),
    swaSiteManager:         sv('swaSiteManager'),
    swaOverallStatus:       sv('swaOverallStatus', 'Satisfactory'),
    swaPositiveObservations:sv('swaPositiveObservations'),
    swaKeyRisks:            sv('swaKeyRisks'),
    swaImmediateActions:    sv('swaImmediateActions'),
    swaFurtherActions:      sv('swaFurtherActions'),
    swaResponsiblePerson:   sv('swaResponsiblePerson'),
    swaCloseOutDate:        sv('swaCloseOutDate'),
    swaReinspectionRequired:sv('swaReinspectionRequired', 'No'),
    swaReinspectionDate:    sv('swaReinspectionDate'),
    swaOverallComments:     sv('swaOverallComments'),
    // Electrical Commissioning Report
    ecrShift:                    sv('ecrShift', 'Day'),
    ecrLeadEngineer:             sv('ecrLeadEngineer'),
    ecrCompany:                  sv('ecrCompany'),
    ecrMainContractor:           sv('ecrMainContractor'),
    ecrSystemBeingCommissioned:  sv('ecrSystemBeingCommissioned'),
    ecrPermitRefs:               sv('ecrPermitRefs'),
    ecrOverallStatus:            sv('ecrOverallStatus', 'On Programme'),
    ecrWeather:                  sv('ecrWeather'),
    ecrSiteArea:                 sv('ecrSiteArea'),
    ecrTicketRef:                sv('ecrTicketRef'),
    ecrProgressLabour:           sv('ecrProgressLabour'),
    ecrAreasCompleted:           sv('ecrAreasCompleted'),
    ecrAreasInProgress:          sv('ecrAreasInProgress'),
    ecrAreasDelayed:             sv('ecrAreasDelayed'),
    ecrPercentProgress:          sv('ecrPercentProgress'),
    ecrPlannedWorks:             sv('ecrPlannedWorks'),
    ecrActualWorks:              sv('ecrActualWorks'),
    ecrKeyAchievements:          sv('ecrKeyAchievements'),
    ecrKeyBlockers:              sv('ecrKeyBlockers'),
    ecrTomorrowWorks:            sv('ecrTomorrowWorks'),
    ecrRequiredSupport:          sv('ecrRequiredSupport'),
    ecrQaComments:               sv('ecrQaComments'),
    ecrSignLead:                 sv('ecrSignLead'),
    ecrSignWitness:              sv('ecrSignWitness'),
    ecrSignSiteManager:          sv('ecrSignSiteManager'),
    ecrSignContractor:           sv('ecrSignContractor'),
    ecrOverallComments:          sv('ecrOverallComments'),
    // Daily Site Report
    dsrSiteManager:          sv('dsrSiteManager'),
    dsrWeather:              sv('dsrWeather', 'Fine'),
    dsrTemperature:          sv('dsrTemperature'),
    dsrSiteConditions:       sv('dsrSiteConditions', 'Good'),
    dsrOperativesOnSite:     sv('dsrOperativesOnSite'),
    dsrAreasWorkedIn:        sv('dsrAreasWorkedIn'),
    dsrWorksCompleted:       sv('dsrWorksCompleted'),
    dsrSystemsWorkedOn:      sv('dsrSystemsWorkedOn'),
    dsrEquipmentWorkedOn:    sv('dsrEquipmentWorkedOn'),
    dsrTestingCompleted:     sv('dsrTestingCompleted'),
    dsrMaterialsInstalled:   sv('dsrMaterialsInstalled'),
    dsrIssuesEncountered:    sv('dsrIssuesEncountered'),
    dsrSnagsIdentified:      sv('dsrSnagsIdentified'),
    dsrAccessRestrictions:   sv('dsrAccessRestrictions'),
    dsrFollowOnWorks:        sv('dsrFollowOnWorks'),
    dsrPlanCompleted:        sv('dsrPlanCompleted', 'Yes'),
    dsrDelaysEncountered:    sv('dsrDelaysEncountered', 'No'),
    dsrWaitingOtherTrades:   sv('dsrWaitingOtherTrades', 'No'),
    dsrWaitingMaterials:     sv('dsrWaitingMaterials', 'No'),
    dsrAdditionalWorks:      sv('dsrAdditionalWorks', 'No'),
    dsrVariationPotential:   sv('dsrVariationPotential', 'No'),
    dsrRevisitRequired:      sv('dsrRevisitRequired', 'No'),
    dsrFurtherLabour:        sv('dsrFurtherLabour', 'No'),
    dsrDeliveries:           sv('dsrDeliveries'),
    dsrPlantEquipment:       sv('dsrPlantEquipment'),
    dsrMaterialsUsed:        sv('dsrMaterialsUsed'),
    dsrMissingMaterials:     sv('dsrMissingMaterials'),
    dsrHseObservations:      sv('dsrHseObservations'),
    dsrIncidents:            sv('dsrIncidents', 'None'),
    dsrPermits:              sv('dsrPermits'),
    dsrVisitors:             sv('dsrVisitors'),
    dsrTomorrowPlanned:      sv('dsrTomorrowPlanned'),
    dsrCommercialObservations:sv('dsrCommercialObservations'),
    dsrSupervisorNotes:      sv('dsrSupervisorNotes'),
    dsrSignEngineer:         sv('dsrSignEngineer'),
    dsrSignSupervisor:       sv('dsrSignSupervisor'),
    dsrStartTime:            sv('dsrStartTime'),
    dsrFinishTime:           sv('dsrFinishTime'),
    dsrBreakDuration:        sv('dsrBreakDuration'),
    dsrTotalHours:           sv('dsrTotalHours'),
    dsrOvertimeHours:        sv('dsrOvertimeHours'),
    // Risk Assessment / RAMS
    ramsRef:                     sv('ramsRef', `RAMS-${String(Math.floor(Math.random() * 900) + 100)}`),
    ramsRevision:                sv('ramsRevision', 'Rev 0'),
    ramsAuthor:                  sv('ramsAuthor'),
    ramsCompany:                 sv('ramsCompany'),
    ramsPrincipalContractor:     sv('ramsPrincipalContractor'),
    ramsClient:                  sv('ramsClient'),
    ramsTradePackage:            sv('ramsTradePackage'),
    ramsActivityDescription:     sv('ramsActivityDescription'),
    ramsLocationOfWorks:         sv('ramsLocationOfWorks'),
    ramsPermitRequirements:      sv('ramsPermitRequirements'),
    ramsReviewDate:              sv('ramsReviewDate'),
    ramsApprovedBy:              sv('ramsApprovedBy'),
    ramsDistribution:            sv('ramsDistribution'),
    ramsScopeOfWorks:            sv('ramsScopeOfWorks'),
    ramsSequenceOfWorks:         sv('ramsSequenceOfWorks'),
    ramsAccessArrangements:      sv('ramsAccessArrangements'),
    ramsWorkingHours:            sv('ramsWorkingHours'),
    ramsTradeInterfaces:         sv('ramsTradeInterfaces'),
    ramsRestrictedAreas:         sv('ramsRestrictedAreas'),
    ramsTemporaryWorks:          sv('ramsTemporaryWorks'),
    ramsIsolations:              sv('ramsIsolations'),
    ramsPlantEquipment:          sv('ramsPlantEquipment'),
    ramsPpe:                     sv('ramsPpe'),
    ramsPermitsRequired:         sv('ramsPermitsRequired'),
    ramsIsolationProcedure:      sv('ramsIsolationProcedure'),
    ramsEmergencyProcedure:      sv('ramsEmergencyProcedure'),
    ramsFirstAid:                sv('ramsFirstAid'),
    ramsFireArrangements:        sv('ramsFireArrangements'),
    ramsEnvironmentalControls:   sv('ramsEnvironmentalControls'),
    ramsWelfareArrangements:     sv('ramsWelfareArrangements'),
    ramsSupervisionRequirements: sv('ramsSupervisionRequirements'),
    ramsCompetencyRequirements:  sv('ramsCompetencyRequirements'),
    ramsInspectionRequirements:  sv('ramsInspectionRequirements'),
    ramsPreparedBy:              sv('ramsPreparedBy'),
    ramsReviewedBy:              sv('ramsReviewedBy'),
    ramsRevisionNotes:           sv('ramsRevisionNotes'),
    ramsOverallRiskRating:       sv('ramsOverallRiskRating', 'Medium'),
    // Accident / Incident Report
    airIncidentType:             sv('airIncidentType', 'Accident'),
    airTime:                     sv('airTime'),
    airInjuredPerson:            sv('airInjuredPerson'),
    airEmployer:                 sv('airEmployer'),
    airContactNumber:            sv('airContactNumber'),
    airWitnesses:                sv('airWitnesses'),
    airInjuryClassification:     sv('airInjuryClassification', 'No Injury'),
    airWhatHappened:             sv('airWhatHappened'),
    airRiddorKilled:             sv('airRiddorKilled', 'No'),
    airRiddorSpecifiedInjury:    sv('airRiddorSpecifiedInjury', 'No'),
    airRiddorOverSevenDay:       sv('airRiddorOverSevenDay', 'No'),
    airRiddorDangerousOccurrence:sv('airRiddorDangerousOccurrence', 'No'),
    airRiddorPublicAffected:     sv('airRiddorPublicAffected', 'No'),
    airRiddorOccupationalDisease:sv('airRiddorOccupationalDisease', 'No'),
    airRootCause:                sv('airRootCause'),
    airContributoryFactors:      sv('airContributoryFactors'),
    airCorrectiveActions:        sv('airCorrectiveActions'),
    airPreventativeActions:      sv('airPreventativeActions'),
    airResponsiblePerson:        sv('airResponsiblePerson'),
    airTargetCompletionDate:     sv('airTargetCompletionDate'),
    airInvestigationComplete:    sv('airInvestigationComplete', 'No'),
    airActionsComplete:          sv('airActionsComplete', 'No'),
    airLessonsLearned:           sv('airLessonsLearned'),
    airClosedBy:                 sv('airClosedBy'),
    airClosedDate:               sv('airClosedDate'),
    // Plantroom Commissioning Record
    pcrPlantroom:                sv('pcrPlantroom'),
    pcrEngineer:                 sv('pcrEngineer'),
    pcrWitness:                  sv('pcrWitness'),
    pcrMainContractor:           sv('pcrMainContractor'),
    pcrConsultant:               sv('pcrConsultant'),
    pcrFillPressureInitial:      sv('pcrFillPressureInitial'),
    pcrFillPressureFinal:        sv('pcrFillPressureFinal'),
    pcrStaticHead:               sv('pcrStaticHead'),
    pcrFillMedium:               sv('pcrFillMedium', 'Mains Water'),
    pcrFillComments:             sv('pcrFillComments'),
    pcrTestMedium:               sv('pcrTestMedium', 'Water'),
    pcrTestPressure:             sv('pcrTestPressure'),
    pcrTestDuration:             sv('pcrTestDuration'),
    pcrTestStartTime:            sv('pcrTestStartTime'),
    pcrTestFinishTime:           sv('pcrTestFinishTime'),
    pcrTestComments:             sv('pcrTestComments'),
    pcrFlushChemical:            sv('pcrFlushChemical'),
    pcrWaterClarity:             sv('pcrWaterClarity'),
    pcrFlushComments:            sv('pcrFlushComments'),
    pcrTreatmentInhibitor:       sv('pcrTreatmentInhibitor'),
    pcrTreatmentBatch:           sv('pcrTreatmentBatch'),
    pcrTreatmentQty:             sv('pcrTreatmentQty'),
    pcrCommComments:             sv('pcrCommComments'),
    pcrHandoverWitness:          sv('pcrHandoverWitness'),
    pcrHandoverCompany:          sv('pcrHandoverCompany'),
    pcrHandoverDate:             sv('pcrHandoverDate'),
    pcrHandoverComments:         sv('pcrHandoverComments'),
    // HIU Commissioning Record
    hiuPlot:                     sv('hiuPlot'),
    hiuBlock:                    sv('hiuBlock'),
    hiuLevel:                    sv('hiuLevel'),
    hiuCommissioningEngineer:    sv('hiuCommissioningEngineer'),
    hiuCompany:                  sv('hiuCompany'),
    hiuWitness:                  sv('hiuWitness'),
    hiuRef:                      sv('hiuRef'),
    hiuManufacturer:             sv('hiuManufacturer'),
    hiuModel:                    sv('hiuModel'),
    hiuSerialNumber:             sv('hiuSerialNumber'),
    hiuLocation:                 sv('hiuLocation'),
    hiuAssetTag:                 sv('hiuAssetTag'),
    heatMeterRef:                sv('heatMeterRef'),
    heatMeterManufacturer:       sv('heatMeterManufacturer'),
    heatMeterModel:              sv('heatMeterModel'),
    heatMeterSerialNumber:       sv('heatMeterSerialNumber'),
    heatMeterReading:            sv('heatMeterReading'),
    heatMeterPulseChecked:       sv('heatMeterPulseChecked', 'N/A'),
    heatMeterMBusConnected:      sv('heatMeterMBusConnected', 'N/A'),
    valvePrimaryFlow:            sv('valvePrimaryFlow'),
    valvePrimaryReturn:          sv('valvePrimaryReturn'),
    valveSecondaryFlow:          sv('valveSecondaryFlow'),
    valveSecondaryReturn:        sv('valveSecondaryReturn'),
    valveColdWater:              sv('valveColdWater'),
    valveDHWOutlet:              sv('valveDHWOutlet'),
    primaryFlowTemp:             sv('primaryFlowTemp'),
    primaryReturnTemp:           sv('primaryReturnTemp'),
    primaryDiffPressure:         sv('primaryDiffPressure'),
    primaryFlowRate:             sv('primaryFlowRate'),
    systemPressure:              sv('systemPressure'),
    secondaryFlowTemp:           sv('secondaryFlowTemp'),
    secondaryReturnTemp:         sv('secondaryReturnTemp'),
    heatingFlowConfirmed:        sv('heatingFlowConfirmed', 'Yes'),
    heatingReturnConfirmed:      sv('heatingReturnConfirmed', 'Yes'),
    radUFHWarmed:                sv('radUFHWarmed', 'Yes'),
    cwInletTemp:                 sv('cwInletTemp'),
    dhwOutletTemp:               sv('dhwOutletTemp'),
    dhwFlowRate:                 sv('dhwFlowRate'),
    dhwTempStabilised:           sv('dhwTempStabilised', 'Yes'),
    dhwOutletAcceptable:         sv('dhwOutletAcceptable', 'Yes'),
    hiuCommissioningStatus:      sv('hiuCommissioningStatus', 'Passed'),
    hiuEngineerName:             sv('hiuEngineerName'),
    hiuWitnessName:              sv('hiuWitnessName'),
    hiuSignOffDate:              sv('hiuSignOffDate', new Date().toISOString().split('T')[0]),
    hiuFinalComments:            sv('hiuFinalComments'),
    // MVHR Commissioning Record
    mvhrPlot:                    sv('mvhrPlot'),
    mvhrBlock:                   sv('mvhrBlock'),
    mvhrLevel:                   sv('mvhrLevel'),
    mvhrCommissioningEngineer:   sv('mvhrCommissioningEngineer'),
    mvhrCompany:                 sv('mvhrCompany'),
    mvhrWitness:                 sv('mvhrWitness'),
    mvhrUnitRef:                 sv('mvhrUnitRef'),
    mvhrManufacturer:            sv('mvhrManufacturer'),
    mvhrModel:                   sv('mvhrModel'),
    mvhrSerialNumber:            sv('mvhrSerialNumber'),
    mvhrLocation:                sv('mvhrLocation'),
    mvhrAssetTag:                sv('mvhrAssetTag'),
    mvhrUnitCapacity:            sv('mvhrUnitCapacity'),
    mvhrInstallComments:         sv('mvhrInstallComments'),
    mvhrFunctionalComments:      sv('mvhrFunctionalComments'),
    mvhrNoiseComments:           sv('mvhrNoiseComments'),
    mvhrCommissioningStatus:     sv('mvhrCommissioningStatus', 'Passed'),
    mvhrEngineerName:            sv('mvhrEngineerName'),
    mvhrWitnessName:             sv('mvhrWitnessName'),
    mvhrSignOffDate:             sv('mvhrSignOffDate', new Date().toISOString().split('T')[0]),
    mvhrFinalComments:           sv('mvhrFinalComments'),
    // Temperature Water Readings
    twrSystem:                   sv('twrSystem'),
    twrLocation:                 sv('twrLocation'),
    twrArea:                     sv('twrArea'),
    twrWitnessedBy:              sv('twrWitnessedBy'),
    // Practical Completion Certificate
    pccRef:              sv('pccRef', `PC-${String(Math.floor(Math.random() * 9000) + 1000)}`),
    pccContract:         sv('pccContract'),
    pccClient:           sv('pccClient'),
    pccLocationArea:     sv('pccLocationArea'),
    pccDescriptionOfWorks: sv('pccDescriptionOfWorks'),
    pccOutstandingItems: sv('pccOutstandingItems'),
    pccHandedOverBy:        sv('pccHandedOverBy'),
    pccHandedOverByTitle:   sv('pccHandedOverByTitle'),
    pccHandedOverByCompany: sv('pccHandedOverByCompany'),
    pccAcceptedBy:          sv('pccAcceptedBy'),
    pccAcceptedByTitle:     sv('pccAcceptedByTitle'),
    pccAcceptedByCompany:   sv('pccAcceptedByCompany'),
    pccAcceptanceDate:   sv('pccAcceptanceDate', new Date().toISOString().split('T')[0]),
    pccSignature:        sv('pccSignature'),
    // Site Hold Up
    shuRef:              sv('shuRef', `SHU-${String(Math.floor(Math.random() * 900) + 100)}`),
    shuImmediateActions: sv('shuImmediateActions'),
    // Site Change Request
    scrRef:              sv('scrRef', `SCR-${String(Math.floor(Math.random() * 900) + 100)}`),
    scrReason:           sv('scrReason'),
    scrProgrammeImpact:  sv('scrProgrammeImpact'),
    scrCommercialImpact: sv('scrCommercialImpact'),
    // Site Note
    snRef:               sv('snRef', nextSnRef()),
    snCategory:          sv('snCategory', ''),
    snSubject:           sv('snSubject'),
    snBody:              sv('snBody'),
    snRecommendedAction: sv('snRecommendedAction'),
    snTime:              sv('snTime', new Date().toTimeString().slice(0, 5)),
  }));

  // Site Walk checklist state — stored separately due to nested structure
  const [swaChecklist, setSwaChecklist] = useState<Record<string, ChecklistEntry>>(() => {
    if (!init?.swaChecklist) return {};
    try { return JSON.parse(init.swaChecklist as string) as Record<string, ChecklistEntry>; } catch { return {}; }
  });
  const updateSwaCheck = (key: string, field: keyof ChecklistEntry, value: string | boolean) =>
    setSwaChecklist(prev => ({ ...prev, [key]: { ...SWA_DEFAULT_ENTRY, ...prev[key], [field]: value } }));

  // Elec Commissioning — dynamic rows
  const [ecrAttendees, setEcrAttendees] = useState<OperativeRecord[]>(() => {
    if (!init?.ecrAttendees) return [];
    try { return JSON.parse(init.ecrAttendees as string) as OperativeRecord[]; } catch { return []; }
  });
  const [ecrDelays, setEcrDelays] = useState<DelayRecord[]>(() => {
    if (!init?.ecrDelays) return [];
    try { return JSON.parse(init.ecrDelays as string) as DelayRecord[]; } catch { return []; }
  });
  // ECR activities checklist
  const ECR_ACTIVITIES = [
    'Dead Testing', 'IR Testing', 'Continuity Testing', 'Functional Testing',
    'Cause & Effect Testing', 'Emergency Lighting Test', 'Fire Alarm Interface Testing',
    'BMS Integration Check', 'Panel Energisation', 'Temporary Energisation',
    'Witness Testing', 'Defects / Faults Identified', 'Retesting Required',
    'Isolation Requirements Active', 'Access Restrictions', 'Snagging',
    'Outstanding Works Recorded', 'Partial Completions',
  ] as const;
  const [ecrActivities, setEcrActivities] = useState<Record<string, { status: string; comment: string }>>(() => {
    if (!init?.ecrActivities) return {};
    try { return JSON.parse(init.ecrActivities as string) as Record<string, { status: string; comment: string }>; } catch { return {}; }
  });
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
  const [ecrQaChecklist, setEcrQaChecklist] = useState<Record<string, { result: string; comment: string }>>(() => {
    if (!init?.ecrQaChecklist) return {};
    try { return JSON.parse(init.ecrQaChecklist as string) as Record<string, { result: string; comment: string }>; } catch { return {}; }
  });
  const updateEcrQa = (key: string, field: 'result' | 'comment', val: string) =>
    setEcrQaChecklist(prev => {
      const existing = prev[key] ?? { result: 'N/A', comment: '' };
      return { ...prev, [key]: { ...existing, [field]: val } };
    });

  // Daily Site Report — dynamic rows
  const [dsrAttendees, setDsrAttendees] = useState<OperativeRecord[]>(() => {
    if (!init?.dsrAttendees) return [];
    try { return JSON.parse(init.dsrAttendees as string) as OperativeRecord[]; } catch { return []; }
  });
  const [dsrDelays, setDsrDelays] = useState<DelayRecord[]>(() => {
    if (!init?.dsrDelays) return [];
    try { return JSON.parse(init.dsrDelays as string) as DelayRecord[]; } catch { return []; }
  });

  // Risk Assessment — dynamic rows
  const [ramsHazards, setRamsHazards] = useState<HazardRecord[]>(() => {
    if (!init?.ramsHazards) return [];
    try { return JSON.parse(init.ramsHazards as string) as HazardRecord[]; } catch { return []; }
  });
  const [ramsSignOffs, setRamsSignOffs] = useState<RamsSignOffRecord[]>(() => {
    if (!init?.ramsSignOffs) return [];
    try { return JSON.parse(init.ramsSignOffs as string) as RamsSignOffRecord[]; } catch { return []; }
  });

  // Accident / Incident Report — dynamic state
  const AIR_IMMEDIATE_ACTIONS = [
    'Area made safe', 'First aid provided', 'Emergency services called',
    'Supervisor informed', 'Client informed', 'Principal Contractor informed',
    'Site Manager informed', 'HSE informed', 'Other',
  ] as const;
  const [airImmediateActions, setAirImmediateActions] = useState<Set<string>>(() => {
    if (!init?.airImmediateActions) return new Set<string>();
    try { return new Set(JSON.parse(init.airImmediateActions as string) as string[]); } catch { return new Set<string>(); }
  });
  const toggleAirAction = (key: string) => setAirImmediateActions(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  interface WitnessEntry { name: string; company: string; contact: string; statement: string; }
  const [airWitnessStatements, setAirWitnessStatements] = useState<WitnessEntry[]>(() => {
    if (!init?.airWitnessStatements) return [];
    try { return JSON.parse(init.airWitnessStatements as string) as WitnessEntry[]; } catch { return []; }
  });
  const addWitness = () => setAirWitnessStatements(prev => [...prev, { name: '', company: '', contact: '', statement: '' }]);
  const removeWitness = (i: number) => setAirWitnessStatements(prev => prev.filter((_, idx) => idx !== i));
  const updateWitness = (i: number, field: keyof WitnessEntry, val: string) =>
    setAirWitnessStatements(prev => prev.map((w, idx) => idx === i ? { ...w, [field]: val } : w));

  // Plantroom Commissioning Record — dynamic state
  const [pcrAssets, setPcrAssets] = useState<PlantAssetRecord[]>(() => {
    if (!init?.pcrAssets) return [];
    try { return JSON.parse(init.pcrAssets as string) as PlantAssetRecord[]; } catch { return []; }
  });
  const [pcrDefects, setPcrDefects] = useState<PlantDefectRecord[]>(() => {
    if (!init?.pcrDefects) return [];
    try { return JSON.parse(init.pcrDefects as string) as PlantDefectRecord[]; } catch { return []; }
  });

  // PCR checklists — stored as Set<string> of checked keys
  const parsePcrSet = (key: string) => {
    if (!init?.[key as keyof typeof init]) return new Set<string>();
    try { return new Set(JSON.parse(init[key as keyof typeof init] as string) as string[]); } catch { return new Set<string>(); }
  };
  const [pcrFillChecklist,    setPcrFillChecklist]    = useState<Set<string>>(() => parsePcrSet('pcrFillChecklist'));
  const [pcrTestChecklist,    setPcrTestChecklist]    = useState<Set<string>>(() => parsePcrSet('pcrTestChecklist'));
  const [pcrFlushChecklist,   setPcrFlushChecklist]   = useState<Set<string>>(() => parsePcrSet('pcrFlushChecklist'));
  const [pcrTreatChecklist,   setPcrTreatChecklist]   = useState<Set<string>>(() => parsePcrSet('pcrTreatmentChecklist'));
  const [pcrCommChecklist,    setPcrCommChecklist]    = useState<Set<string>>(() => parsePcrSet('pcrCommChecklist'));
  const togglePcr = (setState: Dispatch<SetStateAction<Set<string>>>, key: string) =>
    setState(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  // HIU Commissioning Record — dynamic state
  interface HIUDefect { description: string; responsiblePerson: string; dueDate: string; status: string; comments: string; }
  const [hiuDefects, setHiuDefects] = useState<HIUDefect[]>(() => {
    if (!init?.hiuDefects) return [];
    try { return JSON.parse(init.hiuDefects as string) as HIUDefect[]; } catch { return []; }
  });
  const [hiuValveChecklist,    setHiuValveChecklist]    = useState<Set<string>>(() => parsePcrSet('hiuValveChecklist'));
  const [hiuControlsChecklist, setHiuControlsChecklist] = useState<Set<string>>(() => parsePcrSet('hiuControlsChecklist'));

  // MVHR Commissioning Record — dynamic state
  interface MVHRRoom { roomName: string; roomType: string; designSupply: string; actualSupply: string; designExtract: string; actualExtract: string; passOrFail: string; comments: string; }
  interface MVHRDefect { description: string; responsiblePerson: string; dueDate: string; status: string; photoUpload?: string; comments: string; }
  const [mvhrRooms, setMvhrRooms] = useState<MVHRRoom[]>(() => {
    if (!init?.mvhrRooms) return [];
    try { return JSON.parse(init.mvhrRooms as string) as MVHRRoom[]; } catch { return []; }
  });
  const [mvhrDefects, setMvhrDefects] = useState<MVHRDefect[]>(() => {
    if (!init?.mvhrDefects) return [];
    try { return JSON.parse(init.mvhrDefects as string) as MVHRDefect[]; } catch { return []; }
  });
  const parseMvhrCheck = (key: string): Record<string, string> => {
    if (!init?.[key]) return {};
    try { return JSON.parse(init[key] as string) as Record<string, string>; } catch { return {}; }
  };
  const [mvhrInstallChecklist,    setMvhrInstallChecklist]    = useState<Record<string, string>>(() => parseMvhrCheck('mvhrInstallChecklist'));
  const [mvhrFunctionalChecklist, setMvhrFunctionalChecklist] = useState<Record<string, string>>(() => parseMvhrCheck('mvhrFunctionalChecklist'));
  const [mvhrNoiseChecklist,      setMvhrNoiseChecklist]      = useState<Record<string, string>>(() => parseMvhrCheck('mvhrNoiseChecklist'));

  // Temperature Water Readings — dynamic rows
  const [twrReadings, setTwrReadings] = useState<TWRReadingRecord[]>(() => {
    if (!init?.twrReadings) return [];
    try { return JSON.parse(init.twrReadings as string) as TWRReadingRecord[]; } catch { return []; }
  });

  // Practical Completion Certificate — dynamic state
  const [pccAssets, setPccAssets] = useState<PCCAssetRecord[]>(() => {
    if (!init?.pccAssets) return [];
    try { return JSON.parse(init.pccAssets as string) as PCCAssetRecord[]; } catch { return []; }
  });
  const [pccChecklist, setPccChecklist] = useState<PCCChecklistItem[]>(() => {
    if (!init?.pccChecklist) return [];
    try { return JSON.parse(init.pccChecklist as string) as PCCChecklistItem[]; } catch { return []; }
  });

  const set = (key: string) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleAction = (status: string) => {
    const base: ExtendedSiteForm = {
      id: initialData?.id ?? `f${Date.now()}`,
      type,
      title: form.title,
      projectId: visibleProjects.find(p => p.name === form.project)?.id || '',
      projectName: form.project,
      date: form.date,
      completedBy: form.completedBy,
      description: form.description,
      comments: form.comments,
      status: (['Early Warning Notice', 'Site Instruction', 'RFI'].includes(type) ? form.status : status) as ExtendedFormStatus,
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
    if (type === 'Early Warning Notice') {
      Object.assign(base, {
        impact: form.impact,
        raisedBy: form.raisedBy,
      });
    }
    if (type === 'Site Instruction') {
      Object.assign(base, {
        raisedBy: form.raisedBy,
        instructionSource: form.instructionSource,
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
    if (type === 'Accident / Incident Report') {
      const riddorYes = ['airRiddorKilled','airRiddorSpecifiedInjury','airRiddorOverSevenDay',
        'airRiddorDangerousOccurrence','airRiddorPublicAffected','airRiddorOccupationalDisease']
        .some(k => form[k] === 'Yes');
      Object.assign(base, {
        airIncidentType:              form.airIncidentType,
        airTime:                      form.airTime,
        airInjuredPerson:             form.airInjuredPerson,
        airEmployer:                  form.airEmployer,
        airContactNumber:             form.airContactNumber,
        airWitnesses:                 form.airWitnesses,
        airInjuryClassification:      form.airInjuryClassification,
        airWhatHappened:              form.airWhatHappened,
        airImmediateActions:          JSON.stringify(Array.from(airImmediateActions)),
        airWitnessStatements:         JSON.stringify(airWitnessStatements),
        airRiddorKilled:              form.airRiddorKilled,
        airRiddorSpecifiedInjury:     form.airRiddorSpecifiedInjury,
        airRiddorOverSevenDay:        form.airRiddorOverSevenDay,
        airRiddorDangerousOccurrence: form.airRiddorDangerousOccurrence,
        airRiddorPublicAffected:      form.airRiddorPublicAffected,
        airRiddorOccupationalDisease: form.airRiddorOccupationalDisease,
        airRiddorGuidance:            riddorYes
          ? 'Potential RIDDOR reporting requirement identified. Review HSE guidance and notify the responsible manager immediately.'
          : 'No RIDDOR indicators identified based on responses. Review if circumstances change.',
        airRootCause:                 form.airRootCause,
        airContributoryFactors:       form.airContributoryFactors,
        airCorrectiveActions:         form.airCorrectiveActions,
        airPreventativeActions:       form.airPreventativeActions,
        airResponsiblePerson:         form.airResponsiblePerson,
        airTargetCompletionDate:      form.airTargetCompletionDate,
        airInvestigationComplete:     form.airInvestigationComplete,
        airActionsComplete:           form.airActionsComplete,
        airLessonsLearned:            form.airLessonsLearned,
        airClosedBy:                  form.airClosedBy,
        airClosedDate:                form.airClosedDate,
      });
    }
    if (type === 'Plantroom Commissioning Record') {
      Object.assign(base, {
        pcrPlantroom:           form.pcrPlantroom,
        pcrEngineer:            form.pcrEngineer,
        pcrWitness:             form.pcrWitness,
        pcrMainContractor:      form.pcrMainContractor,
        pcrConsultant:          form.pcrConsultant,
        pcrAssets:              JSON.stringify(pcrAssets),
        pcrFillChecklist:       JSON.stringify(Array.from(pcrFillChecklist)),
        pcrFillPressureInitial: form.pcrFillPressureInitial,
        pcrFillPressureFinal:   form.pcrFillPressureFinal,
        pcrStaticHead:          form.pcrStaticHead,
        pcrFillMedium:          form.pcrFillMedium,
        pcrFillComments:        form.pcrFillComments,
        pcrTestMedium:          form.pcrTestMedium,
        pcrTestPressure:        form.pcrTestPressure,
        pcrTestDuration:        form.pcrTestDuration,
        pcrTestStartTime:       form.pcrTestStartTime,
        pcrTestFinishTime:      form.pcrTestFinishTime,
        pcrTestChecklist:       JSON.stringify(Array.from(pcrTestChecklist)),
        pcrTestComments:        form.pcrTestComments,
        pcrFlushChecklist:      JSON.stringify(Array.from(pcrFlushChecklist)),
        pcrFlushChemical:       form.pcrFlushChemical,
        pcrWaterClarity:        form.pcrWaterClarity,
        pcrFlushComments:       form.pcrFlushComments,
        pcrTreatmentInhibitor:  form.pcrTreatmentInhibitor,
        pcrTreatmentBatch:      form.pcrTreatmentBatch,
        pcrTreatmentQty:        form.pcrTreatmentQty,
        pcrTreatmentChecklist:  JSON.stringify(Array.from(pcrTreatChecklist)),
        pcrCommChecklist:       JSON.stringify(Array.from(pcrCommChecklist)),
        pcrCommComments:        form.pcrCommComments,
        pcrDefects:             JSON.stringify(pcrDefects),
        pcrHandoverWitness:     form.pcrHandoverWitness,
        pcrHandoverCompany:     form.pcrHandoverCompany,
        pcrHandoverDate:        form.pcrHandoverDate,
        pcrHandoverComments:    form.pcrHandoverComments,
      });
    }
    if (type === 'HIU Commissioning Record') {
      Object.assign(base, {
        hiuPlot:                  form.hiuPlot,
        hiuBlock:                 form.hiuBlock,
        hiuLevel:                 form.hiuLevel,
        hiuCommissioningEngineer: form.hiuCommissioningEngineer,
        hiuCompany:               form.hiuCompany,
        hiuWitness:               form.hiuWitness,
        hiuRef:                   form.hiuRef,
        hiuManufacturer:          form.hiuManufacturer,
        hiuModel:                 form.hiuModel,
        hiuSerialNumber:          form.hiuSerialNumber,
        hiuLocation:              form.hiuLocation,
        hiuAssetTag:              form.hiuAssetTag,
        heatMeterRef:             form.heatMeterRef,
        heatMeterManufacturer:    form.heatMeterManufacturer,
        heatMeterModel:           form.heatMeterModel,
        heatMeterSerialNumber:    form.heatMeterSerialNumber,
        heatMeterReading:         form.heatMeterReading,
        heatMeterPulseChecked:    form.heatMeterPulseChecked,
        heatMeterMBusConnected:   form.heatMeterMBusConnected,
        valvePrimaryFlow:         form.valvePrimaryFlow,
        valvePrimaryReturn:       form.valvePrimaryReturn,
        valveSecondaryFlow:       form.valveSecondaryFlow,
        valveSecondaryReturn:     form.valveSecondaryReturn,
        valveColdWater:           form.valveColdWater,
        valveDHWOutlet:           form.valveDHWOutlet,
        hiuValveChecklist:        JSON.stringify(Array.from(hiuValveChecklist)),
        primaryFlowTemp:          form.primaryFlowTemp,
        primaryReturnTemp:        form.primaryReturnTemp,
        primaryDiffPressure:      form.primaryDiffPressure,
        primaryFlowRate:          form.primaryFlowRate,
        systemPressure:           form.systemPressure,
        secondaryFlowTemp:        form.secondaryFlowTemp,
        secondaryReturnTemp:      form.secondaryReturnTemp,
        heatingFlowConfirmed:     form.heatingFlowConfirmed,
        heatingReturnConfirmed:   form.heatingReturnConfirmed,
        radUFHWarmed:             form.radUFHWarmed,
        cwInletTemp:              form.cwInletTemp,
        dhwOutletTemp:            form.dhwOutletTemp,
        dhwFlowRate:              form.dhwFlowRate,
        dhwTempStabilised:        form.dhwTempStabilised,
        dhwOutletAcceptable:      form.dhwOutletAcceptable,
        hiuControlsChecklist:     JSON.stringify(Array.from(hiuControlsChecklist)),
        hiuDefects:               JSON.stringify(hiuDefects),
        hiuCommissioningStatus:   form.hiuCommissioningStatus,
        hiuEngineerName:          form.hiuEngineerName,
        hiuWitnessName:           form.hiuWitnessName,
        hiuSignOffDate:           form.hiuSignOffDate,
        hiuFinalComments:         form.hiuFinalComments,
      });
    }
    if (type === 'MVHR Commissioning Record') {
      Object.assign(base, {
        mvhrPlot:                  form.mvhrPlot,
        mvhrBlock:                 form.mvhrBlock,
        mvhrLevel:                 form.mvhrLevel,
        mvhrCommissioningEngineer: form.mvhrCommissioningEngineer,
        mvhrCompany:               form.mvhrCompany,
        mvhrWitness:               form.mvhrWitness,
        mvhrUnitRef:               form.mvhrUnitRef,
        mvhrManufacturer:          form.mvhrManufacturer,
        mvhrModel:                 form.mvhrModel,
        mvhrSerialNumber:          form.mvhrSerialNumber,
        mvhrLocation:              form.mvhrLocation,
        mvhrAssetTag:              form.mvhrAssetTag,
        mvhrUnitCapacity:          form.mvhrUnitCapacity,
        mvhrInstallChecklist:      JSON.stringify(mvhrInstallChecklist),
        mvhrInstallComments:       form.mvhrInstallComments,
        mvhrRooms:                 JSON.stringify(mvhrRooms),
        mvhrFunctionalChecklist:   JSON.stringify(mvhrFunctionalChecklist),
        mvhrFunctionalComments:    form.mvhrFunctionalComments,
        mvhrNoiseChecklist:        JSON.stringify(mvhrNoiseChecklist),
        mvhrNoiseComments:         form.mvhrNoiseComments,
        mvhrDefects:               JSON.stringify(mvhrDefects),
        mvhrCommissioningStatus:   form.mvhrCommissioningStatus,
        mvhrEngineerName:          form.mvhrEngineerName,
        mvhrWitnessName:           form.mvhrWitnessName,
        mvhrSignOffDate:           form.mvhrSignOffDate,
        mvhrFinalComments:         form.mvhrFinalComments,
      });
    }
    if (type === 'Temperature Water Readings') {
      Object.assign(base, {
        twrSystem:      form.twrSystem,
        twrLocation:    form.twrLocation,
        twrArea:        form.twrArea,
        twrWitnessedBy: form.twrWitnessedBy,
        twrReadings:    JSON.stringify(twrReadings),
        engineer:       form.completedBy,
      });
    }
    if (type === 'Practical Completion Certificate') {
      Object.assign(base, {
        pccRef:              form.pccRef,
        pccContract:         form.pccContract,
        pccClient:           form.pccClient,
        pccLocationArea:     form.pccLocationArea,
        pccDescriptionOfWorks: form.pccDescriptionOfWorks,
        pccAssets:           JSON.stringify(pccAssets),
        pccChecklist:        JSON.stringify(pccChecklist),
        pccOutstandingItems: form.pccOutstandingItems,
        pccHandedOverBy:        form.pccHandedOverBy,
        pccHandedOverByTitle:   form.pccHandedOverByTitle,
        pccHandedOverByCompany: form.pccHandedOverByCompany,
        pccAcceptedBy:          form.pccAcceptedBy,
        pccAcceptedByTitle:     form.pccAcceptedByTitle,
        pccAcceptedByCompany:   form.pccAcceptedByCompany,
        pccAcceptanceDate:   form.pccAcceptanceDate,
        pccSignature:        form.pccSignature,
      });
    }
    if (type === 'Site Hold Up') {
      Object.assign(base, {
        shuRef:              form.shuRef,
        areaLocation:        form.areaLocation,
        description:         form.description,
        cause:               form.cause,
        impact:              form.impact,
        shuImmediateActions: form.shuImmediateActions,
        comments:            form.comments,
      });
    }
    if (type === 'Site Change Request') {
      Object.assign(base, {
        scrRef:              form.scrRef,
        areaLocation:        form.areaLocation,
        description:         form.description,
        scrReason:           form.scrReason,
        scrProgrammeImpact:  form.scrProgrammeImpact,
        scrCommercialImpact: form.scrCommercialImpact,
        comments:            form.comments,
      });
    }
    if (type === 'Site Note') {
      Object.assign(base, {
        title:               form.snSubject || form.title,
        snRef:               form.snRef,
        snCategory:          form.snCategory,
        snSubject:           form.snSubject,
        snBody:              form.snBody,
        snRecommendedAction: form.snRecommendedAction,
        snTime:              form.snTime,
        areaLocation:        form.areaLocation,
        comments:            form.comments,
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
  const isAIR = type === 'Accident / Incident Report';
  const isPCR = type === 'Plantroom Commissioning Record';
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
  const isHIU = type === 'HIU Commissioning Record';
  const isMVHR = type === 'MVHR Commissioning Record';
  const isTWR = type === 'Temperature Water Readings';
  const isPCC = type === 'Practical Completion Certificate';
  const isSHU = type === 'Site Hold Up';
  const isSCR = type === 'Site Change Request';
  const isSN  = type === 'Site Note';

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
    : isAIR
    ? 'bg-red-700 hover:bg-red-800'
    : isPCR
    ? 'bg-sky-600 hover:bg-sky-700'
    : isHIU
    ? 'bg-teal-600 hover:bg-teal-700'
    : isMVHR
    ? 'bg-sky-600 hover:bg-sky-700'
    : isTWR
    ? 'bg-blue-600 hover:bg-blue-700'
    : isPCC
    ? 'bg-emerald-600 hover:bg-emerald-700'
    : isSHU
    ? 'bg-amber-600 hover:bg-amber-700'
    : isSCR
    ? 'bg-sky-600 hover:bg-sky-700'
    : isSN
    ? 'bg-slate-600 hover:bg-slate-700'
    : 'bg-[#f97316] hover:bg-orange-600';

  const rfiStatuses = ['Draft', 'Issued', 'Awaiting Response', 'Closed'];
  const holdUpStatuses = ['Open', 'Resolved', 'Escalated'];
  const shuStatuses = ['Draft', 'Open', 'Resolved', 'Closed'];
  const scrStatuses = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected'];
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

          {/* ── Title (all forms except Site Note, which uses Subject as title) ── */}
          {!isSN && (
            <div>
              <label className={labelCls}>Title *</label>
              <input
                value={form.title}
                onChange={set('title')}
                className={`mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-3 text-base font-semibold text-white outline-none focus:border-[#f97316] placeholder:text-slate-600 placeholder:font-normal`}
                placeholder="Enter a clear, descriptive title for this record..."
              />
            </div>
          )}

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
                    {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                    {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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

          {/* ── Site Hold Up Fields ── */}
          {isSHU && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Reference Number</label>
                  <input value={form.shuRef} onChange={set('shuRef')} className={inputCls} placeholder="e.g. SHU-001" />
                </div>
                <div>
                  <label className={labelCls}>Date *</label>
                  <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Project *</label>
                <div className="relative">
                  <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                    <option value="">Select project...</option>
                    {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Location / Area</label>
                <input value={form.areaLocation} onChange={set('areaLocation')} className={inputCls} placeholder="e.g. Level 2 – Corridor B" />
              </div>
              <div>
                <label className={labelCls}>Title *</label>
                <input value={form.title} onChange={set('title')} className={inputCls} placeholder="Brief title of the hold up..." />
              </div>
              <div>
                <label className={labelCls}>Description of Hold Up *</label>
                <textarea value={form.description} onChange={set('description')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="Describe the hold up or disruption in detail..." />
              </div>
              <div>
                <label className={labelCls}>Cause of Hold Up</label>
                <textarea value={form.cause} onChange={set('cause')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="What caused the hold up?" />
              </div>
              <div>
                <label className={labelCls}>Impact on Progress</label>
                <textarea value={form.impact} onChange={set('impact')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="Describe the impact on the programme and works..." />
              </div>
              <div>
                <label className={labelCls}>Immediate Actions Taken</label>
                <textarea value={form.shuImmediateActions} onChange={set('shuImmediateActions')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="What was done immediately to address the hold up?" />
              </div>
              <div>
                <label className={labelCls}>Additional Comments</label>
                <textarea value={form.comments} onChange={set('comments')} rows={2} className={`${inputCls} resize-none`}
                  placeholder="Any additional information..." />
              </div>
              <div>
                <label className={labelCls}>Photos / Attachments</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload photos or supporting documents" />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <div className="relative">
                  <select value={form.status} onChange={set('status')} className={`${inputCls} appearance-none pr-8`}>
                    {shuStatuses.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </>
          )}

          {/* ── Site Change Request Fields ── */}
          {isSCR && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Reference Number</label>
                  <input value={form.scrRef} onChange={set('scrRef')} className={inputCls} placeholder="e.g. SCR-001" />
                </div>
                <div>
                  <label className={labelCls}>Date *</label>
                  <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Project *</label>
                <div className="relative">
                  <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                    <option value="">Select project...</option>
                    {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Location / Area</label>
                <input value={form.areaLocation} onChange={set('areaLocation')} className={inputCls} placeholder="e.g. Level 3 – Plant Room" />
              </div>
              <div>
                <label className={labelCls}>Title *</label>
                <input value={form.title} onChange={set('title')} className={inputCls} placeholder="Brief title of the requested change..." />
              </div>
              <div>
                <label className={labelCls}>Description of Requested Change *</label>
                <textarea value={form.description} onChange={set('description')} rows={4} className={`${inputCls} resize-none`}
                  placeholder="Describe the change or additional works requested..." />
              </div>
              <div>
                <label className={labelCls}>Reason for Change</label>
                <textarea value={form.scrReason} onChange={set('scrReason')} rows={3} className={`${inputCls} resize-none`}
                  placeholder="Why is this change required?" />
              </div>
              <div>
                <label className={labelCls}>Potential Programme Impact</label>
                <textarea value={form.scrProgrammeImpact} onChange={set('scrProgrammeImpact')} rows={2} className={`${inputCls} resize-none`}
                  placeholder="Any anticipated impact on the programme..." />
              </div>
              <div>
                <label className={labelCls}>Potential Commercial Impact</label>
                <textarea value={form.scrCommercialImpact} onChange={set('scrCommercialImpact')} rows={2} className={`${inputCls} resize-none`}
                  placeholder="Any anticipated commercial implications — for information only, not a variation..." />
              </div>
              <div>
                <label className={labelCls}>Additional Comments</label>
                <textarea value={form.comments} onChange={set('comments')} rows={2} className={`${inputCls} resize-none`}
                  placeholder="Any additional information..." />
              </div>
              <div>
                <label className={labelCls}>Photos / Attachments</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload photos or supporting documents" />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <div className="relative">
                  <select value={form.status} onChange={set('status')} className={`${inputCls} appearance-none pr-8`}>
                    {scrStatuses.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </>
          )}

          {/* ── Site Note Fields ── */}
          {isSN && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Site Note Reference</label>
                  <input value={form.snRef} onChange={set('snRef')} className={inputCls} placeholder="e.g. SN-0001" />
                </div>
                <div>
                  <label className={labelCls}>Date *</label>
                  <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Time</label>
                  <input type="time" value={form.snTime} onChange={set('snTime')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Category *</label>
                  <div className="relative">
                    <select value={form.snCategory} onChange={set('snCategory')} className={`${inputCls} appearance-none pr-8`}>
                      <option value="">Select category...</option>
                      {[
                        'Existing Condition', 'Damage', 'Observation', 'Information',
                        'Client Request', 'Access', 'Safety', 'Environmental',
                        'Programme', 'Utilities', 'Delivery', 'Other',
                      ].map(c => <option key={c} value={c}>{c}</option>)}
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
                    {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Location / Area</label>
                <input value={form.areaLocation} onChange={set('areaLocation')} className={inputCls} placeholder="e.g. Level 2 – Corridor B" />
              </div>
              <div>
                <label className={labelCls}>Created By *</label>
                <input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Full name of the person creating this note" />
              </div>
              <div>
                <label className={labelCls}>Subject *</label>
                <input value={form.snSubject} onChange={set('snSubject')} className={inputCls} placeholder="Brief subject / title for this site note..." />
              </div>
              <div>
                <label className={labelCls}>Site Note *</label>
                <textarea
                  value={form.snBody}
                  onChange={set('snBody')}
                  rows={8}
                  className={`${inputCls} resize-none`}
                  placeholder="Record the formal site note here — describe the condition, observation or matter in full. Be factual and contemporaneous. Include location, extent, context and any relevant measurements or dimensions..."
                />
              </div>
              <div>
                <label className={labelCls}>Recommended Action <span className="text-slate-600 font-normal normal-case">(optional)</span></label>
                <textarea
                  value={form.snRecommendedAction}
                  onChange={set('snRecommendedAction')}
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Any recommended action or follow-up required..." />
              </div>
              <div>
                <label className={labelCls}>Additional Comments</label>
                <textarea value={form.comments} onChange={set('comments')} rows={2} className={`${inputCls} resize-none`}
                  placeholder="Any additional information..." />
              </div>
              <div>
                <label className={labelCls}>Photos / Attachments</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} accept="image/*,.pdf,.doc,.docx" label="Upload photos or supporting documents" />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <div className="relative">
                  <select value={form.status} onChange={set('status')} className={`${inputCls} appearance-none pr-8`}>
                    {(['Draft', 'Submitted', 'Approved'] as const).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                        {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                        {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                        {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                        {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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

          {/* ── Accident / Incident Report ── */}
          {isAIR && (() => {
            const riddorYes = ['airRiddorKilled','airRiddorSpecifiedInjury','airRiddorOverSevenDay',
              'airRiddorDangerousOccurrence','airRiddorPublicAffected','airRiddorOccupationalDisease']
              .some(k => form[k] === 'Yes');
            const selCls = `${inputCls} appearance-none pr-8`;
            const sectionHdr = (label: string, sub?: string) => (
              <div className="pt-2 pb-1 border-b border-[#1e2d4a]">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
              </div>
            );
            return (
              <>
                {/* Section 1 – Basic Information */}
                {sectionHdr('Section 1 — Basic Information')}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Project *</label>
                    <div className="relative">
                      <select value={form.project} onChange={set('project')} className={selCls}>
                        <option value="">Select project...</option>
                        {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Date of Incident *</label>
                    <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Time of Incident</label>
                    <input type="time" value={form.airTime} onChange={set('airTime')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Location / Area</label>
                    <input value={form.areaLocation ?? ''} onChange={set('areaLocation')} className={inputCls} placeholder="e.g. Level 3, Plant Room" />
                  </div>
                  <div>
                    <label className={labelCls}>Reported By *</label>
                    <input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Your name" />
                  </div>
                  <div>
                    <label className={labelCls}>Injured / Affected Person</label>
                    <input value={form.airInjuredPerson} onChange={set('airInjuredPerson')} className={inputCls} placeholder="Full name" />
                  </div>
                  <div>
                    <label className={labelCls}>Employer</label>
                    <input value={form.airEmployer} onChange={set('airEmployer')} className={inputCls} placeholder="Company name" />
                  </div>
                  <div>
                    <label className={labelCls}>Contact Number</label>
                    <input value={form.airContactNumber} onChange={set('airContactNumber')} className={inputCls} placeholder="Phone or email" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Witnesses</label>
                  <input value={form.airWitnesses} onChange={set('airWitnesses')} className={inputCls} placeholder="Names of anyone who witnessed the event" />
                </div>

                {/* Section 2 – Incident Classification */}
                {sectionHdr('Section 2 — Incident Classification')}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Incident Type *</label>
                    <div className="relative">
                      <select value={form.airIncidentType} onChange={set('airIncidentType')} className={selCls}>
                        {['Accident','Incident','Near Miss','Dangerous Occurrence','Environmental Incident','Property Damage'].map(v => <option key={v}>{v}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Section 3 – Injury Classification */}
                  <div>
                    <label className={labelCls}>Injury Classification *</label>
                    <div className="relative">
                      <select value={form.airInjuryClassification} onChange={set('airInjuryClassification')} className={selCls}>
                        {['No Injury','Minor Injury','First Aid Only','Medical Treatment','Lost Time Injury','Major Injury','Fatality'].map(v => <option key={v}>{v}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Section 4 – What Happened */}
                {sectionHdr('Section 4 — What Happened', 'Describe: what happened, sequence of events, equipment involved, environmental conditions, immediate causes')}
                <div>
                  <textarea value={form.airWhatHappened} onChange={set('airWhatHappened')} rows={6}
                    className={`${inputCls} resize-none`}
                    placeholder="Provide a clear, factual account of what happened. Include the sequence of events, any equipment, materials or environmental conditions involved, and the immediate cause of the incident..." />
                </div>

                {/* Section 5 – Immediate Actions */}
                {sectionHdr('Section 5 — Immediate Actions Taken')}
                <div className="grid grid-cols-2 gap-2">
                  {AIR_IMMEDIATE_ACTIONS.map(action => (
                    <label key={action} className="flex items-center gap-2.5 cursor-pointer group">
                      <div
                        onClick={() => toggleAirAction(action)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${airImmediateActions.has(action) ? 'bg-red-600 border-red-600' : 'border-[#1e2d4a] group-hover:border-slate-500'}`}
                      >
                        {airImmediateActions.has(action) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 3.5L4 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span className="text-xs text-slate-300">{action}</span>
                    </label>
                  ))}
                </div>

                {/* Section 6 – Evidence */}
                {sectionHdr('Section 6 — Evidence')}
                <div>
                  <label className={labelCls}>Photos / Attachments / Witness Statements</label>
                  <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles}
                    label="Upload photos, sketches, documents and witness statements" />
                </div>

                {/* Section 7 – Witness Statements */}
                {sectionHdr('Section 7 — Witness Information')}
                <div className="space-y-3">
                  {airWitnessStatements.map((w, i) => (
                    <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3 relative">
                      <button onClick={() => removeWitness(i)} className="absolute top-3 right-3 text-slate-600 hover:text-red-400 transition-colors">
                        <X size={13} />
                      </button>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Witness {i + 1}</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={labelCls}>Name</label>
                          <input value={w.name} onChange={e => updateWitness(i, 'name', e.target.value)} className={inputCls} placeholder="Full name" />
                        </div>
                        <div>
                          <label className={labelCls}>Company</label>
                          <input value={w.company} onChange={e => updateWitness(i, 'company', e.target.value)} className={inputCls} placeholder="Company" />
                        </div>
                        <div>
                          <label className={labelCls}>Contact</label>
                          <input value={w.contact} onChange={e => updateWitness(i, 'contact', e.target.value)} className={inputCls} placeholder="Phone / Email" />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Witness Statement</label>
                        <textarea value={w.statement} onChange={e => updateWitness(i, 'statement', e.target.value)} rows={3}
                          className={`${inputCls} resize-none`} placeholder="Written account of what the witness observed..." />
                      </div>
                    </div>
                  ))}
                  <button onClick={addWitness}
                    className="w-full py-2 rounded-lg border border-dashed border-[#1e2d4a] text-xs text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors">
                    + Add Witness
                  </button>
                </div>

                {/* Section 8 – RIDDOR Assessment */}
                {sectionHdr('Section 8 — RIDDOR Assessment', 'Answer the following questions. Guidance will be displayed based on your responses.')}
                <div className="space-y-2">
                  {([
                    ['airRiddorKilled', 'Was anyone killed?'],
                    ['airRiddorSpecifiedInjury', 'Was there a specified injury? (fracture, amputation, loss of sight, crush injury, burns, scalp wounds, hospitalisation >24h)'],
                    ['airRiddorOverSevenDay', 'Was there an over-seven-day incapacitation injury?'],
                    ['airRiddorDangerousOccurrence', 'Was there a dangerous occurrence? (structural collapse, explosion, gas escape, electrical incident, etc.)'],
                    ['airRiddorPublicAffected', 'Was a member of the public killed or taken to hospital?'],
                    ['airRiddorOccupationalDisease', 'Is there a reportable occupational disease (carpal tunnel, tendonitis, occupational asthma, etc.)?'],
                  ] as [string, string][]).map(([key, label]) => (
                    <div key={key} className="flex items-start gap-3 p-3 bg-[#0d1628] border border-[#1e2d4a] rounded-lg">
                      <div className="flex-1 text-xs text-slate-300 leading-snug">{label}</div>
                      <div className="flex gap-2 shrink-0">
                        {['Yes', 'No'].map(v => (
                          <button key={v} onClick={() => setForm(f => ({ ...f, [key]: v }))}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${form[key] === v ? (v === 'Yes' ? 'bg-red-700 border-red-600 text-white' : 'bg-emerald-900/60 border-emerald-700/40 text-emerald-300') : 'bg-transparent border-[#1e2d4a] text-slate-500 hover:border-slate-500'}`}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {riddorYes && (
                  <div className="p-4 bg-red-950/40 border border-red-700/50 rounded-xl">
                    <p className="text-xs font-bold text-red-300 mb-1">RIDDOR Review Required</p>
                    <p className="text-xs text-red-200/80 leading-relaxed">Potential RIDDOR reporting requirement identified. Review HSE guidance and notify the responsible manager immediately. This form does not automatically satisfy any statutory reporting obligation.</p>
                  </div>
                )}

                {/* Section 9 – Investigation */}
                {sectionHdr('Section 9 — Investigation')}
                <div>
                  <label className={labelCls}>Root Cause</label>
                  <textarea value={form.airRootCause} onChange={set('airRootCause')} rows={3}
                    className={`${inputCls} resize-none`} placeholder="Identify the root cause of the incident..." />
                </div>
                <div>
                  <label className={labelCls}>Contributory Factors</label>
                  <textarea value={form.airContributoryFactors} onChange={set('airContributoryFactors')} rows={3}
                    className={`${inputCls} resize-none`} placeholder="List any contributing factors (environmental, behavioural, systemic, etc.)" />
                </div>
                <div>
                  <label className={labelCls}>Corrective Actions</label>
                  <textarea value={form.airCorrectiveActions} onChange={set('airCorrectiveActions')} rows={3}
                    className={`${inputCls} resize-none`} placeholder="What actions are required to correct the immediate problem?" />
                </div>
                <div>
                  <label className={labelCls}>Preventative Actions</label>
                  <textarea value={form.airPreventativeActions} onChange={set('airPreventativeActions')} rows={3}
                    className={`${inputCls} resize-none`} placeholder="What systemic changes are required to prevent recurrence?" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Responsible Person</label>
                    <input value={form.airResponsiblePerson} onChange={set('airResponsiblePerson')} className={inputCls} placeholder="Name" />
                  </div>
                  <div>
                    <label className={labelCls}>Target Completion Date</label>
                    <input type="date" value={form.airTargetCompletionDate} onChange={set('airTargetCompletionDate')} className={inputCls} />
                  </div>
                </div>

                {/* Section 10 – Close Out */}
                {sectionHdr('Section 10 — Close Out')}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Investigation Complete</label>
                    <div className="relative">
                      <select value={form.airInvestigationComplete} onChange={set('airInvestigationComplete')} className={selCls}>
                        <option>No</option><option>Yes</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Actions Complete</label>
                    <div className="relative">
                      <select value={form.airActionsComplete} onChange={set('airActionsComplete')} className={selCls}>
                        <option>No</option><option>Yes</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Closed By</label>
                    <input value={form.airClosedBy} onChange={set('airClosedBy')} className={inputCls} placeholder="Name" />
                  </div>
                  <div>
                    <label className={labelCls}>Closed Date</label>
                    <input type="date" value={form.airClosedDate} onChange={set('airClosedDate')} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Lessons Learned</label>
                  <textarea value={form.airLessonsLearned} onChange={set('airLessonsLearned')} rows={3}
                    className={`${inputCls} resize-none`} placeholder="What can be learned from this incident to improve site safety?" />
                </div>

                {/* Status */}
                <div>
                  <label className={labelCls}>Status</label>
                  <div className="relative">
                    <select value={form.status} onChange={set('status')} className={selCls}>
                      {['Draft','Submitted','Under Investigation','Closed'].map(v => <option key={v}>{v}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </>
            );
          })()}

          {/* ── Plantroom Commissioning Record ── */}
          {isPCR && (() => {
            const selCls = `${inputCls} appearance-none pr-8`;
            const sHdr = (label: string, sub?: string) => (
              <div className="pt-2 pb-1 border-b border-[#1e2d4a]">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
              </div>
            );
            const CheckRow = ({ label, stateSet, setState }: { label: string; stateSet: Set<string>; setState: Dispatch<SetStateAction<Set<string>>> }) => (
              <label className="flex items-center gap-2.5 cursor-pointer group py-1">
                <div onClick={() => togglePcr(setState, label)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${stateSet.has(label) ? 'bg-sky-600 border-sky-600' : 'border-[#1e2d4a] group-hover:border-slate-500'}`}>
                  {stateSet.has(label) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 3.5L4 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span className="text-xs text-slate-300">{label}</span>
              </label>
            );
            return (
              <>
                {/* S1 – Project Information */}
                {sHdr('Section 1 — Project Information')}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Project *</label>
                    <div className="relative">
                      <select value={form.project} onChange={set('project')} className={selCls}>
                        <option value="">Select project...</option>
                        {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Plantroom Reference</label>
                    <input value={form.pcrPlantroom} onChange={set('pcrPlantroom')} className={inputCls} placeholder="e.g. PR-01, Level B1" />
                  </div>
                  <div>
                    <label className={labelCls}>Date *</label>
                    <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Location</label>
                    <input value={form.areaLocation ?? ''} onChange={set('areaLocation')} className={inputCls} placeholder="Building / floor" />
                  </div>
                  <div>
                    <label className={labelCls}>Engineer *</label>
                    <input value={form.pcrEngineer} onChange={set('pcrEngineer')} className={inputCls} placeholder="Commissioning engineer" />
                  </div>
                  <div>
                    <label className={labelCls}>Witness</label>
                    <input value={form.pcrWitness} onChange={set('pcrWitness')} className={inputCls} placeholder="Witness name" />
                  </div>
                  <div>
                    <label className={labelCls}>Main Contractor</label>
                    <input value={form.pcrMainContractor} onChange={set('pcrMainContractor')} className={inputCls} placeholder="Main contractor" />
                  </div>
                  <div>
                    <label className={labelCls}>Consultant</label>
                    <input value={form.pcrConsultant} onChange={set('pcrConsultant')} className={inputCls} placeholder="Consultant / engineer" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Comments</label>
                  <textarea value={form.comments} onChange={set('comments')} rows={2}
                    className={`${inputCls} resize-none`} placeholder="General notes..." />
                </div>

                {/* S2 – Plant Asset Register */}
                {sHdr('Section 2 — Plant Asset Register', 'Add each asset in the plantroom. Add as many entries as required.')}
                <PlantAssetRows rows={pcrAssets} onChange={setPcrAssets} />
                <div className="mt-1">
                  <label className={labelCls}>Asset Register Photos</label>
                  <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles}
                    label="Upload photos of installed assets" />
                </div>

                {/* S3 – System Fill */}
                {sHdr('Section 3 — System Fill')}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    'Visual Inspection Complete', 'Drain Valves Closed', 'Air Vents Open',
                    'Expansion Vessel Charged', 'Pressurisation Unit Operational',
                    'Fill Point Identified', 'Dosing Point Identified',
                  ].map(item => (
                    <CheckRow key={item} label={item} stateSet={pcrFillChecklist} setState={setPcrFillChecklist} />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  <div>
                    <label className={labelCls}>Initial Fill Pressure</label>
                    <input value={form.pcrFillPressureInitial} onChange={set('pcrFillPressureInitial')} className={inputCls} placeholder="bar / psi" />
                  </div>
                  <div>
                    <label className={labelCls}>Final Fill Pressure</label>
                    <input value={form.pcrFillPressureFinal} onChange={set('pcrFillPressureFinal')} className={inputCls} placeholder="bar / psi" />
                  </div>
                  <div>
                    <label className={labelCls}>Static Head</label>
                    <input value={form.pcrStaticHead} onChange={set('pcrStaticHead')} className={inputCls} placeholder="m" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Fill Medium</label>
                  <input value={form.pcrFillMedium} onChange={set('pcrFillMedium')} className={inputCls} placeholder="e.g. Mains Water" />
                </div>
                <div>
                  <label className={labelCls}>Fill Comments</label>
                  <textarea value={form.pcrFillComments} onChange={set('pcrFillComments')} rows={2}
                    className={`${inputCls} resize-none`} placeholder="Notes on fill process..." />
                </div>

                {/* S4 – Pressure Test */}
                {sHdr('Section 4 — Pressure Test')}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Test Medium</label>
                    <input value={form.pcrTestMedium} onChange={set('pcrTestMedium')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Test Pressure</label>
                    <input value={form.pcrTestPressure} onChange={set('pcrTestPressure')} className={inputCls} placeholder="bar / psi" />
                  </div>
                  <div>
                    <label className={labelCls}>Duration</label>
                    <input value={form.pcrTestDuration} onChange={set('pcrTestDuration')} className={inputCls} placeholder="e.g. 1 hour" />
                  </div>
                  <div>
                    <label className={labelCls}>Start Time</label>
                    <input type="time" value={form.pcrTestStartTime} onChange={set('pcrTestStartTime')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Finish Time</label>
                    <input type="time" value={form.pcrTestFinishTime} onChange={set('pcrTestFinishTime')} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {['Pressure Stable', 'No Leaks Found', 'Remedial Works Required'].map(item => (
                    <CheckRow key={item} label={item} stateSet={pcrTestChecklist} setState={setPcrTestChecklist} />
                  ))}
                </div>
                <div>
                  <label className={labelCls}>Pressure Test Comments</label>
                  <textarea value={form.pcrTestComments} onChange={set('pcrTestComments')} rows={2}
                    className={`${inputCls} resize-none`} placeholder="Any observations..." />
                </div>

                {/* S5 – Flushing */}
                {sHdr('Section 5 — Flushing')}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    'Pre-Commission Clean Completed', 'Main Flush Completed',
                    'Side Stream Filtration Used', 'Chemical Flush Completed',
                  ].map(item => (
                    <CheckRow key={item} label={item} stateSet={pcrFlushChecklist} setState={setPcrFlushChecklist} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div>
                    <label className={labelCls}>Chemical Used</label>
                    <input value={form.pcrFlushChemical} onChange={set('pcrFlushChemical')} className={inputCls} placeholder="Product name" />
                  </div>
                  <div>
                    <label className={labelCls}>Water Clarity</label>
                    <input value={form.pcrWaterClarity} onChange={set('pcrWaterClarity')} className={inputCls} placeholder="e.g. Clear, < 5 NTU" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Flushing Comments</label>
                  <textarea value={form.pcrFlushComments} onChange={set('pcrFlushComments')} rows={2}
                    className={`${inputCls} resize-none`} placeholder="Notes on flushing..." />
                </div>

                {/* S6 – Water Treatment */}
                {sHdr('Section 6 — Water Treatment')}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Inhibitor Product</label>
                    <input value={form.pcrTreatmentInhibitor} onChange={set('pcrTreatmentInhibitor')} className={inputCls} placeholder="Product name" />
                  </div>
                  <div>
                    <label className={labelCls}>Batch Number</label>
                    <input value={form.pcrTreatmentBatch} onChange={set('pcrTreatmentBatch')} className={inputCls} placeholder="Batch / lot no." />
                  </div>
                  <div>
                    <label className={labelCls}>Quantity Added</label>
                    <input value={form.pcrTreatmentQty} onChange={set('pcrTreatmentQty')} className={inputCls} placeholder="Litres / dose" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  {['Inhibitor Added', 'Biocide Added', 'Glycol Added'].map(item => (
                    <CheckRow key={item} label={item} stateSet={pcrTreatChecklist} setState={setPcrTreatChecklist} />
                  ))}
                </div>

                {/* S7 – Commissioning Checks */}
                {sHdr('Section 7 — Commissioning Checks')}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    'System Vented', 'System Balanced', 'Controls Operational',
                    'BMS Connected', 'Safety Devices Operational',
                    'Expansion Vessel Operational', 'Pressurisation Unit Operational',
                    'Heat Meters Operational', 'Documentation Complete',
                  ].map(item => (
                    <CheckRow key={item} label={item} stateSet={pcrCommChecklist} setState={setPcrCommChecklist} />
                  ))}
                </div>
                <div>
                  <label className={labelCls}>Commissioning Comments</label>
                  <textarea value={form.pcrCommComments} onChange={set('pcrCommComments')} rows={2}
                    className={`${inputCls} resize-none`} placeholder="Notes on commissioning..." />
                </div>

                {/* S8 – Defects */}
                {sHdr('Section 8 — Defects / Outstanding Works')}
                <PlantDefectRows rows={pcrDefects} onChange={setPcrDefects} />

                {/* S9 – Handover */}
                {sHdr('Section 9 — Handover')}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Witnessed By</label>
                    <input value={form.pcrHandoverWitness} onChange={set('pcrHandoverWitness')} className={inputCls} placeholder="Name" />
                  </div>
                  <div>
                    <label className={labelCls}>Company</label>
                    <input value={form.pcrHandoverCompany} onChange={set('pcrHandoverCompany')} className={inputCls} placeholder="Company name" />
                  </div>
                  <div>
                    <label className={labelCls}>Handover Date</label>
                    <input type="date" value={form.pcrHandoverDate} onChange={set('pcrHandoverDate')} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Handover Comments</label>
                  <textarea value={form.pcrHandoverComments} onChange={set('pcrHandoverComments')} rows={2}
                    className={`${inputCls} resize-none`} placeholder="Handover observations..." />
                </div>
                <div>
                  <label className={labelCls}>Handover Attachments</label>
                  <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles}
                    label="Upload O&M documents, test certificates, handover packs" />
                </div>

                {/* Status */}
                <div>
                  <label className={labelCls}>Status</label>
                  <div className="relative">
                    <select value={form.status} onChange={set('status')} className={selCls}>
                      {['Draft','Submitted','Approved','Closed'].map(v => <option key={v}>{v}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </>
            );
          })()}

          {/* ── HIU Commissioning Record ── */}
          {isHIU && (() => {
            const selCls = `${inputCls} appearance-none pr-8`;
            const sHdr = (label: string, sub?: string) => (
              <div className="pt-2 pb-1 border-b border-[#1e2d4a]">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
              </div>
            );
            const YNA = ({ field }: { field: string }) => (
              <div className="flex gap-2 mt-1.5">
                {['Yes', 'No', 'N/A'].map(v => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, [field]: v }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      form[field] === v
                        ? v === 'Yes' ? 'bg-emerald-700 border-emerald-600 text-white'
                          : v === 'No' ? 'bg-red-700 border-red-600 text-white'
                          : 'bg-slate-600 border-slate-500 text-white'
                        : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500'
                    }`}>{v}</button>
                ))}
              </div>
            );
            const CheckRow = ({ label, stateSet, setState }: { label: string; stateSet: Set<string>; setState: Dispatch<SetStateAction<Set<string>>> }) => (
              <label className="flex items-center gap-2.5 cursor-pointer group py-1">
                <div onClick={() => togglePcr(setState, label)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${stateSet.has(label) ? 'bg-teal-600 border-teal-600' : 'border-[#1e2d4a] group-hover:border-slate-500'}`}>
                  {stateSet.has(label) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 3.5L4 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span className="text-xs text-slate-300">{label}</span>
              </label>
            );
            return (
              <>
                <div className="bg-teal-900/20 border border-teal-700/40 rounded-xl px-4 py-3">
                  <p className="text-[11px] font-semibold text-teal-300 mb-0.5 uppercase tracking-wider">Mechanical — HIU Commissioning Record</p>
                  <p className="text-xs text-teal-300/70 leading-relaxed">Complete all sections accurately. This record forms part of the project commissioning documentation and must be retained on site and in the O&M pack.</p>
                </div>

                {/* S1 – Project / Plot Information */}
                {sHdr('Section 1 — Project / Plot Information')}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Project *</label>
                    <div className="relative">
                      <select value={form.project} onChange={set('project')} className={selCls}>
                        <option value="">Select project...</option>
                        {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Plot / Apartment Number *</label>
                    <input value={form.hiuPlot} onChange={set('hiuPlot')} className={inputCls} placeholder="e.g. Apt 14B, Plot 42" />
                  </div>
                  <div>
                    <label className={labelCls}>Block</label>
                    <input value={form.hiuBlock} onChange={set('hiuBlock')} className={inputCls} placeholder="e.g. Block A" />
                  </div>
                  <div>
                    <label className={labelCls}>Level / Floor</label>
                    <input value={form.hiuLevel} onChange={set('hiuLevel')} className={inputCls} placeholder="e.g. Level 3" />
                  </div>
                  <div>
                    <label className={labelCls}>Date *</label>
                    <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Commissioning Engineer</label>
                    <input value={form.hiuCommissioningEngineer} onChange={set('hiuCommissioningEngineer')} className={inputCls} placeholder="Full name" />
                  </div>
                  <div>
                    <label className={labelCls}>Company</label>
                    <input value={form.hiuCompany} onChange={set('hiuCompany')} className={inputCls} placeholder="Company name" />
                  </div>
                  <div>
                    <label className={labelCls}>Witness / Client Representative</label>
                    <input value={form.hiuWitness} onChange={set('hiuWitness')} className={inputCls} placeholder="Name and organisation" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Comments</label>
                  <textarea value={form.comments} onChange={set('comments')} rows={2}
                    className={`${inputCls} resize-none`} placeholder="General notes for this plot..." />
                </div>

                {/* S2 – HIU Asset Details */}
                {sHdr('Section 2 — HIU Asset Details')}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>HIU Reference</label>
                    <input value={form.hiuRef} onChange={set('hiuRef')} className={inputCls} placeholder="e.g. HIU-042" />
                  </div>
                  <div>
                    <label className={labelCls}>Manufacturer</label>
                    <input value={form.hiuManufacturer} onChange={set('hiuManufacturer')} className={inputCls} placeholder="e.g. Danfoss, Sharpe & Associates" />
                  </div>
                  <div>
                    <label className={labelCls}>Model</label>
                    <input value={form.hiuModel} onChange={set('hiuModel')} className={inputCls} placeholder="Model number" />
                  </div>
                  <div>
                    <label className={labelCls}>Serial Number</label>
                    <input value={form.hiuSerialNumber} onChange={set('hiuSerialNumber')} className={inputCls} placeholder="Serial number" />
                  </div>
                  <div>
                    <label className={labelCls}>Location</label>
                    <input value={form.hiuLocation} onChange={set('hiuLocation')} className={inputCls} placeholder="Cupboard / riser / room" />
                  </div>
                  <div>
                    <label className={labelCls}>Asset Tag</label>
                    <input value={form.hiuAssetTag} onChange={set('hiuAssetTag')} className={inputCls} placeholder="Asset tag number" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>HIU Photo</label>
                  <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} label="Upload HIU photo" />
                </div>

                {/* S3 – Heat Meter Details */}
                {sHdr('Section 3 — Heat Meter Details')}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Heat Meter Reference</label>
                    <input value={form.heatMeterRef} onChange={set('heatMeterRef')} className={inputCls} placeholder="e.g. HM-042" />
                  </div>
                  <div>
                    <label className={labelCls}>Manufacturer</label>
                    <input value={form.heatMeterManufacturer} onChange={set('heatMeterManufacturer')} className={inputCls} placeholder="e.g. Kamstrup, Sontex" />
                  </div>
                  <div>
                    <label className={labelCls}>Model</label>
                    <input value={form.heatMeterModel} onChange={set('heatMeterModel')} className={inputCls} placeholder="Model number" />
                  </div>
                  <div>
                    <label className={labelCls}>Serial Number</label>
                    <input value={form.heatMeterSerialNumber} onChange={set('heatMeterSerialNumber')} className={inputCls} placeholder="Serial number" />
                  </div>
                  <div>
                    <label className={labelCls}>Meter Reading at Commissioning</label>
                    <input value={form.heatMeterReading} onChange={set('heatMeterReading')} className={inputCls} placeholder="kWh / MWh" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Pulse Output Checked</label>
                    <YNA field="heatMeterPulseChecked" />
                  </div>
                  <div>
                    <label className={labelCls}>M-Bus / BMS Connected</label>
                    <YNA field="heatMeterMBusConnected" />
                  </div>
                </div>

                {/* S4 – Valve / Strainer Checks */}
                {sHdr('Section 4 — Valve / Strainer Checks')}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Primary Flow Isolation Valve No.</label>
                    <input value={form.valvePrimaryFlow} onChange={set('valvePrimaryFlow')} className={inputCls} placeholder="Valve number" />
                  </div>
                  <div>
                    <label className={labelCls}>Primary Return Isolation Valve No.</label>
                    <input value={form.valvePrimaryReturn} onChange={set('valvePrimaryReturn')} className={inputCls} placeholder="Valve number" />
                  </div>
                  <div>
                    <label className={labelCls}>Secondary Flow Valve No.</label>
                    <input value={form.valveSecondaryFlow} onChange={set('valveSecondaryFlow')} className={inputCls} placeholder="Valve number" />
                  </div>
                  <div>
                    <label className={labelCls}>Secondary Return Valve No.</label>
                    <input value={form.valveSecondaryReturn} onChange={set('valveSecondaryReturn')} className={inputCls} placeholder="Valve number" />
                  </div>
                  <div>
                    <label className={labelCls}>Cold Water Isolation Valve No.</label>
                    <input value={form.valveColdWater} onChange={set('valveColdWater')} className={inputCls} placeholder="Valve number" />
                  </div>
                  <div>
                    <label className={labelCls}>DHW Outlet Valve No.</label>
                    <input value={form.valveDHWOutlet} onChange={set('valveDHWOutlet')} className={inputCls} placeholder="Valve number" />
                  </div>
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Valve / Strainer Checklist</p>
                <div className="grid grid-cols-2 gap-1">
                  {['Isolation Valves Open and Accessible', 'Strainer Installed', 'Strainer Cleaned / Checked', 'Drain Point Accessible', 'Test Points Accessible'].map(item => (
                    <CheckRow key={item} label={item} stateSet={hiuValveChecklist} setState={setHiuValveChecklist} />
                  ))}
                </div>

                {/* S5 – Primary Heating Readings */}
                {sHdr('Section 5 — Primary Heating Readings')}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Primary Flow Temp (°C)</label>
                    <input value={form.primaryFlowTemp} onChange={set('primaryFlowTemp')} className={inputCls} placeholder="°C" />
                  </div>
                  <div>
                    <label className={labelCls}>Primary Return Temp (°C)</label>
                    <input value={form.primaryReturnTemp} onChange={set('primaryReturnTemp')} className={inputCls} placeholder="°C" />
                  </div>
                  <div>
                    <label className={labelCls}>Primary Diff. Pressure (kPa)</label>
                    <input value={form.primaryDiffPressure} onChange={set('primaryDiffPressure')} className={inputCls} placeholder="kPa" />
                  </div>
                  <div>
                    <label className={labelCls}>Primary Flow Rate (l/min)</label>
                    <input value={form.primaryFlowRate} onChange={set('primaryFlowRate')} className={inputCls} placeholder="l/min" />
                  </div>
                  <div>
                    <label className={labelCls}>System Pressure (bar)</label>
                    <input value={form.systemPressure} onChange={set('systemPressure')} className={inputCls} placeholder="bar" />
                  </div>
                </div>

                {/* S6 – Secondary Heating Readings */}
                {sHdr('Section 6 — Secondary Heating Readings')}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Secondary Flow Temp (°C)</label>
                    <input value={form.secondaryFlowTemp} onChange={set('secondaryFlowTemp')} className={inputCls} placeholder="°C" />
                  </div>
                  <div>
                    <label className={labelCls}>Secondary Return Temp (°C)</label>
                    <input value={form.secondaryReturnTemp} onChange={set('secondaryReturnTemp')} className={inputCls} placeholder="°C" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Heating Flow Confirmed</label>
                    <YNA field="heatingFlowConfirmed" />
                  </div>
                  <div>
                    <label className={labelCls}>Heating Return Confirmed</label>
                    <YNA field="heatingReturnConfirmed" />
                  </div>
                  <div>
                    <label className={labelCls}>Radiators / UFH Circuit Warmed Through</label>
                    <YNA field="radUFHWarmed" />
                  </div>
                </div>

                {/* S7 – DHW Performance */}
                {sHdr('Section 7 — DHW Performance')}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Cold Water Inlet Temp (°C)</label>
                    <input value={form.cwInletTemp} onChange={set('cwInletTemp')} className={inputCls} placeholder="°C" />
                  </div>
                  <div>
                    <label className={labelCls}>DHW Outlet Temp (°C)</label>
                    <input value={form.dhwOutletTemp} onChange={set('dhwOutletTemp')} className={inputCls} placeholder="°C" />
                  </div>
                  <div>
                    <label className={labelCls}>DHW Flow Rate (l/min)</label>
                    <input value={form.dhwFlowRate} onChange={set('dhwFlowRate')} className={inputCls} placeholder="l/min" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Temperature Stabilised</label>
                    <YNA field="dhwTempStabilised" />
                  </div>
                  <div>
                    <label className={labelCls}>Outlet Temperature Acceptable (&gt;55°C)</label>
                    <YNA field="dhwOutletAcceptable" />
                  </div>
                </div>

                {/* S8 – Controls / Electrical Interface */}
                {sHdr('Section 8 — Controls / Electrical Interface')}
                <div className="grid grid-cols-2 gap-1">
                  {[
                    'Room Thermostat Operational', 'Programmer / Controller Operational',
                    'Actuator Operating', 'HIU Responds to Heat Demand',
                    'HIU Responds to DHW Demand', 'BMS / Metering Interface Connected',
                    'No Fault Codes Displayed',
                  ].map(item => (
                    <CheckRow key={item} label={item} stateSet={hiuControlsChecklist} setState={setHiuControlsChecklist} />
                  ))}
                </div>

                {/* S9 – Defects / Outstanding Works */}
                {sHdr('Section 9 — Defects / Outstanding Works')}
                <div className="space-y-3">
                  {hiuDefects.map((d, i) => (
                    <div key={i} className="p-3 bg-[#0d1628] border border-[#1e2d4a] rounded-xl space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-400">Defect #{i + 1}</span>
                        <button type="button" onClick={() => setHiuDefects(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
                      </div>
                      <div>
                        <label className={labelCls}>Description</label>
                        <input value={d.description} onChange={e => setHiuDefects(prev => prev.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                          className={inputCls} placeholder="Describe the defect or outstanding item" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Responsible Person / Company</label>
                          <input value={d.responsiblePerson} onChange={e => setHiuDefects(prev => prev.map((x, idx) => idx === i ? { ...x, responsiblePerson: e.target.value } : x))}
                            className={inputCls} placeholder="Name / company" />
                        </div>
                        <div>
                          <label className={labelCls}>Due Date</label>
                          <input type="date" value={d.dueDate} onChange={e => setHiuDefects(prev => prev.map((x, idx) => idx === i ? { ...x, dueDate: e.target.value } : x))}
                            className={inputCls} />
                        </div>
                      </div>
                      <div className="relative">
                        <label className={labelCls}>Status</label>
                        <select value={d.status} onChange={e => setHiuDefects(prev => prev.map((x, idx) => idx === i ? { ...x, status: e.target.value } : x))}
                          className={`${inputCls} appearance-none pr-8`}>
                          {['Open', 'In Progress', 'Complete', 'Closed'].map(v => <option key={v}>{v}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 bottom-2.5 text-slate-500 pointer-events-none" />
                      </div>
                      <div>
                        <label className={labelCls}>Comments</label>
                        <textarea value={d.comments} onChange={e => setHiuDefects(prev => prev.map((x, idx) => idx === i ? { ...x, comments: e.target.value } : x))}
                          rows={2} className={`${inputCls} resize-none`} placeholder="Additional notes..." />
                      </div>
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => setHiuDefects(prev => [...prev, { description: '', responsiblePerson: '', dueDate: '', status: 'Open', comments: '' }])}
                    className="w-full py-2.5 rounded-xl border border-dashed border-[#1e2d4a] text-xs text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors">
                    + Add Defect / Outstanding Item
                  </button>
                </div>

                {/* S10 – Commissioning Result / Sign-off */}
                {sHdr('Section 10 — Commissioning Result / Sign-off')}
                <div>
                  <label className={labelCls}>Commissioning Status</label>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {['Passed', 'Passed with Comments', 'Failed', 'Not Complete'].map(v => (
                      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, hiuCommissioningStatus: v }))}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                          form.hiuCommissioningStatus === v
                            ? v === 'Passed' ? 'bg-emerald-700 border-emerald-600 text-white'
                              : v === 'Passed with Comments' ? 'bg-amber-600 border-amber-500 text-white'
                              : v === 'Failed' ? 'bg-red-700 border-red-600 text-white'
                              : 'bg-slate-600 border-slate-500 text-white'
                            : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500'
                        }`}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Engineer Name</label>
                    <input value={form.hiuEngineerName} onChange={set('hiuEngineerName')} className={inputCls} placeholder="Full name" />
                  </div>
                  <div>
                    <label className={labelCls}>Witness Name</label>
                    <input value={form.hiuWitnessName} onChange={set('hiuWitnessName')} className={inputCls} placeholder="Full name" />
                  </div>
                  <div>
                    <label className={labelCls}>Sign-off Date</label>
                    <input type="date" value={form.hiuSignOffDate} onChange={set('hiuSignOffDate')} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Final Comments</label>
                  <textarea value={form.hiuFinalComments} onChange={set('hiuFinalComments')} rows={3}
                    className={`${inputCls} resize-none`} placeholder="Overall commissioning notes..." />
                </div>
                <div>
                  <label className={labelCls}>Final Attachments / Photos</label>
                  <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles}
                    label="Upload commissioning photos, test records, meter reading photos" />
                </div>

                {/* Status */}
                <div>
                  <label className={labelCls}>Status</label>
                  <div className="relative">
                    <select value={form.status} onChange={set('status')} className={selCls}>
                      {['Draft', 'Submitted', 'Approved', 'Closed'].map(v => <option key={v}>{v}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </>
            );
          })()}

          {/* ── MVHR Commissioning Record ── */}
          {isMVHR && (() => {
            const selCls = `${inputCls} appearance-none pr-8`;
            const sHdr = (label: string, sub?: string) => (
              <div className="pt-2 pb-1 border-b border-[#1e2d4a]">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
              </div>
            );
            const INSTALL_ITEMS = [
              'Unit Installed Securely', 'Intake Duct Connected', 'Exhaust Duct Connected',
              'Supply Duct Connected', 'Extract Duct Connected', 'Condensate Drain Connected',
              'Filters Installed', 'Access for Maintenance Available',
              'Ductwork Insulated Where Required', 'Fire Stopping Complete',
              'Identification Labels Installed',
            ] as const;
            const FUNCTIONAL_ITEMS = [
              'Unit Powered', 'Controller Operational', 'Boost Function Operational',
              'Summer Bypass Operational', 'Frost Protection Operational',
              'Supply Fan Operational', 'Extract Fan Operational',
              'Unit Responds to Controls', 'No Fault Codes Displayed',
            ] as const;
            const NOISE_ITEMS = [
              'Unit Running Quietly', 'Excessive Vibration Observed',
              'Airflow Balanced', 'Occupant Controls Demonstrated',
            ] as const;
            const YNA3 = ({ items, state, setState }: { items: readonly string[]; state: Record<string, string>; setState: Dispatch<SetStateAction<Record<string, string>>> }) => (
              <div className="space-y-2 mt-2">
                {items.map(item => (
                  <div key={item} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-300 flex-1">{item}</span>
                    <div className="flex gap-1.5 shrink-0">
                      {(['Yes', 'No', 'N/A'] as const).map(v => (
                        <button key={v} type="button"
                          onClick={() => setState(prev => ({ ...prev, [item]: v }))}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold border transition-all ${
                            state[item] === v
                              ? v === 'Yes' ? 'bg-emerald-700 border-emerald-600 text-white'
                                : v === 'No' ? 'bg-red-700 border-red-600 text-white'
                                : 'bg-slate-600 border-slate-500 text-white'
                              : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500'
                          }`}>{v}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
            const emptyRoom = (): MVHRRoom => ({ roomName: '', roomType: '', designSupply: '', actualSupply: '', designExtract: '', actualExtract: '', passOrFail: 'Pass', comments: '' });
            const emptyDefect = (): MVHRDefect => ({ description: '', responsiblePerson: '', dueDate: '', status: 'Open', comments: '' });
            return (
              <>
                <div className="bg-sky-900/20 border border-sky-700/40 rounded-xl px-4 py-3">
                  <p className="text-[11px] font-semibold text-sky-300 mb-0.5 uppercase tracking-wider">Mechanical — MVHR Commissioning Record</p>
                  <p className="text-xs text-sky-300/70 leading-relaxed">Complete all sections accurately. This record forms part of the project commissioning documentation and must be retained on site and in the O&M pack.</p>
                </div>

                {/* S1 – Project / Plot */}
                {sHdr('Section 1 — Project / Plot Information')}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Project *</label>
                    <div className="relative">
                      <select value={form.project} onChange={set('project')} className={selCls}>
                        <option value="">Select project...</option>
                        {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Plot / Apartment Number</label>
                    <input value={form.mvhrPlot} onChange={set('mvhrPlot')} className={inputCls} placeholder="e.g. Apt 14B, Plot 42" />
                  </div>
                  <div>
                    <label className={labelCls}>Block</label>
                    <input value={form.mvhrBlock} onChange={set('mvhrBlock')} className={inputCls} placeholder="e.g. Block A" />
                  </div>
                  <div>
                    <label className={labelCls}>Level / Floor</label>
                    <input value={form.mvhrLevel} onChange={set('mvhrLevel')} className={inputCls} placeholder="e.g. Level 3" />
                  </div>
                  <div>
                    <label className={labelCls}>Date *</label>
                    <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Commissioning Engineer</label>
                    <input value={form.mvhrCommissioningEngineer} onChange={set('mvhrCommissioningEngineer')} className={inputCls} placeholder="Full name" />
                  </div>
                  <div>
                    <label className={labelCls}>Company</label>
                    <input value={form.mvhrCompany} onChange={set('mvhrCompany')} className={inputCls} placeholder="Company name" />
                  </div>
                  <div>
                    <label className={labelCls}>Witness / Client Representative</label>
                    <input value={form.mvhrWitness} onChange={set('mvhrWitness')} className={inputCls} placeholder="Name" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Comments</label>
                  <textarea value={form.comments} onChange={set('comments')} rows={2} className={`${inputCls} resize-none`} placeholder="General comments..." />
                </div>

                {/* S2 – MVHR Unit Details */}
                {sHdr('Section 2 — MVHR Unit Details')}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>MVHR Unit Reference</label>
                    <input value={form.mvhrUnitRef} onChange={set('mvhrUnitRef')} className={inputCls} placeholder="e.g. MVHR-01" />
                  </div>
                  <div>
                    <label className={labelCls}>Manufacturer</label>
                    <input value={form.mvhrManufacturer} onChange={set('mvhrManufacturer')} className={inputCls} placeholder="e.g. Zehnder" />
                  </div>
                  <div>
                    <label className={labelCls}>Model</label>
                    <input value={form.mvhrModel} onChange={set('mvhrModel')} className={inputCls} placeholder="Model number" />
                  </div>
                  <div>
                    <label className={labelCls}>Serial Number</label>
                    <input value={form.mvhrSerialNumber} onChange={set('mvhrSerialNumber')} className={inputCls} placeholder="Serial number" />
                  </div>
                  <div>
                    <label className={labelCls}>Location</label>
                    <input value={form.mvhrLocation} onChange={set('mvhrLocation')} className={inputCls} placeholder="e.g. Utility cupboard" />
                  </div>
                  <div>
                    <label className={labelCls}>Asset Tag</label>
                    <input value={form.mvhrAssetTag} onChange={set('mvhrAssetTag')} className={inputCls} placeholder="Asset tag / barcode" />
                  </div>
                  <div>
                    <label className={labelCls}>Unit Capacity (l/s or m³/h)</label>
                    <input value={form.mvhrUnitCapacity} onChange={set('mvhrUnitCapacity')} className={inputCls} placeholder="e.g. 150 m³/h" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Unit Photos</label>
                  <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} label="Upload MVHR unit photos" />
                </div>

                {/* S3 – Installation Checks */}
                {sHdr('Section 3 — Installation Checks', 'Confirm each item before airflow commissioning')}
                <YNA3 items={INSTALL_ITEMS} state={mvhrInstallChecklist} setState={setMvhrInstallChecklist} />
                <div>
                  <label className={labelCls}>Installation Comments</label>
                  <textarea value={form.mvhrInstallComments} onChange={set('mvhrInstallComments')} rows={2} className={`${inputCls} resize-none`} placeholder="Any installation observations..." />
                </div>

                {/* S4 – Airflow Commissioning */}
                {sHdr('Section 4 — Airflow Commissioning', 'Record design and actual airflows for each room')}
                <div className="space-y-3">
                  {mvhrRooms.map((room, i) => (
                    <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Room {i + 1}</span>
                        <button type="button" onClick={() => setMvhrRooms(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-[10px] text-red-500 hover:text-red-400 transition-colors">Remove</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Room Name</label>
                          <input value={room.roomName} onChange={e => setMvhrRooms(prev => prev.map((r, idx) => idx === i ? { ...r, roomName: e.target.value } : r))} className={inputCls} placeholder="e.g. Kitchen" />
                        </div>
                        <div>
                          <label className={labelCls}>Room Type</label>
                          <div className="relative">
                            <select value={room.roomType} onChange={e => setMvhrRooms(prev => prev.map((r, idx) => idx === i ? { ...r, roomType: e.target.value } : r))} className={`${selCls}`}>
                              <option value="">Select...</option>
                              {['Kitchen', 'Living Room', 'Bedroom', 'Bathroom', 'En Suite', 'WC', 'Utility', 'Hallway', 'Other'].map(t => <option key={t}>{t}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Design Supply Airflow (l/s)</label>
                          <input value={room.designSupply} onChange={e => setMvhrRooms(prev => prev.map((r, idx) => idx === i ? { ...r, designSupply: e.target.value } : r))} className={inputCls} placeholder="0" />
                        </div>
                        <div>
                          <label className={labelCls}>Actual Supply Airflow (l/s)</label>
                          <input value={room.actualSupply} onChange={e => setMvhrRooms(prev => prev.map((r, idx) => idx === i ? { ...r, actualSupply: e.target.value } : r))} className={inputCls} placeholder="0" />
                        </div>
                        <div>
                          <label className={labelCls}>Design Extract Airflow (l/s)</label>
                          <input value={room.designExtract} onChange={e => setMvhrRooms(prev => prev.map((r, idx) => idx === i ? { ...r, designExtract: e.target.value } : r))} className={inputCls} placeholder="0" />
                        </div>
                        <div>
                          <label className={labelCls}>Actual Extract Airflow (l/s)</label>
                          <input value={room.actualExtract} onChange={e => setMvhrRooms(prev => prev.map((r, idx) => idx === i ? { ...r, actualExtract: e.target.value } : r))} className={inputCls} placeholder="0" />
                        </div>
                        <div>
                          <label className={labelCls}>Pass / Fail</label>
                          <div className="flex gap-2 mt-1.5">
                            {(['Pass', 'Fail'] as const).map(v => (
                              <button key={v} type="button"
                                onClick={() => setMvhrRooms(prev => prev.map((r, idx) => idx === i ? { ...r, passOrFail: v } : r))}
                                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                  room.passOrFail === v
                                    ? v === 'Pass' ? 'bg-emerald-700 border-emerald-600 text-white' : 'bg-red-700 border-red-600 text-white'
                                    : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500'
                                }`}>{v}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Comments</label>
                          <input value={room.comments} onChange={e => setMvhrRooms(prev => prev.map((r, idx) => idx === i ? { ...r, comments: e.target.value } : r))} className={inputCls} placeholder="Optional" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setMvhrRooms(prev => [...prev, emptyRoom()])}
                    className="w-full py-2.5 rounded-xl border border-dashed border-sky-700/60 text-xs font-semibold text-sky-400 hover:bg-sky-900/20 hover:border-sky-600 transition-all">
                    + Add Room
                  </button>
                </div>

                {/* S5 – Functional Testing */}
                {sHdr('Section 5 — Functional Testing')}
                <YNA3 items={FUNCTIONAL_ITEMS} state={mvhrFunctionalChecklist} setState={setMvhrFunctionalChecklist} />
                <div>
                  <label className={labelCls}>Functional Testing Comments</label>
                  <textarea value={form.mvhrFunctionalComments} onChange={set('mvhrFunctionalComments')} rows={2} className={`${inputCls} resize-none`} placeholder="Any functional test observations..." />
                </div>
                <div>
                  <label className={labelCls}>Functional Test Photos</label>
                  <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} label="Upload functional test photos" />
                </div>

                {/* S6 – Noise / Performance */}
                {sHdr('Section 6 — Noise / Performance Checks')}
                <YNA3 items={NOISE_ITEMS} state={mvhrNoiseChecklist} setState={setMvhrNoiseChecklist} />
                <div>
                  <label className={labelCls}>Performance Comments</label>
                  <textarea value={form.mvhrNoiseComments} onChange={set('mvhrNoiseComments')} rows={2} className={`${inputCls} resize-none`} placeholder="Noise and performance observations..." />
                </div>

                {/* S7 – Defects */}
                {sHdr('Section 7 — Defects / Outstanding Works')}
                <div className="space-y-3">
                  {mvhrDefects.map((defect, i) => (
                    <div key={i} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Defect {i + 1}</span>
                        <button type="button" onClick={() => setMvhrDefects(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-[10px] text-red-500 hover:text-red-400 transition-colors">Remove</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className={labelCls}>Description</label>
                          <textarea value={defect.description} onChange={e => setMvhrDefects(prev => prev.map((d, idx) => idx === i ? { ...d, description: e.target.value } : d))} rows={2} className={`${inputCls} resize-none`} placeholder="Describe the defect..." />
                        </div>
                        <div>
                          <label className={labelCls}>Responsible Person / Company</label>
                          <input value={defect.responsiblePerson} onChange={e => setMvhrDefects(prev => prev.map((d, idx) => idx === i ? { ...d, responsiblePerson: e.target.value } : d))} className={inputCls} placeholder="Name / company" />
                        </div>
                        <div>
                          <label className={labelCls}>Due Date</label>
                          <input type="date" value={defect.dueDate} onChange={e => setMvhrDefects(prev => prev.map((d, idx) => idx === i ? { ...d, dueDate: e.target.value } : d))} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Status</label>
                          <div className="relative">
                            <select value={defect.status} onChange={e => setMvhrDefects(prev => prev.map((d, idx) => idx === i ? { ...d, status: e.target.value } : d))} className={`${selCls}`}>
                              {['Open', 'In Progress', 'Closed', 'Complete'].map(s => <option key={s}>{s}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Comments</label>
                          <input value={defect.comments} onChange={e => setMvhrDefects(prev => prev.map((d, idx) => idx === i ? { ...d, comments: e.target.value } : d))} className={inputCls} placeholder="Optional" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setMvhrDefects(prev => [...prev, emptyDefect()])}
                    className="w-full py-2.5 rounded-xl border border-dashed border-red-700/60 text-xs font-semibold text-red-400 hover:bg-red-900/20 hover:border-red-600 transition-all">
                    + Add Defect / Outstanding Item
                  </button>
                </div>

                {/* S8 – Sign-off */}
                {sHdr('Section 8 — Commissioning Result / Sign-Off')}
                <div>
                  <label className={labelCls}>Commissioning Status</label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {(['Passed', 'Passed with Comments', 'Failed', 'Not Complete'] as const).map(v => (
                      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, mvhrCommissioningStatus: v }))}
                        className={`py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                          form.mvhrCommissioningStatus === v
                            ? v === 'Passed' ? 'bg-emerald-700 border-emerald-600 text-white'
                              : v === 'Failed' ? 'bg-red-700 border-red-600 text-white'
                              : v === 'Passed with Comments' ? 'bg-amber-600 border-amber-500 text-white'
                              : 'bg-slate-600 border-slate-500 text-white'
                            : 'bg-[#0d1628] border-[#1e2d4a] text-slate-500 hover:border-slate-500'
                        }`}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Engineer Name</label>
                    <input value={form.mvhrEngineerName} onChange={set('mvhrEngineerName')} className={inputCls} placeholder="Full name" />
                  </div>
                  <div>
                    <label className={labelCls}>Witness Name</label>
                    <input value={form.mvhrWitnessName} onChange={set('mvhrWitnessName')} className={inputCls} placeholder="Full name" />
                  </div>
                  <div>
                    <label className={labelCls}>Date</label>
                    <input type="date" value={form.mvhrSignOffDate} onChange={set('mvhrSignOffDate')} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Final Comments</label>
                  <textarea value={form.mvhrFinalComments} onChange={set('mvhrFinalComments')} rows={3} className={`${inputCls} resize-none`} placeholder="Final commissioning comments, outstanding actions..." />
                </div>
                <div>
                  <label className={labelCls}>Final Attachments / Photos</label>
                  <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} label="Upload commissioning photos and test records" />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <div className="relative">
                    <select value={form.status} onChange={set('status')} className={selCls}>
                      {['Draft', 'Submitted', 'Approved', 'Closed'].map(v => <option key={v}>{v}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </>
            );
          })()}

          {/* ── Temperature Water Readings ── */}
          {isTWR && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Project</label>
                  <div className="relative">
                    <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                      <option value="">Select project...</option>
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                  <label className={labelCls}>Completed By *</label>
                  <input value={form.completedBy} onChange={set('completedBy')} className={inputCls} placeholder="Engineer name" />
                </div>
                <div>
                  <label className={labelCls}>Witnessed By</label>
                  <input value={form.twrWitnessedBy} onChange={set('twrWitnessedBy')} className={inputCls} placeholder="Witness / client rep" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>System / Service</label>
                  <input value={form.twrSystem} onChange={set('twrSystem')} className={inputCls} placeholder="e.g. DHWS, CWS" />
                </div>
                <div>
                  <label className={labelCls}>Location / Building</label>
                  <input value={form.twrLocation} onChange={set('twrLocation')} className={inputCls} placeholder="e.g. Block A, Level 2" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Area / Zone</label>
                <input value={form.twrArea} onChange={set('twrArea')} className={inputCls} placeholder="e.g. North wing, riser 1" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Temperature Readings</label>
                  <span className="text-[10px] text-slate-600">{twrReadings.length} outlet{twrReadings.length !== 1 ? 's' : ''} recorded</span>
                </div>
                <TWRReadingRows rows={twrReadings} onChange={setTwrReadings} />
              </div>

              <div>
                <label className={labelCls}>Attachments / Photos</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} label="Upload temperature data sheets or photos" />
              </div>
            </>
          )}

          {/* ── Practical Completion Certificate ── */}
          {isPCC && (
            <>
              {/* Project information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Project *</label>
                  <div className="relative">
                    <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                      <option value="">Select project...</option>
                      {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Certificate Reference</label>
                  <input value={form.pccRef} onChange={set('pccRef')} className={inputCls} placeholder="PC-0001" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Contract</label>
                  <input value={form.pccContract} onChange={set('pccContract')} className={inputCls} placeholder="Contract name / reference" />
                </div>
                <div>
                  <label className={labelCls}>Client</label>
                  <input value={form.pccClient} onChange={set('pccClient')} className={inputCls} placeholder="Client name" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Title *</label>
                  <input value={form.title} onChange={set('title')} className={inputCls} placeholder="e.g. Theatre 1 Operating Light Replacement" />
                </div>
                <div>
                  <label className={labelCls}>Location / Area</label>
                  <input value={form.pccLocationArea} onChange={set('pccLocationArea')} className={inputCls} placeholder="e.g. Theatre 1, Level 2" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Date *</label>
                <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
              </div>

              {/* Description of Works */}
              <div>
                <label className={labelCls}>Description of Works *</label>
                <p className="text-[10px] text-slate-600 mb-1.5">Fully describe what has been completed and handed over. Be specific — include scope, systems, and any key activities such as commissioning, testing, and demonstration.</p>
                <textarea value={form.pccDescriptionOfWorks} onChange={set('pccDescriptionOfWorks')} rows={9}
                  className={`${inputCls} resize-none`}
                  placeholder="e.g. Theatre 1 operating light replacement complete including removal of the existing operating light, installation of the new operating light, commissioning, testing and demonstration to the Client." />
              </div>

              {/* Assets / Equipment */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls}>Assets / Equipment (Optional)</label>
                  <span className="text-[10px] text-slate-600">{pccAssets.length} item{pccAssets.length !== 1 ? 's' : ''}</span>
                </div>
                <p className="text-[10px] text-slate-600 mb-2">Record individual assets or equipment included in this handover. Leave empty if not applicable.</p>
                <PCCAssetRows rows={pccAssets} onChange={setPccAssets} />
              </div>

              {/* Completion Checklist */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls}>Completion Checklist</label>
                  <span className="text-[10px] text-slate-600">{pccChecklist.length} item{pccChecklist.length !== 1 ? 's' : ''}</span>
                </div>
                <p className="text-[10px] text-slate-600 mb-2">Build your own completion checklist. Add as many items as required for this handover.</p>
                <PCCChecklistRows rows={pccChecklist} onChange={setPccChecklist} />
              </div>

              {/* Outstanding Items */}
              <div>
                <label className={labelCls}>Outstanding Items / Observations</label>
                <textarea value={form.pccOutstandingItems} onChange={set('pccOutstandingItems')} rows={6}
                  className={`${inputCls} resize-none`} placeholder="Record any items remaining before or after handover..." />
              </div>

              {/* Acceptance */}
              <div className="pt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#1e2d4a] pb-1.5 mb-3">Acceptance</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
                  {/* ── Handed Over By column ── */}
                  <div className="space-y-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Handed Over By</p>
                    <div>
                      <label className={labelCls}>Name</label>
                      <input value={form.pccHandedOverBy} onChange={set('pccHandedOverBy')} className={inputCls} placeholder="Full name" />
                    </div>
                    <div>
                      <label className={labelCls}>Position / Job Title</label>
                      <input value={form.pccHandedOverByTitle} onChange={set('pccHandedOverByTitle')} className={inputCls} placeholder="e.g. Contracts Manager" />
                    </div>
                    <div>
                      <label className={labelCls}>Company</label>
                      <input value={form.pccHandedOverByCompany} onChange={set('pccHandedOverByCompany')} className={inputCls} placeholder="Issuing company" />
                    </div>
                  </div>
                  {/* ── Accepted By column ── */}
                  <div className="space-y-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Accepted By</p>
                    <div>
                      <label className={labelCls}>Name</label>
                      <input value={form.pccAcceptedBy} onChange={set('pccAcceptedBy')} className={inputCls} placeholder="Client representative name" />
                    </div>
                    <div>
                      <label className={labelCls}>Position / Job Title</label>
                      <input value={form.pccAcceptedByTitle} onChange={set('pccAcceptedByTitle')} className={inputCls} placeholder="e.g. Project Manager" />
                    </div>
                    <div>
                      <label className={labelCls}>Company</label>
                      <input value={form.pccAcceptedByCompany} onChange={set('pccAcceptedByCompany')} className={inputCls} placeholder="Client company" />
                    </div>
                    <div>
                      <label className={labelCls}>Date of Acceptance</label>
                      <input type="date" value={form.pccAcceptanceDate} onChange={set('pccAcceptanceDate')} className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Attachments</label>
                <FileUploadComponent files={uploadedFiles} onChange={setUploadedFiles} label="Upload supporting documentation" />
              </div>
            </>
          )}

          {/* Common fields fallback */}
          {!isRFI && !isHoldUp && !isDelay && !isVariation && !isEWN && !isSI && !isTQ && !isHS
            && !isPressureTest && !isFlushingRecord && !isValveChecklist && !isAHUCommissioning
            && !isDeadTesting && !isContinuityTest && !isToolboxTalk && !isSiteWalkAudit
            && !isECR && !isDaily && !isRAMS && !isAIR && !isPCR && !isHIU && !isMVHR && !isTWR && !isPCC && (
            <>
              <div>
                <label className={labelCls}>Project</label>
                <div className="relative">
                  <select value={form.project} onChange={set('project')} className={`${inputCls} appearance-none pr-8`}>
                    <option value="">Select project...</option>
                    {visibleProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
          <button type="button" onClick={() => handleAction(isPCC ? 'Issued' : 'Submitted')}
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
              : isAIR ? 'Submit Incident Report'
              : isPCR ? 'Submit Commissioning Record'
              : isHIU ? 'Submit HIU Commissioning Record'
              : isMVHR ? 'Submit MVHR Commissioning Record'
              : isTWR ? 'Submit Temperature Water Readings'
              : isPCC ? 'Issue Certificate'
              : isSN ? 'Submit Site Note'
              : 'Submit Form'}
          </button>
        </div>

      </div>
    </div>
  );
}
