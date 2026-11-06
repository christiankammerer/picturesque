// SPDX-License-Identifier: GPL-3.0-or-later
//
// Export constants and the pure parts of planning an export.

import { leafRects } from '../model/geometry.ts';
import { RATIO_HEIGHT, slideCountOf, type PhotoMeta, type Post } from '../model/schema.ts';
import { drawnSize } from '../render/framing.ts';
import { innerRect } from '../render/render.ts';

/** EXP-01: every exported image is 1080 px wide. */
export const EXPORT_SCALE = 1080;
/** EXP-03: the canvas is rendered at 2× and downscaled with Lanczos-3. */
export const SUPERSAMPLE = 2;
export const RENDER_SCALE = EXPORT_SCALE * SUPERSAMPLE;
/** EXP-03: source columns rendered beyond each Slide edge, so the filter sees the same pixels as in a full render. */
export const SLICE_MARGIN = 8;
/** EXP-02: JPEG quality 92. */
export const EXPORT_QUALITY = 0.92;
/** EXP-06: files must stay under 8 MB, else they're re-encoded at quality 90. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const FALLBACK_QUALITY = 0.9;
/** EXP-05: each Slide's timestamp is 1 s after the previous one. */
export const SLIDE_TIME_STEP_MS = 1000;

/** EXP-01: the export height of a Slide. */
export function exportHeight(post: Pick<Post, 'aspectRatio'>): number {
  return Math.round(EXPORT_SCALE * RATIO_HEIGHT[post.aspectRatio]);
}

/**
 * EXP-04 / PRF-02: the size to decode each placed photo at — the size its
 * largest Cell draws it at in the 2× render, never larger than the original.
 * Sizes are in oriented pixels (after EXIF orientation), like PhotoMeta.
 */
export function decodeSizes(post: Post, photos: Record<string, PhotoMeta>): Map<string, { width: number; height: number }> {
  const s = RENDER_SCALE;
  const yScale = s * RATIO_HEIGHT[post.aspectRatio];
  const gap = post.style.gap * s;
  const factor = new Map<string, number>();
  for (const leaf of leafRects(post.layout)) {
    if (leaf.node.kind !== 'cell' || !leaf.node.photo) continue;
    const { photoId, framing } = leaf.node.photo;
    const meta = photos[photoId];
    if (!meta) throw new Error(`photo ${photoId} is not in the Project`);
    const r = innerRect(leaf, s, yScale, gap);
    if (r.w <= 0 || r.h <= 0) continue;
    const drawn = drawnSize(r, meta.width, meta.height, framing);
    const f = Math.min(1, drawn.width / meta.width);
    factor.set(photoId, Math.max(factor.get(photoId) ?? 0, f));
  }
  const out = new Map<string, { width: number; height: number }>();
  for (const [id, f] of factor) {
    const meta = photos[id]!;
    out.set(id, {
      width: Math.min(meta.width, Math.max(1, Math.ceil(meta.width * f))),
      height: Math.min(meta.height, Math.max(1, Math.ceil(meta.height * f))),
    });
  }
  return out;
}

/**
 * PRF-02: the Slides each placed photo is visible in, as [first, last],
 * counting the margin rendered around each Slide (EXP-03). A photo can be
 * freed once its last Slide is done.
 */
export function photoSlideRanges(post: Post): Map<string, [number, number]> {
  const n = slideCountOf(post.layout);
  const margin = SLICE_MARGIN / RENDER_SCALE;
  const out = new Map<string, [number, number]>();
  for (const leaf of leafRects(post.layout)) {
    if (leaf.node.kind !== 'cell' || !leaf.node.photo) continue;
    const id = leaf.node.photo.photoId;
    const first = Math.max(0, Math.floor(leaf.rect.x0 - margin));
    const last = Math.min(n - 1, Math.ceil(leaf.rect.x1 + margin) - 1);
    const prev = out.get(id);
    out.set(id, prev ? [Math.min(prev[0], first), Math.max(prev[1], last)] : [first, last]);
  }
  return out;
}
