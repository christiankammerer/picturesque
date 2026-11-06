// SPDX-License-Identifier: GPL-3.0-or-later
//
// Headless export: turns a post.json fixture plus its photos into the JPEG
// files the app would export, using the app's own export pipeline in headless
// Chromium (the engine Electron ships).
//
//   node scripts/export-headless.ts <post.json> <out-dir> [--photos <dir>]
//
// post.json is a ProjectFile (docs/spec/schema.ts). Each photo is looked up
// as <photos>/<sha256>.<ext> (the layout inside a .picturesque file), then as
// <photos>/<originalName>. <photos> defaults to the "photos" folder next to
// post.json. A photo whose bytes don't hash to its id is refused.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'vite';
import { writeExportFiles } from '../src/main/export/write-files.ts';
import { exportFileNames } from '../src/shared/export/naming.ts';
import { ProjectFileSchema, slideCountOf } from '../src/shared/model/schema.ts';
import type { HeadlessExportRequest, HeadlessExportResult } from '../src/headless/entry.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { photos: { type: 'string' } },
  });
  const [postPath, outDir] = positionals;
  if (!postPath || !outDir) {
    console.error('usage: node scripts/export-headless.ts <post.json> <out-dir> [--photos <dir>]');
    process.exit(2);
  }

  const parsed = ProjectFileSchema.safeParse(JSON.parse(await readFile(postPath, 'utf8')));
  if (!parsed.success) {
    console.error(`${postPath} is not a valid Project file:\n${parsed.error.message}`);
    process.exit(1);
  }
  const project = parsed.data;
  const photoDir = values.photos ?? join(dirname(postPath), 'photos');

  const photoData: Record<string, string> = {};
  for (const [id, meta] of Object.entries(project.photos)) {
    const bytes = await readFirst([join(photoDir, `${id}.${meta.ext}`), join(photoDir, meta.originalName)]);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== id) throw new Error(`${meta.originalName}: SHA-256 is ${hash}, expected ${id}`);
    photoData[id] = bytes.toString('base64');
  }

  const fonts = await Promise.all(
    (['400', '700'] as const).map(async (weight) => ({
      family: 'Inter',
      weight,
      data: (
        await readFile(join(root, `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`))
      ).toString('base64'),
    })),
  );

  const startTime = Date.now();
  const request: HeadlessExportRequest = { post: project.post, photos: project.photos, photoData, fonts, startTime };

  const browser = await chromium.launch({ headless: true });
  let result: HeadlessExportResult;
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error(e));
    await page.addScriptTag({ content: await bundleEntry() });
    result = await page.evaluate(
      (req) =>
        (globalThis as unknown as { picturesqueExport: (r: HeadlessExportRequest) => Promise<HeadlessExportResult> })
          .picturesqueExport(req),
      request,
    );
  } finally {
    await browser.close();
  }

  const names = exportFileNames(project.name, project.post.type, slideCountOf(project.post.layout), new Date(startTime));
  // A Carousel gets its own subfolder (EXP-08); a Collage goes straight in.
  const target = project.post.type === 'collage' ? outDir : join(outDir, names[0]!.replace(/-01\.jpg$/, ''));
  const written = await writeExportFiles(
    target,
    result.slides.map((s) => ({ name: names[s.index]!, bytes: Buffer.from(s.data, 'base64'), mtime: s.time })),
  );
  for (const [i, path] of written.entries()) {
    const note = result.slides[i]!.reencoded ? ' (re-encoded at quality 90 to stay under 8 MB)' : '';
    console.log(`wrote ${path}${note}`);
  }
}

async function readFirst(paths: string[]): Promise<Buffer> {
  for (const p of paths) {
    try {
      return await readFile(p);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
  throw new Error(`photo not found; tried ${paths.join(', ')}`);
}

/** Bundle src/headless/entry.ts into one script for the page. */
async function bundleEntry(): Promise<string> {
  const output = await build({
    configFile: false,
    root,
    logLevel: 'warn',
    build: {
      write: false,
      minify: false,
      lib: { entry: join(root, 'src/headless/entry.ts'), formats: ['iife'], name: 'PicturesqueHeadless' },
    },
  });
  const outputs = Array.isArray(output) ? output : [output];
  for (const o of outputs) {
    if ('output' in o) {
      const chunk = o.output.find((c) => c.type === 'chunk');
      if (chunk && chunk.type === 'chunk') return chunk.code;
    }
  }
  throw new Error('bundling the headless entry produced no code');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
