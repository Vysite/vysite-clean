import * as XLSX from 'xlsx';
import type { DBValuation } from '../../lib/store';
import type { Project } from '../../data/types';
import type { LineData, ExtraData, ValuationTotals } from './ValuationPDF';

// ─── Brand palette (hex, no #) ────────────────────────────────────────────────
const ORANGE  = 'F97316';
const INK     = '0E1729';
const BODY    = '1E3050';
const MUTED   = '617090';
const LIGHT   = 'EFF2F6';
const STRIPE  = 'F8F9FB';
const GREEN   = '0FA56F';
const RED_    = 'CC3333';
const WHITE   = 'FFFFFF';
const RULE    = 'DDE2EA';

// ─── Number formats ───────────────────────────────────────────────────────────
const CURR_FMT = '"£"#,##0.00';
const PCT_FMT  = '0.00"%"';   // values stored as 0-100, not 0-1

// ─── Style primitives ─────────────────────────────────────────────────────────

type Align = 'left' | 'right' | 'center';

// NOTE: numFmt is intentionally ABSENT from CellStyle.
// It is set on the cell via the `z` property to avoid undefined keys polluting
// styles.xml (which causes Excel repair dialogs).
interface CellStyle {
  font?:      object;
  fill?:      object;
  alignment?: object;
  border?:    object;
}

function solidFill(hex: string) {
  return { patternType: 'solid', fgColor: { rgb: hex }, bgColor: { rgb: hex } };
}

function thinBorder(color = RULE) {
  const side = { style: 'thin', color: { rgb: color } };
  return { top: side, bottom: side, left: side, right: side };
}

function bottomBorder(color = RULE) {
  return { bottom: { style: 'thin', color: { rgb: color } } };
}

function sectionHeaderStyle(): CellStyle {
  return {
    font:      { name: 'Calibri', sz: 10, bold: true, color: { rgb: WHITE } },
    fill:      solidFill(ORANGE),
    alignment: { horizontal: 'left', vertical: 'middle' },
    border:    thinBorder(ORANGE),
  };
}

function tableHeaderStyle(align: Align = 'left'): CellStyle {
  return {
    font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: MUTED } },
    fill:      solidFill(LIGHT),
    alignment: { horizontal: align, vertical: 'middle' },
    border:    { bottom: { style: 'medium', color: { rgb: RULE } } },
  };
}

function cellStyle(align: Align = 'left', stripe = false): CellStyle {
  return {
    font:      { name: 'Calibri', sz: 9, color: { rgb: BODY } },
    fill:      solidFill(stripe ? STRIPE : WHITE),
    alignment: { horizontal: align, vertical: 'top', wrapText: align === 'left' },
    border:    bottomBorder(),
  };
}

function boldCellStyle(align: Align = 'left', stripe = false): CellStyle {
  return {
    font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: INK } },
    fill:      solidFill(stripe ? STRIPE : WHITE),
    alignment: { horizontal: align, vertical: 'top', wrapText: align === 'left' },
    border:    bottomBorder(),
  };
}

function mutedCellStyle(align: Align = 'left', stripe = false): CellStyle {
  return {
    font:      { name: 'Calibri', sz: 9, color: { rgb: MUTED } },
    fill:      solidFill(stripe ? STRIPE : WHITE),
    alignment: { horizontal: align, vertical: 'top' },
    border:    bottomBorder(),
  };
}

function totalStyle(align: Align = 'left', colorHex?: string): CellStyle {
  return {
    font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: colorHex ?? INK } },
    fill:      solidFill(LIGHT),
    alignment: { horizontal: align, vertical: 'middle' },
    border:    { top: { style: 'medium', color: { rgb: RULE } }, bottom: { style: 'medium', color: { rgb: RULE } } },
  };
}

function coverLabelStyle(): CellStyle {
  return {
    font:      { name: 'Calibri', sz: 8, bold: true, color: { rgb: MUTED } },
    fill:      solidFill(WHITE),
    alignment: { horizontal: 'left', vertical: 'bottom' },
  };
}

function coverValueStyle(): CellStyle {
  return {
    font:      { name: 'Calibri', sz: 11, bold: true, color: { rgb: INK } },
    fill:      solidFill(WHITE),
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
  };
}

