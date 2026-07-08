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
  retentionPct?:     number;
  retentionAmt?:     number;
  mcdPct?:           number;
  mcdAmt?:           number;
  netValuation?:     number;
}

export async function buildValuationPdf(
  valuation: DBValuation,
  project: Project,
  lineData: LineData[],
  extraData: ExtraData[],
  totals: ValuationTotals,
  logoDataUrl?: string,
  companyName?: string,
): Promise<void> {
  _pageCount = 0;

  const doc     = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);

  const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  let logoImg: PDFImage | null = null;
  if (logoDataUrl) {
    try { logoImg = await embedImage(doc, logoDataUrl); } catch { logoImg = null; }
  }

  const ctx: Ctx = { doc, regular, bold, valuation, project, issueDate, logoImg, companyName };

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
const ML = 48;
const MR = 48;
const CW = PW - ML - MR;

// Clean white layout — minimal chrome
const HDR_H = 52;    // header zone height
const FTR_H = 28;    // footer zone height
const CT    = PH - HDR_H;
const CB    = FTR_H;

// White-document palette — no heavy dark backgrounds
const C_INK    = rgb(0.055, 0.086, 0.161);   // near-black text
const C_BODY   = rgb(0.118, 0.176, 0.298);   // mid-dark text
const C_MID    = rgb(0.380, 0.439, 0.537);   // secondary text
const C_MUTED  = rgb(0.565, 0.620, 0.710);   // labels / placeholders
const C_FAINT  = rgb(0.882, 0.906, 0.929);   // hairlines / dividers
const C_LIGHT  = rgb(0.949, 0.961, 0.973);   // table stripe (very light grey)
const C_RULE   = rgb(0.910, 0.925, 0.941);   // slightly stronger rule
const C_ORANGE = rgb(0.976, 0.451, 0.086);   // VYSITE orange
const C_GREEN  = rgb(0.059, 0.647, 0.435);   // emerald amount-due
const C_PANEL  = rgb(0.973, 0.980, 0.988);   // meta-block fill

interface Ctx {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  valuation: DBValuation;
  project: Project;
  issueDate: string;
  logoImg: PDFImage | null;
  companyName?: string;
}

let _pageCount = 0;

// ─── Image embedding ──────────────────────────────────────────────────────────

async function embedImage(doc: PDFDocument, dataUrl: string): Promise<PDFImage> {
  const [meta, b64] = dataUrl.split(',');
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (meta.includes('png')) return doc.embedPng(bytes);
  return doc.embedJpg(bytes);
}

// ─── Page factory — clean white chrome ────────────────────────────────────────

function newPage(ctx: Ctx): { page: PDFPage; y: number } {
  _pageCount++;
  const page = ctx.doc.addPage([PW, PH]);

  // ── Top orange accent bar (thin, 3pt) ──────────────────────────────────────
  page.drawRectangle({ x: 0, y: PH - 3, width: PW, height: 3, color: C_ORANGE });

  // ── Header: logo or company name (left) + ref / title (right) ─────────────
  const hTextY = PH - 28;

  if (ctx.logoImg) {
    const { width: iW, height: iH } = ctx.logoImg.size();
    const logoH = 22;
    const logoW = (iW / iH) * logoH;
    page.drawImage(ctx.logoImg, { x: ML, y: hTextY - 16, width: logoW, height: logoH, opacity: 0.92 });
  } else {
    const nameStr = san(ctx.companyName || ctx.project.name || 'VYSITE');
    dt(page, ctx.bold, nameStr, ML, hTextY, 9, C_INK);
  }

  // Ref pill (right-aligned, orange)
  const refStr = san(ctx.valuation.ref);
  const rw = ctx.bold.widthOfTextAtSize(refStr, 8);
  dt(page, ctx.bold, refStr, PW - MR - rw, hTextY, 8, C_ORANGE);

  // Valuation title — line below ref
  const titleStr = san(ctx.valuation.title);
  const tw = ctx.regular.widthOfTextAtSize(titleStr, 7);
  dt(page, ctx.regular, titleStr, PW - MR - tw, hTextY - 13, 7, C_MUTED);

  // Header bottom rule
  page.drawLine({ start: { x: ML, y: CT }, end: { x: PW - MR, y: CT }, thickness: 0.5, color: C_RULE });

  // ── Footer ─────────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: ML, y: CB }, end: { x: PW - MR, y: CB }, thickness: 0.3, color: C_FAINT });

  // Left: VYSITE brand + issue date
  dt(page, ctx.bold, 'VYSITE', ML, CB - 13, 6.5, C_ORANGE, { ls: 0.5 });
  dt(page, ctx.regular, `  Valuation Management  \xB7  Issued ${ctx.issueDate}`, ML + 28, CB - 13, 6.5, C_MUTED);

  // Right: page number
  const pgStr = `Page ${_pageCount}`;
  const pgW   = ctx.regular.widthOfTextAtSize(pgStr, 6.5);
  dt(page, ctx.regular, pgStr, PW - MR - pgW, CB - 13, 6.5, C_MUTED);

  return { page, y: CT - 14 };
}

