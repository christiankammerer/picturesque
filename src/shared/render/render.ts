// SPDX-License-Identifier: GPL-3.0-or-later
//
// The one renderer (docs/spec/03-renderer.md). It draws a Post for the editor,
// the filmstrip, Template thumbnails, Preview as post and export alike.
//
// RND-01: it is pure. Output depends only on the arguments, it keeps no state
// between calls, and it restores the context's state when done.
// RND-02: it is the only code that draws Post content.

import { leafRects, type LeafRect } from '../model/geometry.ts';
import { RATIO_HEIGHT, slideCountOf, type LayoutStyle, type Post, type TextBox } from '../model/schema.ts';
import { placePhoto, type PxRect } from './framing.ts';
import { LINE_HEIGHT, wrapText } from './text.ts';

export interface RenderOptions {
  /** Pixels per Slide width. Export uses 1080. */
  scale: number;
  /** Which Slides to draw, inclusive. Default: all. Pixels outside are left untouched. */
  slides?: { from: number; to: number };
  /** Draw an empty Cell as a placeholder (editor) or as background (export). */
  emptyCells: 'placeholder' | 'background';
}

/** Source bitmaps, by photoId. The caller chooses the tier (preview copy or
 *  export decode); the renderer never decodes or fetches anything. */
export type PhotoSource = (photoId: string) => ImageBitmap | undefined;

export type RenderContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** The font used when a Text Box's font isn't available (RND-09, PRJ-12). */
export const FALLBACK_FONT_FAMILY = 'Inter';

/** Colours of the editor's empty-Cell placeholder. */
export const PLACEHOLDER_FILL = '#e6e6e6';
export const PLACEHOLDER_ICON = '#9e9e9e';

export function render(ctx: RenderContext, post: Post, photos: PhotoSource, options: RenderOptions): void {
  const s = options.scale;
  const ratio = RATIO_HEIGHT[post.aspectRatio];
  const yScale = s * ratio; // RND-03: y in Slide units → px
  const height = Math.round(s * ratio);
  const count = slideCountOf(post.layout);
  const from = clampInt(options.slides?.from ?? 0, 0, count - 1);
  const to = clampInt(options.slides?.to ?? count - 1, from, count - 1);
  const style = post.style;

  ctx.save();
  try {
    resetState(ctx);

    // Only the requested Slides are touched.
    ctx.beginPath();
    ctx.rect(from * s, 0, (to - from + 1) * s, height);
    ctx.clip();

    // 1. Background.
    ctx.fillStyle = style.background;
    ctx.fillRect(from * s, 0, (to - from + 1) * s, height);

    // 2. Leaves, in tree order.
    const gap = style.gap * s;
    for (const leaf of leafRects(post.layout)) {
      if (leaf.rect.x1 <= from || leaf.rect.x0 >= to + 1) continue;
      const inner = innerRect(leaf, s, yScale, gap);
      if (inner.w <= 0 || inner.h <= 0) continue;
      ctx.save();
      if (leaf.slide !== null) clipToSlide(ctx, leaf.slide, s, height); // RND-10
      drawLeaf(ctx, leaf, inner, style, s, photos, options.emptyCells);
      ctx.restore();
    }

    // 3. Text Boxes, in array order.
    for (const box of post.textBoxes) {
      ctx.save();
      if (post.layout.postType === 'carousel') {
        clipToSlide(ctx, clampInt(Math.floor(box.x), 0, count - 1), s, height); // RND-10
      }
      drawTextBox(ctx, box, style, s, yScale);
      ctx.restore();
    }
  } finally {
    ctx.restore();
  }
}

/** RND-06: the leaf's tree rectangle in px, inset by gap/2, topped up to a
 *  full gap on outer boundaries. */
