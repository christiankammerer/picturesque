// SPDX-License-Identifier: GPL-3.0-or-later
//
// The placement rules of Auto-fill (AUT-02, AUT-03, AUT-09), and the
// Template switch that uses them (AUT-08). The Auto-fill button, its Slide
// count choice (AUT-05) and the automatic runs (AUT-07) arrive with M4.

import { leafRects } from '../model/geometry.ts';
import { mapCells } from '../model/project.ts';
import { RATIO_HEIGHT, DEFAULT_FRAMING, type CellNode, type Layout, type PhotoMeta, type Post } from '../model/schema.ts';
import { innerRect } from '../render/render.ts';

const TIE = 1e-6;

/**
 * AUT-02: Cell order. Slide by Slide; within a Slide, by top-left corner,
 * top to bottom, then left to right. In a Seamless Carousel a Cell belongs
 * to the Slide that contains its centre.
 */
export function cellOrder(layout: Layout): CellNode[] {
  const cells = leafRects(layout).flatMap((l) => (l.node.kind === 'cell' ? [{ cell: l.node, rect: l.rect, slide: l.slide }] : []));
  const slideOf = (c: (typeof cells)[number]) => c.slide ?? Math.floor((c.rect.x0 + c.rect.x1) / 2);
  return cells
    .map((c, i) => ({ ...c, i, s: slideOf(c) }))
    .sort((a, b) => {
      if (a.s !== b.s) return a.s - b.s;
      if (Math.abs(a.rect.y0 - b.rect.y0) > TIE) return a.rect.y0 - b.rect.y0;
      if (Math.abs(a.rect.x0 - b.rect.x0) > TIE) return a.rect.x0 - b.rect.x0;
      return a.i - b.i;
    })
    .map((c) => c.cell);
}

export type Shape = 'landscape' | 'portrait' | 'square';

/** AUT-03: landscape above 1.1, portrait below 0.9, square otherwise. */
export function shapeOf(width: number, height: number): Shape {
  const aspect = width / height;
  return aspect > 1.1 ? 'landscape' : aspect < 0.9 ? 'portrait' : 'square';
}

/** The shape of each Cell's inner rectangle at the Post's ratio. */
function cellShapes(post: Post): Map<string, Shape> {
  const s = 1000;
  const out = new Map<string, Shape>();
  for (const leaf of leafRects(post.layout)) {
    if (leaf.node.kind !== 'cell') continue;
    const r = innerRect(leaf, s, s * RATIO_HEIGHT[post.aspectRatio], post.style.gap * s);
    out.set(leaf.node.id, shapeOf(Math.max(r.w, 1e-9), Math.max(r.h, 1e-9)));
  }
  return out;
}

/**
 * Fill the empty Cells, in Cell order, from `queue` (photo ids, in order).
 * For each Cell, take the first photo whose shape matches among the next
 * one and up to 2 beyond it; else the next photo (AUT-03). Placed photos
 * get DEFAULT_FRAMING (AUT-09). Returns the new Layout and the photos used.
 */
export function fillEmptyCells(post: Post, queue: readonly string[], photos: Record<string, PhotoMeta>): { layout: Layout; used: string[] } {
  const shapes = cellShapes(post);
  const remaining = queue.slice();
  const assign = new Map<string, string>();
  for (const cell of cellOrder(post.layout)) {
    if (cell.photo || remaining.length === 0) continue;
    const want = shapes.get(cell.id);
    const window = remaining.slice(0, 3);
    let k = window.findIndex((id) => {
      const m = photos[id];
      return m !== undefined && shapeOf(m.width, m.height) === want;
    });
    if (k < 0) k = 0;
    assign.set(cell.id, remaining[k]!);
    remaining.splice(k, 1);
  }
  const layout = mapCells(post.layout, (c) => {
    const photoId = assign.get(c.id);
    return photoId ? { ...c, photo: { photoId, framing: { ...DEFAULT_FRAMING } } } : c;
  });
  return { layout, used: [...assign.values()] };
}

/**
 * AUT-08 / TPL-05: switch to a new Layout, keeping the placed photos. They
 * are collected in their current Cell order and placed into the new Cells
 * by the Auto-fill rules, with DEFAULT_FRAMING; photos that don't fit go
 * back to unplaced.
 */
export function switchLayout(current: Post, next: Post, photos: Record<string, PhotoMeta>): Post {
  const placed = cellOrder(current.layout).flatMap((c) => (c.photo ? [c.photo.photoId] : []));
  const { layout } = fillEmptyCells(next, placed, photos);
  return { ...next, layout };
}
