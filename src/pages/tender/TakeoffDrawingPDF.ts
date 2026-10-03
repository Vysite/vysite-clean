import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type Color } from 'pdf-lib';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { DBTenderDrawing, DBTenderDrawingCalibration } from './drawingTypes';
import type { CountGeometry, LinearGeometry, AreaGeometry } from './takeoffGeometry';
import { isCountGeometry, isLinearGeometry, isAreaGeometry } from './takeoffGeometry';
import { groupLinearRuns, areaPolygonQuantity, distanceInPdfPoints, finalQuantity } from './takeoffCalculations';

export interface DrawingExportData {
  drawing: DBTenderDrawing;
  items: DBTenderTakeoffItem[];
  calibrations: DBTenderDrawingCalibration[];
  pdfBytes: ArrayBuffer;
  tenderName: string;
  tenderRef: string;
  internal: boolean;
}

const FALLBACK_COLOR: Color = rgb(0.976, 0.451, 0.133);

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function parseTakeoffPdfColour(value: unknown, itemLabel?: string): Color {
  if (typeof value === 'string') {
    const s = value.trim();

    // #RRGGBB or #RGB
    const hexMatch = s.match(/^#?([0-9a-fA-F]{6})$/);
    if (hexMatch) {
      const h = hexMatch[1];
      return rgb(
        clamp01(parseInt(h.substring(0, 2), 16) / 255),
        clamp01(parseInt(h.substring(2, 4), 16) / 255),
        clamp01(parseInt(h.substring(4, 6), 16) / 255),
      );
    }
    const hexShort = s.match(/^#?([0-9a-fA-F]{3})$/);
    if (hexShort) {
      const h = hexShort[1];
      return rgb(
        clamp01(parseInt(h[0] + h[0], 16) / 255),
        clamp01(parseInt(h[1] + h[1], 16) / 255),
        clamp01(parseInt(h[2] + h[2], 16) / 255),
      );
    }

    // rgb(r, g, b) / rgba(r, g, b, a) with values 0-255
    const rgbMatch = s.match(/^rgba?\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)/);
    if (rgbMatch) {
      return rgb(
        clamp01(parseFloat(rgbMatch[1]) / 255),
        clamp01(parseFloat(rgbMatch[2]) / 255),
        clamp01(parseFloat(rgbMatch[3]) / 255),
      );
    }
  }

  if (itemLabel) {
    console.warn('[Takeoff PDF] Colour fallback:', { item: itemLabel, storedColour: value });
  }
  return FALLBACK_COLOR;
}

const LINE_LABELS: Record<string, string> = { standard: 'STD', addition: '+ ADD', omission: '- OMIT' };
const TYPE_LABELS: Record<string, string> = { count: 'Count', linear: 'Linear', area: 'Area' };

function sanitizePdfText(value: string): string {
  return value
    .replace(/\u2212/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00B2/g, '2')
    .replace(/\u00B3/g, '3')
    .replace(/\u00B7/g, '-')
    .replace(/\u2022/g, '')
    .replace(/\u25CF/g, '')
    .replace(/\u25A0/g, '')
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'");
}

function calForPage(calibrations: DBTenderDrawingCalibration[], drawingId: string, pageNum: number): DBTenderDrawingCalibration | null {
  return calibrations.find(c => c.drawing_id === drawingId && c.page_number === pageNum) ?? null;
}

export async function exportMarkedUpDrawingPDF(data: DrawingExportData): Promise<void> {
  const { drawing, items, calibrations, pdfBytes, tenderName, tenderRef, internal } = data;

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  const visibleItems = items.filter(i => i.is_visible && i.geometry);

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageNum = pageIdx + 1;
    const page = pages[pageIdx];
    const { width: pw, height: ph } = page.getSize();
    const rotation = page.getRotation().angle;
    const cal = calForPage(calibrations, drawing.id, pageNum);
    const pageItems = visibleItems.filter(i => i.drawing_id === drawing.id && i.page_number === pageNum);

    if (pageItems.length === 0) continue;

    for (const item of pageItems) {
      const geo = item.geometry!;
      const color = parseTakeoffPdfColour(item.colour, item.label);

      if (isCountGeometry(geo)) {
        renderCountPDF(page, geo as CountGeometry, color, font, pw, ph, rotation);
      } else if (isLinearGeometry(geo)) {
        renderLinearPDF(page, geo as LinearGeometry, color, font, cal, pw, ph, rotation);
      } else if (isAreaGeometry(geo)) {
        renderAreaPDF(page, geo as AreaGeometry, color, font, cal, pw, ph, rotation);
      }
    }

    // Legend on first page only, or first page with annotations
    const firstAnnotatedPage = visibleItems.find(i => i.drawing_id === drawing.id)?.page_number ?? 1;
    if (pageNum === firstAnnotatedPage) {
      drawLegendPDF(page, pageItems, font, fontBold, pw, ph, internal, calibrations, drawing.id);
    }
  }

  // Summary page(s) at the end
  drawSummaryPages(pdfDoc, font, fontBold, drawing, tenderName, tenderRef, visibleItems, internal);

  const pdfBytesOut = await pdfDoc.save();
  const blob = new Blob([pdfBytesOut], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  // Sanitize filename: drawing number + title, strip unsafe chars
  const safeName = (drawing.drawing_number || 'DWG') + '_' + (drawing.title || 'Drawing');
  const sanitized = safeName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').substring(0, 80);

  const a = document.createElement('a');
  a.href = url;
  a.download = `VYSITE_${sanitized}_Marked_Up.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Rotation-aware PDF coordinate mapping ──────────────────────────────────
// Normalized coords: x,y in 0..1 where (0,0) = top-left of the RENDERED (rotated) page.
// PDF coords: (0,0) = bottom-left of the UNROTATED page.
// pdf.js applies /Rotate automatically, so normalized coords are in rotated space.
// pdf-lib draws in unrotated space, so we must undo the rotation.
//
// For each rotation, the inverse transform from normalized (rotated view) to
// PDF coords (unrotated, bottom-left origin) is:
//   0°:   pdf_x = nx * W,           pdf_y = H * (1 - ny)
//   90°:  pdf_x = W * ny,            pdf_y = H * nx
//   180°: pdf_x = W * (1 - nx),      pdf_y = H * ny
//   270°: pdf_x = W * (1 - ny),      pdf_y = H * (1 - nx)

function normToPdf(normX: number, normY: number, rotation: number, W: number, H: number): { x: number; y: number } {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { x: W * normY, y: H * normX };
    case 180:
      return { x: W * (1 - normX), y: H * normY };
    case 270:
      return { x: W * (1 - normY), y: H * (1 - normX) };
    default:
      return { x: normX * W, y: H * (1 - normY) };
  }
}

// ── Count markers ──────────────────────────────────────────────────────────

function renderCountPDF(page: PDFPage, geo: CountGeometry, color: Color, font: PDFFont, pw: number, ph: number, rotation: number): void {
  const markerRadius = Math.min(pw, ph) * 0.006;
  for (let i = 0; i < geo.points.length; i++) {
    const pt = geo.points[i];
    const { x: px, y: py } = normToPdf(pt.x, pt.y, rotation, pw, ph);
    page.drawCircle({ x: px, y: py, size: markerRadius, color, borderColor: rgb(1, 1, 1), borderWidth: 0.5 });
    const label = String(i + 1);
    const textW = font.widthOfTextAtSize(label, markerRadius * 1.1);
    page.drawText(label, { x: px - textW / 2, y: py - markerRadius * 0.55, size: markerRadius * 1.1, color: rgb(1, 1, 1), font });
  }
}

// ── Linear runs ────────────────────────────────────────────────────────────

function renderLinearPDF(page: PDFPage, geo: LinearGeometry, color: Color, font: PDFFont, cal: DBTenderDrawingCalibration | null, pw: number, ph: number, rotation: number): void {
  const runs = groupLinearRuns(geo, cal, pw, ph);
  const lineWidth = Math.min(pw, ph) * 0.0012;
  const fontSize = Math.min(pw, ph) * 0.008;

  for (const run of runs) {
    const segs = run.segments;
    for (const seg of segs) {
      const s = normToPdf(seg.start.x, seg.start.y, rotation, pw, ph);
      const e = normToPdf(seg.end.x, seg.end.y, rotation, pw, ph);
      page.drawLine({ start: s, end: e, thickness: lineWidth, color });
    }

    // Endpoint markers
    const startPt = segs[0].start;
    const endPt = segs[segs.length - 1].end;
    const endR = Math.min(pw, ph) * 0.0025;
    const sp = normToPdf(startPt.x, startPt.y, rotation, pw, ph);
    const ep = normToPdf(endPt.x, endPt.y, rotation, pw, ph);
    page.drawCircle({ x: sp.x, y: sp.y, size: endR, color });
    page.drawCircle({ x: ep.x, y: ep.y, size: endR, color });

    // Measurement label at midpoint of middle segment
    const midSeg = segs[Math.floor(segs.length / 2)];
    const mid = normToPdf((midSeg.start.x + midSeg.end.x) / 2, (midSeg.start.y + midSeg.end.y) / 2, rotation, pw, ph);
    const midX = mid.x;
    const midY = mid.y;

    const totalPdfPts = segs.reduce((sum, s) => sum + distanceInPdfPoints(s.start, s.end, pw, ph), 0);
    const realDist = cal?.scale_factor ? totalPdfPts * cal.scale_factor : 0;
    if (realDist > 0) {
      const label = `${realDist.toFixed(2)} ${cal?.unit ?? ''}`.trim();
      drawTextWithHalo(page, label, midX, midY, fontSize, color, font);
    }
  }
}

// ── Area polygons ──────────────────────────────────────────────────────────

function renderAreaPDF(page: PDFPage, geo: AreaGeometry, color: Color, font: PDFFont, cal: DBTenderDrawingCalibration | null, pw: number, ph: number, rotation: number): void {
  const lineWidth = Math.min(pw, ph) * 0.0015;
  const fontSize = Math.min(pw, ph) * 0.008;

  for (const poly of geo.polygons) {
    // Outline + fill via SVG path
    const pts = poly.vertices.map(v => normToPdf(v.x, v.y, rotation, pw, ph));
    if (pts.length >= 2) {
      const svgPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';
      page.drawSvgPath(svgPath, { borderColor: color, borderWidth: lineWidth, color, opacity: 0.15 });
    }

    // Area value at centroid (in normalized space, then mapped)
    let ncx = 0, ncy = 0;
    for (const v of poly.vertices) { ncx += v.x; ncy += v.y; }
    ncx /= poly.vertices.length;
    ncy /= poly.vertices.length;
    const c = normToPdf(ncx, ncy, rotation, pw, ph);
    const cx = c.x;
    const cy = c.y;

    const area = cal?.scale_factor
      ? areaPolygonQuantity(poly, cal, pw, ph)
      : 0;
    if (area > 0) {
      const label = sanitizePdfText(`${area.toFixed(2)} ${cal?.unit ?? ''}2`.trim());
      drawTextWithHalo(page, label, cx, cy, fontSize, color, font);
    }
  }
}

// ── Text with halo (stroke effect) ─────────────────────────────────────────

function drawTextWithHalo(page: PDFPage, text: string, x: number, y: number, size: number, color: Color, font: PDFFont): void {
  const textW = font.widthOfTextAtSize(text, size);
  const textH = size;
  // Draw a white background rectangle with slight padding
  const padX = size * 0.2;
  const padY = size * 0.15;
  page.drawRectangle({
    x: x - textW / 2 - padX,
    y: y - textH / 2 - padY,
    width: textW + padX * 2,
    height: textH + padY * 2,
    color: rgb(1, 1, 1),
    opacity: 0.82,
  });
  // Draw the text on top
  page.drawText(text, { x: x - textW / 2, y: y - textH / 2 + size * 0.1, size, color, font });
}

// ── Legend panel ───────────────────────────────────────────────────────────

function drawLegendPDF(page: PDFPage, items: DBTenderTakeoffItem[], font: PDFFont, fontBold: PDFFont, pw: number, ph: number, internal: boolean, calibrations: DBTenderDrawingCalibration[], drawingId: string): void {
  const margin = Math.min(pw, ph) * 0.02;
  const panelW = Math.min(pw * 0.35, 250);
  const rowH = 16;
  const headerH = 28;
  const footerH = internal ? 12 : 0;
  const panelH = headerH + items.length * rowH + footerH + 16;

  // Position: top-right corner, inside margins
  const panelX = pw - panelW - margin;
  const panelY = ph - margin - panelH;

  // Panel background
  page.drawRectangle({ x: panelX, y: panelY, width: panelW, height: panelH, color: rgb(1, 1, 1), opacity: 0.92, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 });

  // Title
  page.drawText('Take-Off Legend', { x: panelX + 10, y: panelY + panelH - 18, size: 11, color: rgb(0.039, 0.106, 0.235), font: fontBold });

  // Column headers
  const colSym = panelX + 12;
  const colDesc = panelX + 30;
  const colType = panelX + panelW * 0.45;
  const colQty = panelX + panelW * 0.65;
  const colLine = panelX + panelW * 0.82;

  page.drawText('Item', { x: colDesc, y: panelY + panelH - 34, size: 7, color: rgb(0.4, 0.45, 0.55), font: fontBold });
  page.drawText('Type', { x: colType, y: panelY + panelH - 34, size: 7, color: rgb(0.4, 0.45, 0.55), font: fontBold });
  page.drawText('Qty', { x: colQty, y: panelY + panelH - 34, size: 7, color: rgb(0.4, 0.45, 0.55), font: fontBold });
  page.drawText('Scope', { x: colLine, y: panelY + panelH - 34, size: 7, color: rgb(0.4, 0.45, 0.55), font: fontBold });

  // Separator line
  page.drawLine({ start: { x: panelX + 8, y: panelY + panelH - 38 }, end: { x: panelX + panelW - 8, y: panelY + panelH - 38 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });

  // Rows
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const color = parseTakeoffPdfColour(item.colour, item.label);
    const rowY = panelY + panelH - 44 - i * rowH;
    const label = item.label || 'Untitled';

    // Symbol — drawn as PDF primitive, not text (WinAnsi can't encode Unicode shapes)
    const symSize = 6;
    const symY = rowY + 2;
    if (item.measurement_type === 'count') {
      page.drawCircle({ x: colSym + symSize / 2, y: symY, size: symSize / 2, color });
    } else if (item.measurement_type === 'linear') {
      page.drawLine({ start: { x: colSym, y: symY }, end: { x: colSym + symSize, y: symY }, thickness: 1.5, color });
    } else if (item.measurement_type === 'area') {
      page.drawRectangle({ x: colSym, y: symY - symSize / 2, width: symSize, height: symSize, color });
    }

    // Description (truncate if long)
    const maxDescW = colType - colDesc - 6;
    let desc = sanitizePdfText(label);
    while (font.widthOfTextAtSize(desc, 8) > maxDescW && desc.length > 3) desc = desc.substring(0, desc.length - 1);
    if (desc !== sanitizePdfText(label)) desc = desc.substring(0, desc.length - 1) + '...';
    page.drawText(desc, { x: colDesc, y: rowY, size: 8, color: rgb(0.11, 0.16, 0.27), font });

    // Type
    page.drawText(TYPE_LABELS[item.measurement_type] || '', { x: colType, y: rowY, size: 7, color: rgb(0.4, 0.45, 0.55), font });

    // Quantity
    const fq = item.source === 'manual' ? item.manual_quantity + item.adjustment_quantity : item.quantity + item.adjustment_quantity;
    const qtyStr = fq.toFixed(item.measurement_type === 'count' ? 0 : 2);
    page.drawText(sanitizePdfText(`${qtyStr} ${item.unit}`), { x: colQty, y: rowY, size: 7, color: rgb(0.11, 0.16, 0.27), font });

    // Line type
    const lineLabel = LINE_LABELS[item.line_type] || item.line_type;
    let lineColor = rgb(0.4, 0.45, 0.55);
    if (item.line_type === 'addition') lineColor = rgb(0.02, 0.6, 0.41);
    if (item.line_type === 'omission') lineColor = rgb(0.86, 0.15, 0.15);
    page.drawText(sanitizePdfText(lineLabel), { x: colLine, y: rowY, size: 7, color: lineColor, font: fontBold });
  }
}

// ── Summary page(s) ─────────────────────────────────────────────────────────

const SCOPE_LABELS: Record<string, string> = { standard: 'STD', addition: 'ADD', omission: 'OMIT' };

const A4_W = 595;
const A4_H = 842;

function drawSummaryHeader(page: PDFPage, font: PDFFont, fontBold: PDFFont, titleText: string): void {
  const pw = A4_W;
  const ph = A4_H;
  const margin = 48;

  page.drawRectangle({ x: 0, y: ph - 60, width: pw, height: 60, color: rgb(0.976, 0.451, 0.133) });
  page.drawText('VYSITE', { x: margin, y: ph - 38, size: 22, color: rgb(1, 1, 1), font: fontBold });
  page.drawText('Construction Management Platform', { x: margin, y: ph - 52, size: 8, color: rgb(1, 1, 1), font });

  const titleW = fontBold.widthOfTextAtSize(titleText, 14);
  page.drawText(titleText, { x: pw - margin - titleW, y: ph - 38, size: 14, color: rgb(1, 1, 1), font: fontBold });
}

function drawSummaryFooter(page: PDFPage, font: PDFFont, fontBold: PDFFont, exportDate: string, tenderRef: string, internal: boolean): void {
  const pw = A4_W;
  const ph = A4_H;
  const margin = 48;
  const orangeColor = rgb(0.976, 0.451, 0.133);

  page.drawLine({ start: { x: margin, y: 50 }, end: { x: pw - margin, y: 50 }, thickness: 0.5, color: rgb(0.89, 0.91, 0.94) });
  page.drawText('Powered by VYSITE', { x: margin, y: 36, size: 10, color: orangeColor, font: fontBold });
  page.drawText(sanitizePdfText(`Generated ${exportDate} - ${tenderRef}`), { x: margin, y: 22, size: 8, color: rgb(0.38, 0.43, 0.53), font });
  if (internal) {
    const confText = sanitizePdfText('Commercially Sensitive - Internal Only');
    const confW = fontBold.widthOfTextAtSize(confText, 8);
    page.drawText(confText, { x: pw - margin - confW, y: 36, size: 8, color: rgb(0.86, 0.15, 0.15), font: fontBold });
  }
}

function drawSummaryPages(pdfDoc: PDFDocument, font: PDFFont, fontBold: PDFFont, drawing: DBTenderDrawing, tenderName: string, tenderRef: string, items: DBTenderTakeoffItem[], internal: boolean): void {
  const exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const margin = 48;
  const pw = A4_W;
  const ph = A4_H;

  // Column positions for the schedule table
  const colColour = margin + 8;
  const colDesc = margin + 28;
  const colType = margin + 230;
  const colQty = margin + 300;
  const colUnit = margin + 360;
  const colDisc = margin + 400;
  const colScope = pw - margin - 50;

  const rowH = 24;
  const headerH = 28;
  const metaH = 140;
  const tableTop = ph - 60 - metaH - 30;
  const footerH = 60;
  const usableH = tableTop - footerH;
  const rowsPerPage = Math.floor((usableH - headerH) / rowH);

  const titleText = sanitizePdfText(internal ? 'Marked-Up Drawing Summary - Internal' : 'Marked-Up Drawing Summary');

  // Draw pages
  for (let pageStart = 0; pageStart < items.length; pageStart += rowsPerPage) {
    const page = pdfDoc.addPage([pw, ph]);
    const pageItems = items.slice(pageStart, pageStart + rowsPerPage);

    drawSummaryHeader(page, font, fontBold, titleText);

    // Compact metadata block — only on first summary page
    if (pageStart === 0) {
      const metaY = ph - 80;
      page.drawRectangle({
        x: margin, y: metaY - metaH, width: pw - margin * 2, height: metaH,
        borderColor: rgb(0.89, 0.91, 0.94), borderWidth: 1, color: rgb(0.98, 0.99, 1),
      });

      const labelColor = rgb(0.38, 0.43, 0.53);
      const valColor = rgb(0.11, 0.16, 0.27);
      const orangeColor = rgb(0.976, 0.451, 0.133);
      let y = metaY - 20;
      const rowGap = 22;
      const colL = margin + 16;
      const colR = margin + (pw - margin * 2) / 2 + 16;

      function metaRow(yPos: number, label: string, val: string, x: number, valColorOverride?: Color) {
        page.drawText(label.toUpperCase(), { x, y: yPos, size: 8, color: labelColor, font: fontBold });
        page.drawText(val, { x, y: yPos - 12, size: 11, color: valColorOverride ?? valColor, font });
      }

      metaRow(y, 'Tender Name', sanitizePdfText(tenderName), colL);
      metaRow(y, 'Drawing Number', sanitizePdfText(drawing.drawing_number || '-'), colR, orangeColor); y -= rowGap;
      metaRow(y, 'Tender Reference', sanitizePdfText(tenderRef), colL, orangeColor);
      metaRow(y, 'Drawing Title', sanitizePdfText(drawing.title), colR); y -= rowGap;
      metaRow(y, 'Drawing Revision', sanitizePdfText(drawing.revision), colL);
      metaRow(y, 'Drawing Discipline', sanitizePdfText(drawing.discipline), colR); y -= rowGap;
      metaRow(y, 'Export Date', exportDate, colL);
      metaRow(y, 'Take-Off Items', String(items.length), colR);
    }

    // Section label
    const sectionY = pageStart === 0 ? tableTop : ph - 80;
    page.drawText('MARKED-UP ITEMS', { x: margin, y: sectionY, size: 10, color: rgb(0.38, 0.43, 0.53), font: fontBold });

    // Table header
    const tblHeaderY = sectionY - 16;
    const tblStartY = tblHeaderY - headerH;
    page.drawRectangle({ x: margin, y: tblStartY, width: pw - margin * 2, height: headerH, color: rgb(0.94, 0.96, 0.99) });
    page.drawLine({ start: { x: margin, y: tblStartY }, end: { x: pw - margin, y: tblStartY }, thickness: 0.5, color: rgb(0.89, 0.91, 0.94) });
    page.drawLine({ start: { x: margin, y: tblHeaderY }, end: { x: pw - margin, y: tblHeaderY }, thickness: 0.5, color: rgb(0.89, 0.91, 0.94) });

    const hdrColor = rgb(0.38, 0.43, 0.53);
    const hdrY = tblStartY + 10;
    page.drawText('Description', { x: colDesc, y: hdrY, size: 8, color: hdrColor, font: fontBold });
    page.drawText('Type', { x: colType, y: hdrY, size: 8, color: hdrColor, font: fontBold });
    page.drawText('Qty', { x: colQty, y: hdrY, size: 8, color: hdrColor, font: fontBold });
    page.drawText('Unit', { x: colUnit, y: hdrY, size: 8, color: hdrColor, font: fontBold });
    page.drawText('Trade', { x: colDisc, y: hdrY, size: 8, color: hdrColor, font: fontBold });
    page.drawText('Scope', { x: colScope, y: hdrY, size: 8, color: hdrColor, font: fontBold });

    // Rows
    for (let i = 0; i < pageItems.length; i++) {
      const item = pageItems[i];
      const rowY = tblStartY - (i + 1) * rowH + rowH / 2 + 4;

      // Row separator line
      const lineY = tblStartY - (i + 1) * rowH;
      page.drawLine({ start: { x: margin, y: lineY }, end: { x: pw - margin, y: lineY }, thickness: 0.3, color: rgb(0.92, 0.93, 0.95) });

      const color = parseTakeoffPdfColour(item.colour, item.label);
      const symSize = 7;

      // Colour symbol — drawn as PDF primitive
      if (item.measurement_type === 'count') {
        page.drawCircle({ x: colColour + symSize / 2, y: rowY, size: symSize / 2, color });
      } else if (item.measurement_type === 'linear') {
        page.drawLine({ start: { x: colColour, y: rowY }, end: { x: colColour + symSize, y: rowY }, thickness: 1.5, color });
      } else if (item.measurement_type === 'area') {
        page.drawRectangle({ x: colColour, y: rowY - symSize / 2, width: symSize, height: symSize, color });
      }

      // Description (truncate)
      const maxDescW = colType - colDesc - 6;
      let desc = sanitizePdfText(item.label || 'Untitled');
      while (font.widthOfTextAtSize(desc, 9) > maxDescW && desc.length > 3) desc = desc.substring(0, desc.length - 1);
      if (desc !== sanitizePdfText(item.label || 'Untitled')) desc = desc.substring(0, desc.length - 1) + '...';
      page.drawText(desc, { x: colDesc, y: rowY - 3, size: 9, color: rgb(0.11, 0.16, 0.27), font });

      // Type
      page.drawText(TYPE_LABELS[item.measurement_type] || '', { x: colType, y: rowY - 3, size: 8, color: rgb(0.4, 0.45, 0.55), font });

      // Final quantity
      const fq = finalQuantity(item);
      const qtyStr = fq.toFixed(item.measurement_type === 'count' ? 0 : 2);
      const qtyText = sanitizePdfText(qtyStr);
      const qtyW = font.widthOfTextAtSize(qtyText, 9);
      page.drawText(qtyText, { x: colQty + (30 - qtyW) / 2, y: rowY - 3, size: 9, color: rgb(0.11, 0.16, 0.27), font: fontBold });

      // Unit
      page.drawText(sanitizePdfText(item.unit), { x: colUnit, y: rowY - 3, size: 8, color: rgb(0.4, 0.45, 0.55), font });

      // Trade / Discipline (item's own discipline, NOT drawing discipline)
      page.drawText(sanitizePdfText(item.discipline), { x: colDisc, y: rowY - 3, size: 8, color: rgb(0.4, 0.45, 0.55), font });

      // Scope badge
      const scopeLabel = SCOPE_LABELS[item.line_type] || item.line_type;
      let scopeColor = rgb(0.4, 0.45, 0.55);
      if (item.line_type === 'addition') scopeColor = rgb(0.02, 0.6, 0.41);
      if (item.line_type === 'omission') scopeColor = rgb(0.86, 0.15, 0.15);
      page.drawText(scopeLabel, { x: colScope, y: rowY - 3, size: 8, color: scopeColor, font: fontBold });
    }

    drawSummaryFooter(page, font, fontBold, exportDate, tenderRef, internal);
  }
}
