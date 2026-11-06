// SPDX-License-Identifier: GPL-3.0-or-later
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseExif } from '../../src/shared/import/exif-read.ts';
import { detectFormat, readHeader } from '../../src/shared/import/formats.ts';
import { inspectPhoto } from '../../src/shared/import/inspect.ts';
import { captureDate, MAX_PIXELS, orientedSize, previewSize } from '../../src/shared/import/photo-info.ts';
import { PhotoMetaSchema } from '../../src/shared/model/schema.ts';
import { fakePng } from './fixtures.ts';

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/photos/${name}`, import.meta.url)));

describe('OVR-04 accepted formats', () => {
  it.each([
    ['oriented.jpg', 'jpg'], ['oriented.png', 'png'], ['oriented.webp', 'webp'],
    ['landscape.heic', 'heic'], ['rotated.heic', 'heic'],
  ] as const)('%s is %s', (file, format) => {
    expect(detectFormat(fixture(file))).toBe(format);
  });
  it.each(['refused.gif', 'refused.tiff', 'refused.avif'])('%s is refused', (file) => {
    expect(detectFormat(fixture(file))).toBeNull();
  });
  it('a RAW file (TIFF-based, like CR2 or NEF) is refused', () => {
    expect(detectFormat(Uint8Array.from([0x49, 0x49, 0x2a, 0x00, 0x10, 0, 0, 0, 0x43, 0x52, 0x02, 0]))).toBeNull();
  });
  it('the format comes from the bytes, not the name', async () => {
    const r = await inspectPhoto(fixture('refused.gif') as Uint8Array<ArrayBuffer>, 'holiday.jpg', 0);
    expect(r).toEqual({ ok: false, reason: 'unsupported', name: 'holiday.jpg' });
  });
  it('a truncated file is refused as unreadable, naming it', async () => {
    const r = await inspectPhoto(fixture('oriented.jpg').slice(0, 40), 'cut.jpg', 0);
    expect(r).toEqual({ ok: false, reason: 'unreadable', name: 'cut.jpg' });
  });
});

describe('headers', () => {
  it.each([
    ['oriented.jpg', 'jpg', 300, 200], ['oriented.png', 'png', 300, 200], ['oriented.webp', 'webp', 300, 200],
    ['landscape.heic', 'heic', 1200, 800], ['rotated.heic', 'heic', 800, 1200],
  ] as const)('%s is stored at its header size', (file, format, w, h) => {
    const header = readHeader(fixture(file), format);
    expect([header.width, header.height]).toEqual([w, h]);
  });
  it('reads the HEIC irot of the primary image', () => {
    expect(readHeader(fixture('landscape.heic'), 'heic').heifRotation).toBe(0);
    expect(readHeader(fixture('rotated.heic'), 'heic').heifRotation).toBe(3); // 270° anti-clockwise = 90° clockwise
  });
  it.each([['oriented.jpg', 'jpg'], ['oriented.png', 'png'], ['oriented.webp', 'webp'], ['landscape.heic', 'heic']] as const)(
    'finds the EXIF block in %s',
    (file, format) => {
      const exif = parseExif(readHeader(fixture(file), format).exif!);
      expect(exif.dateTimeOriginal).toBe('2026:07:14 19:42:10');
      expect(exif.offsetTimeOriginal).toBe('+02:00');
    },
  );
  it('reads the EXIF orientation', () => {
    expect(parseExif(readHeader(fixture('oriented.jpg'), 'jpg').exif!).orientation).toBe(6);
  });
  it('survives malformed EXIF', () => {
    expect(parseExif(Uint8Array.from([0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 5]))).toEqual({});
    expect(parseExif(new Uint8Array(3))).toEqual({});
  });
});

describe('PhotoMeta from a file', () => {
  it('uses EXIF DateTimeOriginal with its offset', () => {
    expect(captureDate({ dateTimeOriginal: '2026:07:14 19:42:10', offsetTimeOriginal: '+02:00' }, 0)).toBe('2026-07-14T19:42:10+02:00');
    expect(captureDate({ dateTimeOriginal: '2026:07:14 19:42:10' }, 0)).toBe('2026-07-14T19:42:10');
  });
  it('falls back to the modification time', () => {
    expect(captureDate({}, Date.UTC(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02T03:04:05.000Z');
    expect(captureDate({ dateTimeOriginal: '0000:00:00 00:00:00' }, 0)).toBe('1970-01-01T00:00:00.000Z');
  });
  it('stores the size after orientation, as the decoders apply it', () => {
    const jpg = readHeader(fixture('oriented.jpg'), 'jpg');
    expect(orientedSize('jpg', jpg, { orientation: 6 })).toEqual({ width: 200, height: 300 });
    expect(orientedSize('png', jpg, { orientation: 6 })).toEqual({ width: 200, height: 300 });
    expect(orientedSize('webp', jpg, { orientation: 6 })).toEqual({ width: 300, height: 200 });
    expect(orientedSize('heic', readHeader(fixture('rotated.heic'), 'heic'), {})).toEqual({ width: 1200, height: 800 });
  });
  it('makes a valid PhotoMeta keyed by the SHA-256 of the bytes', async () => {
    const bytes = fixture('rotated.heic') as Uint8Array<ArrayBuffer>;
    const r = await inspectPhoto(bytes, 'IMG_0001.HEIC', 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meta).toEqual({
      id: createHash('sha256').update(bytes).digest('hex'),
      ext: 'heic', originalName: 'IMG_0001.HEIC', captureDate: '2026-07-14T19:42:10+02:00', width: 1200, height: 800,
    });
    expect(PhotoMetaSchema.safeParse(r.meta).success).toBe(true);
  });
});

describe('PRF-05 / PRF-01 limits', () => {
  it('refuses a photo over 100 megapixels, naming it', async () => {
    expect(await inspectPhoto(fakePng(12000, 10000), 'huge.png', 0)).toEqual({ ok: false, reason: 'tooLarge', name: 'huge.png' });
    expect(MAX_PIXELS).toBe(100_000_000);
    expect((await inspectPhoto(fakePng(10000, 10000), 'ok.png', 0)).ok).toBe(true);
  });
  it('preview copies have a 2048 px long edge and are never upscaled', () => {
    expect(previewSize(8064, 6048)).toEqual({ width: 2048, height: 1536 });
    expect(previewSize(3024, 4032)).toEqual({ width: 1536, height: 2048 });
    expect(previewSize(1200, 800)).toEqual({ width: 1200, height: 800 });
  });
});
