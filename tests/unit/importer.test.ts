// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PhotoPool, PhotoTask, PhotoTaskResult } from '../../src/shared/decode/photo-tasks.ts';
import { WorkerPool, type TaskMessage, type WorkerLike } from '../../src/shared/decode/pool.ts';
import { importPhotos, type ImportSource } from '../../src/shared/import/importer.ts';
import { inspectPhoto } from '../../src/shared/import/inspect.ts';
import { fakePng } from './fixtures.ts';

/** Runs inspection for real and pretends to decode, in-process. */
function inProcessPool(size = 2): PhotoPool {
  const worker = (): WorkerLike => {
    const w: WorkerLike = {
      onmessage: null,
      onerror: null,
      terminate() {},
      postMessage(message: unknown) {
        const { task, payload } = message as TaskMessage<PhotoTask>;
        void (async () => {
          let result: PhotoTaskResult;
          if (payload.kind === 'inspect') {
            result = { kind: 'inspect', result: await inspectPhoto(new Uint8Array(payload.bytes), payload.name, payload.lastModified), bytes: payload.bytes };
          } else {
            result = { kind: 'decode', bitmap: { width: payload.width } as ImageBitmap, bytes: payload.bytes };
          }
          w.onmessage?.({ data: { task, ok: true, result } } as MessageEvent);
        })();
      },
    };
    return w;
  };
  return new WorkerPool<PhotoTask, PhotoTaskResult>(worker, size);
}

const source = (name: string, bytes: Uint8Array): ImportSource => ({
  name,
  lastModified: Date.UTC(2026, 0, 1),
  read: async () => bytes.slice().buffer,
});
const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/photos/${name}`, import.meta.url)));

describe('EDT-08 importing', () => {
  it('importing the same file twice leaves one entry', async () => {
    const got: string[] = [];
    const s = await importPhotos(
      [source('a.heic', fixture('landscape.heic')), source('copy of a.heic', fixture('landscape.heic'))],
      new Set(), inProcessPool(), (p) => got.push(p.meta.originalName),
    );
    expect(s.added.map((m) => m.originalName)).toEqual(['a.heic']);
    expect(s.duplicates).toEqual(['copy of a.heic']);
    expect(got).toEqual(['a.heic']);
  });

  it('skips photos already in the Project', async () => {
    const first = await importPhotos([source('a.jpg', fixture('oriented.jpg'))], new Set(), inProcessPool(), () => {});
    const again = await importPhotos([source('a.jpg', fixture('oriented.jpg'))], new Set([first.added[0]!.id]), inProcessPool(), () => {});
    expect(again.added).toEqual([]);
    expect(again.duplicates).toEqual(['a.jpg']);
  });

  it('OVR-04: refuses other files by name and imports the rest', async () => {
    const s = await importPhotos(
      [source('a.gif', fixture('refused.gif')), source('b.png', fixture('oriented.png')), source('c.tiff', fixture('refused.tiff')), source('d.CR2', new Uint8Array([0x49, 0x49, 0x2a, 0]))],
      new Set(), inProcessPool(), () => {},
    );
    expect(s.added.map((m) => m.originalName)).toEqual(['b.png']);
    expect(s.refused).toEqual([
      { name: 'a.gif', reason: 'unsupported' },
      { name: 'c.tiff', reason: 'unsupported' },
      { name: 'd.CR2', reason: 'unsupported' },
    ]);
  });

  it('PRF-05: importing 105 photos adds 100 and counts the rest', async () => {
    const sources = Array.from({ length: 105 }, (_, i) => source(`p${i}.png`, fakePng(40, 30, i)));
    const s = await importPhotos(sources, new Set(), inProcessPool(4), () => {});
    expect(s.added).toHaveLength(100);
    expect(s.added.map((m) => m.originalName)).toEqual(sources.slice(0, 100).map((x) => x.name));
    expect(s.overLimit).toBe(5);
  });

  it('PRF-05: counts photos already in the Project against the limit', async () => {
    const existing = new Set(Array.from({ length: 98 }, (_, i) => `x${i}`));
    const sources = Array.from({ length: 4 }, (_, i) => source(`p${i}.png`, fakePng(40, 30, i)));
    const s = await importPhotos(sources, existing, inProcessPool(), () => {});
    expect(s.added).toHaveLength(2);
    expect(s.overLimit).toBe(2);
  });

  it('PRF-05: refuses a photo over 100 MP by name', async () => {
    const s = await importPhotos([source('pano.png', fakePng(20000, 6000))], new Set(), inProcessPool(), () => {});
    expect(s.refused).toEqual([{ name: 'pano.png', reason: 'tooLarge' }]);
  });

  it('hands each photo over with its original bytes, unchanged', async () => {
    const original = fixture('rotated.heic');
    let bytes: Uint8Array | undefined;
    await importPhotos([source('r.heic', original)], new Set(), inProcessPool(), (p) => (bytes = p.bytes));
    expect(bytes).toEqual(original);
  });
});
