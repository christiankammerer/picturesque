// SPDX-License-Identifier: GPL-3.0-or-later
//
// EXP-07: export file names.

import type { PostType } from '../model/schema.ts';

/** Characters not allowed in file names on Windows, macOS or Linux, plus
 *  control characters. Each is replaced by '-'. */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;

export function sanitizeFileName(name: string): string {
  return name.replace(FORBIDDEN, '-');
}

/** The name of an unsaved Project: picturesque-YYYY-MM-DD-HHMM, local time. */
export function unsavedProjectName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `picturesque-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}`
  );
}

/**
 * The file names an export writes, in Slide order.
 * A Collage or Story is `<name>.jpg`; a Carousel or Seamless Carousel is
 * `<name>-01.jpg` … `<name>-NN.jpg`.
 */
export function exportFileNames(projectName: string | null, postType: PostType, slideCount: number, now: Date): string[] {
  const named = projectName !== null && projectName.trim() !== '';
  const base = sanitizeFileName(named ? projectName : unsavedProjectName(now));
  if (postType === 'collage') return [`${base}.jpg`];
  return Array.from({ length: slideCount }, (_, i) => `${base}-${String(i + 1).padStart(2, '0')}.jpg`);
}
