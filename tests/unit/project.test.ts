// SPDX-License-Identifier: GPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { newPost } from '../../src/shared/model/post.ts';
import {
  addPhotos, emptyCell, emptyProject, findCell, movePhoto, placePhoto, removePhotos, resetFraming, rotateCell,
  setFraming, sortByDate, usageCounts, type Project,
} from '../../src/shared/model/project.ts';
import { cellsOf, DEFAULT_FRAMING, PostSchema, type PhotoMeta } from '../../src/shared/model/schema.ts';
import { clampFocus, panFraming, zoomFramingAt } from '../../src/shared/render/framing.ts';
import { BUILT_IN_TEMPLATES, postFromTemplate, templateById } from '../../src/shared/templates/builtins.ts';
import { matchingPreset, presetStyle, STYLE_PRESETS } from '../../src/shared/templates/presets.ts';
import * as framingFns from '../../src/shared/render/framing.ts';
import { expectCovered } from './fixtures.ts';

const meta = (id: string, captureDate: string): PhotoMeta => ({
  id, ext: 'jpg', originalName: `${id}.jpg`, captureDate, width: 4000, height: 3000,
});

function grid(): { project: Project; cells: string[] } {
  const post = postFromTemplate(templateById('collage-grid-2x2')!, '4:5');
  const project = addPhotos(emptyProject(post), [
    meta('p1', '2026-07-01T10:00:00Z'), meta('p2', '2026-07-02T10:00:00Z'), meta('p3', '2026-07-03T10:00:00Z'),
  ]);
  return { project, cells: cellsOf(post.layout).map((c) => c.id) };
}
const photoIn = (p: Project, cell: string) => findCell(p.post.layout, cell)?.photo;

describe('EDT-03 new Posts', () => {
  it('a new Carousel is "One per Slide" at 4:5 with 3 Slides', () => {
    const post = newPost('carousel');
    expect(post.sourceTemplate?.id).toBe('carousel-one-per-slide');
    expect(post.aspectRatio).toBe('4:5');
    expect(post.layout.postType === 'carousel' && post.layout.slides.length).toBe(3);
    expect(post.style).toEqual(presetStyle('none'));
  });
  it('a new Collage is "Single framed" with the Gallery style; a new Story is the Story one at 9:16', () => {
    expect(newPost('collage').sourceTemplate?.id).toBe('collage-single-framed');
    expect(newPost('collage').style).toEqual(presetStyle('gallery'));
    expect(newPost('story').sourceTemplate?.id).toBe('story-single-framed');
    expect(newPost('story').aspectRatio).toBe('9:16');
  });
  it('every built-in Template makes a valid Post', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      const post = postFromTemplate(t, t.kind === 'story' ? '9:16' : '4:5', 3);
      expect(PostSchema.safeParse(post).success, t.id).toBe(true);
    }
  });
  it('applying a Template twice gives fresh Cell ids', () => {
    const t = templateById('collage-grid-2x2')!;
    const a = cellsOf(postFromTemplate(t, '4:5').layout).map((c) => c.id);
    const b = cellsOf(postFromTemplate(t, '4:5').layout).map((c) => c.id);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });
});

describe('TPL-09 / TPL-10 Style Presets', () => {
  it('has the six Presets in inspector order', () => {
    expect(STYLE_PRESETS.map((p) => p.id)).toEqual(['none', 'clean', 'gallery', 'black-frame', 'soft', 'film']);
    expect(presetStyle('soft')).toEqual({ gap: 0.02, cornerRadius: 0.03, borderWidth: 0, borderColor: '#000000', background: '#f4efe6' });
  });
  it('a Preset matches only while all five values match', () => {
    expect(matchingPreset(presetStyle('clean'))).toBe('clean');
    expect(matchingPreset({ ...presetStyle('clean'), gap: 0.02 })).toBeUndefined();
  });
});