// ─── Cover page ───────────────────────────────────────────────────────────────

function addCoverPage(ctx: Ctx) {
  const { page, y: startY } = newPage(ctx);
  let y = startY;

  // Left orange accent rule (subtle, 2pt)
  page.drawRectangle({ x: ML - 8, y: CB + 2, width: 2, height: CT - CB - 4, color: C_ORANGE });

  // Eyebrow
  dt(page, ctx.regular, 'COMMERCIAL VALUATION', ML, y, 7.5, C_MUTED, { ls: 2 });
  y -= 10;

  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW * 0.58, y }, thickness: 0.4, color: C_FAINT });
  y -= 24;

  // Main title (large, dark)
  wrapText(page, ctx.bold, san(ctx.valuation.title), ML, y, CW * 0.58, 24, C_INK, 32);
  y -= 8 + 32;

  // Reference pill
  const refW = ctx.bold.widthOfTextAtSize(ctx.valuation.ref, 9.5) + 18;
  page.drawRectangle({ x: ML, y: y - 14, width: refW, height: 18, color: rgb(1, 0.957, 0.937), borderColor: C_ORANGE, borderWidth: 0.75, borderRadius: 3 });
  dt(page, ctx.bold, ctx.valuation.ref, ML + 9, y - 6, 9.5, C_ORANGE);
  y -= 26;

  // Issue date
  dt(page, ctx.regular, `Issued: ${ctx.issueDate}`, ML, y, 8.5, C_MID);
  y -= 6;

  // ── Metadata panel (right half of page) ──────────────────────────────────

  const META_X = PW * 0.52;
  const META_W = PW - MR - META_X;

  // Light panel background
  page.drawRectangle({ x: META_X - 10, y: CB + 2, width: META_W + 20, height: CT - CB - 4, color: C_PANEL, borderRadius: 0 });

  const mFields: [string, string][] = [
    ['Project',        ctx.project.name || ''],
    ['Client',         ctx.valuation.client || ''],
    ['Contractor',     ctx.valuation.contractor || ''],
    ['Valuation Date', fmtDate(ctx.valuation.valuation_date)],
    ['Issue Date',     ctx.issueDate],
    ['Period',         ctx.valuation.period || ''],
    ['Status',         capitalize(ctx.valuation.status)],
  ].filter(([, v]) => v) as [string, string][];

  let my = startY - 4;
  for (const [label, value] of mFields) {
    if (my < CB + 24) break;
    dt(page, ctx.regular, label.toUpperCase(), META_X, my, 6, C_MUTED, { ls: 1 });
    wrapText(page, ctx.bold, san(value), META_X, my - 12, META_W, 9.5, C_BODY, 13);
    page.drawLine({ start: { x: META_X, y: my - 25 }, end: { x: PW - MR, y: my - 25 }, thickness: 0.3, color: C_FAINT });
    my -= 35;
  }

  // Notes block (left side, below title area)
  if (ctx.valuation.notes) {
    const noteY = y - 30;
    if (noteY > CB + 60) {
      const panH = 58;
      page.drawRectangle({ x: ML, y: noteY - panH, width: CW * 0.48, height: panH,
        color: C_PANEL, borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 4 });
      page.drawRectangle({ x: ML, y: noteY - panH, width: 3, height: panH, color: C_ORANGE, borderRadius: 2 });
      dt(page, ctx.bold, 'NOTES', ML + 10, noteY - 11, 6.5, C_MUTED, { ls: 0.8 });
      wrapText(page, ctx.regular, san(ctx.valuation.notes), ML + 10, noteY - 24, CW * 0.48 - 20, 9, C_MID, 13);
    }
  }
}

