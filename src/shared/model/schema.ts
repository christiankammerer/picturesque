// SPDX-License-Identifier: GPL-3.0-or-later
//
// The Post model and the files that store it, as a zod schema.
// This is the one definition of the format (PRJ-10): the TypeScript types
// used across the app are inferred from it. It mirrors docs/spec/schema.ts;
// the rules of docs/spec/02-model.md that span several fields (sizes summing
// to 1, minimum leaf size, unique ids…) are enforced by the refinements below.

import { z } from 'zod';
import { leafRects, MIN_LEAF_SIZE, SIZE_SUM_TOLERANCE } from './geometry.ts';

// ---------- primitives ----------

export const AspectRatioSchema = z.enum(['1:1', '4:5', '3:4', '9:16']);
export const PostTypeSchema = z.enum(['collage', 'carousel', 'seamless']);

/** '#rrggbb', lower case, sRGB. */
export const ColorSchema = z.string().regex(/^#[0-9a-f]{6}$/, 'expected a lower-case #rrggbb colour');

export const MIN_SLIDES = 2;
export const MAX_SLIDES = 20;

// ---------- the split tree ----------

export const FramingSchema = z.object({
  zoom: z.number().min(1).max(10),
  focusX: z.number().min(0).max(1),
  focusY: z.number().min(0).max(1),
  rotate90: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  straighten: z.number().min(-15).max(15),
});

export const PlacedPhotoSchema = z.object({
  photoId: z.string().min(1),
  framing: FramingSchema,
});

export const CellNodeSchema = z.object({
  kind: z.literal('cell'),
  id: z.string().min(1),
  photo: PlacedPhotoSchema.optional(),
});

export const SpacerNodeSchema = z.object({
  kind: z.literal('spacer'),
});

export const SplitNodeSchema = z.object({
  kind: z.literal('split'),
  direction: z.enum(['row', 'column']),
  sizes: z.array(z.number().gt(0)),
  get children(): z.ZodArray<typeof LayoutNodeSchema> {
    return z.array(LayoutNodeSchema).min(2, 'a split has at least 2 children');
  },
});

export const LayoutNodeSchema = z.discriminatedUnion('kind', [
  SplitNodeSchema,
  CellNodeSchema,
  SpacerNodeSchema,
]);

// ---------- Layout ----------

export const LayoutSchema = z.discriminatedUnion('postType', [
  z.object({ postType: z.literal('collage'), root: LayoutNodeSchema }),
  z.object({
    postType: z.literal('carousel'),
    slides: z.array(LayoutNodeSchema).min(MIN_SLIDES).max(MAX_SLIDES),
  }),
  z.object({
    postType: z.literal('seamless'),
    slideCount: z.number().int().min(MIN_SLIDES).max(MAX_SLIDES),
    root: LayoutNodeSchema,
  }),
]);

export const LayoutStyleSchema = z.object({
  gap: z.number().min(0).max(0.15),
  cornerRadius: z.number().min(0).max(0.15),
  borderWidth: z.number().min(0).max(0.05),
  borderColor: ColorSchema,
  background: ColorSchema,
});

// ---------- Text Boxes ----------

export const FontRefSchema = z.object({
  family: z.string().min(1),
  source: z.enum(['bundled', 'system']),
});

export const FontWeightSchema = z.union([
  z.literal(100), z.literal(200), z.literal(300), z.literal(400), z.literal(500),
  z.literal(600), z.literal(700), z.literal(800), z.literal(900),
]);

export const TextBoxSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().gt(0),
  font: FontRefSchema,
  size: z.number().min(0.01).max(0.3),
  weight: FontWeightSchema,
  color: ColorSchema,
  align: z.enum(['left', 'center', 'right']),
  background: z
    .object({
      color: ColorSchema,
      opacity: z.number().min(0).max(1),
      padding: z.number().min(0),
    })
    .optional(),
});

// ---------- Post ----------

const PostObjectSchema = z.object({
  type: PostTypeSchema,
  aspectRatio: AspectRatioSchema,
  layout: LayoutSchema,
  style: LayoutStyleSchema,
  textBoxes: z.array(TextBoxSchema),
  sourceTemplate: z
    .object({ id: z.string(), name: z.string(), builtIn: z.boolean() })
    .optional(),
});

export const PostSchema = PostObjectSchema.superRefine((post, ctx) => {
  checkPost(post as Post, ctx, []);
});

// ---------- Project file (post.json inside a .picturesque zip) ----------

