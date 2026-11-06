// SPDX-License-Identifier: GPL-3.0-or-later
//
// The real decoders, in headless Chromium: libheif (WASM) for HEIC and
// createImageBitmap for the rest, in real workers.

import { describe, expect, it } from 'vitest';
import { decodePhoto } from '../../src/shared/decode/decode.ts';
import { createPhotoPool } from '../../src/shared/decode/photo-tasks.ts';
import { importPhotos, type ImportedPhoto, type ImportSource } from '../../src/shared/import/importer.ts';
import { inspectPhoto } from '../../src/shared/import/inspect.ts';
import { PREVIEW_LONG_EDGE } from '../../src/shared/import/photo-info.ts';
import landscapeHeic from '../fixtures/photos/landscape.heic?url';
import rotatedHeic from '../fixtures/photos/rotated.heic?url';
import orientedJpg from '../fixtures/photos/oriented.jpg?url';
import orientedPng from '../fixtures/photos/oriented.png?url';
import orientedWebp from '../fixtures/photos/oriented.webp?url';

const FIXTURES = {
  'landscape.heic': landscapeHeic,
  'rotated.heic': rotatedHeic,
  'oriented.jpg': orientedJpg,
  'oriented.png': orientedPng,
  'oriented.webp': orientedWebp,
};