// ─── Contract lines page ──────────────────────────────────────────────────────

const LINE_H    = 15;
const LINE_FONT = 8;

function addContractLinesPage(ctx: Ctx, lineData: LineData[]) {
  if (lineData.length === 0) return;

  const { page: firstPage, y: startY } = newPage(ctx);
  let page = firstPage;
  let y    = startY;

  dt(page, ctx.bold, 'CONTRACT WORKS', ML, y, 7.5, C_MUTED, { ls: 1.5 });
  y -= 18;

  const COL = { num: 24, item: 22, desc: 152, sec: 68, unit: 26, qty: 36, rate: 50, cval: 66, ppct: 32, pval: 66, cpct: 32, cval2: 66, thisval: 66, notes: 0 };
  const fixedW = Object.values(COL).reduce((s, v) => s + v, 0);
  COL.notes = Math.max(0, CW - fixedW);

  const drawHeader = (p: PDFPage, hy: number) => {
    p.drawRectangle({ x: ML, y: hy - LINE_H + 2, width: CW, height: LINE_H, color: C_LIGHT });
    // Bottom rule under header
    p.drawLine({ start: { x: ML, y: hy - LINE_H + 2 }, end: { x: ML + CW, y: hy - LINE_H + 2 }, thickness: 0.5, color: C_RULE });
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
      const tw = ctx.bold.widthOfTextAtSize(label, 6.5);
      dt(p, ctx.bold, label, align === 'right' ? hx + w - tw - 2 : hx + 2, hy - 5, 6.5, C_MUTED);
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
      dt(page, ctx.bold, 'CONTRACT WORKS  —  continued', ML, y, 7.5, C_MUTED, { ls: 1.5 });
      y -= 18;
      drawHeader(page, y);
      y -= LINE_H;
    }

    const prevVal = line.contract_value * entry.previous_pct / 100;
    const currVal = line.contract_value * entry.current_pct  / 100;
    const thisVal = currVal - prevVal;

    // Alternating row shading (very subtle)
    if (i % 2 === 0) page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: rgb(0.980, 0.984, 0.992) });
    // Thin row separator
    page.drawLine({ start: { x: ML, y: y - LINE_H + 2 }, end: { x: ML + CW, y: y - LINE_H + 2 }, thickness: 0.2, color: C_FAINT });

    let x = ML;
    const cell = (text: string, w: number, align: 'left' | 'right' = 'left', font: PDFFont = ctx.regular, color: ReturnType<typeof rgb> = C_BODY) => {
      const s = san(text);
      if (s) {
        const tw = font.widthOfTextAtSize(s, LINE_FONT);
        const display = align === 'left' && tw > w - 4 ? s.slice(0, Math.floor(s.length * (w - 4) / tw)) + '...' : s;
        const dispW = font.widthOfTextAtSize(display, LINE_FONT);
        dt(page, font, display, align === 'right' ? x + w - dispW - 2 : x + 2, y - LINE_H + 4, LINE_FONT, color);
      }
      x += w;
    };

    cell(String(i + 1), COL.num, 'right', ctx.regular, C_MUTED);
    cell(line.item_number ?? '', COL.item, 'left', ctx.regular, C_MUTED);
    cell(line.description, COL.desc, 'left', ctx.regular, C_BODY);
    cell(line.section ?? '', COL.sec, 'left', ctx.regular, C_MUTED);
    cell(line.unit ?? '', COL.unit, 'left', ctx.regular, C_MUTED);
    cell(line.quantity != null ? fmtNum(line.quantity) : '', COL.qty, 'right', ctx.regular, C_MUTED);
    cell(line.rate != null ? fmtNum(line.rate) : '', COL.rate, 'right', ctx.regular, C_MUTED);
    cell(fmtNum(line.contract_value), COL.cval, 'right', ctx.bold, C_BODY);
    cell(fmtPct(entry.previous_pct), COL.ppct, 'right', ctx.regular, C_MUTED);
    cell(fmtNum(prevVal), COL.pval, 'right', ctx.regular, C_MUTED);
    cell(fmtPct(entry.current_pct), COL.cpct, 'right', ctx.bold, C_ORANGE);
    cell(fmtNum(currVal), COL.cval2, 'right', ctx.bold, C_BODY);
    cell(fmtNum(thisVal), COL.thisval + COL.notes, 'right', ctx.bold, thisVal > 0 ? C_GREEN : (thisVal < 0 ? rgb(0.8, 0.2, 0.2) : C_BODY));

    y -= LINE_H;
  }

  // Subtotal row
  const total     = lineData.reduce((s, d) => s + d.line.contract_value, 0);
  const prevTotal = lineData.reduce((s, d) => s + d.line.contract_value * d.entry.previous_pct / 100, 0);
  const currTotal = lineData.reduce((s, d) => s + d.line.contract_value * d.entry.current_pct  / 100, 0);
  const thisTotal = currTotal - prevTotal;

  page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: C_LIGHT });
  page.drawLine({ start: { x: ML, y: y - LINE_H + 2 }, end: { x: ML + CW, y: y - LINE_H + 2 }, thickness: 0.5, color: C_RULE });
  page.drawLine({ start: { x: ML, y: y + 2 }, end: { x: ML + CW, y: y + 2 }, thickness: 0.5, color: C_RULE });
  dt(page, ctx.bold, 'Subtotal — Contract Works', ML + 2, y - LINE_H + 4, 8, C_BODY);

  const baseX = ML + COL.num + COL.item + COL.desc + COL.sec + COL.unit + COL.qty + COL.rate;
  const stotals: [number, number][] = [
    [total, COL.cval], [0, COL.ppct], [prevTotal, COL.pval],
    [0, COL.cpct], [currTotal, COL.cval2], [thisTotal, COL.thisval + COL.notes],
  ];
  let stx = baseX;
  stotals.forEach(([v, w], i) => {
    if (i !== 1 && i !== 3) {
      const s  = fmtNum(v);
      const sw = ctx.bold.widthOfTextAtSize(s, 8);
      dt(page, ctx.bold, s, stx + w - sw - 2, y - LINE_H + 4, 8, i === 5 && v > 0 ? C_GREEN : C_INK);
    }
    stx += w;
  });
}

