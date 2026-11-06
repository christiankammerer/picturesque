// SPDX-License-Identifier: GPL-3.0-or-later
// Small builders for test Posts.

import type { CellNode, LayoutNode, LayoutStyle, Post, SplitNode } from '../../src/shared/model/schema.ts';
import { DEFAULT_FRAMING, type Framing } from '../../src/shared/model/schema.ts';
import { apply, invert, placePhoto, type PxRect } from '../../src/shared/render/framing.ts';
import { expect } from 'vitest';

export const STYLE: LayoutStyle = { gap: 0, cornerRadius: 0, borderWidth: 0, borderColor: '#000000', background: '#ffffff' };

export function cell(id: string, photoId?: string): CellNode {
  return photoId ? { kind: 'cell', id, photo: { photoId, framing: { ...DEFAULT_FRAMING } } } : { kind: 'cell', id };
}

export function row(children: LayoutNode[], sizes?: number[]): SplitNode {
  return { kind: 'split', direction: 'row', sizes: sizes ?? children.map(() => 1 / children.length), children };
}

export function column(children: LayoutNode[], sizes?: number[]): SplitNode {
  return { kind: 'split', direction: 'column', sizes: sizes ?? children.map(() => 1 / children.length), children };
}

/** Grid 2×2 Collage. */
export function grid2x2(style: Partial<LayoutStyle> = {}): Post {
  return {
    type: 'collage',
    aspectRatio: '4:5',
    layout: {
      postType: 'collage',
      root: column([row([cell('a', 'p1'), cell('b', 'p2')]), row([cell('c', 'p3'), cell('d', 'p4')])]),
    },
    style: { ...STYLE, ...style },
    textBoxes: [],
  };
}

/** RND-07: every corner of `r` (pulled in by a hair) maps into the bitmap. */
export function expectCovered(r: PxRect, bw: number, bh: number, framing: Framing): void {
  const inv = invert(placePhoto(r, bw, bh, framing).transform);
  const e = 1e-6 * Math.max(r.w, r.h);
  const corners: [number, number][] = [
    [r.x + e, r.y + e], [r.x + r.w - e, r.y + e], [r.x + e, r.y + r.h - e], [r.x + r.w - e, r.y + r.h - e],
  ];
  for (const [x, y] of corners) {
    const [u, v] = apply(inv, x, y);
    expect(u).toBeGreaterThanOrEqual(-1e-6 * bw);
    expect(v).toBeGreaterThanOrEqual(-1e-6 * bh);
    expect(u).toBeLessThanOrEqual(bw * (1 + 1e-6));
    expect(v).toBeLessThanOrEqual(bh * (1 + 1e-6));
  }
}

/** A PNG signature and IHDR claiming a size, with `salt` appended to vary the hash. */
export function fakePng(width: number, height: number, salt = 0): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(8 + 25 + 4);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const v = new DataView(b.buffer);
  v.setUint32(8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  v.setUint32(16, width);
  v.setUint32(20, height);
  b.set([8, 2, 0, 0, 0], 24);
  v.setUint32(33, salt);
  return b;
}
