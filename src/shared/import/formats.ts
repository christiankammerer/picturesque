// SPDX-License-Identifier: GPL-3.0-or-later
//
// Reading photo files without decoding them: the format (from the bytes,
// not the file name; OVR-04), the stored pixel size (for the 100 MP limit,
// PRF-05) and the EXIF block (for capture date and orientation).

import type { PhotoMeta } from '../model/schema.ts';

export type PhotoFormat = PhotoMeta['ext'];

export const MIME_TYPES: Record<PhotoFormat, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

/** HEIF brands that mean HEVC-coded images (HEIC). AVIF ("avif", "avis") is not accepted. */
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs']);
const HEIF_GENERIC_BRANDS = new Set(['mif1', 'msf1']);

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const u16be = (b: Uint8Array, at: number) => (b[at]! << 8) | b[at + 1]!;
const u32be = (b: Uint8Array, at: number) => ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
const u16le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u24le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);
const u32le = (b: Uint8Array, at: number) => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

/** The photo format from the file's first bytes, or null if it isn't accepted. */
export function detectFormat(b: Uint8Array): PhotoFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 8 && ascii(b, 0, 8) === '\x89PNG\r\n\x1a\n') return 'png';
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  if (b.length >= 16 && ascii(b, 4, 4) === 'ftyp') {
    const size = u32be(b, 0);
    const major = ascii(b, 8, 4);
    const brands = [major];
    for (let at = 16; at + 4 <= Math.min(size, b.length); at += 4) brands.push(ascii(b, at, 4));
    if (brands.some((x) => x === 'avif' || x === 'avis') && !HEIC_BRANDS.has(major)) return null;
    if (HEIC_BRANDS.has(major)) return 'heic';
    if (HEIF_GENERIC_BRANDS.has(major) && brands.some((x) => HEIC_BRANDS.has(x))) return 'heic';
  }
  return null;
}

export interface HeaderInfo {
  /** Stored pixel size, before any orientation is applied. */
  width: number;
  height: number;
  /** The raw TIFF block of the EXIF data, if any. */
  exif?: Uint8Array;
  /** HEIC only: the primary image's irot (quarter turns, anti-clockwise) and imir. */
  heifRotation?: 0 | 1 | 2 | 3;
  heifMirror?: boolean;
  /** HEIC only: the primary image's colr property. */
  heifColour?: { type: 'nclx'; primaries: number; transfer: number } | { type: 'icc'; profile: Uint8Array };
}

/** Reads the pixel size and EXIF block from a photo's header. Throws on a malformed file. */
export function readHeader(b: Uint8Array, format: PhotoFormat): HeaderInfo {
  switch (format) {
    case 'jpg': return readJpeg(b);
    case 'png': return readPng(b);
    case 'webp': return readWebp(b);
    case 'heic': return readHeif(b);
  }
}

function readJpeg(b: Uint8Array): HeaderInfo {
  let i = 2;
  let exif: Uint8Array | undefined;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error('malformed JPEG');
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = u16be(b, i + 2);
    const seg = i + 4;
    if (marker === 0xe1 && !exif && ascii(b, seg, 6) === 'Exif\0\0') exif = b.subarray(seg + 6, i + 2 + len);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: u16be(b, seg + 1), width: u16be(b, seg + 3), exif };
    if (marker === 0xda || marker === 0xd9) break;
    i += 2 + len;
  }
  throw new Error('JPEG has no frame header');
}

function readPng(b: Uint8Array): HeaderInfo {
  if (ascii(b, 12, 4) !== 'IHDR') throw new Error('PNG has no IHDR');
  const info: HeaderInfo = { width: u32be(b, 16), height: u32be(b, 20) };
  for (let i = 8; i + 12 <= b.length; ) {
    const len = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    if (type === 'eXIf') info.exif = stripExifPrefix(b.subarray(i + 8, i + 8 + len));
    if (type === 'IDAT' || type === 'IEND') break;
    i += 12 + len;
  }
  return info;
}

