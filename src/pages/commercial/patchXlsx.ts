/**
 * patchXlsx.ts
 *
 * SheetJS CE 0.18.x always writes xl/metadata.xml with:
 *   <cellMetadata count="1"><bk><rc t="1" v="0"/></bk></cellMetadata>
 * but emits zero worksheet cells with vm/cm attributes referencing that record.
 * This orphaned entry is invalid per the OpenXML spec. Excel detects it and
 * shows a repair dialog on every open.
 *
 * Fix: rebuild the ZIP replacing xl/metadata.xml with an empty, valid document.
 */

// ─── CRC-32 ────────────────────────────────────────────────────────────────────

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

// ─── Deflate (raw, browser-native) ────────────────────────────────────────────

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  await writer.write(data);
  await writer.close();
  const chunks: Uint8Array[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const chunk of cs.readable as any) chunks.push(chunk as Uint8Array);
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ru16(dv: DataView, o: number) { return dv.getUint16(o, true); }
function ru32(dv: DataView, o: number) { return dv.getUint32(o, true); }

function buildLocalHeader(
  name: Uint8Array, method: number, crc: number,
  cSize: number, uSize: number, dosTime: number, dosDate: number,
): Uint8Array {
  const h = new Uint8Array(30 + name.length);
  const dv = new DataView(h.buffer);
  dv.setUint32(0,  0x04034b50, true); // local file sig
  dv.setUint16(4,  20,         true); // version needed
  dv.setUint16(6,  0,          true); // flags
  dv.setUint16(8,  method,     true); // compression
  dv.setUint16(10, dosTime,    true);
  dv.setUint16(12, dosDate,    true);
  dv.setUint32(14, crc,        true);
  dv.setUint32(18, cSize,      true); // compressed size
  dv.setUint32(22, uSize,      true); // uncompressed size
  dv.setUint16(26, name.length,true);
  dv.setUint16(28, 0,          true); // extra length
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
  dv.setUint32(0,  0x02014b50, true); // central dir sig
  dv.setUint16(4,  20,         true); // version made by
  dv.setUint16(6,  20,         true); // version needed
  dv.setUint16(8,  0,          true); // flags
  dv.setUint16(10, method,     true);
  dv.setUint16(12, dosTime,    true);
  dv.setUint16(14, dosDate,    true);
  dv.setUint32(16, crc,        true);
  dv.setUint32(20, cSize,      true);
  dv.setUint32(24, uSize,      true);
  dv.setUint16(28, name.length,true);
  dv.setUint16(30, 0,          true); // extra length
  dv.setUint16(32, 0,          true); // comment length
  dv.setUint16(34, 0,          true); // disk start
  dv.setUint16(36, 0,          true); // internal attrs
  dv.setUint32(38, 0,          true); // external attrs
  dv.setUint32(42, localOffset,true);
  h.set(name, 46);
  return h;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Replace xl/metadata.xml in an xlsx ZIP with an empty valid document.
 * Rebuilds the ZIP so all offsets remain consistent.
 */
export async function patchXlsxMetadata(input: Uint8Array): Promise<Uint8Array> {
  // The replacement: an empty metadata element — no metadataTypes, no cellMetadata.
  const EMPTY_META =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<metadata xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>';
  const emptyRaw  = new TextEncoder().encode(EMPTY_META);
  const emptyComp = await deflateRaw(emptyRaw);
  const emptyCrc  = crc32(emptyRaw);

  const dv  = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const dec = new TextDecoder();

  // ── Step 1: parse all local file entries ──────────────────────────────────
  interface Entry {
    nameBytes: Uint8Array;
    name:      string;
    method:    number;
    crc:       number;
    cSize:     number;
    uSize:     number;
    data:      Uint8Array; // compressed (or stored) bytes
  }
  const entries: Entry[] = [];
  let pos = 0;

  while (pos + 30 <= input.length) {
    if (ru32(dv, pos) !== 0x04034b50) break; // stop at non-local-header
    const method = ru16(dv, pos + 8);
    const crc    = ru32(dv, pos + 14);
    const cSize  = ru32(dv, pos + 18);
    const uSize  = ru32(dv, pos + 22);
    const fnLen  = ru16(dv, pos + 26);
    const exLen  = ru16(dv, pos + 28);
    const nameBytes = input.slice(pos + 30, pos + 30 + fnLen);
    const name   = dec.decode(nameBytes);
    const dataOff = pos + 30 + fnLen + exLen;

    entries.push({ nameBytes, name, method, crc, cSize, uSize, data: input.slice(dataOff, dataOff + cSize) });
    pos = dataOff + cSize;
  }

  // If metadata.xml is absent, return the file unchanged.
  if (!entries.some(e => e.name === 'xl/metadata.xml')) return input;

  // ── Step 2: rebuild local section ─────────────────────────────────────────
  const now     = new Date();
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2));

  const localChunks: Uint8Array[] = [];
  const cdMeta: Array<{ nameBytes: Uint8Array; method: number; crc: number; cSize: number; uSize: number; offset: number }> = [];
  let localOffset = 0;

  for (const entry of entries) {
    let comp: Uint8Array, crc: number, uSize: number, method: number;

    if (entry.name === 'xl/metadata.xml') {
      comp   = emptyComp;
      crc    = emptyCrc;
      uSize  = emptyRaw.length;
      method = 8; // deflate
    } else {
      comp   = entry.data;
      crc    = entry.crc;
      uSize  = entry.uSize;
      method = entry.method;
    }

    const lh = buildLocalHeader(entry.nameBytes, method, crc, comp.length, uSize, dosTime, dosDate);
    cdMeta.push({ nameBytes: entry.nameBytes, method, crc, cSize: comp.length, uSize, offset: localOffset });
    localOffset += lh.length + comp.length;
    localChunks.push(lh, comp);
  }

  // ── Step 3: rebuild central directory ─────────────────────────────────────
  const cdChunks: Uint8Array[] = [];
  for (const cd of cdMeta) {
    cdChunks.push(buildCentralDirEntry(
      cd.nameBytes, cd.method, cd.crc, cd.cSize, cd.uSize, cd.offset, dosTime, dosDate,
    ));
  }

  // ── Step 4: end of central directory record ────────────────────────────────
  const cdSize  = cdChunks.reduce((n, c) => n + c.length, 0);
  const cdStart = localOffset;
  const eocd    = new Uint8Array(22);
  const eocdDv  = new DataView(eocd.buffer);
  eocdDv.setUint32(0,  0x06054b50,          true); // EOCD sig
  eocdDv.setUint16(4,  0,                   true); // disk number
  eocdDv.setUint16(6,  0,                   true); // disk with CD
  eocdDv.setUint16(8,  cdMeta.length,       true); // entries this disk
  eocdDv.setUint16(10, cdMeta.length,       true); // total entries
  eocdDv.setUint32(12, cdSize,              true); // CD size
  eocdDv.setUint32(16, cdStart,             true); // CD offset
  eocdDv.setUint16(20, 0,                   true); // comment length

  // ── Step 5: assemble ──────────────────────────────────────────────────────
  const all = [...localChunks, ...cdChunks, eocd];
  const totalSize = all.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(totalSize);
  let off = 0;
  for (const chunk of all) { out.set(chunk, off); off += chunk.length; }
  return out;
}
