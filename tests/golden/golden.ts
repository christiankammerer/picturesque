// SPDX-License-Identifier: GPL-3.0-or-later
//
// Golden-image harness. Runs in headless Chromium (Vitest browser mode).
//
// A golden test renders a fixture and compares it pixel by pixel with a
// stored PNG in tests/golden/__golden__/. It passes if at most 0.1% of pixels
// differ by more than 2/255 in any channel. On failure the actual image and a
// diff are written to tests/golden/__output__/.
//
// Updating references is deliberate: `npm run test:golden:update`, then
// review the changed PNGs before committing.

import { inject } from 'vitest';
import { commands } from 'vitest/browser';
import { render, type PhotoSource, type RenderOptions } from '../../src/shared/render/render.ts';
import { canvasPixelSize } from '../../src/shared/model/post.ts';
import type { Post } from '../../src/shared/model/schema.ts';
import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';

declare module 'vitest' {
  export interface ProvidedContext {
    updateGolden: boolean;
  }
}

export interface Tolerance {
  /** Per-channel difference that counts a pixel as different (0..255). */
  channel: number;
  /** Fraction of pixels allowed to differ. */
  pixels: number;
}

export const DEFAULT_TOLERANCE: Tolerance = { channel: 2, pixels: 0.001 };

export function renderToCanvas(
  post: Post,
  photos: PhotoSource,
  options: Partial<RenderOptions> & { scale: number },
): OffscreenCanvas {
  const { width, height } = canvasPixelSize(post, options.scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: false })!;
  render(ctx, post, photos, { emptyCells: 'placeholder', ...options });
  return canvas;
}

export function pixels(canvas: OffscreenCanvas): ImageData {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
}

export function pixelAt(img: ImageData, x: number, y: number): [number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
}

export function hex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Fraction of pixels whose largest channel difference exceeds `channel`. */
export function diffFraction(a: ImageData, b: ImageData, channel: number): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let bad = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.max(
      Math.abs(a.data[i]! - b.data[i]!),
      Math.abs(a.data[i + 1]! - b.data[i + 1]!),
      Math.abs(a.data[i + 2]! - b.data[i + 2]!),
    );
    if (d > channel) bad++;
  }
  return bad / (a.width * a.height);
}

/** Mean absolute difference per channel, 0..255. */
export function meanAbsDiff(a: ImageData, b: ImageData): number {
  let sum = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    sum += Math.abs(a.data[i]! - b.data[i]!) + Math.abs(a.data[i + 1]! - b.data[i + 1]!) + Math.abs(a.data[i + 2]! - b.data[i + 2]!);
  }
  return sum / ((a.data.length / 4) * 3);
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function decodeImage(bytes: Uint8Array<ArrayBuffer>, type: string): Promise<ImageData> {
  const bitmap = await createImageBitmap(new Blob([bytes], { type }), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  const c = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, c.width, c.height);
}

async function png(canvas: OffscreenCanvas): Promise<string> {
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return toBase64(new Uint8Array(await blob.arrayBuffer()));
}

