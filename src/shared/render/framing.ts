// SPDX-License-Identifier: GPL-3.0-or-later
//
// RND-07 photo placement, as pure maths so it can be property-tested.

import type { Framing } from '../model/schema.ts';

/** A rectangle in px: top-left corner and size. */
export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A 2D affine transform, in the argument order of `ctx.transform(a, b, c, d, e, f)`:
 *  x' = a·x + c·y + e,  y' = b·x + d·y + f. */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface Placement {
  /** Maps bitmap pixel coordinates (0..bitmapW, 0..bitmapH) to canvas px. */
  transform: Affine;
  /** Scale from bitmap px to canvas px. */
  scale: number;
  /** Size in canvas px of the drawn photo (before rotation), i.e. the
   *  bitmap size times `scale`, in the photo's own (unrotated) axes. */
  drawnWidth: number;
  drawnHeight: number;
}

const DEG = Math.PI / 180;

/**
 * Where a photo goes inside a Cell's inner rectangle.
 *
 * The photo is first turned by `rotate90` (giving the "rotated photo", W'×H'),
 * then tilted by `straighten` about the rectangle's centre. At zoom 1 it is
 * scaled to the smallest size that covers the rectangle at that tilt; zoom
 * scales it further. The rotated photo's point (focusX, focusY) goes to the
 * rectangle's centre, clamped so the rectangle stays fully covered.
 *
 * Coverage is exact: in the rotated photo's own frame the tilted rectangle's
 * bounding box has half-extents ex, ey, and it lies inside the (axis-aligned)
 * photo exactly when its centre is at least ex, ey from every photo edge.
 */
export function placePhoto(rect: PxRect, bitmapW: number, bitmapH: number, framing: Framing): Placement {
  const g = coverGeometry(rect, bitmapW, bitmapH, framing);
  const cx = clamp(framing.focusX * g.pw, g.ex, g.pw - g.ex);
  const cy = clamp(framing.focusY * g.ph, g.ey, g.ph - g.ey);

  // Compose: canvas = T(rect centre) · R(straighten) · T(-cx, -cy) · Q(quarter) · S(k)
  let m: Affine = translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  m = multiply(m, rotate(g.s));
  m = multiply(m, translate(-cx, -cy));
  m = multiply(m, quarterTurn(framing.rotate90, g.pw, g.ph));
  m = multiply(m, { a: g.k, b: 0, c: 0, d: g.k, e: 0, f: 0 });
  return { transform: m, scale: g.k, drawnWidth: bitmapW * g.k, drawnHeight: bitmapH * g.k };
}

interface CoverGeometry {
  /** Straighten angle, radians. */
  s: number;
  /** Half-extents of the tilted rectangle in the photo's frame, px. */
  ex: number;
  ey: number;
  /** Scale from bitmap px to canvas px. */
  k: number;
  /** Size of the rotated photo, canvas px. */
  pw: number;
  ph: number;
}

function coverGeometry(rect: PxRect, bitmapW: number, bitmapH: number, framing: Framing): CoverGeometry {
  const swap = framing.rotate90 === 90 || framing.rotate90 === 270;
  const rw = swap ? bitmapH : bitmapW; // rotated photo size, bitmap px
  const rh = swap ? bitmapW : bitmapH;
  const s = framing.straighten * DEG;
  const cos = Math.abs(Math.cos(s));
  const sin = Math.abs(Math.sin(s));
  const ex = (rect.w * cos + rect.h * sin) / 2;
  const ey = (rect.w * sin + rect.h * cos) / 2;
  const k = Math.max((2 * ex) / rw, (2 * ey) / rh) * framing.zoom;
  return { s, ex, ey, k, pw: rw * k, ph: rh * k };
}

/** The framing with its focus clamped to what keeps the Cell covered, so the
 *  stored focus matches what is shown (pans never feel stuck). */
