// SPDX-License-Identifier: GPL-3.0-or-later
import { beforeAll, describe, expect, it } from 'vitest';
import { buildExifPayload, exifDateTime, TAG_DATE_TIME_ORIGINAL, TAG_ORIENTATION } from '../../src/shared/export/exif.ts';
import { ExportCancelled, exportPost, renderFull, sliceSlide } from '../../src/shared/export/export-post.ts';
import { APP0, APP1, APP2, insertApp1 } from '../../src/shared/export/jpeg.ts';
import { EXPORT_SCALE } from '../../src/shared/export/plan.ts';
import { DEFAULT_FRAMING, type Framing, type LayoutNode, type PhotoMeta, type Post } from '../../src/shared/model/schema.ts';
import { render } from '../../src/shared/render/render.ts';
import { estimateQuality, exifTags, iccDescription, iccProfile, isBaseline, markers } from '../helpers/jpeg-inspect.ts';
import { decodeImage, diffFraction, expectGolden, meanAbsDiff, pixelAt, pixels, testPattern } from './golden.ts';

const STYLE = { gap: 0.02, cornerRadius: 0, borderWidth: 0, borderColor: '#000000', background: '#ffffff' };

interface TestPhoto {
  meta: PhotoMeta;
  blob: Blob;
}
const library = new Map<string, TestPhoto>();

async function addPhoto(id: string, canvas: OffscreenCanvas, opts: { orientation?: number; type?: string } = {}): Promise<void> {
  const type = opts.type ?? 'image/jpeg';
  let bytes = new Uint8Array(await (await canvas.convertToBlob({ type, quality: 0.95 })).arrayBuffer());
  if (opts.orientation) {
    bytes = insertApp1(bytes, buildExifPayload([{ tag: TAG_ORIENTATION, type: 'short', value: opts.orientation }], [])) as Uint8Array<ArrayBuffer>;
  }
  const swap = opts.orientation !== undefined && opts.orientation >= 5;
  library.set(id, {
    blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type }),
    meta: {
      id, ext: type === 'image/png' ? 'png' : 'jpg', originalName: `${id}.jpg`, captureDate: '2026-07-01T12:00:00Z',
      width: swap ? canvas.height : canvas.width, height: swap ? canvas.width : canvas.height,
    },
  });
}

beforeAll(async () => {
  await addPhoto('land', testPattern(2400, 1600, 200));
  await addPhoto('port', testPattern(1600, 2400, 20));
  await addPhoto('wide', testPattern(4800, 1600, 280));
});

const f = (over: Partial<Framing> = {}): Framing => ({ ...DEFAULT_FRAMING, ...over });
const cell = (id: string, photoId?: string, framing?: Partial<Framing>): LayoutNode =>
  photoId ? { kind: 'cell', id, photo: { photoId, framing: f(framing) } } : { kind: 'cell', id };
const row = (children: LayoutNode[], sizes?: number[]): LayoutNode => ({
  kind: 'split', direction: 'row', sizes: sizes ?? children.map(() => 1 / children.length), children,
});

function input(post: Post, extra: Partial<Parameters<typeof exportPost>[0]> = {}): Parameters<typeof exportPost>[0] {
  const photos: Record<string, PhotoMeta> = {};
  for (const [id, p] of library) photos[id] = p.meta;
  return {
    post,
    photos,
    readPhoto: async (id) => library.get(id)!.blob,
    startTime: new Date(2026, 10, 6, 10, 0, 0).getTime(),
    ...extra,
  };
}

const collage = (root: LayoutNode, aspectRatio: Post['aspectRatio'] = '4:5'): Post => ({
  type: 'collage', aspectRatio, layout: { postType: 'collage', root }, style: STYLE, textBoxes: [],
});
const seamless3: Post = {
  type: 'seamless', aspectRatio: '4:5',
  // The middle Cell spans x = 0.5..1.5, crossing Slide edge 1.
  layout: { postType: 'seamless', slideCount: 3, root: row([cell('a', 'port'), cell('b', 'wide'), cell('c', 'land')], [0.5 / 3, 1 / 3, 1.5 / 3]) },
  style: STYLE, textBoxes: [],
};

const jpegPixels = (bytes: Uint8Array) => decodeImage(bytes as Uint8Array<ArrayBuffer>, 'image/jpeg');

describe('EXP-01 output size', () => {
  it.each([['1:1', 1080], ['4:5', 1350], ['3:4', 1440], ['9:16', 1920]] as const)('%s exports 1080 × %d', async (ratio, h) => {
    const [slide] = await exportPost(input(collage(cell('a', 'land'), ratio)));
    const img = await jpegPixels(slide!.bytes);
    expect([img.width, img.height]).toEqual([1080, h]);
  });
  it('every Slide of a Carousel is 1080 wide', async () => {
    const slides = await exportPost(input(seamless3));
    expect(slides).toHaveLength(3);
    for (const s of slides) {
      const img = await jpegPixels(s.bytes);
      expect([img.width, img.height]).toEqual([1080, 1350]);
    }
  });
});

