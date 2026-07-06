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
import { formToPdfBytes } from './FormHtmlRenderer';

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

        const badge = item.source_module === 'tc_record' ? 'T&C'
          : item.source_module === 'site_form' ? 'FORM' : 'DOC';
        const bw = this.bold.widthOfTextAtSize(badge, 7) + 12;
        // Title area must leave room for the badge on the right
        const titleMaxW = A4_W - M - (M + 26) - bw - 10;

        // Measure how many lines the title wraps to
        const titleWords = san(item.title ?? '').replace(/[\r\n]+/g, ' ').split(' ').filter(Boolean);
        const titleLines: string[] = [];
        let cur = '';
        for (const w of titleWords) {
          const test = cur ? `${cur} ${w}` : w;
          if (this.bold.widthOfTextAtSize(test, 10) > titleMaxW && cur) { titleLines.push(cur); cur = w; }
          else cur = test;
        }
        if (cur) titleLines.push(cur);
        const titleLineH = 13;
        const titleBlockH = titleLines.length * titleLineH;

        dt(p, this.bold, String(i + 1).padStart(2, '0'), M, ly, 8, C_FAINT);

        // Draw each title line
        titleLines.forEach((line, li) => {
          p.drawText(line, { x: M + 26, y: ly - li * titleLineH, size: 10, font: this.bold, color: C_BODY });
        });

        // Badge aligned to first title line
        p.drawRectangle({ x: A4_W - M - bw, y: ly - 10, width: bw, height: 14, color: C_PANELBG, borderColor: C_FAINT, borderWidth: 0.5 });
        dt(p, this.bold, badge, A4_W - M - bw + 6, ly, 7, C_MUTED);

        const subtitleOffset = titleBlockH;
        if (item.subtitle) {
          dt(p, this.regular, item.subtitle, M + 26, ly - subtitleOffset, 8, C_MUTED);
        }

        const rowH = titleBlockH + (item.subtitle ? 14 : 0) + 8;
        ly -= rowH;
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

    const firstPage = this.output.addPage([A4_W, A4_H]);

    // Top colour bar — sky blue for T&C
    firstPage.drawRectangle({ x: 0, y: A4_H - 5, width: A4_W, height: 5, color: C_SKY });

    const headerY = A4_H - M;

    if (this.logoImg) {
      const scale = Math.min(130 / this.logoImg.width, 34 / this.logoImg.height);
      firstPage.drawImage(this.logoImg, { x: M, y: headerY - 34, width: this.logoImg.width * scale, height: this.logoImg.height * scale });
    } else {
      dt(firstPage, this.bold, this.orgInfo.companyName, M, headerY - 14, 14, C_INK);
    }

    dt(firstPage, this.regular, 'TESTING & COMMISSIONING RECORD', M, headerY - 44, 7.5, C_MUTED, { ls: 2 });

    const titleRX = A4_W / 2 + 10;
    const titleW = A4_W - M - titleRX;
    wrapText(firstPage, this.bold, rec.title, titleRX, headerY - 14, titleW, 14, C_INK, 18, 'right');
    dt(firstPage, this.regular, `${rec.ref}${rec.date ? '  ·  ' + fmtDateShort(rec.date) : ''}`, titleRX, headerY - 38, 10, C_MUTED, { align: 'right', maxWidth: titleW });

    firstPage.drawLine({ start: { x: M, y: A4_H - M - 56 }, end: { x: A4_W - M, y: A4_H - M - 56 }, thickness: 2, color: C_SKY });

    // Meta panel
    const metaTop = A4_H - M - 68;
    const metaH = 54;
    firstPage.drawRectangle({ x: M, y: metaTop - metaH, width: A4_W - M * 2, height: metaH, color: C_PANELBG, borderColor: C_FAINT, borderWidth: 0.5 });

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
      dt(firstPage, this.bold, label.toUpperCase(), mx, my, 6.5, C_MUTED, { ls: 0.7 });
      dt(firstPage, this.bold, val, mx, my - 12, 9.5, C_INK);
    });

    // Set up pager for overflowing content
    const pager: Pager = { page: firstPage, y: metaTop - metaH - 18 };
    const continuationTitle = rec.title;

    // Result block
    if (rec.result) {
      overflow(pager, this, 54, C_SKY, continuationTitle);
      const isPass = /pass/i.test(rec.result);
      const isFail = /fail/i.test(rec.result);
      const bg = isPass ? rgb(0.941, 0.996, 0.957) : isFail ? rgb(0.996, 0.949, 0.949) : rgb(1, 0.988, 0.922);
      const border = isPass ? C_GREEN : isFail ? C_RED : C_AMBER;
      const textC = isPass ? C_GREEN : isFail ? C_RED : C_AMBER;
      pager.page.drawRectangle({ x: M, y: pager.y - 30, width: A4_W - M * 2, height: 46, color: bg, borderColor: border, borderWidth: 1.5 });
      dt(pager.page, this.bold, 'TEST RESULT', M + 14, pager.y - 6, 8, C_MUTED, { ls: 0.8 });
      const rw = this.bold.widthOfTextAtSize(rec.result.toUpperCase(), 16);
      dt(pager.page, this.bold, rec.result.toUpperCase(), A4_W - M - rw - 14, pager.y - 14, 16, textC);
      pager.y -= 58;
    }

    // Notes
    if (rec.notes) {
      overflow(pager, this, 48, C_SKY, continuationTitle);
      dt(pager.page, this.bold, 'NOTES & OBSERVATIONS', M, pager.y, 7, C_MUTED, { ls: 1.2 });
      pager.page.drawLine({ start: { x: M, y: pager.y - 8 }, end: { x: A4_W - M, y: pager.y - 8 }, thickness: 0.5, color: C_FAINT });
      pager.y -= 22;
      wrapTextPaged(pager, this, rec.notes, M + 4, A4_W - M * 2 - 8, 10, C_BODY, 15, C_SKY, continuationTitle);
    }

    this.footer(pager.page);
  }

  // ── Site Form — html2canvas render (identical to standalone export) ──────────

  async addSiteForm(item: DBOAndMItem, form: DBSiteForm | undefined) {
    if (!form) { await this.addExceptionPage(item.title, 'Site Form record not found.'); return; }

    try {
      const pdfBytes = await formToPdfBytes(form, this.orgInfo);
      const src = await PDFDocument.load(pdfBytes);
      const count = src.getPageCount();
      if (count > 0) {
        const indices = Array.from({ length: count }, (_, i) => i);
        const copied = await this.output.copyPages(src, indices);
        copied.forEach(pg => this.output.addPage(pg));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.addExceptionPage(item.title, `Form could not be rendered: ${msg.slice(0, 120)}`);
    }
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
  [/[Ññ]/g, 'N'],
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

// Pager: mutable cursor that creates new pages when content would overflow.
interface Pager {
  page: PDFPage;
  y: number;
}

// Ensures pager has at least `need` vertical points remaining.
// If not, appends a new continuation page and resets y.
// Returns a (possibly new) page reference — callers must use pager.page after this call.
function overflow(
  pager: Pager,
  ctx: BuildContext,
  need: number,
  accentColor: ReturnType<typeof rgb>,
  continuationTitle: string,
): void {
  if (pager.y - need >= M + 30) return;
  ctx.footer(pager.page);
  const np = ctx.output.addPage([A4_W, A4_H]);
  np.drawRectangle({ x: 0, y: A4_H - 3, width: A4_W, height: 3, color: accentColor });
  dt(np, ctx.regular, san(continuationTitle) + ' — continued', M, A4_H - M - 10, 8, C_MUTED);
  np.drawLine({ start: { x: M, y: A4_H - M - 18 }, end: { x: A4_W - M, y: A4_H - M - 18 }, thickness: 0.3, color: C_FAINT });
  ctx.footer(np);
  pager.page = np;
  pager.y = A4_H - M - 32;
}

// Wraps text across pages using a Pager; returns final y.
function wrapTextPaged(
  pager: Pager,
  ctx: BuildContext,
  text: string,
  x: number,
  maxWidth: number,
  size: number,
  color: ReturnType<typeof rgb>,
  lineH: number,
  accentColor: ReturnType<typeof rgb>,
  continuationTitle: string,
): void {
  if (!text) return;
  const sanitized = san(text).replace(/[\r\n]+/g, ' ');
  const words = sanitized.split(' ').filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.regular.widthOfTextAtSize(test, size) > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  for (const line of lines) {
    overflow(pager, ctx, lineH + 4, accentColor, continuationTitle);
    pager.page.drawText(san(line), { x, y: pager.y, size, font: ctx.regular, color });
    pager.y -= lineH;
  }
}

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
