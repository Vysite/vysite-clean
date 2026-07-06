import {
  PDFDocument,
  PDFPage,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
} from 'pdf-lib';
import { supabase } from '../../lib/supabase';
import type {
  DBOAndMManual,
  DBOAndMSection,
  DBOAndMItem,
  DBProjectDocument,
  DBTCRecord,
  DBSiteForm,
} from '../../lib/store';
import type { Project } from '../../data/types';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface OrgInfo {
  companyName: string;
  logoDataUrl?: string;
}

export type BuildProgress = {
  stage: string;
  current: number;
  total: number;
};

export async function buildOAndMPdf(
  manual: DBOAndMManual,
  sections: DBOAndMSection[],
  items: DBOAndMItem[],
  project: Project,
  orgInfo: OrgInfo,
  projectDocuments: DBProjectDocument[],
  tcRecords: DBTCRecord[],
  siteForms: DBSiteForm[],
  onProgress?: (p: BuildProgress) => void,
): Promise<Uint8Array> {
  const ctx = new BuildContext(manual, project, orgInfo, onProgress);
  await ctx.init();

  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  const totalItems = items.length;
  let itemsDone = 0;

  onProgress?.({ stage: 'Building cover and contents', current: 0, total: totalItems + 3 });
  await ctx.addCoverPage();
  onProgress?.({ stage: 'Building contents page', current: 1, total: totalItems + 3 });
  await ctx.addContentsPage(sortedSections, items);
  onProgress?.({ stage: 'Building sections', current: 2, total: totalItems + 3 });

  for (const section of sortedSections) {
    const sectionItems = items
      .filter(i => i.section_id === section.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = sortedSections.indexOf(section);
    await ctx.addSectionDivider(section, idx, sectionItems);

    for (const item of sectionItems) {
      itemsDone++;
      onProgress?.({ stage: `${section.title}: ${item.title}`, current: 2 + itemsDone, total: totalItems + 3 });

      if (item.source_module === 'project_document') {
        const doc = projectDocuments.find(d => d.id === item.source_record_id);
        await ctx.addProjectDocument(item, doc);
      } else if (item.source_module === 'tc_record') {
        const rec = tcRecords.find(r => r.id === item.source_record_id);
        await ctx.addTCRecord(item, rec);
      } else if (item.source_module === 'site_form') {
        const form = siteForms.find(f => f.id === item.source_record_id);
        await ctx.addSiteForm(item, form);
      }
    }
  }

  onProgress?.({ stage: 'Finalising PDF', current: totalItems + 3, total: totalItems + 3 });
  return ctx.output.save();
}

// ─── Page constants ───────────────────────────────────────────────────────────

const A4_W = 595.28;
const A4_H = 841.89;
const M = 52; // margin

// rgb palette
const C_INK   = rgb(0.055, 0.086, 0.161);
const C_BODY  = rgb(0.118, 0.176, 0.298);
const C_MID   = rgb(0.271, 0.329, 0.427);
const C_MUTED = rgb(0.580, 0.635, 0.725);
const C_FAINT = rgb(0.882, 0.906, 0.929);
const C_WHITE = rgb(1, 1, 1);
const C_ORANGE = rgb(0.976, 0.451, 0.086);
const C_SKY    = rgb(0.055, 0.647, 0.914);
const C_GREEN  = rgb(0.063, 0.733, 0.506);
const C_RED    = rgb(0.863, 0.149, 0.149);
const C_AMBER  = rgb(0.855, 0.604, 0.075);
const C_PANELBG = rgb(0.973, 0.980, 0.988);

// ─── Build context ────────────────────────────────────────────────────────────

class BuildContext {
  output: PDFDocument = null!;
  bold: PDFFont = null!;
  regular: PDFFont = null!;
  oblique: PDFFont = null!;
  logoImg: PDFImage | null = null;

  constructor(
    private manual: DBOAndMManual,
    private project: Project,
    private orgInfo: OrgInfo,
    private _onProgress?: (p: BuildProgress) => void,
  ) {}

  async init() {
    this.output = await PDFDocument.create();
    this.regular = await this.output.embedFont(StandardFonts.Helvetica);
    this.bold    = await this.output.embedFont(StandardFonts.HelveticaBold);
    this.oblique = await this.output.embedFont(StandardFonts.HelveticaOblique);
    if (this.orgInfo.logoDataUrl) {
      try { this.logoImg = await embedImage(this.output, this.orgInfo.logoDataUrl); }
      catch { this.logoImg = null; }
    }
  }

  // ── Cover ────────────────────────────────────────────────────────────────────

  async addCoverPage() {
    const p = this.output.addPage([A4_W, A4_H]);
    const { manual, project, orgInfo } = this;

    // Full dark sidebar
    p.drawRectangle({ x: 0, y: 0, width: 52, height: A4_H, color: C_INK });

    // Orange accent bar on sidebar
    p.drawRectangle({ x: 0, y: 180, width: 52, height: 4, color: C_ORANGE });

    // Top rule
    p.drawRectangle({ x: 52, y: A4_H - 4, width: A4_W - 52, height: 4, color: C_ORANGE });

    // Logo
    let logoBottomY = A4_H - M - 14;
    if (this.logoImg) {
      const scale = Math.min(160 / this.logoImg.width, 44 / this.logoImg.height);
      const lw = this.logoImg.width * scale;
      const lh = this.logoImg.height * scale;
      p.drawImage(this.logoImg, { x: 72, y: A4_H - M - lh, width: lw, height: lh });
      logoBottomY = A4_H - M - lh;
    } else {
      dt(p, this.bold, orgInfo.companyName || 'Organisation', 72, logoBottomY, 16, C_INK);
    }

    // Status badge
    const statusText = manual.status === 'finalised' ? 'FINALISED'
      : manual.status === 'in_progress' ? 'IN PROGRESS' : 'DRAFT';
    const badgeCol = manual.status === 'finalised' ? C_GREEN
      : manual.status === 'in_progress' ? C_AMBER : C_MUTED;
    const bw = this.bold.widthOfTextAtSize(statusText, 8) + 18;
    p.drawRectangle({ x: A4_W - M - bw, y: A4_H - M - 20, width: bw, height: 20, borderColor: badgeCol, borderWidth: 1.5 });
    dt(p, this.bold, statusText, A4_W - M - bw + 9, A4_H - M - 14, 8, badgeCol);

    // Label
    dt(p, this.regular, 'OPERATION & MAINTENANCE MANUAL', 72, 420, 7.5, C_MUTED, { ls: 2.5 });

    // Manual title — large
    const titleY = 355;
    wrapText(p, this.bold, manual.title, 72, titleY, A4_W - 72 - M - 10, 30, C_INK, 36);

    // Version tag
    if (manual.version) {
      const vw = this.regular.widthOfTextAtSize(manual.version, 10) + 20;
      p.drawRectangle({ x: 72, y: titleY - 66, width: vw, height: 20, color: rgb(0.96, 0.97, 0.99), borderColor: C_FAINT, borderWidth: 0.5 });
      dt(p, this.regular, manual.version, 82, titleY - 56, 10, C_MID);
    }

    // Horizontal rule
    p.drawLine({ start: { x: 72, y: 195 }, end: { x: A4_W - M, y: 195 }, thickness: 1, color: C_FAINT });

    // Project metadata grid
    const cols = 2;
    const colW = (A4_W - 72 - M) / cols;
    const metaRows: [string, string][] = [
      ['Project', project.name],
      ['Client', project.client || '—'],
      ['Location', project.location || '—'],
      ['Project Manager', project.projectManager || '—'],
      ['Contractor', orgInfo.companyName || '—'],
      ['Document Date', fmtDate(manual.updated_at || manual.created_at)],
    ];
    metaRows.forEach(([label, value], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const gx = 72 + col * colW;
      const gy = 170 - row * 44;
      dt(p, this.bold, label.toUpperCase(), gx, gy + 16, 7, C_MUTED, { ls: 1.2 });
      wrapText(p, this.bold, value, gx, gy, colW - 12, 11, C_BODY, 14);
    });

    this.footer(p);
  }

  // ── Contents ─────────────────────────────────────────────────────────────────

  async addContentsPage(sections: DBOAndMSection[], items: DBOAndMItem[]) {
    const p = this.output.addPage([A4_W, A4_H]);
    this.topRule(p, C_ORANGE);

    dt(p, this.regular, 'TABLE OF', M, A4_H - M - 10, 8, C_MUTED, { ls: 2.5 });
    dt(p, this.bold, 'Contents', M, A4_H - M - 42, 26, C_INK);
    p.drawRectangle({ x: M, y: A4_H - M - 52, width: 44, height: 3, color: C_ORANGE });

    let y = A4_H - M - 82;
    sections.forEach((sec, idx) => {
      if (y < M + 40) return;
      const count = items.filter(i => i.section_id === sec.id).length;
      const numStr = String(idx + 1).padStart(2, '0');

      // Row background on hover (alternating)
      if (idx % 2 === 0) {
        p.drawRectangle({ x: M - 4, y: y - 16, width: A4_W - M * 2 + 8, height: sec.description ? 36 : 24, color: rgb(0.985, 0.988, 0.993) });
      }

      dt(p, this.bold, numStr, M, y, 10, C_FAINT);
      dt(p, this.bold, sec.title, M + 30, y, 12, C_BODY);
      const cStr = `${count}`;
      const cw = this.bold.widthOfTextAtSize(cStr, 10);
      p.drawRectangle({ x: A4_W - M - cw - 14, y: y - 12, width: cw + 14, height: 18, color: rgb(0.95, 0.97, 0.99), borderColor: C_FAINT, borderWidth: 0.5 });
      dt(p, this.bold, cStr, A4_W - M - cw - 7, y, 10, C_MUTED);

      if (sec.description) {
        dt(p, this.regular, sec.description, M + 30, y - 14, 9, C_MUTED);
        y -= 38;
      } else {
        y -= 28;
      }

      p.drawLine({ start: { x: M, y }, end: { x: A4_W - M, y: y }, thickness: 0.4, color: C_FAINT });
      y -= 4;
    });

    this.footer(p);
  }

  // ── Section divider ───────────────────────────────────────────────────────────

  async addSectionDivider(section: DBOAndMSection, index: number, sectionItems: DBOAndMItem[]) {
    const p = this.output.addPage([A4_W, A4_H]);
    this.topRule(p, C_ORANGE);

    // Large faint number
    const numStr = String(index + 1).padStart(2, '0');
    p.drawText(numStr, { x: A4_W - M - 100, y: A4_H / 2 - 50, size: 180, font: this.bold, color: rgb(0.95, 0.96, 0.97) });

    // Section label
    dt(p, this.regular, `SECTION ${String(index + 1).padStart(2, '0')}`, M, A4_H - M - 10, 8, C_MUTED, { ls: 2.5 });
    wrapText(p, this.bold, section.title, M, A4_H - M - 68, A4_W - M * 2 - 80, 28, C_INK, 34);
    p.drawRectangle({ x: M, y: A4_H - M - 80, width: 44, height: 3, color: C_ORANGE });

    if (section.description) {
      wrapText(p, this.regular, section.description, M, A4_H - M - 118, A4_W - M * 2 - 80, 11, C_MID, 16);
    }

    // Document list
    if (sectionItems.length > 0) {
      const listY = section.description ? A4_H - M - 180 : A4_H - M - 148;
      dt(p, this.bold, 'DOCUMENTS IN THIS SECTION', M, listY + 16, 7, C_MUTED, { ls: 1.5 });
      p.drawLine({ start: { x: M, y: listY + 2 }, end: { x: A4_W - M, y: listY + 2 }, thickness: 0.5, color: C_FAINT });
      let ly = listY - 12;
      sectionItems.slice(0, 20).forEach((item, i) => {
        if (ly < M + 60) return;
        dt(p, this.bold, String(i + 1).padStart(2, '0'), M, ly, 8, C_FAINT);
        dt(p, this.bold, item.title, M + 26, ly, 10, C_BODY);
        if (item.subtitle) dt(p, this.regular, item.subtitle, M + 26, ly - 12, 8, C_MUTED);
        const badge = item.source_module === 'tc_record' ? 'T&C'
          : item.source_module === 'site_form' ? 'FORM' : 'DOC';
        const bw = this.bold.widthOfTextAtSize(badge, 7) + 12;
        p.drawRectangle({ x: A4_W - M - bw, y: ly - 10, width: bw, height: 14, color: C_PANELBG, borderColor: C_FAINT, borderWidth: 0.5 });
        dt(p, this.bold, badge, A4_W - M - bw + 6, ly, 7, C_MUTED);
        ly -= item.subtitle ? 30 : 20;
        p.drawLine({ start: { x: M + 26, y: ly + 2 }, end: { x: A4_W - M, y: ly + 2 }, thickness: 0.3, color: C_FAINT });
        ly -= 4;
      });
    }

    this.footer(p);
  }

  // ── Project Document ──────────────────────────────────────────────────────────

  async addProjectDocument(item: DBOAndMItem, doc: DBProjectDocument | undefined) {
    if (!doc) { await this.addExceptionPage(item.title, 'Document record not found in this project.'); return; }

    let dataUrl = doc.data_url;
    if (!dataUrl) {
      const { data } = await supabase.from('vy_project_documents').select('id,data_url').eq('id', doc.id).maybeSingle();
      dataUrl = data?.data_url ?? undefined;
    }
    if (!dataUrl) { await this.addExceptionPage((doc.doc_title ?? '').trim() || doc.name, 'Document data unavailable. Please re-upload.'); return; }

    const cat = mimeCategory(doc.type);
    const displayName = (doc.doc_title ?? '').trim() || doc.name;

    if (cat === 'pdf') {
      await this.titlePage(item, doc, displayName, 'DOC');
      await this.mergePdf(displayName, dataUrl);
    } else if (cat === 'image') {
      await this.titlePage(item, doc, displayName, 'IMG');
      await this.imageFullPage(displayName, doc.type, dataUrl);
    } else {
      await this.titlePage(item, doc, displayName, doc.name.split('.').pop()?.toUpperCase() ?? 'FILE');
      await this.unsupportedPage(displayName, doc.name);
    }
  }

  private async mergePdf(displayName: string, dataUrl: string) {
    try {
      const bytes = dataUrlToBytes(dataUrl);
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const count = src.getPageCount();
      if (count === 0) { await this.addExceptionPage(displayName, 'This PDF contains no pages.'); return; }
      const indices = Array.from({ length: count }, (_, i) => i);
      const copied = await this.output.copyPages(src, indices);
      copied.forEach(pg => this.output.addPage(pg));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isEnc = /encrypt|password/i.test(msg);
      await this.addExceptionPage(displayName,
        isEnc ? 'This PDF is password-protected. Please supply an unlocked version.'
              : `PDF could not be merged: ${msg.slice(0, 100)}`);
    }
  }

  private async imageFullPage(displayName: string, mimeType: string, dataUrl: string) {
    try {
      const bytes = dataUrlToBytes(dataUrl);
      const isJpeg = mimeType === 'image/jpeg' || mimeType === 'image/jpg';
      const img = isJpeg ? await this.output.embedJpg(bytes) : await this.output.embedPng(bytes);
      const p = this.output.addPage([A4_W, A4_H]);
      const { width: iW, height: iH } = img.size();
      const maxW = A4_W - M * 2;
      const maxH = A4_H - M * 2 - 20;
      const scale = Math.min(maxW / iW, maxH / iH);
      const dw = iW * scale;
      const dh = iH * scale;
      p.drawImage(img, { x: (A4_W - dw) / 2, y: (A4_H - dh) / 2 + 10, width: dw, height: dh });
      const capW = this.oblique.widthOfTextAtSize(displayName, 8);
      dt(p, this.oblique, displayName, (A4_W - capW) / 2, M - 8, 8, C_MUTED);
      this.footer(p);
    } catch {
      await this.addExceptionPage(displayName, 'Image could not be embedded (unsupported or corrupt file).');
    }
  }

  private async unsupportedPage(displayName: string, filename: string) {
    const p = this.output.addPage([A4_W, A4_H]);
    const ext = filename.split('.').pop()?.toUpperCase() ?? 'FILE';
    p.drawRectangle({ x: M, y: A4_H / 2 - 50, width: A4_W - M * 2, height: 90, color: C_PANELBG, borderColor: C_FAINT, borderWidth: 1 });
    dt(p, this.bold, ext + ' FILE', M + 16, A4_H / 2 + 26, 8, C_MUTED, { ls: 1.5 });
    dt(p, this.bold, displayName, M + 16, A4_H / 2 + 10, 13, C_INK);
    dt(p, this.regular, 'This file format cannot be rendered as PDF pages.', M + 16, A4_H / 2 - 12, 10, C_MID);
    dt(p, this.regular, 'Request the digital file package for the original document.', M + 16, A4_H / 2 - 28, 10, C_MUTED);
    this.footer(p);
  }

  // ── Premium title page for each document ─────────────────────────────────────

  private async titlePage(item: DBOAndMItem, doc: DBProjectDocument, displayName: string, typeTag: string) {
    const p = this.output.addPage([A4_W, A4_H]);
    this.topRule(p, C_FAINT);

    // Left sidebar accent
    p.drawRectangle({ x: M, y: M, width: 3, height: A4_H - M * 2 - 4, color: C_FAINT });

    // Category/section breadcrumb
    const catLabel = (doc.category || 'Project Document').toUpperCase();
    dt(p, this.regular, catLabel, M + 16, A4_H - M - 10, 7.5, C_MUTED, { ls: 2 });

    // Document type badge
    const tagW = this.bold.widthOfTextAtSize(typeTag, 8) + 14;
    p.drawRectangle({ x: A4_W - M - tagW, y: A4_H - M - 20, width: tagW, height: 20, color: C_PANELBG, borderColor: C_FAINT, borderWidth: 0.5 });
    dt(p, this.bold, typeTag, A4_W - M - tagW + 7, A4_H - M - 13, 8, C_MID, { ls: 0.8 });

    // Document title (large, prominent)
    const titleY = A4_H - M - 80;
    wrapText(p, this.bold, displayName, M + 16, titleY, A4_W - M * 2 - 32, 22, C_INK, 28);

    // Subtitle
    if (item.subtitle) {
      dt(p, this.regular, item.subtitle, M + 16, titleY - 50, 11, C_MID);
    }

    // Separator
    p.drawLine({ start: { x: M + 16, y: titleY - 70 }, end: { x: A4_W - M - 16, y: titleY - 70 }, thickness: 0.5, color: C_FAINT });

    // Metadata grid
    const metaY = titleY - 100;
    const metaFields: [string, string][] = [
      ['Category', doc.category || '—'],
      ['Format', doc.name.split('.').pop()?.toUpperCase() || '—'],
      ['Provided By', doc.uploaded_by || '—'],
      ['Date', fmtDateShort(doc.created_at)],
    ].filter(([, v]) => v && v !== '—') as [string, string][];

    const mColW = (A4_W - (M + 16) * 2) / 2;
    metaFields.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const mx = M + 16 + col * mColW;
      const my = metaY - row * 40;
      dt(p, this.bold, label.toUpperCase(), mx, my, 7, C_MUTED, { ls: 1 });
      dt(p, this.bold, value, mx, my - 14, 10, C_BODY);
      p.drawLine({ start: { x: mx, y: my - 26 }, end: { x: mx + mColW - 12, y: my - 26 }, thickness: 0.3, color: C_FAINT });
    });

    // Item notes (if any)
    if (item.notes) {
      const notesY = metaY - Math.ceil(metaFields.length / 2) * 40 - 24;
      p.drawRectangle({ x: M + 16, y: notesY - 32, width: A4_W - M * 2 - 32, height: 44, color: rgb(0.99, 0.996, 1), borderColor: rgb(0.81, 0.88, 0.94), borderWidth: 0.5 });
      dt(p, this.bold, 'NOTES', M + 26, notesY + 2, 7, C_MUTED, { ls: 1.2 });
      wrapText(p, this.oblique, item.notes, M + 26, notesY - 12, A4_W - M * 2 - 52, 9.5, C_MID, 14);
    }

    // Logo (bottom-right)
    if (this.logoImg) {
      const scale = Math.min(100 / this.logoImg.width, 28 / this.logoImg.height);
      const lw = this.logoImg.width * scale;
      const lh = this.logoImg.height * scale;
      p.drawImage(this.logoImg, { x: A4_W - M - lw, y: M + 20, width: lw, height: lh });
    }

    this.footer(p);
  }

  // ── TC Record — certificate quality ─────────────────────────────────────────

  async addTCRecord(item: DBOAndMItem, rec: DBTCRecord | undefined) {
    if (!rec) { await this.addExceptionPage(item.title, 'T&C Record not found.'); return; }

    const p = this.output.addPage([A4_W, A4_H]);

    // Top colour bar — sky blue for T&C
    p.drawRectangle({ x: 0, y: A4_H - 5, width: A4_W, height: 5, color: C_SKY });

    // Header area
    const headerY = A4_H - M;

    // Logo / org name
    if (this.logoImg) {
      const scale = Math.min(130 / this.logoImg.width, 34 / this.logoImg.height);
      p.drawImage(this.logoImg, { x: M, y: headerY - 34, width: this.logoImg.width * scale, height: this.logoImg.height * scale });
    } else {
      dt(p, this.bold, this.orgInfo.companyName, M, headerY - 14, 14, C_INK);
    }

    dt(p, this.regular, 'TESTING & COMMISSIONING RECORD', M, headerY - 44, 7.5, C_MUTED, { ls: 2 });

    // Document title — right side
    const titleRX = A4_W / 2 + 10;
    const titleW = A4_W - M - titleRX;
    wrapText(p, this.bold, rec.title, titleRX, headerY - 14, titleW, 14, C_INK, 18, 'right');
    dt(p, this.regular, `${rec.ref}${rec.date ? '  ·  ' + fmtDateShort(rec.date) : ''}`, titleRX, headerY - 38, 10, C_MUTED, { align: 'right', maxWidth: titleW });

    // Divider
    p.drawLine({ start: { x: M, y: A4_H - M - 56 }, end: { x: A4_W - M, y: A4_H - M - 56 }, thickness: 2, color: C_SKY });

    // Meta panel
    const metaTop = A4_H - M - 68;
    const metaH = 54;
    p.drawRectangle({ x: M, y: metaTop - metaH, width: A4_W - M * 2, height: metaH, color: C_PANELBG, borderColor: C_FAINT, borderWidth: 0.5 });

    const mFields: [string, string][] = [
      ['Reference', rec.ref],
      ['Category', rec.category],
      ['Area / Location', rec.area || '—'],
      ['Engineer', rec.engineer || '—'],
      ['Date', fmtDateShort(rec.date)],
      ['Status', rec.status || '—'],
    ];
    const mColW = (A4_W - M * 2) / 3;
    mFields.forEach(([label, val], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const mx = M + 10 + col * mColW;
      const my = metaTop - 14 - row * 26;
      dt(p, this.bold, label.toUpperCase(), mx, my, 6.5, C_MUTED, { ls: 0.7 });
      dt(p, this.bold, val, mx, my - 12, 9.5, C_INK);
    });

    // Result block
    let contentY = metaTop - metaH - 18;
    if (rec.result) {
      const isPass = /pass/i.test(rec.result);
      const isFail = /fail/i.test(rec.result);
      const bg = isPass ? rgb(0.941, 0.996, 0.957) : isFail ? rgb(0.996, 0.949, 0.949) : rgb(1, 0.988, 0.922);
      const border = isPass ? C_GREEN : isFail ? C_RED : C_AMBER;
      const textC = isPass ? C_GREEN : isFail ? C_RED : C_AMBER;
      p.drawRectangle({ x: M, y: contentY - 30, width: A4_W - M * 2, height: 46, color: bg, borderColor: border, borderWidth: 1.5 });
      dt(p, this.bold, 'TEST RESULT', M + 14, contentY - 6, 8, C_MUTED, { ls: 0.8 });
      const rw = this.bold.widthOfTextAtSize(rec.result.toUpperCase(), 16);
      dt(p, this.bold, rec.result.toUpperCase(), A4_W - M - rw - 14, contentY - 14, 16, textC);
      contentY -= 58;
    }

    // Notes
    if (rec.notes) {
      dt(p, this.bold, 'NOTES & OBSERVATIONS', M, contentY, 7, C_MUTED, { ls: 1.2 });
      p.drawLine({ start: { x: M, y: contentY - 8 }, end: { x: A4_W - M, y: contentY - 8 }, thickness: 0.5, color: C_FAINT });
      contentY -= 22;
      contentY = wrapText(p, this.regular, rec.notes, M + 4, contentY, A4_W - M * 2 - 8, 10, C_BODY, 15);
    }

    // Bottom certificate bar
    p.drawRectangle({ x: 0, y: M - 8, width: A4_W, height: 1, color: C_FAINT });
    this.footer(p);
  }

  // ── Site Form — full pdf-lib render ──────────────────────────────────────────

  async addSiteForm(item: DBOAndMItem, form: DBSiteForm | undefined) {
    if (!form) { await this.addExceptionPage(item.title, 'Site Form record not found.'); return; }

    const p = this.output.addPage([A4_W, A4_H]);
    const f = form.extra_data as Record<string, unknown>;

    // Top colour bar — orange for site forms
    p.drawRectangle({ x: 0, y: A4_H - 5, width: A4_W, height: 5, color: C_ORANGE });

    // Header: logo left, form title right
    const headerY = A4_H - M;
    if (this.logoImg) {
      const scale = Math.min(130 / this.logoImg.width, 34 / this.logoImg.height);
      p.drawImage(this.logoImg, { x: M, y: headerY - 34, width: this.logoImg.width * scale, height: this.logoImg.height * scale });
    } else {
      dt(p, this.bold, this.orgInfo.companyName, M, headerY - 14, 14, C_INK);
    }

    const typeTag = form.type.toUpperCase();
    dt(p, this.regular, typeTag, M, headerY - 44, 7.5, C_MUTED, { ls: 2 });

    const titleRX = A4_W / 2 + 10;
    const titleW = A4_W - M - titleRX;
    wrapText(p, this.bold, item.title || form.type, titleRX, headerY - 14, titleW, 14, C_INK, 18, 'right');
    const refLine = [form.project_name, fmtDateShort(form.date), form.completed_by].filter(Boolean).join('  ·  ');
    dt(p, this.regular, refLine, titleRX, headerY - 36, 9, C_MUTED, { align: 'right', maxWidth: titleW });

    // Divider
    p.drawLine({ start: { x: M, y: A4_H - M - 54 }, end: { x: A4_W - M, y: A4_H - M - 54 }, thickness: 2, color: C_ORANGE });

    // Top meta strip
    const metaTop = A4_H - M - 66;
    const stripH = 40;
    p.drawRectangle({ x: M, y: metaTop - stripH, width: A4_W - M * 2, height: stripH, color: C_PANELBG, borderColor: C_FAINT, borderWidth: 0.5 });
    const stripFields: [string, string][] = [
      ['Project', form.project_name || this.project.name],
      ['Date', fmtDateShort(form.date)],
      ['Completed By', form.completed_by || '—'],
      ['Status', form.status || '—'],
    ];
    const sColW = (A4_W - M * 2) / stripFields.length;
    stripFields.forEach(([label, val], i) => {
      const sx = M + 10 + i * sColW;
      const sy = metaTop - 14;
      dt(p, this.bold, label.toUpperCase(), sx, sy, 6.5, C_MUTED, { ls: 0.7 });
      dt(p, this.bold, val, sx, sy - 12, 9.5, C_INK);
    });

    // Form body — delegate to per-type renderer
    let bodyY = metaTop - stripH - 18;
    bodyY = this.renderFormBody(p, form.type, f, form.description, form.notes, bodyY);

    this.footer(p);
  }

  // Form body router — renders the right fields for each form type
  private renderFormBody(
    p: PDFPage,
    type: string,
    f: Record<string, unknown>,
    description: string,
    notes: string,
    startY: number,
  ): number {
    let y = startY;
    const safe = (v: unknown) => v ? String(v) : '';

    const drawSection = (label: string, fields: [string, string][]): number => {
      const visible = fields.filter(([, v]) => v);
      if (!visible.length) return y;
      dt(p, this.bold, label.toUpperCase(), M, y, 7, C_MUTED, { ls: 1.2 });
      p.drawLine({ start: { x: M, y: y - 8 }, end: { x: A4_W - M, y: y - 8 }, thickness: 0.5, color: C_FAINT });
      y -= 18;
      y = dataGrid(p, this.bold, this.regular, visible, M, y, A4_W - M * 2, 3);
      y -= 12;
      return y;
    };

    const drawNotes = (label: string, value: string | undefined): number => {
      if (!value) return y;
      dt(p, this.bold, label.toUpperCase(), M, y, 7, C_MUTED, { ls: 1.2 });
      p.drawLine({ start: { x: M, y: y - 8 }, end: { x: A4_W - M, y: y - 8 }, thickness: 0.5, color: C_FAINT });
      y -= 20;
      y = wrapText(p, this.regular, value, M + 4, y, A4_W - M * 2 - 8, 10, C_BODY, 14);
      y -= 12;
      return y;
    };

    const drawResult = (label: string, value: string | undefined): number => {
      if (!value) return y;
      const isPass = /pass/i.test(value);
      const isFail = /fail/i.test(value);
      const bg = isPass ? rgb(0.941, 0.996, 0.957) : isFail ? rgb(0.996, 0.949, 0.949) : rgb(1, 0.988, 0.922);
      const border = isPass ? C_GREEN : isFail ? C_RED : C_AMBER;
      const textC = isPass ? C_GREEN : isFail ? C_RED : C_AMBER;
      p.drawRectangle({ x: M, y: y - 30, width: A4_W - M * 2, height: 44, color: bg, borderColor: border, borderWidth: 1.5 });
      dt(p, this.bold, label.toUpperCase(), M + 12, y - 8, 8, C_MUTED, { ls: 0.8 });
      const vw = this.bold.widthOfTextAtSize(value.toUpperCase(), 14);
      dt(p, this.bold, value.toUpperCase(), A4_W - M - vw - 12, y - 16, 14, textC);
      y -= 52;
      return y;
    };

    // Per-type bodies
    if (type === 'Pressure Test') {
      y = drawSection('Pressure Test Details', [
        ['Plot / Area', safe(f.plotArea)], ['System / Service', safe(f.systemService)],
        ['Test Medium', safe(f.testMedium)], ['Test Pressure', f.testPressure ? `${safe(f.testPressure)} ${safe(f.testPressureUnit)}` : ''],
        ['Start Time', safe(f.startTime)], ['End Time', safe(f.endTime)],
        ['Duration', safe(f.durationOnTest)], ['Engineer', safe(f.engineer)],
        ['Company', safe(f.company)], ['Witnessed By', safe(f.witnessedBy)],
      ]);
      y = drawResult('Pressure Test Result', safe(f.testResult));
      y = drawNotes('Pipework Description', safe(f.pipeworkDescription));
      y = drawNotes('Observations', safe(f.observations));
    } else if (type === 'Flushing Record') {
      y = drawSection('Flushing Details', [
        ['Plot / Area', safe(f.plotArea)], ['System / Service', safe(f.systemService)],
        ['Flush Medium', safe(f.flushMedium)], ['Temperature', safe(f.flushTemperature)],
        ['Duration', safe(f.flushDuration)], ['Turbidity (NTU)', safe(f.turbidity)],
        ['Chlorine Residual', safe(f.chlorineResidual)],
        ['Engineer', safe(f.engineer)], ['Witnessed By', safe(f.flushWitnessedBy)],
      ]);
      y = drawResult('Flush Result', safe(f.flushResult));
      y = drawNotes('Observations', safe(f.observations));
    } else if (type === 'Valve Checklist') {
      y = drawSection('Valve Details', [
        ['Plot / Area', safe(f.plotArea)], ['Valve Tag', safe(f.valveTag)],
        ['Type', safe(f.valveType)], ['Size', safe(f.valveSize)],
        ['Location', safe(f.valveLocation)], ['Engineer', safe(f.engineer)],
        ['Witnessed By', safe(f.witnessedBy)],
      ]);
      y = drawSection('Inspection Results', [
        ['Operation Check', safe(f.operationCheck)], ['Seat Leakage', safe(f.seatLeakageCheck)],
        ['Gland Leakage', safe(f.glandLeakageCheck)], ['Position Indicator', safe(f.positionIndicator)],
        ['Actuator Check', safe(f.actuatorCheck)], ['Overall Condition', safe(f.overallCondition)],
      ]);
      y = drawNotes('Observations', safe(f.observations));
    } else if (type === 'AHU Commissioning') {
      y = drawSection('AHU Details', [
        ['AHU Tag', safe(f.ahuTag)], ['Location', safe(f.ahuLocation)],
        ['Supply Airflow', safe(f.supplyAirflow)], ['Return Airflow', safe(f.returnAirflow)],
        ['Supply Fan Amps', safe(f.supplyFanAmps)], ['Return Fan Amps', safe(f.returnFanAmps)],
        ['Filter Condition', safe(f.filterCondition)], ['Dampers Operation', safe(f.dampersOperation)],
        ['Coil Condition', safe(f.coilCondition)], ['Setpoint Temp', safe(f.setpointTemp)],
        ['Measured Temp', safe(f.measuredTemp)],
      ]);
      y = drawResult('AHU Commissioning Result', safe(f.ahuResult));
      y = drawNotes('Observations', safe(f.observations));
    } else if (type === 'Dead Testing') {
      y = drawSection('Dead Test Details', [
        ['Circuit Ref', safe(f.circuitRef)], ['Plot / Area', safe(f.plotArea)],
        ['Test Instrument', safe(f.testInstrument)], ['Engineer', safe(f.engineer)],
        ['Witnessed By', safe(f.deadTestWitness)],
      ]);
      y = drawSection('Test Measurements', [
        ['L1 Insulation Resistance (MΩ)', safe(f.insulationPhaseL1)],
        ['L2 Insulation Resistance (MΩ)', safe(f.insulationPhaseL2)],
        ['L3 Insulation Resistance (MΩ)', safe(f.insulationPhaseL3)],
        ['Neutral Insulation Resistance (MΩ)', safe(f.insulationNeutral)],
        ['Continuity Ring (Ω)', safe(f.continuityRing)],
        ['Earth Fault Loop (Ω)', safe(f.earthFault)],
        ['Polarity', safe(f.polarity)],
      ]);
      y = drawResult('Dead Test Result', safe(f.deadTestResult));
      y = drawNotes('Observations', safe(f.observations));
    } else if (type === 'Continuity Test') {
      y = drawSection('Continuity Test Details', [
        ['Conductor Ref', safe(f.conductorRef)], ['Circuit Ref', safe(f.circuitRef)],
        ['Conductor Type', safe(f.conductorType)], ['Length (m)', safe(f.conductorLength)],
        ['Test Instrument', safe(f.testInstrument)], ['Engineer', safe(f.engineer)],
        ['Witnessed By', safe(f.continuityWitness)],
      ]);
      y = drawSection('Resistance Measurements', [
        ['Measured Resistance (Ω)', safe(f.measuredResistance)],
        ['Calculated Resistance (Ω)', safe(f.calculatedResistance)],
        ['Deviation (%)', safe(f.deviationPercent)],
      ]);
      y = drawResult('Continuity Test Result', safe(f.continuityResult));
    } else if (type === 'Electrical Commissioning Report') {
      y = drawSection('Commissioning Report Details', [
        ['Shift', safe(f.ecrShift)], ['Lead Engineer', safe(f.ecrLeadEngineer)],
        ['Company', safe(f.ecrCompany)], ['System Being Commissioned', safe(f.ecrSystemBeingCommissioned)],
        ['Overall Status', safe(f.ecrOverallStatus)], ['Site Area', safe(f.ecrSiteArea)],
        ['% Progress', safe(f.ecrPercentProgress)],
      ]);
      y = drawNotes('Areas Completed', safe(f.ecrAreasCompleted));
      y = drawNotes('Areas In Progress', safe(f.ecrAreasInProgress));
      y = drawNotes('Actual Works Completed', safe(f.ecrActualWorks));
      y = drawNotes('Key Blockers', safe(f.ecrKeyBlockers));
      y = drawNotes('Overall Comments', safe(f.ecrOverallComments));
    } else if (type === 'Daily Site Report') {
      y = drawSection('Site Report Details', [
        ['Site Manager', safe(f.dsrSiteManager)], ['Weather', safe(f.dsrWeather)],
        ['Temperature', safe(f.dsrTemperature)], ['Site Conditions', safe(f.dsrSiteConditions)],
        ['Operatives on Site', safe(f.dsrOperativesOnSite)],
        ['Start Time', safe(f.dsrStartTime)], ['Finish Time', safe(f.dsrFinishTime)],
        ['Total Hours', safe(f.dsrTotalHours)],
      ]);
      y = drawNotes('Works Completed', safe(f.dsrWorksCompleted));
      y = drawNotes('Issues Encountered', safe(f.dsrIssuesEncountered));
      y = drawNotes('Overall Comments', safe(f.dsrOverallComments));
    } else if (type === 'QA Inspection') {
      y = drawSection('Inspection Details', [
        ['Inspector', safe(f.qaInspector)], ['Contractor', safe(f.qaContractor)],
        ['Area Inspected', safe(f.qaAreaInspected)], ['System / Service', safe(f.qaSystemService)],
        ['Drawing Ref', safe(f.qaDrawingRef)], ['Witnessed By', safe(f.qaWitnessedBy)],
      ]);
      y = drawResult('Inspection Result', safe(f.qaResult));
      y = drawNotes('Observations', safe(f.qaObservations));
      y = drawNotes('Actions Required', safe(f.qaActionsRequired));
    } else if (type === 'H&S Inspection') {
      y = drawSection('Inspection Details', [
        ['Inspector', safe(f.hsInspector)], ['Contractor', safe(f.hsContractor)],
        ['Area Inspected', safe(f.hsAreaInspected)],
      ]);
      y = drawNotes('Observations', safe(f.hsObservations));
      y = drawNotes('Actions Required', safe(f.hsActionsRequired));
    } else if (type === 'Toolbox Talk') {
      y = drawSection('Toolbox Talk Details', [
        ['Topic', safe(f.tbtTopic)], ['Duration', safe(f.tbtDuration)],
        ['Location', safe(f.tbtLocation)], ['Presented By', safe(f.tbtPresentedBy)],
        ['Company', safe(f.company)],
      ]);
      y = drawNotes('Key Points Covered', safe(f.tbtKeyPoints));
      y = drawNotes('Attendees', safe(f.tbtAttendees));
      y = drawNotes('Action Items', safe(f.tbtActionItems));
    } else if (type === 'Temperature Water Readings') {
      y = drawSection('Water Temperature Details', [
        ['System', safe(f.twrSystem)], ['Location', safe(f.twrLocation)],
        ['Flow Temperature (°C)', safe(f.twrFlowTemp)], ['Return Temperature (°C)', safe(f.twrReturnTemp)],
        ['Cold Water Temp (°C)', safe(f.twrColdTemp)], ['Hot Water Temp (°C)', safe(f.twrHotTemp)],
        ['Engineer', safe(f.engineer)], ['Witnessed By', safe(f.witnessedBy)],
      ]);
      y = drawResult('Overall Result', safe(f.twrResult));
      y = drawNotes('Observations', safe(f.twrObservations));
    } else if (type === 'Plantroom Commissioning Record') {
      y = drawSection('Plantroom Details', [
        ['Plant Room ID', safe(f.plantRoomId)], ['Location', safe(f.plantRoomLocation)],
        ['Lead Engineer', safe(f.plantLeadEngineer)], ['Company', safe(f.plantCompany)],
        ['Commissioning Date', fmtDateShort(safe(f.plantCommissioningDate))],
        ['Witnessed By', safe(f.plantWitnessedBy)],
      ]);
      y = drawNotes('Systems Commissioned', safe(f.plantSystemsCommissioned));
      y = drawNotes('Outstanding Items', safe(f.plantOutstandingItems));
      y = drawNotes('Overall Comments', safe(f.plantOverallComments));
    } else {
      // Generic fallback — render description + all non-empty extra_data fields
      if (description) {
        y = drawNotes('Description', description);
      }
      const pairs: [string, string][] = Object.entries(f)
        .filter(([, v]) => v && typeof v === 'string' && (v as string).length < 120)
        .slice(0, 18)
        .map(([k, v]) => [k.replace(/_/g, ' '), String(v)]);
      if (pairs.length) {
        y = drawSection('Form Data', pairs);
      }
    }

    // Always include general notes/description if present and not already rendered
    if (notes && !['Pressure Test', 'Flushing Record', 'Valve Checklist', 'AHU Commissioning',
      'Dead Testing', 'Continuity Test', 'Electrical Commissioning Report', 'Daily Site Report',
      'QA Inspection', 'H&S Inspection', 'Toolbox Talk', 'Temperature Water Readings',
      'Plantroom Commissioning Record'].includes(type)) {
      y = drawNotes('Notes', notes);
    }

    return y;
  }

  // ── Exception page ────────────────────────────────────────────────────────────

  async addExceptionPage(title: string, reason: string) {
    const p = this.output.addPage([A4_W, A4_H]);
    p.drawRectangle({ x: M, y: A4_H / 2 - 52, width: A4_W - M * 2, height: 104, color: rgb(1, 0.992, 0.957), borderColor: rgb(0.988, 0.831, 0.302), borderWidth: 1.5 });
    dt(p, this.bold, 'DOCUMENT EXCEPTION', M + 18, A4_H / 2 + 38, 8, C_AMBER, { ls: 1.2 });
    wrapText(p, this.bold, title, M + 18, A4_H / 2 + 22, A4_W - M * 2 - 36, 13, C_INK, 16);
    wrapText(p, this.regular, reason, M + 18, A4_H / 2 - 6, A4_W - M * 2 - 36, 10, C_MID, 14);
    this.footer(p);
  }

  // ── Shared page chrome ────────────────────────────────────────────────────────

  private topRule(p: PDFPage, color: ReturnType<typeof rgb>) {
    p.drawRectangle({ x: 0, y: A4_H - 4, width: A4_W, height: 4, color });
  }

  private footer(p: PDFPage) {
    p.drawLine({ start: { x: M, y: M - 4 }, end: { x: A4_W - M, y: M - 4 }, thickness: 0.4, color: C_FAINT });
    const left = `${this.project.name}  ·  ${this.manual.title}`;
    const right = 'VYSITE® · © VYSITE Ltd.';
    dt(p, this.regular, left, M, M - 16, 7, C_MUTED);
    const rw = this.regular.widthOfTextAtSize(right, 7);
    dt(p, this.regular, right, A4_W - M - rw, M - 16, 7, C_FAINT);
  }
}

