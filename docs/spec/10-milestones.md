# 10 · Milestones and testing

## Build order

Build in this order. Each milestone ends with something demoable and lists the requirements it must satisfy, with their checks passing. A requirement listed in an earlier milestone stays passing. The builder turns each milestone into issues.

### M1 · Model, renderer and Collage export (no UI)

The core everything else stands on.
- Project scaffold: electron-vite with React and TypeScript, the i18n layer, lint, CI on all three OSes, `LICENSE`.
- The zod schema for `schema.ts`.
- `render()`.
- A headless export of a Collage from a JSON fixture.

**Demo:** a script turns a fixture `post.json` plus photos into `trip.jpg`.
**Requirements:** OVR-01, OVR-05, OVR-07 · MOD-01, MOD-04–MOD-09, MOD-11–MOD-13, MOD-19, MOD-20 · RND-01–RND-08, RND-10, RND-11 · EXP-01–EXP-07, EXP-12 · DST-09 (partial: lint, types, unit and golden tests).

### M2 · Editor shell, placing and framing, HEIC import

- The start screen and the three-pane workspace for a Collage.
- The Photos panel, placing and framing.
- Layout adjusting and styling.
- The image pipeline with workers and HEIC.

**Demo:** make a Grid 2×2 Collage from four iPhone HEIC photos, frame them, restyle it, and export.
**Requirements:** OVR-04, OVR-06 · MOD-14 · EDT-01 (without Recent Projects), EDT-03, EDT-04, EDT-08, EDT-09, EDT-13–EDT-17, EDT-30, EDT-31 · PRF-01–PRF-05.

### M3 · Carousels, Seamless Carousels and the filmstrip

- Multi-Slide canvases, with peeking neighbours and the filmstrip.
- Slide editing and Carousel ↔ Seamless.
- The full export flow, including the after-export dialog.

**Demo:** a 5-Slide Seamless Carousel with a photo crossing every edge, exported and checked in Preview as post.
**Requirements:** OVR-03 · MOD-02, MOD-03, MOD-10, MOD-15–MOD-18 · EDT-05–EDT-07, EDT-22, EDT-23 · EXP-08–EXP-11, EXP-13–EXP-15 · PRF-06, PRF-07.

### M4 · Templates, Style Presets and Auto-fill

- All 27 built-in Templates as data, with live thumbnails.
- The picker order.
- Style Presets.
- Save as Template.
- Auto-fill, panel reorder and multi-select.

**Demo:** import 9 photos, pick Grid 3×3 from the top of the list, and see it auto-filled; switch to a Seamless Template and see the photos carried over.
**Requirements:** TPL-01–TPL-14 · AUT-01–AUT-09 · EDT-10–EDT-12, EDT-24, EDT-25.

### M5 · Text Boxes

- Text Boxes with bundled and system fonts.
- Snapping.
- The text Templates' placeholders.

**Demo:** the Cover + photos Template with a styled title.
**Requirements:** MOD-21–MOD-23 · RND-09 · EDT-18–EDT-21 · OVR-09 (fonts).

### M6 · Project files

- Save and open `.picturesque` files.
- Atomic saves and crash recovery.
- Versioning.
- Recent Projects, file drops and open-on-launch.

**Demo:** save a Project, move the original photos away, kill the app mid-edit, relaunch, restore and reopen.
**Requirements:** PRJ-01–PRJ-03, PRJ-05–PRJ-14 · EDT-01 (Recent Projects), EDT-02.

### M7 · Undo, shortcuts, Settings and the update notice

- Undo and redo across every action.
- The full shortcut set.
- The Settings screen.
- The startup update notice.
- The About box with licences.

**Demo:** a long editing session undone step by step; the update notice shown against a mocked newer release.
**Requirements:** EDT-26–EDT-29 · DST-05, DST-07, DST-10 · OVR-02, OVR-08, OVR-10.

### M8 · Packaging, release CI and README

- electron-builder targets and file association.
- The tag-triggered release workflow.
- The README with the unsigned-app steps and screenshots.
- `CONTRIBUTING.md`.
- The benchmark.

**Demo:** push `v0.1.0`, publish the draft Release, install on all three OSes, run the benchmark, and post a real Seamless Carousel.
**Requirements:** PRJ-04 · DST-01–DST-04, DST-06, DST-08, DST-09 (complete) · OVR-11 · PRF-08–PRF-12 · the [definition of done](README.md#definition-of-done-for-v1).

*Check (coverage):* every requirement ID in the spec appears in exactly one milestone above, except EDT-01 and DST-09, which are split across two. A small script in CI can verify this by grepping the IDs.

## Testing

**Unit tests** (Vitest) cover the model and its pure logic:
- schema validation;
- every Layout operation (MOD-14…MOD-18);
- Template generation for every Slide count;
- Auto-fill (AUT-01…AUT-08);
- format migrations and version checks;
- semver comparison.

Property-based tests (fast-check) cover the tiling (MOD-09) and photo coverage (RND-07) invariants.

**Golden-image tests** cover the renderer.
- Fixture Posts are rendered to PNG in a headless Chromium (the same engine Electron ships) and compared pixel-by-pixel with stored reference images, within a small tolerance for anti-aliasing (for example, ≤ 0.1% of pixels differing by more than 2/255).
- The fixtures cover every RND requirement, all 27 Templates at n = 3, every Style Preset, and the export slicing (EXP-03).
- Updating a reference image is a deliberate, reviewed change.

**End-to-end tests** (Playwright with its Electron support) drive the packaged app through the main flows:
- new Post → import → Template → place, frame and adjust → export;
- save, reopen and recover;
- Carousel ↔ Seamless;
- the shortcuts.

They also assert that no network requests are made (OVR-02).

**Benchmark:** PRF-11 by hand before each release, and PRF-12 in CI.

**Manual release checklist:**
- install on each OS and check the unsigned-app steps;
- file association;
- the update notice;
- posting one real Seamless Carousel to Instagram (the definition of done).
