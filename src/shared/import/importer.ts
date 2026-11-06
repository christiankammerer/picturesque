// SPDX-License-Identifier: GPL-3.0-or-later
//
// Importing photos into a Project (EDT-08, OVR-04, PRF-01…PRF-05).
//
// Files are inspected (hashed, format and size checked) in the photo
// workers, then accepted in the order given: a photo already in the Project
// or earlier in the batch is skipped (same content hash), and nothing beyond
// the 100-photo limit is added. Each accepted photo's preview copy is then
// decoded, ahead of any remaining inspections, and handed over as soon as it
// is ready, so thumbnails appear one by one (PRF-03, PRF-08).

import type { PhotoMeta } from '../model/schema.ts';
import type { PhotoPool, PhotoTaskResult } from '../decode/photo-tasks.ts';
import type { RefusalReason } from './inspect.ts';
import { MAX_PHOTOS } from './photo-info.ts';

export interface ImportSource {
  name: string;
  lastModified: number;
  read(): Promise<ArrayBuffer>;
}

export function fromFile(file: File): ImportSource {
  return { name: file.name, lastModified: file.lastModified, read: () => file.arrayBuffer() };
}

export interface ImportedPhoto {
  meta: PhotoMeta;
  /** PRF-01: the 2048 px preview copy. The original is never decoded at full size here. */
  preview: ImageBitmap;
  /** The original file's bytes, unchanged (PRJ-02). */
  bytes: Uint8Array<ArrayBuffer>;
}

export interface ImportSummary {
  /** Added photos, in the order given. */
  added: PhotoMeta[];
  /** Names of files skipped because the photo is already in the Project. */
  duplicates: string[];
  /** Files refused, with the reason, in the order given. */
  refused: { name: string; reason: RefusalReason }[];
  /** PRF-05: how many photos weren't added because of the 100-photo limit. */
  overLimit: number;
}

export async function importPhotos(
  sources: readonly ImportSource[],
  existing: ReadonlySet<string>,
  pool: PhotoPool,
  onPhoto: (photo: ImportedPhoto) => void,
): Promise<ImportSummary> {
  const summary: ImportSummary = { added: [], duplicates: [], refused: [], overLimit: 0 };
  const seen = new Set(existing);
  let room = MAX_PHOTOS - existing.size;

  const inspections = sources.map((source) =>
    pool.run(async () => {
      const bytes = await source.read();
      return { payload: { kind: 'inspect', bytes, name: source.name, lastModified: source.lastModified }, transfer: [bytes] };
    }),
  );

  const previews: Promise<void>[] = [];
  for (const [i, pending] of inspections.entries()) {
    let reply: PhotoTaskResult;
    try {
      reply = await pending;
    } catch {
      summary.refused.push({ name: sources[i]!.name, reason: 'unreadable' });
      continue;
    }
    if (reply.kind !== 'inspect') throw new Error('unexpected worker reply');
    const { result, bytes } = reply;
    if (!result.ok) {
      summary.refused.push({ name: result.name, reason: result.reason });
      continue;
    }
    const { meta } = result;
    if (seen.has(meta.id)) {
      summary.duplicates.push(meta.originalName);
      continue;
    }
    if (room <= 0) {
      summary.overLimit++;
      continue;
    }
    seen.add(meta.id);
    room--;
    summary.added.push(meta);
    previews.push(
      pool
        .run(() => ({ payload: { kind: 'decode', bytes, format: meta.ext, width: meta.width, height: meta.height }, transfer: [bytes] }), 'high')
        .then((r) => {
          if (r.kind !== 'decode') throw new Error('unexpected worker reply');
          onPhoto({ meta, preview: r.bitmap, bytes: new Uint8Array(r.bytes) });
        }),
    );
  }
  const settled = await Promise.allSettled(previews);
  // A photo that passed inspection but can't be decoded is refused after all.
  settled.forEach((s, k) => {
    if (s.status === 'rejected') {
      const meta = summary.added[k]!;
      summary.refused.push({ name: meta.originalName, reason: 'unreadable' });
    }
  });
  summary.added = summary.added.filter((_, k) => settled[k]!.status === 'fulfilled');
  return summary;
}
