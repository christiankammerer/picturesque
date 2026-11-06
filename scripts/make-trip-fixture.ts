// SPDX-License-Identifier: GPL-3.0-or-later
//
// Generates fixtures/trip: four synthetic "holiday photos" (procedurally drawn,
// so they are ours to license as CC0) and a Grid 2×2 Collage post.json that
// uses them. One photo is stored landscape with EXIF Orientation 6, as phones
// do, so the export has to apply the orientation.
//
//   node scripts/make-trip-fixture.ts

import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildExifPayload, TAG_ORIENTATION } from '../src/shared/export/exif.ts';
import { insertApp1 } from '../src/shared/export/jpeg.ts';
import { ProjectFileSchema, type PhotoMeta, type ProjectFile } from '../src/shared/model/schema.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'fixtures/trip');

interface Scene {
  name: string;
  kind: 'sunset' | 'sea' | 'forest' | 'city';
  width: number; // stored pixel size
  height: number;
  orientation?: 6;
  date: string;
}

const scenes: Scene[] = [
  { name: 'IMG_0001.jpg', kind: 'sunset', width: 2400, height: 1600, date: '2026-07-14T19:42:10+02:00' },
  // Portrait photo, stored landscape and turned by EXIF orientation 6.
  { name: 'IMG_0002.jpg', kind: 'sea', width: 2400, height: 1600, orientation: 6, date: '2026-07-15T11:03:55+02:00' },
  { name: 'IMG_0003.jpg', kind: 'forest', width: 1800, height: 1800, date: '2026-07-16T09:20:31+02:00' },
  { name: 'IMG_0004.jpg', kind: 'city', width: 2400, height: 1600, date: '2026-07-16T22:14:02+02:00' },
];

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const encoded: string[] = [];
  for (const scene of scenes) {
    encoded.push(await page.evaluate(drawScene, scene));
  }
  await browser.close();

  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, 'photos'), { recursive: true });

  const photos: Record<string, PhotoMeta> = {};
  const ids: string[] = [];
  for (const [i, scene] of scenes.entries()) {
    let bytes: Uint8Array = Buffer.from(encoded[i]!, 'base64');
    if (scene.orientation) {
      bytes = insertApp1(bytes, buildExifPayload([{ tag: TAG_ORIENTATION, type: 'short', value: scene.orientation }], []));
    }
    const id = createHash('sha256').update(bytes).digest('hex');
    const swap = scene.orientation === 6;
    photos[id] = {
      id,
      ext: 'jpg',
      originalName: scene.name,
      captureDate: scene.date,
      width: swap ? scene.height : scene.width,
      height: swap ? scene.width : scene.height,
    };
    ids.push(id);
    await writeFile(join(dir, 'photos', `${id}.jpg`), bytes);
  }

  const framing = { zoom: 1, focusX: 0.5, focusY: 0.5, rotate90: 0 as const, straighten: 0 };
  const cell = (id: string, photoId: string, f = framing) => ({ kind: 'cell' as const, id, photo: { photoId, framing: f } });
  const half = [0.5, 0.5];
  const project: ProjectFile = {
    formatVersion: 1,
    appVersion: '0.1.0',
    name: 'trip',
    post: {
      type: 'collage',
      aspectRatio: '4:5',
      layout: {
        postType: 'collage',
        root: {
          kind: 'split',
          direction: 'column',
          sizes: half,
          children: [
            { kind: 'split', direction: 'row', sizes: half, children: [cell('c1', ids[0]!, { ...framing, focusX: 0.62 }), cell('c2', ids[1]!)] },
            { kind: 'split', direction: 'row', sizes: half, children: [cell('c3', ids[2]!), cell('c4', ids[3]!, { ...framing, zoom: 1.4, focusY: 0.55 })] },
          ],
        },
      },
      style: { gap: 0.02, cornerRadius: 0.03, borderWidth: 0, borderColor: '#000000', background: '#f4efe6' },
      textBoxes: [],
      sourceTemplate: { id: 'grid-2x2', name: 'Grid 2×2', builtIn: true },
    },
    photos,
    panelOrder: ids,
  };
  ProjectFileSchema.parse(project);
  await writeFile(join(dir, 'post.json'), `${JSON.stringify(project, null, 2)}\n`);
  console.log(`wrote ${dir}`);
}

