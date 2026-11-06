// SPDX-License-Identifier: GPL-3.0-or-later
//
// A minimal EXIF (TIFF) writer: just enough for EXP-05's single
// DateTimeOriginal tag (and, in tests, an Orientation tag).

export const TAG_ORIENTATION = 0x0112;
export const TAG_EXIF_IFD_POINTER = 0x8769;
export const TAG_DATE_TIME_ORIGINAL = 0x9003;

export type ExifEntry =
  | { tag: number; type: 'ascii'; value: string }
  | { tag: number; type: 'short'; value: number };

/** EXIF date-time: "YYYY:MM:DD HH:MM:SS" in local time. */
export function exifDateTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}:${p(date.getMonth() + 1)}:${p(date.getDate())} ` +
    `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
  );
}

/**
 * The payload of an APP1 EXIF segment ("Exif\0\0" + a big-endian TIFF
 * structure) with the given IFD0 and Exif-IFD entries. The Exif IFD pointer
 * is added to IFD0 when there are Exif entries.
 */
export function buildExifPayload(ifd0: ExifEntry[], exif: ExifEntry[]): Uint8Array {
  const out: number[] = [];
  const u16 = (v: number) => out.push((v >> 8) & 0xff, v & 0xff);
  const u32 = (v: number) => out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);

  // TIFF header.
  out.push(0x4d, 0x4d); // "MM", big endian
  u16(0x2a);
  u32(8);

  const ifd0Entries = exif.length > 0 ? [...ifd0, { tag: TAG_EXIF_IFD_POINTER, type: 'long' as const }] : ifd0;
  const ifdSize = (n: number) => 2 + 12 * n + 4;
  const exifIfdOffset = 8 + ifdSize(ifd0Entries.length) + dataSize(ifd0);

  writeIfd(ifd0Entries, 8, (entry) => (entry.type === 'long' ? exifIfdOffset : undefined));
  if (exif.length > 0) writeIfd(exif, exifIfdOffset, () => undefined);

  const tiff = Uint8Array.from(out);
  const payload = new Uint8Array(6 + tiff.length);
  payload.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 0); // "Exif\0\0"
  payload.set(tiff, 6);
  return payload;

  function writeIfd(
    entries: (ExifEntry | { tag: number; type: 'long' })[],
    offset: number,
    longValue: (e: { tag: number; type: 'long' }) => number | undefined,
  ): void {
    const sorted = [...entries].sort((a, b) => a.tag - b.tag);
    let dataOffset = offset + ifdSize(sorted.length);
    const data: number[] = [];
    u16(sorted.length);
    for (const e of sorted) {
      u16(e.tag);
      if (e.type === 'ascii') {
        const bytes = [...new TextEncoder().encode(e.value), 0];
        u16(2);
        u32(bytes.length);
        if (bytes.length <= 4) {
          for (let i = 0; i < 4; i++) out.push(bytes[i] ?? 0);
        } else {
          u32(dataOffset);
          data.push(...bytes);
          if (bytes.length % 2) data.push(0); // keep word alignment
          dataOffset += bytes.length + (bytes.length % 2);
        }
      } else if (e.type === 'short') {
        u16(3);
        u32(1);
        u16(e.value);
        u16(0);
      } else {
        u16(4);
        u32(1);
        u32(longValue(e) ?? 0);
      }
    }
    u32(0); // no next IFD
    out.push(...data);
  }
}

function dataSize(entries: ExifEntry[]): number {
  let n = 0;
  for (const e of entries) {
    if (e.type === 'ascii') {
      const len = new TextEncoder().encode(e.value).length + 1;
      if (len > 4) n += len + (len % 2);
    }
  }
  return n;
}
