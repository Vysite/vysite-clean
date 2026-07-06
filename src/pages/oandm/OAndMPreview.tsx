import { useRef } from 'react';
import { X, FileText, FlaskConical, FolderOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { DBOAndMManual, DBOAndMSection, DBOAndMItem, OAndMSourceModule } from './types';
import { SOURCE_MODULE_LABELS } from './types';
import type { Project } from '../../data/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgInfo {
  companyName: string;
  logoDataUrl?: string;
}

interface Props {
  manual: DBOAndMManual;
  sections: DBOAndMSection[];
  items: DBOAndMItem[];
  project: Project;
  orgInfo: OrgInfo;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SOURCE_ICON: Record<OAndMSourceModule, React.ComponentType<{ size?: number; className?: string }>> = {
  project_document: FolderOpen,
  tc_record: FlaskConical,
  site_form: FileText,
};

const SOURCE_BADGE: Record<OAndMSourceModule, string> = {
  project_document: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  tc_record: 'bg-sky-50 text-sky-700 border border-sky-200',
  site_form: 'bg-amber-50 text-amber-700 border border-amber-200',
};

const STATUS_LABEL: Record<DBOAndMManual['status'], string> = {
  draft: 'DRAFT',
  in_progress: 'IN PROGRESS',
  finalised: 'FINALISED',
};

const STATUS_STYLE: Record<DBOAndMManual['status'], string> = {
  draft: 'text-slate-500 border-slate-300 bg-slate-50',
  in_progress: 'text-amber-600 border-amber-300 bg-amber-50',
  finalised: 'text-emerald-700 border-emerald-300 bg-emerald-50',
};

function fmtDate(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageFooter({ manual, project }: { manual: DBOAndMManual; project: Project }) {
  return (
    <div className="flex items-center justify-between pt-4 mt-8 border-t border-slate-200">
      <p className="text-[9px] text-slate-400 font-medium tracking-wide">
        {project.name}{manual.version ? ` · ${manual.version}` : ''} · {manual.title}
      </p>
      <p className="text-[9px] text-slate-400 font-medium tracking-wide text-right">
        Powered by VYSITE® &nbsp;|&nbsp; © VYSITE Ltd. All Rights Reserved.
      </p>
    </div>
  );
}

function CoverPage({ manual, project, orgInfo }: { manual: DBOAndMManual; project: Project; orgInfo: OrgInfo }) {
  return (
    <div className="preview-page bg-white min-h-[297mm] flex flex-col">
      {/* Top accent bar */}
      <div className="h-2 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 w-full" />

      <div className="flex-1 flex flex-col px-16 py-14">
        {/* Org header */}
        <div className="flex items-start justify-between mb-16">
          <div>
            {orgInfo.logoDataUrl ? (
              <img src={orgInfo.logoDataUrl} alt={orgInfo.companyName} className="h-10 w-auto object-contain mb-2" />
            ) : (
              <p className="text-xl font-black text-slate-800 tracking-tight">{orgInfo.companyName || 'Organisation'}</p>
            )}
            {orgInfo.logoDataUrl && orgInfo.companyName && (
              <p className="text-xs text-slate-500 font-medium">{orgInfo.companyName}</p>
            )}
          </div>
          <span className={`text-[10px] font-black tracking-widest px-3 py-1.5 rounded border ${STATUS_STYLE[manual.status]}`}>
            {STATUS_LABEL[manual.status]}
          </span>
        </div>

        {/* Main cover content */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="border-l-4 border-slate-800 pl-8 mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 mb-3">
              Operation &amp; Maintenance Manual
            </p>
            <h1 className="text-4xl font-black text-slate-900 leading-tight mb-2">
              {manual.title}
            </h1>
            {manual.version && (
              <p className="text-sm font-semibold text-slate-500 mt-1">{manual.version}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <CoverField label="Project" value={project.name} />
              <CoverField label="Client" value={project.client || '—'} />
              <CoverField label="Location" value={project.location || '—'} />
            </div>
            <div>
              <CoverField label="Project Manager" value={project.projectManager || '—'} />
              <CoverField label="Contractor" value={orgInfo.companyName || '—'} />
              <CoverField label="Date" value={fmtDate(manual.updated_at || manual.created_at)} />
            </div>
          </div>
        </div>

        {/* Cover footer */}
        <div className="mt-auto pt-8 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400 tracking-wide">
              Prepared by {manual.created_by || orgInfo.companyName || 'Unknown'}
            </p>
            <p className="text-[9px] text-slate-300 font-medium tracking-wider">
              Powered by VYSITE® &nbsp;|&nbsp; © VYSITE Ltd. All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CoverField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4">
      <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-0.5">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function ContentsPage({
  manual, sections, items, project, sectionRefs,
}: {
  manual: DBOAndMManual;
  sections: DBOAndMSection[];
  items: DBOAndMItem[];
  project: Project;
  sectionRefs: React.RefObject<HTMLDivElement[]>;
}) {
  const scrollToSection = (idx: number) => {
    const el = sectionRefs.current?.[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="preview-page bg-white min-h-[297mm] flex flex-col px-16 py-14">
      <div className="mb-8">
        <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400 font-semibold mb-1">Table of</p>
        <h2 className="text-2xl font-black text-slate-900">Contents</h2>
        <div className="h-0.5 w-12 bg-slate-800 mt-2" />
      </div>

      <div className="flex-1">
        {sections.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No sections added yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {sections.map((section, idx) => {
              const count = items.filter(i => i.section_id === section.id).length;
              const populated = count > 0;
              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(idx)}
                  className="w-full flex items-center gap-4 py-3 text-left group hover:bg-slate-50 transition-colors rounded px-2 -mx-2"
                >
                  <span className="text-[10px] font-mono font-bold text-slate-400 w-6 shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                    {section.title}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {populated ? (
                      <CheckCircle2 size={12} className="text-emerald-500" />
                    ) : (
                      <AlertTriangle size={12} className="text-amber-400" />
                    )}
                    <span className={`text-[10px] font-semibold ${populated ? 'text-slate-500' : 'text-amber-500'}`}>
                      {count} {count === 1 ? 'record' : 'records'}
                    </span>
                  </span>
                  <span className="w-6 shrink-0 text-right">
                    <span className="text-[10px] text-slate-300 group-hover:text-slate-500 transition-colors">→</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <PageFooter manual={manual} project={project} />
    </div>
  );
}

function SectionPage({
  section, items, index, manual, project, refCallback,
}: {
  section: DBOAndMSection;
  items: DBOAndMItem[];
  index: number;
  manual: DBOAndMManual;
  project: Project;
  refCallback: (el: HTMLDivElement | null) => void;
}) {
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div ref={refCallback} className="preview-page bg-white min-h-fit flex flex-col px-16 py-14">
      {/* Section divider */}
      <div className="flex items-start gap-6 mb-8 pb-6 border-b-2 border-slate-800">
        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-sm font-black text-white">{String(index + 1).padStart(2, '0')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400 font-semibold mb-1">Section {index + 1}</p>
          <h3 className="text-xl font-black text-slate-900 leading-tight">{section.title}</h3>
          {section.description && (
            <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-2xl">{section.description}</p>
          )}
        </div>
      </div>

      {/* Records */}
      {sortedItems.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <p className="text-sm font-semibold text-slate-400">No records in this section</p>
          <p className="text-xs text-slate-300 mt-1">Add records from the O&amp;M workspace.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedItems.map((item, iIdx) => {
            const Icon = SOURCE_ICON[item.source_module];
            const badgeClass = SOURCE_BADGE[item.source_module];
            const moduleLabel = SOURCE_MODULE_LABELS[item.source_module];

            return (
              <div key={item.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-black text-slate-400">{iIdx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeClass}`}>
                      <Icon size={8} />
                      {moduleLabel}
                    </span>
                    <span className="text-sm font-bold text-slate-800">{item.title}</span>
                  </div>
                  {item.subtitle && (
                    <p className="text-xs text-slate-500 mb-1">{item.subtitle}</p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-slate-600 leading-relaxed mt-1.5 pl-3 border-l-2 border-slate-200 italic">
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex-1" />
      <PageFooter manual={manual} project={project} />
    </div>
  );
}

function ReadinessPanel({
  sections, items,
}: {
  sections: DBOAndMSection[];
  items: DBOAndMItem[];
}) {
  const populated = sections.filter(s => items.some(i => i.section_id === s.id)).length;
  const empty = sections.length - populated;
  const total = items.length;
  const complete = sections.length > 0 && empty === 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-slate-100">
        <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Manual Readiness</p>
      </div>
      <div className="px-5 py-4 space-y-3">
        <ReadinessStat label="Total sections" value={sections.length} />
        <ReadinessStat label="Populated sections" value={populated} colour="text-emerald-600" />
        <ReadinessStat label="Empty sections" value={empty} colour={empty > 0 ? 'text-amber-500' : 'text-slate-400'} />
        <ReadinessStat label="Total records" value={total} />
      </div>
      {sections.length > 0 && (
        <div className={`px-5 py-3 border-t border-slate-100 flex items-center gap-2 ${complete ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          {complete ? (
            <>
              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
              <p className="text-[11px] font-semibold text-emerald-700">All sections populated</p>
            </>
          ) : (
            <>
              <AlertTriangle size={13} className="text-amber-400 shrink-0" />
              <p className="text-[11px] font-semibold text-amber-600">
                {empty} empty section{empty !== 1 ? 's' : ''} — manual incomplete
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReadinessStat({ label, value, colour = 'text-slate-700' }: { label: string; value: number; colour?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-black ${colour}`}>{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OAndMPreview({ manual, sections, items, project, orgInfo, onClose }: Props) {
  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  const sectionEls = useRef<HTMLDivElement[]>([]);

  const setSectionRef = (idx: number) => (el: HTMLDivElement | null) => {
    if (el) sectionEls.current[idx] = el;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a1628]">
      {/* Preview toolbar */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 bg-[#0d1628] border-b border-[#1e2d4a]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
            <FileText size={12} className="text-[#f97316]" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">{manual.title}</p>
            <p className="text-[10px] text-slate-500">{project.name} · Preview</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500 hidden sm:block">
            {sortedSections.length} section{sortedSections.length !== 1 ? 's' : ''} · {items.length} record{items.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-[#1a2236] hover:bg-[#1e2d4a] border border-[#1e2d4a] rounded-lg transition-colors"
          >
            <X size={12} /> Close Preview
          </button>
        </div>
      </div>

      {/* Preview body: two-column scrollable */}
      <div className="flex-1 overflow-hidden flex">
        {/* Readiness sidebar */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-[#1e2d4a] p-4 space-y-3 hidden lg:block">
          <ReadinessPanel sections={sortedSections} items={items} />

          {/* Section mini-nav */}
          {sortedSections.length > 0 && (
            <div className="bg-[#111827] border border-[#1e2d4a] rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#1e2d4a]">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Sections</p>
              </div>
              <nav className="py-1">
                {sortedSections.map((s, idx) => {
                  const count = items.filter(i => i.section_id === s.id).length;
                  return (
                    <button
                      key={s.id}
                      onClick={() => sectionEls.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-[#1a2236] transition-colors group"
                    >
                      <span className="text-[9px] font-mono text-slate-600 w-4 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="flex-1 text-[11px] text-slate-400 group-hover:text-slate-200 truncate transition-colors">{s.title}</span>
                      <span className={`text-[9px] font-semibold shrink-0 ${count > 0 ? 'text-emerald-500' : 'text-amber-400'}`}>{count}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </aside>

        {/* Document scroll area */}
        <div className="flex-1 overflow-y-auto bg-slate-300 p-6">
          <div className="max-w-[210mm] mx-auto space-y-4">
            {/* Cover page */}
            <div className="shadow-xl rounded overflow-hidden">
              <CoverPage manual={manual} project={project} orgInfo={orgInfo} />
            </div>

            {/* Contents page */}
            <div className="shadow-xl rounded overflow-hidden">
              <ContentsPage
                manual={manual}
                sections={sortedSections}
                items={items}
                project={project}
                sectionRefs={sectionEls}
              />
            </div>

            {/* Section pages */}
            {sortedSections.map((section, idx) => (
              <div key={section.id} className="shadow-xl rounded overflow-hidden">
                <SectionPage
                  section={section}
                  items={items.filter(i => i.section_id === section.id)}
                  index={idx}
                  manual={manual}
                  project={project}
                  refCallback={setSectionRef(idx)}
                />
              </div>
            ))}

            {sortedSections.length === 0 && (
              <div className="shadow-xl rounded overflow-hidden">
                <div className="bg-white min-h-[160px] flex flex-col items-center justify-center px-16 py-14">
                  <AlertTriangle size={24} className="text-amber-400 mb-3" />
                  <p className="text-sm font-semibold text-slate-500 text-center">No sections added yet.</p>
                  <p className="text-xs text-slate-400 text-center mt-1">Return to the workspace to add sections and records.</p>
                </div>
              </div>
            )}

            {/* Back matter */}
            <div className="shadow-xl rounded overflow-hidden">
              <div className="bg-white px-16 py-10 flex flex-col items-center text-center">
                <div className="h-0.5 w-16 bg-slate-200 mb-6" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">End of Document</p>
                <p className="text-sm font-bold text-slate-700">{manual.title}</p>
                {manual.version && <p className="text-xs text-slate-400 mt-0.5">{manual.version}</p>}
                <p className="text-xs text-slate-400 mt-3">{project.name}</p>
                <div className="h-0.5 w-16 bg-slate-200 mt-6 mb-6" />
                <p className="text-[10px] text-slate-300 tracking-wide">
                  Powered by VYSITE® &nbsp;|&nbsp; © VYSITE Ltd. All Rights Reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
