import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib';
import type { DBValuation, DBValuationLine, DBValuationExtraLine } from '../../lib/store';
import type { Project } from '../../data/types';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface OrgInfo {
  companyName: string;
  logoDataUrl?: string;
}

export async function buildValuationPdf(
  valuation: DBValuation,
  project: Project,
  lines: DBValuationLine[],
  extras: DBValuationExtraLine[],
  orgInfo: OrgInfo,
): Promise<Uint8Array> {
  const doc     = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  let logoImg: PDFImage | null = null;
  if (orgInfo.logoDataUrl) {
    try { logoImg = await embedImg(doc, orgInfo.logoDataUrl); } catch { /* ignore */ }
  }

  const ctx: Ctx = { doc, regular, bold, oblique, logoImg, orgInfo, valuation, project };

  addCoverPage(ctx);
  addContractLinesPage(ctx, lines);
  if (extras.length > 0) addExtrasPage(ctx, extras, lines);
  addSummaryPage(ctx, lines, extras);

  return doc.save();
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PW = 841.89;  // A4 landscape width
const PH = 595.28;  // A4 landscape height
const ML = 46;      // margin left
const MR = 46;      // margin right
const CW = PW - ML - MR;  // content width

const HDR_H    = 56;
const FTR_H    = 36;
const CT       = PH - HDR_H;   // content top y
const CB       = FTR_H;        // content bottom y

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
  oblique: PDFFont;
  logoImg: PDFImage | null;
  orgInfo: OrgInfo;
  valuation: DBValuation;
  project: Project;
}

let _pageCount = 0;

// ─── Page helpers ─────────────────────────────────────────────────────────────

function newPage(ctx: Ctx): { page: PDFPage; y: number } {
  _pageCount++;
  const page = ctx.doc.addPage([PW, PH]);

  // Top bar
  page.drawRectangle({ x: 0, y: PH - 4, width: PW, height: 4, color: C_ORANGE });

  // Header: company / logo left, valuation ref right
  const hY = PH - 30;
  if (ctx.logoImg) {
    const scale = Math.min(100 / ctx.logoImg.width, 22 / ctx.logoImg.height);
    const lw = ctx.logoImg.width * scale;
    const lh = ctx.logoImg.height * scale;
    page.drawImage(ctx.logoImg, { x: ML, y: hY - lh + 4, width: lw, height: lh });
  } else {
    dt(page, ctx.bold, san(ctx.orgInfo.companyName || 'Organisation'), ML, hY, 10, C_INK);
  }
  const refStr = san(`${ctx.valuation.ref}  —  ${ctx.valuation.title}`);
  const rw = ctx.regular.widthOfTextAtSize(refStr, 7.5);
  dt(page, ctx.regular, refStr, PW - MR - rw, hY, 7.5, C_MUTED);

  // Header separator
  page.drawLine({ start: { x: ML, y: CT }, end: { x: PW - MR, y: CT }, thickness: 0.5, color: C_FAINT });

  // Footer
  page.drawLine({ start: { x: ML, y: CB }, end: { x: PW - MR, y: CB }, thickness: 0.3, color: C_FAINT });
  const projStr = san(ctx.project.name);
  dt(page, ctx.regular, projStr, ML, CB - 14, 6.5, C_MUTED);
  const pgStr = `Page ${_pageCount}`;
  const pgW = ctx.regular.widthOfTextAtSize(pgStr, 6.5);
  dt(page, ctx.regular, pgStr, PW - MR - pgW, CB - 14, 6.5, C_MUTED);

  return { page, y: CT - 12 };
}

// ─── Cover page ───────────────────────────────────────────────────────────────

