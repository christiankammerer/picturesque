# 03 · Renderer

One pure function draws a Post, for the editor preview, the filmstrip, the Template thumbnails, "Preview as post" and export alike. The preview is the export by construction ([ADR 0001](../adr/0001-electron-single-renderer.md)).

## Contract

```ts
interface RenderOptions {
  /** Pixels per Slide width. Export uses 1080. */
  scale: number;
  /** Which Slides to draw, inclusive. Default: all. Pixels outside are left untouched. */
  slides?: { from: number; to: number };
  /** Draw an empty Cell as a placeholder (editor) or as background (export). */
  emptyCells: 'placeholder' | 'background';
}

/** Source bitmaps, by photoId. The caller chooses the tier (preview copy or
 *  export decode); the renderer never decodes or fetches anything. */
type PhotoSource = (photoId: string) => ImageBitmap | undefined;

function render(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  post: Post,
  photos: PhotoSource,
  options: RenderOptions,
): void;
```

**RND-01** `render` is pure: its output depends only on its arguments. It has no I/O, no randomness, no clock, no DOM access beyond the context, and it doesn't keep state between calls.
*Check:* rendering the same inputs twice gives byte-identical pixels.

**RND-02** It is the **only** code that draws Post content. The editor, filmstrip, Template thumbnails, phone preview and export all call it. Interaction graphics (selection outlines, divider handles, Slide-edge lines, the Grid Crop overlay, snapping guides) are drawn by a separate overlay layer **above** it and never by `render`.
*Check:* code search finds no other `drawImage` of photo bitmaps outside the renderer; golden tests compare editor and export renders of the same Post.

## Coordinates

**RND-03** With `s = scale` and `h = RATIO_HEIGHT[aspectRatio]`:
- the canvas is `slideCount × s` px wide and `round(s × h)` px tall;
- a point (x, y) in Slide units maps to (x × s, y × s × h) px;
- style lengths (gap, radius, border width, Text Box size, padding) map to (value × s) px on **both** axes.

*Check:* a 4:5 Post at scale 1080 is 1350 px tall per Slide; a gap of 0.01 is 10.8 px both horizontally and vertically.

**RND-04** At scale 1080 every Slide edge falls on an exact integer pixel column (`i × 1080`), so slicing never splits a pixel.
*Check:* covered by the export golden tests (EXP-03).

## Drawing order

**RND-05** `render` draws, in order:
1. **Background:** fill the drawn Slides with `style.background`.
2. **Leaves**, in tree order (depth-first, children in order):
   - A **Cell with a photo:** clip to the Cell's inner rectangle (RND-06) with `cornerRadius`; draw the photo (RND-07); then draw the border.
   - An **empty Cell:** with `emptyCells: 'placeholder'`, a neutral fill with a "+" icon, plus the border; with `'background'`, nothing.
   - A **Spacer:** nothing.
3. **Text Boxes**, in array order: the background box (if set), then the text.

*Check:* golden tests for each step, including an empty Cell in both modes and an overlapping Text Box above a photo.

## Geometry details

**RND-06** **Gap and inner rectangles.** Each leaf's tree rectangle is inset by `gap / 2` on every side. Additionally, the outer margin is topped up to a full `gap`:
- For a **Collage**, around the canvas.
- For a **Carousel**, around **each Slide**, so every Slide looks framed on its own.
- For a **Seamless Carousel**, around the whole canvas only. Slide edges get no extra margin, because they are just cut lines.

The result is the Cell's **inner rectangle**. The background shows through gaps and Spacers.
*Check:* Grid 2×2 Collage with gap 0.02 at scale 1000 (1:1): the first Cell's inner rectangle is x 20..490, y 20..490 px.

**RND-07** **Photo placement.**
- **Orientation:** the photo is drawn with EXIF orientation applied (done at decode), then rotated by `rotate90 + straighten` degrees about its centre.
- **Size:** at `zoom = 1` the rotated photo is scaled to the smallest size that fully **covers** the inner rectangle, accounting for the rotation. At `zoom > 1` it is scaled further by `zoom`.
- **Position:** the photo point (`focusX`, `focusY`), in the rotated photo's own 0..1 coordinates, is placed at the rectangle's centre. It is clamped so that the rectangle is always fully covered: no gap may ever show inside a Cell with a photo.
- **Quality:** drawing uses `imageSmoothingQuality = 'high'`.

*Check:* property test: for random framing and rectangles, sampling the rectangle's corners always hits the photo. Golden test of a 7° straighten.

**RND-08** **Border:** a stroke of `borderWidth` drawn **inside** the inner rectangle's edge, following the corner radius. A border width of 0 draws nothing.
*Check:* golden test of the "Black frame" preset.

**RND-09** **Text** uses Canvas 2D text with the Text Box's font, weight, size (× s px), colour and alignment.
- Lines wrap at the box width, breaking on spaces and on `\n`; a word longer than the width breaks anywhere.
- The line height is 1.2 × size.
- The background box, if set, fills the text block's bounding box plus `padding` on every side, at the given opacity, with the Layout's corner radius.
- A font that isn't available falls back to Inter (PRJ-12).

*Check:* golden tests at two scales; wrapping test with a long word.

**RND-10** In a **Carousel**, Elements are clipped to their Slide. In a **Seamless Carousel** nothing is clipped at Slide edges.
*Check:* golden tests of both, with a Text Box near an edge.

## Fonts and determinism

**RND-11** Before `render` runs, the caller makes sure every font used by the Post has loaded (`document.fonts.load`). Rendering never waits for fonts.
*Check:* exporting right after opening a Project with a bundled display font shows that font, not a fallback.