function summaryLabelStyle(bold = false): CellStyle {
  return {
    font:      { name: 'Calibri', sz: 11, bold, color: { rgb: bold ? INK : BODY } },
    fill:      solidFill(WHITE),
    alignment: { horizontal: 'left', vertical: 'middle' },
    border:    bottomBorder(),
  };
}

function summaryValueStyle(bold = false, colorHex?: string): CellStyle {
  return {
    font:      { name: 'Calibri', sz: 11, bold, color: { rgb: colorHex ?? (bold ? INK : BODY) } },
    fill:      solidFill(WHITE),
    alignment: { horizontal: 'right', vertical: 'middle' },
    border:    bottomBorder(),
  };
}

// ─── Worksheet cell builder ───────────────────────────────────────────────────

// z is the SheetJS cell number-format string — separate from the style object.
// This avoids corrupt styles.xml entries from undefined numFmt keys.
type WsCell = { v: string | number; t: 's' | 'n'; s?: CellStyle; z?: string };

function mkCell(v: string | number | null, s?: CellStyle, z?: string): WsCell {
  const base: WsCell = (v === null || v === undefined)
    ? { v: '', t: 's' }
    : { v, t: typeof v === 'number' ? 'n' : 's' };
  if (s) base.s = s;
  if (z) base.z = z;
  return base;
}

function colLetter(n: number): string {
  let out = '';
  let idx = n + 1;
  while (idx > 0) { out = String.fromCharCode(65 + ((idx - 1) % 26)) + out; idx = Math.floor((idx - 1) / 26); }
  return out;
}

function cellRef(r: number, c: number): string { return `${colLetter(c)}${r + 1}`; }

function writeCell(ws: XLSX.WorkSheet, r: number, c: number, cell: WsCell) {
  ws[cellRef(r, c)] = cell;
}

function setRange(ws: XLSX.WorkSheet, rows: number, cols: number) {
  ws['!ref'] = `A1:${colLetter(cols - 1)}${rows}`;
}

// ─── FIX: frozen panes use !views, NOT the non-existent !freeze property ──────
// !freeze does not exist in SheetJS; it writes garbage XML that triggers repair.
function freezeRows(ws: XLSX.WorkSheet, ySplit: number) {
  const topLeftCell = `A${ySplit + 1}`;
  ws['!views'] = [{ state: 'frozen', ySplit, topLeftCell }];
}

// ─── Dates ────────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return iso; }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// ─── Sheet 1: Cover ───────────────────────────────────────────────────────────

function buildCoverSheet(
  valuation: DBValuation,
  project: Project,
  companyName?: string,
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  // Orange brand bar (row 0) — merged A:D
  writeCell(ws, 0, 0, mkCell(companyName || 'VYSITE', {
    font:      { name: 'Calibri', sz: 16, bold: true, color: { rgb: WHITE } },
    fill:      solidFill(ORANGE),
    alignment: { horizontal: 'left', vertical: 'middle' },
  }));
  for (let c = 1; c <= 3; c++) writeCell(ws, 0, c, mkCell('', { fill: solidFill(ORANGE) }));

  // Eyebrow (row 1)
  writeCell(ws, 1, 0, mkCell('COMMERCIAL VALUATION', {
    font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: MUTED } },
    fill:      solidFill(WHITE),
    alignment: { horizontal: 'left', vertical: 'middle' },
  }));

  // Main title (row 2)
  writeCell(ws, 2, 0, mkCell(valuation.title, {
    font:      { name: 'Calibri', sz: 20, bold: true, color: { rgb: INK } },
    fill:      solidFill(WHITE),
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
  }));

  // Reference (row 3)
  writeCell(ws, 3, 0, mkCell(valuation.ref, {
    font:      { name: 'Calibri', sz: 12, bold: true, color: { rgb: ORANGE } },
    fill:      { patternType: 'solid', fgColor: { rgb: 'FFF4EC' }, bgColor: { rgb: 'FFF4EC' } },
    alignment: { horizontal: 'left', vertical: 'middle' },
    border:    thinBorder(ORANGE),
  }));

  // Spacer (row 4)
  writeCell(ws, 4, 0, mkCell('', { fill: solidFill(WHITE) }));

  // Section header (row 5) — merged A:D
  writeCell(ws, 5, 0, mkCell('VALUATION DETAILS', sectionHeaderStyle()));
  for (let c = 1; c <= 3; c++) writeCell(ws, 5, c, mkCell('', { fill: solidFill(ORANGE) }));

  const meta: [string, string][] = [
    ['Project',        project.name || ''],
    ['Client',         valuation.client || ''],
    ['Contractor',     valuation.contractor || ''],
    ['Valuation Date', fmtDate(valuation.valuation_date)],
    ['Issue Date',     issueDate],
    ['Period',         valuation.period || ''],
    ['Status',         capitalize(valuation.status)],
  ];

  let row = 6;
  const notesMerges: XLSX.Range[] = [];

  for (const [label, value] of meta) {
    writeCell(ws, row,     0, mkCell(label.toUpperCase(), coverLabelStyle()));
    writeCell(ws, row + 1, 0, mkCell(value || '\u2014', coverValueStyle()));
    writeCell(ws, row + 2, 0, mkCell('', { fill: solidFill(WHITE), border: bottomBorder() }));
    row += 3;
  }

  if (valuation.notes) {
    writeCell(ws, row, 0, mkCell('NOTES', sectionHeaderStyle()));
    for (let c = 1; c <= 3; c++) writeCell(ws, row, c, mkCell('', { fill: solidFill(ORANGE) }));
    const notesRow = row;
    row++;
    writeCell(ws, row, 0, mkCell(valuation.notes, {
      font:      { name: 'Calibri', sz: 10, color: { rgb: BODY } },
      fill:      solidFill(LIGHT),
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    }));
    // Only push a merge if it spans more than one column (never degenerate)
    notesMerges.push({ s: { r: notesRow, c: 0 }, e: { r: notesRow, c: 3 } });
    notesMerges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } });
    row++;
  }

  setRange(ws, row + 1, 4);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 3 } },
    ...notesMerges,
  ];

  ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
  ws['!rows'] = [
    { hpt: 36 },
    { hpt: 18 },
    { hpt: 40 },
    { hpt: 24 },
  ];

  // FIX: no !printSetup (non-existent property), no fitToPage+fitToWidth combo.
  // paperSize 9 = A4; orientation only, no conflicting scale attributes.
  ws['!pageSetup'] = { paperSize: 9, orientation: 'portrait' };

  return ws;
}

