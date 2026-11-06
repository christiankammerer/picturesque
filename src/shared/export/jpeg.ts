// SPDX-License-Identifier: GPL-3.0-or-later
//
// JPEG marker-segment surgery for export (EXP-02, EXP-05): drop every
// metadata segment the encoder wrote and insert exactly a JFIF header, one
// EXIF segment and the sRGB ICC profile.

import { buildExifPayload, TAG_DATE_TIME_ORIGINAL } from './exif.ts';
import { srgbIccProfile } from './srgb-icc.ts';

export interface Segment {
  /** The marker's second byte, e.g. 0xe0 for APP0. */
  marker: number;
  /** Offset of the 0xFF marker byte. */
  start: number;
  /** Offset just past the segment. */
  end: number;
  /** The payload (after the 2-byte length). */
  payload: Uint8Array;
}

export interface ParsedJpeg {
  /** Header segments between SOI and SOS, in file order. */
  segments: Segment[];
  /** Offset of the SOS marker; everything from here on is scan data. */
  scanStart: number;
}

export const SOI = 0xd8;
export const SOS = 0xda;
export const APP0 = 0xe0;
export const APP1 = 0xe1;
export const APP2 = 0xe2;
export const APP15 = 0xef;
export const COM = 0xfe;
export const DQT = 0xdb;
export const SOF0 = 0xc0;

export function parseJpeg(bytes: Uint8Array): ParsedJpeg {
  if (bytes[0] !== 0xff || bytes[1] !== SOI) throw new Error('not a JPEG (no SOI)');
  const segments: Segment[] = [];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error(`bad marker at ${i}`);
    let marker = bytes[i + 1]!;
    while (marker === 0xff) {
      // fill bytes
      i++;
      marker = bytes[i + 1]!;
    }
    if (marker === SOS) return { segments, scanStart: i };
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    const end = i + 2 + length;
    if (end > bytes.length) throw new Error('truncated JPEG segment');
    segments.push({ marker, start: i, end, payload: bytes.subarray(i + 4, end) });
    i = end;
  }
  throw new Error('no SOS marker');
}

function segment(marker: number, payload: Uint8Array): Uint8Array {
  const length = payload.length + 2;
  if (length > 0xffff) throw new Error('segment too long');
  const out = new Uint8Array(payload.length + 4);
  out[0] = 0xff;
  out[1] = marker;
  out[2] = length >> 8;
  out[3] = length & 0xff;
  out.set(payload, 4);
  return out;
}

/** JFIF 1.01, no density (aspect ratio 1:1), no thumbnail. */
function jfifPayload(): Uint8Array {
  return Uint8Array.from([0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
}

/** APP2 ICC_PROFILE payload: identifier, chunk 1 of 1, profile. */
export function iccPayload(profile: Uint8Array): Uint8Array {
  const id = new TextEncoder().encode('ICC_PROFILE\0');
  const out = new Uint8Array(id.length + 2 + profile.length);
  out.set(id, 0);
  out[id.length] = 1;
  out[id.length + 1] = 1;
  out.set(profile, id.length + 2);
  return out;
}

/**
 * Rewrite an encoder's JPEG so its metadata is exactly:
 * JFIF (APP0), EXIF with only DateTimeOriginal (APP1), the sRGB ICC profile
 * (APP2). Every other APPn and COM segment is dropped; the image data
 * (quantisation and Huffman tables, frame header, scan) is copied unchanged.
 */
export function rewriteExportMetadata(jpeg: Uint8Array, dateTimeOriginal: string): Uint8Array {
  const { segments, scanStart } = parseJpeg(jpeg);
  const parts: Uint8Array[] = [
    Uint8Array.from([0xff, SOI]),
    segment(APP0, jfifPayload()),
    segment(APP1, buildExifPayload([], [{ tag: TAG_DATE_TIME_ORIGINAL, type: 'ascii', value: dateTimeOriginal }])),
    segment(APP2, iccPayload(srgbIccProfile())),
  ];
  for (const s of segments) {
    const isApp = s.marker >= APP0 && s.marker <= APP15;
    if (isApp || s.marker === COM) continue;
    parts.push(jpeg.subarray(s.start, s.end));
  }
  parts.push(jpeg.subarray(scanStart));
  return concat(parts);
}

/** Insert an APP1 EXIF segment right after SOI (used to make test inputs). */
export function insertApp1(jpeg: Uint8Array, exifPayload: Uint8Array): Uint8Array {
  return concat([jpeg.subarray(0, 2), segment(APP1, exifPayload), jpeg.subarray(2)]);
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
