# 05 · Templates, Style Presets and Auto-fill

## Template rules

**TPL-01** A Template is a Layout, its style and optional placeholder Text Boxes, **without photos**. Templates are CC0 (OVR-09).
*Check:* no built-in Template data references a photo.

**TPL-02** **Built-in Templates are patterns.** Carousel and Seamless Templates generate a Layout for any Slide count from 2 to 20. Collage and Story Templates have one Slide.
*Check:* generating every built-in Carousel and Seamless Template for n = 2..20 produces a valid Layout (MOD-09…MOD-12).

**TPL-03** **Saved Templates** (My Templates) have a fixed Slide count and a preferred Aspect Ratio (TPL-13).
*Check:* applying a saved 4-Slide Template to a 6-Slide Post makes it 4 Slides.

**TPL-04** Every Template is offered at every feed Aspect Ratio and stretches with it (MOD-07). **Story** Templates appear only at 9:16. At 9:16, the Collage Templates are listed too, below the Story ones.
*Check:* the Templates tab at 9:16 lists Story Templates first, then Collage Templates; at 4:5 it lists no Story Templates.

**TPL-05** **Applying a Template copies it into the Post.** Later changes to a saved Template, or a deleted saved Template, never affect a Post. The Post records its source Template only for display (`sourceTemplate`).
- Applying replaces the Layout, the style and the Text Boxes.
- A Text Box the user has edited is kept rather than replaced, if the new Template has none.
- Placed photos are kept (AUT-08).
- Applying a saved Template also applies its Slide count, and its preferred Aspect Ratio if the Post's type allows it.

*Check:* renaming a saved Template doesn't change a Post made from it, apart from the displayed source name staying as it was.

## Notation for the built-in data

The built-in Templates are defined below in a compact notation. It maps one-to-one to `LayoutNode` in [schema.ts](schema.ts).

| Notation | Meaning |
|---|---|
| `P` | an empty Cell |
| `_` | a Spacer |
| `row[a,b,…](X,Y,…)` | a row split with those sizes and children |
| `col[a,b,…](X,Y,…)` | a column split with those sizes and children |
| `row*k(X)` / `col*k(X)` | k equal children, each a copy of X |
| `frame(X, mx, my)` | `col[my, 1−2my, my](_, row[mx, 1−2mx, mx](_, X, _), _)`: X with a Spacer margin |
| `grid2` | `col*2(row*2(P))` |

Carousel patterns list Slide subtrees; Slide i uses `pattern[i mod length]`. Seamless generators give the root for n Slides. Text Box positions are in canvas Slide units.

## Built-in Templates (27)

**TPL-06** v1 ships exactly these Templates, in this order within each type. The "Photos" column is the photo count shown on the thumbnail.

### Collage (8)

| id | Name | Tree | Photos | Default style |
|---|---|---|---|---|
| `collage-single-framed` | Single framed | `frame(P, .08, .08)` | 1 | Gallery |
| `collage-side-by-side` | Side by side | `row*2(P)` | 2 | Clean |
| `collage-three-columns` | Three columns | `row*3(P)` | 3 | Clean |
| `collage-grid-2x2` | Grid 2×2 | `grid2` | 4 | Clean |
| `collage-grid-3x3` | Grid 3×3 | `col*3(row*3(P))` | 9 | Clean |
| `collage-hero-2` | Hero + 2 | `col[.62,.38](P, row*2(P))` | 3 | Clean |
| `collage-hero-3` | Hero + 3 | `col[.62,.38](P, row*3(P))` | 4 | Clean |
| `collage-mosaic` | Mosaic | `row[.62,.38](P, col*3(P))` | 4 | Clean |

### Story (4, 9:16 only)

| id | Name | Tree | Photos | Default style |
|---|---|---|---|---|
| `story-single-framed` | Single framed | `frame(P, .08, .06)` | 1 | Gallery |
| `story-two-stacked` | Two stacked | `col*2(P)` | 2 | Clean |
| `story-photo-strip` | Photo strip | `col*4(P)` | 4 | Clean |
| `story-caption` | Caption *(text)* | `col[.8,.2](P, _)`, plus a Text Box "Caption" at x .08, y .84, width .84, size .05, weight 400, `#1a1a1a`, centred | 1 | Clean |

### Carousel (6)

