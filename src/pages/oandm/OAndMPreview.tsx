import { useRef, useState, useEffect, useCallback } from 'react';
import {
  X, FileText, FlaskConical, FolderOpen, AlertTriangle, CheckCircle2,
  Download, FileImage, FileSpreadsheet, File as FileIcon,
} from 'lucide-react';
import { PDFDocument as PdfLib } from 'pdf-lib';
import type { DBOAndMManual, DBOAndMSection, DBOAndMItem, OAndMSourceModule } from './types';
import { SOURCE_MODULE_LABELS } from './types';
import type { Project } from '../../data/types';
import { useAppStore } from '../../lib/StoreContext';
import type { DBProjectDocument } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { buildFormPageHTML } from '../../forms/PDFRenderer';
import type { ExtendedSiteForm } from '../../forms/types';
import type { OrgSettings } from '../../forms/PDFRenderer';
import { openPrintTab } from '../../lib/printTab';

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

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_ICON: Record<OAndMSourceModule, React.ComponentType<{ size?: number; className?: string }>> = {
  project_document: FolderOpen,
  tc_record: FlaskConical,
  site_form: FileText,
};

const SOURCE_BADGE_TEXT: Record<OAndMSourceModule, string> = {
  project_document: 'text-emerald-700',
  tc_record: 'text-sky-700',
  site_form: 'text-amber-700',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    mimeType.includes('word') || mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') || mimeType.includes('presentation') ||
    mimeType.includes('powerpoint') || mimeType.includes('openxmlformats')
  ) return 'office';
  return 'other';
}