// ─── Sheet 2: Contract Works ──────────────────────────────────────────────────

function buildContractWorksSheet(lineData: LineData[]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const HDR_COLS = 13;

  writeCell(ws, 0, 0, mkCell('CONTRACT WORKS', sectionHeaderStyle()));
  for (let c = 1; c < HDR_COLS; c++) writeCell(ws, 0, c, mkCell('', { fill: solidFill(ORANGE) }));

  const headers: [string, Align][] = [
    ['#',              'right'],
    ['Item',           'left'],
    ['Description',    'left'],
    ['Section',        'left'],
    ['Unit',           'left'],
    ['Qty',            'right'],
    ['Rate',           'right'],
    ['Contract Value', 'right'],
    ['Prev %',         'right'],
    ['Prev Value',     'right'],
    ['Curr %',         'right'],
    ['Curr Value',     'right'],
    ['This Valuation', 'right'],
  ];
  headers.forEach(([label, align], c) => writeCell(ws, 1, c, mkCell(label, tableHeaderStyle(align))));

  let maxRow = 2;
  lineData.forEach(({ line, entry }, idx) => {
    const r       = idx + 2;
    const stripe  = idx % 2 === 1;
    const prevVal = line.contract_value * entry.previous_pct / 100;
    const currVal = line.contract_value * entry.current_pct  / 100;
    const thisVal = currVal - prevVal;

    writeCell(ws, r, 0,  mkCell(idx + 1,                           mutedCellStyle('right', stripe)));
    writeCell(ws, r, 1,  mkCell(line.item_number ?? '',             mutedCellStyle('left',  stripe)));
    writeCell(ws, r, 2,  mkCell(line.description,                   cellStyle('left',  stripe)));
    writeCell(ws, r, 3,  mkCell(line.section ?? '',                 mutedCellStyle('left',  stripe)));
    writeCell(ws, r, 4,  mkCell(line.unit ?? '',                    mutedCellStyle('left',  stripe)));
    writeCell(ws, r, 5,  mkCell(line.quantity != null ? line.quantity : '', mutedCellStyle('right', stripe)));
    writeCell(ws, r, 6,  mkCell(line.rate     != null ? line.rate     : '', mutedCellStyle('right', stripe), CURR_FMT));
    writeCell(ws, r, 7,  mkCell(line.contract_value,                boldCellStyle('right', stripe), CURR_FMT));
    writeCell(ws, r, 8,  mkCell(entry.previous_pct,                 mutedCellStyle('right', stripe), PCT_FMT));
    writeCell(ws, r, 9,  mkCell(prevVal,                            mutedCellStyle('right', stripe), CURR_FMT));
    writeCell(ws, r, 10, mkCell(entry.current_pct,                  boldCellStyle('right', stripe), PCT_FMT));
    writeCell(ws, r, 11, mkCell(currVal,                            boldCellStyle('right', stripe), CURR_FMT));
    writeCell(ws, r, 12, mkCell(thisVal, {
      font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: thisVal > 0 ? GREEN : (thisVal < 0 ? RED_ : INK) } },
      fill:      solidFill(stripe ? STRIPE : WHITE),
      alignment: { horizontal: 'right', vertical: 'top' },
      border:    bottomBorder(),
    }, CURR_FMT));

    maxRow = r + 1;
  });

  const totalRow = maxRow;
  const total     = lineData.reduce((s, d) => s + d.line.contract_value, 0);
  const prevTotal = lineData.reduce((s, d) => s + d.line.contract_value * d.entry.previous_pct / 100, 0);
  const currTotal = lineData.reduce((s, d) => s + d.line.contract_value * d.entry.current_pct  / 100, 0);
  const thisTotal = currTotal - prevTotal;

  writeCell(ws, totalRow, 0,  mkCell('SUBTOTAL',       totalStyle('left')));
  writeCell(ws, totalRow, 1,  mkCell('',               totalStyle()));
  writeCell(ws, totalRow, 2,  mkCell('Contract Works', totalStyle('left')));
  writeCell(ws, totalRow, 3,  mkCell('',               totalStyle()));
  writeCell(ws, totalRow, 4,  mkCell('',               totalStyle()));
  writeCell(ws, totalRow, 5,  mkCell('',               totalStyle()));
  writeCell(ws, totalRow, 6,  mkCell('',               totalStyle()));
  writeCell(ws, totalRow, 7,  mkCell(total,            totalStyle('right'), CURR_FMT));
  writeCell(ws, totalRow, 8,  mkCell('',               totalStyle()));
  writeCell(ws, totalRow, 9,  mkCell(prevTotal,        totalStyle('right'), CURR_FMT));
  writeCell(ws, totalRow, 10, mkCell('',               totalStyle()));
  writeCell(ws, totalRow, 11, mkCell(currTotal,        totalStyle('right'), CURR_FMT));
  writeCell(ws, totalRow, 12, mkCell(thisTotal,        totalStyle('right', thisTotal > 0 ? GREEN : INK), CURR_FMT));

  setRange(ws, totalRow + 1, HDR_COLS);

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HDR_COLS - 1 } }];

  ws['!cols'] = [
    { wch: 5  }, { wch: 8  }, { wch: 38 }, { wch: 14 }, { wch: 6  },
    { wch: 8  }, { wch: 12 }, { wch: 14 }, { wch: 9  }, { wch: 14 },
    { wch: 9  }, { wch: 14 }, { wch: 14 },
  ];

  // FIX: use !views for frozen panes — !freeze is not a SheetJS property
  freezeRows(ws, 2);
  ws['!autofilter'] = { ref: `A2:${colLetter(HDR_COLS - 1)}2` };
  // FIX: paperSize + orientation only — no fitToPage/fitToWidth/fitToHeight
  ws['!pageSetup'] = { paperSize: 9, orientation: 'landscape' };

  return ws;
}