describe('EDT-08 / EDT-09 the Photos panel', () => {
  it('sorts by capture date, oldest first, and ignores photos already there', () => {
    let p = emptyProject(newPost('collage'));
    p = addPhotos(p, [meta('b', '2026-07-02T00:00:00Z'), meta('a', '2026-07-01T00:00:00Z')]);
    p = addPhotos(p, [meta('c', '2026-06-30T00:00:00Z'), meta('a', '2026-07-01T00:00:00Z')]);
    expect(p.panelOrder).toEqual(['c', 'a', 'b']);
  });
  it('keeps import order for equal dates, and puts unparseable dates last', () => {
    const photos = { x: meta('x', '2026-01-01T00:00:00Z'), y: meta('y', '2026-01-01T00:00:00Z'), z: meta('z', 'bad') };
    expect(sortByDate(['z', 'y', 'x'], photos)).toEqual(['y', 'x', 'z']);
  });
  it('placing one photo in two Cells counts ×2', () => {
    const { project, cells } = grid();
    const p = placePhoto(placePhoto(project, cells[0]!, 'p1'), cells[1]!, 'p1');
    expect(usageCounts(p.post.layout).get('p1')).toBe(2);
  });
});

describe('EDT-11 removing photos', () => {
  it('removing a photo used in two Cells empties both', () => {
    const { project, cells } = grid();
    const p = removePhotos(placePhoto(placePhoto(project, cells[0]!, 'p1'), cells[1]!, 'p1'), ['p1']);
    expect(photoIn(p, cells[0]!)).toBeUndefined();
    expect(photoIn(p, cells[1]!)).toBeUndefined();
    expect(p.photos.p1).toBeUndefined();
    expect(p.panelOrder).toEqual(['p2', 'p3']);
  });
});

describe('EDT-13 / EDT-14 placing and moving', () => {
  it('places with default framing', () => {
    const { project, cells } = grid();
    expect(photoIn(placePhoto(project, cells[0]!, 'p1'), cells[0]!)).toEqual({ photoId: 'p1', framing: DEFAULT_FRAMING });
  });
  it('Cell → filled Cell swaps, resetting framing but keeping rotate90', () => {
    const { project, cells } = grid();
    let p = placePhoto(placePhoto(project, cells[0]!, 'p1'), cells[1]!, 'p2');
    p = setFraming(p, cells[0]!, { zoom: 3, focusX: 0.2, focusY: 0.3, rotate90: 90, straighten: 5 });
    p = movePhoto(p, cells[0]!, cells[1]!);
    expect(photoIn(p, cells[1]!)).toEqual({ photoId: 'p1', framing: { ...DEFAULT_FRAMING, rotate90: 90 } });
    expect(photoIn(p, cells[0]!)).toEqual({ photoId: 'p2', framing: DEFAULT_FRAMING });
  });
  it('Cell → empty Cell moves', () => {
    const { project, cells } = grid();
    const p = movePhoto(placePhoto(project, cells[0]!, 'p1'), cells[0]!, cells[3]!);
    expect(photoIn(p, cells[0]!)).toBeUndefined();
    expect(photoIn(p, cells[3]!)?.photoId).toBe('p1');
  });
  it('Cell → panel unplaces', () => {
    const { project, cells } = grid();
    const p = emptyCell(placePhoto(project, cells[0]!, 'p1'), cells[0]!);
    expect(photoIn(p, cells[0]!)).toBeUndefined();
    expect(p.photos.p1).toBeDefined();
  });
  it('panel → filled Cell replaces; the old photo stays in the Project', () => {
    const { project, cells } = grid();
    const p = placePhoto(placePhoto(project, cells[0]!, 'p1'), cells[0]!, 'p2');
    expect(photoIn(p, cells[0]!)?.photoId).toBe('p2');
    expect(usageCounts(p.post.layout).get('p1')).toBeUndefined();
  });
  it('an unknown photo or Cell changes nothing', () => {
    const { project, cells } = grid();
    expect(placePhoto(project, cells[0]!, 'nope')).toBe(project);
    expect(movePhoto(project, 'nope', cells[0]!)).toBe(project);
  });
});

