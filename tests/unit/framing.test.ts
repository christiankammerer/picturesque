// SPDX-License-Identifier: GPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { apply, placePhoto } from '../../src/shared/render/framing.ts';
import { expectCovered } from './fixtures.ts';

const framingArb = fc.record({
  zoom: fc.double({ min: 1, max: 10, noNaN: true }),
  focusX: fc.double({ min: 0, max: 1, noNaN: true }),
  focusY: fc.double({ min: 0, max: 1, noNaN: true }),
  rotate90: fc.constantFrom(0 as const, 90 as const, 180 as const, 270 as const),
  straighten: fc.double({ min: -15, max: 15, noNaN: true }),
});

describe('RND-07 photo placement', () => {
  it('property: the rectangle is always fully covered by the photo', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.double({ min: -500, max: 500, noNaN: true }),
          y: fc.double({ min: -500, max: 500, noNaN: true }),
          w: fc.double({ min: 1, max: 3000, noNaN: true }),
          h: fc.double({ min: 1, max: 3000, noNaN: true }),
        }),
        fc.integer({ min: 16, max: 8000 }),
        fc.integer({ min: 16, max: 8000 }),
        framingArb,
        (rect, bw, bh, framing) => expectCovered(rect, bw, bh, framing),
      ),
      { numRuns: 2000 },
    );
  });

  it('at zoom 1 with no rotation, covers exactly along the tighter axis', () => {
    const p = placePhoto({ x: 0, y: 0, w: 100, h: 100 }, 400, 200, { zoom: 1, focusX: 0.5, focusY: 0.5, rotate90: 0, straighten: 0 });
    expect(p.scale).toBeCloseTo(0.5);
    expect(apply(p.transform, 200, 100)).toEqual([50, 50]); // photo centre at rect centre
  });

  it('puts the focus point at the centre when it does not need clamping', () => {
    const framing = { zoom: 2, focusX: 0.4, focusY: 0.6, rotate90: 0 as const, straighten: 0 };
    const p = placePhoto({ x: 10, y: 20, w: 100, h: 100 }, 1000, 1000, framing);
    const [x, y] = apply(p.transform, 400, 600);
    expect(x).toBeCloseTo(60);
    expect(y).toBeCloseTo(70);
  });

  it('clamps the focus point so the edge never shows', () => {
    const p = placePhoto({ x: 0, y: 0, w: 100, h: 100 }, 1000, 500, { zoom: 1, focusX: 0, focusY: 0, rotate90: 0, straighten: 0 });
    expect(apply(p.transform, 0, 0)).toEqual([0, 0]);
  });

  it('rotate90 turns clockwise: the photo top-left goes to the top-right', () => {
    const p = placePhoto({ x: 0, y: 0, w: 100, h: 100 }, 100, 100, { zoom: 1, focusX: 0.5, focusY: 0.5, rotate90: 90, straighten: 0 });
    const [x, y] = apply(p.transform, 0, 0);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(0);
  });

  it('focus is in the rotated photo space', () => {
    // A 200×100 photo turned 90° is 100 wide, 200 tall. focusY = 0 shows its top.
    const p = placePhoto({ x: 0, y: 0, w: 100, h: 100 }, 200, 100, { zoom: 1, focusX: 0.5, focusY: 0, rotate90: 90, straighten: 0 });
    // The rotated top edge is the original left edge (x = 0); its middle (y = 50) is at the rect's top.
    const [x, y] = apply(p.transform, 0, 50);
    expect(x).toBeCloseTo(50);
    expect(y).toBeCloseTo(0);
  });

  it('straightening scales up just enough to cover', () => {
    const s = (7 * Math.PI) / 180;
    const p = placePhoto({ x: 0, y: 0, w: 100, h: 100 }, 100, 100, { zoom: 1, focusX: 0.5, focusY: 0.5, rotate90: 0, straighten: 7 });
    expect(p.scale).toBeCloseTo(Math.cos(s) + Math.sin(s), 12);
  });
});
