// SPDX-License-Identifier: GPL-3.0-or-later
//
// The export pipeline up to encoded bytes (EXP-01…EXP-06). It runs wherever
// OffscreenCanvas and createImageBitmap exist: an export worker in the app
// (PRF-06), or a headless Chromium page for scripts and tests. Writing the
// files is the caller's job (see src/main/export/write-files.ts).
//
// EXP-03: each Slide is rendered at 2× (scale 2160) with a margin of
// SLICE_MARGIN px on each side, then halved with Lanczos-3. That gives
// exactly the pixels of one full-canvas render and downscale, without a
// canvas wider than Chromium allows, and lets each photo be freed after its
// last Slide (PRF-02).

import { decodePhoto } from '../decode/decode.ts';
import { canvasPixelSize } from '../model/post.ts';
import { RATIO_HEIGHT, slideCountOf, type PhotoMeta, type Post } from '../model/schema.ts';
import { render, type PhotoSource } from '../render/render.ts';
import { exifDateTime } from './exif.ts';
import { rewriteExportMetadata } from './jpeg.ts';
import {
  decodeSizes,
  EXPORT_QUALITY,
  EXPORT_SCALE,
  FALLBACK_QUALITY,
  MAX_FILE_BYTES,
  photoSlideRanges,
  RENDER_SCALE,
  SLICE_MARGIN,
  SLIDE_TIME_STEP_MS,
} from './plan.ts';
import { halveLanczos } from './resample.ts';

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
  const count = slideCountOf(post.layout);
  const sizes = decodeSizes(post, input.photos);
  const ranges = photoSlideRanges(post);
  const bitmaps = new Map<string, ImageBitmap>();
  const limit = input.maxFileBytes ?? MAX_FILE_BYTES;
  const out: ExportedSlide[] = [];

  try {
    for (let i = 0; i < count; i++) {
      // PRF-02: decode the originals this Slide needs, one at a time, at their 2× size.
      for (const [photoId, [first]] of ranges) {
        if (first > i || bitmaps.has(photoId)) continue;
        check();
        const meta = input.photos[photoId]!;
        const size = sizes.get(photoId)!;
        const resize = size.width < meta.width || size.height < meta.height;
        const bytes = new Uint8Array(await (await input.readPhoto(photoId)).arrayBuffer());
        bitmaps.set(photoId, await decodePhoto(bytes, meta.ext, resize ? size : undefined));
      }
      check();

      const slice = renderSlide(post, (id) => bitmaps.get(id), i);
      for (const [photoId, [, last]] of ranges) {
        if (last === i) {
          bitmaps.get(photoId)?.close();
          bitmaps.delete(photoId);
        }
      }

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

/** EXP-03: Slide `index` at 1080 px wide: its part of the 2× render (with margins), halved with Lanczos-3. */
export function renderSlide(post: Post, photos: PhotoSource, index: number): OffscreenCanvas {
  const count = slideCountOf(post.layout);
  const fullWidth = count * RENDER_SCALE;
  const height2 = Math.round(RENDER_SCALE * RATIO_HEIGHT[post.aspectRatio]);
  const x0 = Math.max(0, index * RENDER_SCALE - SLICE_MARGIN);
  const x1 = Math.min(fullWidth, (index + 1) * RENDER_SCALE + SLICE_MARGIN);

  const strip = new OffscreenCanvas(x1 - x0, height2);
  const ctx = strip.getContext('2d', { alpha: false, colorSpace: 'srgb', willReadFrequently: true });
  if (!ctx) throw new Error('no 2D context');
  ctx.translate(-x0, 0);
  render(ctx, post, photos, {
    scale: RENDER_SCALE,
    slides: { from: Math.max(0, index - 1), to: Math.min(count - 1, index + 1) },
    emptyCells: 'background',
  });
  const pixels = halveLanczos(ctx.getImageData(0, 0, strip.width, height2).data, strip.width, height2, {
    offsetX: index * RENDER_SCALE - x0,
    outWidth: EXPORT_SCALE,
  });
  return toCanvas(pixels, EXPORT_SCALE, height2 / 2);
}

/**
 * The reference for EXP-03's check: the whole canvas rendered once at 2×
 * and halved. Only for Posts narrow enough to fit one canvas (tests).
 */
export function renderFullDownscaled(post: Post, photos: PhotoSource): OffscreenCanvas {
  const { width, height } = canvasPixelSize(post, RENDER_SCALE);
  const full = new OffscreenCanvas(width, height);
  const ctx = full.getContext('2d', { alpha: false, colorSpace: 'srgb', willReadFrequently: true });
  if (!ctx) throw new Error('no 2D context');
  render(ctx, post, photos, { scale: RENDER_SCALE, emptyCells: 'background' });
  return toCanvas(halveLanczos(ctx.getImageData(0, 0, width, height).data, width, height), width / 2, height / 2);
}

function toCanvas(pixels: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' });
  if (!ctx) throw new Error('no 2D context');
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas;
}

/** EXP-02: baseline JPEG at a quality, with the sRGB profile and only DateTimeOriginal. */
export async function encode(canvas: OffscreenCanvas, quality: number, dateTimeOriginal: string): Promise<Uint8Array> {
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return rewriteExportMetadata(new Uint8Array(await blob.arrayBuffer()), dateTimeOriginal);
}
