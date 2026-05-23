import { PDFDocument } from 'pdf-lib';

export interface PdfChunk {
  blob: Blob;
  startPage: number; // 1-based, inclusive
  endPage: number;   // 1-based, inclusive
  label: string;
}

const CHUNK_SIZE = 50; // pages per chunk — safe margin below Anthropic's 100-page limit

/**
 * Splits a PDF File into chunks of up to CHUNK_SIZE pages using pdf-lib.
 * Each chunk is a fully valid, standalone PDF containing only its subset of pages.
 * Falls back to a single-chunk (original file) if splitting fails.
 */
export async function splitPdfIntoChunks(file: File, pageCount: number): Promise<PdfChunk[]> {
  if (pageCount <= CHUNK_SIZE) {
    return [{
      blob: file,
      startPage: 1,
      endPage: pageCount,
      label: 'Full document',
    }];
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const totalPages = srcPdf.getPageCount();

    const chunks: PdfChunk[] = [];
    let pageIndex = 0; // 0-based

    while (pageIndex < totalPages) {
      const chunkStart = pageIndex;                          // 0-based inclusive
      const chunkEnd = Math.min(pageIndex + CHUNK_SIZE, totalPages); // 0-based exclusive

      const chunkDoc = await PDFDocument.create();
      const pageIndices = Array.from({ length: chunkEnd - chunkStart }, (_, i) => chunkStart + i);
      const copiedPages = await chunkDoc.copyPages(srcPdf, pageIndices);
      copiedPages.forEach(p => chunkDoc.addPage(p));

      const chunkBytes = await chunkDoc.save();
      const startPage = chunkStart + 1; // convert to 1-based
      const endPage = chunkEnd;         // chunkEnd is exclusive 0-based = inclusive 1-based

      const totalChunks = Math.ceil(totalPages / CHUNK_SIZE);
      const chunkNumber = Math.floor(chunkStart / CHUNK_SIZE) + 1;
      const label = totalChunks > 1
        ? `Part ${chunkNumber} of ${totalChunks} (pages ${startPage}–${endPage})`
        : 'Full document';

      chunks.push({
        blob: new Blob([chunkBytes], { type: 'application/pdf' }),
        startPage,
        endPage,
        label,
      });

      pageIndex = chunkEnd;
    }

    return chunks;
  } catch (err) {
    console.error('[pdfChunker] Failed to split PDF:', err);
    // Fallback: return original file as a single chunk — caller will handle the page limit error
    return [{
      blob: file,
      startPage: 1,
      endPage: pageCount,
      label: 'Full document (unsplit)',
    }];
  }
}

/**
 * Counts the pages in a PDF using pdf-lib.
 * Returns null if the file cannot be parsed.
 */
export async function getPdfPageCount(file: File): Promise<number | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return null;
  }
}
