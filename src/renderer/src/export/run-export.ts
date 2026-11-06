// SPDX-License-Identifier: GPL-3.0-or-later
//
// Export from the editor: pick a folder, render and encode in the export
// worker (PRF-06), write atomically in the main process (EXP-12). The full
// flow (empty-Cell warning, replace prompt, after-export dialog) is M3.

import type { ExportJob, ExportReply } from '../../../shared/export/export-worker.ts';
import { exportFileNames, sanitizeFileName, unsavedProjectName } from '../../../shared/export/naming.ts';
import { slideCountOf } from '../../../shared/model/schema.ts';
import { original } from '../state/library.ts';
import { getState, notify, setState } from '../state/store.ts';

export async function runExport(): Promise<void> {
  const { project, exporting } = getState();
  if (!project || exporting) return;
  const folder = await window.picturesque.chooseExportFolder();
  if (!folder) return;

  const startTime = Date.now();
  const originals: Record<string, ArrayBuffer> = {};
  for (const id of Object.keys(project.photos)) {
    const bytes = original(id);
    if (bytes) originals[id] = bytes.slice().buffer;
  }
  const count = slideCountOf(project.post.layout);
  setState({ exporting: { done: 0, total: count } });

  const worker = new Worker(new URL('../../../shared/export/export-worker.ts', import.meta.url), { type: 'module', name: 'export' });
  try {
    const slides = await new Promise<Extract<ExportReply, { kind: 'done' }>['slides']>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<ExportReply>) => {
        const r = e.data;
        if (r.kind === 'progress') setState({ exporting: { done: r.done, total: r.total } });
        else if (r.kind === 'done') resolve(r.slides);
        else reject(new Error(r.message));
      };
      worker.onerror = (e) => reject(new Error(e.message));
      const job: ExportJob = { post: project.post, photos: project.photos, originals, startTime };
      worker.postMessage(job, Object.values(originals));
    });
    const names = exportFileNames(project.name, project.post.type, count, new Date(startTime));
    const baseName = sanitizeFileName(project.name?.trim() ? project.name : unsavedProjectName(new Date(startTime)));
    await window.picturesque.writeExport({
      folder,
      postType: project.post.type,
      baseName,
      files: slides.map((s) => ({ name: names[s.index]!, bytes: new Uint8Array(s.bytes), mtime: s.time })),
    });
    notify({ key: 'export.done', count: slides.length });
  } catch (err) {
    notify({ key: 'export.failed', message: err instanceof Error ? err.message : String(err) });
  } finally {
    worker.terminate();
    setState({ exporting: null });
  }
}
