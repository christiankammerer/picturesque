// SPDX-License-Identifier: GPL-3.0-or-later
//
// Builders matching the Template notation of 05-templates.md (TPL-06).
// Every call makes fresh Cell ids, so each applied Template is a copy.

import { newCellId } from '../model/layout-ops.ts';
import type { LayoutNode } from '../model/schema.ts';

export type Build = () => LayoutNode;

/** `P`: an empty Cell. */
export const P: Build = () => ({ kind: 'cell', id: newCellId() });
/** `_`: a Spacer. */
export const _: Build = () => ({ kind: 'spacer' });

const split = (direction: 'row' | 'column', sizes: number[], children: Build[]): Build => () => {
  const total = sizes.reduce((a, b) => a + b, 0);
  return { kind: 'split', direction, sizes: sizes.map((s) => s / total), children: children.map((c) => c()) };
};

/** `row[a,b,…](X,Y,…)` */
export const row = (sizes: number[], ...children: Build[]): Build => split('row', sizes, children);
/** `col[a,b,…](X,Y,…)` */
export const col = (sizes: number[], ...children: Build[]): Build => split('column', sizes, children);
/** `row*k(X)` */
export const rowN = (k: number, x: Build): Build => split('row', Array(k).fill(1), Array(k).fill(x));
/** `col*k(X)` */
export const colN = (k: number, x: Build): Build => split('column', Array(k).fill(1), Array(k).fill(x));
/** `frame(X, mx, my)`: X with a Spacer margin. */
export const frame = (x: Build, mx: number, my: number): Build =>
  col([my, 1 - 2 * my, my], _, row([mx, 1 - 2 * mx, mx], _, x, _), _);
/** `grid2` */
export const grid2: Build = colN(2, rowN(2, P));
