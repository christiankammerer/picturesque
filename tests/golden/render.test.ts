// SPDX-License-Identifier: GPL-3.0-or-later
import { beforeAll, describe, expect, it } from 'vitest';
import { STYLE_PRESET_BLACK_FRAME } from './presets.ts';
import { canvasPixelSize } from '../../src/shared/model/post.ts';
import { DEFAULT_FRAMING, type Framing, type LayoutNode, type LayoutStyle, type Post, type TextBox } from '../../src/shared/model/schema.ts';
import { render, type PhotoSource } from '../../src/shared/render/render.ts';
import {
  bitmapOf,
  diffFraction,
  expectGolden,
  hex,
  loadInter,
  meanAbsDiff,
  pixelAt,
  pixels,
  renderToCanvas,
  solid,
  testPattern,
} from './golden.ts';

const STYLE: LayoutStyle = { gap: 0, cornerRadius: 0, borderWidth: 0, borderColor: '#000000', background: '#ffffff' };
const photosById = new Map<string, ImageBitmap>();
const photos: PhotoSource = (id) => photosById.get(id);

beforeAll(async () => {
  photosById.set('land', await bitmapOf(testPattern(1200, 800, 200)));
  photosById.set('port', await bitmapOf(testPattern(800, 1200, 20)));
  photosById.set('square', await bitmapOf(testPattern(900, 900, 120)));
  photosById.set('wide', await bitmapOf(testPattern(3000, 800, 280)));
  photosById.set('blue', await solid('#0000ff'));
  await loadInter();
});

const f = (over: Partial<Framing> = {}): Framing => ({ ...DEFAULT_FRAMING, ...over });
const cell = (id: string, photoId?: string, framing?: Partial<Framing>): LayoutNode =>
  photoId ? { kind: 'cell', id, photo: { photoId, framing: f(framing) } } : { kind: 'cell', id };
const row = (children: LayoutNode[], sizes?: number[]): LayoutNode => ({
  kind: 'split', direction: 'row', sizes: sizes ?? children.map(() => 1 / children.length), children,
});
const column = (children: LayoutNode[], sizes?: number[]): LayoutNode => ({
  kind: 'split', direction: 'column', sizes: sizes ?? children.map(() => 1 / children.length), children,
});
const collage = (root: LayoutNode, style: Partial<LayoutStyle> = {}, aspectRatio: Post['aspectRatio'] = '4:5'): Post => ({
  type: 'collage', aspectRatio, layout: { postType: 'collage', root }, style: { ...STYLE, ...style }, textBoxes: [],
});
const grid = (style: Partial<LayoutStyle> = {}, aspectRatio: Post['aspectRatio'] = '4:5'): Post =>
  collage(column([row([cell('a', 'land'), cell('b', 'port')]), row([cell('c', 'square'), cell('d', 'wide')])]), style, aspectRatio);
const text = (over: Partial<TextBox>): TextBox => ({
  id: 't', text: 'Summer', x: 0.1, y: 0.1, width: 0.8, font: { family: 'Inter', source: 'bundled' },
  size: 0.08, weight: 700, color: '#ffffff', align: 'center', ...over,
});

