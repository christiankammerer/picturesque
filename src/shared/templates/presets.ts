// SPDX-License-Identifier: GPL-3.0-or-later
//
// TPL-09: the six Style Presets, in inspector order.

import type { LayoutStyle } from '../model/schema.ts';

export type PresetId = 'none' | 'clean' | 'gallery' | 'black-frame' | 'soft' | 'film';

export const STYLE_PRESETS: readonly { id: PresetId; style: LayoutStyle }[] = [
  { id: 'none', style: { gap: 0, cornerRadius: 0, borderWidth: 0, borderColor: '#000000', background: '#ffffff' } },
  { id: 'clean', style: { gap: 0.01, cornerRadius: 0, borderWidth: 0, borderColor: '#000000', background: '#ffffff' } },
  { id: 'gallery', style: { gap: 0.06, cornerRadius: 0, borderWidth: 0, borderColor: '#000000', background: '#ffffff' } },
  { id: 'black-frame', style: { gap: 0.03, cornerRadius: 0, borderWidth: 0, borderColor: '#000000', background: '#000000' } },
  { id: 'soft', style: { gap: 0.02, cornerRadius: 0.03, borderWidth: 0, borderColor: '#000000', background: '#f4efe6' } },
  { id: 'film', style: { gap: 0.006, cornerRadius: 0, borderWidth: 0, borderColor: '#000000', background: '#0b0b0b' } },
];

export function presetStyle(id: PresetId): LayoutStyle {
  return { ...STYLE_PRESETS.find((p) => p.id === id)!.style };
}

/** TPL-10: the Preset whose five values all match, if any. */
export function matchingPreset(style: LayoutStyle): PresetId | undefined {
  return STYLE_PRESETS.find(
    (p) =>
      p.style.gap === style.gap &&
      p.style.cornerRadius === style.cornerRadius &&
      p.style.borderWidth === style.borderWidth &&
      p.style.borderColor === style.borderColor &&
      p.style.background === style.background,
  )?.id;
}
