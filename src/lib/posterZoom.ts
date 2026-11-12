// Letterbox removal for poster stills, measured Nov 11, 2026.
//
// Some films were delivered as a widescreen (about 2.35:1) picture
// letterboxed inside a 16:9 frame, so their Mux stills carry solid
// black bars at the top and bottom. Shown in a 16:9 card (or the
// portrait mobile hero) those stills look shorter than the others,
// with blank black spacing above and below the picture.
//
// The bars were measured per film by scanning the actual Mux still
// (width 800, at the film's thumbTime) for solid-black rows at the
// top and bottom edges. Only films with matching bars on BOTH edges
// are listed; a dark opening scene is not a letterbox bar and is
// left alone. The zoom is 1 / (1 - top bar - bottom bar), so scaling
// the still by this amount pushes exactly the bars out of frame and
// the picture fills the card like every other film. Films not listed
// get zoom 1 (no change).
export const POSTER_ZOOM: Record<string, number> = {
  "jinn": 1.35,
  "aftermath": 1.27,
  "the-man-in-the-orange-jacket": 1.35,
  "the-sisterhood-of-night": 1.35,
  "from-the-rough": 1.35,
  "the-suicide-theory": 1.35,
  "the-lost-medallion": 1.35,
  "funeral-kings": 1.13,
  // Top scan reads darker than the bottom (a dark scene at the still
  // moment), so this uses the smaller, bottom bar on both sides.
  "come-back-to-me": 1.31,
  "1000-times-good-night": 1.32,
  "the-devils-violinist": 1.32,
  "samsara": 1.35,
  "karma-calling": 1.24,
  "missing-william": 1.32,
  "a-true-story": 1.2,
};

export function posterZoomFor(slug: string): number {
  return POSTER_ZOOM[slug] ?? 1;
}
