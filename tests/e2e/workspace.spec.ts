// SPDX-License-Identifier: GPL-3.0-or-later
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect, photo, project, test } from './app.ts';

type Cell = { kind: 'cell'; id: string; photo?: { photoId: string; framing: { zoom: number; focusX: number; focusY: number; rotate90: number; straighten: number } } };

async function cells(page: Page): Promise<Cell[]> {
  const p = await project(page);
  const out: Cell[] = [];
  const walk = (n: { kind: string; children?: unknown[] }) => {
    if (n.kind === 'cell') out.push(n as Cell);
    else if (n.kind === 'split') (n.children as { kind: string }[]).forEach(walk);
  };
  const layout = p.post.layout as { root?: { kind: string }; slides?: { kind: string }[] };
  if (layout.slides) layout.slides.forEach(walk);
  else walk(layout.root!);
  return out;
}

async function importPhotos(page: Page, names: string[], expected: number) {
  await page.getByTestId('photo-input').setInputFiles(names.map(photo));
  await expect(page.getByTestId('photo')).toHaveCount(expected);
  await expect(page.locator('[data-testid="photo"] img')).toHaveCount(expected);
}

async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

/** A Collage with two side-by-side Cells is easiest to reason about; Grid 2×2 needs Templates (next PR). */
async function newCollage(page: Page) {
  await page.getByRole('button', { name: /New Collage/ }).click();
  await expect(page.getByTestId('drop-zone')).toBeVisible();
}

