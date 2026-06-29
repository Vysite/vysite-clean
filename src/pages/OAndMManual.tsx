import {
  BookOpen, CheckCircle2, Tag, FolderSearch, LayoutList,
  FileDown, ClipboardList, FlaskConical, Package,
  FileText, Wrench, Award, Map, Paperclip, ArrowRight,
} from 'lucide-react';

const WORKFLOW_STEPS = [
  {
    number: '01',
    title: 'Capture project information during delivery',
    description: 'Site forms, T&C certificates, QA records, documents, and attachments are recorded as normal inside VYSITE — no extra work required.',
    icon: ClipboardList,
    color: 'text-[#f97316]',
    bg: 'bg-[#f97316]/10',
    border: 'border-[#f97316]/20',
  },
  {
    number: '02',
    title: 'Tag relevant records for O&M',
    description: "When creating or uploading a record, simply mark it as \"Include in O&M\". VYSITE tracks what has been tagged and what is still missing.",
    icon: Tag,
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/20',
  },
  {
    number: '03',
    title: 'Review missing items',
    description: 'A smart gap analysis shows exactly which O&M sections are complete and which still need evidence — so nothing slips through at handover.',
    icon: FolderSearch,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
  },
  {
    number: '04',
    title: 'Organise into sections',
    description: 'Drag and drop tagged records into the O&M manual structure. Reorder, group by system or trade, and add cover notes for each section.',
    icon: LayoutList,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
  },
  {
    number: '05',
    title: 'Generate branded O&M Manual PDF',
    description: 'Produce a professionally formatted, client-ready O&M manual — complete with your organisation logo, project details, and full evidence appendices.',
    icon: FileDown,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/20',
  },
];

const SECTIONS = [
  { label: 'Project Information',         icon: BookOpen },
  { label: 'Technical Submittals',        icon: FileText },
  { label: 'Testing & Commissioning',     icon: FlaskConical },
  { label: 'QA Records',                  icon: CheckCircle2 },
  { label: 'Asset Information',           icon: Package },
  { label: 'Manufacturer Literature',     icon: Paperclip },
  { label: 'Warranties',                  icon: Award },
  { label: 'Certificates',                icon: Award },
  { label: 'As-Built Drawings',           icon: Map },
  { label: 'Appendices',                  icon: Wrench },
];

const SOURCES = [
  'Site Forms',
  'Testing & Commissioning forms',
  'Technical submittals',
  'QA records',
  'Documents',
  'As-built drawings',
  'Warranties',
  'Product data sheets',
  'Manufacturer manuals',
  'Certificates',
  'Attachments',
];

export default function OAndMManual() {
  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-14">

        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/10 border border-[#f97316]/20 text-[#f97316] text-xs font-semibold mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-pulse" />
            Coming Soon
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white leading-tight">
            O&M Manual
          </h1>
          <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
            Build a professional, client-ready Operations &amp; Maintenance manual from evidence already captured inside VYSITE — without entering anything twice.
          </p>
        </div>

        {/* Key principle banner */}
        <div className="relative overflow-hidden rounded-2xl border border-[#f97316]/20 bg-gradient-to-r from-[#f97316]/5 via-[#0d1628] to-[#0d1628] p-6">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#f97316] rounded-l-2xl" />
          <div className="pl-4">
            <p className="text-xs font-bold text-[#f97316] uppercase tracking-widest mb-2">Core Principle</p>
            <p className="text-white font-semibold text-lg leading-snug">
              Users should never have to upload or enter information twice.
            </p>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              The O&amp;M Manual will allow records and documents to be tagged for inclusion throughout the project. When it's time to produce the manual, everything will already be organised, traceable and ready to assemble.
            </p>
          </div>
        </div>

        {/* Future workflow */}
        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Future Workflow</h2>
          <div className="relative">
            {/* Connector line */}
            <div className="absolute left-[27px] top-10 bottom-10 w-px bg-[#1e2d4a] hidden sm:block" />
            <div className="space-y-4">
              {WORKFLOW_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.number} className="relative flex gap-5 items-start">
                    <div className={`shrink-0 w-14 h-14 rounded-xl border ${step.bg} ${step.border} flex items-center justify-center z-10`}>
                      <Icon size={20} className={step.color} />
                    </div>
                    <div className="pt-1 pb-4 min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-slate-600">{step.number}</span>
                        <h3 className="text-sm font-bold text-white">{step.title}</h3>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Two-column: sources + sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Data sources */}
          <div className="bg-[#111827] border border-[#1e2d4a] rounded-2xl p-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Pulls from</h3>
            <ul className="space-y-2">
              {SOURCES.map((src) => (
                <li key={src} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <ArrowRight size={12} className="text-[#f97316] shrink-0" />
                  {src}
                </li>
              ))}
            </ul>
          </div>

          {/* Manual sections */}
          <div className="bg-[#111827] border border-[#1e2d4a] rounded-2xl p-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Manual Sections</h3>
            <div className="space-y-2">
              {SECTIONS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="flex items-center gap-3 py-1.5">
                    <span className="text-[10px] font-mono text-slate-600 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <Icon size={13} className="text-slate-500 shrink-0" />
                    <span className="text-sm text-slate-300">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Note on existing functionality */}
        <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1628] p-5 flex gap-4 items-start">
          <div className="w-9 h-9 rounded-lg bg-sky-400/10 border border-sky-400/20 flex items-center justify-center shrink-0 mt-0.5">
            <FlaskConical size={16} className="text-sky-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Testing &amp; Commissioning records are still here</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              All existing T&amp;C records are preserved and accessible through Site Forms, where testing evidence is properly captured alongside method statements, inspection reports, and other QA documents. No data has been removed.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