| id | Name | Pattern | Photos (n Slides) | Default style |
|---|---|---|---|---|
| `carousel-one-per-slide` | One per Slide | `[P]` | n | None |
| `carousel-framed` | Framed | `[frame(P, .1, .1)]` | n | Gallery |
| `carousel-two-per-slide` | Two per Slide | `[col*2(P)]` | 2n | Clean |
| `carousel-grid` | Grid per Slide | `[grid2]` | 4n | Clean |
| `carousel-mixed-rhythm` | Mixed rhythm | `[P, col*2(P), col[.62,.38](P, row*2(P))]` | sum of 1, 2, 3 repeating | Clean |
| `carousel-cover` | Cover + photos *(text)* | Slide 0: `col[.72,.28](P, _)`, plus a Text Box "Your title" at x .08, y .76, width .84, size .08, weight 700, `#1a1a1a`, centred. Slides 1…: `[P]` | n | Clean |

### Seamless Carousel (9)

Here, `n` is the Slide count (n ≥ 2).

| id | Name | Root for n Slides | Photos | Default style |
|---|---|---|---|---|
| `seamless-panorama` | Panorama | `P` | 1 | None |
| `seamless-panorama-strip` | Panorama + strip | `col[.75,.25](P, row*(2n)(P))` | 1 + 2n | Clean |
| `seamless-bridges` | Bridges | `row[.75, .5, …, .5, .75](I, B, I, B, …, B, I)`, with n `I = col*2(P)` and n−1 `B = P`. The outer `I`s are 0.75 wide; everything else is 0.5, so each `B` is centred on a Slide edge | 3n − 1 | Clean |
| `seamless-stagger` | Stagger | `row[.5, 1, …, 1, .5]` with n+1 children; child k is `col[.8,.2](P, _)` for even k and `col[.2,.8](_, P)` for odd k | n + 1 | Clean |
| `seamless-offset-frames` | Offset frames | `row[.5, 1, …, 1, .5](_, F, …, F, _)` with n−1 `F = frame(P, .1, .12)`, each centred on a Slide edge | n − 1 | Gallery |
| `seamless-wide-opener` | Wide opener | `row[2, 1, …, 1](P, A₂, …, Aₙ₋₁)`, with `Aₖ = P` for even k and `col*2(P)` for odd k. For n = 2, just `P` | 1 + the A counts | Clean |
| `seamless-filmstrip` | Filmstrip | `col[.35,.3,.35](row*n(P), row[.5, 1, …, 1, .5](P × (n+1)), row*n(P))`. The middle band's Cells cross every Slide edge | 3n + 1 | Film |
| `seamless-split-horizon` | Split horizon | `col[.55,.45](P, row*n(P))` | n + 1 | Clean |
| `seamless-title-panorama` | Title panorama *(text)* | `col[.76,.24](P, _)`, plus a Text Box "Your title" at x .08, y .8, width .84, size .07, weight 700, `#1a1a1a`, left | 1 | Clean |

*Check (TPL-06):* a test enumerates exactly these 27 ids. For each one at n = 2, 3 and 20 it checks the tree against its notation and the photo count against the formula, and renders a golden thumbnail.

**TPL-07** Every built-in Template's thumbnail is rendered live by the renderer (RND-02) from the data above, at the Post's current ratio (and Slide count for Carousels), with grey placeholder Cells. No thumbnails are stored as images.
*Check:* changing the ratio re-renders the thumbnails.

## Style Presets

**TPL-08** A Style Preset is a named set of the five Layout style values, applied in one click and independent of the Layout. Every Template names a default Preset, applied with it.
*Check:* applying a Template sets the style to its default Preset's values.

**TPL-09** The six Style Presets, in inspector order:

| Preset | gap | cornerRadius | borderWidth | borderColor | background |
|---|---|---|---|---|---|
| None | 0 | 0 | 0 | `#000000` | `#ffffff` |
| Clean | 0.01 | 0 | 0 | `#000000` | `#ffffff` |
| Gallery | 0.06 | 0 | 0 | `#000000` | `#ffffff` |
| Black frame | 0.03 | 0 | 0 | `#000000` | `#000000` |
| Soft | 0.02 | 0.03 | 0 | `#000000` | `#f4efe6` |
| Film | 0.006 | 0 | 0 | `#000000` | `#0b0b0b` |

*Check:* applying each Preset sets exactly these values.

**TPL-10** After applying a Preset, every style value stays editable (EDT-17). The inspector highlights a Preset only while all five values match it.
*Check:* changing Clean's gap removes Clean's highlight.

## Template picker

**TPL-11** **Order** in the Templates tab:
1. Built-in Templates for the Post's type (plus Collage after Story at 9:16, TPL-04), sorted by **photo count** ascending. Carousel and Seamless counts are computed for the current Slide count. Ties keep the TPL-06 order.
2. If the Project has photos, Templates whose photo count **equals** the number of photos in the Project come first, keeping their relative order.
3. **My Templates** of the same type follow, sorted by name.

