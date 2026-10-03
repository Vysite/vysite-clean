import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type Color } from 'pdf-lib';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { DBTenderDrawing, DBTenderDrawingCalibration } from './drawingTypes';
import type { CountGeometry, LinearGeometry, AreaGeometry } from './takeoffGeometry';
import { isCountGeometry, isLinearGeometry, isAreaGeometry } from './takeoffGeometry';
import { groupLinearRuns, areaPolygonQuantity, distanceInPdfPoints } from './takeoffCalculations';

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

const LINE_LABELS: Record<string, string> = { standard: 'STD', addition: '+ ADD', omission: '\u2212 OMIT' };
const TYPE_SYMBOLS: Record<string, string> = { count: '\u25CF', linear: '\u2014', area: '\u25A0' };
const TYPE_LABELS: Record<string, string> = { count: 'Count', linear: 'Linear', area: 'Area' };

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
    const cal = calForPage(calibrations, drawing.id, pageNum);
    const pageItems = visibleItems.filter(i => i.drawing_id === drawing.id && i.page_number === pageNum);

    if (pageItems.length === 0) continue;

    for (const item of pageItems) {
      const geo = item.geometry!;
      const color = parseTakeoffPdfColour(item.colour, item.label);

      if (isCountGeometry(geo)) {
        renderCountPDF(page, geo as CountGeometry, color, font, pw, ph);
      } else if (isLinearGeometry(geo)) {
        renderLinearPDF(page, geo as LinearGeometry, color, font, cal, pw, ph);
      } else if (isAreaGeometry(geo)) {
        renderAreaPDF(page, geo as AreaGeometry, color, font, cal, pw, ph);
      }
    }

    // Legend on first page only, or first page with annotations
    const firstAnnotatedPage = visibleItems.find(i => i.drawing_id === drawing.id)?.page_number ?? 1;
    if (pageNum === firstAnnotatedPage) {
      drawLegendPDF(page, pageItems, font, fontBold, pw, ph, internal, calibrations, drawing.id);
    }
  }

  // Metadata page at the end
  drawMetadataPage(pdfDoc, font, fontBold, drawing, tenderName, tenderRef, visibleItems, internal);

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

// ── PDF coordinate mapping ─────────────────────────────────────────────────
// Normalized coords: x,y in 0..1 where (0,0) = top-left of the rendered page.
// PDF coords: (0,0) = bottom-left. So PDF_y = pageHeight * (1 - normY).

function nx(normX: number, pw: number): number { return normX * pw; }
function ny(normY: number, ph: number): number { return ph * (1 - normY); }

// ── Count markers ──────────────────────────────────────────────────────────

function renderCountPDF(page: PDFPage, geo: CountGeometry, color: Color, font: PDFFont, pw: number, ph: number): void {
  // Physical marker size: ~3mm radius regardless of page size
  const markerRadius = Math.min(pw, ph) * 0.006;
  for (let i = 0; i < geo.points.length; i++) {
    const pt = geo.points[i];
    const px = nx(pt.x, pw);
    const py = ny(pt.y, ph);
    page.drawCircle({ x: px, y: py, size: markerRadius, color, borderColor: rgb(1, 1, 1), borderWidth: 0.5 });
    const label = String(i + 1);
    const textW = font.widthOfTextAtSize(label, markerRadius * 1.1);
    page.drawText(label, { x: px - textW / 2, y: py - markerRadius * 0.55, size: markerRadius * 1.1, color: rgb(1, 1, 1), font });
  }
}

// ── Linear runs ────────────────────────────────────────────────────────────

