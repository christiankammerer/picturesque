// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildExifPayload, exifDateTime, TAG_DATE_TIME_ORIGINAL, TAG_ORIENTATION } from '../../src/shared/export/exif.ts';
import { APP0, APP1, APP2, COM, insertApp1, rewriteExportMetadata } from '../../src/shared/export/jpeg.ts';
import { srgbIccProfile } from '../../src/shared/export/srgb-icc.ts';
import { exifTags, iccDescription, iccProfile, markers } from '../helpers/jpeg-inspect.ts';

/** A tiny but structurally complete JPEG: SOI, some APPn/COM, DQT, SOF0, SOS, scan, EOI. */
function fakeJpeg(): Uint8Array {
  const seg = (m: number, payload: number[]) => [0xff, m, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
  return Uint8Array.from([
    0xff, 0xd8,
    ...seg(APP0, [0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 1, 0, 72, 0, 72, 0, 0]),
    ...seg(APP1, [...new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0<x/>')]), // XMP
    ...seg(0xed, [...new TextEncoder().encode('Photoshop 3.0\0')]), // IPTC
    ...seg(COM, [0x68, 0x69]),
    ...seg(0xdb, [0, ...Array.from({ length: 64 }, () => 1)]),
    ...seg(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0]),
    ...seg(0xda, [1, 1, 0, 0, 63, 0]),
    0x12, 0x34, 0xff, 0x00, 0x56,
    0xff, 0xd9,
  ]);
}

describe('EXP-05 metadata', () => {
  it('formats DateTimeOriginal in local time', () => {
    expect(exifDateTime(new Date(2026, 0, 2, 3, 4, 5))).toBe('2026:01:02 03:04:05');
  });

  it('strips EXIF, XMP, IPTC and comments, keeping only DateTimeOriginal plus JFIF and ICC', () => {
    const withGps = insertApp1(fakeJpeg(), buildExifPayload([{ tag: TAG_ORIENTATION, type: 'short', value: 6 }], [
      { tag: 0x9004, type: 'ascii', value: '2020:01:01 00:00:00' },
    ]));
    const out = rewriteExportMetadata(withGps, '2026:11:06 10:00:00');
    expect(markers(out)).toEqual([APP0, APP1, APP2, 0xdb, 0xc0]);
    expect(exifTags(out)).toEqual([{ ifd: 'exif', tag: TAG_DATE_TIME_ORIGINAL, value: '2026:11:06 10:00:00' }]);
  });

  it('copies the image data unchanged', () => {
    const src = fakeJpeg();
    const out = rewriteExportMetadata(src, '2026:11:06 10:00:00');
    const tail = (b: Uint8Array) => Array.from(b.subarray(b.length - 30));
    expect(tail(out)).toEqual(tail(src));
  });
});

describe('EXP-02 sRGB profile', () => {
  it('embeds the sRGB ICC profile', () => {
    const out = rewriteExportMetadata(fakeJpeg(), '2026:11:06 10:00:00');
    const icc = iccProfile(out)!;
    expect(icc).toEqual(srgbIccProfile());
    expect(iccDescription(icc)).toBe('sRGB');
    expect(String.fromCharCode(...icc.subarray(16, 20))).toBe('RGB ');
  });
  it('the embedded bytes equal resources/icc/sRGB-v2-magic.icc', () => {
    const file = readFileSync(new URL('../../resources/icc/sRGB-v2-magic.icc', import.meta.url));
    expect(Buffer.from(srgbIccProfile()).equals(file)).toBe(true);
  });
});

describe('EXIF writer', () => {
  it('round-trips IFD0 and Exif IFD tags', () => {
    const jpeg = insertApp1(fakeJpeg(), buildExifPayload(
      [{ tag: TAG_ORIENTATION, type: 'short', value: 3 }, { tag: 0x010f, type: 'ascii', value: 'Cam' }],
      [{ tag: TAG_DATE_TIME_ORIGINAL, type: 'ascii', value: '2026:11:06 10:00:00' }],
    ));
    expect(exifTags(jpeg)).toEqual(expect.arrayContaining([
      { ifd: 'ifd0', tag: TAG_ORIENTATION, value: 3 },
      { ifd: 'ifd0', tag: 0x010f, value: 'Cam' },
      { ifd: 'exif', tag: TAG_DATE_TIME_ORIGINAL, value: '2026:11:06 10:00:00' },
    ]));
  });
});
