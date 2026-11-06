// SPDX-License-Identifier: GPL-3.0-or-later
//
// Geometry of the split tree, in Slide units (MOD-08, MOD-09).

import type { CellNode, Layout, LayoutNode, SpacerNode } from './schema.ts';

/** MOD-12: every leaf is at least this many Slide units wide and tall. */
export const MIN_LEAF_SIZE = 0.05;

/** Split sizes must sum to 1 within this tolerance. */
export const SIZE_SUM_TOLERANCE = 1e-9;

/** An axis-aligned rectangle in Slide units, as two corners. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Which sides of a leaf lie on an outer boundary that gets a full gap (RND-06). */
export interface OuterEdges {
  left: boolean;
  top: boolean;
  right: boolean;
  bottom: boolean;
}

export interface LeafRect {
  node: CellNode | SpacerNode;
  /** The leaf's tree rectangle in canvas Slide units. */
  rect: Rect;
  outer: OuterEdges;
  /** Carousel only: the Slide whose subtree holds the leaf. */
  slide: number | null;
  /** Child indices from the root (for a Carousel, starting with the Slide). */
  path: number[];
}

const ALL_OUTER: OuterEdges = { left: true, top: true, right: true, bottom: true };

/**
 * The leaves of a Layout with their rectangles, in tree order
 * (depth-first, children in order; Slide by Slide for a Carousel).
 *
 * Child rectangles are computed from cumulative sizes, and the last child of a
 * split always ends exactly at the parent's end, so the leaves tile the area
 * with no hole or overlap even with floating-point sizes.
 */
export function leafRects(layout: Layout): LeafRect[] {
  const out: LeafRect[] = [];
  switch (layout.postType) {
    case 'collage':
      walk(layout.root, { x0: 0, y0: 0, x1: 1, y1: 1 }, ALL_OUTER, null, [], out);
      break;
    case 'carousel':
      layout.slides.forEach((slide, i) =>
        walk(slide, { x0: i, y0: 0, x1: i + 1, y1: 1 }, ALL_OUTER, i, [i], out),
      );
      break;
    case 'seamless':
      walk(layout.root, { x0: 0, y0: 0, x1: layout.slideCount, y1: 1 }, ALL_OUTER, null, [], out);
      break;
  }
  return out;
}

/** The rectangles of a split's children, in order. */
export function childRects(direction: 'row' | 'column', sizes: readonly number[], rect: Rect): Rect[] {
  const total = sizes.reduce((a, b) => a + b, 0);
  const rects: Rect[] = [];
  let acc = 0;
  const [start, end] = direction === 'row' ? [rect.x0, rect.x1] : [rect.y0, rect.y1];
  for (let i = 0; i < sizes.length; i++) {
    const a = start + (end - start) * (acc / total);
    acc += sizes[i]!;
    const b = i === sizes.length - 1 ? end : start + (end - start) * (acc / total);
    rects.push(direction === 'row' ? { ...rect, x0: a, x1: b } : { ...rect, y0: a, y1: b });
  }
  return rects;
}

function walk(node: LayoutNode, rect: Rect, outer: OuterEdges, slide: number | null, path: number[], out: LeafRect[]): void {
  if (node.kind !== 'split') {
    out.push({ node, rect, outer, slide, path });
    return;
  }
  const rects = childRects(node.direction, node.sizes, rect);
  const last = node.children.length - 1;
  node.children.forEach((child, i) => {
    const childOuter: OuterEdges =
      node.direction === 'row'
        ? { ...outer, left: outer.left && i === 0, right: outer.right && i === last }
        : { ...outer, top: outer.top && i === 0, bottom: outer.bottom && i === last };
    walk(child, rects[i]!, childOuter, slide, [...path, i], out);
  });
}

/** MOD-08: the canvas is slideCount Slide widths wide and one Slide tall. */
export function canvasExtent(layout: Layout): { width: number; height: number } {
  switch (layout.postType) {
    case 'collage': return { width: 1, height: 1 };
    case 'carousel': return { width: layout.slides.length, height: 1 };
    case 'seamless': return { width: layout.slideCount, height: 1 };
  }
}
