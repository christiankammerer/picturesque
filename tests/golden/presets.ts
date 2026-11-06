// SPDX-License-Identifier: GPL-3.0-or-later
// The "Black frame" Style Preset values from TPL-09 (05-templates.md). The
// Presets themselves arrive with M4; RND-08's check uses this one.

import type { LayoutStyle } from '../../src/shared/model/schema.ts';

export const STYLE_PRESET_BLACK_FRAME: LayoutStyle = {
  gap: 0.03,
  cornerRadius: 0,
  borderWidth: 0,
  borderColor: '#000000',
  background: '#000000',
};
