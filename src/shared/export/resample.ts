// SPDX-License-Identifier: GPL-3.0-or-later
//
// EXP-03: the 2× render is downscaled by exactly 2 with a separable
// Lanczos-3 filter, in gamma-encoded sRGB.
//
// Halving means every output pixel sees the same 12 source pixels with the
// same weights: output pixel o covers source pixels 2o and 2o+1, whose
// shared edge (continuous coordinate 2o + 1) is the filter's centre.

const A = 3; // Lanczos lobes
const FACTOR = 2;
export const TAPS = 2 * A * FACTOR; // 12
/** How far (source px) the filter reaches beyond an output pixel's own two. */
export const REACH = TAPS / 2 - 1; // 5

function lanczos(x: number): number {
  if (x === 0) return 1;
  if (Math.abs(x) >= A) return 0;
  const px = Math.PI * x;
  return (A * Math.sin(px) * Math.sin(px / A)) / (px * px);
}

/** Weights for source offsets −5…+6 relative to 2o (normalised to sum 1). */
const WEIGHTS: Float32Array = (() => {
  const w = new Float32Array(TAPS);
  let sum = 0;
  for (let k = 0; k < TAPS; k++) {
    const offset = k - (TAPS / 2 - 1); // −5 … 6
    // Distance from the source pixel's centre (offset + 0.5) to the filter centre (1), in output px.
    w[k] = lanczos((offset + 0.5 - 1) / FACTOR);
    sum += w[k]!;
  }
  for (let k = 0; k < TAPS; k++) w[k]! /= sum;
  return w;
})();

export interface HalveOptions {
  /** Source column of output column 0 is `offsetX` (even). Default 0. */
  offsetX?: number;
  /** Output width. Default (width − offsetX) / 2. */
  outWidth?: number;
  /**
   * Source columns outside [clampX0, clampX1) don't exist (they lie beyond
   * the canvas): reads there are clamped to the nearest edge column.
   * Default: the whole source.
   */
  clampX0?: number;
  clampX1?: number;
}

/**
 * Halve an RGBA image (alpha ignored, written as 255) with Lanczos-3.
 * `height` must be even. Returns RGBA of `outWidth × height / 2`.
 */
export function halveLanczos(src: Uint8ClampedArray, width: number, height: number, options: HalveOptions = {}): Uint8ClampedArray<ArrayBuffer> {
  const offsetX = options.offsetX ?? 0;
  const outW = options.outWidth ?? (width - offsetX) / 2;
  const outH = height / 2;
  const cx0 = options.clampX0 ?? 0;
  const cx1 = options.clampX1 ?? width;
  if (!Number.isInteger(outH) || !Number.isInteger(outW) || offsetX % 2 !== 0) throw new Error('halveLanczos needs even sizes and offset');
  const w = WEIGHTS;

  // Horizontal pass: width → outW, all rows, 3 channels as float.
  const mid = new Float32Array(outW * height * 3);
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    const outRow = y * outW * 3;
    for (let o = 0; o < outW; o++) {
      const first = offsetX + 2 * o - REACH;
      let r = 0;
      let g = 0;
      let b = 0;
      if (first >= cx0 && first + TAPS <= cx1) {
        let i = row + first * 4;
        for (let k = 0; k < TAPS; k++, i += 4) {
          const wk = w[k]!;
          r += src[i]! * wk;
          g += src[i + 1]! * wk;
          b += src[i + 2]! * wk;
        }
      } else {
        for (let k = 0; k < TAPS; k++) {
          const x = Math.min(cx1 - 1, Math.max(cx0, first + k));
          const i = row + x * 4;
          const wk = w[k]!;
          r += src[i]! * wk;
          g += src[i + 1]! * wk;
          b += src[i + 2]! * wk;
        }
      }
      const m = outRow + o * 3;
      mid[m] = r;
      mid[m + 1] = g;
      mid[m + 2] = b;
    }
  }

  // Vertical pass: height → outH.
  const out = new Uint8ClampedArray(outW * outH * 4);
  const stride = outW * 3;
  for (let o = 0; o < outH; o++) {
    const first = 2 * o - REACH;
    const outRow = o * outW * 4;
    const inside = first >= 0 && first + TAPS <= height;
    for (let x = 0; x < outW; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < TAPS; k++) {
        const y = inside ? first + k : Math.min(height - 1, Math.max(0, first + k));
        const m = y * stride + x * 3;
        const wk = w[k]!;
        r += mid[m]! * wk;
        g += mid[m + 1]! * wk;
        b += mid[m + 2]! * wk;
      }
      const q = outRow + x * 4;
      out[q] = r; // Uint8ClampedArray rounds and clamps (Lanczos overshoots slightly)
      out[q + 1] = g;
      out[q + 2] = b;
      out[q + 3] = 255;
    }
  }
  return out;
}
