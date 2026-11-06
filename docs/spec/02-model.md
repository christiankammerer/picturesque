# 02 · Post model

The data shapes are in [schema.ts](schema.ts). This file gives the rules they must obey and how editing changes them. Why a split tree: [ADR 0002](../adr/0002-split-tree-layouts.md).

## Post types and Slides

**MOD-01** A Post is a **Collage** (one image), a **Carousel** or a **Seamless Carousel**. A **Story** is a Collage whose Aspect Ratio is 9:16, not a separate type.
*Check:* the schema rejects `type: 'story'`; a Story is saved as `type: 'collage'` with `aspectRatio: '9:16'`.

**MOD-02** A Carousel or Seamless Carousel has **2 to 20 Slides**. A new one starts with **3**.
*Check:* the Slide count can't go below 2 or above 20 through any action; a new Carousel has 3 Slides.

**MOD-03** The Post type is fixed when the Post is created. The only type change allowed is **Carousel ↔ Seamless Carousel** (MOD-15, MOD-16).
*Check:* the top bar offers no Collage ↔ Carousel switch; Carousel ↔ Seamless is offered.

## Aspect Ratios

**MOD-04** Feed Aspect Ratios are **1:1, 4:5 and 3:4**, for every Post type. **9:16** is allowed only for a Collage, which makes it a Story. Wider-than-square ratios don't exist.
*Check:* the ratio selector for a Carousel offers 1:1, 4:5, 3:4; for a Collage it adds 9:16, labelled "Story".

**MOD-05** A new Post defaults to **4:5**; "New Story" defaults to 9:16.
*Check:* New Collage and New Carousel start at 4:5; New Story at 9:16.

**MOD-06** Every Slide of a Post shares the Post's one Aspect Ratio.
*Check:* the schema has one `aspectRatio` per Post, and the renderer uses it for every Slide.

**MOD-07** Changing the Aspect Ratio keeps the Layout unchanged in Slide units, so it stretches proportionally. Each photo keeps its `zoom` and focus point and re-covers its Cell. Text Box positions, widths and sizes are unchanged in Slide units.
*Check:* changing a Grid 2×2 Collage from 4:5 to 1:1 leaves `layout`, `textBoxes` and every `framing` byte-identical in the model, and every Cell is still fully covered.

## The canvas and the split tree

**MOD-08** Every Post has **one canvas**, `slideCount` Slide widths wide and one Slide height tall, measured in Slide units (`x` 0..slideCount, `y` 0..1).
*Check:* a 5-Slide Seamless Carousel's canvas spans x = 0..5.

**MOD-09** The Layout's geometry is a **split tree**. A split divides its area into a row (left to right) or a column (top to bottom), with one size per child. The sizes are fractions summing to 1. Each leaf is a **Cell** (at most one photo) or a **Spacer** (empty; shows the background). The tree always fills its area exactly, so photos never overlap.
*Check:* property test: for random valid trees, the leaf rectangles tile the canvas with no overlap and no hole.

**MOD-10** **Slide-edge rule.**
- In a **Carousel**, each Slide has its own subtree (`layout.slides[i]` covers x = i..i+1). No Element crosses a Slide edge, and Slide edges can't be dragged.
- In a **Seamless Carousel**, one tree (`layout.root`) covers the whole canvas. Slide edges are cut lines over it, and Elements may cross them.

*Check:* in a Carousel no divider at a Slide edge is draggable; in a Seamless Carousel a Cell spanning x = 0.5..1.5 is valid and renders across the edge.

**MOD-11** A split has at least 2 children. A split with one child left is replaced by that child.
*Check:* merging the two Cells of a two-child split leaves one Cell in its place, not a split with one child.

**MOD-12** Every leaf's rectangle is at least **0.05 Slide units** wide and **0.05 Slide units** tall. Divider drags stop at that limit.
*Check:* dragging a divider past the limit stops it there.

**MOD-13** Cell ids are unique within a Post and stable across edits, except that a merge keeps the id of the Cell the user started from.
*Check:* after splitting a Cell, the original keeps its id and the new Cell gets a fresh one.

## Editing the Layout (adjust only)

The user adjusts a Layout; they never draw one from scratch. These are the only Layout edits.

**MOD-14** The allowed edits are:
- **Drag a divider** between two neighbouring children of a split. Their sizes change and their sum stays the same.
- **Split a Cell** into two halves, as a row or a column. The original Cell keeps its photo and framing and becomes the first half; the second half is a new, empty Cell. If the Cell's parent split has the same direction, the halves are inserted into the parent; otherwise the Cell becomes a new two-child split.
- **Merge a Cell** with an adjacent sibling Leaf (the same parent split, next to it). The merged Cell takes both sizes and keeps the starting Cell's photo. The sibling's photo, if any, goes back to unplaced. Merging into a Spacer works the same way.
- **Turn a Cell into a Spacer** or a Spacer into an empty Cell. A photo removed this way goes back to unplaced.