function addCoverPage(ctx: Ctx) {
  _pageCount = 0;
  const { page, y: startY } = newPage(ctx);
  let y = startY;

  // Left accent stripe
  page.drawRectangle({ x: ML - 6, y: CB, width: 3, height: CT - CB, color: C_ORANGE });

  // Eyebrow
  dt(page, ctx.regular, 'COMMERCIAL VALUATION', ML, y, 8, C_MUTED, { ls: 2 });
  y -= 28;

  // Title
  const titleBottom = wrapText(page, ctx.bold, san(ctx.valuation.title), ML, y, CW * 0.6, 26, C_INK, 34);
  y = titleBottom;

  // Ref pill
  y -= 14;
  const refW = ctx.bold.widthOfTextAtSize(ctx.valuation.ref, 10) + 20;
  page.drawRectangle({ x: ML, y: y - 16, width: refW, height: 20, color: C_PANEL, borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 2 });
  dt(page, ctx.bold, ctx.valuation.ref, ML + 10, y - 7, 10, C_BODY);

  // Meta grid — right half
  const META_X = PW / 2 + 10;
  const META_W = PW - MR - META_X;
  const mFields: [string, string][] = [
    ['Project',         ctx.project.name || ''],
    ['Client',          ctx.valuation.client || ctx.project.client || ''],
    ['Contractor',      ctx.valuation.contractor || ctx.orgInfo.companyName || ''],
    ['Valuation Date',  fmtDate(ctx.valuation.valuation_date)],
    ['Period',          ctx.valuation.period || ''],
    ['Status',          capitalize(ctx.valuation.status)],
  ].filter(([, v]) => v);

  const META_Y = startY;
  mFields.forEach(([label, value], i) => {
    const my = META_Y - i * 38;
    if (my < CB + 40) return;
    dt(page, ctx.regular, label.toUpperCase(), META_X, my, 6.5, C_MUTED, { ls: 1.2 });
    wrapText(page, ctx.bold, san(value), META_X, my - 14, META_W, 10, C_BODY, 14);
    page.drawLine({ start: { x: META_X, y: my - 28 }, end: { x: PW - MR, y: my - 28 }, thickness: 0.3, color: C_FAINT });
  });

  if (ctx.valuation.notes) {
    const noteY = Math.min(startY - mFields.length * 38 - 14, y - 40);
    if (noteY > CB + 50) {
      const panH = 52;
      page.drawRectangle({ x: ML, y: noteY - panH, width: CW * 0.5, height: panH, color: C_PANEL, borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 3 });
      dt(page, ctx.bold, 'NOTES', ML + 10, noteY - 10, 7, C_MUTED, { ls: 1 });
      wrapText(page, ctx.regular, san(ctx.valuation.notes), ML + 10, noteY - 22, CW * 0.5 - 20, 9, C_MID, 13);
    }
  }
}

// ─── Contract lines page ──────────────────────────────────────────────────────

const LINE_H = 16;
const LINE_FONT = 8.5;

