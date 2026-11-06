// SPDX-License-Identifier: GPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canvasExtent, leafRects, MIN_LEAF_SIZE, type Rect } from '../../src/shared/model/geometry.ts';
import { moveDivider, newCellId, normalizeLayout, nodeAt } from '../../src/shared/model/layout-ops.ts';
import { aspectRatiosFor, canvasPixelSize, newPost, setAspectRatio } from '../../src/shared/model/post.ts';
import {
  CellNodeSchema,
  cellsOf,
  LayoutStyleSchema,
  PostSchema,
  RATIO_HEIGHT,
  type Layout,
  type LayoutNode,
  type Post,
} from '../../src/shared/model/schema.ts';
import { innerRect } from '../../src/shared/render/render.ts';
import { cell, column, expectCovered, grid2x2, row, STYLE } from './fixtures.ts';

const issues = (value: unknown) => {
  const r = PostSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('MOD-01 Post types', () => {
  it('rejects type "story"; a Story is a 9:16 Collage', () => {
    const post = newPost('story');
    expect(post.type).toBe('collage');
    expect(post.aspectRatio).toBe('9:16');
    expect(PostSchema.safeParse(post).success).toBe(true);
    expect(PostSchema.safeParse({ ...post, type: 'story' }).success).toBe(false);
  });
});

describe('MOD-04 Aspect Ratios', () => {
  it('offers 1:1, 4:5, 3:4 for Carousels and adds 9:16 for a Collage', () => {
    expect(aspectRatiosFor('carousel')).toEqual(['1:1', '4:5', '3:4']);
    expect(aspectRatiosFor('seamless')).toEqual(['1:1', '4:5', '3:4']);
    expect(aspectRatiosFor('collage')).toEqual(['1:1', '4:5', '3:4', '9:16']);
  });
  it('rejects 9:16 for a Carousel or Seamless Carousel', () => {
    expect(issues({ ...newPost('carousel'), aspectRatio: '9:16' })).toContain('9:16 is only allowed for a Collage (Story)');
    expect(issues({ ...newPost('seamless'), aspectRatio: '9:16' })).toContain('9:16 is only allowed for a Collage (Story)');
  });
  it('has no landscape ratio', () => {
    expect(PostSchema.safeParse({ ...newPost('collage'), aspectRatio: '16:9' }).success).toBe(false);
  });
});

describe('MOD-05 defaults', () => {
  it('starts Collages and Carousels at 4:5 and Stories at 9:16', () => {
    expect(newPost('collage').aspectRatio).toBe('4:5');
    expect(newPost('carousel').aspectRatio).toBe('4:5');
    expect(newPost('seamless').aspectRatio).toBe('4:5');
    expect(newPost('story').aspectRatio).toBe('9:16');
  });
  it('makes valid Posts', () => {
    for (const kind of ['collage', 'story', 'carousel', 'seamless'] as const) {
      expect(issues(newPost(kind))).toEqual([]);
    }
  });
});

describe('MOD-06 one Aspect Ratio per Post', () => {
  it('has a single aspectRatio field and none per Slide', () => {
    const post = newPost('carousel');
    expect(Object.keys(post)).toContain('aspectRatio');
    expect(JSON.stringify(post.layout)).not.toContain('aspectRatio');
  });
});

describe('MOD-07 changing the Aspect Ratio', () => {
  it('leaves layout, textBoxes and framing byte-identical', () => {
    const post = grid2x2();
    const changed = setAspectRatio(post, '1:1');
    expect(changed.aspectRatio).toBe('1:1');
    expect(JSON.stringify(changed.layout)).toBe(JSON.stringify(post.layout));
    expect(JSON.stringify(changed.textBoxes)).toBe(JSON.stringify(post.textBoxes));
  });
  it('refuses a ratio the type does not allow', () => {
    expect(() => setAspectRatio(newPost('carousel'), '9:16')).toThrow();
  });
  it('keeps every Cell covered at every ratio', () => {
    const post = grid2x2({ gap: 0.02 });
    for (const ratio of aspectRatiosFor('collage')) {
      const p = setAspectRatio(post, ratio);
      const s = 1080;
      for (const leaf of leafRects(p.layout)) {
        const r = innerRect(leaf, s, s * RATIO_HEIGHT[ratio], p.style.gap * s);
        expectCovered(r, 4032, 3024, { zoom: 1, focusX: 0.9, focusY: 0.1, rotate90: 0, straighten: 0 });
      }
    }
  });
});

describe('MOD-08 canvas', () => {
  it('a 5-Slide Seamless Carousel spans x = 0..5', () => {
    const layout: Layout = { postType: 'seamless', slideCount: 5, root: cell('a') };
    expect(canvasExtent(layout)).toEqual({ width: 5, height: 1 });
    expect(leafRects(layout)[0]!.rect).toEqual({ x0: 0, y0: 0, x1: 5, y1: 1 });
  });
  it('RND-03: a 4:5 Post is 1350 px tall per Slide at scale 1080', () => {
    expect(canvasPixelSize(newPost('collage'), 1080)).toEqual({ width: 1080, height: 1350 });
    expect(canvasPixelSize({ aspectRatio: '3:4', layout: { postType: 'seamless', slideCount: 4, root: cell('a') } }, 1080))
      .toEqual({ width: 4320, height: 1440 });
  });
});

// ---------- MOD-09 tiling ----------

/** Random valid split trees, each leaf comfortably above the minimum size. */
function arbTree(depth: number): fc.Arbitrary<LayoutNode> {
  const leaf: fc.Arbitrary<LayoutNode> = fc.oneof(
    fc.constant<LayoutNode>({ kind: 'spacer' }),
    fc.uuid().map<LayoutNode>((id) => ({ kind: 'cell', id })),
  );
  if (depth === 0) return leaf;
  const split = fc
    .record({
      direction: fc.constantFrom('row' as const, 'column' as const),
      weights: fc.array(fc.double({ min: 0.2, max: 1, noNaN: true }), { minLength: 2, maxLength: 4 }),
    })
    .chain(({ direction, weights }) =>
      fc.tuple(...weights.map(() => arbTree(depth - 1))).map<LayoutNode>((children) => {
        const total = weights.reduce((a, b) => a + b, 0);
        return { kind: 'split', direction, sizes: weights.map((w) => w / total), children };
      }),
    );
  return fc.oneof({ weight: 1, arbitrary: leaf }, { weight: 2, arbitrary: split });
}

const area = (r: Rect) => (r.x1 - r.x0) * (r.y1 - r.y0);
const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

describe('MOD-09 split tree tiling', () => {
  it('property: leaf rectangles tile the canvas with no overlap and no hole', () => {
    fc.assert(
      fc.property(arbTree(4), fc.integer({ min: 1, max: 20 }), (root, slides) => {
        const layout: Layout = slides === 1 ? { postType: 'collage', root } : { postType: 'seamless', slideCount: slides, root };
        const leaves = leafRects(layout).map((l) => l.rect);
        const total = leaves.reduce((a, r) => a + area(r), 0);
        expect(total).toBeCloseTo(slides, 9);
        for (let i = 0; i < leaves.length; i++) {
          const r = leaves[i]!;
          expect(r.x0).toBeGreaterThanOrEqual(0);
          expect(r.y0).toBeGreaterThanOrEqual(0);
          expect(r.x1).toBeLessThanOrEqual(slides);
          expect(r.y1).toBeLessThanOrEqual(1);
          for (let j = i + 1; j < leaves.length; j++) expect(overlap(r, leaves[j]!)).toBeLessThan(1e-12);
        }
        // No hole: sample random points; each lies in exactly one leaf.
        for (let k = 0; k < 20; k++) {
          const x = ((k * 7919) % 1000) / 1000 * slides + 1e-7;
          const y = ((k * 104729) % 997) / 997 + 1e-7;
          const hits = leaves.filter((r) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1).length;
          expect(hits).toBe(1);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('rejects sizes that do not sum to 1 or do not match the children', () => {
    const bad = grid2x2();
    (bad.layout as { root: LayoutNode }).root = row([cell('a'), cell('b')], [0.5, 0.6]);
    expect(issues(bad).some((m) => m.includes('sum'))).toBe(true);
    (bad.layout as { root: LayoutNode }).root = row([cell('a'), cell('b')], [1]);
    expect(issues(bad)).toContain('one size per child');
  });
});

describe('MOD-10 Seamless Cells may cross Slide edges', () => {
  it('a Cell spanning x = 0.5..1.5 is valid', () => {
    const post: Post = {
      type: 'seamless',
      aspectRatio: '4:5',
      layout: { postType: 'seamless', slideCount: 2, root: row([cell('a'), cell('b'), cell('c')], [0.25, 0.5, 0.25]) },
      style: STYLE,
      textBoxes: [],
    };
    expect(issues(post)).toEqual([]);
    expect(leafRects(post.layout)[1]!.rect).toMatchObject({ x0: 0.5, x1: 1.5 });
  });
});

describe('MOD-11 no one-child splits', () => {
  it('the schema rejects a split with one child', () => {
    const post = grid2x2();
    (post.layout as { root: LayoutNode }).root = { kind: 'split', direction: 'row', sizes: [1], children: [cell('a')] };
    expect(issues(post)).toContain('a split has at least 2 children');
  });
  it('normalising replaces a split left with one child by that child', () => {
    const layout: Layout = {
      postType: 'collage',
      root: column([{ kind: 'split', direction: 'row', sizes: [1], children: [cell('a')] }, cell('b')]),
    };
    const n = normalizeLayout(layout);
    expect(n).toEqual({ postType: 'collage', root: column([cell('a'), cell('b')]) });
  });
});

describe('MOD-12 minimum leaf size', () => {
  it('the schema rejects a leaf narrower than 0.05 Slide units', () => {
    const post = grid2x2();
    (post.layout as { root: LayoutNode }).root = row([cell('a'), cell('b')], [0.96, 0.04]);
    expect(issues(post).some((m) => m.includes('minimum'))).toBe(true);
  });
  it('accepts a leaf at exactly the minimum', () => {
    const post = grid2x2();
    (post.layout as { root: LayoutNode }).root = row([cell('a'), cell('b')], [0.95, 0.05]);
    expect(issues(post)).toEqual([]);
  });
  it('a divider drag stops at the limit', () => {
    const layout: Layout = { postType: 'collage', root: row([cell('a'), cell('b')]) };
    const moved = moveDivider(layout, [], 0, 0.999);
    const leaves = leafRects(moved);
    expect(leaves[1]!.rect.x1 - leaves[1]!.rect.x0).toBeCloseTo(MIN_LEAF_SIZE, 12);
    const back = moveDivider(layout, [], 0, -3);
    expect(leafRects(back)[0]!.rect.x1).toBeCloseTo(MIN_LEAF_SIZE, 12);
  });
  it('the limit accounts for the smallest leaf inside a nested split', () => {
    // Left child is a row split 50/50, so its leaves reach the limit when it is 0.1 wide.
    const layout: Layout = { postType: 'collage', root: row([row([cell('a'), cell('b')]), cell('c')]) };
    const moved = moveDivider(layout, [], 0, 0);
    const leaves = leafRects(moved);
    expect(leaves[0]!.rect.x1 - leaves[0]!.rect.x0).toBeCloseTo(MIN_LEAF_SIZE, 12);
    expect(leaves[1]!.rect.x1 - leaves[1]!.rect.x0).toBeCloseTo(MIN_LEAF_SIZE, 12);
  });
  it('property: any drag keeps the Layout valid and the sizes summing to 1', () => {
    fc.assert(
      fc.property(fc.double({ min: -1, max: 2, noNaN: true }), (pos) => {
        const post = grid2x2();
        const layout = moveDivider(post.layout, [1], 0, pos);
        expect(issues({ ...post, layout })).toEqual([]);
        const split = nodeAt(layout, [1])!.node;
        expect(split.kind === 'split' && split.sizes.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      }),
    );
  });
  it('in a Carousel, the path starts with the Slide', () => {
    const layout: Layout = { postType: 'carousel', slides: [cell('x'), row([cell('a'), cell('b')])] };
    const moved = moveDivider(layout, [1], 0, 0.3);
    expect(leafRects(moved)[1]!.rect).toMatchObject({ x0: 1, x1: 1.3 });
  });
});

describe('MOD-13 Cell ids', () => {
  it('rejects duplicate Cell ids within a Post', () => {
    const post = grid2x2();
    (post.layout as { root: LayoutNode }).root = row([cell('a'), cell('a')]);
    expect(issues(post)).toContain('duplicate Cell id a');
  });
  it('rejects duplicates across Carousel Slides', () => {
    const post = newPost('carousel');
    const [first] = cellsOf(post.layout);
    const layout = { postType: 'carousel' as const, slides: [first!, { ...first! }, cell('z')] };
    expect(issues({ ...post, layout })).toContain(`duplicate Cell id ${first!.id}`);
  });
  it('fresh ids are unique', () => {
    const ids = new Set(Array.from({ length: 1000 }, newCellId));
    expect(ids.size).toBe(1000);
  });
  it('edits keep Cell ids', () => {
    const post = grid2x2();
    const before = cellsOf(post.layout).map((c) => c.id);
    const after = cellsOf(moveDivider(post.layout, [], 0, 0.3)).map((c) => c.id);
    expect(after).toEqual(before);
  });
});

describe('MOD-19 Layout-wide styling only', () => {
  it('a Cell carries no style', () => {
    expect(Object.keys(CellNodeSchema.shape).sort()).toEqual(['id', 'kind', 'photo']);
  });
  it('the style is exactly gap, corner radius, border width, border colour, background', () => {
    expect(Object.keys(LayoutStyleSchema.shape).sort()).toEqual(
      ['background', 'borderColor', 'borderWidth', 'cornerRadius', 'gap'],
    );
  });
});

describe('MOD-20 style ranges', () => {
  it.each([
    ['gap', 0.15, 0.151],
    ['cornerRadius', 0.15, 0.151],
    ['borderWidth', 0.05, 0.051],
  ] as const)('%s accepts up to %d', (key, ok, bad) => {
    expect(LayoutStyleSchema.safeParse({ ...STYLE, [key]: ok }).success).toBe(true);
    expect(LayoutStyleSchema.safeParse({ ...STYLE, [key]: bad }).success).toBe(false);
    expect(LayoutStyleSchema.safeParse({ ...STYLE, [key]: -0.01 }).success).toBe(false);
  });
  it('colours are lower-case #rrggbb', () => {
    expect(LayoutStyleSchema.safeParse({ ...STYLE, background: '#FFFFFF' }).success).toBe(false);
    expect(LayoutStyleSchema.safeParse({ ...STYLE, background: '#fff' }).success).toBe(false);
  });
});
