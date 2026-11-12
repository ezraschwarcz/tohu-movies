// Poster still times (seconds) per film, from the live site FILMS array.
// This is a presentation choice (which frame to use as the poster), not film data.
// The films themselves come from Supabase at runtime.
export const THUMB_TIMES: Record<string, number> = {
  "jinn": 90,
  "zombeavers": 150,
  "dance-off": 200,
  "aftermath": 240,
  "after-the-ball": 300,
  "the-house-that-jack-built": 350,
  "the-man-in-the-orange-jacket": 1800,
  "the-sisterhood-of-night": 350,
  "one-small-hitch": 350,
  "the-a-list": 600,
  "apple-pie": 1800,
  "the-girl-in-the-book": 3600,
  "from-the-rough": 600,
  "the-suicide-theory": 600,
  "lucky-dog": 600,
  "friends-and-romans": 1500,
  "the-challenger": 1200,
  "mourning-son": 300,
  "hell-and-back": 600,
  "108-stitches": 900,
  "jake-squared": 960,
  "the-playroom": 840,
  "a-stranger-in-paradise": 1020,
  "redemption-road": 780,
  "tiger-eyes": 900,
  "toys-in-the-attic": 720,
  "the-lost-medallion": 1080,
  "falcon-rising": 900,
  "funeral-kings": 840,
  "come-back-to-me": 960,
  "jesus-people": 780,
  "underdogs": 1020,
  "1000-times-good-night": 900,
  "treasure-guards": 840,
  "to-end-all-wars": 1080,
  "tomorrow-when-the-war-began": 960,
  "three-night-stand": 900,
  "the-devils-violinist": 1020,
  "samsara": 900,
  "radio-free-albemuth": 960,
  "monster-mutt": 780,
  "norman": 900,
  "karma-calling": 840,
  "you-may-not-kiss-the-bride": 960,
  "lloyd-the-conqueror": 900,
  "in-my-sleep": 1080,
  "northern-soul": 1140,
  "hating-breitbart": 840,
  "loving-the-bad-man": 960,
  "genius-on-hold": 900,
  "farmland": 720,
  "hayride-2": 960,
  "missing-william": 900,
  "donner-pass": 840,
  // 3600, not 960: the 960s frame has its subject off-center left, so
  // the mobile portrait hero crop cut his face at the left edge. The
  // 3600s frame (two people on a street, both fully in frame) crops
  // cleanly to 2:3. Changed Nov 11, 2026.
  "a-true-story": 3600,
};

export function thumbTimeFor(slug: string): number {
  return THUMB_TIMES[slug] ?? 900;
}