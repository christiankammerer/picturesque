// SPDX-License-Identifier: GPL-3.0-or-later
//
// The canvas (EDT-05, EDT-13…EDT-15). The Post is drawn by the one renderer
// (RND-02); interaction happens on transparent per-Cell elements laid over
// it, which also draw the selection outline (the overlay layer).
//
// M2 shows the whole canvas fitted to the pane. The one-large-Slide view with
// peeking neighbours and the filmstrip arrive with M3.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { leafRects } from '../../../shared/model/geometry.ts';
import { emptyCell, findCell, placePhoto, setFraming } from '../../../shared/model/project.ts';
import { RATIO_HEIGHT, slideCountOf, type Framing } from '../../../shared/model/schema.ts';
import { panFraming, zoomFramingAt, type PxRect } from '../../../shared/render/framing.ts';
import { innerRect, render } from '../../../shared/render/render.ts';
import { beginDrag, dropTargetAt } from '../state/drag.ts';
import { preview } from '../state/library.ts';
import { editProject, getState, setState, useEditor } from '../state/store.ts';

const MARGIN = 32;
/** How far (css px) a pan may leave its Cell before it becomes a move (EDT-14). */
const LEAVE_TO_MOVE = 12;

export function Canvas() {
  const { t } = useTranslation();
  const post = useEditor((s) => s.project?.post);
  const photoVersion = useEditor((s) => s.photoVersion);
  const selectedCell = useEditor((s) => s.selectedCell);
  const drag = useEditor((s) => s.drag);
  const pane = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = pane.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry!.contentRect.width, h: entry!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geometry = useMemo(() => {
    if (!post) return null;
    const n = slideCountOf(post.layout);
    const ratio = RATIO_HEIGHT[post.aspectRatio];
    const scale = Math.max(1, Math.min((size.w - 2 * MARGIN) / n, (size.h - 2 * MARGIN) / ratio));
    const leaves = leafRects(post.layout).map((leaf) => ({
      leaf,
      rect: innerRect(leaf, scale, scale * ratio, post.style.gap * scale),
    }));
    return { n, ratio, scale, width: n * scale, height: scale * ratio, leaves };
  }, [post, size]);

  // Draw with the renderer at device resolution.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !post || !geometry) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = geometry.scale * dpr;
    c.width = Math.round(geometry.n * scale);
    c.height = Math.round(scale * geometry.ratio);
    const ctx = c.getContext('2d', { alpha: false });
    if (ctx) render(ctx, post, preview, { scale, emptyCells: 'placeholder' });
  }, [post, geometry, photoVersion]);

  if (!post || !geometry) return <div ref={pane} className="canvas-pane" />;

  return (
    <div ref={pane} className="canvas-pane" onPointerDown={(e) => e.target === e.currentTarget && setState({ selectedCell: null })}>
      <div className="canvas-stage" style={{ width: geometry.width, height: geometry.height }}>
        <canvas ref={canvas} className="canvas-render" style={{ width: geometry.width, height: geometry.height }} aria-label={t('canvas.label')} />
        {Array.from({ length: geometry.n - 1 }, (_, i) => (
          <div key={i} className="slide-edge" style={{ left: (i + 1) * geometry.scale }} />
        ))}
        {geometry.leaves.map(({ leaf, rect }, i) =>
          leaf.node.kind === 'cell' ? (
            <CellOverlay
              key={leaf.node.id}
              cellId={leaf.node.id}
              photoId={leaf.node.photo?.photoId}
              rect={rect}
              selected={selectedCell === leaf.node.id}
              dropHover={drag !== null && dropTargetAt(drag.x, drag.y)?.kind === 'cell' && (dropTargetAt(drag.x, drag.y) as { cellId: string }).cellId === leaf.node.id}
            />
          ) : (
            <div key={`spacer-${i}`} className="spacer-overlay" style={boxStyle(rect)} />
          ),
        )}
      </div>
    </div>
  );
}

function boxStyle(r: PxRect) {
  return { left: r.x, top: r.y, width: Math.max(0, r.w), height: Math.max(0, r.h) };
}

interface CellProps {
  cellId: string;
  photoId: string | undefined;
  rect: PxRect;
  selected: boolean;
  dropHover: boolean;
}

function CellOverlay({ cellId, photoId, rect, selected, dropHover }: CellProps) {
  const { t } = useTranslation();
  const el = useRef<HTMLDivElement>(null);
  const rectRef = useRef(rect);
  useLayoutEffect(() => {
    rectRef.current = rect;
  }, [rect]);

  // EDT-15: scroll zooms around the pointer. A native listener, so it can preventDefault.
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      const cell = currentCell(cellId);
      if (!cell?.photo) return;
      const bitmap = preview(cell.photo.photoId);
      if (!bitmap) return;
      e.preventDefault();
      const box = node.getBoundingClientRect();
      const local = { ...rectRef.current, x: 0, y: 0 };
      const factor = Math.exp(-e.deltaY * 0.0015);
      const framing = zoomFramingAt(local, bitmap.width, bitmap.height, cell.photo.framing, factor, e.clientX - box.left, e.clientY - box.top);
      editProject((p) => setFraming(p, cellId, framing));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [cellId]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const armed = getState().armedPhoto;
    if (armed) {
      // EDT-13: click a photo, then click a Cell.
      editProject((p) => placePhoto(p, cellId, armed));
      setState({ selectedCell: cellId, armedPhoto: null });
      return;
    }
    setState({ selectedCell: cellId });
    const cell = currentCell(cellId);
    if (!cell?.photo) return;
    const bitmap = preview(cell.photo.photoId);
    if (!bitmap) return;

    // EDT-15: drag inside the Cell pans; leaving the Cell turns it into a move (EDT-14).
    const node = e.currentTarget;
    node.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, framing: cell.photo.framing as Framing, photoId: cell.photo.photoId };
    const local = { ...rectRef.current, x: 0, y: 0 };
    const move = (ev: PointerEvent) => {
      const box = node.getBoundingClientRect();
      const outside =
        ev.clientX < box.left - LEAVE_TO_MOVE || ev.clientX > box.right + LEAVE_TO_MOVE ||
        ev.clientY < box.top - LEAVE_TO_MOVE || ev.clientY > box.bottom + LEAVE_TO_MOVE;
      if (outside) {
        end();
        editProject((p) => setFraming(p, cellId, start.framing));
        node.releasePointerCapture(ev.pointerId);
        beginDrag({ kind: 'cell', cellId, photoId: start.photoId, x: ev.clientX, y: ev.clientY });
        return;
      }
      const framing = panFraming(local, bitmap.width, bitmap.height, start.framing, ev.clientX - start.x, ev.clientY - start.y);
      editProject((p) => setFraming(p, cellId, framing));
    };
    const end = () => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', end);
      node.removeEventListener('pointercancel', end);
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
  };

  return (
    <div
      ref={el}
      className={`cell-overlay${selected ? ' selected' : ''}${dropHover ? ' drop-hover' : ''}${photoId ? ' filled' : ''}`}
      style={boxStyle(rect)}
      data-drop={`cell:${cellId}`}
      data-testid="cell"
      data-cell-id={cellId}
      data-photo-id={photoId ?? ''}
      aria-label={photoId ? t('canvas.filledCell') : t('canvas.emptyCell')}
      onPointerDown={onPointerDown}
      onDoubleClick={() => editProject((p) => emptyCell(p, cellId))}
    />
  );
}

function currentCell(cellId: string) {
  const post = getState().project?.post;
  return post ? findCell(post.layout, cellId) : undefined;
}
