// SPDX-License-Identifier: GPL-3.0-or-later
//
// RND-09 line wrapping, independent of any canvas so it can be unit-tested.

/** RND-09: line height as a multiple of the font size. */
export const LINE_HEIGHT = 1.2;

/**
 * Wrap text to a width. Lines break on '\n' and on spaces; a word longer than
 * the width breaks anywhere (between characters). `measure` returns a
 * string's advance width in the same unit as `width`.
 */
export function wrapText(text: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (measure(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line !== '') lines.push(line);
      // The word doesn't fit after the current line; start it on a new line,
      // breaking it into pieces if it is wider than the whole box.
      let rest = word;
      // The last piece stays on the current line, even if a single character
      // is wider than the box.
      while (measure(rest) > width && Array.from(rest).length > 1) {
        const cut = longestFittingPrefix(rest, width, measure);
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

/** Length (in UTF-16 units, never splitting a surrogate pair) of the longest
 *  prefix of `s` that fits in `width`; at least one character. */
function longestFittingPrefix(s: string, width: number, measure: (s: string) => number): number {
  const chars = Array.from(s);
  let lo = 1;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(chars.slice(0, mid).join('')) <= width) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join('').length;
}
