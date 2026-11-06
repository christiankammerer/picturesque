// SPDX-License-Identifier: GPL-3.0-or-later
//
// TPL-04 / TPL-11: which built-in Templates the Templates tab lists, and in
// what order. My Templates (saved Templates) join in M4.

import { cellsOf, type AspectRatio, type PostType } from '../model/schema.ts';
import { BUILT_IN_TEMPLATES, type BuiltInTemplate } from './builtins.ts';

export interface PickerEntry {
  template: BuiltInTemplate;
  /** TPL-12: the photo count on the thumbnail, for the current Slide count. */
  photos: number;
}

export interface PickerSection {
  kind: BuiltInTemplate['kind'];
  entries: PickerEntry[];
}

/**
 * The Templates offered for a Post. At 9:16 (a Story) the Story Templates
 * come first, then the Collage ones; Story Templates appear only at 9:16.
 * Within each section: by photo count, ascending, ties in TPL-06 order; if
 * the Project has photos, Templates whose count equals it come first.
 */
export function pickerSections(type: PostType, aspectRatio: AspectRatio, slides: number, projectPhotos: number): PickerSection[] {
  const kinds: BuiltInTemplate['kind'][] =
    type === 'collage' ? (aspectRatio === '9:16' ? ['story', 'collage'] : ['collage']) : [type];
  return kinds.map((kind) => {
    const entries = BUILT_IN_TEMPLATES.filter((t) => t.kind === kind)
      .map((template, order) => ({ template, order, photos: cellsOf(template.layout(kind === 'carousel' || kind === 'seamless' ? slides : 1)).length }))
      .sort((a, b) => a.photos - b.photos || a.order - b.order);
    const matching = projectPhotos > 0 ? entries.filter((e) => e.photos === projectPhotos) : [];
    const rest = entries.filter((e) => !matching.includes(e));
    return { kind, entries: [...matching, ...rest].map(({ template, photos }) => ({ template, photos })) };
  });
}
