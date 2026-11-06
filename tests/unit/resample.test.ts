// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { halveLanczos, REACH } from '../../src/shared/export/resample.ts';

function image(w: number, h: number, f: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([...f(x, y), 255], (y * w + x) * 4);
  return d;
}

describe('EXP-03 Lanczos-3 halving', () => {
  it('keeps a flat colour exactly', () => {
    const out = halveLanczos(image(20, 10, () => [10, 200, 77]), 20, 10);
    for (let i = 0; i < out.length; i += 4) expect([...out.subarray(i, i + 4)]).toEqual([10, 200, 77, 255]);
  });
  it('averages a 2-px checker to its mean', () => {
    const out = halveLanczos(image(40, 40, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0])), 40, 40);
    const centre = (10 * 20 + 10) * 4;
    expect(Math.abs(out[centre]! - 127.5)).toBeLessThan(2);
  });
  it('keeps a soft edge sharper than a box filter would, with only small overshoot', () => {
    const w = 64;
    const src = image(w, 2, (x) => (x < 32 ? [0, 0, 0] : [255, 255, 255]));
    const out = halveLanczos(src, w, 2);
    const row = Array.from({ length: 32 }, (_, x) => out[x * 4]!);
    expect(row[14]).toBeLessThanOrEqual(10); // two output px before the edge: still dark
    expect(row[17]).toBeGreaterThanOrEqual(245); // two after: already light
    expect(row[15]! + row[16]!).toBeGreaterThan(200); // and the edge pixels carry it
  });
  it('a strip with margins equals the same columns of the whole image', () => {
    const w = 200;
    const h = 20;
    const src = image(w, h, (x, y) => [(x * 37 + y * 11) % 256, (x * x + y) % 256, (x ^ y) % 256]);
    const whole = halveLanczos(src, w, h);
    // Columns 60…139 of the source, with an 8-px margin each side.
    const x0 = 60 - 8;
    const x1 = 140 + 8;
    const strip = new Uint8ClampedArray((x1 - x0) * h * 4);
    for (let y = 0; y < h; y++) strip.set(src.subarray((y * w + x0) * 4, (y * w + x1) * 4), y * (x1 - x0) * 4);
    const part = halveLanczos(strip, x1 - x0, h, { offsetX: 60 - x0, outWidth: 40 });
    for (let y = 0; y < h / 2; y++) {
      for (let x = 0; x < 40; x++) {
        const a = (y * 40 + x) * 4;
        const b = (y * 100 + 30 + x) * 4;
        expect([part[a], part[a + 1], part[a + 2]]).toEqual([whole[b], whole[b + 1], whole[b + 2]]);
      }
    }
    expect(REACH).toBeLessThanOrEqual(8);
  });
  it('clamps at the given edges, like the edge of the canvas', () => {
    const src = image(8, 2, (x) => (x < 4 ? [100, 100, 100] : [0, 0, 0]));
    const out = halveLanczos(src, 8, 2, { clampX0: 0, clampX1: 4, outWidth: 2 });
    expect(out[0]).toBe(100);
    expect(out[4]).toBe(100);
  });
});
