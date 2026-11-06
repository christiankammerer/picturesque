// SPDX-License-Identifier: GPL-3.0-or-later
//
// The top bar (EDT-04). In M2: the Aspect Ratio selector and Export. The
// Carousel controls, Auto-fill, Text, Grid Crop and Preview arrive with
// their milestones.

import { useTranslation } from 'react-i18next';
import { aspectRatiosFor, setAspectRatio } from '../../../shared/model/post.ts';
import type { AspectRatio } from '../../../shared/model/schema.ts';
import { runExport } from '../export/run-export.ts';
import { editProject, useEditor } from '../state/store.ts';

export function TopBar() {
  const { t } = useTranslation();
  const post = useEditor((s) => s.project?.post);
  const exporting = useEditor((s) => s.exporting);
  if (!post) return null;

  return (
    <header className="top-bar">
      <label className="field inline">
        <span>{t('topBar.aspectRatio')}</span>
        <select
          value={post.aspectRatio}
          data-testid="aspect-ratio"
          onChange={(e) => editProject((p) => ({ ...p, post: setAspectRatio(p.post, e.currentTarget.value as AspectRatio) }))}
        >
          {aspectRatiosFor(post.type).map((r) => (
            <option key={r} value={r}>
              {t(`ratio.${r.replace(":", "x")}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="spacer" />
      <button type="button" className="button primary" disabled={exporting !== null} onClick={() => void runExport()}>
        {exporting ? t('topBar.exporting', { done: exporting.done, total: exporting.total }) : t('topBar.export')}
      </button>
    </header>
  );
}
