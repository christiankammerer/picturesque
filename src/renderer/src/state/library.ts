// SPDX-License-Identifier: GPL-3.0-or-later
//
// The photos of the open Project outside the store: preview copies for the
// renderer (PRF-01), thumbnails for the panel, and the original bytes for
// export (EXP-04) and, later, saving (PRJ-02).

import { createPhotoPool, type PhotoPool } from '../../../shared/decode/photo-tasks.ts';
import { fromFile, importPhotos } from '../../../shared/import/importer.ts';
import { addPhotos, sortByDate } from '../../../shared/model/project.ts';
import { editProject, getState, notify, setState } from './store.ts';

const previews = new Map<string, ImageBitmap>();
const thumbnails = new Map<string, string>();
const originals = new Map<string, Uint8Array<ArrayBuffer>>();
let pool: PhotoPool | undefined;

export const preview = (id: string): ImageBitmap | undefined => previews.get(id);
export const thumbnailUrl = (id: string): string | undefined => thumbnails.get(id);
export const original = (id: string): Uint8Array<ArrayBuffer> | undefined => originals.get(id);

export function clearLibrary(): void {
  for (const b of previews.values()) b.close();
  for (const u of thumbnails.values()) URL.revokeObjectURL(u);
  previews.clear();
  thumbnails.clear();
  originals.clear();
  setState((s) => ({ photoVersion: s.photoVersion + 1 }));
}

/** EDT-08: import files into the open Project. Thumbnails appear one by one. */
export async function importFiles(files: readonly File[]): Promise<void> {
  const project = getState().project;
  if (!project || files.length === 0) return;
  pool ??= createPhotoPool();
  setState((s) => ({ importing: s.importing + files.length }));
  const before = project.panelOrder;
  try {
    const summary = await importPhotos(files.map(fromFile), new Set(Object.keys(project.photos)), pool, (photo) => {
      previews.set(photo.meta.id, photo.preview);
      thumbnails.set(photo.meta.id, URL.createObjectURL(photo.thumbnail));
      originals.set(photo.meta.id, photo.bytes);
      editProject((p) => addPhotos(p, [photo.meta]));
      setState((s) => ({ photoVersion: s.photoVersion + 1 }));
    });
    // Thumbnails arrive in decode order; settle photos with the same capture
    // date into the order the files were given (EDT-09).
    const added = summary.added.map((m) => m.id);
    editProject((p) => {
      const order = sortByDate([...before.filter((id) => p.photos[id]), ...added.filter((id) => p.photos[id])], p.photos);
      return order.join() === p.panelOrder.join() ? p : { ...p, panelOrder: order };
    });
    for (const r of summary.refused) notify({ key: `import.${r.reason}`, name: r.name });
    if (summary.overLimit > 0) notify({ key: 'import.overLimit', count: summary.overLimit });
  } finally {
    setState((s) => ({ importing: s.importing - files.length }));
  }
}
