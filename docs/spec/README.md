# Picturesque v1 spec

Picturesque is a free, open-source, offline desktop app for making Instagram **Collages**, **Carousels** and **Seamless Carousels**. It runs on Windows, macOS and Linux, has no accounts and no server, and is built entirely by AI.

This folder is the **hand-off spec for v1**. It is self-contained: a builder needs nothing else to build v1.

## Authority

- **This spec is the source of truth.** If it disagrees with an issue, a comment or the planning map, the spec wins. Changes to v1 behaviour go into the spec through a pull request first.
- These files are **normative** too, and the spec uses their terms exactly:
  - [`GLOSSARY.md`](../../GLOSSARY.md) defines the domain terms (Post, Slide, Cell, Template…). Capitalised domain words in this spec mean exactly what the glossary says.
  - [`docs/adr/`](../adr/) records the hard-to-reverse decisions and why they were made.
- The prototype and research branches in [appendix-sources.md](appendix-sources.md) are **background only**, not requirements.

## Files

| File | Covers | Requirement prefix |
|---|---|---|
| [01-overview.md](01-overview.md) | Purpose, audience, platforms, scope, licence | `OVR` |
| [02-model.md](02-model.md) + [schema.ts](schema.ts) | Post model: canvas, split tree, Cells, Text Boxes, styling, Aspect Ratios | `MOD` |
| [03-renderer.md](03-renderer.md) | The single renderer used for preview and export | `RND` |
| [04-editor.md](04-editor.md) | Start screen, workspace, every editing interaction, shortcuts, Settings | `EDT` |
| [05-templates.md](05-templates.md) | Built-in Templates, Style Presets, saved Templates, the picker, Auto-fill | `TPL`, `AUT` |
| [06-export.md](06-export.md) | Export output, slicing, naming, the help shown after export | `EXP` |
| [07-project-files.md](07-project-files.md) | The `.picturesque` file, saving, recovery, versioning | `PRJ` |
| [08-performance.md](08-performance.md) | Image pipeline, limits, targets, benchmark | `PRF` |
| [09-distribution.md](09-distribution.md) | Installers, releases, update notice, privacy | `DST` |
| [10-milestones.md](10-milestones.md) | Build order, testing approach | — |

## How requirements are written

Every rule is a numbered requirement with an acceptance check:

> **EXP-04** Carousel files are named `<name>-01.jpg` … `<name>-NN.jpg`.
> *Check:* exporting a 3-Slide Carousel named "trip" writes `trip-01.jpg`, `trip-02.jpg`, `trip-03.jpg`.

- Requirement IDs are stable. Cite them in commit messages, test names and issues.
- A check states what must be observable for the requirement to count as met. Most checks should become automated tests (see [10-milestones.md](10-milestones.md#testing)).
- "Must" is implied: every requirement is mandatory for v1 unless it says otherwise.
- Units: **Slide units** (defined in [02-model.md](02-model.md)) for geometry, and **px** only for export output.

## Definition of done for v1

v1 is done when all of these hold:

1. Every requirement's check passes.
2. The benchmark in [08-performance.md](08-performance.md) meets all its targets on the minimum hardware.
3. Release CI builds the installers for Windows, macOS and Linux from a version tag.
4. The README includes the "how to open an unsigned app" steps with screenshots.
5. **The owner posts a real Seamless Carousel to Instagram from an exported build, and the seams line up.**
