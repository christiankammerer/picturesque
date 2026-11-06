// SPDX-License-Identifier: GPL-3.0-or-later
//
// Export off the UI thread (PRF-06): the same pipeline as the headless
// export, in a worker with an OffscreenCanvas.

import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import { MIME_TYPES } from '../import/formats.ts';
import type { PhotoMeta, Post } from '../model/schema.ts';
import { exportPost } from './export-post.ts';

export interface ExportJob {
  post: Post;
  photos: Record<string, PhotoMeta>;
  originals: Record<string, ArrayBuffer>;
  startTime: number;
}

export type ExportReply =
  | { kind: 'progress'; done: number; total: number }
  | { kind: 'done'; slides: { index: number; bytes: ArrayBuffer; time: number; reencoded: boolean }[] }
  | { kind: 'error'; message: string };

let fontsReady: Promise<void> | undefined;

/** RND-11: the fonts are loaded before rendering. */
function loadFonts(): Promise<void> {
  fontsReady ??= (async () => {
    const fonts = (self as unknown as { fonts: FontFaceSet }).fonts;
    for (const [url, weight] of [[interRegular, '400'], [interBold, '700']] as const) {
      fonts.add(await new FontFace('Inter', `url(${url})`, { weight }).load());
    }
  })();
  return fontsReady;
}

self.onmessage = async (event: MessageEvent<ExportJob>) => {
  const job = event.data;
  const post = (reply: ExportReply, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(reply, transfer);
  try {
    await loadFonts();
    const slides = await exportPost({
      post: job.post,
      photos: job.photos,
      startTime: job.startTime,
      readPhoto: async (id) => new Blob([job.originals[id]!], { type: MIME_TYPES[job.photos[id]!.ext] }),
      onProgress: (done, total) => post({ kind: 'progress', done, total }),
    });
    const out = slides.map((s) => ({ index: s.index, bytes: s.bytes.slice().buffer as ArrayBuffer, time: s.time, reencoded: s.reencoded }));
    post({ kind: 'done', slides: out }, out.map((s) => s.bytes));
  } catch (err) {
    post({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
