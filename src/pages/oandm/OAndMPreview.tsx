import { useState, useCallback } from 'react';
import { X, FileText, Download, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { DBOAndMManual, DBOAndMSection, DBOAndMItem } from './types';
import type { Project } from '../../data/types';
import { useAppStore } from '../../lib/StoreContext';
import type { DBTCRecord, DBSiteForm } from '../../lib/store';
import { buildOAndMPdf, type BuildProgress } from './OAndMPDFBuilder';

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

type ExportState = 'idle' | 'building' | 'done' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export default function OAndMPreview({ manual, sections, items, project, orgInfo, onClose }: Props) {
  const store = useAppStore();
  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  const [exportState, setExportState] = useState<ExportState>('idle');
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleBuild = useCallback(async () => {
    setExportState('building');
    setProgress(null);
    setErrorMsg('');

    try {
      const bytes = await buildOAndMPdf(
        manual,
        sortedSections,
        items,
        project,
        orgInfo,
        store.projectDocuments,
        store.tcRecords as DBTCRecord[],
        store.siteForms as DBSiteForm[],
        (p) => setProgress(p),
      );

      // Trigger browser file download
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${manual.title.replace(/[^a-zA-Z0-9 \-_]/g, '')} — O&M Manual.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setExportState('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setExportState('error');
    }
  }, [manual, sortedSections, items, project, orgInfo, store]);

  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  const totalDocs = items.length;
  const populated = sortedSections.filter(s => items.some(i => i.section_id === s.id)).length;
  const pdfDocs = items.filter(i => i.source_module === 'project_document').length;
  const tcDocs = items.filter(i => i.source_module === 'tc_record').length;
  const formDocs = items.filter(i => i.source_module === 'site_form').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0d1628', border: '1px solid #1e2d4a' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e2d4a' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}>
              <FileText size={14} style={{ color: '#f97316' }} />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none mb-0.5">{manual.title}</p>
              <p className="text-[10px]" style={{ color: '#475569' }}>{project.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={exportState === 'building'}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
            style={{ color: '#475569' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Manual summary */}
        <div className="px-6 py-5" style={{ borderBottom: '1px solid #1e2d4a' }}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Sections', value: sortedSections.length, sub: `${populated} populated` },
              { label: 'Documents', value: totalDocs, sub: `${pdfDocs} PDF · ${tcDocs} T&C · ${formDocs} form` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-xl px-4 py-3" style={{ background: '#111827', border: '1px solid #1e2d4a' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#334155' }}>{label}</p>
                <p className="text-xl font-black text-white leading-none">{value}</p>
                <p className="text-[10px] mt-1" style={{ color: '#334155' }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">

          {/* Idle */}
          {exportState === 'idle' && (
            <div>
              <p className="text-xs mb-4" style={{ color: '#64748b', lineHeight: 1.6 }}>
                VYSITE will assemble one combined PDF containing all sections, uploaded documents, drawings, T&C records, and site forms. Uploaded PDFs are merged directly — no placeholders.
              </p>
              <div className="space-y-2 mb-5">
                {[
                  { label: 'Cover, contents & section dividers', icon: '✓' },
                  { label: 'Uploaded PDFs merged directly (drawings, specs, literature)', icon: '✓' },
                  { label: 'Images placed full-size on their own pages', icon: '✓' },
                  { label: 'T&C records as structured certificate pages', icon: '✓' },
                  { label: 'Site form reference pages', icon: '✓' },
                ].map(({ label, icon }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span className="text-xs font-bold" style={{ color: '#10b981', width: 14 }}>{icon}</span>
                    <span className="text-xs" style={{ color: '#475569' }}>{label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleBuild}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-colors"
                style={{ background: '#f97316' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#ea6c0a')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}
              >
                <Download size={14} />
                Build &amp; Download PDF
              </button>
            </div>
          )}

          {/* Building */}
          {exportState === 'building' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Loader2 size={18} className="animate-spin" style={{ color: '#f97316' }} />
                <p className="text-sm font-semibold text-white">Assembling O&amp;M Manual…</p>
              </div>

              {/* Progress bar */}
              <div className="rounded-full overflow-hidden mb-2" style={{ background: '#1a2236', height: 6 }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, background: 'linear-gradient(to right, #f97316, #fb923c)' }}
                />
              </div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] truncate pr-4" style={{ color: '#475569', maxWidth: '80%' }}>
                  {progress?.stage ?? 'Initialising…'}
                </p>
                <p className="text-[10px] font-bold shrink-0" style={{ color: '#475569' }}>{pct}%</p>
              </div>

              <p className="text-[10px]" style={{ color: '#334155', lineHeight: 1.6 }}>
                Large manuals with many PDFs may take 20–40 seconds. Please keep this window open.
              </p>
            </div>
          )}

          {/* Done */}
          {exportState === 'done' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-none mb-0.5">PDF Downloaded</p>
                  <p className="text-[10px]" style={{ color: '#475569' }}>Check your downloads folder</p>
                </div>
              </div>
              <p className="text-xs mb-5" style={{ color: '#475569', lineHeight: 1.6 }}>
                The O&amp;M Manual PDF has been saved. It contains all sections, merged documents, and generated pages as one combined file.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleBuild}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors"
                  style={{ background: '#1a2236', color: '#64748b', border: '1px solid #1e2d4a' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
                >
                  Build Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors"
                  style={{ background: '#f97316' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#ea6c0a')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {exportState === 'error' && (
            <div>
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                <div>
                  <p className="text-sm font-bold text-white leading-none mb-1">Export Failed</p>
                  <p className="text-xs" style={{ color: '#64748b', lineHeight: 1.5 }}>{errorMsg}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportState('idle')}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors"
                  style={{ background: '#1a2236', color: '#64748b', border: '1px solid #1e2d4a' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
                >
                  Back
                </button>
                <button
                  onClick={handleBuild}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors"
                  style={{ background: '#f97316' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#ea6c0a')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
