// SPDX-License-Identifier: GPL-3.0-or-later
//
// Built-in Templates (TPL-06), as data. M2 ships the Collage and Story ones
// and Carousel "One per Slide"; M4 adds the rest of the 27 here.

import type { AspectRatio, Layout, Post, TextBox } from '../model/schema.ts';
import { col, colN, frame, grid2, P, row, rowN, _, type Build } from './notation.ts';
import { presetStyle, type PresetId } from './presets.ts';

export type TemplateKind = 'collage' | 'story' | 'carousel' | 'seamless';

export interface BuiltInTemplate {
  id: string;
  kind: TemplateKind;
  /** i18n key of the name. */
  nameKey: string;
  preset: PresetId;
  /** Has placeholder text (shows "Aa", TPL-12). */
  text?: boolean;
  /** The Layout for n Slides (n = 1 for Collage and Story). */
  layout(n: number): Layout;
  textBoxes?(n: number): TextBox[];
}

const collage = (id: string, nameKey: string, tree: Build, preset: PresetId = 'clean'): BuiltInTemplate => ({
  id, kind: 'collage', nameKey, preset, layout: () => ({ postType: 'collage', root: tree() }),
});
const story = (id: string, nameKey: string, tree: Build, preset: PresetId = 'clean'): BuiltInTemplate => ({
  id, kind: 'story', nameKey, preset, layout: () => ({ postType: 'collage', root: tree() }),
});

const textBox = (over: Partial<TextBox> & Pick<TextBox, 'text' | 'x' | 'y' | 'width' | 'size' | 'weight' | 'align'>): TextBox => ({
  id: crypto.randomUUID(),
  font: { family: 'Inter', source: 'bundled' },
  color: '#1a1a1a',
  ...over,
});

export const BUILT_IN_TEMPLATES: readonly BuiltInTemplate[] = [
  // Collage (8)
  collage('collage-single-framed', 'templates.singleFramed', frame(P, 0.08, 0.08), 'gallery'),
  collage('collage-side-by-side', 'templates.sideBySide', rowN(2, P)),
  collage('collage-three-columns', 'templates.threeColumns', rowN(3, P)),
  collage('collage-grid-2x2', 'templates.grid2x2', grid2),
  collage('collage-grid-3x3', 'templates.grid3x3', colN(3, rowN(3, P))),
  collage('collage-hero-2', 'templates.hero2', col([0.62, 0.38], P, rowN(2, P))),
  collage('collage-hero-3', 'templates.hero3', col([0.62, 0.38], P, rowN(3, P))),
  collage('collage-mosaic', 'templates.mosaic', row([0.62, 0.38], P, colN(3, P))),
  // Story (4)
  story('story-single-framed', 'templates.singleFramed', frame(P, 0.08, 0.06), 'gallery'),
  story('story-two-stacked', 'templates.twoStacked', colN(2, P)),
  story('story-photo-strip', 'templates.photoStrip', colN(4, P)),
  {
    ...story('story-caption', 'templates.caption', col([0.8, 0.2], P, _)),
    text: true,
    textBoxes: () => [textBox({ text: 'Caption', x: 0.08, y: 0.84, width: 0.84, size: 0.05, weight: 400, align: 'center' })],
  },
  // Carousel
  {
    id: 'carousel-one-per-slide',
    kind: 'carousel',
    nameKey: 'templates.onePerSlide',
    preset: 'none',
    layout: (n) => ({ postType: 'carousel', slides: Array.from({ length: n }, () => P()) }),
  },
];

export function templateById(id: string): BuiltInTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

/** A new Post made from a built-in Template, without photos. */
export function postFromTemplate(t: BuiltInTemplate, aspectRatio: AspectRatio, slides = 1): Post {
  const layout = t.layout(t.kind === 'carousel' || t.kind === 'seamless' ? slides : 1);
  return {
    type: layout.postType,
    aspectRatio,
    layout,
    style: presetStyle(t.preset),
    textBoxes: t.textBoxes?.(slides) ?? [],
    sourceTemplate: { id: t.id, name: t.nameKey, builtIn: true },
  };
}
