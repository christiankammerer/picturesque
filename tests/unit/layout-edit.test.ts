// SPDX-License-Identifier: GPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { leafRects } from '../../src/shared/model/geometry.ts';
import { dividers, mergeCell, mergeSides, moveDivider, pathOfCell, setLeafKind, splitCell } from '../../src/shared/model/layout-ops.ts';
import { mapCells } from '../../src/shared/model/project.ts';
import { cellsOf, PostSchema, type Layout, type PhotoMeta, type Post } from '../../src/shared/model/schema.ts';
import { cellOrder, fillEmptyCells, shapeOf, switchLayout } from '../../src/shared/templates/autofill.ts';
import { postFromTemplate, templateById } from '../../src/shared/templates/builtins.ts';
import { cell, column, row, STYLE } from './fixtures.ts';

const collage = (root: Layout & { postType: 'collage' }): Post => ({ type: 'collage', aspectRatio: '4:5', layout: root, style: STYLE, textBoxes: [] });
const valid = (layout: Layout, type: Post['type'] = 'collage') =>
  PostSchema.safeParse({ type, aspectRatio: '4:5', layout, style: STYLE, textBoxes: [] }).success;
const rectOf = (layout: Layout, id: string) => leafRects(layout).find((l) => l.node.kind === 'cell' && l.node.id === id)!.rect;

describe('MOD-14 split', () => {
  it('splits a Cell into two halves; the original keeps its photo and id, the new half is empty', () => {
    const layout: Layout = { postType: 'collage', root: cell('a', 'p') };
    const out = splitCell(layout, 'a', 'row', 'b');
    expect(out).toEqual({ postType: 'collage', root: row([cell('a', 'p'), cell('b')], [0.5, 0.5]) });
  });
  it('inserts into a parent split of the same direction', () => {
    const layout: Layout = { postType: 'collage', root: row([cell('a'), cell('b')]) };
    const out = splitCell(layout, 'b', 'row', 'c');
    expect(out).toEqual({ postType: 'collage', root: row([cell('a'), cell('b'), cell('c')], [0.5, 0.25, 0.25]) });
  });
  it('nests a two-child split when the parent has the other direction', () => {
    const layout: Layout = { postType: 'collage', root: row([cell('a'), cell('b')]) };
    const out = splitCell(layout, 'b', 'column', 'c');
    expect(out).toEqual({ postType: 'collage', root: row([cell('a'), column([cell('b'), cell('c')], [0.5, 0.5])]) });
  });
  it('refuses a split that would make a leaf smaller than the minimum', () => {
    const layout: Layout = { postType: 'collage', root: row([cell('a'), cell('b')], [0.92, 0.08]) };
    expect(splitCell(layout, 'b', 'row')).toBe(layout);
  });
  it('MOD-13: the new Cell gets a fresh id', () => {
    const out = splitCell({ postType: 'collage', root: cell('a') }, 'a', 'column');
    const ids = cellsOf(out).map((c) => c.id);
    expect(ids[0]).toBe('a');
    expect(ids[1]).not.toBe('a');
  });
});

describe('MOD-14 / MOD-11 merge', () => {
  const layout: Layout = { postType: 'collage', root: row([cell('a', 'p'), cell('b', 'q'), column([cell('c'), cell('d')])]) };
  it('offers only sides with a sibling leaf (EDT-16)', () => {
    expect(mergeSides(layout, 'a')).toEqual(['right']);
    expect(mergeSides(layout, 'b')).toEqual(['left']); // the right neighbour is a split
    expect(mergeSides(layout, 'c')).toEqual(['down']);
  });
  it('keeps the starting Cell and its photo, taking both sizes; the sibling photo goes back to unplaced', () => {
    const out = mergeCell(layout, 'b', 'left');
    expect(cellsOf(out).map((c) => [c.id, c.photo?.photoId])).toEqual([['b', 'q'], ['c', undefined], ['d', undefined]]);
    expect(rectOf(out, 'b')).toMatchObject({ x0: 0 });
    expect(rectOf(out, 'b').x1).toBeCloseTo(2 / 3);
  });
  it('merging the two Cells of a two-child split leaves one Cell, not a one-child split', () => {
    const out = mergeCell(layout, 'c', 'down');
    expect((out as { root: { children: unknown[] } }).root.children[2]).toEqual(cell('c'));
    expect(valid(out)).toBe(true);
  });
  it('merges into a Spacer the same way', () => {
    const l: Layout = { postType: 'collage', root: row([cell('a', 'p'), { kind: 'spacer' }]) };
    expect(mergeCell(l, 'a', 'right')).toEqual({ postType: 'collage', root: cell('a', 'p') });
  });
  it('refuses an invalid side', () => {
    expect(mergeCell(layout, 'a', 'left')).toBe(layout);
  });
});