function addContractLinesPage(ctx: Ctx, lines: DBValuationLine[]) {
  if (lines.length === 0) return;

  const { page: firstPage, y: startY } = newPage(ctx);
  let page = firstPage;
  let y    = startY;

  // Section heading
  dt(page, ctx.bold, 'CONTRACT WORKS', ML, y, 8, C_MUTED, { ls: 1.5 });
  y -= 20;

  // Column widths (landscape A4 = 749.89 content)
  const COL = { num: 26, item: 24, desc: 160, sec: 90, unit: 30, qty: 40, rate: 52, cval: 70, ppct: 34, pval: 70, cpct: 34, cval2: 70, thisval: 70, notes: 0 };
  // notes gets remaining space
  const fixedW = Object.values(COL).reduce((s, v) => s + v, 0);
  COL.notes = Math.max(0, CW - fixedW);

  // Table header
  const drawLineHeader = (p: PDFPage, hy: number) => {
    p.drawRectangle({ x: ML, y: hy - LINE_H + 2, width: CW, height: LINE_H, color: rgb(0.937, 0.953, 0.969) });
    const cols: [string, number, 'left' | 'right'][] = [
      ['#',         ML,                          'left'],
      ['Item',      ML + COL.num,                'left'],
      ['Description', ML + COL.num + COL.item,  'left'],
      ['Section',   ML + COL.num + COL.item + COL.desc, 'left'],
      ['Unit',      ML + COL.num + COL.item + COL.desc + COL.sec, 'left'],
      ['Qty',       ML + COL.num + COL.item + COL.desc + COL.sec + COL.unit, 'right'],
      ['Rate',      ML + COL.num + COL.item + COL.desc + COL.sec + COL.unit + COL.qty, 'right'],
      ['Cont. Value', ML + COL.num + COL.item + COL.desc + COL.sec + COL.unit + COL.qty + COL.rate, 'right'],
      ['Prev %',    ML + COL.num + COL.item + COL.desc + COL.sec + COL.unit + COL.qty + COL.rate + COL.cval, 'right'],
      ['Prev Value', ML + COL.num + COL.item + COL.desc + COL.sec + COL.unit + COL.qty + COL.rate + COL.cval + COL.ppct, 'right'],
      ['Curr %',    ML + COL.num + COL.item + COL.desc + COL.sec + COL.unit + COL.qty + COL.rate + COL.cval + COL.ppct + COL.pval, 'right'],
      ['Curr Value', ML + COL.num + COL.item + COL.desc + COL.sec + COL.unit + COL.qty + COL.rate + COL.cval + COL.ppct + COL.pval + COL.cpct, 'right'],
      ['This Val',  ML + COL.num + COL.item + COL.desc + COL.sec + COL.unit + COL.qty + COL.rate + COL.cval + COL.ppct + COL.pval + COL.cpct + COL.cval2, 'right'],
    ];
    for (const [label, x, align] of cols) {
      const tw = ctx.bold.widthOfTextAtSize(label, 7);
      const tx = align === 'right' ? x - tw - 2 : x + 2;
      dt(p, ctx.bold, label, tx, hy - 5, 7, C_MUTED);
    }
  };

  drawLineHeader(page, y);
  y -= LINE_H;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (y - LINE_H < CB + 16) {
      // footer subtotal row
      drawSubtotalRow(page, y, ctx, lines.slice(0, i), COL, 'subtotal continued');
      const np = newPage(ctx);
      page = np.page;
      y    = np.y;
      dt(page, ctx.bold, 'CONTRACT WORKS  —  continued', ML, y, 8, C_MUTED, { ls: 1.5 });
      y -= 20;
      drawLineHeader(page, y);
      y -= LINE_H;
    }

    const prevVal = line.contract_value * line.previous_pct / 100;
    const currVal = line.contract_value * line.current_pct  / 100;
    const thisVal = currVal - prevVal;
    const bg = i % 2 === 0 ? C_PANEL : undefined;
    if (bg) page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: bg });

    let x = ML;
    const row = (text: string, w: number, align: 'left' | 'right' = 'left', color = C_BODY) => {
      const s = san(text);
      if (!s) { x += w; return; }
      const tw = ctx.regular.widthOfTextAtSize(s, LINE_FONT);
      const tx = align === 'right' ? x + w - tw - 2 : x + 2;
      dt(page, ctx.regular, s.length > 30 && align === 'left' ? s.slice(0, 28) + '\x85' : s, tx, y - LINE_H + 5, LINE_FONT, color);
      x += w;
    };
    const rowB = (text: string, w: number, align: 'left' | 'right' = 'left', color = C_BODY) => {
      const s = san(text);
      if (!s) { x += w; return; }
      const tw = ctx.bold.widthOfTextAtSize(s, LINE_FONT);
      const tx = align === 'right' ? x + w - tw - 2 : x + 2;
      dt(page, ctx.bold, s, tx, y - LINE_H + 5, LINE_FONT, color);
      x += w;
    };

    row(String(i + 1), COL.num, 'right', C_MUTED);
    row(line.item_number, COL.item);
    row(line.description, COL.desc);
    row(line.section, COL.sec, 'left', C_MUTED);
    row(line.unit, COL.unit, 'left', C_MUTED);
    row(line.quantity > 0 ? fmtNum(line.quantity) : '', COL.qty, 'right', C_MUTED);
    row(line.rate > 0 ? fmtNum(line.rate) : '', COL.rate, 'right', C_MUTED);
    rowB(fmtNum(line.contract_value), COL.cval, 'right');
    row(fmtPct(line.previous_pct), COL.ppct, 'right', C_MUTED);
    row(fmtNum(prevVal), COL.pval, 'right', C_MUTED);
    rowB(fmtPct(line.current_pct), COL.cpct, 'right');
    rowB(fmtNum(currVal), COL.cval2, 'right');
    rowB(fmtNum(thisVal), COL.notes + (COL.notes > 0 ? 0 : 0), 'right', thisVal > 0 ? C_GREEN : C_BODY);

    y -= LINE_H;
  }

  // Subtotal row
  drawSubtotalRow(page, y, ctx, lines, COL, 'Subtotal — Contract Works');
}

