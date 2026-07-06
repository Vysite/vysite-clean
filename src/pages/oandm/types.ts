import type { DBOAndMManual, DBOAndMSection, DBOAndMItem, OAndMSourceModule } from '../../lib/store';

export type { DBOAndMManual, DBOAndMSection, DBOAndMItem, OAndMSourceModule };

export const STATUS_LABELS: Record<DBOAndMManual['status'], string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  finalised: 'Finalised',
};

export const STATUS_COLOURS: Record<DBOAndMManual['status'], string> = {
  draft: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  in_progress: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  finalised: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};

export const SOURCE_MODULE_LABELS: Record<OAndMSourceModule, string> = {
  tc_record: 'T&C Record',
  site_form: 'Site Form',
  project_document: 'Project Document',
};

export const SOURCE_MODULE_COLOURS: Record<OAndMSourceModule, string> = {
  tc_record: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  site_form: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  project_document: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};

export const DEFAULT_SECTION_TITLES = [
  'Project Information',
  'Technical Submittals',
  'Testing & Commissioning',
  'QA Records',
  'Asset Information',
  'Manufacturer Literature',
  'Warranties',
  'Certificates',
  'As-Built Drawings',
  'Appendices',
];

export function genId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
