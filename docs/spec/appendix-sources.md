# Appendix · Sources (non-normative)

Background for the decisions in this spec. **Nothing here is a requirement**; where this material and the spec differ, the spec wins.

## Prototype

- [Editor flow prototype](https://github.com/christiankammerer/picturesque/blob/prototype/editor-flow/prototypes/editor-flow-prototype.html), on the throwaway branch `prototype/editor-flow`. It is a single HTML file with variants A, B and C (`?variant=`); v1 follows **B, with C's canvas** (EDT-04, EDT-05). It shows the intended feel of placing, framing and the peeking Slide view. Its code is throwaway and must not be copied into the app.

## Research

- [Instagram image specs and recompression](https://github.com/christiankammerer/picturesque/blob/research/instagram-image-specs/docs/research/instagram-image-specs.md), on branch `research/instagram-image-specs`. Covers the 1080 px width, the feed ratio range, 20-Slide Carousels, sRGB, the 3:4 grid crop and recompression folklore.
- [Platform and stack options](https://github.com/christiankammerer/picturesque/blob/research/platform-stack-options/docs/research/platform-stack-options.md), on branch `research/platform-stack-options`. Compares Tauri, Electron, Flutter, Qt and PWA, and covers HEIC licensing.
- [Collage tool landscape](https://github.com/christiankammerer/picturesque/blob/research/collage-tool-landscape/docs/research/collage-tool-landscape.md), on branch `research/collage-tool-landscape`. Shows that no free tool composes Seamless Carousels.

## Decision history

The planning map, [Picturesque v1: Instagram collage & carousel app](https://github.com/christiankammerer/picturesque/issues/1), links one closed issue per decision. The resolution comment on each holds the original reasoning:

| Area | Issues |
|---|---|
| Stack | [Choose platform and tech stack](https://github.com/christiankammerer/picturesque/issues/5) · [Licence](https://github.com/christiankammerer/picturesque/issues/10) |
| Model | [Supported Aspect Ratios](https://github.com/christiankammerer/picturesque/issues/11) · [Layout and Template model](https://github.com/christiankammerer/picturesque/issues/7) |
| Editor | [Editor flow prototype](https://github.com/christiankammerer/picturesque/issues/6) · [Editor details beyond the core flow](https://github.com/christiankammerer/picturesque/issues/19) |
| Templates | [Built-in Template set for v1](https://github.com/christiankammerer/picturesque/issues/9) · [Auto-fill behaviour](https://github.com/christiankammerer/picturesque/issues/18) |
| Output | [Export rules](https://github.com/christiankammerer/picturesque/issues/8) (including its amendment) · [Getting exports onto the phone](https://github.com/christiankammerer/picturesque/issues/16) |
| Files | [Project file format](https://github.com/christiankammerer/picturesque/issues/15) |
| Quality | [Performance budget](https://github.com/christiankammerer/picturesque/issues/17) |
| Shipping | [Distribution and updates](https://github.com/christiankammerer/picturesque/issues/13) |
| This spec | [Shape of the v1 spec document](https://github.com/christiankammerer/picturesque/issues/20) |
