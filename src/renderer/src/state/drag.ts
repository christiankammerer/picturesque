// SPDX-License-Identifier: GPL-3.0-or-later
//
// Dragging photos (EDT-13, EDT-14), with pointer events. A drop target is an
// element with data-drop="cell:<id>" or data-drop="panel" under the pointer.

import { emptyCell, movePhoto, placePhoto } from '../../../shared/model/project.ts';
import { editProject, setState, type Drag } from './store.ts';

export type DropTarget = { kind: 'cell'; cellId: string } | { kind: 'panel' } | null;

export function dropTargetAt(x: number, y: number): DropTarget {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
  const drop = el?.dataset['drop'];
  if (!drop) return null;
  if (drop === 'panel') return { kind: 'panel' };
  if (drop.startsWith('cell:')) return { kind: 'cell', cellId: drop.slice(5) };
  return null;
}

/** Start a drag at a pointer position; ends on the next pointerup anywhere. */
export function beginDrag(drag: Drag): void {
  setState({ drag });
  const move = (e: PointerEvent) => setState((s) => (s.drag ? { drag: { ...s.drag, x: e.clientX, y: e.clientY } } : {}));
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    setState({ drag: null });
    drop(drag, dropTargetAt(e.clientX, e.clientY));
  };
  const cancel = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    setState({ drag: null });
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
}

function drop(drag: Drag, target: DropTarget): void {
  if (!target) return;
  if (drag.kind === 'photo' && target.kind === 'cell') {
    editProject((p) => placePhoto(p, target.cellId, drag.photoId)); // places, or replaces
    setState({ selectedCell: target.cellId, armedPhoto: null });
  } else if (drag.kind === 'cell' && target.kind === 'cell') {
    editProject((p) => movePhoto(p, drag.cellId, target.cellId)); // swaps, or moves
    setState({ selectedCell: target.cellId });
  } else if (drag.kind === 'cell' && target.kind === 'panel') {
    editProject((p) => emptyCell(p, drag.cellId)); // unplaces
  }
}
