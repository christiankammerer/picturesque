// SPDX-License-Identifier: GPL-3.0-or-later
//
// The Photos panel (EDT-03, EDT-08, EDT-09, EDT-13): the drop zone, the
// file picker and the thumbnails, in panel order, with a badge on placed
// photos. Reordering, removing and multi-select (EDT-10…EDT-12) arrive in M4.

import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { usageCounts } from '../../../shared/model/project.ts';
import { beginDrag } from '../state/drag.ts';
import { importFiles, thumbnailUrl } from '../state/library.ts';
import { getState, setState, useEditor } from '../state/store.ts';

/** File types the picker offers (OVR-04); the content decides in the end. */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
/** A press that moves this far (px) is a drag, not a click. */
const DRAG_THRESHOLD = 4;

export function PhotosPanel() {
  const { t } = useTranslation();
  const project = useEditor((s) => s.project);
  const armed = useEditor((s) => s.armedPhoto);
  const importing = useEditor((s) => s.importing);
  useEditor((s) => s.photoVersion);
  const input = useRef<HTMLInputElement>(null);
  const counts = useMemo(() => (project ? usageCounts(project.post.layout) : new Map<string, number>()), [project]);
  if (!project) return null;
  const empty = project.panelOrder.length === 0;

  const pick = () => input.current?.click();

  return (
    <div className="photos-panel" data-drop="panel" data-testid="photos-panel">
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        data-testid="photo-input"
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = '';
          void importFiles(files);
        }}
      />
      {empty ? (
        <div className="drop-zone" data-testid="drop-zone">
          <p>{t('photos.dropZone')}</p>
          <button type="button" className="button primary" onClick={pick}>
            {t('photos.choose')}
          </button>
        </div>
      ) : (
        <div className="photos-toolbar">
          <button type="button" className="button" onClick={pick}>
            {t('photos.add')}
          </button>
          {importing > 0 && <span className="muted">{t('photos.importing', { count: importing })}</span>}
        </div>
      )}
      <ul className="photo-grid">
        {project.panelOrder.map((id) => (
          <PhotoThumb key={id} id={id} name={project.photos[id]!.originalName} uses={counts.get(id) ?? 0} armed={armed === id} />
        ))}
      </ul>
    </div>
  );
}

function PhotoThumb({ id, name, uses, armed }: { id: string; name: string; uses: number; armed: boolean }) {
  const { t } = useTranslation();
  const url = thumbnailUrl(id);

  const onPointerDown = (e: ReactPointerEvent<HTMLLIElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) return;
      cleanup();
      beginDrag({ kind: 'photo', photoId: id, x: ev.clientX, y: ev.clientY });
    };
    const up = () => {
      cleanup();
      // A click arms the photo for click-then-click placing (EDT-13).
      setState({ armedPhoto: getState().armedPhoto === id ? null : id });
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <li
      className={`photo-thumb${armed ? ' armed' : ''}`}
      data-testid="photo"
      data-photo-id={id}
      title={name}
      aria-pressed={armed}
      onPointerDown={onPointerDown}
    >
      {url && <img src={url} alt={name} draggable={false} />}
      {uses > 0 && (
        <span className="badge" data-testid="photo-badge" aria-label={t('photos.placed', { count: uses })}>
          {uses > 1 ? t('photos.uses', { count: uses }) : t('photos.placedMark')}
        </span>
      )}
    </li>
  );
}