describe('EXP-02 format', () => {
  it('is baseline JPEG, quality 92, with the sRGB ICC profile', async () => {
    const [slide] = await exportPost(input(collage(row([cell('a', 'land'), cell('b', 'port')]))));
    expect(isBaseline(slide!.bytes)).toBe(true);
    expect(Math.abs(estimateQuality(slide!.bytes) - 92)).toBeLessThanOrEqual(1);
    const icc = iccProfile(slide!.bytes);
    expect(icc).toBeDefined();
    expect(iccDescription(icc!)).toBe('sRGB');
  });
});

describe('EXP-03 one render, sliced', () => {
  it('Slides are the exact columns of the full render, with no overlap and no gap', async () => {
    const bitmaps = new Map<string, ImageBitmap>();
    for (const [id, p] of library) bitmaps.set(id, await createImageBitmap(p.blob));
    const full = renderFull(seamless3, (id) => bitmaps.get(id));
    const fullPx = pixels(full);
    expect(full.width).toBe(3 * EXPORT_SCALE);
    for (let i = 0; i < 3; i++) {
      const slice = pixels(sliceSlide(full, i));
      for (const x of [0, 1, 539, 1078, 1079]) {
        for (let y = 0; y < 1350; y += 7) {
          expect(pixelAt(slice, x, y)).toEqual(pixelAt(fullPx, i * EXPORT_SCALE + x, y));
        }
      }
    }
  });

  it('the last column of Slide 1 and the first of Slide 2 continue the crossing Cell', async () => {
    const [s1, s2] = await exportPost(input(seamless3));
    const a = await jpegPixels(s1!.bytes);
    const b = await jpegPixels(s2!.bytes);
    // Across the seam the photo continues: neighbouring columns differ no more
    // than neighbouring columns inside a Slide do.
    let seam = 0;
    let inside = 0;
    for (let y = 100; y < 1250; y++) {
      const l = pixelAt(a, 1079, y);
      const r = pixelAt(b, 0, y);
      const r2 = pixelAt(b, 1, y);
      seam += Math.abs(l[0] - r[0]) + Math.abs(l[1] - r[1]) + Math.abs(l[2] - r[2]);
      inside += Math.abs(r[0] - r2[0]) + Math.abs(r[1] - r2[1]) + Math.abs(r[2] - r2[2]);
    }
    expect(seam / 1150).toBeLessThan(Math.max(6, (inside / 1150) * 3));
  });

  it('golden: the three Slides of a Seamless Post', async () => {
    const slides = await exportPost(input(seamless3));
    const strip = new OffscreenCanvas(3 * 270, 338);
    const ctx = strip.getContext('2d')!;
    for (const s of slides) {
      const bmp = await createImageBitmap(new Blob([s.bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }));
      ctx.drawImage(bmp, s.index * 270, 0, 270, 338);
    }
    await expectGolden('exp03-seamless-slices', strip, { channel: 4, pixels: 0.01 });
  });
});

describe('EXP-04 photo quality', () => {
  it('decodes the original at the needed size, not a preview copy', async () => {
    // A 48 MP-class photo full of fine detail, zoomed in 3×.
    const detail = new OffscreenCanvas(8000, 6000);
    const g = detail.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 8000, 6000);
    g.fillStyle = '#000000';
    for (let x = 0; x < 8000; x += 6) g.fillRect(x, 0, 2, 6000);
    for (let y = 0; y < 6000; y += 10) g.fillRect(0, y, 8000, 3);
    await addPhoto('detail', detail, { type: 'image/png' });
    const post = collage(cell('a', 'detail', { zoom: 3 }), '1:1');
    post.style = { ...STYLE, gap: 0 };

    const [slide] = await exportPost(input(post));
    const exported = await jpegPixels(slide!.bytes);

    const renderWith = async (bitmap: ImageBitmap) => {
      const c = new OffscreenCanvas(1080, 1080);
      render(c.getContext('2d')!, post, () => bitmap, { scale: 1080, emptyCells: 'background' });
      return pixels(c);
    };
    const blob = library.get('detail')!.blob;
    const reference = await renderWith(await createImageBitmap(blob));
    const preview = await renderWith(await createImageBitmap(blob, { resizeWidth: 2048, resizeHeight: 1536, resizeQuality: 'high' }));

    const exportErr = meanAbsDiff(exported, reference);
    const previewErr = meanAbsDiff(preview, reference);
    expect(exportErr).toBeLessThan(previewErr / 2);
    expect(exportErr).toBeLessThan(12);
  });

  it('applies the EXIF orientation at decode', async () => {
    // Stored landscape, left half red, right half blue; orientation 6 turns it
    // 90° clockwise, so the red half ends up on top.
    const c = new OffscreenCanvas(3000, 1000);
    const g = c.getContext('2d')!;
    g.fillStyle = '#ff0000';
    g.fillRect(0, 0, 1500, 1000);
    g.fillStyle = '#0000ff';
    g.fillRect(1500, 0, 1500, 1000);
    await addPhoto('rotated', c, { orientation: 6 });
    expect(library.get('rotated')!.meta).toMatchObject({ width: 1000, height: 3000 });

    const post = collage(cell('a', 'rotated'), '9:16');
    post.style = { ...STYLE, gap: 0 };
    const [slide] = await exportPost(input(post));
    const img = await jpegPixels(slide!.bytes);
    const [r1, , b1] = pixelAt(img, 540, 200);
    const [r2, , b2] = pixelAt(img, 540, 1700);
    expect(r1).toBeGreaterThan(200);
    expect(b1).toBeLessThan(60);
    expect(r2).toBeLessThan(60);
    expect(b2).toBeGreaterThan(200);
  });

  it('resize sizes apply to the oriented image (the decode relies on this)', async () => {
    const blob = library.get('rotated')!.blob;
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image', resizeWidth: 500, resizeHeight: 1500, resizeQuality: 'high' });
    expect([bmp.width, bmp.height]).toEqual([500, 1500]);
    const probe = new OffscreenCanvas(500, 1500);
    const ctx = probe.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const [r, , b] = pixelAt(pixels(probe), 250, 100);
    expect(r).toBeGreaterThan(200);
    expect(b).toBeLessThan(60);
  });
});

