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
  await ctx.addIntroductionPage();
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

// ─── Universal page template ──────────────────────────────────────────────────
//
// Every generated page (except the cover) uses this fixed grid.
// Stack any two non-cover pages on top of each other and every header,
// footer and content-area edge aligns perfectly.
//
// Diagram (y=0 at page bottom, values in PDF user units / points):
//
//   841.89 ┌──────────────────────────────────────────────────┐
//          │  COLOURED BAR             h = 4                  │
//   837.89 ├──────────────────────────────────────────────────┤
//          │  manual title (left)  ·  project name (right)    │
//          │  text baseline y = 822.89                        │
//   810.89 ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ─ ─ ┤  ← HDR_SEP_Y
//          │  breathing gap        h = 26                     │
//   784.89 ├──────────────────────────────────────────────────┤  ← CONTENT_TOP
//          │                                                  │
//          │  C O N T E N T   A R E A   (722 pt / ~255 mm)   │
//          │                                                  │
//    62.89 ├──────────────────────────────────────────────────┤  ← CONTENT_BOT
//          │  breathing gap        h = 16                     │
//    46.89 ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ─ ─ ┤  ← FTR_SEP_Y
//          │  project · manual (left)   VYSITE® · Page N (rt)│
//          │  text baseline y = 30                            │
//    16.89 │  bottom margin                                   │
//    0     └──────────────────────────────────────────────────┘

const PAGE_W = 595.28;
const PAGE_H  = 841.89;

// Left / right page margins
const PG_L  = 56;
const PG_R  = 56;
const PG_CW = PAGE_W - PG_L - PG_R;   // 483.28 — content column width

// Fixed y-coordinates for the header band
const HDR_BAR_H  = 4;
const HDR_BAR_Y  = PAGE_H - HDR_BAR_H;       // 837.89 — bottom edge of bar rect
const HDR_TEXT_Y = PAGE_H - HDR_BAR_H - 15;  // 822.89 — header text baseline
const HDR_SEP_Y  = PAGE_H - HDR_BAR_H - 27;  // 810.89 — separator rule
const CONTENT_TOP = PAGE_H - HDR_BAR_H - 53; // 784.89 — guaranteed content start y

// Fixed y-coordinates for the footer band
const FTR_SEP_Y  = 46;   // separator rule y
const FTR_TEXT_Y = 30;   // footer text baseline y
const CONTENT_BOT = 62;  // content must not go below this y

// ─── Within-content spacing tokens ────────────────────────────────────────────
const SECTION_GAP = 28;   // gap between major content blocks
const PARA_GAP    = 16;   // gap between paragraph-level items
const ROW_H       = 16;   // single row height in lists / tables
const LABEL_V     = 12;   // vertical space for a small label above its value
const CARD_H      = 16;   // horizontal padding inside panels / cards
const CARD_V      = 14;   // vertical padding inside panels / cards

// ─── Colour palette ───────────────────────────────────────────────────────────

const C_INK    = rgb(0.055, 0.086, 0.161);
const C_BODY   = rgb(0.118, 0.176, 0.298);
const C_MID    = rgb(0.271, 0.329, 0.427);
const C_MUTED  = rgb(0.580, 0.635, 0.725);
const C_FAINT  = rgb(0.882, 0.906, 0.929);
const C_ORANGE = rgb(0.976, 0.451, 0.086);
const C_SKY    = rgb(0.055, 0.647, 0.914);
const C_GREEN  = rgb(0.063, 0.733, 0.506);
const C_RED    = rgb(0.863, 0.149, 0.149);
const C_AMBER  = rgb(0.855, 0.604, 0.075);
const C_PANEL  = rgb(0.973, 0.980, 0.988);
const C_DARK   = rgb(0.038, 0.059, 0.118);

// ─── Build context ────────────────────────────────────────────────────────────

class BuildContext {
  output: PDFDocument = null!;
  bold: PDFFont    = null!;
  regular: PDFFont = null!;
  oblique: PDFFont = null!;
  logoImg: PDFImage | null = null;
  coverImg: PDFImage | null = null;