/** Runs in the page. Draws a scene deterministically and returns a base64 JPEG. */
async function drawScene(scene: Scene): Promise<string> {
  let seed = [...scene.kind].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  // Draw upright, then store rotated for an EXIF-oriented photo.
  const upright = scene.orientation === 6 ? { w: scene.height, h: scene.width } : { w: scene.width, h: scene.height };
  const c = new OffscreenCanvas(upright.w, upright.h);
  const g = c.getContext('2d')!;
  const { w, h } = upright;
  const sky = (stops: [number, string][]) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    for (const [o, col] of stops) grad.addColorStop(o, col);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  };
  const ridge = (base: number, amp: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 40) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x / (w / 7) + rnd() * 0.6)) - rnd() * amp * 0.3);
    g.lineTo(w, h);
    g.fill();
  };
  switch (scene.kind) {
    case 'sunset':
      sky([[0, '#2b1b4f'], [0.45, '#d8576b'], [0.7, '#f6a65a'], [1, '#f8d79a']]);
      g.fillStyle = '#ffe9a8';
      g.beginPath();
      g.arc(w * 0.62, h * 0.6, h * 0.09, 0, Math.PI * 2);
      g.fill();
      ridge(h * 0.72, h * 0.18, '#5b3a63');
      ridge(h * 0.82, h * 0.14, '#3a2448');
      ridge(h * 0.92, h * 0.1, '#1f1430');
      break;
    case 'sea': {
      sky([[0, '#5fa8e8'], [0.55, '#bfe3f7'], [0.56, '#1f6f9c'], [1, '#0d3d5c']]);
      g.fillStyle = '#fff6d0';
      g.beginPath();
      g.arc(w * 0.3, h * 0.22, w * 0.08, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 160; i++) {
        const y = h * (0.58 + rnd() * 0.42);
        const x = rnd() * w;
        g.lineWidth = 2 + rnd() * 5;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + w * (0.03 + rnd() * 0.08), y);
        g.stroke();
      }
      g.fillStyle = '#f2e3c2';
      g.beginPath();
      g.moveTo(0, h);
      g.quadraticCurveTo(w * 0.5, h * 0.86, w, h * 0.93);
      g.lineTo(w, h);
      g.fill();
      break;
    }
    case 'forest':
      sky([[0, '#cfe8d8'], [1, '#7fb38f']]);
      for (let layer = 0; layer < 3; layer++) {
        const shade = ['#4f8a5f', '#2f6b44', '#1b4a2e'][layer]!;
        for (let i = 0; i < 16; i++) {
          const x = rnd() * w;
          const base = h * (0.7 + layer * 0.12);
          const th = h * (0.25 + rnd() * 0.25);
          g.fillStyle = shade;
          g.beginPath();
          g.moveTo(x, base - th);
          g.lineTo(x - th * 0.25, base);
          g.lineTo(x + th * 0.25, base);
          g.fill();
        }
      }
      break;
    case 'city':
      sky([[0, '#060b24'], [1, '#27305e']]);
      for (let i = 0; i < 120; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
        g.fillRect(rnd() * w, rnd() * h * 0.5, 3, 3);
      }
      for (let x = 0; x < w; ) {
        const bw = w * (0.05 + rnd() * 0.07);
        const bh = h * (0.25 + rnd() * 0.5);
        g.fillStyle = '#10142c';
        g.fillRect(x, h - bh, bw, bh);
        for (let wy = h - bh + 14; wy < h - 14; wy += 26) {
          for (let wx = x + 10; wx < x + bw - 14; wx += 22) {
            if (rnd() < 0.45) {
              g.fillStyle = rnd() < 0.8 ? '#ffd37a' : '#9fd3ff';
              g.fillRect(wx, wy, 10, 14);
            }
          }
        }
        x += bw + 4;
      }
      break;
  }
  let out: OffscreenCanvas = c;
  if (scene.orientation === 6) {
    // Store rotated 90° counter-clockwise, so orientation 6 (rotate 90° CW) restores it.
    out = new OffscreenCanvas(scene.width, scene.height);
    const o = out.getContext('2d')!;
    o.translate(0, scene.height);
    o.rotate(-Math.PI / 2);
    o.drawImage(c, 0, 0);
  }
  const blob = await out.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