describe('EXP-05 metadata', () => {
  it('keeps only DateTimeOriginal, 1 s apart per Slide', async () => {
    const start = new Date(2026, 10, 6, 23, 59, 58);
    const slides = await exportPost(input(seamless3, { startTime: start.getTime() }));
    expect(slides.map((s) => s.time)).toEqual([0, 1, 2].map((i) => start.getTime() + i * 1000));
    const stamps = ['2026:11:06 23:59:58', '2026:11:06 23:59:59', '2026:11:07 00:00:00'];
    slides.forEach((s, i) => {
      expect(exifTags(s.bytes)).toEqual([{ ifd: 'exif', tag: TAG_DATE_TIME_ORIGINAL, value: stamps[i] }]);
      expect(markers(s.bytes).filter((m) => m >= APP0 && m <= 0xef)).toEqual([APP0, APP1, APP2]);
      expect(exifDateTime(new Date(s.time))).toBe(stamps[i]);
    });
  });

  it('drops the photos\' own metadata', async () => {
    const post = collage(cell('a', 'rotated'));
    const [slide] = await exportPost(input(post));
    expect(exifTags(slide!.bytes).map((t) => t.tag)).toEqual([TAG_DATE_TIME_ORIGINAL]);
  });
});

describe('EXP-06 size limit', () => {
  it('re-encodes at quality 90 when a file reaches the limit', async () => {
    const [slide] = await exportPost(input(collage(cell('a', 'land')), { maxFileBytes: 1000 }));
    expect(slide!.reencoded).toBe(true);
    expect(Math.abs(estimateQuality(slide!.bytes) - 90)).toBeLessThanOrEqual(1);
  });
  it('a normal export stays under 8 MB at quality 92', async () => {
    const slides = await exportPost(input(seamless3));
    for (const s of slides) {
      expect(s.reencoded).toBe(false);
      expect(s.bytes.length).toBeLessThan(8 * 1024 * 1024);
    }
  });
});

describe('export pipeline', () => {
  it('empty Cells export as background', async () => {
    const post = collage(row([cell('a', 'land'), cell('b')]));
    post.style = { ...STYLE, background: '#00aa00' };
    const [slide] = await exportPost(input(post));
    const img = await jpegPixels(slide!.bytes);
    const [r, g, b] = pixelAt(img, 810, 675);
    expect(Math.abs(r - 0) + Math.abs(g - 0xaa) + Math.abs(b - 0)).toBeLessThan(12);
  });
  it('can be cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(exportPost(input(seamless3, { signal: controller.signal }))).rejects.toBeInstanceOf(ExportCancelled);
  });
  it('reports progress per Slide', async () => {
    const calls: [number, number][] = [];
    await exportPost(input(seamless3, { onProgress: (d, t) => calls.push([d, t]) }));
    expect(calls).toEqual([[1, 3], [2, 3], [3, 3]]);
  });
  it('the editor render and the export render of a Post match', async () => {
    // RND-02: one renderer. The export is the editor preview at scale 1080, with empty Cells as background.
    const post = collage(row([cell('a', 'land'), cell('b', 'port')]));
    const [slide] = await exportPost(input(post));
    const exported = await jpegPixels(slide!.bytes);
    const bitmaps = new Map<string, ImageBitmap>();
    for (const id of ['land', 'port']) bitmaps.set(id, await createImageBitmap(library.get(id)!.blob));
    const c = new OffscreenCanvas(1080, 1350);
    render(c.getContext('2d')!, post, (id) => bitmaps.get(id), { scale: 1080, emptyCells: 'placeholder' });
    // They differ only by JPEG compression and the decode-time resize.
    const editor = pixels(c);
    expect(meanAbsDiff(exported, editor)).toBeLessThan(2);
    expect(diffFraction(exported, editor, 40)).toBeLessThan(0.005);
  });
});