function renderLinearPDF(page: PDFPage, geo: LinearGeometry, color: Color, font: PDFFont, cal: DBTenderDrawingCalibration | null, pw: number, ph: number): void {
  const runs = groupLinearRuns(geo, cal, pw, ph);
  const lineWidth = Math.min(pw, ph) * 0.0012;
  const fontSize = Math.min(pw, ph) * 0.008;

  for (const run of runs) {
    const segs = run.segments;
    // Draw all segments
    for (const seg of segs) {
      page.drawLine({
        start: { x: nx(seg.start.x, pw), y: ny(seg.start.y, ph) },
        end: { x: nx(seg.end.x, pw), y: ny(seg.end.y, ph) },
        thickness: lineWidth,
        color,
      });
    }

    // Endpoint markers
    const startPt = segs[0].start;
    const endPt = segs[segs.length - 1].end;
    const endR = Math.min(pw, ph) * 0.0025;
    page.drawCircle({ x: nx(startPt.x, pw), y: ny(startPt.y, ph), size: endR, color });
    page.drawCircle({ x: nx(endPt.x, pw), y: ny(endPt.y, ph), size: endR, color });

    // Measurement label at midpoint of middle segment
    const midSeg = segs[Math.floor(segs.length / 2)];
    const midX = nx((midSeg.start.x + midSeg.end.x) / 2, pw);
    const midY = ny((midSeg.start.y + midSeg.end.y) / 2, ph);

    const totalPdfPts = segs.reduce((sum, s) => sum + distanceInPdfPoints(s.start, s.end, pw, ph), 0);
    const realDist = cal?.scale_factor ? totalPdfPts * cal.scale_factor : 0;
    if (realDist > 0) {
      const label = `${realDist.toFixed(2)} ${cal?.unit ?? ''}`.trim();
      drawTextWithHalo(page, label, midX, midY, fontSize, color, font);
    }
  }
}

// ── Area polygons ──────────────────────────────────────────────────────────

