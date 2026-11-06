// Picturesque v1: the Post model and the files that store it.
// Normative. See 02-model.md for the rules these types must obey, and
// 07-project-files.md for how they are stored. The app defines the same
// shapes once as a zod schema and derives its TypeScript types from it.

// ---------- geometry ----------
//
// The canvas is measured in Slide units:
//   x: 0 .. slideCount (one unit = one Slide width)
//   y: 0 .. 1          (one unit = one Slide height)
// A Collage or Story has slideCount = 1.
// Lengths that must look the same on both axes (gap, border, corner radius,
// font size) are expressed as a fraction of the Slide WIDTH.

export type AspectRatio = '1:1' | '4:5' | '3:4' | '9:16';

/** Slide height divided by Slide width. */
export const RATIO_HEIGHT: Record<AspectRatio, number> = {
  '1:1': 1,
  '4:5': 1.25,
  '3:4': 4 / 3,
  '9:16': 16 / 9,
};

export type PostType = 'collage' | 'carousel' | 'seamless';

// ---------- the split tree ----------

/** A node of the split tree. The tree always fills its whole area. */
export type LayoutNode = SplitNode | CellNode | SpacerNode;

export interface SplitNode {
  kind: 'split';
  /** 'row': children side by side, left to right.
   *  'column': children stacked, top to bottom. */
  direction: 'row' | 'column';
  /** One size per child, as a fraction of this node's extent along
   *  `direction`. Each size is > 0, and the sizes sum to 1 (within 1e-9). */
  sizes: number[];
  /** At least 2 children. */
  children: LayoutNode[];
}

export interface CellNode {
  kind: 'cell';
  /** Unique within the Post; stable across edits. */
  id: string;
  /** Absent: the Cell is empty. */
  photo?: PlacedPhoto;
}

export interface SpacerNode {
  kind: 'spacer';
}

export interface PlacedPhoto {
  /** A key of Project.photos (the photo's content hash). */
  photoId: string;
  framing: Framing;
}

export interface Framing {
  /** >= 1. At 1 the photo just covers the Cell ("cover"). Maximum 10. */
  zoom: number;
  /** The point of the photo shown at the Cell's centre, in the photo's
   *  rotated coordinate space, 0..1 on each axis. 0.5/0.5 = centred.
   *  The renderer clamps it so the Cell always stays covered. */
  focusX: number;
  focusY: number;
  /** Quarter turns, clockwise. */
  rotate90: 0 | 90 | 180 | 270;
  /** Fine straightening in degrees, -15..15, clockwise positive. */
  straighten: number;
}

export const DEFAULT_FRAMING: Framing = {
  zoom: 1, focusX: 0.5, focusY: 0.5, rotate90: 0, straighten: 0,
};

// ---------- Layout ----------

/**
 * The geometry of a Post.
 * - collage:  `root` covers the one Slide.
 * - carousel: `slides` has one subtree per Slide; Slide i covers x = i..i+1.
 *             The Slide edges are fixed: no Element ever crosses one.
 * - seamless: `root` covers the whole canvas; Slide edges are cut lines laid
 *             over it, and Elements may cross them.
 */
export type Layout =
  | { postType: 'collage'; root: LayoutNode }
  | { postType: 'carousel'; slides: LayoutNode[] }
  | { postType: 'seamless'; slideCount: number; root: LayoutNode };

export interface LayoutStyle {
  /** Space between neighbouring Elements and around the outer edge. */
  gap: number;          // fraction of Slide width, 0..0.15
  cornerRadius: number; // fraction of Slide width, 0..0.15
  borderWidth: number;  // fraction of Slide width, 0..0.05
  borderColor: Color;
  background: Color;
}

/** '#rrggbb', lower case, sRGB. */
export type Color = string;

// ---------- Text Boxes ----------

export interface TextBox {
  id: string;
  text: string;          // may contain '\n'
  /** Top-left corner and width, in canvas Slide units. The height follows
   *  from the wrapped text. */
  x: number;
  y: number;
  width: number;
  font: FontRef;
  /** Font size as a fraction of Slide width. */
  size: number;          // 0.01..0.3
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  color: Color;
  align: 'left' | 'center' | 'right';
  /** Optional box drawn behind the text. */
  background?: { color: Color; opacity: number /* 0..1 */; padding: number /* fraction of Slide width */ };
}

export interface FontRef {
  family: string;
  source: 'bundled' | 'system';
}

// ---------- Post ----------

export interface Post {
  type: PostType;
  aspectRatio: AspectRatio;  // '9:16' only when type === 'collage' (a Story)
  layout: Layout;            // layout.postType === type
  style: LayoutStyle;
  /** Drawn above all Cells, in array order (later = on top). */
  textBoxes: TextBox[];
  /** Display only: which Template this Post was made from. */
  sourceTemplate?: { id: string; name: string; builtIn: boolean };
}

// ---------- Project file (post.json inside a .picturesque zip) ----------

export interface ProjectFile {
  formatVersion: 1;
  /** The app version that wrote the file, e.g. '0.1.0'. Informational. */
  appVersion: string;
  /** Project name; used as the export file name. */
  name: string;
  post: Post;
  /** Every photo in the Project, keyed by photoId. */
  photos: Record<string, PhotoMeta>;
  /** Photos-panel order: every photoId exactly once. */
  panelOrder: string[];
}

export interface PhotoMeta {
  /** Lower-case hex SHA-256 of the original file's bytes. Equals the key. */
  id: string;
  /** Stored at photos/<id>.<ext> inside the zip. */
  ext: 'jpg' | 'png' | 'webp' | 'heic';
  /** Original file name, for display. */
  originalName: string;
  /** ISO 8601. From EXIF DateTimeOriginal, else the file's modification time. */
  captureDate: string;
  /** Pixel size after applying the EXIF orientation. */
  width: number;
  height: number;
}

// ---------- Saved Template (one JSON file in the app's data folder) ----------

export interface SavedTemplateFile {
  formatVersion: 1;
  id: string;            // random UUID
  name: string;
  /** Which Post type it makes; 'collage' includes Stories. */
  postType: PostType;
  /** Fixed for saved Templates. */
  slideCount: number;
  preferredAspectRatio: AspectRatio;
  /** Same shape as Post.layout, with every Cell's `photo` removed. */
  layout: Layout;
  style: LayoutStyle;
  /** Their `text` is placeholder text. */
  textBoxes: TextBox[];
  createdAt: string;     // ISO 8601
}
