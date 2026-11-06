// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { wrapText } from '../../src/shared/render/text.ts';

// A monospace measure: every character is 1 unit wide.
const mono = (s: string) => s.length;

describe('RND-09 wrapping', () => {
  it('breaks on spaces at the box width', () => {
    expect(wrapText('the quick brown fox', 10, mono)).toEqual(['the quick', 'brown fox']);
  });
  it('breaks on \\n', () => {
    expect(wrapText('a\nb c', 10, mono)).toEqual(['a', 'b c']);
  });
  it('keeps empty lines', () => {
    expect(wrapText('a\n\nb', 10, mono)).toEqual(['a', '', 'b']);
  });
  it('breaks a word longer than the width anywhere', () => {
    expect(wrapText('ab supercalifragilistic cd', 6, mono)).toEqual(['ab', 'superc', 'alifra', 'gilist', 'ic cd']);
  });
  it('never splits a surrogate pair', () => {
    expect(wrapText('😀😀😀', 4, mono)).toEqual(['😀😀', '😀']);
  });
  it('always makes progress, even when one character is wider than the box', () => {
    expect(wrapText('abc', 0.5, mono)).toEqual(['a', 'b', 'c']);
  });
});