// ─── Extras page ──────────────────────────────────────────────────────────────

function addExtrasPage(ctx: Ctx, extraData: ExtraData[]) {
  const { page: firstPage, y: startY } = newPage(ctx);
  let page = firstPage;
  let y    = startY;

  dt(page, ctx.bold, 'EXTRAS / AGREED VARIATIONS', ML, y, 7.5, C_MUTED, { ls: 1.5 });
  y -= 18;

  const COL = { ref: 40, desc: 196, agreed: 78, ppct: 38, pval: 78, cpct: 38, cval: 78, thisval: 78, notes: 0 };
  const fixedW = Object.values(COL).reduce((s, v) => s + v, 0);
  COL.notes = Math.max(0, CW - fixedW);

  page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: C_LIGHT });
  page.drawLine({ start: { x: ML, y: y - LINE_H + 2 }, end: { x: ML + CW, y: y - LINE_H + 2 }, thickness: 0.5, color: C_RULE });
  let hx = ML;
  for (const [label, w] of [
    ['Ref', COL.ref], ['Description', COL.desc], ['Agreed Value', COL.agreed],
    ['Prev %', COL.ppct], ['Prev Value', COL.pval], ['Curr %', COL.cpct],
    ['Curr Value', COL.cval], ['This Val', COL.thisval + COL.notes],
  ] as [string, number][]) {
    dt(page, ctx.bold, label, hx + 2, y - 5, 6.5, C_MUTED);
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

    if (i % 2 === 0) page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: rgb(0.980, 0.984, 0.992) });
    page.drawLine({ start: { x: ML, y: y - LINE_H + 2 }, end: { x: ML + CW, y: y - LINE_H + 2 }, thickness: 0.2, color: C_FAINT });

    let tx = ML;
    const ec = (text: string, w: number, align: 'left' | 'right' = 'left', font: PDFFont = ctx.regular, color: ReturnType<typeof rgb> = C_BODY) => {
      const s = san(text);
      if (s) {
        const sw = font.widthOfTextAtSize(s, LINE_FONT);
        dt(page, font, s, align === 'right' ? tx + w - sw - 2 : tx + 2, y - LINE_H + 4, LINE_FONT, color);
      }
      tx += w;
    };

    ec(extra.ref ?? '', COL.ref, 'left', ctx.regular, C_MUTED);
    ec(extra.description, COL.desc);
    ec(fmtNum(extra.agreed_value), COL.agreed, 'right', ctx.bold, C_BODY);
    ec(fmtPct(entry.previous_pct), COL.ppct, 'right', ctx.regular, C_MUTED);
    ec(fmtNum(prevVal), COL.pval, 'right', ctx.regular, C_MUTED);
    ec(fmtPct(entry.current_pct), COL.cpct, 'right', ctx.bold, C_ORANGE);
    ec(fmtNum(currVal), COL.cval, 'right', ctx.bold, C_BODY);
    ec(fmtNum(thisVal), COL.thisval + COL.notes, 'right', ctx.bold, thisVal > 0 ? C_GREEN : (thisVal < 0 ? rgb(0.8, 0.2, 0.2) : C_BODY));

    y -= LINE_H;
  }

  const agreedTotal = extraData.reduce((s, d) => s + d.extra.agreed_value, 0);
  const prevTotal   = extraData.reduce((s, d) => s + d.extra.agreed_value * d.entry.previous_pct / 100, 0);
  const currTotal   = extraData.reduce((s, d) => s + d.extra.agreed_value * d.entry.current_pct  / 100, 0);
  const thisTotal   = currTotal - prevTotal;

  page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: C_LIGHT });
  page.drawLine({ start: { x: ML, y: y - LINE_H + 2 }, end: { x: ML + CW, y: y - LINE_H + 2 }, thickness: 0.5, color: C_RULE });
  page.drawLine({ start: { x: ML, y: y + 2 }, end: { x: ML + CW, y: y + 2 }, thickness: 0.5, color: C_RULE });
  dt(page, ctx.bold, 'Subtotal — Extras / Agreed Variations', ML + 2, y - LINE_H + 4, 8, C_BODY);

  const baseX = ML + COL.ref + COL.desc;
  const stotals: [number, number][] = [
    [agreedTotal, COL.agreed], [0, COL.ppct], [prevTotal, COL.pval],
    [0, COL.cpct], [currTotal, COL.cval], [thisTotal, COL.thisval + COL.notes],
  ];
  let stx = baseX;
  stotals.forEach(([v, w], i) => {
    if (i !== 1 && i !== 3) {
      const s  = fmtNum(v);
      const sw = ctx.bold.widthOfTextAtSize(s, 8);
      dt(page, ctx.bold, s, stx + w - sw - 2, y - LINE_H + 4, 8, i === 5 && v > 0 ? C_GREEN : C_INK);
    }
    stx += w;
  });
}

