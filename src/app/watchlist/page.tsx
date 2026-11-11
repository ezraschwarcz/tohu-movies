import Link from "next/link";
import { getRatings } from "@/lib/films";
import { createServerSupabase, getServerAuth } from "@/lib/supabase/server";
import { embeddedOne } from "@/lib/types";
import type { Film } from "@/lib/types";
import FilmCard from "@/components/FilmCard";

/** My watchlist: the signed-in user's saved films, most recently saved
 *  first. Signed-out visitors get a prompt to sign in (watching stays
 *  free; only the list needs an account). This page is dynamic: it reads
 *  the session from the request's cookies. */
export const dynamic = "force-dynamic";

type WatchlistRow = {
  film_slug: string;
  created_at: string;
  films: Film | null;
};

export default async function WatchlistPage() {
  const { userId } = await getServerAuth();

  if (!userId) {
    return (
      <div className="wrap">
        <div className="not-found">
          <h1>My watchlist</h1>
          <p>
            <Link href="/login?next=/watchlist">Sign in</Link> to see the
            films you saved.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabase();
  const [{ data: rows }, ratings] = await Promise.all([
    supabase
      .from("watchlist")
      .select("film_slug,created_at,films(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    getRatings(),
  ]);
  const films = ((rows ?? []) as unknown as WatchlistRow[])
    .map((r) => embeddedOne(r.films as unknown as Film | Film[] | null))
    .filter((f): f is Film => f !== null);

  return (
    <div className="wrap">
      <div className="section-head">
        <h2>My watchlist</h2>
        <p className="now-count">
          {films.length} film{films.length === 1 ? "" : "s"} saved
        </p>
      </div>
      {films.length === 0 ? (
        <p className="empty show">
          Nothing saved yet. Use the Watchlist button on any film to save it
          here.
        </p>
      ) : (
        <div className="grid">
          {films.map((film) => (
            <FilmCard
              key={film.slug}
              film={film}
              rating={ratings[film.slug] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
