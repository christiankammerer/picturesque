// SPDX-License-Identifier: GPL-3.0-or-later
//
// The editor's state, in one small store. Changes to the Project go through
// `editProject`, with the pure actions of src/shared/model/project.ts, so
// undo (M7) can be added in one place.

import { useSyncExternalStore } from 'react';
import type { Project } from '../../../shared/model/project.ts';

export type Notice =
  | { id: number; key: 'import.unsupported' | 'import.tooLarge' | 'import.unreadable'; name: string }
  | { id: number; key: 'import.overLimit'; count: number }
  | { id: number; key: 'export.done'; count: number }
  | { id: number; key: 'export.failed'; message: string };

export type Drag =
  | { kind: 'photo'; photoId: string; x: number; y: number }
  | { kind: 'cell'; cellId: string; photoId: string; x: number; y: number };

export interface EditorState {
  screen: 'start' | 'workspace';
  project: Project | null;
  /** EDT-31: unsaved changes. */
  dirty: boolean;
  selectedCell: string | null;
  /** A selected Spacer, by its path in the tree (Spacers have no id). */
  selectedSpacer: number[] | null;
  /** EDT-13: a panel photo clicked, waiting for a click on a Cell. */
  armedPhoto: string | null;
  sidebarTab: 'templates' | 'photos';
  /** Bumped when previews or thumbnails change (they live outside the store). */
  photoVersion: number;
  importing: number;
  exporting: { done: number; total: number } | null;
  drag: Drag | null;
  notices: Notice[];
}

const initial: EditorState = {
  screen: 'start',
  project: null,
  dirty: false,
  selectedCell: null,
  selectedSpacer: null,
  armedPhoto: null,
  sidebarTab: 'photos',
  photoVersion: 0,
  importing: 0,
  exporting: null,
  drag: null,
  notices: [],
};

let state = initial;
const listeners = new Set<() => void>();

export function getState(): EditorState {
  return state;
}

export function setState(patch: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  for (const l of listeners) l();
}

/** Apply a Project action. No-op actions (returning the same Project) don't mark it dirty. */
export function editProject(action: (p: Project) => Project): void {
  const project = state.project;
  if (!project) return;
  const next = action(project);
  if (next !== project) setState({ project: next, dirty: true });
}

let noticeId = 1;
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type NoticeInput = DistributiveOmit<Notice, 'id'>;

export function notify(notice: NoticeInput): void {
  const n = { ...notice, id: noticeId++ } as Notice;
  setState((s) => ({ notices: [...s.notices, n].slice(-6) }));
}

export function dismissNotice(id: number): void {
  setState((s) => ({ notices: s.notices.filter((n) => n.id !== id) }));
}

export function useEditor<T>(select: (s: EditorState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
  );
}

/** For tests: a fresh state. */
export function resetState(): void {
  state = initial;
  for (const l of listeners) l();
}