function readWebp(b: Uint8Array): HeaderInfo {
  let width = 0;
  let height = 0;
  let exif: Uint8Array | undefined;
  for (let i = 12; i + 8 <= b.length; ) {
    const type = ascii(b, i, 4);
    const len = u32le(b, i + 4);
    const d = i + 8;
    if (type === 'VP8X') {
      width = u24le(b, d + 4) + 1;
      height = u24le(b, d + 7) + 1;
    } else if (type === 'VP8 ' && !width) {
      if (b[d + 3] !== 0x9d || b[d + 4] !== 0x01 || b[d + 5] !== 0x2a) throw new Error('malformed WebP');
      width = u16le(b, d + 6) & 0x3fff;
      height = u16le(b, d + 8) & 0x3fff;
    } else if (type === 'VP8L' && !width) {
      if (b[d] !== 0x2f) throw new Error('malformed WebP');
      const bits = u32le(b, d + 1);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    } else if (type === 'EXIF') {
      exif = stripExifPrefix(b.subarray(d, d + len));
    }
    i = d + len + (len & 1);
  }
  if (!width || !height) throw new Error('WebP has no image header');
  return { width, height, exif };
}

/** Some writers put "Exif\0\0" in front of the TIFF block inside PNG and WebP. */
function stripExifPrefix(b: Uint8Array): Uint8Array {
  return ascii(b, 0, 6) === 'Exif\0\0' ? b.subarray(6) : b;
}

// ---------- HEIF (ISO BMFF) ----------

interface Box {
  type: string;
  start: number; // payload start
  end: number;
}

function boxes(b: Uint8Array, start: number, end: number): Box[] {
  const out: Box[] = [];
  let i = start;
  while (i + 8 <= end) {
    let size = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    let header = 8;
    if (size === 1) {
      const hi = u32be(b, i + 8);
      size = hi * 2 ** 32 + u32be(b, i + 12);
      header = 16;
    } else if (size === 0) {
      size = end - i;
    }
    if (size < header || i + size > end) throw new Error('malformed HEIF box');
    out.push({ type, start: i + header, end: i + size });
    i += size;
  }
  return out;
}

const child = (b: Uint8Array, box: Box, type: string, fullBox: boolean) =>
  boxes(b, box.start + (fullBox ? 4 : 0), box.end).find((x) => x.type === type);

function readUint(b: Uint8Array, at: number, size: number): number {
  let v = 0;
  for (let k = 0; k < size; k++) v = v * 256 + b[at + k]!;
  return v;
}

