// SPDX-License-Identifier: GPL-3.0-or-later
// Launching the built app for end-to-end tests, with a throwaway profile and export folder.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

export const root = resolve(import.meta.dirname, '../..');
export const photo = (name: string) => join(root, 'tests/fixtures/photos', name);

interface AppFixtures {
  app: ElectronApplication;
  page: Page;
  exportDir: string;
}

export const test = base.extend<AppFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures take their dependencies by destructuring
  exportDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'picturesque-e2e-export-'));
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
  app: async ({ exportDir }, use) => {
    const profile = mkdtempSync(join(tmpdir(), 'picturesque-e2e-profile-'));
    const app = await electron.launch({
      args: [join(root, 'out/main/index.js')],
      env: { ...process.env, PICTURESQUE_TEST_USER_DATA: profile, PICTURESQUE_TEST_EXPORT_DIR: exportDir, ELECTRON_RENDERER_URL: '' },
    });
    await use(app);
    await app.close();
    rmSync(profile, { recursive: true, force: true });
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect } from '@playwright/test';

/** The editor's Project, read through the test hook. */
export async function project(page: Page) {
  return page.evaluate(() => (window as unknown as { __picturesque: { project(): unknown } }).__picturesque.project()) as Promise<{
    name: string | null;
    post: { aspectRatio: string; layout: unknown };
    photos: Record<string, { originalName: string; width: number; height: number }>;
    panelOrder: string[];
  }>;
}