describe('MOD-14 Spacers', () => {
  it('turns a Cell into a Spacer and back into an empty Cell', () => {
    const layout: Layout = { postType: 'collage', root: row([cell('a', 'p'), cell('b')]) };
    const spaced = setLeafKind(layout, pathOfCell(layout, 'a')!, 'spacer');
    expect(cellsOf(spaced).map((c) => c.id)).toEqual(['b']);
    const back = setLeafKind(spaced, [0], 'cell', 'z');
    expect(cellsOf(back)).toEqual([cell('z'), cell('b')]);
  });
});

describe('EDT-16 dividers', () => {
  it('lists dividers inside each Slide, but none at Carousel Slide edges', () => {
    const carousel: Layout = { postType: 'carousel', slides: [cell('a'), row([cell('b'), cell('c')])] };
    const ds = dividers(carousel);
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ path: [1], index: 0, direction: 'row', at: 1.5 });
  });
  it('a Seamless divider may sit anywhere, including on a Slide edge', () => {
    const seamless: Layout = { postType: 'seamless', slideCount: 2, root: row([cell('a'), cell('b')]) };
    expect(dividers(seamless).map((d) => d.at)).toEqual([1]);
  });
  it('property: any sequence of edits keeps the Layout valid', () => {
    const op = fc.oneof(
      fc.record({ op: fc.constant('split' as const), dir: fc.constantFrom('row' as const, 'column' as const), k: fc.nat() }),
      fc.record({ op: fc.constant('merge' as const), k: fc.nat(), side: fc.constantFrom('left' as const, 'right' as const, 'up' as const, 'down' as const) }),
      fc.record({ op: fc.constant('spacer' as const), k: fc.nat() }),
      fc.record({ op: fc.constant('drag' as const), k: fc.nat(), pos: fc.double({ min: -0.5, max: 1.5, noNaN: true }) }),
    );
    fc.assert(
      fc.property(fc.array(op, { maxLength: 25 }), (ops) => {
        let layout: Layout = { postType: 'collage', root: cell('root') };
        for (const o of ops) {
          const ids = cellsOf(layout).map((c) => c.id);
          if (o.op === 'split' && ids.length) layout = splitCell(layout, ids[o.k % ids.length]!, o.dir);
          else if (o.op === 'merge' && ids.length) layout = mergeCell(layout, ids[o.k % ids.length]!, o.side);
          else if (o.op === 'spacer' && ids.length > 1) layout = setLeafKind(layout, pathOfCell(layout, ids[o.k % ids.length]!)!, 'spacer');
          else if (o.op === 'drag') {
            const ds = dividers(layout);
            const d = ds[o.k % Math.max(1, ds.length)];
            if (d) layout = moveDivider(layout, d.path, d.index, o.pos);
          }
          expect(valid(layout)).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });
});

const meta = (id: string, width: number, height: number): PhotoMeta => ({ id, ext: 'jpg', originalName: id, captureDate: '2026-01-01T00:00:00Z', width, height });

describe('AUT-02 Cell order', () => {
  it('is top to bottom, then left to right, within each Slide', () => {
    const post = collage({ postType: 'collage', root: row([column([cell('a'), cell('c')]), column([cell('b'), cell('d')])]) });
    expect(cellOrder(post.layout).map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('in a Seamless Carousel, a Cell belongs to the Slide holding its centre', () => {
    // Widths 0.6, 0.8, 0.6 of 2 Slides: a/b span 0..0.6, c spans 0.6..1.4 (centre 1.0 → Slide 2), d 1.4..2.
    const layout: Layout = { postType: 'seamless', slideCount: 2, root: row([column([cell('a'), cell('b')]), cell('c'), cell('d')], [0.3, 0.4, 0.3]) };
    // Slide 1: a (top), then b. Slide 2: c and d both start at the top; c is further left.
    expect(cellOrder(layout).map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
    // Narrow c so its centre (0.65) falls in Slide 1: a and c both start at the top, so a, c, then b.
    const shifted: Layout = { postType: 'seamless', slideCount: 2, root: row([column([cell('a'), cell('b')]), cell('c'), cell('d')], [0.2, 0.25, 0.55]) };
    expect(cellOrder(shifted).map((c) => c.id)).toEqual(['a', 'c', 'b', 'd']);
  });
});

describe('AUT-03 orientation', () => {
  it('classes shapes with a 10% band for square', () => {
    expect(shapeOf(1.2, 1)).toBe('landscape');
    expect(shapeOf(1, 1.05)).toBe('square');
    expect(shapeOf(0.8, 1)).toBe('portrait');
  });
  it('panel [landscape A, portrait B, portrait C] into Cells [portrait, landscape, portrait] places B, A, C', () => {
    // A 1:1 Collage: a narrow Cell (portrait), a wide band (landscape), another narrow Cell (portrait).
    const narrow = (id: string) => row([cell(id), { kind: 'spacer' }], [0.3, 0.7]);
    const post: Post = { ...collage({ postType: 'collage', root: column([narrow('x'), cell('y'), narrow('z')], [0.45, 0.1, 0.45]) }), aspectRatio: '1:1' };
    const photos = { A: meta('A', 3000, 2000), B: meta('B', 2000, 3000), C: meta('C', 2000, 3000) };
    const { layout } = fillEmptyCells(post, ['A', 'B', 'C'], photos);
    expect(cellsOf(layout).map((c) => c.photo?.photoId)).toEqual(['B', 'A', 'C']);
  });
  it('takes the next photo when none of the next three matches', () => {
    const post: Post = { ...collage({ postType: 'collage', root: cell('x') }), aspectRatio: '1:1' };
    const photos = { A: meta('A', 3000, 2000), B: meta('B', 3000, 2000), C: meta('C', 3000, 2000), D: meta('D', 1000, 1000) };
    expect(cellsOf(fillEmptyCells(post, ['A', 'B', 'C', 'D'], photos).layout)[0]!.photo?.photoId).toBe('A');
  });
  it('AUT-04: never touches filled Cells', () => {
    const post = collage({ postType: 'collage', root: row([cell('x', 'P'), cell('y')]) });
    const { layout } = fillEmptyCells(post, ['A'], { A: meta('A', 1000, 1000), P: meta('P', 1000, 1000) });
    expect(cellsOf(layout).map((c) => c.photo?.photoId)).toEqual(['P', 'A']);
  });
});

describe('AUT-08 switching Template', () => {
  it('switching a 4-photo Grid 2×2 to Side by side places photos 1–2 and unplaces 3–4', () => {
    const photos = Object.fromEntries(['p1', 'p2', 'p3', 'p4'].map((id) => [id, meta(id, 3000, 4000)]));
    const grid = postFromTemplate(templateById('collage-grid-2x2')!, '4:5');
    const filled = { ...grid, layout: fillEmptyCells(grid, ['p1', 'p2', 'p3', 'p4'], photos).layout };
    const next = switchLayout(filled, postFromTemplate(templateById('collage-side-by-side')!, '4:5'), photos);
    expect(cellsOf(next.layout).map((c) => c.photo?.photoId)).toEqual(['p1', 'p2']);
    expect(next.sourceTemplate?.id).toBe('collage-side-by-side');
    expect(next.style.gap).toBe(0.01);
  });
  it('resets framing to the default', () => {
    const photos = { p1: meta('p1', 3000, 4000) };
    const single = postFromTemplate(templateById('collage-single-framed')!, '4:5');
    const zoomed: Post = {
      ...single,
      layout: mapCellsFraming(fillEmptyCells(single, ['p1'], photos).layout),
    };
    const next = switchLayout(zoomed, postFromTemplate(templateById('collage-grid-2x2')!, '4:5'), photos);
    expect(cellsOf(next.layout)[0]!.photo?.framing).toEqual({ zoom: 1, focusX: 0.5, focusY: 0.5, rotate90: 0, straighten: 0 });
  });
});

function mapCellsFraming(layout: Layout): Layout {
  return mapCells(layout, (c) => (c.photo ? { ...c, photo: { ...c.photo, framing: { zoom: 3, focusX: 0.2, focusY: 0.8, rotate90: 90, straighten: 4 } } } : c));
}

describe('TPL-04 / TPL-11 picker order', () => {
  it('with 4 photos in a Collage, Grid 2×2, Hero + 3 and Mosaic come first', async () => {
    const { pickerSections } = await import('../../src/shared/templates/picker.ts');
    const [section] = pickerSections('collage', '4:5', 1, 4);
    expect(section!.entries.slice(0, 3).map((e) => e.template.id)).toEqual(['collage-grid-2x2', 'collage-hero-3', 'collage-mosaic']);
    expect(section!.entries.map((e) => e.photos)).toEqual([4, 4, 4, 1, 2, 3, 3, 9]);
  });
  it('without photos, sorts by photo count, ties in TPL-06 order', async () => {
    const { pickerSections } = await import('../../src/shared/templates/picker.ts');
    const ids = pickerSections('collage', '4:5', 1, 0)[0]!.entries.map((e) => e.template.id);
    expect(ids).toEqual(['collage-single-framed', 'collage-side-by-side', 'collage-three-columns', 'collage-hero-2', 'collage-grid-2x2', 'collage-hero-3', 'collage-mosaic', 'collage-grid-3x3']);
  });
  it('at 9:16 lists Story Templates first, then Collage; at 4:5 no Story Templates', async () => {
    const { pickerSections } = await import('../../src/shared/templates/picker.ts');
    expect(pickerSections('collage', '9:16', 1, 0).map((s) => s.kind)).toEqual(['story', 'collage']);
    expect(pickerSections('collage', '4:5', 1, 0).map((s) => s.kind)).toEqual(['collage']);
  });
});
