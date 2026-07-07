/**
 * FormHtmlRenderer
 *
 * Renders a VYSITE form's standalone HTML output (from buildStandaloneFormHtml)
 * into PDF bytes using html2canvas.
 *
 * Used by the standalone site-form "Export PDF" button and by the O&M builder,
 * which merges the resulting PDF pages directly into the manual — the same way
 * uploaded PDF documents are merged. This guarantees a single rendering standard:
 * standalone export and O&M inclusion produce identical output.
 */

import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';
import type { DBSiteForm } from '../../lib/store';
import type { ExtendedSiteForm } from '../../forms/types';
import { buildStandaloneFormHtml } from '../../forms/PDFRenderer';
import type { OrgInfo } from './OAndMPDFBuilder';

// A4 dimensions in PDF user units and in screen pixels at 96dpi
const A4_PDF_W = 595.28;
const A4_PDF_H = 841.89;
const RENDER_WIDTH_PX = 860; // matches .page max-width in PDFRenderer CSS
const RENDER_SCALE = 2;      // retina capture for crisp text
const A4_H_AT_SCALE = Math.round((RENDER_WIDTH_PX * (A4_PDF_H / A4_PDF_W)) * RENDER_SCALE);

// Map DBSiteForm (snake_case, extra_data flat) → ExtendedSiteForm (camelCase, flat)
function dbFormToExtended(form: DBSiteForm): ExtendedSiteForm {
  return {
    id: form.id,
    type: form.type as ExtendedSiteForm['type'],
    projectId: form.project_id,
    projectName: form.project_name,
    date: form.date,
    completedBy: form.completed_by,
    description: form.description,
    comments: form.comments,
    status: form.status as ExtendedSiteForm['status'],
    attachments: [],
    ...((form.extra_data as Record<string, unknown>) ?? {}),
  } as ExtendedSiteForm;
}

// Renders the form HTML into a hidden iframe and returns one tall canvas.
async function renderFormToFullCanvas(html: string): Promise<HTMLCanvasElement> {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:absolute;left:-9999px;top:0;width:${RENDER_WIDTH_PX}px;border:none;height:1px`;
  document.body.appendChild(iframe);

  await new Promise<void>(resolve => {
    iframe.onload = () => resolve();
    const iDoc = iframe.contentDocument!;
    iDoc.open();
    iDoc.write(html);
    iDoc.close();
    if (iDoc.readyState === 'complete') resolve();
  });

  await new Promise(r => setTimeout(r, 200));

  const iDoc = iframe.contentDocument!;
  const body = iDoc.body;
  const naturalH = body.scrollHeight;
  iframe.style.height = `${naturalH}px`;

  const fullCanvas = await html2canvas(body, {
    scale: RENDER_SCALE,
    useCORS: true,
    allowTaint: false,
    logging: false,
    width: RENDER_WIDTH_PX,
    height: naturalH,
    windowWidth: RENDER_WIDTH_PX,
    windowHeight: naturalH,
    backgroundColor: '#ffffff',
    foreignObjectRendering: false,
  });

  document.body.removeChild(iframe);
  return fullCanvas;
}

// Slices `srcH` rows from `fullCanvas` at `offsetY` into a new canvas of exactly that height.
function makeSlice(src: HTMLCanvasElement, offsetY: number, srcH: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width  = src.width;
  c.height = srcH;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, src.width, srcH);
  ctx.drawImage(src, 0, offsetY, src.width, srcH, 0, 0, src.width, srcH);
  return c;
}

// ─── Standalone export ────────────────────────────────────────────────────────
// Used by the site-form "Export PDF" button AND by the O&M builder.
// Slices the full-height canvas into A4 pages; each page is drawn at proportional
// height so the last (shorter) page is never stretched to fill a full A4 box.

export async function formToPdfBytes(
  form: DBSiteForm,
  orgInfo: OrgInfo,
): Promise<Uint8Array> {
  const extended    = dbFormToExtended(form);
  const orgSettings = { company_name: orgInfo.companyName, logo_data_url: orgInfo.logoDataUrl };
  const html        = buildStandaloneFormHtml(extended, orgSettings);
  const fullCanvas  = await renderFormToFullCanvas(html);

  const totalH = fullCanvas.height;
  const doc    = await PDFDocument.create();
  let offset   = 0;

  while (offset < totalH) {
    const sliceH      = Math.min(A4_H_AT_SCALE, totalH - offset);
    const slice       = makeSlice(fullCanvas, offset, sliceH);
    const jpegUrl     = slice.toDataURL('image/jpeg', 0.94);
    const b64         = jpegUrl.split(',')[1];
    const bytes       = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const img         = await doc.embedJpg(bytes);
    const page        = doc.addPage([A4_PDF_W, A4_PDF_H]);
    const imgHeightPt = (sliceH / A4_H_AT_SCALE) * A4_PDF_H;
    page.drawImage(img, { x: 0, y: A4_PDF_H - imgHeightPt, width: A4_PDF_W, height: imgHeightPt });
    offset += A4_H_AT_SCALE;
  }

  return doc.save();
}
