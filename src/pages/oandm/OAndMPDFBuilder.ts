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

// ─── Layout constants ─────────────────────────────────────────────────────────

const A4_W = 595.28;
const A4_H = 841.89;

// Page margins
const ML = 56;   // margin left
const MR = 56;   // margin right
const MT = 56;   // margin top (from page top — used as offset from A4_H)
const MB = 52;   // margin bottom (footer sits at y = MB)

// Derived content geometry
const CONTENT_X     = ML;
const CONTENT_W     = A4_W - ML - MR;
const CONTENT_TOP   = A4_H - MT;      // y-coord of topmost content line
const CONTENT_BOT   = MB + 24;        // y-coord of lowest content line (above footer text)

// Header / footer geometry
const HEADER_RULE_H = 4;              // orange rule at top of page
const FOOTER_RULE_Y = MB - 2;        // y-coord of footer separator rule
const FOOTER_TEXT_Y = MB - 16;       // y-coord of footer text baseline

// Spacing tokens
const SECTION_GAP   = 28;            // vertical gap between major sections
const PARA_GAP      = 14;            // vertical gap between paragraphs / field rows
const CARD_PAD      = 14;            // internal padding inside card panels
const ROW_LINE_H    = 13;            // line height for body text rows
const LABEL_H       = 10;            // height of a small label above a value

// ─── Colour palette ───────────────────────────────────────────────────────────

const C_INK    = rgb(0.055, 0.086, 0.161);
const C_BODY   = rgb(0.118, 0.176, 0.298);
const C_MID    = rgb(0.271, 0.329, 0.427);
const C_MUTED  = rgb(0.580, 0.635, 0.725);
const C_FAINT  = rgb(0.882, 0.906, 0.929);
const C_WHITE  = rgb(1, 1, 1);
const C_ORANGE = rgb(0.976, 0.451, 0.086);
const C_SKY    = rgb(0.055, 0.647, 0.914);
const C_GREEN  = rgb(0.063, 0.733, 0.506);
const C_RED    = rgb(0.863, 0.149, 0.149);
const C_AMBER  = rgb(0.855, 0.604, 0.075);
const C_PANEL  = rgb(0.973, 0.980, 0.988);
const C_DARK   = rgb(0.038, 0.059, 0.118);  // deep navy for cover sidebar

// ─── Build context ────────────────────────────────────────────────────────────

class BuildContext {
  output: PDFDocument = null!;
  bold: PDFFont    = null!;
  regular: PDFFont = null!;
  oblique: PDFFont = null!;
  logoImg: PDFImage | null = null;

  // Page counter for footer page numbers
  private pageCount = 0;

  constructor(
    private manual: DBOAndMManual,
    private project: Project,
    private orgInfo: OrgInfo,
    private _onProgress?: (p: BuildProgress) => void,
  ) {}

  async init() {
    this.output  = await PDFDocument.create();
    this.regular = await this.output.embedFont(StandardFonts.Helvetica);
    this.bold    = await this.output.embedFont(StandardFonts.HelveticaBold);
    this.oblique = await this.output.embedFont(StandardFonts.HelveticaOblique);
    if (this.orgInfo.logoDataUrl) {
      try { this.logoImg = await embedImage(this.output, this.orgInfo.logoDataUrl); }
      catch { this.logoImg = null; }
    }
  }

  // ── Cover page ───────────────────────────────────────────────────────────────

