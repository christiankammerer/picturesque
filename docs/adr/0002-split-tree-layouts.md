# Layouts are split trees of Cells and Spacers

A Layout's geometry is a split tree: each node splits horizontally or vertically at a ratio, and each leaf is a Cell (one photo) or a Spacer (shows the background). The tree always fills the Post's canvas, so photos never overlap. Only Text Boxes float freely on top. We chose this because the editor allows adjusting, not freeform design. Dragging dividers, splitting and merging are trivial on a tree, and gaps stay uniform. Free rectangles would make those operations fragile. Every planned Template, including staggered looks, can be built from Cells plus Spacers. Decided in [Layout and Template model](https://github.com/christiankammerer/picturesque/issues/7).

## Consequences

- A plain Carousel's root is a fixed vertical split at every Slide edge, so no Cell can cross one. A Seamless Carousel's tree is unconstrained, and Slide edges are just cut lines laid over it.
- Overlapping or free-floating photos are deliberately impossible. Adding them later means a second, non-tree Element type, not loosening the tree.