// ─── WinAnsi sanitizer ────────────────────────────────────────────────────────
// pdf-lib standard fonts use WinAnsi encoding. Any char outside that set throws.
// Rules: strip control chars, replace known Unicode symbols, transliterate
// Latin Extended (≥ U+0100) to ASCII where possible, drop the rest.

const WIN_ANSI_REPLACEMENTS: [RegExp, string][] = [
  // Greek Omega (resistance symbol) — most critical for electrical docs
  [/Ω/g, 'Ohm'],
  [/MΩ/g, 'MOhm'],
  // Degree + micro are actually in WinAnsi (0xB0, 0xB5) — no replacement needed
  // Control characters: strip them (tabs/newlines are handled by wrapText)
  [/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''],
  // Newlines and carriage returns: collapse to space in single-line context
  // (wrapText splits on spaces so pre-normalised input is fine)
  // C1 range (0x80-0x9F): these are not remapped by pdf-lib's WinAnsiEncoding
  // Replace with their closest Windows-1252 visual equivalents
  [/\u0080/g, '€'], // euro sign ← already in WinAnsi via 0x80 in Win-1252, but use literal
  [/\u0085/g, '...'],
  [/\u0091/g, "'"], [/\u0092/g, "'"],
  [/\u0093/g, '"'], [/\u0094/g, '"'],
  [/\u0095/g, '-'],   // bullet (C1 range)
  [/\u0096/g, '-'],   // en dash (C1 range)
  [/\u0097/g, '--'],  // em dash (C1 range)
  [/\u0099/g, '(TM)'],
  // Latin Extended-A/B and beyond: transliterate common ones
  [/[ÀÁÂÃÄÅ]/g, 'A'], [/[àáâãäå]/g, 'a'],
  [/[ÈÉÊË]/g, 'E'],   [/[èéêë]/g, 'e'],
  [/[ÌÍÎÏ]/g, 'I'],   [/[ìíîï]/g, 'i'],
  [/[ÒÓÔÕÖ]/g, 'O'],  [/[òóôõö]/g, 'o'],
  [/[ÙÚÛÜ]/g, 'U'],   [/[ùúûü]/g, 'u'],
  [/[ÝŸ]/g, 'Y'],     [/[ýÿ]/g, 'y'],
  [/[ÑñNn]/g, 'N'],
  [/Ç/g, 'C'],        [/ç/g, 'c'],
  [/Æ/g, 'AE'],       [/æ/g, 'ae'],
  [/Œ/g, 'OE'],       [/œ/g, 'oe'],
  [/ß/g, 'ss'],
  [/[ŁłĐđ]/g, '-'],
  // Greek letters (common in engineering docs)
  [/α/g, 'alpha'], [/β/g, 'beta'], [/γ/g, 'gamma'], [/δ/g, 'delta'],
  [/μ/g, 'u'],     [/π/g, 'pi'],   [/σ/g, 'sigma'], [/φ/g, 'phi'],
  [/Δ/g, 'Delta'], [/Σ/g, 'Sigma'], [/Π/g, 'Pi'],
  // Any remaining char outside WinAnsi (codepoint ≥ 0x100 after above): drop
];

