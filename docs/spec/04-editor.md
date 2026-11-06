# 04 · Editor

The visual reference is the [editor flow prototype](appendix-sources.md#prototype), variant B with variant C's canvas. Use it to see the feel, but these requirements are what count.

## Start screen

**EDT-01** On launch with no file to open, the start screen shows:
- three large buttons: **New Collage**, **New Carousel** and **New Story**;
- a **Recent Projects** grid of thumbnails with names. The 12 most recent; entries whose file no longer exists are hidden;
- an **Open…** button.

*Check:* end-to-end test of each button; a deleted Recent Project disappears from the grid.

**EDT-02** Dropping files on the start screen:
- photos start a new **Carousel** with those photos imported;
- a `.picturesque` file opens it.

Launching the app with a `.picturesque` path (double-click in the OS) opens that Project directly.
*Check:* end-to-end tests of both drops; launching with a path argument opens the Project.

**EDT-03** A new Post opens the workspace with the **Photos** tab active, showing a large drop zone: "Add photos (or drop them here)". The drop zone has a file-picker button too. The Aspect Ratio is the default from MOD-05, and the Template is the type's first built-in Template.
*Check:* New Carousel opens on the Photos tab with the drop zone and the "One per Slide" Template at 4:5, 3 Slides.

## Workspace

**EDT-04** The workspace has three panes and a top bar:
- **Top bar:**
  - for a Carousel, the Carousel ↔ Seamless switch;
  - Aspect Ratio selector;
  - Slide count for Carousels;
  - **Auto-fill** (with "Clear photos" in its menu);
  - **Text** (adds a Text Box);
  - Grid Crop toggle;
  - **Preview as post**;
  - **Export**.
- **Left sidebar:** two tabs, **Templates** and **Photos**.
- **Centre:** the canvas.
- **Right inspector:**
  - Layout style (Style Presets plus gap, corner radius, border width and colour, background colour);
  - the selected Cell's controls (zoom, Rotate 90°, Straighten, reset framing, empty Cell, split as row or column, merge with neighbour, make Spacer);
  - or the selected Text Box's controls.

*Check:* end-to-end test that all listed controls exist and act.

**EDT-05** **Canvas.**
- It shows **one Slide large**, centred, with the neighbouring Slides **peeking in dimmed** at both sides, so Cells crossing an edge visibly continue.
- **Prev/next arrows** beside the canvas and a **filmstrip** of Slide thumbnails below it navigate between Slides; clicking a thumbnail jumps there. ← / → also navigate.
- Slide edges are shown as thin lines on the canvas.
- A Collage or Story shows just its one Slide, with no filmstrip.

*Check:* in a 5-Slide Seamless Post, Slide 3 is large with parts of Slides 2 and 4 visible; the arrows and the filmstrip move between Slides.

**EDT-06** **"Preview as post"** opens a phone-sized overlay showing the Post as Instagram would: swipeable Slides at the Post's ratio, with dots. It honours the Grid Crop toggle on the first image. Escape or a close button closes it.
*Check:* the preview swipes through every Slide of a Carousel.

**EDT-07** **Grid Crop overlay.** A toggle (the top bar, or G) shades the parts of the **first** Slide that Instagram's 3:4 profile grid hides (a centred 3:4 crop). It shows in the canvas and in Preview as post, and is **off by default**. At 3:4 nothing is shaded; for a Story the toggle is disabled.
*Check:* at 1:1 the toggle shades 135 px-equivalent bands left and right of Slide 1; at 3:4 it shades nothing.

## Photos panel

**EDT-08** Importing adds photos to the Project's Photos panel: through the drop zone, the file picker, or dropping files anywhere on the workspace. A photo already in the Project (the same content hash) isn't added twice. Thumbnails appear as soon as each photo is decoded (PRF-03).
*Check:* importing the same file twice leaves one entry.

**EDT-09** The panel shows thumbnails, sorted by **capture date** (oldest first) by default. A placed photo has a badge; when it is used in more than one Cell, the badge shows the count ("×2"). The same photo may sit in several Cells.
*Check:* placing one photo in two Cells shows "×2".

**EDT-10** The panel is **reorderable by drag**, and a **Sort by date** button restores the default order. The order is saved in the Project (`panelOrder`) and is what Auto-fill follows.
*Check:* reordering, saving and reopening keeps the order.

**EDT-11** **Removing a photo from the Project:** Delete/Backspace on selected panel photos, or right-click → Remove. A placed photo is removed from all its Cells too. This is undoable.
*Check:* removing a photo used in two Cells empties both; undo restores both.

**EDT-12** **Multi-select** exists only in the Photos panel: Shift-click selects a range, Ctrl/Cmd-click toggles. A selection can be removed, or dragged as a group. A group dropped on a Cell fills that Cell, then the following **empty** Cells in Cell order (AUT-02); photos left over stay unplaced.
*Check:* dragging 3 selected photos onto the first Cell of an empty Grid 2×2 fills Cells 1–3.

There is no multi-select on the canvas. Styling is Layout-wide, and Text Boxes are selected one at a time.

## Placing and framing photos

**EDT-13** **Placing:** drag a photo from the panel onto a Cell, or click a photo and then click a Cell.
*Check:* both ways place the photo with default framing.

**EDT-14** **Moving photos between Cells** by drag:
- Cell → **filled** Cell: **swaps** the two photos.
- Cell → **empty** Cell: **moves** it.
- Cell → the Photos panel: **unplaces** it.
- Panel → **filled** Cell: **replaces** the Cell's photo, which goes back to unplaced (or, if it is used elsewhere too, its badge count drops by one).

Every move resets the moved photos' framing to `DEFAULT_FRAMING` (keeping `rotate90`).
*Check:* end-to-end tests of all four, including the framing reset.

**EDT-15** **Framing** a photo in its Cell:
- drag inside the Cell to **pan**;
- scroll to **zoom** around the pointer (zoom 1–10);
- **Rotate 90°** turns it clockwise;
- the **Straighten** slider sets −15°…+15°, and the photo zooms automatically so the Cell stays covered (RND-07);
- **Reset framing** (Ctrl/Cmd+0) restores `DEFAULT_FRAMING`, keeping `rotate90`;
- **double-click** empties the Cell (the photo goes back to unplaced).

*Check:* end-to-end tests of each; no gap ever appears in the Cell during pan or straighten.

## Layout editing

**EDT-16** Dividers between neighbouring Elements show a handle on hover and can be dragged (MOD-14), except at Slide edges in a Carousel. Selecting a Cell enables Split (row or column), Merge (choosing the neighbour: left, right, up or down, where one exists as a sibling) and Make Spacer in the inspector. Selecting a Spacer offers "Make Cell".
*Check:* each control acts as MOD-14 says; Merge offers only valid directions.

**EDT-17** **Styling:** clicking a Style Preset applies its values (TPL-09). Any control can then be tweaked. A tweak doesn't change the Preset; the inspector simply shows that no Preset matches.
*Check:* applying "Soft" then changing the gap leaves the other Soft values in place.

## Text Boxes

**EDT-18** **Text** (or T) adds a Text Box at the centre of the current Slide, with the text "Text", Inter 400, size 0.06, white, centred, no background box. Double-click edits the text in place; Delete removes the selected Text Box.
*Check:* end-to-end test: add, edit, delete.

**EDT-19** Dragging a Text Box moves it. The side handles change its width, and the text wraps. Size, font, weight, colour, alignment and background box are set in the inspector.
*Check:* narrowing a Text Box wraps its text onto more lines.

**EDT-20** **Snapping:** while dragging, a Text Box snaps (within 8 screen px) to the current Slide's vertical and horizontal centre lines and edges, and in a Seamless Carousel to Slide edges. Guides show while snapping. Holding Alt disables snapping. Arrow keys nudge by 1 export px (1/1080 Slide unit), or by 10 with Shift.
*Check:* dragging near the Slide centre snaps exactly to it; with Alt it doesn't.

**EDT-21** In a Carousel, a Text Box can't be dragged across a Slide edge; it stays within the Slide it is on. In a Seamless Carousel it may cross.
*Check:* dragging a Carousel Text Box toward the next Slide stops at the edge.

## Slides

**EDT-22** In the filmstrip, for both Carousel types:
- a **"+"** after the last thumbnail adds a Slide (MOD-17);
- right-click a thumbnail → **Delete Slide** removes it (MOD-18). In a Seamless Carousel, this is offered only on the last Slide.
- **Carousel only:** thumbnails can be **dragged to reorder** Slides.

The top bar's Slide count does the same as + and delete-last.
*Check:* end-to-end tests of each, including that a Seamless middle Slide has no Delete and can't be dragged.

**EDT-23** Filmstrip thumbnails re-render about **200 ms after** an edit gesture ends, not during it (PRF-07).
*Check:* during a divider drag, the filmstrip doesn't redraw.

## Templates tab

**EDT-24** The Templates tab lists the Templates for the Post's type and ratio as rendered thumbnails, each showing its photo count, ordered as TPL-11 says, with "My Templates" listed after the built-ins. Clicking a thumbnail applies the Template (TPL-05).
*Check:* end-to-end test of applying a Template from the tab.

**EDT-25** **Save as Template** (in the File menu and at the bottom of the Templates tab) asks for a name and saves the current Layout as a Template (TPL-13). A saved Template can be renamed and deleted from its thumbnail's right-click menu.
*Check:* a saved Template appears under My Templates after restarting the app.

## Undo and redo

**EDT-26** **Undo** (Ctrl/Cmd+Z) and **redo** (Ctrl/Cmd+Shift+Z, or Ctrl+Y on Windows and Linux) cover **every change to the Post or Project**: placing, moving and removing photos, importing, panel order, framing, dividers, split and merge, Spacers, styling, Text Boxes, Slides, Aspect Ratio, Template apply, Auto-fill and Clear photos. View state isn't covered: which Slide is shown, selection, tab, preview open or closed, Grid Crop toggle.
*Check:* for every listed action, an undo test restores the exact previous model.

**EDT-27** One finished gesture is one undo step: a whole drag, one click, one committed text edit. Scroll-zooms less than 500 ms apart merge into one step. History holds **100** steps and lives only in memory; it isn't saved in the Project and is cleared on open.
*Check:* a pan drag undoes in one step; three quick scroll-zooms undo in one step; step 101 drops step 1.

## Keyboard shortcuts

**EDT-28** The v1 shortcut set (Cmd on macOS, Ctrl elsewhere). The Help menu lists them all; there is no shortcut editor.

| Shortcut | Action |
|---|---|
| Ctrl/Cmd+N | New Post (goes to the start screen's three choices) |
| Ctrl/Cmd+O | Open… |
| Ctrl/Cmd+S | Save |
| Ctrl/Cmd+Shift+S | Save As… |
| Ctrl/Cmd+E | Export |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z, Ctrl+Y | Redo |
| ← / → | Previous / next Slide (when no Text Box is selected) |
| Delete / Backspace | Empty the selected Cell, or remove the selected Text Box or panel photos |
| Arrow keys (Text Box selected) | Nudge 1 px; with Shift, 10 px |
| T | New Text Box |
| G | Toggle the Grid Crop overlay |
| Ctrl/Cmd+0 | Reset the selected Cell's framing |
| Escape | Deselect; close a preview or dialog |

Single-key shortcuts are inactive while typing in a Text Box or field.
*Check:* end-to-end test for each shortcut; typing "t" into a Text Box doesn't add another one.

## Settings

**EDT-29** The Settings screen (app menu → Settings…) has exactly two settings:
- **Check for updates at startup:** on by default (DST-05).
- **Default export folder:** initially `Pictures/Picturesque`, with a folder picker (EXP-08).

Settings are stored in the app's data folder.
*Check:* both settings persist across restarts.

## Window and menus

**EDT-30** The app uses native menus: File (New, Open…, Open Recent, Save, Save As…, Save as Template…, Export…), Edit (Undo, Redo), View (Grid Crop, Preview as post) and Help (Keyboard shortcuts, How to get exports onto your phone, About, Third-party licences). On macOS, the app menu holds About, Settings… and Quit.
*Check:* every menu item works.

**EDT-31** The window title shows the Project name, plus a mark (•) when there are unsaved changes.
*Check:* editing a saved Project adds the mark; saving removes it.
