/**
 * patchXlsx.ts
 *
 * SheetJS CE 0.18.x unconditionally emits xl/metadata.xml with:
 *   <cellMetadata count="1"><bk><rc t="1" v="0"/></bk></cellMetadata>
 * …but writes zero worksheet cells with vm/cm attributes referencing it.
 * That orphaned record is invalid per the OpenXML spec; Excel repairs it on
 * every open and shows a repair dialog.
 *
 * Fix: synchronously rebuild the ZIP replacing xl/metadata.xml with an empty
 * valid document.  Uses ZIP stored mode (method=0) so NO async compression
 * stream is needed — the patch completes in microseconds with no I/O.
 */

// ─── CRC-32 ──────────────────────────────────────────────────────────────────

const _crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = (c >>> 8) ^ _crcTable[(c ^ b) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

// ─── ZIP helpers ─────────────────────────────────────────────────────────────

function ru16(dv: DataView, o: number) { return dv.getUint16(o, true); }
function ru32(dv: DataView, o: number) { return dv.getUint32(o, true); }

function buildLocalHeader(
  name: Uint8Array, method: number, crc: number,
  cSize: number, uSize: number, dosTime: number, dosDate: number,
): Uint8Array {
  const h = new Uint8Array(30 + name.length);
  const dv = new DataView(h.buffer);
  dv.setUint32(0,  0x04034b50, true);
  dv.setUint16(4,  20,         true);
  dv.setUint16(6,  0,          true);
  dv.setUint16(8,  method,     true);
  dv.setUint16(10, dosTime,    true);
  dv.setUint16(12, dosDate,    true);
  dv.setUint32(14, crc,        true);
  dv.setUint32(18, cSize,      true);
  dv.setUint32(22, uSize,      true);
  dv.setUint16(26, name.length,true);
  dv.setUint16(28, 0,          true);
  h.set(name, 30);
  return h;
}

function buildCentralDirEntry(
  name: Uint8Array, method: number, crc: number,
  cSize: number, uSize: number, localOffset: number,
  dosTime: number, dosDate: number,
): Uint8Array {
  const h = new Uint8Array(46 + name.length);
  const dv = new DataView(h.buffer);
  dv.setUint32(0,  0x02014b50, true);
  dv.setUint16(4,  20,         true);
  dv.setUint16(6,  20,         true);
  dv.setUint16(8,  0,          true);
  dv.setUint16(10, method,     true);
  dv.setUint16(12, dosTime,    true);
  dv.setUint16(14, dosDate,    true);
  dv.setUint32(16, crc,        true);
  dv.setUint32(20, cSize,      true);
  dv.setUint32(24, uSize,      true);
  dv.setUint16(28, name.length,true);
  dv.setUint16(30, 0,          true);
  dv.setUint16(32, 0,          true);
  dv.setUint16(34, 0,          true);
  dv.setUint16(36, 0,          true);
  dv.setUint32(38, 0,          true);
  dv.setUint32(42, localOffset,true);
  h.set(name, 46);
  return h;
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * Synchronously rebuild an xlsx ZIP replacing xl/metadata.xml with an empty
 * valid document.  Uses stored (method=0) compression so no async stream APIs
 * are needed — safe in all browser environments.
 */
export function patchXlsxMetadata(input: Uint8Array): Uint8Array {
  // Empty metadata — no metadataTypes, no cellMetadata, no orphaned records.
  const EMPTY =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<metadata xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>';
  const emptyRaw = new TextEncoder().encode(EMPTY);
  const emptyCrc = crc32(emptyRaw);
  // STORED mode: compressed data == raw data, no compression library needed.
  const emptyMethod = 0;

  const dv  = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const dec = new TextDecoder();

  // ── Parse all local file entries ──────────────────────────────────────────
  interface Entry {
    nameBytes: Uint8Array;
    name:      string;
    method:    number;
    crc:       number;
    cSize:     number;
    uSize:     number;
    data:      Uint8Array;
  }
  const entries: Entry[] = [];
  let pos = 0;

  while (pos + 30 <= input.length) {
    if (ru32(dv, pos) !== 0x04034b50) break;
    const method = ru16(dv, pos + 8);
    const crc    = ru32(dv, pos + 14);
    const cSize  = ru32(dv, pos + 18);
    const uSize  = ru32(dv, pos + 22);
    const fnLen  = ru16(dv, pos + 26);
    const exLen  = ru16(dv, pos + 28);
    const nameBytes = input.slice(pos + 30, pos + 30 + fnLen);
    const name      = dec.decode(nameBytes);
    const dataOff   = pos + 30 + fnLen + exLen;
    entries.push({ nameBytes, name, method, crc, cSize, uSize, data: input.slice(dataOff, dataOff + cSize) });
    pos = dataOff + cSize;
  }

  // Nothing to patch — return unchanged.
  if (!entries.some(e => e.name === 'xl/metadata.xml')) return input;

  const now     = new Date();
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2));

  // ── Rebuild local section ─────────────────────────────────────────────────
  const localChunks: Uint8Array[] = [];
  const cdMeta: Array<{
    nameBytes: Uint8Array; method: number; crc: number;
    cSize: number; uSize: number; offset: number;
  }> = [];
  let localOffset = 0;

  for (const entry of entries) {
    let data: Uint8Array, crc: number, uSize: number, method: number;

    if (entry.name === 'xl/metadata.xml') {
      // Replace with empty stored content — synchronous, no compression needed.
      data   = emptyRaw;
      crc    = emptyCrc;
      uSize  = emptyRaw.length;
      method = emptyMethod;
    } else {
      data   = entry.data;
      crc    = entry.crc;
      uSize  = entry.uSize;
      method = entry.method;
    }

    const lh = buildLocalHeader(entry.nameBytes, method, crc, data.length, uSize, dosTime, dosDate);
    cdMeta.push({ nameBytes: entry.nameBytes, method, crc, cSize: data.length, uSize, offset: localOffset });
    localOffset += lh.length + data.length;
    localChunks.push(lh, data);
  }

  // ── Rebuild central directory ─────────────────────────────────────────────
  const cdChunks = cdMeta.map(cd =>
    buildCentralDirEntry(cd.nameBytes, cd.method, cd.crc, cd.cSize, cd.uSize, cd.offset, dosTime, dosDate),
  );

  // ── End of central directory ──────────────────────────────────────────────
  const cdSize  = cdChunks.reduce((n, c) => n + c.length, 0);
  const eocd    = new Uint8Array(22);
  const eocdDv  = new DataView(eocd.buffer);
  eocdDv.setUint32(0,  0x06054b50,    true);
  eocdDv.setUint16(4,  0,             true);
  eocdDv.setUint16(6,  0,             true);
  eocdDv.setUint16(8,  cdMeta.length, true);
  eocdDv.setUint16(10, cdMeta.length, true);
  eocdDv.setUint32(12, cdSize,        true);
  eocdDv.setUint32(16, localOffset,   true);
  eocdDv.setUint16(20, 0,             true);

  // ── Assemble ──────────────────────────────────────────────────────────────
  const all   = [...localChunks, ...cdChunks, eocd];
  const total = all.reduce((n, c) => n + c.length, 0);
  const out   = new Uint8Array(total);
  let off     = 0;
  for (const chunk of all) { out.set(chunk, off); off += chunk.length; }
  return out;
}
