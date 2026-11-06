// SPDX-License-Identifier: GPL-3.0-or-later
// End-to-end tests drive the built app (npm run build) with Playwright's Electron support.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never', outputFolder: 'tests/e2e/__report__' }]] : 'list',
  use: { trace: 'retain-on-failure' },
  outputDir: 'tests/e2e/__output__',
});
