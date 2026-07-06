import { useRef, useState, useEffect, useCallback } from 'react';
import {
  X, FileText, FlaskConical, FolderOpen, AlertTriangle, CheckCircle2,
  Download, FileImage, FileSpreadsheet, File as FileIcon, ExternalLink,
} from 'lucide-react';
import type { DBOAndMManual, DBOAndMSection, DBOAndMItem, OAndMSourceModule } from './types';
import { SOURCE_MODULE_LABELS } from './types';
import type { Project } from '../../data/types';
import { useAppStore } from '../../lib/StoreContext';
import { supabase } from '../../lib/supabase';
import { buildFormPageHTML } from '../../forms/PDFRenderer';
import type { ExtendedSiteForm } from '../../forms/types';
import type { OrgSettings } from '../../forms/PDFRenderer';
import { buildPrintDocument, openPrintTab } from '../../lib/printTab';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function fmtDate(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateShort(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function docDisplayName(doc: { doc_title?: string; name: string }): string {
  return (doc.doc_title ?? '').trim() || doc.name;
}

function mimeCategory(mimeType: string): 'pdf' | 'image' | 'office' | 'other' {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('openxmlformats')
  ) return 'office';
  return 'other';
}

function dataUrlToBlob(dataUrl: string, mimeType: string): string {
  const parts = dataUrl.split(',');
  const base64 = parts[1] ?? '';
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

// ─── TC Record HTML renderer ──────────────────────────────────────────────────

const TC_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1e293b; background: white; font-size: 11px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 860px; margin: 0 auto; padding: 36px 40px; }
  .doc-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid #0ea5e9; margin-bottom: 20px; }
  .doc-logo-img { height: 38px; max-width: 160px; display: block; margin-bottom: 4px; }
  .doc-logo-text { font-size: 22px; font-weight: 900; color: #0ea5e9; letter-spacing: 0.05em; }
  .doc-type-label { font-size: 10px; color: #64748b; margin-top: 4px; }
  .doc-header-right { text-align: right; }
  .doc-title { font-size: 18px; font-weight: 900; color: #111; margin-bottom: 4px; line-height: 1.25; max-width: 380px; }
  .doc-ref { font-size: 11px; color: #64748b; }
  .meta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }
  .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; }
  .meta-item {}
  .meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .meta-value { font-size: 11px; font-weight: 600; color: #0f172a; }
  .result-block { display: flex; align-items: center; justify-content: space-between; border-radius: 8px; padding: 12px 18px; margin: 14px 0; }
  .result-pass { background: #f0fdf4; border: 1.5px solid #86efac; }
  .result-fail { background: #fef2f2; border: 1.5px solid #fca5a5; }
  .result-other { background: #fffbeb; border: 1.5px solid #fcd34d; }
  .result-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
  .result-value-pass { font-size: 14px; font-weight: 800; color: #16a34a; }
  .result-value-fail { font-size: 14px; font-weight: 800; color: #dc2626; }
  .result-value-other { font-size: 14px; font-weight: 800; color: #d97706; }
  .section { margin-top: 20px; page-break-inside: avoid; }
  .section-heading { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 10px; }
  .section-content { font-size: 11px; color: #334155; line-height: 1.65; white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
  .status-badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
  .status-pass { background: #d1fae5; color: #065f46; }
  .status-fail { background: #fee2e2; color: #991b1b; }
  .status-approved { background: #d1fae5; color: #065f46; }
  .status-submitted { background: #dbeafe; color: #1d4ed8; }
  .status-draft { background: #f1f5f9; color: #475569; }
  .status-other { background: #e0f2fe; color: #0369a1; }
  .legal-footer { margin-top: 28px; border-top: 2px solid #e2e8f0; padding-top: 10px; display: flex; align-items: center; justify-content: space-between; }
  .legal-left { font-size: 8px; color: #94a3b8; }
  .legal-right { font-size: 8px; color: #94a3b8; text-align: right; }
  @page { margin: 0; size: A4; }
  @media print { .page { padding: 20px 24px; } }
`;

function buildTCRecordHTML(
  record: {
    id: string; category: string; ref: string; title: string; area: string;
    engineer: string; date: string; status: string; result?: string; notes: string;
    files: unknown[];
  },
  orgSettings?: OrgSettings | null,
): string {
  const orgName = orgSettings?.company_name || 'VYSITE';
  const orgLogo = orgSettings?.logo_data_url;

  const logoHtml = orgLogo
    ? `<img class="doc-logo-img" src="${orgLogo}" alt="${esc(orgName)}" />`
    : `<div class="doc-logo-text">${esc(orgName)}</div>`;

  const statusKey = (record.status ?? '').toLowerCase();
  const statusCls = statusKey === 'pass' ? 'status-pass'
    : statusKey === 'fail' ? 'status-fail'
    : statusKey === 'approved' ? 'status-approved'
    : statusKey === 'submitted' ? 'status-submitted'
    : statusKey === 'draft' ? 'status-draft'
    : 'status-other';

  const resultBlock = record.result
    ? (() => {
        const isPass = /pass/i.test(record.result ?? '');
        const isFail = /fail/i.test(record.result ?? '');
        const cls = isPass ? 'result-block result-pass' : isFail ? 'result-block result-fail' : 'result-block result-other';
        const valCls = isPass ? 'result-value-pass' : isFail ? 'result-value-fail' : 'result-value-other';
        return `<div class="${cls}">
          <span class="result-label">Test Result</span>
          <span class="${valCls}">${esc(record.result)}</span>
        </div>`;
      })()
    : '';

  const metaItems: [string, string][] = [
    ['Reference', record.ref],
    ['Category', record.category],
    ['Area / Location', record.area],
    ['Engineer', record.engineer],
    ['Date', fmtDateShort(record.date)],
    ['Status', record.status],
  ].filter(([, v]) => v) as [string, string][];

  const notesHtml = record.notes
    ? `<div class="section">
        <div class="section-heading">Notes &amp; Observations</div>
        <div class="section-content">${esc(record.notes)}</div>
       </div>`
    : '';

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${esc(record.ref)} — ${esc(record.title)}</title>
  <style>${TC_CSS}</style>
</head>
<body>
<div class="page">
  <div class="doc-header">
    <div>
      ${logoHtml}
      <div class="doc-type-label">Testing &amp; Commissioning — ${esc(record.category)}</div>
    </div>
    <div class="doc-header-right">
      <div class="doc-title">${esc(record.title)}</div>
      <div class="doc-ref">${esc(record.ref)}${record.date ? ' &nbsp;&middot;&nbsp; ' + esc(fmtDateShort(record.date)) : ''}</div>
    </div>
  </div>

  <div class="meta-block">
    <div class="meta-grid">
      ${metaItems.map(([l, v]) => {
        const isSt = l === 'Status';
        return `<div class="meta-item">
          <div class="meta-label">${esc(l)}</div>
          <div class="meta-value">${isSt ? `<span class="status-badge ${statusCls}">${esc(v)}</span>` : esc(v)}</div>
        </div>`;
      }).join('')}
    </div>
  </div>

  ${resultBlock}
  ${notesHtml}

  <div class="legal-footer">
    <div class="legal-left">
      ${esc(orgName)} &nbsp;&middot;&nbsp; T&amp;C Record: ${esc(record.ref)} &nbsp;&middot;&nbsp; Generated ${esc(today)}
    </div>
    <div class="legal-right">
      Powered by VYSITE® &nbsp;|&nbsp; &copy; VYSITE Ltd. All Rights Reserved.
    </div>
  </div>
</div>
</body>
</html>`;
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
    <div className="bg-white min-h-[297mm] flex flex-col">
      <div className="h-2 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 w-full" />
      <div className="flex-1 flex flex-col px-16 py-14">
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
        <div className="flex-1 flex flex-col justify-center">
          <div className="border-l-4 border-slate-800 pl-8 mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 mb-3">
              Operation &amp; Maintenance Manual
            </p>
            <h1 className="text-4xl font-black text-slate-900 leading-tight mb-2">{manual.title}</h1>
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
    sectionRefs.current?.[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="bg-white min-h-[297mm] flex flex-col px-16 py-14">
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
                      {count} {count === 1 ? 'document' : 'documents'}
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

// ─── Document divider header ──────────────────────────────────────────────────

function DocumentDivider({
  item, manual, project,
}: {
  item: DBOAndMItem;
  manual: DBOAndMManual;
  project: Project;
}) {
  const Icon = SOURCE_ICON[item.source_module];
  const badgeClass = SOURCE_BADGE[item.source_module];
  const moduleLabel = SOURCE_MODULE_LABELS[item.source_module];

  return (
    <div className="bg-white px-14 py-8 border-b-2 border-slate-100">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={14} className="text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeClass}`}>
              <Icon size={8} />
              {moduleLabel}
            </span>
            {item.subtitle && (
              <span className="text-[10px] text-slate-400">{item.subtitle}</span>
            )}
          </div>
          <h4 className="text-base font-black text-slate-900 leading-tight">{item.title}</h4>
          {item.notes && (
            <p className="text-xs text-slate-500 mt-2 leading-relaxed pl-3 border-l-2 border-slate-200 italic max-w-2xl">
              {item.notes}
            </p>
          )}
        </div>
      </div>
      <PageFooter manual={manual} project={project} />
    </div>
  );
}

// ─── Project document renderer ────────────────────────────────────────────────

function ProjectDocumentBlock({ item, manual, project, orgInfo }: {
  item: DBOAndMItem;
  manual: DBOAndMManual;
  project: Project;
  orgInfo: OrgInfo;
}) {
  const store = useAppStore();
  const doc = store.projectDocuments.find(d => d.id === item.source_record_id);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDoc = useCallback(async () => {
    if (!doc || loading || blobUrl) return;
    setLoading(true);
    try {
      let dataUrl = doc.data_url;
      if (!dataUrl) {
        const { data } = await supabase
          .from('vy_project_documents')
          .select('id,data_url')
          .eq('id', doc.id)
          .maybeSingle();
        dataUrl = data?.data_url ?? undefined;
      }
      if (!dataUrl) { setError('Document data not available.'); return; }
      const cat = mimeCategory(doc.type);
      if (cat === 'pdf' || cat === 'image') {
        setBlobUrl(dataUrlToBlob(dataUrl, doc.type));
      } else {
        setBlobUrl(dataUrl);
      }
    } catch {
      setError('Failed to load document.');
    } finally {
      setLoading(false);
    }
  }, [doc, loading, blobUrl]);

  useEffect(() => {
    loadDoc();
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!doc) {
    return (
      <div className="bg-white">
        <DocumentDivider item={item} manual={manual} project={project} />
        <div className="bg-slate-50 px-14 py-10 text-center">
          <AlertTriangle size={20} className="text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Document not found in this project.</p>
        </div>
      </div>
    );
  }

  const cat = mimeCategory(doc.type);
  const displayName = docDisplayName(doc);

  return (
    <div className="bg-white">
      <DocumentDivider item={item} manual={manual} project={project} />

      {loading && (
        <div className="px-14 py-10 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading {displayName}…</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="px-14 py-8 bg-slate-50 text-center">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && blobUrl && cat === 'pdf' && (
        <iframe
          src={blobUrl}
          title={displayName}
          className="w-full border-0"
          style={{ height: '297mm', display: 'block' }}
        />
      )}

      {!loading && !error && blobUrl && cat === 'image' && (
        <div className="px-14 py-8 bg-slate-50 flex justify-center">
          <img
            src={blobUrl}
            alt={displayName}
            className="max-w-full max-h-[600px] object-contain rounded shadow-sm"
          />
        </div>
      )}

      {!loading && !error && cat === 'office' && (
        <OfficePlaceholder doc={doc} displayName={displayName} />
      )}

      {!loading && !error && cat === 'other' && blobUrl === null && !loading && (
        <OfficePlaceholder doc={doc} displayName={displayName} />
      )}
    </div>
  );
}

function OfficePlaceholder({ doc, displayName }: {
  doc: { name: string; type: string; size: number };
  displayName: string;
}) {
  const cat = mimeCategory(doc.type);
  const Icon = cat === 'image' ? FileImage
    : (doc.type.includes('sheet') || doc.type.includes('excel') || doc.type.includes('spreadsheet')) ? FileSpreadsheet
    : FileIcon;
  const ext = doc.name.split('.').pop()?.toUpperCase() ?? 'FILE';

  return (
    <div className="px-14 py-10 bg-slate-50 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3">
        <Icon size={22} className="text-slate-400" />
      </div>
      <p className="text-sm font-bold text-slate-700 mb-0.5">{displayName}</p>
      <p className="text-xs text-slate-400 mb-4">{ext} file — preview not available in browser</p>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg">
        <ExternalLink size={11} className="text-slate-400" />
        <span className="text-[10px] text-slate-500">Available for download in the final PDF</span>
      </div>
    </div>
  );
}

// ─── Site form renderer ───────────────────────────────────────────────────────

function SiteFormBlock({ item, manual, project, orgInfo }: {
  item: DBOAndMItem;
  manual: DBOAndMManual;
  project: Project;
  orgInfo: OrgInfo;
}) {
  const store = useAppStore();
  const form = store.siteForms.find(f => f.id === item.source_record_id) as ExtendedSiteForm | undefined;
  const formAttachments = store.attachments.filter(a => a.linked_id === item.source_record_id);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(600);

  const orgSettings: OrgSettings = {
    company_name: orgInfo.companyName,
    logo_data_url: orgInfo.logoDataUrl,
  };

  useEffect(() => {
    if (!form) return;
    const formWithAttachments = { ...form, attachments: formAttachments };
    const html = buildFormPageHTML(formWithAttachments as ExtendedSiteForm, orgSettings);
    const fullHtml = buildPrintDocument(form.title ?? form.type, '', html);
    const iframe = iframeRef.current;
    if (!iframe) return;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    const onLoad = () => {
      try {
        const h = iframe.contentDocument?.body?.scrollHeight;
        if (h && h > 200) setIframeHeight(h + 40);
      } catch { /* cross-origin guard */ }
      URL.revokeObjectURL(url);
    };
    iframe.addEventListener('load', onLoad, { once: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id]);

  if (!form) {
    return (
      <div className="bg-white">
        <DocumentDivider item={item} manual={manual} project={project} />
        <div className="bg-slate-50 px-14 py-10 text-center">
          <AlertTriangle size={20} className="text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Site form not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <DocumentDivider item={item} manual={manual} project={project} />
      <iframe
        ref={iframeRef}
        title={item.title}
        className="w-full border-0"
        style={{ height: iframeHeight, display: 'block' }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

// ─── TC Record renderer ───────────────────────────────────────────────────────

function TCRecordBlock({ item, manual, project, orgInfo }: {
  item: DBOAndMItem;
  manual: DBOAndMManual;
  project: Project;
  orgInfo: OrgInfo;
}) {
  const store = useAppStore();
  const record = store.tcRecords.find(r => r.id === item.source_record_id);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(500);

  const orgSettings: OrgSettings = {
    company_name: orgInfo.companyName,
    logo_data_url: orgInfo.logoDataUrl,
  };

  useEffect(() => {
    if (!record) return;
    const html = buildTCRecordHTML(record, orgSettings);
    const iframe = iframeRef.current;
    if (!iframe) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    const onLoad = () => {
      try {
        const h = iframe.contentDocument?.body?.scrollHeight;
        if (h && h > 200) setIframeHeight(h + 40);
      } catch { /* cross-origin guard */ }
      URL.revokeObjectURL(url);
    };
    iframe.addEventListener('load', onLoad, { once: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  if (!record) {
    return (
      <div className="bg-white">
        <DocumentDivider item={item} manual={manual} project={project} />
        <div className="bg-slate-50 px-14 py-10 text-center">
          <AlertTriangle size={20} className="text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-slate-400">T&C record not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <DocumentDivider item={item} manual={manual} project={project} />
      <iframe
        ref={iframeRef}
        title={item.title}
        className="w-full border-0"
        style={{ height: iframeHeight, display: 'block' }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

// ─── Section page ─────────────────────────────────────────────────────────────

function SectionBlock({
  section, items, index, manual, project, orgInfo, refCallback,
}: {
  section: DBOAndMSection;
  items: DBOAndMItem[];
  index: number;
  manual: DBOAndMManual;
  project: Project;
  orgInfo: OrgInfo;
  refCallback: (el: HTMLDivElement | null) => void;
}) {
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div ref={refCallback}>
      {/* Section divider page */}
      <div className="bg-white min-h-[160px] flex flex-col px-16 py-12 border-b-4 border-slate-800">
        <div className="flex items-start gap-6">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center shrink-0">
            <span className="text-base font-black text-white">{String(index + 1).padStart(2, '0')}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400 font-semibold mb-1">Section {index + 1}</p>
            <h3 className="text-2xl font-black text-slate-900 leading-tight">{section.title}</h3>
            {section.description && (
              <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-2xl">{section.description}</p>
            )}
            <p className="text-xs text-slate-400 mt-2">
              {sortedItems.length} {sortedItems.length === 1 ? 'document' : 'documents'}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <PageFooter manual={manual} project={project} />
        </div>
      </div>

      {/* Empty section */}
      {sortedItems.length === 0 && (
        <div className="bg-slate-50 py-10 flex flex-col items-center text-center">
          <AlertTriangle size={18} className="text-amber-400 mb-2" />
          <p className="text-xs font-semibold text-slate-400">No documents in this section</p>
        </div>
      )}

      {/* Document blocks */}
      {sortedItems.map(item => {
        if (item.source_module === 'project_document') {
          return (
            <div key={item.id} className="border-t border-slate-100">
              <ProjectDocumentBlock item={item} manual={manual} project={project} orgInfo={orgInfo} />
            </div>
          );
        }
        if (item.source_module === 'site_form') {
          return (
            <div key={item.id} className="border-t border-slate-100">
              <SiteFormBlock item={item} manual={manual} project={project} orgInfo={orgInfo} />
            </div>
          );
        }
        if (item.source_module === 'tc_record') {
          return (
            <div key={item.id} className="border-t border-slate-100">
              <TCRecordBlock item={item} manual={manual} project={project} orgInfo={orgInfo} />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

// ─── Readiness panel ──────────────────────────────────────────────────────────

function ReadinessPanel({ sections, items }: { sections: DBOAndMSection[]; items: DBOAndMItem[] }) {
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
        {[
          { label: 'Total sections', value: sections.length },
          { label: 'Populated sections', value: populated, colour: 'text-emerald-600' },
          { label: 'Empty sections', value: empty, colour: empty > 0 ? 'text-amber-500' : 'text-slate-400' },
          { label: 'Total documents', value: total },
        ].map(({ label, value, colour = 'text-slate-700' }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{label}</span>
            <span className={`text-sm font-black ${colour}`}>{value}</span>
          </div>
        ))}
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

// ─── Print/download helpers ───────────────────────────────────────────────────

function buildPrintManualHTML(
  manual: DBOAndMManual,
  sections: DBOAndMSection[],
  items: DBOAndMItem[],
  project: Project,
  orgInfo: OrgInfo,
  siteForms: ExtendedSiteForm[],
  tcRecords: { id: string; category: string; ref: string; title: string; area: string; engineer: string; date: string; status: string; result?: string; notes: string; files: unknown[] }[],
  projectDocs: { id: string; name: string; doc_title?: string; type: string; data_url?: string }[],
  attachments: { linked_id: string; data_url: string; name: string; type: string }[],
): string {
  const orgSettings: OrgSettings = { company_name: orgInfo.companyName, logo_data_url: orgInfo.logoDataUrl };

  const sections_sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const coverHtml = `
    <div style="page-break-after:always;padding:60px 80px;min-height:297mm;display:flex;flex-direction:column;background:white;border-bottom:4px solid #1e293b">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:80px">
        ${orgInfo.logoDataUrl
          ? `<img src="${orgInfo.logoDataUrl}" style="height:40px;max-width:160px;object-fit:contain" alt="${esc(orgInfo.companyName)}" />`
          : `<div style="font-size:22px;font-weight:900;color:#1e293b;letter-spacing:0.05em">${esc(orgInfo.companyName)}</div>`
        }
        <div style="font-size:9px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;padding:5px 14px;border:1.5px solid #cbd5e1;border-radius:4px;color:#64748b">
          ${esc(STATUS_LABEL[manual.status])}
        </div>
      </div>
      <div style="border-left:5px solid #1e293b;padding-left:32px;margin-bottom:48px">
        <div style="font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:#94a3b8;font-weight:700;margin-bottom:10px">Operation &amp; Maintenance Manual</div>
        <div style="font-size:36px;font-weight:900;color:#0f172a;line-height:1.2;margin-bottom:6px">${esc(manual.title)}</div>
        ${manual.version ? `<div style="font-size:12px;color:#64748b;font-weight:600">${esc(manual.version)}</div>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:auto">
        ${[
          ['Project', project.name], ['Client', project.client || '—'],
          ['Location', project.location || '—'], ['Project Manager', project.projectManager || '—'],
          ['Contractor', orgInfo.companyName || '—'], ['Date', today],
        ].map(([l, v]) => `<div>
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.2em;color:#94a3b8;font-weight:700;margin-bottom:3px">${esc(l)}</div>
          <div style="font-size:13px;font-weight:700;color:#1e293b">${esc(v)}</div>
        </div>`).join('')}
      </div>
      <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:40px;display:flex;justify-content:space-between">
        <span style="font-size:8px;color:#94a3b8">Prepared by ${esc(manual.created_by || orgInfo.companyName || '')}</span>
        <span style="font-size:8px;color:#cbd5e1">Powered by VYSITE® | © VYSITE Ltd. All Rights Reserved.</span>
      </div>
    </div>`;

  const contentsRows = sections_sorted.map((s, idx) => {
    const count = items.filter(i => i.section_id === s.id).length;
    return `<tr>
      <td style="padding:8px 12px;font-size:10px;font-weight:700;color:#94a3b8;font-family:monospace">${String(idx + 1).padStart(2, '0')}</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#1e293b">${esc(s.title)}</td>
      <td style="padding:8px 12px;font-size:10px;color:#64748b;text-align:right">${count} doc${count !== 1 ? 's' : ''}</td>
    </tr>`;
  }).join('');

  const contentsHtml = `
    <div style="page-break-after:always;padding:60px 80px;background:white">
      <div style="margin-bottom:40px">
        <div style="font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:#94a3b8;font-weight:700;margin-bottom:6px">Table of</div>
        <div style="font-size:28px;font-weight:900;color:#0f172a">Contents</div>
        <div style="height:3px;width:48px;background:#1e293b;margin-top:8px"></div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tbody>${contentsRows}</tbody>
      </table>
      <div style="margin-top:48px;border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between">
        <span style="font-size:8px;color:#94a3b8">${esc(project.name)} · ${esc(manual.title)}</span>
        <span style="font-size:8px;color:#cbd5e1">Powered by VYSITE® | © VYSITE Ltd. All Rights Reserved.</span>
      </div>
    </div>`;

  const sectionBlocks = sections_sorted.map((section, idx) => {
    const sectionItems = items.filter(i => i.section_id === section.id).sort((a, b) => a.sort_order - b.sort_order);

    const sectionDivider = `
      <div style="page-break-before:always;padding:60px 80px 40px;background:white;border-bottom:5px solid #1e293b">
        <div style="display:flex;align-items:flex-start;gap:24px">
          <div style="width:56px;height:56px;background:#1e293b;border-radius:16px;display:flex;align-items:center;justify-content:center;shrink:0">
            <span style="color:white;font-weight:900;font-size:16px">${String(idx + 1).padStart(2, '0')}</span>
          </div>
          <div>
            <div style="font-size:8px;letter-spacing:0.25em;text-transform:uppercase;color:#94a3b8;font-weight:700;margin-bottom:6px">Section ${idx + 1}</div>
            <div style="font-size:24px;font-weight:900;color:#0f172a;line-height:1.2">${esc(section.title)}</div>
            ${section.description ? `<div style="font-size:11px;color:#64748b;margin-top:8px;line-height:1.6">${esc(section.description)}</div>` : ''}
          </div>
        </div>
        <div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between">
          <span style="font-size:8px;color:#94a3b8">${esc(project.name)} · ${esc(manual.title)}</span>
          <span style="font-size:8px;color:#cbd5e1">Powered by VYSITE® | © VYSITE Ltd. All Rights Reserved.</span>
        </div>
      </div>`;

    const docBlocks = sectionItems.map(item => {
      const divider = `
        <div style="padding:28px 80px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0">
          <div style="font-size:8px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px">
            ${esc(SOURCE_MODULE_LABELS[item.source_module])}
          </div>
          <div style="font-size:15px;font-weight:800;color:#1e293b;line-height:1.3">${esc(item.title)}</div>
          ${item.subtitle ? `<div style="font-size:10px;color:#64748b;margin-top:2px">${esc(item.subtitle)}</div>` : ''}
          ${item.notes ? `<div style="font-size:10px;color:#475569;margin-top:8px;padding-left:12px;border-left:2px solid #cbd5e1;font-style:italic;line-height:1.6">${esc(item.notes)}</div>` : ''}
        </div>`;

      if (item.source_module === 'site_form') {
        const form = siteForms.find(f => f.id === item.source_record_id);
        if (!form) return divider + `<div style="padding:24px 80px;background:white;color:#94a3b8;font-size:11px">Form not found.</div>`;
        const formAtts = attachments.filter(a => a.linked_id === item.source_record_id);
        const formWithAtts = { ...form, attachments: formAtts };
        const formHtml = buildFormPageHTML(formWithAtts as ExtendedSiteForm, orgSettings);
        return divider + `<div style="page-break-inside:avoid">${formHtml}</div>`;
      }

      if (item.source_module === 'tc_record') {
        const rec = tcRecords.find(r => r.id === item.source_record_id);
        if (!rec) return divider + `<div style="padding:24px 80px;background:white;color:#94a3b8;font-size:11px">Record not found.</div>`;
        const recPage = buildTCRecordHTML(rec, orgSettings);
        // Extract body from the full HTML for inline embedding
        const bodyMatch = recPage.match(/<body>([\s\S]*)<\/body>/);
        const recBody = bodyMatch ? bodyMatch[1] : '';
        return divider + `<div style="page-break-inside:avoid">${recBody}</div>`;
      }

      if (item.source_module === 'project_document') {
        const docRec = projectDocs.find(d => d.id === item.source_record_id);
        if (!docRec?.data_url) return divider + `<div style="padding:24px 80px;background:#f8fafc;text-align:center;color:#94a3b8;font-size:11px">Document data not available for print. Open in browser for full preview.</div>`;
        const cat = mimeCategory(docRec.type);
        if (cat === 'image') {
          return divider + `<div style="padding:24px 80px;text-align:center;page-break-inside:avoid"><img src="${docRec.data_url}" style="max-width:100%;max-height:200mm;object-fit:contain" alt="${esc(docDisplayName(docRec))}" /></div>`;
        }
        // PDF and other: show placeholder in print view since we can't embed binary PDFs in HTML print
        return divider + `
          <div style="margin:24px 80px;padding:32px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center">
            <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:4px">${esc(docDisplayName(docRec))}</div>
            <div style="font-size:10px;color:#94a3b8">${docRec.name.split('.').pop()?.toUpperCase() ?? 'PDF'} — see full interactive preview for embedded document</div>
          </div>`;
      }

      return divider;
    }).join('');

    return sectionDivider + docBlocks;
  }).join('');

  const endPage = `
    <div style="padding:60px 80px;text-align:center;background:white">
      <div style="width:60px;height:2px;background:#e2e8f0;margin:0 auto 24px"></div>
      <div style="font-size:9px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px">End of Document</div>
      <div style="font-size:16px;font-weight:900;color:#1e293b">${esc(manual.title)}</div>
      ${manual.version ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px">${esc(manual.version)}</div>` : ''}
      <div style="font-size:11px;color:#94a3b8;margin-top:12px">${esc(project.name)}</div>
      <div style="width:60px;height:2px;background:#e2e8f0;margin:24px auto"></div>
      <div style="font-size:8px;color:#cbd5e1">Powered by VYSITE® | © VYSITE Ltd. All Rights Reserved.</div>
    </div>`;

  const CSS_PRINT = `
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { margin: 0; size: A4; }
    @media print { body { margin: 0; } }
    .page { max-width: 860px; margin: 0 auto; padding: 36px 40px; }
    .doc-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid #f97316; margin-bottom: 20px; }
    .doc-logo-img { height: 38px; max-width: 160px; display: block; margin-bottom: 4px; }
    .doc-logo-text { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: 0.05em; }
    .doc-type-label { font-size: 10px; color: #64748b; margin-top: 4px; }
    .doc-header-right { text-align: right; }
    .doc-title { font-size: 18px; font-weight: 900; color: #111; margin-bottom: 4px; line-height: 1.25; max-width: 380px; }
    .doc-dateline { font-size: 11px; color: #64748b; }
    .doc-subtitle-bar { font-size: 11px; color: #64748b; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
    .status-badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 6px; vertical-align: middle; }
    .status-submitted { background: #dbeafe; color: #1d4ed8; }
    .status-approved { background: #d1fae5; color: #065f46; }
    .status-draft { background: #f1f5f9; color: #475569; }
    .status-issued { background: #e0f2fe; color: #0369a1; }
    .status-open { background: #fef9c3; color: #854d0e; }
    .status-other { background: #f1f5f9; color: #475569; }
    .meta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; }
    .meta-grid-2 { grid-template-columns: repeat(2, 1fr); }
    .meta-grid-4 { grid-template-columns: repeat(4, 1fr); }
    .meta-item {}
    .meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
    .meta-value { font-size: 11px; font-weight: 600; color: #0f172a; }
    .result-block { display: flex; align-items: center; justify-content: space-between; border-radius: 8px; padding: 12px 18px; margin: 14px 0; page-break-inside: avoid; }
    .result-pass { background: #f0fdf4; border: 1.5px solid #86efac; }
    .result-fail { background: #fef2f2; border: 1.5px solid #fca5a5; }
    .result-other { background: #fffbeb; border: 1.5px solid #fcd34d; }
    .result-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .result-value-pass { font-size: 14px; font-weight: 800; color: #16a34a; }
    .result-value-fail { font-size: 14px; font-weight: 800; color: #dc2626; }
    .result-value-other { font-size: 14px; font-weight: 800; color: #d97706; }
    .section { margin-top: 20px; page-break-inside: avoid; }
    .section-heading { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 10px; }
    .section-content { font-size: 11px; color: #334155; line-height: 1.65; white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 2px; }
    .data-table th { padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; }
    .data-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: top; }
    .data-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 2px; }
    .data-grid-3 { grid-template-columns: repeat(3, 1fr); }
    .data-cell { background: white; padding: 9px 12px; }
    .data-cell-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
    .data-cell-value { font-size: 11px; font-weight: 600; color: #0f172a; }
    .risk-low { background: #dcfce7; color: #166534; border-radius: 20px; padding: 2px 10px; font-size: 9px; font-weight: 700; display: inline-block; }
    .risk-medium { background: #fef9c3; color: #854d0e; border-radius: 20px; padding: 2px 10px; font-size: 9px; font-weight: 700; display: inline-block; }
    .risk-high { background: #fed7aa; color: #9a3412; border-radius: 20px; padding: 2px 10px; font-size: 9px; font-weight: 700; display: inline-block; }
    .risk-critical { background: #fee2e2; color: #991b1b; border-radius: 20px; padding: 2px 10px; font-size: 9px; font-weight: 700; display: inline-block; }
    .hazard-card { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; overflow: hidden; page-break-inside: avoid; }
    .hazard-header { background: #f8fafc; padding: 9px 14px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
    .hazard-body { padding: 10px 14px; }
    .hazard-row { display: grid; grid-template-columns: 140px 1fr; gap: 8px; margin-bottom: 6px; font-size: 10px; }
    .hazard-row-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; padding-top: 1px; }
    .hazard-controls { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 5px; padding: 8px 10px; margin-top: 8px; font-size: 10px; color: #166534; }
    .checklist-row { display: grid; grid-template-columns: 1fr 80px; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
    .badge-pass { background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 20px; font-size: 8.5px; font-weight: 700; }
    .badge-fail { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 20px; font-size: 8.5px; font-weight: 700; }
    .badge-na { background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 20px; font-size: 8.5px; font-weight: 700; }
    .badge-action { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 20px; font-size: 8.5px; font-weight: 700; margin-left: 4px; }
    .evidence-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; }
    .evidence-item { border: 1px solid #e2e8f0; border-radius: 5px; overflow: hidden; page-break-inside: avoid; }
    .evidence-img { width: 100%; height: 110px; object-fit: cover; display: block; background: #f8fafc; }
    .evidence-caption { padding: 3px 6px; font-size: 7.5px; color: #64748b; background: #f8fafc; border-top: 1px solid #e2e8f0; }
    .signoff-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .signoff-table th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; color: #334155; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
    .signoff-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .sig-box { min-width: 90px; height: 28px; border-bottom: 1px solid #cbd5e1; }
    .legal-footer { margin-top: 28px; border-top: 2px solid #e2e8f0; page-break-inside: avoid; }
    .legal-footer-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 0 8px; }
    .legal-footer-title { font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
    .legal-footer-ref { font-size: 8px; color: #94a3b8; }
    .legal-notice-bar { background: #fffbf5; border: 1px solid #fed7aa; border-left: 3px solid #f97316; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; }
    .legal-notice-label { font-size: 7.5px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.09em; margin-bottom: 3px; }
    .legal-notice-text { font-size: 8.5px; color: #92400e; line-height: 1.65; }
    .legal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
    .legal-cell { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 8px 12px; }
    .legal-cell-label { font-size: 7.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
    .legal-cell-text { font-size: 8.5px; color: #475569; line-height: 1.6; }
    .legal-branding { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid #e2e8f0; }
    .legal-branding-left { font-size: 8px; color: #94a3b8; }
    .legal-branding-right { font-size: 8px; color: #94a3b8; text-align: right; }
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${esc(manual.title)} — ${esc(project.name)}</title>
  <style>${CSS_PRINT}</style>
</head>
<body>
${coverHtml}
${contentsHtml}
${sectionBlocks}
${endPage}
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OAndMPreview({ manual, sections, items, project, orgInfo, onClose }: Props) {
  const store = useAppStore();
  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  const sectionEls = useRef<HTMLDivElement[]>([]);

  const setSectionRef = (idx: number) => (el: HTMLDivElement | null) => {
    if (el) sectionEls.current[idx] = el;
  };

  const handleDownload = useCallback(() => {
    const html = buildPrintManualHTML(
      manual,
      sortedSections,
      items,
      project,
      orgInfo,
      store.siteForms as ExtendedSiteForm[],
      store.tcRecords,
      store.projectDocuments,
      store.attachments,
    );
    openPrintTab(html);
  }, [manual, sortedSections, items, project, orgInfo, store]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a1628]">
      {/* Toolbar */}
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
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 hidden sm:block">
            {sortedSections.length} section{sortedSections.length !== 1 ? 's' : ''} · {items.length} document{items.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#f97316] hover:bg-orange-400 rounded-lg transition-colors"
          >
            <Download size={12} />
            Download PDF
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-[#1a2236] hover:bg-[#1e2d4a] border border-[#1e2d4a] rounded-lg transition-colors"
          >
            <X size={12} /> Close
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-[#1e2d4a] p-4 space-y-3 hidden lg:block">
          <ReadinessPanel sections={sortedSections} items={items} />
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

        {/* Document area */}
        <div className="flex-1 overflow-y-auto bg-slate-300 p-6">
          <div className="max-w-[210mm] mx-auto space-y-4">
            {/* Cover */}
            <div className="shadow-xl rounded overflow-hidden">
              <CoverPage manual={manual} project={project} orgInfo={orgInfo} />
            </div>

            {/* Contents */}
            <div className="shadow-xl rounded overflow-hidden">
              <ContentsPage
                manual={manual}
                sections={sortedSections}
                items={items}
                project={project}
                sectionRefs={sectionEls}
              />
            </div>

            {/* Sections with full document rendering */}
            {sortedSections.map((section, idx) => (
              <div key={section.id} className="shadow-xl rounded overflow-hidden">
                <SectionBlock
                  section={section}
                  items={items.filter(i => i.section_id === section.id)}
                  index={idx}
                  manual={manual}
                  project={project}
                  orgInfo={orgInfo}
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

            {/* End of document */}
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