describe('RND-01 purity', () => {
  it('the same inputs give byte-identical pixels', () => {
    const post = { ...grid({ gap: 0.02, cornerRadius: 0.03, borderWidth: 0.01, borderColor: '#222222' }), textBoxes: [text({})] };
    const a = pixels(renderToCanvas(post, photos, { scale: 400 }));
    const b = pixels(renderToCanvas(post, photos, { scale: 400 }));
    expect(diffFraction(a, b, 0)).toBe(0);
  });

  it('does not modify the Post', () => {
    const post = grid({ gap: 0.02 });
    const deepFreeze = (o: object): void => {
      Object.freeze(o);
      for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
    };
    deepFreeze(post);
    expect(() => renderToCanvas(post, photos, { scale: 200 })).not.toThrow();
  });

  it('does not depend on, or change, the state the caller left in the context', () => {
    const post = { ...grid({ gap: 0.02, borderWidth: 0.01 }), textBoxes: [text({})] };
    const clean = pixels(renderToCanvas(post, photos, { scale: 300 }));

    const { width, height } = canvasPixelSize(post, 300);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { alpha: false })!;
    ctx.globalAlpha = 0.3;
    ctx.globalCompositeOperation = 'multiply';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 8;
    ctx.setLineDash([4, 4]);
    ctx.imageSmoothingEnabled = false;
    ctx.textAlign = 'right';
    ctx.font = '40px serif';
    ctx.fillStyle = '#123456';
    render(ctx, post, photos, { scale: 300, emptyCells: 'placeholder' });

    expect(diffFraction(pixels(canvas), clean, 0)).toBe(0);
    expect(ctx.globalAlpha).toBeCloseTo(0.3);
    expect(ctx.fillStyle).toBe('#123456');
    expect(ctx.font).toBe('40px serif');
    expect(ctx.getTransform().isIdentity).toBe(true);
  });
});

describe('RND-03 coordinates', () => {
  it('a gap of 0.01 at scale 1080 is 10.8 px on both axes', () => {
    const post = collage(row([cell('a', 'blue'), cell('b', 'blue')]), { gap: 0.01, background: '#ff0000' });
    const img = pixels(renderToCanvas(post, photos, { scale: 1080 }));
    expect(img.height).toBe(1350);
    // Outer margin is a full gap: 10.8 px. Pixel 9 is background, 10 is mixed, 11 is photo.
    expect(hex(pixelAt(img, 9, 600))).toBe('#ff0000');
    expect(hex(pixelAt(img, 11, 600))).toBe('#0000ff');
    expect(hex(pixelAt(img, 500, 9))).toBe('#ff0000');
    expect(hex(pixelAt(img, 500, 11))).toBe('#0000ff');
    // Pixel 10 is 80% background on both axes.
    expect(pixelAt(img, 10, 600)).toEqual(pixelAt(img, 500, 10));
  });
});

describe('RND-05 drawing order', () => {
  const post: Post = {
    ...collage(row([cell('a', 'land'), cell('b'), { kind: 'spacer' }, cell('c', 'port')]), {
      gap: 0.03, borderWidth: 0.008, borderColor: '#333333', background: '#f4efe6',
    }),
    textBoxes: [text({ x: 0.05, y: 0.4, width: 0.6, background: { color: '#000000', opacity: 0.5, padding: 0.02 } })],
  };

  it('golden: empty Cell as placeholder (editor)', async () => {
    await expectGolden('rnd05-placeholder', renderToCanvas(post, photos, { scale: 540, emptyCells: 'placeholder' }), { perPlatform: true });
  });

  it('golden: empty Cell as background (export)', async () => {
    const canvas = renderToCanvas(post, photos, { scale: 540, emptyCells: 'background' });
    await expectGolden('rnd05-background', canvas, { perPlatform: true });
    // The empty Cell and the Spacer show the background, with no border.
    const img = pixels(canvas);
    const bg = '#f4efe6';
    expect(hex(pixelAt(img, Math.round(540 * 0.375), 500))).toBe(bg);
    expect(hex(pixelAt(img, Math.round(540 * 0.625), 500))).toBe(bg);
    expect(hex(pixelAt(img, Math.round(540 * 0.25) + 10, 500))).toBe(bg); // where a border would be
  });

  it('Text Boxes are drawn above photos', () => {
    const plain = { ...post, textBoxes: [] };
    const a = pixels(renderToCanvas(plain, photos, { scale: 540 }));
    const b = pixels(renderToCanvas(post, photos, { scale: 540 }));
    // Inside the photo Cell, in the Text Box's background padding, the pixels are darker.
    const y = Math.round(540 * 1.25 * 0.45);
    const [r1] = pixelAt(a, 95, y);
    const [r2] = pixelAt(b, 95, y);
    expect(r2).toBeLessThan(r1);
  });
});

