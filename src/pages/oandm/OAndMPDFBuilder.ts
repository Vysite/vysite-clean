import {
  PDFDocument,
  PDFPage,
  StandardFonts,
  rgb,
  type PDFFont,
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

  // ── Cover ──
  await ctx.addCoverPage();
  onProgress?.({ stage: 'Building cover and contents', current: 1, total: totalItems + 3 });

  // ── Contents ──
  await ctx.addContentsPage(sortedSections, items);
  onProgress?.({ stage: 'Building sections', current: 2, total: totalItems + 3 });

  // ── Sections ──
  for (let si = 0; si < sortedSections.length; si++) {
    const section = sortedSections[si];
    const sectionItems = items
      .filter(i => i.section_id === section.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    await ctx.addSectionDivider(section, si, sectionItems);

    for (const item of sectionItems) {
      itemsDone++;
      onProgress?.({
        stage: `${section.title}: ${item.title}`,
        current: 2 + itemsDone,
        total: totalItems + 3,
      });

      if (item.source_module === 'project_document') {
        const doc = projectDocuments.find(d => d.id === item.source_record_id);
        await ctx.addProjectDocument(item, doc);
      } else if (item.source_module === 'tc_record') {
        const rec = tcRecords.find(r => r.id === item.source_record_id);
        await ctx.addTCRecord(item, rec);
      } else if (item.source_module === 'site_form') {
        const form = siteForms.find(f => f.id === item.source_record_id);
        await ctx.addSiteFormReference(item, form);
      }
    }
  }

  onProgress?.({ stage: 'Finalising PDF', current: totalItems + 3, total: totalItems + 3 });
  return ctx.output.save();
}

// ─── Build context ────────────────────────────────────────────────────────────

// A4 at 72 points-per-inch
const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 56;

// Colours as 0-1 rgb values
const C_INK    = rgb(0.055, 0.086, 0.161);  // #0f172a
const C_BODY   = rgb(0.118, 0.176, 0.298);  // #1e293b
const C_MID    = rgb(0.271, 0.329, 0.427);  // #475569
const C_MUTED  = rgb(0.580, 0.635, 0.725);  // #94a3b8
const C_FAINT  = rgb(0.882, 0.906, 0.929);  // #e2e8f0
const C_WHITE  = rgb(1, 1, 1);
const C_ORANGE = rgb(0.976, 0.451, 0.086);  // #f97316
const C_GREEN  = rgb(0.063, 0.733, 0.506);  // #10b981 — pass
const C_RED    = rgb(0.863, 0.149, 0.149);  // #dc2626 — fail
const C_AMBER  = rgb(0.855, 0.604, 0.075);  // #d97706 — other

class BuildContext {
  output: PDFDocument = null!;
  bold: PDFFont = null!;
  regular: PDFFont = null!;
  oblique: PDFFont = null!;

  constructor(
    private manual: DBOAndMManual,
    private project: Project,
    private orgInfo: OrgInfo,
    private onProgress?: (p: BuildProgress) => void,
  ) {}

  async init() {
    this.output = await PDFDocument.create();
    this.regular = await this.output.embedFont(StandardFonts.Helvetica);
    this.bold = await this.output.embedFont(StandardFonts.HelveticaBold);
    this.oblique = await this.output.embedFont(StandardFonts.HelveticaOblique);
  }

  // ── Cover page ──────────────────────────────────────────────────────────────

  async addCoverPage() {
    const page = this.output.addPage([A4_W, A4_H]);
    const { manual, project, orgInfo } = this;

    // Top gradient bar (simulated with two rectangles)
    page.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: C_INK });

    // Large left accent strip
    page.drawRectangle({ x: MARGIN - 12, y: 220, width: 5, height: 360, color: C_INK });

    // Logo or org name
    let logoH = 0;
    if (orgInfo.logoDataUrl) {
      try {
        const logoImg = await this.embedImage(this.output, orgInfo.logoDataUrl);
        if (logoImg) {
          const scale = Math.min(160 / logoImg.width, 44 / logoImg.height);
          const lw = logoImg.width * scale;
          const lh = logoImg.height * scale;
          page.drawImage(logoImg, { x: MARGIN, y: A4_H - MARGIN - lh, width: lw, height: lh });
          logoH = lh;
        }
      } catch { /* fall through to text */ }
    }
    if (logoH === 0) {
      drawText(page, this.bold, orgInfo.companyName || 'Organisation', MARGIN, A4_H - MARGIN - 14, 18, C_INK);
      logoH = 18;
    }

    // Status badge (top right)
    const statusText = manual.status === 'finalised' ? 'FINALISED'
      : manual.status === 'in_progress' ? 'IN PROGRESS' : 'DRAFT';
    const badgeW = this.bold.widthOfTextAtSize(statusText, 8) + 20;
    page.drawRectangle({ x: A4_W - MARGIN - badgeW, y: A4_H - MARGIN - 20, width: badgeW, height: 20, borderColor: C_FAINT, borderWidth: 1 });
    drawText(page, this.bold, statusText, A4_W - MARGIN - badgeW + 10, A4_H - MARGIN - 14, 8, C_MUTED);

    // Manual title
    const titleY = 440;
    drawText(page, this.regular, 'Operation & Maintenance Manual', MARGIN, titleY + 48, 8, C_MUTED, { letterSpacing: 2 });
    drawWrappedText(page, this.bold, manual.title, MARGIN, titleY, A4_W - MARGIN * 2 - 20, 32, C_INK, 38);
    if (manual.version) {
      drawText(page, this.regular, manual.version, MARGIN, titleY - 22, 12, C_MID);
    }

    // Project details grid
    const gridY = 210;
    const gridData: [string, string][] = [
      ['Project', project.name],
      ['Client', project.client || '—'],
      ['Location', project.location || '—'],
      ['Project Manager', project.projectManager || '—'],
      ['Contractor', orgInfo.companyName || '—'],
      ['Date', fmtDate(manual.updated_at || manual.created_at)],
    ];
    const colW = (A4_W - MARGIN * 2) / 2;
    gridData.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const gx = MARGIN + col * colW;
      const gy = gridY - row * 52;
      drawText(page, this.bold, label.toUpperCase(), gx, gy + 18, 7, C_MUTED, { letterSpacing: 1.5 });
      drawText(page, this.bold, value, gx, gy, 12, C_BODY);
      page.drawLine({ start: { x: gx, y: gy - 10 }, end: { x: gx + colW - 20, y: gy - 10 }, thickness: 0.5, color: C_FAINT });
    });

    // Footer
    this.addPageFooter(page, manual.title, project.name);
  }

  // ── Contents page ───────────────────────────────────────────────────────────

  async addContentsPage(sections: DBOAndMSection[], items: DBOAndMItem[]) {
    const page = this.output.addPage([A4_W, A4_H]);

    drawText(page, this.regular, 'Table of', MARGIN, A4_H - MARGIN - 12, 8, C_MUTED, { letterSpacing: 2 });
    drawText(page, this.bold, 'Contents', MARGIN, A4_H - MARGIN - 46, 26, C_INK);
    page.drawRectangle({ x: MARGIN, y: A4_H - MARGIN - 56, width: 40, height: 3, color: C_INK });

    let y = A4_H - MARGIN - 90;
    sections.forEach((section, idx) => {
      const count = items.filter(i => i.section_id === section.id).length;
      const numStr = String(idx + 1).padStart(2, '0');
      drawText(page, this.bold, numStr, MARGIN, y, 9, C_FAINT);
      drawText(page, this.bold, section.title, MARGIN + 28, y, 12, C_BODY);
      if (section.description) {
        drawText(page, this.regular, section.description, MARGIN + 28, y - 14, 9, C_MUTED);
      }
      const countStr = `${count} document${count !== 1 ? 's' : ''}`;
      const cw = this.regular.widthOfTextAtSize(countStr, 9);
      drawText(page, this.regular, countStr, A4_W - MARGIN - cw, y, 9, C_MID);
      page.drawLine({
        start: { x: MARGIN + 28, y: y - (section.description ? 24 : 12) },
        end: { x: A4_W - MARGIN, y: y - (section.description ? 24 : 12) },
        thickness: 0.5,
        color: C_FAINT,
      });
      y -= section.description ? 46 : 32;
      if (y < MARGIN + 40) return; // overflow guard
    });

    this.addPageFooter(page, this.manual.title, this.project.name);
  }

  // ── Section divider ─────────────────────────────────────────────────────────

  async addSectionDivider(section: DBOAndMSection, index: number, sectionItems: DBOAndMItem[]) {
    const page = this.output.addPage([A4_W, A4_H]);

    // Large decorative section number (faint, background)
    const numStr = String(index + 1).padStart(2, '0');
    page.drawText(numStr, {
      x: A4_W - MARGIN - 120,
      y: A4_H / 2 - 40,
      size: 160,
      font: this.bold,
      color: rgb(0.96, 0.96, 0.97),
    });

    // Section label
    drawText(page, this.regular, `Section ${index + 1}`, MARGIN, A4_H - MARGIN - 12, 8, C_MUTED, { letterSpacing: 2 });

    // Section title
    drawWrappedText(page, this.bold, section.title, MARGIN, A4_H - MARGIN - 80, A4_W - MARGIN * 2, 28, C_INK, 32);

    // Accent rule
    page.drawRectangle({ x: MARGIN, y: A4_H - MARGIN - 92, width: 40, height: 3, color: C_INK });

    // Description
    if (section.description) {
      drawWrappedText(page, this.regular, section.description, MARGIN, A4_H - MARGIN - 130, A4_W - MARGIN * 2 - 60, 11, C_MID, 16);
    }

    // Document list
    if (sectionItems.length > 0) {
      let ly = A4_H - MARGIN - 200;
      drawText(page, this.bold, 'DOCUMENTS IN THIS SECTION', MARGIN, ly + 16, 7, C_MUTED, { letterSpacing: 1.5 });
      page.drawLine({ start: { x: MARGIN, y: ly + 2 }, end: { x: A4_W - MARGIN, y: ly + 2 }, thickness: 0.5, color: C_FAINT });
      sectionItems.forEach((item, i) => {
        if (ly < MARGIN + 60) return;
        const iStr = String(i + 1).padStart(2, '0');
        drawText(page, this.regular, iStr, MARGIN, ly - 16, 8, C_FAINT);
        drawText(page, this.bold, item.title, MARGIN + 24, ly - 16, 10, C_MID);
        const badge = item.source_module === 'tc_record' ? 'T&C' : item.source_module === 'site_form' ? 'FORM' : 'DOC';
        const bw = this.bold.widthOfTextAtSize(badge, 7) + 10;
        page.drawRectangle({ x: A4_W - MARGIN - bw, y: ly - 24, width: bw, height: 14, color: rgb(0.95, 0.97, 0.99) });
        drawText(page, this.bold, badge, A4_W - MARGIN - bw + 5, ly - 16, 7, C_MUTED);
        ly -= 24;
      });
    }

    this.addPageFooter(page, this.manual.title, this.project.name);
  }

  // ── Project document ────────────────────────────────────────────────────────

  async addProjectDocument(item: DBOAndMItem, doc: DBProjectDocument | undefined) {
    if (!doc) {
      await this.addExceptionPage(item.title, 'Document not found in this project.');
      return;
    }

    // Fetch data_url if not cached
    let dataUrl = doc.data_url;
    if (!dataUrl) {
      const { data } = await supabase
        .from('vy_project_documents')
        .select('id,data_url')
        .eq('id', doc.id)
        .maybeSingle();
      dataUrl = data?.data_url ?? undefined;
    }

    if (!dataUrl) {
      await this.addExceptionPage(doc.name, 'Document data is unavailable. Please re-upload this file.');
      return;
    }

    const cat = mimeCategory(doc.type);
    const displayName = (doc.doc_title ?? '').trim() || doc.name;

    if (cat === 'pdf') {
      await this.mergePdfDocument(item, doc, displayName, dataUrl);
    } else if (cat === 'image') {
      await this.addImagePage(item, doc, displayName, dataUrl);
    } else {
      // Office or unsupported
      await this.addUnsupportedPage(item, doc, displayName);
    }
  }

  // Merge uploaded PDF pages directly into output
  private async mergePdfDocument(
    item: DBOAndMItem,
    doc: DBProjectDocument,
    displayName: string,
    dataUrl: string,
  ) {
    // Intro page first
    await this.addDocIntroPage(item, doc, displayName);

    try {
      const bytes = dataUrlToBytes(dataUrl);
      const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pageCount = source.getPageCount();

      if (pageCount === 0) {
        await this.addExceptionPage(displayName, 'This PDF contains no pages.');
        return;
      }

      // Copy ALL pages — preserves original size, orientation, vector quality
      const indices = Array.from({ length: pageCount }, (_, i) => i);
      const copiedPages = await this.output.copyPages(source, indices);
      copiedPages.forEach(p => this.output.addPage(p));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isEncrypted = msg.toLowerCase().includes('encrypt') || msg.toLowerCase().includes('password');
      await this.addExceptionPage(
        displayName,
        isEncrypted
          ? 'This PDF is password-protected and cannot be merged automatically. Please provide an unlocked version.'
          : `This PDF could not be merged: ${msg.slice(0, 120)}`,
      );
    }
  }

  // Embed image as a full A4 page, centred, maximum practical size
  private async addImagePage(
    item: DBOAndMItem,
    doc: DBProjectDocument,
    displayName: string,
    dataUrl: string,
  ) {
    await this.addDocIntroPage(item, doc, displayName);

    try {
      const bytes = dataUrlToBytes(dataUrl);
      const isJpeg = doc.type === 'image/jpeg' || doc.type === 'image/jpg';
      const img = isJpeg
        ? await this.output.embedJpg(bytes)
        : await this.output.embedPng(bytes);

      const page = this.output.addPage([A4_W, A4_H]);
      const { width: iW, height: iH } = img.size();
      const maxW = A4_W - MARGIN * 2;
      const maxH = A4_H - MARGIN * 2 - 24; // reserve bottom for caption
      const scale = Math.min(maxW / iW, maxH / iH);
      const dw = iW * scale;
      const dh = iH * scale;
      const dx = (A4_W - dw) / 2;
      const dy = (A4_H - dh) / 2 + 12;

      page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });

      // Caption
      const captionW = this.regular.widthOfTextAtSize(displayName, 8);
      drawText(page, this.oblique, displayName, (A4_W - captionW) / 2, MARGIN - 8, 8, C_MUTED);
      this.addPageFooter(page, this.manual.title, this.project.name);
    } catch {
      await this.addExceptionPage(displayName, 'This image could not be embedded (unsupported format or corrupt file).');
    }
  }

  // ── TC Record page ──────────────────────────────────────────────────────────

  async addTCRecord(item: DBOAndMItem, rec: DBTCRecord | undefined) {
    if (!rec) {
      await this.addExceptionPage(item.title, 'T&C Record not found.');
      return;
    }

    const page = this.output.addPage([A4_W, A4_H]);
    const { bold, regular, oblique } = this;

    // Header bar
    page.drawRectangle({ x: 0, y: A4_H - 4, width: A4_W, height: 4, color: rgb(0.055, 0.647, 0.914) }); // sky-500

    // Logo / org name
    let headerY = A4_H - MARGIN - 16;
    if (this.orgInfo.logoDataUrl) {
      try {
        const logoImg = await this.embedImage(this.output, this.orgInfo.logoDataUrl);
        if (logoImg) {
          const scale = Math.min(120 / logoImg.width, 32 / logoImg.height);
          page.drawImage(logoImg, { x: MARGIN, y: headerY - 32 * scale, width: logoImg.width * scale, height: logoImg.height * scale });
        }
      } catch { /* ignore */ }
    }
    drawText(page, regular, `Testing & Commissioning — ${rec.category}`, MARGIN, headerY - 36, 9, C_MUTED);

    // Record title (right-aligned)
    drawWrappedText(page, bold, rec.title, A4_W / 2, headerY - 4, A4_W / 2 - MARGIN, 14, C_INK, 16, 'right');
    drawText(page, regular, `${rec.ref}${rec.date ? '  ·  ' + fmtDateShort(rec.date) : ''}`, A4_W / 2, headerY - 24, 10, C_MUTED, { align: 'right', maxWidth: A4_W / 2 - MARGIN });

    // Divider
    page.drawLine({ start: { x: MARGIN, y: A4_H - MARGIN - 54 }, end: { x: A4_W - MARGIN, y: A4_H - MARGIN - 54 }, thickness: 2, color: rgb(0.055, 0.647, 0.914) });

    // Meta grid
    const metaItems: [string, string][] = [
      ['Reference', rec.ref],
      ['Category', rec.category],
      ['Area / Location', rec.area],
      ['Engineer', rec.engineer],
      ['Date', fmtDateShort(rec.date)],
      ['Status', rec.status],
    ].filter(([, v]) => v) as [string, string][];

    const metaY = A4_H - MARGIN - 80;
    const metaColW = (A4_W - MARGIN * 2) / 3;
    page.drawRectangle({ x: MARGIN, y: metaY - 28, width: A4_W - MARGIN * 2, height: 54, color: rgb(0.973, 0.980, 0.988), borderColor: C_FAINT, borderWidth: 0.5 });
    metaItems.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const mx = MARGIN + 10 + col * metaColW;
      const my = metaY + 14 - row * 28;
      drawText(page, bold, label.toUpperCase(), mx, my, 7, C_MUTED, { letterSpacing: 0.8 });
      drawText(page, bold, value, mx, my - 12, 10, C_INK);
    });

    // Result block
    let contentY = metaY - 56;
    if (rec.result) {
      const isPass = /pass/i.test(rec.result);
      const isFail = /fail/i.test(rec.result);
      const blockColor = isPass ? rgb(0.941, 0.996, 0.957) : isFail ? rgb(0.996, 0.949, 0.949) : rgb(1, 0.988, 0.922);
      const borderColor = isPass ? rgb(0.529, 0.937, 0.671) : isFail ? rgb(0.988, 0.643, 0.643) : rgb(0.988, 0.831, 0.302);
      const textColor = isPass ? C_GREEN : isFail ? C_RED : C_AMBER;
      page.drawRectangle({ x: MARGIN, y: contentY - 24, width: A4_W - MARGIN * 2, height: 40, color: blockColor, borderColor, borderWidth: 1.5 });
      drawText(page, bold, 'TEST RESULT', MARGIN + 12, contentY - 6, 8, C_MUTED, { letterSpacing: 0.8 });
      const rw = bold.widthOfTextAtSize(rec.result.toUpperCase(), 14);
      drawText(page, bold, rec.result.toUpperCase(), A4_W - MARGIN - rw - 12, contentY - 10, 14, textColor);
      contentY -= 60;
    }

    // Notes
    if (rec.notes) {
      drawText(page, bold, 'NOTES & OBSERVATIONS', MARGIN, contentY, 7, C_MUTED, { letterSpacing: 1.2 });
      page.drawLine({ start: { x: MARGIN, y: contentY - 8 }, end: { x: A4_W - MARGIN, y: contentY - 8 }, thickness: 0.5, color: C_FAINT });
      contentY -= 24;
      contentY = drawWrappedText(page, regular, rec.notes, MARGIN + 4, contentY, A4_W - MARGIN * 2 - 8, 10, C_BODY, 15);
    }

    this.addPageFooter(page, this.manual.title, this.project.name);
  }

  // ── Site Form reference page ────────────────────────────────────────────────

  async addSiteFormReference(item: DBOAndMItem, form: DBSiteForm | undefined) {
    const page = this.output.addPage([A4_W, A4_H]);

    // Header bar (amber)
    page.drawRectangle({ x: 0, y: A4_H - 4, width: A4_W, height: 4, color: C_ORANGE });

    drawText(page, this.regular, 'SITE FORM', MARGIN, A4_H - MARGIN - 12, 7, C_MUTED, { letterSpacing: 2 });
    drawText(page, this.bold, item.title, MARGIN, A4_H - MARGIN - 44, 20, C_INK);
    page.drawLine({ start: { x: MARGIN, y: A4_H - MARGIN - 56 }, end: { x: A4_W - MARGIN, y: A4_H - MARGIN - 56 }, thickness: 2, color: C_ORANGE });

    if (form) {
      const fields: [string, string][] = [
        ['Form Type', form.type || '—'],
        ['Project', form.project_name || this.project.name],
        ['Date', fmtDateShort(form.date)],
        ['Completed By', form.completed_by || '—'],
        ['Status', form.status || '—'],
      ].filter(([, v]) => v && v !== '—') as [string, string][];

      const fieldColW = (A4_W - MARGIN * 2) / 2;
      let fy = A4_H - MARGIN - 100;
      fields.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const fx = MARGIN + col * fieldColW;
        const ffY = fy - row * 44;
        drawText(page, this.bold, label.toUpperCase(), fx, ffY, 7, C_MUTED, { letterSpacing: 1.2 });
        drawText(page, this.bold, value, fx, ffY - 14, 11, C_BODY);
        page.drawLine({ start: { x: fx, y: ffY - 26 }, end: { x: fx + fieldColW - 16, y: ffY - 26 }, thickness: 0.5, color: C_FAINT });
      });

      if (form.notes) {
        let ny = fy - Math.ceil(fields.length / 2) * 44 - 24;
        drawText(page, this.bold, 'NOTES', MARGIN, ny, 7, C_MUTED, { letterSpacing: 1.2 });
        page.drawLine({ start: { x: MARGIN, y: ny - 8 }, end: { x: A4_W - MARGIN, y: ny - 8 }, thickness: 0.5, color: C_FAINT });
        ny -= 24;
        drawWrappedText(page, this.regular, form.notes, MARGIN + 4, ny, A4_W - MARGIN * 2 - 8, 10, C_BODY, 15);
      }
    } else {
      drawText(page, this.oblique, 'Form record not found.', MARGIN, A4_H - MARGIN - 100, 11, C_MUTED);
    }

    if (item.notes) {
      drawText(page, this.oblique, `"${item.notes}"`, MARGIN, MARGIN + 64, 9, C_MUTED);
    }

    this.addPageFooter(page, this.manual.title, this.project.name);
  }

  // ── Helper pages ─────────────────────────────────────────────────────────────

  private async addDocIntroPage(item: DBOAndMItem, doc: DBProjectDocument, displayName: string) {
    const page = this.output.addPage([A4_W, A4_H]);
    const catLabel = (doc.category || 'Project Document').toUpperCase();
    const fileExt = doc.name.split('.').pop()?.toUpperCase() ?? '';

    drawText(page, this.bold, catLabel, MARGIN, A4_H - MARGIN - 12, 7, C_MUTED, { letterSpacing: 2 });
    drawWrappedText(page, this.bold, displayName, MARGIN, A4_H - MARGIN - 52, A4_W - MARGIN * 2, 20, C_INK, 24);

    // Meta row
    let mx = MARGIN;
    const metaY = A4_H - MARGIN - 86;
    if (fileExt) {
      const ew = this.bold.widthOfTextAtSize(fileExt, 8) + 16;
      page.drawRectangle({ x: mx, y: metaY - 12, width: ew, height: 18, color: rgb(0.973, 0.980, 0.988), borderColor: C_FAINT, borderWidth: 0.5 });
      drawText(page, this.bold, fileExt, mx + 8, metaY, 8, C_MUTED, { letterSpacing: 0.8 });
      mx += ew + 12;
    }
    if (doc.uploaded_by) {
      drawText(page, this.regular, `Provided by ${doc.uploaded_by}`, mx, metaY, 9, C_MUTED);
      mx += this.regular.widthOfTextAtSize(`Provided by ${doc.uploaded_by}`, 9) + 16;
    }
    if (doc.created_at) {
      drawText(page, this.regular, fmtDateShort(doc.created_at), mx, metaY, 9, C_MUTED);
    }

    // Notes
    if (item.notes) {
      page.drawRectangle({ x: MARGIN, y: metaY - 54, width: 3, height: 36, color: C_FAINT });
      drawWrappedText(page, this.oblique, item.notes, MARGIN + 12, metaY - 30, A4_W - MARGIN * 2 - 16, 10, C_MID, 15);
    }

    this.addPageFooter(page, this.manual.title, this.project.name);
  }

  private async addUnsupportedPage(item: DBOAndMItem, doc: DBProjectDocument, displayName: string) {
    await this.addDocIntroPage(item, doc, displayName);
    const page = this.output.addPage([A4_W, A4_H]);
    const ext = doc.name.split('.').pop()?.toUpperCase() ?? 'FILE';
    drawText(page, this.bold, displayName, MARGIN, A4_H / 2 + 20, 14, C_INK);
    drawText(page, this.regular, `${ext} file — included with this manual.`, MARGIN, A4_H / 2, 11, C_MID);
    drawText(page, this.regular, 'This file format cannot be rendered as PDF pages.', MARGIN, A4_H / 2 - 20, 10, C_MUTED);
    drawText(page, this.regular, 'Request the digital file package for the original document.', MARGIN, A4_H / 2 - 38, 10, C_MUTED);
    this.addPageFooter(page, this.manual.title, this.project.name);
  }

  async addExceptionPage(title: string, reason: string) {
    const page = this.output.addPage([A4_W, A4_H]);
    page.drawRectangle({ x: MARGIN, y: A4_H / 2 - 60, width: A4_W - MARGIN * 2, height: 120, color: rgb(0.996, 0.988, 0.961), borderColor: rgb(0.988, 0.831, 0.302), borderWidth: 1.5 });
    drawText(page, this.bold, 'DOCUMENT EXCEPTION', MARGIN + 16, A4_H / 2 + 40, 8, C_AMBER, { letterSpacing: 1.2 });
    drawWrappedText(page, this.bold, title, MARGIN + 16, A4_H / 2 + 22, A4_W - MARGIN * 2 - 32, 13, C_INK, 16);
    drawWrappedText(page, this.regular, reason, MARGIN + 16, A4_H / 2 - 8, A4_W - MARGIN * 2 - 32, 10, C_MID, 14);
    this.addPageFooter(page, this.manual.title, this.project.name);
  }

  // ── Page footer ─────────────────────────────────────────────────────────────

  private addPageFooter(page: PDFPage, title: string, projectName: string) {
    page.drawLine({ start: { x: MARGIN, y: MARGIN - 4 }, end: { x: A4_W - MARGIN, y: MARGIN - 4 }, thickness: 0.5, color: C_FAINT });
    const left = `${projectName}  ·  ${title}`;
    const right = 'Powered by VYSITE®  |  © VYSITE Ltd.';
    drawText(page, this.regular, left, MARGIN, MARGIN - 18, 7, C_MUTED);
    const rw = this.regular.widthOfTextAtSize(right, 7);
    drawText(page, this.regular, right, A4_W - MARGIN - rw, MARGIN - 18, 7, C_FAINT);
  }

  // ── Image embedding ──────────────────────────────────────────────────────────

  private async embedImage(doc: PDFDocument, dataUrl: string) {
    const mimeMatch = dataUrl.match(/^data:([^;]+);/);
    const mime = mimeMatch?.[1] ?? '';
    const bytes = dataUrlToBytes(dataUrl);
    if (mime === 'image/jpeg' || mime === 'image/jpg') return doc.embedJpg(bytes);
    if (mime === 'image/png') return doc.embedPng(bytes);
    // Try JPEG as fallback
    try { return await doc.embedJpg(bytes); } catch { return null; }
  }
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

