// SPDX-License-Identifier: GPL-3.0-or-later
//
// The renderer is served from app://picturesque/ rather than file://, so
// module workers and fetch() of bundled files (libheif.wasm) work the same
// as in a browser, with a real origin.

import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { protocol } from 'electron';

export const APP_SCHEME = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://picturesque`;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
  ]);
}

/** Serve `root` (the built renderer) under app://picturesque/. */
export function serveRenderer(root: string): void {
  const base = normalize(root + sep);
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const path = normalize(join(base, decodeURIComponent(url.pathname)));
    if (url.host !== 'picturesque' || !path.startsWith(base)) return new Response('Not found', { status: 404 });
    try {
      const body = await readFile(path.endsWith(sep) ? join(path, 'index.html') : path);
      return new Response(body, { headers: { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}
