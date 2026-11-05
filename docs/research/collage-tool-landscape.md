# Landscape of free collage and carousel tools

Research for [#4](https://github.com/christiankammerer/picturesque/issues/4), part of the v1 map [#1](https://github.com/christiankammerer/picturesque/issues/1).
Facts checked on **2026-11-05**. Repository activity comes from the GitHub API (`pushed_at`, licence SPDX id) on that date. Terms follow `GLOSSARY.md` (Post, Collage, Carousel, Slide, Seamless Carousel, Layout, Template, Aspect Ratio).

## Question

What free and open-source tools already exist for making Instagram Collages and (Seamless) Carousels on a computer? What do they do well, and where are the gaps Picturesque should fill? This is about capabilities and gaps, not about copying any one product's design.

## Short answer

No maintained FOSS **desktop** app covers the whole job. The existing tools fall into four groups:

1. **Collage-only generators** (PhotoCollage, Fotocx, PyPhotoCollage). They auto-arrange photos into one image, but they have no Instagram Aspect Ratio presets, no Carousel concept and little control over framing each cell.
2. **Single-purpose Seamless Carousel splitters** (panosplitter, assorted grid splitters, GIMP plug-ins). They slice one existing wide image into Slides. You can't compose photos across Slides, and you can't save and reopen a project.
3. **General-purpose editors** (GIMP, Krita, Inkscape, Penpot, digiKam Print Creator). They can do anything by hand, but they have no photo-cell Layouts, no Templates that suit Instagram, and splitting happens as a separate manual step.
4. **Browser or AI tools** that come closest on features: Collage Studio (a GPL-3.0 offline PWA) for Collages, and Open Carrusel (MIT) for Carousels. Neither is a native desktop app. Collage Studio has no Carousel or Seamless Carousel mode. Open Carrusel is driven by text and AI, needs Claude Code, and isn't built around photos.

**Gap Picturesque can fill:** one offline, account-less desktop app that treats **Collage, Carousel and Seamless Carousel as one model**. That means Layouts with photo cells that can span Slide boundaries, Templates, per-cell framing, saved projects, and export of exactly the right Slide files at 1:1, 4:5 and 9:16.

## Tools surveyed

### A. Collage generators (FOSS, desktop/offline)

| Tool | Licence | Platform | Maintenance (as of 2026-11-05) | What it does well | Gaps vs Picturesque |
|---|---|---|---|---|---|
| [PhotoCollage](https://github.com/adrienverge/PhotoCollage) | GPL-2.0 | Python + GTK; packaged for Fedora and Debian/Ubuntu, pip | Last push 2025-07-09, latest tag v1.5.0, 518 stars. Slow but alive | Auto-fills a poster with many photos (100+), regenerates random layouts, swaps photos, sets border width and colour, exports at any size, 11 UI languages | No Instagram presets, no Carousel, no Templates, no per-cell crop/zoom/rotate, no saved projects mentioned. Windows/macOS only via a manual Python setup |
| [Fotocx](https://kornelix.net/fotocx/fotocx.html) (Mashup, image table/array) | GPL-3+ ([Debian copyright](https://metadata.ftp-master.debian.org/changelogs/main/f/fotocx/unstable_copyright)) | Linux only | Active, current release 26.8.1 per its homepage | Free-form montage of images and text on a background of any size. "Table of images" balances mixed sizes into even columns | Collage is a side feature of a full photo editor. Linux-only, no Instagram or Carousel awareness, no Templates |
| [PyPhotoCollage](https://github.com/twilsonco/PyPhotoCollage) | MIT | CLI, Pythonista (iOS) | Last push 2025-12-05 | Keeps aspect ratios, distributes rows evenly (partition algorithm), sets spacing, corner rounding, nesting | No GUI on desktop, no manual editing, no Carousel |
| [image-collage](https://github.com/mtblc/image-collage) | MIT | Node library | Last push 2024-03-14 | Simple programmatic grid | A library, not an app |
| [ImageMagick `montage`](https://imagemagick.org/script/montage.php) | ImageMagick License | CLI, all OSes | Active | Tiles images with geometry, spacing and borders. `-crop` can slice a wide image into tiles | Command line only, not interactive. Useful as a reference for what export/slicing has to do |

### B. Seamless Carousel and grid splitters

| Tool | Licence | Platform | Maintenance | What it does well | Gaps |
|---|---|---|---|---|---|
| [panosplitter](https://github.com/FUTC-Coding/panosplitter) | GPL-3.0 (code) | Browser JS, local processing | Last push 2026-07-11, 43 stars | Slices one or more horizontal images into **3:4** Slides plus a framed "full view" image. Batch mode, ZIP download | Only splits an existing image. No composing, no other ratios, no projects |
| [gimp-instagram-carousel](https://github.com/Sable888/gimp-instagram-carousel) | No licence file | GIMP 3.0 plug-ins | Last push 2025-09-20, 6 stars | A 21600×1350 canvas with 19 guides for a 20-Slide 4:5 Seamless Carousel, guillotine slicing, batch TIFF export | Needs GIMP skills. Placing photos is manual. The slicing relies on GIMP's [Guillotine](https://docs.gimp.org/3.0/en/plug-in-guillotine.html), which opens the pieces as new images that you then export separately |
| Small client-side grid splitters, e.g. [instagram-grid-splitter](https://github.com/akacantr/instagram-grid-splitter), [gridcutter](https://github.com/DarrelWirasena/gridcutter), [instagram-crop](https://github.com/torturado/instagram-crop) | MIT (mostly) | Browser / Go CLI | Tiny hobby repos, 0 to 1 stars | Exact aspect-ratio cropping into profile-grid tiles | Throwaway utilities. No editing, nothing to rely on long-term |

Closed but free alternatives that come up in searches: web splitters (Circleboom, Socialkit, Renderfire, PostPlanify) and the iOS app Panoslice. They are not FOSS and most are online or mobile, so they fail Picturesque's offline-desktop-FOSS bar.

### C. General-purpose FOSS editors people use for this

| Tool | Licence | Notes |
|---|---|---|
| GIMP 3.x | GPL-3.0+ | A wide canvas plus guides plus Guillotine works for Seamless Carousels (see the plug-in above). It has no photo-cell Layouts. Each photo has to be scaled, masked and placed by hand |
| Krita / Inkscape | GPL-3.0 / GPL-2.0+ | Same story: a powerful canvas with no Collage Layout model and no Slide splitting built in |
| [Penpot](https://github.com/penpot/penpot) | MPL-2.0 | Very active (pushed 2026-11-05, ~62k stars). You can make Carousels from boards. It's web or self-hosted. Desktop exists only as unofficial wrappers (e.g. [author-more/penpot-desktop](https://github.com/author-more/penpot-desktop), AGPL-3.0). It's a general design tool, so it has no photo-first Layouts, and a design that spans Slides has to be cut into boards by hand |
| [digiKam Print Creator](https://docs.digikam.org/en/post_processing/print_creator.html) | GPL-2.0+ | Several photos on one page from XML-defined layout templates, with crop/rotate for each photo, saves to image/PDF. Built for print sizes, not Instagram. It is the only FOSS tool found with a real **template + per-cell crop** workflow |

### D. Nearest "all-in-one" projects (browser/AI, not native desktop)

| Tool | Licence | Maintenance | Covers | Does not cover |
|---|---|---|---|---|
| [Collage Studio](https://github.com/cnitin25/collage-studio) ([demo](https://offline-collage.vercel.app)) | GPL-3.0 | Created 2026-07-09, last push 2026-11-04, 2 stars (new, one author) | Offline installable PWA. HEIC import. Grid, Justified, Mosaic, Masonry and Spotlight auto-layouts. Per-photo crop/zoom/rotate. Spacing, borders, corner radius. Bundled fonts. Social presets (square, portrait, story). Projects in IndexedDB plus portable project files, autosave, undo | No Carousel or Seamless Carousel. It's a browser app (storage limited by the browser, not a native app). Heavy on filters, stickers and colour adjustment, which Picturesque rules out of scope |
| [Open Carrusel](https://github.com/Hainrixz/open-carrusel) | MIT | Created 2026-04-15, last push 2026-10-25, ~510 stars | Carousels at 1:1 (1080×1080), 4:5 (1080×1350) and 9:16 (1080×1920). Local data. Slides authored as HTML and exported per Slide through Puppeteer | Local Next.js web app. The AI chat needs the Claude Code CLI and network access. It's text/brand-slide oriented, not photo-first. No Seamless Carousel spanning. Downloads about 300 MB of Chromium for export |

GitHub search for "instagram carousel" (2026-11-05) is dominated by **AI agent skills** that generate text carousels (e.g. instagram-thread-carousel, carousel-builder, insta-carousel-builder). None are photo-first desktop editors.

## Capabilities that recur, and how often FOSS covers them

| Capability | Covered by | Coverage |
|---|---|---|
| Auto-arrange N photos into one image | PhotoCollage, Fotocx, PyPhotoCollage, Collage Studio | Good |
| Instagram Aspect Ratio presets (1:1, 4:5, 9:16) | Open Carrusel, Collage Studio (generic social presets) | Partial |
| Per-cell framing (crop/pan/zoom/rotate) | Collage Studio, digiKam Print Creator | Rare |
| Layout styling (gap, border, corner radius, background) | Collage Studio, PyPhotoCollage, PhotoCollage (border only) | Partial |
| Templates (built-in plus "save as Template") | digiKam (XML templates for print), Open Carrusel (slide templates) | Rare, and none for photo Collage plus Instagram |
| Multi-Slide Carousel with consistent styling | Open Carrusel | Rare, and not photo-first |
| **Seamless Carousel: compose on a wide canvas, cells crossing Slide edges, export cut Slides** | Only "split an existing image" tools (panosplitter, GIMP plug-ins) | **None compose it** |
| Saved, reopenable projects | Collage Studio (browser), GIMP/Penpot (native formats) | Rare in dedicated tools |
| Native Windows + macOS + Linux app, offline, no account | PhotoCollage (Linux, others by hand), Fotocx (Linux) | **None of the dedicated tools** |
| HEIC import | Collage Studio | Rare |

## Gaps Picturesque could fill

1. **Seamless Carousels you compose, not just split.** Every FOSS option either splits a finished panorama or leaves you cutting by hand in GIMP. A Layout that runs across the whole wide canvas, with Slide boundaries shown live and cells allowed to cross them, is not offered by any FOSS tool found.
2. **One model for Collage, Carousel and Seamless Carousel.** The tools found handle one Post type each. A shared Layout/Template model across all three is open ground.
3. **Instagram-specific Templates.** digiKam shows that templates plus per-cell crop works, but only for print. There are no FOSS photo Templates sized for 1:1, 4:5 and 9:16, and no "save as Template".
4. **A real native desktop app on all three OSes.** PhotoCollage and Fotocx are Linux-first. The best-featured newcomers (Collage Studio, Open Carrusel) run in the browser or as a local web app. A packaged Windows/macOS/Linux app with project files on disk is missing.
5. **Photo-first and deliberately narrow.** Newer projects drift towards filters and stickers (Collage Studio) or AI text slides (Open Carrusel and the many agent skills). A focused tool for framing, Layout styling and exact export is a clear position. It also fits #1's out-of-scope list.
6. **Exact export.** Export the correct Slide count, pixel sizes and file names in one go (e.g. 1080×1350 per 4:5 Slide). Splitters do this for one image, but no composer does it for a whole project.

## Things worth carrying into later tickets (not decisions)

- **Instagram's 3:4 shift.** Secondary sources report that the profile grid switched to 3:4 thumbnails in January 2025, and some report native 3:4 uploads (1080×1440) after that. Examples: [Kapwing](https://www.kapwing.com/resources/instagrams-new-grid-layout-size-and-dimensions-2025/), [Oktopost](https://www.oktopost.com/blog/instagram-grid-size-guide/), [Metricool](https://metricool.com/instagram-testing-vertical-profile-display/). panosplitter already outputs 3:4 Slides. I found **no first-party Meta/Instagram page** confirming 3:4 upload support, so treat it as unverified. Whether to add 3:4 next to 1:1, 4:5 and 9:16 is a question for the export/Aspect Ratio ticket.
- **20-Slide limit.** The Carousel cap rose from 10 to 20 photos/videos around 2024-08-08 ([PetaPixel](https://petapixel.com/2024/08/09/instagram-users-can-now-share-20-photos-videos-in-a-post-carousel-photodump), [Social Media Today](https://www.socialmediatoday.com/news/instagram-expands-carousels-to-20-frames/723792/)). This matches the glossary's "up to 20 Slides". It is secondary press coverage; no Instagram Help Center page was reachable.
- **The first Slide sets the Carousel's ratio** on Instagram, according to secondary guides. This supports the glossary rule that all Slides share the Post's Aspect Ratio.
- **Prior art for auto-fill:** PyPhotoCollage's partition-based row balancing and PhotoCollage's random regenerate-and-swap are simple non-ML approaches. They're relevant to the "Auto-fill Template" fog item.
- **Licence note:** the closest projects are GPL-3.0 (Collage Studio, panosplitter, Fotocx) and MIT (Open Carrusel). Reading them for ideas is fine. Copying code would make Picturesque's licence choice matter.

## Sources

Checked 2026-11-05 unless noted.

- GitHub API repository metadata (licence, `pushed_at`, stars) for: adrienverge/PhotoCollage, twilsonco/PyPhotoCollage, mtblc/image-collage, FUTC-Coding/panosplitter, Sable888/gimp-instagram-carousel, akacantr/instagram-grid-splitter, DarrelWirasena/gridcutter, torturado/instagram-crop, cnitin25/collage-studio, Hainrixz/open-carrusel, penpot/penpot, author-more/penpot-desktop. READMEs of these repos for the feature claims.
- Fotocx homepage: https://kornelix.net/fotocx/fotocx.html. Licence from Debian copyright: https://metadata.ftp-master.debian.org/changelogs/main/f/fotocx/unstable_copyright
- digiKam manual, Print Creator: https://docs.digikam.org/en/post_processing/print_creator.html
- GIMP 3.0 manual, Guillotine: https://docs.gimp.org/3.0/en/plug-in-guillotine.html
- ImageMagick montage: https://imagemagick.org/script/montage.php
- Instagram limits and ratios (secondary press and guides, no first-party page found): links inline above.
- Not verified from first-party sources: PhotoScape X (free, closed source, Windows/macOS, reportedly has Collage/Combine/Splitter). The official site was unreachable during this research, so it is left out of the tables.