function san(text: string): string {
  if (!text) return '';
  let out = text;
  for (const [re, replacement] of WIN_ANSI_REPLACEMENTS) {
    out = out.replace(re, replacement);
  }
  // Final pass: drop any remaining non-WinAnsi character (codepoint > 0xFF)
  // to prevent unexpected crashes on arbitrary user input
  // eslint-disable-next-line no-control-regex
  return out.replace(/[^\x20-\xFF]/g, '');
}

// ─── PDF-lib drawing primitives ───────────────────────────────────────────────

type TextOpts = { ls?: number; align?: 'left' | 'right' | 'center'; maxWidth?: number };

function dt(
  p: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>,
  opts: TextOpts = {},
) {
  const s = san(text);
  if (!s) return;
  let tx = x;
  if (opts.align === 'right' && opts.maxWidth) tx = x + opts.maxWidth - font.widthOfTextAtSize(s, size);
  else if (opts.align === 'center' && opts.maxWidth) tx = x + (opts.maxWidth - font.widthOfTextAtSize(s, size)) / 2;
  p.drawText(s, { x: tx, y, size, font, color, characterSpacing: opts.ls ?? 0 });
}

function wrapText(
  p: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color: ReturnType<typeof rgb>,
  lineH: number,
  align?: 'left' | 'right' | 'center',
): number {
  if (!text) return y;
  // Normalise newlines to spaces so they wrap instead of crashing
  const words = san(text).replace(/[\r\n]+/g, ' ').split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  let cy = y;
  for (const line of lines) {
    let lx = x;
    if (align === 'right') lx = x + maxWidth - font.widthOfTextAtSize(line, size);
    else if (align === 'center') lx = x + (maxWidth - font.widthOfTextAtSize(line, size)) / 2;
    p.drawText(line, { x: lx, y: cy, size, font, color });
    cy -= lineH;
  }
  return cy;
}

