// SPDX-License-Identifier: GPL-3.0-or-later
//
// The one way photos become bitmaps, for preview copies (PRF-01) and export
// (EXP-04) alike. Runs in workers (PRF-03) or a page. The result is upright:
// orientation is applied here, at decode, as RND-07 expects.

import { MIME_TYPES, type PhotoFormat } from '../import/formats.ts';
import { decodeHeic } from './heic.ts';

export interface DecodeSize {
  width: number;
  height: number;
}

/**
 * Decodes a photo, optionally resized with a high-quality filter to `size`
 * (in oriented pixels). Only one full-size decode is held at a time per call;
 * a HEIC's full-size pixels are dropped as soon as the resized bitmap exists.
 */
export async function decodePhoto(bytes: Uint8Array<ArrayBuffer>, format: PhotoFormat, size?: DecodeSize): Promise<ImageBitmap> {
  const resize: ImageBitmapOptions = size ? { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' } : {};
  if (format === 'heic') {
    const full = await decodeHeic(bytes);
    return createImageBitmap(full, resize);
  }
  return createImageBitmap(new Blob([bytes], { type: MIME_TYPES[format] }), {
    imageOrientation: 'from-image',
    colorSpaceConversion: 'default',
    ...resize,
  });
}
