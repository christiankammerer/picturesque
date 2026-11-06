// SPDX-License-Identifier: GPL-3.0-or-later
//
// The right inspector (EDT-04). In this PR: the selected Cell's framing
// controls (EDT-15). Layout style and Layout editing arrive next.

import { useTranslation } from 'react-i18next';
import { emptyCell, findCell, resetFraming, rotateCell, setFraming } from '../../../shared/model/project.ts';
import { clampFocus, MAX_ZOOM, MIN_ZOOM } from '../../../shared/render/framing.ts';
import { cellInnerRect } from '../../../shared/render/render.ts';
import { preview } from '../state/library.ts';
import { editProject, useEditor } from '../state/store.ts';

export function Inspector() {
  const { t } = useTranslation();
  const project = useEditor((s) => s.project);
  const selected = useEditor((s) => s.selectedCell);
  const cell = project && selected ? findCell(project.post.layout, selected) : undefined;

  return (
    <aside className="inspector" aria-label={t('inspector.label')}>
      {!cell ? (
        <p className="muted">{t('inspector.nothingSelected')}</p>
      ) : (
        <section>
          <h2>{t('inspector.cell')}</h2>
          {!cell.photo ? (
            <p className="muted">{t('inspector.emptyCellHint')}</p>
          ) : (
            <FramingControls cellId={cell.id} />
          )}
        </section>
      )}
    </aside>
  );
}

function FramingControls({ cellId }: { cellId: string }) {
  const { t } = useTranslation();
  const project = useEditor((s) => s.project);
  const cell = project ? findCell(project.post.layout, cellId) : undefined;
  if (!cell?.photo) return null;
  const framing = cell.photo.framing;
  const photoId = cell.photo.photoId;

  /** Straighten re-covers the Cell (RND-07); keep the stored focus in range too. */
  const setStraighten = (straighten: number) => {
    const bmp = preview(photoId);
    editProject((p) => {
      const c = findCell(p.post.layout, cellId);
      if (!c?.photo) return p;
      const next = { ...c.photo.framing, straighten };
      const rect = cellInnerRect(p.post, cellId, 1000);
      return setFraming(p, cellId, bmp && rect && rect.w > 0 && rect.h > 0 ? clampFocus(rect, bmp.width, bmp.height, next) : next);
    });
  };

  return (
    <div className="controls">
      <label className="field">
        <span>{t('inspector.zoom')}</span>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={framing.zoom}
          data-testid="zoom"
          onChange={(e) => editProject((p) => setFraming(p, cellId, { ...framing, zoom: Number(e.currentTarget.value) }))}
        />
      </label>
      <label className="field">
        <span>{t('inspector.straighten')}</span>
        <input
          type="range"
          min={-15}
          max={15}
          step={0.1}
          value={framing.straighten}
          data-testid="straighten"
          onChange={(e) => setStraighten(Number(e.currentTarget.value))}
        />
        <output>{t('inspector.degrees', { value: framing.straighten.toFixed(1) })}</output>
      </label>
      <div className="button-row">
        <button type="button" className="button" onClick={() => editProject((p) => rotateCell(p, cellId))}>
          {t('inspector.rotate')}
        </button>
        <button type="button" className="button" onClick={() => editProject((p) => resetFraming(p, cellId))}>
          {t('inspector.resetFraming')}
        </button>
        <button type="button" className="button" onClick={() => editProject((p) => emptyCell(p, cellId))}>
          {t('inspector.emptyCell')}
        </button>
      </div>
    </div>
  );
}