describe('RND-06 gap and inner rectangles', () => {
  it('Grid 2×2, gap 0.02, scale 1000, 1:1: the first Cell is x 20..490, y 20..490 px', () => {
    const post = collage(column([row([cell('a', 'blue'), cell('b', 'blue')]), row([cell('c', 'blue'), cell('d', 'blue')])]), {
      gap: 0.02, background: '#ff0000',
    }, '1:1');
    const img = pixels(renderToCanvas(post, photos, { scale: 1000 }));
    expect(hex(pixelAt(img, 19, 200))).toBe('#ff0000');
    expect(hex(pixelAt(img, 20, 200))).toBe('#0000ff');
    expect(hex(pixelAt(img, 489, 200))).toBe('#0000ff');
    expect(hex(pixelAt(img, 490, 200))).toBe('#ff0000');
    expect(hex(pixelAt(img, 200, 19))).toBe('#ff0000');
    expect(hex(pixelAt(img, 200, 20))).toBe('#0000ff');
    expect(hex(pixelAt(img, 200, 489))).toBe('#0000ff');
    expect(hex(pixelAt(img, 200, 490))).toBe('#ff0000');
    // Second Cell starts after a gap of 20 px.
    expect(hex(pixelAt(img, 509, 200))).toBe('#ff0000');
    expect(hex(pixelAt(img, 510, 200))).toBe('#0000ff');
  });

  it('golden: a Carousel frames every Slide on its own', async () => {
    const post: Post = {
      type: 'carousel', aspectRatio: '4:5',
      layout: { postType: 'carousel', slides: [cell('a', 'land'), row([cell('b', 'port'), cell('c', 'square')]), cell('d', 'wide')] },
      style: { ...STYLE, gap: 0.04, background: '#1d1d1f' }, textBoxes: [],
    };
    const canvas = renderToCanvas(post, photos, { scale: 300 });
    await expectGolden('rnd06-carousel', canvas);
    const img = pixels(canvas);
    // A full gap (12 px) on both sides of the Slide 1/2 edge at x = 300.
    expect(hex(pixelAt(img, 288 - 1, 200))).not.toBe('#1d1d1f');
    expect(hex(pixelAt(img, 289, 200))).toBe('#1d1d1f');
    expect(hex(pixelAt(img, 311, 200))).toBe('#1d1d1f');
    expect(hex(pixelAt(img, 312 + 1, 200))).not.toBe('#1d1d1f');
  });

  it('golden: a Seamless Carousel has no margin at Slide edges', async () => {
    const post: Post = {
      type: 'seamless', aspectRatio: '4:5',
      layout: { postType: 'seamless', slideCount: 3, root: row([cell('a', 'land'), cell('b', 'wide'), cell('c', 'port')], [0.25, 0.5, 0.25]) },
      style: { ...STYLE, gap: 0.04, background: '#1d1d1f' }, textBoxes: [],
    };
    const canvas = renderToCanvas(post, photos, { scale: 300 });
    await expectGolden('rnd06-seamless', canvas);
    const img = pixels(canvas);
    // The middle Cell spans x = 0.75..2.25 and crosses the edges at 300 and 600 px.
    for (const x of [299, 300, 599, 600]) expect(hex(pixelAt(img, x, 200))).not.toBe('#1d1d1f');
  });
});