function renderAreaPDF(page: PDFPage, geo: AreaGeometry, color: Color, font: PDFFont, cal: DBTenderDrawingCalibration | null, pw: number, ph: number): void {
  const lineWidth = Math.min(pw, ph) * 0.0015;
  const fontSize = Math.min(pw, ph) * 0.008;

  for (const poly of geo.polygons) {
    // Outline
    const pts = poly.vertices.map(v => ({ x: nx(v.x, pw), y: ny(v.y, ph) }));
    page.drawPolygonPoints({ points: pts, borderColor: color, borderWidth: lineWidth, color });

    // Area value at centroid
    let cx = 0, cy = 0;
    for (const v of poly.vertices) { cx += v.x; cy += v.y; }
    cx = nx(cx / poly.vertices.length, pw);
    cy = ny(cy / poly.vertices.length, ph);

    const area = cal?.scale_factor
      ? areaPolygonQuantity(poly, cal, pw, ph)
      : 0;
    if (area > 0) {
      const label = `${area.toFixed(2)} ${cal?.unit ?? ''}\u00B2`.trim();
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

    // Symbol
    const sym = TYPE_SYMBOLS[item.measurement_type] || '\u25CF';
    page.drawText(sym, { x: colSym, y: rowY, size: 10, color, font: fontBold });

    // Description (truncate if long)
    const maxDescW = colType - colDesc - 6;
    let desc = label;
    while (font.widthOfTextAtSize(desc, 8) > maxDescW && desc.length > 3) desc = desc.substring(0, desc.length - 1);
    if (desc !== label) desc = desc.substring(0, desc.length - 1) + '\u2026';
    page.drawText(desc, { x: colDesc, y: rowY, size: 8, color: rgb(0.11, 0.16, 0.27), font });

    // Type
    page.drawText(TYPE_LABELS[item.measurement_type] || '', { x: colType, y: rowY, size: 7, color: rgb(0.4, 0.45, 0.55), font });

    // Quantity
    const fq = item.source === 'manual' ? item.manual_quantity + item.adjustment_quantity : item.quantity + item.adjustment_quantity;
    const qtyStr = fq.toFixed(item.measurement_type === 'count' ? 0 : 2);
    page.drawText(`${qtyStr} ${item.unit}`, { x: colQty, y: rowY, size: 7, color: rgb(0.11, 0.16, 0.27), font });

    // Line type
    const lineLabel = LINE_LABELS[item.line_type] || item.line_type;
    let lineColor = rgb(0.4, 0.45, 0.55);
    if (item.line_type === 'addition') lineColor = rgb(0.02, 0.6, 0.41);
    if (item.line_type === 'omission') lineColor = rgb(0.86, 0.15, 0.15);
    page.drawText(lineLabel, { x: colLine, y: rowY, size: 7, color: lineColor, font: fontBold });
  }
}

// ── Metadata page ──────────────────────────────────────────────────────────

function drawMetadataPage(pdfDoc: PDFDocument, font: PDFFont, fontBold: PDFFont, drawing: DBTenderDrawing, tenderName: string, tenderRef: string, items: DBTenderTakeoffItem[], internal: boolean): void {
  const page = pdfDoc.addPage([595, 842]); // A4 portrait
  const { width: pw, height: ph } = page.getSize();
  const margin = 48;
  const exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Orange header bar
  page.drawRectangle({ x: 0, y: ph - 60, width: pw, height: 60, color: rgb(0.976, 0.451, 0.133) });
  page.drawText('VYSITE', { x: margin, y: ph - 38, size: 22, color: rgb(1, 1, 1), font: fontBold });
  page.drawText('Construction Management Platform', { x: margin, y: ph - 52, size: 8, color: rgb(1, 1, 1), font });

  // Title
  page.drawText(internal ? 'Marked-Up Drawing \u2014 Internal' : 'Marked-Up Drawing', { x: pw - margin, y: ph - 38, size: 14, color: rgb(1, 1, 1), font: fontBold });
  // Right-align
  const titleW = fontBold.widthOfTextAtSize(internal ? 'Marked-Up Drawing \u2014 Internal' : 'Marked-Up Drawing', 14);
  // Redraw right-aligned
  page.drawRectangle({ x: 0, y: ph - 60, width: pw, height: 60, color: rgb(0.976, 0.451, 0.133) });
  page.drawText('VYSITE', { x: margin, y: ph - 38, size: 22, color: rgb(1, 1, 1), font: fontBold });
  page.drawText('Construction Management Platform', { x: margin, y: ph - 52, size: 8, color: rgb(1, 1, 1), font });
  const titleText = internal ? 'Marked-Up Drawing \u2014 Internal' : 'Marked-Up Drawing';
  page.drawText(titleText, { x: pw - margin - titleW, y: ph - 38, size: 14, color: rgb(1, 1, 1), font: fontBold });

  // Metadata box
  const metaY = ph - 100;
  const metaH = 180;
  page.drawRectangle({ x: margin, y: metaY - metaH, width: pw - margin * 2, height: metaH, borderColor: rgb(0.89, 0.91, 0.94), borderWidth: 1, color: rgb(0.98, 0.99, 1) });

  const labelColor = rgb(0.38, 0.43, 0.53);
  const valColor = rgb(0.11, 0.16, 0.27);
  const orangeColor = rgb(0.976, 0.451, 0.133);
  let y = metaY - 24;
  const rowGap = 24;
  const colL = margin + 16;
  const colR = margin + (pw - margin * 2) / 2 + 16;

  function metaRow(yPos: number, label: string, val: string, x: number, valColorOverride?: { r: number; g: number; b: number }) {
    page.drawText(label.toUpperCase(), { x, y: yPos, size: 8, color: labelColor, font: fontBold });
    page.drawText(val, { x, y: yPos - 12, size: 11, color: valColorOverride ?? valColor, font });
  }

  metaRow(y, 'Tender Name', tenderName, colL); metaRow(y, 'Drawing Number', drawing.drawing_number || '\u2014', colR, orangeColor); y -= rowGap;
  metaRow(y, 'Tender Reference', tenderRef, colL, orangeColor); metaRow(y, 'Drawing Title', drawing.title, colR); y -= rowGap;
  metaRow(y, 'Drawing Revision', drawing.revision, colL); metaRow(y, 'Discipline', drawing.discipline, colR); y -= rowGap;
  metaRow(y, 'Export Date', exportDate, colL); metaRow(y, 'Page Count', String(drawing.page_count), colR); y -= rowGap;
  metaRow(y, 'Take-Off Items', String(items.length), colL); metaRow(y, 'Visible Items', String(items.filter(i => i.is_visible).length), colR);

  // Footer
  page.drawLine({ start: { x: margin, y: 50 }, end: { x: pw - margin, y: 50 }, thickness: 0.5, color: rgb(0.89, 0.91, 0.94) });
  page.drawText('Powered by VYSITE', { x: margin, y: 36, size: 10, color: orangeColor, font: fontBold });
  page.drawText(`Generated ${exportDate} \u00B7 ${tenderRef}`, { x: margin, y: 22, size: 8, color: rgb(0.38, 0.43, 0.53), font });
  if (internal) {
    const confText = 'Commercially Sensitive \u2014 Internal Only';
    const confW = fontBold.widthOfTextAtSize(confText, 8);
    page.drawText(confText, { x: pw - margin - confW, y: 36, size: 8, color: rgb(0.86, 0.15, 0.15), font: fontBold });
  }
}
