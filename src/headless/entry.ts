// SPDX-License-Identifier: GPL-3.0-or-later
//
// Browser half of the headless export (scripts/export-headless.ts). It is
// bundled into a page in headless Chromium and runs the same export pipeline
// as the app.

import { exportPost } from '../shared/export/export-post.ts';
import type { PhotoMeta, Post } from '../shared/model/schema.ts';

export interface HeadlessExportRequest {
  post: Post;
  photos: Record<string, PhotoMeta>;
  /** Original photo bytes, base64, by photoId. */
  photoData: Record<string, string>;
  /** Font files to load before rendering (RND-11). */
  fonts: { family: string; weight: string; data: string }[];
  startTime: number;
}

export interface HeadlessExportResult {
  slides: { index: number; time: number; reencoded: boolean; data: string }[];
}

const MIME: Record<PhotoMeta['ext'], string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

async function run(req: HeadlessExportRequest): Promise<HeadlessExportResult> {
  for (const f of req.fonts) {
    const face = new FontFace(f.family, fromBase64(f.data), { weight: f.weight });
    document.fonts.add(await face.load());
  }
  const slides = await exportPost({
    post: req.post,
    photos: req.photos,
    startTime: req.startTime,
    readPhoto: async (id) => {
      const data = req.photoData[id];
      const meta = req.photos[id];
      if (!data || !meta) throw new Error(`no data for photo ${id}`);
      return new Blob([fromBase64(data)], { type: MIME[meta.ext] });
    },
  });
  return {
    slides: slides.map((s) => ({ index: s.index, time: s.time, reencoded: s.reencoded, data: toBase64(s.bytes) })),
  };
}

(globalThis as unknown as { picturesqueExport: typeof run }).picturesqueExport = run;
