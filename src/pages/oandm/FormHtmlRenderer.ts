/**
 * FormHtmlRenderer
 *
 * Renders a VYSITE form's standalone HTML output (from buildStandaloneFormHtml)
 * into PDF bytes using html2canvas.
 *
 * This is the long-term architecture: PDFRenderer.ts owns one authoritative HTML
 * renderer for each form type. The O&M builder uses this file to capture that
 * output as mergeable PDF pages — identical to what the standalone "Export PDF"
 * button produces.
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

// O&M safe content zone — must match the constants in OAndMPDFBuilder.ts exactly.
// These tell us how many pixels of the canvas correspond to the content area on
// a template page (header+footer already stamped).
const OAM_CONTENT_TOP_PT = 784.89;  // CONTENT_TOP in OAndMPDFBuilder
const OAM_CONTENT_BOT_PT =  62;     // CONTENT_BOT in OAndMPDFBuilder

// Convert the O&M content zone to canvas pixels (canvas y=0 is at page TOP)
const OAM_CONTENT_TOP_PX = Math.round((A4_PDF_H - OAM_CONTENT_TOP_PT) / A4_PDF_H * A4_H_AT_SCALE);
const OAM_CONTENT_BOT_PX = Math.round((A4_PDF_H - OAM_CONTENT_BOT_PT) / A4_PDF_H * A4_H_AT_SCALE);
const OAM_CONTENT_H_PX   = OAM_CONTENT_BOT_PX - OAM_CONTENT_TOP_PX;
// How many PDF points the content image occupies (= CONTENT_TOP - CONTENT_BOT)
const OAM_CONTENT_H_PT   = OAM_CONTENT_TOP_PT - OAM_CONTENT_BOT_PT;

// Map DBSiteForm (snake_case, extra_data flat) → ExtendedSiteForm (camelCase, flat)
function dbFormToExtended(form: DBSiteForm): ExtendedSiteForm {
  return {
    // Base SiteForm fields (camelCase)
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
    // Spread all extra_data fields flat — these are the type-specific fields
    // that buildFormPageHTML() reads directly off the form object
    ...((form.extra_data as Record<string, unknown>) ?? {}),
  } as ExtendedSiteForm;
}

// Renders the form HTML into a hidden DOM container and returns one tall canvas
// covering the entire form content.
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

  // Give fonts/images a moment to settle
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

// Slices a full-height canvas into per-page canvases:
//   - Page 0: full A4 height slice (standalone form — has its own baked chrome)
//   - Pages 1+: O&M content-zone height slices (will be inset into O&M template pages)
function sliceCanvasPages(fullCanvas: HTMLCanvasElement): {
  page0: HTMLCanvasElement;
  continuations: HTMLCanvasElement[];
} {
  const totalH = fullCanvas.height;

  // Page 0 — full A4 slice
  const p0H = Math.min(A4_H_AT_SCALE, totalH);
  const page0 = makeSlice(fullCanvas, 0, p0H, fullCanvas.width, A4_H_AT_SCALE);

  // Remaining content after page 0
  const continuations: HTMLCanvasElement[] = [];
  let offset = A4_H_AT_SCALE;

  while (offset < totalH) {
    const sliceH = Math.min(OAM_CONTENT_H_PX, totalH - offset);
    const slice  = makeSlice(fullCanvas, offset, sliceH, fullCanvas.width, OAM_CONTENT_H_PX);
    continuations.push(slice);
    offset += OAM_CONTENT_H_PX;
  }

  return { page0, continuations };
}

// Creates a canvas slice: reads `srcH` rows from `fullCanvas` starting at `offsetY`,
// draws them onto a canvas of fixed `destH` height (remainder is white).
function makeSlice(
  src: HTMLCanvasElement,
  offsetY: number,
  srcH: number,
  width: number,
  destH: number,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width  = width;
  c.height = destH;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, destH);
  ctx.drawImage(src, 0, offsetY, width, srcH, 0, 0, width, srcH);
  return c;
}

// ─── Standalone export (used by site-form "Export PDF" button) ────────────────
// Slices at full A4 height — same as before.

export async function formToPdfBytes(
  form: DBSiteForm,
  orgInfo: OrgInfo,
): Promise<Uint8Array> {
  const extended   = dbFormToExtended(form);
  const orgSettings = { company_name: orgInfo.companyName, logo_data_url: orgInfo.logoDataUrl };
  const html       = buildStandaloneFormHtml(extended, orgSettings);
  const fullCanvas = await renderFormToFullCanvas(html);

  const totalH = fullCanvas.height;
  const doc    = await PDFDocument.create();
  let offset   = 0;

  while (offset < totalH) {
    const sliceH   = Math.min(A4_H_AT_SCALE, totalH - offset);
    const slice    = makeSlice(fullCanvas, offset, sliceH, fullCanvas.width, A4_H_AT_SCALE);
    const jpegUrl  = slice.toDataURL('image/jpeg', 0.94);
    const b64      = jpegUrl.split(',')[1];
    const bytes    = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const img      = await doc.embedJpg(bytes);
    const page     = doc.addPage([A4_PDF_W, A4_PDF_H]);
    page.drawImage(img, { x: 0, y: 0, width: A4_PDF_W, height: A4_PDF_H });
    offset += A4_H_AT_SCALE;
  }

  return doc.save();
}

// ─── O&M export ───────────────────────────────────────────────────────────────
// Returns structured render data so the O&M builder can place each page correctly:
//   - page0Jpeg: full-bleed A4 JPEG (standalone form — merged as-is)
//   - continuationJpegs: shorter JPEG images, one per continuation page,
//     each exactly OAM_CONTENT_H_PT tall in PDF points, to be placed inside
//     a template page at CONTENT_BOT y-offset.

export type OAndMFormRender = {
  page0Jpeg: Uint8Array;
  continuationJpegs: Array<{
    bytes: Uint8Array;
    heightPt: number;  // always OAM_CONTENT_H_PT
  }>;
};

export async function formToOAndMRender(
  form: DBSiteForm,
  orgInfo: OrgInfo,
): Promise<OAndMFormRender> {
  const extended    = dbFormToExtended(form);
  const orgSettings = { company_name: orgInfo.companyName, logo_data_url: orgInfo.logoDataUrl };
  const html        = buildStandaloneFormHtml(extended, orgSettings);
  const fullCanvas  = await renderFormToFullCanvas(html);

  const { page0, continuations } = sliceCanvasPages(fullCanvas);

  const toJpeg = (canvas: HTMLCanvasElement): Uint8Array => {
    const url   = canvas.toDataURL('image/jpeg', 0.94);
    const b64   = url.split(',')[1];
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  };

  return {
    page0Jpeg: toJpeg(page0),
    continuationJpegs: continuations.map(c => ({
      bytes:    toJpeg(c),
      heightPt: OAM_CONTENT_H_PT,
    })),
  };
}

// Export the O&M content zone dimensions so OAndMPDFBuilder can position images
export { OAM_CONTENT_H_PT, OAM_CONTENT_BOT_PT };