// Draws a data grid — N columns, each cell: label on top, value below
function dataGrid(
  p: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  pairs: [string, string][],
  x: number,
  startY: number,
  totalW: number,
  cols: number,
): number {
  const visible = pairs.filter(([, v]) => v);
  if (!visible.length) return startY;
  const colW = totalW / cols;
  let y = startY;
  for (let i = 0; i < visible.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (col === 0 && row > 0) y -= 32;
    const cx = x + col * colW;
    const cy = y;
    // Cell background (alternating rows)
    if (row % 2 === 0) {
      p.drawRectangle({ x: cx, y: cy - 26, width: colW - 4, height: 34, color: C_PANELBG, borderColor: C_FAINT, borderWidth: 0.3 });
    } else {
      p.drawRectangle({ x: cx, y: cy - 26, width: colW - 4, height: 34, borderColor: C_FAINT, borderWidth: 0.3 });
    }
    dt(p, bold, visible[i][0].toUpperCase(), cx + 6, cy - 4, 6.5, C_MUTED, { ls: 0.6 });
    dt(p, bold, visible[i][1], cx + 6, cy - 16, 9.5, C_INK);
  }
  const rowCount = Math.ceil(visible.length / cols);
  return y - (rowCount - 1) * 32 - 32;
}

// ─── Image embedding ──────────────────────────────────────────────────────────

async function embedImage(doc: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  const mimeMatch = dataUrl.match(/^data:([^;]+);/);
  const mime = mimeMatch?.[1] ?? '';
  const bytes = dataUrlToBytes(dataUrl);
  if (mime === 'image/jpeg' || mime === 'image/jpg') return doc.embedJpg(bytes);
  if (mime === 'image/png') return doc.embedPng(bytes);
  try { return await doc.embedJpg(bytes); } catch { return null; }
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function mimeCategory(mimeType: string): 'pdf' | 'image' | 'office' | 'other' {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (/word|excel|spreadsheet|presentation|powerpoint|openxmlformats/i.test(mimeType)) return 'office';
  return 'other';
}

function fmtDate(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateShort(iso?: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