export const PhotoMetaSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/, 'expected a lower-case hex SHA-256'),
  ext: z.enum(['jpg', 'png', 'webp', 'heic']),
  originalName: z.string(),
  captureDate: z.iso.datetime({ offset: true, local: true }),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const CURRENT_FORMAT_VERSION = 1;

export const ProjectFileSchema = z
  .object({
    formatVersion: z.literal(CURRENT_FORMAT_VERSION),
    appVersion: z.string(),
    name: z.string(),
    post: PostObjectSchema,
    photos: z.record(z.string(), PhotoMetaSchema),
    panelOrder: z.array(z.string()),
  })
  .superRefine((file, ctx) => {
    checkPost(file.post as Post, ctx, ['post']);

    for (const [key, meta] of Object.entries(file.photos)) {
      if (meta.id !== key) {
        ctx.addIssue({ code: 'custom', path: ['photos', key, 'id'], message: 'photo id must equal its key' });
      }
    }
    const seen = new Set<string>();
    file.panelOrder.forEach((id, i) => {
      if (!(id in file.photos)) {
        ctx.addIssue({ code: 'custom', path: ['panelOrder', i], message: `unknown photo ${id}` });
      }
      if (seen.has(id)) {
        ctx.addIssue({ code: 'custom', path: ['panelOrder', i], message: `photo ${id} listed twice` });
      }
      seen.add(id);
    });
    for (const id of Object.keys(file.photos)) {
      if (!seen.has(id)) {
        ctx.addIssue({ code: 'custom', path: ['panelOrder'], message: `photo ${id} missing from panelOrder` });
      }
    }
    for (const cell of cellsOf(file.post.layout as Layout)) {
      if (cell.photo && !(cell.photo.photoId in file.photos)) {
        ctx.addIssue({
          code: 'custom',
          path: ['post', 'layout'],
          message: `Cell ${cell.id} references unknown photo ${cell.photo.photoId}`,
        });
      }
    }
  });

// ---------- Saved Template ----------