  async addCoverPage() {
    const p = this.newPage();
    const { manual, project, orgInfo } = this;

    // ── Deep navy sidebar (left accent)
    p.drawRectangle({ x: 0, y: 0, width: 48, height: A4_H, color: C_DARK });
    p.drawRectangle({ x: 0, y: A4_H * 0.30, width: 48, height: 4, color: C_ORANGE });

    // ── Top orange rule
    p.drawRectangle({ x: 48, y: A4_H - HEADER_RULE_H, width: A4_W - 48, height: HEADER_RULE_H, color: C_ORANGE });

    // ── Company logo / name  (top-right quadrant)
    const logoX = 72;
    const logoY = A4_H - MT - 6;
    if (this.logoImg) {
      const scale = Math.min(150 / this.logoImg.width, 40 / this.logoImg.height);
      const lw = this.logoImg.width * scale;
      const lh = this.logoImg.height * scale;
      p.drawImage(this.logoImg, { x: logoX, y: logoY - lh, width: lw, height: lh });
    } else {
      dt(p, this.bold, orgInfo.companyName || 'Organisation', logoX, logoY - 14, 15, C_INK);
    }

    // ── Status badge (top-right)
    const statusText = manual.status === 'finalised' ? 'FINALISED'
      : manual.status === 'in_progress' ? 'IN PROGRESS' : 'DRAFT';
    const badgeCol = manual.status === 'finalised' ? C_GREEN
      : manual.status === 'in_progress' ? C_AMBER : C_MUTED;
    const bw = this.bold.widthOfTextAtSize(statusText, 8) + 20;
    p.drawRectangle({ x: A4_W - MR - bw, y: A4_H - MT - 22, width: bw, height: 22, borderColor: badgeCol, borderWidth: 1.5, borderRadius: 2 });
    dt(p, this.bold, statusText, A4_W - MR - bw + 10, A4_H - MT - 15, 8, badgeCol);

    // ── Eyebrow label
    dt(p, this.regular, 'OPERATION & MAINTENANCE MANUAL', logoX, A4_H * 0.62, 8, C_MUTED, { ls: 2.5 });

    // ── Manual title (large)
    const titleY = A4_H * 0.57;
    const titleBottom = wrapText(p, this.bold, manual.title, logoX, titleY, A4_W - logoX - MR - 8, 32, C_INK, 40);

    // ── Version pill
    if (manual.version) {
      const versionY = titleBottom - 14;
      const vw = this.regular.widthOfTextAtSize(manual.version, 10) + 22;
      p.drawRectangle({ x: logoX, y: versionY - 18, width: vw, height: 20, color: rgb(0.95, 0.97, 0.99), borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 2 });
      dt(p, this.regular, manual.version, logoX + 11, versionY - 8, 10, C_MID);
    }

    // ── Horizontal rule
    const ruleY = A4_H * 0.27;
    p.drawLine({ start: { x: logoX, y: ruleY }, end: { x: A4_W - MR, y: ruleY }, thickness: 1, color: C_FAINT });

    // ── Project metadata grid (2-col)
    const gridW = A4_W - logoX - MR;
    const colW  = gridW / 2;
    const ROW_H = 46;
    const metaRows: [string, string][] = [
      ['Project',          project.name],
      ['Client',           project.client || '—'],
      ['Location',         project.location || '—'],
      ['Project Manager',  project.projectManager || '—'],
      ['Contractor',       orgInfo.companyName || '—'],
      ['Document Date',    fmtDate(manual.updated_at || manual.created_at)],
    ];
    metaRows.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const gx = logoX + col * colW;
      const gy = ruleY - 22 - row * ROW_H;
      dt(p, this.bold, label.toUpperCase(), gx, gy + LABEL_H, 6.5, C_MUTED, { ls: 1.2 });
      wrapText(p, this.bold, value, gx, gy, colW - 12, 11, C_BODY, 14);
    });

    // Cover page has no header/footer chrome — it is a standalone design page
  }

  // ── Contents page ────────────────────────────────────────────────────────────

  async addContentsPage(sections: DBOAndMSection[], items: DBOAndMItem[]) {
    const p = this.newPage();
    this.pageHeader(p, 'TABLE OF CONTENTS');

    // Page title
    let y = CONTENT_TOP - 36;
    dt(p, this.regular, 'TABLE OF', CONTENT_X, y + 16, 8, C_MUTED, { ls: 2.5 });
    y -= 6;
    dt(p, this.bold, 'Contents', CONTENT_X, y, 28, C_INK);
    y -= 6;
    p.drawRectangle({ x: CONTENT_X, y: y - 4, width: 48, height: 3, color: C_ORANGE });
    y -= SECTION_GAP;

    sections.forEach((sec, idx) => {
      const minH = sec.description ? 56 : 38;
      if (y - minH < CONTENT_BOT) return;

      const count = items.filter(i => i.section_id === sec.id).length;
      const numStr = String(idx + 1).padStart(2, '0');

      // Alternating row tint
      const rowH = sec.description ? 52 : 36;
      if (idx % 2 === 0) {
        p.drawRectangle({ x: CONTENT_X - 6, y: y - rowH + 8, width: CONTENT_W + 12, height: rowH, color: rgb(0.985, 0.988, 0.993) });
      }

      // Section number
      dt(p, this.bold, numStr, CONTENT_X, y, 10, C_FAINT);

      // Section title — wraps within available width (leaving room for badge)
      const badgeW = this.bold.widthOfTextAtSize(String(count), 9) + 16;
      const titleMaxW = CONTENT_W - 32 - badgeW - 12;
      const titleLines = measureLines(this.bold, san(sec.title), titleMaxW, 12);
      titleLines.forEach((line, li) => {
        p.drawText(line, { x: CONTENT_X + 32, y: y - li * ROW_LINE_H, size: 12, font: this.bold, color: C_BODY });
      });

      // Count badge (right-aligned)
      p.drawRectangle({ x: A4_W - MR - badgeW, y: y - 12, width: badgeW, height: 18, color: rgb(0.94, 0.96, 0.99), borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 2 });
      dt(p, this.bold, String(count), A4_W - MR - badgeW + 8, y, 9, C_MUTED);

      if (sec.description) {
        dt(p, this.regular, san(sec.description), CONTENT_X + 32, y - 18, 9, C_MUTED);
      }

      y -= rowH;
      p.drawLine({ start: { x: CONTENT_X, y }, end: { x: A4_W - MR, y }, thickness: 0.4, color: C_FAINT });
      y -= 6;
    });

    this.footer(p);
  }

  // ── Section divider ───────────────────────────────────────────────────────────

  async addSectionDivider(section: DBOAndMSection, index: number, sectionItems: DBOAndMItem[]) {
    const p = this.newPage();
    this.topRule(p, C_ORANGE);

    const numStr = String(index + 1).padStart(2, '0');

    // Large watermark number (faint, top-right)
    p.drawText(numStr, {
      x: A4_W - MR - 114,
      y: A4_H / 2 - 30,
      size: 160,
      font: this.bold,
      color: rgb(0.94, 0.955, 0.965),
    });

    // Section eyebrow
    dt(p, this.regular, `SECTION ${numStr}`, CONTENT_X, CONTENT_TOP - 14, 8, C_MUTED, { ls: 2.5 });

    // Section title (large, wraps)
    const titleY = CONTENT_TOP - 56;
    const titleBottom = wrapText(p, this.bold, section.title, CONTENT_X, titleY, CONTENT_W - 90, 28, C_INK, 36);

    // Orange accent under title
    p.drawRectangle({ x: CONTENT_X, y: titleBottom - 8, width: 48, height: 3, color: C_ORANGE });

    // Description
    if (section.description) {
      wrapText(p, this.regular, section.description, CONTENT_X, titleBottom - 28, CONTENT_W - 90, 11, C_MID, 17);
    }

    // Document list
    if (sectionItems.length > 0) {
      const listTopY = section.description
        ? titleBottom - 70
        : titleBottom - 44;

      dt(p, this.bold, 'DOCUMENTS IN THIS SECTION', CONTENT_X, listTopY + 16, 7, C_MUTED, { ls: 1.5 });
      p.drawLine({ start: { x: CONTENT_X, y: listTopY + 2 }, end: { x: A4_W - MR, y: listTopY + 2 }, thickness: 0.5, color: C_FAINT });

      let ly = listTopY - 14;

      sectionItems.slice(0, 22).forEach((item, i) => {
        if (ly < CONTENT_BOT + 20) return;

        const badge = item.source_module === 'tc_record' ? 'T&C'
          : item.source_module === 'site_form' ? 'FORM' : 'DOC';
        const bw = this.bold.widthOfTextAtSize(badge, 7) + 14;
        const titleMaxW = CONTENT_W - 32 - bw - 12;

        const titleLines = measureLines(this.bold, san(item.title ?? ''), titleMaxW, 10);
        const titleBlockH = titleLines.length * ROW_LINE_H;

        // Row index
        dt(p, this.bold, String(i + 1).padStart(2, '0'), CONTENT_X, ly, 8, C_FAINT);

        // Title lines
        titleLines.forEach((line, li) => {
          p.drawText(line, { x: CONTENT_X + 28, y: ly - li * ROW_LINE_H, size: 10, font: this.bold, color: C_BODY });
        });

        // Type badge — aligned to top of first title line
        p.drawRectangle({ x: A4_W - MR - bw, y: ly - 11, width: bw, height: 14, color: C_PANEL, borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 2 });
        dt(p, this.bold, badge, A4_W - MR - bw + 7, ly - 3, 7, C_MUTED);

        if (item.subtitle) {
          dt(p, this.regular, san(item.subtitle), CONTENT_X + 28, ly - titleBlockH - 1, 8, C_MUTED);
        }

        const rowH = titleBlockH + (item.subtitle ? ROW_LINE_H : 0) + 10;
        ly -= rowH;
        p.drawLine({ start: { x: CONTENT_X + 28, y: ly + 2 }, end: { x: A4_W - MR, y: ly + 2 }, thickness: 0.3, color: C_FAINT });
        ly -= 6;
      });
    }

    this.footer(p);
  }

  // ── Project document ──────────────────────────────────────────────────────────

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
      const p = this.newPage();
      const { width: iW, height: iH } = img.size();
      const maxW = CONTENT_W;
      const maxH = A4_H - MT - MB - 30;
      const scale = Math.min(maxW / iW, maxH / iH);
      const dw = iW * scale;
      const dh = iH * scale;
      p.drawImage(img, { x: (A4_W - dw) / 2, y: (A4_H - dh) / 2 + 10, width: dw, height: dh });
      const capW = this.oblique.widthOfTextAtSize(displayName, 8);
      dt(p, this.oblique, displayName, (A4_W - capW) / 2, MB - 4, 8, C_MUTED);
      this.footer(p);
    } catch {
      await this.addExceptionPage(displayName, 'Image could not be embedded (unsupported or corrupt file).');
    }
  }

  private async unsupportedPage(displayName: string, filename: string) {
    const p = this.newPage();
    const ext = filename.split('.').pop()?.toUpperCase() ?? 'FILE';
    const panelH = 90;
    p.drawRectangle({ x: CONTENT_X, y: A4_H / 2 - 40, width: CONTENT_W, height: panelH, color: C_PANEL, borderColor: C_FAINT, borderWidth: 1, borderRadius: 4 });
    dt(p, this.bold, ext + ' FILE', CONTENT_X + CARD_PAD, A4_H / 2 + 34, 8, C_MUTED, { ls: 1.5 });
    dt(p, this.bold, displayName, CONTENT_X + CARD_PAD, A4_H / 2 + 18, 13, C_INK);
    dt(p, this.regular, 'This file format cannot be rendered as PDF pages.', CONTENT_X + CARD_PAD, A4_H / 2 - 4, 10, C_MID);
    dt(p, this.regular, 'Request the digital file package for the original document.', CONTENT_X + CARD_PAD, A4_H / 2 - 18, 10, C_MUTED);
    this.footer(p);
  }

  // ── Document title page ───────────────────────────────────────────────────────

  private async titlePage(item: DBOAndMItem, doc: DBProjectDocument, displayName: string, typeTag: string) {
    const p = this.newPage();
    this.topRule(p, C_FAINT);

    // Left accent rule
    p.drawRectangle({ x: CONTENT_X - 16, y: CONTENT_BOT, width: 2.5, height: CONTENT_TOP - CONTENT_BOT - MT + MB, color: C_FAINT });

    // Category eyebrow + type badge
    const catLabel = (doc.category || 'Project Document').toUpperCase();
    dt(p, this.regular, catLabel, CONTENT_X, CONTENT_TOP - 14, 7.5, C_MUTED, { ls: 2 });

    const tagW = this.bold.widthOfTextAtSize(typeTag, 8) + 16;
    p.drawRectangle({ x: A4_W - MR - tagW, y: CONTENT_TOP - 22, width: tagW, height: 22, color: C_PANEL, borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 2 });
    dt(p, this.bold, typeTag, A4_W - MR - tagW + 8, CONTENT_TOP - 14, 8, C_MID, { ls: 0.8 });

    // Document title
    const titleY = CONTENT_TOP - 64;
    const titleBottom = wrapText(p, this.bold, displayName, CONTENT_X, titleY, CONTENT_W - 8, 22, C_INK, 30);

    // Subtitle
    if (item.subtitle) {
      dt(p, this.regular, san(item.subtitle), CONTENT_X, titleBottom - 12, 11, C_MID);
    }

    // Separator
    const sepY = item.subtitle ? titleBottom - 36 : titleBottom - 24;
    p.drawLine({ start: { x: CONTENT_X, y: sepY }, end: { x: A4_W - MR, y: sepY }, thickness: 0.5, color: C_FAINT });

    // Metadata grid (2-col)
    const metaY = sepY - PARA_GAP;
    const metaFields: [string, string][] = (
      [
        ['Category',    doc.category || '—'],
        ['Format',      doc.name.split('.').pop()?.toUpperCase() || '—'],
        ['Provided By', doc.uploaded_by || '—'],
        ['Date',        fmtDateShort(doc.created_at)],
      ] as [string, string][]
    ).filter(([, v]) => v && v !== '—');

    const mColW = CONTENT_W / 2;
    metaFields.forEach(([label, value], i) => {
      const col  = i % 2;
      const row  = Math.floor(i / 2);
      const mx   = CONTENT_X + col * mColW;
      const my   = metaY - row * 42;
      dt(p, this.bold, label.toUpperCase(), mx, my, 7, C_MUTED, { ls: 1 });
      dt(p, this.bold, value, mx, my - 14, 10, C_BODY);
      p.drawLine({ start: { x: mx, y: my - 28 }, end: { x: mx + mColW - 14, y: my - 28 }, thickness: 0.3, color: C_FAINT });
    });

    // Notes panel
    if (item.notes) {
      const notesY = metaY - Math.ceil(metaFields.length / 2) * 42 - SECTION_GAP;
      const notesH = 50;
      p.drawRectangle({ x: CONTENT_X, y: notesY - notesH + CARD_PAD, width: CONTENT_W, height: notesH, color: rgb(0.988, 0.994, 1), borderColor: rgb(0.81, 0.88, 0.94), borderWidth: 0.5, borderRadius: 3 });
      dt(p, this.bold, 'NOTES', CONTENT_X + CARD_PAD, notesY + 2, 7, C_MUTED, { ls: 1.2 });
      wrapText(p, this.oblique, item.notes, CONTENT_X + CARD_PAD, notesY - 12, CONTENT_W - CARD_PAD * 2, 9.5, C_MID, 15);
    }

    // Logo (bottom-right of content area)
    if (this.logoImg) {
      const scale = Math.min(110 / this.logoImg.width, 30 / this.logoImg.height);
      const lw = this.logoImg.width * scale;
      const lh = this.logoImg.height * scale;
      p.drawImage(this.logoImg, { x: A4_W - MR - lw, y: CONTENT_BOT + 4, width: lw, height: lh });
    }

    this.footer(p);
  }

  // ── T&C Record ───────────────────────────────────────────────────────────────

  async addTCRecord(item: DBOAndMItem, rec: DBTCRecord | undefined) {
    if (!rec) { await this.addExceptionPage(item.title, 'T&C Record not found.'); return; }

    const firstPage = this.newPage();

    // Sky-blue top rule
    firstPage.drawRectangle({ x: 0, y: A4_H - HEADER_RULE_H, width: A4_W, height: HEADER_RULE_H, color: C_SKY });

    const headerY = A4_H - MT;

    if (this.logoImg) {
      const scale = Math.min(130 / this.logoImg.width, 34 / this.logoImg.height);
      firstPage.drawImage(this.logoImg, { x: CONTENT_X, y: headerY - 34, width: this.logoImg.width * scale, height: this.logoImg.height * scale });
    } else {
      dt(firstPage, this.bold, this.orgInfo.companyName, CONTENT_X, headerY - 14, 14, C_INK);
    }

    dt(firstPage, this.regular, 'TESTING & COMMISSIONING RECORD', CONTENT_X, headerY - 46, 7.5, C_MUTED, { ls: 2 });

    const titleRX  = A4_W / 2 + 10;
    const titleW   = A4_W - MR - titleRX;
    wrapText(firstPage, this.bold, rec.title, titleRX, headerY - 14, titleW, 14, C_INK, 18, 'right');
    dt(firstPage, this.regular, `${rec.ref}${rec.date ? '  ·  ' + fmtDateShort(rec.date) : ''}`, titleRX, headerY - 38, 10, C_MUTED, { align: 'right', maxWidth: titleW });

    firstPage.drawLine({ start: { x: CONTENT_X, y: A4_H - MT - 58 }, end: { x: A4_W - MR, y: A4_H - MT - 58 }, thickness: 2, color: C_SKY });

    // Meta panel
    const metaTop = A4_H - MT - 70;
    const metaH   = 56;
    firstPage.drawRectangle({ x: CONTENT_X, y: metaTop - metaH, width: CONTENT_W, height: metaH, color: C_PANEL, borderColor: C_FAINT, borderWidth: 0.5 });

    const mFields: [string, string][] = [
      ['Reference',     rec.ref],
      ['Category',      rec.category],
      ['Area / Location', rec.area || '—'],
      ['Engineer',      rec.engineer || '—'],
      ['Date',          fmtDateShort(rec.date)],
      ['Status',        rec.status || '—'],
    ];
    const mColW = CONTENT_W / 3;
    mFields.forEach(([label, val], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const mx  = CONTENT_X + CARD_PAD + col * mColW;
      const my  = metaTop - 14 - row * 26;
      dt(firstPage, this.bold, label.toUpperCase(), mx, my, 6.5, C_MUTED, { ls: 0.7 });
      dt(firstPage, this.bold, val, mx, my - 12, 9.5, C_INK);
    });

    const pager: Pager = { page: firstPage, y: metaTop - metaH - 20 };
    const continuationTitle = rec.title;

    if (rec.result) {
      overflow(pager, this, 54, C_SKY, continuationTitle);
      const isPass = /pass/i.test(rec.result);
      const isFail = /fail/i.test(rec.result);
      const bg     = isPass ? rgb(0.941, 0.996, 0.957) : isFail ? rgb(0.996, 0.949, 0.949) : rgb(1, 0.988, 0.922);
      const border = isPass ? C_GREEN : isFail ? C_RED : C_AMBER;
      const textC  = isPass ? C_GREEN : isFail ? C_RED : C_AMBER;
      pager.page.drawRectangle({ x: CONTENT_X, y: pager.y - 30, width: CONTENT_W, height: 46, color: bg, borderColor: border, borderWidth: 1.5, borderRadius: 3 });
      dt(pager.page, this.bold, 'TEST RESULT', CONTENT_X + CARD_PAD, pager.y - 6, 8, C_MUTED, { ls: 0.8 });
      const rw = this.bold.widthOfTextAtSize(rec.result.toUpperCase(), 16);
      dt(pager.page, this.bold, rec.result.toUpperCase(), A4_W - MR - rw - CARD_PAD, pager.y - 14, 16, textC);
      pager.y -= 60;
    }

    if (rec.notes) {
      overflow(pager, this, 48, C_SKY, continuationTitle);
      dt(pager.page, this.bold, 'NOTES & OBSERVATIONS', CONTENT_X, pager.y, 7, C_MUTED, { ls: 1.2 });
      pager.page.drawLine({ start: { x: CONTENT_X, y: pager.y - 8 }, end: { x: A4_W - MR, y: pager.y - 8 }, thickness: 0.5, color: C_FAINT });
      pager.y -= 22;
      wrapTextPaged(pager, this, rec.notes, CONTENT_X + 4, CONTENT_W - 8, 10, C_BODY, 15, C_SKY, continuationTitle);
    }

    this.footer(pager.page);
  }

  // ── Site Form (html2canvas render) ────────────────────────────────────────────

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
    const p = this.newPage();
    const panelH = 108;
    p.drawRectangle({ x: CONTENT_X, y: A4_H / 2 - 54, width: CONTENT_W, height: panelH, color: rgb(1, 0.992, 0.957), borderColor: rgb(0.988, 0.831, 0.302), borderWidth: 1.5, borderRadius: 4 });
    dt(p, this.bold, 'DOCUMENT EXCEPTION', CONTENT_X + CARD_PAD, A4_H / 2 + 40, 8, C_AMBER, { ls: 1.2 });
    wrapText(p, this.bold, title, CONTENT_X + CARD_PAD, A4_H / 2 + 24, CONTENT_W - CARD_PAD * 2, 13, C_INK, 17);
    wrapText(p, this.regular, reason, CONTENT_X + CARD_PAD, A4_H / 2 - 4, CONTENT_W - CARD_PAD * 2, 10, C_MID, 15);
    this.footer(p);
  }

  // ── Page chrome helpers ───────────────────────────────────────────────────────

  // Allocate a new A4 page and increment counter
  newPage(): PDFPage {
    this.pageCount++;
    return this.output.addPage([A4_W, A4_H]);
  }

  // Thin coloured rule at very top of page
  private topRule(p: PDFPage, color: ReturnType<typeof rgb>) {
    p.drawRectangle({ x: 0, y: A4_H - HEADER_RULE_H, width: A4_W, height: HEADER_RULE_H, color });
  }

  // Slim header band with manual reference (for content pages)
  private pageHeader(p: PDFPage, _label?: string) {
    this.topRule(p, C_ORANGE);
    // Subtle header content line just below top rule
    dt(p, this.regular, san(this.manual.title), CONTENT_X, A4_H - HEADER_RULE_H - 14, 7.5, C_MUTED);
    const proj = san(this.project.name);
    const pw = this.regular.widthOfTextAtSize(proj, 7.5);
    dt(p, this.regular, proj, A4_W - MR - pw, A4_H - HEADER_RULE_H - 14, 7.5, C_MUTED);
    p.drawLine({ start: { x: CONTENT_X, y: A4_H - HEADER_RULE_H - 20 }, end: { x: A4_W - MR, y: A4_H - HEADER_RULE_H - 20 }, thickness: 0.3, color: C_FAINT });
  }

  // Consistent footer: left = project · manual, right = VYSITE® + page number
  footer(p: PDFPage) {
    p.drawLine({ start: { x: CONTENT_X, y: FOOTER_RULE_Y }, end: { x: A4_W - MR, y: FOOTER_RULE_Y }, thickness: 0.4, color: C_FAINT });
    const leftText = san(`${this.project.name}  ·  ${this.manual.title}`);
    dt(p, this.regular, leftText, CONTENT_X, FOOTER_TEXT_Y, 7, C_MUTED);
    const pgStr = `VYSITE®  ·  Page ${this.pageCount}`;
    const pw = this.regular.widthOfTextAtSize(pgStr, 7);
    dt(p, this.regular, pgStr, A4_W - MR - pw, FOOTER_TEXT_Y, 7, C_FAINT);
  }
}

