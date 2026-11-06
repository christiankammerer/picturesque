# 06 · Export

Export writes the Post as JPEG files that are ready to upload to Instagram. Nothing about the output is configurable.

## Output

**EXP-01** Every exported image is **1080 px wide**. Heights: 1:1 → 1080, 4:5 → 1350, 3:4 → 1440, 9:16 (Story) → 1920. There is no size option.
*Check:* exported files have exactly these dimensions.

**EXP-02** The format is **baseline JPEG, quality 92**, in **sRGB with the sRGB ICC profile embedded**. There is no quality slider and no PNG option.
*Check:* the exported file's JPEG quality estimate is 92 (±1), and an APP2 ICC segment containing the sRGB profile is present.

**EXP-03** **One render, sliced.** The whole canvas is rendered once at scale 1080 (`slideCount × 1080` px wide) with `emptyCells: 'background'`, then sliced at the exact Slide edges (`x = i × 1080`), with no overlap and no gap. Cells and Text Boxes crossing an edge are split cleanly. Plain Carousels go through the same path.
*Check:* golden test: for a Seamless Post with a Cell crossing Slide edge 1, the last pixel column of Slide 1 and the first of Slide 2 match the corresponding adjacent columns of the full render.

**EXP-04** **Photo quality:** each photo is decoded from its **original** at the size its Cell needs (PRF-02), with a high-quality filter, so there is no upscaling from preview copies.
*Check:* exporting a 48 MP photo in a Single framed Collage shows full detail at 100% (golden test against a reference decode).

**EXP-05** **Metadata:** all EXIF, XMP, IPTC and GPS data is stripped, **except** one EXIF **DateTimeOriginal** tag. It is set to the export start time plus **1 second per Slide**: Slide 1 gets the start time, Slide 2 start + 1 s, and so on. Each file's **modification time** is set the same way. As a result, phone galleries and Instagram's photo picker list the Slides in order.
*Check:* exiftool on the exported files shows only DateTimeOriginal (plus JFIF/ICC structure), increasing by 1 s per Slide; the file mtimes match.

**EXP-06** Each file is under **8 MB**. If one ever isn't, it is re-encoded at quality 90 and the export notes it.
*Check:* the benchmark Post's exports are all under 8 MB.

## Files and folders

**EXP-07** **Naming:**
- A Collage or Story becomes `<name>.jpg`.
- A Carousel or Seamless Carousel becomes `<name>-01.jpg` … `<name>-NN.jpg`, always two digits.
- `<name>` is the Project name. An unsaved Project uses `picturesque-YYYY-MM-DD-HHMM` (local time).
- Characters that aren't allowed in file names on any of the three OSes (`\ / : * ? " < > |` and control characters) are replaced by `-`.

*Check:* a 3-Slide Carousel named "trip" exports `trip-01.jpg`, `trip-02.jpg`, `trip-03.jpg`; a Project named `a/b` exports `a-b.jpg`.

**EXP-08** **Destination:** a native folder picker opens at the last export folder. The first time, it opens at the default export folder from Settings (initially `Pictures/Picturesque`, created if missing).
- A **Carousel** is written into its own subfolder `<chosen folder>/<name>/`.
- A **Collage or Story** goes straight into the chosen folder.
- No zip is made.

*Check:* the first export offers `Pictures/Picturesque`; the second offers the folder chosen the first time; a Carousel's files land in the `<name>` subfolder.

**EXP-09** **Existing files:** if any target file already exists, ask "Replace N existing files?", with **Replace** as the default button and Cancel as the alternative. Replacing removes stale files from an earlier, longer export of the same Carousel (`<name>-NN.jpg` with NN beyond the new count) in that subfolder.
*Check:* exporting a 5-Slide Carousel over an earlier 7-Slide export leaves exactly 5 files.

**EXP-10** **Empty Cells:** if any Cell is empty, warn "N Cells are empty" with **Export anyway** and Cancel. Empty Cells export as background, like Spacers.
*Check:* exporting with one empty Cell shows the warning; Export anyway writes files with the background colour there.

**EXP-11** **Scope:** export always writes the whole Post, every Slide. There is no single-Slide export in v1.
*Check:* there is no UI for exporting a subset.

**EXP-12** **Atomic writes:** each file is written to a temporary name in the target folder and then renamed. A failed or cancelled export leaves no partial files.
*Check:* cancelling halfway through leaves no `.tmp` files and no partial JPEGs.

**EXP-13** **Progress:** export shows a progress bar (per Slide) and can be cancelled. It runs off the UI thread (PRF-06).
*Check:* the UI stays responsive during the benchmark export.

## After export

**EXP-14** When export finishes, a dialog says "**N images exported**" and offers:
- **Show in folder**, which reveals the files in the OS file manager;
- a link, **"How to get these onto your phone"**, to the help page (EXP-15);
- **Done**.

*Check:* end-to-end test of the dialog; Show in folder calls `shell.showItemInFolder`.

**EXP-15** The **phone-transfer help page** ships inside the app (Help menu and the export dialog), works offline, and briefly covers:
- **macOS:** AirDrop to an iPhone.
- **Windows:** Phone Link.
- **Linux:** LocalSend or KDE Connect.
- **Any OS:** a cloud-synced folder (iCloud Drive, Google Drive, OneDrive). It points out that setting the default export folder to such a folder makes exports arrive on the phone automatically.
- **Any OS:** posting from **instagram.com** in a desktop browser, which supports Carousels.
- **Tip:** select the Slides in order in Instagram's picker. They are listed in order thanks to EXP-05.

The app itself does no network transfer.
*Check:* the page opens offline and covers each item.
