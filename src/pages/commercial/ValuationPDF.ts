import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib';
import type { DBValuation, DBWorkbookLine, DBWorkbookExtra, DBValuationLineEntry, DBValuationExtraEntry } from '../../lib/store';
import type { Project } from '../../data/types';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface LineData {
  line: DBWorkbookLine;
  entry: DBValuationLineEntry;
}

export interface ExtraData {
  extra: DBWorkbookExtra;
  entry: DBValuationExtraEntry;
}

export interface ValuationTotals {
  contractOriginal:  number;
  contractPrevValue: number;
  contractCurrValue: number;
  contractThisVal:   number;
  extrasOriginal:    number;
  extrasPrevValue:   number;
  extrasCurrValue:   number;
  extrasThisVal:     number;
  grossToDate:       number;
  previousTotal:     number;
  amountDue:         number;
}

export async function buildValuationPdf(
  valuation: DBValuation,
  project: Project,
  lineData: LineData[],
  extraData: ExtraData[],
  totals: ValuationTotals,
): Promise<void> {
  _pageCount = 0;

  const doc     = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);

  const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const ctx: Ctx = { doc, regular, bold, valuation, project, issueDate };

  addCoverPage(ctx);
  addContractLinesPage(ctx, lineData);
  if (extraData.length > 0) addExtrasPage(ctx, extraData);
  addSummaryPage(ctx, totals);

  const bytes = await doc.save();
  const blob  = new Blob([bytes], { type: 'application/pdf' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = `${san(valuation.ref)}-${san(valuation.title).replace(/\s+/g, '-')}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PW = 841.89;
const PH = 595.28;
const ML = 46;
const MR = 46;
const CW = PW - ML - MR;

const HDR_H = 56;
const FTR_H = 36;
const CT    = PH - HDR_H;
const CB    = FTR_H;

const C_DARK   = rgb(0.038, 0.059, 0.118);
const C_INK    = rgb(0.055, 0.086, 0.161);
const C_BODY   = rgb(0.118, 0.176, 0.298);
const C_MID    = rgb(0.271, 0.329, 0.427);
const C_MUTED  = rgb(0.580, 0.635, 0.725);
const C_FAINT  = rgb(0.882, 0.906, 0.929);
const C_ORANGE = rgb(0.976, 0.451, 0.086);
const C_GREEN  = rgb(0.063, 0.733, 0.506);
const C_PANEL  = rgb(0.973, 0.980, 0.988);

interface Ctx {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  valuation: DBValuation;
  project: Project;
  issueDate: string;
}

let _pageCount = 0;

// ─── Page helpers ─────────────────────────────────────────────────────────────

function newPage(ctx: Ctx): { page: PDFPage; y: number } {
  _pageCount++;
  const page = ctx.doc.addPage([PW, PH]);

  // Top accent bar
  page.drawRectangle({ x: 0, y: PH - 4, width: PW, height: 4, color: C_ORANGE });

  // Header background
  page.drawRectangle({ x: 0, y: PH - HDR_H, width: PW, height: HDR_H - 4, color: rgb(0.027, 0.047, 0.094) });

  // Company / project name
  dt(page, ctx.bold, san(ctx.project.name || 'VYSITE'), ML, PH - 22, 9.5, rgb(0.95, 0.97, 1.0));
  // Valuation ref right-aligned
  const refStr = san(ctx.valuation.ref);
  const rw = ctx.bold.widthOfTextAtSize(refStr, 8);
  dt(page, ctx.bold, refStr, PW - MR - rw, PH - 22, 8, C_ORANGE);
  // Title below ref
  const titleStr = san(ctx.valuation.title);
  const tw2 = ctx.regular.widthOfTextAtSize(titleStr, 7);
  dt(page, ctx.regular, titleStr, PW - MR - tw2, PH - 34, 7, C_MUTED);

  // Header bottom rule
  page.drawLine({ start: { x: 0, y: CT }, end: { x: PW, y: CT }, thickness: 0.5, color: C_ORANGE });

  // Footer background
  page.drawRectangle({ x: 0, y: 0, width: PW, height: FTR_H, color: rgb(0.027, 0.047, 0.094) });

  // Footer: left = system name + issue date
  dt(page, ctx.bold, 'VYSITE', ML, CB - 12, 7, C_ORANGE, { ls: 1 });
  dt(page, ctx.regular, `Valuation Management  ·  Issued ${ctx.issueDate}`, ML + 38, CB - 12, 6.5, C_MUTED);

  // Footer: right = page number
  const pgStr = `Page ${_pageCount}`;
  const pgW   = ctx.bold.widthOfTextAtSize(pgStr, 7);
  dt(page, ctx.bold, pgStr, PW - MR - pgW, CB - 12, 7, C_MUTED);

  return { page, y: CT - 14 };
}

// ─── Cover page ───────────────────────────────────────────────────────────────

function addCoverPage(ctx: Ctx) {
  const { page, y: startY } = newPage(ctx);
  let y = startY;

  // Left accent rule
  page.drawRectangle({ x: ML - 6, y: CB + FTR_H, width: 3, height: CT - CB - FTR_H, color: C_ORANGE });

  // Eyebrow
  dt(page, ctx.regular, 'COMMERCIAL VALUATION', ML, y, 8, C_MUTED, { ls: 2 });
  y -= 10;

  // Divider under eyebrow
  page.drawLine({ start: { x: ML, y: y }, end: { x: ML + CW * 0.6, y }, thickness: 0.5, color: C_FAINT });
  y -= 22;

  // Main title
  wrapText(page, ctx.bold, san(ctx.valuation.title), ML, y, CW * 0.6, 26, C_INK, 34);
  y -= 10 + 34;

  // Ref pill
  const refW = ctx.bold.widthOfTextAtSize(ctx.valuation.ref, 10) + 20;
  page.drawRectangle({ x: ML, y: y - 16, width: refW, height: 20, color: C_PANEL, borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 2 });
  dt(page, ctx.bold, ctx.valuation.ref, ML + 10, y - 7, 10, C_BODY);
  y -= 28;

  // Issue date label
  dt(page, ctx.regular, `Issued: ${ctx.issueDate}`, ML, y, 8.5, C_MID);
  y -= 6;

  // Metadata right panel
  const META_X = PW / 2 + 10;
  const META_W = PW - MR - META_X;
  const mFields: [string, string][] = [
    ['Project',        ctx.project.name || ''],
    ['Client',         ctx.valuation.client || ''],
    ['Contractor',     ctx.valuation.contractor || ''],
    ['Valuation Date', fmtDate(ctx.valuation.valuation_date)],
    ['Issue Date',     ctx.issueDate],
    ['Period',         ctx.valuation.period || ''],
    ['Status',         capitalize(ctx.valuation.status)],
  ].filter(([, v]) => v) as [string, string][];

  mFields.forEach(([label, value], i) => {
    const my = startY - i * 36;
    if (my < CB + FTR_H + 30) return;
    dt(page, ctx.regular, label.toUpperCase(), META_X, my, 6.5, C_MUTED, { ls: 1.2 });
    wrapText(page, ctx.bold, san(value), META_X, my - 13, META_W, 10, C_BODY, 14);
    page.drawLine({ start: { x: META_X, y: my - 26 }, end: { x: PW - MR, y: my - 26 }, thickness: 0.3, color: C_FAINT });
  });

  if (ctx.valuation.notes) {
    const noteY = Math.min(startY - mFields.length * 36 - 14, y - 36);
    if (noteY > CB + FTR_H + 50) {
      const panH = 56;
      page.drawRectangle({ x: ML, y: noteY - panH, width: CW * 0.5, height: panH, color: C_PANEL, borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 3 });
      dt(page, ctx.bold, 'NOTES', ML + 10, noteY - 10, 7, C_MUTED, { ls: 1 });
      wrapText(page, ctx.regular, san(ctx.valuation.notes), ML + 10, noteY - 24, CW * 0.5 - 20, 9, C_MID, 13);
    }
  }
}

// ─── Contract lines page ──────────────────────────────────────────────────────

const LINE_H    = 16;
const LINE_FONT = 8.5;

function addContractLinesPage(ctx: Ctx, lineData: LineData[]) {
  if (lineData.length === 0) return;

  const { page: firstPage, y: startY } = newPage(ctx);
  let page = firstPage;
  let y    = startY;

  dt(page, ctx.bold, 'CONTRACT WORKS', ML, y, 8, C_MUTED, { ls: 1.5 });
  y -= 20;

  const COL = { num: 24, item: 22, desc: 155, sec: 70, unit: 26, qty: 36, rate: 50, cval: 68, ppct: 32, pval: 68, cpct: 32, cval2: 68, thisval: 68, notes: 0 };
  const fixedW = Object.values(COL).reduce((s, v) => s + v, 0);
  COL.notes = Math.max(0, CW - fixedW);

  const drawHeader = (p: PDFPage, hy: number) => {
    p.drawRectangle({ x: ML, y: hy - LINE_H + 2, width: CW, height: LINE_H, color: rgb(0.937, 0.953, 0.969) });
    let hx = ML;
    const hcols: [string, number, 'left' | 'right'][] = [
      ['#', COL.num, 'right'], ['Item', COL.item, 'left'], ['Description', COL.desc, 'left'],
      ['Section', COL.sec, 'left'], ['Unit', COL.unit, 'left'], ['Qty', COL.qty, 'right'],
      ['Rate', COL.rate, 'right'], ['Cont. Value', COL.cval, 'right'],
      ['Prev %', COL.ppct, 'right'], ['Prev Value', COL.pval, 'right'],
      ['Curr %', COL.cpct, 'right'], ['Curr Value', COL.cval2, 'right'],
      ['This Val', COL.thisval + COL.notes, 'right'],
    ];
    for (const [label, w, align] of hcols) {
      const tw = ctx.bold.widthOfTextAtSize(label, 7);
      dt(p, ctx.bold, label, align === 'right' ? hx + w - tw - 2 : hx + 2, hy - 5, 7, C_MUTED);
      hx += w;
    }
  };

  drawHeader(page, y);
  y -= LINE_H;

  for (let i = 0; i < lineData.length; i++) {
    const { line, entry } = lineData[i];
    if (y - LINE_H < CB + 16) {
      const np = newPage(ctx);
      page = np.page;
      y    = np.y;
      dt(page, ctx.bold, 'CONTRACT WORKS  —  continued', ML, y, 8, C_MUTED, { ls: 1.5 });
      y -= 20;
      drawHeader(page, y);
      y -= LINE_H;
    }

    const prevVal = line.contract_value * entry.previous_pct / 100;
    const currVal = line.contract_value * entry.current_pct  / 100;
    const thisVal = currVal - prevVal;
    if (i % 2 === 0) page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: C_PANEL });

    let x = ML;
    const cell = (text: string, w: number, align: 'left' | 'right' = 'left', font: PDFFont = ctx.regular, color: ReturnType<typeof rgb> = C_BODY) => {
      const s = san(text);
      if (s) {
        const tw = font.widthOfTextAtSize(s, LINE_FONT);
        const tx = align === 'right' ? x + w - tw - 2 : x + 2;
        const display = align === 'left' && tw > w - 4 ? s.slice(0, Math.floor(s.length * (w - 4) / tw)) + '\x85' : s;
        dt(page, font, display, align === 'right' ? x + w - font.widthOfTextAtSize(display, LINE_FONT) - 2 : x + 2, y - LINE_H + 5, LINE_FONT, color);
      }
      x += w;
    };

    cell(String(i + 1), COL.num, 'right', ctx.regular, C_MUTED);
    cell(line.item_number ?? '', COL.item);
    cell(line.description, COL.desc, 'left', ctx.regular, C_BODY);
    cell(line.section ?? '', COL.sec, 'left', ctx.regular, C_MUTED);
    cell(line.unit ?? '', COL.unit, 'left', ctx.regular, C_MUTED);
    cell(line.quantity != null ? fmtNum(line.quantity) : '', COL.qty, 'right', ctx.regular, C_MUTED);
    cell(line.rate != null ? fmtNum(line.rate) : '', COL.rate, 'right', ctx.regular, C_MUTED);
    cell(fmtNum(line.contract_value), COL.cval, 'right', ctx.bold, C_BODY);
    cell(fmtPct(entry.previous_pct), COL.ppct, 'right', ctx.regular, C_MUTED);
    cell(fmtNum(prevVal), COL.pval, 'right', ctx.regular, C_MUTED);
    cell(fmtPct(entry.current_pct), COL.cpct, 'right', ctx.bold, C_BODY);
    cell(fmtNum(currVal), COL.cval2, 'right', ctx.bold, C_BODY);
    cell(fmtNum(thisVal), COL.thisval + COL.notes, 'right', ctx.bold, thisVal > 0 ? C_GREEN : C_BODY);

    y -= LINE_H;
  }

  // Subtotal
  const total     = lineData.reduce((s, d) => s + d.line.contract_value, 0);
  const prevTotal = lineData.reduce((s, d) => s + d.line.contract_value * d.entry.previous_pct / 100, 0);
  const currTotal = lineData.reduce((s, d) => s + d.line.contract_value * d.entry.current_pct  / 100, 0);
  const thisTotal = currTotal - prevTotal;

  page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: rgb(0.918, 0.937, 0.957) });
  dt(page, ctx.bold, 'Subtotal — Contract Works', ML + 2, y - LINE_H + 5, 8, C_BODY);

  const baseX = ML + COL.num + COL.item + COL.desc + COL.sec + COL.unit + COL.qty + COL.rate;
  const stotals: [number, number][] = [
    [total, COL.cval], [0, COL.ppct], [prevTotal, COL.pval],
    [0, COL.cpct], [currTotal, COL.cval2], [thisTotal, COL.thisval + COL.notes],
  ];
  let stx = baseX;
  stotals.forEach(([v, w], i) => {
    if (i !== 1 && i !== 3) {
      const s  = fmtNum(v);
      const sw = ctx.bold.widthOfTextAtSize(s, 8.5);
      dt(page, ctx.bold, s, stx + w - sw - 2, y - LINE_H + 5, 8.5, i === 5 && v > 0 ? C_GREEN : C_INK);
    }
    stx += w;
  });
}

// ─── Extras page ──────────────────────────────────────────────────────────────

function addExtrasPage(ctx: Ctx, extraData: ExtraData[]) {
  const { page: firstPage, y: startY } = newPage(ctx);
  let page = firstPage;
  let y    = startY;

  dt(page, ctx.bold, 'EXTRAS / AGREED VARIATIONS', ML, y, 8, C_MUTED, { ls: 1.5 });
  y -= 20;

  const COL = { ref: 40, desc: 200, agreed: 80, ppct: 38, pval: 80, cpct: 38, cval: 80, thisval: 80, notes: 0 };
  const fixedW = Object.values(COL).reduce((s, v) => s + v, 0);
  COL.notes = Math.max(0, CW - fixedW);

  page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: rgb(0.937, 0.953, 0.969) });
  let hx = ML;
  for (const [label, w] of [
    ['Ref', COL.ref], ['Description', COL.desc], ['Agreed Value', COL.agreed],
    ['Prev %', COL.ppct], ['Prev Value', COL.pval], ['Curr %', COL.cpct],
    ['Curr Value', COL.cval], ['This Val', COL.thisval + COL.notes],
  ] as [string, number][]) {
    dt(page, ctx.bold, label, hx + 2, y - 5, 7, C_MUTED);
    hx += w;
  }
  y -= LINE_H;

  for (let i = 0; i < extraData.length; i++) {
    const { extra, entry } = extraData[i];
    if (y - LINE_H < CB + 16) {
      const np = newPage(ctx);
      page = np.page;
      y    = np.y;
    }

    const prevVal = extra.agreed_value * entry.previous_pct / 100;
    const currVal = extra.agreed_value * entry.current_pct  / 100;
    const thisVal = currVal - prevVal;
    if (i % 2 === 0) page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: C_PANEL });

    let tx = ML;
    const ec = (text: string, w: number, align: 'left' | 'right' = 'left', font: PDFFont = ctx.regular, color: ReturnType<typeof rgb> = C_BODY) => {
      const s = san(text);
      if (s) {
        const sw = font.widthOfTextAtSize(s, LINE_FONT);
        dt(page, font, s, align === 'right' ? tx + w - sw - 2 : tx + 2, y - LINE_H + 5, LINE_FONT, color);
      }
      tx += w;
    };

    ec(extra.ref ?? '', COL.ref, 'left', ctx.regular, C_MUTED);
    ec(extra.description, COL.desc);
    ec(fmtNum(extra.agreed_value), COL.agreed, 'right', ctx.bold, C_BODY);
    ec(fmtPct(entry.previous_pct), COL.ppct, 'right', ctx.regular, C_MUTED);
    ec(fmtNum(prevVal), COL.pval, 'right', ctx.regular, C_MUTED);
    ec(fmtPct(entry.current_pct), COL.cpct, 'right', ctx.bold, C_BODY);
    ec(fmtNum(currVal), COL.cval, 'right', ctx.bold, C_BODY);
    ec(fmtNum(thisVal), COL.thisval + COL.notes, 'right', ctx.bold, thisVal > 0 ? C_GREEN : C_BODY);

    y -= LINE_H;
  }

  const agreedTotal = extraData.reduce((s, d) => s + d.extra.agreed_value, 0);
  const prevTotal   = extraData.reduce((s, d) => s + d.extra.agreed_value * d.entry.previous_pct / 100, 0);
  const currTotal   = extraData.reduce((s, d) => s + d.extra.agreed_value * d.entry.current_pct  / 100, 0);
  const thisTotal   = currTotal - prevTotal;

  page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: rgb(0.918, 0.937, 0.957) });
  dt(page, ctx.bold, 'Subtotal — Extras / Agreed Variations', ML + 2, y - LINE_H + 5, 8, C_BODY);

  const baseX = ML + COL.ref + COL.desc;
  const stotals: [number, number][] = [
    [agreedTotal, COL.agreed], [0, COL.ppct], [prevTotal, COL.pval],
    [0, COL.cpct], [currTotal, COL.cval], [thisTotal, COL.thisval + COL.notes],
  ];
  let stx = baseX;
  stotals.forEach(([v, w], i) => {
    if (i !== 1 && i !== 3) {
      const s  = fmtNum(v);
      const sw = ctx.bold.widthOfTextAtSize(s, 8.5);
      dt(page, ctx.bold, s, stx + w - sw - 2, y - LINE_H + 5, 8.5, i === 5 && v > 0 ? C_GREEN : C_INK);
    }
    stx += w;
  });
}

// ─── Summary page ─────────────────────────────────────────────────────────────

function addSummaryPage(ctx: Ctx, totals: ValuationTotals) {
  const { page, y: startY } = newPage(ctx);
  let y = startY;

  dt(page, ctx.bold, 'VALUATION SUMMARY', ML, y, 8, C_MUTED, { ls: 1.5 });
  y -= 28;
  dt(page, ctx.bold, 'Amount Due This Valuation', ML, y, 22, C_INK);
  y -= 6;
  page.drawRectangle({ x: ML, y: y - 3, width: 44, height: 3, color: C_ORANGE });
  y -= 36;

  const summaryRows: [string, number, boolean][] = [
    ['Original Contract Value',         totals.contractOriginal, false],
    ['Extras / Agreed Variations Total', totals.extrasOriginal,   false],
    ['Gross Valuation to Date',          totals.grossToDate,      true],
    ['Less: Previous Valuation Total',   -totals.previousTotal,   false],
  ];

  const COL_LABEL_W = 320;
  const COL_VAL_W   = 120;

  for (const [label, value, isBold] of summaryRows) {
    const font  = isBold ? ctx.bold : ctx.regular;
    const color = isBold ? C_INK : C_MID;
    const display = value < 0 ? `(${fmtNum(Math.abs(value))})` : fmtNum(value);
    dt(page, font, san(label), ML, y, 11, color);
    const vw = font.widthOfTextAtSize(display, 11);
    dt(page, font, display, ML + COL_LABEL_W + COL_VAL_W - vw, y, 11, color);
    page.drawLine({ start: { x: ML, y: y - 10 }, end: { x: ML + COL_LABEL_W + COL_VAL_W, y: y - 10 }, thickness: 0.3, color: C_FAINT });
    y -= 26;
  }

  y -= 6;
  const boxH = 52;
  page.drawRectangle({ x: ML, y: y - boxH, width: COL_LABEL_W + COL_VAL_W, height: boxH,
    color: rgb(0.941, 0.996, 0.957), borderColor: rgb(0.063, 0.733, 0.506), borderWidth: 1.5, borderRadius: 4 });
  dt(page, ctx.regular, 'AMOUNT DUE THIS VALUATION', ML + 14, y - 14, 8, C_MUTED, { ls: 1 });
  dt(page, ctx.bold, fmtNum(totals.amountDue), ML + 14, y - 36, 22, C_GREEN);

  // Notes panel
  const noteX = PW / 2 + 20;
  dt(page, ctx.bold, 'NOTES & ASSUMPTIONS', noteX, startY, 8, C_MUTED, { ls: 1 });
  page.drawLine({ start: { x: noteX, y: startY - 12 }, end: { x: PW - MR, y: startY - 12 }, thickness: 0.5, color: C_FAINT });
  const note = ctx.valuation.notes || 'No notes recorded for this valuation.';
  wrapText(page, ctx.regular, san(note), noteX, startY - 24, PW - MR - noteX, 10, C_MID, 15);

  // Issue / certification block
  const sigFloor = CB + FTR_H + 36;
  const sigY = sigFloor + 14;
  page.drawLine({ start: { x: ML, y: sigFloor + 28 }, end: { x: ML + 3 * 170, y: sigFloor + 28 }, thickness: 0.3, color: C_FAINT });
  ['Prepared by', 'Checked by', 'Certified by'].forEach((label, i) => {
    const sx = ML + i * 170;
    dt(page, ctx.regular, label.toUpperCase(), sx, sigY + 20, 6.5, C_MUTED, { ls: 0.8 });
    page.drawLine({ start: { x: sx, y: sigY }, end: { x: sx + 145, y: sigY }, thickness: 0.5, color: C_FAINT });
    dt(page, ctx.regular, 'Signature / Date', sx, sigY - 10, 6.5, C_FAINT);
  });

  // Issue date note
  const issuedStr = `Issued: ${ctx.issueDate}`;
  const issuedW = ctx.regular.widthOfTextAtSize(issuedStr, 7);
  dt(page, ctx.regular, issuedStr, PW - MR - issuedW, sigFloor - 8, 7, C_MUTED);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TextOpts = { ls?: number };

function dt(p: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, color: ReturnType<typeof rgb>, opts: TextOpts = {}) {
  const s = san(text);
  if (!s) return;
  p.drawText(s, { x, y, size, font, color, characterSpacing: opts.ls ?? 0 });
}

function wrapText(p: PDFPage, font: PDFFont, text: string, x: number, y: number, maxW: number, size: number, color: ReturnType<typeof rgb>, lineH: number): number {
  if (!text) return y;
  const words = san(text).replace(/[\r\n]+/g, ' ').split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  let cy = y;
  for (const line of lines) {
    p.drawText(line, { x, y: cy, size, font, color });
    cy -= lineH;
  }
  return cy;
}

const WIN_ANSI: [RegExp, string][] = [
  [/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''],
  [/\u0085/g, '...'],
  [/[ÀÁÂÃÄÅ]/g, 'A'], [/[àáâãäå]/g, 'a'],
  [/[ÈÉÊË]/g, 'E'],   [/[èéêë]/g, 'e'],
  [/[ÌÍÎÏ]/g, 'I'],   [/[ìíîï]/g, 'i'],
  [/[ÒÓÔÕÖ]/g, 'O'],  [/[òóôõö]/g, 'o'],
  [/[ÙÚÛÜ]/g, 'U'],   [/[ùúûü]/g, 'u'],
  [/Ç/g, 'C'],        [/ç/g, 'c'],
  [/[ŁłĐđ]/g, '-'],
  [/[^\x20-\xFF]/g, ''],
];
function san(text: string): string {
  if (!text) return '';
  let out = text;
  for (const [re, r] of WIN_ANSI) out = out.replace(re, r);
  return out;
}

function fmtNum(v: number): string {
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return iso; }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// Suppress unused
void C_DARK;
void HDR_H;
void FTR_H;
type _Img = PDFImage; void (null as unknown as _Img);
