// SPDX-License-Identifier: GPL-3.0-or-later
//
// The Project being edited, and every change the editor makes to it, as pure
// functions (Project → Project). Undo (EDT-26, M7) stacks these states.

import type { CellNode, Framing, Layout, LayoutNode, PhotoMeta, Post } from './schema.ts';
import { DEFAULT_FRAMING } from './schema.ts';

export interface Project {
  /** null until the Project is saved (export then uses picturesque-YYYY-MM-DD-HHMM). */
  name: string | null;
  post: Post;
  photos: Record<string, PhotoMeta>;
  /** Photos-panel order: every photoId exactly once. */
  panelOrder: string[];
}

export function emptyProject(post: Post): Project {
  return { name: null, post, photos: {}, panelOrder: [] };
}

// ---------- Cells ----------

function mapNode(node: LayoutNode, fn: (cell: CellNode) => CellNode): LayoutNode {
  if (node.kind === 'cell') return fn(node);
  if (node.kind === 'split') {
    let changed = false;
    const children = node.children.map((c) => {
      const n = mapNode(c, fn);
      if (n !== c) changed = true;
      return n;
    });
    return changed ? { ...node, children } : node;
  }
  return node;
}

/** Apply `fn` to every Cell; unchanged subtrees keep their identity. */
export function mapCells(layout: Layout, fn: (cell: CellNode) => CellNode): Layout {
  if (layout.postType === 'carousel') {
    const slides = layout.slides.map((s) => mapNode(s, fn));
    return slides.every((s, i) => s === layout.slides[i]) ? layout : { ...layout, slides };
  }
  const root = mapNode(layout.root, fn);
  return root === layout.root ? layout : { ...layout, root };
}

export function findCell(layout: Layout, cellId: string): CellNode | undefined {
  let found: CellNode | undefined;
  mapCells(layout, (c) => {
    if (c.id === cellId) found = c;
    return c;
  });
  return found;
}

function withLayout(project: Project, layout: Layout): Project {
  return layout === project.post.layout ? project : { ...project, post: { ...project.post, layout } };
}

function updateCell(project: Project, cellId: string, fn: (cell: CellNode) => CellNode): Project {
  return withLayout(project, mapCells(project.post.layout, (c) => (c.id === cellId ? fn(c) : c)));
}

/** EDT-14: moved photos get DEFAULT_FRAMING but keep their quarter turn. */
function resetKeepingTurn(framing: Framing | undefined): Framing {
  return { ...DEFAULT_FRAMING, rotate90: framing?.rotate90 ?? 0 };
}

function withoutPhoto(cell: CellNode): CellNode {
  return { kind: 'cell', id: cell.id };
}

// ---------- photos in the panel ----------

/**
 * EDT-08 / EDT-09: add imported photos. The panel is ordered by capture date,
 * oldest first; photos with the same date keep their import order.
 */
export function addPhotos(project: Project, metas: readonly PhotoMeta[]): Project {
  const photos = { ...project.photos };
  const added: string[] = [];
  for (const m of metas) {
    if (photos[m.id]) continue;
    photos[m.id] = m;
    added.push(m.id);
  }
  if (added.length === 0) return project;
  return { ...project, photos, panelOrder: sortByDate([...project.panelOrder, ...added], photos) };
}

/** The panel order sorted by capture date, oldest first (stable). */
export function sortByDate(ids: readonly string[], photos: Record<string, PhotoMeta>): string[] {
  const time = (id: string) => Date.parse(photos[id]!.captureDate);
  return ids
    .map((id, i) => ({ id, i, t: time(id) }))
    .sort((a, b) => (a.t === b.t || (Number.isNaN(a.t) && Number.isNaN(b.t)) ? a.i - b.i : Number.isNaN(a.t) ? 1 : Number.isNaN(b.t) ? -1 : a.t - b.t))
    .map((x) => x.id);
}

/** EDT-11: remove photos from the Project, and from every Cell that holds them. */
export function removePhotos(project: Project, ids: readonly string[]): Project {
  const gone = new Set(ids.filter((id) => project.photos[id]));
  if (gone.size === 0) return project;
  const photos = { ...project.photos };
  for (const id of gone) delete photos[id];
  const layout = mapCells(project.post.layout, (c) => (c.photo && gone.has(c.photo.photoId) ? withoutPhoto(c) : c));
  return {
    ...project,
    photos,
    panelOrder: project.panelOrder.filter((id) => !gone.has(id)),
    post: { ...project.post, layout },
  };
}

/** EDT-09: how many Cells each photo is placed in. */
export function usageCounts(layout: Layout): Map<string, number> {
  const counts = new Map<string, number>();
  mapCells(layout, (c) => {
    if (c.photo) counts.set(c.photo.photoId, (counts.get(c.photo.photoId) ?? 0) + 1);
    return c;
  });
  return counts;
}

// ---------- placing and moving (EDT-13, EDT-14) ----------

/** Place a panel photo in a Cell with default framing. A photo already there goes back to unplaced. */
export function placePhoto(project: Project, cellId: string, photoId: string): Project {
  if (!project.photos[photoId]) return project;
  return updateCell(project, cellId, (c) => ({ ...c, photo: { photoId, framing: { ...DEFAULT_FRAMING } } }));
}

/** Drag a photo from one Cell to another: swap with a filled Cell, move to an empty one. */
export function movePhoto(project: Project, fromCellId: string, toCellId: string): Project {
  if (fromCellId === toCellId) return project;
  const from = findCell(project.post.layout, fromCellId);
  const to = findCell(project.post.layout, toCellId);
  if (!from?.photo || !to) return project;
  const moving = { photoId: from.photo.photoId, framing: resetKeepingTurn(from.photo.framing) };
  const back = to.photo ? { photoId: to.photo.photoId, framing: resetKeepingTurn(to.photo.framing) } : undefined;
  return withLayout(
    project,
    mapCells(project.post.layout, (c) => {
      if (c.id === toCellId) return { ...c, photo: moving };
      if (c.id === fromCellId) return back ? { ...c, photo: back } : withoutPhoto(c);
      return c;
    }),
  );
}

/** Empty a Cell; its photo goes back to unplaced (EDT-14 Cell → panel, EDT-15 double-click). */
export function emptyCell(project: Project, cellId: string): Project {
  const cell = findCell(project.post.layout, cellId);
  if (!cell?.photo) return project;
  return updateCell(project, cellId, withoutPhoto);
}

// ---------- framing (EDT-15) ----------

export function setFraming(project: Project, cellId: string, framing: Framing): Project {
  return updateCell(project, cellId, (c) => (c.photo ? { ...c, photo: { ...c.photo, framing } } : c));
}

/** Reset framing (Ctrl/Cmd+0): DEFAULT_FRAMING, keeping the quarter turn. */
export function resetFraming(project: Project, cellId: string): Project {
  return updateCell(project, cellId, (c) => (c.photo ? { ...c, photo: { ...c.photo, framing: resetKeepingTurn(c.photo.framing) } } : c));
}

/** Rotate 90° clockwise. */
export function rotateCell(project: Project, cellId: string): Project {
  return updateCell(project, cellId, (c) => {
    if (!c.photo) return c;
    const rotate90 = ((c.photo.framing.rotate90 + 90) % 360) as Framing['rotate90'];
    return { ...c, photo: { ...c.photo, framing: { ...c.photo.framing, rotate90 } } };
  });
}