  // Sequential page counter — incremented for every non-cover page via newPage()
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
    if (this.manual.cover_image_data_url) {
      try { this.coverImg = await embedImage(this.output, this.manual.cover_image_data_url); }
      catch { this.coverImg = null; }
    }
  }

  // ── Universal page factory ────────────────────────────────────────────────────
  // Creates an A4 page, stamps the fixed template, returns { page, y: CONTENT_TOP }.
  // All content methods call this and begin drawing at the returned y.

  newPage(accent: ReturnType<typeof rgb> = C_ORANGE): { page: PDFPage; y: number } {
    this.pageCount++;
    const page = this.output.addPage([PAGE_W, PAGE_H]);
    this.stampTemplate(page, accent);
    return { page, y: CONTENT_TOP };
  }

  // Stamps the fixed header+footer chrome. Called once per page at creation time.
  // Draws only structural chrome — never content.
  private stampTemplate(p: PDFPage, accent: ReturnType<typeof rgb>) {
    // Coloured top bar
    p.drawRectangle({ x: 0, y: HDR_BAR_Y, width: PAGE_W, height: HDR_BAR_H, color: accent });

    // Header text: manual title left, project name right
    const manualLabel = san(truncate(this.manual.title, 60));
    dt(p, this.regular, manualLabel, PG_L, HDR_TEXT_Y, 6.5, C_MUTED);
    const projLabel = san(this.project.name);
    const projW = this.regular.widthOfTextAtSize(projLabel, 6.5);
    dt(p, this.regular, projLabel, PAGE_W - PG_R - projW, HDR_TEXT_Y, 6.5, C_MUTED);

    // Header separator rule
    p.drawLine({
      start: { x: PG_L, y: HDR_SEP_Y },
      end:   { x: PAGE_W - PG_R, y: HDR_SEP_Y },
      thickness: 0.3, color: C_FAINT,
    });

    // Footer separator rule
    p.drawLine({
      start: { x: PG_L, y: FTR_SEP_Y },
      end:   { x: PAGE_W - PG_R, y: FTR_SEP_Y },
      thickness: 0.4, color: C_FAINT,
    });

    // Footer text
    const leftFtr = san(truncate(`${this.project.name}  \xB7  ${this.manual.title}`, 72));
    dt(p, this.regular, leftFtr, PG_L, FTR_TEXT_Y, 6.5, C_MUTED);
    const rightFtr = `VYSITE\xAE  \xB7  Page ${this.pageCount}`;
    const rw = this.regular.widthOfTextAtSize(rightFtr, 6.5);
    dt(p, this.regular, rightFtr, PAGE_W - PG_R - rw, FTR_TEXT_Y, 6.5, C_MUTED);
  }

  // ── Cover page ───────────────────────────────────────────────────────────────
  // Premium standalone design — not the standard template.
  // All vertical positions are fixed anchors so nothing can overlap.

  async addCoverPage() {
    const p = this.output.addPage([PAGE_W, PAGE_H]);
    const { manual, project, orgInfo } = this;

    // ── Structure: deep navy left sidebar
    p.drawRectangle({ x: 0, y: 0, width: 46, height: PAGE_H, color: C_DARK });
    p.drawRectangle({ x: 0, y: Math.round(PAGE_H * 0.30), width: 46, height: 4, color: C_ORANGE });

    // ── Top band
    p.drawRectangle({ x: 46, y: PAGE_H - 5, width: PAGE_W - 46, height: 5, color: C_ORANGE });

    // ─── Cover photo band — fills a generous area beneath the top bar
    // When a cover image is present, it takes up the upper ~40% of the page.
    // The layout below adapts: Zone B (title) anchors at 42% from page top when
    // an image is present, or at 59.5% when there is no image (original behaviour).
    const COVER_IMG_H = 310;  // height of the photo band in points
    const COVER_IMG_Y = PAGE_H - 5 - COVER_IMG_H;  // bottom edge of photo band

    if (this.coverImg) {
      const { width: iW, height: iH } = this.coverImg.size();
      const availW = PAGE_W - 46;
      // Scale to fill the full width of the photo band, then vertically centre-crop
      const scaleW   = availW / iW;
      const scaleH   = COVER_IMG_H / iH;
      const scale    = Math.max(scaleW, scaleH);
      const drawW    = iW * scale;
      const drawH    = iH * scale;
      const drawX    = 46 + (availW - drawW) / 2;
      const drawY    = COVER_IMG_Y + (COVER_IMG_H - drawH) / 2;
      p.drawImage(this.coverImg, { x: drawX, y: drawY, width: drawW, height: drawH });
      // Dark gradient overlay so the title remains readable
      p.drawRectangle({ x: 46, y: COVER_IMG_Y, width: availW, height: COVER_IMG_H,
        color: rgb(0.038, 0.059, 0.118), opacity: 0.40 });
    }

    // ─── Zone A: logo + badge — sits above cover photo (or at page top if no photo)
    const ZONE_A_TOP = PAGE_H - 18;
    const LOGO_X = 70;
    let logoBandBottom = ZONE_A_TOP - 16;

    if (this.logoImg) {
      const scale = Math.min(148 / this.logoImg.width, 38 / this.logoImg.height);
      const lw = this.logoImg.width * scale;
      const lh = this.logoImg.height * scale;
      p.drawImage(this.logoImg, { x: LOGO_X, y: ZONE_A_TOP - lh, width: lw, height: lh });
      logoBandBottom = ZONE_A_TOP - lh;
    } else {
      dt(p, this.bold, orgInfo.companyName || 'Organisation', LOGO_X, ZONE_A_TOP - 14, 15, C_INK);
      logoBandBottom = ZONE_A_TOP - 22;
    }

    // Status badge
    const statusText = manual.status === 'finalised' ? 'FINALISED'
      : manual.status === 'in_progress' ? 'IN PROGRESS' : 'DRAFT';
    const badgeCol = manual.status === 'finalised' ? C_GREEN
      : manual.status === 'in_progress' ? C_AMBER : C_MUTED;
    const bw = this.bold.widthOfTextAtSize(statusText, 8) + 22;
    const badgeH = 20;
    const badgeCentreY = ZONE_A_TOP - 19;
    p.drawRectangle({ x: PAGE_W - PG_R - bw, y: badgeCentreY - badgeH / 2, width: bw, height: badgeH, borderColor: badgeCol, borderWidth: 1.5, borderRadius: 2 });
    dt(p, this.bold, statusText, PAGE_W - PG_R - bw + 11, badgeCentreY - 3, 8, badgeCol);

    // ─── Zone B: title block
    // When cover image present, anchor title lower (in the photo band area, white text over overlay)
    const ZONE_B_TOP = this.coverImg
      ? COVER_IMG_Y + 120  // ~120pt from bottom of photo band
      : Math.round(PAGE_H * 0.595);
    const ZONE_C_TOP = Math.round(PAGE_H * 0.285);

    const titleColor = this.coverImg ? rgb(1, 1, 1) : C_INK;
    const eyebrowColor = this.coverImg ? rgb(0.9, 0.9, 0.9) : C_MUTED;

    dt(p, this.regular, 'OPERATION & MAINTENANCE MANUAL', LOGO_X, ZONE_B_TOP, 8, eyebrowColor, { ls: 2.5 });

    p.drawLine({
      start: { x: LOGO_X, y: ZONE_B_TOP - 14 },
      end:   { x: LOGO_X + 200, y: ZONE_B_TOP - 14 },
      thickness: 0.5,
      color: this.coverImg ? rgb(0.7, 0.7, 0.7) : C_FAINT,
    });

    const TITLE_START_Y = ZONE_B_TOP - 32;
    const titleMaxW = PAGE_W - LOGO_X - PG_R - 6;
    const titleBottom = wrapText(p, this.bold, manual.title, LOGO_X, TITLE_START_Y,
      titleMaxW, 32, titleColor, 42);

    if (manual.version) {
      const vpTop = Math.max(titleBottom - 20, ZONE_C_TOP + 52);
      const vw = this.regular.widthOfTextAtSize(manual.version, 10) + 24;
      if (this.coverImg) {
        // Version pill on photo — white text, semi-transparent background
        p.drawRectangle({ x: LOGO_X, y: vpTop - 20, width: vw, height: 20, color: rgb(1, 1, 1), opacity: 0.15, borderColor: rgb(1, 1, 1), borderWidth: 0.5, borderRadius: 2 });
        dt(p, this.regular, manual.version, LOGO_X + 12, vpTop - 10, 10, rgb(1, 1, 1));
      } else {
        p.drawRectangle({ x: LOGO_X, y: vpTop - 20, width: vw, height: 20, color: rgb(0.95, 0.97, 0.99), borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 2 });
        dt(p, this.regular, manual.version, LOGO_X + 12, vpTop - 10, 10, C_MID);
      }
    }

    // ─── Zone C: metadata grid
    p.drawLine({ start: { x: LOGO_X, y: ZONE_C_TOP }, end: { x: PAGE_W - PG_R, y: ZONE_C_TOP }, thickness: 0.8, color: C_FAINT });

    const COL_W      = (PAGE_W - LOGO_X - PG_R) / 2;
    const META_ROW_H = 48;
    const META_START = ZONE_C_TOP - 24;

    const metaRows: [string, string][] = [
      ['Project',         project.name],
      ['Client',          project.client || '\x97'],
      ['Location',        project.location || '\x97'],
      ['Project Manager', project.projectManager || '\x97'],
      ['Contractor',      orgInfo.companyName || '\x97'],
      ['Document Date',   fmtDate(manual.updated_at || manual.created_at)],
    ];

    metaRows.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const gx  = LOGO_X + col * COL_W;
      const gy  = META_START - row * META_ROW_H;
      if (gy - 14 < 20) return;
      dt(p, this.regular, label.toUpperCase(), gx, gy + 14, 6.5, C_MUTED, { ls: 1.2 });
      wrapText(p, this.bold, value, gx, gy, COL_W - 14, 10.5, C_BODY, 14);
    });

    void logoBandBottom;
  }

  // ── Introduction page ─────────────────────────────────────────────────────────
  // Rendered only when manual.introduction is non-empty.
  // A dedicated text page between the contents and the first section.

  async addIntroductionPage() {
    if (!this.manual.introduction) return;

    const { page, y: startY } = this.newPage(C_ORANGE);
    let y = startY;

    dt(page, this.regular, 'INTRODUCTION', PG_L, y, 7.5, C_MUTED, { ls: 2.5 });
    y -= 26;
    dt(page, this.bold, 'Project Introduction', PG_L, y, 24, C_INK);
    y -= 6;
    page.drawRectangle({ x: PG_L, y: y - 3, width: 44, height: 3, color: C_ORANGE });
    y -= SECTION_GAP + 10;

    // Render the introduction text, flowing across pages if needed
    const pager: Pager = { page, y };
    const text = this.manual.introduction;
    const paragraphs = text.split(/\r?\n+/).filter(s => s.trim());

    for (const para of paragraphs) {
      overflow(pager, this, 30, C_ORANGE, 'Project Introduction');
      wrapTextPaged(pager, this, para, PG_L, PG_CW, 11, C_BODY, 17, C_ORANGE, 'Project Introduction');
      pager.y -= PARA_GAP;
    }
  }

  // ── Contents page ────────────────────────────────────────────────────────────

  async addContentsPage(sections: DBOAndMSection[], items: DBOAndMItem[]) {
    const { page, y: startY } = this.newPage(C_ORANGE);

    let y = startY;

    // Page heading block
    dt(page, this.regular, 'TABLE OF CONTENTS', PG_L, y, 7.5, C_MUTED, { ls: 2.5 });
    y -= 26;
    dt(page, this.bold, 'Contents', PG_L, y, 30, C_INK);
    y -= 8;
    page.drawRectangle({ x: PG_L, y: y - 3, width: 44, height: 3, color: C_ORANGE });
    y -= SECTION_GAP + 10;

    // Section rows
    for (const [idx, sec] of sections.entries()) {
      const itemCount  = items.filter(i => i.section_id === sec.id).length;
      const numStr     = String(idx + 1).padStart(2, '0');
      const badgeW     = this.bold.widthOfTextAtSize(String(itemCount), 9) + 20;
      const titleMaxW  = PG_CW - 40 - badgeW - 20;
      const titleLines = measureLines(this.bold, san(sec.title), titleMaxW, 11);
      const descLines  = sec.description
        ? measureLines(this.regular, san(sec.description), titleMaxW, 9)
        : [];
      // Row height: title lines (16pt each) + optional desc lines (13pt each) + vertical padding
      const titleBlockH = titleLines.length * ROW_H;
      const descBlockH  = descLines.length > 0 ? descLines.length * 13 + 6 : 0;
      const rowH        = titleBlockH + descBlockH + 18;

      if (y - rowH < CONTENT_BOT + 8) break;

      // Alternating row tint — tight to the row, no overlap
      if (idx % 2 === 0) {
        page.drawRectangle({
          x: PG_L - 8,
          y: y - rowH + 4,
          width: PG_CW + 16,
          height: rowH,
          color: rgb(0.984, 0.988, 0.994),
        });
      }

      // Section number — vertically centred to first title line baseline
      dt(page, this.bold, numStr, PG_L + 2, y, 10, C_FAINT);

      // Section title lines
      titleLines.forEach((line, li) => {
        page.drawText(san(line), { x: PG_L + 36, y: y - li * ROW_H, size: 11, font: this.bold, color: C_BODY });
      });

      // Item count badge — right side, vertically centred to the title block
      const badgeMidY = y - titleBlockH / 2;
      const badgeY    = badgeMidY - 9;
      page.drawRectangle({ x: PAGE_W - PG_R - badgeW, y: badgeY, width: badgeW, height: 18, color: rgb(0.930, 0.955, 0.988), borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 3 });
      dt(page, this.bold, String(itemCount), PAGE_W - PG_R - badgeW + 10, badgeY + 5, 9, C_MUTED);

      // Optional description — below title block with a small gap
      if (descLines.length > 0) {
        const descStartY = y - titleBlockH - 4;
        descLines.forEach((line, li) => {
          dt(page, this.regular, san(line), PG_L + 36, descStartY - li * 13, 9, C_MUTED);
        });
      }

      y -= rowH;
      page.drawLine({ start: { x: PG_L, y: y + 2 }, end: { x: PAGE_W - PG_R, y: y + 2 }, thickness: 0.3, color: C_FAINT });
      y -= 6;
    }
  }

  // ── Section divider ───────────────────────────────────────────────────────────

  async addSectionDivider(section: DBOAndMSection, index: number, sectionItems: DBOAndMItem[]) {
    const { page, y: startY } = this.newPage(C_ORANGE);

    const numStr = String(index + 1).padStart(2, '0');

    // Watermark section number — lower half of content area, purely decorative
    const wmBaseY = Math.round((CONTENT_TOP + CONTENT_BOT) / 2) - 50;
    page.drawText(numStr, {
      x: PAGE_W - PG_R - 116,
      y: wmBaseY,
      size: 148,
      font: this.bold,
      color: rgb(0.945, 0.958, 0.967),
    });

    let y = startY;

    // Eyebrow: "SECTION 01"
    dt(page, this.regular, `SECTION ${numStr}`, PG_L, y, 8, C_MUTED, { ls: 2.5 });
    y -= 24;

    // Section title — large, wraps; width limited to avoid watermark area
    const titleBottom = wrapText(page, this.bold, section.title, PG_L, y,
      PG_CW - 100, 28, C_INK, 38);
    y = titleBottom;

    // Orange accent underline — 12pt below last title line
    y -= 12;
    page.drawRectangle({ x: PG_L, y: y - 2, width: 44, height: 3, color: C_ORANGE });
    y -= SECTION_GAP + 4;

    // Optional description
    if (section.description) {
      const descBottom = wrapText(page, this.regular, san(section.description), PG_L, y,
        PG_CW - 100, 11, C_MID, 17);
      y = descBottom - SECTION_GAP;
    }

    // Document index list
    if (sectionItems.length > 0) {
      // Always leave enough room above the list header
      y = Math.min(y, CONTENT_TOP - 150);

      dt(page, this.bold, 'DOCUMENTS IN THIS SECTION', PG_L, y, 7, C_MUTED, { ls: 1.8 });
      y -= 14;
      page.drawLine({ start: { x: PG_L, y }, end: { x: PAGE_W - PG_R, y }, thickness: 0.5, color: C_FAINT });
      y -= 18;

      for (const [i, item] of sectionItems.slice(0, 24).entries()) {
        if (y < CONTENT_BOT + 28) break;

        const badge       = item.source_module === 'tc_record' ? 'T&C'
          : item.source_module === 'site_form' ? 'FORM' : 'DOC';
        const bw          = this.bold.widthOfTextAtSize(badge, 7) + 16;
        const titleMaxW   = PG_CW - 36 - bw - 16;
        const titleLines  = measureLines(this.bold, san(item.title ?? ''), titleMaxW, 10);
        const titleBlockH = titleLines.length * ROW_H;
        const hasSubtitle = !!item.subtitle;
        const rowH        = titleBlockH + (hasSubtitle ? 14 : 0) + 14;

        // Row index number
        dt(page, this.bold, String(i + 1).padStart(2, '0'), PG_L, y, 8.5, C_FAINT);

        // Title lines — indent from the number
        titleLines.forEach((line, li) => {
          page.drawText(san(line), { x: PG_L + 30, y: y - li * ROW_H, size: 10, font: this.bold, color: C_BODY });
        });

        // Type badge — vertically centred to title block, right-aligned
        const badgeMidY = y - titleBlockH / 2;
        page.drawRectangle({ x: PAGE_W - PG_R - bw, y: badgeMidY - 8, width: bw, height: 16, color: C_PANEL, borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 2 });
        dt(page, this.bold, badge, PAGE_W - PG_R - bw + 8, badgeMidY - 3, 7, C_MUTED);

        // Optional subtitle
        if (hasSubtitle) {
          dt(page, this.regular, san(item.subtitle!), PG_L + 30, y - titleBlockH - 2, 8.5, C_MUTED);
        }

        y -= rowH;
        page.drawLine({ start: { x: PG_L + 30, y: y + 2 }, end: { x: PAGE_W - PG_R, y: y + 2 }, thickness: 0.3, color: C_FAINT });
        y -= 8;
      }
    }
  }

  // ── Project document ──────────────────────────────────────────────────────────

  async addProjectDocument(item: DBOAndMItem, doc: DBProjectDocument | undefined) {
    if (!doc) { await this.addExceptionPage(item.title, 'Document record not found in this project.'); return; }

    let dataUrl = doc.data_url;
    if (!dataUrl) {
      const { data } = await supabase.from('vy_project_documents').select('id,data_url').eq('id', doc.id).maybeSingle();
      dataUrl = data?.data_url ?? undefined;
    }
    if (!dataUrl) {
      await this.addExceptionPage((doc.doc_title ?? '').trim() || doc.name, 'Document data unavailable. Please re-upload.');
      return;
    }

    const cat         = mimeCategory(doc.type);
    const displayName = (doc.doc_title ?? '').trim() || doc.name;

    if (cat === 'pdf') {
      await this.docTitlePage(item, doc, displayName, 'PDF');
      await this.mergePdf(displayName, dataUrl);
    } else if (cat === 'image') {
      await this.docTitlePage(item, doc, displayName, 'IMG');
      await this.imageFullPage(displayName, doc.type, dataUrl);
    } else {
      await this.docTitlePage(item, doc, displayName, doc.name.split('.').pop()?.toUpperCase() ?? 'FILE');
      await this.unsupportedPage(displayName, doc.name);
    }
  }

  private async mergePdf(displayName: string, dataUrl: string) {
    try {
      const bytes = dataUrlToBytes(dataUrl);
      const src   = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const count = src.getPageCount();
      if (count === 0) { await this.addExceptionPage(displayName, 'This PDF contains no pages.'); return; }
      const indices = Array.from({ length: count }, (_, i) => i);
      const copied  = await this.output.copyPages(src, indices);
      copied.forEach(pg => this.output.addPage(pg));
    } catch (err) {
      const msg   = err instanceof Error ? err.message : String(err);
      const isEnc = /encrypt|password/i.test(msg);
      await this.addExceptionPage(displayName,
        isEnc ? 'This PDF is password-protected. Please supply an unlocked version.'
              : `PDF could not be merged: ${msg.slice(0, 100)}`);
    }
  }

  private async imageFullPage(displayName: string, mimeType: string, dataUrl: string) {
    try {
      const bytes  = dataUrlToBytes(dataUrl);
      const isJpeg = mimeType === 'image/jpeg' || mimeType === 'image/jpg';
      const img    = isJpeg ? await this.output.embedJpg(bytes) : await this.output.embedPng(bytes);
      const { page } = this.newPage(C_FAINT);
      const { width: iW, height: iH } = img.size();
      const maxW  = PG_CW;
      const maxH  = CONTENT_TOP - CONTENT_BOT - 24;
      const scale = Math.min(maxW / iW, maxH / iH);
      const dw = iW * scale;
      const dh = iH * scale;
      // Centre image within the content zone
      const imgX = (PAGE_W - dw) / 2;
      const imgY = CONTENT_BOT + Math.round((CONTENT_TOP - CONTENT_BOT - dh) / 2);
      page.drawImage(img, { x: imgX, y: imgY, width: dw, height: dh });
      const capW = this.oblique.widthOfTextAtSize(displayName, 8);
      // Caption sits below image, always above CONTENT_BOT
      const capY = Math.max(imgY - 14, CONTENT_BOT + 2);
      dt(page, this.oblique, displayName, (PAGE_W - capW) / 2, capY, 8, C_MUTED);
    } catch {
      await this.addExceptionPage(displayName, 'Image could not be embedded (unsupported or corrupt file).');
    }
  }

  private async unsupportedPage(displayName: string, filename: string) {
    const { page, y } = this.newPage(C_FAINT);
    const ext    = filename.split('.').pop()?.toUpperCase() ?? 'FILE';
    const panelH = 92;
    // Panel sits at a fixed distance from content top, never near the footer
    const panelY = y - 100;
    page.drawRectangle({ x: PG_L, y: panelY, width: PG_CW, height: panelH, color: C_PANEL, borderColor: C_FAINT, borderWidth: 1, borderRadius: 4 });
    dt(page, this.bold, ext + ' FILE',       PG_L + CARD_H, panelY + panelH - CARD_V - 2,  8, C_MUTED, { ls: 1.5 });
    dt(page, this.bold, displayName,          PG_L + CARD_H, panelY + panelH - CARD_V - 18, 13, C_INK);
    dt(page, this.regular, 'This file format cannot be rendered as PDF pages.',          PG_L + CARD_H, panelY + panelH - CARD_V - 38, 10, C_MID);
    dt(page, this.regular, 'Request the digital file package for the original document.', PG_L + CARD_H, panelY + panelH - CARD_V - 54, 10, C_MUTED);
  }

  // ── Document title / divider page ─────────────────────────────────────────────

  private async docTitlePage(item: DBOAndMItem, doc: DBProjectDocument, displayName: string, typeTag: string) {
    const { page, y: startY } = this.newPage(C_FAINT);
    let y = startY;

    // Left accent rule — spans full content height
    page.drawRectangle({
      x: PG_L - 20,
      y: CONTENT_BOT,
      width: 2.5,
      height: CONTENT_TOP - CONTENT_BOT,
      color: C_FAINT,
    });

    // Category breadcrumb (top-left) + type badge (top-right)
    const catLabel = (doc.category || 'Project Document').toUpperCase();
    dt(page, this.regular, catLabel, PG_L, y, 7.5, C_MUTED, { ls: 2 });

    const tagW = this.bold.widthOfTextAtSize(typeTag, 8) + 18;
    page.drawRectangle({ x: PAGE_W - PG_R - tagW, y: y - 14, width: tagW, height: 18, color: C_PANEL, borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 2 });
    dt(page, this.bold, typeTag, PAGE_W - PG_R - tagW + 9, y - 6, 8, C_MID, { ls: 0.8 });

    y -= SECTION_GAP + 4;

    // Document title (large, wraps)
    const titleBottom = wrapText(page, this.bold, displayName, PG_L, y, PG_CW - 6, 22, C_INK, 30);
    y = titleBottom;

    // Optional subtitle
    if (item.subtitle) {
      y -= PARA_GAP;
      dt(page, this.regular, san(item.subtitle), PG_L, y, 11, C_MID);
      y -= 20;
    } else {
      y -= PARA_GAP;
    }

    // Separator rule
    page.drawLine({ start: { x: PG_L, y }, end: { x: PAGE_W - PG_R, y }, thickness: 0.5, color: C_FAINT });
    y -= SECTION_GAP + 4;

    // Metadata grid — 2 columns, 52pt row pitch to give labels and values room
    const metaFields: [string, string][] = (
      [
        ['Category',    doc.category || '\x97'],
        ['Format',      doc.name.split('.').pop()?.toUpperCase() || '\x97'],
        ['Provided By', doc.uploaded_by || '\x97'],
        ['Date',        fmtDateShort(doc.created_at)],
      ] as [string, string][]
    ).filter(([, v]) => v !== '\x97' && v !== '');

    const mColW    = PG_CW / 2;
    const mRowPitch = 52;
    metaFields.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const mx  = PG_L + col * mColW;
      const my  = y - row * mRowPitch;
      // Label
      dt(page, this.regular, label.toUpperCase(), mx, my, 7, C_MUTED, { ls: 1.2 });
      // Value — 16pt below label baseline
      dt(page, this.bold, value, mx, my - 16, 11, C_BODY);
      // Rule — 14pt below value baseline
      page.drawLine({ start: { x: mx, y: my - 30 }, end: { x: mx + mColW - 16, y: my - 30 }, thickness: 0.3, color: C_FAINT });
    });

    // Notes panel
    if (item.notes) {
      const notesTop = y - Math.ceil(metaFields.length / 2) * mRowPitch - SECTION_GAP;
      const panelH   = 60;
      if (notesTop - panelH > CONTENT_BOT + 16) {
        page.drawRectangle({ x: PG_L, y: notesTop - panelH, width: PG_CW, height: panelH, color: rgb(0.988, 0.994, 1), borderColor: rgb(0.81, 0.88, 0.94), borderWidth: 0.5, borderRadius: 3 });
        dt(page, this.bold, 'NOTES', PG_L + CARD_H, notesTop - CARD_V, 7, C_MUTED, { ls: 1.2 });
        wrapText(page, this.oblique, item.notes, PG_L + CARD_H, notesTop - CARD_V - 16, PG_CW - CARD_H * 2, 9.5, C_MID, 15);
      }
    }

    // Logo — pinned to bottom-right of content area
    if (this.logoImg) {
      const scale = Math.min(110 / this.logoImg.width, 28 / this.logoImg.height);
      const lw = this.logoImg.width * scale;
      const lh = this.logoImg.height * scale;
      page.drawImage(this.logoImg, { x: PAGE_W - PG_R - lw, y: CONTENT_BOT + 12, width: lw, height: lh });
    }
  }

  // ── T&C Record ───────────────────────────────────────────────────────────────

  async addTCRecord(_item: DBOAndMItem, rec: DBTCRecord | undefined) {
    if (!rec) { await this.addExceptionPage(_item.title, 'T&C Record not found.'); return; }

    const { page: firstPage, y: startY } = this.newPage(C_SKY);
    let y = startY;

    // ── Identify logo height first so subsequent elements are positioned correctly
    let logoBlockH = 0;

    if (this.logoImg) {
      const scale = Math.min(130 / this.logoImg.width, 32 / this.logoImg.height);
      const lw = this.logoImg.width * scale;
      const lh = this.logoImg.height * scale;
      firstPage.drawImage(this.logoImg, { x: PG_L, y: y - lh, width: lw, height: lh });
      logoBlockH = lh;
    } else {
      dt(firstPage, this.bold, this.orgInfo.companyName, PG_L, y - 16, 14, C_INK);
      logoBlockH = 22;
    }

    // "TESTING & COMMISSIONING RECORD" label — always 12pt below bottom of logo block
    const labelY = y - logoBlockH - 12;
    dt(firstPage, this.regular, 'TESTING & COMMISSIONING RECORD', PG_L, labelY, 7.5, C_MUTED, { ls: 2 });

    // Record title + ref — right-aligned, vertically aligned to logo/label block
    const titleRX = PAGE_W / 2 + 10;
    const titleW  = PAGE_W - PG_R - titleRX;
    wrapText(firstPage, this.bold, rec.title, titleRX, y - 14, titleW, 14, C_INK, 18, 'right');
    dt(firstPage, this.regular,
      `${rec.ref}${rec.date ? '  \xB7  ' + fmtDateShort(rec.date) : ''}`,
      titleRX, y - 36, 10, C_MUTED, { align: 'right', maxWidth: titleW });

    // Thick rule — sits below the taller of (label, ref), with 8pt clearance
    const ruleY = Math.min(labelY - 10, y - 50);
    firstPage.drawLine({ start: { x: PG_L, y: ruleY }, end: { x: PAGE_W - PG_R, y: ruleY }, thickness: 2, color: C_SKY });
    y = ruleY - PARA_GAP;

    // Meta panel — fixed height, positioned immediately below rule
    const metaH = 68;
    firstPage.drawRectangle({ x: PG_L, y: y - metaH, width: PG_CW, height: metaH, color: C_PANEL, borderColor: C_FAINT, borderWidth: 0.5, borderRadius: 3 });

    const mFields: [string, string][] = [
      ['Reference',       rec.ref],
      ['Category',        rec.category],
      ['Area / Location', rec.area || '\x97'],
      ['Engineer',        rec.engineer || '\x97'],
      ['Date',            fmtDateShort(rec.date)],
      ['Status',          rec.status || '\x97'],
    ];
    const mColW = PG_CW / 3;
    mFields.forEach(([label, val], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const mx  = PG_L + CARD_H + col * mColW;
      const my  = y - 16 - row * 30;
      dt(firstPage, this.regular, label.toUpperCase(), mx, my, 6.5, C_MUTED, { ls: 0.7 });
      dt(firstPage, this.bold, val, mx, my - 13, 9.5, C_INK);
    });

    y -= metaH + SECTION_GAP;

    // Pager for flowing content below the fixed header block
    const pager: Pager = { page: firstPage, y };
    const contTitle    = rec.title;

    // Result block
    if (rec.result) {
      overflow(pager, this, 56, C_SKY, contTitle);
      const isPass = /pass/i.test(rec.result);
      const isFail = /fail/i.test(rec.result);
      const bg     = isPass ? rgb(0.941, 0.996, 0.957) : isFail ? rgb(0.996, 0.949, 0.949) : rgb(1, 0.988, 0.922);
      const border = isPass ? C_GREEN : isFail ? C_RED : C_AMBER;
      const textC  = isPass ? C_GREEN : isFail ? C_RED : C_AMBER;
      pager.page.drawRectangle({ x: PG_L, y: pager.y - 30, width: PG_CW, height: 48, color: bg, borderColor: border, borderWidth: 1.5, borderRadius: 3 });
      dt(pager.page, this.bold, 'TEST RESULT', PG_L + CARD_H, pager.y - 8, 8, C_MUTED, { ls: 0.8 });
      const rw = this.bold.widthOfTextAtSize(rec.result.toUpperCase(), 16);
      dt(pager.page, this.bold, rec.result.toUpperCase(), PAGE_W - PG_R - rw - CARD_H, pager.y - 16, 16, textC);
      pager.y -= 64;
    }

    // Notes section
    if (rec.notes) {
      overflow(pager, this, 52, C_SKY, contTitle);
      dt(pager.page, this.bold, 'NOTES & OBSERVATIONS', PG_L, pager.y, 7, C_MUTED, { ls: 1.2 });
      pager.page.drawLine({ start: { x: PG_L, y: pager.y - 10 }, end: { x: PAGE_W - PG_R, y: pager.y - 10 }, thickness: 0.5, color: C_FAINT });
      pager.y -= 24;
      wrapTextPaged(pager, this, rec.notes, PG_L + 4, PG_CW - 8, 10, C_BODY, 16, C_SKY, contTitle);
    }
  }

  // ── Site Form ────────────────────────────────────────────────────────────────
  // Renders the form using the same PDF engine as the standalone "Export PDF"
  // button and merges the resulting pages directly into the O&M output.
  // This guarantees: standalone form PDF = form inside the O&M (one renderer,
  // one standard, zero canvas slicing).

  async addSiteForm(item: DBOAndMItem, form: DBSiteForm | undefined) {
    if (!form) { await this.addExceptionPage(item.title, 'Site Form record not found.'); return; }
    try {
      const pdfBytes = await formToPdfBytes(form, this.orgInfo);
      const src      = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const count    = src.getPageCount();
      if (count === 0) { await this.addExceptionPage(item.title, 'Form rendered no pages.'); return; }
      const indices = Array.from({ length: count }, (_, i) => i);
      const copied  = await this.output.copyPages(src, indices);
      copied.forEach(pg => this.output.addPage(pg));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.addExceptionPage(item.title, `Form could not be rendered: ${msg.slice(0, 120)}`);
    }
  }

  // ── Exception page ────────────────────────────────────────────────────────────

  async addExceptionPage(title: string, reason: string) {
    const { page, y } = this.newPage(C_AMBER);
    const panelH = 110;
    // Panel centred in upper content area — never near footer
    const panelY = y - 80;
    page.drawRectangle({ x: PG_L, y: panelY, width: PG_CW, height: panelH, color: rgb(1, 0.992, 0.957), borderColor: rgb(0.988, 0.831, 0.302), borderWidth: 1.5, borderRadius: 4 });
    dt(page, this.bold, 'DOCUMENT EXCEPTION', PG_L + CARD_H, panelY + panelH - 20, 8, C_AMBER, { ls: 1.2 });
    wrapText(page, this.bold, title, PG_L + CARD_H, panelY + panelH - 38, PG_CW - CARD_H * 2, 13, C_INK, 18);
    wrapText(page, this.regular, reason, PG_L + CARD_H, panelY + panelH - 64, PG_CW - CARD_H * 2, 10, C_MID, 15);
  }
}

