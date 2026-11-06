// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WriteCancelled, writeExportFiles } from '../../src/main/export/write-files.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'picturesque-export-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const files = (n: number, t0 = Date.UTC(2026, 10, 6, 10, 0, 0)) =>
  Array.from({ length: n }, (_, i) => ({ name: `trip-0${i + 1}.jpg`, bytes: new Uint8Array([i, 1, 2, 3]), mtime: t0 + i * 1000 }));

describe('EXP-12 atomic writes', () => {
  it('writes every file under its final name and leaves no temporary files', async () => {
    await writeExportFiles(dir, files(3));
    expect((await readdir(dir)).sort()).toEqual(['trip-01.jpg', 'trip-02.jpg', 'trip-03.jpg']);
    expect([...(await readFile(join(dir, 'trip-02.jpg')))]).toEqual([1, 1, 2, 3]);
  });

  it('cancelling halfway leaves no .tmp files and no partial JPEGs', async () => {
    const controller = new AbortController();
    const list = files(3);
    // Abort as soon as the second file's bytes are requested.
    Object.defineProperty(list[1]!, 'bytes', {
      get() {
        controller.abort();
        return new Uint8Array([9]);
      },
    });
    await expect(writeExportFiles(dir, list, controller.signal)).rejects.toBeInstanceOf(WriteCancelled);
    expect(await readdir(dir)).toEqual([]);
  });

  it('a failed write leaves no files', async () => {
    const list = files(2);
    list[1]!.name = 'missing-folder/x.jpg';
    await expect(writeExportFiles(dir, list)).rejects.toThrow();
    expect(await readdir(dir)).toEqual([]);
  });

  it('keeps an earlier export intact when a new one fails', async () => {
    await writeExportFiles(dir, files(1));
    const list = files(2);
    list[0]!.bytes = new Uint8Array([7]);
    list[1]!.name = 'missing-folder/x.jpg';
    await expect(writeExportFiles(dir, list)).rejects.toThrow();
    expect([...(await readFile(join(dir, 'trip-01.jpg')))]).toEqual([0, 1, 2, 3]);
  });
});

describe('EXP-05 modification times', () => {
  it('sets each file mtime to its Slide timestamp, 1 s apart', async () => {
    const list = files(3);
    await writeExportFiles(dir, list);
    for (const f of list) {
      expect((await stat(join(dir, f.name))).mtimeMs).toBe(f.mtime);
    }
  });
});
