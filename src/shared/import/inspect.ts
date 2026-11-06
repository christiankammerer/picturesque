// SPDX-License-Identifier: GPL-3.0-or-later
//
// The first step of importing a photo: identify it without decoding it.
// Hashes it (the photoId, EDT-08), checks the format (OVR-04) and size
// (PRF-05), and reads its capture date and oriented size for PhotoMeta.

import type { PhotoMeta } from '../model/schema.ts';
import { parseExif } from './exif-read.ts';
import { detectFormat, readHeader } from './formats.ts';
import { captureDate, MAX_PIXELS, orientedSize } from './photo-info.ts';

export type RefusalReason = 'unsupported' | 'tooLarge' | 'unreadable';

export type InspectResult =
  | { ok: true; meta: PhotoMeta }
  | { ok: false; reason: RefusalReason; name: string };

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function inspectPhoto(bytes: Uint8Array<ArrayBuffer>, name: string, lastModified: number): Promise<InspectResult> {
  const format = detectFormat(bytes);
  if (!format) return { ok: false, reason: 'unsupported', name };
  let header;
  try {
    header = readHeader(bytes, format);
  } catch {
    return { ok: false, reason: 'unreadable', name };
  }
  if (header.width * header.height > MAX_PIXELS) return { ok: false, reason: 'tooLarge', name };
  const exif = header.exif ? parseExif(header.exif) : {};
  const { width, height } = orientedSize(format, header, exif);
  const id = await sha256Hex(bytes);
  return {
    ok: true,
    meta: { id, ext: format, originalName: name, captureDate: captureDate(exif, lastModified), width, height },
  };
}