// ─── Summary page ─────────────────────────────────────────────────────────────

function addSummaryPage(ctx: Ctx, totals: ValuationTotals) {
  const { page, y: startY } = newPage(ctx);
  let y = startY;

  // Section label
  dt(page, ctx.bold, 'VALUATION SUMMARY', ML, y, 7.5, C_MUTED, { ls: 1.5 });
  y -= 26;

  // Large headline
  dt(page, ctx.bold, 'Amount Due This Valuation', ML, y, 20, C_INK);
  y -= 5;
  // Orange underline accent
  page.drawRectangle({ x: ML, y: y - 4, width: 38, height: 2.5, color: C_ORANGE });
  y -= 32;

  const COL_LABEL_W = 310;
  const COL_VAL_W   = 120;

  const summaryRows: [string, number, boolean][] = [
    ['Original Contract Value',         totals.contractOriginal, false],
    ['Extras / Agreed Variations Total', totals.extrasOriginal,   false],
    ['Gross Valuation to Date',          totals.grossToDate,      true],
    ['Less: Previous Valuation Total',   -totals.previousTotal,   false],
    ['Current Amount Due',               totals.amountDue,        false],
  ];

  const retPct = totals.retentionPct ?? 0;
  const mcdPct = totals.mcdPct ?? 0;
  const retAmt = totals.retentionAmt ?? 0;
  const mcdAmt = totals.mcdAmt ?? 0;
  const netVal = totals.netValuation ?? totals.amountDue;

  if (retPct > 0) summaryRows.push([`Less: Retention (${retPct.toFixed(2)}%)`, -retAmt, false]);
  if (mcdPct > 0) summaryRows.push([`Less: MCD (${mcdPct.toFixed(2)}%)`, -mcdAmt, false]);

  for (const [label, value, isBold] of summaryRows) {
    const font  = isBold ? ctx.bold : ctx.regular;
    const color = isBold ? C_INK : C_MID;
    const fsize = isBold ? 11.5 : 10.5;
    const display = value < 0 ? `(${fmtNum(Math.abs(value))})` : fmtNum(value);
    dt(page, font, san(label), ML, y, fsize, color);
    const vw = font.widthOfTextAtSize(display, fsize);
    dt(page, font, display, ML + COL_LABEL_W + COL_VAL_W - vw, y, fsize, color);
    page.drawLine({ start: { x: ML, y: y - 10 }, end: { x: ML + COL_LABEL_W + COL_VAL_W, y: y - 10 }, thickness: 0.3, color: C_FAINT });
    y -= 26;
  }

  // Amount Due box — clean white with orange border + green value
  y -= 4;
  const boxH = 56;
  page.drawRectangle({ x: ML, y: y - boxH, width: COL_LABEL_W + COL_VAL_W, height: boxH,
    color: rgb(0.957, 0.996, 0.976), borderColor: C_GREEN, borderWidth: 1.5, borderRadius: 5 });
  // Left colour tab
  page.drawRectangle({ x: ML, y: y - boxH, width: 4, height: boxH, color: C_GREEN, borderRadius: 2 });
  const netLabel = (retPct > 0 || mcdPct > 0) ? 'NET VALUATION DUE' : 'AMOUNT DUE THIS VALUATION';
  dt(page, ctx.regular, netLabel, ML + 14, y - 14, 7.5, C_MUTED, { ls: 0.8 });
  dt(page, ctx.bold, fmtNum(netVal), ML + 14, y - 38, 22, C_GREEN);

  // ── Right column: notes panel ─────────────────────────────────────────────
  const noteX = PW * 0.52;
  const noteW = PW - MR - noteX;

  dt(page, ctx.bold, 'NOTES & ASSUMPTIONS', noteX, startY, 7.5, C_MUTED, { ls: 0.8 });
  page.drawLine({ start: { x: noteX, y: startY - 11 }, end: { x: PW - MR, y: startY - 11 }, thickness: 0.5, color: C_RULE });
  const note = ctx.valuation.notes || 'No notes recorded for this valuation.';
  wrapText(page, ctx.regular, san(note), noteX, startY - 24, noteW, 9.5, C_MID, 15);

  // ── Signature / certification block ───────────────────────────────────────
  const sigFloor = CB + 26;
  const sigY     = sigFloor + 22;

  page.drawLine({ start: { x: ML, y: sigFloor + 32 }, end: { x: ML + 3 * 168, y: sigFloor + 32 }, thickness: 0.3, color: C_FAINT });

  ['Prepared by', 'Checked by', 'Certified by'].forEach((label, i) => {
    const sx = ML + i * 168;
    dt(page, ctx.regular, label.toUpperCase(), sx, sigY + 20, 6, C_MUTED, { ls: 0.7 });
    page.drawLine({ start: { x: sx, y: sigY }, end: { x: sx + 140, y: sigY }, thickness: 0.5, color: C_FAINT });
    dt(page, ctx.regular, 'Signature / Date', sx, sigY - 10, 6, C_FAINT);
  });

  // Issue date (right-aligned, above footer)
  const issuedStr = `Issued: ${ctx.issueDate}`;
  const issuedW   = ctx.regular.widthOfTextAtSize(issuedStr, 7);
  dt(page, ctx.regular, issuedStr, PW - MR - issuedW, sigFloor - 6, 7, C_MUTED);
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
  // Control characters
  [/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''],
  [/\u0085/g, '...'],                          // NEL / WinAnsi 0x85
  // Common Unicode punctuation pasted from Excel/Word
  [/\u2026/g, '...'],                          // … horizontal ellipsis
  [/[\u2018\u2019\u201A\u201B]/g, "'"],        // smart single quotes / low-9
  [/[\u201C\u201D\u201E\u201F]/g, '"'],        // smart double quotes / low-9
  [/\u2013/g, '-'],                            // en dash
  [/\u2014/g, '-'],                            // em dash
  [/\u2015/g, '-'],                            // horizontal bar
  [/\u2022/g, '-'],                            // bullet
  [/\u2023/g, '-'],                            // triangular bullet
  [/\u25CF/g, '-'],                            // black circle bullet
  [/\u00A0/g, ' '],                            // non-breaking space
  [/\u2009/g, ' '],                            // thin space
  [/\u200B/g, ''],                             // zero-width space
  [/[\u2039\u203A]/g, "'"],                    // single angle quotation marks
  [/[\u00AB\u00BB]/g, '"'],                    // double angle quotation marks (in-range but safety)
  [/\u2122/g, 'TM'],                           // trademark
  [/\u00D7/g, 'x'],                            // multiplication sign (already in range, safety)
  // Accented / Latin extended
  [/[ÀÁÂÃÄÅ]/g, 'A'], [/[àáâãäå]/g, 'a'],
  [/[ÈÉÊË]/g, 'E'],   [/[èéêë]/g, 'e'],
  [/[ÌÍÎÏ]/g, 'I'],   [/[ìíîï]/g, 'i'],
  [/[ÒÓÔÕÖ]/g, 'O'],  [/[òóôõö]/g, 'o'],
  [/[ÙÚÛÜ]/g, 'U'],   [/[ùúûü]/g, 'u'],
  [/[ÝŸ]/g, 'Y'],     [/ý/g, 'y'],
  [/Ñ/g, 'N'],        [/ñ/g, 'n'],
  [/Ç/g, 'C'],        [/ç/g, 'c'],
  [/[ŁłĐđ]/g, '-'],
  [/[ŠšŽž]/g, 's'],
  // Final catch-all: strip anything still outside printable WinAnsi range
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

// Satisfy unused import (PDFImage is used in Ctx interface via logoImg field)
void (null as unknown as PDFImage);