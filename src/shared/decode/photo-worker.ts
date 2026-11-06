// SPDX-License-Identifier: GPL-3.0-or-later
//
// The photo worker (PRF-03): hashing, inspecting and decoding off the UI thread.

import { inspectPhoto } from '../import/inspect.ts';
import { previewSize } from '../import/photo-info.ts';
import type { PhotoTask, PhotoTaskResult } from './photo-tasks.ts';
import { decodePhoto } from './decode.ts';
import { serveTasks } from './pool.ts';

serveTasks<PhotoTask, PhotoTaskResult>(self as unknown as Parameters<typeof serveTasks>[0], async (task) => {
  const bytes = new Uint8Array(task.bytes);
  if (task.kind === 'inspect') {
    const result = await inspectPhoto(bytes, task.name, task.lastModified);
    return { result: { kind: 'inspect', result, bytes: task.bytes }, transfer: [task.bytes] };
  }
  const size = task.size ?? previewSize(task.width, task.height);
  const bitmap = await decodePhoto(bytes, task.format, size);
  return { result: { kind: 'decode', bitmap, bytes: task.bytes }, transfer: [bitmap, task.bytes] };
});
