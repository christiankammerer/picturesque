// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { exportFileNames, sanitizeFileName, unsavedProjectName } from '../../src/shared/export/naming.ts';

const now = new Date(2026, 10, 6, 9, 5); // local time

describe('EXP-07 naming', () => {
  it('a Collage or Story is <name>.jpg', () => {
    expect(exportFileNames('trip', 'collage', 1, now)).toEqual(['trip.jpg']);
  });
  it('a 3-Slide Carousel named "trip" is trip-01.jpg … trip-03.jpg', () => {
    expect(exportFileNames('trip', 'carousel', 3, now)).toEqual(['trip-01.jpg', 'trip-02.jpg', 'trip-03.jpg']);
  });
  it('always uses two digits, up to 20 Slides', () => {
    const names = exportFileNames('x', 'seamless', 20, now);
    expect(names[0]).toBe('x-01.jpg');
    expect(names[19]).toBe('x-20.jpg');
  });
  it('a Project named a/b exports a-b.jpg', () => {
    expect(exportFileNames('a/b', 'collage', 1, now)).toEqual(['a-b.jpg']);
  });
  it('replaces every character forbidden on any OS, and control characters', () => {
    expect(sanitizeFileName('a\\b/c:d*e?f"g<h>i|j\u0001k\u007fl')).toBe('a-b-c-d-e-f-g-h-i-j-k-l');
  });
  it('an unsaved Project uses picturesque-YYYY-MM-DD-HHMM in local time', () => {
    expect(unsavedProjectName(now)).toBe('picturesque-2026-11-06-0905');
    expect(exportFileNames(null, 'collage', 1, now)).toEqual(['picturesque-2026-11-06-0905.jpg']);
    expect(exportFileNames('  ', 'carousel', 2, now)).toEqual([
      'picturesque-2026-11-06-0905-01.jpg',
      'picturesque-2026-11-06-0905-02.jpg',
    ]);
  });
});
