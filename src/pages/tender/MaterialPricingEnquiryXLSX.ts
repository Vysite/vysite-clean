import ExcelJS from 'exceljs';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { DBTenderDrawing } from './drawingTypes';
import { finalQuantity } from './takeoffCalculations';

export interface MaterialEnquiryXLSXData {
  tenderName: string;
  tenderRef: string;
  client: string;
  location: string;
  items: DBTenderTakeoffItem[];
  drawings: DBTenderDrawing[];
  disciplineLabel: string;
  includeOmissions: boolean;
  showScope: boolean;
}

const C = {
  ORANGE: 'FFF97316',
  INK:    'FF0E1729',
  BODY:   'FF1E3050',
  MUTED:  'FF617090',
  LIGHT:  'FFEFF2F6',
  STRIPE: 'FFF8F9FB',
  WHITE:  'FFFFFFFF',
  RULE:   'FFDDE2EA',
  BLANK:  'FFFAFAFA',
} as const;

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function font(size: number, bold = false, argb = C.INK): Partial<ExcelJS.Font> {
  return { name: 'Calibri', size, bold, color: { argb } };
}

function align(h: 'left' | 'right' | 'center', v: 'top' | 'middle' | 'bottom' = 'top', wrap = false): Partial<ExcelJS.Alignment> {
  return { horizontal: h, vertical: v, wrapText: wrap };
}

function thinSide(argb: string): Partial<ExcelJS.BorderLine> {
  return { style: 'thin', color: { argb } };
}

function bottomOnly(argb = C.RULE): Partial<ExcelJS.Borders> {
  return { bottom: thinSide(argb) };
}

function box(argb = C.RULE): Partial<ExcelJS.Borders> {
  const s = thinSide(argb);
  return { top: s, bottom: s, left: s, right: s };
}

function drawingName(drawings: DBTenderDrawing[], id: string | null): string {
  if (!id) return 'Manual';
  const d = drawings.find(dr => dr.id === id);
  return d ? `${d.drawing_number || d.title}` : 'Unknown';
}

