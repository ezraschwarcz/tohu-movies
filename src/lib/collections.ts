import { genresOf } from "@/lib/films";
import type { Film } from "@/lib/types";

/** Browse pages: one per genre (built from the films themselves, so a
 *  new genre gets a page by itself) and a few hand-made collections.
 *  To add a collection, add an entry here; films are listed by their
 *  page address, and any that are missing or hidden are skipped. */

export function genreSlug(genre: string): string {
  return genre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function allGenres(films: Film[]): { genre: string; slug: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const film of films) {
    for (const g of genresOf(film)) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, slug: genreSlug(genre), count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));
}

export function filmsInGenre(films: Film[], slug: string): { genre: string; films: Film[] } | null {
  const match = allGenres(films).find((g) => g.slug === slug);
  if (!match) return null;
  return {
    genre: match.genre,
    films: films.filter((f) => genresOf(f).includes(match.genre)),
  };
}

export type Collection = {
  slug: string;
  title: string;
  blurb: string;
  films: string[];
};

export const COLLECTIONS: Collection[] = [
  {
    slug: "true-stories",
    title: "Based on true stories",
    blurb: "Real people, real events: a coach who broke a barrier, a photographer in a war zone, and documentaries that let the facts do the talking.",
    films: ["from-the-rough", "1000-times-good-night", "mourning-son", "genius-on-hold", "farmland", "to-end-all-wars", "the-devils-violinist", "underdogs"],
  },
  {
    slug: "midnight-horror",
    title: "Midnight horror",
    blurb: "Cabins, curses and things that will not stay dead. Best watched late, with the lights off.",
    films: ["zombeavers", "hayride-2", "donner-pass", "jinn", "come-back-to-me", "the-man-in-the-orange-jacket"],
  },
  {
    slug: "family-movie-night",
    title: "Family movie night",
    blurb: "Films the whole house can watch together: adventures, talking toys and one very large dog.",
    films: ["lucky-dog", "monster-mutt", "the-lost-medallion", "toys-in-the-attic", "after-the-ball", "underdogs"],
  },
  {
    slug: "date-night",
    title: "Date night",
    blurb: "Fake engagements, old flames and weekends that go sideways. Romance with a sense of humor.",
    films: ["one-small-hitch", "after-the-ball", "three-night-stand", "you-may-not-kiss-the-bride", "jake-squared", "missing-william"],
  },
  {
    slug: "faces-you-know",
    title: "Faces you know",
    blurb: "Independent films with stars you will recognize: Taraji P. Henson, Juliette Binoche, Michael Jai White, Mila Kunis and more.",
    films: ["from-the-rough", "1000-times-good-night", "falcon-rising", "hell-and-back", "missing-william", "norman", "the-girl-in-the-book", "aftermath", "redemption-road", "the-challenger"],
  },
  {
    slug: "underdog-stories",
    title: "Underdog stories",
    blurb: "Losing teams, long odds and people who refuse to quit.",
    films: ["underdogs", "from-the-rough", "the-challenger", "108-stitches", "dance-off", "falcon-rising"],
  },
];

export function collectionFilms(films: Film[], collection: Collection): Film[] {
  const bySlug = new Map(films.map((f) => [f.slug, f]));
  return collection.films
    .map((slug) => bySlug.get(slug))
    .filter((f): f is Film => Boolean(f));
}