// ─── WinAnsi sanitizer ────────────────────────────────────────────────────────

const WIN_ANSI_REPLACEMENTS: [RegExp, string][] = [
  [/Ω/g, 'Ohm'],
  [/MΩ/g, 'MOhm'],
  [/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''],
  [/\u0080/g, '\x80'],
  [/\u0085/g, '...'],
  [/\u0091/g, "'"], [/\u0092/g, "'"],
  [/\u0093/g, '"'], [/\u0094/g, '"'],
  [/\u0095/g, '\xB7'],
  [/\u0096/g, '\x96'],
  [/\u0097/g, '\x97'],
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
  [/α/g, 'alpha'], [/β/g, 'beta'],  [/γ/g, 'gamma'], [/δ/g, 'delta'],
  [/μ/g, 'u'],     [/π/g, 'pi'],    [/σ/g, 'sigma'],  [/φ/g, 'phi'],
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

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text;
  return text.slice(0, max - 1) + '\x85';
}

// ─── Pager / overflow ─────────────────────────────────────────────────────────

interface Pager {
  page: PDFPage;
  y: number;
}

function overflow(
  pager: Pager,
  ctx: BuildContext,
  need: number,
  accent: ReturnType<typeof rgb>,
  continuationLabel: string,
): void {
  if (pager.y - need >= CONTENT_BOT) return;
  const { page, y } = ctx.newPage(accent);
  // Continuation label with thin rule underneath
  dt(page, ctx.regular, san(continuationLabel) + '  \x97  continued', PG_L, y, 8, C_MUTED);
  page.drawLine({
    start: { x: PG_L, y: y - 13 },
    end:   { x: PAGE_W - PG_R, y: y - 13 },
    thickness: 0.3, color: C_FAINT,
  });
  pager.page = page;
  pager.y    = y - 26;
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
  accent: ReturnType<typeof rgb>,
  continuationLabel: string,
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
    overflow(pager, ctx, lineH + 4, accent, continuationLabel);
    pager.page.drawText(san(line), { x, y: pager.y, size, font: ctx.regular, color });
    pager.y -= lineH;
  }
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

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
  if (opts.align === 'right'  && opts.maxWidth) tx = x + opts.maxWidth - font.widthOfTextAtSize(s, size);
  if (opts.align === 'center' && opts.maxWidth) tx = x + (opts.maxWidth - font.widthOfTextAtSize(s, size)) / 2;
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
    if (align === 'right')  lx = x + maxWidth - font.widthOfTextAtSize(line, size);
    if (align === 'center') lx = x + (maxWidth - font.widthOfTextAtSize(line, size)) / 2;
    p.drawText(line, { x: lx, y: cy, size, font, color });
    cy -= lineH;
  }
  return cy;
}

// ─── Image embedding ──────────────────────────────────────────────────────────

async function embedImage(doc: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  const mimeMatch = dataUrl.match(/^data:([^;]+);/);
  const mime  = mimeMatch?.[1] ?? '';
  const bytes = dataUrlToBytes(dataUrl);
  if (mime === 'image/jpeg' || mime === 'image/jpg') return doc.embedJpg(bytes);
  if (mime === 'image/png') return doc.embedPng(bytes);
  try { return await doc.embedJpg(bytes); } catch { return null; }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
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
  if (!iso) return '\x97';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

// Suppress unused-variable warning for C_MID (used inline in wrapText calls)
void C_MID;