async function bytesOf(url: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

function rgbAt(bitmap: ImageBitmap, fx: number, fy: number): [number, number, number] {
  const c = new OffscreenCanvas(bitmap.width, bitmap.height);
  const g = c.getContext('2d')!;
  g.drawImage(bitmap, 0, 0);
  const d = g.getImageData(Math.floor(fx * bitmap.width), Math.floor(fy * bitmap.height), 1, 1).data;
  return [d[0]!, d[1]!, d[2]!];
}

/** Which quadrant colour (of the fixture pattern) a pixel is closest to. */
function colourName([r, g, b]: [number, number, number]): string {
  const named: [string, [number, number, number]][] = [
    ['red', [229, 57, 53]], ['green', [67, 160, 71]], ['blue', [30, 136, 229]], ['yellow', [253, 216, 53]],
  ];
  let best = '';
  let dist = Infinity;
  for (const [name, [R, G, B]] of named) {
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
    if (d < dist) [best, dist] = [name, d];
  }
  return best;
}

const corners = (bmp: ImageBitmap) =>
  [rgbAt(bmp, 0.1, 0.1), rgbAt(bmp, 0.9, 0.1), rgbAt(bmp, 0.1, 0.9), rgbAt(bmp, 0.9, 0.9)].map(colourName);

describe('PRF-04 HEIC decoding', () => {
  it('decodes a HEIC with libheif, colours intact', async () => {
    const bmp = await decodePhoto(await bytesOf(landscapeHeic), 'heic');
    expect([bmp.width, bmp.height]).toEqual([1200, 800]);
    expect(corners(bmp)).toEqual(['red', 'green', 'blue', 'yellow']);
  });

  it('applies the HEIC rotation, and PhotoMeta agrees with the decoder', async () => {
    const bytes = await bytesOf(rotatedHeic);
    const meta = await inspectPhoto(bytes, 'r.heic', 0);
    const bmp = await decodePhoto(bytes, 'heic');
    // Stored 800×1200 with a 90° clockwise irot: upright it is 1200×800.
    expect([bmp.width, bmp.height]).toEqual([1200, 800]);
    expect(corners(bmp)).toEqual(['yellow', 'blue', 'green', 'red']);
    expect(meta.ok && [meta.meta.width, meta.meta.height]).toEqual([1200, 800]);
  });
});

describe('orientation matches the decoders', () => {
  for (const [name, url] of Object.entries(FIXTURES)) {
    it(`${name}: PhotoMeta's size is the decoded size`, async () => {
      const bytes = await bytesOf(url);
      const r = await inspectPhoto(bytes, name, 0);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const bmp = await decodePhoto(bytes, r.meta.ext);
      expect([r.meta.width, r.meta.height]).toEqual([bmp.width, bmp.height]);
    });
  }

  it('JPEG and PNG EXIF orientation 6 turns the photo clockwise; WebP orientation is ignored', async () => {
    // The fixtures are stored with red top-left; orientation 6 puts it top-right.
    expect(corners(await decodePhoto(await bytesOf(orientedJpg), 'jpg'))[1]).toBe('red');
    expect(corners(await decodePhoto(await bytesOf(orientedPng), 'png'))[1]).toBe('red');
    expect(corners(await decodePhoto(await bytesOf(orientedWebp), 'webp'))[0]).toBe('red');
  });
});

describe('PRF-01 preview copies', () => {
  it('have a 2048 px long edge', async () => {
    const big = new OffscreenCanvas(4032, 3024);
    const g = big.getContext('2d')!;
    g.fillStyle = '#336699';
    g.fillRect(0, 0, 4032, 3024);
    const bytes = new Uint8Array(await (await big.convertToBlob({ type: 'image/jpeg' })).arrayBuffer());
    const pool = createPhotoPool(2);
    const got: ImportedPhoto[] = [];
    await importPhotos([{ name: 'big.jpg', lastModified: 0, read: async () => bytes.slice().buffer }], new Set(), pool, (p) => got.push(p));
    pool.terminate();
    expect([got[0]!.preview.width, got[0]!.preview.height]).toEqual([PREVIEW_LONG_EDGE, 1536]);
    expect([got[0]!.meta.width, got[0]!.meta.height]).toEqual([4032, 3024]);
  });
});

describe('PRF-03 / PRF-04 import in workers', () => {
  it('imports HEIC, JPEG, PNG and WebP through the worker pool, at most pool-size at a time', async () => {
    const sources: ImportSource[] = await Promise.all(
      Object.entries(FIXTURES).map(async ([name, url]) => {
        const bytes = await bytesOf(url);
        return { name, lastModified: 0, read: async () => bytes.slice().buffer };
      }),
    );
    const pool = createPhotoPool(3);
    const got: ImportedPhoto[] = [];
    const summary = await importPhotos(sources, new Set(), pool, (p) => got.push(p));
    pool.terminate();
    expect(summary.refused).toEqual([]);
    expect(summary.added.map((m) => m.originalName)).toEqual(Object.keys(FIXTURES));
    expect(got).toHaveLength(5);
    expect(pool.peak).toBeLessThanOrEqual(3);
    for (const p of got) expect([p.preview.width, p.preview.height]).toEqual([p.meta.width, p.meta.height]);
  });

  it('on a 4-core machine, 4 HEIC photos decode 3 at a time', async () => {
    const bytes = await bytesOf(landscapeHeic);
    const pool = createPhotoPool(3);
    await Promise.all(
      [0, 1, 2, 3].map(() =>
        pool.run(() => {
          const copy = bytes.slice().buffer;
          return { payload: { kind: 'decode', bytes: copy, format: 'heic', width: 1200, height: 800 }, transfer: [copy] };
        }),
      ),
    );
    pool.terminate();
    expect(pool.peak).toBe(3);
  });
});

describe('EXP-04 export decodes HEIC originals', () => {
  it('exports a Collage of a HEIC photo, upright', async () => {
    const { exportPost } = await import('../../src/shared/export/export-post.ts');
    const bytes = await bytesOf(rotatedHeic);
    const r = await inspectPhoto(bytes, 'r.heic', 0);
    if (!r.ok) throw new Error('inspect failed');
    const [slide] = await exportPost({
      post: {
        type: 'collage', aspectRatio: '1:1',
        layout: { postType: 'collage', root: { kind: 'cell', id: 'a', photo: { photoId: r.meta.id, framing: { zoom: 1, focusX: 0.5, focusY: 0.5, rotate90: 0, straighten: 0 } } } },
        style: { gap: 0, cornerRadius: 0, borderWidth: 0, borderColor: '#000000', background: '#ffffff' },
        textBoxes: [],
      },
      photos: { [r.meta.id]: r.meta },
      readPhoto: async () => new Blob([bytes]),
      startTime: 0,
    });
    const bmp = await createImageBitmap(new Blob([slide!.bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }));
    expect([bmp.width, bmp.height]).toEqual([1080, 1080]);
    // The 1200×800 photo covers the square: its centre half shows, with the same quadrants.
    expect(corners(bmp)).toEqual(['yellow', 'blue', 'green', 'red']);
  });
});