function readHeif(b: Uint8Array): HeaderInfo {
  const meta = boxes(b, 0, b.length).find((x) => x.type === 'meta');
  if (!meta) throw new Error('HEIF has no meta box');

  const pitm = child(b, meta, 'pitm', true);
  if (!pitm) throw new Error('HEIF has no primary item');
  const primary = b[pitm.start] === 0 ? u16be(b, pitm.start + 4) : u32be(b, pitm.start + 4);

  // Item types (to find the Exif item).
  const itemTypes = new Map<number, string>();
  const iinf = child(b, meta, 'iinf', true);
  if (iinf) {
    const v = b[iinf.start]!;
    for (const infe of boxes(b, iinf.start + 4 + (v === 0 ? 2 : 4), iinf.end)) {
      if (infe.type !== 'infe') continue;
      const iv = b[infe.start]!;
      if (iv < 2) continue;
      const id = iv === 2 ? u16be(b, infe.start + 4) : u32be(b, infe.start + 4);
      const typeAt = infe.start + 4 + (iv === 2 ? 2 : 4) + 2;
      itemTypes.set(id, ascii(b, typeAt, 4));
    }
  }

  // Properties of the primary item: ispe (size), irot, imir.
  const iprp = child(b, meta, 'iprp', true);
  const ipco = iprp && child(b, iprp, 'ipco', false);
  const ipma = iprp && child(b, iprp, 'ipma', false);
  if (!ipco || !ipma) throw new Error('HEIF has no item properties');
  const props = boxes(b, ipco.start, ipco.end);
  const assoc: number[] = [];
  {
    const v = b[ipma.start]!;
    const flags = u32be(b, ipma.start) & 0xffffff;
    let i = ipma.start + 4;
    const count = u32be(b, i);
    i += 4;
    for (let n = 0; n < count; n++) {
      const id = v < 1 ? u16be(b, i) : u32be(b, i);
      i += v < 1 ? 2 : 4;
      const k = b[i++]!;
      for (let a = 0; a < k; a++) {
        const index = flags & 1 ? u16be(b, i) & 0x7fff : b[i]! & 0x7f;
        i += flags & 1 ? 2 : 1;
        if (id === primary) assoc.push(index);
      }
    }
  }
  const info: HeaderInfo = { width: 0, height: 0, heifRotation: 0, heifMirror: false };
  for (const index of assoc) {
    const p = props[index - 1];
    if (!p) continue;
    if (p.type === 'ispe') {
      info.width = u32be(b, p.start + 4);
      info.height = u32be(b, p.start + 8);
    } else if (p.type === 'irot') {
      info.heifRotation = (b[p.start]! & 3) as 0 | 1 | 2 | 3;
    } else if (p.type === 'imir') {
      info.heifMirror = true;
    } else if (p.type === 'colr' && !info.heifColour) {
      const kind = ascii(b, p.start, 4);
      if (kind === 'nclx') info.heifColour = { type: 'nclx', primaries: u16be(b, p.start + 4), transfer: u16be(b, p.start + 6) };
      else if (kind === 'prof' || kind === 'rICC') info.heifColour = { type: 'icc', profile: b.subarray(p.start + 4, p.end) };
    }
  }
  if (!info.width || !info.height) throw new Error('HEIF primary image has no size');

  // The Exif item's bytes, via iloc.
  const exifId = [...itemTypes].find(([, t]) => t === 'Exif')?.[0];
  const iloc = child(b, meta, 'iloc', true);
  if (exifId !== undefined && iloc) {
    const data = itemData(b, meta, iloc, exifId);
    if (data && data.length > 4) {
      const offset = u32be(data, 0);
      info.exif = data.subarray(4 + offset);
    }
  }
  return info;
}

function itemData(b: Uint8Array, meta: Box, iloc: Box, itemId: number): Uint8Array | undefined {
  const v = b[iloc.start]!;
  let i = iloc.start + 4;
  const offsetSize = b[i]! >> 4;
  const lengthSize = b[i]! & 15;
  const baseOffsetSize = b[i + 1]! >> 4;
  const indexSize = v === 1 || v === 2 ? b[i + 1]! & 15 : 0;
  i += 2;
  const count = v < 2 ? u16be(b, i) : u32be(b, i);
  i += v < 2 ? 2 : 4;
  for (let n = 0; n < count; n++) {
    const id = v < 2 ? u16be(b, i) : u32be(b, i);
    i += v < 2 ? 2 : 4;
    let method = 0;
    if (v === 1 || v === 2) {
      method = u16be(b, i) & 15;
      i += 2;
    }
    i += 2; // data_reference_index
    const base = readUint(b, i, baseOffsetSize);
    i += baseOffsetSize;
    const extents = u16be(b, i);
    i += 2;
    const parts: Uint8Array[] = [];
    for (let e = 0; e < extents; e++) {
      i += indexSize;
      const off = readUint(b, i, offsetSize);
      i += offsetSize;
      const len = readUint(b, i, lengthSize);
      i += lengthSize;
      if (id !== itemId) continue;
      let start = base + off;
      if (method === 1) {
        const idat = child(b, meta, 'idat', true);
        if (!idat) return undefined;
        start += idat.start;
      } else if (method !== 0) {
        return undefined;
      }
      parts.push(b.subarray(start, start + (len || b.length - start)));
    }
    if (id === itemId) {
      if (parts.length === 1) return parts[0];
      const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
      let o = 0;
      for (const p of parts) {
        out.set(p, o);
        o += p.length;
      }
      return out;
    }
  }
  return undefined;
}
