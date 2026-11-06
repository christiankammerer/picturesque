// SPDX-License-Identifier: GPL-3.0-or-later
//
// Pure Layout operations. Every operation returns a new Layout and leaves its
// input untouched. The full set of adjust operations (MOD-14…MOD-18) is built
// on these.

import { childRects, MIN_LEAF_SIZE, type Rect } from './geometry.ts';
import type { Layout, LayoutNode, SplitNode } from './schema.ts';

/** A path to a node: child indices from the root. For a Carousel the first
 *  index picks the Slide. */
export type NodePath = readonly number[];

/** MOD-13: a fresh, unique Cell id. */
export function newCellId(): string {
  return crypto.randomUUID();
}

/**
 * MOD-11: a split left with one child is replaced by that child, and a split
 * whose child is a split of the same direction keeps its own structure (only
 * one-child splits are collapsed). Applied recursively.
 */
export function normalizeNode(node: LayoutNode): LayoutNode {
  if (node.kind !== 'split') return node;
  const children = node.children.map(normalizeNode);
  if (children.length === 1) return children[0]!;
  const total = node.sizes.reduce((a, b) => a + b, 0);
  return { ...node, children, sizes: node.sizes.map((s) => s / total) };
}

export function normalizeLayout(layout: Layout): Layout {
  switch (layout.postType) {
    case 'carousel':
      return { ...layout, slides: layout.slides.map(normalizeNode) };
    default:
      return { ...layout, root: normalizeNode(layout.root) };
  }
}

/** The root nodes of a Layout with the rectangles they cover. */
function roots(layout: Layout): { node: LayoutNode; rect: Rect }[] {
  switch (layout.postType) {
    case 'collage':
      return [{ node: layout.root, rect: { x0: 0, y0: 0, x1: 1, y1: 1 } }];
    case 'carousel':
      return layout.slides.map((node, i) => ({ node, rect: { x0: i, y0: 0, x1: i + 1, y1: 1 } }));
    case 'seamless':
      return [{ node: layout.root, rect: { x0: 0, y0: 0, x1: layout.slideCount, y1: 1 } }];
  }
}

/** The node at `path` and its rectangle, or undefined. */
export function nodeAt(layout: Layout, path: NodePath): { node: LayoutNode; rect: Rect } | undefined {
  const all = roots(layout);
  let cur: { node: LayoutNode; rect: Rect } | undefined;
  let rest: readonly number[];
  if (layout.postType === 'carousel') {
    cur = all[path[0] ?? -1];
    rest = path.slice(1);
  } else {
    cur = all[0];
    rest = path;
  }
  for (const i of rest) {
    if (!cur || cur.node.kind !== 'split') return undefined;
    const child = cur.node.children[i];
    if (!child) return undefined;
    cur = { node: child, rect: childRects(cur.node.direction, cur.node.sizes, cur.rect)[i]! };
  }
  return cur;
}

/** Replace the node at `path`. */
export function replaceAt(layout: Layout, path: NodePath, replacement: LayoutNode): Layout {
  const rec = (node: LayoutNode, rest: readonly number[]): LayoutNode => {
    if (rest.length === 0) return replacement;
    if (node.kind !== 'split') throw new Error('path does not lead to a node');
    const [i, ...tail] = rest;
    const children = node.children.slice();
    children[i!] = rec(children[i!]!, tail);
    return { ...node, children };
  };
  if (layout.postType === 'carousel') {
    const [slide, ...tail] = path;
    const slides = layout.slides.slice();
    slides[slide!] = rec(slides[slide!]!, tail);
    return { ...layout, slides };
  }
  return { ...layout, root: rec(layout.root, path) };
}

/** The smallest extent `node` can be scaled to along an axis, given that it
 *  scales proportionally and no leaf may get smaller than MIN_LEAF_SIZE. */
function minExtent(node: LayoutNode, rect: Rect, axis: 'row' | 'column'): number {
  const extent = axis === 'row' ? rect.x1 - rect.x0 : rect.y1 - rect.y0;
  let smallest = Infinity;
  const visit = (n: LayoutNode, r: Rect): void => {
    if (n.kind !== 'split') {
      smallest = Math.min(smallest, axis === 'row' ? r.x1 - r.x0 : r.y1 - r.y0);
      return;
    }
    const rs = childRects(n.direction, n.sizes, r);
    n.children.forEach((c, i) => visit(c, rs[i]!));
  };
  visit(node, rect);
  return extent * (MIN_LEAF_SIZE / smallest);
}

/**
 * Drag the divider between children `index` and `index + 1` of the split at
 * `path` to `position`, a fraction (0..1) of the split's extent measured from
 * its start. The two children's combined size stays the same, and the drag
 * stops where any leaf would get smaller than MIN_LEAF_SIZE (MOD-12).
 */
export function moveDivider(layout: Layout, path: NodePath, index: number, position: number): Layout {
  const found = nodeAt(layout, path);
  if (!found || found.node.kind !== 'split') throw new Error('no split at path');
  const split: SplitNode = found.node;
  if (index < 0 || index + 1 >= split.children.length) throw new Error('no such divider');

  const length = split.direction === 'row' ? found.rect.x1 - found.rect.x0 : found.rect.y1 - found.rect.y0;
  const rects = childRects(split.direction, split.sizes, found.rect);
  const minA = minExtent(split.children[index]!, rects[index]!, split.direction) / length;
  const minB = minExtent(split.children[index + 1]!, rects[index + 1]!, split.direction) / length;

  const before = split.sizes.slice(0, index).reduce((a, b) => a + b, 0);
  const combined = split.sizes[index]! + split.sizes[index + 1]!;
  const wanted = position - before;
  const a = Math.min(Math.max(wanted, minA), combined - minB);
  if (combined - minB < minA) return layout; // already at the limit on both sides

  const sizes = split.sizes.slice();
  sizes[index] = a;
  sizes[index + 1] = combined - a;
  return replaceAt(layout, path, { ...split, sizes });
}
