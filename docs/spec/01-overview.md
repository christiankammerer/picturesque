# 01 · Overview and scope

## Purpose

Picturesque makes good-looking Instagram images from your own photos, quickly. Pick a Template, drop photos into it, frame them, and export images that are exactly what Instagram wants.

It is **template-driven and photo-first**. Simple text is secondary, and it is **not a general design tool**.

The one thing no free tool does well is the **Seamless Carousel**: one wide composition, with photos crossing Slide edges, cut into Slides that line up exactly when swiped. Picturesque treats Collages, Carousels and Seamless Carousels as one model, drawn by one renderer.

## Audience

The owner first; the app is then published openly for anyone. Users are people who post photos to Instagram and want a better result than the in-app tools give, without learning a design app.

## Requirements

**OVR-01** Picturesque is a desktop app for Windows (10 64-bit or later), macOS (12 or later) and Linux (Ubuntu 22.04 or equivalent), built with Electron, React and TypeScript ([ADR 0001](../adr/0001-electron-single-renderer.md)).
*Check:* release CI produces a working build on all three OSes.

**OVR-02** The app works fully offline and has no accounts, sign-in or server. Its **only** network access is the optional update check ([DST-05](09-distribution.md)).
*Check:* with the update check turned off, a full session (import, edit, save, export) makes no network requests. A request log or firewall test during the end-to-end suite shows zero connections.

**OVR-03** It supports three kinds of Post: Collage (with Story as a Collage at 9:16), Carousel and Seamless Carousel, at the Aspect Ratios in [02-model.md](02-model.md).
*Check:* each kind can be created, edited, saved and exported.

**OVR-04** Accepted photo inputs are JPEG, PNG, WebP and HEIC/HEIF. Any other file is refused on import with a message naming the file.
*Check:* importing one file of each format succeeds; importing a `.gif`, `.tiff` or RAW file shows the refusal message.

**OVR-05** The UI is English. All user-facing strings go through one i18n layer (e.g. i18next or FormatJS) with an English message catalogue, so translations can be added later without code changes.
*Check:* a lint rule or test finds no hard-coded user-facing strings in components.

**OVR-06** The app follows the OS light or dark theme, with no theme setting.
*Check:* switching the OS theme switches the app theme.

## Licence

**OVR-07** The app is licensed **GPL-3.0-or-later**. The repository has a `LICENSE` file, and every source file may carry an SPDX header.
*Check:* `LICENSE` is GPL-3.0 text; `package.json` says `"license": "GPL-3.0-or-later"`.

**OVR-08** Exported images belong to the user, with no licence obligations. The README and the About box say so explicitly.
*Check:* the About box contains the sentence "Images you export are yours. Picturesque places no licence on them." (wording can be refined).

**OVR-09** Built-in Templates and design assets are CC0. Bundled fonts are only SIL OFL or Apache-2.0 fonts, and each one's licence file ships in the app.
*Check:* the build contains a licence file for each bundled font; a CI script fails if a font lacks one.

**OVR-10** libheif and libde265 (LGPL-3.0) are shipped as a separate, replaceable WASM file, with their licence texts. The About box lists third-party licences, including Electron, React and libheif. The README notes the HEVC patent situation for HEIC decoding.
*Check:* the libheif WASM is a separate file in the packaged app, and the About box has a "Third-party licences" view.

**OVR-11** Contributions are accepted under GPL-3.0-or-later (inbound = outbound), with no CLA and no DCO. `CONTRIBUTING.md` says so.
*Check:* `CONTRIBUTING.md` exists with that statement.

## Out of scope for v1

These are deliberately excluded. Don't build them, and don't build hooks for them:

- Posting directly to Instagram. The API needs Business accounts and a server; Picturesque exports files only.
- Colour adjustment, filters and photo presets.
- AI/ML features: background removal, smart crop, face detection, ML auto-layout.
- RAW input.
- Template sharing, import/export or a marketplace.
- Video, Reels, Instagram captions and hashtags.
- Landscape Aspect Ratios (wider than 1:1).
- Built-in phone transfer (a local-network or QR server) and cloud-service integrations.
- Copying an image to the clipboard.
- Auto-update and code signing. Both come later, together.
- Telemetry, analytics and crash reporting of any kind.