*Check:* with 4 photos imported in a Collage, Grid 2×2, Hero + 3 and Mosaic are listed first.

**TPL-12** Each thumbnail shows its photo count as a number badge, and "Aa" for the text Templates.
*Check:* visible in an end-to-end screenshot test.

## Saved Templates

**TPL-13** **Save as Template** captures:
- the split tree with its divider positions;
- the Layout style;
- the Text Boxes, whose current text becomes placeholder text;
- the Post type;
- the fixed Slide count;
- the Aspect Ratio, as a preference.

It does **not** capture photos or framing. The user names it; it appears under My Templates. It is stored as one `SavedTemplateFile` JSON file in `<app data>/templates/<id>.json` ([schema.ts](schema.ts)). There is no Template import or export.
*Check:* the saved JSON validates against the schema and contains no `photo` fields.

**TPL-14** A saved Template file that fails validation, or has a newer `formatVersion`, is skipped with a one-line notice, never crashing the picker.
*Check:* a corrupt file in the templates folder is skipped with a notice.

---

## Auto-fill

Auto-fill places photos automatically. It is the only "smart" feature in v1, and it uses no ML.

**AUT-01** **Photo order** is the Photos panel order (EDT-10). By default that is capture date, oldest first: EXIF DateTimeOriginal, falling back to the file's modification time.
*Check:* photos with shuffled file names but ordered capture dates are filled chronologically.

**AUT-02** **Cell order:** Slide by Slide; within a Slide, by each Cell's top-left corner, top to bottom, then left to right (ties within 1e-6 count as equal). In a Seamless Carousel, a Cell belongs to the Slide that contains its **centre**.
*Check:* a Seamless Bridges Layout's Cell order matches a hand-computed list.

**AUT-03** **Orientation:** a photo's orientation (after `rotate90`) and a Cell's shape (its inner rectangle at the Post's ratio) are each classed as **landscape** (aspect > 1.1), **portrait** (< 0.9) or **square** (otherwise). For each Cell in order, Auto-fill takes the first unplaced photo whose class matches, looking at the next photo in panel order **and up to 2 beyond it**. If none of those three matches, it takes the next photo.
*Check:* panel order [landscape A, portrait B, portrait C] into Cells [portrait, landscape, portrait] places B, A, C.

**AUT-04** **What it touches:** Auto-fill fills only **empty Cells**, using only **unplaced photos**. It never moves, replaces or reframes a placed photo. Placed photos are framed with `DEFAULT_FRAMING` (centred cover, AUT-09).
*Check:* running Auto-fill on a half-filled Post leaves the filled Cells untouched.

**AUT-05** **Slide count:** for a built-in Carousel or Seamless Template whose Layout is still unadjusted (equal to its pattern), Auto-fill first chooses the Slide count n in 2..20 that, in order of priority:
1. leaves the fewest photos unplaced;
2. then leaves the fewest empty Cells;
3. then uses the fewest Slides.

The Layout is then regenerated for that n (MOD-17). An adjusted Layout, a saved Template or a Collage keeps its shape: extra photos stay unplaced, and missing photos leave Cells empty (export warns, EXP-10).
*Check:* 5 photos with Two per Slide → 3 Slides (1 empty Cell); 7 photos with One per Slide → 7 Slides; 30 photos with One per Slide → 20 Slides, 10 unplaced.

**AUT-06** **Clear photos** (the Auto-fill menu) unplaces every photo in the Post, keeping them in the Photos panel. Auto-fill and Clear photos are each **one undo step**.
*Check:* undo after Auto-fill empties exactly the Cells it filled.

**AUT-07** **When it runs:**
- when the user clicks **Auto-fill** (always enabled when there are empty Cells and unplaced photos);
- **automatically** when a Template is applied to a Post that has **no photos placed** and has unplaced photos;
- automatically when photos are imported into a Post that has no photos placed yet.

*Check:* importing 4 photos into a new Collage fills Grid 2×2 automatically if it is applied, or the current Template otherwise.

**AUT-08** **Switching Template** on a Post with placed photos: the placed photos are collected in their current Cell order and placed into the new Layout's Cells by the AUT-02/AUT-03 rules, before any unplaced photo. Their framing resets to `DEFAULT_FRAMING`. Photos that don't fit go back to unplaced.
*Check:* switching a 4-photo Grid 2×2 to Side by side places photos 1–2 and unplaces 3–4.

**AUT-09** **Default framing** is cover, centred, zoom 1. There is no subject or face detection.
*Check:* a newly auto-filled photo's framing equals `DEFAULT_FRAMING`.
