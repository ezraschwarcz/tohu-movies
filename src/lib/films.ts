import { unstable_cache } from "next/cache";
import { createSupabaseClient } from "./supabase";
import { thumbTimeFor } from "./thumbTimes";
import type { Film, RatingsRecord } from "./types";

/** How often the film list, a film page, and the ratings are revalidated
 *  (seconds). A film added to Supabase appears on the site within this
 *  window; a brand-new film page renders on demand on first visit. */
export const REVALIDATE_SECONDS = 60;

const FILM_COLUMNS =
  "slug,title,year,genre,director,cast_text,rating,runtime_minutes,synopsis,warnings,playback_id,created_at";

/** All films, in the order they were added (created_at ascending). This
 *  order is the catalog order: the hero and the default sort use it. */
export const getFilms = unstable_cache(
  async (): Promise<Film[]> => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("films")
      .select(FILM_COLUMNS)
      .order("created_at", { ascending: true });
    if (error) {
      throw new Error(`Supabase films query failed: ${error.message}`);
    }
    return (data ?? []) as Film[];
  },
  ["tohu-films"],
  { revalidate: REVALIDATE_SECONDS, tags: ["films"] },
);

/** One film by slug. Cached per slug, so a film added later still renders
 *  on its first visit (a cache miss fetches it fresh). */
export const getFilmBySlug = unstable_cache(
  async (slug: string): Promise<Film | null> => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("films")
      .select(FILM_COLUMNS)
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      throw new Error(`Supabase film query failed: ${error.message}`);
    }
    return (data ?? null) as Film | null;
  },
  ["tohu-film"],
  { revalidate: REVALIDATE_SECONDS, tags: ["films"] },
);

/** Shared ratings: film slug -> average and count. Computed from the
 *  ratings table (film_slug, stars) on the server. */
export const getRatings = unstable_cache(
  async (): Promise<RatingsRecord> => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("ratings")
      .select("film_slug,stars");
    if (error) {
      throw new Error(`Supabase ratings query failed: ${error.message}`);
    }
    const totals = new Map<string, { total: number; count: number }>();
    for (const row of data ?? []) {
      const cur = totals.get(row.film_slug) ?? { total: 0, count: 0 };
      cur.total += row.stars;
      cur.count += 1;
      totals.set(row.film_slug, cur);
    }
    const out: RatingsRecord = {};
    for (const [slug, { total, count }] of totals) {
      out[slug] = { average: total / count, count };
    }
    return out;
  },
  ["tohu-ratings"],
  { revalidate: REVALIDATE_SECONDS, tags: ["ratings"] },
);

/** Mux HLS stream for a film. */
export function muxStreamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/** Mux poster still for a film, at its chosen still time. */
export function muxStillUrl(
  playbackId: string,
  timeSeconds: number,
  width = 800,
): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${width}&time=${timeSeconds}`;
}

export function posterUrl(film: Film, width = 800): string {
  return muxStillUrl(film.playback_id, thumbTimeFor(film.slug), width);
}

/** A film's main genres: the first two of its comma-separated genre list,
 *  matching the live site's "up to 2 main genres" pattern. */
export function genresOf(film: Film): string[] {
  return film.genre
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 2);
}

/** Genre chips with counts, most films first, ties alphabetical. */
export function genreChips(films: Film[]): { genre: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const film of films) {
    for (const g of genresOf(film)) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));
}

export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function durationSeconds(film: Film): number {
  return film.runtime_minutes * 60;
}