describe('RND-07 photo placement', () => {
  it('golden: quarter turns', async () => {
    const post = collage(column([
      row([cell('a', 'land', { rotate90: 0 }), cell('b', 'land', { rotate90: 90 })]),
      row([cell('c', 'land', { rotate90: 180 }), cell('d', 'land', { rotate90: 270 })]),
    ]), { gap: 0.02 });
    await expectGolden('rnd07-rotate90', renderToCanvas(post, photos, { scale: 540 }));
  });

  it('golden: a 7° straighten', async () => {
    const post = collage(cell('a', 'land', { straighten: 7 }), {}, '1:1');
    await expectGolden('rnd07-straighten', renderToCanvas(post, photos, { scale: 540 }));
  });

  it('golden: zoom and focus', async () => {
    const post = collage(row([
      cell('a', 'land', { zoom: 2.5, focusX: 0.1, focusY: 0.1 }),
      cell('b', 'land', { zoom: 2.5, focusX: 1, focusY: 1 }),
    ]), { gap: 0.02 });
    await expectGolden('rnd07-zoom-focus', renderToCanvas(post, photos, { scale: 540 }));
  });

  it('no gap ever shows inside a Cell, at any straighten and focus', () => {
    const magenta = '#ff00ff';
    for (const straighten of [-15, -7, 3, 15]) {
      for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const post = collage(cell('a', 'land', { straighten, focusX: fx, focusY: fy, rotate90: 90 }), { background: magenta }, '9:16');
        const img = pixels(renderToCanvas(post, photos, { scale: 200 }));
        for (const [x, y] of [[1, 1], [198, 1], [1, 354], [198, 354], [100, 1], [1, 177]]) {
          expect(hex(pixelAt(img, x!, y!))).not.toBe(magenta);
        }
      }
    }
  });
});

describe('RND-08 border', () => {
  it('golden: border inside the inner rectangle, following the corner radius', async () => {
    const post = grid({ gap: 0.03, cornerRadius: 0.05, borderWidth: 0.015, borderColor: '#c0392b', background: '#fafafa' });
    const canvas = renderToCanvas(post, photos, { scale: 540 });
    await expectGolden('rnd08-border', canvas);
    // 0.015 × 540 = 8.1 px of border inside the first Cell, which starts at x = 16.2.
    const img = pixels(canvas);
    expect(hex(pixelAt(img, 20, 300))).toBe('#c0392b');
    expect(hex(pixelAt(img, 23, 300))).toBe('#c0392b');
    expect(hex(pixelAt(img, 26, 300))).not.toBe('#c0392b');
  });

  it('golden: the "Black frame" preset', async () => {
    await expectGolden('rnd08-black-frame', renderToCanvas(grid(STYLE_PRESET_BLACK_FRAME), photos, { scale: 540 }));
  });

  it('a border width of 0 draws nothing', () => {
    const a = pixels(renderToCanvas(grid({ borderWidth: 0, borderColor: '#ff0000' }), photos, { scale: 200 }));
    const b = pixels(renderToCanvas(grid({ borderWidth: 0, borderColor: '#00ff00' }), photos, { scale: 200 }));
    expect(diffFraction(a, b, 0)).toBe(0);
  });
});

describe('RND-09 text', () => {
  const post: Post = {
    ...collage(cell('a', 'land'), { cornerRadius: 0.02 }),
    textBoxes: [
      text({ text: 'Summer in the mountains', y: 0.08, size: 0.09 }),
      text({ id: 'u', text: 'a supercalifragilisticexpialidocious word\nand a new line', x: 0.08, y: 0.55, width: 0.5, size: 0.045, weight: 400, align: 'left', color: '#111111', background: { color: '#ffffff', opacity: 0.8, padding: 0.015 } }),
      text({ id: 'v', text: 'right', x: 0.5, y: 0.9, width: 0.45, size: 0.04, weight: 400, align: 'right' }),
    ],
  };
  it('golden: text at scale 540', async () => {
    await expectGolden('rnd09-text-540', renderToCanvas(post, photos, { scale: 540 }), { channel: 2, pixels: 0.005, perPlatform: true });
  });
  it('golden: text at scale 1080', async () => {
    await expectGolden('rnd09-text-1080', renderToCanvas(post, photos, { scale: 1080 }), { channel: 2, pixels: 0.005, perPlatform: true });
  });
});

