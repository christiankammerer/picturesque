// SPDX-License-Identifier: GPL-3.0-or-later
//
// Import rules that don't need a decoder: capture date, oriented size,
// preview size and the Project limits (PRF-01, PRF-05).

import type { ExifInfo } from './exif-read.ts';
import type { HeaderInfo, PhotoFormat } from './formats.ts';

/** PRF-05: a Project holds at most 100 photos. */
export const MAX_PHOTOS = 100;
/** PRF-05: a photo larger than 100 megapixels is refused. */
export const MAX_PIXELS = 100_000_000;
/** PRF-01: preview copies have a 2048 px long edge. */
export const PREVIEW_LONG_EDGE = 2048;

/**
 * The capture date as ISO 8601: EXIF DateTimeOriginal (with its offset when
 * the file has one, else as local time), or the file's modification time.
 */
export function captureDate(exif: ExifInfo, lastModified: number): string {
  const m = exif.dateTimeOriginal?.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m && m[1] !== '0000') {
    const local = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
    const offset = exif.offsetTimeOriginal?.match(/^[+-]\d{2}:\d{2}$/) ? exif.offsetTimeOriginal : '';
    return local + offset;
  }
  return new Date(lastModified).toISOString();
}

/**
 * Whether the photo's stored orientation turns it by a quarter (so width and
 * height swap). This must match what the decoders do, since the renderer
 * draws the decoded bitmap: HEIC follows its irot box (libheif applies it);
 * Chromium applies EXIF orientation to JPEG and PNG but not to WebP.
 * tests/browser/decode.test.ts checks this against the real decoders.
 */
export function swapsAxes(format: PhotoFormat, header: HeaderInfo, exif: ExifInfo): boolean {
  switch (format) {
    case 'heic':
      return header.heifRotation === 1 || header.heifRotation === 3;
    case 'webp':
      return false;
    default:
      return (exif.orientation ?? 1) >= 5 && (exif.orientation ?? 1) <= 8;
  }
}

/** The pixel size after orientation, as PhotoMeta stores it. */
export function orientedSize(format: PhotoFormat, header: HeaderInfo, exif: ExifInfo): { width: number; height: number } {
  return swapsAxes(format, header, exif)
    ? { width: header.height, height: header.width }
    : { width: header.width, height: header.height };
}

/** PRF-01: the preview copy's size, never larger than the photo. */
export function previewSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, PREVIEW_LONG_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