function drawSubtotalRow(page: PDFPage, y: number, ctx: Ctx, lines: DBValuationLine[], COL: Record<string, number>, label: string) {
  const total       = lines.reduce((s, l) => s + l.contract_value, 0);
  const prevTotal   = lines.reduce((s, l) => s + l.contract_value * l.previous_pct / 100, 0);
  const currTotal   = lines.reduce((s, l) => s + l.contract_value * l.current_pct  / 100, 0);
  const thisTotal   = currTotal - prevTotal;

  page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: rgb(0.918, 0.937, 0.957) });

  const baseX = ML + COL.num + COL.item + COL.desc + COL.sec + COL.unit + COL.qty + COL.rate;

  dt(page, ctx.bold, san(label), ML + 2, y - LINE_H + 5, 8, C_BODY);

  const totals = [total, 0, prevTotal, 0, currTotal, thisTotal];
  const widths  = [COL.cval, COL.ppct, COL.pval, COL.cpct, COL.cval2, COL.notes];
  let tx = baseX;
  totals.forEach((v, i) => {
    if (i === 1 || i === 3) { tx += widths[i]; return; }
    const s   = fmtNum(v);
    const sw  = ctx.bold.widthOfTextAtSize(s, 8.5);
    const col = i === 5 && v > 0 ? C_GREEN : C_INK;
    dt(page, ctx.bold, s, tx + widths[i] - sw - 2, y - LINE_H + 5, 8.5, col);
    tx += widths[i];
  });
}

// ─── Extras page ──────────────────────────────────────────────────────────────

