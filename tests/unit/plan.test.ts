// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { decodeSizes, exportHeight } from '../../src/shared/export/plan.ts';
import type { PhotoMeta, Post } from '../../src/shared/model/schema.ts';
import { cell, STYLE } from './fixtures.ts';

const meta = (id: string, width: number, height: number): PhotoMeta => ({
  id, ext: 'jpg', originalName: `${id}.jpg`, captureDate: '2026-01-01T00:00:00Z', width, height,
});

const single = (zoom: number): Post => ({
  type: 'collage',
  aspectRatio: '1:1',
  layout: { postType: 'collage', root: { kind: 'cell', id: 'a', photo: { photoId: 'p', framing: { zoom, focusX: 0.5, focusY: 0.5, rotate90: 0, straighten: 0 } } } },
  style: STYLE,
  textBoxes: [],
});

describe('EXP-01 export size', () => {
  it.each([['1:1', 1080], ['4:5', 1350], ['3:4', 1440], ['9:16', 1920]] as const)('%s is 1080 × %d', (ratio, h) => {
    expect(exportHeight({ aspectRatio: ratio })).toBe(h);
  });
});

describe('EXP-04 decode size', () => {
  it('decodes at the size the Cell draws the photo', () => {
    // A 4000×3000 photo covering a 1080×1080 Cell is drawn 1440×1080.
    const sizes = decodeSizes(single(1), { p: meta('p', 4000, 3000) });
    expect(sizes.get('p')).toEqual({ width: 1440, height: 1080 });
  });
  it('scales with zoom', () => {
    expect(decodeSizes(single(2), { p: meta('p', 4000, 3000) }).get('p')).toEqual({ width: 2880, height: 2160 });
  });
  it('is never larger than the original', () => {
    expect(decodeSizes(single(10), { p: meta('p', 4000, 3000) }).get('p')).toEqual({ width: 4000, height: 3000 });
    expect(decodeSizes(single(1), { p: meta('p', 800, 600) }).get('p')).toEqual({ width: 800, height: 600 });
  });
  it('uses the largest need when a photo is in several Cells', () => {
    const post: Post = {
      ...single(1),
      layout: { postType: 'collage', root: { kind: 'split', direction: 'row', sizes: [0.7, 0.3], children: [cell('a', 'p'), cell('b', 'p')] } },
    };
    const w = decodeSizes(post, { p: meta('p', 6000, 6000) }).get('p')!.width;
    expect(w).toBe(1080); // the 756×1080 Cell needs a 1080×1080 square
  });
  it('skips empty Cells', () => {
    const post: Post = { ...single(1), layout: { postType: 'collage', root: cell('a') } };
    expect(decodeSizes(post, {}).size).toBe(0);
  });
});
