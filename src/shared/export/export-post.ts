// SPDX-License-Identifier: GPL-3.0-or-later
//
// The export pipeline up to encoded bytes (EXP-01…EXP-06). It runs wherever
// OffscreenCanvas and createImageBitmap exist: an export worker in the app
// (PRF-06), or a headless Chromium page for scripts and tests. Writing the
// files is the caller's job (see src/main/export/write-files.ts).

import { canvasPixelSize } from '../model/post.ts';
import { slideCountOf, type PhotoMeta, type Post } from '../model/schema.ts';
import { render, type PhotoSource } from '../render/render.ts';
import { exifDateTime } from './exif.ts';
import { rewriteExportMetadata } from './jpeg.ts';
import {
  decodeSizes,
  EXPORT_QUALITY,
  EXPORT_SCALE,
  FALLBACK_QUALITY,
  MAX_FILE_BYTES,
  SLIDE_TIME_STEP_MS,
} from './plan.ts';

export interface ExportInput {
  post: Post;
  photos: Record<string, PhotoMeta>;
  /** The original bytes of a photo (EXP-04: never a preview copy). */
  readPhoto: (photoId: string) => Promise<Blob>;
  /** Export start time, ms since the epoch (EXP-05). */
  startTime: number;
  signal?: AbortSignal;
  /** Called after each Slide is encoded. */
  onProgress?: (done: number, total: number) => void;
  /** EXP-06 threshold; tests lower it. Default MAX_FILE_BYTES. */
  maxFileBytes?: number;
}

export interface ExportedSlide {
  index: number;
  bytes: Uint8Array;
  /** EXP-05: Slide i is stamped startTime + i seconds, as DateTimeOriginal and mtime. */
  time: number;
  /** EXP-06: the file was re-encoded at quality 90 to stay under 8 MB. */
  reencoded: boolean;
}

export class ExportCancelled extends Error {
  constructor() {
    super('export cancelled');
    this.name = 'ExportCancelled';
  }
}

export async function exportPost(input: ExportInput): Promise<ExportedSlide[]> {
  const { post, signal } = input;
  const check = () => {
    if (signal?.aborted) throw new ExportCancelled();
  };

  // Decode every placed photo from its original, at the size its Cell needs.
  const bitmaps = new Map<string, ImageBitmap>();
  try {
    for (const [photoId, size] of decodeSizes(post, input.photos)) {
      check();
      const blob = await input.readPhoto(photoId);
      const meta = input.photos[photoId]!;
      const resize = size.width < meta.width || size.height < meta.height;
      const bitmap = await createImageBitmap(blob, {
        imageOrientation: 'from-image',
        colorSpaceConversion: 'default',
        ...(resize ? { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' as const } : {}),
      });
      bitmaps.set(photoId, bitmap);
    }
    check();

    // EXP-03: one render of the whole canvas…
    const full = renderFull(post, (id) => bitmaps.get(id));
    for (const b of bitmaps.values()) b.close();
    bitmaps.clear();

    // …sliced at the exact Slide edges.
    const count = slideCountOf(post.layout);
    const limit = input.maxFileBytes ?? MAX_FILE_BYTES;
    const out: ExportedSlide[] = [];
    for (let i = 0; i < count; i++) {
      check();
      const slice = sliceSlide(full, i);
      const time = input.startTime + i * SLIDE_TIME_STEP_MS;
      const stamp = exifDateTime(new Date(time));
      let bytes = await encode(slice, EXPORT_QUALITY, stamp);
      let reencoded = false;
      if (bytes.length >= limit) {
        bytes = await encode(slice, FALLBACK_QUALITY, stamp);
        reencoded = true;
      }
      out.push({ index: i, bytes, time, reencoded });
      input.onProgress?.(i + 1, count);
    }
    return out;
  } finally {
    for (const b of bitmaps.values()) b.close();
  }
}

/** EXP-03: render the whole canvas once, at scale 1080, empty Cells as background. */
export function renderFull(post: Post, photos: PhotoSource): OffscreenCanvas {
  const { width, height } = canvasPixelSize(post, EXPORT_SCALE);
  const full = new OffscreenCanvas(width, height);
  const ctx = full.getContext('2d', { alpha: false, colorSpace: 'srgb' });
  if (!ctx) throw new Error('no 2D context');
  render(ctx, post, photos, { scale: EXPORT_SCALE, emptyCells: 'background' });
  return full;
}

/** EXP-03 / RND-04: Slide i is the exact pixel columns i × 1080 … (i + 1) × 1080 − 1,
 *  copied without resampling. */
export function sliceSlide(full: OffscreenCanvas, index: number): OffscreenCanvas {
  const ctx = full.getContext('2d');
  const slice = new OffscreenCanvas(EXPORT_SCALE, full.height);
  const sctx = slice.getContext('2d', { alpha: false, colorSpace: 'srgb' });
  if (!ctx || !sctx) throw new Error('no 2D context');
  sctx.putImageData(ctx.getImageData(index * EXPORT_SCALE, 0, EXPORT_SCALE, full.height), 0, 0);
  return slice;
}

/** EXP-02: baseline JPEG at a quality, with the sRGB profile and only DateTimeOriginal. */
export async function encode(canvas: OffscreenCanvas, quality: number, dateTimeOriginal: string): Promise<Uint8Array> {
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return rewriteExportMetadata(new Uint8Array(await blob.arrayBuffer()), dateTimeOriginal);
}