function addExtrasPage(ctx: Ctx, extras: DBValuationExtraLine[], lines: DBValuationLine[]) {
  const { page: firstPage, y: startY } = newPage(ctx);
  let page = firstPage;
  let y    = startY;

  dt(page, ctx.bold, 'EXTRAS / AGREED VARIATIONS', ML, y, 8, C_MUTED, { ls: 1.5 });
  y -= 20;

  const COL = { ref: 40, desc: 200, agreed: 80, ppct: 38, pval: 80, cpct: 38, cval: 80, thisval: 80, notes: 0 };
  const fixedW = Object.values(COL).reduce((s, v) => s + v, 0);
  COL.notes = Math.max(0, CW - fixedW);

  // Header row
  page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: rgb(0.937, 0.953, 0.969) });
  const hdrCols: [string, number][] = [
    ['Ref', ML + 2],
    ['Description', ML + COL.ref + 2],
    ['Agreed Value', ML + COL.ref + COL.desc],
    ['Prev %', ML + COL.ref + COL.desc + COL.agreed],
    ['Prev Value', ML + COL.ref + COL.desc + COL.agreed + COL.ppct],
    ['Curr %', ML + COL.ref + COL.desc + COL.agreed + COL.ppct + COL.pval],
    ['Curr Value', ML + COL.ref + COL.desc + COL.agreed + COL.ppct + COL.pval + COL.cpct],
    ['This Val', ML + COL.ref + COL.desc + COL.agreed + COL.ppct + COL.pval + COL.cpct + COL.cval],
  ];
  for (const [label, x] of hdrCols) {
    dt(page, ctx.bold, label, x, y - 5, 7, C_MUTED);
  }
  y -= LINE_H;

  for (let i = 0; i < extras.length; i++) {
    const e = extras[i];
    if (y - LINE_H < CB + 16) {
      const np = newPage(ctx);
      page = np.page;
      y    = np.y;
    }
    const prevVal = e.agreed_value * e.previous_pct / 100;
    const currVal = e.agreed_value * e.current_pct  / 100;
    const thisVal = currVal - prevVal;
    const bg = i % 2 === 0 ? C_PANEL : undefined;
    if (bg) page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: bg });

    const vals: [string, number, 'left' | 'right', PDFFont, ReturnType<typeof rgb>][] = [
      [e.ref,                COL.ref,    'left',  ctx.regular, C_MUTED],
      [e.description,        COL.desc,   'left',  ctx.regular, C_BODY],
      [fmtNum(e.agreed_value), COL.agreed, 'right', ctx.bold,   C_BODY],
      [fmtPct(e.previous_pct), COL.ppct,  'right', ctx.regular, C_MUTED],
      [fmtNum(prevVal),      COL.pval,   'right', ctx.regular, C_MUTED],
      [fmtPct(e.current_pct), COL.cpct,  'right', ctx.bold,    C_BODY],
      [fmtNum(currVal),      COL.cval,   'right', ctx.bold,    C_BODY],
      [fmtNum(thisVal),      COL.thisval + COL.notes, 'right', ctx.bold, thisVal > 0 ? C_GREEN : C_BODY],
    ];
    let tx = ML;
    for (const [text, w, align, font, color] of vals) {
      const s = san(text);
      if (s) {
        const sw = font.widthOfTextAtSize(s, LINE_FONT);
        const fx = align === 'right' ? tx + w - sw - 2 : tx + 2;
        dt(page, font, s, fx, y - LINE_H + 5, LINE_FONT, color);
      }
      tx += w;
    }
    y -= LINE_H;
  }

  // Subtotal
  const agreedTotal = extras.reduce((s, e) => s + e.agreed_value, 0);
  const prevTotal   = extras.reduce((s, e) => s + e.agreed_value * e.previous_pct / 100, 0);
  const currTotal   = extras.reduce((s, e) => s + e.agreed_value * e.current_pct  / 100, 0);
  const thisTotal   = currTotal - prevTotal;

  page.drawRectangle({ x: ML, y: y - LINE_H + 2, width: CW, height: LINE_H, color: rgb(0.918, 0.937, 0.957) });
  dt(page, ctx.bold, 'Subtotal — Extras / Agreed Variations', ML + 2, y - LINE_H + 5, 8, C_BODY);
  const baseX = ML + COL.ref + COL.desc;
  const subtotalCols: [number, number][] = [
    [agreedTotal, COL.agreed],
    [0,           COL.ppct],
    [prevTotal,   COL.pval],
    [0,           COL.cpct],
    [currTotal,   COL.cval],
    [thisTotal,   COL.thisval + COL.notes],
  ];
  let stx = baseX;
  subtotalCols.forEach(([v, w], i) => {
    if (v !== 0 || i === 0) {
      const s  = fmtNum(v);
      const sw = ctx.bold.widthOfTextAtSize(s, 8.5);
      const col = i === 5 && v > 0 ? C_GREEN : C_INK;
      dt(page, ctx.bold, s, stx + w - sw - 2, y - LINE_H + 5, 8.5, col);
    }
    stx += w;
  });

  // Note about contract works
  void lines;
}

// ─── Summary page ─────────────────────────────────────────────────────────────

