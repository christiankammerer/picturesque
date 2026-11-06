// SPDX-License-Identifier: GPL-3.0-or-later
//
// Test-only JPEG inspection: segments, EXIF tags, quality estimate.

import { APP1, APP2, DQT, parseJpeg } from '../../src/shared/export/jpeg.ts';

export function markers(bytes: Uint8Array): number[] {
  return parseJpeg(bytes).segments.map((s) => s.marker);
}

/** Baseline: a SOF0 frame and no progressive or extended frame. */
export function isBaseline(bytes: Uint8Array): boolean {
  const m = markers(bytes);
  return m.includes(0xc0) && !m.some((x) => x >= 0xc1 && x <= 0xcf && x !== 0xc4 && x !== 0xc8 && x !== 0xcc);
}

export interface ExifTag {
  ifd: 'ifd0' | 'exif' | 'gps' | 'interop';
  tag: number;
  value: string | number;
}

/** All tags of every APP1 EXIF segment. */
export function exifTags(bytes: Uint8Array): ExifTag[] {
  const out: ExifTag[] = [];
  for (const seg of parseJpeg(bytes).segments) {
    if (seg.marker !== APP1) continue;
    const p = seg.payload;
    if (String.fromCharCode(...p.subarray(0, 4)) !== 'Exif') continue;
    const t = p.subarray(6);
    const le = t[0] === 0x49;
    const u16 = (o: number) => (le ? t[o]! | (t[o + 1]! << 8) : (t[o]! << 8) | t[o + 1]!);
    const u32 = (o: number) =>
      le
        ? (t[o]! | (t[o + 1]! << 8) | (t[o + 2]! << 16) | (t[o + 3]! << 24)) >>> 0
        : ((t[o]! << 24) | (t[o + 1]! << 16) | (t[o + 2]! << 8) | t[o + 3]!) >>> 0;
    const readIfd = (offset: number, ifd: ExifTag['ifd']) => {
      const n = u16(offset);
      for (let i = 0; i < n; i++) {
        const e = offset + 2 + i * 12;
        const tag = u16(e);
        const type = u16(e + 2);
        const count = u32(e + 4);
        let value: string | number;
        if (type === 2) {
          const at = count <= 4 ? e + 8 : u32(e + 8);
          value = String.fromCharCode(...t.subarray(at, at + count)).replace(/\0+$/, '');
        } else if (type === 3) value = u16(e + 8);
        else value = u32(e + 8);
        if (tag === 0x8769) readIfd(value as number, 'exif');
        else if (tag === 0x8825) readIfd(value as number, 'gps');
        else if (tag === 0xa005) readIfd(value as number, 'interop');
        else out.push({ ifd, tag, value });
      }
    };
    readIfd(u32(4), 'ifd0');
  }
  return out;
}

/** The embedded ICC profile (all APP2 ICC_PROFILE chunks joined), or undefined. */
export function iccProfile(bytes: Uint8Array): Uint8Array | undefined {
  const chunks = parseJpeg(bytes)
    .segments.filter((s) => s.marker === APP2 && String.fromCharCode(...s.payload.subarray(0, 11)) === 'ICC_PROFILE')
    .map((s) => s.payload.subarray(14));
  if (chunks.length === 0) return undefined;
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** The ICC profile's description string (v2 'desc' tag). */
export function iccDescription(profile: Uint8Array): string {
  const v = new DataView(profile.buffer, profile.byteOffset, profile.byteLength);
  const count = v.getUint32(128);
  for (let i = 0; i < count; i++) {
    const sig = String.fromCharCode(...profile.subarray(132 + i * 12, 136 + i * 12));
    if (sig !== 'desc') continue;
    const off = v.getUint32(136 + i * 12);
    const len = v.getUint32(off + 8);
    return String.fromCharCode(...profile.subarray(off + 12, off + 12 + len)).replace(/\0+$/, '');
  }
  return '';
}

// IJG standard luminance quantisation table, natural order.
const STD_LUMA = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51,
  87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103, 99,
];
const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47,
  55, 62, 63,
];

/** The luminance table (table 0) as stored, i.e. in zigzag order. */
export function lumaTable(bytes: Uint8Array): number[] {
  for (const seg of parseJpeg(bytes).segments) {
    if (seg.marker !== DQT) continue;
    let i = 0;
    while (i < seg.payload.length) {
      const pq = seg.payload[i]! >> 4;
      const tq = seg.payload[i]! & 0x0f;
      const size = pq ? 128 : 64;
      const vals: number[] = [];
      for (let k = 0; k < 64; k++) vals.push(pq ? (seg.payload[i + 1 + 2 * k]! << 8) | seg.payload[i + 2 + 2 * k]! : seg.payload[i + 1 + k]!);
      if (tq === 0) return vals;
      i += 1 + size;
    }
  }
  throw new Error('no luminance table');
}

/** IJG quality (1..100) whose scaled standard table best matches the file's. */
export function estimateQuality(bytes: Uint8Array): number {
  const table = lumaTable(bytes);
  let best = 0;
  let bestErr = Infinity;
  for (let q = 1; q <= 100; q++) {
    const scale = q < 50 ? 5000 / q : 200 - 2 * q;
    let err = 0;
    for (let k = 0; k < 64; k++) {
      const expected = Math.min(255, Math.max(1, Math.floor((STD_LUMA[ZIGZAG[k]!]! * scale + 50) / 100)));
      err += Math.abs(expected - table[k]!);
    }
    if (err < bestErr) {
      bestErr = err;
      best = q;
    }
  }
  return best;
}
