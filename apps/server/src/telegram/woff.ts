// WOFF 1.0 to a plain SFNT (TTF/OTF) in memory, so the card renderer can use the same
// fontsource faces as the website (resvg reads TTF/OTF, not WOFF). WOFF 1.0 is the SFNT
// tables, each zlib-compressed when that is smaller (W3C WOFF 1.0, section 5).
import { inflateSync } from "node:zlib";

export function woffToSfnt(woff: Uint8Array): Uint8Array {
  const v = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  if (v.getUint32(0) !== 0x774f4646) throw new Error("not a WOFF 1.0 file");
  const flavor = v.getUint32(4);
  const numTables = v.getUint16(12);
  const tables: { tag: number; checksum: number; data: Uint8Array }[] = [];
  for (let i = 0; i < numTables; i++) {
    const at = 44 + i * 20;
    const tag = v.getUint32(at);
    const offset = v.getUint32(at + 4);
    const compLength = v.getUint32(at + 8);
    const origLength = v.getUint32(at + 12);
    const checksum = v.getUint32(at + 16);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? new Uint8Array(inflateSync(raw)) : raw;
    if (data.length !== origLength) throw new Error("WOFF table length mismatch");
    tables.push({ tag, checksum, data });
  }
  // SFNT header plus a 16-byte record per table, each table padded to 4 bytes.
  const pad = (n: number) => (n + 3) & ~3;
  let size = 12 + numTables * 16;
  for (const t of tables) size += pad(t.data.length);
  const out = new Uint8Array(size);
  const o = new DataView(out.buffer);
  let pow = 1;
  let log = 0;
  while (pow * 2 <= numTables) {
    pow *= 2;
    log++;
  }
  o.setUint32(0, flavor);
  o.setUint16(4, numTables);
  o.setUint16(6, pow * 16);
  o.setUint16(8, log);
  o.setUint16(10, numTables * 16 - pow * 16);
  let offset = 12 + numTables * 16;
  tables.forEach((t, i) => {
    const at = 12 + i * 16;
    o.setUint32(at, t.tag);
    o.setUint32(at + 4, t.checksum);
    o.setUint32(at + 8, offset);
    o.setUint32(at + 12, t.data.length);
    out.set(t.data, offset);
    offset += pad(t.data.length);
  });
  return out;
}