function imageDataCanvas(img: ImageData): OffscreenCanvas {
  const c = new OffscreenCanvas(img.width, img.height);
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

/** Compare a canvas with its stored reference (or write it, in update mode). */
export async function expectGolden(name: string, canvas: OffscreenCanvas, tolerance: Tolerance = DEFAULT_TOLERANCE): Promise<void> {
  const refPath = `tests/golden/__golden__/${name}.png`;
  if (inject('updateGolden')) {
    await commands.writeFile(refPath, await png(canvas), 'base64');
    return;
  }
  let ref: ImageData;
  try {
    ref = await decodeImage(fromBase64(await commands.readFile(refPath, 'base64')), 'image/png');
  } catch {
    throw new Error(`no reference image ${refPath}; run "npm run test:golden:update" and review it`);
  }
  const actual = pixels(canvas);
  const fraction = diffFraction(actual, ref, tolerance.channel);
  if (fraction > tolerance.pixels) {
    await commands.writeFile(`tests/golden/__output__/${name}.actual.png`, await png(canvas), 'base64');
    if (ref.width === actual.width && ref.height === actual.height) {
      const diff = new ImageData(actual.width, actual.height);
      for (let i = 0; i < diff.data.length; i += 4) {
        const d = Math.max(
          Math.abs(actual.data[i]! - ref.data[i]!),
          Math.abs(actual.data[i + 1]! - ref.data[i + 1]!),
          Math.abs(actual.data[i + 2]! - ref.data[i + 2]!),
        );
        const on = d > tolerance.channel;
        diff.data.set(on ? [255, 0, 0, 255] : [ref.data[i]! / 4, ref.data[i + 1]! / 4, ref.data[i + 2]! / 4, 255], i);
      }
      await commands.writeFile(`tests/golden/__output__/${name}.diff.png`, await png(imageDataCanvas(diff)), 'base64');
    }
    throw new Error(
      `${name}: ${(fraction * 100).toFixed(3)}% of pixels differ (allowed ${(tolerance.pixels * 100).toFixed(3)}%); ` +
        `see tests/golden/__output__/${name}.*.png`,
    );
  }
}

/**
 * A synthetic test photo: a two-colour gradient, a grid every 10%, coloured
 * corner squares (top-left red, top-right green, bottom-left blue,
 * bottom-right yellow) and an arrow pointing up, so position, scale and
 * orientation are all visible.
 */
export function testPattern(width: number, height: number, hue = 200): OffscreenCanvas {
  const c = new OffscreenCanvas(width, height);
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, `hsl(${hue} 60% 70%)`);
  grad.addColorStop(1, `hsl(${(hue + 60) % 360} 60% 35%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, width, height);
  g.strokeStyle = 'rgba(255,255,255,0.6)';
  g.lineWidth = Math.max(1, Math.min(width, height) / 200);
  for (let i = 1; i < 10; i++) {
    g.beginPath();
    g.moveTo((width * i) / 10, 0);
    g.lineTo((width * i) / 10, height);
    g.moveTo(0, (height * i) / 10);
    g.lineTo(width, (height * i) / 10);
    g.stroke();
  }
  const q = Math.min(width, height) / 8;
  g.fillStyle = '#e53935';
  g.fillRect(0, 0, q, q);
  g.fillStyle = '#43a047';
  g.fillRect(width - q, 0, q, q);
  g.fillStyle = '#1e88e5';
  g.fillRect(0, height - q, q, q);
  g.fillStyle = '#fdd835';
  g.fillRect(width - q, height - q, q, q);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(width / 2, height * 0.2);
  g.lineTo(width / 2 + q, height * 0.2 + q * 1.2);
  g.lineTo(width / 2 + q * 0.35, height * 0.2 + q * 1.2);
  g.lineTo(width / 2 + q * 0.35, height * 0.75);
  g.lineTo(width / 2 - q * 0.35, height * 0.75);
  g.lineTo(width / 2 - q * 0.35, height * 0.2 + q * 1.2);
  g.lineTo(width / 2 - q, height * 0.2 + q * 1.2);
  g.closePath();
  g.fill();
  return c;
}

export async function bitmapOf(canvas: OffscreenCanvas): Promise<ImageBitmap> {
  return createImageBitmap(canvas);
}

export async function solid(color: string, width = 64, height = 64): Promise<ImageBitmap> {
  const c = new OffscreenCanvas(width, height);
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, width, height);
  return createImageBitmap(c);
}

let fontsLoaded: Promise<void> | undefined;

/** RND-11: load Inter before rendering text. */
export function loadInter(): Promise<void> {
  fontsLoaded ??= (async () => {
    for (const [url, weight] of [[interRegular, '400'], [interBold, '700']] as const) {
      const face = new FontFace('Inter', `url(${url})`, { weight });
      document.fonts.add(await face.load());
    }
  })();
  return fontsLoaded;
}
