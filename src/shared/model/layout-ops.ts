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

// ---------- MOD-14: the adjust operations ----------

/** The path of the Cell with `cellId`, or undefined. */
export function pathOfCell(layout: Layout, cellId: string): number[] | undefined {
  const search = (node: LayoutNode, path: number[]): number[] | undefined => {
    if (node.kind === 'cell') return node.id === cellId ? path : undefined;
    if (node.kind === 'split') {
      for (const [i, c] of node.children.entries()) {
        const found = search(c, [...path, i]);
        if (found) return found;
      }
    }
    return undefined;
  };
  if (layout.postType === 'carousel') {
    for (const [i, s] of layout.slides.entries()) {
      const found = search(s, [i]);
      if (found) return found;
    }
    return undefined;
  }
  return search(layout.root, []);
}

/** The path of the parent split, or undefined at a root (for a Carousel, a Slide root). */
function parentPath(layout: Layout, path: NodePath): NodePath | undefined {
  const minDepth = layout.postType === 'carousel' ? 1 : 0;
  return path.length > minDepth ? path.slice(0, -1) : undefined;
}

export type SplitDirection = 'row' | 'column';

/** Whether splitting the Cell in half along `direction` keeps both halves at least MIN_LEAF_SIZE. */
export function canSplit(layout: Layout, cellId: string, direction: SplitDirection): boolean {
  const path = pathOfCell(layout, cellId);
  const found = path && nodeAt(layout, path);
  if (!found) return false;
  const extent = direction === 'row' ? found.rect.x1 - found.rect.x0 : found.rect.y1 - found.rect.y0;
  return extent / 2 >= MIN_LEAF_SIZE - 1e-9;
}

/**
 * Split a Cell in half (MOD-14). The Cell keeps its photo and framing and
 * becomes the first half; the second half is a new, empty Cell. A parent
 * split of the same direction gets the halves inserted; otherwise the Cell
 * becomes a two-child split.
 */
export function splitCell(layout: Layout, cellId: string, direction: SplitDirection, newId: string = newCellId()): Layout {
  if (!canSplit(layout, cellId, direction)) return layout;
  const path = pathOfCell(layout, cellId)!;
  const cell = nodeAt(layout, path)!.node;
  const fresh: LayoutNode = { kind: 'cell', id: newId };
  const pp = parentPath(layout, path);
  const parent = pp && nodeAt(layout, pp)!.node;
  if (parent && parent.kind === 'split' && parent.direction === direction) {
    const i = path[path.length - 1]!;
    const half = parent.sizes[i]! / 2;
    const children = [...parent.children.slice(0, i), cell, fresh, ...parent.children.slice(i + 1)];
    const sizes = [...parent.sizes.slice(0, i), half, half, ...parent.sizes.slice(i + 1)];
    return replaceAt(layout, pp, { ...parent, children, sizes });
  }
  return replaceAt(layout, path, { kind: 'split', direction, sizes: [0.5, 0.5], children: [cell, fresh] });
}

export type MergeSide = 'left' | 'right' | 'up' | 'down';

/** EDT-16: the sides a Cell can merge towards: a sibling leaf next to it in its parent split. */
export function mergeSides(layout: Layout, cellId: string): MergeSide[] {
  const path = pathOfCell(layout, cellId);
  const pp = path && parentPath(layout, path);
  const parent = pp && nodeAt(layout, pp)!.node;
  if (!path || !parent || parent.kind !== 'split') return [];
  const i = path[path.length - 1]!;
  const leaf = (n: LayoutNode | undefined) => n !== undefined && n.kind !== 'split';
  const out: MergeSide[] = [];
  const [before, after] = parent.direction === 'row' ? (['left', 'right'] as const) : (['up', 'down'] as const);
  if (leaf(parent.children[i - 1])) out.push(before);
  if (leaf(parent.children[i + 1])) out.push(after);
  return out;
}

/**
 * Merge a Cell with the sibling leaf on `side` (MOD-14). The merged Cell is
 * the starting Cell (its id and photo), taking both sizes; the sibling's
 * photo, if any, goes back to unplaced. Works the same with a Spacer.
 */
export function mergeCell(layout: Layout, cellId: string, side: MergeSide): Layout {
  if (!mergeSides(layout, cellId).includes(side)) return layout;
  const path = pathOfCell(layout, cellId)!;
  const pp = parentPath(layout, path)!;
  const parent = nodeAt(layout, pp)!.node as SplitNode;
  const i = path[path.length - 1]!;
  const j = side === 'left' || side === 'up' ? i - 1 : i + 1;
  const keep = Math.min(i, j);
  const sizes = parent.sizes.slice();
  const children = parent.children.slice();
  sizes.splice(keep, 2, parent.sizes[i]! + parent.sizes[j]!);
  children.splice(keep, 2, parent.children[i]!);
  return normalizeLayout(replaceAt(layout, pp, { ...parent, sizes, children }));
}

/** MOD-14: turn the leaf at `path` into a Spacer (a photo goes back to unplaced) or an empty Cell. */
export function setLeafKind(layout: Layout, path: NodePath, kind: 'cell' | 'spacer', newId: string = newCellId()): Layout {
  const found = nodeAt(layout, path);
  if (!found || found.node.kind === 'split' || found.node.kind === kind) return layout;
  return replaceAt(layout, path, kind === 'spacer' ? { kind: 'spacer' } : { kind: 'cell', id: newId });
}

export interface Divider {
  /** Path of the split. */
  path: number[];
  /** The divider is between children `index` and `index + 1`. */
  index: number;
  direction: SplitDirection;
  /** The split's rectangle and the divider's position along it, in Slide units. */
  rect: Rect;
  at: number;
}

/** EDT-16: every draggable divider. Slide edges of a Carousel aren't dividers (MOD-10). */
export function dividers(layout: Layout): Divider[] {
  const out: Divider[] = [];
  const visit = (node: LayoutNode, rect: Rect, path: number[]) => {
    if (node.kind !== 'split') return;
    const rects = childRects(node.direction, node.sizes, rect);
    for (let i = 0; i < node.children.length - 1; i++) {
      out.push({ path, index: i, direction: node.direction, rect, at: node.direction === 'row' ? rects[i]!.x1 : rects[i]!.y1 });
    }
    node.children.forEach((c, i) => visit(c, rects[i]!, [...path, i]));
  };
  for (const { node, rect } of roots(layout)) {
    visit(node, rect, layout.postType === 'carousel' ? [Math.round(rect.x0)] : []);
  }
  return out;
}
