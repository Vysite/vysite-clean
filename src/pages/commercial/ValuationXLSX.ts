import ExcelJS from 'exceljs';
import type { DBValuation } from '../../lib/store';
import type { Project } from '../../data/types';
import type { LineData, ExtraData, ValuationTotals } from './ValuationPDF';

// ─── Palette (ExcelJS uses ARGB hex: FF = fully opaque) ──────────────────────
const C = {
  ORANGE: 'FFF97316',
  INK:    'FF0E1729',
  BODY:   'FF1E3050',
  MUTED:  'FF617090',
  LIGHT:  'FFEFF2F6',
  STRIPE: 'FFF8F9FB',
  GREEN:  'FF0FA56F',
  RED:    'FFCC3333',
  WHITE:  'FFFFFFFF',
  RULE:   'FFDDE2EA',
} as const;

const CURR_FMT = '"£"#,##0.00';
const PCT_FMT  = '0.00"%"';  // values are 0-100, not 0-1

// ─── Style helpers ────────────────────────────────────────────────────────────

type Align  = 'left' | 'right' | 'center';
type VAlign = 'top'  | 'middle' | 'bottom';

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function font(
  size: number, bold = false, argb = C.INK,
  name = 'Calibri',
): Partial<ExcelJS.Font> {
  return { name, size, bold, color: { argb } };
}

function align(
  horizontal: Align, vertical: VAlign = 'middle', wrapText = false,
): Partial<ExcelJS.Alignment> {
  return { horizontal, vertical, wrapText };
}

function thinSide(argb: string): Partial<ExcelJS.BorderLine> {
  return { style: 'thin', color: { argb } };
}
function medSide(argb: string): Partial<ExcelJS.BorderLine> {
  return { style: 'medium', color: { argb } };
}

function box(argb = C.RULE): Partial<ExcelJS.Borders> {
  const s = thinSide(argb);
  return { top: s, bottom: s, left: s, right: s };
}

function bottomOnly(argb = C.RULE): Partial<ExcelJS.Borders> {
  return { bottom: thinSide(argb) };
}

function topBottom(argb = C.RULE): Partial<ExcelJS.Borders> {
  return { top: medSide(argb), bottom: medSide(argb) };
}

// Apply a style object to a cell in one call
function style(
  cell: ExcelJS.Cell,
  opts: {
    font?:      Partial<ExcelJS.Font>;
    fill?:      ExcelJS.Fill;
    alignment?: Partial<ExcelJS.Alignment>;
    border?:    Partial<ExcelJS.Borders>;
    numFmt?:    string;
  },
) {
  if (opts.font)      cell.font      = opts.font;
  if (opts.fill)      cell.fill      = opts.fill;
  if (opts.alignment) cell.alignment = opts.alignment;
  if (opts.border)    cell.border    = opts.border;
  if (opts.numFmt)    cell.numFmt    = opts.numFmt;
}

// ─── Reusable cell styles ─────────────────────────────────────────────────────

function applyOrangeHeader(cell: ExcelJS.Cell) {
  style(cell, {
    font:      font(10, true, C.WHITE),
    fill:      fill(C.ORANGE),
    alignment: align('left', 'middle'),
    border:    box(C.ORANGE),
  });
}

function applyColHeader(cell: ExcelJS.Cell, h: Align = 'left') {
  style(cell, {
    font:      font(9, true, C.MUTED),
    fill:      fill(C.LIGHT),
    alignment: align(h, 'middle'),
    border:    { bottom: medSide(C.RULE) },
  });
}

function applyDataCell(
  cell: ExcelJS.Cell,
  h: Align, stripe: boolean,
  bold = false, argb?: string, wrap = false, vAlign: VAlign = 'top',
) {
  style(cell, {
    font:      font(9, bold, argb ?? (bold ? C.INK : C.BODY)),
    fill:      fill(stripe ? C.STRIPE : C.WHITE),
    alignment: align(h, vAlign, wrap),
    border:    bottomOnly(),
  });
}