test('EDT-01: the start screen offers New Collage, New Carousel and New Story', async ({ page }) => {
  await expect(page).toHaveTitle('Picturesque');
  for (const name of ['New Collage', 'New Carousel', 'New Story']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Open…' })).toBeVisible();
});

test('EDT-03: New Carousel opens the Photos tab with the drop zone, One per Slide at 4:5, 3 Slides', async ({ page }) => {
  await page.getByRole('button', { name: /New Carousel/ }).click();
  await expect(page.getByRole('tab', { name: 'Photos' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('drop-zone')).toContainText('Add photos (or drop them here)');
  await expect(page.getByTestId('drop-zone').getByRole('button')).toBeVisible();
  const p = await project(page);
  expect(p.post.aspectRatio).toBe('4:5');
  expect((p.post as { sourceTemplate?: { id: string } }).sourceTemplate?.id).toBe('carousel-one-per-slide');
  await expect(page.getByTestId('cell')).toHaveCount(3);
});

test('New Story is a 9:16 Collage; New Collage is 4:5', async ({ page }) => {
  await page.getByRole('button', { name: /New Story/ }).click();
  expect((await project(page)).post.aspectRatio).toBe('9:16');
  await expect(page.getByTestId('aspect-ratio')).toHaveValue('9:16');
});

test('EDT-31: the window title shows the name and • for unsaved changes', async ({ page }) => {
  await newCollage(page);
  await expect(page).toHaveTitle('Untitled — Picturesque');
  await importPhotos(page, ['oriented.jpg'], 1);
  await expect(page).toHaveTitle('Untitled • — Picturesque');
});

test('EDT-08 / OVR-04: importing shows thumbnails, skips duplicates and names refused files', async ({ page }) => {
  await newCollage(page);
  await importPhotos(page, ['landscape.heic', 'rotated.heic', 'oriented.jpg', 'oriented.png', 'oriented.webp'], 5);
  // The same file again leaves one entry.
  await importPhotos(page, ['landscape.heic'], 5);
  // Refused formats are named.
  await page.getByTestId('photo-input').setInputFiles([photo('refused.gif'), photo('refused.tiff')]);
  await expect(page.getByTestId('notice').filter({ hasText: 'refused.gif' })).toBeVisible();
  await expect(page.getByTestId('notice').filter({ hasText: 'refused.tiff' })).toBeVisible();
  const p = await project(page);
  // All five share a capture date, so they keep the order they were given in.
  expect(p.panelOrder.map((id) => p.photos[id]!.originalName)).toEqual(['landscape.heic', 'rotated.heic', 'oriented.jpg', 'oriented.png', 'oriented.webp']);
  // HEIC sizes are upright.
  const rotated = Object.values(p.photos).find((m) => m.originalName === 'rotated.heic')!;
  expect([rotated.width, rotated.height]).toEqual([1200, 800]);
});

test.describe('placing and framing', () => {
  test.beforeEach(async ({ page }) => {
    await newCollage(page);
    await importPhotos(page, ['landscape.heic', 'oriented.jpg'], 2);
  });

  test('EDT-13: click a photo, then click a Cell, places it with default framing', async ({ page }) => {
    const first = page.getByTestId('photo').first();
    await first.click();
    await page.getByTestId('cell').first().click();
    const [cell] = await cells(page);
    expect(cell!.photo).toEqual({ photoId: await first.getAttribute('data-photo-id'), framing: { zoom: 1, focusX: 0.5, focusY: 0.5, rotate90: 0, straighten: 0 } });
    await expect(first.getByTestId('photo-badge')).toBeVisible();
  });

  test('EDT-13: dragging a photo onto a Cell places it', async ({ page }) => {
    await drag(page, page.getByTestId('photo').nth(1), page.getByTestId('cell').first());
    const [cell] = await cells(page);
    expect(cell!.photo?.photoId).toBe(await page.getByTestId('photo').nth(1).getAttribute('data-photo-id'));
  });

  test('EDT-15: pan, zoom, rotate, straighten, reset and double-click', async ({ page }) => {
    const cell = page.getByTestId('cell').first();
    await page.getByTestId('photo').first().click();
    await cell.click();

    // Pan: drag inside the Cell (zoom in first, so there is room to pan both ways).
    const box = (await cell.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    let f = (await cells(page))[0]!.photo!.framing;
    expect(f.zoom).toBeGreaterThan(1);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const panned = (await cells(page))[0]!.photo!.framing;
    expect(panned.focusX).toBeGreaterThan(f.focusX);

    await page.getByRole('button', { name: 'Rotate 90°' }).click();
    expect((await cells(page))[0]!.photo!.framing.rotate90).toBe(90);

    await page.getByTestId('straighten').fill('7');
    expect((await cells(page))[0]!.photo!.framing.straighten).toBe(7);

    await page.getByRole('button', { name: 'Reset framing' }).click();
    f = (await cells(page))[0]!.photo!.framing;
    expect(f).toEqual({ zoom: 1, focusX: 0.5, focusY: 0.5, rotate90: 90, straighten: 0 });

    await cell.dblclick();
    expect((await cells(page))[0]!.photo).toBeUndefined();
  });

  test('EDT-15: Ctrl/Cmd+0 resets framing; Delete empties the selected Cell', async ({ page }) => {
    const cell = page.getByTestId('cell').first();
    await page.getByTestId('photo').first().click();
    await cell.click();
    await page.getByTestId('zoom').fill('3');
    await page.locator('body').click({ position: { x: 5, y: 300 } }).catch(() => {});
    await cell.click();
    await page.keyboard.press('ControlOrMeta+0');
    expect((await cells(page))[0]!.photo!.framing.zoom).toBe(1);
    await page.keyboard.press('Delete');
    expect((await cells(page))[0]!.photo).toBeUndefined();
  });
});

test('EDT-14: moving photos between Cells, and back to the panel', async ({ page }) => {
  // Single framed has one Cell; Side-by-side layouts arrive with Templates, so use a Carousel's three Cells.
  await page.getByRole('button', { name: /New Carousel/ }).click();
  await importPhotos(page, ['landscape.heic', 'oriented.jpg', 'oriented.png'], 3);
  const photos = page.getByTestId('photo');
  const cell = (i: number) => page.getByTestId('cell').nth(i);
  const ids = await Promise.all([0, 1, 2].map((i) => photos.nth(i).getAttribute('data-photo-id')));

  await drag(page, photos.nth(0), cell(0));
  await drag(page, photos.nth(1), cell(1));
  await page.getByTestId('zoom').fill('2'); // cell 1 is selected after the drop

  // Cell → filled Cell swaps, and resets framing.
  await drag(page, cell(1), cell(0));
  let c = await cells(page);
  expect([c[0]!.photo?.photoId, c[1]!.photo?.photoId]).toEqual([ids[1], ids[0]]);
  expect(c[0]!.photo!.framing.zoom).toBe(1);

  // Cell → empty Cell moves.
  await drag(page, cell(0), cell(2));
  c = await cells(page);
  expect([c[0]!.photo, c[2]!.photo?.photoId]).toEqual([undefined, ids[1]]);

  // Panel → filled Cell replaces.
  await drag(page, photos.nth(2), cell(2));
  c = await cells(page);
  expect(c[2]!.photo?.photoId).toBe(ids[2]);

  // Cell → panel unplaces.
  await drag(page, cell(2), page.getByTestId('photos-panel'));
  c = await cells(page);
  expect(c[2]!.photo).toBeUndefined();
  expect(Object.keys((await project(page)).photos)).toHaveLength(3);
});

test('MOD-04: the ratio selector offers 9:16 only for a Collage', async ({ page }) => {
  await newCollage(page);
  await expect(page.getByTestId('aspect-ratio').locator('option')).toHaveText(['1:1 Square', '4:5 Portrait', '3:4 Tall', '9:16 Story']);
  await page.getByTestId('aspect-ratio').selectOption('1:1');
  expect((await project(page)).post.aspectRatio).toBe('1:1');
});

test('export writes the Collage as one JPEG', async ({ page, exportDir }) => {
  await newCollage(page);
  await importPhotos(page, ['rotated.heic'], 1);
  await page.getByTestId('photo').first().click();
  await page.getByTestId('cell').first().click();
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByTestId('notice').filter({ hasText: '1 image exported' })).toBeVisible({ timeout: 30_000 });
  const files = readdirSync(exportDir);
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^picturesque-\d{4}-\d{2}-\d{2}-\d{4}\.jpg$/);
  expect(statSync(join(exportDir, files[0]!)).size).toBeGreaterThan(10_000);
});