function dataUrlToBlob(dataUrl: string, mimeType: string): string {
  const base64 = dataUrl.split(',')[1] ?? '';
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

async function pdfMetrics(dataUrl: string): Promise<{ pageCount: number; aspectRatio: number }> {
  try {
    const base64 = dataUrl.split(',')[1] ?? '';
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const doc = await PdfLib.load(bytes, { ignoreEncryption: true });
    const count = doc.getPageCount();
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    return { pageCount: count, aspectRatio: height / width };
  } catch {
    return { pageCount: 1, aspectRatio: 297 / 210 };
  }
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
`;

function buildTCRecordHTML(
  record: { id: string; category: string; ref: string; title: string; area: string; engineer: string; date: string; status: string; result?: string; notes: string; files: unknown[] },
  orgSettings?: OrgSettings | null,
): string {
  const orgName = orgSettings?.company_name || 'VYSITE';
  const orgLogo = orgSettings?.logo_data_url;
  const logoHtml = orgLogo
    ? `<img class="doc-logo-img" src="${orgLogo}" alt="${esc(orgName)}" />`
    : `<div class="doc-logo-text">${esc(orgName)}</div>`;
  const statusKey = (record.status ?? '').toLowerCase();
  const statusCls = statusKey === 'pass' ? 'status-pass' : statusKey === 'fail' ? 'status-fail' : statusKey === 'approved' ? 'status-approved' : statusKey === 'submitted' ? 'status-submitted' : statusKey === 'draft' ? 'status-draft' : 'status-other';
  const resultBlock = record.result ? (() => {
    const isPass = /pass/i.test(record.result ?? '');
    const isFail = /fail/i.test(record.result ?? '');
    const cls = isPass ? 'result-block result-pass' : isFail ? 'result-block result-fail' : 'result-block result-other';
    const valCls = isPass ? 'result-value-pass' : isFail ? 'result-value-fail' : 'result-value-other';
    return `<div class="${cls}"><span class="result-label">Test Result</span><span class="${valCls}">${esc(record.result)}</span></div>`;
  })() : '';
  const metaItems: [string, string][] = ([['Reference', record.ref], ['Category', record.category], ['Area / Location', record.area], ['Engineer', record.engineer], ['Date', fmtDateShort(record.date)], ['Status', record.status]] as [string, string][]).filter(([, v]) => v);
  const notesHtml = record.notes ? `<div class="section"><div class="section-heading">Notes &amp; Observations</div><div class="section-content">${esc(record.notes)}</div></div>` : '';
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(record.ref)} — ${esc(record.title)}</title><style>${TC_CSS}</style></head><body><div class="page"><div class="doc-header"><div>${logoHtml}<div class="doc-type-label">Testing &amp; Commissioning — ${esc(record.category)}</div></div><div class="doc-header-right"><div class="doc-title">${esc(record.title)}</div><div class="doc-ref">${esc(record.ref)}${record.date ? ' &nbsp;&middot;&nbsp; ' + esc(fmtDateShort(record.date)) : ''}</div></div></div><div class="meta-block"><div class="meta-grid">${metaItems.map(([l, v]) => `<div><div class="meta-label">${esc(l)}</div><div class="meta-value">${l === 'Status' ? `<span class="status-badge ${statusCls}">${esc(v)}</span>` : esc(v)}</div></div>`).join('')}</div></div>${resultBlock}${notesHtml}<div class="legal-footer"><div class="legal-left">${esc(orgName)} &nbsp;&middot;&nbsp; T&amp;C Record: ${esc(record.ref)} &nbsp;&middot;&nbsp; Generated ${esc(today)}</div><div class="legal-right">Powered by VYSITE® &nbsp;|&nbsp; &copy; VYSITE Ltd. All Rights Reserved.</div></div></div></body></html>`;
}

// ─── Shared page footer ───────────────────────────────────────────────────────

function PageFooter({ manual, project }: { manual: DBOAndMManual; project: Project }) {
  return (
    <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-6">
      <p className="text-[8px] text-slate-300 font-medium tracking-wide">
        {project.name}{manual.version ? ` · ${manual.version}` : ''} · {manual.title}
      </p>
      <p className="text-[8px] text-slate-300 font-medium tracking-wide text-right">
        Powered by VYSITE® &nbsp;|&nbsp; © VYSITE Ltd. All Rights Reserved.
      </p>
    </div>
  );
}

// ─── Cover page ───────────────────────────────────────────────────────────────

function CoverPage({ manual, project, orgInfo }: { manual: DBOAndMManual; project: Project; orgInfo: OrgInfo }) {
  return (
    <div className="bg-white flex flex-col" style={{ minHeight: '297mm' }}>
      {/* Top colour bar */}
      <div className="h-1.5 w-full" style={{ background: 'linear-gradient(to right, #0f172a, #1e293b, #334155)' }} />

      <div className="flex-1 flex flex-col" style={{ padding: '56px 80px' }}>
        {/* Org header */}
        <div className="flex items-start justify-between mb-20">
          <div>
            {orgInfo.logoDataUrl ? (
              <img src={orgInfo.logoDataUrl} alt={orgInfo.companyName} style={{ height: 44, maxWidth: 180, objectFit: 'contain', display: 'block', marginBottom: 6 }} />
            ) : (
              <p style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em' }}>{orgInfo.companyName || 'Organisation'}</p>
            )}
            {orgInfo.logoDataUrl && orgInfo.companyName && (
              <p style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{orgInfo.companyName}</p>
            )}
          </div>
          <span className={`text-[9px] font-black tracking-[0.18em] px-3 py-1.5 rounded border ${STATUS_STYLE[manual.status]}`}>
            {STATUS_LABEL[manual.status]}
          </span>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col justify-center">
          {/* Decorative background element */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', right: -20, top: -40,
              fontSize: 200, fontWeight: 900, color: '#f8fafc',
              lineHeight: 0.85, letterSpacing: '-0.05em',
              userSelect: 'none', pointerEvents: 'none',
            }}>
              O&M
            </div>
            <div style={{ position: 'relative', borderLeft: '5px solid #0f172a', paddingLeft: 32, marginBottom: 40 }}>
              <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.28em', color: '#94a3b8', marginBottom: 12 }}>
                Operation &amp; Maintenance Manual
              </p>
              <h1 style={{ fontSize: 38, fontWeight: 900, color: '#0f172a', lineHeight: 1.15, marginBottom: 8, letterSpacing: '-0.02em' }}>
                {manual.title}
              </h1>
              {manual.version && (
                <p style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{manual.version}</p>
              )}
            </div>
          </div>

          {/* Project details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 48px', maxWidth: 520 }}>
            {([
              ['Project', project.name],
              ['Client', project.client || '—'],
              ['Location', project.location || '—'],
              ['Project Manager', project.projectManager || '—'],
              ['Contractor', orgInfo.companyName || '—'],
              ['Date', fmtDate(manual.updated_at || manual.created_at)],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#94a3b8', fontWeight: 700, marginBottom: 3 }}>{label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cover footer */}
        <div style={{ marginTop: 'auto', paddingTop: 28, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 9, color: '#94a3b8' }}>Prepared by {manual.created_by || orgInfo.companyName || 'Unknown'}</p>
          <p style={{ fontSize: 8, color: '#cbd5e1', letterSpacing: '0.05em' }}>
            Powered by VYSITE® &nbsp;|&nbsp; © VYSITE Ltd. All Rights Reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Contents page ────────────────────────────────────────────────────────────

function ContentsPage({
  manual, sections, items, project, sectionRefs,
}: {
  manual: DBOAndMManual;
  sections: DBOAndMSection[];
  items: DBOAndMItem[];
  project: Project;
  sectionRefs: React.RefObject<HTMLDivElement[]>;
}) {
  return (
    <div className="bg-white flex flex-col" style={{ minHeight: '297mm', padding: '56px 80px' }}>
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.28em', color: '#94a3b8', fontWeight: 700, marginBottom: 8 }}>Table of</p>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Contents</h2>
        <div style={{ width: 48, height: 3, background: '#0f172a', marginTop: 10 }} />
      </div>

      <div style={{ flex: 1 }}>
        {sections.length === 0 ? (
          <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>No sections added yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {sections.map((section, idx) => {
                const count = items.filter(i => i.section_id === section.id).length;
                const populated = count > 0;
                return (
                  <tr
                    key={section.id}
                    onClick={() => sectionRefs.current?.[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                    className="group hover:bg-slate-50 transition-colors"
                  >
                    <td style={{ padding: '12px 0', width: 36 }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#cbd5e1' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px 12px 0', flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{section.title}</p>
                      {section.description && (
                        <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{section.description}</p>
                      )}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {populated ? (
                          <CheckCircle2 size={11} style={{ color: '#10b981' }} />
                        ) : (
                          <AlertTriangle size={11} style={{ color: '#f59e0b' }} />
                        )}
                        <span style={{ fontSize: 10, fontWeight: 600, color: populated ? '#64748b' : '#f59e0b' }}>
                          {count} {count === 1 ? 'document' : 'documents'}
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <PageFooter manual={manual} project={project} />
    </div>
  );
}

// ─── Section chapter opener ───────────────────────────────────────────────────

function SectionChapterPage({
  section, items, index, manual, project,
}: {
  section: DBOAndMSection;
  items: DBOAndMItem[];
  index: number;
  manual: DBOAndMManual;
  project: Project;
}) {
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="bg-white relative overflow-hidden" style={{ padding: '56px 80px 48px' }}>
      {/* Large decorative section number — sits behind content */}
      <div style={{
        position: 'absolute', right: 56, top: 24,
        fontSize: 180, fontWeight: 900, color: '#f8fafc',
        lineHeight: 0.85, letterSpacing: '-0.05em',
        userSelect: 'none', pointerEvents: 'none',
      }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      <div style={{ position: 'relative' }}>
        {/* Section label */}
        <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.28em', color: '#94a3b8', marginBottom: 14 }}>
          Section {index + 1}
        </p>

        {/* Section title */}
        <h3 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 12, maxWidth: 480 }}>
          {section.title}
        </h3>

        {/* Accent rule */}
        <div style={{ width: 48, height: 3, background: '#0f172a', marginBottom: 16 }} />

        {/* Description */}
        {section.description && (
          <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, maxWidth: 440, marginBottom: 20 }}>
            {section.description}
          </p>
        )}

        {/* Mini document TOC */}
        {sortedItems.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#94a3b8', marginBottom: 10 }}>
              Documents in this section
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sortedItems.map((item, i) => {
                const Icon = SOURCE_ICON[item.source_module];
                const textCol = SOURCE_BADGE_TEXT[item.source_module];
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#e2e8f0', width: 16 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <Icon size={10} className={textCol} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{item.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sortedItems.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
            <AlertTriangle size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>No documents have been added to this section.</p>
          </div>
        )}
      </div>

      <PageFooter manual={manual} project={project} />
    </div>
  );
}

// ─── Document intro page (for uploaded Project Documents) ─────────────────────

function ProjectDocumentIntro({
  item, doc, manual, project,
}: {
  item: DBOAndMItem;
  doc: DBProjectDocument | undefined;
  manual: DBOAndMManual;
  project: Project;
}) {
  const categoryLabel = (doc?.category || item.subtitle?.split(' · ')[0] || SOURCE_MODULE_LABELS[item.source_module]).toUpperCase();
  const displayName = doc ? docDisplayName(doc) : item.title;
  const fileExt = doc?.name ? doc.name.split('.').pop()?.toUpperCase() : undefined;

  return (
    <div className="bg-white" style={{ padding: '44px 80px 36px', borderTop: '1px solid #e2e8f0' }}>
      {/* Category / source label */}
      <p style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.28em', color: '#94a3b8', marginBottom: 16 }}>
        {categoryLabel}
      </p>

      {/* Document title */}
      <h4 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', lineHeight: 1.25, letterSpacing: '-0.01em', marginBottom: 6, maxWidth: 520 }}>
        {displayName}
      </h4>

      {/* Metadata row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, marginBottom: 0 }}>
        {fileExt && (
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 8px' }}>
            {fileExt}
          </span>
        )}
        {doc?.uploaded_by && (
          <span style={{ fontSize: 10, color: '#94a3b8' }}>Provided by {doc.uploaded_by}</span>
        )}
        {doc?.created_at && (
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{fmtDateShort(doc.created_at)}</span>
        )}
      </div>

      {/* Curator notes */}
      {item.notes && (
        <p style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', lineHeight: 1.65, borderLeft: '2px solid #e2e8f0', paddingLeft: 12, marginTop: 16, maxWidth: 480 }}>
          {item.notes}
        </p>
      )}

      <PageFooter manual={manual} project={project} />
    </div>
  );
}

// ─── Inline record separator (for forms / TC records — they carry their own header) ──

function InlineRecordSeparator({ item }: { item: DBOAndMItem }) {
  const Icon = SOURCE_ICON[item.source_module];
  const textCol = SOURCE_BADGE_TEXT[item.source_module];

  return (
    <div style={{ padding: '14px 80px', background: '#fafafa', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon size={11} className={textCol} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#94a3b8' }}>
        {SOURCE_MODULE_LABELS[item.source_module]}
      </span>
      {item.notes && (
        <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', borderLeft: '1px solid #e2e8f0', paddingLeft: 8, marginLeft: 4 }}>
          {item.notes}
        </span>
      )}
    </div>
  );
}

// ─── Project document block ───────────────────────────────────────────────────

function ProjectDocumentBlock({ item, manual, project }: {
  item: DBOAndMItem;
  manual: DBOAndMManual;
  project: Project;
}) {
  const store = useAppStore();
  const doc = store.projectDocuments.find(d => d.id === item.source_record_id);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfHeight, setPdfHeight] = useState<number>(1122);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDoc = useCallback(async () => {
    if (!doc || loading || blobUrl) return;
    setLoading(true);
    try {
      let dataUrl = doc.data_url;
      if (!dataUrl) {
        const { data } = await supabase.from('vy_project_documents').select('id,data_url').eq('id', doc.id).maybeSingle();
        dataUrl = data?.data_url ?? undefined;
      }
      if (!dataUrl) { setError('Document data not available.'); return; }
      const cat = mimeCategory(doc.type);
      if (cat === 'pdf') {
        const { pageCount, aspectRatio } = await pdfMetrics(dataUrl);
        // 210mm = 794px at 96dpi; height per page = width * aspect ratio
        setPdfHeight(Math.round(794 * aspectRatio * pageCount));
        setBlobUrl(dataUrlToBlob(dataUrl, doc.type));
      } else if (cat === 'image') {
        setBlobUrl(dataUrlToBlob(dataUrl, doc.type));
      } else {
        setBlobUrl('__placeholder__');
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
      <div className="bg-white" style={{ borderTop: '1px solid #e2e8f0' }}>
        <ProjectDocumentIntro item={item} doc={undefined} manual={manual} project={project} />
        <div style={{ padding: '32px 80px', background: '#fafafa', textAlign: 'center' }}>
          <AlertTriangle size={18} style={{ color: '#f59e0b', display: 'block', margin: '0 auto 8px' }} />
          <p style={{ fontSize: 12, color: '#94a3b8' }}>Document not found in this project.</p>
        </div>
      </div>
    );
  }

  const cat = mimeCategory(doc.type);
  const displayName = docDisplayName(doc);

  return (
    <div className="bg-white" style={{ borderTop: '1px solid #e2e8f0' }}>
      <ProjectDocumentIntro item={item} doc={doc} manual={manual} project={project} />

      {loading && (
        <div style={{ padding: '40px 80px', background: '#fafafa', textAlign: 'center' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #e2e8f0', borderTopColor: '#64748b', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
          <p style={{ fontSize: 11, color: '#94a3b8' }}>Loading {displayName}…</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: '24px 80px', background: '#fef2f2', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#ef4444' }}>{error}</p>
        </div>
      )}

      {/* PDF — embedded at full calculated height, viewer chrome suppressed */}
      {!loading && !error && blobUrl && blobUrl !== '__placeholder__' && cat === 'pdf' && (
        <embed
          src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          type="application/pdf"
          style={{ width: '100%', height: pdfHeight, display: 'block', border: 'none' }}
        />
      )}

      {/* Image — full width, proportional */}
      {!loading && !error && blobUrl && blobUrl !== '__placeholder__' && cat === 'image' && (
        <div style={{ background: 'white', padding: '32px 80px 40px' }}>
          <img
            src={blobUrl}
            alt={displayName}
            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain', maxHeight: '280mm' }}
          />
          <p style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', marginTop: 12, fontStyle: 'italic' }}>
            {displayName}
          </p>
        </div>
      )}

      {/* Office / unsupported */}
      {!loading && !error && (cat === 'office' || blobUrl === '__placeholder__') && (
        <UnsupportedDocBlock doc={doc} displayName={displayName} />
      )}
    </div>
  );
}

function UnsupportedDocBlock({ doc, displayName }: {
  doc: { name: string; type: string };
  displayName: string;
}) {
  const ext = doc.name.split('.').pop()?.toUpperCase() ?? 'FILE';
  const isSheet = doc.type.includes('sheet') || doc.type.includes('excel') || doc.type.includes('spreadsheet');
  const Icon = isSheet ? FileSpreadsheet : doc.type.startsWith('image/') ? FileImage : FileIcon;

  return (
    <div style={{ padding: '36px 80px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <Icon size={22} style={{ color: '#94a3b8' }} />
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 4 }}>{displayName}</p>
      <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 16 }}>{ext} document — embedded preview not available in browser</p>
      <p style={{ fontSize: 9, color: '#cbd5e1' }}>This document is included in the manual and available for download.</p>
    </div>
  );
}

// ─── Site form block ──────────────────────────────────────────────────────────

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
  const [iframeHeight, setIframeHeight] = useState(560);

  const orgSettings: OrgSettings = { company_name: orgInfo.companyName, logo_data_url: orgInfo.logoDataUrl };

  useEffect(() => {
    if (!form) return;
    const formWithAtts = { ...form, attachments: formAttachments };
    const html = buildFormPageHTML(formWithAtts as ExtendedSiteForm, orgSettings);
    // Wrap in minimal shell that shares the same white background
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>*{box-sizing:border-box;margin:0;padding:0}body{background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${html}</body></html>`;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    const onLoad = () => {
      try {
        const h = iframe.contentDocument?.body?.scrollHeight;
        if (h && h > 200) setIframeHeight(h + 24);
      } catch { /* cross-origin guard */ }
      URL.revokeObjectURL(url);
    };
    iframe.addEventListener('load', onLoad, { once: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id]);

  if (!form) {
    return (
      <div style={{ borderTop: '1px solid #e2e8f0' }}>
        <InlineRecordSeparator item={item} />
        <div style={{ padding: '32px 80px', background: '#fafafa', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>Site form not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderTop: '1px solid #e2e8f0' }}>
      <InlineRecordSeparator item={item} />
      <iframe
        ref={iframeRef}
        title={item.title}
        style={{ width: '100%', height: iframeHeight, display: 'block', border: 'none', background: 'white' }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

// ─── TC record block ──────────────────────────────────────────────────────────

function TCRecordBlock({ item, manual, project, orgInfo }: {
  item: DBOAndMItem;
  manual: DBOAndMManual;
  project: Project;
  orgInfo: OrgInfo;
}) {
  const store = useAppStore();
  const record = store.tcRecords.find(r => r.id === item.source_record_id);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(420);

  const orgSettings: OrgSettings = { company_name: orgInfo.companyName, logo_data_url: orgInfo.logoDataUrl };

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
        if (h && h > 200) setIframeHeight(h + 24);
      } catch { /* cross-origin guard */ }
      URL.revokeObjectURL(url);
    };
    iframe.addEventListener('load', onLoad, { once: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  if (!record) {
    return (
      <div style={{ borderTop: '1px solid #e2e8f0' }}>
        <InlineRecordSeparator item={item} />
        <div style={{ padding: '32px 80px', background: '#fafafa', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>T&C record not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderTop: '1px solid #e2e8f0' }}>
      <InlineRecordSeparator item={item} />
      <iframe
        ref={iframeRef}
        title={item.title}
        style={{ width: '100%', height: iframeHeight, display: 'block', border: 'none', background: 'white' }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

// ─── Full section block ───────────────────────────────────────────────────────

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
    <div ref={refCallback} className="bg-white">
      <SectionChapterPage
        section={section}
        items={sortedItems}
        index={index}
        manual={manual}
        project={project}
      />

      {sortedItems.map(item => {
        if (item.source_module === 'project_document') {
          return <ProjectDocumentBlock key={item.id} item={item} manual={manual} project={project} />;
        }
        if (item.source_module === 'site_form') {
          return <SiteFormBlock key={item.id} item={item} manual={manual} project={project} orgInfo={orgInfo} />;
        }
        if (item.source_module === 'tc_record') {
          return <TCRecordBlock key={item.id} item={item} manual={manual} project={project} orgInfo={orgInfo} />;
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
            <><CheckCircle2 size={13} className="text-emerald-500 shrink-0" /><p className="text-[11px] font-semibold text-emerald-700">All sections populated</p></>
          ) : (
            <><AlertTriangle size={13} className="text-amber-400 shrink-0" /><p className="text-[11px] font-semibold text-amber-600">{empty} empty section{empty !== 1 ? 's' : ''} — manual incomplete</p></>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Print HTML builder ───────────────────────────────────────────────────────

function buildPrintManualHTML(
  manual: DBOAndMManual,
  sections: DBOAndMSection[],
  items: DBOAndMItem[],
  project: Project,
  orgInfo: OrgInfo,
  siteForms: ExtendedSiteForm[],
  tcRecords: { id: string; category: string; ref: string; title: string; area: string; engineer: string; date: string; status: string; result?: string; notes: string; files: unknown[] }[],
  projectDocs: { id: string; name: string; doc_title?: string; type: string; data_url?: string; category?: string; uploaded_by?: string; created_at?: string }[],
  attachments: { linked_id: string; data_url: string; name: string; type: string }[],
): string {
  const orgSettings: OrgSettings = { company_name: orgInfo.companyName, logo_data_url: orgInfo.logoDataUrl };
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const coverHtml = `
    <div style="page-break-after:always;padding:56px 80px;min-height:297mm;box-sizing:border-box;display:flex;flex-direction:column;background:white;border-bottom:3px solid #0f172a">
      <div style="height:3px;background:linear-gradient(to right,#0f172a,#334155);margin:-56px -80px 52px;"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:72px">
        ${orgInfo.logoDataUrl
          ? `<img src="${orgInfo.logoDataUrl}" style="height:44px;max-width:180px;object-fit:contain" alt="${esc(orgInfo.companyName)}" />`
          : `<div style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.01em">${esc(orgInfo.companyName)}</div>`
        }
        <div style="font-size:9px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;padding:5px 14px;border:1.5px solid #cbd5e1;border-radius:4px;color:#64748b">
          ${esc(STATUS_LABEL[manual.status])}
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
        <div style="border-left:5px solid #0f172a;padding-left:32px;margin-bottom:40px">
          <div style="font-size:9px;letter-spacing:0.28em;text-transform:uppercase;color:#94a3b8;font-weight:800;margin-bottom:12px">Operation &amp; Maintenance Manual</div>
          <div style="font-size:38px;font-weight:900;color:#0f172a;line-height:1.15;letter-spacing:-0.02em;margin-bottom:8px">${esc(manual.title)}</div>
          ${manual.version ? `<div style="font-size:13px;color:#64748b;font-weight:600">${esc(manual.version)}</div>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 48px;max-width:520px">
          ${([['Project', project.name], ['Client', project.client || '—'], ['Location', project.location || '—'], ['Project Manager', project.projectManager || '—'], ['Contractor', orgInfo.companyName || '—'], ['Date', today]] as [string, string][]).map(([l, v]) =>
            `<div style="padding-bottom:14px;border-bottom:1px solid #f1f5f9;margin-bottom:0">
              <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.2em;color:#94a3b8;font-weight:700;margin-bottom:3px">${esc(l)}</div>
              <div style="font-size:13px;font-weight:700;color:#1e293b">${esc(v)}</div>
            </div>`
          ).join('')}
        </div>
      </div>
      <div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:40px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:9px;color:#94a3b8">Prepared by ${esc(manual.created_by || orgInfo.companyName || '')}</span>
        <span style="font-size:8px;color:#cbd5e1">Powered by VYSITE® | © VYSITE Ltd. All Rights Reserved.</span>
      </div>
    </div>`;

  const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  const contentsRows = sorted.map((s, idx) => {
    const count = items.filter(i => i.section_id === s.id).length;
    return `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:12px 0;font-size:10px;font-weight:700;color:#e2e8f0;font-family:monospace;width:32px">${String(idx + 1).padStart(2, '0')}</td>
      <td style="padding:12px 16px 12px 0">
        <div style="font-size:13px;font-weight:600;color:#1e293b">${esc(s.title)}</div>
        ${s.description ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px">${esc(s.description)}</div>` : ''}
      </td>
      <td style="padding:12px 0;text-align:right;font-size:10px;font-weight:600;color:#64748b;white-space:nowrap">${count} doc${count !== 1 ? 's' : ''}</td>
    </tr>`;
  }).join('');

  const contentsHtml = `
    <div style="page-break-after:always;padding:56px 80px;background:white;box-sizing:border-box">
      <div style="margin-bottom:40px">
        <div style="font-size:9px;letter-spacing:0.28em;text-transform:uppercase;color:#94a3b8;font-weight:700;margin-bottom:8px">Table of</div>
        <div style="font-size:28px;font-weight:900;color:#0f172a;letter-spacing:-0.02em">Contents</div>
        <div style="width:48px;height:3px;background:#0f172a;margin-top:10px"></div>
      </div>
      <table style="width:100%;border-collapse:collapse"><tbody>${contentsRows}</tbody></table>
      <div style="margin-top:48px;border-top:1px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between">
        <span style="font-size:8px;color:#94a3b8">${esc(project.name)} · ${esc(manual.title)}</span>
        <span style="font-size:8px;color:#cbd5e1">Powered by VYSITE® | © VYSITE Ltd. All Rights Reserved.</span>
      </div>
    </div>`;

  const sectionBlocks = sorted.map((section, idx) => {
    const sItems = items.filter(i => i.section_id === section.id).sort((a, b) => a.sort_order - b.sort_order);

    const chapterPage = `
      <div style="page-break-before:always;padding:56px 80px 48px;background:white;box-sizing:border-box;border-bottom:3px solid #0f172a;position:relative;overflow:hidden">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.28em;color:#94a3b8;margin-bottom:14px">Section ${idx + 1}</div>
        <div style="font-size:30px;font-weight:900;color:#0f172a;line-height:1.15;letter-spacing:-0.02em;margin-bottom:12px;max-width:480px">${esc(section.title)}</div>
        <div style="width:48px;height:3px;background:#0f172a;margin-bottom:16px"></div>
        ${section.description ? `<div style="font-size:12px;color:#64748b;line-height:1.7;max-width:440px;margin-bottom:20px">${esc(section.description)}</div>` : ''}
        ${sItems.length > 0 ? `
          <div style="margin-top:24px">
            <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:#94a3b8;margin-bottom:10px">Documents in this section</div>
            ${sItems.map((item, i) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <span style="font-size:9px;font-family:monospace;color:#e2e8f0;width:16px">${String(i + 1).padStart(2, '0')}</span>
              <span style="font-size:11px;color:#475569;font-weight:500">${esc(item.title)}</span>
            </div>`).join('')}
          </div>` : ''}
        <div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between">
          <span style="font-size:8px;color:#94a3b8">${esc(project.name)} · ${esc(manual.title)}</span>
          <span style="font-size:8px;color:#cbd5e1">Powered by VYSITE® | © VYSITE Ltd. All Rights Reserved.</span>
        </div>
      </div>`;

    const docBlocks = sItems.map(item => {
      if (item.source_module === 'site_form') {
        const form = siteForms.find(f => f.id === item.source_record_id);
        if (!form) return `<div style="padding:24px 80px;border-top:1px solid #e2e8f0;background:#fafafa;font-size:11px;color:#94a3b8">Form not found: ${esc(item.title)}</div>`;
        const formAtts = attachments.filter(a => a.linked_id === item.source_record_id);
        const body = buildFormPageHTML({ ...form, attachments: formAtts } as ExtendedSiteForm, orgSettings);
        return `
          <div style="border-top:1px solid #e2e8f0">
            <div style="padding:12px 80px;background:#fafafa;display:flex;align-items:center;gap:8px">
              <span style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:#94a3b8">Site Form</span>
            </div>
            <div style="page-break-inside:avoid">${body}</div>
          </div>`;
      }

      if (item.source_module === 'tc_record') {
        const rec = tcRecords.find(r => r.id === item.source_record_id);
        if (!rec) return `<div style="padding:24px 80px;border-top:1px solid #e2e8f0;background:#fafafa;font-size:11px;color:#94a3b8">Record not found: ${esc(item.title)}</div>`;
        const bodyMatch = buildTCRecordHTML(rec, orgSettings).match(/<body>([\s\S]*)<\/body>/);
        const recBody = bodyMatch ? bodyMatch[1] : '';
        return `
          <div style="border-top:1px solid #e2e8f0">
            <div style="padding:12px 80px;background:#fafafa;display:flex;align-items:center;gap:8px">
              <span style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:#94a3b8">T&amp;C Record</span>
            </div>
            <div style="page-break-inside:avoid">${recBody}</div>
          </div>`;
      }

      if (item.source_module === 'project_document') {
        const doc = projectDocs.find(d => d.id === item.source_record_id);
        const displayName = doc ? docDisplayName(doc) : item.title;
        const catLabel = (doc?.category || SOURCE_MODULE_LABELS[item.source_module]).toUpperCase();
        const introBlock = `
          <div style="padding:40px 80px 32px;border-top:1px solid #e2e8f0;background:white">
            <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.28em;color:#94a3b8;margin-bottom:14px">${esc(catLabel)}</div>
            <div style="font-size:20px;font-weight:900;color:#0f172a;line-height:1.25;margin-bottom:6px">${esc(displayName)}</div>
            ${doc?.uploaded_by ? `<div style="font-size:10px;color:#94a3b8;margin-bottom:4px">Provided by ${esc(doc.uploaded_by)}</div>` : ''}
            ${item.notes ? `<div style="font-size:11px;color:#475569;font-style:italic;border-left:2px solid #e2e8f0;padding-left:12px;margin-top:12px;line-height:1.65">${esc(item.notes)}</div>` : ''}
            <div style="margin-top:24px;border-top:1px solid #f1f5f9;padding-top:10px;display:flex;justify-content:space-between">
              <span style="font-size:8px;color:#94a3b8">${esc(project.name)} · ${esc(manual.title)}</span>
              <span style="font-size:8px;color:#cbd5e1">Powered by VYSITE® | © VYSITE Ltd. All Rights Reserved.</span>
            </div>
          </div>`;

        if (!doc?.data_url) {
          // data_url not available (shouldn't happen after async pre-fetch, but handle gracefully)
          return introBlock + `
            <div style="margin:0 80px 32px;padding:32px 40px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center">
              <div style="font-size:11px;font-weight:600;color:#334155;margin-bottom:4px">${esc(displayName)}</div>
              <div style="font-size:10px;color:#94a3b8">Document data unavailable — view in interactive preview.</div>
            </div>`;
        }
        const cat = mimeCategory(doc.type);
        if (cat === 'image') {
          // Images embed directly as data: URIs — full-width, high quality
          return introBlock + `
            <div style="padding:24px 80px 40px;background:white;page-break-inside:avoid">
              <img src="${doc.data_url}" style="width:100%;height:auto;max-height:200mm;object-fit:contain;display:block" alt="${esc(displayName)}" />
              <p style="font-size:9px;color:#94a3b8;text-align:center;margin-top:10px;font-style:italic">${esc(displayName)}</p>
            </div>`;
        }
        // PDF: binary PDF data cannot be rendered inside an HTML print document.
        // Show a professional full-page placeholder that matches the manual's design language.
        const ext = doc.name.split('.').pop()?.toUpperCase() ?? 'PDF';
        const fileSizeKb = 'size' in doc && typeof (doc as Record<string, unknown>).size === 'number'
          ? Math.round((doc as Record<string, unknown>).size as number / 1024)
          : null;
        return introBlock + `
          <div style="page-break-inside:avoid;margin:0;padding:48px 80px 56px;background:white;border-top:1px solid #f1f5f9">
            <div style="max-width:480px;margin:0 auto;text-align:center">
              <div style="width:64px;height:64px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:18px;font-weight:900;color:#94a3b8;letter-spacing:0.05em">${esc(ext)}</div>
              <div style="font-size:16px;font-weight:800;color:#1e293b;margin-bottom:6px;line-height:1.3">${esc(displayName)}</div>
              ${doc.category ? `<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#94a3b8;margin-bottom:16px">${esc(doc.category)}</div>` : `<div style="margin-bottom:16px"></div>`}
              ${fileSizeKb ? `<div style="font-size:10px;color:#94a3b8;margin-bottom:20px">${fileSizeKb} KB · ${esc(ext)} document</div>` : ''}
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px">
                <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin-bottom:6px">Document included</div>
                <div style="font-size:11px;color:#475569;line-height:1.6">This ${esc(ext)} document is part of this O&amp;M Manual. Open the interactive preview to view the full embedded document. To issue the complete manual with embedded PDFs, print directly from the interactive preview.</div>
              </div>
            </div>
          </div>`;
      }

      return '';
    }).join('');

    return chapterPage + docBlocks;
  }).join('');

  const endPage = `
    <div style="padding:56px 80px;text-align:center;background:white">
      <div style="width:48px;height:2px;background:#e2e8f0;margin:0 auto 24px"></div>
      <div style="font-size:9px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">End of Document</div>
      <div style="font-size:18px;font-weight:900;color:#1e293b;margin-bottom:4px">${esc(manual.title)}</div>
      ${manual.version ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${esc(manual.version)}</div>` : ''}
      <div style="font-size:11px;color:#94a3b8;margin-bottom:24px">${esc(project.name)}</div>
      <div style="width:48px;height:2px;background:#e2e8f0;margin:0 auto 20px"></div>
      <div style="font-size:8px;color:#e2e8f0">Powered by VYSITE® | © VYSITE Ltd. All Rights Reserved.</div>
    </div>`;

  // Common CSS for print including form renderer classes
  const printCSS = `
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: white; color: #1e293b; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { margin: 0; size: A4; }
    .page { max-width: 860px; margin: 0 auto; padding: 36px 40px; }
    .doc-header { display:flex; align-items:flex-start; justify-content:space-between; padding-bottom:14px; border-bottom:3px solid #f97316; margin-bottom:20px; }
    .doc-logo-img { height:38px; max-width:160px; display:block; margin-bottom:4px; }
    .doc-logo-text { font-size:22px; font-weight:900; color:#f97316; letter-spacing:0.05em; }
    .doc-type-label { font-size:10px; color:#64748b; margin-top:4px; }
    .doc-header-right { text-align:right; }
    .doc-title { font-size:18px; font-weight:900; color:#111; margin-bottom:4px; line-height:1.25; max-width:380px; }
    .doc-dateline { font-size:11px; color:#64748b; }
    .doc-subtitle-bar { font-size:11px; color:#64748b; margin-bottom:18px; padding-bottom:10px; border-bottom:1px solid #e2e8f0; }
    .status-badge { display:inline-block; font-size:9px; font-weight:700; padding:2px 9px; border-radius:20px; text-transform:uppercase; letter-spacing:0.05em; margin-left:6px; vertical-align:middle; }
    .status-submitted { background:#dbeafe; color:#1d4ed8; } .status-approved { background:#d1fae5; color:#065f46; } .status-draft { background:#f1f5f9; color:#475569; } .status-issued { background:#e0f2fe; color:#0369a1; } .status-open { background:#fef9c3; color:#854d0e; } .status-other { background:#f1f5f9; color:#475569; }
    .meta-block { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px; margin-bottom:20px; }
    .meta-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px 20px; } .meta-grid-2 { grid-template-columns:repeat(2,1fr); } .meta-grid-4 { grid-template-columns:repeat(4,1fr); }
    .meta-label { font-size:8px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:3px; }
    .meta-value { font-size:11px; font-weight:600; color:#0f172a; }
    .result-block { display:flex; align-items:center; justify-content:space-between; border-radius:8px; padding:12px 18px; margin:14px 0; page-break-inside:avoid; }
    .result-pass { background:#f0fdf4; border:1.5px solid #86efac; } .result-fail { background:#fef2f2; border:1.5px solid #fca5a5; } .result-other { background:#fffbeb; border:1.5px solid #fcd34d; }
    .result-label { font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.08em; }
    .result-value-pass { font-size:14px; font-weight:800; color:#16a34a; } .result-value-fail { font-size:14px; font-weight:800; color:#dc2626; } .result-value-other { font-size:14px; font-weight:800; color:#d97706; }
    .section { margin-top:20px; page-break-inside:avoid; }
    .section-heading { font-size:8.5px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; padding-bottom:6px; border-bottom:1.5px solid #e2e8f0; margin-bottom:10px; }
    .section-content { font-size:11px; color:#334155; line-height:1.65; white-space:pre-wrap; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px; }
    .data-table { width:100%; border-collapse:collapse; font-size:10px; margin-top:2px; }
    .data-table th { padding:8px 10px; text-align:left; font-size:9px; font-weight:700; color:#334155; text-transform:uppercase; letter-spacing:0.05em; background:#f1f5f9; border-bottom:2px solid #e2e8f0; }
    .data-table td { padding:8px 10px; border-bottom:1px solid #f1f5f9; color:#1e293b; vertical-align:top; }
    .data-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1px; background:#e2e8f0; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-top:2px; } .data-grid-3 { grid-template-columns:repeat(3,1fr); }
    .data-cell { background:white; padding:9px 12px; } .data-cell-label { font-size:8px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:3px; } .data-cell-value { font-size:11px; font-weight:600; color:#0f172a; }
    .risk-low { background:#dcfce7; color:#166534; border-radius:20px; padding:2px 10px; font-size:9px; font-weight:700; display:inline-block; }
    .risk-medium { background:#fef9c3; color:#854d0e; border-radius:20px; padding:2px 10px; font-size:9px; font-weight:700; display:inline-block; }
    .risk-high { background:#fed7aa; color:#9a3412; border-radius:20px; padding:2px 10px; font-size:9px; font-weight:700; display:inline-block; }
    .risk-critical { background:#fee2e2; color:#991b1b; border-radius:20px; padding:2px 10px; font-size:9px; font-weight:700; display:inline-block; }
    .hazard-card { border:1px solid #e2e8f0; border-radius:8px; margin-bottom:12px; overflow:hidden; page-break-inside:avoid; }
    .hazard-header { background:#f8fafc; padding:9px 14px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; }
    .hazard-body { padding:10px 14px; }
    .hazard-row { display:grid; grid-template-columns:140px 1fr; gap:8px; margin-bottom:6px; font-size:10px; }
    .hazard-row-label { font-size:9px; font-weight:700; color:#94a3b8; text-transform:uppercase; padding-top:1px; }
    .hazard-controls { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:5px; padding:8px 10px; margin-top:8px; font-size:10px; color:#166534; }
    .checklist-row { display:grid; grid-template-columns:1fr 80px; gap:8px; align-items:center; padding:6px 0; border-bottom:1px solid #f1f5f9; font-size:10px; }
    .badge-pass { background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:20px; font-size:8.5px; font-weight:700; }
    .badge-fail { background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:20px; font-size:8.5px; font-weight:700; }
    .badge-na { background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:20px; font-size:8.5px; font-weight:700; }
    .badge-action { background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:20px; font-size:8.5px; font-weight:700; margin-left:4px; }
    .evidence-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:8px; }
    .evidence-item { border:1px solid #e2e8f0; border-radius:5px; overflow:hidden; page-break-inside:avoid; }
    .evidence-img { width:100%; height:110px; object-fit:cover; display:block; background:#f8fafc; }
    .evidence-caption { padding:3px 6px; font-size:7.5px; color:#64748b; background:#f8fafc; border-top:1px solid #e2e8f0; }
    .signoff-table { width:100%; border-collapse:collapse; font-size:10px; }
    .signoff-table th { background:#f1f5f9; padding:8px 10px; text-align:left; font-size:9px; font-weight:700; color:#334155; text-transform:uppercase; border-bottom:2px solid #e2e8f0; }
    .signoff-table td { padding:8px 10px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    .sig-box { min-width:90px; height:28px; border-bottom:1px solid #cbd5e1; }
    .legal-footer { margin-top:28px; border-top:2px solid #e2e8f0; page-break-inside:avoid; }
    .legal-footer-header { display:flex; align-items:center; justify-content:space-between; padding:10px 0 8px; }
    .legal-footer-title { font-size:8px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.1em; }
    .legal-footer-ref { font-size:8px; color:#94a3b8; }
    .legal-notice-bar { background:#fffbf5; border:1px solid #fed7aa; border-left:3px solid #f97316; border-radius:6px; padding:10px 14px; margin-bottom:8px; }
    .legal-notice-label { font-size:7.5px; font-weight:800; color:#c2410c; text-transform:uppercase; letter-spacing:0.09em; margin-bottom:3px; }
    .legal-notice-text { font-size:8.5px; color:#92400e; line-height:1.65; }
    .legal-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; }
    .legal-cell { background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:8px 12px; }
    .legal-cell-label { font-size:7.5px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:3px; }
    .legal-cell-text { font-size:8.5px; color:#475569; line-height:1.6; }
    .legal-branding { display:flex; align-items:center; justify-content:space-between; padding-top:8px; border-top:1px solid #e2e8f0; }
    .legal-branding-left { font-size:8px; color:#94a3b8; }
    .legal-branding-right { font-size:8px; color:#94a3b8; text-align:right; }
  `;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(manual.title)} — ${esc(project.name)}</title><style>${printCSS}</style></head><body>${coverHtml}${contentsHtml}${sectionBlocks}${endPage}<script>window.onload=function(){window.print();};<\/script></body></html>`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OAndMPreview({ manual, sections, items, project, orgInfo, onClose }: Props) {
  const store = useAppStore();
  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  const sectionEls = useRef<HTMLDivElement[]>([]);
  const [downloading, setDownloading] = useState(false);

  const setSectionRef = (idx: number) => (el: HTMLDivElement | null) => {
    if (el) sectionEls.current[idx] = el;
  };

  // Pre-fetch data_url for every project document referenced in this manual before
  // building the print HTML. store.projectDocuments intentionally excludes data_url
  // (it is lazy-loaded per document in the preview), so we must fetch them here.
  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const docItemIds = items
        .filter(i => i.source_module === 'project_document')
        .map(i => i.source_record_id);

      // Build a map of id -> data_url, fetching from Supabase for any not yet in store
      const dataUrlMap = new Map<string, string>();
      for (const id of docItemIds) {
        const cached = store.projectDocuments.find(d => d.id === id);
        if (cached?.data_url) {
          dataUrlMap.set(id, cached.data_url);
        } else {
          const { data } = await supabase
            .from('vy_project_documents')
            .select('id,data_url')
            .eq('id', id)
            .maybeSingle();
          if (data?.data_url) dataUrlMap.set(id, data.data_url);
        }
      }

      // Merge fetched data_urls back into the docs array for the builder
      const docsWithData = store.projectDocuments.map(d => ({
        ...d,
        data_url: dataUrlMap.get(d.id) ?? d.data_url,
      }));

      const html = buildPrintManualHTML(
        manual, sortedSections, items, project, orgInfo,
        store.siteForms as ExtendedSiteForm[],
        store.tcRecords,
        docsWithData,
        store.attachments,
      );
      openPrintTab(html);
    } finally {
      setDownloading(false);
    }
  }, [manual, sortedSections, items, project, orgInfo, store]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0a1628' }}>
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3" style={{ background: '#0d1628', borderBottom: '1px solid #1e2d4a' }}>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
            <FileText size={12} style={{ color: '#f97316' }} />
          </div>
          <div>
            <p className="text-xs font-bold text-white">{manual.title}</p>
            <p className="text-[10px]" style={{ color: '#475569' }}>{project.name} · Preview Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] hidden sm:block" style={{ color: '#475569' }}>
            {sortedSections.length} section{sortedSections.length !== 1 ? 's' : ''} · {items.length} document{items.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: '#f97316' }}
            onMouseEnter={e => { if (!downloading) (e.currentTarget.style.background = '#ea6c0a'); }}
            onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}
          >
            {downloading ? (
              <>
                <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                Preparing…
              </>
            ) : (
              <>
                <Download size={12} />
                Download PDF
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
            style={{ color: '#64748b', background: '#1a2236', border: '1px solid #1e2d4a' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = '#1e2d4a'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748b'; (e.currentTarget as HTMLElement).style.background = '#1a2236'; }}
          >
            <X size={12} /> Close
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 overflow-y-auto p-4 space-y-3 hidden lg:block" style={{ borderRight: '1px solid #1e2d4a' }}>
          <ReadinessPanel sections={sortedSections} items={items} />
          {sortedSections.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#111827', border: '1px solid #1e2d4a' }}>
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #1e2d4a' }}>
                <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#475569' }}>Sections</p>
              </div>
              <nav className="py-1">
                {sortedSections.map((s, idx) => {
                  const count = items.filter(i => i.section_id === s.id).length;
                  return (
                    <button
                      key={s.id}
                      onClick={() => sectionEls.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left transition-colors group"
                      style={{ hover: undefined }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1a2236')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#334155', width: 16, flexShrink: 0 }}>{String(idx + 1).padStart(2, '0')}</span>
                      <span className="flex-1 truncate" style={{ fontSize: 11, color: '#475569' }}>{s.title}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, flexShrink: 0, color: count > 0 ? '#10b981' : '#f59e0b' }}>{count}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </aside>

        {/* Document scroll area — grey surround, white pages */}
        <div className="flex-1 overflow-y-auto" style={{ background: '#d1d5db', padding: '32px 24px' }}>
          {/* Spin keyframe — injected inline for loading spinner */}
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

          <div style={{ maxWidth: '210mm', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0, boxShadow: '0 4px 40px rgba(0,0,0,0.18)' }}>
            {/* Cover */}
            <CoverPage manual={manual} project={project} orgInfo={orgInfo} />

            {/* Contents */}
            <ContentsPage
              manual={manual}
              sections={sortedSections}
              items={items}
              project={project}
              sectionRefs={sectionEls}
            />

            {/* Sections — all flow as one continuous document */}
            {sortedSections.map((section, idx) => (
              <SectionBlock
                key={section.id}
                section={section}
                items={items.filter(i => i.section_id === section.id)}
                index={idx}
                manual={manual}
                project={project}
                orgInfo={orgInfo}
                refCallback={setSectionRef(idx)}
              />
            ))}

            {sortedSections.length === 0 && (
              <div className="bg-white flex flex-col items-center justify-center" style={{ minHeight: 240, padding: '48px 80px' }}>
                <AlertTriangle size={22} style={{ color: '#f59e0b', marginBottom: 12 }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textAlign: 'center', marginBottom: 6 }}>No sections added yet.</p>
                <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>Return to the workspace to add sections and documents.</p>
              </div>
            )}

            {/* End of document */}
            <div className="bg-white" style={{ padding: '56px 80px', textAlign: 'center', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ width: 48, height: 1, background: '#e2e8f0', margin: '0 auto 24px' }} />
              <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#94a3b8', marginBottom: 8 }}>End of Document</p>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#1e293b', marginBottom: 4 }}>{manual.title}</p>
              {manual.version && <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{manual.version}</p>}
              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 24 }}>{project.name}</p>
              <div style={{ width: 48, height: 1, background: '#e2e8f0', margin: '0 auto 20px' }} />
              <p style={{ fontSize: 8, color: '#e2e8f0' }}>Powered by VYSITE® &nbsp;|&nbsp; © VYSITE Ltd. All Rights Reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