function applyTotalCell(cell: ExcelJS.Cell, h: Align, argb?: string) {
  style(cell, {
    font:      font(9, true, argb ?? C.INK),
    fill:      fill(C.LIGHT),
    alignment: align(h, 'middle'),
    border:    topBottom(),
  });
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function issueDate(): string {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Sheet 1: Cover ───────────────────────────────────────────────────────────

function buildCoverSheet(
  wb: ExcelJS.Workbook,
  valuation: DBValuation,
  project: Project,
  companyName: string,
) {
  const ws = wb.addWorksheet('Commercial Valuation', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 },
  ];

  // Row 1 — Company name / brand bar
  ws.mergeCells('A1:D1');
  const r1 = ws.getRow(1);
  r1.height = 36;
  const c1 = ws.getCell('A1');
  c1.value = companyName || 'VYSITE';
  style(c1, {
    font:      font(16, true, C.WHITE),
    fill:      fill(C.ORANGE),
    alignment: align('left', 'middle'),
    border:    box(C.ORANGE),
  });

  // Row 2 — Eyebrow label
  ws.mergeCells('A2:D2');
  ws.getRow(2).height = 18;
  const c2 = ws.getCell('A2');
  c2.value = 'COMMERCIAL VALUATION';
  style(c2, {
    font:      font(8, true, C.MUTED),
    fill:      fill(C.WHITE),
    alignment: align('left', 'middle'),
  });

  // Row 3 — Valuation title
  ws.mergeCells('A3:D3');
  ws.getRow(3).height = 40;
  const c3 = ws.getCell('A3');
  c3.value = valuation.title;
  style(c3, {
    font:      font(20, true, C.INK),
    fill:      fill(C.WHITE),
    alignment: align('left', 'middle', true),
  });

  // Row 4 — Reference badge
  ws.mergeCells('A4:D4');
  ws.getRow(4).height = 24;
  const c4 = ws.getCell('A4');
  c4.value = valuation.ref;
  style(c4, {
    font:      font(12, true, C.ORANGE),
    fill:      fill('FFFFF4EC'),
    alignment: align('left', 'middle'),
    border:    box(C.ORANGE),
  });

  // Row 5 — Spacer
  ws.mergeCells('A5:D5');
  ws.getCell('A5').fill = fill(C.WHITE);

  // Row 6 — Section header
  ws.mergeCells('A6:D6');
  ws.getRow(6).height = 22;
  const c6 = ws.getCell('A6');
  c6.value = 'VALUATION DETAILS';
  applyOrangeHeader(c6);

  const meta: [string, string][] = [
    ['PROJECT',        project.name || ''],
    ['CLIENT',         valuation.client || ''],
    ['CONTRACTOR',     valuation.contractor || ''],
    ['VALUATION DATE', fmtDate(valuation.valuation_date)],
    ['ISSUE DATE',     issueDate()],
    ['PERIOD',         valuation.period || ''],
    ['STATUS',         cap(valuation.status)],
  ];

  let row = 7;
  for (const [label, value] of meta) {
    ws.mergeCells(`A${row}:D${row}`);
    const labelCell = ws.getCell(`A${row}`);
    labelCell.value = label;
    style(labelCell, {
      font:      font(8, true, C.MUTED),
      fill:      fill(C.WHITE),
      alignment: align('left', 'bottom'),
    });
    ws.getRow(row).height = 14;
    row++;

    ws.mergeCells(`A${row}:D${row}`);
    const valCell = ws.getCell(`A${row}`);
    valCell.value = value || '—';
    style(valCell, {
      font:      font(11, true, C.INK),
      fill:      fill(C.WHITE),
      alignment: align('left', 'top', true),
    });
    ws.getRow(row).height = 18;
    row++;

    // Thin divider
    ws.mergeCells(`A${row}:D${row}`);
    const div = ws.getCell(`A${row}`);
    div.fill   = fill(C.WHITE);
    div.border = { bottom: thinSide(C.RULE) };
    ws.getRow(row).height = 4;
    row++;
  }

  if (valuation.notes) {
    ws.mergeCells(`A${row}:D${row}`);
    const hdr = ws.getCell(`A${row}`);
    hdr.value = 'NOTES';
    applyOrangeHeader(hdr);
    ws.getRow(row).height = 22;
    row++;

    ws.mergeCells(`A${row}:D${row}`);
    const notes = ws.getCell(`A${row}`);
    notes.value = valuation.notes;
    style(notes, {
      font:      font(10, false, C.BODY),
      fill:      fill(C.LIGHT),
      alignment: align('left', 'top', true),
    });
    ws.getRow(row).height = 60;
  }
}

// ─── Sheet 2: Contract Works ──────────────────────────────────────────────────

function buildContractWorksSheet(
  wb: ExcelJS.Workbook,
  lineData: LineData[],
) {
  const ws = wb.addWorksheet('Contract Works', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views:     [{ state: 'frozen', ySplit: 2, xSplit: 0 }],
  });

  ws.columns = [
    { width: 5  }, // A — #
    { width: 9  }, // B — Item
    { width: 40 }, // C — Description
    { width: 14 }, // D — Section
    { width: 6  }, // E — Unit
    { width: 8  }, // F — Qty
    { width: 13 }, // G — Rate
    { width: 14 }, // H — Contract Value
    { width: 9  }, // I — Prev %
    { width: 14 }, // J — Prev Value
    { width: 9  }, // K — Curr %
    { width: 14 }, // L — Curr Value
    { width: 14 }, // M — This Valuation
  ];

  // Row 1 — Section header
  ws.mergeCells('A1:M1');
  ws.getRow(1).height = 22;
  const hdr = ws.getCell('A1');
  hdr.value = 'CONTRACT WORKS';
  applyOrangeHeader(hdr);

  // Row 2 — Column headers
  const HEADERS: [string, Align][] = [
    ['#', 'right'], ['Item', 'left'], ['Description', 'left'],
    ['Section', 'left'], ['Unit', 'left'], ['Qty', 'right'],
    ['Rate', 'right'], ['Contract Value', 'right'],
    ['Prev %', 'right'], ['Prev Value', 'right'],
    ['Curr %', 'right'], ['Curr Value', 'right'],
    ['This Valuation', 'right'],
  ];
  const colRow = ws.getRow(2);
  colRow.height = 18;
  HEADERS.forEach(([label, h], i) => {
    const cell = colRow.getCell(i + 1);
    cell.value = label;
    applyColHeader(cell, h);
  });

  // Data rows
  lineData.forEach(({ line, entry }, idx) => {
    const r      = ws.getRow(idx + 3);
    r.height     = 18;
    const stripe = idx % 2 === 1;
    const prev   = line.contract_value * entry.previous_pct / 100;
    const curr   = line.contract_value * entry.current_pct  / 100;
    const thisV  = curr - prev;

    const cells: [number, string | number | null, Align, boolean, string?, string?][] = [
      [1,  idx + 1,                                            'right', false, undefined,  undefined],
      [2,  line.item_number ?? '',                             'left',  false, C.MUTED,   undefined],
      [3,  line.description,                                   'left',  false, undefined,  undefined],
      [4,  line.section ?? '',                                 'left',  false, C.MUTED,   undefined],
      [5,  line.unit ?? '',                                    'left',  false, C.MUTED,   undefined],
      [6,  line.quantity ?? '',                                'right', false, C.MUTED,   undefined],
      [7,  line.rate ?? '',                                    'right', false, C.MUTED,   CURR_FMT],
      [8,  line.contract_value,                                'right', true,  undefined,  CURR_FMT],
      [9,  entry.previous_pct,                                 'right', false, C.MUTED,   PCT_FMT],
      [10, prev,                                               'right', false, C.MUTED,   CURR_FMT],
      [11, entry.current_pct,                                  'right', true,  undefined,  PCT_FMT],
      [12, curr,                                               'right', true,  undefined,  CURR_FMT],
      [13, thisV,                                              'right', true,  thisV > 0 ? C.GREEN : (thisV < 0 ? C.RED : C.INK), CURR_FMT],
    ];

    cells.forEach(([col, val, h, bold, argb, numFmt]) => {
      const cell = r.getCell(col);
      // Description wraps; others don't
      const wrap = col === 3;
      applyDataCell(cell, h, stripe, bold, argb, wrap);
      cell.value = (val === '' || val == null) ? null : val;
      if (numFmt) cell.numFmt = numFmt;
    });
  });

  // Totals row
  const total    = lineData.reduce((s, d) => s + d.line.contract_value, 0);
  const prevTot  = lineData.reduce((s, d) => s + d.line.contract_value * d.entry.previous_pct / 100, 0);
  const currTot  = lineData.reduce((s, d) => s + d.line.contract_value * d.entry.current_pct  / 100, 0);
  const thisTot  = currTot - prevTot;
  const tRow     = ws.getRow(lineData.length + 3);
  tRow.height    = 20;

  const totVals: [number, string | number | null, Align, string?][] = [
    [1,  'SUBTOTAL',       'left',  undefined],
    [2,  '',               'left',  undefined],
    [3,  'Contract Works', 'left',  undefined],
    [4,  '',               'left',  undefined],
    [5,  '',               'left',  undefined],
    [6,  '',               'right', undefined],
    [7,  '',               'right', undefined],
    [8,  total,            'right', CURR_FMT],
    [9,  '',               'right', undefined],
    [10, prevTot,          'right', CURR_FMT],
    [11, '',               'right', undefined],
    [12, currTot,          'right', CURR_FMT],
    [13, thisTot,          'right', CURR_FMT],
  ];
  totVals.forEach(([col, val, h, numFmt]) => {
    const cell = tRow.getCell(col);
    applyTotalCell(cell, h, col === 13 ? (thisTot >= 0 ? C.GREEN : C.RED) : undefined);
    cell.value = (val === '') ? null : val;
    if (numFmt) cell.numFmt = numFmt;
  });

  ws.autoFilter = { from: 'A2', to: 'M2' };
}