// ─── Sheet 3: Variations ─────────────────────────────────────────────────────

function buildVariationsSheet(extraData: ExtraData[]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const HDR_COLS = 8;

  writeCell(ws, 0, 0, mkCell('EXTRAS / AGREED VARIATIONS', sectionHeaderStyle()));
  for (let c = 1; c < HDR_COLS; c++) writeCell(ws, 0, c, mkCell('', { fill: solidFill(ORANGE) }));

  const headers: [string, Align][] = [
    ['Ref',            'left'],
    ['Description',    'left'],
    ['Agreed Value',   'right'],
    ['Prev %',         'right'],
    ['Prev Value',     'right'],
    ['Curr %',         'right'],
    ['Curr Value',     'right'],
    ['This Valuation', 'right'],
  ];
  headers.forEach(([label, align], c) => writeCell(ws, 1, c, mkCell(label, tableHeaderStyle(align))));

  let maxRow = 2;
  extraData.forEach(({ extra, entry }, idx) => {
    const r       = idx + 2;
    const stripe  = idx % 2 === 1;
    const prevVal = extra.agreed_value * entry.previous_pct / 100;
    const currVal = extra.agreed_value * entry.current_pct  / 100;
    const thisVal = currVal - prevVal;

    writeCell(ws, r, 0, mkCell(extra.ref ?? '',    mutedCellStyle('left',  stripe)));
    writeCell(ws, r, 1, mkCell(extra.description,  cellStyle('left',  stripe)));
    writeCell(ws, r, 2, mkCell(extra.agreed_value, boldCellStyle('right', stripe), CURR_FMT));
    writeCell(ws, r, 3, mkCell(entry.previous_pct, mutedCellStyle('right', stripe), PCT_FMT));
    writeCell(ws, r, 4, mkCell(prevVal,            mutedCellStyle('right', stripe), CURR_FMT));
    writeCell(ws, r, 5, mkCell(entry.current_pct,  boldCellStyle('right', stripe), PCT_FMT));
    writeCell(ws, r, 6, mkCell(currVal,            boldCellStyle('right', stripe), CURR_FMT));
    writeCell(ws, r, 7, mkCell(thisVal, {
      font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: thisVal > 0 ? GREEN : (thisVal < 0 ? RED_ : INK) } },
      fill:      solidFill(stripe ? STRIPE : WHITE),
      alignment: { horizontal: 'right', vertical: 'top' },
      border:    bottomBorder(),
    }, CURR_FMT));

    maxRow = r + 1;
  });

  const totalRow    = maxRow;
  const agreedTotal = extraData.reduce((s, d) => s + d.extra.agreed_value, 0);
  const prevTotal   = extraData.reduce((s, d) => s + d.extra.agreed_value * d.entry.previous_pct / 100, 0);
  const currTotal   = extraData.reduce((s, d) => s + d.extra.agreed_value * d.entry.current_pct  / 100, 0);
  const thisTotal   = currTotal - prevTotal;

  writeCell(ws, totalRow, 0, mkCell('SUBTOTAL',                   totalStyle('left')));
  writeCell(ws, totalRow, 1, mkCell('Extras / Agreed Variations', totalStyle('left')));
  writeCell(ws, totalRow, 2, mkCell(agreedTotal,                  totalStyle('right'), CURR_FMT));
  writeCell(ws, totalRow, 3, mkCell('',                           totalStyle()));
  writeCell(ws, totalRow, 4, mkCell(prevTotal,                    totalStyle('right'), CURR_FMT));
  writeCell(ws, totalRow, 5, mkCell('',                           totalStyle()));
  writeCell(ws, totalRow, 6, mkCell(currTotal,                    totalStyle('right'), CURR_FMT));
  writeCell(ws, totalRow, 7, mkCell(thisTotal,                    totalStyle('right', thisTotal > 0 ? GREEN : INK), CURR_FMT));

  setRange(ws, totalRow + 1, HDR_COLS);

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HDR_COLS - 1 } }];

  ws['!cols'] = [
    { wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 9 },
    { wch: 14 }, { wch: 9  }, { wch: 14 }, { wch: 14 },
  ];

  freezeRows(ws, 2);
  ws['!autofilter'] = { ref: `A2:${colLetter(HDR_COLS - 1)}2` };
  ws['!pageSetup'] = { paperSize: 9, orientation: 'landscape' };

  return ws;
}