export const SavedTemplateFileSchema = z
  .object({
    formatVersion: z.literal(CURRENT_FORMAT_VERSION),
    id: z.string().min(1),
    name: z.string(),
    postType: PostTypeSchema,
    slideCount: z.number().int().min(1).max(MAX_SLIDES),
    preferredAspectRatio: AspectRatioSchema,
    layout: LayoutSchema,
    style: LayoutStyleSchema,
    textBoxes: z.array(TextBoxSchema),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .superRefine((tpl, ctx) => {
    const post: Post = {
      type: tpl.postType,
      aspectRatio: tpl.preferredAspectRatio,
      layout: tpl.layout as Layout,
      style: tpl.style,
      textBoxes: tpl.textBoxes,
    };
    checkPost(post, ctx, []);
    if (slideCountOf(tpl.layout as Layout) !== tpl.slideCount) {
      ctx.addIssue({ code: 'custom', path: ['slideCount'], message: 'slideCount does not match the layout' });
    }
    for (const cell of cellsOf(tpl.layout as Layout)) {
      if (cell.photo) {
        ctx.addIssue({ code: 'custom', path: ['layout'], message: 'a saved Template holds no photos' });
      }
    }
  });

// ---------- inferred types ----------

export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type PostType = z.infer<typeof PostTypeSchema>;
export type Color = z.infer<typeof ColorSchema>;
export type Framing = z.infer<typeof FramingSchema>;
export type PlacedPhoto = z.infer<typeof PlacedPhotoSchema>;
export type CellNode = z.infer<typeof CellNodeSchema>;
export type SpacerNode = z.infer<typeof SpacerNodeSchema>;
export type SplitNode = z.infer<typeof SplitNodeSchema>;
export type LayoutNode = z.infer<typeof LayoutNodeSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type LayoutStyle = z.infer<typeof LayoutStyleSchema>;
export type FontRef = z.infer<typeof FontRefSchema>;
export type TextBox = z.infer<typeof TextBoxSchema>;
export type Post = z.infer<typeof PostObjectSchema>;
export type PhotoMeta = z.infer<typeof PhotoMetaSchema>;
export type ProjectFile = z.infer<typeof ProjectFileSchema>;
export type SavedTemplateFile = z.infer<typeof SavedTemplateFileSchema>;

// ---------- constants from schema.ts ----------

/** Slide height divided by Slide width. */
export const RATIO_HEIGHT: Record<AspectRatio, number> = {
  '1:1': 1,
  '4:5': 1.25,
  '3:4': 4 / 3,
  '9:16': 16 / 9,
};

export const DEFAULT_FRAMING: Framing = {
  zoom: 1, focusX: 0.5, focusY: 0.5, rotate90: 0, straighten: 0,
};

// ---------- helpers used by the refinements ----------

/** Number of Slides of a Layout (1 for a Collage). */
export function slideCountOf(layout: Layout): number {
  switch (layout.postType) {
    case 'collage': return 1;
    case 'carousel': return layout.slides.length;
    case 'seamless': return layout.slideCount;
  }
}

/** Every Cell of a Layout, in tree order (Slide by Slide for a Carousel). */
export function cellsOf(layout: Layout): CellNode[] {
  const out: CellNode[] = [];
  const walk = (node: LayoutNode): void => {
    if (node.kind === 'cell') out.push(node);
    else if (node.kind === 'split') node.children.forEach(walk);
  };
  if (layout.postType === 'carousel') layout.slides.forEach(walk);
  else walk(layout.root);
  return out;
}

type Ctx = z.RefinementCtx;

function checkPost(post: Post, ctx: Ctx, base: (string | number)[]): void {
  const at = (...p: (string | number)[]) => [...base, ...p];

  // MOD-01 / MOD-04: the Layout matches the type; 9:16 only for a Collage (Story).
  if (post.layout.postType !== post.type) {
    ctx.addIssue({ code: 'custom', path: at('layout', 'postType'), message: 'layout.postType must equal type' });
    return;
  }
  if (post.aspectRatio === '9:16' && post.type !== 'collage') {
    ctx.addIssue({ code: 'custom', path: at('aspectRatio'), message: '9:16 is only allowed for a Collage (Story)' });
  }

  // MOD-09: sizes match children and sum to 1.
  const checkTree = (node: LayoutNode, path: (string | number)[]): void => {
    if (node.kind !== 'split') return;
    if (node.sizes.length !== node.children.length) {
      ctx.addIssue({ code: 'custom', path: at(...path, 'sizes'), message: 'one size per child' });
    }
    const sum = node.sizes.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > SIZE_SUM_TOLERANCE) {
      ctx.addIssue({ code: 'custom', path: at(...path, 'sizes'), message: `sizes sum to ${sum}, not 1` });
    }
    node.children.forEach((c, i) => checkTree(c, [...path, 'children', i]));
  };
  if (post.layout.postType === 'carousel') {
    post.layout.slides.forEach((s, i) => checkTree(s, ['layout', 'slides', i]));
  } else {
    checkTree(post.layout.root, ['layout', 'root']);
  }
  // The geometry below needs one size per child; stop if that doesn't hold.
  const sizesConsistent = (node: LayoutNode): boolean =>
    node.kind !== 'split' ||
    (node.sizes.length === node.children.length && node.children.every(sizesConsistent));
  const treesOk =
    post.layout.postType === 'carousel'
      ? post.layout.slides.every(sizesConsistent)
      : sizesConsistent(post.layout.root);
  if (!treesOk) return;

  // MOD-12: every leaf at least MIN_LEAF_SIZE Slide units on both axes.
  for (const leaf of leafRects(post.layout)) {
    const w = leaf.rect.x1 - leaf.rect.x0;
    const h = leaf.rect.y1 - leaf.rect.y0;
    if (w < MIN_LEAF_SIZE - SIZE_SUM_TOLERANCE || h < MIN_LEAF_SIZE - SIZE_SUM_TOLERANCE) {
      ctx.addIssue({
        code: 'custom',
        path: at('layout'),
        message: `a leaf is ${w.toFixed(4)} × ${h.toFixed(4)} Slide units; the minimum is ${MIN_LEAF_SIZE}`,
      });
    }
  }

  // MOD-13: Cell ids unique within the Post. Text Box ids too.
  const ids = new Set<string>();
  for (const cell of cellsOf(post.layout)) {
    if (ids.has(cell.id)) {
      ctx.addIssue({ code: 'custom', path: at('layout'), message: `duplicate Cell id ${cell.id}` });
    }
    ids.add(cell.id);
  }
  const textIds = new Set<string>();
  post.textBoxes.forEach((tb, i) => {
    if (textIds.has(tb.id)) {
      ctx.addIssue({ code: 'custom', path: at('textBoxes', i, 'id'), message: `duplicate Text Box id ${tb.id}` });
    }
    textIds.add(tb.id);
  });
}