type TextOpts = {
  letterSpacing?: number;
  align?: 'left' | 'right' | 'center';
  maxWidth?: number;
};

function drawText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>,
  opts: TextOpts = {},
) {
  if (!text) return;
  let tx = x;
  if (opts.align === 'right' && opts.maxWidth) {
    const w = font.widthOfTextAtSize(text, size);
    tx = x + opts.maxWidth - w;
  } else if (opts.align === 'center' && opts.maxWidth) {
    const w = font.widthOfTextAtSize(text, size);
    tx = x + (opts.maxWidth - w) / 2;
  }
  page.drawText(text, { x: tx, y, size, font, color, characterSpacing: opts.letterSpacing ?? 0 });
}

// Returns the final y position after drawing (for subsequent content positioning)
function drawWrappedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color: ReturnType<typeof rgb>,
  lineHeight: number,
  align?: 'left' | 'right' | 'center',
): number {
  if (!text) return y;
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  let cy = y;
  for (const line of lines) {
    let lx = x;
    if (align === 'right') {
      lx = x + maxWidth - font.widthOfTextAtSize(line, size);
    } else if (align === 'center') {
      lx = x + (maxWidth - font.widthOfTextAtSize(line, size)) / 2;
    }
    page.drawText(line, { x: lx, y: cy, size, font, color });
    cy -= lineHeight;
  }
  return cy;
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
  if (
    mimeType.includes('word') || mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') || mimeType.includes('presentation') ||
    mimeType.includes('powerpoint') || mimeType.includes('openxmlformats')
  ) return 'office';
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