export function clampFocus(rect: PxRect, bitmapW: number, bitmapH: number, framing: Framing): Framing {
  const g = coverGeometry(rect, bitmapW, bitmapH, framing);
  return {
    ...framing,
    focusX: clamp(framing.focusX, g.ex / g.pw, 1 - g.ex / g.pw),
    focusY: clamp(framing.focusY, g.ey / g.ph, 1 - g.ey / g.ph),
  };
}

/** EDT-15: pan by a pointer delta (canvas px). The photo follows the pointer. */
export function panFraming(rect: PxRect, bitmapW: number, bitmapH: number, framing: Framing, dx: number, dy: number): Framing {
  const g = coverGeometry(rect, bitmapW, bitmapH, framing);
  const [ux, uy] = unrotate(g.s, dx, dy);
  const start = clampFocus(rect, bitmapW, bitmapH, framing);
  return clampFocus(rect, bitmapW, bitmapH, { ...framing, focusX: start.focusX - ux / g.pw, focusY: start.focusY - uy / g.ph });
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 10;

/** EDT-15: zoom by `factor` around a point (canvas px), keeping the photo point under it in place. */
export function zoomFramingAt(
  rect: PxRect,
  bitmapW: number,
  bitmapH: number,
  framing: Framing,
  factor: number,
  px: number,
  py: number,
): Framing {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, framing.zoom * factor));
  const start = clampFocus(rect, bitmapW, bitmapH, framing);
  const before = coverGeometry(rect, bitmapW, bitmapH, start);
  const after = coverGeometry(rect, bitmapW, bitmapH, { ...start, zoom });
  const [ux, uy] = unrotate(before.s, px - (rect.x + rect.w / 2), py - (rect.y + rect.h / 2));
  return clampFocus(rect, bitmapW, bitmapH, {
    ...start,
    zoom,
    focusX: start.focusX + ux * (1 / before.pw - 1 / after.pw),
    focusY: start.focusY + uy * (1 / before.ph - 1 / after.ph),
  });
}

/** A canvas-space vector in the photo's (straightened) frame. */
function unrotate(s: number, x: number, y: number): [number, number] {
  const c = Math.cos(s);
  const n = Math.sin(s);
  return [c * x + n * y, -n * x + c * y];
}

/** Q: maps the scaled, unrotated photo into the rotated photo's frame [0,pw]×[0,ph]. */
function quarterTurn(quarter: 0 | 90 | 180 | 270, pw: number, ph: number): Affine {
  switch (quarter) {
    case 0: return IDENTITY;
    case 90: return multiply(translate(pw, 0), rotate(Math.PI / 2));
    case 180: return multiply(translate(pw, ph), rotate(Math.PI));
    case 270: return multiply(translate(0, ph), rotate(-Math.PI / 2));
  }
}

function clamp(v: number, lo: number, hi: number): number {
  // lo <= hi always holds for a covering scale; guard against rounding.
  if (hi < lo) return (lo + hi) / 2;
  return Math.min(Math.max(v, lo), hi);
}

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function translate(x: number, y: number): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

function rotate(t: number): Affine {
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Snap the quarter turns so they stay exact.
  const snap = (v: number) => (Math.abs(v) < 1e-15 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-15 ? Math.sign(v) : v);
  return { a: snap(c), b: snap(s), c: -snap(s), d: snap(c), e: 0, f: 0 };
}

/** m · n (apply n first, then m). */
export function multiply(m: Affine, n: Affine): Affine {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export function apply(m: Affine, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

export function invert(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}

/** The size (in px) a photo is drawn at for a Cell, used to pick the decode
 *  size for export (EXP-04): the drawn size of the original-sized photo. */
export function drawnSize(rect: PxRect, photoW: number, photoH: number, framing: Framing): { width: number; height: number } {
  const p = placePhoto(rect, photoW, photoH, framing);
  return { width: p.drawnWidth, height: p.drawnHeight };
}
