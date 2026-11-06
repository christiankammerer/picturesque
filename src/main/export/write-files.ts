// SPDX-License-Identifier: GPL-3.0-or-later
//
// EXP-12: atomic export writes. Every file is first written to a temporary
// name in the target folder; only when all of them are written are they
// renamed into place. A failure or cancellation before that removes the
// temporary files, so no partial export is ever left behind.
// EXP-05: each file's modification time is set to its Slide's timestamp.

import { randomBytes } from 'node:crypto';
import { mkdir, open, rename, rm, utimes } from 'node:fs/promises';
import { join } from 'node:path';

export interface FileToWrite {
  name: string;
  bytes: Uint8Array;
  /** Modification time, ms since the epoch. */
  mtime: number;
}

export class WriteCancelled extends Error {
  constructor() {
    super('export cancelled');
    this.name = 'WriteCancelled';
  }
}

export const TEMP_SUFFIX = '.tmp';

/** Write `files` into `dir` atomically. Returns the final paths. */
export async function writeExportFiles(dir: string, files: FileToWrite[], signal?: AbortSignal): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const tag = randomBytes(4).toString('hex');
  const temps: { temp: string; final: string }[] = [];
  try {
    for (const f of files) {
      if (signal?.aborted) throw new WriteCancelled();
      const temp = join(dir, `.${f.name}.${tag}${TEMP_SUFFIX}`);
      temps.push({ temp, final: join(dir, f.name) });
      const handle = await open(temp, 'w');
      try {
        await handle.writeFile(f.bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      const t = new Date(f.mtime);
      await utimes(temp, t, t);
    }
    if (signal?.aborted) throw new WriteCancelled();
  } catch (err) {
    await Promise.all(temps.map(({ temp }) => rm(temp, { force: true })));
    throw err;
  }
  // Commit. Renames within one folder are atomic per file and very fast.
  for (const { temp, final } of temps) await rename(temp, final);
  return temps.map((t) => t.final);
}