// ─── WinAnsi sanitizer ────────────────────────────────────────────────────────

const WIN_ANSI_REPLACEMENTS: [RegExp, string][] = [
  [/Ω/g, 'Ohm'],
  [/MΩ/g, 'MOhm'],
  [/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''],
  [/\u0080/g, '€'],
  [/\u0085/g, '...'],
  [/\u0091/g, "'"], [/\u0092/g, "'"],
  [/\u0093/g, '"'], [/\u0094/g, '"'],
  [/\u0095/g, '-'],
  [/\u0096/g, '-'],
  [/\u0097/g, '--'],
  [/\u0099/g, '(TM)'],
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
  [/α/g, 'alpha'], [/β/g, 'beta'], [/γ/g, 'gamma'], [/δ/g, 'delta'],
  [/μ/g, 'u'],     [/π/g, 'pi'],   [/σ/g, 'sigma'], [/φ/g, 'phi'],
  [/Δ/g, 'Delta'], [/Σ/g, 'Sigma'], [/Π/g, 'Pi'],
];

function san(text: string): string {
  if (!text) return '';
  let out = text;
  for (const [re, replacement] of WIN_ANSI_REPLACEMENTS) {
    out = out.replace(re, replacement);
  }
  // eslint-disable-next-line no-control-regex
  return out.replace(/[^\x20-\xFF]/g, '');
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

interface Pager {
  page: PDFPage;
  y: number;
}

function overflow(
  pager: Pager,
  ctx: BuildContext,
  need: number,
  accentColor: ReturnType<typeof rgb>,
  continuationTitle: string,
): void {
  if (pager.y - need >= CONTENT_BOT) return;
  ctx.footer(pager.page);
  const np = ctx.newPage();
  np.drawRectangle({ x: 0, y: A4_H - HEADER_RULE_H, width: A4_W, height: HEADER_RULE_H, color: accentColor });
  dt(np, ctx.regular, san(continuationTitle) + ' — continued', CONTENT_X, A4_H - HEADER_RULE_H - 14, 8, C_MUTED);
  np.drawLine({ start: { x: CONTENT_X, y: A4_H - HEADER_RULE_H - 20 }, end: { x: A4_W - MR, y: A4_H - HEADER_RULE_H - 20 }, thickness: 0.3, color: C_FAINT });
  ctx.footer(np);
  pager.page = np;
  pager.y = A4_H - HEADER_RULE_H - 36;
}

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
  const words = san(text).replace(/[\r\n]+/g, ' ').split(' ').filter(Boolean);
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

// Measure text into wrapped lines without drawing (returns array of line strings)
function measureLines(font: PDFFont, text: string, maxWidth: number, size: number): string[] {
  if (!text) return [];
  const words = san(text).replace(/[\r\n]+/g, ' ').split(' ').filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
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

// ─── Utilities ────────────────────────────────────────────────────────────────

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

// Silence unused-variable warning for C_WHITE (kept in palette for future use)
void C_WHITE;
