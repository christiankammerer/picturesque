// SPDX-License-Identifier: GPL-3.0-or-later
//
// HEIC colour. libheif hands back RGB values in the photo's own colour
// space; iPhones shoot in Display P3. Tagging the pixels with their colour
// space lets Chromium convert them to sRGB when they are drawn (the export
// canvas is sRGB, EXP-02). Other formats are colour-managed by Chromium's
// own decoders.

import type { HeaderInfo } from '../import/formats.ts';

/** nclx colour_primaries (ISO/IEC 23091-2): 1 = BT.709/sRGB, 2 = unspecified, 12 = P3 D65. */
const NCLX_P3_D65 = 12;

/**
 * The colour space of a HEIC's pixels: Display P3 when its colr box says so
 * (nclx primaries, or an ICC profile with P3 primaries), else sRGB. Other
 * wide gamuts (Rec. 2020, Adobe RGB) are rare in HEIC and fall back to sRGB.
 */
export function heicColourSpace(header: HeaderInfo): PredefinedColorSpace {
  const c = header.heifColour;
  if (!c) return 'srgb';
  if (c.type === 'nclx') return c.primaries === NCLX_P3_D65 ? 'display-p3' : 'srgb';
  return iccIsDisplayP3(c.profile) ? 'display-p3' : 'srgb';
}

/** An ICC profile whose red and green primaries (rXYZ, gXYZ, D50) are Display P3's. */
export function iccIsDisplayP3(profile: Uint8Array): boolean {
  const xyz = (sig: string): [number, number, number] | undefined => {
    if (profile.length < 132) return undefined;
    const v = new DataView(profile.buffer, profile.byteOffset, profile.byteLength);
    const n = v.getUint32(128);
    for (let i = 0; i < n && 144 + i * 12 <= profile.length; i++) {
      const at = 132 + i * 12;
      if (String.fromCharCode(...profile.subarray(at, at + 4)) !== sig) continue;
      const off = v.getUint32(at + 4);
      if (off + 20 > profile.length) return undefined;
      return [v.getInt32(off + 8) / 65536, v.getInt32(off + 12) / 65536, v.getInt32(off + 16) / 65536];
    }
    return undefined;
  };
  const r = xyz('rXYZ');
  const g = xyz('gXYZ');
  if (!r || !g) return false;
  // Display P3 (D50): r ≈ (0.515, 0.241, −0.001), g ≈ (0.292, 0.692, 0.042). sRGB: r ≈ (0.436, 0.222, 0.014).
  const near = (a: number[], b: number[]) => a.every((x, i) => Math.abs(x - b[i]!) < 0.01);
  return near(r, [0.5151, 0.2412, -0.0011]) && near(g, [0.292, 0.6922, 0.0419]);
}
