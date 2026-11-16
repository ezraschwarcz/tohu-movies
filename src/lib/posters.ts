/** Films with official cover art in public/posters/<slug>.jpg (600px
 *  wide). The poster cards use these; wide placements (the hero,
 *  Continue watching, the player, share cards) keep using film stills.
 *
 *  To add art for a new film: put <slug>.jpg in public/posters and add
 *  the slug to this list. A film not listed here falls back to a
 *  hand-picked or automatic still with its title set over it. */
export const OFFICIAL_POSTERS: ReadonlySet<string> = new Set([
  "1000-times-good-night",
  "108-stitches",
  "a-stranger-in-paradise",
  "a-true-story",
  "after-the-ball",
  "aftermath",
  "apple-pie",
  "come-back-to-me",
  "dance-off",
  "donner-pass",
  "falcon-rising",
  "farmland",
  "friends-and-romans",
  "from-the-rough",
  "funeral-kings",
  "genius-on-hold",
  "hating-breitbart",
  "hayride-2",
  "hell-and-back",
  "in-my-sleep",
  "jake-squared",
  "jesus-people",
  "jinn",
  "karma-calling",
  "lloyd-the-conqueror",
  "loving-the-bad-man",
  "lucky-dog",
  "missing-william",
  "monster-mutt",
  "mourning-son",
  "norman",
  "northern-soul",
  "one-small-hitch",
  "radio-free-albemuth",
  "redemption-road",
  "samsara",
  "the-a-list",
  "the-challenger",
  "the-devils-violinist",
  "the-girl-in-the-book",
  "the-house-that-jack-built",
  "the-lost-medallion",
  "the-man-in-the-orange-jacket",
  "the-playroom",
  "the-sisterhood-of-night",
  "the-suicide-theory",
  "three-night-stand",
  "tiger-eyes",
  "to-end-all-wars",
  "tomorrow-when-the-war-began",
  "toys-in-the-attic",
  "treasure-guards",
  "underdogs",
  "you-may-not-kiss-the-bride",
  "zombeavers",
]);

export function officialPosterFor(slug: string): string | null {
  return OFFICIAL_POSTERS.has(slug) ? `/posters/${slug}.jpg` : null;
}

/** Where each poster's title sits, for the phone banner. On most
 *  phones the banner cannot show a whole poster and still fit the
 *  screen, so it trims one end: this says which end to keep.
 *  0 keeps the top, 50 the middle, 100 the bottom. Posters not listed
 *  keep the top, where most titles and faces are. Set from a review
 *  of all 55 posters on November 15, 2026. */
const POSTER_FOCUS_Y: Record<string, number> = {
  "108-stitches": 60,
  "a-stranger-in-paradise": 100,
  "a-true-story": 100,
  "aftermath": 100,
  "apple-pie": 100,
  "come-back-to-me": 100,
  "dance-off": 50,
  "from-the-rough": 50,
  "genius-on-hold": 100,
  "hating-breitbart": 100,
  "hayride-2": 50,
  "jake-squared": 100,
  "lloyd-the-conqueror": 100,
  "mourning-son": 100,
  "radio-free-albemuth": 100,
  "redemption-road": 100,
  "samsara": 100,
  "the-devils-violinist": 100,
  "the-girl-in-the-book": 60,
  "the-house-that-jack-built": 100,
  "the-lost-medallion": 100,
  "the-man-in-the-orange-jacket": 60,
  "the-playroom": 100,
  "the-sisterhood-of-night": 50,
  "tiger-eyes": 100,
  "to-end-all-wars": 60,
  "tomorrow-when-the-war-began": 100,
  "toys-in-the-attic": 100,
  "treasure-guards": 100,
  "zombeavers": 100,
};

export function posterFocusY(slug: string): number {
  return POSTER_FOCUS_Y[slug] ?? 0;
}

/** The cover art to show for a film: art uploaded from the admin page
 *  wins, then the built-in official cover art, else null (the caller
 *  falls back to a still from the film). */
export function coverArtFor(film: {
  slug: string;
  poster_url?: string | null;
}): string | null {
  return film.poster_url || officialPosterFor(film.slug);
}