// ─── Sheet 4: Valuation Summary ───────────────────────────────────────────────

function buildSummarySheet(
  valuation: DBValuation,
  totals: ValuationTotals,
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  let row = 0;

  // Section header — spans A:B
  writeCell(ws, row, 0, mkCell('VALUATION SUMMARY', sectionHeaderStyle()));
  writeCell(ws, row, 1, mkCell('', { fill: solidFill(ORANGE) }));
  row++;

  // Sub-header — A and B are separate cells (no single-cell merge)
  writeCell(ws, row, 0, mkCell(`${valuation.ref}  \u2014  ${valuation.title}`, {
    font:      { name: 'Calibri', sz: 11, bold: true, color: { rgb: INK } },
    fill:      solidFill(LIGHT),
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
  }));
  writeCell(ws, row, 1, mkCell(issueDate, {
    font:      { name: 'Calibri', sz: 9, color: { rgb: MUTED } },
    fill:      solidFill(LIGHT),
    alignment: { horizontal: 'right', vertical: 'middle' },
  }));
  row++;

  // Spacer
  writeCell(ws, row, 0, mkCell('', { fill: solidFill(WHITE) }));
  writeCell(ws, row, 1, mkCell('', { fill: solidFill(WHITE) }));
  row++;

  const retPct = totals.retentionPct ?? 0;
  const mcdPct = totals.mcdPct ?? 0;
  const retAmt = totals.retentionAmt ?? 0;
  const mcdAmt = totals.mcdAmt ?? 0;
  const netVal = totals.netValuation ?? totals.amountDue;

  const summaryRows: [string, number, boolean][] = [
    ['Original Contract Value',          totals.contractOriginal, false],
    ['Extras / Agreed Variations Total', totals.extrasOriginal,   false],
    ['Gross Valuation to Date',          totals.grossToDate,      true],
    ['Less: Previous Valuation Total',   -totals.previousTotal,   false],
    ['Current Amount Due',               totals.amountDue,        false],
  ];
  if (retPct > 0) summaryRows.push([`Less: Retention (${retPct.toFixed(2)}%)`, -retAmt, false]);
  if (mcdPct > 0) summaryRows.push([`Less: MCD (${mcdPct.toFixed(2)}%)`,       -mcdAmt, false]);

  for (const [label, value, bold] of summaryRows) {
    writeCell(ws, row, 0, mkCell(label,  summaryLabelStyle(bold)));
    writeCell(ws, row, 1, mkCell(value,  summaryValueStyle(bold), CURR_FMT));
    row++;
  }

  // Spacer
  writeCell(ws, row, 0, mkCell('', { fill: solidFill(WHITE) }));
  writeCell(ws, row, 1, mkCell('', { fill: solidFill(WHITE) }));
  row++;

  // Net valuation due — prominent highlight row
  const netLabel = (retPct > 0 || mcdPct > 0) ? 'NET VALUATION DUE' : 'AMOUNT DUE THIS VALUATION';
  writeCell(ws, row, 0, mkCell(netLabel, {
    font:      { name: 'Calibri', sz: 13, bold: true, color: { rgb: GREEN } },
    fill:      { patternType: 'solid', fgColor: { rgb: 'EAF9F3' }, bgColor: { rgb: 'EAF9F3' } },
    alignment: { horizontal: 'left', vertical: 'middle' },
    border:    thinBorder(GREEN),
  }));
  writeCell(ws, row, 1, mkCell(netVal, {
    font:      { name: 'Calibri', sz: 16, bold: true, color: { rgb: GREEN } },
    fill:      { patternType: 'solid', fgColor: { rgb: 'EAF9F3' }, bgColor: { rgb: 'EAF9F3' } },
    alignment: { horizontal: 'right', vertical: 'middle' },
    border:    thinBorder(GREEN),
  }, CURR_FMT));
  row++;

  setRange(ws, row + 1, 2);

  // FIX: only merge cells that span more than one column.
  // The old code had { s:{r:1,c:0}, e:{r:1,c:0} } — a degenerate single-cell
  // merge that is invalid in OpenXML and triggers Excel repair.
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },   // section header A:B
  ];

  ws['!cols'] = [{ wch: 38 }, { wch: 18 }];
  ws['!rows'] = [{ hpt: 28 }, { hpt: 24 }];
  ws['!pageSetup'] = { paperSize: 9, orientation: 'portrait' };

  return ws;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildValuationXlsx(
  valuation: DBValuation,
  project: Project,
  lineData: LineData[],
  extraData: ExtraData[],
  totals: ValuationTotals,
  companyName?: string,
): Promise<void> {
  const wb = XLSX.utils.book_new();

  wb.Props = {
    Title:   valuation.title,
    Subject: 'Commercial Valuation',
    Author:  companyName || 'VYSITE',
    Company: companyName || 'VYSITE',
  };

  XLSX.utils.book_append_sheet(wb, buildCoverSheet(valuation, project, companyName), 'Cover');
  if (lineData.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildContractWorksSheet(lineData), 'Contract Works');
  }
  if (extraData.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildVariationsSheet(extraData), 'Variations');
  }
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(valuation, totals), 'Valuation Summary');

  const xlsxBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  const blob = new Blob([xlsxBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${valuation.ref}-${valuation.title.replace(/\s+/g, '-')}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
