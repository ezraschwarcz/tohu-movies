import { SITE_URL } from './config';
import { supabase } from './supabase';

export type Film = {
  slug: string;
  title: string;
  year: number;
  genre: string;
  director: string;
  cast_text: string;
  rating: string;
  runtime_minutes: number;
  synopsis: string;
  warnings: string;
  playback_id: string;
  created_at: string;
  poster_url?: string | null;
};

let cache: { at: number; films: Film[] } | null = null;

/** Every film on Tohu. Kept for a minute so moving between screens
 *  does not refetch. `select('*')` so new columns (such as uploaded
 *  cover art) arrive without an app update. */
export async function getFilms(force = false): Promise<Film[]> {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.films;
  const { data, error } = await supabase
    .from('films')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const films = (data ?? []) as Film[];
  cache = { at: Date.now(), films };
  return films;
}

export async function getFilm(slug: string): Promise<Film | null> {
  const films = await getFilms();
  return films.find((f) => f.slug === slug) ?? null;
}

/** slug -> views in the last 30 days. Empty if unavailable. */
export async function getViewCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('film_view_counts', { p_days: 30 });
  if (error || !Array.isArray(data)) return {};
  const out: Record<string, number> = {};
  for (const row of data as { film_slug: string; views: number }[]) {
    out[row.film_slug] = Number(row.views) || 0;
  }
  return out;
}

export function streamUrl(film: Film): string {
  return `https://stream.mux.com/${film.playback_id}.m3u8`;
}

/** A wide frame from the film, for banners and the player's poster. */
export function stillUrl(film: Film, width = 1200): string {
  return `https://image.mux.com/${film.playback_id}/thumbnail.jpg?width=${width}&time=60`;
}

/** Cover art candidates, best first. The poster component tries each
 *  in turn: uploaded art, the website's official art, then a tall crop
 *  of a frame from the film. */
export function posterCandidates(film: Film): string[] {
  const list: string[] = [];
  if (film.poster_url) list.push(film.poster_url);
  list.push(`${SITE_URL}/posters/${film.slug}.jpg`);
  list.push(
    `https://image.mux.com/${film.playback_id}/thumbnail.jpg?width=400&height=600&fit_mode=smartcrop&time=60`,
  );
  return list;
}

export function genresOf(film: Film): string[] {
  return film.genre
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
}

export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function filmUrl(film: Film): string {
  return `${SITE_URL}/films/${film.slug}`;
}