// ─── Sheet 3: Variations ─────────────────────────────────────────────────────

function buildVariationsSheet(
  wb: ExcelJS.Workbook,
  extraData: ExtraData[],
) {
  const ws = wb.addWorksheet('Variations', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views:     [{ state: 'frozen', ySplit: 2, xSplit: 0 }],
  });

  ws.columns = [
    { width: 11 }, // A — Ref
    { width: 42 }, // B — Description
    { width: 14 }, // C — Agreed Value
    { width: 9  }, // D — Prev %
    { width: 14 }, // E — Prev Value
    { width: 9  }, // F — Curr %
    { width: 14 }, // G — Curr Value
    { width: 14 }, // H — This Valuation
  ];

  ws.mergeCells('A1:H1');
  ws.getRow(1).height = 22;
  const hdr = ws.getCell('A1');
  hdr.value = 'EXTRAS / AGREED VARIATIONS';
  applyOrangeHeader(hdr);

  const HEADERS: [string, Align][] = [
    ['Ref', 'left'], ['Description', 'left'], ['Agreed Value', 'right'],
    ['Prev %', 'right'], ['Prev Value', 'right'],
    ['Curr %', 'right'], ['Curr Value', 'right'], ['This Valuation', 'right'],
  ];
  const colRow = ws.getRow(2);
  colRow.height = 18;
  HEADERS.forEach(([label, h], i) => {
    const cell = colRow.getCell(i + 1);
    cell.value = label;
    applyColHeader(cell, h);
  });

  extraData.forEach(({ extra, entry }, idx) => {
    const r      = ws.getRow(idx + 3);
    r.height     = 18;
    const stripe = idx % 2 === 1;
    const prev   = extra.agreed_value * entry.previous_pct / 100;
    const curr   = extra.agreed_value * entry.current_pct  / 100;
    const thisV  = curr - prev;

    const cells: [number, string | number | null, Align, boolean, string?, string?][] = [
      [1, extra.ref ?? '',     'left',  false, C.MUTED,  undefined],
      [2, extra.description,   'left',  false, undefined, undefined],
      [3, extra.agreed_value,  'right', true,  undefined, CURR_FMT],
      [4, entry.previous_pct,  'right', false, C.MUTED,  PCT_FMT],
      [5, prev,                'right', false, C.MUTED,  CURR_FMT],
      [6, entry.current_pct,   'right', true,  undefined, PCT_FMT],
      [7, curr,                'right', true,  undefined, CURR_FMT],
      [8, thisV,               'right', true,  thisV > 0 ? C.GREEN : (thisV < 0 ? C.RED : C.INK), CURR_FMT],
    ];

    cells.forEach(([col, val, h, bold, argb, numFmt]) => {
      const cell = r.getCell(col);
      const wrap = col === 2;
      applyDataCell(cell, h, stripe, bold, argb, wrap);
      cell.value = (val === '' || val == null) ? null : val;
      if (numFmt) cell.numFmt = numFmt;
    });
  });

  const agreedTot = extraData.reduce((s, d) => s + d.extra.agreed_value, 0);
  const prevTot   = extraData.reduce((s, d) => s + d.extra.agreed_value * d.entry.previous_pct / 100, 0);
  const currTot   = extraData.reduce((s, d) => s + d.extra.agreed_value * d.entry.current_pct  / 100, 0);
  const thisTot   = currTot - prevTot;
  const tRow      = ws.getRow(extraData.length + 3);
  tRow.height     = 20;

  const totVals: [number, string | number | null, Align, string?][] = [
    [1, 'SUBTOTAL',                   'left',  undefined],
    [2, 'Extras / Agreed Variations', 'left',  undefined],
    [3, agreedTot,                    'right', CURR_FMT],
    [4, '',                           'right', undefined],
    [5, prevTot,                      'right', CURR_FMT],
    [6, '',                           'right', undefined],
    [7, currTot,                      'right', CURR_FMT],
    [8, thisTot,                      'right', CURR_FMT],
  ];
  totVals.forEach(([col, val, h, numFmt]) => {
    const cell = tRow.getCell(col);
    applyTotalCell(cell, h, col === 8 ? (thisTot >= 0 ? C.GREEN : C.RED) : undefined);
    cell.value = (val === '') ? null : val;
    if (numFmt) cell.numFmt = numFmt;
  });

  ws.autoFilter = { from: 'A2', to: 'H2' };
}

