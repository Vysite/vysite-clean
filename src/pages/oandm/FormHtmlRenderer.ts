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

// Renders the form HTML into a hidden DOM container and returns an array of
// canvas elements — one per A4 page worth of content.
async function renderFormToCanvasPages(html: string): Promise<HTMLCanvasElement[]> {
  // Hidden container sized to A4 width so the CSS flows at the right width
  const container = document.createElement('div');
  container.style.cssText = [
    'position:absolute',
    'left:-9999px',
    'top:0',
    `width:${RENDER_WIDTH_PX}px`,
    'background:white',
    'overflow:visible',
  ].join(';');

  // We need the CSS and the page HTML in the container.
  // Use a shadow iframe to avoid polluting the host document's CSS namespace.
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:absolute;left:-9999px;top:0;width:${RENDER_WIDTH_PX}px;border:none;height:1px`;
  document.body.appendChild(iframe);

  await new Promise<void>(resolve => {
    iframe.onload = () => resolve();
    const iDoc = iframe.contentDocument!;
    iDoc.open();
    iDoc.write(html);
    iDoc.close();
    // In case onload already fired before we attached the handler
    if (iDoc.readyState === 'complete') resolve();
  });

  // Give fonts/images a moment to settle
  await new Promise(r => setTimeout(r, 200));

  const iDoc = iframe.contentDocument!;
  const body = iDoc.body;

  // Expand iframe to natural height so html2canvas captures everything
  const naturalH = body.scrollHeight;
  iframe.style.height = `${naturalH}px`;

  // Capture the whole form as one tall canvas
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

  // Split into A4-height page slices
  const pages: HTMLCanvasElement[] = [];
  const totalH = fullCanvas.height;
  let offset = 0;

  while (offset < totalH) {
    const sliceH = Math.min(A4_H_AT_SCALE, totalH - offset);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = fullCanvas.width;
    pageCanvas.height = A4_H_AT_SCALE; // always full A4 height (bottom may be blank)
    const ctx = pageCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(fullCanvas, 0, offset, fullCanvas.width, sliceH, 0, 0, fullCanvas.width, sliceH);
    pages.push(pageCanvas);
    offset += A4_H_AT_SCALE;
  }

  return pages;
}

// Main entry: takes a DBSiteForm and org info, returns PDF bytes (all pages).
// These bytes can be merged directly into the O&M assembled PDF.
export async function formToPdfBytes(
  form: DBSiteForm,
  orgInfo: OrgInfo,
): Promise<Uint8Array> {
  const extended = dbFormToExtended(form);
  const orgSettings = {
    company_name: orgInfo.companyName,
    logo_data_url: orgInfo.logoDataUrl,
  };

  const html = buildStandaloneFormHtml(extended, orgSettings);
  const pages = await renderFormToCanvasPages(html);

  const doc = await PDFDocument.create();

  for (const pageCanvas of pages) {
    const jpegDataUrl = pageCanvas.toDataURL('image/jpeg', 0.94);
    const base64 = jpegDataUrl.split(',')[1];
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const img = await doc.embedJpg(bytes);
    const page = doc.addPage([A4_PDF_W, A4_PDF_H]);
    page.drawImage(img, { x: 0, y: 0, width: A4_PDF_W, height: A4_PDF_H });
  }

  return doc.save();
}
