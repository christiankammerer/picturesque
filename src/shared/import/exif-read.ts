// SPDX-License-Identifier: GPL-3.0-or-later
//
// Reads the few EXIF tags import needs from a TIFF block.

export interface ExifInfo {
  /** 1..8, as in the TIFF spec. */
  orientation?: number;
  /** "YYYY:MM:DD HH:MM:SS". */
  dateTimeOriginal?: string;
  /** "+HH:MM" or "-HH:MM". */
  offsetTimeOriginal?: string;
}

const TAG_ORIENTATION = 0x0112;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;

/** Parses a TIFF block. Malformed data yields whatever could be read, never a throw. */
export function parseExif(t: Uint8Array): ExifInfo {
  const info: ExifInfo = {};
  try {
    const le = t[0] === 0x49 && t[1] === 0x49;
    if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return info;
    const u16 = (o: number) => {
      if (o + 2 > t.length) throw new RangeError('EXIF out of range');
      return le ? t[o]! | (t[o + 1]! << 8) : (t[o]! << 8) | t[o + 1]!;
    };
    const u32 = (o: number) => {
      if (o + 4 > t.length) throw new RangeError('EXIF out of range');
      return le
        ? (t[o]! | (t[o + 1]! << 8) | (t[o + 2]! << 16) | (t[o + 3]! << 24)) >>> 0
        : ((t[o]! << 24) | (t[o + 1]! << 16) | (t[o + 2]! << 8) | t[o + 3]!) >>> 0;
    };
    const ascii = (entry: number) => {
      const count = u32(entry + 4);
      const at = count <= 4 ? entry + 8 : u32(entry + 8);
      if (at + count > t.length) throw new RangeError('EXIF out of range');
      return String.fromCharCode(...t.subarray(at, at + count)).replace(/\0+$/, '').trim();
    };
    const visit = (offset: number, depth: number) => {
      if (depth > 2) return;
      const n = u16(offset);
      for (let k = 0; k < n; k++) {
        const e = offset + 2 + k * 12;
        const tag = u16(e);
        if (tag === TAG_ORIENTATION) info.orientation = u16(e + 8);
        else if (tag === TAG_DATE_TIME_ORIGINAL) info.dateTimeOriginal = ascii(e);
        else if (tag === TAG_OFFSET_TIME_ORIGINAL) info.offsetTimeOriginal = ascii(e);
        else if (tag === TAG_EXIF_IFD) visit(u32(e + 8), depth + 1);
      }
    };
    visit(u32(4), 0);
  } catch {
    // Keep what was read before the damage.
  }
  return info;
}
