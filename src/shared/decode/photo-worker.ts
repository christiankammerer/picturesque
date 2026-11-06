// SPDX-License-Identifier: GPL-3.0-or-later
//
// The photo worker (PRF-03): hashing, inspecting and decoding off the UI thread.

import { inspectPhoto } from '../import/inspect.ts';
import { previewSize } from '../import/photo-info.ts';
import type { PhotoTask, PhotoTaskResult } from './photo-tasks.ts';
import { decodePhoto } from './decode.ts';
import { serveTasks } from './pool.ts';
import { DEFAULT_FRAMING, type Post } from '../model/schema.ts';
import { render } from '../render/render.ts';

serveTasks<PhotoTask, PhotoTaskResult>(self as unknown as Parameters<typeof serveTasks>[0], async (task) => {
  const bytes = new Uint8Array(task.bytes);
  if (task.kind === 'inspect') {
    const result = await inspectPhoto(bytes, task.name, task.lastModified);
    return { result: { kind: 'inspect', result, bytes: task.bytes }, transfer: [task.bytes] };
  }
  const size = task.size ?? previewSize(task.width, task.height);
  const bitmap = await decodePhoto(bytes, task.format, size);
  const thumbnail = task.size ? undefined : await makeThumbnail(bitmap);
  return { result: { kind: 'decode', bitmap, bytes: task.bytes, thumbnail }, transfer: [bitmap, task.bytes] };
});

/**
 * Photos-panel thumbnails: a square, centre-cropped WebP, drawn by the
 * renderer itself (RND-02) as a 1:1 single-Cell Post. (Chromium's
 * bitmaprenderer drops an oriented bitmap's EXIF rotation, so the obvious
 * resize-and-transfer route gives sideways JPEG and PNG thumbnails.)
 */
export const THUMBNAIL_SIZE = 256;

async function makeThumbnail(preview: ImageBitmap): Promise<Blob> {
  const canvas = new OffscreenCanvas(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  const post: Post = {
    type: 'collage',
    aspectRatio: '1:1',
    layout: { postType: 'collage', root: { kind: 'cell', id: 'thumbnail', photo: { photoId: 'p', framing: DEFAULT_FRAMING } } },
    style: { gap: 0, cornerRadius: 0, borderWidth: 0, borderColor: '#000000', background: '#000000' },
    textBoxes: [],
  };
  render(canvas.getContext('2d', { alpha: false })!, post, () => preview, { scale: THUMBNAIL_SIZE, emptyCells: 'background' });
  return canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
}