describe('EDT-15 framing', () => {
  it('rotates clockwise in quarter turns', () => {
    const { project, cells } = grid();
    let p = placePhoto(project, cells[0]!, 'p1');
    for (const expected of [90, 180, 270, 0]) {
      p = rotateCell(p, cells[0]!);
      expect(photoIn(p, cells[0]!)?.framing.rotate90).toBe(expected);
    }
  });
  it('reset framing keeps the quarter turn', () => {
    const { project, cells } = grid();
    let p = setFraming(placePhoto(project, cells[0]!, 'p1'), cells[0]!, { zoom: 4, focusX: 0.1, focusY: 0.9, rotate90: 270, straighten: -3 });
    p = resetFraming(p, cells[0]!);
    expect(photoIn(p, cells[0]!)?.framing).toEqual({ ...DEFAULT_FRAMING, rotate90: 270 });
  });

  const rect = { x: 100, y: 50, w: 300, h: 400 };
  it('panning moves the photo with the pointer', () => {
    const f = { ...DEFAULT_FRAMING, zoom: 2 };
    const moved = panFraming(rect, 4000, 3000, f, 30, 0);
    expect(moved.focusX).toBeLessThan(0.5);
    expect(moved.focusY).toBeCloseTo(0.5);
  });
  it('panning stops at the edge, and the stored focus is what is shown', () => {
    const f = panFraming(rect, 4000, 3000, DEFAULT_FRAMING, 10_000, 10_000);
    expect(f).toEqual(clampFocus(rect, 4000, 3000, f));
    const back = panFraming(rect, 4000, 3000, f, -5, 0);
    expect(back.focusX).toBeGreaterThan(f.focusX); // moving back responds at once
  });
  it('zooming keeps the point under the pointer in place', () => {
    const f = { ...DEFAULT_FRAMING, zoom: 2 };
    const z = zoomFramingAt(rect, 4000, 3000, f, 1.5, 200, 200);
    expect(z.zoom).toBeCloseTo(3);
    // The photo point under (200, 200) is the same before and after.
    const { placePhoto, invert, apply } = framingFns;
    const before = apply(invert(placePhoto(rect, 4000, 3000, f).transform), 200, 200);
    const after = apply(invert(placePhoto(rect, 4000, 3000, z).transform), 200, 200);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });
  it('zoom stays within 1..10', () => {
    expect(zoomFramingAt(rect, 4000, 3000, DEFAULT_FRAMING, 0.1, 0, 0).zoom).toBe(1);
    expect(zoomFramingAt(rect, 4000, 3000, { ...DEFAULT_FRAMING, zoom: 9 }, 5, 0, 0).zoom).toBe(10);
  });
  it('property: no gap ever appears during pan, zoom or straighten', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom('pan', 'zoom', 'straighten'), fc.double({ min: -500, max: 500, noNaN: true }), fc.double({ min: -500, max: 500, noNaN: true })), { maxLength: 12 }),
        (ops) => {
          let f = { ...DEFAULT_FRAMING };
          for (const [op, a, b] of ops) {
            if (op === 'pan') f = panFraming(rect, 4000, 3000, f, a, b);
            else if (op === 'zoom') f = zoomFramingAt(rect, 4000, 3000, f, Math.exp(a / 500), rect.x + Math.abs(b) % rect.w, rect.y + 10);
            else f = clampFocus(rect, 4000, 3000, { ...f, straighten: Math.max(-15, Math.min(15, a / 30)) });
            expectCovered(rect, 4000, 3000, f);
            expect(f.zoom).toBeGreaterThanOrEqual(1);
            expect(f.zoom).toBeLessThanOrEqual(10);
          }
        },
      ),
    );
  });
});

