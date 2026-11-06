# 08 · Performance

## Image pipeline

**PRF-01** **Preview copies.** On import, a worker decodes each photo (HEIC via the libheif WASM module, others via `createImageBitmap`) and applies the EXIF orientation. It makes a **preview copy with a 2048 px long edge**, which the editor, filmstrip, thumbnails and Preview as post use. Preview copies are kept in memory while the Project is open and cached on disk (PRJ-13), keyed by the photo's hash.
*Check:* during editing, no full-resolution bitmap is held in memory (heap snapshot in the benchmark).

**PRF-02** **Export decodes originals one at a time.** For each placed photo, export decodes the original, resizes it with a high-quality filter to the size its Cell needs at scale 1080 and its zoom (never larger than the original), draws it, and frees it before decoding the next. The export canvas is the only large surface held.
*Check:* peak memory during the benchmark export stays within PRF-09.

**PRF-03** All decoding, hashing and resizing runs in **workers**, never on the UI thread. The UI never freezes during import, open or export.
*Check:* the benchmark records no main-thread task longer than 100 ms during import.

**PRF-04** **HEIC** is decoded with libheif and libde265 compiled to WASM (libheif-js), loaded as a separate file (OVR-10), in a worker pool sized to `navigator.hardwareConcurrency − 1` (at least 1, at most 4).
*Check:* importing 4 HEIC photos on a 4-core machine decodes 3 at a time.

## Limits

**PRF-05** A Project holds at most **100 photos**, placed or not. Importing beyond that imports up to the limit and says "Projects can hold up to 100 photos. N weren't added." A photo larger than **100 megapixels** is refused on import with a message naming it.
*Check:* importing 105 photos adds 100 and shows the message; a 120 MP image is refused.

## Interaction

**PRF-06** Export rendering and slicing run in a worker on an `OffscreenCanvas`, so the UI keeps responding and Cancel works.
*Check:* the Cancel button responds within 200 ms during the benchmark export.

**PRF-07** **Redraw scope:** while the user drags (pan, zoom, divider, Text Box), the canvas redraws **only the visible Slides**: the current one and the peeking neighbours, using the `slides` option of `render`. The filmstrip thumbnails re-render about **200 ms after** the gesture ends.
*Check:* instrumented test: a divider drag in a 20-Slide Seamless Post calls `render` with at most 3 Slides per frame.

## Targets

**PRF-08** On the **minimum hardware** (PRF-10), for the **benchmark Project** (20-Slide Seamless Carousel at 3:4, 40 photos of 48 MP HEIC, using the Filmstrip Template plus 2 Text Boxes):

| Action | Target |
|---|---|
| Import: each photo visible in the Photos panel | < 1 s after its decode starts; the UI never freezes |
| Import: all 40 ready | < 30 s |
| Pan, zoom, divider drag, Text Box drag | 60 fps; never below 30 fps |
| Open the Project, preview cache warm | < 3 s to an interactive editor |
| Open the Project, preview cache cold | < 30 s until every preview copy is ready; editor interactive before that |
| Export all 20 Slides | < 15 s, with a progress bar |

*Check:* the benchmark (PRF-11) reports each number.

**PRF-09** **Peak memory** for the benchmark Project, across all processes, is **under 1.5 GB**.
*Check:* the benchmark reports peak resident memory across Electron's processes.

## Minimum supported system

**PRF-10** The minimum system is:
- **Hardware:** 8 GB RAM; a 4-core x64 CPU from about 2018, or any Apple Silicon Mac.
- **OS:** Windows 10 64-bit, macOS 12 and Ubuntu 22.04, or later. If the current Electron release drops one of these, Electron's support list wins, and the README states the actual minimum.

*Check:* the README lists the minimum system; the release benchmark runs on a machine at or near this floor.

## Benchmark

**PRF-11** A **benchmark script** (`npm run bench`) generates the benchmark Project from synthetic 48 MP HEIC images, then drives the packaged app to time import, warm and cold open, a scripted divider drag (fps) and export, and records peak memory. It writes a JSON report and is **run by hand before every release**. The report is attached to the release.
*Check:* the script runs end to end and produces the report.

**PRF-12** A **CI smoke version** runs the same steps on a smaller Project: 8 Slides with 12 MP photos. It **fails only if a step takes more than twice its last recorded time**, because CI runners vary too much for absolute targets. The recorded times live in the repo (`bench/baseline.json`) and are updated deliberately.
*Check:* artificially slowing export by 3× makes the CI smoke job fail.
