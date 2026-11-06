// SPDX-License-Identifier: GPL-3.0-or-later
//
// Post-level rules: Aspect Ratios (MOD-04…MOD-07) and new Posts.

import { newCellId } from './layout-ops.ts';
import {
  RATIO_HEIGHT,
  slideCountOf,
  type AspectRatio,
  type Layout,
  type LayoutStyle,
  type Post,
  type PostType,
} from './schema.ts';

/** MOD-04: the feed Aspect Ratios, for every Post type. */
export const FEED_ASPECT_RATIOS = ['1:1', '4:5', '3:4'] as const satisfies readonly AspectRatio[];

/** MOD-04: the Aspect Ratios a Post type may use. 9:16 (a Story) is Collage-only. */
export function aspectRatiosFor(type: PostType): AspectRatio[] {
  return type === 'collage' ? [...FEED_ASPECT_RATIOS, '9:16'] : [...FEED_ASPECT_RATIOS];
}

/** A Story is a Collage at 9:16 (MOD-01), not a type of its own. */
export function isStory(post: Pick<Post, 'type' | 'aspectRatio'>): boolean {
  return post.type === 'collage' && post.aspectRatio === '9:16';
}

/** MOD-05: a new Post defaults to 4:5; a new Story to 9:16. */
export const DEFAULT_ASPECT_RATIO: AspectRatio = '4:5';
export const STORY_ASPECT_RATIO: AspectRatio = '9:16';

/** MOD-02: a new Carousel or Seamless Carousel starts with 3 Slides. */
export const NEW_CAROUSEL_SLIDES = 3;

/** The "None" Style Preset (TPL-09): the style of a Post made without a Template. */
export const PLAIN_STYLE: LayoutStyle = {
  gap: 0,
  cornerRadius: 0,
  borderWidth: 0,
  borderColor: '#000000',
  background: '#ffffff',
};

export type NewPostKind = 'collage' | 'story' | 'carousel' | 'seamless';

/** A new, empty Post: one Cell per Slide, no Template. */
export function newPost(kind: NewPostKind): Post {
  const cell = () => ({ kind: 'cell' as const, id: newCellId() });
  let layout: Layout;
  switch (kind) {
    case 'collage':
    case 'story':
      layout = { postType: 'collage', root: cell() };
      break;
    case 'carousel':
      layout = { postType: 'carousel', slides: Array.from({ length: NEW_CAROUSEL_SLIDES }, cell) };
      break;
    case 'seamless': {
      const n = NEW_CAROUSEL_SLIDES;
      layout = {
        postType: 'seamless',
        slideCount: n,
        root: {
          kind: 'split',
          direction: 'row',
          sizes: Array.from({ length: n }, () => 1 / n),
          children: Array.from({ length: n }, cell),
        },
      };
      break;
    }
  }
  return {
    type: layout.postType,
    aspectRatio: kind === 'story' ? STORY_ASPECT_RATIO : DEFAULT_ASPECT_RATIO,
    layout,
    style: { ...PLAIN_STYLE },
    textBoxes: [],
  };
}

/**
 * MOD-07: changing the Aspect Ratio changes nothing else. The Layout, Text
 * Boxes and framing are kept as they are in Slide units; the renderer
 * re-covers every Cell.
 */
export function setAspectRatio(post: Post, aspectRatio: AspectRatio): Post {
  if (!aspectRatiosFor(post.type).includes(aspectRatio)) {
    throw new Error(`${aspectRatio} is not allowed for a ${post.type}`);
  }
  return { ...post, aspectRatio };
}

export function slideCount(post: Post): number {
  return slideCountOf(post.layout);
}

/** RND-03: the canvas size in px at a scale (px per Slide width). */
export function canvasPixelSize(post: Pick<Post, 'aspectRatio' | 'layout'>, scale: number): { width: number; height: number } {
  return {
    width: slideCountOf(post.layout) * scale,
    height: Math.round(scale * RATIO_HEIGHT[post.aspectRatio]),
  };
}