export function innerRect(leaf: LeafRect, s: number, yScale: number, gap: number): PxRect {
  const half = gap / 2;
  const left = leaf.rect.x0 * s + half + (leaf.outer.left ? half : 0);
  const right = leaf.rect.x1 * s - half - (leaf.outer.right ? half : 0);
  const top = leaf.rect.y0 * yScale + half + (leaf.outer.top ? half : 0);
  const bottom = leaf.rect.y1 * yScale - half - (leaf.outer.bottom ? half : 0);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function drawLeaf(
  ctx: RenderContext,
  leaf: LeafRect,
  r: PxRect,
  style: LayoutStyle,
  s: number,
  photos: PhotoSource,
  emptyCells: RenderOptions['emptyCells'],
): void {
  if (leaf.node.kind === 'spacer') return;
  const radius = Math.min(style.cornerRadius * s, r.w / 2, r.h / 2);
  const placed = leaf.node.photo;
  const bitmap = placed ? photos(placed.photoId) : undefined;

  if (placed && bitmap) {
    ctx.save();
    roundedRectPath(ctx, r, radius);
    ctx.clip();
    const p = placePhoto(r, bitmap.width, bitmap.height, placed.framing);
    const t = p.transform;
    ctx.transform(t.a, t.b, t.c, t.d, t.e, t.f);
    ctx.drawImage(bitmap, 0, 0);
    ctx.restore();
  } else if (emptyCells === 'placeholder') {
    drawPlaceholder(ctx, r, radius, s);
  } else {
    return; // export: an empty Cell is background, border included.
  }
  drawBorder(ctx, r, radius, style, s);
}

/** RND-08: a stroke of borderWidth inside the inner rectangle's edge. */
function drawBorder(ctx: RenderContext, r: PxRect, radius: number, style: LayoutStyle, s: number): void {
  const bw = style.borderWidth * s;
  if (bw <= 0) return;
  ctx.save();
  roundedRectPath(ctx, r, radius);
  ctx.clip();
  ctx.strokeStyle = style.borderColor;
  ctx.fillStyle = style.borderColor;
  if (bw * 2 >= Math.min(r.w, r.h)) {
    roundedRectPath(ctx, r, radius);
    ctx.fill();
  } else {
    ctx.lineWidth = bw;
    const inset = { x: r.x + bw / 2, y: r.y + bw / 2, w: r.w - bw, h: r.h - bw };
    roundedRectPath(ctx, inset, Math.max(radius - bw / 2, 0));
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlaceholder(ctx: RenderContext, r: PxRect, radius: number, s: number): void {
  ctx.fillStyle = PLACEHOLDER_FILL;
  roundedRectPath(ctx, r, radius);
  ctx.fill();
  const arm = Math.min(r.w, r.h) * 0.08;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.strokeStyle = PLACEHOLDER_ICON;
  ctx.lineWidth = Math.max(1, 0.004 * s);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();
}

/** RND-09: Canvas 2D text with wrapping, line height 1.2 and an optional background box. */
function drawTextBox(ctx: RenderContext, box: TextBox, style: LayoutStyle, s: number, yScale: number): void {
  const size = box.size * s;
  const left = box.x * s;
  const top = box.y * yScale;
  const width = box.width * s;
  const lineHeight = LINE_HEIGHT * size;

  ctx.font = cssFont(box, size);
  const lines = wrapText(box.text, width, (t) => ctx.measureText(t).width);
  const anchor = box.align === 'left' ? left : box.align === 'center' ? left + width / 2 : left + width;

  if (box.background) {
    let x0 = Infinity;
    let x1 = -Infinity;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w <= 0) continue;
      const start = box.align === 'left' ? anchor : box.align === 'center' ? anchor - w / 2 : anchor - w;
      x0 = Math.min(x0, start);
      x1 = Math.max(x1, start + w);
    }
    if (x1 > x0) {
      const pad = box.background.padding * s;
      const rect = { x: x0 - pad, y: top - pad, w: x1 - x0 + 2 * pad, h: lines.length * lineHeight + 2 * pad };
      const radius = Math.min(style.cornerRadius * s, rect.w / 2, rect.h / 2);
      ctx.save();
      ctx.globalAlpha = box.background.opacity;
      ctx.fillStyle = box.background.color;
      roundedRectPath(ctx, rect, radius);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.fillStyle = box.color;
  ctx.textAlign = box.align;
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.fillText(line, anchor, top + (i + 0.5) * lineHeight);
  });
}

/** The CSS font shorthand for a Text Box, falling back to Inter. */
export function cssFont(box: Pick<TextBox, 'font' | 'weight'>, sizePx: number): string {
  const family = box.font.family === FALLBACK_FONT_FAMILY
    ? quoteFamily(FALLBACK_FONT_FAMILY)
    : `${quoteFamily(box.font.family)}, ${quoteFamily(FALLBACK_FONT_FAMILY)}`;
  return `${box.weight} ${sizePx}px ${family}`;
}

function quoteFamily(family: string): string {
  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function roundedRectPath(ctx: RenderContext, r: PxRect, radius: number): void {
  ctx.beginPath();
  if (radius > 0) ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  else ctx.rect(r.x, r.y, r.w, r.h);
}

function clipToSlide(ctx: RenderContext, slide: number, s: number, height: number): void {
  ctx.beginPath();
  ctx.rect(slide * s, 0, s, height);
  ctx.clip();
}

/** Put every piece of context state the renderer relies on into a known state,
 *  so the output doesn't depend on what the caller left behind (RND-01). The
 *  current transform is kept on purpose: callers may position the drawing. */
function resetState(ctx: RenderContext): void {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high'; // RND-07
  ctx.filter = 'none';
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 10;
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.direction = 'ltr';
  ctx.letterSpacing = '0px';
  ctx.wordSpacing = '0px';
  ctx.fontKerning = 'auto';
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(Math.trunc(v), lo), hi);
}