describe('RND-10 clipping at Slide edges', () => {
  const box = text({ text: 'EDGE EDGE', x: 0.8, y: 0.45, width: 0.5, size: 0.06, align: 'left', color: '#000000', background: { color: '#ffd400', opacity: 1, padding: 0.01 } });
  const carousel: Post = {
    type: 'carousel', aspectRatio: '4:5',
    layout: { postType: 'carousel', slides: [cell('a', 'land'), cell('b', 'port')] },
    style: { ...STYLE, gap: 0.02 }, textBoxes: [box],
  };
  const seamless: Post = {
    type: 'seamless', aspectRatio: '4:5',
    layout: { postType: 'seamless', slideCount: 2, root: row([cell('a', 'land'), cell('b', 'port')]) },
    style: { ...STYLE, gap: 0.02 }, textBoxes: [box],
  };

  it('golden: in a Carousel, a Text Box is clipped to the Slide it starts on', async () => {
    const canvas = renderToCanvas(carousel, photos, { scale: 400 });
    await expectGolden('rnd10-carousel', canvas, { channel: 2, pixels: 0.005 });
    const img = pixels(canvas);
    const y = Math.round(400 * 1.25 * 0.45) - 2; // inside the yellow padding
    expect(hex(pixelAt(img, 395, y))).toBe('#ffd400');
    expect(hex(pixelAt(img, 405, y))).not.toBe('#ffd400');
  });

  it('golden: in a Seamless Carousel, nothing is clipped at Slide edges', async () => {
    const canvas = renderToCanvas(seamless, photos, { scale: 400 });
    await expectGolden('rnd10-seamless', canvas, { channel: 2, pixels: 0.005 });
    const img = pixels(canvas);
    const y = Math.round(400 * 1.25 * 0.45) - 2;
    expect(hex(pixelAt(img, 395, y))).toBe('#ffd400');
    expect(hex(pixelAt(img, 405, y))).toBe('#ffd400');
  });
});

describe('MOD-06 / MOD-07 Aspect Ratios', () => {
  for (const ratio of ['1:1', '4:5', '3:4', '9:16'] as const) {
    it(`golden: Grid 2×2 at ${ratio}`, async () => {
      const canvas = renderToCanvas(grid({ gap: 0.02, cornerRadius: 0.02 }, ratio), photos, { scale: 360 });
      expect(canvas.height).toBe(canvasPixelSize(grid({}, ratio), 360).height);
      await expectGolden(`mod07-ratio-${ratio.replace(':', 'x')}`, canvas);
    });
  }
});

describe('MOD-20 style is scale-independent', () => {
  it('rendering at 540 matches a downscaled render at 1080', () => {
    const post = grid({ gap: 0.03, cornerRadius: 0.04, borderWidth: 0.01, borderColor: '#000000', background: '#f4efe6' });
    const small = pixels(renderToCanvas(post, photos, { scale: 540 }));
    const big = renderToCanvas(post, photos, { scale: 1080 });
    const down = new OffscreenCanvas(540, small.height);
    const ctx = down.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(big, 0, 0, 540, small.height);
    const downscaled = pixels(down);
    expect(meanAbsDiff(small, downscaled)).toBeLessThan(1.5);
    expect(diffFraction(small, downscaled, 32)).toBeLessThan(0.01);
  });
});

describe('RenderOptions.slides', () => {
  it('draws only the requested Slides and leaves other pixels untouched', () => {
    const post: Post = {
      type: 'seamless', aspectRatio: '1:1',
      layout: { postType: 'seamless', slideCount: 5, root: row([cell('a', 'wide'), cell('b', 'land'), cell('c', 'port')], [0.5, 0.3, 0.2]) },
      style: { ...STYLE, gap: 0.02, cornerRadius: 0.02 }, textBoxes: [text({ x: 1.6, width: 1 })],
    };
    const full = pixels(renderToCanvas(post, photos, { scale: 100 }));
    const canvas = new OffscreenCanvas(500, 100);
    const ctx = canvas.getContext('2d', { alpha: false })!;
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, 500, 100);
    render(ctx, post, photos, { scale: 100, slides: { from: 1, to: 2 }, emptyCells: 'placeholder' });
    const part = pixels(canvas);
    for (let y = 0; y < 100; y += 3) {
      for (let x = 0; x < 500; x += 3) {
        if (x < 100 || x >= 300) expect(hex(pixelAt(part, x, y))).toBe('#00ff00');
        else expect(pixelAt(part, x, y)).toEqual(pixelAt(full, x, y));
      }
    }
  });
});
