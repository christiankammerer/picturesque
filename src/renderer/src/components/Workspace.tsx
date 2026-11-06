// SPDX-License-Identifier: GPL-3.0-or-later
//
// EDT-04: the workspace: top bar, left sidebar (Templates, Photos), the
// canvas, the inspector.

import { useEffect, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { emptyCell, resetFraming } from '../../../shared/model/project.ts';
import { importFiles, thumbnailUrl } from '../state/library.ts';
import { editProject, getState, setState, useEditor } from '../state/store.ts';
import { Canvas } from './Canvas.tsx';
import { Inspector } from './Inspector.tsx';
import { Notices } from './Notices.tsx';
import { PhotosPanel } from './PhotosPanel.tsx';
import { TemplatesPanel } from './TemplatesPanel.tsx';
import { TopBar } from './TopBar.tsx';

const SIDEBAR_TABS = ['templates', 'photos'] as const;

export function Workspace() {
  const { t } = useTranslation();
  const tab = useEditor((s) => s.sidebarTab);
  useShortcuts();

  // EDT-08: files dropped anywhere on the workspace are imported.
  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  };
  const onDrop = (e: DragEvent) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    setState({ sidebarTab: 'photos' });
    void importFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="workspace" onDragOver={onDragOver} onDrop={onDrop}>
      <TopBar />
      <nav className="sidebar" aria-label={t('sidebar.label')}>
        <div className="tabs" role="tablist">
          {SIDEBAR_TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`tab${tab === id ? ' active' : ''}`}
              onClick={() => setState({ sidebarTab: id })}
            >
              {t(`sidebar.${id}`)}
            </button>
          ))}
        </div>
        {tab === 'photos' ? <PhotosPanel /> : <TemplatesPanel />}
      </nav>
      <Canvas />
      <Inspector />
      <Notices />
      <DragGhost />
    </div>
  );
}

/** The photo following the pointer while dragging. */
function DragGhost() {
  const drag = useEditor((s) => s.drag);
  if (!drag) return null;
  const url = thumbnailUrl(drag.photoId);
  return <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>{url && <img src={url} alt="" />}</div>;
}

/** The workspace shortcuts of M2 (EDT-28). The full set arrives with M7. */
function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const { selectedCell } = getState();
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') {
        setState({ selectedCell: null, armedPhoto: null });
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCell) {
        e.preventDefault();
        editProject((p) => emptyCell(p, selectedCell));
      } else if (mod && e.key === '0' && selectedCell) {
        e.preventDefault();
        editProject((p) => resetFraming(p, selectedCell));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
