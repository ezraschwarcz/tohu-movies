import type { Film } from "./types";

/** Poster art per film: a frame hand-picked to work in a tall 2:3
 *  poster, and where to center the crop across the frame.
 *
 *    slug: [time in seconds, horizontal focus 0-100]
 *
 *  The focus is the point of the wide frame the poster centers on
 *  (0 = far left, 50 = middle, 100 = far right). To change a film's
 *  poster, change its two numbers. A film with no entry here (one
 *  added later) falls back to an automatic crop until it gets one.
 *  Chosen November 15, 2026 by reviewing six candidate frames from
 *  each of the 55 films. */
export const POSTER_ART: Record<string, [number, number]> = {
  "jinn": [2328, 55],
  "zombeavers": [739, 50],
  "dance-off": [451, 50],
  "aftermath": [787, 60],
  "after-the-ball": [490, 48],
  "the-house-that-jack-built": [845, 55],
  "the-man-in-the-orange-jacket": [1150, 35],
  "the-sisterhood-of-night": [989, 38],
  "one-small-hitch": [3465, 30],
  "the-a-list": [3531, 50],
  "apple-pie": [1848, 62],
  "the-girl-in-the-book": [845, 55],
  "from-the-rough": [3234, 50],
  "the-suicide-theory": [1555, 70],
  "lucky-dog": [2112, 50],
  "friends-and-romans": [941, 45],
  "the-challenger": [2280, 80],
  "mourning-son": [1046, 45],
  "hell-and-back": [3612, 50],
  "108-stitches": [1928, 55],
  "jake-squared": [485, 45],
  "the-playroom": [2706, 60],
  "a-stranger-in-paradise": [2739, 50],
  "redemption-road": [3168, 55],
  "tiger-eyes": [2232, 45],
  "toys-in-the-attic": [749, 40],
  "the-lost-medallion": [941, 50],
  "falcon-rising": [1636, 60],
  "funeral-kings": [816, 35],
  "come-back-to-me": [922, 55],
  "jesus-people": [1426, 65],
  "underdogs": [998, 62],
  "1000-times-good-night": [1133, 45],
  "treasure-guards": [3906, 55],
  "to-end-all-wars": [2904, 55],
  "tomorrow-when-the-war-began": [2496, 50],
  "three-night-stand": [3864, 54],
  "the-devils-violinist": [586, 30],
  "samsara": [490, 48],
  "radio-free-albemuth": [2664, 45],
  "monster-mutt": [422, 50],
  "norman": [475, 45],
  "karma-calling": [2136, 45],
  "you-may-not-kiss-the-bride": [1604, 50],
  "lloyd-the-conqueror": [1588, 55],
  "in-my-sleep": [1008, 50],
  "northern-soul": [490, 55],
  "hating-breitbart": [2232, 50],
  "loving-the-bad-man": [3432, 35],
  "genius-on-hold": [437, 50],
  "farmland": [3234, 62],
  "hayride-2": [883, 45],
  "missing-william": [874, 28],
  "donner-pass": [2064, 45],
  "a-true-story": [922, 55],
};

/** The poster image URL and crop focus for a film. */
export function posterArtFor(film: Film): { src: string; focus: string } {
  const art = POSTER_ART[film.slug];
  if (art) {
    return {
      src: `https://image.mux.com/${film.playback_id}/thumbnail.jpg?height=720&time=${art[0]}`,
      focus: `${art[1]}% 50%`,
    };
  }
  // No hand-picked frame yet: let Mux crop around the subject.
  return {
    src: `https://image.mux.com/${film.playback_id}/thumbnail.jpg?width=480&height=720&fit_mode=smartcrop&time=900`,
    focus: "50% 50%",
  };
}
