// SPDX-License-Identifier: GPL-3.0-or-later
//
// Messages between the app and the photo workers.

import type { InspectResult } from '../import/inspect.ts';
import type { PhotoFormat } from '../import/formats.ts';
import type { DecodeSize } from './decode.ts';
import { poolSize, WorkerPool } from './pool.ts';

export type PhotoTask =
  | { kind: 'inspect'; bytes: ArrayBuffer; name: string; lastModified: number }
  /** Decode at `size`, or as a preview copy (PRF-01) when `size` is absent. */
  | { kind: 'decode'; bytes: ArrayBuffer; format: PhotoFormat; width: number; height: number; size?: DecodeSize };

/** The input bytes come back with every result, so they are moved, never copied. */
export type PhotoTaskResult =
  | { kind: 'inspect'; result: InspectResult; bytes: ArrayBuffer }
  | { kind: 'decode'; bitmap: ImageBitmap; bytes: ArrayBuffer };

export type PhotoPool = WorkerPool<PhotoTask, PhotoTaskResult>;

export function createPhotoPool(size = poolSize(globalThis.navigator?.hardwareConcurrency)): PhotoPool {
  return new WorkerPool<PhotoTask, PhotoTaskResult>(
    () => new Worker(new URL('./photo-worker.ts', import.meta.url), { type: 'module', name: 'photo' }),
    size,
  );
}