// ─── Sheet 4: Valuation Summary ───────────────────────────────────────────────

function buildSummarySheet(
  wb: ExcelJS.Workbook,
  valuation: DBValuation,
  totals: ValuationTotals,
) {
  const ws = wb.addWorksheet('Valuation Summary', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [{ width: 40 }, { width: 20 }];

  // Row 1 — section header
  ws.mergeCells('A1:B1');
  ws.getRow(1).height = 28;
  const hdr = ws.getCell('A1');
  hdr.value = 'VALUATION SUMMARY';
  applyOrangeHeader(hdr);

  // Row 2 — ref / date sub-header
  ws.getRow(2).height = 24;
  const refCell = ws.getCell('A2');
  refCell.value = `${valuation.ref}  —  ${valuation.title}`;
  style(refCell, {
    font:      font(11, true, C.INK),
    fill:      fill(C.LIGHT),
    alignment: align('left', 'middle', true),
  });
  const dateCell = ws.getCell('B2');
  dateCell.value = issueDate();
  style(dateCell, {
    font:      font(9, false, C.MUTED),
    fill:      fill(C.LIGHT),
    alignment: align('right', 'middle'),
  });

  // Row 3 — spacer
  ws.getRow(3).height = 8;

  const retPct = totals.retentionPct ?? 0;
  const mcdPct = totals.mcdPct ?? 0;
  const retAmt = totals.retentionAmt ?? 0;
  const mcdAmt = totals.mcdAmt ?? 0;
  const netVal = totals.netValuation ?? totals.amountDue;

  const summaryRows: [string, number, boolean][] = [
    ['Original Contract Value',          totals.contractOriginal, false],
    ['Extras / Agreed Variations Total', totals.extrasOriginal,   false],
    ['Gross Valuation to Date',          totals.grossToDate,      true ],
    ['Less: Previous Valuation Total',  -totals.previousTotal,    false],
    ['Current Amount Due',               totals.amountDue,        false],
  ];
  if (retPct > 0) summaryRows.push([`Less: Retention (${retPct.toFixed(2)}%)`, -retAmt, false]);
  if (mcdPct > 0) summaryRows.push([`Less: MCD (${mcdPct.toFixed(2)}%)`,       -mcdAmt, false]);

  let rowNum = 4;
  for (const [label, value, bold] of summaryRows) {
    const r = ws.getRow(rowNum);
    r.height = 22;

    const lc = r.getCell(1);
    lc.value = label;
    style(lc, {
      font:      font(11, bold, bold ? C.INK : C.BODY),
      fill:      fill(C.WHITE),
      alignment: align('left', 'middle'),
      border:    bottomOnly(),
    });

    const vc = r.getCell(2);
    vc.value  = value;
    vc.numFmt = CURR_FMT;
    style(vc, {
      font:      font(11, bold, bold ? C.INK : C.BODY),
      fill:      fill(C.WHITE),
      alignment: align('right', 'middle'),
      border:    bottomOnly(),
    });

    rowNum++;
  }

  // Spacer
  ws.getRow(rowNum).height = 10;
  rowNum++;

  // Net / Amount due — prominent highlight
  ws.mergeCells(`A${rowNum}:A${rowNum}`); // single (no merge needed)
  const netLabel = (retPct > 0 || mcdPct > 0) ? 'NET VALUATION DUE' : 'AMOUNT DUE THIS VALUATION';
  const nlRow    = ws.getRow(rowNum);
  nlRow.height   = 36;

  const nlLabel  = nlRow.getCell(1);
  nlLabel.value  = netLabel;
  style(nlLabel, {
    font:      font(13, true, C.GREEN),
    fill:      fill('FFEAF9F3'),
    alignment: align('left', 'middle'),
    border:    box(C.GREEN),
  });

  const nlValue  = nlRow.getCell(2);
  nlValue.value  = netVal;
  nlValue.numFmt = CURR_FMT;
  style(nlValue, {
    font:      font(16, true, C.GREEN),
    fill:      fill('FFEAF9F3'),
    alignment: align('right', 'middle'),
    border:    box(C.GREEN),
  });
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
  const wb = new ExcelJS.Workbook();
  wb.creator   = companyName || 'VYSITE';
  wb.company   = companyName || 'VYSITE';
  wb.title     = valuation.title;
  wb.subject   = 'Commercial Valuation';
  wb.created   = new Date();
  wb.modified  = new Date();

  buildCoverSheet(wb, valuation, project, companyName || 'VYSITE');
  if (lineData.length > 0)  buildContractWorksSheet(wb, lineData);
  if (extraData.length > 0) buildVariationsSheet(wb, extraData);
  buildSummarySheet(wb, valuation, totals);

  const buffer  = await wb.xlsx.writeBuffer();
  const blob    = new Blob(
    [buffer],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `${valuation.ref}-${valuation.title.replace(/\s+/g, '-')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