function addSummaryPage(ctx: Ctx, lines: DBValuationLine[], extras: DBValuationExtraLine[]) {
  const { page, y: startY } = newPage(ctx);
  let y = startY;

  dt(page, ctx.bold, 'VALUATION SUMMARY', ML, y, 8, C_MUTED, { ls: 1.5 });
  y -= 28;
  dt(page, ctx.bold, 'Amount Due This Valuation', ML, y, 22, C_INK);
  y -= 6;
  page.drawRectangle({ x: ML, y: y - 3, width: 44, height: 3, color: C_ORANGE });
  y -= 36;

  const contractOriginal  = lines.reduce((s, l) => s + l.contract_value, 0);
  const contractPrevValue = lines.reduce((s, l) => s + l.contract_value * l.previous_pct / 100, 0);
  const contractCurrValue = lines.reduce((s, l) => s + l.contract_value * l.current_pct  / 100, 0);
  const extrasOriginal    = extras.reduce((s, e) => s + e.agreed_value, 0);
  const extrasPrevValue   = extras.reduce((s, e) => s + e.agreed_value * e.previous_pct / 100, 0);
  const extrasCurrValue   = extras.reduce((s, e) => s + e.agreed_value * e.current_pct  / 100, 0);
  const grossToDate       = contractCurrValue + extrasCurrValue;
  const previousTotal     = contractPrevValue + extrasPrevValue;
  const amountDue         = grossToDate - previousTotal;

  const summaryRows: [string, number, boolean][] = [
    ['Original Contract Value',         contractOriginal,  false],
    ['Extras / Agreed Variations Total', extrasOriginal,    false],
    ['Gross Valuation to Date',          grossToDate,       true],
    ['Less: Previous Valuation Total',   -previousTotal,    false],
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

  // Amount due highlighted box
  y -= 6;
  const boxH = 52;
  page.drawRectangle({ x: ML, y: y - boxH, width: COL_LABEL_W + COL_VAL_W, height: boxH,
    color: rgb(0.941, 0.996, 0.957), borderColor: rgb(0.063, 0.733, 0.506), borderWidth: 1.5, borderRadius: 4 });
  dt(page, ctx.regular, 'AMOUNT DUE THIS VALUATION', ML + 14, y - 14, 8, C_MUTED, { ls: 1 });
  dt(page, ctx.bold, fmtNum(amountDue), ML + 14, y - 36, 22, C_GREEN);

  // Assumptions note
  const noteX = PW / 2 + 20;
  const noteY = startY;
  dt(page, ctx.bold, 'NOTES & ASSUMPTIONS', noteX, noteY, 8, C_MUTED, { ls: 1 });
  page.drawLine({ start: { x: noteX, y: noteY - 12 }, end: { x: PW - MR, y: noteY - 12 }, thickness: 0.5, color: C_FAINT });

  const note = ctx.valuation.notes || 'No notes recorded for this valuation.';
  wrapText(page, ctx.regular, san(note), noteX, noteY - 24, PW - MR - noteX, 10, C_MID, 15);

  // Signature block
  const sigY = CB + 50;
  const sigCols = [ML, ML + 160, ML + 320];
  const sigLabels = ['Prepared by', 'Checked by', 'Issued to'];
  sigCols.forEach((sx, i) => {
    dt(page, ctx.regular, sigLabels[i].toUpperCase(), sx, sigY + 20, 7, C_MUTED, { ls: 0.8 });
    page.drawLine({ start: { x: sx, y: sigY }, end: { x: sx + 130, y: sigY }, thickness: 0.5, color: C_FAINT });
    dt(page, ctx.regular, 'Signature / Date', sx, sigY - 10, 7, C_FAINT);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TextOpts = { ls?: number; align?: 'left' | 'right' | 'center'; maxWidth?: number };

function dt(p: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, color: ReturnType<typeof rgb>, opts: TextOpts = {}) {
  const s = san(text);
  if (!s) return;
  let tx = x;
  if (opts.align === 'right'  && opts.maxWidth) tx = x + opts.maxWidth - font.widthOfTextAtSize(s, size);
  if (opts.align === 'center' && opts.maxWidth) tx = x + (opts.maxWidth - font.widthOfTextAtSize(s, size)) / 2;
  p.drawText(s, { x: tx, y, size, font, color, characterSpacing: opts.ls ?? 0 });
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

async function embedImg(doc: PDFDocument, dataUrl: string): Promise<PDFImage> {
  const mime  = (dataUrl.match(/^data:([^;]+);/) ?? [])[1] ?? '';
  const b64   = dataUrl.split(',')[1] ?? '';
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (mime === 'image/png') return doc.embedPng(bytes);
  return doc.embedJpg(bytes);
}

// Suppress unused
void C_DARK;
void C_MID;