Free moving, adding or deleting of Cells, overlapping Cells and per-Cell styling don't exist.
*Check:* unit tests for each operation, including split and merge in both directions and merge with a Spacer; the editor exposes no other Layout operation.

**MOD-15** **Carousel → Seamless** is lossless. The new root is a row split of the old Slide subtrees, each with size 1/slideCount. Photos, framing and Text Boxes are untouched.
*Check:* converting a 4-Slide Carousel to Seamless renders pixel-identically.

**MOD-16** **Seamless → Carousel** re-applies a Template and keeps the photos:
- It applies the built-in Carousel Template **"One per Slide"**, since Seamless Templates have no Carousel form. The user can pick another Carousel Template afterwards.
- It keeps the Slide count.
- The placed photos are re-placed by the Template-switch rule (AUT-08).

*Check:* converting a Seamless "Bridges" Post with 7 placed photos to Carousel gives a Carousel with the same Slide count and the 7 photos placed in their previous order.

## Adding and removing Slides

**MOD-17** **Adding a Slide** (always at the end).
- **Layout unchanged:** if the Layout still equals the source built-in Template's pattern for the current count (structural equality, ignoring photos), the pattern is regenerated for count + 1. Placed photos keep their Cells by Cell order.
- **Layout adjusted, or the source is a saved Template or none:**
  - In a Carousel, a new Slide is appended: the built-in pattern's next Slide, or a single Cell if there is no built-in source.
  - In a Seamless Carousel, a single full-height Cell spanning x = n..n+1 is appended. If the root is a row split it becomes the root's new last child; otherwise the root is wrapped in a new row split. Sizes are rescaled so existing geometry is unchanged in Slide units.
  - Existing Slides are untouched either way.

*Check:* on an adjusted 3-Slide Seamless Post, adding a Slide leaves every existing leaf rectangle unchanged and adds one empty Cell at x = 3..4.

**MOD-18** **Removing a Slide.**
- **Carousel:** any Slide can be removed, and Slides can be reordered. A removed Slide's photos go back to unplaced, and its Text Boxes are deleted.
- **Seamless Carousel:** only the **last** Slide can be removed, and Slides can't be reordered. The tree is cut at x = n−1:
  - Row-split children lying entirely beyond the cut are removed.
  - A child crossing the cut is shortened to end at it, and sizes are renormalised.
  - Column splits are cut recursively.
  - A leaf left below the minimum size (MOD-12) is merged into its neighbour.
  - Photos of removed Cells go back to unplaced.
  - Text Boxes starting beyond the cut move back onto the new last Slide.

*Check:* removing Slide 4 of a 4-Slide Seamless Panorama + strip leaves a 3-Slide Layout with the panorama Cell spanning x = 0..3.

## Styling

**MOD-19** Styling is **Layout-wide only**: gap, corner radius, border width, border colour and background colour. There are no per-Cell overrides, and no background gradient or image (a full-canvas Cell behind other Cells isn't possible either, since Cells never overlap).
*Check:* the inspector has no per-Cell style controls.

**MOD-20** Style lengths (gap, corner radius, border width) are fractions of the Slide **width**, so the look is identical at every export scale and Aspect Ratio. Ranges: gap 0–0.15, corner radius 0–0.15, border width 0–0.05.
*Check:* rendering at scales 540 and 1080 gives the same picture after downscaling the 1080 render (golden test with tolerance).

## Text Boxes

**MOD-21** Text Boxes are not part of the split tree. They are placed freely in canvas coordinates, drawn above all Cells, and may cross Slide edges in a Seamless Carousel.
*Check:* a Text Box at x = 0.8, width 0.5 in a Seamless Post renders across the Slide 1/2 edge; in a Carousel, its part beyond the edge is clipped to the Slide it starts on (Carousel Text Boxes can't be dragged across an edge).

**MOD-22** A Text Box's styling is: font (bundled set or system font), size, weight, colour, alignment, and one optional background box (colour with opacity, plus padding). There are no shadows or outlines.
*Check:* the Text Box inspector exposes exactly these controls.

**MOD-23** Bundled fonts: a curated set of OFL or Apache-2.0 families, initially **Inter** (the default and fallback), **Playfair Display**, **DM Serif Display**, **Montserrat**, **Lora**, **Bebas Neue** and **Caveat**, each with the weights it provides. System fonts are listed after the bundled ones using the Local Font Access API (Electron grants the permission).
*Check:* the font menu lists the seven bundled families first; on a machine with system fonts, those follow.
