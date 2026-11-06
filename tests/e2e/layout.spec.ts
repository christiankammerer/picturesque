// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect, photo, project, root, test } from './app.ts';

type Node = { kind: 'cell' | 'spacer' | 'split'; id?: string; sizes?: number[]; children?: Node[]; photo?: { photoId: string; framing: Record<string, number> } };

const layoutRoot = async (page: Page) => ((await project(page)).post.layout as { root: Node }).root;
const style = async (page: Page) => (await project(page)).post as unknown as { style: Record<string, number | string>; sourceTemplate?: { id: string } };

async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function applyTemplate(page: Page, id: string) {
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.locator(`[data-template-id="${id}"]`).click();
}

test.beforeEach(async ({ page }) => {
  await page.getByRole('button', { name: /New Collage/ }).click();
});

test('EDT-24: applying a Template from the tab', async ({ page }) => {
  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(page.getByTestId('template')).toHaveCount(8);
  await applyTemplate(page, 'collage-grid-2x2');
  await expect(page.getByTestId('cell')).toHaveCount(4);
  expect((await style(page)).sourceTemplate?.id).toBe('collage-grid-2x2');
  await expect(page.locator('[data-template-id="collage-grid-2x2"]')).toHaveClass(/current/);
});

test('AUT-08: switching a 4-photo Grid 2×2 to Side by side keeps photos 1–2', async ({ page }) => {
  // All four are landscape, so orientation matching (AUT-03) keeps them in order.
  // With mixed shapes it would prefer portrait photos for the portrait Cells.
  await page.getByTestId('photo-input').setInputFiles(['landscape.heic', 'rotated.heic', 'display-p3.heic', 'oriented.webp'].map(photo));
  await expect(page.locator('[data-testid="photo"] img')).toHaveCount(4);
  await applyTemplate(page, 'collage-grid-2x2');
  await page.getByRole('tab', { name: 'Photos' }).click();
  for (let i = 0; i < 4; i++) await drag(page, page.getByTestId('photo').nth(i), page.getByTestId('cell').nth(i));
  const placed = await page.getByTestId('cell').evaluateAll((els) => els.map((e) => e.getAttribute('data-photo-id')));
  await applyTemplate(page, 'collage-side-by-side');
  await expect(page.getByTestId('cell')).toHaveCount(2);
  const after = await page.getByTestId('cell').evaluateAll((els) => els.map((e) => e.getAttribute('data-photo-id')));
  expect(after).toEqual(placed.slice(0, 2));
});

test('EDT-16 / MOD-14: split, merge with only valid sides, Spacer and back', async ({ page }) => {
  await applyTemplate(page, 'collage-side-by-side');
  await page.getByTestId('cell').first().click();
  const inspector = page.getByTestId('cell-inspector');
  // The left Cell can only merge to the right.
  await expect(inspector.getByRole('group', { name: 'Merge with' }).getByRole('button')).toHaveText(['Right']);

  await inspector.getByRole('button', { name: 'Split top and bottom' }).click();
  await expect(page.getByTestId('cell')).toHaveCount(3);
  await page.getByTestId('cell').first().click();
  await expect(inspector.getByRole('group', { name: 'Merge with' }).getByRole('button')).toHaveText(['Below']);
  await inspector.getByRole('button', { name: 'Below' }).click();
  await expect(page.getByTestId('cell')).toHaveCount(2);
  // MOD-11: no one-child split is left behind.
  expect((await layoutRoot(page)).children!.map((c) => c.kind)).toEqual(['cell', 'cell']);

  await page.getByTestId('cell').first().click();
  await inspector.getByRole('button', { name: 'Make Spacer' }).click();
  await expect(page.getByTestId('cell')).toHaveCount(1);
  await page.getByTestId('spacer').first().click();
  await page.getByRole('button', { name: 'Make Cell' }).click();
  await expect(page.getByTestId('cell')).toHaveCount(2);
});

test('EDT-16 / MOD-12: dragging a divider resizes, and stops at the minimum size', async ({ page }) => {
  await applyTemplate(page, 'collage-side-by-side');
  const divider = page.getByTestId('divider');
  await expect(divider).toHaveCount(1);
  const d = (await divider.boundingBox())!;
  const canvas = (await page.locator('.canvas-stage').boundingBox())!;
  await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * 0.3, d.y + d.height / 2, { steps: 6 });
  await page.mouse.up();
  let sizes = (await layoutRoot(page)).sizes!;
  expect(sizes[0]).toBeCloseTo(0.3, 1);
  // Far past the edge: stops at 0.05.
  const d2 = (await divider.boundingBox())!;
  await page.mouse.move(d2.x + d2.width / 2, d2.y + d2.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x - 200, d2.y + d2.height / 2, { steps: 6 });
  await page.mouse.up();
  sizes = (await layoutRoot(page)).sizes!;
  expect(sizes[0]).toBeCloseTo(0.05, 6);
});

test('EDT-17 / TPL-10: a Preset, then a tweak, keeps the other values', async ({ page }) => {
  await page.getByTestId('preset-soft').click();
  await expect(page.getByTestId('preset-soft')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('style-gap').fill('0.05');
  const s = (await style(page)).style;
  expect(s).toEqual({ gap: 0.05, cornerRadius: 0.03, borderWidth: 0, borderColor: '#000000', background: '#f4efe6' });
  await expect(page.getByTestId('preset-soft')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('style-background').fill('#223344');
  expect((await style(page)).style.background).toBe('#223344');
});

test('M2 demo: a Grid 2×2 Collage from four HEIC photos, framed, restyled and exported', async ({ page, exportDir }, testInfo) => {
  await page.getByTestId('photo-input').setInputFiles(['landscape.heic', 'portrait.heic', 'rotated.heic', 'display-p3.heic'].map(photo));
  await expect(page.locator('[data-testid="photo"] img')).toHaveCount(4);
  await applyTemplate(page, 'collage-grid-2x2');
  await page.getByRole('tab', { name: 'Photos' }).click();
  for (let i = 0; i < 4; i++) await drag(page, page.getByTestId('photo').nth(i), page.getByTestId('cell').nth(i));
  await expect(page.locator('[data-testid="cell"][data-photo-id=""]')).toHaveCount(0);

  // Frame: zoom into one, straighten another.
  await page.getByTestId('cell').nth(0).click();
  await page.getByTestId('zoom').fill('1.8');
  await page.getByTestId('cell').nth(1).click();
  await page.getByTestId('straighten').fill('-6');

  // Restyle.
  await page.getByTestId('preset-soft').click();
  await page.getByTestId('style-cornerRadius').fill('0.05');

  mkdirSync(join(root, 'tests/e2e/__demo__'), { recursive: true });
  await page.screenshot({ path: join(root, 'tests/e2e/__demo__/m2-demo-editor.png') });
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByTestId('notice').filter({ hasText: '1 image exported' })).toBeVisible({ timeout: 30_000 });
  const files = readdirSync(exportDir);
  expect(files).toHaveLength(1);
  expect(statSync(join(exportDir, files[0]!)).size).toBeGreaterThan(10_000);
  const exported = join(exportDir, files[0]!);
  // Keep a copy of the exported image next to the editor screenshot.
  writeFileSync(join(root, 'tests/e2e/__demo__/m2-demo-export.jpg'), readFileSync(exported));
  await testInfo.attach('export', { path: exported, contentType: 'image/jpeg' });
});