export async function exportMaterialPricingXLSX(data: MaterialEnquiryXLSXData): Promise<void> {
  if (data.items.length === 0) return;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Material Enquiry', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 2, xSplit: 0 }],
  });

  const showScope = data.showScope;

  // Column definitions
  const cols: { width: number }[] = [
    { width: 5 },   // A — #
    { width: 36 },  // B — Description
    { width: 14 },  // C — Discipline
  ];
  if (showScope) cols.push({ width: 14 }); // D — Category
  cols.push(
    { width: 14 },  // Drawing
    { width: 5 },   // Pg
    { width: 10 },  // Qty
    { width: 7 },   // Unit
  );
  if (showScope) cols.push({ width: 8 }); // Scope
  cols.push(
    { width: 14 },  // Supplier Rate
    { width: 14 },  // Supplier Total
    { width: 18 },  // Mfr / Part Ref
    { width: 10 },  // Lead Time
    { width: 28 },  // Supplier Notes
  );
  ws.columns = cols;

  // Row 1 — Brand bar
  const lastCol = showScope ? 15 : 13;
  ws.mergeCells(1, 1, 1, lastCol);
  const r1 = ws.getRow(1);
  r1.height = 32;
  const c1 = ws.getCell(1, 1);
  c1.value = 'VYSITE — Material Pricing Enquiry';
  c1.font = font(14, true, C.WHITE);
  c1.fill = fill(C.ORANGE);
  c1.alignment = align('left', 'middle');
  c1.border = box(C.ORANGE);

  // Row 2 — Tender metadata
  ws.mergeCells(2, 1, 2, lastCol);
  const r2 = ws.getRow(2);
  r2.height = 20;
  const c2 = ws.getCell(2, 1);
  const metaParts = [
    `Tender: ${data.tenderName}`,
    `Ref: ${data.tenderRef}`,
    data.client ? `Client: ${data.client}` : '',
    data.location ? `Location: ${data.location}` : '',
    `Trade: ${data.disciplineLabel}`,
  ].filter(Boolean);
  c2.value = metaParts.join('  |  ');
  c2.font = font(9, false, C.MUTED);
  c2.fill = fill(C.WHITE);
  c2.alignment = align('left', 'middle');

  // Row 3 — Column headers
  const headerRow = 3;
  const headers: string[] = ['#', 'Description', 'Discipline'];
  if (showScope) headers.push('Category');
  headers.push('Drawing', 'Pg', 'Qty', 'Unit');
  if (showScope) headers.push('Scope');
  headers.push('Supplier Unit Rate', 'Supplier Total', 'Mfr / Part Ref', 'Lead Time', 'Supplier Notes');

  for (let i = 0; i < headers.length; i++) {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = headers[i];
    cell.font = font(9, true, C.MUTED);
    cell.fill = fill(C.LIGHT);
    const hAlign: 'left' | 'right' | 'center' = ['Qty', 'Supplier Unit Rate', 'Supplier Total'].includes(headers[i]) ? 'right'
      : ['#', 'Pg', 'Lead Time'].includes(headers[i]) ? 'center' : 'left';
    cell.alignment = align(hAlign, 'middle');
    cell.border = { bottom: { style: 'medium', color: { argb: C.RULE } } };
  }
  ws.getRow(headerRow).height = 20;

  // Data rows
  const SCOPE_LABELS: Record<string, string> = { standard: 'STD', addition: '+ ADD', omission: 'OMIT' };

  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx];
    const fq = finalQuantity(item);
    const rowIdx = headerRow + 1 + idx;
    const stripe = idx % 2 === 1;
    const rowData: (string | number)[] = [
      idx + 1,
      item.label || 'Untitled',
      item.discipline,
    ];
    if (showScope) rowData.push(item.category || '');
    rowData.push(drawingName(data.drawings, item.drawing_id), item.page_number, fq, item.unit);
    if (showScope) rowData.push(SCOPE_LABELS[item.line_type] ?? item.line_type);
    // Blank supplier columns
    rowData.push('', '', '', '', '');

    for (let col = 0; col < rowData.length; col++) {
      const cell = ws.getCell(rowIdx, col + 1);
      cell.value = rowData[col] as string | number;
      const isBlank = col >= (showScope ? 9 : 8); // supplier pricing columns
      const isNum = ['Qty', 'Supplier Unit Rate', 'Supplier Total'].includes(headers[col]);
      const hAlign: 'left' | 'right' | 'center' = isNum ? 'right'
        : ['#', 'Pg', 'Lead Time'].includes(headers[col]) ? 'center' : 'left';
      cell.font = font(9, false, C.BODY);
      cell.fill = fill(isBlank ? C.BLANK : (stripe ? C.STRIPE : C.WHITE));
      cell.alignment = align(hAlign, 'top', !isNum && headers[col] === 'Description');
      cell.border = bottomOnly();
      if (headers[col] === 'Supplier Total' && isBlank) {
        // Formula: Qty * Supplier Rate (both initially blank)
        const qtyCol = showScope ? 'G' : 'F';
        const rateCol = showScope ? 'J' : 'I';
        cell.value = { formula: `${qtyCol}${rowIdx}*${rateCol}${rowIdx}` };
        cell.numFmt = '#,##0.00';
      }
      if (headers[col] === 'Supplier Unit Rate') {
        cell.numFmt = '#,##0.00';
      }
    }
  }

  // Note row
  const noteRow = headerRow + 1 + data.items.length + 1;
  ws.mergeCells(noteRow, 1, noteRow, lastCol);
  const noteCell = ws.getCell(noteRow, 1);
  noteCell.value = 'Please complete the supplier pricing columns and return this workbook.';
  noteCell.font = font(9, false, C.MUTED);
  noteCell.fill = fill(C.LIGHT);
  noteCell.alignment = align('left', 'middle');
  noteCell.border = box(C.RULE);

  // Generate filename
  const safeDiscipline = data.disciplineLabel.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
  const safeRef = data.tenderRef.replace(/[^a-zA-Z0-9_\-]/g, '');
  const filename = `VYSITE_Material_Enquiry_${safeDiscipline}_${safeRef}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
